/**
 * AS Runtime：应用包的本机进程宿主。
 *
 * 设计边界：
 * - 一个 appId 在整台机器上只有一个进程；账号只隔离数据目录，不复制进程。
 * - 进程由服务端持有，Electron 只负责显示；服务端退出时统一回收进程树。
 * - 租约 / 心跳只决定“还能不能用”，不决定“谁拥有进程”；最后一个租约释放后进入宽限期。
 */
import { spawn, spawnSync } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { request } from 'node:http'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { dirname, join, resolve, sep } from 'node:path'
import { dataDirPath } from './db.mjs'
import { normalizeAppCapabilities } from './app-contract.mjs'

export const AS_APPS_ROOT = join(dataDirPath(), 'apps')
const LEASE_TTL_MS = Math.max(10000, Number(process.env.AS_LEASE_TTL_MS || 45000))
const STOP_GRACE_MS = Math.max(5000, Number(process.env.AS_STOP_GRACE_MS || 30000))
const START_TIMEOUT_MS = Math.max(5000, Number(process.env.AS_START_TIMEOUT_MS || 30000))
/* 启动超时上限：应用可以在 app.json 里申报更长的健康检查时间，但不能无限期停在 starting。
   申报值与上限之间取小，得到的那个数字会写进 runtime.json 的 startTimeoutMs，
   startApp 的等待与 sweepApps 的超时判定都读这一个值——两处口径永远一致。 */
const START_TIMEOUT_MAX_MS = Math.max(START_TIMEOUT_MS, Number(process.env.AS_START_TIMEOUT_MAX_MS || 120000))
const CONTEXT_TTL_MS = Math.max(60000, Number(process.env.AS_CONTEXT_TTL_MS || 60 * 60 * 1000))
const TOOL_CONTEXT_TTL_MS = Math.min(CONTEXT_TTL_MS, 5 * 60 * 1000)
/* 同一台机器上可能残留上一轮客户端的 server.mjs（父进程已退出但进程未回收）。
   它和当前服务共享 data/apps；若两边都跑 sweep，旧进程会把当前服务托管的
   应用当成“无租约”并按时回收。给每个服务实例一个 owner，sweep/boot 只管理
   自己或 owner 已死的应用。 */
const RUNTIME_OWNER = `ASO-${randomBytes(8).toString('hex')}`
const RUNTIME_OWNER_PID = Number(process.pid)
const LEASES = new Map()
const LOCKS = new Map()
const APP_SECRETS = new Map()

function safeId(value) {
  const id = String(value || '').trim()
  if (!id || id.length > 80 || id.includes('..') || id.includes('/') || id.includes('\\') || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) {
    throw new Error(`非法的应用 ID：${id || '空'}`)
  }
  return id
}

function safeVersion(value) {
  const version = String(value || '').trim()
  if (!version || version.length > 80 || version.includes('..') || version.includes('/') || version.includes('\\')) {
    throw new Error(`非法的应用版本：${version || '空'}`)
  }
  return version
}

function safeUser(value) {
  const user = String(value || 'guest').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80)
  return user && user !== '.' && user !== '..' ? user : 'guest'
}

export function appRoot(id) {
  return join(AS_APPS_ROOT, safeId(id))
}

export function appVersionDir(id, version) {
  return join(appRoot(id), 'versions', safeVersion(version))
}

function currentPath(id) {
  return join(appRoot(id), 'current.json')
}

function runtimePath(id) {
  return join(appRoot(id), 'runtime.json')
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export function currentAppInfo(id) {
  const root = appRoot(id)
  const current = readJson(currentPath(id))
  const version = String(current?.version || '').trim()
  if (!version) return null
  const versionRoot = appVersionDir(id, version)
  const manifestPath = join(versionRoot, 'app.json')
  if (!existsSync(manifestPath)) return null
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    if (String(manifest.id || '') !== id) return null
    return { version, versionRoot, manifest }
  } catch {
    return null
  }
}

