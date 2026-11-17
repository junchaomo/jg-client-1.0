import { after, test } from 'node:test'
import { spawn } from 'node:child_process'
import { randomBytes, scryptSync } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const PRESET_IDS = [
  'sys-chat-deepseek-flash',
  'sys-chat-qwen4-max',
  'sys-chat-kimi-k3.1-pro',
  'sys-chat-glm-5.3-flash',
  'sys-image-seedream-5-5',
  'sys-image-qwen-image-3-0-pro',
]

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      server.close(() => resolve(port))
    })
  })
}

function solveCaptcha(question) {
  const text = String(question || '').replace(/\s+/g, ' ')
  const match = text.match(/(-?\d+)\s*([+\-÷*×])\s*(-?\d+)/)
  if (!match) return null
  const a = Number(match[1])
  const b = Number(match[3])
  if (match[2] === '+') return a + b
  if (match[2] === '-') return a - b
  if (match[2] === '*' || match[2] === '×') return a * b
  if (match[2] === '÷') return b === 0 ? null : Math.floor(a / b)
  return null
}

function cookieOf(response) {
  const values = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean)
  return String(values[0] || '').split(';')[0]
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  return `scrypt$${salt}$${scryptSync(String(password), salt, 64).toString('hex')}`
}

async function seedIsolationUser(dataDir) {
  process.env.JG_DATA_DIR = dataDir
  const db = await import(pathToFileURL(join(ROOT, 'db.mjs')).href)
  db.upsertAccount({ id: 'A-TEST-02', name: '隔离测试用户', role: 'designer', unit: '测试单位', duty: '测试岗位' })
  db.setAccountUsername('A-TEST-02', 'gateuser')
  db.setAccountPassword('A-TEST-02', hashPassword('GatePass123'), false)
  db.closeStore()
}

async function login(baseUrl, username, password) {
  const captcha = await (await fetch(`${baseUrl}/api/captcha`)).json()
  const answer = solveCaptcha(captcha.question)
  if (answer == null) throw new Error(`无法解析验证码：${captcha.question}`)
  const response = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password, captchaId: captcha.captchaId, captchaAnswer: String(answer) }),
  })
  if (response.status !== 200) throw new Error(`登录 ${username} 失败：${response.status} ${await response.text()}`)
  return { cookie: cookieOf(response), body: await response.json() }
}

async function signIn(baseUrl, username, password) {
  let result = await login(baseUrl, username, password)
  if (result.body?.mustChangePassword) {
    const nextPassword = `Gate2026${username}`
    const changed = await postJson(baseUrl, '/api/account/password', result.cookie, { currentPassword: password, nextPassword })
    if (changed.status !== 200) throw new Error(`修改初始密码失败：${changed.status} ${JSON.stringify(changed.body)}`)
    result = await login(baseUrl, username, nextPassword)
  }
  return result
}

async function getJson(baseUrl, path, cookie) {
  const response = await fetch(`${baseUrl}${path}`, { headers: { cookie } })
  return { status: response.status, body: await response.json() }
}

async function postJson(baseUrl, path, cookie, payload) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return { status: response.status, body: await response.json() }
}

const tempDir = mkdtempSync(join(tmpdir(), 'jg-model-gateway-'))
let child = null
let baseUrl = ''
let admin = null
let customId = ''

after(async () => {
  try { child?.kill('SIGKILL') } catch { /* 已退出 */ }
  try { rmSync(tempDir, { recursive: true, force: true }) } catch { /* 文件被占用时保留 */ }
})

