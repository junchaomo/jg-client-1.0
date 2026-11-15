/**
 * 成果一致性检查：只读扫描项目本地目录，抽取文档文本并检查
 * 指标、日期、版本和项目名称是否一致。
 *
 * 这一层不依赖 OA、通讯录或 SSO：项目目录就是唯一数据源。
 * 以后接入集团系统时，只需要在调用方把数据源换成 OA/数据中心，
 * 本模块的检查规则和输出结构保持不变。
 */
import { readdirSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { join, extname, basename } from 'node:path'
import { inflateRawSync } from 'node:zlib'
import { extractText as extractPdfText } from './pdf.mjs'

const MAX_FILES = 120
const MAX_FILE_BYTES = 8 * 1024 * 1024
const MAX_TOTAL_BYTES = 80 * 1024 * 1024
const MAX_DEPTH = 6
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'out', '.next', 'coverage', '.cache', '.tmp', 'vendor', '__pycache__'])
const TEXT_EXTS = new Set(['.pdf', '.docx', '.xlsx', '.pptx', '.txt', '.md', '.csv'])
const SPATIAL_EXTS = new Set(['.dxf', '.geojson'])
const UNSUPPORTED_EXTS = new Set(['.doc', '.xls', '.ppt', '.dwg', '.zip'])

function xmlDecode(value = '') {
  return String(value)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number(num)))
}

function xmlText(xml = '') {
  return xmlDecode(String(xml)
    .replace(/<\/(?:w:p|w:tr|a:p|p|row)>/gi, '\n')
    .replace(/<(?:w:tab|a:tab)\s*\/?>/gi, '\t')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ''))
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Office 文件是 ZIP 容器；这里只读取需要的 XML 条目，不引入额外依赖。 */
function zipEntries(buffer) {
  let eocd = -1
  const min = Math.max(0, buffer.length - 65558)
  for (let i = buffer.length - 22; i >= min; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('不是有效的 ZIP/Office 文件')
  const count = buffer.readUInt16LE(eocd + 10)
  const cdOffset = buffer.readUInt32LE(eocd + 16)
  const entries = new Map()
  let p = cdOffset
  for (let i = 0; i < count && p + 46 <= buffer.length; i += 1) {
    if (buffer.readUInt32LE(p) !== 0x02014b50) break
    const method = buffer.readUInt16LE(p + 10)
    const compSize = buffer.readUInt32LE(p + 20)
    const nameLen = buffer.readUInt16LE(p + 28)
    const extraLen = buffer.readUInt16LE(p + 30)
    const commentLen = buffer.readUInt16LE(p + 32)
    const localOffset = buffer.readUInt32LE(p + 42)
    const name = buffer.subarray(p + 46, p + 46 + nameLen).toString('utf8')
    entries.set(name.replace(/\\/g, '/'), { method, compSize, localOffset })
    p += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

function zipRead(buffer, entry) {
  if (!entry) return Buffer.alloc(0)
  const p = entry.localOffset
  if (buffer.readUInt32LE(p) !== 0x04034b50) throw new Error('ZIP 本地文件头无效')
  const nameLen = buffer.readUInt16LE(p + 26)
  const extraLen = buffer.readUInt16LE(p + 28)
  const start = p + 30 + nameLen + extraLen
  const data = buffer.subarray(start, start + entry.compSize)
  if (entry.method === 0) return data
  if (entry.method === 8) return inflateRawSync(data)
  throw new Error(`不支持的 ZIP 压缩方式：${entry.method}`)
}

function officeText(buffer, ext) {
  const entries = zipEntries(buffer)
  const get = (name) => {
    const hit = [...entries.keys()].find((key) => key.toLowerCase() === name.toLowerCase())
    return hit ? zipRead(buffer, entries.get(hit)) : null
  }
  const names = [...entries.keys()]

  if (ext === '.docx') {
    const parts = names.filter((name) => /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/i.test(name))
      .sort((a, b) => (a === 'word/document.xml' ? -1 : b === 'word/document.xml' ? 1 : a.localeCompare(b)))
    return parts.map((name) => xmlText(get(name).toString('utf8'))).filter(Boolean).join('\n')
  }

  if (ext === '.pptx') {
    const slides = names.filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort((a, b) => Number((a.match(/slide(\d+)/i) || [])[1]) - Number((b.match(/slide(\d+)/i) || [])[1]))
    return slides.map((name, index) => `幻灯片 ${index + 1}\n${xmlText(get(name).toString('utf8'))}`).join('\n\n')
  }

  if (ext === '.xlsx') {
    const shared = []
    const ss = get('xl/sharedStrings.xml')
    if (ss) {
      const xml = ss.toString('utf8')
      for (const match of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gi)) shared.push(xmlText(match[1]))
    }
    const sheets = names.filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name))
      .sort((a, b) => Number((a.match(/sheet(\d+)/i) || [])[1]) - Number((b.match(/sheet(\d+)/i) || [])[1]))
    const out = []
    for (const name of sheets) {
      const xml = get(name).toString('utf8')
      out.push(`工作表 ${basename(name, '.xml')}`)
      for (const row of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gi)) {
        const values = []
        for (const cell of row[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/gi)) {
          const attrs = cell[1] || ''
          const body = cell[2] || ''
          const type = (attrs.match(/\bt="([^"]*)"/) || [])[1] || ''
          const raw = (body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i) || [])[1]
            || (body.match(/<t\b[^>]*>([\s\S]*?)<\/t>/i) || [])[1]
            || ''
          let value = xmlDecode(raw)
          if (type === 's' && Number.isInteger(Number(value))) value = shared[Number(value)] || ''
          if (type === 'inlineStr') value = xmlText(body)
          values.push(String(value).replace(/\s+/g, ' ').trim())
        }
        if (values.some(Boolean)) out.push(values.join('\t'))
      }
    }
    return out.join('\n').trim()
  }
  return ''
}

