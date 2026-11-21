import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const sharp = require('../dsh-runtime/node_modules/sharp')

const IMAGE_BYTES = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(10 * 1024, 0),
])

let baseUrl = ''
let server
let qwenRequest = null
let seedreamRequest = null
let visualRequests = []
let upscalePollCount = 0
let imageProviders
let editResultPng = null
let regionSourcePng = null
let regionMaskPng = null

function noiseRgb(width, height) {
  const raw = Buffer.alloc(width * height * 3)
  for (let i = 0; i < raw.length; i += 1) raw[i] = (i * 37 + Math.floor(i / 7)) % 256
  return sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer()
}

function maskRectPng(width, height, rect) {
  const raw = Buffer.alloc(width * height, 0)
  for (let y = rect.top; y < rect.top + rect.height; y += 1) {
    for (let x = rect.left; x < rect.left + rect.width; x += 1) raw[y * width + x] = 255
  }
  return sharp(raw, { raw: { width, height, channels: 1 } }).png().toBuffer()
}

async function pixelAt(buffer, x, y) {
  const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true })
  const offset = (y * info.width + x) * info.channels
  return [data[offset], data[offset + 1], data[offset + 2]]
}

before(async () => {
  editResultPng = await noiseRgb(2048, 2048)
  regionSourcePng = await noiseRgb(1024, 1024)
  regionMaskPng = await maskRectPng(1024, 1024, { left: 300, top: 300, width: 220, height: 180 })
  server = createServer((req, res) => {
    if (req.url === '/image.png') {
      res.writeHead(200, { 'content-type': 'image/png' })
      res.end(IMAGE_BYTES)
      return
    }
    if (req.url === '/edit-result.png') {
      res.writeHead(200, { 'content-type': 'image/png' })
      res.end(editResultPng)
      return
    }
    let body = ''
    req.setEncoding('utf8')
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      const parsed = JSON.parse(body || '{}')
      if (req.url === '/qwen-image') {
        qwenRequest = parsed
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({
          output: {
            choices: [{
              finish_reason: 'stop',
              message: { role: 'assistant', content: [{ image: `${baseUrl}/image.png` }] },
            }],
          },
          usage: { output_width: 1024, output_height: 1024 },
          request_id: 'qwen-request-1',
        }))
        return
      }
      if (req.url === '/seedream-image') {
        seedreamRequest = parsed
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({
          data: [{ url: `${baseUrl}/edit-result.png`, size: { width: 2048, height: 2048 } }],
          request_id: 'seedream-request-1',
        }))
        return
      }
      const action = new URL(req.url, 'http://x').searchParams.get('Action')
      if (action) {
        visualRequests.push({ action, body: parsed })
        res.writeHead(200, { 'content-type': 'application/json' })
        if (action === 'CVProcess') {
          res.end(JSON.stringify({ code: 10000, data: { image_urls: [`${baseUrl}/edit-result.png`], request_id: 'visual-req-1' }, request_id: 'visual-req-1' }))
        } else if (action === 'CVSync2AsyncSubmitTask') {
          res.end(JSON.stringify({ code: 10000, data: { task_id: 'task-1' } }))
        } else {
          upscalePollCount += 1
          const status = upscalePollCount === 1 ? 'generating' : 'done'
          res.end(JSON.stringify({ code: 10000, data: { status, ...(status === 'done' ? { image_urls: [`${baseUrl}/edit-result.png`] } : {}) } }))
        }
        return
      }
      res.writeHead(404)
      res.end('not found')
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
  process.env.QWEN_IMAGE_API_KEY = 'test-qwen-key'
  process.env.QWEN_IMAGE_ENDPOINT = `${baseUrl}/qwen-image`
  process.env.SEEDREAM_IMAGE_API_KEY = 'test-seedream-key'
  process.env.SEEDREAM_IMAGE_ENDPOINT = `${baseUrl}/seedream-image`
  process.env.VOLC_VISUAL_AK = 'test-ak'
  process.env.VOLC_VISUAL_SK = 'test-sk'
  process.env.VOLC_VISUAL_HOST = baseUrl
  imageProviders = await import('../image-providers.mjs')
})

after(async () => {
  await new Promise((resolve) => server.close(resolve))
})

test('Qwen 适配器按官方 DashScope 形态提交并解析 output.choices[].image', async () => {
  const result = await imageProviders.generateImage({
    modelId: 'qwen-image',
    prompt: '一张测试图',
    width: 1024,
    height: 1024,
    seed: 42,
    timeoutMs: 5000,
  })
  assert.equal(qwenRequest.model, 'qwen-image-3.0-pro')
  assert.equal(qwenRequest.input.messages[0].content[0].text, '一张测试图')
  assert.equal(qwenRequest.parameters.size, '1024*1024')
  assert.equal(qwenRequest.parameters.seed, 42)
  assert.equal(result.provider, 'qwen')
  assert.equal(result.modelId, 'qwen-image')
  assert.equal(result.mime, 'image/png')
  assert.ok(result.buffer.length >= 8 * 1024)
  assert.equal(result.requestId, 'qwen-request-1')
})

