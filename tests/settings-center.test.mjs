import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { base32Encode, compareVersions, createSettingsCenter, totp, verifyTotp } from '../settings-center.mjs'

test('TOTP 使用标准 HMAC-SHA1，并允许前后一个 30 秒窗口', () => {
  const secret = base32Encode(Buffer.from('12345678901234567890', 'ascii'))
  assert.equal(secret, 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')
  assert.equal(totp(secret, 59 * 1000), '287082')
  assert.equal(verifyTotp(secret, '287082', 59 * 1000), true)
  assert.equal(verifyTotp(secret, '287082', 89 * 1000), true)
  assert.equal(verifyTotp(secret, '000000', 59 * 1000), false)
  assert.equal(verifyTotp(secret, '287082', 121 * 1000), false)
})

test('版本比较识别正式版、预发布版和高低版本', () => {
  assert.equal(compareVersions('1.1.0', '1.0.0'), 1)
  assert.equal(compareVersions('1.0.0', '1.1.0'), -1)
  assert.equal(compareVersions('1.0.0', '1.0.0-rc.1'), 1)
  assert.equal(compareVersions('1.0.0-rc.2', '1.0.0-rc.1'), 1)
  assert.equal(compareVersions('v1.0.0', '1.0.0'), 0)
})

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'jg-settings-unit-'))
  const user = { id: 'U1', name: '测试员', unit: '测试组' }
  const state = { workspaces: {}, mfa: {}, accessRequests: [], cacheClears: {} }
  const conversations = [{ id: 'C1', title: '测试会话', userId: 'U1', turns: 1, messages: [{ role: 'user', text: '你好' }], status: 'done' }]
  const session = { id: 'current' }
  const notices = []
  const sessions = [{ id: 'current', net: 'inet', createdAt: Date.now(), lastSeen: Date.now(), expiresAt: Date.now() + 10000 }]
  const center = createSettingsCenter({
    state, root: dir, dataDir: dir, productVersion: '1.0.0', port: 4173,
    roleOf: () => user, netOf: () => 'inet', sessionOf: () => session,
    json: (res, status, body) => { res.status = status; res.body = body },
    contentDisposition: (name) => `attachment; filename="${name}"`,
    logAudit: () => {}, listAccountSessions: () => sessions, deleteSession: (id) => sessions.splice(sessions.findIndex((item) => item.id === id), 1),
    conversations, conversationAllowed: (u, item) => item.userId === u.id, conversationMarkdown: () => '# 测试会话\n',
    resources: [{ id: 'R1', name: '测试资源', security: 'internal' }], modelForUser: () => null,
    ensureWorkspaceAcl: () => true, closeHarnessForHome: async () => {}, userDshHome: () => dir,
    storageCheck: () => 'ok',
    canSeeResource: () => false, reviewerIds: () => ['ADMIN'],
    notifyUser: (userId, message) => notices.push({ userId, ...message }),
  })
  const req = (body = {}) => ({ __body: JSON.stringify(body) })
  const res = () => ({
    headers: {},
    writeHead(status, headers) { this.status = status; this.headers = headers },
    end(payload) { this.payload = payload },
  })
  return { dir, user, state, conversations, center, req, res, session, notices }
}

test('工作区保存实际验证可写目录，重置恢复托管目录', async () => {
  const f = fixture()
  try {
    const custom = join(f.dir, 'custom-workspace')
    const response = f.res()
    await f.center.routes['POST /api/settings/workspace'](f.req({ path: custom }), response)
    assert.equal(response.status, 200)
    assert.equal(f.state.workspaces.U1, custom)
    assert.equal(f.center.workspaceFor(f.user), custom)
    const reset = f.res()
    await f.center.routes['POST /api/settings/workspace'](f.req({ reset: true }), reset)
    assert.equal(reset.status, 200)
    assert.equal(f.state.workspaces.U1, undefined)
  } finally { rmSync(f.dir, { recursive: true, force: true }) }
})

test('授权申请持久化且阻止同一资源的重复待审批单', () => {
  const f = fixture()
  try {
    const response = f.res()
    f.center.routes['POST /api/settings/access-requests'](f.req({ resourceId: 'R1', reason: '用于城市体检项目的数据核验', durationDays: 90 }), response)
    assert.equal(response.status, 201)
    assert.equal(f.state.accessRequests.length, 1)
    assert.equal(f.state.accessRequests[0].durationDays, 90)
    const duplicate = f.res()
    f.center.routes['POST /api/settings/access-requests'](f.req({ resourceId: 'R1', reason: '再次提交同一资源申请' }), duplicate)
    assert.equal(duplicate.status, 409)
  } finally { rmSync(f.dir, { recursive: true, force: true }) }
})

