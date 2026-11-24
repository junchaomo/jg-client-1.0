import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { isAbsolute, join, resolve } from 'node:path'

const ACTIONS = new Set(['workspace', 'workspaceReset', 'reauth', 'devices', 'diag', 'applyAccess', 'export', 'archive', 'clearCache', 'testMcp', 'update', 'help'])
const jsonBody = (req) => {
  try { return JSON.parse(req.__body || '{}') } catch { return {} }
}
const cleanText = (value, max = 200) => String(value || '').trim().slice(0, max)
const nowIso = () => new Date().toISOString()
const MFA_TTL_MS = 10 * 60 * 1000
const ACCESS_STATUS = {
  pending: '待审批', approved: '已授权', rejected: '已驳回', cancelled: '已取消', revoked: '已撤销', expired: '已到期',
}

export function base32Encode(buffer) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0')
  let output = ''
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0')
    output += alphabet[Number.parseInt(chunk, 2)]
  }
  return output
}

export function totp(secret, at = Date.now(), stepOffset = 0) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const normalized = String(secret || '').toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = ''
  for (const char of normalized) {
    const index = alphabet.indexOf(char)
    if (index < 0) throw new Error('动态口令密钥无效')
    bits += index.toString(2).padStart(5, '0')
  }
  const bytes = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(Number.parseInt(bits.slice(i, i + 8), 2))
  if (!bytes.length) throw new Error('动态口令密钥为空')
  const counter = BigInt(Math.floor(Number(at) / 30000) + Number(stepOffset || 0))
  const message = Buffer.alloc(8)
  message.writeBigUInt64BE(counter)
  const digest = createHmac('sha1', Buffer.from(bytes)).update(message).digest()
  const offset = digest[digest.length - 1] & 15
  const value = ((digest[offset] & 127) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3]
  return String(value % 1000000).padStart(6, '0')
}

