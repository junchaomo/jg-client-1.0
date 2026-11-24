/**
 * 地下管网三维模块 · 数据与空间分析服务
 *
 * 职责边界：
 *   - 只做数据接入、标准化、建模参数与确定性几何计算，不做 UI，不直接改 sqlite。
 *   - 落库一律走 db.mjs 导出的函数；调用方（server.mjs）负责 audit 与持久化。
 *   - AI 只能调用这里封装的分析结果，不参与数值判定。
 *
 * 数据来源：
 *   CAD：DWG / DXF。DWG 为闭源二进制，容器内没有 ODA 许可，只能提示另存 DXF；
 *        DXF 走本文件的文本解析器（图元、图层、文字注记）。
 *   普查成果：SHP / GDB / GeoJSON / CSV，读取由 gis-bridge.py 完成（保留 Z）。
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  clearPipelineFeatures, countPipeLines, countPipeNodes, createPipelineDataset, getPipeAnalysisRun,
  getPipelineDataset, insertPipeAnalysisRun, insertPipeIssue, insertPipeLine, insertPipeNode,
  listPipeAnalysisRuns, listPipeIssues, listPipeLines, listPipeNodes, listPipeTopology, listPipelineDatasets,
  replacePipeTopology, resolvePipeIssue, softDeletePipeAnalysisRun, softDeletePipelineDataset,
  updatePipelineDatasetCounts, updatePipelineDatasetMeta, withPipeWriteTransaction,
} from './db.mjs'

const ROOT = dirname(fileURLToPath(import.meta.url))
const BRIDGE = join(ROOT, 'gis-bridge.py')
const VENDOR_GIS = join(ROOT, 'vendor', 'gis')
const MAX_IMPORT_FEATURES = 200000
const MAX_SCENE_FEATURES = 20000
const Z_TOLERANCE = 0.05

/* ------------------------------ 常量 ------------------------------ */

export const PIPE_MAJOR = {
  supply: { label: '供水', color: '#2f7dd1', rule: '有压', depth: 'cover' },
  distribution: { label: '配水', color: '#5fa8dd', rule: '有压', depth: 'cover' },
  rain: { label: '雨水', color: '#3f86a8', rule: '重力', depth: 'invert' },
  intercept: { label: '截污', color: '#7f9440', rule: '重力', depth: 'invert' },
  sewage: { label: '污水', color: '#5a8f4a', rule: '重力', depth: 'invert' },
  combined: { label: '合流', color: '#8f8a4a', rule: '重力', depth: 'invert' },
  power: { label: '电力', color: '#7a4fb5', rule: '无压', depth: 'cover' },
  telecom: { label: '通信', color: '#2f9c94', rule: '无压', depth: 'cover' },
  gas: { label: '燃气', color: '#c88a1e', rule: '有压', depth: 'cover' },
  heat: { label: '热力', color: '#b4472f', rule: '有压', depth: 'cover' },
  gallery: { label: '管廊', color: '#6b6f76', rule: '无压', depth: 'invert' },
  other: { label: '其他', color: '#9aa0a6', rule: '未知', depth: 'cover' },
}

// 细分在前，避免"配水"被"供水"、"截污/雨水"被"排水"先命中
const MAJOR_KEYWORDS = [
  ['distribution', ['配水', 'distribution', 'pswater']],
  ['supply', ['给水', '供水', '自来水', 'water', 'ws', 'js', '给水管']],
  ['rain', ['雨水', 'rain', 'storm', 'ys']],
  ['intercept', ['截污', 'intercept']],
  ['sewage', ['污水', 'sewage', 'waste', 'ps', '排水']],
  ['combined', ['合流', 'combined', '合流制']],
  ['gas', ['燃气', '天然气', '煤气', 'gas', 'rq']],
  ['heat', ['热力', '供热', '蒸汽', 'heat', 'rl']],
  ['power', ['电力', '供电', '路灯', 'power', 'electric', 'dl']],
  ['telecom', ['通信', '通讯', '电信', '移动', '联通', '广电', 'telecom', 'comm', 'tx']],
  ['gallery', ['管廊', '综合管沟', '共同沟', 'gallery', 'trench']],
]

/** 常见成果字段别名。映射模板可整体覆盖，别名只用于自动识别。 */
const FIELD_ALIASES = {
  nodeCode: ['点号', '物探点号', '管点编号', '节点编号', '节点号', '编号', 'code', 'node_code', 'nodecode', 'nodeid', 'no'],
  lineCode: ['管段编号', '线段编号', '管段号', '线号', 'line_code', 'linecode', 'lineid', 'lcode', 'code'],
  nodeStart: ['起点点号', '起始点号', '起点编号', '始点号', 'start_node', 'startnode', 'node_start', 'snode', 'scode', 'qs', 'qddh'],
  nodeEnd: ['终点点号', '结束点号', '终点编号', 'end_node', 'endnode', 'node_end', 'enode', 'ecode', 'zzdh'],
  category: ['附属物', '特征', '管点类型', '类型', 'category', 'type', 'feature'],
  x: ['x', 'x坐标', '横坐标', '东坐标', 'easting', 'coordx', 'x_coord', 'xcoord'],
  y: ['y', 'y坐标', '纵坐标', '北坐标', 'northing', 'coordy', 'y_coord', 'ycoord'],
  groundElev: ['地面高程', '地面标高', '地表高程', 'ground_elev', 'groundelev', 'elev_ground', 'dm', 'gelev', 'ground_z'],
  z: ['管点高程', '点高程', '高程', '标高', 'z', 'elev', 'elevation', 'z_coord', 'zelev', 'z_elev', 'point_z'],
  coverDepth: ['埋深', '覆土深度', '管顶埋深', 'cover_depth', 'coverdepth', 'depth', 'ms'],
  coverMaterial: ['井盖材质', '盖材质', 'cover_material'],
  coverSize: ['井盖尺寸', '盖尺寸', 'cover_size'],
  chamberShape: ['井形状', '井室形状', 'chamber_shape'],
  chamberSize: ['井室尺寸', '井尺寸', 'chamber_size'],
  road: ['所在道路', '道路', '道路名称', 'road', 'street'],
  address: ['地址', '位置', '门牌', 'address', 'addr'],
  owner: ['权属单位', '产权单位', '权属', 'owner', 'unit'],
  buildYear: ['埋设年代', '敷设年代', '建设年代', 'build_year', 'buildyear', 'year'],
  surveyDate: ['探测时间', '测量时间', 'survey_date'],
  surveyUnit: ['探测单位', '测量单位', 'survey_unit'],
  status: ['使用状态', '状态', 'status', 'state'],
  pipeMajor: ['管线类型', '管线种类', '管线性质', '专业', '种类', 'pipe_major', 'pipetype', 'major', 'category'],
  material: ['材质', '管材', '管线材质', 'material', 'mat'],
  profileType: ['断面类型', '形状', '断面形状', 'profile_type', 'section'],
  profileSize: ['管径', '断面尺寸', '管径或断面', '规格', '直径', 'profile_size', 'diameter', 'size', 'dn', '口径'],
  wallThickness: ['壁厚', '管壁厚度', 'wall_thickness'],
  buryType: ['敷设方式', '埋设方式', 'bury_type', 'laying'],
  startDepth: ['起点埋深', '起始埋深', 'start_depth', 'startdepth', 'sdep'],
  endDepth: ['终点埋深', '结束埋深', 'end_depth', 'enddepth', 'edep'],
  startElev: ['起点高程', '起点标高', 'start_elev', 'startelev', 'selev'],
  endElev: ['终点高程', '终点标高', 'end_elev', 'endelev', 'eelev'],
  flowDir: ['流向', 'flow_dir', 'flow', 'direction'],
  length: ['长度', '管线长度', 'length', 'len'],
  holeCount: ['总孔数', '孔数', 'hole_count'],
  cabCount: ['条数', '孔数', 'cab_count'],
  pressure: ['压力', 'pressure'],
  voltage: ['电压', 'voltage'],
  lineStyle: ['线型', 'line_style'],
}

/** 净距规则（按管线类别，单位 m）。来源标注为「企业内控默认值」，
 *  实际项目应按现行规范与地方标准在规则表中替换；分析结果里会带上 rule 字段。 */
const CLEARANCE_RULES = {
  default: { horizontal: 1.0, vertical: 0.5, source: '企业内控默认值', note: '需按现行规范与地方标准复核' },
  supply: { horizontal: 0.8, vertical: 0.3, source: '企业内控默认值' },
  distribution: { horizontal: 0.8, vertical: 0.3, source: '企业内控默认值' },
  rain: { horizontal: 1.0, vertical: 0.4, source: '企业内控默认值' },
  intercept: { horizontal: 1.0, vertical: 0.4, source: '企业内控默认值' },
  sewage: { horizontal: 1.0, vertical: 0.4, source: '企业内控默认值' },
  combined: { horizontal: 1.0, vertical: 0.4, source: '企业内控默认值' },
  gas: { horizontal: 1.2, vertical: 0.5, source: '企业内控默认值' },
  power: { horizontal: 0.8, vertical: 0.5, source: '企业内控默认值' },
  telecom: { horizontal: 0.6, vertical: 0.3, source: '企业内控默认值' },
  heat: { horizontal: 1.0, vertical: 0.4, source: '企业内控默认值' },
}

/* --------------------------- 工具函数 --------------------------- */

function num(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(String(value).replace(/[^\d.+-]/g, ''))
  return Number.isFinite(n) ? n : null
}

