# @jg/dsh-spill-age

按“年龄”外置旧工具结果，避免长任务里的大段工具输出被后续每次模型调用重复携带。

## 行为

- 只处理 `tool/result`，且内容必须全部是 text block。
- 结果产生后经过 `ageCalls` 次模型调用，且正文超过 `ageMinChars` 字符时才外置。
- 外置后保留 `ageHeadChars` 个字符的头、`ageTailChars` 个字符的尾，中间用 `[...]` 标记。
- 同时追加一条 `compaction/prune`，把完整原文写入 DSH 的 spillStore，并在替换内容末尾给出完整文件路径。
- 最近的结果、图片等非文本结果、已经带外置通知的结果都不改写。
- 失败时只记录 warning，保持原结果内联，不阻断本轮对话。

## 配置

```yaml
- insert:
    - id: jg-spill-age
      name: '@jg/dsh-spill-age'
      config:
        ageCalls: 8
        ageMinChars: 6000
        ageHeadChars: 3000
        ageTailChars: 1500
```

## DSH 约束

`tool/result` 的 surface replacement 只允许改变 `content`。替换事件的 `data` 必须保持与原事件相同的字段，不能额外写入 `ageSpill` 等标记；消息要冻结，但不要深冻结事件共享的 `source` 对象，否则 DSH 会拒绝整次 replacement。

## 安装

服务端 `ensureManagedModelPlugins()` 会把这个包复制到每个账号 profile 的 `node_modules/@jg/dsh-spill-age`，并给没有 `jg-spill-age` 条目的账号追加 `insert: jg-spill-age`。手工安装时可复制：

```powershell
Copy-Item -Recurse -Force plugins\jg-spill-age dsh-runtime\node_modules\@jg\dsh-spill-age
Copy-Item -Recurse -Force plugins\jg-spill-age data\agents\<账号>\dsh-home\profiles\sdk\node_modules\@jg\dsh-spill-age
```

## 测试

```powershell
node --test tests/spill-age.test.mjs
```
