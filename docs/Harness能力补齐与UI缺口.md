# DeepSeek Harness 能力补齐与 UI 缺口

日期：2026-11-11
基线：`@deepseek-ai/dsh` / `dsh-sdk-client` `0.2.2-rc.1`，profile `sdk`
约束：按用户明确授权补齐 UI 缺口，但所有新控件复用既有类（`.plus-pop` / `.pp-row` / `.hc-send` / `.confirm-card` / `.btn` / `.quick` / `.hh-refs` / `.conv-menu` / `.tk-*` / `.steps-block` / `.steps-title` / `.step` / `.step-dot`），未在 `styles.css` / `search-fixes.css` 新增任何规则。

## 一、已经落地并真机验证

| 能力 | 实现位置 | 验证结果 |
|---|---|---|
| MCP 桥接（产品工具） | `mcp-jg.mjs`、`profiles/sdk/cordis.patch.yml`、`server.mjs` 的 MCP 身份分支 | 模型可见 `mcp__jg__*` 工具；实测 `mcp__jg__resource_query`、`mcp__jg__notice_list` 均返回 `ok:true`，桥日志为 HTTP 200 |
| 产品技能 | `data/dsh-home/skills/jg-product/SKILL.md` | 步骤中出现 `skill`，加载 `jg-product-tools`；`/help` 回复同时列出 bundled 技能 |
| 定时任务 | `dsh-tool-schedule` + `dsh-schedule`，存储 `data/dsh-home/storages/schedule.json` | 一句“每天 09:00 提醒我查看通知公告”成功创建 `schedule-bdcc4e9d-eba3-4c3f-abd4-b073c33af2c5`，首次触发 `2026-11-12 09:00 Asia/Shanghai` |
| 定时任务产品侧可见 | `GET /api/automations` 只读合并 `schedule.json` | 返回 1 条 `source=harness` 的任务，状态 active，next 为 2026/11/12 09:00 |
| 工具审计 | `harness.mjs` 的 `auditOf()` + `server.mjs` 的 `harness.tool` 落库 | `/api/audit` 可见 `harness.tool` 记录，object 为工具名，result 含 callId 与参数/结果摘要 |
| 取消执行 | `POST /api/chat/cancel`（关闭 Harness 子进程，下一轮自动重建） | 返回 200；随后再发“2+2”返回 4，证明重建成功 |
| 模型提问安全降级 | `POST /api/chat` 传入 `handlers.onQuestion` | 实测 `ask_user_question` 返回 `cancelled`，模型在正文说明“用户关闭了问题”，整轮不挂死 |
| 图片内容块 | `imageBlocksForAgent()` 把 PNG/JPEG/WebP/GIF 转 base64 内容块 | 内容块已随 prompt 发出；`deepseek-chat` 无视觉能力时会明确返回“无法读取图片”，需换视觉模型才能真正识图 |
| 会话删除 API | `POST /api/conversation/delete` | 新增，仅移除产品会话记录；Harness 历史文件按自身策略保留 |
| 计划模式/压缩/子代理步骤 | `stepsOf()` 识别 `plan/mode`、`compaction`、`subagent` 通知 | 后端步骤数据已具备；前端 `stepsBlock` 能直接渲染，但真实前端复验尚未做 |
| 推理强度三档 | `harness.mjs`（`keyOf`、构造参数）、`server.mjs`（映射与透传）、`public/app.js`（`reasoningLabel` / `openReasoningMenu`） | 首页与会话页 composer 同为「低 / 中 / 高」；三档真机均成功：low→OK、medium→4、high→OK；`medium` 不再报 500 |
| 停止生成按钮 | `public/app.js` 的 `cancelChat()`；会话页 composer 忙时把发送按钮原位换成停止图标 | 长任务运行时按钮出现，点击后返回「已停止本轮 Harness 执行。」，发送按钮恢复；等待 8 秒无迟到回复 |
| 会话删除入口 | `public/app.js` 的 `runConversationAction('delete')` 接 `POST /api/conversation/delete` | 侧栏会话「更多 → 删除」确认后，会话从最近列表移除，接口返回成功 |
| 会话页附件条 | 会话页 composer 增加与首页相同的 `hh-refs` 行 | 与首页同构，附件可显示、可逐项移除 |
| 命令审批卡片（U2） | `harness.mjs` 复用 `active.handlers`；`server.mjs` 的 `pendingInteractions` + `/api/chat/pending`、`/api/chat/approval`；`public/app.js` 的 `renderInteraction()` | 实测 `echo approval-test` 触发审批卡（`pwsh` / escalate sandbox），点「拒绝」后模型在正文说明该命令未执行，子进程不挂死 |
| 用户提问卡片（U3） | 同一 `pendingInteractions` 通道 + `onQuestion` + `/api/chat/answer`；卡片复用 `.confirm-card` / `.quick` / `.text-input` | 实测两轮：模型调用 `ask_user_question` 问「今天先做哪件事」，选择「写周报」并确认后，模型回复「你选择了：**写周报**」 |
| `/` 命令菜单（U8） | `SLASH_COMMANDS` / `openSlashMenu` / `updateSlashMenu` / `closeSlashMenu`，复用 `.plus-pop` / `.pp-row` / `.pp-ico` / `.pp-label` / `.pp-desc` | 首页输入 `/` 弹出 `/help` `/compact` `/goal`；点选后 draft 变为 `/help `；实测 `/help`、`/compact`（Compacted 4 history items）、`/goal`（No goal is currently set）均由 Harness 返回真实结果。`/feedback` 在当前 profile 未挂载，已从菜单移除，避免死项 |
| 图片不可识图提示（U7） | `composerRefLabel()` + 首页/会话页 `hh-refs` 渲染 | 上传 `after-clean-home.png` 后 chip 显示「after-clean-home.png · 当前模型不支持识图」 |
| 定时任务暂停/删除（U6） | `server.mjs` 的 `mutateHarnessSchedule()` + `POST /api/automations/pause` / `POST /api/automations/delete`；`public/app.js` 任务详情「更多」菜单与列表行删除按钮 | 暂停后 `schedule.json` 中真实任务 `status=paused`，再启用恢复 `active`；用临时任务验证删除后 `schedule.json` 条目消失、真实任务仍 `active` |
| 待办清单（P0-1） | `harness.mjs` 的 `normalizeTodos()` / `todosOf()`；`server.mjs` assistantMsg 与 `/api/chat` 响应新增 `todos`；`public/app.js` 的 `todoBlock()`（复用 `.steps-block` / `.step` / `.step-dot`） | 真机 `todo_write` 后出现「任务清单 · 0/3 完成」，三行「读取需求 进行中 / 编写方案 待办 / 校验结果 待办」，完成项显示删除线；`todo/write` 不在 SDK `result.events` 时从 `tool/call` 的 `todo_write` 参数兜底 |
| 交付物卡片（P0-2） | `harness.mjs` 的 `deliverablesOf()`；`server.mjs` assistantMsg 与 `/api/chat` 新增 `deliverables`，并新增 `GET /api/harness/file`（限 `data/dsh-workspace`）；`public/app.js` 的 `deliverableBlock()`（复用 `.hh-refs` / `.hh-ref`） | 真机 `present` 后气泡下方出现 `demo-deliverable.md 打开`；接口返回 200、`text/markdown; charset=utf-8`，正文「九规智能中枢交付物验证」 |
| 计划评审（P0-3） | `public/app.js` 的 `renderInteraction()` 增加 `intent.kind === 'plan-review'` 分支；`server.mjs` 的 `onQuestion` 透传 `intent.kind / approve` | 真机 `/plan` → `exit_plan_mode` 出现「计划评审」卡，`form-label` 为「请确认是否按此计划执行」，计划正文落在 `.confirm-draft`，选项显示「批准执行 / 继续规划」；点「批准执行」→「确认回答」后计划模式退出，模型回复「计划已提交并获批准」 |
| 后台作业概览（P0-4） | `harness.mjs` 的 `jobsOf()`（优先 `job/registered` + `job/settled`，兜底 `pwsh` 的 `run_in_background`）；`server.mjs` assistantMsg 与 `/api/chat` 新增 `jobs`；`public/app.js` 的 `jobsBlock()` | 真机后台启动 `Start-Sleep -Seconds 30` 后出现「后台作业 · 1」，显示 `pwsh-… · running — Start-Sleep -Seconds 30`；尚未做独立作业面板与界面停止按钮 |

