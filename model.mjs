/**
 * 模型网关：只依赖全局 fetch，兼容 OpenAI Chat Completions 协议。
 * 配置优先级：请求自带 Key > 用户模型配置 > 环境变量。
 * 不在这里保存任何密钥明文到数据库或日志。
 */

export class ModelError extends Error {
  constructor(message, { code = 'MODEL_ERROR', status = 502, detail = '' } = {}) {
    super(message)
    this.name = 'ModelError'
    this.code = code
    this.status = status
    this.detail = detail
  }
}

function trimSlash(value) {
  return String(value || '').trim().replace(/\/+$/, '')
}

export function resolveModelConfig({ userConfig = {}, request = {}, env = process.env } = {}) {
  const requestKey = String(request.ownApiKey || '').trim()
  const storedKey = String(userConfig.apiKey || '').trim()
  const envKey = String(env.JG_MODEL_API_KEY || env.DEEPSEEK_API_KEY || '').trim()
  const apiKey = requestKey || storedKey || envKey
  const requestBase = String(request.baseUrl || '').trim()
  const userBase = String(userConfig.baseUrl || userConfig.endpoint || '').trim()
  const envBase = String(env.JG_MODEL_BASE_URL || env.DEEPSEEK_BASE_URL || '').trim()
  const baseUrl = trimSlash(
    (requestBase.startsWith('http') ? requestBase : '')
    || envBase
    || (/^https?:\/\//i.test(userBase) && !/ai\.jg\.local/i.test(userBase) ? userBase : '')
    || 'https://api.deepseek.com',
  )
  const requestModel = String(request.modelName || '').trim()
  const userModel = String(userConfig.defaultModel || '').trim()
  // defaultModel 在界面上是展示名（可能含中文与空格），只有看起来像模型 ID 时才直接使用。
  const usableUserModel = /^[A-Za-z0-9._:\-/]+$/.test(userModel) ? userModel : ''
  const model = String(requestModel || usableUserModel || env.JG_MODEL_NAME || env.DEEPSEEK_MODEL || 'deepseek-chat').trim()
  const timeoutMs = Math.max(8000, Math.min(180000, Number(env.JG_MODEL_TIMEOUT_MS || 60000)))
  return { apiKey, baseUrl, model, timeoutMs, source: requestKey ? 'request' : storedKey ? 'user-config' : envKey ? 'env' : 'none' }
}

function endpointOf(baseUrl) {
  if (/\/chat\/completions$/i.test(baseUrl)) return baseUrl
  if (/\/v1$/i.test(baseUrl)) return `${baseUrl}/chat/completions`
  return `${baseUrl}/chat/completions`
}

function extractContent(payload) {
  const choice = payload && payload.choices && payload.choices[0]
  const message = choice && (choice.message || choice.delta)
  if (message && typeof message.content === 'string') return message.content
  if (Array.isArray(message?.content)) {
    return message.content.map((part) => (typeof part === 'string' ? part : part?.text || '')).join('')
  }
  return ''
}

export async function chatCompletion({ messages, model, apiKey, baseUrl, timeoutMs = 60000, temperature = 0.3 }) {
  if (!apiKey) {
    throw new ModelError('未配置模型密钥：请在启动环境设置 JG_MODEL_API_KEY，或在「设置 · 模型与密钥」保存个人 Key 后重试', {
      code: 'MODEL_KEY_MISSING',
      status: 503,
    })
  }
  if (!Array.isArray(messages) || !messages.length) {
    throw new ModelError('模型请求缺少消息', { code: 'MODEL_BAD_REQUEST', status: 400 })
  }
  const endpoint = endpointOf(baseUrl)
  const startedAt = Date.now()
  let response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        stream: false,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    const timeout = error && (error.name === 'TimeoutError' || error.name === 'AbortError')
    throw new ModelError(timeout ? `模型网关超时（${Math.round(timeoutMs / 1000)} 秒）` : `模型网关不可达：${error?.message || error}`, {
      code: timeout ? 'MODEL_TIMEOUT' : 'MODEL_UNREACHABLE',
      status: timeout ? 504 : 502,
      detail: endpoint,
    })
  }
  const rawText = await response.text()
  let payload = null
  try { payload = rawText ? JSON.parse(rawText) : null } catch { /* 保留原文用于错误提示 */ }
  if (!response.ok) {
    const upstream = payload?.error?.message || payload?.message || rawText.slice(0, 240)
    const code = response.status === 401 || response.status === 403 ? 'MODEL_AUTH_FAILED'
      : response.status === 429 ? 'MODEL_RATE_LIMITED'
        : response.status >= 500 ? 'MODEL_UPSTREAM_ERROR' : 'MODEL_BAD_REQUEST'
    throw new ModelError(`模型网关返回 ${response.status}${upstream ? `：${upstream}` : ''}`, {
      code,
      status: response.status === 401 || response.status === 403 ? 502 : response.status,
      detail: endpoint,
    })
  }
  const content = extractContent(payload).trim()
  if (!content) {
    throw new ModelError('模型返回了空内容', { code: 'MODEL_EMPTY', status: 502, detail: endpoint })
  }
  return {
    content,
    model: payload?.model || model,
    usage: payload?.usage || null,
    latencyMs: Date.now() - startedAt,
    upstreamStatus: response.status,
  }
}
