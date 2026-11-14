# Harness 未落实能力逐步落实记录

记录时间：2026-11-11  
工程：`D:\project-test3\jg-client-1.0`  
运行方式：Electron 客户端（管理员模式）拉起本地服务 + 同机 DSH `sdk` profile  
本轮范围：用户要求“除官方 Web/Desktop UI 套装外，其余盘点出的未落实能力逐步落实”。本次先落 **P0 执行安全闭环**，并顺带补了 P1 中成本最低的三个入口。

---

## 一、本轮已落地

### 1. 审批载荷补齐（S5）

**问题**：DSH `approval/request` 本身只有 `sessionId / toolName / callId / reason`，审批卡无法显示要改哪个文件、写多少内容，用户只能凭 `reason` 决定。

**做法**：

- `harness.mjs` 在运行时启动后订阅 `session.event`，缓存每条 `tool/call` 的 `{ name, arguments }`（按 `callId`，上限 200 条，`tool/result` 或 `turn/end` 时清理）。
- `onRequest('approval/request')` 按 `callId` 从缓存补齐 `toolArgs`、`toolNameResolved` 再交给产品 `onApproval`。
- `server.mjs` 新增 `approvalDetails()`，解析参数并生成 `resource / summary / arguments`：
  - 写文件：显示目标路径与写入字符数；
  - 命令：显示命令前 220 字符；
  - 编辑：显示替换前后字符数。
- `public/app.js` 审批卡新增 `.confirm-draft` 一行，展示 `summary`。

**证据**：

- API Manual 写入 `C-1794390123456`，审批 `AP-40f67324d924` 载荷含：
  - `resource=D:\project-test3\workspaces\traffic-counter\guard-approval.md`
  - `summary=目标：...；写入 7 字符`
  - `arguments` 为完整 JSON 参数。
- 界面 Manual 写入 `C-1794395123456`，审批 `AP-8f010c92e973`；界面审批卡实际显示“目标：…ui-summary.md；写入 7 字符”，截图 `D:\project-test3\shots\v2-approval-summary.png`。
- 点击界面「允许一次」后会话 `done`，`ui-summary.md` 落盘 19 字节。

### 2. 审批审计落库（S5 服务端）

`POST /api/chat/approval` 现在写入审计：

- action：`chat.approval`
- object：会话 ID
- result：`allowed-once / rejected / cancelled` + 工具名 + 目标摘要

实测审计记录：`chat.approval C-1794390123456 allowed-once write 目标：…guard-approval.md；写入 7 字符`。

### 3. 会话归属校验（S2 的会话侧 + S1 的会话侧）

**问题**：`GET /api/conversation`、`POST /api/conversation/move`、`delete`、`/api/chat/pending`、`/api/chat/approval`、`/api/chat/answer`、`/api/chat/cancel` 都不校验会话归属；`GET /api/conversations` 返回全部会话。

**做法**：

- 新会话写入 `userId`；旧会话没有 `userId` 时归 `admin`。
- 统一 `conversationAllowed(user, conv)`：管理员可见全部，普通账号只可见自己的会话。
- `GET /api/conversations`、`GET /api/conversation`、`move`、`delete`、`cancel`、`pending`、`approval`、`answer` 全部接入。

**证据**：

- `employee` 登录：`/api/conversations` 返回 0 条；读取管理员会话 `C-1794384913949` 返回 403。
- `employee` 读取项目列表返回 0 条。

### 4. 项目归属与设备绑定校验（S1/S2/S3）

**问题**：`/api/chat` 只按 `projectId` 找项目，不校验 owner/设备；`projectStatus` 也不看设备。

**做法**：

- 新增 `projectVisibleTo()`、`projectRunnableBy()`：
  - 无权限 → 403 `PROJECT_FORBIDDEN`；
  - 无 cwd → 409 `PROJECT_DIR_REQUIRED`；
  - 设备不一致 → 409 `PROJECT_DEVICE_MISMATCH`。
- `projectStatus()` 增加 `other-device` 状态。
- `/api/chat` 在执行前统一调用 `projectRunnableBy()`。

**证据**：

- `employee` 对 `PRJ-D1F5D4` 发起 `/api/chat` → 403 `PROJECT_FORBIDDEN`。
- 临时把 `data\device.json` 改成另一设备 ID，`/api/chat` → 409 `PROJECT_DEVICE_MISMATCH`；随后已恢复为 `DEV-5d37f532611c`。

### 5. 执行策略以服务端为准（S1/S7）

**问题**：`executionPolicy` 完全信任请求体；执行中切换策略没有服务端入口，前端只翻转本地状态。

**做法**：

- `/api/chat`：
  - 新会话：请求体策略只作为初始值；
  - 已有会话：读取 `conv.executionPolicy`，请求体不再覆盖；
  - 旧会话无策略时默认 `auto`。
- 新增 `POST /api/conversation/policy`：
  - 校验会话归属；
  - `status === 'running'` → 409 `POLICY_RUNNING`；
  - 持久化策略并写审计 `conversation.policy`。
- `public/app.js` 的 `togglePolicy()` 改为调用该接口；运行中切换给出明确提示。

**证据**：

- API：`C-1794384913949` 从 `auto` 切到 `manual`，再读回 `manual`。
- UI：打开 `C-1794395123456` 点击策略按钮，服务端读回 `auto`（原为 `manual`），证明界面确实走了服务端。

### 6. Auto 模式高风险命令前置拦截（S4 首批）

**问题**：Auto 使用 `workspace-write`，目录内递归删除等高风险命令仍可自主执行。

**已做**：

- `server.mjs` 新增 `explicitHighRiskRequest(text)`，在 Auto 模式下对用户**直接下达**的高风险命令返回 403 `HIGH_RISK_REQUIRES_MANUAL`，不进入模型：
  - `Remove-Item -Recurse`
  - `rm -rf`
  - `rmdir /s`、`rd /s`、`del /f|/s|/q`
  - `format X:`、`diskpart`、`shutdown`、`reg delete`
  - `taskkill /f`
  - `git reset --hard`、`git clean -f`
  - `DROP TABLE`、`TRUNCATE TABLE`

**证据**：

- Auto + `PRJ-D1F5D4` + “请直接执行 Remove-Item -Recurse -Force .\__guard_missing_dir__” → 403 `HIGH_RISK_REQUIRES_MANUAL`，无模型轮次。

**仍未闭合**：

- 这一层只覆盖“用户把危险命令直接写进请求”的情况；**模型在 Auto 下自主生成的危险工具调用，仍没有被运行时逐次强制审批**。
- 本轮曾尝试在 `tool/call` 通知上关闭 Harness 实现硬拦截，真机出现客户端进程异常退出，已撤除，不保留该实现。
- 当前实际边界是：Auto 的 DSH 权限仍为 `workspace-write`，破坏范围被限制在项目授权目录内；目录内高风险命令的逐次审批需要 DSH 提供工具级审批策略或可用的中断 API，当前 SDK stdio 面没有。

### 7. 项目交付物可打开（S6）

**问题**：`/api/harness/file` 只允许 `data\dsh-workspace`，项目目录里的交付物一律 403。

**做法**：

- 允许根目录 = `data\dsh-workspace` + 当前用户可见项目的 `cwd`；
- 先 `realpathSync` 再判断路径前缀，防符号链接跳出；
- 文件不存在返回 404，越权返回 403。

**证据**：

- 项目文件 `…\traffic-counter\ui-summary.md` → 200，19 字节；
- 工程源码 `…\jg-client-1.0\server.mjs` → 403；
- 原 `data\dsh-workspace\demo-deliverable.md` → 200，原路径未回归。

### 8. 项目指令（S8 首批）

**问题**：项目只有名称和 cwd，没有可持久化的项目级指令；盘点里 S8 的“项目默认记忆”是占位。

**做法**：

- 项目 create/update 支持 `instructions`，上限 4000 字符；
- `/api/chat` 的项目上下文注入增加：
  `项目专属指令（由项目创建者填写，优先级高于一般习惯，但不得覆盖系统安全规则）`
- 创建项目弹窗新增“项目指令（可选）”输入框，随创建请求提交。

**证据**：

- 把 `PRJ-D1F5D4` 指令改为“所有回答必须以【项目指令生效】开头”，项目内提问“只回答 OK”，模型回复 `【项目指令生效】OK`；
- 已恢复原指令“项目内回答统一使用中文；优先读取 notes.md 作为数据来源。”。

**仍未闭合**：

- “默认记忆”按钮仍是占位；本轮落的是项目指令，不是跨会话记忆条目。

### 9. 待审批会话恢复

**问题**：刷新或重启后重新打开一个仍在等待审批的会话，`openConversation()` 只加载消息，不拉 pending，审批卡不出现。

**做法**：

- `openConversation(id)` 加载会话后请求 `/api/chat/pending?conversationId=…`，写入 `state.pendingInteraction` 再渲染。

**证据**：

- 审批 `AP-8f010c92e973` 等待期间刷新页面 → 点击侧栏会话 → 界面出现“工具调用需要确认”及目标摘要。

### 10. `/plan` 进入斜杠命令菜单（P1）

`SLASH_COMMANDS` 从 `help / compact / goal` 增加 `plan`：

- `/plan 进入原生计划模式`。

**证据**：界面输入 `/` 后菜单出现 `/plan 进入原生计划模式`。

---

### 11. “新聊天”明确为全新起点

**问题**：侧栏顶部和“最近”栏原本各写一份重置逻辑，只清空会话、草稿和项目，仍会带走上一个会话的策略（例如上一个会话是 Manual，新聊天继续 Manual），也不会清掉待审批卡片和附件引用。

**做法**：

- 新增唯一的 `startFreshChat()`，两个入口共用：
  - 清空 `conversation / draft / chatSteps / chatError`；
  - 清空 `activeProjectId / activeProjectName / activeProjectCwd`；
  - 清空 `pendingInteraction / pendingConfirm / qSel / qCustom` 并停止旧会话的审批轮询；
  - 清空 `composerRefs`；
  - 执行策略强制回到 `Auto`；
  - 回到首页并聚焦输入框。
- 两个按钮增加提示文案：“开始全新对话：不继承当前项目、上下文与执行策略”。
- 点击后 toast：“已开始全新对话：项目、上下文和策略均已重置”。

**实测**：

- 打开 Manual 会话 `C-1794390123456`，底部显示 Manual；
- 点击“新聊天”后回首页，底部变回 `Auto`，项目位显示“项目或文件夹”，输入框为空；
- 页面出现上述 toast；旧会话仍保留在侧栏，可随时重新打开并恢复其 Manual 策略。

### 12. 每轮文件变更摘要

**背景**：DSH 的 `workspace/changes` 包没有挂载到当前 `sdk` profile，SDK 也拿不到 workspace 控制器，所以不能直接读 Harness 的变更事件。

**做法**：

- 在 `/api/chat` 执行前后，对实际工作目录做只读快照：只 `readdir + stat`，不读文件内容；
- 跳过 `.git / node_modules / dist / out / .next / coverage`，最多 4000 个文件、6 层目录；
- 对比 `size + mtime`，产出 `workspaceChanges`：
  - `added / modified / removed`
  - 相对路径、绝对路径、当前大小、修改差值（最多 30 条）
- 写入助手消息 `workspaceChanges`，随会话持久化；回复接口也直接返回。
- 前端用现有 `.steps-block / .step` 样式渲染“本轮文件变更 · N”，默认折叠，不新增 CSS。

**实测**：

- Auto + `PRJ-D1F5D4` 创建 `change-summary-test.md`；
- 接口返回：`{"rel":"change-summary-test.md","change":"added","size":19}`；
- 会话界面显示“本轮文件变更 · 1 / change-summary-test.md / 新增 · 19 B”，截图 `D:\project-test3\shots\v2-workspace-changes.png`。

### 13. 会话导出为 Markdown

**做法**：

- 新增 `GET /api/conversation/export?id=<C-…>`：
  - 校验登录与 `conversationAllowed`；
  - 输出 `text/markdown`，带 `Content-Disposition`；
  - 内容含会话元信息、每轮用户/助手正文、执行步骤、文件变更、交付物；
  - 落审计 `conversation.export`。
- 会话右键菜单新增“导出为 Markdown”，点击后通过 `<a download>` 触发下载。

**实测**：

- `GET /api/conversation/export?id=C-1794395123456` → 200、`text/markdown`、1422 字节；
- 正文含“会话 ID / 执行策略 Auto / 项目 PRJ-D1F5D4 / 第 1 轮 / 执行过程”。

### 14. 会话全文检索

**问题**：搜索面板原先只匹配会话标题，正文里的关键词搜不到。

**做法**：

- `GET /api/conversations?withText=1` 在原有列表上追加 `searchText`（该会话全部消息正文，截断 20000 字符）；
- 只有搜索面板请求时带正文，侧栏常规刷新不增加传输量；
- 搜索面板并行请求该接口，会话分组按“标题 + 正文”匹配；
- 命中正文时右侧标记“正文命中”。

**实测**：

- 搜索“审批摘要可见”（只出现在正文，不在标题）；
- 返回 `C-1794395123456`，界面显示“正文命中”，截图 `D:\project-test3\shots\v2-search-body-hit.png`。

### 15. 后台作业面板 + 停止

**背景**：DSH 的 `dsh-tool-jobs` 已挂载，模型可以用 `job_output / job_list / job_kill`；但 SDK 协议只暴露 `session/*` 方法，`client.request('job/kill')` 会返回 `unknown DeepSeek Harness SDK runtime method: job/kill`，产品端拿不到单作业控制接口。

**做法**：

- 前端把各条消息里的 `jobs` 聚合成一个“后台作业 · N”面板，去重后统一展示；运行中的作业显示“停止”按钮，点击走事件委托，避免重绘丢绑定；
- 新增 `POST /api/conversation/job/kill`：校验会话归属、作业存在且仍在运行；若同项目下还有本进程内真正在跑的会话则 409 `JOB_RUNTIME_BUSY`；
- 停止动作改为“结束该项目沙箱根的 Harness 运行时”（`stopBackgroundRuntime(cwd)`）：SDK 没有单作业 kill，运行时退出会终止其全部后台作业；只关闭匹配当前 `cwd` 的运行时，不动其他项目；
- 成功后把该会话所有运行中作业置为“已停止”，落审计 `conversation.job.kill`；
- 用 `activeRuns` 集合判断“正在执行”，避免历史遗留的 `status=running` 阻塞停止。

**实测**：

- Auto + `PRJ-D1F5D4` 启动 `pwsh-ab8aec8907de40c1`（`Start-Sleep -Seconds 600`）；
- 停止前匹配进程 1 个，调用接口返回 `ok=true`，2 秒后匹配进程 0 个；
- 会话内作业状态落为“已停止”；
- 界面里再启动 `pwsh-58390b1e0de44ec6`（300 秒），面板出现“停止”；点击后 toast“已停止后台作业；该项目运行时已重启”，面板两条均为“已停止”，截图 `D:\project-test3\shots\v2-jobs-panel-stopped.png`。

**边界**：这是项目级运行时停止，不是单作业精确 kill；同项目另有会话正在执行时会拒绝，避免误伤。

### 16. 设置中心（Agent 运行时）

**背景**：现有设置页大量是静态开关与“演示”toast；DSH 的 `settings` / `config-editor` 只在 Host remote 或进程内可用，SDK 协议没有对应方法。本轮不伪造“可改 DSH 原始配置”的能力，先做产品级、可持久化、能真实影响新会话的设置中心。

**做法**：

- `server.mjs` 新增平台级 `runtimeSettings`（默认执行策略、默认推理强度、每轮文件变更摘要），带 `sanitizeRuntimeSettings()` 白名单校验；
- 设置写入现有持久化快照（`snapshotPersistentState()` / `hydratePersistentState()`），重启保留；新增 `POST /api/settings`，仅管理员可写，落审计 `settings.runtime.update`；
- `/api/bootstrap` 返回当前 `settings` 与真实运行时事实 `runtime`（DSH 版本、profile、配置条目数、活跃运行时、会话总数/运行中、profile patch、dump 快照、会话日志路径与时间）；
- `/api/chat` 在未显式传策略/强度时使用设置中心默认值；`workspaceChanges` 关闭时跳过执行前后的目录快照，不再生成变更块；
- 前端设置页新增「集成 › Agent 运行时」页：三个可编辑默认项、只读运行时状态、配置与日志位置、刷新状态；保存后 toast 并立即回写本地状态；
- 「新聊天」按设置中心的默认执行策略与默认推理强度重置，不再写死 Auto/中。

**实测**：

- 页面显示 DSH `0.2.2-rc.1`、profile `sdk`、配置条目 112 条、活跃运行时 0 个、会话 54 个；
- 在设置页把默认执行策略切为 Manual，接口返回 `defaultPolicy=manual`；点「新聊天」后首页策略胶囊显示 **Manual**，证明默认值真实生效；
- 关闭「每轮文件变更摘要」后执行真实项目任务，文件 `settings-toggle-check.md` 确实创建成功，但响应 `workspaceChanges` 为空；恢复开关并删除测试文件；
- 验证后已把默认策略/强度/摘要开关恢复为 Auto / 中 / 开启；截图 `D:\project-test3\shots\v2-settings-runtime.png`。

**边界**：本轮设置中心是平台级运行时默认值与只读运行态，不是 DSH 原生 `settings.yaml` 表单，也不直接编辑 `cordis.patch.yml`。agent loop、shell、subagent、session log 等 DSH 原始配置项仍只读展示；要真正表单化，需要另接 Host remote `ctx.remote.settings` 或进程内 settings 服务，SDK 协议目前不提供。

### 16.1 DSH 原生设置/凭据只读边界

**决定**：产品设置是唯一可写入口；DSH 原生 `settings` / `config-editor` / `authorization` / `credentials` 仅在「Agent 运行时」页做只读运行态展示，不提供编辑表单，不读取凭据内容，也不把模型密钥写进 DSH 原生凭据。这样避免“产品设置 + DSH 原生设置”两套可写源互相覆盖。

**做法**：

- `/api/bootstrap` 的 `runtime.native` 增加 `settings`、`configEditor`、`authorization`、`credentials` 的挂载状态，`credentialsPath` 只返回路径、是否存在和更新时间，不返回内容；`modelKeySource` 固定标注为“产品设置中心 → 子进程环境”。
- 设置中心新增「DSH 原生设置（只读）」组：配置权威、原生 settings、原生 config-editor、原生 authorization、凭据文件、模型密钥来源。
- 不新增可写 API，不在前端暴露 `settings.update` / `settings.mutate` / `.credentials.yaml` 编辑入口。

**实测**：设置页显示 `settings`/`config-editor` 为「按条件」、`authorization`/`credentials` 为「已挂载」，凭据文件存在但内容不展示，模型密钥来源为「产品设置中心 → 子进程环境」；截图 `runtime-native-settings.png`、`runtime-native-settings-2.png`。

**边界**：这是“单写入口 + 只读核对”，不是 DSH 原生设置表单。若后续要让产品直接改写原生 settings，需要单独设计冲突检测、revision/覆盖优先级和密钥托管，不在本轮范围。

### 16.2 PTC 执行器状态

**结论**：`workflow-ptc` 保持启用，直接 `tool-executor-ptc` 保持关闭。产品设置页只读展示两者的挂载状态，并写明关闭原因：直接执行器会把模型工具调用改成 `run_code` 程序协议，嵌套工具调用难以逐步展示和确认；启用前需要单独回归审批、步骤展示和失败恢复。

**实测**：`runtime.native.workflowPtc = 已挂载`、`toolExecutorPtc = 已停用`；设置页「PTC 与实验执行器」显示对应状态，未改动 profile patch。截图 `runtime-ptc-status.png`。

### 16.3 后台作业停止边界

**结论**：产品只能停止“沙箱运行时”，不能停止单个后台作业。DSH 内部 `LocalJobRegistry` 有 `kill(id)`，但 `dsh-sdk-client` 协议没有暴露 job/kill；产品侧能拿到的只有 `job/registered`、`job/settled` 事件和 job id，没有可用控制通道。

**产品处理**：后台作业面板的按钮改为「停止运行时」，并在面板内写明“停止操作会结束该会话所属的沙箱运行时，并同时终止其中的全部后台作业”；服务端仍会先检查同目录其他会话是否在运行，避免误停。

**要做单作业停止，需要**：在 DSH profile 内加一个自定义插件，把 `ctx.jobs.kill(id)` 暴露成产品可调用的本地 remote/HTTP 通道，或者由产品自己维护任务队列。两者都不属于现有 SDK 协议，不能只改前端。

### 16.4 技能目录现状

**事实**：`data/dsh-home/skills` 当前有 7 个目录技能：DSH 预设自带的 `agent-experience`、`cordis-composition-reference`、`cordis-plugin-development`、`editing-cordis-compositions`，本地业务技能 `jg-product`、`market-M-01`、`market-M-03`；Office 仍通过 `skill-office` 插件加载，不重复复制。设置页「技能目录（只读）」直接列出目录技能、Office 插件挂载状态和技能根目录。

**默认技能安装**：源目录 `dsh-runtime/node_modules/@deepseek-ai/dsh-agent-preset/skills`，递归复制到 `data/dsh-home/skills`，未覆盖已有同名目录；`installedSkillPlugins()` 为四个默认技能补中文标签，`/api/plugins` 中文界面可读。重启后接口返回 9 项：4 个默认技能 + 3 个本地目录技能 + Office + MCP。技能描述仍保留英文原文，因为那是技能自身的 `description`，不另行翻译。

**边界**：目录技能和插件技能是两条来源；市场安装会写入 `skills/market-<ID>` 并关闭空闲 Harness，下一轮重新发现；这不是热插拔，正在执行的任务不会被中断。

