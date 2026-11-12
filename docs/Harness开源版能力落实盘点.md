# DeepSeek Harness 开源版能力落实盘点

> 盘点日期：2026-11-12  
> 范围：`jg-client-1.0` + `dsh-runtime` 实际运行态。只统计运行时、profile、SDK 适配层、服务端 API 与持久化链路；**GUI 展示不在本次统计内**。  
> 口径：`已落地` = 运行时启用且产品后端真实调用/持久化；`部分` = 运行时启用但产品只接了一部分，或用产品自研能力替代；`未落地` = 运行时未启用或产品没有真实链路；`风险` = 已启用但缺少企业级治理。

## 一、结论

1. **Agent 核心链路是扎实的**：`0.2.2-rc.1` 的 Agent Loop、会话 JSONL 持久化、跨重启恢复、工作目录、DeepSeek 模型、推理强度、token 用量、压缩、计划模式、待办、子代理、工作流、技能、MCP、定时任务都已真实运行。
2. **执行安全有骨架，但矩阵有盲区**：人类审批、自动审批矩阵、只读入口、沙箱都有；审批矩阵目前主要覆盖 `pwsh` 与文件路径，**MCP 写操作、插件管理工具、网络外发没有进入同一套风险评估**。
3. **产品化外围仍偏薄**：插件市场/技能市场大多还是产品侧元数据与上下文提示，没有真正挂载成 DSH 技能或工具；DSH 原生设置、凭据、会话检索、会话导出没有接入。
4. **第三阶段只完成了执行记录**：持久化 `chat-run` 记录和中断恢复已有；真正的后台任务队列、断点续跑、长任务取消还没有。
5. **实验能力基本未部署**：多代理团队、持久终端、worktree、forge、liveshare、Ralph、语音输入、自动评审、COT 翻译均未进入当前 `sdk` profile。

## 二、部署基线

| 项 | 实际值 | 证据 |
|---|---|---|
| DSH 版本 | `0.2.2-rc.1` | `dsh-runtime/node_modules/@deepseek-ai/dsh/package.json` |
| SDK 客户端 | `0.2.2-rc.1` | `dsh-runtime/node_modules/@deepseek-ai/dsh-sdk-client/package.json` |
| 运行 profile | `sdk` | `server.mjs` `RUNTIME_PROFILE`；`data/dsh-home/profiles/sdk/package.json` |
| profile bundles | `dsh-base` + `dsh-sdk-app` | 同上 |
| DSH_HOME | `data/dsh-home` | `harness.mjs` `baseHome` |
| profile 补丁 | `mcp-jg`、`session-title-llm`、`tool-fs.applyPatch`、`skill-office` | `data/dsh-home/profiles/sdk/cordis.patch.yml` |
| 执行入口 | `runAgent()` → `session.run()` | `harness.mjs:489`；`server.mjs:3507` |

## 三、逐项盘点

### 3.1 基础运行时

