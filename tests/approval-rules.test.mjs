import assert from 'node:assert/strict'
import {
  classifyOperation,
  describeToolCall,
  summarizeToolCall,
} from '../approval-rules.mjs'

const root = 'D:\\workspace'
const cases = []
function check(name, fn) {
  try {
    fn()
    cases.push({ name, ok: true })
  } catch (err) {
    cases.push({ name, ok: false, error: err.message })
  }
}

function describe(tool, args, extra = {}) {
  return describeToolCall({ tool, args, cwd: root, ...extra })
}

check('操作类型：显式只读', () => {
  assert.equal(classifyOperation('read', { path: 'D:\\workspace\\a.md' }), 'read')
})

check('操作类型：删除优先于写入', () => {
  assert.equal(classifyOperation('tool-delete', { path: 'D:\\workspace\\a.md' }), 'delete')
})

check('操作类型：移动/重命名', () => {
  assert.equal(classifyOperation('tool-rename', { source: 'a', destination: 'b' }), 'move')
})

check('操作类型：命令执行', () => {
  assert.equal(classifyOperation('bash', { command: 'ls' }), 'execute')
})

check('操作类型：未知工具', () => {
  assert.equal(classifyOperation('agent-team', { prompt: 'spawn' }), 'unknown')
})

check('风险元数据：只读为 low', () => {
  const r = describe('read', { path: 'D:\\workspace\\a.md' })
  assert.equal(r.operation, 'read')
  assert.equal(r.risk, 'low')
})

check('风险元数据：目录内写入为 medium', () => {
  const r = describe('write', { path: 'D:\\workspace\\out.md', content: 'x' })
  assert.equal(r.operation, 'write')
  assert.equal(r.risk, 'medium')
})

check('风险元数据：删除为 high', () => {
  const r = describe('tool-delete', { path: 'D:\\workspace\\a.md' })
  assert.equal(r.operation, 'delete')
  assert.equal(r.risk, 'high')
})

check('风险元数据：移动/重命名为 high', () => {
  const r = describe('tool-move', { source: 'D:\\workspace\\a', destination: 'D:\\workspace\\b' })
  assert.equal(r.operation, 'move')
  assert.equal(r.risk, 'high')
})

check('风险元数据：命令执行为 high', () => {
  const r = describe('bash', { command: 'npm test' })
  assert.equal(r.operation, 'execute')
  assert.equal(r.risk, 'high')
})

check('风险元数据：外部副作用为 high', () => {
  const r = describe('mcp__jg__im_send', { id: 'T1', text: 'hi' }, { isExternalSideEffect: true })
  assert.equal(r.operation, 'external-write')
  assert.equal(r.risk, 'high')
})

check('风险元数据：未知工具为 medium', () => {
  const r = describe('agent-team', { prompt: 'spawn' })
  assert.equal(r.operation, 'unknown')
  assert.equal(r.risk, 'medium')
})

check('参数摘要包含目标与命令', () => {
  const s = summarizeToolCall('bash', { command: 'npm test', path: 'D:\\workspace' })
  assert.match(s, /目标：/)
  assert.match(s, /命令：npm test/)
})

check('参数摘要包含外部消息正文', () => {
  const s = summarizeToolCall('mcp__jg__im_send', { id: 'T1', text: '下午三点开会' })
  assert.match(s, /内容：下午三点开会/)
})

const failed = cases.filter((c) => !c.ok)
for (const c of cases) console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.name}${c.error ? ` :: ${c.error}` : ''}`)
if (failed.length) {
  console.error(`\n${failed.length} approval metadata case(s) failed`)
  process.exit(1)
}
console.log(`\n${cases.length} approval metadata cases passed`)