**界面收口**：`/api/plugins` 只返回本机实际加载的目录技能、`skill-office` 和 `mcp-jg`，不再返回 `data.mjs` 里的 21 条演示插件。插件页按示意图恢复为“左侧已安装、右侧市场”的结构：插件 tab 主区即市场，公开/个人两个视图；技能 tab 只列已安装技能。

### 16.5 检查点现状

**事实**：`session-checkpoint-policy` 已挂载，但它是“语义持久化检查点”——在模型请求、顶层工具调用前记录会话状态，用于恢复会话，不备份文件内容。产品侧 `snapshotTree`/`diffTree` 只记录文件大小和 mtime，不能还原文件。

**边界**：要做“回滚到上一轮文件”，必须在每轮开始前复制被修改文件的内容，并单独设计回滚确认、新增文件删除和冲突处理；这不是现有 checkpoint 策略能直接提供的。设置页新增「会话检查点（只读）」组，明确写“检查点策略已挂载、文件回滚未提供”。

**实测**：`runtime.native.checkpointPolicy = 已挂载`、`fileRollback = 未提供`；技能目录返回 `jg-product`、`market-M-01`、`market-M-03`，`officeSkill = 已挂载`。截图 `runtime-skills-checkpoints-3.png`。

### 17. MCP 资源浏览

**背景**：DSH 已挂载 `dsh-mcp-resources` 与 `dsh-mcp-client`，模型侧具备 `list_mcp_resources` / `list_mcp_resource_templates` / `read_mcp_resource`；但产品侧原来只有静态“MCP 服务地址”和演示连接测试，没有资源目录。产品 MCP 桥 `mcp-jg.mjs` 原来只声明 `tools`，没有 `resources`。

**做法**：

- `mcp-jg.mjs` 初始化能力增加 `resources: {}`，实现 `resources/list`、`resources/templates/list`、`resources/read`，通过带令牌的 `/api/mcp/resources` 与 `/api/mcp/resource` 读取目录；
- `server.mjs` 新增 `mcpRequestUser()`（MCP 令牌或登录会话二选一）、`mcpCatalog()` 与 `readMcpResource()`；资源目录合并数据中心可见资源、通知公告和当前身份可见项目下的文本文件，统一 `jg://resource|notice|project/...` 寻址；
- 项目文件读取做项目归属校验、`pathInside` 校验和扩展白名单，只允许 `.md/.txt/.json/.csv/.log/.yml/.yaml/.mjs/.js/.ps1/.sql/.html/.css`，单文件超出 200000 字符截断；
- 设置页新增「集成 › MCP 资源」：服务状态（stdio、已连接、工具/资源计数、订阅未启用）、关键词过滤、刷新、逐条读取弹窗。

**实测**：

- `/api/mcp/resources` 返回 `server=jg`、`transport=stdio`、`resources=8`，资源为 `PRJ-D1F5D4` 项目下的 markdown 文件；
- `GET /api/mcp/resource?uri=jg://project/PRJ-D1F5D4/change-summary-test.md` 返回 `text/markdown`，正文 `变更摘要验证`；
- 页面列表显示 8 条资源，点「读取」弹出正文；截图 `D:\project-test3\shots\v2-mcp-resources.png`；
- 真实模型会话调用 `list_mcp_resources(server="jg")`，回复列出前 3 个资源名称与 URI，证明 DSH 模型侧资源工具已可用。

**边界**：当前只做列表与读取，不实现资源变更订阅（服务声明 `listChanged=false`）；目录内容是产品数据资源/项目文件，不是任意第三方 MCP 服务器的统一管理器。多 MCP server 配置与启停仍属后续“MCP 配置/插件运行时管理”。

### 18. 子代理会话正文

**背景**：`subagent` / `subagent_fork` 工具已在 DSH 挂载；SDK 有 `subagent.started` / `subagent.finished` 通知，`finished` 带 `provider`、`status`、`stopReason` 与 `lastAssistantMessage`。原来产品只把子代理显示成执行步骤中的一行状态，看不到子代理最终正文。

**做法**：

- `harness.mjs` 新增 `blocksText()` 读取 ContentBlock 数组正文，`subagentsOf()` 产出子代理数组（childSessionId、provider、status、stopReason、output）；
- SDK 的 `session.run()` 在父会话 `idle` 时就返回，子代理可能仍在跑；`runAgent` 另外订阅 `subagent.started/finished`，只保留根会话及其后代的通知，并在父轮结束后最多等待 45 秒补齐 `subagent.finished` 的正文，避免把同一运行时其他会话的子代理算进来；
- `/api/chat` 把 `subagents` 写入助手消息与响应；会话导出 Markdown 增加「子代理」小节；
- 前端 `subagentBlock()` 在助手消息中显示「子代理 · N」块：提供者、状态、停止原因、子会话 ID 和最终正文，正文 `pre-wrap` 展示。

**实测**：

- 真实项目会话调用 `subagent`，接口返回 `subagents=[{provider:"spawn",status:"ok",stopReason:"completed",output:"子代理正文测试"}]`；
- 会话页出现「子代理 · 1」，展开后显示 `spawn 完成 · completed · 442207b6-…` 与正文「子代理正文测试」；截图 `D:\project-test3\shots\v2-subagent-body.png`。

**边界**：这是子代理最终正文与运行摘要，不是可逐条回放的子代理完整多轮 transcript；完整子会话日志读取仍需单独的会话日志接口。等待上限 45 秒，超时未结束的子代理会显示「进行中 / 未返回正文」，不会阻塞父会话超过上限。

### 19. 工作流阶段/节点展示

**背景**：`workflow` 工具（`@deepseek-ai/dsh-tool-workflow`）在 profile 中挂载，支持 `meta.phases` 与子代理扇出；DSH 会向父会话写四条持久事件：`tool-workflow/run-start`、`agent-start`（runId/seq/label/phase/childId）、`agent-end`（outcome）、`run-end`（stopReason）。原来只有 `workflow` 工具的一行执行步骤，用户看不到阶段、节点与每个节点的子会话。

**做法**：

- `harness.mjs` 的 `workflowsOf(events)` 按 `runId` 还原运行名称、状态、stopReason 与成员节点；`agent-end` 以 `runId+seq` 回填每个节点的完成/失败/取消状态；
- `runAgent` 返回 `workflows`；`/api/chat` 写入助手消息并随响应返回；会话导出 Markdown 增加「工作流」小节（阶段、节点、状态）；
- 前端 `workflowBlock(workflows)` 在助手消息中显示「工作流 · 名称 · 完成/总数 节点」，展开后按 phase 分组：阶段行显示节点数量，节点行显示名称、状态和 childId；样式复用现有 `.steps-block` / `.step` / `.step-dot` / `.step-tool` / `.step-detail`，未新增 `styles.css` 规则。

**实测**：

- 真实 workflow 调用返回 `workflows={runId:"947ea35a-…",name:"工作流验证",status:"completed",members:[{phase:"准备",label:"准备节点",childId:"e28adafb-…",status:"completed"},{phase:"执行",label:"执行节点",childId:"9d3d6b85-…",status:"completed"}]}`；
- 会话页「工作流 · 工作流验证 · 2/2 节点」按「准备 → 执行」两阶段展开，两个节点均显示完成和各自子会话 ID；截图 `D:\project-test3\shots\v2-workflow-phases.png`。

**边界**：只展示持久记录中的 run/agent 生命周期，不包含 `workflow/phase` / `workflow/log` 的实时逐行输出；后台工作流的阶段进度走任务面板，不在本块重复展示。

### 20. Auto 工具级逐次审批

**背景**：S4 原实现只在提交文本上做高风险前置判定，模型在 Auto 下自主生成的高风险工具调用仍可执行。直接在 `harness` 层对 `tool/call` 调用 `harness.close()` 会打断当前 HTTP 请求，已废弃。

**做法**：

- Harness 原生权限统一用 `read-only` 启动；Auto 不再直接使用 `workspace-write`，因此写文件、执行命令等升级动作都会产生一次 `approval/request`；
- 服务端 `autoApprovalAllowed()` 作为逐次审批矩阵：命令字段命中高危删除/格式化关键字、目标路径不在项目授权目录、命令含授权目录外绝对路径时，落回人工审批；只读、目录内普通写入/编辑、任务/子代理/工作流等低风险调用返回 `allowed-once` 自动放行；
- Manual 仍全部落审批；Auto 的人工审批卡复用原有 pending 交互，同一轮内等待用户允许/拒绝，超时/取消沿用原有恢复路径；
- 判断只检查 `command`/`cmd`/`script` 字段，不扫描普通文件正文，避免文档里写有 `Remove-Item` 字样就被误判。

**实测**：

- Auto 下创建 `autoguard-ok.md`：无需人工审批，接口直接返回成功，文件存在，`pending=null`；
- Auto 下 `pwsh Remove-Item autoguard-ok.md`：不命中提交文本规则，但工具级审批拦截生成 `AP-08b3c551c1be`，审批卡显示目标文件、命令与升级原因；允许一次后文件被删除；
- 说明：本轮验证走 API + 会话页面待审批接口，工具级审批卡的视觉沿用已验证的 Manual 审批卡。

**边界**：这是产品侧审批矩阵，不是 DSH 权限预设的完整复刻；`danger-full-access` 第三档仍不进入产品 UI。规则是保守白名单/黑名单混合，不能替代操作系统级隔离。

### 21. Agent 预设

**背景**：DSH 的 `agent-preset` 是 Cordis 插件组合，当前 profile 未挂载 `agent-preset-registry`，也没有 SDK 方法可直接选择预设计划。先做产品级 Agent 预设：保存行为要求与默认执行参数，在会话中真实注入并影响执行。

**做法**：

- 平台快照新增 `agentPresets`，字段为 id/name/description/instructions/defaultPolicy/defaultEffort，随持久化快照保留；
- `GET/POST/DELETE /api/agent-presets`，仅管理员可写，写入审计；`/api/bootstrap` 返回预设列表；
- `/api/chat` 接受 `presetId`：新会话把预设策略/强度作为默认值，并把预设 `instructions` 作为独立上下文段注入；会话保存 `agentPresetId/agentPresetName`，后续轮次沿用；
- 前端「设置 › Agent 运行时 › Agent 预设」支持新建、编辑、删除；输入框「＋ → Agent 预设」单选应用，选中后同时切换当前会话策略与推理强度；「新聊天」会清空预设，保持每次全新开始。

**实测**：

- 创建预设「严谨审阅」（Manual / 高，要求先指出材料缺失与矛盾再给结论）；
- 新会话 `C-1794406123456` 带 `presetId` 请求后，模型回答「我现在遵循的预设名称是『严谨审阅』」，会话存储 `agentPresetId=APRESET-…`、`executionPolicy=manual`、`reasoningEffort=high`；
- 设置页显示预设卡片与编辑/删除按钮；输入框加号菜单出现「Agent 预设 1 个 ›」，展开显示「不使用预设 / 严谨审阅」；截图 `v2-agent-presets.png`、`v2-agent-preset-picker.png`。

**边界**：这是产品级预设，不是 DSH `agent-preset` 的插件组合语义；它不能替换/挂载 DSH 插件清单，只是行为要求与默认参数。历史会话保存创建时的预设 ID，不随后续编辑热更新。

---

### 22. 插件运行时启停与安装管理

**背景**：DSH 自带 `dsh-plugin-manager`，但它的 `pluginManager/listPlugins`、`setPluginEnabled` 只挂在 typert Remote 上，不在 SDK JSON-RPC 方法表内；`client.request('pluginManager/...')` 会直接返回 `unknown ... runtime method`。官方 Web/Desktop 插件页不在本项目范围内，所以不能直接复用。

**做法**：

- 插件清单以 `dsh --profile sdk --dump-config` 为准：服务启动时、每次打开「DSH 插件运行时」时都重新生成 `data\dsh-dump-config.txt`，再解析当前 profile 的真实条目（id、模块名、`disabled` 状态）；随后合并 `cordis.patch.yml` 最后一层 `disabled` 覆盖，让界面显示“重启后将要生效”的状态。旧实现只读首次生成的快照，会停在旧配置；现已修正为按当前 profile 即时生成，页面来源标注同步改为「按当前 profile 即时生成」。
- 启停写入 `data\dsh-home\profiles\sdk\cordis.patch.yml` 的 `- id: … / disabled: true|false` 覆盖项，遵循 DSH 的 patch 组合语义；重启后由 DSH 重新组合生效。
- 核心条目白名单保护（`plugin-manager`、`tool-plugin-manager`、`llm`、`session`、`agent`、`sandbox`、`typert*`、`session-log-deepseek`、`mcp-jg`），产品界面不允许停用，避免把运行时或 MCP 桥自己关掉。
- `POST /api/runtime/restart` 调用 `closeHarness()` 关闭所有活跃 SDK 运行时；下一次会话按新 profile 重新启动，DSH 会话历史仍在。
- 组合包管理：读取 profile `package.json` 的 `dsh.profile.bundles`，可写入启用/停用；安装通过 `dsh plugin --profile sdk add <spec>` 执行，但需要 pnpm。
- 设置中心「Agent 运行时」新增「DSH 插件运行时」组：`管理` 打开弹窗，支持搜索、逐条启停、重启运行时；核心条目按钮禁用。

**实测**：

- `/api/runtime/plugins` 返回 `112` 个条目、`11` 个核心保护项；4 个默认停用条目可见（`hmr`、`session-title-llm`、`fs-observation-policy`、`tool-executor-ptc`）。
- 重启后 `dsh-dump-config.txt` 的生成时间更新为当前时间，快照内可看到 `mcp-jg` 的 `toolCallTimeoutMs: 600000`；接口来源返回「按当前 profile 即时生成」，条目数仍为 `112`。
- `session-title-llm` 停用 → 启用两次写入均成功，响应 `restartRequired=true`；patch 最后一层覆盖分别为 `disabled: true` / `disabled: false`，测试后已恢复为启用。
- `hmr` 启用 → 停用两次写入均成功，响应 `restartRequired=true`；测试后已把 `cordis.patch.yml` 恢复到测试前原文。
- 在弹窗中点击 `hmr` 的「启用」，patch 新增 `- id: hmr / disabled: false`，验证 UI → API → 文件链路；测试后同样已清理该覆盖项。
- 停用核心 `llm` 返回 400「该条目是运行时核心组件，不允许从产品界面启停」。
- `POST /api/runtime/restart` 返回「运行时进程已关闭；下一个会话将按新配置启动」。
- 弹窗显示 112 行、搜索框、已启用/已停用/按条件状态、核心标签与禁用按钮；截图 `v2-runtime-plugins.png`、`v2-runtime-plugins-entry.png`，本轮即时生成快照后的弹窗见 `D:\project-test3\shots\runtime-plugins-refreshed.png`。

**边界**：这不是 DSH 官方 plugin-manager 的完整复刻：没有 live fiber 阶段、没有 pnpm 包操作日志、没有组合包详情/版本列表/脚本批准；安装接口在 pnpm 缺失时返回 `501`，当前环境未安装 pnpm。写入 patch 后必须重启运行时才生效，不能热加载（HMR 在 profile 中默认关闭）。

---

### 23. 自动 / 对话 / 工作三模式统一入口

**背景**：产品原来用“是否绑定项目”隐式决定对话 / 工作，输入框没有任务模式选择，审批胶囊在输入框下方的快捷行。按统一工作空间方案，默认自动判断，对话只做问答，工作执行文件/代码/多步骤任务；三种模式共用同一会话、历史、附件与项目上下文，不新增独立页面。

**做法**：

- 前端 `state.taskMode` 默认 `auto`；首页与会话页输入框快捷行右侧、推理强度之后新增「自动 / 对话 / 工作」胶囊，点开是三项单选菜单，标题分别说明“智能判断 / 只对话 / 文件、代码、多步骤”；「新聊天」重置为自动，打开历史会话恢复该会话保存的模式。
- 按参考图把执行审批胶囊移入输入框内部、紧挨“＋”的右侧，改为无边框浅灰胶囊（Codex 风格）；快捷行只保留项目、推理强度与任务模式。点击审批胶囊打开两项菜单，用词参考 Codex：「请求批准」——编辑外部文件和使用互联网时始终询问；「帮我批准」——仅对检测到的风险操作请求批准。用户选择后才写入策略，不再直接切换。全部复用 `.quick` / `.plus-pop` / `.pp-row` 等现有样式，`styles.css` 未新增规则。
- 界面文案统一中文化：任务模式为「自动 / 对话 / 工作」，审批为「请求批准 / 帮我批准」；设置中心的默认执行策略与 Agent 预设同步改用上述中文词，模型上下文也改为“当前审批方式 / 当前任务模式”。
- `/api/chat` 接受 `mode` 并在服务端权威解析：手动「对话 / 工作」直接覆盖；「自动」用规则路由 `WORK_INTENT_PATTERNS` 判断，命中创建/修改文件、运行命令、数据清洗、多步骤/工作流、代码块或 `npm/pnpm/node/python/git/pwsh` 等意图时升级为工作，否则保持对话。规则优先，不增加普通问答的模型分类延迟。
- 会话保存 `taskMode`、`resolvedMode`、`modeReason`；响应一并返回。上下文注入明确本轮模式：对话模式要求优先直接回答、不主动改文件或跑命令，确需执行时提示切到工作模式；工作模式允许调用文件、命令、代码与技能工具；自动模式说明本轮判定结果与原因。
- 工作模式未绑定项目时不再崩溃：有项目用项目 `cwd`，无项目用会话托管目录；对话与工作共用同一 `dshSessionId` 与消息历史。对话模式下出现权限升级审批时统一返回 `rejected`，由模型明确提示“请切换到工作模式”，避免写文件或跑命令；自动 / 工作继续走原有 `autoApprovalAllowed()` 审批矩阵。
- 手动模式暂存于前端并在下一轮 `/api/chat` 落库，不新增单独的模式切换接口；刷新后从会话记录恢复。
- 启动加载 `/api/bootstrap` 时把设置中心的默认审批策略同步到首页审批胶囊，避免刷新后仍显示上一个会话的值。

**实测**：

- Auto + `只回复 OK`（无项目）→ `resolvedMode=chat`、`modeReason=未检测到文件、命令或多步骤执行意图`，直接回复 `OK`。
- Auto + `请创建文件 router-test.md，内容为 router ok`（项目 `PRJ-D1F5D4`）→ `resolvedMode=work`、原因“检测到文件、命令或数据处理意图，已绑定项目”，工具步骤 `write`，文件实际生成。
- 手动「对话」+ 同一写文件请求 → `resolvedMode=chat`，文件未生成，模型直接回复“当前处于对话模式，不会创建文件”，并提示切换到工作模式；未再发起写入工具或审批请求。测试会话已删除。
- 首页模式菜单三项均可见，手动切到「工作」后胶囊文字即时变为「工作」；审批胶囊位于输入框内“＋”右侧，点击后弹出「请求批准 / 帮我批准」两项菜单，选中「请求批准」后胶囊与提示同步更新。截图 `D:\project-test3\shots\v3-approval-menu-cn.png`、`v3-approval-request-cn.png`、`v3-task-mode-cn.png`。
- 设置中心默认执行策略改为「请求批准」并保存，接口返回 `defaultPolicy=manual`；刷新页面后首页审批胶囊显示「请求批准」，证明默认值生效。随后恢复为「帮我批准」，刷新后同步恢复。

**边界**：本轮只落地第一阶段（Auto Task Router + 手动模式选择 + 统一会话）。Auto 是规则路由，不引入模型辅助分类，也不做执行中的动态切换；持久化任务队列、后台长任务恢复、企业身份/业务权限/执行环境隔离属于后续阶段。Work 无项目时成果落在会话托管目录，不自动要求绑定项目。

---

## 二、P0 清单状态

| 编号 | 项目 | 状态 | 说明 |
|---|---|---|---|
| S1 | 策略信任客户端 | 已落地 | 服务端按会话存储为准；新增 policy 接口 |
| S2 | 项目/会话 API 不校验归属 | 已落地 | 项目执行、会话读/改/删/审批全接入 |
| S3 | 设备绑定未校验 | 已落地 | 设备不一致 409，已用模拟设备验证 |
| S4 | Auto 目录内高风险不强制审批 | 已落地 | 文本前置 403 + 工具级逐次审批（低风险自动放行，高风险落人工） |
| S5 | 审批卡无参数、审计未落库 | 已落地 | 参数/资源/摘要 + 审计 |
| S6 | 项目交付物打不开 | 已落地 | 项目 cwd 加入白名单，realpath 校验 |
| S7 | 执行中切换策略只对下一轮 | 已落地 | 运行中 409，前端提示从下一轮生效 |
| S8 | 项目默认记忆是占位 | 部分落地 | 项目指令已可用；默认记忆仍占位 |

---

## 三、仍未开始（按盘点文档原顺序）

### 23. token 用量、AI 会话标题与语音输入

**token 用量**：`assistant/message` 事件带有 provider 上报的 `usage`（`inputTokens`、`outputTokens`、`totalTokens`、缓存与推理 token）。`harness.mjs` 新增 `usageOf()` 累加整轮所有 step，`/api/chat` 返回并写入会话消息；前端在消息时间行显示总 token，悬停可看到「输入 / 输出 / 缓存读 / 推理」明细。实测一次回复 `inputTokens=1826`、`outputTokens=2`、`totalTokens=9892`，侧栏与消息尾部均能显示。

**AI 会话标题**：启用 profile 中默认停用的 `session-title-llm`（`@deepseek-ai/dsh-session-title-first-prompt-llm`），由 DSH 在首条用户消息后异步生成标题，不阻塞主请求。`harness.mjs` 新增 `titleOf()` 读取 `session/title` 事件，`/api/chat` 回写会话标题，前端同步侧栏。实测标题从原始首句变为 `Reply OK only request`，证明插件真实生效。边界：模型可能输出英文标题；标题生成只对全新会话首条消息运行，不会对后续追问重算。服务端会拒绝包含「当前用户 / 管理员 / 项目上下文」等上下文片段或明显异常的标题，保留原首句标题。

