/**
 * 应用级数据授权台账与短期数据令牌。
 *
 * 设计边界：
 * - 授权对象是“应用 + 当前用户 + 资源范围”，不是应用进程。
 * - 应用不能读取主进程 MCP 令牌；应用用用户上下文令牌换取 5 分钟短期数据令牌。
 * - 令牌只保存在服务进程内存，不落盘；服务重启即失效。
 * - 授权台账落 SQLite app_state，进程重启后仍可审计和撤销。
 */
import { randomBytes } from 'node:crypto'
import { loadState, saveState } from './db.mjs'

const STATE_KEY = 'app_data_grants_v1'
const TOKEN_TTL_MS = Math.max(60 * 1000, Number(process.env.JG_APP_DATA_TOKEN_TTL_MS || 5 * 60 * 1000))
const MAX_TTL_MS = 90 * 24 * 60 * 60 * 1000

const grants = new Map()
const tokens = new Map()
let loaded = false

function nowIso() {
  return new Date().toISOString()
}

function safeList(value) {
  return Array.isArray(value) ? [...new Set(value.map((x) => String(x || '').trim()).filter(Boolean))] : []
}

function ensureLoaded() {
  if (loaded) return
  loaded = true
  const state = loadState(STATE_KEY)
  if (!state || typeof state !== 'object') return
  for (const item of Array.isArray(state.grants) ? state.grants : []) {
    if (!item || !item.grantId) continue
    grants.set(String(item.grantId), { ...item })
  }
}

function persist() {
  saveState(STATE_KEY, {
    version: 1,
    updatedAt: nowIso(),
    grants: [...grants.values()],
  })
}

function prune() {
  ensureLoaded()
  const now = Date.now()
  let changed = false
  for (const [id, grant] of grants.entries()) {
    if (String(grant.status || '') === 'active' && Number(grant.expiresAt || 0) <= now) {
      grants.set(id, { ...grant, status: 'expired', updatedAt: nowIso() })
      changed = true
    }
  }
  for (const [token, record] of tokens.entries()) {
    if (Number(record.expiresAt || 0) <= now) tokens.delete(token)
  }
  if (changed) persist()
}

export function listGrants({ appId = '', userId = '', status = '' } = {}) {
  prune()
  return [...grants.values()]
    .filter((item) => (!appId || String(item.appId) === String(appId)))
    .filter((item) => (!userId || String(item.userId) === String(userId)))
    .filter((item) => (!status || String(item.status) === String(status)))
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
}

export function activeGrantFor(appId, userId) {
  prune()
  const list = listGrants({ appId, userId, status: 'active' })
  return list.find((item) => Number(item.expiresAt || 0) > Date.now()) || null
}

export function createGrant({
  appId,
  userId,
  resourceIds = [],
  scopes = ['read'],
  purpose = '',
  expiresAt = 0,
  createdBy = '',
  appName = '',
  net = 'inet',
}) {
  ensureLoaded()
  const aid = String(appId || '').trim()
  const uid = String(userId || '').trim()
  if (!aid) throw new Error('appId 不能为空')
  if (!uid) throw new Error('userId 不能为空')
  const ids = safeList(resourceIds)
  if (!ids.length) throw new Error('至少选择一个资源范围')
  const scopeList = safeList(scopes).filter((x) => ['read', 'detail', 'export'].includes(x))
  if (!scopeList.length) throw new Error('至少选择一个数据范围')
  const ttlEnd = Number(expiresAt || 0) || Date.now() + 7 * 24 * 60 * 60 * 1000
  const boundedEnd = Math.min(ttlEnd, Date.now() + MAX_TTL_MS)
  if (boundedEnd <= Date.now()) throw new Error('授权有效期必须大于当前时间')
  const grant = {
    grantId: `ADG-${randomBytes(8).toString('hex')}`,
    appId: aid,
    appName: String(appName || aid),
    userId: uid,
    resourceIds: ids,
    scopes: scopeList,
    purpose: String(purpose || '').trim() || '应用数据读取',
    net: String(net || 'inet'),
    status: 'active',
    createdAt: Date.now(),
    createdIso: nowIso(),
    createdBy: String(createdBy || ''),
    expiresAt: boundedEnd,
    lastUsedAt: 0,
  }
  grants.set(grant.grantId, grant)
  persist()
  return grant
}

export function revokeGrant(grantId, by = '') {
  ensureLoaded()
  const id = String(grantId || '').trim()
  const grant = grants.get(id)
  if (!grant) throw new Error('授权不存在')
  const next = { ...grant, status: 'revoked', revokedAt: nowIso(), revokedBy: String(by || ''), updatedAt: nowIso() }
  grants.set(id, next)
  for (const [token, record] of tokens.entries()) {
    if (record.grantId === id) tokens.delete(token)
  }
  persist()
  return next
}

export function mintDataToken({ grantId, appId, userId }) {
  ensureLoaded()
  const grant = grants.get(String(grantId || ''))
  if (!grant) throw new Error('授权不存在')
  if (String(grant.status) !== 'active') throw new Error('授权已失效')
  if (Number(grant.expiresAt || 0) <= Date.now()) throw new Error('授权已过期')
  if (String(grant.appId) !== String(appId) || String(grant.userId) !== String(userId)) throw new Error('授权与当前应用或用户不匹配')
  const token = `ADT-${randomBytes(24).toString('hex')}`
  const expiresAt = Math.min(Number(grant.expiresAt), Date.now() + TOKEN_TTL_MS)
  tokens.set(token, { token, grantId: grant.grantId, appId: grant.appId, userId: grant.userId, expiresAt, issuedAt: Date.now() })
  return { token, grantId: grant.grantId, scopes: grant.scopes, expiresAt }
}

export function verifyDataToken(token) {
  prune()
  const value = String(token || '').replace(/^Bearer\s+/i, '').trim()
  if (!value) return null
  const record = tokens.get(value)
  if (!record || Number(record.expiresAt || 0) <= Date.now()) return null
  const grant = grants.get(record.grantId)
  if (!grant || String(grant.status) !== 'active' || Number(grant.expiresAt || 0) <= Date.now()) return null
  grant.lastUsedAt = Date.now()
  return { ...record, grant }
}

export function grantView(grant) {
  if (!grant) return null
  const { userId, resourceIds, scopes, purpose, ...rest } = grant
  return {
    ...rest,
    userId,
    resourceIds: Array.isArray(resourceIds) ? resourceIds : [],
    scopes: Array.isArray(scopes) ? scopes : [],
    purpose: String(purpose || ''),
    expiresIso: grant.expiresAt ? new Date(Number(grant.expiresAt)).toISOString() : '',
    expired: Number(grant.expiresAt || 0) <= Date.now() || String(grant.status) !== 'active',
  }
}
