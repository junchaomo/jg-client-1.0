/**
 * 九规智能中枢 · 真实运行基线
 *
 * 只读 data/jg.sqlite 中的会话状态与 data/agents/<账号>/traces 下的真实 trace，
 * 计算通过率、步数、token、时延和工具错误率，生成 Markdown + JSON 报告。
 * 不调用模型、不创建会话、不修改任何业务数据。
 *
 * 用法：
 *   node evals/run.mjs
 *   node evals/run.mjs --limit 60
 *   node evals/run.mjs --case-set evals/cases.json
 */
import { DatabaseSync } from 'node:sqlite'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const dataDir = process.env.JG_DATA_DIR || join(projectRoot, 'data')
const traceRoot = process.env.JG_TRACE_ROOT || join(dataDir, 'agents')
const reportsDir = process.env.JG_EVAL_REPORTS || join(projectRoot, 'evals', 'reports')

function arg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? String(process.argv[index + 1] || '') : fallback
}

const limit = Math.max(1, Number(arg('limit', '80')) || 80)
const caseSetPath = arg('case-set', join(projectRoot, 'evals', 'cases.json'))

function number(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function median(values) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

function percentile(values, p) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1))
  return sorted[index]
}

function pct(value, total) {
  return total ? `${((value / total) * 100).toFixed(1)}%` : '—'
}

function compact(text, max = 120) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function listTraceFiles() {
  if (!existsSync(traceRoot)) return []
  const out = []
  for (const account of readdirSync(traceRoot, { withFileTypes: true })) {
    if (!account.isDirectory()) continue
    const root = join(traceRoot, account.name, 'traces')
    if (!existsSync(root)) continue
    const stack = [root]
    while (stack.length) {
      const dir = stack.pop()
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) stack.push(full)
        else if (entry.isFile() && entry.name.endsWith('.json')) out.push(full)
      }
    }
  }
  return out
}

function readRuntime() {
  const file = join(dataDir, 'jg.sqlite')
  if (!existsSync(file)) throw new Error(`找不到数据库：${file}`)
  let db
  try {
    db = new DatabaseSync(file, { readOnly: true })
    const row = db.prepare("SELECT value FROM app_state WHERE key = 'runtime'").get()
    return row?.value ? JSON.parse(row.value) : {}
  } finally {
    try { db?.close() } catch {}
  }
}

function loadTraces() {
  const rows = []
  for (const file of listTraceFiles()) {
    try {
      const stat = statSync(file)
      const trace = JSON.parse(readFileSync(file, 'utf8'))
      if (!trace.traceId) continue
      const stats = trace.stats || {}
      rows.push({ file, mtime: stat.mtimeMs, trace, stats })
    } catch {}
  }
  return rows.sort((a, b) => b.mtime - a.mtime).slice(0, limit)
}

function loadCases() {
  try { return JSON.parse(readFileSync(caseSetPath, 'utf8')) } catch { return [] }
}

function classifyTrace(trace) {
  if (trace.taskClass) return trace.taskClass
  const input = String(trace.input || '')
  if ((trace.images || []).length || /截图|图片|识图|看图/i.test(input)) return '识图'
  if (/代码|脚本|报错|调试|构建|测试|部署|接口|函数|代码库/i.test(input)) return '代码'
  if (/文件|目录|保存|创建|修改|写入|读取|整理|导出|生成.*\.md/i.test(input)) return '文件'
  if (/查询|搜索|检索|资料|公告|通知|资源|数据/i.test(input)) return '检索'
  return '问答'
}

function scoreCases(cases, byInput, byConversation) {
  return cases.map((item) => {
    const input = String(item.input || '')
    const trace = byInput.get(input) || byConversation.get(String(item.conversationId || ''))
    const reply = String(trace?.trace?.reply || '')
    const keywords = Array.isArray(item.expectedKeywords) ? item.expectedKeywords : []
    const forbidden = Array.isArray(item.forbiddenKeywords) ? item.forbiddenKeywords : []
    const missing = keywords.filter((word) => !reply.includes(String(word)))
    const bad = forbidden.filter((word) => reply.includes(String(word)))
    const matched = Boolean(trace) && missing.length === 0 && bad.length === 0
    return {
      id: item.id,
      input: compact(input, 80),
      status: trace ? (matched ? 'pass' : 'review') : 'not-run',
      model: trace?.trace?.model || '',
      steps: trace?.stats?.steps || 0,
      totalTokens: trace?.stats?.totalTokens || 0,
      missingKeywords: missing,
      forbiddenKeywords: bad,
      reply: compact(reply, 160),
    }
  })
}