**消息反馈**：助手消息底部增加「✓ 有帮助 / × 需改进」两个文本按钮，复用 `.btn.sm.subtle`，不新增 CSS。点击写入 `POST /api/conversation/feedback`，按消息索引保存 `feedback=up|down|null`，同一按钮再点即撤销；`POST` 路由沿用服务端统一持久化，重启后仍在。实测点击「需改进」后接口与回读均为 `down`。

**语音输入**：首页与会话页麦克风接 `SpeechRecognition` / `webkitSpeechRecognition`，中文 `zh-CN`，实时把识别结果写入 `#draft`；未授权、无语音、浏览器不支持、启动失败均给出明确提示，不做假成功。边界：识别依赖 Chromium 语音服务、系统麦克风权限与网络，当前只验证了按钮与失败路径，未在真机验证识别文本质量。

**apply_patch**：`dsh-tool-fs` 的 `applyPatch` 默认关闭；在 profile patch 增加 `- id: tool-fs / config: applyPatch: true`，无需改包或安装 pnpm 包。重启后模型可见 `apply_patch`。实测在 `traffic-counter` 项目中创建 `apply-test.md`，步骤记录为 `apply_patch`，文件正文为 `apply patch ok`，测试文件已删除。

**持久终端（试验未通过）**：`dsh-terminal` + `dsh-terminal-bash` + `dsh-tool-terminal` 可以插入 profile 并成功挂载，模型能看到 `terminal_open / terminal_list`。但当前 Windows 环境无可用 PTY 后端：默认 `bash` 方言打开即 `PTY shell exited during startup`，切到 `pwsh` 方言后报 `PTY shell did not reach readiness before startup timeout`。为避免在产品里暴露一组必然失败的工具，已将终端三件套从 profile patch 回滚，仅保留 `apply_patch`。

**Office 技能**：`dsh-skill-office` 已在运行时包里，但 profile 中默认被 `DSH_PRIMARY_RUNTIME / DSH_BUNDLED_OFFICE_CLI` 环境条件禁用。经核对，技能包自带 `assets/` 与 `libreoffice-kit` CLI，不必依赖外部 Office 安装；在 profile patch 中直接 `disabled: false` 并配置 `assetRoot` 指向包内 `assets`、`cli` 指向 `libreoffice-kit/lib/cli.js`。实测模型加载 `office-docx` 技能后调用 `load_workspace_dependencies` 返回的 Python，创建 `office-skill-test.docx`，解包校验 `word/document.xml` 包含正文「Office skill ok」，文件 36588 字节；测试文件与会话已清理。

---
### P1 已完成（本轮）

- 每轮文件变更摘要
- 会话全文检索
- 会话导出为 Markdown
- 后台作业独立面板 + 停止
- 审批待处理会话恢复
- `/plan` 进入斜杠命令菜单
- 项目级指令
- 设置中心（Agent 运行时默认值与运行态）
- MCP 资源浏览
- 子代理会话正文
- 工作流阶段/节点展示
- Agent 预设（产品级行为要求与默认参数）
- 插件运行时清单与启停（profile patch + 重启生效；核心条目保护）
- 组合包清单与启停；安装入口（需 pnpm）

### P1 仍未开始

- 插件安装的完整包操作体验（pnpm 缺失；无组合包详情、版本列表、构建脚本批准）

### P2 收口（环境阻塞或明确不做）

- 持久终端：三件套可挂载，但当前 Windows 环境无可用 PTY 后端（bash 启动即退出、pwsh 就绪超时），已回滚，不暴露必失败工具。
- PTC：`tool-executor-ptc` 会替代 `tool-executor-native`，模型只看到 `run_code`，会丢失当前产品依赖的工具级步骤归因与 Auto 逐次审批矩阵，因此不默认启用；保留 native executor。
- ACP：属于外部编辑器/客户端的接入协议，不是本产品统一对话入口的必需能力；当前不挂载，避免引入第二套会话与审批面。
- open-in-app：官方 Web/Desktop UI 套装已明确不做；`dsh-host-open-in-app` 依赖 `webServer` 与浏览器信任路由，当前自定义产品服务端未提供该挂载面，因此不落地。

### P2 已落地（本轮）

- 语音输入（Web Speech API，含明确失败路径；识别质量未真机验证）
- AI 会话标题（启用 `session-title-llm`，读取 `session/title` 回写会话）
- token 用量（累加 `assistant/message.usage`，消息尾部展示）
- 消息反馈（助手消息「有帮助 / 需改进」，服务端按消息索引持久化）
- `apply_patch`（profile patch 开启 `tool-fs.applyPatch`，真机创建文件成功）
- Office 技能（挂载 `dsh-skill-office`，配置包内 assets 与 LibreOffice Kit CLI，真机生成并校验 docx）

### 明确不做

- 官方 Web / Desktop UI 套装（`dsh-web-app`、`dsh-host-webserver`、`dsh-host-frontend-static`、`dsh-client-ui-*`）。

---

## 四、本轮改动文件

| 文件 | 改动 |
|---|---|
| `harness.mjs` | 订阅 `session.event` 缓存 `tool/call`；审批请求补齐 `toolArgs`；会话结束清理缓存；`stopBackgroundRuntime(cwd)` 按沙箱根关闭运行时以终止后台作业 |
| `server.mjs` | `projectVisibleTo` / `projectRunnableBy` / `conversationAllowed` / `approvalDetails` / `pathInside` / `explicitHighRiskRequest`；`/api/chat` 归属与设备校验、策略以服务端为准、执行前后文件快照与变更摘要；`/api/conversation/policy`；列表/详情/移动/删除/审批/回答/取消归属校验；会话正文检索 `withText=1`；`/api/conversation/export`；`POST /api/conversation/job/kill`；`activeRuns` 在执行标记；审批审计；项目 `instructions`；`/api/harness/file` 项目目录白名单 |
| `public/app.js` | 审批卡显示 `summary`；`togglePolicy` 调服务端；`openConversation` 恢复 pending；新建项目增加“项目指令”；`SLASH_COMMANDS` 增加 `/plan`；“新聊天”统一全新重置；`changeBlock` 渲染文件变更；`jobsPanel` 聚合作业并支持停止；会话菜单“导出为 Markdown”；搜索面板按标题+正文匹配 |

未改动：`public/styles.css`、`public/search-fixes.css`、`public/index.html`。三者 SHA256 仍为基线：

- `styles.css`：`B24BB9E1225097DE467E3F21C73EDE75EA5105BE9E09F30FBC6B7A6B831265E8`
- `search-fixes.css`：`D1E0536E37FFEDC773728163711EA88F8BF6D43479DE4418AAB6BEC3FF50E248`
- `index.html`：`8186442B45EF9F6160CDC1237C7B608F2E9A512D7C2E87CCCDC7BD047470EF3C`

---

## 五、复现与验证方式

- 语法检查：`runtime\node.exe --check harness.mjs / server.mjs / public\app.js`，均 exit 0。
- 重启：结束 Electron 主进程、`server.mjs`、`mcp-jg.mjs` 后运行 `.run-admin.cmd`，从 `.run-admin.log` 最后一条 `[jg-hub]` 取端口。
- 登录：`POST /api/login {"role":"admin"}`。
- 审批轮询：`GET /api/chat/pending?conversationId=<C-…>`。
- 归属验证：用 `employee` 登录后读取管理员会话，应 403；读取项目列表应为 0。
- 设备验证：改 `data\device.json` 的 `id` 后请求项目会话，应 409 `PROJECT_DEVICE_MISMATCH`，**验证后必须恢复原文件**。
- 交付物验证：项目内 `ui-summary.md` 走 `/api/harness/file` 应 200；工程源码应 403。
- 文件变更验证：Auto 项目写入后，`/api/chat` 响应应带 `workspaceChanges`，界面出现“本轮文件变更 · N”。
- 全文检索验证：`GET /api/conversations?withText=1` 应带 `searchText`；搜索只存在于正文的关键词应命中。
- 导出验证：`GET /api/conversation/export?id=<C-…>` 应返回 `text/markdown`。
- 后台作业验证：Auto 项目里让模型后台运行 `Start-Sleep`，界面出现“后台作业”面板与“停止”；点停止后接口 200，`pwsh` 进程消失，作业状态变“已停止”。

### 24. 持久化任务执行记录与中断恢复（第三阶段首批）

**背景**：原先一次 `/api/chat` 是同步请求，执行过程只在当前进程内存和会话消息里；进程被关闭后，正在跑的任务没有独立记录，用户无法确认“哪次运行被打断、原指令是什么、产物在哪”。

**实现**：

- 每次真实 AI 运行创建一条 `kind=chat-run` 的任务记录，写入现有任务快照并立即持久化：任务 ID、会话 ID、用户、模式（自动/对话/工作）、项目、原指令、开始时间、进度、步数、成果数、失败原因。
- 运行成功置为「已完成」，记录实际工具步数与本轮文件变更 + 交付物数量；异常置为「失败」并保留原因。
- 启动时 `recoverChatRunTasks()` 扫描快照：上次停在「执行中 / 排队中」的会话任务改为「已中断」，原因写“服务重启导致任务中断，可在原会话继续”，同时把对应会话从 `running` 置为 `failed`，避免界面一直转圈。
- 执行记录弹窗展示这些真实运行；中断或失败记录可点击，回到原会话并回填原指令，**不自动重放**，避免重复写入或命令副作用。
- 任务中心的演示进度只推进旧任务，`chat-run` 记录完全由真实运行收尾；新增 `POST /api/tasks/delete`（仅管理员）用于清理执行记录。

**实测**：

- `只回复 OK` → 生成 `TR-1794456503889-560`，状态「已完成」，进度 100%，步数 1，关联会话 `C-1794456503887`。
- 发起 `请用 pwsh 运行 Start-Sleep -Seconds 120` 后，在运行中强杀客户端并重启 → 记录变为「已中断」，进度 10%，原因“服务重启导致任务中断，可在原会话继续”，原会话状态恢复为失败而非一直运行中。
- 执行记录弹窗显示两条记录（已完成 / 已中断）；点击已中断记录回到原会话，输入框自动填入原指令，未自动发送。截图 `D:\project-test3\shots\v3-task-runs-recovery.png`。
- 验证后已删除测试会话和测试任务记录。

**边界**：本批完成的是“持久化执行记录 + 中断恢复入口”，仍是同步执行；真正的常驻后台 worker、队列并发/吞吐、进程重启后自动续跑、集团业务系统调用尚未实现。自动续跑会重放副作用，后续需先做幂等键与断点快照再开放。

### 25. 插件市场真实挂载（技能包闭环）

**背景**：此前市场安装只写 `livePluginInstalls` 内存标记，模型看不到任何新能力；上传 ZIP 只做检测与审核，不生成可加载产物。审计已把“插件市场名不副实”列为 P1 风险。

**实现**：

- 市场内置 5 个真实技能包：`M-01` 规范条文核查、`M-02` 用地指标测算、`M-03` 公文格式校对、`M-07` 会议纪要整理、`M-08` 合同条款比对，源文件在 `marketplace/skills/<ID>/SKILL.md`。
- `POST /api/plugin-market/install` 改为真实安装/卸载：复制到 `$DSH_HOME/skills/market-<ID>`，写入 `.jg-market.json` 标记；卸载只删除带标记的目录，不误删手工技能。
- 安装/卸载后调用 `closeHarness()` 关闭空闲运行时；有 `activeRuns` 时返回 409，避免打断正在执行的任务。下一轮对话重新发现技能。
- `GET /api/plugin-market` 的 `installed` 由技能目录与市场清单实时计算，不再读内存 Map；没有提供技能包的条目返回 `available: false`，前端显示“待上架”。
- 上传链路支持技能包：`plugin-scan.mjs` 识别根目录 `SKILL.md`，校验 frontmatter `name`/`description`、禁止可执行文件/外部地址/路径越界；审核通过后解压到 `data/market-packages/<PLG-ID>`，加入市场并可安装。
- 上传说明与《插件开发规范》同步改为“技能包优先，DSH Bundle 仍可检测但当前不开放一键安装”。

**实测**：

- 市场返回 5 个内置条目，均 `available: true`；安装 M-01 后 `data/dsh-home/skills/market-M-01/SKILL.md` 存在，模型在新会话的技能清单中出现 `code-compliance-check`。
- 点击 M-07 安装，侧栏立即出现；打开详情点卸载，目录消失，M-07 回到未安装。
- 上传测试包 `market-smoke-test.zip` → 检测“技能包格式/元信息/权限/静态扫描”四项通过 → 管理员审核 → `data/market-packages/PLG-01/SKILL.md` → 安装 → `market-PLG-01` 出现，闭环通过；测试数据已清理。
- 截图 `D:\project-test3\shots\plugin-market-final.png`。

**边界**：

- 安装是**本机运行时全局挂载**，不是按账号隔离；同一客户端所有账号可见。
- DSH Bundle 未一键安装：当前环境无 pnpm，`dsh plugin add` 不可用；Bundle 审核后只登记上架。
- 技能只提供提示词与参考文件，不执行自定义 JS；需要真实系统调用时走产品 MCP 工具。

### 25.1 市场页按示意图重做与社区提交闭环

**背景**：此前把“市场”误做成第三个侧栏 tab，并且单独做了“社区提交 / 官方与内置”分组页，与用户提供的 ChatGPT 风格示意图不符。示意图的结构是：左侧为已安装页，右侧主区为市场页；市场页标题「插件」，右上搜索、刷新、添加；`公开 / 个人` 切换；内容按「热门」「新品推荐」「小型企业（本项目为「企业内部」）」分组，两列卡片，卡片右侧 `+` 或 `...`。

**前端收口**：
- 删除第三个「市场」导航，`state.skillTab` 只保留 `plugin` / `skill`；插件 tab 主区就是市场页，左侧「已安装」列本机真实安装的插件（当前 Office、MCP）。
- 市场卡片改为示意图样式：图标 + 名称 + 描述 + 右侧操作；已安装显示 `...` 打开详情，未安装显示 `+` 安装；不再把“官方/社区”标签和版本号堆在卡片标题行。
- `公开` 显示 `热门` / `新品推荐` / `企业内部`；`个人` 显示「我的插件提交」和「已安装」。提交记录状态为待审核 / 已上架 / 已退回。
- 搜索框按 Enter 过滤名称、描述与发布单位；刷新重新拉取；「添加」打开提交弹窗。为贴合示意图，添加按钮使用内联黑色样式，未修改 `styles.css` / `search-fixes.css`。

**后端收口**：
- `GET /api/plugin-subs` 支持 `?mine=1`，普通用户只看自己的提交；管理员默认返回全部，审核页能看到所有人的待审记录。
- `marketSkillState()` 增加 `origin`（`community` / `builtin`）、`submittedBy`、`submittedUnit`、`downloadUrl`。
- 新增 `GET /api/plugin-market/download?id=<marketId>`，只允许已审核通过的社区插件下载原始 ZIP。
- 提交 id 改为时间戳 `SUB-${Date.now().toString(36).toUpperCase()}`，避免过滤与持久化后序号冲突。
- 审核通过后技能包解压到 `data/market-packages/<marketId>`，并以 `section: 企业内部` 写入 `liveMarket`；随后走原有安装链路复制到 `skills/market-<id>`。

**实测（本轮闭环）**：
- 生成测试技能包 `market-demo-skill`，`POST /api/files/upload?kind=plugin` 返回 `PKG-MWD7XG4J-F62842B2`，sha256 `6799951e...09e201`。
- `POST /api/plugin-subs` 返回 `SUB-MWD7XLCH`，状态 `pending`，五项检测四项通过、隔离测试未执行（技能包不执行代码）。
- 管理员 `POST /api/plugin-subs/review` 通过，返回 `packageReady=true`；`/api/plugin-market` 新增 `PLG-MWD7XLCH`，`section=企业内部`，`downloadUrl=/api/plugin-market/download?id=PLG-MWD7XLCH`。
- `GET /api/plugin-market/download` 返回 349 字节 ZIP；`POST /api/plugin-market/install` 返回 `installed=true`，`data/dsh-home/skills/market-PLG-MWD7XLCH/SKILL.md` 存在；卸载后目录删除。
- 验证完成后已清理测试提交、市场条目、上传文件、解压目录和临时 ZIP；当前 `/api/plugin-subs` 返回 0 条，市场只保留 5 个内置包。

**边界**：仍不提供“他人提交后自动推送”；其他用户需要刷新市场才能看到新上架条目。审核入口仍在「管理中心 · AI 能力管理 · 插件审核」，市场页不重复放管理员审核按钮。

### 26. MCP 写操作人工审批与遥测默认关闭

**背景**：审计把“MCP 外部副作用绕过审批”和“遥测默认外发”列为两个 P0。第一次实测 `mcp__jg__task_create` 仍然直接创建待办，证明漏点不在 `autoApprovalAllowed()`，而在 DSH 的 MCP 桥没有把 MCP 工具送进 `approval/request`。

**实现**：

- `server.mjs` 的 `autoApprovalAllowed()` 增加 `AUTO_APPROVAL_EXTERNAL_TOOL` 与 `isExternalSideEffectTool()`，外部副作用工具一律不自动放行；`approvalDetails()` 增加 `externalSideEffect` 标记与 `text/message/title` 摘要。
- 新增 `POST /api/mcp/approval`：只接受本机 MCP token，按 `JG_MCP_ACCOUNT` 找到用户，再定位当前唯一活动会话；生成 `approval` 待处理项并等待 `/api/chat/approval`。没有活动会话或多个活动会话时 fail closed。
- `mcp-jg.mjs` 在 `im_send`、`task_create` 执行前先请求审批；`data/dsh-home/profiles/sdk/cordis.patch.yml` 把 `mcp-jg` 的 `toolCallTimeoutMs` 调到 600000，避免审批等待被 60 秒默认超时截断。
- 审批 UI 从消息区的确认卡收敛到输入框内「＋」右侧的「请求批准」胶囊；点击胶囊才弹出菜单，菜单用中文展示工具用途（如“创建待办”）与摘要，选项为「允许本次执行 / 拒绝本次执行」，不再直接放行。
- `harness.mjs` 在 env 未显式指定时注入 `DSH_TELEMETRY_DISABLED=1` 与 `DSH_TELEMETRY_MODE=DISABLED`，企业默认不外发遥测。

**实测**：

- 修复前：真实 `/api/chat` 调用 `mcp__jg__task_create`，直接创建 `T-AI43100`，无 pending 审批。
- 修复后：同一提示词触发 `AP-67ab41b7f614`，胶囊显示“请求批准”；点击「允许本次执行」后待办 `T-AI09367` 创建成功。
- 拒绝路径：`AP-ceeb196cc6dd` 拒绝后模型收到“用户未批准该 MCP 外部副作用操作”，没有产生新待办；已有待办数量保持 2 条。
- 超时边界：审批卡出现后等待 65 秒再批准，`mcp__jg__task_create` 仍成功返回，证明 `toolCallTimeoutMs: 600000` 已生效，审批等待不会被 MCP 客户端 60 秒默认超时截断。
- UI 实测截图 `D:\project-test3\shots\mcp-approval-menu.png`、`mcp-approval-approved.png`。
- 遥测：`dsh-session-telemetry-otel` 的 `DISABLED` 分支不构造 provider；运行态核对 `dsh-otel-collector.deepseeksvc.com` 的 `116.205.40.113/114` 无已建立连接。

**边界**：

- 审批归属依赖“当前唯一活动会话”。同一账号并发多个会话时，MCP 写操作会 fail closed，不会把审批卡投到错误会话。
- 目前只覆盖 `im_send`、`task_create` 两个 MCP 写工具；新增 MCP 写工具必须同步加入 `mcp-jg.mjs` 的 `EXTERNAL_WRITE_TOOLS` 与 `server.mjs` 的 `AUTO_APPROVAL_EXTERNAL_TOOL`。
- 遥测是“默认关闭”，不是强制关闭；如管理员显式改 env 指向内网 OTLP，仍会外发到该端点。
## 26. 插件市场统一入口与 Bundle 一键安装（2026-11-12）

**目标**：所有插件与技能，包括 DSH 默认技能、集团内部技能和客户端内置插件，都通过插件市场统一展示、安装与管理；DSH Bundle 不再因缺少 pnpm 停在“待上架”。

**实现**：

- `server.mjs` 的 `MARKET_BUILTIN` 扩展为 12 条：4 个 DSH 默认技能（`D-01`~`D-04`，官方与内置）、集团内部工具技能（`JG-01`，企业内部）、客户端内置插件（`P-OFFICE`、`P-MCP-JG`，官方与内置），以及原有 `M-01/02/03/07/08`。
- `SKILL_SOURCE_DIR` 把默认技能映射到 `dsh-runtime/node_modules/@deepseek-ai/dsh-agent-preset/skills`，把 `JG-01` 映射到 `marketplace/skills/JG-01`；`SKILL_INSTALL_DIR` 让默认技能安装回原名目录、`JG-01` 安装回 `jg-product`，避免同名技能重复。
- 内置插件条目 `kind='plugin'`，状态为已安装、系统内置、不可单独卸载；详情页显示“系统内置”，不再出现可点击的安装/卸载按钮。
- 内置 pnpm：`runtime/pnpm` 存放 pnpm 11.21.0 与 `pnpm.cmd`；`pnpmAvailable()` 直接用 `runtime/node.exe` 探测 `pnpm.cjs`，`dshPluginEnv()` 注入 `DSH_HOME=data/dsh-home` 与 pnpm PATH，确保 `dsh plugin add/remove` 修改的是产品 profile，而不是用户默认 `~/.dsh`。
- Bundle 安装：审核通过后解压到 `data/bundle-packages/<marketId>`；`POST /api/plugin-market/install` 对 `kind='bundle'` 执行 `dsh plugin add file:<dir>`，随后把包名写入 profile 的 `dsh.profile.bundles`；校验不通过则 `dsh plugin remove` 回滚。卸载时先 `dsh plugin remove`，再从 bundles 列表移除。
- 管理后台新增“插件市场已上架管理”：`GET/POST /api/admin/plugin-market` 支持查看全部条目、上架/下架、编辑名称/描述/分组、删除社区条目；列表显示来源、状态与本机安装状态。
- 管理中心 AI 能力页的“插件 / 技能”指标改为实时统计，不再写死 `12 / 9`；市场条目数、待审核数同源。

