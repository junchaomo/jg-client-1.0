/**
 * 统一文件预览基座
 * Office 文档由随包的 LibreOffice 引擎真实转换为 PDF，再交给浏览器内嵌查看；
 * 这里只负责转换、缓存与统一的只读预览页外壳，不修改原文件。
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, extname, join } from 'node:path'
import { createCanvas } from '@napi-rs/canvas'
import { getDocument as getPdfJsThumbDoc } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { dataDirPath } from './db.mjs'

const OFFICE_EXT = new Set(['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.docm', '.xlsm', '.pptm', '.rtf', '.odt', '.ods', '.odp'])
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.ico'])
const TEXT_EXT = new Set(['.txt', '.md', '.csv', '.json', '.geojson', '.xml', '.log', '.yaml', '.yml', '.ini', '.js', '.mjs', '.ts', '.css', '.html', '.htm'])
const SPATIAL_EXT = new Set(['.dxf', '.shp', '.geojson', '.json', '.zip'])
const CONVERTIBLE = new Set(['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.docm', '.xlsm', '.pptm', '.rtf', '.odt', '.ods', '.odp'])

const MIME = {
  '.pdf': 'application/pdf',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.bmp': 'image/bmp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
}

let converterPromise = null
let converter = null
const inflight = new Map()

function previewCacheDir() {
  const dir = join(dataDirPath(), 'preview-cache')
  try { mkdirSync(dir, { recursive: true }) } catch (_) {}
  return dir
}

async function getConverter() {
  if (converter) return converter
  if (!converterPromise) {
    converterPromise = (async () => {
      const kitUrl = new URL('./dsh-runtime/node_modules/@deepseek-ai/libreoffice-kit/lib/index.js', import.meta.url)
      const kit = await import(kitUrl.href)
      converter = await kit.createConverter({
        timeoutMs: 120000,
        maxInputBytes: 80 * 1024 * 1024,
        maxOutputBytes: 150 * 1024 * 1024,
        maxImageResolution: 144,
        fontFallbacks: [
          ['仿宋_GB2312', 'FangSong', 'STFangsong', 'FangSong_GB2312', 'Noto Serif CJK SC', 'SimSun'],
          ['楷体_GB2312', 'KaiTi', 'STKaiti', 'KaiTi_GB2312', 'Noto Serif CJK SC', 'SimSun'],
          ['方正小标宋简体', 'FZXiaoBiaoSong-B05S', 'STZhongsong', 'Noto Serif CJK SC', 'SimSun'],
        ],
      })
      return converter
    })().catch((error) => {
      converterPromise = null
      throw error
    })
  }
  return converterPromise
}

export function previewKind(name = '', isDirectory = false) {
  const ext = extname(String(name || '')).toLowerCase()
  if (isDirectory) return ext === '.gdb' ? 'spatial' : 'folder'
  if (ext === '.pdf') return 'pdf'
  if (CONVERTIBLE.has(ext)) return 'office'
  if (ext === '.dxf' || ext === '.shp') return 'spatial'
  if (ext === '.gdb') return 'spatial'
  if (ext === '.zip') return 'spatial'
  if (ext === '.geojson') return 'spatial'
  if (IMAGE_EXT.has(ext)) return 'image'
  if (TEXT_EXT.has(ext)) return 'text'
  return 'unsupported'
}

export function isOfficePreview(name) {
  return previewKind(name) === 'office'
}

export function mimeFor(name) {
  return MIME[extname(String(name || '')).toLowerCase()] || 'application/octet-stream'
}

async function renderOfficeToCache(inputPath, key) {
  const out = join(previewCacheDir(), `${key}.pdf`)
  const metaPath = `${out}.meta.json`
  if (existsSync(out)) {
    let missingFonts = []
    try { missingFonts = JSON.parse(readFileSync(metaPath, 'utf8')).missingFonts || [] } catch (_) {}
    return { pdfPath: out, cached: true, backend: 'cache', missingFonts }
  }
  if (inflight.has(key)) return inflight.get(key)
  const job = (async () => {
    const conv = await getConverter()
    const result = await conv.render({ inputPath, outputPath: out })
    const missingFonts = Array.isArray(result?.missingFonts) ? result.missingFonts : []
    try { writeFileSync(metaPath, JSON.stringify({ missingFonts, backend: result?.backend || conv.backend }), 'utf8') } catch (_) {}
    return { pdfPath: out, cached: false, backend: result?.backend || conv.backend, missingFonts }
  })()
  inflight.set(key, job)
  try {
    return await job
  } finally {
    inflight.delete(key)
  }
}

/**
 * 把一个 Office 文件转换为 PDF；同一路径、同一大小与修改时间只转换一次。
 * 返回的 PDF 在 data/preview-cache 下，属于本机缓存，不改变源文件。
 */