export function setCurrentAppVersion(id, version) {
  const versionRoot = appVersionDir(id, version)
  if (!existsSync(join(versionRoot, 'app.json'))) throw new Error('应用版本目录缺少 app.json')
  const manifest = JSON.parse(readFileSync(join(versionRoot, 'app.json'), 'utf8'))
  if (String(manifest.id || '') !== id) throw new Error('app.json 的 id 与应用目录不一致')
  writeJson(currentPath(id), { version, at: new Date().toISOString() })
  return versionRoot
}

export function appAvailable(id) {
  return Boolean(currentAppInfo(id))
}

export function appManifest(id) {
  return currentAppInfo(id)?.manifest || null
}

export function appCapabilities(id) {
  const info = currentAppInfo(id)
  if (!info) return null
  const capabilities = normalizeAppCapabilities(info.manifest)
  return {
    appId: safeId(id),
    appName: String(info.manifest.name || id),
    version: info.version,
    ...capabilities,
  }
}

function manifestPaths(info) {
  const { versionRoot, manifest } = info
  const appDirRel = String(manifest.appDir || '.').replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '')
  const entryRel = String(manifest.entry || '').replace(/\\/g, '/').replace(/^\.\//, '')
  const appDir = resolve(versionRoot, appDirRel || '.')
  const entry = resolve(appDir, entryRel)
  const rootPrefix = versionRoot.endsWith(sep) ? versionRoot : `${versionRoot}${sep}`
  if (!appDir.startsWith(rootPrefix) && appDir !== versionRoot) throw new Error('app.json 的 appDir 超出应用目录')
  if (!entry.startsWith(`${appDir}${sep}`) && entry !== appDir) throw new Error('app.json 的 entry 超出 appDir')
  if (!existsSync(entry)) throw new Error(`应用入口不存在：${entry}`)
  return { appDir, entry }
}

function dataRootFor(id) {
  const root = join(appRoot(id), 'users')
  mkdirSync(root, { recursive: true })
  return root
}

function dataDirFor(id, userId) {
  const dir = join(dataRootFor(id), safeUser(userId))
  mkdirSync(dir, { recursive: true })
  return dir
}

function userUrl(base, userId, token = '') {
  try {
    const url = new URL(base)
    url.searchParams.set('asUser', safeUser(userId))
    if (token) url.searchParams.set('asContext', token)
    return url.toString()
  } catch {
    return base
  }
}

function signContext(appId, userId, secret, ttlMs = CONTEXT_TTL_MS) {
  const payload = {
    appId,
    userId: safeUser(userId),
    exp: Date.now() + Math.max(60000, Number(ttlMs || CONTEXT_TTL_MS)),
    nonce: randomBytes(8).toString('hex'),
  }
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const signature = createHmac('sha256', secret).update(encoded).digest('hex')
  return `${encoded}.${signature}`
}

