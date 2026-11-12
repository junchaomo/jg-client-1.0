/**
 * 九规智能中枢 1.0 · 本地持久化底座
 *
 * 说明：
 * - 使用 Node 内置的 node:sqlite，不引入第三方数据库驱动。
 * - 当前定位是单机 1.0 客户端的 P0 底座，后续可替换为内网 PostgreSQL。
 * - 会话只保存随机 ID，不保存密码；登录仍沿用原型的“选择角色”方式。
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
    api_key TEXT NOT NULL DEFAULT '',
    api_provider TEXT NOT NULL DEFAULT '',
    api_endpoint TEXT NOT NULL DEFAULT '',
    api_model TEXT NOT NULL DEFAULT '',
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
`)

// 兼容 P0-2 之前已经建好的 sessions 表：补 account_id 列。
try {
  db.exec('ALTER TABLE sessions ADD COLUMN account_id TEXT')
} catch (error) {
  if (!/duplicate column name/i.test(String(error && error.message))) throw error
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
  putState: db.prepare(`
    INSERT INTO app_state (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `),
  getState: db.prepare('SELECT value FROM app_state WHERE key = ?'),

  listAccounts: db.prepare('SELECT * FROM accounts ORDER BY created_at ASC'),
  getAccount: db.prepare('SELECT * FROM accounts WHERE id = ?'),
  getAccountByRole: db.prepare('SELECT * FROM accounts WHERE role = ? ORDER BY created_at ASC LIMIT 1'),
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

/* ------------------------------ accounts -------------------------------- */

function mapAccount(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    unit: row.unit,
    duty: row.duty,
    apiKey: row.api_key || '',
    apiProvider: row.api_provider || '',
    apiEndpoint: row.api_endpoint || '',
    apiModel: row.api_model || '',
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