| 能力 | 状态 | 实际情况与证据 |
|---|---|---|
| Agent Loop / 多轮对话 | 已落地 | `dsh-agent-loop`、`dsh-agent` 在 base；产品每轮走 `runAgent()`，同一会话续用 `resumeSession`。 |
| 会话 JSONL 持久化 | 已落地 | `session-persistence-jsonl`，根目录 `$DSH_HOME/sessions`。 |
| 跨进程会话恢复 | 已落地 | `resumeSession` 优先；产品保存 `conv.dshSessionId`。`harness.mjs:541-548` |
| 工作目录绑定 | 已落地 | `session.setWorkingDirectory(cwd)`；工作模式用项目目录，对话模式用会话托管目录。`harness.mjs:553` |
| DeepSeek 官方模型 | 已落地 | `provider: deepseek-official`；密钥按次注入 Harness 子进程环境。`harness.mjs:87-97` |
| 多模型供应商 | 未落地 | `llm-pi-ai` 处于 dormant，需 `llm-pi-ai:` 设置段才注册路由；产品没有配置，只支持 DeepSeek。 |
| 推理强度 | 已落地 | `reasoningEffort` 传入构造参数，并按 effort 分 key 创建独立运行时。`harness.mjs:36-40`、`:93` |
| token 用量 | 已落地 | `dsh-token-meter`；`usageOf(events)` 回传产品。`harness.mjs:593` |
| 上下文压缩 | 已落地 | `compaction-basic`、`tool-result-pruner`、`image-offload`、`/compact` 均在 base。 |
| 会话检查点 | 部分 | `session-checkpoint-policy` 已挂载，但没有产品侧“回滚到某个检查点”的 API/操作。 |
| AI 会话标题 | 已落地 | profile 显式启用 `session-title-llm`；产品做了标题可用性过滤后落库。`server.mjs:3572` |
| 会话全文检索 | 未落地 | `session-query-sqlite` 配置 `openAt: never`；产品搜索是对自有会话消息做字符串过滤，不是 DSH 检索。`server.mjs:3243-3250` |
| 会话导出 | 未落地 | 产品只导出自有 Markdown；`dsh-session-log-export` 未进入 base bundle。 |
| 遥测/可观测 | 风险 | `session-telemetry-otel` 默认 `FEEDBACK_ONLY`，默认端点指向 `dsh-otel-collector.deepseeksvc.com`；项目未设置 `DSH_TELEMETRY_DISABLED`，也未改内网 collector。 |

### 3.2 执行与安全

| 能力 | 状态 | 实际情况与证据 |
|---|---|---|
| 人工审批 | 已落地 | `dsh-user-approval` + `approval/request` 回调 + 产品审批/拒绝接口。`harness.mjs:104-115`、`server.mjs:3519` |
| 自动审批矩阵 | 部分/风险 | `autoApprovalAllowed()` 只解析 `command/cmd/script` 和 `path/file_path/cwd`；**`im_send`、`task_create` 等 MCP 外部副作用工具没有命令/路径参数，会自动放行**。`server.mjs:1243-1265` |
| 用户提问 | 已落地 | `onQuestion` → `pendingInteractions` → `/api/chat/answer`。`server.mjs:3527`、`:3636` |
| 计划模式 | 已落地 | `/plan` 原生激活；计划评审走通用 user-question 选项流。`harness.mjs:514-518`、`:556` |
| 沙箱与权限 | 已落地 | base 启用 `sandbox-local`、`sandbox-policy`、`pwsh-sandbox`；产品统一从 `/permission read-only` 入口起，按审批逐次提权。 |
| Windows 沙箱前置条件 | 风险 | 历史问题：普通权限启动时 `dsh-sandbox-windows-acl` 需要 `SeSecurityPrivilege`，当前用管理员启动规避；企业部署需明确权限模型。 |
| pwsh 工具 | 已落地 | Windows 下 `tool-bash` 禁用、`tool-pwsh` 启用；产品大量真实命令执行已实测。 |
| 文件读写/编辑/apply_patch | 已落地 | `tool-fs` 在 profile 中显式 `applyPatch: true`；`tool-fs-search` 启用。 |
| 后台作业 | 部分 | `jobs-local` + `tool-jobs` 可用；停止靠关闭整个沙箱根运行时，不是单作业接口，且没有持久队列。`server.mjs:3295` |
| 持久终端 | 未落地 | `dsh-tool-terminal`、`dsh-terminal-*` 未进入 `sdk` bundle；历史 Windows PTY 尝试已回滚。 |
| Web 搜索/抓取 | 已落地 | `dsh-web`、`web-search-deepseek`、`web-fetch-http`、`tool-web` 均在 base。 |
| 超时/重复调用提醒 | 已落地 | `tool-call-timeout-policy`、`repeat-tool-reminder` 在 base。 |
| PTC 执行器 | 部分 | `tool-executor-ptc` 显式 disabled；`workflow-ptc` 以 spawn provider 形式启用。 |

### 3.3 技能、MCP 与插件

