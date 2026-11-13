# DeepSeek Harness 开源版能力落实盘点

> 盘点日期：2026-11-12  
> 范围：`jg-client-1.0` + `dsh-runtime` 实际运行态。只统计运行时、profile、SDK 适配层、服务端 API 与持久化链路；**GUI 展示不在本次统计内**。  
> 口径：`已落地` = 运行时启用且产品后端真实调用/持久化；`部分` = 运行时启用但产品只接了一部分，或用产品自研能力替代；`未落地` = 运行时未启用或产品没有真实链路；`风险` = 已启用但缺少企业级治理。

## 一、结论

1. **Agent 核心链路是扎实的**：`0.2.2-rc.1` 的 Agent Loop、会话 JSONL 持久化、跨重启恢复、工作目录、DeepSeek 模型、推理强度、token 用量、压缩、计划模式、待办、子代理、工作流、技能、MCP、定时任务都已真实运行。
2. **执行安全有骨架，但矩阵有盲区**：人类审批、自动审批矩阵、只读入口、沙箱都有；审批矩阵目前主要覆盖 `pwsh` 与文件路径，**MCP 写操作、插件管理工具、网络外发没有进入同一套风险评估**。
3. **插件市场已统一收口并打通 Bundle 一键安装**：DSH 4 个默认技能、集团技能与客户端内置插件统一进入市场条目；社区提交、审核、上下架、编辑、删除、下载、安装、卸载已打通。Bundle 使用内置 pnpm 真正安装进 `data/dsh-home`，并补写 profile `bundles`、校验失败自动回滚；安装范围仍是本机全局而非按账号隔离。原生设置、凭据、会话检索在设置中心只读展示，会话导出走产品真实消息记录。
4. **第三阶段是“进程内队列 + 持久执行记录”**：`chat-run` 先 `queued` 再由并发槽启动，支持排队中取消和执行中停止；任务记录持久化，重启后 `queued/running` 标为 `interrupted` 但不自动重放。真正的跨重启续跑、断点快照仍未实现，停止依赖关闭会话独占运行时而非 DSH 原生 `session/cancel`。
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
| 会话检查点 | 已确定边界 | `session-checkpoint-policy` 已挂载，做的是模型请求/顶层工具调用前的语义持久化；不备份文件内容，产品侧回滚入口未提供。设置页只读展示策略与“文件回滚未提供”。 |
| AI 会话标题 | 已落地 | profile 显式启用 `session-title-llm`；产品做了标题可用性过滤后落库。`server.mjs:3572` |
| 会话全文检索 | 已落地 | profile 已挂载 `optional-session-search` 组（`session-query-sqlite` + `tool-session-query`），模型可检索/读取当前工作区历史会话；产品消息面板仍保留自有全文过滤。`server.mjs:ensureNativeSessionSearch` |
| 会话导出 | 已落地（产品侧） | `GET /api/conversation/export?id=` 按真实消息记录导出 Markdown；`dsh-session-log-export` 未进入 base bundle，原生 ZIP 导出未接。 |
| 遥测/可观测 | 已收口 | `harness.mjs` 在 env 未显式指定时注入 `DSH_TELEMETRY_DISABLED=1` 与 `DSH_TELEMETRY_MODE=DISABLED`；`dsh-session-telemetry-otel` 的 `DISABLED` 分支不构造 provider，不会向公网 collector 发请求。运行态核对到 collector IP 无已建立连接。 |

### 3.2 执行与安全

| 能力 | 状态 | 实际情况与证据 |
|---|---|---|
| 人工审批 | 已落地 | `dsh-user-approval` + `approval/request` 回调 + 产品审批/拒绝接口。`harness.mjs:104-115`、`server.mjs:3519` |
| 自动审批矩阵 | 已收口（MCP 写操作） | `autoApprovalAllowed()` 增加外部副作用工具识别；MCP 桥在 `im_send`/`task_create` 执行前调用 `POST /api/mcp/approval`，服务端定位当前唯一活动会话并生成审批卡，用户批准后才调用产品接口。实测批准后创建成功、拒绝后无副作用。 |
| 用户提问 | 已落地 | `onQuestion` → `pendingInteractions` → `/api/chat/answer`。`server.mjs:3527`、`:3636` |
| 计划模式 | 已落地 | `/plan` 原生激活；计划评审走通用 user-question 选项流。`harness.mjs:514-518`、`:556` |
| 沙箱与权限 | 已落地 | base 启用 `sandbox-local`、`sandbox-policy`、`pwsh-sandbox`；产品统一从 `/permission read-only` 入口起，按审批逐次提权。 |
| Windows 沙箱前置条件 | 风险 | 历史问题：普通权限启动时 `dsh-sandbox-windows-acl` 需要 `SeSecurityPrivilege`，当前用管理员启动规避；企业部署需明确权限模型。 |
| pwsh 工具 | 已落地 | Windows 下 `tool-bash` 禁用、`tool-pwsh` 启用；产品大量真实命令执行已实测。 |
| 文件读写/编辑/apply_patch | 已落地 | `tool-fs` 在 profile 中显式 `applyPatch: true`；`tool-fs-search` 启用。 |
| 后台作业 | 已确定边界 | `jobs-local` + `tool-jobs` 可用；SDK client 没有 job/kill 协议，停止只能关闭沙箱根运行时。产品按钮已改为「停止运行时」并写明会终止全部后台作业。`chat-run` 已有进程内并发槽与排队状态，和后台作业不是同一层。`server.mjs:3491` |
| 持久终端 | 未落地 | `dsh-tool-terminal`、`dsh-terminal-*` 未进入 `sdk` bundle；历史 Windows PTY 尝试已回滚。 |
| Web 搜索/抓取 | 已落地 | `dsh-web`、`web-search-deepseek`、`web-fetch-http`、`tool-web` 均在 base。 |
| 超时/重复调用提醒 | 已落地 | `tool-call-timeout-policy`、`repeat-tool-reminder` 在 base。 |
| PTC 执行器 | 已确定边界 | `workflow-ptc` 保持启用；直接 `tool-executor-ptc` 刻意关闭，避免模型用 `run_code` 包裹嵌套工具、绕过逐步审批与步骤展示；设置页只读展示两者状态。 |

