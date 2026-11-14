/**
 * 本地 SenseVoice 推理子进程。模型只在本进程内加载，HTTP 服务不阻塞。
 */
import { createRequire } from 'node:module'
import { join } from 'node:path'

const sherpa = createRequire(join(process.env.JG_SPEECH_RUNTIME, 'package.json'))('sherpa-onnx-node')
const model = process.env.JG_SPEECH_MODEL
const tokens = process.env.JG_SPEECH_TOKENS
let recognizer = null
let currentLanguage = ''

function ensureRecognizer(language) {
  if (recognizer && currentLanguage === language) return recognizer
  recognizer = new sherpa.OfflineRecognizer({
    featConfig: { sampleRate: 16000, featureDim: 80 },
    modelConfig: {
      senseVoice: {
        model,
        language,
        useInverseTextNormalization: 1,
      },
      tokens,
      numThreads: 2,
      provider: 'cpu',
      debug: 0,
    },
  })
  currentLanguage = language
  return recognizer
}

function readWave(buffer) {
  if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('不是有效的 WAV 音频')
  }
  let offset = 12
  let dataOffset = -1
  let dataLength = 0
  let sampleRate = 0
  let channels = 0
  let bits = 0
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4)
    const size = buffer.readUInt32LE(offset + 4)
    if (id === 'fmt ') {
      channels = buffer.readUInt16LE(offset + 10)
      sampleRate = buffer.readUInt32LE(offset + 12)
      bits = buffer.readUInt16LE(offset + 22)
    }
    if (id === 'data') { dataOffset = offset + 8; dataLength = size; break }
    offset += 8 + size
  }
  if (dataOffset < 0 || sampleRate !== 16000 || channels !== 1 || bits !== 16) {
    throw new Error('音频需为 16kHz 单声道 PCM16 WAV')
  }
  const length = Math.min(dataLength, buffer.length - dataOffset) / 2
  const samples = new Float32Array(length)
  for (let i = 0; i < length; i += 1) samples[i] = buffer.readInt16LE(dataOffset + i * 2) / 32768
  return samples
}

process.on('message', (message) => {
  if (!message || message.type === 'close') process.exit(0)
  try {
    const samples = readWave(Buffer.from(message.wavBase64 || '', 'base64'))
    const rec = ensureRecognizer(message.language || 'zh')
    const stream = rec.createStream()
    stream.acceptWaveform({ sampleRate: 16000, samples })
    rec.decode(stream)
    const text = rec.getResult(stream).text.trim()
    process.send({ seq: message.seq, ok: true, text })
  } catch (error) {
    process.send({ seq: message.seq, ok: false, error: error?.message || '本地语音识别失败' })
  }
})