test('归档、恢复和 JSON 导出操作的是同一条真实会话', () => {
  const f = fixture()
  try {
    const archived = f.res()
    f.center.routes['POST /api/settings/conversations/archive'](f.req({ ids: ['C1'], archived: true }), archived)
    assert.equal(archived.status, 200)
    assert.ok(f.conversations[0].archivedAt)
    assert.equal(f.center.listConversations(f.user, false).length, 0)
    assert.equal(f.center.listConversations(f.user, true).length, 1)
    const exported = f.res()
    f.center.routes['GET /api/settings/export'](f.req(), exported, { searchParams: new URLSearchParams('id=C1&format=json') })
    assert.equal(exported.status, 200)
    assert.equal(JSON.parse(exported.payload).conversation.id, 'C1')
    const restored = f.res()
    f.center.routes['POST /api/settings/conversations/archive'](f.req({ ids: ['C1'], archived: false }), restored)
    assert.equal(restored.status, 200)
    assert.equal(f.conversations[0].archivedAt, undefined)
  } finally { rmSync(f.dir, { recursive: true, force: true }) }
})

test('敏感操作要求当前会话 10 分钟内完成 TOTP，其他设备不能复用', () => {
  const f = fixture()
  try {
    const secret = base32Encode(Buffer.from('settings-center-mfa-secret'))
    f.state.mfa.U1 = { enabled: true, secret, verifications: {} }
    const denied = f.res()
    f.center.routes['GET /api/settings/export'](f.req(), denied, { searchParams: new URLSearchParams('id=C1&format=json') })
    assert.equal(denied.status, 428)
    assert.equal(denied.body.code, 'MFA_REQUIRED')
    const verified = f.res()
    f.center.routes['POST /api/settings/mfa/verify'](f.req({ code: totp(secret) }), verified)
    assert.equal(verified.status, 200)
    assert.ok(f.state.mfa.U1.verifications.current)
    const allowed = f.res()
    f.center.routes['GET /api/settings/export'](f.req(), allowed, { searchParams: new URLSearchParams('id=C1&format=json') })
    assert.equal(allowed.status, 200)
    f.session.id = 'another-device'
    const otherDevice = f.res()
    f.center.routes['GET /api/settings/export'](f.req(), otherDevice, { searchParams: new URLSearchParams('id=C1&format=json') })
    assert.equal(otherDevice.status, 428)
    f.session.id = 'current'
    f.state.mfa.U1.verifications.current = Date.now() - 11 * 60 * 1000
    const expired = f.res()
    f.center.routes['GET /api/settings/export'](f.req(), expired, { searchParams: new URLSearchParams('id=C1&format=json') })
    assert.equal(expired.status, 428)
  } finally { rmSync(f.dir, { recursive: true, force: true }) }
})

test('授权审批禁止自审，批准即生效，可撤销、到期并通知申请人', () => {
  const f = fixture()
  try {
    const created = f.res()
    f.center.routes['POST /api/settings/access-requests'](f.req({ resourceId: 'R1', reason: '用于城市体检项目的数据核验', durationDays: 30 }), created)
    assert.equal(created.status, 201)
    const requestId = created.body.item.id
    f.user.roles = ['admin']
    const selfReview = f.res()
    f.center.routes['POST /api/settings/access-requests/review'](f.req({ id: requestId, decision: 'approved' }), selfReview)
    assert.equal(selfReview.status, 409)
    assert.equal(selfReview.body.code, 'ACCESS_SELF_REVIEW')
    f.user.id = 'ADMIN'; f.user.name = '审批员'; f.session.id = 'admin-session'
    const approved = f.res()
    f.center.routes['POST /api/settings/access-requests/review'](f.req({ id: requestId, decision: 'approved', reviewNote: '项目范围内使用' }), approved)
    assert.equal(approved.status, 200)
    assert.ok(approved.body.item.approvedUntil)
    assert.equal(f.center.hasActiveAccess('U1', 'R1'), true)
    assert.ok(f.notices.some((notice) => notice.userId === 'U1' && notice.title.includes('已授权')))
    const revoked = f.res()
    f.center.routes['POST /api/settings/access-requests/review'](f.req({ id: requestId, decision: 'revoked', reviewNote: '项目提前结束' }), revoked)
    assert.equal(revoked.status, 200)
    assert.equal(f.center.hasActiveAccess('U1', 'R1'), false)
    const item = f.state.accessRequests[0]
    item.status = 'approved'; item.approvedUntil = new Date(Date.now() - 1000).toISOString()
    assert.equal(f.center.hasActiveAccess('U1', 'R1'), false)
    assert.equal(item.status, 'expired')
  } finally { rmSync(f.dir, { recursive: true, force: true }) }
})
