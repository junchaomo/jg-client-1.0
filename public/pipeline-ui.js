/**
 * 地下管网三维模块前端（一期）
 * 场景优先：进入模块直接呈现三维场景，顶部为基本操作与分析功能框；
 * 数据管理、分析成果为模块内的入口（弹窗），不再是并列工作界面。
 * 所有数据都来自服务端 API，不含演示数据。
 * 三维渲染由 ./pipeline-scene.js（Three.js）承担，本文件只负责组织界面与调用。
 */

const PIPE_LABELS = {
  supply: '供水', distribution: '配水', rain: '雨水', intercept: '截污', sewage: '污水', combined: '合流',
  power: '电力', telecom: '通信', gas: '燃气', heat: '热力', gallery: '管廊', other: '其他',
}
const PIPE_COLORS = {
  supply: '#2f7dd1', distribution: '#5fa8dd', rain: '#3f86a8', intercept: '#7f9440',
  sewage: '#5a8f4a', combined: '#8f8a4a', power: '#7a4fb5', telecom: '#2f9c94',
  gas: '#c88a1e', heat: '#b4472f', gallery: '#6b6f76', other: '#9aa0a6',
}
const MAJOR_ORDER = ['supply', 'distribution', 'rain', 'intercept', 'sewage', 'combined', 'power', 'telecom', 'gas', 'heat', 'gallery', 'other']
const ANALYSIS_LABELS = { section: '断面分析', clearance: '净距分析', collision: '碰撞检查', excavation: '开挖影响分析', conflict: '跨数据集冲突检查' }
const ACCEPT = '.dxf,.shp,.dbf,.shx,.prj,.cpg,.gdb,.csv,.txt,.geojson,.json,.zip'

const state = {
  modal: '',
  leftOpen: true,
  rightOpen: true,
  measure: null,
  datasets: [],
  loaded: false,
  activeId: '',
  detail: null,
  scene: null,
  sceneApi: null,
  sceneInfo: null,
  stageEl: null,
  visible: { supply: true, distribution: true, rain: true, intercept: true, sewage: true, combined: true, power: true, telecom: true, gas: true, heat: true, gallery: true, other: true },
  groundAlpha: 0.14,
  picked: null,
  tool: '',
  menu: '',
  panMode: false,
  identify: true,
  lastAnalysis: null,
  sectionLine: null,
  excavation: null,
  runs: [],
  runFilter: '',
  runDetail: null,
  upload: { files: [], name: '', sourceType: 'auto', stage: 'existing' },
  overlayIds: [],
  sourceFilter: 'all',
  stageFilter: 'all',
  busy: '',
  progress: '',
  progressPercent: null,
  progressError: false,
}

let ctx = null
let bound = false
let loadedOnce = false

const fmt = (value, digits = 2) => (Number.isFinite(Number(value)) ? Number(value).toFixed(digits).replace(/\.0+$/, '') : '—')
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : null)
const clampPercent = (value) => Math.max(0, Math.min(100, Number(value) || 0))
const progressWidth = (value) => String(clampPercent(value))
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function boundsText(bounds) {
  if (!bounds) return '—'
  return `X ${fmt(bounds.minX)}–${fmt(bounds.maxX)} · Y ${fmt(bounds.minY)}–${fmt(bounds.maxY)}`
}

function datasetById(id) {
  return state.datasets.find((item) => item.id === id) || null
}

function activeDataset() {
  return datasetById(state.activeId)
}

async function loadDatasets() {
  const { ok, body } = await ctx.api('/api/pipeline/datasets').catch(() => ({ ok: false, body: {} }))
  state.datasets = ok ? (body.items || []) : []
  state.loaded = true
  if (!state.activeId && state.datasets.length) state.activeId = preferDefaultDataset().id
  if (state.activeId && !datasetById(state.activeId)) state.activeId = preferDefaultDataset()?.id || ''
  return state.datasets
}

/** 默认进场景时优先选高程完整度最高的数据集，避免一进来看到的是无高程的示意线 */
function preferDefaultDataset() {
  const items = state.datasets.filter(Boolean)
  if (!items.length) return null
  const score = (item) => {
    const hasZ = item.bounds?.minZ !== null && item.bounds?.minZ !== undefined ? 1 : 0
    const stage = item.meta?.stage === 'planned' ? 0 : 1
    const source = item.meta?.sourceType === 'cad-dxf' ? 0 : 1
    return hasZ * 1000 + stage * 100 + source * 10 + (item.lineCount || 0)
  }
  let best = items[0]
  for (const item of items) if (score(item) > score(best)) best = item
  return best
}

async function loadDetail() {
  if (!state.activeId) { state.detail = null; return null }
  const { ok, body } = await ctx.api(`/api/pipeline/dataset?id=${encodeURIComponent(state.activeId)}`).catch(() => ({ ok: false, body: {} }))
  state.detail = ok ? body.dataset : null
  return state.detail
}

function sceneStatus() {
  const counts = state.scene?.counts
  if (!counts) return '尚未加载场景'
  const base = `${counts.nodes} 个管点 · ${counts.lines} 条管段 · 高程完整 ${counts.withZ} / 部分 ${counts.partialZ} / 缺失 ${counts.withoutZ}`
  const parts = state.scene?.parts
  if (!state.scene?.dataset?.overlay) return base
  return `${base} · 叠加 ${parts?.length || 0} 个数据集`
}

/* ------------------------------ 数据管理 ------------------------------ */

function fileRows() {
  if (!state.upload.files.length) return '<div class="pipe2-empty">未选择文件。SHP 请同时选择 .shp / .dbf / .shx / .prj / .cpg</div>'
  return `<div class="pipe2-filelist">${state.upload.files.map((file, index) => `
    <div class="pipe2-file"><span>${ctx.esc(file.name)}</span><span>${(file.size / 1024).toFixed(1)} KB
      <button class="link-btn" data-remove="${index}" title="移除">×</button></span></div>`).join('')}</div>`
}

const SOURCE_LABELS = { survey: '普查成果', cad: 'CAD 图纸', 'cad-dxf': 'CAD 图纸', csv: 'CSV 台账', geojson: 'GeoJSON' }
const STAGE_LABELS = { existing: '现状', planned: '规划', built: '在建', history: '历史' }
const stageOf = (item) => STAGE_LABELS[item?.meta?.stage] || '现状'
const crsShort = (crs) => {
  const text = String(crs || '')
  if (!text) return '坐标系待确认'
  const epsg = text.match(/EPSG:(\d+)/i)
  if (epsg) return `EPSG:${epsg[1]}`
  if (text.startsWith('未声明')) return '坐标系未声明'
  return text.length > 12 ? `${text.slice(0, 12)}…` : text
}

const SOURCE_FILTERS = [['all', '全部来源'], ['cad', 'CAD 图纸'], ['survey', '普查成果']]
const STAGE_FILTERS = [['all', '全部'], ['existing', '现状'], ['planned', '规划'], ['built', '在建']]

function sourceFiltered() {
  const filter = state.sourceFilter || 'all'
  const stage = state.stageFilter || 'all'
  return state.datasets.filter((item) => {
    const source = String(item.meta?.sourceType || '')
    const okSource = filter === 'all' ? true : (filter === 'cad' ? source.startsWith('cad') : source === 'survey')
    const itemStage = item.meta?.stage || 'existing'
    const okStage = stage === 'all' ? true : itemStage === stage
    return okSource && okStage
  })
}

function sourceFilterHtml() {
  return `<div class="pipe2-seg">${SOURCE_FILTERS.map(([key, label]) => `<button data-sourcefilter="${key}" class="${(state.sourceFilter || 'all') === key ? ' active' : ''}">${label}</button>`).join('')}</div>
    <div class="pipe2-seg">${STAGE_FILTERS.map(([key, label]) => `<button data-stagefilter="${key}" class="${(state.stageFilter || 'all') === key ? ' active' : ''}">${label}</button>`).join('')}</div>`
}

function datasetCard(item) {
  const quality = item.meta?.quality || {}
  const zWith = Number(quality.withZ) || 0
  const zWithout = Number(quality.withoutZ) || 0
  const z = (zWith + zWithout) ? `${zWith}/${zWith + zWithout}` : '—'
  const warn = (quality.high || 0) > 0
  const source = SOURCE_LABELS[item.meta?.sourceType] || item.meta?.sourceType || '—'
  const overlay = state.overlayIds.includes(item.id)
  const isActive = item.id === state.activeId
  return `
    <div class="pipe2-ds${isActive ? ' active' : ''}${overlay ? ' has-overlay' : ''}" data-dsid="${ctx.esc(item.id)}" role="button" tabindex="0">
      <div class="pipe2-ds-name">${ctx.esc(item.name)}</div>
      <div class="pipe2-ds-meta">${item.pointCount || 0} 点 · ${item.lineCount || 0} 段 · 高程 ${ctx.esc(z)}<br/>
        ${ctx.esc(source)} · ${ctx.esc(stageOf(item))} · ${ctx.esc(crsShort(item.crs))}</div>
      ${warn ? '<span class="pipe2-ds-badge warn">高等级问题</span>' : (quality.total ? `<span class="pipe2-ds-badge">${quality.total} 项质检</span>` : '')}
      ${isActive ? '' : `<div class="pipe2-ds-foot"><button class="pipe2-ds-overlay${overlay ? ' on' : ''}" data-overlay="${ctx.esc(item.id)}" type="button">${overlay ? '取消叠加' : '叠加显示'}</button></div>`}
    </div>`
}

