/**
 * 生图专用模型适配层。
 *
 * 这里只负责图片 Provider 的注册、配置检查和调用归一化，不接聊天模型网关，
 * 也不把第三方 Key 暴露给前端。没有配置 Key 的模型保持“未配置”，不生成假图、
 * 不回退到其他 Provider。
 */

import { createRequire } from 'node:module'
import { createHash, createHmac } from 'node:crypto'

const requireFromHere = createRequire(import.meta.url)

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
      capabilities: { generate: true, edit: true, references: true, layers: true },
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
  const allowedNetwork = net === 'inet' || net === 'gov'
  const allowedUser = user.id !== 'guest'
  const enabled = allowedNetwork && allowedUser && Boolean(selected)
  let reason = ''
  if (!allowedNetwork) reason = `当前为${net}网络，外部图像模型不启用`
  else if (!allowedUser) reason = '外部访客不能调用外部图像模型'
  else if (!selected) reason = '尚未配置图像模型：请配置 QWEN_IMAGE_API_KEY 或 SEEDREAM_IMAGE_API_KEY'
  else reason = '提示词会发送到外部图像模型；互联网与政务网均按管理中心模型网关策略执行'

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
  if (def.provider === 'seedream') {
    // 火山方舟把“单图生图”作为编辑入口：image + 指令 prompt，同一 endpoint。
    return callSeedream(def, {
      prompt: cleanPrompt,
      ratio,
      width,
      height,
      seed,
      timeoutMs: effectiveTimeout,
      referenceImages: [sourceImage],
    })
  }
  throw new ImageProviderError(`图像模型 ${def.label} 的图像编辑尚未接入`, {
    code: 'IMAGE_EDIT_PROVIDER_UNSUPPORTED',
    status: 501,
  })
}

function b64ToLayerImage(b64) {
  const buffer = Buffer.from(b64, 'base64')
  if (buffer.length < MIN_IMAGE_BYTES || buffer.length > MAX_IMAGE_BYTES) {
    throw new ImageProviderError('图层模型返回的图片大小异常', { code: 'IMAGE_PROVIDER_EMPTY_IMAGE', status: 502 })
  }
  return { buffer, mime: 'image/png' }
}

function normalizeLayerBox(box) {
  if (!box || typeof box !== 'object') return {}
  const pick = (value) => Array.isArray(value) ? value.map((n) => Number(n) || 0) : []
  const out = {}
  if (box.absolute) out.absolute = pick(box.absolute)
  if (box.normalized) out.normalized = pick(box.normalized)
  return out
}

/**
 * 图层拆分：把单张图交给支持 layer_decomposition 的 Seedream 模型，
 * 返回 1 张底图（z_index=0）与若干带透明通道的独立图层（含叠放顺序、边界框、名称、描述）。
 */