test('Qwen 生成支持多参考图，按上传顺序放入 content 后再跟文本', async () => {
  const refs = [
    { buffer: IMAGE_BYTES, mime: 'image/png' },
    { buffer: IMAGE_BYTES, mime: 'image/png' },
  ]
  const result = await imageProviders.generateImage({
    modelId: 'qwen-image',
    prompt: '参考两张图的构图和材质生成新方案',
    width: 1024,
    height: 1024,
    referenceImages: refs,
    timeoutMs: 5000,
  })
  assert.equal(qwenRequest.input.messages[0].content.length, 3)
  assert.equal(qwenRequest.input.messages[0].content[0].image.startsWith('data:image/png;base64,'), true)
  assert.equal(qwenRequest.input.messages[0].content[1].image.startsWith('data:image/png;base64,'), true)
  assert.equal(qwenRequest.input.messages[0].content[2].text, '参考两张图的构图和材质生成新方案')
  assert.equal(result.provider, 'qwen')
})

test('Seedream 适配器按官方方舟形态提交并解析 data[].url', async () => {
  const result = await imageProviders.generateImage({
    modelId: 'seedream-5.5',
    prompt: '一张测试图',
    ratio: '1:1',
    width: 1024,
    height: 1024,
    timeoutMs: 5000,
  })
  assert.equal(seedreamRequest.model, 'doubao-seedream-5-5-261028')
  assert.equal(seedreamRequest.size, '2048x2048')
  assert.equal(result.provider, 'seedream')
  assert.equal(result.modelId, 'seedream-5.5')
  assert.equal(result.width, 2048)
  assert.equal(result.height, 2048)
  assert.equal(result.requestId, 'seedream-request-1')
})

test('Qwen 编辑适配器把当前图片作为 Base64 输入提交并生成新图', async () => {
  const result = await imageProviders.editImage({
    modelId: 'qwen-image',
    prompt: '把天空改成黄昏，保留建筑和树木',
    imageBuffer: IMAGE_BYTES,
    imageMime: 'image/png',
    width: 1024,
    height: 1024,
    seed: 7,
    timeoutMs: 5000,
  })
  assert.equal(qwenRequest.input.messages[0].content[0].image.startsWith('data:image/png;base64,'), true)
  assert.equal(qwenRequest.input.messages[0].content[1].text, '把天空改成黄昏，保留建筑和树木')
  assert.equal(qwenRequest.parameters.seed, 7)
  assert.equal(qwenRequest.parameters.prompt_extend, false)
  assert.equal(result.provider, 'qwen')
  assert.equal(result.modelId, 'qwen-image')
  assert.ok(result.buffer.length >= 8 * 1024)
})

test('Seedream 编辑把当前图片作为 image 参数提交（单图生图），不回退到 Qwen', async () => {
  const qwenBefore = qwenRequest
  const result = await imageProviders.editImage({
    modelId: 'seedream-5.5',
    prompt: '把天空改成黄昏，保留建筑和树木',
    imageBuffer: IMAGE_BYTES,
    imageMime: 'image/png',
    ratio: '1:1',
    width: 2048,
    height: 2048,
    timeoutMs: 5000,
  })
  assert.equal(seedreamRequest.model, 'doubao-seedream-5-5-261028')
  assert.equal(seedreamRequest.prompt, '把天空改成黄昏，保留建筑和树木')
  assert.equal(seedreamRequest.image.startsWith('data:image/png;base64,'), true)
  assert.equal(seedreamRequest.size, '2048x2048')
  assert.equal(seedreamRequest.watermark, false)
  assert.equal(result.provider, 'seedream')
  assert.equal(result.modelId, 'seedream-5.5')
  assert.equal(qwenRequest, qwenBefore)
})

test('选区局部重绘：只把选区交给选中的预设模型，合成后选区外像素不变', async () => {
  const result = await imageProviders.editImageInRegion({
    modelId: 'seedream-5.5',
    prompt: '把选中的外墙改成暖灰色石材',
    imageBuffer: regionSourcePng,
    imageMime: 'image/png',
    maskBuffer: regionMaskPng,
    timeoutMs: 8000,
  })
  assert.equal(result.provider, 'seedream')
  assert.equal(result.modelId, 'seedream-5.5')
  assert.notEqual(result.modelId, 'wanx-edit')
  assert.equal(result.width, 1024)
  assert.equal(result.height, 1024)
  // 选区（含外扩留白）会先裁一块再交给模型
  assert.ok(result.region.width > 220 && result.region.width <= 1024)
  assert.ok(result.region.height > 180 && result.region.height <= 1024)
  assert.match(seedreamRequest.prompt, /只修改这块区域里需要改的内容/)
  assert.equal(seedreamRequest.image.startsWith('data:image/png;base64,'), true)
  assert.equal(seedreamRequest.watermark, false)
  // 选区内像素来自模型结果，选区外仍与原图逐像素一致
  const before = await pixelAt(regionSourcePng, 200, 600)
  const after = await pixelAt(result.buffer, 200, 600)
  assert.deepEqual(after, before)
  const insideBefore = await pixelAt(regionSourcePng, 400, 390)
  const insideAfter = await pixelAt(result.buffer, 400, 390)
  assert.notDeepEqual(insideAfter, insideBefore)
})

