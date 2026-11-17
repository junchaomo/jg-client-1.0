/**
 * 备份分层保留：近期全留、每小时一份、每天一份；非时间戳目录不动。
 * 用独立临时数据目录，不触碰客户端 data/backups。
 */
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dataDir = mkdtempSync(join(tmpdir(), 'jg-backup-retention-'))
process.env.JG_DATA_DIR = dataDir
const backupsDir = join(dataDir, 'backups')
const NOW = Date.UTC(2026, 10, 17, 12, 0, 0)

function addBackup(iso, note = '测试备份') {
  const name = iso.replace(/[:.]/g, '-')
  const dir = join(backupsDir, name)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ id: name, createdAt: iso, note }), 'utf8')
  return name
}

after(() => {
  try { rmSync(dataDir, { recursive: true, force: true }) } catch {}
})

test('近期全留、每小时去重、超出窗口删除、人工目录不动', async () => {
  mkdirSync(backupsDir, { recursive: true })

  const recentA = addBackup('2026-11-17T11:50:00.000Z')
  const recentB = addBackup('2026-11-17T11:40:00.000Z')
  const hourNewest = addBackup('2026-11-17T10:50:00.000Z')
  const hourDuplicate = addBackup('2026-11-17T10:10:00.000Z')
  const hourOther = addBackup('2026-11-17T09:30:00.000Z')
  const daily = addBackup('2026-11-15T09:00:00.000Z')
  const tooOld = addBackup('2026-11-01T09:00:00.000Z')

  const manualDir = join(backupsDir, 'profile-before-optional-20261113-110706')
  mkdirSync(manualDir, { recursive: true })
  writeFileSync(join(manualDir, 'note.txt'), '人工快照，不应被裁剪', 'utf8')

  const db = await import('../db.mjs')
  const result = db.pruneBackupsTiered({ recent: 2, hourlyHours: 6, dailyDays: 2, now: NOW })

  const remaining = readdirSync(backupsDir)
  assert.equal(remaining.includes(hourDuplicate), false, '同一小时重复备份应被删除')
  assert.equal(remaining.includes(tooOld), false, '超出每日窗口的备份应被删除')
  for (const kept of [recentA, recentB, hourNewest, hourOther, daily]) {
    assert.equal(remaining.includes(kept), true, `${kept} 应保留`)
  }
  assert.equal(remaining.includes('profile-before-optional-20261113-110706'), true, '非时间戳目录不应被删除')
  assert.equal(result.removed, 2)
  assert.equal(result.kept, 6)
})

test('份数不足近期额度时不删除任何备份', async () => {
  const db = await import('../db.mjs')
  const before = readdirSync(backupsDir).length
  const result = db.pruneBackupsTiered({ recent: 10, hourlyHours: 0, dailyDays: 0, now: NOW })
  assert.equal(result.removed, 0)
  assert.equal(readdirSync(backupsDir).length, before)
})
