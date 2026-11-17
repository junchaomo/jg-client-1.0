#!/usr/bin/env node
/*
 * 备份恢复工具：把 data/backups 下的一致性快照还原到指定数据目录，并按 manifest 校验行数。
 *
 * 用法：
 *   node scripts/restore-backup.mjs --list
 *   node scripts/restore-backup.mjs --backup latest --target data/_restore/latest
 *   node scripts/restore-backup.mjs --backup 2026-11-17T02-29-12-186Z --target data --force
 *
 * 约束：
 * - 默认拒绝写入已存在的非空目录，除非显式 --force。
 * - 目标等于当前活动数据目录时必须同时给 --force，且服务应已停止；脚本会先试打开目标库确认未被占用。
 * - 恢复后以只读方式校验 quick_check、files/audit/sessions 行数与 manifest 是否一致。
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = resolve(process.env.JG_DATA_DIR || join(root, 'data'))
const backupsDir = join(dataDir, 'backups')

const argv = process.argv.slice(2)
const has = (name) => argv.includes(`--${name}`)
const opt = (name, fallback = '') => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback
}

function fail(message, detail) {
  const payload = { ok: false, error: message, ...(detail ? { detail } : {}) }
  console.error(JSON.stringify(payload, null, 2))
  process.exit(1)
}

function listBackupDirs() {
  if (!existsSync(backupsDir)) return []
  return readdirSync(backupsDir)
    .filter((name) => /^\d{4}-\d{2}-\d{2}T/.test(name))
    .map((name) => ({ name, dir: join(backupsDir, name), mtime: statSync(join(backupsDir, name)).mtimeMs }))
    .sort((a, b) => b.name.localeCompare(a.name))
}

if (has('list')) {
  const items = listBackupDirs().map((item) => {
    const manifestFile = join(item.dir, 'manifest.json')
    const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : null
    return {
      id: item.name,
      note: manifest?.note || '',
      createdAt: manifest?.createdAt || '',
      dbBytes: manifest?.dbBytes ?? null,
      fileCount: manifest?.fileCount ?? null,
      sessionCount: manifest?.sessionCount ?? null,
      auditCount: manifest?.auditCount ?? null,
    }
  })
  console.log(JSON.stringify({ ok: true, backupsDir, count: items.length, backups: items }, null, 2))
  process.exit(0)
}

const wanted = opt('backup', 'latest')
const selected = wanted === 'latest' ? listBackupDirs()[0] : listBackupDirs().find((item) => item.name === wanted)
if (!selected) fail(`找不到备份：${wanted}`, { backupsDir })

const sourceDb = join(selected.dir, 'jg.sqlite')
const sourceFiles = join(selected.dir, 'files')
const manifestFile = join(selected.dir, 'manifest.json')
if (!existsSync(sourceDb)) fail('备份缺少 jg.sqlite', { dir: selected.dir })
if (!existsSync(manifestFile)) fail('备份缺少 manifest.json', { dir: selected.dir })
const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'))

const targetArg = opt('target')
if (!targetArg) fail('必须指定 --target（建议先用临时目录演练）', { example: '--target data/_restore/latest' })
const target = resolve(targetArg)
const isLive = target === dataDir

if (isLive && !has('force')) {
  fail('目标就是当前活动数据目录；确需原地恢复请先停止服务并加 --force', { target })
}

const targetDb = join(target, 'jg.sqlite')
if (isLive && existsSync(targetDb)) {
  try {
    const probe = new DatabaseSync(targetDb)
    probe.close()
  } catch (err) {
    fail('目标数据库无法打开，服务可能仍在运行；请先停止服务', { target, message: String(err?.message || err) })
  }
}

if (existsSync(target) && !isLive) {
  const entries = readdirSync(target)
  if (entries.length && !has('force')) {
    fail('目标目录非空，已拒绝覆盖；确认无误后加 --force', { target, entries: entries.slice(0, 8) })
  }
}

mkdirSync(target, { recursive: true })

// 旧 WAL/SHM 不清掉会和新库文件错配。
for (const suffix of ['-wal', '-shm']) {
  const stale = `${targetDb}${suffix}`
  if (existsSync(stale)) rmSync(stale, { force: true })
}
cpSync(sourceDb, targetDb)

const targetFiles = join(target, 'files')
if (existsSync(sourceFiles)) {
  if (existsSync(targetFiles)) rmSync(targetFiles, { recursive: true, force: true })
  cpSync(sourceFiles, targetFiles, { recursive: true })
}

let verify
try {
  const db = new DatabaseSync(targetDb, { readOnly: true })
  const integrity = db.prepare('PRAGMA quick_check').get()
  const integrityValue = integrity ? Object.values(integrity)[0] : 'unknown'
  const count = (sql) => Number(db.prepare(sql).get().c || 0)
  // manifest 的 fileCount 只统计未删除文件，这里保持同一口径。
  const activeFiles = db.prepare('SELECT id, path FROM files WHERE deleted_at IS NULL').all()
  const missingArtifacts = []
  for (const row of activeFiles) {
    const artifact = join(target, String(row.path || ''))
    if (!row.path || !existsSync(artifact)) {
      if (missingArtifacts.length < 10) missingArtifacts.push(row.id)
    }
  }
  verify = {
    quickCheck: integrityValue,
    files: activeFiles.length,
    filesTotal: count('SELECT COUNT(*) AS c FROM files'),
    audit: count('SELECT COUNT(*) AS c FROM audit'),
    sessions: count('SELECT COUNT(*) AS c FROM sessions'),
    artifactsMissing: missingArtifacts.length,
    artifactsMissingSample: missingArtifacts,
  }
  db.close()
} catch (err) {
  fail('恢复后的数据库无法打开', { targetDb, message: String(err?.message || err) })
}

const mismatches = []
if (verify.quickCheck !== 'ok') mismatches.push(`quick_check=${verify.quickCheck}`)
if (verify.artifactsMissing > 0) mismatches.push(`artifactsMissing=${verify.artifactsMissing}`)
for (const [key, expected] of [['files', manifest.fileCount], ['audit', manifest.auditCount], ['sessions', manifest.sessionCount]]) {
  if (typeof expected === 'number' && verify[key] !== expected) {
    mismatches.push(`${key}: restored=${verify[key]} manifest=${expected}`)
  }
}

const result = {
  ok: mismatches.length === 0,
  restoredFrom: selected.name,
  note: manifest.note || '',
  createdAt: manifest.createdAt || '',
  target,
  live: isLive,
  dbBytes: statSync(targetDb).size,
  verify,
  mismatches,
}
console.log(JSON.stringify(result, null, 2))
if (mismatches.length) process.exit(2)

// 提示下一步：指向恢复目录的最小启动命令
console.log(`\n下一步（在仓库根执行）：\n  $env:JG_DATA_DIR='${target}'\n  $env:PORT='<另一个端口>'\n  runtime\\node.exe server.mjs`)