function aggregate(rows) {
  const tokens = rows.map((r) => number(r.stats.totalTokens))
  const steps = rows.map((r) => number(r.stats.steps))
  const duration = rows.map((r) => number(r.stats.durationMs))
  const context = rows.map((r) => number(r.stats.contextChars))
  const toolCalls = rows.reduce((sum, r) => sum + number(r.stats.toolCalls), 0)
  const toolFailures = rows.reduce((sum, r) => sum + number(r.stats.toolFailures), 0)
  const successRows = rows.filter((r) => r.success !== null)
  const success = successRows.filter((r) => r.success).length
  return {
    runs: rows.length,
    verified: successRows.length,
    success,
    successRate: successRows.length ? Number((success / successRows.length).toFixed(3)) : 0,
    verifiedRate: rows.length ? Number((successRows.length / rows.length).toFixed(3)) : 0,
    totalTokens: tokens.reduce((a, b) => a + b, 0),
    medianTokens: median(tokens),
    p95Tokens: percentile(tokens, 0.95),
    totalSteps: steps.reduce((a, b) => a + b, 0),
    medianSteps: median(steps),
    p95Steps: percentile(steps, 0.95),
    medianDurationMs: median(duration),
    p95DurationMs: percentile(duration, 0.95),
    medianContextChars: median(context),
    p95ContextChars: percentile(context, 0.95),
    toolCalls,
    toolFailures,
    toolFailureRate: toolCalls ? Number((toolFailures / toolCalls).toFixed(3)) : 0,
  }
}

function groupBy(rows, selector) {
  const map = new Map()
  for (const row of rows) {
    const key = selector(row)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(row)
  }
  return [...map.entries()].map(([key, items]) => ({ key, ...aggregate(items) })).sort((a, b) => b.runs - a.runs)
}

function mdTable(groups) {
  const header = '| 分组 | 运行 | 成功率 | 平均/中位 token | P95 token | 中位步数 | P95 步数 | 工具错误率 |\n|---|---:|---:|---:|---:|---:|---:|---:|'
  const body = groups.map((g) => `| ${g.key} | ${g.runs} | ${(g.successRate * 100).toFixed(1)}% | ${g.medianTokens} | ${g.p95Tokens} | ${g.medianSteps} | ${g.p95Steps} | ${(g.toolFailureRate * 100).toFixed(1)}% |`).join('\n')
  return `${header}\n${body}`
}