### 推理强度映射口径

SDK 的 `reasoningEffort` 是 Harness 进程构造参数，不是单轮参数；切换档位会重建 Harness 进程并 `resumeSession` 续接历史。`deepseek-official` 的 `deepseek-chat` 支持 `off / low / high / max`，不支持 `medium`，因此产品三档映射为：

| 产品档位 | SDK 合法值 | 行为 |
|---|---|---|
| 低 | `off` | 关闭推理，最快响应 |
| 中 | `low` | 轻量推理，平衡耗时 |
| 高 | `high` | 充分推理，默认强度 |

UI 只保存产品档位（`low/medium/high`），后端在 `/api/chat` 内映射为 SDK 值；会话记录回写产品档位，重新打开会话时按钮显示对应档位。

## 二、能力边界（不是“没部署”，是 SDK/模型限制）

1. **无原生单轮取消**：SDK 没有取消当前 run 的 API，只能 `closeHarness()` 杀子进程；下一轮会重建并 `resumeSession`。
2. **图片识图依赖模型**：Harness 已接收图片内容块，但 `deepseek-chat` 不接受图像输入；要真正识图需配置视觉模型或换 provider 的图像能力。
3. **命令审批已接通**：`approvalRequests` 只在 `handlers.onApproval` 存在时开启；审批卡通过 `pendingInteractions` 回填 `allowed-once / rejected / cancelled`，8 分钟未响应自动 `cancelled`。
4. **`ask_user_question` 已接通**：`onQuestion` 把问题转成产品问答卡，回填 `{answers:[{id, selected, custom?}]}` 或 `{cancelled:true}`；空答案按取消处理。
5. **MCP 子进程残留**：重启客户端若只杀 electron，旧 `node.exe`（命令行含 `mcp-jg.mjs`）会继续持有旧端口/旧 token，必须一并结束。
6. **定时任务「立即执行」未接**：暂停/删除已写真实 `schedule.json`；「立即执行」仅对内存任务显示，Harness 任务行不再显示该按钮，因为它们由 dsh 调度器按 rrule 触发，产品侧没有手动触发 API。
7. **终端/shell 工具依赖管理员启动（已验证）**：`dsh-sandbox-windows-acl` 给工作区写 capability SID 并打 Low integrity label（SACL），需要 `SeSecurityPrivilege`；普通双击启动的进程没有该权限，会在命令前报 `SetNamedSecurityInfoW failed (Win32 5)`。实测以管理员身份启动客户端后，`echo admin-test` 直接返回 `admin-test`，无审批卡。当前运行中的客户端已是管理员模式（端口 `52647`）；生产打包需决定 manifest 提权或改用无需 SACL 的权限预设。

