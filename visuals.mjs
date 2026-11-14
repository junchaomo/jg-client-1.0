/**
 * Visual Engine 源数据校验与清理。
 *
 * 这里只做“服务端可确定”的校验：渲染仍在浏览器中完成，但模型输出在进入
 * 前端之前必须先通过类型、长度、危险标记和 ECharts 声明式配置检查。
 * Mermaid 会在前端使用 securityLevel:'strict' 再渲染一次。
 */

export const VISUAL_TYPES = ['mermaid', 'echarts', 'svg', 'interactive']
export const VISUAL_TYPE_LABELS = {
  mermaid: 'Mermaid 流程图',
  echarts: 'ECharts 统计图',
  svg: 'SVG 信息图',
  interactive: '交互组件',
}
export const VISUAL_MAX_SOURCE = 60000
export const VISUAL_MAX_TITLE = 120

function cleanTitle(value, fallback = '可视化') {
  const text = String(value || '').replace(/\s+/g, ' ').trim().slice(0, VISUAL_MAX_TITLE)
  return text || fallback
}

function containsDangerousText(text) {
  const value = String(text || '')
  return /<script\b|javascript\s*:|vbscript\s*:|data\s*:\s*text\/html|on(?:load|error|click|mouseover)\s*=/i.test(value)
}

/**
 * SVG 清理：删除可执行标签、事件属性、外部 href/src 和样式中的远程资源。
 * 采用白名单式保守删除，而不是“只替换几个关键字”。
 */
