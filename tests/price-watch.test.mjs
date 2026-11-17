import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createPricingWatch } from '../price-watch.mjs'

test('价格源监控：首次建基线、无变化不告警、变化后待核对并可确认', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'jg-price-watch-'))
  try {
    let body = '<html><body><h1>官方价目</h1><p>输入 12 元 / M</p></body></html>'
    const watch = createPricingWatch({
      dataDir,
      sources: [{ id: 'demo', label: '示例厂商', kind: '文本', url: 'https://example.com/pricing' }],
      fetchText: async () => body,
    })

    const first = await watch.check()
    assert.equal(first.sources.demo.checks, 1)
    assert.equal(first.sources.demo.pending, false)
    assert.equal(first.alerts.length, 0)

    const same = await watch.check()
    assert.equal(same.sources.demo.checks, 2)
    assert.equal(same.sources.demo.pending, false)
    assert.equal(same.alerts.length, 0)

    body = '<html><body><h1>官方价目</h1><p>输入 13 元 / M</p></body></html>'
    const changed = await watch.check()
    assert.equal(changed.sources.demo.pending, true)
    assert.equal(changed.sources.demo.checks, 3)
    assert.equal(changed.alerts.length, 1)
    assert.equal(changed.alerts[0].sourceId, 'demo')

    const acknowledged = await watch.acknowledge('demo', '人工核对官方页')
    assert.equal(acknowledged.sources.find((row) => row.id === 'demo').pending, false)
    assert.equal(acknowledged.alerts.length, 0)
  } finally {
    await rm(dataDir, { recursive: true, force: true })
  }
})

test('价格源监控：导航与公告变化不影响价格指纹', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'jg-price-watch-'))
  try {
    let body = '<html><body><nav>公告 A</nav><table><tr><td>输入</td><td>12 元 / M</td></tr></table></body></html>'
    const watch = createPricingWatch({
      dataDir,
      sources: [{ id: 'demo', label: '示例厂商', kind: '文本', url: 'https://example.com/pricing' }],
      fetchText: async () => body,
    })
    await watch.check()
    body = '<html><body><nav>公告 B 更新了推荐位</nav><table><tr><td>输入</td><td>12 元 / M</td></tr></table></body></html>'
    const state = await watch.check()
    assert.equal(state.sources.demo.pending, false)
    assert.equal(state.alerts.length, 0)
  } finally {
    await rm(dataDir, { recursive: true, force: true })
  }
})

test('价格源监控：抓取失败保留已有基线并标记失败', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'jg-price-watch-'))
  try {
    let fail = false
    const watch = createPricingWatch({
      dataDir,
      sources: [{ id: 'demo', label: '示例厂商', kind: '文本', url: 'https://example.com/pricing' }],
      fetchText: async () => {
        if (fail) throw new Error('HTTP 503')
        return '<p>输入 12 元 / M</p>'
      },
    })
    await watch.check()
    fail = true
    const state = await watch.check()
    assert.equal(state.sources.demo.status, 'failed')
    assert.match(state.sources.demo.error, /503/)
    assert.ok(state.sources.demo.hash)
  } finally {
    await rm(dataDir, { recursive: true, force: true })
  }
})
