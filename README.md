# 九规智能中枢 · 客户端 1.0

本工程是「九规智能中枢」1.0 阶段的桌面客户端。UI 基线是已上传 GitHub 的产品原型（`jg-hub-prototype`），页面、组件、样式、文案、导航与布局全部照原型复用。

## 基线

- `public/`、`data.mjs`、`docs.mjs`、`console.mjs` 均从原型 `D:\project-test3\jg-hub` 复制，与原型逐字节一致。
- `server.mjs` 是唯一有意演进的运行文件：在原型的演示 API 上增加服务端会话、SQLite 持久化、审计落库与权限校验；所有 `/api` 路径与请求/响应契约保持兼容。
- 没有新增、删除或改写任何页面、组件、样式、文案、导航或布局；`public/` 仍然与原型一致。
- 原型说明保留在 `PROTOTYPE.md`，仅作对照，不参与运行。

## M1 本地后端底座（含 P0-2 持久化）

当前已落地“P0 底座”的第一阶段，目标是先让 1.0 客户端不再“重启即清空”，同时不改变界面：

- **服务端会话**：登录后由服务端签发随机 `jg_sid`，写入 `HttpOnly` Cookie，默认 8 小时过期；`roleOf()` 只信任服务端会话，不再信任客户端可改的 `jg_role`。
- **本地持久化**：使用 Node 22 内置的 `node:sqlite`，数据库在 `data/jg.sqlite`；资源、消息、任务、审计、文档、云会话、项目、插件等内存态集合整体快照落盘。
- **文件对象存储**：数据库只存文件元数据，正文落在 `data/files/<文件ID>/v<版本>/<原文件名>`；`files` / `file_versions` 表记录大小、SHA256、版本、归属网络与回收站状态。文档下载改为按文件 ID 读磁盘，不再依赖内存 Buffer。
- **版本与回收站**：同一文件 ID 再写入会自动升版本，旧版本保留；`deleteFile()` 软删除进回收站，`restoreFile()` 恢复，`purgeFile()` 物理清理。
- **备份与恢复**：启动时和每 10 分钟执行一次一致性备份（SQLite `VACUUM INTO` + `files/` 目录 + `manifest.json`），备份在 `data/backups/<时间戳>/`，默认保留最近 14 份；RPO 10 分钟，恢复步骤见下。
- **审计落库**：`logAudit()` 同时写 SQLite 审计表；界面仍只展示最近记录，数据库保留完整记录。
- **权限校验**：除登录、选网络、读引导、退出外，其余 `/api/*` 必须先有有效会话；运维监控仅管理角色可读，审计日志管理角色看全量、普通角色只看本人当前网络记录。
- **接口兼容**：原型前端的调用路径、请求体、返回字段未改，页面无需改一行。

**边界说明**：当前仍是“选择角色”的演示身份，不是企业 SSO/AD。服务端会话只能保证“Cookie 不可伪造、会话可过期”，不能证明操作者就是所选角色；真实 SSO 需要在 Electron 外壳或企业 IdP 侧接入，属于下一阶段。

### 数据文件与恢复

- 数据库：`data/jg.sqlite`（含 WAL 文件），已加入 `.gitignore`。
- 文件正文：`data/files/`；备份：`data/backups/`。两者都在 `.gitignore` 内。
- 想恢复首次演示状态：退出客户端后删除 `data/` 目录，再次启动即可重新生成演示数据。
- 可通过环境变量 `JG_DATA_DIR` 指定其他数据目录。
- 启动时出现 `ExperimentalWarning: SQLite is an experimental feature` 属于 Node 内置模块提示，不影响运行。

**从备份恢复**（先退出客户端，避免 SQLite 文件被占用）：

1. 在 `data/backups/` 选最新一份备份目录，确认其中同时有 `jg.sqlite`、`files/`、`manifest.json`。
2. 把当前 `data/jg.sqlite` 改名留档（例如 `jg.sqlite.before-restore`）。
3. 复制备份里的 `jg.sqlite` 到 `data/jg.sqlite`，复制备份里的 `files/` 覆盖 `data/files/`。
4. 启动客户端，用原角色登录，打开文档/文件确认可下载，查看审计日志确认记录仍在。

### DeepSeek Harness 全能力运行时（2026-11-11）

