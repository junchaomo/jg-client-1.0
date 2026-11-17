import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkProjectDeliverables } from '../deliverable-check.mjs'

test('成果检查：同项目指标、日期冲突会被发现', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jg-deliverable-'))
  try {
    writeFileSync(join(dir, '成果A.txt'), '项目名称：九江滨江片区城市更新\n总用地面积：12.5 公顷\n编制日期：2026年11月10日\n版本 V1.0', 'utf8')
    writeFileSync(join(dir, '成果B.txt'), '项目名称：九江滨江片区城市更新\n总用地面积：13.2 公顷\n编制日期：2026年11月12日\n版本 V1.1', 'utf8')
    const result = checkProjectDeliverables({ cwd: dir, projectName: '九江滨江片区城市更新' })
    assert.equal(result.status, 'conflict')
    assert.equal(result.summary.files, 2)
    assert.ok(result.checks.some((item) => item.title === '指标取值不一致'))
    assert.ok(result.checks.some((item) => item.title === '关键日期不一致'))
    assert.ok(result.checks.some((item) => item.title === '版本标识不统一'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('成果检查：一致的成果不报冲突', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jg-deliverable-'))
  try {
    writeFileSync(join(dir, '成果A.txt'), '项目名称：九江滨江片区城市更新\n总用地面积：12.5 公顷\n编制日期：2026年11月10日\n版本 V1.0', 'utf8')
    writeFileSync(join(dir, '成果B.txt'), '项目名称：九江滨江片区城市更新\n总用地面积：12.5 公顷\n编制日期：2026年11月10日\n版本 V1.0', 'utf8')
    const result = checkProjectDeliverables({ cwd: dir, projectName: '九江滨江片区城市更新' })
    assert.equal(result.status, 'ok')
    assert.equal(result.summary.conflicts, 0)
    assert.equal(result.summary.warnings, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('成果检查：空目录返回可读警告而不是崩溃', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jg-deliverable-'))
  try {
    const result = checkProjectDeliverables({ cwd: dir, projectName: '测试项目' })
    assert.equal(result.status, 'warning')
    assert.ok(result.checks.some((item) => item.title === '未发现可检查成果'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