function dataPanel() {
  const detail = state.detail
  return `
  <div class="pipe2-main">
    <div class="pipe2-col">
      <div class="pipe2-card">
        <div class="pipe2-card-title"><strong>导入数据</strong><span>CAD / 普查成果</span></div>
        <div class="pipe2-drop" id="pipe2Drop">
          <strong>选择或拖入管网文件</strong>
          支持 DXF、SHP 组、GDB、CSV、GeoJSON、ZIP；DWG 需另存为 DXF
        </div>
        <input type="file" id="pipe2FileInput" accept="${ACCEPT}" multiple class="pipe2-hidden" />
        ${fileRows()}
        <div class="pipe2-field">
          <label>数据集名称</label>
          <input id="pipe2Name" value="${ctx.esc(state.upload.name)}" placeholder="如 滨江路管网普查成果" />
        </div>
        <div class="pipe2-field">
          <label>数据类型</label>
          <select id="pipe2Source">
            <option value="auto"${state.upload.sourceType === 'auto' ? ' selected' : ''}>按文件自动识别</option>
            <option value="cad"${state.upload.sourceType === 'cad' ? ' selected' : ''}>CAD 设计图纸</option>
            <option value="survey"${state.upload.sourceType === 'survey' ? ' selected' : ''}>管网普查成果</option>
            <option value="csv"${state.upload.sourceType === 'csv' ? ' selected' : ''}>CSV 台账</option>
          </select>
        </div>
        <div class="pipe2-field">
          <label>数据状态</label>
          <select id="pipe2Stage">
            <option value="existing"${state.upload.stage === 'existing' ? ' selected' : ''}>现状管线</option>
            <option value="planned"${state.upload.stage === 'planned' ? ' selected' : ''}>规划方案</option>
            <option value="built"${state.upload.stage === 'built' ? ' selected' : ''}>在建成果</option>
            <option value="history"${state.upload.stage === 'history' ? ' selected' : ''}>历史数据</option>
          </select>
        </div>
        <div class="pipe2-actions">
          <button class="btn primary" id="pipe2Import"${state.busy ? ' disabled' : ''}>${state.busy === 'import' ? '正在导入…' : '上传并导入'}</button>
        </div>
        ${state.progress ? `<div class="pipe2-progress${state.progressError ? ' err' : ''}">
          <div class="pipe2-progress-text">${ctx.esc(state.progress).replace(/\n/g, '<br/>')}</div>
          ${Number.isFinite(state.progressPercent) ? `<div class="pipe2-progress-bar"><div class="pipe2-progress-track"><i style="width:${progressWidth(state.progressPercent)}%"></i></div><span class="pipe2-progress-pct">${Math.round(state.progressPercent)}%</span></div>` : ''}
        </div>` : ''}
      </div>
      <div class="pipe2-card">
        <div class="pipe2-card-title"><strong>接入规则</strong><span>一期口径</span></div>
        <div class="pipe2-summary">
          · SHP 同组文件必须一次提交，缺 .cpg 会导致中文字段与类别失真<br/>
          · CAD 图纸含高程时直接生成三维；无高程时标记为平面成果，不参与精确空间分析<br/>
          · 原始文件与解析结果均登记来源、版本与精度，不做覆盖式更新
        </div>
      </div>
    </div>
    <div class="pipe2-col">
      <div class="pipe2-card" style="flex:1">
        <div class="pipe2-card-title"><strong>数据集</strong><span>${sourceFiltered().length} / ${state.datasets.length} 个</span></div>
        ${sourceFilterHtml()}
        <div class="pipe2-dslist">
          ${sourceFiltered().length ? sourceFiltered().map(datasetCard).join('') : '<div class="pipe2-empty">暂无数据集。<br/>导入 CAD 图纸或管网普查成果后在此列出。</div>'}
        </div>
      </div>
    </div>
    <div class="pipe2-col">
      <div class="pipe2-card" style="flex:1">
        <div class="pipe2-card-title"><strong>数据详情</strong><span>${detail ? ctx.esc(detail.status === 'pending-qc' ? '待校核' : '已质检') : '—'}</span></div>
        ${detail ? `
          <div class="pipe2-prop">
            <div class="pipe2-prop-row"><dt>名称</dt><dd>${ctx.esc(detail.name)}</dd></div>
            <div class="pipe2-prop-row"><dt>来源</dt><dd>${ctx.esc(SOURCE_LABELS[detail.meta?.sourceType] || detail.meta?.sourceType || '—')}</dd></div>
            <div class="pipe2-prop-row"><dt>原始文件</dt><dd>${ctx.esc(detail.sourceFile || '—')}</dd></div>
            <div class="pipe2-prop-row"><dt>坐标系</dt><dd>${ctx.esc(detail.crs || '—')}</dd></div>
            <div class="pipe2-prop-row"><dt>高程基准</dt><dd>${ctx.esc(detail.datum || '—')}</dd></div>
            <div class="pipe2-prop-row"><dt>空间范围</dt><dd>${ctx.esc(boundsText(detail.meta?.bounds))}</dd></div>
            <div class="pipe2-prop-row"><dt>管点 / 管段</dt><dd>${detail.counts?.points || 0} / ${detail.counts?.lines || 0}</dd></div>
            <div class="pipe2-prop-row"><dt>高程完整 / 缺失</dt><dd>${detail.meta?.quality?.withZ ?? 0} / ${detail.meta?.quality?.withoutZ ?? 0} 段</dd></div>
            <div class="pipe2-prop-row"><dt>拓扑连接</dt><dd>${detail.topology || 0}</dd></div>
            <div class="pipe2-prop-row"><dt>更新时间</dt><dd>${detail.updatedAt ? new Date(detail.updatedAt).toLocaleString('zh-CN') : '—'}</dd></div>
          </div>
          <div class="pipe2-card-title" style="margin-top:14px"><strong>坐标配准</strong><span>叠加与冲突检查前使用</span></div>
          <div class="pipe2-summary">不同来源的数据集坐标基准可能不一致。以本数据集的场景原点为基准，填写相对目标坐标系的平移量（米，东移 / 北移），叠加与跨数据集冲突检查都按该偏移对齐。</div>
          <div class="pipe2-row" style="margin-top:6px">
            <input id="pipe2RegDx" value="${fmt(detail.meta?.transform?.registration?.dx ?? 0, 1)}" placeholder="X 偏移 m" />
            <input id="pipe2RegDy" value="${fmt(detail.meta?.transform?.registration?.dy ?? 0, 1)}" placeholder="Y 偏移 m" />
          </div>
          <div class="pipe2-actions">
            <button class="btn" id="pipe2SaveReg">保存配准${detail.meta?.transform?.registration ? `（已配准 ${fmt(detail.meta.transform.registration.dx, 1)} / ${fmt(detail.meta.transform.registration.dy, 1)}）` : ''}</button>
          </div>
          <div class="pipe2-card-title" style="margin-top:14px"><strong>质检问题</strong><span>${detail.issues?.length || 0} 项</span></div>
          ${detail.issues?.length ? `<table class="pipe2-table"><thead><tr><th>等级</th><th>问题</th><th></th></tr></thead><tbody>
            ${detail.issues.slice(0, 40).map((issue) => `<tr>
              <td><span class="pipe2-chip${issue.severity === '高' ? ' danger' : issue.severity === '中' ? ' warn' : ''}">${ctx.esc(issue.severity || '低')}</span></td>
              <td>${ctx.esc(issue.issueType || '数据问题')}<br/><span style="color:#8a8781">${ctx.esc(issue.message || '')}</span></td>
              <td>${issue.resolved ? '已处理' : `<button class="link-btn" data-issue="${ctx.esc(issue.id)}">标记处理</button>`}</td>
            </tr>`).join('')}
          </tbody></table>` : '<div class="pipe2-empty">无质检问题</div>'}
          <div class="pipe2-actions">
            <button class="btn" id="pipe2ToScene">进入三维场景</button>
            <button class="btn danger" id="pipe2Delete">删除数据集</button>
          </div>
        ` : '<div class="pipe2-empty">选择左侧数据集查看详情</div>'}
      </div>
    </div>
  </div>`
}

/* ------------------------------ 三维场景 ------------------------------ */

