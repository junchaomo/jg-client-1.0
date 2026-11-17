import { pricingSummary, priceUsage, creditsFromCny, CREDITS_PER_CNY } from './pricing.mjs'

const SUCCESS_FINISH_REASONS = new Set(['completed', 'success', 'stop', 'end_turn', 'end-turn'])
const META_STEPS = new Set(['模型网关', '计划模式', '上下文压缩'])

function number(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function creditsOf(value) {
  return Number(number(value).toFixed(2))
}

function stamp(value) {
  if (!value) return ''
  const parsed = typeof value === 'number' ? value : Date.parse(String(value))
  if (!Number.isFinite(parsed)) return ''
  return new Date(parsed).toISOString()
}

function normalizeUsage(message) {
  const raw = message?.usage && typeof message.usage === 'object' ? message.usage : null
  const stats = message?.runStats && typeof message.runStats === 'object' ? message.runStats : null
  const inputTokens = number(raw?.inputTokens ?? raw?.prompt_tokens ?? raw?.input_tokens ?? stats?.inputTokens)
  const outputTokens = number(raw?.outputTokens ?? raw?.completion_tokens ?? raw?.output_tokens ?? stats?.outputTokens)
  const cacheReadTokens = number(raw?.cacheReadTokens ?? raw?.cache_read_tokens ?? stats?.cacheReadTokens)
  const cacheWriteTokens = number(raw?.cacheWriteTokens ?? raw?.cache_write_tokens ?? stats?.cacheWriteTokens)
  const reasoningTokens = number(raw?.reasoningTokens ?? raw?.reasoning_tokens ?? stats?.reasoningTokens)
  const cacheMode = String(raw?.cacheMode ?? raw?.cache_mode ?? '').trim().toLowerCase()
  const totalTokens = number(raw?.totalTokens ?? raw?.total_tokens ?? stats?.totalTokens) || inputTokens + outputTokens
  const calls = number(raw?.calls ?? stats?.modelCalls ?? (inputTokens || outputTokens || totalTokens ? 1 : 0))
  return {
    inputTokens,
    outputTokens,
    totalTokens,
    cacheReadTokens,
    cacheWriteTokens,
    reasoningTokens,
    cacheMode,
    calls,
    hasUsage: Boolean(raw) || Boolean(inputTokens || outputTokens || totalTokens || cacheReadTokens || cacheWriteTokens || reasoningTokens),
    cacheHitRate: (inputTokens + cacheReadTokens + cacheWriteTokens)
      ? Number((cacheReadTokens / (inputTokens + cacheReadTokens + cacheWriteTokens)).toFixed(3))
      : 0,
  }
}

function finishOf(message) {
  return String(message?.runStats?.finishReason || message?.finishReason || '').trim()
}

function addCost(target, priced, calls = 1) {
  const count = number(calls)
  if (count <= 0) return
  target.costCny = Number(((target.costCny || 0) + number(priced.costCny)).toFixed(6))
  target.costCredits = creditsOf((target.costCredits || 0) + number(priced.costCredits ?? creditsFromCny(priced.costCny)))
  target.costBreakdownCny = target.costBreakdownCny || { cacheHit: 0, cacheMiss: 0, write: 0, output: 0 }
  target.costBreakdownCredits = target.costBreakdownCredits || { cacheHit: 0, cacheMiss: 0, write: 0, output: 0 }
  for (const key of ['cacheHit', 'cacheMiss', 'write', 'output']) {
    target.costBreakdownCny[key] = Number(((target.costBreakdownCny[key] || 0) + number(priced.costBreakdownCny?.[key])).toFixed(6))
    target.costBreakdownCredits[key] = creditsOf((target.costBreakdownCredits[key] || 0)
      + number(priced.costBreakdownCredits?.[key] ?? creditsFromCny(priced.costBreakdownCny?.[key])))
  }
  if (priced.priced) {
    target.pricedRequests = (target.pricedRequests || 0) + count
    if (priced.billingPeriod === 'peak') target.peakRequests = (target.peakRequests || 0) + count
    else if (priced.billingPeriod === 'off-peak') target.offPeakRequests = (target.offPeakRequests || 0) + count
    else if (priced.billingPeriod === 'flat') target.flatRequests = (target.flatRequests || 0) + count
    else target.unknownPeriodRequests = (target.unknownPeriodRequests || 0) + count
  } else {
    target.unpricedRequests = (target.unpricedRequests || 0) + count
    target.unpricedTokens = (target.unpricedTokens || 0) + number(priced.unpricedTokens)
  }
}

function statusOf(message) {
  const finish = finishOf(message).toLowerCase()
  if (!finish) return 'unknown'
  return SUCCESS_FINISH_REASONS.has(finish) ? 'success' : 'failure'
}

function taskClassOf(message, conv = {}) {
  const explicit = String(message?.runStats?.taskClass || message?.taskClass || '').trim()
  if (explicit) return explicit
  return String(conv?.resolvedMode || conv?.mode || conv?.taskMode || '未分类').trim() || '未分类'
}

function toolStepsOf(message) {
  return (Array.isArray(message?.steps) ? message.steps : [])
    .filter((step) => step && typeof step === 'object' && step.tool && !META_STEPS.has(String(step.tool)))
}

function addModel(map, name, usage, status, priced = {}) {
  const key = name || '未记录模型'
  const item = map.get(key) || {
    model: key,
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    reasoningTokens: 0,
    costCny: 0,
    costCredits: 0,
    costBreakdownCny: { cacheHit: 0, cacheMiss: 0, write: 0, output: 0 },
    costBreakdownCredits: { cacheHit: 0, cacheMiss: 0, write: 0, output: 0 },
    pricedRequests: 0,
    unpricedRequests: 0,
    unpricedTokens: 0,
    peakRequests: 0,
    offPeakRequests: 0,
    flatRequests: 0,
    unknownPeriodRequests: 0,
    successfulTasks: 0,
    failedTasks: 0,
    unknownTasks: 0,
    successTokens: 0,
    toolCalls: 0,
    toolFailures: 0,
  }
  item.requests += usage.calls
  item.inputTokens += usage.inputTokens
  item.outputTokens += usage.outputTokens
  item.totalTokens += usage.totalTokens
  item.cacheReadTokens += usage.cacheReadTokens
  item.cacheWriteTokens += usage.cacheWriteTokens
  item.reasoningTokens += usage.reasoningTokens
  if (priced.pricingModel) item.pricingModel = priced.pricingModel
  if (priced.requestedPricingModel) item.requestedPricingModel = priced.requestedPricingModel
  if (priced.tier) item.tier = priced.tier
  addCost(item, priced, usage.calls)
  if (status === 'success') {
    item.successfulTasks += 1
    item.successTokens += usage.totalTokens
  } else if (status === 'failure') item.failedTasks += 1
  else item.unknownTasks += 1
  map.set(key, item)
}

function addTask(map, taskClass, message, usage, status, conversationId = '', priced = {}) {
  const key = taskClass || '未分类'
  const item = map.get(key) || {
    taskClass: key,
    messages: 0,
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costCny: 0,
    costCredits: 0,
    costBreakdownCny: { cacheHit: 0, cacheMiss: 0, write: 0, output: 0 },
    costBreakdownCredits: { cacheHit: 0, cacheMiss: 0, write: 0, output: 0 },
    pricedRequests: 0,
    unpricedRequests: 0,
    unpricedTokens: 0,
    peakRequests: 0,
    offPeakRequests: 0,
    flatRequests: 0,
    unknownPeriodRequests: 0,
    toolCalls: 0,
    toolFailures: 0,
    successfulTasks: 0,
    failedTasks: 0,
    unknownTasks: 0,
    successTokens: 0,
    models: new Set(),
    conversations: new Set(),
  }
  item.messages += 1
  item.requests += usage.calls
  item.inputTokens += usage.inputTokens
  item.outputTokens += usage.outputTokens
  item.totalTokens += usage.totalTokens
  item.cacheReadTokens += usage.cacheReadTokens
  item.cacheWriteTokens += usage.cacheWriteTokens
  addCost(item, priced, usage.calls)
  const steps = toolStepsOf(message)
  item.toolCalls += number(message?.runStats?.toolCalls) || steps.length
  item.toolFailures += number(message?.runStats?.toolFailures) || steps.filter((step) => step.status === 'fail').length
  if (status === 'success') {
    item.successfulTasks += 1
    item.successTokens += usage.totalTokens
  } else if (status === 'failure') item.failedTasks += 1
  else item.unknownTasks += 1
  const model = String(message?.model || '')
  if (model) item.models.add(model)
  if (conversationId) item.conversations.add(conversationId)
  map.set(key, item)
}

function addSession(map, conv, message, usage, status, priced = {}) {
  const item = map.get(conv.id) || {
    conversationId: conv.id,
    conversationTitle: conv.title || '未命名会话',
    messages: 0,
    usageMessages: 0,
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costCny: 0,
    costCredits: 0,
    costBreakdownCny: { cacheHit: 0, cacheMiss: 0, write: 0, output: 0 },
    costBreakdownCredits: { cacheHit: 0, cacheMiss: 0, write: 0, output: 0 },
    pricedRequests: 0,
    unpricedRequests: 0,
    unpricedTokens: 0,
    peakRequests: 0,
    offPeakRequests: 0,
    flatRequests: 0,
    unknownPeriodRequests: 0,
    toolCalls: 0,
    toolFailures: 0,
    successfulTasks: 0,
    failedTasks: 0,
    unknownTasks: 0,
    successTokens: 0,
    taskClasses: new Set(),
    lastAt: '',
  }
  item.messages += 1
  if (usage.hasUsage) item.usageMessages += 1
  item.requests += usage.calls
  item.inputTokens += usage.inputTokens
  item.outputTokens += usage.outputTokens
  item.totalTokens += usage.totalTokens
  item.cacheReadTokens += usage.cacheReadTokens
  item.cacheWriteTokens += usage.cacheWriteTokens
  addCost(item, priced, usage.calls)
  const steps = toolStepsOf(message)
  item.toolCalls += number(message?.runStats?.toolCalls) || steps.length
  item.toolFailures += number(message?.runStats?.toolFailures) || steps.filter((step) => step.status === 'fail').length
  if (status === 'success') {
    item.successfulTasks += 1
    item.successTokens += usage.totalTokens
  } else if (status === 'failure') item.failedTasks += 1
  else item.unknownTasks += 1
  item.taskClasses.add(taskClassOf(message, conv))
  const at = stamp(message?.usageAt)
  if (at && (!item.lastAt || at > item.lastAt)) item.lastAt = at
  map.set(conv.id, item)
}

function addTool(map, step, conv, message, at) {
  const name = String(step.tool || '').trim()
  if (!name) return
  const item = map.get(name) || {
    tool: name,
    calls: 0,
    failures: 0,
    messages: 0,
    conversations: new Set(),
    lastAt: '',
  }
  item.calls += 1
  if (step.status === 'fail') item.failures += 1
  item.messages += 1
  item.conversations.add(conv.id)
  if (at && (!item.lastAt || at > item.lastAt)) item.lastAt = at
  map.set(name, item)
}

function finalizeCost(target) {
  const cny = Number((target.costCny || 0).toFixed(6))
  target.costCny = cny
  target.costCredits = creditsFromCny(cny)
  const breakdown = target.costBreakdownCny || { cacheHit: 0, cacheMiss: 0, write: 0, output: 0 }
  const nextBreakdown = {}
  for (const key of ['cacheHit', 'cacheMiss', 'write', 'output']) {
    nextBreakdown[key] = Number((breakdown[key] || 0).toFixed(6))
  }
  target.costBreakdownCny = nextBreakdown
  target.costBreakdownCredits = Object.fromEntries(
    Object.entries(nextBreakdown).map(([key, value]) => [key, creditsFromCny(value)])
  )
  return target
}

function finalizeRows(rows) {
  return [...rows.values()].map((item) => {
    const next = { ...item }
    if (next.models instanceof Set) next.models = [...next.models]
    if (next.conversations instanceof Set) next.conversations = [...next.conversations]
    if (next.taskClasses instanceof Set) next.taskClasses = [...next.taskClasses]
    finalizeCost(next)
    next.successRate = (next.successfulTasks + next.failedTasks)
      ? Number((next.successfulTasks / (next.successfulTasks + next.failedTasks)).toFixed(3))
      : 0
    next.cacheHitRate = (next.inputTokens + next.cacheReadTokens + next.cacheWriteTokens)
      ? Number((next.cacheReadTokens / (next.inputTokens + next.cacheReadTokens + next.cacheWriteTokens)).toFixed(3))
      : 0
    next.avgTokensPerSuccessfulTask = next.successfulTasks
      ? Math.round((next.successTokens || 0) / next.successfulTasks)
      : 0
    return next
  })
}

/**
 * 从已落库的助手消息聚合用量基线。
 * 只使用真实 usage/runStats 字段；不按字符数或点击次数估算 token。
 */
export function summarizeUsage(conversations) {
  const totals = {
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    reasoningTokens: 0,
    toolCalls: 0,
    toolFailures: 0,
    spillCalls: 0,
    spillOmittedBytes: 0,
    prunedResults: 0,
    compactions: 0,
    successfulTasks: 0,
    failedTasks: 0,
    unknownTasks: 0,
    successTokens: 0,
    successfulModelTasks: 0,
    modelSuccessTokens: 0,
    successRate: 0,
    cacheHitRate: 0,
    avgTokensPerSuccessfulTask: 0,
    avgTokensPerSuccessfulModelTask: 0,
    costCny: 0,
    costCredits: 0,
    costBreakdownCny: { cacheHit: 0, cacheMiss: 0, write: 0, output: 0 },
    costBreakdownCredits: { cacheHit: 0, cacheMiss: 0, write: 0, output: 0 },
    pricedRequests: 0,
    unpricedRequests: 0,
    unpricedTokens: 0,
    peakRequests: 0,
    offPeakRequests: 0,
    flatRequests: 0,
    unknownPeriodRequests: 0,
  }
  const models = new Map()
  const tasks = new Map()
  const sessions = new Map()
  const tools = new Map()
  const skills = new Map()
  const records = []
  let assistantMessages = 0
  let usageMessages = 0
  let runStatsMessages = 0
  let toolMessages = 0
  let earliestAt = ''
  let latestAt = ''

  for (const conv of (Array.isArray(conversations) ? conversations : [])) {
    for (const message of (conv.messages || [])) {
      if (message.role !== 'assistant') continue
      assistantMessages += 1
      const usage = normalizeUsage(message)
      const status = statusOf(message)
      const taskClass = taskClassOf(message, conv)
      const at = stamp(message.usageAt)
      if (at && (!earliestAt || at < earliestAt)) earliestAt = at
      if (at && (!latestAt || at > latestAt)) latestAt = at
      const steps = toolStepsOf(message)
      if (message.runStats && typeof message.runStats === 'object') runStatsMessages += 1
      if (steps.length) toolMessages += 1
      if (!usage.hasUsage) continue
      usageMessages += 1
      const modelName = String(message.model || conv.model || '未记录模型')
      const priced = priceUsage({ model: modelName, usage, at: message.usageAt ?? at })
      addSession(sessions, conv, message, usage, status, priced)
      addCost(totals, priced, usage.calls)
      totals.requests += usage.calls
      totals.inputTokens += usage.inputTokens
      totals.outputTokens += usage.outputTokens
      totals.totalTokens += usage.totalTokens
      totals.cacheReadTokens += usage.cacheReadTokens
      totals.cacheWriteTokens += usage.cacheWriteTokens
      totals.reasoningTokens += usage.reasoningTokens
      totals.toolCalls += number(message.runStats?.toolCalls) || steps.length
      totals.toolFailures += number(message.runStats?.toolFailures) || steps.filter((step) => step.status === 'fail').length
      totals.spillCalls += number(message.runStats?.spillCalls)
      totals.spillOmittedBytes += number(message.runStats?.spillOmittedBytes)
      totals.prunedResults += number(message.runStats?.prunedResults)
      totals.compactions += number(message.runStats?.compactions)
      if (status === 'success') {
        totals.successfulTasks += 1
        totals.successTokens += usage.totalTokens
        if (usage.calls > 0) {
          totals.successfulModelTasks += 1
          totals.modelSuccessTokens += usage.totalTokens
        }
      } else if (status === 'failure') totals.failedTasks += 1
      else totals.unknownTasks += 1
      addModel(models, modelName, usage, status, priced)
      addTask(tasks, taskClass, message, usage, status, conv.id, priced)
      for (const step of steps) {
        addTool(tools, step, conv, message, at)
        if (/skill|技能/i.test(String(step.tool || ''))) addTool(skills, step, conv, message, at)
      }
      records.push({
        conversationId: conv.id,
        conversationTitle: conv.title || '未命名会话',
        at,
        time: message.time || '',
        model: modelName,
        taskClass,
        status,
        finishReason: finishOf(message) || '未记录',
        calls: usage.calls,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        cacheReadTokens: usage.cacheReadTokens,
        cacheWriteTokens: usage.cacheWriteTokens,
        cacheHitRate: usage.cacheHitRate,
        toolCalls: number(message.runStats?.toolCalls) || steps.length,
        toolFailures: number(message.runStats?.toolFailures) || steps.filter((step) => step.status === 'fail').length,
        contextChars: number(message.runStats?.contextChars),
        durationMs: number(message.runStats?.durationMs),
        costCny: priced.costCny,
        costCredits: priced.costCredits,
        priced: priced.priced,
        pricingModel: priced.pricingModel,
        requestedPricingModel: priced.requestedPricingModel || priced.pricingModel,
        pricingNote: priced.pricingNote,
        pricingMode: priced.pricingMode,
        pricingTier: priced.pricingTier,
        tier: priced.tier || '',
        billingPeriod: priced.billingPeriod,
        costBreakdownCny: priced.costBreakdownCny,
        costBreakdownCredits: priced.costBreakdownCredits,
        unpricedTokens: priced.unpricedTokens,
      })
    }
  }

  const completed = totals.successfulTasks + totals.failedTasks
  totals.successRate = completed ? Number((totals.successfulTasks / completed).toFixed(3)) : 0
  const cacheBase = totals.inputTokens + totals.cacheReadTokens + totals.cacheWriteTokens
  totals.cacheHitRate = cacheBase ? Number((totals.cacheReadTokens / cacheBase).toFixed(3)) : 0
  totals.avgTokensPerSuccessfulTask = totals.successfulTasks
    ? Math.round(totals.successTokens / totals.successfulTasks)
    : 0
  totals.avgTokensPerSuccessfulModelTask = totals.successfulModelTasks
    ? Math.round(totals.modelSuccessTokens / totals.successfulModelTasks)
    : 0

  records.sort((a, b) => String(b.at || b.time).localeCompare(String(a.at || a.time)))
  finalizeCost(totals)
  const taskRows = finalizeRows(tasks).sort((a, b) => b.totalTokens - a.totalTokens)
  const sessionRows = [...sessions.values()].map((item) => {
    const next = { ...item, taskClasses: [...item.taskClasses] }
    finalizeCost(next)
    next.successRate = (next.successfulTasks + next.failedTasks)
      ? Number((next.successfulTasks / (next.successfulTasks + next.failedTasks)).toFixed(3))
      : 0
    next.cacheHitRate = (next.inputTokens + next.cacheReadTokens + next.cacheWriteTokens)
      ? Number((next.cacheReadTokens / (next.inputTokens + next.cacheReadTokens + next.cacheWriteTokens)).toFixed(3))
      : 0
    next.avgTokensPerSuccessfulTask = next.successfulTasks
      ? Math.round((next.successTokens || 0) / next.successfulTasks)
      : 0
    return next
  }).sort((a, b) => b.totalTokens - a.totalTokens)

  return {
    totals,
    models: finalizeRows(models).sort((a, b) => b.totalTokens - a.totalTokens),
    tasks: taskRows,
    sessions: sessionRows.slice(0, 20),
    tools: finalizeRows(tools).sort((a, b) => b.calls - a.calls).slice(0, 24),
    skills: finalizeRows(skills).sort((a, b) => b.calls - a.calls).slice(0, 16),
    records: records.slice(0, 50),
    baseline: {
      since: earliestAt,
      lastAt: latestAt,
      messages: usageMessages,
    },
    coverage: {
      conversations: Array.isArray(conversations) ? conversations.length : 0,
      assistantMessages,
      usageMessages,
      runStatsMessages,
      toolMessages,
      skillMessages: skills.size,
      note: usageMessages
        ? '仅统计已落库的真实 usage/runStats；缺失字段保持 0，不按字符数或点击次数估算。'
        : '当前账号尚无带真实 usage 的模型轮次；发起一次模型对话后才会产生计量数据。',
    },
    pricing: pricingSummary(),
    credits: {
      perCny: CREDITS_PER_CNY,
      valueCny: 1 / CREDITS_PER_CNY,
      total: totals.costCredits,
      note: '100 积分 = 1 元；人民币实价仅在管理中心 API 成本分析中展示。',
    },
  }
}
