# AS v0（应用运行时）最小落地说明

AS 只负责“应用”这一类的发布前台与进程生命周期。技能仍由 DSH 加载，Bundle 仍由 DSH/Cordis 运行，AS 不接管它们的运行时。

## 清单

应用包根目录必须有 `app.json`。包识别优先级：`app.json` → `SKILL.md` → 根 `package.json`。

```json
{
  "id": "as-sample",
  "name": "AS 示例应用",
  "version": "1.0.0",
  "runtime": "node",
  "entry": "server.mjs",
  "appDir": "app",
  "health": { "path": "/health", "timeoutMs": 15000, "intervalMs": 250 },
  "embed": { "method": "browser" },
  "permissions": { "network": ["127.0.0.1"], "filesystem": ["AS_DATA_ROOT"] },
  "capabilities": {
    "tools": [
      {
        "name": "sample.get_state",
        "description": "读取当前账号的应用打开次数、数据目录和进程信息",
        "method": "GET",
        "path": "/api/tools/state",
        "sideEffect": false,
        "inputSchema": { "type": "object", "properties": {} }
      },
      {
        "name": "sample.echo",
        "description": "回显调用参数，用于验证 POST 能力代理",
        "method": "POST",
        "path": "/api/tools/echo",
        "sideEffect": false,
        "inputSchema": { "type": "object", "properties": { "message": { "type": "string" } } }
      },
      {
        "name": "sample.append_note",
        "description": "向当前账号追加一条备注（写操作，需审批）",
        "method": "POST",
        "path": "/api/tools/note",
        "sideEffect": true,
        "inputSchema": {
          "type": "object",
          "properties": { "note": { "type": "string" } },
          "required": ["note"]
        }
      }
    ]
  }
}
```

- `runtime` v0 支持 `node`、`python`。
- `appDir` 与 `entry` 必须在包内，不允许回退到包外路径。
- `permissions` 缺失不会自动拒绝，但会进入人工复核。
- `child_process`、外部 HTTP 地址不会仅凭声明自动放行，静态扫描标“待复核”。

## 应用包包体策略

应用包按“代码包 + 资源包”分层，不再把整个包按单一 48MB 上限处理。

| 层 | 位置 | 单文件上限 | 总量上限 | 处理方式 |
|---|---|---:|---:|---|
| 代码包 | 根目录、`appDir`、其他代码/文本 | 8MB | 64MB | 逐文件静态扫描；超限直接不通过 |
| 资源包 | `assets/`（可用 `app.json.assetsDir` 改名） | 64MB | 包总量 256MB | 大小、扩展名、SHA-256；病毒扫描未配置时明确标记 |
| 外部数据 | 不放进包 | — | — | 数据中心/对象存储，按 ID 或 URL 引用 |

- `app.json` 可选 `assetsDir`，默认 `assets`。资源文件由应用通过 `AS_APP_ROOT/<assetsDir>` 读取。
- 总解压体积硬上限 256MB、文件数 4000；代码文件超过 8MB 会报“包体策略不通过”，不再静默跳过静态扫描。
- 扫描器支持从 ZIP 文件路径读取中央目录、按需解压；资源包会计算 SHA-256，安装时写入版本目录的 `.as-assets.json`，`malwareScan` 在未配置病毒扫描器时明确标为 `not-configured`，不会伪报“已扫描”。
- 当前“流式”指中央目录随机访问与按条目读取，单个资源解压仍有内存峰值；上传阶段仍把整包写入缓冲区。真正逐块写盘和 256MB 峰值验证尚未完成。
- `node_modules`、模型、GIS 数据、业务库仍不建议打包；当前 AS 不会自动安装依赖，依赖型应用应提供可运行产物，或等待后续 AS 依赖安装器接入。
- 技能包和 Bundle 包保持原有 48MB / 8MB / 2000 文件限制，不随应用包一起放宽。

## 启动与打开体验

应用被当成“一个应用程序”来用，第一次点击到界面出现的时间就是它的体验底线。这一节是**硬性规范**，不是优化建议。

### 应用侧：重型依赖必须惰性导入

应用入口（`entry`）在模块级导入重型依赖，会把每一次冷启动都变成“点了没反应”。实测基准（交通流量分析，Python 3.11）：

| 模块级导入 | 耗时 |
|---|---:|
| `import torch` | 10.46s |
| `from ultralytics import YOLO`（连带 torch） | 11.16s |
| 入口模块全部导入跑完 | 13.50s |

改成惰性导入后：入口模块导入 **2.98s**，进程起来到 `GET /` 返回 200 **2.93s**，`torch` 在启动阶段完全没有进入 `sys.modules`。延迟没有消失，只是挪到了真正需要模型的时刻（用户点“开始分析”时本来就在等结果）。

