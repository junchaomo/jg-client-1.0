/**
 * 生图专用模型适配层。
 *
 * 这里只负责图片 Provider 的注册、配置检查和调用归一化，不接聊天模型网关，
 * 也不把第三方 Key 暴露给前端。没有配置 Key 的模型保持“未配置”，不生成假图、
 * 不回退到其他 Provider。
 */

const DEFAULT_TIMEOUT_MS = 120_000
const MAX_IMAGE_BYTES = 24 * 1024 * 1024
const MAX_EDIT_INPUT_BYTES = 10 * 1024 * 1024
const MAX_REFERENCE_IMAGES = 3
const MAX_REFERENCE_INPUT_BYTES = 10 * 1024 * 1024
const MIN_IMAGE_BYTES = 8 * 1024
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp'])

function envValue(name, fallback = '') {
  return String(process.env[name] || fallback).trim()
}

function configuredValue(name, fallback = '') {
  return envValue(name, fallback)
}

function createDefinitions() {
  const qwenModel = configuredValue('QWEN_IMAGE_MODEL', 'qwen-image-3.0-pro')
  const seedreamModel = configuredValue('SEEDREAM_IMAGE_MODEL', 'doubao-seedream-5-5-261028')
  return [
    {
      id: 'qwen-image',
      label: 'Qwen-Image 3.0 Pro',
      provider: 'qwen',
      providerLabel: '阿里云百炼',
      model: qwenModel,
      endpoint: configuredValue('QWEN_IMAGE_ENDPOINT', 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'),
      apiKey: envValue('QWEN_IMAGE_API_KEY'),
      keyEnv: 'QWEN_IMAGE_API_KEY',
      capabilities: { generate: true, edit: true, references: true },
    },
    {
      id: 'seedream-5.5',
      label: 'Seedream 5.5',
      provider: 'seedream',
      providerLabel: '火山方舟',
      model: seedreamModel,
      endpoint: configuredValue('SEEDREAM_IMAGE_ENDPOINT', 'https://ark.cn-beijing.volces.com/api/v3/images/generations'),
      apiKey: envValue('SEEDREAM_IMAGE_API_KEY'),
      keyEnv: 'SEEDREAM_IMAGE_API_KEY',
      capabilities: { generate: true, edit: false, references: true },
    },
  ]
}

let cachedDefinitions = null
function definitions() {
  if (!cachedDefinitions) cachedDefinitions = createDefinitions()
  return cachedDefinitions
}

function refreshDefinitions() {
  cachedDefinitions = createDefinitions()
  return cachedDefinitions
}

function configuredDefinition(def) {
  return Boolean(def.apiKey && def.endpoint && def.model)
}

function preferredModelId(defs) {
  const configured = defs.filter(configuredDefinition)
  if (!configured.length) return defs[0]?.id || ''
  const explicitModel = envValue('JG_IMAGE_MODEL')
  const explicitProvider = envValue('JG_IMAGE_PROVIDER').toLowerCase()
  const explicit = configured.find((def) => def.id === explicitModel || def.model === explicitModel)
    || configured.find((def) => def.provider === explicitProvider || def.id === explicitProvider)
  return explicit?.id || configured.find((def) => def.capabilities.generate)?.id || configured[0].id
}

function publicModel(def, defaultModelId) {
  const configured = configuredDefinition(def)
  return {
    id: def.id,
    label: def.label,
    provider: def.provider,
    providerLabel: def.providerLabel,
    model: def.model,
    configured,
    default: def.id === defaultModelId,
    capabilities: { ...def.capabilities },
    keyEnv: def.keyEnv,
    disabledReason: configured ? '' : `未配置 ${def.keyEnv}`,
  }
}

export class ImageProviderError extends Error {
  constructor(message, { code = 'IMAGE_PROVIDER_ERROR', status = 502 } = {}) {
    super(message)
    this.name = 'ImageProviderError'
    this.code = code
    this.status = status
  }
}

export function listImageModels() {
  const defs = definitions()
  const defaultModelId = preferredModelId(defs)
  return defs.map((def) => publicModel(def, defaultModelId))
}

export function imageModelStatus(user = {}, net = 'inet') {
  const defs = definitions()
  const models = listImageModels()
  const defaultModelId = preferredModelId(defs)
  const selected = models.find((model) => model.id === defaultModelId && model.configured)
    || models.find((model) => model.configured)
    || null
  const allowedNetwork = net === 'inet'
  const allowedUser = user.id !== 'guest'
  const enabled = allowedNetwork && allowedUser && Boolean(selected)
  let reason = ''
  if (!allowedNetwork) reason = `当前为${net}网络，外部图像模型不启用`
  else if (!allowedUser) reason = '外部访客不能调用外部图像模型'
  else if (!selected) reason = '尚未配置图像模型：请配置 QWEN_IMAGE_API_KEY 或 SEEDREAM_IMAGE_API_KEY'
  else reason = '提示词会发送到外部图像模型；政务网与涉密网不启用'

  return {
    enabled,
    external: true,
    provider: selected?.provider || '',
    providerLabel: selected?.providerLabel || '',
    model: selected?.model || '',
    defaultModelId,
    models: models.map((model) => ({
      ...model,
      available: enabled && model.configured,
      disabledReason: !allowedNetwork
        ? `${net}网络不启用外部图像模型`
        : !allowedUser
          ? '外部访客不可用'
          : model.disabledReason,
    })),
    reason,
  }
}

export function getImageModel(modelId = '') {
  const defs = definitions()
  const selected = String(modelId || '').trim()
  const def = selected
    ? defs.find((item) => item.id === selected || item.model === selected)
    : defs.find((item) => item.id === preferredModelId(defs))
  if (!def) {
    throw new ImageProviderError('未知的图像模型', { code: 'IMAGE_MODEL_UNKNOWN', status: 400 })
  }
  if (!configuredDefinition(def)) {
    throw new ImageProviderError(`图像模型 ${def.label} 尚未配置，请设置 ${def.keyEnv}`, {
      code: 'IMAGE_MODEL_NOT_CONFIGURED',
      status: 503,
    })
  }
  return def
}

function qwenSize(width, height) {
  return `${Math.max(512, Math.round(width))}*${Math.max(512, Math.round(height))}`
}

const SEEDREAM_2K_SIZES = {
  '1:1': [2048, 2048],
  '4:3': [2368, 1776],
  '3:4': [1776, 2368],
  '4:5': [1776, 2220],
  '16:9': [2816, 1584],
  '9:16': [1584, 2816],
  '3:2': [2496, 1664],
}

function seedreamSize(ratio, width, height) {
  const pair = SEEDREAM_2K_SIZES[ratio]
  if (pair) return `${pair[0]}x${pair[1]}`
  return `${Math.max(1280, Math.round(width))}x${Math.max(720, Math.round(height))}`
}

async function responseJson(response) {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    throw new ImageProviderError(`图像模型返回了无法解析的响应（HTTP ${response.status}）`, {
      code: 'IMAGE_PROVIDER_BAD_RESPONSE',
      status: 502,
    })
  }
}