function text(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function round(value, digits = 2) {
  if (!Number.isFinite(value)) return null
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function normalizeKey(value) {
  return String(value || '').toLowerCase().replace(/[\s_\-（）()【】\[\]:：]/g, '')
}

function pickField(record, aliases) {
  const entries = Object.keys(record || {})
  const normalized = new Map(entries.map((key) => [normalizeKey(key), key]))
  for (const alias of aliases) {
    const hit = normalized.get(normalizeKey(alias))
    if (hit !== undefined) return hit
  }
  // 退化匹配：包含关系（仅当唯一命中，避免误取）
  for (const alias of aliases) {
    const key = normalizeKey(alias)
    if (key.length < 2) continue
    const hits = entries.filter((entry) => normalizeKey(entry).includes(key))
    if (hits.length === 1) return hits[0]
  }
  return ''
}

function fieldValue(record, aliases) {
  const key = pickField(record, aliases)
  return key ? record[key] : ''
}

/** 按字段映射模板取值：mapping 中给出源字段名，未给出则自动识别。 */
function mapped(record, mapping, name) {
  const explicit = mapping && mapping[name]
  if (explicit && Object.prototype.hasOwnProperty.call(record, explicit)) return record[explicit]
  return fieldValue(record, FIELD_ALIASES[name] || [])
}

function detectMajor(...values) {
  for (const value of values) {
    const raw = normalizeKey(value)
    if (!raw) continue
    for (const [key, keywords] of MAJOR_KEYWORDS) {
      if (keywords.some((keyword) => raw.includes(normalizeKey(keyword)))) return key
    }
  }
  return ''
}

/** 断面尺寸解析：DN300 / D300 / Φ300 / 300x200 / 3孔 等。 */
export function parseProfile(value) {
  const raw = text(value)
  if (!raw) return { profileType: '', sizeMm: null, widthMm: null, heightMm: null, label: '' }
  const rect = raw.match(/(\d+(?:\.\d+)?)\s*(?:[×xX*]|✕)\s*(\d+(?:\.\d+)?)/)
  if (rect) {
    const a = Number(rect[1])
    const b = Number(rect[2])
    const scale = a > 0 && a < 10 ? 1000 : 1
    return {
      profileType: '矩形', sizeMm: round(Math.max(a, b) * scale, 0),
      widthMm: round(Math.min(a, b) * scale, 0), heightMm: round(Math.max(a, b) * scale, 0), label: raw,
    }
  }
  const dn = raw.match(/(?:dn|d|φ|ф|Φ|直径|管径)\s*[:=]?\s*(\d+(?:\.\d+)?)/i) || raw.match(/(\d+(?:\.\d+)?)\s*mm/i)
  if (dn) {
    const value2 = Number(dn[1])
    const mm = value2 > 0 && value2 < 10 ? value2 * 1000 : value2
    return { profileType: '圆形', sizeMm: round(mm, 0), widthMm: round(mm, 0), heightMm: round(mm, 0), label: raw }
  }
  const plain = raw.match(/(\d+(?:\.\d+)?)/)
  if (plain) {
    const value3 = Number(plain[1])
    const mm = value3 > 0 && value3 < 10 ? value3 * 1000 : value3
    return { profileType: '圆形', sizeMm: round(mm, 0), widthMm: round(mm, 0), heightMm: round(mm, 0), label: raw }
  }
  return { profileType: '', sizeMm: null, widthMm: null, heightMm: null, label: raw }
}

/* ---------------------------- 坐标处理 ---------------------------- */
/**
 * 场景使用局部平面坐标（单位 m）。规则：
 *   - 经纬度（|x|<=180、|y|<=90）：以数据中心为原点做局部切平面，米制。
 *   - 投影坐标（米）：以数据中心为原点的平移，保持轴向与尺度不变，不做投影反算。
 * 原始坐标完整保留在 attrs（src_x / src_y），供溯源与导出。
 */
function isGeographic(points, lines, crs, sourceType) {
  const raw = String(crs || '').toLowerCase()
  if (/4326|wgs84|地理|经纬/.test(raw)) return true
  // CAD 设计图纸是工程平面坐标（常是 0~几百米的图纸范围），不能按数值落区猜经纬度
  if (/^cad/.test(String(sourceType || ''))) return false
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  let count = 0
  for (const item of points) {
    const [x, y] = item.coords
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    minX = Math.min(minX, x); maxX = Math.max(maxX, x)
    minY = Math.min(minY, y); maxY = Math.max(maxY, y)
    count += 1
  }
  for (const item of lines) {
    for (const coordinate of item.coords) {
      const [x, y] = coordinate
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue
      minX = Math.min(minX, x); maxX = Math.max(maxX, x)
      minY = Math.min(minY, y); maxY = Math.max(maxY, y)
      count += 1
    }
  }
  if (!count) return false
  return minX >= -180 && maxX <= 180 && minY >= -90 && maxY <= 90
}

function buildProjector(points, lines, crs, sourceType) {
  const geographic = isGeographic(points, lines, crs, sourceType)
  // 逐点累加边界：大图纸坐标点可达数十万，用 Math.min(...arr) 展开会把调用栈打爆
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  let count = 0
  const take = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
    count += 1
  }
  for (const item of points) take(item.coords[0], item.coords[1])
  for (const item of lines) for (const coordinate of item.coords) take(coordinate[0], coordinate[1])
  if (!count) { minX = 0; maxX = 0; minY = 0; maxY = 0 }
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  if (geographic) {
    const metersPerDegLat = 110574
    const metersPerDegLng = 111320 * Math.cos((cy * Math.PI) / 180)
    return {
      mode: 'geographic',
      origin: { x: cx, y: cy },
      note: '经纬度坐标，按数据中心点做局部切平面（米制）；用于浏览与相对关系分析，不作为测量成果。',
      project(x, y) {
        return { x: (x - cx) * metersPerDegLng, y: (y - cy) * metersPerDegLat }
      },
    }
  }
  return {
    mode: 'projected',
    origin: { x: cx, y: cy },
    note: '投影 / 工程平面坐标，以数据中心为场景原点平移，保持原有轴向与尺度。',
    project(x, y) {
      return { x: x - cx, y: y - cy }
    },
  }
}

/* --------------------------- GIS 桥调用 --------------------------- */

function findGeoDatasets(root) {
  const found = []
  const stack = [root]
  while (stack.length) {
    const current = stack.pop()
    let entries = []
    try { entries = readdirSync(current, { withFileTypes: true }) } catch { continue }
    for (const entry of entries) {
      const full = join(current, entry.name)
      const lower = entry.name.toLowerCase()
      if (entry.isDirectory() && lower.endsWith('.gdb')) { found.push(full); continue }
      if (entry.isDirectory()) { stack.push(full); continue }
      if (entry.isFile() && (lower.endsWith('.shp') || lower.endsWith('.geojson') || lower.endsWith('.json'))) {
        found.push(full)
      }
    }
  }
  return [...new Set(found)]
}

function unzipTo(archivePath, outDir) {
  mkdirSync(outDir, { recursive: true })
  const tar = spawnSync('tar', ['-xf', archivePath, '-C', outDir], { windowsHide: true })
  if (tar.status === 0) return true
  const zip = spawnSync('python', ['-m', 'zipfile', '-e', archivePath, outDir], { windowsHide: true })
  return zip.status === 0
}

function runBridge(command, manifest) {
  const python = process.env.JG_GIS_PYTHON || 'python'
  const temp = mkdtempSync(join(tmpdir(), 'jg-pipe-'))
  const manifestPath = join(temp, 'manifest.json')
  writeFileSync(manifestPath, JSON.stringify(manifest), 'utf8')
  return new Promise((resolve, reject) => {
    const child = spawn(python, [BRIDGE, command, `@${manifestPath}`], {
      cwd: ROOT,
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONPATH: [VENDOR_GIS, process.env.PYTHONPATH].filter(Boolean).join(process.platform === 'win32' ? ';' : ':'),
        PYTHONIOENCODING: 'utf-8',
      },
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', (error) => {
      rmSync(temp, { recursive: true, force: true })
      reject(Object.assign(new Error(`管网解析器启动失败：${error.message}`), { status: 503 }))
    })
    child.on('close', (code) => {
      rmSync(temp, { recursive: true, force: true })
      if (code !== 0) {
        const detail = (stderr || stdout).trim().split(/\r?\n/).filter(Boolean).pop() || `解析器退出码 ${code}`
        return reject(Object.assign(new Error(`管网数据解析失败：${detail}`), { status: 422 }))
      }
      try { resolve(JSON.parse(stdout.trim())) } catch {
        reject(Object.assign(new Error('管网解析器返回了无法识别的结果'), { status: 422 }))
      }
    })
  })
}

/* ------------------------------ DXF 解析 ------------------------------ */

/**
 * 极简 DXF 文本解析：只取 ENTITIES 段中的 LINE / LWPOLYLINE / CIRCLE / TEXT / MTEXT。
 *
 * 性能要点（2026-11-23 优化）：75 MB 级图纸有近千万行组码对，旧实现给每个图元都建 codes 数组，
 * 连 INSERT / POLYLINE / VERTEX 这些不参与建模的图元也全量收下，既吃内存又拖时间。
 * 现在只保留建模真正用到的组码，其余图元在读到组码 0 时直接跳过。
 */
const DXF_KEEP = {
  LINE: ['10', '20', '30', '11', '21', '31'],
  LWPOLYLINE: ['38'],
  CIRCLE: ['10', '20', '30', '40'],
  TEXT: ['1', '3', '10', '20', '30', '40'],
  MTEXT: ['1', '3', '10', '20', '30', '40'],
}

export function parseDxf(textContent) {
  const text = String(textContent || '')
  const entities = []
  const len = text.length
  const endOfLine = (from) => {
    const index = text.indexOf('\n', from)
    return index < 0 ? len : index
  }
  let inEntities = false
  let current = null
  let pos = 0
  while (pos < len) {
    let stop = endOfLine(pos)
    const code = text.slice(pos, stop).trim()
    pos = stop + 1
    if (pos >= len) break
    stop = endOfLine(pos)
    const value = text.slice(pos, stop).trim()
    pos = stop + 1
    if (code === '0') {
      if (current) { entities.push(current); current = null }
      if (value === 'SECTION') { inEntities = false; continue }
      if (value === 'ENDSEC') { inEntities = false; continue }
      if (inEntities && Object.hasOwn(DXF_KEEP, value)) {
        current = { type: value, layer: '0', vals: {}, points: [] }
      }
      continue
    }
    if (code === '2' && value === 'ENTITIES') { inEntities = true; continue }
    if (!current) continue
    if (code === '8') { current.layer = value || '0'; continue }
    if (current.type === 'LWPOLYLINE' && (code === '10' || code === '20')) {
      if (code === '10') current.points.push({ x: Number(value), y: NaN })
      else if (current.points.length) current.points[current.points.length - 1].y = Number(value)
      continue
    }
    const keep = DXF_KEEP[current.type]
    if (keep.indexOf(code) !== -1 && current.vals[code] === undefined) current.vals[code] = value
  }
  if (current) entities.push(current)

  const parsed = []
  for (const entity of entities) {
    const first = (code) => entity.vals[code] || ''
    const layer = entity.layer || '0'
    if (entity.type === 'LINE') {
      parsed.push({
        type: 'line', layer,
        coords: [
          [Number(first('10')), Number(first('20')), num(first('30'))],
          [Number(first('11')), Number(first('21')), num(first('31'))],
        ],
      })
    } else if (entity.type === 'LWPOLYLINE') {
      const elevation = num(first('38'))
      const coords = entity.points
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
        .map((point) => [point.x, point.y, elevation])
      if (coords.length >= 2) parsed.push({ type: 'line', layer, coords })
    } else if (entity.type === 'CIRCLE') {
      parsed.push({
        type: 'circle', layer,
        center: [Number(first('10')), Number(first('20')), num(first('30'))],
        radius: Number(first('40')),
      })
    } else if (entity.type === 'TEXT' || entity.type === 'MTEXT') {
      const content = first('1') || first('3')
      if (content) {
        parsed.push({
          type: 'text', layer,
          content: content.replace(/\\P/g, ' ').replace(/[{}]/g, ''),
          at: [Number(first('10')), Number(first('20')), num(first('30'))],
          height: num(first('40')),
        })
      }
    }
  }
  return parsed
}

function distance2d(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

function nearestSegmentDistance(point, coords) {
  let best = Infinity
  for (let i = 0; i + 1 < coords.length; i += 1) {
    best = Math.min(best, pointSegmentDistance(point[0], point[1], coords[i], coords[i + 1]))
  }
  return best
}

/** 点到单段线段的三维无关二维距离（注记吸附与空间索引用） */
function pointSegmentDistance(px, py, a, b) {
  const [x1, y1] = a
  const [x2, y2] = b
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  let t = len2 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

/** CAD 接入：图层识别 + 注记关联 + 端点构管点。平面图纸明确标记为推算三维。 */
export function cadToFeatures(entities, options = {}) {
  const layerMapping = options.layerMapping || {}
  const textSnapDistance = Number(options.textSnapDistance) || 12
  const lineEntities = entities.filter((item) => item.type === 'line' && item.coords.length >= 2)
  const texts = entities.filter((item) => item.type === 'text' && Number.isFinite(item.at?.[0]))
  const circles = entities.filter((item) => item.type === 'circle' && Number.isFinite(item.center?.[0]))

  for (const entity of lineEntities) {
    const mappedMajor = layerMapping[entity.layer]
    const major = mappedMajor || detectMajor(entity.layer)
    entity.major = major || ''
    entity.profile = parseProfile('')
    entity.annotations = []
    entity.hasZ = entity.coords.some((coordinate) => Number.isFinite(coordinate[2]) && coordinate[2] !== 0)
  }

  // 注记 → 最近管段（按 2D 距离；限制吸附半径）
  // 管段按吸附半径分格：旧实现是 注记×管段 全量比对，75 MB 图纸（5 万注记 × 8 万段）要跑成小时级
  const snapCell = Math.max(textSnapDistance, 1)
  const segBuckets = new Map()
  const segments = []
  const bucketPush = (cx, cy, index) => {
    const key = `${cx}|${cy}`
    let bucket = segBuckets.get(key)
    if (!bucket) { bucket = []; segBuckets.set(key, bucket) }
    bucket.push(index)
  }
  for (const entity of lineEntities) {
    const coords = entity.coords
    for (let i = 0; i + 1 < coords.length; i += 1) {
      const a = coords[i]
      const b = coords[i + 1]
      if (!Number.isFinite(a[0]) || !Number.isFinite(a[1]) || !Number.isFinite(b[0]) || !Number.isFinite(b[1])) continue
      const index = segments.push({ entity, a, b }) - 1
      const cx0 = Math.floor(Math.min(a[0], b[0]) / snapCell)
      const cx1 = Math.floor(Math.max(a[0], b[0]) / snapCell)
      const cy0 = Math.floor(Math.min(a[1], b[1]) / snapCell)
      const cy1 = Math.floor(Math.max(a[1], b[1]) / snapCell)
      const span = (cx1 - cx0 + 1) * (cy1 - cy0 + 1)
      if (span <= 1024) {
        for (let cx = cx0; cx <= cx1; cx += 1) for (let cy = cy0; cy <= cy1; cy += 1) bucketPush(cx, cy, index)
      } else {
        // 图框、道路中心线这类超长线段：沿线段取样落格并向邻格扩一圈，避免单格塞进上千索引
        const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / snapCell) || 1
        for (let s = 0; s <= steps; s += 1) {
          const x = Math.floor((a[0] + (b[0] - a[0]) * (s / steps)) / snapCell)
          const y = Math.floor((a[1] + (b[1] - a[1]) * (s / steps)) / snapCell)
          for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) bucketPush(x + dx, y + dy, index)
        }
      }
    }
  }

  for (const item of texts) {
    let target = null
    let best = Infinity
    const cx = Math.floor(item.at[0] / snapCell)
    const cy = Math.floor(item.at[1] / snapCell)
    for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) {
      const bucket = segBuckets.get(`${cx + dx}|${cy + dy}`)
      if (!bucket) continue
      for (const index of bucket) {
        const segment = segments[index]
        const distance = pointSegmentDistance(item.at[0], item.at[1], segment.a, segment.b)
        if (distance < best) { best = distance; target = segment.entity }
      }
    }
    if (target && best <= textSnapDistance) {
      target.annotations.push({ content: item.content, distance: round(best, 2) })
      const parsed = parseProfile(item.content)
      if (parsed.sizeMm) {
        target.profile = parsed
      }
      const majorHit = detectMajor(item.content)
      if (majorHit && !target.major) target.major = majorHit
    }
  }

  // 端点聚类成管点（1m 容差），井图元就近绑定
  // 管点同样用 1m 网格分桶：旧实现每来一个端点就把已有管点全扫一遍，20 万端点时是平方级
  const nodes = []
  const nodeIndex = new Map()
  const nodeBuckets = new Map()
  const keyOf = (coordinate) => `${Math.round(coordinate[0] * 10)}:${Math.round(coordinate[1] * 10)}`
  const findNear = (coordinate) => {
    const k = keyOf(coordinate)
    if (nodeIndex.has(k)) return nodeIndex.get(k)
    const cx = Math.floor(coordinate[0])
    const cy = Math.floor(coordinate[1])
    let best = null
    let bestDistance = Infinity
    for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) {
      const bucket = nodeBuckets.get(`${cx + dx}|${cy + dy}`)
      if (!bucket) continue
      for (const node of bucket) {
        const distance = Math.hypot(node.x - coordinate[0], node.y - coordinate[1])
        if (distance <= 1.0 && distance < bestDistance) { bestDistance = distance; best = node }
      }
    }
    return best
  }
  const nearestNodeWithin = (x, y, radius) => {
    const cx0 = Math.floor((x - radius) / 1.0)
    const cx1 = Math.floor((x + radius) / 1.0)
    const cy0 = Math.floor((y - radius) / 1.0)
    const cy1 = Math.floor((y + radius) / 1.0)
    let best = null
    let bestDistance = Infinity
    for (let cx = cx0; cx <= cx1; cx += 1) for (let cy = cy0; cy <= cy1; cy += 1) {
      const bucket = nodeBuckets.get(`${cx}|${cy}`)
      if (!bucket) continue
      for (const node of bucket) {
        const distance = Math.hypot(node.x - x, node.y - y)
        if (distance <= radius && distance < bestDistance) { bestDistance = distance; best = node }
      }
    }
    return best
  }
  const ensureNode = (coordinate, major) => {
    const near = findNear(coordinate)
    if (near) { if (!near.major && major) near.major = major; return near }
    const node = {
      nodeCode: `CAD-${nodes.length + 1}`,
      category: '管线端点',
      x: coordinate[0], y: coordinate[1],
      groundElev: null,
      z: Number.isFinite(coordinate[2]) && coordinate[2] !== 0 ? coordinate[2] : null,
      coverDepth: null,
      major: major || '',
      attrs: { cad: 'endpoint' },
      hasZ: Number.isFinite(coordinate[2]) && coordinate[2] !== 0,
    }
    nodes.push(node)
    nodeIndex.set(keyOf(coordinate), node)
    const cellKey = `${Math.floor(coordinate[0])}|${Math.floor(coordinate[1])}`
    let bucket = nodeBuckets.get(cellKey)
    if (!bucket) { bucket = []; nodeBuckets.set(cellKey, bucket) }
    bucket.push(node)
    return node
  }

  for (const entity of lineEntities) {
    entity.nodeA = ensureNode(entity.coords[0], entity.major)
    entity.nodeB = ensureNode(entity.coords[entity.coords.length - 1], entity.major)
  }

  for (const circle of circles) {
    if (!Number.isFinite(circle.center?.[0]) || !Number.isFinite(circle.center?.[1])) continue
    const radius = Math.max(1.5, (circle.radius || 0) * 2)
    const near = nearestNodeWithin(circle.center[0], circle.center[1], radius)
    if (near) {
      near.category = '井'
      near.attrs.chamber = `R${round(circle.radius || 0, 2)}`
      near.hasZ = near.hasZ || Number.isFinite(circle.center[2])
      if (!near.hasZ && Number.isFinite(circle.center[2])) near.z = circle.center[2]
    }
  }

  // 图层内规格传播：CAD 图纸通常只在一条管线上标注规格，同图层其余管段沿用
  const layerProfile = new Map()
  for (const entity of lineEntities) {
    if (entity.profile?.sizeMm && !layerProfile.has(entity.layer)) layerProfile.set(entity.layer, entity.profile)
  }
  for (const entity of lineEntities) {
    if (!entity.profile?.sizeMm && layerProfile.has(entity.layer)) {
      entity.profile = layerProfile.get(entity.layer)
      entity.profileInferred = true
    }
  }

  const lines = lineEntities.map((entity, index) => {
    // DXF 的 30/31 缺省值为 0；管网绝对高程不可能是 0，按缺失处理，避免生成"贴地"的错误三维
    const coords = entity.coords.map((coordinate) => {
      const z = Number.isFinite(coordinate[2]) && coordinate[2] !== 0 ? coordinate[2] : null
      return [coordinate[0], coordinate[1], z]
    })
    return {
      lineCode: `CAD-L${index + 1}`,
      nodeStart: entity.nodeA.nodeCode,
      nodeEnd: entity.nodeB.nodeCode,
      pipeMajor: entity.major || '',
      material: '',
      profileType: entity.profile.profileType,
      profileSize: entity.profile.label || '',
      sizeMm: entity.profile.sizeMm,
      widthMm: entity.profile.widthMm,
      heightMm: entity.profile.heightMm,
      width: (entity.profile.widthMm || 0) / 1000 || null,
      height: (entity.profile.heightMm || 0) / 1000 || null,
      coords,
      annotations: entity.annotations,
      attrs: { cad: { layer: entity.layer, annotationCount: entity.annotations.length } },
    }
  })

  return {
    points: nodes.map((node) => ({
      nodeCode: node.nodeCode, category: node.category,
      coords: [node.x, node.y, node.z], groundElev: node.groundElev,
      z: node.z, coverDepth: node.coverDepth, attrs: node.attrs,
    })),
    lines,
    warnings: lineEntities.length && !lineEntities.some((entity) => entity.hasZ)
      ? ['图纸无高程信息：按平面图纸接入，三维位置需人工补录后才能参与精确分析']
      : [],
  }
}

