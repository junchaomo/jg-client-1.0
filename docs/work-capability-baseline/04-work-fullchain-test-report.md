# Work 全链路测试报告

- 测试日期：2026-11-23 至 2026-11-24（多轮修复与回归）
- 测试服务：`127.0.0.1:54269`（当前 PID 18244），云入口 `0.0.0.0:54270`
- 测试项目：`PRJ-4E633D`（Work 全链路测试）
- 测试工作区：`D:\project-test3\worktest-lab-20261123`
- 辅助项目：`PRJ-7689B3`（ACL 修复验证）
- 测试方式：真实任务请求 + 真实浏览器 UI 验收，不使用 mock

## 一、结论

Work 主链路已经具备可交付条件：项目创建与绑定、只读/写入/编辑、项目指令约束、任务取消、排队、幂等、工作树隔离、成果检查和中断恢复均真实跑通。

本轮共在测试项目执行 **40 条真实任务**，最终状态为 **done 30 / cancelled 6 / interrupted 3 / failed 1**，累计登记产出 **16 个**；项目线程 **34 条**。测试工作区 `docs/worktest/` 下实际有 10 个成果文件（含 `race-counter.txt`），成果检查扫描到 11 个文档（含根目录 `README.md`），`files=11`、`conflicts=0`、`warnings=0`。

测试期间发现并修复 **15 个真实缺陷**：

1. Windows 项目目录缺少显式 `WRITE_DAC`，`pwsh` 直接启动失败。
2. 排队任务在拿到执行槽位前不返回 SSE meta，客户端 15 秒超时。
3. 并发任务共享工作区时，先结束的任务会把其他任务的文件算进自己的产物数。
4. 并发任务已拿到执行槽位后仍显示 `queued`，且排队位置全部算成 1。
5. 项目详情只读当前窗口的会话缓存，跨窗口/后台/API 创建的线程要刷新页面才出现；执行记录只展示最近 10 条。
6. 项目详情统计卡直接使用启动时的 `p.runs` 缓存，执行记录已更新时仍显示旧值。
7. SSE 响应结束后仍有 `onDelta` 写入，触发 `ERR_STREAM_WRITE_AFTER_END` 进程级异常。
8. 同项目两个 Work 线程并发读改写同一文件，出现 lost update：两边都读到 0，最终只写回 1。
9. 后台/API 新增线程后，项目详情回源正确，但侧边栏分组仍是上一次 render 的旧 DOM，必须刷新页面才出现新线程。
10. 失败任务已经发起恢复后，执行记录仍显示“恢复执行”按钮，再点只会拿到 409“该任务已发起过恢复”。
11. 排队中的任务被取消后仍留在等待队列，继续占用 `queuePosition`，后面任务的位置不前移；排队请求也要等前一个任务结束才返回。
12. 服务重启时，运行中与排队中任务都会被标成 `interrupted`，但排队任务的 `queuePosition` 仍保留旧值（1），接口出现“已中断却还在排队”的残留状态。
13. 检查点的“已完成步骤”把模型网关口和已开始但尚未执行的工具调用算作工具步骤：受控 `max-token` 样本在首个工具调用前中断时，检查点显示 `stepsCompleted=1`，文件却没有落盘；恢复提示会把未完成的动作当成已完成。修复为只在收到 `tool/result` 后计数，写入路径只在工具成功返回后并入 `filesWritten`。
14. 恢复任务启动时把 `partialReply` 清空：第一次恢复在只读确认文件后再次 `max-token`，第二轮检查点只剩“未完成”占位，第一轮已输出的段落尾部丢失，连续续写只能依赖 DSH 会话记忆。修复为恢复任务启动时继承父检查点的 `partialReply` 尾部。
15. 附件已上传但未输入文字时，前端仍用“请输入内容，或粘贴图片附件”拦截发送；即使绕过前端，服务端也因 `text` 为空直接 400。而且聊天附件只存附件库，Work 代理扫描项目目录看不到，导致模型反复要求“重新上传”。修复为“有附件即可发送 + 自动生成附件默认指令 + 将附件落盘到当前工作区并把路径写入模型上下文”。

第 8 项已用“按 projectId 串行化”修复并复测：同一项目第二个任务进入排队，第一个结束后第二个才启动，最终计数从 0 正确累加到 2。

第 9 项已用“新增线程时重绘侧边栏”修复并实测：侧栏 34 条时由 API 新建会话，打开项目详情后详情 35 条、侧栏同刻变 35 条，无需刷新。

第 10 项已用“`resumeState=started` 时不再渲染恢复按钮”修复并实测：失败任务恢复后行内显示“失败 · 已发起恢复”，按钮消失。

第 11 项已用“取消即从等待队列摘除”修复并实测：排队任务取消后 `queuePosition` 立即归零，后一个任务从 2 前进到 1；被取消请求的 SSE 流在取消后 21ms 结束，不再等到前一个任务跑完。

第 12 项已用“重启恢复时清零 `queuePosition`”修复并实测：服务在一个 `running`、一个 `queued / queuePosition=1` 时被强杀，重启后两条任务都进入 `interrupted / queuePosition=0`，会话状态为 `failed`，没有留下“已中断但仍排队”的假状态。

第 13 项已用“工具步骤按 `tool/result` 计数”修复并实测：受控 512 输出预算下，任务 `TR-1795487646556-573` 完成一次 `write` 后触发 `finishReason=max-tokens`；检查点保留 `stepsCompleted=1`、`filesWritten=[...checkpoint-maxtok2.txt]`、`lastTool=write`，文件确实只有一行 `MAXTOK2_BASE=ready`。恢复前先重启服务（PID 54264），恢复任务 `TR-1795487707876-950` 仍能读取父检查点，先只读确认文件内容，再从 `SECTION-22` 续写到 `SECTION-40`，最终 `done`，没有重写文件。

第 14 项已用“恢复任务继承 `partialReply`”修复并实测：768 输出预算下连续两轮触顶，第一轮 `TR-1795488353862-625` 输出 `SECTION-01`–`SECTION-17`；第一轮恢复 `TR-1795488380531-325` 又输出 `SECTION-19`–`SECTION-41` 后再次中断，检查点保留这一轮尾部；重启默认预算后第二轮恢复 `TR-1795488420880-223` 继承该尾部，补 `SECTION-41`–`SECTION-80` 并 `done`。三次执行都只读确认文件，没有重写 `MAXTOK3_BASE=ready`。

