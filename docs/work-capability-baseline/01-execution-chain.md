# 01 执行链核验记录

核验方式：源码静态只读；日期 2026-11-23。

## 结论

1. 落库与归属：startChatRunTask 创建时写 projectId/projectName（server.mjs:7624-7625）和 checkpoint（7646），随后立即 persist（7653-7655），即创建即落库。归属由 taskProjectId() 统一解析（5439、5474、12879），GET /api/tasks 支持 projectId 过滤（12874-12886）。【代码已实现】
2. 产物计数：decorateProject 只汇总 kind='chat-run' 且属该项目的任务，artifacts 求和，runs/runningRuns/lastRunAt 同源（5474-5484）。countTaskArtifacts 对交付物与变更路径去重，排除 data/、node_modules/、.git/、runtime/ 与 .dsh 运行时目录（7774-7787），完成/中断时写入（7743-7768；14136、14230）。【代码已实现】
3. 恢复语义：仅接受本人、interrupted/failed、原会话存在且不 running 的 chat-run（12904-12913）。202 后后台以原 cookie 自调 /api/chat（7899-7926），带原 conversationId/projectId/mode 和新幂等键；收到响应头即断开观察流（7908-7933）。旧任务不重排，同会话生成新任务；started 后禁止再恢复，requesting 60 秒防重（12910-12913），路由返回 202 见 12917。前端明示不自动重放副作用（public/app.js:20597）。【代码已实现】
4. 前端入口：openProject 拉 /api/tasks?projectId=… 并渲染恢复按钮（app.js:5245-5271、5337-5347）；openTaskRuns 提供恢复确认（20572-20619）。【代码已实现】
5. 并发槽位：MAX_CHAT_RUNS 默认 2（7596），chatRunSlots 为进程级单池、不分 mode（7597-7612）；任务仅以 target 文案区分工作/对话（7623），故 Chat/Work 共用上限。acquire 调用点未读，仍需验证。【部分待验证】
6. 应用自启动：runtimeState 暴露 autoStart/persistent（as-runtime.mjs:476、485）；startApp 复用或冷启成功均写 autoStart:true（516、566-574）；releaseApp 普通释放保留进程，force 才清除（685-694）。触发端未核对。【代码已实现，触发待验证】

## 生产使用判定

生产端已有 258 条任务快照（见 02），其中 work 122 条、done 112 条，说明单会话执行链已经生产使用；但 242 条 chat-run 的 projectId 全空，历史项目化执行没有样本。本项目 `PRJ-1A9AE2` 已跑通 3 条任务链，台账为 `runs=3 / artifacts=3`，属于单项目验证，尚不能算规模化生产使用。恢复与工作树在生产侧均无使用记录。因此：执行链判定“生产已使用”，项目化判定“代码已实现、单项目已验证、未规模化”，恢复与工作树判定“代码已实现、生产未使用”。

## 验证路径

1. 项目归属：对项目 P 发起工作模式任务后请求 GET /api/tasks?projectId=P，预期 projectId=P 且 P.runs/artifacts 增加。
2. 恢复：将 chat-run 置为 interrupted 后 POST /api/tasks/resume，预期 202、resumeState=requesting、同会话出现新 TR 任务；重复恢复 409。
3. 并发：同时发起 2 个工作任务和 1 个对话任务，预期仅 2 个 running、第 3 个 queued，释放后自动补位。

## 复核记录

- 复核时间：2026-11-23 21:09（Asia/Shanghai），源码静态只读复核。
- 核对范围：server.mjs 7590-7940（MAX_CHAT_RUNS、startChatRunTask 项目字段与 checkpoint、countTaskArtifacts、resumeChatRunTask 自调链）与 12860-12929（/api/tasks 列表过滤、/api/tasks/resume 校验与 202 返回）。未复读 5439/5474 与 14000+ 行号段，相关引用沿用上轮结论。
- 核对结果：MAX_CHAT_RUNS 默认值 2（7596）、startChatRunTask 的 projectId/projectName（7624-7625）与 checkpoint.projectId（7646）及创建即 persist（7655）、resumeChatRunTask 的 202 后自调 /api/chat（7911-7926）并收响应头即断开（7933）、resume 路由的 202 返回（12917）均与源码一致。
- 已修正项：① startChatRunTask 项目字段行号由 7624-7626 收窄为 7624-7625（7626 为 worktreePath）；② countTaskArtifacts 排除路径补全为 data/、node_modules/、.git/、runtime/、.dsh 运行时目录，正则为 7774、函数体 7775-7787；③ chatRunSlots 行号由 7597-7611 修正为 7597-7612；④ 恢复语义补充 202 返回行号 12917。
- 结论：已修正（行号偏差与排除路径列举不完整，均已按当前源码改正）。
- 改动范围：本次仅修改本文件 docs/work-capability-baseline/01-execution-chain.md，未新增文件，未改动源码、配置、data 目录与 git 状态。
