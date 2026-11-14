import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeVisualInput,
  validateMermaid,
  validateEChartsOption,
  sanitizeSvg,
  validateInteractive,
  visualError,
} from '../visuals.mjs'

const mermaid = (source) => normalizeVisualInput({ type: 'mermaid', title: '流程', source })
const echarts = (config) => normalizeVisualInput({ type: 'echarts', title: '统计图', config })
const svg = (source) => normalizeVisualInput({ type: 'svg', title: '信息图', source })
const interactive = (source) => normalizeVisualInput({ type: 'interactive', title: '计算器', source })

test('Mermaid 接受普通流程图并拒绝危险指令', () => {
  const good = mermaid('flowchart TD\n  A[开始] --> B{判断}\n  B -->|是| C[结束]')
  assert.equal(good.type, 'mermaid')
  assert.match(good.source, /flowchart TD/)
  assert.throws(() => validateMermaid('flowchart TD\n A-->B\n click A "javascript:alert(1)"'), (error) => error.code === 'VISUAL_MERMAID_UNSAFE')
})

test('ECharts 只接受声明式配置并拒绝危险渲染类型', () => {
  const option = {
    xAxis: { type: 'category', data: ['2023', '2024'] },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', data: [100, 150] }],
  }
  const normalized = echarts(option)
  assert.equal(JSON.parse(normalized.source).series[0].type, 'bar')
  assert.throws(
    () => validateEChartsOption({ series: [{ type: 'custom' }] }),
    (error) => error.code === 'VISUAL_ECHARTS_UNSUPPORTED',
  )
})

test('SVG 接受安全矢量图并拒绝脚本、事件与外部资源', () => {
  const safe = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60"><rect width="200" height="60" fill="#f5f7fb"/><text x="12" y="36">安全</text></svg>'
  const normalized = svg(safe)
  assert.equal(normalized.type, 'svg')
  assert.match(sanitizeSvg(safe), /<svg/)
  for (const unsafe of [
    '<svg><script>alert(1)</script></svg>',
    '<svg><rect onclick="alert(1)"/></svg>',
    '<svg><image href="https://evil.example/x.png"/></svg>',
  ]) {
    assert.throws(() => sanitizeSvg(unsafe), (error) => error.code === 'VISUAL_SVG_UNSAFE')
  }
})

test('交互组件只接受固定贷款参数且不执行任意表达式', () => {
  const good = interactive(JSON.stringify({
    kind: 'loan-calculator',
    fields: [
      { key: 'principal', label: '贷款金额', unit: '万元', min: 10, max: 500, step: 10, value: 100 },
      { key: 'rate', label: '年利率', unit: '%', min: 0.5, max: 15, step: 0.1, value: 4.2 },
      { key: 'years', label: '贷款期限', unit: '年', min: 1, max: 30, step: 1, value: 20 },
    ],
  }))
  assert.equal(JSON.parse(good.source).kind, 'loan-calculator')
  assert.throws(
    () => validateInteractive(JSON.stringify({ kind: 'loan-calculator', fields: [{ key: 'principal', formula: 'eval(1)' }] })),
    (error) => String(error.code || '').startsWith('VISUAL_INTERACTIVE'),
  )
})

test('未知类型与空源码返回明确错误码', () => {
  assert.throws(() => normalizeVisualInput({ type: 'html', source: '<div/>' }), (error) => error.code === 'VISUAL_TYPE_UNSUPPORTED')
  assert.throws(() => mermaid(''), (error) => error.code === 'VISUAL_SOURCE_EMPTY')
  assert.equal(visualError('测试', 'TEST').code, 'TEST')
})
