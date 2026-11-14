/**
 * 九规智能中枢统一页面布局。
 * 单栏 / 双栏是同一套 AppLayout 的配置状态：
 * - 所有页面共用 #app + #railbar + #main + #topbar
 * - 只有配置了 sidebar 的页面才启用 #sidebar 和顶栏开关
 * - 单栏/双栏共用同一套网格；双栏为图标栏 + 固定侧栏 + 主内容
 * - 侧边栏由全局布局统一控制，业务模块只提供侧栏内容
 */
export const LAYOUT_TOKENS = Object.freeze({
  railWidth: 58,
  sidebarWidth: 272,
  sidebarMinWidth: 180,
  sidebarMaxWidth: 520,
  gutter: 24,
  radius: 12,
  border: '#e5e5e5',
  surface: '#ffffff',
  motion: '180ms cubic-bezier(.22,.61,.36,1)',
})

export class AppLayout {
  constructor(app) {
    if (!app) throw new Error('AppLayout 需要 #app 容器')
    this.app = app
    this.sidebar = app.querySelector('#sidebar')
    this.main = app.querySelector('.main')
    this.topbar = app.querySelector('#topbar')
    this.view = app.querySelector('#view')
    app.classList.add('layout-shell')
  }

  configure({ sidebarEnabled = false, sidebarOpen = false, width = LAYOUT_TOKENS.sidebarWidth, page = '' } = {}) {
    const clamped = Math.max(LAYOUT_TOKENS.sidebarMinWidth, Math.min(LAYOUT_TOKENS.sidebarMaxWidth, Number(width) || LAYOUT_TOKENS.sidebarWidth))
    this.app.dataset.layoutPage = page
    this.app.classList.toggle('has-layout-sidebar', Boolean(sidebarEnabled))
    this.app.classList.toggle('sidebar-open', Boolean(sidebarEnabled && sidebarOpen))
    document.documentElement.style.setProperty('--layout-rail-w', `${LAYOUT_TOKENS.railWidth}px`)
    document.documentElement.style.setProperty('--layout-sidebar-w', `${clamped}px`)
    document.documentElement.style.setProperty('--layout-gutter', `${LAYOUT_TOKENS.gutter}px`)
    document.documentElement.style.setProperty('--sidebar-w', `${clamped}px`)
    if (this.sidebar) {
      this.sidebar.setAttribute('aria-hidden', String(!(sidebarEnabled && sidebarOpen)))
      this.sidebar.toggleAttribute('inert', !(sidebarEnabled && sidebarOpen))
    }
    if (this.view) {
      this.view.dataset.layout = sidebarEnabled ? 'split' : 'single'
    }
  }

  mountSidebar(node) {
    if (!this.sidebar) return
    if (typeof node === 'string') this.sidebar.innerHTML = node
    else if (node) {
      this.sidebar.replaceChildren(node)
      node.classList.add('layout-sidebar-content')
    }
  }

  clearSidebar() {
    if (this.sidebar) this.sidebar.innerHTML = ''
  }

  focusMain() {
    this.view?.focus?.()
  }
}
