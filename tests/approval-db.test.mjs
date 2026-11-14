import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'jg-approval-db-'))
process.env.JG_DATA_DIR = dir

const db = await import('../db.mjs')

const id = 'APD-test-01'
db.appendApprovalDecision({
  decisionId: id,
  conversationId: 'C-test',
  callId: 'call-1',
  tool: 'bash',
  operation: 'execute',
  argsSummary: '命令：rm -rf D:\\workspace\\data',
  decision: 'pending',
  rule: 'high-risk-command',
  risk: 'high',
  actor: '测试用户',
  approver: 'pending',
  net: 'internal',
  time: new Date().toISOString(),
  createdAt: Date.now(),
})
assert.equal(db.latestApprovalDecisions(1)[0].decisionId, id)
assert.equal(db.latestApprovalDecisions(1)[0].decision, 'pending')

db.updateApprovalDecision(id, {
  decision: 'rejected',
  approver: '测试用户',
  decidedAt: Date.now(),
})
const row = db.latestApprovalDecisions(1)[0]
assert.equal(row.decision, 'rejected')
assert.equal(row.approver, '测试用户')
assert.equal(row.rule, 'high-risk-command')
assert.equal(row.risk, 'high')
assert.ok(row.decidedAt > 0)

console.log(`PASS approval_decisions insert/update/query :: ${dir}`)
db.closeStore()
rmSync(dir, { recursive: true, force: true })