| 能力 | 状态 | 实际情况与证据 |
|---|---|---|
| 技能框架 | 部分 | `skill`、`skill-filesystem`、`tool-skill` 已启用；`$DSH_HOME/skills` 实际只有 `jg-product` 一个技能。 |
| Office 技能 | 已落地 | profile 显式启用 `skill-office`，并指向 `dsh-skill-office/assets` 与 `libreoffice-kit` CLI。 |
| MCP 客户端/资源 | 已落地 | base 有 `mcp-resources`；profile insert `mcp-jg`；产品有资源目录与读取接口。 |
| 产品 MCP 工具 | 已落地 | `mcp-jg.mjs` 注册 10 个工具：`drive_search`、`drive_read`、`notice_list`、`notice_read`、`academy_search`、`contacts_find`、`im_send`、`notebook_search`、`resource_query`、`task_create`。 |
| 插件管理器 | 部分 | `plugin-manager`、`tool-plugin-manager` 已启用；产品库存读启动快照 `dsh-dump-config.txt`，启停只改 profile patch 并提示重启。`server.mjs:2330-2350` |
| 插件市场/用户插件真实挂载 | 部分 | 2026-11-12 已接通技能包：内置 5 个技能包，上传 ZIP 审核通过后入库，安装复制到 `$DSH_HOME/skills`，模型可见；DSH Bundle 仍不能一键安装。`server.mjs` 市场安装段、`marketplace/skills` |
| 选中插件注入 | 部分 | 产品把选中的插件名称/描述拼进上下文提示，不是运行时能力。`server.mjs:3479-3483` |
| DSH 原生设置/配置编辑 | 部分 | `settings`、`config-editor` 运行时已挂载；产品仍用自己的设置中心，不读写 DSH settings。 |
| 凭据管理 | 部分 | `authorization`、`credentials-local` 已挂载；模型密钥仍由产品按次注入子进程环境，DSH `.credentials.yaml` 只存了 client-connection 记录。 |
| 附件/图片输入 | 已落地 | `attachment-local`；图片按内容块传入 `session.run`。`harness.mjs:521-523` |
| 交付物/present/file reference | 已落地 | `tool-present`、`file-reference-local`、`deliverable-file-references` 均在 sdk-app；产品提取 `deliverables`。 |

### 3.4 多代理、任务与实验能力

| 能力 | 状态 | 实际情况与证据 |
|---|---|---|
| 子代理 spawn/fork | 已落地 | `subagent-spawn-in-process`、`subagent-fork-in-process`、`tool-subagent`、`tool-subagent-control` 均启用。 |
| 子代理正文补全 | 已落地 | 父会话 idle 后继续收 `subagent.finished`，最多等 45 秒。`harness.mjs:497-537` |
| 多代理团队 | 未落地 | `dsh-experimental-agent-team` 未进入 profile。 |
| 工作流 | 已落地 | `workflow-ptc` + `tool-workflow` 启用；产品提取 `workflows`。 |
| 目标（goal） | 已落地 | `goal`、`goal-round-driver`、`command-goal`、`tool-goal` 在 base；模型可直接使用。 |
| 待办 | 已落地 | `tool-todo`；产品提取 `todos`。 |
| 定时任务 | 已落地 | `schedule`、`tool-schedule`；产品读取 `storages/schedule.json`，支持暂停/删除。`server.mjs:1514-1556` |
| 工作区依赖 | 未落地 | `workspace-dependencies` 依赖 `DSH_PRIMARY_RUNTIME`；当前未设置，行被禁用。 |
| worktree 隔离 | 未落地 | `dsh-experimental-tool-worktree` 未进入 profile。 |
| 持久化任务队列 | 未落地 | 只有 `chat-run` 执行记录与中断恢复；没有常驻 worker、队列并发、自动续跑。 |
| 长任务取消 | 未落地 | 没有会话级 cancel/abort 接口；只有关闭沙箱根运行时来停后台作业。 |
| 语音输入/语音转写 | 未落地 | `experimental-voice-input`、`speech-to-text` 未进入 profile。 |
| 其他实验能力 | 未落地 | forge、liveshare、Ralph、inspector、auto-review、COT translation、action-cards 均未装载。 |