async function downloadImage(url, timeoutMs) {
  let response
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
    })
  } catch (error) {
    throw new ImageProviderError(`下载生成图像失败：${error?.message || error}`, {
      code: 'IMAGE_DOWNLOAD_FAILED',
      status: 502,
    })
  }
  if (!response.ok) {
    throw new ImageProviderError(`下载生成图像失败：HTTP ${response.status}`, {
      code: 'IMAGE_DOWNLOAD_FAILED',
      status: 502,
    })
  }
  const rawMime = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  const buffer = Buffer.from(await response.arrayBuffer())
  if (!ALLOWED_MIME.has(rawMime)) {
    throw new ImageProviderError(`图像模型返回了非图片内容：${rawMime || '未知类型'}`, {
      code: 'IMAGE_PROVIDER_BAD_MIME',
      status: 502,
    })
  }
  if (buffer.length < MIN_IMAGE_BYTES) {
    throw new ImageProviderError('图像模型返回的图片过小，可能生成失败', {
      code: 'IMAGE_PROVIDER_EMPTY_IMAGE',
      status: 502,
    })
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new ImageProviderError('图像模型返回的图片超过 24 MB', {
      code: 'IMAGE_PROVIDER_TOO_LARGE',
      status: 502,
    })
  }
  return { buffer, mime: rawMime }
}

function contentImageUrl(payload) {
  const content = payload?.output?.choices?.[0]?.message?.content
  if (Array.isArray(content)) {
    const image = content.find((item) => item && typeof item.image === 'string')
    if (image) return image.image
  }
  if (typeof payload?.output?.choices?.[0]?.message?.content === 'string') {
    return payload.output.choices[0].message.content
  }
  return ''
}

