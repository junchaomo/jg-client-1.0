# DeepSeek Harness 部署与验证记录

日期：2026-11-11
工程：`D:\project-test3\jg-client-1.0`

## 结论

`POST /api/chat` 已从“OpenAI 兼容对话接口”切换为 **DeepSeek Harness 真实 agent 运行时**：

- 使用 `@deepseek-ai/dsh@0.2.2-rc.1` 与 `@deepseek-ai/dsh-sdk-client@0.2.2-rc.1`；
- 通过 `dsh --profile sdk` 的 stdio JSON-RPC 子进程运行；
- 模型可真实调用 `glob`、`pwsh`、`bash`、文件系统等 Harness 工具；
- 每个会话持久化 `dshSessionId`，客户端/服务重启后可恢复历史；
- 前端页面、组件、样式、文案、导航与布局均未改动。

## 落地文件

| 文件 | 作用 |
| --- | --- |
| `harness.mjs` | Harness SDK 适配层：启动子进程、注入 Key、恢复会话、把事件流转成前端 `steps` |
| `server.mjs` | `POST /api/chat` 改调 `runAgent()`；会话对象读写 `dshSessionId` |
| `electron/main.cjs` | 改用 `runtime/node.exe` 启动 `server.mjs`，避免 Electron 内置 Node 与 DSH 原生加载器不兼容 |
| `dsh-runtime/` | 完整的 DSH 0.2.2-rc.1 运行时（748.4 MB / 70,233 个文件） |
| `runtime/node.exe` | Node 24.15 便携运行时（87.4 MB） |
| `data/dsh-home/` | DSH profile、会话历史与凭据家目录 |
| `data/dsh-workspace/` | Harness agent 的工作区，文件与 shell 操作限制在此目录 |

## 关键工程问题与修复

1. **Electron 内置 Node 不兼容**
   - 首次通过 Electron `ELECTRON_RUN_AS_NODE=1` 启动 `server.mjs` 时，DSH 子进程继承 Electron 的 Node 24.22.1 / V8 electron 指纹，报：
     `node-addon-require-builtin unsupported: Unsupported/no-context`。
   - 修复：`electron/main.cjs` 改为使用工程内 `runtime/node.exe`（Node 24.15）启动服务端；DSH 子进程再继承该 Node，可正常运行。
2. **首次 DSH_HOME 初始化慢**
   - `initializeTimeoutMs` 设为 90 秒；30 秒会在首次 profile 初始化时超时。
3. **服务重启后会话丢失**
   - 只用 `harness.run(input, { sessionId })` 只能复用当前进程内会话，重启后会新建会话。
   - 修复：`runAgent()` 优先 `resumeSession(sessionId)` 从 `data/dsh-home` 恢复；当前进程已持有该会话时回退 `run(..., { sessionId })`。

## 实测证据

### 1. 纯对话（服务端 API）

```json
{
  "ok": true,
  "reply": "HARNESS-API OK",
  "model": { "name": "deepseek-chat", "latencyMs": 5009, "harness": true },
  "conversation": { "dshSessionId": "session-8d29facbfc1849d495d76ed7a9d5cdd9" }
}
```

### 2. 真实工具调用（服务端 API）

提示：`用工具查看当前工作区有哪些文件，只列前 5 个，不要解释。`

返回的真实步骤：

```text
模型网关 | deepseek-chat · 7819 ms · DeepSeek Harness
glob     | {"pattern":"*","path":"D:\\project-test3\\jg-client-1.0\\data\\dsh-workspace"}
pwsh     | {"description":"List first five workspace entries","command":"Get-ChildItem -Force | Select-Object -First 5 -ExpandProperty Name"}
glob     | {"pattern":"*","path":"D:\\project-test3\\jg-client-1.0\\data"}
```

最终回复：`当前工作区暂无文件。`

### 3. 跨服务重启的会话记忆

1. 新建会话 `C-1794365259005`，提示“请记住数字 77” → `dshSessionId=session-d0edabbac625443388001bb800fa95d0`。
2. 停止 Electron 与 `server.mjs`，重新启动客户端。
3. 在同一会话追问“刚才让你记住的数字是多少？” → 返回 `77`，`dshSessionId` 保持不变。

### 4. UI 未改动

对 `public/` 的静态文件与原型 `D:\project-test3\jg-hub` 做 SHA256 对比：

```text
public\styles.css       MATCH B24BB9E12250
public\search-fixes.css MATCH D1E0536E37FF
public\index.html       MATCH 8186442B45EF
```

`public/app.js` 仅保留此前已确认的交互逻辑修改（Enter 发送、置顶/项目归属），没有改页面结构与样式。

## 边界与后续

- Harness agent 具备真实 shell 与文件能力；当前没有额外的命令审批弹窗，工作区限制在 `data/dsh-workspace`。生产环境应接入命令审批策略。
- `logAudit()` 目前记录 `chat.message` 与 Harness 模型名，尚未把每一次 `tool/call` 明细写入审计表；“运行记录”页面仍是原型状态。
- `dsh-runtime/` 与 `runtime/` 已加入 `.gitignore`，部署时需随安装包分发，或重新执行 npm 安装。
- `POST /api/model/test` 仍走 `model.mjs` 的 OpenAI 兼容探测，用于“设置 · 模型与密钥”里的连通性测试，不影响聊天主链路。