function verifyContextToken(token, appId, secret) {
  const raw = String(token || '')
  const [encoded, signature] = raw.split('.')
  if (!encoded || !signature || !secret) return null
  const expected = createHmac('sha256', secret).update(encoded).digest('hex')
  const left = Buffer.from(signature, 'hex')
  const right = Buffer.from(expected, 'hex')
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
    if (payload.appId !== appId || !payload.userId || Number(payload.exp || 0) < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

/** 服务端校验应用上下文令牌；应用拿用户上下文换短期数据令牌时使用。 */
export function verifyAppContext(token, appId) {
  const id = safeId(appId)
  const secret = APP_SECRETS.get(id)
  return secret ? verifyContextToken(String(token || ''), id, secret) : null
}

function leaseSet(id) {
  if (!LEASES.has(id)) LEASES.set(id, new Map())
  return LEASES.get(id)
}

function leaseCount(id) {
  return leaseSet(id).size
}

function pruneLeases(id, now = Date.now()) {
  const set = leaseSet(id)
  for (const [leaseId, lease] of set) {
    if (now - Number(lease.lastSeen || 0) > LEASE_TTL_MS) set.delete(leaseId)
  }
  return set
}

function readRuntime(id) {
  return readJson(runtimePath(id))
}

function writeRuntime(id, state) {
  const current = readRuntime(id) || {}
  const next = { ...current, ...state, appId: id, updatedAt: new Date().toISOString() }
  writeJson(runtimePath(id), next)
  return next
}

function pidAlive(pid) {
  const value = Number(pid || 0)
  if (!value) return false
  try {
    process.kill(value, 0)
    return true
  } catch (error) {
    return error?.code === 'EPERM'
  }
}

function killTree(pid) {
  const value = Number(pid || 0)
  if (!value) return false
  if (process.platform === 'win32') {
    const result = spawnSync('taskkill', ['/PID', String(value), '/T', '/F'], { windowsHide: true, encoding: 'utf8' })
    return result.status === 0 || !pidAlive(value)
  }
  try {
    process.kill(-value, 'SIGTERM')
    return true
  } catch {
    try {
      process.kill(value, 'SIGTERM')
      return true
    } catch {
      return false
    }
  }
}

function getFreePort(host) {
  return new Promise((resolvePort, reject) => {
    const server = createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, host, () => {
      const port = server.address().port
      server.close(() => resolvePort(port))
    })
  })
}

function probeHealth(url, healthPath, timeoutMs = 1500) {
  return new Promise((resolveProbe) => {
    let settled = false
    const done = (value) => {
      if (settled) return
      settled = true
      resolveProbe(value)
    }
    let target
    try {
      target = new URL(String(healthPath || '/'), url)
    } catch {
      return done(false)
    }
    const req = request(target, { method: 'GET', timeout: timeoutMs }, (res) => {
      res.resume()
      res.on('end', () => done(Number(res.statusCode) >= 200 && Number(res.statusCode) < 400))
    })
    req.on('timeout', () => {
      req.destroy()
      done(false)
    })
    req.on('error', () => done(false))
    req.end()
  })
}

/** 把 app.json 申报的健康检查超时收敛成本次启动的唯一截止时间（下限 5s，上限 START_TIMEOUT_MAX_MS）。 */
function resolveStartTimeout(health = {}) {
  const declared = Number(health?.timeoutMs) || START_TIMEOUT_MS
  return Math.min(Math.max(declared, 5000), START_TIMEOUT_MAX_MS)
}

async function waitHealth(url, health = {}, startTimeoutMs = null) {
  const timeoutMs = Math.max(1000, Number(startTimeoutMs || resolveStartTimeout(health) || START_TIMEOUT_MS))
  const intervalMs = Math.max(100, Number(health.intervalMs || 300))
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (await probeHealth(url, health.path || '/')) return true
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return false
}

function spawnCommand(info, appDir, entry, dataRoot, host, port, url) {
  const manifest = info.manifest
  const runtime = String(manifest.runtime || '').toLowerCase()
  const env = {
    ...process.env,
    AS_APP_ID: String(manifest.id || ''),
    AS_APP_ROOT: info.versionRoot,
    AS_DATA_ROOT: dataRoot,
    AS_DATA_DIR: dataRoot,
    AS_HOST: host,
    AS_PORT: String(port),
    AS_BASE_URL: url,
    AS_HUB_URL: process.env.JG_HUB_URL || `http://127.0.0.1:${process.env.PORT || 4173}`,
    HOST: host,
    PORT: String(port),
  }
  // 应用子进程不得继承中枢自己的鉴权与模型密钥。应用只能拿用户上下文令牌
  // 去 /api/app-data/token 换取短期数据令牌，不能直接持有主进程凭据。
  for (const key of ['AS_CONTEXT_SECRET', 'JG_MCP_TOKEN', 'JG_MCP_ACCOUNT', 'JG_DOWNLOAD_SECRET', 'DEEPSEEK_API_KEY', 'OPENAI_API_KEY', 'QWEN_IMAGE_API_KEY', 'SEEDREAM_IMAGE_API_KEY']) {
    delete env[key]
  }
  // 应用在 app.json 的 env 中声明的额外环境变量（如外置模型目录 TC_WEIGHTS_DIR）。
  const extraEnv = manifest.env && typeof manifest.env === 'object' ? manifest.env : null
  if (extraEnv) {
    for (const [envKey, envValue] of Object.entries(extraEnv)) env[envKey] = String(envValue)
  }
  let command
  let args
  if (runtime === 'node') {
    command = String(manifest.node?.executable || process.env.AS_NODE_EXE || process.execPath)
    args = [entry]
  } else if (runtime === 'python') {
    command = String(manifest.python?.executable || process.env.AS_PYTHON_EXE || 'python')
    args = ['-u', entry]
  } else {
    throw new Error(`不支持的 runtime：${runtime || '空'}`)
  }
  const logPath = join(appRoot(manifest.id), 'runtime.log')
  mkdirSync(dirname(logPath), { recursive: true })
  const fd = openSync(logPath, 'a')
  let child
  try {
    child = spawn(command, args, {
      cwd: appDir,
      env,
      windowsHide: true,
      stdio: ['ignore', fd, fd],
      detached: process.platform !== 'win32',
    })
  } finally {
    closeSync(fd)
  }
  child.on('exit', (code, signal) => {
    const state = readRuntime(manifest.id)
    if (!state || Number(state.pid) !== Number(child.pid) || state.status === 'stopping') return
    APP_SECRETS.delete(manifest.id)
    writeRuntime(manifest.id, {
      status: 'stopped',
      pid: 0,
      stopAt: 0,
      lastError: code ? `进程退出：${code}` : signal ? `进程退出：${signal}` : '',
    })
  })
  child.on('error', (error) => {
    writeRuntime(manifest.id, { status: 'error', lastError: String(error?.message || error), pid: 0 })
  })
  return child
}

function withLock(id, task) {
  const prev = LOCKS.get(id) || Promise.resolve()
  const next = prev.catch(() => {}).then(task)
  LOCKS.set(id, next)
  return next.finally(() => {
    if (LOCKS.get(id) === next) LOCKS.delete(id)
  })
}

function addLease(id, userId) {
  const leaseId = `ASL-${randomBytes(8).toString('hex')}`
  leaseSet(id).set(leaseId, { leaseId, userId: safeUser(userId), lastSeen: Date.now() })
  return leaseId
}

export function runtimeState(id) {
  const state = readRuntime(id) || {}
  const pid = Number(state.pid || 0)
  const alive = pidAlive(pid)
  const status = state.status === 'running' && !alive ? 'stopped' : (state.status || 'stopped')
  return {
    appId: id,
    status,
    running: status === 'running',
    port: Number(state.port || 0),
    url: String(state.url || ''),
    pid: alive ? pid : 0,
    leaseCount: leaseCount(id),
    health: status === 'running' ? 'running' : (state.lastError ? 'error' : 'stopped'),
    lastError: String(state.lastError || ''),
    startedAt: state.startedAt || '',
    stopAt: Number(state.stopAt || 0),
    version: String(state.version || ''),
    dataRoot: String(state.dataRoot || ''),
    activeUser: String(state.activeUser || ''),
  }
}

export async function startApp({ id, userId }) {
  const appId = safeId(id)
  const info = currentAppInfo(appId)
  if (!info) throw new Error('应用未安装或缺少 app.json')
  return withLock(appId, async () => {
    const manifest = info.manifest
    const existing = readRuntime(appId)
    if (existing?.status === 'running' && pidAlive(existing.pid)) {
      const existingSecret = APP_SECRETS.get(appId)
      if (existingSecret) {
        const dataRoot = existing.dataRoot || dataRootFor(appId)
        const dataDir = dataDirFor(appId, userId)
        const leaseId = addLease(appId, userId)
        writeRuntime(appId, {
          leaseCount: leaseCount(appId),
          lastHeartbeat: Date.now(),
          status: 'running',
          stopAt: 0,
          owner: RUNTIME_OWNER,
          ownerPid: RUNTIME_OWNER_PID,
          dataRoot,
          activeUser: safeUser(userId),
          dataDir,
        })
        const contextToken = signContext(appId, userId, existingSecret, CONTEXT_TTL_MS)
        return { leaseId, url: userUrl(existing.url, userId, contextToken), port: existing.port, pid: existing.pid, status: 'running', dataRoot, dataDir, contextToken }
      }
      // 进程还活着但服务端没有对应 secret（例如异常重启），必须重启才能签发可信上下文。
      killTree(existing.pid)
    }
    if (existing?.pid && pidAlive(existing.pid)) killTree(existing.pid)
    const contextSecret = randomBytes(32).toString('hex')
    APP_SECRETS.set(appId, contextSecret)
    const paths = manifestPaths(info)
    const host = String(manifest.host || '127.0.0.1')
    const port = await getFreePort(host)
    const url = `http://${host}:${port}/`
    const dataRoot = dataRootFor(appId)
    const dataDir = dataDirFor(appId, userId)
    /* 本次启动的截止时间在这里定死一次：写进 runtime.json 给 sweep 看，同时交给 waitHealth。
       两边读同一个数字，才不会出现"waitHealth 还在等、sweep 已经判超时并 kill"。 */
    const startTimeoutMs = resolveStartTimeout(manifest.health)
    writeRuntime(appId, {
      status: 'starting',
      pid: 0,
      port,
      url,
      host,
      dataRoot,
      dataDir,
      activeUser: safeUser(userId),
      version: info.version,
      startedAt: new Date().toISOString(),
      startTimeoutMs,
      lastError: '',
      stopAt: 0,
      owner: RUNTIME_OWNER,
      ownerPid: RUNTIME_OWNER_PID,
    })
    let child = null
    try {
      child = spawnCommand(info, paths.appDir, paths.entry, dataRoot, host, port, url)
      writeRuntime(appId, { status: 'starting', pid: child.pid, leaseCount: 0 })
      const ok = await waitHealth(url, manifest.health || {}, startTimeoutMs)
      if (!ok) {
        killTree(child.pid)
        throw new Error(`应用启动失败：健康检查 ${manifest.health?.path || '/'} 未通过`)
      }
      const leaseId = addLease(appId, userId)
      writeRuntime(appId, {
        status: 'running',
        pid: child.pid,
        leaseCount: leaseCount(appId),
        lastHeartbeat: Date.now(),
        lastError: '',
      })
      const contextToken = signContext(appId, userId, contextSecret, CONTEXT_TTL_MS)
      return { leaseId, url: userUrl(url, userId, contextToken), port, pid: child.pid, status: 'running', dataRoot, dataDir, contextToken }
    } catch (error) {
      if (child?.pid) killTree(child.pid)
      APP_SECRETS.delete(appId)
      writeRuntime(appId, { status: 'error', pid: 0, lastError: String(error?.message || error) })
      throw error
    }
  })
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs))
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export async function callAppTool({ id, userId, tool, args = {}, allowSideEffect = false }) {
  const appId = safeId(id)
  const info = currentAppInfo(appId)
  if (!info) throw new Error('应用未安装或缺少 app.json')
  const capabilities = normalizeAppCapabilities(info.manifest)
  const name = String(tool || '').trim()
  const spec = [...capabilities.tools, ...capabilities.resources].find((item) => item.name === name)
  if (!spec) throw new Error(`应用未声明工具：${name}`)
  if (spec.sideEffect && !allowSideEffect) throw new Error(`工具 ${name} 声明为有副作用，当前调用未获授权`)
  const started = await startApp({ id: appId, userId })
  try {
    const base = new URL(started.url)
    const target = new URL(spec.path, base.origin)
    target.search = base.search
    const secret = APP_SECRETS.get(appId)
    const contextToken = secret ? signContext(appId, userId, secret, TOOL_CONTEXT_TTL_MS) : started.contextToken
    if (contextToken) {
      target.searchParams.set('asContext', contextToken)
    }
    const headers = {
      'X-AS-App-Id': appId,
      'X-AS-User': safeUser(userId),
      'X-AS-Version': info.version,
    }
    if (contextToken) headers['X-AS-Context'] = contextToken
    let body
    if (spec.method === 'GET') {
      for (const [key, value] of Object.entries(args && typeof args === 'object' ? args : {})) {
        if (value == null) continue
        target.searchParams.set(key, typeof value === 'string' ? value : JSON.stringify(value))
      }
    } else {
      headers['content-type'] = 'application/json'
      body = JSON.stringify(args && typeof args === 'object' ? args : {})
    }
    const response = await fetchWithTimeout(target.toString(), { method: spec.method, headers, body }, spec.timeoutMs)
    const text = await response.text()
    if (text.length > 2 * 1024 * 1024) throw new Error('应用工具响应超过 2MB，拒绝载入')
    let result
    try { result = JSON.parse(text) } catch { result = text }
    if (!response.ok) throw new Error(`应用工具返回 HTTP ${response.status}: ${text.slice(0, 300)}`)
    return {
      appId,
      appName: String(info.manifest.name || appId),
      tool: name,
      method: spec.method,
      path: spec.path,
      httpStatus: response.status,
      result,
      contract: { sideEffect: spec.sideEffect, inputSchema: spec.inputSchema },
    }
  } finally {
    releaseApp({ id: appId, leaseId: started.leaseId, force: false })
  }
}

