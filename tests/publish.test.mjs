import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { packDirectoryToZip } from '../publish.mjs'
import { inspectPluginZip } from '../plugin-scan.mjs'

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'jg-publish-test-'))
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}

test('技能目录打包后能被plugin-scan识别并通过', () => {
  const { root, cleanup } = fixture()
  try {
    mkdirSync(join(root, 'skill'), { recursive: true })
    writeFileSync(join(root, 'skill', 'SKILL.md'), '---\nname: test-skill\ndescription: 测试技能\n---\n\n# 测试\n', 'utf8')
    const packed = packDirectoryToZip(join(root, 'skill'), { kind: 'skill' })
    assert.equal(packed.manifest, 'SKILL.md')
    const scan = inspectPluginZip(packed.buffer)
    assert.equal(scan.kind, 'skill')
    assert.equal(scan.checks.some((c) => c[1] === '不通过'), false)
  } finally { cleanup() }
})

test('技能包出现脚本时会被判不通过', () => {
  const { root, cleanup } = fixture()
  try {
    mkdirSync(join(root, 'skill', 'scripts'), { recursive: true })
    writeFileSync(join(root, 'skill', 'SKILL.md'), '---\nname: test-skill\ndescription: 测试技能\n---\n', 'utf8')
    writeFileSync(join(root, 'skill', 'scripts', 'run.py'), 'print(1)\n', 'utf8')
    const packed = packDirectoryToZip(join(root, 'skill'), { kind: 'skill' })
    const scan = inspectPluginZip(packed.buffer)
    assert.equal(scan.kind, 'skill')
    assert.equal(scan.checks.some((c) => c[1] === '不通过'), true)
    assert.match(scan.checks.map((c) => c[2]).join('；'), /run\.py/)
  } finally { cleanup() }
})

test('Bundle目录打包后能被识别并通过格式检查', () => {
  const { root, cleanup } = fixture()
  try {
    mkdirSync(join(root, 'bundle'), { recursive: true })
    writeFileSync(join(root, 'bundle', 'package.json'), JSON.stringify({
      name: 'test-bundle', version: '1.0.0', main: 'index.js',
      dsh: { bundle: { patch: 'cordis.patch.yml' } },
    }), 'utf8')
    writeFileSync(join(root, 'bundle', 'index.js'), 'export default {}\n', 'utf8')
    writeFileSync(join(root, 'bundle', 'cordis.patch.yml'), 'plugins: []\n', 'utf8')
    const packed = packDirectoryToZip(join(root, 'bundle'), { kind: 'bundle' })
    const scan = inspectPluginZip(packed.buffer)
    assert.equal(scan.kind, 'bundle')
    assert.equal(scan.checks.find((c) => c[0] === 'DSH Bundle 格式')[1], '通过')
  } finally { cleanup() }
})

test('应用目录打包后能被识别并通过清单与入口检查', () => {
  const { root, cleanup } = fixture()
  try {
    mkdirSync(join(root, 'app'), { recursive: true })
    writeFileSync(join(root, 'app', 'app.json'), JSON.stringify({
      id: 'test-app', name: '测试应用', version: '0.1.0', runtime: 'node', entry: 'server.mjs',
    }), 'utf8')
    writeFileSync(join(root, 'app', 'server.mjs'), 'console.log("ok")\n', 'utf8')
    const packed = packDirectoryToZip(join(root, 'app'), { kind: 'app' })
    const scan = inspectPluginZip(packed.buffer)
    assert.equal(scan.kind, 'app')
    assert.equal(scan.appId, 'test-app')
    assert.equal(scan.checks.find((c) => c[0] === '应用入口')[1], '通过')
  } finally { cleanup() }
})

test('缺少根目录清单时直接拒绝打包', () => {
  const { root, cleanup } = fixture()
  try {
    mkdirSync(join(root, 'empty'), { recursive: true })
    writeFileSync(join(root, 'empty', 'readme.txt'), 'x', 'utf8')
    assert.throws(() => packDirectoryToZip(join(root, 'empty'), { kind: 'skill' }), /SKILL\.md/)
  } finally { cleanup() }
})
