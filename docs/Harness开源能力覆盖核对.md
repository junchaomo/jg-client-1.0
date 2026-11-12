# DeepSeek Harness 开源能力覆盖核对

> **2026-11-11 更新**：本文件是 V2.0 统一入口改造前的基线，端口与部分结论已过时。V2.0 后的最新盘点和未落实项以 [`Harness能力盘点-V2.0.md`](./Harness能力盘点-V2.0.md) 为准。

核对时间：2026-11-11
运行实例：`D:\project-test3\jg-client-1.0`，管理员模式，端口 `60392`
运行时：`@deepseek-ai/dsh@0.2.2-rc.1`、`@deepseek-ai/dsh-sdk-client@0.2.2-rc.1`（registry 当前 `latest` 同为 `0.2.2-rc.1`）

## 结论

**不是“全部能力都已落实”。**

准确说法是：

- **Agent 运行时层**：sdk profile 已把开源版的核心 agent 能力基本挂齐，包括文件、shell、技能、MCP、审批、提问、计划模式、目标、子代理、工作流、待办、后台作业、联网、定时任务、压缩、交付物引用等。
- **产品控制面层**：已接通对话、模型、推理强度、停止、审批、提问、斜杠命令、定时任务、技能/MCP、文件与终端；本轮又补上计划评审、待办清单、后台作业概览、交付物卡片。子代理会话正文、工作流阶段视图、权限预设切换、插件管理、MCP 资源浏览、会话全文检索、目标面板仍没有产品入口。
- **官方 Web 客户端 UI 层**：`dsh-client-ui-*` 这一整套图形界面没有被 sdk profile 挂载。sdk profile 明确“不启动 Web server、没有图形客户端”，产品界面是自建的，所以不能把官方 Web 端的全部界面能力算作已部署。

所以答案是：**核心 agent 能力大部分已部署，但不是“全部开源能力”都已产品化。**

## 四层核对

### 1. 版本

| 包 | 版本 | registry latest |
|---|---|---|
| `@deepseek-ai/dsh` | `0.2.2-rc.1` | `0.2.2-rc.1` |
| `@deepseek-ai/dsh-sdk-client` | `0.2.2-rc.1` | `0.2.2-rc.1` |

版本不是旧包。

### 2. profile 实际挂载

- 当前只有 `sdk` 一个 profile。
- bundles：`@deepseek-ai/dsh-base` + `@deepseek-ai/dsh-sdk-app`。
- 用户 patch：只 `insert` 了一个 `mcp-jg` MCP server。
- 通过 `dsh --profile sdk --dump-config` 核对，实际组合里能看到：
  - `plan-mode`、`goal`、`goal-round-driver`、`command-goal`
  - `subagent`、`subagent-spawn-in-process`、`subagent-fork-in-process`、`tool-subagent`、`tool-subagent-fork`、`tool-subagent-control`
  - `jobs`、`tool-jobs`
  - `workflow-ptc`、`tool-workflow`
  - `tool-todo`
  - `tool-ask-user`、`user-questions`
  - `dsh-user-approval`、`permission-presets`
  - `tool-pwsh`（Windows；`tool-bash` 按平台禁用）
  - `tool-fs`、`tool-fs-search`、`tool-skill`
  - `web`、`web-search-deepseek`、`web-fetch-http`、`tool-web`
  - `schedule`、`tool-schedule`
  - `present`、`file-reference-local`、`deliverable-file-references`
  - `mcp-resources`、`mcp-client`（产品插入的 `mcp-jg`）
  - `compaction-basic`、`command-compact`、`tool-result-pruner`
  - `session-persistence-jsonl`、`session-projection-cache`、`session-checkpoint-policy`
- 明确禁用/未启用：
  - `bash-sandbox`、`tool-bash`：Windows 平台禁用，实际用 pwsh。
  - `tool-executor-ptc`：禁用，只用 native executor。
  - `session-query-sqlite`：`openAt: never`，全文检索关闭。
  - `tool-fs.applyPatch: false`，不提供 apply_patch。
  - `hmr`、`session-title-llm`：sdk 组合包主动禁用。
  - `skill-office`、`workspace-dependencies`：依赖 `DSH_PRIMARY_RUNTIME`，当前未设置，未挂载。

### 3. SDK 适配层

`harness.mjs` 已接通的通道：

