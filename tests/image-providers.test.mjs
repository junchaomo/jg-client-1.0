import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'

const IMAGE_BYTES = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(10 * 1024, 0),
])

let baseUrl = ''
let server
let qwenRequest = null
let seedreamRequest = null
let wanxRequest = null
let wanxTaskRequest = null
let imageProviders

before(async () => {
  server = createServer((req, res) => {
    if (req.url === '/image.png') {
      res.writeHead(200, { 'content-type': 'image/png' })
      res.end(IMAGE_BYTES)
      return
    }
    if (req.url === '/tasks/task-1') {
      wanxTaskRequest = true
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({
        output: { task_id: 'task-1', task_status: 'SUCCEEDED', results: [{ url: `${baseUrl}/image.png` }] },
        request_id: 'wanx-request-1',
      }))
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
          data: [{ url: `${baseUrl}/image.png`, size: { width: 2048, height: 2048 } }],
          request_id: 'seedream-request-1',
        }))
        return
      }
      if (req.url === '/wanx-image-edit') {
        wanxRequest = parsed
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ output: { task_id: 'task-1', task_status: 'PENDING' }, request_id: 'wanx-create-1' }))
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
  process.env.WANX_IMAGE_EDIT_ENDPOINT = `${baseUrl}/wanx-image-edit`
  process.env.WANX_IMAGE_EDIT_TASK_ENDPOINT = `${baseUrl}/tasks`
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

test('Seedream 编辑未接入时明确拒绝，不会回退到 Qwen', async () => {
  await assert.rejects(
    () => imageProviders.editImage({
      modelId: 'seedream-5.5',
      prompt: '把天空改成黄昏',
      imageBuffer: IMAGE_BYTES,
      imageMime: 'image/png',
      timeoutMs: 5000,
    }),
    (error) => error.code === 'IMAGE_EDIT_UNSUPPORTED' && error.status === 400,
  )
})

test('万相局部重绘提交 base/mask Base64，轮询任务并下载结果', async () => {
  const result = await imageProviders.editImageWithMask({
    prompt: '把选中的外墙改成暖灰色石材',
    imageBuffer: IMAGE_BYTES,
    imageMime: 'image/png',
    maskDataUrl: `data:image/png;base64,${IMAGE_BYTES.toString('base64')}`,
    width: 2048,
    height: 2048,
    timeoutMs: 5000,
  })
  assert.equal(wanxRequest.model, 'wanx2.1-imageedit')
  assert.equal(wanxRequest.input.function, 'description_edit_with_mask')
  assert.equal(wanxRequest.input.base_image_url.startsWith('data:image/png;base64,'), true)
  assert.equal(wanxRequest.input.mask_image_url.startsWith('data:image/png;base64,'), true)
  assert.equal(wanxRequest.parameters.size, '2048*2048')
  assert.equal(wanxTaskRequest, true)
  assert.equal(result.provider, 'wanx')
  assert.equal(result.modelId, 'wanx-edit')
  assert.ok(result.buffer.length > 0)
})
test('未知图像模型被拒绝，不会回退到其他 Provider', async () => {
  await assert.rejects(
    () => imageProviders.generateImage({ modelId: 'not-a-model', prompt: '测试', timeoutMs: 5000 }),
    (error) => error.code === 'IMAGE_MODEL_UNKNOWN' && error.status === 400,
  )
})