**实测**：

- 启动后公开市场返回 12 条，已安装 7 项技能与 2 个内置插件；管理 API 返回 `total=12 / listed=12 / installed=9`。
- 上架/下架 `M-02`：公开市场由 12 变 11，再恢复 12。
- 默认技能 `D-01` 从市场卸载后目录删除，重新安装后目录恢复且写入 `.jg-market.json`。
- 真实 Bundle 测试包：上传 → `SUB-MWD8S7P2` 待审 → 审核通过解压 → 市场可见 → 安装成功，`data/dsh-home/profiles/sdk/node_modules/jg-market-demo-bundle` 存在，profile `bundles` 含 `jg-market-demo-bundle`；`dsh --profile sdk --dump-config` 退出码 0；卸载后依赖与 bundles 条目均移除。
- 测试提交、包文件与市场条目已全部清理；当前 `pluginSubs=0`，市场 12 条，无测试残留。
- 截图：`D:\project-test3\shots\plugin-market-all.png`、`plugin-market-admin.png`。

**边界**：

- `P-OFFICE` / `P-MCP-JG` 随客户端加载，市场只做展示与运维上下架，不提供单独安装/卸载；这是系统内置插件的明确边界。
- 社区 Bundle 安装仍要求包内 `package.json` 声明 `dsh.bundle` 且 patch 文件存在；空 patch 可用于验证安装链路，但不会给运行时增加能力。
- 安装 Bundle 会重建空闲 Harness 运行时；有会话正在执行时接口返回 409，需下一轮再操作。
**补充（2026-11-12 验收前收口）**：技能 tab 的“添加”不再提示“由管理员登记”，与插件 tab 共用同一上传入口，用户可提交技能包或 DSH Bundle；上传弹窗、文案与按钮统一为“插件或技能”。已安装技能列表的说明改为读取市场条目描述，默认技能不再展示英文 frontmatter 原文。
## 27. 会话级停止、执行队列与原生会话检索（2026-11-12）

**目标**：先补长任务执行闭环，再把 DSH 会话检索与设置/凭据事实接入设置中心。

**实现**：

- 每个会话在运行时缓存键中追加 `runtimeScope`（会话 id），Chat 与 Work 都按会话独占运行时；Work 多个会话即使共享同一项目目录，也不会互相停掉运行时。
- `harness.mjs` 新增 `cancelRun(runKey)`：先尝试 DSH 原生 `session/cancel`；当前 SDK 运行时未暴露该方法时，退化为关闭该会话独占运行时。按 `runKey` 定位，不再按 cwd 批量匹配。
- `/api/chat/cancel` 重写：排队中的任务直接标记 `cancelled`；执行中的任务走 `cancelRun`；返回 `native` 与 `runtimeClosed`，并在会话里记录停止步骤，不再笼统关闭整个 Harness。
- `chat-run` 任务先进入 `queued`，由进程内调度器限制并发（`JG_MAX_CHAT_RUNS`，默认 2）；真正开始模型轮次时切到 `running` 并写入执行的 DSH 会话 id；取消、完成、失败分别落 `cancelled / done / failed`。
- 运行时池满时只回收空闲条目；会话进入 `runAgent` 即占位 `entry.runs`，避免初始化期间被误判为空闲而关闭。
- 任务记录继续持久化；服务重启时 `queued / running` 统一标为 `interrupted`，保留原会话与指令，不自动重放副作用。
- 启用 DSH 原生会话检索：服务启动时确保 profile patch 挂载 `dsh-tool-session-query` 与 `dsh-session-query-sqlite`，模型可检索/读取当前工作区的历史会话；设置中心新增“原生会话检索”和“会话导出”只读事实。

**实测**：

- 运行 `Start-Sleep -Seconds 12` 的长任务，6 秒后停止：返回 `runtimeClosed=true`，任务从 `running/20` 变为 `cancelled`，会话状态为 `done`。
- 同一时刻另开一个会话只回复 `ok`：被取消会话关闭运行时后，另一会话正常完成并返回 `ok`，证明取消不波及其他会话。
- 同一 Work 项目（`PRJ-D1F5D4`）下并发两个会话：一个执行长任务、一个短回复；取消长任务后短回复仍完成，任务分别落 `cancelled` 与 `done`，证明项目共享目录不再导致取消互相影响。
- `dsh --profile sdk --dump-config` 在挂载会话检索后退出码 0，dump 中可见 `optional-session-search`、`optional-session-query-sqlite`、`optional-tool-session-query`。
- `GET /api/bootstrap` 返回 `runtime.native.sessionSearch=已挂载`。

**边界**：

- 当前 DSH SDK JSON-RPC 服务只暴露 `session/prompt|query|resume|wait` 与工作目录方法，没有 `session/cancel`；产品先用“会话独占运行时 + 关闭该运行时”实现等价停止，真正的单会话回合取消要等 SDK 暴露接口。
- 队列是进程内调度器，任务记录持久化但重启后不自动续跑；自动续跑需要幂等键与副作用边界，当前刻意不做。
## 28. 市场语义收口、账号/项目安装隔离与后台管理补齐（2026-11-13）

**目标**：让市场只承载可安装项，把 Office/MCP 明确为底层能力；技能安装支持账号与项目隔离；管理中心补齐排序、发布单位修改与安装用户查看。

**实现**：

- `Office 文档`、`九规内部工具（MCP）`从 `MARKET_BUILTIN` 移除，不再作为市场商品；运行时 `/api/plugins` 仍保留，但 `kind` 改为 `capability`、`id` 改为 `CAP-OFFICE` / `CAP-MCP-JG`、`source='runtime-capability'`，市场页以“底层能力”分组展示，不提供安装/卸载。旧持久快照中的 `kind='plugin'` 内置条目在 hydrate 时过滤。
- 市场目录收敛为 10 条：`D-01`~`D-04`、`JG-01`、`M-01`、`M-02`、`M-03`、`M-07`、`M-08`。
- 技能安装范围：账号范围写 `data/agents/<userId>/skills/<目录>`，Harness 运行时注入 `DSH_AGENTS_HOME=data/agents/<userId>`；项目范围写 `<project.cwd>/.dsh/skills/<目录>`，DSH 项目根扫描 `.dsh/skills`。两种目录互不可见。
- 安装台账新增 `marketInstalls`（`id -> [{userId,userName,scope,projectId,installedAt}]`），用于“当前账号已安装”判断和后台安装用户查看；成功安装/卸载后持久化。
- 市场详情页新增“安装范围”选择，未安装条目可直接点行打开详情后选择“仅当前账号”或“当前项目”；已安装条目锁定原安装位置，卸载按原范围执行，避免改范围后卸错目录。
- 历史全局安装（`D-01`~`D-04`、`JG-01`、`M-01`、`M-03`）作为“全客户端基线”保留，市场显示 `locked`，不允许按单个账号卸载。
- 管理后台市场条目新增 `order`；`POST /api/admin/plugin-market` 支持 `action:'sort'` 与 `publisher` 更新；`GET` 返回 `installUsers`。后台表格展示发布单位、排序按钮与安装用户弹窗，操作行独立成行避免窄栏挤压。
- 管理中心 KPI 改为“底层能力 / 技能”，值为 `2 / 7`，并注明 `0 个企业插件 · 市场 10 个已上架`；设置页原“企业插件”改为“运行时能力与技能”。

**实测**：

- 重启后 `/api/plugin-market` 返回 10 条；`/api/plugins` 返回 9 项（7 技能 + 2 capability）；市场页显示“底层能力”分组，Office/MCP 不再出现市场卡。
- admin 账号 `A-7788-01` 安装 `M-02` 到账号范围：`data/agents/A-7788-01/skills/market-M-02` 存在，admin 市场 `installed=true`，ops 账号 `installed=false`。
- admin 安装 `M-07` 到项目 `PRJ-D1F5D4`：`workspaces/traffic-counter/.dsh/skills/market-M-07` 存在，台账显示项目范围；通过页面把 `M-02` 安装到同一项目后，文件同样落在 `.dsh/skills`，详情页显示“安装位置 项目 车流量分析工具”。
- 上述测试安装均通过 API 或页面卸载，文件删除、台账清空，空的 `data/agents/A-7788-01` 与项目 `.dsh` 目录清理。
- 后台 `M-02` 上移/下移后顺序变化并可恢复；发布单位改为“智数中心（测试）”后恢复“智数中心”；表格改名后名称列可见，排序按钮、安装用户弹窗、发布单位输入框均在页面验证。
- `GET /api/runtime/bundles` 返回 `installAvailable=true`；内置 pnpm 为 `runtime/pnpm/node_modules/pnpm/bin/pnpm.cjs`，`pnpm --version` 输出 11.21.0，因此“缺 pnpm”不再是当前版本的 Bundle 安装阻塞项。
- 截图：`D:\project-test3\shots\market-capabilities.png`、`plugin-market-admin.png`、`plugin-market-users.png`。

**边界**：

- 账号/项目隔离只覆盖技能；DSH Bundle 仍通过 `dsh plugin add` 安装到本机运行时，对同一客户端所有账号可见（该边界已在第 30 节改为按账号 DSH_HOME 隔离）。
- 全客户端基线技能按产品级共享处理，未迁移为某个账号的私有安装。

## 29. 按三层架构拆分公共能力、业务插件与技能（2026-11-13）

> 本节记录当时的中间状态（市场 10 条、技能 7 个）。最终清理与 Bundle 账号隔离见第 30 节：市场只保留 4 个官方技能，技能 4 个，Bundle 按账号隔离。

**目标**：按架构图把插件市场拆成三层：Harness 核心运行时、平台公共能力、业务插件；公共能力不进可卸载市场，业务插件与技能共用市场但必须显式区分类型与图标。

**实现**：

- 新增 `PLATFORM_CAPABILITIES` 作为系统级模块清单，与 `MARKET_BUILTIN` 完全分离；平台能力不出现在市场目录，也不提供安装/卸载入口。
- 公共能力只收录运行时真正加载的模块：`Office / PDF 文档处理`（`skill-office`）、`九规内部工具（MCP）`（`mcp-jg`）、`文件管理`（`file-reference-local` + `file-upload` + `deliverable-file-references`）、`Python / 脚本运行环境`（`shell-env`）、`数据检索与解析`（`session-query-sqlite` + `tool-session-query`）。GIS/CAD 当前没有可用运行时模块，PDF 也由 Office 模块统一承担，均不伪造独立能力条目。
- 每个能力带 `managedBy`、`accessibleTo`、`defaultEnabled`、`protocol`、`module`、`version`、`deps`、`upgradedBy`、`permissions`、`limits`，默认启用并对全部授权用户开放。
- `installedSkillPlugins()` 不再返回 `kind='capability'`；`/api/plugins` 只返回真实技能。新增 `GET /api/platform-capabilities`，返回平台能力清单与 `canManage`。
- 市场条目新增 `type`：`bundle`/`plugin` 映射为 `plugin`，`skill` 映射为 `skill`。市场页拆成插件与技能两个入口：插件 tab 不展示技能，技能 tab 同时展示已安装技能与技能市场。
- 员工端市场页不展示平台公共能力：左侧只列当前账号已安装的插件/技能，主区插件页只保留“公开 / 个人”与插件市场；个人页先列“我安装的插件”，再列“我提交的插件”，明确说明不共享给其他账号。公共能力的权限与资源统一在管理中心配置。
- 类型图标分离：业务插件用 `plugin` 图标，技能用 `spark` 图标；左侧“插件与技能”入口使用插件 logo，插件 tab 与技能 tab 分别使用插件、技能图标。
- 管理后台新增“平台公共能力”表，展示模块、权限数、资源上限，并提供“权限与资源”配置入口；`POST /api/admin/platform-capabilities` 保存权限与 CPU/内存/超时/并发上限，写入审计并持久化到 `capabilityPolicies`。
- 管理中心 KPI 改为“公共能力 / 技能”，动态值 `5 / 7`，备注区分市场插件与技能数量。

**实测**：

- 重启后 `GET /api/platform-capabilities` 返回 5 项，全部 `enabled=true`；`GET /api/plugins` 返回 7 个技能，不再混入能力。
- 市场仍为 10 条，`type` 全部为 `skill`；员工端插件页标题为“插件”，左侧不再出现平台能力，公开页无“业务插件”空分区，个人页只显示本账号安装与提交；技能页显示已安装技能与技能市场。
- 后台“平台公共能力”表可见 5/5 已启用；修改 `CAP-PYTHON` 权限与内存后返回新值，重置后 `policyUpdatedAt=0`，测试配置未残留。
- 截图：`D:\project-test3\shots\market-three-layers.png`、`market-skills-split.png`、`market-personal.png`、`platform-capabilities-admin.png`。

**边界**：

- 当前市场没有真实业务插件包，架构图中的“智能技术标编制 / 建筑材质提取 / 交通流量统计 / 规划成果质检”只是业务示例，未作为演示条目上架；员工提交的 Bundle 会以“插件”类型进入市场。
- 平台能力的权限与资源上限是平台策略配置，已落库并在界面展示；运行时实际执行仍受 DSH 工具白名单与人工审批约束，尚未做进程级 cgroup/Job Object 资源限额。
- PDF 尚未独立成模块，GIS/CAD 没有真实运行时模块，因此公共能力清单是 5 项而不是架构图中的 6 项。

## 30. Bundle 按账号隔离、清空非官方技能与市场演示数据（2026-11-13）

**目标**：把 DSH Bundle 从“本机全局挂载”改成按账号独立；开发阶段只保留 DeepSeek Harness 官方技能，清掉内部/虚构的市场条目、提交记录和技能目录。

**实现**：