要求：

- `entry` 的模块级只允许导入轻量模块。`torch`、`ultralytics`、`tensorflow`、大型 GIS 库、模型权重加载等，一律放到首次真正使用时再导入。
- 惰性化**不要改调用点**：用代理类/工厂函数保持原有调用形式（如 `YOLO(path)`），避免大面积回归。
- 需要探测设备（CUDA / MPS）的模块，把模块级常量改成惰性函数（如 `cpu_mode()`），首次调用时再 import；被其它模块 import 的常量要先确认没有外部消费方。
- 惰性化之后还要**在服务起来之后后台预热**：Flask/HTTP 服务开始监听、`health` 能应答后，再用后台线程把模型加载好。否则这 8~10 秒只是从"打开时等"变成"第一次操作时等"。预热失败必须只留日志、不影响功能（首次真正调用会重新加载），并提供环境变量开关（如 `TC_MODEL_WARMUP=0`）便于排查。
- 实测（交通流量分析 1.2.0）：进程起来到 `GET /` 返回 200 **3.79s**，模型在后台线程里加载完成，界面先可用。
- 验收口径：冷启动到 `health.path` 返回 2xx **≤ 5s**。超出的按包质量问题退回重打。

### 宿主侧：先挂容器，再等进程

`POST /api/as/start` 内部要等健康检查通过才返回 `url`。宿主**不能等这个响应才开窗**，否则用户面对的就是十几秒空白：

1. 点击启动 → 立即挂出应用工作区，条带显示 `正在启动…`；
2. 拿到 `url` → 立即导航进去；启动失败则收起工作区并提示原因。

`app.js` 的实现要点：`showAsPane(m, '')` 先行，`await /api/as/start` 之后用返回的 `url` 补 `browser.open` 并把条带 origin 文本替换为实际地址。

### 退出界面不等于停止应用

- 点「退出界面」只销毁视图，**不释放租约**；只要智能中枢客户端还在运行，进程就一直保留（心跳继续）。期间再次打开直接命中 `startApp` 的 `existing?.status === 'running'` 分支，瞬时返回已有 `url`。
- 关闭客户端或心跳停止后，租约过期 → 30 秒宽限期后回收，避免无人进程长期占内存。
- 只有「停止应用」会立即回收进程树。

## 卸载、删除与条目唯一性

- `uninstallApp(id)` 默认只停进程、释放租约、删除 `versions/` 与 `current.json`，**保留 `users/` 账号数据**；彻底清除必须显式传 `{ keepUsers: false }`。
- 删除市场条目时先做 `appId` 引用检查：同一 `appId` 仍被其它条目引用时，只删条目、**不动物理包**（审计日志记 `keep-package appId=<id>`）；没有其它条目引用时才移除版本目录。
- 市场条目与版本目录**一对一**：同一 `appId` 重复提交时，审核通过会复用已有条目（把包写进同一个 `data/apps/<appId>/versions/<version>` 并更新该条目的 `version`/`packageId`），不再新建第二条。两个条目共用一份包，必然导致“删一条，另一条当场变包缺失”。
- **启动时还要再合并一次。** 早期版本的重复上架已经在库里留下了多条同 `appId` 条目（历史数据修不掉），所以服务加载状态后按 `appId` 归并：优先保留安装人数多的、其次最近安装时间新的、再次 id 更大的；被合并掉的只移除市场条目，审核记录（`pluginSubs`）保留作台账。前端渲染应用卡片时再按 `appId` 兜一次底，避免并发写回又把重复项带出来。

## 能力声明

应用通过 `capabilities.tools/resources` 把自己的业务接口登记给 AS；AS 只做能力发现与调用代理，不直接读应用的数据库或文件。

- 工具字段：`name`、`description`、`method`（GET/POST）、`path`（应用内绝对路径）、`inputSchema`、`outputSchema`、`timeoutMs`、`sideEffect`。
- `name` 只允许字母、数字、点、下划线和连字符；`path` 不允许 `..`、`?`、`#` 或外部 URL。
- `sideEffect=true` 的工具不会作为动态工具自动暴露给中枢 AI；调用必须走审批通道，批准后一次性执行。
- 未声明 `capabilities` 的旧应用仍可启动，但只能人工打开界面，中枢 AI 看不到工具，应用详情显示“未声明”。
- 能力声明非法会让包扫描/审核不通过；合法声明在应用详情中显示为“AI 可调用”，只读工具可试调用，写操作走“审批执行”。

## 数据与进程