/* ---------------------------- 普查成果读取 ---------------------------- */

function readSurveyPayload(payload, mapping) {
  const points = payload.points.map((item) => ({
    raw: item.properties,
    coords: item.coords,
    layer: item.layer,
    dataset: item.dataset,
  }))
  const lines = payload.lines.map((item) => ({
    raw: item.properties,
    coords: item.coords,
    layer: item.layer,
    dataset: item.dataset,
  }))
  return { points, lines, crs: payload.crs, bbox: payload.bbox, layers: payload.layers, fields: payload.fields, truncated: payload.truncated }
}

/* ------------------------------ CSV 接入 ------------------------------ */

function tableLooksLikeLines(headers) {
  const keys = headers.map(normalizeKey)
  return keys.some((key) => ['起点点号', '起始点号', '起点编号', 'startnode', 'nodestart', 'snode'].some((alias) => key.includes(normalizeKey(alias))))
}

function tableLooksLikePoints(headers) {
  const keys = headers.map(normalizeKey)
  const hasX = keys.some((key) => ['x', 'x坐标', '横坐标', 'easting'].includes(key))
  const hasY = keys.some((key) => ['y', 'y坐标', '纵坐标', 'northing'].includes(key))
  const hasCode = keys.some((key) => ['点号', '编号', 'code', 'node'].some((alias) => key.includes(normalizeKey(alias))))
  return hasX && hasY && hasCode
}

function tableToRecords(headers, rows) {
  const records = []
  for (const row of rows) {
    const record = {}
    headers.forEach((header, index) => { record[header] = row[index] })
    records.push(record)
  }
  return records
}

/* ------------------------- 标准化（统一数据模型） ------------------------- */

function applyPoint(rawRecord, spec, projector, mapping, options, layerName) {
  const srcX = num(mapped(rawRecord, mapping, 'x'))
  const srcY = num(mapped(rawRecord, mapping, 'y'))
  const projected = Number.isFinite(srcX) && Number.isFinite(srcY) ? projector.project(srcX, srcY) : null
  const groundElev = num(mapped(rawRecord, mapping, 'groundElev'))
  const rawZ = num(mapped(rawRecord, mapping, 'z'))
  const coverDepth = num(mapped(rawRecord, mapping, 'coverDepth'))
  const z = rawZ !== null ? rawZ : (groundElev !== null && coverDepth !== null ? groundElev - coverDepth : null)
  const category = text(mapped(rawRecord, mapping, 'category'))
  const major = detectMajor(mapped(rawRecord, mapping, 'pipeMajor'), layerName, category)
  return {
    nodeCode: text(mapped(rawRecord, mapping, 'nodeCode')) || `${layerName || 'P'}-${spec.index}`,
    category: category || '管点',
    x: projected ? round(projected.x, 3) : null,
    y: projected ? round(projected.y, 3) : null,
    srcX, srcY,
    groundElev: groundElev === null ? null : round(groundElev, 3),
    z: z === null ? null : round(z, 3),
    coverDepth: coverDepth === null ? null : round(coverDepth, 3),
    coverMaterial: text(mapped(rawRecord, mapping, 'coverMaterial')),
    coverSize: text(mapped(rawRecord, mapping, 'coverSize')),
    chamberShape: text(mapped(rawRecord, mapping, 'chamberShape')),
    chamberSize: text(mapped(rawRecord, mapping, 'chamberSize')),
    road: text(mapped(rawRecord, mapping, 'road')),
    address: text(mapped(rawRecord, mapping, 'address')),
    owner: text(mapped(rawRecord, mapping, 'owner')),
    buildYear: text(mapped(rawRecord, mapping, 'buildYear')),
    surveyDate: text(mapped(rawRecord, mapping, 'surveyDate')),
    surveyUnit: text(mapped(rawRecord, mapping, 'surveyUnit')),
    angle: num(mapped(rawRecord, mapping, 'angle')),
    status: text(mapped(rawRecord, mapping, 'status')),
    major,
    zQuality: rawZ !== null ? 'survey' : (groundElev !== null && coverDepth !== null ? 'derived' : 'none'),
    raw: rawRecord,
    layer: layerName || '',
  }
}

function applyLine(rawRecord, spec, projector, mapping, options, layerName, pointMap) {
  const coordsSource = spec.coords || []
  const preProjected = Boolean(spec.preProjected)
  const projected = coordsSource.map((coordinate) => {
    if (coordinate[0] === null || !Number.isFinite(coordinate[0])) return [null, null, null]
    const p = preProjected ? { x: coordinate[0], y: coordinate[1] } : projector.project(coordinate[0], coordinate[1])
    return [round(p.x, 3), round(p.y, 3), Number.isFinite(coordinate[2]) ? coordinate[2] : null]
  })
  const nodeStart = text(mapped(rawRecord, mapping, 'nodeStart')) || (spec.nodeStart || '')
  const nodeEnd = text(mapped(rawRecord, mapping, 'nodeEnd')) || (spec.nodeEnd || '')
  const startPoint = pointMap.get(nodeStart)
  const endPoint = pointMap.get(nodeEnd)
  const startElevRaw = num(mapped(rawRecord, mapping, 'startElev'))
  const endElevRaw = num(mapped(rawRecord, mapping, 'endElev'))
  const startDepth = num(mapped(rawRecord, mapping, 'startDepth'))
  const endDepth = num(mapped(rawRecord, mapping, 'endDepth'))
  const startElev = startElevRaw !== null
    ? startElevRaw
    : (startPoint && startPoint.groundElev !== null && startDepth !== null
      ? round(startPoint.groundElev - startDepth, 3)
      : (startPoint?.z ?? null))
  const endElev = endElevRaw !== null
    ? endElevRaw
    : (endPoint && endPoint.groundElev !== null && endDepth !== null
      ? round(endPoint.groundElev - endDepth, 3)
      : (endPoint?.z ?? null))

  // 每个顶点的高程：端点用已知高程，中间顶点线性插值；无端点高程时保持 null
  if (projected.length >= 2) {
    if (startElev !== null && endElev !== null) {
      const length = polylineLength(projected)
      let acc = 0
      for (let i = 0; i < projected.length; i += 1) {
        if (i > 0) acc += segmentLength(projected[i - 1], projected[i])
        const ratio = length ? acc / length : 0
        projected[i][2] = round(startElev + (endElev - startElev) * ratio, 3)
      }
    } else if (projected.length === 2) {
      projected[0][2] = projected[0][2] ?? startElev
      projected[1][2] = projected[1][2] ?? endElev
    }
  }

  const profile = parseProfile(mapped(rawRecord, mapping, 'profileSize'))
  const profileTypeRaw = text(mapped(rawRecord, mapping, 'profileType')) || profile.profileType
  const major = detectMajor(mapped(rawRecord, mapping, 'pipeMajor'), layerName)
  const width = (profile.widthMm || 0) / 1000
  const height = (profile.heightMm || 0) / 1000
  const length = polylineLength(projected)
  const flowRaw = text(mapped(rawRecord, mapping, 'flowDir'))
  const flowDir = flowRaw === '' ? '-1' : (/反向|终点|1/.test(flowRaw) ? '1' : (/正向|起点|0/.test(flowRaw) ? '0' : '-1'))

  return {
    lineCode: text(mapped(rawRecord, mapping, 'lineCode')) || `${layerName || 'L'}-${spec.index}`,
    nodeStart, nodeEnd,
    pipeMajor: major || '',
    material: text(mapped(rawRecord, mapping, 'material')),
    profileType: profileTypeRaw,
    profileSize: text(mapped(rawRecord, mapping, 'profileSize')) || (profile.sizeMm ? `${profile.sizeMm}` : ''),
    sizeMm: profile.sizeMm,
    wallThickness: text(mapped(rawRecord, mapping, 'wallThickness')),
    buryType: text(mapped(rawRecord, mapping, 'buryType')),
    startDepth: startDepth === null ? null : round(startDepth, 3),
    endDepth: endDepth === null ? null : round(endDepth, 3),
    startElev: startElev === null ? null : round(startElev, 3),
    endElev: endElev === null ? null : round(endElev, 3),
    flowDir,
    length: round(length, 2),
    holeCount: num(mapped(rawRecord, mapping, 'holeCount')) || 0,
    cabCount: num(mapped(rawRecord, mapping, 'cabCount')) || 0,
    pressure: text(mapped(rawRecord, mapping, 'pressure')),
    voltage: text(mapped(rawRecord, mapping, 'voltage')),
    owner: text(mapped(rawRecord, mapping, 'owner')),
    road: text(mapped(rawRecord, mapping, 'road')),
    buildYear: text(mapped(rawRecord, mapping, 'buildYear')),
    status: text(mapped(rawRecord, mapping, 'status')),
    lineStyle: text(mapped(rawRecord, mapping, 'lineStyle')),
    width: width || null,
    height: height || null,
    coords: projected,
    thicknessGrade: zGrade(projected),
    raw: rawRecord,
    layer: layerName || '',
  }
}

function zGrade(coords) {
  const zs = coords.map((coordinate) => coordinate[2]).filter(Number.isFinite)
  if (zs.length === coords.length && coords.length >= 2) return 'complete'
  if (zs.length > 0) return 'partial'
  return 'none'
}