async function callProvider(def, options) {
  try {
    return await fetch(def.endpoint, options)
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError'
    throw new ImageProviderError(
      timedOut ? `${def.label} 请求超时` : `无法连接 ${def.label} 接口：${error?.message || error}`,
      { code: 'IMAGE_PROVIDER_UNREACHABLE', status: 502 },
    )
  }
}

function referenceInputsToDataUrls(referenceImages = []) {
  if (referenceImages == null) return []
  if (!Array.isArray(referenceImages)) {
    throw new ImageProviderError('参考图参数必须是数组', { code: 'IMAGE_REFERENCE_INVALID', status: 400 })
  }
  const items = referenceImages.filter(Boolean)
  if (items.length > MAX_REFERENCE_IMAGES) {
    throw new ImageProviderError(`最多只能提交 ${MAX_REFERENCE_IMAGES} 张参考图`, {
      code: 'IMAGE_REFERENCE_TOO_MANY',
      status: 400,
    })
  }
  return items.map((item, index) => {
    const buffer = item?.buffer
    if (!Buffer.isBuffer(buffer) || buffer.length < MIN_IMAGE_BYTES) {
      throw new ImageProviderError(`第 ${index + 1} 张参考图不存在或内容过小`, {
        code: 'IMAGE_REFERENCE_INVALID',
        status: 400,
      })
    }
    if (buffer.length > MAX_REFERENCE_INPUT_BYTES) {
      throw new ImageProviderError(`第 ${index + 1} 张参考图超过 10 MB`, {
        code: 'IMAGE_REFERENCE_TOO_LARGE',
        status: 413,
      })
    }
    const mime = String(item?.mime || '').split(';')[0].trim().toLowerCase()
    if (!ALLOWED_MIME.has(mime)) {
      throw new ImageProviderError(`第 ${index + 1} 张参考图格式不支持：${mime || '未知类型'}`, {
        code: 'IMAGE_REFERENCE_MIME_UNSUPPORTED',
        status: 400,
      })
    }
    return `data:${mime};base64,${buffer.toString('base64')}`
  })
}