- **对话已切到 Harness**：`POST /api/chat` 调用 `harness.mjs`，由 `DeepSeekHarness` 在独立子进程中启动 `dsh --profile sdk`；模型可真实调用 `fs` / `glob` / `pwsh` / 子代理 / 技能 / MCP / 定时任务等 Harness 工具，工具链事件会以真实步骤回传前端。
- **产品工具已接入 MCP**：`mcp-jg.mjs` 作为本地 stdio MCP server，把 `drive_search`、`drive_read`、`notice_list`、`notice_read`、`academy_search`、`contacts_find`、`im_send`、`notebook_search`、`resource_query`、`task_create` 暴露为 `mcp__jg__*`；只走本机回环，使用进程内随机令牌和米乐账号身份，调用仍按模块授权判定并写审计。
- **产品技能已落到 Harness 技能根**：`data/dsh-home/skills/jg-product/SKILL.md` 提供内部工具选择与“先查后答、不伪造执行结果”的调用规范，模型可通过 `skill` 工具加载。
- **定时任务为真实调度**：`dsh-tool-schedule` + `dsh-schedule` 由 sdk bundle 启用，聊天里创建的定时任务写入 `data/dsh-home/storages/schedule.json`，并由产品「定时任务」页合并展示；暂停/启用/删除会直接改写该文件的 `status` 或删除任务条目，任务在 Host 运行时到点投递。
- **工具审计**：每个 `tool/call` / `tool/result` 以 `harness.tool` 写入既有审计表，保留工具名、callId、参数摘要和结果摘要。
- **取消执行**：新增 `POST /api/chat/cancel`；受 SDK 无原生单轮取消限制，当前实现为关闭 Harness 子进程，下一轮自动重建会话。
- **图片附件**：`refs` 中 `image/png|jpeg|webp|gif` 会转成 SDK 图片内容块随 prompt 发送；是否能“看懂”取决于所选模型是否具备视觉能力，纯文本模型会明确返回“无法读取图片”。
- **模型提问**：`ask_user_question` 已接入产品问答卡片，选择结果回填 `{answers:[{id, selected, custom?}]}`；取消或空答案按 `cancelled` 处理，不会让整轮失败。
- **会话记忆**：每个会话把 DSH `sessionId` 存在会话对象的 `dshSessionId` 字段，跟 `data/jg.sqlite` 一起持久化；服务重启后用 `resumeSession()` 从 `data/dsh-home` 恢复历史，不因重启丢上下文。
- **运行时自包含**：`dsh-runtime/` 内置 `@deepseek-ai/dsh@0.2.2-rc.1` 与 `@deepseek-ai/dsh-sdk-client@0.2.2-rc.1`；`runtime/node.exe` 是 Node 24.15 便携运行时，Electron 外壳用它启动 `server.mjs`，避免 DSH 在 Electron 内置 Node 下因原生加载器指纹不兼容而失败。
- **凭据**：账号 Key 通过子进程环境变量 `DEEPSEEK_API_KEY` 注入，不写进 Harness 的 `$DSH_HOME/.credentials.yaml`；自定义端点用 `DEEPSEEK_BASE_URL` 覆盖。
- **工作区**：Harness agent 的 `cwd` 为 `data/dsh-workspace`，文件读写与 shell 都限制在这个工作区；首次启动某个 `DSH_HOME` 需要初始化 profile，初始化超时设为 90 秒。
- **可调环境变量**：`JG_DSH_RUNTIME`、`JG_DSH_HOME`、`JG_DSH_WORKSPACE`、`JG_DSH_TIMEOUT_MS`、`JG_NODE_EXE`、`JG_MCP_URL`、`JG_MCP_ACCOUNT`。

**边界说明**：Harness 的 agent 具备真实 shell 与文件工具，属于“完全能力”模式；命令审批已接入产品审批卡片（允许一次/拒绝/取消），只有真正需要提权的调用才会弹出。Windows 下 `dsh-sandbox-windows-acl` 给工作区写 capability SID 并打 Low integrity label 时需要 `SeSecurityPrivilege`；普通双击启动的进程没有该权限，shell 会在启动前报 `SetNamedSecurityInfoW failed (Win32 5)`。当前验证通过的方式是**以管理员身份启动客户端**；生产安装包需决定是否在 manifest 声明提权，或改用用户目录工作区并配合权限预设。`dsh-runtime/` 与 `runtime/` 体积较大（约 836 MB），已加入 `.gitignore`，部署时需随安装包一起分发或通过 `npm install` 重新安装。