## 四、关键缺口与风险

### P0：审批矩阵没有覆盖 MCP 外部副作用

`autoApprovalAllowed()` 的判断输入只有命令文本和文件路径。`im_send`、`task_create` 这类 MCP 工具没有 `command`/`path`，会被直接判为低风险并自动放行；`tool-plugin-manager` 也没有进入矩阵。这意味着“Auto 只自动放行低风险操作”的承诺目前只对 `pwsh`/文件类工具成立。

建议：按工具名建立白名单/黑名单，把 `im_send`、`task_create`、插件管理、网络写操作默认归入人工审批；MCP 工具在 `tools/list` 时带上风险等级，由 `autoApprovalAllowed()` 统一裁决。

### P0：遥测默认端点未治理

`session-telemetry-otel` 默认开启 `FEEDBACK_ONLY`，端点是外部 collector。企业环境应显式设置 `DSH_TELEMETRY_DISABLED=1`，或改为内网 OTLP endpoint；至少在部署文档中写明。

### P1：插件市场已接通技能包，DSH Bundle 仍未落地

2026-11-12 已把市场安装改成真实挂载：内置 5 个技能包（规范条文核查、用地指标测算、公文格式校对、会议纪要整理、合同条款比对），安装时复制到 `$DSH_HOME/skills/market-<id>`，关闭空闲运行时后下一轮对话重新发现；上传的技能包（根目录含 `SKILL.md`）经检测、审核后入库到 `data/market-packages`，同样可安装。实测模型技能清单已出现 `code-compliance-check`。

仍未落地：DSH Bundle 一键安装。当前客户端没有 pnpm，`dsh plugin add` 走不通；Bundle 审核后只登记上架，市场卡片显示“待上架”。另外，技能安装是**本机运行时全局挂载**，不是按账号隔离；要按账号隔离，需要每个用户独立 DSH_HOME 或独立运行时。

下一步：要么补 pnpm 与 Bundle 安装/回滚，要么把“插件市场”明确收敛为“技能市场”，避免 Bundle 条目给人可安装的预期。

### P1：后台任务仍是“记录”不是“队列”

`chat-run` 记录解决了“知道哪次被打断”，但没有解决“服务重启后继续跑”。真正的后台队列需要：任务入队、串行/并发调度、幂等键、断点快照、自动续跑和取消。当前实现刻意不自动重放，避免重复副作用。

### P2：DSH 原生设置、凭据、检索、导出没有接入

运行时组件都在，但产品仍使用自有 settings/搜索/导出。短期可以接受；长期会出现“两套配置源”，例如默认模型、权限、插件启停在不同地方各有一份。

## 五、建议推进顺序

1. **先补审批矩阵**：MCP 写工具、插件管理、网络外发纳入人工审批；这是安全承诺，不是体验优化。
2. **插件市场继续收口**：技能包已真实挂载；接下来决定是补 pnpm 与 Bundle 安装，还是把市场收敛为技能市场，并把安装范围从“本机全局”改成按账号/项目隔离。
3. **然后做持久任务队列**：在现有 `chat-run` 记录上增加 worker、幂等键与断点，不直接做自动重放。
4. **最后收口 DSH 原生设置/检索/导出**：避免两套配置源，补齐会话检索与审计导出。

## 六、附：本次核对的关键文件

- `dsh-runtime/package.json`、`dsh-runtime/node_modules/@deepseek-ai/dsh/package.json`
- `dsh-runtime/node_modules/@deepseek-ai/dsh-base/cordis.patch.yml`
- `dsh-runtime/node_modules/@deepseek-ai/dsh-sdk-app/cordis.patch.yml`
- `data/dsh-home/profiles/sdk/package.json`
- `data/dsh-home/profiles/sdk/cordis.patch.yml`
- `data/dsh-dump-config.txt`
- `harness.mjs`
- `server.mjs`
- `mcp-jg.mjs`
