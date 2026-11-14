/**
 * 数据格式基座
 * PDF / GIS / CAD 是平台级的读写能力，不是数据中心的功能模块。
 * 数据中心、智能笔记本、Agent 与 MCP 工具都通过这一层调用，不直接依赖具体解析器。
 */
import { inspectPdf, mergePdfs, splitPdf, extractText } from './pdf.mjs'
import { inspectSpatial, inspectDXF } from './geo.mjs'
import { exportGeoArchive, inspectGeoArchive, isGeoArchive, convertGeoArchive, convertGeoBuffer, convertGeoFiles } from './gis-datasets.mjs'

export const FORMAT_REGISTRY = [
  {
    id: 'pdf',
    label: 'PDF',
    family: '文档',
    extensions: ['.pdf'],
    mimeTypes: ['application/pdf'],
    read: ['文件头校验', '页数与页面尺寸', '元数据', '文本提取', '内嵌预览'],
    write: ['合并', '按页范围拆分'],
    note: '本机 pdf-lib 运行时；合并与拆分输出新的 PDF 文件。',
  },
  {
    id: 'gis',
    label: 'GIS / SHP / GDB / GeoJSON',
    family: '空间数据',
    extensions: ['.geojson', '.json', '.shp', '.gdb', '.zip'],
    mimeTypes: ['application/geo+json', 'application/json', 'application/zip', 'application/octet-stream'],
    read: ['GeoJSON 要素与几何类型', 'Shapefile 要素/属性', 'File Geodatabase 多图层', 'SHP / GDB 文件夹直读', 'ZIP 数据包', '范围 bbox', '坐标系声明', 'SVG 几何预览'],
    write: ['输出 Shapefile（.shp/.dbf/.shx/.prj）', '输出 File Geodatabase（.gdb 文件夹）', '多个 SHP 合并为一个 GDB', 'SHP / GDB / GeoJSON 互转'],
    note: 'GIS 以 SHP 与 GDB 为主格式：SHP 可直接选择文件夹或一次多选 .shp/.dbf/.shx/.prj，GDB 直接选择 .gdb 文件夹，均不需要压缩；GeoJSON 可转换为 SHP 或 GDB。GDB 下载为 ZIP，解压后为 .gdb 文件夹。',
  },
  {
    id: 'cad',
    label: 'CAD / DXF',
    family: '空间数据',
    extensions: ['.dxf'],
    mimeTypes: ['application/dxf', 'image/vnd.dxf'],
    read: ['ASCII DXF 实体', '图层', '范围 bbox', 'SVG 几何预览'],
    write: ['LINE / LWPOLYLINE / CIRCLE / TEXT 导出为 ASCII DXF'],
    note: 'DWG 需先转换为 DXF；当前不是原生 CAD 引擎，不伪造 DWG 支持。',
  },
]

export function detectDataFormat(name = '', mime = '', buffer = null) {
  const lower = String(name || '').toLowerCase()
  const type = String(mime || '').toLowerCase().split(';')[0]
  if (buffer && Buffer.from(buffer).subarray(0, 5).toString() === '%PDF-') return 'pdf'
  if (type === 'application/pdf' || lower.endsWith('.pdf')) return 'pdf'
  if (lower.endsWith('.dxf') || type === 'application/dxf' || type === 'image/vnd.dxf') return 'cad'
  if (lower.endsWith('.shp') || lower.endsWith('.gdb') || lower.endsWith('.zip')) return 'gis'
  if (lower.endsWith('.geojson') || type === 'application/geo+json') return 'gis'
  if (lower.endsWith('.json') || type === 'application/json') return 'gis'
  return ''
}

export function formatMeta(id) {
  return FORMAT_REGISTRY.find((item) => item.id === id) || null
}

