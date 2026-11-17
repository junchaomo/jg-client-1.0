import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const name = 'jg-tool-router'
const inject = ['tools', 'commands']

const LOG_PATH = process.env.JG_TOOL_ROUTER_LOG || ''
function log(line) {
  if (!LOG_PATH) return
  try { appendFileSync(LOG_PATH, `${new Date().toISOString()} ${line}\n`) } catch {}
}
log('module loaded')

/** Per-agent disposer for the last restriction installed by this plugin. */
const restrictions = new WeakMap()

function parseList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseCommand(rawInput) {
  const raw = String(rawInput || '').trim()
  if (!raw || raw === 'reset') return { reset: true }
  const allow = []
  const denyPrefix = []
  for (const part of raw.split(/\s+/)) {
    if (part.startsWith('allow=')) allow.push(...parseList(part.slice(6)))
    else if (part.startsWith('denyPrefix=')) denyPrefix.push(...parseList(part.slice(11)))
    else if (part.startsWith('deny=')) denyPrefix.push(...parseList(part.slice(5)))
  }
  return { reset: false, allow, denyPrefix }
}

function policyFileFor(agent) {
  const home = process.env.DSH_HOME || process.env.JG_DSH_HOME
  const id = agent?.session?.header?.id ?? agent?.session?.id
  if (!home || !id) return ''
  return join(home, 'jg-tool-policies', `${id}.json`)
}

function readPolicyDataFor(agent) {
  const file = policyFileFor(agent)
  if (!file || !existsSync(file)) return { policy: '', maxRunCode: 0 }
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'))
    return {
      policy: String(data?.policy || ''),
      maxRunCode: Math.max(0, Number(data?.maxRunCode) || 0),
    }
  } catch (error) {
    log(`policy file read failed: ${String(error?.message || error)}`)
    return { policy: '', maxRunCode: 0 }
  }
}

function readPolicyFor(agent) {
  return readPolicyDataFor(agent).policy
}

const RUN_CODE_BUDGETS = Symbol.for('jg.runCodeBudgets')

function sessionIdOf(agent) {
  return agent?.session?.header?.id ?? agent?.session?.id ?? ''
}

function budgetMap() {
  if (!globalThis[RUN_CODE_BUDGETS]) globalThis[RUN_CODE_BUDGETS] = new Map()
  return globalThis[RUN_CODE_BUDGETS]
}

function setRunCodeBudget(agent, limit) {
  const n = Math.max(0, Number(limit) || 0)
  const id = sessionIdOf(agent)
  if (!id) return
  const map = budgetMap()
  if (!n) {
    map.delete(id)
    return
  }
  const current = map.get(id)
  if (!current || current.limit !== n) {
    map.set(id, { limit: n, count: 0 })
    log(`runCode budget set limit=${n} session=${id}`)
  }
}

function resetRunCodeBudget(agent) {
  const id = sessionIdOf(agent)
  const budget = id ? budgetMap().get(id) : null
  if (budget) budget.count = 0
}

/** 视觉/日程工具由 MCP 在 agent/created 之后注册；首步提前 allow 会让它们暂时消失。 */
function lateToolNames(policy) {
  const parsed = parseCommand(policy)
  return parsed.allow.filter((name) => name.startsWith('mcp__jg__visual_') || name.startsWith('schedule_'))
}

function policyNeedsLateTools(policy) {
  return lateToolNames(policy).length > 0
}

function knownToolNames(agent) {
  const known = new Set()
  for (const definition of agent?.ctx?.tools?.definitions(agent) || []) known.add(definition.name)
  return known
}

/**
 * 等 MCP 的视觉/日程工具完成注册；最多等 2 秒。
 * 成功时首步就能按完整 allowlist 收窄，失败时调用方回退到 pre-step。
 */
async function waitForLateTools(agent, policy, timeoutMs = 2000) {
  const late = lateToolNames(policy)
  if (!late.length) return true
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const known = knownToolNames(agent)
    if (late.every((name) => known.has(name))) return true
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  return false
}

function applyPolicyToAgent(agent, policy, source = 'auto') {
  const agentCtx = agent?.ctx
  if (!agentCtx?.tools) return

  const current = restrictions.get(agent)
  if (current) {
    try { current() } catch {}
    restrictions.delete(agent)
  }

  const parsed = parseCommand(policy)
  if (parsed.reset) return

  const known = knownToolNames(agent)

  let selected
  if (parsed.allow.length) {
    selected = parsed.allow.filter((tool) => known.has(tool) && tool !== 'run_code')
  } else {
    selected = [...known].filter((tool) => tool !== 'run_code' && parsed.denyPrefix.some((prefix) => tool.startsWith(prefix)))
  }
  if (!selected.length) return

  try {
    const dispose = agentCtx.tools.restrict(parsed.allow.length ? { allow: selected } : { deny: selected })
    restrictions.set(agent, dispose)
    log(`applied(${source}) known=${known.size} selected=${selected.length} mode=${parsed.allow.length ? 'allow' : 'deny'}`)
  } catch (error) {
    log(`restrict failed(${source}): ${String(error?.message || error)}`)
  }
}