- 每个账号使用独立 `DSH_HOME`：`data/agents/<userId>/dsh-home`。首次使用时从平台官方 profile 复制基线 `bundles`、`cordis.patch.yml`、`cordis.yml`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`，并从全局官方技能目录复制 4 个官方技能，不复制任何市场或内部技能。
- `runAgent` 增加 `dshHome` 参数，Harness 进程的 `dshHome`、`JG_MCP_DEBUG` 与缓存键都按账号区分；同一账号的 Bundle 只影响该账号的运行时。
- Bundle 的安装、卸载、启停与 `/api/runtime/bundles` 全部改为读写当前账号的 profile；新增 `closeHarnessForHome()`，安装后只关闭该账号的运行时，不再关闭所有账号的 Harness。
- 市场台账中 Bundle 范围由 `global` 改为 `account`；后台安装用户按账号扫描 `data/agents/*/dsh-home` 的 profile bundles。
- 市场目录只保留官方技能 `D-01`~`D-04`；移除 `JG-01`、`M-01`、`M-02`、`M-03`、`M-07`、`M-08`。旧持久快照中的无 `subId` 市场条目与 `SUB-01`~`SUB-04` 演示提交在 hydrate 时过滤，市场安装台账同步清理已不存在条目。
- 删除 `data/dsh-home/skills` 下的 `jg-product`、`market-M-01`、`market-M-03`，删除 `marketplace/skills` 下 6 个非官方技能源目录；`SKILL_SOURCE_DIR` / `SKILL_INSTALL_DIR` 移除 `JG-01`。
- 技能/安装文案改为“官方基线技能”“当前账号 DSH 运行时”，不再声称 Bundle 对全客户端可见。

**实测**：

- `GET /api/plugins` 返回 4 个官方技能；`GET /api/plugin-market` 返回 4 条，全部 `type='skill'`；`counts.plugins=4`，KPI 为 `5 / 4`。
- `GET /api/runtime/bundles` 对 admin 与 ops 分别返回各自 `DSH_HOME` 的 profile；关闭 admin 的 `@deepseek-ai/dsh-sdk-app` 后 admin 只剩 `@deepseek-ai/dsh-base`，ops 仍为 `dsh-base + dsh-sdk-app`，恢复后 admin 回到两项，证明账号隔离。
- `data/agents/A-7788-01/dsh-home` 与 `data/agents/ops/dsh-home` 各自只有 4 个官方技能目录，基线 bundles 为 `@deepseek-ai/dsh-base`、`@deepseek-ai/dsh-sdk-app`。以各自 `DSH_HOME` 执行 `dsh --profile sdk --dump-config` 均退出码 0，dump 中可见 `skill-office`、`mcp-jg`、`optional-session-search`、`optional-session-query-sqlite`，证明账号 profile 仍加载平台 patch。
- 管理后台市场表 4 条，均技能；插件审核为 0 条，无演示提交。

**边界**：

- Bundle 目前只做账号级隔离，未做项目级 Bundle；项目级仍只覆盖技能目录。
- 每个账号复制一份官方技能与 profile，账号多时磁盘占用线性增长；后续可改为只读共享 + 按账号 overlay。
- 账号首次切换 `DSH_HOME` 后，旧全局 DSH 会话不能 resume，聊天会退回新建会话；历史对话正文仍由产品侧保存。

## 31. 技能页与插件页同构（2026-11-13）

**目标**：官方内置技能不再混入“已安装技能”，主区按插件市场逻辑展示。

**实现**：

- 左侧“已安装技能”只列当前账号从市场安装的技能（`scope != 平台官方基线`）；官方基线不进入个人已安装清单，也不进入员工技能市场和管理后台市场台账。
- 技能页主区新增“公开 / 个人”切换，与插件页一致：公开只显示员工创建并上架的技能（当前 0），个人只显示“我创建的技能”；安装列表仍在左侧“已安装技能”。插件页“个人”也同步改为只显示“我创建的插件”。
- `GET /api/plugins` 合并官方基线技能与 `data/agents/<userId>/skills` 下的账号技能，账号技能带市场发布单位、版本与描述；官方基线仍标记 `scope=平台官方基线`。

**实测**：

- ops 账号技能页左侧显示“暂无已安装技能”，公开区显示“官方内置技能由平台维护，不在技能市场展示；当前没有员工创建并上架的技能”，个人区“我创建的技能”为空态；`GET /api/plugin-market` 返回 0 条，`GET /api/admin/plugin-market` 返回 0 条。
- 截图：`D:\project-test3\shots\market-skills-split.png`、`market-skills-personal.png`。

## 32. 官方基线纳入管理中心，米乐升级超级管理员（2026-11-13）

**目标**：官方内置插件与技能不再进入市场，但必须由运维人员在管理中心配置；米乐作为超级管理员拥有管理中心权限。

**实现**：

- 侧边栏“管理中心”入口改为按 `visibleModules` 判断，不再只对 ops 开放；admin 账号（米乐）现在可见并进入管理中心。
- `roles.admin` 的展示名与岗位改为“超级管理员”，保留 `admin` 模块与全组织、涉密范围。
- 管理中心「AI 能力管理」新增“官方内置插件与技能”块：
  - 4 个官方技能显示运行时目录、启用状态、使用账号数，可停用/启用；
  - 2 个官方核心 Bundle（`@deepseek-ai/dsh-base`、`@deepseek-ai/dsh-sdk-app`）显示为“核心基线不可停用”。
- 新增 `GET/POST /api/admin/official-baseline`：停用官方技能会从所有账号 `dsh-home/skills` 移除并关闭对应 Harness；启用时重新复制到各账号；状态持久化到 `officialDisabledSkills`。
- 官方技能停用后 `GET /api/plugins` 同步减少，市场仍不展示官方基线。

**实测**：

- admin（米乐）登录后侧边栏出现「管理中心」，`/api/admin/official-baseline` 返回 4 技能 + 2 Bundle。
- 停用 `agent-experience`：`/api/plugins` 从 4 变 3，两个账号的 `dsh-home/skills/agent-experience` 均被移除；重新启用后恢复 4 条与两个账号目录。
- 截图：`D:\project-test3\shots\official-baseline-admin.png`。


## 33. AI 能力管理重构与官方基线卸载（2026-11-13）

**结构**：AI 能力管理改为五段式，先运行基线，再模型资源，再 Agent/MCP，再员工市场，最后自动化：
1. 运行基线：官方内置插件与技能 + 平台公共能力；
2. 模型与配额：企业/个人模型、部门用量与限额；
3. Agent 与 MCP：Agent 注册表与 MCP 工具目录；
4. 插件与技能：员工提交审核 + 市场上架管理；
5. 自动化任务：定时任务与执行记录。

顶部 KPI 保留全局概况；切换分段只显示本段块，不再把审核、市场、基线、模型全部堆在一页。

**官方基线盘点**：
- 官方技能 4 个：Agent 经验与工具设计、Cordis 组合参考、DSH 插件开发、Agent 预设编辑，均来自 `@deepseek-ai/dsh-agent-preset/skills`。
- 官方核心 Bundle 2 个：`@deepseek-ai/dsh-base`（基础运行时）、`@deepseek-ai/dsh-sdk-app`（SDK 应用层）。
- 平台公共能力 5 个：Office/PDF、九规内部工具 MCP、文件管理、Python/脚本环境、数据检索；它们是系统级模块，不属于员工市场插件。

**卸载**：
- 官方技能支持“停用 / 启用 / 卸载 / 重新安装”。卸载会删除平台基线目录和所有账号 `dsh-home/skills` 副本，状态持久化到 `officialUninstalledSkills`；重新安装从官方 preset 源恢复。
- 两个核心 Bundle 是产品运行时底座，管理中心只展示状态，不允许停用或卸载，避免客户端无法启动。

**实测**：
- 卸载 `agent-experience`：`/api/plugins` 4→3，平台目录与两个账号副本均删除；重新安装后恢复 4 条与副本。
- 米乐登录后可见管理中心，可切换五个分段；截图 `shots/ai-admin-baseline.png`、`shots/ai-admin-plugins.png`。


## 34. AI 能力管理去除演示数据（2026-11-13）

**原则**：AI 能力管理只展示真实来源，无法取得真实数据的指标直接不展示，不用演示值填充。

**已移除**：`console.mjs` AI 分段原来的 6 个假 KPI 和 4 张假表（企业模型/个人模型/Agent/MCP/自动化任务、模型管理、部门用量与配额、Agent 与 MCP、自动化任务）。该分段现返回空 `kpis` 与 `blocks`，由前端按真实接口组装。

**真实数据源**：
- 官方技能与核心 Bundle：`/api/admin/official-baseline`；
- 平台公共能力与运行时启用状态：`/api/platform-capabilities` 与 `/api/runtime/plugins`；
- 运行时插件总数与启用数：`/api/runtime/plugins`；
- 当前账号模型网关：`/api/model/config`（供应商、端点、默认模型、Key 状态、最近测试）；
- 员工市场与待审核：`/api/admin/plugin-market`、`/api/plugin-subs`；
- Harness 定时任务：`/api/automations` 中 `source='harness'` 的真实条目（来自 `schedule.json`）。

**当前真实值**：官方技能 4/4、核心 Bundle 2/2、运行时插件 112/115、平台公共能力 5/5、市场条目 0、待审核 0、Harness 定时任务 0；模型网关为当前账号真实配置（OpenAI 兼容端点 / `deepseek-chat` / Key 已保存 / 尚未测试）。

**边界**：原“企业模型 / 个人模型 / 部门 Token 用量 / MCP 工具 18 / 今日执行 412 次”等平台级统计没有真实数据源，已删除而不是改成 0 占位；没有虚构配额和虚构执行次数。


## 35. 系统内核、审核分类与自动化归属修正（2026-11-13）

**系统内核**：AI 能力管理“运行基线”中的原“官方内置插件与技能”改名为“系统内核”。4 个官方技能与 2 个核心 Bundle 统一为只读内核组件，不再提供停用、卸载、重装按钮；页面明确“系统内核不可停用或卸载”。`POST /api/admin/official-baseline` 同步拒绝停用/卸载，返回 403。

**审核分类**：原“插件审核”改为“插件 / 技能审核”，同一卡片内拆成两段：插件审核、技能审核，各自显示待处理数和空态。审核列表按提交记录的 `kind='skill'` 区分，技能提交不再混在插件审核里。

**市场分类**：原“插件市场已上架管理”改为“插件 / 技能上架管理”，下面分“插件市场”“技能市场”两张表，各自显示条目数、上架数、分组、发布单位、安装用户与上下架操作。

**自动化归属**：自动化任务是员工自己创建的定时任务，不属于管理中心。AI 能力管理删去“自动化任务”分段、Harness 定时任务块和对应 KPI，结构由五段收敛为四段：运行基线 / 模型与网关 / Agent 与 MCP / 插件与技能。用户侧仍保留“定时任务”入口。

**实测**：米乐登录后 AI 能力管理显示四个分段；系统内核 6/6 只读；“插件与技能”显示插件审核 0、技能审核 0、插件市场 0、技能市场 0。当前服务端口 `53351`。


## 36. 平台公共能力支持停用/启用（2026-11-13）

平台公共能力从“只读默认启用”改为“可停用、可重新启用”：
- 每项能力新增 `disabled` 状态，写入 `liveCapabilityPolicies`，随持久状态保存；停用记录 `disabledAt`、`disabledBy`。
- `GET /api/platform-capabilities` 返回 `runtimeEnabled`、`enabled`、`disabled` 与 `status`；KPI 会把停用项从已启用数中扣除。
- `POST /api/admin/platform-capabilities` 新增 `action=enable|disable`，保留原有权限与资源限制配置；停用不删除运行时模块与已有数据，可随时启用。
- 管理中心“平台公共能力”表新增“停用/启用”按钮；停用前弹出确认，说明只关闭平台能力，不删除模块和数据。
- 实测 Office/PDF 停用后 `enabled=false / status=disabled`，恢复后 `enabled=true / status=enabled`，状态持久化。

**边界**：停用是平台能力管理开关，运行时插件本身不卸载；内置模块仍保留，便于重新启用和独立升级。


## 37. 按内核/平台能力/市场三层重新归类（2026-11-13）

按实际运行职责重新分层，修正此前的归类偏差：

**系统内核（只读，不可停用/卸载）**
- `@deepseek-ai/dsh-base`、`@deepseek-ai/dsh-sdk-app` 两个启动底座。
- 文件附件与交付物（`dsh-file-reference-local`、`file-upload`、`deliverable-file-references`）从平台公共能力移入系统内核，因为聊天附件、上传和交付物都依赖它。
- 4 个官方技能不再作为系统内核，也不再自动复制到每个账号。

**平台公共能力（可停用/启用）**
- 保留：Office/PDF、业务系统接入 MCP、Python 环境、会话检索。
- 补齐官方已加载但此前未纳入的能力：Web 搜索与网页抓取、后台作业、Agent 编排与工作流。
- 修正授权范围：MCP 标为“按员工身份与网络授权”，Python 与 Agent 编排标为“按角色授权”，不再统一写“全部授权用户”。
- 平台公共能力由 5 项调整为 7 项（文件项移入内核）。

**官方技能改为市场条目**
- 4 个官方技能（`D-01`～`D-04`）作为技能市场条目发布，发布单位标注“平台开发运维”。
- 不再自动复制到账号；用户可在“插件与技能 → 技能 → 公开”自行安装/卸载，安装只影响当前账号。
- 市场页面取消“官方与内置 / 热门 / 新品 / 企业内部”分组，只保留“插件市场 / 技能市场”和发布单位；插件、技能仍使用不同图标。
- 修正技能安装目录：账号安装写入 `data/agents/<userId>/dsh-home/skills`，确保 DSH 运行时真实加载；此前写到 `agents/<id>/skills` 不会被运行时读取。

**验证**
- 技能市场返回 4 条官方技能，发布单位为“平台开发运维”，`available=true`、`installed=false`。
- 安装 `D-01` 后 `data/agents/A-7788-01/dsh-home/skills/agent-experience/SKILL.md` 与 `.jg-market.json` 同时存在；卸载后目录移除。
- 系统内核返回 2 个 Bundle + 1 项文件基础设施；平台公共能力返回 7 项且均 `enabled`。


## 38. 运行时插件指标从 KPI 下移为诊断项（2026-11-13）

“运行时插件 112/115”容易和员工插件市场混淆，原因是这 115 项是 DSH 内部运行时模块（`dsh-dump-config.txt`），不是插件市场商品。

调整：
- 顶部 KPI 移除“运行时插件”，改为“系统内核 / 平台公共能力 / 市场条目 / 待审核”四个管理指标。
- “Agent 与 MCP”分段新增“DSH 运行时诊断”，显示 `112 / 115 启用 · 3 停用`，明确说明“不是员工在插件市场安装的插件”。
- 新增“查看全部”弹窗，列出全部 115 个运行时 ID、插件包和启停状态。
- 3 个停用项由当前 `sdk` profile 配置决定：`hmr`、`fs-observation-policy`、`tool-executor-ptc`，属于运行配置，不是业务停用或故障。

**边界**：运行时插件数是运维诊断数据，不进入管理中心的业务 KPI，也不代表平台公共能力数量。


## 39. 全站弹窗关闭控件统一（2026-11-13）

审计发现部分弹窗同时有右上角 X 和底部“关闭/知道了”，功能重复。

调整：
- 所有弹窗只保留右上角统一的 X 关闭控件；底部不再重复“关闭/知道了”。
- 表单弹窗保留“取消 + 提交/保存”业务动作，不再额外放一个“关闭”。
- 抽屉式详情（平台能力、插件详情、技能详情、项目详情、工单详情、越权拦截、文档预览等）同样只保留右上角 X。
- 公告卡片、资源卡片、笔记编辑、文档编辑等自定义弹窗的关闭图标统一为同一套 `icon('close')` 图标，不再使用文字 `×`。
- 新增 `public/ui-close.css` 统一关闭按钮的尺寸、边框、背景与 hover 状态。

**验证**：DSH 运行时插件弹窗、平台能力详情、插件/技能详情均只有一个右上角关闭入口；页面无重复关闭按钮。

## 40. P0 全链路轨迹、轮次统计、会话分叉与完整日志（2026-11-13）

新增 `trace.mjs`，产品层直接消费 DSH `runAgent()` 返回的真实事件流，不改 DSH 内核：

- 每轮落盘 `data/agents/<userId>/traces/<conversationId>/<traceId>.json`，包含 `events`、`notifications`、`steps`、`usage`、`toolAudit`、`subagents`、`workflows` 与模型输入上下文。
- 助手消息新增 `traceId`、`runStats`；统计真实耗时、模型调用次数、输入/输出/缓存读/缓存写/推理 tokens、缓存命中率、上下文字符与估算 tokens、工具调用/失败、事件数。
- 会话“更多”菜单新增“分叉会话”和“导出完整会话日志（ZIP）”。
- 分叉会复制当前可见消息到新会话，新建空 DSH session，保留项目、模式、审批策略与模型预设；`forkContext` 明确标注为只读历史，不是 DSH 原生 fork；复制消息会清除源会话 `traceId`，避免查询错轨迹。
- 完整日志递归定位 `dshHome/sessions/**/session-<id>/session.v4.jsonl.zstd`，用纯 JS store ZIP 打包 `dsh-session/` 原始日志、`trace.json`、`manifest.json`、`README.txt`。

新增 API：`GET /api/conversation/trace`、`GET /api/conversation/session-log`、`POST /api/conversation/fork`。

**实测**：会话 `C-991122` 真实返回 `traceId=TR-mwee6lrm-03e47f` 与 `dshSessionId=session-1d14a7bbdcd440a599d07a4e8759feb5`；轨迹 117,526 字节、19 个事件；ZIP 138,282 字节，解压包含 `session.v4.jsonl.zstd`、`trace.json`、`manifest.json`、`README.txt`；分叉会话 `kind` 回落为 `chat`，不携带源轨迹 ID。


## 41. 插件包版本备份、升级与回滚（2026-11-13）

- 新增 `marketVersions` 持久字段与 `data/market-backups/<marketItemId>/<timestamp>/` 备份目录，每个条目保留最近 5 个版本。
- 审核替换已有目标目录前先备份；审核替换失败不会留下半包。
- `POST /api/admin/plugin-market` 新增 `action=upgrade`：校验 ZIP 类型与扫描结果、备份当前包、替换、更新版本号与文件信息、关闭已安装 Bundle 的账号运行时；失败自动尝试回滚。
- 新增 `action=rollback`：恢复上一备份版本、更新版本号、关闭相关运行时；无备份返回 409。
- 管理页社区条目新增“升级”“回滚”入口；`marketItemState` 返回 `versions`、`canRollback`。


## 42. 管理员持久终端（平台侧 + DSH 运行时侧）（2026-11-13）

- 新增 `terminal.mjs`：每个管理员账号一个常驻 PowerShell 进程，唯一 marker 判断命令结束，支持超时重启、`cd` 后工作目录保持、输出清理。
- 新增 `POST /api/terminal/exec`、`GET /api/terminal`、`POST /api/terminal/reset`，仅 `admin` 权限。
- “Agent 与 MCP → DSH 运行时诊断”新增“开发终端”入口，复用现有 `openModal`、`.mc-block`、`.mc-table`、`.btn`、`.text-input` 样式。
- 同时把 DSH 官方可选 Bundle 注入 sdk profile：`dsh-experimental-terminal-bundle`、`dsh-experimental-agent-team-profile`、`dsh-experimental-tool-worktree`、`dsh-experimental-auto-review`；运行时由 115 项增至 126 项，120 启用 / 6 停用，新增 `optional-tool-terminal`、`tool-agent-team`、`tool-worktree`、`auto-review`。
- 修改前已备份 profile 到 `data/backups/profile-before-optional-*`。

**实测**：管理员终端 `Get-Location; Write-Output hello` 返回真实 cwd 与 `hello`，UI 回车执行同样返回真实结果；可选 Bundle 加载后真实 Chat 仍返回“可选能力已加载”。


## 43. 当前仍未纳入的能力（如实记录）

以下能力尚未完成产品级接入，不以占位或假数据冒充：

- 自定义外部插件索引源（当前市场仍是平台内置数据库 + 官方条目）。
- Codex / Claude Code 按需子智能体：npm 上的 `dsh-subagent-codex`、`dsh-subagent-claude-code` 为 `0.0.1-rc.1`，与当前 `0.2.2-rc.1` 运行时 peer 依赖不匹配，未强行安装。
- CUA：`dsh-cua-bundle` 与当前 cordis 4.1.0 版本不匹配（该包 peer 上限为 `<4.1.0`），未强行安装。
- 会话“恢复”仍复用 DSH 既有 `resumeSession()` 与重新打开会话，没有新增显式“恢复并继续”按钮。

> 文件预览目录树与本地离线语音转写已在第 44 节完成，不再是未完成项。


## 44. 文件预览目录树与本地离线语音转写（2026-11-13）

### 文件预览目录树

- 新增 `GET /api/files/tree`：按项目 `cwd` 或会话工作目录懒加载目录，目录优先排序，跳过 `.git`、`node_modules`、`.jg`、`.dsh` 等运行目录。
- 新增 `GET /api/files/content`：读取文本预览；超过 1MB 不渲染全文；图片与二进制文件返回 `rawUrl`，不把二进制当文本。
- 新增 `GET /api/files/raw`：仅限图片/PDF 等可预览类型，单文件上限 20MB。
- 三条接口都先校验项目可见性或会话归属，再做 `realpath` 越界校验；`../`、绝对路径、符号链接逃逸均被拒绝。
- 项目详情新增“浏览文件”按钮，弹窗左侧懒加载目录树、右侧预览文本/图片；项目会话“更多”菜单新增“浏览项目文件”。
- 全部复用现有 `openModal`、`.mc-*`、`.btn` 与内联变量样式，没有新增视觉体系。

**实测**：项目 `PRJ-D1F5D4` 根目录 `D:\project-test3\workspaces\traffic-counter` 返回 8 个真实文件；预览 `change-summary-test.md` 得到真实内容“变更摘要验证”；`../../`、`/etc/passwd`、绝对路径请求均被拒绝。

### 本地离线语音转写

- 新增 `speech.mjs` 与 `speech-worker.mjs`：直接使用 DSH 自带的 `sherpa-onnx-node` 原生运行时和 SenseVoiceSmall ONNX 模型，CPU 本地推理；识别在独立子进程中完成，不阻塞 HTTP 服务。
- 模型固定 revision、大小与 SHA-256 与 DSH `runtime/assets.json` 一致：INT8 约 239MB，另加 tokens 与 Silero VAD；默认优先 `hf-mirror.com`，失败回退 Hugging Face。
- 新增 `GET /api/speech/catalog`、`POST /api/speech/prepare`（仅管理员）、`POST /api/speech/transcribe`。音频以 16kHz 单声道 PCM16 WAV 传入，识别结果只返回文本，不落会话事件。
- 输入框语音按钮由 Web Speech 改为本地录音：浏览器侧重采样为 16kHz WAV，调用本机模型；模型未准备时提示管理员先在“管理中心 → AI 能力管理 → DSH 运行时诊断 → 本地语音”准备模型。
- 本地语音弹窗只复用现有 `jg-modal`、`.mc-block`、`.field-value`、`.btn` 样式。

**实测**：本机生成 16kHz 测试 WAV 后，`speech/transcribe` 返回“你好，这是本地离线语音识别测试。”，`offline=true`，`auto` 语言同样通过；模型文件已校验为 `ready`，共 241,357,257 字节。


## 45. 未实现入口灰调与能力归类修正（2026-11-13）

- 平台公共能力 `CAP-AGENT` 的 `sourceIds` 从已停用的 `tool-subagent` 改为真实启用的 `subagent`、`agent-team`、`tool-agent-team`、`ptc-runtime`、`workflow-ptc`、`tool-workflow`；`/api/platform-capabilities` 由 6/7 恢复为 7/7。
- 项目卡片置顶改为真实调用 `POST /api/projects/update` 的 `pinned` 字段，服务端持久化后重新渲染侧边栏；不再显示“演示”提示。
- 会话菜单的“分区 / 锁定聊天 / 分享 / 归档”、项目显示菜单的“整理侧边栏 / 聊天排序方式”、顶部“文件 / 帮助”菜单的临时聊天、打开文件夹、关闭、文档、任务管理器、检查更新，统一加 `off` / `disabled` 灰态；点击不执行旧演示逻辑。
- 设置中心的工作区、二次认证、设备、诊断、授权申请、导出、归档、清缓存、MCP 测试、更新、帮助等入口统一灰调，`title` 标注“功能尚未接入”。
- 图像生成当前只有本地 canvas 占位，没有真实生成接口，因此侧栏“图像”与输入框“创建图像”灰调并禁用；不隐藏入口，也不再用占位画面冒充真实结果。
- 云浏览器中下载、AI 转交、文件工具、更多工具、门户凭据注入等未接后端的控件灰调，输入框禁用；已登记的云会话打开/结束仍保留真实行为。
- 本轮不改变现有 UI 样式体系，灰态只使用内联 `opacity`、`cursor` 与原生 `disabled`，没有改动 `public/styles.css`。

**实测**：重启后 `http://127.0.0.1:57206/` 中侧栏“图像”为 `disabled + opacity .45`，文件菜单“新建临时聊天 / 打开文件夹 / 关闭”为灰态；`/api/platform-capabilities` 返回 7 项全部 `enabled`；项目 `PRJ-D1F5D4` 置顶写入后 `pinned=true`，取消后恢复 `false`。


## 46. 定时任务中心与云浏览器残留入口收口（2026-11-13）

- 定时任务中心：筛选、搜索、分享、追加要求输入框与发送按钮统一灰调；补丁输入框 `tkAsk` 禁用，点击不产生“已记入任务”的假成功。
- 任务中心“更多”菜单：在网页端打开、移至项目灰调；“查看任务中的文件”改为空态说明，不再列出虚构的 `执行记录.txt`、`来源台账` 等假文件。
- 任务详情中的执行记录仍使用真实 `/api/tasks` 数据；中断任务仍可点击回到原会话并填入原指令，但不自动重放。
- 云浏览器：扩展程序、下载、更多工具、AI 转交输入框、文件工具、更多工具、门户凭据注入全部灰调；已登记的云会话打开/结束保留真实行为。
- 数据中心的数据服务条目点击只提示真实调用规则，不再标注“演示”。

**实测**：新版 `app.js?v=443` 在 `http://127.0.0.1:57206/` 加载成功，任务中心筛选/搜索按钮读取为 `disabled`；页面无新增脚本错误。

补充：通讯录“呼叫”、即时通讯“截图”发送、云空间文件下载/移动、公告“转发到即时通讯”、档案“查看项目档案”等未接后端的入口一并灰调，点击不再显示假成功；云空间真实存在的文件下载链接仍可直接打开。版本推进到 `app.js?v=444`。


## 47. 持久队列幂等键与断点快照（2026-11-13，进行中）

- 每次 Chat 请求由前端生成 `idempotencyKey`，随 `/api/chat` 提交；服务端按 `userId + idempotencyKey` 查找 `chat-run` 任务。
- 相同 Key 正在排队/执行时返回 `409 DUPLICATE_REQUEST`，不重复写入用户消息、不重复执行。
- 相同 Key 已完成/失败/取消/中断时返回原任务与原会话，并带 `duplicate:true` 与已保存的 `replyText`；前端直接恢复原会话，不再重跑。
- `chat-run` 任务新增 `checkpoint`：记录会话、原指令、模式、DSH sessionId、阶段与更新时间；启动、完成、失败、取消、重启中断都会更新阶段。
- 任务完成时保存 `replyText`，供幂等重放返回，不重新调用模型。

**实测**：同一 Key 第一次请求耗时 54 秒返回 `reply=OK`；第二次请求 0 秒返回 `duplicate=True`，任务 `TR-1794546114838-653`，没有再次执行。跨重启自动续跑仍未开启，因为运行中断可能已产生未确认副作用。


## 48. 可确认的恢复执行（2026-11-13）

- 任务执行记录中，`interrupted` / `failed` 的 `chat-run` 仍可点击。
- 点击后不再直接回填原指令，而是弹出“恢复执行”确认：展示任务、中断阶段、原会话，并明确说明中断前工具动作可能已产生副作用，系统不会自动重放。
- 只有点击“继续执行”才回到原会话并发送恢复指令；恢复指令要求先检查工作区与已有产出，只继续未完成部分，不重复已完成的写入、命令或外部操作。
- 取消则只关闭确认框，不产生任何执行。
- 恢复执行使用新的 `idempotencyKey`，不复用旧 Key，避免把人工恢复误判为重复请求。

**实测**：新版 `app.js?v=445` 加载成功；中断任务接口返回的 `checkpoint` 包含会话、原指令、阶段与 DSH sessionId。当前没有处于 `interrupted` 的测试任务，因此恢复按钮的真实执行路径尚未完整跑通，已保留为可验证入口。


## 49. 定时任务真实调度与执行（2026-11-13）