function legendHtml() {
  const counts = {}
  for (const line of state.scene?.lines || []) {
    const key = line.major || 'other'
    counts[key] = (counts[key] || 0) + 1
  }
  return `<div class="pipe2-legend">${MAJOR_ORDER.map((key) => {
    const count = counts[key] || 0
    return `
    <label class="pipe2-legend-item${count ? '' : ' is-empty'}" data-major="${key}" title="${PIPE_LABELS[key]}：${count} 条管段">
      <input type="checkbox" data-visible="${key}"${state.visible[key] ? ' checked' : ''} />
      <span class="pipe2-swatch" style="background:${PIPE_COLORS[key]}"></span>${PIPE_LABELS[key]}
    </label>`
  }).join('')}</div>`
}

function overlayList() {
  return state.overlayIds
    .filter((id) => id !== state.activeId)
    .map((id) => state.datasets.find((item) => item.id === id))
    .filter(Boolean)
}

/** 分析类功能细分放在下拉里，顶层工具条上每个可见词都是可点的按钮 */
function analysisMenuHtml() {
  const overlays = overlayList()
  const items = [
    ['section', '断面分析', '沿指定断面线切取管线剖面'],
    ['clearance', '净距分析', '逐对计算管线的水平、垂直与三维最小净距'],
    ['collision', '碰撞检查', '识别实体交叉、空间碰撞与净距不足'],
    ['excavation', '开挖影响分析', '识别开挖范围内的受影响管线'],
    ['conflict', '跨数据集冲突检查', '现状与规划数据之间的跨集冲突检查'],
  ]
  return `<div class="pipe2-menu">${items.map(([key, label, title]) => {
    const disabled = key === 'conflict' && !overlays.length
    const tip = disabled ? '先在左侧数据集点「叠加显示」，加入其他数据集后再检查' : title
    return `<button class="pipe2-menu-item${state.tool === key ? ' active' : ''}" data-tool="${key}" title="${ctx.esc(tip)}"${disabled ? ' disabled' : ''}>${label}</button>`
  }).join('')}</div>`
}

function toolFormHtml() {
  const tool = state.tool
  if (!tool) return ''
  const bounds = state.scene?.bounds || state.detail?.meta?.bounds
  const runBtn = `<div class="pipe2-actions" style="margin-top:8px">
        <button class="btn primary" id="pipe2Run"${state.busy ? ' disabled' : ''}>${state.busy === 'analysis' ? '计算中…' : '运行分析'}</button>
      </div>`
  if (tool === 'section') return `${sectionForm(bounds)}${runBtn}`
  if (tool === 'excavation') return `${excavationForm(bounds)}${runBtn}`
  if (tool === 'collision') return `<div class="pipe2-summary">按空间索引筛选候选管段后做精确几何相交与距离检测，识别实体交叉、空间重叠与净距不足；缺高程的管段不参与判定。</div>${runBtn}`
  if (tool === 'conflict') return `${conflictForm()}${runBtn}`
  return `<div class="pipe2-summary">按当前数据集的管线类别与内控净距规则逐对计算；缺少高程或断面尺寸的管段输出「无法判定」，不直接判合格。</div>${runBtn}`
}

function conflictForm() {
  const ds = activeDataset()
  const overlays = overlayList()
  if (!overlays.length) return '<div class="pipe2-summary">需要至少两个数据集才能做跨数据集检查：在左侧数据集列表点「叠加显示」，把拟建方案与现状管网放进同一场景后再运行。</div>'
  const names = [ds, ...overlays.filter(Boolean)].filter(Boolean)
  return `<label>参与比较的数据集</label>
    <div class="pipe2-summary" style="margin-bottom:6px">${names.map((item) => `${ctx.esc(item.name)}（${ctx.esc(stageOf(item))}）`).join('、')}</div>
    <div class="pipe2-summary">只比较不同数据集之间的管段对：拟建方案与现状（或竣工、历史）数据之间的实体交叉、净距不足与邻近情况。同一数据集内部的碰撞请用「碰撞检查」。缺高程或断面尺寸的管段输出「未判定」。</div>`
}

function sectionForm(bounds) {
  if (!bounds) return ''
  const midX = ((bounds.minX + bounds.maxX) / 2).toFixed(1)
  const a = state.sectionLine?.[0] || [midX, bounds.minY - 10]
  const b = state.sectionLine?.[1] || [midX, bounds.maxY + 10]
  return `<label>断面线两端点（数据集局部坐标，米）</label>
    <div class="pipe2-row">
      <input id="secX1" value="${fmt(a[0], 1)}" placeholder="X1" /><input id="secY1" value="${fmt(a[1], 1)}" placeholder="Y1" />
    </div>
    <div class="pipe2-row">
      <input id="secX2" value="${fmt(b[0], 1)}" placeholder="X2" /><input id="secY2" value="${fmt(b[1], 1)}" placeholder="Y2" />
    </div>
    <label style="margin-top:6px">范围 ${ctx.esc(boundsText(bounds))}</label>`
}

function excavationForm(bounds) {
  if (!bounds) return ''
  const padX = (bounds.maxX - bounds.minX) * 0.15
  const padY = (bounds.maxY - bounds.minY) * 0.15
  const d = state.excavation || {
    x1: Math.round(bounds.minX + padX), y1: Math.round(bounds.minY + padY),
    x2: Math.round(bounds.maxX - padX), y2: Math.round(bounds.maxY - padY), depth: 2,
  }
  return `<label>开挖范围（矩形）与深度</label>
    <div class="pipe2-row"><input id="excX1" value="${fmt(d.x1, 1)}" /><input id="excY1" value="${fmt(d.y1, 1)}" /></div>
    <div class="pipe2-row"><input id="excX2" value="${fmt(d.x2, 1)}" /><input id="excY2" value="${fmt(d.y2, 1)}" /></div>
    <div class="pipe2-row"><input id="excDepth" value="${fmt(d.depth, 1)}" placeholder="开挖深度 m" /><span></span></div>`
}

function propertyHtml() {
  const picked = state.picked
  if (!picked) return '<div class="pipe2-empty">在三维场景中点击管线或管点<br/>查看属性与数据质量标记</div>'
  if (picked.kind === 'node') {
    const node = picked.node || {}
    return `<div class="pipe2-prop">
      <div class="pipe2-prop-row"><dt>点号</dt><dd>${ctx.esc(node.code)}</dd></div>
      <div class="pipe2-prop-row"><dt>类型</dt><dd>${ctx.esc(node.category || '—')}</dd></div>
      <div class="pipe2-prop-row"><dt>高程</dt><dd>${fmt(node.z)} m</dd></div>
      <div class="pipe2-prop-row"><dt>地面高程</dt><dd>${fmt(node.groundElev)} m</dd></div>
      <div class="pipe2-prop-row"><dt>埋深</dt><dd>${fmt(node.coverDepth)} m</dd></div>
      <div class="pipe2-prop-row"><dt>所属管线</dt><dd>${ctx.esc(PIPE_LABELS[node.major] || '未标注')}</dd></div>
      <div class="pipe2-prop-row"><dt>道路</dt><dd>${ctx.esc(node.road || '—')}</dd></div>
      <div class="pipe2-prop-row"><dt>权属</dt><dd>${ctx.esc(node.owner || '—')}</dd></div>
      <div class="pipe2-prop-row"><dt>高程可信度</dt><dd>${node.zQuality === 'survey' ? '实测' : node.zQuality === 'derived' ? '推算' : '<span class="pipe2-prop-tag warn">缺失</span>'}</dd></div>
      <div class="pipe2-prop-row"><dt>局部坐标</dt><dd>${fmt(node.x)} , ${fmt(node.y)}</dd></div>
    </div>`
  }
  const line = picked.line || {}
  const zTag = line.zGrade === 'complete' ? '完整' : line.zGrade === 'partial' ? '部分推算' : '<span class="pipe2-prop-tag warn">缺失</span>'
  return `<div class="pipe2-prop">
    <div class="pipe2-prop-row"><dt>管段</dt><dd>${ctx.esc(line.code)}</dd></div>
    <div class="pipe2-prop-row"><dt>类别</dt><dd>${ctx.esc(PIPE_LABELS[line.major] || '未标注')}</dd></div>
    <div class="pipe2-prop-row"><dt>规格</dt><dd>${ctx.esc(line.profileSize || (line.sizeMm ? `DN${line.sizeMm}` : '—'))}</dd></div>
    <div class="pipe2-prop-row"><dt>材质</dt><dd>${ctx.esc(line.material || '—')}</dd></div>
    <div class="pipe2-prop-row"><dt>长度</dt><dd>${fmt(line.length)} m</dd></div>
    <div class="pipe2-prop-row"><dt>起点 / 终点</dt><dd>${ctx.esc(line.startNode || '—')} → ${ctx.esc(line.endNode || '—')}</dd></div>
    <div class="pipe2-prop-row"><dt>起点 / 终点高程</dt><dd>${fmt(line.startZ)} / ${fmt(line.endZ)} m</dd></div>
    <div class="pipe2-prop-row"><dt>起点 / 终点埋深</dt><dd>${fmt(line.coverStart)} / ${fmt(line.coverEnd)} m</dd></div>
    <div class="pipe2-prop-row"><dt>敷设方式</dt><dd>${ctx.esc(line.buryType || '—')}</dd></div>
    <div class="pipe2-prop-row"><dt>权属 / 道路</dt><dd>${ctx.esc(line.owner || '—')} · ${ctx.esc(line.road || '—')}</dd></div>
    <div class="pipe2-prop-row"><dt>建设年代</dt><dd>${ctx.esc(line.buildYear || '—')}</dd></div>
    <div class="pipe2-prop-row"><dt>高程完整度</dt><dd>${zTag}</dd></div>
    <div class="pipe2-prop-row"><dt>局部坐标</dt><dd>${fmt(line.startX)} , ${fmt(line.startY)} → ${fmt(line.endX)} , ${fmt(line.endY)}</dd></div>
  </div>`
}