export async function decomposeImage({
  modelId = '',
  prompt = '',
  imageBuffer = null,
  imageMime = 'image/png',
  timeoutMs = Number(process.env.JG_IMAGE_DECOMPOSE_TIMEOUT_MS || 240_000),
} = {}) {
  refreshDefinitions()
  const def = getImageModel(modelId)
  if (def.provider !== 'seedream' || !def.capabilities.layers) {
    throw new ImageProviderError('当前图像模型不支持图层拆分', { code: 'IMAGE_LAYER_UNSUPPORTED', status: 501 })
  }
  if (!imageBuffer || !Buffer.isBuffer(imageBuffer) || imageBuffer.length < MIN_IMAGE_BYTES) {
    throw new ImageProviderError('待拆分图像不存在或内容过小', { code: 'IMAGE_LAYER_SOURCE_MISSING', status: 400 })
  }
  if (imageBuffer.length > MAX_EDIT_INPUT_BYTES) {
    throw new ImageProviderError('待拆分图像超过 10 MB，无法提交给图像模型', { code: 'IMAGE_LAYER_INPUT_TOO_LARGE', status: 413 })
  }
  const mime = String(imageMime || '').split(';')[0].trim().toLowerCase()
  if (!ALLOWED_MIME.has(mime)) {
    throw new ImageProviderError(`待拆分图像格式不支持：${mime || '未知类型'}`, { code: 'IMAGE_LAYER_SOURCE_MIME_UNSUPPORTED', status: 400 })
  }
  const sourceImage = `data:${mime};base64,${imageBuffer.toString('base64')}`
  const cleanPrompt = String(prompt || '').trim()
  const body = {
    model: def.model,
    image: sourceImage,
    layer_decomposition: true,
    size: '2K',
    output_format: 'png',
    response_format: 'url',
    watermark: false,
  }
  if (cleanPrompt) body.prompt = cleanPrompt
  const effectiveTimeout = Math.max(30_000, Math.min(300_000, Number(timeoutMs) || DEFAULT_TIMEOUT_MS))
  const response = await callProvider(def, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${def.apiKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(effectiveTimeout),
  })
  const payload = await responseJson(response)
  if (!response.ok || payload.error) {
    const message = String(payload?.error?.message || payload?.error || `HTTP ${response.status}`)
    throw new ImageProviderError(`图层拆分失败：${message}`, {
      code: 'IMAGE_PROVIDER_ERROR',
      status: response.status >= 400 && response.status < 500 ? 400 : 502,
    })
  }
  const items = Array.isArray(payload.data) ? payload.data : []
  if (!items.length) {
    throw new ImageProviderError('图层拆分模型未返回任何图层', { code: 'IMAGE_LAYER_NO_RESULT', status: 502 })
  }
  let base = null
  const layers = []
  for (const item of items) {
    const url = typeof item?.url === 'string' ? item.url : ''
    const b64 = typeof item?.b64_json === 'string' ? item.b64_json : ''
    if (!url && !b64) continue
    const image = url ? await downloadImage(url, effectiveTimeout) : b64ToLayerImage(b64)
    const zIndex = Number.isInteger(Number(item?.z_index)) ? Number(item.z_index) : layers.length + 1
    const layer = {
      ...image,
      zIndex,
      box: normalizeLayerBox(item?.bounding_box),
      name: String(item?.name || ''),
      description: String(item?.description || ''),
      width: Number(item?.size?.width) || 0,
      height: Number(item?.size?.height) || 0,
      provider: def.provider,
      providerLabel: def.providerLabel,
      model: def.model,
      modelId: def.id,
    }
    if (zIndex === 0) base = layer
    else layers.push(layer)
  }
  if (!base) throw new ImageProviderError('图层拆分模型未返回底图', { code: 'IMAGE_LAYER_NO_BASE', status: 502 })
  layers.sort((a, b) => a.zIndex - b.zIndex)
  return { base, layers, requestId: String(payload.request_id || payload.id || '') }
}

let sharpLib
function getSharpLib() {
  if (sharpLib !== undefined) return sharpLib
  try { sharpLib = requireFromHere('./dsh-runtime/node_modules/sharp') } catch { sharpLib = null }
  return sharpLib
}

// 选区编辑只把选区所在的矩形区域交给当前选中的预设图像模型，再按选区像素合成回原图。
// 因此选区外像素保持原样，也不需要任何第三方 Mask 模型。
const REGION_RATIOS = {
  '1:1': [1, 1],
  '4:3': [4, 3],
  '3:4': [3, 4],
  '4:5': [4, 5],
  '16:9': [16, 9],
  '9:16': [9, 16],
  '3:2': [3, 2],
}

function nearestRegionRatio(width, height) {
  let best = null
  for (const [key, [rw, rh]] of Object.entries(REGION_RATIOS)) {
    const diff = Math.abs(Math.log((width / height) / (rw / rh)))
    if (!best || diff < best.diff) best = { key, diff, target: rw / rh }
  }
  return best
}

function expandRectToRatio(rect, maxWidth, maxHeight, target) {
  let width = rect.width
  let height = rect.height
  if (width / height < target) width = Math.round(height * target)
  else height = Math.round(width / target)
  if (width > maxWidth) {
    width = maxWidth
    height = Math.round(width / target)
  }
  if (height > maxHeight) {
    height = maxHeight
    width = Math.round(height * target)
  }
  width = Math.max(rect.width, Math.min(maxWidth, width))
  height = Math.max(rect.height, Math.min(maxHeight, height))
  const left = Math.max(0, Math.min(maxWidth - width, Math.round(rect.left - (width - rect.width) / 2)))
  const top = Math.max(0, Math.min(maxHeight - height, Math.round(rect.top - (height - rect.height) / 2)))
  return { left, top, width, height }
}

/**
 * 选区局部重绘：用 mask（白色=编辑区）定位矩形选区，裁剪后交给选中的预设模型编辑，
 * 再把结果按 mask 羽化边界合成回原图，选区外的像素保持原样。
 */