function apply(ctx) {
  log('apply')
  try {
    ctx.commands.register({
      definitionId: 'jg-tool-router',
      name: 'jg-toolset',
    description: 'Restrict the visible tool set for this agent turn',
    input: { hint: 'reset | allow=a,b | denyPrefix=x_,y_' },
    recordInput: false,
    handler: (invocation) => {
      log(`invoke rawInput=${String(invocation?.rawInput || '').slice(0, 200)}`)
      const agent = invocation?.agent
      const agentCtx = agent?.ctx
      if (!agentCtx?.tools) return { kind: 'error', text: 'jg-toolset: agent tools unavailable' }

      const current = restrictions.get(agent)
      if (current) {
        try { current() } catch {}
        restrictions.delete(agent)
      }

      const parsed = parseCommand(invocation?.rawInput)
      if (parsed.reset) return { kind: 'success', text: 'toolset reset' }

      const known = new Set()
      try {
        for (const definition of agentCtx.tools.definitions(agent)) known.add(definition.name)
      } catch (error) {
        return { kind: 'error', text: `jg-toolset: cannot read tool definitions: ${String(error?.message || error)}` }
      }

      let selected
      if (parsed.allow.length) {
        selected = parsed.allow.filter((tool) => known.has(tool) && tool !== 'run_code')
      } else {
        selected = [...known].filter((tool) => tool !== 'run_code' && parsed.denyPrefix.some((prefix) => tool.startsWith(prefix)))
      }
      if (!selected.length) return { kind: 'success', text: 'toolset unchanged (no matching tools)' }

      log(`known=${known.size} selected=${selected.length} mode=${parsed.allow.length ? 'allow' : 'deny'}`)
      try {
        const dispose = agentCtx.tools.restrict(parsed.allow.length ? { allow: selected } : { deny: selected })
        restrictions.set(agent, dispose)
        log(`restricted ${selected.length} tools`)
        return { kind: 'success', text: `toolset applied: ${selected.length} tools ${parsed.allow.length ? 'visible' : 'hidden'}` }
      } catch (error) {
        return { kind: 'error', text: `jg-toolset: ${String(error?.message || error)}` }
      }
      },
    })
    log('registered')
  } catch (error) {
    log(`register failed: ${String(error?.stack || error)}`)
  }

  // agent/created 在第一次 tools.resolve() 之前触发；pre-step 只影响下一步。
  // 两者共用同一策略文件，保证新建会话首步也按本轮策略收窄。
  ctx.on('agent/created', async ({ agent }) => {
    try {
      const file = policyFileFor(agent)
      if (!file || !existsSync(file)) return
      const data = readPolicyDataFor(agent)
      setRunCodeBudget(agent, data.maxRunCode)
      const policy = data.policy
      // 首步只提前收窄 created 时已注册的工具；视觉/日程 MCP 工具稍后注册。
      // 先短暂等待它们注册，成功则首步直接按完整 allow 收窄；超时才回退到 pre-step。
      if (policyNeedsLateTools(policy)) {
        const ready = await waitForLateTools(agent, policy)
        if (!ready) {
          log('created deferred: late-registered visual/schedule tools not ready')
          return
        }
        log('late tools ready before created')
      }
      applyPolicyToAgent(agent, policy, 'created')
    } catch (error) {
      log(`created failed: ${String(error?.message || error)}`)
    }
  }, { prepend: true })

  ctx.on('agent/pre-step', async ({ agent, step }, next) => {
    try {
      const file = policyFileFor(agent)
      if (file && existsSync(file)) {
        const data = readPolicyDataFor(agent)
        // 同一会话的多次用户轮次共用 agent；step 1 表示新轮开始，预算按轮重置。
        if (Number(step) === 1) resetRunCodeBudget(agent)
        setRunCodeBudget(agent, data.maxRunCode)
        applyPolicyToAgent(agent, data.policy, 'pre-step')
      }
    } catch (error) {
      log(`pre-step failed: ${String(error?.message || error)}`)
    }
    return next()
  }, { prepend: true })
}

export { apply, inject, name }