function analysisSummaryHtml() {
  const result = state.lastAnalysis
  if (!result) return '<div class="pipe2-empty">选择左侧分析工具后运行<br/>结果在此显示并自动归档</div>'
  const type = result.type
  const r = result.result || {}
  const head = `<div class="pipe2-result-head">
      <strong style="font-size:13px">${ctx.esc(ANALYSIS_LABELS[type] || type)}</strong>
      <span class="pipe2-chip">${new Date(result.createdAt || Date.now()).toLocaleTimeString('zh-CN')}</span>
    </div>
    <div class="pipe2-summary">${ctx.esc(result.summary || '')}</div>`

  if (type === 'section') {
    const hits = r.hits || []
    return `<div class="pipe2-result">${head}
      ${hits.length ? `<table class="pipe2-table"><thead><tr><th>管段</th><th>类别</th><th>规格</th><th>桩号</th><th>高程</th></tr></thead><tbody>
        ${hits.map((hit) => `<tr><td>${ctx.esc(hit.lineCode)}</td><td>${ctx.esc(hit.majorLabel || PIPE_LABELS[hit.major] || '')}</td>
          <td>${ctx.esc(hit.profileSize || (hit.sizeMm ? `DN${hit.sizeMm}` : '—'))}</td>
          <td>${fmt(hit.station)}</td><td>${fmt(hit.z)}</td></tr>`).join('')}
      </tbody></table>` : '<div class="pipe2-empty">断面未与具备高程的管段相交</div>'}
      ${(r.spacing || []).length ? `<div style="margin-top:6px"><div class="pipe2-card-title"><strong>相邻净距</strong></div>
        <table class="pipe2-table"><thead><tr><th>两管</th><th>中心距</th><th>净宽</th><th>高差</th></tr></thead><tbody>
        ${r.spacing.map((s) => `<tr><td>${ctx.esc(s.from)} ↔ ${ctx.esc(s.to)}</td><td>${fmt(s.centerDistance)}</td><td>${fmt(s.clearWidth)}</td><td>${fmt(s.verticalDifference)}</td></tr>`).join('')}
        </tbody></table></div>` : ''}
      ${(r.notAnalyzed || []).length ? `<div class="pipe2-summary">未参与：${r.notAnalyzed.map((n) => `${ctx.esc(n.lineCode)}（${ctx.esc(n.reason)}）`).join('；')}</div>` : ''}
    </div>`
  }
  if (type === 'clearance' || type === 'collision') {
    const all = r.items || []
    const items = type === 'collision' ? all.filter((item) => item.level === 'collision') : all
    return `<div class="pipe2-result">${head}
      <div class="pipe2-summary">比较 ${r.comparedPairs || 0} 对管段；碰撞 ${r.counts?.collision ?? 0} 处，净距不足 ${r.counts?.clearance ?? 0} 处，邻近需关注 ${r.counts?.near ?? 0} 处</div>
      ${items.length ? `<table class="pipe2-table"><thead><tr><th>等级</th><th>管段</th><th>中心距</th><th>水平/竖向</th><th>要求</th></tr></thead><tbody>
        ${items.map((item) => `<tr>
          <td><span class="pipe2-chip${item.level === 'collision' ? ' danger' : ' warn'}">${item.level === 'collision' ? '碰撞' : item.level === 'clearance' ? '净距不足' : '需关注'}</span></td>
          <td>${ctx.esc(item.lineA?.code || item.a)} ↔ ${ctx.esc(item.lineB?.code || item.b)}</td>
          <td>${fmt(item.distance)}</td><td>${fmt(item.horizontal)} / ${fmt(item.vertical)}</td>
          <td>${fmt(item.required?.horizontal)} / ${fmt(item.required?.vertical)}</td></tr>`).join('')}
      </tbody></table>` : `<div class="pipe2-empty">${type === 'collision' ? '未发现管段实体交叉' : '未发现碰撞或净距不足'}</div>`}
      <div class="pipe2-summary">规则来源：${ctx.esc(r.rulesSource || '企业内控默认值')}；${r.skipped ? `未判定 ${r.skipped} 条（缺高程或断面尺寸，需人工复核）。` : '缺高程或断面尺寸的管段输出「无法判定」。'}</div>
    </div>`
  }
  if (type === 'conflict') {
    const items = r.items || []
    const parts = r.datasets || []
    return `<div class="pipe2-result">${head}
      <div class="pipe2-summary">参与：${parts.map((item) => `${ctx.esc(item.name)}（${ctx.esc(STAGE_LABELS[item.stage] || '现状')}）`).join('、')}</div>
      <div class="pipe2-summary">比较 ${r.comparedPairs || 0} 对跨数据集管段；实体交叉 ${r.counts?.collision ?? 0} 处，净距不足 ${r.counts?.clearance ?? 0} 处，邻近 ${r.counts?.near ?? 0} 处</div>
      ${items.length ? `<table class="pipe2-table"><thead><tr><th>等级</th><th>管段对</th><th>中心距</th><th>净距</th></tr></thead><tbody>
        ${items.map((item) => `<tr>
          <td><span class="pipe2-chip${item.level === 'collision' ? ' danger' : ' warn'}">${item.level === 'collision' ? '碰撞' : item.level === 'clearance' ? '净距不足' : '需关注'}</span></td>
          <td>${ctx.esc(item.a?.code || '')} <span class="pipe2-ds-tag">${ctx.esc(item.a?.datasetName || '')}</span> ↔ ${ctx.esc(item.b?.code || '')} <span class="pipe2-ds-tag">${ctx.esc(item.b?.datasetName || '')}</span></td>
          <td>${fmt(item.distance)}</td><td>${fmt(item.surfaceDistance)}</td></tr>`).join('')}
      </tbody></table>` : '<div class="pipe2-empty">未发现跨数据集空间冲突</div>'}
      ${(r.notJudged || []).length ? `<div class="pipe2-summary">未判定 ${r.notJudged.length} 条：${r.notJudged.map((n) => `${ctx.esc(n.lineCode)}（${ctx.esc(n.reason)}）`).join('；')}</div>` : ''}
    </div>`
  }
  if (type === 'excavation') {
    const items = r.affected || []
    const byMajor = r.byMajor || {}
    return `<div class="pipe2-result">${head}
      <div class="pipe2-summary">影响范围 ${fmt(r.area)} m² · 估算土方 ${fmt(r.earthwork)} m³ · 受影响 ${items.length} 条（${Object.entries(byMajor).map(([k, v]) => `${ctx.esc(k)} ${v}`).join('、')}）</div>
      ${items.length ? `<table class="pipe2-table"><thead><tr><th>管段</th><th>类别</th><th>关系</th><th>高程</th><th>开挖底</th></tr></thead><tbody>
        ${items.map((item) => `<tr><td>${ctx.esc(item.lineCode)}</td><td>${ctx.esc(item.majorLabel || '')}</td>
          <td>${ctx.esc(item.relation || '')}</td><td>${fmt(item.minZ)}–${fmt(item.maxZ)}</td><td>${fmt(item.excavationBottom)}</td></tr>`).join('')}
      </tbody></table>` : '<div class="pipe2-empty">范围内无管线</div>'}
      <div class="pipe2-summary">${ctx.esc(r.note || '')}</div>
    </div>`
  }
  return `<div class="pipe2-result">${head}<pre style="white-space:pre-wrap;font-size:11px">${ctx.esc(JSON.stringify(r, null, 2)).slice(0, 4000)}</pre></div>`
}