export async function officePdfFor(sourcePath, name = '') {
  const stat = statSync(sourcePath)
  if (!stat.isFile()) throw Object.assign(new Error('目录不能转换为文档预览'), { code: 'PREVIEW_NOT_FILE' })
  if (stat.size > 80 * 1024 * 1024) throw Object.assign(new Error('Office 文件超过 80MB，暂不在线预览；请下载后查看'), { code: 'PREVIEW_TOO_LARGE' })
  const ext = extname(sourcePath).toLowerCase()
  if (!CONVERTIBLE.has(ext)) throw Object.assign(new Error(`不支持的 Office 格式：${ext || name}`), { code: 'PREVIEW_UNSUPPORTED' })
  const key = createHash('sha1').update(`${sourcePath}|${stat.size}|${stat.mtimeMs}|${ext}`).digest('hex')
  return renderOfficeToCache(sourcePath, key)
}

/** 对只有字节、没有稳定本机路径的附件（fileId）转换预览；按内容摘要复用缓存。 */
export async function officePdfForBuffer(buffer, name = '') {
  const ext = extname(String(name || '')).toLowerCase()
  if (!CONVERTIBLE.has(ext)) throw Object.assign(new Error(`不支持的 Office 格式：${ext || name}`), { code: 'PREVIEW_UNSUPPORTED' })
  if (!buffer?.length) throw Object.assign(new Error('文件内容为空'), { code: 'PREVIEW_EMPTY' })
  if (buffer.length > 80 * 1024 * 1024) throw Object.assign(new Error('Office 文件超过 80MB，暂不在线预览；请下载后查看'), { code: 'PREVIEW_TOO_LARGE' })
  const key = createHash('sha1').update(`buffer|${buffer.length}|${createHash('sha1').update(buffer).digest('hex')}|${ext}`).digest('hex')
  const out = join(previewCacheDir(), `${key}.pdf`)
  if (existsSync(out)) return renderOfficeToCache('', key)
  const temp = mkdtempSync(join(tmpdir(), 'jg-preview-office-'))
  const inputPath = join(temp, `${basename(String(name || 'document')).replace(/[\\/:*?"<>|]/g, '_')}`)
  try {
    writeFileSync(inputPath, buffer)
    return await renderOfficeToCache(inputPath, key)
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
}

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function formatBytes(bytes) {
  const n = Number(bytes) || 0
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(1)} GB`
}

/**
 * 把 PDF 首页渲染成白底 PNG 缩略图，供消息流产物卡片平铺预览。
 * 只取第一页、不保留内置 PDF 查看器的深色背景与滚动条；完整查看仍走 /api/preview。
 * @param {Buffer|Uint8Array} pdfBuffer
 * @param {{ scale?: number }} options
 * @returns {Promise<Buffer>}
 */
export async function renderPdfFirstPagePng(pdfBuffer, { scale = 1.25 } = {}) {
  const doc = await getPdfJsThumbDoc({
    data: new Uint8Array(pdfBuffer),
    disableWorker: true,
    useSystemFonts: true,
    isEvalSupported: false,
  }).promise
  try {
    const page = await doc.getPage(1)
    const viewport = page.getViewport({ scale })
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport }).promise
    return canvas.toBuffer('image/png')
  } finally {
    try { await doc.destroy() } catch (_) {}
  }
}

const TYPE_META = {
  office: { label: 'Office', chip: 'W', tone: 'blue' },
  pdf: { label: 'PDF', chip: 'P', tone: 'red' },
  spatial: { label: '空间数据', chip: 'G', tone: 'green' },
  image: { label: '图片', chip: 'I', tone: 'violet' },
  text: { label: '文本', chip: 'T', tone: 'gray' },
  unsupported: { label: '文件', chip: 'F', tone: 'gray' },
  folder: { label: '目录', chip: 'D', tone: 'gray' },
}

/**
 * 统一预览页。body 为可信的服务端生成 HTML；外部文件内容必须已转义。
 */
export function previewPage({ name, kind, ext, size, body, note = '', badge = '', downloadUrl = '', rawUrl = '', editUrl = '', bare = false }) {
  const meta = TYPE_META[kind] || TYPE_META.unsupported
  const title = name || '文件预览'
  const sub = [meta.label, ext ? ext.replace(/^\./, '').toUpperCase() : '', formatBytes(size)].filter(Boolean).join(' · ')
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>预览 · ${xmlEscape(title)}</title>
<style>
:root{--bg:#f4f6f9;--panel:#fff;--line:#e2e6ec;--text:#1f2329;--muted:#6b7280;--accent:#2563eb;--warn:#b45309;--warnbg:#fffbeb}
*{box-sizing:border-box}
html,body{height:100%}
body{margin:0;background:var(--bg);color:var(--text);font:14px/1.55 "Microsoft YaHei UI","PingFang SC","Noto Sans CJK SC",system-ui,sans-serif}
body.bare{background:#fff}
body.bare .pv-main{height:100%}
body.bare .pv-viewer{padding:10px}
.pv-top{height:64px;background:rgba(255,255,255,.96);border-bottom:1px solid var(--line);display:flex;align-items:center;gap:12px;padding:0 18px;position:sticky;top:0;z-index:10}
.pv-chip{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;color:#fff;font-weight:700;font-size:16px;flex:0 0 auto}
.pv-chip.blue{background:#2563eb}.pv-chip.red{background:#dc2626}.pv-chip.green{background:#059669}.pv-chip.violet{background:#7c3aed}.pv-chip.gray{background:#64748b}
.pv-title{min-width:0;flex:1}
.pv-title b{display:block;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pv-title span{display:block;font-size:11px;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pv-actions{display:flex;gap:8px;align-items:center;flex:0 0 auto}
.pv-btn{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--text);text-decoration:none;font-size:12px;cursor:pointer}
.pv-btn:hover{border-color:#c8d0dc;background:#f8fafc}
.pv-btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}
.pv-main{height:calc(100% - 64px);display:flex;flex-direction:column;min-height:0}
.pv-note{padding:8px 18px;background:#fff;border-bottom:1px solid var(--line);font-size:12px;color:var(--muted);display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.pv-badge{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-size:11px}
.pv-warn{background:var(--warnbg);color:var(--warn);border:1px solid #fde68a;padding:2px 8px;border-radius:6px;font-size:11px}
.pv-viewer{flex:1;min-height:0;padding:14px;display:flex}
.pv-frame{flex:1;width:100%;border:1px solid var(--line);border-radius:10px;background:#fff;box-shadow:0 8px 24px rgba(15,23,42,.06)}
.pv-card{margin:auto;max-width:560px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:28px;text-align:center;box-shadow:0 12px 30px rgba(15,23,42,.06)}
.pv-card h1{font-size:18px;margin:0 0 8px}.pv-card p{color:var(--muted);font-size:13px;margin:6px 0}
.pv-code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;background:#f8fafc;border:1px solid var(--line);border-radius:8px;padding:8px 10px;margin-top:12px;font-size:11px;word-break:break-all;color:#475569}
.pv-text{flex:1;margin:0;overflow:auto;background:#fff;border:1px solid var(--line);border-radius:10px;padding:18px;white-space:pre-wrap;word-break:break-word;font:13px/1.7 ui-monospace,SFMono-Regular,Consolas,monospace}
.pv-img-wrap{flex:1;min-height:0;display:grid;place-items:center;background:#fff;border:1px solid var(--line);border-radius:10px;overflow:auto}
.pv-img-wrap img{max-width:100%;max-height:100%;object-fit:contain;display:block}
.pv-spatial{flex:1;min-height:0;display:grid;grid-template-columns:260px minmax(0,1fr);gap:14px}
.pv-meta{background:#fff;border:1px solid var(--line);border-radius:10px;padding:14px;overflow:auto}
.pv-meta h3{margin:0 0 10px;font-size:13px}.pv-meta dl{margin:0;display:grid;grid-template-columns:74px 1fr;gap:6px 8px;font-size:12px}
.pv-meta dt{color:var(--muted)}.pv-meta dd{margin:0;word-break:break-word}
.pv-meta .pv-note-inline{font-size:11px;color:var(--muted);margin-top:12px;padding-top:10px;border-top:1px dashed var(--line);line-height:1.6}
.pv-stage{position:relative;background:#fff;border:1px solid var(--line);border-radius:10px;overflow:hidden;min-height:0;cursor:grab}
.pv-stage:active{cursor:grabbing}
.pv-canvas{position:absolute;inset:0;display:grid;place-items:center;transform-origin:0 0}
.pv-canvas svg{width:100%;height:100%;max-width:100%;max-height:100%;display:block}
.pv-zoom{position:absolute;right:12px;bottom:12px;display:flex;gap:6px;background:rgba(255,255,255,.94);border:1px solid var(--line);border-radius:9px;padding:5px;box-shadow:0 4px 12px rgba(15,23,42,.1)}
.pv-zoom button{width:30px;height:28px;border:0;border-radius:6px;background:#f1f5f9;color:#334155;font-size:15px;cursor:pointer}
.pv-zoom .reset{width:auto;padding:0 9px;font-size:11px}
.pv-table-wrap{flex:1;min-height:0;overflow:auto;background:#fff;border:1px solid var(--line);border-radius:10px;padding:14px}
.pv-table{border-collapse:collapse;font-size:12px;min-width:100%}
.pv-table th,.pv-table td{border:1px solid #e5e7eb;padding:5px 8px;text-align:left;vertical-align:top;white-space:pre-wrap}
.pv-table th{background:#f8fafc;font-weight:600}
@media (max-width:760px){.pv-actions .pv-btn.download{display:none}.pv-spatial{grid-template-columns:1fr;grid-template-rows:minmax(180px,auto) minmax(0,1fr)}.pv-meta{order:2}}
</style>
</head>
<body${bare ? ' class="bare"' : ''}>
${bare ? '' : `<div class="pv-top">
  <span class="pv-chip ${meta.tone}">${xmlEscape(meta.chip)}</span>
  <div class="pv-title"><b title="${xmlEscape(title)}">${xmlEscape(title)}</b><span>${xmlEscape(sub)}${badge ? ` · ${xmlEscape(badge)}` : ''}</span></div>
  <div class="pv-actions">
    ${downloadUrl ? `<a class="pv-btn download" href="${xmlEscape(downloadUrl)}">下载原文件</a>` : ''}
    ${editUrl ? `<a class="pv-btn primary" href="${xmlEscape(editUrl)}" target="_blank" rel="noopener">在线编辑</a>` : ''}
    ${rawUrl ? `<a class="pv-btn" href="${xmlEscape(rawUrl)}" target="_blank" rel="noopener">新窗口打开</a>` : ''}
  </div>
</div>`}
<div class="pv-main">
  ${bare ? '' : (note ? `<div class="pv-note">${note}</div>` : '')}
  ${body}
</div>
</body>
</html>`
}