- 定时任务不再使用 `data.mjs` 的种子条目和 `taskTick()` 时间推进假进度。
- 新增 `liveAutomations` 持久存储，随 `runtime` 快照落盘；`GET /api/automations` 只返回当前账号自己的任务。
- 创建任务时解析 `每天 / 每周X / 每月 / 每季度首月` 四类规则，计算真实 `nextRunAt` 与展示用 `next`。
- 服务启动后每 30 秒执行一次 `automationTick()`；到点且未在运行的任务会真实调用 `runAgent()`。
- 每次执行创建真实的 `automation-run` 任务与独立会话 `C-AU-*`，记录 queued → running → done/failed、步骤数、回复、会话与 DSH sessionId。
- 执行完成回写 `last`、`lastResult`、`lastTaskId`、`lastRunAt` 并重新计算下一次时间；暂停不再计算下一次，显示 `—`。
- 高风险删除/覆盖指令、空指令、缺少模型密钥都会直接失败并写明原因，不会伪造成功。
- 任务中心不再显示种子任务；任务列表按 `userId` 过滤，避免跨账号看到他人的执行记录。
- 新建/编辑表单补齐已有自定义频率的回显；任务详情展示最近一次真实执行结果，暂停任务单独归组。

**实测**：
- 创建 `每天 09:00` 任务，`next=11-14 09:00`；手动触发后任务 `T-1794546877900-376` 从 `running` 到 `done`，`replyText=定时任务已真实执行`，模型 `deepseek-chat`。
- 重启服务后任务、自动化条目、执行记录都在；暂停状态保持。
- 创建 `每天 13:20` 任务后不手动触发，13:20 调度器自动创建并完成 `T-1794547220008-517`，`lastResult=自动调度成功`，下一次自动变为 `11-14 13:20`。
- 测试用自动化条目与对应执行记录已删除，避免把验证数据留在真实任务中心。


## 50. `CAP-WEB` 网页搜索真实入口（2026-11-13）

- 输入框「＋ → 网页搜索」不再是 `off:true` 的静态占位；点击后切换 `state.webSearch`，菜单显示“已启用 · 本轮会检索网页”。
- 发送会话时携带 `webSearch` 标志；服务端在创建 run 前校验 `CAP-WEB` 是否真实启用、当前网络是否为涉密内网，未通过直接返回 `WEB_SEARCH_DISABLED` / `WEB_SEARCH_NETWORK_BLOCKED`。
- 通过校验后，本轮上下文明确要求优先调用平台 Web 搜索、网页抓取，并在回答中给出真实来源 URL；搜不到必须说明，不能拿模型记忆冒充网页结果。
- 运行轨迹继续记录真实工具调用和步骤，执行过程与引用链接都在会话里可复核。

**实测**：从输入框打开网页搜索，发送“请搜索 DeepSeek Harness 的 GitHub 仓库”，任务 `TR-1794547545749-680` 完成；6 次模型调用，轨迹 `TR-mwejadcj-3c090d` 中出现 26 次 `web_search`，回答返回 [GitHub - deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)。


## 51. Agent Team / Worktree / Auto Review 产品入口（2026-11-13）

- 新增 `GET /api/agent-entries`，从真实运行时插件清单读取三项能力是否启用，前端不再自行写死“可用”。
- 输入框「＋」新增三个入口：
  - **Agent 团队**：填入团队拆解任务，明确要求使用 `tool-agent-team`，先拆并行子任务再汇总。
  - **工作树**：要求使用 `worktree` 工具在隔离工作树内执行，不直接改当前项目目录；没有在线项目时先打开项目选择器。
  - **自动审查**：要求使用 `auto-review` 审查当前项目未提交变更，只出问题、证据与修复建议，不直接改文件。
- 三项入口点击后都会回到新会话输入框并聚焦到可续写位置；用户补充目标后发送，走真实 DSH 运行时，不是假按钮。
- 运行时未启用时入口灰调并显示“运行时未启用”，点击不发送。

**实测**：`GET /api/agent-entries` 返回三项 `enabled:true`（`tool-agent-team`、`tool-worktree`、`auto-review`）；输入框菜单显示三项非灰入口，点击“Agent 团队”后输入框已填入团队任务模板并聚焦。
## 52. 网页搜索来源可点击 + 右侧自带浏览器（2026-11-13）

- `richTextHTML()` 把回答与引用里的 Markdown 链接、裸 `http/https` URL 渲染成 `[data-weblink]` 超链接；链接沿用正文颜色变量并加下划线，不新增页面级样式。
- 点击链接统一交给 `openCloudWebTab()`：展开既有右侧云浏览器面板，创建 `kind:'web'` 标签，标签显示来源域名，面板头部保留“刷新 / 外部打开”。
- 不再依赖 Electron `<webview>`：上一版实测该标签在 Electron 45 下仍是普通 `HTMLElement`，没有 `reload/getURL`，页面空白。改为 Electron 原生 `WebContentsView`，由 `electron/main.cjs` 托管独立网页进程，`preload.cjs` 暴露 `browser.open/bounds/reload/close/openExternal`，渲染层只负责给出面板内 `#cbWebSlot` 的实时位置。
- `WebContentsView` 使用 `contextIsolation:true`、`nodeIntegration:false`、`sandbox:true`；只允许 `http/https` 顶层导航，新窗口请求交给系统浏览器，不加载本地协议。
- 侧栏拖动宽度、窗口缩放、切换标签时都会重新同步原生视图边界；关闭标签或折叠侧栏时移除原生视图，不留下覆盖层。

**实测**：
- 真实会话“搜索 DeepSeek Harness GitHub 仓库”里的回答来源已渲染为 `GitHub - deepseek-ai/deepseek-harness` 超链接，`href=https://github.com/deepseek-ai/deepseek-harness`。
- 点击后 `#cbPanel` 展开，`kind:'web'` 标签创建；主进程返回 `WebContentsView` `attached:true`、`visible:true`、边界 `x=1108,y=135,w=318,h=750`，与 `#cbWebSlot` 的 `getBoundingClientRect()` 完全一致。
- 该视图真实加载 `https://github.com/deepseek-ai/deepseek-harness`，页面标题为 `GitHub - deepseek-ai/deepseek-harness: DeepSeek Harness: Everything is a Plugin. · GitHub`，正文可读；不是空白占位。
- 链接锚点、右侧面板和原生网页视图在 Electron 窗口内同时存在；未改 `public/styles.css`，未改动现有导航、聊天、任务中心等页面样式。
## 53. 工作树管理面板与自动审查语义修正（2026-11-13）

- 新增 `GET /api/worktrees?projectId=...`：只读取项目真实 `git worktree list --porcelain`，返回每个工作树的路径、分支、HEAD、是否主工作树、未提交改动数，以及项目是否为 Git 仓库。
- 新增 `POST /api/worktrees/merge`：只允许把已列出的非主工作树合并到主工作树；合并前校验两侧均无未提交改动，使用 `git merge --no-ff --no-edit -- <branch>`，冲突现场保留并原样返回 Git 输出。
- 新增 `POST /api/worktrees/discard`：只允许移除已列出的非主工作树；使用 `git worktree remove --force`，删除前在主工作树中再次确认路径属于当前仓库，分支保留。
- 输入框“工作树”入口改为打开真实工作树面板：显示项目目录、全部工作树、分支、HEAD 与未提交数；提供复制路径、在此执行、合并、丢弃和“让 Agent 新建工作树”。合并/丢弃均需在行内二次确认，危险操作不会单击直接执行。
- 修正“自动审查”假语义：DSH 的 `auto-review` 是每次工具调用前的实验性权限审查层，不是代码审查报告生成器。入口改名为“自动审查（权限层）”，在本产品中灰调禁用，说明“实验权限层尚未接入”；不再把它当成一个可发送的审查任务。

**实测**：
- 在隔离 Git 仓库中创建主工作树 + `wt-check` 工作树，工作树面板读到 2 条真实记录，主工作树只显示“复制路径”，隔离工作树显示“复制路径 / 在此执行 / 合并 / 丢弃”。
- 在 `wt-check` 提交一次真实改动后，通过面板“合并 → 确认”执行，主工作树生成 `Merge branch 'wt-check'` 合并提交；`git worktree list` 仍保留该隔离工作树。
- 通过面板“丢弃 → 确认”移除该工作树，工作树列表降为只剩主工作树，分支 `wt-check` 保留。
- 非 Git 项目 `PRJ-D1F5D4` 返回 `repo:false` 与明确空态，不伪造工作树。
- 输入框菜单中“自动审查（权限层）”为 `disabled + off`，点击不产生任务；服务端 `GET /api/agent-entries` 同时返回 `enabled:false`、`runtimeEnabled:true`。
- 未修改 `public/styles.css`；工作树面板复用既有 `openModal`、`.mc-block`、`.btn`、`.tag` 与内联样式。
## 54. 审批路径校验与终端进程限额（2026-11-13）

- `autoApprovalAllowed()` 的路径校验从字符串前缀升级为“字符串前缀 + 真实路径”双重判断：先把目标路径和授权目录解析到最近存在的父目录，再比较真实路径。这样在授权目录内创建指向目录外的符号链接时，写入/读取会被转人工审批，而不是仅凭字符串前缀放行。
- 审批矩阵补充外部副作用与破坏性命令：`git push`、`npm/pnpm/yarn publish`、包安装、`curl/wget/Invoke-WebRequest`、`docker rm/rmi/push`、`kubectl delete`、`sc delete`、`reg add/delete`、`takeown`、`icacls` 等不再在“帮我批准”下自动放行。
- 平台开发终端新增进程级限制：
  - 命令超时后使用 `taskkill /T /F` 终止整棵进程树，不再只杀外层 PowerShell；
  - 运行期间每 3 秒采样一次进程树，内存超过 `JG_TERM_MEMORY_MB`（默认 1024 MB）或进程数超过 `JG_TERM_MAX_PROCESSES`（默认 8）时终止并返回“资源限额”原因；
  - 优先尝试 Windows Job Object（`sandbox/job-limit.ps1`）设置内存、活动进程数和 `KILL_ON_JOB_CLOSE`；当前环境因父进程已在 Job 中导致 `AssignProcessToJobObject` 返回失败，自动降级为进程树采样监控。Job Object 可用时状态显示 `job-object`，否则显示 `process-watch`。
- 终端标题栏显示当前限额，但不改 `styles.css`。

**验证**：
- 普通命令真实返回 `hello-limit` 与工作目录。
- 3 秒超时命令被终止，状态为 `open:false`、`timeout:true`。
- 将 `JG_TERM_MAX_PROCESSES` 设为 2，执行会拉起多个子进程的命令，得到真实结果 `终端进程树超过 2 个进程，已终止`、`resourceLimit:true`。
- 未验证：Job Object 在当前嵌套 Job 环境下无法分配成功；DSH 内部工具进程尚未纳入同一套限额，仍只有审批规则和路径校验。## 55. PDF / GIS 独立运行时、云浏览器文件、工作树分支、代码审查与 token 用量（2026-11-13）

- 新增 `pdf.mjs` 与 `vendor/pdf-lib.min.js`（1.17.1），提供真实 PDF 解析、页尺寸、合并、按页范围拆分与文本提取；后端路由 `GET /api/pdf/view`、`POST /api/pdf/inspect|extract|merge|split`。
- 修复 PDF 文本提取的编码判断：纯可打印 ASCII/PDFDocEncoding 文本按单字节解码，UTF-16BE 中文继续按大端转小端；用 pdf-lib 生成的英文样本实测提取为 `JG PDF sample page 1...`，不再输出乱码。
- 新增 `geo.mjs` 与 `POST /api/geo/inspect`，本机解析 GeoJSON 与 ASCII DXF（LINE、LWPOLYLINE、POLYLINE、CIRCLE、TEXT），返回要素数、图层、类型、bbox 与真实 SVG 预览；DWG 明确要求先转 DXF，不伪造原生支持。
- 数据中心标题栏新增“PDF 工具”和“GIS / CAD 工具”。客户端实际选择本地 `.tmp-sample.pdf`（2 页，595×842）后，解析结果显示 2 页并内嵌 `/api/pdf/view` 真实预览；提取文本返回两页英文正文。
- 客户端实际选择 `.tmp-sample.geojson` 后，工具返回 2 个要素、26 个坐标点、范围 `115.9,29.1,116.1,29.3`、WGS84、图层“规划/交通”，并绘制真实 SVG 几何。
- 云浏览器下载记录改为“运行中的下载 + 下载目录真实文件”合并读取：`browser:downloads` 在进程重启后仍能列出 `C:\Users\46198\Downloads\九规智能中枢\cloud-browser-test.txt`，弹窗显示“已完成”以及打开/定位按钮；打开和定位也会解析磁盘记录，不再只查内存。
- 云浏览器下载弹窗、真实文件列表已在客户端 UI 实际打开验收；`转交 AI` 与 `page-info`/`page-text` 桥接仍待真实企业页面端到端点击验收。
- 工作树新增孤立分支识别与删除：`GET /api/worktrees` 的 `branches` 标记当前分支及是否被工作树占用；`POST /api/worktrees/delete-branch` 拒绝当前分支和占用分支，执行真实 `git branch -D`。
- 客户端真实 UI 验收：打开“分支清理验证”项目的工作树面板，看到主工作树与 `wt-branch` 隔离工作树；点击丢弃并确认后出现“孤立分支 · wt-branch / 删除分支”；点击删除并确认后提示“已删除分支 wt-branch”，列表只剩 `master`。
- 新增 `review.mjs` 与 `POST /api/code-review/run`，执行 Node 语法检查、JSON 可解析性检查、硬编码密钥/eval/命令执行/TODO/调试输出规则扫描，并返回文件、行号、证据与 Git 工作区信息。
- 代码审查页改为每次进入都刷新 `/api/projects`，真实 UI 选择项目并运行后显示 160 个文件、语法失败 0、JSON 失败 0、高风险 0、低风险 34（其中包含本轮 `.tmp-*` 测试脚本的调试输出）；清理临时脚本后复跑为 160 个文件、0 命中，并可导出 Markdown。
- `GET /api/usage/summary` 按当前用户真实聚合助手消息 `usage`；账户菜单与设置页“Token 用量”展示真实累计 166,031 tokens、12 次调用、输入 56,243 / 输出 860、缓存读 108,928，按模型 `deepseek-chat` 与最近计量；没有 usage 的轮次明确不计入、不估算。
- 未修改 `public/styles.css`；新增前端版本 `app.js?v=458`。
## 56. 数据格式基座与 Harness 通用代码审查服务（2026-11-13）

本轮按架构归属重做，不把 PDF / GIS / CAD 当作数据中心功能模块，也不把代码审查当作普通页面能力。

**平台格式基座**
- 新增 `formats.mjs`：`FORMAT_REGISTRY` 注册 PDF、GIS/GeoJSON、CAD/DXF 的统一读取与输出能力；`detectDataFormat()` 按扩展名、MIME 与 `%PDF-` 文件头识别格式；`inspectDataFormat()`、`extractDataFormat()`、`exportDataFormat()` 提供解析、内容读取和输出。
- 新增平台接口 `GET /api/formats/capabilities`、`POST /api/formats/inspect`、`POST /api/formats/extract`、`POST /api/formats/export`；旧的 `/api/pdf/*` 与 `/api/geo/inspect` 保留为兼容入口，但新页面不再依赖数据中心路径。
- PDF 输出支持合并与按页范围拆分；GIS 输出规范化 FeatureCollection；CAD 输出 ASCII DXF。PDF 合并、拆分、文本提取均返回真实文件或真实文本；GeoJSON 不做投影转换，DWG 仍需先转 DXF。
- `geo.mjs` 的 `inspectDXF()` 额外返回解析出的 `entities`，供格式基座在 DXF 同格式回写时复用，不改变原有 SVG 预览。
- 数据中心页移除“PDF 工具 / GIS / CAD 工具”按钮；新增“数据格式基座”页（`state.view = 'formats'`，更多菜单入口），明确标注“平台级能力，由数据中心、智能笔记本、Harness Agent 与 MCP 共用”。
- PDF 运行器与 GIS/CAD 运行器标题改为“平台格式基座”；PDF 解析、拆分、文本提取和 GIS/CAD 解析统一调用 `/api/formats/*`。GIS/CAD 运行器新增真实输出按钮：GeoJSON 规范化、DXF 回写，并显示下载链接。
- `data.mjs` 中新增 `formats` 模块并加入所有角色的 `visibleModules`；`codereview` 显示名改为“代码审查服务”，并对员工、访客也开放入口。

**Harness 通用服务**
- 新增 `harness-services.mjs`：`HARNESS_BASE_SERVICES` 注册 `code-review`，`runHarnessService()` 统一执行。服务输入为 `projectId`、`scope`、`maxFiles`，输出真实 `findings`、严重级别、语法检查、JSON 检查与 Git 工作区信息；它是只读分析服务，不是 DSH 的 `auto-review` 权限层。
- 新增 `GET /api/harness/services` 与 `POST /api/harness/services/code-review`；旧 `POST /api/code-review/run` 保留为兼容别名，内部统一调用 `runHarnessService('code-review', ...)`，不再保留第二套审查实现。
- 代码审查页改为调用 `/api/harness/services/code-review`，标题改为“代码审查服务”，说明任意项目、Chat/Work Agent 与 MCP 工具均可调用。

**Agent / MCP 接入**
- `data.mjs` 的 AI 工具清单新增 `format_capabilities`、`format_inspect`、`format_extract`、`format_export`、`code_review`；`mcp-jg.mjs` 同步新增同名 MCP 工具。
- `/api/ai/invoke` 新增平台基础服务白名单：格式操作按真实文件 ID 校验，代码审查按项目可见性校验；不再按数据中心或代码审查模块的 `visibleModules` 拦截。该路由已改为异步处理。
- 平台工具与业务模块解耦：`format_*` 和 `code_review` 不属于数据中心、代码审查页的模块权限；MCP 子进程可通过 `mcp__jg__*` 调用同一基座。

**运行时验证**
- 语法检查：`server.mjs`、`formats.mjs`、`harness-services.mjs`、`mcp-jg.mjs`、`geo.mjs`、`data.mjs`、`public/app.js` 全部通过 `node --check`；期间修复了 `mcp-jg.mjs` 插入工具时遗漏 `task_create` 的 `name` 字段。
- 格式能力：`GET /api/formats/capabilities` 返回 3 项（pdf、gis、cad）。
- PDF：真实 1 页样本解析为 1 页、595×842；`extract` 返回 `Format base PDF A`；`split 1` 输出 898 B `拆分文档-1.pdf`；两个真实 PDF 合并输出 1,051 B `合并文档-合并.pdf`，均由 `putFile()` 写入文件库并返回 `/api/files/download?id=...`。
- GIS：真实 GeoJSON 解析为 2 个要素、图层“规划/交通”、bbox `[115.9,29.1,116.1,29.3]`；`normalize` 输出 929 B 规范化 `.geojson`。
- CAD：真实 ASCII DXF 解析为 4 个实体、图层“道路/交叉口/标注”、类型 LINE/CIRCLE/TEXT、bbox `[0,0,100,60]`；`normalize` 输出 245 B 63 行 ASCII DXF。
- 代码审查：以临时项目绑定本工程根目录执行 `/api/harness/services/code-review`，真实扫描 175 个源码文件，语法失败 0、JSON 失败 0，命中 5 条低风险（均为 `todo-marker` / `debug-console` 类静态提示）；验证项目已清理，数据库不留测试项目。
- 前端：`app.js?v=460`；数据格式基座页已打开并截图 `D:\project-test3\shots\format-base-page.png`；PDF 真实解析预览截图 `D:\project-test3\shots\format-pdf-current.png`。旧版数据中心页已无 PDF/GIS 入口。
- 未修改 `public/styles.css`。

**边界**
- 格式基座当前不提供“从文字生成 PDF”“从要素集直接生成 GIS 图层”“投影转换”等未实现能力；只做同格式合并/拆分、规范化与 DXF 同格式回写。
- 代码审查是服务，不是 `auto-review` 权限层；`auto-review` 仍保持未开启。
- 代码审查服务控制台截图 `D:\project-test3\shots\code-review-service.png`；标题与说明已切换为 Harness 通用基础服务。

## 57. 管理中心 AI 能力归类（2026-11-13）

本轮把平台能力清单按“数据格式基座属于平台公共能力、代码审查属于系统内核”重新归类，界面只呈现真实存在的模块。

**平台公共能力**
- 原来的单项 `CAP-OFFICE`「Office / PDF 文档处理」拆成四项：`CAP-OFFICE`「Office 文档处理」、`CAP-PDF`「PDF 文档处理」、`CAP-GIS`「GIS 空间数据」、`CAP-CAD`「CAD 图纸数据」。
- Office 保留 `module: dsh-skill-office` 与 `sourceIds: ['skill-office']`，运行时状态沿用 DSH 实际加载结果。
- PDF / GIS / CAD 使用 `module: formats.mjs#pdf|gis|cad`，分别展示真实权限：PDF 解析、文本提取、按页拆分、合并与导出；GIS 的 GeoJSON 读取、要素/图层/bbox 与规范化输出；CAD 的 ASCII DXF 实体/图层/bbox 与 DXF 回写。
- 这三项新增 `runtime: 'product'`：`formats.mjs` 由 `server.mjs` 直接导入并注册，属于产品级真实模块，不是 DSH 运行时清单里的条目；据此不伪造 `sourceIds`，也不把界面写成“未加载”。
- 平台公共能力从 7 项变为 10 项：Office、PDF、GIS、CAD、业务系统接入、Python、会话检索、Web 搜索、后台作业、Agent 编排。