function polylineLength(coords) {
  let total = 0
  for (let i = 1; i < coords.length; i += 1) total += segmentLength(coords[i - 1], coords[i])
  return total
}

function segmentLength(a, b) {
  if (!a || !b || !Number.isFinite(a[0]) || !Number.isFinite(b[0])) return 0
  return Math.hypot(b[0] - a[0], b[1] - a[1])
}

/* ---------------------------- 拓扑与质检 ---------------------------- */

function buildTopology(nodes, lines) {
  const nodeByCode = new Map()
  for (const node of nodes) nodeByCode.set(node.nodeCode, node)
  const edges = []
  for (const line of lines) {
    if (!nodeByCode.has(line.nodeStart) || !nodeByCode.has(line.nodeEnd)) continue
    edges.push({ nodeId: line.nodeStart, neighborNodeId: line.nodeEnd, lineId: line.id, pipeMajor: line.pipeMajor, directed: line.flowDir === '-1' ? 0 : 1 })
    edges.push({ nodeId: line.nodeEnd, neighborNodeId: line.nodeStart, lineId: line.id, pipeMajor: line.pipeMajor, directed: 0 })
  }
  return edges
}

export function inspectQuality(nodes, lines) {
  const issues = []
  const push = (issueType, severity, message, extra = {}) => {
    issues.push({ issueType, severity, message, nodeId: extra.nodeId || '', lineId: extra.lineId || '' })
  }
  const codeCount = new Map()
  for (const node of nodes) {
    codeCount.set(node.nodeCode, (codeCount.get(node.nodeCode) || 0) + 1)
  }
  for (const node of nodes) {
    if ((codeCount.get(node.nodeCode) || 0) > 1) push('重复管点', '高', `点号 ${node.nodeCode} 重复 ${codeCount.get(node.nodeCode)} 次`, { nodeId: node.id })
    if (node.x === null || node.y === null) push('缺坐标', '高', `管点 ${node.nodeCode} 缺少有效平面坐标`, { nodeId: node.id })
    if (node.z === null) push('缺高程', '中', `管点 ${node.nodeCode} 缺少高程与埋深，无法生成精确三维位置`, { nodeId: node.id })
  }
  const nodeCodes = new Set(nodes.map((node) => node.nodeCode))
  const linePairs = new Map()
  for (const line of lines) {
    if (!line.nodeStart) push('缺起点', '中', `管段 ${line.lineCode} 未填写起点点号`, { lineId: line.id })
    if (!line.nodeEnd) push('缺终点', '中', `管段 ${line.lineCode} 未填写终点点号`, { lineId: line.id })
    if (line.nodeStart && !nodeCodes.has(line.nodeStart)) push('端点未接', '高', `管段 ${line.lineCode} 起点 ${line.nodeStart} 不在管点表中（悬挂线）`, { lineId: line.id })
    if (line.nodeEnd && !nodeCodes.has(line.nodeEnd)) push('端点未接', '高', `管段 ${line.lineCode} 终点 ${line.nodeEnd} 不在管点表中（悬挂线）`, { lineId: line.id })
    const pairKey = [line.nodeStart, line.nodeEnd].sort().join('|') + '|' + (line.pipeMajor || '')
    if (linePairs.has(pairKey)) push('重复管段', '中', `管段 ${line.lineCode} 与 ${linePairs.get(pairKey)} 起终点及类别相同`, { lineId: line.id })
    else linePairs.set(pairKey, line.lineCode)
    if (!line.pipeMajor) push('缺管线类别', '中', `管段 ${line.lineCode} 未识别出管线类别`, { lineId: line.id })
    const sizeMm = Number(line.attrs?.sizeMm || 0)
    const widthM = Number(line.attrs?.widthM || 0)
    if (!sizeMm && !widthM) push('缺管径/断面', '中', `管段 ${line.lineCode} 缺少可解析的管径或断面尺寸`, { lineId: line.id })
    if (!line.material) push('缺材质', '低', `管段 ${line.lineCode} 未填写材质`, { lineId: line.id })
    if (line.thicknessGrade === 'none') push('缺高程', '高', `管段 ${line.lineCode} 无可用高程，不能参与精确空间分析`, { lineId: line.id })
    else if (line.thicknessGrade === 'partial') push('部分缺高程', '中', `管段 ${line.lineCode} 部分顶点缺高程，按线性插值生成示意位置`, { lineId: line.id })
    if (PIPE_MAJOR[line.pipeMajor]?.depth === 'invert' && line.flowDir !== '-1' && line.startElev !== null && line.endElev !== null) {
      const downhill = line.flowDir === '0' ? line.startElev >= line.endElev : line.endElev >= line.startElev
      if (!downhill) push('流向与高程矛盾', '中', `管段 ${line.lineCode} 流向与两端高程关系不一致，请复核`, { lineId: line.id })
    }
  }
  const connected = new Map()
  for (const line of lines) {
    if (line.nodeStart) connected.set(line.nodeStart, (connected.get(line.nodeStart) || 0) + 1)
    if (line.nodeEnd) connected.set(line.nodeEnd, (connected.get(line.nodeEnd) || 0) + 1)
  }
  for (const node of nodes) {
    if (!connected.get(node.nodeCode)) push('孤立管点', '低', `管点 ${node.nodeCode} 未连接任何管段`, { nodeId: node.id })
  }
  return issues
}

/* ------------------------------ 入库 ------------------------------ */

function detectSourceType(name, kind) {
  const ext = extname(String(name || '')).toLowerCase()
  if (ext === '.dxf') return 'cad-dxf'
  if (ext === '.dwg') return 'cad-dwg'
  if (['.csv', '.txt'].includes(ext)) return 'csv'
  if (['.shp', '.gdb', '.geojson', '.json', '.zip'].includes(ext)) return 'survey'
  if (kind) return kind
  return 'survey'
}

/**
 * 导入入口。files 形如 [{ name, buffer }]。
 * 返回 { dataset, features, quality, issues, warnings }。
 */