- 机器级单例：一个 `appId` 一台机器一个进程。
- 账号级数据：`data/apps/<appId>/users/<userId>/`；进程通过 `AS_DATA_ROOT` 拿到数据根，应用通过 `?asUser=<userId>` 选择子目录。
- 身份边界：`?asUser` 只是显示提示，不能作为身份依据；AS 启动应用时生成 `AS_CONTEXT_SECRET`，`start` 返回的 URL 与代理调用都携带签名 `asContext`。应用必须校验 token 的 `appId/userId/exp`，校验失败返回 401。Node/Python 样本均已实现校验；只改 `asUser` 无法切换到其他账号。
- 版本目录：`data/apps/<appId>/versions/<version>/`，`current.json` 指向当前版本。
- 运行态：`data/apps/<appId>/runtime.json`，记录 `status/pid/port/url/version/dataDir/lastError`。
- 租约：`start` 返回 `leaseId`；前端每 15 秒心跳；客户端运行期间租约一直续期，关闭客户端后心跳停止，租约过期再进入 30 秒宽限期，由 sweep 杀进程树（Windows 使用 `taskkill /T /F`）。「退出界面」**不释放租约**，也不进入空闲回收（见上文「退出界面不等于停止应用」）。
- 服务端重启时 `reconcileAppsOnBoot()` 清理上一轮遗留进程，避免孤儿进程。

## 接口

- `POST /api/as/start` `{ id }` → `{ leaseId, url, port, pid, status }`
- `POST /api/as/heartbeat` `{ id, leaseId }`
- `POST /api/as/stop` `{ id, leaseId, force? }`；`force` 仅管理员可用
- `GET /api/as/status?id=...`
- `GET /api/as/capabilities?id=...`；不带 `id` 返回当前账号可见应用的能力目录
- `POST /api/as/call` `{ id, tool, args, approvalId? }`；只读工具由 AS 按账号懒启动并代理调用，返回 `httpStatus/result/contract`；`sideEffect` 工具先返回 `202 AS_APPROVAL_REQUIRED`
- `GET /api/as/approvals?status=pending`；当前账号的应用写操作审批单
- `POST /api/as/approvals` `{ id, tool, args }`；显式创建写操作审批单（10 分钟有效）
- `POST /api/as/approvals/decide` `{ approvalId, decision: "approved" | "rejected" }`；批准后一次性消费，参数指纹不匹配会拒绝
- 统一 AI 工具目录：`GET /api/ai/tools` 返回 `app_list`、`app_call` 与每个只读工具的 `app__<appId>__<tool>`；`POST /api/ai/invoke` 支持同名工具
- 写操作审计：`recordApprovalDecision` 落 `approval_decisions`（`rule=app-side-effect`、`risk=high`），实际调用另写 `as.call`；MCP 桥：`app_list`、`app_call` 以 `mcp__jg__app_list`、`mcp__jg__app_call` 暴露给模型

市场条目上的 `runtime` 字段会返回 `running/port/url/leaseCount/lastError`；安装记录仍按账号记账，但进程不按账号复制。

## 本地 POC

1. 将 `as-poc/sample-app` 打成 ZIP（根目录包含 `app.json` 与 `app/server.mjs`）。
2. 在市场“应用”分类上传，审核通过后安装。
3. 详情页点“启动并打开”。
4. 验证 `http://127.0.0.1:<动态端口>/health`、账号数据目录与 `runtime.json`。
5. 点「退出界面」后确认进程仍在（客户端运行期间再次打开应瞬时进入）；关闭客户端或点「停止应用」后，确认租约过期/宽限期结束进程被回收。

`as-poc/test-runtime.mjs` 可以脱离市场接口直接验证 Node Runtime：

```powershell
$env:JG_DATA_DIR='D:\project-test3\jg-client-1.0\as-poc\data-test'
node as-poc\test-runtime.mjs
```

Python 路径同样有最小样本 `as-poc/python-sample`，验证脚本：

```powershell
$env:JG_DATA_DIR='D:\project-test3\jg-client-1.0\as-poc\python-data-test'
node as-poc\test-python-runtime.mjs
```

两个样本都验证了同一件事：同一 `appId` 在多账号下保持一个进程 PID，账号数据目录互不相同。

## 边界

- 不修改 `harness.mjs`、`ensureUserDshHome()`、`activeRuns` 的 skill/bundle 语义。
- `activeRuns` 的 409 只拦 skill/bundle 的安装卸载，不拦 app 启动/停止。
- `browser:open` 只作为显示容器；AS 不依赖它持有进程。
- 应用审核仍使用现有 `canManage` 权限；后续可拆独立审核职务。
