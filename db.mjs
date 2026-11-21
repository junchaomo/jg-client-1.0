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
    user_id TEXT NOT NULL DEFAULT '',
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
    user_id TEXT NOT NULL DEFAULT '',
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

  CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'fact',
    scope TEXT NOT NULL DEFAULT 'global',
    scope_ref TEXT NOT NULL DEFAULT '',
    text TEXT NOT NULL,
    normalized TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '',
    source_conversation_id TEXT NOT NULL DEFAULT '',
    source_message_id TEXT NOT NULL DEFAULT '',
    confidence REAL NOT NULL DEFAULT 0.8,
    pinned INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    embedding TEXT NOT NULL DEFAULT '',
    embedding_model TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_used_at INTEGER NOT NULL DEFAULT 0,
    use_count INTEGER NOT NULL DEFAULT 0,
    UNIQUE(user_id, normalized)
  );
  CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id, status, updated_at DESC);

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

  CREATE TABLE IF NOT EXISTS drive_index_chunks (
    item_id TEXT NOT NULL,
    chunk_no INTEGER NOT NULL,
    content TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (item_id, chunk_no)
  );

  CREATE TABLE IF NOT EXISTS drive_index_meta (
    item_id TEXT PRIMARY KEY,
    file_id TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    chunk_count INTEGER NOT NULL DEFAULT 0,
    error TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL
  );

  CREATE VIRTUAL TABLE IF NOT EXISTS drive_fts USING fts5(
    item_id UNINDEXED,
    chunk_no UNINDEXED,
    tokens,
    tokenize='unicode61 remove_diacritics 0'
  );

  CREATE TABLE IF NOT EXISTS drive_search_logs (
    id TEXT PRIMARY KEY,
    user TEXT NOT NULL,
    space TEXT NOT NULL DEFAULT '',
    query TEXT NOT NULL DEFAULT '',
    mode TEXT NOT NULL DEFAULT 'all',
    total INTEGER NOT NULL DEFAULT 0,
    items_json TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_drive_search_logs_time ON drive_search_logs(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_drive_search_logs_user ON drive_search_logs(user, created_at DESC);

  CREATE TABLE IF NOT EXISTS drive_search_clicks (
    id TEXT PRIMARY KEY,
    search_id TEXT NOT NULL,
    user TEXT NOT NULL,
    item_id TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    action TEXT NOT NULL DEFAULT 'open',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_drive_search_clicks_search ON drive_search_clicks(search_id);
  CREATE INDEX IF NOT EXISTS idx_drive_search_clicks_time ON drive_search_clicks(created_at DESC);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_drive_search_clicks_unique ON drive_search_clicks(search_id, item_id, action);

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

  CREATE TABLE IF NOT EXISTS image_layers (
    id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL,
    owner TEXT NOT NULL DEFAULT '',
    net TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL DEFAULT 'layer',
    z_order INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL DEFAULT '',
    file_id TEXT NOT NULL DEFAULT '',
    box TEXT NOT NULL DEFAULT '{}',
    visible INTEGER NOT NULL DEFAULT 1,
    opacity INTEGER NOT NULL DEFAULT 100,
    blend_mode TEXT NOT NULL DEFAULT 'normal',
    locked INTEGER NOT NULL DEFAULT 0,
    rotation REAL NOT NULL DEFAULT 0,
    provider TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    model_id TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_image_layers_asset ON image_layers(asset_id, z_order ASC, deleted_at);

  CREATE TABLE IF NOT EXISTS image_templates (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '',
    ratio TEXT NOT NULL DEFAULT '1:1',
    prompt TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    preview_file_id TEXT NOT NULL,
    source_asset_id TEXT NOT NULL DEFAULT '',
    applicant TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    reviewer TEXT NOT NULL DEFAULT '',
    review_note TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    reviewed_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_image_templates_status ON image_templates(status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_image_templates_applicant ON image_templates(applicant, created_at DESC);

  -- 地下管网模块（方案见 docs/地下管网三维模块方案-2026-11-18.md）
  CREATE TABLE IF NOT EXISTS pipeline_datasets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    source_file TEXT NOT NULL DEFAULT '',
    crs TEXT NOT NULL DEFAULT '',
    datum TEXT NOT NULL DEFAULT '',
    pipe_major TEXT NOT NULL DEFAULT '',
    point_count INTEGER NOT NULL DEFAULT 0,
    line_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'imported',
    note TEXT NOT NULL DEFAULT '',
    meta TEXT NOT NULL DEFAULT '{}',
    owner TEXT NOT NULL DEFAULT '',
    net TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_pipe_datasets_owner ON pipeline_datasets(owner, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_pipe_datasets_deleted ON pipeline_datasets(deleted_at);

  CREATE TABLE IF NOT EXISTS pipe_nodes (
    id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL,
    node_code TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    x REAL,
    y REAL,
    ground_elev REAL,
    z REAL,
    cover_depth REAL,
    cover_material TEXT NOT NULL DEFAULT '',
    cover_size TEXT NOT NULL DEFAULT '',
    chamber_shape TEXT NOT NULL DEFAULT '',
    chamber_size TEXT NOT NULL DEFAULT '',
    road TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    owner TEXT NOT NULL DEFAULT '',
    build_year TEXT NOT NULL DEFAULT '',
    survey_date TEXT NOT NULL DEFAULT '',
    survey_unit TEXT NOT NULL DEFAULT '',
    angle REAL,
    status TEXT NOT NULL DEFAULT '',
    attrs TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_pipe_nodes_dataset ON pipe_nodes(dataset_id, deleted_at);
  CREATE INDEX IF NOT EXISTS idx_pipe_nodes_code ON pipe_nodes(dataset_id, node_code);

  CREATE TABLE IF NOT EXISTS pipe_lines (
    id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL,
    line_code TEXT NOT NULL DEFAULT '',
    node_start TEXT NOT NULL DEFAULT '',
    node_end TEXT NOT NULL DEFAULT '',
    pipe_major TEXT NOT NULL DEFAULT '',
    material TEXT NOT NULL DEFAULT '',
    profile_type TEXT NOT NULL DEFAULT '',
    profile_size TEXT NOT NULL DEFAULT '',
    wall_thickness TEXT NOT NULL DEFAULT '',
    bury_type TEXT NOT NULL DEFAULT '',
    start_depth REAL,
    end_depth REAL,
    start_elev REAL,
    end_elev REAL,
    flow_dir TEXT NOT NULL DEFAULT '-1',
    length REAL,
    hole_count INTEGER NOT NULL DEFAULT 0,
    cab_count INTEGER NOT NULL DEFAULT 0,
    pressure TEXT NOT NULL DEFAULT '',
    voltage TEXT NOT NULL DEFAULT '',
    owner TEXT NOT NULL DEFAULT '',
    road TEXT NOT NULL DEFAULT '',
    build_year TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT '',
    line_style TEXT NOT NULL DEFAULT '',
    geom TEXT NOT NULL DEFAULT '',
    attrs TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_pipe_lines_dataset ON pipe_lines(dataset_id, deleted_at);
  CREATE INDEX IF NOT EXISTS idx_pipe_lines_major ON pipe_lines(dataset_id, pipe_major);

  CREATE TABLE IF NOT EXISTS pipe_topology (
    id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    neighbor_node_id TEXT NOT NULL,
    line_id TEXT NOT NULL DEFAULT '',
    pipe_major TEXT NOT NULL DEFAULT '',
    directed INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_pipe_topology_node ON pipe_topology(dataset_id, node_id);

  CREATE TABLE IF NOT EXISTS pipe_check_issues (
    id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL,
    issue_type TEXT NOT NULL DEFAULT '',
    severity TEXT NOT NULL DEFAULT '中',
    node_id TEXT NOT NULL DEFAULT '',
    line_id TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL DEFAULT '',
    resolved INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pipe_issues_dataset ON pipe_check_issues(dataset_id, resolved);

  -- 专业分析结果：断面/净距/碰撞/开挖，参数与结果整体留档，供报告与追溯复用。
  CREATE TABLE IF NOT EXISTS pipe_analysis_runs (
    id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL,
    analysis_type TEXT NOT NULL,
    params TEXT NOT NULL DEFAULT '{}',
    result TEXT NOT NULL DEFAULT '{}',
    summary TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'done',
    owner TEXT NOT NULL DEFAULT '',
    net TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    deleted_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_pipe_analysis_dataset ON pipe_analysis_runs(dataset_id, analysis_type, created_at DESC);
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

// 审计与审批决策：补 user_id，支撑按账号隔离的本人历史读取。
for (const sql of [
  "ALTER TABLE audit ADD COLUMN user_id TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE approval_decisions ADD COLUMN user_id TEXT NOT NULL DEFAULT ''",
  'ALTER TABLE image_layers ADD COLUMN rotation REAL NOT NULL DEFAULT 0',
  "ALTER TABLE pipeline_datasets ADD COLUMN meta TEXT NOT NULL DEFAULT '{}'",
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
    INSERT INTO audit (time, actor, action, object, result, net, user_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),
  latestAudit: db.prepare('SELECT time, actor, action, object, result, net, user_id FROM audit ORDER BY id DESC LIMIT ?'),
  countAudit: db.prepare('SELECT COUNT(*) AS count FROM audit'),
  clearAudit: db.prepare('DELETE FROM audit'),
  insertApprovalDecision: db.prepare(`
    INSERT INTO approval_decisions (
      decision_id, conversation_id, call_id, tool, operation, args_summary,
      decision, rule, risk, actor, approver, net, user_id, time, created_at, decided_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
           decision, rule, risk, actor, approver, net, user_id, time, created_at, decided_at
    FROM approval_decisions ORDER BY id DESC LIMIT ?
  `),
  expirePendingApprovalDecisions: db.prepare(`
    UPDATE approval_decisions
    SET decision = 'expired', approver = ?, decided_at = ?
    WHERE decision = 'pending'
  `),
  listAuditMissingUser: db.prepare("SELECT id, actor FROM audit WHERE user_id = '' AND actor != ''"),
  listApprovalMissingUser: db.prepare("SELECT id, actor FROM approval_decisions WHERE user_id = '' AND actor != ''"),
  setAuditUserId: db.prepare('UPDATE audit SET user_id = ? WHERE id = ?'),
  setApprovalUserId: db.prepare('UPDATE approval_decisions SET user_id = ? WHERE id = ?'),
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
  insertImageLayer: db.prepare(`
    INSERT INTO image_layers (
      id, asset_id, owner, net, kind, z_order, name, file_id, box, visible, opacity,
      blend_mode, locked, rotation, provider, model, model_id, description, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  getImageLayer: db.prepare('SELECT * FROM image_layers WHERE id = ?'),
  listImageLayers: db.prepare('SELECT * FROM image_layers WHERE asset_id = ? AND deleted_at IS NULL ORDER BY z_order ASC, created_at ASC'),
  updateImageLayerMeta: db.prepare(`
    UPDATE image_layers SET
      name = ?, box = ?, visible = ?, opacity = ?, blend_mode = ?, locked = ?, rotation = ?, z_order = ?, description = ?, updated_at = ?
    WHERE id = ? AND deleted_at IS NULL
  `),
  softDeleteImageLayer: db.prepare('UPDATE image_layers SET deleted_at = ?, updated_at = ? WHERE id = ? AND owner = ? AND deleted_at IS NULL'),
  deleteImageLayersByAsset: db.prepare('UPDATE image_layers SET deleted_at = ?, updated_at = ? WHERE asset_id = ? AND deleted_at IS NULL'),
  insertImageTemplate: db.prepare(`
    INSERT INTO image_templates (
      id, title, category, ratio, prompt, description, preview_file_id, source_asset_id,
      applicant, status, reviewer, review_note, created_at, reviewed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  getImageTemplate: db.prepare('SELECT * FROM image_templates WHERE id = ?'),
  listApprovedImageTemplates: db.prepare("SELECT * FROM image_templates WHERE status = 'approved' ORDER BY reviewed_at DESC, created_at DESC"),
  listImageTemplatesByApplicant: db.prepare('SELECT * FROM image_templates WHERE applicant = ? ORDER BY created_at DESC'),
  listAllImageTemplates: db.prepare('SELECT * FROM image_templates ORDER BY created_at DESC'),
  reviewImageTemplate: db.prepare(`
    UPDATE image_templates SET status = ?, reviewer = ?, review_note = ?, reviewed_at = ?
    WHERE id = ? AND status = 'pending'
  `),
  offlineImageTemplate: db.prepare(`
    UPDATE image_templates SET status = 'offline', reviewer = ?, review_note = ?, reviewed_at = ?
    WHERE id = ? AND status = 'approved'
  `),
  publishImageTemplate: db.prepare(`
    UPDATE image_templates SET status = 'approved', reviewer = ?, review_note = '', reviewed_at = ?
    WHERE id = ? AND status = 'offline'
  `),
  deleteImageTemplate: db.prepare('DELETE FROM image_templates WHERE id = ?'),

  insertPipelineDataset: db.prepare(`
    INSERT INTO pipeline_datasets (
      id, name, source_file, crs, datum, pipe_major, point_count, line_count,
      status, note, meta, owner, net, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  getPipelineDataset: db.prepare('SELECT * FROM pipeline_datasets WHERE id = ?'),
  listPipelineDatasets: db.prepare(`
    SELECT * FROM pipeline_datasets
    WHERE owner = ? AND deleted_at IS NULL
    ORDER BY updated_at DESC LIMIT ?
  `),
  softDeletePipelineDataset: db.prepare(`
    UPDATE pipeline_datasets SET deleted_at = ?, updated_at = ?
    WHERE id = ? AND owner = ? AND deleted_at IS NULL
  `),
  updatePipelineDatasetCounts: db.prepare(`
    UPDATE pipeline_datasets SET point_count = ?, line_count = ?, updated_at = ? WHERE id = ?
  `),
  updatePipelineDatasetMeta: db.prepare(`
    UPDATE pipeline_datasets SET meta = ?, status = ?, note = ?, updated_at = ? WHERE id = ?
  `),

  insertPipeNode: db.prepare(`
    INSERT INTO pipe_nodes (
      id, dataset_id, node_code, category, x, y, ground_elev, z, cover_depth,
      cover_material, cover_size, chamber_shape, chamber_size, road, address, owner,
      build_year, survey_date, survey_unit, angle, status, attrs, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  getPipeNode: db.prepare('SELECT * FROM pipe_nodes WHERE id = ? AND deleted_at IS NULL'),
  listPipeNodes: db.prepare(`
    SELECT * FROM pipe_nodes
    WHERE dataset_id = ? AND deleted_at IS NULL
    ORDER BY rowid LIMIT ?
  `),
  countPipeNodes: db.prepare('SELECT COUNT(*) AS n FROM pipe_nodes WHERE dataset_id = ? AND deleted_at IS NULL'),
  deletePipeNodesByDataset: db.prepare('DELETE FROM pipe_nodes WHERE dataset_id = ?'),

  insertPipeLine: db.prepare(`
    INSERT INTO pipe_lines (
      id, dataset_id, line_code, node_start, node_end, pipe_major, material, profile_type,
      profile_size, wall_thickness, bury_type, start_depth, end_depth, start_elev, end_elev,
      flow_dir, length, hole_count, cab_count, pressure, voltage, owner, road, build_year,
      status, line_style, geom, attrs, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  getPipeLine: db.prepare('SELECT * FROM pipe_lines WHERE id = ? AND deleted_at IS NULL'),
  listPipeLines: db.prepare(`
    SELECT * FROM pipe_lines
    WHERE dataset_id = ? AND deleted_at IS NULL
    ORDER BY rowid LIMIT ?
  `),
  countPipeLines: db.prepare('SELECT COUNT(*) AS n FROM pipe_lines WHERE dataset_id = ? AND deleted_at IS NULL'),
  deletePipeLinesByDataset: db.prepare('DELETE FROM pipe_lines WHERE dataset_id = ?'),

  deletePipeTopologyByDataset: db.prepare('DELETE FROM pipe_topology WHERE dataset_id = ?'),
  insertPipeTopology: db.prepare(`
    INSERT INTO pipe_topology (id, dataset_id, node_id, neighbor_node_id, line_id, pipe_major, directed)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  listPipeTopology: db.prepare('SELECT * FROM pipe_topology WHERE dataset_id = ? ORDER BY node_id'),

  insertPipeIssue: db.prepare(`
    INSERT INTO pipe_check_issues (id, dataset_id, issue_type, severity, node_id, line_id, message, resolved, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  listPipeIssues: db.prepare(`
    SELECT * FROM pipe_check_issues
    WHERE dataset_id = ? AND (? = -1 OR resolved = ?)
    ORDER BY created_at DESC LIMIT ?
  `),
  resolvePipeIssue: db.prepare('UPDATE pipe_check_issues SET resolved = 1 WHERE id = ?'),
  deletePipeIssuesByDataset: db.prepare('DELETE FROM pipe_check_issues WHERE dataset_id = ?'),

  insertPipeAnalysisRun: db.prepare(`
    INSERT INTO pipe_analysis_runs (
      id, dataset_id, analysis_type, params, result, summary, status, owner, net, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  getPipeAnalysisRun: db.prepare('SELECT * FROM pipe_analysis_runs WHERE id = ? AND deleted_at IS NULL'),
  listPipeAnalysisRuns: db.prepare(`
    SELECT * FROM pipe_analysis_runs
    WHERE dataset_id = ? AND (? = '' OR analysis_type = ?) AND deleted_at IS NULL
    ORDER BY created_at DESC LIMIT ?
  `),
  softDeletePipeAnalysisRun: db.prepare('UPDATE pipe_analysis_runs SET deleted_at = ? WHERE id = ? AND owner = ?'),

  deleteDriveChunks: db.prepare('DELETE FROM drive_index_chunks WHERE item_id = ?'),
  insertDriveChunk: db.prepare('INSERT INTO drive_index_chunks (item_id, chunk_no, content, updated_at) VALUES (?, ?, ?, ?)'),
  getDriveChunk: db.prepare('SELECT content FROM drive_index_chunks WHERE item_id = ? AND chunk_no = ?'),
  deleteDriveFts: db.prepare('DELETE FROM drive_fts WHERE item_id = ?'),
  insertDriveFts: db.prepare('INSERT INTO drive_fts (item_id, chunk_no, tokens) VALUES (?, ?, ?)'),
  searchDriveFts: db.prepare('SELECT item_id, chunk_no, bm25(drive_fts) AS score FROM drive_fts WHERE drive_fts MATCH ? ORDER BY score LIMIT ?'),
  upsertDriveIndexMeta: db.prepare(`
    INSERT INTO drive_index_meta (item_id, file_id, status, chunk_count, error, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(item_id) DO UPDATE SET
      file_id = excluded.file_id,
      status = excluded.status,
      chunk_count = excluded.chunk_count,
      error = excluded.error,
      updated_at = excluded.updated_at
  `),
  getDriveIndexMeta: db.prepare('SELECT * FROM drive_index_meta WHERE item_id = ?'),
  listDriveIndexMeta: db.prepare('SELECT * FROM drive_index_meta ORDER BY updated_at DESC'),
  deleteDriveIndexMeta: db.prepare('DELETE FROM drive_index_meta WHERE item_id = ?'),

  insertDriveSearchLog: db.prepare(`
    INSERT INTO drive_search_logs (id, user, space, query, mode, total, items_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),
  insertDriveSearchClick: db.prepare(`
    INSERT OR IGNORE INTO drive_search_clicks (id, search_id, user, item_id, position, action, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  getDriveSearchLog: db.prepare('SELECT * FROM drive_search_logs WHERE id = ?'),
  listDriveSearchLogs: db.prepare('SELECT * FROM drive_search_logs WHERE created_at >= ? ORDER BY created_at DESC LIMIT ?'),
  listDriveSearchClicks: db.prepare('SELECT * FROM drive_search_clicks WHERE created_at >= ? ORDER BY created_at DESC LIMIT ?'),
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
    String(entry.userId || ''),
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
    userId: row.user_id || '',
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
    String(entry.userId || ''),
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
    userId: row.user_id || '',
    time: row.time,
    createdAt: row.created_at,
    decidedAt: row.decided_at || 0,
  }))
}

export function expirePendingApprovalDecisions(approver = 'system-restart') {
  stmt.expirePendingApprovalDecisions.run(String(approver), Date.now())
}

/* 旧记录回填：审计/审批决策中无 user_id 的行，按操作人姓名或用户名匹配账号后回填；
   匹配不到的保持空字符串，不臆造归属。仅启动时执行一次。 */
export function backfillActorUserIds() {
  const byName = new Map()
  const byUser = new Map()
  for (const row of stmt.listAccounts.all()) {
    if (row.name) byName.set(String(row.name).trim(), row.id)
    if (row.username) byUser.set(String(row.username).trim().toLowerCase(), row.id)
  }
  const match = (actor) => {
    const a = String(actor || '').trim()
    if (!a) return ''
    return byName.get(a) || byUser.get(a.toLowerCase()) || ''
  }
  let auditN = 0
  let approvalN = 0
  for (const r of stmt.listAuditMissingUser.all()) {
    const uid = match(r.actor)
    if (uid) { stmt.setAuditUserId.run(uid, r.id); auditN += 1 }
  }
  for (const r of stmt.listApprovalMissingUser.all()) {
    const uid = match(r.actor)
    if (uid) { stmt.setApprovalUserId.run(uid, r.id); approvalN += 1 }
  }
  return { audit: auditN, approval: approvalN }
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

/* ------------------------------ memories -------------------------------- */

function memoryNormalize(text = '') {
  return String(text || '')
    .toLowerCase()
    .replace(/[\s\u3000]+/g, '')
    .replace(/[，。！？、；：""''（）()\[\]{}<>《》\-—…·,.!?;:'"()]/g, '')
    .slice(0, 400)
}

function memoryMeta(row) {
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    scope: row.scope,
    scopeRef: row.scope_ref || '',
    text: row.text,
    tags: row.tags ? row.tags.split(',').filter(Boolean) : [],
    sourceConversationId: row.source_conversation_id || '',
    sourceMessageId: row.source_message_id || '',
    confidence: Number(row.confidence),
    pinned: Boolean(row.pinned),
    status: row.status,
    hasEmbedding: Boolean(row.embedding),
    embeddingModel: row.embedding_model || '',
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    lastUsedAt: Number(row.last_used_at || 0),
    useCount: Number(row.use_count || 0),
  }
}

const memorySql = {
  getById: db.prepare('SELECT * FROM memories WHERE id = ? AND user_id = ?'),
  getByNormalized: db.prepare('SELECT * FROM memories WHERE user_id = ? AND normalized = ?'),
  insert: db.prepare(`
    INSERT INTO memories (id, user_id, kind, scope, scope_ref, text, normalized, tags, source_conversation_id, source_message_id, confidence, pinned, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    ON CONFLICT(user_id, normalized) DO UPDATE SET
      text = excluded.text, kind = excluded.kind, scope = excluded.scope, scope_ref = excluded.scope_ref,
      tags = excluded.tags, confidence = excluded.confidence, pinned = MAX(memories.pinned, excluded.pinned),
      status = 'active', updated_at = excluded.updated_at
  `),
  listByUser: db.prepare("SELECT * FROM memories WHERE user_id = ? AND status = 'active' ORDER BY pinned DESC, updated_at DESC LIMIT ?"),
  search: db.prepare("SELECT * FROM memories WHERE user_id = ? AND status = 'active' AND (text LIKE ? OR tags LIKE ?) ORDER BY pinned DESC, updated_at DESC LIMIT ?"),
  archive: db.prepare("UPDATE memories SET status = 'archived', updated_at = ? WHERE id = ? AND user_id = ?"),
  remove: db.prepare('DELETE FROM memories WHERE id = ? AND user_id = ?'),
  touch: db.prepare('UPDATE memories SET last_used_at = ?, use_count = use_count + 1 WHERE id = ?'),
  setEmbedding: db.prepare('UPDATE memories SET embedding = ?, embedding_model = ? WHERE id = ? AND user_id = ?'),
  listEmbeddings: db.prepare("SELECT id, embedding FROM memories WHERE user_id = ? AND status = 'active' ORDER BY updated_at DESC LIMIT ?"),
  count: db.prepare("SELECT COUNT(*) AS count FROM memories WHERE user_id = ? AND status = 'active'"),
}

/**
 * 写入或更新一条长期记忆（按用户 + 规范化文本去重）。
 * 返回 { item, created }，created 表示是否新建。
 */
export function upsertMemory(input = {}) {
  const userId = String(input.userId || '').trim()
  const text = String(input.text || '').trim().slice(0, 400)
  if (!userId || !text) throw new Error('memory 需要 userId 与 text')
  const normalized = memoryNormalize(text)
  const existing = memorySql.getByNormalized.get(userId, normalized)
  const now = Date.now()
  const id = existing?.id || `MEM-${randomBytes(8).toString('hex')}`
  memorySql.insert.run(
    id,
    userId,
    ['preference', 'fact', 'decision', 'entity', 'task'].includes(String(input.kind || '')) ? String(input.kind) : 'fact',
    input.scope === 'project' || input.scope === 'conversation' ? input.scope : 'global',
    String(input.scopeRef || '').slice(0, 120),
    text,
    normalized,
    Array.isArray(input.tags) ? input.tags.map((x) => String(x).trim()).filter(Boolean).slice(0, 8).join(',') : String(input.tags || '').slice(0, 200),
    String(input.sourceConversationId || '').slice(0, 80),
    String(input.sourceMessageId || '').slice(0, 120),
    Math.min(1, Math.max(0, Number(input.confidence ?? 0.8))),
    input.pinned ? 1 : 0,
    existing?.created_at || now,
    now
  )
  return { item: memoryMeta(memorySql.getById.get(id, userId)), created: !existing }
}

export function getMemory(userId, id) {
  return memoryMeta(memorySql.getById.get(String(userId || ''), String(id || '')))
}

export function listMemories({ userId = '', q = '', limit = 100 } = {}) {
  const max = Math.min(500, Math.max(1, Number(limit) || 100))
  if (String(q || '').trim()) {
    const like = `%${String(q).trim().slice(0, 60)}%`
    return memorySql.search.all(String(userId), like, like, max).map(memoryMeta)
  }
  return memorySql.listByUser.all(String(userId), max).map(memoryMeta)
}

export function listActiveMemories(userId, limit = 500) {
  const max = Math.min(2000, Math.max(1, Number(limit) || 500))
  return memorySql.listByUser.all(String(userId), max).map(memoryMeta)
}

export function touchMemories(ids = []) {
  const now = Date.now()
  for (const id of ids.slice(0, 20)) memorySql.touch.run(now, String(id))
}

export function archiveMemory(userId, id) {
  const info = memorySql.archive.run(Date.now(), String(id || ''), String(userId || ''))
  return info.changes > 0
}

export function deleteMemory(userId, id) {
  const info = memorySql.remove.run(String(id || ''), String(userId || ''))
  return info.changes > 0
}

export function setMemoryEmbedding(userId, id, embedding, model = '') {
  memorySql.setEmbedding.run(JSON.stringify(embedding || []), String(model || ''), String(id || ''), String(userId || ''))
}

export function listMemoryEmbeddings(userId, limit = 600) {
  const max = Math.min(2000, Math.max(1, Number(limit) || 600))
  const rows = memorySql.listEmbeddings.all(String(userId || ''), max)
  return rows.map((row) => {
    let vec = null
    try { vec = row.embedding ? JSON.parse(row.embedding) : null } catch { vec = null }
    return { id: row.id, embedding: Array.isArray(vec) && vec.length ? vec : null }
  })
}

export function memoryCount(userId) {
  return Number(memorySql.count.get(String(userId || ''))?.count || 0)
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

/* ------------------------- drive full-text index ------------------------- */

function driveIndexMetaOf(row) {
  if (!row) return null
  return {
    itemId: row.item_id,
    fileId: row.file_id || '',
    status: row.status || 'pending',
    chunkCount: Number(row.chunk_count || 0),
    error: row.error || '',
    updatedAt: Number(row.updated_at || 0),
  }
}

export function setDriveIndexStatus(itemId, { fileId = '', status = 'pending', chunkCount = 0, error = '' } = {}) {
  const id = String(itemId || '')
  if (!id) return null
  stmt.upsertDriveIndexMeta.run(id, String(fileId || ''), String(status || 'pending'), Math.max(0, Number(chunkCount) || 0), String(error || '').slice(0, 400), Date.now())
  return driveIndexMetaOf(stmt.getDriveIndexMeta.get(id))
}

export function getDriveIndexMeta(itemId) {
  return driveIndexMetaOf(stmt.getDriveIndexMeta.get(String(itemId || '')))
}

export function listDriveIndexMeta() {
  return stmt.listDriveIndexMeta.all().map(driveIndexMetaOf).filter(Boolean)
}

/**
 * 原子替换一个云空间条目的正文索引。chunks 每项为 { content, tokens }。
 * 失败时保留旧索引并抛出异常，避免搜索命中半成品。
 */
export function replaceDriveIndex(itemId, fileId, chunks = []) {
  const id = String(itemId || '')
  if (!id) throw new Error('drive index requires itemId')
  const prepared = chunks.map((chunk) => ({
    content: String(chunk?.content || ''),
    tokens: String(chunk?.tokens || '').trim(),
  })).filter((chunk) => chunk.content && chunk.tokens)
  const now = Date.now()
  db.exec('BEGIN IMMEDIATE')
  try {
    stmt.deleteDriveChunks.run(id)
    stmt.deleteDriveFts.run(id)
    prepared.forEach((chunk, index) => {
      stmt.insertDriveChunk.run(id, index, chunk.content, now)
      stmt.insertDriveFts.run(id, index, chunk.tokens)
    })
    stmt.upsertDriveIndexMeta.run(id, String(fileId || ''), prepared.length ? 'ready' : 'empty', prepared.length, '', now)
    db.exec('COMMIT')
  } catch (error) {
    try { db.exec('ROLLBACK') } catch { /* ignore rollback failure */ }
    throw error
  }
  return driveIndexMetaOf(stmt.getDriveIndexMeta.get(id))
}

export function deleteDriveIndex(itemId) {
  const id = String(itemId || '')
  if (!id) return false
  db.exec('BEGIN IMMEDIATE')
  try {
    stmt.deleteDriveChunks.run(id)
    stmt.deleteDriveFts.run(id)
    stmt.deleteDriveIndexMeta.run(id)
    db.exec('COMMIT')
  } catch (error) {
    try { db.exec('ROLLBACK') } catch { /* ignore rollback failure */ }
    throw error
  }
  return true
}

export function searchDriveIndex(match, limit = 80) {
  const query = String(match || '').trim()
  if (!query) return []
  const max = Math.min(200, Math.max(1, Number(limit) || 80))
  return stmt.searchDriveFts.all(query, max).map((row) => ({
    itemId: row.item_id,
    chunkNo: Number(row.chunk_no || 0),
    score: Number(row.score || 0),
  }))
}

export function getDriveIndexChunk(itemId, chunkNo) {
  const row = stmt.getDriveChunk.get(String(itemId || ''), Number(chunkNo) || 0)
  return row ? String(row.content || '') : ''
}

/* --------------------- drive search telemetry --------------------- */

export function logDriveSearch({ id, user, space = '', query = '', mode = 'all', total = 0, items = [] } = {}) {
  const searchId = String(id || '')
  if (!searchId) return null
  const payload = (Array.isArray(items) ? items : []).slice(0, 40).map((item, index) => ({
    itemId: String(item.itemId || item.id || ''),
    name: String(item.name || '').slice(0, 160),
    position: index + 1,
    matchedBy: String(item.matchedBy || ''),
    rankReason: String(item.rankReason || ''),
    rankCode: String(item.rankCode || ''),
    rankScore: Number(item.rankScore || 0),
    matchedChunks: Number(item.matchedChunks || 0),
    duplicateCount: Number(item.duplicateCount || 0),
    features: item.features || null,
  })).filter((item) => item.itemId)
  const now = Date.now()
  stmt.insertDriveSearchLog.run(
    searchId,
    String(user || ''),
    String(space || ''),
    String(query || '').slice(0, 200),
    String(mode || 'all'),
    Math.max(0, Number(total) || 0),
    JSON.stringify(payload),
    now,
  )
  return searchId
}

export function getDriveSearchLog(id) {
  const row = stmt.getDriveSearchLog.get(String(id || ''))
  if (!row) return null
  let items = []
  try { items = JSON.parse(row.items_json || '[]') } catch { items = [] }
  return {
    id: row.id,
    user: row.user,
    space: row.space,
    query: row.query,
    mode: row.mode,
    total: Number(row.total || 0),
    items,
    createdAt: Number(row.created_at || 0),
  }
}

export function logDriveSearchClick({ id, searchId, user, itemId, position = 0, action = 'open' } = {}) {
  const clickId = String(id || '')
  const sid = String(searchId || '')
  if (!clickId || !sid) return false
  const result = stmt.insertDriveSearchClick.run(
    clickId,
    sid,
    String(user || ''),
    String(itemId || ''),
    Math.max(0, Number(position) || 0),
    String(action || 'open').slice(0, 40),
    Date.now(),
  )
  return Number(result.changes || 0) > 0
}

export function getDriveSearchAnalytics({ days = 30, limit = 3000 } = {}) {
  const windowDays = Math.min(365, Math.max(1, Number(days) || 30))
  const since = Date.now() - windowDays * 86400000
  const logLimit = Math.min(10000, Math.max(1, Number(limit) || 3000))
  const logs = stmt.listDriveSearchLogs.all(since, logLimit).map((row) => {
    let items = []
    try { items = JSON.parse(row.items_json || '[]') } catch { items = [] }
    return { ...row, items }
  })
  const clicks = stmt.listDriveSearchClicks.all(since, Math.min(20000, logLimit * 3)).map((row) => ({
    ...row,
    position: Number(row.position || 0),
    createdAt: Number(row.created_at || 0),
  }))
  const clicksBySearch = new Map()
  for (const click of clicks) {
    const list = clicksBySearch.get(click.search_id) || []
    list.push(click)
    clicksBySearch.set(click.search_id, list)
  }
  const itemsBySearch = new Map(logs.map((log) => [
    log.id,
    new Map(log.items.map((item) => [item.itemId, item])),
  ]))
  const positions = new Map()
  const matched = new Map()
  const reasons = new Map()
  const queries = new Map()
  const clickedItems = new Map()
  let searchClicks = 0
  let searchesWithClick = 0
  let noResult = 0
  for (const log of logs) {
    const logClicks = clicksBySearch.get(log.id) || []
    searchClicks += logClicks.length
    if (logClicks.length) searchesWithClick += 1
    if (!Number(log.total || 0)) noResult += 1
    for (const item of log.items) {
      const p = positions.get(item.position || 0) || { position: item.position || 0, shown: 0, clicks: 0 }
      p.shown += 1
      positions.set(p.position, p)
      const m = matched.get(item.matchedBy || 'unknown') || { key: item.matchedBy || 'unknown', shown: 0, clicks: 0 }
      m.shown += 1
      matched.set(m.key, m)
      const r = reasons.get(item.rankCode || item.rankReason || 'unknown') || { key: item.rankCode || item.rankReason || 'unknown', shown: 0, clicks: 0 }
      r.shown += 1
      reasons.set(r.key, r)
    }
    const q = queries.get(log.query) || { query: log.query, searches: 0, clicks: 0, noResult: 0 }
    q.searches += 1
    q.clicks += logClicks.length
    if (!Number(log.total || 0)) q.noResult += 1
    queries.set(log.query, q)
    for (const click of logClicks) {
      const item = itemsBySearch.get(log.id)?.get(click.item_id)
      if (!item) continue
      const p = positions.get(item.position) || { position: item.position, shown: 0, clicks: 0 }
      p.clicks += 1
      positions.set(p.position, p)
      const m = matched.get(item.matchedBy || 'unknown') || { key: item.matchedBy || 'unknown', shown: 0, clicks: 0 }
      m.clicks += 1
      matched.set(m.key, m)
      const r = reasons.get(item.rankCode || item.rankReason || 'unknown') || { key: item.rankCode || item.rankReason || 'unknown', shown: 0, clicks: 0 }
      r.clicks += 1
      reasons.set(r.key, r)
      const ci = clickedItems.get(item.itemId) || {
        itemId: item.itemId, name: item.name, clicks: 0, bestPosition: item.position,
        matchedBy: item.matchedBy, rankCode: item.rankCode,
      }
      ci.clicks += 1
      ci.bestPosition = Math.min(ci.bestPosition || item.position, item.position)
      clickedItems.set(item.itemId, ci)
    }
  }
  const rate = (clicks, shown) => shown ? Math.round((clicks / shown) * 10000) / 10000 : 0
  return {
    days: windowDays,
    since,
    searches: logs.length,
    clicks: searchClicks,
    searchesWithClick,
    searchCtr: rate(searchesWithClick, logs.length),
    clicksPerSearch: logs.length ? Math.round((searchClicks / logs.length) * 10000) / 10000 : 0,
    noResult,
    noResultRate: rate(noResult, logs.length),
    users: new Set(logs.map((log) => log.user)).size,
    positions: [...positions.values()].sort((a, b) => a.position - b.position).map((p) => ({ ...p, ctr: rate(p.clicks, p.shown) })),
    matchedBy: [...matched.values()].map((m) => ({ ...m, ctr: rate(m.clicks, m.shown) })),
    rankCodes: [...reasons.values()].sort((a, b) => b.shown - a.shown).map((r) => ({ ...r, ctr: rate(r.clicks, r.shown) })),
    topQueries: [...queries.values()].sort((a, b) => b.searches - a.searches || b.clicks - a.clicks).slice(0, 30).map((q) => ({ ...q, ctr: rate(q.clicks, q.searches) })),
    topClickedItems: [...clickedItems.values()].sort((a, b) => b.clicks - a.clicks).slice(0, 20),
    recentSearches: logs.slice(0, 20).map((log) => ({
      id: log.id,
      query: log.query,
      total: Number(log.total || 0),
      clicks: (clicksBySearch.get(log.id) || []).length,
      createdAt: Number(log.created_at || 0),
    })),
  }
}

/* 给后续人工/离线调权重用的原始样本：每次搜索的展示特征 + 用户实际点开的条目。 */
export function getDriveSearchTraining({ days = 30, limit = 500 } = {}) {
  const windowDays = Math.min(365, Math.max(1, Number(days) || 30))
  const since = Date.now() - windowDays * 86400000
  const logLimit = Math.min(5000, Math.max(1, Number(limit) || 500))
  const logs = stmt.listDriveSearchLogs.all(since, logLimit).map((row) => {
    let items = []
    try { items = JSON.parse(row.items_json || '[]') } catch { items = [] }
    return { ...row, items }
  })
  const clicks = stmt.listDriveSearchClicks.all(since, Math.min(20000, logLimit * 3))
  const clickedBySearch = new Map()
  for (const click of clicks) {
    const set = clickedBySearch.get(click.search_id) || new Set()
    set.add(click.item_id)
    clickedBySearch.set(click.search_id, set)
  }
  return {
    days: windowDays,
    searches: logs.map((log) => {
      const clicked = clickedBySearch.get(log.id) || new Set()
      return {
        searchId: log.id,
        user: log.user,
        space: log.space,
        query: log.query,
        mode: log.mode,
        total: Number(log.total || 0),
        createdAt: Number(log.created_at || 0),
        clickedItemIds: [...clicked],
        items: log.items.map((item) => ({
          position: item.position,
          itemId: item.itemId,
          name: item.name,
          matchedBy: item.matchedBy,
          rankCode: item.rankCode,
          rankScore: item.rankScore,
          matchedChunks: item.matchedChunks,
          duplicateCount: item.duplicateCount,
          features: item.features,
          clicked: clicked.has(item.itemId),
        })),
      }
    }),
  }
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

/** 供成本汇总读取：每个图像版本连同其 params（含落库成本）与资产归属。 */
export function listImageRevisionCosts(owner = '') {
  const rows = db.prepare(`
    SELECT r.asset_id AS assetId, r.revision, r.model_id AS modelId, r.model,
           r.params, r.created_at AS createdAt, a.owner AS owner
    FROM image_revisions r
    LEFT JOIN image_assets a ON a.id = r.asset_id
    ORDER BY r.created_at ASC
  `).all()
  const normalizedOwner = String(owner || '')
  return normalizedOwner ? rows.filter((row) => String(row.owner || '') === normalizedOwner) : rows
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

function imageLayerOf(row) {
  if (!row) return null
  let box = {}
  try { box = JSON.parse(row.box || '{}') } catch { box = {} }
  return {
    id: row.id,
    assetId: row.asset_id,
    owner: row.owner,
    net: row.net,
    kind: row.kind,
    zOrder: Number(row.z_order),
    name: row.name,
    fileId: row.file_id,
    box,
    visible: Number(row.visible) === 1,
    opacity: Number(row.opacity),
    blendMode: row.blend_mode,
    locked: Number(row.locked) === 1,
    rotation: Number(row.rotation || 0),
    provider: row.provider,
    model: row.model,
    modelId: row.model_id,
    description: row.description,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    deletedAt: row.deleted_at == null ? null : Number(row.deleted_at),
  }
}

export function createImageLayer(input = {}) {
  const now = Number(input.createdAt || Date.now())
  const id = String(input.id || '')
  const box = typeof input.box === 'string' ? input.box : JSON.stringify(input.box || {})
  stmt.insertImageLayer.run(
    id,
    String(input.assetId || ''),
    String(input.owner || ''),
    String(input.net || ''),
    String(input.kind || 'layer'),
    Number(input.zOrder || 1),
    String(input.name || ''),
    String(input.fileId || ''),
    box,
    input.visible === false ? 0 : 1,
    Number(input.opacity == null ? 100 : input.opacity),
    String(input.blendMode || 'normal'),
    input.locked === true ? 1 : 0,
    Number(input.rotation || 0),
    String(input.provider || ''),
    String(input.model || ''),
    String(input.modelId || ''),
    String(input.description || ''),
    now,
    now
  )
  return imageLayerOf(stmt.getImageLayer.get(id))
}

export function getImageLayer(id) {
  return imageLayerOf(stmt.getImageLayer.get(String(id || '')))
}

export function listImageLayers(assetId) {
  return stmt.listImageLayers.all(String(assetId || '')).map(imageLayerOf)
}

export function updateImageLayer(id, owner, patch = {}) {
  const current = getImageLayer(id)
  if (!current || current.owner !== String(owner || '') || current.deletedAt != null) return null
  const box = typeof patch.box === 'string' ? patch.box : JSON.stringify(patch.box == null ? current.box : patch.box)
  const result = stmt.updateImageLayerMeta.run(
    String(patch.name == null ? current.name : patch.name),
    box,
    patch.visible == null ? (current.visible ? 1 : 0) : (patch.visible ? 1 : 0),
    Number(patch.opacity == null ? current.opacity : patch.opacity),
    String(patch.blendMode || current.blendMode),
    patch.locked == null ? (current.locked ? 1 : 0) : (patch.locked ? 1 : 0),
    Number(patch.rotation == null ? current.rotation : patch.rotation),
    Number(patch.zOrder == null ? current.zOrder : patch.zOrder),
    String(patch.description == null ? current.description : patch.description),
    Date.now(),
    String(id || '')
  )
  if (!Number(result.changes || 0)) return null
  return getImageLayer(id)
}

export function softDeleteImageLayer(id, owner) {
  const result = stmt.softDeleteImageLayer.run(Date.now(), Date.now(), String(id || ''), String(owner || ''))
  if (!Number(result.changes || 0)) return null
  return true
}

export function deleteImageLayersByAsset(assetId) {
  return stmt.deleteImageLayersByAsset.run(Date.now(), Date.now(), String(assetId || ''))
}

function imageTemplateOf(row) {
  if (!row) return null
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    ratio: row.ratio,
    prompt: row.prompt,
    description: row.description,
    previewFileId: row.preview_file_id,
    sourceAssetId: row.source_asset_id,
    applicant: row.applicant,
    status: row.status,
    reviewer: row.reviewer,
    reviewNote: row.review_note,
    createdAt: Number(row.created_at || 0),
    reviewedAt: row.reviewed_at ? Number(row.reviewed_at) : null,
  }
}

export function createImageTemplate(input = {}) {
  const now = Number(input.createdAt || Date.now())
  const id = String(input.id || '')
  stmt.insertImageTemplate.run(
    id,
    String(input.title || ''),
    String(input.category || ''),
    String(input.ratio || '1:1'),
    String(input.prompt || ''),
    String(input.description || ''),
    String(input.previewFileId || ''),
    String(input.sourceAssetId || ''),
    String(input.applicant || ''),
    String(input.status || 'pending'),
    String(input.reviewer || ''),
    String(input.reviewNote || ''),
    now,
    input.reviewedAt ? Number(input.reviewedAt) : null
  )
  return getImageTemplate(id)
}

export function getImageTemplate(id) {
  return imageTemplateOf(stmt.getImageTemplate.get(String(id || '')))
}

export function listApprovedImageTemplates() {
  return stmt.listApprovedImageTemplates.all().map(imageTemplateOf)
}

export function listImageTemplatesByApplicant(applicant) {
  return stmt.listImageTemplatesByApplicant.all(String(applicant || '')).map(imageTemplateOf)
}

export function listAllImageTemplates() {
  return stmt.listAllImageTemplates.all().map(imageTemplateOf)
}

export function reviewImageTemplate(id, decision, reviewer, note = '') {
  const status = decision === 'approve' ? 'approved' : 'rejected'
  const result = stmt.reviewImageTemplate.run(status, String(reviewer || ''), String(note || ''), Date.now(), String(id || ''))
  if (!Number(result.changes || 0)) return null
  return getImageTemplate(id)
}

export function offlineImageTemplate(id, reviewer, note = '') {
  const result = stmt.offlineImageTemplate.run(String(reviewer || ''), String(note || ''), Date.now(), String(id || ''))
  if (!Number(result.changes || 0)) return null
  return getImageTemplate(id)
}

export function publishImageTemplate(id, reviewer) {
  const result = stmt.publishImageTemplate.run(String(reviewer || ''), Date.now(), String(id || ''))
  if (!Number(result.changes || 0)) return null
  return getImageTemplate(id)
}

export function deleteImageTemplate(id) {
  const result = stmt.deleteImageTemplate.run(String(id || ''))
  return Number(result.changes || 0) > 0
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
  pruneBackupsTiered()
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

/* 分层保留：近期全留，随后每小时留一份，再往后每天留一份。
   默认 12 份近期 + 24 小时 + 7 天，可用 JG_BACKUP_KEEP_RECENT / JG_BACKUP_HOURLY_HOURS / JG_BACKUP_DAILY_DAYS 调整。 */
function backupTimestamp(item) {
  const parsed = Date.parse(item.createdAt || '')
  if (Number.isFinite(parsed) && parsed > 0) return parsed
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/.exec(String(item.name))
  if (!m) return 0
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], +m[7])
}

export function pruneBackupsTiered(options = {}) {
  const recent = Math.max(1, Number(options.recent ?? process.env.JG_BACKUP_KEEP_RECENT ?? 12))
  const hourlyHours = Math.max(0, Number(options.hourlyHours ?? process.env.JG_BACKUP_HOURLY_HOURS ?? 24))
  const dailyDays = Math.max(0, Number(options.dailyDays ?? process.env.JG_BACKUP_DAILY_DAYS ?? 7))
  const now = Number(options.now ?? Date.now())
  const items = listBackups()
  if (items.length <= recent) return { removed: 0, kept: items.length }

  const kept = new Set(items.slice(0, recent).map((item) => item.name))
  const hourKeys = new Set()
  const dayKeys = new Set()
  let removed = 0

  for (const item of items.slice(recent)) {
    const stamp = backupTimestamp(item)
    // 非时间戳目录（如人工放置的其它快照）不参与裁剪，避免误删。
    if (!stamp) continue
    const ageHours = (now - stamp) / 3_600_000
    const hourKey = new Date(stamp).toISOString().slice(0, 13)
    const dayKey = new Date(stamp).toISOString().slice(0, 10)
    let keep = false
    if (ageHours <= hourlyHours && hourKeys.size < hourlyHours) {
      if (!hourKeys.has(hourKey)) {
        hourKeys.add(hourKey)
        keep = true
      }
    } else if (ageHours <= hourlyHours + dailyDays * 24 && dayKeys.size < dailyDays) {
      if (!dayKeys.has(dayKey)) {
        dayKeys.add(dayKey)
        keep = true
      }
    }
    if (keep) {
      kept.add(item.name)
      continue
    }
    const dir = join(backupsDir, item.name)
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true })
      removed += 1
    }
  }
  return { removed, kept: kept.size }
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

/* ------------------------------ 地下管网 ------------------------------ */

function pipelineDatasetOf(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    sourceFile: row.source_file,
    crs: row.crs,
    datum: row.datum,
    pipeMajor: row.pipe_major,
    pointCount: Number(row.point_count),
    lineCount: Number(row.line_count),
    status: row.status,
    note: row.note,
    meta: pipeJson(row.meta, {}),
    owner: row.owner,
    net: row.net,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  }
}

export function createPipelineDataset(input = {}) {
  const now = Number(input.createdAt || Date.now())
  const id = String(input.id || `PIPE-${randomBytes(8).toString('hex')}`)
  stmt.insertPipelineDataset.run(
    id,
    String(input.name || '未命名管网数据集'),
    String(input.sourceFile || ''),
    String(input.crs || ''),
    String(input.datum || ''),
    String(input.pipeMajor || ''),
    Number(input.pointCount || 0),
    Number(input.lineCount || 0),
    String(input.status || 'imported'),
    String(input.note || ''),
    JSON.stringify(input.meta || {}),
    String(input.owner || ''),
    String(input.net || ''),
    now,
    now
  )
  return pipelineDatasetOf(stmt.getPipelineDataset.get(id))
}

export function updatePipelineDatasetMeta(id, { meta, status, note } = {}) {
  const row = stmt.getPipelineDataset.get(String(id || ''))
  if (!row) return null
  stmt.updatePipelineDatasetMeta.run(
    JSON.stringify(meta === undefined ? pipeJson(row.meta, {}) : meta),
    String(status || row.status || 'imported'),
    String(note === undefined ? row.note || '' : note),
    Date.now(),
    String(id || '')
  )
  return pipelineDatasetOf(stmt.getPipelineDataset.get(String(id || '')))
}

export function getPipelineDataset(id) {
  return pipelineDatasetOf(stmt.getPipelineDataset.get(String(id || '')))
}

export function listPipelineDatasets({ owner = '', limit = 50 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 200))
  return stmt.listPipelineDatasets.all(String(owner || ''), safeLimit).map(pipelineDatasetOf)
}

export function softDeletePipelineDataset(id, owner) {
  const row = stmt.getPipelineDataset.get(String(id || ''))
  if (!row) return null
  const result = stmt.softDeletePipelineDataset.run(Date.now(), Date.now(), String(id || ''), String(owner || ''))
  if (!Number(result.changes || 0)) return null
  return pipelineDatasetOf(stmt.getPipelineDataset.get(String(id || '')))
}

export function updatePipelineDatasetCounts(id, pointCount, lineCount) {
  stmt.updatePipelineDatasetCounts.run(Number(pointCount || 0), Number(lineCount || 0), Date.now(), String(id || ''))
  return pipelineDatasetOf(stmt.getPipelineDataset.get(String(id || '')))
}

function pipeNum(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function pipeJson(text, fallback) {
  try { return JSON.parse(text || JSON.stringify(fallback)) } catch { return fallback }
}

function pipeNodeOf(row) {
  if (!row) return null
  return {
    id: row.id,
    datasetId: row.dataset_id,
    nodeCode: row.node_code,
    category: row.category,
    x: pipeNum(row.x),
    y: pipeNum(row.y),
    groundElev: pipeNum(row.ground_elev),
    z: pipeNum(row.z),
    coverDepth: pipeNum(row.cover_depth),
    coverMaterial: row.cover_material,
    coverSize: row.cover_size,
    chamberShape: row.chamber_shape,
    chamberSize: row.chamber_size,
    road: row.road,
    address: row.address,
    owner: row.owner,
    buildYear: row.build_year,
    surveyDate: row.survey_date,
    surveyUnit: row.survey_unit,
    angle: pipeNum(row.angle),
    status: row.status,
    attrs: pipeJson(row.attrs, {}),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  }
}

function pipeLineOf(row) {
  if (!row) return null
  return {
    id: row.id,
    datasetId: row.dataset_id,
    lineCode: row.line_code,
    nodeStart: row.node_start,
    nodeEnd: row.node_end,
    pipeMajor: row.pipe_major,
    material: row.material,
    profileType: row.profile_type,
    profileSize: row.profile_size,
    wallThickness: row.wall_thickness,
    buryType: row.bury_type,
    startDepth: pipeNum(row.start_depth),
    endDepth: pipeNum(row.end_depth),
    startElev: pipeNum(row.start_elev),
    endElev: pipeNum(row.end_elev),
    flowDir: row.flow_dir,
    length: pipeNum(row.length),
    holeCount: Number(row.hole_count),
    cabCount: Number(row.cab_count),
    pressure: row.pressure,
    voltage: row.voltage,
    owner: row.owner,
    road: row.road,
    buildYear: row.build_year,
    status: row.status,
    lineStyle: row.line_style,
    geom: pipeJson(row.geom, null),
    attrs: pipeJson(row.attrs, {}),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  }
}

function pipeIssueOf(row) {
  if (!row) return null
  return {
    id: row.id,
    datasetId: row.dataset_id,
    issueType: row.issue_type,
    severity: row.severity,
    nodeId: row.node_id,
    lineId: row.line_id,
    message: row.message,
    resolved: Number(row.resolved) === 1,
    createdAt: Number(row.created_at),
  }
}

export function insertPipeNode(datasetId, input = {}) {
  const now = Number(input.createdAt || Date.now())
  const id = String(input.id || `NODE-${randomBytes(6).toString('hex')}`)
  stmt.insertPipeNode.run(
    id,
    String(datasetId || ''),
    String(input.nodeCode || ''),
    String(input.category || ''),
    pipeNum(input.x), pipeNum(input.y), pipeNum(input.groundElev), pipeNum(input.z), pipeNum(input.coverDepth),
    String(input.coverMaterial || ''), String(input.coverSize || ''),
    String(input.chamberShape || ''), String(input.chamberSize || ''),
    String(input.road || ''), String(input.address || ''), String(input.owner || ''),
    String(input.buildYear || ''), String(input.surveyDate || ''), String(input.surveyUnit || ''),
    pipeNum(input.angle), String(input.status || ''),
    JSON.stringify(input.attrs || {}), now, now
  )
  return pipeNodeOf(stmt.getPipeNode.get(id))
}

export function getPipeNode(id) {
  return pipeNodeOf(stmt.getPipeNode.get(String(id || '')))
}

export function listPipeNodes(datasetId, { limit = 1000 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 1000, 5000))
  return stmt.listPipeNodes.all(String(datasetId || ''), safeLimit).map(pipeNodeOf)
}

export function countPipeNodes(datasetId) {
  return Number(stmt.countPipeNodes.get(String(datasetId || '')).n)
}

export function insertPipeLine(datasetId, input = {}) {
  const now = Number(input.createdAt || Date.now())
  const id = String(input.id || `LINE-${randomBytes(6).toString('hex')}`)
  stmt.insertPipeLine.run(
    id,
    String(datasetId || ''),
    String(input.lineCode || ''),
    String(input.nodeStart || ''),
    String(input.nodeEnd || ''),
    String(input.pipeMajor || ''),
    String(input.material || ''),
    String(input.profileType || ''),
    String(input.profileSize || ''),
    String(input.wallThickness || ''),
    String(input.buryType || ''),
    pipeNum(input.startDepth), pipeNum(input.endDepth), pipeNum(input.startElev), pipeNum(input.endElev),
    String(input.flowDir ?? '-1'),
    pipeNum(input.length),
    Number(input.holeCount || 0), Number(input.cabCount || 0),
    String(input.pressure || ''), String(input.voltage || ''),
    String(input.owner || ''), String(input.road || ''), String(input.buildYear || ''),
    String(input.status || ''), String(input.lineStyle || ''),
    typeof input.geom === 'string' ? input.geom : JSON.stringify(input.geom || null),
    JSON.stringify(input.attrs || {}), now, now
  )
  return pipeLineOf(stmt.getPipeLine.get(id))
}

export function getPipeLine(id) {
  return pipeLineOf(stmt.getPipeLine.get(String(id || '')))
}

export function listPipeLines(datasetId, { limit = 1000 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 1000, 5000))
  return stmt.listPipeLines.all(String(datasetId || ''), safeLimit).map(pipeLineOf)
}

export function countPipeLines(datasetId) {
  return Number(stmt.countPipeLines.get(String(datasetId || '')).n)
}

export function replacePipeTopology(datasetId, edges = []) {
  const ds = String(datasetId || '')
  stmt.deletePipeTopologyByDataset.run(ds)
  for (const edge of edges) {
    stmt.insertPipeTopology.run(
      String(edge.id || `TOPO-${randomBytes(6).toString('hex')}`),
      ds,
      String(edge.nodeId || ''),
      String(edge.neighborNodeId || ''),
      String(edge.lineId || ''),
      String(edge.pipeMajor || ''),
      Number(edge.directed || 0)
    )
  }
  return stmt.listPipeTopology.all(ds)
}

export function listPipeTopology(datasetId) {
  return stmt.listPipeTopology.all(String(datasetId || ''))
}

export function insertPipeIssue(datasetId, input = {}) {
  const id = String(input.id || `ISSUE-${randomBytes(6).toString('hex')}`)
  const now = Number(input.createdAt || Date.now())
  stmt.insertPipeIssue.run(
    id,
    String(datasetId || ''),
    String(input.issueType || ''),
    String(input.severity || '中'),
    String(input.nodeId || ''),
    String(input.lineId || ''),
    String(input.message || ''),
    Number(input.resolved || 0),
    now
  )
  return pipeIssueOf({
    id, dataset_id: String(datasetId || ''), issue_type: String(input.issueType || ''),
    severity: String(input.severity || '中'), node_id: String(input.nodeId || ''),
    line_id: String(input.lineId || ''), message: String(input.message || ''),
    resolved: Number(input.resolved || 0), created_at: now,
  })
}

export function listPipeIssues(datasetId, { resolved = -1, limit = 500 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 500, 2000))
  const state = resolved === -1 ? -1 : Number(resolved ? 1 : 0)
  return stmt.listPipeIssues.all(String(datasetId || ''), state, state, safeLimit).map(pipeIssueOf)
}

export function resolvePipeIssue(id) {
  stmt.resolvePipeIssue.run(String(id || ''))
}

export function clearPipelineFeatures(datasetId) {
  const ds = String(datasetId || '')
  stmt.deletePipeNodesByDataset.run(ds)
  stmt.deletePipeLinesByDataset.run(ds)
  stmt.deletePipeTopologyByDataset.run(ds)
  stmt.deletePipeIssuesByDataset.run(ds)
}

function pipeAnalysisOf(row) {
  if (!row) return null
  return {
    id: row.id,
    datasetId: row.dataset_id,
    type: row.analysis_type,
    params: pipeJson(row.params, {}),
    result: pipeJson(row.result, {}),
    summary: row.summary,
    status: row.status,
    owner: row.owner,
    net: row.net,
    createdAt: Number(row.created_at),
  }
}

export function insertPipeAnalysisRun(input = {}) {
  const id = String(input.id || `ANALYSIS-${randomBytes(6).toString('hex')}`)
  stmt.insertPipeAnalysisRun.run(
    id,
    String(input.datasetId || ''),
    String(input.type || ''),
    JSON.stringify(input.params || {}),
    JSON.stringify(input.result || {}),
    String(input.summary || ''),
    String(input.status || 'done'),
    String(input.owner || ''),
    String(input.net || ''),
    Number(input.createdAt || Date.now())
  )
  return pipeAnalysisOf(stmt.getPipeAnalysisRun.get(id))
}

export function getPipeAnalysisRun(id) {
  return pipeAnalysisOf(stmt.getPipeAnalysisRun.get(String(id || '')))
}

export function listPipeAnalysisRuns(datasetId, { type = '', limit = 50 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 200))
  const kind = String(type || '')
  return stmt.listPipeAnalysisRuns.all(String(datasetId || ''), kind, kind, safeLimit).map(pipeAnalysisOf)
}

export function softDeletePipeAnalysisRun(id, owner) {
  const result = stmt.softDeletePipeAnalysisRun.run(Date.now(), String(id || ''), String(owner || ''))
  return Number(result.changes || 0) ? true : false
}