export async function inspectDataFormat(buffer, name = '', mime = '') {
  if (isGeoArchive(name)) return inspectGeoArchive(buffer, name)
  const id = detectDataFormat(name, mime, buffer)
  if (!id) throw Object.assign(new Error(`无法识别数据格式：${name || '未命名文件'}；当前基座支持 PDF、GeoJSON 与 ASCII DXF。`), { status: 415 })
  if (id === 'pdf') {
    if (Buffer.from(buffer).subarray(0, 5).toString() !== '%PDF-') throw Object.assign(new Error('不是有效的 PDF 文件（缺少 %PDF- 文件头）'), { status: 422 })
    const info = await inspectPdf(buffer)
    return { format: 'pdf', formatLabel: 'PDF', kind: 'pdf', ...info }
  }
  const spatial = inspectSpatial(buffer, name)
  return { format: id, formatLabel: formatMeta(id)?.label || id.toUpperCase(), ...spatial }
}

export async function extractDataFormat(buffer, name = '', mime = '') {
  if (isGeoArchive(name)) {
    const dataset = await inspectGeoArchive(buffer, name)
    return {
      format: 'gis',
      formatLabel: dataset.formatLabel,
      kind: dataset.kind,
      features: dataset.features,
      layers: dataset.layers,
      bbox: dataset.bbox,
      crs: dataset.crs,
      fields: dataset.fields,
      note: dataset.note,
    }
  }
  const id = detectDataFormat(name, mime, buffer)
  if (id === 'pdf') {
    if (Buffer.from(buffer).subarray(0, 5).toString() !== '%PDF-') throw Object.assign(new Error('不是有效的 PDF 文件（缺少 %PDF- 文件头）'), { status: 422 })
    return { format: 'pdf', formatLabel: 'PDF', ...extractText(buffer) }
  }
  if (id === 'gis' || id === 'cad') {
    const spatial = inspectSpatial(buffer, name)
    return { format: id, formatLabel: formatMeta(id)?.label || id.toUpperCase(), kind: spatial.kind, features: spatial.features, layers: spatial.layers, bbox: spatial.bbox, note: '空间数据以要素/实体元数据读取；完整几何通过 inspect 返回。' }
  }
  throw Object.assign(new Error(`无法识别数据格式：${name || '未命名文件'}`), { status: 415 })
}

function normalizeGeoJSON(buffer, name = 'GeoJSON') {
  let data
  try { data = JSON.parse(Buffer.from(buffer).toString('utf8')) } catch (error) {
    throw Object.assign(new Error(`GeoJSON 解析失败：${error.message}`), { status: 422 })
  }
  if (!data || typeof data !== 'object') throw Object.assign(new Error('GeoJSON 根节点不是对象'), { status: 422 })
  if (data.type === 'FeatureCollection' && !Array.isArray(data.features)) throw Object.assign(new Error('FeatureCollection 缺少 features 数组'), { status: 422 })
  let features
  if (data.type === 'FeatureCollection') features = data.features
  else if (data.type === 'Feature') features = [data]
  else if (/Geometry$/.test(String(data.type || ''))) features = [{ type: 'Feature', properties: {}, geometry: data }]
  else throw Object.assign(new Error(`不支持的 GeoJSON 类型：${data.type || '未知'}`), { status: 422 })
  const normalized = {
    type: 'FeatureCollection',
    name: data.name || name.replace(/\.(geojson|json)$/i, ''),
    features,
  }
  if (data.crs) normalized.crs = data.crs
  return Buffer.from(JSON.stringify(normalized, null, 2), 'utf8')
}

function num(value) {
  const n = Number(value)
  return Number.isFinite(n) ? String(Math.round(n * 1000) / 1000) : '0'
}