export function heartbeatApp({ id, leaseId }) {
  const appId = safeId(id)
  const state = readRuntime(appId)
  if (!state?.pid || !pidAlive(state.pid)) return { ok: false, code: 'AS_NOT_RUNNING', status: 'stopped' }
  const lease = leaseSet(appId).get(leaseId)
  if (!lease) return { ok: false, code: 'AS_LEASE_LOST', status: state.status }
  lease.lastSeen = Date.now()
  writeRuntime(appId, { leaseCount: leaseCount(appId), lastHeartbeat: lease.lastSeen })
  return { ok: true, leaseCount: leaseCount(appId), url: userUrl(state.url, lease.userId), status: 'running' }
}

export function releaseApp({ id, leaseId, force = false }) {
  const appId = safeId(id)
  const set = leaseSet(appId)
  if (force) set.clear()
  else if (leaseId) set.delete(leaseId)
  const count = set.size
  const state = readRuntime(appId)
  if (!state?.pid || !pidAlive(state.pid)) {
    writeRuntime(appId, { status: 'stopped', pid: 0, stopAt: 0, leaseCount: 0 })
    return { stopped: true, status: 'stopped', leaseCount: 0 }
  }
  if (force || count === 0) {
    const stopAt = force ? 0 : Date.now() + STOP_GRACE_MS
    writeRuntime(appId, { status: force ? 'stopping' : 'running', leaseCount: count, stopAt })
    if (force) {
      killTree(state.pid)
      writeRuntime(appId, { status: 'stopped', pid: 0, stopAt: 0, leaseCount: 0 })
      return { stopped: true, status: 'stopped', leaseCount: 0 }
    }
  } else {
    writeRuntime(appId, { leaseCount: count, stopAt: 0 })
  }
  return { stopped: false, status: readRuntime(appId)?.status || 'running', leaseCount: count, stopAt: readRuntime(appId)?.stopAt || 0 }
}