### 3.3 技能、MCP 与插件

| 能力 | 状态 | 实际情况与证据 |
|---|---|---|
| 技能框架 | 已核对现状 | `skill`、`skill-filesystem`、`tool-skill` 已启用；`$DSH_HOME/skills` 实际有 `agent-experience`、`cordis-composition-reference`、`cordis-plugin-development`、`editing-cordis-compositions`、`jg-product`、`market-M-01`、`market-M-03` 等目录技能，Office 通过 `skill-office` 插件加载。设置页已只读列出目录技能与 Office 插件状态。 |
| Office 技能 | 已落地 | profile 显式启用 `skill-office`，并指向 `dsh-skill-office/assets` 与 `libreoffice-kit` CLI。 |
| MCP 客户端/资源 | 已落地 | base 有 `mcp-resources`；profile insert `mcp-jg`；产品有资源目录与读取接口。 |
| 产品 MCP 工具 | 已落地 | `mcp-jg.mjs` 注册 10 个工具：`drive_search`、`drive_read`、`notice_list`、`notice_read`、`academy_search`、`contacts_find`、`im_send`、`notebook_search`、`resource_query`、`task_create`。 |
| 插件管理器 | 部分 | `plugin-manager`、`tool-plugin-manager` 已启用；产品库存按当前 profile 用 `dsh --dump-config` 即时生成，启停只改 profile patch 并提示重启。`server.mjs:617-690` |
| 插件市场/用户插件真实挂载 | 已落地 | 2026-11-13 市场收口为 10 条：4 个 DSH 默认技能、集团技能与社区技能；`/api/plugins` 只返回本机实际加载的 9 项，其中 Office/MCP 为 `kind='capability'` 底层能力，不进入市场。社区包审核通过后入库，DSH Bundle 用内置 pnpm 安装进 `data/dsh-home`，补写 profile `bundles`，失败自动回滚；管理中心可上下架、编辑、排序、改发布单位、查看安装用户。技能安装按账号写 `data/agents/<userId>/skills`、按项目写 `<cwd>/.dsh/skills`，已互不可见；Bundle 仍为本机运行时级。 |
| 选中插件注入 | 部分 | 产品把选中的插件名称/描述拼进上下文提示，不是运行时能力。`server.mjs:3479-3483` |
| DSH 原生设置/配置编辑 | 已确定边界 | `settings`、`config-editor` 运行时已挂载；产品设置是唯一可写入口，设置中心只读展示原生挂载状态，不提供编辑表单。 |
| 凭据管理 | 已确定边界 | `authorization`、`credentials-local` 已挂载；模型密钥由产品设置中心按会话注入子进程环境，产品不读取 DSH `.credentials.yaml` 内容。 |
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
| 持久化任务队列 | 部分 | `chat-run` 先 `queued`，由进程内并发槽（默认 2）启动；任务记录持久化，重启后 `queued/running` 标为 `interrupted`，保留指令但不自动续跑。没有常驻跨重启 worker 与断点重放。 |
| 长任务取消 | 已落地（会话级） | 每个会话在运行时缓存键中追加 `runtimeScope=会话 id`，即使多个 Work 会话共享同一项目目录，也各自独占运行时。停止先尝试 DSH 原生 `session/cancel`，SDK 未暴露时关闭该会话运行时。实测同项目两个 Work 会话并发，取消一个后另一个正常完成。 |
| 语音输入/语音转写 | 未落地 | `experimental-voice-input`、`speech-to-text` 未进入 profile。 |
| 其他实验能力 | 未落地 | forge、liveshare、Ralph、inspector、auto-review、COT translation、action-cards 均未装载。 |

## 四、关键缺口与风险

### 已收口：MCP 外部副作用绕过审批

`autoApprovalAllowed()` 原先只解析命令文本和文件路径，`im_send`、`task_create` 这类 MCP 工具没有 `command`/`path`，会被直接判为低风险并自动放行。更关键的是，DSH 的 MCP 桥默认没有把这些工具送进 `approval/request`，只改矩阵函数根本拦不住。