export async function editImageInRegion({
  modelId = '',
  prompt = '',
  imageBuffer = null,
  imageMime = 'image/png',
  maskBuffer = null,
  timeoutMs = Number(process.env.JG_IMAGE_EDIT_TIMEOUT_MS || 240_000),
} = {}) {
  const sharp = getSharpLib()
  if (!sharp) {
    throw new ImageProviderError('当前环境缺少图像合成组件，无法执行选区局部重绘', {
      code: 'IMAGE_REGION_UNAVAILABLE',
      status: 503,
    })
  }
  const cleanPrompt = String(prompt || '').trim()
  if (!cleanPrompt) {
    throw new ImageProviderError('请先描述选区里要修改成什么', { code: 'IMAGE_REGION_PROMPT_REQUIRED', status: 400 })
  }
  if (cleanPrompt.length > 800) {
    throw new ImageProviderError('局部编辑要求不能超过 800 个字符', { code: 'IMAGE_REGION_PROMPT_TOO_LONG', status: 400 })
  }
  if (!imageBuffer || !Buffer.isBuffer(imageBuffer) || imageBuffer.length < MIN_IMAGE_BYTES) {
    throw new ImageProviderError('待编辑图像不存在或内容过小', { code: 'IMAGE_REGION_SOURCE_MISSING', status: 400 })
  }
  if (imageBuffer.length > MAX_EDIT_INPUT_BYTES) {
    throw new ImageProviderError('待编辑图像超过 10 MB，无法做选区局部重绘', { code: 'IMAGE_REGION_INPUT_TOO_LARGE', status: 413 })
  }
  const mime = String(imageMime || '').split(';')[0].trim().toLowerCase()
  if (!ALLOWED_MIME.has(mime)) {
    throw new ImageProviderError(`待编辑图像格式不支持：${mime || '未知类型'}`, { code: 'IMAGE_REGION_SOURCE_MIME_UNSUPPORTED', status: 400 })
  }
  if (!maskBuffer || !Buffer.isBuffer(maskBuffer) || !maskBuffer.length) {
    throw new ImageProviderError('选区为空', { code: 'IMAGE_REGION_MASK_EMPTY', status: 400 })
  }
  if (maskBuffer.length > MAX_EDIT_INPUT_BYTES) {
    throw new ImageProviderError('选区 Mask 超过 10 MB', { code: 'IMAGE_REGION_MASK_TOO_LARGE', status: 413 })
  }
  let sourceMeta
  try {
    sourceMeta = await sharp(imageBuffer).metadata()
  } catch (error) {
    throw new ImageProviderError(`待编辑图像无法解析：${error?.message || error}`, { code: 'IMAGE_REGION_SOURCE_UNREADABLE', status: 400 })
  }
  const width = Number(sourceMeta.width || 0)
  const height = Number(sourceMeta.height || 0)
  if (width < 128 || height < 128 || width > 4096 || height > 4096) {
    throw new ImageProviderError('当前图片尺寸不适合选区局部重绘，宽度和高度需在 128–4096 像素之间', {
      code: 'IMAGE_REGION_SOURCE_SIZE_UNSUPPORTED',
      status: 400,
    })
  }
  const maskRaw = await sharp(maskBuffer)
    .resize(width, height, { fit: 'fill', kernel: 'nearest' })
    .greyscale()
    .threshold(128)
    .raw()
    .toBuffer({ resolveWithObject: true })
  const pixels = maskRaw.data
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  let marked = 0
  for (let y = 0; y < height; y += 1) {
    const row = y * width
    for (let x = 0; x < width; x += 1) {
      if (pixels[row + x]) {
        marked += 1
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (!marked || maxX < 0 || maxY < 0) {
    throw new ImageProviderError('选区里没有任何内容，请先在图上画出要修改的区域', { code: 'IMAGE_REGION_MASK_EMPTY', status: 400 })
  }
  const coverage = marked / (width * height)
  if (coverage >= 0.92) {
    // 几乎整图：直接整图编辑，不再裁剪，避免无意义的放大与合成。
    const image = await editImage({
      modelId,
      prompt: cleanPrompt,
      imageBuffer,
      imageMime: mime,
      ratio: nearestRegionRatio(width, height).key,
      width,
      height,
      timeoutMs,
    })
    return {
      ...image,
      width,
      height,
      region: { x: 0, y: 0, width, height },
      wholeImage: true,
    }
  }
  const spanWidth = maxX - minX + 1
  const spanHeight = maxY - minY + 1
  if (spanWidth < 16 || spanHeight < 16) {
    throw new ImageProviderError('选区太小，请扩大选区后再重绘', { code: 'IMAGE_REGION_TOO_SMALL', status: 400 })
  }
  const pad = Math.max(12, Math.round(Math.max(spanWidth, spanHeight) * 0.08))
  const right = Math.min(width, maxX + pad + 1)
  const bottom = Math.min(height, maxY + pad + 1)
  const baseRect = {
    left: Math.max(0, minX - pad),
    top: Math.max(0, minY - pad),
    width: right - Math.max(0, minX - pad),
    height: bottom - Math.max(0, minY - pad),
  }
  const ratio = nearestRegionRatio(baseRect.width, baseRect.height)
  const rect = expandRectToRatio(baseRect, width, height, ratio.target)
  const cropBuffer = await sharp(imageBuffer).extract(rect).png().toBuffer()
  const minSide = Math.min(rect.width, rect.height)
  const sendBuffer = minSide < 512
    ? await sharp(cropBuffer).resize(
      Math.round(rect.width * (512 / minSide)),
      Math.round(rect.height * (512 / minSide)),
      { fit: 'fill' },
    ).png().toBuffer()
    : cropBuffer
  const regionPrompt = `${cleanPrompt}\n\n（上图是从一张更大的原图里裁出的局部区域，尺寸 ${rect.width}×${rect.height}。只修改这块区域里需要改的内容，保持原有的透视、光照、材质与纹理，让边缘和周围自然衔接。）`
  const edited = await editImage({
    modelId,
    prompt: regionPrompt,
    imageBuffer: sendBuffer,
    imageMime: 'image/png',
    ratio: ratio.key,
    width: rect.width,
    height: rect.height,
    timeoutMs,
  })
  const editedResized = await sharp(edited.buffer)
    .resize(rect.width, rect.height, { fit: 'fill' })
    .removeAlpha()
    .toBuffer()
  const maskPatch = await sharp(maskBuffer)
    .resize(width, height, { fit: 'fill', kernel: 'nearest' })
    .greyscale()
    .extract(rect)
    .blur(1.4)
    .raw()
    .toBuffer()
  const patch = await sharp(editedResized)
    .joinChannel(maskPatch, { raw: { width: rect.width, height: rect.height, channels: 1 } })
    .png()
    .toBuffer()
  const composed = await sharp(imageBuffer)
    .composite([{ input: patch, left: rect.left, top: rect.top, blend: 'over' }])
    .png()
    .toBuffer({ resolveWithObject: true })
  return {
    buffer: composed.data,
    mime: 'image/png',
    width,
    height,
    provider: edited.provider,
    providerLabel: edited.providerLabel,
    model: edited.model,
    modelId: edited.modelId,
    requestId: String(edited.requestId || ''),
    region: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
    coverage,
  }
}

// ===== 火山视觉服务（visual.volcengineapi.com，IAM AK/SK 签名）：官方扩图 + Seedream 基模超清 =====

const VOLC_VISUAL_REGION = envValue('VOLC_VISUAL_REGION', 'cn-north-1')
const VOLC_VISUAL_SERVICE = 'cv'
const VOLC_VISUAL_VERSION = '2022-08-31'

function visualCredentials() {
  return {
    ak: envValue('VOLC_VISUAL_AK'),
    sk: envValue('VOLC_VISUAL_SK'),
    host: envValue('VOLC_VISUAL_HOST', 'visual.volcengineapi.com'),
  }
}

export function visualStatus() {
  const { ak, sk } = visualCredentials()
  const configured = Boolean(ak && sk)
  return {
    configured,
    akEnv: 'VOLC_VISUAL_AK',
    skEnv: 'VOLC_VISUAL_SK',
    disabledReason: configured ? '' : '尚未配置火山视觉服务 AK/SK（VOLC_VISUAL_AK / VOLC_VISUAL_SK）',
  }
}

function volcSha256Hex(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

function volcHmac(key, data) {
  return createHmac('sha256', key).update(data, 'utf8').digest()
}

function volcNormQuery(params) {
  return Object.keys(params).sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&')
}

function volcStamp(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
}

async function volcVisualCall(action, bodyObj, timeoutMs) {
  const { ak, sk, host } = visualCredentials()
  if (!ak || !sk) {
    throw new ImageProviderError('火山视觉服务尚未配置 AK/SK', { code: 'IMAGE_VISUAL_NOT_CONFIGURED', status: 503 })
  }
  const method = 'POST'
  const path = '/'
  const query = { Action: action, Version: VOLC_VISUAL_VERSION }
  const queryString = volcNormQuery(query)
  const body = JSON.stringify(bodyObj)
  const date = new Date()
  const xDate = volcStamp(date)
  const shortDate = xDate.slice(0, 8)
  const payloadHash = volcSha256Hex(body)
  const headers = [
    `content-type:application/json`,
    `host:${host}`,
    `x-content-sha256:${payloadHash}`,
    `x-date:${xDate}`,
  ]
  const signedHeaders = 'content-type;host;x-content-sha256;x-date'
  const canonicalRequest = [method, path, queryString, headers.join('\n'), '', signedHeaders, payloadHash].join('\n')
  const credentialScope = `${shortDate}/${VOLC_VISUAL_REGION}/${VOLC_VISUAL_SERVICE}/request`
  const stringToSign = ['HMAC-SHA256', xDate, credentialScope, volcSha256Hex(canonicalRequest)].join('\n')
  const kDate = volcHmac(sk, shortDate)
  const kRegion = volcHmac(kDate, VOLC_VISUAL_REGION)
  const kService = volcHmac(kRegion, VOLC_VISUAL_SERVICE)
  const kSigning = volcHmac(kService, 'request')
  const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex')
  const authorization = `HMAC-SHA256 Credential=${ak}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const base = host.includes('://') ? host : `https://${host}`
  let response
  try {
    response = await fetch(`${base}${path}?${queryString}`, {
      method,
      headers: {
        'content-type': 'application/json',
        'host': host,
        'x-date': xDate,
        'x-content-sha256': payloadHash,
        authorization,
      },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    throw new ImageProviderError(`无法连接火山视觉服务：${error?.message || error}`, { code: 'IMAGE_VISUAL_UNREACHABLE', status: 502 })
  }
  const payload = await responseJson(response)
  if (payload && Number(payload.code) !== 10000) {
    const message = String(payload.message || payload.code || `HTTP ${response.status}`)
    throw new ImageProviderError(`视觉服务失败：${message}`, {
      code: 'IMAGE_VISUAL_ERROR',
      status: response.status >= 400 && response.status < 500 ? 400 : 502,
    })
  }
  if (!response.ok) {
    throw new ImageProviderError(`视觉服务返回 HTTP ${response.status}`, { code: 'IMAGE_VISUAL_BAD_STATUS', status: 502 })
  }
  return payload
}

async function visualResultImage(data, timeoutMs, fallbackMime) {
  const url = Array.isArray(data?.image_urls) && typeof data.image_urls[0] === 'string' ? data.image_urls[0] : ''
  const b64 = Array.isArray(data?.binary_data_base64) && typeof data.binary_data_base64[0] === 'string' ? data.binary_data_base64[0] : ''
  if (!url && !b64) {
    throw new ImageProviderError('视觉服务未返回图像数据', { code: 'IMAGE_VISUAL_NO_IMAGE', status: 502 })
  }
  if (url) return downloadImage(url, timeoutMs)
  const buffer = Buffer.from(b64, 'base64')
  if (buffer.length < MIN_IMAGE_BYTES || buffer.length > MAX_IMAGE_BYTES) {
    throw new ImageProviderError('视觉服务返回的图片大小异常', { code: 'IMAGE_VISUAL_EMPTY_IMAGE', status: 502 })
  }
  return { buffer, mime: fallbackMime }
}

function visualInputCheck(imageBuffer, imageMime, prefix) {
  if (!imageBuffer || !Buffer.isBuffer(imageBuffer) || imageBuffer.length < MIN_IMAGE_BYTES) {
    throw new ImageProviderError('待处理图像不存在或内容过小', { code: `${prefix}_SOURCE_MISSING`, status: 400 })
  }
  if (imageBuffer.length > MAX_EDIT_INPUT_BYTES) {
    throw new ImageProviderError('待处理图像超过 10 MB', { code: `${prefix}_INPUT_TOO_LARGE`, status: 413 })
  }
  const mime = String(imageMime || '').split(';')[0].trim().toLowerCase()
  if (!ALLOWED_MIME.has(mime)) {
    throw new ImageProviderError(`待处理图像格式不支持：${mime || '未知类型'}`, { code: `${prefix}_SOURCE_MIME_UNSUPPORTED`, status: 400 })
  }
  return mime
}

/**
 * 官方智能扩图：原图保持不变，按四边比例向外生成延展区域。
 * expand 为单边相对原图边长的比例（0,1]，四边使用同一值即等比扩展。
 */
export async function expandImage({
  imageBuffer = null,
  imageMime = 'image/png',
  prompt = '',
  expand = 0.1,
  top = null,
  bottom = null,
  left = null,
  right = null,
  maxWidth = 1920,
  maxHeight = 1920,
  timeoutMs = Number(process.env.JG_IMAGE_EXPAND_TIMEOUT_MS || 180_000),
} = {}) {
  const mime = visualInputCheck(imageBuffer, imageMime, 'IMAGE_EXPAND')
  const base = Math.max(0.05, Math.min(1, Number(expand) || 0.1))
  const side = (value) => (value == null ? base : Math.max(0, Math.min(1, Number(value) || 0)))
  const padTop = side(top)
  const padBottom = side(bottom)
  const padLeft = side(left)
  const padRight = side(right)
  const cleanPrompt = String(prompt || '').trim().slice(0, 100)
  const effectiveTimeout = Math.max(30_000, Math.min(300_000, Number(timeoutMs) || DEFAULT_TIMEOUT_MS))
  const payload = await volcVisualCall('CVProcess', {
    req_key: 'i2i_outpainting',
    binary_data_base64: [imageBuffer.toString('base64')],
    custom_prompt: cleanPrompt,
    top: padTop,
    bottom: padBottom,
    left: padLeft,
    right: padRight,
    max_width: Math.max(640, Math.min(4096, Number(maxWidth) || 1920)),
    max_height: Math.max(640, Math.min(4096, Number(maxHeight) || 1920)),
    return_url: true,
  }, effectiveTimeout)
  const image = await visualResultImage(payload?.data, effectiveTimeout, 'image/jpeg')
  return {
    ...image,
    provider: 'volc-visual',
    providerLabel: '火山视觉扩图',
    model: 'i2i_outpainting',
    modelId: 'i2i_outpainting',
    requestId: String(payload?.data?.request_id || payload?.request_id || ''),
  }
}

const UPSCALE_REQ_KEY = 'jimeng_i2i_seed3_tilesr_cvtob'

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Seedream 基模智能超清：提交异步任务后轮询结果，输出 4K/8K。
 */
export async function upscaleImage({
  imageBuffer = null,
  imageMime = 'image/png',
  resolution = '4k',
  scale = 50,
  timeoutMs = Number(process.env.JG_IMAGE_UPSCALE_TIMEOUT_MS || 240_000),
} = {}) {
  const mime = visualInputCheck(imageBuffer, imageMime, 'IMAGE_UPSCALE')
  const res = ['4k', '8k'].includes(String(resolution)) ? String(resolution) : '4k'
  const detail = Math.max(0, Math.min(100, Number(scale) || 50))
  const effectiveTimeout = Math.max(30_000, Math.min(300_000, Number(timeoutMs) || DEFAULT_TIMEOUT_MS))
  const submit = await volcVisualCall('CVSync2AsyncSubmitTask', {
    req_key: UPSCALE_REQ_KEY,
    binary_data_base64: [imageBuffer.toString('base64')],
    resolution: res,
    scale: detail,
  }, effectiveTimeout)
  const taskId = String(submit?.data?.task_id || '')
  if (!taskId) throw new ImageProviderError('超清任务未返回任务编号', { code: 'IMAGE_UPSCALE_NO_TASK', status: 502 })

  const deadline = Date.now() + effectiveTimeout
  let resultData = null
  while (Date.now() < deadline) {
    await sleep(2000)
    const poll = await volcVisualCall('CVSync2AsyncGetResult', {
      req_key: UPSCALE_REQ_KEY,
      task_id: taskId,
      req_json: JSON.stringify({ return_url: true }),
    }, effectiveTimeout)
    const data = poll?.data
    const status = String(data?.status || '')
    if (status === 'done') { resultData = data; break }
    if (status === 'not_found' || status === 'expired') {
      throw new ImageProviderError(`超清任务${status === 'expired' ? '已过期' : '不存在'}`, { code: 'IMAGE_UPSCALE_TASK_LOST', status: 502 })
    }
  }
  if (!resultData) throw new ImageProviderError('超清任务处理超时', { code: 'IMAGE_UPSCALE_TIMEOUT', status: 502 })
  const image = await visualResultImage(resultData, effectiveTimeout, 'image/png')
  return {
    ...image,
    provider: 'volc-visual',
    providerLabel: 'Seedream 智能超清',
    model: UPSCALE_REQ_KEY,
    modelId: UPSCALE_REQ_KEY,
    requestId: taskId,
  }
}