export function sweepApps(now = Date.now()) {
  let changed = 0
  let dirs = []
  try {
    dirs = readdirSync(AS_APPS_ROOT, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !entry.name.startsWith('.')).map((entry) => entry.name)
  } catch {
    return 0
  }
  for (const id of dirs) {
    const state = readRuntime(id)
    if (!state) continue
    const ownerPid = Number(state.ownerPid || 0)
    if (state.owner && state.owner !== RUNTIME_OWNER && ownerPid && pidAlive(ownerPid)) continue
    if (state.owner && state.owner !== RUNTIME_OWNER) {
      writeRuntime(id, { owner: RUNTIME_OWNER, ownerPid: RUNTIME_OWNER_PID })
    }
    const pid = Number(state.pid || 0)
    if (pid && !pidAlive(pid)) {
      writeRuntime(id, { status: 'stopped', pid: 0, stopAt: 0, lastError: state.lastError || '' })
      changed += 1
      continue
    }
    const leases = pruneLeases(id, now)
    if (leases.size && Number(state.leaseCount || 0) !== leases.size) {
      writeRuntime(id, { leaseCount: leases.size })
      changed += 1
    }
    if (state.status === 'starting' && now - Date.parse(state.startedAt || 0) > Math.max(5000, Number(state.startTimeoutMs || START_TIMEOUT_MS))) {
      if (pid) killTree(pid)
      writeRuntime(id, { status: 'error', pid: 0, lastError: '启动超时' })
      changed += 1
      continue
    }
    if (state.status === 'running' && !leases.size) {
      const stopAt = Number(state.stopAt || 0) || now + STOP_GRACE_MS
      if (state.stopAt !== stopAt) writeRuntime(id, { stopAt })
      if (now >= stopAt) {
        if (pid) killTree(pid)
        writeRuntime(id, { status: 'stopped', pid: 0, stopAt: 0, leaseCount: 0 })
        changed += 1
      }
    }
  }
  return changed
}