2026-11-12 已把闸门前移到 MCP 桥：`mcp-jg.mjs` 在 `im_send`、`task_create` 执行前调用 `POST /api/mcp/approval`；服务端按 MCP token/账号定位当前唯一活动会话，生成 `approval` 待处理项并等待用户选择，批准后才调用 `/api/ai/invoke`。没有活动会话或有多个活动会话时一律拒绝（fail closed）。实测：批准后待办创建成功；拒绝后模型收到“用户未批准该 MCP 外部副作用操作”，没有产生任何待办。

### 已收口：遥测默认端点

`session-telemetry-otel` 默认 `FEEDBACK_ONLY`，端点是外部 collector。`harness.mjs` 现在在 env 未显式指定时注入 `DSH_TELEMETRY_DISABLED=1` 和 `DSH_TELEMETRY_MODE=DISABLED`；DSH 的 `DISABLED` 分支不构造 SDK provider，只保留“反馈未上传”的本地告警。运行态已核对 `dsh-otel-collector.deepseeksvc.com` 两个解析 IP 上没有已建立连接。管理员如确需内网 OTLP，需要显式改 env 并自行承担外发策略。

### P1：插件市场已统一收口，DSH Bundle 一键安装已落地

2026-11-13 市场已按三层架构拆分：Harness 核心运行时之下是平台公共能力，再往上是业务插件与技能。平台公共能力独立于市场目录，默认安装启用、对全部授权用户开放、不提供卸载入口；当前收录 Office/PDF、内部工具 MCP、文件管理、Python 脚本环境、数据检索 5 项真实运行时能力。市场只承载业务插件与技能：4 个 DSH 官方技能进入市场目录，开发阶段不保留集团/社区演示条目，`type` 区分 `plugin` / `skill`，分别使用插件与技能图标。技能安装账号范围复制到 `data/agents/<userId>/skills/<原名>`，项目范围复制到 `<cwd>/.dsh/skills/<原名>`，关闭空闲运行时后下一轮对话重新发现。

同轮已补齐社区闭环与 Bundle：普通用户只看自己的提交，管理员看全部；审核通过后条目进入市场并开放下载；管理中心可上下架、编辑名称/描述/分组/发布单位、排序、查看安装用户、删除社区条目。DSH Bundle 使用内置 pnpm 11.21.0 安装，服务端注入 `DSH_HOME=data/dsh-home`，装完补写 profile `bundles`，`dsh --dump-config` 校验失败时自动 `dsh plugin remove` 并回滚；实测上传 → 审核 → 解压 → 市场可见 → 安装 → dump 退出码 0 → 卸载全链路通过。

已完成：技能按账号/项目隔离；DSH Bundle 改为**按账号独立 DSH_HOME**，每个账号只读写 `data/agents/<userId>/dsh-home/profiles/sdk` 的 profile bundles，安装/卸载只影响当前账号，并在首次访问时复制官方基线 bundles 与 4 个官方技能。项目级 Bundle 隔离仍未实现。

### P1：后台任务已有队列，但重启后不自动续跑

`chat-run` 会先进入 `queued`，由进程内并发槽（`JG_MAX_CHAT_RUNS` 默认 2）启动，真正开始时切 `running` 并记录 DSH 会话 id。排队中和执行中都可停止；任务记录持久化，重启后 `queued/running` 标为 `interrupted`，保留会话与指令。真正的跨重启 worker、幂等键、断点快照和自动重放仍未实现，当前刻意不自动重放，避免重复副作用。

### P2：DSH 原生设置、凭据、检索、导出

设置中心「DSH 原生设置（只读）」已展示原生 `settings`、`config-editor`、`authorization`、`.credentials.yaml` 存在性与模型密钥来源，产品设置仍是唯一可写入口，避免两套配置源。会话检索已挂载 `dsh-tool-session-query` 与 `dsh-session-query-sqlite`，模型可检索/读取当前工作区历史会话；设置页新增「原生会话检索」「会话导出」状态。会话导出由产品按真实消息记录生成 Markdown，DSH 原生 ZIP 导出（`dsh-session-log-export`）尚未挂载。

## 五、建议推进顺序

1. **审批矩阵继续扩面**：MCP 写工具已走人工审批；下一步把插件管理、网络外发也纳入同一套人工确认，并补拒绝路径的回归测试。
2. **插件市场已完成统一收口**：技能包与 DSH Bundle 都已通过市场安装，pnpm 已内置（`installAvailable=true`），默认技能、集团技能进入市场目录；Office/MCP 作为底层能力保留在运行时。管理中心可上/下架、编辑、排序、改发布单位、查看安装用户。后续只剩 Bundle 的账号/项目隔离与安装权限细分。
3. **持久任务队列继续补断点**：现有 `chat-run` 已有入队、并发槽、取消与中断标记；下一步补幂等键、断点快照与可选的自动续跑，仍不做无条件重放。
4. **最后收口原生导出与账号隔离**：补齐 `dsh-session-log-export` 的原生 ZIP/Markdown 导出，并评估按账号/项目隔离 `DSH_HOME` 或运行时。

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