export function verifyTotp(secret, code, at = Date.now()) {
  const supplied = String(code || '').replace(/\s/g, '')
  if (!/^\d{6}$/.test(supplied)) return false
  for (const offset of [-1, 0, 1]) {
    const expected = totp(secret, at, offset)
    if (timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return true
  }
  return false
}

export function compareVersions(left, right) {
  const parse = (value) => {
    const [main, pre = ''] = String(value || '').replace(/^v/i, '').split('-', 2)
    const nums = main.split('.').map((part) => Number.parseInt(part, 10))
    return { nums: nums.map((n) => Number.isFinite(n) ? n : 0), pre }
  }
  const a = parse(left)
  const b = parse(right)
  for (let i = 0; i < Math.max(a.nums.length, b.nums.length, 3); i += 1) {
    const delta = (a.nums[i] || 0) - (b.nums[i] || 0)
    if (delta) return Math.sign(delta)
  }
  if (a.pre === b.pre) return 0
  if (!a.pre) return 1
  if (!b.pre) return -1
  return a.pre.localeCompare(b.pre, 'en', { numeric: true })
}

function probeModelEndpoint(config, timeoutMs = 8000) {
  return new Promise((resolveProbe) => {
    if (!config?.endpoint) return resolveProbe({ ok: false, code: 'NOT_CONFIGURED', detail: '没有可用的共享问答模型配置' })
    let target
    try {
      target = new URL(config.endpoint)
      if (!['http:', 'https:'].includes(target.protocol)) throw new Error('protocol')
      target.pathname = `${target.pathname.replace(/\/$/, '')}/models`
      target.search = ''
    } catch {
      return resolveProbe({ ok: false, code: 'BAD_ENDPOINT', detail: '模型网关地址无效' })
    }
    const startedAt = Date.now()
    const transport = target.protocol === 'https:' ? httpsRequest : httpRequest
    const request = transport(target, {
      method: 'GET',
      timeout: timeoutMs,
      headers: {
        accept: 'application/json',
        ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
      },
    }, (response) => {
      const chunks = []
      let size = 0
      response.on('data', (chunk) => {
        size += chunk.length
        if (size <= 256 * 1024) chunks.push(chunk)
      })
      response.on('end', () => {
        const status = Number(response.statusCode || 0)
        let modelCount = null
        try {
          const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
          if (Array.isArray(parsed?.data)) modelCount = parsed.data.length
        } catch {}
        const certificate = response.socket?.getPeerCertificate?.()
        resolveProbe({
          ok: status >= 200 && status < 400,
          status,
          latencyMs: Date.now() - startedAt,
          modelCount,
          detail: status === 401 || status === 403 ? '网关可达，但凭证鉴权失败' : status >= 200 && status < 400 ? '模型目录请求成功' : `网关返回 HTTP ${status}`,
          certificateValidTo: certificate?.valid_to || '',
        })
      })
    })
    request.on('timeout', () => request.destroy(new Error('请求超时')))
    request.on('error', (error) => resolveProbe({ ok: false, latencyMs: Date.now() - startedAt, detail: error?.message || '模型网关连接失败' }))
    request.end()
  })
}

export function testMcpProcess({ nodeExe, script, env, timeoutMs = 10000 }) {
  return new Promise((resolveTest) => {
    const startedAt = Date.now()
    const child = spawn(nodeExe, [script], { env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let settled = false
    const expected = new Map()
    const result = { ok: false, checks: [], latencyMs: 0 }
    const finish = (error = '') => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try { child.kill() } catch {}
      result.latencyMs = Date.now() - startedAt
      if (error) result.error = error
      result.ok = !error && result.checks.length === 4 && result.checks.every((item) => item.ok)
      if (stderr.trim()) result.diagnostic = stderr.trim().slice(-1000)
      resolveTest(result)
    }
    const timer = setTimeout(() => finish('MCP 握手或目录读取超时'), timeoutMs)
    const send = (id, method, params = {}) => {
      expected.set(id, method)
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
    }
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8')
      let newline = stdout.indexOf('\n')
      while (newline >= 0) {
        const line = stdout.slice(0, newline).trim()
        stdout = stdout.slice(newline + 1)
        newline = stdout.indexOf('\n')
        if (!line) continue
        let message
        try { message = JSON.parse(line) } catch { continue }
        const method = expected.get(message.id)
        if (!method) continue
        expected.delete(message.id)
        if (message.error) {
          result.checks.push({ name: method, ok: false, detail: message.error.message || 'MCP 返回错误' })
          finish(message.error.message || 'MCP 返回错误')
          return
        }
        if (method === 'initialize') {
          result.serverInfo = message.result?.serverInfo || null
          result.protocolVersion = message.result?.protocolVersion || ''
          result.checks.push({ name: method, ok: Boolean(result.serverInfo), detail: result.protocolVersion || '已初始化' })
          send(2, 'tools/list')
        } else if (method === 'tools/list') {
          const tools = Array.isArray(message.result?.tools) ? message.result.tools : []
          result.toolCount = tools.length
          result.checks.push({ name: method, ok: tools.length > 0, detail: `${tools.length} 项工具` })
          send(3, 'resources/list')
        } else if (method === 'resources/list') {
          const resources = Array.isArray(message.result?.resources) ? message.result.resources : []
          result.resourceCount = resources.length
          result.checks.push({ name: method, ok: true, detail: `${resources.length} 项当前身份可见资源` })
          send(4, 'ping')
        } else if (method === 'ping') {
          result.checks.push({ name: method, ok: true, detail: 'ping 成功' })
          finish()
          return
        }
      }
    })
    child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-4000) })
    child.on('error', (error) => finish(error?.message || '无法启动 MCP 进程'))
    child.on('exit', (code) => { if (!settled) finish(`MCP 进程提前退出（code=${code}）`) })
    send(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'jg-settings-center', version: '1.0.0' } })
  })
}

function checkUpdateManifest(currentVersion, source, fetchImpl = fetch) {
  if (!source) return Promise.resolve({ status: 'not_configured', currentVersion, checkedAt: nowIso(), message: '尚未配置更新清单地址（JG_UPDATE_URL），不会猜测是否最新' })
  return (async () => {
    let url
    try {
      url = new URL(source)
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('protocol')
    } catch { return { status: 'error', currentVersion, checkedAt: nowIso(), message: '更新清单地址无效' } }
    try {
      const response = await fetchImpl(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) })
      if (!response.ok) return { status: 'error', currentVersion, checkedAt: nowIso(), message: `更新源返回 HTTP ${response.status}` }
      const manifest = await response.json()
      const latestVersion = cleanText(manifest.version, 40)
      if (!/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(latestVersion)) return { status: 'error', currentVersion, checkedAt: nowIso(), message: '更新清单缺少合法 version' }
      const comparison = compareVersions(latestVersion, currentVersion)
      return {
        status: comparison > 0 ? 'available' : 'current', currentVersion, latestVersion, checkedAt: nowIso(),
        downloadUrl: comparison > 0 && /^https?:\/\//i.test(manifest.url || '') ? manifest.url : '',
        notes: cleanText(manifest.notes, 4000), sha256: cleanText(manifest.sha256, 128),
        message: comparison > 0 ? '发现新版本' : comparison === 0 ? '当前版本与更新源一致' : '当前版本高于更新源版本',
      }
    } catch (error) {
      return { status: 'error', currentVersion, checkedAt: nowIso(), message: `更新检查失败：${error?.message || error}` }
    }
  })()
}