- `approvalRequests` + `approval/request` 审批回调
- `user-question/ask` 提问回调
- 图片内容块 `image` 输入
- 斜杠命令原样路由（不拼上下文）
- `tool/call`、`tool/result` 工具事件
- `plan/mode` 计划模式事件
- `compaction/start`、`compaction/end` 压缩事件
- `subagent.started`、`subagent.finished` 子代理通知
- `resumeSession` 会话恢复
- `closeHarness` 取消（关闭子进程）

尚未映射成结构化 UI 的：

- `workflow` 工作流阶段
- `mcp-resources` 资源列表
- 子代理完整会话内容（目前只有开始/结束两行步骤）

已映射成结构化 UI 的：`todo_write` 清单状态、`jobs` 后台作业、`present` 交付物卡片、计划评审专用卡片。

### 4. 产品暴露

## 能力矩阵

图例：✅ 已实测可用；🟡 后端已挂载，产品只部分暴露或未验证；❌ 未启用/不可用。

| 能力 | 运行时 | 产品入口 | 状态 | 说明 |
|---|---|---|---|---|
| 对话、模型、推理强度 | 已挂 | 首页/会话页 | ✅ | 低/中/高三档映射 off/low/high；实测回复 |
| 停止生成 | SDK 关闭进程 | 会话页停止按钮 | ✅ | 已验证停止与迟到结果隔离 |
| 会话恢复/删除 | session persistence | 侧栏 | ✅ | 重启后 `resumeSession`；删除走 API |
| 文件读写/搜索 | `tool-fs`、`tool-fs-search` | 模型工具 | ✅ | read/write/edit/glob/grep 已挂载 |
| Shell / PowerShell | `tool-pwsh` | 模型工具 | ✅ | 管理员模式实测 `echo admin-test` |
| 命令审批 | `dsh-user-approval` | 审批卡 | 🟡 | 拒绝路径实测；「允许一次」仍未点 |
| 用户提问 | `tool-ask-user` | 问答卡 | ✅ | 选项/自定义/取消已实测 |
| 技能 | `tool-skill` + 技能根 | 技能页/模型 | ✅ | `jg-product` + `.agents/skills` 已加载 |
| 产品 MCP 工具 | `mcp-jg` | 模型工具 | ✅ | 10 个 `mcp__jg__*` 工具 |
| 定时任务 | `schedule`、`tool-schedule` | 定时任务页 | ✅ | 创建、暂停、启用、删除已真实写盘 |
| 上下文压缩 | `compaction`、`/compact` | 步骤/斜杠命令 | ✅ | `/compact` 实测 |
| 计划模式 | `plan-mode` | 计划评审卡 | ✅ | `/plan`、`/plan off` 实测；`exit_plan_mode` → 「计划评审」卡（计划正文 + 批准执行/继续规划），批准后回复「计划已提交并获批准」；斜杠菜单仍未列 `/plan` |
| 目标 | `goal`、`/goal` | 无专门 UI | 🟡 | `/goal` 实测可用；无目标面板 |
| 子代理 | `subagent`、`subagent_fork` | 步骤两行 | 🟡 | 只能看到 started/finished，无子会话正文/列表 |
| 待办清单 | `tool-todo` | 任务清单块 | ✅ | 会话页渲染「任务清单 · N/M 完成」，进行中/待办/已完成三态；`todo/write` 不在 SDK `result.events` 时从 `todo_write` 调用参数兜底 |
| 后台作业 | `jobs`、`tool-jobs` | 后台作业块 | ✅ | 会话页渲染「后台作业 · N」，显示 id、kind、running/completed、label、detail；尚无作业面板/停止按钮 |
| 工作流 | `workflow-ptc`、`tool-workflow` | 无 | 🟡 | 工具可用，结果只落普通步骤 |
| 交付物 `present` | `present`、deliverable refs | 交付物卡片 | ✅ | `present` 后在气泡下方渲染文件名 + 「打开」，经 `GET /api/harness/file` 取回原文件（限 `data/dsh-workspace`） |
| 联网搜索/抓取 | `tool-web` | 无开关/来源面板 | 🟡 | 模型可调用；产品无独立联网状态与来源视图 |
| 权限预设 | `permission-presets` | 无 | 🟡 | 三档预设已挂载，产品只有按次审批，无模式切换 |
| MCP 资源 | `mcp-resources` | 无 | 🟡 | 只用了 MCP 工具，没有资源浏览 |
| 插件管理 | `plugin_manager` | 产品插件页是自建 | 🟡 | 运行时工具存在，pnpm 存在；产品插件安装不走 DSH 插件系统 |
| 会话全文检索 | `session-query-sqlite` | 侧栏搜索 | ❌ | `openAt: never`，只能按标题/项目匹配 |
| Office 技能 | `skill-office` | 无 | ❌ | 缺 `DSH_PRIMARY_RUNTIME`，未挂载 |
| PTC 执行器 | `tool-executor-ptc` | 无 | ❌ | 显式禁用，native executor only |
| apply_patch | `tool-fs.applyPatch` | 无 | ❌ | 配置关闭，只有 edit/write |
| 官方 Web 客户端 UI | `dsh-client-ui-*` | 无 | ❌ | sdk profile 不挂 Web UI；产品界面为自建子集 |