export async function importPipeline(options = {}) {
  const { user, net, files = [], name = '', mapping = {}, layerMapping = {}, datum = '1985 国家高程基准' } = options
  // 导入进度回调：百分数 + 阶段说明，供服务端登记后由前端轮询
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null
  const report = (percent, message, stage = '') => {
    if (!onProgress) return
    try { onProgress({ percent: Math.max(0, Math.min(100, Math.round(percent))), message, stage }) } catch { /* 进度上报不应影响导入 */ }
  }
  // Node 单线程：同步解析/建模期间事件循环被占住，进度轮询排不进来；在阶段边界让出一次
  const yieldEventLoop = () => new Promise((resolve) => setImmediate(resolve))
  const stage = options.stage === 'planned' ? 'planned' : options.stage === 'history' ? 'history' : options.stage === 'built' ? 'built' : 'existing'
  const ownerName = typeof user === 'object' && user ? String(user.name || '') : String(user || '')
  if (!Array.isArray(files) || !files.length) throw Object.assign(new Error('请选择要导入的管网数据文件'), { status: 400 })
  const first = files[0]
  const sourceType = detectSourceType(first.name, options.sourceType)
  const warnings = []
  if (sourceType === 'cad-dwg') {
    throw Object.assign(new Error('DWG 为闭源二进制格式，当前环境未部署 ODA 许可；请在 CAD 中另存为 DXF 后再导入'), { status: 422, code: 'DWG_UNSUPPORTED' })
  }

  const temp = mkdtempSync(join(tmpdir(), 'jg-pipe-import-'))
  let rawPoints = []
  let rawLines = []
  let crs = ''
  let fields = []
  let layers = []
  try {
    if (sourceType === 'cad-dxf') {
      const dxfFile = files.find((file) => /\.dxf$/i.test(file.name)) || first
      report(8, '正在解析 DXF 组码…', 'parse')
      await yieldEventLoop()
      const parsed = parseDxf(Buffer.from(dxfFile.buffer).toString('utf8'))
      report(26, `DXF 解析完成，正在识别图层与注记（${parsed.length} 个图元）…`, 'model')
      await yieldEventLoop()
      const cad = cadToFeatures(parsed, { layerMapping })
      report(46, 'CAD 建模完成，正在整理管点与管段…', 'model')
      await yieldEventLoop()
      warnings.push(...cad.warnings)
      rawPoints = cad.points.map((point) => ({ raw: point.attrs || {}, coords: point.coords, layer: 'CAD', pre: point }))
      rawLines = cad.lines.map((line) => ({ raw: line.attrs?.cad || {}, coords: line.coords, layer: line.attrs?.cad?.layer || '0', pre: line }))
      fields = ['图层', '注记']
      layers = [{ name: 'CAD 图元', geometryType: 'Line', features: rawLines.length, points: rawPoints.length, lines: rawLines.length }]
      warnings.push('CAD 来源：图层与注记自动识别，未建立监理审核的字段映射；结果需人工核对')
    } else if (sourceType === 'csv') {
      const paths = []
      for (const file of files) {
        if (!/\.(csv|txt)$/i.test(file.name || '')) continue
        const full = join(temp, basename(file.name || 'data.csv'))
        writeFileSync(full, file.buffer)
        paths.push(full)
      }
      if (!paths.length) throw Object.assign(new Error('CSV 接入需要至少一个 .csv 文件'), { status: 422 })
      const payload = await runBridge('csv-read', { paths, maxRows: MAX_IMPORT_FEATURES })
      const tables = payload.tables || []
      let pointTable = tables.find((table) => tableLooksLikePoints(table.headers))
      let lineTable = tables.find((table) => tableLooksLikeLines(table.headers))
      if (!pointTable && !lineTable && tables.length >= 1) {
        // 单表：按行内是否自带起终点点号判断
        const table = tables[0]
        if (tableLooksLikeLines(table.headers)) lineTable = table
        else pointTable = table
      }
      if (pointTable) {
        const records = tableToRecords(pointTable.headers, pointTable.rows)
        records.forEach((record, index) => {
          rawPoints.push({ raw: record, coords: [null, null, null], layer: pointTable.name, pre: null, index, table: 'point' })
        })
      }
      if (lineTable) {
        const records = tableToRecords(lineTable.headers, lineTable.rows)
        records.forEach((record, index) => {
          rawLines.push({ raw: record, coords: [], layer: lineTable.name, pre: null, index, table: 'line' })
        })
      }
      fields = [...new Set(tables.flatMap((table) => table.headers))]
      layers = tables.map((table) => ({
        name: table.name, geometryType: tableLooksLikeLines(table.headers) ? 'Line' : 'Point',
        features: table.rowCount, points: tableLooksLikePoints(table.headers) ? table.rowCount : 0,
        lines: tableLooksLikeLines(table.headers) ? table.rowCount : 0,
      }))
      warnings.push('CSV 接入：按表头自动识别管点表 / 管段表；管段几何由起终点号在管点表中匹配生成')
    } else {
      // 普查成果：按相对路径落盘（支持 SHP 同名文件组、GDB 文件夹、ZIP 包）
      report(15, '正在读取普查成果文件…', 'parse')
      for (const file of files) {
        const relative = String(file.path || file.name || 'data.shp').replace(/\\/g, '/')
          .split('/').filter((part) => part && part !== '.' && part !== '..').join('/')
        const full = join(temp, relative)
        mkdirSync(dirname(full), { recursive: true })
        writeFileSync(full, file.buffer)
      }
      const archive = files.find((file) => /\.zip$/i.test(file.name || ''))
      let scanRoot = temp
      if (archive) {
        const archivePath = join(temp, basename(archive.name))
        const unpack = await unzipTo(archivePath, join(temp, '_unpacked'))
        if (!unpack) throw Object.assign(new Error('压缩包解压失败，请确认是有效的 ZIP 包'), { status: 422 })
        scanRoot = join(temp, '_unpacked')
      }
      const datasets = findGeoDatasets(scanRoot)
      if (!datasets.length) throw Object.assign(new Error('没有找到 .shp、.gdb 或 .geojson 数据集；SHP 需同时包含 .shp/.dbf/.shx/.prj'), { status: 422 })
      const payload = await runBridge('pipe-read', { paths: datasets, maxFeatures: MAX_IMPORT_FEATURES, name: name || first.name })
      const survey = readSurveyPayload(payload, mapping)
      crs = survey.crs || ''
      fields = survey.fields || []
      layers = survey.layers || []
      if (survey.truncated) warnings.push(`要素数超过 ${MAX_IMPORT_FEATURES}，本次只导入了上限内的要素`)
      rawPoints = survey.points.map((point) => ({ raw: point.raw, coords: point.coords, layer: point.layer, pre: null }))
      rawLines = survey.lines.map((line) => ({ raw: line.raw, coords: line.coords, layer: line.layer, pre: null }))
    }
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }

  if (!rawPoints.length && !rawLines.length) {
    throw Object.assign(new Error('文件中没有识别到管点或管段要素'), { status: 422 })
  }
  report(58, `要素已就绪：${rawPoints.length} 个管点、${rawLines.length} 条管段，正在计算坐标与长度…`, 'normalize')

  const projector = buildProjector(rawPoints, rawLines, crs, sourceType)
  const pointMap = new Map()
  const nodes = []

  // 点要素标准化
  const prePointNodes = []
  for (let index = 0; index < rawPoints.length; index += 1) {
    const item = rawPoints[index]
    if (item.pre) {
      const pre = item.pre
      const projected = projector.project(pre.coords[0], pre.coords[1])
      prePointNodes.push({
        nodeCode: pre.nodeCode, category: pre.category,
        x: round(projected.x, 3), y: round(projected.y, 3),
        srcX: pre.coords[0], srcY: pre.coords[1],
        groundElev: pre.groundElev ?? null, z: pre.z ?? null, coverDepth: pre.coverDepth ?? null,
        coverMaterial: '', coverSize: '', chamberShape: '', chamberSize: '',
        road: '', address: '', owner: '', buildYear: '', surveyDate: '', surveyUnit: '',
        angle: null, status: '', major: pre.major || '',
        zQuality: pre.z !== null ? 'survey' : 'none',
        raw: pre.attrs || {}, layer: 'CAD',
      })
    } else if (item.table === 'point' || item.coords) {
      prePointNodes.push(applyPoint(item.raw, { index }, projector, mapping, options, item.layer))
    }
  }
  for (const node of prePointNodes) {
    if (!node.nodeCode) node.nodeCode = `P-${nodes.length + 1}`
    nodes.push(node)
    if (!pointMap.has(node.nodeCode)) pointMap.set(node.nodeCode, node)
  }

  // 线要素标准化；CSV/无几何的线由起终点生成
  const lines = []
  for (let index = 0; index < rawLines.length; index += 1) {
    const item = rawLines[index]
    if (item.pre) {
      const pre = item.pre
      const coords = pre.coords.map((coordinate) => {
        if (!Number.isFinite(coordinate[0])) return [null, null, null]
        const p = projector.project(coordinate[0], coordinate[1])
        return [round(p.x, 3), round(p.y, 3), Number.isFinite(coordinate[2]) ? coordinate[2] : null]
      })
      const startPoint = pointMap.get(pre.nodeStart)
      const endPoint = pointMap.get(pre.nodeEnd)
      const startElev = Number.isFinite(pre.coords[0]?.[2]) ? pre.coords[0][2] : (startPoint?.z ?? null)
      const endElev = Number.isFinite(pre.coords[pre.coords.length - 1]?.[2]) ? pre.coords[pre.coords.length - 1][2] : (endPoint?.z ?? null)
      if (coords.length >= 2 && startElev !== null && endElev !== null) {
        const total = polylineLength(coords)
        let acc = 0
        coords.forEach((coordinate, i) => {
          if (i > 0) acc += segmentLength(coords[i - 1], coordinate)
          coordinate[2] = round(startElev + (endElev - startElev) * (total ? acc / total : 0), 3)
        })
      }
      lines.push({
        lineCode: pre.lineCode, nodeStart: pre.nodeStart, nodeEnd: pre.nodeEnd,
        pipeMajor: pre.pipeMajor || '', material: '', profileType: pre.profileType || '',
        profileSize: pre.profileSize || '', sizeMm: pre.sizeMm ?? null, wallThickness: '',
        buryType: '', startDepth: null, endDepth: null,
        startElev: Number.isFinite(pre.coords[0]?.[2]) ? pre.coords[0][2] : null,
        endElev: Number.isFinite(pre.coords[pre.coords.length - 1]?.[2]) ? pre.coords[pre.coords.length - 1][2] : null,
        flowDir: '-1', length: round(polylineLength(coords), 2),
        holeCount: 0, cabCount: 0, pressure: '', voltage: '', owner: '', road: '', buildYear: '', status: '',
        lineStyle: '', width: pre.width || null, height: pre.height || null,
        coords, thicknessGrade: zGrade(coords),
        raw: item.raw, layer: item.layer, annotations: pre.annotations || [],
      })
    } else {
      const record = item.raw
      let coords = item.coords || []
      const nodeStart = text(mapped(record, mapping, 'nodeStart'))
      const nodeEnd = text(mapped(record, mapping, 'nodeEnd'))
      // CSV / 无几何线表：起终点管点已在点表中投影过，这里直接复用局部坐标
      let preProjected = false
      if ((!coords || coords.length < 2) && nodeStart && nodeEnd) {
        const a = pointMap.get(nodeStart)
        const b = pointMap.get(nodeEnd)
        if (a && b && a.x !== null && b.x !== null) {
          coords = [
            [a.x, a.y, a.z === null ? null : a.z],
            [b.x, b.y, b.z === null ? null : b.z],
          ]
          preProjected = true
        }
      }
      lines.push(applyLine(record, { index, coords, preProjected, nodeStart, nodeEnd }, projector, mapping, options, item.layer, pointMap))
    }
  }

  // 线要素若没有对应管点（常见于纯线表），按端点补建管点
  const missingNodes = []
  const nodeCodes = new Set(nodes.map((node) => node.nodeCode))
  for (const line of lines) {
    for (const [key, coordinate] of [['nodeStart', line.coords[0]], ['nodeEnd', line.coords[line.coords.length - 1]]]) {
      const code = line[key]
      if (!code || !coordinate || !Number.isFinite(coordinate[0])) continue
      if (nodeCodes.has(code)) continue
      nodeCodes.add(code)
      missingNodes.push({
        nodeCode: code, category: '管段端点', x: coordinate[0], y: coordinate[1],
        srcX: null, srcY: null, groundElev: null, z: coordinate[2] ?? null, coverDepth: null,
        coverMaterial: '', coverSize: '', chamberShape: '', chamberSize: '', road: '', address: '',
        owner: '', buildYear: '', surveyDate: '', surveyUnit: '', angle: null, status: '',
        major: line.pipeMajor, zQuality: coordinate[2] === null ? 'none' : 'survey',
        raw: { synthesized: true }, layer: line.layer,
      })
    }
  }
  for (const node of missingNodes) { nodes.push(node); pointMap.set(node.nodeCode, node) }

  // 计算管线中心线高程与几何
  for (const line of lines) {
    const a = pointMap.get(line.nodeStart)
    const b = pointMap.get(line.nodeEnd)
    if (line.startElev === null && a && a.z !== null) line.startElev = a.z
    if (line.endElev === null && b && b.z !== null) line.endElev = b.z
    if (line.coords.length >= 2 && (line.startElev !== null && line.endElev !== null)) {
      const total = polylineLength(line.coords)
      let acc = 0
      for (let i = 0; i < line.coords.length; i += 1) {
        if (i > 0) acc += segmentLength(line.coords[i - 1], line.coords[i])
        line.coords[i][2] = round(line.startElev + (line.endElev - line.startElev) * (total ? acc / total : 0), 3)
      }
    }
    line.length = round(polylineLength(line.coords), 2)
    line.thicknessGrade = zGrade(line.coords)
  }

  // 统一类别：未识别的按 enclosing 图层名称再判一次
  for (const line of lines) {
    if (!line.pipeMajor) line.pipeMajor = detectMajor(line.layer && line.layer !== '0' ? line.layer : '') || 'other'
  }
  for (const node of nodes) {
    if (!node.major) node.major = detectMajor(node.layer) || ''
  }

  // 建立数据集并落库
  const majors = [...new Set(lines.map((line) => line.pipeMajor).filter(Boolean))]
  const bounds = boundsOf(nodes, lines)
  const datasetName = name || basename(first.name).replace(/\.(shp|gdb|geojson|json|dxf|csv|txt|zip)$/i, '') || '管网数据集'
  const dataset = createPipelineDataset({
    name: datasetName,
    owner: ownerName,
    net: net || '',
    sourceFile: files.map((file) => file.name).join(' / '),
    crs: crs || (projector.mode === 'geographic' ? '未声明（按经纬度处理）' : '未声明（按平面坐标处理）'),
    datum,
    pipeMajor: majors.length === 1 ? majors[0] : '',
    pointCount: nodes.length,
    lineCount: lines.length,
    status: 'imported',
    note: '',
    meta: {
      sourceType,
      stage,
      transform: { mode: projector.mode, origin: projector.origin, note: projector.note },
      bounds,
      mapping,
      layerMapping,
      fields,
      layers,
      majors,
      warnings,
      importedAt: new Date().toISOString(),
      semantics: '埋深按类别解释：供水/配水/燃气/热力/电力/通信为覆土深度；雨水/截污/污水/合流与方沟为内底埋深',
    },
    owner: ownerName,
    net: net || 'inet',
  })

  clearPipelineFeatures(dataset.id)
  report(64, `正在写入管点（共 ${nodes.length} 个）…`, 'write')
  // 大图纸逐条提交会让 WAL 每次刷盘，实测能把导入拖到分钟级；按 2 万条一批事务写入，
  // 批次之间让出事件循环，前端才能在这几秒里拿到真实进度（Node 是单线程，不让出就没法响应轮询）
  const CHUNK = 20000
  const savedNodes = []
  const savedLines = []
  const nodeChunk = 18
  for (let start = 0; start < nodes.length; start += CHUNK) {
    const end = Math.min(nodes.length, start + CHUNK)
    withPipeWriteTransaction(() => {
      for (let index = start; index < end; index += 1) {
        const node = nodes[index]
        savedNodes.push(insertPipeNode(dataset.id, {
          nodeCode: node.nodeCode,
          category: node.category,
          x: node.x, y: node.y,
          groundElev: node.groundElev, z: node.z, coverDepth: node.coverDepth,
          coverMaterial: node.coverMaterial, coverSize: node.coverSize,
          chamberShape: node.chamberShape, chamberSize: node.chamberSize,
          road: node.road, address: node.address, owner: node.owner,
          buildYear: node.buildYear, surveyDate: node.surveyDate, surveyUnit: node.surveyUnit,
          angle: node.angle, status: node.status,
          attrs: { ...(node.raw || {}), srcX: node.srcX, srcY: node.srcY, zQuality: node.zQuality, major: node.major, layer: node.layer },
        }, { readBack: false }))
      }
    })
    report(64 + nodeChunk * (end / nodes.length), `正在写入管点（${end}/${nodes.length}）…`, 'write')
    await yieldEventLoop()
  }
  report(82, `正在写入管段（共 ${lines.length} 条）…`, 'write')
  for (let start = 0; start < lines.length; start += CHUNK) {
    const end = Math.min(lines.length, start + CHUNK)
    withPipeWriteTransaction(() => {
      for (let index = start; index < end; index += 1) {
        const line = lines[index]
        savedLines.push(insertPipeLine(dataset.id, {
          lineCode: line.lineCode, nodeStart: line.nodeStart, nodeEnd: line.nodeEnd,
          pipeMajor: line.pipeMajor, material: line.material,
          profileType: line.profileType, profileSize: line.profileSize,
          wallThickness: line.wallThickness, buryType: line.buryType,
          startDepth: line.startDepth, endDepth: line.endDepth,
          startElev: line.startElev, endElev: line.endElev,
          flowDir: line.flowDir, length: line.length,
          holeCount: line.holeCount, cabCount: line.cabCount,
          pressure: line.pressure, voltage: line.voltage,
          owner: line.owner, road: line.road, buildYear: line.buildYear,
          status: line.status, lineStyle: line.lineStyle,
          geom: { type: 'LineString', coordinates: line.coords },
          attrs: {
            ...(line.raw || {}), sizeMm: line.sizeMm, widthM: line.width, heightM: line.height,
            zGrade: line.thicknessGrade, annotations: line.annotations || [], layer: line.layer,
          },
        }, { readBack: false }))
      }
    })
    report(82 + 10 * (end / lines.length), `正在写入管段（${end}/${lines.length}）…`, 'write')
    await yieldEventLoop()
  }
  report(93, '正在做数据质检…', 'quality')
  await yieldEventLoop()
  const savedIssues = withPipeWriteTransaction(() => {
    const issues = inspectQuality(savedNodes, savedLines)
    for (const issue of issues) insertPipeIssue(dataset.id, issue)
    return issues
  })
  report(96, '正在建立管网拓扑…', 'topology')
  await yieldEventLoop()
  const insertedNodes = savedNodes
  const insertedLines = savedLines
  replacePipeTopology(dataset.id, buildTopology(insertedNodes, insertedLines))
  const issues = savedIssues
  updatePipelineDatasetCounts(dataset.id, insertedNodes.length, insertedLines.length)
  const penalty = issues.filter((issue) => issue.severity === '高').length
  updatePipelineDatasetMeta(dataset.id, {
    status: penalty ? 'pending-qc' : 'checked',
    note: issues.length ? `${issues.length} 项质检问题，其中高等级 ${penalty} 项` : '质检通过',
    meta: { ...dataset.meta, quality: {
      total: issues.length, high: penalty,
      mid: issues.filter((i) => i.severity === '中').length,
      low: issues.filter((i) => i.severity === '低').length,
      withZ: insertedLines.filter((line) => line.attrs?.zGrade === 'complete').length,
      partialZ: insertedLines.filter((line) => line.attrs?.zGrade === 'partial').length,
      withoutZ: insertedLines.filter((line) => line.attrs?.zGrade === 'none').length,
      nodeWithZ: insertedNodes.filter((node) => node.z !== null).length,
    } },
  })
  report(99, `导入收尾：${insertedNodes.length} 个管点、${insertedLines.length} 条管段`, 'finalize')

  return {
    dataset: getPipelineDataset(dataset.id),
    issues,
    warnings,
    summary: {
      pointCount: insertedNodes.length,
      lineCount: insertedLines.length,
      majors,
      bounds,
      transform: projector.mode,
      crs: dataset.crs,
    },
  }
}

function boundsOf(nodes, lines) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity
  const take = (x, y, z) => {
    if (Number.isFinite(x)) { minX = Math.min(minX, x); maxX = Math.max(maxX, x) }
    if (Number.isFinite(y)) { minY = Math.min(minY, y); maxY = Math.max(maxY, y) }
    if (Number.isFinite(z)) { minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z) }
  }
  for (const node of nodes) take(node.x, node.y, node.z)
  for (const line of lines) for (const coordinate of line.coords) take(coordinate[0], coordinate[1], coordinate[2])
  if (!Number.isFinite(minX)) return null
  return {
    minX: round(minX, 2), minY: round(minY, 2), maxX: round(maxX, 2), maxY: round(maxY, 2),
    minZ: Number.isFinite(minZ) ? round(minZ, 2) : null, maxZ: Number.isFinite(maxZ) ? round(maxZ, 2) : null,
  }
}