function scenePanel() {
  const ds = activeDataset()
  const parts = state.scene?.parts || []
  const measureHint = state.measure?.distance
    ? `量测距离 ${fmt(state.measure.distance)} m（点击「量测」退出）`
    : '量测：点击两点读取三维距离，再次点击「量测」退出'
  return `
  <div class="pipe2-stage">
    <div class="pipe2-bar">
      <select class="pipe2-bar-select" id="pipe2DsSelect"${state.datasets.length ? '' : ' disabled'} title="切换数据集">
        ${state.datasets.length
          ? state.datasets.map((item) => `<option value="${ctx.esc(item.id)}"${item.id === state.activeId ? ' selected' : ''}>${ctx.esc(item.name)}（${ctx.esc(stageOf(item))}）</option>`).join('')
          : '<option>暂无数据集</option>'}
      </select>
      <span class="pipe2-bar-sep"></span>
      <div class="pipe2-bar-group">
        <button class="pipe2-bar-btn" id="pipe2Reset" title="恢复到初始视角">复位</button>
        <button class="pipe2-bar-btn" id="pipe2Top" title="切换到俯视（二维）视角">俯视</button>
        <button class="pipe2-bar-btn pipe2-bar-icon" id="pipe2ZoomOut" title="缩小">－</button>
        <button class="pipe2-bar-btn pipe2-bar-icon" id="pipe2ZoomIn" title="放大">＋</button>
        <div class="pipe2-pop">
          <button class="pipe2-bar-btn${state.menu === 'rotate' ? ' active' : ''}" data-menu="rotate" title="水平旋转场景">旋转 ▾</button>
          ${state.menu === 'rotate' ? `<div class="pipe2-menu">
            <button class="pipe2-menu-item" data-rotate="-45">左转 45°</button>
            <button class="pipe2-menu-item" data-rotate="45">右转 45°</button>
            <button class="pipe2-menu-item" data-north="1">正北朝上</button>
          </div>` : ''}
        </div>
        <button class="pipe2-bar-btn${state.panMode ? ' active' : ''}" id="pipe2Pan" title="平移模式：左键拖动平移场景">平移</button>
        <button class="pipe2-bar-btn" id="pipe2ZoomLayer" title="缩放到当前数据集范围">缩放到图层</button>
        <button class="pipe2-bar-btn${state.identify ? ' active' : ''}" id="pipe2Identify" title="识别模式：单击管段/管点查看属性">识别</button>
        <div class="pipe2-pop">
          <button class="pipe2-bar-btn${state.measure || state.menu === 'measure' ? ' active' : ''}" data-menu="measure" title="量测">量测 ▾</button>
          ${state.menu === 'measure' ? `<div class="pipe2-menu">
            <button class="pipe2-menu-item${state.measure ? ' active' : ''}" id="pipe2Measure">三维距离（点两点）</button>
            <button class="pipe2-menu-item" id="pipe2MeasureClear"${state.measure ? '' : ' disabled'}>清除量测</button>
          </div>` : ''}
        </div>
        <div class="pipe2-pop">
          <button class="pipe2-bar-btn${state.tool || state.menu === 'analysis' ? ' active' : ''}" data-menu="analysis" title="空间分析">分析 ▾</button>
          ${state.menu === 'analysis' ? analysisMenuHtml() : ''}
        </div>
      </div>
    </div>
    <div class="pipe2-map" id="pipe2Viewport">
    ${state.tool ? `<div class="pipe2-bar-form">
      <div class="pipe2-bar-form-head">
        <strong>${ctx.esc(ANALYSIS_LABELS[state.tool] || '')}</strong>
        <button class="link-btn" data-toolclose="1">收起</button>
      </div>
      ${toolFormHtml()}
    </div>` : ''}
    <div class="pipe2-float pipe2-left${state.leftOpen ? '' : ' closed'}">
      <div class="pipe2-float-head">
        <strong>图层与数据</strong>
        <span>${sourceFiltered().length} / ${state.datasets.length} 个</span>
        <button class="link-btn" data-toggle="left">${state.leftOpen ? '收起' : '展开'}</button>
      </div>
      ${state.leftOpen ? `<div class="pipe2-float-body">
        ${sourceFilterHtml()}
        <div class="pipe2-dslist">${sourceFiltered().length ? sourceFiltered().map(datasetCard).join('') : '<div class="pipe2-empty">暂无数据集<br/>点顶部「数据管理」导入</div>'}</div>
        <div class="pipe2-mini-title"><span>管线分类</span><span>${ds ? `${ds.lineCount || 0} 段` : ''}</span></div>
        ${legendHtml()}
        <div class="pipe2-mini-title"><span>地面透明度</span><span>地下漫游</span></div>
        <div class="pipe2-slider"><input type="range" id="pipe2Ground" min="0" max="100" value="${Math.round(state.groundAlpha * 100)}" /><span id="pipe2GroundVal">${Math.round(state.groundAlpha * 100)}%</span></div>
      </div>` : ''}
    </div>
    ${((state.picked || state.lastAnalysis) && state.rightOpen) ? `<div class="pipe2-float pipe2-right">
      <div class="pipe2-float-head">
        <strong>${state.lastAnalysis ? '分析结果' : '属性'}</strong>
        <span>${state.lastAnalysis ? ctx.esc(ANALYSIS_LABELS[state.lastAnalysis.type] || '') : ctx.esc(state.picked?.kind === 'node' ? (state.picked.node?.code || '已拾取') : (state.picked?.line?.code || '已拾取'))}</span>
        <button class="link-btn" data-toggle="right">收起</button>
      </div>
      <div class="pipe2-float-body">${state.lastAnalysis ? analysisSummaryHtml() : propertyHtml()}</div>
    </div>` : ''}
    <div class="pipe2-status">
      <span class="pipe2-status-main">${ds ? `${ctx.esc(ds.name)} · ${ctx.esc(sceneStatus())}` : '选择数据集后加载三维场景'}</span>
      ${state.scene?.bounds ? `<span>${ctx.esc(boundsText(state.scene.bounds))}${state.scene.bounds.minZ != null ? ` · 高程 ${fmt(state.scene.bounds.minZ)}–${fmt(state.scene.bounds.maxZ)}` : ''}</span>` : ''}
      ${state.scene?.dataset?.overlay ? `<span>${parts.map((part) => `${ctx.esc(part.name)}（${ctx.esc(STAGE_LABELS[part.stage] || '现状')}）`).join(' + ')}</span>` : ''}
      ${(state.scene?.alignmentWarnings || []).map((text) => `<span class="warn">${ctx.esc(text)}</span>`).join('')}
      <span class="pipe2-status-hint">${state.measure ? measureHint : '左键旋转 · 右键平移 · 滚轮缩放 · WASD 漫游'}</span>
    </div>
    ${ds && state.scene ? '' : '<div class="pipe2-vp-empty">选择数据集后加载三维场景</div>'}
    </div>
  </div>`
}

/* ------------------------------ 分析成果 ------------------------------ */

function runCard(run) {
  return `<div class="pipe2-run" data-run="${ctx.esc(run.id)}">
    <div class="pipe2-run-head">
      <span style="font-weight:600">${ctx.esc(ANALYSIS_LABELS[run.type] || run.type)}</span>
      <span style="color:#8a8781">${run.createdAt ? new Date(run.createdAt).toLocaleString('zh-CN') : ''}</span>
    </div>
    <div class="pipe2-run-summary">${ctx.esc(run.summary || '')}</div>
  </div>`
}

function runDetailHtml() {
  const run = state.runDetail
  if (!run) return '<div class="pipe2-empty">选择左侧分析记录查看结果</div>'
  const fake = { type: run.type, summary: run.summary, result: run.result, createdAt: run.createdAt }
  const previous = state.lastAnalysis
  state.lastAnalysis = fake
  const html = analysisSummaryHtml()
  state.lastAnalysis = previous
  return `${html}
    <div class="pipe2-actions">
      <button class="btn" id="pipe2Export">导出报告</button>
      <button class="btn danger" id="pipe2RunDelete">删除记录</button>
    </div>`
}

