# DeepSeek Harness 能力盘点（V2.0 后）

盘点时间：2026-11-11  
运行实例：`D:\project-test3\jg-client-1.0`，端口 `57072`  
运行时：`@deepseek-ai/dsh@0.2.2-rc.1`、`@deepseek-ai/dsh-sdk-client@0.2.2-rc.1`  
唯一 profile：`sdk`，bundles = `@deepseek-ai/dsh-base` + `@deepseek-ai/dsh-sdk-app`  
盘点依据：`--dump-config` 实际组合、SDK 类型定义、`harness.mjs` / `server.mjs` / `public/app.js` 当前源码。

> 口径：本文件区分“运行时包已安装”“插件已在 sdk profile 挂载”“产品已有用户入口”三层。已安装不等于已启用，已启用不等于用户可用。除特别注明外，本轮为静态核对，未逐项真机触发。

> 落实进度：本文件第七、八章的 P0 执行安全项已有首批落地与真机证据，详见 [`Harness逐步落实记录.md`](./Harness逐步落实记录.md)。本文件仍保留“盘点时点”的原始结论，不随落实进度改写。

## 一、结论

**核心 agent 能力已经接通，但远不是“Harness 开源能力全部落实”。**

当前状态可以概括为：

- **Agent 运行时**：文件、PowerShell、技能、MCP 工具、审批、提问、计划、目标、子代理、工作流、待办、后台作业、联网、定时任务、压缩、交付物、token 计量都已挂载。
- **产品控制面**：对话、模型、推理强度、停止、审批允许/拒绝、提问、计划评审、待办、后台作业概览、交付物卡片、定时任务、Auto/Manual 已可用。
- **仍未产品化**：原生 workspace 注册表、远程设备接入、文件变更摘要、子代理正文、工作流阶段、作业面板与停止、MCP 资源浏览、会话全文检索/导出/统计、插件运行时管理、设置中心、语音输入、Office 技能、持久终端、apply_patch、PTC 执行器、官方 Web/Desktop UI 套装。
- **V2.0 还有 4 个验收项没闭合**：执行策略仍信任客户端传值、项目 API 未校验归属、Auto 下目录内大规模删除无强制审批、审批参数与审批审计没有落库。

一句话：**运行时能力大体齐了；缺的主要是“控制面、可观测性、远程执行通道”和 V2.0 的执行安全闭环。**

## 二、运行时实际挂载情况

已确认挂载（节选）：

- 文件与命令：`tool-fs`、`tool-fs-search`、`tool-pwsh`、`pwsh-sandbox`、`fs-sandbox`
- 会话：`session`、`session-persistence-jsonl`、`session-projection-cache`、`session-checkpoint-policy`、`working-directory`、`tool-working-directory`
- Agent：`agent`、`agent-loop`、`agent-instructions`、`system-prompt`
- 计划/目标：`plan-mode`、`goal`、`goal-round-driver`、`tool-goal`
- 子代理/工作流：`subagent`、`subagent-spawn-in-process`、`subagent-fork-in-process`、`tool-subagent`、`tool-subagent-fork`、`tool-subagent-control`、`workflow-ptc`、`tool-workflow`
- 待办/作业：`tool-todo`、`jobs`、`tool-jobs`
- 审批/提问：`dsh-user-approval`、`permission-presets`、`tool-ask-user`、`user-questions`
- Web：`web`、`web-search-deepseek`、`web-fetch-http`、`tool-web`
- MCP：`mcp-resources`、`mcp-client`（产品插入 `mcp-jg`）
- 技能：`skill`、`skill-filesystem`、`tool-skill`
- 调度：`schedule`、`tool-schedule`
- 交付物：`present`、`file-reference-local`、`deliverable-file-references`
- 压缩/计量：`compaction-basic`、`command-compact`、`tool-result-pruner`、`token-meter`
- 插件/设置：`plugin-manager`、`tool-plugin-manager`、`settings`、`config-editor`

明确未启用或按配置关闭：

| 能力 | 包 | 状态 |
|---|---|---|
| 会话全文检索 | `dsh-session-query-sqlite` | `openAt: never` |
| Office 技能 | `dsh-skill-office` | 缺 `DSH_PRIMARY_RUNTIME` / `DSH_BUNDLED_OFFICE_CLI`，未挂载 |
| 工作区依赖工具 | `dsh-tool-workspace-dependencies` | 缺 `DSH_PRIMARY_RUNTIME`，未挂载 |
| apply_patch | `dsh-tool-fs` | `applyPatch: false` |
| PTC 执行器 | `dsh-tool-executor-ptc` | 显式 `disabled: true` |
| Bash 工具 | `dsh-tool-bash` / `dsh-bash-sandbox` | Windows 平台禁用，实际用 pwsh |
| LLM 自动标题 | `dsh-session-title-first-prompt-llm` | `disabled: true` |
| 文件观察策略 | `dsh-fs-observation-policy` | `disabled: true` |
| HMR | `dsh-hmr` | SDK 组合主动禁用 |
| 官方 Web 客户端 UI | `dsh-client-ui-*`、`dsh-web-app` | sdk profile 不挂载 |
| ACP / Headless | `dsh-acp`、`dsh-headless` | 未挂载 |