**系统内核**
- 新增 `CAP-CODEREVIEW`「代码审查服务」，`module: harness-services.mjs#code-review`，`runtime: 'product'`，`layer: 'kernel'`、`stoppable: false`。
- 权限为只读源码扫描、语法检查、JSON 校验、静态规则提示；资源上限 1 核 / 512MB / 300s / 并发 1。
- 代码审查进入 `/api/admin/official-baseline` 的 `infrastructure`，不出现在 `/api/platform-capabilities`；与 `CAP-FILES` 一样不可停用或卸载。
- 系统内核从 3 项变为 4 项：文件附件与交付物、代码审查服务、Harness 基础运行时、Harness SDK 应用层。

**验证**
- `server.mjs` 通过 `runtime\node.exe --check`。
- 重启客户端后以云端浏览器打开管理中心「AI 能力管理」：系统内核显示 `4 / 4`，平台公共能力显示 `10 / 10`。
- 系统内核明细可见「代码审查服务 · 基础能力 · harness-services.mjs#code-review · 已启用」；平台公共能力明细可见 Office、PDF、GIS、CAD 四行，对应运行时模块分别为 `dsh-skill-office`、`formats.mjs#pdf`、`formats.mjs#gis`、`formats.mjs#cad`。
- 截图 `D:\project-test3\shots\capability-classification.png`（系统内核）、`D:\project-test3\shots\platform-formats.png`（四类数据格式）。
- 未修改 `public/styles.css`；本次未触碰 Office、PDF、GIS、CAD 的实际读写实现，只调整能力清单与归类。

## 58. 恢复云浏览器入口（2026-11-13）

`render()` 曾把整个 `#topbar` 无条件设为 `hidden`，导致放在顶栏右侧的 `#cbToggle`「展开云浏览器」按钮随之消失；按钮本身和云浏览器侧栏都还在。

- 改为 `topbar.hidden = !cloudAllowed()`：首页、对话、任务、知识库、学习中心显示顶栏和云浏览器开关，其他不适用云浏览器的视图继续收起顶栏。
- 开关仍调用原有 `toggleCloudPanel()`，点击后右侧 `#cbPanel` 正常展开，按钮标题切换为“折叠云浏览器”。
- `public/app.js?v=463`；语法检查通过。
- 云端浏览器打开首页验证：按钮尺寸 30×30、位于右上角；点击后 `#cbPanel` 宽度 165px，侧栏正常显示。
- 截图 `D:\project-test3\shots\cloud-browser-toggle-restored.png`、`D:\project-test3\shots\cloud-browser-panel-restored.png`。



## 59. 首页侧边栏悬浮卡片与 SHP / GDB 真实解析（2026-11-13）

**侧边栏**
- `public/app.js` 的 `renderSidebar()` 增加品牌标题下拉箭头、搜索按钮、通知按钮；在“新聊天”后增加分隔线，置顶区标题使用 `sb-section-head`；保留项目、分区与最近结构。
- 新增 `public/sidebar-chatgpt.css`，按参考图实现悬浮卡片：`.sidebar:not(.tk-sidebar)` 外边距 `10px 6px 10px 8px`、高度 `calc(100% - 20px)`、白底、16px 圆角、细边框与阴影；`#sbGrip` 绝对定位在卡片右边缘，悬停/拖动时加深。
- 卡片宽度较窄时用容器查询隐藏品牌图标，避免“九规智能中枢”折成三行；`app.js?v=465`，`sidebar-chatgpt.css?v=1`。
- 云端浏览器验证：右侧缩放边可从约 150px 拖到 218px，标题保持单行，卡片圆角、留白、阴影和顶部分区线均生效；截图 `D:\project-test3\shots\sidebar-chatgpt-card.png`。

**GIS 数据格式**
- 新增 `gis-bridge.py`：通过 `pyogrio.list_layers`、`read_info`、`pyogrio.raw.read` 读取 Shapefile / File Geodatabase；用 `shapely.wkb.loads` 转 GeoJSON，保留每要素的图层名、FID 与全部属性字段，最多每层读取 2000 个要素。
- 新增 `gis-datasets.mjs`：接收 `.zip`，用 Windows `tar`（失败回退 `python -m zipfile`）解压，递归查找 `.shp` 或 `.gdb`，调用桥接后用既有 `inspectGeoJSON` 生成 bbox、要素数、字段和 SVG 预览；`export` 输出规范化 GeoJSON。
- `formats.mjs` 的 GIS 注册项改为 `GIS / GeoJSON / SHP / GDB`，扩展名增加 `.shp/.gdb/.zip`；`detectDataFormat`、`inspectDataFormat`、`extractDataFormat`、`exportDataFormat` 增加 ZIP 分支；`server.mjs` 的 `/api/formats/extract` 改为 async，AI `format_extract` 同步 await。
- `public/app.js` 的 `openSpatialTool()` 文件选择器支持 `.zip`，界面写明 Shapefile 需把 `.shp/.dbf/.shx/.prj` 打成一个 ZIP、GDB 需把整个 `.gdb` 文件夹打成一个 ZIP；结果区显示属性字段、图层明细、只读说明和预览条数。
- 运行依赖位于 `vendor\gis`：`pyogrio 0.13.0`（GDAL 3.12.4）、`shapely 2.2.0`、`numpy 2.5.4`、`certifi`、`packaging`；运行时设置 `PYTHONPATH=D:\project-test3\jg-client-1.0\vendor\gis`，可用 `JG_GIS_PYTHON` 指定 Python。

**真实验证**
- SHP：`test-shp.zip`（651 B）经页面选择后解析为 Shapefile (SHP)，2 个点要素、字段 `name`、`EPSG:4326`、bbox `[115.9,29.1,116.1,29.3]`，SVG 预览正常；输出 `test-shp-规范化.geojson`，下载 265 B，内容含 `name=A/B`。
- GDB：`test-gdb.zip`（46,508 B）经页面选择后解析为 File Geodatabase (GDB)，7 个 MultiPolygon、图层 `TEST_PL_FGDB`、字段 `FIELD/GLOBALID/CREATED_USER/.../Shape_Area`、`EPSG:31254`，SVG 预览正常；输出下载 37,550 B，首要素属性包含全部源字段，不再是空属性。
- 页面 `inspect` 走真实会话与上传接口；导出结果通过 `bu.download` 下载并回读 JSON 校验。SHP/GDB 只读，输出仅支持规范化 GeoJSON；直接上传 `.shp` 单文件或 `.gdb` 文件夹仍不支持，必须打 ZIP。
- `gis-datasets.mjs`、`formats.mjs`、`server.mjs`、`public/app.js` 均通过 `runtime\node.exe --check`。
- 修复导出结果文件大小显示为 `0 KB` 的格式化问题；小于 1 KB 显示为字节。

## 60. 更多菜单清理（2026-11-13）

- 从 `MORE_ITEMS` 移除「数据格式基座」和「代码审查服务」；这两个模块不再作为「更多」菜单入口出现。
- 「综合管理」图标由重复使用的 `shield` 改为独立的 `briefcase` 图标。
- 对历史 localStorage 中的 `morePinned` 增加存在性过滤，避免已移除模块留下空置顶项。
- `public/app.js?v=466`，`runtime\node.exe --check` 通过；云端浏览器打开客户端确认菜单仅保留：智能笔记本、教学园地、智能投标、综合监测、城市体检和更新、人事组织、审图平台、财务管理、综合管理。
- 截图 `D:\project-test3\shots\more-menu-clean.png`。

## 61. 侧边栏滚动区域下移到横线（2026-11-13）

- 将「新聊天」按钮和分隔线从 `.sidebar-scroll` 移到独立的 `.sb-top-actions`，品牌行、新聊天、分隔线保持固定，不随会话列表滚动。
- `.sidebar-scroll` 改为从分隔线下方开始，滚动条轨道只覆盖置顶、项目和最近区域；顶部没有滚动轨道。
- 云端浏览器实测：分隔线底边 `y=138`，滚动区顶边 `y=138`；新聊天 `y=91–125` 位于滚动区外；滚动内容高度 1340px、可视高度 618px，滚动正常。
- `public/app.js?v=467`、`sidebar-chatgpt.css?v=2`；`runtime\node.exe --check public\app.js` 通过。
- 截图 `D:\project-test3\shots\sidebar-fixed-newchat.png`。

## 62. 侧边栏改为参考图的平铺白底样式（2026-11-13）

- 按新参考图去掉悬浮圆角卡片：侧栏改为全高平铺白底，外边距 0、圆角 0、阴影改为右侧 1px 分隔线。
- 品牌标题加大到 19px / 600，新聊天改为透明底、无药丸圆角，仅在悬停时显示浅灰反馈。
- 新聊天与分隔线仍固定在顶部；滚动区域仅从分隔线下方开始。
- 会话区滚动条改为参考图样式：12px 宽、白色轨道、灰色圆头滑块、上下箭头按钮，轨道只在会话列表区域出现。
- 实测新聊天常态背景为 `rgba(0,0,0,0)`，侧栏圆角 0、外边距 0，右侧分隔线生效；`app.js?v=467`、`sidebar-chatgpt.css?v=4`。
- 截图 `D:\project-test3\shots\sidebar-chatgpt-flat.png`。

## 63. 审批策略改为 DSH 原生权限预设（2026-11-13）

- 不再由 `approval-rules.mjs` 自定义 allow/deny 矩阵。Auto 直接使用 DSH `workspace-write`：工作区内读写、测试、构建由 DSH 沙箱直接执行；越界、外部写入和权限升级才发 `approval/request`。手动模式保持 DSH `read-only`。
- Chat 模式强制 `read-only`，即使审批方式为 Auto 也不允许写文件或执行有副作用的命令；需要审批时由服务端拒绝并提示切换到 Work。
- `approval-rules.mjs` 只保留操作类型、风险级别和参数摘要，用于审批卡展示与 `approval_decisions` 审计。
- 实测：Chat 模式创建文件被拒绝；Work 模式在 workspace 内创建文件无审批直接完成；`D:\project-test3\outside\dsh-outside.txt` 触发审批，拒绝后文件未创建；`approval_decisions` 记录 `dsh-workspace-write-escalation` 和 `chat-mode-no-escalation`。
- `node --check harness.mjs/server.mjs/approval-rules.mjs` 通过；14 条审批元数据用例通过；服务 PID `64596`，`/api/health` 200。

## 64. 手动审批闭环与审批胶囊文案（2026-11-13）

- 手动工作模式的端到端验证：DSH 只读策略对写入发起 `dsh-read-only-approval`，审批记录 `APD-0c221f579510`，允许后写入成功，`decision=allowed`、`approver=米乐`。
- 手动模式不再让模型先发 `ask_user_question` 申请授权，改为直接发起工具调用，由 DSH 生成审批请求；避免一次写入出现两次确认。
- 输入框内的待审批胶囊文案由「请求批准」改为「待批准」，与审批方式按钮「请求批准」区分。
- 重启时会将该进程遗留的 `pending` 审批记录收口为 `expired`、`approver=system-restart`，避免审计列表长期显示待审批。
- `public/app.js?v=531`；`node --check public/app.js` 通过；服务 PID `49484`，`/api/health` 200。

## 65. 前端审批语义对齐（2026-11-14）

- 输入框左侧策略胶囊：工作模式下显示「帮我批准」或「请求批准」；对话模式下固定显示「只读」并禁用，提示“对话模式固定只读，切换到工作模式后可选择审批方式”。
- 策略菜单说明改为 DSH 真实边界：请求批准=工作区内写入与执行也逐次确认；帮我批准=工作区内直接执行，越界或升级才确认。
- 待审批胶囊文案为「待批准」，弹出层展示工具、参数摘要、风险级别与审批规则，再提供“允许本次执行/拒绝本次执行”。
- 审批决策落库仍通过 `GET /api/approval-decisions` 查询，管理端审批决策列表 UI 尚未实现。
- `public/app.js?v=532`；`node --check public/app.js` 通过；对话模式已实测显示禁用的「只读」胶囊。

## 66. 三项模型侧能力真实部署与验证（2026-11-14）

- 关键修正：产品实际按账号使用独立 DSH Home（`data\agents\<userId>\dsh-home`），不再是全局 `data\dsh-home`。账号首次创建时只复制一次 profile；之后全局模板改动不会同步到已有账号。此前管理页显示 enabled 但模型仍盲写，根因是管理页/探针读全局 Home，实际会话读账号 Home。
- 已在真实账号 profile `data\agents\A-7788-01\dsh-home\profiles\sdk\cordis.patch.yml` 和全局模板 `data\dsh-home\profiles\sdk\cordis.patch.yml` 同时加入：
  - `fs-observation-policy` 基础项 `disabled: true`，插入 `fs-observation-policy-guard`；`write/edit/delete` 对已存在但未读文件返回 `FS_NOT_OBSERVED`，新建允许。
  - `tool-executor-native` `disabled: true`，插入 `tool-executor-ptc-enabled`（`@deepseek-ai/dsh-tool-executor-ptc`，`maxParallelSubCalls: 10`）；PTC 激活后模型只直接看到 `run_code`。
- 实际验证（真实账号，非隔离探针）：
  - fs guard：会话 `C-1794587125458454` 中 `fs-guard-real.txt` 初始 `real-original`，模型只允许 `write` 盲覆盖；返回 `cannot modify ... file has not been read — read the file, then retry`，文件保持 `real-original`，未改用 pwsh/apply_patch/edit。随后已清理测试文件。
  - Agent Team：会话 `C-1794588396296389`，`spawn_teammate` 创建 `probe`，`send_message` 收到 `OK`；子会话 `eb5b2fbe-5eed-4310-8546-dc885820561f`，`provider=spawn`、`status=ok`、`stopReason=completed`。
  - PTC 只读：会话 `C-1794588709451926`，`run_code` 执行 `console.log(1 + 1)` 返回 `2`，无审批，步骤中只有 `run_code`。
  - PTC 工作区写：会话 `C-1794588922981153`，`run_code` 内嵌 `tools.write` 创建 `ptc-nested.txt`，无审批，`workspaceChanges` 记录新增；验证后已清理该文件。
  - PTC 越界写：同一会话第二回合，`run_code` 内嵌 `tools.write` 写 `D:\project-test3\ptc-guard.txt` 被 `workspace-write` 拒绝（`file access denied under workspace-write mode`），未改文件、未弹审批、未请求 danger-full-access。
  - PTC 下 fs guard：同一会话第三回合，`run_code` 内嵌 `tools.edit` 修改未读的 `fs-edit-guard.txt` 被拒绝（`file has not been read — read the file, then retry`），文件保持 `edit-original`；验证后已清理。
  - PTC 下 Agent Team：同一会话第四回合，模型经 `run_code` 调用 `tools.spawn_teammate` 创建 `probe2`，`tools.send_message` 发送，`tools.wait_agent` 等待，返回 `OK`；子会话 `102b3af9-7299-4fc6-acbf-7a514869495a`，`provider=spawn`、`status=ok`、`stopReason=completed`。说明 PTC 与 Agent Team 可共存。
- 修复 Windows 工作区 ACL：DSH `workspace-write` 启动时需要给工作区目录追加 capability ACE，要求目录具备 `WRITE_DAC`；默认继承的 `Modify` 不含该权限，会让 `run_code`/`pwsh` 以 Win32 5 启动失败并申请 `danger-full-access`。`server.mjs` 的 `chatWorkspaceDir()` 现在在创建会话目录后调用 `ensureWorkspaceAcl()`，只给当前登录用户本人补 `(OI)(CI)F` 显式完全控制，不向其他账号开放。修复后 PTC 只读/工作区写均无审批直接成功。
- 边界与未验证项：
  - `fs-observation-policy` 只覆盖 `write/edit/delete` 等 fs 工具，不覆盖 `pwsh` 等 shell 写入；shell 绕过仍是明确边界。
  - PTC 嵌套工具在 `workspace-write` 下按自身策略拒绝越界；申请 `danger-full-access` 时审批卡定位到嵌套的 `write`，而不是外层 `run_code`，说明并非“外层一次批准就放行整个程序”。首次批准后 fs guard 仍要求先读，文件未被盲写；第二次批准被拒绝后文件保持原样。
  - 嵌套工具审批只带 `toolName/reason`，不带嵌套参数；已把 `reason` 回填为参数摘要，并在放宽沙箱时把展示风险标为 high。审批卡仍无法显示嵌套工具的精确路径/内容。
  - 管理端审批决策列表 UI、Agent Team roster/任务板、手动审批真实 pending 视觉复验仍未完成。
- 服务重启后 PID `62472`，`/api/health` 200；`server.mjs`、`harness.mjs`、`dsh-fs-observation-policy/lib/index.js` 均通过 `node --check`。已清理 `fs-guard-*`、`ptc-*` 测试文件、`fs-policy-debug.log` 和临时 `probe-*.mjs`。

## 67. 账号级运行时管理与基线同步（2026-11-14）

- `/api/runtime/plugins` 的 GET/POST 改为使用当前管理员账号的 `ensureUserDshHome(user.id)`：dump 与 profile patch 都从同一个账号 Home 生成/写入，不再读全局 `data\dsh-home`。接口返回的 `source` 已改为“按当前账号 DSH_HOME 生成”。
- `/api/bootstrap` 与 `/api/settings` 的 `runtimeOverview()` 也接收账号 Home；`configPath`、`credentialsPath`、`skillsDir`、插件清单反映真实账号运行时。
- `ensureUserDshHome()` 新增 `ensureManagedModelPlugins(home)`：对已有账号按“缺什么补什么”幂等补齐 fs guard 与 PTC 执行器；账号已显式停用的条目保留原配置，不整文件覆盖。
- 服务启动时遍历 `listAccounts()` 调用 `ensureUserDshHome(account.id)`，让已有账号在重启后获得平台级模型能力基线，而不是等首次建号才复制。
- `runtimeDumpPath(home)` 把配置快照按 Home 隔离：账号 Home 写 `dsh-dump-config.txt`，全局 `data\dsh-home` 保留历史 `data\dsh-dump-config.txt`。`refreshRuntimeConfigDump`、`runtimePluginInventory`、`runtimeOverview` 共用同一路径函数，避免两个账号并发刷新互相覆盖。
- `platformCapabilities(home)` 改为可接收账号 Home；`/api/bootstrap`、`/api/platform-capabilities`、`/api/admin/official-baseline`、平台能力启停、Web 搜索校验和 `/api/console` 都改为使用 `accountRuntimeHome(user)`，不再按全局清单判断当前账号。
- 实测：重启后 `/api/runtime/plugins` 返回 `fs-observation-policy-guard=true`、`tool-executor-ptc-enabled=true`，`fs-observation-policy/tool-executor-native/tool-executor-ptc` 均 `false`；A-7788-01 的 patch 仍只有一份 guard/PTC 条目，未重复追加。
- 实测账号 dump 文件位于 `data\agents\A-7788-01\dsh-home\dsh-dump-config.txt`（16994 字节），全局 `data\dsh-dump-config.txt` 保持独立（16909 字节）；`/api/bootstrap`、`/api/console`、`/api/admin/official-baseline` 均 200。
- 未完成：`ops` 目录不是有效账号，启动同步不会覆盖它；若以后恢复该账号，需要正常走账号创建/登录路径。
- 服务重启后 PID `68416`，`/api/health` 200；`server.mjs` 通过 `node --check`。

## 68. 普通设计师账号“米乐乐”（2026-11-14）

- `data.mjs` 新增 `roles.designer`：`label=普通设计师`，`duty=规划设计师`，`unit=规划一所`，模块与普通员工一致，`scopes=['public','internal','unit:规划一所']`，不含 `admin`。
- 新增真实账号 `A-7788-02`：`name=米乐乐`、`role=designer`、`unit=规划一所`、`duty=规划设计师`，写入 SQLite `accounts` 表，不走演示角色冒充。
- `/api/bootstrap` 的 `allRoles` 改为真实账号列表（`listAccounts()` + `userOfAccount`），账号切换菜单从“角色”改为“账号”，显示“2 个账号可选”。
- `/api/login` 支持用账号 id 登录：`getAccount(body.accountId)` 优先，`getAccount(body.role) || getAccountByRole(body.role)` 兼容旧的角色名登录。
- 实测：
  - 用 `{role:'A-7788-02'}` 登录返回 200，用户 `id=A-7788-02`、`name=米乐乐`、`label=普通设计师`、`unit=规划一所`、`visibleModules=26`、`scopes` 正确。
  - 新账号自动创建 `data\agents\A-7788-02\dsh-home`，`cordis.patch.yml` 55 行，包含 fs guard 与 PTC 基线。
  - 新账号 `/api/model/config` 返回 200，使用统一模型网关；`/api/runtime/plugins` 返回 403（非管理员，符合权限边界）。
  - 浏览器账号菜单显示“米乐乐 普通设计师 · 规划一所 当前”。
- 前端 `app.js?v=533`；`node --check public/app.js` 通过。服务 PID `65408`，`/api/health` 200。（该 PID 为第 68 节记录时的历史值，当前服务 PID 见第 69 节。）

## 69. 产品可见性三项与视觉回归收口（2026-11-14）