## 三、仍需后续处理的 UI 缺口

以下改动会改变界面或依赖异步运行时，按约束逐项确认后实施。

| 编号 | 缺口 | 建议最小改法 | 复用的现有样式 |
|---|---|---|---|
| U4 | 计划模式/压缩/子代理可视化 | 步骤标题汇总类型数量，如「执行过程 · 3 步 · 压缩 2」；仍不新增图标、分组容器或进度条 | 现有 `.steps-block` / `.steps-title`，未新增 CSS |

U1—U8 与 P0 四项（待办清单、交付物卡片、计划评审、后台作业概览）已落地并真机验证；`public/styles.css` 与 `public/search-fixes.css` 全程未改，仍为原型哈希。U4 仅做标题类型汇总，未做图标、分组容器或进度条。审批「允许一次」仍未点，后台作业尚无独立面板与界面停止按钮。

## 四、复验命令（本机）

```powershell
# 启动
$root='D:\project-test3\jg-client-1.0'
Start-Process "$root\node_modules\electron\dist\electron.exe" -ArgumentList '.' -WorkingDirectory $root -RedirectStandardOutput "$root\.run.log" -RedirectStandardError "$root\.run.err"
Get-Content "$root\.run.log" -Tail 3

# 登录并验证 MCP / 定时任务 / 审计
$base='http://127.0.0.1:<端口>'
Invoke-RestMethod "$base/api/login" -Method Post -ContentType 'application/json' -Body '{"role":"admin"}' -SessionVariable session
(Invoke-RestMethod "$base/api/automations" -WebSession $session).items
(Invoke-RestMethod "$base/api/audit" -WebSession $session).items | Where-Object { $_.action -eq 'harness.tool' }
```