export function officeViewer({ rawUrl, downloadUrl, editUrl = '', name, ext, size, note = '', badge = '', bare = false }) {
  return previewPage({
    name, kind: 'office', ext, size, rawUrl, downloadUrl, editUrl, badge, bare,
    note: note || `<span class="pv-badge">只读预览</span><span>由 LibreOffice 将原文件真实转换为 PDF；不修改源文件，也不写入项目目录。</span>`,
    body: `<div class="pv-viewer"><iframe class="pv-frame" src="${xmlEscape(rawUrl)}#toolbar=1&navpanes=0&view=FitH" title="${xmlEscape(name)} 预览"></iframe></div>`,
  })
}

export function pdfViewer({ rawUrl, downloadUrl, name, size, bare = false }) {
  return previewPage({
    name, kind: 'pdf', ext: '.pdf', size, rawUrl, downloadUrl, bare,
    note: `<span class="pv-badge">只读预览</span><span>浏览器内嵌查看原始 PDF，支持缩放、翻页与打印。</span>`,
    body: `<div class="pv-viewer"><iframe class="pv-frame" src="${xmlEscape(rawUrl)}#toolbar=1&navpanes=0&view=FitH" title="${xmlEscape(name)} 预览"></iframe></div>`,
  })
}

export function imageViewer({ rawUrl, downloadUrl, name, ext, size, bare = false }) {
  return previewPage({
    name, kind: 'image', ext, size, rawUrl, downloadUrl, bare,
    body: `<div class="pv-viewer"><div class="pv-img-wrap"><img src="${xmlEscape(rawUrl)}" alt="${xmlEscape(name)}"></div></div>`,
  })
}