export function sanitizeSvg(raw) {
  let svg = String(raw || '').replace(/\uFEFF/g, '').trim()
  if (!svg) throw visualError('SVG 内容为空', 'VISUAL_SOURCE_EMPTY')
  if (svg.length > VISUAL_MAX_SOURCE) throw visualError('SVG 源码过大，已拒绝渲染', 'VISUAL_SOURCE_TOO_LARGE')
  if ((svg.match(/<\s*[a-z][\w:-]*\b/gi) || []).length > 3000) throw visualError('SVG 节点过多，已拒绝渲染', 'VISUAL_SVG_TOO_LARGE')
  if (/<!doctype|<!entity/i.test(svg)) throw visualError('SVG 不允许 DOCTYPE 或实体声明', 'VISUAL_SVG_UNSAFE')
  if (/<\s*(script|iframe|object|embed|foreignObject|link|meta|base|form|input|textarea|button|audio|video)\b/i.test(svg) ||
      /\son[a-z0-9_-]+\s*=/i.test(svg) ||
      /javascript\s*:|vbscript\s*:/i.test(svg) ||
      /(?:href|src)\s*=\s*["']?\s*(?:https?:|ftp:|file:|data:text\/html)/i.test(svg) ||
      /url\s*\(\s*["']?\s*(?:https?:|ftp:|file:)/i.test(svg) ||
      /@import|expression\s*\(/i.test(svg)) {
    throw visualError('SVG 包含脚本、事件处理器、外部资源或其他不安全内容，已拒绝渲染', 'VISUAL_SVG_UNSAFE')
  }
  svg = svg
    .replace(/<\s*(script|iframe|object|embed|foreignObject|link|meta|base|form|input|textarea|button|audio|video)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|iframe|object|embed|foreignObject|link|meta|base|form|input|textarea|button|audio|video)\b[^>]*\/?\s*>/gi, '')
    .replace(/<\s*style\b[\s\S]*?<\s*\/\s*style\s*>/gi, '')
    .replace(/\s+on[a-z0-9_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+(href|xlink:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi, (whole, name, dq, sq, bare) => {
      const value = String(dq ?? sq ?? bare ?? '').trim()
      if (value.startsWith('#') || /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(value)) return whole
      return ''
    })
    .replace(/\burl\s*\(\s*(['"]?)(?:https?|ftp|file):\/\/[\s\S]*?\)/gi, 'none')
    .replace(/\b(?:javascript|vbscript)\s*:/gi, '')
    .replace(/\s+style\s*=\s*(?:"([^"]*)"|'([^']*)')/gi, (whole, dq, sq) => {
      const value = String(dq ?? sq ?? '')
      if (/url\s*\(|expression\s*\(|@import|javascript\s*:/i.test(value)) return ''
      return whole
    })
  if (!/^<svg[\s>]/i.test(svg) && !/^<[a-z][\w:-]*[\s>]/i.test(svg)) {
    throw visualError('SVG 必须是一个可渲染的 SVG/XML 图形根节点', 'VISUAL_SVG_INVALID')
    }
  return svg
}

function assertSafeStrings(value, seen = new Set()) {
  if (value == null) return
  if (typeof value === 'string') {
    if (containsDangerousText(value)) throw visualError('ECharts 配置包含不安全字符串', 'VISUAL_ECHARTS_UNSAFE')
    if (/^(?:https?|ftp|file):\/\//i.test(value.trim())) throw visualError('ECharts 配置不允许外部资源 URL', 'VISUAL_ECHARTS_EXTERNAL_URL')
    return
  }
  if (Array.isArray(value)) {
    if (value.length > 5000) throw visualError('ECharts 数据点过多，已拒绝渲染', 'VISUAL_ECHARTS_TOO_LARGE')
    value.forEach((item) => assertSafeStrings(item, seen))
    return
  }
  if (typeof value === 'object') {
    if (seen.has(value)) throw visualError('ECharts 配置不允许循环引用', 'VISUAL_ECHARTS_INVALID')
    seen.add(value)
    const keys = Object.keys(value)
    if (keys.length > 300) throw visualError('ECharts 配置节点过多', 'VISUAL_ECHARTS_TOO_LARGE')
    for (const key of keys) {
      if (/^(__proto__|constructor|prototype)$/.test(key)) throw visualError('ECharts 配置包含危险键', 'VISUAL_ECHARTS_UNSAFE')
      if (/^(custom|renderItem)$/.test(key)) throw visualError('ECharts 不允许自定义渲染函数', 'VISUAL_ECHARTS_UNSAFE')
      assertSafeStrings(value[key], seen)
    }
  }
}

export function validateEChartsOption(config) {
  let option = config
  if (typeof option === 'string') {
    try { option = JSON.parse(option) } catch { throw visualError('ECharts 配置不是合法 JSON', 'VISUAL_ECHARTS_INVALID') }
  }
  if (!option || typeof option !== 'object' || Array.isArray(option)) throw visualError('ECharts 配置必须是对象', 'VISUAL_ECHARTS_INVALID')
  assertSafeStrings(option)
  const series = Array.isArray(option.series) ? option.series : (option.series ? [option.series] : [])
  if (!series.length) throw visualError('ECharts 配置缺少 series', 'VISUAL_ECHARTS_INVALID')
  if (series.length > 20) throw visualError('ECharts series 数量过多', 'VISUAL_ECHARTS_TOO_LARGE')
  for (const item of series) {
    if (!item || typeof item !== 'object') throw visualError('ECharts series 项必须是对象', 'VISUAL_ECHARTS_INVALID')
    const kind = String(item.type || '')
    if (!['line', 'bar', 'pie', 'scatter', 'effectScatter', 'radar', 'gauge', 'funnel', 'treemap', 'sankey', 'heatmap', 'boxplot', 'candlestick', 'map'].includes(kind)) {
      throw visualError(`不支持的 ECharts series 类型：${kind || '未声明'}`, 'VISUAL_ECHARTS_UNSUPPORTED')
    }
  }
  const text = JSON.stringify(option)
  if (text.length > VISUAL_MAX_SOURCE) throw visualError('ECharts 配置过大', 'VISUAL_SOURCE_TOO_LARGE')
  return text
}

export function validateMermaid(source) {
  const text = String(source || '').replace(/\uFEFF/g, '').trim()
  if (!text) throw visualError('Mermaid 源码为空', 'VISUAL_SOURCE_EMPTY')
  if (text.length > VISUAL_MAX_SOURCE) throw visualError('Mermaid 源码过大', 'VISUAL_SOURCE_TOO_LARGE')
  if (/<script\b|javascript\s*:|%%\s*\{\s*init\b|securityLevel\s*:\s*loose|click\s+[^\n]*call/i.test(text)) {
    throw visualError('Mermaid 源码包含不安全指令', 'VISUAL_MERMAID_UNSAFE')
  }
  return text
}

const INTERACTIVE_FIELDS = {
  principal: { key: 'principal', label: '贷款金额', unit: '万元', min: 1, max: 5000, step: 1, default: 100 },
  rate: { key: 'rate', label: '年利率', unit: '%', min: 0.1, max: 24, step: 0.1, default: 4.2 },
  years: { key: 'years', label: '贷款期限', unit: '年', min: 1, max: 40, step: 1, default: 20 },
}

export function validateInteractive(source) {
  let spec = source
  if (typeof spec === 'string') {
    try { spec = JSON.parse(spec) } catch { throw visualError('交互组件配置不是合法 JSON', 'VISUAL_INTERACTIVE_INVALID') }
  }
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw visualError('交互组件配置必须是对象', 'VISUAL_INTERACTIVE_INVALID')
  const rawKind = String(spec.kind || '').toLowerCase()
  if (!['loan', 'loan-calculator', 'mortgage', 'mortgage-calculator'].includes(rawKind)) {
    throw visualError('暂只支持安全的贷款计算器交互组件', 'VISUAL_INTERACTIVE_UNSUPPORTED')
  }
  const rawFields = Array.isArray(spec.fields) && spec.fields.length ? spec.fields : Object.values(INTERACTIVE_FIELDS)
  const fields = rawFields.map((item) => {
    const key = String(item?.key || '').toLowerCase()
    const base = INTERACTIVE_FIELDS[key]
    if (!base) throw visualError(`不支持的交互参数：${key || '未声明'}`, 'VISUAL_INTERACTIVE_UNSUPPORTED')
    const number = (value, fallback) => {
      const n = Number(value)
      return Number.isFinite(n) ? n : fallback
    }
    return {
      ...base,
      label: cleanTitle(item?.label || base.label, base.label),
      min: number(item?.min, base.min),
      max: number(item?.max, base.max),
      step: Math.max(0.01, number(item?.step, base.step)),
      value: number(item?.value, base.default),
    }
  })
  if (fields.length !== 3 || new Set(fields.map((f) => f.key)).size !== 3) {
    throw visualError('交互组件的参数必须包含贷款金额、年利率和期限', 'VISUAL_INTERACTIVE_INVALID')
  }
  for (const field of fields) {
    if (!(field.min < field.max)) throw visualError(`${field.label}的取值区间无效`, 'VISUAL_INTERACTIVE_INVALID')
    field.value = Math.min(field.max, Math.max(field.min, field.value))
  }
  const text = JSON.stringify({ kind: 'loan-calculator', title: cleanTitle(spec.title, '贷款月供计算器'), fields })
  if (text.length > 5000) throw visualError('交互组件配置过大', 'VISUAL_SOURCE_TOO_LARGE')
  return text
}

export function visualError(message, code = 'VISUAL_INVALID') {
  const error = new Error(message)
  error.code = code
  error.status = 422
  return error
}

export function normalizeVisualInput(input = {}) {
  const type = String(input.type || '').toLowerCase()
  if (!VISUAL_TYPES.includes(type)) throw visualError(`不支持的可视化类型：${type || '未声明'}`, 'VISUAL_TYPE_UNSUPPORTED')
  const title = cleanTitle(input.title || input.name, VISUAL_TYPE_LABELS[type])
  let source
  if (type === 'echarts') {
    source = validateEChartsOption(input.config ?? input.option ?? input.source)
  } else if (type === 'mermaid') {
    source = validateMermaid(input.source ?? input.code)
  } else if (type === 'interactive') {
    source = validateInteractive(input.config ?? input.source ?? input.code)
  } else {
    source = sanitizeSvg(input.source ?? input.code)
  }
  return { type, title, source, caption: String(input.caption || '').slice(0, 500) }
}

export function parseStoredVisual(visual) {
  if (!visual) return null
  return {
    ...visual,
    source: String(visual.source || ''),
    version: Number(visual.version || 1),
  }
}
