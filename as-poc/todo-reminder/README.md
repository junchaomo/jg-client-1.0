# 待办提醒（todo-reminder）

九规智能中枢的 Node 运行时应用：记录带截止时间的待办，到期提醒由中枢调度器写入铃铛。

## 运行边界

- 应用进程只负责待办 CRUD 和页面展示，不在应用内维护定时器。
- 新建/恢复待办时调用 `POST /api/as/v1/reminders` 登记提醒；完成/删除时调用 `POST /api/as/v1/reminders/remove` 撤销。
- 中枢按 15 秒扫描到期提醒，生成带 `appId` 的站内通知；通知点击后由前端深链启动本应用。
- 数据写入宿主注入的 `AS_DATA_DIR/todos.json`，按中枢账号隔离。
- 页面打开时执行一次提醒补登记（`POST /api/todos/sync`），用于中枢数据被清理后的恢复；同一 `key + dueAt` 在中枢侧不会重复触发。

## 接口

- `GET /api/health`
- `GET /api/todos`
- `POST /api/todos` `{ title, note, dueAt }`
- `POST /api/todos/complete` `{ id, done }`
- `POST /api/todos/delete` `{ id }`
- `POST /api/todos/sync`

## 本地直跑

```powershell
$env:AS_DATA_DIR="$env:TEMP\todo-reminder-data"
$env:AS_PORT="54421"
node server.mjs
```

没有 `AS_HUB_URL` 时只能查看页面和本地 CRUD，新增待办会因无法登记提醒而失败；这用于确认应用进程本身可启动，不用于验收提醒链路。
