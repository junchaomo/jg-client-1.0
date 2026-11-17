/**
 * 图像模板审核状态机：管理中心“图像模板管理”四个动作的真实数据层回归。
 * 用独立临时数据目录，不触碰客户端 data/ 下的真实模板。
 */
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dataDir = mkdtempSync(join(tmpdir(), 'jg-image-template-'))
process.env.JG_DATA_DIR = dataDir

let db
let seq = 0

function makeTemplate(status = 'pending') {
  seq += 1
  return db.createImageTemplate({
    id: `TPL-TEST-${seq}`,
    title: `测试模板 ${seq}`,
    category: '海报',
    ratio: '3:4',
    prompt: '一张用于测试的模板提示词',
    description: '测试用',
    previewFileId: `F-TEST-${seq}`,
    sourceAssetId: `IMG-TEST-${seq}`,
    applicant: '测试员工',
    status,
  })
}

before(async () => {
  db = await import('../db.mjs')
})

after(() => {
  try { rmSync(dataDir, { recursive: true, force: true }) } catch {}
})

test('待审核模板通过后变为已上线，并记录审核人', () => {
  const tpl = makeTemplate()
  assert.equal(tpl.status, 'pending')
  const approved = db.reviewImageTemplate(tpl.id, 'approve', '管理员A', '')
  assert.equal(approved.status, 'approved')
  assert.equal(approved.reviewer, '管理员A')
  assert.ok(approved.reviewedAt > 0)
  const listed = db.listApprovedImageTemplates().find((x) => x.id === tpl.id)
  assert.ok(listed, '通过后应出现在已上线模板列表')
})

test('待审核模板驳回后进入 rejected，并保留驳回原因', () => {
  const tpl = makeTemplate()
  const rejected = db.reviewImageTemplate(tpl.id, 'reject', '管理员B', '预览图与提示词不一致')
  assert.equal(rejected.status, 'rejected')
  assert.equal(rejected.reviewNote, '预览图与提示词不一致')
  assert.equal(db.listApprovedImageTemplates().some((x) => x.id === tpl.id), false)
})

test('已上线模板可下架，已下架模板可重新上线；重复动作被拒绝', () => {
  const tpl = makeTemplate('approved')
  const offline = db.offlineImageTemplate(tpl.id, '管理员C', '临时下架')
  assert.equal(offline.status, 'offline')
  assert.equal(db.listApprovedImageTemplates().some((x) => x.id === tpl.id), false)
  // 已下架不能再下架
  assert.equal(db.offlineImageTemplate(tpl.id, '管理员C', ''), null)
  const back = db.publishImageTemplate(tpl.id, '管理员C')
  assert.equal(back.status, 'approved')
  assert.equal(back.reviewer, '管理员C')
  assert.equal(db.listApprovedImageTemplates().some((x) => x.id === tpl.id), true)
  // 已上线不能再次“重新上线”
  assert.equal(db.publishImageTemplate(tpl.id, '管理员C'), null)
})

test('待审核模板不能被直接下架或上线', () => {
  const tpl = makeTemplate()
  assert.equal(db.offlineImageTemplate(tpl.id, '管理员D', ''), null)
  assert.equal(db.publishImageTemplate(tpl.id, '管理员D'), null)
  assert.equal(db.getImageTemplate(tpl.id).status, 'pending')
})

test('管理员看到全部模板，普通员工只看到自己的申请', () => {
  const mine = makeTemplate()
  assert.ok(db.listAllImageTemplates().some((x) => x.id === mine.id))
  const byApplicant = db.listImageTemplatesByApplicant('测试员工')
  assert.ok(byApplicant.every((x) => x.applicant === '测试员工'))
  assert.equal(db.listImageTemplatesByApplicant('别的员工').some((x) => x.id === mine.id), false)
})