第 15 项已用真实 Word 附件实测：会话 `C-1795491100000` 先给前置只读指令，再发送 `text=''`、仅 `refs=[ATT-MWU4QVJB-40F37EA9]`，服务端自动生成附件指令并接受请求；任务把 51035 字节的 `关于赴宁波调研停车管理与运维情况的报告.docx` 落到 `worktest-lab-aclprobe\.jg\chat-attachments\C-1795491100000\`，恢复内容为文件名、正文第一段和 82 个非空段落，未修改文件。浏览器端真实拖入同一 Word 后不输入文字直接点发送，不再弹“请输入内容”，而是创建任务并进入生成。测试任务、会话和落盘副本已清理。

任务恢复语义本轮已从“重放原提示”改为“按检查点续写”：中断任务持久化已完成步骤、已写文件、最后动作、部分输出和 DSH 会话；恢复任务继承父检查点，并生成“从断点补齐”的提示。真实重启样本中，`CP_BASE=ready` 已写入文件，恢复后只追加 `CP_DONE`，没有重写；纯等待步骤也按已消耗时间处理，不再重复等待。

`max-token` 分支也已用受控输出预算真实制造并续写；本轮继续把连续触顶链扩到三轮，并用“失败任务 + 新检查点字段”重跑恢复。100 条执行记录上限已改为“默认 100 条 + 查看全部/收起”；登录态改为活跃请求滑动续期，并在到期前 10 分钟提示。

截至本轮，前面列出的 **15 个真实缺陷**和后续列出的 **5 个已知边界**均已代码修复并实测收口；最终测试数据已清理回 40 任务 / 34 线程。

修复均已用真实并发任务、真实浏览器 UI 或独立项目复测通过。

## 二、测试矩阵

| # | 测试环节 | 任务 / 会话 | 结果 | 关键证据 |
|---|---|---|---|---|
| 1 | 项目创建与绑定 | `PRJ-4E633D` | 通过 | cwd 正确绑定，重复创建返回 `existing:true` 和原项目；非法路径返回 `400 PROJECT_DIR_INVALID` |
| 2 | 只读任务 | `TR-1795442545331-135` / `C-1795446000010` | 通过 | 3 次工具调用，正确回答 README 标题与导出函数；`done`、`artifacts=0` |
| 3 | 创建文件 | `TR-1795442589589-730` / `C-1795446000011` | 通过 | 新建 `docs/worktest/hello.md`，内容一致；`done`、`artifacts=1` |
| 4 | 编辑文件 + 多文件 | `TR-1795442633567-897` / `C-1795446000012` | 通过 | 追加 `hello.md` 并新建 `notes.md`，4 次工具调用；`artifacts=2` |
| 5 | 项目指令约束 | `TR-1795442690838-404` / `C-1795446000013` | 通过（模型级约束） | 模型拒绝改 `src/app.js`，改为写变更方案；源码未变；`artifacts=1` |
| 6 | 运行中取消 | `TR-1795442743070-114` / `C-1795446000014` | 通过 | 8 秒后取消，`cancelled`、`artifacts=0`、槽位释放 |
| 7 | pwsh 首次失败 | `TR-1795442771747-477` / `C-1795446000015` | 发现缺陷 | `SetNamedSecurityInfoW failed (Win32 5): grantWrite(...)`，命令未启动 |
| 8 | pwsh 修复后重试 | `TR-1795442902944-872` / `C-1795446000016` | 通过 | 输出 `PWSH_OK` |
| 9 | ACL 自动授权 | `PRJ-7689B3` / `TR-1795443301119-399` | 通过 | 无显式 ACL 的新目录自动出现 `ssss\46198 FullControl` 非继承 ACE，输出 `ACL_FIX_OK` |
| 10 | 并发排队 | 3 个 `Start-Sleep 15` 任务 | 通过（修复后） | 修复前第 3 个请求 15 秒超时；修复后 3 个请求 1 秒内均拿到 200 + meta，呈现 2 running + 1 queued |
| 11 | 并发产物计数 | `TR-1795443841964-226` / `C-1795446000026`、`...-765` / `...0027`、`...-395` / `...0028` | 通过（修复后） | 分别写 `q7/q8/q9.txt`，每个任务 `artifacts=1`；修复前 q1 曾误算为 2 |
| 12 | 排队中取消 | `TR-1795444397516-577` / `C-1795446000093` | 通过 | 排队期间取消，`cancelled`，`reason=排队期间已停止`，未执行命令、无文件 |
| 13 | 幂等键 | `TR-1795443180369-645` / `C-1795446000020` | 通过 | 执行中重复请求 `409 DUPLICATE_REQUEST`；完成后重放 `200 duplicate:true`，不创建第二个任务 |
| 14 | 工作树隔离 | `TR-1795443255096-676` / `C-1795446000022` | 通过 | 分支 `worktest/isolated` 内写 `docs/worktest/worktree.txt`；worktree 有文件、主工作区没有；`artifacts=1` |
| 15 | 工作树 UI 创建/移除 | `worktest/ui-isolated` | 通过 | UI 创建第 3 个工作树并显示“干净”；UI 移除后目录消失，分支保留 |
| 16 | 项目成果检查 | `POST /api/projects/verify` | 通过 | `status=ok`、`files=11`、`conflicts=0`、`warnings=0`，只读不修改文件 |
| 17 | max-tokens 中断 | `TR-1795443415006-641` / `C-1795446000025` | 通过 | 119.6 秒、47 次工具调用、19066 output tokens，`finishReason=max-tokens`、`interrupted`、`artifacts=0` |
| 18 | 中断恢复（历史样本） | `TR-1795443583097-512` | 部分通过（历史） | 返回 202，`resumeState=started`、`resumedByTaskId` 正确；重复恢复 409；当时恢复任务 36.6 秒后再次 max-tokens。本轮已改为检查点续写，并由第 43 行 max-token 样本复测通过 |
| 19 | 恢复 UI 按钮 | `TR-1795444114474-398` | 通过（交互） | 点击“恢复执行”出现 toast，按钮置灰，原任务记录 `resumedByTaskId` 指向新任务；随后取消成功 |
| 20 | 运行中取消 UI | `TR-1795444267408-678` | 通过 | 点击“停止生成”后显示“已停止本轮 Harness 执行”；任务 `cancelled`，未产生 `UI_CANCEL_OK.txt` |
| 21 | Work 端到端 UI | `TR-1795444231958-516` / `C-1795444231938623` | 通过 | 首页选项目 → 切换“工作” → 发送只读任务；6.7 秒完成，正确返回 `Work Test Lab`，`artifacts=0` |
| 22 | 项目详情 UI | `PRJ-4E633D` | 通过（修复后） | 显示 34 线程、40 执行、16 产出、根目录 3 文件、Git master、有未提交改动 |
| 23 | 执行记录 UI | 同项目详情 | 通过（修复后） | 标题显示“共 40 条”，实际渲染 40 行；已完成/已取消/已中断/失败及“1 个产出”均正确；上限改为 100 条 |
| 24 | 文件浏览 UI | 同项目详情 | 通过 | 展示 `data/docs/public/src`、`README.md`、`server.mjs` 等，可选择文件预览 |
| 25 | 项目安全设置 UI | 同项目详情 | 通过（诚实状态） | 自动审查权限层显示“运行时已安装 · 产品未接入”，未伪装成可用工具 |
| 26 | 并发排队位置与状态 | `TR-1795481728707-610`、`...-228`、`...-303` | 通过（修复后） | 3 个 `Start-Sleep 12` 任务：前两个 `running / queuePosition=0`，第三个 `queued / queuePosition=1`；槽位释放后第三个转 `running / 0`，最终全部 `done` 且分别回复 `QUEUE_FIX_1/2/3` |
| 27 | 项目详情线程回源 | 同项目详情 | 通过（修复后） | 3 个 API 创建的会话未推送到当前窗口；关闭详情再打开，线程从 22 跳到 25，无需刷新页面 |
| 28 | 项目详情统计卡一致性 | 同项目详情 | 通过（修复后） | 修复前统计卡“执行 27”而执行记录标题“共 30 条”；修复后统计卡与列表一致，最终为 40/40 |
| 29 | SSE 断流保护 | `TR-1795482196110-584` / `C-1795482196103` | 通过（修复后） | 客户端 1.6 秒后主动 abort；服务端没有新增 `uncaughtException`，任务继续跑完并 `done`；修复前同一路径在 08:56 产生 `ERR_STREAM_WRITE_AFTER_END` |
| 30 | 服务重启后登录态 | `sessions` 表 / 应用内浏览器 | 通过 | 重启前后 `sessions` 有 2 条持久记录；浏览器未重新登录，`/api/tasks` 直接返回 200；旧 cookie 失效是 8 小时 TTL 到期 |
| 31 | 重启后正常 SSE | 只读任务 | 通过 | 200，流内出现 `event: done` 和 `Work Test Lab`；证明断流保护没有误伤正常流式输出 |
| 32 | 同项目并发读改写（修复前） | `TR-1795482899374-912`、`TR-1795482899488-642` | 复现缺陷 | 两个任务都读到 `race-counter.txt=0`，都在 5 秒后写回 `1`；最终文件为 `1` 而不是 `2`；两边各自登记 `artifacts=1` |
| 33 | 同项目串行化（修复后） | `TR-1795483099894-341`（先）、`TR-1795483100004-241`（后） | 通过 | 第二个任务启动即为 `queued / queuePosition=1`；第一个结束后第二个启动，回复 `RACE_B:1`，最终文件为 `2`，lost update 消失 |
| 34 | 跨项目并行回归 | `TR-1795483307882-258`（ACL 项目）、`TR-1795483308002-316`（Work 项目） | 通过 | 两个不同项目任务同时为 `running / queuePosition=0`，说明项目锁没有退化成全局串行；两条最终均 `done` |
| 35 | 运行中服务重启恢复 | `TR-1795483654613-581` / `C-1795483654612` | 通过 | 任务执行到 20% 时强杀服务并重启；任务被标记 `interrupted`，原因“服务重启导致任务中断，可在原会话继续”，没有停留在 `running`；重启后无旧任务子进程残留 |
| 36 | 后台新增线程侧栏同步 | `PRJ-4E633D` 临时会话 | 通过（修复后） | 侧栏 34 条时 API 新建会话，打开详情后详情 35 条、侧栏同刻变 35 条，无需刷新；修复前侧栏停留在 34。临时会话已清理 |
| 37 | 真实 `failed` 样本 | `TR-1795484437976-954` / `C-1795484437974` | 通过（构造） | 服务以 `JG_MAX_TOOL_CALLS=1` 启动；任务读取 README 后第二步工具调用触发 `STEP_BUDGET_EXCEEDED`，`state=failed`，原因“本轮工具调用超过预算 1 步”；UI 显示“失败”和“恢复执行” |
| 38 | 失败任务恢复 | 原 `TR-1795484437976-954` → 新 `TR-1795484518709-433` | 通过（修复后） | 恢复默认预算后点击“恢复执行”，新任务 `done`，回复 `FAIL_PROBE_DONE`；原任务 `resumeState=started`、`resumedByTaskId` 指向新任务；行内变为“失败 · 已发起恢复”，恢复按钮消失 |
| 39 | 执行记录 100 条上限（历史样本） | 同一临时会话连续产生 62 条直连任务 | 已升级 | 当时项目累计 102 条真实任务，详情只渲染最近 100 条且没有旧记录入口；该提示已由第 48 行“查看全部/收起”取代。清理 62 条任务与临时会话后恢复 40 条 |
| 40 | 排队中取消立即出队 | `TR-1795485727535-706` / `...-586` / `...-515`；延迟样本 `TR-1795485768834-427` / `...-715` | 通过（修复后） | 修复前取消 B 后 B 仍 `cancelled / queuePosition=1`，C 仍为 2，直到 A 结束 B 被放行后才释放；修复后 B 取消 15ms 内变 `cancelled / queuePosition=0`，C 立即从 2 前进到 1；单独测量取消到 SSE 流结束仅 21ms；A 完成后 C 正常转 `running / queuePosition=0`，E 前进到 1；另跑 2 个 5 秒正常排队任务均 `done`、分别回复 `QREG_A/B`；全部测试任务与新会话已清理，恢复 40 任务 / 34 线程 |
| 41 | 重启时排队任务状态复位 | 修复前 `TR-1795486009887-825` / `...-823`；修复后 `TR-1795486087765-306` / `...-642` | 通过（修复后） | 修复前一个 `running`、一个 `queued / qp1` 被强杀，重启后两者均 `interrupted`，但排队任务 qp 仍为 1；修复后同样场景两者均 `interrupted / qp0`，会话状态 `failed`，没有“已中断却仍在排队”的假状态；测试任务已清理，恢复 40 / 34 |
| 42 | 检查点续写恢复 | `TR-1795486749983-945` → `TR-1795486833738-204`；等待样本 `TR-1795487133694-876` → `TR-1795487169233-300` | 通过（能力升级） | 中断任务检查点保存 `stepsCompleted=1`、`filesWritten=[...checkpoint-resume.txt]`、`dshSessionId`；恢复任务 `resumedFromTaskId` 指向父任务，提示包含“已写入文件”和断点；续写结果只追加 `CP_DONE`，文件为 `CP_BASE=ready` + `CP_DONE`，原内容未重写；纯 `Start-Sleep` 样本续写时按已消耗时间跳过等待，直接追加 `CP4_DONE`，任务 `done` |
| 43 | `max-token` 截断续写 | `TR-1795487646556-573` → `TR-1795487707876-950` | 通过（新增缺陷修复） | 512 输出预算下先 `write` 成功、文件落盘，再输出到 `SECTION-21` 触发 `max-tokens`；检查点 `stepsCompleted=1`、`filesWritten=[...checkpoint-maxtok2.txt]`、`lastTool=write`，没有把模型网关或未返回调用算成完成；重启后恢复任务只读确认文件，续写 `SECTION-22`–`SECTION-40`，最终 `done`，未重写文件 |
| 44 | 连续两轮 `max-token` 续写 | `TR-1795488353862-625` → `TR-1795488380531-325` → `TR-1795488420880-223` | 通过（新增缺陷修复） | 768 预算下第一轮输出 1–17 段触顶；第一轮恢复输出 19–41 段后再次触顶；重启默认预算后第二轮恢复继承 19–41 段尾部，补 41–80 段并 `done`；三轮均只读确认文件，`MAXTOK3_BASE=ready` 未被重写，证明连续中断时断点不丢 |
| 45 | 同项目只读并发 / 写任务独占 | 只读 `TR-1795489069707-176`、`TR-1795489069808-451`；写 `TR-1795490127278-214`、`TR-1795490127392-219` | 通过（本轮新增） | 两个 `accessMode=read` 任务同时 `running / queuePosition=0` 并均 `done`；两个写任务中 A 12.787s 启动、14.165s 结束，B 14.218s 才启动、15.518s 结束，B 严格等 A 释放项目锁，未并发；默认未声明 `accessMode` 仍按写任务处理 |
| 46 | 三次以上连续 `max-token` 链 | `TR-1795489586085-923` → `TR-1795489629140-720` → `TR-1795489681479-271` → `TR-1795489732839-211` | 通过（本轮新增） | 256 输出预算下首轮输出 `SECTION-1`–`64` 触顶；两次低预算恢复均再次 `max-tokens / interrupted`，形成三轮连续触顶；重启默认预算后第四次执行从 `SECTION-65` 补到 `SECTION-200` 并 `done`；`checkpoint-maxtok3plus2.txt` 始终只有 `CP3P_BASE`，未重写 |
| 47 | `failed` + 新检查点字段组合恢复 | `TR-1795489782452-608` → `TR-1795489843465-587` | 通过（本轮新增） | 任务先写 `checkpoint-failed-resume.txt=FAIL_BASE`，随后在 `pwsh` 等待中强杀本次 DSH 子进程，任务进入 `failed`；检查点含 `phase=failed`、`stepsCompleted=1`、`lastTool=pwsh`、`dshSessionId`、`partialReply`；恢复任务 `done`，回复明确“文件写入已完成、无需重复写入/等待”，只补 `FAIL_DONE`，文件仍为单行 `FAIL_BASE` |
| 48 | 超过 100 条执行记录查看全部 | `PRJ-4E633D` 101 条任务（40 真实 + 61 条临时合成） | 通过（本轮新增） | 详情标题“共 101 条执行记录，当前显示最近 100 条。”，按钮“查看全部 101 条”；点击后任务容器渲染 101 行、底部显示“已显示全部 101 条执行记录”，再点“收起”回到 100 行；验证后删除 61 条合成记录，恢复 40 任务 / 34 线程 |
| 49 | 活跃续期与到期提示 | 会话表 / 应用内浏览器 | 通过（本轮新增） | 每个活跃 API 请求都把 `expires_at` 后移并重发 `jg_sid` cookie，响应头 `x-session-expires` 同步新过期时间；两次请求间隔 9.1 秒，过期时间同步后移 9.1 秒；把 TTL 临时改为 60 秒后页面实际弹出“登录状态将在约 1 分钟后到期；继续操作会自动续期”；恢复 8 小时后响应头 TTL 为 8 小时、页面无到期提示 |
| 50 | 空文本仅附件发送与附件落盘 | 会话 `C-1795491100000`；附件 `ATT-MWU4QVJB-40F37EA9`；浏览器拖入样本 | 通过（本轮新增） | `text=''` + 单个 Word `refs` 返回 200；服务端自动生成附件指令，任务把附件落到 `worktest-lab-aclprobe\.jg\chat-attachments\C-1795491100000\`，回复文件名、正文第一段、82 个非空段落，未改动原文件。浏览器拖入 Word 后不输入文字直接发送，不再弹“请输入内容”，任务正常创建。测试任务、会话、落盘副本已清理 |

## 三、已修复缺陷

### 1. Windows 项目目录缺少 `WRITE_DAC`

**现象**：任务在项目 cwd 启动 pwsh 时返回 `SetNamedSecurityInfoW failed (Win32 5): grantWrite(D:\project-test3\worktest-lab-20261123)`，命令没有执行。

**根因**：DSH Windows 沙箱会调用 `SetNamedSecurityInfoW` 给当前用户补写权限，要求目标目录对当前 OS 用户显式持有 `WRITE_DAC`。项目目录继承来的 `Modify` 不包含该权限；`ensureWorkspaceAcl()` 原来只处理 Chat 托管目录，没有处理项目 cwd。

**修复**：`server.mjs` 的 `ensureWorkspaceAcl` 增加按路径缓存；`/api/chat` 解析出 `project` 后调用 `ensureWorkspaceAcl(project.cwd)`。

**验证**：新建没有显式 ACL 的 `D:\project-test3\worktest-lab-aclprobe`，项目 `PRJ-7689B3` 的任务 `TR-1795443301119-399` 成功输出 `ACL_FIX_OK`；目录自动出现当前用户 `FullControl` 非继承 ACE。

**备份**：`D:\project-test3\jg-pre-aclfix-20261123-2215-server.mjs`

### 2. 排队任务迟迟不返回 SSE meta

**现象**：3 个并发长任务，第 3 个请求 15 秒超时，前端拿不到任务 ID，无法显示排队状态或取消。

**根因**：`/api/chat` 先 `await acquireChatRunSlot()`，再发送 SSE meta；槽位被前两个任务占满后，第三个请求一直阻塞在等待队列里，meta 发不出去。

**修复**：改为先发送 200 + SSE meta（含 `taskId`、`queued:true`），再等待槽位；`MAX_CHAT_RUNS` 仍为 2。

**验证**：3 个 `Start-Sleep 15` 任务全部在 1 秒内拿到 200 + meta，状态为 2 running + 1 queued，随后全部完成。

### 3. 并发任务产物串台

**现象**：3 个任务分别写 `q1/q2/q3.txt`，但 q1 的 `artifacts=2`，把 q2 的文件算成了自己的产出。

**根因**：`countTaskArtifacts` 在任务结束时使用全局 `workspaceChanges` diff，同一工作区里其他任务的写入也会进入该 diff。

**修复**：新增 `artifactPathsFromSteps(steps)`，从本轮 `write`/`edit`/`apply_patch` 工具调用的 `file_path` 提取任务自己的产物；有任务级路径时不再使用全局 diff，只有纯命令产物才回退到 diff。

**验证**：3 个任务分别写 `q7/q8/q9.txt`，每个任务 `artifacts=1`，文件内容正确，排队任务完成后也正确计数。

**备份**：`D:\project-test3\jg-pre-artifactfix-20261123-2225-server.mjs`

### 4. 排队任务已分槽后仍显示 `queued`，排队位置全部为 1

**现象**：同时发起 3 个任务时，前两个已经拿到执行槽位，但任务接口仍返回 `state=queued`，而且 3 条任务的 `queuePosition` 都是 1。

**根因**：`startChatRunTask` 在 `acquireChatRunSlot()` 之前用 `chatRunWaiters.length + 1` 计算排队位置；前两个任务已占槽位但尚未 `markChatRunStarted`，等待队列仍为空，第三个任务也被算成第 1 位。槽位分配后也没有立即把任务状态从 `queued` 前移，导致前端在启动上下文期间继续显示排队。

**修复**：`server.mjs` 新增 `refreshChatRunQueuePositions()`；`chatRunWaiters` 改为保存 `{ task, resolve }`；`acquireChatRunSlot(task)` 一旦分到槽位，就把任务状态改为 `running`、`queuePosition=0` 并持久化；排队和出队时重新计算后续位置。

**验证**：真实并发 3 个 `Start-Sleep 12` 任务，任务 ID `TR-1795481728707-610`、`TR-1795481728823-228`、`TR-1795481728923-303`。启动后 1.4 秒采样为 2 个 `running / queuePosition=0` + 1 个 `queued / queuePosition=1`；前两个完成后，第三个在 65 秒采样点转为 `running / queuePosition=0`，最终 3 条全部 `done`，分别回复 `QUEUE_FIX_1/2/3`。

**备份**：`D:\project-test3\jg-pre-queuefix-20261124-0831-server.mjs`

### 5. 项目详情线程不回源、执行记录只显示 10 条

**现象**：通过 API 或后台创建的会话不会推送到当前窗口，项目详情先显示“线程 0/22”，刷新后才变成完整数量；执行记录固定 `.slice(0, 10)`，27 条任务只能看到最近 10 条。

**根因**：`openProject` 只读 `state.conversations` 的本地缓存；执行记录渲染时硬编码只取前 10 条。

**修复**：`openProject` 并行请求 `/api/tasks?projectId=...` 与 `/api/conversations`，把返回的 `items` 按 id 合并进 `state.conversations` 后按 `projectId` 过滤；线程列表上限提到 50，执行记录上限提到 100，标题显示“共 N 条”，超过 100 条时追加提示。

**验证**：先在详情打开状态下通过 API 创建 3 个会话，当前窗口未收到推送；关闭详情再打开，线程数从 22 变为 25，无需刷新页面；执行记录标题显示“共 30 条”，实际渲染 30 行。

**备份**：`D:\project-test3\jg-pre-uifix-20261124-0831-app.js`

### 6. 项目详情统计卡使用启动缓存，和实际执行记录不一致

**现象**：执行记录标题已经显示“共 30 条”，但同一面板顶部统计卡仍显示“执行 27”。

**根因**：统计卡用 `${p.runs || projectTasks.length}`，优先取项目 bootstrap 时的 `p.runs` 缓存；`p.runs` 只在启动时刷新，详情里实时拉到的 30 条任务不会覆盖它。

**修复**：`public/app.js` 改为 `Math.max(Number(p.runs) || 0, allProjectTasks.length)`；产出同样改为取缓存值与任务级产物和的最大值，避免缓存低估。

**验证**：刷新前端后打开 `PRJ-4E633D`，统计卡显示“线程 27 / 执行 32 / 产出 12 / 根目录文件 3 / Git master”，与执行记录“共 32 条”、线程列表 27 行一致。

### 7. SSE 响应结束后仍写入，触发进程级异常

**现象**：`jg-main-server-queuefix.err.log` 在 2026-11-24 08:56 记录一条 `uncaughtException`：`ERR_STREAM_WRITE_AFTER_END`，栈顶为 `sseSend`，调用方是 `onDelta`。任务已经结束、响应已 `end`，但 Harness 仍在回调增量文本。

**根因**：`sseSend()` 只用 `try/catch` 包住 `res.write()`。响应已 end 时，Node 不会同步抛错，而是异步 emit `error`；`try/catch` 捕获不到，最终变成进程级 `uncaughtException`。心跳定时器也可能在响应结束后继续写入。

**修复**：`server.mjs` 的 `sseSend()` 先判断 `res.writableEnded / res.destroyed / !res.writable`，不可写直接返回；`openSse()` 增加 `res.on('error', () => {})` 吸收 socket 异步错误；心跳写入前做同样的可写判断。

**验证**：修复后重启服务（PID 43020）。任务 `TR-1795482196110-584` 在客户端 1.6 秒后 abort，任务继续后台执行并最终 `done`；错误日志文件长度保持 0，没有新的 `ERR_STREAM_WRITE_AFTER_END`。随后正常只读任务流式返回 200，包含 `event: done` 与 `Work Test Lab`，证明保护没有阻断正常 SSE。

**备份**：`D:\project-test3\jg-pre-sseguard-20261124-0908-server.mjs`

### 8. 登录会话跨重启核验（非缺陷，纠正前次判断）

前次记录称“服务重启后 `sessions` 表为 0，所有用户被登出”。本轮直接查询 sqlite：重启前后 `sessions` 表均有 2 条有效记录，当前用户会话 `expires_at=1795509936035`；重启 `54269` 后应用内浏览器未重新登录，`/api/tasks` 仍返回 200。

真实原因是会话 TTL 固定 8 小时（`SESSION_TTL_MS = 8 * 60 * 60 * 1000`）。旧 cookie 创建于前一日深夜，到次日 08:32 已过期，`getSession` 删除过期行，表现为“重启后失效”。这不是会话不落库，也不需要改持久化方案；如果产品需要更长登录态，应调整 TTL 或增加续期，而不是改存储。

### 9. 同项目并发读改写发生 lost update

**现象**：项目内 `docs/worktest/race-counter.txt` 初值为 0。两个任务并发执行“读取 n → 等待 5 秒 → 写回 n+1”。两个任务都读到 0，最终文件为 1，正确值应为 2。任务 `TR-1795482899374-912`、`TR-1795482899488-642`，两边都 `done`、各自 `artifacts=1`，但更新丢失。

**根因**：`MAX_CHAT_RUNS=2` 只是进程级并发限流，没有项目级互斥。两个 Work 线程共享同一 cwd，读改写之间没有任何锁，最后写入者覆盖前一个结果。

**修复**：`server.mjs` 新增 `chatRunProjectLocks`，按 `projectId` 串行化；`canGrantChatRunSlot` 同时检查全局槽位和项目锁；`grantChatRunSlot` 分配槽位时占用项目锁；`releaseChatRunSlot(task)` 释放项目锁并 `drainChatRunWaiters()` 重新调度。不同项目之间仍可并行，同一项目第二个任务显示排队。

**验证**：重置文件为 0，再发起两个同项目任务。第一个 `TR-1795483099894-341` 为 `running`，第二个 `TR-1795483100004-241` 为 `queued / queuePosition=1`；第一个完成后第二个才开始，回复 `RACE_B:1`，最终文件为 **2**。同项目 lost update 消失。

**跨项目回归**：ACL 项目 `TR-1795483307882-258` 与 Work 项目 `TR-1795483308002-316` 同时发起，二者均为 `running / queuePosition=0`，没有因为项目锁退化成全局串行；两条最终均 `done`。

**备份**：`D:\project-test3\jg-pre-projectlock-20261124-0920-server.mjs`

### 10. 后台新增线程后侧边栏分组不刷新

**现象**：页面加载时侧边栏 `PRJ-4E633D` 分组有 34 条线程。通过 API 直接新建一条会话后，打开项目详情已经显示 35 条线程，但关闭详情后侧边栏分组仍只列出 34 条，必须刷新页面才出现新线程。

**根因**：`openProject` 打开详情时会并行回源 `/api/conversations` 并合并进 `state.conversations`，但没有触发 `renderSidebar()`。项目详情读的是刚合并后的 state，所以详情正确；侧边栏仍是上一次 render 生成的静态 DOM，所以继续显示旧列表。

**修复**：`public/app.js` 在合并会话时先记录哪些 id 是新增的；只有出现新增线程才调用 `renderSidebar()`，元数据更新不触发重绘，避免无意义重建。这样后台任务、其他窗口或直接 API 创建的线程，打开一次项目详情就能同步到侧边栏。

**验证**：页面侧边栏 34 条，API 新建临时会话后仍为 34；通过搜索面板打开 `PRJ-4E633D` 详情，详情线程 35，侧边栏在同一时刻变为 35，无需刷新。临时会话和其两条直连任务记录已清理，没有污染当时的 38 任务 / 33 线程；后续 `failed` 样本另计。

**备份**：`D:\project-test3\jg-pre-sidebarrefresh-20261124-0935-app.js`

### 11. 已发起恢复的失败任务仍显示“恢复执行”

**现象**：用工具预算 1 步制造出 `failed` 任务后，点击“恢复执行”成功创建新任务并完成。但原失败任务行仍显示“恢复执行”按钮，再点只会收到 409“该任务已发起过恢复，请查看新任务执行记录”。

**根因**：项目详情渲染 `resumable` 时只判断 `state` 是否属于 `interrupted / failed`，没有判断 `resumeState === 'started'`。后端已经拒绝重复恢复，前端却继续给出可点击入口。

**修复**：`public/app.js` 把 `resumeState === 'started'` 纳入判断，已发起恢复的任务不再渲染按钮；状态文案改为“失败 · 已发起恢复”（中断任务同理），保留原状态与原因。

**验证**：失败任务恢复后重新打开项目详情，原行显示“失败 · 已发起恢复 · 本轮工具调用超过预算 1 步…”，`data-prjtask-resume` 按钮不存在；新任务 `TR-1795484518709-433` 为 `done`，回复 `FAIL_PROBE_DONE`。

**备份**：`D:\project-test3\jg-pre-resumestate-20261124-0943-app.js`

### 12. 取消排队任务后仍占等待队列，后续任务不前移

**现象**：同项目启动三个任务，A 为 `running / queuePosition=0`，B 为 `queued / 1`，C 为 `queued / 2`。调用 `/api/chat/cancel` 取消 B，接口 26ms 返回 200，B 变 `cancelled`，但 `queuePosition` 仍是 1，C 仍是 2。A 结束后 B 才被放行并立即释放，C 才启动；A 已结束、C 已运行时，已取消的 B 还停在 `queuePosition=1`。B 的 `/api/chat` 请求也一直挂到 A 结束才返回。

**根因**：`cancelChatRunTask` 只改任务状态，没有把该任务从 `chatRunWaiters` 移除，也没有触发 `refreshChatRunQueuePositions()`。排队中的 `/api/chat` 仍停在 `await acquireChatRunSlot()`，只能等前一个任务调用 `releaseChatRunSlot()`、`drainChatRunWaiters()` 把 B 放行后才继续。`grantChatRunSlot` 又只对 `state=queued` 的任务重置 `queuePosition`，已取消任务被放行后仍保留旧位置，形成“已取消但还在排队”的假象。

**修复**：新增 `dropChatRunWaiter(task)`，按任务对象从 `chatRunWaiters` 中摘除，清零 `queuePosition`，刷新其余任务位置，并用 `resolve(false)` 唤醒排队中的请求。`cancelChatRunTask` 首先调用它；`acquireChatRunSlot` 区分 `true/false`，`/api/chat` 收到 `false` 时不再把槽位标记为已持有，直接以 `cancelled` 结束 SSE，避免误走 `releaseChatRunSlot` 把全局并发计数减错。`drainChatRunWaiters` 正常放行时改为 `resolve(true)`。

**验证**：修复后三个任务 A `TR-1795485727535-706`、B `TR-1795485728679-586`、C `TR-1795485729702-515` 分别 `running / 0`、`queued / 1`、`queued / 2`；取消 B 15ms 返回 200，B 立即变 `cancelled / 0`，C 立即前进到 1。A 完成后 C 正常 `running / 0`。另起延迟样本 D `TR-1795485768834-427`、E `TR-1795485769471-715`，取消 D 后 21ms SSE 流结束，D 为 `cancelled / 0`，E 从 2 前进到 1。再跑两个正常排队任务 `TR-1795485868160-928` / `TR-1795485868765-649`（各 `Start-Sleep 5`），B 等 A 完成后启动，两者均 `done`，分别回复 `QREG_A`、`QREG_B`，证明 `resolve(true)` 的正常放行路径未被改坏。全部测试任务与新会话已清理，项目计数恢复 40 任务 / 34 线程；`jg-main-server-cancelwait.err.log` 保持 0 字节，服务 PID 52148 健康。

**备份**：`D:\project-test3\jg-pre-cancelwait-20261124-1008-server.mjs`

### 13. 重启恢复未清理排队任务的位置

**现象**：同项目一个 `running / queuePosition=0`、一个 `queued / queuePosition=1` 时强杀服务并重启。两条任务都按预期变成 `interrupted`，原因“服务重启导致任务中断，可在原会话继续”，但排队任务仍保留 `queuePosition=1`。重启后内存等待队列已经不存在，接口却继续显示“已中断但排在第 1 位”。

**根因**：`recoverInterruptedTasks()` 只重写 `state`、`progress`、`reason`、`checkpoint` 和会话状态，没有重置 `queuePosition`。排队位置原本只由内存中的 `chatRunWaiters` 维护，进程退出时等待队列被丢弃，但持久化任务上的旧位置字段没有同步清理。

**修复**：`recoverInterruptedTasks()` 在把 `running / queued` 任务改为 `interrupted` 时，同时设置 `t.queuePosition = 0`，再写 checkpoint 和持久化，保证恢复后的任务状态与已清空的等待队列一致。

**验证**：修复前样本 `TR-1795486009887-825` 为 `interrupted / 0`、`TR-1795486010844-823` 为 `interrupted / 1`。修复后重新构造同样场景 `TR-1795486087765-306`（running）、`TR-1795486088730-642`（queued / 1），强杀 PID 57860 并重启为 PID 49072，两条最终均为 `interrupted / queuePosition=0`，各自会话为 `failed`；`jg-main-server-queuerecover3.err.log` 为 0 字节。测试任务和会话已清理，恢复 40 任务 / 34 线程。

**备份**：`D:\project-test3\jg-pre-queuerecover-20261124-1007-server.mjs`

### 13A. 检查点把未执行步骤算作已完成

**现象**：受控 `max-token` 样本 `TR-1795487646556-573` 只生成了“先写文件”的动作，模型在随后长回复中触顶。文件实际不存在时，检查点仍显示 `stepsCompleted=1`、`filesWritten=[]`，恢复提示会说“已完成 1 个工具步骤”，把未执行的动作误当成完成。

**根因**：`interruptChatRunTask()` 用 `result.steps.length` 作为完成步骤，而 `stepsOf()` 把“模型网关”固定作为第 0 个步骤；同时 `recordChatRunActivity()` 在 `tool/call` 时就把 `toolCallsSeen` 写进 `stepsCompleted`，工具还没返回就已计数。另一个路径是 `tool/call` 阶段先把写入路径并入 `filesWritten`，工具失败或未执行时文件列表会失真。

**修复**：`tool/call` 只记录最后动作和待确认路径；收到 `tool/result` 后才递增完成步骤，只有结果非错误时才把该调用声明的路径并入 `filesWritten`。恢复任务用 `checkpointBaseSteps + toolResultsSeen` 累计，避免把模型网关口或已开始未返回的调用算成完成；旧任务无该字段时回退到检查点值。

**验证**：修复后同样用 512 预算复测。任务先成功 `write` 文件，再输出到 `SECTION-21` 触顶；检查点 `stepsCompleted=1`、`filesWritten=[docs/worktest/checkpoint-maxtok2.txt]`、`lastTool=write`，文件只有 `MAXTOK2_BASE=ready` 一行。重启后恢复任务先只读确认文件、没有重写，再续写 `SECTION-22`–`SECTION-40`，最终 `done`。

**备份**：检查点基线 `D:\project-test3\jg-pre-checkpoint-20261124-1020-server.mjs`；受控预算改动 `D:\project-test3\jg-pre-maxtokens-20261124-1028-harness.mjs`

### 13B. 连续续写时恢复任务清空上一轮输出尾部

**现象**：连续两轮触顶时，第一轮恢复在只读确认文件后再次 `max-token`，第二轮的检查点 `partialReply` 只剩“【未完成】本轮执行达到模型输出上限…”，第一轮已输出到 `SECTION-17` 的尾部没有进入下一轮提示。第三轮虽然还能靠 DSH 会话历史接着写，但检查点本身已经丢失断点。

**根因**：`startChatRunTask()` 对恢复任务固定写 `partialReply: ''`，没有继承父任务检查点。父检查点的尾部只在恢复提示里用了一次，新任务落库后就被清空；新任务若在产生新文本前再次中断，断点链就断了。

**修复**：恢复任务启动时继承父检查点 `partialReply` 的尾部（最多 3000 字符），新输出继续追加到该尾部；这样连续多次中断时，下一轮始终能拿到最近一段已完成输出。

**验证**：768 预算下任务 `TR-1795488353862-625` 输出 1–17 段后触顶；恢复 `TR-1795488380531-325` 继续输出 19–41 段后再次触顶，检查点保留了 19–41 的尾部；重启默认预算后第二轮恢复 `TR-1795488420880-223` 的提示确实包含 `SECTION-41` 及前文，从 41 补到 80 段并 `done`。三次执行均未重写文件。

### 14. 恢复改为按检查点续写

**原行为**：恢复接口只把原提示重放给模型，提示内容是“请检查工作区、继续未完成部分”，但任务检查点只有阶段和 DSH 会话 ID，没有已完成步骤、已写文件、最后动作或部分输出。长任务恢复后模型仍需重新判断做到哪一步，容易重复写入或再次触顶。

**实现**：任务检查点在执行过程中持续更新，保存 `stepsCompleted`、`filesWritten`、`lastTool`、`partialReply`、`finishReason` 和 `dshSessionId`。写入、编辑、`pwsh`、`run_code` 这类有副作用的工具调用立即持久化，只读动作按 2 秒节流，避免强杀时丢失最后关键动作。恢复任务通过 `resumeFromTaskId` 关联父任务，继承父任务的原始提示、已写文件、已完成步骤和 DSH 会话；`formatCheckpointResumePrompt()` 生成“从检查点续写”提示，明确列出断点并要求只补齐未完成部分。纯 `Start-Sleep` 被识别为等待动作，恢复提示会说明中断已消耗等待时间，不再重复等待。

**步骤计数修复**：`tool/call` 只记录“最后动作”和待确认的写入路径，`stepsCompleted` 只在收到 `tool/result` 后递增；写入路径也只在工具成功返回后并入 `filesWritten`。恢复任务的完成步骤按“父检查点基数 + 本轮已返回结果的工具数”累计，不再把模型网关口或已开始未返回的调用算成完成。该修复来自受控 `max-token` 样本中“步骤显示完成、文件实际不存在”的真实现场。

**验证一：重启中断后续写**。任务 `TR-1795486749983-945` 先写入 `checkpoint-resume.txt` 的 `CP_BASE=ready`，随后执行 `Start-Sleep 30`，在命令中途强杀服务。重启后任务为 `interrupted`，检查点保留 `stepsCompleted=1`、`filesWritten=[D:/.../checkpoint-resume.txt]` 和 `dshSessionId=session-629acbdf...`。点击恢复生成 `TR-1795486833738-204`，其 `resumedFromTaskId` 指向父任务，提示包含“已写入文件”和断点；任务最终 `done`，回复 `CP_OK`，文件内容为 `CP_BASE=ready` + `CP_DONE`，模型明确说明“未重写 CP_BASE，只补追加 CP_DONE”。

**验证二：纯等待步骤不被重复**。任务 `TR-1795487133694-876` 写入 `checkpoint-resume4.txt` 后执行纯 `Start-Sleep 20`，在等待中强杀。检查点保留已写文件和 `lastTool=pwsh / Start-Sleep 20`。恢复任务 `TR-1795487169233-300` 的提示包含“最后动作是纯等待命令，不再重复等待”；12 秒内完成，未再等 20 秒，回复 `CP4_OK`，文件为 `CP4_BASE=ready` + `CP4_DONE`。另外用 `Start-Sleep 60` 的样本验证了最后 `pwsh` 步骤在强杀后仍在检查点中，没有退回上一次 `write`。

**验证三：max-token 截断续写**。服务以 `JG_DSH_MAX_TOKENS=512` 启动，任务 `TR-1795487646556-573` 先用 `write` 创建 `checkpoint-maxtok2.txt`，随后在输出 40 段说明时触发 `finishReason=max-tokens` 中断；检查点保留 `stepsCompleted=1`、`filesWritten=[docs/worktest/checkpoint-maxtok2.txt]`、`lastTool=write` 和已输出到 `SECTION-21` 的尾部文本，文件实际只有 `MAXTOK2_BASE=ready` 一行。恢复前重启服务为 PID 54264，恢复任务 `TR-1795487707876-950` 继承父检查点和同一 DSH 会话；模型先只读确认文件内容，没有重写，随后从 `SECTION-22` 续写到 `SECTION-40`，最终 `done`，回复说明“本轮补充了 19 段，未新增写入”。

**验证四：连续两轮 max-token 续写**。服务以 `JG_DSH_MAX_TOKENS=768` 启动，第一轮 `TR-1795488353862-625` 写入 `checkpoint-maxtok3.txt` 后输出 `SECTION-01`–`SECTION-17` 触顶；第一次恢复 `TR-1795488380531-325` 只读确认文件后输出 `SECTION-19`–`SECTION-41`，再次触顶；第二次恢复前重启默认预算为 PID 57272，恢复任务 `TR-1795488420880-223` 继承第二次检查点的 19–41 段尾部，从 41 补到 80 段并 `done`。三次执行都没有重写文件，证明连续中断时 `partialReply` 不丢、断点链可接续。

**边界**：本节回归覆盖“服务重启中断 + 写入检查点 + 纯等待检查点 + max-token 截断 + 连续两轮 max-token”五类；当时更长的连续触顶链未逐一穷举。该边界已在本报告第四节“边界 2”用 256 输出预算跑通三轮连续 `max-token` 并补齐，不再作为未覆盖项。

**备份**：`D:\project-test3\jg-pre-checkpoint-20261124-1020-server.mjs`；受控输出预算改动前备份 `D:\project-test3\jg-pre-maxtokens-20261124-1028-harness.mjs`。

## 四、5 个已知边界收口（2026-11-24）

### 边界 1：同项目只读任务被一并串行化 → 已改为项目读写锁

原实现用一个 `chatRunProjectLocks` Map 按 `projectId` 全量串行，读任务也必须等写任务结束。现在每个 `chat-run` 任务带 `accessMode`（`read` / `write`），项目锁记录 `{writer, readers}`：

- 只读任务可以共享同一项目的读锁，与另一个只读任务并发；
- 写任务必须独占，存在任何 reader 或已有 writer 时不放行；
- 已有写任务在排队时，新的只读任务让路，避免写饥饿；
- 未显式声明 `accessMode` 的请求继续按 `write` 处理，不把真实写入误判成只读；
- `MAX_CHAT_RUNS=2` 全局并发上限不变，跨项目仍可并行。

验证：两个 `accessMode=read` 任务 `TR-1795489069707-176` / `TR-1795489069808-451` 同时 `running / queuePosition=0` 并均 `done`。两个写任务 `TR-1795490127278-214` / `TR-1795490127392-219` 的时间线为 A 12.787s 启动、14.165s 结束，B 14.218s 才启动、15.518s 结束；B 在前一个释放项目锁后才启动，两个均 `done`、回复 `WSER_A` / `WSER_B`。测试任务已清理，恢复 40 / 34。

### 边界 2：更长连续触顶链 → 已跑通三轮连续 `max-token`

原先只验证到连续两轮。本轮把输出预算收紧到 256，任务 `TR-1795489586085-923` 首轮写入文件后输出 `SECTION-1`–`64` 触顶；第一次恢复 `TR-1795489629140-720` 再次 `max-tokens / interrupted`；第二次恢复 `TR-1795489681479-271` 仍为 `max-tokens / interrupted`。三次连续轮次均保留 `finishReason=max-tokens`，形成三轮连续链。

重启默认预算后，第三次恢复 `TR-1795489732839-211` 从 `SECTION-65` 补到 `SECTION-200`，最终 `done`，回复明确“补齐 65–200 共 136 行”。`checkpoint-maxtok3plus2.txt` 全文始终只有 `CP3P_BASE`（9 字节），没有被重复写入。

### 边界 3：`failed` + 新检查点字段未组合测试 → 已用运行时崩溃样本重跑

原失败恢复样本产生于检查点字段加入之前，只验证了“失败任务能恢复”，没有验证“失败任务的检查点字段能被恢复链读取”。本轮构造了一个真实 `failed` 样本：

1. 任务 `TR-1795489782452-608` 先写入 `docs/worktest/checkpoint-failed-resume.txt=FAIL_BASE`；
2. 模型继续执行 `pwsh Start-Sleep -Seconds 30`，在等待中强杀本次 DSH 子进程；
3. 任务进入 `failed`，原因“DeepSeek Harness runtime exited”；检查点已包含 `phase=failed`、`stepsCompleted=1`、`lastTool=pwsh`、`dshSessionId`、`partialReply`；
4. 用 `POST /api/tasks/resume` 恢复出 `TR-1795489843465-587`。恢复提示读取这些字段后判断“文件已写入、等待时间已消耗”，只读确认文件内容，补 `FAIL_DONE`，最终 `done`，没有重复写入或重复等待。

文件最终仍为单行 `FAIL_BASE`（10 字节），证明失败态与新检查点字段组合可恢复。

### 边界 4：执行记录超过 100 条没有“查看全部” → 已补入口

后端 `GET /api/tasks` 本来就返回项目全部任务，截断只发生在前端 `openProject()` 的 `slice(0, 100)`。本轮保留默认 100 条的性能边界，但增加：

- 默认显示最近 100 条，底部提示当前总数与显示条数；
- “查看全部 N 条”按钮在已加载的完整列表上直接展开，不重复请求；
- 展开后底部显示“已显示全部 N 条”，并提供“收起”回到最近 100 条；
- `projectTaskPageSize` 常量集中管理默认值，当前为 100。

验证用项目 101 条执行记录（40 条真实 + 61 条临时合成）：详情先渲染 100 行并显示“查看全部 101 条”；点击后任务容器 101 行、底部“已显示全部 101 条执行记录”；再点“收起”回到 100 行。验证后删除 61 条合成记录，项目恢复 40 任务 / 34 线程。

### 边界 5：登录态固定 8 小时无续期 → 已改滑动续期并补到期提示

会话仍默认 8 小时 TTL，但不再“从登录时刻固定倒计时”：

- `db.mjs` 增加 `extendSession`，每个通过认证的 API 请求把 `last_seen` 和 `expires_at` 后移；
- 响应重发 `jg_sid` cookie，`Max-Age` 同步延长，并带 `x-session-expires` 响应头；
- `GET /api/bootstrap` 返回 `session.expiresAt` / `lastSeen`，前端启动时用该值初始化计时；
- 前端 `scheduleSessionExpiry()` 在剩余 10 分钟时提示“登录状态将在约 N 分钟后到期；继续操作会自动续期，避免长时间闲置”；
- 任意活跃请求都会重排计时，长时间闲置才会真正过期。

验证：两次请求间隔 9.1 秒，`x-session-expires` 同步后移 9.1 秒；临时把 TTL 调到 60 秒后，页面实际弹出“登录状态将在约 1 分钟后到期；继续操作会自动续期”；恢复 8 小时后响应头 TTL 回到约 8 小时，页面不再出现过期提示。

### 追加缺陷：附件已上传但空文本发送被拦截

现象是输入框里已经有 Word 附件 chip，但点击发送仍弹出“请输入内容，或粘贴图片附件”。根因有两层：

1. `sendFromChat()` / `submitTask()` 只检查 `composerPrompt('')`，完全不看 `state.composerRefs`；附件 chip 再存在也被当作空输入拦截。
2. 服务端 `POST /api/chat` 同样要求 `text` 非空；即使前端放行，也会 400。并且附件只存在附件库，Work 代理扫描项目 cwd 时看不到 `.docx`，于是模型继续要求重新上传。

修复为：

- 有附件、无文字时自动生成发送指令：“请处理我上传的附件「文件名」；如果我上一条消息已有要求，就按上一条要求执行。”
- 服务端对 `refs` 非空但 `text` 为空的请求做同样兜底，不再 400；纯 API 调用也能发附件。
- 会话开始时把有权限的 `file` ref 落到当前工作区 `.jg/chat-attachments/<会话>/`，并在模型上下文写明“已落盘到当前工作区”和绝对路径、文件 ID；`.jg` 不进入文件树，不污染项目展示。

实测结果：`C-1795491100000` 仅发送 `text=''` + `ATT-MWU4QVJB-40F37EA9`，返回 200；任务回复文件名、正文第一段和 82 个非空段落，原文件保持 51035 字节未被修改。浏览器拖入同一 Word 后不输入文字直接点发送，不再出现该提示，任务正常创建。

### 回归与清理

- 5 项边界修改 + 附件发送修复均在最终服务 PID 18244 上加载，`127.0.0.1:54269` 健康，最终错误日志 0 字节。
- 所有测试任务、会话、检查点文件已清理；项目恢复 40 任务 / 34 线程，`docs/worktest` 恢复 10 个基线文件。
- 成果检查 `POST /api/projects/verify`：`status=ok`、`files=11`、`conflicts=0`、`warnings=0`。
- 只读并发目前由 API 的 `accessMode:'read'` / `readOnly:true` 声明；普通 Work UI 仍按写任务串行，这是为了避免把实际写操作误判为只读的安全默认，不属于未修复缺陷。

## 五、验收建议

1. 同项目串行化已从“全量串行”升级为项目读写锁：只读任务可并发、写任务独占。当前只读并发由 API 声明 `accessMode`，UI 暂无只读开关；可先按此验收，若产品要求普通只读任务也自动并发，再单独加 UI 判定。
2. 检查点续写已通过重启中断、纯等待、单次 `max-token`、连续两轮和本轮连续三轮 `max-token` 回归；三轮中后两轮低预算只输出占位、未推进正文，属模型在 256 预算下的真实表现，状态链与最终补齐均成立。
3. 登录态已改为活跃请求滑动续期，并在到期前 10 分钟提示；8 小时 TTL 只作为“长时间闲置”上限，不再从登录时刻固定倒计时。
4. 执行记录已补“查看全部 / 收起”，默认仍只渲染最近 100 条；不再需要独立任务中心才能看旧记录。
5. `failed` 终态 + 新检查点字段已用强杀 DSH 子进程的真实样本重跑通过；对外可按“运行中断可续写、失败可恢复”表述。
6. 附件发送已补“有附件即可发送”，并把附件落盘到当前工作区；普通 Word/PDF/图片附件不再要求用户重复输入文字或重新上传。

## 六、测试资产

- 正式服务代码：`D:\project-test3\jg-client-1.0\server.mjs`
- 测试沙箱：`D:\project-test3\worktest-lab-20261123`
- 测试产物：`docs/worktest/hello.md`、`notes.md`、`app-js-subtract-proposal.md`、`q1.txt`、`q2.txt`、`q3.txt`、`q7.txt`、`q8.txt`、`q9.txt`、`race-counter.txt`
- 隔离工作树：`D:\project-test3\jg-client-1.0\data\worktrees\PRJ-4E633D\isolated-2a70a1`（分支 `worktest/isolated`）
- 测试脚本：`D:\project-test3\g-work-request.mjs`
- 服务日志（历史）：`D:\project-test3\jg-main-server-final.log` / `.err.log`（PID 39080，附件修复前）；当前最终服务日志为 `jg-main-server-attachmentfix.log` / `.err.log`（PID 18244，err 0 字节）。连续续写前序 `jg-main-server-maxtok5.log` / `.err.log`（PID 53800，`JG_DSH_MAX_TOKENS=768`）、`jg-main-server-maxtok4.log` / `.err.log`（PID 28344，512 首轮）、`jg-main-server-maxtok-resume.log` / `.err.log`（PID 54264）、`jg-main-server-maxtok3.log` / `.err.log`（PID 56608）、`jg-main-server-maxtok2.log` / `.err.log`（PID 57072）、`jg-main-server-maxtok.log` / `.err.log`（PID 52256）；`jg-main-server-checkpoint6.log` / `.err.log`（PID 17824）、`jg-main-server-checkpoint5.log` / `.err.log`（PID 29676）、`jg-main-server-checkpoint4.log` / `.err.log`（PID 57800）、`jg-main-server-checkpoint3.log` / `.err.log`（PID 26840）、`jg-main-server-checkpoint2.log` / `.err.log`（PID 28712）、`jg-main-server-checkpoint-resume.log` / `.err.log`（PID 31432）、`jg-main-server-checkpoint-restart.log` / `.err.log`（PID 50572）、`jg-main-server-checkpoint.log` / `.err.log`（PID 49200）、`jg-main-server-queuerecover3.log` / `.err.log`（PID 49072）、`jg-main-server-cancelwait.log` / `.err.log`（PID 52148）、`jg-main-server-failrecover.log` / `.err.log`（PID 58176）、`jg-main-server-failprobe.log` / `.err.log`（PID 56384，`JG_MAX_TOOL_CALLS=1`）、`jg-main-server-restartprobe.log` / `.err.log`、`jg-main-server-projectlock.log` / `.err.log`、`jg-main-server-sseguard.log` / `.err.log`、`jg-main-server-queuefix.log` / `.err.log`
- 修改前备份：`jg-pre-aclfix-20261123-2215-server.mjs`、`jg-pre-artifactfix-20261123-2225-server.mjs`、`jg-pre-queuefix-20261124-0831-server.mjs`、`jg-pre-uifix-20261124-0831-app.js`、`jg-pre-sseguard-20261124-0908-server.mjs`、`jg-pre-projectlock-20261124-0920-server.mjs`、`jg-pre-sidebarrefresh-20261124-0935-app.js`、`jg-pre-resumestate-20261124-0943-app.js`、`jg-pre-cancelwait-20261124-1008-server.mjs`、`jg-pre-queuerecover-20261124-1007-server.mjs`、`jg-pre-checkpoint-20261124-1020-server.mjs`、`jg-pre-maxtokens-20261124-1028-harness.mjs`
- 本轮新增并发回归任务：`TR-1795481728707-610`、`TR-1795481728823-228`、`TR-1795481728923-303`（会话 `C-1795481728705`、`C-1795481728821`、`C-1795481728923`）
- SSE 断流任务：`TR-1795482196110-584` / `C-1795482196103`；重启后正常只读任务为第 32 条
- 同文件读改写缺陷样本：`TR-1795482899374-912` / `C-1795482899374`、`TR-1795482899488-642` / `C-1795482899488`
- 串行化修复验证：`TR-1795483099894-341` / `C-1795483099887`（先）、`TR-1795483100004-241` / `C-1795483100003`（后）
- 跨项目并行验证：`TR-1795483307882-258` / `C-1795483307881`（`PRJ-7689B3`）、`TR-1795483308002-316` / `C-1795483308001`（`PRJ-4E633D`）
- 重启恢复验证：`TR-1795483654613-581` / `C-1795483654612`（`Start-Sleep 90`，执行到 20% 时强杀服务）
- 失败样本：`TR-1795484437976-954` / `C-1795484437974`（`STEP_BUDGET_EXCEEDED`）；恢复任务 `TR-1795484518709-433`，回复 `FAIL_PROBE_DONE`
- 100 条上限验证：临时会话 `C-1795485061901` 连发 62 条直连任务，总数到 102；验证后已删除全部 62 条任务和临时会话，当前回到 40 任务 / 34 线程
- 排队取消防复：缺陷现场 `TR-1795485611862-294` / `C-1795485611861`（A）、`TR-1795485612980-267` / `C-1795485612980`（B，取消后仍 qp1）、`TR-1795485613998-636` / `C-1795485613997`（C，仍 qp2）；修复后 `TR-1795485727535-706` / `C-1795485727525`（A）、`TR-1795485728679-586` / `C-1795485728677`（B，取消 15ms 后 qp0）、`TR-1795485729702-515` / `C-1795485729701`（C，立即前进 qp1）；延迟样本 `TR-1795485768834-427` / `C-1795485768834`（D，取消后 21ms 流结束）、`TR-1795485769471-715` / `C-1795485769471`（E，从 qp2 前进 qp1）。以上任务与会话已全部删除；正常排队回归 `TR-1795485868160-928` / `C-1795485868159`（QREG_A）、`TR-1795485868765-649` / `C-1795485868765`（QREG_B）均 `done`，已删除并恢复 40 / 34
- 排队重启恢复验证：修复前 `TR-1795486009887-825` / `C-1795486009886`（running）、`TR-1795486010844-823` / `C-1795486010843`（queued / 1，恢复后仍 qp1）；修复后 `TR-1795486087765-306` / `C-1795486087751`（running）、`TR-1795486088730-642` / `C-1795486088728`（queued / 1，恢复后 qp0）。两次均强杀并重启，测试任务与会话已删除
- 检查点续写验证：`TR-1795486749983-945` → `TR-1795486833738-204`（`checkpoint-resume.txt`，`CP_BASE=ready` + `CP_DONE`）；`TR-1795486911896-338` / `C-1795486911889`（15 秒等待，命令正常完成）；`TR-1795486968128-527` → `TR-1795487005294-719`（60 秒纯等待，恢复时重新等待后追加 `CP3_DONE`）；`TR-1795487133694-876` → `TR-1795487169233-300`（20 秒纯等待，恢复提示跳过等待，追加 `CP4_DONE`）。以上任务、临时会话和 4 个测试文件均已清理，恢复 40 任务 / 34 线程
- max-token 续写验证：`TR-1795487646556-573` / `C-1795487646515` 在 `JG_DSH_MAX_TOKENS=512` 下先写 `checkpoint-maxtok2.txt` 的 `MAXTOK2_BASE=ready`，随后输出到 `SECTION-21` 触发 `max-tokens`；检查点保留 1 个已完成工具步骤、文件路径、`lastTool=write` 和输出尾部。重启为 PID 54264 后恢复任务 `TR-1795487707876-950` 先读文件确认，再续写 `SECTION-22` 至 `SECTION-40`，最终 `done`；测试任务、会话和 3 个 `checkpoint-maxtok*` 文件已清理
- 连续两轮 max-token 验证：`TR-1795488353862-625`（输出 1–17 段后触顶）→ `TR-1795488380531-325`（输出 19–41 段后再次触顶）→ `TR-1795488420880-223`（继承 19–41 段尾部，补 41–80 段后 `done`）；768 预算下前两轮中断，重启默认预算后第三轮完成。三轮均未重写 `checkpoint-maxtok3.txt`，测试任务、会话和文件已清理
- 5 个边界回归（2026-11-24）：
  - 只读并发：`TR-1795489069707-176` / `C-1795489069650`、`TR-1795489069808-451` / `C-1795489069651`，均 `accessMode=read`、`queuePosition=0`、`done`。
  - 写任务独占：`TR-1795489099603-254` / `C-1795489099600` 与 `TR-1795489099710-460` / `C-1795489099601` 早期样本；无中断干净样本 `TR-1795490127278-214` / `C-1795490127214`（12.787s–14.165s）、`TR-1795490127392-219` / `C-1795490127215`（14.218s–15.518s），后者在前者结束后才启动，均 `done`。以上测试任务与会话已删除，恢复 40 / 34。
  - 三轮连续 max-token：`TR-1795489586085-923` / `C-1795489586016`（首轮 1–64 触顶）→ `TR-1795489629140-720`（再次触顶）→ `TR-1795489681479-271`（再次触顶）→ `TR-1795489732839-211`（默认预算补 65–200，`done`）；文件 `docs/worktest/checkpoint-maxtok3plus2.txt` 已删除。
  - `failed` + 新检查点字段：`TR-1795489782452-608` / `C-1795489782449`（强杀 DSH 子进程后 `failed`）→ `TR-1795489843465-587`（`done`，只读确认 `FAIL_BASE`，补 `FAIL_DONE`）；文件已删除。
  - 101 条查看全部：临时注入 `SYN-EDGE-001`–`SYN-EDGE-061`，项目到 101 条；验证“查看全部 101 条” / 101 行 / “已显示全部 101 条” / 收起回 100 行后，合成任务已全部移除。注入前备份 `data\jg.sqlite.edge100.bak`。
  - 会话续期：TTL 临时 60 秒（PID 51728）实测 toast；恢复 8 小时后响应头 TTL 约 8 小时。
- 本轮新增备份：`jg-pre-rwlock-20261124-1130-server.mjs`、`jg-pre-session-20261124-1130-db.mjs`、`jg-pre-uits-20261124-1130-app.js`、`data\jg.sqlite.edge100.bak`
- 本轮新增服务日志：`jg-main-server-final.log` / `.err.log`（PID 39080，5 项边界版，err 0 字节）、`jg-main-server-edge100.log` / `.err.log`（PID 56744）、`jg-main-server-maxtok3final.log` / `.err.log`（PID 47520）、`jg-main-server-maxtok3b.log` / `.err.log`（PID 20324，256 预算）、`jg-main-server-maxtok3.log` / `.err.log`（PID 56580，512 预算）、`jg-main-server-sessionwarn.log` / `.err.log`（PID 51728，60 秒 TTL）、`jg-main-server-rwlock.log` / `.err.log`（PID 4028）、`jg-main-server-attachmentfix.log` / `.err.log`（PID 18244，附件发送修复，err 0 字节）
- 附件发送回归样本：会话 `C-1795491100000`（测试用，已删除）；前置指令 + `text=''` / `refs=[ATT-MWU4QVJB-40F37EA9]`；附件落盘 `worktest-lab-aclprobe\.jg\chat-attachments\C-1795491100000\关于赴宁波调研停车管理与运维情况的报告.docx`（51035 字节，已清理）；任务 `TR-1795490890571-790` / `TR-1795490917024-307` 已删除。浏览器拖入同一 Word 后空文本发送样本 `C-1795490974943944` / `TR-1795490975022-218`，任务已取消、会话已删除
- 附件发送修复备份：`jg-pre-attachment-send-20261124-1130-server.mjs`、`jg-pre-attachment-send-20261124-1130-app.js`