export function textViewer({ text, downloadUrl, name, ext, size, truncated = false, bare = false }) {
  return previewPage({
    name, kind: 'text', ext, size, downloadUrl, bare,
    note: truncated ? `<span class="pv-warn">文件较大，仅显示前 400,000 字符</span>` : '',
    body: `<div class="pv-viewer"><pre class="pv-text">${xmlEscape(text)}</pre></div>`,
  })
}

export function unsupportedViewer({ name, ext, size, reason, downloadUrl, bare = false }) {
  return previewPage({
    name, kind: 'unsupported', ext, size, downloadUrl, bare,
    body: `<div class="pv-viewer"><div class="pv-card">
      <h1>这个格式暂时不能在线预览</h1>
      <p>${xmlEscape(reason || '当前预览基座尚未接入该格式；可以下载原文件后使用本机应用查看。')}</p>
      <p class="pv-code">${xmlEscape(name)}${size ? ` · ${formatBytes(size)}` : ''}</p>
      ${downloadUrl ? `<p style="margin-top:18px"><a class="pv-btn primary" href="${xmlEscape(downloadUrl)}">下载原文件</a></p>` : ''}
    </div></div>`,
  })
}

export function errorViewer({ name, ext, size, title = '预览失败', reason = '', downloadUrl, bare = false }) {
  return previewPage({
    name, kind: 'unsupported', ext, size, downloadUrl, bare,
    body: `<div class="pv-viewer"><div class="pv-card">
      <h1>${xmlEscape(title)}</h1>
      <p>${xmlEscape(reason || '服务端没有生成可展示的预览。')}</p>
      <p class="pv-code">${xmlEscape(name)}${size ? ` · ${formatBytes(size)}` : ''}</p>
      ${downloadUrl ? `<p style="margin-top:18px"><a class="pv-btn primary" href="${xmlEscape(downloadUrl)}">下载原文件</a></p>` : ''}
    </div></div>`,
  })
}

