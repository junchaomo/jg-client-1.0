/**
 * 九规智能中枢 1.0 · 本地持久化底座
 *
 * 说明：
 * - 使用 Node 内置的 node:sqlite，不引入第三方数据库驱动。
 * - 当前定位是单机 1.0 客户端的 P0 底座，后续可替换为内网 PostgreSQL。
 * - 会话只保存随机 ID；账号密码以 scrypt 哈希保存在 accounts 表，不保存明文。
 * - 文件不塞进数据库 BLOB：数据库存元数据，正文落在 data/files 下，按版本分目录。
 */
import { DatabaseSync } from 'node:sqlite'
import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  rmSync,
  statSync,
  cpSync,
} from 'node:fs'
import { dirname, join, basename, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes, createHash } from 'node:crypto'

const root = dirname(fileURLToPath(import.meta.url))
const dataDir = process.env.JG_DATA_DIR || join(root, 'data')
const filesDir = join(dataDir, 'files')
const backupsDir = join(dataDir, 'backups')
mkdirSync(dataDir, { recursive: true })
mkdirSync(filesDir, { recursive: true })
mkdirSync(backupsDir, { recursive: true })

const dbPath = join(dataDir, 'jg.sqlite')
const db = new DatabaseSync(dbPath)
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 3000;

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    net TEXT NOT NULL DEFAULT 'inet',
    account_id TEXT,
    created_at INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT '',
    duty TEXT NOT NULL DEFAULT '',
    username TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    api_key TEXT NOT NULL DEFAULT '',
    api_provider TEXT NOT NULL DEFAULT '',
    api_endpoint TEXT NOT NULL DEFAULT '',
    api_model TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL DEFAULT '',
    must_change_password INTEGER NOT NULL DEFAULT 1,
    password_updated_at INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_accounts_role ON accounts(role);

  CREATE TABLE IF NOT EXISTS audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    time TEXT NOT NULL,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    object TEXT NOT NULL,
    result TEXT NOT NULL,
    net TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_audit_created ON audit(created_at DESC);

  CREATE TABLE IF NOT EXISTS approval_decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    decision_id TEXT NOT NULL UNIQUE,
    conversation_id TEXT NOT NULL DEFAULT '',
    call_id TEXT NOT NULL DEFAULT '',
    tool TEXT NOT NULL DEFAULT '',
    operation TEXT NOT NULL DEFAULT '',
    args_summary TEXT NOT NULL DEFAULT '',
    decision TEXT NOT NULL DEFAULT '',
    rule TEXT NOT NULL DEFAULT '',
    risk TEXT NOT NULL DEFAULT '',
    actor TEXT NOT NULL DEFAULT '',
    approver TEXT NOT NULL DEFAULT '',
    net TEXT NOT NULL DEFAULT '',
    time TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    decided_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_approval_decisions_created ON approval_decisions(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_approval_decisions_conversation ON approval_decisions(conversation_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS app_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    path TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    owner TEXT NOT NULL DEFAULT '',
    net TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_files_deleted ON files(deleted_at);
  CREATE INDEX IF NOT EXISTS idx_files_created ON files(created_at DESC);

  CREATE TABLE IF NOT EXISTS file_versions (
    file_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    name TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    path TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (file_id, version)
  );

  CREATE TABLE IF NOT EXISTS visual_artifacts (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL DEFAULT '',
    message_id TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL,
    caption TEXT NOT NULL DEFAULT '',
    version INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'temporary',
    owner TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_visual_session ON visual_artifacts(session_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_visual_owner ON visual_artifacts(owner, updated_at DESC);

  CREATE TABLE IF NOT EXISTS visual_versions (
    visual_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    source TEXT NOT NULL,
    caption TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    PRIMARY KEY (visual_id, version)
  );

  CREATE TABLE IF NOT EXISTS image_assets (
    id TEXT PRIMARY KEY,
    owner TEXT NOT NULL DEFAULT '',
    net TEXT NOT NULL DEFAULT '',
    prompt TEXT NOT NULL DEFAULT '',
    style TEXT NOT NULL DEFAULT '',
    ratio TEXT NOT NULL DEFAULT '',
    provider TEXT NOT NULL DEFAULT '',
    provider_label TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    model_id TEXT NOT NULL DEFAULT '',
    seed INTEGER NOT NULL DEFAULT 0,
    file_id TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    project_id TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'generate',
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_image_assets_owner ON image_assets(owner, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_image_assets_deleted ON image_assets(deleted_at);

  CREATE TABLE IF NOT EXISTS image_revisions (
    asset_id TEXT NOT NULL,
    revision INTEGER NOT NULL,
    file_id TEXT NOT NULL,
    prompt TEXT NOT NULL DEFAULT '',
    style TEXT NOT NULL DEFAULT '',
    ratio TEXT NOT NULL DEFAULT '',
    provider TEXT NOT NULL DEFAULT '',
    provider_label TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    model_id TEXT NOT NULL DEFAULT '',
    seed INTEGER NOT NULL DEFAULT 0,
    params TEXT NOT NULL DEFAULT '{}',
    note TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    PRIMARY KEY (asset_id, revision)
  );
  CREATE INDEX IF NOT EXISTS idx_image_revisions_asset ON image_revisions(asset_id, revision DESC);

  CREATE TABLE IF NOT EXISTS image_jobs (
    id TEXT PRIMARY KEY,
    owner TEXT NOT NULL DEFAULT '',
    net TEXT NOT NULL DEFAULT '',
    asset_id TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL DEFAULT 'generate',
    provider TEXT NOT NULL DEFAULT '',
    model_id TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'running',
    prompt TEXT NOT NULL DEFAULT '',
    params TEXT NOT NULL DEFAULT '{}',
    error TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    finished_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_image_jobs_owner ON image_jobs(owner, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_image_jobs_status ON image_jobs(status);

  CREATE TABLE IF NOT EXISTS image_comments (
    id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0,
    owner TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_image_comments_asset ON image_comments(asset_id, created_at ASC);
`)

// 兼容 P0-2 之前已经建好的 sessions 表：补 account_id 列。
try {
  db.exec('ALTER TABLE sessions ADD COLUMN account_id TEXT')
} catch (error) {
  if (!/duplicate column name/i.test(String(error && error.message))) throw error
}

// 账号密码登录：给旧库补字段；空哈希由服务启动时的默认密码迁移补齐。
for (const sql of [
  'ALTER TABLE accounts ADD COLUMN username TEXT NOT NULL DEFAULT \'\'',
  'ALTER TABLE accounts ADD COLUMN phone TEXT NOT NULL DEFAULT \'\'',
  'ALTER TABLE accounts ADD COLUMN password_hash TEXT NOT NULL DEFAULT \'\'',
  'ALTER TABLE accounts ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 1',
  'ALTER TABLE accounts ADD COLUMN password_updated_at INTEGER NOT NULL DEFAULT 0',
]) {
  try {
    db.exec(sql)
  } catch (error) {
    if (!/duplicate column name/i.test(String(error && error.message))) throw error
  }
}

export const SESSION_TTL_MS = 8 * 60 * 60 * 1000

const stmt = {
  createSession: db.prepare(`
    INSERT INTO sessions (id, role, net, account_id, created_at, last_seen, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  getSession: db.prepare('SELECT * FROM sessions WHERE id = ?'),
  touchSession: db.prepare('UPDATE sessions SET last_seen = ? WHERE id = ?'),
  deleteSession: db.prepare('DELETE FROM sessions WHERE id = ?'),
  expireSession: db.prepare('DELETE FROM sessions WHERE expires_at <= ?'),
  clearSessions: db.prepare('DELETE FROM sessions'),
  updateSessionNet: db.prepare('UPDATE sessions SET net = ?, last_seen = ? WHERE id = ?'),
  insertAudit: db.prepare(`
    INSERT INTO audit (time, actor, action, object, result, net, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  latestAudit: db.prepare('SELECT time, actor, action, object, result, net FROM audit ORDER BY id DESC LIMIT ?'),
  countAudit: db.prepare('SELECT COUNT(*) AS count FROM audit'),
  clearAudit: db.prepare('DELETE FROM audit'),
  insertApprovalDecision: db.prepare(`
    INSERT INTO approval_decisions (
      decision_id, conversation_id, call_id, tool, operation, args_summary,
      decision, rule, risk, actor, approver, net, time, created_at, decided_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  updateApprovalDecision: db.prepare(`
    UPDATE approval_decisions
    SET decision = COALESCE(?, decision),
        rule = COALESCE(?, rule),
        risk = COALESCE(?, risk),
        approver = COALESCE(?, approver),
        decided_at = ?
    WHERE decision_id = ?
  `),
  latestApprovalDecisions: db.prepare(`
    SELECT decision_id, conversation_id, call_id, tool, operation, args_summary,
           decision, rule, risk, actor, approver, net, time, created_at, decided_at
    FROM approval_decisions ORDER BY id DESC LIMIT ?
  `),
  expirePendingApprovalDecisions: db.prepare(`
    UPDATE approval_decisions
    SET decision = 'expired', approver = ?, decided_at = ?
    WHERE decision = 'pending'
  `),
  putState: db.prepare(`
    INSERT INTO app_state (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `),
  getState: db.prepare('SELECT value FROM app_state WHERE key = ?'),

  listAccounts: db.prepare('SELECT * FROM accounts ORDER BY created_at ASC'),
  getAccount: db.prepare('SELECT * FROM accounts WHERE id = ?'),
  getAccountByRole: db.prepare('SELECT * FROM accounts WHERE role = ? ORDER BY created_at ASC LIMIT 1'),
  getAccountByUsername: db.prepare('SELECT * FROM accounts WHERE lower(username) = lower(?) OR (phone != \'\' AND phone = ?) ORDER BY created_at ASC LIMIT 1'),
  upsertAccount: db.prepare(`
    INSERT INTO accounts (id, name, role, unit, duty, api_key, api_provider, api_endpoint, api_model, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      role = excluded.role,
      unit = excluded.unit,
      duty = excluded.duty,
      updated_at = excluded.updated_at
  `),
  updateAccountSecret: db.prepare(`
    UPDATE accounts SET
      api_key = ?,
      api_provider = ?,
      api_endpoint = ?,
      api_model = ?,
      updated_at = ?
    WHERE id = ?
  `),
  updateAccountPassword: db.prepare(`
    UPDATE accounts SET
      password_hash = ?,
      must_change_password = ?,
      password_updated_at = ?,
      updated_at = ?
    WHERE id = ?
  `),
  updateAccountUsername: db.prepare(`
    UPDATE accounts SET username = ?, updated_at = ? WHERE id = ?
  `),

  getFile: db.prepare('SELECT * FROM files WHERE id = ?'),
  listFiles: db.prepare('SELECT * FROM files WHERE deleted_at IS NULL ORDER BY created_at DESC'),
  listAllFiles: db.prepare('SELECT * FROM files ORDER BY created_at DESC'),
  countFiles: db.prepare('SELECT COUNT(*) AS count FROM files WHERE deleted_at IS NULL'),
  countSessions: db.prepare('SELECT COUNT(*) AS count FROM sessions'),
  upsertFile: db.prepare(`
    INSERT INTO files (id, name, mime, size, sha256, path, version, owner, net, created_at, updated_at, deleted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      mime = excluded.mime,
      size = excluded.size,
      sha256 = excluded.sha256,
      path = excluded.path,
      version = excluded.version,
      owner = excluded.owner,
      net = excluded.net,
      updated_at = excluded.updated_at,
      deleted_at = NULL
  `),
  insertVersion: db.prepare(`
    INSERT INTO file_versions (file_id, version, name, mime, size, sha256, path, created_at, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  listVersions: db.prepare('SELECT * FROM file_versions WHERE file_id = ? ORDER BY version DESC'),
  softDelete: db.prepare('UPDATE files SET deleted_at = ?, updated_at = ? WHERE id = ?'),
  restore: db.prepare('UPDATE files SET deleted_at = NULL, updated_at = ? WHERE id = ?'),
  purgeMeta: db.prepare('DELETE FROM files WHERE id = ?'),
  purgeVersions: db.prepare('DELETE FROM file_versions WHERE file_id = ?'),
  insertImageAsset: db.prepare(`
    INSERT INTO image_assets (
      id, owner, net, prompt, style, ratio, provider, provider_label, model, model_id, seed,
      file_id, revision, project_id, source, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  getImageAsset: db.prepare('SELECT * FROM image_assets WHERE id = ?'),
  listImageAssets: db.prepare(`
    SELECT * FROM image_assets
    WHERE owner = ? AND deleted_at IS NULL
    ORDER BY updated_at DESC
    LIMIT ?
  `),
  softDeleteImageAsset: db.prepare(`
    UPDATE image_assets SET deleted_at = ?, updated_at = ?, status = 'deleted'
    WHERE id = ? AND owner = ? AND deleted_at IS NULL
  `),
  updateImageAssetLatest: db.prepare(`
    UPDATE image_assets SET
      prompt = ?, style = ?, ratio = ?, provider = ?, provider_label = ?, model = ?, model_id = ?,
      seed = ?, file_id = ?, revision = ?, updated_at = ?
    WHERE id = ? AND owner = ? AND deleted_at IS NULL
  `),
  insertImageRevision: db.prepare(`
    INSERT INTO image_revisions (
      asset_id, revision, file_id, prompt, style, ratio, provider, provider_label, model, model_id,
      seed, params, note, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  listImageRevisions: db.prepare('SELECT * FROM image_revisions WHERE asset_id = ? ORDER BY revision DESC'),
  countImageRevisions: db.prepare('SELECT COUNT(*) AS count FROM image_revisions WHERE asset_id = ?'),
  insertImageJob: db.prepare(`
    INSERT INTO image_jobs (id, owner, net, asset_id, kind, provider, model_id, status, prompt, params, error, created_at, updated_at, finished_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  updateImageJob: db.prepare(`
    UPDATE image_jobs SET
      asset_id = COALESCE(?, asset_id),
      provider = COALESCE(?, provider),
      model_id = COALESCE(?, model_id),
      status = COALESCE(?, status),
      error = COALESCE(?, error),
      updated_at = ?,
      finished_at = COALESCE(?, finished_at)
    WHERE id = ?
  `),
  insertImageComment: db.prepare(`
    INSERT INTO image_comments (id, asset_id, revision, owner, body, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  getImageComment: db.prepare('SELECT * FROM image_comments WHERE id = ?'),
  listImageComments: db.prepare('SELECT * FROM image_comments WHERE asset_id = ? ORDER BY created_at ASC'),
}

/* ------------------------------- sessions ------------------------------- */

export function createSession(role, net = 'inet', ttlMs = SESSION_TTL_MS, accountId = null) {
  const id = randomBytes(32).toString('hex')
  const now = Date.now()
  stmt.createSession.run(id, role, net, accountId || null, now, now, now + ttlMs)
  return id
}

export function getSession(id) {
  if (!id) return null
  const row = stmt.getSession.get(id)
  if (!row) return null
  if (row.expires_at <= Date.now()) {
    stmt.deleteSession.run(id)
    return null
  }
  return { id: row.id, role: row.role, net: row.net, accountId: row.account_id || null, createdAt: row.created_at, lastSeen: row.last_seen, expiresAt: row.expires_at }
}

export function touchSession(id) {
  if (!id) return
  stmt.touchSession.run(Date.now(), id)
}

export function updateSessionNet(id, net) {
  if (!id) return
  stmt.updateSessionNet.run(net, Date.now(), id)
}

export function deleteSession(id) {
  if (!id) return
  stmt.deleteSession.run(id)
}

export function cleanupSessions() {
  const result = stmt.expireSession.run(Date.now())
  return Number(result.changes || 0)
}

export function clearSessions() {
  stmt.clearSessions.run()
}

/* --------------------------------- audit -------------------------------- */

export function appendAudit(entry) {
  stmt.insertAudit.run(
    String(entry.time || ''),
    String(entry.actor || ''),
    String(entry.action || ''),
    String(entry.object || ''),
    String(entry.result || ''),
    String(entry.net || ''),
    Number(entry.createdAt || Date.now())
  )
}

export function latestAudit(limit = 80) {
  return stmt.latestAudit.all(Math.max(1, Math.min(Number(limit) || 80, 1000))).map((row) => ({
    time: row.time,
    actor: row.actor,
    action: row.action,
    object: row.object,
    result: row.result,
    net: row.net,
  }))
}

export function auditCount() {
  return Number(stmt.countAudit.get().count || 0)
}

export function clearAudit() {
  stmt.clearAudit.run()
}

/* --------------------------- approval decisions --------------------------- */

export function appendApprovalDecision(entry = {}) {
  stmt.insertApprovalDecision.run(
    String(entry.decisionId || ''),
    String(entry.conversationId || ''),
    String(entry.callId || ''),
    String(entry.tool || ''),
    String(entry.operation || ''),
    String(entry.argsSummary || ''),
    String(entry.decision || ''),
    String(entry.rule || ''),
    String(entry.risk || ''),
    String(entry.actor || ''),
    String(entry.approver || ''),
    String(entry.net || ''),
    String(entry.time || ''),
    Number(entry.createdAt || Date.now()),
    entry.decidedAt ? Number(entry.decidedAt) : null
  )
}

export function updateApprovalDecision(decisionId, patch = {}) {
  if (!decisionId) return
  stmt.updateApprovalDecision.run(
    patch.decision ? String(patch.decision) : null,
    patch.rule ? String(patch.rule) : null,
    patch.risk ? String(patch.risk) : null,
    patch.approver ? String(patch.approver) : null,
    Number(patch.decidedAt || Date.now()),
    String(decisionId)
  )
}

export function latestApprovalDecisions(limit = 50) {
  const rows = stmt.latestApprovalDecisions.all(Math.max(1, Math.min(Number(limit) || 50, 200)))
  return rows.map((row) => ({
    decisionId: row.decision_id,
    conversationId: row.conversation_id,
    callId: row.call_id,
    tool: row.tool,
    operation: row.operation,
    argsSummary: row.args_summary,
    decision: row.decision,
    rule: row.rule,
    risk: row.risk,
    actor: row.actor,
    approver: row.approver,
    net: row.net,
    time: row.time,
    createdAt: row.created_at,
    decidedAt: row.decided_at || 0,
  }))
}

export function expirePendingApprovalDecisions(approver = 'system-restart') {
  stmt.expirePendingApprovalDecisions.run(String(approver), Date.now())
}

/* ------------------------------ accounts -------------------------------- */

function mapAccount(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    unit: row.unit,
    duty: row.duty,
    username: row.username || '',
    phone: row.phone || '',
    apiKey: row.api_key || '',
    apiProvider: row.api_provider || '',
    apiEndpoint: row.api_endpoint || '',
    apiModel: row.api_model || '',
    passwordHash: row.password_hash || '',
    mustChangePassword: row.must_change_password === 1 || row.must_change_password === true,
    passwordUpdatedAt: Number(row.password_updated_at || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function upsertAccount(account = {}) {
  const now = Date.now()
  stmt.upsertAccount.run(
    String(account.id || ''),
    String(account.name || ''),
    String(account.role || ''),
    String(account.unit || ''),
    String(account.duty || ''),
    String(account.apiKey || ''),
    String(account.apiProvider || ''),
    String(account.apiEndpoint || ''),
    String(account.apiModel || ''),
    Number(account.createdAt || now),
    now
  )
  return getAccount(account.id)
}

export function getAccount(id) {
  return mapAccount(stmt.getAccount.get(String(id || '')))
}

export function getAccountByRole(role) {
  return mapAccount(stmt.getAccountByRole.get(String(role || '')))
}

export function getAccountByUsername(username) {
  const key = String(username || '').trim()
  if (!key) return null
  return mapAccount(stmt.getAccountByUsername.get(key, key))
}

export function setAccountUsername(id, username) {
  stmt.updateAccountUsername.run(String(username || '').trim(), Date.now(), String(id || ''))
  return getAccount(id)
}

export function listAccounts() {
  return stmt.listAccounts.all().map(mapAccount)
}

export function updateAccountSecret(id, secret = {}) {
  stmt.updateAccountSecret.run(
    String(secret.apiKey || ''),
    String(secret.apiProvider || ''),
    String(secret.apiEndpoint || ''),
    String(secret.apiModel || ''),
    Date.now(),
    String(id || '')
  )
  return getAccount(id)
}

export function setAccountPassword(id, passwordHash, mustChangePassword = true) {
  const now = Date.now()
  stmt.updateAccountPassword.run(
    String(passwordHash || ''),
    mustChangePassword ? 1 : 0,
    now,
    now,
    String(id || '')
  )
  return getAccount(id)
}

/* ----------------------------- app state -------------------------------- */

export function saveState(key, value) {
  stmt.putState.run(String(key), JSON.stringify(value), Date.now())
}

export function loadState(key) {
  const row = stmt.getState.get(String(key))
  if (!row) return null
  try {
    return JSON.parse(row.value)
  } catch {
    return null
  }
}

/* ---------------------------- visual artifacts ---------------------------- */

function visualMeta(row) {
  if (!row) return null
  return {
    id: row.id,
    sessionId: row.session_id,
    messageId: row.message_id,
    type: row.type,
    title: row.title,
    source: row.source,
    caption: row.caption || '',
    version: Number(row.version),
    status: row.status,
    owner: row.owner,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  }
}

const visualSql = {
  get: db.prepare('SELECT * FROM visual_artifacts WHERE id = ?'),
  insert: db.prepare(`
    INSERT INTO visual_artifacts (id, session_id, message_id, type, title, source, caption, version, status, owner, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  update: db.prepare(`
    UPDATE visual_artifacts SET type = ?, title = ?, source = ?, caption = ?, version = ?, updated_at = ? WHERE id = ?
  `),
  save: db.prepare('UPDATE visual_artifacts SET title = ?, status = ?, updated_at = ? WHERE id = ?'),
  attach: db.prepare('UPDATE visual_artifacts SET message_id = ?, updated_at = ? WHERE id = ?'),
  listBySession: db.prepare('SELECT * FROM visual_artifacts WHERE session_id = ? ORDER BY created_at ASC'),
  listByOwner: db.prepare('SELECT * FROM visual_artifacts WHERE owner = ? ORDER BY updated_at DESC LIMIT ?'),
  listSaved: db.prepare("SELECT * FROM visual_artifacts WHERE owner = ? AND status = 'saved' ORDER BY updated_at DESC LIMIT ?"),
  insertVersion: db.prepare(`
    INSERT INTO visual_versions (visual_id, version, type, title, source, caption, note, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  listVersions: db.prepare('SELECT * FROM visual_versions WHERE visual_id = ? ORDER BY version ASC'),
  count: db.prepare('SELECT COUNT(*) AS count FROM visual_artifacts'),
}

export function createVisualArtifact(input = {}) {
  const id = String(input.id || '').replace(/[^\w.-]/g, '_').slice(0, 96)
  if (!id) throw new Error('visual id required')
  if (visualSql.get.get(id)) throw new Error('visual already exists')
  const now = Date.now()
  const version = 1
  visualSql.insert.run(
    id,
    String(input.sessionId || ''),
    String(input.messageId || ''),
    String(input.type || ''),
    String(input.title || ''),
    String(input.source || ''),
    String(input.caption || ''),
    version,
    String(input.status || 'temporary'),
    String(input.owner || ''),
    now,
    now
  )
  visualSql.insertVersion.run(id, version, String(input.type || ''), String(input.title || ''), String(input.source || ''), String(input.caption || ''), '创建', String(input.owner || ''), now)
  return visualMeta(visualSql.get.get(id))
}

export function getVisualArtifact(id) {
  return visualMeta(visualSql.get.get(String(id || '')))
}

export function listVisualArtifacts({ sessionId = '', owner = '', savedOnly = false, limit = 200 } = {}) {
  const rows = sessionId
    ? visualSql.listBySession.all(String(sessionId))
    : savedOnly
      ? visualSql.listSaved.all(String(owner), Math.max(1, Math.min(500, Number(limit) || 200)))
      : visualSql.listByOwner.all(String(owner), Math.max(1, Math.min(500, Number(limit) || 200)))
  return rows.map(visualMeta)
}

export function updateVisualArtifact(id, patch = {}, actor = '', note = '') {
  const current = getVisualArtifact(id)
  if (!current) throw new Error('visual not found')
  const nextVersion = current.version + 1
  const nextType = String(patch.type || current.type)
  const nextTitle = String(patch.title || current.title)
  const nextSource = String(patch.source == null ? current.source : patch.source)
  const nextCaption = String(patch.caption == null ? current.caption : patch.caption)
  const now = Date.now()
  visualSql.update.run(nextType, nextTitle, nextSource, nextCaption, nextVersion, now, current.id)
  visualSql.insertVersion.run(current.id, nextVersion, nextType, nextTitle, nextSource, nextCaption, String(note || '更新'), String(actor || ''), now)
  return visualMeta(visualSql.get.get(current.id))
}

export function saveVisualArtifact(id, { title = '', actor = '' } = {}) {
  const current = getVisualArtifact(id)
  if (!current) throw new Error('visual not found')
  const now = Date.now()
  visualSql.save.run(String(title || current.title), 'saved', now, current.id)
  return visualMeta(visualSql.get.get(current.id))
}

export function attachVisualMessage(id, messageId) {
  const current = getVisualArtifact(id)
  if (!current) return null
  visualSql.attach.run(String(messageId || ''), Date.now(), current.id)
  return visualMeta(visualSql.get.get(current.id))
}

export function listVisualVersions(id) {
  return visualSql.listVersions.all(String(id || '')).map((row) => ({
    visualId: row.visual_id,
    version: Number(row.version),
    type: row.type,
    title: row.title,
    source: row.source,
    caption: row.caption || '',
    note: row.note || '',
    createdBy: row.created_by || '',
    createdAt: Number(row.created_at),
  }))
}

export function restoreVisualVersion(id, version, actor = '', note = '') {
  const current = getVisualArtifact(id)
  if (!current) throw new Error('visual not found')
  const row = visualSql.listVersions.all(String(id || '')).find((item) => Number(item.version) === Number(version))
  if (!row) throw new Error('visual version not found')
  const nextVersion = current.version + 1
  const now = Date.now()
  const keepSavedTitle = current.status === 'saved' && current.title ? current.title : row.title
  visualSql.update.run(row.type, keepSavedTitle, row.source, row.caption || '', nextVersion, now, current.id)
  visualSql.insertVersion.run(current.id, nextVersion, row.type, keepSavedTitle, row.source, row.caption || '', String(note || `恢复 v${version}`), String(actor || ''), now)
  return visualMeta(visualSql.get.get(current.id))
}

export function visualCount() {
  return Number(visualSql.count.get().count || 0)
}

/* ----------------------------- object files ----------------------------- */

function safeId(value) {
  const clean = String(value || '').replace(/[^\w.-]/g, '_').slice(0, 96)
  return clean || `FILE-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`
}

function safeName(value) {
  const name = basename(String(value || 'file'))
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/^\.+/, '')
    .slice(-160)
  return name || 'file'
}

function absolutePath(relPath) {
  return join(dataDir, ...String(relPath).split('/'))
}

function relativePath(absPath) {
  return relative(dataDir, absPath).split(sep).join('/')
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function metaOf(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    mime: row.mime,
    size: Number(row.size),
    sha256: row.sha256,
    path: row.path,
    version: Number(row.version),
    owner: row.owner,
    net: row.net,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    deletedAt: row.deleted_at == null ? null : Number(row.deleted_at),
  }
}

/**
 * 写入/更新一个文件。同一个 id 再写一次会自动升版本，旧版本保留。
 * @param {{id?: string, name: string, mime?: string, buffer: Buffer, owner?: string, net?: string, note?: string}} input
 */
export function putFile(input) {
  const buffer = Buffer.isBuffer(input.buffer) ? input.buffer : Buffer.from(input.buffer || '')
  const id = safeId(input.id)
  const name = safeName(input.name)
  const mime = String(input.mime || 'application/octet-stream')
  const owner = String(input.owner || '')
  const net = String(input.net || '')
  const note = String(input.note || '')
  const existing = stmt.getFile.get(id)
  const version = existing ? Number(existing.version) + 1 : 1
  const dir = join(filesDir, id, `v${version}`)
  mkdirSync(dir, { recursive: true })
  const abs = join(dir, name)
  writeFileSync(abs, buffer)
  const digest = sha256(buffer)
  const rel = relativePath(abs)
  const now = Date.now()

  stmt.upsertFile.run(id, name, mime, buffer.length, digest, rel, version, owner, net, existing ? Number(existing.created_at) : now, now)
  stmt.insertVersion.run(id, version, name, mime, buffer.length, digest, rel, now, note)
  return metaOf(stmt.getFile.get(id))
}

export function getFile(id) {
  return metaOf(stmt.getFile.get(safeId(id)))
}

export function readFileBuffer(id, version = null, allowDeleted = false) {
  const row = stmt.getFile.get(safeId(id))
  if (!row || (!allowDeleted && row.deleted_at != null)) return null
  if (version) {
    const ver = stmt.listVersions.all(row.id).find((v) => Number(v.version) === Number(version))
    if (!ver) return null
    return readFileSync(absolutePath(ver.path))
  }
  return readFileSync(absolutePath(row.path))
}

export function listFiles({ includeDeleted = false, prefix = '' } = {}) {
  const rows = includeDeleted ? stmt.listAllFiles.all() : stmt.listFiles.all()
  return rows
    .map(metaOf)
    .filter((row) => !prefix || row.id.startsWith(prefix))
}

export function listFileVersions(id) {
  return stmt.listVersions.all(safeId(id)).map((row) => ({
    fileId: row.file_id,
    version: Number(row.version),
    name: row.name,
    mime: row.mime,
    size: Number(row.size),
    sha256: row.sha256,
    path: row.path,
    createdAt: Number(row.created_at),
    note: row.note,
  }))
}

export function deleteFile(id, note = '移入回收站') {
  const now = Date.now()
  const row = stmt.getFile.get(safeId(id))
  if (!row) return null
  stmt.softDelete.run(now, now, row.id)
  return { ...metaOf(stmt.getFile.get(row.id)), deleteNote: note }
}

export function restoreFile(id) {
  const row = stmt.getFile.get(safeId(id))
  if (!row) return null
  stmt.restore.run(Date.now(), row.id)
  return metaOf(stmt.getFile.get(row.id))
}

export function purgeFile(id) {
  const row = stmt.getFile.get(safeId(id))
  if (!row) return false
  stmt.purgeVersions.run(row.id)
  stmt.purgeMeta.run(row.id)
  rmSync(join(filesDir, row.id), { recursive: true, force: true })
  return true
}

export function fileCount() {
  return Number(stmt.countFiles.get().count || 0)
}

/* ----------------------------- image assets ----------------------------- */

function imageAssetOf(row) {
  if (!row) return null
  return {
    id: row.id,
    owner: row.owner,
    net: row.net,
    prompt: row.prompt,
    style: row.style,
    ratio: row.ratio,
    provider: row.provider,
    providerLabel: row.provider_label,
    model: row.model,
    modelId: row.model_id,
    seed: Number(row.seed),
    fileId: row.file_id,
    revision: Number(row.revision),
    projectId: row.project_id,
    source: row.source,
    status: row.status,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    deletedAt: row.deleted_at == null ? null : Number(row.deleted_at),
  }
}

function imageRevisionOf(row) {
  if (!row) return null
  let params = {}
  try { params = JSON.parse(row.params || '{}') } catch { params = {} }
  return {
    assetId: row.asset_id,
    revision: Number(row.revision),
    fileId: row.file_id,
    prompt: row.prompt,
    style: row.style,
    ratio: row.ratio,
    provider: row.provider,
    providerLabel: row.provider_label,
    model: row.model,
    modelId: row.model_id,
    seed: Number(row.seed),
    params,
    note: row.note,
    createdBy: row.created_by,
    createdAt: Number(row.created_at),
  }
}

export function createImageAsset(input = {}) {
  const now = Number(input.createdAt || Date.now())
  stmt.insertImageAsset.run(
    String(input.id || ''),
    String(input.owner || ''),
    String(input.net || ''),
    String(input.prompt || ''),
    String(input.style || ''),
    String(input.ratio || ''),
    String(input.provider || ''),
    String(input.providerLabel || ''),
    String(input.model || ''),
    String(input.modelId || ''),
    Number(input.seed || 0),
    String(input.fileId || ''),
    Number(input.revision || 1),
    String(input.projectId || ''),
    String(input.source || 'generate'),
    String(input.status || 'active'),
    now,
    now
  )
  return imageAssetOf(stmt.getImageAsset.get(String(input.id || '')))
}

export function getImageAsset(id) {
  return imageAssetOf(stmt.getImageAsset.get(String(id || '')))
}

export function listImageAssets({ owner = '', limit = 20 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100))
  return stmt.listImageAssets.all(String(owner || ''), safeLimit).map(imageAssetOf)
}

export function softDeleteImageAsset(id, owner) {
  const row = stmt.getImageAsset.get(String(id || ''))
  if (!row) return null
  const result = stmt.softDeleteImageAsset.run(Date.now(), Date.now(), String(id || ''), String(owner || ''))
  if (!Number(result.changes || 0)) return null
  return imageAssetOf(stmt.getImageAsset.get(String(id || '')))
}

export function updateImageAssetLatest(id, owner, patch = {}) {
  const current = getImageAsset(id)
  if (!current || current.owner !== String(owner || '') || current.deletedAt != null) return null
  const next = { ...current, ...patch }
  const result = stmt.updateImageAssetLatest.run(
    String(next.prompt || ''),
    String(next.style || ''),
    String(next.ratio || ''),
    String(next.provider || ''),
    String(next.providerLabel || ''),
    String(next.model || ''),
    String(next.modelId || ''),
    Number(next.seed || 0),
    String(next.fileId || ''),
    Number(next.revision || 1),
    Date.now(),
    String(id || ''),
    String(owner || '')
  )
  if (!Number(result.changes || 0)) return null
  return getImageAsset(id)
}

export function createImageRevision(input = {}) {
  const params = typeof input.params === 'string' ? input.params : JSON.stringify(input.params || {})
  stmt.insertImageRevision.run(
    String(input.assetId || ''),
    Number(input.revision || 1),
    String(input.fileId || ''),
    String(input.prompt || ''),
    String(input.style || ''),
    String(input.ratio || ''),
    String(input.provider || ''),
    String(input.providerLabel || ''),
    String(input.model || ''),
    String(input.modelId || ''),
    Number(input.seed || 0),
    String(params || '{}'),
    String(input.note || ''),
    String(input.createdBy || ''),
    Number(input.createdAt || Date.now())
  )
  return imageRevisionOf(stmt.listImageRevisions.all(String(input.assetId || ''))[0])
}

export function listImageRevisions(assetId) {
  return stmt.listImageRevisions.all(String(assetId || '')).map(imageRevisionOf)
}

export function imageRevisionCount(assetId) {
  return Number(stmt.countImageRevisions.get(String(assetId || '')).count || 0)
}

function imageCommentOf(row) {
  if (!row) return null
  return {
    id: row.id,
    assetId: row.asset_id,
    revision: Number(row.revision || 0),
    owner: row.owner,
    body: row.body,
    createdAt: Number(row.created_at),
  }
}

export function createImageComment(input = {}) {
  const now = Number(input.createdAt || Date.now())
  const id = String(input.id || '')
  stmt.insertImageComment.run(
    id,
    String(input.assetId || ''),
    Number(input.revision || 0),
    String(input.owner || ''),
    String(input.body || ''),
    now
  )
  return imageCommentOf(stmt.getImageComment.get(id))
}

export function listImageComments(assetId) {
  return stmt.listImageComments.all(String(assetId || '')).map(imageCommentOf)
}

export function createImageJob(input = {}) {
  const now = Number(input.createdAt || Date.now())
  const params = typeof input.params === 'string' ? input.params : JSON.stringify(input.params || {})
  stmt.insertImageJob.run(
    String(input.id || ''),
    String(input.owner || ''),
    String(input.net || ''),
    String(input.assetId || ''),
    String(input.kind || 'generate'),
    String(input.provider || ''),
    String(input.modelId || ''),
    String(input.status || 'running'),
    String(input.prompt || ''),
    String(params || '{}'),
    String(input.error || ''),
    now,
    now,
    input.finishedAt ? Number(input.finishedAt) : null
  )
  return String(input.id || '')
}

export function updateImageJob(id, patch = {}) {
  stmt.updateImageJob.run(
    patch.assetId == null ? null : String(patch.assetId),
    patch.provider == null ? null : String(patch.provider),
    patch.modelId == null ? null : String(patch.modelId),
    patch.status == null ? null : String(patch.status),
    patch.error == null ? null : String(patch.error),
    Number(patch.updatedAt || Date.now()),
    patch.finishedAt == null ? null : Number(patch.finishedAt),
    String(id || '')
  )
}

/* ------------------------------- backups -------------------------------- */

function backupStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function readManifest(dir) {
  const file = join(dir, 'manifest.json')
  if (!existsSync(file)) return null
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return null }
}

export function backupNow(note = '定时备份') {
  const id = backupStamp()
  const dir = join(backupsDir, id)
  mkdirSync(dir, { recursive: true })
  const targetDb = join(dir, 'jg.sqlite')
  db.exec('PRAGMA wal_checkpoint(FULL);')
  // VACUUM INTO 生成一致性快照，不会覆盖已存在文件；目录名带毫秒时间戳，避免撞名。
  db.exec(`VACUUM INTO '${targetDb.replace(/'/g, "''")}'`)
  const filesTarget = join(dir, 'files')
  cpSync(filesDir, filesTarget, { recursive: true })
  const manifest = {
    id,
    createdAt: new Date().toISOString(),
    note: String(note || ''),
    db: 'jg.sqlite',
    files: 'files',
    fileCount: fileCount(),
    auditCount: auditCount(),
    sessionCount: Number(stmt.countSessions.get().count || 0),
    dbBytes: statSync(targetDb).size,
  }
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
  pruneBackups(14)
  return { ...manifest, path: dir }
}

export function listBackups() {
  if (!existsSync(backupsDir)) return []
  return readdirSync(backupsDir)
    .map((name) => ({ name, dir: join(backupsDir, name) }))
    .filter((item) => statSync(item.dir).isDirectory())
    .map((item) => ({ name: item.name, ...(readManifest(item.dir) || {}) }))
    .sort((a, b) => String(b.name).localeCompare(String(a.name)))
}

export function pruneBackups(keep = 14) {
  const items = listBackups()
  const extra = items.slice(Math.max(0, keep))
  for (const item of extra) {
    const dir = join(backupsDir, item.name)
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
  }
  return extra.length
}

export function backupPath() {
  return backupsDir
}

export function closeStore() {
  try { db.close() } catch { /* 进程退出时忽略 */ }
}

export function dataDirPath() {
  return dataDir
}

export function databasePath() {
  return dbPath
}
