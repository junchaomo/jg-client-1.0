import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomBytes, scryptSync } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const tempDir = mkdtempSync(join(tmpdir(), 'jg-cloud-browser-api-'))
let child

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
  const match = String(question || '').replace(/\s+/g, ' ').match(/(-?\d+)\s*([+\-÷*×])\s*(-?\d+)/)
  if (!match) return null
  const [a, b] = [Number(match[1]), Number(match[3])]
  return match[2] === '+' ? a + b : match[2] === '-' ? a - b : ['*', '×'].includes(match[2]) ? a * b : Math.floor(a / b)
}
function cookieOf(response) {
  const values = response.headers.getSetCookie?.() || [response.headers.get('set-cookie')]
  return String(values[0] || '').split(';')[0]
}
function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`
}
async function seedUsers(dataDir) {
  process.env.JG_DATA_DIR = dataDir
  const db = await import(pathToFileURL(join(ROOT, 'db.mjs')).href)
  for (const user of [
    { id: 'A-TEST-ADMIN', username: 'cloudadmin', name: '云浏览器管理员', role: 'admin' },
    { id: 'A-TEST-USER', username: 'clouduser', name: '云浏览器用户', role: 'designer' },
  ]) {
    db.upsertAccount({ ...user, unit: '测试单位', duty: '测试岗位' })
    db.setAccountUsername(user.id, user.username)
    db.setAccountPassword(user.id, hashPassword('CloudPass123'), false)
  }
  db.saveState('runtime', { version: 1, cloudSystems: [
    { id: 'SYS-TEST', name: '测试系统', host: 'example.com', net: 'inet', level: 'public', scopes: ['public'], status: '正常', approval: 'none', desc: '接口测试系统' },
  ] })
  assert.equal(db.loadState('runtime').cloudSystems.length, 1)
  db.closeStore()
  writeFileSync(join(dataDir, 'cloud-systems.json'), JSON.stringify({ items: [
    { id: 'SYS-TEST', name: '测试系统', host: 'example.com', net: 'inet', scopes: ['public'] },
  ] }))
}
async function login(baseUrl, username) {
  const captcha = await (await fetch(`${baseUrl}/api/captcha`)).json()
  const response = await fetch(`${baseUrl}/api/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password: 'CloudPass123', captchaId: captcha.captchaId, captchaAnswer: String(solveCaptcha(captcha.question)) }),
  })
  assert.equal(response.status, 200, await response.text())
  return cookieOf(response)
}
async function request(baseUrl, path, cookie, method = 'GET', payload) {
  const response = await fetch(`${baseUrl}${path}`, {
    method, headers: { cookie, ...(payload ? { 'content-type': 'application/json' } : {}) }, body: payload ? JSON.stringify(payload) : undefined,
  })
  return { status: response.status, body: await response.json() }
}
after(() => {
  try { child?.kill('SIGKILL') } catch {}
  try { rmSync(tempDir, { recursive: true, force: true }) } catch {}
})

test('真实会话归属与关闭幂等、凭据不返回、扩展仅审核落注册表', async () => {
  const port = await freePort()
  const baseUrl = `http://127.0.0.1:${port}`
  const dataDir = join(tempDir, 'data')
  await seedUsers(dataDir)
  child = spawn(process.execPath, ['server.mjs'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), JG_CLOUD_PORT: '0', JG_DATA_DIR: dataDir, JG_AGENT_OFFLINE: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.on('data', (chunk) => { output += chunk })
  child.stderr.on('data', (chunk) => { output += chunk })
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`${baseUrl}/api/health`)).ok) break } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
    if (i === 119) assert.fail(`服务未启动：${output}`)
  }

  const admin = await login(baseUrl, 'cloudadmin')
  const other = await login(baseUrl, 'clouduser')
  const cloud = await request(baseUrl, '/api/cloud', admin)
  assert.equal(cloud.status, 200, JSON.stringify(cloud.body))
  assert.equal(cloud.body.instance.credentialInjection, false, JSON.stringify(cloud.body))
  assert.ok(Array.isArray(cloud.body.systems) && cloud.body.systems.length > 0, JSON.stringify(cloud.body))
  assert.equal(Object.hasOwn(cloud.body.systems[0], 'credential'), false)
  const system = cloud.body.systems.find((item) => item.state === 'usable')
  assert.ok(system, '至少一个可打开系统')

  const opened = await request(baseUrl, '/api/cloud/open', admin, 'POST', { systemId: system.id })
  assert.equal(opened.status, 200, JSON.stringify(opened.body))
  assert.equal(opened.body.session.state, 'active')
  assert.equal(opened.body.session.userId, 'A-TEST-ADMIN')
  assert.ok(opened.body.session.expiresAt)
  assert.equal(Object.hasOwn(opened.body, 'ticket'), false)
  const sessionId = opened.body.session.id

  const otherCloud = await request(baseUrl, '/api/cloud', other)
  assert.equal(otherCloud.body.sessions.some((item) => item.id === sessionId), false)
  const forbidden = await request(baseUrl, '/api/cloud/close', other, 'POST', { id: sessionId })
  assert.equal(forbidden.status, 403)
  const stillOpen = await request(baseUrl, '/api/cloud', admin)
  assert.equal(stillOpen.body.sessions.find((item) => item.id === sessionId)?.state, 'active')
  const closed = await request(baseUrl, '/api/cloud/close', admin, 'POST', { id: sessionId })
  assert.equal(closed.status, 200)
  assert.equal(closed.body.session.state, 'closed')
  const repeated = await request(baseUrl, '/api/cloud/close', admin, 'POST', { id: sessionId })
  assert.equal(repeated.status, 200)
  assert.equal(repeated.body.alreadyClosed, true)

  const submitted = await request(baseUrl, '/api/browser-exts/request', other, 'POST', { name: '测试扩展', version: '1.0.0', description: '审核边界测试', permissions: [], vendor: '测试' })
  assert.equal(submitted.status, 200, JSON.stringify(submitted.body))
  const extId = submitted.body.item.id
  let registry = JSON.parse(readFileSync(join(dataDir, 'browser-extension-review.json'), 'utf8'))
  assert.equal(registry.items.some((item) => item.id === extId), false)
  const denied = await request(baseUrl, '/api/admin/browser-exts/review', other, 'POST', { id: extId, action: 'approve' })
  assert.equal(denied.status, 403)
  const approved = await request(baseUrl, '/api/admin/browser-exts/review', admin, 'POST', { id: extId, action: 'approve', note: '测试审核' })
  assert.equal(approved.status, 200, JSON.stringify(approved.body))
  registry = JSON.parse(readFileSync(join(dataDir, 'browser-extension-review.json'), 'utf8'))
  assert.equal(registry.items.some((item) => item.id === extId), false, '没有受控安装目录的扩展也必须加载失败关闭')
})