### 三模块真实化（M1 延伸）

- **附件与数据文件真实落盘**：`POST /api/files/upload` 直接接收二进制，正文写入 `data/files/<id>/v<n>/`；聊附件、登记材料、插件包共用这一入口。`GET /api/files/download` 按归属/资源可见性校验后回原文件。
- **数据中心登记与下载闭环**：登记向导先逐个上传文件，再把 `fileIds` 与清单一起提交；资源详情下载由服务端签发 15 分钟 HMAC 链接 `GET /api/resources/download/file?token=`，无真实文件时返回 409 `NO_FILE`，不再返回演示文案。
- **插件包真实检测**：`plugin-scan.mjs` 解析 ZIP 中央目录，检查 `package.json` / `index.js` / `cordis.patch.yml`、依赖、权限声明、可执行文件/外链/动态执行；检测不通过直接置 `rejected`，通过进入 `pending` 审核。插件安装与启停按用户独立持久化，互不影响。
- **持久化范围**：资源 `fileIds`、下载申请与审批、插件提交（含 `fileId`/`sha256`/检测条目）、按用户安装与启停都进 `app_state`，重启后保留。
- **真实本地账号**：SQLite `accounts` 表保存账号 ID、姓名、角色、单位、岗位与账号级模型配置；会话通过 `account_id` 绑定账号。当前已建 `A-7788-01「米乐」/ 管理员`，登录页会作为第四个账号出现，账号级密钥与其他演示身份隔离。

**边界说明**：插件检测是静态检查，不执行插件代码；“隔离测试”一栏如实标为「未执行」，需后续接入沙箱。模型 Key 存在本机 SQLite 的 `app_state`，不是操作系统凭证库；生产环境应改为 KMS/凭证库。

## 桌面外壳

Electron 只负责窗口与服务生命周期，不改页面：

- `frame: false`，直接使用原型自带的 38px 菜单栏作为唯一标题栏，没有第二层窗口框。
- `electron/preload.cjs` 只暴露三个窗口动作：最小化、最大化/还原、关闭。
- `electron/main.cjs` 只做：单实例锁、分配本地端口、启动 `server.mjs`、等待服务就绪、加载页面。
- 页面内只注入一段不改变视觉的 `-webkit-app-region` 规则，让原型的菜单栏可以拖动，并让原型右上角三个 `.mb-winbtn` 接到真实窗口动作。
- 客户端使用独立的 `userData` 目录（`%APPDATA%\jg-client-1.0`），不继承旧客户端的登录态、缓存和窗口状态。

## 运行

直接双击 `启动九规智能中枢.bat`，或者：

```bat
npm start
```

首次打开会进入原型自带的安全域 / 账号选择页；选择后进入主界面。这是原型本身的行为，不是客户端新增的登录页。

## 目录

```
electron/main.cjs      Electron 主进程
electron/preload.cjs   窗口动作桥
public/                原型页面（index/styles/search-fixes 与原型一致；app.js 仅改交互逻辑）
server.mjs             演示 API + M1 会话/持久化/权限层 + 文件/模型路由
harness.mjs            DeepSeek Harness SDK 适配层（子进程、会话恢复、事件转步骤、工具审计）
mcp-jg.mjs             本地 stdio MCP server，把产品 10 个内部工具暴露给 Harness
model.mjs              OpenAI 兼容模型网关（模型测试与回退路径）
plugin-scan.mjs        插件 ZIP 静态检测
db.mjs                 node:sqlite 会话、审计、文件对象、备份
dsh-runtime/           DeepSeek Harness 0.2.2-rc.1 完整运行时（已 gitignore）
runtime/node.exe       Node 24.15 便携运行时（已 gitignore）
data/                  本地 SQLite 数据（运行时生成，已 gitignore）
data/files/            文件正文对象（按 ID/版本分目录）
data/backups/          SQLite + 文件的一致性备份
data/dsh-home/         Harness profile、会话历史与凭据家目录
data/dsh-workspace/    Harness agent 工作区
data.mjs               演示数据（原样）
docs.mjs               文档数据（原样）
console.mjs            控制台数据（原样）
PROTOTYPE.md           原型说明（原样副本）
```