function renderMarkdown({ runtime, rows, summary, byModel, byTask, caseRows, generatedAt }) {
  const conversationById = new Map((runtime.conversations || []).map((c) => [String(c.id), c]))
  const worst = [...rows].sort((a, b) => number(b.stats.totalTokens) - number(a.stats.totalTokens)).slice(0, 10)
  const casePass = caseRows.filter((c) => c.status === 'pass').length
  const caseRun = caseRows.filter((c) => c.status !== 'not-run').length
  return `# 九规智能中枢 · 真实运行基线

生成时间：${generatedAt}
数据源：${join(dataDir, 'jg.sqlite')} + ${traceRoot}
样本：最近 ${rows.length} 条 trace

## 总览

- 运行数：**${summary.runs}**
- 可核验回答：**${summary.verified} / ${summary.runs}**（${pct(summary.verified, summary.runs)}）
- 成功（可核验中会话为 done 且有回答）：**${summary.success}**（${pct(summary.success, summary.verified)}）
- 总 token：**${summary.totalTokens.toLocaleString()}**
- token 中位数 / P95：**${summary.medianTokens.toLocaleString()} / ${summary.p95Tokens.toLocaleString()}**
- 步数中位数 / P95：**${summary.medianSteps} / ${summary.p95Steps}**
- 时延中位数 / P95：**${Math.round(summary.medianDurationMs / 1000)}s / ${Math.round(summary.p95DurationMs / 1000)}s**
- 上下文长度中位数 / P95：**${summary.medianContextChars.toLocaleString()} / ${summary.p95ContextChars.toLocaleString()}** 字符
- 工具调用：**${summary.toolCalls}**；失败：**${summary.toolFailures}**（${(summary.toolFailureRate * 100).toFixed(1)}%）

## 按模型

${mdTable(byModel)}

## 按任务类型（按问题文本启发式分类）

${mdTable(byTask)}

## Token 消耗最高的运行

| 会话 | 模型 | 步数 | token | 时延 | 输入摘要 |
|---|---|---:|---:|---:|---|
${worst.map((r) => {
  const conv = conversationById.get(String(r.trace.conversationId || ''))
  const title = conv?.title || r.trace.title || ''
  return `| ${r.trace.conversationId || '—'} | ${r.trace.model || '—'} | ${r.stats.steps || 0} | ${number(r.stats.totalTokens).toLocaleString()} | ${Math.round(number(r.stats.durationMs) / 1000)}s | ${compact(title || r.trace.input, 42)} |`
}).join('\n')}

## 金标用例覆盖

用例集：${caseSetPath}
已运行：**${caseRun} / ${caseRows.length}**；通过：**${casePass}**。

| 用例 | 状态 | 模型 | 步数 | token | 缺失关键词 |
|---|---|---|---:|---:|---|
${caseRows.map((c) => `| ${c.id} | ${c.status} | ${c.model || '—'} | ${c.steps} | ${c.totalTokens.toLocaleString()} | ${c.missingKeywords.join('、') || '—'} |`).join('\n')}

> 说明：这是基于现有真实 trace 的基线，不回放、不补造数据；未运行的用例显示为 not-run，后续接入任务执行器后再自动填分。
`
}

function main() {
  const runtime = readRuntime()
  const traces = loadTraces()
  const conversationById = new Map((runtime.conversations || []).map((c) => [String(c.id), c]))
  const rows = traces.map((row) => {
    const conv = conversationById.get(String(row.trace.conversationId || ''))
    const assistant = (conv?.messages || []).find((m) => m.role === 'assistant' && m.traceId === row.trace.traceId)
    const reply = String(row.trace.reply || assistant?.text || '')
    return {
      ...row,
      reply,
      success: assistant ? Boolean(reply.trim()) && (conv ? conv.status === 'done' : true) : null,
      taskClass: classifyTrace(row.trace),
    }
  })
  const summary = aggregate(rows)
  const byModel = groupBy(rows, (r) => r.trace.model || '未知')
  const byTask = groupBy(rows, (r) => r.taskClass)
  const cases = loadCases()
  const byInput = new Map(rows.map((r) => [String(r.trace.input || '').trim(), r]))
  const byConversation = new Map(rows.map((r) => [String(r.trace.conversationId || ''), r]))
  const caseRows = scoreCases(cases, byInput, byConversation)
  const generatedAt = new Date().toLocaleString('zh-CN', { hour12: false })
  const report = renderMarkdown({ runtime, rows, summary, byModel, byTask, caseRows, generatedAt })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  mkdirSync(reportsDir, { recursive: true })
  const mdPath = join(reportsDir, `baseline-${stamp}.md`)
  const jsonPath = join(reportsDir, `baseline-${stamp}.json`)
  writeFileSync(mdPath, report)
  writeFileSync(jsonPath, JSON.stringify({ generatedAt, summary, byModel, byTask, cases: caseRows, runs: rows.map((r) => ({
    traceId: r.trace.traceId,
    conversationId: r.trace.conversationId,
    model: r.trace.model,
    taskClass: r.taskClass,
    success: r.success,
    steps: r.stats.steps,
    totalTokens: r.stats.totalTokens,
    durationMs: r.stats.durationMs,
    contextChars: r.stats.contextChars,
    toolCalls: r.stats.toolCalls,
    toolFailures: r.stats.toolFailures,
  })) }, null, 2))
  console.log(`基线完成：${rows.length} 条运行`)
  console.log(`可核验 ${summary.verified}/${summary.runs} · 成功率 ${(summary.successRate * 100).toFixed(1)}% · token 中位数 ${summary.medianTokens.toLocaleString()} · 步数中位数 ${summary.medianSteps}`)
  console.log(`Markdown: ${mdPath}`)
  console.log(`JSON: ${jsonPath}`)
}

main()