test('模型网关：预设公共目录、个人模型隔离、删除清理', async () => {
  const port = await freePort()
  baseUrl = `http://127.0.0.1:${port}`
  const dataDir = join(tempDir, 'data')
  await seedIsolationUser(dataDir)
  child = spawn(process.execPath, ['server.mjs'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      JG_DATA_DIR: dataDir,
      JG_DSH_HOME: join(dataDir, 'dsh-home'),
      JG_TOOL_ROUTER_LOG: join(tempDir, 'router.log'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stderr = ''
  child.stderr.on('data', (chunk) => { stderr += String(chunk) })
  const deadline = Date.now() + 60_000
  let ready = false
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`)
      if (response.ok) { ready = true; break }
    } catch { /* 启动中 */ }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  if (!ready) throw new Error(`服务未启动：${stderr.slice(-800)}`)

  admin = await signIn(baseUrl, 'mile', 'Mile@123')
  const catalog = await getJson(baseUrl, '/api/models', admin.cookie)
  if (catalog.status !== 200) throw new Error(`模型目录失败：${catalog.status} ${JSON.stringify(catalog.body)}`)

  const presets = catalog.body.presets || []
  const ids = presets.map((item) => item.id).sort()
  if (JSON.stringify(ids) !== JSON.stringify([...PRESET_IDS].sort())) {
    throw new Error(`系统预设不完整：${JSON.stringify(ids)}`)
  }
  if (presets.some((item) => item.owner !== 'hub' || item.preset !== true || item.scope !== 'preset')) {
    throw new Error('系统预设缺少 hub / preset / scope 标记')
  }
  if ((catalog.body.chat || []).length !== 4) throw new Error('问答预设数量不是 4')
  if ((catalog.body.image || []).length !== 2) throw new Error('图像预设数量不是 2')

  const created = await postJson(baseUrl, '/api/admin/shared-models', admin.cookie, {
    label: '回归测试个人模型',
    purpose: 'chat',
    provider: 'OpenAI 兼容',
    endpoint: 'https://example.invalid/v1',
    model: 'regression-model',
    apiKey: 'sk-regression-1234',
  })
  if (created.status !== 200 || created.body.item?.scope !== 'custom') throw new Error(`创建个人模型失败：${created.status}`)
  customId = created.body.item.id
  if (created.body.item.owner !== 'A-7788-01' || created.body.item.preset !== false) throw new Error('个人模型归属或 preset 标记错误')
  if (String(created.body.item.apiKeyMask || '') && created.body.item.apiKey === 'sk-regression-1234') throw new Error('个人模型泄露明文 Key')

  const withCustom = await getJson(baseUrl, '/api/models', admin.cookie)
  if ((withCustom.body.custom || []).length !== 1) throw new Error('本人看不到自己的自定义模型')
  if ((withCustom.body.chat || []).find((item) => item.id === customId)?.own !== true) throw new Error('自定义模型未标记 own')

  const other = await login(baseUrl, 'gateuser', 'GatePass123')
  const otherView = await getJson(baseUrl, '/api/models', other.cookie)
  if ((otherView.body.presets || []).length !== 6) throw new Error('其他用户看不到 6 个系统预设')
  if ((otherView.body.custom || []).some((item) => item.id === customId)) throw new Error('其他用户看到了他人的个人模型')

  const removed = await postJson(baseUrl, '/api/admin/shared-models/delete', admin.cookie, { id: customId })
  if (removed.status !== 200) throw new Error(`删除个人模型失败：${removed.status}`)
  const afterDelete = await getJson(baseUrl, '/api/models', admin.cookie)
  if ((afterDelete.body.custom || []).some((item) => item.id === customId)) throw new Error('删除后个人模型仍在目录中')
  customId = ''
})

test('模型网关：对话只能选择预设或本人模型，未配置预设直接拒绝', async () => {
  if (!admin) throw new Error('前置测试未完成，无法验证对话模型选择')
  const mine = await postJson(baseUrl, '/api/admin/shared-models', admin.cookie, {
    label: '对话选择测试模型',
    purpose: 'chat',
    provider: 'OpenAI 兼容',
    endpoint: 'https://example.invalid/v1',
    model: 'chat-select-model',
    apiKey: 'sk-chatselect-1234',
  })
  if (mine.status !== 200) throw new Error(`创建对话测试模型失败：${mine.status}`)
  customId = mine.body.item.id

  const chatBody = JSON.stringify({ text: '你好', modelRef: customId })
  const other = await login(baseUrl, 'gateuser', 'GatePass123')
  const otherTry = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { cookie: other.cookie, 'content-type': 'application/json' },
    body: chatBody,
  })
  const otherResult = await otherTry.json()
  if (otherTry.status !== 403 || otherResult.code !== 'MODEL_REF_UNAVAILABLE') {
    throw new Error(`他人模型引用未被拒绝：${otherTry.status} ${JSON.stringify(otherResult)}`)
  }

  const unconfigured = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { cookie: admin.cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ text: '你好', modelRef: 'sys-chat-qwen4-max' }),
  })
  const unconfiguredResult = await unconfigured.json()
  if (unconfigured.status !== 403 || unconfiguredResult.code !== 'MODEL_REF_UNAVAILABLE') {
    throw new Error(`未配置预设未被拒绝：${unconfigured.status} ${JSON.stringify(unconfiguredResult)}`)
  }

  const removed = await postJson(baseUrl, '/api/admin/shared-models/delete', admin.cookie, { id: customId })
  if (removed.status !== 200) throw new Error(`清理对话测试模型失败：${removed.status}`)
  customId = ''
})

test('模型网关：应用只保存模型引用，不能选择他人的个人模型', async () => {
  if (!admin) throw new Error('前置测试未完成，无法验证应用模型引用')
  const mine = await postJson(baseUrl, '/api/admin/shared-models', admin.cookie, {
    label: '应用引用测试模型',
    purpose: 'app',
    provider: 'OpenAI 兼容',
    endpoint: 'https://example.invalid/v1',
    model: 'app-model',
    apiKey: 'sk-appmodel-1234',
  })
  if (mine.status !== 200) throw new Error(`创建应用模型失败：${mine.status}`)
  customId = mine.body.item.id

  const register = await postJson(baseUrl, '/api/apps/register', admin.cookie, {
    name: '模型引用回归应用',
    desc: '仅用于模型网关回归测试',
    version: '0.0.1',
  })
  if (register.status !== 200) throw new Error(`登记测试应用失败：${register.status} ${JSON.stringify(register.body)}`)

  const setByOwner = await postJson(baseUrl, '/api/apps/model', admin.cookie, { id: register.body.item.id, modelRef: customId })
  if (setByOwner.status !== 200) throw new Error(`本人应用引用本人模型失败：${setByOwner.status} ${JSON.stringify(setByOwner.body)}`)
  if (setByOwner.body.modelRef !== customId) throw new Error('应用未保存模型引用')
  const appRecord = await getJson(baseUrl, `/api/app?id=${encodeURIComponent(register.body.item.id)}`, admin.cookie)
  if (!appRecord.body.item) throw new Error(`读取应用记录失败：${appRecord.status} ${JSON.stringify(appRecord.body)}`)
  if (appRecord.body.item.modelProvider || appRecord.body.item.modelEndpoint || appRecord.body.item.modelApiKey) {
    throw new Error('应用仍保存了 provider / 端点 / 密钥')
  }

  const other = await login(baseUrl, 'gateuser', 'GatePass123')
  const setByOther = await postJson(baseUrl, '/api/apps/model', other.cookie, { id: register.body.item.id, modelRef: customId })
  if (setByOther.status !== 403) throw new Error(`非维护人设置应用模型未被拒绝：${setByOther.status}`)
  if (setByOther.body.code !== 'FORBIDDEN') throw new Error(`拒绝码不符：${JSON.stringify(setByOther.body)}`)

  const invalidRef = await postJson(baseUrl, '/api/apps/model', admin.cookie, { id: register.body.item.id, modelRef: 'M-not-exist' })
  if (invalidRef.status !== 404 || invalidRef.body.code !== 'MODEL_REF_INVALID') {
    throw new Error(`无效模型引用未被拒绝：${invalidRef.status} ${JSON.stringify(invalidRef.body)}`)
  }

  const removed = await postJson(baseUrl, '/api/admin/shared-models/delete', admin.cookie, { id: customId })
  if (removed.status !== 200) throw new Error(`清理应用测试模型失败：${removed.status}`)
  customId = ''
})