## 三、已落地并可用

| 能力 | 产品入口 | 证据 |
|---|---|---|
| 统一对话、模型、推理强度 | 首页 / 会话页 | 三档低/中/高真机回复 |
| 停止生成 | 会话页停止按钮 | 关闭子进程，下一轮重建 |
| 会话恢复 / 删除 | 侧栏 | `resumeSession`、删除 API |
| 文件读写 / 搜索 | 模型工具 | read/write/edit/glob/grep |
| PowerShell | 模型工具 | 管理员模式真实执行 |
| 审批允许一次 / 拒绝 | 审批卡 | Manual 写入审批后真实落盘；拒绝路径已验证 |
| 用户提问 | 问答卡 | 选项、自定义、取消 |
| 计划模式 | `/plan` + 计划评审卡 | 原生 `/plan` 与 `exit_plan_mode` |
| 待办清单 | 任务清单块 | `todo_write` 三态 |
| 后台作业概览 | 作业块 | running/completed、label/detail |
| 交付物 | 交付物卡片 | `present` 文件 +「打开」 |
| 定时任务 | 定时任务页 | 创建、暂停、启用、删除真实写盘 |
| 上下文压缩 | `/compact` | 真实压缩 |
| 产品 MCP 工具 | 模型工具 | `mcp__jg__*` 10 个工具 |
| 技能 | 技能页 / 模型 | `jg-product` + 技能根 |
| Auto/Manual | 输入框下方 | `/permission read-only` / `workspace-write` |
| 项目 / 文件夹绑定 | 输入框下方浮层 | 创建、绑定、解除、项目会话 |
| 无项目聊天 | 首页直接输入 | Chat 托管目录 |

## 四、运行时已挂载，但产品只有部分入口或没有入口

| 能力 | 当前状态 | 还缺什么 |
|---|---|---|
| 子代理 | 步骤里只有 started/finished 两行 | 子会话列表、子会话正文、可进入/停止的控制面 |
| 工作流 | `tool-workflow` 结果落普通步骤 | 阶段/节点视图，官方 `client-ui-workflow-run` 未挂载 |
| 后台作业 | 只有概览块 | 独立作业面板、保留输出查看、人类停止（`api-job-controller` 未挂载） |
| 目标 | `/goal` 命令可用 | 目标面板、进度、清除、目标历史 |
| 权限预设 | 三档已挂载 | 产品只映射 Auto/Manual 两档；`danger-full-access` 无入口，无预设管理页 |
| MCP 资源 | `mcp-resources` 已挂载 | 资源列表、读取、订阅、来源/健康状态 |
| MCP 配置 | 只静态插入 `mcp-jg` | 新增/编辑 MCP server、鉴权、启停、失败状态 |
| 插件管理 | `plugin-manager` / `tool-plugin-manager` 已挂载 | 产品插件页是自建上传/安装，不走 DSH 插件启停与组合包 |
| 设置 / 配置编辑 | `settings` / `config-editor` 已挂载 | 无运行时设置中心（agent loop、模型路由、web、shell、subagent、session log） |
| Agent preset | 包已安装 | sdk profile 未挂载；无会话级 preset 选择 |
| 会话 checkpoint | `session-checkpoint-policy` 已挂载 | 无检查点列表、回滚/恢复入口 |
| token 计量 | `token-meter` 已挂载 | 无 token/耗时/成本展示 |
| 命令反馈 | `command-feedback` 已挂载 | `/feedback` 未在产品命令菜单暴露，未验证 |
| 交付物打开 | 卡片可打开 | `/api/harness/file` 只允许 `data/dsh-workspace`，项目 `cwd` 下的交付物打不开 |
| 项目指令 | `agent-instructions` 已挂载 | 项目表单无“项目指令”字段；“默认记忆”只是 toast 占位 |
| 原生 `/plan` | 功能可用，但不在 `/` 命令菜单 | 补 `/plan`、`/plan off` 菜单项与说明，避免高级用户只能盲打 |

## 五、运行时包已安装，但当前 profile 未挂载