export function spatialViewer({ meta = {}, svg = '', name, ext, size, downloadUrl }) {
  const rows = []
  const push = (k, v) => { if (v !== undefined && v !== null && String(v).trim() !== '') rows.push(`<dt>${xmlEscape(k)}</dt><dd>${xmlEscape(v)}</dd>`) }
  push('格式', meta.formatLabel || ext.replace(/^\./, '').toUpperCase())
  push(meta.truncated ? '要素/实体（抽样）' : '要素/实体', meta.features)
  push('坐标点', meta.pointCount)
  push('图层', (meta.layers || []).join('、'))
  push('类型', (meta.geometryTypes || meta.entityTypes || []).join('、'))
  push('坐标系', meta.crs)
  push('范围', (meta.bbox || []).join(' , '))
  push('字段', (meta.fields || []).slice(0, 18).join('、'))
  push('数据源', (meta.sourceFiles || []).join('、'))
  const note = meta.note ? `<div class="pv-note-inline">${xmlEscape(meta.note)}</div>` : ''
  const body = `<div class="pv-viewer"><div class="pv-spatial">
    <aside class="pv-meta"><h3>数据信息</h3><dl>${rows.join('') || '<dt>说明</dt><dd>已读取文件，但没有可展示的元数据</dd>'}</dl>${note}</aside>
    <div class="pv-stage" id="pvStage"><div class="pv-canvas" id="pvCanvas">${svg || '<div class="pv-card"><p>没有可绘制的几何图形</p></div>'}</div>
      <div class="pv-zoom"><button type="button" data-zoom="out" title="缩小">−</button><button type="button" data-zoom="in" title="放大">+</button><button type="button" class="reset" data-zoom="reset">适应窗口</button></div>
    </div>
  </div></div>
  <script>
  (function(){
    var stage=document.getElementById('pvStage'), canvas=document.getElementById('pvCanvas')
    if(!stage||!canvas) return
    var scale=1, x=0, y=0, drag=null, start=null
    function apply(){ canvas.style.transform='translate('+x+'px,'+y+'px) scale('+scale+')' }
    stage.querySelectorAll('[data-zoom]').forEach(function(b){ b.addEventListener('click',function(){
      var op=b.getAttribute('data-zoom')
      if(op==='reset'){ scale=1; x=0; y=0 }
      else { var next=Math.min(8,Math.max(.25,scale*(op==='in'?1.25:.8))); var cx=stage.clientWidth/2, cy=stage.clientHeight/2; x=cx-(cx-x)*(next/scale); y=cy-(cy-y)*(next/scale); scale=next }
      apply()
    })})
    stage.addEventListener('wheel',function(e){ e.preventDefault(); var next=Math.min(8,Math.max(.25,scale*(e.deltaY<0?1.12:.89))); var r=stage.getBoundingClientRect(); var cx=e.clientX-r.left, cy=e.clientY-r.top; x=cx-(cx-x)*(next/scale); y=cy-(cy-y)*(next/scale); scale=next; apply() },{passive:false})
    stage.addEventListener('pointerdown',function(e){ if(e.button!==0) return; drag=true; start={x:e.clientX,y:e.clientY,ox:x,oy:y}; stage.setPointerCapture(e.pointerId) })
    stage.addEventListener('pointermove',function(e){ if(!drag) return; x=start.ox+(e.clientX-start.x); y=start.oy+(e.clientY-start.y); apply() })
    stage.addEventListener('pointerup',function(){ drag=false })
    stage.addEventListener('pointercancel',function(){ drag=false })
  })()
  </script>`
  return previewPage({ name, kind: 'spatial', ext, size, body, downloadUrl, note: `<span class="pv-badge">只读预览</span><span>直接读取原始空间文件生成的矢量预览，可缩放与拖动；不是静态截图。</span>` })
}

