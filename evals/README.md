# 九规智能中枢 · 评测基线

## 用途

把“感觉系统挺强”变成可比较的数字。基线只读真实运行轨迹，不调用模型、不创建会话、不改业务数据。

当前关注五个指标：

- **成功率**：会话完成且有助手回答。
- **步数**：一次运行里真实工具调用/步骤的数量。
- **token**：输入、输出、缓存命中合计。
- **时延**：从提交到本轮结束。
- **工具错误率**：失败步骤占工具调用比例。

## 运行

```powershell
cd D:\project-test3\jg-client-1.0
node evals\run.mjs
```

可选参数：

```powershell
node evals\run.mjs --limit 60
node evals\run.mjs --case-set evals\cases.json
```

输出：

- `evals/reports/baseline-<时间>.md`：人看的报告
- `evals/reports/baseline-<时间>.json`：给后续 CI/面板消费

## 金标用例

`evals/cases.json` 是 20 条最小用例集，覆盖：

- 纯问答 / 识图 / 文件 / 代码 / 检索 / 审批 / 恢复 / 安全 / 计划。

每条用例包含：

- `expectedKeywords`：回答里必须出现的词。
- `forbiddenKeywords`：回答里不能出现的词（用于防止“假成功”）。
- `maxSteps`、`maxTokens`：预算目标，不是硬失败条件。

当前脚本会按 `input` 或 `conversationId` 匹配已有 trace；没有跑过的用例显示为 `not-run`，不会补造通过。

## 下一步

1. 先跑一次基线，确认当前中位 token、步数和成功率。
2. 用同样用例集比较改动前后，而不是只看单次回答。
3. 把 `maxSteps`/`maxTokens` 逐步收紧到目标值；改动必须带一次基线对比。
4. 后续接入自动执行器时，新增用例必须同时提供“期望结果”和“禁止行为”，避免只看 happy path。