function dxfEntity(entity) {
  const layer = String(entity.layer || '0').replace(/[\r\n]/g, ' ')
  if (entity.type === 'LINE') {
    return ['0', 'LINE', '8', layer, '10', num(entity.x1), '20', num(entity.y1), '11', num(entity.x2), '21', num(entity.y2)].join('\n') + '\n'
  }
  if (entity.type === 'CIRCLE') {
    return ['0', 'CIRCLE', '8', layer, '10', num(entity.cx), '20', num(entity.cy), '40', num(entity.r)].join('\n') + '\n'
  }
  if (entity.type === 'TEXT') {
    return ['0', 'TEXT', '8', layer, '10', num(entity.x), '20', num(entity.y), '1', String(entity.text || '').replace(/[\r\n]/g, ' ')].join('\n') + '\n'
  }
  if (Array.isArray(entity.vertices) && entity.vertices.length >= 2) {
    const lines = ['0', 'LWPOLYLINE', '8', layer, '90', String(entity.vertices.length)]
    for (const [x, y] of entity.vertices) lines.push('10', num(x), '20', num(y))
    return lines.join('\n') + '\n'
  }
  return ''
}

function exportDXF(buffer, name = 'DXF') {
  const parsed = inspectDXF(buffer, name)
  const body = (parsed.entities || []).map(dxfEntity).join('')
  if (!body) throw Object.assign(new Error('DXF 中没有可导出的实体'), { status: 422 })
  const text = [
    '0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1015', '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES', body + '0', 'ENDSEC',
    '0', 'EOF', '',
  ].join('\n')
  return Buffer.from(text, 'utf8')
}

function safeBase(name = '') {
  return String(name || '数据').replace(/\.(pdf|geojson|json|dxf|zip|shp|gdb)$/i, '').replace(/[\\/:*?"<>|]/g, '_').trim() || '数据'
}

/**
 * @returns {Promise<{outputs:Array<{name:string,buffer:Buffer,label?:string,format:string}>}>}
 */
export async function exportDataFormat({ format, op, buffer, buffers = [], files = [], ranges = '', name = '', target = '' }) {
  if (format === 'gis' && op === 'convert') {
    const wanted = String(target || '').toLowerCase()
    if (!['shp', 'gdb'].includes(wanted)) throw Object.assign(new Error('GIS 转换目标只支持 shp 或 gdb'), { status: 400 })
    if (Array.isArray(files) && files.length) return convertGeoFiles(files, name, wanted)
    if (!buffer) throw Object.assign(new Error('缺少空间数据文件'), { status: 400 })
    if (isGeoArchive(name)) return convertGeoArchive(buffer, name, wanted)
    return convertGeoBuffer(buffer, name, wanted)
  }
  if (isGeoArchive(name)) {
    if (op !== 'normalize') throw Object.assign(new Error('SHP / GDB 压缩包当前只支持规范化输出 GeoJSON'), { status: 400 })
    return exportGeoArchive(buffer, name)
  }
  const id = String(format || detectDataFormat(name, '', buffer) || '')
  if (id === 'pdf') {
    if (op === 'merge') {
      const output = await mergePdfs(buffers)
      return { outputs: [{ name: `${safeBase(name)}-合并.pdf`, buffer: output, format: 'pdf' }] }
    }
    if (op === 'split') {
      const outputs = await splitPdf(buffer, ranges)
      return { outputs: outputs.map((item) => ({ name: `${safeBase(name)}-${item.label}.pdf`, buffer: item.buffer, format: 'pdf', label: item.label })) }
    }
    throw Object.assign(new Error('PDF 输出仅支持 merge 或 split'), { status: 400 })
  }
  if (id === 'gis') {
    if (op !== 'normalize') throw Object.assign(new Error('GIS 输出仅支持 normalize'), { status: 400 })
    return { outputs: [{ name: `${safeBase(name)}-规范化.geojson`, buffer: normalizeGeoJSON(buffer, name), format: 'gis' }] }
  }
  if (id === 'cad') {
    if (op !== 'normalize') throw Object.assign(new Error('CAD 输出仅支持 normalize'), { status: 400 })
    return { outputs: [{ name: `${safeBase(name)}-导出.dxf`, buffer: exportDXF(buffer, name), format: 'cad' }] }
  }
  throw Object.assign(new Error('无法识别输出格式'), { status: 415 })
}