function extractDocumentText(buffer, ext) {
  if (ext === '.pdf') {
    const result = extractPdfText(buffer)
    return String(result?.text || '')
  }
  if (['.docx', '.xlsx', '.pptx'].includes(ext)) return officeText(buffer, ext)
  if (['.txt', '.md', '.csv'].includes(ext)) return buffer.toString('utf8').replace(/\u0000/g, '').trim()
  return ''
}

function snippet(value = '', max = 160) {
  const text = String(value).replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max)}…` : text
}

function compact(value = '') {
  return String(value).replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '')
}

function normLabel(value = '') {
  return String(value)
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/^(?:其中|本次|本项目|项目|规划|总|合计|共计|约|约为|为|是|达到)+/u, '')
    .replace(/(?:约|约为|为|是|达到|共计|合计|总计)$/u, '')
    .replace(/\s+/g, '')
    .trim()
}

function lineFacts(text) {
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const metrics = []
  const dates = []
  const metricRe = /([^\n\r]{0,36}?)(\d+(?:\.\d+)?)\s*(万平方米|平方米|公顷|ha|hm²|亩|公里|km|米|m|万元|亿元|%|人|户|个|处)/gi
  const dateRe = /(编制|完成|出图|评审|批复|提交|发布|校核|审核|验收|日期)[^0-9\n]{0,10}(\d{4})\s*(?:年|[./-])\s*(\d{1,2})\s*(?:月|[./-])\s*(\d{1,2})\s*日?/g
  for (const line of lines) {
    if (line.length > 600) continue
    for (const match of line.matchAll(dateRe)) {
      const label = `${match[1]}日期`
      const value = `${match[2]}-${String(match[3]).padStart(2, '0')}-${String(match[4]).padStart(2, '0')}`
      dates.push({ label, value, text: snippet(line) })
    }
    for (const match of line.matchAll(metricRe)) {
      const numberStart = match.index + match[1].length
      const rawLabel = line.slice(Math.max(0, numberStart - 28), numberStart)
      const label = normLabel(rawLabel.replace(/[：:]\s*$/u, '').split(/[，,。；;]/).pop() || '')
      if (label.length < 2 || label.length > 24 || /\d/.test(label)) continue
      const unit = match[3].replace(/^ha$/i, '公顷').replace(/^hm²$/i, '公顷').replace(/^km$/i, '公里').replace(/^m$/i, '米')
      metrics.push({ label, unit, value: Number(match[2]), text: snippet(line) })
    }
  }
  return { metrics, dates }
}

function versionFacts(text) {
  const values = []
  for (const match of String(text || '').matchAll(/(?:版本号|版本|版次|Version)\s*[:：]?\s*[Vv]?(\d+(?:\.\d+){1,3})/gi)) {
    values.push(`V${match[1]}`)
  }
  return values
}

function checkStatus(level, title, detail, evidence = []) {
  return { level, title, detail, evidence: evidence.slice(0, 5) }
}

/**
 * @param {{cwd: string, projectName?: string}} input
 * @returns {object} 只读检查结果；不写入项目目录。
 */
export function checkProjectDeliverables({ cwd, projectName = '' } = {}) {
  if (!cwd) throw Object.assign(new Error('项目未绑定本地文件夹'), { status: 409, code: 'PROJECT_DIR_UNBOUND' })
  let root
  try {
    root = realpathSync(String(cwd))
    if (!statSync(root).isDirectory()) throw new Error('项目路径不是文件夹')
  } catch (error) {
    throw Object.assign(new Error(`项目文件夹不可用：${error?.code || error?.message || error}`), { status: 404, code: 'PROJECT_DIR_UNAVAILABLE' })
  }

  const files = []
  const unsupported = []
  const skipped = []
  let totalBytes = 0
  let truncated = false
  const walk = (dir, depth) => {
    if (files.length >= MAX_FILES || totalBytes >= MAX_TOTAL_BYTES) { truncated = true; return }
    let entries
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch (error) {
      skipped.push({ path: dir, reason: `无法读取目录：${error?.code || error?.message || error}` })
      return
    }
    for (const entry of entries) {
      if (files.length >= MAX_FILES || totalBytes >= MAX_TOTAL_BYTES) { truncated = true; break }
      if (entry.name.startsWith('.') || entry.name.startsWith('~$')) continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (depth < MAX_DEPTH && !SKIP_DIRS.has(entry.name.toLowerCase())) walk(full, depth + 1)
        continue
      }
      if (!entry.isFile()) continue
      const ext = extname(entry.name).toLowerCase()
      let size = 0
      try { size = statSync(full).size } catch (_) {}
      if (UNSUPPORTED_EXTS.has(ext)) {
        unsupported.push({ path: entry.name, ext, reason: `${ext} 当前只能登记，暂不支持文本抽取` })
        continue
      }
      if (!TEXT_EXTS.has(ext) && !SPATIAL_EXTS.has(ext)) continue
      if (size > MAX_FILE_BYTES) {
        skipped.push({ path: entry.name, reason: `文件超过 ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB，已跳过` })
        continue
      }
      let buffer
      try { buffer = readFileSync(full) } catch (error) {
        files.push({ name: entry.name, ext, size, textLength: 0, status: 'error', note: `读取失败：${error?.code || error?.message || error}` })
        continue
      }
      totalBytes += buffer.length
      if (SPATIAL_EXTS.has(ext)) {
        files.push({ name: entry.name, ext, size: buffer.length, textLength: 0, status: 'spatial', note: '空间/图形数据，不做文本指标比对' })
        continue
      }
      try {
        const text = extractDocumentText(buffer, ext)
        files.push({ name: entry.name, ext, size: buffer.length, textLength: text.length, status: text.length ? 'ok' : 'empty', text, note: text.length ? '' : '未抽取到文本，可能是扫描件或空文件' })
      } catch (error) {
        files.push({ name: entry.name, ext, size: buffer.length, textLength: 0, status: 'error', note: `解析失败：${error?.message || error}` })
      }
    }
  }
  walk(root, 0)

  const docs = files.filter((file) => file.text)
  const checks = []
  const metricGroups = new Map()
  const dateGroups = new Map()
  const versionGroups = new Map()
  const projectCompact = compact(projectName)

  for (const file of docs) {
    const facts = lineFacts(file.text)
    for (const item of facts.metrics) {
      const key = `${item.label}|${item.unit}`
      if (!metricGroups.has(key)) metricGroups.set(key, [])
      metricGroups.get(key).push({ ...item, file: file.name })
    }
    for (const item of facts.dates) {
      if (!dateGroups.has(item.label)) dateGroups.set(item.label, [])
      dateGroups.get(item.label).push({ ...item, file: file.name })
    }
    for (const version of versionFacts(file.text)) {
      if (!versionGroups.has(version)) versionGroups.set(version, [])
      versionGroups.get(version).push({ file: file.name })
    }
  }

  for (const [key, items] of metricGroups) {
    const values = [...new Set(items.map((item) => `${item.value}${item.unit}`))]
    if (values.length <= 1) continue
    const [label, unit] = key.split('|')
    checks.push(checkStatus('conflict', '指标取值不一致', `${label} 在成果中出现 ${values.length} 个不同取值（${values.slice(0, 4).join('、')}），请核对统一口径。`, items.map((item) => ({ file: item.file, text: item.text }))))
  }

  for (const [label, items] of dateGroups) {
    const values = [...new Set(items.map((item) => item.value))]
    if (values.length <= 1) continue
    checks.push(checkStatus('conflict', '关键日期不一致', `${label} 出现 ${values.length} 个不同日期（${values.slice(0, 4).join('、')}）。`, items.map((item) => ({ file: item.file, text: item.text }))))
  }

  if (versionGroups.size > 1) {
    const versions = [...versionGroups.keys()]
    checks.push(checkStatus('warning', '版本标识不统一', `共发现 ${versions.length} 个版本标识（${versions.slice(0, 6).join('、')}），请确认成果是否为同一版。`, versions.map((version) => ({ file: versionGroups.get(version).map((x) => x.file).join('、'), text: version }))))
  }

  if (projectCompact.length >= 3) {
    const mentions = [...files].filter((file) => compact(file.name).includes(projectCompact) || (projectCompact.length <= 6 ? compact(file.name).includes(projectCompact.slice(0, 4)) : false))
    if (!docs.some((file) => compact(file.text).includes(projectCompact)) && !mentions.length) {
      checks.push(checkStatus('warning', '成果未体现项目名称', `文档正文和文件名中均未找到“${projectName}”，请确认成果是否属于本项目。`, files.slice(0, 3).map((file) => ({ file: file.name, text: file.name }))))
    }
  }

  const empty = files.filter((file) => file.status === 'empty' || file.status === 'error')
  if (empty.length) {
    checks.push(checkStatus('warning', '部分成果无法核对', `${empty.length} 个文件未抽取到可核对文本，已保留在文件清单中。`, empty.map((file) => ({ file: file.name, text: file.note || '无文本' }))))
  }

  if (unsupported.length) {
    checks.push(checkStatus('warning', '存在未支持的旧格式', `${unsupported.length} 个文件暂不能抽取文本（${unsupported.map((file) => file.ext).filter((v, i, a) => a.indexOf(v) === i).join('、')}），需要人工打开核对。`, unsupported.slice(0, 5).map((file) => ({ file: file.path, text: file.reason }))))
  }

  if (!files.length) {
    checks.push(checkStatus('warning', '未发现可检查成果', '项目目录中没有 PDF、DOCX、XLSX、PPTX、TXT、MD、CSV、DXF 或 GeoJSON 文件。', []))
  }

  if (truncated || skipped.length) {
    checks.push(checkStatus('warning', '扫描范围已截断', `为保证响应速度，最多检查 ${MAX_FILES} 个文件；本次${truncated ? '达到上限' : '有文件被跳过'}，结果仅供参考。`, skipped.slice(0, 5).map((item) => ({ file: item.path, text: item.reason }))))
  }

  const conflicts = checks.filter((item) => item.level === 'conflict').length
  const warnings = checks.filter((item) => item.level === 'warning').length
  const status = conflicts ? 'conflict' : warnings ? 'warning' : 'ok'

  return {
    ok: true,
    status,
    project: { name: String(projectName || ''), cwd: root },
    summary: {
      files: files.length,
      documents: docs.length,
      spatial: files.filter((file) => file.status === 'spatial').length,
      unsupported: unsupported.length,
      conflicts,
      warnings,
      totalBytes,
      truncated,
    },
    files: files.map(({ text, ...file }) => file),
    checks,
    generatedAt: new Date().toISOString(),
    note: '只读检查，不会修改、移动或删除项目目录中的任何文件。',
  }
}
