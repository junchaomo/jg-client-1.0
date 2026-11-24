import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { totp } from '../settings-center.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const nodeExe = process.env.JG_NODE_EXE || join(root, 'runtime', 'node.exe')

async function freePort() {
  const server = createServer()
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject))
  const port = server.address().port
  await new Promise((resolve) => server.close(resolve))
  return port
}

function captchaAnswer(question) {
  const match = String(question).match(/(\d+)\s*([+×÷-])\s*(\d+)/)
  assert.ok(match, question)
  const a = Number(match[1]); const b = Number(match[3])
  return String(match[2] === '+' ? a + b : match[2] === '-' ? a - b : match[2] === '×' ? a * b : a / b)
}

test('隔离服务实测设置中心 12 项真实入口', { timeout: 120000 }, async (t) => {
  const dataDir = mkdtempSync(join(tmpdir(), 'jg-settings-live-'))
  process.env.JG_DATA_DIR = dataDir
  const testDb = await import('../db.mjs')
  testDb.upsertAccount({ id: 'A-7788-03', name: '林昕岚', role: 'employee', unit: '智数中心', duty: '项目分析' })
  testDb.closeStore()
  const port = await freePort()
  const origin = `http://127.0.0.1:${port}`
  let logs = ''
  const child = spawn(nodeExe, [join(root, 'server.mjs')], {
    cwd: root,
    env: { ...process.env, PORT: String(port), JG_CLOUD_PORT: '0', JG_DATA_DIR: dataDir, JG_ONLYOFFICE_AUTOSTART: '0' },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.on('data', (chunk) => { logs = `${logs}${chunk}`.slice(-12000) })
  child.stderr.on('data', (chunk) => { logs = `${logs}${chunk}`.slice(-12000) })
  let cookie = ''
  const request = async (path, options = {}) => {
    const response = await fetch(`${origin}${path}`, {
      ...options,
      headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...(options.headers || {}) },
    })
    const setCookie = response.headers.get('set-cookie')
    if (setCookie) cookie = setCookie.split(';')[0]
    const body = await response.json().catch(() => ({}))
    return { status: response.status, ok: response.ok, body }
  }
  const post = (path, body = {}) => request(path, { method: 'POST', body: JSON.stringify(body) })
  try {
    let healthy = false
    for (let i = 0; i < 120; i += 1) {
      if (child.exitCode != null) break
      try {
        const response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(1000) })
        if (response.ok) { healthy = true; break }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    assert.ok(healthy, `服务未启动：${logs}`)

    const captcha = await request('/api/captcha')
    const login = await post('/api/login', {
      accountId: 'A-7788-01', password: 'Mile@123', captchaId: captcha.body.captchaId,
      captchaAnswer: captchaAnswer(captcha.body.question),
    })
    assert.equal(login.status, 200, JSON.stringify(login.body))
    const password = await post('/api/account/password', { currentPassword: 'Mile@123', nextPassword: 'Settings123' })
    assert.equal(password.status, 200, JSON.stringify(password.body))

    const boot = await request('/api/bootstrap')
    assert.equal(boot.status, 200)
    assert.equal(boot.body.settingsCenter.workspace.isDefault, true)
    assert.equal(boot.body.settingsCenter.mfa.enabled, false)

    const workspace = await post('/api/settings/workspace', { path: join(dataDir, 'new-workspace') })
    assert.equal(workspace.status, 200, JSON.stringify(workspace.body))
    assert.equal(workspace.body.workspace.isDefault, false)
    const reset = await post('/api/settings/workspace', { reset: true })
    assert.equal(reset.status, 200)
    assert.equal(reset.body.workspace.isDefault, true)

    const enrollment = await post('/api/settings/mfa/enroll')
    assert.equal(enrollment.status, 200)
    assert.ok(enrollment.body.otpauth.startsWith('otpauth://totp/'))
    const verified = await post('/api/settings/mfa/verify', { code: totp(enrollment.body.secret) })
    assert.equal(verified.status, 200, JSON.stringify(verified.body))
    assert.equal(verified.body.enrolled, true)
    const badCode = await post('/api/settings/mfa/verify', { code: '000000' })
    assert.equal(badCode.status, 401)

    const devices = await request('/api/settings/devices')
    assert.equal(devices.status, 200)
    assert.ok(devices.body.items.some((item) => item.current))
    assert.ok(!devices.body.items[0].id, '接口不能暴露其他会话的原始凭证')

    const requests = await request('/api/settings/access-requests')
    assert.equal(requests.status, 200)
    assert.ok(Array.isArray(requests.body.resources))
    assert.ok(Array.isArray(requests.body.items))

    const active = await request('/api/settings/conversations?archived=0')
    const archived = await request('/api/settings/conversations?archived=1')
    assert.equal(active.status, 200)
    assert.equal(archived.status, 200)
    const missingExport = await request('/api/settings/export?id=missing&format=json')
    assert.equal(missingExport.status, 404)

    const cache = await post('/api/settings/cache/clear')
    assert.equal(cache.status, 200)
    assert.ok(cache.body.clearedAt)

    const mcp = await post('/api/settings/mcp/test')
    assert.equal(mcp.status, 200, JSON.stringify(mcp.body))
    assert.equal(mcp.body.checks.length, 4)
    assert.ok(mcp.body.toolCount > 0)

    const update = await post('/api/settings/update/check')
    assert.equal(update.status, 200)
    assert.ok(['not_configured', 'current', 'available', 'error'].includes(update.body.status))
    assert.equal(update.body.currentVersion, '1.0.0')

    const help = await request('/api/settings/help')
    assert.equal(help.status, 200)
    assert.ok(help.body.sections.length >= 5)
    const document = await request('/api/settings/help/document?id=readme')
    assert.equal(document.status, 200)
    assert.ok(document.body.text.includes('九规智能中枢'))

    const diagnostics = await request('/api/settings/diagnostics')
    assert.equal(diagnostics.status, 200, JSON.stringify(diagnostics.body))
    assert.deepEqual(diagnostics.body.checks.map((item) => item.id), ['workspace', 'sqlite', 'model', 'mcp'])
    assert.equal(diagnostics.body.checks.find((item) => item.id === 'workspace').ok, true)
    assert.equal(diagnostics.body.checks.find((item) => item.id === 'sqlite').ok, true)
    assert.equal(diagnostics.body.checks.find((item) => item.id === 'mcp').ok, true)

    const persisted = await request('/api/settings/center')
    assert.equal(persisted.body.mfa.enabled, true)
    assert.ok(persisted.body.lastCacheClearAt)

    const registered = await post('/api/resources/register', {
      name: '设置中心审批链路测试数据', kind: 'pure', authorizationType: 'orgs', authorizedOrgs: ['unit:外部测试单位'],
      accessScope: 'dept', internalLevel: 'L2', secrecy: '非涉密', nets: ['inet'], description: '仅用于隔离环境权限测试',
    })
    assert.equal(registered.status, 200, JSON.stringify(registered.body))
    const resourceId = registered.body.item.id
    const adminCookie = cookie

    const employeeCaptcha = await request('/api/captcha')
    const employeeLogin = await post('/api/login', {
      accountId: 'A-7788-03', password: 'Linxinlan@123', captchaId: employeeCaptcha.body.captchaId,
      captchaAnswer: captchaAnswer(employeeCaptcha.body.question),
    })
    assert.equal(employeeLogin.status, 200, JSON.stringify(employeeLogin.body))
    const employeePassword = await post('/api/account/password', { currentPassword: 'Linxinlan@123', nextPassword: 'Settings123' })
    assert.equal(employeePassword.status, 200)
    const beforeGrant = await request('/api/resources')
    assert.ok(!beforeGrant.body.items.some((item) => item.id === resourceId), '员工审批前不能看到限定范围资源')
    const application = await post('/api/settings/access-requests', { resourceId, reason: '验证跨账号审批后的实际资源访问权限', durationDays: 30 })
    assert.equal(application.status, 201, JSON.stringify(application.body))
    const employeeCookie = cookie

    cookie = adminCookie
    const reviewQueue = await request('/api/settings/access-requests/admin')
    assert.equal(reviewQueue.status, 200)
    assert.ok(reviewQueue.body.items.some((item) => item.id === application.body.item.id))
    const approved = await post('/api/settings/access-requests/review', { id: application.body.item.id, decision: 'approved', reviewNote: '隔离测试审批通过' })
    assert.equal(approved.status, 200, JSON.stringify(approved.body))

    cookie = employeeCookie
    const afterGrant = await request('/api/resources')
    assert.ok(afterGrant.body.items.some((item) => item.id === resourceId), '批准后员工必须真实获得资源可见性')
    const employeeMessages = await request('/api/messages')
    assert.ok(employeeMessages.body.items.some((item) => item.title.includes('已授权') && item.body.includes('隔离测试审批通过')))

    cookie = adminCookie
    const revoked = await post('/api/settings/access-requests/review', { id: application.body.item.id, decision: 'revoked', reviewNote: '隔离测试撤销授权' })
    assert.equal(revoked.status, 200)
    cookie = employeeCookie
    const afterRevoke = await request('/api/resources')
    assert.ok(!afterRevoke.body.items.some((item) => item.id === resourceId), '撤销后资源权限必须立即失效')
    cookie = adminCookie
    t.diagnostic('工作区/重置、TOTP、设备、诊断、授权、导出、归档、缓存、MCP、更新、帮助接口均已实测')
  } finally {
    if (child.exitCode == null) {
      const exited = new Promise((resolve) => child.once('exit', resolve))
      child.kill()
      await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5000))])
    }
    rmSync(dataDir, { recursive: true, force: true })
  }
})