async function callQwen(def, { prompt, width, height, seed, timeoutMs, sourceImages = [], operation = '生图', promptExtend = true }) {
  const content = []
  for (const image of sourceImages) content.push({ image })
  content.push({ text: prompt })
  const response = await callProvider(def, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${def.apiKey}`,
    },
    body: JSON.stringify({
      model: def.model,
      input: {
        messages: [{
          role: 'user',
          content,
        }],
      },
      parameters: {
        n: 1,
        size: qwenSize(width, height),
        prompt_extend: promptExtend,
        watermark: false,
        ...(Number.isInteger(seed) && seed > 0 ? { seed } : {}),
      },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const payload = await responseJson(response)
  if (!response.ok || payload.code) {
    const message = String(payload.message || payload.code || `HTTP ${response.status}`)
    throw new ImageProviderError(`Qwen ${operation}失败：${message}`, {
      code: 'IMAGE_PROVIDER_ERROR',
      status: response.status >= 400 && response.status < 500 ? 400 : 502,
    })
  }
  const url = contentImageUrl(payload)
  if (!url) {
    throw new ImageProviderError(`Qwen ${operation}未返回图像地址`, {
      code: 'IMAGE_PROVIDER_NO_IMAGE',
      status: 502,
    })
  }
  const image = await downloadImage(url, timeoutMs)
  const outputWidth = Number(payload?.usage?.output_width) || width
  const outputHeight = Number(payload?.usage?.output_height) || height
  return {
    ...image,
    width: outputWidth,
    height: outputHeight,
    provider: def.provider,
    providerLabel: def.providerLabel,
    model: def.model,
    modelId: def.id,
    requestId: String(payload.request_id || ''),
  }
}

async function callSeedream(def, { prompt, ratio, width, height, seed, timeoutMs, referenceImages = [] }) {
  const body = {
    model: def.model,
    prompt,
    size: seedreamSize(ratio, width, height),
    output_format: 'png',
    response_format: 'url',
    watermark: false,
  }
  if (referenceImages.length) {
    body.image = referenceImages.length === 1 ? referenceImages[0] : referenceImages
  }
  const response = await callProvider(def, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${def.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const payload = await responseJson(response)
  if (!response.ok || payload.error) {
    const message = String(payload?.error?.message || payload?.error || `HTTP ${response.status}`)
    if (/does not exist or you do not have access/i.test(message)) {
      throw new ImageProviderError(
        'Seedream 模型未开通或无访问权限：请在火山方舟控制台开通 Seedream 5.5（仅充值不会自动开通），并确认当前 API Key 所属项目可调用该模型。',
        { code: 'IMAGE_PROVIDER_MODEL_NOT_ACCESSIBLE', status: 503 },
      )
    }
    throw new ImageProviderError(`Seedream 生图失败：${message}`, {
      code: 'IMAGE_PROVIDER_ERROR',
      status: response.status >= 400 && response.status < 500 ? 400 : 502,
    })
  }
  const item = payload?.data?.[0]
  const url = typeof item?.url === 'string' ? item.url : ''
  const b64 = typeof item?.b64_json === 'string' ? item.b64_json : ''
  if (!url && !b64) {
    throw new ImageProviderError('Seedream 未返回图像数据', {
      code: 'IMAGE_PROVIDER_NO_IMAGE',
      status: 502,
    })
  }
  let image
  if (url) image = await downloadImage(url, timeoutMs)
  else {
    const buffer = Buffer.from(b64, 'base64')
    if (buffer.length < MIN_IMAGE_BYTES || buffer.length > MAX_IMAGE_BYTES) {
      throw new ImageProviderError('Seedream 返回的图片大小异常', {
        code: 'IMAGE_PROVIDER_EMPTY_IMAGE',
        status: 502,
      })
    }
    image = { buffer, mime: 'image/png' }
  }
  return {
    ...image,
    width: Number(item?.size?.width) || width,
    height: Number(item?.size?.height) || height,
    provider: def.provider,
    providerLabel: def.providerLabel,
    model: def.model,
    modelId: def.id,
    requestId: String(payload.request_id || payload.id || ''),
  }
}

export async function generateImage({ modelId = '', prompt = '', ratio = '1:1', width = 1024, height = 1024, seed = 0, referenceImages = [], timeoutMs = Number(process.env.JG_IMAGE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS) } = {}) {
  refreshDefinitions()
  const def = getImageModel(modelId)
  const cleanPrompt = String(prompt || '').trim()
  if (!cleanPrompt) {
    throw new ImageProviderError('请先描述要生成的图像', { code: 'IMAGE_PROMPT_REQUIRED', status: 400 })
  }
  if (cleanPrompt.length > 1200) {
    throw new ImageProviderError('提示词不能超过 1200 个字符', { code: 'IMAGE_PROMPT_TOO_LONG', status: 400 })
  }
  const referenceUrls = referenceInputsToDataUrls(referenceImages)
  const effectiveTimeout = Math.max(30_000, Math.min(300_000, Number(timeoutMs) || DEFAULT_TIMEOUT_MS))
  if (def.provider === 'qwen') {
    return callQwen(def, { prompt: cleanPrompt, width, height, seed, timeoutMs: effectiveTimeout, sourceImages: referenceUrls })
  }
  if (def.provider === 'seedream') {
    return callSeedream(def, { prompt: cleanPrompt, ratio, width, height, seed, timeoutMs: effectiveTimeout, referenceImages: referenceUrls })
  }
  throw new ImageProviderError(`未实现的图像 Provider：${def.provider}`, {
    code: 'IMAGE_PROVIDER_UNSUPPORTED',
    status: 501,
  })
}

export async function editImage({
  modelId = '',
  prompt = '',
  imageBuffer = null,
  imageMime = 'image/png',
  ratio = '1:1',
  width = 1024,
  height = 1024,
  seed = 0,
  timeoutMs = Number(process.env.JG_IMAGE_EDIT_TIMEOUT_MS || 240_000),
} = {}) {
  refreshDefinitions()
  const def = getImageModel(modelId)
  if (!def.capabilities.edit) {
    throw new ImageProviderError(`图像模型 ${def.label} 尚未开放图像编辑`, {
      code: 'IMAGE_EDIT_UNSUPPORTED',
      status: 400,
    })
  }
  const cleanPrompt = String(prompt || '').trim()
  if (!cleanPrompt) {
    throw new ImageProviderError('请先描述要如何修改这张图像', { code: 'IMAGE_EDIT_PROMPT_REQUIRED', status: 400 })
  }
  if (cleanPrompt.length > 1200) {
    throw new ImageProviderError('编辑要求不能超过 1200 个字符', { code: 'IMAGE_EDIT_PROMPT_TOO_LONG', status: 400 })
  }
  if (!imageBuffer || !Buffer.isBuffer(imageBuffer) || imageBuffer.length < MIN_IMAGE_BYTES) {
    throw new ImageProviderError('待编辑图像不存在或内容过小', {
      code: 'IMAGE_EDIT_SOURCE_MISSING',
      status: 400,
    })
  }
  if (imageBuffer.length > MAX_EDIT_INPUT_BYTES) {
    throw new ImageProviderError('待编辑图像超过 10 MB，无法提交给图像编辑模型', {
      code: 'IMAGE_EDIT_INPUT_TOO_LARGE',
      status: 413,
    })
  }
  const mime = String(imageMime || '').split(';')[0].trim().toLowerCase()
  if (!ALLOWED_MIME.has(mime)) {
    throw new ImageProviderError(`待编辑图像格式不支持：${mime || '未知类型'}`, {
      code: 'IMAGE_EDIT_SOURCE_MIME_UNSUPPORTED',
      status: 400,
    })
  }
  const sourceImage = `data:${mime};base64,${imageBuffer.toString('base64')}`
  const effectiveTimeout = Math.max(30_000, Math.min(300_000, Number(timeoutMs) || DEFAULT_TIMEOUT_MS))
  if (def.provider === 'qwen') {
    return callQwen(def, {
      prompt: cleanPrompt,
      width,
      height,
      seed,
      timeoutMs: effectiveTimeout,
      sourceImages: [sourceImage],
      operation: '编辑',
      promptExtend: false,
    })
  }
  throw new ImageProviderError(`图像模型 ${def.label} 的图像编辑尚未接入`, {
    code: 'IMAGE_EDIT_PROVIDER_UNSUPPORTED',
    status: 501,
  })
}

export async function editImageWithMask({
  prompt = '',
  imageBuffer = null,
  imageMime = 'image/png',
  maskDataUrl = '',
  width = 1024,
  height = 1024,
  timeoutMs = Number(process.env.WANX_IMAGE_TIMEOUT_MS || 180_000),
} = {}) {
  const apiKey = envValue('QWEN_IMAGE_API_KEY')
  if (!apiKey) {
    throw new ImageProviderError('尚未配置 QWEN_IMAGE_API_KEY，无法调用万相局部重绘', {
      code: 'IMAGE_MASK_PROVIDER_NOT_CONFIGURED',
      status: 503,
    })
  }
  const cleanPrompt = String(prompt || '').trim()
  if (!cleanPrompt) {
    throw new ImageProviderError('请先描述选区里要修改成什么', { code: 'IMAGE_MASK_PROMPT_REQUIRED', status: 400 })
  }
  if (cleanPrompt.length > 800) {
    throw new ImageProviderError('局部编辑要求不能超过 800 个字符', { code: 'IMAGE_MASK_PROMPT_TOO_LONG', status: 400 })
  }
  if (!imageBuffer || !Buffer.isBuffer(imageBuffer) || imageBuffer.length < MIN_IMAGE_BYTES) {
    throw new ImageProviderError('待编辑图像不存在或内容过小', { code: 'IMAGE_MASK_SOURCE_MISSING', status: 400 })
  }
  if (imageBuffer.length > MAX_EDIT_INPUT_BYTES) {
    throw new ImageProviderError('待编辑图像超过 10 MB，无法提交给局部重绘模型', { code: 'IMAGE_MASK_INPUT_TOO_LARGE', status: 413 })
  }
  const mime = String(imageMime || '').split(';')[0].trim().toLowerCase()
  if (!ALLOWED_MIME.has(mime)) {
    throw new ImageProviderError(`待编辑图像格式不支持：${mime || '未知类型'}`, { code: 'IMAGE_MASK_SOURCE_MIME_UNSUPPORTED', status: 400 })
  }
  const cleanMask = String(maskDataUrl || '')
  if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(cleanMask)) {
    throw new ImageProviderError('选区 Mask 不是有效的 PNG/JPEG/WebP data URL', { code: 'IMAGE_MASK_INVALID', status: 400 })
  }
  const maskBytes = Math.floor(cleanMask.length * 3 / 4)
  if (maskBytes > MAX_EDIT_INPUT_BYTES) {
    throw new ImageProviderError('选区 Mask 超过 10 MB', { code: 'IMAGE_MASK_TOO_LARGE', status: 413 })
  }
  const model = envValue('WANX_IMAGE_EDIT_MODEL', 'wanx2.1-imageedit')
  const endpoint = envValue('WANX_IMAGE_EDIT_ENDPOINT', 'https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis')
  const taskBase = envValue('WANX_IMAGE_EDIT_TASK_ENDPOINT', endpoint.replace('/services/aigc/image2image/image-synthesis', '/tasks'))
  const effectiveTimeout = Math.max(30_000, Math.min(300_000, Number(timeoutMs) || 180_000))
  const sourceDataUrl = `data:${mime};base64,${imageBuffer.toString('base64')}`
  let createResponse
  try {
    createResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify({
        model,
        input: {
          function: 'description_edit_with_mask',
          prompt: cleanPrompt,
          base_image_url: sourceDataUrl,
          mask_image_url: cleanMask,
        },
        parameters: {
          n: 1,
          watermark: false,
          ...(Number(width) >= 512 && Number(height) >= 512 ? { size: `${Math.round(Number(width))}*${Math.round(Number(height))}` } : {}),
        },
      }),
      signal: AbortSignal.timeout(Math.min(30_000, effectiveTimeout)),
    })
  } catch (error) {
    throw new ImageProviderError(`无法连接万相局部重绘接口：${error?.message || error}`, {
      code: 'IMAGE_MASK_PROVIDER_UNREACHABLE',
      status: 502,
    })
  }
  const createPayload = await responseJson(createResponse)
  if (!createResponse.ok) {
    throw new ImageProviderError(createPayload?.message || `万相局部重绘创建任务失败（HTTP ${createResponse.status}）`, {
      code: createPayload?.code || 'IMAGE_MASK_CREATE_FAILED',
      status: createResponse.status >= 400 && createResponse.status < 500 ? 400 : 502,
    })
  }
  const taskId = String(createPayload?.output?.task_id || '')
  if (!taskId) {
    throw new ImageProviderError('万相局部重绘未返回 task_id', { code: 'IMAGE_MASK_TASK_MISSING', status: 502 })
  }
  const deadline = Date.now() + effectiveTimeout
  let lastStatus = 'PENDING'
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    let pollResponse
    try {
      pollResponse = await fetch(`${taskBase}/${encodeURIComponent(taskId)}`, {
        headers: { authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(20_000),
      })
    } catch (error) {
      throw new ImageProviderError(`查询万相局部重绘任务失败：${error?.message || error}`, {
        code: 'IMAGE_MASK_POLL_FAILED',
        status: 502,
      })
    }
    const payload = await responseJson(pollResponse)
    if (!pollResponse.ok) {
      throw new ImageProviderError(payload?.message || `查询万相任务失败（HTTP ${pollResponse.status}）`, {
        code: payload?.code || 'IMAGE_MASK_POLL_FAILED',
        status: 502,
      })
    }
    lastStatus = String(payload?.output?.task_status || '')
    if (lastStatus === 'SUCCEEDED') {
      const resultUrl = String(payload?.output?.results?.find?.((item) => item?.url)?.url || '')
      if (!resultUrl) {
        throw new ImageProviderError('万相局部重绘成功但未返回图像 URL', { code: 'IMAGE_MASK_RESULT_EMPTY', status: 502 })
      }
      const downloaded = await downloadImage(resultUrl, Math.max(10_000, deadline - Date.now()))
      return {
        ...downloaded,
        provider: 'wanx',
        providerLabel: '阿里云百炼 · 万相',
        model,
        modelId: 'wanx-edit',
        requestId: String(payload.request_id || ''),
        taskId,
      }
    }
    if (lastStatus === 'FAILED' || lastStatus === 'CANCELED') {
      throw new ImageProviderError(
        payload?.output?.message || `万相局部重绘任务${lastStatus === 'CANCELED' ? '已取消' : '失败'}`,
        { code: payload?.output?.code || 'IMAGE_MASK_TASK_FAILED', status: 502 },
      )
    }
  }
  throw new ImageProviderError(`万相局部重绘任务超时（最后状态 ${lastStatus || '未知'}）`, {
    code: 'IMAGE_MASK_TIMEOUT',
    status: 504,
  })
}