/* --------------------------- 场景载荷（供三维渲染） --------------------------- */

/** 数据集在全局平面坐标中的有效原点：原始原点 + 人工配准偏移。 */
function effectiveOrigin(dataset) {
  const base = dataset?.meta?.transform?.origin || { x: 0, y: 0 }
  const reg = dataset?.meta?.transform?.registration || null
  if (!reg) return { x: base.x || 0, y: base.y || 0 }
  return { x: (base.x || 0) + (Number(reg.dx) || 0), y: (base.y || 0) + (Number(reg.dy) || 0) }
}

/** 人工坐标配准：仅记录平移量（米），用于不同坐标基准的数据集叠加与冲突检查。 */
export function setDatasetRegistration(id, { dx = 0, dy = 0, note = '' } = {}) {
  const dataset = getPipelineDataset(id)
  if (!dataset) throw Object.assign(new Error('数据集不存在'), { status: 404 })
  const meta = dataset.meta || {}
  const dxv = Number(dx)
  const dyv = Number(dy)
  if (!Number.isFinite(dxv) || !Number.isFinite(dyv)) throw Object.assign(new Error('配准偏移必须是数字（米）'), { status: 400 })
  const transform = { ...(meta.transform || {}) }
  const registration = (dxv || dyv) ? { dx: dxv, dy: dyv, note: String(note || ''), updatedAt: Date.now() } : null
  transform.registration = registration
  updatePipelineDatasetMeta(id, { status: dataset.status, note: dataset.note, meta: { ...meta, transform } })
  return { id, registration, transform }
}/** 单数据集载荷。局部坐标以数据集自身场景原点为基准。 */
function scenePartOf(datasetId, limit) {
  const dataset = getPipelineDataset(datasetId)
  if (!dataset) throw Object.assign(new Error('数据集不存在'), { status: 404 })
  const nodes = listPipeNodes(datasetId, { limit, sample: true })
  const lines = listPipeLines(datasetId, { limit, sample: true })
  const nodeById = new Map(nodes.map((node) => [node.nodeCode, node]))
  const sceneNodes = nodes.map((node) => ({
    id: node.id, code: node.nodeCode, category: node.category,
    x: node.x, y: node.y, z: node.z, groundElev: node.groundElev, coverDepth: node.coverDepth,
    major: node.attrs?.major || '', road: node.road, owner: node.owner, status: node.status,
    zQuality: node.attrs?.zQuality || (node.z === null ? 'none' : 'survey'),
  }))
  const sceneLines = lines.map((line) => {
    const coords = Array.isArray(line.geom?.coordinates) ? line.geom.coordinates : []
    const startNode = nodeById.get(line.nodeStart)
    const endNode = nodeById.get(line.nodeEnd)
    const sizeMm = Number(line.attrs?.sizeMm || 0) || null
    const profileType = line.profileType || (sizeMm ? '圆形' : '')
    const a = coords.map((coordinate) => [Number(coordinate[0]), Number(coordinate[1]), coordinate[2] === null || coordinate[2] === undefined ? null : Number(coordinate[2])])
    return {
      id: line.id, code: line.lineCode, major: line.pipeMajor || 'other',
      material: line.material, profileType, sizeMm,
      width: Number(line.attrs?.widthM || 0) || null, height: Number(line.attrs?.heightM || 0) || null,
      coords: a,
      startZ: line.startElev, endZ: line.endElev,
      startNode: line.nodeStart, endNode: line.nodeEnd,
      coverStart: line.startDepth, coverEnd: line.endDepth,
      length: line.length, road: line.road, owner: line.owner,
      zGrade: line.attrs?.zGrade || 'none',
      stage: dataset.meta?.stage || 'existing',
      buryType: line.buryType, status: line.status, buildYear: line.buildYear,
      flowDir: line.flowDir,
      startX: startNode?.x ?? (a[0]?.[0] ?? null), startY: startNode?.y ?? (a[0]?.[1] ?? null),
      endX: endNode?.x ?? (a[a.length - 1]?.[0] ?? null), endY: endNode?.y ?? (a[a.length - 1]?.[1] ?? null),
    }
  })
  const counts = {
    nodes: sceneNodes.length, lines: sceneLines.length,
    withZ: sceneLines.filter((line) => line.zGrade === 'complete').length,
    partialZ: sceneLines.filter((line) => line.zGrade === 'partial').length,
    withoutZ: sceneLines.filter((line) => line.zGrade === 'none').length,
  }
  return {
    dataset: {
      id: dataset.id, name: dataset.name, crs: dataset.crs, datum: dataset.datum,
      pointCount: dataset.pointCount, lineCount: dataset.lineCount,
      status: dataset.status, meta: dataset.meta,
    },
    bounds: dataset.meta?.bounds || boundsOf(nodes, lines),
    nodes: sceneNodes,
    lines: sceneLines,
    majors: dataset.meta?.majors || [],
    counts,
  }
}

/**
 * 场景载荷：可传单个 id 或 id 数组（叠加显示）。
 * 叠加时按各数据集记录的 transform.origin 还原到同一全局平面坐标，再以合并范围中心为原点，
 * 因此只有同一坐标基准（同片区、同坐标系）的数据集叠加才有意义；坐标基准不同时返回 alignmentWarnings。
 */
export function pipelineScenePayload(input, { limit = MAX_SCENE_FEATURES } = {}) {
  const ids = (Array.isArray(input) ? input : [input]).map((id) => String(id || '')).filter(Boolean)
  if (!ids.length) throw Object.assign(new Error('数据集不存在'), { status: 404 })
  const uniqueIds = [...new Set(ids)]
  const parts = uniqueIds.map((id) => scenePartOf(id, limit))
  if (parts.length === 1) {
    const only = parts[0]
    only.dataset.stage = only.dataset.meta?.stage || 'existing'
    return only
  }

  const originOf = (part) => {
    const dataset = getPipelineDataset(part.dataset.id)
    return dataset ? effectiveOrigin(dataset) : (part.dataset.meta?.transform?.origin || { x: 0, y: 0 })
  }
  const globalBounds = (part) => {
    const b = part.bounds
    if (!b) return null
    const o = originOf(part)
    return { minX: b.minX + o.x, maxX: b.maxX + o.x, minY: b.minY + o.y, maxY: b.maxY + o.y, minZ: b.minZ, maxZ: b.maxZ }
  }
  const boxes = parts.map(globalBounds).filter(Boolean)
  if (!boxes.length) throw Object.assign(new Error('数据集缺少空间范围'), { status: 422 })
  const gMinX = Math.min(...boxes.map((b) => b.minX))
  const gMaxX = Math.max(...boxes.map((b) => b.maxX))
  const gMinY = Math.min(...boxes.map((b) => b.minY))
  const gMaxY = Math.max(...boxes.map((b) => b.maxY))
  const cx = (gMinX + gMaxX) / 2
  const cy = (gMinY + gMaxY) / 2
  const zBoxes = boxes.filter((b) => Number.isFinite(b.minZ) && Number.isFinite(b.maxZ))
  const minZ = zBoxes.length ? Math.min(...zBoxes.map((b) => b.minZ)) : null
  const maxZ = zBoxes.length ? Math.max(...zBoxes.map((b) => b.maxZ)) : null

  const modes = new Set(parts.map((part) => part.dataset.meta?.transform?.mode || 'unknown'))
  const crsList = parts.map((part) => String(part.dataset.crs || '').trim()).filter(Boolean)
  const crsSet = new Set(crsList)
  const registered = parts.filter((part) => part.dataset.meta?.transform?.registration)
  const alignmentWarnings = []
  if (modes.size > 1) {
    alignmentWarnings.push('参与叠加的数据集坐标基准不同（' + [...modes].join(' / ') + '），几何位置可能不重合，需先做坐标配准')
  } else if (crsSet.size > 1) {
    alignmentWarnings.push('参与叠加的数据集坐标系不一致（' + [...crsSet].join(' / ') + '）' + (registered.length ? '，已按配准偏移对齐，请核对控制点' : '，需先在数据详情中做坐标配准'))
  }

  const nodes = []
  const lines = []
  for (const part of parts) {
    const o = originOf(part)
    const dx = o.x - cx
    const dy = o.y - cy
    const stage = part.dataset.meta?.stage || 'existing'
    for (const node of part.nodes) {
      nodes.push({ ...node, x: node.x == null ? node.x : node.x + dx, y: node.y == null ? node.y : node.y + dy, datasetId: part.dataset.id, datasetName: part.dataset.name, stage })
    }
    for (const line of part.lines) {
      lines.push({
        ...line,
        coords: line.coords.map((c) => [c[0] == null ? c[0] : c[0] + dx, c[1] == null ? c[1] : c[1] + dy, c[2]]),
        startX: line.startX == null ? line.startX : line.startX + dx,
        startY: line.startY == null ? line.startY : line.startY + dy,
        endX: line.endX == null ? line.endX : line.endX + dx,
        endY: line.endY == null ? line.endY : line.endY + dy,
        datasetId: part.dataset.id, datasetName: part.dataset.name, stage,
      })
    }
  }
  const counts = {
    nodes: nodes.length,
    lines: lines.length,
    withZ: lines.filter((line) => line.zGrade === 'complete').length,
    partialZ: lines.filter((line) => line.zGrade === 'partial').length,
    withoutZ: lines.filter((line) => line.zGrade === 'none').length,
  }
  return {
    dataset: {
      id: uniqueIds.join(','), name: parts.map((part) => part.dataset.name).join(' + '),
      ids: uniqueIds, overlay: true, stage: '',
      crs: [...new Set(parts.map((part) => part.dataset.crs).filter(Boolean))].join(' / '),
    },
    bounds: {
      minX: round(gMinX - cx, 2), maxX: round(gMaxX - cx, 2),
      minY: round(gMinY - cy, 2), maxY: round(gMaxY - cy, 2),
      minZ: minZ == null ? null : round(minZ, 2), maxZ: maxZ == null ? null : round(maxZ, 2),
    },
    nodes, lines,
    majors: [...new Set(parts.flatMap((part) => part.majors || []))],
    counts,
    parts: parts.map((part) => ({ id: part.dataset.id, name: part.dataset.name, stage: part.dataset.meta?.stage || 'existing' })),
    alignmentWarnings,
  }
}

/* ------------------------------ 几何分析 ------------------------------ */

const CATEGORY_LABEL = (key) => PIPE_MAJOR[key]?.label || key || '其他'

/** 检索用：把标准类别与常见地方叫法都算作命中词。 */
const CATEGORY_SEARCH_TEXT = {
  supply: '供水 给水 自来水',
  distribution: '配水',
  rain: '雨水',
  intercept: '截污',
  sewage: '污水 排水',
  combined: '合流',
  gas: '燃气 天然气 煤气',
  heat: '热力 供热 蒸汽',
  power: '电力 供电 路灯',
  telecom: '通信 通讯 电信',
  gallery: '管廊 综合管沟 管沟',
  other: '其他',
}

function arrayToMap(items) {
  const map = new Map(items.map((item) => [item.id, item]))
  return map
}

/** 两段三维线段最近距离（近似：采样 + 投影）。管段顶点不多，直接逐段计算。 */
function segSegDistance3D(p1, p2, q1, q2) {
  const u = [p2[0] - p1[0], p2[1] - p1[1], (p2[2] ?? 0) - (p1[2] ?? 0)]
  const v = [q2[0] - q1[0], q2[1] - q1[1], (q2[2] ?? 0) - (q1[2] ?? 0)]
  const w = [p1[0] - q1[0], p1[1] - q1[1], (p1[2] ?? 0) - (q1[2] ?? 0)]
  const a = u[0] * u[0] + u[1] * u[1] + u[2] * u[2]
  const b = u[0] * v[0] + u[1] * v[1] + u[2] * v[2]
  const c = v[0] * v[0] + v[1] * v[1] + v[2] * v[2]
  const d = u[0] * w[0] + u[1] * w[1] + u[2] * w[2]
  const e = v[0] * w[0] + v[1] * w[1] + v[2] * w[2]
  const denominator = a * c - b * b
  let sc = 0
  let tc = 0
  if (denominator > 1e-9) {
    sc = (b * e - c * d) / denominator
    tc = (a * e - b * d) / denominator
  }
  sc = Math.max(0, Math.min(1, sc))
  tc = Math.max(0, Math.min(1, tc))
  const closestP = [p1[0] + sc * u[0], p1[1] + sc * u[1], (p1[2] ?? 0) + sc * u[2]]
  const closestQ = [q1[0] + tc * v[0], q1[1] + tc * v[1], (q1[2] ?? 0) + tc * v[2]]
  const horizontal = Math.hypot(closestP[0] - closestQ[0], closestP[1] - closestQ[1])
  const vertical = Math.abs(closestP[2] - closestQ[2])
  return {
    distance: Math.hypot(horizontal, vertical),
    horizontal,
    vertical,
    p: closestP.map((value) => round(value, 3)),
    q: closestQ.map((value) => round(value, 3)),
  }
}

function lineToSegments(line) {
  const coords = line.coords || line.geom?.coordinates || []
  const segments = []
  for (let i = 1; i < coords.length; i += 1) {
    const a = coords[i - 1]
    const b = coords[i]
    if (!Number.isFinite(a[0]) || !Number.isFinite(b[0])) continue
    if (a[2] === null || b[2] === null) continue
    segments.push([a, b])
  }
  return segments
}

