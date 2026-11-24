/**
 * 技能准入回归：只有带 .jg-market.json 的市场安装目录能进入平台列表与能力目录；
 * 手工复制到 dsh-home/skills 的目录即使有 SKILL.md 也不能出现。
 * 使用独立临时数据目录和独立端口，不触碰真实账号目录。
 */
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import net from 'node:net'

const repoRoot = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const dataDir = mkdtempSync(join(tmpdir(), 'jg-skill-access-'))
process.env.JG_DATA_DIR = dataDir

let child
let baseUrl
let sid
let stderr = ''

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port
      probe.close(() => resolve(port))
    })
  })
}

async function waitHealth(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/api/health`)
      if (res.ok) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`server did not become healthy: ${stderr.slice(-1200)}`)
}

function seedSkillDirs() {
  const skillsDir = join(dataDir, 'agents', 'A-7788-01', 'dsh-home', 'skills')
  mkdirSync(join(skillsDir, 'manual-lookalike'), { recursive: true })
  writeFileSync(join(skillsDir, 'manual-lookalike', 'SKILL.md'), '---\nname: manual-lookalike\ndescription: 手工目录技能\n---\n', 'utf8')
  mkdirSync(join(skillsDir, 'market-D-TEST'), { recursive: true })
  writeFileSync(join(skillsDir, 'market-D-TEST', 'SKILL.md'), '---\nname: market-skill\ndescription: 市场安装技能\n---\n', 'utf8')
  writeFileSync(join(skillsDir, 'market-D-TEST', '.jg-market.json'), JSON.stringify({
    marketId: 'D-TEST', name: '市场安装技能', version: '1.0.0', scope: 'user', installedAt: Date.now(),
  }), 'utf8')
  // 手工放进 data/apps 的应用包：current.json + app.json 完整，但市场台账里没有它。
  const appRoot = join(dataDir, 'apps', 'manual-app')
  mkdirSync(join(appRoot, 'versions', '0.1.0'), { recursive: true })
  writeFileSync(join(appRoot, 'current.json'), JSON.stringify({ version: '0.1.0' }), 'utf8')
  writeFileSync(join(appRoot, 'versions', '0.1.0', 'app.json'), JSON.stringify({
    id: 'manual-app', name: '手工应用', version: '0.1.0', runtime: 'node', entry: 'server.mjs',
  }), 'utf8')
}

before(async () => {
  seedSkillDirs()
  const port = await freePort()
  baseUrl = `http://127.0.0.1:${port}`
  child = spawn(process.execPath, ['server.mjs'], {
    cwd: repoRoot,
    env: { ...process.env, JG_DATA_DIR: dataDir, PORT: String(port), JG_SERVER_ORIGIN: 'manifest' },
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: true,
  })
  child.stderr.on('data', (chunk) => { stderr += String(chunk) })
  await waitHealth(baseUrl)
  const db = await import('../db.mjs')
  db.setAccountPassword('A-7788-01', '', false)
  sid = db.createSession('admin', 'inet', 10 * 60 * 1000, 'A-7788-01')
})

after(() => {
  try { child?.kill() } catch {}
  try { rmSync(dataDir, { recursive: true, force: true }) } catch {}
})

async function getJson(path, init = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { cookie: `jg_sid=${sid}; jg_net=inet`, 'content-type': 'application/json', ...(init.headers || {}) },
  })
  const body = await res.json().catch(() => ({}))
  assert.equal(res.status, 200, `${path} 应返回 200，实际 ${res.status}：${JSON.stringify(body)}`)
  return body
}

test('已安装列表只返回市场安装技能', async () => {
  const body = await getJson('/api/plugins')
  const dirs = body.items.filter((item) => item.source === 'dsh-skill').map((item) => item.dir)
  assert.deepEqual(dirs, ['market-D-TEST'])
  assert.equal(body.items.some((item) => item.name === 'manual-lookalike'), false)
})

test('设置页技能目录只返回市场安装技能', async () => {
  const body = await getJson('/api/bootstrap')
  assert.deepEqual(body.runtime.native.skills, ['market-D-TEST'])
})

test('能力目录只返回市场安装技能', async () => {
  const body = await getJson('/api/ai/invoke', {
    method: 'POST',
    body: JSON.stringify({ tool: 'capability_list', args: { type: 'skills' } }),
  })
  const names = body.result.skills.map((item) => item.name)
  assert.deepEqual(names, ['market-skill'])
  assert.equal(body.result.skills[0].source, 'market')
  assert.equal(body.result.skills[0].marketId, 'D-TEST')
})

test('手工放入 data/apps 的应用不进入应用能力目录', async () => {
  const body = await getJson('/api/ai/invoke', {
    method: 'POST',
    body: JSON.stringify({ tool: 'capability_list', args: { type: 'app' } }),
  })
  assert.deepEqual(body.result.apps, [])
})

test('插件能力目录不暴露仓库 plugins 下的手工运行时插件', async () => {
  const body = await getJson('/api/ai/invoke', {
    method: 'POST',
    body: JSON.stringify({ tool: 'capability_list', args: { type: 'plugin' } }),
  })
  assert.equal(body.result.plugins.some((item) => String(item.id).startsWith('runtime:')), false)
  assert.deepEqual(body.result.plugins.map((item) => item.id), ['M-CODEREVIEW'])
})