test('选区局部重绘：整图选中时退回整图编辑，不再裁剪', async () => {
  const fullMask = await sharp(Buffer.alloc(1024 * 1024, 255), { raw: { width: 1024, height: 1024, channels: 1 } }).png().toBuffer()
  const result = await imageProviders.editImageInRegion({
    modelId: 'seedream-5.5',
    prompt: '整体提高饱和度',
    imageBuffer: regionSourcePng,
    imageMime: 'image/png',
    maskBuffer: fullMask,
    timeoutMs: 8000,
  })
  assert.equal(result.wholeImage, true)
  assert.equal(result.region.width, 1024)
  assert.equal(seedreamRequest.prompt, '整体提高饱和度')
})

test('选区局部重绘：空选区被拒绝，不调用任何模型', async () => {
  const emptyMask = await sharp(Buffer.alloc(1024 * 1024, 0), { raw: { width: 1024, height: 1024, channels: 1 } }).png().toBuffer()
  await assert.rejects(
    () => imageProviders.editImageInRegion({
      modelId: 'seedream-5.5',
      prompt: '把选中的外墙改成暖灰色石材',
      imageBuffer: regionSourcePng,
      imageMime: 'image/png',
      maskBuffer: emptyMask,
      timeoutMs: 8000,
    }),
    (error) => error.code === 'IMAGE_REGION_MASK_EMPTY' && error.status === 400,
  )
})

test('未知图像模型被拒绝，不会回退到其他 Provider', async () => {
  await assert.rejects(
    () => imageProviders.generateImage({ modelId: 'not-a-model', prompt: '测试', timeoutMs: 5000 }),
    (error) => error.code === 'IMAGE_MODEL_UNKNOWN' && error.status === 400,
  )
})

test('视觉服务扩图：提交 i2i_outpainting 纯 base64，解析返回图', async () => {
  assert.equal(imageProviders.visualStatus().configured, true)
  const result = await imageProviders.expandImage({
    imageBuffer: IMAGE_BYTES,
    imageMime: 'image/png',
    prompt: '延续海边场景',
    expand: 0.2,
    timeoutMs: 5000,
  })
  const req = visualRequests.find((item) => item.action === 'CVProcess')
  assert.equal(req.body.req_key, 'i2i_outpainting')
  assert.equal(typeof req.body.binary_data_base64[0], 'string')
  assert.equal(req.body.binary_data_base64[0].startsWith('data:'), false)
  assert.equal(req.body.top, 0.2)
  assert.equal(req.body.bottom, 0.2)
  assert.equal(req.body.left, 0.2)
  assert.equal(req.body.right, 0.2)
  assert.equal(result.provider, 'volc-visual')
  assert.equal(result.modelId, 'i2i_outpainting')
  assert.ok(result.buffer.length >= 8 * 1024)
})

test('视觉服务超清：提交任务后轮询到 done，返回高清图', async () => {
  upscalePollCount = 0
  const result = await imageProviders.upscaleImage({
    imageBuffer: IMAGE_BYTES,
    imageMime: 'image/png',
    resolution: '4k',
    scale: 50,
    timeoutMs: 5000,
  })
  const submit = visualRequests.find((item) => item.action === 'CVSync2AsyncSubmitTask')
  assert.equal(submit.body.req_key, 'jimeng_i2i_seed3_tilesr_cvtob')
  assert.equal(submit.body.resolution, '4k')
  const polls = visualRequests.filter((item) => item.action === 'CVSync2AsyncGetResult')
  assert.equal(polls.length, 2)
  assert.equal(result.modelId, 'jimeng_i2i_seed3_tilesr_cvtob')
  assert.equal(result.requestId, 'task-1')
})

test('视觉服务未配置 AK/SK 时拒绝，不发起请求', async () => {
  const savedAk = process.env.VOLC_VISUAL_AK
  const savedSk = process.env.VOLC_VISUAL_SK
  delete process.env.VOLC_VISUAL_AK
  delete process.env.VOLC_VISUAL_SK
  await assert.rejects(
    () => imageProviders.expandImage({ imageBuffer: IMAGE_BYTES, imageMime: 'image/png', timeoutMs: 5000 }),
    (error) => error.code === 'IMAGE_VISUAL_NOT_CONFIGURED' && error.status === 503,
  )
  process.env.VOLC_VISUAL_AK = savedAk
  process.env.VOLC_VISUAL_SK = savedSk
  assert.equal(imageProviders.visualStatus().configured, true)
})