function lineMinDistance3D(lineA, lineB) {
  const segsA = lineToSegments(lineA)
  const segsB = lineToSegments(lineB)
  if (!segsA.length || !segsB.length) return null
  let best = null
  for (const [a1, a2] of segsA) {
    for (const [b1, b2] of segsB) {
      const result = segSegDistance3D(a1, a2, b1, b2)
      if (!best || result.distance < best.distance) best = result
    }
  }
  return best
}

/** 横断面分析：剖面线 A-B 与管段中心线求交，输出剖面制图数据。 */
export function analyzeSection(datasetId, { line, width = 0.4 } = {}) {
  const dataset = getPipelineDataset(datasetId)
  if (!dataset) throw Object.assign(new Error('数据集不存在'), { status: 404 })
  if (!Array.isArray(line) || line.length < 2) throw Object.assign(new Error('断面线需要两个端点 [x1,y1],[x2,y2]'), { status: 400 })
  const [x1, y1] = line[0]
  const [x2, y2] = line[1]
  const dx = x2 - x1
  const dy = y2 - y1
  const length = Math.hypot(dx, dy)
  if (!length) throw Object.assign(new Error('断面线两端点重合，无法采样'), { status: 400 })
  const ux = dx / length
  const uy = dy / length
  const lines = listPipeLines(datasetId, { limit: MAX_SCENE_FEATURES })
  const hits = []
  const demoted = []
  for (const pipe of lines) {
    const coords = Array.isArray(pipe.geom?.coordinates) ? pipe.geom.coordinates : []
    if (coords.length < 2) continue
    if (coords.some((coordinate) => coordinate[2] === null || coordinate[2] === undefined)) {
      demoted.push({ lineCode: pipe.lineCode, reason: '缺高程，无法给出剖面高程' })
      continue
    }
    for (let i = 1; i < coords.length; i += 1) {
      const p = coords[i - 1]
      const q = coords[i]
      const sx = q[0] - p[0]
      const sy = q[1] - p[1]
      const segLength = Math.hypot(sx, sy)
      if (!segLength) continue
      // 统一用单位向量求解，得到的 m / t 是实际长度，避免断面长度不同带来的缩放
      const ex = sx / segLength
      const ey = sy / segLength
      const denominator = ux * ey - uy * ex
      if (Math.abs(denominator) < 1e-9) continue
      const m = ((p[0] - x1) * ey - (p[1] - y1) * ex) / denominator
      const t = ((p[0] - x1) * uy - (p[1] - y1) * ux) / denominator
      if (m < 0 || m > length || t < 0 || t > segLength) continue
      const z1 = p[2]
      const z2 = q[2]
      const z = z1 + (z2 - z1) * (t / segLength)
      const station = m
      const perpendicular = 0
      hits.push({
        lineId: pipe.id, lineCode: pipe.lineCode,
        major: pipe.pipeMajor || 'other', majorLabel: CATEGORY_LABEL(pipe.pipeMajor),
        material: pipe.material, profileType: pipe.profileType, profileSize: pipe.profileSize,
        sizeMm: Number(pipe.attrs?.sizeMm || 0) || null,
        width: Number(pipe.attrs?.widthM || 0) || null,
        height: Number(pipe.attrs?.heightM || 0) || null,
        station: round(station, 2),
        z: round(z, 2),
        x: round(x1 + ux * station, 2), y: round(y1 + uy * station, 2),
        offset: round(perpendicular, 2),
      })
    }
  }
  hits.sort((a, b) => a.station - b.station)

  // 相邻净距（按剖面横向顺序，以管外壁计）
  const spacing = []
  for (let i = 1; i < hits.length; i += 1) {
    const a = hits[i - 1]
    const b = hits[i]
    const rA = (a.sizeMm || 200) / 2000
    const rB = (b.sizeMm || 200) / 2000
    spacing.push({
      from: a.lineCode, to: b.lineCode,
      centerDistance: round(b.station - a.station, 2),
      clearWidth: round((b.station - a.station) - rA - rB, 2),
      verticalDifference: round(Math.abs(b.z - a.z), 2),
      categoryPair: `${a.majorLabel}-${b.majorLabel}`,
    })
  }
  const result = {
    sectionLine: [[round(x1, 2), round(y1, 2)], [round(x2, 2), round(y2, 2)]],
    length: round(length, 2),
    width,
    hits,
    spacing,
    notAnalyzed: demoted.slice(0, 50),
    legend: PIPE_MAJOR,
  }
  const summary = hits.length
    ? `断面与 ${hits.length} 条管段相交，最近两管净距 ${spacing.length ? Math.min(...spacing.map((item) => item.clearWidth)) : '—'} m；未参与：${demoted.length} 条缺高程管段`
    : '断面未与任何具备高程的管段相交'
  return { type: 'section', params: { line, width }, result, summary }
}

/** 净距 / 碰撞统一计算：先空间网格筛候选，再精确三维距离。 */
export function analyzeProximity(datasetId, { threshold, categories = [], mode = 'all' } = {}) {
  const dataset = getPipelineDataset(datasetId)
  if (!dataset) throw Object.assign(new Error('数据集不存在'), { status: 404 })
  const lines = listPipeLines(datasetId, { limit: MAX_SCENE_FEATURES })
  const notJudgedLines = lines.filter((line) => line.attrs?.zGrade === 'none' || !Number(line.attrs?.sizeMm || 0))
  const usable = lines.filter((line) => {
    if (!Array.isArray(line.geom?.coordinates)) return false
    if (line.attrs?.zGrade === 'none') return false
    return true
  })
  const skipped = notJudgedLines.length
  const cells = new Map()
  const cellSize = 25
  const cellKey = (line) => {
    const coords = line.geom.coordinates
    const x = (coords[0][0] + coords[coords.length - 1][0]) / 2
    const y = (coords[0][1] + coords[coords.length - 1][1]) / 2
    return `${Math.floor(x / cellSize)}:${Math.floor(y / cellSize)}`
  }
  for (const line of usable) {
    const key = cellKey(line)
    if (!cells.has(key)) cells.set(key, [])
    cells.get(key).push(line)
  }
  const results = []
  const byId = new Map(usable.map((line) => [line.id, line]))
  let compared = 0
  for (const line of usable) {
    const coords = line.geom.coordinates
    const candidates = new Set()
    const minX = Math.min(...coords.map((c) => c[0]))
    const maxX = Math.max(...coords.map((c) => c[0]))
    const minY = Math.min(...coords.map((c) => c[1]))
    const maxY = Math.max(...coords.map((c) => c[1]))
    const i0 = Math.floor((minX - 30) / cellSize)
    const i1 = Math.floor((maxX + 30) / cellSize)
    const j0 = Math.floor((minY - 30) / cellSize)
    const j1 = Math.floor((maxY + 30) / cellSize)
    for (let i = i0; i <= i1; i += 1) {
      for (let j = j0; j <= j1; j += 1) {
        const bucket = cells.get(`${i}:${j}`)
        if (bucket) for (const other of bucket) if (other.id !== line.id) candidates.add(other.id)
      }
    }
    for (const otherId of candidates) {
      if (otherId <= line.id) continue
      const other = byId.get(otherId)
      if (!other) continue
      // 共享管点的相邻管段是同一根管线的延展，不能当碰撞
      const sharedNode = (line.nodeStart && (line.nodeStart === other.nodeStart || line.nodeStart === other.nodeEnd))
        || (line.nodeEnd && (line.nodeEnd === other.nodeStart || line.nodeEnd === other.nodeEnd))
      if (sharedNode) continue
      if (categories.length && (!categories.includes(line.pipeMajor) || !categories.includes(other.pipeMajor))) continue
      const distance = lineMinDistance3D(line, other)
      if (!distance) continue
      compared += 1
      const rA = (Number(line.attrs?.sizeMm || 0) || 300) / 2000
      const rB = (Number(other.attrs?.sizeMm || 0) || 300) / 2000
      const surface = distance.distance - rA - rB
      const dominant = line.pipeMajor === other.pipeMajor ? line.pipeMajor : null
      const rule = CLEARANCE_RULES[dominant || 'default'] || CLEARANCE_RULES.default
      const needH = threshold ?? rule.horizontal
      const needV = threshold ?? rule.vertical
      let level = 'ok'
      if (distance.distance < rA + rB) level = 'collision'
      else if (distance.horizontal - rA - rB < needH && distance.vertical < needV) level = 'clearance'
      else if (distance.distance - rA - rB < Math.min(needH, needV)) level = 'near'
      if (level === 'ok') continue
      results.push({
        id: `${line.id}~${other.id}`,
        level,
        lineA: { id: line.id, code: line.lineCode, major: line.pipeMajor, majorLabel: CATEGORY_LABEL(line.pipeMajor), sizeMm: line.attrs?.sizeMm || null },
        lineB: { id: other.id, code: other.lineCode, major: other.pipeMajor, majorLabel: CATEGORY_LABEL(other.pipeMajor), sizeMm: other.attrs?.sizeMm || null },
        distance: round(distance.distance, 2),
        horizontal: round(distance.horizontal, 2),
        vertical: round(distance.vertical, 2),
        surfaceDistance: round(surface, 2),
        required: { horizontal: needH, vertical: needV, source: rule.source || '企业内控默认值' },
        at: distance.p,
        atOther: distance.q,
      })
    }
  }
  const order = { collision: 0, clearance: 1, near: 2 }
  results.sort((a, b) => (order[a.level] - order[b.level]) || (a.surfaceDistance - b.surfaceDistance))
  const counts = { collision: 0, clearance: 0, near: 0 }
  for (const item of results) counts[item.level] += 1
  const summary = `碰撞 ${counts.collision} 处、净距不足 ${counts.clearance} 处、邻近需关注 ${counts.near} 处；未判定 ${skipped} 条（缺高程或断面）`
  return {
    type: mode === 'collision' ? 'collision' : 'clearance',
    params: { threshold, categories, mode },
    result: {
      items: results.slice(0, 200),
      total: results.length,
      counts,
      comparedPairs: compared,
      skipped,
      rules: CLEARANCE_RULES,
      notJudged: skipped ? '缺高程或断面的管段不参与判定，需人工复核' : '',
    },
    summary,
  }
}

