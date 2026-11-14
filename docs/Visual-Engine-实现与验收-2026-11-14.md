# Visual Engine 实现与验收记录

日期：2026-11-14
工程：`D:\project-test3\jg-client-1.0`
运行地址：`http://127.0.0.1:54649/`

## 一、实现范围

Visual Engine 作为九规智能中枢的原生基础能力接入现有聊天链路，不新建独立聊天系统，不改变现有聊天模式、工作模式、插件与工具体系。

已实现：

1. 服务端可视化资源：Mermaid、ECharts、SVG、安全声明式交互组件四类。
2. 模型工具：`visual_create`、`visual_update`、`visual_get`、`visual_export`、`visual_save`，经 DSH MCP 暴露为 `mcp__jg__visual_*`。
3. 聊天消息内直接渲染：图形作为消息内容的一部分，与文字混排，不显示 Mermaid/ECharts/SVG 源码。
4. 展示交互：自适应宽度、Mermaid 自然宽度横向滚动、点击放大、缩放/平移、复制图片、PNG/SVG 导出、源码与版本查看、保存成果。
5. 连续编辑：模型优先复用会话内已有对象 id，更新生成新版本，保留未要求修改的节点和数据。
6. 版本管理：资源主表与版本表分离，支持恢复历史版本；恢复失败不覆盖当前有效版本。
7. 持久化：刷新或重新进入会话后，消息内图形从 SQLite 恢复；长期成果在“可视化成果”列表中可再次打开。
8. 安全校验：Mermaid 危险指令拒绝；ECharts 仅接受白名单声明式配置；SVG 拒绝脚本、事件处理器、外部资源和危险实体；交互组件仅支持固定贷款公式与数字参数。
9. 普通问答不强制出图；用户明确要求绘图或图形表达更清楚时由模型调用工具。
10. SVG/PNG 导出使用浏览器内实际渲染结果，不依赖外部商业可视化服务。

## 二、主要文件

新增：

- `visuals.mjs`：类型白名单、长度/节点上限、Mermaid 检查、ECharts 校验、SVG 清理与拒绝、交互组件校验。
- `public/visuals.js`：聊天卡片、Mermaid/ECharts/SVG/交互组件渲染、放大浮窗、导出、源码/版本、成果保存与恢复。
- `public/visuals.css`：卡片、浮窗、源码、版本、成果列表、交互组件、深色主题适配。
- `public/vendor/mermaid.min.js`、`public/vendor/echarts.min.js`：自托管渲染库。
- `tests/visual-engine.test.mjs`：安全校验单元测试。

修改：

- `server.mjs`：`/api/visuals`、`/api/visuals/versions`、`/api/visuals/save`、`/api/visuals/restore`；`/api/ai/invoke` 的 `visual_*` 分支；系统提示词与工具兜底。
- `db.mjs`：`visual_artifacts`、`visual_versions` 表及创建/更新/保存/恢复函数；恢复已保存成果时保留自定义标题。
- `harness.mjs`：解析 `tool/ptc-dispatch` 与 `tool/result` 中的可视化结果。
- `mcp-jg.mjs`：注册 5 个可视化 MCP 工具及 JSON Schema。
- `data.mjs`：工具目录中加入可视化工具说明。
- `public/app.js`：聊天消息视觉块、渲染入口、顶部“可视化成果”入口、`window.JGVisualHost`。
- `public/index.html`：加载自托管 Mermaid/ECharts、`visuals.css`、`visuals.js`。
- `package.json` / `package-lock.json`：增加 `echarts`、`mermaid` 依赖及 `test:visual` 脚本。

## 三、调用关系

1. 用户自然语言进入 `/api/chat`。
2. DSH 模型判断需要图形，调用 `mcp__jg__visual_create` / `visual_update`。
3. MCP 桥接 `mcp-jg.mjs` 转发到 `/api/ai/invoke`。
4. 服务端校验类型、源码、长度与安全规则，写入 `visual_artifacts` 与 `visual_versions`，返回对象 id、类型、版本、标题。
5. `harness.mjs` 将工具结果（含 PTC 派发）收集为消息 `visuals` 引用。
6. 前端 `visuals.js` 按 id 拉取源码，在聊天卡片内用 Mermaid/ECharts/SVG/安全 DOM 渲染。
7. 放大、导出、源码、版本、保存等操作复用现有浮窗与工作区视觉语言。