function analysisPanel() {
  const ds = activeDataset()
  return `
  <div class="pipe2-main">
    <div class="pipe2-col">
      <div class="pipe2-card">
        <div class="pipe2-card-title"><strong>数据集</strong><span>${sourceFiltered().length}</span></div>
        <div class="pipe2-dslist">${sourceFiltered().length ? sourceFiltered().map((item) => `
          <button class="pipe2-ds${item.id === state.activeId ? ' active' : ''}" data-dsid="${ctx.esc(item.id)}">
            <div class="pipe2-ds-name">${ctx.esc(item.name)}</div>
            <div class="pipe2-ds-meta">${item.lineCount || 0} 段 · ${ctx.esc(stageOf(item))}</div>
          </button>`).join('') : '<div class="pipe2-empty">暂无数据集</div>'}
        </div>
      </div>
      <div class="pipe2-card">
        <div class="pipe2-card-title"><strong>类型筛选</strong></div>
        <div class="pipe2-tool">
          <button data-runfilter="" class="${state.runFilter === '' ? 'active' : ''}">全部</button>
          ${Object.entries(ANALYSIS_LABELS).map(([key, label]) => `<button data-runfilter="${key}" class="${state.runFilter === key ? 'active' : ''}">${label}</button>`).join('')}
        </div>
      </div>
    </div>
    <div class="pipe2-col">
      <div class="pipe2-card" style="flex:1">
        <div class="pipe2-card-title"><strong>分析记录</strong><span>${state.runs.length} 条${ds ? ` · ${ctx.esc(ds.name)}` : ''}</span></div>
        <div class="pipe2-dslist">${state.runs.length ? state.runs.map(runCard).join('') : '<div class="pipe2-empty">暂无分析记录。<br/>在三维场景中运行断面、净距、碰撞或开挖分析后自动归档。</div>'}</div>
      </div>
    </div>
    <div class="pipe2-col">
      <div class="pipe2-card" style="flex:1">
        <div class="pipe2-card-title"><strong>结果详情</strong><span>${state.runDetail ? ctx.esc(ANALYSIS_LABELS[state.runDetail.type] || '') : ''}</span></div>
        ${runDetailHtml()}
      </div>
    </div>
  </div>`
}

/* ------------------------------ 渲染与交互 ------------------------------ */

function headHtml() {
  return `
  <div class="view-head pipe2-head">
    <div><div class="view-title">地下管网三维</div><div class="pipe2-head-note">CAD 与普查成果统一接入 · 三维自动建模 · 专业空间分析</div></div>
    <div class="spacer"></div>
    <div class="pipe2-head-actions">
      <button class="pipe2-entry" data-modal="data"><span>数据管理</span><em>${state.datasets.length} 个数据集</em></button>
      <button class="pipe2-entry" data-modal="analysis"><span>分析成果</span><em>${state.runs.length ? `${state.runs.length} 条记录` : '结果归档'}</em></button>
    </div>
  </div>`
}

function modalHtml() {
  if (!state.modal) return ''
  const isData = state.modal === 'data'
  return `<div class="pipe2-modal" data-modal-backdrop="1">
    <div class="pipe2-modal-panel">
      <div class="pipe2-modal-head">
        <strong>${isData ? '数据管理' : '分析成果'}</strong>
        <span>${isData ? 'CAD 图纸与管网普查成果的统一接入、质检与版本' : '分析任务、问题清单与报告导出'}</span>
        <div class="spacer"></div>
        <button class="btn" data-modal-close="1">返回场景</button>
      </div>
      <div class="pipe2-modal-body">${isData ? dataPanel() : analysisPanel()}</div>
    </div>
  </div>`
}

function bodyHtml() {
  return scenePanel() + modalHtml()
}

function render(el) {
  el.innerHTML = headHtml() + bodyHtml()
  bind(el)
  mountStage(el)
}

let currentEl = null
let lastBoundEl = null
let escBound = false

function bind(el) {
  if (lastBoundEl !== el) {
    lastBoundEl = el
    el.addEventListener('click', onClick)
    el.addEventListener('change', onChange)
    el.addEventListener('input', onInput)
    el.addEventListener('dragover', onDragOver)
    el.addEventListener('drop', onDrop)
    el.addEventListener('keydown', (event) => { if (event.key === 'Enter' && event.target.id === 'pipe2Name') onClick(event) })
  }
  if (!escBound) {
    escBound = true
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && state.modal) {
        state.modal = ''
        render(currentEl)
      }
    })
  }
  currentEl = el
}

function onDragOver(event) {
  if (!event.target.closest('#pipe2Drop')) return
  event.preventDefault()
  event.target.closest('#pipe2Drop').classList.add('over')
}

function onDrop(event) {
  const drop = event.target.closest('#pipe2Drop')
  if (!drop) return
  event.preventDefault()
  drop.classList.remove('over')
  if (event.dataTransfer?.files?.length) addFiles([...event.dataTransfer.files])
}

async function onClick(event) {
  const modalOpen = event.target.closest('[data-modal]')
  if (modalOpen) {
    state.modal = modalOpen.dataset.modal
    if (state.modal === 'analysis') await loadRuns()
    render(currentEl)
    return
  }

  if (event.target.closest('[data-modal-close]')) {
    state.modal = ''
    render(currentEl)
    return
  }

  const backdrop = event.target.closest('[data-modal-backdrop]')
  if (backdrop && event.target === backdrop) {
    state.modal = ''
    render(currentEl)
    return
  }

  const toggle = event.target.closest('[data-toggle]')
  if (toggle) {
    if (toggle.dataset.toggle === 'left') state.leftOpen = !state.leftOpen
    if (toggle.dataset.toggle === 'right') state.rightOpen = !state.rightOpen
    render(currentEl)
    return
  }

  if (event.target.closest('[data-toolclose]')) {
    state.tool = ''
    render(currentEl)
    return
  }

  const sourceBtn = event.target.closest('[data-sourcefilter]')
  if (sourceBtn) {
    state.sourceFilter = sourceBtn.dataset.sourcefilter
    render(currentEl)
    return
  }

  const stageBtn = event.target.closest('[data-stagefilter]')
  if (stageBtn) {
    state.stageFilter = stageBtn.dataset.stagefilter
    render(currentEl)
    return
  }

  const overlayBtn = event.target.closest('[data-overlay]')
  if (overlayBtn) {
    const id = overlayBtn.dataset.overlay
    const list = state.overlayIds
    state.overlayIds = list.includes(id) ? list.filter((item) => item !== id) : [...list, id]
    await openScene()
    render(currentEl)
    return
  }

  const ds = event.target.closest('[data-dsid]')
  if (ds) {
    if (state.activeId !== ds.dataset.dsid) {
      state.activeId = ds.dataset.dsid
      state.scene = null
      state.picked = null
      state.lastAnalysis = null
      state.runs = []
      state.runDetail = null
      await loadDetail()
      if (state.sceneApi) state.sceneApi.setData(null)
      if (!state.modal) await openScene()
    }
    render(currentEl)
    return
  }

  const menuBtn = event.target.closest('[data-menu]')
  if (menuBtn) {
    const key = menuBtn.dataset.menu
    state.menu = state.menu === key ? '' : key
    render(currentEl)
    return
  }

  const rotateBtn = event.target.closest('[data-rotate]')
  if (rotateBtn) {
    state.sceneApi?.rotateBy(Number(rotateBtn.dataset.rotate))
    state.menu = ''
    render(currentEl)
    return
  }
  if (event.target.closest('[data-north]')) {
    state.sceneApi?.resetNorth()
    state.menu = ''
    render(currentEl)
    return
  }

  const tool = event.target.closest('[data-tool]')
  if (tool) {
    state.tool = state.tool === tool.dataset.tool ? '' : tool.dataset.tool
    state.lastAnalysis = null
    state.menu = ''
    render(currentEl)
    return
  }

  const runFilter = event.target.closest('[data-runfilter]')
  if (runFilter) { state.runFilter = runFilter.dataset.runfilter; await loadRuns(); render(currentEl); return }

  const runItem = event.target.closest('[data-run]')
  if (runItem) {
    const { ok, body } = await ctx.api(`/api/analysis/item?id=${encodeURIComponent(runItem.dataset.run)}`).catch(() => ({ ok: false, body: {} }))
    if (!ok) return ctx.toast(body.error || '分析记录读取失败', true)
    state.runDetail = body.analysis
    render(currentEl)
    return
  }

  const remove = event.target.closest('[data-remove]')
  if (remove) { state.upload.files.splice(Number(remove.dataset.remove), 1); render(currentEl); return }

  const issue = event.target.closest('[data-issue]')
  if (issue) {
    const { ok } = await ctx.api('/api/pipeline/issue/resolve', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ datasetId: state.activeId, issueId: issue.dataset.issue }),
    }).catch(() => ({ ok: false }))
    if (!ok) return ctx.toast('接收失败', true)
    await loadDetail()
    render(currentEl)
    return
  }

  const id = event.target.id
  if (id === 'pipe2Drop') return currentEl.querySelector('#pipe2FileInput')?.click()
  if (id === 'pipe2Import') return importFiles()
  if (id === 'pipe2ToScene') {
    state.modal = ''
    if (!state.scene) await openScene()
    render(currentEl)
    return
  }
  if (id === 'pipe2Delete') return deleteDataset()
  if (id === 'pipe2SaveReg') return saveRegistration()
  if (id === 'pipe2Run') return runAnalysis()
  if (id === 'pipe2Reset') { state.sceneApi?.resetView(); return }
  if (id === 'pipe2Top') { state.sceneApi?.topView(); return }
  if (id === 'pipe2ZoomIn') { state.sceneApi?.zoomBy(0.78); return }
  if (id === 'pipe2ZoomOut') { state.sceneApi?.zoomBy(1.28); return }
  if (id === 'pipe2ZoomLayer') { state.sceneApi?.zoomToLayer(); return }
  if (id === 'pipe2Pan') {
    state.panMode = !state.panMode
    state.sceneApi?.setPanMode(state.panMode)
    render(currentEl)
    return
  }
  if (id === 'pipe2Identify') {
    state.identify = !state.identify
    state.sceneApi?.setIdentify(state.identify)
    if (!state.identify) { state.picked = null }
    render(currentEl)
    return
  }
  if (id === 'pipe2Measure') {
    state.measure = { distance: null, points: 0 }
    state.menu = ''
    state.sceneApi?.setMeasure(true)
    render(currentEl)
    return
  }
  if (id === 'pipe2MeasureClear') {
    state.measure = null
    state.menu = ''
    state.sceneApi?.setMeasure(false)
    render(currentEl)
    return
  }
  if (id === 'pipe2Export') return exportRun()
  if (id === 'pipe2RunDelete') return deleteRun()
}

