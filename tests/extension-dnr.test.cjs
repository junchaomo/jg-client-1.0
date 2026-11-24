const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { createDnrBlocker } = require('../electron/extension-dnr.cjs')

test('官方 uBOL 静态规则可解析并匹配真实广告脚本，不误伤普通站点', () => {
  const blocker = createDnrBlocker(path.join(__dirname, '..', 'extensions', 'ublock-origin-lite'))
  assert.ok(blocker.rules > 1000, `实际加载规则数：${blocker.rules}`)
  assert.equal(blocker.match('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'), true)
  assert.equal(blocker.match('https://example.com/document.pdf'), false)
})