export function createSettingsCenter(deps) {
  const {
    state, root, dataDir, productVersion, roleOf, netOf, sessionOf, json, contentDisposition, logAudit,
    listAccountSessions, deleteSession, conversations, conversationAllowed, conversationMarkdown,
    modelForUser, ensureWorkspaceAcl, closeHarnessForHome, userDshHome, storageCheck,
  } = deps
  state.workspaces ||= {}
  state.mfa ||= {}
  state.accessRequests ||= []
  state.cacheClears ||= {}

  const refreshAccessStatuses = () => {
    const now = Date.now()
    for (const item of state.accessRequests) {
      if (item.status === 'approved' && item.approvedUntil && Date.parse(item.approvedUntil) <= now) item.status = 'expired'
    }
  }
  const hasActiveAccess = (userId, resourceId) => {
    refreshAccessStatuses()
    return state.accessRequests.some((item) => item.userId === userId && item.resourceId === resourceId && item.status === 'approved' && Date.parse(item.approvedUntil) > Date.now())
  }
  const canReview = (user) => typeof deps.canReview === 'function'
    ? deps.canReview(user)
    : user.role === 'admin' || (user.roles || []).some((role) => role === 'admin' || role === 'data_admin')
  const hasFreshMfa = (req, user) => {
    const record = state.mfa[user.id]
    if (!record?.enabled) return true
    const session = sessionOf(req)
    const verifiedAt = Number(record.verifications?.[session?.id] || 0)
    return Boolean(session?.id && verifiedAt && Date.now() - verifiedAt <= MFA_TTL_MS)
  }
  const notify = (userId, title, body, level = '') => {
    if (userId && typeof deps.notifyUser === 'function') deps.notifyUser(userId, { title, body, level })
  }
  const notifyReviewers = (item) => {
    for (const reviewerId of deps.reviewerIds?.() || []) {
      if (reviewerId !== item.userId) notify(reviewerId, `数据授权申请待审批：${item.resourceName}`, `${item.applicant}（${item.unit}）申请 ${item.durationDays} 天权限。用途：${item.reason}`, 'warn')
    }
  }

  const defaultWorkspace = (user) => join(dataDir, 'dsh-workspaces', 'chat', String(user.id || 'user'))
  const workspaceFor = (user) => cleanText(state.workspaces[user.id], 1024) || defaultWorkspace(user)
  const overview = (user) => {
    refreshAccessStatuses()
    const sessions = listAccountSessions(user.id).filter((item) => item.expiresAt > Date.now())
    const mfa = state.mfa[user.id] || {}
    return {
      workspace: { path: workspaceFor(user), defaultPath: defaultWorkspace(user), isDefault: !state.workspaces[user.id] },
      mfa: { enabled: Boolean(mfa.enabled), lastVerifiedAt: mfa.lastVerifiedAt || '', enrolledAt: mfa.enrolledAt || '' },
      counts: {
        devices: sessions.length,
        accessRequests: state.accessRequests.filter((item) => item.userId === user.id).length,
        pendingAccessReviews: canReview(user) ? state.accessRequests.filter((item) => item.status === 'pending' && item.userId !== user.id).length : 0,
        archived: conversations.filter((item) => item.archivedAt && conversationAllowed(user, item)).length,
      },
      version: { current: productVersion, updateConfigured: Boolean(process.env.JG_UPDATE_URL) },
      lastCacheClearAt: state.cacheClears[user.id] || '',
    }
  }
  const publicConversation = (item) => ({
    id: item.id, title: item.title || '未命名会话', time: item.time || '', model: item.model || '', turns: item.turns || 0,
    status: item.status || 'done', workspace: item.workspace || '', archivedAt: item.archivedAt || '',
  })
  const listConversations = (user, archived) => conversations
    .filter((item) => conversationAllowed(user, item) && Boolean(item.archivedAt) === archived)
    .map(publicConversation)
  const deviceList = (req, user) => {
    const current = sessionOf(req)
    return listAccountSessions(user.id).filter((item) => item.expiresAt > Date.now()).map((item) => ({
      token: createHash('sha256').update(item.id).digest('hex').slice(0, 24),
      current: item.id === current?.id,
      network: item.net,
      userAgent: item.userAgent || '未记录客户端标识',
      ipAddress: item.ipAddress || '未记录',
      createdAt: new Date(item.createdAt).toISOString(),
      lastSeenAt: new Date(item.lastSeen).toISOString(),
      expiresAt: new Date(item.expiresAt).toISOString(),
    }))
  }
  const mcpTest = (req, user, port) => testMcpProcess({
    nodeExe: process.execPath,
    script: join(root, 'mcp-jg.mjs'),
    env: {
      ...process.env,
      JG_MCP_URL: `http://127.0.0.1:${port}`,
      JG_MCP_ACCOUNT: user.id,
      JG_MCP_TOKEN: process.env.JG_MCP_TOKEN || '',
    },
  })

  const routes = {
    'GET /api/settings/center': (req, res) => json(res, 200, { ok: true, ...overview(roleOf(req)) }),
    'POST /api/settings/workspace': async (req, res) => {
      const user = roleOf(req)
      const body = jsonBody(req)
      if (body.reset === true) delete state.workspaces[user.id]
      else {
        const input = cleanText(body.path, 1024)
        if (!input || !isAbsolute(input)) return json(res, 400, { error: '工作区必须是本机绝对路径', code: 'WORKSPACE_PATH_INVALID' })
        const target = resolve(input)
        if (target === resolve(dataDir)) return json(res, 409, { error: '不能把应用数据根目录直接作为聊天工作区', code: 'WORKSPACE_DATA_ROOT' })
        try {
          mkdirSync(target, { recursive: true })
          if (!statSync(target).isDirectory()) throw new Error('目标不是文件夹')
          const probe = join(target, `.jg-workspace-${process.pid}-${Date.now()}.tmp`)
          writeFileSync(probe, 'workspace-write-test', 'utf8')
          rmSync(probe, { force: true })
          ensureWorkspaceAcl(target)
          state.workspaces[user.id] = target
        } catch (error) {
          return json(res, 422, { error: `工作区不可写：${error?.message || error}`, code: 'WORKSPACE_NOT_WRITABLE' })
        }
      }
      try { await closeHarnessForHome(userDshHome(user.id)) } catch {}
      logAudit(user, body.reset === true ? 'settings.workspace.reset' : 'settings.workspace.change', workspaceFor(user), 'allow', netOf(req))
      json(res, 200, { ok: true, workspace: overview(user).workspace, restartRequired: false, message: '新会话将使用此工作区；已有会话目录不变' })
    },
    'POST /api/settings/mfa/enroll': (req, res) => {
      const user = roleOf(req)
      const current = state.mfa[user.id] || {}
      if (current.enabled) return json(res, 409, { error: '当前账号已绑定动态口令，请直接输入 6 位验证码重新认证', code: 'MFA_ALREADY_ENABLED' })
      const secret = base32Encode(randomBytes(20))
      state.mfa[user.id] = { pendingSecret: secret, pendingAt: nowIso() }
      const label = encodeURIComponent(`九规智能中枢:${user.name}`)
      const issuer = encodeURIComponent('九规智能中枢')
      json(res, 200, { ok: true, secret, otpauth: `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30` })
    },
    'POST /api/settings/mfa/verify': (req, res) => {
      const user = roleOf(req)
      const body = jsonBody(req)
      const current = state.mfa[user.id] || {}
      const secret = current.enabled ? current.secret : current.pendingSecret
      if (!secret) return json(res, 409, { error: '请先生成并绑定动态口令密钥', code: 'MFA_NOT_ENROLLED' })
      if (!verifyTotp(secret, body.code)) {
        logAudit(user, 'settings.mfa.verify', user.id, 'deny', netOf(req))
        return json(res, 401, { error: '动态口令不正确或已过期，请输入认证器当前显示的 6 位数字', code: 'MFA_CODE_INVALID' })
      }
      const enrolling = !current.enabled
      const session = sessionOf(req)
      if (!session?.id) return json(res, 401, { error: '登录会话已失效，请重新登录', code: 'AUTH_REQUIRED' })
      const verifiedAt = Date.now()
      const verifications = { ...(current.verifications || {}), [session.id]: verifiedAt }
      for (const [sessionId, at] of Object.entries(verifications)) {
        if (verifiedAt - Number(at) > 24 * 60 * 60 * 1000) delete verifications[sessionId]
      }
      state.mfa[user.id] = {
        enabled: true, secret, enrolledAt: current.enrolledAt || nowIso(), lastVerifiedAt: new Date(verifiedAt).toISOString(), verifications,
      }
      logAudit(user, enrolling ? 'settings.mfa.enroll' : 'settings.mfa.verify', user.id, 'allow', netOf(req))
      json(res, 200, { ok: true, enrolled: enrolling, verifiedAt: state.mfa[user.id].lastVerifiedAt, message: enrolling ? '动态口令已绑定，本次二次认证通过' : '二次认证通过，本次结果已写入审计' })
    },
    'GET /api/settings/devices': (req, res) => json(res, 200, { ok: true, items: deviceList(req, roleOf(req)) }),
    'POST /api/settings/devices/revoke': (req, res) => {
      const user = roleOf(req)
      const body = jsonBody(req)
      const current = sessionOf(req)
      const sessions = listAccountSessions(user.id)
      const targets = body.allOthers === true
        ? sessions.filter((item) => item.id !== current?.id)
        : sessions.filter((item) => createHash('sha256').update(item.id).digest('hex').slice(0, 24) === cleanText(body.token, 24))
      if (!targets.length) return json(res, 404, { error: '没有找到可注销的设备会话' })
      if (targets.some((item) => item.id === current?.id)) return json(res, 409, { error: '当前设备请通过“退出登录”注销', code: 'CURRENT_DEVICE' })
      for (const item of targets) deleteSession(item.id)
      logAudit(user, 'settings.device.revoke', user.id, `count=${targets.length}`, netOf(req))
      json(res, 200, { ok: true, revoked: targets.length, items: deviceList(req, user) })
    },
    'GET /api/settings/diagnostics': async (req, res, url) => {
      const user = roleOf(req)
      const port = Number(url.searchParams.get('port') || deps.port)
      const checks = []
      const workspace = workspaceFor(user)
      try {
        mkdirSync(workspace, { recursive: true })
        const probe = join(workspace, `.jg-diagnostic-${Date.now()}.tmp`)
        writeFileSync(probe, 'ok')
        rmSync(probe, { force: true })
        checks.push({ id: 'workspace', label: '默认工作区读写', ok: true, detail: workspace })
      } catch (error) { checks.push({ id: 'workspace', label: '默认工作区读写', ok: false, detail: error?.message || String(error) }) }
      try {
        const detail = storageCheck()
        checks.push({ id: 'sqlite', label: 'SQLite 持久化', ok: true, detail })
      } catch (error) { checks.push({ id: 'sqlite', label: 'SQLite 持久化', ok: false, detail: error?.message || String(error) }) }
      const model = await probeModelEndpoint(modelForUser(user))
      checks.push({ id: 'model', label: '模型网关 /models', ok: model.ok, ...model })
      const mcp = await mcpTest(req, user, port)
      checks.push({ id: 'mcp', label: 'MCP stdio 握手与资源目录', ok: mcp.ok, latencyMs: mcp.latencyMs, detail: mcp.ok ? `${mcp.toolCount} 项工具 · ${mcp.resourceCount} 项可见资源` : mcp.error })
      const result = { ok: checks.every((item) => item.ok), checkedAt: nowIso(), checks }
      logAudit(user, 'settings.diagnostics', user.id, result.ok ? 'ok' : 'failed', netOf(req))
      json(res, 200, result)
    },
    'GET /api/settings/access-requests': (req, res) => {
      const user = roleOf(req)
      refreshAccessStatuses()
      json(res, 200, {
        ok: true,
        resources: deps.resources.filter((item) => item.security !== 'secret' || (netOf(req) === 'secret' && user.scopes?.includes('secret'))).map((item) => ({ id: item.id, name: item.name, security: item.security, unit: item.unit || item.owner || '', accessible: deps.canSeeResource?.(user, item, netOf(req)) || hasActiveAccess(user.id, item.id) })),
        items: state.accessRequests.filter((item) => item.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((item) => ({ ...item, statusLabel: ACCESS_STATUS[item.status] || item.status })),
        canReview: canReview(user),
        pendingReviewCount: canReview(user) ? state.accessRequests.filter((item) => item.status === 'pending' && item.userId !== user.id).length : 0,
      })
    },
    'POST /api/settings/access-requests': (req, res) => {
      const user = roleOf(req)
      const body = jsonBody(req)
      const resource = deps.resources.find((item) => item.id === cleanText(body.resourceId, 100))
      if (!resource) return json(res, 404, { error: '请选择需要申请的数据资源' })
      if (resource.security === 'secret' && !(netOf(req) === 'secret' && user.scopes?.includes('secret'))) return json(res, 403, { error: '涉密资源须在涉密网并具备涉密范围后申请' })
      if (deps.canSeeResource?.(user, resource, netOf(req)) || hasActiveAccess(user.id, resource.id)) return json(res, 409, { error: '当前账号已拥有该资源权限，无需重复申请', code: 'RESOURCE_ALREADY_ACCESSIBLE' })
      const reason = cleanText(body.reason, 1000)
      if (reason.length < 8) return json(res, 400, { error: '请填写不少于 8 个字的业务用途与使用范围' })
      const durationDays = Math.max(1, Math.min(365, Number.parseInt(body.durationDays, 10) || 30))
      if (state.accessRequests.some((item) => item.userId === user.id && item.resourceId === resource.id && item.status === 'pending')) {
        return json(res, 409, { error: '该资源已有待审批申请，请勿重复提交', code: 'ACCESS_REQUEST_EXISTS' })
      }
      const item = {
        id: `ACC-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`,
        userId: user.id, applicant: user.name, unit: user.unit, resourceId: resource.id, resourceName: resource.name,
        reason, durationDays, status: 'pending', createdAt: nowIso(), network: netOf(req), reviewNote: '',
      }
      state.accessRequests.push(item)
      notifyReviewers(item)
      logAudit(user, 'settings.access-request.create', resource.id, item.id, netOf(req))
      json(res, 201, { ok: true, item, message: '授权申请已持久保存，当前状态：待数据管理员审批' })
    },
    'GET /api/settings/access-requests/admin': (req, res) => {
      const user = roleOf(req)
      if (!canReview(user)) return json(res, 403, { error: '仅数据管理员可查看审批队列', code: 'ACCESS_REVIEW_FORBIDDEN' })
      refreshAccessStatuses()
      const items = state.accessRequests.slice().sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1
        if (a.status !== 'pending' && b.status === 'pending') return 1
        return b.createdAt.localeCompare(a.createdAt)
      }).map((item) => ({ ...item, statusLabel: ACCESS_STATUS[item.status] || item.status }))
      json(res, 200, { ok: true, items })
    },
    'POST /api/settings/access-requests/review': (req, res) => {
      const reviewer = roleOf(req)
      if (!canReview(reviewer)) return json(res, 403, { error: '仅数据管理员可审批或撤销授权', code: 'ACCESS_REVIEW_FORBIDDEN' })
      const body = jsonBody(req)
      const item = state.accessRequests.find((entry) => entry.id === cleanText(body.id, 80))
      if (!item) return json(res, 404, { error: '授权申请不存在' })
      if (item.userId === reviewer.id) return json(res, 409, { error: '不能审批或撤销本人提交的申请，请由其他数据管理员处理', code: 'ACCESS_SELF_REVIEW' })
      const decision = cleanText(body.decision, 20)
      const note = cleanText(body.reviewNote, 1000)
      if (!['approved', 'rejected', 'revoked'].includes(decision)) return json(res, 400, { error: '审批决定无效' })
      if (decision === 'revoked' ? item.status !== 'approved' : item.status !== 'pending') return json(res, 409, { error: '申请状态已变化，请刷新审批队列', code: 'ACCESS_STATUS_CONFLICT' })
      if (decision === 'rejected' && note.length < 4) return json(res, 400, { error: '驳回时必须填写至少 4 个字的理由' })
      const reviewedAt = nowIso()
      item.status = decision
      item.reviewNote = note
      item.reviewedAt = reviewedAt
      item.reviewedBy = reviewer.name
      item.reviewerId = reviewer.id
      if (decision === 'approved') {
        item.approvedAt = reviewedAt
        item.approvedUntil = new Date(Date.now() + item.durationDays * 24 * 60 * 60 * 1000).toISOString()
        item.revokedAt = ''
      } else if (decision === 'revoked') item.revokedAt = reviewedAt
      notify(item.userId, `数据授权${ACCESS_STATUS[decision]}：${item.resourceName}`, decision === 'approved' ? `授权有效期至 ${item.approvedUntil}。${note ? `审批意见：${note}` : ''}` : `处理人：${reviewer.name}。${note ? `原因：${note}` : ''}`, decision === 'approved' ? 'ok' : 'warn')
      logAudit(reviewer, `settings.access-request.${decision}`, item.resourceId, `${item.id};applicant=${item.userId};until=${item.approvedUntil || ''}`, netOf(req))
      json(res, 200, { ok: true, item: { ...item, statusLabel: ACCESS_STATUS[item.status] }, message: `已${ACCESS_STATUS[decision]}，申请人已收到站内通知` })
    },
    'POST /api/settings/access-requests/cancel': (req, res) => {
      const user = roleOf(req)
      const body = jsonBody(req)
      const item = state.accessRequests.find((entry) => entry.id === cleanText(body.id, 80))
      if (!item) return json(res, 404, { error: '授权申请不存在' })
      if (item.userId !== user.id) return json(res, 403, { error: '只能取消本人申请' })
      if (item.status !== 'pending') return json(res, 409, { error: '只有待审批申请可以取消' })
      item.status = 'cancelled'
      item.cancelledAt = nowIso()
      logAudit(user, 'settings.access-request.cancel', item.resourceId, item.id, netOf(req))
      json(res, 200, { ok: true, item, message: '申请已取消' })
    },
    'GET /api/settings/conversations': (req, res, url) => {
      const user = roleOf(req)
      const archived = url.searchParams.get('archived') === '1'
      json(res, 200, { ok: true, archived, items: listConversations(user, archived) })
    },
    'POST /api/settings/conversations/archive': (req, res) => {
      const user = roleOf(req)
      const body = jsonBody(req)
      const archived = body.archived !== false
      const ids = [...new Set(Array.isArray(body.ids) ? body.ids.map((id) => String(id)) : [])].slice(0, 100)
      const selected = conversations.filter((item) => ids.includes(item.id))
      if (selected.length !== ids.length) return json(res, 404, { error: '部分会话不存在，请刷新后重试' })
      if (selected.some((item) => !conversationAllowed(user, item))) return json(res, 403, { error: '包含无权管理的会话' })
      if (archived && selected.some((item) => item.status === 'running')) return json(res, 409, { error: '运行中的会话不能归档，请先等待完成或取消任务' })
      for (const item of selected) {
        if (archived) { item.archivedAt = nowIso(); item.archivedBy = user.id }
        else { delete item.archivedAt; delete item.archivedBy }
      }
      logAudit(user, archived ? 'settings.conversation.archive' : 'settings.conversation.restore', ids.join(','), `count=${ids.length}`, netOf(req))
      json(res, 200, { ok: true, count: ids.length, archived, active: listConversations(user, false), archivedItems: listConversations(user, true) })
    },
    'GET /api/settings/export': (req, res, url) => {
      const user = roleOf(req)
      const item = conversations.find((entry) => entry.id === url.searchParams.get('id'))
      if (!item) return json(res, 404, { error: '会话不存在' })
      if (!conversationAllowed(user, item)) return json(res, 403, { error: '无权导出该会话' })
      const format = url.searchParams.get('format') === 'json' ? 'json' : 'markdown'
      const safeId = String(item.id).replace(/[^A-Za-z0-9_-]/g, '')
      const payload = format === 'json'
        ? JSON.stringify({ exportedAt: nowIso(), conversation: item }, null, 2)
        : conversationMarkdown(item)
      logAudit(user, 'settings.conversation.export', item.id, `format=${format};bytes=${Buffer.byteLength(payload)}`, netOf(req))
      res.writeHead(200, {
        'content-type': format === 'json' ? 'application/json; charset=utf-8' : 'text/markdown; charset=utf-8',
        'content-disposition': contentDisposition(`九规会话-${safeId}.${format === 'json' ? 'json' : 'md'}`),
        'cache-control': 'no-store',
      })
      res.end(payload)
    },
    'POST /api/settings/cache/clear': (req, res) => {
      const user = roleOf(req)
      let removed = 0
      const cacheDir = join(dataDir, 'cache')
      if (existsSync(cacheDir)) {
        for (const entry of readdirSync(cacheDir, { withFileTypes: true })) {
          if (entry.name === 'keep.json') continue
          rmSync(join(cacheDir, entry.name), { recursive: true, force: true })
          removed += 1
        }
      }
      state.cacheClears[user.id] = nowIso()
      logAudit(user, 'settings.cache.clear', user.id, `serverEntries=${removed}`, netOf(req))
      json(res, 200, { ok: true, removed, clearedAt: state.cacheClears[user.id], message: '已清理界面缓存；账号、会话、项目与业务文件均未删除' })
    },
    'POST /api/settings/mcp/test': async (req, res) => {
      const user = roleOf(req)
      const result = await mcpTest(req, user, deps.port)
      logAudit(user, 'settings.mcp.test', user.id, result.ok ? `tools=${result.toolCount};resources=${result.resourceCount}` : result.error, netOf(req))
      json(res, result.ok ? 200 : 502, result)
    },
    'POST /api/settings/update/check': async (req, res) => {
      const user = roleOf(req)
      const result = await checkUpdateManifest(productVersion, process.env.JG_UPDATE_URL || '')
      logAudit(user, 'settings.update.check', productVersion, result.status, netOf(req))
      json(res, 200, { ok: result.status !== 'error', ...result })
    },
    'GET /api/settings/help': (req, res) => json(res, 200, {
      ok: true,
      sections: [
        { title: '工作区与项目', body: '“默认工作区”只影响新会话，已有会话和项目目录不会迁移。目录必须真实存在且可写；重置不会删除任何文件。' },
        { title: '二次认证与设备', body: '二次认证使用标准 TOTP 动态口令。工作区变更、设备注销、会话导出与归档、清缓存和授权审批需要当前设备在最近 10 分钟内完成认证，其他设备不能复用。' },
        { title: '数据导出与归档', body: '导出支持 Markdown 与 JSON，归档只是从日常列表移出，不删除消息；已归档会话可恢复。所有动作写入审计。' },
        { title: '数据授权审批', body: '申请人可取消待审批申请；数据管理员可通过、驳回或撤销授权。禁止自审，批准后资源立即可见，撤销或到期后立即失效，处理结果通过站内消息通知申请人。' },
        { title: '诊断与 MCP', body: '诊断实际执行工作区写入、SQLite 查询、模型 /models 请求以及 MCP 握手。失败项会保留真实错误，不用固定延迟或模拟成功。' },
        { title: '缓存与更新', body: '清缓存不会退出账号或删除业务数据。更新检查读取管理员配置的 JG_UPDATE_URL 清单；未配置时会明确提示，不会宣称“已是最新”。' },
      ],
      documents: [
        { id: 'readme', title: '客户端运行与恢复手册' },
        { id: 'prototype', title: '产品原型与交互说明' },
      ],
    }),
    'GET /api/settings/help/document': (req, res, url) => {
      const file = url.searchParams.get('id') === 'prototype' ? 'PROTOTYPE.md' : url.searchParams.get('id') === 'readme' ? 'README.md' : ''
      if (!file) return json(res, 404, { error: '帮助文档不存在' })
      try { json(res, 200, { ok: true, title: file, text: readFileSync(join(root, file), 'utf8') }) }
      catch (error) { json(res, 404, { error: `帮助文档读取失败：${error?.message || error}` }) }
    },
  }
  const mfaProtectedRoutes = [
    'POST /api/settings/workspace',
    'POST /api/settings/devices/revoke',
    'POST /api/settings/access-requests/review',
    'POST /api/settings/conversations/archive',
    'GET /api/settings/export',
    'POST /api/settings/cache/clear',
  ]
  for (const key of mfaProtectedRoutes) {
    const handler = routes[key]
    routes[key] = (req, res, url) => {
      const user = roleOf(req)
      if (!hasFreshMfa(req, user)) {
        logAudit(user, 'settings.mfa.required', key, 'deny', netOf(req))
        return json(res, 428, { error: '此操作需要当前设备在最近 10 分钟内完成二次认证', code: 'MFA_REQUIRED', reauthUrl: '/api/settings/mfa/verify' })
      }
      return handler(req, res, url)
    }
  }
  return { actions: ACTIONS, overview, workspaceFor, listConversations, hasActiveAccess, hasFreshMfa, routes, checkUpdateManifest: (source) => checkUpdateManifest(productVersion, source) }
}
