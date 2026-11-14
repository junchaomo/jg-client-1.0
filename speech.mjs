/**
 * 本地离线语音识别：SenseVoiceSmall ONNX + CPU，音频不出本机。
 * 模型文件按官方固定 revision 下载并校验 SHA-256；识别在独立子进程内完成，
 * 避免同步推理阻塞 HTTP 服务。
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { fork } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const runtimeRoot = join(here, 'dsh-runtime')
const modelRoot = join(here, 'data', 'dsh-home', 'speech-to-text', 'sensevoice')
const assets = JSON.parse(readFileSync(join(runtimeRoot, 'node_modules', '@deepseek-ai', 'dsh-experimental-speech-to-text-sensevoice', 'runtime', 'assets.json'), 'utf8'))
const precision = process.env.JG_SPEECH_PRECISION === 'fp32' ? 'fp32' : 'int8'
const modelAsset = assets.models[precision]
const modelDir = join(modelRoot, 'models', 'sensevoice-onnx')
const vadDir = join(modelRoot, 'models', 'silero')
const modelPath = join(modelDir, modelAsset.name)
const tokensPath = join(modelDir, assets.tokens.name)
const vadPath = join(vadDir, assets.vad.name)
const origins = ['https://hf-mirror.com', 'https://huggingface.co']
const languages = new Set(['auto', 'zh', 'en', 'yue', 'ja', 'ko'])

let preparing = null
let progress = { state: 'idle', received: 0, total: 0, asset: '' }
let worker = null
let workerSeq = 0

export function modelStatus() {
  const files = [
    [modelPath, modelAsset.bytes],
    [tokensPath, assets.tokens.bytes],
    [vadPath, assets.vad.bytes],
  ]
  const missing = files.filter(([path, bytes]) => !existsSync(path) || statSync(path).size !== bytes)
  const ready = missing.length === 0 && !preparing
  return {
    ready,
    state: preparing ? 'preparing' : (ready ? 'ready' : 'missing'),
    model: `${modelAsset.name} (${precision.toUpperCase()})`,
    totalBytes: modelAsset.bytes + assets.tokens.bytes + assets.vad.bytes,
    progress: progress.received,
    progressTotal: progress.total,
    missing: missing.map(([path]) => path.split(/[\\/]/).slice(-1)[0]),
    languages: [...languages],
  }
}

async function downloadAsset(asset, target) {
  mkdirSync(dirname(target), { recursive: true })
  const part = `${target}.part`
  let lastError = null
  for (const origin of origins) {
    try {
      const url = asset.url.replace('https://huggingface.co', origin)
      progress = { state: 'preparing', received: 0, total: asset.bytes, asset: asset.name }
      const res = await fetch(url, { redirect: 'follow' })
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
      const handle = await import('node:fs/promises').then((m) => m.open(part, 'w'))
      const digest = createHash('sha256')
      let received = 0
      for await (const chunk of res.body) {
        await handle.write(chunk)
        digest.update(chunk)
        received += chunk.length
        progress = { state: 'preparing', received, total: asset.bytes, asset: asset.name }
      }
      await handle.close()
      if (received !== asset.bytes) throw new Error(`size ${received} != ${asset.bytes}`)
      if (digest.digest('hex') !== asset.sha256) throw new Error('sha256 mismatch')
      renameSync(part, target)
      return
    } catch (error) {
      lastError = error
      try { if (existsSync(part)) unlinkSync(part) } catch {}
    }
  }
  throw new Error(`模型 ${asset.name} 下载失败：${lastError?.message || 'unknown'}`)
}

export async function prepareSpeech() {
  if (preparing) return modelStatus()
  preparing = (async () => {
    if (!existsSync(modelPath) || statSync(modelPath).size !== modelAsset.bytes) await downloadAsset(modelAsset, modelPath)
    if (!existsSync(tokensPath) || statSync(tokensPath).size !== assets.tokens.bytes) await downloadAsset(assets.tokens, tokensPath)
    if (!existsSync(vadPath) || statSync(vadPath).size !== assets.vad.bytes) await downloadAsset(assets.vad, vadPath)
  })()
  try {
    await preparing
  } finally {
    preparing = null
    progress = { state: 'idle', received: 0, total: 0, asset: '' }
  }
  return modelStatus()
}

function getWorker() {
  if (worker && worker.connected) return worker
  const child = fork(join(here, 'speech-worker.mjs'), [], {
    env: {
      ...process.env,
      JG_SPEECH_MODEL: modelPath,
      JG_SPEECH_TOKENS: tokensPath,
      JG_SPEECH_RUNTIME: runtimeRoot,
    },
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  })
  child.on('exit', () => { if (worker === child) worker = null })
  worker = child
  return child
}

export async function transcribeSpeech(wav, language = 'zh') {
  if (!languages.has(language)) throw new Error('不支持的语音语言')
  if (!modelStatus().ready) {
    const error = new Error('本地语音模型尚未准备')
    error.code = 'SPEECH_NOT_READY'
    throw error
  }
  if (!wav || wav.length < 44 || wav.length > 24 * 1024 * 1024) throw new Error('音频为空或超过 24MB')
  const child = getWorker()
  const seq = ++workerSeq
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error('本地语音识别超时')) }, 120000)
    const onMessage = (message) => {
      if (!message || message.seq !== seq) return
      cleanup()
      if (!message.ok) return reject(new Error(message.error || '本地语音识别失败'))
      resolve({ text: String(message.text || '').trim(), language, model: `${modelAsset.name} (${precision.toUpperCase()})`, offline: true })
    }
    const onExit = () => { cleanup(); reject(new Error('本地语音进程意外退出')) }
    const cleanup = () => {
      clearTimeout(timer)
      child.off('message', onMessage)
      child.off('exit', onExit)
    }
    child.on('message', onMessage)
    child.on('exit', onExit)
    child.send({ seq, wavBase64: wav.toString('base64'), language })
  })
}

export function closeSpeechWorker() {
  if (worker) {
    try { worker.send({ seq: 0, type: 'close' }) } catch {}
    try { worker.kill() } catch {}
    worker = null
  }
}
