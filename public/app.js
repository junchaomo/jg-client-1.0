import { AppLayout, LAYOUT_TOKENS } from './layout-system.js'

const state = {
  boot: null,
  view: 'home',
  resourceType: 'all',
  resourceCategory: 'all',
  resourcePage: 1,
  resourcePageSize: 10,
  resourceQuery: '',
  resourceList: [],
  selectedResource: null,
  satellite: null,
  plugins: [],
  pluginKind: 'enterprise',
  selectedPlugin: null,
  market: [],
  skillTab: 'plugin',
  skillScope: 'public',
  skillQuery: '',
  projects: [],
  prjQuery: '', prjSort: 'desc', pinnedProjects: [],
  taskSel: '',
  apps: [],
  appDetail: null,
  tasks: [],
  auditOpen: false,
  draft: '',
  activeProjectId: '',
  activeProjectName: '',
  activeProjectCwd: '',
  executionPolicy: 'auto',
  taskMode: 'auto',
  runtimeSettings: { defaultPolicy: 'auto', defaultEffort: 'medium', workspaceChanges: true },
  agentPresets: [],
  agentPresetId: '',
  composerModel: '',
  composerTools: ['T-DATA'],
  composerRefs: [],
  reasoningEffort: 'medium',
  deepThink: false,
  personalFiles: [
    { id: 'PF-01', name: '个人项目笔记摘要.docx', type: 'docx', size: '12.4 MB', owner: '钱工', dept: '集团总部', updated: '2026-11-07 16:20', shared: ['本人'], scope: '仅本人', tags: ['个人云盘', '笔记'] },
    { id: 'PF-02', name: '城市体检指标测算底表.xlsx', type: 'xlsx', size: '8.6 MB', owner: '钱工', dept: '集团总部', updated: '2026-11-06 10:35', shared: ['本人'], scope: '仅本人', tags: ['个人云盘', '测算'] },
    { id: 'PF-03', name: '滨江片区汇报提纲.pptx', type: 'pptx', size: '26.1 MB', owner: '钱工', dept: '集团总部', updated: '2026-11-05 18:05', shared: ['本人'], scope: '仅本人', tags: ['个人云盘', '汇报'] },
  ],
  settingsTab: 'general',
  settingsQuery: '',
  mcpResources: [],
  mcpQuery: '',
  accent: (() => { try { const v = localStorage.getItem('jg.accent'); return (!v || v === 'default') ? 'blue' : v } catch (e) { return 'blue' } })(),
  rail: false,
  railLocked: false,
  morePinned: [],
  moreSet: (() => { try { return JSON.parse(localStorage.getItem('jg.moreSet') || '[]') } catch (e) { return [] } })(),
  sidebarWidth: 292,
  sbUserW: 0,
  setNavWidth: 208,
  notifications: [],
  // 会话
  conversations: [],
  pinnedConvs: (() => { try { return JSON.parse(localStorage.getItem('jg.pinnedConvs') || '[]') } catch (e) { return [] } })(),
  archivedConvs: (() => { try { return JSON.parse(localStorage.getItem('jg.archivedConvs') || '[]') } catch (e) { return [] } })(),
  lockedConvs: (() => { try { return JSON.parse(localStorage.getItem('jg.lockedConvs') || '[]') } catch (e) { return [] } })(),
  convSections: (() => { try { return JSON.parse(localStorage.getItem('jg.convSections') || '{}') } catch (e) { return {} } })(),
  recentFilter: 'all',
  recentSort: 'recent',
  showProjects: true,
  projFolds: {},
  sidebarSections: (() => { try { return JSON.parse(localStorage.getItem('jg.sidebarSections') || '[]') } catch (e) { return [] } })(),
  projectSections: (() => { try { return JSON.parse(localStorage.getItem('jg.projectSections') || '[]') } catch (e) { return [] } })(),
  projectSectionMap: (() => { try { return JSON.parse(localStorage.getItem('jg.projectSectionMap') || '{}') } catch (e) { return {} } })(),
  conversation: null,
  chatBusy: false,
  chatStartedAt: 0,
  chatTicker: null,
  chatTask: null,
  speakingIndex: null,
  speechPaused: false,
  speechLoading: false,
  speechEngine: '',
  speechAudio: null,
  speechAbort: null,
  speechRun: 0,
  chatAbort: false,
  chatRunId: 0,
  pendingInteraction: null,
  interactionPoll: null,
  qSel: {},
  qCustom: {},
  chatSteps: [],
  chatError: '',
  pendingConfirm: null,
  // 管理后台
  adminTab: 'tickets',
  consoleTab: 'overview',
  consoleRole: 'platform',
  tickets: [],
  feedback: [],
  monitor: null,
  automations: [],
  taskPins: [],
  agentEntries: [],
  webSearch: false,
  knowledge: [],
  knowledgeQuery: '',
  notebooks: [],
  notebookId: null,
  nbOpen: false,
  nbStart: false,
  nbSortMode: 'recent',
  noteId: null,
  cloud: null,
  cloudOpen: false,
  sbPinned: true,
  cloudTabs: [{ id: 'new', kind: 'new', title: '新标签页' }],
  cloudTab: 'new',
  cloudExts: [
    { id: 'ext-audit', name: '企业审计水印', desc: '对企业站点自动叠加水印并留痕', on: true },
    { id: 'ext-json', name: 'JSON 格式化', desc: '格式化接口返回与调试数据', on: true },
    { id: 'ext-ad', name: '广告拦截', desc: '拦截弹窗与追踪脚本', on: false },
  ],
  cbW: 440,
  cbUserW: 0,
  imagegen: { prompt: '', ratio: '1:1', count: 1, style: '写实', shots: [], busy: false, modelId: '', references: [], assetsLoaded: false, assetsLoading: false, tab: 'templates', templates: [], templatesLoaded: false, templatesLoading: false, templateApps: [], templateAppsLoaded: false, templateAppsLoading: false },
}

const layout = new AppLayout(document.getElementById('app'))

const paths = {
  chat: '<path d="M4 5.5h16v10H9l-5 3.5z"/>',
  history: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  task: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h5"/>',
  plugin: '<circle cx="12" cy="12" r="9"/>' + '<path d="M9.6 6.4v2.4M14.4 6.4v2.4M8.4 8.8h7.2v3.6a3.6 3.6 0 0 1-7.2 0z"/><path d="M12 16.4v1.6"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l4 2"/>',
  database: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/>',
  book: '<path d="M5 5h6v15H5zM13 5h6v15h-6z"/>',
  map: '<path d="M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2z"/><path d="M9 4v14M15 6v14"/>',
  layers: '<path d="M12 3l8 4.5-8 4.5-8-4.5z"/><path d="M4 12l8 4.5 8-4.5M4 16.5l8 4.5 8-4.5"/>',
  wallet: '<rect x="4" y="6" width="16" height="12" rx="3"/><path d="M16 12h2"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.5 5.5l2 2M16.5 16.5l2 2M18.5 5.5l-2 2M7.5 16.5l-2 2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  tool: '<path d="M14 5l5 5-8 8H6v-3z"/><path d="M4 20l3-3"/>',
  send: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/>',
  bell: '<path d="M6 16h12l-1.5-2V10a4.5 4.5 0 0 0-9 0v4L6 16z"/><path d="M10 19h4"/>',
  briefcase: '<rect x="4" y="8" width="16" height="11" rx="2"/><path d="M9 8V6h6v2"/><path d="M4 12h16"/>',
  doc: '<path d="M7 4h7l4 4v12H7z"/><path d="M14 4v4h4"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  upload: '<path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 16v3h16v-3"/>',
  download: '<path d="M12 4v12"/><path d="M7 11l5 5 5-5"/><path d="M4 20h16"/>',
  image: '<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M5 17l5-5 4 4 3-3 3 3"/>',
  video: '<rect x="3" y="6" width="12" height="12" rx="2"/><path d="M15 10l6-3v10l-6-3"/>',
  cube: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
  cad: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 16V8l4 4 4-4v8"/>',
  table: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 10h16M9 10v9"/>',
  shield: '<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h12s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  check: '<path d="M5 12l4 4 6-8"/>',
  alarm: '<circle cx="12" cy="13" r="6"/><path d="M12 10v3h2"/><path d="M5 5l-2 2M19 5l2 2"/><path d="M7 19l-2 2M17 19l2 2"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  trash: '<path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13"/>',
  refresh: '<path d="M5 12a7 7 0 0 1 12-4M19 12a7 7 0 0 1-12 4"/><path d="M17 4v4h-4M7 20v-4h4"/>',
  chevron: '<path d="M9 7l5 5-5 5"/>',
  back: '<path d="M19 12H6M13 6l-6 6 6 6"/>',
  chart: '<path d="M5 19V9M10 19V5M15 19v-7M20 19v-3"/>',
  inbox: '<path d="M4 13l3-8h10l3 8v5H4z"/><path d="M4 13h5l1 2h4l1-2h5"/>',
  spark: '<path d="M12 4l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/>',
  pulse: '<path d="M3 12h4l2-6 4 12 2-6h6"/>',
  globe: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16"/>',
  window: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M6.5 7h.01M9 7h.01"/>',
  folder: '<path d="M4 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/>',
  pin: '<path d="M9 4h6l-1 5 3 3v2H7v-2l3-3z"/><path d="M12 14v6"/>',
  pinOff: '<path d="M9 4h6l-1 5 3 3v2H7v-2l3-3z"/><path d="M12 14v6"/><path d="M3 3l18 18"/>',
  external: '<rect x="4" y="7" width="9" height="13" rx="2"/><path d="M14 4h6v6"/><path d="M20 4l-8 8"/>',
  pen: '<path d="M4 20l4.5-1 10-10-3.5-3.5-10 10z"/><path d="M13.5 5.5l3.5 3.5"/>',
  compose: '<rect x="4" y="6" width="13" height="13" rx="2"/><path d="M14.5 4.5l3 3L10 15l-3.5 1 1-3.5z"/>',
  dots: '<circle cx="6" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
  home: '<path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z"/>',
  mic: '<rect x="9" y="3.5" width="6" height="10" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v3"/>',
  arrow: '<path d="M5 12h13M12 6l6 6-6 6"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  sort: '<path d="M7 5v14M4 16l3 3 3-3M17 19V5M14 8l3-3 3 3"/>',
  list: '<path d="M5 7h14M5 12h14M5 17h9"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V22a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H2a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V2a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H22a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  layers: '<rect x="4" y="4" width="16" height="6" rx="1.5"/><rect x="4" y="14" width="16" height="6" rx="1.5"/>',
  cloud: '<path d="M7 18a4 4 0 0 1-.4-8 5.5 5.5 0 0 1 10.6 1A3.5 3.5 0 0 1 17 18z"/>',
  users: '<circle cx="9" cy="9" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9.5" r="2.4"/><path d="M15 18.8a4.6 4.6 0 0 1 5.5-2.4"/>',
  message: '<path d="M4 6h16v10H9l-5 4z"/><path d="M8 11h8"/>',
  book: '<path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v15H7.5A2.5 2.5 0 0 0 5 20.5z"/><path d="M5 20.5V5.5"/><path d="M9 7h6M9 11h6"/>',
  cap: '<path d="M3 9l9-4 9 4-9 4z"/><path d="M7 11v5c0 1.5 10 1.5 10 0v-5"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2"/>',
  wave: '<path d="M5 12h.01M8 8v8M11 5v14M14 9v6M17 11v2M20 12h.01"/>',
  megaphone: '<path d="M4 10l11-5v14l-11-5z"/><path d="M15 9.5c1.6.9 2.6 2.4 2.6 2.5s-1 1.6-2.6 2.5"/><path d="M7 14v4"/>',
  target: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  more: '<circle cx="5.5" cy="12" r="1.9" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.9" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.9" fill="currentColor" stroke="none"/>',
  play: '<path d="M8 5.5l10 6.5-10 6.5z"/>',
  pause: '<path d="M9 5.5v13M15 5.5v13"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2.5" fill="currentColor" stroke="none"/>',
  star: '<path d="M12 4.5l2.3 4.7 5.2.8-3.8 3.7.9 5.2-4.6-2.4-4.6 2.4.9-5.2-3.8-3.7 5.2-.8z"/>',
  copy: '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  volume: '<path d="M4 9v6h4l5 4V5l-5 4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
  thumbUp: '<path d="M7 10v10H4V10z"/><path d="M7 20h9a3 3 0 0 0 2.9-2.3l1.1-6A2 2 0 0 0 18 9h-4V5a2 2 0 0 0-2-2L7 10z"/>',
  thumbDown: '<path d="M17 14V4h3v10z"/><path d="M17 4H8a3 3 0 0 0-2.9 2.3l-1.1 6A2 2 0 0 0 6 15h4v4a2 2 0 0 0 2 2l5-7z"/>',
  share: '<path d="M15 4h5v5"/><path d="M20 4l-8 8"/><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/>',
  quote: '<path d="M7 7h4v4H8a3 3 0 0 0-3 3V9a2 2 0 0 1 2-2z"/><path d="M15 7h4v4h-3a3 3 0 0 0-3 3V9a2 2 0 0 1 2-2z"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 9v5M12 17h.01"/>',
}

const NET_LABEL = { inet: '互联网', gov: '政务网', secret: '涉密内网' }

const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.doc}</svg>`

const typeMap = {
  gis: { label: 'GIS', icon: 'map' },
  '3d': { label: '三维', icon: 'cube' },
  cad: { label: 'CAD', icon: 'cad' },
  document: { label: '文档', icon: 'doc' },
  image: { label: '图片', icon: 'image' },
  video: { label: '视频', icon: 'video' },
  bizdata: { label: '业务数据', icon: 'table' },
  deliverable: { label: '成果数据', icon: 'folder' },
  service: { label: '数据服务', icon: 'globe' },
}

const securityMap = {
  public: { label: '公开', cls: 'ok' },
  internal: { label: '内部', cls: '' },
  secret: { label: '涉密', cls: 'secret' },
}

const NET_NAME = { inet: '互联网', gov: '政务网', secret: '涉密内网' }

const statusMap = {
  authorized: { label: '已登记', cls: 'ok' },
  'need-approval': { label: '需审批', cls: 'warn' },
  'pending-dept': { label: '待部门同意', cls: 'warn' },
  'pending-qc': { label: '待质检', cls: 'warn' },
  'pending-data': { label: '待数据审批', cls: 'warn' },
  rejected: { label: '已退回', cls: 'secret' },
}

async function api(path, options = {}) {
  const res = await fetch(path, { credentials: 'same-origin', ...options })
  const body = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, body }
}

/** 直传二进制文件到本地服务端；返回 file 元数据（id/size/sha256）。 */
async function uploadBinaryFile(file, kind = 'chat') {
  const name = encodeURIComponent(file.name || 'upload.bin')
  const res = await fetch(`/api/files/upload?kind=${encodeURIComponent(kind)}&name=${name}`, {
    method: 'POST',
    headers: { 'content-type': file.type || 'application/octet-stream' },
    body: file,
    credentials: 'same-origin',
  })
  const body = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, body, file: body.file }
}

function toast(message, bad = false) {
  const el = document.getElementById('toast')
  el.textContent = message
  el.className = `toast show${bad ? ' bad' : ''}`
  clearTimeout(toast._t)
  toast._t = setTimeout(() => { el.className = 'toast' }, 3200)
}

function closeRowMenu() {
  document.querySelectorAll('.jg-row-menu, .msg-more-menu').forEach((m) => m.remove())
}

function openRowMenu(anchor, marketId, name = '') {
  closeRowMenu()
  const menu = document.createElement('div')
  menu.className = 'jg-row-menu'
  menu.innerHTML = `<button type="button" data-row-uninstall="${esc(marketId)}">${icon('close')}<span>卸载${name ? `「${esc(name)}」` : ''}</span></button>`
  document.body.appendChild(menu)
  const r = anchor.getBoundingClientRect()
  const w = menu.offsetWidth || 148
  const h = menu.offsetHeight || 40
  menu.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w))}px`
  menu.style.top = `${Math.max(8, Math.min(window.innerHeight - h - 8, r.bottom + 4))}px`
  menu.querySelector('[data-row-uninstall]').addEventListener('click', async (e) => {
    e.stopPropagation()
    menu.remove()
    const { ok, body } = await api('/api/plugin-market/install', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: marketId }),
    })
    if (!ok) return toast(body.error || '卸载失败', true)
    toast(body.message || `已卸载${name ? `「${name}」` : ''}，下一轮对话生效`)
    renderView()
  })
  setTimeout(() => {
    document.addEventListener('pointerdown', function onDown(e) {
      if (!menu.contains(e.target)) {
        menu.remove()
        document.removeEventListener('pointerdown', onDown, true)
      }
    }, true)
    window.addEventListener('resize', closeRowMenu, { once: true })
    window.addEventListener('scroll', closeRowMenu, { once: true, capture: true })
  }, 0)
}

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function richTextHTML(value = '') {
  const raw = String(value)
  let last = 0
  let out = ''
  raw.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"']+)/g, (full, label, mdUrl, bareUrl, offset) => {
    out += esc(raw.slice(last, offset))
    let url = mdUrl || bareUrl
    let tail = ''
    const t = url.match(/(?:[，。；！？、]|[.,;!])$/)
    if (t) { tail = t[0]; url = url.slice(0, -1) }
    out += `<a href="${esc(url)}" data-weblink="${esc(url)}" title="在右侧自带浏览器打开" style="color:var(--accent);text-decoration:underline;text-underline-offset:2px;word-break:break-all">${esc(label || url)}</a>${esc(tail)}`
    last = offset + full.length
    return full
  })
  out += esc(raw.slice(last))
  return out
}

const MD_TOKEN_OPEN = '\uE000'
const MD_TOKEN_CLOSE = '\uE001'

function inlineMarkdown(value = '') {
  let text = esc(String(value))
  const stash = []
  const hold = (html) => {
    stash.push(html)
    return `${MD_TOKEN_OPEN}${stash.length - 1}${MD_TOKEN_CLOSE}`
  }
  text = text.replace(/`([^`\n]+)`/g, (_, code) => hold(`<code>${code}</code>`))
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => hold(
    `<a href="${url}" data-weblink="${url}" title="在右侧自带浏览器打开">${label}</a>`,
  ))
  text = text.replace(/(^|[\s(（])(https?:\/\/[^\s<)"'）]+)/g, (_, lead, url) => {
    let tail = ''
    const match = url.match(/(?:[，。；！？、]|[.,;!])$/)
    if (match) { tail = match[0]; url = url.slice(0, -1) }
    return `${lead}${hold(`<a href="${url}" data-weblink="${url}" title="在右侧自带浏览器打开">${url}</a>`)}${tail}`
  })
  text = text.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  text = text.replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
  text = text.replace(/~~([^~\n]+)~~/g, '<del>$1</del>')
  text = text.replace(/(^|[\s（(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  text = text.replace(/(^|[\s（(])_([^_\n]+)_/g, '$1<em>$2</em>')
  return text.replace(new RegExp(`${MD_TOKEN_OPEN}(\\d+)${MD_TOKEN_CLOSE}`, 'g'), (_, index) => stash[Number(index)] || '')
}

function tableCells(line = '') {
  return String(line).trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())
}

function isTableSeparator(line = '') {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(String(line))
}

function isMarkdownBlockStart(lines, index) {
  const raw = lines[index] || ''
  const line = raw.trim()
  if (!line) return true
  return /^```/.test(line)
    || /^#{1,6}\s+/.test(line)
    || /^>\s?/.test(line)
    || /^([-*+])\s+/.test(raw)
    || /^\d+\.\s+/.test(raw)
    || /^(-{3,}|\*{3,})$/.test(line)
    || (line.includes('|') && isTableSeparator(lines[index + 1] || ''))
}

function codeBlockHTML(language, code) {
  return `<div class="md-code"><div class="md-code-head"><span>${esc(language || '代码')}</span><button type="button" class="md-code-copy" data-copy-code>复制</button></div><pre><code>${esc(code)}</code></pre></div>`
}

function markdownHTML(value = '') {
  const lines = String(value).replace(/\r\n?/g, '\n').split('\n')
  let out = ''
  let i = 0
  while (i < lines.length) {
    const raw = lines[i]
    const line = raw.trim()
    if (!line) { i += 1; continue }
    if (/^```/.test(line)) {
      const language = line.slice(3).trim()
      const code = []
      i += 1
      while (i < lines.length && !/^```/.test(lines[i].trim())) { code.push(lines[i]); i += 1 }
      if (i < lines.length) i += 1
      out += codeBlockHTML(language, code.join('\n'))
      continue
    }
    if (line.includes('|') && isTableSeparator(lines[i + 1] || '')) {
      const headers = tableCells(line)
      const rows = []
      i += 2
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
        rows.push(tableCells(lines[i]))
        i += 1
      }
      out += `<div class="md-table-wrap"><table><thead><tr>${headers.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((_, idx) => `<td>${inlineMarkdown(row[idx] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
      continue
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      const level = Math.min(6, heading[1].length)
      out += `<h${level}>${inlineMarkdown(heading[2])}</h${level}>`
      i += 1
      continue
    }
    if (/^>\s?/.test(line)) {
      const quoted = []
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        quoted.push(lines[i].trim().replace(/^>\s?/, ''))
        i += 1
      }
      out += `<blockquote>${quoted.map(inlineMarkdown).join('<br>')}</blockquote>`
      continue
    }
    if (/^([-*+])\s+/.test(raw) || /^\d+\.\s+/.test(raw)) {
      const ordered = /^\d+\.\s+/.test(raw)
      const items = []
      const pattern = ordered ? /^\d+\.\s+(.*)$/ : /^[-*+]\s+(.*)$/
      while (i < lines.length) {
        const item = pattern.exec(lines[i].trim())
        if (!item) break
        items.push(item[1])
        i += 1
      }
      const tag = ordered ? 'ol' : 'ul'
      out += `<${tag}>${items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join('')}</${tag}>`
      continue
    }
    if (/^(-{3,}|\*{3,})$/.test(line)) {
      out += '<hr>'
      i += 1
      continue
    }
    const paragraph = [line]
    i += 1
    while (i < lines.length && !isMarkdownBlockStart(lines, i)) {
      paragraph.push(lines[i].trim())
      i += 1
    }
    out += `<p>${paragraph.map(inlineMarkdown).join('<br>')}</p>`
  }
  return `<div class="md-body">${out || '<p></p>'}</div>`
}


/* ------------------------------- boot ------------------------------- */

async function loadBoot() {
  const { body } = await api('/api/bootstrap')
  state.boot = body
  state.runtimeSettings = body.settings || state.runtimeSettings
  loadUsageSummary().catch(() => {})
  if (!state.conversation?.id) state.executionPolicy = state.runtimeSettings.defaultPolicy === 'manual' ? 'manual' : 'auto'
  state.agentPresets = body.agentPresets || []
  const imageCap = body.imageGeneration || {}
  const imageModels = Array.isArray(imageCap.models) ? imageCap.models : []
  if (!imageModels.some((model) => model.id === state.imagegen.modelId && model.configured)) {
    state.imagegen.modelId = imageCap.defaultModelId || imageModels.find((model) => model.configured)?.id || ''
  }
  if (!state.agentPresets.some((p) => p.id === state.agentPresetId)) state.agentPresetId = ''
  if (body.settings?.defaultEffort) state.reasoningEffort = body.settings.defaultEffort
  state.tasks = body.tasks || []
  state.conversations = body.conversations || []
  const netModels = body.models || []
  if (!netModels.some((m) => m.id === state.composerModel)) {
    state.composerModel = body.network?.defaultModel || netModels[0]?.id || ''
  }
  const enabledTools = (body.tools || []).filter((t) => t.enabled).map((t) => t.id)
  state.composerTools = state.composerTools.filter((id) => enabledTools.includes(id))
  if (!state.composerTools.length && enabledTools.includes('T-DATA')) state.composerTools = ['T-DATA']
  const plugins = await api('/api/plugins')
  if (plugins.ok) state.plugins = plugins.body.items || []
  const entries = await api('/api/agent-entries')
  if (entries.ok) state.agentEntries = entries.body.items || []
  const prj = await api('/api/projects')
  if (prj.ok) state.sidebarProjects = (prj.body.items || []).slice(0, 3)
  const mcp = await api('/api/mcp/resources')
  if (mcp.ok) {
    state.mcpResources = mcp.body.items || []
    state.mcpServer = mcp.body.server || null
  }
  await loadNotifications()
}

async function refreshAuditIfOpen() {
  if (state.auditOpen) await renderAuditDrawer()
}

/* ------------------------------ sidebar ----------------------------- */

const groups = [
  { label: 'AI 工作台', items: ['home', 'imagegen', 'tasks', 'skills', 'projects'] },
  { label: '企业工作台', items: ['notice', 'contacts', 'im', 'oa', 'drive', 'datacenter', 'oneMap'] },
  { label: '管理与运维', items: ['admin'] },
]

function renderRail() {
  const { user, modules } = state.boot
  const visible = (id) => user.visibleModules.includes(id)
  const sep = '<div class="rail-sep"></div>'
  const adminCol = visible('admin')
  const plan = railPlan()
  const order = ['home', ...plan.core, '__sep1', ...plan.entShown, ...plan.pinned, 'more', ...(adminCol ? ['admin'] : [])]
  const badge = (id) => {
    const n = id === 'im' && state.imUnread != null
      ? state.imUnread
      : state.notifications.filter((x) => x.unread && notifModule(x) === id).length
    return n ? `<i class="rail-badge">${n > 9 ? '9+' : n}</i>` : ''
  }
  const btn = (id) => {
    if (!visible(id)) return ''
    const meta = modules[id] || { label: id }
    const off = id === 'imagegen' && !imagegenReady()
    return `<button class="rail-btn${state.view === id ? ' on' : ''}" data-nav="${id}"${off ? ' disabled style="opacity:.45;cursor:not-allowed"' : ''} title="${esc(off ? (state.boot?.imageGeneration?.reason || '当前环境未启用真实生图') : meta.label)}${badge(id) ? ` · ${state.notifications.filter((x) => x.unread && notifModule(x) === id).length} 条未读` : ''}"><span class="ico">${icon(navIcon(id))}</span>${badge(id)}</button>`
  }
  const railbar = document.getElementById('railbar')
  railbar.innerHTML = `
    <button class="rail-btn rail-home" data-nav="home" title="首页"><span class="ico">${icon('home')}</span></button>
    ${sep}
    ${order.filter((id) => id !== 'home').map((id) => (id.startsWith('__sep') ? sep : btn(id))).join('')}
    <div class="rail-spacer"></div>
    <button class="rail-avatar" id="railAccount" title="账户与个人中心">
      <span class="face">${esc(user.name.slice(0, 1))}</span>
    </button>`
  const app = document.getElementById('app')
  app.classList.remove('has-admin')
  const adminrail = document.getElementById('adminrail')
  if (adminrail) adminrail.innerHTML = ''
  if (!railbar.__navBound) {
    railbar.__navBound = true
    railbar.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-nav]')
      if (!btn || !railbar.contains(btn)) return
      if (btn.dataset.nav === 'more') {
        const open = document.querySelector('.more-pop')
        if (open) { open.remove(); return }
        openMoreMenu(btn)
        return
      }
      if (btn.dataset.nav === 'imagegen' && !imagegenReady()) { showImageGate(); return }
      state.view = btn.dataset.nav
      markModuleRead(btn.dataset.nav)
      render()
    })
  }
  railbar.querySelector('#railAccount').addEventListener('click', (ev) => {    ev.stopPropagation()
    if (window.__accountPop) { const old = window.__accountPop; window.__accountPop = null; old.remove(); return }
    openAccountMenu(ev.currentTarget)
  })
}

function openRailMore(anchor) {
  document.querySelectorAll('.rail-pop').forEach((p) => p.remove())
  const { user, modules } = state.boot
  const ids = ['datacenter', 'knowledge', 'oneMap', 'review', 'oa', 'finance', 'admin', 'settings']
  const pop = document.createElement('div')
  pop.className = 'rail-pop'
  pop.innerHTML = ids.filter((id) => id === 'settings' || user.visibleModules.includes(id)).map((id) => `
    <button class="rail-pop-item" data-nav="${id}"><span class="ico">${icon(navIcon(id))}</span><span>${esc(modules[id]?.label || id)}</span></button>`).join('')
  document.body.appendChild(pop)
  const r = anchor.getBoundingClientRect()
  pop.style.left = `${r.right + 8}px`
  pop.style.bottom = `${window.innerHeight - r.bottom + 8}px`
  pop.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => {
    pop.remove()
    state.view = b.dataset.nav
    render()
  }))
  setTimeout(() => document.addEventListener('click', function close(ev) {
    if (!pop.contains(ev.target) && ev.target.isConnected) {
      if (window.__morePop === pop) window.__morePop = null
      pop.remove()
      document.removeEventListener('click', close)
    }
  }), 0)
}

let __projCardTimer = null
function openProjectMenu(anchor, id) {
  document.querySelectorAll('.conv-menu').forEach((pop) => pop.remove())
  const p = (state.sidebarProjects || []).find((x) => x.id === id)
  if (!p) return
  const pop = document.createElement('div')
  pop.className = 'conv-menu'
  const item = (act, ic, label, arrow = false) => `<button class="cm-item" data-pjm="${act}">
    <span class="ico">${icon(ic)}</span><span class="cm-label">${label}</span>${arrow ? '<span class="cm-arrow">›</span>' : ''}
  </button>`
  pop.innerHTML = [
    item('pin', 'pin', p.pinned ? '取消置顶' : '置顶'),
    item('edit', 'gear', '编辑工作区'),
    '<div class="cm-sep"></div>',
    item('section', 'grid', '分区', true),
    item('reveal', 'folder', '在资源管理器中打开'),
    '<div class="cm-sep"></div>',
    item('archive', 'inbox', '归档线程'),
    '<div class="cm-sep"></div>',
    item('remove', 'close', '移除工作区'),
  ].join('')
  document.body.appendChild(pop)
  const r = anchor.getBoundingClientRect()
  pop.style.left = `${Math.max(8, Math.min(window.innerWidth - 236, r.right + 8))}px`
  const ph = pop.offsetHeight
  pop.style.top = `${Math.max(8, Math.min(window.innerHeight - ph - 8, r.top - 8))}px`
  pop.querySelectorAll('[data-pjm]').forEach((button) => button.addEventListener('click', async (ev) => {
    ev.stopPropagation()
    const act = button.dataset.pjm
    if (act === 'section') { pop.remove(); openProjectSectionPicker(anchor, p); return }
    pop.remove()
    if (act === 'pin') return setProjectPinned(p, !p.pinned)
    if (act === 'edit') return openProjectEditCard(anchor, p.id)
    if (act === 'reveal') return revealProjectFolder(p)
    if (act === 'archive') return archiveProjectChats(p)
    if (act === 'remove') return confirmRemoveProject(p)
  }))
  setTimeout(() => document.addEventListener('click', function close(e) {
    if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', close) }
  }), 0)
}

function startProjectChat(p) {
  state.conversation = null
  state.chatSteps = []
  state.chatError = ''
  state.activeProjectId = p.id
  state.activeProjectName = p.name
  state.activeProjectCwd = p.cwd || ''
  state.view = 'home'
  state.draft = ''
  render()
  setTimeout(() => document.getElementById('draft')?.focus(), 60)
}

function openProjectRowMenu(anchor, id) {
  document.querySelectorAll('.prj-row-menu').forEach((pop) => pop.remove())
  const p = (state.projects || []).find((x) => x.id === id)
  if (!p) return
  const menu = document.createElement('div')
  menu.className = 'prj-row-menu'
  const item = (act, ic, label) => `<button class="prj-row-menu-item" data-prjm="${act}"><span class="ico">${icon(ic)}</span><span>${label}</span></button>`
  menu.innerHTML = [
    item('new', 'compose', '新建线程'),
    item('check', 'shield', '成果检查'),
    item('pin', 'pin', p.pinned ? '取消置顶项目' : '置顶项目'),
    item('edit', 'gear', '编辑工作区'),
    item('archive', 'inbox', '归档线程'),
    item('remove', 'close', '移除工作区'),
  ].join('')
  document.body.appendChild(menu)
  const r = anchor.getBoundingClientRect()
  const w = menu.offsetWidth || 200
  const h = menu.offsetHeight || 220
  menu.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 10, r.right - w))}px`
  menu.style.top = `${Math.max(8, Math.min(window.innerHeight - h - 8, r.bottom + 8))}px`
  menu.querySelectorAll('[data-prjm]').forEach((button) => button.addEventListener('click', async (ev) => {
    ev.stopPropagation()
    const act = button.dataset.prjm
    menu.remove()
    if (act === 'new') return startProjectChat(p)
    if (act === 'check') return openDeliverableCheck(p)
    if (act === 'pin') {
      await setProjectPinned(p, !p.pinned)
      return renderView()
    }
    if (act === 'edit') return openProjectEditCard(anchor, p.id)
    if (act === 'archive') return archiveProjectChats(p)
    if (act === 'remove') return confirmRemoveProject(p)
  }))
  setTimeout(() => document.addEventListener('pointerdown', function close(e) {
    if (!menu.contains(e.target)) {
      menu.remove()
      document.removeEventListener('pointerdown', close, true)
    }
  }, true), 0)
}

async function setProjectPinned(p, next) {
  const { ok, body } = await api('/api/projects/update', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: p.id, pinned: next }),
  })
  if (!ok || !body.item) return toast(body?.error || '置顶项目失败', true)
  Object.assign(p, body.item)
  const mirror = (state.projects || []).find((x) => x.id === p.id)
  if (mirror) Object.assign(mirror, body.item)
  renderSidebar()
  toast(p.pinned ? `已置顶项目「${p.name}」` : `已取消置顶项目「${p.name}」`)
}

function openProjectSectionPicker(anchor, p) {
  document.querySelectorAll('.conv-menu').forEach((pop) => pop.remove())
  const sections = state.projectSections || []
  const current = (state.projectSectionMap || {})[p.id] || ''
  const pop = document.createElement('div')
  pop.className = 'conv-menu'
  pop.innerHTML = `<div class="cm-head">项目分区</div>` +
    `<button class="cm-item" data-pjs=""><span class="ico">${icon('grid')}</span><span class="cm-label">无分区</span>${current ? '' : '<span class="cm-key">✓</span>'}</button>` +
    sections.map((section) => `<button class="cm-item" data-pjs="${esc(section.id)}"><span class="ico">${icon('folder')}</span><span class="cm-label">${esc(section.name)}</span>${current === section.id ? '<span class="cm-key">✓</span>' : ''}</button>`).join('') +
    `<div class="cm-sep"></div><button class="cm-item" data-pjs-new><span class="ico">${icon('plus')}</span><span class="cm-label">新建分区</span></button>`
  document.body.appendChild(pop)
  const r = anchor.getBoundingClientRect()
  pop.style.left = `${Math.max(8, Math.min(window.innerWidth - 236, r.right + 8))}px`
  const ph = pop.offsetHeight
  pop.style.top = `${Math.max(8, Math.min(window.innerHeight - ph - 8, r.top - 4))}px`
  const persist = () => {
    try {
      localStorage.setItem('jg.projectSections', JSON.stringify(state.projectSections || []))
      localStorage.setItem('jg.projectSectionMap', JSON.stringify(state.projectSectionMap || {}))
    } catch (e) { /* 本地不可写时只保留进程内状态 */ }
  }
  pop.querySelectorAll('[data-pjs]').forEach((button) => button.addEventListener('click', (ev) => {
    ev.stopPropagation()
    const id = button.dataset.pjs
    state.projectSectionMap = state.projectSectionMap || {}
    if (id) state.projectSectionMap[p.id] = id
    else delete state.projectSectionMap[p.id]
    persist()
    pop.remove()
    const name = sections.find((section) => section.id === id)?.name
    toast(name ? `已将「${p.name}」放入分区「${name}」` : `已清除「${p.name}」的项目分区`)
  }))
  pop.querySelector('[data-pjs-new]')?.addEventListener('click', (ev) => {
    ev.stopPropagation()
    pop.remove()
    const mask = openModal('新建项目分区', `
      <div class="form-note">分区只用于整理项目列表，不会移动本地目录或改动项目文件。</div>
      <div class="form-label">分区名称</div>
      <input class="text-input" id="pjsName" placeholder="例如：在办项目" autocomplete="off" />
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
        <button class="btn" data-cancel>取消</button><button class="btn primary" data-ok>新建并放入</button>
      </div>`)
    mask.querySelector('[data-cancel]')?.addEventListener('click', () => mask.remove())
    mask.querySelector('[data-ok]')?.addEventListener('click', () => {
      const name = mask.querySelector('#pjsName')?.value.trim()
      if (!name) return toast('请填写分区名称', true)
      const section = { id: `PSEC-${Date.now()}`, name }
      state.projectSections = [...(state.projectSections || []), section]
      state.projectSectionMap = { ...(state.projectSectionMap || {}), [p.id]: section.id }
      persist()
      mask.remove()
      toast(`已新建分区「${name}」并放入「${p.name}」`)
    })
  })
  setTimeout(() => document.addEventListener('click', function close(e) {
    if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', close) }
  }), 0)
}

async function revealProjectFolder(p) {
  if (!p?.cwd) return toast('该项目尚未绑定本地文件夹', true)
  if (!window.jgClient?.revealPath) return toast('当前环境不支持打开本地文件夹', true)
  const result = await window.jgClient.revealPath(p.cwd).catch(() => null)
  if (!result?.ok) return toast(result?.error || '打开文件夹失败', true)
}

function persistArchivedConvs() {
  try { localStorage.setItem('jg.archivedConvs', JSON.stringify(state.archivedConvs || [])) } catch (e) { /* 本地不可写时只保留进程内状态 */ }
}

function persistSidebarMeta() {
  try {
    localStorage.setItem('jg.pinnedConvs', JSON.stringify(state.pinnedConvs || []))
    localStorage.setItem('jg.archivedConvs', JSON.stringify(state.archivedConvs || []))
    localStorage.setItem('jg.lockedConvs', JSON.stringify(state.lockedConvs || []))
    localStorage.setItem('jg.convSections', JSON.stringify(state.convSections || {}))
    localStorage.setItem('jg.sidebarSections', JSON.stringify(state.sidebarSections || []))
  } catch (e) { /* 本地不可写时只保留进程内状态 */ }
}

function toggleLockedConversation(id) {
  const conv = (state.conversations || []).find((c) => c.id === id)
  if (!conv) return
  const set = new Set(state.lockedConvs || [])
  const wasLocked = set.has(id)
  if (wasLocked) set.delete(id)
  else set.add(id)
  state.lockedConvs = [...set]
  persistSidebarMeta()
  renderSidebar()
  toast(wasLocked ? `已取消锁定「${conv.title}」` : `已锁定「${conv.title}」，删除前需要先解锁`)
}

function archiveConversation(id) {
  const conv = (state.conversations || []).find((c) => c.id === id)
  if (!conv) return
  state.archivedConvs = [...new Set([...(state.archivedConvs || []), id])]
  persistSidebarMeta()
  if (state.conversation?.id === id) {
    state.conversation = null
    state.chatSteps = []
  }
  renderSidebar()
  toast(`已归档「${conv.title}」`)
}

function openConversationSectionPicker(anchor, id) {
  document.querySelectorAll('.conv-menu').forEach((p) => p.remove())
  const conv = (state.conversations || []).find((c) => c.id === id)
  if (!conv) return
  const current = (state.convSections || {})[id] || ''
  const pop = document.createElement('div')
  pop.className = 'conv-menu recent-pop'
  pop.innerHTML = `<div class="cm-head">把会话归入分区</div>
    <button class="cm-item" data-cs=""><span class="ico">${icon('list')}</span><span class="cm-label">无分区</span>${current ? '' : '<span class="cm-key">✓</span>'}</button>` +
    (state.sidebarSections || []).map((sec) => `<button class="cm-item" data-cs="${esc(sec.id)}"><span class="ico">${icon('grid')}</span><span class="cm-label">${esc(sec.name)}</span>${current === sec.id ? '<span class="cm-key">✓</span>' : ''}</button>`).join('') +
    `<div class="cm-sep"></div><button class="cm-item" data-cs-new><span class="ico">${icon('plus')}</span><span class="cm-label">新建分区</span></button>`
  document.body.appendChild(pop)
  const r = anchor.getBoundingClientRect()
  pop.style.left = `${Math.max(64, Math.min(window.innerWidth - 236, r.right + 8))}px`
  const ph = pop.offsetHeight
  const top = r.bottom + 6 + ph > window.innerHeight - 8 ? Math.max(8, r.top - 6 - ph) : r.bottom + 6
  pop.style.top = `${Math.max(8, Math.min(window.innerHeight - ph - 8, top))}px`
  const assign = (sectionId) => {
    state.convSections = { ...(state.convSections || {}) }
    if (sectionId) state.convSections[id] = sectionId
    else delete state.convSections[id]
    persistSidebarMeta()
    pop.remove()
    renderSidebar()
    toast(sectionId ? `已把「${conv.title}」放入分区` : `已把「${conv.title}」移出分区`)
  }
  pop.querySelectorAll('[data-cs]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation()
    assign(b.dataset.cs)
  }))
  pop.querySelector('[data-cs-new]')?.addEventListener('click', (ev) => {
    ev.stopPropagation()
    pop.remove()
    openSectionForm((newId) => {
      if (newId) assign(newId)
    })
  })
  setTimeout(() => document.addEventListener('click', function close(e) {
    if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', close) }
  }), 0)
}

function archiveProjectChats(p) {
  const ids = (state.conversations || []).filter((c) => c.projectId === p.id).map((c) => c.id)
  if (!ids.length) return toast('该项目暂无聊天记录', true)
  state.archivedConvs = [...new Set([...(state.archivedConvs || []), ...ids])]
  persistArchivedConvs()
  renderSidebar()
  toast(`已归档「${p.name}」下的 ${ids.length} 条聊天`)
}

function confirmRemoveProject(p) {
  const mask = openModal('移除工作区', `
    <div class="notice">只移除平台记录，不会删除本地文件夹、文件或线程历史。工作区下的线程会转为普通聊天。</div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
      <button class="btn" data-cancel>取消</button><button class="btn" style="color:var(--danger)" data-ok>移除工作区</button>
    </div>`)
  mask.querySelector('[data-cancel]')?.addEventListener('click', () => mask.remove())
  mask.querySelector('[data-ok]')?.addEventListener('click', async () => {
    const { ok, body } = await api('/api/projects/remove', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: p.id }),
    })
    if (!ok) return toast(body?.error || '移除失败', true)
    mask.remove()
    if (state.activeProjectId === p.id) {
      state.activeProjectId = ''
      state.activeProjectName = ''
      state.activeProjectCwd = ''
    }
    state.projects = (state.projects || []).filter((x) => x.id !== p.id)
    state.sidebarProjects = (state.sidebarProjects || []).filter((x) => x.id !== p.id)
    if (state.projectSectionMap) delete state.projectSectionMap[p.id]
    try { localStorage.setItem('jg.projectSectionMap', JSON.stringify(state.projectSectionMap || {})) } catch (e) { /* 本地不可写时只保留进程内状态 */ }
    render()
    renderSidebar()
    toast('工作区记录已移除，本地文件未删除')
  })
}

function scheduleProjectCardClose() {
  clearTimeout(__projCardTimer)
  __projCardTimer = setTimeout(() => {
    const card = document.querySelector('.proj-card')
    if (card && !card.matches(':hover')) card.remove()
  }, 200)
}
function projPath(p) {
  return `D:\\JGharness\\projects\\${p.id}`
}
function openProjectCard(anchor) {
  clearTimeout(__projCardTimer)
  if (!anchor) return
  const existing = document.querySelector('.proj-card')
  if (existing && existing.dataset.pid === anchor.dataset.project) return
  existing?.remove()
  const p = (state.sidebarProjects || []).find((x) => x.id === anchor.dataset.project)
  if (!p) return
  const waiting = (p.waiting || 0)
  const card = document.createElement('div')
  card.className = 'proj-card'
  card.dataset.pid = p.id
  card.innerHTML = `
    <div class="pc-head">
      <span class="ico">${icon('folder')}</span>
      <span class="pc-name">${esc(p.name)}</span>
      <span class="spacer"></span>
      <button class="pc-pin" title="${p.pinned ? '取消置顶' : '置顶项目'}">${icon('pin')}</button>
    </div>
    <div class="pc-meta"><span class="ico">${icon('chat')}</span>${p.convs || 0} 次聊天 · ${waiting} 个等待中</div>
    <div class="pc-sep"></div>
    <div class="pc-path"><span class="ico">${icon('folder')}</span><span class="mono">${esc(projPath(p))}</span></div>
    <button class="pc-item" data-pcedit="${p.id}"><span class="ico">${icon('gear')}</span>编辑项目</button>`
  document.body.appendChild(card)
  const r = anchor.getBoundingClientRect()
  const w = 304
  card.style.left = `${Math.min(window.innerWidth - w - 12, r.right + 10)}px`
  card.style.top = `${Math.max(46, r.top - 4)}px`
  card.addEventListener('mouseenter', () => clearTimeout(__projCardTimer))
  card.addEventListener('mouseleave', () => scheduleProjectCardClose())
  card.querySelector('.pc-pin')?.addEventListener('click', async (ev) => {
    ev.stopPropagation()
    const button = ev.currentTarget
    if (button.disabled) return
    button.disabled = true
    const next = !p.pinned
    const { ok, body } = await api('/api/projects/update', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: p.id, pinned: next }),
    })
    if (!ok || !body.item) {
      button.disabled = false
      return toast(body?.error || '置顶项目失败', true)
    }
    Object.assign(p, body.item)
    const mirror = (state.projects || []).find((x) => x.id === p.id)
    if (mirror) Object.assign(mirror, body.item)
    card.remove()
    renderSidebar()
    toast(p.pinned ? `已置顶项目「${p.name}」` : `已取消置顶项目「${p.name}」`)
  })
  card.querySelector('[data-pcedit]')?.addEventListener('click', (ev) => {
    ev.stopPropagation()
    card.remove()
    openProjectEditCard(anchor, p.id)
  })
}

function openProjectEditCard(anchor, id) {
  const p = (state.sidebarProjects || []).find((x) => x.id === id) || (state.projects || []).find((x) => x.id === id)
  if (!p) return
  document.querySelectorAll('.proj-card').forEach((c) => c.remove())
  const hasBridge = Boolean(window.jgClient && window.jgClient.chooseFolder)
  let draftCwd = p.cwd || ''
  const nameOf = (path) => {
    if (!path) return ''
    if (path === p.cwd && p.folderName) return p.folderName
    return String(path).replace(/[\\/]+$/, '').split(/[\\/]/).pop()
  }
  const mask = openModal('编辑工作区', `
    <div style="padding:2px 4px 0">
      <div style="display:flex;align-items:center;height:54px;border:1.5px solid var(--accent);border-radius:13px;background:#fff;overflow:hidden">
        <span style="width:52px;display:grid;place-items:center;color:var(--text)"><span class="ico" style="width:22px;height:22px">${icon('folder')}</span></span>
        <span style="width:1px;height:24px;background:#dcdfe4"></span>
        <input id="pceName" value="${esc(p.name)}" placeholder="工作区名称" style="flex:1;min-width:0;border:0;outline:0;background:transparent;height:52px;padding:0 16px;font:inherit;font-size:var(--fs-sub);color:var(--text)" />
      </div>

      <div style="margin:22px 0 10px;font-size:var(--fs-sub);font-weight:var(--fw-semi);color:var(--text)">本地文件夹</div>
      <div style="border:1px solid #e6e8ec;border-radius:14px;background:#fff;overflow:hidden">
        <div id="pceFolders"></div>
        <div id="pceAddWrap" style="display:none;padding:10px 16px 12px;border-top:1px solid #eceef1">
          <input id="pcePathInput" placeholder="输入本地文件夹绝对路径后按 Enter" style="width:100%;box-sizing:border-box;border:1px solid #dfe3e8;border-radius:10px;padding:10px 12px;outline:none;font:inherit;font-size:var(--fs-meta);color:var(--text);background:#fff" />
        </div>
        <button id="pceAddFolder" type="button" style="display:flex;align-items:center;gap:14px;width:100%;border:0;border-top:1px solid #eceef1;background:#fff;padding:16px 18px;font:inherit;font-size:var(--fs-sub);color:var(--text);text-align:left;cursor:pointer">
          <span class="ico" style="width:22px;height:22px;color:var(--muted)">${icon('folder')}</span>添加文件夹
        </button>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:26px;padding-bottom:2px">
        <button id="pceRemove" type="button" style="border:0;border-radius:10px;background:#fdeaea;color:#c0392b;padding:12px 18px;font:inherit;font-size:var(--fs-sub);cursor:pointer">移除工作区</button>
        <div style="display:flex;align-items:center;gap:8px">
          <button class="btn" id="pceCancel" style="border:0;background:transparent;color:var(--muted)">取消</button>
          <button class="btn primary" id="pceSave" style="min-width:96px">保存</button>
        </div>
      </div>
    </div>`)
  const modal = mask.querySelector('.jg-modal')
  if (modal) {
    modal.style.width = 'min(620px, calc(100vw - 44px))'
    modal.style.maxHeight = 'calc(100vh - 44px)'
    modal.style.borderRadius = '20px'
  }
  const title = mask.querySelector('.jg-modal-title')
  if (title) Object.assign(title.style, { fontSize: '26px', fontWeight: '700', letterSpacing: '-.2px' })
  const closeBtn = mask.querySelector('[data-mclose]')
  if (closeBtn) Object.assign(closeBtn.style, { border: '0', background: 'transparent', boxShadow: 'none', color: '#8b929c', width: '34px', height: '34px', padding: '0', display: 'grid', placeItems: 'center' })
  const saveBtnEl = mask.querySelector('#pceSave')
  if (saveBtnEl) {
    saveBtnEl.style.setProperty('background', '#1b1d21', 'important')
    saveBtnEl.style.setProperty('color', '#fff', 'important')
    saveBtnEl.style.setProperty('border-color', '#1b1d21', 'important')
    saveBtnEl.style.setProperty('border-radius', '10px', 'important')
    saveBtnEl.style.setProperty('height', '42px', 'important')
  }

  const foldersBox = mask.querySelector('#pceFolders')
  const addWrap = mask.querySelector('#pceAddWrap')
  const pathInput = mask.querySelector('#pcePathInput')
  const renderFolders = () => {
    foldersBox.innerHTML = draftCwd
      ? `<div style="display:flex;align-items:center;gap:14px;padding:15px 16px 15px 18px">
          <span class="ico" style="width:22px;height:22px;color:var(--muted);flex:none">${icon('folder')}</span>
          <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--fs-sub);color:var(--text)">${esc(nameOf(draftCwd))}</span>
          <button data-fdel type="button" title="移除文件夹" style="border:0;background:transparent;display:grid;place-items:center;width:26px;height:26px;color:var(--muted);cursor:pointer"><span class="ico" style="width:18px;height:18px">${icon('close')}</span></button>
        </div>`
      : `<div style="padding:16px 18px;font-size:var(--fs-meta);color:var(--muted)">尚未选择本地文件夹</div>`
    foldersBox.querySelector('[data-fdel]')?.addEventListener('click', () => {
      draftCwd = ''
      renderFolders()
    })
  }
  renderFolders()

  const chooseFolder = async () => {
    if (!hasBridge) {
      addWrap.style.display = 'block'
      pathInput.focus()
      return
    }
    try {
      const result = await window.jgClient.chooseFolder({ title: '选择项目文件夹' })
      if (!result.canceled && result.path) {
        draftCwd = result.path
        addWrap.style.display = 'none'
        renderFolders()
      }
    } catch (error) {
      toast(error?.message || '打开文件夹选择器失败', true)
    }
  }
  mask.querySelector('#pceAddFolder')?.addEventListener('click', chooseFolder)
  pathInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const value = pathInput.value.trim()
    if (!value) return
    draftCwd = value
    pathInput.value = ''
    addWrap.style.display = 'none'
    renderFolders()
  })

  mask.querySelector('#pceCancel')?.addEventListener('click', () => mask.remove())
  mask.querySelector('#pceSave')?.addEventListener('click', async () => {
    const name = mask.querySelector('#pceName').value.trim()
    if (!name) return toast('工作区名称不能为空', true)
    const payload = { id: p.id, name, desc: p.desc || '', instructions: p.instructions || '' }
    if (draftCwd !== (p.cwd || '')) payload.cwd = draftCwd
    const saveBtn = mask.querySelector('#pceSave')
    saveBtn.disabled = true
    const { ok, body } = await api('/api/projects/update', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    saveBtn.disabled = false
    if (!ok) return toast(body.error || '保存失败', true)
    const item = body.item || { ...p, name, cwd: draftCwd, folderName: nameOf(draftCwd) }
    state.sidebarProjects = (state.sidebarProjects || []).map((x) => (x.id === p.id ? item : x))
    state.projects = (state.projects || []).map((x) => (x.id === p.id ? item : x))
    if (state.activeProjectId === p.id) {
      state.activeProjectName = item.name
      state.activeProjectCwd = item.cwd || ''
    }
    mask.remove()
    render()
    toast('工作区已更新')
  })

  let removeArmed = false
  const removeBtn = mask.querySelector('#pceRemove')
  removeBtn.addEventListener('click', async () => {
    if (!removeArmed) {
      removeArmed = true
      removeBtn.textContent = '再次点击确认移除'
      removeBtn.style.background = '#f8d7d7'
      toast('仅移除工作区记录，不删除本地文件与线程历史')
      return
    }
    removeBtn.disabled = true
    const { ok, body } = await api('/api/projects/remove', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: p.id }),
    })
    removeBtn.disabled = false
    if (!ok) return toast(body.error || '移除失败', true)
    mask.remove()
    if (state.activeProjectId === p.id) {
      state.activeProjectId = ''
      state.activeProjectName = ''
      state.activeProjectCwd = ''
    }
    state.projects = (state.projects || []).filter((x) => x.id !== p.id)
    state.sidebarProjects = (state.sidebarProjects || []).filter((x) => x.id !== p.id)
    render()
    toast('工作区记录已移除，本地文件未删除')
  })

  setTimeout(() => mask.querySelector('#pceName')?.focus(), 30)
}

function openProjectDisplayMenu(anchor) {
  document.querySelectorAll('.conv-menu').forEach((p) => p.remove())
  const pop = document.createElement('div')
  pop.className = 'conv-menu proj-menu'
  pop.innerHTML = `
    <button class="cm-item" data-pm="arrange"><span class="ico">${icon('layers')}</span><span class="cm-label">整理侧边栏</span><span class="cm-arrow">›</span></button>
    <button class="cm-item" data-pm="order"><span class="ico">${icon('sort')}</span><span class="cm-label">聊天排序方式</span><span class="cm-arrow">›</span></button>
    <div class="cm-sep"></div>
    <button class="cm-item" data-pm="split"><span class="ico">${icon('folder')}</span><span class="cm-label">分项目显示</span>${state.projMerge ? '' : '<span class="cm-key">✓</span>'}</button>
    <button class="cm-item" data-pm="merge"><span class="ico">${icon('list')}</span><span class="cm-label">合并显示</span>${state.projMerge ? '<span class="cm-key">✓</span>' : ''}</button>`
  document.body.appendChild(pop)
  const r = anchor.getBoundingClientRect()
  pop.style.left = `${Math.max(8, Math.min(window.innerWidth - 240, r.right - 210))}px`
  const ph = pop.offsetHeight
  pop.style.top = `${Math.max(8, Math.min(window.innerHeight - ph - 8, r.bottom + 6))}px`
  pop.querySelectorAll('[data-pm]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation()
    if (b.disabled) return
    const act = b.dataset.pm
    pop.remove()
    if (act === 'arrange') return openArrangeSidebar()
    if (act === 'order') return openRecentSortMenu(anchor)
    if (act === 'split') { state.projMerge = false; renderSidebar() }
    else if (act === 'merge') { state.projMerge = true; renderSidebar() }
  }))
  setTimeout(() => document.addEventListener('click', function close(e) {
    if (!pop.contains(e.target)) { pop.remove(); window.__plusPop = null; document.removeEventListener('click', close) }
  }), 0)
}

function closeSideMenus() {
  document.querySelectorAll('.recent-pop').forEach((p) => p.remove())
}

function openRecentHeadMenu(anchor) {
  closeSideMenus()
  const pop = document.createElement('div')
  pop.className = 'conv-menu proj-menu recent-pop'
  pop.innerHTML = `
    <button class="cm-item" data-rh="arrange"><span class="ico">${icon('layers')}</span><span class="cm-label">整理侧边栏</span><span class="cm-arrow">›</span></button>
    <button class="cm-item" data-rh="order"><span class="ico">${icon('sort')}</span><span class="cm-label">聊天排序方式</span><span class="cm-arrow">›</span></button>
    <div class="cm-sep"></div>
    <div class="cm-label-dim">显示</div>
    <button class="cm-item" data-rh="projects"><span class="ico">${icon('folder')}</span><span class="cm-label">项目</span>${state.showProjects ? '<span class="cm-key">✓</span>' : ''}</button>
    <div class="cm-sep"></div>
    <button class="cm-item" data-rh="section"><span class="ico">${icon('plus')}</span><span class="cm-label">新建分区</span></button>
    <div class="cm-sep"></div>
    <button class="cm-item" data-rh="clear" style="color:#b3282d"><span class="ico" style="color:#b3282d">${icon('trash')}</span><span class="cm-label">清空最近对话</span></button>`
  document.body.appendChild(pop)
  const r = anchor.getBoundingClientRect()
  pop.style.left = `${Math.max(64, Math.min(window.innerWidth - 240, r.right - 208))}px`
  const ph = pop.offsetHeight
  const top = r.bottom + 6 + ph > window.innerHeight - 8 ? Math.max(46, r.top - 6 - ph) : r.bottom + 6
  pop.style.top = `${top}px`
  pop.querySelectorAll('[data-rh]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation()
    const act = b.dataset.rh
    pop.remove()
    if (act === 'arrange') openArrangeSidebar()
    else if (act === 'order') openRecentSortMenu(anchor)
    else if (act === 'projects') { state.showProjects = !state.showProjects; renderSidebar() }
    else if (act === 'section') openSectionForm()
    else if (act === 'clear') openClearRecentConversations()
  }))
  setTimeout(() => document.addEventListener('click', function close(e) {
    if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', close) }
  }), 0)
}

function openRecentSortMenu(anchor) {
  closeSideMenus()
  const pop = document.createElement('div')
  pop.className = 'conv-menu recent-pop'
  const opt = (k, label) => `<button class="cm-item" data-rs="${k}"><span class="cm-label">${label}</span>${state.recentSort === k ? '<span class="cm-key">✓</span>' : ''}</button>`
  pop.innerHTML = opt('recent', '最近优先') + opt('old', '最早优先') + opt('name', '按名称 A–Z')
  document.body.appendChild(pop)
  const r = anchor.getBoundingClientRect()
  pop.style.left = `${Math.max(72, Math.min(window.innerWidth - 220, r.left + 40))}px`
  const ph = pop.offsetHeight
  const top = r.bottom + 6 + ph > window.innerHeight - 8 ? Math.max(46, r.top - 6 - ph) : r.bottom + 6
  pop.style.top = `${top}px`
  pop.querySelectorAll('[data-rs]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation()
    state.recentSort = b.dataset.rs
    pop.remove()
    renderSidebar()
  }))
  setTimeout(() => document.addEventListener('click', function close(e) {
    if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', close) }
  }), 0)
}

function openRecentFilterMenu(anchor) {
  closeSideMenus()
  const pop = document.createElement('div')
  pop.className = 'conv-menu recent-pop'
  const opt = (k, label) => `<button class="cm-item" data-rf="${k}"><span class="cm-label">${label}</span>${state.recentFilter === k ? '<span class="cm-key">✓</span>' : ''}</button>`
  pop.innerHTML = opt('all', '全部') + opt('chat', '聊天') + opt('work', '工作')
  document.body.appendChild(pop)
  const r = anchor.getBoundingClientRect()
  pop.style.left = `${Math.max(72, Math.min(window.innerWidth - 220, r.right - 150))}px`
  const ph = pop.offsetHeight
  const top = r.bottom + 6 + ph > window.innerHeight - 8 ? Math.max(46, r.top - 6 - ph) : r.bottom + 6
  pop.style.top = `${top}px`
  pop.querySelectorAll('[data-rf]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation()
    state.recentFilter = b.dataset.rf
    pop.remove()
    renderSidebar()
    toast({ all: '最近：全部会话', chat: '最近：只看聊天', work: '最近：只看工作会话' }[b.dataset.rf])
  }))
  setTimeout(() => document.addEventListener('click', function close(e) {
    if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', close) }
  }), 0)
}

function openArrangeSidebar() {
  const convs = state.conversations || []
  const mask = openModal('整理侧边栏', `
    <div class="form-note">逐条确认要保留的会话，取消勾选的会被收进归档；归档后不再出现在「最近」。</div>
    <div class="arr-list">
      ${convs.map((c) => `<label class="arr-row"><input type="checkbox" data-keep="${c.id}" checked /><span class="arr-txt">${esc(c.title)}</span><span class="mono arr-time">${esc(c.time || '')}</span></label>`).join('')}
    </div>
    <div class="form-foot"><span class="mono">共 ${convs.length} 条会话</span><span class="spacer"></span><button class="btn" data-mclose>取消</button><button class="btn primary" id="arrOk">完成整理</button></div>`)
  mask.querySelector('[data-mclose]').addEventListener('click', () => mask.remove())
  mask.querySelector('#arrOk').addEventListener('click', () => {
    const all = new Set(convs.map((c) => c.id))
    const keep = new Set([...mask.querySelectorAll('[data-keep]')].filter((x) => x.checked).map((x) => x.dataset.keep))
    state.archivedConvs = [...all].filter((id) => !keep.has(id))
    persistArchivedConvs()
    mask.remove()
    renderSidebar()
    toast(state.archivedConvs.length ? `已归档 ${state.archivedConvs.length} 条会话` : '已保留全部会话')
  })
}

function openClearRecentConversations() {
  if (state.chatBusy) return toast('当前有对话正在生成，请先停止后再清空', true)
  const clearList = recentConversations().filter((c) => !c.projectId && !(state.lockedConvs || []).includes(c.id))
  if (!clearList.length) return toast('最近没有可清空的对话；项目下的对话会始终保留')
  const ids = clearList.map((c) => c.id)
  const mask = openModal('清空最近对话', `
    <div class="form-note">将删除最近列表中的 <b>${ids.length}</b> 条对话。项目下的对话、项目文件、项目目录和审计记录不受影响；此操作不可撤销。</div>
    <div class="form-foot"><span class="spacer"></span><button class="btn danger" id="clearAllOk">确认清空</button></div>`)
  const okBtn = mask.querySelector('#clearAllOk')
  okBtn.addEventListener('click', async () => {
    if (okBtn.disabled) return
    okBtn.disabled = true
    const { ok, body } = await api('/api/conversation/clear', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ confirm: true, ids }),
    })
    if (!ok) {
      okBtn.disabled = false
      return toast(body?.error || '清空失败', true)
    }
    const idSet = new Set(ids)
    const activeCleared = Boolean(state.conversation && idSet.has(state.conversation.id))
    state.conversations = (state.conversations || []).filter((c) => !idSet.has(c.id))
    if (activeCleared) {
      state.conversation = null
      state.chatSteps = []
      state.chatError = ''
      state.pendingConfirm = null
      state.pendingInteraction = null
      state.view = 'home'
    }
    // 置顶、分区、归档与锁定元数据不因“清空最近”而整体重置；它们可能仍有会话保留。
    mask.remove()
    render()
    toast(`已清空 ${body?.removed ?? ids.length} 条最近对话，项目对话已保留`)
  })
}

function openSectionForm(onCreated) {
  const mask = openModal('新建分区', `
    <div class="form-note">分区用于把同一类会话归在一起，例如“投标”“城市体检”。分区内可再拖入或移入会话。</div>
    <div class="form-label">分区名称</div>
    <input class="text-input" id="secName" placeholder="例如：投标资料" />
    <div class="form-foot"><span class="spacer"></span><button class="btn" data-mclose>取消</button><button class="btn primary" id="secOk">新建</button></div>`)
  mask.querySelector('[data-mclose]').addEventListener('click', () => mask.remove())
  mask.querySelector('#secName').focus()
  mask.querySelector('#secOk').addEventListener('click', () => {
    const name = mask.querySelector('#secName').value.trim()
    if (!name) return toast('请填写分区名称', true)
    const sec = { id: 'SEC-' + Date.now(), name }
    state.sidebarSections = [...(state.sidebarSections || []), sec]
    persistSidebarMeta()
    mask.remove()
    if (onCreated) onCreated(sec.id)
    renderSidebar()
    toast(`已新建分区「${name}」`)
  })
}

function openSectionMenu(anchor, id) {
  closeSideMenus()
  const sec = (state.sidebarSections || []).find((x) => x.id === id)
  if (!sec) return
  const pop = document.createElement('div')
  pop.className = 'conv-menu recent-pop'
  pop.innerHTML = `<button class="cm-item" data-sm="rename"><span class="cm-label">重命名</span></button><button class="cm-item" data-sm="del"><span class="cm-label">删除分区</span></button>`
  document.body.appendChild(pop)
  const r = anchor.getBoundingClientRect()
  pop.style.left = `${Math.max(64, Math.min(window.innerWidth - 210, r.right - 170))}px`
  const ph = pop.offsetHeight
  const top = r.bottom + 6 + ph > window.innerHeight - 8 ? Math.max(46, r.top - 6 - ph) : r.bottom + 6
  pop.style.top = `${top}px`
  pop.querySelectorAll('[data-sm]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation()
    const act = b.dataset.sm
    pop.remove()
    if (act === 'del') {
      state.sidebarSections = state.sidebarSections.filter((x) => x.id !== id)
      state.convSections = Object.fromEntries(Object.entries(state.convSections || {}).filter(([, sid]) => sid !== id))
      persistSidebarMeta()
      renderSidebar(); toast('已删除分区')
    } else {
      const mask = openModal('重命名分区', `<div class="form-label">分区名称</div><input class="text-input" id="secRename" value="${esc(sec.name)}" />
        <div class="form-foot"><span class="spacer"></span><button class="btn" data-mclose>取消</button><button class="btn primary" id="secRenOk">保存</button></div>`)
      mask.querySelector('[data-mclose]').addEventListener('click', () => mask.remove())
      mask.querySelector('#secRenOk').addEventListener('click', () => {
        const v = mask.querySelector('#secRename').value.trim()
        if (!v) return toast('请填写名称', true)
        sec.name = v
        persistSidebarMeta()
        mask.remove(); renderSidebar(); toast('已重命名')
      })
    }
  }))
  setTimeout(() => document.addEventListener('click', function close(e) {
    if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', close) }
  }), 0)
}

function recentConversations() {
  const convs = (state.conversations || []).filter((c) => !(state.archivedConvs || []).includes(c.id))
  const pinnedIds = state.pinnedConvs || []
  const sectionOf = state.convSections || {}
  const projects = state.sidebarProjects || []
  const projIds = new Set(projects.map((p) => p.id))
  let recent = convs.filter((c) => !pinnedIds.includes(c.id))
  // 已挂在项目列表里的会话不在「最近」重复出现；项目行收起时仍保留入口。
  if (!state.projMerge) recent = recent.filter((c) => !projIds.has(c.projectId))
  // 已归入分区的会话只显示在分区里，不再在「最近」重复出现。
  recent = recent.filter((c) => !sectionOf[c.id])
  if (state.recentFilter === 'work') recent = recent.filter((c) => c.kind === 'work' || (!c.kind && c.workspace))
  if (state.recentFilter === 'chat') recent = recent.filter((c) => c.kind === 'chat')
  if (state.recentSort === 'old') recent = recent.slice().reverse()
  else if (state.recentSort === 'name') recent = recent.slice().sort((x, y) => String(x.title).localeCompare(String(y.title), 'zh'))
  return recent
}

let homeSidebarCacheHtml = ''
function renderSidebar() {
  const { user } = state.boot
  const sidebar = document.getElementById('sidebar')
  sidebar.classList.remove('tk-sidebar', 'fly', 'hidden')
  if (!hasSidebarView()) {
    layout.clearSidebar()
    return
  }
  // 非工作区页面由 AppLayout 在页面渲染完成后挂载模块提供的侧栏内容。
  if (!['home', 'chat'].includes(state.view)) {
    sidebar.innerHTML = `<div class="layout-sidebar-placeholder" aria-busy="true">
      <div class="layout-sidebar-placeholder-title">${esc(pageLayout().sidebarTitle || '')}</div>
      <div class="layout-sidebar-placeholder-note">正在加载模块侧边栏…</div>
    </div>`
    return
  }

  const convs = (state.conversations || []).filter((c) => !(state.archivedConvs || []).includes(c.id))
  const pinnedIds = state.pinnedConvs || []
  const sectionOf = state.convSections || {}
  const pins = convs.filter((c) => pinnedIds.includes(c.id))
  const projects = state.sidebarProjects || []
  const projIds = new Set(projects.map((p) => p.id))
  const recent = recentConversations()

  const convRow = (c, pin, extra = '') => {
    const locked = (state.lockedConvs || []).includes(c.id)
    return `<div class="sb-item${pin ? ' has-pin' : ''}${locked ? ' locked' : ''}${extra}" data-conv="${c.id}">
      <button class="sb-row${pin ? ' pin' : ''}" title="${esc(c.title)}${locked ? '（已锁定）' : ''}">
        <span class="sb-row-txt">${esc(c.title)}</span>
      </button>
      ${pin ? `<button class="sb-pin" data-unpin="${c.id}" title="取消置顶"><span class="ico">${icon('pin')}</span></button>` : ''}
      <button class="sb-morebtn" data-convmenu="${c.id}" title="更多操作"><span class="ico">${icon('dots')}</span></button>
    </div>`
  }

  const projConvs = (p) => convs.filter((c) => c.projectId === p.id)

  const projRow = (p) => `<div class="sb-projrow">
      <button class="sb-row sb-proj" data-project="${p.id}" title="${esc(p.cwd || p.name)}">
        <span class="ico sb-row-ico">${icon('folder')}</span><span class="sb-row-txt">${esc(p.name)}</span>
      </button>
      <div class="sb-projacts">
        <button class="sb-morebtn" data-projmenu2="${p.id}" title="更多项目操作"><span class="ico">${icon('dots')}</span></button>
      </div>
    </div>`

  sidebar.innerHTML = `
    <div class="brand">
      <button class="brand-name" id="brandMenu" title="九规智能中枢">九规智能中枢</button>
      <div class="brand-icons">
        <button class="brand-icon" id="sbSearch" title="搜索（Ctrl+K）"><span class="ico">${icon('search')}</span></button>
        <button class="brand-icon" id="notifyTrigger" title="通知中心"><span class="ico">${icon('bell')}</span></button>
      </div>
    </div>
    <div class="sb-top-actions">
      <button class="sb-new" id="sbNew" title="开始全新对话：不继承当前项目、上下文与执行策略"><span class="ico">${icon('pen')}</span>新聊天</button>
      <div class="sb-divider"></div>
    </div>
    <div class="sidebar-scroll">
      <div class="sb-label sb-section-head">置顶</div>
      ${pins.map((c) => convRow(c, true)).join('') || '<div class="sb-empty">暂无置顶会话</div>'}
      ${state.showProjects ? `<div class="sb-label sb-label-row"><span>工作区</span>
        <button class="sb-collapse" id="projNew" title="新建工作区"><span class="ico">${icon('plus')}</span></button>
        <button class="sb-collapse" id="projMore" title="工作区显示设置"><span class="ico">${icon('dots')}</span></button>
      </div>
      <div class="sb-projects${state.projMerge ? ' merged' : ''}">
        ${projects.map((p) => {
          const kids = projConvs(p)
          if (state.projMerge) return projRow(p)
          return `${projRow(p)}
            <div class="sb-sub" style="${state.projFolds?.[p.id] ? 'display:none' : ''}">
              ${kids.length ? kids.map((c) => convRow(c, false, ' sub')).join('') : '<div class="sb-empty sub">暂无聊天</div>'}
            </div>`
        }).join('') || '<div class="sb-empty">暂无项目</div>'}
      </div>` : ''}
      ${(state.sidebarSections || []).map((sec) => {
        const kids = convs.filter((c) => sectionOf[c.id] === sec.id && !pins.includes(c))
        return `<div class="sb-label sb-label-row sb-sec-head"><span>${esc(sec.name)}</span>
        <button class="sb-collapse" data-secmenu="${sec.id}" title="分区菜单"><span class="ico">${icon('dots')}</span></button></div>
        <div class="sb-recent">${kids.length ? kids.map((c) => convRow(c, false, ' sub')).join('') : '<div class="sb-empty sub">暂无聊天</div>'}</div>`
      }).join('')}
      <div class="sb-label sb-label-row sb-recent-head"><span>最近</span>
        <button class="sb-collapse" id="recentToggle" title="收起最近"><span class="ico">${icon('chevron')}</span></button>
        <div class="sb-head-acts">
          <button class="sb-collapse" id="recentMore" title="更多"><span class="ico">${icon('dots')}</span></button>
          <button class="sb-collapse" id="recentFilter" title="筛选"><span class="ico">${icon('filter')}</span></button>
          <button class="sb-collapse sb-quicknew" id="recentNew" title="开始全新对话：不继承当前项目、上下文与执行策略"><span class="ico">${icon('pen')}</span></button>
        </div>
      </div>
      <div class="sb-recent${state.recentCollapsed ? ' folded' : ''}" id="recentList">
        ${recent.map((c) => convRow(c, false)).join('')}
      </div>
    </div>
  </div>
  <div class="pane-grip" id="sbGrip" title="拖动调整左右宽度 · 双击复位"></div>`

  document.getElementById('notifyTrigger')?.addEventListener('click', (ev) => { ev.stopPropagation(); openNotifications(ev.currentTarget) })
  document.getElementById('sbSearch')?.addEventListener('click', (ev) => { ev.stopPropagation(); openSearchPalette() })
  document.getElementById('brandMenu').addEventListener('click', (ev) => { ev.stopPropagation(); openAccountMenu(ev.currentTarget) })
  document.getElementById('sbNew').addEventListener('click', () => startFreshChat())
  document.getElementById('projMore')?.addEventListener('click', (ev) => { ev.stopPropagation(); openProjectDisplayMenu(ev.currentTarget) })
  document.getElementById('projNew')?.addEventListener('click', () => { state.view = 'projects'; openProjectForm(); })
  document.getElementById('recentToggle').addEventListener('click', () => {
    state.recentCollapsed = !state.recentCollapsed
    document.getElementById('recentList').classList.toggle('folded', state.recentCollapsed)
  })
  document.getElementById('recentMore')?.addEventListener('click', (ev) => { ev.stopPropagation(); openRecentHeadMenu(ev.currentTarget) })
  document.getElementById('recentFilter')?.addEventListener('click', (ev) => { ev.stopPropagation(); openRecentFilterMenu(ev.currentTarget) })
  document.getElementById('recentNew')?.addEventListener('click', () => startFreshChat())
  sidebar.querySelectorAll('[data-secmenu]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation()
    openSectionMenu(ev.currentTarget, b.dataset.secmenu)
  }))
  sidebar.querySelectorAll('[data-projmenu2]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation()
    openProjectMenu(ev.currentTarget, b.dataset.projmenu2)
  }))
  sidebar.querySelectorAll('[data-conv]').forEach((b) => b.addEventListener('click', () => openConversation(b.dataset.conv)))
  sidebar.querySelectorAll('[data-unpin]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation()
    togglePinnedConversation(b.dataset.unpin)
  }))
  sidebar.querySelectorAll('[data-convmenu]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation()
    openConversationMenu(ev.currentTarget, b.dataset.convmenu)
  }))
  sidebar.querySelectorAll('[data-convedit]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation()
    runConversationAction('rename', b.dataset.convedit)
  }))
  sidebar.querySelectorAll('[data-project]').forEach((b) => b.addEventListener('click', () => {
    if (state.projMerge) { openProject(b.dataset.project); return }
    state.projFolds = state.projFolds || {}
    const id = b.dataset.project
    const folded = !state.projFolds[id]
    state.projFolds[id] = folded
    const sub = b.closest('.sb-projrow')?.nextElementSibling
    if (sub && sub.classList.contains('sb-sub')) sub.style.display = folded ? 'none' : ''
    b.title = folded ? '展开项目会话' : '收起项目会话'
    b.setAttribute('aria-expanded', folded ? 'false' : 'true')
  }))
  bindSidebarResize()
  homeSidebarCacheHtml = sidebar.innerHTML
}

function bindHomeSidebarFloatResize(float) {
  const handle = float.querySelector('#hsGrip')
  if (!handle) return
  const applyWidth = (next) => {
    state.sidebarWidth = next
    state.sbUserW = next
    float.style.width = `${next}px`
    document.documentElement.style.setProperty('--sidebar-w', `${next}px`)
    document.documentElement.style.setProperty('--layout-sidebar-w', `${next}px`)
    document.documentElement.style.setProperty('--pane-w', `${next}px`)
  }
  handle.addEventListener('dblclick', () => {
    state.sbUserW = 0
    state.sidebarWidth = LAYOUT_TOKENS.sidebarWidth
    localStorage.removeItem(PANE_RATIO_KEY)
    localStorage.removeItem('jg.sidebarW')
    applyWidth(sidebarWidthValue())
    applyLayout()
  })
  handle.addEventListener('pointerdown', (ev) => {
    ev.preventDefault()
    homeSidebarDragging = true
    homeSidebarIgnoreHideUntil = Date.now() + 10000
    const startX = ev.clientX
    const startW = float.getBoundingClientRect().width
    const cloudW = document.getElementById('cbPanel')?.getBoundingClientRect().width || 0
    const maxW = Math.max(220, window.innerWidth - 58 - cloudW - 160)
    const move = (e) => applyWidth(Math.min(maxW, Math.max(180, startW + (e.clientX - startX))))
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      const panesW = Math.max(1, window.innerWidth - 58)
      localStorage.setItem(PANE_RATIO_KEY, String(state.sidebarWidth / panesW))
      localStorage.setItem('jg.sidebarW', String(state.sidebarWidth))
      document.body.classList.remove('resizing')
      homeSidebarDragging = false
      homeSidebarIgnoreHideUntil = Date.now() + 3000
      homeSidebarIgnoreOutsideUntil = Date.now() + 800
    }
    document.body.classList.add('resizing')
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  })
}

let homeSidebarHideTimer = null
let homeSidebarDragging = false
let homeSidebarIgnoreOutsideUntil = 0
let homeSidebarIgnoreHideUntil = 0
function cancelHomeSidebarHide() {
  if (homeSidebarHideTimer) { clearTimeout(homeSidebarHideTimer); homeSidebarHideTimer = null }
}
function scheduleHomeSidebarHide() {
  if (homeSidebarDragging || Date.now() < homeSidebarIgnoreHideUntil) return
  cancelHomeSidebarHide()
  homeSidebarHideTimer = setTimeout(() => {
    homeSidebarHideTimer = null
    document.getElementById('homeSidebarFloat')?.remove()
  }, 320)
}
function showHomeSidebarFloat() {
  cancelHomeSidebarHide()
  if (['home', 'chat'].includes(state.view)) return
  if (document.getElementById('homeSidebarFloat')) return
  if (!homeSidebarCacheHtml) return
  const float = document.createElement('div')
  float.id = 'homeSidebarFloat'
  float.className = 'sidebar hs-float'
  float.setAttribute('role', 'dialog')
  float.setAttribute('aria-label', '首页侧栏')
  float.innerHTML = homeSidebarCacheHtml
  float.querySelector('.pane-grip')?.remove()
  const liveSidebar = document.getElementById('sidebar')
  const liveW = liveSidebar?.getBoundingClientRect().width || 0
  float.style.width = `${liveW >= 180 ? Math.round(liveW) : sidebarWidthValue()}px`
  const grip = document.createElement('div')
  grip.className = 'pane-grip'
  grip.id = 'hsGrip'
  grip.title = '拖动调整左右宽度 · 双击复位'
  float.appendChild(grip)
  document.body.appendChild(float)
  bindHomeSidebarFloatResize(float)
  const close = () => { cancelHomeSidebarHide(); float.remove(); document.removeEventListener('keydown', onKey); document.removeEventListener('click', outside) }
  const onKey = (e) => { if (e.key === 'Escape') close() }
  const outside = (e) => {
    if (Date.now() < homeSidebarIgnoreOutsideUntil) return
    if (!float.contains(e.target) && !e.target.closest('[data-nav="home"]')) close()
  }
  float.addEventListener('mouseenter', cancelHomeSidebarHide)
  float.addEventListener('mouseleave', scheduleHomeSidebarHide)
  float.querySelector('#sbSearch')?.addEventListener('click', (ev) => { ev.stopPropagation(); openSearchPalette() })
  float.querySelector('#notifyTrigger')?.addEventListener('click', (ev) => { ev.stopPropagation(); openNotifications(ev.currentTarget) })
  float.querySelector('#sbNew')?.addEventListener('click', () => { close(); startFreshChat() })
  float.querySelector('#recentNew')?.addEventListener('click', () => { close(); startFreshChat() })
  float.querySelector('#brandMenu')?.addEventListener('click', (ev) => { ev.stopPropagation(); openAccountMenu(ev.currentTarget) })
  float.querySelectorAll('[data-conv]').forEach((b) => b.addEventListener('click', () => { close(); openConversation(b.dataset.conv) }))
  document.addEventListener('keydown', onKey)
  setTimeout(() => document.addEventListener('click', outside), 0)
}

function bindHomeHoverSidebar() {
  const railbar = document.getElementById('railbar')
  if (!railbar || railbar.__homeHoverBound) return
  railbar.__homeHoverBound = true
  railbar.addEventListener('mouseover', (e) => {
    if (e.target.closest('[data-nav="home"]')) showHomeSidebarFloat()
  })
  railbar.addEventListener('mouseout', (e) => {
    if (!e.target.closest('[data-nav="home"]')) return
    const to = e.relatedTarget
    if (to && (to.closest?.('#homeSidebarFloat') || to.closest?.('[data-nav="home"]'))) return
    scheduleHomeSidebarHide()
  })
}

const PAGE_SIDEBAR_SELECTORS = {
  skills: '.sk-left',
  settings: '.settings-side',
  admin: '.mc-nav',
  im: '.im-left',
}

function ensureSidebarGrip() {
  const sb = document.getElementById('sidebar')
  if (!sb) return
  if (!sb.querySelector('.pane-grip')) {
    const grip = document.createElement('div')
    grip.className = 'pane-grip'
    grip.id = 'sbGrip'
    grip.title = '拖动调整左右宽度 · 双击复位'
    sb.appendChild(grip)
  }
  bindSidebarResize()
}

/**
 * 业务模块只提供侧栏内容节点，AppLayout 统一把它挂载到全局 #sidebar。
 * 这样侧栏的宽度、背景、滚动、动画和显隐只由布局系统控制。
 */
function mountPageSidebar() {
  if (!hasSidebarView()) return
  const sb = document.getElementById('sidebar')
  const view = document.getElementById('view')
  if (!sb || !view) return
  if (state.view === 'tasks') {
    // 定时任务侧栏由 renderTaskCenter 直接写入全局容器；这里只补齐统一拖拽边。
    if (sb.querySelector('.tk-left')) ensureSidebarGrip()
    applyLayout()
    return
  }
  if (['home', 'chat'].includes(state.view)) {
    applyLayout()
    return
  }
  const selector = PAGE_SIDEBAR_SELECTORS[state.view]
  const node = selector ? view.querySelector(selector) : null
  if (!node) {
    sb.innerHTML = `<div class="layout-sidebar-placeholder">
      <div class="layout-sidebar-placeholder-title">${esc(pageLayout().sidebarTitle || '')}</div>
      <div class="layout-sidebar-placeholder-note">当前模块未提供侧边栏内容</div>
    </div>`
    applyLayout()
    return
  }
  node.classList.add('layout-sidebar-content')
  sb.replaceChildren(node)
  view.querySelectorAll('.pane-splitter').forEach((h) => {
    const box = h.parentElement
    if (box && [...box.children].filter((c) => c !== h).length < 2) h.remove()
  })
  ensureSidebarGrip()
  applyLayout()
}



function togglePinnedConversation(id) {
  const conv = (state.conversations || []).find((c) => c.id === id)
  if (!conv) return
  const next = new Set(state.pinnedConvs || [])
  const wasPinned = next.has(id)
  if (wasPinned) next.delete(id)
  else next.add(id)
  state.pinnedConvs = Array.from(next)
  try { localStorage.setItem('jg.pinnedConvs', JSON.stringify(state.pinnedConvs)) } catch (e) { /* 本地不可写时只保留进程内状态 */ }
  renderSidebar()
  toast(wasPinned ? `已取消置顶「${conv.title}」` : `已置顶「${conv.title}」`)
}

function openConversationMenu(anchor, id) {
  document.querySelectorAll('.conv-menu').forEach((p) => p.remove())
  const conv = (state.conversations || []).find((c) => c.id === id)
  if (!conv) return
  const locked = (state.lockedConvs || []).includes(id)
  const items = [
    ['rename', 'pen', '重命名', 'Ctrl+Alt+R'],
    ['pin', 'pin', (state.pinnedConvs || []).includes(id) ? '取消置顶' : '置顶', 'Ctrl+Alt+P'],
    ['section', 'grid', '分区', ''],
    ['lock', 'shield', locked ? '取消锁定' : '锁定聊天', ''],
    ['share', 'send', '分享', ''],
    ['—', '', '', ''],
    ['open', 'globe', '打开会话', ''],
    ['fork', 'layers', '分叉会话', ''],
    ['export', 'download', '导出为 Markdown', ''],
    ['copy', 'doc', '复制完整对话', ''],
    ['sessionlog', 'inbox', '导出完整会话日志（ZIP）', ''],
    ...(conv.projectId ? [['—', '', '', ''], ['files', 'folder', '浏览项目文件', '']] : []),
    ['—', '', '', ''],
    ['archive', 'inbox', '归档', 'Ctrl+Shift+A'],
    ['delete', 'close', '删除', ''],
    ['—', '', '', ''],
    ['move', 'folder', '移至项目', ''],
  ]
  const pop = document.createElement('div')
  pop.className = 'conv-menu'
  pop.innerHTML = items.map(([act, ic, label, key, off]) => act === '—'
    ? '<div class="cm-sep"></div>'
    : `<button class="cm-item" data-cm="${act}"${off ? ' disabled style="opacity:.45;cursor:not-allowed"' : ''}>
        <span class="ico">${icon(ic)}</span><span class="cm-label">${label}</span>
        ${key ? `<span class="cm-key">${key}</span>` : ''}
        ${['section', 'move'].includes(act) ? '<span class="cm-arrow">›</span>' : ''}
      </button>`).join('')
  document.body.appendChild(pop)
  const r = anchor.getBoundingClientRect()
  pop.style.left = `${Math.max(8, Math.min(window.innerWidth - 230, r.right + 8))}px`
  const ph = pop.offsetHeight
  pop.style.top = `${Math.max(8, Math.min(window.innerHeight - ph - 8, r.top - 6))}px`
  pop.querySelectorAll('[data-cm]').forEach((it) => it.addEventListener('click', (ev) => {
    ev.stopPropagation()
    if (it.disabled) return
    const act = it.dataset.cm
    if (act === 'move') { pop.remove(); openMoveToProject(anchor, id); return }
    if (act === 'section') { pop.remove(); openConversationSectionPicker(anchor, id); return }
    pop.remove()
    runConversationAction(act, id)
  }))
  setTimeout(() => document.addEventListener('click', function close(e) {
    if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', close) }
  }), 0)
}

function openMoveToProject(anchor, id) {
  document.querySelectorAll('.conv-menu').forEach((p) => p.remove())
  const projects = state.sidebarProjects || state.projects || []
  const pop = document.createElement('div')
  pop.className = 'conv-menu'
  pop.innerHTML = `<div class="cm-head">移至项目</div>` + projects.map((p) => `
    <button class="cm-item" data-mp="${p.id}"><span class="ico">${icon('folder')}</span><span class="cm-label">${esc(p.name)}</span></button>`).join('')
  document.body.appendChild(pop)
  const r = anchor.getBoundingClientRect()
  pop.style.left = `${Math.max(8, Math.min(window.innerWidth - 230, r.right + 8))}px`
  const ph = pop.offsetHeight
  pop.style.top = `${Math.max(8, Math.min(window.innerHeight - ph - 8, r.top))}px`
  pop.querySelectorAll('[data-mp]').forEach((b) => b.addEventListener('click', async () => {
    pop.remove()
    const projectId = b.dataset.mp
    const { ok, body: res } = await api('/api/conversation/move', {
      method: 'POST',
      body: JSON.stringify({ conversationId: id, projectId }),
    })
    if (!ok) return toast(res?.error || '移入项目失败', true)
    const conv = (state.conversations || []).find((c) => c.id === id)
    if (conv) conv.projectId = projectId
    renderSidebar()
    toast(`会话已移入项目「${(projects.find((p) => p.id === projectId) || {}).name || ''}」`)
  }))
  setTimeout(() => document.addEventListener('click', function close(e) {
    if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', close) }
  }), 0)
}

function runConversationAction(act, id) {
  const conv = (state.conversations || []).find((c) => c.id === id)
  if (!conv) return
  if (act === 'open') { openConversation(id); return }
  if (act === 'share') { shareConversationById(id); return }
  if (act === 'lock') { toggleLockedConversation(id); return }
  if (act === 'archive') { archiveConversation(id); return }
  if (act === 'export') {
    const a = document.createElement('a')
    a.href = `/api/conversation/export?id=${encodeURIComponent(id)}`
    a.download = `jg-${id}.md`
    document.body.appendChild(a)
    a.click()
    a.remove()
    toast('已导出为 Markdown')
    return
  }
  if (act === 'copy') {
    const text = (conv.messages || []).map((m) => `${m.role === 'user' ? '用户' : '助手'}（${m.time || ''}）：\n${m.text || ''}`).join('\n\n')
    const done = () => toast('已复制完整对话到剪贴板')
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => toast('复制失败，请改用导出 Markdown', true))
    } else {
      const area = document.createElement('textarea')
      area.value = text
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      area.remove()
      ok ? done() : toast('复制失败，请改用导出 Markdown', true)
    }
    return
  }
  if (act === 'files' && conv.projectId) { openProjectFiles({ projectId: conv.projectId }); return }
  if (act === 'sessionlog') {
    const a = document.createElement('a')
    a.href = `/api/conversation/session-log?id=${encodeURIComponent(id)}`
    a.download = `jg-${id}.session-log.zip`
    document.body.appendChild(a)
    a.click()
    a.remove()
    toast('正在导出 DSH 原始会话日志（ZIP）')
    return
  }
  if (act === 'fork') {
    const mask = openModal('分叉会话', `
      <div class="form-note">将把当前可见对话历史复制为一个新会话，并从新的 DSH 会话继续。底层 DSH 会话日志不会复制，因此不是原生 fork。</div>
      <div class="form-foot"><span class="mono">${conv.messages?.length || 0} 条消息</span><span class="spacer"></span><button class="btn" data-mclose>取消</button><button class="btn primary" id="forkOk">创建分叉</button></div>`)
    mask.querySelector('#forkOk').addEventListener('click', async (ev) => {
      ev.currentTarget.disabled = true
      const { ok, body } = await api('/api/conversation/fork', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conversationId: id, index: (conv.messages?.length || 1) - 1 }),
      })
      if (!ok) { ev.currentTarget.disabled = false; return toast(body?.error || '分叉失败', true) }
      mask.querySelector('[data-mclose]')?.click()
      state.conversations = [body.conversation, ...(state.conversations || []).filter((c) => c.id !== body.conversation.id)]
      renderSidebar()
      openConversation(body.conversation.id)
      toast('已创建分叉会话；下一轮将基于复制出的历史上下文')
    })
    return
  }
  if (act === 'pin') {
    togglePinnedConversation(id)
    return
  }
  if (act === 'delete') {
    if ((state.lockedConvs || []).includes(id)) {
      return toast('该会话已锁定，请先在更多菜单中取消锁定', true)
    }
    const mask = openModal('删除会话', `
      <div class="form-note">删除后该会话从「最近」移除，项目内的成果与审计记录不受影响。</div>
      <div class="form-foot"><span class="spacer"></span><button class="btn" data-mclose>取消</button><button class="btn danger" data-del>删除</button></div>`)
    mask.querySelector('[data-mclose]').addEventListener('click', () => mask.remove())
    const delBtn = mask.querySelector('[data-del]')
    delBtn.addEventListener('click', async () => {
      if (delBtn.disabled) return
      delBtn.disabled = true
      const { ok, body } = await api('/api/conversation/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conversationId: id }),
      })
      if (!ok) { delBtn.disabled = false; return toast(body.error || '删除会话失败', true) }
      state.conversations = state.conversations.filter((c) => c.id !== id)
      state.archivedConvs = (state.archivedConvs || []).filter((x) => x !== id)
      persistArchivedConvs()
      if (state.conversation?.id === id) { state.conversation = null; state.chatSteps = [] }
      mask.remove()
      render()
      toast(`已删除「${conv.title}」`)
    })
    return
  }
  if (act === 'rename') {
    const mask = openModal('重命名会话', `
      <label class="form-label">会话名称</label>
      <input class="text-input" id="cmRename" value="${esc(conv.title)}" maxlength="40">
      <div class="form-foot"><span class="spacer"></span><button class="btn" data-mclose>取消</button><button class="btn primary" data-save>保存</button></div>`)
    const input = mask.querySelector('#cmRename')
    mask.querySelector('[data-mclose]').addEventListener('click', () => mask.remove())
    mask.querySelector('[data-save]').addEventListener('click', () => {
      const v = input.value.trim()
      if (!v) { toast('名称不能为空'); return }
      conv.title = v
      mask.remove()
      render()
      toast('已重命名')
    })
    setTimeout(() => input.focus(), 60)
    return
  }
  return
}

function renderMenubar() {
  const mb = document.getElementById('menubar')
  const menus = {
    file: ['文件', [
      ['新建窗口', '', 'newWindow'], ['新聊天', 'Ctrl+N', 'newChat'], ['新建临时聊天', 'Ctrl+Shift+N', 'tempChat', true],
      ['新建项目...', '', 'newProject'], ['—', '', ''], ['打开文件夹', 'Ctrl+O', 'openFolder', true], ['关闭', 'Ctrl+W', 'close', true],
      ['—', '', ''], ['退出登录', '', 'logout'],
    ]],
    edit: ['编辑', [
      ['撤销', 'Ctrl+Z', 'undo'], ['重做', 'Ctrl+Y', 'redo'], ['—', '', ''], ['剪切', 'Ctrl+X', 'cut'],
      ['复制', 'Ctrl+C', 'copy'], ['粘贴', 'Ctrl+V', 'paste'], ['删除', '', 'del'], ['—', '', ''], ['全选', 'Ctrl+A', 'selectAll'],
      ['—', '', ''], ['设置', 'Ctrl+,', 'settings'],
    ]],
    view: ['视图', [
      ['浏览器', '', 'cloud'], ['—', '', ''], ['查找', 'Ctrl+F', 'find'], ['—', '', ''], ['放大', 'Ctrl+Shift+=', 'zoomIn'],
      ['缩小', 'Ctrl+-', 'zoomOut'], ['实际大小', 'Ctrl+0', 'zoomReset'], ['—', '', ''], ['切换全屏', 'F11', 'fullscreen'],
    ]],
    help: ['帮助', [
      ['文档', '', 'docs', true], ['显示键盘快捷键', 'Ctrl+/', 'shortcuts'], ['新功能', '', 'whatsnew'], ['—', '', ''],
      ['故障排除', '', 'trouble'], ['系统状态', '', 'status'], ['反馈', '', 'feedback'], ['—', '', ''],
      ['任务管理器', '', 'taskmgr', true], ['—', '', ''], ['检查更新...', '', 'update', true], ['关于九规智能中枢', '', 'about'],
    ]],
  }
  mb.innerHTML = `
    <div class="mb-left">
      <button class="mb-icon" title="后退" data-mbact="back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M20 12H5M11 6L5 12l6 6"/></svg></button>
      <button class="mb-icon" title="前进" data-mbact="forward"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 12h15M13 6l6 6-6 6"/></svg></button>
    </div>
    <div class="mb-menus">
      ${hasSidebarView() ? `<button class="mb-icon mb-sidebar-toggle${state.sbPinned ? ' on' : ''}" id="mbLayoutToggle" title="${state.sbPinned ? '隐藏侧边栏' : '显示侧边栏'}（Ctrl+Shift+S）" aria-pressed="${state.sbPinned}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="16" rx="3"/>${state.sbPinned ? '<rect x="3.8" y="4.8" width="4.4" height="14.4" rx="2" fill="currentColor" stroke="none" opacity="0.55"/>' : '<path d="M9 4v16" opacity="0.45"/>'}</svg></button>` : ''}
      ${Object.entries(menus).map(([k, [label, items]]) => `<button class="mb-menu" data-menu="${k}">${label}</button>`).join('')}
      ${cloudAllowed() ? `<button class="mb-icon mb-cloud-toggle${state.cloudOpen ? ' on' : ''}" id="mbCloudToggle" title="${state.cloudOpen ? '折叠云浏览器' : '展开云浏览器'}" aria-label="云浏览器">${icon('globe')}</button>` : ''}
    </div>
    <div class="mb-win">
      <span class="mb-winbtn" title="最小化"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 6h8"/></svg></span>
      <span class="mb-winbtn" title="最大化"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2.5" y="2.5" width="7" height="7"/></svg></span>
      <span class="mb-winbtn close" title="关闭"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 3l6 6M9 3L3 9"/></svg></span>
    </div>`
  mb.querySelector('#mbLayoutToggle')?.addEventListener('click', () => toggleGlobalSidebar())
  mb.querySelector('#mbCloudToggle')?.addEventListener('click', () => toggleCloudPanel())
  mb.querySelectorAll('[data-mbact]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.mbact === 'back') history.back()
    else toast('已是最近的历史记录')
  }))
  mb.querySelectorAll('[data-menu]').forEach((btn) => btn.addEventListener('click', (ev) => {
    ev.stopPropagation()
    document.querySelectorAll('.mb-pop').forEach((p) => p.remove())
    const [label, items] = menus[btn.dataset.menu]
    const pop = document.createElement('div')
    pop.className = 'mb-pop'
    pop.innerHTML = items.map(([text, key, act, off]) => text === '—'
      ? '<div class="mb-sep"></div>'
      : `<button class="mb-item" data-act="${act}"${off ? ' disabled style="opacity:.45;cursor:not-allowed"' : ''}><span>${text}</span>${key ? `<span class="mb-key">${key}</span>` : ''}</button>`).join('')
    document.body.appendChild(pop)
    const r = btn.getBoundingClientRect()
    pop.style.left = `${Math.max(8, Math.min(window.innerWidth - pop.offsetWidth - 8, r.left))}px`
    const ph = pop.offsetHeight
    pop.style.top = `${Math.max(8, Math.min(window.innerHeight - ph - 8, r.bottom + 4))}px`
    pop.querySelectorAll('[data-act]').forEach((it) => it.addEventListener('click', () => {
      if (it.disabled) return
      pop.remove()
      runMenuAction(it.dataset.act)
    }))
    setTimeout(() => document.addEventListener('click', function close(e) {
      if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', close) }
    }), 0)
  }))
}

function runMenuAction(act) {
  const focusHome = () => {
    state.view = 'home'
    state.conversation = null
    state.chatSteps = []
    state.chatError = ''
    state.activeProjectId = ''
    state.activeProjectName = ''
    state.activeProjectCwd = ''
    render()
    setTimeout(() => document.getElementById('draft')?.focus(), 60)
  }
  const map = {
    newWindow: () => window.open(location.href, '_blank'),
    newChat: focusHome,
    tempChat: () => {},
    newProject: () => { state.view = 'projects'; render(); setTimeout(() => openProjectForm(), 120) },
    openFolder: () => {},
    close: () => {},
    logout: async () => { await logout() },
    quit: () => {},
    undo: () => document.execCommand('undo'),
    redo: () => document.execCommand('redo'),
    cut: () => document.execCommand('cut'),
    copy: () => document.execCommand('copy'),
    paste: () => document.execCommand('paste'),
    del: () => document.execCommand('delete'),
    selectAll: () => document.execCommand('selectAll'),
    settings: () => { state.view = 'settings'; state.settingsTab = 'general'; state.settingsQuery = ''; render() },
    toggleSidebar: () => { toggleGlobalSidebar() },
    cloud: () => toggleCloudPanel(),
    find: () => openSearchPalette(''),
    zoomIn: () => { document.body.style.zoom = String(Math.min(1.4, (Number(document.body.style.zoom) || 1) + 0.1)) },
    zoomOut: () => { document.body.style.zoom = String(Math.max(0.7, (Number(document.body.style.zoom) || 1) - 0.1)) },
    zoomReset: () => { document.body.style.zoom = '1' },
    fullscreen: () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.() },
    docs: () => {},
    shortcuts: () => toast('Ctrl+K 全局搜索 · Ctrl+, 设置 · Ctrl+Shift+S 侧边栏'),
    whatsnew: () => toast('新功能：首页置顶 / 项目 / 最近，定时任务与插件市场'),
    trouble: () => toast('故障排查：检查网络归属、模型能力与授权范围'),
    status: () => { state.view = 'admin'; render() },
    feedback: () => openFeedbackModal(),
    taskmgr: () => {},
    update: () => {},
    about: () => openAboutModal(),
  }
  ;(map[act] || (() => {}))()
}

function openAboutModal() {
  const mask = openModal('关于九规智能中枢', `
    <div class="form-note">九规智能中枢 企业版 AI 中枢，基于开源 DeepSeek Harness 0.2.2-rc.1 定制；客户端外壳与云浏览器按企业安全边界实现。</div>
    <div class="kv-row" style="grid-template-columns:repeat(2,minmax(0,1fr))">
      <div class="kv-box"><span>版本</span><b>1.6 · 企业空间</b></div>
      <div class="kv-box"><span>当前网络</span><b>${esc(state.boot.network?.label || '互联网')}</b></div>
      <div class="kv-box"><span>当前身份</span><b>${esc(state.boot.user.name)} · ${esc(state.boot.user.duty)}</b></div>
      <div class="kv-box"><span>部署</span><b>集团私有化</b></div>
    </div>
    <div class="form-note" style="margin-top:12px">Chromium 开源内核 · 凭据不落地</div>`)
}

function bindSidebarResize() {
  const handle = document.getElementById('sbGrip')
  if (!handle) return
  handle.addEventListener('dblclick', () => {
    state.sbUserW = 0
    state.sidebarWidth = LAYOUT_TOKENS.sidebarWidth
    localStorage.removeItem(PANE_RATIO_KEY)
    localStorage.removeItem('jg.sidebarW')
    applyLayout()
    const float = document.getElementById('homeSidebarFloat')
    if (float) float.style.width = `${sidebarWidthValue()}px`
  })
  handle.addEventListener('pointerdown', (ev) => {
    ev.preventDefault()
    const startX = ev.clientX
    const startW = document.getElementById('sidebar').getBoundingClientRect().width
    const cloudW = document.getElementById('cbPanel')?.getBoundingClientRect().width || 0
    const maxW = Math.max(220, window.innerWidth - 58 - cloudW - 160)
    const move = (e) => {
      const next = Math.min(maxW, Math.max(180, startW + (e.clientX - startX)))
      state.sidebarWidth = next
      state.sbUserW = next
      document.documentElement.style.setProperty('--sidebar-w', `${next}px`)
      document.documentElement.style.setProperty('--layout-sidebar-w', `${next}px`)
      document.documentElement.style.setProperty('--pane-w', `${next}px`)
      const float = document.getElementById('homeSidebarFloat')
      if (float) float.style.width = `${next}px`
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      const panesW = Math.max(1, window.innerWidth - 58)
      localStorage.setItem(PANE_RATIO_KEY, String(state.sidebarWidth / panesW))
      localStorage.setItem('jg.sidebarW', String(state.sidebarWidth))
      document.body.classList.remove('resizing')
    }
    document.body.classList.add('resizing')
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  })
}


const PAGE_LAYOUTS = {
  home: { sidebar: true, sidebarTitle: '工作区' },
  chat: { sidebar: true, sidebarTitle: '工作区' },
  tasks: { sidebar: true, sidebarTitle: '定时任务' },
  automation: { sidebar: true, sidebarTitle: '定时任务' },
  skills: { sidebar: true, sidebarTitle: '插件与技能' },
  settings: { sidebar: true, sidebarTitle: '设置' },
  admin: { sidebar: true, sidebarTitle: '管理中心' },
  im: { sidebar: true, sidebarTitle: '即时通讯' },
}
const CLOUD_VIEWS = ['home', 'chat', 'tasks', 'knowledge', 'academy']
function pageLayout(view = state.view) {
  return PAGE_LAYOUTS[view] || { sidebar: false }
}
function cloudAllowed() {
  return true
}
function hasSidebarView() {
  return Boolean(pageLayout().sidebar)
}
function sbFixed() {
  return hasSidebarView() && state.sbPinned
}

const PANE_RATIO_KEY = 'jg.paneRatio.v4'
function paneRatio() {
  const v = Number(localStorage.getItem(PANE_RATIO_KEY))
  return v >= 0.15 && v <= 0.9 ? v : 0.25
}
function paneWidthFor(width) {
  return Math.round(Math.min(900, Math.max(150, width * paneRatio())))
}

function sidebarWidthValue() {
  const raw = Number(state.sbUserW || state.sidebarWidth || LAYOUT_TOKENS.sidebarWidth)
  return Math.round(Math.min(LAYOUT_TOKENS.sidebarMaxWidth, Math.max(LAYOUT_TOKENS.sidebarMinWidth, raw)))
}

function applyLayout() {
  const enabled = hasSidebarView()
  const open = enabled && state.sbPinned
  const cloud = state.cloudOpen && cloudAllowed()
  if (!cloud) closeNativeWeb()
  const panesW = Math.max(0, window.innerWidth - 58)
  const cbW = cloud ? (state.cbUserW || Math.round(panesW / 4)) : 0
  document.documentElement.style.setProperty('--cb-w', `${cbW}px`)
  document.documentElement.style.setProperty('--pane-w', `${sidebarWidthValue()}px`)
  const hsFloat = document.getElementById('homeSidebarFloat')
  if (hsFloat) hsFloat.style.width = `${sidebarWidthValue()}px`
  document.documentElement.style.setProperty('--set-nav-w', '0px')
  layout.configure({
    sidebarEnabled: enabled,
    sidebarOpen: open,
    width: sidebarWidthValue(),
    page: state.view,
  })
  const app = document.getElementById('app')
  app?.classList.toggle('home-cloud', state.view === 'home' && cloud)
  if (document.getElementById('cbWebSlot')) requestAnimationFrame(sendNativeBounds)
  requestAnimationFrame(syncPaneScrollbars)
}
window.addEventListener('resize', () => applyLayout())

function navIcon(id) {
  return {
    home: 'home', history: 'history', projects: 'folder', tasks: 'clock', skills: 'plugin', automation: 'clock',
    imagegen: 'image',
    datacenter: 'database', knowledge: 'book', oneMap: 'map', review: 'layers', finance: 'wallet',
    adminops: 'briefcase',
    apps: 'grid', cloudbrowser: 'globe', settings: 'settings', admin: 'shield',
    drive: 'cloud', contacts: 'users', im: 'message', notice: 'megaphone', academy: 'cap', more: 'more',
    bid: 'doc', monitor: 'pulse',
  }[id] || 'doc'
}

/* --------------------------- 账户菜单（个人中心） --------------------------- */

const DEFAULT_FAVORITES = [
  { ref: 'R-PROJ-PUB', kind: 'data', title: '中心城区项目公示信息（2026）', meta: '数据中心 · 业务数据 · 规划一所', icon: 'database' },
  { ref: 'R-2026-Q3-IMG', kind: 'data', title: '卫星影像（九江市全域）2026 Q3', meta: '数据中心 · 影像 · 测绘地理信息中心', icon: 'image' },
  { ref: 'AC-01', kind: 'data', title: '国土空间规划编制办法（2026 修订）要点解读', meta: '教学园地 · 视频 · 规划一所', icon: 'video' },
  { ref: 'OA-2026-018', kind: 'flow', title: '滨江片区城市更新项目立项审批', meta: 'OA 流程 · 经营管理部 · 2026-11-06', status: '审批中', icon: 'task' },
  { ref: 'OA-2026-016', kind: 'flow', title: '中心城区控规调整用印申请', meta: 'OA 流程 · 综合办公室 · 2026-11-04', status: '已通过', icon: 'check' },
]

function getFavs() {
  if (!state.favorites) state.favorites = DEFAULT_FAVORITES.map((f) => ({ ...f }))
  return state.favorites
}
function isFav(ref) { return getFavs().some((f) => f.ref === ref) }
function toggleFav(payload) {
  const favs = getFavs()
  const i = favs.findIndex((f) => f.ref === payload.ref)
  if (i >= 0) { favs.splice(i, 1); return false }
  favs.push({ ...payload })
  return true
}

function openStoragePanel() {
  const used = storageUsedGB()
  const pct = storagePct()
  const free = Math.round((PERSONAL_STORAGE.totalGB - used) * 10) / 10
  const mask = openModal('个人云存储', `
    <div class="stor-hero">
      <div class="stor-ring" style="--p:${pct}"><span>${pct}%</span></div>
      <div class="stor-hero-main">
        <b>${used} GB <em>/ ${PERSONAL_STORAGE.totalGB} GB</em></b>
        <span>个人总云存储已用 · 剩余 ${free} GB</span>
        <div class="stor-bar"><i style="width:${pct}%"></i></div>
      </div>
    </div>
    <div class="stor-grid">
      <div class="stor-cell"><span>个人云盘</span><b>${PERSONAL_STORAGE.cloudGB} GB</b><small>聊天附件、个人上传文件</small></div>
      <div class="stor-cell"><span>智能笔记本</span><b>${PERSONAL_STORAGE.notebookGB} GB</b><small>笔记本本地上传的来源</small></div>
      <div class="stor-cell"><span>个人总容量</span><b>${PERSONAL_STORAGE.totalGB} GB</b><small>个人云盘与智能笔记本共用</small></div>
    </div>
    <div class="form-note">个人云盘和智能笔记本共用每人 50GB 总容量；部门云空间、数据中心与云空间引用不占个人容量。</div>
    <div class="form-foot"><span class="mono">容量按账户统计，跨设备一致</span><span class="spacer"></span><button class="btn primary" data-go-mycloud>在云空间中查看</button></div>`)
  mask.querySelector('[data-go-mycloud]').addEventListener('click', () => {
    mask.remove()
    state.view = 'drive'
    state.driveSpace = 'CL-PERSONAL'
    render()
  })
}

function openFavorites() {
  let tab = 'data'
  const bodyHtml = (which) => {
    const list = getFavs().filter((f) => f.kind === which)
    if (!list.length) return `<div class="fav-empty">${icon(which === 'data' ? 'star' : 'task')}<span>还没有收藏${which === 'data' ? '数据' : 'OA 流程'}，可在资源详情或教学园地点击收藏。</span></div>`
    return list.map((f) => `
      <div class="fav-row">
        <span class="fav-ico">${icon(f.icon || (which === 'data' ? 'database' : 'task'))}</span>
        <span class="fav-main"><b>${esc(f.title)}</b><span>${esc(f.meta)}</span></span>
        ${f.status ? `<span class="tag">${esc(f.status)}</span>` : ''}
        <button class="fav-remove" data-fav-remove="${esc(f.ref)}" title="取消收藏">${icon('star')}<span>已收藏</span></button>
      </div>`).join('')
  }
  const mask = openModal('个人中心 · 我的收藏', `
    <div class="fav-tabs">
      <button class="fav-tab on" data-favtab="data">收藏的数据 <span class="mono">${getFavs().filter((f) => f.kind === 'data').length}</span></button>
      <button class="fav-tab" data-favtab="flow">OA 流程 <span class="mono">${getFavs().filter((f) => f.kind === 'flow').length}</span></button>
    </div>
    <div class="fav-list" id="favList"></div>
    <div class="form-note">收藏只记录引用关系，不复制数据中心原文件；OA 流程收藏保留流程编号与当前状态。</div>
  `, { wide: true })
  const list = mask.querySelector('#favList')
  const refresh = () => {
    list.innerHTML = bodyHtml(tab)
    mask.querySelectorAll('[data-favtab]').forEach((b) => b.classList.toggle('on', b.dataset.favtab === tab))
    list.querySelectorAll('[data-fav-remove]').forEach((b) => b.addEventListener('click', () => {
      const ref = b.dataset.favRemove
      toggleFav({ ref })
      toast('已取消收藏')
      refresh()
      if (window.__accountPop) window.__accountPop.remove()
      window.__accountPop = null
    }))
  }
  mask.querySelectorAll('[data-favtab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.favtab; refresh() }))
  refresh()
}

const PERSONAL_STORAGE = { totalGB: 50, cloudGB: 6.2, notebookGB: 14.8 }
const storageUsedGB = () => Math.round((PERSONAL_STORAGE.cloudGB + PERSONAL_STORAGE.notebookGB) * 10) / 10
const storagePct = () => Math.min(100, Math.round((storageUsedGB() / PERSONAL_STORAGE.totalGB) * 100))
const usageTokens = () => Number(state.usageSummary?.totals?.totalTokens || 0)
const usageMeta = () => state.usageSummary?.totals?.requests
  ? `${usageTokens().toLocaleString('zh-CN')} tokens · ${state.usageSummary.totals.requests} 次`
  : '暂无真实用量'
async function loadUsageSummary() {
  const { ok, body } = await api('/api/usage/summary')
  if (!ok) return null
  state.usageSummary = body
  if (state.view === 'settings' && state.settingsTab === 'usage') renderView()
  return body
}

function openAccountMenu(anchor) {
  document.querySelectorAll('.account-pop').forEach((p) => p.remove())
  const { user, counts } = state.boot
  const item = (act, ic, label, meta = '') => `
    <button class="acct-item" data-acct="${act}">
      <span class="ico">${icon(ic)}</span><span>${label}</span>
      ${meta ? `<span class="acct-meta">${esc(meta)}</span>` : ''}
    </button>`

  const order = ['employee', 'ops', 'guest']
  const nextId = order[(order.indexOf(user.role) + 1) % order.length]
  const nextRole = (state.boot.allRoles || []).find((r) => r.id === nextId)
  const pop = document.createElement('div')
  pop.className = 'account-pop'
  pop.innerHTML = `
    <div class="acct-head">
      <div class="avatar lg">${esc(user.name.slice(0, 1))}</div>
      <div style="min-width:0">
        <div class="acct-name">${esc(user.name)}</div>
        <div class="acct-plan">${esc(user.label)} · ${esc(user.unit)}</div>
      </div>
      <span class="tag ${state.boot.network?.id === 'secret' ? 'secret' : ''}" style="margin-left:auto;flex:none">${esc(state.boot.network?.badge || '互联网')}</span>
    </div>
    <div class="acct-sep"></div>
    ${item('usage', 'pulse', 'Token 用量', usageMeta())}
    ${item('favorites', 'star', '我的收藏', `${getFavs().length} 项`)}
    ${item('storage', 'cloud', '个人云存储', `${storageUsedGB()} / ${PERSONAL_STORAGE.totalGB} GB · ${storagePct()}%`)}
    ${item('models', 'spark', '模型配置', '个人中心')}
    ${item('ai', 'spark', 'AI 调用能力', '按权限开放')}
    ${item('appearance', 'spark', '个性化')}
    ${item('settings', 'settings', '设置', 'Ctrl+,')}
    <div class="acct-sep"></div>
    ${item('audit', 'task', '审计日志')}
    ${item('role', 'shield', '登录其他账号', `${(state.boot.allRoles || []).length} 个账号可选`)}
    ${item('network', 'map', '切换演示网络', esc(state.boot.network?.label || '互联网'))}
    <div class="acct-sep"></div>
    ${item('help', 'doc', '帮助与反馈')}
    ${item('logout', 'close', '退出登录')}`

  document.body.appendChild(pop)
  window.__accountPop = pop
  const rect = anchor.getBoundingClientRect()
  const navBtn = document.querySelector('#railbar [data-nav]')
  const left = navBtn ? navBtn.getBoundingClientRect().right + 10 : rect.left
  pop.style.left = `${Math.max(8, left)}px`
  const popH = pop.offsetHeight
  if (rect.top - 8 < popH + 8) {
    pop.style.top = `${Math.min(window.innerHeight - popH - 8, rect.bottom + 8)}px`
  } else {
    pop.style.bottom = `${window.innerHeight - rect.top + 8}px`
  }

  pop.querySelectorAll('[data-acct]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const act = btn.dataset.acct
      if (act === 'logout') {
        logout()
        return
      }
      if (act === 'help') {
        openFeedbackModal()
        return
      }
      if (act === 'network') {
        switchNetwork()
        return
      }
      if (act === 'audit') {
        state.auditOpen = true
        renderAuditDrawer()
        return
      }
      if (act === 'favorites') {
        pop.remove()
        window.__accountPop = null
        openFavorites()
        return
      }
      if (act === 'storage') {
        pop.remove()
        window.__accountPop = null
        openStoragePanel()
        return
      }
      if (act === 'models') {
        state.view = 'settings'
        state.settingsTab = 'models'
        render()
        return
      }
      if (act === 'ai') {
        openAiTools()
        return
      }
      if (act === 'role') {
        pop.remove()
        window.__accountPop = null
        logout()
        return
      }
      pop.remove()
      window.__accountPop = null
      state.view = 'settings'
      state.settingsTab = act === 'settings' ? 'general' : act
      render()
    })
  })

  setTimeout(() => document.addEventListener('click', function close(ev) {
    if (!pop.contains(ev.target) && ev.target.isConnected) { pop.remove(); window.__accountPop = null; document.removeEventListener('click', close) }
  }), 0)
}

/* ------------------------------ topbar ------------------------------ */

// 统一布局不再保留“企业空间 / 模块”面包屑顶栏；侧边栏开关移入菜单栏。
function renderTopbar() {
  const topbar = document.getElementById('topbar')
  if (!topbar) return
  topbar.innerHTML = ''
  topbar.hidden = true
}

function toggleGlobalSidebar() {
  if (!hasSidebarView()) return
  state.sbPinned = !state.sbPinned
  applyLayout()
  renderMenubar()
}

function openNotifications(anchor) {
  document.querySelectorAll('.notify-pop').forEach((p) => p.remove())
  const items = state.notifications
  const unread = items.filter((n) => n.unread).length
  const pop = document.createElement('div')
  pop.className = 'notify-pop'
  pop.innerHTML = `
    <div class="notify-head">
      <span class="notify-title">通知</span>
      <span class="notify-sub">${unread ? `${unread} 条未读` : '全部已读'}</span>
      <span class="spacer"></span>
      <button class="btn sm" id="readAll">全部已读</button>
    </div>
    <div class="notify-list">
      ${items.map((n) => `
        <button class="notify-item${n.unread ? ' unread' : ''}" data-nid="${n.id}" data-nav-to="${n.nav}">
          <span class="notify-mark ${n.kind}"></span>
          <span class="notify-copy">
            <span class="notify-name">${esc(n.title)}</span>
            <span class="notify-body">${esc(n.body)}</span>
            <span class="notify-time">${esc(n.time)}</span>
          </span>
        </button>`).join('')}
    </div>
    <div class="notify-foot">通知与审计同源：安全事件不可关闭，其余可在设置中调整</div>`

  document.body.appendChild(pop)
  const rect = anchor.getBoundingClientRect()
  pop.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 338))}px`
  const ph = pop.offsetHeight
  pop.style.top = `${Math.max(8, Math.min(window.innerHeight - ph - 8, rect.bottom + 8))}px`

  pop.querySelector('#readAll').addEventListener('click', async () => {
    await api('/api/notifications/read', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'all' }) })
    loadNotifications()
    pop.remove()
  })
  pop.querySelectorAll('[data-nid]').forEach((b) => {
    b.addEventListener('click', async () => {
      await api('/api/notifications/read', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: b.dataset.nid }) })
      await loadNotifications()
      pop.remove()
      state.view = b.dataset.navTo
      render()
    })
  })

  setTimeout(() => document.addEventListener('click', function close(ev) {
    if (!pop.contains(ev.target) && !anchor.contains(ev.target)) { pop.remove(); document.removeEventListener('click', close) }
  }), 0)
}

async function loadNotifications() {
  const { body } = await api('/api/notifications')
  state.notifications = body.items || []
}

/* --------------------------- 全局搜索面板 --------------------------- */

async function openSearchPalette(initial = '') {
  document.querySelectorAll('.search-overlay,.sp-backdrop').forEach((p) => p.remove())
  const { modules } = state.boot
  const visible = (id) => state.boot.user.visibleModules.includes(id)

  const wrap = document.createElement('div')
  wrap.className = 'search-overlay'
  wrap.innerHTML = `
    <div class="search-modal" role="dialog" aria-modal="true" aria-label="搜索九规智能中枢">
      <div class="search-top">
        <input id="spInput" class="search-input" placeholder="搜索 九规智能中枢" autocomplete="off" spellcheck="false" value="${esc(initial)}" />
        <span class="search-esc">Esc</span>
      </div>
      <div class="search-results" id="spBody"></div>
      <div class="search-tabs" role="tablist" aria-label="搜索范围">
        <button class="search-tab on" data-filter="all" role="tab" aria-selected="true">全部</button>
        <button class="search-tab" data-filter="actions" role="tab" aria-selected="false">操作</button>
        <button class="search-tab" data-filter="chats" role="tab" aria-selected="false">聊天</button>
      </div>
    </div>`
  document.body.appendChild(wrap)
  const modal = wrap.querySelector('.search-modal')
  const input = wrap.querySelector('#spInput')
  const body = wrap.querySelector('#spBody')
  let filter = 'all'
  let rows = []
  let active = 0
  input.focus()
  input.setSelectionRange(input.value.length, input.value.length)

  const close = () => {
    wrap.remove()
    document.removeEventListener('keydown', onKey)
  }
  const go = (id) => { close(); state.view = id; render() }
  const newChat = () => {
    close()
    state.conversation = null
    state.chatSteps = []
    state.chatError = ''
    state.activeProjectId = ''
    state.activeProjectName = ''
    state.activeProjectCwd = ''
    state.view = 'home'
    render()
    setTimeout(() => document.getElementById('draft')?.focus(), 60)
  }

  const quickActions = [
    { id: 'new', label: '新聊天', kbd: 'Ctrl+N', ic: 'pen', keywords: '新聊天 新建 对话', run: newChat },
    { id: 'folder', label: '打开文件夹', kbd: 'Ctrl+O', ic: 'folder', keywords: '打开 文件夹 云空间 资料', run: () => go('drive') },
  ]

  const settingIcons = {
    general: 'gear', appearance: 'spark', notifications: 'bell', profile: 'users',
    network: 'globe', models: 'spark', usage: 'chart', data: 'download',
    integrations: 'grid', runtime: 'play', mcp: 'layers', about: 'book',
  }
  const settingContent = {
    general: '权限 默认工作区 文件读写 工具自动执行 互联网访问 默认模型 界面语言 关闭窗口前确认 启动 状态栏 自动执行',
    appearance: '主题 深色 浅色 跟随系统 密度 字号 侧栏 品牌色 外观 个性化',
    notifications: '通知 任务 审批 授权 涉密 维护 渠道 免打扰 声音 角标',
    profile: '姓名 编码 岗位 任职 认证 设备 授权 头像 个人资料',
    network: '网络 政务网 互联网 涉密内网 令牌 凭证 诊断 代理 证书 网络与凭证',
    models: '模型 密钥 外发 个人 Key 默认模型 推理 网关 模型与密钥',
    usage: 'token 用量 配额 账单 超额 模型 统计 用量与配额',
    data: '保留 导出 缓存 归档 导入 数据管理 清理 存储',
    integrations: '插件 技能 MCP 工具 地址 安装 启用 插件与工具',
    runtime: 'Agent 运行时 设置中心 运行时 Agent loop 模型路由 shell subagent 会话日志 配置 执行策略 推理强度',
    mcp: 'MCP 资源 数据中心 通知 服务器 工具 健康 订阅 连接',
    about: '版本 基线 更新 帮助 关于',
  }
  const settingActions = settingsTabs
    .filter((t) => t.scope === 'personal')
    .map((t) => ({
      id: t.id,
      label: t.label,
      ic: settingIcons[t.id] || 'gear',
      keywords: `${t.label} ${t.kw || ''} ${settingContent[t.id] || ''}`,
      run: () => {
        close()
        state.view = 'settings'
        state.settingsTab = t.id
        state.settingsQuery = ''
        render()
      },
    }))

  const settingItemSeeds = [
    { tab: 'general', group: '权限', label: '默认工作区文件读写', desc: '允许在工作区内读取与整理文件；访问工作区外目录需单次授权', kw: '文件读写 工作区外 授权 读写权限' },
    { tab: 'general', group: '权限', label: '工具自动执行', desc: '仅低风险只读工具可自动执行；写操作与高危调用始终二次确认', kw: '自动执行 只读工具 高危 二次确认' },
    { tab: 'general', group: '权限', label: '互联网访问', desc: '涉密内网环境不可开启；外发内容按数据级别策略控制', kw: '联网 外发 涉密 数据级别' },
    { tab: 'general', group: '常规', label: '默认工作区', desc: '会话与任务的默认落盘位置，仍受数据中心授权约束', kw: '工作区 落盘 目录 路径 存储' },
    { tab: 'general', group: '常规', label: '默认模型', desc: '逻辑模型标识稳定，展示名与版本由平台统一维护', kw: '模型 默认 云模型 路由' },
    { tab: 'general', group: '常规', label: '界面语言', desc: '界面文案语言，不改变数据内容的语言', kw: '语言 中文 自动检测' },
    { tab: 'general', group: '常规', label: '关闭窗口前确认', desc: '使用关闭快捷键导致窗口关闭时给出提示', kw: '关闭 快捷键 确认 窗口' },
    { tab: 'general', group: '常规', label: '登录时启动应用', desc: '开机后随系统登录自动启动客户端', kw: '开机 启动 登录 自启动' },
    { tab: 'general', group: '常规', label: '底部状态栏', desc: '在客户端底部显示网络域、任务与连接状态', kw: '状态栏 网络域 连接 任务' },
    { tab: 'appearance', group: '界面', label: '主题', desc: '企业规范以浅色为主，深色用于夜间与投屏场景', kw: '浅色 深色 夜间 跟随系统 外观' },
    { tab: 'appearance', group: '界面', label: '界面密度', desc: '影响列表行高与卡片间距', kw: '密度 紧凑 行高 间距' },
    { tab: 'appearance', group: '界面', label: '正文字号', desc: '仅影响会话与文档阅读区', kw: '字号 字体 阅读 文本大小' },
    { tab: 'appearance', group: '界面', label: '侧栏默认展开', desc: '启动时展开导航；窄窗口自动收起', kw: '侧栏 展开 导航 窄窗口' },
    { tab: 'appearance', group: '品牌', label: '强调色', desc: '用于选中态、链接与生成按钮；默认蓝色，可切换为绿、黄、粉、橙、紫、黑、灰', kw: '品牌色 主题色 蓝色 选中态 链接' },
    { tab: 'appearance', group: '品牌', label: '客户端标识', desc: '启动页与关于页展示的企业名称', kw: '标识 企业名称 启动页 关于页' },
    { tab: 'appearance', group: '企业工作台', label: '收起与置顶', desc: '选择哪些企业模块收进图标栏的「更多」，AI 工作台不参与调整', kw: '图标栏 更多 模块 置顶' },
    { tab: 'notifications', group: '提醒类型', label: '任务完成提醒', desc: '自动化任务与长任务结束、失败时提醒', kw: '任务 完成 失败 提醒' },
    { tab: 'notifications', group: '提醒类型', label: '审批与授权变更', desc: '授权范围、应用审核、工单状态变化时提醒', kw: '审批 授权 工单 应用审核' },
    { tab: 'notifications', group: '提醒类型', label: '涉密访问被拒绝', desc: '安全事件必达，不可关闭', kw: '涉密 拒绝 安全事件 不可关闭' },
    { tab: 'notifications', group: '提醒类型', label: '系统维护通知', desc: '客户端与服务端维护窗口提前告知', kw: '维护 窗口 系统通知' },
    { tab: 'notifications', group: '投递', label: '通知渠道', desc: '站内消息为默认渠道，邮件需本域邮件服务已接入', kw: '站内消息 邮件 渠道 投递' },
    { tab: 'notifications', group: '投递', label: '免打扰时段', desc: '该时段内仅保留安全事件提醒', kw: '免打扰 静音 时段 夜间' },
    { tab: 'profile', group: '身份', label: '姓名', desc: '当前登录账号的姓名', kw: '姓名 名字 账号' },
    { tab: 'profile', group: '身份', label: '员工编码', desc: '集团唯一编码，跨网一致；各网络独立认证', kw: '员工编码 工号 跨网 认证' },
    { tab: 'profile', group: '身份', label: '所属单位', desc: '当前账号所属组织与单位', kw: '单位 组织 部门 所属' },
    { tab: 'profile', group: '身份', label: '岗位', desc: '一人多岗时以主岗展示，兼任关系在授权服务维护', kw: '岗位 主岗 兼任 职责' },
    { tab: 'profile', group: '安全', label: '登录密码', desc: '账号密码登录与首次登录改密', kw: '密码 修改 登录 password' },
    { tab: 'profile', group: '安全', label: '二次认证', desc: '登录与高危操作需二次认证，认证记录进审计', kw: '二次认证 MFA 高危 审计 重新认证' },
    { tab: 'profile', group: '安全', label: '当前设备', desc: 'Windows 客户端版本与本机内网地址段', kw: '设备 终端 客户端 登录设备' },
    { tab: 'network', group: '网络', label: '当前网络', desc: '决定可用模型、数据源与工具集合', kw: '当前网络 安全域 模型 数据源' },
    { tab: 'network', group: '网络', label: '涉密内网', desc: '已连接，本地推理与涉密数据源可用', kw: '涉密 内网 本地推理 连接' },
    { tab: 'network', group: '网络', label: '政务网', desc: '独立实例，未在本机接入', kw: '政务网 实例 接入' },
    { tab: 'network', group: '网络', label: '互联网', desc: '隔离，未经批准不得跨网访问', kw: '互联网 隔离 跨网 外网' },
    { tab: 'network', group: '网络', label: '网络诊断', desc: '检查模型连通性、数据中心接口与证书有效期', kw: '诊断 连通性 证书 接口 检测' },
    { tab: 'network', group: '凭证', label: '政务模型 Token', desc: '由服务端持有，客户端不落盘、不展示', kw: 'token 令牌 政务模型 服务端' },
    { tab: 'network', group: '凭证', label: '操作系统凭证库', desc: '个人密钥存入系统受保护存储，不以明文出现在配置与日志', kw: '凭证库 keychain 密钥 明文' },
    { tab: 'network', group: '凭证', label: '会话有效期', desc: '超过时限需重新认证，长任务由服务端续跑', kw: '会话 有效期 超时 重新认证' },
    { tab: 'models', group: '可用模型', label: '企业统一模型', desc: '逻辑 ID jg-enterprise；展示名与版本由平台维护', kw: '企业模型 统一模型 jg-enterprise 可用' },
    { tab: 'models', group: '可用模型', label: '内网推理模型', desc: '本地推理模型，量化格式待实测确认', kw: '内网 推理 本地 量化' },
    { tab: 'models', group: '可用模型', label: '政务模型', desc: '九江统一政务模型；Token 服务端持有，按配额计量', kw: '政务 模型 配额 九江' },
    { tab: 'models', group: '个人密钥', label: '个人 API Key', desc: '仅互联网环境使用；涉密内容禁止经个人密钥外发', kw: 'API Key 个人密钥 key 外发' },
    { tab: 'models', group: '个人密钥', label: '数据外发策略', desc: '决定个人模型可接触的数据级别', kw: '外发 数据级别 涉密 敏感 审批' },
    { tab: 'usage', group: '真实计量', label: '累计 tokens', desc: '来自每轮运行时返回的 usage；没有 usage 的轮次不计入', kw: 'token 累计 用量 统计' },
    { tab: 'usage', group: '真实计量', label: '输入 / 输出', desc: '输入 = 上下文与提示词；输出 = 模型生成', kw: '输入 输出 上下文 提示词 生成' },
    { tab: 'usage', group: '真实计量', label: '模型调用次数', desc: '按真实 usage.calls 汇总，不是前端点击次数', kw: '调用 次数 请求 usage' },
    { tab: 'usage', group: '真实计量', label: '缓存读 / 写', desc: '缓存命中与写入分别计量', kw: '缓存 命中 读取 写入' },
    { tab: 'usage', group: '真实计量', label: '推理 tokens', desc: '仅统计上游返回的 reasoning_tokens', kw: '推理 reasoning 思考 token' },
    { tab: 'usage', group: '真实计量', label: '采集覆盖', desc: '只统计已落库的真实计量，不用估算值补齐', kw: '采集 覆盖 落库 估算 助手消息' },
    { tab: 'usage', group: '口径', label: '数据来源', desc: '本机会话库中的助手消息 usageAt / usage 字段，刷新后从服务端重新聚合', kw: '来源 会话库 usage 聚合' },
    { tab: 'usage', group: '口径', label: '不计入项', desc: '历史轮次未返回 usage 的部分、失败且无 usage 的请求、客户端本地估算', kw: '不计入 失败 估算 历史' },
    { tab: 'data', group: '会话与任务', label: '会话保留期', desc: '服务端保留会话与结果的期限，到期归档', kw: '保留 期限 归档 180天 90天 30天' },
    { tab: 'data', group: '会话与任务', label: '导出会话', desc: '导出为 Markdown 或 JSON；涉密内容导出需审批并留痕', kw: '导出 markdown json 审批 留痕' },
    { tab: 'data', group: '会话与任务', label: '归档会话', desc: '查看已归档会话与任务记录', kw: '归档 历史 会话记录 任务记录' },
    { tab: 'data', group: '本机', label: '本地缓存', desc: '仅缓存界面资源与会话索引；业务数据不在客户端留存', kw: '缓存 清理 客户端 留存' },
    { tab: 'data', group: '本机', label: '离线可用', desc: '缓存最近会话与文档摘要，断网时可读不可写', kw: '离线 断网 可读 文档摘要' },
    { tab: 'integrations', group: '已启用', label: '运行时技能', desc: '技能按账号或项目安装；平台公共能力由管理中心统一配置', kw: '技能 运行时 安装 项目' },
    { tab: 'integrations', group: '已启用', label: '个人技能', desc: '仅本人可用；发布给他人需走企业技能审核', kw: '个人技能 审核 发布 本人' },
    { tab: 'integrations', group: 'MCP 与接口', label: 'MCP 服务地址', desc: '本域工具服务，连接前校验证书与授权范围', kw: 'MCP 地址 服务 证书 授权 连接测试' },
    { tab: 'integrations', group: 'MCP 与接口', label: '写操作确认', desc: 'MCP 工具的写操作默认二次确认，不可全局关闭', kw: '写操作 确认 二次确认 不可关闭' },
    { tab: 'runtime', group: '新会话默认值', label: '默认执行策略', desc: '只影响新开的会话；当前会话可在输入框内单独切换', kw: '执行策略 帮我批准 请求批准 新会话' },
    { tab: 'runtime', group: '新会话默认值', label: '默认推理强度', desc: '只影响新开的会话；低/中/高映射到模型实际支持的强度档', kw: '推理强度 低 中 高 思考' },
    { tab: 'runtime', group: '新会话默认值', label: '每轮文件变更摘要', desc: '执行前后对项目目录做只读快照并列出新增/修改/删除；关闭后不再生成该块', kw: '文件变更 摘要 快照 新增 修改 删除' },
    { tab: 'runtime', group: '运行时状态', label: 'DSH 版本', desc: '当前锁定并实际加载的 DeepSeek Harness 版本', kw: 'DSH 版本 harness 运行时' },
    { tab: 'runtime', group: '运行时状态', label: '加载 profile', desc: 'SDK 运行时使用的 profile 名称', kw: 'profile 配置 加载 sdk' },
    { tab: 'runtime', group: '运行时状态', label: '配置条目', desc: '当前 profile dump 中的插件条目总数', kw: '配置 条目 插件 dump' },
    { tab: 'runtime', group: '运行时状态', label: '活跃运行时', desc: '当前进程内已持有沙箱根运行时的数量', kw: '活跃 运行时 沙箱 进程' },
    { tab: 'runtime', group: '运行时状态', label: '会话', desc: '事务库中的会话总数与仍在运行的数量', kw: '会话 运行中 事务库' },
    { tab: 'runtime', group: '运行时状态', label: '状态刷新', desc: '重新读取本机运行时与配置快照', kw: '刷新 状态 快照 重新读取' },
    { tab: 'runtime', group: '配置与日志位置', label: 'Profile patch', desc: '设置写入平台快照；此文件为当前 profile 的叠加配置', kw: 'patch 配置 叠加 路径' },
    { tab: 'runtime', group: '配置与日志位置', label: '配置快照', desc: '能力盘点所用的实际挂载配置，只读', kw: '快照 挂载 只读 能力盘点' },
    { tab: 'runtime', group: '配置与日志位置', label: '会话日志', desc: '原始会话日志目录，由运行时写入，平台只读索引', kw: '日志 目录 会话 只读 索引' },
    { tab: 'runtime', group: 'DSH 原生设置（只读）', label: '配置权威', desc: '产品设置中心是唯一可写入口；原生设置仅供运行时使用', kw: '配置权威 唯一可写 产品设置' },
    { tab: 'runtime', group: 'DSH 原生设置（只读）', label: '原生 settings', desc: '运行时插件，负责 schema 表单与配置投影；产品只读状态，不写入', kw: '原生 settings schema 投影' },
    { tab: 'runtime', group: 'DSH 原生设置（只读）', label: '原生 config-editor', desc: 'DSH 自带的配置编辑入口；产品不暴露，避免绕过产品设置', kw: 'config-editor 配置编辑 绕过' },
    { tab: 'runtime', group: 'DSH 原生设置（只读）', label: '原生 authorization', desc: '运行时授权插件；审批策略仍以产品设置与输入框切换为准', kw: '授权 authorization 审批策略' },
    { tab: 'runtime', group: 'DSH 原生设置（只读）', label: '原生会话检索', desc: '通过 session-query 让模型检索当前工作区的历史会话', kw: '会话检索 历史 工作区 session-query' },
    { tab: 'runtime', group: 'DSH 原生设置（只读）', label: '会话导出', desc: '产品按真实消息记录导出 Markdown；原生会话日志继续由运行时保存', kw: '导出 markdown 消息记录 日志' },
    { tab: 'runtime', group: 'DSH 原生设置（只读）', label: '凭据文件', desc: '本地凭据文件；产品不读取内容，也不允许从这里取模型密钥', kw: '凭据 文件 密钥 不读取' },
    { tab: 'runtime', group: 'DSH 原生设置（只读）', label: '模型密钥来源', desc: '模型密钥由产品「模型与密钥」保存，按会话注入子进程环境', kw: '模型密钥 来源 子进程 环境变量' },
    { tab: 'runtime', group: 'PTC 与实验执行器', label: 'workflow-ptc', desc: '工作流内的程序化调用已挂载，可供工作流使用', kw: 'workflow ptc 工作流 程序化调用' },
    { tab: 'runtime', group: 'PTC 与实验执行器', label: '直接 tool-executor-ptc', desc: '默认关闭：会改变模型调用工具的协议，并使嵌套工具调用难以逐步确认', kw: 'tool-executor ptc 默认关闭 嵌套调用' },
    { tab: 'runtime', group: '技能目录（只读）', label: '目录技能', desc: '运行时实际加载的目录技能', kw: '目录技能 skills 加载' },
    { tab: 'runtime', group: '技能目录（只读）', label: 'Office 技能', desc: '通过 skill-office 插件加载，不在 skills 目录中', kw: 'office 技能 插件 skill-office' },
    { tab: 'runtime', group: '技能目录（只读）', label: '技能根目录', desc: '技能文件所在根目录，只读', kw: '技能根目录 路径 只读' },
    { tab: 'runtime', group: '会话检查点（只读）', label: '检查点策略', desc: '模型请求、顶层工具调用前做语义持久化；保证会话可恢复，不是文件内容备份', kw: '检查点 持久化 可恢复 备份' },
    { tab: 'runtime', group: '会话检查点（只读）', label: '文件回滚', desc: '当前只记录文件大小与修改时间，不能还原文件内容', kw: '文件回滚 还原 修改时间' },
    { tab: 'runtime', group: 'DSH 插件运行时', label: '插件条目', desc: '查看当前 profile 的真实挂载清单，启停单个条目；重启运行时后生效', kw: '插件 挂载 启停 重启 清单' },
    { tab: 'runtime', group: 'Agent 预设', label: '预设', desc: '保存常用 Agent 的行为要求、默认策略与推理强度；只影响新会话', kw: '预设 agent 行为要求 推理强度' },
    { tab: 'mcp', group: '服务状态', label: 'MCP 服务', desc: '本域产品工具以 stdio 接入 Harness，资源目录与工具共用同一身份', kw: 'MCP 服务 stdio 连接 身份' },
    { tab: 'mcp', group: '服务状态', label: '服务名与命名空间', desc: '模型侧工具名形如 mcp__jg__drive_search，资源按 jg:// 寻址', kw: '命名空间 服务名 mcp__jg jg://' },
    { tab: 'mcp', group: '服务状态', label: '能力', desc: '工具列表、资源列表、资源模板与资源读取均已声明', kw: '能力 tools resources 模板 读取' },
    { tab: 'mcp', group: '服务状态', label: '订阅', desc: '当前服务未声明资源变更订阅，页面按手动刷新读取', kw: '订阅 资源变更 刷新' },
    { tab: 'mcp', group: '资源目录', label: '资源检索', desc: '按名称、说明、类型或 URI 过滤当前身份可见的资源', kw: '资源检索 名称 说明 类型 URI' },
    { tab: 'about', group: '版本', label: '客户端版本', desc: 'Windows 客户端，随内网离线包分发', kw: '客户端 版本 windows 离线包' },
    { tab: 'about', group: '版本', label: '运行时基线', desc: 'DeepSeek Harness，锁定版本并按季度吸收上游补丁', kw: '运行时 基线 harness 补丁' },
    { tab: 'about', group: '版本', label: '更新通道', desc: '内网离线包，更新前完成回归与签名校验', kw: '更新 通道 回归 签名 校验' },
    { tab: 'about', group: '帮助', label: '帮助与反馈', desc: '内网文档站与工单由本域运维受理', kw: '帮助 反馈 文档 工单 运维' },
    { tab: 'about', group: '帮助', label: '许可与合规', desc: '使用范围受集团信息安全制度与数据分级约束', kw: '许可 合规 制度 数据分级' },
  ]
  const settingItems = settingItemSeeds.map((x, i) => ({
    ...x,
    id: `si-${i}`,
    ic: settingIcons[x.tab] || 'gear',
    tabLabel: settingsTabs.find((t) => t.id === x.tab)?.label || x.tab,
    keywords: `${x.label} ${x.desc || ''} ${x.kw || ''} ${x.group}`,
  }))

  const settingItemRow = (a) => `<button class="search-row" data-setting="${a.id}">
    <span class="search-row-ico">${icon(a.ic)}</span>
    <span class="search-row-main">${esc(a.label)}</span>
    <span class="search-row-meta">${esc(a.tabLabel)} · ${esc(a.group)}</span>
  </button>`

  const placeholders = { all: '搜索 九规智能中枢', actions: '搜索操作', chats: '搜索聊天' }

  const [res, appsRes, prjRes, convRes] = await Promise.all([
    api('/api/resources'), api('/api/apps'), api('/api/projects'), api('/api/conversations?withText=1'),
  ])
  if (!wrap.isConnected) return
  const resources = res.ok ? res.body.items || [] : []
  const apps = appsRes.ok ? appsRes.body.items || [] : []
  const projects = prjRes.ok ? prjRes.body.items || [] : []
  const tasks = state.tasks || []
  const conversations = convRes.ok ? convRes.body.items || [] : (state.conversations || [])
  const navRows = Object.keys(modules).filter(visible)

  const q = () => input.value.trim().toLowerCase()
  const matchPos = (text, value) => {
    const s = String(text || '')
    if (!value) return 0
    if (/^[a-z0-9_+-]{1,3}$/.test(value)) {
      const escRe = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(`(^|[^a-z0-9_])${escRe}(?=$|[^a-z0-9_])`, 'i')
      const m = re.exec(s)
      return m ? m.index + (m[1] ? m[1].length : 0) : -1
    }
    return s.toLowerCase().indexOf(value)
  }
  const hit = (s) => matchPos(s, q()) >= 0
  const section = (title, inner) => inner ? `<div class="search-section"><div class="search-section-title">${title}</div>${inner}</div>` : ''

  const actionRow = (a) => `<button class="search-row" data-qaction="${a.id}">
    <span class="search-row-ico">${icon(a.ic)}</span>
    <span class="search-row-main">${esc(a.label)}</span>
    <span class="search-kbd">${esc(a.kbd)}</span>
  </button>`

  const settingRow = (a) => `<button class="search-row" data-qaction="${a.id}">
    <span class="search-row-ico">${icon(a.ic)}</span>
    <span class="search-row-main">${esc(a.label)}</span>
  </button>`

  const findSnippet = (text, query) => {
    if (!text || !query) return ''
    const idx = matchPos(text, query)
    if (idx < 0) return ''
    const start = Math.max(0, idx - 10)
    const end = Math.min(text.length, idx + query.length + 26)
    return `${start > 0 ? '…' : ''}${text.slice(start, end).replace(/\s+/g, ' ')}${end < text.length ? '…' : ''}`
  }

  const bubbleIco = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-5 4v-13a2 2 0 0 1 2-2z"/></svg>`

  const convRow = (c, query = '') => {
    const proj = projects.find((p) => p.id === c.projectId)
    const bodyMeta = findSnippet(c.searchText || '', query)
    const meta = bodyMeta || proj?.name || ''
    return `<button class="search-row" data-conv="${esc(c.id)}">
    <span class="search-row-ico bubble" aria-hidden="true">${bubbleIco}</span>
    <span class="search-row-main">${esc(c.title || '未命名会话')}</span>
    ${meta ? `<span class="search-row-meta">${esc(meta)}</span>` : ''}
  </button>`
  }

  const navRow = (id) => `<button class="search-row" data-view="${id}">
    <span class="search-row-ico">${icon(navIcon(id))}</span>
    <span class="search-row-main">${esc(modules[id].label)}</span>
    <span class="search-row-meta">导航</span>
  </button>`

  const resourceRow = (r) => `<button class="search-row" data-res="${esc(r.id)}">
    <span class="search-row-ico">${icon('database')}</span>
    <span class="search-row-main">${esc(r.name)}</span>
    <span class="search-row-meta">${esc(r.type || '资源')} · ${esc(r.source || '数据中心')}</span>
  </button>`

  const appRow = (a) => `<button class="search-row" data-view="skills">
    <span class="search-row-ico">${icon('grid')}</span>
    <span class="search-row-main">${esc(a.name)}</span>
    <span class="search-row-meta">应用 · ${esc(a.category || '内置')}</span>
  </button>`

  const taskRow = (t) => `<button class="search-row" data-view="tasks">
    <span class="search-row-ico">${icon('task')}</span>
    <span class="search-row-main">${esc(t.title || t.name)}</span>
    <span class="search-row-meta">任务 · ${esc(t.status || '')}</span>
  </button>`

  const projectRow = (p) => `<button class="search-row" data-project="${esc(p.id)}">
    <span class="search-row-ico">${icon('folder')}</span>
    <span class="search-row-main">${esc(p.name)}</span>
    <span class="search-row-meta">项目</span>
  </button>`

  const paint = () => {
    const query = q()
    const parts = []
    if (filter === 'all' || filter === 'actions') {
      const acts = quickActions.filter((a) => hit(`${a.label} ${a.keywords}`))
      const tabsMatched = settingActions.filter((a) => hit(`${a.label} ${a.keywords}`))
      const itemsMatched = settingItems.filter((a) => hit(`${a.keywords} ${a.tabLabel}`))
      const setHtml = query
        ? itemsMatched.slice(0, filter === 'actions' ? itemsMatched.length : 6).map(settingItemRow).join('')
        : tabsMatched.map(settingRow).join('')
      parts.push(section('快捷操作', acts.map(actionRow).join('')))
      parts.push(section('设置', setHtml))
    }
    if (filter === 'all' || filter === 'chats') {
      const matched = conversations.filter((c) => hit(`${c.title || ''}\n${c.searchText || ''}`))
      if (query) {
        matched.sort((a, b) => (matchPos(a.title, query) >= 0 ? 0 : 1) - (matchPos(b.title, query) >= 0 ? 0 : 1))
      }
      const shown = query ? matched : matched.slice(0, 8)
      parts.push(section('聊天', shown.map((c) => convRow(c, query)).join('')))
    }
    if (filter === 'all' && query) {
      parts.push(section('导航', navRows.filter((id) => hit(modules[id].label)).slice(0, 5).map(navRow).join('')))
      parts.push(section('资源', resources.filter((r) => hit(`${r.name} ${r.source || ''} ${r.dataOwner || ''}`)).slice(0, 5).map(resourceRow).join('')))
      parts.push(section('项目', projects.filter((p) => hit(`${p.name || ''} ${p.desc || ''}`)).slice(0, 4).map(projectRow).join('')))
      parts.push(section('应用', apps.filter((a) => hit(`${a.name || ''} ${a.category || ''}`)).slice(0, 4).map(appRow).join('')))
      parts.push(section('任务', tasks.filter((t) => hit(`${t.title || t.name || ''} ${t.status || ''}`)).slice(0, 4).map(taskRow).join('')))
    }
    body.innerHTML = parts.filter(Boolean).join('')
    if (!parts.filter(Boolean).length) {
      body.innerHTML = `<div class="search-empty">没有找到「${esc(input.value.trim())}」相关结果</div>`
    }
    rows = Array.from(body.querySelectorAll('.search-row'))
    active = rows.length ? 0 : -1
    paintActive()
    bindRows()
  }

  const paintActive = () => {
    rows.forEach((r, i) => r.classList.toggle('on', i === active))
  }

  const bindRows = () => {
    body.querySelectorAll('[data-qaction]').forEach((b) => b.addEventListener('click', () => {
      const act = quickActions.find((a) => a.id === b.dataset.qaction) || settingActions.find((a) => a.id === b.dataset.qaction)
      if (act) act.run()
    }))
    body.querySelectorAll('[data-setting]').forEach((b) => b.addEventListener('click', () => {
      const item = settingItems.find((x) => x.id === b.dataset.setting)
      if (!item) return
      close()
      state.view = 'settings'
      state.settingsTab = item.tab
      state.settingsQuery = ''
      state.settingsFocus = item.label
      render()
    }))
    body.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => go(b.dataset.view)))
    body.querySelectorAll('[data-res]').forEach((b) => b.addEventListener('click', () => { close(); openResource(b.dataset.res) }))
    body.querySelectorAll('[data-project]').forEach((b) => b.addEventListener('click', () => { close(); openProject(b.dataset.project) }))
    body.querySelectorAll('[data-conv]').forEach((b) => b.addEventListener('click', () => { close(); openConversation(b.dataset.conv) }))
  }

  wrap.querySelectorAll('.search-tab').forEach((b) => b.addEventListener('click', () => {
    filter = b.dataset.filter
    wrap.querySelectorAll('.search-tab').forEach((x) => {
      const on = x === b
      x.classList.toggle('on', on)
      x.setAttribute('aria-selected', on ? 'true' : 'false')
    })
    input.value = ''
    input.placeholder = placeholders[filter] || placeholders.all
    paint()
    input.focus()
  }))

  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!rows.length) return
      e.preventDefault()
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length
      paintActive()
      rows[active].scrollIntoView({ block: 'nearest' })
      return
    }
    if (e.key === 'Enter') {
      if (!input.value.trim() || !rows.length) return
      e.preventDefault()
      rows[Math.max(active, 0)]?.click()
    }
  }

  input.addEventListener('input', paint)
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close() })
  document.addEventListener('keydown', onKey)
  paint()
}

/* -------------------------------- views ----------------------------- */

async function renderViewInner() {
  const view = document.getElementById('view')
  if (!state.boot.authed) return renderLogin(view)
  if (state.boot.mustChangePassword) return renderPasswordSetup(view)
  const guestBase = ['home', 'settings', 'imagegen', 'cloudbrowser', 'more']
  const guestGrants = (state.boot.user.grants || [])
  if (state.boot.user.role === 'guest' && !guestBase.includes(state.view) && !guestGrants.includes(state.view)) {
    return renderGuestShell(view, state.view)
  }
  if (state.view === 'home') return renderHome(view)
  if (state.view === 'chat') return renderChat(view)
  if (state.view === 'history') return renderHistory(view)
  if (state.view === 'projects') return renderProjects(view)
  if (state.view === 'datacenter') return renderDatacenter(view)
  if (state.view === 'formats') return renderFormats(view)
  if (state.view === 'skills') return renderSkills(view)
  if (state.view === 'apps') return renderApps(view)
  if (state.view === 'settings') return renderSettings(view)
  if (state.view === 'tasks') {
    try { return await renderTaskCenter(view) } catch (e) {
      window.__viewErr = 'tasks: ' + e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 4).join(' | ')
      view.innerHTML = '<div style="padding:24px;font-family:monospace;white-space:pre-wrap">TASKERR ' + esc(window.__viewErr) + '</div>'
      return
    }
  }
  if (state.view === 'admin') return renderAdmin(view)
  if (state.view === 'codereview') return renderCodeReview(view)
  if (state.view === 'automation') return renderTaskCenter(view)
  if (state.view === 'knowledge') {
    try { return await renderNotebook(view) } catch (e) {
      view.innerHTML = '<div style="padding:24px;font-family:monospace">NBERR: ' + esc(e.message) + '<pre style="white-space:pre-wrap">' + esc((e.stack || '').slice(0, 700)) + '</pre></div>'
      return
    }
  }
  if (state.view === 'imagegen') return renderImage(view)
  if (state.view === 'drive') return renderDrive(view)
  if (state.view === 'contacts') return renderContacts(view)
  if (state.view === 'im') return renderIM(view)
  if (state.view === 'notice') return renderNotices(view)
  if (state.view === 'academy') return renderAcademy(view)
  return renderPlaceholder(view)
}

/** 所有模块统一从这里进入渲染，渲染完由 AppLayout 接管侧栏挂载。 */
async function renderView() {
  await renderViewInner()
  mountPageSidebar()
  requestAnimationFrame(syncPaneScrollbars)
}

/** 业务侧栏只有真正溢出时才显示滑轨，避免空内容或轻微溢出也常驻一条轨道线。 */
let paneScrollObserver = null
function syncPaneScrollbars() {
  const sidebar = document.getElementById('sidebar')
  if (!sidebar) return
  const panels = sidebar.querySelectorAll('[data-scrollwatch],.tk-left,.sk-left,.nt-left,.im-left,.ac-left,.mc-nav,.settings-side,.layout-sidebar-content,.pl-installed,.sidebar-scroll')
  panels.forEach((el) => {
    if (!el.dataset.scrollwatch) {
      if (!/^(auto|scroll)$/.test(getComputedStyle(el).overflowY)) return
      el.dataset.scrollwatch = '1'
    }
    const overflowing = el.scrollHeight - el.clientHeight > 16
    el.toggleAttribute('data-side-scroll', overflowing)
    el.style.setProperty('overflow-y', overflowing ? 'auto' : 'hidden', 'important')
  })
  if (!paneScrollObserver) {
    paneScrollObserver = new MutationObserver(() => requestAnimationFrame(syncPaneScrollbars))
    paneScrollObserver.observe(sidebar, { childList: true, subtree: true })
  }
  if (!sidebar.dataset.scrollHoverBound) {
    sidebar.dataset.scrollHoverBound = '1'
    const clearHot = () => sidebar.querySelectorAll('[data-side-scroll].scroll-hot').forEach((el) => el.classList.remove('scroll-hot'))
    sidebar.addEventListener('pointermove', (e) => {
      sidebar.querySelectorAll('[data-side-scroll]').forEach((el) => {
        const r = el.getBoundingClientRect()
        const nearRail = e.clientX >= r.right - 16 && e.clientX <= r.right + 2 && e.clientY >= r.top && e.clientY <= r.bottom
        el.classList.toggle('scroll-hot', nearRail)
      })
    }, { passive: true })
    sidebar.addEventListener('pointerleave', clearHot, { passive: true })
  }
}

function composerPlusItems() {
  const installed = (state.plugins || []).filter((p) => p.status === 'enabled')
  const skills = installed.filter((p) => p.kind === 'personal')
  const plugins = installed.filter((p) => p.kind !== 'personal')
  return [
    { act: 'attach', ic: 'plus', label: '添加照片和文件', desc: '从计算机上传' },
    { act: 'deepThink', ic: 'spark', label: `${state.deepThink ? '✓ ' : ''}深度思索`, desc: state.deepThink ? '已开启 · 当前会话使用推理模型' : 'DeepSeek Reasoner · 更深层推理' },
    { act: 'library', ic: 'database', label: '从资料库添加', desc: '浏览数据中心的资源' },
    { act: 'image', ic: 'image', label: '创建图像', desc: imagegenReady() ? `真实生图 · ${selectedImageModel()?.label || '图像服务'}` : (state.boot?.imageGeneration?.reason || '当前环境未启用真实生图'), off: !imagegenReady() },
    { act: 'web', ic: 'globe', label: '网页搜索', desc: state.webSearch ? '已启用 · 本轮会检索网页' : '使用平台 Web 搜索与抓取' },
    { act: 'project', ic: 'folder', label: '在项目中工作', desc: '在项目里开始对话' },
    { act: 'skillPicker', ic: 'layers', label: '技能', desc: skills.length ? `${skills.length} 项已启用 ›` : '暂无已启用技能 ›' },
    { act: 'pluginPicker', ic: 'plugin', label: '插件', desc: plugins.length ? `${plugins.length} 项已启用 ›` : '暂无已启用插件 ›' },
    { act: 'presetPicker', ic: 'target', label: 'Agent 预设', desc: state.agentPresets.length ? `${state.agentPresetId ? (state.agentPresets.find((x) => x.id === state.agentPresetId)?.name || '已选择') : `${state.agentPresets.length} 个`} ›` : '未创建 ›' },
    ...['agent-team', 'worktree'].map((id) => {
      const e = (state.agentEntries || []).find((x) => x.id === id) || { id, label: id === 'agent-team' ? 'Agent 团队' : '工作树', enabled: false, desc: '运行时未启用' }
      return { act: 'agentEntry', entry: id, ic: id === 'worktree' ? 'folder' : 'spark', label: e.label, desc: e.enabled ? e.desc : '运行时未启用', off: !e.enabled }
    }),
    { act: 'draw', ic: 'pen', label: '绘图', desc: '全屏画布 · 画笔、形状、文字与导出 PNG' },
    { act: 'sep' },
    { act: 'docx', ic: 'doc', label: '新建文档', desc: '.docx' },
    { act: 'pdf', ic: 'doc', label: '新建 PDF', desc: '.pdf' },
    { act: 'xlsx', ic: 'table', label: '新建表格', desc: '.xlsx' },
    { act: 'pptx', ic: 'layers', label: '新建演示', desc: '.pptx' },
  ]
}

function composerToolPickerItems(kind) {
  const installed = (state.plugins || []).filter((p) => p.status === 'enabled')
  const title = kind === 'skill' ? '选择技能' : '选择插件'
  const list = installed.filter((p) => (kind === 'skill' ? p.kind === 'personal' : p.kind === 'enterprise'))
  const rows = list.length ? list.map((p) => ({
    act: 'plugin',
    plugin: p.id,
    ic: 'tool',
    label: `${state.composerTools.includes(p.id) ? '✓ ' : ''}${p.name}`,
    desc: `${p.kind === 'personal' ? '个人技能' : '企业插件'} · ${p.desc}`,
  })) : [{ act: 'empty', ic: 'tool', label: `暂无已启用${kind === 'skill' ? '技能' : '插件'}`, desc: '可在「插件与技能」页安装', off: true }]
  return [
    { act: 'back', ic: 'back', label: '返回', desc: '上一级' },
    { act: 'picker-head', ic: kind === 'skill' ? 'spark' : 'plugin', label: title, desc: '可多选 · 再次点击取消', off: true },
    ...rows,
  ]
}

function composerPresetPickerItems() {
  const presets = state.agentPresets || []
  const rows = [
    { act: 'preset', preset: '', ic: 'check', label: `${state.agentPresetId ? '' : '✓ '}不使用预设`, desc: '只使用当前会话的执行策略与推理强度' },
    ...presets.map((p) => ({
      act: 'preset',
      preset: p.id,
      ic: 'target',
      label: `${state.agentPresetId === p.id ? '✓ ' : ''}${p.name}`,
      desc: `${p.defaultPolicy === 'manual' ? '请求批准' : '帮我批准'} · ${p.defaultEffort === 'high' ? '高' : p.defaultEffort === 'low' ? '低' : '中'}${p.description ? ` · ${p.description}` : ''}`,
    })),
  ]
  if (!presets.length) rows.push({ act: 'empty', ic: 'target', label: '还没有 Agent 预设', desc: '可在「设置 · Agent 运行时」创建', off: true })
  return [
    { act: 'back', ic: 'back', label: '返回', desc: '上一级' },
    { act: 'picker-head', ic: 'target', label: '选择 Agent 预设', desc: '应用预设的指令与默认策略 · 单选', off: true },
    ...rows,
  ]
}

function paintComposerPlus(pop, items, pickerKind) {
  pop.innerHTML = items.map((it) => (it.act === 'sep'
    ? '<div class="pp-sep"></div>'
    : `<button class="pp-row${it.off ? ' off' : ''}" data-plus="${it.act}"${it.plugin ? ` data-plugin="${esc(it.plugin)}"` : ''}${it.entry ? ` data-entry="${esc(it.entry)}"` : ''}${it.preset !== undefined ? ` data-preset="${esc(it.preset)}"` : ''}${it.off ? ' disabled' : ''}>
        <span class="ico pp-ico">${icon(it.ic)}</span>
        <span class="pp-label">${esc(it.label)}</span>
        <span class="pp-desc">${esc(it.desc || '')}</span>
      </button>`)).join('')
  pop.querySelectorAll('[data-plus]:not([disabled])').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation()
    const act = b.dataset.plus
    if (act === 'back') {
      paintComposerPlus(pop, composerPlusItems(), null)
      return
    }
    if (act === 'skillPicker') {
      paintComposerPlus(pop, composerToolPickerItems('skill'), 'skill')
      return
    }
    if (act === 'pluginPicker') {
      paintComposerPlus(pop, composerToolPickerItems('plugin'), 'plugin')
      return
    }
    if (act === 'presetPicker') {
      paintComposerPlus(pop, composerPresetPickerItems(), 'preset')
      return
    }
    if (act === 'preset') {
      state.agentPresetId = b.dataset.preset || ''
      const p = state.agentPresets.find((x) => x.id === state.agentPresetId)
      if (p) {
        state.executionPolicy = p.defaultPolicy === 'manual' ? 'manual' : 'auto'
        state.reasoningEffort = p.defaultEffort || state.reasoningEffort
      }
      pop.remove()
      render()
      toast(p ? `已应用 Agent 预设「${p.name}」` : '已取消 Agent 预设')
      return
    }
    if (act === 'plugin') {
      const id = b.dataset.plugin
      const p = (state.plugins || []).find((x) => x.id === id)
      state.composerTools = state.composerTools.includes(id)
        ? state.composerTools.filter((t) => t !== id)
        : [...state.composerTools, id]
      toast(state.composerTools.includes(id) ? `已启用「${p?.name || id}」，本次对话可调用` : `已停用「${p?.name || id}」`)
      if (pickerKind) {
        const top = pop.scrollTop
        paintComposerPlus(pop, composerToolPickerItems(pickerKind), pickerKind)
        pop.scrollTop = top
      } else {
        renderView()
      }
      return
    }
    pop.remove()
    window.__plusPop = null
    if (act === 'attach') openChatAttachment()
    if (act === 'library') openLibraryPicker()
    if (act === 'image') { state.view = 'imagegen'; render() }
    if (act === 'draw') openDrawingBoard()
    if (act === 'web') {
      state.webSearch = !state.webSearch
      renderView()
      toast(state.webSearch ? '网页搜索已启用，本轮回答将检索外部网页' : '网页搜索已关闭')
    }
    if (act === 'deepThink') toggleDeepThink()
    if (act === 'agentEntry') startAgentEntry(b.dataset.entry)
    if (act === 'project') openWorkspacePicker()
    if (['pdf', 'docx', 'xlsx', 'pptx'].includes(act)) openDocDialog(act)
  }))
}

function reasoningLabel(id) {
  return { low: '低', medium: '中', high: '高' }[id] || '中'
}

function toggleDeepThink() {
  if (state.chatBusy) return
  state.deepThink = !state.deepThink
  if (state.deepThink) state.reasoningEffort = 'high'
  renderView()
  toast(state.deepThink ? '已开启深度思索：当前会话使用 DeepSeek 推理模型' : '已关闭深度思索：恢复普通对话模型')
}

function openReasoningMenu(anchor) {
  document.querySelectorAll('.reason-pop').forEach((p) => p.remove())
  if (window.__reasonPop) { window.__reasonPop.remove(); window.__reasonPop = null; return }
  const pop = document.createElement('div')
  pop.className = 'plus-pop reason-pop'
  pop.style.width = '236px'
  pop.innerHTML = [['low', '低', '更快响应'], ['medium', '中', '平衡推理与耗时'], ['high', '高', '更充分推理']]
    .map(([id, label, desc]) => `<button class="pp-row" data-effort="${id}">
      <span class="ico pp-ico">${state.reasoningEffort === id ? icon('check') : ''}</span>
      <span class="pp-label">${label}</span>
      <span class="pp-desc">${desc}</span>
    </button>`).join('')
  document.body.appendChild(pop)
  window.__reasonPop = pop
  const r = anchor.getBoundingClientRect()
  pop.style.left = `${Math.round(Math.min(window.innerWidth - 248, Math.max(12, r.left)))}px`
  pop.style.top = `${Math.round(Math.max(12, r.top - pop.offsetHeight - 8))}px`
  pop.querySelectorAll('[data-effort]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation()
    state.reasoningEffort = b.dataset.effort
    pop.remove()
    window.__reasonPop = null
    renderView()
  }))
  setTimeout(() => document.addEventListener('click', function close(e) {
    if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', close); window.__reasonPop = null }
  }), 0)
}

const SLASH_COMMANDS = [
  { name: 'help', label: '/help', desc: '查看命令与用法', ico: 'message' },
  { name: 'compact', label: '/compact', desc: '立即压缩历史上下文', ico: 'layers' },
  { name: 'goal', label: '/goal', desc: '查看或设置当前目标', ico: 'target' },
  { name: 'plan', label: '/plan', desc: '进入原生计划模式', ico: 'pulse' },
]

function closeSlashMenu() {
  if (window.__slashPop) { window.__slashPop.remove(); window.__slashPop = null }
}

function openSlashMenu(anchor, query = '') {
  const items = SLASH_COMMANDS.filter((c) => c.name.startsWith(query.toLowerCase()))
  if (!items.length) return closeSlashMenu()
  let pop = window.__slashPop
  if (!pop) {
    document.querySelectorAll('.plus-pop').forEach((p) => p.remove())
    pop = document.createElement('div')
    pop.className = 'plus-pop'
    pop.style.width = '264px'
    document.body.appendChild(pop)
    window.__slashPop = pop
  }
  pop.innerHTML = items.map((c) => `<button class="pp-row" data-cmd="${c.name}">
      <span class="ico pp-ico">${icon(c.ico)}</span>
      <span class="pp-label">${c.label}</span>
      <span class="pp-desc">${c.desc}</span>
    </button>`).join('')
  const r = anchor.getBoundingClientRect()
  pop.style.left = `${Math.round(Math.min(window.innerWidth - 276, Math.max(12, r.left)))}px`
  pop.style.top = `${Math.round(Math.max(12, r.top - pop.offsetHeight - 8))}px`
  pop.querySelectorAll('[data-cmd]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation()
    state.draft = `/${b.dataset.cmd} `
    state.chatFocus = true
    closeSlashMenu()
    renderView()
  }))
}

function updateSlashMenu(input) {
  const value = state.draft
  if (/^\/[a-zA-Z-]*$/.test(value)) openSlashMenu(input, value.slice(1))
  else closeSlashMenu()
}

function updateMentionMenu(input) {
  const value = String(state.draft || '')
  const caret = typeof input?.selectionStart === 'number' ? input.selectionStart : value.length
  const match = value.slice(0, caret).match(/@([^\s@]*)$/)
  if (!match) return closeMentionMenu()
  const query = match[1].toLowerCase()
  const items = (state.plugins || [])
    .filter((p) => p.status === 'enabled')
    .filter((p) => !query || `${p.name} ${p.desc || ''}`.toLowerCase().includes(query))
    .slice(0, 8)
  if (!items.length) return closeMentionMenu()
  return openMentionMenu(input, items, match[0], caret - match[0].length, caret)
}

function closeMentionMenu() {
  if (window.__mentionPop) { window.__mentionPop.remove(); window.__mentionPop = null }
}

function openMentionMenu(input, items, token, start, end) {
  closeMentionMenu()
  const pop = document.createElement('div')
  pop.className = 'plus-pop mention-pop'
  pop.style.width = `${Math.max(280, Math.min(440, Math.round(input.getBoundingClientRect().width || 360)))}px`
  pop.innerHTML = items.map((p) => `<button class="pp-row" data-mention="${esc(p.id)}">
      <span class="ico pp-ico">${icon(p.kind === 'personal' ? 'spark' : 'plugin')}</span>
      <span class="pp-label">${state.composerTools.includes(p.id) ? '✓ ' : ''}@${esc(p.name)}</span>
      <span class="pp-desc">${esc(p.kind === 'personal' ? '个人技能' : '企业插件')}</span>
    </button>`).join('')
  document.body.appendChild(pop)
  window.__mentionPop = pop
  const r = input.getBoundingClientRect()
  pop.style.left = `${Math.round(Math.max(12, Math.min(window.innerWidth - pop.offsetWidth - 12, r.left)))}px`
  pop.style.top = `${Math.round(Math.max(8, r.top - pop.offsetHeight - 8))}px`
  pop.querySelectorAll('[data-mention]').forEach((button) => button.addEventListener('click', (e) => {
    e.stopPropagation()
    const plugin = (state.plugins || []).find((p) => p.id === button.dataset.mention)
    if (!plugin) return
    if (!state.composerTools.includes(plugin.id)) state.composerTools = [...state.composerTools, plugin.id]
    const value = String(state.draft || '')
    const insert = `@${plugin.name} `
    state.draft = `${value.slice(0, start)}${insert}${value.slice(end)}`
    input.value = state.draft
    const caret = start + insert.length
    input.setSelectionRange(caret, caret)
    input.focus()
    closeMentionMenu()
    toast(`已引用「${plugin.name}」，本次对话已启用`)
  }))
  setTimeout(() => document.addEventListener('click', function close(e) {
    if (!pop.contains(e.target) && e.target !== input) { pop.remove(); document.removeEventListener('click', close); if (window.__mentionPop === pop) window.__mentionPop = null }
  }), 0)
}

function composerRefLabel(r) {
  const image = /\.(png|jpe?g|webp|gif|bmp)$/i.test(String(r.label || ''))
  if (image) return `${r.label} · 图片`
  return r.label
}

function composerHasImage() {
  return (state.composerRefs || []).some((r) => /\.(png|jpe?g|webp|gif|bmp)$/i.test(String(r.label || '')))
}

function composerPrompt(fallback) {
  return String(state.draft || '').trim() || (composerHasImage() ? '请查看并分析这张图片' : fallback)
}

function imageMimeForName(name = '') {
  const ext = (String(name).toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || ''
  return ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp' })[ext] || ''
}

function imageFileForClipboard(file, index = 0, typeHint = '') {
  if (!file) return null
  const mime = String(file.type || '').toLowerCase().split(';')[0] || String(typeHint || '').toLowerCase().split(';')[0] || imageMimeForName(file.name || '')
  if (!/^image\/(png|jpeg|webp|gif|bmp)$/i.test(mime)) return null
  const ext = mime.split('/')[1].replace('jpeg', 'jpg')
  const raw = String(file.name || '').trim()
  const name = raw && /\.(png|jpe?g|webp|gif|bmp)$/i.test(raw) && !/^image\.(png|jpe?g|webp|gif)$/i.test(raw)
    ? raw
    : `剪贴板图片-${Date.now()}-${index + 1}.${ext}`
  try { return new File([file], name, { type: mime }) } catch { return file }
}

function clipboardImageFiles(dataTransfer) {
  const files = []
  const add = (file, typeHint = '') => {
    const normalized = imageFileForClipboard(file, files.length, typeHint)
    if (normalized) files.push(normalized)
  }
  for (const item of Array.from(dataTransfer?.items || [])) {
    if (item.kind !== 'file') continue
    const file = item.getAsFile()
    if (file) add(file, item.type)
  }
  if (!files.length) {
    for (const file of Array.from(dataTransfer?.files || [])) add(file)
  }
  if (!files.length) {
    // 某些应用复制图片时只写入 text/html；从 data URI 兜底恢复。
    try {
      const html = dataTransfer?.getData('text/html') || ''
      const match = html.match(/<img[^>]+src=["'](data:image\/(png|jpeg|webp|gif|bmp);base64,([^"']+))["']/i)
      const base64 = match?.[3]?.replace(/\s+/g, '') || ''
      if (match && base64.length <= 12 * 1024 * 1024) {
        const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0))
        const ext = match[2] === 'jpeg' ? 'jpg' : match[2]
        files.push(new File([bytes], `剪贴板图片-${Date.now()}-1.${ext}`, { type: `image/${match[2]}` }))
      }
    } catch {}
  }
  return files
}

function insertDraftText(draft, text) {
  if (!text) return
  const value = String(state.draft || '')
  const start = typeof draft?.selectionStart === 'number' ? draft.selectionStart : value.length
  const end = typeof draft?.selectionEnd === 'number' ? draft.selectionEnd : start
  state.draft = `${value.slice(0, start)}${text}${value.slice(end)}`
}

async function handleComposerPaste(ev, draft) {
  const files = clipboardImageFiles(ev.clipboardData)
  if (!files.length) return
  ev.preventDefault()
  const plainText = ev.clipboardData?.getData('text/plain') || ''
  insertDraftText(draft, plainText)
  if (draft && plainText) draft.value = state.draft
  if (state.pastingImages) return toast('上一张剪贴板图片还在上传，请稍候', true)
  state.pastingImages = true
  toast(`正在上传剪贴板图片 ${files.length} 张…`)
  try {
    const results = []
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i]
      const name = file.name || `剪贴板图片-${Date.now()}-${i + 1}.png`
      try {
        const uploaded = await uploadBinaryFile(file, 'chat')
        if (uploaded.ok && uploaded.file?.id) {
          let preview = ''
          try { preview = URL.createObjectURL(file) } catch {}
          results.push({ id: uploaded.file.id, label: name, preview })
        } else {
          toast(uploaded.body?.error || '剪贴板图片上传失败', true)
        }
      } catch (error) {
        toast(error?.message || '剪贴板图片上传失败', true)
      }
    }
    for (const item of results) addComposerRef({ kind: 'file', id: item.id, label: item.label, preview: item.preview })
    if (results.length) {
      renderView()
      toast(`已粘贴 ${results.length} 张图片为对话附件`)
      setTimeout(() => document.querySelector('#draft')?.focus(), 30)
    }
  } finally {
    state.pastingImages = false
  }
}

function bindComposerPaste(draft) {
  draft?.addEventListener('paste', (ev) => handleComposerPaste(ev, draft))
  const composer = draft?.closest('.hh-composer, .chat-composer')
  composer?.addEventListener('paste', (ev) => {
    if (ev.defaultPrevented || ev.target === draft) return
    handleComposerPaste(ev, draft)
  })
}

function openComposerPlus(anchor) { if (window.__plusPop) { window.__plusPop.remove(); window.__plusPop = null; return }
  document.querySelectorAll('.conv-menu, .plus-pop').forEach((p) => p.remove())
  const pop = document.createElement('div')
  pop.className = 'plus-pop'
  document.body.appendChild(pop)
  window.__plusPop = pop
  const r = anchor.getBoundingClientRect()
  const composer = anchor.closest('.hh-composer, .chat-composer, .img-composer') || anchor.parentElement
  const cr = composer.getBoundingClientRect()
  pop.style.width = `${Math.max(360, Math.round(cr.width))}px`
  pop.style.left = `${Math.round(Math.max(12, cr.left))}px`
  pop.style.maxHeight = `${Math.min(560, window.innerHeight - 16)}px`
  paintComposerPlus(pop, composerPlusItems(), null)
  const ph = pop.offsetHeight
  const wantTop = r.bottom + 10
  const top = wantTop + ph <= window.innerHeight - 8 ? wantTop : Math.max(8, r.top - 10 - ph)
  pop.style.top = `${Math.round(top)}px`
  setTimeout(() => document.addEventListener('click', function close(e) {
    if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', close) }
  }), 0)
}

async function openChatAttachment() {
  let chosen = null
  const mask = openModal('添加附件', `
    <div class="form-note">附件留在本机；发送到会话后，集团云端只保留 30 天临时副本，到期自动清理。需要长期保存，请在聊天附件上点「转存」。</div>
    <div class="att-drop" id="attDrop">
      <input type="file" id="attInput" hidden>
      <span class="att-drop-ico">${icon('upload')}</span>
      <b>拖放文件，或点击选择</b>
      <span>单个附件最大 2 GB · 本机保留，云端临时副本 30 天</span>
    </div>
    <div class="att-chosen" id="attChosen" hidden></div>
    <div class="form-foot"><span class="mono">本地文件 · 云端临时 30 天</span><span class="spacer"></span><button class="btn" data-mclose>取消</button><button class="btn primary" id="attSend" disabled>添加附件</button></div>`)
  const drop = mask.querySelector('#attDrop')
  const input = mask.querySelector('#attInput')
  const chosenEl = mask.querySelector('#attChosen')
  const send = mask.querySelector('#attSend')
  const setFile = (file) => {
    if (!file) return
    chosen = file
    const kb = file.size / 1024
    const size = kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`
    chosenEl.hidden = false
    chosenEl.innerHTML = `<span class="att-file-ico">${icon('doc')}</span><span class="att-file-main"><b>${esc(file.name)}</b><span>${size} · ${esc(file.type || '文件')} · 仅本机</span></span><button type="button" class="att-file-x" data-att-clear title="移除">${icon('close')}</button>`
    send.disabled = false
    chosenEl.querySelector('[data-att-clear]').addEventListener('click', (ev) => {
      ev.stopPropagation(); chosen = null; chosenEl.hidden = true; chosenEl.innerHTML = ''; send.disabled = true; input.value = ''
    })
  }
  drop.addEventListener('click', () => input.click())
  input.addEventListener('change', () => setFile(input.files && input.files[0]))
  drop.addEventListener('dragover', (ev) => { ev.preventDefault(); drop.classList.add('drag') })
  drop.addEventListener('dragleave', () => drop.classList.remove('drag'))
  drop.addEventListener('drop', (ev) => { ev.preventDefault(); drop.classList.remove('drag'); setFile(ev.dataTransfer.files && ev.dataTransfer.files[0]) })
  mask.querySelector('[data-mclose]').addEventListener('click', () => mask.remove())
  send.addEventListener('click', async () => {
    if (!chosen) return
    send.disabled = true
    const uploaded = await uploadBinaryFile(chosen, 'chat')
    send.disabled = false
    if (!uploaded.ok) {
      toast(uploaded.body.error || '附件上传失败', true)
      return
    }
    addComposerRef({ kind: 'file', id: uploaded.file.id, label: chosen.name })
    mask.remove()
    renderView()
    toast(`已添加「${chosen.name}」；附件已保存到本机附件库`)
  })
}

/* 从资料库添加：选数据中心资源作为对话上下文 */
async function openLibraryPicker() {
  const { body } = await api('/api/resources')
  const items = (body.items || []).slice(0, 14)
  const mask = openModal('从资料库添加', `
    <div class="lib-list">
      ${items.map((r) => `<button class="lib-row" data-lib="${esc(r.id)}">
        <span class="ico">${icon(r.type === 'video' ? 'video' : r.type === 'image' ? 'image' : 'doc')}</span>
        <span class="lib-name">${esc(r.name)}</span>
        <span class="lib-meta">${esc(r.source || '')}</span>
      </button>`).join('')}
    </div>`, { wide: true })
  mask.querySelectorAll('[data-lib]').forEach((b) => b.addEventListener('click', () => {
    const r = items.find((x) => x.id === b.dataset.lib)
    addComposerRef({ kind: 'library', label: r.name, id: r.id })
    mask.remove()
    renderView()
  }))
}

/* 在项目中工作：选一个项目作为对话上下文 */
async function openProjectPicker() {
  const { body } = await api('/api/projects')
  const items = body.items || []
  const mask = openModal('在项目中工作', `
    <div class="lib-list">
      ${items.map((p) => `<button class="lib-row" data-proj="${esc(p.id)}">
        <span class="ico">${icon('folder')}</span>
        <span class="lib-name">${esc(p.name)}</span>
        <span class="lib-meta" style="max-width:46%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(p.cwd || '')}">${esc(p.cwd || '未绑定文件夹')}</span>
      </button>`).join('')}
    </div>`, { wide: true })
  mask.querySelectorAll('[data-proj]').forEach((b) => b.addEventListener('click', () => {
    const p = items.find((x) => x.id === b.dataset.proj)
    addComposerRef({ kind: 'project', label: p.name, id: p.id })
    mask.remove()
    renderView()
  }))
}

function addComposerRef(ref) {
  const old = (state.composerRefs || []).find((x) => x.id === ref.id)
  if (old?.preview) {
    try { URL.revokeObjectURL(old.preview) } catch {}
  }
  state.composerRefs = (state.composerRefs || []).filter((x) => x.id !== ref.id)
  state.composerRefs.push(ref)
}

function removeComposerRef(id) {
  const ref = (state.composerRefs || []).find((x) => x.id === id)
  if (ref?.preview) {
    try { URL.revokeObjectURL(ref.preview) } catch {}
  }
  state.composerRefs = (state.composerRefs || []).filter((x) => x.id !== id)
}

function clearComposerRefs() {
  for (const ref of (state.composerRefs || [])) {
    if (ref?.preview) {
      try { URL.revokeObjectURL(ref.preview) } catch {}
    }
  }
  state.composerRefs = []
}

const ROLE_HOME = {
  employee: {
    title: '今天有什么安排？',
    tips: [
      { label: '查阅项目公示', desc: '汇总公示单位、期限与状态', prompt: '查阅本周项目公示，汇总单位、期限与状态', icon: 'doc' },
      { label: '查看空间数据', desc: '调取图层、影像与指标口径', prompt: '查看中心城区影像与控规图层，说明指标口径', icon: 'folder' },
      { label: '核对规划口径', desc: '对照控规、用地与开发强度', prompt: '核对这块用地的控规指标与开发强度口径', icon: 'spark' },
    ],
  },
}

function projectOptions() {
  const source = (state.projects && state.projects.length) ? state.projects : (state.sidebarProjects || [])
  return source.filter((p) => p && p.cwd && !p.removed)
}

function currentProject() {
  if (!state.activeProjectId) return null
  return projectOptions().find((p) => p.id === state.activeProjectId)
    || (state.sidebarProjects || []).find((p) => p.id === state.activeProjectId)
    || null
}

function projectContextControl() {
  const p = currentProject()
  const online = p?.status === 'online'
  return `<button class="quick" id="projectContext" style="display:inline-flex;align-items:center;gap:6px;line-height:1.2" title="${p ? esc(p.cwd || '') : '为本次对话绑定项目或本地文件夹'}">
    <span class="ico" style="display:inline-flex;align-items:center;justify-content:center">${icon('folder')}</span>${p ? esc(p.folderName || p.name) : '项目或文件夹'}
    ${p ? `<span class="tag" style="margin-left:4px">${online ? '已连接' : '不可用'}</span>` : ''}
  </button>`
}

function taskModeLabel(id) {
  return { auto: '自动', chat: '对话', work: '工作' }[id] || '自动'
}

function automationPermissionLabel(item) {
  if (item?.source === 'harness') return 'Harness 托管'
  return item?.permission === 'read-only' ? '只读' : '工作区可写'
}

function taskModeControl() {
  const id = ['auto', 'chat', 'work'].includes(state.taskMode) ? state.taskMode : 'auto'
  const tips = {
    auto: '自动判断任务类型：普通问答走对话，项目、文件/命令/多步骤任务走工作',
    chat: '默认只读；越权写入或命令会先请你逐次授权，不替你做拒绝',
    work: '工作执行：允许文件、命令与成果生成',
  }
  return `<button class="quick" id="taskModeBtn" style="display:inline-flex;align-items:center;gap:6px;line-height:1.2" title="${tips[id]}">
    <span class="ico" style="display:inline-flex;align-items:center;justify-content:center">${icon(id === 'chat' ? 'chat' : id === 'work' ? 'layers' : 'spark')}</span>${taskModeLabel(id)}<span class="ico hc-caret">${icon('chevron')}</span>
  </button>`
}

function openTaskModeMenu(anchor) {
  document.querySelectorAll('.mode-pop').forEach((p) => p.remove())
  document.querySelectorAll('.policy-pop').forEach((p) => p.remove())
  if (window.__modePop) { window.__modePop.remove(); window.__modePop = null; return }
  const pop = document.createElement('div')
  pop.className = 'plus-pop mode-pop'
  pop.style.width = '260px'
  pop.innerHTML = [
    ['auto', '自动', '智能判断，按需执行'],
    ['chat', '对话', '默认只读，越权逐次授权'],
    ['work', '工作', '文件、代码、多步骤'],
  ].map(([id, label, desc]) => `<button class="pp-row" data-taskmode="${id}">
      <span class="ico pp-ico">${state.taskMode === id ? icon('check') : ''}</span>
      <span class="pp-label">${label}</span>
      <span class="pp-desc">${desc}</span>
    </button>`).join('')
  document.body.appendChild(pop)
  window.__modePop = pop
  const r = anchor.getBoundingClientRect()
  pop.style.left = `${Math.round(Math.min(window.innerWidth - 272, Math.max(12, r.left)))}px`
  pop.style.top = `${Math.round(Math.max(12, r.top - pop.offsetHeight - 8))}px`
  pop.querySelectorAll('[data-taskmode]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation()
    state.taskMode = b.dataset.taskmode
    pop.remove()
    window.__modePop = null
    toast(`已切换为 ${taskModeLabel(state.taskMode)} 模式`)
    renderView()
  }))
  setTimeout(() => document.addEventListener('click', function close(e) {
    if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', close); window.__modePop = null }
  }), 0)
}

function policyControl() {
  if (state.taskMode === 'chat') {
    return `<button class="quick" id="policyToggle" disabled title="对话模式默认只读；越权写入或命令会先请你逐次确认，批准仅本次有效" style="display:inline-flex;align-items:center;gap:6px;line-height:1.2;background:#f1f2f4;border:0;border-radius:999px;height:32px;padding:0 12px;color:#8a8f96;box-shadow:none;white-space:nowrap;cursor:default;opacity:.75">
      <span class="ico" style="display:inline-flex;align-items:center;justify-content:center">${icon('shield')}</span>逐次授权
    </button>`
  }
  const manual = state.executionPolicy === 'manual'
  return `<button class="quick" id="policyToggle" style="display:inline-flex;align-items:center;gap:6px;line-height:1.2;background:#f1f2f4;border:0;border-radius:999px;height:32px;padding:0 12px;color:#5f6368;box-shadow:none;white-space:nowrap" title="${manual ? '工作区内写入与执行也逐次确认' : '工作区内直接执行，越界或升级才确认'}">
    <span class="ico" style="display:inline-flex;align-items:center;justify-content:center">${icon(manual ? 'shield' : 'pulse')}</span>${manual ? '请求批准' : '帮我批准'}
  </button>`
}

/** 待审批胶囊：放在输入框内「＋」右侧，点击后再让用户选择，不直接放行。 */
function approvalControl() {
  return `<button class="quick" id="approvalToggle" style="display:inline-flex;align-items:center;gap:6px;line-height:1.2;background:#f1f2f4;border:0;border-radius:999px;height:32px;padding:0 12px;color:#5f6368;box-shadow:none;white-space:nowrap" title="有 1 项工具调用等待你批准">
    <span class="ico" style="display:inline-flex;align-items:center;justify-content:center">${icon('shield')}</span>待批准
  </button>`
}

const TOOL_LABELS = {
  'mcp__jg__task_create': '创建待办',
  'mcp__jg__im_send': '发送即时消息',
  'mcp__jg__drive_search': '检索云空间',
  'mcp__jg__drive_read': '读取云空间文件',
  'mcp__jg__notice_list': '查询通知公告',
  'mcp__jg__notice_read': '读取通知公告',
  'mcp__jg__academy_search': '检索教学园地',
  'mcp__jg__contacts_find': '查询通讯录',
  'mcp__jg__resource_query': '查询数据资源',
  'mcp__jg__notebook_search': '检索智能笔记',
  task_create: '创建待办',
  im_send: '发送即时消息',
}
function toolLabel(name) {
  if (TOOL_LABELS[name]) return TOOL_LABELS[name]
  const short = String(name || '').replace(/^mcp__[^_]+__/, '')
  return TOOL_LABELS[short] || short || '工具调用'
}

/** 点击胶囊后弹出的审批菜单；选择前不会产生任何副作用。 */
function openApprovalMenu(anchor) {
  if (window.__approvalPop) { window.__approvalPop.remove(); window.__approvalPop = null; return }
  document.querySelectorAll('.approval-pop').forEach((p) => p.remove())
  document.querySelectorAll('.policy-pop').forEach((p) => p.remove())
  const p = state.pendingInteraction
  if (!p || p.kind !== 'approval') return
  const riskText = { low: '低', medium: '中', high: '高' }[p.risk] || p.risk
  const ruleText = {
    'dsh-workspace-write-escalation': 'DSH 工作区越界升级',
    'dsh-read-only-approval': 'DSH 只读策略升级',
    'chat-mode-no-escalation': '对话模式只读',
    'chat-mode-approval': '对话模式：请求授权',
    'auto-chat-runtime-approval': '自动模式：执行请求',
    'external-side-effect': '外部副作用',
    'scheduled-read-only-scope': '定时任务：只读范围',
    'scheduled-scope-exceeded': '定时任务：超出预设范围',
    'dsh-scheduled-escalation-unavailable': '定时任务无人值守',
  }[p.rule] || p.rule
  const isReasonOnly = !p.arguments && /^审批原因：/.test(String(p.summary || ''))
  const isNestedPtc = /:ptc:\d+$/i.test(String(p.callId || ''))
  const pop = document.createElement('div')
  pop.className = 'plus-pop approval-pop'
  pop.style.width = '360px'
  pop.innerHTML = `
    <div style="padding:12px 14px 8px">
      <div style="font-size:14px;color:#202124;font-weight:500;line-height:1.4">工具调用需要确认</div>
      <div style="font-size:12px;color:#7b8087;line-height:1.5;margin-top:3px">${esc(toolLabel(p.toolName))} 将在你的账号下执行，仅本次有效。</div>
    </div>
    <div style="margin:0 12px 10px;border:1px solid #e7ebf1;border-radius:8px;overflow:hidden;background:#fff">
      <div style="display:flex;align-items:center;gap:7px;padding:7px 10px;background:#f7f8fa;border-bottom:1px solid #e7ebf1">
        <b style="font-size:11px;color:#3f444a;font-weight:600">审批摘要</b>
        ${isNestedPtc ? '<span style="font-size:10px;color:#7b8087;border:1px solid #e7ebf1;border-radius:4px;padding:1px 5px;background:#fff">PTC 嵌套</span>' : ''}
        <span style="flex:1"></span>
        <span style="font-size:10px;color:#9aa1aa">仅本次</span>
      </div>
      <div style="display:grid;grid-template-columns:52px minmax(0,1fr);gap:5px 9px;padding:8px 10px;font-size:11px;line-height:1.55;color:#4b5056">
        <span style="color:#8a8f96">工具</span>
        <span style="word-break:break-all">${esc(toolLabel(p.toolName))}${p.toolName && p.toolName !== toolLabel(p.toolName) ? ` <span class="mono" style="font-size:10px;color:#9aa1aa">${esc(p.toolName)}</span>` : ''}</span>
        ${p.operation ? `<span style="color:#8a8f96">操作</span><span>${esc(p.operation)}</span>` : ''}
        ${p.resource ? `<span style="color:#8a8f96">目标</span><span style="word-break:break-all">${esc(p.resource)}</span>` : ''}
        <span style="color:#8a8f96">风险</span>
        <span>${esc(riskText)}${ruleText ? ` · ${esc(ruleText)}` : ''}</span>
      </div>
      ${p.summary ? `<div style="margin:0 10px 9px;padding:7px 8px;border-radius:6px;background:#f6f7f8;font-size:11px;color:#4b5056;line-height:1.55;word-break:break-word"><span style="color:#8a8f96">摘要</span><br>${esc(p.summary)}</div>` : ''}
      ${isReasonOnly ? '<div style="padding:0 10px 9px;font-size:10px;color:#8a8f96;line-height:1.5">工具未回传精确参数，以上摘要来自运行时升级原因，不冒充完整参数。</div>' : ''}
    </div>
    <button data-approval="allowed-once" style="display:flex;align-items:center;gap:10px;width:100%;border:0;background:transparent;padding:10px 13px;font:inherit;text-align:left;cursor:pointer">
      <span class="ico" style="flex:none">${icon('check')}</span>
      <span style="display:flex;flex-direction:column;gap:2px;min-width:0"><span style="font-size:13px;color:#202124">允许本次执行</span><span style="font-size:12px;color:#7b8087">执行后才会写入结果</span></span>
    </button>
    <button data-approval="rejected" style="display:flex;align-items:center;gap:10px;width:100%;border:0;background:transparent;padding:10px 13px;font:inherit;text-align:left;cursor:pointer">
      <span class="ico" style="flex:none">${icon('close')}</span>
      <span style="display:flex;flex-direction:column;gap:2px;min-width:0"><span style="font-size:13px;color:#202124">拒绝本次执行</span><span style="font-size:12px;color:#7b8087">不会产生任何外部操作</span></span>
    </button>`
  document.body.appendChild(pop)
  window.__approvalPop = pop
  const r = anchor.getBoundingClientRect()
  pop.style.left = `${Math.round(Math.min(window.innerWidth - 372, Math.max(12, r.left - 8)))}px`
  pop.style.top = `${Math.round(Math.max(12, r.top - pop.offsetHeight - 8))}px`
  pop.querySelectorAll('[data-approval]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation()
    pop.remove()
    window.__approvalPop = null
    decideApproval(b.dataset.approval)
  }))
  setTimeout(() => document.addEventListener('click', function close(e) {
    if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', close); window.__approvalPop = null }
  }), 0)
}

/** 审批策略菜单，用词与交互参考 Codex：点击后让用户选择，不直接切换。 */
function openPolicyMenu(anchor) {
  if (state.taskMode === 'chat') { toast('对话模式默认只读；越权操作会先请你逐次确认'); return }
  document.querySelectorAll('.policy-pop').forEach((p) => p.remove())
  document.querySelectorAll('.mode-pop').forEach((p) => p.remove())
  if (window.__policyPop) { window.__policyPop.remove(); window.__policyPop = null; return }
  const pop = document.createElement('div')
  pop.className = 'plus-pop policy-pop'
  pop.style.width = '326px'
  pop.innerHTML = [
    ['manual', '请求批准', '工作区内写入与执行也逐次确认', 'shield'],
    ['auto', '帮我批准', '工作区内直接执行，越界或升级才确认', 'pulse'],
  ].map(([id, label, desc, ico]) => `<button class="pp-row" data-policy="${id}" style="align-items:flex-start;padding:10px 12px 10px 10px">
      <span class="ico pp-ico" style="margin-top:1px;flex:none">${icon(ico)}</span>
      <span style="display:flex;flex-direction:column;gap:2px;min-width:0;text-align:left;flex:1">
        <span style="font-size:13px;color:#202124;line-height:1.35">${label}</span>
        <span style="font-size:12px;color:#7b8087;line-height:1.4;white-space:normal">${desc}</span>
      </span>
      <span class="ico" style="margin-top:7px;flex:none">${state.executionPolicy === id ? icon('check') : ''}</span>
    </button>`).join('')
  document.body.appendChild(pop)
  window.__policyPop = pop
  const r = anchor.getBoundingClientRect()
  pop.style.left = `${Math.round(Math.min(window.innerWidth - 338, Math.max(12, r.left - 8)))}px`
  pop.style.top = `${Math.round(Math.max(12, r.top - pop.offsetHeight - 8))}px`
  pop.querySelectorAll('[data-policy]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation()
    const next = b.dataset.policy
    pop.remove()
    window.__policyPop = null
    setExecutionPolicy(next)
  }))
  setTimeout(() => document.addEventListener('click', function close(e) {
    if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', close); window.__policyPop = null }
  }), 0)
}

/** 统一入口的项目选择：浮层卡片，支持已有项目、新建项目、解除关联。 */
async function openWorkspacePicker(trigger) {
  document.querySelectorAll('#wPickerPop').forEach((p) => p.remove())
  if (document.querySelector('#wPickerPop')) return
  const anchor = trigger?.currentTarget || document.querySelector('#projectContext') || document.querySelector('#chatProjectContext')
  const { ok, body } = await api('/api/projects')
  if (!ok) return toast(body.error || '项目加载失败', true)
  state.projects = body.items || state.projects || []
  const projects = (body.items || []).filter((p) => p.cwd && !p.removed)
  const activeId = state.activeProjectId || ''
  const wrap = document.createElement('div')
  wrap.id = 'wPickerPop'
  Object.assign(wrap.style, { position: 'fixed', zIndex: '80', width: '420px' })
  wrap.innerHTML = `
    <div style="display:flex;align-items:center;gap:2px;background:#eef0f3;border-radius:14px;padding:4px;width:max-content;margin:0 0 8px 6px">
      <button data-wtab="project" style="display:flex;align-items:center;gap:8px;border:0;background:var(--accent-soft);border-radius:11px;padding:9px 14px;font:inherit;font-size:var(--fs-sub);color:var(--accent);cursor:default">
        <span class="ico" style="width:17px;height:17px">${icon('folder')}</span>选择项目
      </button>
      <button data-wtab="file" style="display:flex;align-items:center;gap:8px;border:0;background:transparent;border-radius:11px;padding:9px 14px;font:inherit;font-size:var(--fs-sub);color:var(--text);cursor:pointer">
        <span class="ico" style="width:17px;height:17px">${icon('doc')}</span>文件
      </button>
      <button data-wtab="plugin" style="display:flex;align-items:center;gap:8px;border:0;background:transparent;border-radius:11px;padding:9px 14px;font:inherit;font-size:var(--fs-sub);color:var(--text);cursor:pointer">
        <span class="ico" style="width:17px;height:17px">${icon('plugin')}</span>插件
      </button>
    </div>
    <div style="background:#fff;border:1px solid #e6e8ec;border-radius:20px;box-shadow:0 18px 44px rgba(20,26,36,.16);overflow:hidden">
      <div style="display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid #eceef1">
        <span class="ico" style="width:18px;height:18px;color:var(--muted)">${icon('search')}</span>
        <input id="wPrjSearch" placeholder="搜索项目" style="flex:1;border:0;outline:0;background:transparent;font:inherit;font-size:var(--fs-sub);color:var(--text);min-width:0" />
        ${activeId ? `<button id="wPrjNone" style="border:0;background:transparent;font:inherit;font-size:var(--fs-meta);color:var(--muted);cursor:pointer;padding:0">解除</button>` : ''}
      </div>
      <div style="max-height:320px;overflow:auto;padding:6px">
        <button data-wnew style="display:flex;align-items:center;gap:10px;width:100%;border:0;background:#f0f1f3;border-radius:10px;padding:11px 12px;margin:2px 0;font:inherit;font-size:var(--fs-sub);color:var(--text);text-align:left;cursor:pointer">
          <span class="ico" style="width:19px;height:19px">${icon('folder')}</span>
          <span style="color:var(--accent);font-weight:var(--fw-semi)">＋</span>新建项目
        </button>
        <div id="wPrjList">
          ${projects.map((p) => `<button data-wprj="${esc(p.id)}" style="display:flex;align-items:center;gap:10px;width:100%;border:0;background:transparent;border-radius:10px;padding:11px 12px;margin:1px 0;font:inherit;font-size:var(--fs-sub);color:var(--text);text-align:left;cursor:pointer">
            <span class="ico" style="width:19px;height:19px">${icon('folder')}</span>
            <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.name)}</span>
            ${p.status !== 'online' ? `<span style="font-size:var(--fs-micro);color:var(--muted)">不可用</span>` : ''}
            ${activeId === p.id ? `<span class="ico" style="width:16px;height:16px;color:var(--accent)">${icon('check')}</span>` : ''}
          </button>`).join('') || '<div style="padding:18px 12px;color:var(--muted);font-size:var(--fs-meta)">还没有项目，点击上方「新建项目」创建。</div>'}
        </div>
      </div>
    </div>`
  document.body.appendChild(wrap)
  const rect = anchor ? anchor.getBoundingClientRect() : { left: 40, top: 500, bottom: 540 }
  const left = Math.max(12, Math.min(rect.left, window.innerWidth - 432))
  const h = wrap.offsetHeight || 420
  const below = rect.bottom + 10
  const top = below + h < window.innerHeight - 8 ? below : Math.max(8, rect.top - h - 10)
  wrap.style.left = `${left}px`
  wrap.style.top = `${top}px`

  const applyProject = (p) => {
    // 已经绑定项目的对话切换到另一个项目时，新开对话，避免旧目录权限和上下文被带入。
    if (state.conversation?.projectId && state.conversation.projectId !== (p?.id || '')) {
      state.conversation = null
      state.chatSteps = []
    }
    state.activeProjectId = p?.id || ''
    state.activeProjectName = p?.name || ''
    state.activeProjectCwd = p?.cwd || ''
    wrap.remove()
    state.view = state.conversation ? 'chat' : 'home'
    render()
  }
  wrap.querySelectorAll('[data-wprj]').forEach((b) => b.addEventListener('click', () => {
    const p = projects.find((x) => x.id === b.dataset.wprj) || null
    if (p && activeId === p.id) return applyProject(null)
    applyProject(p)
  }))
  wrap.querySelector('#wPrjNone')?.addEventListener('click', () => applyProject(null))
  const search = wrap.querySelector('#wPrjSearch')
  search?.focus()
  search?.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase()
    wrap.querySelectorAll('[data-wprj]').forEach((b) => {
      b.style.display = !q || b.textContent.toLowerCase().includes(q) ? '' : 'none'
    })
  })
  wrap.querySelector('[data-wtab="file"]').addEventListener('click', () => { wrap.remove(); openChatAttachment() })
  wrap.querySelector('[data-wtab="plugin"]').addEventListener('click', () => { wrap.remove(); openComposerPlus(anchor) })
  wrap.querySelector('[data-wnew]').addEventListener('click', () => {
    wrap.remove()
    openProjectForm((p) => {
      state.conversation = null
      state.chatSteps = []
      state.activeProjectId = p.id
      state.activeProjectName = p.name
      state.activeProjectCwd = p.cwd
      state.view = 'home'
      render()
    })
  })
  setTimeout(() => document.addEventListener('click', function close(ev) {
    if (!wrap.contains(ev.target) && ev.target.isConnected) {
      wrap.remove(); document.removeEventListener('click', close)
    }
  }), 0)
}

let voiceMedia = null
let voiceChunks = []
let voiceBusy = false

function writePcmWav(samples, sampleRate = 16000) {
  const length = samples.length
  const buffer = new ArrayBuffer(44 + length * 2)
  const view = new DataView(buffer)
  const writeString = (offset, value) => { for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i)) }
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + length * 2, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, length * 2, true)
  for (let i = 0; i < length; i += 1) view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 0x7fff, true)
  return new Blob([buffer], { type: 'audio/wav' })
}

async function blobToWav(blob) {
  const array = await blob.arrayBuffer()
  const decodeContext = new AudioContext()
  const decoded = await decodeContext.decodeAudioData(array.slice(0))
  await decodeContext.close()
  const seconds = Math.max(0.1, decoded.duration)
  const target = new OfflineAudioContext(1, Math.ceil(seconds * 16000), 16000)
  const source = target.createBufferSource()
  source.buffer = decoded
  source.connect(target.destination)
  source.start(0)
  const rendered = await target.startRendering()
  return writePcmWav(rendered.getChannelData(0), 16000)
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
    reader.onerror = () => reject(new Error('音频读取失败'))
    reader.readAsDataURL(blob)
  })
}

async function startVoiceInput(btn, targetInput = null) {
  if (voiceMedia && voiceMedia.state === 'recording') {
    voiceMedia.stop()
    return
  }
  if (voiceBusy) return
  const input = targetInput || document.getElementById('draft')
  if (!input) return
  const { ok, body } = await api('/api/speech/catalog')
  if (!ok) return toast(body?.error || '本地语音服务不可用', true)
  if (!body.ready) return toast('本地语音模型尚未准备，请联系管理员在管理中心的本地语音中下载模型', true)
  let stream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch (error) {
    return toast(error?.name === 'NotAllowedError' ? '麦克风未授权' : `麦克风启动失败：${error?.message || 'unknown'}`, true)
  }
  const recorder = new MediaRecorder(stream)
  voiceMedia = recorder
  voiceChunks = []
  voiceBusy = true
  const baseValue = input.value || ''
  btn.title = '正在录音，点击停止'
  recorder.ondataavailable = (event) => { if (event.data?.size) voiceChunks.push(event.data) }
  recorder.onstop = async () => {
    stream.getTracks().forEach((track) => track.stop())
    voiceMedia = null
    btn.title = '本地转写中…'
    try {
      const wav = await blobToWav(new Blob(voiceChunks, { type: recorder.mimeType || 'audio/webm' }))
      const audioBase64 = await blobToBase64(wav)
      const result = await api('/api/speech/transcribe', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ audioBase64, language: 'zh' }),
      })
      if (!result.ok) {
        if (result.body?.error?.includes('尚未准备')) toast(result.body.error, true)
        else toast(result.body?.error || '本地语音识别失败', true)
        return
      }
      const text = (result.body?.text || '').trim()
      if (!text) return toast('没有识别到语音内容', true)
      input.value = `${baseValue}${baseValue ? ' ' : ''}${text}`
      input.dispatchEvent(new Event('input', { bubbles: true }))
      toast('已在本机完成语音转写')
    } catch (error) {
      toast(`本地语音识别失败：${error?.message || 'unknown'}`, true)
    } finally {
      voiceBusy = false
      btn.title = '语音输入'
    }
  }
  recorder.start()
}

function openSpeechSettings() {
  const mask = openModal('本地离线语音', `
    <div class="mc-block"><div class="mc-id">识别模型</div><div class="field-value">SenseVoiceSmall ONNX · CPU 本地推理 · 音频不上传云端</div><div class="mc-id" id="speechState" style="margin-top:8px">读取中…</div><div class="mc-id" id="speechProgress" style="margin-top:4px"></div></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button class="btn primary" id="speechPrepare">下载/校验本地模型</button></div>`)
  const stateEl = mask.querySelector('#speechState')
  const progressEl = mask.querySelector('#speechProgress')
  const btn = mask.querySelector('#speechPrepare')
  const refresh = async () => {
    const { ok, body } = await api('/api/speech/catalog')
    if (!ok) { stateEl.textContent = body?.error || '状态读取失败'; return }
    stateEl.textContent = body.ready ? '模型已就绪，可在输入框使用本地语音输入' : `模型未准备（缺少：${(body.missing || []).join('、') || '模型文件'}）`
    progressEl.textContent = body.state === 'preparing' ? `正在下载 ${(body.progress / 1024 / 1024).toFixed(1)} / ${(body.progressTotal / 1024 / 1024).toFixed(1)} MB` : ''
  }
  refresh()
  btn.addEventListener('click', async () => {
    btn.disabled = true
    btn.textContent = '正在准备…'
    const timer = setInterval(refresh, 1000)
    const { ok, body } = await api('/api/speech/prepare', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
    clearInterval(timer)
    btn.disabled = false
    btn.textContent = '重新校验'
    if (!ok) toast(body?.error || '本地模型准备失败', true)
    else toast('本地语音模型已就绪')
    refresh()
  })
}


async function renderHome(el) {
  const { user } = state.boot
  const [{ body: convBody }, { body: prjBody }] = await Promise.all([api('/api/conversations'), api('/api/projects')])
  const convs = convBody.items || []
  const projects = prjBody.items || []
  state.projects = projects

  const rh = ROLE_HOME[user.role] || ROLE_HOME.employee
  const works = projects.filter((p) => p && p.cwd)
  const project = state.activeProjectId ? works.find((p) => p.id === state.activeProjectId) : null
  if (state.activeProjectId && !project) {
    state.activeProjectId = ''
    state.activeProjectName = ''
    state.activeProjectCwd = ''
  }
  if (project) {
    state.activeProjectName = project.name
    state.activeProjectCwd = project.cwd
  }
  const projectConvs = project ? convs.filter((c) => c.projectId === project.id).slice(0, 4) : []
  el.innerHTML = `
  <div class="home-home" style="padding-top:30vh">
    <div class="hh-center">
      <div class="hh-title" style="margin-bottom:18px">${esc(rh.title)}</div>
      ${(state.composerRefs || []).length ? `<div class="hh-refs" style="justify-content:center;margin:0 auto 10px;max-width:820px">
        ${state.composerRefs.map((r) => `<span class="hh-ref" data-refdrop="${esc(r.id)}">
          ${r.preview ? `<img class="hh-ref-thumb" src="${esc(r.preview)}" alt="图片附件" style="width:22px;height:22px;border-radius:5px;object-fit:cover;flex:none">` : `<span class="ico">${icon(r.kind === 'project' ? 'folder' : 'doc')}</span>`}${esc(composerRefLabel(r))}<span class="hh-ref-x">×</span>
        </span>`).join('')}
      </div>` : ''}
      <div class="hh-composer" style="width:100%;max-width:820px;margin:0 auto;box-sizing:border-box">
        <div style="display:flex;align-items:center;gap:6px;flex:none">
          <button class="hc-plus" id="attachBtn" title="添加照片、文件或工具"><span class="ico">${icon('plus')}</span></button>
          ${state.pendingInteraction?.kind === 'approval' ? approvalControl() : ''}
          ${policyControl()}
        </div>
        <textarea id="draft" rows="1" placeholder="有什么可以帮你？">${esc(state.draft)}</textarea>
        <div class="hc-right">
          <button class="hc-mic" id="micBtn" title="语音输入"><span class="ico">${icon('mic')}</span></button>
          <button class="hc-send" id="sendBtn" title="发送">${icon('up')}</button>
        </div>
      </div>
      <div class="quick-row" style="justify-content:space-between;align-items:center;margin:8px auto 0;width:100%;max-width:820px;box-sizing:border-box">
        <div style="display:flex;gap:6px;align-items:center">${projectContextControl()}</div>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="hc-lang" id="langBtn" title="推理强度"><span id="langValue">${reasoningLabel(state.reasoningEffort)}</span><span class="ico hc-caret">${icon('chevron')}</span></button>
          ${taskModeControl()}
        </div>
      </div>
    </div>
  </div>`

  const draft = el.querySelector('#draft')
  if (draft) {
    draft.addEventListener('input', (e) => { state.draft = e.target.value; updateSlashMenu(e.target); updateMentionMenu(e.target) })
    draft.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeSlashMenu(); closeMentionMenu() }
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); closeMentionMenu(); submitTask() }
    })
    bindComposerPaste(draft)
  }
  el.querySelector('#projectContext')?.addEventListener('click', openWorkspacePicker)
  el.querySelector('#taskModeBtn')?.addEventListener('click', (ev) => { ev.stopPropagation(); openTaskModeMenu(ev.currentTarget) })
  el.querySelector('#policyToggle')?.addEventListener('click', (ev) => { ev.stopPropagation(); openPolicyMenu(ev.currentTarget) })
  el.querySelector('#approvalToggle')?.addEventListener('click', (ev) => { ev.stopPropagation(); openApprovalMenu(ev.currentTarget) })
  el.querySelector('#langBtn')?.addEventListener('click', (ev) => { ev.stopPropagation(); openReasoningMenu(ev.currentTarget) })
  el.querySelectorAll('[data-prompt]').forEach((btn) => btn.addEventListener('click', () => {
    state.draft = btn.dataset.prompt
    renderView()
  }))
  el.querySelector('#attachBtn')?.addEventListener('click', (ev) => openComposerPlus(ev.currentTarget))
  el.querySelectorAll('[data-refdrop]').forEach((b) => b.addEventListener('click', () => {
    removeComposerRef(b.dataset.refdrop)
    renderView()
  }))
  el.querySelector('#micBtn')?.addEventListener('click', (ev) => startVoiceInput(ev.currentTarget))
  el.querySelector('#sendBtn')?.addEventListener('click', submitTask)
  el.querySelectorAll('[data-conv]').forEach((b) => b.addEventListener('click', () => openConversation(b.dataset.conv)))
  el.querySelectorAll('[data-project]').forEach((b) => b.addEventListener('click', () => openProject(b.dataset.project)))
  applyLayout()
  draft?.focus()
}

async function setExecutionPolicy(next) {
  if (!['auto', 'manual'].includes(next)) return
  if (state.conversation?.id) {
    if (state.conversation.status === 'running') {
      toast('本轮执行尚未结束，切换审批方式会从下一轮开始生效', true)
      return
    }
    const result = await api('/api/conversation/policy', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ conversationId: state.conversation.id, executionPolicy: next }),
    })
    if (!result.ok) { toast(result.body?.error || '切换审批方式失败', true); return }
    state.executionPolicy = result.body.executionPolicy
    state.conversation.executionPolicy = result.body.executionPolicy
  } else {
    state.executionPolicy = next
  }
  toast(state.executionPolicy === 'manual' ? '已切换为「请求批准」：工作区内写入与执行也逐次确认' : '已切换为「帮我批准」：工作区内直接执行，越界或升级才确认')
  renderView()
}

function greet() {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 12) return '上午好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
}

async function openConversation(id) {
  state.shareMode = false
  state.shareSelection = []
  const { body: one } = await api(`/api/conversation?id=${id}`)
  if (!one?.item) return toast('该会话不存在或已被删除', true)
  state.conversation = one.item
  upsertConversationMeta(one.item)
  const sp = (state.projects || []).find((p) => p.id === one.item.projectId)
    || (state.sidebarProjects || []).find((p) => p.id === one.item.projectId)
    || null
  state.activeProjectId = one.item.projectId || ''
  state.activeProjectName = sp?.name || ''
  state.activeProjectCwd = sp?.cwd || ''
  state.executionPolicy = one.item.executionPolicy === 'manual' ? 'manual' : 'auto'
  state.taskMode = ['auto', 'chat', 'work'].includes(one.item.taskMode) ? one.item.taskMode : 'auto'
  state.agentPresetId = one.item.agentPresetId || ''
  if (one.item.reasoningEffort) state.reasoningEffort = one.item.reasoningEffort
  state.deepThink = Boolean(one.item.deepThink)
  state.chatSteps = []
  state.chatError = ''
  state.pendingConfirm = null
  // 重新打开会话时恢复仍在等待的审批/提问，避免刷新或重启后卡片丢失。
  try {
    const { body: pending } = await api(`/api/chat/pending?conversationId=${encodeURIComponent(id)}`)
    state.pendingInteraction = pending.item || null
  } catch { state.pendingInteraction = null }
  state.view = 'chat'
  render()
}

/* ------------------------------- 项目 ------------------------------- */

// “新聊天”必须是一次干净的起点：不继承上一个会话的项目、上下文、附件、
// 待审批卡片和 Manual 策略。所有入口（侧栏顶部与“最近”栏）共用这一个重置函数，
// 避免两处按钮行为漂移。
function startFreshChat() {
  stopInteractionPoll()
  state.shareMode = false
  state.shareSelection = []
  state.view = 'home'
  state.draft = ''
  state.conversation = null
  state.chatSteps = []
  state.chatError = ''
  state.pendingInteraction = null
  state.pendingConfirm = null
  state.qSel = {}
  state.qCustom = {}
  clearComposerRefs()
  state.agentPresetId = ''
  state.activeProjectId = ''
  state.activeProjectName = ''
  state.activeProjectCwd = ''
  state.executionPolicy = state.runtimeSettings?.defaultPolicy === 'manual' ? 'manual' : 'auto'
  state.taskMode = 'auto'
  state.reasoningEffort = state.runtimeSettings?.defaultEffort || 'medium'
  state.deepThink = false
  render()
  toast('已开始全新对话：项目、上下文和策略均已重置')
  setTimeout(() => document.getElementById('draft')?.focus(), 50)
}

function relTime(str) {
  const t = new Date(String(str || '').replace(/-/g, '/')).getTime()
  if (!t || Number.isNaN(t)) return ''
  const diff = Math.max(0, Date.now() - t)
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} 天前`
  if (d < 30) return `${Math.floor(d / 7)} 周前`
  if (d < 365) return `${Math.floor(d / 30)} 个月前`
  return `${Math.floor(d / 365)} 年前`
}

async function renderProjects(el) {
  const { body } = await api('/api/projects')
  state.projects = body.items || []
  state.projects.forEach((p) => { if ((state.pinnedProjects || []).includes(p.id)) p.pinned = true })
  const q = state.prjQuery || ''
  const dir = state.prjSort === 'asc' ? 1 : -1
  const list = state.projects
    .filter((p) => p.personal)
    .filter((p) => !q || (p.name + (p.cwd || '') + (p.desc || '')).includes(q))
    .slice()
    .sort((a, b) => (String(a.updated) > String(b.updated) ? dir : -dir))
  const pageSize = 10
  const pages = Math.max(1, Math.ceil(list.length / pageSize))
  const page = Math.min(Math.max(1, state.prjPage || 1), pages)
  state.prjPage = page
  const pageItems = list.slice((page - 1) * pageSize, page * pageSize)
  el.innerHTML = `
    <div class="prj-head">
      <div class="view-title">工作区</div>
      <div class="prj-head-actions">
        <div class="search prj-search"><span class="ico">${icon('search')}</span><input id="prjSearch" placeholder="搜索工作区或文件夹" value="${esc(q)}"></div>
        <button class="btn primary" id="prjNew">${icon('plus')}关联文件夹</button>
      </div>
    </div>
    <div style="margin:-4px 0 14px;font-size:var(--fs-meta);color:var(--muted);line-height:1.6">一个项目就是一个本地工作区；同一文件夹下的多个线程共享文件、指令与执行环境。</div>
    <div class="prj-table">
      <div class="prj-thead">
        <span class="prj-th-name">工作区</span>
        <span class="spacer"></span>
        <span class="prj-th-time">已更新 <button class="prj-sort" id="prjSort" title="切换排序">${dir < 0 ? '↓' : '↑'}</button></span>
        <span class="prj-th-acts"></span>
      </div>
      ${list.length ? pageItems.map((p) => `
        <div class="prj-row" data-project="${p.id}">
          <span class="prj-ico">${icon('folder')}</span>
          <span class="prj-name" style="display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-width:0">
            <span>${esc(p.name)}</span>
            <span style="max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--fs-micro);font-weight:400;color:var(--muted);font-family:ui-monospace,SFMono-Regular,Consolas,monospace">${esc(p.cwd || '未绑定本地文件夹')} · ${p.convs || 0} 个线程</span>
          </span>
          <span class="spacer"></span>
          <span class="prj-time mono">${relTime(p.updated)}</span>
          <span class="prj-acts">
            <button class="icon-btn" data-pmore="${p.id}" title="更多">${icon('dots')}</button>
            <button class="icon-btn${p.pinned ? ' on' : ''}" data-ppin="${p.id}" title="${p.pinned ? '取消置顶' : '置顶'}">${icon('pin')}</button>
            <button class="icon-btn" data-pnewchat="${p.id}" title="在该工作区新建线程">${icon('compose')}</button>
          </span>
        </div>`).join('') : '<div class="prj-empty">还没有工作区。点右上角「关联文件夹」，把一个本地目录变成项目。</div>'}
    </div>
    ${pages > 1 ? `<div class="ac-pager prj-pager">
      <button class="ac-pg" data-ppage="${page - 1}" ${page <= 1 ? 'disabled' : ''}>上一页</button>
      ${pageSeq(page, pages).map((p) => p === '…' ? '<span class="ac-pager-dots">…</span>' : `<button class="ac-pg num ${p === page ? 'on' : ''}" data-ppage="${p}">${p}</button>`).join('')}
      <button class="ac-pg" data-ppage="${page + 1}" ${page >= pages ? 'disabled' : ''}>下一页</button>
      <span class="ac-pager-info">每页最多 ${pageSize} 条 · 共 ${list.length} 条</span>
    </div>` : ''}`
  const input = el.querySelector('#prjSearch')
  if (input) {
    input.addEventListener('input', debounce((e) => {
      state.prjQuery = e.target.value
      state.prjPage = 1
      renderView()
      const next = document.getElementById('prjSearch')
      if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length) }
    }, 260))
  }
  el.querySelector('#prjNew')?.addEventListener('click', openProjectForm)
  el.querySelector('#prjSort')?.addEventListener('click', () => {
    state.prjSort = state.prjSort === 'asc' ? 'desc' : 'asc'
    state.prjPage = 1
    renderView()
  })
  el.querySelectorAll('[data-ppage]').forEach((b) => b.addEventListener('click', () => {
    const p = Number(b.dataset.ppage)
    if (!Number.isFinite(p)) return
    state.prjPage = Math.min(Math.max(p, 1), pages)
    renderView()
  }))
  el.querySelectorAll('[data-pnewchat]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation()
    const p = state.projects.find((x) => x.id === b.dataset.pnewchat)
    if (p) startProjectChat(p)
  }))
  el.querySelectorAll('[data-pmore]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation()
    openProjectRowMenu(b, b.dataset.pmore)
  }))
  el.querySelectorAll('[data-ppin]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation()
    const p = state.projects.find((x) => x.id === b.dataset.ppin)
    if (!p) return
    p.pinned = !p.pinned
    const set = new Set(state.pinnedProjects || [])
    if (p.pinned) set.add(p.id); else set.delete(p.id)
    state.pinnedProjects = [...set]
    renderView()
    toast(p.pinned ? `已置顶「${p.name}」` : `已取消置顶「${p.name}」`)
  }))
  el.querySelectorAll('.prj-row').forEach((row) => row.addEventListener('click', () => openProject(row.dataset.project)))
}

function openProjectFiles({ projectId = '', conversationId = '' } = {}) {
  if (!projectId && !conversationId) return toast('缺少项目或会话目录', true)
  const query = projectId ? `projectId=${encodeURIComponent(projectId)}` : `conversationId=${encodeURIComponent(conversationId)}`
  const mask = openModal('文件浏览', `
    <div style="display:flex;gap:12px;min-height:52vh;align-items:stretch">
      <div style="width:38%;min-width:220px;border-right:1px solid var(--line);padding-right:10px;display:flex;flex-direction:column">
        <div class="mc-id" id="fileRoot" style="margin-bottom:8px">正在读取目录…</div>
        <div id="fileTree" style="overflow:auto;flex:1;font-size:12px"></div>
      </div>
      <div style="flex:1;min-width:0;display:flex;flex-direction:column">
        <div class="mc-id" id="fileHead">选择左侧文件预览</div>
        <pre id="fileBody" class="mono" style="flex:1;overflow:auto;white-space:pre-wrap;word-break:break-word;margin:8px 0 0;padding:10px;background:var(--panel);border:1px solid var(--line);border-radius:8px;min-height:260px"></pre>
      </div>
    </div>`)
  const rootEl = mask.querySelector('#fileRoot')
  const treeEl = mask.querySelector('#fileTree')
  const headEl = mask.querySelector('#fileHead')
  const bodyEl = mask.querySelector('#fileBody')
  const iconFor = (item) => item.type === 'dir' ? icon('folder') : (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(item.ext) ? icon('image') : icon('doc'))
  const preview = async (item) => {
    headEl.textContent = `${item.path} · ${item.type === 'dir' ? '目录' : (item.size < 1024 ? `${item.size} B` : `${(item.size / 1024).toFixed(1)} KB`)}`
    bodyEl.textContent = '正在读取…'
    const { ok, body } = await api(`/api/files/content?${query}&path=${encodeURIComponent(item.path)}`)
    if (!ok) { bodyEl.textContent = body?.error || '读取失败'; return }
    if (body.image && body.rawUrl) {
      bodyEl.innerHTML = `<img src="${body.rawUrl}" alt="${esc(body.name)}" style="max-width:100%;height:auto;border-radius:6px" />`
      return
    }
    if (body.binary) {
      bodyEl.textContent = '二进制文件，不提供文本预览。'
      return
    }
    if (body.tooLarge) { bodyEl.textContent = '文件超过 1MB，未在弹窗内预览。'; return }
    bodyEl.textContent = body.text || '（空文件）'
    if (body.truncated) bodyEl.textContent += '\n\n[内容过长，仅显示前 400,000 字符]'
  }
  const loadDir = async (path, container, depth) => {
    const { ok, body } = await api(`/api/files/tree?${query}&path=${encodeURIComponent(path)}&depth=1`)
    if (!ok) { container.textContent = body?.error || '读取目录失败'; return }
    if (!body.entries.length) { container.innerHTML = '<div class="mc-dim" style="padding:6px">空目录</div>'; return }
    for (const item of body.entries) {
      const row = document.createElement('div')
      row.style.cssText = `display:flex;align-items:center;gap:6px;padding:4px 6px;padding-left:${6 + depth * 12}px;border-radius:6px;cursor:pointer`
      row.innerHTML = `<span class="ico">${iconFor(item)}</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(item.name)}</span>`
      const children = document.createElement('div')
      children.style.display = 'none'
      container.appendChild(row)
      container.appendChild(children)
      if (item.type === 'dir') {
        let loaded = false
        row.addEventListener('click', async () => {
          if (!loaded) {
            loaded = true
            children.style.display = 'block'
            row.querySelector('.ico').style.transform = 'rotate(0deg)'
            await loadDir(item.path, children, depth + 1)
          } else {
            children.style.display = children.style.display === 'none' ? 'block' : 'none'
          }
        })
      } else {
        row.addEventListener('click', () => preview(item))
      }
    }
  }
  api(`/api/files/tree?${query}&depth=1`).then(({ ok, body }) => {
    rootEl.textContent = ok ? `${body.label} · ${body.root}` : (body.error || '目录不可用')
    if (!ok) { treeEl.textContent = body.error || '目录不可用'; return }
    treeEl.innerHTML = ''
    loadDir('', treeEl, 0)
  })
}

function openProject(id) {
  const p = (state.projects || []).find((x) => x.id === id)
    || (state.sidebarProjects || []).find((x) => x.id === id)
    || state.boot?.projects?.find?.((x) => x.id === id)
  if (!p) return
  const slide = ensureSlide()
  const online = p.status === 'online'
  const autoReview = (state.agentEntries || []).find((x) => x.id === 'auto-review')
  const threads = (state.conversations || []).filter((c) => c.projectId === p.id)
  const threadRows = threads.length
    ? threads.slice(0, 20).map((c) => `<button class="lib-row" data-prjthread="${esc(c.id)}" style="width:100%;border:0;border-bottom:1px solid var(--line);border-radius:0;text-align:left">
        <span class="ico">${icon('chat')}</span>
        <span class="lib-name" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.title || '未命名线程')}</span>
        <span class="lib-meta">${esc(c.status === 'running' ? '运行中' : (c.time || '—'))}</span>
      </button>`).join('')
    : `<div style="padding:14px;color:var(--muted);font-size:var(--fs-meta)">还没有线程；点下方「新建线程」开始。</div>`
  slide.innerHTML = `
    <div class="slide-head"><div><div class="slide-title">${esc(p.name)}</div><div class="slide-sub">本地工作区 · ${online ? '已连接' : '不可用'} · 更新 ${relTime(p.updated)}</div></div><span class="spacer"></span><button class="btn subtle" data-close>${icon('close')}</button></div>
    <div class="slide-body">
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
        <span class="tag">${online ? '本地文件夹已连接' : '本地文件夹不可用'}</span>
        <span class="tag" id="prjGitTag">检测 Git…</span>
      </div>
      <div class="field"><div class="field-label">工作区目录</div>
        <div style="display:flex;align-items:flex-start;gap:8px">
          <div class="field-value" style="flex:1;min-width:0;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;word-break:break-all">${p.cwd ? esc(p.cwd) : '未绑定本地文件夹（工作模式不可用）'}</div>
          ${p.cwd ? '<button class="btn" data-reveal>打开文件夹</button>' : ''}
        </div>
      </div>
      <div class="kv-row">
        <div class="kv-box"><span>线程</span><b>${threads.length}</b></div>
        <div class="kv-box"><span>根目录文件</span><b>${p.files || 0}</b></div>
        <div class="kv-box"><span>Git</span><b id="prjGitBranch">—</b></div>
      </div>
      <div class="field"><div class="field-label">线程</div>
        <div style="max-height:210px;overflow:auto;border:1px solid var(--line);border-radius:10px;background:#fff">${threadRows}</div>
      </div>
      <div class="field"><div class="field-label">工作区说明</div><div class="field-value">${esc(p.desc || '未填写工作区说明')}</div></div>
      <div class="field"><div class="field-label">工作区指令</div><div class="field-value">${esc(p.instructions || '未设置；可在新建或编辑工作区时补充统一约定。')}</div></div>
      <div class="field"><div class="field-label">工作区上下文</div><div class="field-value">Agent 直接读取该本地目录中的文件；同一工作区下的多个线程共享目录与指令，但聊天记录彼此独立。</div></div>
      <div class="field"><div class="field-label">安全与权限</div>
        <div class="field-value">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">
            <span class="tag warn">自动审查权限层 · 未接入</span>
            <span style="color:var(--muted);font-size:var(--fs-meta)">${autoReview?.runtimeEnabled ? 'DSH 运行时已安装，产品审批链路尚未接入' : 'DSH 运行时未加载'}</span>
          </div>
          <div style="color:var(--muted);font-size:var(--fs-meta);line-height:1.6">权限层用于工具调用前的放行、拒绝或人工审批，不属于普通工具入口；已从输入框菜单移除。</div>
          <button class="btn sm" data-security style="margin-top:8px">查看项目安全设置</button>
        </div>
      </div>
    </div>
    <div class="slide-foot" style="flex-wrap:wrap">
      <button class="btn primary" data-ask ${p.cwd ? '' : 'disabled'}>新建线程</button>
      ${p.cwd ? '<button class="btn" data-files>浏览文件</button>' : ''}
      ${p.cwd ? `<button class="btn" data-check ${online ? '' : 'disabled'} title="${online ? '只读检查成果中的指标、日期与版本冲突' : '工作区文件夹当前不可用'}">成果检查</button>` : ''}
      <button class="btn" data-rename>重命名</button>
      <button class="btn" data-remove>移除</button>
    </div>`
  wireSlide(slide)
  slide.querySelector('[data-files]')?.addEventListener('click', () => openProjectFiles({ projectId: p.id }))
  slide.querySelector('[data-check]')?.addEventListener('click', () => openDeliverableCheck(p))
  slide.querySelector('[data-security]')?.addEventListener('click', () => openProjectSecurity(p, autoReview))
  slide.querySelector('[data-reveal]')?.addEventListener('click', () => revealProjectFolder(p))
  slide.querySelectorAll('[data-prjthread]').forEach((button) => button.addEventListener('click', async () => {
    slide.classList.remove('open')
    await openConversation(button.dataset.prjthread)
  }))
  slide.querySelector('[data-ask]')?.addEventListener('click', () => {
    slide.classList.remove('open')
    startProjectChat(p)
  })
  slide.querySelector('[data-rename]')?.addEventListener('click', () => {
    const mask = openModal('重命名工作区', `
      <div class="field"><div class="field-label">工作区名称</div><input class="text-input" id="renamePrj" value="${esc(p.name)}" /></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
        <button class="btn" data-cancel>取消</button><button class="btn primary" data-ok>保存</button>
      </div>`)
    mask.querySelector('[data-cancel]').addEventListener('click', () => mask.remove())
    mask.querySelector('[data-ok]').addEventListener('click', async () => {
      const name = mask.querySelector('#renamePrj').value.trim()
      if (!name) return toast('工作区名称不能为空', true)
      const { ok, body } = await api('/api/projects/update', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: p.id, name }),
      })
      if (!ok) return toast(body.error || '重命名失败', true)
      mask.remove()
      if (state.activeProjectId === p.id) state.activeProjectName = name
      toast('工作区已重命名')
      render()
    })
  })
  slide.querySelector('[data-remove]')?.addEventListener('click', () => {
    const mask = openModal('移除工作区', `
      <div class="notice">只移除平台记录，不会删除本地文件夹、文件或线程历史。工作区下的线程会转为普通聊天。</div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
        <button class="btn" data-cancel>取消</button><button class="btn" style="color:var(--danger)" data-ok>移除工作区</button>
      </div>`)
    mask.querySelector('[data-cancel]').addEventListener('click', () => mask.remove())
    mask.querySelector('[data-ok]').addEventListener('click', async () => {
      const { ok, body } = await api('/api/projects/remove', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: p.id }),
      })
      if (!ok) return toast(body.error || '移除失败', true)
      mask.remove()
      slide.classList.remove('open')
      if (state.activeProjectId === p.id) {
        state.activeProjectId = ''
        state.activeProjectName = ''
        state.activeProjectCwd = ''
      }
      state.projects = (state.projects || []).filter((x) => x.id !== p.id)
      state.sidebarProjects = (state.sidebarProjects || []).filter((x) => x.id !== p.id)
      toast('工作区记录已移除，本地文件未删除')
      render()
    })
  })
  api(`/api/worktrees?projectId=${encodeURIComponent(p.id)}`).then(({ ok, body }) => {
    const tag = slide.querySelector('#prjGitTag')
    const branch = slide.querySelector('#prjGitBranch')
    if (!tag || !branch) return
    if (!ok) { tag.textContent = 'Git 未检测'; return }
    if (!body.repo) { tag.textContent = '非 Git 仓库'; branch.textContent = '—'; return }
    const main = (body.items || []).find((item) => item.main) || (body.items || [])[0]
    const current = (body.branches || []).find((item) => item.current)
    tag.textContent = main?.dirty ? 'Git · 有未提交改动' : 'Git · 已就绪'
    branch.textContent = main?.branch || current?.name || 'detached'
  }).catch(() => {
    const tag = slide.querySelector('#prjGitTag')
    if (tag) tag.textContent = 'Git 未检测'
  })
}

function openProjectSecurity(p, autoReview) {
  const mask = openModal(`项目权限与安全 · ${esc(p.name)}`, `
    <div class="form-note">权限层与代码审查是两个不同的能力：前者拦截工具调用，后者审查源码。自动审查权限层已从输入框工具菜单移除，统一放到项目安全设置。</div>
    <div class="field"><div class="field-label">自动审查（权限层）</div>
      <div class="field-value">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span class="tag ${autoReview?.runtimeEnabled ? 'warn' : ''}">${autoReview?.runtimeEnabled ? '运行时已安装 · 产品未接入' : '运行时未加载'}</span>
          <span class="mono" style="font-size:var(--fs-meta);color:var(--muted)">${esc(p.cwd || '未绑定目录')}</span>
        </div>
        <div style="color:var(--muted);font-size:var(--fs-meta);line-height:1.7;margin-top:8px">逐工具调用前决定放行、拒绝或转人工审批。当前产品没有把它接进审批链路，因此不会在这里显示成普通可勾选工具。</div>
      </div>
    </div>
    <div class="field"><div class="field-label">代码审查服务</div>
      <div class="field-value">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span class="tag ok">已接入 · 只读</span><span style="color:var(--muted);font-size:var(--fs-meta)">扫描源码、语法检查、JSON 校验、静态规则提示</span></div>
        <div style="margin-top:10px"><button class="btn" data-open-cr>打开代码审查控制台</button></div>
      </div>
    </div>
  `)
  mask.querySelector('[data-open-cr]')?.addEventListener('click', () => {
    mask.remove()
    document.querySelector('.slide')?.classList.remove('open')
    state.view = 'codereview'
    render()
    toast('已打开代码审查控制台')
  })
}

function deliverableStatusMeta(status) {
  if (status === 'conflict') return { label: '发现冲突', fg: '#a3261e', bg: '#fdeeee', line: '#c0392b' }
  if (status === 'warning') return { label: '有提示', fg: '#7a5200', bg: '#fff7e6', line: '#b7791f' }
  return { label: '一致', fg: '#246b43', bg: '#edf8f1', line: '#2f855a' }
}

function deliverableFileLabel(status) {
  return { ok: '可核对', spatial: '空间数据', empty: '无文本', error: '读取失败' }[status] || status
}

function deliverableResultHtml(result) {
  const meta = deliverableStatusMeta(result.status)
  const files = result.files || []
  const checks = result.checks || []
  const summary = result.summary || {}
  const evidence = (items) => (items || []).map((item) => `
    <div class="mc-id" style="margin-top:6px;white-space:normal;line-height:1.6">${esc(item.file || '')}${item.text ? ` · ${esc(item.text)}` : ''}</div>`).join('')
  const cards = checks.length ? checks.map((item) => {
    const color = item.level === 'conflict' ? '#c0392b' : item.level === 'warning' ? '#b7791f' : '#2f855a'
    return `<div style="border:1px solid var(--line);border-left:3px solid ${color};border-radius:8px;padding:10px 12px;background:#fff;margin-bottom:8px">
      <div style="font-size:var(--fs-sub);font-weight:var(--fw-semi);color:var(--text)">${esc(item.title || '检查项')}</div>
      <div style="font-size:var(--fs-meta);color:var(--text-2);line-height:1.7;margin-top:4px">${esc(item.detail || '')}</div>
      ${evidence(item.evidence)}
    </div>`
  }).join('') : '<div class="notice">未发现指标、日期或版本冲突；结果仍建议由项目负责人复核后确认。</div>'
  return `
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">
      <span style="display:inline-flex;align-items:center;height:24px;padding:0 10px;border-radius:999px;background:${meta.bg};color:${meta.fg};font-size:var(--fs-meta);font-weight:var(--fw-semi)">${meta.label}</span>
      <span style="font-size:var(--fs-meta);color:var(--text-2)">${summary.files || 0} 个成果文件 · ${summary.conflicts || 0} 个冲突 · ${summary.warnings || 0} 个提示</span>
    </div>
    <div class="form-note" style="margin-bottom:10px">扫描目录：${esc(result.project?.cwd || '')}<br>生成时间：${esc(result.generatedAt || '')}</div>
    <div style="max-height:48vh;overflow:auto;padding-right:2px">${cards}</div>
    <details style="margin-top:12px">
      <summary style="cursor:pointer;font-size:var(--fs-meta);color:var(--text-2)">文件清单（${files.length}）</summary>
      <div style="margin-top:8px;border:1px solid var(--line);border-radius:8px;overflow:hidden">
        ${files.map((file) => `<div style="display:flex;gap:8px;align-items:center;padding:7px 10px;border-bottom:1px solid var(--line);font-size:var(--fs-meta)">
          <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(file.name || '')}</span>
          <span style="color:var(--muted);white-space:nowrap">${esc(deliverableFileLabel(file.status))}</span>
        </div>`).join('') || '<div style="padding:10px;color:var(--muted);font-size:var(--fs-meta)">没有可检查文件</div>'}
      </div>
    </details>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
      <button class="btn" id="dcRecheck">重新扫描</button>
      <button class="btn primary" id="dcClose">关闭</button>
    </div>`
}

async function openDeliverableCheck(project) {
  if (!project?.cwd) return toast('项目未绑定本地文件夹，无法检查成果', true)
  if (project.status !== 'online') return toast('项目文件夹当前不可用，无法检查成果', true)
  const mask = openModal('成果一致性检查', `
    <div id="dcBody">
      <div class="form-note">正在只读扫描「${esc(project.name)}」的本地成果，不会修改、移动或删除任何文件。</div>
      <div style="padding:18px 0;color:var(--muted);font-size:var(--fs-meta)">正在提取文档文本并比对指标…</div>
    </div>`)
  const body = mask.querySelector('#dcBody')
  const run = async () => {
    if (!body) return
    body.innerHTML = `<div class="form-note">正在只读扫描「${esc(project.name)}」的本地成果，不会修改任何文件。</div><div style="padding:18px 0;color:var(--muted);font-size:var(--fs-meta)">正在提取文档文本并比对指标…</div>`
    const { ok, body: payload } = await api('/api/projects/verify', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: project.id }),
    })
    if (!ok) {
      body.innerHTML = `<div class="notice">${esc(payload?.error || '成果检查失败')}</div><div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn" id="dcClose">关闭</button></div>`
    } else {
      body.innerHTML = deliverableResultHtml(payload)
    }
    body.querySelector('#dcRecheck')?.addEventListener('click', run)
    body.querySelector('#dcClose')?.addEventListener('click', () => mask.remove())
  }
  run()
}

function openProjectForm(onDone) {
  const hasBridge = Boolean(window.jgClient && window.jgClient.chooseFolder)
  const mask = openModal('新建工作区', `
    <div style="padding:4px 4px 2px">
      <div class="field-label" style="font-size:var(--fs-sub);margin-bottom:10px">工作区名称</div>
      <div id="prjNameWrap" style="display:flex;align-items:center;height:54px;border:1.5px solid var(--accent);border-radius:13px;background:#fff;overflow:hidden">
        <span style="width:50px;display:grid;place-items:center;color:var(--text)"><span class="ico" style="width:22px;height:22px">${icon('folder')}</span></span>
        <span style="width:1px;height:24px;background:#dcdfe4"></span>
        <input id="prjName" placeholder="留空则使用文件夹名" style="flex:1;min-width:0;border:0;outline:0;background:transparent;height:52px;padding:0 14px;font:inherit;font-size:var(--fs-sub);color:var(--text)" />
      </div>

      <div class="field-label" style="font-size:var(--fs-sub);margin:20px 0 10px">本地文件夹</div>
      <div id="prjDrop" style="border:1px solid #e1e4e9;border-radius:14px;padding:22px 18px 20px;background:#fff;text-align:center">
        <div style="font-size:var(--fs-sub);color:var(--text)">在此电脑上添加文件夹 <span style="color:var(--muted)">⌄</span></div>
        <button id="prjBrowse" type="button" style="display:inline-flex;align-items:center;gap:7px;margin-top:14px;border:0;border-radius:999px;background:#f1f2f4;padding:9px 17px;font:inherit;font-size:var(--fs-sub);color:var(--text);cursor:pointer">
          <span class="ico" style="width:18px;height:18px">${icon('folder')}</span><span style="color:var(--accent);font-weight:var(--fw-semi)">＋</span>添加
        </button>
        <input id="prjCwd" ${hasBridge ? 'readonly' : ''} placeholder="或直接输入本地文件夹路径" style="margin-top:14px;width:100%;border:0;border-top:1px solid #eceef1;outline:0;background:transparent;padding:12px 2px 0;font:inherit;font-size:var(--fs-meta);color:${hasBridge ? 'var(--muted)' : 'var(--text)'};text-align:center;overflow-wrap:anywhere" />
      </div>

      <div style="display:flex;align-items:flex-start;gap:12px;margin-top:16px;border-radius:12px;background:#f4f5f6;padding:14px 16px">
        <span class="ico" style="width:24px;height:24px;flex:none;color:var(--muted);margin-top:1px">${icon('spark')}</span>
        <div style="font-size:var(--fs-meta);color:var(--text-2);line-height:1.7">像 Codex 的 Project 一样：一个工作区对应一个本地文件夹，工作区下的多个线程共享文件、执行环境和指令，但聊天记录彼此独立。</div>
      </div>

      <div class="field-label" style="font-size:var(--fs-sub);margin:18px 0 8px">工作区指令（可选）</div>
      <textarea id="prjInstructions" rows="3" placeholder="例如：本项目统一使用中文命名；修改代码前先运行现有测试。" style="width:100%;box-sizing:border-box;border:1px solid #e1e4e9;border-radius:12px;background:#fff;padding:11px 12px;font:inherit;font-size:var(--fs-meta);color:var(--text);resize:vertical;outline:none"></textarea>

      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:18px">
        <button id="prjMemory" type="button" style="border:0;background:transparent;padding:6px 0;font:inherit;font-size:var(--fs-sub);color:var(--text);cursor:pointer">工作区记忆 <span style="color:var(--muted)">⌄</span></button>
        <button class="btn primary" data-ok disabled style="min-width:126px;height:44px;border-radius:22px;font-size:var(--fs-sub);background:#b9bdc4 !important;color:#fff !important;border-color:#b9bdc4 !important">创建工作区</button>
      </div>
    </div>`)
  const modal = mask.querySelector('.jg-modal')
  if (modal) {
    modal.style.width = 'min(620px, calc(100vw - 44px))'
    modal.style.maxHeight = 'calc(100vh - 44px)'
    modal.style.borderRadius = '20px'
  }
  const nameInput = mask.querySelector('#prjName')
  const cwdInput = mask.querySelector('#prjCwd')
  const okBtn = mask.querySelector('[data-ok]')
  const folderNameOf = (path) => String(path || '').trim().replace(/[\\/]+$/, '').split(/[\\/]/).pop() || ''
  const syncOk = () => {
    const ready = Boolean(cwdInput.value.trim())
    okBtn.disabled = !ready
    okBtn.style.setProperty('background', ready ? 'var(--accent)' : '#b9bdc4', 'important')
    okBtn.style.setProperty('color', ready ? '#fff' : '#fff', 'important')
    okBtn.style.setProperty('border-color', ready ? 'var(--accent)' : '#b9bdc4', 'important')
  }
  nameInput.addEventListener('input', syncOk)
  cwdInput.addEventListener('input', syncOk)
  const chooseFolder = async () => {
    if (!hasBridge) {
      toast('当前环境不支持系统文件夹选择，请直接输入本地路径', true)
      cwdInput.focus()
      return
    }
    try {
      const result = await window.jgClient.chooseFolder({ title: '选择项目文件夹' })
      if (!result.canceled && result.path) {
        cwdInput.value = result.path
        cwdInput.style.color = 'var(--text)'
        if (!nameInput.value.trim()) nameInput.value = folderNameOf(result.path)
        syncOk()
      }
    } catch (error) {
      toast(error?.message || '打开文件夹选择器失败', true)
    }
  }
  mask.querySelector('#prjBrowse')?.addEventListener('click', chooseFolder)
  mask.querySelector('#prjDrop')?.addEventListener('click', (e) => {
    if (hasBridge && e.target.closest('#prjDrop') && !e.target.closest('#prjBrowse') && !e.target.closest('#prjCwd')) chooseFolder()
  })
  mask.querySelector('#prjMemory')?.addEventListener('click', () => toast('工作区记忆将在后续版本开放'))
  mask.querySelector('[data-ok]').addEventListener('click', async () => {
    const cwd = cwdInput.value.trim()
    const name = nameInput.value.trim() || folderNameOf(cwd) || '本地工作区'
    const instructions = mask.querySelector('#prjInstructions')?.value.trim() || ''
    if (!cwd) return toast('请选择本地文件夹', true)
    const { ok, body } = await api('/api/projects/create', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, desc: '', cwd, instructions }),
    })
    if (!ok) return toast(body.error || '创建工作区失败', true)
    mask.remove()
    toast(body.existing ? `已打开现有工作区「${body.item.name}」` : `已创建工作区「${name}」`)
    state.sidebarProjects = [body.item, ...(state.sidebarProjects || []).filter((p) => p.id !== body.item.id)].slice(0, 3)
    state.projects = [body.item, ...(state.projects || []).filter((p) => p.id !== body.item.id)]
    if (typeof onDone === 'function') { onDone(body.item); return }
    state.view = 'projects'
    render()
  })
  setTimeout(() => nameInput.focus(), 30)
}

function openToolsMenu(anchor) {
  document.querySelectorAll('.popover').forEach((p) => p.remove())
  const pop = document.createElement('div')
  pop.className = 'popover'
  const { tools, network } = state.boot
  pop.innerHTML = tools.map((t) => {
    const disabled = !t.enabled
    const on = state.composerTools.includes(t.id)
    return `<button data-tool="${t.id}" ${disabled ? 'disabled' : ''} style="display:flex;align-items:center;gap:8px;width:100%;border:0;background:transparent;padding:6px 8px;border-radius:6px;font-size:var(--fs-sub);text-align:left;${disabled ? 'opacity:.45' : ''}">
      <span style="width:14px;color:${on ? 'var(--accent)' : 'var(--muted)'}">${on ? '✓' : ''}</span>${esc(t.label)}
    </button>`
  }).join('') + `<div style="padding:6px 8px;font-size:var(--fs-micro);color:var(--muted);border-top:1px solid var(--line);margin-top:4px">按当前网络与授权过滤；${esc(network?.label || '')}下不可用的工具不参与调用</div>`

  Object.assign(pop.style, {
    position: 'absolute', zIndex: 50, background: '#fff', border: '1px solid var(--line)',
    borderRadius: '8px', boxShadow: '0 10px 30px rgba(23,25,28,.12)', padding: '4px', minWidth: '210px',
  })
  document.body.appendChild(pop)
  const rect = anchor.getBoundingClientRect()
  pop.style.left = `${Math.max(8, Math.min(window.innerWidth - 220, rect.left))}px`
  const ph = pop.offsetHeight
  pop.style.top = `${Math.max(8, Math.min(window.innerHeight - ph - 8, rect.bottom + 6))}px`

  pop.querySelectorAll('[data-tool]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.tool
      state.composerTools = state.composerTools.includes(id)
        ? state.composerTools.filter((t) => t !== id)
        : [...state.composerTools, id]
      pop.remove()
      renderView()
    })
  })
  setTimeout(() => document.addEventListener('click', function close(ev) {
    if (!pop.contains(ev.target) && ev.target.isConnected) { pop.remove(); document.removeEventListener('click', close) }
  }), 0)
}

async function submitTask() {
  closeSlashMenu()
  if (state.pastingImages) return toast('图片还在上传，请稍候再发送', true)
  const text = composerPrompt('')
  if (!text) return toast('请输入任务描述，或粘贴图片附件', true)
  if (state.activeProjectId) {
    const p = currentProject()
    if (!p || p.status !== 'online') return toast('项目本地文件夹不可用，请重新连接或解除项目后再执行', true)
  }
  state.draft = ''
  state.conversation = null
  state.chatSteps = []
  state.chatError = ''
  state.pendingConfirm = null
  state.view = 'chat'
  state.chatBusy = true
  render()
  await sendMessage(text)
}

async function stopJob(jobId) {
  if (!state.conversation || !jobId) return
  const { ok, body } = await api('/api/conversation/job/kill', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ conversationId: state.conversation.id, jobId }),
  })
  if (!ok) return toast(body.error || '停止后台作业失败', true)
  for (const m of (state.conversation.messages || [])) {
    for (const j of (m.jobs || [])) if (/running|pending|已启动/i.test(String(j.status || ''))) j.status = '已停止'
  }
  renderView()
  toast('已停止后台作业；该项目运行时已重启')
}

async function cancelChat() {
  if (!state.chatBusy) return
  stopInteractionPoll()
  stopThinkingClock()
  state.pendingInteraction = null
  state.chatAbort = true
  state.chatRunId += 1
  state.chatBusy = false
  state.chatSteps = []
  renderView()
  const { ok, body } = await api('/api/chat/cancel', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ conversationId: state.conversation?.id }),
  })
  if (ok && body.conversation) state.conversation = body.conversation
  state.chatAbort = false
  renderView()
  toast(ok ? '已停止本轮生成' : (body.error || '停止失败'), !ok)
}

function startInteractionPoll() {
  stopInteractionPoll()
  state.pendingInteraction = null
  state.chatTask = {
    progressText: state.deepThink ? '深度思索中' : '正在建立任务上下文',
    activityDetail: state.deepThink ? '正在调用推理模型，等待首个结果' : '准备读取项目与工具状态',
  }
  state.qSel = {}
  state.qCustom = {}
  let seen = ''
  state.interactionPoll = setInterval(async () => {
    if (!state.chatBusy) return
    const conversationId = state.conversation?.id || ''
    const [pendingRes, taskRes] = await Promise.all([
      api(`/api/chat/pending?conversationId=${encodeURIComponent(conversationId)}`),
      api(`/api/chat/task?conversationId=${encodeURIComponent(conversationId)}`),
    ])
    if (!state.chatBusy) return
    if (taskRes?.ok && taskRes.body?.task) updateThinkingActivity(taskRes.body.task)
    if (!pendingRes?.ok) return
    const item = pendingRes.body.item || null
    const sig = item?.id || ''
    if (sig === seen) return
    seen = sig
    state.pendingInteraction = item
    state.qSel = {}
    state.qCustom = {}
    renderView()
  }, 800)
}

function stopInteractionPoll() {
  if (state.interactionPoll) clearInterval(state.interactionPoll)
  state.interactionPoll = null
}

async function decideApproval(outcome) {
  const p = state.pendingInteraction
  if (!p) return
  state.pendingInteraction = null
  renderView()
  const { ok, body } = await api('/api/chat/approval', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: p.id, outcome }),
  })
  if (!ok) toast(body.error || '审批回填失败', true)
  else toast(outcome === 'allowed-once' ? '已允许本次调用' : '已拒绝本次调用')
}

async function submitAnswer(cancel = false) {
  const p = state.pendingInteraction
  if (!p) return
  const answers = cancel ? [] : (p.questions || []).map((q) => ({
    id: q.id,
    selected: state.qSel?.[q.id] || [],
    ...(state.qCustom?.[q.id] ? { custom: state.qCustom[q.id] } : {}),
  }))
  state.pendingInteraction = null
  renderView()
  const { ok, body } = await api('/api/chat/answer', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: p.id, answers }),
  })
  if (!ok) toast(body.error || '回答回填失败', true)
}

function upsertConversationMeta(conv) {
  if (!conv?.id) return
  state.conversations = state.conversations || []
  const meta = {
    id: conv.id,
    title: conv.title || '新对话',
    time: conv.time || '刚刚',
    status: conv.status || 'running',
    projectId: conv.projectId || null,
    kind: conv.kind || 'chat',
    workspace: conv.workspace || '',
  }
  const at = state.conversations.findIndex((item) => item.id === conv.id)
  if (at >= 0) Object.assign(state.conversations[at], meta)
  else state.conversations.unshift(meta)
}

async function sendMessage(text, options = {}) {
  closeSlashMenu()
  closeMentionMenu()
  const regenerate = options.regenerate === true
  const messageIndex = Number(options.messageIndex)
  state.chatAbort = false
  const runId = ++state.chatRunId
  const idempotencyKey = (globalThis.crypto?.randomUUID?.() || `chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)
  state.lastChatKey = idempotencyKey
  state.chatBusy = true
  startThinkingClock()
  state.chatError = ''
  state.pendingConfirm = null
  const refs = (state.composerRefs || []).map((r) => ({ kind: r.kind, id: r.id }))
  clearComposerRefs()
  let conv = state.conversation
  if (!regenerate && !conv) {
    // 先分配会话 ID 并立即显示用户消息；首轮执行中的审批请求也能按会话被轮询到。
    conv = {
      id: `C-${Date.now()}${Math.floor(Math.random() * 900 + 100)}`,
      title: text.length > 26 ? `${text.slice(0, 26)}…` : text,
      time: '刚刚', messages: [], status: 'running', projectId: state.activeProjectId || null,
      executionPolicy: state.executionPolicy,
      deepThink: Boolean(state.deepThink),
    }
    state.conversation = conv
    upsertConversationMeta(conv)
    renderSidebar()
  }
  if (!conv) return
  if (!regenerate) conv.messages.push({ role: 'user', text, time: '刚刚' })
  renderView()
  startInteractionPoll()

  const res = await api('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      text,
      conversationId: state.conversation?.id,
      model: state.composerModel,
      tools: state.composerTools,
      reasoningEffort: state.reasoningEffort || 'medium',
      deepThink: Boolean(state.deepThink),
      ownApiKey: localStorage.getItem('jg.ownKey') || '',
      refs,
      mode: state.taskMode || 'auto',
      projectId: state.activeProjectId || state.conversation?.projectId || '',
      executionPolicy: state.executionPolicy,
      presetId: state.agentPresetId || '',
      webSearch: Boolean(state.webSearch),
      idempotencyKey,
      regenerate,
      messageIndex,
    }),
  }).catch((error) => ({ ok: false, status: 0, body: { error: error?.message || '网络请求失败，请稍后重试' } }))

  stopInteractionPoll()
  state.pendingInteraction = null
  if (runId !== state.chatRunId) return

  if (!res.ok) {
    stopThinkingClock()
    state.chatBusy = false
    state.chatError = res.body.error || '模型或工具调用失败'
    renderView()
    return
  }
  if (res.body.duplicate) {
    stopThinkingClock()
    state.chatBusy = false
    if (res.body.conversation) state.conversation = res.body.conversation
    renderView()
    toast('该请求此前已提交，已返回原会话结果')
    return
  }

  state.conversation = res.body.conversation
  upsertConversationMeta(state.conversation)
  renderSidebar()
  const convMeta = state.conversations.find((c) => c.id === state.conversation?.id)
  if (convMeta && state.conversation?.title) convMeta.title = state.conversation.title
  const citations = (res.body.citations || []).map((c) => c.id || c)
  if (res.body.requiresConfirm) {
    state.pendingConfirm = {
      text: res.body.confirmText,
      draft: res.body.draft,
      steps: res.body.steps || [],
    }
  } else {
    const last = regenerate
      ? state.conversation.messages[Number(messageIndex)]
      : state.conversation.messages[state.conversation.messages.length - 1]
    let draftMsg
    if (last && last.role === 'assistant') {
      draftMsg = last
      draftMsg.time = '刚刚'
      draftMsg.citations = citations.length ? citations : (draftMsg.citations || [])
    } else {
      draftMsg = { role: 'assistant', text: '', time: '刚刚', steps: [], citations, streaming: true }
      state.conversation.messages.push(draftMsg)
    }
    draftMsg.streaming = true
    draftMsg.pendingSteps = res.body.steps || []
    draftMsg.pendingText = res.body.reply || ''
    await animateMessage(draftMsg)
  }
  stopThinkingClock()
  state.chatBusy = false
  renderView()
}

/** 逐段展开回答，保留流式阅读感；不等待真实 SSE 才显示全文。 */
async function animateMessage(msg) {
  const steps = msg.pendingSteps || []
  state.chatSteps = []
  for (let i = 0; i < steps.length; i += 1) {
    state.chatSteps = [...state.chatSteps, steps[i]]
    msg.steps = state.chatSteps.slice()
    renderStream()
    await sleep(Math.min(360, Math.max(90, Number(steps[i]?.ms || 0) / 10)))
  }
  msg.steps = steps
  delete msg.pendingSteps
  state.chatSteps = []
  const full = msg.pendingText || ''
  delete msg.pendingText
  const chunk = Math.max(12, Math.ceil(full.length / 90))
  for (let i = chunk; i <= full.length; i += chunk) {
    msg.text = full.slice(0, i)
    renderStream()
    await sleep(16)
  }
  msg.text = full
  msg.streaming = false
  state.chatSteps = []
}

function renderStream() {
  if (state.view === 'chat') renderChatMsgs()
  else renderView()
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* ---------------------------- datacenter ---------------------------- */

function categoryLabel(value) {
  return String(value || '').replace(/（法人单位）/g, '').replace(/（控股子公司）/g, '').trim()
}

function businessCategoryOptions() {
  const fixed = ['规划', '建筑', '市政', '风景园林', '测绘', '企业经营管理', '总工办']
  return [...fixed, '其他'].filter((v, i, arr) => v && arr.indexOf(v) === i)
}

function overviewHtml(ov) {
  if (!ov) return ''
  const nf = (n) => Number(n || 0).toLocaleString('zh-CN')
  const downloads = ov.quarterDownloads || []
  const calls = ov.quarterCalls || []
  const departments = ov.diligentDepartments || []
  const now = new Date()
  const qLabel = `${now.getFullYear()} Q${Math.floor(now.getMonth() / 3) + 1}`
  const resRow = (x, i, metric, unit) => `<button class="hot-row" data-hot-id="${esc(x.id)}"><span class="hot-rank">${i + 1}</span><span class="hot-main"><span class="hot-name">${esc(x.name)}</span><span class="hot-meta">${esc(categoryLabel(x.category))} · ${esc(x.owner || '—')}</span></span><span class="hot-num">${nf(x[metric])}<em>${unit}</em></span></button>`
  return `<div class="dc-overview">
    <div class="ov-head"><div class="ov-title">数据概览</div></div>
    <div class="ov-stats">
      <div class="ov-stat"><span class="ov-num">${nf(ov.total)}</span><span class="ov-label">数据总量</span></div>
      <div class="ov-stat"><span class="ov-num">${esc(ov.totalSizeLabel || '0 B')}</span><span class="ov-label">存储总量</span></div>
      <div class="ov-stat"><span class="ov-num">${nf(ov.newCount)}</span><span class="ov-label">近 30 天更新</span></div>
    </div>
    <div class="ov-grid">
      <div class="ov-block">
        <div class="ov-block-head">季度热门下载数据 <span class="ov-block-note">${esc(qLabel)} · TOP 5</span></div>
        <div class="hot-list">
          ${downloads.map((x, i) => resRow(x, i, 'downloads', ' 次')).join('') || '<div class="ov-empty">暂无下载数据</div>'}
        </div>
      </div>
      <div class="ov-block">
        <div class="ov-block-head">季度热门调用数据 <span class="ov-block-note">${esc(qLabel)} · TOP 5</span></div>
        <div class="hot-list">
          ${calls.map((x, i) => resRow(x, i, 'calls', ' 次')).join('') || '<div class="ov-empty">暂无调用数据</div>'}
        </div>
      </div>
      <div class="ov-block">
        <div class="ov-block-head">更新勤勉部门 <span class="ov-block-note">2026 · TOP 5</span></div>
        <div class="hot-list">
          ${departments.map((d, i) => `<div class="hot-row"><span class="hot-rank">${i + 1}</span><span class="hot-main"><span class="hot-name">${esc(d.name)}</span><span class="hot-meta">最近更新 ${esc((d.last || '—').slice(0, 10))}</span></span><span class="hot-num">${nf(d.count)}<em> 次</em></span></div>`).join('') || '<div class="ov-empty">暂无部门更新数据</div>'}
        </div>
      </div>
    </div>
  </div>`
}

async function renderDatacenter(el) {
  const categories = businessCategoryOptions()
  const canRegister = state.boot?.user?.id !== 'guest'
  const { body: overview } = await api('/api/datacenter/overview')
  state.overview = overview || null
  const newByCategory = new Map((overview?.categories || []).map((c) => [categoryLabel(c.name), c.newCount]))
  el.innerHTML = `<div class="view-head dc-view-head">
      <div><div class="view-title">数据中心</div></div>
      <div class="search dc-head-search"><span class="ico">${icon('search')}</span><input id="dcSearch" placeholder="搜索名称、来源、全文摘要…" value="${esc(state.resourceQuery)}" /></div>
      <div class="spacer"></div>
      ${canRegister ? `<button class="btn primary" id="registerBtn">${icon('plus')}登记资源</button>` : ''}
    </div>
    ${overviewHtml(overview)}
    <div class="dc-main">
      <div class="toolbar">
        <div class="chips" id="categoryChips">
          <button class="chip${state.resourceCategory === 'all' ? ' active' : ''}" data-category="all">全部${overview?.newCount ? `<span class="chip-badge">${overview.newCount}</span>` : ''}</button>
          ${categories.map((c) => `<button class="chip${state.resourceCategory === c ? ' active' : ''}" data-category="${esc(c)}">${esc(c)}${newByCategory.get(c) ? `<span class="chip-badge">${newByCategory.get(c)}</span>` : ''}</button>`).join('')}
        </div>
      </div>
      <div class="table-card">
        <div class="table-head dc-res-head" id="dcHead"><span></span><span>资源名称</span><span>来源系统</span><span>上传时间</span><span>授权状态</span><span>密级</span></div>
        <div id="dcRows"></div>
      </div>
      <div class="dc-pager" id="dcPager"></div>
    </div>`

  const search = el.querySelector('#dcSearch')
  search.addEventListener('input', debounce(async (e) => {
    state.resourceQuery = e.target.value
    state.resourcePage = 1
    await loadResources()
  }, 260))

  el.querySelectorAll('[data-category]').forEach((btn) => btn.addEventListener('click', async () => {
    state.resourceCategory = btn.dataset.category
    state.resourcePage = 1
    el.querySelectorAll('[data-category]').forEach((b) => b.classList.toggle('active', b === btn))
    await loadResources()
  }))

  el.querySelector('#registerBtn')?.addEventListener('click', openRegisterForm)
  el.querySelectorAll('[data-hot-id]').forEach((btn) => btn.addEventListener('click', () => openResource(btn.dataset.hotId)))

  await loadResources()
}

function debounce(fn, wait) {
  let t
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait) }
}

async function renderFormats(el) {
  const { body, ok } = await api('/api/formats/capabilities').catch(() => ({ ok: false, body: {} }))
  const items = ok ? (body.items || []) : []
  const fallback = [
    { id: 'pdf', label: 'PDF', family: '文档', read: ['页数与页面尺寸', '文本提取', '内嵌预览'], write: ['合并', '按页范围拆分'], note: '本机 pdf-lib 运行时' },
    { id: 'gis', label: 'GIS / SHP / GDB / GeoJSON', family: '空间数据', read: ['GeoJSON 要素与几何', 'Shapefile 要素/属性', 'File Geodatabase 多图层', 'SHP / GDB 文件夹直读', 'ZIP 数据包', '范围 bbox', '坐标系声明', 'SVG 预览'], write: ['输出 Shapefile', '输出 File Geodatabase', '多个 SHP 合并 GDB', 'SHP / GDB / GeoJSON 互转'], note: '以 SHP 与 GDB 为主格式：SHP 可直接选文件夹或一次多选 .shp/.dbf/.shx/.prj，GDB 直接选 .gdb 文件夹，均无需压缩；GDB 下载为 ZIP，解压后为 .gdb 文件夹；不做投影转换。' },
    { id: 'cad', label: 'CAD / DXF', family: '空间数据', read: ['实体', '图层', '范围', 'SVG 预览'], write: ['ASCII DXF 回写'], note: 'DWG 需先转 DXF' },
  ]
  const cards = (items.length ? items : fallback)
  el.innerHTML = `<div style="max-width:1180px;margin:0 auto;padding:24px">
    <div style="display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap">
      <div>
        <div style="font-size:24px;font-weight:700">数据格式基座</div>
        <div style="color:var(--muted);margin-top:6px;max-width:820px;line-height:1.7">PDF / GIS / CAD 是平台级读写能力，由数据中心、智能笔记本、Harness Agent 与 MCP 工具共用。这里只提供基座控制台，不属于数据中心功能模块。</div>
      </div>
      <div style="margin-left:auto;display:flex;gap:8px;align-items:center"><span class="tag">平台级</span><span class="tag">本机运行</span></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:18px">
      ${cards.map((item) => `<div class="mc-block" style="padding:14px;grid-column:auto !important">
        <div style="display:flex;align-items:center;gap:8px"><b>${esc(item.label)}</b><span class="tag">${esc(item.family || '数据')}</span></div>
        <div class="mc-id" style="margin-top:8px">读取：${esc((item.read || []).join('、'))}</div>
        <div class="mc-id" style="margin-top:2px">输出：${esc((item.write || []).join('、'))}</div>
        <div class="form-note" style="margin-top:8px">${esc(item.note || '')}</div>
      </div>`).join('')}
    </div>
    <div class="mc-block" style="padding:14px;margin-top:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <div style="flex:1;min-width:260px"><b>格式运行器</b><div class="mc-id" style="margin-top:4px">SHP / GDB 可直接选择文件夹，不需要压缩；SHP 与 GDB 可互转，GeoJSON 可转换为 SHP 或 GDB。PDF、GIS、CAD 共用同一套 inspect / export 服务。</div></div>
      <button class="btn primary" id="fmtPdf">打开 PDF 运行器</button>
      <button class="btn" id="fmtSpatial">打开 GIS / CAD 运行器</button>
    </div>
    <div class="form-note" style="margin-top:12px">Agent 与 MCP 可通过 format_capabilities / format_inspect / format_export 调用同一基座；PDF 合并与拆分、GeoJSON 规范化、DXF 回写均返回真实文件。</div>
  </div>`
  el.querySelector('#fmtPdf')?.addEventListener('click', openPdfTool)
  el.querySelector('#fmtSpatial')?.addEventListener('click', openSpatialTool)
}

async function openSpatialTool() {
  const mask = openModal('GIS / CAD 格式运行器', `<div style="min-width:760px;max-width:86vw">
    <div class="mc-id" style="margin-bottom:10px">平台格式基座 · 直接读取 SHP / GDB 文件夹，不需要压缩；SHP 与 GDB 可互转，GeoJSON 可转换为这两种主格式。DWG 需先转换为 DXF。</div>
    <div class="mc-block" style="padding:12px;margin-bottom:10px">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <input type="file" id="geoFolder" webkitdirectory directory multiple style="display:none">
        <input type="file" id="geoFile" accept=".geojson,.json,.dxf,.zip,.shp,.dbf,.shx,.prj,.cpg,.sbn,.sbx,.qix,.gdb,application/geo+json,application/zip" multiple style="display:none">
        <button class="btn sm primary" id="geoPickFolder">选择 SHP / GDB 文件夹</button>
        <button class="btn sm" id="geoPickFile">选择单个文件</button>
        <span class="mc-dim" id="geoPickInfo">尚未选择数据</span>
      </div>
      <div class="mc-id" style="margin-top:8px">SHP 文件夹需包含 .shp/.dbf/.shx（建议带 .prj）；一个文件夹里有多个 SHP 时可合并输出为一个 GDB。GDB 直接选择整个 .gdb 文件夹。GeoJSON 与 ZIP 包也可直接选择。</div>
    </div>
    <div id="geoOut"><div class="mc-block" style="padding:12px"><div class="mc-dim">选择数据后解析真实几何、图层、范围与要素数量。</div></div></div>
  </div>`, { wide: true })
  const folderInput = mask.querySelector('#geoFolder')
  const fileInput = mask.querySelector('#geoFile')
  const pickInfo = mask.querySelector('#geoPickInfo')
  const out = mask.querySelector('#geoOut')
  let chosen = []
  let uploaded = []
  let inspectName = ''
  let singleMode = false

  mask.querySelector('#geoPickFolder')?.addEventListener('click', () => folderInput.click())
  mask.querySelector('#geoPickFile')?.addEventListener('click', () => fileInput.click())
  folderInput?.addEventListener('change', () => {
    chosen = [...(folderInput.files || [])]
    singleMode = false
    const root = chosen[0]?.webkitRelativePath?.split('/')[0] || '空间数据'
    inspectName = root
    pickInfo.textContent = chosen.length ? `${root}（${chosen.length} 个文件）` : '尚未选择数据'
    if (chosen.length) run()
  })
  fileInput?.addEventListener('change', () => {
    chosen = [...(fileInput.files || [])]
    singleMode = chosen.length === 1 && !/\.(shp|gdb)$/i.test(chosen[0]?.name || '')
    const stems = [...new Set(chosen.map((file) => String(file.name || '').replace(/\.(shp|dbf|shx|prj|cpg|sbn|sbx|qix)$/i, '')))].filter(Boolean)
    inspectName = chosen.length === 1 ? (chosen[0]?.name || '') : (stems.length === 1 ? stems[0] : '合并数据')
    pickInfo.textContent = chosen.length
      ? (chosen.length === 1 ? `${chosen[0].name}（${(chosen[0].size / 1024).toFixed(1)} KB）` : `${chosen.length} 个文件`)
      : '尚未选择数据'
    if (chosen.length) run()
  })

  function pathOf(file) {
    return String(file.webkitRelativePath || file.name || 'data.bin').replace(/\\/g, '/')
  }

  async function uploadAll() {
    uploaded = []
    for (const [index, file] of chosen.entries()) {
      pickInfo.textContent = `正在上传 ${index + 1}/${chosen.length}：${file.name}`
      const res = await fetch(`/api/files/upload?kind=spatial&name=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        headers: { 'content-type': file.type || 'application/octet-stream' },
        body: file,
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body?.file?.id) throw new Error(body?.error || `上传 ${file.name} 失败`)
      uploaded.push({ id: body.file.id, path: pathOf(file), name: file.name })
    }
    return uploaded
  }

  async function run() {
    if (!chosen.length) return
    try {
      out.innerHTML = `<div class="mc-block" style="padding:12px"><div class="mc-dim">正在上传 ${esc(inspectName || chosen[0].name)}…</div></div>`
      await uploadAll()
      const first = chosen[0]
      const useFileId = singleMode && !/\.(shp|gdb)$/i.test(first.name) && !first.webkitRelativePath
      const body = useFileId
        ? { fileId: uploaded[0].id, name: inspectName, mime: first.type || '' }
        : { files: uploaded, name: inspectName || first.name.replace(/\.(shp|gdb)$/i, '') }
      const result = await api('/api/formats/inspect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      if (!result.ok) throw new Error(result.body?.detail || result.body?.error || '解析失败')
      const d = result.body
      const isDxf = d.format === 'cad' || d.kind === 'dxf'
      const targets = isDxf ? [] : ['shp', 'gdb']
      const targetLabel = { shp: '输出 SHP', gdb: '输出 GDB' }
      out.innerHTML = `<div class="mc-block" style="padding:12px">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b>${esc(d.name || inspectName)}</b><span class="tag ok">${esc(d.formatLabel || (isDxf ? 'DXF' : '空间数据'))}</span><span class="mc-dim">${d.features} 个${isDxf ? '实体' : '要素'} · ${d.pointCount || 0} 个坐标点${d.previewFeatures && d.previewFeatures < d.features ? `（预览 ${d.previewFeatures} 个）` : ''}</span></div>
        <div class="mc-id" style="margin-top:6px">范围：${(d.bbox || []).join(' , ') || '未声明'} · 坐标系：${esc(d.crs)}${d.crsMixed ? '（多坐标系，按图层保留）' : ''} · 图层：${esc((d.layers || []).join('、') || '未声明')}</div>
        <div class="mc-id" style="margin-top:2px">类型：${esc((d.geometryTypes || d.entityTypes || []).join('、'))}</div>
        ${d.sourceFiles?.length > 1 ? `<div class="mc-id" style="margin-top:2px">数据源：${esc(d.sourceFiles.slice(0, 8).join('、'))}${d.sourceFiles.length > 8 ? ' …' : ''}</div>` : ''}
        ${d.fields?.length ? `<div class="mc-id" style="margin-top:2px">属性字段：${esc(d.fields.slice(0, 12).join('、'))}${d.fields.length > 12 ? ' …' : ''}</div>` : ''}
        ${d.layerDetails?.length ? `<div class="mc-id" style="margin-top:2px">图层：${esc(d.layerDetails.map((x) => `${x.name}（${x.features}）`).join('、'))}</div>` : ''}
        ${d.note ? `<div class="form-note" style="margin-top:6px">${esc(d.note)}</div>` : ''}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">${targets.map((target) => `<button class="btn sm" data-fmt-export="${target}">${targetLabel[target]}</button>`).join('')}${isDxf ? `<button class="btn sm" data-fmt-export="dxf">输出 DXF</button>` : ''}<span class="mc-dim" id="fmtExportStatus"></span></div>
        <div id="fmtExportOut"></div>
        <div style="border:1px solid var(--line);border-radius:10px;overflow:hidden;margin-top:10px;height:430px;background:#fff">${d.svg || ''}</div>
        <div class="mc-id" style="margin-top:6px">预览由本机解析出的坐标生成；不是静态图片，也不做投影转换。</div>
      </div>`
      out.querySelectorAll('[data-fmt-export]').forEach((button) => button.addEventListener('click', () => exportTarget(button)))
      async function exportTarget(button) {
        const status = out.querySelector('#fmtExportStatus')
        const exportOut = out.querySelector('#fmtExportOut')
        const target = button.dataset.fmtExport
        button.disabled = true
        if (status) status.textContent = `正在生成 ${target.toUpperCase()}…`
        try {
          let exported
          if (target === 'dxf') {
            exported = await api('/api/formats/export', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ format: 'cad', op: 'normalize', fileId: uploaded[0].id, name: inspectName || chosen[0].name }) })
          } else {
            const useFiles = !useFileId
            exported = await api('/api/formats/export', {
              method: 'POST', headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                format: 'gis', op: 'convert', target,
                name: useFiles ? (inspectName || chosen[0].name || '数据').replace(/\.(zip|shp|gdb|geojson|json)$/i, '') : (chosen[0]?.name || inspectName),
                ...(useFiles ? { files: uploaded } : { fileId: uploaded[0].id }),
              }),
            })
          }
          if (!exported.ok) throw new Error(exported.body?.detail || exported.body?.error || '输出失败')
          if (status) status.textContent = exported.body.files?.length ? `已输出 ${exported.body.files.length} 个文件` : '已输出'
          if (exportOut) {
            const files = exported.body.files || []
            exportOut.innerHTML = `<div style="margin-top:8px;display:flex;flex-direction:column;gap:6px">${files.map((file) => `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="mono" style="font-size:12px">${esc(file.name)}</span><span class="mc-dim">${file.size < 1024 ? `${file.size} B` : `${Math.round(file.size / 1024)} KB`}</span><a class="btn sm" href="${esc(file.url)}" download>下载</a></div>`).join('')}</div>${target === 'gdb' ? '<div class="form-note" style="margin-top:6px">GDB 是文件夹格式，下载 ZIP 后解压即得到 .gdb 文件夹。</div>' : target === 'shp' ? '<div class="form-note" style="margin-top:6px">SHP 为多文件格式，请把同一名称的 .shp/.dbf/.shx/.prj 放在同一文件夹中使用。</div>' : ''}`
          }
        } catch (error) {
          if (status) status.textContent = error?.message || '输出失败'
          if (exportOut) exportOut.innerHTML = `<div class="mc-id" style="margin-top:6px;color:var(--warn)">${esc(error?.message || '输出失败')}</div>`
        } finally { button.disabled = false }
      }
    } catch (error) {
      out.innerHTML = `<div class="mc-block" style="padding:12px;color:var(--warn)">${esc(error?.message || '解析失败')}</div>`
    }
  }
}

async function openPdfTool() {
  const mask = openModal('PDF 格式运行器', `<div style="min-width:720px;max-width:86vw">
    <div class="mc-id" style="margin-bottom:10px">平台格式基座 · 真实解析、合并、拆分与文本提取；文件在本机处理，不调用外部服务。</div>
    <div class="mc-block" style="padding:12px;margin-bottom:10px">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <input type="file" id="pdfFiles" accept="application/pdf,.pdf" multiple style="display:none">
        <button class="btn sm primary" id="pdfPick">选择 PDF 文件</button>
        <span class="mc-dim" id="pdfPickInfo">尚未选择文件</span>
      </div>
      <div class="mc-id" style="margin-top:8px">支持选择多个文件用于合并；解析、拆分、提取文本使用第一个文件。</div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
      <button class="btn sm" data-pdf-op="inspect">解析 / 预览</button>
      <button class="btn sm" data-pdf-op="merge">合并</button>
      <input id="pdfRanges" placeholder="拆分页范围，如 1-3,5" style="width:190px;padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:transparent;color:inherit">
      <button class="btn sm" data-pdf-op="split">拆分</button>
      <button class="btn sm" data-pdf-op="extract">提取文本</button>
    </div>
    <div id="pdfOut"><div class="mc-block" style="padding:12px"><div class="mc-dim">选择 PDF 后执行操作。解析结果、页数和下载链接都来自后端真实文件。</div></div></div>
  </div>`, { wide: true })
  const filesInput = mask.querySelector('#pdfFiles')
  const pickInfo = mask.querySelector('#pdfPickInfo')
  const out = mask.querySelector('#pdfOut')
  let selected = []
  let uploaded = []
  const setBusy = (text) => { out.innerHTML = `<div class="mc-block" style="padding:12px"><div class="mc-dim">${esc(text)}</div></div>` }
  const uploadAll = async () => {
    uploaded = []
    if (!selected.length) throw new Error('请先选择 PDF 文件')
    for (const file of selected) {
      const res = await fetch(`/api/files/upload?kind=pdf&name=${encodeURIComponent(file.name)}`, {
        method: 'POST', headers: { 'content-type': file.type || 'application/pdf' }, body: file,
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body?.file?.id) throw new Error(body?.error || `上传失败：${file.name}`)
      uploaded.push({ ...body.file, localName: file.name })
    }
    return uploaded
  }
  const outputLinks = (files) => files.map((file) => `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px">
    <span class="mono" style="font-size:12px;word-break:break-all">${esc(file.name)}</span>
    <span class="mc-dim">${file.pages ? `第 ${esc(file.pages)} 页 · ` : ''}${(Number(file.size || 0) / 1024).toFixed(0)} KB</span>
    <a class="btn sm" href="${esc(file.url)}" download>下载</a>
    ${file.id ? `<a class="btn sm subtle" href="/api/pdf/view?fileId=${encodeURIComponent(file.id)}" target="_blank">打开</a>` : ''}
  </div>`).join('')
  mask.querySelector('#pdfPick').addEventListener('click', () => filesInput.click())
  filesInput.addEventListener('change', () => {
    selected = [...filesInput.files].filter((file) => /\.pdf$/i.test(file.name) || file.type === 'application/pdf')
    pickInfo.textContent = selected.length ? `${selected.map((f) => f.name).join('、')}（${selected.length} 个）` : '未选择有效的 PDF 文件'
  })
  mask.querySelectorAll('[data-pdf-op]').forEach((button) => button.addEventListener('click', async () => {
    const op = button.dataset.pdfOp
    try {
      setBusy('正在上传并读取 PDF…')
      if (!uploaded.length || uploaded.length !== selected.length) await uploadAll()
      if (op === 'inspect') {
        const info = await api('/api/formats/inspect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fileId: uploaded[0].id, name: uploaded[0].localName, mime: 'application/pdf' }) })
        if (!info.ok) throw new Error(info.body?.error || '解析失败')
        const d = info.body
        out.innerHTML = `<div class="mc-block" style="padding:12px">
          <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><b>${esc(uploaded[0].localName)}</b><span class="tag ok">${d.pageCount} 页</span><span class="mc-dim">${(d.bytes / 1024).toFixed(0)} KB</span></div>
          <div class="mc-id" style="margin-top:8px">标题：${esc(d.title || '未设置')} · 作者：${esc(d.author || '未设置')} · 生成器：${esc(d.producer || '未设置')}</div>
          <div class="mc-id" style="margin-top:4px">页面：${d.pages.map((p) => `${p.index}（${p.width}×${p.height}${p.rotation ? `，旋转 ${p.rotation}°` : ''}）`).join('、')}</div>
          <iframe src="/api/pdf/view?fileId=${encodeURIComponent(uploaded[0].id)}" style="width:100%;height:420px;border:1px solid var(--line);border-radius:10px;margin-top:10px;background:#fff" title="PDF 预览"></iframe>
          <div class="mc-id" style="margin-top:6px">预览来自真实 PDF 文件；若浏览器无法内嵌，可用下方“下载/打开”链接。</div>
          <div style="margin-top:8px"><a class="btn sm" href="/api/files/download?id=${encodeURIComponent(uploaded[0].id)}" download>下载原文件</a></div>
        </div>`
      } else if (op === 'merge') {
        if (uploaded.length < 2) throw new Error('合并至少需要选择两个 PDF 文件')
        const result = await api('/api/formats/export', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ format: 'pdf', op: 'merge', fileIds: uploaded.map((f) => f.id), name: '合并文档' }) })
        if (!result.ok) throw new Error(result.body?.error || '合并失败')
        out.innerHTML = `<div class="mc-block" style="padding:12px"><b>合并完成</b><span class="tag ok" style="margin-left:8px">${result.body.files.length} 个文件</span>${outputLinks(result.body.files)}</div>`
      } else if (op === 'split') {
        const ranges = mask.querySelector('#pdfRanges').value.trim()
        const result = await api('/api/formats/export', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ format: 'pdf', op: 'split', fileId: uploaded[0].id, ranges, name: '拆分文档' }) })
        if (!result.ok) throw new Error(result.body?.error || result.body?.detail || '拆分失败')
        out.innerHTML = `<div class="mc-block" style="padding:12px"><b>拆分完成</b><span class="tag ok" style="margin-left:8px">${result.body.files.length} 个文件</span>${outputLinks(result.body.files)}</div>`
      } else if (op === 'extract') {
        const result = await api('/api/formats/extract', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fileId: uploaded[0].id, name: uploaded[0].localName, mime: 'application/pdf' }) })
        if (!result.ok) throw new Error(result.body?.error || '提取失败')
        const text = result.body.text || ''
        out.innerHTML = `<div class="mc-block" style="padding:12px"><b>文本提取</b><span class="tag ok" style="margin-left:8px">${text.length} 字符</span>
          <div class="mc-id" style="margin-top:4px">${esc(result.body.note || '')}</div>
          <div class="mono" style="white-space:pre-wrap;word-break:break-word;max-height:340px;overflow:auto;margin-top:8px;font-size:12px;line-height:1.6">${esc(text || '（没有提取到可显示文本）')}</div></div>`
      }
    } catch (error) {
      out.innerHTML = `<div class="mc-block" style="padding:12px;color:var(--warn)">${esc(error?.message || '操作失败')}</div>`
    }
  }))
}

function pageSeq(page, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const keep = new Set([1, pages, page - 1, page, page + 1])
  const nums = [...keep].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b)
  const out = []
  nums.forEach((n, i) => {
    if (i && n - nums[i - 1] > 1) out.push('…')
    out.push(n)
  })
  return out
}

async function loadResources() {
  if (state.resourceType === 'service') {
    const head = document.getElementById('dcHead')
    const rows0 = document.getElementById('dcRows')
    const count0 = document.getElementById('dcCount')
    if (!rows0) return
    if (head) head.classList.remove('dc-res-head')
    if (head) head.innerHTML = '<span>数据服务</span><span style="margin-left:auto">接口</span><span style="width:84px">调用量</span><span style="width:74px">状态</span>'
    const { body } = await api('/api/dataservices')
    const items = body.items || []
    const pageSize = 10
    const pages = Math.max(1, Math.ceil(items.length / pageSize))
    const page = Math.min(Math.max(1, state.servicePage || 1), pages)
    state.servicePage = page
    const pageItems = items.slice((page - 1) * pageSize, page * pageSize)
    if (count0) count0.textContent = `${items.length} 个接口 · ${items.filter((d) => d.status && d.status !== 'authorized').length ? '含待审批服务' : '仅已授权服务可见'}`
    rows0.innerHTML = pageItems.map((d) => {
      const st = statusMap[d.status] || statusMap.authorized
      return `<button class="row" data-svc="${esc(d.id || d.path)}">
      <span class="type-ico">${icon('globe')}</span>
      <span class="name"><b>${esc(d.name)}</b><span>${esc(d.method)} · ${esc(d.path)} · ${esc(d.scope)}</span></span>
      <span class="src">${esc(d.scope)}</span>
      <span class="tm">${d.calls} 次</span>
      <span><span class="tag ${st.cls}">${st.label}</span></span>
      <span><span class="tag">${esc(d.latency)}</span></span>
    </button>`
    }).join('') || `<div style="padding:24px;text-align:center;color:var(--muted)">当前没有可用的数据服务</div>`
    rows0.querySelectorAll('[data-svc]').forEach((b) => b.addEventListener('click', () => toast('接口调用需在应用侧申请，调用留痕并入本域审计')))
    const pager0 = document.getElementById('dcPager')
    if (pager0) {
      pager0.innerHTML = pages > 1
        ? `<span class="dc-page-info">每页最多 ${pageSize} 条 · 共 ${items.length} 条</span>
          <button class="btn sm" data-spage="${page - 1}" ${page <= 1 ? 'disabled' : ''}>上一页</button>
          ${pageSeq(page, pages).map((p) => p === '…' ? '<span class="ac-pager-dots">…</span>' : `<button class="btn sm${p === page ? ' active' : ''}" data-spage="${p}">${p}</button>`).join('')}
          <button class="btn sm" data-spage="${page + 1}" ${page >= pages ? 'disabled' : ''}>下一页</button>`
        : `<span class="dc-page-info">每页最多 ${pageSize} 条 · 共 ${items.length} 条</span>`
      pager0.querySelectorAll('[data-spage]').forEach((b) => b.addEventListener('click', () => {
        const p = Number(b.dataset.spage)
        if (!Number.isFinite(p) || p < 1 || p > pages) return
        state.servicePage = p
        loadResources()
      }))
    }
    return
  }
  const head = document.getElementById('dcHead')
  if (head) head.classList.add('dc-res-head')
  if (head) head.innerHTML = '<span></span><span>资源名称</span><span>来源系统</span><span>上传时间</span><span>授权状态</span><span>密级</span>'
  const qs = new URLSearchParams({ category: state.resourceCategory, q: state.resourceQuery })
  const { body } = await api(`/api/resources?${qs}`)
  state.resourceList = body.items || []
  const rows = document.getElementById('dcRows')
  const count = document.getElementById('dcCount')
  const pager = document.getElementById('dcPager')
  if (!rows) return
  const pageSize = state.resourcePageSize || 10
  const pages = Math.max(1, Math.ceil(state.resourceList.length / pageSize))
  state.resourcePage = Math.min(Math.max(1, state.resourcePage || 1), pages)
  const pageItems = state.resourceList.slice((state.resourcePage - 1) * pageSize, state.resourcePage * pageSize)
  if (count) count.textContent = state.resourceList.length
    ? `${body.totalVisible} 项可见 · 第 ${state.resourcePage} / ${pages} 页 · 每页最多 ${pageSize} 条`
    : `${body.totalVisible} 项可见 / 全目录 ${body.totalAll} 项`
  rows.innerHTML = pageItems.map((r) => {
    const t = typeMap[r.type] || typeMap.document
    const s = statusMap[r.status] || statusMap.authorized
    const sec = securityMap[r.security] || securityMap.internal
    const folder = r.regKind === 'deliverable' || r.type === 'deliverable'
    return `<button class="row${folder ? ' folder-row' : ''}" data-id="${r.id}">
      <span class="type-ico">${icon(folder ? 'folder' : t.icon)}</span>
      <span class="name"><b>${r.isNew ? '<span class="new-badge">NEW</span>' : ''}${esc(r.name)}</b><span>${folder ? '成果文件夹 · ' : r.regKind === 'pure' ? '普通数据 · ' : ''}${esc(categoryLabel(r.businessCategory || '其他'))} · ${esc(folder ? (r.formats || []).join(' / ') || '多格式' : t.label)} · ${esc(r.dataOwner || r.owner)}</span></span>
      <span class="src">${esc(r.source)}</span>
      <span class="tm">${esc(r.updated.slice(5, 16))}</span>
      <span><span class="tag ${s.cls}">${s.label}</span></span>
      <span><span class="tag ${sec.cls}">${sec.label}</span></span>
    </button>`
  }).join('') || `<div style="padding:24px;text-align:center;color:var(--muted)">当前筛选下没有可见资源</div>`

  if (pager) {
    pager.innerHTML = pages > 1
      ? `<span class="dc-page-info">每页最多 ${pageSize} 条 · 共 ${state.resourceList.length} 条</span>
        <button class="btn sm" data-page="${state.resourcePage - 1}" ${state.resourcePage === 1 ? 'disabled' : ''}>上一页</button>
        ${pageSeq(state.resourcePage, pages).map((p) => p === '…' ? '<span class="ac-pager-dots">…</span>' : `<button class="btn sm${p === state.resourcePage ? ' active' : ''}" data-page="${p}">${p}</button>`).join('')}
        <button class="btn sm" data-page="${state.resourcePage + 1}" ${state.resourcePage === pages ? 'disabled' : ''}>下一页</button>`
      : `<span class="dc-page-info">每页最多 ${pageSize} 条 · 共 ${state.resourceList.length} 条</span>`
    pager.querySelectorAll('[data-page]').forEach((b) => b.addEventListener('click', async () => {
      const p = Number(b.dataset.page)
      if (!Number.isFinite(p) || p < 1 || p > pages || p === state.resourcePage) return
      state.resourcePage = p
      await loadResources()
    }))
  }

  rows.querySelectorAll('[data-id]').forEach((btn) => btn.addEventListener('click', () => openResource(btn.dataset.id)))
}

async function loadSatellite() {
  const { body } = await api('/api/satellite')
  state.satellite = body
  const side = document.getElementById('dcSide')
  if (!side) return
  const q = body.quarters.find((x) => x.id === body.current) || body.quarters[body.quarters.length - 1]
  side.innerHTML = `
    <div class="side-card">
      <div class="side-card-head">卫星影像专题<span class="spacer"></span><span class="mono" style="color:var(--muted)">${body.mode === 'online' ? '在线引用' : '1,796 GB'}</span></div>
      <div class="side-card-body">
        <div class="imagery ${body.mode === 'online' ? 'online' : ''}">
          <span class="cross">${body.mode === 'online' ? '天地图 · WMTS' : 'CGCS2000 · 0.5 m'}</span>
          ${body.mode === 'online' ? `<div class="imagery-note">在线底图（引用）<br/>不复制存储</div>` : ''}
        </div>
        <div class="quarter-tabs">
          ${body.quarters.map((x) => `<button class="qtab${x.id === body.current ? ' active' : ''}" data-q="${x.id}">${x.label}</button>`).join('')}
        </div>
        <dl class="kv">
          <dt>成像日期</dt><dd>${esc(q.date)}</dd>
          <dt>入库日期</dt><dd>${esc(q.input)}</dd>
          <dt>分辨率</dt><dd>${esc(q.resolution)}</dd>
          <dt>覆盖范围</dt><dd>${esc(q.coverage)}</dd>
          <dt>数据源</dt><dd>${esc(body.source)}</dd>
        </dl>
        <div class="history-row">
          ${body.history.map((y) => `<span class="h-year">${y}</span>`).join('')}
        </div>
        <div class="side-actions">
          <button class="btn sm primary" id="compareBtn">${icon('layers')}卷帘对比 Q2 / Q3</button>
          <button class="btn sm" id="imageryArchive">年度归档</button>
        </div>
        <div style="margin-top:10px;font-size:var(--fs-micro);color:var(--muted);line-height:1.5">${esc(body.note)}</div>
      </div>
    </div>
    <div class="side-card">
      <div class="side-card-head">检索能力</div>
      <div class="side-card-body" style="font-size:var(--fs-meta);color:var(--text-2);line-height:1.7">
        名称与元数据 · 文档全文 · 空间范围 · 业务搜索<br/>
        <span style="color:var(--muted)">空间索引仅对已确认地理参考的资源建立；坐标不完整的 CAD 仅提示，不参与范围检索。</span>
      </div>
    </div>`

  side.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => {
    side.querySelectorAll('[data-q]').forEach((x) => x.classList.toggle('active', x === b))
    const item = body.quarters.find((x) => x.id === b.dataset.q)
    const kv = side.querySelector('.kv')
    if (item && kv) {
      kv.innerHTML = `<dt>成像日期</dt><dd>${esc(item.date)}</dd><dt>入库日期</dt><dd>${esc(item.input)}</dd><dt>分辨率</dt><dd>${esc(item.resolution)}</dd><dt>覆盖范围</dt><dd>${esc(item.coverage)}</dd><dt>数据源</dt><dd>${esc(body.source)}</dd>`
    }
    toast(`已切换至 ${b.textContent}（同视口，可卷帘对比）`)
  }))
  side.querySelector('#compareBtn')?.addEventListener('click', openImageryCompare)
  side.querySelector('#imageryArchive')?.addEventListener('click', () => toast('年度归档：2010 起每年一期，按年浏览；近四季度为常态发布'))
}

async function loadDataServices() {
  const side = document.getElementById('dcSide')
  if (!side) return
  const { ok, body } = await api('/api/dataservices')
  if (!ok) return
  const card = document.createElement('div')
  card.className = 'side-card ds-card'
  card.innerHTML = `<div class="side-card-head">数据服务<span class="spacer"></span><span class="mono" style="color:var(--muted)">${(body.items || []).length} 个接口</span></div>
    <div class="side-card-body">
      ${(body.items || []).map((d) => `<div class="ds-row"><span class="tag mono">${esc(d.method)}</span><div class="ds-main"><b>${esc(d.name)}</b><span class="mono">${esc(d.path)} · ${esc(d.scope)}</span></div><span class="mono ds-meta">${d.calls} 次 · ${esc(d.latency)}</span></div>`).join('')}
      <div style="margin-top:8px;font-size:var(--fs-micro);color:var(--muted);line-height:1.5">其他应用通过稳定 API 查询目录与授权内容，调用留痕并入本域审计。</div>
    </div>`
  side.appendChild(card)
}

function editWorkflowHtml(r, edit, canApprove) {
  if (!edit) return ''
  const st = edit.status === 'approved' ? statusMap.authorized : edit.status === 'rejected' ? statusMap.rejected : statusMap['pending-dept']
  const stateText = (s) => s === 'done' ? '已完成' : s === 'active' ? '进行中' : s === 'rejected' ? '已退回' : '待处理'
  const actions = edit.status === 'pending' && canApprove
    ? edit.stage === 'dept'
      ? `<button class="btn sm primary" data-edit-act="dept-approve">部门负责人同意编辑</button><button class="btn sm" data-edit-act="reject">退回编辑</button>`
      : `<button class="btn sm primary" data-edit-act="ops-approve">运维管理同意编辑</button><button class="btn sm" data-edit-act="reject">退回编辑</button>`
    : ''
  return `<div class="field-group">
    <div class="field-group-title">编辑审批<span class="spacer"></span><span class="tag ${st?.cls || ''}">${edit.status === 'approved' ? '已生效' : edit.status === 'rejected' ? '已退回' : '审批中'}</span></div>
    <div class="reg-steps">${(edit.steps || []).map((s, i) => `<div class="reg-step ${s.state}">
      <span class="reg-step-dot">${s.state === 'done' ? icon('check') : i + 1}</span>
      <span class="reg-step-label">${esc(s.label)}</span>
      <span class="reg-step-meta">${s.by ? `${esc(s.by)} · ${esc(s.at)}` : stateText(s.state)}</span>
    </div>`).join('')}</div>
    <dl class="kv">
      <dt>修改名称</dt><dd>${esc(edit.changes?.name || '—')}</dd>
      <dt>修改分类</dt><dd>${esc(categoryLabel(edit.changes?.businessCategory || '—'))}</dd>
      <dt>修改简介</dt><dd>${esc(edit.changes?.desc || '—')}</dd>
    </dl>
    <div class="form-note">编辑申请由上传人发起；部门负责人与运维管理均同意后，更新才会覆盖当前元数据。</div>
    ${actions ? `<div class="ver-acts">${actions}</div>` : ''}
  </div>`
}

function openEditResource(r) {
  const categories = businessCategoryOptions()
  const current = categoryLabel(r.dataStandard?.businessCategory || r.businessCategory || '其他')
  const body = `<div class="form-grid">
    <label>数据名称<input id="erName" value="${esc(r.name)}"></label>
    <label>业务分类<select id="erCategory">${categories.map((c) => `<option${c === current ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
    <label style="grid-column:1/-1">数据简介<textarea id="erDesc" rows="4">${esc(r.desc || '')}</textarea></label>
  </div>
  <div class="form-note">提交后由部门负责人与运维管理依次同意；审批完成前，当前资源内容不变。</div>
  <div class="ver-acts" style="margin-top:12px"><button class="btn primary" data-edit-save>提交编辑申请</button><button class="btn" data-edit-cancel>取消</button></div>`
  const mask = openModal('编辑资源元数据', body)
  mask.querySelector('[data-edit-cancel]').addEventListener('click', () => mask.remove())
  mask.querySelector('[data-edit-save]').addEventListener('click', async () => {
    const payload = {
      id: r.id,
      changes: {
        name: mask.querySelector('#erName').value.trim(),
        businessCategory: mask.querySelector('#erCategory').value,
        desc: mask.querySelector('#erDesc').value.trim(),
      },
    }
    if (!payload.changes.name) return toast('数据名称不能为空', true)
    const { ok, body: res } = await api('/api/resources/edit', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
    })
    if (!ok) return toast(res.error || '编辑申请提交失败', true)
    mask.remove()
    toast(res.message || '编辑申请已提交')
    await openResource(r.id)
  })
}

function regWorkflowHtml(r) {
  if (!r.workflow || !Array.isArray(r.workflow.steps)) return ''
  const stage = r.workflow.stage
  const st = statusMap[r.status] || statusMap.authorized
  const stateText = (s) => s === 'done' ? '已完成' : s === 'active' ? '进行中' : s === 'rejected' ? '已退回' : '待处理'
  const actions = r.status === 'authorized' || r.status === 'rejected' ? '' : stage === 'dept'
    ? `<button class="btn sm primary" data-reg-act="dept-approve">部门负责人同意登记</button><button class="btn sm" data-reg-act="reject">退回</button>`
    : stage === 'qc'
      ? `<button class="btn sm primary" data-reg-act="qc-pass">质检通过</button><button class="btn sm" data-reg-act="qc-fail">质检不通过</button>`
      : stage === 'data'
        ? `<button class="btn sm primary" data-reg-act="data-approve">数据管理员审批通过</button><button class="btn sm" data-reg-act="reject">退回</button>`
        : ''
  return `<div class="field-group">
    <div class="field-group-title">登记审批<span class="spacer"></span><span class="tag ${st.cls}">${st.label}</span></div>
    <div class="reg-steps">${r.workflow.steps.map((s, i) => `<div class="reg-step ${s.state}">
      <span class="reg-step-dot">${s.state === 'done' ? icon('check') : i + 1}</span>
      <span class="reg-step-label">${esc(s.label)}</span>
      <span class="reg-step-meta">${s.by ? `${esc(s.by)} · ${esc(s.at)}` : stateText(s.state)}</span>
    </div>`).join('')}</div>
    <div class="form-note">${esc(r.workflow.note || '')}</div>
    ${actions ? `<div class="ver-acts">${actions}</div><div class="form-note">演示环境可由当前登录角色代推进；生产环境按部门负责人、质检员、数据管理员分别授权。</div>` : ''}
  </div>`
}

async function openResource(id) {
  const { ok, status, body } = await api(`/api/resource?id=${encodeURIComponent(id)}`)
  const slide = ensureSlide()
  if (!ok) {
    slide.innerHTML = `<div class="slide-head"><div><div class="slide-title">${esc(body.error)}</div></div><span class="spacer"></span><button class="btn subtle" data-close>${icon('close')}</button></div>
      <div class="slide-body">
        <div class="notice danger">${esc(body.detail)}</div>
        <div class="field" style="margin-top:14px"><div class="field-label">请求资源</div><div class="field-value mono">${esc(body.resource?.id || id)}</div></div>
        <div class="field"><div class="field-label">判定位置</div><div class="field-value">数据中心 API（服务端校验）；前端隐藏不作为安全边界</div></div>
        <div class="field"><div class="field-label">审计</div><div class="field-value">已记录 deny(403) 至本网络独立审计日志</div></div>
      </div>
      <div class="slide-foot"><button class="btn primary" data-audit>查看审计记录</button></div>`
    wireSlide(slide)
    await refreshAuditIfOpen()
    return
  }

  const r = body.item
  const vres = await api(`/api/resource/versions?id=${encodeURIComponent(r.id)}`)
  const versions = vres.body.items || []
  const grants = vres.body.grants || []
  const t = typeMap[r.type] || typeMap.document
  const sec = securityMap[r.security] || securityMap.internal
  const st = statusMap[r.status] || statusMap.authorized

  slide.innerHTML = `
    <div class="slide-head">
      <span class="type-ico">${icon(t.icon)}</span>
      <div><div class="slide-title">${esc(r.name)}</div><div class="slide-sub">${esc(r.id)} · ${esc(t.label)} · ${esc(r.format)}</div></div>
      <span class="spacer"></span>
      <button class="btn subtle" data-close>${icon('close')}</button>
    </div>
    <div class="slide-body">
      <div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">
        <span class="tag ${st.cls}">${st.label}</span>
        <span class="tag ${sec.cls}">${sec.label}</span>
        <span class="tag">${esc(r.owner)}</span>
        <span class="tag">${esc((r.nets || []).map((n) => (n === 'inet' ? '互联网' : n === 'gov' ? '政务网' : '涉密内网')).join(' / '))}</span>
      </div>
      <div class="field"><div class="field-label">资源描述</div><div class="field-value" style="color:var(--text-2)">${esc(r.desc)}</div></div>
      ${regWorkflowHtml(r)}
      ${editWorkflowHtml(r, body.editRequest, body.permissions?.editApproval)}
      ${(body.fieldGroups || []).map((g) => `
        <div class="field-group">
          <div class="field-group-title">${esc(g.title)}</div>
          <dl class="kv">${g.rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
        </div>`).join('')}
      ${r.id.startsWith('R-CAD') ? `<div class="notice">该 CAD 仅存在局部工程坐标，未建立转换关系，不参与空间范围检索。</div>` : ''}
      <div class="field-group">
        <div class="field-group-title">下载与授权<span class="spacer"></span><span class="mono" style="color:var(--muted)">按权限审批</span></div>
        <dl class="kv">
          <dt>下载状态</dt><dd>${body.downloadRequest ? (body.downloadRequest.status === 'approved' ? '已签发（15 分钟有效）' : '审批中') : '未申请'}</dd>
          <dt>审批角色</dt><dd>${esc(body.downloadRequest?.approval || '数据管理员 / 授权管理员')}</dd>
          <dt>申请记录</dt><dd>${body.downloadRequest ? `${esc(body.downloadRequest.id)} · ${esc(body.downloadRequest.at)}` : '—'}</dd>
        </dl>
        <div class="form-note">下载按资源密级、网络环境与授权组织审批；审批通过后签发短期受控链接，不落地长期副本。</div>
      </div>
      <div class="field-group">
        <div class="field-group-title">版本与生命周期<span class="spacer"></span><span class="mono" style="color:var(--muted)">${versions[0]?.state === '已归档' ? '已归档' : '当前 ' + esc(versions[0]?.v || 'V1.0')}</span></div>
        <div class="ver-list">${versions.map((v) => `<div class="ver-row"><span class="mono ver-v">${esc(v.v)}</span><span class="ver-note">${esc(v.note)}<span class="mono">${esc(v.by)} · ${esc(v.date)}</span></span><span class="tag ${v.state === '当前' ? 'ok' : ''}">${esc(v.state)}</span></div>`).join('')}</div>
        <div class="ver-acts"><button class="btn sm primary" data-ver="publish">${icon('plus')}上传新版本</button><button class="btn sm" data-ver="archive">归档</button><button class="btn sm" data-ver="restore">恢复</button></div>
      </div>
      <div class="field-group">
        <div class="field-group-title">资源授权<span class="spacer"></span><span class="mono" style="color:var(--muted)">变更写审计</span></div>
        <div class="grant-list">${grants.map((g) => `<div class="grant-row"><span class="tag">${esc(g.type)}</span><span class="grant-target">${esc(g.target)}</span><span class="mono grant-rights">${esc(g.rights.join(' / '))}</span><span class="mono" style="color:var(--muted);font-size:var(--fs-micro)">${esc(g.by)} · ${esc(g.at)}</span></div>`).join('') || '<span class="mono" style="color:var(--muted)">暂无授权记录</span>'}</div>
        <div class="ver-acts"><button class="btn sm" data-grant="1">${icon('shield')}调整授权</button></div>
      </div>
      <div class="notice neutral">解析产物与派生结果均登记派生关系，不覆盖原始文件；授权判定在服务端完成。</div>
    </div>
    <div class="slide-foot">
      <button class="btn primary" data-cite>在对话中引用</button>
      <button class="btn fav-btn ${isFav(r.id) ? 'on' : ''}" data-fav-res="${esc(r.id)}">${icon('star')}<span>${isFav(r.id) ? '已收藏' : '收藏'}</span></button>
      <button class="btn" data-download>下载</button>
      ${body.permissions?.canEdit ? `<button class="btn" data-edit-resource>编辑元数据</button>` : ''}
      <button class="btn" data-preview>${r.type === 'cad' ? 'WebCAD 预览' : '专业预览'}</button>
      <button class="btn" data-process="parse">解析重建索引</button>
      <button class="btn" data-process="preview">生成预览</button>
    </div>`

  wireSlide(slide)
  slide.querySelector('[data-fav-res]')?.addEventListener('click', async () => {
    const saved = toggleFav({ ref: r.id, kind: 'data', title: r.name, meta: `数据中心 · ${categoryLabel(r.businessCategory || '其他')} · ${r.dataOwner || r.owner}`, icon: t.icon })
    toast(saved ? '已收藏，可在个人中心查看' : '已取消收藏')
    await openResource(r.id)
  })
  slide.querySelectorAll('[data-reg-act]').forEach((b) => b.addEventListener('click', async () => {
    const { ok, body: res } = await api('/api/resources/approval', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: r.id, action: b.dataset.regAct }),
    })
    if (!ok) return toast(res.error || '操作失败', true)
    toast(res.message || '审批状态已更新')
    await openResource(r.id)
  }))
  slide.querySelectorAll('[data-ver]').forEach((b) => b.addEventListener('click', async () => {
    const { ok, body: res } = await api('/api/resource/version', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: r.id, action: b.dataset.ver, note: b.dataset.ver === 'publish' ? `${r.name} 新版本（演示上传）` : '' }),
    })
    if (!ok) return toast(res.error || '操作失败', true)
    toast(res.message)
    await openResource(r.id)
  }))
  slide.querySelector('[data-grant]')?.addEventListener('click', () => openGrantDialog(r, grants))
  slide.querySelector('[data-download]')?.addEventListener('click', async () => {
    const { ok, body: res } = await api('/api/resources/download', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: r.id }),
    })
    if (!ok) return toast(res.error || '下载申请提交失败', true)
    toast(res.message || '下载申请已提交')
    if (res.downloadUrl) {
      const a = document.createElement('a')
      a.href = res.downloadUrl
      a.download = ''
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      a.remove()
    }
    await openResource(r.id)
  })
  slide.querySelector('[data-edit-resource]')?.addEventListener('click', () => openEditResource(r))
  slide.querySelectorAll('[data-edit-act]').forEach((b) => b.addEventListener('click', async () => {
    const { ok, body: res } = await api('/api/resources/edit-approval', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: r.id, action: b.dataset.editAct }),
    })
    if (!ok) return toast(res.error || '编辑审批失败', true)
    toast(res.message || '编辑审批已更新')
    await openResource(r.id)
  }))
  slide.querySelectorAll('[data-process]').forEach((b) => b.addEventListener('click', async () => {
    const { ok, body: res } = await api('/api/resources/process', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: r.id, kind: b.dataset.process }),
    })
    if (!ok) return toast(res.error || '处理任务创建失败', true)
    toast(`已创建处理任务 ${res.task.id}，进度见「我的任务」`)
    await loadTasks()
  }))
}

function ensureSlide() {
  let slide = document.getElementById('slide')
  if (!slide) {
    slide = document.createElement('div')
    slide.id = 'slide'
    slide.className = 'slide'
    document.body.appendChild(slide)
  }
  slide.classList.add('open')
  return slide
}

function wireSlide(slide) {
  slide.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => slide.classList.remove('open')))
  if (!window.__slideEscBound) {
    window.__slideEscBound = true
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return
      const open = document.querySelector('.slide.open')
      if (open) open.classList.remove('open')
    })
  }
  slide.querySelector('[data-cite]')?.addEventListener('click', () => {
    state.view = 'home'
    state.draft = '基于引用资源，生成一份分析摘要'
    slide.classList.remove('open')
    render()
    toast('已加入对话上下文：资源只在授权范围内被引用')
  })
  slide.querySelector('[data-preview]')?.addEventListener('click', () => toast('已签发短期受控预览授权（有效期 15 分钟）'))
  slide.querySelector('[data-versions]')?.addEventListener('click', () => toast('版本 V1 → V3.2，保留原始资源与派生结果的来源关系'))
  slide.querySelector('[data-audit]')?.addEventListener('click', async () => {
    slide.classList.remove('open')
    state.auditOpen = true
    await renderAuditDrawer()
  })
}

async function attemptUnauthorized() {
  const { ok, status, body } = await api('/api/attempt', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  })
  if (ok) return toast(body.message)
  const slide = ensureSlide()
  slide.innerHTML = `
    <div class="slide-head"><div><div class="slide-title">越权访问已被拦截（${status}）</div><div class="slide-sub">服务端判定 · 已进审计</div></div><span class="spacer"></span><button class="btn subtle" data-close>${icon('close')}</button></div>
    <div class="slide-body">
      <div class="notice danger">${esc(body.detail)}</div>
      <div class="field" style="margin-top:14px"><div class="field-label">证据链</div>
        <div class="field-value mono" style="line-height:1.9">
          资源：${esc(body.evidence.resource)}<br/>
          密级：${esc(securityMap[body.evidence.security]?.label || body.evidence.security)}<br/>
          缺失授权：${esc(body.evidence.requiredScope || '—')}<br/>
          请求者：${esc(body.evidence.actor)}
        </div>
      </div>
      <div class="notice neutral">该拦截发生在数据中心 API 侧：即使绕过前端直接请求接口，也无法越权取数（PRD 2.3 / 9.3 要求）。</div>
    </div>
    <div class="slide-foot"><button class="btn primary" data-audit>查看审计</button></div>`
  wireSlide(slide)
  await loadResources()
  await refreshAuditIfOpen()
}

/* ------------------------------ skills ------------------------------ */

async function renderSkills(el) {
  const [{ body: marketBody }, { body: plugBody }, { body: subBody }] = await Promise.all([api('/api/plugin-market'), api('/api/plugins'), api('/api/plugin-subs?mine=1')])
  state.market = marketBody.items || []
  state.plugins = plugBody.items || []
  const subs = subBody.items || []
  const tab = state.skillTab || 'plugin'
  const scop = state.skillScope || 'public'

  const isOfficialBaseline = (p) => String(p.scope || '') === '平台官方基线'
  const installed = tab === 'plugin'
    ? state.market.filter((m) => (m.type === 'plugin' || m.kind === 'bundle') && m.installed)
    : state.plugins.filter((p) => p.kind === 'personal' && !isOfficialBaseline(p))

  const tone = (i) => 't' + (i % 8)
  const marketType = (m) => m.type || (m.kind === 'bundle' ? 'plugin' : 'skill')
  const typeLabel = (t) => (t === 'plugin' ? '插件' : '技能')
  const typeIcon = (t) => (t === 'plugin' ? 'plugin' : 'spark')

  const marketCard = (m, i) => {
    const t = marketType(m)
    return `
    <div class="pl-item pl-card" data-mopen="${esc(m.id)}" data-search="${esc(`${m.name} ${m.desc} ${m.publisher || ''}`.toLowerCase())}" style="cursor:pointer">
      <span class="pl-ico ${tone(i)}">${icon(typeIcon(t))}</span>
      <div class="pl-item-main"><div class="pl-item-name">${esc(m.name)}</div><div class="pl-item-desc">${esc(m.desc)}</div></div>
      ${m.installed
        ? `<button class="pl-act" data-mmenu="${esc(m.id)}" data-mname="${esc(m.name)}" title="已安装，更多操作">${icon('dots')}</button>`
        : m.available === false
          ? `<span class="tag" style="font-size:10px">待上架</span>`
          : `<button class="pl-act add" data-minstall="${m.id}" title="安装到当前账号">${icon('plus')}</button>`}
    </div>`
  }

  const skillDesc = (p) => (state.market || []).find((m) => m.kind === 'skill' && m.name === p.name)?.desc || p.desc
  const skillCard = (p, i) => `
    <div class="pl-item">
      <span class="pl-ico ${tone(i)}">${icon('spark')}</span>
      <div class="pl-item-main"><div class="pl-item-name">${esc(p.name)} <span class="tag" style="font-size:10px">技能</span></div><div class="pl-item-desc">${esc(skillDesc(p))}</div></div>
      <button class="pl-act" data-plug="${p.id}" title="技能详情">${icon('dots')}</button>
    </div>`

  const sec = (title, cards, cols) => cards ? `
    <section class="pl-sec">
      <h2 class="pl-sec-title">${title}<span class="pl-arrow">›</span></h2>
      <div class="pl-grid"${cols ? ` style="grid-template-columns:${cols}"` : ''}>${cards}</div>
    </section>` : ''

  const filterMarket = (type) => state.market.filter((m) => marketType(m) === type).filter((m) => {
    const q = String(state.skillQuery || '').trim().toLowerCase()
    if (!q) return true
    return `${m.name} ${m.desc} ${m.publisher || ''}`.toLowerCase().includes(q)
  })
  const marketSections = (type) => {
    const list = filterMarket(type)
    if (!list.length) return ''
    const groups = new Map()
    for (const item of list) {
      const key = item.section || (type === 'plugin' ? '插件市场' : '技能市场')
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(item)
    }
    return [...groups.entries()].map(([name, cards]) => sec(name, cards.map(marketCard).join(''))).join('')
  }

  const personalSections = `
    ${sec('我创建的插件', subs.length ? subs.map((x, i) => {
      const st = { pending: ['warn', '待审核'], approved: ['ok', '已上架'], rejected: ['bad', '已退回'] }[x.status] || ['', x.status]
      const t = x.kind === 'skill' ? 'skill' : 'plugin'
      return `<div class="pl-item">
        <span class="pl-ico ${tone(i)}">${icon(typeIcon(t))}</span>
        <div class="pl-item-main"><div class="pl-item-name">${esc(x.name)} <span class="tag" style="font-size:10px">${typeLabel(t)}</span></div><div class="pl-item-desc">${esc(x.file)} · v${esc(x.version)} · ${esc(x.scope)} · ${esc(x.submitted)}</div></div>
        <span class="tag ${st[0]}">${st[1]}</span>
        <button class="pl-act" data-subreport="${x.id}" title="查看检测报告">${icon('doc')}</button>
      </div>`
    }).join('') : '<div class="sk-empty">当前账号还没有创建插件，点右上「添加」开始创建</div>')}`

  const pluginMarketSection = filterMarket('plugin').length
    ? marketSections('plugin')
    : `<section class="pl-sec"><h2 class="pl-sec-title">插件市场<span class="pl-arrow">›</span></h2><div class="pl2-empty">${state.skillQuery ? `没有找到与“${esc(state.skillQuery)}”匹配的插件` : '暂无公开插件。员工提交并通过安全审核的插件会出现在这里。'}</div></section>`

  const skillMarketSections = filterMarket('skill').length ? marketSections('skill') : '<section class="pl-sec"><h2 class="pl-sec-title">技能市场<span class="pl-arrow">›</span></h2><div class="sk-empty">当前没有可安装的技能；官方与员工创建的上架技能都会出现在这里</div></section>'
  const skillSubs = subs.filter((x) => x.kind === 'skill')
  const skillPersonalSections = `
    ${sec('我创建的技能', skillSubs.length ? skillSubs.map((x, i) => {
      const st = { pending: ['warn', '待审核'], approved: ['ok', '已上架'], rejected: ['bad', '已退回'] }[x.status] || ['', x.status]
      return `<div class="pl-item">
        <span class="pl-ico ${tone(i)}">${icon('spark')}</span>
        <div class="pl-item-main"><div class="pl-item-name">${esc(x.name)} <span class="tag" style="font-size:10px">技能</span></div><div class="pl-item-desc">${esc(x.file)} · v${esc(x.version)} · ${esc(x.scope)} · ${esc(x.submitted)}</div></div>
        <span class="tag ${st[0]}">${st[1]}</span>
        <button class="pl-act" data-subreport="${x.id}" title="查看检测报告">${icon('doc')}</button>
      </div>`
    }).join('') : '<div class="sk-empty">当前账号还没有创建技能，点右上「添加」开始创建</div>')}`

  const instAttr = (x) => (tab === 'plugin' ? `data-mopen="${x.id}"` : `data-plug="${x.id}"`)
  const title = tab === 'plugin' ? '插件' : '技能'
  const sub = tab === 'plugin'
    ? (scop === 'personal' ? '只显示你自己创建的插件与提交审核记录' : '员工开发的插件通过市场提交、审核和安装')
    : (scop === 'personal' ? '只显示你自己创建的技能与提交审核记录' : '技能定义模型可以完成的任务流程，同样通过市场提交、审核和安装')

  el.innerHTML = `
    <div class="sk-wrap pl-wrap${state.sbPinned ? '' : ' sb-off'}">
      <aside class="sk-left pl-left">
        <div class="pl2-side-head">
          <div class="pl-brand">自定义</div>
          <button class="pl2-side-search" id="skSideSearchBtn" title="搜索插件或技能">${icon('search')}</button>
        </div>
        <nav class="pl-nav">
          <button class="pl-nav-item${tab === 'plugin' ? ' on' : ''}" data-sktab="plugin"><span class="pl-nav-ico">${icon('plugin')}</span>插件</button>
          <button class="pl-nav-item${tab === 'skill' ? ' on' : ''}" data-sktab="skill"><span class="pl-nav-ico">${icon('spark')}</span>技能</button>
        </nav>
        <div class="pl-label pl2-label">已安装</div>
        <div class="pl-installed">
          ${installed.map((x, i) => {
            const mid = x.marketId || (state.market.find((m) => m.name === x.name)?.id) || (tab === 'plugin' ? x.id : '')
            return `<div class="pl-inst" ${instAttr(x)} role="button" tabindex="0">
              <span class="pl-inst-ico ${tone(i)}">${icon(tab === 'plugin' ? 'plugin' : 'spark')}</span><span class="pl-inst-name">${esc(x.name)}</span>
              ${mid ? `<button class="pl-inst-more" data-mi-menu="${esc(mid)}" data-mi-name="${esc(x.name)}" title="更多操作" type="button">${icon('dots')}</button>` : ''}
            </div>`
          }).join('') || `<div class="pl2-inst-empty">${tab === 'plugin' ? '暂无已安装插件' : '暂无已安装技能'}</div>`}
        </div>
        <div class="pl-foot">插件与技能经安全审核后上架；个人安装只在本账号生效。</div>
      </aside>
      <div class="sk-main pl-main">
        <div class="pl-head pl2-head">
          <h1 class="pl-title">${title}</h1>
          <div class="pl2-toolbar">
            <label class="pl2-search">
              <span class="pl2-search-ico">${icon('search')}</span>
              <input id="skSearch" placeholder="搜索${tab === 'plugin' ? '插件' : '技能'}" value="${esc(state.skillQuery || '')}" />
            </label>
            <button class="pl-ico-btn pl2-tool" id="skRefresh" title="刷新">${icon('refresh')}</button>
            <button class="pl-add pl2-add" id="skAddLeft">添加</button>
          </div>
          <div class="pl-sub">${sub}</div>
        </div>
        <div class="pl-tabs pl2-tabs">
          <button class="pl-tab${scop === 'public' ? ' on' : ''}" data-skscope="public">公开</button>
          <button class="pl-tab${scop === 'personal' ? ' on' : ''}" data-skscope="personal">个人</button>
        </div>
        <div class="pl2-market">
          ${tab === 'plugin' && scop === 'public' ? pluginMarketSection : ''}
          ${tab === 'plugin' && scop === 'personal' ? personalSections : ''}
          ${tab === 'skill' && scop === 'public' ? skillMarketSections : ''}
          ${tab === 'skill' && scop === 'personal' ? skillPersonalSections : ''}
          <div class="pl2-noresult" id="plNoResult" hidden>没有找到匹配的内容，换个关键词试试。</div>
        </div>
      </div>
      </div>
    </div>`

  el.querySelectorAll('[data-sktab]').forEach((b) => { b.onclick = () => { state.skillTab = b.dataset.sktab; renderView() } })
  el.querySelectorAll('[data-skscope]').forEach((b) => { b.onclick = () => { state.skillScope = b.dataset.skscope; renderView() } })
  el.querySelector('#skRefresh').addEventListener('click', () => { toast('已刷新插件目录'); renderView() })
  const search = el.querySelector('#skSearch')
  const applyQuery = () => {
    const q = search.value.trim().toLowerCase()
    const cards = Array.from(el.querySelectorAll('.pl-card'))
    cards.forEach((card) => { card.hidden = !String(card.dataset.search || '').includes(q) })
    el.querySelectorAll('.pl2-market .pl-sec').forEach((secEl) => {
      const secCards = Array.from(secEl.querySelectorAll('.pl-card'))
      secEl.hidden = secCards.length ? !secCards.some((c) => !c.hidden) : false
    })
    const noResult = el.querySelector('#plNoResult')
    if (noResult) noResult.hidden = !(cards.length && cards.every((c) => c.hidden))
  }
  search.addEventListener('input', () => { state.skillQuery = search.value; applyQuery() })
  search.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault() })
  el.querySelector('#skSideSearchBtn').addEventListener('click', () => search.focus())
  el.querySelector('#skAddLeft').addEventListener('click', () => {
    openPluginPublish()
  })
  el.querySelectorAll('[data-minstall]').forEach((b) => b.addEventListener('click', async (e) => {
    e.stopPropagation()
    const { ok, body } = await api('/api/plugin-market/install', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: b.dataset.minstall }) })
    if (!ok) return toast(body.error || '安装失败', true)
    toast(body.message || (body.item.installed ? `已安装「${body.item.name}」，下一轮对话生效` : `已卸载「${body.item.name}」`))
    renderView()
  }))
  el.querySelectorAll('[data-mmenu]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation()
    openRowMenu(b, b.dataset.mmenu, b.dataset.mname || '')
  }))
  el.querySelectorAll('[data-mi-menu]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation()
    openRowMenu(b, b.dataset.miMenu, b.dataset.miName || '')
  }))
  el.querySelectorAll('[data-muninstall]').forEach((b) => b.addEventListener('click', async (e) => {
    e.stopPropagation()
    const { ok, body } = await api('/api/plugin-market/install', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: b.dataset.muninstall }) })
    if (!ok) return toast(body.error || '卸载失败', true)
    toast(body.message || `已卸载「${body.item?.name || ''}」，下一轮对话生效`)
    renderView()
  }))
  el.querySelectorAll('[data-mdetail]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation()
    openPluginSlide(b.dataset.mdetail)
  }))
  el.querySelectorAll('[data-mopen]').forEach((b) => b.addEventListener('click', () => openPluginSlide(b.dataset.mopen)))
  el.querySelectorAll('[data-market-download]').forEach((b) => b.addEventListener('click', () => {
    const a = document.createElement('a')
    a.href = b.dataset.marketDownload
    a.download = ''
    document.body.appendChild(a)
    a.click()
    a.remove()
  }))
  el.querySelectorAll('[data-subreport]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation()
    const x = subs.find((y) => y.id === b.dataset.subreport)
    if (x) openPluginReport(x)
  }))
  el.querySelectorAll('[data-plug]').forEach((b) => b.addEventListener('click', () => openSkillSlide(b.dataset.plug)))
}

function capabilityLimitsText(c) {
  const l = c.limits || {}
  return `${l.cpu || '-'}核 / ${l.memory || '-'}MB / ${l.timeout || '-'}s / 并发${l.concurrency || '-'}`
}

function openCapabilitySlide(id) {
  const c = (state.capabilities || []).find((x) => x.id === id)
  if (!c) return
  const slide = ensureSlide()
  slide.innerHTML = `
    <div class="slide-head"><div><div class="slide-title">${esc(c.name)}</div><div class="slide-sub">平台公共能力 · ${esc(c.id)}</div></div><span class="spacer"></span><button class="btn subtle" data-close>${icon('close')}</button></div>
    <div class="slide-body">
      <div style="display:flex;gap:6px;margin-bottom:12px"><span class="tag ${c.enabled ? 'ok' : 'warn'}">${c.enabled ? '系统已启用' : '运行时未加载'}</span><span class="tag">默认安装</span><span class="tag">${esc(c.accessibleTo || '全部授权用户')}</span><span class="tag">不可卸载</span></div>
      <div class="field"><div class="field-label">能力说明</div><div class="field-value">${esc(c.desc)}</div></div>
      <div class="field"><div class="field-label">维护方式</div><div class="field-value">${esc(c.managedBy)}；${esc(c.upgradedBy)}；${esc(c.installScope)}</div></div>
      <div class="field"><div class="field-label">标准协议</div><div class="field-value">${esc(c.protocol)}</div></div>
      <div class="field"><div class="field-label">模块与版本</div><div class="field-value mono">${esc(c.module)} · v${esc(c.version)}</div></div>
      <div class="field"><div class="field-label">依赖</div><div class="field-value">${(c.deps || []).map(esc).join('<br>') || '无'}</div></div>
      <div class="field"><div class="field-label">授权范围</div><div class="field-value">${esc(c.accessibleTo)}；按当前账号与网络授权生效。</div></div>
      <div class="field"><div class="field-label">权限</div><div class="field-value">${(c.permissions || []).map(esc).join(' · ')}</div></div>
      <div class="field"><div class="field-label">资源限制</div><div class="field-value">${capabilityLimitsText(c)}</div></div>
      ${c.policyUpdatedAt ? `<div class="field"><div class="field-label">最近配置</div><div class="field-value">${esc(c.policyUpdatedBy || '系统管理员')} · ${new Date(c.policyUpdatedAt).toLocaleString('zh-CN')}</div></div>` : ''}
    </div>
    ${state.capabilityCanManage ? `<div class="slide-foot"><button class="btn primary" data-cappolicy>配置权限与资源</button></div>` : ''}`
  wireSlide(slide)
  slide.querySelector('[data-cappolicy]')?.addEventListener('click', () => openCapabilityPolicy(c))
}

function openCapabilityPolicy(c) {
  const l = c.limits || {}
  const m = openModal('配置平台能力', `
    <div class="form-note">该配置对所有授权用户生效，只限制平台模块的权限与资源上限；权限变更写入审计。</div>
    <div class="form-label">权限（逗号分隔）</div>
    <input class="text-input" id="capPerms" value="${esc((c.permissions || []).join('，'))}" />
    <div class="form-grid">
      <label>CPU 上限（核）<input class="text-input" id="capCpu" value="${esc(l.cpu || '')}" /></label>
      <label>内存上限（MB）<input class="text-input" id="capMem" value="${esc(l.memory || '')}" /></label>
    </div>
    <div class="form-grid">
      <label>超时（秒）<input class="text-input" id="capTimeout" value="${esc(l.timeout || '')}" /></label>
      <label>并发上限<input class="text-input" id="capConc" value="${esc(l.concurrency || '')}" /></label>
    </div>
    <div class="form-foot"><span class="spacer"></span><button class="btn" data-mclose>取消</button><button class="btn primary" id="capSave">保存配置</button></div>`)
  m.querySelector('[data-mclose]').addEventListener('click', () => m.remove())
  m.querySelector('#capSave').addEventListener('click', async () => {
    const { ok, body } = await api('/api/admin/platform-capabilities', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: c.id,
        permissions: m.querySelector('#capPerms').value,
        limits: {
          cpu: m.querySelector('#capCpu').value,
          memory: m.querySelector('#capMem').value,
          timeout: m.querySelector('#capTimeout').value,
          concurrency: m.querySelector('#capConc').value,
        },
      }),
    })
    if (!ok) return toast(body.error || '保存失败', true)
    m.remove()
    toast('平台能力配置已保存，新会话生效')
    state.capabilities = state.capabilities.map((x) => (x.id === c.id ? body.item : x))
    renderView()
  })
}

const PLUGIN_SURFACES = {
  // Bundle 自带的客户端面板不是独立网页；当前车流量插件的操作入口由本地工具提供。
  'M-1794656954497': { url: 'http://127.0.0.1:5000', label: '进入操作界面', note: '车流量本地服务，服务不在线时请先启动原工具。' },
  // 产品内置插件直接打开已有的代码审查控制台，不做第二套假页面。
  'M-CODEREVIEW': { view: 'codereview', label: '进入审查控制台', note: '打开 Harness 代码审查服务，对项目目录执行只读扫描。' },
}

function pluginSurfaceFor(m) {
  if (!m || !m.installed) return null
  if (PLUGIN_SURFACES[m.id]) return PLUGIN_SURFACES[m.id]
  if (String(m.name || '').includes('车流量')) return PLUGIN_SURFACES['M-1794656954497']
  return null
}

function openPluginSurface(m) {
  const surface = pluginSurfaceFor(m)
  if (!surface) return toast('该插件没有声明可打开的操作界面', true)
  if (surface.view) {
    document.querySelector('.slide')?.classList.remove('open')
    closeModals()
    state.view = surface.view
    render()
    return toast(surface.note || '已打开插件操作界面')
  }
  const mask = openModal(`${m.name} · 操作界面`, `
    <div class="form-note" style="margin:0 0 10px">${esc(surface.note || '插件操作界面')}</div>
    <iframe src="${esc(surface.url)}" title="${esc(m.name)}" style="width:100%;height:68vh;border:1px solid var(--line);border-radius:10px;background:#fff"></iframe>
    <div class="form-foot"><span class="mono">${esc(surface.url)}</span><span class="spacer"></span><button class="btn" data-surface-open>在浏览器打开</button></div>
  `, { wide: true })
  mask.querySelector('[data-surface-open]')?.addEventListener('click', () => window.open(surface.url, '_blank', 'noopener,noreferrer'))
}

function openPluginSlide(id) {
  const m = (state.market || []).find((x) => x.id === id)
  if (!m) return
  const surface = pluginSurfaceFor(m)
  const slide = ensureSlide()
  slide.innerHTML = `
    <div class="slide-head"><div><div class="slide-title">${esc(m.name)}</div><div class="slide-sub">${esc(m.publisher)} · ${esc(m.section)} · ID ${esc(m.id)}</div></div><span class="spacer"></span><button class="btn subtle" data-close>${icon('close')}</button></div>
    <div class="slide-body">
      <div style="display:flex;gap:6px;margin-bottom:12px"><span class="tag ${m.installed ? 'ok' : ''}">${m.installed ? '已安装' : '未安装'}</span><span class="tag ${m.available === false ? 'warn' : ''}">${m.available === false ? '待上架' : m.locked ? '系统内置' : '可安装'}</span><span class="tag">${m.origin === 'community' ? '社区提交' : '官方/内置'}</span><span class="tag">${esc(m.scope)}</span></div>
      <div class="field"><div class="field-label">功能说明</div><div class="field-value">${esc(m.desc)}</div></div>
      <div class="field"><div class="field-label">来源</div><div class="field-value">${m.origin === 'community' ? `${esc(m.submittedUnit || '')} · 提交人 ${esc(m.submittedBy || '')} · v${esc(m.version || '1.0.0')}` : `DSH 官方 / 产品内置 · v${esc(m.version || '1.0.0')}`}</div></div>
      <div class="field"><div class="field-label">权限与数据</div><div class="field-value">按当前授权与网络范围返回数据；敏感字段最小必要展示，读取与调用进审计。写操作需人工确认。</div></div>
      <div class="field"><div class="field-label">安装状态</div><div class="field-value">${m.locked ? (m.product ? '该插件由平台内置，随平台统一维护；无需按账号安装或卸载。' : '该技能已作为全客户端基线安装，由平台统一维护，不能按单个账号卸载。') : m.available === false ? '该插件尚未提供可安装的技能包，暂不能安装。上架后会显示安装入口。' : `安装到${esc(m.installScope || '当前账号或项目技能目录')}；安装或卸载后，下一轮对话生效。`}</div></div>
      ${(m.kind !== 'bundle' && !m.locked && m.available !== false && !m.installed) ? `<div class="field"><div class="field-label">安装范围</div><div class="field-value">
        <select class="text-input" id="mktInstallScope"><option value="user">仅当前账号</option><option value="project">当前项目（仅该项目会话可见）</option></select>
        <select class="text-input" id="mktInstallProject" style="display:none;margin-top:6px">${(state.projects || []).filter((p) => p.cwd).map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select>
      </div></div>` : ''}
      ${m.installed && m.installedScope ? `<div class="field"><div class="field-label">安装位置</div><div class="field-value">${m.installedScope === 'project' ? `项目 ${esc((state.projects || []).find((p) => p.id === m.installedProjectId)?.name || m.installedProjectId)}` : '当前账号'}</div></div>` : ''}
      <div class="field"><div class="field-label">安装要求</div><div class="field-value">${m.locked ? (m.product ? '产品内置插件，随平台统一维护；无需安装，也不占用账号技能目录。' : '平台官方基线技能，无需安装；按当前网络与授权范围生效。') : m.scope === '需授权' ? '需部门负责人授权后安装，授权范围按岗位与项目参与关系核定。' : m.kind === 'bundle' ? 'Bundle 会安装到当前账号的 DSH 运行时，只对该账号生效。' : '官方技能，可直接安装；账号范围与其他账号互不可见，项目范围仅该项目会话可见。'}</div></div>
    </div>
    <div class="slide-foot">
      ${surface ? `<button class="btn" data-open-surface>${esc(surface.label)}</button>` : ''}
      ${m.locked ? `<button class="btn primary" disabled>${m.product ? '产品内置' : '全客户端基线'}</button>` : m.available === false ? '<button class="btn primary" disabled>尚未提供安装包</button>' : `<button class="btn primary" data-toggle>${m.installed ? '卸载' : '安装'}</button>`}
      ${m.downloadUrl ? '<button class="btn" data-download>下载原始包</button>' : ''}
      <button class="btn" data-log>调用记录</button>
    </div>`
  wireSlide(slide)
  const scopeSelect = slide.querySelector('#mktInstallScope')
  const projectSelect = slide.querySelector('#mktInstallProject')
  if (scopeSelect && projectSelect) {
    scopeSelect.addEventListener('change', () => {
      projectSelect.style.display = scopeSelect.value === 'project' ? '' : 'none'
    })
  }
  slide.querySelector('[data-open-surface]')?.addEventListener('click', () => openPluginSurface(m))
  slide.querySelector('[data-toggle]')?.addEventListener('click', async () => {
    const scopeEl = slide.querySelector('#mktInstallScope')
    const projectEl = slide.querySelector('#mktInstallProject')
    const payload = { id: m.id }
    if (m.installed) {
      payload.scope = m.installedScope || 'user'
      if (m.installedScope === 'project') payload.projectId = m.installedProjectId || ''
    } else {
      if (scopeEl) payload.scope = scopeEl.value
      if (scopeEl?.value === 'project') payload.projectId = projectEl?.value || ''
    }
    const { ok, body } = await api('/api/plugin-market/install', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
    if (!ok) return toast(body.error, true)
    const plugins = await api('/api/plugins')
    if (plugins.ok) state.plugins = plugins.body.items || []
    slide.classList.remove('open')
    toast(body.message || (body.item.installed ? `已安装「${m.name}」，下一轮对话生效` : `已卸载「${m.name}」`))
    renderView()
  })
  slide.querySelector('[data-log]').addEventListener('click', () => toast('调用记录按任务、参数与结果留存，可在审计中回查'))
  const dl = slide.querySelector('[data-download]')
  if (dl) dl.addEventListener('click', () => {
    const a = document.createElement('a')
    a.href = m.downloadUrl
    a.download = ''
    document.body.appendChild(a)
    a.click()
    a.remove()
  })
}

function openSkillSlide(id) {
  const p = (state.plugins || []).find((x) => x.id === id)
  if (!p) return
  const desc = (state.market || []).find((m) => m.kind === 'skill' && m.name === p.name)?.desc || p.desc
  const slide = ensureSlide()
  slide.innerHTML = `
    <div class="slide-head"><div><div class="slide-title">${esc(p.name)}</div><div class="slide-sub">${esc(p.publisher)} · v${esc(p.version)} · ${p.kind === 'capability' ? '底层能力' : p.kind === 'enterprise' ? '企业插件' : '个人技能'}</div></div><span class="spacer"></span><button class="btn subtle" data-close>${icon('close')}</button></div>
    <div class="slide-body">
      <div style="display:flex;gap:6px;margin-bottom:12px"><span class="tag ${p.status === 'enabled' ? 'ok' : ''}">${p.status === 'enabled' ? '已启用' : '未启用'}</span><span class="tag">${esc(p.scope)}</span></div>
      <div class="field"><div class="field-label">能力说明</div><div class="field-value">${esc(desc)}</div></div>
      <div class="field"><div class="field-label">依赖</div><div class="field-value">${esc(p.deps)}</div></div>
      <div class="field"><div class="field-label">风险等级</div><div class="field-value">${esc(p.risk)}；写操作与高危调用执行前二次确认。</div></div>
    </div>
    <div class="slide-foot">${p.source ? '<span class="tag">由 DSH 运行时加载，产品内只读</span>' : `<button class="btn primary" data-toggle>停用</button>`}<button class="btn" data-log>运行记录</button></div>`
  wireSlide(slide)
  if (!p.source) slide.querySelector('[data-toggle]').addEventListener('click', async () => {
    const { ok, body } = await api('/api/plugins/toggle', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: p.id }) })
    if (!ok) return toast(body.error, true)
    slide.classList.remove('open')
    toast(`已${body.item.status === 'enabled' ? '启用' : '停用'}「${p.name}」`)
    renderView()
  })
  slide.querySelector('[data-log]').addEventListener('click', () => toast('运行记录：按任务、工具、结果保留，失败原因可追溯'))
}

function openPluginPublish() {
  const mask = openModal('上传插件或技能', `
    <div class="form-note">支持两种 ZIP：技能包（根目录含 SKILL.md）与 DSH Bundle（含 package.json 与 dsh.bundle 指定的 cordis.patch.yml）。插件与技能都通过同一市场提交、审核、上架，审核通过后用户可一键安装。</div>
    <div class="up-spec"><span>不确定包结构？</span><button class="linkbtn" id="pubSpec">查看《插件开发规范》</button></div>
    <div class="up-zone" id="pubZone">
      <span class="up-ico">${icon('upload')}</span>
      <b>点击选择或拖入 ZIP 插件 / 技能包</b>
      <span>单个 ZIP 文件（.zip），包含完整插件或技能目录</span>
      <input type="file" id="pubFile" accept=".zip" hidden />
    </div>
    <div class="up-file" id="pubFileLine" hidden><span class="ico">${icon('doc')}</span><b id="pubFileName"></b><span class="mono" id="pubFileSize"></span></div>
    <div class="form-grid">
      <label>名称<input class="text-input" id="pubName" placeholder="例如：规划指标计算" /></label>
      <label>版本<input class="text-input" id="pubVer" placeholder="例如：1.2.0" /></label>
    </div>
    <div class="form-grid">
      <label>适用范围<select id="pubScope"><option>全集团</option><option>本部门</option><option>仅本人</option></select></label>
      <label>所需权限<select id="pubPerm"><option>仅读取已授权资源</option><option>读取 + 写入（需二次确认）</option><option>无资源访问</option></select></label>
    </div>
    <div class="form-label">功能说明</div>
    <textarea class="form-area" id="pubDesc" rows="3" placeholder="说明插件或技能做什么、依赖哪些系统、输出什么结果，便于审核"></textarea>
    <div class="form-checks">
      <label class="check"><input type="checkbox" id="pubRule" /> 已按《插件开发规范》生成包结构，并同意平台进行静态扫描与沙箱测试</label>
    </div>
    <div class="form-foot"><span class="mono">上传后自动检测，通常 1 分钟内出报告</span><span class="spacer"></span><button class="btn" data-mclose>取消</button><button class="btn primary" id="pubSubmit">上传并检测</button></div>`)
  mask.querySelector('[data-mclose]').addEventListener('click', () => mask.remove())
  mask.querySelector('#pubSpec').addEventListener('click', (ev) => {
    ev.stopPropagation()
    openPluginSpec()
  })
  const zone = mask.querySelector('#pubZone')
  const fileInput = mask.querySelector('#pubFile')
  const pick = { name: '', size: '', file: null }
  zone.addEventListener('click', () => fileInput.click())
  fileInput.addEventListener('change', () => {
    const f = fileInput.files && fileInput.files[0]
    if (!f) return
    pick.name = f.name
    pick.file = f
    pick.size = f.size > 1048576 ? `${(f.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(f.size / 1024))} KB`
    const line = mask.querySelector('#pubFileLine')
    line.hidden = false
    mask.querySelector('#pubFileName').textContent = pick.name
    mask.querySelector('#pubFileSize').textContent = pick.size
    if (!mask.querySelector('#pubName').value) mask.querySelector('#pubName').value = f.name.replace(/\.zip$/i, '')
  })
  mask.querySelector('#pubSubmit').addEventListener('click', async () => {
    const name = mask.querySelector('#pubName').value.trim()
    const ver = mask.querySelector('#pubVer').value.trim() || '0.1.0'
    if (!pick.name) return toast('请先选择 ZIP 插件包', true)
    if (!name) return toast('请填写插件名称', true)
    if (!mask.querySelector('#pubRule').checked) return toast('请先确认已按《插件开发规范》打包', true)
    if (!pick.file) return toast('插件包已失效，请重新选择 ZIP 文件', true)
    const submitBtn = mask.querySelector('#pubSubmit')
    submitBtn.disabled = true
    toast('正在上传插件包并做静态检测…')
    const uploaded = await uploadBinaryFile(pick.file, 'plugin')
    submitBtn.disabled = false
    if (!uploaded.ok) return toast(uploaded.body.error || '插件包上传失败', true)
    const payload = {
      name, version: ver, file: uploaded.file.name, size: pick.size, fileId: uploaded.file.id,
      scope: mask.querySelector('#pubScope').value,
      desc: mask.querySelector('#pubDesc').value.trim() || '—',
    }
    const { ok, body } = await api('/api/plugin-subs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
    if (!ok) return toast(body.error || '上传失败', true)
    mask.remove()
    openPluginReport(body.item)
    renderView()
  })
}

function openPluginSpec() {
  const mask = openModal('插件开发规范', `
    <div class="form-note">推荐技能包：根目录放 SKILL.md，可附 references 与素材；也可提交 DSH Bundle，要求 package.json 里声明 dsh.bundle 与 cordis.patch.yml。审核通过后都会进入市场，用户可一键安装。</div>
    <pre class="spec-tree">技能包（推荐）
my-skill.zip
├─ SKILL.md             技能名称、适用场景、步骤与边界
├─ references/          参考文档（可选）
└─ assets/              图片等素材（可选）

DSH Bundle（需运行时依赖）
my-plugin.zip
├─ package.json         插件名称、版本、依赖声明
├─ index.js             插件功能代码
├─ cordis.patch.yml     DSH 插件注册与配置声明
└─ README.md            使用说明（建议）</pre>
    <div class="spec-list">
      <div class="spec-row"><b>技能包</b><span>SKILL.md 必须包含 name 与 description；只允许 Markdown、文本、JSON、CSV、YAML、图片与 PDF，不允许可执行脚本。</span></div>
      <div class="spec-row"><b>包结构</b><span>根目录即包根，不再套一层文件夹；不要包含 __MACOSX 或路径跳转。</span></div>
      <div class="spec-row"><b>权限</b><span>技能包只提供提示词与参考文件，不注册自定义工具；需要访问内部系统时，通过产品 MCP 工具在授权范围内执行。</span></div>
      <div class="spec-row"><b>安全</b><span>禁止动态执行远程代码、读取凭据、静默外联；平台先做静态扫描，审核通过后才进入市场。</span></div>
      <div class="spec-row"><b>版本与更新</b><span>每次更新上传新 ZIP，版本号递增，重新检测与审核；旧版本在审核期间保持可用。</span></div>
    </div>
    <div class="form-note">AI 可直接按本规范生成技能包：说明技能要做什么、需要哪些参考材料，产出 SKILL.md 与目录结构，再压缩为 ZIP。</div>`)
}

function openPluginReport(sub) {
  const st = { pending: ['warn', '自动检测通过 · 待管理员审核'], approved: ['ok', '已上架'], rejected: ['bad', '已退回'] }[sub.status] || ['', sub.status]
  const tag = (v) => (v === '通过' ? 'ok' : v === '不通过' ? 'bad' : 'warn')
  const mask = openModal('插件检测报告', `
    <div class="rp-head">
      <div class="rp-title"><b>${esc(sub.name)}</b><span class="mono">${esc(sub.file)} · ${esc(sub.size)} · v${esc(sub.version)} · ${esc(sub.scope)}</span></div>
      <span class="tag ${st[0]}">${esc(st[1])}</span>
    </div>
    <div class="rp-list">
      ${(sub.checks || []).map((c) => `<div class="rp-row"><span class="rp-k">${esc(c[0])}</span><span class="rp-v"><span class="tag ${tag(c[1])}">${esc(c[1])}</span>${esc(c[2] || '')}</span></div>`).join('')}
    </div>
    ${sub.reason ? `<div class="form-note bad-note">退回原因：${esc(sub.reason)}</div>` : ''}
    <div class="form-note">${sub.status === 'approved'
      ? (sub.kind === 'skill' ? '技能包已入库，可在技能市场一键安装。' : 'Bundle 已入库，可在插件市场安装到当前账号；只对该账号的 DSH 运行时生效。')
      : (sub.kind === 'skill' ? '审核通过后技能包会入库并开放安装；审核在「管理中心 · AI 能力管理 · 插件审核」处理。' : '审核通过后 Bundle 会入库并开放安装；审核在「管理中心 · AI 能力管理 · 插件审核」处理。')}</div>
    <div class="form-foot"><span class="mono">提交人 ${esc(sub.author)} · ${esc(sub.unit)} · ${esc(sub.submitted)}</span></div>`)
}

/* ------------------------------- apps ------------------------------- */

async function renderApps(el) {
  const { body } = await api('/api/apps')
  state.apps = body.items
  const badge = (s) => ({ published: ['ok', '已发布'], review: ['warn', '审核中'], draft: ['', '草稿'] }[s] || ['', s])
  const items = body.items || []
  el.innerHTML = `
  <div class="view-head">
    <div>
      <div class="view-title">应用</div>
      
    </div>
  </div>
  <div class="app-grid">
    ${items.map((a) => {
      const [tone, label] = badge(a.status)
      return `
      <div class="app-card">
        <div class="app-card-top"><span class="type-ico">${icon(a.icon || 'grid')}</span><span class="tag ${tone}">${label}</span></div>
        <div class="app-card-name">${esc(a.name)}</div>
        <div class="app-card-desc">${esc(a.desc || '')}</div>
        <div class="app-card-meta">${esc(a.dept || '')} · v${esc(a.version || '1.0')}<br>${esc(a.maintainer || '')}</div>
      </div>`
    }).join('')}
    ${items.length ? '' : '<div class="empty">还没有登记应用</div>'}
  </div>`
}

const NB_MAX_SOURCES = 20
const nbSize = (n) => {
  const v = Number(n) || 0
  if (v >= 1024 ** 3) return `${(v / 1024 ** 3).toFixed(2).replace(/\.00$/, '')} GB`
  if (v >= 1024 ** 2) return `${(v / 1024 ** 2).toFixed(1)} MB`
  if (v >= 1024) return `${(v / 1024).toFixed(0)} KB`
  return v ? `${v} B` : '0 KB'
}
const NB_STUDIO_PANEL_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="5" width="16" height="14" rx="3"/><path d="M15.5 5v14"/></svg>'
const nbStudioLabel = (n) => n.kind === 'docx' ? 'DOCX 文档' : n.kind === 'xlsx' ? 'XLSX 表格' : n.kind === 'pptx' ? 'PPTX 演示' : 'Studio 记忆'
const nbStudioIcon = (n) => n.kind === 'xlsx' ? 'table' : n.kind === 'pptx' ? 'layers' : 'doc'

function notebookStudioMarkup(notes, opts = {}) {
  return `<aside class="nbx-studio ${opts.start ? 'nbs-studio' : ''}">
    <div class="nbx-head"><span>Studio</span><span class="mono">${notes.length}</span><span class="spacer"></span><button class="nbx-studio-panel" id="nbStudioPanel" title="Studio 固定在右侧">${NB_STUDIO_PANEL_ICON}</button></div>
    <div class="nbx-scroll nbs-scroll">
      <div class="nbs-tools">
        <button class="nbs-tool" data-studio="docx"><span class="nbs-tool-ico">${icon('doc')}</span><span>文档</span><em>DOCX</em></button>
        <button class="nbs-tool" data-studio="xlsx"><span class="nbs-tool-ico">${icon('table')}</span><span>表格</span><em>XLSX</em></button>
        <button class="nbs-tool" data-studio="pptx"><span class="nbs-tool-ico">${icon('layers')}</span><span>演示</span><em>PPTX</em></button>
      </div>
      <div class="nbs-list">
        ${notes.length ? notes.map((n) => `
          <button class="nbs-item ${n.id === state.noteId && state.noteOpen ? 'on' : ''}" data-note="${n.id}">
            <span class="nbs-item-ico nbs-${esc(n.kind || 'chat')}">${icon(nbStudioIcon(n))}</span>
            <span class="nbs-item-main">
              <span class="nbs-item-title">${esc(n.title)}</span>
              <span class="nbs-item-meta">${nbStudioLabel(n)} · ${esc(n.updatedAt || '')}</span>
            </span>
          </button>`).join('') : `<div class="nbs-empty">${icon('pen')}<b>Studio 输出将保存在此处</b><span>添加来源后，可以生成 DOCX、XLSX、PPTX；对话中的任意一段也可以保存进来。</span></div>`}
      </div>
    </div>
    <div class="nbx-principle">Studio 仅输出 DOCX / XLSX / PPTX · 对话内容可逐段保存</div>
  </aside>`
}

function notebookNoteModal(note) {
  if (!note) return ''
  return `<div class="jg-modal-mask open" id="nbNoteMask">
    <div class="jg-modal nbx-modal">
      <div class="jg-modal-head"><span>Studio 内容</span><button class="icon-btn" id="nbNoteClose">${icon('close')}</button></div>
      <div class="jg-modal-body">
        <input class="nbx-note-title" id="nbNoteTitle" value="${esc(note.title)}">
        <div class="nbx-note-meta mono">${esc(note.author)} · 更新于 ${esc(note.updatedAt)} · ${nbStudioLabel(note)}</div>
        <textarea class="nbx-note-body" id="nbNoteBody" rows="12">${esc(note.content)}</textarea>
        ${(note.citations || []).length ? `<div class="nb-cites">${note.citations.map((c) => `<button class="nb-cite" data-cite="${c.resourceId}" data-ver="${esc(c.versionId || '')}"><span class="mono">${esc(c.versionId || 'V?')}</span>${esc(c.locator || '')}</button>`).join('')}</div>` : ''}
      </div>
      <div class="jg-modal-foot">
        <button class="btn sm" id="nbDelNote">删除</button>
        <span class="spacer"></span>
        <button class="btn primary" id="nbSaveNote">保存</button>
      </div>
    </div>
  </div>`
}

function bindNotebookStudio(el, ctx) {
  const { nb, notes, chat, sources } = ctx
  const note = notes.find((n) => n.id === state.noteId)
  el.querySelector('#nbStudioPanel')?.addEventListener('click', () => toast('Studio 固定在右侧，可拖动分栏调整宽度'))
  el.querySelectorAll('[data-note]').forEach((b) => b.addEventListener('click', () => { state.noteId = b.dataset.note; state.noteOpen = true; renderView() }))
  el.querySelector('#nbNoteClose')?.addEventListener('click', () => { state.noteOpen = false; renderView() })
  el.querySelectorAll('[data-studio]').forEach((b) => b.addEventListener('click', async () => {
    const type = b.dataset.studio
    const label = type === 'docx' ? 'DOCX 文档' : type === 'xlsx' ? 'XLSX 表格' : 'PPTX 演示'
    const last = [...chat].reverse().find((m) => m.role === 'ai')
    const basis = last?.text || (sources.length
      ? `本笔记本当前引用 ${sources.length} 项来源：${sources.slice(0, 3).map((s) => s.name).join('、')}。`
      : '本笔记本当前还没有引用来源，先生成结构框架，后续补充依据。')
    const content = `【Studio 自动生成 · ${label}】\n\n${basis}\n\n来源：${sources.length ? sources.map((s) => `《${s.name}》`).join('、') : '暂无'}`
    const { body: r } = await api('/api/notebook/note', { method: 'POST', body: JSON.stringify({ id: state.notebookId, note: { title: `${nb?.title || '笔记本'} · ${label}`, content, kind: type, citations: last?.citations || [] } }) })
    if (!r?.ok) return toast(r?.error || '生成失败')
    state.noteId = r.notes[0].id
    state.noteOpen = false
    toast(`已生成 ${label}，保存在 Studio`)
    renderView()
  }))
  el.querySelector('#nbSaveNote')?.addEventListener('click', async () => {
    if (!note) return
    const { body: r } = await api('/api/notebook/note', { method: 'POST', body: JSON.stringify({ id: state.notebookId, note: { id: note.id, title: el.querySelector('#nbNoteTitle').value, content: el.querySelector('#nbNoteBody').value } }) })
    if (r?.ok) { toast('已保存到 Studio'); renderView() } else toast(r?.error || '保存失败')
  })
  el.querySelector('#nbDelNote')?.addEventListener('click', async () => {
    if (!note) return
    const { body: r } = await api('/api/notebook/note', { method: 'POST', body: JSON.stringify({ id: state.notebookId, removeNote: note.id }) })
    if (r?.ok) { state.noteId = null; state.noteOpen = false; toast('已从 Studio 删除'); renderView() } else toast(r?.error || '删除失败')
  })
}

/* ------------------------------ 笔记本卡片菜单与集合 ------------------------------ */

function closeNotebookMenu() {
  document.querySelectorAll('.nb-more-pop').forEach((p) => p.remove())
  document.querySelectorAll('.kn-dots.open').forEach((d) => d.classList.remove('open'))
}

function notebookDialogFoot(okLabel = '保存', danger = false) {
  return `<div class="nb-dialog-foot"><button class="btn subtle" data-nb-cancel>取消</button><button class="btn ${danger ? 'danger' : 'primary'}" data-nb-ok>${okLabel}</button></div>`
}

function openNotebookRenameDialog(nb) {
  const mask = openModal('重命名笔记本', `<div class="nb-dialog">
    <label class="nb-dialog-label" for="nbRenameInput">笔记本名称</label>
    <input class="nb-dialog-input" id="nbRenameInput" maxlength="80" value="${esc(nb.title)}" autocomplete="off">
    <div class="nb-dialog-note">名称会同步到所有共享列表，最多 80 个字符。</div>
    ${notebookDialogFoot('保存')}
  </div>`)
  const input = mask.querySelector('#nbRenameInput')
  input.focus()
  input.select()
  const save = async () => {
    const title = input.value.trim()
    if (!title) return toast('名称不能为空', true)
    const { body: r } = await api('/api/notebook/manage', { method: 'POST', body: JSON.stringify({ op: 'rename', id: nb.id, title }) })
    if (!r?.ok) return toast(r?.error || '重命名失败', true)
    mask.remove(); toast('已重命名'); renderView()
  }
  mask.querySelector('[data-nb-ok]')?.addEventListener('click', save)
  mask.querySelector('[data-nb-cancel]')?.addEventListener('click', () => mask.remove())
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); save() } })
}

function openNotebookShareDialog(nb) {
  let choice = nb.shared ? 'team' : 'none'
  const mask = openModal('共享设置', `<div class="nb-dialog">
    <div class="nb-dialog-lead">选择《${esc(nb.title)}》的可见范围。</div>
    <div class="nb-share-options">
      <button class="nb-share-opt" data-share-choice="none"><b>仅自己可见</b><span>不进入共享列表，其他人无法查看或推荐。</span></button>
      <button class="nb-share-opt" data-share-choice="team"><b>共享给集团成员</b><span>进入「全部共享笔记本」，成员可查看、添加到集合或推荐。</span></button>
    </div>
    <div class="nb-dialog-note">共享只开放笔记本的阅读与推荐；编辑与删除仍按创建者权限控制。</div>
    ${notebookDialogFoot('保存')}
  </div>`)
  const paint = () => mask.querySelectorAll('.nb-share-opt').forEach((b) => b.classList.toggle('on', b.dataset.shareChoice === choice))
  mask.querySelectorAll('.nb-share-opt').forEach((b) => b.addEventListener('click', () => { choice = b.dataset.shareChoice; paint() }))
  paint()
  mask.querySelector('[data-nb-ok]')?.addEventListener('click', async () => {
    const { body: r } = await api('/api/notebook/manage', { method: 'POST', body: JSON.stringify({ op: 'share', id: nb.id, shared: choice === 'team' }) })
    if (!r?.ok) return toast(r?.error || '共享设置失败', true)
    mask.remove()
    toast(choice === 'team' ? '已共享给集团成员' : '已改为仅自己可见')
    renderView()
  })
  mask.querySelector('[data-nb-cancel]')?.addEventListener('click', () => mask.remove())
}

function openNotebookDeleteDialog(nb) {
  const mask = openModal('删除笔记本', `<div class="nb-dialog">
    <div class="nb-dialog-lead">确定删除《${esc(nb.title)}》？</div>
    <div class="nb-dialog-note danger">笔记本的来源引用、对话与 Studio 内容会一并移除；数据中心原始文件不受影响。删除后不可恢复。</div>
    ${notebookDialogFoot('删除', true)}
  </div>`)
  mask.querySelector('[data-nb-ok]')?.addEventListener('click', async () => {
    const { body: r } = await api('/api/notebook/manage', { method: 'POST', body: JSON.stringify({ op: 'delete', id: nb.id }) })
    if (!r?.ok) return toast(r?.error || '删除失败', true)
    if (state.notebookId === nb.id) { state.notebookId = null; state.nbOpen = false }
    mask.remove(); toast('已删除笔记本'); renderView()
  })
  mask.querySelector('[data-nb-cancel]')?.addEventListener('click', () => mask.remove())
}

function openNotebookCollectionDialog(nb) {
  const names = [...(state.notebookCollections || [])]
  const selected = new Set(nb.collections || [])
  const mask = openModal('添加到集合', `<div class="nb-dialog">
    <div class="nb-dialog-lead">把《${esc(nb.title)}》归入常用集合，便于按专题查找。</div>
    <div class="nb-coll-list" id="nbCollList"></div>
    <div class="nb-coll-new"><input id="nbCollNew" maxlength="24" placeholder="新建集合，例如「城市更新」" autocomplete="off"><button class="btn sm" id="nbCollAdd">${icon('plus')}添加</button></div>
    <div class="nb-dialog-note">一本笔记本可以同时属于多个集合。</div>
    ${notebookDialogFoot('保存')}
  </div>`)
  const listEl = mask.querySelector('#nbCollList')
  const paint = () => {
    listEl.innerHTML = names.length ? names.map((name, i) => `<button class="nb-coll-item ${selected.has(name) ? 'on' : ''}" data-coll-i="${i}"><span class="nb-coll-ico">${icon('folder')}</span><span>${esc(name)}</span><span class="nb-coll-check">${icon('check')}</span></button>`).join('') : '<div class="nb-coll-empty">还没有集合，先新建一个。</div>'
    listEl.querySelectorAll('[data-coll-i]').forEach((b) => b.addEventListener('click', () => {
      const name = names[Number(b.dataset.collI)]
      if (selected.has(name)) selected.delete(name)
      else selected.add(name)
      paint()
    }))
  }
  paint()
  mask.querySelector('#nbCollAdd')?.addEventListener('click', () => {
    const input = mask.querySelector('#nbCollNew')
    const name = input.value.trim()
    if (!name) return input.focus()
    if (!names.includes(name)) names.push(name)
    selected.add(name)
    input.value = ''
    paint()
  })
  mask.querySelector('#nbCollNew')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); mask.querySelector('#nbCollAdd').click() } })
  mask.querySelector('[data-nb-ok]')?.addEventListener('click', async () => {
    const { body: r } = await api('/api/notebook/manage', { method: 'POST', body: JSON.stringify({ op: 'collections', id: nb.id, collections: [...selected] }) })
    if (!r?.ok) return toast(r?.error || '保存失败', true)
    state.notebookCollections = r.all || names
    mask.remove()
    toast(selected.size ? `已加入 ${selected.size} 个集合` : '已移出所有集合')
    renderView()
  })
  mask.querySelector('[data-nb-cancel]')?.addEventListener('click', () => mask.remove())
}

function openNotebookMore(anchor, nb, scope = 'normal') {
  closeNotebookMenu()
  const items = scope === 'shared'
    ? [['collection', 'folder', '添加到集合'], ['vote', 'megaphone', '推荐']]
    : [['rename', 'pen', '重命名'], ['pin', 'pin', nb.pinned ? '取消置顶' : '置顶'], ['share', 'users', nb.shared ? '共享设置' : '共享'], ['delete', 'trash', '删除', 'danger'], ['collection', 'folder', '添加到集合']]
  const pop = document.createElement('div')
  pop.className = 'nb-more-pop'
  pop.innerHTML = items.map(([act, ic, label, tone]) => `<button class="nb-more-item ${tone || ''}" data-nbact="${act}">${icon(ic)}<span>${label}</span>${act === 'pin' && nb.pinned ? icon('check') : ''}</button>`).join('')
  document.body.appendChild(pop)
  anchor.classList.add('open')
  const r = anchor.getBoundingClientRect()
  const w = 184
  pop.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.right - w))}px`
  const top = r.bottom + 6
  pop.style.top = `${top + pop.offsetHeight > innerHeight - 8 ? Math.max(8, r.top - pop.offsetHeight - 6) : top}px`
  const close = (e) => {
    if (e?.target && (pop.contains(e.target) || anchor.contains(e.target))) return
    closeNotebookMenu()
    document.removeEventListener('pointerdown', close, true)
    document.removeEventListener('keydown', onKey)
  }
  const onKey = (e) => { if (e.key === 'Escape') close() }
  setTimeout(() => {
    document.addEventListener('pointerdown', close, true)
    document.addEventListener('keydown', onKey)
  }, 0)
  pop.querySelectorAll('[data-nbact]').forEach((b) => b.addEventListener('click', async () => {
    const act = b.dataset.nbact
    close()
    if (act === 'rename') return openNotebookRenameDialog(nb)
    if (act === 'share') return openNotebookShareDialog(nb)
    if (act === 'delete') return openNotebookDeleteDialog(nb)
    if (act === 'collection') return openNotebookCollectionDialog(nb)
    if (act === 'vote') {
      const { body: r } = await api('/api/notebook/vote', { method: 'POST', body: JSON.stringify({ id: nb.id }) })
      if (!r?.ok) return toast(r?.error || '推荐失败', true)
      toast(`已推荐《${r.title || nb.title}》，当前 ${r.votes} 票`)
      renderView()
      return
    }
    if (act === 'pin') {
      const { body: r } = await api('/api/notebook/manage', { method: 'POST', body: JSON.stringify({ op: 'pin', id: nb.id, pinned: !nb.pinned }) })
      if (!r?.ok) return toast(r?.error || '操作失败', true)
      toast(r.pinned ? '已置顶到最近列表顶部' : '已取消置顶')
      renderView()
    }
  }))
}

function openNotebookSharedDialog(items, collections = []) {
  const shared = items.filter((n) => n.shared).slice().sort((a, b) => (b.votes || 0) - (a.votes || 0) || String(b.updated || '').localeCompare(String(a.updated || '')))
  const mask = openModal('全部共享笔记本', `<div class="kn-all">
    <div class="kn-all-head"><span>共 ${shared.length} 本被共享的笔记本</span><em>按推荐票排序</em></div>
    <div class="kn-all-grid">
      ${shared.length ? shared.map((n, i) => `<div class="kn-all-card" data-allopen="${esc(n.id)}" role="button" tabindex="0">
        <span class="kn-all-art">${icon(n.coverIcon || 'doc')}</span>
        <span class="kn-all-main"><b>${esc(n.title)}</b><span>${esc(n.owner)} · ${n.votes || 0} 票 · ${i < 5 ? '精选第 ' + (i + 1) : '共享'}</span>${(n.collections || []).length ? `<em>${(n.collections || []).map((c) => '#' + esc(c)).join(' ')}</em>` : ''}</span>
        <button class="kn-dots kn-all-more" data-allmore="${esc(n.id)}" title="更多">${icon('more')}</button>
      </div>`).join('') : '<div class="kn-empty">还没有共享出来的笔记本。</div>'}
    </div>
    <div class="kn-all-foot">精选按推荐票前五自动入选；共享范围与推荐票实时同步。</div>
  </div>`, { wide: true })
  mask.querySelectorAll('[data-allopen]').forEach((b) => b.addEventListener('click', (e) => {
    if (e.target.closest('[data-allmore]')) return
    const nb = shared.find((x) => x.id === b.dataset.allopen)
    if (!nb) return
    mask.remove()
    state.notebookId = nb.id
    state.noteId = null
    state.noteOpen = false
    state.nbOpen = true
    state.nbStart = !(items.find((x) => x.id === nb.id)?.sourceCount || 0)
    renderView()
  }))
  mask.querySelectorAll('[data-allmore]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation()
    const nb = shared.find((x) => x.id === b.dataset.allmore)
    if (nb) openNotebookMore(b, nb, 'shared')
  }))
}

async function renderNotebook(el) {
  const { body: listBody } = await api('/api/notebooks')
  const list = listBody.items || []
  state.notebooks = list
  if (!state.notebookId || !list.some((n) => n.id === state.notebookId)) state.notebookId = list[0]?.id
  const detail = state.notebookId ? (await api(`/api/notebook?id=${state.notebookId}`)).body : null
  const nb = detail?.notebook
  const notes = detail?.notes || []
  const chat = detail?.chat || []
  if (!state.noteId || !notes.some((n) => n.id === state.noteId)) state.noteId = notes[0]?.id
  const note = notes.find((n) => n.id === state.noteId)
  const sources = nb?.sources || []
  const pending = sources.filter((x) => x.syncStatus === '有更新待同步').length
  const openNote = note && state.noteOpen
  const startMode = !chat.length && !notes.length
  const featured = list.filter((n) => n.featured).sort((a, b) => (a.featuredRank || 99) - (b.featuredRank || 99))
  const recent = list.filter((n) => !n.featured).slice().sort((a, b) => {
    const pin = Number(!!b.pinned) - Number(!!a.pinned)
    if (pin) return pin
    if (state.nbSortMode === 'title') return String(a.title || '').localeCompare(String(b.title || ''), 'zh-Hans-CN')
    return String(b.updated || '').localeCompare(String(a.updated || ''))
  })
  state.notebookCollections = listBody.collections || state.notebookCollections || []
  const cnDate = (s) => {
    const [y, m, d] = String(s || '').slice(0, 10).split('-')
    return y ? `${y}年${Number(m)}月${Number(d)}日` : ''
  }
  const voteIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 10v9M7 10l3.2-6.2A2 2 0 0 1 14 5.2L13 9h4.4a2 2 0 0 1 2 2.4l-1.1 5.5a3 3 0 0 1-3 2.1H7"/></svg>'

  if (state.nbOpen && (state.nbStart || startMode) && nb) {
    renderNotebookStart(el, nb, sources, detail)
    return
  }

  el.innerHTML = state.nbOpen ? `
    <div class="view-head">
      <div>
        <div class="nbx-back"><button class="nbx-link" id="nbBack">${icon('arrow')}全部笔记本</button></div>
        <div class="view-title">${nb ? esc(nb.title) : '智能笔记本'}</div>
        <div class="view-desc">${esc(nb?.topic || '')}${nb?.desc ? ' · ' + esc(nb.desc) : ''}</div>
      </div>
      <div class="spacer"></div>
      ${pending ? `<button class="btn sm" id="nbSync">${icon('refresh')}同步 ${pending} 项更新</button>` : ''}
    </div>
    <div class="nbx">
      <aside class="nbx-src">
        <div class="nbx-head"><span>笔记来源</span><span class="mono">${sources.length}/20</span><span class="spacer"></span><button class="nbx-link" id="nbAddSource">${icon('plus')}添加</button></div>
        <div class="nbx-scroll">
          ${sources.length ? sources.map((sc) => `
            <div class="nbx-row ${sc.canSee === false ? 'locked' : ''}">
              <button class="nbx-row-main" ${sc.kind ? `data-ext="${esc(sc.resourceId)}"` : `data-src="${esc(sc.resourceId)}"`}>
                <span class="nbx-ico">${icon(nbSourceIcon(sc))}</span>
                <span class="nbx-row-body">
                  <span class="nbx-row-name">${esc(sc.name)}</span>
                  <span class="nbx-row-meta">${sc.kind ? `${esc(sc.format || '外部来源')}${sc.kind === 'file' ? ' · ' + nbSize(sc.sizeBytes) : sc.kind === 'cloud' ? ' · 不占容量' : ''} · ${esc(sc.syncStatus || '')}` : `${esc(sc.latestVersion || sc.format || '')} · ${sc.versionMode === 'follow' ? '跟随最新' : '钉住 ' + esc(sc.resolvedVersionId || '')}${sc.canSee === false ? ' · 无权查看，问答不引用' : ''}`}</span>
                </span>
              </button>
              <button class="nbx-x" data-rm="${sc.resourceId}" title="移出引用">${icon('close')}</button>
            </div>`).join('') : `<div class="nbx-empty">还没有引用资料。<br>从数据中心选择 Resource 加入，只建立引用、不复制文件。</div>`}
        </div>
        <div class="nbx-principle">只引用不复制 · 跟随已发布最新版本 · 笔记独立保存 · 复用数据中心与 Harness 能力</div>
      </aside>
      <div class="nbx-grip" data-grip="1" title="拖动调整来源栏宽度"></div>

      <section class="nbx-chat">
        <div class="nbx-head"><span>对话</span><span class="mono">基于 ${sources.length} 项来源</span></div>
        <div class="nbx-scroll nbx-msgs" id="nbChat">
          ${chat.length ? chat.slice(-12).map((m, mi) => {
            const idx = Math.max(0, chat.length - 12) + mi
            return `
            <div class="nbx-msg ${m.role}">
              <div class="nbx-msg-text">${esc(m.text)}</div>
              ${(m.citations || []).length ? `<div class="nb-cites">${m.citations.map((c) => `<button class="nb-cite" data-cite="${c.resourceId}" data-ver="${esc(c.versionId || '')}"><span class="mono">${esc(c.versionId || 'V?')}</span>${esc(c.locator || '')}</button>`).join('')}</div>` : ''}
              <div class="nbx-msg-foot"><span class="nbx-msg-time mono">${esc(m.at || '')}</span><button class="nbx-msg-save" data-save-msg="${idx}" title="保存这段对话到 Studio">${icon('plus')}Studio</button></div>
            </div>`
          }).join('') : '<div class="nbx-empty">直接提问。回答只使用本笔记本引用的来源，并标出资源与版本。</div>'}
          ${chat.length ? `<button class="nbx-take" id="nbTake">把最后一条回答存到 Studio ${icon('pen')}</button>` : ''}
        </div>
        <div class="nbx-ask">
          <div class="nbx-chips">${['概括这组资料的核心结论', '找出相互矛盾的表述', '列出还需要核实的问题'].map((t) => `<button class="chip" data-qs="${t}">${t}</button>`).join('')}</div>
          <div class="nbx-input">
            <textarea id="nbQ" rows="1" placeholder="向本笔记本的 ${sources.length} 项资料提问"></textarea>
            <button class="nbx-send" id="nbAsk" title="提问（Ctrl/⌘ + Enter）">${icon('up')}</button>
          </div>
        </div>
      </section>
      <div class="nbx-grip" data-grip="2" title="拖动调整笔记栏宽度"></div>

      ${notebookStudioMarkup(notes)}
    </div>
    ${notebookNoteModal(openNote ? note : null)}` : `
    <div class="kn-gal">
      <div class="kn-gal-head">
        <h2 class="kn-gal-title">精选笔记本</h2>
        ${featured.length > 5 ? `<button class="kn-link" id="nbSeeAll">查看更多 ${icon('arrow')}</button>` : ''}
      </div>
      ${featured.length ? `<div class="kn-feat-grid">
        ${featured.slice(0, 5).map((n) => `
        <div class="kn-feat kn-tone-${Number(n.coverTone) || 0} ${n.coverTone === 2 ? 'is-dark' : ''}" data-nb="${n.id}" role="button" tabindex="0">
          <div class="kn-feat-cover">${icon(n.coverIcon || 'doc')}</div>
          <div class="kn-feat-top">
            <span class="kn-avatar">${esc((n.owner || '友').slice(0, 1))}</span>
            <span class="kn-owner">${esc(n.owner || '共享用户')}</span>
            <button class="kn-dots" data-nbmore="${n.id}" title="更多">${icon('more')}</button>
          </div>
          <div class="kn-feat-main">
            <div class="kn-feat-title">${esc(n.title)}</div>
            <div class="kn-feat-meta">精选第 ${n.featuredRank || 1} · ${cnDate(n.updated)} · ${n.displaySources ?? n.sourceCount} 个来源</div>
          </div>
          <button class="kn-vote" data-nbv="${n.id}" title="推荐这个笔记本">${voteIcon}<span>${n.votes || 0}</span></button>
        </div>`).join('')}
      </div>` : '<div class="kn-empty">待揭晓</div>'}

      <div class="kn-gal-head kn-recent-head">
        <h2 class="kn-gal-title">最近打开过的笔记本</h2>
        <div class="kn-sort-wrap">
          <button class="kn-sort" id="nbSort" title="排序方式" aria-haspopup="menu" aria-expanded="false">${icon('filter')}</button>
          <div class="kn-sort-pop" id="nbSortPop" role="menu" hidden>
            <button class="kn-sort-item${state.nbSortMode === 'recent' ? ' on' : ''}" role="menuitemradio" aria-checked="${state.nbSortMode === 'recent'}" data-nbsort="recent">最近${state.nbSortMode === 'recent' ? icon('check') : ''}</button>
            <button class="kn-sort-item${state.nbSortMode === 'title' ? ' on' : ''}" role="menuitemradio" aria-checked="${state.nbSortMode === 'title'}" data-nbsort="title">标题${state.nbSortMode === 'title' ? icon('check') : ''}</button>
          </div>
        </div>
        <span class="spacer"></span>
        <button class="kn-new" id="nbNew2">${icon('plus')}新建笔记本</button>
      </div>
      ${recent.length ? `<div class="kn-recent-grid">
        ${recent.map((n) => `
        <div class="kn-recent" data-nb="${n.id}" role="button" tabindex="0">
          <span class="kn-recent-art">${icon('doc')}</span>
          <button class="kn-dots kn-recent-more" data-nbmore="${n.id}" title="更多">${icon('more')}</button>
          <span class="kn-recent-title">${esc(n.title)}</span>
          <span class="kn-recent-meta">${n.pinned ? '已置顶 · ' : ''}${n.shared ? '已共享 · ' : ''}${cnDate(n.updated)} · ${n.sourceCount} 个来源${(n.collections || []).length ? ' · 集合：' + n.collections.map((c) => esc(c)).join('、') : ''}</span>
        </div>`).join('')}
      </div>` : '<div class="kn-empty">还没有打开过笔记本。点右上角新建一本，或打开精选笔记本。</div>'}
    </div>`

  // 进入 / 退出具体笔记本
  el.querySelectorAll('[data-nb]').forEach((b) => b.addEventListener('click', (e) => {
    if (e.target.closest('[data-nbv],[data-nbmore]')) return
    state.notebookId = b.dataset.nb
    state.noteId = null
    state.noteOpen = false
    state.nbOpen = true
    state.nbStart = false
    renderView()
  }))
  el.querySelector('#nbBack')?.addEventListener('click', () => { state.nbOpen = false; state.noteOpen = false; state.nbStart = false; renderView() })

  // 点击资料行暂时只做定位提示（资源详情另有入口）
  el.querySelectorAll('[data-src]').forEach((b) => b.addEventListener('click', () => openResource(b.dataset.src)))
  el.querySelectorAll('[data-ext]').forEach((b) => b.addEventListener('click', () => {
    const sc = sources.find((x) => x.resourceId === b.dataset.ext)
    toast(sc?.url ? `外部来源：${sc.url}` : `外部来源：${sc?.name || ''}`)
  }))


  // 新建笔记本：直接进入 Gemini 风格的空笔记本（默认未命名，后续可添加来源）
  const createNotebook = async () => {
    const { body: r } = await api('/api/notebooks', { method: 'POST', body: JSON.stringify({ title: '未命名的笔记本', topic: (listBody.topics || [])[0] || '未分类', desc: '' }) })
    if (!r?.ok) return toast(r?.error || '创建失败')
    state.notebookId = r.notebook.id
    state.noteId = null
    state.noteOpen = false
    state.nbOpen = true
    state.nbStart = true
    renderView()
  }
  el.querySelector('#nbNew')?.addEventListener('click', createNotebook)
  el.querySelector('#nbNew2')?.addEventListener('click', createNotebook)

  // 精选推荐
  el.querySelectorAll('[data-nbv]').forEach((b) => b.addEventListener('click', async (e) => {
    e.stopPropagation()
    const { body: r } = await api('/api/notebook/vote', { method: 'POST', body: JSON.stringify({ id: b.dataset.nbv }) })
    if (!r?.ok) return toast(r?.error || '推荐失败')
    toast(`已推荐《${r.title || '笔记本'}》，当前 ${r.votes} 票`)
    renderView()
  }))
  el.querySelectorAll('[data-nbmore]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation()
    const nb = list.find((x) => x.id === b.dataset.nbmore)
    if (nb) openNotebookMore(b, nb, nb.featured ? 'shared' : 'normal')
  }))
  el.querySelector('#nbSeeAll')?.addEventListener('click', () => openNotebookSharedDialog(list, state.notebookCollections || []))
  const sortBtn = el.querySelector('#nbSort')
  const sortPop = el.querySelector('#nbSortPop')
  if (sortBtn && sortPop) {
    const closeSort = () => {
      sortPop.hidden = true
      sortBtn.setAttribute('aria-expanded', 'false')
      document.removeEventListener('pointerdown', onSortOutside, true)
      document.removeEventListener('keydown', onSortKey, true)
    }
    const onSortOutside = (e) => {
      if (!sortPop.contains(e.target) && !sortBtn.contains(e.target)) closeSort()
    }
    const onSortKey = (e) => { if (e.key === 'Escape') closeSort() }
    sortBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      if (!sortPop.hidden) return closeSort()
      sortPop.hidden = false
      sortBtn.setAttribute('aria-expanded', 'true')
      setTimeout(() => {
        document.addEventListener('pointerdown', onSortOutside, true)
        document.addEventListener('keydown', onSortKey, true)
      }, 0)
    })
    sortPop.querySelectorAll('[data-nbsort]').forEach((b) => b.addEventListener('click', () => {
      state.nbSortMode = b.dataset.nbsort === 'title' ? 'title' : 'recent'
      renderView()
    }))
  }

  // 添加来源：本地上传（默认） / 数据中心 / 云空间
  el.querySelector('#nbAddSource')?.addEventListener('click', () => openNotebookSourcePicker(detail))

  // 同步最新版本
  el.querySelector('#nbSync')?.addEventListener('click', async () => {
    const { body: r } = await api('/api/notebook/sync', { method: 'POST', body: JSON.stringify({ id: state.notebookId }) })
    toast(r?.ok ? `已同步 ${r.changed} 项引用到最新版本` : r?.error || '同步失败')
    renderView()
  })

  // 移出引用
  el.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', async () => {
    const { body: r } = await api('/api/notebook/source', { method: 'POST', body: JSON.stringify({ id: state.notebookId, removeSource: b.dataset.rm }) })
    if (r?.ok) { toast('已移出引用（原始文件不受影响）'); renderView() } else toast(r?.error || '操作失败')
  }))

  // 提问
  const ask = async (q) => {
    if (!q.trim()) return
    const { body: r } = await api('/api/notebook/ask', { method: 'POST', body: JSON.stringify({ id: state.notebookId, q }) })
    if (r?.ok) renderView()
    else toast(r?.error || '提问失败')
  }
  el.querySelector('#nbAsk')?.addEventListener('click', () => ask(el.querySelector('#nbQ').value))
  el.querySelector('#nbQ')?.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.metaKey) ask(e.target.value) })
  el.querySelectorAll('[data-qs]').forEach((b) => b.addEventListener('click', () => ask(b.dataset.qs)))

  // 引用跳转到数据中心资源
  el.querySelectorAll('[data-cite]').forEach((b) => b.addEventListener('click', () => openResource(b.dataset.cite)))

  // Studio：输出、笔记打开/保存/删除
  bindNotebookStudio(el, { nb, notes, chat, sources })
  el.querySelectorAll('[data-save-msg]').forEach((b) => b.addEventListener('click', async () => {
    const m = chat[Number(b.dataset.saveMsg)]
    if (!m) return
    const title = `${m.role === 'ai' ? '回答' : '提问'}：${(m.text || '').replace(/\s+/g, ' ').slice(0, 24)}`
    const { body: r } = await api('/api/notebook/note', { method: 'POST', body: JSON.stringify({ id: state.notebookId, note: { title, content: m.text, kind: 'chat', citations: m.citations || [] } }) })
    if (r?.ok) { state.noteId = r.notes[0].id; toast('这段对话已保存到 Studio'); renderView() } else toast(r?.error || '保存失败')
  }))
  el.querySelector('#nbTake')?.addEventListener('click', async () => {
    const last = [...chat].reverse().find((m) => m.role === 'ai')
    if (!last) return
    const { body: r } = await api('/api/notebook/note', { method: 'POST', body: JSON.stringify({ id: state.notebookId, note: { title: '从对话保存的结论', content: last.text, kind: 'chat', citations: last.citations || [] } }) })
    if (r?.ok) { state.noteId = r.notes[0].id; toast('已保存到 Studio，可继续编辑'); renderView() } else toast(r?.error || '保存失败')
  })

  const grid = el.querySelector('.nbx')
  if (grid) {
    const saved = (() => { try { return JSON.parse(localStorage.getItem('jg.nbCols') || '{}') } catch { return {} } })()
    if (saved.l) grid.style.setProperty('--nb-l', saved.l + 'px')
    if (saved.r) grid.style.setProperty('--nb-r', saved.r + 'px')
    grid.querySelectorAll('[data-grip]').forEach((g) => {
      g.addEventListener('pointerdown', (ev) => {
        ev.preventDefault()
        const left = g.dataset.grip === '1'
        const col = grid.querySelector(left ? '.nbx-src' : '.nbx-studio')
        const startX = ev.clientX
        const startW = col.getBoundingClientRect().width
        document.body.classList.add('resizing')
        const move = (e) => {
          const d = e.clientX - startX
          const w = Math.round(Math.min(420, Math.max(170, left ? startW + d : startW - d)))
          grid.style.setProperty(left ? '--nb-l' : '--nb-r', w + 'px')
        }
        const up = () => {
          document.body.classList.remove('resizing')
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', up)
          const cur = grid.style.getPropertyValue('--nb-l') || grid.style.getPropertyValue('--nb-r')
          try {
            const o = JSON.parse(localStorage.getItem('jg.nbCols') || '{}')
            if (grid.style.getPropertyValue('--nb-l')) o.l = parseInt(grid.style.getPropertyValue('--nb-l'), 10)
            if (grid.style.getPropertyValue('--nb-r')) o.r = parseInt(grid.style.getPropertyValue('--nb-r'), 10)
            localStorage.setItem('jg.nbCols', JSON.stringify(o))
          } catch { /* ignore */ }
          void cur
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
      })
    })
  }

  const chatBox = el.querySelector('#nbChat')
  if (chatBox) chatBox.scrollTop = chatBox.scrollHeight
}

/* ------------------------------ 智能笔记本 · 新空页 ------------------------------ */

const NB_CLOUD_SOURCES = [
  { name: '九江市城市更新专题成果包', path: '云空间 / 规划成果 / 2026', format: '文件夹' },
  { name: '浔阳区三维模型轻量化说明.pdf', path: '云空间 / 项目资料 / 浔阳区', format: 'PDF' },
  { name: '城市体检指标口径汇总.docx', path: '云空间 / 政策汇编 / 城市体检', format: 'DOCX' },
  { name: '1958 工业厂区更新汇报.pptx', path: '云空间 / 会议材料 / 1958', format: 'PPTX' },
]

function nbSourceIcon(sc) {
  if (sc.kind === 'web') return 'globe'
  if (sc.kind === 'cloud') return 'cloud'
  if (sc.kind === 'file') return 'upload'
  if (sc.type === 'gis' || sc.type === 'cad' || sc.type === '3d') return 'map'
  if (sc.type === 'document') return 'doc'
  if (sc.type === 'bizdata') return 'table'
  return 'folder'
}

function renderNotebookStart(el, nb, sources, detail) {
  const notes = detail?.notes || []
  const chat = detail?.chat || []
  const note = notes.find((n) => n.id === state.noteId)
  const openNote = note && state.noteOpen
  const limits = detail?.limits || {}
  const maxSources = limits.maxSources || NB_MAX_SOURCES
  const usedQuota = limits.usedBytes || 0
  const maxQuota = limits.quotaBytes || 15 * 1024 ** 3
  const rows = sources.map((sc) => `
    <div class="nbs-row ${sc.canSee === false ? 'locked' : ''}">
      <button class="nbs-row-main" ${sc.kind ? `data-ext="${esc(sc.resourceId)}"` : `data-src="${esc(sc.resourceId)}"`}>
        <span class="nbs-ico">${icon(nbSourceIcon(sc))}</span>
        <span class="nbs-row-body">
          <span class="nbs-row-name">${esc(sc.name)}</span>
          <span class="nbs-row-meta">${esc(sc.format || (sc.kind === 'web' ? '网页' : sc.kind === 'cloud' ? '云空间' : '本地文件'))}${sc.kind === 'file' ? ' · ' + nbSize(sc.sizeBytes) : sc.kind === 'cloud' ? ' · 不占容量' : ''}${sc.url ? ' · ' + esc(sc.url.replace(/^https?:\/\//, '')) : ''}</span>
        </span>
      </button>
      <button class="nbs-x" data-rm="${esc(sc.resourceId)}" title="移出来源">${icon('close')}</button>
    </div>`).join('')

  el.innerHTML = `
  <div class="nbs">
    <div class="nbs-top">
      <button class="nbs-back" id="nbsBack" title="返回全部笔记本">${icon('arrow')}</button>
      <span class="nbs-mark">${icon('wave')}</span>
      <b class="nbs-title">${esc(nb.title || '未命名的笔记本')}</b>
    </div>
    <aside class="nbs-src">
      <div class="nbs-src-head"><span>来源</span><span class="nbs-count">${sources.length}/${maxSources}</span><button class="nbs-fold" title="收起来源栏">${icon('list')}</button></div>
      <div class="nbs-actions">
        <button class="nbs-pill" id="nbsAdd">${icon('plus')}添加来源</button>
        <button class="nbs-pill" id="nbsNote">${icon('plus')}创建笔记</button>
      </div>
      <div class="nbs-search">
        <input id="nbsQ" placeholder="搜索数据中心、云空间来源" autocomplete="off">
        <div class="nbs-search-foot">
          <button class="nbs-scope" data-scope="data">${icon('database')}数据中心</button>
          <button class="nbs-scope" data-scope="cloud">${icon('cloud')}云空间</button>
          <button class="nbs-go" id="nbsGo" title="搜索来源">${icon('arrow')}</button>
        </div>
      </div>
      <div class="nbs-list">
        ${rows || `<div class="nbs-empty">
          <span class="nbs-empty-ico">${icon('doc')}</span>
          <b>已保存的来源将显示在此处</b>
          <p>上传本地文件，或引用数据中心、云空间的资源，再基于这些来源提问或创作内容。</p>
          <span class="nbs-empty-hint">将文件拖到此处或 <button class="nbs-link" id="nbsEmptyAdd">添加来源</button></span>
        </div>`}
      </div>
      <div class="nbs-principle">来源 ${sources.length}/${maxSources} · 个人容量 ${nbSize(usedQuota)} / ${nbSize(maxQuota)}<br>只建立引用，不复制原文件 · 数据中心与云空间不占容量</div>
    </aside>

    <section class="nbs-canvas">
      <div class="nbs-onboard">
        <div class="nbs-wave">${icon('wave')}</div>
        <h1>${sources.length ? '让我们开始梳理这些来源…' : '让我们开始制作笔记本…'}</h1>
        <p>这是一张专属于您的空白画布，任您尽情探索、挥洒创意，或开启全新篇章。我可以引导您开始，或者您也可以直接添加自己的来源。</p>
        <div class="nbs-prompt">您希望此笔记本帮助您做什么？</div>
        <div class="nbs-choices">
          <button class="nbs-choice" data-nbq="帮我了解这个主题的核心脉络">了解新主题</button>
          <button class="nbs-choice" data-nbq="帮我创建一份结构化内容提纲">创建新内容</button>
          <button class="nbs-choice" data-nbq="帮我梳理下一步要推进的事项">推进项目</button>
        </div>
      </div>
      <div class="nbs-composer">
        <button class="nbs-plus" id="nbsComposerAdd" title="添加来源">${icon('plus')}</button>
        <textarea id="nbsAskQ" rows="1" placeholder="提问或创作内容"></textarea>
        <span class="nbs-src-count">${sources.length}/${maxSources} 个来源</span>
        <button class="nbs-send" id="nbsAsk" title="发送">${icon('up')}</button>
      </div>
    </section>
    ${notebookStudioMarkup(notes, { start: true })}
  </div>
  ${notebookNoteModal(openNote ? note : null)}`

  el.querySelector('#nbsBack')?.addEventListener('click', () => { state.nbOpen = false; state.nbStart = false; renderView() })

  const openPicker = (mode = 'file', q = '') => openNotebookSourcePicker(detail, { mode, query: q })
  const searchFromCard = () => {
    const q = el.querySelector('#nbsQ')?.value.trim() || ''
    openPicker(el.dataset.nbsScope || 'data', q)
  }
  el.querySelector('#nbsAdd')?.addEventListener('click', () => openPicker('file'))
  el.querySelector('#nbsEmptyAdd')?.addEventListener('click', () => openPicker('file'))
  el.querySelector('#nbsComposerAdd')?.addEventListener('click', () => openPicker('file'))
  el.querySelector('#nbsGo')?.addEventListener('click', searchFromCard)
  el.querySelector('#nbsQ')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') searchFromCard() })
  el.querySelectorAll('.nbs-scope').forEach((b) => b.addEventListener('click', () => {
    el.dataset.nbsScope = b.dataset.scope
    el.querySelectorAll('.nbs-scope').forEach((x) => x.classList.toggle('on', x === b))
    searchFromCard()
  }))

  el.querySelector('#nbsNote')?.addEventListener('click', async () => {
    const { body: r } = await api('/api/notebook/note', { method: 'POST', body: JSON.stringify({ id: state.notebookId, note: { title: '新笔记', content: '' } }) })
    if (!r?.ok) return toast(r?.error || '创建失败')
    state.noteId = r.notes[0]?.id
    state.noteOpen = true
    state.nbStart = false
    renderView()
  })

  const ask = async () => {
    const q = el.querySelector('#nbsAskQ')?.value.trim() || ''
    if (!q) return toast('请输入问题')
    const { body: r } = await api('/api/notebook/ask', { method: 'POST', body: JSON.stringify({ id: state.notebookId, q }) })
    if (!r?.ok) return toast(r?.error || '提问失败')
    state.nbStart = false
    renderView()
  }
  el.querySelector('#nbsAsk')?.addEventListener('click', ask)
  el.querySelector('#nbsAskQ')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask() }
  })
  el.querySelectorAll('[data-nbq]').forEach((b) => b.addEventListener('click', () => {
    const q = el.querySelector('#nbsAskQ')
    q.value = b.dataset.nbq
    q.focus()
  }))

  el.querySelectorAll('[data-src]').forEach((b) => b.addEventListener('click', () => openResource(b.dataset.src)))
  el.querySelectorAll('[data-ext]').forEach((b) => b.addEventListener('click', () => {
    const sc = sources.find((x) => x.resourceId === b.dataset.ext)
    toast(sc?.url ? `外部来源：${sc.url}` : `外部来源：${sc?.name || ''}`)
  }))
  el.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', async () => {
    const { body: r } = await api('/api/notebook/source', { method: 'POST', body: JSON.stringify({ id: state.notebookId, removeSource: b.dataset.rm }) })
    if (r?.ok) { toast('已移除来源'); renderView() } else toast(r?.error || '操作失败')
  }))
  bindNotebookStudio(el, { nb, notes, chat, sources })
}

async function addNotebookGenericSource(source) {
  const { body: r } = await api('/api/notebook/source', { method: 'POST', body: JSON.stringify({ id: state.notebookId, source }) })
  if (!r?.ok) { toast(r?.error || '添加失败'); return false }
  return true
}

function openNotebookSourcePicker(detail, opts = {}) {
  const existing = new Set((detail?.notebook?.sources || []).map((x) => x.resourceId))
  const baseCount = (detail?.notebook?.sources || []).length
  const limits = detail?.limits || {}
  const maxSources = limits.maxSources || NB_MAX_SOURCES
  const quotaMax = limits.quotaBytes || 15 * 1024 ** 3
  const quotaUsed = limits.usedBytes || 0
  const full = baseCount >= maxSources
  const cands = (detail?.candidates || []).filter((r) => !existing.has(r.id))
  let mode = ['file', 'data', 'cloud'].includes(opts.mode) ? opts.mode : 'file'
  const startQuery = opts.query || ''

  const mask = openModal('添加来源', `
    <div class="nbsm" data-mode="${mode}">
      <div class="nbsm-tabs">
        <button class="nbsm-tab" data-nbmode="file">${icon('upload')}本地上传</button>
        <button class="nbsm-tab" data-nbmode="data">${icon('database')}数据中心</button>
        <button class="nbsm-tab" data-nbmode="cloud">${icon('cloud')}云空间</button>
      </div>
      <div class="nbsm-drop nbsm-drop-top ${full ? 'disabled' : ''}" id="nbsmDrop">
        <span class="nbsm-drop-ico">${icon('upload')}</span>
        <b>拖放文件即可上传</b>
        <span>支持 PDF、图片、Word、PPT、Excel、文本等格式</span>
        <input type="file" id="nbsmFile" multiple hidden ${full ? 'disabled' : ''}>
      </div>
      <div class="nbsm-search">
        <span class="nbsm-ico">${icon('search')}</span>
        <input id="nbsmQ" value="${esc(startQuery)}" placeholder="搜索数据中心资源" autocomplete="off">
        <button class="nbsm-go" id="nbsmGo" title="搜索">${icon('arrow')}</button>
      </div>
      <div class="nbsm-body" id="nbsmBody"></div>
      <div class="nbsm-foot">
        <div class="nbsm-cap"><span>来源 ${baseCount} / ${maxSources}</span><span>个人容量 ${nbSize(quotaUsed)} / ${nbSize(quotaMax)}</span></div>
        <div>本地上传占用个人容量；数据中心与云空间来源只建立引用、不占容量。</div>
      </div>
    </div>`, { wide: true })

  const body = mask.querySelector('#nbsmBody')
  const qEl = mask.querySelector('#nbsmQ')
  const finish = () => { mask.remove(); renderView() }

  const paint = () => {
    mask.querySelectorAll('.nbsm-tab').forEach((b) => b.classList.toggle('on', b.dataset.nbmode === mode))
    mask.querySelector('.nbsm').dataset.mode = mode
    qEl.placeholder = mode === 'cloud' ? '搜索云空间文件' : '搜索数据中心资源'
    const q = (qEl.value || '').trim().toLowerCase()

    if (mode === 'file') {
      body.innerHTML = full
        ? `<div class="nbsm-empty">本笔记本已有 ${baseCount}/${maxSources} 个来源，已达上限。请先在来源列表移除不用的来源后再添加。</div>`
        : ''
    } else if (mode === 'data') {
      const items = cands.filter((x) => !q || (x.name + ' ' + (x.owner || '') + ' ' + (x.format || '')).toLowerCase().includes(q))
      body.innerHTML = items.length ? `<div class="nbsm-sect"><span>数据中心资源</span><em>${items.length} 项可引用 · 不占个人容量</em></div>
        ${items.map((x, i) => `<div class="nbsm-row">
          <span class="nbsm-row-ico">${icon('database')}</span>
          <div class="nbsm-row-main"><b>${esc(x.name)}</b><span>${esc(x.format || '')} · ${esc(x.owner || '')} · ${esc(x.version || '')}</span></div>
          <span class="tag">${esc(x.security || '')}</span>
          <button class="btn sm" data-data="${i}" ${full ? 'disabled' : ''}>加入</button>
        </div>`).join('')}` : `<div class="nbsm-empty">没有匹配的数据中心资源。可先在数据中心登记，或调整网络与授权范围。</div>`
      body.querySelectorAll('[data-data]').forEach((b) => b.addEventListener('click', async () => {
        if (full) return toast(`每本笔记本最多 ${maxSources} 个来源`)
        const x = items[Number(b.dataset.data)]
        const { body: r } = await api('/api/notebook/source', { method: 'POST', body: JSON.stringify({ id: state.notebookId, resourceId: x.id, versionMode: 'follow' }) })
        if (r?.ok) { toast('已加入数据中心引用（不占个人容量）'); finish() } else toast(r?.error || '添加失败')
      }))
    } else if (mode === 'cloud') {
      const items = NB_CLOUD_SOURCES.filter((x) => !q || (x.name + ' ' + x.path).toLowerCase().includes(q))
      body.innerHTML = items.length ? `<div class="nbsm-sect"><span>云空间文件</span><em>${items.length} 个 · 不占个人容量</em></div>
        ${items.map((x, i) => `<div class="nbsm-row">
          <span class="nbsm-row-ico">${icon('cloud')}</span>
          <div class="nbsm-row-main"><b>${esc(x.name)}</b><span>${esc(x.path)} · ${esc(x.format)}</span></div>
          <button class="btn sm" data-cloud="${i}" ${full ? 'disabled' : ''}>引用</button>
        </div>`).join('')}` : `<div class="nbsm-empty">云空间中没有匹配的文件。</div>`
      body.querySelectorAll('[data-cloud]').forEach((b) => b.addEventListener('click', async () => {
        if (full) return toast(`每本笔记本最多 ${maxSources} 个来源`)
        const x = items[Number(b.dataset.cloud)]
        if (await addNotebookGenericSource({ kind: 'cloud', name: x.name, url: x.path, format: x.format })) { toast('已引用云空间文件（不占个人容量）'); finish() }
      }))
    }
  }

  const addFiles = async (files) => {
    if (!files.length) return
    if (full) return toast(`每本笔记本最多 ${maxSources} 个来源，请先移除不用的来源`, true)
    const room = maxSources - baseCount
    const picked = files.slice(0, room)
    if (files.length > room) toast(`每本笔记本最多 ${maxSources} 个来源，本次只添加前 ${room} 个`)
    let okCount = 0
    for (const f of picked) {
      const ext = (f.name.split('.').pop() || '').toUpperCase()
      const ok = await addNotebookGenericSource({ kind: 'file', name: f.name, format: ext, sizeBytes: f.size })
      if (ok) okCount += 1
    }
    if (okCount) toast(`已添加 ${okCount} 个本地文件作为来源`)
    finish()
  }
  const fileInput = mask.querySelector('#nbsmFile')
  fileInput?.addEventListener('change', (e) => addFiles(Array.from(e.target.files || [])))
  const drop = mask.querySelector('#nbsmDrop')
  drop?.addEventListener('dragover', (e) => { if (!full) { e.preventDefault(); drop.classList.add('over') } })
  drop?.addEventListener('dragleave', () => drop.classList.remove('over'))
  drop?.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); if (!full) addFiles(Array.from(e.dataTransfer?.files || [])) })
  drop?.addEventListener('click', () => { if (full) return toast(`每本笔记本最多 ${maxSources} 个来源`); fileInput?.click() })

  qEl.addEventListener('input', paint)
  qEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); paint() } })
  mask.querySelector('#nbsmGo')?.addEventListener('click', paint)
  mask.querySelectorAll('[data-nbmode]').forEach((b) => b.addEventListener('click', () => { mode = b.dataset.nbmode; paint() }))
  paint()
}


const IMAGE_TEMPLATE_CATEGORIES = ['海报', '室内设计', '徽标', '插画', '职业形象照', '图标', '产品照', '周边商品', '信息图', '宣传单', '其他']

function imageTemplateById(id) {
  return (state.imagegen.templates || []).find((item) => item.id === id) || null
}

function imageTemplateTabCount() {
  return Array.isArray(state.imagegen.templates) ? state.imagegen.templates.length : 0
}

function selectedImageModel() {
  const cap = state.boot?.imageGeneration || {}
  const models = Array.isArray(cap.models) ? cap.models : []
  const configured = models.filter((model) => model.configured)
  const selected = configured.find((model) => model.id === state.imagegen.modelId)
    || configured.find((model) => model.default)
    || configured[0]
  if (selected && state.imagegen.modelId !== selected.id) state.imagegen.modelId = selected.id
  return selected || null
}

function imageEditModel() {
  const models = Array.isArray(state.boot?.imageGeneration?.models) ? state.boot.imageGeneration.models : []
  return models.find((model) => model.configured && model.capabilities?.edit) || null
}

function imagegenReady() {
  const cap = state.boot?.imageGeneration
  if (cap) return Boolean(cap.enabled)
  return false
}

function showImageGate() {
  const cap = state.boot?.imageGeneration
  const reason = cap?.reason || '当前环境没有可用的图像生成模型'
  const mask = openModal('图像功能暂不可用', `
    <div class="notice">当前环境没有可用的真实图像生成通道。</div>
    <div class="field" style="margin-top:10px"><div class="field-label">原因</div><div class="field-value">${esc(reason)}</div></div>
    <div class="field"><div class="field-label">怎么解决</div><div class="field-value">图像模型与聊天模型解耦，当前只支持 Qwen-Image 与 Seedream。请由管理员在服务端配置 QWEN_IMAGE_API_KEY 或 SEEDREAM_IMAGE_API_KEY（可选配置对应 ENDPOINT / MODEL），重启服务后在图像页选择模型。没有配置 Key 的模型显示为未配置，不会回退到演示图。</div></div>
    <div class="form-note">能力由服务端 /api/bootstrap 的 imageGeneration 声明，前端只按真实服务状态决定入口是否可用。</div>`, {})
  const foot = document.createElement('div')
  foot.style.cssText = 'display:flex;gap:8px;margin-top:14px'
  foot.innerHTML = `<button class="btn primary" data-net>检查当前网络</button><button class="btn" data-later>知道了</button>`
  mask.querySelector('.jg-modal-body').appendChild(foot)
  foot.querySelector('[data-net]').addEventListener('click', () => { mask.remove(); state.view = 'settings'; state.settingsTab = 'network'; render() })
  foot.querySelector('[data-later]').addEventListener('click', () => mask.remove())
}

function imageShotFromAsset(asset) {
  const createdAt = Number(asset.createdAt || asset.updatedAt || Date.now())
  return {
    id: asset.id,
    prompt: asset.prompt || '',
    style: asset.style || '写实',
    ratio: asset.ratio || '1:1',
    url: asset.url || (asset.fileId ? `/api/images/file?id=${encodeURIComponent(asset.fileId)}` : ''),
    name: asset.name || '',
    mime: asset.mime || '',
    provider: asset.provider || '',
    providerLabel: asset.providerLabel || '',
    model: asset.model || '',
    modelId: asset.modelId || '',
    seed: Number(asset.seed || 0),
    revision: Number(asset.revision || 1),
    versions: Number(asset.versions || 1),
    fileId: asset.fileId || '',
    createdAt,
    updatedAt: Number(asset.updatedAt || createdAt),
    ts: new Date(createdAt).toLocaleString('zh-CN', { hour12: false }).slice(0, 16),
  }
}

async function loadRecentImages({ force = false } = {}) {
  const g = state.imagegen
  if (g.assetsLoading) return
  if (g.assetsLoaded && !force) return
  g.assetsLoading = true
  try {
    const res = await api('/api/images/recent?limit=30')
    if (!res.ok) throw new Error(res.body?.error || `读取最近图像失败（HTTP ${res.status}）`)
    g.shots = (Array.isArray(res.body?.assets) ? res.body.assets : []).map(imageShotFromAsset)
    g.assetsLoaded = true
  } catch (err) {
    g.shots = []
    g.assetsLoaded = true
    toast(err.message || '读取最近图像失败', true)
  } finally {
    g.assetsLoading = false
    if (state.view === 'imagegen') renderView()
  }
}

async function loadImageTemplates({ force = false } = {}) {
  const g = state.imagegen
  if (g.templatesLoading) return
  if (g.templatesLoaded && !force) return
  g.templatesLoading = true
  try {
    const res = await api('/api/images/templates')
    if (!res.ok) throw new Error(res.body?.error || `读取模板失败（HTTP ${res.status}）`)
    g.templates = Array.isArray(res.body?.templates) ? res.body.templates : []
    g.templatesLoaded = true
  } catch (err) {
    g.templates = []
    g.templatesLoaded = true
    toast(err.message || '读取模板失败', true)
  } finally {
    g.templatesLoading = false
    if (state.view === 'imagegen') renderView()
  }
}

async function loadImageTemplateApplications({ force = false } = {}) {
  const g = state.imagegen
  if (g.templateAppsLoading) return
  if (g.templateAppsLoaded && !force) return
  g.templateAppsLoading = true
  try {
    const res = await api('/api/images/template-applications')
    if (!res.ok) throw new Error(res.body?.error || `读取模板申请失败（HTTP ${res.status}）`)
    g.templateApps = Array.isArray(res.body?.applications) ? res.body.applications : []
    g.templateAppsLoaded = true
  } catch (err) {
    g.templateApps = []
    g.templateAppsLoaded = true
    toast(err.message || '读取模板申请失败', true)
  } finally {
    g.templateAppsLoading = false
    if (state.view === 'imagegen') renderView()
  }
}

function imageTemplateAdminVisible() {
  return Boolean((state.boot?.user?.visibleModules || []).includes('admin'))
}

function imageTemplatePendingCount() {
  return (state.imagegen.templateApps || []).filter((item) => item.status === 'pending').length
}


function renderImageReferenceChips(g) {
  const refs = Array.isArray(g.references) ? g.references : []
  if (!refs.length) return ''
  return refs.map((ref, index) => `
    <span class="img-ref-chip">
      <img src="${ref.url}" alt="">
      <span>参考 ${index + 1}</span>
      <button type="button" data-ref-remove="${esc(ref.id)}" aria-label="移除参考图">×</button>
    </span>`).join('')
}

function openImageReferencePicker() {
  const g = state.imagegen
  const shots = (g.shots || []).filter((shot) => shot.url)
  if (!shots.length) return toast('还没有可用于参考的已生成图像', true)
  const selected = new Set((g.references || []).map((item) => item.id))
  const mask = openModal('选择参考图', `
    <div class="form-note">最多选择 3 张已生成图像作为参考，可分别用于构图、风格、材质或建筑形态；参考图会随提示词一起发送给当前图像模型。</div>
    <div class="img-ref-picker">
      ${shots.map((shot) => `
        <button type="button" class="img-ref-choice${selected.has(shot.id) ? ' on' : ''}" data-ref-pick="${esc(shot.id)}" aria-pressed="${selected.has(shot.id)}">
          <img src="${shot.url}" alt="">
          <span>${esc(shot.style)} · ${esc(shot.ratio)}</span>
        </button>`).join('')}
    </div>
    <div class="img-edit-err" id="igRefErr"></div>
    <div class="img-edit-foot">
      <button class="btn" data-igrefcancel>返回</button>
      <button class="btn primary" id="igRefGo">使用参考图</button>
    </div>`, { wide: true })
  const err = mask.querySelector('#igRefErr')
  const choices = [...mask.querySelectorAll('[data-ref-pick]')]
  const paint = () => {
    choices.forEach((btn) => {
      const on = selected.has(btn.dataset.refPick)
      btn.classList.toggle('on', on)
      btn.setAttribute('aria-pressed', on ? 'true' : 'false')
    })
  }
  choices.forEach((btn) => btn.addEventListener('click', () => {
    const id = btn.dataset.refPick
    if (selected.has(id)) selected.delete(id)
    else if (selected.size >= 3) {
      err.textContent = '最多只能选择 3 张参考图'
      return
    } else selected.add(id)
    err.textContent = ''
    paint()
  }))
  mask.querySelector('[data-igrefcancel]').addEventListener('click', () => mask.remove())
  mask.querySelector('#igRefGo').addEventListener('click', () => {
    g.references = shots.filter((shot) => selected.has(shot.id)).map((shot) => ({ id: shot.id, url: shot.url, name: shot.name }))
    mask.remove()
    renderView()
  })
}

function openLocalImagePicker() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/png,image/jpeg,image/webp'
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    if (file) addLocalImageReference(file)
  })
  input.click()
}

async function addLocalImageReference(file) {
  const g = state.imagegen
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    return toast('参考图片只支持 PNG、JPEG 或 WebP', true)
  }
  if (file.size > 10 * 1024 * 1024) return toast('参考图片不能超过 10 MB', true)
  if ((g.references || []).length >= 3) return toast('最多只能添加 3 张参考图', true)
  try {
    const result = await readTemplateReference(file)
    g.references = [...(g.references || []), {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      url: result.dataUrl,
      name: file.name || '本地图片',
      local: true,
    }]
    renderView()
    toast('已添加本地图片作为参考')
  } catch (error) {
    toast(error?.message || '读取本地图片失败', true)
  }
}

function openImageCompare() {
  const g = state.imagegen
  const shots = (g.shots || []).filter((shot) => shot.url)
  if (shots.length < 2) return toast('至少需要两张图像才能并排对比', true)
  const selected = new Set(shots.slice(0, 2).map((shot) => shot.id))
  const mask = openModal('选择对比图像', `
    <div class="form-note">选择 2–3 张图像并排查看。对比不会生成新图，只读取当前已落库的版本文件。</div>
    <div class="img-ref-picker">
      ${shots.map((shot) => `
        <button type="button" class="img-ref-choice${selected.has(shot.id) ? ' on' : ''}" data-cmp-pick="${esc(shot.id)}" aria-pressed="${selected.has(shot.id)}">
          <img src="${shot.url}" alt="">
          <span>${esc(shot.style)} · ${esc(shot.ratio)}</span>
        </button>`).join('')}
    </div>
    <div class="img-edit-err" id="igCmpErr"></div>
    <div class="img-edit-foot">
      <button class="btn" data-igcmpcancel>返回</button>
      <button class="btn primary" id="igCmpGo">开始对比</button>
    </div>`, { wide: true })
  const err = mask.querySelector('#igCmpErr')
  const choices = [...mask.querySelectorAll('[data-cmp-pick]')]
  const paint = () => choices.forEach((btn) => {
    const on = selected.has(btn.dataset.cmpPick)
    btn.classList.toggle('on', on)
    btn.setAttribute('aria-pressed', on ? 'true' : 'false')
  })
  choices.forEach((btn) => btn.addEventListener('click', () => {
    const id = btn.dataset.cmpPick
    if (selected.has(id)) {
      if (selected.size <= 1) {
        err.textContent = '至少保留一张图像'
        return
      }
      selected.delete(id)
    } else if (selected.size >= 3) {
      err.textContent = '最多对比 3 张图像'
      return
    } else selected.add(id)
    err.textContent = ''
    paint()
  }))
  mask.querySelector('[data-igcmpcancel]').addEventListener('click', () => mask.remove())
  mask.querySelector('#igCmpGo').addEventListener('click', () => {
    if (selected.size < 2) {
      err.textContent = '请至少选择两张图像'
      return
    }
    const chosen = shots.filter((shot) => selected.has(shot.id))
    mask.remove()
    openModal('并排对比', `
      <div class="img-compare-grid" style="grid-template-columns:repeat(${chosen.length},minmax(0,1fr))">
        ${chosen.map((shot) => `
          <figure class="img-compare-card">
            <img src="${shot.url}" alt="">
            <figcaption>
              <div class="img-compare-title">${esc(shot.style)} · ${esc(shot.ratio)} · v${Number(shot.revision || 1)}</div>
              <div class="img-compare-prompt">${esc(shot.prompt || '')}</div>
            </figcaption>
          </figure>`).join('')}
      </div>
      <div class="form-note">对比只展示已落库版本，不改变当前版本，也不会生成新图。</div>`, { wide: true })
  })
}

function closeImageMenu() {
  document.querySelectorAll('.img-menu').forEach((menu) => menu.remove())
}

function downloadImageAsset(shot) {
  if (!shot?.url) return toast('这张图片没有可下载的文件', true)
  const a = document.createElement('a')
  a.href = shot.url
  a.download = shot.name || `jg-image-${shot.id}.png`
  document.body.appendChild(a)
  a.click()
  a.remove()
}

async function copyImagePrompt(shot) {
  const text = String(shot?.prompt || '')
  if (!text) return toast('这张图片没有记录提示词', true)
  try {
    await navigator.clipboard.writeText(text)
    toast('已复制提示词')
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0'
    document.body.appendChild(ta)
    ta.select()
    try { document.execCommand('copy'); toast('已复制提示词') } catch { toast('复制失败，请手动选择提示词', true) }
    ta.remove()
  }
}

async function openImageVersions(shot) {
  const res = await api(`/api/images/asset?id=${encodeURIComponent(shot.id)}`)
  if (!res.ok) return toast(res.body?.error || '读取版本历史失败', true)
  const asset = res.body?.asset
  const revisions = Array.isArray(asset?.revisions) ? asset.revisions : []
  if (!revisions.length) return toast('这张图片还没有版本记录', true)
  const mask = openModal('版本历史', `
    <div class="img-ver-head">${esc(asset.prompt)}</div>
    <div class="img-ver-list">
      ${revisions.map((rev) => `
        <div class="img-ver-row${rev.revision === asset.revision ? ' on' : ''}">
          <div class="img-ver-thumb"><img src="${rev.url}" alt="v${rev.revision}"></div>
          <div class="img-ver-main">
            <div class="img-ver-title">v${rev.revision}${rev.revision === asset.revision ? ' · 当前版本' : ''}</div>
            <div class="img-ver-meta">${esc(rev.style || '')} · ${esc(rev.ratio || '')} · ${esc(rev.providerLabel || rev.provider || '图像模型')} ${esc(rev.model || '')}</div>
            <div class="img-ver-prompt">${esc(rev.prompt || '')}</div>
          </div>
          <div class="img-ver-actions">
            <button class="btn sm" data-ver-dl="${rev.revision}">下载</button>
            ${rev.revision !== asset.revision ? `<button class="btn sm primary" data-ver-restore="${rev.revision}">恢复</button>` : ''}
          </div>
        </div>`).join('')}
    </div>
    <div class="form-note">恢复历史版本会创建一个新的当前版本，原版本记录不会被覆盖；局部选区编辑仍需模型原生 Mask 能力。</div>`, { wide: true })
  const current = revisions.find((rev) => rev.revision === asset.revision) || revisions[0]
  mask.querySelectorAll('[data-ver-dl]').forEach((btn) => btn.addEventListener('click', () => {
    const rev = revisions.find((item) => item.revision === Number(btn.dataset.verDl))
    if (rev) downloadImageAsset({ id: `v${rev.revision}`, url: rev.url, name: `jg-image-${shot.id}-v${rev.revision}.png` })
  }))
  mask.querySelectorAll('[data-ver-restore]').forEach((btn) => btn.addEventListener('click', async () => {
    const rev = revisions.find((item) => item.revision === Number(btn.dataset.verRestore))
    if (!rev) return
    btn.disabled = true
    btn.textContent = '恢复中…'
    const res = await api('/api/images/restore', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ assetId: shot.id, revision: rev.revision }),
    })
    if (!res.ok) {
      btn.disabled = false
      btn.textContent = '恢复'
      return toast(res.body?.error || '恢复版本失败', true)
    }
    mask.remove()
    toast(`已恢复到 v${rev.revision}，并生成新的当前版本`)
    await loadRecentImages({ force: true })
  }))
  if (current?.url) mask.querySelector('.img-ver-thumb img')?.setAttribute('alt', `v${current.revision}`)
}

function deleteImageAsset(shot) {
  const mask = openModal('删除图像', `
    <div class="confirm-text">确定删除这张图片？删除后不再出现在“最近生成”中，当前版本文件进入服务端回收状态。</div>
  `)
  const foot = document.createElement('div')
  foot.style.cssText = 'display:flex;gap:8px;margin-top:14px;justify-content:flex-end'
  foot.innerHTML = '<button class="btn" data-igcancel>返回</button><button class="btn primary" id="igDel">删除</button>'
  mask.querySelector('.jg-modal-body').appendChild(foot)
  foot.querySelector('[data-igcancel]').addEventListener('click', () => mask.remove())
  foot.querySelector('#igDel').addEventListener('click', async (e) => {
    const btn = e.currentTarget
    btn.disabled = true
    const res = await api('/api/images/delete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: shot.id }),
    })
    if (!res.ok) {
      btn.disabled = false
      return toast(res.body?.error || '删除失败', true)
    }
    state.imagegen.shots = state.imagegen.shots.filter((item) => item.id !== shot.id)
    mask.remove()
    renderView()
    toast('图像已删除')
  })
}

function editImageAsset(shot) {
  const model = imageEditModel()
  if (!model) return toast('当前没有可用的图像编辑模型', true)
  const mask = openModal('编辑图像', `
    <div class="img-edit-preview"><img src="${shot.url}" alt=""></div>
    <div class="field" style="margin-top:10px">
      <label class="field-label" for="igEditPrompt">编辑要求</label>
      <textarea class="img-edit-input" id="igEditPrompt" maxlength="1200" placeholder="例如：把建筑外墙改为浅色石材，保留现有构图、树木和天空"></textarea>
    </div>
    <div class="form-note">以当前图片为输入，由 ${esc(model.label)} 生成一个新版本；原图保留在版本历史中，不会覆盖。</div>
    <div class="img-edit-err" id="igEditErr"></div>
    <div class="img-edit-foot">
      <button class="btn" data-igeditcancel>返回</button>
      <button class="btn primary" id="igEditGo">生成新版本</button>
    </div>`, { wide: true })
  const input = mask.querySelector('#igEditPrompt')
  const err = mask.querySelector('#igEditErr')
  const go = mask.querySelector('#igEditGo')
  input.focus()
  mask.querySelector('[data-igeditcancel]').addEventListener('click', () => mask.remove())
  go.addEventListener('click', async () => {
    const prompt = input.value.trim()
    if (!prompt) {
      err.textContent = '请先填写编辑要求'
      input.focus()
      return
    }
    go.disabled = true
    go.textContent = '生成中…'
    err.textContent = ''
    try {
      const res = await api('/api/images/edit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ assetId: shot.id, prompt, modelId: model.id }),
      })
      if (!res.ok || !res.body?.image) {
        throw new Error(res.body?.error || `图像编辑失败（HTTP ${res.status}）`)
      }
      mask.remove()
      toast(`已生成新版本 v${res.body.image.revision}`)
      await loadRecentImages({ force: true })
    } catch (error) {
      go.disabled = false
      go.textContent = '生成新版本'
      err.textContent = error?.message || '图像编辑失败'
    }
  })
}

function openImageMenu(anchor, shot) {
  closeImageMenu()
  const editModel = imageEditModel()
  const menu = document.createElement('div')
  menu.className = 'img-menu'
  menu.innerHTML = `
    ${editModel ? '<button type="button" data-imenu="edit">编辑</button>' : ''}
    <button type="button" data-imenu="mask">局部选区</button>
    <button type="button" data-imenu="download">下载原图</button>
    <button type="button" data-imenu="copy">复制提示词</button>
    <button type="button" data-imenu="versions">版本历史</button>
    <button type="button" data-imenu="delete" class="danger">删除</button>`
  document.body.appendChild(menu)
  const rect = anchor.getBoundingClientRect()
  const width = menu.offsetWidth || 148
  const height = menu.offsetHeight || 156
  menu.style.left = `${Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width))}px`
  menu.style.top = `${Math.max(8, Math.min(window.innerHeight - height - 8, rect.bottom + 4))}px`
  const close = (e) => {
    if (menu.contains(e.target)) return
    menu.remove()
    document.removeEventListener('click', close, true)
    document.removeEventListener('scroll', close, true)
  }
  setTimeout(() => {
    document.addEventListener('click', close, true)
    document.addEventListener('scroll', close, true)
  }, 0)
  menu.querySelectorAll('[data-imenu]').forEach((btn) => btn.addEventListener('click', (e) => {
    e.stopPropagation()
    menu.remove()
    const action = btn.dataset.imenu
    if (action === 'edit') editImageAsset(shot)
    else if (action === 'mask') openImageMaskEditor(shot)
    else if (action === 'download') downloadImageAsset(shot)
    else if (action === 'copy') copyImagePrompt(shot)
    else if (action === 'versions') openImageVersions(shot)
    else if (action === 'delete') deleteImageAsset(shot)
  }))
}

function openImageMaskEditor(shot, opts = {}) {
  const erase = Boolean(opts.erase)
  const mask = openModal(erase ? '擦除' : '局部选区编辑', `
    <div class="form-note">${erase ? '涂抹要移除的物体或文字，白笔为擦除区、未涂抹为保留区。提交后由万相局部重绘用周围画面自然补全，并创建新版本。' : '用画笔涂抹要修改的区域，白色为编辑区、未涂抹为保留区。提交后由万相局部重绘生成新版本，原图保留在版本历史；这不是用提示词模拟的局部编辑。'}</div>
    <div class="img-mask-wrap">
      <div class="img-mask-stage">
        <img id="igMaskImg" src="${shot.url}" alt="">
        <canvas id="igMaskCanvas"></canvas>
      </div>
    </div>
    <div class="img-mask-tools">
      <button class="btn sm primary" type="button" data-mask-mode="brush">画笔</button>
      <button class="btn sm" type="button" data-mask-mode="eraser">橡皮</button>
      <label class="img-mask-size">笔刷 <input id="igMaskSize" type="range" min="6" max="72" value="26"></label>
      <button class="btn sm" type="button" id="igMaskClear">清除</button>
      <span class="img-mask-state" id="igMaskState">未标记</span>
    </div>
    <input class="img-edit-input" id="igMaskPrompt" placeholder="${erase ? '可补充要擦除的对象，例如：移除广告牌和地面上的文字' : '描述选区里要改成什么，例如：把这段外墙改成暖灰色石材'}" value="${erase ? '移除选区内的物体，并用周围背景自然补全，保持光影和材质连续' : ''}">
    <div class="img-edit-err" id="igMaskErr"></div>
    <div class="img-edit-foot">
      <button class="btn" type="button" id="igMaskCancel">返回</button>
      <button class="btn primary" type="button" id="igMaskGo">${erase ? '擦除并生成新版本' : '应用选区'}</button>
    </div>`, { wide: true })
  const img = mask.querySelector('#igMaskImg')
  const canvas = mask.querySelector('#igMaskCanvas')
  const size = mask.querySelector('#igMaskSize')
  const stateLabel = mask.querySelector('#igMaskState')
  const err = mask.querySelector('#igMaskErr')
  const go = mask.querySelector('#igMaskGo')
  const promptInput = mask.querySelector('#igMaskPrompt')
  let ctx = null
  let mode = 'brush'
  let drawing = false
  let last = null
  let hasInk = false
  const modeButtons = [...mask.querySelectorAll('[data-mask-mode]')]
  let pointerSeen = false
  const setupCanvas = () => {
    const width = Number(img.naturalWidth || 0)
    const height = Number(img.naturalHeight || 0)
    if (!width || !height) return
    canvas.width = width
    canvas.height = height
    ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, width, height)
  }
  if (img.complete && img.naturalWidth) setupCanvas()
  else img.addEventListener('load', setupCanvas, { once: true })
  const pointOf = (event) => {
    const rect = canvas.getBoundingClientRect()
    return {
      x: (event.clientX - rect.left) / rect.width * canvas.width,
      y: (event.clientY - rect.top) / rect.height * canvas.height,
      scale: canvas.width / rect.width,
    }
  }
  const paint = (from, to, scale) => {
    if (!ctx) return
    const lineWidth = Math.max(2, Number(size.value) * scale)
    ctx.save()
    ctx.globalCompositeOperation = mode === 'eraser' ? 'destination-out' : 'source-over'
    ctx.strokeStyle = '#ffffff'
    ctx.fillStyle = '#ffffff'
    ctx.lineWidth = lineWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (from) {
      ctx.beginPath()
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(to.x, to.y)
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.arc(to.x, to.y, lineWidth / 2, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
    hasInk = true
    stateLabel.textContent = '已标记'
  }
  canvas.addEventListener('pointerdown', (event) => {
    if (!ctx) return
    pointerSeen = true
    event.preventDefault()
    drawing = true
    last = pointOf(event)
    canvas.setPointerCapture?.(event.pointerId)
    paint(null, last, last.scale)
  })
  canvas.addEventListener('pointermove', (event) => {
    if (!drawing || !ctx) return
    event.preventDefault()
    const next = pointOf(event)
    paint(last, next, next.scale)
    last = next
  })
  const end = () => { drawing = false; last = null }
  canvas.addEventListener('pointerup', end)
  canvas.addEventListener('pointercancel', end)
  canvas.addEventListener('pointerleave', end)
  canvas.addEventListener('dragstart', (event) => event.preventDefault())
  canvas.addEventListener('mousedown', (event) => {
    if (pointerSeen || !ctx) return
    event.preventDefault()
    drawing = true
    last = pointOf(event)
    paint(null, last, last.scale)
  })
  canvas.addEventListener('mousemove', (event) => {
    if (pointerSeen || !drawing || !ctx) return
    event.preventDefault()
    const next = pointOf(event)
    paint(last, next, next.scale)
    last = next
  })
  canvas.addEventListener('mouseup', end)
  canvas.addEventListener('mouseleave', end)
  modeButtons.forEach((btn) => btn.addEventListener('click', () => {
    mode = btn.dataset.maskMode
    modeButtons.forEach((item) => item.classList.toggle('primary', item === btn))
  }))
  mask.querySelector('#igMaskClear').addEventListener('click', () => {
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    hasInk = false
    stateLabel.textContent = '未标记'
    err.textContent = ''
  })
  mask.querySelector('#igMaskCancel').addEventListener('click', () => mask.remove())
  go.addEventListener('click', async () => {
    err.textContent = ''
    if (!ctx || !canvas.width) return (err.textContent = '图片还没有加载完成')
    if (!hasInk) return (err.textContent = '请先在图片上涂抹要修改的区域')
    const prompt = String(promptInput.value || '').trim()
    if (!prompt) return (err.textContent = '请描述选区里要改成什么')
    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = canvas.width
    exportCanvas.height = canvas.height
    const exportCtx = exportCanvas.getContext('2d')
    exportCtx.fillStyle = '#000000'
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)
    exportCtx.drawImage(canvas, 0, 0)
    const maskDataUrl = exportCanvas.toDataURL('image/png')
    go.disabled = true
    go.textContent = '提交中…'
    try {
      const res = await api('/api/images/mask-edit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ assetId: shot.id, prompt, maskDataUrl }),
      })
      if (!res.ok) throw new Error(res.body?.error || `局部选区编辑失败（HTTP ${res.status}）`)
      const next = imageShotFromAsset(res.body.image)
      mergeRecentImage(next)
      mask.remove()
      toast(erase ? `已擦除选区并生成版本 v${res.body.image.revision}` : `已生成局部编辑版本 v${res.body.image.revision}`)
      renderView()
      if (typeof opts.after === 'function') opts.after(next)
    } catch (error) {
      go.disabled = false
      go.textContent = erase ? '擦除并生成新版本' : '应用选区'
      err.textContent = error?.message || '局部选区编辑失败'
    }
  })
}

function readTemplateReference(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      try {
        const maxEdge = 1280
        const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth || 1, image.naturalHeight || 1))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round((image.naturalWidth || 1) * scale))
        canvas.height = Math.max(1, Math.round((image.naturalHeight || 1) * scale))
        const ctx = canvas.getContext('2d')
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
        const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
        resolve({ dataUrl: canvas.toDataURL(mime, 0.9), width: canvas.width, height: canvas.height })
      } catch (error) {
        reject(error)
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
    }
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('读取参考照片失败')) }
    image.src = objectUrl
  })
}

function imageTemplateTabs(g) {
  const active = g.tab === 'mine' ? 'mine' : 'templates'
  return `
    <div class="img-tabs" role="tablist" aria-label="图像模块">
      <button type="button" class="img-tab${active === 'templates' ? ' on' : ''}" data-igtab="templates" role="tab" aria-selected="${active === 'templates'}">模板<span class="img-tab-count">${imageTemplateTabCount()}</span></button>
      <button type="button" class="img-tab${active === 'mine' ? ' on' : ''}" data-igtab="mine" role="tab" aria-selected="${active === 'mine'}">我的图像<span class="img-tab-count">${(g.shots || []).length}</span></button>
    </div>`
}

function imageTemplateActions() {
  const g = state.imagegen
  const userName = String(state.boot?.user?.name || '')
  const mine = (g.templateApps || []).filter((item) => item.applicant === userName)
  const pending = imageTemplatePendingCount()
  const admin = imageTemplateAdminVisible()
  return `
    <div class="img-tpl-actions">
      <button type="button" class="btn sm" id="igTplApply">申请成为模板</button>
      <button type="button" class="btn sm" id="igTplMine">我的申请${mine.length ? ` · ${mine.length}` : ''}</button>
      ${admin ? `<button type="button" class="btn sm img-tpl-review-open" id="igTplReview">审核申请${pending ? ` · ${pending}` : ''}</button>` : ''}
    </div>`
}

function imageTemplateGrid(g) {
  const templates = Array.isArray(g.templates) ? g.templates : []
  if (g.templatesLoading || !g.templatesLoaded) {
    return '<div class="img-tpl-empty"><div class="img-loading">正在读取已上线模板…</div></div>'
  }
  if (!templates.length) {
    return `
      <div class="img-tpl-empty">
        <div class="img-tpl-empty-icon">${icon('grid')}</div>
        <div class="img-tpl-empty-title">还没有已上线的模板</div>
        <div class="img-tpl-empty-text">模板由用户提交提示词与预览图，经管理员审核通过后才会出现在这里。你可以在右上方申请成为模板。</div>
      </div>`
  }
  return `
    <div class="img-tpl-grid">
      ${templates.map((tpl) => `
        <button type="button" class="img-tpl-card" data-tpl="${esc(tpl.id)}" aria-label="打开模板：${esc(tpl.title)}">
          <img src="${esc(tpl.previewUrl)}" alt="${esc(tpl.title)}模板预览" loading="lazy">
          <span class="img-tpl-shade"></span>
          <span class="img-tpl-name">${esc(tpl.title)}</span>
          <span class="img-tpl-tag">${esc(tpl.category)}</span>
        </button>`).join('')}
    </div>`
}

function bindImageTemplateActions(root) {
  root.querySelectorAll('[data-tpl]').forEach((btn) => btn.addEventListener('click', () => openImageTemplate(btn.dataset.tpl)))
  root.querySelector('#igTplApply')?.addEventListener('click', () => openImageTemplateApplication())
  root.querySelector('#igTplMine')?.addEventListener('click', () => openImageTemplateApplications('mine'))
  root.querySelector('#igTplReview')?.addEventListener('click', () => openImageTemplateApplications('review'))
}

function openImageTemplateApplication() {
  let previewDataUrl = ''
  let previewName = ''
  const mask = openModal('申请成为模板', `
    <div class="form-note">提交后进入管理员审核队列，审核通过后才会出现在模板页。请填写真实的提示词，并上传一张能代表模板效果的预览图。</div>
    <div class="img-tpl-app-form">
      <label>模板名称<input id="igTplAppName" maxlength="40" placeholder="例如：城市夜景海报"></label>
      <label>分类<select id="igTplAppCategory">${IMAGE_TEMPLATE_CATEGORIES.map((item) => `<option value="${esc(item)}">${esc(item)}</option>`).join('')}</select></label>
      <label>宽高比例<select id="igTplAppRatio">${['1:1', '3:4', '9:16', '4:3', '16:9'].map((item) => `<option value="${item}">${item}</option>`).join('')}</select></label>
      <label class="img-tpl-app-wide">提示词<textarea id="igTplAppPrompt" maxlength="2000" placeholder="描述模板的构图、主体、风格、光线和画面用途"></textarea></label>
      <label class="img-tpl-app-wide">说明（可选）<textarea id="igTplAppDesc" maxlength="800" placeholder="说明这个模板适合什么场景"></textarea></label>
      <div class="img-tpl-app-wide">
        <div class="img-tpl-upload-label">预览图 <span>必填</span></div>
        <div class="img-tpl-upload-wrap">
          <button type="button" class="img-tpl-upload" id="igTplAppUpload" aria-label="上传模板预览图">+</button>
          <div class="img-tpl-ref" id="igTplAppPreview" hidden>
            <img id="igTplAppPreviewImg" alt="模板预览图">
            <button type="button" class="img-tpl-ref-x" id="igTplAppPreviewX" aria-label="移除预览图">×</button>
          </div>
        </div>
        <input id="igTplAppFile" type="file" accept="image/png,image/jpeg,image/webp" hidden>
        <div class="img-tpl-note">预览图会用于模板卡片；建议使用与模板效果一致的竖版或方版画面。</div>
      </div>
    </div>
    <div class="img-edit-err" id="igTplAppErr"></div>
    <div class="img-edit-foot">
      <button class="btn" data-tplappcancel>取消</button>
      <button class="btn primary" id="igTplAppGo">提交审核</button>
    </div>`, { wide: true })
  const name = mask.querySelector('#igTplAppName')
  const category = mask.querySelector('#igTplAppCategory')
  const ratio = mask.querySelector('#igTplAppRatio')
  const prompt = mask.querySelector('#igTplAppPrompt')
  const desc = mask.querySelector('#igTplAppDesc')
  const file = mask.querySelector('#igTplAppFile')
  const upload = mask.querySelector('#igTplAppUpload')
  const preview = mask.querySelector('#igTplAppPreview')
  const previewImg = mask.querySelector('#igTplAppPreviewImg')
  const err = mask.querySelector('#igTplAppErr')
  const go = mask.querySelector('#igTplAppGo')
  upload.addEventListener('click', () => file.click())
  file.addEventListener('change', () => {
    const chosen = file.files?.[0]
    if (!chosen) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(chosen.type)) {
      err.textContent = '预览图只支持 PNG、JPEG 或 WebP'
      file.value = ''
      return
    }
    if (chosen.size > 10 * 1024 * 1024) {
      err.textContent = '预览图不能超过 10 MB'
      file.value = ''
      return
    }
    readTemplateReference(chosen).then((result) => {
      previewDataUrl = result.dataUrl
      previewName = chosen.name || '模板预览图'
      previewImg.src = previewDataUrl
      preview.hidden = false
      upload.classList.add('has-ref')
      err.textContent = ''
    }).catch((error) => {
      err.textContent = error?.message || '读取预览图失败，请重试'
    }).finally(() => { file.value = '' })
  })
  mask.querySelector('#igTplAppPreviewX').addEventListener('click', () => {
    previewDataUrl = ''
    previewName = ''
    preview.hidden = true
    previewImg.removeAttribute('src')
    upload.classList.remove('has-ref')
    file.value = ''
  })
  mask.querySelector('[data-tplappcancel]').addEventListener('click', () => mask.remove())
  go.addEventListener('click', async () => {
    const title = name.value.trim()
    const cat = category.value
    const ratioValue = ratio.value
    const promptValue = prompt.value.trim()
    if (!title) { err.textContent = '请填写模板名称'; name.focus(); return }
    if (!promptValue) { err.textContent = '请填写模板提示词'; prompt.focus(); return }
    if (!previewDataUrl) { err.textContent = '请上传一张模板预览图'; return }
    go.disabled = true
    go.textContent = '提交中…'
    try {
      const res = await api('/api/images/template-applications', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title,
          category: cat,
          ratio: ratioValue,
          prompt: promptValue,
          description: desc.value.trim(),
          previewDataUrl,
          previewName,
        }),
      })
      if (!res.ok || !res.body?.application) throw new Error(res.body?.error || `提交申请失败（HTTP ${res.status}）`)
      const g = state.imagegen
      g.templateApps = [res.body.application, ...(g.templateApps || [])]
      g.templateAppsLoaded = true
      mask.remove()
      renderView()
      toast('模板申请已提交，管理员审核通过后会上线')
    } catch (error) {
      go.disabled = false
      go.textContent = '提交审核'
      err.textContent = error?.message || '提交申请失败'
    }
  })
}

async function openImageTemplateApplications(mode = 'mine') {
  const g = state.imagegen
  if (!g.templateAppsLoaded) await loadImageTemplateApplications()
  const apps = Array.isArray(g.templateApps) ? g.templateApps : []
  const admin = mode === 'review' && imageTemplateAdminVisible()
  const statusText = { pending: '待审核', approved: '已通过', rejected: '已驳回' }
  const visibleApps = admin ? apps : apps.filter((item) => item.applicant === state.boot?.user?.name)
  const mask = openModal(admin ? '模板申请审核' : '我的模板申请', `
    <div class="form-note">${admin ? '审核通过后模板会立即对所有人上线；驳回时可填写原因，申请人可在“我的申请”中查看。' : '这里显示你提交过的模板申请及审核状态。'}</div>
    ${visibleApps.length ? visibleApps.map((item) => `
      <article class="img-tpl-app" data-tpl-app-row="${esc(item.id)}">
        <img src="${esc(item.previewUrl)}" alt="${esc(item.title)}预览">
        <div class="img-tpl-app-main">
          <div class="img-tpl-app-head"><b>${esc(item.title)}</b><span class="img-tpl-app-status ${esc(item.status)}">${esc(statusText[item.status] || item.status)}</span></div>
          <div class="img-tpl-app-meta">${esc(item.applicant)} · ${esc(item.category)} · ${esc(item.ratio)} · ${esc(new Date(item.createdAt).toLocaleString('zh-CN', { hour12: false }).slice(0, 16))}</div>
          <div class="img-tpl-app-prompt">${esc(item.prompt)}</div>
          ${item.description ? `<div class="img-tpl-app-desc">${esc(item.description)}</div>` : ''}
          ${item.status === 'rejected' && item.reviewNote ? `<div class="img-edit-err">驳回原因：${esc(item.reviewNote)}</div>` : ''}
          ${admin && item.status === 'pending' ? `
            <div class="img-tpl-app-review">
              <input data-tpl-note placeholder="驳回原因（可选）" maxlength="300">
              <button type="button" class="btn sm" data-tpl-review="reject">驳回</button>
              <button type="button" class="btn primary sm" data-tpl-review="approve">通过</button>
            </div>` : ''}
        </div>
      </article>`).join('') : '<div class="img-tpl-empty"><div class="img-tpl-empty-title">还没有模板申请</div><div class="img-tpl-empty-text">去模板页提交第一个申请。</div></div>'}
    `, { wide: true })
  mask.querySelectorAll('[data-tpl-review]').forEach((btn) => btn.addEventListener('click', async () => {
    const row = btn.closest('[data-tpl-app-row]')
    const id = row?.dataset.tplAppRow
    if (!id) return
    const note = row.querySelector('[data-tpl-note]')?.value.trim() || ''
    const decision = btn.dataset.tplReview
    row.querySelectorAll('[data-tpl-review]').forEach((item) => { item.disabled = true })
    try {
      const res = await api('/api/images/template-review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, decision, note }),
      })
      if (!res.ok || !res.body?.application) throw new Error(res.body?.error || `审核失败（HTTP ${res.status}）`)
      const updated = res.body.application
      g.templateApps = (g.templateApps || []).map((item) => item.id === updated.id ? updated : item)
      mask.remove()
      if (decision === 'approve') {
        g.templatesLoaded = false
        await loadImageTemplates({ force: true })
        toast(`模板「${updated.title}」已上线`)
      } else {
        renderView()
        toast('已驳回模板申请')
      }
    } catch (error) {
      row.querySelectorAll('[data-tpl-review]').forEach((item) => { item.disabled = false })
      toast(error?.message || '审核失败', true)
    }
  }))
}

function openImageTemplate(templateId) {
  const tpl = imageTemplateById(templateId)
  if (!tpl) return
  const g = state.imagegen
  const templateTitle = tpl.title || '模板'
  const category = tpl.category || '模板'
  const description = tpl.description || tpl.prompt || '暂无说明'
  const defaultRatio = ['1:1', '3:4', '9:16', '4:3', '16:9'].includes(tpl.ratio) ? tpl.ratio : '1:1'
  let ratio = 'auto'
  let referenceDataUrl = ''
  const mask = openModal(templateTitle, `
    <div class="img-tpl-detail">
      <div class="img-tpl-detail-art"><img src="${esc(tpl.previewUrl || '')}" alt="${esc(templateTitle)}模板预览"></div>
      <div class="img-tpl-detail-info">
        <div class="img-tpl-kicker">${esc(category)}</div>
        <div class="img-tpl-title">${esc(templateTitle)}</div>
        <div class="img-tpl-desc" id="igTplDesc">${esc(description)}</div>
        <button type="button" class="img-tpl-more" id="igTplMore">展开更多</button>
        <div class="img-tpl-row">
          <label for="igTplRatio">宽高比例</label>
          <select id="igTplRatio" aria-label="宽高比例">
            <option value="auto">自动</option>
            ${['1:1', '3:4', '9:16', '4:3', '16:9'].map((item) => `<option value="${item}">${item}${item === defaultRatio ? ' · 模板默认' : ''}</option>`).join('')}
          </select>
        </div>
        <div class="img-tpl-upload-label">上传参考照片 <span>可选</span></div>
        <div class="img-tpl-upload-wrap">
          <button type="button" class="img-tpl-upload" id="igTplUpload" aria-label="上传参考照片">+</button>
          <div class="img-tpl-ref" id="igTplRef" hidden>
            <img id="igTplRefImg" alt="参考照片">
            <button type="button" class="img-tpl-ref-x" id="igTplRefX" aria-label="移除参考照片">×</button>
          </div>
        </div>
        <input id="igTplFile" type="file" accept="image/png,image/jpeg,image/webp" hidden>
        <div class="img-tpl-note">参考照片会作为图1提交，帮助模型保留人物、产品或已有外观；不上传也能直接生成。</div>
        <div class="img-edit-err" id="igTplErr"></div>
        <div class="img-tpl-foot">
          <button type="button" class="btn primary" id="igTplTry">试一试</button>
        </div>
      </div>
    </div>`, { wide: true })

  const desc = mask.querySelector('#igTplDesc')
  const more = mask.querySelector('#igTplMore')
  const ratioSelect = mask.querySelector('#igTplRatio')
  const file = mask.querySelector('#igTplFile')
  const upload = mask.querySelector('#igTplUpload')
  const ref = mask.querySelector('#igTplRef')
  const refImg = mask.querySelector('#igTplRefImg')
  const err = mask.querySelector('#igTplErr')
  const tryBtn = mask.querySelector('#igTplTry')
  ratioSelect.value = ratio
  if (description.length > 72) desc.classList.add('clamp')
  else more.hidden = true
  more.addEventListener('click', () => {
    const clamped = desc.classList.toggle('clamp')
    more.textContent = clamped ? '展开更多' : '收起'
  })
  ratioSelect.addEventListener('change', () => { ratio = ratioSelect.value })
  upload.addEventListener('click', () => file.click())
  file.addEventListener('change', () => {
    const chosen = file.files?.[0]
    if (!chosen) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(chosen.type)) {
      err.textContent = '参考照片只支持 PNG、JPEG 或 WebP'
      file.value = ''
      return
    }
    if (chosen.size > 10 * 1024 * 1024) {
      err.textContent = '参考照片不能超过 10 MB'
      file.value = ''
      return
    }
    readTemplateReference(chosen).then((result) => {
      referenceDataUrl = result.dataUrl
      refImg.src = referenceDataUrl
      ref.hidden = false
      upload.classList.add('has-ref')
      err.textContent = ''
    }).catch((error) => {
      err.textContent = error?.message || '读取参考照片失败，请重试'
    }).finally(() => { file.value = '' })
  })
  mask.querySelector('#igTplRefX').addEventListener('click', () => {
    referenceDataUrl = ''
    ref.hidden = true
    refImg.removeAttribute('src')
    upload.classList.remove('has-ref')
    file.value = ''
  })
  tryBtn.addEventListener('click', async () => {
    const selectedRatio = ratio === 'auto' ? defaultRatio : ratio
    const visualPrompt = referenceDataUrl
      ? `${tpl.prompt}。以图1作为参考，保留其中主体的人物、产品或关键外观，不要替换身份和主要细节`
      : tpl.prompt
    tryBtn.disabled = true
    tryBtn.textContent = '生成中…'
    upload.disabled = true
    ratioSelect.disabled = true
    err.textContent = ''
    try {
      const res = await api('/api/images/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt: visualPrompt,
          style: category,
          ratio: selectedRatio,
          modelId: g.modelId || selectedImageModel()?.id || '',
          referenceDataUrls: referenceDataUrl ? [referenceDataUrl] : [],
          seed: Math.floor(Math.random() * 2_147_483_647),
        }),
      })
      if (!res.ok || !res.body?.image?.url) throw new Error(res.body?.error || `模板生成失败（HTTP ${res.status}）`)
      const shot = imageShotFromAsset(res.body.image)
      g.shots = [shot, ...(g.shots || []).filter((item) => item.id !== shot.id)]
      g.assetsLoaded = true
      g.tab = 'mine'
      g.prompt = visualPrompt
      mask.remove()
      renderView()
      toast(`已用「${templateTitle}」模板生成一张图像，已保存到我的图像`)
      setTimeout(() => openImageWorkbench(shot), 60)
    } catch (error) {
      tryBtn.disabled = false
      tryBtn.textContent = '试一试'
      upload.disabled = false
      ratioSelect.disabled = false
      err.textContent = error?.message || '模板生成失败'
    }
  })
}
function mergeRecentImage(shot) {
  const g = state.imagegen
  const index = (g.shots || []).findIndex((item) => item.id === shot.id)
  if (index >= 0) g.shots[index] = { ...g.shots[index], ...shot }
  else g.shots = [shot, ...(g.shots || [])]
  g.assetsLoaded = true
}

function wbIcon(name) {
  const icons = {
    dots: '<circle cx="5" cy="8" r="1"/><circle cx="8" cy="8" r="1"/><circle cx="11" cy="8" r="1"/>',
    annotate: '<path d="M3 13.5V10l8.5-7 3.5 3.5-7 8.5H4.5"/><path d="M10 4.5l3.5 3.5"/>',
    comment: '<path d="M3.5 4.5h9v6H7l-3.5 3v-3H3.5z"/>',
    bg: '<path d="M4 3.5h8v9H4z"/><path d="M4 8.5l3-2 3 2 2-1.5"/><circle cx="9.5" cy="6" r="1"/>',
    erase: '<path d="M7 14.5l-3-3 7-7 5 5-5 5z"/><path d="M8 16.5h6"/>',
    resize: '<path d="M3.5 6V3.5h6"/><path d="M12.5 10v2.5h-6"/><path d="M10 3.5h2.5V6"/>',
  }
  return `<svg viewBox="0 0 16 16" aria-hidden="true">${icons[name] || ''}</svg>`
}

function openImageWorkbench(shot) {
  if (!shot?.url) return
  const mask = openModal('图像编辑', `
    <div class="img-wb" id="imgWb">
      <div class="img-wb-stage">
        <img id="imgWbImg" src="${shot.url}" alt="">
        <div class="img-wb-status" id="imgWbStatus" hidden></div>
      </div>
      <div class="img-wb-toolbar" role="toolbar" aria-label="图像编辑工具">
        <button type="button" class="img-wb-dot" data-wb="more" aria-label="更多操作">${wbIcon('dots')}</button>
        <button type="button" data-wb="annotate">${wbIcon('annotate')}<span>标注</span></button>
        <button type="button" data-wb="comment">${wbIcon('comment')}<span>添加评论</span></button>
        <button type="button" data-wb="removebg">${wbIcon('bg')}<span>移除背景</span></button>
        <button type="button" data-wb="erase">${wbIcon('erase')}<span>擦除</span></button>
        <button type="button" data-wb="resize">${wbIcon('resize')}<span>调整大小</span></button>
      </div>
      <div class="img-wb-more" id="imgWbMore" hidden>
        <button type="button" data-wbmore="edit">提示词编辑</button>
        <button type="button" data-wbmore="versions">版本历史</button>
        <button type="button" data-wbmore="download">下载原图</button>
        <button type="button" data-wbmore="usechat">用于会话</button>
        <button type="button" data-wbmore="delete" class="danger">删除</button>
      </div>
      <aside class="img-wb-side" id="imgWbSide" hidden>
        <div class="img-wb-side-head"><div><b>评论</b><span id="imgWbCommentCount"></span></div><button type="button" class="img-wb-side-x" id="imgWbSideX" aria-label="关闭评论">×</button></div>
        <div class="img-wb-comments" id="imgWbComments"><div class="img-wb-empty">还没有评论</div></div>
        <textarea id="imgWbCommentInput" maxlength="500" placeholder="写下对这张图的修改意见或备注…"></textarea>
        <div class="img-wb-side-foot"><span class="img-edit-err" id="imgWbCommentErr"></span><button type="button" class="btn primary" id="imgWbCommentGo">发表评论</button></div>
      </aside>
    </div>`, { wide: true })
  const body = mask.querySelector('.jg-modal-body')
  body.classList.add('img-wb-body')
  const status = mask.querySelector('#imgWbStatus')
  const side = mask.querySelector('#imgWbSide')
  const morePanel = mask.querySelector('#imgWbMore')
  const setStatus = (text, busy = true) => {
    status.hidden = false
    status.textContent = text
    status.classList.toggle('busy', busy)
  }
  const clearStatus = () => { status.hidden = true; status.textContent = '' }

  const renderComments = async () => {
    const list = mask.querySelector('#imgWbComments')
    const count = mask.querySelector('#imgWbCommentCount')
    const res = await api(`/api/images/comments?assetId=${encodeURIComponent(shot.id)}`)
    if (!res.ok) {
      list.innerHTML = `<div class="img-wb-empty">评论读取失败：${esc(res.body?.error || res.status)}</div>`
      return
    }
    const comments = Array.isArray(res.body?.comments) ? res.body.comments : []
    count.textContent = comments.length ? ` · ${comments.length}` : ''
    list.innerHTML = comments.length ? comments.map((item) => `
      <div class="img-wb-comment">
        <div class="img-wb-comment-head"><span class="img-wb-avatar">${esc(String(item.owner || '我').slice(0, 1))}</span><span>${esc(item.owner || '我')}</span><span>${esc(new Date(item.createdAt).toLocaleString('zh-CN', { hour12: false }).slice(0, 16))}</span></div>
        <div class="img-wb-comment-body">${esc(item.body)}</div>
      </div>`).join('') : '<div class="img-wb-empty">还没有评论，写下第一条修改意见</div>'
  }
  const openComments = async () => {
    side.hidden = false
    await renderComments()
    mask.querySelector('#imgWbCommentInput').focus()
  }
  mask.querySelector('#imgWbSideX').addEventListener('click', () => { side.hidden = true })
  mask.querySelector('#imgWbCommentGo').addEventListener('click', async (event) => {
    const btn = event.currentTarget
    const input = mask.querySelector('#imgWbCommentInput')
    const err = mask.querySelector('#imgWbCommentErr')
    const text = input.value.trim()
    if (!text) { err.textContent = '请先写评论'; input.focus(); return }
    btn.disabled = true
    const res = await api('/api/images/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ assetId: shot.id, body: text }),
    })
    btn.disabled = false
    if (!res.ok) { err.textContent = res.body?.error || '评论失败'; return }
    input.value = ''
    err.textContent = ''
    await renderComments()
  })

  mask.querySelectorAll('[data-wb]').forEach((btn) => btn.addEventListener('click', async (event) => {
    const action = btn.dataset.wb
    if (action === 'more') {
      morePanel.hidden = !morePanel.hidden
      return
    }
    if (action === 'comment') { await openComments(); return }
    if (action === 'annotate') { mask.remove(); openImageAnnotator(shot); return }
    if (action === 'resize') { mask.remove(); openImageResize(shot); return }
    if (action === 'erase') { mask.remove(); openImageMaskEditor(shot, { erase: true }); return }
    if (action === 'removebg') {
      btn.disabled = true
      setStatus('正在移除背景，结果会创建新版本…')
      try {
        const res = await api('/api/images/remove-bg', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ assetId: shot.id, scene: 'general' }),
        })
        if (!res.ok || !res.body?.image) throw new Error(res.body?.error || `移除背景失败（HTTP ${res.status}）`)
        const next = imageShotFromAsset(res.body.image)
        mergeRecentImage(next)
        mask.remove()
        renderView()
        toast('已移除背景并创建新版本')
        setTimeout(() => openImageWorkbench(next), 60)
      } catch (error) {
        btn.disabled = false
        setStatus(error?.message || '移除背景失败', false)
      }
    }
  }))
  mask.querySelectorAll('[data-wbmore]').forEach((btn) => btn.addEventListener('click', () => {
    const action = btn.dataset.wbmore
    mask.remove()
    if (action === 'edit') editImageAsset(shot)
    else if (action === 'versions') openImageVersions(shot)
    else if (action === 'download') downloadImageAsset(shot)
    else if (action === 'usechat') useImageInChat(shot)
    else if (action === 'delete') deleteImageAsset(shot)
  }))
  mask.addEventListener('click', (event) => {
    if (!morePanel.hidden && !morePanel.contains(event.target) && !event.target.closest('[data-wb="more"]')) morePanel.hidden = true
  })
}

async function useImageInChat(shot) {
  try {
    const blob = await (await fetch(shot.url)).blob()
    const file = new File([blob], shot.name || `jg-image-${shot.id}.png`, { type: blob.type || shot.mime || 'image/png' })
    const uploaded = await uploadBinaryFile(file, 'chat')
    if (!uploaded.ok) { toast(uploaded.body?.error || '图像上传失败', true); return }
    addComposerRef({ kind: 'file', id: uploaded.file.id, label: file.name })
    state.view = 'chat'
    state.conversation = null
    state.draft = `我生成了一张图像（${shot.style}${shot.ratio}，提示词：${shot.prompt}），请基于它整理一段汇报说明。`
    render()
    toast('图像已加入本轮附件')
  } catch (error) {
    toast(error?.message || '图像处理失败', true)
  }
}

function openImageAnnotator(shot) {
  const mask = openModal('标注', `
    <div class="form-note">在图片上画红色标记，保存后会与当前版本合成并创建新版本；原版本保留在版本历史中。</div>
    <div class="img-annot-stage">
      <div class="img-annot-frame">
        <img id="imgAnnotImg" src="${shot.url}" alt="">
        <canvas id="imgAnnotCanvas"></canvas>
      </div>
    </div>
    <div class="img-annot-tools">
      <label class="img-mask-size">笔刷 <input id="imgAnnotSize" type="range" min="2" max="24" value="6"></label>
      <button type="button" class="btn sm" id="imgAnnotClear">清除</button>
      <span class="img-mask-state" id="imgAnnotState">未标注</span>
      <button type="button" class="btn primary" id="imgAnnotSave">保存标注</button>
    </div>
    <div class="img-edit-err" id="imgAnnotErr"></div>`, { wide: true })
  const img = mask.querySelector('#imgAnnotImg')
  const canvas = mask.querySelector('#imgAnnotCanvas')
  const size = mask.querySelector('#imgAnnotSize')
  const stateLabel = mask.querySelector('#imgAnnotState')
  const err = mask.querySelector('#imgAnnotErr')
  const save = mask.querySelector('#imgAnnotSave')
  let ctx = null
  let drawing = false
  let last = null
  let hasInk = false
  let pointerSeen = false
  const setup = () => {
    if (!img.naturalWidth || !img.naturalHeight) return
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }
  if (img.complete && img.naturalWidth) setup()
  else img.addEventListener('load', setup, { once: true })
  const pointOf = (event) => {
    const rect = canvas.getBoundingClientRect()
    return { x: (event.clientX - rect.left) / rect.width * canvas.width, y: (event.clientY - rect.top) / rect.height * canvas.height, scale: canvas.width / rect.width }
  }
  const paint = (from, to) => {
    if (!ctx) return
    ctx.save()
    ctx.strokeStyle = 'rgba(217, 45, 32, .9)'
    ctx.fillStyle = 'rgba(217, 45, 32, .9)'
    ctx.lineWidth = Math.max(2, Number(size.value) * to.scale)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (from) {
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke()
    } else {
      ctx.beginPath(); ctx.arc(to.x, to.y, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
    hasInk = true
    stateLabel.textContent = '已标注'
  }
  canvas.addEventListener('pointerdown', (event) => {
    if (!ctx) return
    pointerSeen = true; event.preventDefault(); drawing = true; last = pointOf(event)
    canvas.setPointerCapture?.(event.pointerId); paint(null, last)
  })
  canvas.addEventListener('pointermove', (event) => {
    if (!drawing || !ctx) return
    event.preventDefault(); const next = pointOf(event); paint(last, next); last = next
  })
  const end = () => { drawing = false; last = null }
  canvas.addEventListener('pointerup', end)
  canvas.addEventListener('pointercancel', end)
  canvas.addEventListener('pointerleave', end)
  canvas.addEventListener('dragstart', (event) => event.preventDefault())
  canvas.addEventListener('mousedown', (event) => {
    if (pointerSeen || !ctx) return
    event.preventDefault(); drawing = true; last = pointOf(event); paint(null, last)
  })
  canvas.addEventListener('mousemove', (event) => {
    if (pointerSeen || !drawing || !ctx) return
    event.preventDefault(); const next = pointOf(event); paint(last, next); last = next
  })
  canvas.addEventListener('mouseup', end)
  canvas.addEventListener('mouseleave', end)
  mask.querySelector('#imgAnnotClear').addEventListener('click', () => {
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    hasInk = false
    stateLabel.textContent = '未标注'
    err.textContent = ''
  })
  save.addEventListener('click', async () => {
    if (!ctx || !canvas.width) return (err.textContent = '图片还没有加载完成')
    if (!hasInk) return (err.textContent = '请先在图片上画标记')
    save.disabled = true
    save.textContent = '保存中…'
    try {
      const out = document.createElement('canvas')
      out.width = canvas.width
      out.height = canvas.height
      const outCtx = out.getContext('2d')
      outCtx.drawImage(img, 0, 0, out.width, out.height)
      outCtx.drawImage(canvas, 0, 0)
      const res = await api('/api/images/annotate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ assetId: shot.id, dataUrl: out.toDataURL('image/png'), width: out.width, height: out.height }),
      })
      if (!res.ok || !res.body?.image) throw new Error(res.body?.error || `标注保存失败（HTTP ${res.status}）`)
      const next = imageShotFromAsset(res.body.image)
      mergeRecentImage(next)
      mask.remove()
      renderView()
      toast(`已保存标注版本 v${res.body.image.revision}`)
      setTimeout(() => openImageWorkbench(next), 60)
    } catch (error) {
      save.disabled = false
      save.textContent = '保存标注'
      err.textContent = error?.message || '标注保存失败'
    }
  })
}

function openImageResize(shot) {
  const options = [
    { ratio: '1:1', label: '正方形' },
    { ratio: '3:4', label: '竖向' },
    { ratio: '9:16', label: '故事版式' },
    { ratio: '4:3', label: '横向' },
    { ratio: '16:9', label: '宽屏' },
  ]
  const mask = openModal('调整大小', `
    <div class="form-note">按所选比例扩展画布，主体完整保留，不裁掉画面内容；会创建新版本。</div>
    <div class="img-resize-list">
      ${options.map((item) => `
        <button type="button" class="img-resize-choice${shot.ratio === item.ratio ? ' on' : ''}" data-resize-ratio="${item.ratio}">
          <span class="img-resize-glyph ${item.ratio.replace(':', '-')}"></span>
          <span class="img-resize-name">${item.label}</span>
          <span class="img-resize-ratio">${item.ratio}</span>
        </button>`).join('')}
    </div>
    <div class="img-edit-err" id="imgResizeErr"></div>`, {})
  const err = mask.querySelector('#imgResizeErr')
  mask.querySelectorAll('[data-resize-ratio]').forEach((btn) => btn.addEventListener('click', async () => {
    const ratio = btn.dataset.resizeRatio
    if (shot.ratio === ratio) { mask.remove(); return }
    btn.disabled = true
    btn.classList.add('loading')
    try {
      const res = await api('/api/images/resize', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ assetId: shot.id, ratio }),
      })
      if (!res.ok || !res.body?.image) throw new Error(res.body?.error || `调整大小失败（HTTP ${res.status}）`)
      const next = imageShotFromAsset(res.body.image)
      mergeRecentImage(next)
      mask.remove()
      renderView()
      toast(`已调整为 ${ratio} 并创建新版本`)
      setTimeout(() => openImageWorkbench(next), 60)
    } catch (error) {
      btn.disabled = false
      btn.classList.remove('loading')
      err.textContent = error?.message || '调整大小失败'
    }
  }))
}

function openImageSkills() {
  const shots = (state.imagegen.shots || []).filter((shot) => shot.url)
  if (!shots.length) return toast('还没有可用于技能处理的图像，先生成或从模板生成一张', true)
  const mask = openModal('图像技能', `
    <div class="form-note">选择一张已落库的图像进入工作台，使用标注、添加评论、移除背景、擦除和调整大小。</div>
    <div class="img-ref-picker">
      ${shots.map((shot) => `
        <button type="button" class="img-ref-choice" data-skill-pick="${esc(shot.id)}">
          <img src="${shot.url}" alt="">
          <span>${esc(shot.style)} · ${esc(shot.ratio)} · v${esc(String(shot.revision || 1))}</span>
        </button>`).join('')}
    </div>`, { wide: true })
  mask.querySelectorAll('[data-skill-pick]').forEach((btn) => btn.addEventListener('click', () => {
    const shot = shots.find((item) => item.id === btn.dataset.skillPick)
    mask.remove()
    if (shot) openImageWorkbench(shot)
  }))
}

async function renderImage(el) {
  const g = state.imagegen
  const cap = state.boot?.imageGeneration || {}
  const allModels = Array.isArray(cap.models) ? cap.models : []
  const selectedModel = selectedImageModel()
  const tab = g.tab === 'mine' ? 'mine' : 'templates'

  if (!imagegenReady() || !selectedModel) {
    el.innerHTML = `
      <div class="img-head"><div><div class="img-title">图像</div><div class="img-sub"></div></div></div>
      <div class="ig-blocked">
        <div class="ig-blocked-ico">${icon('image')}</div>
        <div class="ig-blocked-title">当前环境没有可用的真实生图通道</div>
        <div class="ig-blocked-text">${esc(cap.reason || '尚未配置图像模型')}</div>
        <button class="btn primary" id="igGoSettings">检查网络与凭证</button>
      </div>`
    el.querySelector('#igGoSettings').addEventListener('click', () => { state.view = 'settings'; state.settingsTab = 'network'; render() })
    return
  }

  if (tab === 'mine' && !g.assetsLoaded) {
    if (!g.assetsLoading) loadRecentImages()
    el.innerHTML = `
      <div class="img-head"><div><div class="img-title">图像</div>
        <div class="img-sub">正在读取已落库的我的图像…</div></div></div>
      ${imageTemplateTabs(g)}
      <div class="img-gallery"><div class="img-loading">正在读取我的图像…</div></div>`
    bindImageTabs(el)
    return
  }
  if (!g.assetsLoaded && !g.assetsLoading) loadRecentImages()
  if (tab === 'templates' && !g.templatesLoaded && !g.templatesLoading) loadImageTemplates()
  if (!g.templateAppsLoaded && !g.templateAppsLoading) loadImageTemplateApplications()

  const cards = g.shots || []
  const modelOptions = allModels.map((model) => `<option value="${esc(model.id)}" ${model.id === g.modelId ? 'selected' : ''} ${model.configured ? '' : 'disabled'}>${esc(model.label)}${model.configured ? '' : '（未配置）'}</option>`).join('')
  const headSub = tab === 'templates'
    ? '真实模板 · 由用户申请、管理员审核后上线；选择模板后可上传参考照片，或直接试一试'
    : `真实生图 · ${esc(selectedModel.label)} · ${esc(selectedModel.providerLabel || selectedModel.provider || '图像模型')} · ${cap.external ? '提示词会发送到外部服务' : '服务端内部模型'}`

  const head = `
    <div class="img-head">
      <div><div class="img-title">图像</div><div class="img-sub">${g.busy ? '正在生成真实图像…' : headSub}</div></div>
      ${tab === 'mine' ? `<button class="btn sm img-compare-open" id="igCompare" ${cards.length < 2 ? 'disabled' : ''}>并排对比</button>` : ''}
    </div>
    ${imageTemplateTabs(g)}`

  if (tab === 'templates') {
    el.innerHTML = `${head}
      ${imageTemplateActions()}
      ${imageTemplateGrid(g)}
      <div class="img-tpl-footnote">模板是用户提交、管理员审核后上线的真实提示词；选择模板后可上传一张参考照片，或直接点“试一试”。</div>`
    bindImageTabs(el)
    bindImageTemplateActions(el)
    return
  }

  el.innerHTML = `${head}
    <div class="img-gallery">
      ${cards.length ? cards.map((c) => `
        <div class="img-card" data-igid="${esc(c.id)}" role="button" tabindex="0" title="${esc(c.prompt)}">
          <img src="${c.url}" alt="${esc(c.prompt)}">
          <span class="img-card-label">我的图像</span>
          <span class="img-card-meta">${esc(c.style)} · ${esc(c.ratio)}${Number(c.versions || 1) > 1 ? ` · ${esc(String(c.versions))} 版` : ''}</span>
          <button class="img-more" type="button" data-igmore="${esc(c.id)}" aria-label="图片操作" title="图片操作">${icon('dots')}</button>
        </div>`).join('') : `
        <div class="img-empty">
          <div class="img-empty-title">还没有生成图像</div>
          <div class="img-empty-text">先到“模板”选一个方向试一试，或在下方描述画面自由生成；真实结果会保存在这里。</div>
        </div>`}
    </div>
    <div class="img-composer-wrap">
      <div class="img-refs" id="igRefs">${renderImageReferenceChips(g)}</div>
      <div class="img-composer">
        <button type="button" class="img-plus" id="igPlus" aria-label="更多图像能力" aria-expanded="false" title="更多图像能力">${icon('plus')}</button>
        <div class="img-plus-menu" id="igPlusMenu" hidden>
          <button type="button" data-igplus="image"><span class="img-plus-menu-ico">${icon('image')}</span><span><b>添加图片</b><small>上传本地图片作为参考</small></span></button>
          <button type="button" data-igplus="draw"><span class="img-plus-menu-ico">${icon('pen')}</span><span><b>绘图</b><small>打开画板，把画好的图作为参考</small></span></button>
          <button type="button" data-igplus="skills"><span class="img-plus-menu-ico">${icon('spark')}</span><span><b>技能</b><small>标注、抠图、擦除、调整大小</small></span></button>
        </div>
        <select class="img-model-select" id="igModel" aria-label="选择图像模型" title="选择图像模型" ${allModels.length <= 1 ? 'disabled' : ''}>${modelOptions}</select>
        <input class="img-input" id="igPrompt" placeholder="描述新图像" value="${esc(g.prompt)}">
        <div class="img-tools">
          <select class="img-count-select" id="igCount" aria-label="方案数量" title="方案数量">${[1, 2, 3].map((n) => `<option value="${n}" ${Number(g.count) === n ? 'selected' : ''}>${n} 方案</option>`).join('')}</select>
          <button type="button" class="img-mic" id="igMic" title="语音输入" aria-label="语音输入">${icon('mic')}</button>
          <button class="img-send" id="igGen" title="生成" ${g.busy ? 'disabled' : ''}>${g.busy ? '…' : icon('up')}</button>
        </div>
      </div>
      <input id="igLocalFile" type="file" accept="image/png,image/jpeg,image/webp" hidden>
    </div>`

  bindImageTabs(el)
  const input = el.querySelector('#igPrompt')
  input.addEventListener('input', (e) => { g.prompt = e.target.value })
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); el.querySelector('#igGen').click() } })
  el.querySelector('#igModel')?.addEventListener('change', (e) => {
    g.modelId = e.target.value
    renderView()
  })
  el.querySelector('#igCount')?.addEventListener('change', (e) => {
    g.count = Math.max(1, Math.min(3, Number(e.target.value) || 1))
  })
  const plus = el.querySelector('#igPlus')
  const plusMenu = el.querySelector('#igPlusMenu')
  const closePlus = () => {
    if (!plusMenu || !plus) return
    plusMenu.hidden = true
    plus.setAttribute('aria-expanded', 'false')
  }
  plus?.addEventListener('click', (event) => {
    event.stopPropagation()
    const open = plusMenu.hidden
    plusMenu.hidden = !open
    plus.setAttribute('aria-expanded', open ? 'true' : 'false')
  })
  el.querySelector('#igComposer')?.addEventListener('click', (event) => {
    if (!event.target.closest('#igPlus') && !plusMenu?.contains(event.target)) closePlus()
  })
  plusMenu?.querySelectorAll('[data-igplus]').forEach((btn) => btn.addEventListener('click', () => {
    closePlus()
    if (btn.dataset.igplus === 'image') openLocalImagePicker()
    else if (btn.dataset.igplus === 'draw') openDrawingBoard({ imageReference: true })
    else if (btn.dataset.igplus === 'skills') openImageSkills()
  }))
  el.querySelector('#igLocalFile')?.addEventListener('change', (event) => {
    const file = event.target.files?.[0]
    if (file) addLocalImageReference(file)
    event.target.value = ''
  })
  el.querySelector('#igMic')?.addEventListener('click', (event) => startVoiceInput(event.currentTarget, input))
  el.querySelectorAll('[data-ref-remove]').forEach((btn) => btn.addEventListener('click', (e) => {
    e.stopPropagation()
    g.references = (g.references || []).filter((item) => item.id !== btn.dataset.refRemove)
    renderView()
  }))
  el.querySelector('#igCompare')?.addEventListener('click', () => openImageCompare())

  el.querySelectorAll('.img-card').forEach((b) => {
    const openPreview = () => {
      const s = g.shots.find((x) => x.id === b.dataset.igid)
      if (s) openImageWorkbench(s)
    }
    b.addEventListener('click', (e) => {
      if (e.target.closest('.img-more')) return
      openPreview()
    })
    b.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        if (e.target.closest('.img-more')) return
        e.preventDefault()
        openPreview()
      }
    })
    const more = b.querySelector('.img-more')
    more?.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const s = g.shots.find((x) => x.id === more.dataset.igmore)
      if (s) openImageMenu(more, s)
    })
  })

  el.querySelector('#igGen').addEventListener('click', async () => {
    if (!g.prompt.trim()) { toast('请先描述要生成的图像', true); input.focus(); return }
    if (g.busy) return
    g.busy = true
    g.tab = 'mine'
    renderView()
    toast('正在调用真实生图服务，通常需要 10–30 秒')
    const g2 = state.imagegen
    const count = Math.max(1, Math.min(4, Number(g2.count) || 1))
    const refs = g2.references || []
    const assetRefs = refs.filter((item) => !item.local)
    const localRefs = refs.filter((item) => item.local && item.url)
    let made = 0
    try {
      for (let i = 0; i < count; i += 1) {
        const res = await api('/api/images/generate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            prompt: g2.prompt.trim(),
            style: g2.style,
            ratio: g2.ratio,
            modelId: g2.modelId || selectedModel.id,
            referenceAssetIds: assetRefs.map((item) => item.id),
            referenceDataUrls: localRefs.map((item) => item.url),
            seed: Math.floor(Math.random() * 2_147_483_647),
          }),
        })
        if (!res.ok || !res.body?.image?.url) {
          throw new Error(res.body?.error || `生图服务返回 HTTP ${res.status}`)
        }
        const image = res.body.image
        g2.shots.unshift(imageShotFromAsset(image))
        g2.assetsLoaded = true
        g2.shots = g2.shots.slice(0, 30)
        made += 1
      }
      g2.busy = false
      renderView()
      toast(`已生成 ${made} 张真实图像 · ${selectedModel.label}`)
    } catch (err) {
      g2.busy = false
      renderView()
      toast(err.message || '真实生图失败，请稍后重试', true)
    }
  })
}

function bindImageTabs(root) {
  root.querySelectorAll('[data-igtab]').forEach((btn) => btn.addEventListener('click', () => {
    const tab = btn.dataset.igtab
    if (!tab) return
    state.imagegen.tab = tab
    if (tab === 'mine' && !state.imagegen.assetsLoaded) loadRecentImages()
    renderView()
  }))
}

function openDrawingBoard(opts = {}) {
  const forImage = Boolean(opts.imageReference)
  const drawSvg = (name) => {
    const paths = {
      cursor: '<path d="M5 3l13 8-5.6 1.2L10 19z"/>',
      pen: '<path d="M4 20c3.4-1.4 5.7-3.9 8.3-7.6 2-2.8 3.6-4.4 5.2-4.9 1.4-.5 2.2.7 1.2 2.2-1.7 2.5-4.2 4.1-7.1 4.9-1.7.5-2.8-.8-2.2-2.3.9-2.1 2.5-4 5.3-5.4"/>',
      shapes: '<rect x="3.5" y="6" width="10.5" height="10.5" rx="2.4"/><rect x="9" y="9.5" width="10.5" height="10.5" rx="2.4"/>',
      eraser: '<path d="M8.5 19.5l-4-4 9.5-9.5 6 6-7.5 7.5z"/><path d="M10.5 21h9"/>',
      undo: '<path d="M9 7L4 12l5 5"/><path d="M5 12h8.5a6 6 0 0 1 6 6"/>',
      redo: '<path d="M15 7l5 5-5 5"/><path d="M19 12h-8.5a6 6 0 0 0-6 6"/>',
      line: '<path d="M5 19L19 5"/>',
      arrow: '<path d="M5 19L19 5"/><path d="M13 5h6v6"/>',
      rect: '<rect x="5" y="5" width="14" height="14" rx="1"/>',
      ellipse: '<circle cx="12" cy="12" r="7"/>',
      triangle: '<path d="M12 4l8 15H4z"/>',
      diamond: '<path d="M12 4l8 8-8 8-8-8z"/>',
      star: '<path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>',
      heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.6-7 10-7 10z"/>',
      check: '<path d="M5 12.5l4.2 4.2L19 6.5"/>',
    }
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || ''}</svg>`
  }
  const colors = [
    ['rainbow', '彩虹'], ['#1f2328', '墨黑'], ['#8b8f96', '灰'], ['#8b5e3c', '棕'],
    ['#d92d20', '红'], ['#f26b21', '橙'], ['#f5a623', '黄'], ['#1f9d55', '绿'],
    ['#0f9b8e', '青绿'], ['#13b5d6', '青'], ['#2563eb', '蓝'], ['#4f46e5', '靛'],
    ['#7c3aed', '紫'], ['#d92d9b', '粉'],
  ]
  const shapeOptions = [['line', '直线'], ['arrow', '箭头'], ['rect', '矩形'], ['ellipse', '圆形'], ['triangle', '三角'], ['diamond', '菱形'], ['star', '星形'], ['heart', '心形']]
  const mask = document.createElement('div')
  mask.className = 'jg-draw-mask open'
  mask.innerHTML = `
    <div class="jg-draw-panel" data-tool="pen">
      <canvas class="jg-draw-canvas" id="drawCanvas"></canvas>
      <button class="jg-draw-close" data-dclose title="关闭" aria-label="关闭">${icon('close')}</button>
      <div class="jg-draw-toolbar" role="toolbar" aria-label="绘图工具">
        <button class="jg-draw-tool" data-tool="select" title="选择">${drawSvg('cursor')}</button>
        <button class="jg-draw-tool on" data-tool="pen" title="画笔">${drawSvg('pen')}</button>
        <button class="jg-draw-tool jg-draw-text-tool" data-tool="text" title="文字"><span>T</span></button>
        <button class="jg-draw-tool" data-tool="shape" title="形状">${drawSvg('shapes')}</button>
        <button class="jg-draw-tool" data-tool="eraser" title="橡皮">${drawSvg('eraser')}</button>
      </div>
      <div class="jg-draw-shapes" hidden>
        ${shapeOptions.map(([kind, label]) => `<button class="jg-draw-shape" data-shape="${kind}" title="${label}">${drawSvg(kind)}</button>`).join('')}
      </div>
      <div class="jg-draw-topright">
        <button class="jg-draw-topbtn" data-dundo title="撤销" aria-label="撤销" disabled>${drawSvg('undo')}</button>
        <button class="jg-draw-topbtn" data-dredo title="重做" aria-label="重做" disabled>${drawSvg('redo')}</button>
      </div>
      <div class="jg-draw-size" title="画笔粗细">
        <input id="drawSize" type="range" min="1" max="28" value="4" aria-label="画笔粗细">
      </div>
      <div class="jg-draw-colors">
        ${colors.map(([c, label]) => `<button class="jg-draw-color${c === 'rainbow' ? ' rainbow' : ''}${c === '#1f2328' ? ' on' : ''}" data-color="${c}" title="${label}" aria-label="${label}"${c === 'rainbow' ? '' : ` style="background:${c}"`}></button>`).join('')}
      </div>
      <button class="jg-draw-confirm" data-ddone title="${forImage ? '完成并加入参考图' : '完成并加入对话'}" aria-label="${forImage ? '完成并加入参考图' : '完成并加入对话'}" disabled>${drawSvg('check')}</button>
    </div>`
  document.body.appendChild(mask)
  const panel = mask.querySelector('.jg-draw-panel')
  const canvas = mask.querySelector('#drawCanvas')
  const ctx = canvas.getContext('2d')
  const shapeMenu = mask.querySelector('.jg-draw-shapes')
  const undoBtn = mask.querySelector('[data-dundo]')
  const redoBtn = mask.querySelector('[data-dredo]')
  const doneBtn = mask.querySelector('[data-ddone]')
  let tool = 'pen'
  let color = '#1f2328'
  let brush = 4
  const sizeWrap = mask.querySelector('.jg-draw-size')
  const sizeInput = mask.querySelector('#drawSize')
  const syncSize = () => {
    const pct = 100 - ((brush - 1) / 27) * 100
    sizeWrap.style.setProperty('--jg-fill', `${Math.max(0, Math.min(100, pct))}%`)
  }
  syncSize()
  let shapeKind = 'rect'
  let objects = []
  let history = []
  let histIndex = -1
  let drawing = null
  let dragging = null
  let selected = -1
  let erasing = false
  let erased = false
  let textInput = null
  let dpr = Math.max(1, window.devicePixelRatio || 1)
  let observer = null

  const bounds = (o) => {
    if (o.type === 'stroke') {
      const xs = o.points.map((p) => p.x)
      const ys = o.points.map((p) => p.y)
      const pad = o.width / 2 + 2
      return { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + pad * 2, h: Math.max(...ys) - Math.min(...ys) + pad * 2 }
    }
    if (o.type === 'shape') {
      return { x: Math.min(o.x1, o.x2), y: Math.min(o.y1, o.y2), w: Math.abs(o.x2 - o.x1), h: Math.abs(o.y2 - o.y1) }
    }
    const lines = String(o.text || '').split('\n')
    ctx.font = `500 ${o.size}px "PingFang SC","Microsoft YaHei",sans-serif`
    const width = Math.max(...lines.map((line) => ctx.measureText(line).width), 0)
    return { x: o.x, y: o.y, w: width, h: lines.length * o.size * 1.25 }
  }
  const paintStroke = (o) => {
    if (!o.points.length) return
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (o.points.length === 1) {
      ctx.fillStyle = o.color === 'rainbow' ? '#2563eb' : o.color
      ctx.beginPath()
      ctx.arc(o.points[0].x, o.points[0].y, o.width / 2, 0, Math.PI * 2)
      ctx.fill()
      return
    }
    for (let i = 1; i < o.points.length; i += 1) {
      ctx.strokeStyle = o.color === 'rainbow' ? `hsl(${(i * 18) % 360} 82% 55%)` : o.color
      ctx.lineWidth = o.width
      ctx.beginPath()
      ctx.moveTo(o.points[i - 1].x, o.points[i - 1].y)
      ctx.lineTo(o.points[i].x, o.points[i].y)
      ctx.stroke()
    }
  }
  const paintShape = (o) => {
    const x1 = o.x1
    const y1 = o.y1
    const x2 = o.x2
    const y2 = o.y2
    const x = Math.min(x1, x2)
    const y = Math.min(y1, y2)
    const w = Math.abs(x2 - x1)
    const h = Math.abs(y2 - y1)
    ctx.lineWidth = o.width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (o.color === 'rainbow') {
      const gradient = ctx.createLinearGradient(x, y, x + w, y + h)
      gradient.addColorStop(0, '#ff4d4d')
      gradient.addColorStop(.25, '#f5a623')
      gradient.addColorStop(.5, '#1f9d55')
      gradient.addColorStop(.75, '#13b5d6')
      gradient.addColorStop(1, '#7c3aed')
      ctx.strokeStyle = gradient
    } else ctx.strokeStyle = o.color
    ctx.beginPath()
    if (o.shape === 'line' || o.shape === 'arrow') {
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
      if (o.shape === 'arrow') {
        const angle = Math.atan2(y2 - y1, x2 - x1)
        const head = Math.max(10, o.width * 2.5)
        ctx.beginPath()
        ctx.moveTo(x2, y2)
        ctx.lineTo(x2 - head * Math.cos(angle - .45), y2 - head * Math.sin(angle - .45))
        ctx.moveTo(x2, y2)
        ctx.lineTo(x2 - head * Math.cos(angle + .45), y2 - head * Math.sin(angle + .45))
        ctx.stroke()
      }
      return
    }
    if (o.shape === 'rect') ctx.strokeRect(x, y, w, h)
    else if (o.shape === 'ellipse') ctx.ellipse(x + w / 2, y + h / 2, Math.max(1, w / 2), Math.max(1, h / 2), 0, 0, Math.PI * 2), ctx.stroke()
    else if (o.shape === 'triangle') {
      ctx.moveTo(x + w / 2, y)
      ctx.lineTo(x + w, y + h)
      ctx.lineTo(x, y + h)
      ctx.closePath()
      ctx.stroke()
    } else if (o.shape === 'diamond') {
      ctx.moveTo(x + w / 2, y)
      ctx.lineTo(x + w, y + h / 2)
      ctx.lineTo(x + w / 2, y + h)
      ctx.lineTo(x, y + h / 2)
      ctx.closePath()
      ctx.stroke()
    } else if (o.shape === 'star') {
      const cx = x + w / 2
      const cy = y + h / 2
      for (let i = 0; i < 10; i += 1) {
        const angle = -Math.PI / 2 + i * Math.PI / 5
        const rx = (i % 2 ? .46 : 1) * w / 2
        const ry = (i % 2 ? .46 : 1) * h / 2
        const px = cx + Math.cos(angle) * rx
        const py = cy + Math.sin(angle) * ry
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.stroke()
    } else if (o.shape === 'heart') {
      const cx = x + w / 2
      ctx.moveTo(cx, y + h)
      ctx.bezierCurveTo(x - .1 * w, y + .55 * h, x + .05 * w, y + .05 * h, cx, y + .35 * h)
      ctx.bezierCurveTo(x + .95 * w, y + .05 * h, x + 1.1 * w, y + .55 * h, cx, y + h)
      ctx.closePath()
      ctx.stroke()
    }
  }
  const paintText = (o) => {
    ctx.fillStyle = o.color === 'rainbow' ? '#1f2328' : o.color
    ctx.font = `500 ${o.size}px "PingFang SC","Microsoft YaHei",sans-serif`
    ctx.textBaseline = 'top'
    String(o.text || '').split('\n').forEach((line, i) => ctx.fillText(line, o.x, o.y + i * o.size * 1.25))
  }
  const paintObject = (o) => {
    if (o.type === 'stroke') paintStroke(o)
    else if (o.type === 'shape') paintShape(o)
    else if (o.type === 'text') paintText(o)
  }
  const redraw = () => {
    const w = canvas.width / dpr
    const h = canvas.height / dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    objects.forEach(paintObject)
    const sel = dragging ? dragging.index : selected
    if (sel >= 0 && objects[sel]) {
      const b = bounds(objects[sel])
      ctx.save()
      ctx.setLineDash([5, 4])
      ctx.strokeStyle = '#2563eb'
      ctx.lineWidth = 1.5
      ctx.strokeRect(b.x - 6, b.y - 6, b.w + 12, b.h + 12)
      ctx.restore()
    }
  }
  const resize = () => {
    const r = panel.getBoundingClientRect()
    if (!r.width || !r.height) return
    dpr = Math.max(1, window.devicePixelRatio || 1)
    canvas.width = Math.round(r.width * dpr)
    canvas.height = Math.round(r.height * dpr)
    redraw()
  }
  const pointOf = (e) => {
    const r = canvas.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const clone = (o) => JSON.parse(JSON.stringify(o))
  const commit = () => {
    history = history.slice(0, histIndex + 1)
    history.push(JSON.stringify(objects))
    histIndex = history.length - 1
    syncHistory()
    doneBtn.disabled = objects.length === 0
    redraw()
  }
  const syncHistory = () => {
    undoBtn.disabled = histIndex <= 0
    redoBtn.disabled = histIndex >= history.length - 1
    doneBtn.disabled = objects.length === 0
  }
  const undo = () => {
    if (histIndex <= 0) return
    histIndex -= 1
    objects = JSON.parse(history[histIndex])
    dragging = null
    selected = -1
    redraw()
    syncHistory()
  }
  const redo = () => {
    if (histIndex >= history.length - 1) return
    histIndex += 1
    objects = JSON.parse(history[histIndex])
    dragging = null
    selected = -1
    redraw()
    syncHistory()
  }
  const distanceToSegment = (p, a, b) => {
    const dx = b.x - a.x
    const dy = b.y - a.y
    if (!dx && !dy) return Math.hypot(p.x - a.x, p.y - a.y)
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)))
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
  }
  const hitTest = (p) => {
    for (let i = objects.length - 1; i >= 0; i -= 1) {
      const o = objects[i]
      const b = bounds(o)
      if (p.x < b.x - 8 || p.x > b.x + b.w + 8 || p.y < b.y - 8 || p.y > b.y + b.h + 8) continue
      if (o.type === 'stroke') {
        if (o.points.length === 1) {
          if (Math.hypot(p.x - o.points[0].x, p.y - o.points[0].y) <= o.width / 2 + 8) return i
        } else {
          for (let k = 1; k < o.points.length; k += 1) {
            if (distanceToSegment(p, o.points[k - 1], o.points[k]) <= o.width / 2 + 8) return i
          }
        }
        continue
      }
      return i
    }
    return -1
  }
  const translate = (o, dx, dy) => {
    if (o.type === 'stroke') o.points.forEach((p) => { p.x += dx; p.y += dy })
    else if (o.type === 'shape') { o.x1 += dx; o.x2 += dx; o.y1 += dy; o.y2 += dy }
    else if (o.type === 'text') { o.x += dx; o.y += dy }
  }
  const eraseAt = (p) => {
    const idx = hitTest(p)
    if (idx < 0) return
    objects.splice(idx, 1)
    erased = true
    if (dragging?.index === idx) dragging = null
    if (selected === idx) selected = -1
    else if (selected > idx) selected -= 1
    redraw()
  }
  const syncTools = () => {
    mask.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === tool))
    mask.querySelectorAll('[data-color]').forEach((b) => b.classList.toggle('on', b.dataset.color === color))
    panel.dataset.tool = tool
  }
  const closeTextEditor = (save = true) => {
    if (!textInput) return
    const { el, point } = textInput
    textInput = null
    const value = el.value.trim()
    el.remove()
    if (save && value) {
      objects.push({ type: 'text', text: value, x: point.x, y: point.y, color: color === 'rainbow' ? '#1f2328' : color, size: 28 })
      commit()
    }
  }
  const startText = (point) => {
    closeTextEditor(true)
    const ta = document.createElement('textarea')
    ta.className = 'jg-draw-text-input'
    ta.rows = 1
    ta.style.left = `${Math.max(12, Math.min(panel.clientWidth - 260, point.x))}px`
    ta.style.top = `${Math.max(12, Math.min(panel.clientHeight - 52, point.y))}px`
    ta.style.color = color === 'rainbow' ? '#1f2328' : color
    panel.appendChild(ta)
    textInput = { el: ta, point }
    const finish = (save) => {
      if (textInput?.el === ta) closeTextEditor(save)
    }
    ta.addEventListener('keydown', (e) => {
      e.stopPropagation()
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finish(true) }
      if (e.key === 'Escape') { e.preventDefault(); finish(false) }
    })
    ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = `${Math.min(140, ta.scrollHeight)}px` })
    ta.addEventListener('blur', () => finish(true))
    setTimeout(() => ta.focus(), 0)
  }
  const setTool = (next) => {
    if (next !== 'text') closeTextEditor(true)
    tool = next
    if (next !== 'shape') shapeMenu.hidden = true
    syncTools()
  }
  const closeBoard = () => {
    closeTextEditor(false)
    if (observer) observer.disconnect()
    window.removeEventListener('resize', resize)
    document.removeEventListener('keydown', onKey)
    mask.remove()
  }
  const onKey = (e) => {
    if (e.key === 'Escape') { closeBoard(); return }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault()
      if (e.shiftKey) redo(); else undo()
      return
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && !textInput && selected >= 0) {
      e.preventDefault()
      objects.splice(selected, 1)
      selected = -1
      commit()
      redraw()
    }
  }
  mask.addEventListener('pointerdown', (e) => {
    if (textInput && !panel.contains(e.target)) closeTextEditor(true)
  }, true)
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button != null && e.button !== 0) return
    const p = pointOf(e)
    if (tool === 'text') {
      e.preventDefault()
      if (textInput) { closeTextEditor(true); return }
      startText(p)
      return
    }
    if (tool === 'select') {
      const idx = hitTest(p)
      selected = idx
      dragging = idx >= 0 ? { index: idx, start: p, origin: clone(objects[idx]), moved: false } : null
      if (idx >= 0) canvas.setPointerCapture?.(e.pointerId)
      redraw()
      return
    }
    if (tool === 'eraser') {
      e.preventDefault()
      erasing = true
      erased = false
      canvas.setPointerCapture?.(e.pointerId)
      eraseAt(p)
      return
    }
    e.preventDefault()
    canvas.setPointerCapture?.(e.pointerId)
    if (tool === 'pen') {
      drawing = { type: 'stroke', color, width: brush, points: [p] }
      objects.push(drawing)
    } else if (tool === 'shape') {
      drawing = { type: 'shape', shape: shapeKind, color, width: brush, x1: p.x, y1: p.y, x2: p.x, y2: p.y }
      objects.push(drawing)
    }
    redraw()
  })
  canvas.addEventListener('pointermove', (e) => {
    const p = pointOf(e)
    if (drawing) {
      if (drawing.type === 'stroke') {
        const last = drawing.points[drawing.points.length - 1]
        if (Math.hypot(p.x - last.x, p.y - last.y) >= 1.5) drawing.points.push(p)
      } else if (drawing.type === 'shape') {
        drawing.x2 = p.x
        drawing.y2 = p.y
      }
      redraw()
      return
    }
    if (dragging) {
      const dx = p.x - dragging.start.x
      const dy = p.y - dragging.start.y
      if (dx || dy) {
        const idx = dragging.index
        objects[idx] = clone(dragging.origin)
        translate(objects[idx], dx, dy)
        dragging.moved = true
        redraw()
      }
      return
    }
    if (erasing) eraseAt(p)
  })
  const endPointer = () => {
    if (drawing) {
      if (drawing.type === 'shape' && Math.abs(drawing.x2 - drawing.x1) < 3 && Math.abs(drawing.y2 - drawing.y1) < 3) objects.pop()
      else commit()
      drawing = null
      redraw()
    }
    if (dragging) {
      if (dragging.moved) commit()
      dragging = null
      redraw()
    }
    if (erasing) {
      if (erased) commit()
      erasing = false
    }
  }
  canvas.addEventListener('pointerup', endPointer)
  canvas.addEventListener('pointercancel', endPointer)
  mask.querySelectorAll('[data-tool]').forEach((b) => {
    if (b.dataset.tool === 'shape') return
    b.addEventListener('click', () => setTool(b.dataset.tool))
  })
  mask.querySelector('[data-tool="shape"]').addEventListener('click', (e) => {
    e.stopPropagation()
    if (tool === 'shape') { shapeMenu.hidden = !shapeMenu.hidden; return }
    setTool('shape')
    shapeMenu.hidden = false
  })
  mask.querySelectorAll('[data-shape]').forEach((b) => b.addEventListener('click', () => {
    shapeKind = b.dataset.shape
    setTool('shape')
    shapeMenu.hidden = true
  }))
  mask.querySelectorAll('[data-color]').forEach((b) => b.addEventListener('click', () => { color = b.dataset.color; syncTools() }))
  mask.querySelector('#drawSize').addEventListener('input', (e) => {
    brush = Number(e.target.value) || 4
    syncSize()
  })
  undoBtn.addEventListener('click', undo)
  redoBtn.addEventListener('click', redo)
  mask.querySelector('[data-dclose]').addEventListener('click', closeBoard)
  doneBtn.addEventListener('click', async () => {
    if (!objects.length) return toast('画布还是空的', true)
    doneBtn.disabled = true
    if (forImage) {
      try {
        const g = state.imagegen
        if ((g.references || []).length >= 3) {
          doneBtn.disabled = false
          return toast('最多只能添加 3 张参考图', true)
        }
        const dataUrl = canvas.toDataURL('image/png')
        g.references = [...(g.references || []), {
          id: `local-draw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          url: dataUrl,
          name: '绘图参考',
          local: true,
        }]
        closeBoard()
        state.imagegen.tab = 'mine'
        renderView()
        toast('绘图已加入参考图')
      } catch (error) {
        toast(error?.message || '绘图导出失败', true)
      } finally {
        doneBtn.disabled = false
      }
      return
    }
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) { doneBtn.disabled = false; return toast('导出失败，请重试', true) }
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
    const file = new File([blob], `绘图-${stamp}.png`, { type: 'image/png' })
    const uploaded = await uploadBinaryFile(file, 'chat')
    doneBtn.disabled = false
    if (!uploaded.ok) return toast(uploaded.body?.error || '绘图上传失败', true)
    addComposerRef({ kind: 'file', id: uploaded.file.id, label: file.name })
    closeBoard()
    renderView()
    toast('绘图已加入本轮附件')
  })
  mask.addEventListener('click', (e) => {
    if (!shapeMenu.hidden && !shapeMenu.contains(e.target) && !e.target.closest('[data-tool="shape"]')) shapeMenu.hidden = true
  })
  document.addEventListener('keydown', onKey)
  requestAnimationFrame(() => {
    resize()
    history = [JSON.stringify(objects)]
    histIndex = 0
    syncHistory()
    redraw()
  })
  if (window.ResizeObserver) {
    observer = new ResizeObserver(() => resize())
    observer.observe(panel)
  }
  window.addEventListener('resize', resize)
}

/* ---------------------------- cloud browser --------------------------- */

const CLOUD_STATE = {
  usable: ['ok', '可用'],
  locked: ['warn', '需审批 / 无授权'],
  offnet: ['', '本网不可连'],
  down: ['warn', '维护中'],
}

/* 云浏览器：参考客户端形态的右侧工具栏，不占整页；会话以标签页组织。 */
async function ensureCloud() {
  if (state.cloud && state.cloud.net === state.boot.network?.id) return state.cloud
  const { body } = await api('/api/cloud')
  state.cloud = { ...body, net: state.boot.network?.id }
  return state.cloud
}

async function openCloudWebTab(url, title = '') {
  const target = String(url || '').trim()
  if (!/^https?:\/\//i.test(target)) return toast('只能打开 http/https 网页', true)
  if (!cloudAllowed()) return toast('自带浏览器只在首页或会话侧栏可用', true)
  if (!window.jgClient?.browser) { window.open(target, '_blank'); return }
  const existing = state.cloudTabs?.find((t) => t.kind === 'web' && t.url === target)
  if (existing) {
    state.cloudTab = existing.id
    state.cloudOpen = true
    applyLayout()
    renderCloudPanel()
    renderTopbar()
    return
  }
  try { await ensureCloud() } catch { return toast('自带浏览器初始化失败', true) }
  let host = '网页'
  try { host = new URL(target).hostname.replace(/^www\./, '') } catch (_) {}
  const id = `web-${Date.now()}`
  const name = String(title || host).trim().slice(0, 48) || host
  state.cloudTabs = (state.cloudTabs || []).filter((t) => t.kind !== 'new')
  state.cloudTabs.push({ id, kind: 'web', title: name, url: target })
  state.cloudTab = id
  state.cloudOpen = true
  applyLayout()
  renderCloudPanel()
  renderTopbar()
  toast('已在右侧自带浏览器打开')
}

function toggleCloudPanel(force) {  const next = typeof force === 'boolean' ? force : !state.cloudOpen
  state.cloudOpen = next
  applyLayout()
  renderMenubar()
  if (next) {
    ensureCloud().then(() => { renderCloudPanel(); renderTopbar(); renderMenubar() })
  } else {
    endAllCloudSessions().then(() => { renderCloudPanel(); renderTopbar(); renderMenubar() })
  }
}

async function endAllCloudSessions() {
  const sessions = state.cloudTabs.filter((t) => t.kind === 'session')
  for (const t of sessions) {
    await api('/api/cloud/close', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: t.id }) })
  }
  state.cloudTabs = state.cloudTabs.filter((t) => t.kind !== 'session')
  state.cloudTab = 'new'
}

function cloudHomeHTML() {
  const systems = (state.cloud?.systems || [])
  return `
    <div class="cb-addr">
      <div class="cb-navgrp">
        <button class="cb-nav" title="后退" disabled>${icon('chevron')}</button>
        <span class="cb-nav-sep"></span>
        <button class="cb-nav cb-nav-fwd" title="前进" disabled>${icon('chevron')}</button>
      </div>
      <button class="cb-nav cb-reload" id="cbReload" title="刷新">${icon('refresh')}</button>
      <input id="cbAddr" placeholder="搜索或输入网址" autocomplete="off">
      <div class="cb-actgrp">
        <button class="cb-nav cb-ext-btn" id="cbExt" title="扩展程序尚未接入" disabled style="opacity:.45;cursor:not-allowed"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5h3v2.5a1.5 1.5 0 1 0 3 0V5h3v4h2.5a1.5 1.5 0 1 0 0 3H18v4h-4v2.5a1.5 1.5 0 1 0-3 0V16H5v-4H7.5a1.5 1.5 0 1 0 0-3H5V5h4z"/></svg><span class="cb-ext-dot">${state.cloudExts?.filter((x) => x.on).length || 0}</span></button>
        <button class="cb-nav" id="cbDownload" title="下载"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 4v10M8 11l4 4 4-4M5 19h14"/></svg></button>
        <button class="cb-nav" id="cbMore" title="更多工具尚未接入" disabled style="opacity:.45;cursor:not-allowed"><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/></svg></button>
      </div>
    </div>
    <div class="cb-h">工具</div>
    <div class="cb-tool-row">
      <button class="cb-tool" id="cbToolFile">${icon('folder')}<span>文件</span><em>Ctrl+P</em></button>
      <button class="cb-tool" id="cbToolMore">${icon('grid')}<span>更多工具…</span><em>⌄</em></button>
    </div>
    <div class="cb-h">推荐</div>
    <div class="cb-rec-row">
      <button class="cb-rec" data-open="CB-2"><span class="cb-rec-ico">${icon('globe')}</span><b>公共资源交易</b></button>
      <button class="cb-rec" data-open="CB-1"><span class="cb-rec-ico">${icon('globe')}</span><b>四库一平台</b></button>
      <button class="cb-rec" data-open="CB-5"><span class="cb-rec-ico">${icon('doc')}</span><b>集团 OA</b></button>
      <button class="cb-rec" data-open="CB-3"><span class="cb-rec-ico">${icon('map')}</span><b>自然资源平台</b></button>
    </div>
    <div class="cb-sec-row">
      ${(state.cloud?.policy || []).slice(0, 4).map((p) => `<span class="cb-sec">${esc(p.title)}</span>`).join('')}
    </div>`
}

function cloudSessionHTML(tab) {
  const s = state.cloud?.systems?.find((x) => x.id === tab.systemId) || {}
  const sess = tab.session || {}
  return `
    <div class="cb-frame">
      <div class="cb-frame-bar">
        <span class="cb-dots"><i></i><i></i><i></i></span>
        <span class="mono cb-frame-url">https://${esc(tab.host || '')}</span>
        <span class="spacer"></span>
        <span class="tag ok">${esc(state.boot.network?.label || '')}实例</span>
      </div>
      <div class="cb-stage compact">
        <div class="cb-portal">
          <div class="cb-portal-title">${esc(s.name || tab.title)}</div>
          <div class="cb-portal-sub">统一身份认证 · 企业凭据托管登录</div>
          <div class="cb-field"><span>账号</span><b class="mono">${esc(s.credential?.account || 'SSO')}</b></div>
          <div class="cb-field"><span>口令</span><b class="mono">••••••（服务端注入）</b></div>
          <div class="cb-portal-note">${icon('shield')} 口令不经过客户端，画面已叠加水印并录屏</div>
          <div class="cb-portal-btn" data-portal>进入系统</div>
        </div>
        <div class="cb-watermark">${esc(sess.watermark || '')}</div>
        <div class="cb-watermark second">${esc(sess.watermark || '')}</div>
      </div>
      <div class="cb-sess">
        <div class="mono">票号 ${esc(tab.ticket?.token || '')} · ${tab.ticket?.ttlSec || 900}s</div>
        <div class="mono" style="color:var(--muted)">绑定 ${esc(tab.ticket?.boundTo || '')}</div>
      </div>
      <div class="cb-sess-acts">
        <span>${esc(sess.note || '写操作在会话内二次确认；剪贴板按网络策略禁用')}</span>
        <span class="spacer"></span>
        <button class="btn sm" data-end="${tab.id}">结束会话</button>
      </div>
    </div>`
}

function cloudWebHTML(tab) {
  return `
    <div class="cb-frame" style="padding:0;display:flex;flex-direction:column;height:100%;min-height:0">
      <div class="cb-frame-bar">
        <span class="cb-dots"><i></i><i></i><i></i></span>
        <span class="mono cb-frame-url" title="${esc(tab.url)}">${esc(tab.url.replace(/^https?:\/\//, ''))}</span>
        <span class="spacer"></span>
        <span class="tag ok">网页</span>
        <button class="btn sm subtle" data-web-reload title="刷新">刷新</button>
        <button class="btn sm subtle" data-web-handoff title="把当前网页交给 AI">转交 AI</button>
        <button class="btn sm subtle" data-web-download title="下载 / 文件">文件</button>
        <button class="btn sm subtle" data-web-external="${esc(tab.url)}" title="在系统浏览器打开">外部打开</button>
      </div>
      <div id="cbWebSlot" style="flex:1;width:100%;min-height:0;background:#fff;position:relative">
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:var(--fs-sub)">正在加载网页…</div>
      </div>
    </div>`
}

function renderCloudPanel() {
  let panel = document.getElementById('cbPanel')
  const app = document.getElementById('app')
  if (!state.cloudOpen || !state.cloud || !cloudAllowed()) {
    panel?.remove()
    app?.classList.remove('has-cloud')
    document.documentElement.style.setProperty('--cb-w', '0px')
    closeNativeWeb()
    return
  }
  app?.classList.add('has-cloud')
  if (!panel) {
    panel = document.createElement('aside')
    panel.id = 'cbPanel'
    panel.className = 'cb-panel'
  }
  if (panel.parentElement !== app) app.appendChild(panel)
  panel.className = `cb-panel${state.cbFull ? ' full' : ''}`
  panel.style.width = ''
  applyLayout()
  const tabs = state.cloudTabs.length ? state.cloudTabs : [{ id: 'new', kind: 'new', title: '新标签页' }]
  state.cloudTabs = tabs
  const active = tabs.find((t) => t.id === state.cloudTab) || tabs[0]
  state.cloudTab = active.id

  panel.innerHTML = `
    <div class="cb-grip" id="cbGrip" title="拖动调整宽度"></div>
    <div class="cb-head">
      <div class="cb-tabs">
        ${tabs.map((t) => `<button class="cb-tab${t.id === active.id ? ' on' : ''}" data-tab="${t.id}">
          <span class="cb-tab-ico">${icon('globe')}</span>
          <span class="cb-tab-name">${esc(t.title)}</span>
          <em class="cb-tab-x" data-x="${t.id}">×</em>
        </button>`).join('')}
        <button class="cb-tab-add" id="cbNew" title="新标签页">${icon('plus')}</button>
      </div>
      <button class="cb-icon-btn" id="cbFull" title="${state.cbFull ? '退出完整视图' : '完整视图'}">${state.cbFull
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>'}</button>
      <button class="cb-icon-btn" id="cbFold" title="折叠云浏览器"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M15 4v16"/></svg></button>
    </div>
    <div class="cb-body">${active.kind === 'session' ? cloudSessionHTML(active) : active.kind === 'web' ? cloudWebHTML(active) : cloudHomeHTML()}</div>
    ${state.cbFull ? `<div class="cb-composer">
      <button class="cbc-plus" title="附件">${icon('plus')}</button>
      <input id="cbcInput" placeholder="询问 九规智能中枢" autocomplete="off">
      <button class="cbc-mic" title="语音">${icon('mic')}</button>
      <button class="cbc-send" id="cbcSend" title="发送">${icon('up')}</button>
    </div>` : ''}`

  panel.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', (e) => {
    if (e.target.closest('[data-x]')) return
    state.cloudTab = b.dataset.tab
    renderCloudPanel()
  }))
  panel.querySelectorAll('[data-x]').forEach((b) => b.addEventListener('click', async (e) => {
    e.stopPropagation()
    const tab = state.cloudTabs.find((t) => t.id === b.dataset.x)
    if (tab?.kind === 'session') await api('/api/cloud/close', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: tab.id }) })
    state.cloudTabs = state.cloudTabs.filter((t) => t.id !== b.dataset.x)
    if (state.cloudTab === b.dataset.x) state.cloudTab = state.cloudTabs[0]?.id || 'new'
    if (!state.cloudTabs.length) state.cloudTabs = [{ id: 'new', kind: 'new', title: '新标签页' }]
    renderCloudPanel()
  }))
  panel.querySelector('#cbNew').addEventListener('click', () => {
    let n = 1
    while (state.cloudTabs.some((t) => t.id === `new-${n}`)) n += 1
    const id = `new-${n}`
    state.cloudTabs.push({ id, kind: 'new', title: '新标签页' })
    state.cloudTab = id
    renderCloudPanel()
  })
  panel.querySelector('#cbFull').addEventListener('click', () => {
    state.cbFull = !state.cbFull
    renderCloudPanel()
  })
  panel.querySelector('#cbFold').addEventListener('click', () => toggleCloudPanel(false))
  panel.querySelector('#cbExt')?.addEventListener('click', (ev) => { ev.stopPropagation(); openCloudExtensions(ev.currentTarget) })
  panel.querySelector('#cbDownload')?.addEventListener('click', () => openCloudDownloads())
  panel.querySelector('#cbMore')?.addEventListener('click', (ev) => { ev.stopPropagation(); openCloudMore(ev.currentTarget) })
  const cbc = panel.querySelector('#cbcInput')
  if (cbc) {
    cbc.disabled = true
    cbc.style.opacity = '.55'
    const send = panel.querySelector('#cbcSend')
    if (send) { send.disabled = true; send.style.opacity = '.45'; send.style.cursor = 'not-allowed' }
  }

  panel.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => openCloudTab(b.dataset.open)))
  panel.querySelector('#cbAddr')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitCloudAddr(panel) })
  panel.querySelector('#cbReload')?.addEventListener('click', () => { renderCloudPanel(); toast('已刷新云浏览器视图（会话仍托管在企业侧）') })
  panel.querySelector('[data-web-reload]')?.addEventListener('click', () => {
    if (window.jgClient?.browser) window.jgClient.browser.reload()
    else renderCloudPanel()
  })
  panel.querySelector('[data-web-external]')?.addEventListener('click', (e) => {
    const url = e.currentTarget.dataset.webExternal
    if (window.jgClient?.browser) window.jgClient.browser.openExternal(url)
    else window.open(url, '_blank')
  })
  panel.querySelector('[data-web-handoff]')?.addEventListener('click', () => handoffWebPageToAI())
  panel.querySelector('[data-web-download]')?.addEventListener('click', () => openCloudDownloads())
  panel.querySelector('#cbToolFile')?.addEventListener('click', () => openCloudDownloads())
  panel.querySelector('#cbToolMore')?.addEventListener('click', () => toast('更多浏览器工具尚未接入', true))
  const moreTool = panel.querySelector('#cbToolMore')
  if (moreTool) { moreTool.disabled = true; moreTool.style.opacity = '.45'; moreTool.style.cursor = 'not-allowed' }
  panel.querySelectorAll('[data-portal]').forEach((b) => {
    b.disabled = true
    b.style.opacity = '.45'
    b.style.cursor = 'not-allowed'
  })
  panel.querySelector('[data-end]')?.addEventListener('click', async (e) => {
    await api('/api/cloud/close', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: e.currentTarget.dataset.end }) })
    state.cloudTabs = state.cloudTabs.filter((t) => t.id !== e.currentTarget.dataset.end)
    state.cloudTab = 'new'
    renderCloudPanel()
    toast('会话已结束，容器销毁')
  })
  panel.querySelector('[data-portal]')?.addEventListener('click', () => toast('已在服务端注入凭据并进入系统（演示）'))

  const grip = panel.querySelector('#cbGrip')
  grip.addEventListener('pointerdown', (ev) => {
    ev.preventDefault()
    grip.setPointerCapture(ev.pointerId)
    document.body.classList.add('resizing')
    const startX = ev.clientX
    const startW = panel.getBoundingClientRect().width
    const move = (e2) => {
      const maxW = Math.max(220, Math.min(820, window.innerWidth - 58 - (document.getElementById('sidebar')?.getBoundingClientRect().width || 0) - 240))
      state.cbW = Math.min(maxW, Math.max(220, startW + (startX - e2.clientX)))
      state.cbUserW = state.cbW
      document.documentElement.style.setProperty('--cb-w', `${state.cbW}px`)
      sendNativeBounds()
    }
    const up = () => {
      grip.removeEventListener('pointermove', move)
      grip.removeEventListener('pointerup', up)
      localStorage.setItem('jg.cbW', state.cbW)
      localStorage.setItem('jg.cbPaneW', state.cbUserW)
      document.body.classList.remove('resizing')
    }
    grip.addEventListener('pointermove', move)
    grip.addEventListener('pointerup', up)
  })
  syncNativeBrowser(active)
}

var nativeWebUrl = ''
var nativeWebObserver = null

function sendNativeBounds() {
  const bridge = window.jgClient?.browser
  const slot = document.getElementById('cbWebSlot')
  if (!bridge || !slot) return
  const r = slot.getBoundingClientRect()
  bridge.bounds({
    x: Math.round(r.left),
    y: Math.round(r.top),
    width: Math.round(r.width),
    height: Math.round(r.height),
  })
}

function closeNativeWeb() {
  nativeWebUrl = ''
  if (nativeWebObserver) { nativeWebObserver.disconnect(); nativeWebObserver = null }
  window.jgClient?.browser?.close()
}

function syncNativeBrowser(active) {
  const bridge = window.jgClient?.browser
  if (!bridge) return
  if (!active || active.kind !== 'web') return closeNativeWeb()
  if (nativeWebUrl !== active.url) {
    nativeWebUrl = active.url
    bridge.open(active.url)
  }
  requestAnimationFrame(sendNativeBounds)
  if (window.ResizeObserver) {
    if (!nativeWebObserver) nativeWebObserver = new ResizeObserver(() => sendNativeBounds())
    nativeWebObserver.disconnect()
    const slot = document.getElementById('cbWebSlot')
    if (slot) nativeWebObserver.observe(slot)
  }
}

window.addEventListener('resize', () => { if (nativeWebUrl) requestAnimationFrame(sendNativeBounds) })

var cloudDownloads = []
var cloudDownloadsBound = false
function initCloudBrowserBridge() {
  const bridge = window.jgClient?.browser
  if (!bridge || cloudDownloadsBound) return
  cloudDownloadsBound = true
  if (typeof bridge.onDownload === 'function') {
    bridge.onDownload((entry) => {
      if (!entry?.id) return
      cloudDownloads = [entry, ...cloudDownloads.filter((x) => x.id !== entry.id)].slice(0, 40)
      const list = document.getElementById('cbDlList')
      if (list) list.innerHTML = cloudDownloadRows(cloudDownloads)
      if (entry.state === 'completed') toast(`下载完成：${entry.name}`)
      if (entry.state === 'failed') toast(`下载失败：${entry.name}`, true)
    })
  }
  bridge.downloads?.().then((res) => { if (res?.items?.length) cloudDownloads = res.items }).catch(() => {})
}

function cloudDownloadRows(items) {
  if (!items.length) return `<div class="mc-block" style="padding:12px"><div class="mc-dim">还没有下载记录。在右侧网页里点击下载链接后，文件会保存到本机“下载/九规智能中枢”目录。</div></div>`
  return items.map((item) => {
    const stateLabel = item.state === 'completed' ? '已完成' : item.state === 'downloading' ? '下载中' : item.state === 'cancelled' ? '已取消' : '失败'
    const pct = item.total ? Math.min(100, Math.round((item.received / item.total) * 100)) : 0
    return `<div class="mc-block" style="padding:10px;margin-bottom:8px">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <div style="flex:1;min-width:220px"><div style="font-size:12px">${esc(item.name)}</div>
        <div class="mc-id mono" style="margin-top:4px;word-break:break-all">${esc(item.path || '')}</div></div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          <span class="tag${item.state === 'completed' ? ' ok' : ''}">${stateLabel}${item.state === 'downloading' && item.total ? ` ${pct}%` : ''}</span>
          ${item.state === 'completed' ? `<button class="btn sm" data-dl-open="${esc(item.path)}">打开</button><button class="btn sm" data-dl-reveal="${esc(item.path)}">定位</button>` : ''}
        </div>
      </div>
    </div>`
  }).join('')
}

async function openCloudDownloads() {
  initCloudBrowserBridge()
  const bridge = window.jgClient?.browser
  if (!bridge) return toast('当前环境没有 Electron 下载桥接', true)
  const mask = openModal('浏览器下载与文件', `<div style="min-width:620px;max-width:80vw">
    <div class="mc-id" style="margin-bottom:10px">真实下载记录 · 保存位置：系统“下载/九规智能中枢”</div>
    <div id="cbDlList"><div class="mc-dim">正在读取下载记录…</div></div>
    <div class="mc-id" style="margin-top:10px">下载完成后可打开文件或在资源管理器中定位；未完成的下载不会显示为成功。</div>
  </div>`, { wide: true })
  const list = mask.querySelector('#cbDlList')
  try {
    const res = await bridge.downloads()
    cloudDownloads = res?.items || cloudDownloads
    list.innerHTML = cloudDownloadRows(cloudDownloads)
  } catch (error) {
    list.innerHTML = `<div class="mc-block" style="padding:12px">${esc(error?.message || '读取下载记录失败')}</div>`
  }
  list.addEventListener('click', (event) => {
    const open = event.target.closest('[data-dl-open]')
    const reveal = event.target.closest('[data-dl-reveal]')
    if (open) bridge.openDownload(open.dataset.dlOpen)
    else if (reveal) bridge.revealDownload(reveal.dataset.dlReveal)
  })
}

async function handoffWebPageToAI() {
  const bridge = window.jgClient?.browser
  if (!bridge) return toast('当前环境没有网页桥接', true)
  let info = {}
  let pageText = ''
  try { info = await bridge.pageInfo() } catch (_) {}
  try { const res = await bridge.pageText(); pageText = String(res?.text || '') } catch (_) {}
  const url = String(info?.url || nativeWebUrl || '').trim()
  const title = String(info?.title || '').trim() || url
  if (!url) return toast('当前没有可转交的网页', true)
  const excerpt = pageText.replace(/\s+/g, ' ').trim().slice(0, 6000)
  state.cloudOpen = false
  closeNativeWeb()
  state.view = state.view === 'chat' ? 'chat' : 'home'
  state.taskMode = 'work'
  state.draft = `请阅读以下网页，并基于它回答我的问题。\n标题：${title}\n链接：${url}\n${excerpt ? `\n网页正文（截取）：\n${excerpt}\n` : ''}\n我的问题：`
  applyLayout()
  render()
  renderTopbar()
  setTimeout(() => {
    const input = document.getElementById('draft')
    if (input) {
      input.focus()
      input.setSelectionRange(input.value.length, input.value.length)
    }
  }, 30)
  toast('网页已转交到对话输入框，补充问题后发送')
}


function openCloudMore(anchor) {
  document.querySelectorAll('.cb-more-pop').forEach((p) => p.remove())
  const pop = document.createElement('div')
  pop.className = 'cb-more-pop'
  pop.innerHTML = `
    <button class="cbm-item" data-cbm="find">在页面中查找</button>
    <button class="cbm-item" data-cbm="print">打印</button>
    <div class="cbm-sep"></div>
    <div class="cbm-zoom"><span>缩放</span><span class="cbm-scale"><i>−</i><b>100%</b><i>+</i></span><span class="cbm-reset">${icon('refresh')}</span></div>
    <div class="cbm-sep"></div>
    <button class="cbm-item" data-cbm="device">设备工具栏<span class="cbm-arrow">›</span></button>
    <button class="cbm-item cbm-off" disabled>截取屏幕截图</button>
    <div class="cbm-sep"></div>
    <button class="cbm-item" data-cbm="cookie">导入 Cookie 和密码…</button>
    <button class="cbm-item" data-cbm="password">密码和自动填充<span class="cbm-arrow">›</span></button>
    <button class="cbm-item" data-cbm="download">下载</button>
    <button class="cbm-item" data-cbm="history">历史记录</button>
    <button class="cbm-item" data-cbm="clear">清除浏览数据</button>
    <div class="cbm-sep"></div>
    <button class="cbm-item" data-cbm="settings">浏览器设置</button>`
  document.body.appendChild(pop)
  const r = anchor.getBoundingClientRect()
  const w = 236
  pop.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)) + 'px'
  const h = pop.offsetHeight
  pop.style.top = Math.round(Math.max(8, Math.min(window.innerHeight - h - 8, r.bottom + 6))) + 'px'
  const close = () => pop.remove()
  setTimeout(() => document.addEventListener('click', close, { once: true }), 0)
  pop.querySelectorAll('[data-cbm]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation()
    pop.remove()
    const map = {
      find: '页面内查找仅对当前会话画面生效（演示）',
      print: '打印走企业打印策略，需审批后执行（演示）',
      device: '设备工具栏用于切换移动端视口（演示）',
      cookie: '导入 Cookie 与密码需凭据库授权，客户端不落盘（演示）',
      password: '自动填充由企业凭据库注入，明文不出服务端（演示）',
      download: '下载记录进审计，敏感文件按数据分级管控（演示）',
      history: '云会话历史仅保留在企业侧，客户端可查询（演示）',
      clear: '清除浏览数据会同时清理容器侧缓存（演示）',
      settings: '浏览器设置由管理员统一下发，个人不可改（演示）',
    }
    toast(map[b.dataset.cbm] || '演示操作')
  }))
}

function openCloudExtensions(anchor) {
  document.querySelectorAll('.cb-ext-pop').forEach((p) => p.remove())
  const exts = state.cloudExts || []
  const pop = document.createElement('div')
  pop.className = 'cb-ext-pop'
  const rows = () => exts.map((x) => `
    <div class="ce-row">
      <span class="ce-ico">${icon('grid')}</span>
      <div class="ce-meta"><b>${esc(x.name)}</b><span>${esc(x.desc)}</span></div>
      <button class="ce-toggle${x.on ? ' on' : ''}" data-ext-toggle="${x.id}" title="${x.on ? '停用' : '启用'}"><i></i></button>
    </div>`).join('')
  pop.innerHTML = `
    <div class="ce-head"><b>扩展程序</b><span class="ce-count">${exts.filter((x) => x.on).length} 个已启用</span></div>
    <div class="ce-list">${rows()}</div>
    <div class="ce-note">扩展运行在隔离容器内，安装与启用需管理员白名单审批。</div>
    <div class="ce-foot">
      <button class="ce-btn" data-ext-install>${icon('plus')}从商店安装</button>
      <button class="ce-btn" data-ext-dev>加载已解压扩展</button>
    </div>`
  document.body.appendChild(pop)
  const r = anchor.getBoundingClientRect()
  pop.style.left = Math.max(8, Math.min(window.innerWidth - 308, r.left - 250)) + 'px'
  const h = pop.offsetHeight
  pop.style.top = Math.round(Math.max(8, Math.min(window.innerHeight - h - 8, r.bottom + 8))) + 'px'
  const refresh = () => {
    pop.querySelector('.ce-list').innerHTML = rows()
    pop.querySelector('.ce-count').textContent = `${exts.filter((x) => x.on).length} 个已启用`
    const dot = document.getElementById('cbExt')?.querySelector('.cb-ext-dot')
    if (dot) dot.textContent = String(exts.filter((x) => x.on).length)
    bindToggles()
  }
  const bindToggles = () => {
    pop.querySelectorAll('[data-ext-toggle]').forEach((btn) => btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const ext = exts.find((x) => x.id === btn.dataset.extToggle)
      if (!ext) return
      ext.on = !ext.on
      toast(`${ext.on ? '已启用' : '已停用'}扩展「${ext.name}」`)
      refresh()
    }))
  }
  bindToggles()
  pop.querySelector('[data-ext-install]').addEventListener('click', (e) => {
    e.stopPropagation()
    toast('已打开扩展商店：选择扩展后需管理员审批（演示）')
  })
  pop.querySelector('[data-ext-dev]').addEventListener('click', (e) => {
    e.stopPropagation()
    toast('已打开加载入口：选择本地扩展目录，校验签名后启用（演示）')
  })
  const close = (e) => {
    if (pop.contains(e.target) || anchor.contains(e.target)) return
    pop.remove()
    document.removeEventListener('pointerdown', close)
  }
  setTimeout(() => document.addEventListener('pointerdown', close), 0)
}

function submitCloudAddr(panel) {
  const v = panel.querySelector('#cbAddr').value.trim().toLowerCase()
  if (!v) return
  const sys = (state.cloud?.systems || []).find((s) => s.host.toLowerCase() === v || s.host.toLowerCase().includes(v) || s.name.includes(v))
  if (!sys) { toast('云浏览器只打开已登记的企业系统，该地址未登记', true); return }
  openCloudTab(sys.id)
}

async function openCloudTab(systemId) {
  const { ok, body } = await api('/api/cloud/open', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ systemId }) })
  if (!ok) {
    openModal('无法打开云会话', `
      <div class="notice">${esc(body.error)}</div>
      <div class="field" style="margin-top:10px"><div class="field-label">目标系统</div><div class="field-value">${esc(body.detail?.system || '')} · ${esc(body.detail?.network || '')}</div></div>
      <div class="field"><div class="field-label">所需审批</div><div class="field-value">${body.detail?.approval === 'dept' ? '部门负责人审批后开通' : body.detail?.approval === 'secret' ? '涉密授权与安全管理员审批' : '无需审批'}</div></div>
      <div class="form-note">拒绝已写入审计；审批通过后再次打开即可，凭据不会因为审批而暴露给客户端。</div>`, {})
    toast(body.error, true)
    return
  }
  const sys = state.cloud.systems.find((x) => x.id === systemId) || {}
  const tab = { id: body.session.id, kind: 'session', title: sys.name || systemId, systemId, host: sys.host, session: body.session, ticket: body.ticket }
  state.cloudTabs = state.cloudTabs.filter((t) => t.id !== tab.id)
  state.cloudTabs.push(tab)
  state.cloudTab = tab.id
  renderCloudPanel()
}

/* ---------------------------- placeholder --------------------------- */

function renderPlaceholder(el) {
  const label = state.boot.modules[state.view]?.label || ''
  const detail = {
    oneMap: ['一张图'],
    oa: ['OA 办公'],
    review: ['审图平台'],
    finance: ['财务管理'],
    bid: ['智能投标'],
    monitor: ['综合监测'],
    renewal: ['城市体检和更新'],
    hr: ['人事组织'],
    adminops: ['综合管理'],
  }[state.view] || [label]
  el.innerHTML = `
    <div class="view-head"><div><div class="view-title">${esc(detail[0])}</div></div></div>
    <div class="placeholder">${state.view === 'adminops' ? '入口待接入 · 通知公告发布等管理操作需按角色授权' : '入口待接入'}</div>`
}

/* ------------------------- modals & demo flows ------------------------- */

function openModal(title, body, opts = {}) {
  document.querySelectorAll('.jg-modal-mask').forEach((m) => m.remove())
  const mask = document.createElement('div')
  mask.className = 'jg-modal-mask open'
  mask.innerHTML = `<div class="jg-modal ${opts.wide ? 'wide' : ''}">
    <div class="jg-modal-head"><div class="jg-modal-title">${title}</div><span class="spacer"></span><button class="btn subtle jg-modal-x" data-mclose title="关闭" aria-label="关闭">${icon('close')}</button></div>
    <div class="jg-modal-body">${body}</div>
  </div>`
  document.body.appendChild(mask)
  // 顶部 X 已经是统一关闭入口；正文/底部重复的“取消”“关闭”只保留 X，避免两个关闭入口。
  // 有些弹窗会在异步完成后重写正文，因此用观察器持续标记动态加入的重复按钮。
  const markDuplicateDismiss = () => {
    mask.querySelectorAll('.jg-modal-body button').forEach((btn) => {
      const label = String(btn.textContent || '').replace(/\s+/g, '').trim()
      if (label === '取消' || label === '关闭') btn.classList.add('jg-modal-dup-dismiss')
    })
  }
  markDuplicateDismiss()
  const dismissObserver = new MutationObserver(markDuplicateDismiss)
  dismissObserver.observe(mask, { childList: true, subtree: true })
  mask.querySelector('[data-mclose]').addEventListener('click', () => { dismissObserver.disconnect(); mask.remove() })
  mask.addEventListener('click', (e) => { if (e.target === mask) { dismissObserver.disconnect(); mask.remove() } })
  if (typeof opts.onMount === 'function') opts.onMount(mask)
  return mask
}

const closeModals = () => document.querySelectorAll('.jg-modal-mask').forEach((m) => m.remove())
window.JGVisualHost = {
  openModal,
  toast,
  api,
  refresh: () => renderView(),
}

async function switchNetwork() {
  const order = (state.boot.allNetworks || []).map((n) => n.id)
  const cur = state.boot.network?.id || 'inet'
  const next = order[(order.indexOf(cur) + 1) % order.length]
  await api('/api/network', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: next }) })
  await loadBoot()
  state.conversation = null
  state.selectedResource = null
  state.cloud = null
  state.cloudTabs = [{ id: 'new', kind: 'new', title: '新标签页' }]
  state.cloudTab = 'new'
  if (state.cloudOpen) ensureCloud().then(renderCloudPanel)
  render()
  toast(`已切换演示网络：${state.boot.network.label}（仅演示环境差异，真实三网不互通）`)
}

/* ---- 资源登记 ---- */

async function openRegisterForm() {
  const user = state.boot.user
  const orgUnits = state.boot.orgUnits || []
  const businessCategories = ['规划', '建筑', '市政', '风景园林', '测绘', '企业经营管理', '总工办', '其他']
  const orgMap = new Map()
  orgUnits.forEach((u) => {
    const deps = u.departments || []
    if (u.kind === '集团') {
      deps.forEach((d) => { if (!orgMap.has(`unit:${d.unit}`)) orgMap.set(`unit:${d.unit}`, u.name) })
    } else if (deps[0]) {
      orgMap.set(`unit:${deps[0].unit}`, u.name)
    }
  })
  const allDepts = orgUnits.flatMap((u) => u.departments || [])
  const sourceDept = allDepts.find((d) => d.head === user.name) || allDepts.find((d) => d.unit === user.unit)
  const sourceOrgName = sourceDept?.name || user.unit
  const orgOptions = orgMap.size ? [...orgMap.entries()] : [['unit:规划一所', '规划一所'], ['unit:测绘地理信息中心', '测绘地理信息中心'], ['unit:集团总部', '集团总部'], ['unit:智数中心', '智数中心']]
  const pureTypes = ['gis', '3d', 'cad', 'document', 'image', 'video', 'bizdata']
  const formats = ['PDF', 'DOCX', 'XLSX', 'PPTX', 'SHP', 'GDB', 'DWG', 'GeoTIFF', '3D Tiles', 'CSV', '其他']
  const mapCategories = [['satellite', '01 卫星影像'], ['current', '02 现状数据'], ['planning', '03 规划数据'], ['construction', '04 建设工程数据'], ['management', '05 管理数据'], ['socioeconomic', '06 社会经济数据'], ['threeD', '07 三维数据']]
  const spatialTypes = [['GIS_VECTOR', 'GIS 矢量'], ['GIS_RASTER', 'GIS 栅格'], ['3D_MODEL', '三维模型'], ['POINT_CLOUD', '点云'], ['BIM', 'BIM 模型']]
  const zones = [['intranet', '内网'], ['gov', '政务外网'], ['inet', '互联网']]
  let kind = 'pure'
  let files = []
  let projects = state.projects || []
  if (!projects.length) {
    try {
      const res = await api('/api/projects')
      projects = res.ok ? (res.body.items || []) : []
    } catch (e) { projects = [] }
  }

  const now = new Date()
  const pad2 = (n) => String(n).padStart(2, '0')
  const uploadAt = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`

  const body = `
    <div class="reg-wrap">
      <div class="reg-stepper" id="rfStepper">
        <div class="reg-stepper-item on" data-step-item="1"><i>1</i><span>数据类型与上传</span></div>
        <div class="reg-stepper-line"></div>
        <div class="reg-stepper-item" data-step-item="2"><i>2</i><span>元数据信息</span></div>
        <div class="reg-stepper-line"></div>
        <div class="reg-stepper-item" data-step-item="3"><i>3</i><span>安全与授权</span></div>
      </div>
      <div class="reg-lead" id="rfLead">先选择数据类型并上传本地数据；数据就绪后再填写元数据、空间分类与简介；最后确认安全与授权。</div>

      <div class="reg-block" data-reg-step="1">
        <div class="reg-block-head">1 数据类型</div>
        <div class="reg-kinds" id="rfKinds">
          <button type="button" class="reg-kind on" data-kind="pure"><span class="ico">${icon('doc')}</span><span class="reg-kind-name">普通数据</span><span class="reg-kind-desc">单项数据，单文件或单图层</span></button>
          <button type="button" class="reg-kind" data-kind="deliverable"><span class="ico">${icon('folder')}</span><span class="reg-kind-name">成果数据</span><span class="reg-kind-desc">生产部门标准成果，文件夹内含多种格式</span></button>
          <button type="button" class="reg-kind" data-kind="service"><span class="ico">${icon('globe')}</span><span class="reg-kind-name">数据服务</span><span class="reg-kind-desc">发布一个地址，按服务方式调用</span></button>
        </div>
        <div id="rfDeliverableFields" hidden>
          <div class="reg-sub-head">1.1 关联 OA 立项项目与成果信息</div>
          <div class="form-grid">
            <label>关联 OA 立项项目（必填）<select id="rfProjectSel"><option value="">请选择 OA 立项项目</option>${projects.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label>
            <label>OA 立项编号（自动带入）<input id="rfProjectId" readonly placeholder="选择 OA 立项项目后自动带入"></label>
            <label>成果类别<select id="rfResultCategory"><option>规划成果</option><option>建筑成果</option><option>市政成果</option><option>风景园林成果</option><option>测绘成果</option><option>其他成果</option></select></label>
            <label>项目阶段<select id="rfResultStage"><option>方案阶段</option><option>初步设计</option><option>施工图</option><option>竣工成果</option><option>历史成果</option></select></label>
            <label>成果版本<input id="rfResultVersion" value="V1.0" placeholder="例如：V1.0"></label>
          </div>
          <div class="form-note">成果数据必须绑定 OA 立项项目；OA 立项编号作为业务关联键，版本用于历史追溯与重复校验。</div>
        </div>
        <div id="rfServiceFields" hidden>
          <div class="reg-sub-head">1.1 服务地址与检测</div>
          <div class="form-grid">
            <label>服务地址（必填）<input id="rfServiceUrl" placeholder="例如：https://map.jg.local/qgis/wms/city-plan"></label>
            <label>服务类型<select id="rfServiceType"><option>QGIS WMS</option><option>QGIS WFS</option><option>QGIS WMTS</option><option>OGC API</option><option>Cesium 3D Tiles</option><option>PostGIS 空间 API</option><option>REST API</option></select></label>
          </div>
          <div class="ver-acts" style="margin-top:2px"><button type="button" class="btn sm" id="rfServiceDetect">检测服务</button><span class="form-note" id="rfServiceDetectStatus" style="margin:0">输入地址后可检测协议、格式与连接状态。</span></div>
          <div class="form-note">服务登记只建立资源记录与访问配置，不重复存储源数据；访问密钥须由安全凭据管理，不得明文写入元数据。</div>
        </div>
        <div id="rfUploadFields">
          <div class="reg-sub-head" id="rfUploadSubhead">1.1 上传文件或文件夹</div>
          <div class="reg-drop" id="rfDrop">
            <div class="reg-drop-title">拖拽文件、文件夹或压缩包到这里</div>
            <div class="reg-drop-note">也可以从本地选择；文件夹会读取相对路径形成 manifest，ZIP / 7Z / RAR 由登记服务解包后检测目录结构与格式。</div>
            <div class="reg-drop-acts">
              <label class="btn sm">${icon('doc')}选择文件<input type="file" id="rfFiles" multiple hidden></label>
              <label class="btn sm">${icon('folder')}选择文件夹<input type="file" id="rfFolder" webkitdirectory directory multiple hidden></label>
              <label class="btn sm">${icon('upload')}选择压缩包<input type="file" id="rfZip" accept=".zip,.7z,.rar,.tar,.gz" hidden></label>
            </div>
          </div>
          <div id="rfFileList" class="reg-filelist"></div>
        </div>
        <div id="rfServiceNoFile" class="form-note" hidden>数据服务无需上传文件，下一步填写服务地址与元数据。</div>
      </div>

      <div class="reg-block" data-reg-step="2" hidden>
        <div class="reg-block-head">2 元数据信息</div>
        <div class="reg-sub-head">2.1 基础信息</div>
        <div class="form-grid">
          <label>数据 ID（系统生成）<input id="rfDataId" value="提交后自动生成" readonly></label>
          <label>数据名称<input id="rfName" placeholder="例如：九江市道路中心线"></label>
          <label>业务分类<select id="rfDomain">${businessCategories.map((d) => `<option>${esc(d)}</option>`).join('')}</select></label>
          <label>数据来源（系统生成）<input id="rfSourceOrg" value="${esc(user.name)} · ${esc(sourceOrgName)}" readonly></label>
          <label>数据负责人（系统生成）<input id="rfDataOwner" value="${esc(user.name)}" readonly></label>
          <label>原始来源<select id="rfOriginalSource"><option>集团自产</option><option>外部单位提供</option><option>上级部门下发</option><option>其他</option></select></label>
          <label>数据上传时间（系统生成）<input id="rfUploadAt" value="${esc(uploadAt)}" readonly></label>
          <label>数据格式（自动识别）<input id="rfFormatsAuto" readonly placeholder="选择文件后自动汇总"></label>
          <label>数据大小（自动计算）<input id="rfSizeAuto" readonly placeholder="选择文件后自动计算"></label>
        </div>
        <div id="rfKindFields"></div>
        <label class="check-line" style="margin-top:16px"><input type="checkbox" id="rfSpatialToggle">识别为 GIS / 三维空间数据，填写一张图分类与空间字段</label>
        <div id="rfSpatialFields" hidden>
          <div class="form-grid">
            <label>空间数据类型<select id="rfSpatialType">${spatialTypes.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
            <label>一张图一级分类<select id="rfMapCatalog">${mapCategories.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
            <label>一张图目录路径<input id="rfMapPath" placeholder="例如：详细规划 / 控制性详细规划 / 用地规划"></label>
            <label>行政区域（自动识别）<input id="rfRegions" value="待按空间范围识别" readonly></label>
            <label>空间坐标系统<input id="rfCrs" placeholder="例如：EPSG:4490"></label>
            <label>空间覆盖范围<input id="rfExtent" placeholder="例如：115.98,29.72,116.02,29.76"></label>
            <label>测绘比例尺<input id="rfScale" placeholder="例如：1:500（非测绘数据可留空）"></label>
            <label>空间数据集 ID<input id="rfDatasetId" value="登记后自动生成" readonly></label>
          </div>
          <div class="ver-acts" style="margin-top:2px"><button type="button" class="btn sm" id="rfRegionBtn">按空间范围识别行政区</button><span class="form-note" id="rfRegionNote" style="margin:0">读取矢量坐标与覆盖范围，与行政区划边界做叠加分析。</span></div>
          <div class="form-note">一张图只存目录节点 ID，完整路径由父子关系生成；确认目录仅完成元数据分类，正式进一张图还需图层适配、权限校验与发布控制。</div>
        </div>
        <div class="form-label">数据简介（人工填写）</div>
        <textarea id="rfDesc" rows="3" class="form-area" placeholder="由登记人填写数据内容、覆盖范围、统计口径与使用限制；不使用 AI 自动生成。"></textarea>
        <div class="form-label">质检设置（可选）</div>
        <label class="check-line"><input type="checkbox" id="rfQcToggle">需要质检软件质检（可选，适用于普通数据、成果数据和数据服务）</label>
        <div id="rfQcWrap" hidden style="margin-top:8px">
          <label>质检软件<select id="rfQcSoftware"><option>规划成果质检系统</option><option>测绘成果质检系统</option><option>数据服务质检工具</option><option>其他（人工上传报告）</option></select></label>
        </div>
      </div>


      <div class="reg-block" data-reg-step="3" hidden>
        <div class="reg-block-head">3 安全与授权</div>
        <div class="form-grid">
          <label>内部安全等级<select id="rfInternalLevel"><option>L1</option><option selected>L2</option><option>L3</option><option>L4</option><option>L5</option></select></label>
          <label>涉密属性<select id="rfSecrecy"><option>非涉密</option><option>待认定</option><option>秘密</option><option>机密</option><option>绝密</option></select></label>
          <label>访问范围<select id="rfAccessScope"><option value="self">仅本人</option><option value="dept" selected>本部门可见</option><option value="group">集团内部可见</option><option value="orgs">指定人员或角色</option></select></label>
          <label>数据权属及使用依据<input id="rfRightsBasis" placeholder="例如：集团数据权属管理办法 / 项目合同"></label>
        </div>
        <div class="form-label">允许访问环境（申请）</div>
        <div class="check-row">${zones.map(([v, l]) => `<label class="check"><input type="checkbox" class="rf-zone" value="${v}" ${v === (state.boot.network?.id || 'inet') ? 'checked' : ''}>${esc(l)}</label>`).join('')}</div>
        <div class="form-note">网络可见范围按层级展开：勾选互联网会自动包含政务外网与内网；勾选政务外网会自动包含内网。内网目录的数据最全。</div>
        <div id="rfOrgsWrap" hidden>
          <div class="form-label">授权部门或角色</div>
          <div class="check-row">${orgOptions.map(([v, l]) => `<label class="check"><input type="checkbox" class="rf-org" value="${v}">${esc(l)}</label>`).join('')}</div>
        </div>
        <div class="form-note">登记成功只表示资源进入统一目录，不等于已发布或开放访问；发布状态独立管理（未发布 / 待审核 / 已发布 / 已停用）。</div>
        <div class="form-note">员工申报、系统校验、有权人员批准。即使勾选互联网，也不等于可把内网数据直接发布到互联网；跨安全域须走独立安全审批与交换流程。</div>
        <div class="reg-sub-head">3.1 登记流程</div>
        <div class="reg-flow">
          <div class="reg-flow-step on"><i>1</i><span>部门负责人同意登记</span></div>
          <div class="reg-flow-step" id="rfQcStep"><i>2</i><span>质检软件质检</span></div>
          <div class="reg-flow-step"><i>3</i><span>数据管理员质量评估</span></div>
          <div class="reg-flow-step"><i>4</i><span>登记入库</span></div>
        </div>
        <div class="form-note" id="rfFlowNote"></div>
      </div>
    </div>
    <div class="form-foot"><span class="mono">网络：${esc(state.boot.network?.label || '')}（登记到本网目录）</span><span class="spacer"></span><button class="btn" data-mclose>取消</button><button class="btn" id="rfPrev" hidden>上一步</button><button class="btn primary" id="rfNext">下一步：填写元数据</button><button class="btn primary" id="rfSubmit" hidden>提交登记</button></div>`

  const mask = openModal('登记资源', body, { wide: true })
  mask.querySelectorAll('[data-mclose]').forEach((b) => b.addEventListener('click', () => mask.remove()))
  const q = (id) => mask.querySelector(`#${id}`)
  let wizardStep = 1
  function setWizardStep(step) {
    wizardStep = step
    mask.querySelectorAll('[data-reg-step]').forEach((el) => { el.hidden = Number(el.dataset.regStep) !== step })
    mask.querySelectorAll('[data-step-item]').forEach((el) => {
      const n = Number(el.dataset.stepItem)
      el.classList.toggle('on', n === step)
      el.classList.toggle('done', n < step)
    })
    q('rfPrev').hidden = step === 1
    q('rfNext').hidden = step === 3
    q('rfSubmit').hidden = step !== 3
    q('rfLead').hidden = step !== 1
    q('rfNext').textContent = step === 1 ? '下一步：填写元数据' : '下一步：安全与授权'
    mask.querySelector('.jg-modal-body').scrollTop = 0
  }
  const fmtSize = (n) => {
    if (!n && n !== 0) return '—'
    if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`
    if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`
    if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`
    return `${n} B`
  }

  function extOf(f) {
    const m = String(f.name || f.path || '').match(/\.([a-z0-9]+)$/i)
    return m ? m[1].toUpperCase() : '未知'
  }

  function updateAutoMeta() {
    let autoFormats = [...new Set(files.map(extOf).filter((x) => x && x !== '未知'))]
    const total = files.reduce((sum, f) => sum + (Number(f.size) || 0), 0)
    let autoSize = files.length ? `${files.length} 个文件 / ${fmtSize(total)}` : ''
    if (kind === 'service') {
      const st = q('rfServiceType')?.value
      if (st) autoFormats = [st]
      autoSize = '不适用（数据服务）'
    }
    if (kind === 'service') {
      const st = q('rfServiceType')?.value
      if (st) autoFormats = [st]
      autoSize = '不适用（数据服务）'
    }
    const fmtEl = q('rfFormatsAuto')
    const sizeEl = q('rfSizeAuto')
    if (fmtEl) fmtEl.value = autoFormats.join(' / ')
    if (sizeEl) sizeEl.value = autoSize
    if (kind === 'deliverable') {
      mask.querySelectorAll('.rf-format').forEach((c) => { if (autoFormats.includes(c.value)) c.checked = true })
    }
    const spatialFormats = ['SHP', 'GDB', 'GEOTIFF', 'GEOJSON', 'JSON', '3D TILES', 'LAS', 'PLY', 'OSGB']
    const autoSpatial = autoFormats.some((f) => spatialFormats.includes(f)) || (kind === 'pure' && ['gis', '3d'].includes(q('rfType')?.value))
    const toggle = q('rfSpatialToggle')
    if (toggle && autoSpatial) toggle.checked = true
    toggleSpatial()
  }

  function toggleSpatial() {
    const wrap = q('rfSpatialFields')
    if (wrap) wrap.hidden = !q('rfSpatialToggle')?.checked
  }

  let regionSeq = 0
  async function recognizeRegions() {
    const extent = q('rfExtent')?.value.trim() || ''
    const target = q('rfRegions')
    const note = q('rfRegionNote')
    if (!extent) {
      if (target) target.value = '待按空间范围识别'
      if (note) note.textContent = '请先提取或填写空间覆盖范围（minX,minY,maxX,maxY）。'
      return
    }
    const seq = ++regionSeq
    if (note) note.textContent = '正在读取矢量范围并与行政区划边界做叠加分析…'
    const { ok, body } = await api('/api/spatial/recognize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ extent }),
    })
    if (seq !== regionSeq) return
    if (!ok) {
      if (target) target.value = '未匹配到行政区划'
      if (note) note.textContent = body.error || '空间叠加分析未返回结果。'
      return
    }
    if (target) target.value = body.path
    if (note) {
      note.textContent = `${body.note} · 识别层级：${body.level}`
    }
  }

  function toggleAuthOrgs() {
    const wrap = q('rfOrgsWrap')
    if (wrap) wrap.hidden = q('rfAccessScope')?.value !== 'orgs'
  }

  function applyZoneHierarchy() {
    const boxes = [...mask.querySelectorAll('.rf-zone')]
    if (!boxes.length) return
    const by = Object.fromEntries(boxes.map((b) => [b.value, b]))
    if (by.inet?.checked) {
      if (by.gov) by.gov.checked = true
      if (by.intranet) by.intranet.checked = true
    } else if (by.gov?.checked && by.intranet) {
      by.intranet.checked = true
    }
    if (by.intranet && !by.intranet.checked) {
      if (by.gov) by.gov.checked = false
      if (by.inet) by.inet.checked = false
    }
    if (by.gov && !by.gov.checked && by.inet) by.inet.checked = false
  }

  async function autoExtentFromFiles() {
    const geo = files.find((f) => /\.(geojson|json)$/i.test(f.name || ''))
    if (!geo) return false
    try {
      const json = JSON.parse(await geo.text())
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      const walkCoord = (c) => {
        if (!Array.isArray(c)) return
        if (typeof c[0] === 'number' && typeof c[1] === 'number') {
          minX = Math.min(minX, c[0]); maxX = Math.max(maxX, c[0])
          minY = Math.min(minY, c[1]); maxY = Math.max(maxY, c[1])
        } else c.forEach(walkCoord)
      }
      const walk = (node) => {
        if (!node || typeof node !== 'object') return
        if (node.type === 'FeatureCollection') { (node.features || []).forEach(walk); return }
        if (node.type === 'Feature') { walk(node.geometry); return }
        if (node.coordinates) { walkCoord(node.coordinates); return }
        if (node.geometry) walk(node.geometry)
      }
      walk(json)
      if (![minX, minY, maxX, maxY].every(Number.isFinite)) throw new Error('no coordinates')
      q('rfExtent').value = [minX, minY, maxX, maxY].map((n) => Number(n.toFixed(6))).join(',')
      await recognizeRegions()
      return true
    } catch {
      const note = q('rfRegionNote')
      if (note) note.textContent = 'GeoJSON 坐标读取失败；SHP / GDB 请由服务端 GDAL 解析覆盖范围。'
      return false
    }
  }

  function renderFiles() {
    const list = q('rfFileList')
    if (!list) return
    list.innerHTML = files.length
      ? `<div class="reg-file-sum">共 ${files.length} 个文件 / ${files.some((f) => f.relPath || f.webkitRelativePath) ? '文件夹' : '文件'}${files.some((f) => /\.(zip|7z|rar|tar|gz)$/i.test(f.name)) ? ' · 含压缩包' : ''}</div>${files.slice(0, 8).map((f) => `<div class="reg-file-row"><span class="reg-file-name">${esc(f.relPath || f.webkitRelativePath || f.name)}</span><span>${fmtSize(f.size)}</span></div>`).join('')}${files.length > 8 ? `<div class="reg-file-more">另有 ${files.length - 8} 个文件未展开</div>` : ''}`
      : '<span class="mono">尚未选择文件；可选择单个文件、整个文件夹、压缩包，或直接拖拽到上方区域</span>'
    updateAutoMeta()
  }

  function renderKindFields() {
    const zone = q('rfKindFields')
    if (kind === 'pure') {
      zone.innerHTML = `<div class="reg-sub-head">2.2 普通数据补充</div>
        <div class="form-grid">
          <label>技术类型<select id="rfType">${pureTypes.map((t) => `<option value="${t}"${t === 'document' ? ' selected' : ''}>${typeMap[t].label}</option>`).join('')}</select></label>
        </div>
        <div class="form-note">普通数据是单项数据；质检可在上方按需选择，未选择时由数据管理员在质量评估环节核对完整性、坐标系与可用性。</div>`
      const t = q('rfType')
      if (t) t.addEventListener('change', updateAutoMeta)
    } else if (kind === 'deliverable') {
      zone.innerHTML = `<div class="reg-sub-head">2.2 成果数据专属</div>
        <div class="form-grid">
          <label>成果资源 ID<input readonly value="提交后自动生成"></label>
          <label>内部数据 ID<input readonly value="按成果包结构自动生成"></label>
          <label>专业质检状态<input id="rfQcStatus" readonly value="未选择质检"></label>
          <label>质检报告关联<input id="rfQcReport" readonly value="未选择质检"></label>
          <label>包含格式<span class="reg-format-row">${formats.map((f) => `<label class="check"><input type="checkbox" class="rf-format" value="${esc(f)}">${esc(f)}</label>`).join('')}</span></label>
          <label class="check-line"><input type="checkbox" id="rfManifest" checked>包含成果清单与元数据说明</label>
          <label class="check-line"><input type="checkbox" id="rfBatch" checked>按分幅 / 分区批量登记</label>
          <label class="check-line"><input type="checkbox" id="rfFormalResult">登记后标记为“正式成果”（需项目负责人确认）</label>
        </div>
        <div class="reg-qc-panel"><span class="ico">${icon('shield')}</span><span>质检为可选项。如需质检，部门负责人同意后由质检软件执行完整性、坐标系、拓扑、属性与格式检查；质检结果绑定受检资源版本并回写详情。</span></div>`
      const spatialFormats = ['SHP', 'GDB', 'GeoTIFF', '3D Tiles', 'LAS', 'PLY', 'OSGB', 'DWG']
      mask.querySelectorAll('.rf-format').forEach((c) => c.addEventListener('change', () => {
        if (!c.checked || !spatialFormats.includes(c.value)) return
        const toggle = q('rfSpatialToggle')
        if (toggle) toggle.checked = true
        toggleSpatial()
      }))
    } else {
      zone.innerHTML = `<div class="reg-sub-head">2.2 数据服务专属</div>
        <div class="form-grid">
          <label>服务提供方（默认当前部门）<input id="rfServiceProvider" value="${esc(user.unit || '')}" placeholder="例如：集团信息中心"></label>
          <label>网络域（按地址推断，可修改）<select id="rfServiceZone"><option>内网</option><option>政务外网</option><option>互联网</option></select></label>
          <label>鉴权方式<select id="rfAuthMode"><option>统一网关票据</option><option>OAuth2 客户端凭证</option><option>内网 IP 白名单</option><option>无鉴权（仅内网）</option></select></label>
        </div>
        <div class="form-note">服务通过连接校验后完成登记并进入服务目录；开放调用前另行执行发布审核。调用量、延迟与鉴权状态由服务网关回写。</div>`
      const zoneSel = q('rfServiceZone')
      if (zoneSel) {
        if (mask.dataset.serviceZone) zoneSel.value = mask.dataset.serviceZone
        zoneSel.addEventListener('change', () => {
          zoneSel.dataset.touched = '1'
          mask.dataset.serviceZone = zoneSel.value
        })
      }
      const st = q('rfServiceType')
      if (st) st.addEventListener('change', updateAutoMeta)
    }
    syncQc()
    updateAutoMeta()
  }

  function renderFlow() {
    const on = !!q('rfQcToggle')?.checked
    const qc = q('rfQcStep')
    if (qc) {
      qc.classList.toggle('off', !on)
      qc.querySelector('span').textContent = on ? '质检软件质检（可选）' : '质检软件质检（未选择）'
    }
    q('rfFlowNote').textContent = on
      ? '已选择质检：部门负责人先同意登记 → 质检软件质检 → 数据管理员质量评估 → 登记入库。'
      : '未选择质检：部门负责人先同意登记 → 数据管理员质量评估 → 登记入库。'
  }

  function syncQc() {
    const on = !!q('rfQcToggle')?.checked
    const wrap = q('rfQcWrap')
    if (wrap) wrap.hidden = !on
    const status = q('rfQcStatus')
    if (status) status.value = on ? '待质检' : '未选择质检'
    const report = q('rfQcReport')
    if (report) report.value = on ? '质检通过后回写' : '未选择质检'
    renderFlow()
  }

  function syncKindUpload() {
    const upload = q('rfUploadFields')
    const note = q('rfServiceNoFile')
    const deliverable = q('rfDeliverableFields')
    const service = q('rfServiceFields')
    const isService = kind === 'service'
    if (upload) upload.hidden = isService
    const uploadSubhead = q('rfUploadSubhead')
    if (uploadSubhead) uploadSubhead.textContent = kind === 'deliverable' ? '1.2 上传成果文件' : '1.1 上传文件或文件夹'
    if (note) note.hidden = true
    if (deliverable) deliverable.hidden = kind !== 'deliverable'
    if (service) service.hidden = !isService
  }

  function syncProjectFields() {
    const sel = q('rfProjectSel')
    const p = projects.find((x) => x.id === (sel?.value || ''))
    const idEl = q('rfProjectId')
    if (idEl) idEl.value = p ? p.id : ''
  }

  function inferServiceZone(url) {
    try {
      const host = new URL(url).hostname.toLowerCase()
      if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || host.endsWith('.local')) return '内网'
      if (host.endsWith('.gov.cn') || host.endsWith('.gov')) return '政务外网'
      return '互联网'
    } catch (e) {
      return ''
    }
  }

  function syncInferredServiceZone() {
    const inferred = inferServiceZone(q('rfServiceUrl')?.value.trim() || '')
    if (!inferred) return
    mask.dataset.serviceZone = inferred
    const z = q('rfServiceZone')
    if (z && !z.dataset.touched) z.value = inferred
  }

  async function detectService() {
    const urlEl = q('rfServiceUrl')
    const statusEl = q('rfServiceDetectStatus')
    const url = urlEl?.value.trim() || ''
    if (!/^https?:\/\//i.test(url)) {
      if (statusEl) statusEl.textContent = '请填写以 http:// 或 https:// 开头的服务地址。'
      return
    }
    let parsed
    try { parsed = new URL(url) } catch (e) {
      if (statusEl) statusEl.textContent = '服务地址格式不正确。'
      return
    }
    const path = parsed.pathname.toLowerCase()
    const st = q('rfServiceType')
    if (st) {
      if (path.includes('wmts')) st.value = 'QGIS WMTS'
      else if (path.includes('wfs')) st.value = 'QGIS WFS'
      else if (path.includes('wms')) st.value = 'QGIS WMS'
      else if (path.includes('3dtiles') || path.includes('tileset')) st.value = 'Cesium 3D Tiles'
      else if (path.includes('/api') || path.includes('rest')) st.value = 'REST API'
      else st.value = 'OGC API'
    }
    syncInferredServiceZone()
    updateAutoMeta()
    if (statusEl) statusEl.textContent = '正在检测服务连接…'
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 6000)
    try {
      const res = await fetch(url, { method: 'GET', signal: ctrl.signal, credentials: 'omit' })
      const type = res.headers.get('content-type') || '未知类型'
      if (statusEl) statusEl.textContent = `连接成功 · HTTP ${res.status} · ${type}`
    } catch (e) {
      if (statusEl) statusEl.textContent = e.name === 'AbortError'
        ? '检测超时（6 秒），请确认地址可达，或交由服务端检测。'
        : '浏览器无法直连该地址（可能为跨域或内网限制），请交由服务端检测。'
    } finally {
      clearTimeout(timer)
    }
  }

  async function readDroppedEntry(entry, prefix, out) {
    if (!entry) return
    if (entry.isFile) {
      const file = await new Promise((resolve, reject) => entry.file(resolve, reject))
      try { file.relPath = prefix ? `${prefix}/${file.name}` : file.name } catch (e) { /* 保留原始文件名 */ }
      out.push(file)
      return
    }
    if (entry.isDirectory) {
      const dirPrefix = prefix ? `${prefix}/${entry.name}` : entry.name
      const reader = entry.createReader()
      const readBatch = () => new Promise((resolve, reject) => reader.readEntries(resolve, reject))
      let batch = []
      do {
        batch = await readBatch()
        for (const child of batch) await readDroppedEntry(child, dirPrefix, out)
      } while (batch.length)
    }
  }

  mask.querySelectorAll('#rfKinds [data-kind]').forEach((b) => b.addEventListener('click', () => {
    kind = b.dataset.kind
    mask.querySelectorAll('#rfKinds [data-kind]').forEach((x) => x.classList.toggle('on', x === b))
    const spatialToggle = q('rfSpatialToggle')
    if (spatialToggle) spatialToggle.checked = false
    syncKindUpload()
    renderKindFields()
  }))
  q('rfFiles').addEventListener('change', async (e) => { files = [...files, ...Array.from(e.target.files)]; e.target.value = ''; renderFiles(); await autoExtentFromFiles() })
  q('rfFolder').addEventListener('change', async (e) => { files = [...files, ...Array.from(e.target.files)]; e.target.value = ''; renderFiles(); await autoExtentFromFiles() })
  q('rfZip').addEventListener('change', async (e) => { files = [...files, ...Array.from(e.target.files)]; e.target.value = ''; renderFiles(); await autoExtentFromFiles() })
  const dropZone = q('rfDrop')
  if (dropZone) {
    ['dragenter', 'dragover'].forEach((type) => dropZone.addEventListener(type, (e) => {
      e.preventDefault()
      e.stopPropagation()
      dropZone.classList.add('is-drag')
    }));
    ['dragleave', 'dragend'].forEach((type) => dropZone.addEventListener(type, (e) => {
      e.preventDefault()
      dropZone.classList.remove('is-drag')
    }))
    dropZone.addEventListener('drop', async (e) => {
      e.preventDefault()
      e.stopPropagation()
      dropZone.classList.remove('is-drag')
      const items = Array.from(e.dataTransfer.items || [])
      const entries = items.map((it) => (it.webkitGetAsEntry ? it.webkitGetAsEntry() : null)).filter(Boolean)
      if (entries.length) {
        const dropped = []
        for (const entry of entries) await readDroppedEntry(entry, '', dropped)
        if (dropped.length) files = [...files, ...dropped]
      } else if (e.dataTransfer.files?.length) {
        files = [...files, ...Array.from(e.dataTransfer.files)]
      }
      renderFiles()
      await autoExtentFromFiles()
    })
  }
  q('rfQcToggle').addEventListener('change', syncQc)
  q('rfProjectSel')?.addEventListener('change', syncProjectFields)
  q('rfServiceDetect')?.addEventListener('click', detectService)
  q('rfServiceUrl')?.addEventListener('input', syncInferredServiceZone)
  mask.querySelectorAll('.rf-zone').forEach((b) => b.addEventListener('change', applyZoneHierarchy))
  q('rfSpatialToggle').addEventListener('change', toggleSpatial)
  q('rfRegionBtn').addEventListener('click', recognizeRegions)
  q('rfExtent').addEventListener('change', recognizeRegions)
  q('rfAccessScope').addEventListener('change', toggleAuthOrgs)

  renderKindFields()
  renderFiles()
  syncQc()
  syncKindUpload()
  syncProjectFields()
  toggleAuthOrgs()
  applyZoneHierarchy()
  setWizardStep(1)

  q('rfPrev').addEventListener('click', () => setWizardStep(Math.max(1, wizardStep - 1)))
  q('rfNext').addEventListener('click', () => {
    if (wizardStep === 1) {
      if (kind === 'deliverable' && !q('rfProjectSel')?.value) return toast('请先选择要关联的 OA 立项项目', true)
      if (kind === 'service' && !q('rfServiceUrl')?.value.trim()) return toast('请先填写服务地址', true)
      if (kind !== 'service' && !files.length) {
        const list = q('rfFileList')
        if (list) list.innerHTML = '<div style="padding:10px 2px 0;color:#c0392b;font-size:var(--fs-meta)">请先上传数据文件；可将文件、文件夹或压缩包拖拽到上方虚线区域。</div>'
        q('rfDrop')?.scrollIntoView({ block: 'center' })
        return toast('请先上传数据文件', true)
      }
    }
    if (wizardStep === 2 && !q('rfName').value.trim()) return toast('请先填写数据名称', true)
    setWizardStep(Math.min(3, wizardStep + 1))
  })

  q('rfSubmit').addEventListener('click', async () => {
    const name = q('rfName').value.trim()
    if (!name) return toast('请填写数据名称', true)
    const localFiles = files.map((f) => ({ name: f.name, path: f.relPath || f.webkitRelativePath || f.name, size: fmtSize(f.size), bytes: f.size }))
    const manifest = localFiles
    if (kind !== 'service' && !manifest.length) return toast('请先上传数据文件', true)
    let fileIds = []
    if (kind !== 'service') {
      const submitBtn = q('rfSubmit')
      submitBtn.disabled = true
      try {
        for (let i = 0; i < files.length; i += 1) {
          const f = files[i]
          toast(`正在上传 ${i + 1}/${files.length}：${f.name}`)
          const uploaded = await uploadBinaryFile(f, 'resource')
          if (!uploaded.ok) {
            toast(uploaded.body.error || `「${f.name}」上传失败`, true)
            return
          }
          fileIds.push(uploaded.file.id)
        }
      } finally {
        submitBtn.disabled = false
      }
    }
    const manifestWithIds = manifest.map((m, i) => ({ ...m, fileId: fileIds[i] || m.fileId || '' }))
    const url = q('rfServiceUrl')?.value.trim() || ''
    if (kind === 'service' && !url) return toast('请填写数据服务地址', true)
    const autoFormats = (q('rfFormatsAuto').value || '').split(/\s*\/\s*/).filter(Boolean)
    const packageFormats = [...mask.querySelectorAll('.rf-format:checked')].map((c) => c.value)
    const formats = kind === 'deliverable' ? [...new Set([...autoFormats, ...packageFormats])] : kind === 'service' ? [q('rfServiceType').value] : autoFormats
    const spatialEnabled = !!q('rfSpatialToggle')?.checked
    if (spatialEnabled) {
      if (!q('rfExtent').value.trim()) return toast('请先填写空间覆盖范围，系统才能做空间叠加分析', true)
      if (!q('rfRegions').value.trim() || q('rfRegions').value.includes('待') || q('rfRegions').value.includes('未匹配')) return toast('行政区划尚未识别，请点击「按空间范围识别行政区」', true)
    }
    const spatial = spatialEnabled ? {
      enabled: true,
      type: q('rfSpatialType').value,
      typeLabel: q('rfSpatialType').selectedOptions[0]?.textContent?.trim() || q('rfSpatialType').value,
      mapCatalog: q('rfMapCatalog').value,
      mapPath: q('rfMapPath').value.trim(),
      regions: q('rfRegions').value.trim(),
      crs: q('rfCrs').value.trim(),
      extent: q('rfExtent').value.trim(),
      scale: q('rfScale').value.trim(),
    } : { enabled: false }
    const zones = [...mask.querySelectorAll('.rf-zone:checked')].map((c) => c.value)
    const accessScope = q('rfAccessScope').value
    const authType = accessScope === 'orgs' ? 'orgs' : 'group'
    const orgs = authType === 'orgs' ? [...mask.querySelectorAll('.rf-org:checked')].map((c) => c.value) : []
    const type = kind === 'pure' ? q('rfType').value : kind === 'deliverable' ? 'deliverable' : 'service'
    const format = kind === 'pure' ? (autoFormats[0] || 'PDF') : kind === 'deliverable' ? '成果包（多格式）' : q('rfServiceType').value
    const size = q('rfSizeAuto').value || (manifest.length ? `${manifest.length} 个文件` : '—')
    const sizeBytes = localFiles.reduce((sum, f) => sum + (Number(f.bytes) || 0), 0)
    const qcRequired = !!q('rfQcToggle')?.checked
    const { ok, body: res } = await api('/api/resources/register', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kind,
        dataType: kind === 'pure' ? '普通数据' : kind === 'deliverable' ? '成果数据' : '数据服务',
        name,
        type,
        format,
        size,
        sizeBytes,
        sourceType: 'local',
        source: '本地上传',
        sourceRef: localFiles.map((f) => f.path),
        files: manifestWithIds,
        fileIds,
        formats,
        manifest: kind === 'deliverable' ? !!q('rfManifest')?.checked : false,
        batch: kind === 'deliverable' ? !!q('rfBatch')?.checked : false,
        qcRequired,
        qcSoftware: qcRequired ? q('rfQcSoftware').value : '',
        businessCategory: q('rfDomain').value,
        originalSource: q('rfOriginalSource').value,
        dataDate: q('rfUploadAt').value,
        sourceOrg: sourceOrgName,
        dataOwner: user.name,
        keywords: [],
        caps: [],
        description: q('rfDesc').value.trim(),
        projectLinked: kind === 'deliverable',
        projectId: kind === 'deliverable' ? q('rfProjectSel').value : '',
        projectName: kind === 'deliverable' ? (q('rfProjectSel').selectedOptions[0]?.textContent?.trim() || '') : '',
        resultCategory: kind === 'deliverable' ? q('rfResultCategory').value : '',
        resultStage: kind === 'deliverable' ? q('rfResultStage').value : '',
        version: kind === 'deliverable' ? q('rfResultVersion').value.trim() : '',
        formalResult: kind === 'deliverable' ? !!q('rfFormalResult')?.checked : false,
        owner: sourceOrgName,
        producer: sourceOrgName,
        contact: user.name,
        internalLevel: q('rfInternalLevel').value,
        secrecy: q('rfSecrecy').value,
        zones,
        authorizationType: authType,
        accessScope,
        authorizedOrgs: orgs,
        rightsBasis: q('rfRightsBasis').value.trim(),
        spatial,
        crs: spatial.crs || '',
        coverage: spatial.extent || '',
        serviceUrl: url,
        serviceType: kind === 'service' ? q('rfServiceType').value : '',
        serviceProvider: kind === 'service' ? q('rfServiceProvider').value.trim() : '',
        serviceZone: kind === 'service' ? q('rfServiceZone').value : '',
        serviceDetectStatus: kind === 'service' ? (q('rfServiceDetectStatus')?.textContent || '') : '',
        authMode: kind === 'service' ? q('rfAuthMode').value : '',
      }),
    })
    if (!ok) return toast(res.error || '登记失败', true)
    mask.remove()
    toast(res.item.status === 'authorized'
      ? (kind === 'service' ? `${res.item.id} 已登记，服务发布待审核` : `${res.item.id} 已登记并进入资源目录`)
      : `${res.item.id} 已提交，等待部门负责人同意`)
    state.view = 'datacenter'
    state.resourceType = 'all'
    state.resourceCategory = 'all'
    state.resourcePage = 1
    render()
    await openResource(res.item.id)
  })
}

/* ---- 空间框选 ---- */

function openSpatialPicker() {
  const body = `
    <div class="spatial-wrap">
      <div class="spatial-map" id="spMap">
        <div class="sp-grid"></div>
        <div class="sp-city">九江市域</div>
        <div class="sp-hint" id="spHint">在图上按住拖出矩形范围</div>
        <div class="sp-box" id="spBox" hidden></div>
      </div>
      <div class="spatial-side">
        <div class="form-label">检索范围</div>
        <div class="mono" id="spBbox" style="font-size:var(--fs-meta);color:var(--muted)">未选择</div>
        <div class="check-row" style="margin-top:10px">
          <button class="btn sm" data-preset="xy">浔阳区核心区</button>
          <button class="btn sm" data-preset="all">九江市域</button>
        </div>
        <div class="form-label" style="margin-top:14px">说明</div>
        <div class="space-note">只对已确认地理参考的 GIS / 三维 / 可靠坐标 CAD 建立空间索引；坐标不完整的图纸不参与，仅在结果中提示。</div>
        <div class="form-foot" style="margin-top:16px"><button class="btn primary" id="spRun">执行空间检索</button></div>
        <div id="spResult" class="sp-result"></div>
      </div>
    </div>`
  const mask = openModal('空间范围检索', body, { wide: true })
  const map = mask.querySelector('#spMap')
  const box = mask.querySelector('#spBox')
  const bboxEl = mask.querySelector('#spBbox')
  const bounds = { minLng: 115.80, minLat: 29.85, maxLng: 116.15, maxLat: 29.50 }
  let dragging = false
  let start = null
  let bbox = null

  const toGeo = (r) => {
    const minLng = bounds.minLng + r.x * (bounds.maxLng - bounds.minLng)
    const maxLng = bounds.minLng + (r.x + r.w) * (bounds.maxLng - bounds.minLng)
    const maxLat = bounds.minLat + r.y * (bounds.maxLat - bounds.minLat)
    const minLat = bounds.minLat + (r.y + r.h) * (bounds.maxLat - bounds.minLat)
    return [minLng, minLat, maxLng, maxLat]
  }
  const rectOf = (ev) => {
    const rc = map.getBoundingClientRect()
    return { x: (ev.clientX - rc.left) / rc.width, y: (ev.clientY - rc.top) / rc.height }
  }
  const draw = (r) => {
    box.hidden = false
    box.style.left = `${r.x * 100}%`
    box.style.top = `${r.y * 100}%`
    box.style.width = `${r.w * 100}%`
    box.style.height = `${r.h * 100}%`
  }
  map.addEventListener('pointerdown', (ev) => {
    ev.preventDefault()
    const p = rectOf(ev)
    dragging = true
    start = p
    draw({ x: p.x, y: p.y, w: 0, h: 0 })
  })
  window.addEventListener('pointermove', (ev) => {
    if (!dragging) return
    const p = rectOf(ev)
    const r = {
      x: Math.max(0, Math.min(start.x, p.x)),
      y: Math.max(0, Math.min(start.y, p.y)),
      w: Math.abs(p.x - start.x),
      h: Math.abs(p.y - start.y),
    }
    draw(r)
    bbox = toGeo(r)
    bboxEl.textContent = bbox.map((n) => n.toFixed(4)).join(', ')
  })
  window.addEventListener('pointerup', () => { dragging = false })

  mask.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
    const r = b.dataset.preset === 'xy' ? { x: 0.32, y: 0.30, w: 0.20, h: 0.22 } : { x: 0.02, y: 0.02, w: 0.96, h: 0.96 }
    draw(r)
    bbox = toGeo(r)
    bboxEl.textContent = bbox.map((n) => n.toFixed(4)).join(', ')
  }))

  mask.querySelector('#spRun').addEventListener('click', async () => {
    if (!bbox) return toast('请先在图上框选范围', true)
    const { ok, body: res } = await api(`/api/spatial?bbox=${bbox.map((n) => n.toFixed(4)).join(',')}`)
    if (!ok) return toast(res.error, true)
    mask.querySelector('#spResult').innerHTML = `
      <div class="sp-res-title">命中 ${res.items.length} 项</div>
      ${res.items.map((r) => `<div class="sp-res-row"><span class="name">${esc(r.name)}</span><span class="mono">${esc(r.id)}</span></div>`).join('') || '<div class="space-note">该范围内没有当前授权可命中的资源</div>'}
      <div class="space-note" style="margin-top:10px">${esc(res.note)}</div>`
    toast(`空间检索命中 ${res.items.length} 项`)
  })
}

/* ---- 影像卷帘对比 ---- */

async function openImageryCompare() {
  const { body } = await api('/api/imagery')
  const views = body.views
  const patches = body.patches
  const bodyHtml = `
    <div class="cmp-head">
      <span class="tag">${esc(views[0].label)} · ${esc(views[0].date)}</span>
      <span class="cmp-slider">卷帘</span>
      <span class="tag ok">${esc(views[1].label)} · ${esc(views[1].date)}</span>
      <span class="spacer"></span><span class="mono" style="color:var(--muted)">同视口 · 同分辨率</span>
    </div>
    <div class="cmp-stage" id="cmpStage">
      <div class="cmp-layer base"></div>
      <div class="cmp-layer top" id="cmpTop"></div>
      ${patches.map((p) => `<div class="cmp-patch" style="left:${p.x * 100}%;top:${p.y * 100}%;width:${p.w * 100}%;height:${p.h * 100}%"><span>${esc(p.label)}</span></div>`).join('')}
      <div class="cmp-handle" id="cmpHandle" style="left:50%"></div>
      <div class="cmp-label left">${esc(views[0].label)}</div>
      <div class="cmp-label right">${esc(views[1].label)}</div>
    </div>
    <div class="cmp-bar"><input type="range" id="cmpRange" min="0" max="100" value="50"><span class="mono" id="cmpVal">50%</span></div>
    <div class="cmp-legend">${patches.map((p) => `<span><i></i>${esc(p.label)} · ${esc(p.area)}</span>`).join('')}</div>
    <div class="space-note">对比只做浏览与初筛；变化图斑面积受影像时相、云量与配准影响，定量结论需专业复核。</div>`
  const mask = openModal('影像卷帘对比', bodyHtml, { wide: true })
  const top = mask.querySelector('#cmpTop')
  const handle = mask.querySelector('#cmpHandle')
  const range = mask.querySelector('#cmpRange')
  const val = mask.querySelector('#cmpVal')
  const apply = (v) => {
    top.style.clipPath = `inset(0 0 0 ${v}%)`
    handle.style.left = `${v}%`
    val.textContent = `${v}%`
  }
  range.addEventListener('input', (e) => apply(Number(e.target.value)))
  apply(50)

  let drag = false
  const onMove = (ev) => {
    if (!drag) return
    const rc = mask.querySelector('#cmpStage').getBoundingClientRect()
    const v = Math.min(100, Math.max(0, ((ev.clientX - rc.left) / rc.width) * 100))
    range.value = String(Math.round(v))
    apply(v)
  }
  mask.querySelector('#cmpStage').addEventListener('pointerdown', (ev) => { drag = true; onMove(ev) })
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', () => { drag = false })
}

/* ---- 应用 ---- */

async function openAppDetail(id) {
  const { body } = await api(`/api/app?id=${encodeURIComponent(id)}`)
  const a = body.item
  if (!a) return
  const slide = ensureSlide()
  const badge = { published: ['ok', '已发布'], review: ['warn', '审核中'], draft: ['', '草稿'] }[a.status]
  slide.innerHTML = `
    <div class="slide-head">
      <span class="app-ico">${icon(a.icon)}</span>
      <div><div class="slide-title">${esc(a.name)}</div><div class="slide-sub">${esc(a.dept)} · v${esc(a.version)}</div></div>
      <span class="spacer"></span><button class="btn subtle" data-close>${icon('close')}</button>
    </div>
    <div class="slide-body">
      <div style="display:flex;gap:6px;margin-bottom:14px"><span class="tag ${badge[0]}">${badge[1]}</span><span class="tag">${esc((a.nets || []).map((n) => NET_NAME[n]).join(' / '))}</span></div>
      <div class="field"><div class="field-label">功能说明</div><div class="field-value">${esc(a.desc)}</div></div>
      <div class="field"><div class="field-label">适用网络与使用范围</div><div class="field-value">${esc(a.usage)}</div></div>
      <div class="field"><div class="field-label">维护人</div><div class="field-value">${esc(a.maintainer)}</div></div>
      ${a.alert ? `<div class="notice warn">运行告警：${esc(a.alert)}</div>` : ''}
      <div class="field"><div class="field-label">版本记录</div><div class="field-value">${(a.history || []).map((h) => `<div class="timeline-row"><span class="mono">v${esc(h.version)} · ${esc(h.date)}</span><span>${esc(h.note)}</span></div>`).join('')}</div></div>
      <div class="notice neutral">启动方式：兼容时窗口内嵌入，否则新窗口打开；加载、登录与错误状态显式提示。</div>
    </div>
    <div class="slide-foot">
      <button class="btn primary" ${a.status !== 'published' ? 'disabled style="opacity:.5"' : ''} data-launch>启动应用</button>
      ${a.status !== 'published' ? '<button class="btn" data-pass>审核通过</button><button class="btn" data-reject>驳回</button>' : '<button class="btn" data-rollback>回滚上一版本</button><button class="btn" data-updver>更新版本</button><button class="btn" data-disable>下架</button>'}
    </div>`
  wireSlide(slide)
  slide.querySelector('[data-launch]')?.addEventListener('click', () => toast(`已启动「${a.name}」（演示：按网络环境决定嵌入或新窗口）`))
  const act = async (action) => {
    const { ok, body: res } = await api('/api/apps/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: a.id, action }) })
    if (!ok) return toast(res.error, true)
    toast('应用状态已更新')
    slide.classList.remove('open')
    renderView()
  }
  slide.querySelector('[data-pass]')?.addEventListener('click', () => act('approve'))
  slide.querySelector('[data-reject]')?.addEventListener('click', () => act('reject'))
  slide.querySelector('[data-rollback]')?.addEventListener('click', () => act('rollback'))
  slide.querySelector('[data-updver]')?.addEventListener('click', async () => {
    const v = prompt('新版本号（例如 1.4.1）', a.version)
    if (!v) return
    const { ok, body: res } = await api('/api/apps/version', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: a.id, action: 'update', version: v }) })
    if (!ok) return toast(res.error || '失败', true)
    toast(res.message)
    slide.classList.remove('open')
    renderView()
  })
  slide.querySelector('[data-disable]')?.addEventListener('click', async () => {
    const { ok, body: res } = await api('/api/apps/version', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: a.id, action: 'disable' }) })
    if (!ok) return toast(res.error || '失败', true)
    toast(res.message)
    slide.classList.remove('open')
    renderView()
  })
}

function openAppRegister() {
  const body = `
    <div class="form-note">提交后进入接入验证：URL 可达性、统一身份回调、权限声明、健康检查；未通过验证不得上线。</div>
    <div class="form-grid">
      <label>应用名称<input id="apName" placeholder="例如：项目进度看板"></label>
      <label>所属部门<input id="apDept" value="${esc(state.boot.user.unit)}"></label>
      <label>初始版本<input id="apVer" value="0.1.0"></label>
      <label>适用网络<span class="mono" style="padding-top:6px;display:block">${esc(state.boot.network?.label || '')}</span></label>
    </div>
    <div class="form-label">功能说明</div>
    <textarea id="apDesc" rows="3" class="form-area" placeholder="说明应用解决什么问题、面向哪些角色"></textarea>
    <div class="form-label">使用范围与限制</div>
    <textarea id="apUsage" rows="2" class="form-area" placeholder="例如：仅本部门使用，读取项目台账摘要"></textarea>
    <div class="form-foot"><span class="mono">提交人：${esc(state.boot.user.name)}</span><span class="spacer"></span><button class="btn" data-mclose>取消</button><button class="btn primary" id="apSubmit">提交审核</button></div>`
  const mask = openModal('提交应用', body)
  mask.querySelectorAll('[data-mclose]').forEach((b) => b.addEventListener('click', () => mask.remove()))
  mask.querySelector('#apSubmit').addEventListener('click', async () => {
    const { ok, body: res } = await api('/api/apps/register', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: mask.querySelector('#apName').value.trim() || '未命名应用',
        dept: mask.querySelector('#apDept').value,
        version: mask.querySelector('#apVer').value,
        desc: mask.querySelector('#apDesc').value,
        usage: mask.querySelector('#apUsage').value,
      }),
    })
    if (!ok) return toast(res.error, true)
    mask.remove()
    toast(`已提交「${res.item.name}」，进入接入验证与审核队列`)
    state.view = 'apps'
    render()
  })
}

/* ---- 自动化 ---- */

function openAutomationForm(idea) {
  const pre = idea ? { ...idea, sch: idea.schedule || idea.sch, desc: idea.prompt || idea.desc } : {}
  const scheduleOptions = ['每天 08:30', '每周一 09:00', '每周五 17:00', '每季度首月 5 日', '每天 09:00']
  if (pre.sch && !scheduleOptions.includes(pre.sch)) scheduleOptions.unshift(pre.sch)
  const scheduleHtml = scheduleOptions.map((s) => `<option${pre.sch === s || (!pre.sch && s === '每天 08:30') ? ' selected' : ''}>${esc(s)}</option>`).join('')
  const body = `
    <div class="form-note">定时任务由系统 AI 按时执行。无人值守运行前，必须在这里明确它能做什么；超出范围会停止并记录，不会自动扩权。</div>
    <div class="form-grid">
      <label>名称<input id="auName" placeholder="例如：每日公示项目变更摘要" value="${esc(pre.name || '')}"></label>
      <label>频率<select id="auSch">${scheduleHtml}</select></label>
      <label style="grid-column:1/-1">任务权限<select id="auPerm">
        <option value="" disabled${(pre.permission || '') === '' ? ' selected' : ''}>请选择任务权限</option>
        <option value="read-only"${pre.permission === 'read-only' ? ' selected' : ''}>只读 · 只查询和分析，不写文件、不执行命令</option>
        <option value="workspace-write"${pre.permission === 'workspace-write' ? ' selected' : ''}>工作区可写 · 仅任务目录内读写、构建、测试</option>
      </select></label>
    </div>
    <div class="form-label">执行内容</div>
    <textarea id="auPrompt" rows="3" class="form-area" placeholder="写给 AI 的指令，例如：读取公示项目台账，比昨日快照，列出新增、变更与到期节点">${esc(pre.desc || '')}</textarea>
    <div class="form-foot"><span class="mono">权限在创建时固定；越权即停止</span><span class="spacer"></span><button class="btn" data-mclose>取消</button><button class="btn primary" id="auSubmit">创建</button></div>`
  const mask = openModal('新建定时任务', body)
  mask.querySelectorAll('[data-mclose]').forEach((b) => b.addEventListener('click', () => mask.remove()))
  mask.querySelector('#auSubmit').addEventListener('click', async () => {
    const permission = mask.querySelector('#auPerm').value
    if (!permission) return toast('请先选择任务权限范围', true)
    const { ok } = await api('/api/automations', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: mask.querySelector('#auName').value.trim() || '未命名定时任务', schedule: mask.querySelector('#auSch').value, permission, prompt: mask.querySelector('#auPrompt').value.trim() }),
    })
    if (!ok) return toast('创建失败', true)
    mask.remove()
    toast('定时任务已创建，已加入已开启列表')
    state.view = 'tasks'
    renderView()
  })
}

/* ---- 工单 / 反馈 ---- */

function openTicketForm() {
  const body = `
    <div class="form-note">按网络环境分派；离职为高优先级，账号停用与会话终止必须留痕。</div>
    <div class="form-grid">
      <label>变动类型<select id="tkType"><option>入职</option><option>调岗</option><option>借调</option><option>离职</option></select></label>
      <label>网络环境<select id="tkNet"><option>互联网</option><option>政务网</option><option>涉密内网</option></select></label>
    </div>
    <div class="form-label">变动内容</div>
    <input id="tkSubject" class="form-area" placeholder="例如：王五 · 规划一所 · 助理规划师">
    <div class="form-foot"><span class="spacer"></span><button class="btn" data-mclose>取消</button><button class="btn primary" id="tkSubmit">创建工单</button></div>`
  const mask = openModal('新建人员变动工单', body)
  mask.querySelectorAll('[data-mclose]').forEach((b) => b.addEventListener('click', () => mask.remove()))
  mask.querySelector('#tkSubmit').addEventListener('click', async () => {
    const { ok } = await api('/api/tickets', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: mask.querySelector('#tkType').value,
        net: mask.querySelector('#tkNet').value,
        subject: mask.querySelector('#tkSubject').value.trim() || '未填写',
      }),
    })
    if (!ok) return toast('创建失败：仅运维与管理角色可创建', true)
    mask.remove()
    toast('工单已创建，等待分派')
    renderView()
  })
}

function openFeedbackModal() {
  const body = `
    <div class="form-note">反馈会进入管理中心的反馈列表；缺陷类会关联当前会话与任务便于定位。</div>
    <div class="form-grid">
      <label>类型<select id="fbKind"><option>缺陷</option><option>建议</option><option>咨询</option></select></label>
      <label>关联对象<input id="fbApp" value="九规智能中枢 客户端"></label>
    </div>
    <div class="form-label">简述</div>
    <textarea id="fbSubject" rows="3" class="form-area" placeholder="描述遇到的问题或建议"></textarea>
    <div class="form-foot"><span class="spacer"></span><button class="btn" data-mclose>取消</button><button class="btn primary" id="fbSubmit">提交反馈</button></div>`
  const mask = openModal('帮助与反馈', body)
  mask.querySelectorAll('[data-mclose]').forEach((b) => b.addEventListener('click', () => mask.remove()))
  mask.querySelector('#fbSubmit').addEventListener('click', async () => {
    const { ok } = await api('/api/feedback', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kind: mask.querySelector('#fbKind').value,
        app: mask.querySelector('#fbApp').value,
        subject: mask.querySelector('#fbSubject').value.trim() || '未填写',
      }),
    })
    if (!ok) return toast('提交失败', true)
    mask.remove()
    toast('反馈已提交，可在管理中心跟踪处理状态')
  })
}

/* ------------------------------- audit ------------------------------ */

async function renderAuditDrawer() {
  let mask = document.getElementById('auditMask')
  let drawer = document.getElementById('auditDrawer')
  if (!drawer) {
    mask = document.createElement('div')
    mask.id = 'auditMask'
    mask.className = 'drawer-mask'
    drawer = document.createElement('div')
    drawer.id = 'auditDrawer'
    drawer.className = 'drawer'
    document.body.append(mask, drawer)
    mask.addEventListener('click', () => { state.auditOpen = false; mask.classList.remove('open'); drawer.classList.remove('open') })
  }
  const { body } = await api('/api/audit')
  drawer.innerHTML = `
    <div class="slide-head"><div><div class="slide-title">审计日志</div><div class="slide-sub">本网络独立保存 · 登录、查询、下载、写操作、权限调整</div></div>
      <span class="spacer"></span><button class="btn subtle" id="closeAudit">${icon('close')}</button></div>
    <div class="audit-list">
      ${body.items.map((a) => `<div class="audit-item">
        <div class="line1"><span class="op">${esc(a.action)}</span><span class="obj">${esc(a.object)}</span>
          <span class="spacer" style="flex:1"></span><span class="${a.result.startsWith('deny') ? 'res-deny' : 'res-allow'}">${esc(a.result)}</span></div>
        <div class="line2">${esc(a.time)} · ${esc(a.actor)} · ${esc(a.net)}</div>
      </div>`).join('')}
    </div>`
  drawer.querySelector('#closeAudit').addEventListener('click', () => {
    state.auditOpen = false
    drawer.classList.remove('open')
    mask.classList.remove('open')
  })
  requestAnimationFrame(() => { drawer.classList.add('open'); mask.classList.add('open') })
}

/* ------------------------------- render ----------------------------- */

const PANE_SPLITS = [
  { sel: '.sk-wrap', key: 'skills', min: 150, max: 900 },
  { sel: '.im-wrap', key: 'im', min: 150, max: 900 },
  { sel: '.mc-shell', key: 'admin', min: 150, max: 900 },
  { sel: '.nt-wrap', key: 'notice', min: 150, max: 900 },
  { sel: '.ac-wrap', key: 'academy', min: 150, max: 900 },
]

function installPaneSplitters() {
  PANE_SPLITS.forEach((cfg) => {
    document.querySelectorAll(cfg.sel).forEach((box) => {
      if (box.querySelector('.pane-splitter')) return
      if (box.children.length < 2) return
      const baseW = () => {
        const rootW = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pane-w'))
        return Number.isFinite(rootW) && rootW >= cfg.min ? Math.round(rootW) : paneWidthFor(Math.max(0, window.innerWidth - 58))
      }
      const initW = baseW()
      box.style.position = 'relative'
      box.style.removeProperty('--pane-w')
      const handle = document.createElement('div')
      handle.className = 'pane-splitter'
      handle.title = '拖动调整左右宽度 · 双击复位'
      box.appendChild(handle)
      const syncHandle = () => {
        const first = box.firstElementChild
        const width = first ? first.getBoundingClientRect().width : baseW()
        handle.style.left = Math.max(0, Math.round(width) - 3) + 'px'
      }
      syncHandle()
      requestAnimationFrame(syncHandle)
      if (window.ResizeObserver) {
        const ro = new ResizeObserver(syncHandle)
        ro.observe(box)
        if (box.firstElementChild) ro.observe(box.firstElementChild)
      }
      let dragging = false
      let lastW = initW
      const apply = (w, persist) => {
        lastW = Math.round(Math.min(cfg.max, Math.max(cfg.min, w)))
        document.documentElement.style.setProperty('--pane-w', lastW + 'px')
        document.documentElement.style.setProperty('--sidebar-w', lastW + 'px')
        syncHandle()
        if (persist) localStorage.setItem(PANE_RATIO_KEY, String(lastW / Math.max(1, window.innerWidth - 58)))
      }
      handle.addEventListener('dblclick', () => {
        localStorage.removeItem(PANE_RATIO_KEY)
    localStorage.removeItem('jg.sidebarW')
        const paneW = paneWidthFor(Math.max(0, window.innerWidth - 58))
        document.documentElement.style.setProperty('--pane-w', paneW + 'px')
        document.documentElement.style.setProperty('--sidebar-w', paneW + 'px')
      })
      handle.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return
        e.preventDefault()
        e.stopPropagation()
        const first = box.firstElementChild
        const startW = first ? first.getBoundingClientRect().width : baseW()
        const startX = e.clientX
        dragging = true
        lastW = startW
        handle.classList.add('on')
        document.body.style.userSelect = 'none'
        document.body.style.cursor = 'col-resize'
        const move = (ev) => { if (dragging) apply(startW + ev.clientX - startX, false) }
        const up = () => {
          if (!dragging) return
          dragging = false
          handle.classList.remove('on')
          document.body.style.userSelect = ''
          document.body.style.cursor = ''
          document.removeEventListener('pointermove', move)
          document.removeEventListener('pointerup', up)
          apply(lastW, true)
        }
        document.addEventListener('pointermove', move)
        document.addEventListener('pointerup', up)
      })
    })
  })
}

function render() {
  if (['home', 'chat'].includes(state.view)) document.getElementById('homeSidebarFloat')?.remove()
  document.querySelectorAll('.account-pop, .rail-pop').forEach((p) => p.remove())
  window.__accountPop = null
  window.__morePop = null
  applyLayout()
  renderMenubar()
  renderRail()
  bindHomeHoverSidebar()
  renderSidebar()
  renderTopbar()
  // 全局顶栏在所有模块保持一致，不因云浏览器或单栏页面收起。
  const topbar = document.getElementById('topbar')
  if (topbar) topbar.hidden = true
  if (!cloudAllowed()) {
    if (state.cloudOpen) { state.cloudOpen = false; endAllCloudSessions() }
    document.getElementById('cbPanel')?.remove()
    document.getElementById('app')?.classList.remove('has-cloud')
    document.documentElement.style.setProperty('--cb-w', '0px')
  } else if (state.cloudOpen && !document.getElementById('cbPanel')) {
    ensureCloud().then(renderCloudPanel)
  }
  Promise.resolve(renderView()).catch((e) => {
    window.__viewErr = state.view + ': ' + e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 4).join(' | ')
    const v = document.getElementById('view')
    v.innerHTML = '<div style="padding:24px;font-family:monospace;white-space:pre-wrap">VIEWERR ' + (window.__viewErr || '') + '</div>'
  })

  document.querySelectorAll('[data-nav]').forEach((btn) => {
    if (btn.closest('#railbar, #adminrail')) return
    btn.addEventListener('click', () => {
      if (btn.dataset.nav === 'more') { openMoreMenu(btn); return }
      if (btn.dataset.nav === 'imagegen' && !imagegenReady()) { showImageGate(); return }
      state.view = btn.dataset.nav
      markModuleRead(btn.dataset.nav)
      render()
    })
  })

  const roleSwitcher = document.getElementById('roleSwitcher')
  roleSwitcher?.addEventListener('change', () => logout())
}

async function main() {
  const w = Number(localStorage.getItem('jg.sidebarW'))
  const s = Number(localStorage.getItem('jg.setNavW'))
  const cw = Number(localStorage.getItem('jg.cbW'))
  const cp = Number(localStorage.getItem('jg.cbPaneW'))
  if (w >= 180 && w <= 520) state.sidebarWidth = w
  else {
    const r = Number(localStorage.getItem(PANE_RATIO_KEY))
    if (r >= 0.2 && r <= 0.9) state.sidebarWidth = Math.round(Math.max(180, Math.min(520, (window.innerWidth - 58) * r)))
  }
  if (s >= 160 && s <= 360) state.setNavWidth = s
  if (cp >= 220 && cp <= 900) state.cbUserW = cp
  if (cp >= 220 && cp <= 900) state.cbUserW = cp
  if (cw >= 240 && cw <= 600) state.cbW = cw
  else localStorage.removeItem('jg.cbW')
  try {
    const mp = JSON.parse(localStorage.getItem('jg.morePinned') || '[]')
    if (Array.isArray(mp)) state.morePinned = mp.filter((id) => typeof id === 'string')
  } catch { state.morePinned = [] }
  await loadBoot()
  renderMenubar()
  render()
  consumeShareDeepLink()
  const viewRoot = document.getElementById('view')
  if (viewRoot) {
    installPaneSplitters()
    new MutationObserver(() => installPaneSplitters()).observe(viewRoot, { childList: true, subtree: true })
  }
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's' && hasSidebarView()) {
      e.preventDefault()
      toggleGlobalSidebar()
      return
    }
    if ((e.ctrlKey || e.metaKey) && e.key === ',') {
      e.preventDefault()
      state.view = 'settings'
      state.settingsTab = 'general'
      state.settingsQuery = ''
      render()
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      openSearchPalette('')
    }
    if (e.key === 'Escape' && state.shareMode && !document.querySelector('.jg-modal-mask')) {
      e.preventDefault()
      exitShareMode()
      return
    }
    if (e.key === 'Escape') document.querySelectorAll('.account-pop').forEach((p) => p.remove())
  })
}

main().catch((e)=>{document.body.dataset.err=(e&&e.message)||String(e)})


/* ======================= 企业云 / 通讯录 / 即时通讯 ======================= */
const DOC_META = {
  pdf: { label: 'PDF', icon: 'doc', tone: 'pdf' },
  docx: { label: '文档', icon: 'doc', tone: 'docx' },
  xlsx: { label: '表格', icon: 'table', tone: 'xlsx' },
  pptx: { label: '演示', icon: 'layers', tone: 'pptx' },
  atlas: { label: '图集', icon: 'image', tone: 'atlas' },
  gdb: { label: '数据库', icon: 'database', tone: 'gdb' },
  shp: { label: '数据库', icon: 'database', tone: 'shp' },
  dwg: { label: '图纸', icon: 'cad', tone: 'dwg' },
  folder: { label: '文件夹', icon: 'folder', tone: 'folder' },
  file: { label: '文件', icon: 'doc', tone: 'docx' },
}

function openDocDialog(format) {
  document.querySelectorAll('.modal-mask').forEach((m) => m.remove())
  const meta = DOC_META[format] || DOC_META.docx
  const mask = document.createElement('div')
  mask.className = 'modal-mask'
  mask.innerHTML = `
    <div class="doc-dialog">
      <div class="dd-head"><span class="ico">${icon(meta.icon)}</span><div>
        <div class="dd-title">新建${meta.label}</div>
        <div class="dd-sub">由当前网络与授权数据生成，文件保存到企业云</div>
      </div><span class="spacer"></span><button class="dd-x" id="ddClose" title="关闭" aria-label="关闭">${icon('close')}</button></div>
      <label class="dd-field"><span>文件名称</span><input id="ddName" placeholder="例如：中心城区公示项目梳理"></label>
      <label class="dd-field"><span>内容要点</span><textarea id="ddBody" rows="5" placeholder="每行一条要点，可留空由系统按模板生成"></textarea></label>
      <div class="dd-foot"><span class="dd-hint">格式：${meta.label} · ${format}</span><span class="spacer"></span>
        <button class="dd-btn primary" id="ddOk">生成并保存</button>
      </div>
    </div>`
  document.body.appendChild(mask)
  const close = () => mask.remove()
  mask.addEventListener('click', (e) => { if (e.target === mask) close() })
  mask.querySelector('#ddClose').addEventListener('click', close)
  mask.querySelector('#ddOk').addEventListener('click', async () => {
    const title = mask.querySelector('#ddName').value.trim() || `未命名${meta.label}`
    const body = mask.querySelector('#ddBody').value.trim()
    const ok = mask.querySelector('#ddOk')
    ok.disabled = true
    ok.textContent = '生成中…'
    const { body: result } = await api('/api/docs/create', {
      method: 'POST',
      body: JSON.stringify({
        format,
        title,
        body: body || '一、总体情况\n二、数据与口径\n三、下一步工作',
        table: [['项目', '口径', '数值'], ['中心城区公示', '公示单位数', '86'], ['归并后分组', '按建设单位', '12'], ['过公示期', '2026-10', '3']],
        slides: [{ title, lines: body.split('\n').filter(Boolean).slice(0, 4) }, { title: '下一步工作', lines: ['补齐台账口径', '完成部门复核', '归档到企业云'] }],
      }),
    })
    if (result?.ok) {
      close()
      toast(`${title}.${format} 已生成，可在企业云查看与下载`)
      if (state.view === 'drive') renderView()
    } else {
      ok.disabled = false
      ok.textContent = '生成并保存'
      toast(result?.error || '生成失败')
    }
  })
  setTimeout(() => mask.querySelector('#ddName').focus(), 60)
}

async function renderDrive(el) {
  const PERSONAL_SPACE = { id: 'CL-PERSONAL', name: '个人云盘', kind: 'personal', title: '个人云盘', status: 'active', members: 1, total: PERSONAL_STORAGE.totalGB, used: storageUsedGB(), note: '个人云盘与智能笔记本共用每人 50GB' }
  const personal = state.driveSpace === 'CL-PERSONAL'
  const space = personal ? 'CL-DEPT' : (state.driveSpace || 'CL-DEPT')
  const { body } = await api('/api/drive?space=' + encodeURIComponent(space))
  const local = personal
    ? (state.personalFiles || [])
    : [...(state.driveFolders || []), ...(state.driveUploads || [])].filter((it) => it.space === space)
  const renamed = state.driveRenames || {}
  const items = personal ? [...local] : [...local, ...(body.items || [])]
  const itemsMapped = items.map((it) => renamed[it.id] ? { ...it, name: renamed[it.id] } : it)
  const quota = personal ? { used: storageUsedGB(), total: PERSONAL_STORAGE.totalGB } : (body.quota || { used: 0, total: 1024 })
  if (!personal && quota.used) {
    const adj = (state.driveQuotaAdj || {})[space] || 0
    quota.used = Math.max(0, Math.round((quota.used - adj) * 10) / 10)
  }
  quota.used = quota.used || 0
  quota.total = quota.total || 1024
  const filter = state.driveFilter || 'all'
  const q = state.driveQuery || ''
  const list = itemsMapped
    .filter((it) => (filter === 'all' ? true : filter === 'db' ? ['gdb', 'shp', 'dwg'].includes(it.type) : it.type === filter))
    .filter((it) => (q ? `${it.name}${it.owner}${it.dept}${(it.tags || []).join('')}`.includes(q) : true))
  const pct = Math.min(100, Math.round(((quota.used || 0) / (quota.total || 1)) * 100))
  const listPageSize = 10
  const listPages = Math.max(1, Math.ceil(list.length / listPageSize))
  const listPage = Math.min(Math.max(1, state.drivePage || 1), listPages)
  state.drivePage = listPage
  const pageItems = list.slice((listPage - 1) * listPageSize, listPage * listPageSize)
  const gbText = (n) => (n >= 1024 ? `${(n / 1024).toFixed(n % 1024 === 0 ? 0 : 1)} TB` : `${n} GB`)
  const isDoc = (t) => ['docx', 'xlsx', 'pptx', 'pdf'].includes(t)

  const spaces = [...(body.spaces || []), PERSONAL_SPACE]
  const cur = personal ? PERSONAL_SPACE : (body.space || { id: space, name: '', kind: 'dept', members: 0, total: 1024, used: 0 })
  const pending = cur.status === 'pending'
  const curDesc = cur.kind === 'personal'
    ? '个人云盘 · 与智能笔记本共用 50GB · 1 个账户'
    : [`${cur.kind === 'team' ? '专班空间' : '部门空间'}`, cur.name, `${cur.members || 0} 人`].filter(Boolean).join(' · ')
  el.innerHTML = `
  <div class="view-head">
    <div>
      <div class="view-title">云空间</div>
      <div class="view-desc">${curDesc}</div>
    </div>
  </div>
  <div class="cloud-switch">
    ${spaces.map((sp) => `<button class="cloud-pill ${sp.id === (cur.id || space) ? 'on' : ''}" data-space="${esc(sp.id)}">
      <span>${esc(sp.name)}</span><em>${sp.kind === 'team' ? '专班' : sp.kind === 'personal' ? '个人' : '部门'}${sp.status === 'pending' ? ' · 待审批' : ''}</em>
    </button>`).join('')}
    <button class="cloud-apply" id="cloudApply">${icon('plus')} 申请云空间</button>
  </div>
  ${pending ? `<div class="cloud-pending">
      <b>${esc(cur.name)} · 专班云</b>
      <span>申请已提交，审批通过后即可上传与共享。</span>
    </div>` : ''}
  <div class="drive-quota" ${pending ? 'hidden' : ''}>
    <div class="dq-ring" style="--p:${pct}"><span>${pct}%</span></div>
    <div class="dq-main">
      <div class="dq-title">${cur.kind === 'team' ? '专班' : cur.kind === 'personal' ? '个人' : '部门'}已用 ${quota.used} GB / 共 ${gbText(quota.total || 1024)}</div>
      <div class="dq-bar"><i style="width:${pct}%"></i></div>
      <div class="dq-note">${cur.kind === 'personal' ? `个人云盘 ${PERSONAL_STORAGE.cloudGB} GB · 智能笔记本 ${PERSONAL_STORAGE.notebookGB} GB · 合计 ${storageUsedGB()} GB` : `资料由${cur.kind === 'team' ? '专班' : '部门'}成员上传，上传者自动记录`}</div>
    </div>
  </div>
  <div class="drive-bar" ${pending ? 'hidden' : ''}>
    <div class="drive-tabs">
      ${[['all', '全部'], ['docx', '文档'], ['xlsx', '表格'], ['pptx', '演示'], ['pdf', 'PDF'], ['atlas', '图集'], ['db', '数据库']].map(([k, l]) => `<button class="drive-tab ${filter === k ? 'on' : ''}" data-dfilter="${k}">${l}</button>`).join('')}
    </div>
    <div class="drive-search"><span class="ico">${icon('search')}</span><input id="driveQ" placeholder="搜索文件、拥有者或部门" value="${esc(q)}"></div>
    <button class="drive-new" id="driveNew"><span class="ico">${icon('plus')}</span>新建</button>
    <input type="file" id="driveFilePick" hidden>
  </div>
  <div class="drive-list" ${pending ? 'hidden' : ''}>
    <div class="drive-row head">
      <span>名称</span><span>类型</span><span>上传者 / 共享</span><span>大小 / 更新</span><span></span>
    </div>
    ${pageItems.map((it) => `
      <div class="drive-row" data-dopen="${it.id}">
        <span class="dr-name"><span class="ico">${icon(DOC_META[it.type]?.icon || 'doc')}</span><span class="dr-title">${esc(it.name)}</span></span>
        <span class="dr-type-cell"><em class="dr-type ${DOC_META[it.type]?.tone || ''}">${esc(DOC_META[it.type]?.label || it.type)}</em></span>
        <span class="dr-who"><span class="dr-owner"><span class="nm">${esc(it.owner)}</span><small>${esc(it.dept)}</small></span><span class="dr-shareline">${esc(it.scope || '仅本人')} · ${esc((it.shared || []).slice(0, 2).join('、') || '本人')}</span></span>
        <span class="dr-meta">${esc(it.size)}<small>${esc(it.updated)}</small></span>
        <span class="dr-act">
          <button class="dr-more" data-dmore="${it.id}" title="更多操作" aria-label="更多操作">${icon('more')}</button>
        </span>
      </div>`).join('')}
    ${list.length ? '' : '<div class="empty">没有匹配的文件</div>'}
    <div class="ac-pager drive-pager" ${pending ? 'hidden' : ''}>
      ${listPages > 1 ? `<button class="ac-pg" data-dpage="${listPage - 1}" ${listPage <= 1 ? 'disabled' : ''}>上一页</button>
      ${pageSeq(listPage, listPages).map((p) => p === '…' ? '<span class="ac-pager-dots">…</span>' : `<button class="ac-pg num ${p === listPage ? 'on' : ''}" data-dpage="${p}">${p}</button>`).join('')}
      <button class="ac-pg" data-dpage="${listPage + 1}" ${listPage >= listPages ? 'disabled' : ''}>下一页</button>` : ''}
      <span class="ac-pager-info">每页最多 ${listPageSize} 条 · 共 ${list.length} 条</span>
    </div>
  </div>
  ${pending ? '' : `<div class="drive-note"><span class="ico">${icon('spark')}</span>${cur.kind === 'personal' ? '聊天附件保存到个人云存储后会出现在这里；个人云盘与智能笔记本共用 50GB，部门云空间与数据中心引用不占个人容量。' : '图集与数据库按元数据＋图层目录登记，AI 只读图层清单与坐标系。'}</div>`}`

  el.querySelectorAll('[data-space]').forEach((b) => b.addEventListener('click', () => { state.driveSpace = b.dataset.space; state.drivePage = 1; renderView() }))
  const applyBtn = el.querySelector('#cloudApply')
  if (applyBtn) applyBtn.addEventListener('click', () => {
    const mask = openModal('申请云空间', `
      <div class="form-note">专班跨部门组建时，可由专班负责人申请独立的工作云，与所在部门的云空间并列，在本模块左右切换。</div>
      <div class="form-row"><label>专班名称</label><input class="input" id="cloudName" placeholder="例如：城市更新专班" autocomplete="off"></div>
      <div class="form-row"><label>用途</label><input class="input" id="cloudUse" placeholder="例如：跨部门共享底图与成果" autocomplete="off"></div>
      <div class="form-foot"><span class="mono">额度默认 512 GB，审批通过后开通</span><span class="spacer"></span><button class="btn" data-cancel>取消</button><button class="btn primary" data-ok>提交申请</button></div>`)
    mask.querySelector('[data-cancel]').addEventListener('click', () => mask.remove())
    mask.querySelector('[data-ok]').addEventListener('click', async () => {
      const name = mask.querySelector('#cloudName').value.trim()
      const { ok, body: res } = await api('/api/drive/apply', { method: 'POST', body: JSON.stringify({ name, use: mask.querySelector('#cloudUse').value.trim() }) })
      mask.remove()
      if (!ok) return toast(res.error || '申请失败', true)
      toast(`已提交「${name}」专班云申请，待数据管理员审批`)
      renderView()
    })
  })
  el.querySelectorAll('[data-dfilter]').forEach((b) => b.addEventListener('click', () => { state.driveFilter = b.dataset.dfilter; state.drivePage = 1; renderView() }))
  const newBtn = el.querySelector('#driveNew')
  newBtn.addEventListener('click', (ev) => { ev.stopPropagation(); openDriveNewMenu(newBtn, el) })
  const filePick = el.querySelector('#driveFilePick')
  filePick.addEventListener('change', () => handleDriveUpload(filePick, el))
  const qInput = el.querySelector('#driveQ')
  qInput.addEventListener('input', () => { state.driveQuery = qInput.value })
  qInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { state.drivePage = 1; renderView() } })
  el.querySelectorAll('[data-dpage]').forEach((b) => b.addEventListener('click', () => {
    const p = Number(b.dataset.dpage)
    if (!Number.isFinite(p)) return
    state.drivePage = Math.min(Math.max(p, 1), listPages)
    renderView()
  }))
  el.querySelectorAll('[data-dmore]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation()
    const it = items.find((x) => x.id === b.dataset.dmore)
    if (it) openDriveMoreMenu(it, b, el, spaces, personal)
  }))
  el.querySelectorAll('[data-dopen]').forEach((r) => r.addEventListener('click', (ev) => {
    if (ev.target.closest('button')) return
    const it = list.find((x) => x.id === r.dataset.dopen)
    if (!it) return
    if (it.type === 'folder') return toast('文件夹已打开（演示暂无内容）')
    if (it.local) return toast(`已选择「${it.name}」（演示上传文件，暂未接入预览）`)
    if (['atlas', 'db', 'gdb', 'shp', 'dwg'].includes(it.type)) openAssetCard(it.id)
    else openCloudPreview(it.id)
  }))
}

function driveNow() {
  return new Date().toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(/\//g, '-')
}

function placeDrivePop(pop, anchor) {
  const r = anchor.getBoundingClientRect()
  const w = pop.offsetWidth || 180
  const h = pop.offsetHeight || 160
  pop.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 10, r.right - w))}px`
  pop.style.top = `${r.bottom + 5 + h > window.innerHeight ? Math.max(8, r.top - h - 5) : r.bottom + 5}px`
}

function closeDrivePops() { document.querySelectorAll('.drive-more-pop').forEach((p) => p.remove()) }

function openDriveNewMenu(anchor, el) {
  closeDrivePops()
  const pop = document.createElement('div')
  pop.className = 'drive-more-pop drive-new-pop'
  pop.innerHTML = `
    <button class="drive-more-item" data-nact="upload"><span class="ico">${icon('upload')}</span>上传文件</button>
    <button class="drive-more-item" data-nact="docx"><span class="ico">${icon('doc')}</span>新建 doc</button>
    <button class="drive-more-item" data-nact="xlsx"><span class="ico">${icon('table')}</span>新建 excel</button>
    <button class="drive-more-item" data-nact="pptx"><span class="ico">${icon('window')}</span>新建 ppt</button>
    <button class="drive-more-item" data-nact="folder"><span class="ico">${icon('folder')}</span>新建文件夹</button>`
  document.body.appendChild(pop)
  placeDrivePop(pop, anchor)
  pop.querySelectorAll('[data-nact]').forEach((b) => b.addEventListener('click', () => {
    const act = b.dataset.nact
    pop.remove()
    if (act === 'upload') { el.querySelector('#driveFilePick').click(); return }
    if (['docx', 'xlsx', 'pptx'].includes(act)) { openDocDialog(act); return }
    createDriveFolder()
  }))
  setTimeout(() => document.addEventListener('click', function close(e) {
    if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', close) }
  }), 0)
}

function createDriveFolder() {
  const mask = openModal('新建文件夹', `
    <div class="form-row"><label>文件夹名称</label><input class="input" id="drFolderName" placeholder="例如：2026 年成果归档" autocomplete="off"></div>
    <div class="form-foot"><span class="mono">创建在当前空间</span><span class="spacer"></span><button class="btn" data-cancel>取消</button><button class="btn primary" data-ok>创建</button></div>`)
  mask.querySelector('[data-cancel]').addEventListener('click', () => mask.remove())
  mask.querySelector('[data-ok]').addEventListener('click', () => {
    const name = mask.querySelector('#drFolderName').value.trim()
    if (!name) return toast('请填写文件夹名称')
    const user = state.boot.user
    state.driveFolders = [...(state.driveFolders || []), {
      id: `FLD-${Date.now()}`, name, type: 'folder', size: '—', owner: user.name, dept: user.unit,
      updated: driveNow(), shared: [], scope: '仅本人', space: state.driveSpace || 'CL-DEPT', local: true,
    }]
    mask.remove()
    toast(`已创建文件夹「${name}」`)
    renderView()
  })
  setTimeout(() => mask.querySelector('#drFolderName').focus(), 60)
}

function handleDriveUpload(input, el) {
  const file = input.files && input.files[0]
  if (!file) return
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  const type = ['docx', 'xlsx', 'pptx', 'pdf'].includes(ext) ? ext : 'file'
  const user = state.boot.user
  const size = file.size >= 1048576 ? `${(file.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1024))} KB`
  const personal = state.driveSpace === 'CL-PERSONAL'
  const addGB = file.size / (1024 ** 3)
  if (personal && storageUsedGB() + addGB > PERSONAL_STORAGE.totalGB) return toast('个人总云存储空间不足', true)
  if (personal) {
    PERSONAL_STORAGE.cloudGB = Math.round((PERSONAL_STORAGE.cloudGB + addGB) * 100) / 100
    state.personalFiles.unshift({
      id: `PF-${Date.now()}`, name: file.name, type, size, owner: user.name, dept: user.dept || '集团总部',
      updated: driveNow(), shared: ['本人'], scope: '仅本人', tags: ['个人云盘'], local: true,
    })
  } else {
    state.driveUploads = [...(state.driveUploads || []), {
      id: `UP-${Date.now()}`, name: file.name.replace(/\.[^.]+$/, ''), type, size, owner: user.name, dept: user.unit,
      updated: driveNow(), shared: [], scope: '仅本人', space: state.driveSpace || 'CL-DEPT', local: true,
    }]
  }
  input.value = ''
  toast(`已上传「${file.name}」`)
  renderView()
}

function openDriveMoreMenu(it, anchor, el, spaces, personal) {
  closeDrivePops()
  const docType = ['docx', 'xlsx', 'pptx'].includes(it.type)
  const main = it.type === 'folder' ? ['open', '打开', 'folder'] : docType ? ['edit', '协作编辑', 'pen'] : ['preview', '查看', 'window']
  const pop = document.createElement('div')
  pop.className = 'drive-more-pop'
  pop.innerHTML = `
    <button class="drive-more-item" data-dact="${main[0]}"><span class="ico">${icon(main[2])}</span>${main[1]}</button>
    <button class="drive-more-item" data-dact="share"><span class="ico">${icon('users')}</span>分享</button>
    <button class="drive-more-item" data-dact="download"><span class="ico">${icon('download')}</span>下载</button>
    <div class="drive-more-sep"></div>
    <button class="drive-more-item" data-dact="move" disabled title="移动尚未接入" style="opacity:.45;cursor:not-allowed"><span class="ico">${icon('folder')}</span>移动</button>
    <button class="drive-more-item" data-dact="rename"><span class="ico">${icon('pen')}</span>重命名</button>
    <button class="drive-more-item" data-dact="remove" style="color:#b2413b"><span class="ico" style="color:#b2413b">${icon('trash')}</span>删除</button>`
  document.body.appendChild(pop)
  placeDrivePop(pop, anchor)
  pop.querySelectorAll('[data-dact]').forEach((b) => b.addEventListener('click', () => {
    const act = b.dataset.dact
    pop.remove()
    if (act === 'open') { if (it.type === 'folder') return toast('文件夹已打开（演示暂无内容）'); return toast(`已打开「${it.name}」`) }
    if (act === 'edit') { if (it.local) return toast('演示上传文件暂不支持在线编辑'); return openDocEditor(it.id, true) }
    if (act === 'preview') { if (it.local) return toast('演示上传文件暂未接入预览'); return it.type === 'pdf' ? openCloudPreview(it.id) : openAssetCard(it.id) }
    if (act === 'share') { if (it.local) return toast('演示上传文件暂不支持共享'); return openShareCard(it.id, anchor) }
    if (act === 'download') {
      if (it.url) return window.open(it.url, '_blank')
      return toast('该文件暂无下载地址')
    }
    if (act === 'move') return openDriveMove(it, spaces, el)
    if (act === 'rename') return openDriveRename(it, el)
    if (act === 'remove') return openDriveDelete(it, el, personal)
  }))
  setTimeout(() => document.addEventListener('click', function close(e) {
    if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', close) }
  }), 0)
}

function openDriveRename(it, el) {
  const mask = openModal('重命名', `
    <div class="form-row"><label>名称</label><input class="input" id="drRename" value="${esc(it.name)}" autocomplete="off"></div>
    <div class="form-foot"><span class="mono">仅修改显示名称，文件内容与权限不变</span><span class="spacer"></span><button class="btn" data-cancel>取消</button><button class="btn primary" data-ok>保存</button></div>`)
  mask.querySelector('[data-cancel]').addEventListener('click', () => mask.remove())
  mask.querySelector('[data-ok]').addEventListener('click', () => {
    const name = mask.querySelector('#drRename').value.trim()
    if (!name) return toast('名称不能为空')
    if (it.local) {
      for (const key of ['driveFolders', 'driveUploads']) {
        const list = state[key] || []
        const hit = list.find((x) => x.id === it.id)
        if (hit) hit.name = name
      }
    } else {
      state.driveRenames = { ...(state.driveRenames || {}), [it.id]: name }
    }
    mask.remove()
    toast('已重命名')
    renderView()
  })
  setTimeout(() => { const i = mask.querySelector('#drRename'); i.focus(); i.select() }, 60)
}

function openDriveDelete(it, el, personal) {
  const sizeGB = (() => {
    const m = String(it.size || '').match(/([\d.]+)\s*(GB|MB|KB)/i)
    if (!m) return 0
    const n = Number(m[1]) || 0
    return m[2].toUpperCase() === 'GB' ? n : m[2].toUpperCase() === 'MB' ? n / 1024 : n / (1024 ** 2)
  })()
  const mask = openModal('删除文件', `
    <div class="form-note">确定删除《${esc(it.name)}》？删除后释放对应容量，文件不可恢复；聊天记录中的原附件不受影响。</div>
    <div class="form-foot"><span class="mono">${personal ? '个人云盘容量将同步释放' : '部门 / 专班容量将同步释放'}</span><span class="spacer"></span><button class="btn" data-cancel>取消</button><button class="btn danger" data-ok>删除</button></div>`)
  mask.querySelector('[data-cancel]').addEventListener('click', () => mask.remove())
  mask.querySelector('[data-ok]').addEventListener('click', async () => {
    if (it.local || personal || String(it.id).startsWith('PF-') || String(it.id).startsWith('TR-')) {
      state.personalFiles = (state.personalFiles || []).filter((x) => x.id !== it.id)
      state.driveUploads = (state.driveUploads || []).filter((x) => x.id !== it.id)
      state.driveFolders = (state.driveFolders || []).filter((x) => x.id !== it.id)
      if (personal) PERSONAL_STORAGE.cloudGB = Math.max(0, Math.round((PERSONAL_STORAGE.cloudGB - sizeGB) * 100) / 100)
      else {
        const key = it.space || state.driveSpace || 'CL-DEPT'
        state.driveQuotaAdj = { ...(state.driveQuotaAdj || {}) }
        state.driveQuotaAdj[key] = Math.round(((state.driveQuotaAdj[key] || 0) + sizeGB) * 100) / 100
      }
      mask.remove()
      toast('已删除，容量已释放')
      return renderView()
    }
    const { ok, body: res } = await api('/api/drive/delete', { method: 'POST', body: JSON.stringify({ id: it.id }) })
    if (!ok) return toast(res.error || '删除失败', true)
    const key = it.space || state.driveSpace || 'CL-DEPT'
    state.driveQuotaAdj = { ...(state.driveQuotaAdj || {}) }
    state.driveQuotaAdj[key] = Math.round(((state.driveQuotaAdj[key] || 0) + sizeGB) * 100) / 100
    mask.remove()
    toast('已删除，容量已释放')
    renderView()
  })
}

function openDriveMove(it, spaces, el) {
  const options = (spaces || []).map((s) => `<option value="${esc(s.id)}">${esc(s.name)}（${s.kind === 'team' ? '专班' : '部门'}空间）</option>`).join('')
  const mask = openModal('移动', `
    <div class="form-row"><label>目标空间</label><select class="input" id="drMoveSpace">${options}</select></div>
    <div class="form-foot"><span class="mono">移动到其他云空间后仍保留原权限</span><span class="spacer"></span><button class="btn" data-cancel>取消</button><button class="btn primary" data-ok>移动</button></div>`)
  mask.querySelector('[data-cancel]').addEventListener('click', () => mask.remove())
  mask.querySelector('[data-ok]').addEventListener('click', () => {
    const sel = mask.querySelector('#drMoveSpace')
    const target = sel.options[sel.selectedIndex]?.text || ''
    mask.remove()
    toast(`已移动到「${target}」（演示）`)
  })
}

async function openImPreview(file) {
  if (file.itemId) {
    const { ok, body } = await api(`/api/drive/item?id=${encodeURIComponent(file.itemId)}`)
    if (ok && body.item) return openCloudPreview(file.itemId)
  }
  const meta = DOC_META[file.type] || DOC_META.docx
  const base = String(file.name || '').replace(/\.(docx|xlsx|pptx|pdf)$/i, '')
  const xlsx = file.type === 'xlsx'
  const mask = openModal(`预览 · ${meta.label}`, `
    <div class="pv-doc-stage">
      <div class="pv-doc-page">
        <div class="pv-doc-brand">九江市规划设计集团　${esc(state.boot.user.dept || state.boot.user.unit || '集团总部')}</div>
        <div class="pv-doc-title">${esc(base)}</div>
        <div class="pv-doc-sub">${esc(file.type)} · ${esc(file.size)} · ${file.online ? '在线文档' : '本地附件 · 云端临时副本 30 天'}</div>
        ${xlsx ? `<div class="pv-xl-grid">
          <div class="pv-xl-row head"><span class="pv-xl-rn"></span><span class="pv-xl-cell">A</span><span class="pv-xl-cell">B</span><span class="pv-xl-cell">C</span><span class="pv-xl-cell">D</span></div>
          ${[['项目名称', '类型', '面积（公顷）', '状态'], ['滨江片区控规调整', '控规', '128.4', '公示中'], ['十里片区中小学用地', '修规', '36.2', '公示中'], ['1958 厂区更新', '修规', '64.8', '已结束']].map((r, i) => `<div class="pv-xl-row${i === 0 ? ' head' : ''}"><span class="pv-xl-rn">${i + 1}</span>${r.map((c) => `<span class="pv-xl-cell">${esc(c)}</span>`).join('')}</div>`).join('')}
        </div>` : `<div class="pv-doc-body">
          <p>一、总体情况</p><p>本附件由聊天发送，仅保存在发送人本机；集团云端只保留 30 天临时副本，到期自动清理。</p>
          <p>二、数据与口径</p><p>如需长期保存或多人协作，可点击附件上的「转存」或「转为在线文档」。</p>
          <p>三、下一步工作</p><p>下载到本地后按现行版本归档，避免使用过期副本。</p>
        </div>`}
        <div class="pv-doc-foot">聊天附件预览 · 演示数据</div>
      </div>
    </div>`)
  return mask
}

async function openCloudPreview(id) {
  const { body } = await api(`/api/drive/item?id=${encodeURIComponent(id)}`)
  const it = body.item || {}
  const meta = DOC_META[it.type] || DOC_META.docx
  const base = String(it.name || '').replace(/\.[a-z]+$/i, '')

  const xlsxHTML = `
    <div class="pv-app pv-app-xlsx">
      <div class="pv-app-bar">
        <span class="pv-app-chip green">X</span>
        <span class="pv-app-file">${esc(it.name)}</span>
        <span class="spacer"></span>
        <span class="pv-app-tool">开始</span><span class="pv-app-tool">插入</span><span class="pv-app-tool">公式</span><span class="pv-app-tool">数据</span>
        <span class="spacer"></span>
        <span class="pv-app-mono">自动保存</span>
      </div>
      <div class="pv-xl-fx"><span class="pv-xl-name">C4</span><span class="pv-xl-mark">fx</span><span class="pv-xl-formula">=SUM(C3)</span></div>
      <div class="pv-xl-grid">
        <div class="pv-xl-row head"><span class="pv-xl-rn"></span><span class="pv-xl-cell">A</span><span class="pv-xl-cell">B</span><span class="pv-xl-cell">C</span><span class="pv-xl-cell">D</span><span class="pv-xl-cell">E</span></div>
        ${[
          ['项目名称', '类型', '面积（公顷）', '公示起始', '状态'],
          ['滨江片区控规调整', '控规', '128.4', '2026-11-06', '公示中'],
          ['十里片区中小学用地', '修规', '36.2', '2026-11-07', '公示中'],
          ['浔阳区老旧小区改造', '专项', '82.6', '2026-10-28', '已结束'],
          ['1958 厂区更新', '修规', '64.8', '2026-10-20', '已结束'],
          ['八里湖片区水系', '专项', '210.5', '2026-11-01', '公示中'],
          ['', '', '合计 522.5', '', ''],
        ].map((r, i) => `<div class="pv-xl-row${r[0] === '项目名称' ? ' head' : ''}"><span class="pv-xl-rn">${i + 1}</span>${r.map((c) => `<span class="pv-xl-cell">${esc(c)}</span>`).join('')}</div>`).join('')}
      </div>
      <div class="pv-xl-tabs"><span class="on">指标台账</span><span>口径说明</span><span>分项目</span></div>
      <div class="pv-xl-status">工作表 1/3　·　区域 A1:E7　·　就绪</div>
    </div>`

  const docxHTML = `
    <div class="pv-app pv-app-doc">
      <div class="pv-app-bar">
        <span class="pv-app-chip blue">W</span>
        <span class="pv-app-file">${esc(it.name)}</span>
        <span class="spacer"></span>
        <span class="pv-app-tool">开始</span><span class="pv-app-tool">插入</span><span class="pv-app-tool">审阅</span>
        <span class="spacer"></span>
        <span class="pv-app-mono">页面 1/3 · 100%</span>
      </div>
      <div class="pv-doc-stage">
        <div class="pv-paper">
          <div class="pv-doc-brand">九江市规划设计集团　规划一所</div>
          <div class="pv-doc-title">${esc(base)}</div>
          <div class="pv-doc-sub">内部资料　·　2026 年 11 月　·　编制：${esc(it.owner)}</div>
          <div class="pv-doc-body">
            <p>一、梳理范围。本表梳理中心城区范围内处于公示阶段及近三个月内完成公示的规划项目，共 12 项，覆盖控规调整、修建性详细规划与专项规划三类。</p>
            <p>二、主要变更。滨江片区控规调整将用地性质由商住混合调整为居住为主，商业占比由 35% 下调至 28%，同步配建幼儿园一处；十里片区中小学用地红线向东偏移 12 米，涉及 3 个地块，原结构指标不受影响。</p>
            <p>三、待确认事项。滨江片区配套设施的建筑面积口径尚未与审批科室对齐；老旧小区改造完成率的统计范围由中心城区扩大至市辖区，对外引用时需注明范围变化。</p>
            <p>四、下一步。由项目负责人本周内完成指标复核，成果图按新版红线重出，公示材料按市局模板重新排版后提交。</p>
          </div>
          <div class="pv-paper-foot">— 1 —</div>
        </div>
      </div>
    </div>`

  const pptxHTML = `
    <div class="pv-app pv-app-ppt">
      <div class="pv-app-bar">
        <span class="pv-app-chip orange">P</span>
        <span class="pv-app-file">${esc(it.name)}</span>
        <span class="spacer"></span>
        <span class="pv-app-tool">开始</span><span class="pv-app-tool">插入</span><span class="pv-app-tool">切换</span>
        <span class="spacer"></span>
        <span class="pv-app-mono">幻灯片 1/4</span>
      </div>
      <div class="pv-ppt-stage">
        <div class="pv-slide-canvas">
          <div class="pv-slide-brand">九规智能中枢 · 规划设计集团</div>
          <div class="pv-slide-title">${esc(base)}</div>
          <div class="pv-slide-line"></div>
          <div class="pv-slide-sub">规划一所　·　2026 年 11 月</div>
        </div>
      </div>
      <div class="pv-ppt-strip">
        ${['封面', '现状与问题', '方案要点', '实施分工'].map((s, i) => `<div class="pv-thumb${i === 0 ? ' on' : ''}"><span>${i + 1}</span><em>${esc(s)}</em></div>`).join('')}
      </div>
    </div>`

  const pdfHTML = `
    <div class="pv-app pv-app-pdf">
      <div class="pv-app-bar">
        <span class="pv-app-chip red">PDF</span>
        <span class="pv-app-file">${esc(it.name)}</span>
        <span class="spacer"></span>
        <span class="pv-app-tool">页面 1 / 4</span><span class="pv-app-tool">100%</span><span class="pv-app-tool">适合宽度</span>
      </div>
      <div class="pv-doc-stage">
        <div class="pv-paper pv-paper-pdf">
          <div class="pv-pdf-head">九江市自然资源和规划局</div>
          <div class="pv-pdf-no">九自然资规公示〔2026〕11 号</div>
          <div class="pv-doc-title">${esc(base)}</div>
          <div class="pv-doc-body">
            <p>根据《中华人民共和国城乡规划法》及有关规定，现将中心城区相关规划事项予以公示，征求利害关系人意见。</p>
            <p>一、公示时间：2026 年 11 月 6 日至 12 月 5 日，共 30 天。</p>
            <p>二、公示地点：市局门户网站、项目现场公示牌及属地街道办事大厅。</p>
            <p>三、意见反馈：公示期内可将书面意见送达市局规划管理科，或通过电子邮件反馈，并注明联系人及联系方式。</p>
          </div>
          <div class="pv-pdf-sign">九江市自然资源和规划局<br>2026 年 11 月 6 日</div>
          <div class="pv-paper-foot">1 / 4</div>
        </div>
      </div>
    </div>`

  const viewHTML = it.type === 'xlsx' ? xlsxHTML : it.type === 'pptx' ? pptxHTML : it.type === 'pdf' ? pdfHTML : docxHTML
  const mask = openModal('', `
    <div class="pv-head">
      <div>
        <div class="pv-name">${esc(it.name)}</div>
        <div class="pv-meta">${esc(meta.label)} · ${esc(it.size)} · ${esc(it.owner)} · ${esc(it.dept)} · 更新 ${esc(it.updated)}</div>
      </div>
      <span class="spacer"></span>
      <span class="tag">${esc(it.scope || '部门内')}</span>
    </div>
    ${viewHTML}
    <div class="form-foot"><span class="mono">预览为只读，原始文件以下载件为准</span><span class="spacer"></span>
      <button class="btn" data-dl2="${esc(it.name)}" disabled title="下载尚未接入" style="opacity:.45;cursor:not-allowed">下载</button>
      ${['docx', 'xlsx', 'pptx'].includes(it.type) ? `<button class="btn primary" data-edit2="${esc(it.id)}">在线编辑</button>` : ''}
    </div>`, { wide: true })
  const dl = mask.querySelector('[data-dl2]')
  if (dl) dl.addEventListener('click', () => {})
  const ed = mask.querySelector('[data-edit2]')
  if (ed) ed.addEventListener('click', () => { mask.remove(); openDocEditor(ed.dataset.edit2, true) })
}

async function openAssetCard(id) {
  const { body } = await api(`/api/drive/item?id=${encodeURIComponent(id)}`)
  const it = body.item || {}
  const meta = DOC_META[it.type] || DOC_META.docx
  const layers = ['用地边界', '道路中心线', '管线', '影像底图']
  const r = await api('/api/ai/invoke', { method: 'POST', body: JSON.stringify({ tool: 'drive_read', args: { id } }) })
  const read = r.body?.result || {}
  const mask = openModal(`${it.name}`, `
    <div class="asset-head"><span class="dr-type ${meta.tone}">${esc(it.typeLabel || meta.label)}</span><span class="asset-meta">${esc(it.dept)} · ${esc(it.owner)} · ${esc(it.size)} · 更新 ${esc(it.updated)}</span></div>
    <div class="asset-share">共享给 ${esc((it.shared || []).join('、') || '仅本人')} · ${esc(it.scope || '')}</div>
    <div class="asset-kv">
      <div><span>资产类别</span><b>${esc(read.family || meta.label)}</b></div>
      <div><span>坐标系</span><b>${esc(read.crs || 'CGCS2000')}</b></div>
      <div><span>范围</span><b>${esc(read.extent || '—')}</b></div>
      <div><span>图层</span><b>${esc((read.layers || layers).length)} 个</b></div>
    </div>
    <div class="asset-layers">${(read.layers || layers).map((l, i) => `<span class="asset-layer"><span class="mono">${String(i + 1).padStart(2, '0')}</span>${esc(l)}</span>`).join('')}</div>
    <div class="form-note">${esc(read.note || '查看图层与元数据；原始要素需按要素级授权审批后导出。')}</div>
    <div class="form-foot"><span class="mono">AI 已通过 drive_read 读取元数据</span></div>`, { wide: true })
}

async function openShareCard(id, anchor) {
  const { body } = await api('/api/contacts')
  const people = (body.items || []).filter((c) => c.name !== state.boot.user.name).slice(0, 6)
  const pop = document.createElement('div')
  pop.className = 'conv-menu share-menu'
  pop.innerHTML = `<div class="share-head">共享给</div>${people.map((c) => `<button class="cm-item" data-dto="${esc(c.name)}"><span class="avatar sm">${esc(c.name.slice(0, 1))}</span><span class="cm-label">${esc(c.name)}</span><span class="cm-key">${esc(c.dept)}</span></button>`).join('')}`
  document.body.appendChild(pop)
  const r = anchor.getBoundingClientRect()
  pop.style.left = `${Math.max(8, Math.min(window.innerWidth - 280, r.left - 200))}px`
  const ph = pop.offsetHeight
  pop.style.top = `${Math.max(8, Math.min(window.innerHeight - ph - 8, r.bottom + 6))}px`
  pop.querySelectorAll('[data-dto]').forEach((b) => b.addEventListener('click', async () => {
    const { body: res } = await api('/api/drive/share', { method: 'POST', body: JSON.stringify({ id, to: b.dataset.dto }) })
    pop.remove()
    toast(res?.ok ? `已共享给 ${b.dataset.dto}，档案升级为共享${DOC_META[res.item?.type]?.label || '文档'}，双方均可在线编辑` : res?.error || '共享失败')
    if (res?.ok) renderView()
  }))
  setTimeout(() => document.addEventListener('click', function close(e) {
    if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', close) }
  }), 0)
}

function contactsPageSize(el, total) {
  const grid = el.querySelector('.ct-grid')
  const cards = grid ? [...grid.querySelectorAll('.ct-card')] : []
  if (!grid || !cards.length) return Math.max(1, total)
  const cols = Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(/\s+/).filter(Boolean).length)
  const gap = parseFloat(getComputedStyle(grid).rowGap) || 12
  const cardH = Math.max(...cards.map((c) => c.getBoundingClientRect().height))
  const viewRect = el.getBoundingClientRect()
  const gridTop = grid.getBoundingClientRect().top - viewRect.top + el.scrollTop
  const available = el.clientHeight - gridTop - 40
  const rows = Math.max(1, Math.floor((available + gap) / (cardH + gap)))
  return Math.max(1, rows * cols)
}

async function renderContacts(el) {
  const q = state.contactQuery || ''
  const { body } = await api(`/api/contacts?q=${encodeURIComponent(q)}`)
  const items = body.items || []
  const dept = state.contactDept || '全部'
  const list = items.filter((c) => (dept === '全部' ? true : c.dept === dept))
  const shell = (shown, pager) => `
  <div class="view-head">
    <div><div class="view-title">通讯录</div><div class="view-desc">${body.total || 0} 人</div></div>
  </div>
  <div class="ct-bar">
    <div class="ct-search"><span class="ico">${icon('search')}</span><input id="ctQ" placeholder="搜索姓名、岗位、部门或邮箱" value="${esc(q)}"></div>
    <div class="ct-tabs">${['全部', ...(body.depts || [])].map((d) => `<button class="drive-tab ${dept === d ? 'on' : ''}" data-cdept="${esc(d)}">${esc(d)}</button>`).join('')}</div>
  </div>
  <div class="ct-grid">
    ${shown.map((c) => `
      <div class="ct-card">
        <div class="avatar lg">${esc(c.name.slice(0, 1))}</div>
        <div class="ct-body">
          <div class="ct-name">${esc(c.name)} <small>${esc(c.duty)}</small></div>
          <div class="ct-meta">${esc(c.dept)} · ${esc(c.mail)}</div>
          <div class="ct-meta">${esc(c.phone)}</div>
        </div>
        <div class="ct-acts">
          <button class="dr-btn" data-call="${esc(c.name)}" disabled title="呼叫尚未接入" style="opacity:.45;cursor:not-allowed">呼叫</button>
          <button class="dr-btn primary" data-cim="${esc(c.name)}">发消息</button>
        </div>
      </div>`).join('')}
    ${list.length ? '' : '<div class="empty">没有匹配的人员</div>'}
  </div>
  ${pager}`
  el.innerHTML = shell(list, '')
  const pageSize = contactsPageSize(el, list.length)
  const pages = Math.max(1, Math.ceil(list.length / pageSize))
  const page = Math.min(Math.max(1, state.contactPage || 1), pages)
  state.contactPage = page
  const pageItems = list.slice((page - 1) * pageSize, page * pageSize)
  const pager = pages > 1 ? `<div class="ac-pager ct-pager">
    <button class="ac-pg" data-ctpage="${page - 1}" ${page <= 1 ? 'disabled' : ''}>上一页</button>
    ${pageSeq(page, pages).map((p) => p === '…' ? '<span class="ac-pager-dots">…</span>' : `<button class="ac-pg num ${p === page ? 'on' : ''}" data-ctpage="${p}">${p}</button>`).join('')}
    <button class="ac-pg" data-ctpage="${page + 1}" ${page >= pages ? 'disabled' : ''}>下一页</button>
    <span class="ac-pager-info">第 ${page} / ${pages} 页 · 共 ${list.length} 人</span>
  </div>` : ''
  el.innerHTML = shell(pageItems, pager)
  const qInput = el.querySelector('#ctQ')
  qInput.addEventListener('input', () => { state.contactQuery = qInput.value })
  qInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { state.contactPage = 1; renderView() } })
  el.querySelectorAll('[data-cdept]').forEach((b) => b.addEventListener('click', () => { state.contactDept = b.dataset.cdept; state.contactPage = 1; renderView() }))
  el.querySelectorAll('[data-ctpage]').forEach((b) => b.addEventListener('click', () => {
    const p = Number(b.dataset.ctpage)
    if (!Number.isFinite(p)) return
    state.contactPage = Math.min(Math.max(p, 1), pages)
    renderView()
  }))
  el.querySelectorAll('[data-call]').forEach((b) => b.addEventListener('click', () => {}))
  el.querySelectorAll('[data-cim]').forEach((b) => b.addEventListener('click', () => {
    state.imTarget = b.dataset.cim
    state.view = 'im'
    render()
  }))
}

function imCloudContext(thread) {
  if (!thread) return { space: 'CL-DEPT', label: '部门云空间 · 规划一所', kind: 'dept' }
  if (thread.kind === 'direct') return { space: 'CL-PERSONAL', label: '个人云盘', kind: 'personal' }
  if (thread.space) return { space: thread.space, label: `专班云空间 · ${thread.spaceName || thread.name}`, kind: 'team' }
  return { space: 'CL-DEPT', label: `部门云空间 · ${thread.dept || '规划一所'}`, kind: 'dept' }
}

function openTransferPop(file, thread, anchor) {
  closeDrivePops()
  const ctx = imCloudContext(thread)
  const sharedSpace = ctx.kind === 'team' ? ctx.space : 'CL-DEPT'
  const sharedLabel = ctx.kind === 'team' ? ctx.label : `部门云空间 · ${thread?.dept || '规划一所'}`
  const targets = [
    { id: 'personal', title: '个人云盘', ic: 'cloud' },
    { id: 'shared', title: sharedLabel, ic: 'folder' },
  ]
  const pop = document.createElement('div')
  pop.className = 'drive-more-pop im-tr-pop'
  pop.innerHTML = `<div class="im-tr-title">转存到</div>${targets.map((t) => `<button type="button" class="drive-more-item" data-tr-target="${t.id}"><span class="ico">${icon(t.ic)}</span>${esc(t.title)}</button>`).join('')}`
  document.body.appendChild(pop)
  placeDrivePop(pop, anchor)
  const sizeGB = (() => {
    const m = String(file.size || '').match(/([\d.]+)\s*(GB|MB|KB)/i)
    if (!m) return 0
    const n = Number(m[1]) || 0
    return m[2].toUpperCase() === 'GB' ? n : m[2].toUpperCase() === 'MB' ? n / 1024 : n / (1024 ** 2)
  })()
  pop.querySelectorAll('[data-tr-target]').forEach((b) => b.addEventListener('click', () => {
    const target = b.dataset.trTarget
    pop.remove()
    if (target === 'personal') {
      state.personalFiles.unshift({
        id: 'PF-TR-' + Date.now(), name: file.name, type: (file.type || 'file'), size: file.size,
        owner: state.boot.user.name, dept: state.boot.user.dept || state.boot.user.unit || '集团总部',
        updated: driveNow(), shared: ['本人'], scope: '仅本人', tags: ['个人云盘', '转存'],
      })
      PERSONAL_STORAGE.cloudGB = Math.round((PERSONAL_STORAGE.cloudGB + sizeGB) * 100) / 100
      toast(`已转存到个人云盘`)
    } else {
      state.driveUploads = [...(state.driveUploads || []), {
        id: `TR-${Date.now()}`, name: file.name, type: (file.type || 'file'), size: file.size,
        owner: state.boot.user.name, dept: state.boot.user.dept || state.boot.user.unit || '集团总部',
        updated: driveNow(), shared: [ctx.kind === 'team' ? '专班成员' : '部门成员'],
        scope: ctx.kind === 'team' ? '专班可见' : '部门可见', space: sharedSpace, local: true, tags: ['云空间', '转存'],
      }]
      toast(`已转存到${sharedLabel}`)
    }
  }))
  setTimeout(() => document.addEventListener('click', function close(e) {
    if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', close) }
  }), 0)
}

async function renderIM(el) {
  const { body } = await api('/api/im')
  const threads = body.items || []
  const activeId = state.imThread || threads[0]?.id
  const thread = threads.find((t) => t.id === activeId) || threads[0]
  const unread = threads.reduce((n, t) => n + (t.unread || 0), 0)
  if (state.imUnread !== unread) {
    state.imUnread = unread
    renderRail()
  }
  const tabDefs = [
    { id: 'chat', label: '聊天' },
    { id: 'files', label: '文件管理' },
    ...(thread?.dept ? [{ id: 'cloud', label: '云空间' }] : []),
    { id: 'search', label: '聊天记录' },
    ...(thread?.kind === 'group' ? [{ id: 'members', label: '人员管理' }] : []),
  ]
  const tab = tabDefs.some((t) => t.id === state.imTab) ? state.imTab : 'chat'
  const q = state.imQuery || ''

  let files = []
  let deptDocs = []
  let driveQuotaInfo = null
  if (tab === 'files') {
    const r = await api('/api/im/files')
    files = r.body.items || []
  }
  if (tab === 'cloud') {
    const dr = await api('/api/drive')
    deptDocs = dr.body.items || []
    driveQuotaInfo = dr.body.quota || null
  }
  let hits = []
  if (tab === 'search' && q) {
    const r = await api('/api/im/search?q=' + encodeURIComponent(q))
    hits = r.body.items || []
  }

  const lastText = (t) => {
    const m = t.messages[t.messages.length - 1]
    if (!m) return ''
    return m.file ? `【文件】${m.file.name}` : m.text
  }

  const chatPanel = `
      <div class="im-msgs" id="imMsgs">
        ${(thread?.messages || []).map((m) => `<div class="im-msg ${m.from === state.boot.user.name ? 'me' : ''} ${m.ai ? 'ai' : ''}">
          <span class="avatar xs">${m.ai ? icon('spark') : esc(m.from.slice(0, 1))}</span>
          <div class="im-bubble"><div class="im-from">${esc(m.from)} · ${esc(m.time)}${m.ai ? ' · 系统 AI' : ''}</div><div class="im-text">${esc(m.text)}</div>
          ${m.file ? `<div class="im-file${m.file.online ? ' online' : ''}" data-preview data-pname="${esc(m.file.name)}" data-ptype="${esc(m.file.type)}" data-psize="${esc(m.file.size)}" data-pitem="${esc(m.file.itemId || '')}" data-ponline="${m.file.online ? '1' : '0'}">
            <span class="im-file-ico">${icon('doc')}</span>
            <div class="im-file-main"><b>${esc(m.file.name)}</b><span>${esc(m.file.type)} · ${esc(m.file.size)}${m.file.online ? ' · 在线文档 · 长期保留' : ' · 附件 · 本机 + 云端临时 30 天'}</span></div>
            ${m.file.online
              ? `<span class="im-file-acts"><button class="btn subtle xs" data-dl="${esc(m.file.name)}">下载</button><button class="btn subtle xs" data-transfer data-tname="${esc(m.file.name)}" data-ttype="${esc(m.file.type)}" data-tsize="${esc(m.file.size)}">转存</button><button class="btn subtle xs" data-openfile="${esc(m.file.itemId)}">打开</button></span>`
              : m.file.itemId
                ? `<span class="im-file-acts"><button class="btn subtle xs" data-dl="${esc(m.file.name)}">下载</button><button class="btn subtle xs" data-transfer data-tname="${esc(m.file.name)}" data-ttype="${esc(m.file.type)}" data-tsize="${esc(m.file.size)}">转存</button><button class="btn subtle xs" data-online="${esc(m.file.itemId)}" data-tname="${esc(m.file.name)}" data-ttype="${esc(m.file.type)}" data-tsize="${esc(m.file.size)}">转为在线文档</button></span>`
                : `<span class="im-file-acts"><button class="btn subtle xs" data-dl="${esc(m.file.name)}">下载</button><button class="btn subtle xs" data-transfer data-tname="${esc(m.file.name)}" data-ttype="${esc(m.file.type)}" data-tsize="${esc(m.file.size)}">转存</button></span>`}
          </div>` : ''}</div>
        </div>`).join('')}
      </div>
      <div class="im-compose">
        <button class="icon-btn im-attach" id="imAttach" title="添加文件">${icon('plus')}</button>
        <textarea id="imText" rows="1" placeholder="输入消息，Enter 发送"></textarea>
        <button class="hc-send" id="imSend">${icon('up')}</button>
      </div>`

  const filesPanel = `
      <div class="im-panel">
        <div class="im-panel-head"><b>文件管理</b><span class="mono">${files.length} 个文件 · 来自全部会话</span></div>
        <div class="im-note">这里只列会话里上传的附件与升级后的在线文档：聊天附件只保留在发送人本机，集团云端仅存 30 天临时副本、到期自动清理；转为在线文档后长期保留。部门共享资料在「云空间」页。</div>
        <div class="im-panel-body">
          ${files.length ? files.map((f) => `
            <div class="im-file-row">
              <span class="im-file-ico">${icon('doc')}</span>
              <div class="im-file-main">
                <b>${esc(f.name)}</b>
                <span>${esc(f.threadName)} · ${esc(f.from)} · ${esc(f.time)} · ${esc(f.size)}</span>
              </div>
              <span class="tag ${f.online ? 'ok' : ''}">${f.online ? '在线文档 · 长期' : '附件 · 临时 30 天'}</span>
              ${f.online
                ? `<button class="btn subtle xs" data-transfer data-tname="${esc(f.name)}" data-ttype="${esc(f.type || 'file')}" data-tsize="${esc(f.size || '')}">转存</button><button class="btn subtle xs" data-openfile="${esc(f.itemId)}">打开</button>`
                : `<button class="btn subtle xs" data-dl="${esc(f.name)}">下载</button><button class="btn subtle xs" data-transfer data-tname="${esc(f.name)}" data-ttype="${esc(f.type || 'file')}" data-tsize="${esc(f.size || '')}">转存</button><button class="btn subtle xs" data-online="${esc(f.itemId)}" data-tname="${esc(f.name)}" data-ttype="${esc(f.type || 'file')}" data-tsize="${esc(f.size || '')}">转为在线文档</button>`}
            </div>`).join('') : '<div class="im-empty">这个会话还没有上传过文件。在聊天里点「＋」上传，或到「云空间」页把部门资料发送到本群。</div>'}
        </div>
      </div>`

  const cloudPanel = `
      <div class="im-panel">
        <div class="im-panel-head"><b>云空间 · ${esc(thread?.dept || '')}</b><span class="mono">${deptDocs.length} 项部门共享资料</span></div>
        <div class="im-note">${driveQuotaInfo ? `部门共享 1 TB · 已用 ${esc(String(driveQuotaInfo.used))} GB · ${esc(String(driveQuotaInfo.members))} 人共用` : ''}资料长期保留，发送到本群后仍按部门授权判定。</div>
        <div class="im-panel-body">
          ${deptDocs.length ? deptDocs.map((d) => `
            <div class="im-file-row">
              <span class="im-file-ico">${icon('doc')}</span>
              <div class="im-file-main">
                <b>${esc(d.name)}</b>
                <span>${esc(d.owner || '')} · ${esc(d.size || '')} · ${esc(d.updated || '')}</span>
              </div>
              <span class="tag">${esc(d.typeLabel || '云空间')}</span>
              <button class="btn subtle xs" data-senddoc="${esc(d.id)}">发送到会话</button>
            </div>`).join('') : '<div class="im-empty">云空间暂无资料。</div>'}
        </div>
      </div>`

  const roster = thread?.roster || []
  const autoMembers = Boolean(thread?.autoMembers)
  const membersPanel = thread?.kind === 'group' ? `
      <div class="im-panel">
        <div class="im-panel-head"><b>人员管理</b><span class="mono">${roster.length} 人${autoMembers ? ' · 人事自动匹配' : ' · 手动维护'}</span></div>
        ${autoMembers
          ? `<div class="im-note">部门工作群：成员由人事资料按任职部门自动匹配，入职、调岗、离职随时同步；如需变更请在人事系统调整，群里不能手工增减。</div>`
          : `<div class="im-note">自建群：成员由群主维护，可添加同事或移出成员；群主本人不可被移出。</div>`}
        <div class="im-panel-body">
          ${roster.map((r) => `<div class="im-mem-row">
            <span class="avatar sm">${esc(r.name.slice(0, 1))}</span>
            <div class="im-mem-main"><b>${esc(r.name)}</b><span>${esc(r.duty || '')}${r.dept ? ' · ' + esc(r.dept) : ''}</span></div>
            ${r.lead ? '<span class="tag ok">群主</span>' : ''}
            ${r.source === 'hr' ? '<span class="tag">人事同步</span>' : ''}
            ${!autoMembers && !r.lead
              ? `<button class="btn subtle xs" data-delmember="${esc(r.name)}">移出</button>`
              : ''}
          </div>`).join('')}
        </div>
        ${autoMembers ? '' : `<div class="im-panel-foot"><button class="btn sm" id="imAddMember">${icon('plus')} 添加成员</button></div>`}
      </div>` : ''

  const searchPanel = `
      <div class="im-panel">
        <div class="im-panel-head"><b>聊天记录</b><span class="mono">按关键词检索全部会话</span></div>
        <div class="im-note">文字消息跨网同步、长期保留；附件与文件名只在 30 天临时副本期内可检索。</div>
        <div class="im-panel-search"><span class="ico">${icon('search')}</span><input id="imSearch" placeholder="搜索聊天记录、文件名，例如：台账 / 影像 / 申请表" value="${esc(q)}"></div>
        <div class="im-panel-body">
          ${q ? (hits.length ? hits.map((h) => `
            <button class="im-hit" data-goto="${esc(h.threadId)}">
              <span class="im-hit-top"><b>${esc(h.threadName)}</b><span class="mono">${esc(h.from)} · ${esc(h.time)}</span></span>
              <span class="im-hit-text">${esc(h.text)}</span>
              ${h.file ? `<span class="im-hit-file">${icon('doc')}${esc(h.file.name)}</span>` : ''}
            </button>`).join('') : '<div class="im-empty">没有命中。换个关键词，或到「文件管理」按文件名找。</div>') : '<div class="im-empty">输入关键词检索聊天记录；支持消息正文与文件名。</div>'}
        </div>
      </div>`

  el.innerHTML = `
  <div class="im-wrap">
    <div class="im-left">
      <div class="im-left-head"><div><div class="im-left-title">即时通讯</div><div class="im-left-sub">${unread ? `${unread} 条未读` : ''}</div></div></div>
      <div class="im-search"><span class="ico">${icon('search')}</span><input id="imQ" placeholder="搜索联系人或群组"></div>
      ${threads.map((t) => `
        <button class="im-thread ${t.id === activeId ? 'on' : ''}" data-im="${t.id}">
          <span class="avatar sm">${esc(t.name.slice(0, 1))}</span>
          <span class="im-th-main"><span class="im-th-name">${esc(t.name)}</span><span class="im-th-last">${esc(lastText(t))}</span></span>
          <span class="im-th-meta"><span>${esc(t.time)}</span>${t.unread ? `<i class="im-badge">${t.unread}</i>` : ''}</span>
        </button>`).join('') || '<div class="im-empty">暂无会话</div>'}
    </div>
    <div class="im-right">
      <div class="im-head">
        <div class="im-h-main"><div class="im-h-name">${esc(thread?.name || '未选择会话')}</div><div class="im-h-meta">${thread ? (thread.kind === 'group' ? `${thread.members} 人 · 群聊` : '单聊') : '选择左侧会话开始沟通'}</div></div>
        ${thread ? `<div class="im-head-acts">
          <button class="icon-btn im-more" id="imMore" title="更多功能" aria-haspopup="true" aria-expanded="false">${icon('dots')}</button>
          <div class="im-menu" id="imMenu" hidden>
            ${tabDefs.map((t) => `<button type="button" class="im-menu-item ${tab === t.id ? 'on' : ''}" data-imtab="${t.id}"><span>${t.label}</span>${tab === t.id ? '<span class="im-menu-check">✓</span>' : ''}</button>`).join('')}
          </div>
        </div>` : ''}
      </div>
      ${thread ? (tab === 'files' ? filesPanel : tab === 'cloud' ? cloudPanel : tab === 'search' ? searchPanel : tab === 'members' ? membersPanel : chatPanel) : `<div class="im-no-thread">${icon('message')}<b>暂无会话</b><span>当前账号还没有可打开的会话。收到新消息后会显示在这里。</span></div>`}
    </div>
  </div>`

  el.querySelectorAll('[data-im]').forEach((b) => b.addEventListener('click', () => {
    state.imThread = b.dataset.im
    state.imTab = 'chat'
    renderView()
  }))
  el.querySelectorAll('[data-imtab]').forEach((b) => b.addEventListener('click', () => {
    state.imTab = b.dataset.imtab
    renderView()
  }))

  const imMore = el.querySelector('#imMore')
  const imMenu = el.querySelector('#imMenu')
  if (imMore && imMenu) {
    const closeMenu = () => {
      imMenu.hidden = true
      imMore.setAttribute('aria-expanded', 'false')
    }
    imMore.addEventListener('click', (ev) => {
      ev.stopPropagation()
      const willOpen = imMenu.hidden
      imMenu.hidden = !willOpen
      imMore.setAttribute('aria-expanded', String(willOpen))
    })
    imMenu.querySelectorAll('[data-imtab]').forEach((b) => b.addEventListener('click', closeMenu))
    setTimeout(() => document.addEventListener('click', function outside(ev) {
      if (!imMenu.contains(ev.target) && !imMore.contains(ev.target)) {
        closeMenu()
        document.removeEventListener('click', outside)
      }
    }), 0)
  }

  const box = el.querySelector('#imMsgs')
  if (box) box.scrollTop = box.scrollHeight

  // 文件：转为在线文档 / 转存 / 打开
  el.querySelectorAll('[data-online]').forEach((b) => b.addEventListener('click', async (ev) => {
    ev.stopPropagation()
    const ctx = imCloudContext(thread)
    const { ok, body: res } = await api('/api/im/online', { method: 'POST', body: JSON.stringify({ itemId: b.dataset.online, threadId: thread.id, space: ctx.space }) })
    if (!ok) return toast(res.error || '转换失败', true)
    if (ctx.kind === 'personal' && !state.personalFiles.some((f) => f.id === b.dataset.online)) {
      state.personalFiles.unshift({
        id: b.dataset.online, name: b.dataset.tname || res.item?.name || '在线文档',
        type: b.dataset.ttype || res.item?.type || 'docx', size: b.dataset.tsize || '',
        owner: state.boot.user.name, dept: state.boot.user.dept || state.boot.user.unit || '集团总部',
        updated: driveNow(), shared: ['本人'], scope: '仅本人', tags: ['个人云盘', '在线文档'], online: true,
      })
    }
    toast(`已转为在线文档，保存到${ctx.label}`)
    renderView()
  }))
  el.querySelectorAll('[data-transfer]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation()
    openTransferPop({ name: b.dataset.tname, type: b.dataset.ttype || 'file', size: b.dataset.tsize || '' }, thread, b)
  }))
  el.querySelectorAll('[data-dl]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation()
    toast(`已下载到本地：${b.dataset.dl}（云端临时副本到期清理，本机文件不受影响）`)
  }))
  el.querySelectorAll('[data-senddoc]').forEach((b) => b.addEventListener('click', async (ev) => {
    ev.stopPropagation()
    const { ok, body: res } = await api('/api/im/attach', { method: 'POST', body: JSON.stringify({ id: thread.id, itemId: b.dataset.senddoc }) })
    if (!ok) return toast(res.error || '发送失败', true)
    toast('已把云空间文件发送到本群（附件 30 天内可下载）')
    renderView()
  }))
  el.querySelectorAll('[data-delmember]').forEach((b) => b.addEventListener('click', async (ev) => {
    ev.stopPropagation()
    const { ok, body: res } = await api('/api/im/member', { method: 'POST', body: JSON.stringify({ id: thread.id, action: 'remove', name: b.dataset.delmember }) })
    if (!ok) return toast(res.error || '移出失败', true)
    toast(`${b.dataset.delmember} 已移出群聊`)
    renderView()
  }))
  const addMem = el.querySelector('#imAddMember')
  if (addMem) addMem.addEventListener('click', async () => {
    const { body: cr } = await api('/api/contacts')
    const pool = (cr.items || []).filter((c) => !(thread.roster || []).some((r) => r.name === c.name))
    const mask = openModal('添加成员', `<div class="lib-list">
      ${pool.map((c) => `<button class="lib-row" data-addmem="${esc(c.name)}">
        <span class="ico">${icon('users')}</span>
        <span class="lib-name">${esc(c.name)}</span>
        <span class="lib-meta">${esc(c.duty)} · ${esc(c.dept)}</span>
      </button>`).join('')}
    </div>`, { wide: true })
    mask.querySelectorAll('[data-addmem]').forEach((x) => x.addEventListener('click', async () => {
      const { ok, body: res } = await api('/api/im/member', { method: 'POST', body: JSON.stringify({ id: thread.id, action: 'add', name: x.dataset.addmem }) })
      mask.remove()
      if (!ok) return toast(res.error || '添加失败', true)
      toast(`${x.dataset.addmem} 已加入群聊`)
      renderView()
    }))
  })
  el.querySelectorAll('[data-preview]').forEach((card) => card.addEventListener('click', (ev) => {
    if (ev.target.closest('button')) return
    openImPreview({
      name: card.dataset.pname, type: card.dataset.ptype, size: card.dataset.psize,
      itemId: card.dataset.pitem, online: card.dataset.ponline === '1',
    })
  }))
  el.querySelectorAll('[data-openfile]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation()
    openDocEditor(b.dataset.openfile, true)
  }))

  // 搜索
  const sInput = el.querySelector('#imSearch')
  if (sInput) {
    sInput.addEventListener('input', debounce((e) => {
      state.imQuery = e.target.value
      renderView()
      const next = document.getElementById('imSearch')
      if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length) }
    }, 280))
  }
  el.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => {
    state.imThread = b.dataset.goto
    state.imTab = 'chat'
    renderView()
  }))

  // 发送
  const input = el.querySelector('#imText')
  if (input) {
    const send = async () => {
      const text = input.value.trim()
      if (!text) return
      const { body: res } = await api('/api/im/send', { method: 'POST', body: JSON.stringify({ id: thread.id, text }) })
      if (res?.ok) { input.value = ''; renderView() } else toast(res?.error || '发送失败')
    }
    el.querySelector('#imSend').addEventListener('click', send)
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } })
    el.querySelector('#imAttach').addEventListener('click', (ev) => {
      ev.stopPropagation()
      openImComposeMenu(thread, input, el.querySelector('#imAttach'))
    })
    input.addEventListener('input', () => {
      const v = input.value
      const m = v.match(/@([^@\s]*)$/)
      if (m) { state.imAtHint = true; openAtHint(input, thread, m[1]) } else state.imAtHint = false
    })
    setTimeout(() => input.focus(), 40)
  }
}

function openImComposeMenu(thread, input, anchor) {
  document.querySelectorAll('.im-plus-pop').forEach((p) => p.remove())
  const pop = document.createElement('div')
  pop.className = 'conv-menu im-plus-pop'
  pop.innerHTML = [
    ['file', 'doc', '本地文件', '从电脑选择'],
    ['cloud', 'cloud', '云空间', '选部门共享资料'],
    ['shot', 'window', '截图', '截当前窗口'],
    ['ai', 'spark', '问智能助手', '分析会话文档'],
  ].map(([k, ic, label, desc]) => `<button class="cm-item im-plus-item" data-imp="${k}"${k === 'shot' ? ' disabled title="截图发送尚未接入" style="opacity:.45;cursor:not-allowed"' : ''}>
      <span class="ico">${icon(ic)}</span>
      <span class="cm-label">${label}</span>
      <span class="cm-key">${desc}</span>
    </button>`).join('')
  document.body.appendChild(pop)
  const r = anchor.getBoundingClientRect()
  pop.style.left = `${r.left - 6}px`
  pop.style.top = 'auto'
  pop.style.bottom = `${window.innerHeight - r.top + 8}px`
  const close = (e) => { if (!pop.contains(e.target) && e.target !== anchor) { pop.remove(); document.removeEventListener('click', close) } }
  setTimeout(() => document.addEventListener('click', close), 0)

  pop.querySelector('[data-imp="cloud"]').addEventListener('click', () => { pop.remove(); openImAttach(thread) })
  pop.querySelector('[data-imp="ai"]').addEventListener('click', () => { pop.remove(); openImAiDialog(thread) })
  pop.querySelector('[data-imp="file"]').addEventListener('click', () => {
    pop.remove()
    const pick = document.createElement('input')
    pick.type = 'file'
    pick.addEventListener('change', async () => {
      const f = pick.files && pick.files[0]
      if (!f) return
      const ext = (f.name.split('.').pop() || 'docx').toLowerCase()
      const size = f.size > 1048576 ? `${(f.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(f.size / 1024))} KB`
      const { ok, body: res } = await api('/api/im/send', { method: 'POST', body: JSON.stringify({ id: thread.id, text: `发送了文件：${f.name}`, file: { itemId: '', name: f.name, type: ext, size } }) })
      if (!ok) return toast(res.error || '发送失败', true)
      toast('已发送到会话；附件仅存本机，云端临时副本 30 天')
      renderView()
    })
    pick.click()
  })
  pop.querySelector('[data-imp="shot"]').addEventListener('click', async () => {
    pop.remove()
    const d = new Date()
    const t = `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`
    const { ok, body: res } = await api('/api/im/send', { method: 'POST', body: JSON.stringify({ id: thread.id, text: '发送了截图', file: { itemId: '', name: `窗口截图-${t}.png`, type: 'png', size: '320 KB' } }) })
    if (!ok) return toast(res.error || '发送失败', true)
    toast('已发送截图（演示）')
    renderView()
  })
}

function openAtHint(input, thread, prefix) {
  document.querySelectorAll('.im-at-hint').forEach((x) => x.remove())
  const people = (thread?.roster || []).filter((r) => r.name !== state.boot.user.name)
  const list = people.filter((r) => !prefix || r.name.includes(prefix)).slice(0, 8)
  if (!list.length) return
  const hint = document.createElement('div')
  hint.className = 'im-at-hint'
  hint.innerHTML = list.map((r) => `<button class="im-at-row" data-mention="${esc(r.name)}">
      <span class="avatar xs">${esc(r.name.slice(0, 1))}</span>
      <span class="nm">${esc(r.name)}</span>
      <span class="key">${esc(r.duty || '')}${r.dept ? ' · ' + esc(r.dept) : ''}</span>
    </button>`).join('')
  document.body.appendChild(hint)
  const r = input.getBoundingClientRect()
  hint.style.left = `${r.left + 40}px`
  hint.style.bottom = `${window.innerHeight - r.top + 8}px`
  hint.querySelectorAll('[data-mention]').forEach((b) => b.addEventListener('click', () => {
    input.value = input.value.replace(/@([^@\s]*)$/, '@' + b.dataset.mention + ' ')
    state.imAtHint = false
    hint.remove()
    input.focus()
  }))
  setTimeout(() => document.addEventListener('click', function off(e) {
    if (!hint.contains(e.target)) { hint.remove(); document.removeEventListener('click', off); state.imAtHint = false }
  }), 0)
}

function openImAiDialog(thread) {
  const docs = (thread?.messages || []).filter((m) => m.file).map((m) => m.file)
  if (!docs.length) return toast('本会话还没有文件：先用「＋」发一份，再让智能助手分析', true)
  const mask = openModal('让智能助手分析', `
    <div class="form-note">勾选要分析的文件（可多选），可附一句关注点。智能助手只读本会话内出现过的文件。</div>
    <div class="im-pick">
      ${docs.map((f, i) => `<label class="im-pick-row im-ai-row" data-ai="${esc(f.name)}">
        <input type="checkbox" class="im-ai-check" style="margin-right:2px">
        <span class="im-file-ico">${icon('doc')}</span>
        <span class="im-file-main"><b>${esc(f.name)}</b><span>${esc(f.type)} · ${esc(f.size)}</span></span>
      </label>`).join('')}
    </div>
    <div class="form-row" style="margin-top:12px"><label>关注点</label><input class="input" id="aiAsk" placeholder="例如：这几份材料的口径是否一致"></div>
    <div class="form-foot"><span class="mono">AI 回帖会留在聊天记录里</span><span class="spacer"></span><button class="btn" data-cancel>取消</button><button class="btn primary" data-ok>开始分析</button></div>`)
  mask.querySelector('[data-cancel]').addEventListener('click', () => mask.remove())
  mask.querySelector('[data-ok]').addEventListener('click', async () => {
    const files = [...mask.querySelectorAll('.im-ai-check')].filter((c) => c.checked).map((c) => c.closest('.im-ai-row').dataset.ai)
    if (!files.length) return toast('请至少勾选一个文件', true)
    const { ok, body: res } = await api('/api/im/ai', { method: 'POST', body: JSON.stringify({ id: thread.id, files, question: mask.querySelector('#aiAsk').value.trim() }) })
    mask.remove()
    if (!ok) return toast(res.error || '分析失败', true)
    renderView()
  })
}

async function openImAttach(thread) {
  const { body } = await api('/api/drive')
  const list = (body.items || []).filter((d) => ['docx', 'xlsx', 'pptx'].includes(d.type))
  const mask = openModal('把文件发到「' + thread.name + '」', `
    <div class="notice">从这里选一个云空间文件发到会话；对方收到的是附件，可在聊天里一键转为人人可编辑的在线文档。</div>
    <div class="im-pick">
      ${list.length ? list.map((d) => `
        <button class="im-pick-row" data-attach="${esc(d.id)}">
          <span class="im-file-ico">${icon('doc')}</span>
          <span class="im-file-main"><b>${esc(d.name)}</b><span>${esc(d.type)} · ${esc(d.size)} · ${esc(d.owner)}</span></span>
        </button>`).join('') : '<div class="im-empty">云空间里没有可发送的文档。</div>'}
    </div>
    <div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="btn" data-cancel>取消</button></div>`)
  mask.querySelector('[data-cancel]').addEventListener('click', () => mask.remove())
  mask.querySelectorAll('[data-attach]').forEach((b) => b.addEventListener('click', async () => {
    const { ok, body: res } = await api('/api/im/attach', { method: 'POST', body: JSON.stringify({ id: thread.id, itemId: b.dataset.attach }) })
    if (!ok) return toast(res.error || '发送失败', true)
    mask.remove()
    toast('已发送，附件可在聊天中转为在线文档')
    renderView()
  }))
}

/* ======================= 模块角标通知 ======================= */
function notifModule(n) {
  const nav = n.nav || ''
  if (nav === 'automation') return 'tasks'
  if (nav === 'drive') return 'drive'
  if (nav === 'notice') return 'notice'
  if (nav === 'im') return 'im'
  if (nav === 'datacenter') return 'datacenter'
  if (nav === 'apps') return 'apps'
  return 'im'
}

async function markModuleRead(view) {
  if (view === 'home' || view === 'chat') return
  const items = state.notifications.filter((n) => n.unread && notifModule(n) === view)
  if (!items.length) return
  items.forEach((n) => { n.unread = false })
  await Promise.all(items.map((n) => api('/api/notifications/read', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: n.id }),
  })))
}

/* ======================= 共享文档 / 表格 / 演示 在线协作 ======================= */
function sheetTableHTML(table) {
  const rows = table || [['项目', '口径', '数值']]
  const cols = Math.max(...rows.map((r) => r.length))
  return `<div class="de-sheet"><table>
    ${rows.map((r, ri) => `<tr>${Array.from({ length: cols }).map((_, ci) => `<td><input data-cell="${ri}-${ci}" value="${esc(r[ci] ?? '')}"></td>`).join('')}</tr>`).join('')}
  </table><button class="de-addrow" id="deAddRow">+ 添加一行</button></div>`
}

function slideHTML(slides) {
  const list = slides || [{ title: '新页面', lines: ['要点一'] }]
  return `<div class="de-slides">${list.map((sli, i) => `
    <div class="de-slide" data-slide="${i}">
      <div class="de-slide-no">第 ${i + 1} 页</div>
      <input class="de-slide-title" data-slide-title="${i}" value="${esc(sli.title)}">
      <textarea class="de-slide-lines" data-slide-lines="${i}" rows="${Math.max(2, (sli.lines || []).length)}">${esc((sli.lines || []).join('\n'))}</textarea>
    </div>`).join('')}<button class="de-addrow" id="deAddSlide">+ 添加一页</button></div>`
}

async function openDocEditor(id, editable) {
  const { body } = await api(`/api/drive/item?id=${encodeURIComponent(id)}`)
  if (!body?.item) return toast(body?.error || '文件不存在')
  const it = body.item
  const c = body.content || {}
  const meta = DOC_META[it.type] || DOC_META.docx
  const me = state.boot.user.name
  const isOwner = it.owner === me
  const canEdit = editable && it.type !== 'pdf' && body.canEdit
  let blocks = body.blocks || []
  let comments = body.comments || []
  const members = body.members || []
  let rev = body.rev || 1
  let activeBlock = blocks[0]?.id || 'b1'
  let deTab = 'comments'
  let staleRev = 0
  document.querySelectorAll('.modal-mask').forEach((m) => m.remove())

  const mask = document.createElement('div')
  mask.className = 'modal-mask'
  mask.innerHTML = `
    <div class="doc-editor">
      <div class="de-head">
        <span class="ico">${icon(meta.icon)}</span>
        <div class="de-title-box">
          <div class="de-title">${esc(it.name)}</div>
          <div class="de-sub">${esc(it.typeLabel || meta.label)} · ${esc(it.owner)} · ${esc(it.dept)} · 最近更新 ${esc(it.updated)}</div>
        </div>
        <span class="spacer"></span>
        <span class="de-online" id="deOnline">${icon('pulse')}在线 ${(body.presence || []).length} 人</span>
        <span class="de-share">${it.isShared ? `共享给 ${esc((it.shared || []).join('、'))}` : '仅本人'}</span>
        <button class="de-x" id="deClose" title="关闭">${icon('close')}</button>
      </div>
      <div class="de-banner" id="deBanner" hidden></div>
      <div class="de-body">
        <div class="de-main" id="deMain">
          ${c.kind === 'sheet' ? sheetTableHTML(c.table) : c.kind === 'slide' ? slideHTML(c.slides) : `
            <div class="de-blocks" id="deBlocks">
              ${blocks.map((b) => {
                const locked = b.perm !== 'edit' && !isOwner
                return `<div class="de-block ${b.id === activeBlock ? 'sel' : ''}" data-block="${b.id}" data-perm="${b.perm}">
                  <div class="de-block-head">
                    <span class="de-anchor mono">第 ${b.no} 段</span>
                    ${isOwner ? '' : `<span class="tag ${b.perm === 'edit' ? '' : 'warn'}">${b.perm === 'edit' ? '可编辑' : b.perm === 'comment' ? '仅可评论' : '只读'}</span>`}
                    ${isOwner ? `<select class="de-perm" data-bperm="${b.id}" title="段落权限">
                      <option value="edit" ${b.perm === 'edit' ? 'selected' : ''}>可编辑</option>
                      <option value="comment" ${b.perm === 'comment' ? 'selected' : ''}>仅可评论</option>
                      <option value="read" ${b.perm === 'read' ? 'selected' : ''}>只读</option>
                    </select>` : ''}
                    <button class="icon-btn" data-cmblock="${b.id}" title="评论这一段">${icon('inbox')}</button>
                  </div>
                  <textarea class="de-block-text" data-block="${b.id}" rows="${Math.min(9, b.text.split('\n').length + 1)}" ${(canEdit && (!locked)) ? '' : 'readonly'}>${esc(b.text)}</textarea>
                </div>`
              }).join('')}
            </div>`}
          <div class="de-status" id="deStatus">${canEdit ? '创建者与共享者均可编辑；段落评论、段落权限与版本对比均已开启' : (it.type === 'pdf' ? '只读查看：PDF 不支持在线编辑，可评论与对比版本' : '只读查看：仅创建者与共享者可在线编辑')}</div>
        </div>
        <aside class="de-side">
          <div class="de-side-tabs">
            <button data-detab="comments" class="${deTab === 'comments' ? 'on' : ''}">评论 <span class="mono">${comments.filter((x) => !x.resolved).length}</span></button>
            <button data-detab="history" class="${deTab === 'history' ? 'on' : ''}">编辑历史 <span class="mono">${(body.history || []).length}</span></button>
          </div>
          <div class="de-side-body" id="deSide"></div>
        </aside>
      </div>
      <div class="de-foot">
        <span class="de-hint">评论、段落权限、版本对比与共享动作均写入审计</span>
        <span class="spacer"></span>
        ${canEdit ? '<button class="dd-btn primary" id="deSave">保存</button>' : ''}
      </div>
    </div>`
  document.body.appendChild(mask)
  const close = () => { clearInterval(timer); mask.remove() }
  mask.addEventListener('click', (e) => { if (e.target === mask) close() })
  mask.querySelector('#deClose').addEventListener('click', close)

  const main = mask.querySelector('#deMain')

  const renderSide = () => {
    const side = mask.querySelector('#deSide')
    mask.querySelectorAll('[data-detab]').forEach((t) => t.classList.toggle('on', t.dataset.detab === deTab))
    if (deTab === 'comments') {
      side.innerHTML = `
        <div class="de-cm-list">
          ${comments.length ? comments.map((cm) => `
            <div class="de-cm ${cm.resolved ? 'done' : ''}" data-cmid="${cm.id}">
              <div class="de-cm-top"><b>${esc(cm.author)}</b><span class="mono">${esc(String(cm.at).slice(-11))}</span><span class="spacer"></span><span class="tag mono">${esc(cm.blockId)}</span></div>
              <div class="de-cm-text">${esc(cm.text)}</div>
              <div class="de-cm-foot">
                <button class="link-btn" data-jump="${cm.blockId}">定位段落</button>
                <button class="link-btn" data-resolve="${cm.id}" data-rv="${cm.resolved ? '0' : '1'}">${cm.resolved ? '重新打开' : '标记已解决'}</button>
              </div>
            </div>`).join('') : '<div class="de-empty">还没有评论。选中段落右侧的评论按钮即可锚定评论。</div>'}
        </div>
        ${canEdit ? `
        <div class="de-cm-form">
          <div class="mono de-cm-anchor">评论锚点：第 ${blocks.find((b) => b.id === activeBlock)?.no || 1} 段</div>
          <textarea id="deCmText" rows="2" placeholder="写下评论，可用 @ 提及同事"></textarea>
          <div class="de-cm-mentions">${members.slice(0, 6).map((m) => `<button class="chip" data-mention="${esc(m.name)}">@${esc(m.name)}</button>`).join('')}</div>
          <div class="de-cm-form-foot"><span class="spacer"></span><button class="btn primary sm" id="deCmSend">发送评论</button></div>
        </div>` : ''}`
    } else {
      side.innerHTML = `
        <div class="de-h-list">
          ${(body.history || []).map((h) => `<div class="de-h-item">
            <div class="de-h-top"><b>v${h.v}</b><span>${esc(h.by)}</span><span class="de-h-time">${esc(h.time)}</span></div>
            <div class="de-h-sum">${esc(h.summary)}</div>
            <div class="de-h-acts">
              ${h.snapshot ? `<button class="de-restore" data-restore="${h.v}">恢复到此版本</button>` : ''}
              ${h.v > 1 ? `<button class="de-restore" data-diff="${h.v - 1}:${h.v}">与 v${h.v - 1} 对比</button>` : ''}
            </div>
          </div>`).join('')}
        </div>`
    }
    wireSide()
  }

  const wireSide = () => {
    mask.querySelectorAll('[data-jump]').forEach((b) => b.addEventListener('click', () => {
      const el = mask.querySelector(`.de-block[data-block="${b.dataset.jump}"]`)
      if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 900) }
    }))
    mask.querySelectorAll('[data-resolve]').forEach((b) => b.addEventListener('click', async () => {
      const { body: r } = await api('/api/drive/comment-resolve', { method: 'POST', body: JSON.stringify({ id, commentId: b.dataset.resolve, resolved: b.dataset.rv === '1' }) })
      if (r?.ok) { comments = r.comments; renderSide() } else toast(r?.error || '操作失败')
    }))
    mask.querySelectorAll('[data-mention]').forEach((b) => b.addEventListener('click', () => {
      const ta = mask.querySelector('#deCmText')
      ta.value += (ta.value.endsWith(' ') || !ta.value ? '' : ' ') + b.dataset.mention + ' '
      b.classList.toggle('on')
      ta.focus()
    }))
    mask.querySelector('#deCmSend')?.addEventListener('click', async () => {
      const ta = mask.querySelector('#deCmText')
      const mentions = [...mask.querySelectorAll('[data-mention].on')].map((x) => x.dataset.mention)
      const { body: r } = await api('/api/drive/comment', { method: 'POST', body: JSON.stringify({ id, blockId: activeBlock, text: ta.value, mentions }) })
      if (r?.ok) { comments = r.comments; ta.value = ''; renderSide(); toast('评论已锚定到当前段落') } else toast(r?.error || '评论失败')
    })
    mask.querySelectorAll('[data-restore]').forEach((b) => b.addEventListener('click', async () => {
      const { body: r } = await api('/api/drive/update', { method: 'POST', body: JSON.stringify({ id, restoreVersion: Number(b.dataset.restore) }) })
      if (r?.ok) {
        toast(`已恢复到 v${b.dataset.restore}，并生成新版本 v${r.version}`)
        close()
        openDocEditor(id, editable)
      } else toast(r?.error || '恢复失败')
    }))
    mask.querySelectorAll('[data-diff]').forEach((b) => b.addEventListener('click', async () => {
      const [from, to] = b.dataset.diff.split(':').map(Number)
      const { body: r } = await api(`/api/drive/diff?id=${encodeURIComponent(id)}&from=${from}&to=${to}`)
      if (!r?.rows) return toast(r?.error || '无法对比')
      const dm = openModal(`版本对比 v${from} → v${to}`, `
        <div class="diff-meta">新增 ${r.added} 行 · 删除 ${r.removed} 行 · 仅比较正文，表格与演示按行展开</div>
        <div class="diff-box">${r.rows.map((row) => `<div class="diff-row ${row.type}"><span class="diff-sign">${row.type === 'add' ? '+' : row.type === 'del' ? '−' : ' '}</span><span>${esc(row.text)}</span></div>`).join('')}</div>
        <div class="form-foot"><span class="mono">对比结果来自编辑历史快照</span></div>`)
    }))
  }

  // 段落选择与评论锚点
  mask.querySelectorAll('.de-block').forEach((el) => el.addEventListener('click', () => {
    activeBlock = el.dataset.block
    mask.querySelectorAll('.de-block').forEach((x) => x.classList.toggle('sel', x === el))
    if (deTab === 'comments') renderSide()
  }))
  mask.querySelectorAll('[data-cmblock]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation()
    activeBlock = b.dataset.cmblock
    deTab = 'comments'
    renderSide()
    mask.querySelector('#deCmText')?.focus()
  }))

  // 段落权限
  mask.querySelectorAll('[data-bperm]').forEach((sel) => sel.addEventListener('change', async () => {
    const { body: r } = await api('/api/drive/block-perm', { method: 'POST', body: JSON.stringify({ id, blockId: sel.dataset.bperm, perm: sel.value }) })
    if (r?.ok) { blocks = r.blocks; toast('段落权限已更新'); }
    else toast(r?.error || '权限设置失败')
  }))

  mask.querySelectorAll('[data-detab]').forEach((t) => t.addEventListener('click', () => {
    deTab = t.dataset.detab
    renderSide()
  }))
  renderSide()

  // 表格 / 演示的新增操作
  main.querySelector('#deAddRow')?.addEventListener('click', () => {
    const tbody = main.querySelector('.de-sheet table')
    const cols = tbody.rows[0].cells.length
    const tr = document.createElement('tr')
    tr.innerHTML = Array.from({ length: cols }).map((_, ci) => `<td><input data-cell="${tbody.rows.length}-${ci}" value=""></td>`).join('')
    tbody.appendChild(tr)
  })
  main.querySelector('#deAddSlide')?.addEventListener('click', () => {
    const box = main.querySelector('.de-slides')
    const n = box.querySelectorAll('.de-slide').length
    const div = document.createElement('div')
    div.className = 'de-slide'
    div.dataset.slide = String(n)
    div.innerHTML = `<div class="de-slide-no">第 ${n + 1} 页</div><input class="de-slide-title" data-slide-title="${n}" value="新页面"><textarea class="de-slide-lines" data-slide-lines="${n}" rows="2"></textarea>`
    box.insertBefore(div, main.querySelector('#deAddSlide'))
  })

  const collect = () => {
    if (c.kind === 'doc') {
      const parts = [...main.querySelectorAll('.de-block-text')].map((t) => t.value.trim()).filter(Boolean)
      return { body: parts.join('\n\n') }
    }
    if (c.kind === 'sheet') {
      const rows = [...main.querySelectorAll('.de-sheet table tr')].map((r) => [...r.querySelectorAll('input')].map((i) => i.value))
      return { table: rows }
    }
    const slides = [...main.querySelectorAll('.de-slide')].map((d) => ({
      title: d.querySelector('.de-slide-title').value,
      lines: d.querySelector('.de-slide-lines').value.split('\n').filter((x) => x.trim()),
    }))
    return { slides }
  }

  const showBanner = (text, actions) => {
    const banner = mask.querySelector('#deBanner')
    banner.hidden = false
    banner.innerHTML = `<span>${text}</span><span class="spacer"></span>${actions}`
  }

  mask.querySelector('#deSave')?.addEventListener('click', async () => {
    const btn = mask.querySelector('#deSave')
    btn.disabled = true
    btn.textContent = '保存中…'
    const { body: res } = await api('/api/drive/update', { method: 'POST', body: JSON.stringify({ id, content: collect(), summary: '在线编辑并保存', baseRev: rev }) })
    if (res?.ok) {
      toast(`已保存，当前版本 v${res.version}，创建者与共享者均可继续编辑`)
      close()
      if (state.view === 'drive') renderView()
    } else if (res?.error === 'conflict') {
      btn.disabled = false
      btn.textContent = '保存'
      staleRev = res.rev
      showBanner(`${esc(res.by)} 已在 ${esc(res.time)} 保存 v${res.rev}，你的编辑尚未提交。`, `<button class="btn sm" id="deReload">载入最新</button><button class="btn sm primary" id="deForce">仍然覆盖</button>`)
      mask.querySelector('#deReload').addEventListener('click', () => { close(); openDocEditor(id, editable) })
      mask.querySelector('#deForce').addEventListener('click', async () => {
        const { body: r2 } = await api('/api/drive/update', { method: 'POST', body: JSON.stringify({ id, content: collect(), summary: '冲突后覆盖保存', baseRev: 0 }) })
        if (r2?.ok) { toast(`已覆盖保存为 v${r2.version}`); close(); if (state.view === 'drive') renderView() } else toast(r2?.error || '保存失败')
      })
    } else {
      btn.disabled = false
      btn.textContent = '保存'
      toast(res?.error || '保存失败')
    }
  })

  // 伪实时：轮询在线状态与他人的新版本
  const refresh = async () => {
    const { body: p } = await api(`/api/drive/presence?id=${encodeURIComponent(id)}`)
    if (!p) return
    mask.querySelector('#deOnline').innerHTML = `${icon('pulse')}在线 ${p.presence.length} 人`
    if (p.rev > rev && !staleRev) {
      staleRev = p.rev
      showBanner(`有他人保存的新版本 v${p.rev}（当前显示 v${rev}）。`, `<button class="btn sm" id="deReload">载入最新</button><button class="btn sm subtle" id="deIgnore">继续编辑</button>`)
      mask.querySelector('#deReload').addEventListener('click', () => { close(); openDocEditor(id, editable) })
      mask.querySelector('#deIgnore').addEventListener('click', () => { mask.querySelector('#deBanner').hidden = true })
    }
  }
  const timer = setInterval(refresh, 5000)
  refresh()
}

/* ======================= 通知公告 ======================= */
async function renderNotices(el) {
  const { body } = await api('/api/notices')
  const items = body.items || []
  const cat = state.noticeCat || '全部'
  const list = items.filter((n) => (cat === '全部' ? true : n.category === cat))
  const catClass = (n) => (n.category === '通知' ? 'notice' : n.category === '公告' ? 'announce' : 'article')

  const pageSize = 10
  const pages = Math.max(1, Math.ceil(list.length / pageSize))
  const page = Math.min(Math.max(1, state.noticePage || 1), pages)
  state.noticePage = page
  const pageItems = list.slice((page - 1) * pageSize, page * pageSize)

  const openNotice = async (n) => {
    if (n.unread) {
      n.unread = false
      await api('/api/notices/read', { method: 'POST', body: JSON.stringify({ id: n.id }) })
      await markModuleRead('notice')
      el.querySelector(`[data-nrow="${n.id}"] .nt-dot`)?.remove()
    }
    document.querySelectorAll('.nt-modal').forEach((x) => x.remove())
    const wrap = document.createElement('div')
    wrap.className = 'ac-modal nt-modal'
    wrap.innerHTML = `
      <div class="ac-modal-panel">
        <div class="ac-modal-head">
          <span class="nt-cat ${catClass(n)}">${esc(n.category)}</span>
          <span class="ac-modal-hmeta">${esc(n.dept)} · ${esc(n.author)} · ${esc(n.time)}</span>
          <span class="spacer"></span>
          <button class="icon-btn ac-close" data-ntclose title="关闭" aria-label="关闭">${icon('close')}</button>
        </div>
        <div class="ac-modal-body nt-modal-body">
          <div class="nt-h-title">${esc(n.title)}</div>
          <div class="nt-body">${(n.body || []).map((p) => `<p>${esc(p)}</p>`).join('')}</div>
          <div class="nt-foot">
            <button class="dr-btn" data-ntim="${esc(n.title)}" disabled title="转发尚未接入" style="opacity:.45;cursor:not-allowed">转发到即时通讯</button>
            <button class="dr-btn" data-ntask="${esc(n.title)}">在会话中提问</button>
          </div>
        </div>
      </div>`
    document.body.appendChild(wrap)
    requestAnimationFrame(() => wrap.classList.add('on'))
    const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey) }
    const onKey = (e) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close() })
    wrap.querySelector('[data-ntclose]')?.addEventListener('click', close)
    wrap.querySelector('[data-ntim]')?.addEventListener('click', () => {
      close()
      state.view = 'im'
      render()
      toast('已把该公告转发到「规划一所 · 项目组」（演示）')
    })
    wrap.querySelector('[data-ntask]')?.addEventListener('click', () => {
      close()
      state.view = 'home'
      state.draft = '请结合刚发布的公告，梳理我需要跟进的事项'
      render()
      toast('已带入首页对话')
    })
  }

  el.innerHTML = `
  <div class="ac-page nt-page">
    <div class="ac-page-head">
      <div>
        <div class="ac-page-title">通知公告</div>
      </div>
    </div>
    <div class="ac-toolbar">
      <div class="ac-tabs">${(body.categories || ['全部', '通知', '公告', '文章']).map((c) => `<button class="ac-tab ${cat === c ? 'on' : ''}" data-ncat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    </div>
    <div class="nt-files">
      ${pageItems.map((n) => `<button class="ac-file nt-file" data-nrow="${esc(n.id)}">
        <span class="nt-cat ${catClass(n)}">${esc(n.category)}</span>
        <span class="ac-file-main">
          <span class="ac-file-title">${n.unread ? '<i class="nt-dot"></i>' : ''}${esc(n.title)}</span>
          <span class="ac-file-meta">${n.pinned ? '<span class="nt-pin-tag">置顶</span>' : ''}${esc(n.dept)}</span>
        </span>
        <span class="ac-file-dept">${esc(n.author)}</span>
        <span class="ac-file-time mono">${esc(n.time)}</span>
        <span class="ac-file-open">查看</span>
      </button>`).join('')}
      ${list.length ? '' : '<div class="empty">该分类暂无内容</div>'}
    </div>
    <div class="ac-pager">
      <button class="ac-pg" data-npage="${page - 1}" ${page <= 1 ? 'disabled' : ''}>上一页</button>
      ${pageSeq(page, pages).map((p) => p === '…' ? '<span class="ac-pager-dots">…</span>' : `<button class="ac-pg num ${p === page ? 'on' : ''}" data-npage="${p}">${p}</button>`).join('')}
      <button class="ac-pg" data-npage="${page + 1}" ${page >= pages ? 'disabled' : ''}>下一页</button>
      <span class="ac-pager-info">每页 ${pageSize} 条 · 共 ${list.length} 条</span>
    </div>
  </div>`

  el.querySelectorAll('[data-ncat]').forEach((b) => b.addEventListener('click', () => {
    state.noticeCat = b.dataset.ncat
    state.noticePage = 1
    renderView()
  }))
  el.querySelectorAll('[data-npage]').forEach((b) => b.addEventListener('click', () => {
    const p = Number(b.dataset.npage)
    if (!Number.isFinite(p)) return
    state.noticePage = Math.min(Math.max(p, 1), pages)
    renderView()
  }))
  el.querySelectorAll('[data-nrow]').forEach((b) => b.addEventListener('click', () => {
    const n = items.find((x) => x.id === b.dataset.nrow)
    if (n) openNotice(n)
  }))
}

function openNoticeDialog() {
  document.querySelectorAll('.modal-mask').forEach((m) => m.remove())
  const mask = document.createElement('div')
  mask.className = 'modal-mask'
  mask.innerHTML = `
    <div class="doc-dialog">
      <div class="dd-head"><span class="ico">${icon('bell')}</span><div>
        <div class="dd-title">发布通知公告</div>
        <div class="dd-sub">发布后进入通知公告列表，并给相关模块挂未读角标</div>
      </div><span class="spacer"></span><button class="dd-x" id="ntClose" title="关闭" aria-label="关闭">${icon('close')}</button></div>
      <label class="dd-field"><span>标题</span><input id="ntTitle" placeholder="例如：关于开展 2026 年度城市体检数据补录的通知"></label>
      <label class="dd-field"><span>类型</span><select id="ntCat"><option>通知</option><option>公告</option><option>文章</option></select></label>
      <label class="dd-field"><span>正文</span><textarea id="ntBody" rows="7" placeholder="每行一段；首段将作为摘要"></textarea></label>
      <label class="dd-check"><input type="checkbox" id="ntPin"> 置顶显示</label>
      <div class="dd-foot"><span class="dd-hint">发布人：${esc(state.boot.user.name)} · ${esc(state.boot.user.unit)}</span><span class="spacer"></span>
        <button class="dd-btn primary" id="ntOk">发布</button>
      </div>
    </div>`
  document.body.appendChild(mask)
  const close = () => mask.remove()
  mask.addEventListener('click', (e) => { if (e.target === mask) close() })
  mask.querySelector('#ntClose').addEventListener('click', close)
  mask.querySelector('#ntOk').addEventListener('click', async () => {
    const title = mask.querySelector('#ntTitle').value.trim()
    const text = mask.querySelector('#ntBody').value.trim()
    if (!title || !text) return toast('标题与正文不能为空')
    const ok = mask.querySelector('#ntOk')
    ok.disabled = true
    ok.textContent = '发布中…'
    const { body: res } = await api('/api/notices/publish', {
      method: 'POST',
      body: JSON.stringify({ title, category: mask.querySelector('#ntCat').value, body: text, pinned: mask.querySelector('#ntPin').checked }),
    })
    if (res?.ok) {
      close()
      state.noticeId = res.item.id
      toast('已发布，通知公告已上线')
      renderView()
    } else {
      ok.disabled = false
      ok.textContent = '发布'
      toast(res?.error || '发布失败')
    }
  })
  setTimeout(() => mask.querySelector('#ntTitle').focus(), 60)
}


/* ------------------------------ 教学园地 ----------------------------- */
async function renderAcademy(el) {
  const { body } = await api('/api/academy')
  const items = body.items || []
  const cat = state.academyCat || 'all'
  const list = items.filter((it) => (cat === 'all' ? true : it.kind === cat))
  const itemIcon = (it) => (it.kind === 'classic' ? 'star' : it.kind === 'video' ? 'video' : it.kind === 'spec' ? 'shield' : 'doc')
  const itemMeta = (it) => it.kind === 'classic'
    ? `经典项目 · ${esc(it.honor || '总工办认定')} · ${esc(it.dept)}`
    : `${esc(it.fmt)} · ${esc(it.duration || `${it.pages || 0} 页`)} · 数据中心`

  const pageSize = 10
  const pages = Math.max(1, Math.ceil(list.length / pageSize))
  const page = Math.min(Math.max(1, state.academyPage || 1), pages)
  state.academyPage = page
  const pageItems = list.slice((page - 1) * pageSize, page * pageSize)

  const detailHTML = (it) => `
    <div class="ac-h-title">${esc(it.title)}</div>
    ${it.kind === 'classic' ? `
      <div class="ac-award">
        <span class="ac-award-badge">${icon('star')}</span>
        <div><b>${esc(it.award)}</b><span>${esc(it.honor || '总工办推荐')} · 经总工办认定</span></div>
      </div>
      <div class="ac-proj-facts">
        <div><span>项目部门</span><b>${esc(it.dept)}</b></div>
        <div><span>归档时间</span><b>${esc(it.time)}</b></div>
        <div><span>项目类型</span><b>${esc((it.tags || [])[1] || '规划设计')}</b></div>
      </div>
      <div class="ac-sum">${esc(it.summary)}</div>
      <div class="ac-block-title">主要成果</div>
      <div class="ac-outcomes">${(it.outcomes || []).map((o) => `<div class="ac-outcome">${icon('doc')}<span>${esc(o)}</span></div>`).join('')}</div>
      <div class="ac-note"><span>总工办评价</span>${esc(it.note || '')}</div>` : `
      ${it.kind === 'video' ? `
        <div class="ac-player"><span class="ac-play">${icon('video')}</span><span class="ac-dur">${esc(it.duration)}</span></div>
        <div class="ac-chapters">${(it.chapters || []).map((c, i) => `<div class="ac-chap"><span class="mono">${String(i + 1).padStart(2, '0')}</span>${esc(c)}</div>`).join('')}</div>` : `
        <div class="ac-doc">
          <div class="ac-doc-cover"><span class="ico">${icon(it.kind === 'spec' ? 'shield' : 'doc')}</span><b>${it.pages || 0} 页</b><small>${esc(it.size)}</small></div>
          <div class="ac-doc-text">${esc(it.summary)}</div>
        </div>`}
      <div class="ac-sum">${esc(it.summary)}</div>
      <div class="ac-tags">${(it.tags || []).map((t) => `<span class="ac-tag">${esc(t)}</span>`).join('')}</div>`}
    <div class="ac-acts">
      <button class="btn primary" data-mstart="${it.id}" disabled title="档案打开尚未接入" style="opacity:.45;cursor:not-allowed">${it.kind === 'classic' ? '查看项目档案' : it.kind === 'video' ? '查看视频' : '打开阅读'}</button>
      <button class="btn" data-mai="${it.id}">用 AI 解读</button>
      <button class="btn fav-btn ${isFav(it.id) ? 'on' : ''}" data-mfav="${it.id}">${icon('star')}<span>${isFav(it.id) ? '已收藏' : '收藏'}</span></button>
    </div>
    <div class="ac-foot"><span>数据来源 · 数据中心</span><span class="spacer"></span><span class="mono">仅作展示</span></div>`

  const openAcModal = (it) => {
    document.querySelectorAll('.ac-modal').forEach((x) => x.remove())
    const wrap = document.createElement('div')
    wrap.className = 'ac-modal'
    wrap.innerHTML = `
      <div class="ac-modal-panel">
        <div class="ac-modal-head">
          <span class="ac-kind ${it.kind}">${esc(it.fmt)}</span>
          <span class="ac-modal-hmeta">${esc(it.dept)} · ${esc(it.time)}</span>
          <span class="spacer"></span>
          <button class="icon-btn ac-close" data-acclose title="关闭" aria-label="关闭">${icon('close')}</button>
        </div>
        <div class="ac-modal-body">${detailHTML(it)}</div>
      </div>`
    document.body.appendChild(wrap)
    requestAnimationFrame(() => wrap.classList.add('on'))
    const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey) }
    const onKey = (e) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close() })
    wrap.querySelector('[data-acclose]')?.addEventListener('click', close)
    wrap.querySelector('[data-mstart]')?.addEventListener('click', () => {})
    wrap.querySelector('[data-mai]')?.addEventListener('click', () => {
      state.draft = it.kind === 'classic'
        ? `请解读经典项目《${it.title}》的获奖点、总工办评价和可复用做法，并给出适用于规划一所的三条借鉴建议。`
        : `请解读教学园地资源《${it.title}》，提炼适用于规划一所的三个要点，并给出可执行的检查清单。`
      state.view = 'chat'; state.conversation = null
      close(); render()
    })
    wrap.querySelector('[data-mfav]')?.addEventListener('click', (e) => {
      const b = e.currentTarget
      const saved = toggleFav({ ref: it.id, kind: 'data', title: it.title, meta: `教学园地 · ${it.fmt} · ${it.dept}`, icon: it.kind === 'classic' ? 'star' : it.kind === 'video' ? 'video' : 'doc' })
      b.classList.toggle('on', saved)
      const t = b.querySelector('span'); if (t) t.textContent = saved ? '已收藏' : '收藏'
      toast(saved ? '已收藏，可在个人中心查看' : '已取消收藏')
    })
  }

  el.innerHTML = `
  <div class="ac-page">
    <div class="ac-page-head">
      <div>
        <div class="ac-page-title">教学园地</div>
      </div>
    </div>
    <div class="ac-toolbar">
      <div class="ac-tabs">${(body.categories || []).map((c) => `<button class="ac-tab ${cat === c.key ? 'on' : ''}" data-acat="${c.key}">${c.label}</button>`).join('')}</div>
    </div>
    <div class="ac-files">
      ${pageItems.map((it) => `
        <button class="ac-file" data-aid="${it.id}">
          <span class="ac-ico ${it.kind}">${icon(itemIcon(it))}</span>
          <span class="ac-file-main">
            <span class="ac-file-title">${esc(it.title)}${it.kind === 'classic' ? `<i class="ac-award-mark">${icon('star')}获奖</i>` : ''}</span>
            <span class="ac-file-meta">${itemMeta(it)}</span>
          </span>
          <span class="ac-file-dept">${esc(it.dept)}</span>
          <span class="ac-file-time mono">${esc(it.time)}</span>
          <span class="ac-file-open">查看</span>
        </button>`).join('')}
      ${list.length ? '' : '<div class="empty">该分类暂无内容</div>'}
    </div>
    <div class="ac-pager">
      <button class="ac-pg" data-acpage="${page - 1}" ${page <= 1 ? 'disabled' : ''}>上一页</button>
      ${pageSeq(page, pages).map((p) => p === '…' ? '<span class="ac-pager-dots">…</span>' : `<button class="ac-pg num ${p === page ? 'on' : ''}" data-acpage="${p}">${p}</button>`).join('')}
      <button class="ac-pg" data-acpage="${page + 1}" ${page >= pages ? 'disabled' : ''}>下一页</button>
      <span class="ac-pager-info">每页 ${pageSize} 条 · 共 ${list.length} 条</span>
    </div>
  </div>`

  el.querySelectorAll('[data-acat]').forEach((b) => b.addEventListener('click', () => {
    state.academyCat = b.dataset.acat
    state.academyPage = 1
    renderView()
  }))
  el.querySelectorAll('[data-acpage]').forEach((b) => b.addEventListener('click', () => {
    const p = Number(b.dataset.acpage)
    if (!Number.isFinite(p)) return
    state.academyPage = Math.min(Math.max(p, 1), pages)
    renderView()
  }))
  el.querySelectorAll('[data-aid]').forEach((b) => b.addEventListener('click', () => {
    const it = items.find((x) => x.id === b.dataset.aid)
    if (it) openAcModal(it)
  }))
}

/* -------------------------------- 更多 -------------------------------- */
const ENTERPRISE_ITEMS = [
  ['knowledge', '智能笔记本', 'book'],
  ['academy', '教学园地', 'cap'],
  ['bid', '智能投标', 'doc'],
  ['notice', '通知公告', 'megaphone'],
  ['oa', 'OA 办公', 'doc'],
  ['datacenter', '数据中心', 'database'],
  ['oneMap', '一张图', 'map'],
]

const MORE_PLACEHOLDERS = [
  ['contacts', '通讯录', 'users'],
  ['im', '即时通讯', 'message'],
  ['drive', '云空间', 'cloud'],
]

const MORE_ITEMS = [
  ['monitor', '综合监测', 'pulse'],
  ['renewal', '城市体检和更新', 'target'],
  ['hr', '人事组织', 'users'],
  ['review', '审图平台', 'layers'],
  ['finance', '财务管理', 'chart'],
  ['adminops', '综合管理', 'briefcase'],
]

// 图标栏单列容量：超出后新模块/次要模块自动进入「更多」，不再占图标栏
const RAIL_CAP = 12
function railPlan() {
  const { user } = state.boot
  const vis = (id) => user.visibleModules.includes(id)
  const core = ['imagegen', 'tasks', 'skills', 'projects'].filter(vis)
  const pinned = state.morePinned.filter((id) => vis(id) && MORE_ITEMS.some(([itemId]) => itemId === id))
  const entAll = ENTERPRISE_ITEMS.map(([id]) => id).filter(vis)
  const slots = Math.max(0, RAIL_CAP - core.length)
  const entPool = entAll.filter((id) => !state.moreSet.includes(id))
  const entShown = entPool.slice(0, slots)
  const room = Math.max(0, slots - entShown.length)
  const pinnedShown = pinned.slice(0, room)
  const entHidden = [...entPool.slice(entShown.length), ...entAll.filter((id) => state.moreSet.includes(id))]
  const pinnedRoom = Math.max(0, room - pinnedShown.length)
  return { core, pinned: pinnedShown, pinnedShown, pinnedAll: pinned, entShown, entHidden, pinnedRoom, room, full: pinnedRoom === 0 }
}

function openMoreMenu(anchor) {
  if (window.__morePop && window.__morePop.__anchor === anchor) {
    const old = window.__morePop
    if (old.__closer) document.removeEventListener('click', old.__closer)
    old.remove()
    window.__morePop = null
    return
  }
  document.querySelectorAll('.rail-pop').forEach((p) => p.remove())
  window.__morePop = null
  const { user, modules } = state.boot
  const plan = railPlan()
  if (state.morePinned.length > plan.pinnedShown.length) {
    state.morePinned = [...plan.pinnedShown]
    localStorage.setItem('jg.morePinned', JSON.stringify(state.morePinned))
  }
  const entMeta = new Map(ENTERPRISE_ITEMS.map(([id, label, ic]) => [id, [id, label, ic]]))
  const moved = plan.entHidden.filter((id) => entMeta.has(id)).map((id) => entMeta.get(id))
  const pinnedItems = plan.pinnedShown.map((id) => MORE_ITEMS.find((x) => x[0] === id) || entMeta.get(id)).filter(Boolean)
  const seen = new Set()
  const list = [...MORE_ITEMS, ...moved, ...pinnedItems]
    .filter(([id]) => user.visibleModules.includes(id))
    .filter(([id]) => (seen.has(id) ? false : seen.add(id)))
  const pop = document.createElement('div')
  pop.className = 'rail-pop more-pop'
  pop.innerHTML = `
    ${list.map(([id, label, ic]) => {
      const on = plan.pinnedShown.includes(id)
      const show = on || plan.pinnedRoom > 0
      return `
      <div class="rail-pop-row">
        <button class="rail-pop-item" data-mnav="${id}">
          <span class="ico">${icon(ic)}</span><span>${esc(modules[id]?.label || label)}</span>
        </button>
        <button class="more-pin${on ? ' is-on' : ''}" data-mpin="${id}" title="${on ? '取消置顶' : '置顶到图标栏'}" style="${show ? '' : 'display:none'}">${icon('pin')}</button>
      </div>`
    }).join('')}
    ${MORE_PLACEHOLDERS.map(([id, label, ic]) => `
      <div class="rail-pop-row more-placeholder">
        <button class="rail-pop-item" disabled>
          <span class="ico">${icon(ic)}</span><span>${label}</span>
        </button>
      </div>`).join('')}`
  document.body.appendChild(pop)
  pop.__anchor = anchor
  window.__morePop = pop
  const r = anchor.getBoundingClientRect()
  pop.style.left = `${r.right + 10}px`
  pop.style.bottom = `${Math.max(10, window.innerHeight - r.bottom - 4)}px`
  pop.querySelectorAll('[data-mnav]').forEach((b) => b.addEventListener('click', () => {
    pop.remove()
    state.view = b.dataset.mnav
    render()
  }))
  pop.querySelectorAll('[data-mpin]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation()
    const id = b.dataset.mpin
    const cur = railPlan()
    const wasPinned = cur.pinnedShown.includes(id)
    if (wasPinned) {
      state.morePinned = cur.pinnedShown.filter((x) => x !== id)
    } else {
      if (cur.pinnedRoom <= 0) return toast('图标栏已满，先取消一个置顶', true)
      state.morePinned = [...cur.pinnedShown, id]
    }
    localStorage.setItem('jg.morePinned', JSON.stringify(state.morePinned))
    renderRail()
    const now = railPlan()
    const label = modules[id]?.label || id
    pop.querySelectorAll('[data-mpin]').forEach((x) => {
      const on = now.pinnedShown.includes(x.dataset.mpin)
      x.classList.toggle('is-on', on)
      x.innerHTML = icon('pin')
      x.title = on ? '取消置顶' : '置顶到图标栏'
      x.style.display = on || now.pinnedRoom > 0 ? '' : 'none'
    })
    toast(wasPinned ? `已取消置顶「${label}」` : `已置顶「${label}」，已显示在图标栏`)
  }))
  setTimeout(() => {
    pop.__closer = function close(ev) {
      if (!pop.contains(ev.target) && ev.target.isConnected) {
        if (window.__morePop === pop) window.__morePop = null
        pop.remove()
        document.removeEventListener('click', close)
      }
    }
    document.addEventListener('click', pop.__closer)
  }, 0)
}

async function openAiTools() {
  const { body } = await api('/api/ai/tools')
  const tools = body.items || []
  const mask = openModal('AI 调用能力', `
    <div class="tool-list">
      <div class="tool-row head"><span>工具</span><span>模块</span><span>入参</span><span></span></div>
      ${tools.map((t) => `
        <div class="tool-row">
          <span class="tool-name"><span class="mono">${esc(t.name)}</span><em>${esc(t.label)}</em></span>
          <span class="tool-target">${esc(t.target)}</span>
          <span class="tool-args"><span class="mono">${esc(t.args)}</span></span>
          <span class="tool-desc">${esc(t.desc)}</span>
          <span class="tool-act"><button class="dr-btn" data-tooltry="${esc(t.name)}">试调用</button></span>
        </div>`).join('')}
    </div>
    <div class="form-foot"><span class="mono">共 ${tools.length} 个工具 · 按模块授权并写审计</span></div>`, { wide: true })
  mask.querySelectorAll('[data-tooltry]').forEach((b) => b.addEventListener('click', () => openToolTry(b.dataset.tooltry, tools)))
}

async function openToolTry(name, tools) {
  const t = tools.find((x) => x.name === name)
  const args = JSON.parse(t.args)
  const { body } = await api('/api/ai/invoke', { method: 'POST', body: JSON.stringify({ tool: name, args }) })
  const mask = openModal(`试调用 ${t.label}`, `
    <div class="asset-kv">
      <div><span>工具</span><b class="mono">${esc(name)}</b></div>
      <div><span>调用身份</span><b>${esc(body.actor || '')}</b></div>
      <div><span>模块</span><b>${esc(t.target)}</b></div>
      <div><span>结果</span><b>${body.ok ? '成功' : '被拒绝'}</b></div>
    </div>
    <div class="tool-json"><pre>${esc(JSON.stringify(body.result || body.error, null, 2))}</pre></div>
    <div class="form-foot"><span class="mono">ai.invoke · allow</span></div>`, { wide: true })
}


/* 外部访客：模块壳子——入口与框架可见，企业数据不落地 */
function renderGuestShell(el, view) {
  const { modules } = state.boot || { modules: {} }
  const label = modules[view]?.label || view
  el.innerHTML = `
    <div class="view-head">
      <div>
        <div class="view-title">${esc(label)}</div>
        
      </div>
    </div>
    <div class="g-shell">
      <div class="g-shell-ico">${icon('shield')}</div>
      <div class="g-shell-title">当前身份无权读取该模块的企业数据</div>
      <div class="g-shell-desc">需要时可申请模块授权。</div>
      <div class="g-shell-actions">
        <button class="btn ghost" data-gohome>返回首页</button>
        <button class="btn" data-goreq>申请模块授权</button>
      </div>
    </div>`
  el.querySelector('[data-gohome]').addEventListener('click', () => { state.view = 'home'; render() })
  el.querySelector('[data-goreq]').addEventListener('click', () => openFeedbackModal())
}




/* ===== 恢复：被脚本误删的视图函数 ===== */


function renderChat(el) {
  const conv = state.conversation
  const msgs = conv?.messages || []
  const hasStreaming = msgs.some((m) => m.streaming)
  const thinking = state.chatBusy && !hasStreaming
  const project = currentProject()
  if (state.activeProjectId && !project) {
    state.activeProjectId = ''
    state.activeProjectName = ''
    state.activeProjectCwd = ''
  }

  el.innerHTML = `
    <div class="chat${state.shareMode ? ' share-mode' : ''}" style="height:100%;min-height:0">
      <div class="chat-head">
        <div class="chat-title">${esc(conv?.title || '新对话')}</div>
        ${project ? `<div class="chat-empty-sub" style="margin:3px 0 0">${esc(project.name)} · ${esc(project.cwd)} · ${project.status === 'online' ? '已连接' : '文件夹不可用'}</div>` : ''}
        <div class="chat-head-actions">
          <button type="button" class="msg-act icon" data-copy-thread title="复制整段对话" aria-label="复制对话">${icon('doc')}</button>
          <button type="button" class="msg-act icon" data-visual-shelf title="可视化成果" aria-label="可视化成果">${icon('grid')}</button>
          <button type="button" class="msg-act icon" data-share-thread title="分享整段对话" aria-label="分享对话">${icon('send')}</button>
        </div>
      </div>
      <div class="chat-msgs" id="chatMsgs" style="width:100%;max-width:none;margin:0 auto;box-sizing:border-box">
        ${jobsPanel(msgs)}
        ${msgs.length ? msgs.map((m, i) => renderMsg(m, i)).join('') : `
          <div class="chat-empty">
            <div class="chat-empty-title">${esc(conv ? '继续这个会话' : '有什么可以帮你？')}</div>
            <div class="chat-empty-sub">${project ? `${esc(project.cwd)} · Agent 将直接读取该目录中的文件` : '普通问答不需要项目；需要操作本地文件时，再在输入框下方绑定项目或文件夹。'}</div>
          </div>`}
        ${thinking ? thinkingCardHTML() : ''}
        ${stepsCardHTML()}
        ${state.chatError ? `<div class="chat-error"><b>调用失败</b><span>${esc(state.chatError)}</span><button class="btn sm" id="retryMsg">重试</button></div>` : ''}
        ${state.pendingConfirm ? renderConfirm() : ''}
        ${state.pendingInteraction ? renderInteraction() : ''}
      </div>
      ${(state.composerRefs || []).length ? `<div class="hh-refs" style="justify-content:center;align-self:center;width:100%;min-width:280px;max-width:920px;margin:0 auto 10px;box-sizing:border-box">
        ${state.composerRefs.map((r) => `<span class="hh-ref" data-refdrop="${esc(r.id)}">
          ${r.preview ? `<img class="hh-ref-thumb" src="${esc(r.preview)}" alt="图片附件" style="width:22px;height:22px;border-radius:5px;object-fit:cover;flex:none">` : `<span class="ico">${icon(r.kind === 'project' ? 'folder' : 'doc')}</span>`}${esc(composerRefLabel(r))}<span class="hh-ref-x">×</span>
        </span>`).join('')}
      </div>` : ''}
      <div class="hh-composer" style="align-self:center;width:100%;min-width:280px;max-width:920px;margin:0 auto;box-sizing:border-box">
        <div style="display:flex;align-items:center;gap:6px;flex:none">
          <button class="hc-plus" id="chatAttach" title="添加照片、文件或工具"><span class="ico">${icon('plus')}</span></button>
          ${state.pendingInteraction?.kind === 'approval' ? approvalControl() : ''}
          ${policyControl()}
        </div>
        <textarea id="draft" rows="1" placeholder="继续追问…">${esc(state.draft)}</textarea>
        <div class="hc-right">
          <button class="hc-mic" id="chatMic" title="语音输入"><span class="ico">${icon('mic')}</span></button>
          ${state.chatBusy
            ? `<button class="hc-send" id="chatStop" title="停止生成">${icon('stop')}</button>`
            : `<button class="hc-send" id="chatSend" title="发送">${icon('up')}</button>`}
        </div>
      </div>
      <div class="quick-row" style="align-self:center;justify-content:space-between;align-items:center;margin:8px auto 0;width:72%;min-width:280px;max-width:920px;box-sizing:border-box;flex-wrap:wrap;gap:6px">
        <div style="display:flex;gap:6px;align-items:center">${projectContextControl()}</div>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="hc-lang" id="chatLang" title="推理强度"><span id="chatLangValue">${reasoningLabel(state.reasoningEffort)}</span><span class="ico hc-caret">${icon('chevron')}</span></button>
          ${taskModeControl()}
        </div>
      </div>
      ${shareBarHTML()}
    </div>`

  const draft = el.querySelector('#draft')
  draft?.addEventListener('input', (e) => { state.draft = e.target.value; updateSlashMenu(e.target); updateMentionMenu(e.target) })
  bindComposerPaste(draft)
  el.querySelector('#projectContext')?.addEventListener('click', openWorkspacePicker)
  el.querySelector('#taskModeBtn')?.addEventListener('click', (ev) => { ev.stopPropagation(); openTaskModeMenu(ev.currentTarget) })
  el.querySelector('#policyToggle')?.addEventListener('click', (ev) => { ev.stopPropagation(); openPolicyMenu(ev.currentTarget) })
  el.querySelector('#approvalToggle')?.addEventListener('click', (ev) => { ev.stopPropagation(); openApprovalMenu(ev.currentTarget) })
  draft?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeSlashMenu(); closeMentionMenu() }
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); closeMentionMenu(); sendFromChat() }
  })
  if (state.chatFocus) { draft?.focus(); state.chatFocus = false }
  el.querySelector('#chatSend')?.addEventListener('click', sendFromChat)
  el.querySelector('#chatStop')?.addEventListener('click', cancelChat)
  el.querySelector('#chatAttach')?.addEventListener('click', (ev) => openComposerPlus(ev.currentTarget))
  el.querySelectorAll('[data-refdrop]').forEach((b) => b.addEventListener('click', () => {
    removeComposerRef(b.dataset.refdrop)
    renderView()
  }))
  el.querySelector('#chatLang')?.addEventListener('click', (ev) => { ev.stopPropagation(); openReasoningMenu(ev.currentTarget) })
  el.querySelector('#chatMic')?.addEventListener('click', (ev) => startVoiceInput(ev.currentTarget))
  el.querySelector('#shareAll')?.addEventListener('change', (e) => {
    state.shareSelection = e.target.checked ? shareEligibleIndexes() : []
    syncShareBar()
  })
  el.querySelectorAll('[data-share-pick]').forEach((input) => input.addEventListener('change', () => {
    const idx = Number(input.dataset.sharePick)
    const set = new Set(state.shareSelection || [])
    if (input.checked) set.add(idx); else set.delete(idx)
    state.shareSelection = [...set]
    syncShareBar()
  }))
  el.querySelector('#shareImage')?.addEventListener('click', downloadShareImage)
  el.querySelector('#shareLink')?.addEventListener('click', copyShareLink)
  el.querySelectorAll('[data-prompt]').forEach((b) => b.addEventListener('click', () => {
    state.draft = b.dataset.prompt
    renderView()
  }))
  el.querySelector('#retryMsg')?.addEventListener('click', () => {
    const last = (state.conversation?.messages || []).filter((m) => m.role === 'user').pop()
    if (last) sendMessage(last.text)
  })
  el.querySelector('[data-visual-shelf]')?.addEventListener('click', () => window.JGVisuals?.openShelf())
  el.querySelector('#confirmGo')?.addEventListener('click', confirmWrite)
  el.querySelector('#apprAllow')?.addEventListener('click', () => decideApproval('allowed-once'))
  el.querySelector('#apprReject')?.addEventListener('click', () => decideApproval('rejected'))
  el.querySelectorAll('[data-qopt]').forEach((b) => b.addEventListener('click', () => {
    const qid = b.dataset.qopt
    const label = b.dataset.qlabel
    const q = state.pendingInteraction?.questions?.find((x) => x.id === qid)
    const set = new Set(state.qSel?.[qid] || [])
    if (q?.multiSelect) {
      if (set.has(label)) set.delete(label); else set.add(label)
    } else {
      set.clear()
      set.add(label)
    }
    state.qSel = { ...(state.qSel || {}), [qid]: [...set] }
    renderView()
  }))
  el.querySelectorAll('[id^="qCustom-"]').forEach((input) => input.addEventListener('input', () => {
    const qid = input.id.slice('qCustom-'.length)
    state.qCustom = { ...(state.qCustom || {}), [qid]: input.value }
  }))
  el.querySelector('#qSubmit')?.addEventListener('click', () => submitAnswer(false))
  el.querySelector('#qCancel')?.addEventListener('click', () => submitAnswer(true))
  el.querySelector('#confirmCancel')?.addEventListener('click', () => {
    state.pendingConfirm = null
    state.conversation?.messages.push({ role: 'assistant', text: '已取消写入。任务未创建，未产生任何数据变更。', time: '刚刚' })
    renderView()
  })
  document.getElementById('chatMsgs')?.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-killjob]')
    if (btn) stopJob(btn.dataset.killjob)
  })
  const msgsBox = document.getElementById('chatMsgs')
  if (msgsBox) msgsBox.scrollTop = msgsBox.scrollHeight
  window.JGVisuals?.renderAll(el)
}


function stepsBlock(steps, open = false) {
  if (!steps || !steps.length) return ''
  const kinds = [
    ['计划', steps.filter((s) => s.tool === '计划模式').length],
    ['压缩', steps.filter((s) => s.tool === '上下文压缩').length],
    ['子代理', steps.filter((s) => s.tool === '子代理').length],
  ].filter(([, n]) => n)
  const suffix = kinds.length ? ` · ${kinds.map(([label, n]) => `${label} ${n}`).join(' · ')}` : ''
  return `<details class="steps-block"${open ? ' open' : ''}>
    <summary class="steps-title">执行过程 · ${steps.length} 步${suffix}</summary>
    ${steps.map(stepRow).join('')}
  </details>`
}


function jobsBlock(jobs, showKill = false) {
  if (!jobs || !jobs.length) return ''
  return `<details class="steps-block" open>
    <summary class="steps-title">后台作业 · ${jobs.length}</summary>
    <div class="step-detail">停止操作会结束该会话所属的沙箱运行时，并同时终止其中的全部后台作业。</div>
    ${jobs.map((j) => {
      const live = /running|pending|已启动/i.test(j.status)
      const dot = /fail|error|kill|停止/i.test(j.status) ? 'bad' : live ? 'warn' : 'ok'
      return `<div class="step">
        <span class="step-dot ${dot}"></span>
        <span class="step-tool">${esc(j.id)}</span>
        <span class="step-detail">${esc(j.kind)} · ${esc(j.status)} — ${esc(j.label)}${j.detail ? ` · ${esc(j.detail)}` : ''}</span>
        ${showKill && live ? `<button class="btn sm" data-killjob="${esc(j.id)}" style="margin-left:8px" title="停止该作业所属的沙箱运行时；会同时结束该项目下的其他后台作业">停止运行时</button>` : ''}
      </div>`
    }).join('')}
  </details>`
}

function jobsPanel(msgs) {
  const jobs = []
  for (const m of (msgs || [])) {
    for (const j of (m.jobs || [])) {
      if (!jobs.some((x) => x.id === j.id)) jobs.push(j)
    }
  }
  return jobs.length ? jobsBlock(jobs, true) : ''
}


function todoBlock(todos) {
  if (!todos || !todos.length) return ''
  const done = todos.filter((t) => t.status === 'completed').length
  return `<details class="steps-block" open>
    <summary class="steps-title">任务清单 · ${done}/${todos.length} 完成</summary>
    ${todos.map((t) => {
      const label = t.status === 'completed' ? '已完成' : t.status === 'in_progress' ? '进行中' : '待办'
      const dot = t.status === 'completed' ? 'ok' : 'warn'
      return `<div class="step">
        <span class="step-dot ${dot}"></span>
        <span class="step-tool">${t.status === 'completed' ? `<s>${esc(t.content)}</s>` : esc(t.content)}</span>
        <span class="step-detail">${label}</span>
      </div>`
    }).join('')}
  </details>`
}


function changeBlock(changes) {
  if (!changes || !changes.length) return ''
  const label = { added: '新增', modified: '修改', removed: '删除' }
  const size = (n) => {
    const v = Math.max(0, Number(n) || 0)
    return v < 1024 ? `${v} B` : v < 1024 * 1024 ? `${(v / 1024).toFixed(1)} KB` : `${(v / 1024 / 1024).toFixed(1)} MB`
  }
  return `<details class="steps-block">
    <summary class="steps-title">本轮文件变更 · ${changes.length}</summary>
    ${changes.map((c) => {
      const dot = c.change === 'removed' ? 'bad' : 'ok'
      const delta = c.change === 'modified' && typeof c.delta === 'number' && c.delta
        ? `（${c.delta > 0 ? '+' : ''}${size(Math.abs(c.delta))}）`
        : ''
      return `<div class="step">
        <span class="step-dot ${dot}"></span>
        <span class="step-tool">${esc(c.rel || c.path)}</span>
        <span class="step-detail">${label[c.change] || c.change} · ${size(c.size)}${delta}</span>
      </div>`
    }).join('')}
  </details>`
}


function workflowBlock(workflows) {
  if (!workflows || !workflows.length) return ''
  const stateOf = (s) => s === 'failed' || s === 'error' ? '失败' : s === 'cancelled' ? '取消' : s === 'completed' ? '完成' : '运行中'
  return workflows.map((w) => {
    const members = w.members || []
    const phases = []
    for (const node of members) {
      const phase = node.phase || '未分阶段'
      let group = phases.find((x) => x.name === phase)
      if (!group) { group = { name: phase, nodes: [] }; phases.push(group) }
      group.nodes.push(node)
    }
    const done = members.filter((n) => n.status === 'completed').length
    return `<details class="steps-block">
      <summary class="steps-title">工作流 · ${esc(w.name || '工作流')} · ${done}/${members.length} 节点</summary>
      ${phases.map((g) => `<div class="step">
        <span class="step-dot ok"></span>
        <span class="step-tool">${esc(g.name)}</span>
        <span class="step-detail">${g.nodes.length} 个节点</span>
      </div>${g.nodes.map((n) => `<div class="step" style="padding-left:18px">
        <span class="step-dot ${/fail|error|cancel/.test(n.status || '') ? 'bad' : n.status === 'running' ? 'warn' : 'ok'}"></span>
        <span class="step-tool">${esc(n.label || `节点 ${n.seq}`)}</span>
        <span class="step-detail">${stateOf(n.status)}${n.childId ? ` · <span class="mono">${esc(n.childId)}</span>` : ''}</span>
      </div>`).join('')}`).join('')}
    </details>`
  }).join('')
}


function subagentBlock(subs) {
  if (!subs || !subs.length) return ''
  const stateOf = (s) => s.status === 'error' || s.status === 'failed' ? '失败' : s.status === 'running' ? '进行中' : '完成'
  const toneOf = (s) => /error|fail/i.test(s.status || '') ? 'bad' : s.status === 'running' ? 'warn' : 'ok'
  const done = subs.filter((s) => s.status !== 'running').length
  const active = subs.filter((s) => s.status === 'running').length
  return `<details class="steps-block" open>
    <summary class="steps-title">Agent Team · 任务板 · ${done}/${subs.length} 已结束${active ? ` · ${active} 个进行中` : ''}</summary>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;padding:2px 12px 12px">
      ${subs.map((s, i) => {
        const label = s.name || s.provider || `子代理 ${i + 1}`
        const child = String(s.childSessionId || '').slice(0, 8)
        const task = s.task || `子代理会话 ${child || '—'}`
        const output = String(s.output || '').replace(/\s+$/, '').slice(0, 240)
        return `<div style="border:1px solid #e7ebf1;border-radius:8px;background:#fff;padding:9px 10px;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;min-width:0">
            <span class="mc-tag ${toneOf(s)}">${esc(stateOf(s))}</span>
            <b style="font-size:12px;color:#202124;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(label)}</b>
            <span style="flex:1"></span>
            <span class="mono" style="font-size:10px;color:#9aa1aa" title="${esc(s.childSessionId || '')}">${esc(child || '—')}</span>
          </div>
          <div style="font-size:11px;color:#4b5056;line-height:1.5;margin-top:5px;word-break:break-word">${esc(task)}</div>
          <div style="font-size:11px;color:#7b8087;line-height:1.55;margin-top:6px;white-space:pre-wrap;word-break:break-word">${output ? esc(output) : '未返回正文'}${String(s.output || '').length > 240 ? '…' : ''}</div>
          ${s.stopReason ? `<div style="font-size:10px;color:#9aa1aa;margin-top:5px">结束原因 · ${esc(s.stopReason)}</div>` : ''}
        </div>`
      }).join('')}
    </div>
  </details>`
}


function deliverableBlock(files) {
  if (!files || !files.length) return ''
  return `<div class="hh-refs">
    ${files.map((f) => {
      const name = String(f.path || '').split(/[\\/]/).pop() || '交付文件'
      return `<a class="hh-ref" href="/api/harness/file?path=${encodeURIComponent(f.path)}" target="_blank" title="${esc(f.description || f.path)}">
        <span class="ico">${icon('doc')}</span>${esc(name)}<span class="hh-ref-x">打开</span>
      </a>`
    }).join('')}
  </div>`
}


function usageText(u) {
  if (!u || !u.calls) return ''
  const total = u.totalTokens || ((u.inputTokens || 0) + (u.outputTokens || 0))
  return `${Number(total).toLocaleString('zh-CN')} tokens`
}

function usageTip(u) {
  if (!u || !u.calls) return ''
  const parts = [`输入 ${Number(u.inputTokens || 0).toLocaleString('zh-CN')}`, `输出 ${Number(u.outputTokens || 0).toLocaleString('zh-CN')}`]
  if (u.cacheReadTokens) parts.push(`缓存读 ${Number(u.cacheReadTokens).toLocaleString('zh-CN')}`)
  if (u.reasoningTokens) parts.push(`推理 ${Number(u.reasoningTokens).toLocaleString('zh-CN')}`)
  return `${u.calls} 次模型调用 · ${parts.join(' / ')}`
}

function traceEventSummary(event) {
  const data = event && event.data && typeof event.data === 'object' ? event.data : {}
  const type = String(event?.type || 'event')
  if (data.toolName || data.name) return `${data.toolName || data.name}`
  if (data.toolCallId) return `调用 ${data.toolCallId}`
  if (data.text) return String(data.text).replace(/\s+/g, ' ').slice(0, 120)
  if (data.message) return String(data.message).replace(/\s+/g, ' ').slice(0, 120)
  if (data.reason) return typeof data.reason === 'string' ? data.reason : JSON.stringify(data.reason).slice(0, 120)
  return type === 'turn/end' ? '本轮结束' : ''
}

function traceRowsHtml(trace) {
  const events = Array.isArray(trace?.events) ? trace.events : []
  const shown = events.slice(0, 1200)
  return shown.map((event, i) => {
    const type = String(event?.type || 'event')
    const data = JSON.stringify(event?.data ?? {}, null, 0)
    return `<tr class="mc-trow">
      <td class="mono" style="width:48px">${i + 1}</td>
      <td><span class="mc-tag">${esc(type)}</span></td>
      <td style="white-space:pre-wrap;word-break:break-word">${esc(traceEventSummary(event))}</td>
      <td><details><summary class="mono" style="cursor:pointer">原始</summary><div class="mono" style="max-width:520px;max-height:180px;overflow:auto;white-space:pre-wrap;word-break:break-all">${esc(data)}</div></details></td>
    </tr>`
  }).join('') || '<tr class="mc-trow"><td colspan="4">本轮没有可展示的 SDK 事件</td></tr>'
}

async function openRunTrace(conversationId, traceId) {
  const { ok, body } = await api(`/api/conversation/trace?id=${encodeURIComponent(conversationId)}&trace=${encodeURIComponent(traceId)}`)
  if (!ok || !body.trace) return toast(body?.error || '本轮轨迹不存在', true)
  const trace = body.trace
  const stats = trace.stats || {}
  const mask = openModal('运行轨迹', `
    <div class="mc-block" style="margin:0">
      <div class="mc-block-head"><b>本轮事件流</b><span class="mono">${esc(trace.traceId || traceId)} · ${Number(stats.eventCount || trace.events?.length || 0)} 个事件</span></div>
      <div class="form-note">来源：DSH SDK 本轮真实返回的 events / notifications；不是前端演示轨迹。</div>
      <div style="display:flex;gap:8px;margin:8px 0;flex-wrap:wrap">
        <button class="btn sm" id="traceReplay">回放</button>
        <button class="btn sm" id="traceDownload">下载 JSON</button>
        <span class="mono" style="align-self:center">模型 ${esc(stats.model || trace.model || '—')} · ${Number(stats.durationMs || 0)} ms · ${Number(stats.toolCalls || 0)} 次工具调用</span>
      </div>
      <div style="max-height:58vh;overflow:auto">
        <table class="mc-table"><thead class="mc-thead"><tr><th>#</th><th>事件</th><th>摘要</th><th>数据</th></tr></thead>
        <tbody id="traceRows">${traceRowsHtml(trace)}</tbody></table>
      </div>
    </div>`)
  mask.querySelector('#traceDownload').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(trace, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${trace.traceId || traceId}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  })
  mask.querySelector('#traceReplay').addEventListener('click', (ev) => {
    const rows = [...mask.querySelectorAll('#traceRows .mc-trow')]
    if (!rows.length) return
    rows.forEach((r) => { r.style.display = 'none' })
    let i = 0
    ev.currentTarget.disabled = true
    const timer = setInterval(() => {
      if (i >= rows.length) {
        clearInterval(timer)
        ev.currentTarget.disabled = false
        return
      }
      rows[i].style.display = ''
      rows[i].scrollIntoView({ block: 'nearest' })
      i++
    }, 180)
  })
}

function formatTokensK(u) {
  const total = Number(u?.totalTokens || ((u?.inputTokens || 0) + (u?.outputTokens || 0)) || 0)
  if (!u?.calls || !total) return ''
  return `${(total / 1000).toFixed(2)}K`
}

function tokenBadgeHTML(m) {
  const value = formatTokensK(m.usage)
  if (!value) return ''
  return `<span class="msg-cost" title="${esc(usageTip(m.usage))}"><span class="ico">${icon('clock')}</span>消耗 ${esc(value)}</span>`
}

function shareSelected(idx) {
  return (state.shareSelection || []).includes(Number(idx))
}

function sharePickHTML(idx, on) {
  if (!state.shareMode || idx == null) return ''
  return `<label class="share-pick${on ? ' on' : ''}" title="选择这条消息">
    <input type="checkbox" data-share-pick="${idx}" ${on ? 'checked' : ''} aria-label="选择这条消息">
    <span class="share-box">${icon('check')}</span>
  </label>`
}

function shareEligibleIndexes() {
  return (state.conversation?.messages || [])
    .map((m, i) => (String(m.text || '').trim() && !m.streaming ? i : -1))
    .filter((i) => i >= 0)
}

function shareBarHTML() {
  if (!state.shareMode) return ''
  const eligible = shareEligibleIndexes()
  const selected = (state.shareSelection || []).filter((i) => eligible.includes(Number(i)))
  const all = eligible.length > 0 && selected.length === eligible.length
  return `<div class="share-bar">
    <label class="share-all"><input type="checkbox" id="shareAll" ${all ? 'checked' : ''}><span>全选</span></label>
    <span class="share-count">已选 ${selected.length} 条 · Esc 退出</span>
    <div class="share-actions">
      <button type="button" class="share-btn" id="shareImage" ${selected.length ? '' : 'disabled'}>分享图片</button>
      <button type="button" class="share-btn primary" id="shareLink" ${selected.length ? '' : 'disabled'}>复制链接</button>
    </div>
  </div>`
}

function visualBlock(visuals) {
  if (!Array.isArray(visuals) || !visuals.length) return ''
  return `<div class="jg-visuals">${visuals.map((v) => {
    const id = String(v?.id || '')
    if (!id) return ''
    const version = Number(v?.version || 1)
    const typeLabel = String(v?.typeLabel || v?.type || '可视化')
    return `<div class="jg-visual" data-visual-id="${esc(id)}" data-visual-version="${version}" data-visual-type="${esc(v?.type || '')}">
      <div class="jg-visual-loading"><span class="jg-visual-spinner"></span><span>${esc(typeLabel)}渲染中…</span></div>
    </div>`
  }).join('')}</div>`
}

function renderMsg(m, idx = null) {
  const on = shareSelected(idx)
  if (m.role === 'user') {
    return `<div class="msg user${state.shareMode ? ' share-mode' : ''}${on ? ' share-on' : ''}">
      ${sharePickHTML(idx, on)}<div class="bubble">${esc(m.text)}</div>
      ${idx != null ? `<div class="msg-actions user-actions">
        <span class="msg-time-inline">${esc(m.time || '')}</span>
        <button type="button" class="msg-act icon" title="复制" aria-label="复制" data-copymsg="${idx}">${icon('copy')}</button>
        <button type="button" class="msg-act icon" title="分享" aria-label="分享" data-sharemsg="${idx}">${icon('share')}</button>
        <button type="button" class="msg-act icon" title="编辑并重新发送" aria-label="编辑" data-editmsg="${idx}">${icon('pen')}</button>
        <button type="button" class="msg-act icon" title="更多" aria-label="更多" data-moremsg="${idx}">${icon('more')}</button>
      </div>` : `<div class="msg-time">${esc(m.time || '')}</div>`}
    </div>`
  }
  return `<div class="msg ai${state.shareMode ? ' share-mode' : ''}${on ? ' share-on' : ''}">
    ${sharePickHTML(idx, on)}
    <div class="ai-avatar">JG</div>
    <div class="ai-body">
      ${todoBlock(m.todos)}
      ${workflowBlock(m.workflows)}
      ${subagentBlock(m.subagents)}
      ${stepsBlock(m.steps)}
      <div class="bubble">${m.text ? markdownHTML(m.text) : ''}${m.streaming ? '<span class="caret"></span>' : ''}</div>
      ${visualBlock(m.visuals)}
      ${deliverableBlock(m.deliverables)}
      ${changeBlock(m.workspaceChanges)}
      ${m.citations?.length ? `<div class="cite-row">${m.citations.map((c) => `<span class="cite">${richTextHTML(c)}</span>`).join('')}</div>` : ''}
      ${idx != null && !m.streaming ? `<div class="msg-actions">
        <button type="button" class="msg-act icon" title="复制" aria-label="复制" data-copymsg="${idx}">${icon('copy')}</button>
        <button type="button" class="msg-act icon ${state.speakingIndex === idx ? 'on' : ''}" title="${state.speakingIndex === idx ? (state.speechLoading ? '正在生成语音' : (state.speechPaused ? '继续朗读' : '暂停朗读')) : '朗读这条回复'}" aria-label="朗读" data-speak="${idx}">${icon('volume')}</button>
        <button type="button" class="msg-act icon ${m.feedback === 'up' ? 'on' : ''}" title="有帮助" aria-label="有帮助" data-fb="${idx}" data-fbv="${m.feedback === 'up' ? 'clear' : 'up'}">${icon('thumbUp')}</button>
        <button type="button" class="msg-act icon ${m.feedback === 'down' ? 'on' : ''}" title="需改进" aria-label="需改进" data-fb="${idx}" data-fbv="${m.feedback === 'down' ? 'clear' : 'down'}">${icon('thumbDown')}</button>
        <button type="button" class="msg-act icon" title="分享" aria-label="分享" data-sharemsg="${idx}">${icon('share')}</button>
        ${tokenBadgeHTML(m)}
        <button type="button" class="msg-act icon" title="重新生成这条回复" aria-label="重新生成" data-refreshmsg="${idx}">${icon('refresh')}</button>
        ${m.traceId ? `<button type="button" class="msg-act icon" title="更多" aria-label="更多" data-moremsg="${idx}">${icon('more')}</button>` : ''}
        <span class="msg-time-inline" title="${esc(usageTip(m.usage))}">${esc(m.time || '')}</span>
      </div>` : `<div class="msg-time">${esc(m.time || '')}${m.usage?.calls ? `<span title="${esc(usageTip(m.usage))}"> · ${esc(usageText(m.usage))}</span>` : ''}</div>`}
    </div>
  </div>`
}

async function copyToClipboard(text) {
  const value = String(text || '')
  try {
    const area = document.createElement('textarea')
    area.value = value
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.focus()
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    if (ok) return true
  } catch {}
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch {}
  return false
}

function messageShareText(m) {
  const title = state.conversation?.title || '九规智能中枢对话'
  return `${title}\n\n${String(m?.text || '')}`.trim()
}

function conversationPlainText() {
  const title = state.conversation?.title || '九规智能中枢对话'
  const messages = (state.conversation?.messages || []).filter((m) => String(m.text || '').trim())
  return `${title}\n\n${messages.map((m) => `${m.role === 'user' ? '你' : '九规智能中枢'}：${String(m.text || '').trim()}`).join('\n\n')}`.trim()
}

async function copyConversation() {
  const ok = await copyToClipboard(conversationPlainText())
  toast(ok ? '已复制整段对话' : '复制失败，请手动选择文本', !ok)
}

function openShareDialog(title, text, kind = '消息') {
  const mask = openModal(`分享${kind}`, `
    <div class="form-note">可以直接调用系统分享，也可以复制完整内容或下载为文本文件。</div>
    <textarea id="shareText" class="text-input" readonly style="height:220px;resize:vertical;line-height:1.6;white-space:pre-wrap">${esc(text)}</textarea>
    <div class="form-foot">
      <span class="spacer"></span>
      <button class="btn" data-mclose>关闭</button>
      ${navigator.share ? '<button class="btn" data-share-native>系统分享</button>' : ''}
      <button class="btn" data-share-download>下载文本</button>
      <button class="btn primary" data-share-copy>复制分享内容</button>
    </div>`)
  mask.querySelectorAll('[data-mclose]').forEach((b) => b.addEventListener('click', () => mask.remove()))
  const nativeBtn = mask.querySelector('[data-share-native]')
  if (nativeBtn) nativeBtn.addEventListener('click', async () => {
    try {
      await navigator.share({ title, text })
      mask.remove()
      toast('已打开系统分享')
    } catch (error) {
      if (error?.name === 'AbortError') return
      toast(error?.message || '系统分享失败，可复制或下载内容', true)
    }
  })
  mask.querySelector('[data-share-copy]').addEventListener('click', async () => {
    const ok = await copyToClipboard(text)
    toast(ok ? '分享内容已复制' : '复制失败，请手动选择文本', !ok)
  })
  mask.querySelector('[data-share-download]').addEventListener('click', () => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${String(title || '分享内容').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80)}.txt`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 500)
    toast('已下载分享文本')
  })
}

async function shareConversation() {
  if (!state.conversation) return
  startShareMode()
}

async function shareConversationById(id) {
  await openConversation(id)
  if (state.conversation?.id === id) startShareMode()
}

function startShareMode(indexes) {
  const eligible = shareEligibleIndexes()
  if (!eligible.length) return toast('当前没有可分享的消息', true)
  const selected = indexes == null
    ? eligible
    : [...new Set(indexes.map(Number).filter((i) => eligible.includes(i)))]
  state.shareMode = true
  state.shareSelection = selected.length ? selected : eligible.slice(0, 1)
  state.chatFocus = false
  render()
}

function exitShareMode() {
  if (!state.shareMode) return
  state.shareMode = false
  state.shareSelection = []
  render()
}

function syncShareBar() {
  const eligible = shareEligibleIndexes()
  const selected = (state.shareSelection || []).filter((i) => eligible.includes(Number(i)))
  state.shareSelection = selected
  document.querySelectorAll('[data-share-pick]').forEach((input) => {
    const on = selected.includes(Number(input.dataset.sharePick))
    input.checked = on
    const label = input.closest('.share-pick')
    label?.classList.toggle('on', on)
    input.closest('.msg')?.classList.toggle('share-on', on)
  })
  const all = document.querySelector('#shareAll')
  if (all) all.checked = eligible.length > 0 && selected.length === eligible.length
  const count = document.querySelector('.share-count')
  if (count) count.textContent = `已选 ${selected.length} 条 · Esc 退出`
  document.querySelectorAll('#shareImage, #shareLink').forEach((b) => { b.disabled = selected.length === 0 })
}

function selectedShareMessages() {
  const msgs = state.conversation?.messages || []
  return (state.shareSelection || [])
    .map((i) => ({ index: Number(i), message: msgs[Number(i)] }))
    .filter((x) => x.message && String(x.message.text || '').trim())
    .sort((a, b) => a.index - b.index)
}

function downloadShareImage() {
  const items = selectedShareMessages()
  if (!items.length) return toast('请至少选择一条消息', true)
  const width = 760
  const pad = 38
  const maxTextWidth = width - pad * 2
  const title = state.conversation?.title || '九规智能中枢对话'
  const stamp = new Date().toLocaleString('zh-CN', { hour12: false })
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  const font = '15px "Microsoft YaHei", "PingFang SC", sans-serif'
  const roleFont = '12px "Microsoft YaHei", "PingFang SC", sans-serif'
  const titleFont = '600 24px "Microsoft YaHei", "PingFang SC", sans-serif'
  const lineHeight = 26
  const wrap = (text, maxWidth) => {
    const lines = []
    String(text || '').split('\n').forEach((paragraph) => {
      let line = ''
      for (const ch of paragraph) {
        if (ctx.measureText(line + ch).width > maxWidth && line) {
          lines.push(line)
          line = ch
        } else {
          line += ch
        }
      }
      lines.push(line || ' ')
    })
    return lines
  }
  ctx.font = titleFont
  const titleLines = wrap(title, maxTextWidth)
  ctx.font = font
  const blocks = items.map(({ message }) => ({
    role: message.role === 'user' ? '你' : '九规智能中枢',
    lines: wrap(String(message.text || '').trim(), maxTextWidth),
  }))
  const contentHeight = titleLines.length * 34 + 28 + blocks.reduce((n, b) => n + 22 + b.lines.length * lineHeight + 24, 0)
  const height = Math.max(360, 84 + contentHeight + 28)
  canvas.width = width * 2
  canvas.height = height * 2
  ctx.scale(2, 2)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#1f2328'
  ctx.font = titleFont
  let y = 54
  titleLines.forEach((line) => { ctx.fillText(line, pad, y); y += 34 })
  ctx.fillStyle = '#8b909a'
  ctx.font = roleFont
  ctx.fillText(`九规智能中枢 · ${stamp}`, pad, y + 2)
  y += 24
  ctx.strokeStyle = '#e8eaed'
  ctx.beginPath()
  ctx.moveTo(pad, y)
  ctx.lineTo(width - pad, y)
  ctx.stroke()
  y += 26
  blocks.forEach((block, index) => {
    ctx.fillStyle = '#8b909a'
    ctx.font = roleFont
    ctx.fillText(block.role, pad, y)
    y += 22
    ctx.fillStyle = '#1f2328'
    ctx.font = font
    block.lines.forEach((line) => { ctx.fillText(line, pad, y); y += lineHeight })
    y += 20
    if (index < blocks.length - 1) {
      ctx.strokeStyle = '#f0f1f3'
      ctx.beginPath()
      ctx.moveTo(pad, y - 8)
      ctx.lineTo(width - pad, y - 8)
      ctx.stroke()
    }
  })
  canvas.toBlob((blob) => {
    if (!blob) return toast('生成分享图片失败', true)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${String(title).replace(/[\\/:*?"<>|]/g, '_').slice(0, 60) || '九规智能中枢'}-分享.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 800)
    toast('分享图片已生成')
  }, 'image/png')
}

async function copyShareLink() {
  const items = selectedShareMessages()
  if (!state.conversation?.id) return toast('当前会话尚未保存，无法生成链接', true)
  if (!items.length) return toast('请至少选择一条消息', true)
  const ids = items.map((x) => x.index).join(',')
  const url = `${location.origin}${location.pathname}?shareConversation=${encodeURIComponent(state.conversation.id)}&shareMsg=${ids}`
  const ok = await copyToClipboard(url)
  toast(ok ? '分享链接已复制' : '复制失败，请重试', !ok)
}

function consumeShareDeepLink() {
  if (state.shareLinkConsumed) return
  if (!state.boot?.user) return
  const params = new URLSearchParams(location.search)
  const cid = params.get('shareConversation')
  if (!cid) return
  state.shareLinkConsumed = true
  const ids = String(params.get('shareMsg') || '').split(',').map(Number).filter(Number.isFinite)
  openConversation(cid).then(() => {
    if (state.conversation?.id !== cid) return
    startShareMode(ids.length ? ids : undefined)
  }).catch(() => toast('分享链接已失效', true))
}

async function copyMessage(index) {
  const m = state.conversation?.messages?.[Number(index)]
  if (!m) return
  const ok = await copyToClipboard(messageShareText(m))
  toast(ok ? '已复制这条消息' : '复制失败，请手动选择文本', !ok)
}

async function shareMessage(index) {
  const m = state.conversation?.messages?.[Number(index)]
  if (!m) return
  startShareMode([Number(index)])
}

function syncSpeechButtons() {
  document.querySelectorAll('[data-speak]').forEach((btn) => {
    const active = Number(btn.dataset.speak) === state.speakingIndex
    btn.classList.toggle('on', active)
    btn.title = active
      ? (state.speechLoading ? '正在生成语音' : (state.speechPaused ? '继续朗读' : '暂停朗读'))
      : '朗读这条回复'
    btn.setAttribute('aria-pressed', active ? 'true' : 'false')
  })
}

function stopSpeech() {
  state.speechRun = (state.speechRun || 0) + 1
  try { state.speechAbort?.abort?.() } catch {}
  state.speechAbort = null
  try {
    if (state.speechAudio) {
      state.speechAudio.pause()
      state.speechAudio.src = ''
      state.speechAudio.load?.()
    }
  } catch {}
  state.speechAudio = null
  try {
    if (window.speechSynthesis) window.speechSynthesis.cancel()
  } catch {}
  state.speakingIndex = null
  state.speechPaused = false
  state.speechLoading = false
  state.speechEngine = ''
  syncSpeechButtons()
}

function endSpeech(idx, run) {
  if (state.speechRun !== run || state.speakingIndex !== idx) return
  state.speakingIndex = null
  state.speechPaused = false
  state.speechLoading = false
  state.speechEngine = ''
  state.speechAudio = null
  syncSpeechButtons()
}

function speakWithBrowser(text, idx, run) {
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
    endSpeech(idx, run)
    return toast('本地语音不可用，当前浏览器也不支持朗读', true)
  }
  try {
    window.speechSynthesis.cancel()
    try {
      if (state.speechAudio) {
        state.speechAudio.pause()
        state.speechAudio.src = ''
      }
    } catch {}
    state.speechAudio = null
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-CN'
    utterance.rate = 1.02
    const zhVoice = window.speechSynthesis.getVoices().find((v) => /^zh(-|_)/i.test(v.lang))
    if (zhVoice) utterance.voice = zhVoice
    utterance.onend = () => endSpeech(idx, run)
    utterance.onerror = () => endSpeech(idx, run)
    state.speechEngine = 'browser'
    state.speechLoading = false
    state.speakingIndex = idx
    state.speechPaused = false
    window.speechSynthesis.speak(utterance)
    syncSpeechButtons()
    toast('本地模型暂不可用，已回退浏览器朗读')
  } catch (error) {
    endSpeech(idx, run)
    toast(error?.message || '语音朗读启动失败', true)
  }
}

async function speakMessage(index) {
  const idx = Number(index)
  const m = state.conversation?.messages?.[idx]
  const text = String(m?.text || '').trim()
  if (!text) return
  const plain = text.replace(/[`*#|>]/g, '')

  if (state.speakingIndex === idx) {
    if (state.speechLoading) {
      stopSpeech()
      return toast('已取消语音生成')
    }
    if (state.speechEngine === 'audio' && state.speechAudio) {
      try {
        if (state.speechPaused) {
          await state.speechAudio.play()
          state.speechPaused = false
          syncSpeechButtons()
          return toast('继续朗读')
        }
        state.speechAudio.pause()
        state.speechPaused = true
        syncSpeechButtons()
        return toast('已暂停朗读')
      } catch {
        state.speechPaused = true
        syncSpeechButtons()
        return toast('继续播放失败，请再点一次', true)
      }
    }
    if (state.speechEngine === 'browser') {
      if (state.speechPaused) {
        window.speechSynthesis.resume()
        state.speechPaused = false
        syncSpeechButtons()
        return toast('继续朗读')
      }
      window.speechSynthesis.pause()
      state.speechPaused = true
      syncSpeechButtons()
      return toast('已暂停朗读')
    }
  }

  stopSpeech()
  const run = state.speechRun
  state.speakingIndex = idx
  state.speechPaused = false
  state.speechLoading = true
  state.speechEngine = 'audio'
  syncSpeechButtons()
  toast('正在用本地开源语音模型生成朗读')
  const controller = new AbortController()
  state.speechAbort = controller
  try {
    const res = await api('/api/tts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: plain }),
      signal: controller.signal,
    })
    if (state.speechRun !== run || state.speakingIndex !== idx) return
    state.speechAbort = null
    if (!res.ok || !res.body?.url) throw new Error(res.body?.error || `语音合成失败（${res.status}）`)
    const audio = new Audio(res.body.url)
    audio.preload = 'auto'
    audio.onended = () => endSpeech(idx, run)
    audio.onerror = () => {
      if (state.speechRun !== run || state.speakingIndex !== idx) return
      endSpeech(idx, run)
      toast('本地语音播放失败', true)
    }
    state.speechAudio = audio
    state.speechLoading = false
    state.speechPaused = false
    syncSpeechButtons()
    await audio.play()
    if (state.speechRun !== run) return
    toast('正在朗读，再次点击可暂停')
  } catch (error) {
    if (error?.name === 'AbortError' || state.speechRun !== run) return
    state.speechAbort = null
    if (state.speakingIndex !== idx) return
    speakWithBrowser(plain, idx, run)
  }
}

function openMessageAsDoc(index) {
  const m = state.conversation?.messages?.[Number(index)]
  if (!m?.text) return
  const mask = openModal('转为文档编辑', `
    <div class="form-note">把这条回复放入可编辑文档；当前版本先提供轻量编辑与复制，不改动原会话。</div>
    <div id="msgDocText" class="form-area md-body" contenteditable="true" spellcheck="false" style="min-height:320px;max-height:52vh;overflow:auto;white-space:normal">${markdownHTML(m.text)}</div>
    <div class="form-foot"><span class="spacer"></span><button class="btn" data-doc-copy>复制文档</button><button class="btn primary" data-mclose>关闭</button></div>`)
  mask.querySelector('[data-doc-copy]').addEventListener('click', async (ev) => {
    ev.currentTarget.disabled = true
    const ok = await copyToClipboard(mask.querySelector('#msgDocText')?.innerText || '')
    ev.currentTarget.disabled = false
    toast(ok ? '文档已复制' : '复制失败，请手动选择文本', !ok)
  })
  mask.querySelectorAll('[data-mclose]').forEach((b) => b.addEventListener('click', () => mask.remove()))
}

function followUpMessage() {
  state.draft = '追问：'
  renderView()
  setTimeout(() => {
    const input = document.getElementById('draft')
    input?.focus()
    if (input) input.selectionStart = input.selectionEnd = input.value.length
  }, 0)
}

function editUserMessage(index) {
  const m = state.conversation?.messages?.[Number(index)]
  if (!m || m.role !== 'user') return
  state.draft = String(m.text || '')
  renderView()
  setTimeout(() => {
    const input = document.getElementById('draft')
    input?.focus()
    if (input) input.selectionStart = input.selectionEnd = input.value.length
  }, 0)
  toast('已放入输入框，可修改后重新发送')
}

function deleteUserMessage(index) {
  const conv = state.conversation
  const m = conv?.messages?.[Number(index)]
  if (!conv || !m || m.role !== 'user') return
  const mask = openModal('删除这条消息', `
    <div class="form-note">将删除这条用户消息；后续回复仍会保留。此操作不可撤销。</div>
    <div class="form-foot"><span class="spacer"></span><button class="btn" data-mclose>取消</button><button class="btn danger" id="delUserMsg">删除</button></div>`)
  mask.querySelectorAll('[data-mclose]').forEach((b) => b.addEventListener('click', () => mask.remove()))
  const delBtn = mask.querySelector('#delUserMsg')
  delBtn.addEventListener('click', async () => {
    if (delBtn.disabled) return
    delBtn.disabled = true
    const { ok, body } = await api('/api/conversation/message/delete', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ conversationId: conv.id, index: Number(index) }),
    })
    if (!ok) { delBtn.disabled = false; return toast(body.error || '删除失败', true) }
    conv.messages.splice(Number(index), 1)
    mask.remove()
    renderView()
    toast('已删除这条消息')
  })
}

function openMessageMoreMenu(anchor, index) {
  closeRowMenu()
  const conv = state.conversation
  const m = conv?.messages?.[Number(index)]
  if (!conv || !m) return
  const isUser = m.role === 'user'
  const menu = document.createElement('div')
  menu.className = 'msg-more-menu'
  menu.innerHTML = isUser ? `
    <button type="button" class="msg-more-item" data-mm="edit"><span class="ico">${icon('pen')}</span><span>编辑并重新发送</span></button>
    <button type="button" class="msg-more-item" data-mm="copy"><span class="ico">${icon('copy')}</span><span>复制</span></button>
    <button type="button" class="msg-more-item" data-mm="share"><span class="ico">${icon('share')}</span><span>分享</span></button>
    <button type="button" class="msg-more-item danger" data-mm="deleteMsg"><span class="ico">${icon('trash')}</span><span>删除这条消息</span></button>` : `
    <button type="button" class="msg-more-item" data-mm="doc"><span class="ico">${icon('pen')}</span><span>转为文档编辑</span></button>
    <button type="button" class="msg-more-item" data-mm="continue"><span class="ico">${icon('layers')}</span><span>在新对话中继续</span></button>
    <button type="button" class="msg-more-item" data-mm="followup"><span class="ico">${icon('quote')}</span><span>追问</span></button>
    <button type="button" class="msg-more-item" data-mm="report"><span class="ico">${icon('alert')}</span><span>反馈与举报</span></button>
    <button type="button" class="msg-more-item danger" data-mm="delete"><span class="ico">${icon('trash')}</span><span>删除</span></button>`
  document.body.appendChild(menu)
  const r = anchor.getBoundingClientRect()
  const w = menu.offsetWidth || 220
  const h = menu.offsetHeight || 250
  menu.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w))}px`
  const below = r.bottom + 4
  const above = r.top - h - 4
  menu.style.top = `${Math.max(8, below + h <= window.innerHeight - 8 ? below : above)}px`
  menu.querySelectorAll('[data-mm]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation()
    const act = b.dataset.mm
    menu.remove()
    if (isUser) {
      if (act === 'edit') return editUserMessage(index)
      if (act === 'copy') return copyMessage(index)
      if (act === 'share') return shareMessage(index)
      if (act === 'deleteMsg') return deleteUserMessage(index)
      return
    }
    if (act === 'doc') return openMessageAsDoc(index)
    if (act === 'continue') return runConversationAction('fork', conv.id)
    if (act === 'followup') return followUpMessage()
    if (act === 'report') return openFeedbackModal()
    if (act === 'delete') return runConversationAction('delete', conv.id)
  }))
  setTimeout(() => {
    document.addEventListener('pointerdown', function onDown(e) {
      if (!menu.contains(e.target)) {
        menu.remove()
        document.removeEventListener('pointerdown', onDown, true)
      }
    }, true)
    window.addEventListener('resize', closeRowMenu, { once: true })
    window.addEventListener('scroll', closeRowMenu, { once: true, capture: true })
  }, 0)
}

function thinkingCardHTML() {
  const label = state.deepThink ? '深度思索中' : '正在思考'
  const activity = state.chatTask?.progressText || label
  const detail = state.chatTask?.activityDetail || (state.deepThink ? '正在调用推理模型，完成思考后给出回答' : '正在读取项目上下文与工具状态')
  return `<div class="thinking-card" id="thinkingCard" role="status" aria-live="polite">
    <div class="thinking-main"><span class="thinking-spinner" aria-hidden="true"></span><span id="thinkingText">${esc(activity)}</span><span class="thinking-dots" aria-hidden="true"><i></i><i></i><i></i></span></div>
    <div class="thinking-sub">已用时 <span id="thinkingElapsed">0.0</span> 秒 · <span id="thinkingActivity">${esc(detail)}</span></div>
  </div>`
}

function stepsCardHTML() {
  if (!state.chatBusy) return ''
  if (!state.chatSteps.length) return ''
  return `<div class="steps-card"><div class="steps-title">正在执行</div>${state.chatSteps.map(stepRow).join('')}</div>`
}

function startThinkingClock() {
  if (state.chatTicker) clearInterval(state.chatTicker)
  state.chatStartedAt = Date.now()
  state.chatTicker = setInterval(() => {
    const elapsed = Math.max(0, (Date.now() - state.chatStartedAt) / 1000)
    const elapsedEl = document.getElementById('thinkingElapsed')
    if (elapsedEl) elapsedEl.textContent = elapsed.toFixed(1)
    const textEl = document.getElementById('thinkingText')
    if (textEl) {
      const next = state.chatTask?.progressText || (state.deepThink
        ? (elapsed > 25 ? '正在深度推理' : '深度思索中')
        : (elapsed > 25 ? '正在分析请求与工具结果' : elapsed > 10 ? '正在读取上下文' : '正在思考'))
      if (textEl.textContent !== next) textEl.textContent = next
    }
  }, 500)
}

function updateThinkingActivity(task) {
  if (!task) return
  state.chatTask = task
  const textEl = document.getElementById('thinkingText')
  const activityEl = document.getElementById('thinkingActivity')
  if (textEl && task.progressText && textEl.textContent !== task.progressText) textEl.textContent = task.progressText
  if (activityEl && task.activityDetail && activityEl.textContent !== task.activityDetail) activityEl.textContent = task.activityDetail
}

function stopThinkingClock() {
  if (state.chatTicker) clearInterval(state.chatTicker)
  state.chatTicker = null
  state.chatTask = null
}


function renderInteraction() {
  const p = state.pendingInteraction
  if (!p) return ''
  if (p.kind === 'approval') {
    // 审批入口已收敛到输入框内的「请求批准」胶囊；点击后再弹出菜单让用户选择。
    return ''
  }
  const qs = p.questions || []
  const planReview = qs.length === 1 && qs[0]?.intent?.kind === 'plan-review'
  return `<div class="confirm-card">
    <div class="confirm-title">${planReview ? '计划评审' : '需要你回答问题'}</div>
    ${qs.map((q) => {
      const selected = state.qSel?.[q.id] || []
      const planLabel = (label) => {
        if (!planReview) return label
        if (label === 'Approve') return '批准执行'
        if (label === 'Keep planning') return '继续规划'
        return label
      }
      return `<div class="form-label">${esc(planReview ? '请确认是否按此计划执行' : (q.header || q.question))}</div>
        ${planReview ? '' : (q.header ? `<div class="confirm-text">${esc(q.question)}</div>` : '')}
        ${q.detail ? `<div class="confirm-draft">${esc(q.detail)}</div>` : ''}
        ${(q.options || []).length ? `<div class="quick-row">${q.options.map((o) => `
          <button class="quick" data-qopt="${esc(q.id)}" data-qlabel="${esc(o.label)}" title="${esc(o.description || '')}">${selected.includes(o.label) ? '✓ ' : ''}${esc(planLabel(o.label))}</button>`).join('')}</div>` : ''}
        <input class="text-input" id="qCustom-${esc(q.id)}" placeholder="其他回答（可选）" value="${esc(state.qCustom?.[q.id] || '')}">
      `}).join('')}
    <div class="confirm-foot">
      <button class="btn sm" id="qCancel">取消</button>
      <button class="btn sm primary" id="qSubmit">确认回答</button>
    </div>
  </div>`
}

function renderConfirm() {
  return `<div class="confirm-card">
    <div class="confirm-title">写操作需要确认</div>
    <div class="confirm-text">${esc(state.pendingConfirm.text)}</div>
    ${state.pendingConfirm.draft ? `<div class="confirm-draft">${esc(state.pendingConfirm.draft)}</div>` : ''}
    <div class="confirm-foot">
      <button class="btn sm" id="confirmCancel">取消</button>
      <button class="btn sm primary" id="confirmGo">确认执行</button>
    </div>
  </div>`
}


async function sendFeedback(index, value) {
  if (!state.conversation) return
  const { ok, body } = await api('/api/conversation/feedback', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ conversationId: state.conversation.id, index, value }),
  })
  if (!ok) return toast(body.error || '反馈保存失败', true)
  const message = state.conversation.messages[index]
  if (message) message.feedback = body.feedback || null
  renderChatMsgs()
  toast(value === 'clear' ? '已撤销反馈' : (value === 'up' ? '已标记为有帮助' : '已记录改进意见'))
}

async function openRunStats(conversationId, traceId) {
  const { ok, body } = await api(`/api/conversation/trace?id=${encodeURIComponent(conversationId)}&trace=${encodeURIComponent(traceId)}`)
  if (!ok || !body.trace) return toast(body?.error || '本轮统计不存在', true)
  const t = body.trace
  const s = t.stats || {}
  const fmt = (n) => Number(n || 0).toLocaleString('zh-CN')
  const rows = [
    ['模型调用', `${fmt(s.modelCalls)} 次`],
    ['输入 tokens', fmt(s.inputTokens)],
    ['输出 tokens', fmt(s.outputTokens)],
    ['缓存读 tokens', fmt(s.cacheReadTokens)],
    ['缓存写 tokens', fmt(s.cacheWriteTokens)],
    ['推理 tokens', fmt(s.reasoningTokens)],
    ['缓存命中率', `${Number((s.cacheHitRate || 0) * 100).toFixed(1)}%`],
    ['上下文', `${fmt(s.contextChars)} 字符 ≈ ${fmt(s.contextEstimateTokens)} tokens`],
    ['工具调用 / 失败', `${fmt(s.toolCalls)} / ${fmt(s.toolFailures)}`],
    ['步骤 / 事件', `${fmt(s.steps)} / ${fmt(s.eventCount)}`],
    ['本轮耗时', `${fmt(s.durationMs)} ms`],
  ]
  openModal('本轮统计', `
    <div class="mc-block" style="margin:0">
      <div class="mc-block-head"><b>${esc(t.model || '—')}</b><span class="mono">${esc(t.traceId || traceId)}</span></div>
      <div class="form-note">统计来自本轮 DSH 返回的真实 usage 与事件流；缓存命中率 = 缓存读 /（输入 + 缓存读 + 缓存写）。</div>
      <table class="mc-table"><thead class="mc-thead"><tr><th>指标</th><th>值</th></tr></thead><tbody>
        ${rows.map(([k, v]) => `<tr class="mc-trow"><td>${esc(k)}</td><td class="mono">${esc(v)}</td></tr>`).join('')}
      </tbody></table>
    </div>`)
}

function openAdminTerminal() {
  const mask = openModal('平台开发终端', `
    <div class="mc-block" style="margin:0">
      <div class="mc-block-head"><b>持久 PowerShell</b><span class="mc-id" id="termMeta">初始化…</span><span class="spacer"></span><button class="btn sm" id="termReset">重启终端</button></div>
      <div class="form-note">命令在服务端常驻 PowerShell 中执行，工作目录会在同一管理员会话内保持；仅管理员可用。</div>
      <pre id="termOut" class="mono" style="min-height:220px;max-height:46vh;overflow:auto;white-space:pre-wrap;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:10px;margin:8px 0">正在连接终端…</pre>
      <div style="display:flex;gap:8px;align-items:center">
        <span class="mono">$</span>
        <input class="text-input" id="termCmd" placeholder="输入 PowerShell 命令，回车执行" autocomplete="off" style="flex:1" />
        <button class="btn primary" id="termRun">执行</button>
      </div>
    </div>`)
  const out = mask.querySelector('#termOut')
  const input = mask.querySelector('#termCmd')
  const meta = mask.querySelector('#termMeta')
  let busy = false
  const append = (text) => {
    out.textContent += `${out.textContent ? '\n' : ''}${text}`
    out.scrollTop = out.scrollHeight
  }
  api('/api/terminal').then(({ ok, body }) => {
    meta.textContent = ok ? `${body.cwd || ''} · PID ${body.pid || '—'}${body.memoryMB ? ` · 限额 ${body.memoryMB}MB/${body.maxProcesses || '—'}进程` : ''}` : (body.error || '终端不可用')
    if (!ok) out.textContent = body.error || '终端不可用'
  })
  const run = async () => {
    const command = input.value.trim()
    if (!command || busy) return
    busy = true
    input.value = ''
    if (out.textContent === '正在连接终端…') out.textContent = ''
    append(`$ ${command}`)
    const { ok, body } = await api('/api/terminal/exec', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ command }),
    })
    busy = false
    append(body.output || '')
    if (body.cwd) meta.textContent = `${body.cwd} · ${body.timeout ? '已超时重启' : `exit ${body.exitCode ?? '—'}`}`
    if (!ok) append(`[${body.error || '执行失败'}]`)
  }
  mask.querySelector('#termRun').addEventListener('click', run)
  input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); run() } })
  mask.querySelector('#termReset').addEventListener('click', async () => {
    await api('/api/terminal/reset', { method: 'POST' })
    out.textContent = '终端已重启'
    meta.textContent = ''
  })
  setTimeout(() => input.focus(), 50)
}

document.addEventListener('click', async (ev) => {
  const webLink = ev.target?.closest?.('[data-weblink]')
  if (webLink) {
    ev.preventDefault()
    return openCloudWebTab(webLink.dataset.weblink, webLink.textContent)
  }
  const traceBtn = ev.target?.closest?.('[data-trace]')
  if (traceBtn) {
    ev.preventDefault()
    if (!state.conversation?.id) return
    return openRunTrace(state.conversation.id, traceBtn.dataset.trace)
  }
  const statsBtn = ev.target?.closest?.('[data-tstats]')
  if (statsBtn) {
    ev.preventDefault()
    if (!state.conversation?.id) return
    return openRunStats(state.conversation.id, statsBtn.dataset.tstats)
  }
  const copyMsgBtn = ev.target?.closest?.('[data-copymsg]')
  if (copyMsgBtn) {
    ev.preventDefault()
    return copyMessage(copyMsgBtn.dataset.copymsg)
  }
  const editMsgBtn = ev.target?.closest?.('[data-editmsg]')
  if (editMsgBtn) {
    ev.preventDefault()
    return editUserMessage(editMsgBtn.dataset.editmsg)
  }
  const speakBtn = ev.target?.closest?.('[data-speak]')
  if (speakBtn) {
    ev.preventDefault()
    return speakMessage(speakBtn.dataset.speak)
  }
  const moreMsgBtn = ev.target?.closest?.('[data-moremsg]')
  if (moreMsgBtn) {
    ev.preventDefault()
    return openMessageMoreMenu(moreMsgBtn, moreMsgBtn.dataset.moremsg)
  }
  const refreshMsgBtn = ev.target?.closest?.('[data-refreshmsg]')
  if (refreshMsgBtn) {
    ev.preventDefault()
    return refreshMessage(refreshMsgBtn.dataset.refreshmsg)
  }
  const shareMsgBtn = ev.target?.closest?.('[data-sharemsg]')
  if (shareMsgBtn) {
    ev.preventDefault()
    return shareMessage(shareMsgBtn.dataset.sharemsg)
  }
  const copyCodeBtn = ev.target?.closest?.('[data-copy-code]')
  if (copyCodeBtn) {
    ev.preventDefault()
    const code = copyCodeBtn.closest('.md-code')?.querySelector('pre code')?.textContent || ''
    const ok = await copyToClipboard(code)
    return toast(ok ? '代码已复制' : '复制失败，请手动选择代码', !ok)
  }
  if (ev.target?.closest?.('[data-copy-thread]')) {
    ev.preventDefault()
    return copyConversation()
  }
  if (ev.target?.closest?.('[data-share-thread]')) {
    ev.preventDefault()
    return shareConversation()
  }
  const btn = ev.target?.closest?.('[data-fb]')
  if (!btn) return
  ev.preventDefault()
  sendFeedback(Number(btn.dataset.fb), btn.dataset.fbv)
})

async function refreshMessage(index) {
  if (state.chatBusy) return toast('当前正在生成，请先等待或停止', true)
  const conv = state.conversation
  const m = conv?.messages?.[Number(index)]
  if (!conv || !m || m.role !== 'assistant') return
  const userMessage = [...conv.messages.slice(0, Number(index))].reverse().find((x) => x.role === 'user')
  if (!userMessage?.text) return toast('找不到对应的用户消息，无法重新生成', true)
  toast('正在重新生成这条回复')
  await sendMessage(userMessage.text, { regenerate: true, messageIndex: Number(index) })
}

function renderChatMsgs() {
  const box = document.getElementById('chatMsgs')
  if (!box || !state.conversation) return
  const hasStreaming = state.conversation.messages.some((m) => m.streaming)
  box.innerHTML = jobsPanel(state.conversation.messages) + state.conversation.messages.map((m, i) => renderMsg(m, i)).join('') +
    (state.chatBusy && !hasStreaming ? thinkingCardHTML() : '') + stepsCardHTML()
}


async function sendFromChat() {
  if (state.chatBusy) return
  if (state.pastingImages) return toast('图片还在上传，请稍候再发送', true)
  const text = composerPrompt('')
  if (!text) return toast('请输入内容，或粘贴图片附件', true)
  if (state.activeProjectId) {
    const p = currentProject()
    if (!p || p.status !== 'online') return toast('项目本地文件夹不可用，请重新连接或解除项目后再执行', true)
  }
  state.draft = ''
  await sendMessage(text)
}


async function confirmWrite() {
  const { body } = await api('/api/chat/confirm', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ conversationId: state.conversation?.id }),
  })
  state.pendingConfirm = null
  if (state.conversation && body.message) state.conversation.messages.push(body.message)
  toast('写操作已确认执行，结果已登记到定时任务执行记录')
  renderView()
}


function stepRow(s) {
  const cls = s.status === 'warn' ? 'warn' : s.status === 'fail' ? 'bad' : 'ok'
  const label = s.status === 'warn' ? '降级完成' : s.status === 'fail' ? '失败' : '完成'
  return `<div class="step">
    <span class="step-dot ${cls}"></span>
    <span class="step-tool">${esc(s.tool)}</span>
    <span class="step-detail">${esc(s.detail)}</span>
    <span class="step-ms">${(s.ms / 1000).toFixed(1)}s · ${label}</span>
  </div>`
}


/* ----------------------------- history ----------------------------- */

async function renderHistory(el) {
  const { body } = await api('/api/conversations')
  const items = body.items || []
  const workspaces = [...new Set(items.map((c) => c.workspace))]
  el.innerHTML = `
    <div class="view-head">
      <div><div class="view-title">历史会话</div></div>
      <div class="spacer"></div><button class="btn" id="histNew">新建会话</button>
    </div>
    <div class="hist-layout">
      <div>
        ${workspaces.map((w) => `
          <div class="hist-group">
            <div class="hist-group-title">${esc(w)}<span class="mono">${items.filter((c) => c.workspace === w).length}</span></div>
            ${items.filter((c) => c.workspace === w).map((c) => `
              <button class="hist-row" data-conv="${c.id}">
                <span class="hist-icon">${icon('chat')}</span>
                <span class="hist-main"><b>${esc(c.title)}</b><span>${esc(c.model)} · ${c.turns} 轮</span></span>
                <span class="hist-time">${esc(c.time)}</span>
                <span class="tag ${c.status === 'done' ? 'ok' : 'warn'}">${c.status === 'done' ? '已完成' : '进行中'}</span>
              </button>`).join('')}
          </div>`).join('')}
      </div>
      <div class="side-card">
        <div class="side-card-head">工作区</div>
        <div class="side-card-body" style="font-size:11.5px;color:var(--text-2);line-height:1.8">
          默认工作区按单位建立，文件读写受数据中心授权约束。<br/><br/>
          会话保留 180 天，到期归档；涉密内容导出需审批并留痕。
        </div>
      </div>
    </div>`

  el.querySelector('#histNew').addEventListener('click', () => { state.conversation = null; state.view = 'chat'; render() })
  el.querySelectorAll('[data-conv]').forEach((b) => b.addEventListener('click', async () => {
    const { body: one } = await api(`/api/conversation?id=${b.dataset.conv}`)
    if (!one.item) return
    state.conversation = one.item
    if (one.item.reasoningEffort) state.reasoningEffort = one.item.reasoningEffort
    state.deepThink = Boolean(one.item.deepThink)
    state.chatSteps = []
    state.chatError = ''
    state.pendingConfirm = null
    state.view = 'chat'
    render()
  }))
}


function openTaskRuns(a) {
  const runs = (state.tasks || [])
  const mask = openModal(`执行记录 · ${a ? a.name : '全部任务'}`, `
    <div class="tk-runs">
      ${runs.map((x) => {
        const [cls, label] = TASK_STATE_MAP[x.state] || ['', x.state]
        const resumable = x.kind === 'chat-run' && x.conversationId && ['interrupted', 'failed'].includes(x.state)
        return `<div class="tk-run"${resumable ? ` data-resume="${esc(x.id)}" style="cursor:pointer"` : ''}>
          <span class="tk-run-name"><b>${esc(x.title)}</b><span>${esc(x.target)} · 启动 ${esc(x.started || '—')}${x.reason ? ` · ${esc(x.reason)}` : ''}${resumable ? ' · 点击回到原会话继续' : ''}</span></span>
          <span class="tk-run-prog"><span class="prog"><span style="width:${x.progress || 0}%"></span></span><span class="mono">${x.progress || 0}%</span></span>
          <span class="tag ${cls}">${label}</span>
        </div>`
      }).join('') || '<div class="tk-doc-empty">暂无执行记录</div>'}
    </div>
    <div class="form-foot"><span class="mono">每次执行都是一次真实的 AI 运行，失败保留原因</span></div>`)
  mask.querySelectorAll('[data-resume]').forEach((row) => row.addEventListener('click', async () => {
    const task = (state.tasks || []).find((x) => x.id === row.dataset.resume)
    if (!task?.conversationId) return
    const mask2 = openModal('恢复执行', `
      <div class="form-note">
        任务：${esc(task.title)}<br>
        中断阶段：${esc(task.checkpoint?.phase || task.state)} · 原会话 ${esc(task.conversationId)}<br><br>
        恢复会沿用原会话与 DSH session，只继续未完成部分；但中断前已发出的工具动作可能已经产生副作用，系统不会自动重放，需要你确认后重新执行。
      </div>
      <div class="form-foot"><span class="mono">确认后将回到原会话并发送恢复指令</span><span class="spacer"></span>
        <button class="btn" data-resume-cancel>取消</button>
        <button class="btn primary" data-resume-run>继续执行</button>
      </div>`)
    mask2.querySelector('[data-resume-cancel]').addEventListener('click', () => mask2.remove())
    const run = mask2.querySelector('[data-resume-run]')
    run.addEventListener('click', async () => {
      if (run.disabled) return
      run.disabled = true
      const text = `【恢复执行】原任务：${task.prompt || task.title}\n请先检查当前工作区与已有产出，只继续未完成的部分；不要重复已完成的写入、命令或外部操作。`
      mask2.remove()
      mask.remove()
      await openConversation(task.conversationId)
      state.draft = text
      renderView()
      await sendMessage(text)
    })
  }))
}

function openTaskFiles(a) {
  openModal(`任务文件 · ${a.name}`, `
    <div class="tk-doc-empty">任务文件入口尚未接入；当前没有可展示的真实任务产出文件。</div>
    <div class="form-foot"><span class="mono">接入后将按任务归档产出与来源文件</span></div>`)
}

const TASK_STATE_MAP = {
  running: ['warn', '执行中'],
  queued: ['', '排队中'],
  done: ['ok', '已完成'],
  failed: ['bad', '失败'],
  interrupted: ['warn', '已中断'],
  cancelled: ['warn', '已取消'],
}
const taskStateMap = TASK_STATE_MAP

async function loadTasks() {
  const { body } = await api('/api/tasks')
  state.tasks = body.items || []
  return state.tasks
}


async function renderTaskCenter(el) {
  const [{ body: autoBody }, tasks] = await Promise.all([api('/api/automations'), loadTasks()])
  state.automations = autoBody.items || []
  if (!state.taskSel && !state.taskInitialized) {
    state.taskSel = state.automations[0]?.id || ''
    state.taskInitialized = true
  }
  const selId = state.taskSel || ''
  const sel = state.automations.find((a) => a.id === selId)
  const runs = state.tasks.slice(0, 5)

  const emptyPane = `
    <div class="tk-empty">
      <div class="tk-empty-ico">${icon('alarm')}</div>
      <div class="tk-empty-title">新建定时任务</div>
      <div class="tk-empty-sub"></div>
      <div class="tk-ideas">
        ${TASK_IDEAS.map((t) => `
          <button class="tk-idea" data-idea="${esc(t.name)}">
            <span class="tk-idea-ico">${icon('spark')}</span>
            <span class="tk-idea-body"><b>${esc(t.name)}</b><span>${esc(t.desc)}</span></span>
          </button>`).join('')}
      </div>
    </div>`

  const rp = sel?.report || null
  const detailPane = sel ? `
    <div class="tk-doc">
      <div class="tk-doc-bar">
        <div class="tk-doc-name">${esc(sel.name)}</div>
        <span class="spacer"></span>
        <button class="tk-ico-btn" data-tkact="more" title="更多">${icon('dots')}</button>
        <button class="tk-ico-btn" data-tkact="share" title="分享尚未接入" disabled style="opacity:.45;cursor:not-allowed">${icon('send')}</button>
      </div>
      <div class="tk-doc-scroll">
        <div class="tk-doc-inner">
          ${rp ? `
            <h1 class="tk-doc-h1">${esc(rp.title)} <span class="tk-doc-sep">|</span> ${esc(rp.date)}</h1>
            <div class="tk-doc-meta">统计时间：${esc(rp.period)}　·　${esc(sel.schedule)}　·　下次 ${esc(sel.next)}</div>
            <div class="tk-doc-lead">${esc(rp.lead)}</div>
            ${rp.items.map((it) => `<div class="tk-doc-sec">
              <div class="tk-doc-h2">${esc(it.h)}</div>
              <p>${esc(it.p)}</p>
              <span class="tk-src">${icon('doc')}<em>${esc(it.src)}</em></span>
            </div>`).join('')}
            <div class="tk-doc-note">${esc(rp.note)}</div>
          ` : sel.lastResult ? `
            <h1 class="tk-doc-h1">${esc(sel.name)}</h1>
            <div class="tk-doc-meta">${esc(sel.schedule)}　·　${sel.status === 'active' ? '已开启' : '已暂停'}　·　下次 ${esc(sel.next || '—')}</div>
            <div class="tk-doc-lead">最近一次执行结果</div>
            <p style="white-space:pre-wrap">${esc(sel.lastResult)}</p>
          ` : `
            <h1 class="tk-doc-h1">${esc(sel.name)}</h1>
            <div class="tk-doc-meta">${esc(sel.schedule)}　·　${sel.status === 'active' ? '已开启' : '已暂停'}</div>
            <div class="tk-doc-empty">这个定时任务还没有产出：${sel.status === 'active' ? '首次执行完成后，结果会直接呈现在这里。' : `已暂停，最近执行：${esc(sel.last)}`}</div>
          `}
          <div class="tk-doc-foot">
            <div class="tk-foot-k">指令</div>
            <div class="tk-foot-v">${esc(sel.prompt || '（未填写指令）')}</div>
            <div class="tk-foot-k">投递</div>
            <div class="tk-foot-v">${esc(sel.deliver || '工作台')}　·　模型 ${esc(sel.model || '系统默认模型')}</div>
            <div class="tk-foot-k">权限</div>
            <div class="tk-foot-v">${esc(automationPermissionLabel(sel))}　·　超出预设范围即停止</div>
            <button class="tk-foot-link" data-runs="1">执行记录（最近执行 ${esc(sel.last)}）</button>
          </div>
        </div>
      </div>
      <div class="tk-composer">
        <button class="icon-btn" data-tkact="plus" title="追加要求尚未接入" disabled style="opacity:.45;cursor:not-allowed">${icon('plus')}</button>
        <input id="tkAsk" placeholder="追加要求尚未接入" disabled style="opacity:.55">
        <span class="tk-when">即时</span>
        <button class="tk-send" id="tkAskSend" disabled style="opacity:.45;cursor:not-allowed">${icon('up')}</button>
      </div>
    </div>` : emptyPane

  const pinnedFirst = (a, b) => ((state.taskPins || []).includes(b.id) ? 1 : 0) - ((state.taskPins || []).includes(a.id) ? 1 : 0)
  const autoItem = (a) => `
          <button class="tk-item${a.id === selId ? ' on' : ''}" data-auto="${a.id}">
            <span class="tk-item-main"><b>${esc(a.name)}</b><span>${esc(a.next || '—')} · ${esc(a.schedule)}</span></span>
            ${a.status === 'active' ? '<span class="tk-dot"></span>' : ''}
          </button>`
  const statusOf = (a) => (a.status === 'active' ? 'active' : (a.status === 'done' || a.status === 'completed' ? 'done' : 'paused'))
  let enabledStatus = state.taskStatus || ['active', 'paused', 'done']
  let taskQuery = String(state.taskQuery || '').trim().toLowerCase()
  const filteredTaskAutos = () => state.automations.filter((a) => {
    if (!enabledStatus.includes(statusOf(a))) return false
    if (!taskQuery) return true
    return `${a.name} ${a.prompt || ''} ${a.schedule || ''} ${a.next || ''} ${a.lastResult || ''} ${a.deliver || ''}`
      .toLowerCase().includes(taskQuery)
  })
  const listGroups = () => {
    const filteredAutos = filteredTaskAutos()
    const active = filteredAutos.filter((a) => statusOf(a) === 'active').sort(pinnedFirst)
    const paused = filteredAutos.filter((a) => statusOf(a) === 'paused').sort(pinnedFirst)
    const done = filteredAutos.filter((a) => statusOf(a) === 'done').sort(pinnedFirst)
    return `
      ${active.length ? `<div class="tk-group-label">已开启</div><div class="tk-list">${active.map(autoItem).join('')}</div>` : ''}
      ${paused.length ? `<div class="tk-group-label">已暂停</div><div class="tk-list">${paused.map(autoItem).join('')}</div>` : ''}
      ${done.length ? `<div class="tk-group-label">已完成</div><div class="tk-list">${done.map(autoItem).join('')}</div>` : ''}
      ${filteredAutos.length ? '' : `<div class="tk-filter-empty">${taskQuery ? '没有找到匹配的定时任务' : '当前状态筛选下没有任务'}</div>`}`
  }
  const bindAutoRows = (root) => {
    root.querySelectorAll('[data-auto]').forEach((b) => b.addEventListener('click', () => {
      state.taskSel = b.dataset.auto === state.taskSel ? '' : b.dataset.auto
      if (useSidebar) render()
      else renderView()
    }))
  }
  const taskListHTML = `
    <aside class="tk-left">
      <div class="tk-left-head">
        <span>定时任务</span><span class="spacer"></span>
        <button class="tk-ico-btn${state.taskFilterOpen ? ' on' : ''}" id="tkFilter" title="筛选">${icon('filter')}</button>
        <button class="tk-ico-btn${state.taskSearchOpen || taskQuery ? ' on' : ''}" id="tkTaskSearchBtn" title="搜索定时任务">${icon('search')}</button>
        <div class="tk-filter-pop" id="tkFilterPop"${state.taskFilterOpen ? '' : ' hidden'}>
          <div class="tk-filter-title">状态</div>
          ${[['active', '已开启'], ['paused', '已暂停'], ['done', '已完成']].map(([key, label]) => `
            <button class="tk-filter-row" data-tf="${key}">
              <span>${label}</span>
              <span class="tk-filter-check">${icon('check')}</span>
            </button>`).join('')}
        </div>
      </div>
      ${(state.taskSearchOpen || taskQuery) ? `
        <div class="tk-search-row">
          <span class="tk-search-ico">${icon('search')}</span>
          <input id="tkSearchInput" placeholder="搜索定时任务" value="${esc(state.taskQuery || '')}" />
          <button class="tk-search-clear" id="tkSearchClear" title="清除">${icon('close')}</button>
        </div>` : ''}
      <button class="tk-new" id="newAuto">${icon('plus')}<span>新建定时任务</span></button>
      <div class="tk-groups" id="tkGroups">${listGroups()}</div>
    </aside>`

  const useSidebar = hasSidebarView()
  if (useSidebar) {
    const sb = document.getElementById('sidebar')
    sb.classList.remove('hidden', 'tk-sidebar')
    sb.innerHTML = `${taskListHTML}<div class="pane-grip" id="sbGrip" title="拖动调整左右宽度 · 双击复位"></div>`
    bindSidebarResize()
    el.innerHTML = `<div class="tk-main tk-main-page">${detailPane}</div>`
  } else {
    el.innerHTML = `
      <div class="task-center">
        ${taskListHTML}
        <div class="tk-main">${detailPane}</div>
      </div>`
  }

  const listRoot = useSidebar ? document.getElementById('sidebar') : el
  listRoot.querySelector('#newAuto').addEventListener('click', () => openAutomationForm())
  const filterBtn = listRoot.querySelector('#tkFilter')
  const filterPop = listRoot.querySelector('#tkFilterPop')
  filterBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    state.taskFilterOpen = !state.taskFilterOpen
    filterPop.hidden = !state.taskFilterOpen
    filterBtn.classList.toggle('on', state.taskFilterOpen)
  })
  const filterRows = Array.from(listRoot.querySelectorAll('[data-tf]'))
  const refreshChecks = () => {
    filterRows.forEach((row) => { row.classList.toggle('checked', enabledStatus.includes(row.dataset.tf)) })
  }
  refreshChecks()
  filterRows.forEach((row) => row.addEventListener('click', (e) => {
    e.stopPropagation()
    const key = row.dataset.tf
    const next = enabledStatus.includes(key) ? enabledStatus.filter((x) => x !== key) : [...enabledStatus, key]
    enabledStatus = next
    state.taskStatus = next
    refreshChecks()
    const groupsEl = listRoot.querySelector('#tkGroups')
    groupsEl.innerHTML = listGroups()
    bindAutoRows(listRoot)
  }))
  const searchBtn = listRoot.querySelector('#tkTaskSearchBtn')
  searchBtn.addEventListener('click', () => {
    state.taskFilterOpen = false
    if (state.taskSearchOpen || state.taskQuery) {
      state.taskSearchOpen = false
      state.taskQuery = ''
    } else {
      state.taskSearchOpen = true
    }
    render()
  })
  const searchInput = listRoot.querySelector('#tkSearchInput')
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      state.taskQuery = searchInput.value
      taskQuery = String(state.taskQuery || '').trim().toLowerCase()
      const groupsEl = listRoot.querySelector('#tkGroups')
      groupsEl.innerHTML = listGroups()
      bindAutoRows(listRoot)
    })
    listRoot.querySelector('#tkSearchClear').addEventListener('click', () => {
      state.taskQuery = ''
      taskQuery = ''
      searchInput.value = ''
      const groupsEl = listRoot.querySelector('#tkGroups')
      groupsEl.innerHTML = listGroups()
      bindAutoRows(listRoot)
      searchInput.focus()
    })
  }
  bindAutoRows(listRoot)
  el.querySelectorAll('[data-idea]').forEach((b) => b.addEventListener('click', () => {
    const idea = TASK_IDEAS.find((t) => t.name === b.dataset.idea)
    openAutomationForm(idea)
  }))
  el.querySelectorAll('[data-tkact]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation()
    const act = b.dataset.tkact
    const sel = state.automations.find((x) => x.id === state.taskSel)
    if (!sel) return
    if (act === 'share') return
    if (act === 'split') return
    if (act === 'panel') return
    if (act === 'plus') return
    if (act === 'more') {
      document.querySelectorAll('.tk-more-pop').forEach((p) => p.remove())
      const pinned = (state.taskPins || []).includes(sel.id)
      const projectNames = (state.projects || []).slice(0, 6).map((p) => p.name)
      const moveTargets = projectNames.length ? projectNames : ['滨江片区更新', '城市体检', '国土空间规划', '项目复盘']
      const pop = document.createElement('div')
      pop.className = 'conv-menu tk-more-pop tk-action-menu'
      pop.innerHTML = `
        <button class="cm-item tk-menu-item" data-tk="pin">
          <span class="tk-menu-ico">${icon(pinned ? 'pinOff' : 'pin')}</span>
          <span class="tk-menu-label">${pinned ? '取消置顶' : '置顶'}</span>
          <span class="tk-menu-kbd">Ctrl+Alt+P</span>
        </button>
        <div class="tk-menu-sep"></div>
        <button class="cm-item tk-menu-item" data-tk="files">
          <span class="tk-menu-ico">${icon('doc')}</span>
          <span class="tk-menu-label">查看任务中的文件</span>
        </button>
        <button class="cm-item tk-menu-item" data-tk="openweb" disabled style="opacity:.45;cursor:not-allowed">
          <span class="tk-menu-ico">${icon('external')}</span>
          <span class="tk-menu-label">在网页端打开</span>
        </button>
        <div class="tk-menu-sep"></div>
        <button class="cm-item tk-menu-item" data-tk="move" disabled style="opacity:.45;cursor:not-allowed">
          <span class="tk-menu-ico">${icon('folder')}</span>
          <span class="tk-menu-label">移至项目</span>
          <span class="tk-menu-caret">${icon('chevron')}</span>
        </button>
        <div class="tk-more-sub" hidden>
          ${moveTargets.map((name) => `<button class="cm-item tk-menu-subitem" data-tk-project="${esc(name)}"><span class="tk-menu-label">${esc(name)}</span></button>`).join('')}
        </div>
        <div class="tk-menu-sep"></div>
        <button class="cm-item tk-menu-item" data-tk="pause">
          <span class="tk-menu-ico">${icon(sel.status === 'active' ? 'pause' : 'play')}</span>
          <span class="tk-menu-label">${sel.status === 'active' ? '暂停任务' : '启用任务'}</span>
        </button>
        <button class="cm-item tk-menu-item" data-tk="delete">
          <span class="tk-menu-ico">${icon('trash')}</span>
          <span class="tk-menu-label">删除任务</span>
        </button>`
      document.body.appendChild(pop)
      const r = b.getBoundingClientRect()
      pop.style.left = `${Math.max(8, r.right - pop.offsetWidth)}px`
      const ph = pop.offsetHeight
      pop.style.top = `${Math.max(8, Math.min(window.innerHeight - ph - 8, r.bottom + 6))}px`
      const close = (e) => { if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', close); document.removeEventListener('keydown', onKey) } }
      const onKey = (e) => {
        if (e.ctrlKey && e.altKey && (e.key === 'p' || e.key === 'P')) { e.preventDefault(); pop.querySelector('[data-tk="pin"]').click() }
      }
      setTimeout(() => { document.addEventListener('click', close); document.addEventListener('keydown', onKey) }, 0)
      pop.querySelector('[data-tk="pin"]').addEventListener('click', () => {
        const set = new Set(state.taskPins || [])
        if (set.has(sel.id)) set.delete(sel.id); else set.add(sel.id)
        state.taskPins = [...set]
        pop.remove()
        document.removeEventListener('click', close)
        document.removeEventListener('keydown', onKey)
        toast(set.has(sel.id) ? `已置顶「${sel.name}」` : `已取消置顶「${sel.name}」`)
        renderView()
      })
      pop.querySelector('[data-tk="files"]').addEventListener('click', () => { pop.remove(); openTaskFiles(sel) })
      pop.querySelector('[data-tk="openweb"]').addEventListener('click', () => { pop.remove(); toast(`已在网页端打开「${sel.name}」（演示）`) })
      pop.querySelector('[data-tk="move"]').addEventListener('click', () => {
        const sub = pop.querySelector('.tk-more-sub')
        sub.hidden = !sub.hidden
        pop.classList.toggle('sub-open', !sub.hidden)
      })
      pop.querySelectorAll('[data-tk-project]').forEach((item) => item.addEventListener('click', () => {
        pop.remove()
        toast(`已移至项目「${item.dataset.tkProject}」（演示）`)
      }))
      pop.querySelector('[data-tk="pause"]').addEventListener('click', async () => {
        const { ok, body } = await api('/api/automations/pause', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: sel.id }) })
        if (!ok) return toast(body.error || '切换任务状态失败', true)
        sel.status = body.item?.status || (sel.status === 'active' ? 'paused' : 'active')
        pop.remove()
        document.removeEventListener('click', close)
        document.removeEventListener('keydown', onKey)
        toast(`已${sel.status === 'active' ? '启用' : '暂停'}「${sel.name}」`)
        renderView()
      })
      pop.querySelector('[data-tk="delete"]').addEventListener('click', () => {
        pop.remove()
        document.removeEventListener('click', close)
        document.removeEventListener('keydown', onKey)
        const mask = openModal('删除定时任务', `
          <div class="form-note">删除后该任务不再触发；已产生的执行记录与审计不受影响。</div>
          <div class="form-foot"><span class="spacer"></span><button class="btn" data-mclose>取消</button><button class="btn danger" data-del>删除</button></div>`)
        mask.querySelector('[data-mclose]').addEventListener('click', () => mask.remove())
        const del = mask.querySelector('[data-del]')
        del.addEventListener('click', async () => {
          if (del.disabled) return
          del.disabled = true
          const { ok, body } = await api('/api/automations/delete', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: sel.id }) })
          if (!ok) { del.disabled = false; return toast(body.error || '删除定时任务失败', true) }
          mask.remove()
          state.automations = state.automations.filter((x) => x.id !== sel.id)
          if (state.taskSel === sel.id) state.taskSel = ''
          toast(`已删除「${sel.name}」`)
          renderView()
        })
      })
    }
  }))
  const runsLink = el.querySelector('[data-runs]')
  if (runsLink) runsLink.addEventListener('click', () => openTaskRuns(state.automations.find((x) => x.id === state.taskSel)))
  const askSend = el.querySelector('#tkAskSend')
  if (askSend) {
    askSend.addEventListener('click', () => {})
  }
  el.querySelectorAll('[data-task]').forEach((r) => r.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-retry]') || ev.target.closest('[data-result]')) return
    openTaskDetail(r.dataset.task)
  }))
  el.querySelectorAll('[data-run]').forEach((b) => b.addEventListener('click', async () => {
    const { ok, body: res } = await api('/api/automations/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: b.dataset.run }) })
    if (!ok) return toast(res.error, true)
    if (res.item) {
      const current = state.automations.find((x) => x.id === res.item.id)
      if (current) Object.assign(current, res.item)
    }
    await loadTasks()
    toast(`已触发执行，任务 ${res.task.id} 进入队列`)
    renderView()
  }))
  el.querySelectorAll('[data-pause]').forEach((b) => b.addEventListener('click', async () => {
    const a = state.automations.find((x) => x.id === b.dataset.pause)
    if (!a) return
    const { ok, body } = await api('/api/automations/pause', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: a.id }) })
    if (!ok) return toast(body.error || '切换任务状态失败', true)
    a.status = body.item?.status || (a.status === 'active' ? 'paused' : 'active')
    toast(`已${a.status === 'active' ? '启用' : '暂停'}「${a.name}」`)
    renderView()
  }))
  el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openAutomationForm(state.automations.find((x) => x.id === b.dataset.edit))))
  el.querySelectorAll('[data-retry]').forEach((b) => b.addEventListener('click', async (ev) => {
    ev.stopPropagation()
    await api('/api/tasks/retry', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: b.dataset.retry }) })
    toast('已重新入队，失败原因保留在任务记录中')
    renderView()
  }))
  el.querySelectorAll('[data-result]').forEach((b) => b.addEventListener('click', (ev) => { ev.stopPropagation() }))

  if (state.tasks.some((t) => ['running', 'queued'].includes(t.state))) {
    clearTimeout(renderTaskCenter._t)
    renderTaskCenter._t = setTimeout(() => { if (state.view === 'tasks') renderView() }, 2600)
  }
}


function openWorktreeTask(project, item = null) {
  const where = item ? `使用已有工作树 ${item.path}（分支 ${item.branch || 'detached'}），先执行 working_directory 切换到该目录，再继续任务。` : '先为当前项目创建隔离工作树，再在隔离目录内执行，不要直接改动当前项目目录。'
  state.draft = `请使用 worktree 工具：${where}\n项目：${project.name}（${project.cwd}）。\n任务要求：`
  state.view = 'home'
  state.taskMode = 'work'
  closeModals()
  render()
  const input = document.getElementById('draft')
  if (input) {
    input.focus()
    input.setSelectionRange(input.value.length, input.value.length)
  }
  toast(item ? '已填入工作树任务' : '已填入新建工作树任务')
}

async function openWorktreePanel(project) {
  if (!project?.id) return toast('缺少项目', true)
  if (!project.cwd || project.status !== 'online') return toast('项目本地目录不可用', true)
  const mask = openModal('工作树', `
    <div style="min-width:680px;max-width:80vw">
      <div class="mc-id" id="wtMeta">正在读取 Git 工作树…</div>
      <div style="display:flex;gap:8px;align-items:center;margin:10px 0 12px;flex-wrap:wrap">
        <button class="btn sm" id="wtRefresh">刷新</button>
        <button class="btn sm primary" id="wtNew">让 Agent 新建工作树</button>
        <span class="mc-dim" id="wtNote" style="flex:1;min-width:180px"></span>
      </div>
      <div id="wtList"></div>
    </div>`, { wide: true })
  const meta = mask.querySelector('#wtMeta')
  const note = mask.querySelector('#wtNote')
  const list = mask.querySelector('#wtList')

  const rowHTML = (item) => {
    const shortHead = String(item.head || '').slice(0, 8)
    const dirty = item.dirty ? `<span class="tag" style="color:var(--warn)">${item.dirty} 个未提交</span>` : '<span class="tag">干净</span>'
    const stateTag = item.main ? '<span class="tag">主工作树</span>' : '<span class="tag">隔离工作树</span>'
    return `<div class="mc-block" data-wtpath="${esc(item.path)}" style="padding:10px;margin-bottom:8px">
      <div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap">
        <div style="flex:1;min-width:260px">
          <div class="mono" style="font-size:12px;word-break:break-all">${esc(item.path)}</div>
          <div class="mc-id" style="margin-top:4px">${esc(item.branch || '分离 HEAD')} · ${shortHead} · ${stateTag} ${dirty}${item.statusError ? ` · ${esc(item.statusError)}` : ''}</div>
        </div>
        <div class="wt-actions" style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn sm" data-wt-copy>复制路径</button>
          ${item.main ? '' : `<button class="btn sm" data-wt-use>在此执行</button><button class="btn sm" data-wt-merge>合并</button><button class="btn sm" data-wt-discard>丢弃</button>`}
        </div>
      </div>
    </div>`
  }

  const branchRowHTML = (branch) => `<div class="mc-block" data-wbname="${esc(branch.name)}" style="padding:10px;margin-bottom:8px">
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <div style="flex:1;min-width:220px"><div class="mono" style="font-size:12px">${esc(branch.name)}</div>
      <div class="mc-id" style="margin-top:4px">不再被任何工作树占用</div></div>
      <div class="wt-branch-actions" style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm" data-wb-del>删除分支</button></div>
    </div>
  </div>`

  const confirmBranch = (row, branch) => {
    const actions = row.querySelector('.wt-branch-actions')
    actions.innerHTML = `<span class="mc-dim" style="align-self:center">确认删除分支 ${esc(branch.name)}？</span>
      <button class="btn sm primary" data-wb-go>确认</button><button class="btn sm" data-wb-cancel>取消</button>`
    actions.querySelector('[data-wb-cancel]').addEventListener('click', () => load())
    actions.querySelector('[data-wb-go]').addEventListener('click', async () => {
      actions.innerHTML = '<span class="mc-dim">正在删除分支…</span>'
      const { ok, body } = await api('/api/worktrees/delete-branch', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, branch: branch.name }),
      })
      if (!ok) {
        toast(body?.error || '删除分支失败', true)
        if (body?.output) toast(String(body.output).slice(-400), true)
        await load()
        return
      }
      toast(`已删除分支 ${branch.name}`)
      await load()
    })
  }

  const runAction = async (row, action, item) => {
    const actions = row.querySelector('.wt-actions')
    actions.innerHTML = `<span class="mc-dim">正在${action === 'merge' ? '合并' : '移除'}…</span>`
    const path = `/api/worktrees/${action === 'merge' ? 'merge' : 'discard'}`
    const { ok, body } = await api(path, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: project.id, path: item.path }),
    })
    if (!ok) {
      toast(body?.error || '操作失败', true)
      if (body?.output) toast(String(body.output).slice(-400), true)
      await load()
      return
    }
    toast(action === 'merge' ? `已合并 ${item.branch || item.path}` : '已移除工作树，分支保留')
    await load()
  }

  const confirmRow = (row, action, item) => {
    const actions = row.querySelector('.wt-actions')
    const verb = action === 'merge' ? '合并到主工作树' : '丢弃工作树（未提交改动会丢失，分支保留）'
    actions.innerHTML = `<span class="mc-dim" style="align-self:center">确认${verb}？</span>
      <button class="btn sm primary" data-wt-go>确认</button><button class="btn sm" data-wt-cancel>取消</button>`
    actions.querySelector('[data-wt-go]').addEventListener('click', () => runAction(row, action, item))
    actions.querySelector('[data-wt-cancel]').addEventListener('click', () => load())
  }

  const bindRow = (row, item) => {
    const copy = row.querySelector('[data-wt-copy]')
    if (copy) copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(item.path); toast('工作树路径已复制') } catch { toast(item.path) }
    })
    const use = row.querySelector('[data-wt-use]')
    if (use) use.addEventListener('click', () => openWorktreeTask(project, item))
    const merge = row.querySelector('[data-wt-merge]')
    if (merge) merge.addEventListener('click', () => confirmRow(row, 'merge', item))
    const discard = row.querySelector('[data-wt-discard]')
    if (discard) discard.addEventListener('click', () => confirmRow(row, 'discard', item))
  }

  const load = async () => {
    list.textContent = '正在读取 Git 工作树…'
    const { ok, body } = await api(`/api/worktrees?projectId=${encodeURIComponent(project.id)}`)
    if (!ok) {
      meta.textContent = `${project.name} · ${project.cwd}`
      note.textContent = ''
      list.innerHTML = `<div class="mc-block" style="padding:12px">${esc(body?.error || '读取工作树失败')}</div>`
      return
    }
    meta.textContent = `${project.name} · ${body.cwd || project.cwd}`
    note.textContent = body.note || ''
    if (!body.repo) {
      list.innerHTML = `<div class="mc-block" style="padding:12px"><div class="mc-dim">当前项目不是 Git 仓库，无法读取或创建工作树。</div><div class="mc-dim" style="margin-top:6px">先在项目目录执行 <span class="mono">git init</span>，再回来刷新。</div></div>`
      return
    }
    if (!body.items.length) {
      list.innerHTML = '<div class="mc-block" style="padding:12px"><div class="mc-dim">暂无工作树记录。</div></div>'
      return
    }
    list.innerHTML = body.items.map(rowHTML).join('')
    list.querySelectorAll('[data-wtpath]').forEach((row, index) => bindRow(row, body.items[index]))
    const orphans = (body.branches || []).filter((branch) => branch.orphan)
    if (orphans.length) {
      list.insertAdjacentHTML('beforeend', `<div class="mc-id" style="margin:14px 0 8px"><b>孤立分支</b> · 工作树已移除，分支仍保留</div>${orphans.map(branchRowHTML).join('')}`)
      list.querySelectorAll('[data-wbname]').forEach((row, index) => {
        const branch = orphans[index]
        row.querySelector('[data-wb-del]')?.addEventListener('click', () => confirmBranch(row, branch))
      })
    }
  }

  mask.querySelector('#wtRefresh').addEventListener('click', load)
  mask.querySelector('#wtNew').addEventListener('click', () => openWorktreeTask(project))
  await load()
}

function startAgentEntry(id) {
  const project = currentProject()
  if (id === 'worktree') {
    if (!project || project.status !== 'online') {
      toast('工作树需要先打开一个在线项目', true)
      state.view = 'home'
      render()
      setTimeout(() => openWorkspacePicker(), 30)
      return
    }
    openWorktreePanel(project)
    return
  }
  if (id === 'auto-review') {
    toast('自动审查是 DSH 实验性逐工具调用权限层，本产品尚未接入；它不是独立审查报告', true)
    return
  }
  const label = id === 'agent-team' ? 'Agent 团队' : '自动审查'
  if (!project || project.status !== 'online') {
    toast(`${label}需要先打开一个在线项目`, true)
    state.view = 'home'
    render()
    setTimeout(() => openWorkspacePicker(), 30)
    return
  }
  const prefix = id === 'agent-team'
    ? '请使用 Agent Team（tool-agent-team）能力：先判断任务能否拆成 2-3 个并行子任务，给每个子 Agent 明确边界，再汇总可核对的结论。'
    : ''
  state.draft = `${prefix}${project ? `\n项目：${project.name}（${project.cwd}）。` : ''}\n任务要求：`
  state.view = 'home'
  state.taskMode = 'work'
  render()
  const input = document.getElementById('draft')
  if (input) {
    input.focus()
    input.setSelectionRange(input.value.length, input.value.length)
  }
  toast(`${label}入口已打开，补充任务要求后发送`)
}

/* ---------------------------- admin ---------------------------- */

async function renderCodeReview(el) {
  const res = await api('/api/projects').catch(() => null)
  if (res?.ok) state.projects = res.body.items || []
  const projects = (state.projects || []).filter((p) => !p.removed)
  el.innerHTML = `<div style="max-width:1080px;margin:0 auto;padding:24px">
    <div style="display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap">
      <div>
        <div style="font-size:24px;font-weight:700">代码审查服务</div>
        <div style="color:var(--muted);margin-top:6px">Harness 通用基础服务：任意项目、Chat/Work Agent 与 MCP 工具都可调用同一套只读审查能力。此页是服务控制台，不是 DSH 的 auto-review 权限层，也不生成伪造结论。</div>
      </div>
    </div>
    <div class="mc-block" style="padding:14px;margin-top:18px">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <select id="crProject" style="min-width:260px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:transparent;color:inherit">
          <option value="">选择已绑定本地目录的项目</option>
          ${projects.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}${p.cwd ? '' : '（未绑定目录）'}</option>`).join('')}
        </select>
        <select id="crScope" style="padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:transparent;color:inherit">
          <option value="all">全量源码</option>
          <option value="changed">仅工作区改动</option>
        </select>
        <button class="btn primary" id="crRun">运行审查</button>
        <span id="crStatus" style="color:var(--muted);font-size:12px"></span>
      </div>
      <div class="form-note" style="margin:10px 0 0">检查项：Node 语法检查、JSON 可解析性、硬编码密钥、eval、命令执行、TODO 与调试输出。扫描结果逐条带文件、行号与证据。</div>
    </div>
    <div id="crReport" style="margin-top:14px"><div class="mc-block" style="padding:18px;color:var(--muted)">选择项目并运行审查，报告会显示在这里。</div></div>
  </div>`
  const projectSelect = el.querySelector('#crProject')
  const scopeSelect = el.querySelector('#crScope')
  const status = el.querySelector('#crStatus')
  const out = el.querySelector('#crReport')
  el.querySelector('#crRun').addEventListener('click', async () => {
    const projectId = projectSelect.value
    if (!projectId) return toast('请先选择项目', true)
    const button = el.querySelector('#crRun')
    button.disabled = true
    status.textContent = '正在读取目录并执行检查…'
    out.innerHTML = `<div class="mc-block" style="padding:18px;color:var(--muted)">正在扫描源码，语法检查可能需要几秒…</div>`
    try {
      const res = await api('/api/harness/services/code-review', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectId, scope: scopeSelect.value }),
      })
      if (!res.ok) throw new Error(res.body?.error || res.body?.detail || '审查失败')
      const { project, report } = res.body
      const sev = (s) => ({ high: '#b42318', medium: '#b45309', low: '#64748b' }[s] || '#64748b')
      const tag = (s) => `<span class="tag" style="color:${sev(s)};border-color:${sev(s)}55">${esc({ high: '高', medium: '中', low: '低' }[s] || s)}</span>`
      const rows = report.findings.map((f) => `<div style="padding:10px 0;border-top:1px solid var(--line)">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${tag(f.severity)}<span class="mono" style="font-size:12px">${esc(f.file)}:${Number(f.line || 1)}</span><span class="mono" style="font-size:11px;color:var(--muted)">${esc(f.rule)}</span></div>
        <div style="margin-top:4px">${esc(f.message)}</div>
        ${f.evidence ? `<div class="mono" style="margin-top:4px;font-size:11px;color:var(--muted);white-space:pre-wrap;word-break:break-word">${esc(f.evidence)}</div>` : ''}
      </div>`).join('')
      const md = [`# 代码审查报告 · ${project.name}`, '', `- 项目：${project.name}`, `- 目录：${project.cwd}`, `- 范围：${report.scope === 'changed' ? '工作区改动' : '全量源码'}`, `- 扫描文件：${report.scanned}`, `- 高风险：${report.summary.high} / 中风险：${report.summary.medium} / 低风险：${report.summary.low}`, `- 语法检查：${report.checks.syntax.checked} 个，失败 ${report.checks.syntax.failed} 个`, ''].concat(report.findings.map((f) => `- [${f.severity}] ${f.file}:${f.line} ${f.rule} — ${f.message}`)).join('\n')
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      out.innerHTML = `<div class="mc-block" style="padding:16px">
        <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">
          <div><div style="font-size:18px;font-weight:700">${esc(project.name)}</div><div class="mono" style="font-size:11px;color:var(--muted);margin-top:4px">${esc(project.cwd)}</div></div>
          <span class="tag ok" style="margin-left:auto">已扫描 ${report.scanned} 个文件</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:14px">
          ${[['高风险', report.summary.high, '#b42318'], ['中风险', report.summary.medium, '#b45309'], ['低风险', report.summary.low, '#64748b'], ['语法失败', report.checks.syntax.failed, '#b42318']].map(([label, value, color]) => `<div style="border:1px solid var(--line);border-radius:10px;padding:10px"><div style="font-size:11px;color:var(--muted)">${label}</div><div style="font-size:22px;font-weight:700;color:${color}">${value}</div></div>`).join('')}
        </div>
        <div class="form-note" style="margin-top:12px">${esc(report.note)} ${esc(report.git?.note || '')}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;gap:8px;flex-wrap:wrap">
          <span class="mono" style="font-size:11px;color:var(--muted)">JSON 检查 ${report.checks.json.checked} 个，失败 ${report.checks.json.failed} 个</span>
          <button class="btn sm" id="crExport">导出 Markdown 报告</button>
        </div>
        <div style="margin-top:10px">${rows || `<div style="padding:16px;color:var(--muted)">未命中任何规则，也没有语法错误。这是真实扫描结果，不代表代码没有业务缺陷。</div>`}</div>
      </div>`
      const exportBtn = out.querySelector('#crExport')
      exportBtn.addEventListener('click', () => { const a = document.createElement('a'); a.href = url; a.download = `代码审查-${project.name}.md`; a.click() })
      status.textContent = `完成：${report.scanned} 个文件，${report.summary.total} 条命中`
    } catch (error) {
      out.innerHTML = `<div class="mc-block" style="padding:16px;color:var(--warn)">${esc(error?.message || '审查失败')}</div>`
      status.textContent = '执行失败'
    } finally {
      button.disabled = false
    }
  })
}

function renderAdminSettings(blocks, sec = {}) {
  if (!blocks) return
  const basic = sec.basic || {}
  const writable = Boolean(sec.writable)
  const sel = (value, current) => String(value) === String(current) ? ' selected' : ''
  const settingRow = (label, control, note) => `<div style="padding:11px 12px;border-bottom:1px solid #eef0f3">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <b style="font-size:12px;color:#202124;flex:1 1 120px;min-width:100px">${esc(label)}</b>
      <span style="flex:0 1 210px;min-width:140px">${control}</span>
    </div>
    <div style="font-size:10px;color:#8a8f96;line-height:1.55;margin-top:4px">${esc(note)}</div>
  </div>`
  const infoRows = (items = []) => items.map((x) => `<div style="padding:10px 12px;border-bottom:1px solid #eef0f3">
    <div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap">
      <b style="font-size:12px;color:#202124;min-width:82px;flex:0 0 auto">${esc(x.label)}</b>
      <span style="font-size:11px;color:#30343a;word-break:break-all;flex:1 1 180px;min-width:0">${esc(x.value)}</span>
    </div>
    <div style="font-size:10px;color:#8a8f96;line-height:1.55;margin-top:3px">${esc(x.note || '—')}</div>
  </div>`).join('') || '<div class="mc-row">暂无数据</div>'

  const basicWrap = document.createElement('div')
  basicWrap.className = 'mc-block'
  const policyControl = `<select class="text-input" id="setPolicy" style="width:100%;min-width:0;box-sizing:border-box" ${writable ? '' : 'disabled'}>
      <option value="auto"${sel('auto', basic.defaultPolicy)}>自动化执行</option>
      <option value="manual"${sel('manual', basic.defaultPolicy)}>人工确认</option>
    </select>`
  const effortControl = `<select class="text-input" id="setEffort" style="width:100%;min-width:0;box-sizing:border-box" ${writable ? '' : 'disabled'}>
      <option value="low"${sel('low', basic.defaultEffort)}>低</option>
      <option value="medium"${sel('medium', basic.defaultEffort)}>中</option>
      <option value="high"${sel('high', basic.defaultEffort)}>高</option>
    </select>`
  const workspaceControl = `<select class="text-input" id="setWorkspaceChanges" style="width:100%;min-width:0;box-sizing:border-box" ${writable ? '' : 'disabled'}>
      <option value="true"${sel('true', basic.workspaceChanges !== false)}>开启</option>
      <option value="false"${sel('false', basic.workspaceChanges !== false)}>关闭</option>
    </select>`
  basicWrap.innerHTML = `<div class="mc-block-head"><b>基础配置</b><span class="spacer"></span><span class="mc-count">${writable ? '可编辑' : '只读'}</span></div>
    ${settingRow('默认执行策略', policyControl, '新对话的默认执行策略；已有对话不回溯。')}
    ${settingRow('默认推理强度', effortControl, '影响新任务的首轮推理强度；用户仍可在对话中调整。')}
    ${settingRow('工作区变更摘要', workspaceControl, '执行后生成工作区变更摘要；关闭后不额外采集文件差异。')}
    <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-top:1px solid #eef0f3;flex-wrap:wrap">
      <span class="mc-dim">保存到本机 runtimeSettings；仅管理员可写，对新会话生效。</span>
      <span class="spacer"></span>
      <button class="btn sm primary" id="setSave" ${writable ? '' : 'disabled'}>保存基础配置</button>
    </div>`
  blocks.appendChild(basicWrap)
  basicWrap.querySelector('#setSave')?.addEventListener('click', async (ev) => {
    const button = ev.currentTarget
    button.disabled = true
    const payload = {
      defaultPolicy: basicWrap.querySelector('#setPolicy').value,
      defaultEffort: basicWrap.querySelector('#setEffort').value,
      workspaceChanges: basicWrap.querySelector('#setWorkspaceChanges').value === 'true',
    }
    const { ok, body: saved } = await api('/api/settings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!ok) {
      button.disabled = false
      return toast(saved.error || '基础配置保存失败', true)
    }
    state.runtimeSettings = saved.settings || { ...state.runtimeSettings, ...payload }
    toast('基础配置已保存，对新会话生效')
    renderView()
  })

  const versionWrap = document.createElement('div')
  versionWrap.className = 'mc-block'
  versionWrap.innerHTML = `<div class="mc-block-head"><b>客户端版本</b><span class="spacer"></span><span class="mc-count">只读</span></div>
    ${infoRows(sec.version)}`
  blocks.appendChild(versionWrap)

  const envWrap = document.createElement('div')
  envWrap.className = 'mc-block'
  envWrap.innerHTML = `<div class="mc-block-head"><b>环境配置</b><span class="spacer"></span><span class="mc-count">只读</span></div>
    ${infoRows(sec.environment)}
    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:10px 12px;border-top:1px solid #eef0f3">
      <span class="mc-dim">网络：</span>
      ${(sec.networks || []).map((n) => `<span class="mc-tag ${n.current ? 'ok' : ''}">${esc(n.label)}${n.current ? ' · 当前' : ''}</span>`).join('')}
    </div>`
  blocks.appendChild(envWrap)
}

async function renderAdmin(el) {
  const { body } = await api('/api/console')
  state.console = body
  const roles = body.roles || []
  // 角色与范围由人员权限配置决定，管理中心只读取，不再允许手动切换
  const role = roles.find((r) => r.id === (body.currentRole || 'platform')) || roles[0]
  state.consoleRole = role.id
  const scopes = role.scopes || body.scopes
  const scope = body.scope || scopes[0]
  state.consoleScope = scope
  const allowed = (id) => role.modules.includes(id)
  const meta = body.modules
  const navItems = (g) => g.items.filter(allowed)
  const tab = allowed(state.consoleTab) ? state.consoleTab : 'overview'
  state.consoleTab = tab
  const AI_SEGMENTS = [
    { id: 'baseline', no: '01', label: '运行基线', note: '系统内核只读；平台公共能力可停用；官方技能在市场按需安装' },
    { id: 'models', no: '02', label: '模型与网关', note: '当前账号真实模型网关配置；没有真实用量数据时不展示虚构配额' },
    { id: 'agents', no: '03', label: 'Agent 与 MCP', note: '运行时实际加载的 Agent、MCP、技能与调度模块' },
    { id: 'plugins', no: '04', label: '插件与技能', note: '员工提交的插件与技能、审核与分类上架管理' },
  ]
  const aiTab = AI_SEGMENTS.some((s) => s.id === state.aiTab) ? state.aiTab : 'baseline'
  state.aiTab = aiTab
  const AI_BLOCK_GROUP = {
    '官方内置插件与技能': 'baseline',
    '系统内核': 'baseline',
    '平台公共能力': 'baseline',
    '模型管理': 'models',
    '模型网关': 'models',
    '用量与配额': 'models',
    'Agent 与 MCP': 'agents',
    'Agent、MCP 与技能运行时': 'agents',
    'DSH 运行时诊断': 'agents',
    '插件审核': 'plugins',
    '插件 / 技能审核': 'plugins',
    '插件市场已上架管理': 'plugins',
    '插件 / 技能上架管理': 'plugins',
  }
  const sec = body.sections[tab]
  const STATUS = /^(正常|在线|成功|已发布|已通过|已闭环|已回收|已恢复|已修复|可用|开启|允许|通过|已入库|已生效|已显示|—)$/
  const WARN = /^(待审核|待审批|待分派|待复核|待受理|待补录|处理中|草稿|降级|延迟|分发中|灰度|待发布|已暂停|待处理|预警|待确认|已取消|已过期)$/
  const BAD = /^(失败|驳回|已拒绝|阻断|高风险|已锁定|超时|异常|关闭|禁用|无权限)$/
  const cell = (x) => {
    const s = String(x == null ? '' : x)
    if (STATUS.test(s)) return `<span class="mc-tag ok">${esc(s)}</span>`
    if (WARN.test(s)) return `<span class="mc-tag warn">${esc(s)}</span>`
    if (BAD.test(s)) return `<span class="mc-tag bad">${esc(s)}</span>`
    if (/^\d{2}:\d{2}$/.test(s) || s.startsWith('今日') || s.startsWith('昨日')) return `<span class="mono mc-dim">${esc(s)}</span>`
    return esc(s)
  }
  const block = (b) => {
    if (b.type === 'rows') {
      return `<div class="mc-block"><div class="mc-block-head"><b>${esc(b.title)}</b><span class="spacer"></span><span class="mc-count">${b.items.length} 项</span></div>
        <div class="mc-rows">${b.items.map((r) => `<div class="mc-row"><span class="mc-row-main">${esc(r[0])}</span>${r.slice(1).map((c) => `<span class="mc-row-cell">${cell(c)}</span>`).join('')}</div>`).join('')}</div></div>`
    }
    const n = b.cols.length
    return `<div class="mc-block">
      <div class="mc-block-head"><b>${esc(b.title)}</b><span class="spacer"></span><span class="mc-count">${b.rows.length} 条</span></div>
      <div class="mc-table" style="--mc-cols:repeat(${n}, minmax(0, 1fr))">
        <div class="mc-thead"><span>${b.cols.map((c) => esc(c)).join('</span><span>')}</span></div>
        ${b.rows.map((r) => `<div class="mc-trow">${r.map((c, i) => `<span class="${i === 0 ? 'mc-first' : ''}">${cell(c)}</span>`).join('')}</div>`).join('')}
      </div>
    </div>`
  }
  const navHTML = body.nav.map((g) => {
    const items = navItems(g)
    if (!items.length) return ''
    return `<div class="mc-group">${esc(g.group)}</div>
      ${items.map((id) => `<button class="mc-nav-item${tab === id ? ' on' : ''}" data-mc="${id}"><span>${esc(meta[id].label)}</span></button>`).join('')}`
  }).join('')

  const emptyState = tab !== 'ai' && !sec.kpis.length && !sec.blocks.length
  // 先在离屏节点里组装完整页面，AI 能力管理的补充数据到位后再一次性挂载，
  // 避免切换时先出现“侧栏导航重复、主区空白”的中间态。
  const root = document.createElement('div')
  root.innerHTML = `
    <div class="mc-shell">
      <div class="mc-nav">
        <div class="mc-left-head"><div class="mc-title">管理中心</div></div>
        ${navHTML}<div class="mc-nav-foot">${esc(role.name)}<span>${esc(role.scope)}</span></div>
      </div>
      <div class="mc-main">
        <div class="mc-main-head">
          <div><div class="mc-main-title">${esc(sec.title)}</div><div class="mc-main-desc">${esc(meta[tab].desc)}</div></div>
          <span class="spacer"></span>
          <button class="btn sm" id="mcRefresh">${icon('refresh')}刷新</button>
        </div>
        ${tab === 'overview' ? `<div class="mc-note">${esc(sec.meta)}</div>` : `<div class="mc-note">${esc(sec.meta)}</div>`}
        <div class="mc-kpis"${tab === 'ai' ? ' id="aiKpis"' : ''}>${tab === 'ai' ? '' : sec.kpis.map((k) => `<div class="mc-kpi"><div class="mc-kpi-k">${esc(k.k)}</div><div class="mc-kpi-v ${k.tone || ''}">${esc(k.v)}</div><div class="mc-kpi-note">${esc(k.note)}</div></div>`).join('')}</div>
        ${tab === 'ai' ? `<style>.mc-seg{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr));gap:3px;margin-top:14px;padding:3px;border:1px solid #e7ebf1;border-radius:10px;background:#f7f8fa}.mc-seg-item{display:inline-flex;align-items:center;justify-content:center;gap:5px;border:1px solid transparent;background:transparent;border-radius:7px;padding:7px 3px;font-size:11px;color:#4a5057;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mc-seg-item.on{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}.mc-seg-no{font-family:ui-monospace,Consolas,monospace;font-size:9px;color:#9aa1aa;flex:none}.mc-seg-item.on .mc-seg-no{color:var(--accent-ink)}.mc-seg-note{margin:9px 0 0;font-size:var(--fs-dense);color:#7b828b;line-height:1.6}@media (max-width:760px){.mc-seg-no{display:none}}</style><div class="mc-seg" id="aiSeg">${AI_SEGMENTS.map((s) => `<button class="mc-seg-item${aiTab === s.id ? ' on' : ''}" style="${aiTab === s.id ? 'background:var(--accent)!important;color:var(--accent-ink)!important;border-color:var(--accent)!important' : ''}" data-aitab="${s.id}"><span class="mc-seg-no">${s.no}</span>${s.label}</button>`).join('')}</div>
          <div class="mc-seg-note">${esc(AI_SEGMENTS.find((s) => s.id === aiTab).note)}</div>` : ''}
        <div class="mc-blocks">${sec.blocks.map(block).join('')}${emptyState ? `<div class="mc-empty">该模块尚未接入真实数据，暂不展示演示内容。</div>` : ''}</div>
      </div>
    </div>`
  const blocks = root.querySelector('.mc-blocks')

  root.querySelectorAll('[data-mc]').forEach((b) => b.addEventListener('click', () => {
    state.consoleTab = b.dataset.mc
    renderView()
  }))
  root.querySelectorAll('[data-aitab]').forEach((b) => b.addEventListener('click', () => {
    state.aiTab = b.dataset.aitab
    renderView()
  }))
  root.querySelector('#mcRefresh').addEventListener('click', () => {
    toast('已刷新：数据来自平台监控、模型网关与数据中心接口')
    renderView()
  })

  if (tab === 'security') {
    const { body: approvalBody } = await api('/api/approval-decisions?limit=50')
    const items = approvalBody.items || []
    const statusOf = (value) => {
      if (/allowed/i.test(String(value || ''))) return ['ok', '已通过']
      if (value === 'pending') return ['warn', '待审批']
      if (/reject|deny/i.test(String(value || ''))) return ['bad', '已拒绝']
      if (/cancel/i.test(String(value || ''))) return ['warn', '已取消']
      if (/expire/i.test(String(value || ''))) return ['warn', '已过期']
      return ['', value || '—']
    }
    const ruleOf = (value) => ({
      'dsh-workspace-write-escalation': 'DSH 工作区越界升级',
      'dsh-read-only-approval': 'DSH 只读策略升级',
      'chat-mode-no-escalation': '对话模式只读',
      'chat-mode-approval': '对话模式：请求授权',
      'auto-chat-runtime-approval': '自动模式：执行请求',
      'external-side-effect': '外部副作用',
      'scheduled-read-only-scope': '定时任务：只读范围',
      'scheduled-scope-exceeded': '定时任务：超出预设范围',
      'dsh-scheduled-escalation-unavailable': '定时任务无人值守',
    }[value] || value || '—')
    const riskOf = (value) => ({ high: '高风险', medium: '中风险', low: '低风险' }[value] || value || '—')
    if (blocks) {
      const wrap = document.createElement('div')
      wrap.className = 'mc-block'
      wrap.innerHTML = `<div class="mc-block-head"><b>审批决策列表</b><span class="spacer"></span><span class="mc-count">${items.length} 条</span></div>
        ${items.length ? `<div style="display:flex;flex-direction:column">${items.map((x) => {
          const [tone, label] = statusOf(x.decision)
          const tool = toolLabel(x.tool)
          const time = String(x.time || '').replace('T', ' ').slice(0, 16)
          return `<div style="padding:10px 11px;border-bottom:1px solid #eef0f3;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 10px">
            <div style="min-width:0">
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                <b style="font-size:12px;color:#202124">${esc(tool)}</b>
                ${x.operation && x.operation !== 'unknown' && x.operation !== x.tool ? `<span class="mc-dim" style="font-size:11px">${esc(x.operation)}</span>` : ''}
                <span class="mono" style="font-size:10px;color:#9aa1aa">${esc(time)}</span>
              </div>
              <div style="font-size:10px;color:#8a8f96;line-height:1.5;margin-top:2px">${esc(x.actor || '—')} · ${esc(ruleOf(x.rule))}${x.risk ? ` · ${esc(riskOf(x.risk))}` : ''}</div>
            </div>
            <span class="mc-tag ${tone}" style="align-self:start">${esc(label)}</span>
            <div style="grid-column:1/-1;font-size:11px;color:#4b5056;line-height:1.55;word-break:break-word">${esc(x.argsSummary || '未提供参数摘要')}</div>
          </div>`
        }).join('')}</div>` : `<div class="mc-row">暂无审批决策记录</div>`}
        <div class="mc-block-note">PTC 嵌套调用无法回传精确参数时，摘要来自运行时升级原因，不冒充完整参数。</div>`
      blocks.appendChild(wrap)
    }
  }

  if (tab === 'ai') {
    const [{ body: sub }, { body: runtimeInfo }, { body: modelCfg }] = await Promise.all([
      api('/api/plugin-subs'),
      api('/api/runtime/plugins'),
      api('/api/model/config'),
    ])
    const pending = (sub.items || []).filter((x) => x.status === 'pending')
    const pendingPlugins = pending.filter((x) => x.kind !== 'skill')
    const pendingSkills = pending.filter((x) => x.kind === 'skill')
    const runtimePlugins = runtimeInfo.plugins || []
    if (blocks) {
      const reviewRows = (items, emptyText, type) => items.map((x) => {
        const bad = (x.checks || []).some((c) => c[1] === '不通过')
        const warn = (x.checks || []).some((c) => c[1] === '待复核')
        const tone = bad ? 'bad' : warn ? 'warn' : 'ok'
        return `<div class="mc-trow"><span class="mc-first">${esc(x.name)} <span class="tag" style="font-size:10px">${type}</span> <span class="mc-dim mono">v${esc(x.version)}</span></span><span>${esc(x.author)} · ${esc(x.unit)}</span><span><span class="mc-tag ${tone}">${bad ? '存在不通过项' : warn ? '有权限待复核' : '全部通过'}</span></span><span class="mc-acts"><button class="btn sm" data-review="reject" data-subid="${x.id}">退回</button><button class="btn sm primary" data-review="approve" data-subid="${x.id}">通过上架</button></span></div>`
      }).join('') || `<div class="mc-row">${emptyText}</div>`
      const wrap = document.createElement('div')
      wrap.className = 'mc-block'
      wrap.innerHTML = `<div class="mc-block-head"><b>插件 / 技能审核</b><span class="spacer"></span><span class="mc-count">${pending.length} 项待处理</span></div>
        <div style="display:flex;align-items:center;gap:8px;padding:8px 10px 4px"><b style="font-size:12px">插件审核</b><span class="mc-count">${pendingPlugins.length} 项待处理</span></div>
        <div class="mc-table" style="--mc-cols:1.4fr 1fr 1.2fr 1fr">
          <div class="mc-thead"><span>插件</span><span>提交人</span><span>自动检测</span><span>操作</span></div>
          ${reviewRows(pendingPlugins, '当前没有待审核插件', '插件')}
        </div>
        <div style="display:flex;align-items:center;gap:8px;padding:12px 10px 4px"><b style="font-size:12px">技能审核</b><span class="mc-count">${pendingSkills.length} 项待处理</span></div>
        <div class="mc-table" style="--mc-cols:1.4fr 1fr 1.2fr 1fr">
          <div class="mc-thead"><span>技能</span><span>提交人</span><span>自动检测</span><span>操作</span></div>
          ${reviewRows(pendingSkills, '当前没有待审核技能', '技能')}
        </div>`
      blocks.appendChild(wrap)
      wrap.querySelectorAll('[data-review]').forEach((b) => b.addEventListener('click', async () => {
        const id = b.dataset.subid
        if (b.dataset.review === 'approve') {
          const { ok, body } = await api('/api/plugin-subs/review', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, action: 'approve' }) })
          if (!ok) return toast(body.error || '审核失败', true)
          toast(body.packageReady ? '已通过并上架，技能包可安装' : '已通过并上架；该包不是技能包，当前不可一键安装')
          renderView()
          return
        }
        const m2 = openModal('退回插件', `
          <div class="form-note">退回后提交人可修改 ZIP 重新上传；退回原因会显示在检测报告里。</div>
          <div class="form-label">退回原因</div>
          <textarea class="form-area" id="rjReason" rows="3" placeholder="例如：声明外部网络依赖，需改用企业内网接口"></textarea>
          <div class="form-foot"><span class="spacer"></span><button class="btn" data-mclose>取消</button><button class="btn primary" id="rjOk">确认退回</button></div>`)
        m2.querySelector('[data-mclose]').addEventListener('click', () => m2.remove())
        m2.querySelector('#rjOk').addEventListener('click', async () => {
          const reason = m2.querySelector('#rjReason').value.trim()
          const { ok, body } = await api('/api/plugin-subs/review', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, action: 'reject', reason }) })
          m2.remove()
          if (!ok) return toast(body.error || '退回失败', true)
          toast('已退回，提交人会收到检测报告与原因')
          renderView()
        })
      }))
    }
    const { body: baselineAdmin } = await api('/api/admin/official-baseline')
    if (blocks) {
      const bundles = baselineAdmin.bundles || []
      const infra = baselineAdmin.infrastructure || []
      const wrap = document.createElement('div')
      wrap.className = 'mc-block'
      wrap.innerHTML = `<div class="mc-block-head"><b>系统内核</b><span class="spacer"></span><span class="mc-count">${infra.filter((x) => x.enabled).length + bundles.filter((b) => b.enabled).length} / ${infra.length + bundles.length} 项启用</span></div>
        <div class="mc-table" style="--mc-cols:minmax(120px,1.8fr) minmax(54px,.7fr) minmax(70px,.9fr) minmax(62px,.7fr)">
          <div class="mc-thead"><span>内核组件</span><span>类型</span><span>运行时位置</span><span>状态</span></div>
          ${infra.map((x) => `<div class="mc-trow">
            <span class="mc-first" title="${esc(x.name)}">${esc(x.name)} <span class="mc-tag">内核</span></span>
            <span>基础能力</span>
            <span class="mono" style="font-size:10px">${esc(x.module)}</span>
            <span><span class="mc-tag ${x.enabled ? 'ok' : 'warn'}">${x.enabled ? '已启用' : '缺失'}</span></span>
          </div>`).join('')}
          ${bundles.map((b) => `<div class="mc-trow">
            <span class="mc-first" title="${esc(b.label)}">${esc(b.label)} <span class="mc-dim mono">${esc(b.name)}</span></span>
            <span>插件</span>
            <span>核心运行时</span>
            <span><span class="mc-tag ${b.enabled ? 'ok' : 'warn'}">${b.enabled ? '已启用' : '缺失'}</span></span>
          </div>`).join('')}
        </div>
        <div class="mc-block-note">系统内核不可停用或卸载</div>`
      blocks.appendChild(wrap)
    }
    const { body: capAdmin } = await api('/api/platform-capabilities')
    const baselineBundleRows = baselineAdmin.bundles || []
    const capRows = capAdmin.items || []
    if (blocks) {
      const caps = capAdmin.items || []
      const wrap = document.createElement('div')
      wrap.className = 'mc-block'
      wrap.innerHTML = `<div class="mc-block-head"><b>平台公共能力</b><span class="spacer"></span><span class="mc-count">${caps.filter((c) => c.enabled).length} / ${caps.length} 项已启用</span></div>
        <div class="mc-table" style="--mc-cols:minmax(96px,1.6fr) minmax(78px,1.05fr) minmax(44px,.55fr) minmax(78px,.95fr)">
          <div class="mc-thead"><span>系统模块</span><span>运行时模块</span><span>权限</span><span>资源上限</span></div>
          ${caps.map((c) => `<div class="mc-trow">
            <span class="mc-first" title="${esc(c.name)}">${esc(c.shortName || c.name)} <span class="mc-tag ${c.disabled ? 'warn' : c.enabled ? 'ok' : 'bad'}">${c.disabled ? '已停用' : c.enabled ? '默认启用' : '未加载'}</span><span class="mc-dim" style="display:block;font-size:10px">${esc(c.accessibleTo || '全部授权用户')}</span></span>
            <span class="mono" style="font-size:10px">${esc(c.module)}</span>
            <span>${(c.permissions || []).length} 项</span>
            <span>${esc(capabilityLimitsText(c))}</span>
            <span class="mc-acts" style="grid-column:1/-1;flex-wrap:wrap">
              <button class="btn sm ${c.disabled ? 'primary' : ''}" data-captoggle="${esc(c.id)}" data-next="${c.disabled ? 'enable' : 'disable'}">${c.disabled ? '启用' : '停用'}</button>
              <button class="btn sm" data-cappolicy-admin="${esc(c.id)}">权限与资源</button>
              ${c.disabled ? `<span class="mc-dim">停用后不向授权用户开放</span>` : ''}
            </span>
          </div>`).join('') || '<div class="mc-row">暂无平台能力</div>'}
        </div>`
      blocks.appendChild(wrap)
      wrap.querySelectorAll('[data-cappolicy-admin]').forEach((b) => b.addEventListener('click', () => {
        const c = caps.find((x) => x.id === b.dataset.cappolicyAdmin)
        if (!c) return
        state.capabilities = caps
        state.capabilityCanManage = true
        openCapabilityPolicy(c)
      }))
      wrap.querySelectorAll('[data-captoggle]').forEach((b) => b.addEventListener('click', async () => {
        const c = caps.find((x) => x.id === b.dataset.captoggle)
        if (!c) return
        const action = b.dataset.next
        const run = async () => {
          const { ok, body } = await api('/api/admin/platform-capabilities', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: c.id, action }) })
          if (!ok) return toast(body.error || '操作失败', true)
          state.capabilities = (state.capabilities || []).map((x) => (x.id === c.id ? body.item : x))
          toast(action === 'disable' ? '平台公共能力已停用，不再向授权用户开放' : '平台公共能力已启用')
          renderView()
        }
        if (action === 'enable') return run()
        const m = openModal('停用平台公共能力', `
          <div class="form-note">停用后「${esc(c.name)}」不再向所有授权用户开放，但运行时模块与已有数据不会被删除。可随时重新启用。</div>
          <div class="form-foot"><span class="spacer"></span><button class="btn" data-mclose>取消</button><button class="btn primary" id="capToggleOk">确认停用</button></div>`)
        m.querySelector('[data-mclose]').addEventListener('click', () => m.remove())
        m.querySelector('#capToggleOk').addEventListener('click', async () => { m.remove(); await run() })
      }))
    }
    if (blocks) {
      const wrap = document.createElement('div')
      wrap.className = 'mc-block'
      const modelReady = Boolean(modelCfg.apiKeySaved && modelCfg.defaultModel)
      wrap.innerHTML = `<div class="mc-block-head"><b>模型网关</b><span class="spacer"></span><span class="mc-count">${modelReady ? '1 套已配置' : '未配置'}</span></div>
        <div class="mc-table" style="--mc-cols:minmax(90px,.7fr) minmax(200px,1.6fr)">
          <div class="mc-thead"><span>配置项</span><span>当前值</span></div>
          <div class="mc-trow"><span>供应商</span><span>${esc(modelCfg.provider || '未配置')}</span></div>
          <div class="mc-trow"><span>接口地址</span><span class="mono" style="font-size:11px">${esc(modelCfg.endpoint || '未配置')}</span></div>
          <div class="mc-trow"><span>默认模型</span><span>${esc(modelCfg.defaultModel || '未配置')}</span></div>
          <div class="mc-trow"><span>API Key</span><span><span class="mc-tag ${modelCfg.apiKeySaved ? 'ok' : 'warn'}">${modelCfg.apiKeySaved ? '已保存' : '未保存'}</span> <span class="mc-dim mono">${esc(modelCfg.key || '—')}</span></span></div>
          <div class="mc-trow"><span>连接测试</span><span>${modelCfg.testedAt ? `${esc(modelCfg.testedAt)} · ${esc(modelCfg.latency || '—')}` : '<span class="mc-dim">尚未测试</span>'}</span></div>
        </div>`
      blocks.appendChild(wrap)
    }
    if (blocks) {
      const wrap = document.createElement('div')
      wrap.className = 'mc-block'
      const keyIds = ['agent', 'agent-loop', 'llm-deepseek', 'mcp-jg', 'skill-office', 'optional-session-search', 'schedule']
      const keyRows = keyIds.map((id) => runtimePlugins.find((p) => p.id === id)).filter(Boolean)
      const enabledCount = runtimePlugins.filter((p) => p.enabled).length
      wrap.innerHTML = `<div class="mc-block-head"><b>DSH 运行时诊断</b><span class="spacer"></span><span class="mc-count">${enabledCount} / ${runtimePlugins.length} 启用 · ${runtimePlugins.filter((p) => !p.enabled).length} 停用</span><button class="btn sm" data-speech-open>本地语音</button><button class="btn sm" data-term-open>开发终端</button><button class="btn sm" data-runtime-all>查看全部</button></div>
        <div class="form-note" style="margin:0 0 8px">这里是 DSH 内部运行时模块，不是员工在插件市场安装的插件；停用项由当前 sdk profile 配置决定，属于运行诊断，不作为业务能力指标。</div>
        <div class="mc-table" style="--mc-cols:minmax(90px,.9fr) minmax(0,1.55fr) minmax(44px,.5fr)">
          <div class="mc-thead"><span>运行时 ID</span><span>插件包</span><span>状态</span></div>
          ${keyRows.map((p) => `<div class="mc-trow"><span class="mono" style="font-size:11px">${esc(p.id)}</span><span class="mono" style="font-size:10px">${esc(p.name)}</span><span><span class="mc-tag ${p.enabled ? 'ok' : 'warn'}">${p.enabled ? '启用' : '停用'}</span></span></div>`).join('') || '<div class="mc-row">运行时未返回插件清单</div>'}
        </div>`
      blocks.appendChild(wrap)
      wrap.querySelector('[data-speech-open]').addEventListener('click', openSpeechSettings)
      wrap.querySelector('[data-term-open]').addEventListener('click', openAdminTerminal)
      wrap.querySelector('[data-runtime-all]').addEventListener('click', () => {
        const rows = runtimePlugins.map((p) => `<div class="mc-trow" style="--mc-cols:minmax(120px,1fr) minmax(230px,2fr) minmax(54px,.6fr)">
          <span class="mono" style="font-size:11px">${esc(p.id)}</span>
          <span class="mono" style="font-size:10px">${esc(p.name)}</span>
          <span><span class="mc-tag ${p.enabled ? 'ok' : 'warn'}">${p.enabled ? '启用' : '停用'}</span></span>
        </div>`).join('')
        const m = openModal('DSH 运行时插件', `
          <div class="form-note">共 ${runtimePlugins.length} 个 DSH 内部模块，其中 ${runtimePlugins.filter((p) => !p.enabled).length} 个由当前 profile 配置为停用：${runtimePlugins.filter((p) => !p.enabled).map((p) => `<span class="mono">${esc(p.id)}</span>`).join('、')}。它们不是员工插件市场的商品，也不等同于平台公共能力。</div>
          <div style="max-height:52vh;overflow:auto;border:1px solid var(--line);border-radius:8px">
            <div class="mc-thead" style="--mc-cols:minmax(120px,1fr) minmax(230px,2fr) minmax(54px,.6fr);position:sticky;top:0;background:var(--panel);z-index:1"><span>运行时 ID</span><span>插件包</span><span>状态</span></div>
            ${rows}
          </div>`)
      })
    }
    const { body: marketAdmin } = await api('/api/admin/plugin-market')
    if (blocks) {
      const items = marketAdmin.items || []
      const pluginItems = items.filter((x) => x.type !== 'skill')
      const skillItems = items.filter((x) => x.type === 'skill')
      const listedPlugins = pluginItems.filter((x) => x.listed !== false).length
      const listedSkills = skillItems.filter((x) => x.listed !== false).length
      const marketRows = (rows, len) => rows.map((x, i) => `<div class="mc-trow">
            <span class="mc-first">${esc(x.name)} <span class="mc-dim mono">${esc(x.id)}</span></span>
            <span>${esc(x.publisher || '')}</span>
            <span><span class="mc-tag ${x.listed === false ? 'warn' : 'ok'}">${x.listed === false ? '已下架' : '已上架'}</span>${x.installed ? ` <span class="mc-tag ok">${(x.installUsers || []).length && x.installUsers[0]?.scope === 'baseline' ? '基线' : '已安装'}</span>` : ''}</span>
            <span class="mc-acts" style="grid-column:1/-1;flex-wrap:wrap">
              <button class="btn sm" data-mkt-sort="${esc(x.id)}" data-dir="up" ${i === 0 ? 'disabled' : ''}>↑</button>
              <button class="btn sm" data-mkt-sort="${esc(x.id)}" data-dir="down" ${i === len - 1 ? 'disabled' : ''}>↓</button>
              <button class="btn sm" data-mkt-users="${esc(x.id)}">安装用户 ${(x.installUsers || []).filter((u) => u.scope !== 'baseline').length}</button>
              <button class="btn sm" data-mkt-edit="${esc(x.id)}">编辑</button>
              <button class="btn sm ${x.listed === false ? 'primary' : ''}" data-mkt-list="${esc(x.id)}" data-next="${x.listed === false ? 'list' : 'unlist'}">${x.listed === false ? '重新上架' : '下架'}</button>
              ${x.origin === 'community' && x.kind !== 'plugin' ? `<button class="btn sm" data-mkt-upgrade="${esc(x.id)}">升级</button>` : ''}
              ${x.canRollback ? `<button class="btn sm" data-mkt-rollback="${esc(x.id)}">回滚</button>` : ''}
              ${x.origin === 'community' ? `<button class="btn sm" data-mkt-del="${esc(x.id)}">删除</button>` : ''}
            </span>
          </div>`).join('')
      const wrap = document.createElement('div')
      wrap.className = 'mc-block'
      wrap.innerHTML = `<div class="mc-block-head"><b>插件 / 技能上架管理</b><span class="spacer"></span><span class="mc-count">${listedPlugins} / ${pluginItems.length} 个插件 · ${listedSkills} / ${skillItems.length} 个技能已上架</span></div>
        <div style="display:flex;align-items:center;gap:8px;padding:8px 10px 4px"><b style="font-size:12px">插件市场</b><span class="mc-count">${pluginItems.length} 个条目</span></div>
        <div class="mc-table" style="--mc-cols:minmax(130px,1.7fr) minmax(100px,1fr) minmax(64px,.8fr)">
          <div class="mc-thead"><span>插件</span><span>发布单位</span><span>状态</span></div>
          ${marketRows(pluginItems, pluginItems.length) || '<div class="mc-row">市场还没有插件</div>'}
        </div>
        <div style="display:flex;align-items:center;gap:8px;padding:12px 10px 4px"><b style="font-size:12px">技能市场</b><span class="mc-count">${skillItems.length} 个条目</span></div>
        <div class="mc-table" style="--mc-cols:minmax(130px,1.7fr) minmax(100px,1fr) minmax(64px,.8fr)">
          <div class="mc-thead"><span>技能</span><span>发布单位</span><span>状态</span></div>
          ${marketRows(skillItems, skillItems.length) || '<div class="mc-row">市场还没有技能</div>'}
        </div>`
      blocks.appendChild(wrap)
      wrap.querySelectorAll('[data-mkt-list]').forEach((b) => b.addEventListener('click', async () => {
        const { ok, body } = await api('/api/admin/plugin-market', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: b.dataset.mktList, action: b.dataset.next }) })
        if (!ok) return toast(body.error || '操作失败', true)
        toast(b.dataset.next === 'list' ? '已重新上架' : '已下架，用户市场不再展示')
        renderView()
      }))
      wrap.querySelectorAll('[data-mkt-del]').forEach((b) => b.addEventListener('click', async () => {
        const { ok, body } = await api('/api/admin/plugin-market', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: b.dataset.mktDel, action: 'delete' }) })
        if (!ok) return toast(body.error || '删除失败', true)
        toast('已删除该社区条目及其安装包')
        renderView()
      }))
      wrap.querySelectorAll('[data-mkt-sort]').forEach((b) => b.addEventListener('click', async () => {
        const { ok, body } = await api('/api/admin/plugin-market', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: b.dataset.mktSort, action: 'sort', direction: b.dataset.dir }) })
        if (!ok) return toast(body.error || '排序失败', true)
        toast('已调整市场顺序')
        renderView()
      }))
      wrap.querySelectorAll('[data-mkt-users]').forEach((b) => b.addEventListener('click', () => {
        const item = items.find((x) => x.id === b.dataset.mktUsers)
        if (!item) return
        const users = item.installUsers || []
        const scopeText = (u) => u.scope === 'baseline' ? '全客户端基线' : u.scope === 'project' ? `项目 ${u.projectId || ''}` : '当前账号'
        const m = openModal('安装用户', users.length ? `
          <div class="mc-table" style="--mc-cols:1fr .8fr 1.4fr">
            <div class="mc-thead"><span>账号</span><span>范围</span><span>项目 / 时间</span></div>
            ${users.map((u) => `<div class="mc-trow"><span>${esc(u.userName || u.userId || '—')}</span><span>${esc(scopeText(u))}</span><span>${esc(u.projectId || (u.installedAt ? new Date(u.installedAt).toLocaleString('zh-CN') : '—'))}</span></div>`).join('')}
          </div>` : '<div class="mc-row">还没有安装记录</div>', )
        m.querySelector('[data-mclose]')?.addEventListener('click', () => m.remove())
      }))
      wrap.querySelectorAll('[data-mkt-upgrade]').forEach((b) => b.addEventListener('click', () => {
        const item = items.find((x) => x.id === b.dataset.mktUpgrade)
        if (!item) return
        const m = openModal('升级市场包', `
          <div class="form-note">当前版本 <span class="mono">${esc(item.version || '—')}</span>。平台会先备份当前包；替换失败自动回滚，成功后可手动回滚到上一版本。</div>
          <div class="form-label">新版本 ZIP 包</div><input class="text-input" type="file" id="mktUpFile" accept=".zip" />
          <div class="form-label" style="margin-top:8px">版本号（可选）</div><input class="text-input" id="mktUpVersion" placeholder="例如 1.2.0" />
          <div class="form-foot"><span class="spacer"></span><button class="btn" data-mclose>取消</button><button class="btn primary" id="mktUpOk">上传并升级</button></div>`)
        m.querySelector('#mktUpOk').addEventListener('click', async (ev) => {
          const file = m.querySelector('#mktUpFile').files?.[0]
          if (!file) return toast('请选择升级 ZIP 包', true)
          ev.currentTarget.disabled = true
          const up = await uploadBinaryFile(file, 'plugin')
          if (!up.ok) { ev.currentTarget.disabled = false; return toast(up.body?.error || '上传失败', true) }
          const { ok, body } = await api('/api/admin/plugin-market', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: item.id, action: 'upgrade', fileId: up.file.id, version: m.querySelector('#mktUpVersion').value.trim() }) })
          if (!ok) { ev.currentTarget.disabled = false; return toast(body?.error || '升级失败', true) }
          m.remove()
          toast(`已升级到 ${body.item?.version || '新版本'}${body.backup ? '，旧版本已备份' : ''}`)
          renderView()
        })
      }))
      wrap.querySelectorAll('[data-mkt-rollback]').forEach((b) => b.addEventListener('click', () => {
        const item = items.find((x) => x.id === b.dataset.mktRollback)
        if (!item) return
        const m = openModal('回滚市场包', `
          <div class="form-note">将把 <span class="mono">${esc(item.name)}</span> 恢复到上一备份版本 ${esc(item.versions?.[0]?.version || '')}。已安装账号的运行时会在下一轮重新加载。</div>
          <div class="form-foot"><span class="spacer"></span><button class="btn" data-mclose>取消</button><button class="btn primary" id="mktRbOk">确认回滚</button></div>`)
        m.querySelector('#mktRbOk').addEventListener('click', async (ev) => {
          ev.currentTarget.disabled = true
          const { ok, body } = await api('/api/admin/plugin-market', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: item.id, action: 'rollback' }) })
          if (!ok) { ev.currentTarget.disabled = false; return toast(body?.error || '回滚失败', true) }
          m.remove()
          toast(`已回滚到 ${body.restoredVersion || '上一版本'}`)
          renderView()
        })
      }))
      wrap.querySelectorAll('[data-mkt-edit]').forEach((b) => b.addEventListener('click', () => {
        const item = items.find((x) => x.id === b.dataset.mktEdit)
        if (!item) return
        const m = openModal('编辑市场条目', `
          <div class="form-label">名称</div><input class="text-input" id="mktName" value="${esc(item.name)}" />
          <div class="form-label" style="margin-top:8px">描述</div><textarea class="form-area" id="mktDesc" rows="3">${esc(item.desc || '')}</textarea>
          <div class="form-label" style="margin-top:8px">发布单位</div><input class="text-input" id="mktPublisher" value="${esc(item.publisher || '')}" />
          <div class="form-label" style="margin-top:8px">分组</div>
          <select class="text-input" id="mktSection">
            ${['官方与内置', '热门', '新品推荐', '企业内部'].map((s) => `<option value="${s}"${item.section === s ? ' selected' : ''}>${s}</option>`).join('')}
          </select>
          <div class="form-foot"><span class="spacer"></span><button class="btn" data-mclose>取消</button><button class="btn primary" id="mktSave">保存</button></div>`)
        m.querySelector('[data-mclose]').addEventListener('click', () => m.remove())
        m.querySelector('#mktSave').addEventListener('click', async () => {
          const { ok, body } = await api('/api/admin/plugin-market', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: item.id, action: 'update', name: m.querySelector('#mktName').value, desc: m.querySelector('#mktDesc').value, publisher: m.querySelector('#mktPublisher').value, section: m.querySelector('#mktSection').value }) })
          m.remove()
          if (!ok) return toast(body.error || '保存失败', true)
          toast('市场条目已更新')
          renderView()
        })
      }))
    }
    const kpiBox = root.querySelector('#aiKpis')
    if (kpiBox) {
      const marketItems = marketAdmin.items || []
      const officialCount = marketItems.filter((x) => x.origin !== 'community').length
      const infraRows = baselineAdmin.infrastructure || []
      const enabledBundles = baselineBundleRows.filter((x) => x.enabled).length
      const enabledInfra = infraRows.filter((x) => x.enabled).length
      const kernelTotal = baselineBundleRows.length + infraRows.length
      const enabledCaps = capRows.filter((x) => x.enabled).length
      const kpis = [
        { k: '系统内核', v: `${enabledBundles + enabledInfra} / ${kernelTotal}`, note: '启动底座与文件基础，只读' },
        { k: '平台公共能力', v: `${enabledCaps} / ${capRows.length}`, note: '系统级模块，可停用' },
        { k: '市场条目', v: `${marketItems.length}`, note: `官方 ${officialCount} · 待审核 ${pending.length}` },
        { k: '待审核', v: `${pending.length}`, note: '员工插件与技能提交' },
      ]
      kpiBox.innerHTML = kpis.map((x) => `<div class="mc-kpi"><div class="mc-kpi-k">${esc(x.k)}</div><div class="mc-kpi-v">${esc(x.v)}</div><div class="mc-kpi-note">${esc(x.note)}</div></div>`).join('')
    }
    if (blocks) {
      const seenTitles = new Set()
      blocks.querySelectorAll('.mc-block').forEach((b) => {
        const title = b.querySelector('.mc-block-head b')?.textContent.trim() || ''
        if (seenTitles.has(title)) { b.remove(); return }
        seenTitles.add(title)
        const group = AI_BLOCK_GROUP[title]
        b.style.display = group === aiTab ? '' : 'none'
      })
    }
  }
  if (tab === 'settings') renderAdminSettings(blocks, sec)

  el.replaceChildren(...root.childNodes)
}

async function renderTickets(box) {
  const { body } = await api('/api/tickets')
  state.tickets = body.items || []
  const map = { 待分派: ['warn', '待分派'], 处理中: ['', '处理中'], 待复核: ['warn', '待复核'], 已闭环: ['ok', '已闭环'] }
  box.innerHTML = `
    <div class="toolbar" style="margin-bottom:12px">
      <span class="spacer"></span><button class="btn sm primary" id="newTicket">新建工单</button>
    </div>
    <div class="table-card">
      <div class="table-head" style="display:grid;grid-template-columns:minmax(0,2fr) 72px 96px 160px 80px 120px"><span>工单</span><span>网络</span><span>处理人</span><span>时限</span><span>状态</span><span></span></div>
      ${state.tickets.map((t) => {
        const [cls, label] = map[t.status] || ['', t.status]
        return `<div class="row ticket-row" style="grid-template-columns:minmax(0,2fr) 72px 96px 160px 80px 120px">
          <span class="name"><b>${esc(t.type)} · ${esc(t.subject)}</b><span>${esc(t.id)} · 创建 ${esc(t.created)}</span></span>
          <span class="src">${esc(t.net)}</span>
          <span class="src">${esc(t.owner)}</span>
          <span class="tm">${esc(t.due)}</span>
          <span><span class="tag ${cls}">${label}</span></span>
          <span class="row-actions">
            ${t.status === '待分派' ? `<button class="btn sm" data-tk="assign" data-id="${t.id}">分派</button>` : ''}
            ${t.status === '处理中' ? `<button class="btn sm" data-tk="done" data-id="${t.id}">完成</button>` : ''}
            ${t.status === '待复核' ? `<button class="btn sm primary" data-tk="verify" data-id="${t.id}">复核</button>` : ''}
            <button class="btn sm" data-tklog="${t.id}">记录</button>
          </span>
        </div>`
      }).join('')}
    </div>`
  box.querySelector('#newTicket').addEventListener('click', openTicketForm)
  box.querySelectorAll('[data-tk]').forEach((b) => b.addEventListener('click', async () => {
    await api('/api/tickets/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: b.dataset.id, action: b.dataset.tk }) })
    toast('工单状态已更新，处理记录已留痕')
    renderView()
  }))
  box.querySelectorAll('[data-tklog]').forEach((b) => b.addEventListener('click', () => {
    const t = state.tickets.find((x) => x.id === b.dataset.tklog)
    openTaskDetail
    const slide = ensureSlide()
    slide.innerHTML = `
      <div class="slide-head"><div><div class="slide-title">${esc(t.type)} · ${esc(t.subject)}</div><div class="slide-sub">${esc(t.id)} · ${esc(t.net)}</div></div><span class="spacer"></span><button class="btn subtle" data-close>${icon('close')}</button></div>
      <div class="slide-body">
        <div class="field"><div class="field-label">处理链路</div>
          ${t.history.map((h) => `<div class="timeline-row"><span class="mono">${esc(h.time)}</span><span>${esc(h.text)}</span></div>`).join('')}
        </div>
        <div class="notice neutral">复核证据保留：账号停用记录、权限回收结果、会话终止时间；异常超时自动升级提醒。</div>
      </div>`
    wireSlide(slide)
  }))
}


async function renderMonitor(box) {
  const { body } = await api('/api/monitor')
  state.monitor = body
  const storagePct = Math.round((body.storage.used / body.storage.total) * 100)
  box.innerHTML = `
    <div class="mon-grid">
      ${body.services.map((s) => `
        <div class="mon-card">
          <div class="mon-top"><span class="mon-name">${esc(s.name)}</span><span class="tag ${s.status === 'ok' ? 'ok' : 'warn'}">${s.status === 'ok' ? '正常' : '降级'}</span></div>
          <div class="mon-kv"><span>P95 ${esc(s.latency)}</span><span>可用性 ${esc(s.uptime)}</span></div>
          ${s.note ? `<div class="mon-note">${esc(s.note)}</div>` : ''}
        </div>`).join('')}
    </div>
    <div class="mon-row">
      <div class="side-card" style="flex:1">
        <div class="side-card-head">存储与目录</div>
        <div class="side-card-body">
          <div class="usage-top"><span class="usage-num">${body.storage.used} ${body.storage.unit}</span><span class="usage-unit">/ ${body.storage.total} ${body.storage.unit}</span><span class="usage-pct">${storagePct}%</span></div>
          <div class="usage-bar"><span style="width:${storagePct}%"></span></div>
          <div class="usage-note">${esc(body.storage.note)}</div>
        </div>
      </div>
      <div class="side-card" style="flex:1">
        <div class="side-card-head">失败任务与告警</div>
        <div class="side-card-body">
          ${body.failures.map((f) => `<div class="fail-row"><span class="fail-name">${esc(f.task)}</span><span class="fail-reason">${esc(f.reason)}</span><span class="mono">${esc(f.at)}</span><span class="tag">${esc(f.retry)}</span></div>`).join('')}
        </div>
      </div>
    </div>
    <div class="apps-note">P95 与可用性为演示读数，正式验收按 PRD 第 11 章测试计划执行；此处只暴露运维可观测面。</div>`
}


async function renderFeedback(box) {
  const { body } = await api('/api/feedback')
  state.feedback = body.items || []
  box.innerHTML = `
    <div class="toolbar" style="margin-bottom:12px"><span class="mono" style="color:var(--muted)">来自员工与应用的反馈，可关联到任务与审计</span><span class="spacer"></span><button class="btn sm" id="mkFeedback">代录反馈</button></div>
    <div class="table-card">
      <div class="table-head" style="display:grid;grid-template-columns:minmax(0,2fr) 1fr 100px 80px"><span>反馈</span><span>来源</span><span>提交人</span><span>状态</span></div>
      ${state.feedback.map((f) => `
        <div class="row fb-row" style="grid-template-columns:minmax(0,2fr) 1fr 100px 80px">
          <span class="name"><b>${esc(f.subject)}</b><span>${esc(f.kind)} · ${esc(f.app)}${f.task ? ` · 关联 ${esc(f.task)}` : ''}</span></span>
          <span class="src">${esc(f.app)}</span>
          <span class="tm">${esc(f.actor)}</span>
          <span><span class="tag ${f.status === '已修复' ? 'ok' : f.status === '处理中' ? 'warn' : ''}">${esc(f.status)}</span></span>
        </div>`).join('')}
    </div>`
  box.querySelector('#mkFeedback').addEventListener('click', openFeedbackModal)
}


async function renderAppReview(box) {
  const { body } = await api('/api/apps')
  const all = state.apps.length ? state.apps : body.items
  const queue = all.filter((a) => a.status !== 'published')
  box.innerHTML = `
    <div class="apps-note" style="margin-bottom:12px">流转链路：注册 → 接入验证（URL / 身份 / 权限 / 健康检查）→ 审核 → 发布 → 版本维护。普通员工只能看到已发布应用。</div>
    <div class="table-card">
      <div class="table-head" style="display:grid;grid-template-columns:minmax(0,1.8fr) 1fr 84px 80px 200px"><span>应用</span><span>网络</span><span>版本</span><span>状态</span><span></span></div>
      ${queue.map((a) => `
        <div class="row appx-row" style="grid-template-columns:minmax(0,1.8fr) 1fr 84px 80px 200px">
          <span class="name"><b>${esc(a.name)}</b><span>${esc(a.dept)} · ${esc(a.maintainer)}</span></span>
          <span class="src">${esc((a.nets || []).map((n) => NET_LABEL[n]).join(' / '))}</span>
          <span class="tm">v${esc(a.version)}</span>
          <span><span class="tag ${a.status === 'review' ? 'warn' : ''}">${a.status === 'review' ? '待审核' : '草稿'}</span></span>
          <span class="row-actions">
            <button class="btn sm primary" data-appx="approve" data-id="${a.id}">审核通过</button>
            <button class="btn sm" data-appx="reject" data-id="${a.id}">驳回</button>
            <button class="btn sm" data-detail="${a.id}">详情</button>
          </span>
        </div>`).join('') || '<div style="padding:20px;color:var(--muted)">审核队列为空</div>'}
    </div>
    <div class="side-card" style="margin-top:12px">
      <div class="side-card-head">已发布应用 · 版本维护</div>
      <div class="side-card-body">
        ${all.filter((a) => a.status === 'published').map((a) => `
          <div class="fail-row">
            <span class="fail-name">${esc(a.name)} v${esc(a.version)}</span>
            <span class="fail-reason">${esc(a.dept)} · ${esc((a.nets || []).map((n) => NET_LABEL[n]).join(' / '))}</span>
            <button class="btn sm" data-appx="rollback" data-id="${a.id}">回滚</button>
            <button class="btn sm" data-appx="offline" data-id="${a.id}">下架</button>
          </div>`).join('') || '<div style="color:var(--muted)">暂无已发布应用</div>'}
      </div>
    </div>`
  box.querySelectorAll('[data-appx]').forEach((b) => b.addEventListener('click', async () => {
    const { ok, body: res } = await api('/api/apps/action', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: b.dataset.id, action: b.dataset.appx }),
    })
    if (!ok) return toast(res.error || '操作失败', true)
    toast(`应用状态已更新：${b.dataset.appx} → ${res.item.status}`)
    renderView()
  }))
  box.querySelectorAll('[data-detail]').forEach((b) => b.addEventListener('click', () => openAppDetail(b.dataset.detail)))
}


/* --------------------------- automation --------------------------- */

async function renderAutomation(el) {
  const { body } = await api('/api/automations')
  state.automations = body.items || []
  el.innerHTML = `
    <div class="view-head">
      <div><div class="view-title">自动化任务</div></div>
      <div class="spacer"></div><button class="btn primary" id="newAuto">${icon('plus')}新建自动化</button>
    </div>
    <div class="table-card">
      <div class="table-head" style="display:grid;grid-template-columns:minmax(0,1.6fr) 150px 200px 80px 150px"><span>自动化</span><span>频率</span><span>最近执行</span><span>状态</span><span></span></div>
      ${state.automations.map((a) => `
        <div class="row auto-row" style="grid-template-columns:minmax(0,1.6fr) 150px 200px 80px 150px">
          <span class="name"><b>${esc(a.name)}</b><span>${esc(a.owner)} · 下次 ${esc(a.next)}</span></span>
          <span class="src">${esc(a.schedule)}</span>
          <span class="tm">${esc(a.last)}</span>
          <span><span class="tag ${a.status === 'active' ? 'ok' : ''}">${a.status === 'active' ? '运行中' : '已暂停'}</span></span>
          <span class="row-actions">${a.source === 'harness' ? '' : `<button class="btn sm" data-run="${a.id}">立即执行</button>`}<button class="btn sm" data-pause="${a.id}">${a.status === 'active' ? '暂停' : '启用'}</button><button class="btn sm" data-deltask="${a.id}">删除</button></span>
        </div>`).join('')}
    </div>`
  el.querySelector('#newAuto').addEventListener('click', openAutomationForm)
  el.querySelectorAll('[data-run]').forEach((b) => b.addEventListener('click', async () => {
    const { ok, body: res } = await api('/api/automations/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: b.dataset.run }) })
    if (!ok) return toast(res.error, true)
    if (res.item) {
      const current = state.automations.find((x) => x.id === res.item.id)
      if (current) Object.assign(current, res.item)
    }
    await loadTasks()
    toast(`已触发执行，任务 ${res.task.id} 进入队列`)
    renderView()
  }))
  el.querySelectorAll('[data-pause]').forEach((b) => b.addEventListener('click', async () => {
    const a = state.automations.find((x) => x.id === b.dataset.pause)
    if (!a) return
    const { ok, body } = await api('/api/automations/pause', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: a.id }) })
    if (!ok) return toast(body.error || '切换任务状态失败', true)
    a.status = body.item?.status || (a.status === 'active' ? 'paused' : 'active')
    toast(`已${a.status === 'active' ? '启用' : '暂停'}「${a.name}」`)
    renderView()
  }))
  el.querySelectorAll('[data-deltask]').forEach((b) => b.addEventListener('click', () => {
    const a = state.automations.find((x) => x.id === b.dataset.deltask)
    if (!a) return
    const mask = openModal('删除定时任务', `
      <div class="form-note">删除后该任务不再触发；已产生的执行记录与审计不受影响。</div>
      <div class="form-foot"><span class="spacer"></span><button class="btn" data-mclose>取消</button><button class="btn danger" data-del>删除</button></div>`)
    mask.querySelector('[data-mclose]').addEventListener('click', () => mask.remove())
    const del = mask.querySelector('[data-del]')
    del.addEventListener('click', async () => {
      if (del.disabled) return
      del.disabled = true
      const { ok, body } = await api('/api/automations/delete', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: a.id }) })
      if (!ok) { del.disabled = false; return toast(body.error || '删除定时任务失败', true) }
      mask.remove()
      state.automations = state.automations.filter((x) => x.id !== a.id)
      if (state.taskSel === a.id) state.taskSel = ''
      toast(`已删除「${a.name}」`)
      renderView()
    })
  }))
}


const ACCENTS = [
  { key: 'blue', label: '蓝色（默认）', dot: '#2f6fe4' },
  { key: 'green', label: '绿色', dot: '#1f8a5b' },
  { key: 'yellow', label: '黄色', dot: '#f0b429' },
  { key: 'pink', label: '粉色', dot: '#e768a2' },
  { key: 'orange', label: '橙色', dot: '#e06b3c' },
  { key: 'purple', label: '紫色', dot: '#7c5cd6' },
  { key: 'black', label: '黑色', dot: '#1b1d21' },
  { key: 'gray', label: '灰色', dot: '#6b7280' }
]
const accentMeta = (key) => ACCENTS.find((a) => a.key === key) || ACCENTS[0]
function applyAccent() {
  const meta = accentMeta(state.accent)
  const key = meta.key === 'default' ? 'blue' : meta.key
  document.body.dataset.accent = key
  try { localStorage.setItem('jg.accent', key) } catch (e) {}
}

function accentPick() {
  const cur = accentMeta(state.accent)
  return `<div class="accent-wrap">
    <button class="accent-pick" id="accentPick" type="button"><i class="accent-dot" style="background:${cur.dot}"></i><span>${cur.label}</span><span class="ico">${icon('chevron')}</span></button>
    <div class="accent-menu" id="accentMenu" hidden>
      ${ACCENTS.map((a) => `<button class="accent-row" type="button" data-accent-set="${a.key}"><i class="accent-dot" style="background:${a.dot}"></i><span class="lbl">${a.label}</span><span class="accent-check">${a.key === state.accent ? icon('check') : ''}</span></button>`).join('')}
    </div>
  </div>`
}

function openAgentPresetEditor(preset = null) {
  const p = preset || { id: '', name: '', description: '', instructions: '', defaultPolicy: 'auto', defaultEffort: 'medium' }
  const mask = openModal(preset ? '编辑 Agent 预设' : '新建 Agent 预设', `
    <div class="set-copy" style="margin-bottom:14px">
      <div class="set-label">预设说明</div>
      <div class="set-desc">预设会在新会话中作为行为要求注入，并作为该会话的默认执行策略与推理强度。</div>
    </div>
    <div class="form-label">名称</div>
    <input id="apName" class="text-input" maxlength="40" value="${esc(p.name)}" placeholder="例如：规划方案审阅">
    <div class="form-label" style="margin-top:12px">一句话说明</div>
    <input id="apDesc" class="text-input" maxlength="200" value="${esc(p.description)}" placeholder="这个预设适合什么任务">
    <div style="display:flex;gap:12px;margin-top:12px">
      <div style="flex:1"><div class="form-label">默认执行策略</div>
        <select id="apPolicy" class="text-input"><option value="auto"${p.defaultPolicy !== 'manual' ? ' selected' : ''}>帮我批准</option><option value="manual"${p.defaultPolicy === 'manual' ? ' selected' : ''}>请求批准</option></select></div>
      <div style="flex:1"><div class="form-label">默认推理强度</div>
        <select id="apEffort" class="text-input"><option value="low"${p.defaultEffort === 'low' ? ' selected' : ''}>低</option><option value="medium"${p.defaultEffort === 'medium' ? ' selected' : ''}>中</option><option value="high"${p.defaultEffort === 'high' ? ' selected' : ''}>高</option></select></div>
    </div>
    <div class="form-label" style="margin-top:12px">行为要求</div>
    <textarea id="apInstr" class="text-input" rows="6" maxlength="8000" placeholder="描述这个 Agent 应当如何工作，例如：先阅读项目说明，再给出结论；所有输出使用中文。">${esc(p.instructions)}</textarea>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
      <button class="btn" data-apcancel>取消</button>
      <button class="btn primary" id="apSave">保存</button>
    </div>`, { wide: true, onMount: (m) => {
      m.querySelector('[data-apcancel]').addEventListener('click', () => m.remove())
      m.querySelector('#apSave').addEventListener('click', async () => {
        const name = m.querySelector('#apName').value.trim()
        if (!name) return toast('预设名称不能为空', true)
        const payload = {
          id: p.id || '',
          name,
          description: m.querySelector('#apDesc').value.trim(),
          instructions: m.querySelector('#apInstr').value.trim(),
          defaultPolicy: m.querySelector('#apPolicy').value,
          defaultEffort: m.querySelector('#apEffort').value,
        }
        const { ok, body } = await api('/api/agent-presets', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
        if (!ok) return toast(body.error || '预设保存失败', true)
        state.agentPresets = body.items || []
        if (state.agentPresetId && !state.agentPresets.some((x) => x.id === state.agentPresetId)) state.agentPresetId = ''
        m.remove()
        toast('Agent 预设已保存')
        renderView()
      })
    } })
  return mask
}

function runtimePluginRow(p, protectedIds) {
  const on = p.enabled && !p.condition
  const isProtected = protectedIds.includes(p.id)
  return `<div class="set-row" data-preset-key="${esc((p.id + ' ' + p.name).toLowerCase())}">
    <div class="set-copy">
      <div class="set-label">${esc(p.id)}${isProtected ? ' <span class="tag">核心</span>' : ''}</div>
      <div class="set-desc mono" style="word-break:break-all">${esc(p.name || '')}</div>
    </div>
    <div class="set-ctrl">
      <span class="tag" style="margin-right:8px">${on ? '已启用' : (p.condition ? '按条件' : '已停用')}</span>
      <button class="btn sm" data-rt-plugin="${esc(p.id)}" data-rt-enable="${on ? '0' : '1'}"${isProtected ? ' disabled' : ''}>${on ? '停用' : '启用'}</button>
    </div>
  </div>`
}

async function openRuntimePlugins() {
  const { ok, body } = await api('/api/runtime/plugins')
  if (!ok) return toast(body.error || '插件运行时读取失败', true)
  const plugins = body.plugins || []
  const protectedIds = body.protectedIds || []
  const mask = openModal('DSH 插件运行时', `
    <div class="set-copy" style="margin-bottom:10px">
      <div class="set-desc">profile <span class="mono">${esc(body.profile || 'sdk')}</span> · 来源 ${esc(body.source || '配置快照')} · ${plugins.length} 个条目。
      启停会写入 <span class="mono">cordis.patch.yml</span>，重启运行时后生效；核心条目不可停用。</div>
    </div>
    <input id="rtpQuery" class="text-input" placeholder="搜索条目 id 或模块名">
    <div id="rtpList" style="margin-top:10px;max-height:52vh;overflow:auto">${plugins.map((p) => runtimePluginRow(p, protectedIds)).join('')}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px">
      <button class="btn sm" data-rt-restart-in-modal>重启运行时</button>
    </div>`)
  const list = mask.querySelector('#rtpList')
  const paint = (q = '') => {
    const key = q.trim().toLowerCase()
    list.innerHTML = plugins
      .filter((p) => !key || `${p.id} ${p.name}`.toLowerCase().includes(key))
      .map((p) => runtimePluginRow(p, protectedIds)).join('') || '<div class="set-desc" style="padding:12px">没有匹配的条目</div>'
    list.querySelectorAll('[data-rt-plugin]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true
        const { ok: saved, body: result } = await api('/api/runtime/plugins', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: btn.dataset.rtPlugin, enabled: btn.dataset.rtEnable === '1' }),
        })
        if (!saved) { btn.disabled = false; return toast(result.error || '启停失败', true) }
        toast('已写入 profile patch：重启运行时后生效')
        mask.remove()
        openRuntimePlugins()
      })
    })
  }
  paint()
  mask.querySelector('#rtpQuery').addEventListener('input', (e) => paint(e.target.value))
  mask.querySelector('[data-rt-restart-in-modal]').addEventListener('click', async () => {
    const { ok: done, body: result } = await api('/api/runtime/restart', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
    toast(done ? '运行时已关闭，下次会话按新配置启动' : (result.error || '重启失败'), !done)
  })
}

function renderSettings(el) {
  const q = state.settingsQuery.trim()
  const tabs = q
    ? settingsTabs.filter((t) => `${t.label}${t.kw}`.includes(q))
    : settingsTabs
  const active = tabs.some((t) => t.id === state.settingsTab) ? state.settingsTab : (tabs[0]?.id || 'general')
  const body = settingsBody(active)

  const navGroups = ['个人', '安全与数据', '集成', '关于']
    .map((g) => {
      const items = tabs.filter((t) => t.group === g)
      if (!items.length) return ''
      return `<div class="set-nav-group">${g}</div>
        ${items.map((t) => `<button class="set-nav-item${t.id === active ? ' active' : ''}" data-set-tab="${t.id}">${t.label}</button>`).join('')}`
    }).join('')

  el.innerHTML = `
    <div class="settings-shell">
      <aside class="settings-side">
        <div class="settings-side-title">设置</div>
        <div class="settings-search">
          <span class="ico">${icon('search')}</span>
          <input id="setSearch" placeholder="搜索设置" value="${esc(state.settingsQuery)}">
        </div>
        <div class="settings-nav">${navGroups || '<div class="set-empty">无匹配设置项</div>'}</div>
      </aside>
      <div class="settings-main">
        <div class="settings-h1">${body.title}</div>
        ${body.groups.join('')}
      </div>
    </div>`

  el.querySelectorAll('[data-set-tab]').forEach((b) => {
    b.addEventListener('click', () => {
      state.settingsTab = b.dataset.setTab
      renderView()
    })
  })

  el.querySelector('[data-act="changePassword"]')?.addEventListener('click', openChangePassword)

  const unavailableSettings = new Set(['workspace', 'workspaceReset', 'reauth', 'devices', 'diag', 'applyAccess', 'export', 'archive', 'clearCache', 'testMcp', 'update', 'help'])
  el.querySelectorAll('[data-act]').forEach((b) => {
    if (!unavailableSettings.has(b.dataset.act)) return
    b.disabled = true
    b.style.opacity = '.45'
    b.style.cursor = 'not-allowed'
    b.title = '功能尚未接入'
  })

  const search = el.querySelector('#setSearch')
  search.addEventListener('input', (e) => {
    state.settingsQuery = e.target.value
    state.settingsTab = ''
    renderView()
    const next = document.getElementById('setSearch')
    if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length) }
  })

  const focusLabel = state.settingsFocus
  if (focusLabel) {
    state.settingsFocus = null
    const row = Array.from(el.querySelectorAll('.set-label'))
      .find((x) => x.textContent.trim() === focusLabel)?.closest('.set-row')
    if (row) {
      row.scrollIntoView({ block: 'center' })
      row.style.boxShadow = 'inset 0 0 0 2px var(--accent)'
      row.style.borderRadius = '10px'
      setTimeout(() => { row.style.boxShadow = ''; row.style.borderRadius = '' }, 1400)
    }
  }

  el.querySelector('[data-usage-refresh]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget
    button.disabled = true
    button.textContent = '刷新中…'
    const summary = await loadUsageSummary().catch(() => null)
    if (!summary) toast('用量汇总读取失败', true)
  })

  const mcpSearch = el.querySelector('#mcpSearch')
  if (mcpSearch) {
    mcpSearch.addEventListener('input', (e) => {
      state.mcpQuery = e.target.value
      renderView()
      const next = document.getElementById('mcpSearch')
      if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length) }
    })
  }

  el.querySelectorAll('[data-mcpuri]').forEach((b) => {
    b.addEventListener('click', async () => {
      const uri = b.dataset.mcpuri
      const resource = (state.mcpResources || []).find((r) => r.uri === uri)
      const { ok, body } = await api(`/api/mcp/resource?uri=${encodeURIComponent(uri)}`)
      if (!ok) return toast(body.error || 'MCP 资源读取失败', true)
      openModal(`MCP 资源 · ${resource?.name || uri}`, `
        <div class="set-desc" style="margin-bottom:10px">来源 <span class="mono">${esc(body.uri)}</span> · ${esc(body.mimeType || 'application/json')}</div>
        <div class="kv-box mono" style="max-height:52vh;overflow:auto;white-space:pre-wrap;word-break:break-word;font-size:var(--fs-micro);line-height:1.6">${esc(body.text || '')}</div>`, { width: 640 })
    })
  })

  const ap = el.querySelector('#accentPick')
  const am = el.querySelector('#accentMenu')
  if (ap && am) {
    ap.addEventListener('click', (e) => {
      e.stopPropagation()
      const willOpen = am.hidden
      am.hidden = !willOpen
      if (willOpen) {
        am.style.top = ''
        am.style.bottom = ''
        const r = ap.getBoundingClientRect()
        if (window.innerHeight - r.bottom < 380) am.style.top = 'auto', am.style.bottom = 'calc(100% + 8px)'
        setTimeout(() => {
          const close = (ev) => {
            if (am.contains(ev.target) || ap.contains(ev.target)) return
            am.hidden = true
            document.removeEventListener('click', close, true)
          }
          document.addEventListener('click', close, true)
        }, 0)
      }
    })
    el.querySelectorAll('[data-accent-set]').forEach((row) => {
      row.addEventListener('click', () => {
        state.accent = row.dataset.accentSet
        applyAccent()
        am.hidden = true
        renderView()
      })
    })
  }

  el.querySelector('[data-preset-new]')?.addEventListener('click', () => openAgentPresetEditor())
  el.querySelectorAll('[data-preset-edit]').forEach((btn) => btn.addEventListener('click', () => {
    const p = state.agentPresets.find((x) => x.id === btn.dataset.presetEdit)
    if (p) openAgentPresetEditor(p)
  }))
  el.querySelectorAll('[data-preset-del]').forEach((btn) => btn.addEventListener('click', async () => {
    const p = state.agentPresets.find((x) => x.id === btn.dataset.presetDel)
    if (!p) return
    const mask = openModal('删除 Agent 预设', `<div class="confirm-text">删除「${esc(p.name)}」？已使用该预设的历史会话不受影响。</div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px"><button class="btn" data-pdcancel>取消</button><button class="btn primary" data-pdok>删除</button></div>`)
    mask.querySelector('[data-pdcancel]').addEventListener('click', () => mask.remove())
    mask.querySelector('[data-pdok]').addEventListener('click', async () => {
      const { ok, body } = await api(`/api/agent-presets?id=${encodeURIComponent(p.id)}`, { method: 'DELETE' })
      if (!ok) return toast(body.error || '删除失败', true)
      state.agentPresets = body.items || []
      if (state.agentPresetId === p.id) state.agentPresetId = ''
      mask.remove()
      toast('Agent 预设已删除')
      renderView()
    })
  }))

  const rtCtl = ['rtPolicy', 'rtEffort', 'rtChanges'].map((id) => el.querySelector('#' + id)).filter(Boolean)
  rtCtl.forEach((ctl) => {
    ctl.addEventListener('change', async () => {
      if (!canAdmin()) return toast('仅管理员可修改运行时设置', true)
      const policyEl = el.querySelector('#rtPolicy')
      const effortEl = el.querySelector('#rtEffort')
      const changesEl = el.querySelector('#rtChanges')
      const effortLabel = effortEl ? effortEl.value : '中'
      const payload = {
        defaultPolicy: policyEl && policyEl.value === '请求批准' ? 'manual' : 'auto',
        defaultEffort: effortLabel === '高' ? 'high' : effortLabel === '低' ? 'low' : 'medium',
        workspaceChanges: changesEl ? changesEl.checked : true,
      }
      const { ok, body } = await api('/api/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!ok) return toast(body.error || '运行时设置保存失败', true)
      state.runtimeSettings = body.settings || payload
      if (state.boot) {
        state.boot.settings = body.settings || payload
        state.boot.runtime = body.runtime || state.boot.runtime
      }
      toast('运行时设置已保存：新会话生效')
      renderView()
    })
  })

  el.querySelectorAll('[data-act]').forEach((b) => {
    b.addEventListener('click', async () => {
      const act = b.dataset.act
      if (act === 'saveKey' || act === 'clearKey') {
        const input = el.querySelector('#set-key')
        const key = act === 'clearKey' ? '' : String(input?.value || '').trim()
        if (act === 'saveKey' && (!key || key.includes('•'))) return toast('请粘贴完整 API Key（当前显示的是掩码）', true)
        const cfg = state.modelCfg || {}
        const { ok, body } = await api('/api/model/config', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ provider: cfg.provider, endpoint: cfg.endpoint, defaultModel: cfg.defaultModel, key, clear: act === 'clearKey' }),
        })
        if (!ok) return toast(body.error || '密钥保存失败', true)
        state.modelCfg = body.config || cfg
        if (act === 'saveKey' && input) input.value = state.modelCfg.key || ''
        toast(act === 'saveKey' ? `个人密钥已保存到服务端凭证库（${state.modelCfg.key || '已保存'}）` : '已清除服务端保存的个人密钥')
        return
      }
      if (act === 'refreshRuntime') {
        await loadBoot()
        renderView()
        toast('运行时状态已刷新')
        return
      }
      if (act === 'runtimePlugins') {
        await openRuntimePlugins()
        return
      }
      if (act === 'runtimeRestart') {
        const { ok, body } = await api('/api/runtime/restart', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
        toast(ok ? '运行时已关闭，下次会话按新配置启动' : (body.error || '重启失败'), !ok)
        return
      }
      if (act === 'refreshMcp') {
        const mcp = await api('/api/mcp/resources')
        if (!mcp.ok) return toast(mcp.body.error || 'MCP 资源刷新失败', true)
        state.mcpResources = mcp.body.items || []
        state.mcpServer = mcp.body.server || state.mcpServer
        renderView()
        toast('MCP 资源目录已刷新')
        return
      }
      const map = {
        workspace: '工作区变更需在客户端选择目录，并由数据中心记录归属（演示）',
        workspaceReset: '已恢复为默认工作区（演示）',
        reauth: '已发起二次认证（演示）：认证结果写入审计',
        devices: '当前仅 1 台受信设备：Windows 10 · 内网地址段（演示）',
        diag: '诊断完成：模型连通 72 ms；数据中心接口 200；证书有效期至 2027-05（演示）',
        saveKey: '个人密钥已写入操作系统凭证库，界面仅保留掩码（演示）',
        clearKey: '已清除本机保存的个人密钥（演示）',
        applyAccess: '已提交授权申请：数据管理员审批，审批链与结果进审计（演示）',
        export: '导出需二次确认；涉密内容导出须审批并留痕（演示）',
        archive: '归档会话：按保留期自动迁移，可申请调阅（演示）',
        clearCache: '已清理本机缓存，业务数据不在客户端留存（演示）',
        testMcp: 'MCP 连接正常，工具 12 项；写操作需二次确认（演示）',
        update: '当前为内网最新版本；新版本随离线包分发（演示）',
        help: '内网文档站 help.jg.local；工单由本域运维受理（演示）',
      }
      if (act === 'moreConfig') {
        openMoreConfig()
        return
      }
      if (act === 'gotoSkills') {
        state.view = 'skills'
        render()
        return
      }
      toast(map[act] || '（演示）')
    })
  })
}


function settingsBody(tab) {
  const { user, counts, models } = state.boot
  const p = 'set-'

  if (tab === 'general') {
    return {
      title: '常规',
      groups: [
        sgroup('权限', [
          srow('默认工作区文件读写', '允许在工作区内读取与整理文件；访问工作区外目录需单次授权', sw(`${p}fs`, true)),
          srow('工具自动执行', '仅低风险只读工具可自动执行；写操作与高危调用始终二次确认', sw(`${p}auto`, false)),
          srow('互联网访问', '涉密内网环境不可开启；外发内容按数据级别策略控制', sw(`${p}web`, false, true)),
        ]),
        sgroup('常规', [
          srow('默认工作区', '会话与任务的默认落盘位置，仍受数据中心授权约束',
            `<span class="mono set-value">D:\\JGWorkspace\\${esc(user.unit)}</span><span class="set-btn-gap"></span>${sbtn('workspace', '更改')}${sbtn('workspaceReset', '重置')}`),
          srow('默认模型', '逻辑模型标识稳定，展示名与版本由平台统一维护',
            sel(`${p}model`, models.map((m) => m.label), state.composerModel === 'jg-enterprise' ? 'JG-Enterprise' : 'Qwen3.8-27B')),
          srow('界面语言', '界面文案语言，不改变数据内容的语言', sel(`${p}lang`, ['简体中文', '自动检测'], '简体中文')),
          srow('关闭窗口前确认', '使用关闭快捷键导致窗口关闭时给出提示', sel(`${p}close`, ['仅在使用关闭快捷键时', '总是确认', '从不确认'], '仅在使用关闭快捷键时')),
          srow('登录时启动应用', '开机后随系统登录自动启动客户端', sw(`${p}launch`, true)),
          srow('底部状态栏', '在客户端底部显示网络域、任务与连接状态', sw(`${p}status`, true)),
        ]),
      ],
    }
  }

  if (tab === 'appearance') {
    return {
      title: '个性化',
      groups: [
        sgroup('界面', [
          srow('主题', '企业规范以浅色为主，深色用于夜间与投屏场景', sel(`${p}theme`, ['浅色', '深色', '跟随系统'], '浅色')),
          srow('界面密度', '影响列表行高与卡片间距', sel(`${p}density`, ['标准', '紧凑'], '标准')),
          srow('正文字号', '仅影响会话与文档阅读区', sel(`${p}font`, ['标准', '较大'], '标准')),
          srow('侧栏默认展开', '启动时展开导航；窄窗口自动收起', sw(`${p}side`, true)),
        ]),
        sgroup('品牌', [
          srow('强调色', '用于选中态、链接与生成按钮；默认蓝色，可切换为绿、黄、粉、橙、紫、黑、灰', accentPick()),
          srow('客户端标识', '启动页与关于页展示的企业名称', '<span class="set-value">九江市规划设计集团</span>'),
        ]),
        sgroup('企业工作台', [
          srow('收起与置顶', '选择哪些企业模块收进图标栏的「更多」，AI 工作台不参与调整', sbtn('moreConfig', '整理')),
        ]),
      ],
    }
  }

  if (tab === 'notifications') {
    return {
      title: '通知',
      groups: [
        sgroup('提醒类型', [
          srow('任务完成提醒', '自动化任务与长任务结束、失败时提醒', sw(`${p}task`, true)),
          srow('审批与授权变更', '授权范围、应用审核、工单状态变化时提醒', sw(`${p}approve`, true)),
          srow('涉密访问被拒绝', '安全事件必达，不可关闭', sw(`${p}deny`, true, true)),
          srow('系统维护通知', '客户端与服务端维护窗口提前告知', sw(`${p}maint`, true)),
        ]),
        sgroup('投递', [
          srow('通知渠道', '站内消息为默认渠道，邮件需本域邮件服务已接入', sel(`${p}channel`, ['站内消息', '邮件', '两者'], '站内消息')),
          srow('免打扰时段', '该时段内仅保留安全事件提醒', sel(`${p}quiet`, ['不设置', '22:00—07:00', '自定义'], '22:00—07:00')),
        ]),
      ],
    }
  }

  if (tab === 'profile') {
    return {
      title: '个人资料',
      groups: [
        sgroup('身份', [
          srow('姓名', '', `<span class="set-value">${esc(user.name)}</span>`),
          srow('员工编码', '集团唯一编码，跨网一致；各网络独立认证', `<span class="set-value mono">JG-1901-0766</span>`),
          srow('所属单位', '', `<span class="set-value">${esc(user.org)} / ${esc(user.unit)}</span>`),
          srow('岗位', '一人多岗时以主岗展示，兼任关系在授权服务维护', `<span class="set-value">${esc(user.duty)}</span>`),
        ]),
        sgroup('安全', [
          srow('登录密码', '用于账号密码登录；首次登录必须修改初始密码', '<span class="tag ok">已设置</span><span class="set-btn-gap"></span>' + sbtn('changePassword', '修改密码')),
          srow('二次认证', '登录与高危操作需二次认证，认证记录进审计', '<span class="tag ok">已启用</span><span class="set-btn-gap"></span>' + sbtn('reauth', '重新认证')),
          srow('当前设备', 'Windows 10 · 客户端 1.0.0-mvp · 内网地址段', sbtn('devices', '查看全部设备')),
        ]),
      ],
    }
  }

  if (tab === 'network') {
    return {
      title: '网络与凭证',
      groups: [
        sgroup('网络', [
          srow('当前网络', '决定可用模型、数据源与工具集合', '<span class="tag secret">涉密内网</span>'),
          srow('涉密内网', '已连接，Qwen3.8-27B 本地推理与涉密数据源可用', '<span class="tag ok">已连接</span>'),
          srow('政务网', '独立实例，未在本机接入', '<span class="tag">未接入</span>'),
          srow('互联网', '隔离，未经批准不得跨网访问', '<span class="tag">隔离</span>'),
          srow('网络诊断', '检查模型连通性、数据中心接口与证书有效期', sbtn('diag', '运行诊断')),
        ]),
        sgroup('凭证', [
          srow('政务模型 Token', '由服务端持有，客户端不落盘、不展示', '<span class="set-value">服务端托管</span>'),
          srow('操作系统凭证库', '个人密钥存入系统受保护存储，不以明文出现在配置与日志', sw(`${p}keychain`, true)),
          srow('会话有效期', '超过时限需重新认证，长任务由服务端续跑', sel(`${p}session`, ['8 小时', '4 小时', '1 小时'], '8 小时')),
        ]),
      ],
    }
  }

  if (tab === 'models') {
    return {
      title: '模型与密钥',
      groups: [
        sgroup('可用模型', [
          srow('企业统一模型', '逻辑 ID jg-enterprise；展示名与版本由平台维护', '<span class="tag ok">可用</span>'),
          srow('内网推理模型', 'Qwen3.8-27B · 本地推理 · 量化格式待实测确认', '<span class="tag ok">可用</span>'),
          srow('政务模型', '九江统一政务模型；Token 服务端持有，按配额计量', '<span class="tag">本网不可用</span>'),
        ]),
        sgroup('个人密钥', [
          srow('个人 API Key', '仅互联网环境使用；涉密内容禁止经个人密钥外发',
            `<input class="mini-input mono" id="${p}key" value="${esc(state.modelCfg?.key || 'sk-••••••••••••4f2a')}" placeholder="粘贴完整 API Key"><span class="set-btn-gap"></span>${sbtn('saveKey', '保存到凭证库')}${sbtn('clearKey', '清除')}`),
          srow('数据外发策略', '决定个人模型可接触的数据级别', sel(`${p}egress`, ['禁止涉密与敏感内容外发', '仅内部级可外发', '按单次审批'], '禁止涉密与敏感内容外发')),
        ]),
      ],
    }
  }

  if (tab === 'access') {
    return {
      title: '授权范围',
      groups: [
        sgroup('当前身份', [
          srow('角色', '由组织与岗位决定，个人不可自行变更', `<span class="set-value">${esc(user.label)}</span>`),
          srow('可见资源', '服务端按密级与组织范围计算，前端隐藏不作为安全边界', `<span class="set-value mono">${counts.resources} / ${counts.resourcesTotal}</span>`),
          srow('可用入口', '', `<span class="set-value mono">${user.visibleModules.length} 个</span>`),
        ]),
        sgroup('范围', [
          srow('授权范围', '', `<div class="scope-chips">${user.scopes.map((s) => `<span class="scope">${esc(s)}</span>`).join('')}</div>`),
          srow('说明', '', `<span class="set-desc" style="display:block;max-width:420px">${esc(user.note)}</span>`),
          srow('申请额外授权', '提交后由数据管理员审批，审批链与结果进审计', sbtn('applyAccess', '发起申请')),
        ]),
      ],
    }
  }

  if (tab === 'data') {
    return {
      title: '数据管理',
      groups: [
        sgroup('会话与任务', [
          srow('会话保留期', '服务端保留会话与结果的期限，到期归档', sel(`${p}retain`, ['180 天', '90 天', '30 天', '长期保留（需审批）'], '180 天')),
          srow('导出会话', '导出为 Markdown 或 JSON；涉密内容导出需审批并留痕', sbtn('export', '导出')),
          srow('归档会话', '查看已归档会话与任务记录', sbtn('archive', '查看归档')),
        ]),
        sgroup('本机', [
          srow('本地缓存', '仅缓存界面资源与会话索引；业务数据不在客户端留存', sbtn('clearCache', '清理缓存')),
          srow('离线可用', '缓存最近会话与文档摘要，断网时可读不可写', sw(`${p}offline`, true)),
        ]),
      ],
    }
  }

  if (tab === 'runtime') {
    const rs = state.runtimeSettings || {}
    const rt = state.boot?.runtime || {}
    const nt = rt.native || {}
    const canEditRt = canAdmin()
    const when = (v) => {
      if (!v) return '—'
      const d = new Date(v)
      return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString('zh-CN', { hour12: false })
    }
    const nativeTag = (v) => `<span class="tag${v === '已挂载' ? ' ok' : ''}">${esc(v || '未挂载')}</span>`
    const policyText = rs.defaultPolicy === 'manual' ? '请求批准 · 外部操作始终询问' : '帮我批准 · 仅风险操作询问'
    const effortText = rs.defaultEffort === 'high' ? '高' : rs.defaultEffort === 'low' ? '低' : '中'
    return {
      title: 'Agent 运行时',
      groups: [
        sgroup('新会话默认值', [
          srow('默认执行策略', '只影响新开的会话；当前会话可在输入框内单独切换',
            canEditRt ? sel('rtPolicy', ['帮我批准', '请求批准'], rs.defaultPolicy === 'manual' ? '请求批准' : '帮我批准') : `<span class="set-value">${esc(policyText)}</span>`),
          srow('默认推理强度', '只影响新开的会话；低/中/高映射到模型实际支持的强度档',
            canEditRt ? sel('rtEffort', ['低', '中', '高'], effortText) : `<span class="set-value">${esc(effortText)}</span>`),
          srow('每轮文件变更摘要', '执行前后对项目目录做只读快照并列出新增/修改/删除；关闭后不再生成该块',
            canEditRt ? sw('rtChanges', rs.workspaceChanges !== false) : `<span class="set-value">${rs.workspaceChanges !== false ? '已开启' : '已关闭'}</span>`),
        ]),
        sgroup('运行时状态', [
          srow('DSH 版本', '当前锁定并实际加载的 DeepSeek Harness 版本', `<span class="set-value mono">${esc(rt.dshVersion || '0.2.2-rc.1')}</span>`),
          srow('加载 profile', 'SDK 运行时使用的 profile 名称', `<span class="set-value mono">${esc(rt.profile || 'sdk')}</span>`),
          srow('配置条目', '当前 profile dump 中的插件条目总数', `<span class="set-value mono">${Number(rt.configEntries || 0)} 条</span>`),
          srow('活跃运行时', '当前进程内已持有沙箱根运行时的数量', `<span class="set-value mono">${Number(rt.activeRuns || 0)} 个</span>`),
          srow('会话', '事务库中的会话总数与仍在运行的数量', `<span class="set-value mono">${Number(rt.sessions || 0)} 个 · 运行中 ${Number(rt.running || 0)} 个</span>`),
          srow('状态刷新', '重新读取本机运行时与配置快照', sbtn('refreshRuntime', '刷新')),
        ]),
        sgroup('配置与日志位置', [
          srow('Profile patch', '设置写入平台快照；此文件为 DSH 当前 profile 的叠加配置',
            `<span class="mono set-value" style="display:block;max-width:460px;word-break:break-all">${esc(rt.configPath || '—')}</span><span class="set-desc" style="display:block;margin-top:4px">最后修改：${esc(when(rt.configUpdatedAt))}</span>`),
          srow('配置快照', '能力盘点所用的实际挂载配置，只读',
            `<span class="mono set-value" style="display:block;max-width:460px;word-break:break-all">${esc(rt.dumpPath || '—')}</span><span class="set-desc" style="display:block;margin-top:4px">生成时间：${esc(when(rt.dumpUpdatedAt))}</span>`),
          srow('会话日志', 'DSH 原始会话日志目录，由运行时写入，平台只读索引',
            `<span class="mono set-value" style="display:block;max-width:460px;word-break:break-all">${esc(rt.sessionsPath || '—')}</span>`),
        ]),
        sgroup('DSH 原生设置（只读）', [
          srow('配置权威', '产品设置中心是唯一可写入口；DSH 原生设置仅供运行时使用，不向用户提供编辑表单，避免两套配置源互相覆盖',
            '<span class="tag ok">产品设置优先</span>'),
          srow('原生 settings', '运行时插件，负责 schema 表单与配置投影；产品只读状态，不写入', nativeTag(nt.settings)),
          srow('原生 config-editor', 'DSH 自带的配置编辑入口；产品不暴露，避免绕过产品设置', nativeTag(nt.configEditor)),
          srow('原生 authorization', '运行时授权插件；审批策略仍以产品设置与输入框切换为准', nativeTag(nt.authorization)),
          srow('原生会话检索', '通过 dsh-tool-session-query 让模型检索并读取当前工作区的历史会话；产品不另建索引', nativeTag(nt.sessionSearch)),
          srow('会话导出', '产品按真实消息记录导出 Markdown；DSH 原生会话日志继续由运行时保存', `<span class="tag ok">${esc(nt.sessionExport || '可用')}</span>`),
          srow('凭据文件', 'DSH 本地凭据文件；产品不读取内容，也不允许从这里取模型密钥',
            `${nativeTag(nt.credentials)}<span class="set-desc" style="display:block;margin-top:4px">${nt.credentialsPresent ? '文件存在 · 内容不展示' : '文件未生成'}${nt.credentialsUpdatedAt ? ' · 更新于 ' + esc(when(nt.credentialsUpdatedAt)) : ''}</span>`),
          srow('模型密钥来源', '模型密钥由产品「模型与密钥」保存，按会话注入子进程环境；不走 DSH 原生凭据',
            `<span class="set-value">${esc(nt.modelKeySource || '产品设置中心 → 子进程环境')}</span>`),
        ]),
        sgroup('PTC 与实验执行器', [
          srow('workflow-ptc', '工作流内的程序化调用已挂载，可供工作流使用', nativeTag(nt.workflowPtc)),
          srow('直接 tool-executor-ptc', '默认关闭：会改变模型调用工具的协议，并使嵌套工具调用难以逐步确认；启用前需单独回归审批与步骤展示', nativeTag(nt.toolExecutorPtc)),
        ]),
        sgroup('技能目录（只读）', [
          srow('目录技能', `DSH 实际加载的目录技能：${(nt.skills || []).join('、') || '无'}`, nativeTag((nt.skills || []).length ? '已挂载' : '未挂载')),
          srow('Office 技能', '通过 skill-office 插件加载，不在 skills 目录中', nativeTag(nt.officeSkill)),
          srow('技能根目录', nt.skillsDir || '—', '只读'),
        ]),
        sgroup('会话检查点（只读）', [
          srow('检查点策略', '模型请求、顶层工具调用前做语义持久化；保证会话可恢复，不是文件内容备份', nativeTag(nt.checkpointPolicy)),
          srow('文件回滚', '当前只记录文件大小与修改时间，不能还原文件内容；产品侧回滚入口未提供', nativeTag(nt.fileRollback)),
        ]),
        sgroup('DSH 插件运行时', [
          srow('插件条目', '查看当前 profile 的真实挂载清单，启停单个条目；写入 cordis.patch.yml，重启运行时后生效，核心组件受保护',
            `${sbtn('runtimePlugins', '管理')}<span class="set-btn-gap"></span>${sbtn('runtimeRestart', '重启运行时')}`),
        ]),
        sgroup('Agent 预设', [
          srow('预设', '保存常用 Agent 的行为要求、默认策略与推理强度；在输入框「＋ → Agent 预设」中选择，只影响新会话',
            `<button class="btn sm" data-preset-new>新建预设</button>`),
          ...(state.agentPresets.length ? state.agentPresets.map((p) => srow(
            `${esc(p.name)}${state.agentPresetId === p.id ? ' <span class="tag" style="margin-left:6px">当前</span>' : ''}`,
            `${esc(p.description || '未填写说明')} · ${p.defaultPolicy === 'manual' ? '请求批准' : '帮我批准'} · ${p.defaultEffort === 'high' ? '高' : p.defaultEffort === 'low' ? '低' : '中'}`,
            `<button class="btn sm" data-preset-edit="${esc(p.id)}">编辑</button> <button class="btn sm" data-preset-del="${esc(p.id)}">删除</button>`,
          )) : [srow('还没有预设', '新建后可在输入框「＋ → Agent 预设」中选择', '<span class="set-value">—</span>')]),
        ]),
      ],
    }
  }

  if (tab === 'mcp') {
    const server = state.mcpServer || { name: 'jg', transport: 'stdio', status: 'connected', tools: 10 }
    const q = String(state.mcpQuery || '').trim().toLowerCase()
    const items = (state.mcpResources || []).filter((r) => (q ? `${r.name}${r.description}${r.uri}${r.type}`.toLowerCase().includes(q) : true))
    return {
      title: 'MCP 资源',
      groups: [
        sgroup('服务状态', [
          srow('MCP 服务', '本域产品工具以 stdio 接入 Harness，资源目录与工具共用同一身份',
            `<span class="tag ok">${esc(server.status === 'connected' ? '已连接' : server.status)}</span><span class="set-btn-gap"></span><span class="set-value mono">${esc(server.transport || 'stdio')}</span>`),
          srow('服务名与命名空间', '模型侧工具名形如 mcp__jg__drive_search，资源按 jg:// 寻址',
            `<span class="set-value mono">${esc(server.name || 'jg')}</span>`),
          srow('能力', '工具列表、资源列表、资源模板与资源读取均已声明',
            `<span class="set-value mono">tools ${Number(server.tools || 10)} · resources ${Number((state.mcpResources || []).length)}</span>`),
          srow('订阅', '当前服务未声明资源变更订阅，页面按手动刷新读取', '<span class="tag">未启用</span>'),
        ]),
        sgroup('资源目录', [
          srow('资源检索', '按名称、说明、类型或 URI 过滤当前身份可见的资源',
            `<input class="mini-input" id="mcpSearch" placeholder="搜索 MCP 资源" value="${esc(state.mcpQuery || '')}"><span class="set-btn-gap"></span>${sbtn('refreshMcp', '刷新')}`),
          ...(items.length ? items.map((r) => srow(
            `<span class="tag">${esc(r.type || '资源')}</span> ${esc(r.name)}`,
            `${esc(r.description || '')}<br><span class="mono" style="font-size:var(--fs-micro);word-break:break-all">${esc(r.uri)}</span>`,
            `<button class="btn sm" data-mcpuri="${esc(r.uri)}">读取</button>`
          )) : [srow('没有匹配资源', '调整关键词，或确认当前身份是否有该资源的查看权限', '<span class="set-value">—</span>')]),
        ]),
      ],
    }
  }

  if (tab === 'integrations') {
    return {
      title: '插件与工具',
      groups: [
        sgroup('已启用', [
          srow('运行时技能', '技能按账号或项目安装；平台公共能力由管理中心统一配置', `<span class="set-value mono">${counts.plugins || 0} 项</span><span class="set-btn-gap"></span>${sbtn('gotoSkills', '查看')}`),
          srow('个人技能', '仅本人可用；发布给他人需走企业技能审核', `<span class="set-value mono">${state.plugins.filter((p0) => p0.kind === 'personal').length} 个</span><span class="set-btn-gap"></span>${sbtn('gotoSkills', '管理')}`),
        ]),
        sgroup('MCP 与接口', [
          srow('MCP 服务地址', '本域工具服务，连接前校验证书与授权范围',
            `<input class="mini-input mono" id="${p}mcp" value="mcp://intranet.jg.local/tools" readonly><span class="set-btn-gap"></span>${sbtn('testMcp', '连接测试')}`),
          srow('写操作确认', 'MCP 工具的写操作默认二次确认，不可全局关闭', '<span class="set-value">强制开启</span>'),
        ]),
      ],
    }
  }

  if (tab === 'usage') {
    const summary = state.usageSummary
    const totals = summary?.totals || {}
    const fmt = (n) => Number(n || 0).toLocaleString('zh-CN')
    const coverage = summary?.coverage || {}
    const records = (summary?.records || []).slice(0, 8)
    return {
      title: 'Token 用量',
      groups: [
        sgroup('真实计量', [
          srow('累计 tokens', '来自每轮 DSH 返回的 usage；没有 usage 的轮次不计入', `<span class="set-value mono">${summary ? fmt(totals.totalTokens) : '读取中…'}</span>`),
          srow('输入 / 输出', '输入 = 上下文与提示词；输出 = 模型生成', `<span class="set-value mono">${fmt(totals.inputTokens)} / ${fmt(totals.outputTokens)}</span>`),
          srow('模型调用次数', '按真实 usage.calls 汇总，不是前端点击次数', `<span class="set-value mono">${fmt(totals.requests)}</span>`),
          srow('缓存读 / 写', '缓存命中与写入分别计量', `<span class="set-value mono">${fmt(totals.cacheReadTokens)} / ${fmt(totals.cacheWriteTokens)}</span>`),
          srow('推理 tokens', '仅统计上游返回的 reasoning_tokens', `<span class="set-value mono">${fmt(totals.reasoningTokens)}</span>`),
          srow('采集覆盖', '只统计已落库的真实计量，不用估算值补齐', `<span class="set-value mono">${coverage.usageMessages || 0} / ${coverage.assistantMessages || 0} 条助手消息</span><span class="set-btn-gap"></span><button class="btn sm" data-usage-refresh>刷新</button>`),
        ]),
        sgroup('按模型', (summary?.models || []).length
          ? summary.models.map((m) => srow(m.model, `${fmt(m.requests)} 次调用 · 输入 ${fmt(m.inputTokens)} / 输出 ${fmt(m.outputTokens)}`, `<span class="set-value mono">${fmt(m.totalTokens)} tokens</span>`))
          : [srow('暂无真实模型用量', '发起一次模型对话后，这里会出现按模型的真实统计', '<span class="set-value">—</span>')]),
        sgroup('最近计量', records.length
          ? records.map((r) => srow(`${r.conversationTitle}${r.time ? ` · ${r.time}` : ''}`, `${r.model} · ${r.calls} 次调用${r.at ? ` · ${r.at.slice(0, 16).replace('T', ' ')}` : ''}`, `<span class="set-value mono">${fmt(r.totalTokens)} tokens</span>`))
          : [srow('暂无计量记录', '当前账号还没有带 usage 的模型轮次', '<span class="set-value">—</span>')]),
        sgroup('口径', [
          srow('数据来源', '本机会话库中的助手消息 usageAt / usage 字段，刷新后从服务端重新聚合', '<span class="set-value">会话持久化</span>'),
          srow('不计入项', '历史轮次未返回 usage 的部分、失败且无 usage 的请求、客户端本地估算', '<span class="set-value">不估算</span>'),
        ]),
      ],
    }
  }

  return {
    title: '关于',
    groups: [
      sgroup('版本', [
        srow('客户端版本', 'Windows 客户端，随内网离线包分发', '<span class="set-value mono">1.0.0-mvp</span>'),
        srow('运行时基线', 'DeepSeek Harness，锁定版本并按季度吸收上游补丁', '<span class="set-value mono">0.2.2-rc.1</span>'),
        srow('更新通道', '内网离线包，更新前完成回归与签名校验', sbtn('update', '检查更新')),
      ]),
      sgroup('帮助', [
        srow('帮助与反馈', '内网文档站与工单由本域运维受理', sbtn('help', '打开帮助')),
        srow('许可与合规', '使用范围受集团信息安全制度与数据分级约束', '<span class="set-value">内部文档</span>'),
      ]),
    ],
  }
}


/* ------------------------- 登录 / 登出 / 授权（恢复） ------------------------- */

const LOGIN_REMEMBER_KEY = 'jg.login.remember'
const LOGIN_ACCOUNT_KEY = 'jg.login.account'
const LOGIN_USERNAME_KEY = 'jg.login.username'
const LOGIN_PASSWORD_KEY = 'jg.login.password'

function savedLogin() {
  try {
    return {
      username: localStorage.getItem(LOGIN_USERNAME_KEY) || '',
      accountId: localStorage.getItem(LOGIN_ACCOUNT_KEY) || '',
      password: localStorage.getItem(LOGIN_PASSWORD_KEY) || '',
      remember: localStorage.getItem(LOGIN_REMEMBER_KEY) === '1',
    }
  } catch (e) {
    return { username: '', accountId: '', password: '', remember: false }
  }
}

function persistLogin(username, password, remember, accountId = '') {
  try {
    if (!remember) {
      localStorage.removeItem(LOGIN_REMEMBER_KEY)
      localStorage.removeItem(LOGIN_ACCOUNT_KEY)
      localStorage.removeItem(LOGIN_USERNAME_KEY)
      localStorage.removeItem(LOGIN_PASSWORD_KEY)
      return
    }
    localStorage.setItem(LOGIN_REMEMBER_KEY, '1')
    localStorage.setItem(LOGIN_ACCOUNT_KEY, accountId || '')
    localStorage.setItem(LOGIN_USERNAME_KEY, username || '')
    localStorage.setItem(LOGIN_PASSWORD_KEY, password || '')
  } catch (e) {}
}

function updateSavedLoginPassword(accountId, password) {
  try {
    if (localStorage.getItem(LOGIN_REMEMBER_KEY) !== '1') return
    if (localStorage.getItem(LOGIN_ACCOUNT_KEY) !== String(accountId || '')) return
    localStorage.setItem(LOGIN_PASSWORD_KEY, password || '')
  } catch (e) {}
}

function loginError(message) {
  const box = document.querySelector('#loginError')
  if (box) {
    box.textContent = message
    box.hidden = false
  } else {
    toast(message, true)
  }
}

function setLoginChrome(on) {
  document.body.classList.toggle('login-mode', !!on)
  for (const sel of ['#railbar', '#sidebar', '.menubar', '.topbar', '#cloudpanel']) {
    const node = document.querySelector(sel)
    if (!node) continue
    if (on) node.style.setProperty('display', 'none', 'important')
    else node.style.removeProperty('display')
  }
  const view = document.getElementById('view')
  const app = document.querySelector('.app')
  const main = document.querySelector('.main')
  if (on) {
    if (app) app.style.setProperty('grid-template-columns', '1fr', 'important')
    if (main) {
      main.style.setProperty('width', '100vw', 'important')
      main.style.setProperty('max-width', 'none', 'important')
      main.style.setProperty('margin', '0', 'important')
      main.style.setProperty('grid-column', '1 / -1', 'important')
    }
  } else {
    if (app) app.style.removeProperty('grid-template-columns')
    if (main) {
      main.style.removeProperty('width')
      main.style.removeProperty('max-width')
      main.style.removeProperty('margin')
      main.style.removeProperty('grid-column')
    }
  }
  if (view) {
    if (on) {
      view.style.setProperty('padding', '0', 'important')
      view.style.setProperty('width', '100vw', 'important')
      view.style.setProperty('height', '100vh', 'important')
      view.style.setProperty('overflow', 'auto', 'important')
    } else {
      view.style.removeProperty('padding')
      view.style.removeProperty('width')
      view.style.removeProperty('height')
      view.style.removeProperty('overflow')
    }
  }
}

async function loadLoginCaptcha(el, clearAnswer = true) {
  const seq = (state.loginCaptchaSeq || 0) + 1
  state.loginCaptchaSeq = seq
  const box = el.querySelector('#loginCaptchaQuestion')
  if (box) box.textContent = '加载中…'
  state.loginCaptcha = null
  const res = await api('/api/captcha')
  if (seq !== state.loginCaptchaSeq) return
  if (!res.ok || !res.body.captchaId) {
    if (box) box.textContent = '验证码加载失败，请点「换一个」重试'
    return
  }
  state.loginCaptcha = res.body
  if (box) box.textContent = res.body.question || '验证码'
  if (clearAnswer) {
    state.loginCaptchaAnswerDraft = ''
    const input = el.querySelector('#loginCaptcha')
    if (input) input.value = ''
  }
}

function loginEyeSvg(visible) {
  return visible
    ? `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17.2 17.2 0 0 1-3.2 4.1"/><path d="M6.3 6.4C3.9 8 2 12 2 12s3.5 7 10 7c1.6 0 3-.4 4.3-1.1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>`
    : `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>`
}

function loginCloseButton() {
  return `<button type="button" id="loginClose" class="login-close-btn" aria-label="关闭客户端" title="关闭客户端" style="position:fixed;top:14px;right:18px;z-index:10;height:32px;padding:0 10px;display:inline-flex;align-items:center;gap:5px;border:1px solid #7d8590;background:transparent;color:#2f353c;border-radius:8px;box-shadow:none;font-size:12px;font-weight:500;cursor:pointer"><span class="ico" style="width:14px;height:14px">${icon('close')}</span><span>关闭</span></button>`
}

function bindLoginClose(el) {
  el.querySelector('#loginClose')?.addEventListener('click', () => {
    if (window.jgClient?.close) return window.jgClient.close()
    window.close()
  })
}

function renderLogin(el) {
  setLoginChrome(true)
  const netId = state.loginNet || (state.boot.network && state.boot.network.id) || 'inet'
  const saved = savedLogin()
  const savedAccount = (state.boot.allRoles || []).find((r) => (saved.accountId && r.id === saved.accountId) || (saved.username && String(r.username || '').toLowerCase() === saved.username.toLowerCase()))
  const remember = state.loginRemember !== undefined ? state.loginRemember : saved.remember
  const username = state.loginUsername !== undefined
    ? state.loginUsername
    : (saved.username || (savedAccount && savedAccount.username) || '')
  const password = state.loginPasswordDraft !== undefined
    ? state.loginPasswordDraft
    : ((saved.username && username.toLowerCase() === saved.username.toLowerCase()) || (saved.accountId && savedAccount && savedAccount.id === saved.accountId) ? saved.password : '')
  const captcha = state.loginCaptcha
  const captchaAnswer = state.loginCaptchaAnswerDraft !== undefined ? state.loginCaptchaAnswerDraft : ''
  const nets = state.boot.allNetworks || []
  const netDesc = { inet: '统一模型与获准个人模型', gov: '政务网专用模型，数据不出网', secret: '涉密内网，物理隔离环境' }
  const fieldStyle = 'width:100%!important;max-width:100%!important;box-sizing:border-box;height:40px;margin-top:8px;padding:0 12px;border:1px solid var(--line);border-radius:8px;background:#fff;font-size:var(--fs-sub);outline:none'
  el.innerHTML = `
    <style>
      .login-page{height:100vh;min-height:100vh;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);background:#f7f8fa}
      .login-brandpane{background:#f1f3f5;border-right:1px solid #e4e7eb;display:flex;align-items:center;justify-content:center;padding:40px 32px}
      .login-brandinner{width:100%;max-width:400px}
      .login-mark{display:block;width:48px;height:48px;object-fit:contain;margin-bottom:18px}
      .login-formpane{background:#fff;display:flex;align-items:center;justify-content:center;padding:36px 28px;overflow:auto}
      .login-form{position:relative;width:100%;max-width:520px}
      .login-pwd-toggle{position:absolute;right:4px;top:50%;transform:translateY(-50%);width:34px;height:34px;display:grid;place-items:center;border:0;background:transparent;color:#8b929c;border-radius:7px;cursor:pointer;padding:0}
      .login-pwd-toggle:hover{color:var(--accent);background:#f1f5fb}
      .login-form-title{font-size:22px;font-weight:600;color:#1b1d21;letter-spacing:-.2px}
      .login-form-sub{font-size:var(--fs-meta);color:var(--muted);margin-top:4px}
      .login-nets-vertical{display:flex;flex-direction:column;gap:8px;margin-top:10px}
      .login-nets-vertical .login-net{display:block;width:100%;border:1px solid transparent;border-bottom:1px solid #dfe3e8;border-radius:8px;background:transparent;padding:12px 12px 12px 14px;text-align:left;cursor:pointer}
      .login-nets-vertical .login-net b{display:block;font-size:var(--fs-sub);color:#1b1d21}
      .login-nets-vertical .login-net span{display:block;margin-top:3px;font-size:var(--fs-micro);color:var(--muted);line-height:1.45}
      .login-nets-vertical .login-net.on{background:#fff;border:1px solid var(--accent);box-shadow:inset 3px 0 0 var(--accent)}
      .login-side-note{margin-top:18px;padding-top:14px;border-top:1px solid #e1e5e9;font-size:var(--fs-micro);line-height:1.6;color:var(--muted)}
      @media (max-width:900px){
        .login-page{grid-template-columns:1fr;height:auto;min-height:100vh}
        .login-brandpane{border-right:0;border-bottom:1px solid #e4e7eb;padding:26px 22px;align-items:flex-start}
        .login-brandinner{max-width:none}
        .login-mark{width:38px;height:38px;margin-bottom:12px}
        .login-formpane{padding:24px 22px;align-items:flex-start}
        .login-form{max-width:520px}
        .login-brand{font-size:20px}
        .login-form-title{font-size:20px}
      }
    </style>
    <div class="login-page">
      <aside class="login-brandpane">
        <div class="login-brandinner">
          <img src="./logo.png?v=2" alt="" class="login-mark">
          <div class="login-brand">九规智能中枢</div>
          <div class="login-sub">九江市规划设计集团 · 企业级 AI 中枢</div>
          <div class="login-section">安全域</div>
          <div class="login-nets-vertical">
            ${nets.map((n) => `<button class="login-net ${n.id === netId ? 'on' : ''}" data-lnet="${esc(n.id)}"><b>${esc(n.label)}</b><span>${esc(netDesc[n.id] || '按本网授权口径')}</span></button>`).join('')}
          </div>
          <div class="login-side-note">先选安全域、再输入用户名；登录后只下发本域的模型、工具与资源目录。</div>
        </div>
      </aside>
      <main class="login-formpane">
        <div class="login-form">
          ${loginCloseButton()}
          <div class="login-form-title">登录</div>
          <div class="login-form-sub">使用姓名全拼或已绑定手机号进入</div>
          <div class="login-section">用户名</div>
          <input id="loginUsername" class="mini-input" type="text" autocomplete="username" placeholder="姓名全拼，如 mile" value="${esc(username)}" style="${fieldStyle}">
          <div class="login-note" style="margin-top:6px">用户名为姓名全拼，不区分大小写；后续支持绑定手机号登录。</div>
          <div class="login-section">密码</div>
          <div style="position:relative;margin-top:8px">
            <input id="loginPassword" class="mini-input" type="password" autocomplete="current-password" placeholder="请输入登录密码" value="${esc(password)}" style="${fieldStyle};margin-top:0;padding-right:46px">
            <button class="login-pwd-toggle" type="button" id="loginPwdToggle" aria-label="显示密码" title="显示密码" aria-pressed="false">${loginEyeSvg(false)}</button>
          </div>
          <div class="login-section">验证码</div>
          <div style="display:flex;align-items:center;gap:10px;margin-top:8px;min-height:38px">
            <span id="loginCaptchaQuestion" style="flex:1;font-size:var(--fs-sub);color:var(--text-2);letter-spacing:.2px">${captcha ? esc(captcha.question) : '加载中…'}</span>
            <button class="btn sm" type="button" id="loginCaptchaRefresh" style="flex:none">换一个</button>
          </div>
          <input id="loginCaptcha" class="mini-input" type="text" inputmode="numeric" autocomplete="off" placeholder="填写计算结果" value="${esc(captchaAnswer)}" style="${fieldStyle}">
          <label style="margin-top:12px;display:flex;align-items:center;gap:8px;font-size:var(--fs-meta);color:var(--text-2);cursor:pointer">
            <input id="loginRemember" type="checkbox" ${remember ? 'checked' : ''} style="width:14px;height:14px;margin:0;accent-color:var(--accent)">
            记住账号和密码
          </label>
          <div id="loginError" class="login-note" style="color:#b42318;margin-top:8px" hidden></div>
          <div class="login-note" style="margin-top:10px">新账号初始密码：姓名全拼@123（首字母大写），首次登录后必须修改；已有正式密码的账号请直接使用正式密码。记住密码保存在本机浏览器。</div>
          <button class="btn primary login-go" id="loginGo" style="width:100%;margin-top:14px">进入 九规智能中枢</button>
          <div class="login-foot">登录后只下发本域的模型、工具与资源目录</div>
        </div>
      </main>
    </div>`
  el.querySelectorAll('[data-lnet]').forEach((b) => b.addEventListener('click', () => {
    state.loginUsername = el.querySelector('#loginUsername')?.value || ''
    state.loginPasswordDraft = el.querySelector('#loginPassword')?.value || ''
    state.loginCaptchaAnswerDraft = el.querySelector('#loginCaptcha')?.value || ''
    state.loginRemember = !!el.querySelector('#loginRemember')?.checked
    state.loginNet = b.dataset.lnet
    renderLogin(el)
  }))
  const usernameInput = el.querySelector('#loginUsername')
  if (usernameInput) {
    usernameInput.addEventListener('input', () => {
      const nextName = usernameInput.value.trim().toLowerCase()
      const savedName = (saved.username || (savedAccount && savedAccount.username) || '').toLowerCase()
      if (nextName && savedName && nextName !== savedName) {
        state.loginPasswordDraft = ''
        const passwordField = el.querySelector('#loginPassword')
        if (passwordField) passwordField.value = ''
      }
      state.loginUsername = usernameInput.value
    })
    usernameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') el.querySelector('#loginPassword')?.focus() })
  }
  const pwd = el.querySelector('#loginPassword')
  if (pwd) {
    pwd.addEventListener('input', () => { state.loginPasswordDraft = pwd.value })
    pwd.addEventListener('keydown', (e) => { if (e.key === 'Enter') el.querySelector('#loginCaptcha')?.focus() })
  }
  const pwdToggle = el.querySelector('#loginPwdToggle')
  if (pwd && pwdToggle) pwdToggle.addEventListener('click', () => {
    const visible = pwd.type === 'password'
    pwd.type = visible ? 'text' : 'password'
    pwdToggle.innerHTML = loginEyeSvg(visible)
    pwdToggle.setAttribute('aria-label', visible ? '隐藏密码' : '显示密码')
    pwdToggle.title = visible ? '隐藏密码' : '显示密码'
    pwdToggle.setAttribute('aria-pressed', visible ? 'true' : 'false')
    pwd.focus()
  })
  const captchaInput = el.querySelector('#loginCaptcha')
  if (captchaInput) {
    captchaInput.addEventListener('input', () => { state.loginCaptchaAnswerDraft = captchaInput.value })
    captchaInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') el.querySelector('#loginGo')?.click() })
  }
  const rememberInput = el.querySelector('#loginRemember')
  if (rememberInput) rememberInput.addEventListener('change', () => {
    state.loginRemember = rememberInput.checked
    if (!rememberInput.checked) persistLogin('', '', false)
  })
  el.querySelector('#loginCaptchaRefresh')?.addEventListener('click', () => loadLoginCaptcha(el, true))
  if (!captcha) loadLoginCaptcha(el, false)
  const go = el.querySelector('#loginGo')
  if (go) go.addEventListener('click', async () => {
    const usernameValue = (el.querySelector('#loginUsername')?.value || '').trim()
    const passwordValue = (el.querySelector('#loginPassword')?.value || '')
    const captchaAnswer = (el.querySelector('#loginCaptcha')?.value || '').trim()
    if (!usernameValue) return loginError('请输入用户名（姓名全拼）')
    if (!passwordValue) return loginError('请输入登录密码')
    if (!state.loginCaptcha || !state.loginCaptcha.captchaId) return loginError('验证码未加载，请点「换一个」重试')
    if (!captchaAnswer) return loginError('请填写验证码')
    const net = state.loginNet || netId
    const rememberValue = !!el.querySelector('#loginRemember')?.checked
    state.loginUsername = usernameValue
    state.loginPasswordDraft = passwordValue
    state.loginRemember = rememberValue
    go.disabled = true
    go.textContent = '正在登录…'
    const netRes = await api('/api/network', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: net }) })
    if (!netRes.ok) {
      go.disabled = false
      go.textContent = '进入 九规智能中枢'
      return loginError(netRes.body.error || '安全域切换失败')
    }
    const res = await api('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: usernameValue,
        password: passwordValue,
        captchaId: state.loginCaptcha.captchaId,
        captchaAnswer,
      }),
    })
    if (!res.ok) {
      go.disabled = false
      go.textContent = '进入 九规智能中枢'
      loginError(res.body.code === 'BAD_CAPTCHA' ? '验证码不正确，已换一个，请重新填写' : (res.body.error || '登录失败'))
      await loadLoginCaptcha(el, true)
      return
    }
    persistLogin(usernameValue, passwordValue, rememberValue, res.body.accountId || '')
    state.loginUsername = ''
    state.loginPasswordDraft = undefined
    state.loginRemember = undefined
    state.loginCaptcha = null
    state.loginCaptchaAnswerDraft = ''
    state.loginCaptchaSeq = (state.loginCaptchaSeq || 0) + 1
    setLoginChrome(false)
    await loadBoot()
    if (state.boot.mustChangePassword) { render(); return }
    state.view = 'home'
    render()
    consumeShareDeepLink()
    toast(`已以「${(state.boot.user || {}).name || usernameValue}」身份登录 · ${(state.boot.network || {}).label || net}`)
  })
  bindLoginClose(el)
}

function renderPasswordSetup(el) {
  setLoginChrome(true)
  const name = state.boot?.user?.name || '当前账号'
  el.innerHTML = `
    <div class="login-wrap">
      <div class="login-card" style="position:relative;width:440px;max-width:calc(100vw - 32px);background:transparent;border:0;box-shadow:none">
        ${loginCloseButton()}
        <div class="login-brand">首次登录 · 设置密码</div>
        <div class="login-sub">${esc(name)}，请先修改初始密码后继续使用九规智能中枢</div>
        <div class="login-note" style="margin-top:16px">初始密码为姓名全拼@123（首字母大写）。新密码需 8–64 位，至少包含字母和数字。</div>
        <div class="login-section">当前密码</div>
        <input id="pwdCurrent" class="mini-input" type="password" autocomplete="current-password" style="width:100%!important;max-width:100%!important;box-sizing:border-box;height:38px;margin-top:8px;padding:0 11px;border:1px solid var(--line);border-radius:8px;background:#fff;font-size:var(--fs-sub);outline:none">
        <div class="login-section">新密码</div>
        <input id="pwdNext" class="mini-input" type="password" autocomplete="new-password" style="width:100%!important;max-width:100%!important;box-sizing:border-box;height:38px;margin-top:8px;padding:0 11px;border:1px solid var(--line);border-radius:8px;background:#fff;font-size:var(--fs-sub);outline:none">
        <div class="login-section">确认新密码</div>
        <input id="pwdConfirm" class="mini-input" type="password" autocomplete="new-password" style="width:100%!important;max-width:100%!important;box-sizing:border-box;height:38px;margin-top:8px;padding:0 11px;border:1px solid var(--line);border-radius:8px;background:#fff;font-size:var(--fs-sub);outline:none">
        <div id="pwdError" class="login-note" style="color:#b42318;margin-top:8px" hidden></div>
        <button class="btn primary login-go" id="pwdSave">保存新密码并进入</button>
        <div class="login-foot">修改后立即生效；下次登录请使用新密码。</div>
      </div>
    </div>`
  const err = (message) => {
    const box = el.querySelector('#pwdError')
    box.textContent = message
    box.hidden = false
  }
  const save = el.querySelector('#pwdSave')
  save.addEventListener('click', async () => {
    const currentPassword = el.querySelector('#pwdCurrent').value
    const nextPassword = el.querySelector('#pwdNext').value
    const confirmPassword = el.querySelector('#pwdConfirm').value
    if (!currentPassword) return err('请输入当前密码')
    if (nextPassword.length < 8 || nextPassword.length > 64 || !/[A-Za-z]/.test(nextPassword) || !/\d/.test(nextPassword)) return err('新密码需 8–64 位，且至少包含字母和数字')
    if (nextPassword !== confirmPassword) return err('两次输入的新密码不一致')
    save.disabled = true
    save.textContent = '正在保存…'
    const { ok, body } = await api('/api/account/password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ currentPassword, nextPassword }),
    })
    if (!ok) {
      save.disabled = false
      save.textContent = '保存新密码并进入'
      return err(body.error || '密码修改失败')
    }
    updateSavedLoginPassword(state.boot.user?.accountId || '', nextPassword)
    state.boot.mustChangePassword = false
    setLoginChrome(false)
    await loadBoot()
    state.view = 'home'
    render()
    consumeShareDeepLink()
    toast('密码已更新，已进入九规智能中枢')
  })
  bindLoginClose(el)
}

function openChangePassword() {
  const mask = openModal('修改登录密码', `
    <div class="set-desc" style="margin-bottom:10px">用于账号密码登录；修改后立即生效。新密码需 8–64 位，至少包含字母和数字。</div>
    <div style="display:grid;gap:10px">
      <input id="pwdCurrent" class="text-input" type="password" autocomplete="current-password" placeholder="当前密码">
      <input id="pwdNext" class="text-input" type="password" autocomplete="new-password" placeholder="新密码">
      <input id="pwdConfirm" class="text-input" type="password" autocomplete="new-password" placeholder="确认新密码">
    </div>
    <div id="pwdError" style="display:none;margin-top:8px;color:#b42318;font-size:var(--fs-meta)"></div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
      <button class="btn" data-pwd-cancel>取消</button>
      <button class="btn primary" data-pwd-save>保存新密码</button>
    </div>`, { width: 430 })
  const err = (message) => {
    const box = mask.querySelector('#pwdError')
    box.textContent = message
    box.style.display = 'block'
  }
  mask.querySelector('[data-pwd-cancel]').addEventListener('click', () => mask.remove())
  mask.querySelector('[data-pwd-save]').addEventListener('click', async () => {
    const currentPassword = mask.querySelector('#pwdCurrent').value
    const nextPassword = mask.querySelector('#pwdNext').value
    const confirmPassword = mask.querySelector('#pwdConfirm').value
    if (!currentPassword) return err('请输入当前密码')
    if (nextPassword.length < 8 || nextPassword.length > 64 || !/[A-Za-z]/.test(nextPassword) || !/\d/.test(nextPassword)) return err('新密码需 8–64 位，且至少包含字母和数字')
    if (nextPassword !== confirmPassword) return err('两次输入的新密码不一致')
    const btn = mask.querySelector('[data-pwd-save]')
    btn.disabled = true
    btn.textContent = '正在保存…'
    const { ok, body } = await api('/api/account/password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ currentPassword, nextPassword }),
    })
    if (!ok) {
      btn.disabled = false
      btn.textContent = '保存新密码'
      return err(body.error || '密码修改失败')
    }
    updateSavedLoginPassword(state.boot.user?.accountId || '', nextPassword)
    mask.remove()
    toast('登录密码已更新')
  })
}


async function logout() {
  try { await api('/api/logout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }) } catch (e) { /* 会话可能已过期 */ }
  state.boot = null
  state.conversation = null
  state.shareMode = false
  state.shareSelection = []
  state.shareLinkConsumed = false
  state.loginUsername = undefined
  state.loginRole = ''
  state.loginPasswordDraft = undefined
  state.loginRemember = undefined
  state.loginCaptcha = null
  state.loginCaptchaAnswerDraft = ''
  state.loginCaptchaSeq = (state.loginCaptchaSeq || 0) + 1
  document.getElementById('railbar').innerHTML = ''
  document.getElementById('sidebar').innerHTML = ''
  document.getElementById('topbar').innerHTML = ''
  await loadBoot()
  setLoginChrome(true)
  render()
}

function openGrantDialog(r, grants) {
  const list = Array.isArray(grants) ? grants : []
  const mask = openModal(`授予资源引用权限 · ${r.name}`, `
    <div style="font-size:var(--fs-sub);color:var(--text-2);line-height:1.6">授权对象限于本集团的组织、部门与角色；授予后该对象可在项目、智能笔记本与 AI 检索中引用本资源，原始文件仍由数据中心保管，不接受复制。</div>
    <div class="grant-list" style="margin-top:12px">${list.map((g) => `<div class="grant-row"><span class="tag">${esc(g.type)}</span><span class="grant-target">${esc(g.target)}</span><span class="mono grant-rights">${esc((g.rights || []).join(' / '))}</span><span class="mono" style="color:var(--muted);font-size:var(--fs-micro)">${esc(g.by)} · ${esc(g.at)}</span></div>`).join('') || '<span class="mono" style="color:var(--muted)">暂无授权记录</span>'}</div>
    <div style="margin-top:14px;display:flex;gap:8px;align-items:center">
      <span style="font-size:var(--fs-meta);color:var(--muted)">对象</span>
      <input id="grantTarget" placeholder="如：规划一所 / 集团知识库治理专项" style="flex:1;border:1px solid var(--line);border-radius:8px;padding:7px 10px;font-size:var(--fs-sub)">
      <button class="btn primary" id="grantAdd">授予引用</button>
    </div>
    <div style="margin-top:10px;font-size:var(--fs-micro);color:var(--muted)">判定在服务端执行：被授予方按「查看 / 下载 / 引用 / 编辑」逐项放行，越权请求返回 403 并写审计。</div>`, { width: 620 })
  mask.querySelector('#grantAdd').addEventListener('click', async () => {
    const target = (mask.querySelector('#grantTarget').value || '').trim()
    if (!target) return toast('请填写授权对象')
    const { ok } = await api('/api/resource/grant', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: r.id, type: '部门', target, rights: ['查看', '引用'] }),
    })
    if (!ok) return
    toast(`已授予「${target}」引用权限`)
    mask.remove()
  })
}


const TASK_IDEAS = [
  { name: '每日公示项目变更摘要', desc: '每天 08:30 读取公示项目台账，比昨日快照，摘要投递到项目组群', sch: '每天 08:30' },
  { name: '本周工作小结草稿', desc: '每周五 17:00 汇总本周会话与项目结论，生成周报草稿投递到项目文档', sch: '每周五 17:00' },
  { name: '城市体检指标月度快照', desc: '每月 1 日 09:00 生成体检指标快照表，口径变化单独列一节', sch: '每月 1 日 09:00' },
  { name: '影像入库核验单', desc: '每季度首月 5 日核对影像范围、分辨率与元数据，生成核验单', sch: '每季度首月 5 日' },
  { name: '审图意见周汇总', desc: '每周一 09:00 收集各项目审图意见，按专业归类并跟踪回复状态', sch: '每周一 09:00' },
  { name: '知识库索引巡检', desc: '每周一 09:00 检查未建索引与解析失败的文档，生成待处理清单', sch: '每周一 09:00' },
]


/* --------------------- 更多菜单自定义（仅企业工作台） --------------------- */

function openMoreConfig() {
  const { user } = state.boot
  const visibles = (id) => user.visibleModules.includes(id)
  const aiItems = [['home', '首页'], ['imagegen', '图像'], ['tasks', '定时任务'], ['skills', '插件与技能'], ['projects', '项目']]
  const moved = ENTERPRISE_ITEMS.filter(([id]) => state.moreSet.includes(id) && visibles(id))
  const inRail = ENTERPRISE_ITEMS.filter(([id]) => !state.moreSet.includes(id) && visibles(id))
  const mask = openModal('整理企业工作台', `
    <div style="font-size:var(--fs-sub);color:var(--text-2);line-height:1.6;max-width:560px"></div>
    <div class="mc-grid">
      <div class="mc-col">
        <div class="mc-h">图标栏显示 <span class="mono">${inRail.length}</span></div>
        ${inRail.map(([id, label, ic]) => `<div class="mc-row"><span class="ico">${icon(ic)}</span><span class="mc-name">${esc(state.boot.modules[id]?.label || label)}</span><button class="btn sm subtle" data-mc-out="${id}">收进更多</button></div>`).join('') || '<div class="mc-empty">全部已收进更多</div>'}
      </div>
      <div class="mc-col">
        <div class="mc-h">收进更多 <span class="mono">${moved.length}</span></div>
        ${moved.map(([id, label, ic]) => `<div class="mc-row"><span class="ico">${icon(ic)}</span><span class="mc-name">${esc(state.boot.modules[id]?.label || label)}</span><button class="btn sm subtle" data-mc-in="${id}">放回图标栏</button></div>`).join('') || '<div class="mc-empty">暂无</div>'}
      </div>
    </div>
    <div class="mc-fixed"><div class="mc-h">AI 工作台（固定）</div><div class="mc-tags">${aiItems.map(([id, label]) => `<span class="tag">${esc(state.boot.modules[id]?.label || label)}</span>`).join('')}</div><div class="mc-note"></div></div>`, { width: 720 })
  const sync = () => {
    localStorage.setItem('jg.moreSet', JSON.stringify(state.moreSet))
    renderRail()
  }
  mask.querySelectorAll('[data-mc-out]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.mcOut
    if (!state.moreSet.includes(id)) state.moreSet.push(id)
    sync(); mask.remove(); openMoreConfig()
    toast(`已把「${state.boot.modules[id]?.label || id}」收进更多`)
  }))
  mask.querySelectorAll('[data-mc-in]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.mcIn
    state.moreSet = state.moreSet.filter((x) => x !== id)
    sync(); mask.remove(); openMoreConfig()
    toast(`已把「${state.boot.modules[id]?.label || id}」放回图标栏`)
  }))
}

/* ===== 恢复：设置页配置常量 ===== */
const settingsTabs = [
  { id: 'general', label: '常规', group: '个人', scope: 'personal', kw: '权限 工作区 模型 语言 启动 状态栏' },
  { id: 'appearance', label: '个性化', group: '个人', scope: 'personal', kw: '主题 密度 字号 侧栏 品牌色' },
  { id: 'notifications', label: '通知', group: '个人', scope: 'personal', kw: '任务 审批 授权 涉密 维护 渠道' },
  { id: 'profile', label: '个人资料', group: '个人', scope: 'personal', kw: '姓名 编码 岗位 任职 认证 设备 授权' },
  { id: 'network', label: '网络与凭证', group: '安全与数据', scope: 'personal', kw: '网络 政务 互联网 令牌 凭证 诊断' },
  { id: 'models', label: '模型与密钥', group: '安全与数据', scope: 'personal', kw: '模型 密钥 外发 个人 Key' },
  { id: 'usage', label: '用量与配额', group: '安全与数据', scope: 'personal', kw: 'token 用量 配额 账单 超额 模型' },
  { id: 'data', label: '数据管理', group: '安全与数据', scope: 'personal', kw: '保留 导出 缓存 归档' },
  { id: 'integrations', label: '插件与工具', group: '集成', scope: 'personal', kw: '插件 技能 MCP 工具 地址' },
  { id: 'runtime', label: 'Agent 运行时', group: '集成', scope: 'personal', kw: '设置中心 运行时 Agent loop 模型路由 shell subagent 会话日志 配置 执行策略 推理强度' },
  { id: 'mcp', label: 'MCP 资源', group: '集成', scope: 'personal', kw: 'MCP 资源 数据中心 通知 服务器 工具 健康 订阅' },
  { id: 'about', label: '关于', group: '其他', scope: 'personal', kw: '版本 基线 更新 帮助' },
  // 管理类：仅持有 admin 入口的角色可见，普通员工在设置里完全看不到这一段
  { id: 'adm-org', label: '组织与身份', group: '管理（仅管理员）', scope: 'admin', kw: '部门 员工 任职 角色 跨网 身份' },
  { id: 'adm-access', label: '授权与策略', group: '管理（仅管理员）', scope: 'admin', kw: '角色 权限 数据授权 审批 模型 工具' },
  { id: 'adm-catalog', label: '数据目录与接入', group: '管理（仅管理员）', scope: 'admin', kw: '目录 资源 Resource 数据源 字段 服务能力' },
  { id: 'adm-apps', label: '应用审核', group: '管理（仅管理员）', scope: 'admin', kw: '应用 接入 验证 审核 发布 下架' },
  { id: 'adm-ops', label: '系统与运维', group: '管理（仅管理员）', scope: 'admin', kw: '三网 实例 环境 证书 更新 限流 可用性' },
  { id: 'adm-audit', label: '审计与告警', group: '管理（仅管理员）', scope: 'admin', kw: '审计 留痕 告警 留存 导出' },
]

const canAdmin = () => (state.boot?.user?.visibleModules || []).includes('admin')

/* ===== 恢复：设置页行级构件 ===== */

const sw = (id, on, disabled = false) => `
  <label class="switch${disabled ? ' disabled' : ''}">
    <input type="checkbox" id="${id}" ${on ? 'checked' : ''} ${disabled ? 'disabled' : ''}><span class="knob"></span>
  </label>`

const sbtn = (act, label) => `<button class="btn sm" data-act="${act}">${label}</button>`

const srow = (label, desc, control) => `
  <div class="set-row">
    <div class="set-copy">
      <div class="set-label">${label}</div>
      ${desc ? `<div class="set-desc">${desc}</div>` : ''}
    </div>
    <div class="set-ctrl">${control}</div>
  </div>`

const sgroup = (title, rows) => `
  <div class="set-group">
    <div class="set-group-title">${title}</div>
    <div class="set-rows">${rows.join('')}</div>
  </div>`

/* 下拉选择构件（设置页） */
const sel = (id, options, current) => `
  <select class="mini-select" id="${id}">
    ${options.map((o) => `<option ${o === current ? 'selected' : ''}>${o}</option>`).join('')}
  </select>`

/* 开关构件（设置页；若已有 sw 则忽略此段） */
const kn = (id, on, disabled = false) => `
  <label class="switch${disabled ? ' disabled' : ''}">
    <input type="checkbox" id="${id}" ${on ? 'checked' : ''} ${disabled ? 'disabled' : ''}><span class="knob"></span>
  </label>`

/* v28ab 强调色：启动时套用上次选择 */
applyAccent()

/* v28t 省略号悬浮全文：被截断的文字悬停时用系统提示显示完整内容 */
document.addEventListener('mouseover', (e) => {
  const t = e.target
  if (!t || !t.getBoundingClientRect) return
  const cands = [t, t.parentElement].filter(Boolean)
  for (const el of cands) {
    if (el.title) continue
    let cs
    try { cs = getComputedStyle(el) } catch (_) { continue }
    const clamp = parseInt(cs.webkitLineClamp || '0', 10)
    const cut = (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 2) ||
      (clamp > 0 && el.scrollHeight > el.clientHeight + 2)
    if (cut) {
      el.title = (el.textContent || '').trim()
      break
    }
  }
}, true)