- 审批决策列表：管理中心「安全与审计」页改为真实 `approval_decisions` 数据。`/api/console` 的 `security` 段提供 6 个 KPI（审批决策、待处理、高风险、已拒绝、已通过、已过期），不再返回占位表格；前端 `renderAdmin` 在 `tab==='security'` 时读取 `GET /api/approval-decisions?limit=50`，按卡片行展示时间、工具、操作、决定、操作人、命中规则、风险与完整摘要，避免长 PTC 原因在窄列逐字换行。
- 决定值映射：`allowed/allowed-once→已通过`，`pending→待审批`，`reject/deny→已拒绝`，`cancel→已取消`，`expire→已过期`；前端 `STATUS/WARN/BAD` 正则同步加入新中文状态。
- Agent Team 任务板：`harness.mjs` 新增 `subagentTasksOf(audit)`，从 `run_code` 审计的 `spawn_teammate` 代码中提取 `name/description`，按启动顺序映射到 `subagentsOf`；同时修复审计 `detail` 在 800 字符处截断后 `JSON.parse` 失败的问题，改为先还原转义再正则提取。前端 `subagentBlock` 改为默认展开的「Agent Team · 任务板」，卡片显示状态、代理名、childSessionId 前 8 位、任务说明、输出摘要和结束原因。
- PTC 审批摘要：`openApprovalMenu` 改为结构化「审批摘要」卡片，展示工具、操作、目标、风险/规则、摘要和「仅本次」；无参数时不再一概标为“PTC 嵌套”，只有 `callId` 以 `:ptc:<n>` 结尾时认定 PTC 嵌套并加标签；所有仅含升级原因的无参数审批都显示“工具未回传精确参数，以上摘要来自运行时升级原因，不冒充完整参数”。
- 实测：
  - `/api/console` 的 security 段返回 6 个 KPI；截图时 `approval_decisions` 12 条，已拒绝 5、已通过 3、已过期 2、高风险 2；PTC 复验新增 2 条后为 15 条（reject/deny 7、allowed 4、cancel 2、expire 2，高风险 4）。管理中心列表按卡片式渲染，摘要列占满整行。
  - 真实工作区外写入审批：弹层显示 `write / write / 高风险 · DSH 工作区越界升级`，摘要说明升级原因，无“PTC 嵌套”误标；拒绝后未产生文件，审批记录落库为已拒绝。
  - PTC 嵌套审批：工作模式下外层 `run_code` 先批准执行，随后嵌套 `write` 弹出「审批摘要」，顶部显示 `PTC 嵌套`、`仅本次`，明细为 `write / write / 高 · DSH 工作区越界升级`，摘要为完整升级原因并附“未回传精确参数”说明；拒绝后 `ptc-approval-ui2.txt` 不存在，记录落库为已拒绝，`callId` 以 `:ptc:1` 结尾。
  - 新 Agent Team 会话：`spawn_teammate` 创建 `probe474`，子会话 `37cd5709-...`，任务板显示“完成 / probe474 / 37cd5709 / Minimal probe teammate that replies only OK / OK / 结束原因 completed”，1/1 已结束。
  - 718×763 视口下 6 个 KPI 排成 3+3，不再出现 3+1；默认蓝色与绿色强调色均已截图复核，选中态、卡片和状态标签不变形。
- 入口与边界：审批决策列表仍在管理中心「安全与审计」，不是独立一级导航；列表当前只读，未做按工具/决定/风险筛选、完整参数展开和导出；`GET /api/approval-decisions` 仍仅管理员可读，非管理员 403。
- 前端入口 `app.js?v=539`；`server.mjs`、`harness.mjs`、`public/app.js` 均通过 `node --check`。服务 PID `47492`，`/api/health` 200。


## 70. 正式账号密码登录、首次强制改密与记住账号密码（2026-11-14）

- 账号密码存储：`accounts` 表新增 `password_hash`、`must_change_password`、`password_updated_at`；旧库用 `ALTER TABLE` 幂等补列。密码只存 `scrypt$salt$hex` 哈希，不落明文；`mapAccount` 对外只暴露字段，登录用户对象不带哈希。
- 默认密码规则：新增 `pinyin-pro` 依赖，`defaultPasswordForName()` 用 `pinyin(name,{toneType:'none',type:'array'})` 取姓名全拼、首字母大写后拼 `@123`。当前实测：米乐和米乐乐均按该规则生成初始密码（此处不记录明文）；以后新增中文姓名也按全拼生成，不再回退账号编码。
- 启动迁移：`ensureAccountPasswords()` 在 `seedLocalAccounts()` 后执行，只给 `password_hash` 为空的账号写初始密码并置 `must_change_password=1`，不覆盖已改过的密码。
- 登录接口：`POST /api/login` 必须同时提供账号与密码；按 `accountId` 或兼容 `role` 找到真实账号，缺密码返回 `PASSWORD_REQUIRED`，校验失败返回 401 `BAD_CREDENTIALS` 并写 deny 审计；成功返回 `{ok,user,accountId,mustChangePassword}`。不再回退演示角色。
- 首次强制改密：`GET /api/bootstrap` 新增 `mustChangePassword`；非公开 API 在会话账号 `must_change_password=1` 时返回 403 `PASSWORD_CHANGE_REQUIRED`，仅放行 `POST /api/account/password`。前端 `renderViewInner()` 在 `authed && mustChangePassword` 时直接渲染「首次登录 · 设置密码」，无法先进入业务页面。
- 改密接口：`POST /api/account/password` 接收 `{currentPassword,nextPassword}`，从 `jg_sid` 会话取账号，校验当前密码，要求新密码 8–64 位且至少含字母和数字，禁止与原密码相同；成功后更新哈希、置 `must_change_password=0`，写 `auth.password.change` 审计。
- 设置页入口：个人资料 → 安全新增「登录密码 / 已设置 / 修改密码」，复用同一改密接口；设置搜索项同步加入“登录密码”。
- 记住账号密码：登录页新增密码输入、`记住账号和密码` 复选框、行内错误提示；`localStorage` 键为 `jg.login.account`、`jg.login.password`、`jg.login.remember`。勾选后登录成功保存账号与密码，重新打开登录页回填并选中账号；不勾选则清除已保存值。密码以明文存于本机浏览器，是用户明确要求的功能取舍。
- 账号切换：账号菜单「切换账号」改为「登录其他账号」，点击后先退出当前会话再回登录页；删除前端 `switchRole()` 免密登录路径，避免密码校验被绕过。
- 首次登录与设置页共用同一套页面样式：`setLoginChrome()` 隐藏侧栏/菜单/顶栏并让登录卡片全屏居中，未修改 `public/styles.css`，黑白灰与强调色风格保持一致。
- 实测：
  - `A-7788-02` 用初始密码登录 200，`bootstrap.mustChangePassword=true`；随后 `GET /api/conversations` 返回 403 `PASSWORD_CHANGE_REQUIRED`，证明服务端强制改密生效。
  - 管理员米乐首次登录强制页用初始密码完成改密并进入首页；设置页再改一次密码成功，审计新增两条 `auth.password.change` allow。
  - 错误密码在登录页显示「账号或密码不正确」，不建立会话；`auth.login` deny 落库。
  - 勾选记住密码后，退出重进登录页自动选中账号并回填密码；切到米乐乐时密码清空；米乐乐登录后进入强制改密页。
  - 退出后账号菜单的「登录其他账号」回到登录页，不再出现免密切换账号。
  - SQLite 核对：`A-7788-01` 哈希长度 168、`must_change_password=0`；`A-7788-02` 哈希长度 168、`must_change_password=1`（未替用户改密）。
- 当前测试态：管理员米乐密码已在验收中改为测试密码（此处不记录明文），米乐乐仍为初始密码状态且首次登录必须改密。需要恢复管理员初始密码时，把 `A-7788-01` 的 `password_hash` 清空并重启服务即可重新生成初始密码。
- 前端 `app.js?v=543`；`server.mjs`、`db.mjs`、`public/app.js` 均通过 `node --check`。服务 PID `38960`，`/api/health` 200。
- 截图：`C:\Users\46198\AppData\Local\Temp\jg-login-page.png`（登录页）、`jg-login-3.png`（首次强制改密）、`jg-milele-first.png`（米乐乐强制改密）、`jg-pwd-changed.png`（设置页改密成功）。
- 未单独验证：取消勾选后清除已保存值的 UI 操作；接口侧已实测当前密码错误 401、弱密码 400。


## 71. 登录页姓名全拼用户名、输入框满宽与算术验证码（2026-11-14）

- 本节取代第 70 节中“账号卡片 + accountId”的登录入口；密码哈希、首次强制改密、设置页改密、服务端强制改密拦截与记住密码策略保留。
- 输入框满宽：根因是 `.mini-input` 自身带有 `max-width:210px`，此前只写 `width:100%` 仍被压缩。登录页三处输入均加 `width:100%!important;max-width:100%!important;box-sizing:border-box`；登录卡片改为 440px，718px 视口下实测卡片 x=139、输入框宽 386px，卡片与输入框均居中满宽。首次登录改密页同步修正为 440px 卡片与满宽输入。
- 登录用户名：`accounts` 表新增 `username`、`phone` 两列，旧库按现有 `duplicate column name` 模式幂等补列；`ensureAccountUsernames()` 在启动时按姓名全拼生成小写用户名（`pinyin-pro`），已实测 `A-7788-01= mile`、`A-7788-02= milele`。
- 登录查询：`getAccountByUsername()` 先按 `lower(username)=lower(?)` 查，再按非空 `phone` 查，为后续“姓名全拼/绑定手机号”共用入口；`POST /api/login` 优先接收 `{username,password,captchaId,captchaAnswer}`，保留 `accountId` 兼容旧调用。用户名大小写不敏感，实测 `Mile` 可登录米乐。
- 验证码：新增公开 `GET /api/captcha`，服务端内存 Map 生成 5 分钟有效的一次性算式；随机 `+ - × ÷`，减法保证非负、除法保证整除，返回 `{captchaId,question}`。登录必须携带验证码，缺失返回 400 `CAPTCHA_REQUIRED`，错误/过期/重复使用返回 400 `BAD_CAPTCHA`。前端显示算式、输入框与“换一个”按钮；登录失败自动换题并清空答案。
- 记住账号密码：storage 增加 `jg.login.username`，继续使用 `jg.login.account`、`jg.login.password`、`jg.login.remember`；旧版只存 accountId 的记录会用 `/api/bootstrap.allRoles` 中的 username 迁移回填。切换用户名时自动清空旧密码；勾选并在登录成功后保存，不勾选登录成功时清除。
- 实测：
  - 718×763：登录页卡片 440px、x=139，用户名/密码/验证码输入框 386px；首次改密页同样 440px、输入 386px。
  - `Mile`（大写）登录米乐 200，返回 `username:"mile"`；`/api/bootstrap.allRoles` 为 `mile/米乐`、`milele/米乐乐`。
  - 米乐乐用 `milele` 登录 200，`mustChangePassword=true`，随后 `/api/conversations` 403 `PASSWORD_CHANGE_REQUIRED`，首次改密页正常渲染。
  - 错误密码返回“用户名或密码不正确”；错误验证码返回 400 `BAD_CAPTCHA`，前端自动换题并显示“验证码不正确，已换一个，请重新填写”。
  - 同一验证码成功后再次使用返回 400 `BAD_CAPTCHA`；除法题 `30 ÷ 5 = 6` 登录成功；一次错误密码后题目由 `7 - 2` 换为 `17 - 11`。\n  - 取消勾选“记住账号和密码”后，`jg.login.username/account/password/remember` 四个键立即清空；重新勾选并登录后再次保存。
  - SQLite：`username`/`phone` 已迁移，米乐 `mile`、米乐乐 `milele`；密码哈希长度仍为 168，`must_change_password` 状态未被本次改动改写。
- 当前状态：服务 PID `66992`，`/api/health` 200；前端 `app.js?v=548`；管理员米乐已登录首页；米乐乐仍为初始密码状态且 `must_change_password=1`，首次登录会进入改密页。
- 未实现/未验证：手机号绑定 UI 与手机号数据尚未提供，当前只完成 `phone` 字段和登录查询入口；验证码 5 分钟过期仅由代码路径保证，未做等待 5 分钟的时钟验证。
- 截图：`C:\Users\46198\AppData\Local\Temp\jg-login-new2.png`（满宽登录页）、`jg-milele-firstnew2.png`（满宽首次改密页）、`jg-captcha-bad.png`（验证码错误与自动换题）。



## 72. 管理中心“系统设置”：基础配置可写、版本/环境只读（2026-11-14）

- 目标：落实管理中心“系统设置”子模块，不做通知规则引擎和未定义的细粒度功能开关；只接入真实运行时数据。
- 服务端：`GET /api/console` 的 `settings` 段返回 `writable`、`basic`（`defaultPolicy`、`defaultEffort`、`workspaceChanges`）、`version`（产品/前端/Electron/Node/DSH/端口）、`environment`（当前网络/可用网络/模型网关/API Key 状态/数据库/运行时快照）和网络列表；版本取自 `package.json`、`node_modules/electron/package.json`、`public/index.html`、`process.version` 与 `runtimeOverview()`，不是手写演示值。
- 基础配置写入复用 `POST /api/settings`（仅 `canManage` 管理员），服务端继续用 `sanitizeRuntimeSettings()` 收敛字段并写 `runtimeSettings` 持久状态；保存后记录 `settings.runtime.update` 审计。
- 前端：`renderAdminSettings()` 按两行式配置行展示，避免窄屏三列表格挤压；版本与环境为只读信息行，基础配置三个下拉框可编辑；保存按钮在请求期间禁用，失败回到可操作态并提示，成功后刷新管理中心。
- 模型网关只展示供应商、脱敏后的端点、默认模型与 Key 是否已保存，不回显密钥；路径类值按真实本机路径展示。
- 实测：718×763 下系统设置页三层内容正常渲染；将默认执行策略改为“人工确认”保存后，页面重载显示新值，验证后恢复“自动化执行”；将默认推理强度改为“高”保存后显示“高”，随后恢复“中”；版本显示前端 `v550`、Electron `45.2.1`、Node `v24.15.0`、DSH `0.2.2-rc.1`、端口 `54649`。
- 当前状态：服务 PID `20676`，`/api/health` 200；前端 `app.js?v=550`；管理员米乐已登录。截图：`C:\Users\46198\AppData\Local\Temp\jg-settings-2.png`（基础配置）、`jg-settings-3.png`（版本/环境）、`jg-settings-4.png`（环境底部）。
- 未实现：通知规则需要先定义事件与通知渠道；更细的功能开关需绑定真实运行时行为后再开放，当前未摆假开关。

## 73. 登录页关闭入口与快捷方式图标收紧（2026-11-14）

- 登录页：`renderLogin()` 与首次改密页卡片去掉外框、阴影和白底，表单直接落在页面底色上；右上角新增关闭按钮，Electron 下调用 `window.jgClient.close()`，浏览器环境回退到 `window.close()`。
- 安全域选中态改为白底 + 强调色描边 + 左侧强调色内阴影，不再使用浅色块背景，选择状态仍清晰可辨。
- 图标：从现有透明源图按蓝绿形状重新裁边，只保留约 4% 外留白，生成 `electron/jg-app-icon.png` 与多尺寸透明 `electron/jg-app-icon.ico`；透明像素在 16/32/48/256 尺寸四角均校验为 `(0,0,0,0)`。
- 快捷方式：`C:\Users\46198\Desktop\九规智能中枢.lnk` 的 IconLocation 改为 `D:\project-test3\jg-client-1.0\electron\jg-app-icon.ico,0`，并保持 Target/Arguments/WorkingDirectory 不变；随后调用 `SHChangeNotify` 与 `ie4uinit -show` 刷新。
- Electron 主窗口与弹窗 `icon` 同步改为 `jg-app-icon.ico`，避免窗口仍读取旧图标。
- 验证：登录页在 718×763 下无卡片外框，关闭按钮可见；退出登录再登录成功；`app.js?v=551` 已生效；快捷方式实际提取的 32×32 图标四角 alpha 为 0，蓝绿图形已贴近图标边界。
- 截图：`C:\Users\46198\AppData\Local\Temp\jg-login-clean.png`（新版登录页）、`jg-icon-tight-preview.png`（紧凑透明图标预览）、`jg-shortcut-extracted.png`（快捷方式提取图标）。

## 74. 登录页改为竖向分区（2026-11-14）

- 宽屏不再使用居中的窄卡片：改为左右分区，左侧竖向品牌区（标识、产品名、安全域选项和说明），右侧竖向登录表单；`100vh` 高度填满，减少左右空白。
- 安全域由横向三卡改为竖排列表；选中态为白底 + 强调色边框 + 左侧强调色内阴影，不使用浅色块背景。
- 右侧表单最大宽度 `520px`，输入框满宽；关闭按钮保留在表单右上角；窄屏 `max-width:900px` 自动收为单列（品牌区在上、表单在下）。
- 登录页样式写在本页 scoped `<style>` 中，未修改 `public/styles.css`。
- 验证：`app.js?v=552`；718×763 下单列布局无横向溢出；退出登录后重新登录成功；服务 PID `20676`，`/api/health` 200。
- 截图：`C:\Users\46198\AppData\Local\Temp\jg-login-vertical-718.png`（窄屏）、`jg-login-wide-1680.png`（1680×1050 宽屏布局）。

## 75. 登录密码可见与关闭按钮位置修正（2026-11-14）

- 登录密码框右侧新增眼睛图标按钮：默认隐藏密码，点击后切换为明文，图标同步变为“闭眼”，`aria-label` 与 `aria-pressed` 跟随状态更新；再次点击恢复隐藏。按钮保留键盘可达性，输入框继续满宽。
- 关闭按钮从表单标题行移到页面右上角固定位置（`position:fixed; top:14px; right:18px; z-index:10`），不再悬在表单中段。
- 登录页样式仍使用页面内 scoped `<style>`，未修改 `public/styles.css`。
- 验证：`app.js?v=553`；718×763 与 1680×1050 均可见右上角关闭按钮；密码切换后 `input.type` 由 `password` 变为 `text`，按钮 aria-label 变为“隐藏密码”；退出登录再登录成功；`/api/health` 200。
- 截图：`C:\Users\46198\AppData\Local\Temp\jg-login-wide-553.png`（宽屏）、`jg-login-pw-visible-718.png`（密码明文状态）。

## 76. 登录关闭按钮强化与两账号正式密码（2026-11-14）

- 登录页关闭按钮改为右上角描边胶囊按钮：X 图标 + “关闭”文字，透明底、细边框、无填充，固定在 `top:14px; right:18px`，在宽屏与窄屏都保持可辨。
- 米乐（`mile`，`A-7788-01`）和米乐乐（`milele`，`A-7788-02`）正式密码均通过真实 `POST /api/account/password` 更新为约定的正式密码，`mustChangePassword` 随之置为 `0`；未直接改库。
- 独立新会话重新登录验证：米乐、米乐乐均返回 `ok:true`、`mustChangePassword:false`，用户名分别为 `mile`/`milele`。
- 本机浏览器 `jg.login.password` 已同步为新密码，保持“记住账号和密码”后退出再登录会自动回填新密码。
- 当前前端 `v557`，服务 PID `20676`，`/api/health` 200；登录页密码说明已改为“新账号初始密码……已有正式密码的账号直接使用正式密码”；截图：`C:\Users\46198\AppData\Local\Temp\jg-login-wide-557.png`（描边关闭按钮 + 密码可见按钮）。
- 注意：不在代码、界面文案或仓库文档中写入明文密码；账号库只保存 scrypt 哈希，后续改密继续走账号改密接口。
## 77. 深度思索接入推理模型（2026-11-14）

- 问题定位：原有界面只有“推理强度 低/中/高”，映射为 `off/low/high`；当前账号默认模型仍是 `deepseek-chat`，所以“高”只是普通模型的推理档位，并没有独立推理模型入口，也没有把推理模型接入会话。
- 前端入口：不新增顶部按钮；在聊天输入框“＋”菜单中加入“深度思索”并放在第二项，原“深度研究 / 暂未开放”占位不再保留。开启后该行显示“✓ 深度思索”，并提示“已开启 · 当前会话使用推理模型”；再次点击关闭。
- 交互状态：`state.deepThink` 与会话的 `deepThink` 字段同步；开启时推理强度固定为高，发送 `/api/chat` 时携带 `deepThink: true`；新建会话重置为关闭，重新打开会话从服务端记录恢复。
- 服务端：`/api/chat` 读取 `deepThink`，在 DeepSeek 官方端点下把 `modelCfg.model` 切换为 `deepseek-reasoner`，`reasoningEffort` 固定为 `high`；会话记录 `deepThink` 和 `reasoningEffort=high` 并持久化。
- 失败边界：非 DeepSeek 端点开启深度思索时返回 `409 DEEP_THINK_UNSUPPORTED`，明确提示需要 DeepSeek 推理模型，不静默回退到普通模型。
- 等待反馈：深度思索请求进行中且尚无执行步骤时，聊天区显示“深度思索中”，并提示正在调用 DeepSeek 推理模型；不把模型内部 `reasoning_content` 原文暴露到界面，只展示状态和最终回答。
- 实测：`app.js?v=561`，服务 `http://127.0.0.1:54649/`，PID `68252`，`/api/health` 200；用“9.11 和 9.9 哪个大？先简要推理再给结论。”验证，最新会话返回 `model=deepseek-reasoner`、`deepThink=true`、`reasoningEffort=high`，回答包含推理过程和结论；刷新后重新打开该会话，“＋”菜单仍显示“✓ 深度思索”。
- 正式验收（2026-11-14）：新建空会话默认关闭；从“＋”第二项开启后显示“✓ 深度思索 已开启 · 当前会话使用推理模型”；发送后立即观察到“深度思索中 / 正在调用 DeepSeek 推理模型…”；验收会话 `C-1794625048826270` 返回 `deepThink=true`、`model=deepseek-reasoner`、`reasoningEffort=high`，回答同时给出推理要点和结论；刷新并重新打开该会话后入口仍为开启。关闭后同一会话继续发送普通问题，返回 `deepThink=false`、`model=deepseek-chat`，并提示“已关闭深度思索：恢复普通对话模型”；“推理强度”低/中/高三档仍可用。
- 截图：`C:\Users\46198\AppData\Local\Temp\jg-deepthink-plus-561.png`（718×763 下 + 菜单中的深度思索入口）。
- 未验证：非 DeepSeek 端点的 409 分支未切换账号实测；`reasoning_content` 不展示为逐字思考过程；本轮会话统计的 `reasoningTokens` 为 0，未把 token 数作为深度思索的验收依据。