## 差距排序

### P0：模型已经在用、用户却看不见（本轮已补 4 项）

1. ~~**计划评审**~~ 已落地：`exit_plan_mode` 触发「计划评审」卡，计划正文 + 批准执行/继续规划；批准后回写 `allowed-once`，计划模式退出。
2. ~~**待办清单**~~ 已落地：会话页「任务清单 · N/M 完成」块，进行中/待办/已完成三态，完成项划掉。
3. ~~**后台作业**~~ 已落地：会话页「后台作业 · N」块，显示作业 id、类型、running/completed、标签与 detail。
4. ~~**交付物**~~ 已落地：`present` 后在气泡下方渲染文件名 + 「打开」，经 `/api/harness/file` 取回原文件。
5. **审批「允许一次」**：拒绝路径已验证，允许路径未点；这是审批闭环的另一半。

### P1：控制面缺失

6. 子代理列表与子会话正文
7. 工作流阶段/节点可视化
8. 权限预设切换（只读 / 工作区写 / 完全访问）
9. 会话全文检索
10. MCP 资源浏览

### P2：低频/增强

11. 目标面板
12. 插件管理走 DSH 插件系统
13. Office 技能挂载
14. PTC 执行器
15. apply_patch

## 已验证证据

| 项目 | 结果 |
|---|---|
| `/plan` | 返回 `Plan mode on. Use /plan off to leave.` |
| `/plan off` | 返回 `Plan mode off.` |
| `/help` | 返回完整能力概览，含文件、shell、联网、内部系统、交付物、子代理/workflow |
| 计划评审 | `exit_plan_mode` 触发「计划评审」卡；点「批准执行」→ 计划模式退出，回复「计划已提交并获批准」 |
| 待办清单 | `todo_write` 后出现「任务清单 · 0/3 完成」，三行分别为进行中/待办/待办 |
| 后台作业 | `run_in_background` 后出现「后台作业 · 1」，显示 `pwsh-… · running — Start-Sleep -Seconds 30` |
| 交付物 | `present` 后出现 `demo-deliverable.md 打开`；`GET /api/harness/file` 返回 200、`text/markdown` |
| shell | 管理员模式 `echo admin-test` 返回 `admin-test`，无审批卡 |
| 版本 | `dsh=0.2.2-rc.1`，registry latest 同版本 |
| profile | `dsh --profile sdk --dump-config` exit 0，组合项与上表一致 |

## 复现命令

```powershell
$env:DSH_HOME='D:\project-test3\jg-client-1.0\data\dsh-home'
$node='D:\project-test3\jg-client-1.0\runtime\node.exe'
$bin='D:\project-test3\jg-client-1.0\dsh-runtime\node_modules\@deepseek-ai\dsh\lib\bin.js'
Push-Location 'D:\project-test3\jg-client-1.0\data\dsh-workspace'
& $node $bin --profile sdk --dump-config
Pop-Location
```

## 一句话回答

**运行时能力基本齐了，产品化补上了 P0 四项。** 现在仍不能回答“DeepSeek Harness 开源版的功能都已经在智能中枢里落实”；能回答的是“核心 agent 能力已接通，计划评审、待办、后台作业、交付物已进产品界面；审批允许一次、子代理正文、工作流阶段、权限预设、插件管理、MCP 资源、全文检索这些控制面仍是缺口”。