| 能力族 | 代表包 | 影响 |
|---|---|---|
| 官方 Web/Desktop UI | `dsh-web-app`、`dsh-host-webserver`、`dsh-client-ui-*` | 官方聊天、设置、插件市场、会话日志、工作流、子代理、作业、权限预设等整套 GUI 不在产品里 |
| 远程接入 / 设备配对 | `dsh-api-remote-access`（已挂载访问控制）、`dsh-api-remotes`、`dsh-api-workspace-controller` | 没有远程设备、Peer、配对、跨设备授权入口 |
| 原生 Workspace | `dsh-workspace`（已挂载）、`dsh-api-workspace-files`、`dsh-workspace-changes` | 无原生项目侧栏/工作区文件浏览/文件变更摘要；产品项目是自建 JSON 记录 |
| 持久终端 | `dsh-terminal`、`dsh-tool-terminal`、`dsh-tool-pwsh-persistent` | 无集成终端、无跨调用 shell 状态，只有一次性 pwsh |
| 会话检索 / 导出 / 统计 | `dsh-session-query`、`dsh-tool-session-query`、`dsh-session-log-export`、`dsh-session-stats`、`dsh-session-turn-outline` | 侧栏只能按标题匹配；无全文检索、导出、统计、轮次大纲 |
| 文件变更 | `dsh-workspace-changes`、`dsh-fs-patch`、`dsh-tool-str-replace-editor` | 无 diff 摘要、无 apply_patch、无行替换编辑器 |
| Office / 转换 | `dsh-skill-office`、`dsh-office-to-pdf`、`libreoffice-kit` | 内置 Office 技能未启用；产品 Word/PDF 依赖自建技能 |
| 消息反馈 / 引用 | `dsh-message-feedback`、`dsh-client-ui-message-feedback`、`dsh-message-quotes` | 无逐条消息评分/分类，无引用回复 |
| 语音输入 | `dsh-experimental-speech-to-text`、`dsh-experimental-voice-input-bundle`、`dsh-client-ui-voice-input` | 产品麦克风按钮是“演示”toast，不是真实转写 |
| 编辑器和终端集成 | `dsh-acp`、`dsh-acp-app`、`dsh-host-open-in-app`、`dsh-host-directory-picker-native` | 无 ACP/IDE 接入、无“在编辑器中打开”、原生目录选择器未走 DSH host |
| 实验能力 | `dsh-experimental-agent-team`、`dsh-experimental-worktree`、`dsh-experimental-forge`、`dsh-experimental-liveshare`、`dsh-experimental-auto-review`、`dsh-experimental-translator`、`dsh-experimental-client-ui-stats` | Agent 团队、worktree、Forge、协作、自动评审、翻译、统计均未启用 |

## 六、不是“漏做”，是 SDK / 架构边界

1. **原生 Workspace 注册表对 SDK 不可见**  
   `dsh-workspace` 已挂载，维护 `ctx.workspaceRegistry`，但 SDK 类型只暴露 `cwd`、`get/setWorkingDirectory`、`resumeSession`，没有 workspace registry / workspace controller API。当前“产品项目记录 + Session cwd”是兼容方案，不是原生 workspace 侧栏。

2. **审批只有一次性和三种结果**  
   `dsh-user-approval` 的结果词汇只有 `allowed-once` / `rejected` / `cancelled`，没有 allow-always、会话级持久授权。审批请求只带 tool 名、reason、可选 callId，不带工具参数；产品要在卡片上展示“改哪个文件/执行什么命令”，需要额外关联 `tool/call`，当前未做。

3. **没有单轮取消 API**  
   SDK 只能关闭 Harness 子进程来停止，下一轮重建并 `resumeSession`。这是当前停止按钮的实现边界。

4. **图片识图取决于模型**  
   Harness 已支持 image content block，但 `deepseek-chat` 不接受图像；产品只能提示“当前模型不支持识图”。

5. **官方 GUI 与 sdk profile 二选一**  
   `dsh-client-ui-*` 依赖 Web/Desktop host，sdk profile 明确不启动 Web server。要用官方 GUI 能力，需要另起 `web`/desktop 宿主，不是加几个配置就能进现有自建界面。

## 七、V2.0 仍未闭合的执行安全项（优先）