function onInput(event) {
  const id = event.target.id
  if (id === 'pipe2Ground') {
    state.groundAlpha = Number(event.target.value) / 100
    const label = currentEl.querySelector('#pipe2GroundVal')
    if (label) label.textContent = `${event.target.value}%`
    state.sceneApi?.setGroundOpacity(state.groundAlpha)
    return
  }
  if (id === 'pipe2Name') { state.upload.name = event.target.value }
  if (id === 'secX1' || id === 'secY1' || id === 'secX2' || id === 'secY2') {
    state.sectionLine = [
      [num(currentEl.querySelector('#secX1')?.value), num(currentEl.querySelector('#secY1')?.value)],
      [num(currentEl.querySelector('#secX2')?.value), num(currentEl.querySelector('#secY2')?.value)],
    ]
  }
  if (id === 'excX1' || id === 'excY1' || id === 'excX2' || id === 'excY2' || id === 'excDepth') {
    state.excavation = {
      x1: num(currentEl.querySelector('#excX1')?.value), y1: num(currentEl.querySelector('#excY1')?.value),
      x2: num(currentEl.querySelector('#excX2')?.value), y2: num(currentEl.querySelector('#excY2')?.value),
      depth: num(currentEl.querySelector('#excDepth')?.value) || 2,
    }
  }
}

async function onChange(event) {
  const visibleKey = event.target.dataset?.visible
  if (visibleKey) {
    state.visible[visibleKey] = event.target.checked
    state.sceneApi?.setVisibleMajors(Object.keys(state.visible).filter((key) => state.visible[key]))
    return
  }
  if (event.target.id === 'pipe2Source') { state.upload.sourceType = event.target.value; return }
  if (event.target.id === 'pipe2Stage') { state.upload.stage = event.target.value; return }
  if (event.target.id === 'pipe2DsSelect') {
    const id = event.target.value
    if (id && id !== state.activeId) {
      state.activeId = id
      state.scene = null
      state.picked = null
      state.lastAnalysis = null
      state.runs = []
      state.runDetail = null
      state.overlayIds = state.overlayIds.filter((item) => item !== id)
      state.sceneApi?.setData(null)
      await loadDetail()
      await openScene()
      render(currentEl)
    }
    return
  }
  if (event.target.id === 'pipe2FileInput') {
    addFiles([...event.target.files])
    event.target.value = ''
  }
}

function addFiles(files) {
  const incoming = files.filter((file) => /\.(dxf|shp|dbf|shx|prj|cpg|gdb|csv|txt|geojson|json|zip)$/i.test(file.name))
  const skipped = files.length - incoming.length
  const merged = [...state.upload.files]
  for (const file of incoming) {
    if (!merged.some((item) => item.name === file.name && item.size === file.size)) merged.push(file)
  }
  state.upload.files = merged
  if (!state.upload.name && merged.length) {
    state.upload.name = merged[0].name.replace(/\.(shp|dxf|csv|geojson|json|zip)$/i, '')
  }
  if (skipped) state.progress = `已忽略 ${skipped} 个不支持的文件`
  render(currentEl)
}

function setProgress(text, isError = false, percent) {
  state.progress = text
  state.progressError = isError
  state.progressPercent = Number.isFinite(Number(percent)) && percent !== null && percent !== undefined
    ? clampPercent(percent)
    : null
  applyProgressDom()
}

/** 只更新进度区 DOM，避免每次进度回调都整页重渲染 */
function applyProgressDom() {
  const el = currentEl?.querySelector('.pipe2-progress')
  if (!el) return
  el.classList.toggle('err', Boolean(state.progressError))
  const textEl = el.querySelector('.pipe2-progress-text')
  if (textEl) textEl.innerHTML = ctx.esc(String(state.progress || '')).replace(/\n/g, '<br/>')
  const bar = el.querySelector('.pipe2-progress-bar')
  if (!bar) return
  if (Number.isFinite(state.progressPercent)) {
    bar.removeAttribute('hidden')
    const fill = bar.querySelector('.pipe2-progress-track i')
    const pct = bar.querySelector('.pipe2-progress-pct')
    if (fill) fill.style.width = `${clampPercent(state.progressPercent)}%`
    if (pct) pct.textContent = `${Math.round(clampPercent(state.progressPercent))}%`
  } else {
    bar.setAttribute('hidden', 'hidden')
  }
}

/** 带真实上传进度的文件上传（大文件用 XHR 才能拿到 upload.progress） */
function uploadFileWithProgress(file, onPercent) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `/api/files/upload?kind=resource&name=${encodeURIComponent(file.name)}`)
    xhr.setRequestHeader('content-type', 'application/octet-stream')
    xhr.withCredentials = true
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && typeof onPercent === 'function') onPercent(event.loaded / event.total)
    }
    xhr.onload = () => {
      let body = {}
      try { body = JSON.parse(xhr.responseText || '{}') } catch { body = {} }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, body })
    }
    xhr.onerror = () => reject(new Error('上传失败：网络中断'))
    xhr.onabort = () => reject(new Error('上传已取消'))
    xhr.send(file)
  })
}

/** 轮询服务端导入进度；上传阶段固定占前 15% */
async function pollImportProgress(jobId, control) {
  while (!control.stop) {
    await sleep(500)
    if (control.stop) break
    const { ok, body } = await ctx.api(`/api/pipeline/import/progress?job=${encodeURIComponent(jobId)}`)
      .catch(() => ({ ok: false, body: {} }))
    if (!ok || !body) continue
    if (body.done) { control.stop = true; return }
    const percent = Number(body.percent) || 0
    setProgress(body.message || '正在解析并入库…', false, 15 + percent * 0.85)
  }
}