## 五、变更文件

- `harness.mjs`：handlers、MCP env、`stepsOf`、`auditOf`、`runAgent` 图片/slash/返回值。
- `server.mjs`：MCP token/account、`imageBlocksForAgent`、chat 的 handlers 与工具审计、`/api/chat/cancel`、`/api/conversation/delete`、`pendingInteractions` 审批/提问通道、`mutateHarnessSchedule`、`/api/automations` 合并与 pause/delete 路由。
- `public/app.js`：推理强度三档；停止生成；会话删除真实 API；审批卡/提问卡；`/` 命令菜单；图片识图提示；定时任务暂停/删除；会话页附件条。均复用现有组件与样式。
- `mcp-jg.mjs`：10 个产品工具的 stdio MCP server。
- `data/dsh-home/profiles/sdk/cordis.patch.yml`：`insert` 方式挂载 `mcp-jg`。
- `data/dsh-home/skills/jg-product/SKILL.md`：产品工具使用规范。
- `data.mjs`：从永久清空列表移除 `aiTools`，恢复 10 个产品工具定义（属于能力定义，不是示例业务数据）。
- `README.md`：补 MCP/技能/调度/审计/取消/图片边界说明。
- `public/app.js`：composer 的「中 ˅」改为推理强度三档菜单，首页 `#langBtn` 与会话页 `#chatLang` 同构；会话页忙时发送按钮原位换成停止、接 `cancelChat()`；会话删除接真实 API；会话页补与首页相同的附件条；审批/提问卡；`/` 命令菜单；图片不可识图提示；定时任务暂停/删除。均复用现有样式，未新增 CSS。

## 六、V2.0 结论（2026-11-12 更新）

本文件上方表格是当时的阶段记录，部分“尚未做”的描述已被后续实现覆盖，当前以 `docs/Harness逐步落实记录.md` 为权威台账：

- P0：待办清单、交付物、计划评审、后台作业概览与停止、Auto 高风险硬拦截（改为服务端前置判定 + 工具级审批）。
- P1：文件变更摘要、会话全文检索、会话导出 Markdown、后台作业面板、审批待处理会话恢复、`/plan`、项目级指令、设置中心、MCP 资源浏览、子代理正文、工作流阶段/节点、Agent 预设、插件运行时清单与启停。
- 明确不做：官方 Web/Desktop UI 套装。
- P2 已落地：语音输入（Web Speech API，含失败路径）、AI 会话标题（`session-title-llm`）、token 用量（`assistant/message.usage`）、消息反馈（按消息索引持久化）、`apply_patch`（开启 `tool-fs.applyPatch`）、Office 技能（`dsh-skill-office` + 包内 LibreOffice Kit CLI）。
- 仍有边界：DSH 原生 settings/config-editor 全量表单、插件安装完整包管理（当前环境缺 pnpm）、持久终端（已试挂载，但 Windows PTY 启动失败，已回滚）、PTC、ACP、open-in-app。