/** 跨数据集冲突检查：拟建方案与现状管网之间，或不同来源数据之间的空间冲突。 */
export function analyzeConflict(ids, { threshold, mode = 'all', includeSameStage = false } = {}) {
  const wanted = [...new Set((Array.isArray(ids) ? ids : [ids]).map((id) => String(id || '')).filter(Boolean))]
  if (wanted.length < 2) throw Object.assign(new Error('跨数据集冲突检查至少需要两个数据集'), { status: 400 })
  const parts = wanted.map((id) => {
    const dataset = getPipelineDataset(id)
    if (!dataset) throw Object.assign(new Error(`数据集不存在：${id}`), { status: 404 })
    const origin = effectiveOrigin(dataset)
    return { dataset, origin, lines: listPipeLines(id, { limit: MAX_SCENE_FEATURES }) }
  })
  // 坐标系明确不同且未做配准时，几何比较没有意义；仅"未声明"时允许比较但给出提示
  const declaredCrs = [...new Set(parts.map((part) => String(part.dataset.crs || '').trim())
    .filter((crs) => crs && !/^未声明/.test(crs)))]
  const undeclared = parts.filter((part) => {
    const crs = String(part.dataset.crs || '').trim()
    return !crs || /^未声明/.test(crs)
  })
  const anyRegistration = parts.some((part) => part.dataset.meta?.transform?.registration)
  const modeSet = new Set(parts.map((part) => part.dataset.meta?.transform?.mode || 'unknown'))
  if ((declaredCrs.length > 1 || modeSet.size > 1) && !anyRegistration) {
    throw Object.assign(new Error('参与比较的数据集坐标系不一致（' + (declaredCrs.join(' / ') || [...modeSet].join(' / ')) + '），请先在数据集详情中完成坐标配准'), { status: 422 })
    }
  const crsWarnings = undeclared.length ? [`${undeclared.map((part) => part.dataset.name).join('、')} 未声明坐标系，按当前坐标数值直接比较，结果需人工核对基准`] : []
  const base = parts[0].origin
  const pool = []
  const notJudged = []
  for (const part of parts) {
    const dx = (part.origin.x || 0) - (base.x || 0)
    const dy = (part.origin.y || 0) - (base.y || 0)
    const stage = part.dataset.meta?.stage || 'existing'
    for (const line of part.lines) {
      const coords = Array.isArray(line.geom?.coordinates) ? line.geom.coordinates : []
      if (coords.length < 2) continue
      if (line.attrs?.zGrade === 'none' || !Number(line.attrs?.sizeMm || 0)) {
        notJudged.push({ dataset: part.dataset.name, lineCode: line.lineCode, major: line.pipeMajor, reason: line.attrs?.zGrade === 'none' ? '缺高程' : '缺断面尺寸' })
        continue
      }
      pool.push({
        ...line,
        geom: { ...line.geom, coordinates: coords.map((c) => [c[0] + dx, c[1] + dy, c[2]]) },
        datasetId: part.dataset.id, datasetName: part.dataset.name, stage,
      })
    }
  }

  const cellSize = 25
  const cells = new Map()
  for (const line of pool) {
    const coords = line.geom.coordinates
    const cx = (coords[0][0] + coords[coords.length - 1][0]) / 2
    const cy = (coords[0][1] + coords[coords.length - 1][1]) / 2
    const key = `${Math.floor(cx / cellSize)}:${Math.floor(cy / cellSize)}`
    if (!cells.has(key)) cells.set(key, [])
    cells.get(key).push(line)
  }

  const items = []
  let compared = 0
  for (const line of pool) {
    const coords = line.geom.coordinates
    const minX = Math.min(...coords.map((c) => c[0]))
    const maxX = Math.max(...coords.map((c) => c[0]))
    const minY = Math.min(...coords.map((c) => c[1]))
    const maxY = Math.max(...coords.map((c) => c[1]))
    const i0 = Math.floor((minX - 30) / cellSize)
    const i1 = Math.floor((maxX + 30) / cellSize)
    const j0 = Math.floor((minY - 30) / cellSize)
    const j1 = Math.floor((maxY + 30) / cellSize)
    const candidates = new Set()
    for (let i = i0; i <= i1; i += 1) {
      for (let j = j0; j <= j1; j += 1) {
        const bucket = cells.get(`${i}:${j}`)
        if (bucket) for (const other of bucket) if (other !== line) candidates.add(other)
      }
    }
    for (const other of candidates) {
      if (other.datasetId === line.datasetId) continue
      if (other.datasetId < line.datasetId) continue
      if (!includeSameStage && other.stage === line.stage) continue
      const distance = lineMinDistance3D(line, other)
      if (!distance) continue
      compared += 1
      const rA = (Number(line.attrs?.sizeMm || 0) || 300) / 2000
      const rB = (Number(other.attrs?.sizeMm || 0) || 300) / 2000
      const surface = distance.distance - rA - rB
      const dominant = line.pipeMajor === other.pipeMajor ? line.pipeMajor : null
      const rule = CLEARANCE_RULES[dominant || 'default'] || CLEARANCE_RULES.default
      const needH = threshold ?? rule.horizontal
      const needV = threshold ?? rule.vertical
      let level = 'ok'
      if (distance.distance < rA + rB) level = 'collision'
      else if (distance.horizontal - rA - rB < needH && distance.vertical < needV) level = 'clearance'
      else if (surface < Math.min(needH, needV)) level = 'near'
      if (level === 'ok') continue
      items.push({
        id: `${line.id}~${other.id}`,
        level,
        a: { datasetId: line.datasetId, datasetName: line.datasetName, stage: line.stage, code: line.lineCode, major: line.pipeMajor, majorLabel: CATEGORY_LABEL(line.pipeMajor), sizeMm: line.attrs?.sizeMm || null },
        b: { datasetId: other.datasetId, datasetName: other.datasetName, stage: other.stage, code: other.lineCode, major: other.pipeMajor, majorLabel: CATEGORY_LABEL(other.pipeMajor), sizeMm: other.attrs?.sizeMm || null },
        distance: round(distance.distance, 2),
        horizontal: round(distance.horizontal, 2),
        vertical: round(distance.vertical, 2),
        surfaceDistance: round(surface, 2),
        required: { horizontal: needH, vertical: needV, source: rule.source || '企业内控默认值' },
        at: distance.p,
        atOther: distance.q,
      })
    }
  }
  const order = { collision: 0, clearance: 1, near: 2 }
  items.sort((a, b) => (order[a.level] - order[b.level]) || (a.surfaceDistance - b.surfaceDistance))
  const counts = { collision: 0, clearance: 0, near: 0 }
  for (const item of items) counts[item.level] += 1
  const summary = items.length
    ? `跨数据集冲突：实体交叉 ${counts.collision} 处、净距不足 ${counts.clearance} 处、邻近 ${counts.near} 处；比较 ${compared} 对，未判定 ${notJudged.length} 条`
    : `未发现跨数据集空间冲突；比较 ${compared} 对，未判定 ${notJudged.length} 条`
  return {
    type: 'conflict',
    params: { ids: wanted, threshold, mode, includeSameStage },
    result: {
      items: items.slice(0, 200), total: items.length, counts, comparedPairs: compared,
      datasets: parts.map((part) => ({ id: part.dataset.id, name: part.dataset.name, stage: part.dataset.meta?.stage || 'existing' })),
      crsWarnings,
      notJudged: notJudged.slice(0, 50),
      rules: CLEARANCE_RULES,
    },
    summary,
  }
}

/** 开挖影响分析：范围线 + 深度。 */
export function analyzeExcavation(datasetId, { polygon, depth = 2 } = {}) {
  const dataset = getPipelineDataset(datasetId)
  if (!dataset) throw Object.assign(new Error('数据集不存在'), { status: 404 })
  if (!Array.isArray(polygon) || polygon.length < 3) throw Object.assign(new Error('开挖范围至少需要 3 个点'), { status: 400 })
  const area = polygonArea(polygon)
  const lines = listPipeLines(datasetId, { limit: MAX_SCENE_FEATURES })
  const affected = []
  const notJudged = []
  for (const line of lines) {
    const coords = Array.isArray(line.geom?.coordinates) ? line.geom.coordinates : []
    if (coords.length < 2) continue
    const inside = coords.filter((coordinate) => pointInPolygon(coordinate[0], coordinate[1], polygon))
    const crosses = !inside.length && segmentCrossesPolygon(coords, polygon)
    if (!inside.length && !crosses) continue
    const zs = coords.map((coordinate) => coordinate[2]).filter(Number.isFinite)
    if (!zs.length) {
      notJudged.push({ lineCode: line.lineCode, major: line.pipeMajor, reason: '缺高程，无法判断是否落在开挖深度内' })
      continue
    }
    const minZ = Math.min(...zs)
    const maxZ = Math.max(...zs)
    const groundEstimate = (line.startElev ?? minZ) + (line.startDepth ?? 0)
    const excavationBottom = groundEstimate - depth
    const intersectsDepth = minZ <= groundEstimate && maxZ >= excavationBottom
    affected.push({
      id: line.id, lineCode: line.lineCode,
      major: line.pipeMajor || 'other', majorLabel: CATEGORY_LABEL(line.pipeMajor),
      material: line.material, profileSize: line.profileSize, sizeMm: line.attrs?.sizeMm || null,
      minZ: round(minZ, 2), maxZ: round(maxZ, 2),
      groundEstimate: round(groundEstimate, 2), excavationBottom: round(excavationBottom, 2),
      intersectsDepth, relation: inside.length ? '范围内' : '跨边界',
      pointsInside: inside.length,
      owner: line.owner, road: line.road,
    })
  }
  const earthwork = area * depth
  const byMajor = {}
  for (const item of affected) byMajor[item.majorLabel] = (byMajor[item.majorLabel] || 0) + 1
  const summary = `范围内受影响管线 ${affected.length} 条（${Object.entries(byMajor).map(([key, value]) => `${key} ${value}`).join('、') || '无'}），估算土方 ${round(earthwork, 1)} m³；需现场探测确认`
  return {
    type: 'excavation',
    params: { polygon, depth },
    result: {
      area: round(area, 1), depth, earthwork: round(earthwork, 1),
      affected, notJudged, byMajor,
      note: '分析结果用于辅助核查，不替代现场探测与施工安全确认',
    },
    summary,
  }
}

function polygonArea(polygon) {
  let area = 0
  for (let i = 0; i < polygon.length; i += 1) {
    const [x1, y1] = polygon[i]
    const [x2, y2] = polygon[(i + 1) % polygon.length]
    area += x1 * y2 - x2 * y1
  }
  return Math.abs(area / 2)
}

function pointInPolygon(x, y, polygon) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i += 1) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) inside = !inside
  }
  return inside
}

function segmentCrossesPolygon(coords, polygon) {
  for (let i = 1; i < coords.length; i += 1) {
    for (let j = 0; j < polygon.length; j += 1) {
      const a = coords[i - 1]
      const b = coords[i]
      const c = polygon[j]
      const d = polygon[(j + 1) % polygon.length]
      if (segmentsIntersect(a, b, c, d)) return true
    }
  }
  return false
}

function segmentsIntersect(a, b, c, d) {
  const orient = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
  const o1 = orient(a, b, c)
  const o2 = orient(a, b, d)
  const o3 = orient(c, d, a)
  const o4 = orient(c, d, b)
  return ((o1 > 0) !== (o2 > 0)) && ((o3 > 0) !== (o4 > 0))
}

/* ------------------------------ 统计 ------------------------------ */

export function pipelineStats(datasetId) {
  const dataset = getPipelineDataset(datasetId)
  if (!dataset) throw Object.assign(new Error('数据集不存在'), { status: 404 })
  const nodes = listPipeNodes(datasetId, { limit: MAX_SCENE_FEATURES })
  const lines = listPipeLines(datasetId, { limit: MAX_SCENE_FEATURES })
  const byMajor = {}
  for (const [key, value] of Object.entries(PIPE_MAJOR)) {
    byMajor[key] = { key, label: value.label, color: value.color, length: 0, count: 0, points: 0 }
  }
  let totalLength = 0
  for (const line of lines) {
    const key = line.pipeMajor || 'other'
    if (!byMajor[key]) byMajor[key] = { key, label: key, color: '#9aa0a6', length: 0, count: 0, points: 0 }
    byMajor[key].length = round(byMajor[key].length + (line.length || 0), 2)
    byMajor[key].count += 1
    totalLength += line.length || 0
  }
  for (const node of nodes) {
    const key = node.attrs?.major || 'other'
    if (byMajor[key]) byMajor[key].points += 1
  }
  const byMaterial = {}
  for (const line of lines) {
    const key = line.material || '未填写'
    byMaterial[key] = byMaterial[key] || { material: key, count: 0, length: 0 }
    byMaterial[key].count += 1
    byMaterial[key].length = round(byMaterial[key].length + (line.length || 0), 2)
  }
  const byYear = {}
  for (const line of lines) {
    const key = String(line.buildYear || '').slice(0, 4) || '未填写'
    byYear[key] = byYear[key] || { year: key, count: 0, length: 0 }
    byYear[key].count += 1
    byYear[key].length = round(byYear[key].length + (line.length || 0), 2)
  }
  const byOwner = {}
  for (const line of lines) {
    const key = line.owner || '未填写'
    byOwner[key] = byOwner[key] || { owner: key, count: 0, length: 0 }
    byOwner[key].count += 1
    byOwner[key].length = round(byOwner[key].length + (line.length || 0), 2)
  }
  const issues = listPipeIssues(datasetId)
  return {
    datasetId,
    name: dataset.name,
    totals: {
      points: nodes.length, lines: lines.length,
      length: round(totalLength, 1),
      majors: Object.values(byMajor).filter((item) => item.count || item.points).length,
    },
    byMajor: Object.values(byMajor),
    byMaterial,
    byYear,
    byOwner,
    quality: {
      issues: issues.length,
      high: issues.filter((issue) => issue.severity === '高').length,
      withZ: lines.filter((line) => line.attrs?.zGrade === 'complete').length,
      withoutZ: lines.filter((line) => line.attrs?.zGrade === 'none').length,
    },
    rulesSource: '企业内控默认值（净距），需按现行规范复核',
  }
}

/* --------------------------- 向量检索（属性查图） --------------------------- */

export function searchPipelineFeatures(datasetId, { query = '', kind = 'line', limit = 50 } = {}) {
  const keyword = String(query || '').trim().toLowerCase()
  if (kind === 'node') {
    const nodes = listPipeNodes(datasetId, { limit: MAX_SCENE_FEATURES })
    const list = nodes.filter((node) => {
      if (!keyword) return true
      return [node.nodeCode, node.category, CATEGORY_LABEL(node.attrs?.major), node.road, node.owner, node.address, node.status]
        .some((value) => String(value || '').toLowerCase().includes(keyword))
    }).slice(0, Math.min(limit, 200))
    return { items: list.map((node) => ({ ...node, kind: 'node' })), total: list.length }
  }
  const lines = listPipeLines(datasetId, { limit: MAX_SCENE_FEATURES })
  const list = lines.filter((line) => {
    if (!keyword) return true
    return [line.lineCode, line.pipeMajor, CATEGORY_LABEL(line.pipeMajor), CATEGORY_SEARCH_TEXT[line.pipeMajor], line.material, line.profileSize, line.road, line.owner, line.status, line.nodeStart, line.nodeEnd]
      .some((value) => String(value || '').toLowerCase().includes(keyword))
  }).slice(0, Math.min(limit, 200))
  return {
    items: list.map((line) => ({
      ...line, kind: 'line',
      majorLabel: CATEGORY_LABEL(line.pipeMajor),
      coords: Array.isArray(line.geom?.coordinates) ? line.geom.coordinates : [],
    })),
    total: list.length,
  }
}

/* --------------------------- 分析结果持久化 --------------------------- */

export function saveAnalysisRun({ datasetId, analysis, owner, net }) {
  return insertPipeAnalysisRun({
    datasetId,
    type: analysis.type,
    params: analysis.params,
    result: analysis.result,
    summary: analysis.summary,
    owner,
    net,
  })
}

export function listAnalyses(datasetId, { type = '' } = {}) {
  return listPipeAnalysisRuns(datasetId, { type, limit: 100 })
}

export function getAnalysis(id) {
  return getPipeAnalysisRun(id)
}

export function deleteAnalysis(id, owner) {
  return softDeletePipeAnalysisRun(id, owner)
}

/* --------------------------- 数据管理补充 --------------------------- */

export function listDatasets(owner) {
  return listPipelineDatasets({ owner, limit: 200 })
}

export function datasetDetail(id) {
  const dataset = getPipelineDataset(id)
  if (!dataset) return null
  const issues = listPipeIssues(id)
  return {
    ...dataset,
    counts: { points: countPipeNodes(id), lines: countPipeLines(id) },
    issues,
    topology: listPipeTopology(id).length,
  }
}

export function deleteDataset(id, owner) {
  return softDeletePipelineDataset(id, owner)
}

export function resolveDatasetIssue(id) {
  resolvePipeIssue(id)
}

export { listPipeLines, listPipeNodes, listPipeIssues }