export async function shutdownApps() {
  let dirs = []
  try {
    dirs = readdirSync(AS_APPS_ROOT, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !entry.name.startsWith('.')).map((entry) => entry.name)
  } catch {
    return
  }
  for (const id of dirs) {
    const state = readRuntime(id)
    if (state?.pid && pidAlive(state.pid)) killTree(state.pid)
    if (state) writeRuntime(id, { status: 'stopped', pid: 0, stopAt: 0, leaseCount: 0 })
    LEASES.delete(id)
  }
}

/** 服务端重启时清理上一轮遗留的应用进程；AS 进程不属于 DSH，不能靠 closeHarness 回收。 */
export async function reconcileAppsOnBoot() {
  let dirs = []
  try {
    dirs = readdirSync(AS_APPS_ROOT, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !entry.name.startsWith('.')).map((entry) => entry.name)
  } catch {
    return { cleaned: 0 }
  }
  let cleaned = 0
  for (const id of dirs) {
    const state = readRuntime(id)
    if (!state) continue
    const wasAlive = Boolean(state.pid && pidAlive(state.pid))
    const ownerPid = Number(state.ownerPid || 0)
    if (wasAlive && state.owner && state.owner !== RUNTIME_OWNER && ownerPid && pidAlive(ownerPid)) continue
    if (wasAlive) {
      killTree(state.pid)
      cleaned += 1
    }
    /* 被重启收掉的进程要留下可解释的原因：客户端关掉再打开时，应用"自己没了"必须有据可查，
       否则用户只会看到「未运行」而不知道是重启带走的。正常已停的应用保持原有 lastError。 */
    writeRuntime(id, {
      status: 'stopped',
      pid: 0,
      stopAt: 0,
      leaseCount: 0,
      lastError: wasAlive ? '客户端重启，上一轮应用进程已回收' : String(state.lastError || ''),
    })
  }
  LEASES.clear()
  return { cleaned }
}

/**
 * 卸载应用：停进程 + 释放租约 + 移除版本目录。
 *
 * 账号数据默认保留（keepUsers: true）——卸载或删除市场条目不该连带销毁账号目录里的业务数据，
 * 也不该让同 appId 的另一个市场条目失去可用的包。彻底清除（含账号数据）必须显式传 keepUsers: false。
 */
export function uninstallApp(id, { keepUsers = true } = {}) {
  const appId = safeId(id)
  const state = readRuntime(appId)
  if (state?.pid && pidAlive(state.pid)) killTree(state.pid)
  LEASES.delete(appId)
  const root = appRoot(appId)
  if (!existsSync(root)) return true
  if (!keepUsers) {
    rmSync(root, { recursive: true, force: true })
    return true
  }
  for (const entry of ['versions', 'current.json', 'runtime.json', 'runtime.log']) {
    rmSync(join(root, entry), { recursive: true, force: true })
  }
  // 只剩账号数据目录时保留；什么都没有了才把根目录本身清掉。
  let left = []
  try { left = readdirSync(root) } catch { left = [] }
  if (!left.length) rmSync(root, { recursive: true, force: true })
  return true
}