async function importFiles() {
  if (state.busy) return
  const files = state.upload.files
  if (!files.length) return ctx.toast('请先选择文件', true)
  state.busy = 'import'
  state.progressPercent = 0
  render(currentEl)
  setProgress('正在上传文件…', false, 0)
  const jobId = `imp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const control = { stop: false }
  try {
    const refs = []
    for (const file of files) {
      const basePercent = (refs.length / files.length) * 15
      setProgress(`正在上传 ${file.name}（${refs.length + 1}/${files.length}）`, false, basePercent)
      const { ok, body } = await uploadFileWithProgress(file, (ratio) => {
        setProgress(`正在上传 ${file.name}（${Math.round(ratio * 100)}%，第 ${refs.length + 1}/${files.length} 个）`, false, basePercent + ratio * (15 / files.length))
      })
      if (!ok || !body.file) throw new Error(body.error || `上传失败：${file.name}`)
      refs.push({ id: body.file.id, name: body.file.name, path: file.name })
    }
    setProgress('正在解析并入库…', false, 15)
    pollImportProgress(jobId, control)
    const { ok, body } = await ctx.api('/api/pipeline/import', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: state.upload.name,
        sourceType: state.upload.sourceType === 'auto' ? '' : state.upload.sourceType,
        stage: state.upload.stage,
        files: refs,
        jobId,
      }),
    })
    control.stop = true
    if (!ok) throw new Error(body.error || '导入失败')
    const summary = body.summary || {}
    const warnings = (body.warnings || []).slice(0, 3)
    state.activeId = body.dataset?.id || state.activeId
    state.upload.files = []
    state.upload.name = ''
    state.busy = ''
    await loadDatasets()
    await loadDetail()
    state.progress = [
      `导入完成：${summary.pointCount || 0} 个管点、${summary.lineCount || 0} 条管段，类别 ${(summary.majors || []).length} 类。`,
      `坐标处理：${summary.transform === 'geographic' ? '经纬度投影到局部坐标' : summary.transform === 'projected' ? '投影坐标平移' : '原始坐标'}；高程基准 ${state.detail?.datum || '—'}。`,
      (body.issues || []).length ? `质检发现 ${body.issues.length} 项问题，已在数据详情中列出。` : '质检未发现问题。',
      ...warnings,
    ].join('\n')
    state.progressPercent = null
    state.progressError = false
    render(currentEl)
    ctx.toast('管网数据导入完成')
  } catch (error) {
    state.busy = ''
    control.stop = true
    setProgress(String(error.message || error), true, null)
    render(currentEl)
  }
}

async function deleteDataset() {
  const ds = activeDataset()
  if (!ds) return
  if (!window.confirm(`删除数据集「${ds.name}」？原始文件与解析结果会一并从当前库中移除。`)) return
  const { ok, body } = await ctx.api('/api/pipeline/delete', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: ds.id }),
  }).catch(() => ({ ok: false, body: {} }))
  if (!ok) return ctx.toast(body.error || '删除失败', true)
  state.activeId = ''
  state.detail = null
  state.scene = null
  state.lastAnalysis = null
  if (state.sceneApi) state.sceneApi.setData(null)
  await loadDatasets()
  await loadDetail()
  render(currentEl)
  ctx.toast('已删除')
}

async function saveRegistration() {
  if (!state.activeId) return
  const dx = Number(currentEl?.querySelector('#pipe2RegDx')?.value)
  const dy = Number(currentEl?.querySelector('#pipe2RegDy')?.value)
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return ctx.toast('配准偏移需为数字（米）', true)
  const { ok, body } = await ctx.api('/api/pipeline/registration', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: state.activeId, dx, dy }),
  }).catch(() => ({ ok: false, body: {} }))
  if (!ok) return ctx.toast(body.error || '配准保存失败', true)
  state.detail = body.dataset || state.detail
  const item = state.datasets.find((entry) => entry.id === state.activeId)
  if (item && body.dataset?.meta) item.meta = body.dataset.meta
  state.scene = null
  if (state.sceneApi) state.sceneApi.setData(null)
  render(currentEl)
  ctx.toast('坐标配准已保存')
}

async function openScene() {
  if (!state.activeId) return
  if (state.busy === 'scene') return
  state.busy = 'scene'
  const extras = state.overlayIds.filter((id) => id !== state.activeId)
  const query = `id=${encodeURIComponent(state.activeId)}${extras.length ? `&with=${encodeURIComponent(extras.join(','))}` : ''}`
  const { ok, body } = await ctx.api(`/api/pipeline/scene?${query}`).catch(() => ({ ok: false, body: {} }))
  state.busy = ''
  if (!ok) {
    state.scene = null
    ctx.toast(body.error || '三维场景加载失败', true)
    return
  }
  state.scene = body
  state.picked = null
  if (!state.sceneApi) {
    const mod = await import('./pipeline-scene.js?v=38')
    state.stageEl = document.createElement('div')
    state.stageEl.className = 'pipe2-canvas'
    state.sceneApi = mod.createPipeScene(state.stageEl, {
      onPick: (pick) => { state.picked = pick; state.lastAnalysis = null; if (pick) state.rightOpen = true; render(currentEl) },
      onMeasure: (result) => {
        state.measure = { distance: result.distance, points: result.count }
        render(currentEl)
      },
    })
  }
  state.sceneApi.setData(body)
  state.sceneApi.setVisibleMajors(Object.keys(state.visible).filter((key) => state.visible[key]))
  state.sceneApi.setGroundOpacity(state.groundAlpha)
  state.sceneApi.setMeasure(Boolean(state.measure))
  state.sceneApi.setPanMode(state.panMode)
  state.sceneApi.setIdentify(state.identify)
  window.__pipelineSceneApi = state.sceneApi
}

function mountStage(el) {
  const holder = el.querySelector('#pipe2Viewport')
  if (!holder || !state.stageEl) return
  holder.insertBefore(state.stageEl, holder.firstChild)
  state.sceneApi?.resize()
}

async function runAnalysis() {
  if (!state.activeId || state.busy) return
  const type = state.tool
  if (!type) return
  state.busy = 'analysis'
  render(currentEl)
  const payload = { datasetId: state.activeId }
  const bounds = state.scene?.bounds || state.detail?.meta?.bounds
  if (type === 'section') {
    const midX = bounds ? (bounds.minX + bounds.maxX) / 2 : null
    const line = state.sectionLine
      || (bounds ? [[midX, bounds.minY - 10], [midX, bounds.maxY + 10]] : null)
    if (!line || line.some((p) => p.some((v) => v === null))) { state.busy = ''; render(currentEl); return ctx.toast('断面线坐标不完整', true) }
    if (line[0][0] === line[1][0] && line[0][1] === line[1][1]) { state.busy = ''; render(currentEl); return ctx.toast('断面线两端点不能重合', true) }
    payload.line = line
    payload.width = 0.4
  }
  if (type === 'excavation') {
    const e = state.excavation || (bounds ? {
      x1: bounds.minX + (bounds.maxX - bounds.minX) * 0.15, y1: bounds.minY + (bounds.maxY - bounds.minY) * 0.15,
      x2: bounds.maxX - (bounds.maxX - bounds.minX) * 0.15, y2: bounds.maxY - (bounds.maxY - bounds.minY) * 0.15, depth: 2,
    } : null)
    if (!e || [e.x1, e.y1, e.x2, e.y2].some((v) => v === null)) { state.busy = ''; render(currentEl); return ctx.toast('开挖范围不完整', true) }
    payload.polygon = [[e.x1, e.y1], [e.x2, e.y1], [e.x2, e.y2], [e.x1, e.y2]]
    payload.depth = e.depth
  }
  if (type === 'conflict') {
    const overlays = overlayList()
    if (!overlays.length) { state.busy = ''; render(currentEl); return ctx.toast('至少需要一个叠加数据集才能做冲突检查', true) }
    payload.withIds = overlays.map((item) => item.id)
  }
  const { ok, body } = await ctx.api(`/api/analysis/${type}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  }).catch(() => ({ ok: false, body: {} }))
  state.busy = ''
  if (!ok) { render(currentEl); return ctx.toast(body.error || '分析失败', true) }
  state.lastAnalysis = body
  state.rightOpen = true
  if (type === 'section') { state.sceneApi?.setSection({ sectionLine: payload.line.map((p) => p), width: 0.4, hits: body.result.hits, ...body.result }) }
  if (type === 'excavation') { state.sceneApi?.setExcavation({ polygon: payload.polygon, depth: payload.depth, ...body.result }) }
  if (type === 'clearance' || type === 'collision' || type === 'conflict') { state.sceneApi?.setSection(null); state.sceneApi?.setExcavation(null) }
  render(currentEl)
  ctx.toast(`${ANALYSIS_LABELS[type]}完成`)
}

async function loadRuns() {
  if (!state.activeId) { state.runs = []; return }
  const query = state.runFilter ? `&type=${state.runFilter}` : ''
  const { ok, body } = await ctx.api(`/api/analysis/list?dataset=${encodeURIComponent(state.activeId)}${query}`).catch(() => ({ ok: false, body: {} }))
  state.runs = ok ? (body.items || []) : []
}

function exportRun() {
  const run = state.runDetail
  if (!run) return
  const lines = [
    `# ${ANALYSIS_LABELS[run.type] || run.type}报告`,
    '',
    `- 数据集：${Array.isArray(run.result?.datasets) && run.result.datasets.length
      ? run.result.datasets.map((item) => `${item.name}（${STAGE_LABELS[item.stage] || '现状'}）`).join(' + ')
      : (activeDataset()?.name || run.datasetId)}`,
    `- 生成时间：${new Date(run.createdAt || Date.now()).toLocaleString('zh-CN')}`,
    `- 结论：${run.summary || ''}`,
    '',
    '```json',
    JSON.stringify(run.result, null, 2),
    '```',
    '',
    '> 结果用于辅助核查，几何计算与规则来源已随记录归档；不替代现场探测与施工安全确认。',
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `管网${ANALYSIS_LABELS[run.type] || run.type}-${new Date().toISOString().slice(0, 10)}.md`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

async function deleteRun() {
  const run = state.runDetail
  if (!run) return
  const { ok, body } = await ctx.api('/api/analysis/delete', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: run.id }),
  }).catch(() => ({ ok: false, body: {} }))
  if (!ok) return ctx.toast(body.error || '删除失败', true)
  state.runDetail = null
  await loadRuns()
  render(currentEl)
}

/* ------------------------------ 入口 ------------------------------ */

export async function renderPipeline(el, context) {
  ctx = context
  if (!loadedOnce) {
    loadedOnce = true
    await loadDatasets()
    await loadDetail()
  }
  if (state.activeId && !state.scene) await openScene()
  if (state.modal === 'analysis') await loadRuns()
  render(el)
}

export function resetPipelineModule() {
  loadedOnce = false
  bound = false
  state.modal = ''
  state.measure = null
  state.scene = null
  state.picked = null
  state.lastAnalysis = null
  state.runs = []
  state.runDetail = null
  escBound = false
  if (state.sceneApi) { state.sceneApi.dispose(); state.sceneApi = null }
  state.stageEl = null
}