## 四、实际验证结果

已验证：

- 场景 A：真实聊天生成“普通数据 / 成果数据 / 数据服务登记流程”Mermaid 流程图，中文节点、分支、子图正常显示。
- 场景 B：真实聊天生成 2023/2024/2025 年金额 100/150/180 万元 ECharts 柱状图，柱顶数值与单位正确。
- 场景 C：同一会话要求“把刚才的柱状图改为折线图”，复用同一对象 id 生成 v2，数据未重复提供，聊天卡片显示折线图。
- 场景 D：保存长期成果后刷新页面并重新进入会话，卡片、成果列表与再次打开均正常；恢复历史版本后源码/版本面板立即刷新。
- 场景 E：真实聊天生成可调金额、利率、期限的贷款计算器；实测利率 4.2%→5.5%、期限 20→30 年，月供从 ¥6,166 变为 ¥6,879/¥5,678。
- 场景 F：包含 `<script>`、事件处理器、外部资源引用的 SVG 经 `/api/ai/invoke` 返回 422 `VISUAL_SVG_UNSAFE`；非法 Mermaid 在聊天卡片显示“图形暂时无法显示”、解析错误和“重试”，其他消息不受影响；随后恢复有效版本。
- 普通问答“用一句话说明你能做什么，不需要画图”未新增图形，消息数保持不变。
- PNG 导出实际落盘：`C:\Users\46198\Downloads\2023-2025_年金额柱状图.png`，46,035 bytes，读图确认为柱状图。
- SVG 导出实际落盘：`C:\Users\46198\Downloads\普通数据_成果数据_数据服务登记流程.svg`，50,879 bytes，读文件确认为合法 `<svg>` 且不含 `<script>`。
- 放大浮窗在 718×763 视口内完整显示，关闭按钮与缩放工具栏可见。
- 未登录访问 `/api/visuals?id=...` 返回 401 `AUTH_REQUIRED`。

自动化：

- `npm run test:visual`：5 项通过，覆盖 Mermaid 危险指令、ECharts 非声明式类型、SVG 脚本/事件/外部资源、交互组件参数限制、未知类型与空源码错误码。
- `node --check` 通过：`visuals.mjs`、`server.mjs`、`db.mjs`、`harness.mjs`、`mcp-jg.mjs`、`data.mjs`、`public/visuals.js`。

## 五、未完成与明确边界

1. 任意 HTML/React 沙箱尚未开放。当前第三阶段只提供安全的声明式交互组件（贷款计算器：滑块 + 固定公式），没有 iframe/CSP/sandbox 的任意代码执行环境。这是有意的安全降级，符合“现有安全架构不足时先完成声明式能力”的要求。
2. 交互组件当前只覆盖贷款计算器一类；更复杂的按钮、滑块、参数控制与数据分析界面尚未实现。
3. 复制图片未单独做文件级验收；导出 PNG/SVG 已真实落盘。
4. 跨账号越权只做了未登录 401 验证，未用第二个真实账号做 owner 越权请求验证；服务端已有 owner 校验代码。
5. `visual_save` 目前落在 `visual_artifacts.status='saved'`，尚未合并到项目/文件/成果库的统一管理。
6. 没有自动化浏览器 E2E 回归；真实聊天、DOM 检查、截图与 API 调用为主要验证手段。
7. 旧消息的历史 `visuals` 引用未回填；新消息会携带引用。
8. ECharts 卡片标题由模型给定，可能与内部标题不完全同步，前端不会擅自改标题。

## 六、部署与配置

- 运行：`D:\project-test3\jg-client-1.0\runtime\node.exe server.mjs`，`PORT=54649`。
- 依赖：`echarts ^5.6.0`、`mermaid ^11.17.2`，已自托管到 `public/vendor/`，不依赖第三方商业 API。
- 健康检查：`GET /api/health`。
- 数据库：SQLite，表 `visual_artifacts`、`visual_versions`。
- 测试：`npm run test:visual`。
- 若需重新生成 vendor：可从 `node_modules/echarts/dist/echarts.min.js` 与 `node_modules/mermaid/dist/mermaid.min.js` 复制到 `public/vendor/`。