| 编号 | 问题 | 证据 | 影响 |
|---|---|---|---|
| S1 | `executionPolicy` 仍由请求体决定 | `server.mjs` 第 2483 行 `body.executionPolicy === 'manual' ? 'manual' : 'auto'`，未与 `conv.executionPolicy` 比对 | 客户端可直接把 Manual 会话发成 Auto，违反“服务端可信状态” |
| S2 | 项目 API 未校验归属 | 第 2475 行只查 `id` + `!removed`，不校验 `owner`；`/api/projects` 列表才按 owner 过滤 | 知道项目 ID 即可让 Agent 在他人项目目录执行 |
| S3 | 设备绑定未落到请求校验 | 项目只存 `deviceId`；`/api/chat` 只检查 `cwd` 是否存在，不校验当前设备 | 换设备/换机器仍可能使用同一项目目录 |
| S4 | Auto 下目录内高风险操作不强制审批 | Auto 使用 `workspace-write`，对目录内写/删/命令不触发 `approval`；仅越界升级才审批 | 大规模删除/覆盖、危险命令没有产品侧规则拦截 |
| S5 | 审批卡不展示参数，审批决策不落审计 | `onApproval` 只传 `toolName/callId/reason`；`logAudit` 无 approval 记录 | 无法证明“批准的是哪个文件/哪条命令”，不满足审批可追溯 |
| S6 | 项目交付物打不开 | `/api/harness/file` 白名单固定 `data/dsh-workspace` | 项目 `cwd` 下 `present` 的文件无法通过产品下载 |
| S7 | 切换 Auto/Manual 只对下一轮生效 | `runAgent` 在每轮开始时执行一次 `/permission` | 执行中切换不会立即改变本轮后续工具调用 |
| S8 | 项目“默认记忆”是占位 | `app.js` 第 2473 行只 toast“后续版本开放” | 项目指令/记忆没有真实存储与注入 |

## 八、建议优先级

### P0：先补执行安全与验收闭环

1. 服务端以会话存储的 `executionPolicy` 为准，请求体只允许“申请切换”，由服务端校验并写回。
2. `/api/chat` 校验 `project.owner === user.name`、`project.deviceId === 当前设备`，并加设备在线心跳。
3. Auto 增加目录内高风险规则：批量删除/覆盖、格式化、危险命令、生产写入，命中即转审批。
4. 审批卡通过 `callId` 关联 `tool/call` 参数，展示文件/命令；审批结果写 `logAudit`。
5. `/api/harness/file` 按项目 `cwd` 开白名单，或改为签名下载票据。
6. 执行中切换策略：至少禁止“Manual → Auto 中途放宽”，并在 UI 说明下一轮生效。

### P1：补控制面

7. 文件变更摘要：挂 `dsh-workspace-changes`，或从 `tool/call` 的 write/edit 参数生成 diff 摘要。
8. 子代理正文与工作流阶段：映射 child session 事件/官方 `client-ui-workflow-run` 的数据结构。
9. 作业面板与停止：挂 `api-job-controller`，接 `job.list/job.follow/job.kill`。
10. 会话全文检索/导出：打开 `session-query-sqlite`，接 `session-log-export`。
11. MCP 资源浏览与 MCP server 管理。
12. 插件运行时管理、设置中心、Agent preset。
13. 原生 workspace 侧栏：需要另起宿主，或继续用产品项目 + cwd 但补齐 workspace files 浏览。

### P2：增强与实验

14. Office 技能（配置 `DSH_BUNDLED_OFFICE_CLI` / office skills）。
15. 持久终端、open-in-app、ACP。
16. apply_patch、PTC 执行器。
17. 语音输入、消息反馈、AI 会话标题、token/成本展示。
18. Agent team、worktree、Forge、Liveshare 等实验能力。

## 九、复现与证据

```powershell
$root='D:\project-test3\jg-client-1.0'
$env:DSH_HOME="$root\data\dsh-home"
$node="$root\runtime\node.exe"
$bin="$root\dsh-runtime\node_modules\@deepseek-ai\dsh\lib\bin.js"
Push-Location "$root\data\dsh-workspace"
& $node $bin --profile sdk --dump-config > "$root\data\dsh-dump-config.txt"
Pop-Location
```

关键源码位置：

- `harness.mjs`：`getHarness` / `runAgent` / `stepsOf` / `jobsOf` / `deliverablesOf`
- `server.mjs`：`/api/chat`（2468 起）、`/api/chat/approval`（2636）、`/api/harness/file`（3314）
- `public/app.js`：`SLASH_COMMANDS`（1783）、`renderChat`（8584）、`openProjectForm`（2350）
- `data/dsh-dump-config.txt`：当前 sdk profile 实际组合

## 十、一句话回答

**Harness 的运行能力已经覆盖了大部分日常 agent 场景；现在最大的缺口不是“再装一个包”，而是把已挂载的 workspace、文件变更、作业、检索、设置、插件和远程接入做成产品控制面，同时把 V2.0 的执行策略、项目归属、设备绑定和审批审计补成真正的服务端强制闭环。**
</content>
