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
