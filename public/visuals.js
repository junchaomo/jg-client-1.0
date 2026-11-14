/* Visual Engine 前端：聊天内渲染、放大、导出、源码/版本、保存成果。
   设计为不依赖 app.js 内部变量；通过 window.JGVisualHost 复用现有弹窗、toast 与 api。 */
(function () {
  'use strict'
  document.documentElement.dataset.visualEngine = '1'
  window.JGVisualsLoaded = true
  document.documentElement.dataset.visualDiag = [typeof window.mermaid, typeof window.echarts].join(',')
  setTimeout(() => {
    try {
      ensureMermaid()
      document.documentElement.dataset.mermaidInit = 'ok'
      window.mermaid.render('jg-self-test', 'flowchart TD\nA[测试] --> B[通过]').then((out) => {
        document.documentElement.dataset.mermaidTest = out?.svg ? 'ok' : 'empty'
      }).catch((error) => {
        document.documentElement.dataset.mermaidTest = `error:${error?.message || error}`
      })
    } catch (error) {
      document.documentElement.dataset.mermaidInit = `throw:${error?.message || error}`
    }
  }, 0)

  const visualCache = new Map()
  const visualPromises = new Map()
  const chartInstances = new WeakMap()
  let mermaidReady = false
  let mermaidSeq = 0

  const host = () => window.JGVisualHost || {}
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))
  const $ = (a, b) => {
    const root = typeof a === 'string' ? (b || document) : (a || document)
    const selector = typeof a === 'string' ? a : b
    return selector ? root?.querySelector?.(selector) || null : null
  }

  function toast(message, bad = false) {
    if (typeof host().toast === 'function') host().toast(message, bad)
    else console[bad ? 'error' : 'log'](message)
  }

  function jsonHeaders() { return { 'content-type': 'application/json' } }

  async function api(path, options) {
    if (typeof host().api === 'function') return host().api(path, options)
    const res = await fetch(path, { credentials: 'same-origin', ...(options || {}) })
    const body = await res.json().catch(() => ({}))
    return { ok: res.ok, status: res.status, body }
  }

  function isDark() {
    return Boolean(document.documentElement.dataset.theme === 'dark' ||
      document.body.classList.contains('dark') ||
      (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches))
  }

  function ensureMermaid() {
    if (mermaidReady || !window.mermaid) return
    const dark = isDark()
    window.mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
      fontFamily: '"PingFang SC","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif',
      themeVariables: {
        fontSize: '14px',
        fontFamily: '"PingFang SC","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif',
        primaryColor: dark ? '#25324a' : '#eef4ff',
        primaryTextColor: dark ? '#e8ecf4' : '#1f2328',
        primaryBorderColor: dark ? '#4877c9' : '#8fb4ff',
        secondaryColor: dark ? '#202735' : '#f6f8fc',
        tertiaryColor: dark ? '#1b202a' : '#fbfcfe',
        lineColor: dark ? '#7a879b' : '#9aa6b6',
        textColor: dark ? '#e8ecf4' : '#1f2328',
        clusterBkg: dark ? '#1b202a' : '#f8fafd',
        edgeLabelBackground: dark ? '#1b202a' : '#ffffff',
      },
    })
    mermaidReady = true
  }

  function clientSanitizeSvg(raw, allowForeignObject = false, htmlMode = false) {
    const doc = new DOMParser().parseFromString(String(raw || ''), htmlMode ? 'text/html' : 'image/svg+xml')
    if (!htmlMode && doc.querySelector('parsererror')) throw new Error('SVG 解析失败')
    const root = htmlMode ? doc.querySelector('svg') : doc.documentElement
    if (!root || root.nodeName.toLowerCase() !== 'svg') throw new Error('SVG 根节点不是 <svg>')
    const forbidden = ['script', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'form', 'input', 'textarea', 'button', 'audio', 'video'].concat(allowForeignObject ? [] : ['foreignObject'])
    forbidden.forEach((name) => root.querySelectorAll(name).forEach((node) => node.remove()))
    root.querySelectorAll('*').forEach((node) => {
      for (const attr of [...node.attributes]) {
        const name = attr.name.toLowerCase()
        if (name.startsWith('on')) node.removeAttribute(attr.name)
        if ((name === 'href' || name === 'xlink:href' || name === 'src') && !String(attr.value).trim().startsWith('#')) node.removeAttribute(attr.name)
        if (name === 'style' && /url\s*\(|expression\s*\(|@import|javascript\s*:/i.test(attr.value)) node.removeAttribute(attr.name)
      }
    })
    return new XMLSerializer().serializeToString(root)
  }

  function prettySource(visual) {
    const text = String(visual?.source || '')
    if (visual?.type !== 'echarts') return text
    try { return JSON.stringify(JSON.parse(text), null, 2) } catch { return text }
  }

  async function fetchVisual(id, force = false) {
    const key = String(id || '')
    if (!key) throw new Error('缺少可视化 id')
    if (!force && visualCache.has(key)) return visualCache.get(key)
    if (!force && visualPromises.has(key)) return visualPromises.get(key)
    const promise = (async () => {
      const res = await api(`/api/visuals?id=${encodeURIComponent(key)}`)
      if (!res.ok || !res.body?.visual) throw new Error(res.body?.error || '可视化加载失败')
      visualCache.set(key, res.body.visual)
      return res.body.visual
    })().finally(() => visualPromises.delete(key))
    visualPromises.set(key, promise)
    return promise
  }

  function clearCanvasCache(canvas) {
    const chart = chartInstances.get(canvas)
    if (chart) {
      try { chart.dispose() } catch {}
      chartInstances.delete(canvas)
    }
  }

  async function renderVisualInto(canvas, visual) {
    const card = canvas.closest('.jg-visual')
    if (card) card.dataset.renderInto = '1'
    clearCanvasCache(canvas)
    canvas.innerHTML = ''
    const type = String(visual?.type || '')
    if (card) card.dataset.renderType = type
    if (type === 'mermaid') {
      canvas.dataset.phase = 'mermaid-init'
      ensureMermaid()
      if (!window.mermaid?.render) throw new Error('Mermaid 渲染库未加载')
      const id = `jg-mermaid-${Date.now()}-${mermaidSeq++}`
      canvas.dataset.phase = 'mermaid-before'
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Mermaid 渲染超时，请检查图结构')), 10000))
      const out = await Promise.race([window.mermaid.render(id, String(visual.source || '')), timeout])
      canvas.dataset.phase = 'mermaid-after'
      const svg = clientSanitizeSvg(out?.svg || '', true, true)
      const wrap = document.createElement('div')
      wrap.className = 'jg-visual-mermaid'
      wrap.innerHTML = svg
      const svgNode = wrap.querySelector('svg')
      if (svgNode) {
        const vb = svgNode.viewBox?.baseVal
        if (vb && vb.width) {
          svgNode.removeAttribute('width')
          svgNode.removeAttribute('height')
          svgNode.style.setProperty('width', `${Math.round(vb.width)}px`, 'important')
          svgNode.style.setProperty('max-width', 'none', 'important')
        }
      }
      canvas.appendChild(wrap)
      const centerMermaid = () => { try { canvas.scrollLeft = Math.max(0, (canvas.scrollWidth - canvas.clientWidth) / 2) } catch {} }
      centerMermaid()
      setTimeout(centerMermaid, 40)
      return { type, wrap }
    }
    if (type === 'echarts') {
      if (!window.echarts) throw new Error('ECharts 渲染库未加载')
      let option
      try { option = JSON.parse(String(visual.source || '')) } catch { throw new Error('ECharts 配置不是合法 JSON') }
      if (!option || typeof option !== 'object' || Array.isArray(option)) throw new Error('ECharts 配置必须是对象')
      if (isDark()) option.textStyle = { ...(option.textStyle || {}), color: '#e8ecf4' }
      const box = document.createElement('div')
      box.className = 'jg-visual-chart'
      canvas.appendChild(box)
      const chart = window.echarts.init(box, null, { renderer: 'canvas' })
      chart.setOption(option, true)
      chartInstances.set(canvas, chart)
      const resize = () => { try { chart.resize() } catch {} }
      if (window.ResizeObserver) {
        const observer = new ResizeObserver(resize)
        observer.observe(canvas)
        chart._jgResizeObserver = observer
      }
      setTimeout(resize, 30)
      return { type, chart }
    }
    if (type === 'svg') {
      const svg = clientSanitizeSvg(visual.source, false)
      const wrap = document.createElement('div')
      wrap.className = 'jg-visual-svg'
      wrap.innerHTML = svg
      canvas.appendChild(wrap)
      return { type, wrap }
    }
    if (type === 'interactive') {
      let spec
      try { spec = JSON.parse(String(visual.source || '')) } catch { throw new Error('交互组件配置不是合法 JSON') }
      const fields = Array.isArray(spec?.fields) ? spec.fields : []
      if (!fields.length) throw new Error('交互组件缺少参数')
      const wrap = document.createElement('div')
      wrap.className = 'jg-visual-interactive'
      const hint = document.createElement('div')
      hint.className = 'jg-int-hint'
      hint.textContent = '拖动滑块调整参数，结果实时更新。'
      wrap.appendChild(hint)
      const rows = document.createElement('div')
      rows.className = 'jg-int-fields'
      const inputs = {}
      const valueLabels = {}
      for (const field of fields) {
        const row = document.createElement('label')
        row.className = 'jg-int-field'
        const head = document.createElement('span')
        head.className = 'jg-int-label'
        head.textContent = String(field.label || field.key || '')
        const value = document.createElement('b')
        value.className = 'jg-int-value'
        head.appendChild(value)
        const input = document.createElement('input')
        input.type = 'range'
        input.min = String(field.min)
        input.max = String(field.max)
        input.step = String(field.step)
        input.value = String(field.value)
        input.setAttribute('aria-label', String(field.label || field.key || ''))
        row.appendChild(head)
        row.appendChild(input)
        rows.appendChild(row)
        inputs[field.key] = input
        valueLabels[field.key] = value
      }
      wrap.appendChild(rows)
      const result = document.createElement('div')
      result.className = 'jg-int-result'
      const resultLabel = document.createElement('span')
      resultLabel.textContent = '每月月供'
      const resultValue = document.createElement('strong')
      resultValue.setAttribute('aria-live', 'polite')
      result.appendChild(resultLabel)
      result.appendChild(resultValue)
      const sub = document.createElement('div')
      sub.className = 'jg-int-sub'
      wrap.appendChild(result)
      wrap.appendChild(sub)
      const reset = document.createElement('button')
      reset.type = 'button'
      reset.className = 'jg-visual-btn'
      reset.textContent = '重置参数'
      wrap.appendChild(reset)
      const money = (n) => `¥${Math.round(Number(n) || 0).toLocaleString('zh-CN')}`
      const principalField = fields.find((field) => field.key === 'principal')
      const principalLooksYuan = Boolean(principalField) &&
        (Number(principalField.max) > 5000 || (/元/.test(String(principalField.unit || principalField.label || '')) && !/万/.test(String(principalField.unit || principalField.label || ''))))
      const displayUnit = (field) => field.key === 'principal' && principalLooksYuan ? '元' : (field.unit || '')
      const update = () => {
        const principal = Number(inputs.principal?.value || 100) * (principalLooksYuan ? 1 : 10000)
        const annual = Number(inputs.rate?.value || 4.2)
        const years = Number(inputs.years?.value || 20)
        const months = Math.max(1, Math.round(years * 12))
        const monthlyRate = annual / 100 / 12
        const monthly = monthlyRate > 0
          ? principal * monthlyRate * Math.pow(1 + monthlyRate, months) / (Math.pow(1 + monthlyRate, months) - 1)
          : principal / months
        const total = monthly * months
        resultValue.textContent = money(monthly)
        sub.textContent = `还款总额 ${money(total)} · 总利息 ${money(total - principal)} · ${months} 期`
        for (const field of fields) {
          const input = inputs[field.key]
          const label = valueLabels[field.key]
          if (input && label) label.textContent = `${Number(input.value).toLocaleString('zh-CN')}${displayUnit(field)}`
        }
      }
      for (const field of fields) {
        const input = inputs[field.key]
        if (input) input.addEventListener('input', update)
      }
      reset.addEventListener('click', () => {
        for (const field of fields) {
          const input = inputs[field.key]
          if (input) input.value = String(field.value)
        }
        update()
      })
      update()
      canvas.appendChild(wrap)
      return { type, wrap }
    }
    throw new Error(`不支持的可视化类型：${type}`)
  }

  function actionButtons(visual) {
    return `<div class="jg-visual-actions" role="toolbar" aria-label="可视化操作">
      <button type="button" class="jg-visual-btn" data-vact="zoom" title="放大查看">放大</button>
      <button type="button" class="jg-visual-btn" data-vact="copy" title="复制为图片" ${visual.type === 'interactive' ? 'disabled' : ''}>复制图片</button>
      <button type="button" class="jg-visual-btn" data-vact="export-png" title="导出 PNG" ${visual.type === 'interactive' ? 'disabled' : ''}>PNG</button>
      <button type="button" class="jg-visual-btn" data-vact="export-svg" title="导出 SVG" ${visual.type === 'echarts' || visual.type === 'interactive' ? 'disabled' : ''}>SVG</button>
      <span class="jg-visual-spacer"></span>
      <button type="button" class="jg-visual-btn" data-vact="source" title="查看源码与版本">源码</button>
      <button type="button" class="jg-visual-btn primary" data-vact="save" title="保存为长期成果">保存成果</button>
    </div>`
  }

  async function renderCard(container, visual, force = false) {
    const key = `${visual.id}:${visual.version}:${visual.status}:${visual.title}`
    if (!force && container.dataset.renderKey === key && $('.jg-visual-canvas', container)) return
    container.dataset.renderKey = key
    container.dataset.renderCard = '1'
    container.innerHTML = `<div class="jg-visual-head">
        <div class="jg-visual-title" title="${esc(visual.title)}">${esc(visual.title)}</div>
        <span class="jg-visual-badge${visual.status === 'saved' ? ' saved' : ''}">${visual.status === 'saved' ? '长期成果' : esc(visual.typeLabel || visual.type)}</span>
        <span class="jg-visual-version">v${Number(visual.version || 1)}</span>
      </div>
      <div class="jg-visual-stage"><div class="jg-visual-canvas"><div class="jg-visual-loading"><span class="jg-visual-spinner"></span><span>${esc(visual.typeLabel || '可视化')}渲染中…</span></div></div></div>
      ${actionButtons(visual)}`
    const canvas = $('.jg-visual-canvas', container)
    try {
      await renderVisualInto(canvas, visual)
    } catch (error) {
      canvas.innerHTML = `<div class="jg-visual-error"><strong>图形暂时无法显示</strong><span>${esc(error?.message || '渲染失败')}</span><button type="button" class="jg-visual-retry" data-vact="retry">重试</button></div>`
    }
  }

  async function renderAll(root = document) {
    const items = [...root.querySelectorAll('.jg-visual[data-visual-id]')]
    for (const container of items) {
      const id = container.dataset.visualId
      if (!id) continue
      try {
        let visual = await fetchVisual(id)
        const refVersion = Number(container.dataset.visualVersion || 0)
        if (refVersion && Number(visual.version || 0) !== refVersion) visual = await fetchVisual(id, true)
        if (!container.isConnected) continue
        container.dataset.renderAll = '1'
        if (container.dataset.renderKey && container.dataset.renderKey === `${visual.id}:${visual.version}:${visual.status}:${visual.title}`) continue
        await renderCard(container, visual)
      } catch (error) {
        const canvas = $('.jg-visual-canvas', container)
        if (canvas) canvas.innerHTML = `<div class="jg-visual-error"><strong>图形暂时无法显示</strong><span>${esc(error?.message || '加载失败')}</span><button type="button" class="jg-visual-retry" data-vact="retry">重试</button></div>`
      }
    }
  }

  function blobDownload(blob, filename) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1500)
  }

  function safeFilename(visual, ext) {
    const raw = String(visual?.title || 'visual').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60)
    return `${raw || 'visual'}.${ext}`
  }

  function findCanvas(id) {
    const modalCanvas = document.querySelector(`.jg-modal-mask[data-visual-id="${CSS.escape(id)}"] .jg-visual-zoom-inner .jg-visual-canvas`)
    if (modalCanvas) return modalCanvas
    const cards = [...document.querySelectorAll('.jg-visual[data-visual-id]')].filter((el) => el.dataset.visualId === id)
    const active = cards.find((el) => el.closest('.jg-visual-zoom-inner')) || cards[0]
    return active ? $('.jg-visual-canvas', active) : null
  }

  function svgTextOf(canvas) {
    const svg = $('svg', canvas)
    return svg ? new XMLSerializer().serializeToString(svg) : ''
  }

  async function svgToPngBlob(svgText) {
    if (!svgText) throw new Error('没有可导出的 SVG')
    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    try {
      const img = await new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error('SVG 转 PNG 失败'))
        image.src = url
      })
      const width = Math.min(4096, Math.max(320, Math.round((img.naturalWidth || 900) * 2)))
      const height = Math.min(4096, Math.max(220, Math.round((img.naturalHeight || 600) * 2)))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, width, height)
      return await new Promise((resolve, reject) => canvas.toBlob((out) => out ? resolve(out) : reject(new Error('PNG 生成失败')), 'image/png'))
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  async function getExportBlob(id, format) {
    const canvas = findCanvas(id)
    if (!canvas) throw new Error('图形尚未渲染完成')
    const visual = visualCache.get(id) || await fetchVisual(id)
    const chart = chartInstances.get(canvas)
    if (format === 'png') {
      if (chart) {
        const url = chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' })
        const data = String(url || '')
        if (!data.startsWith('data:image/png')) throw new Error('图表导出失败')
        const bin = atob(data.split(',')[1] || '')
        const bytes = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
        return new Blob([bytes], { type: 'image/png' })
      }
      return svgToPngBlob(svgTextOf(canvas))
    }
    if (format === 'svg') {
      if (visual.type === 'echarts') throw new Error('统计图当前支持导出 PNG；请使用 PNG 按钮')
      const text = svgTextOf(canvas)
      if (!text) throw new Error('没有可导出的 SVG')
      return new Blob([text], { type: 'image/svg+xml;charset=utf-8' })
    }
    throw new Error('不支持的导出格式')
  }

  async function exportVisual(id, format) {
    try {
      const blob = await getExportBlob(id, format)
      const visual = visualCache.get(id) || {}
      blobDownload(blob, safeFilename(visual, format))
      toast(`已导出 ${format.toUpperCase()}`)
    } catch (error) {
      toast(error?.message || '导出失败', true)
    }
  }

  async function copyVisual(id) {
    try {
      const blob = await getExportBlob(id, 'png')
      if (!navigator.clipboard?.write || !window.ClipboardItem) throw new Error('当前浏览器不支持复制图片')
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      toast('已复制为图片')
    } catch (error) {
      toast(error?.message || '复制失败，可改用导出 PNG', true)
    }
  }

  function openZoom(id) {
    openZoomAsync(id).catch((error) => toast(error?.message || '放大查看失败', true))
  }

  async function openZoomAsync(id) {
    const visual = await fetchVisual(id, true)
    const title = `查看 · ${String(visual.title || '可视化')}`
    const mask = host().openModal(esc(title), `<div class="jg-visual-zoom-toolbar">
        <button type="button" class="jg-visual-btn" data-vzoom="out" title="缩小">−</button>
        <button type="button" class="jg-visual-btn" data-vzoom="reset" title="适应窗口">适应</button>
        <button type="button" class="jg-visual-btn" data-vzoom="in" title="放大">＋</button>
        <span data-vzoom-label>100%</span>
        <span class="jg-visual-spacer"></span>
        <button type="button" class="jg-visual-btn" data-vid="${esc(id)}" data-vact="copy" ${visual.type === 'interactive' ? 'disabled' : ''}>复制图片</button>
        <button type="button" class="jg-visual-btn" data-vid="${esc(id)}" data-vact="export-png" ${visual.type === 'interactive' ? 'disabled' : ''}>PNG</button>
        <button type="button" class="jg-visual-btn" data-vid="${esc(id)}" data-vact="export-svg" ${visual.type === 'echarts' || visual.type === 'interactive' ? 'disabled' : ''}>SVG</button>
        <button type="button" class="jg-visual-btn" data-vid="${esc(id)}" data-vact="source">源码/版本</button>
      </div>
      <div class="jg-visual-zoom-stage"><div class="jg-visual-zoom-inner"><div class="jg-visual-canvas"></div></div></div>
      <div class="jg-visual-zoom-hint">滚轮缩放，拖动平移；统计图可直接使用图内的缩放/提示交互。</div>`, {
      wide: true,
      onMount: (modal) => {
        const stage = $('.jg-visual-zoom-stage', modal)
        const inner = $('.jg-visual-zoom-inner', modal)
        const canvas = $('.jg-visual-canvas', modal)
        const label = $('[data-vzoom-label]', modal)
        let scale = 1
        let tx = 0
        let ty = 0
        let dragging = false
        let startX = 0
        let startY = 0
        let ox = 0
        let oy = 0
        const apply = () => {
          inner.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`
          if (label) label.textContent = `${Math.round(scale * 100)}%`
        }
        const zoomTo = (next) => { scale = Math.max(0.35, Math.min(3.5, next)); apply() }
        $('[data-vzoom="in"]', modal)?.addEventListener('click', () => zoomTo(scale * 1.2))
        $('[data-vzoom="out"]', modal)?.addEventListener('click', () => zoomTo(scale / 1.2))
        $('[data-vzoom="reset"]', modal)?.addEventListener('click', () => { scale = 1; tx = 0; ty = 0; apply() })
        stage?.addEventListener('wheel', (event) => {
          event.preventDefault()
          zoomTo(scale + (event.deltaY > 0 ? -0.12 : 0.12))
        }, { passive: false })
        stage?.addEventListener('pointerdown', (event) => {
          if (event.target.closest('button') || event.target.closest('.jg-visual-chart')) return
          dragging = true
          startX = event.clientX
          startY = event.clientY
          ox = tx
          oy = ty
          stage.setPointerCapture?.(event.pointerId)
        })
        stage?.addEventListener('pointermove', (event) => {
          if (!dragging) return
          tx = ox + event.clientX - startX
          ty = oy + event.clientY - startY
          apply()
        })
        const stopDrag = () => { dragging = false }
        stage?.addEventListener('pointerup', stopDrag)
        stage?.addEventListener('pointercancel', stopDrag)
        renderVisualInto(canvas, visual).then(() => apply()).catch((error) => {
          canvas.innerHTML = `<div class="jg-visual-error"><strong>图形暂时无法显示</strong><span>${esc(error?.message || '渲染失败')}</span></div>`
        })
        const observer = new MutationObserver(() => {
          if (!document.body.contains(modal)) {
            observer.disconnect()
            clearCanvasCache(canvas)
          }
        })
        observer.observe(document.body, { childList: true })
      },
    })
    if (mask) mask.dataset.visualId = id
  }

  async function openSource(id) {
    try {
      const res = await api(`/api/visuals/versions?id=${encodeURIComponent(id)}`)
      if (!res.ok || !res.body?.visual) throw new Error(res.body?.error || '读取可视化失败')
      const visual = res.body.visual
      visualCache.set(id, visual)
      const versions = Array.isArray(res.body.items) ? res.body.items : []
      const source = prettySource(visual)
      const rows = versions.slice().reverse().map((v) => `<div class="jg-visual-version-row">
          <b>v${Number(v.version)}</b>
          <span>${esc(v.note || '')} · ${esc(new Date(v.createdAt || 0).toLocaleString('zh-CN', { hour12: false }))}</span>
          ${Number(v.version) === Number(visual.version) ? '<span class="jg-visual-current">当前</span>' : `<button type="button" class="jg-visual-btn" data-vrestore="${Number(v.version)}" data-vid="${esc(id)}">恢复此版</button>`}
        </div>`).join('')
      const mask = host().openModal(esc(`源码 · ${visual.title}`), `<div class="jg-visual-source-head">
          <span>${esc(visual.typeLabel || visual.type)} · 当前 v${Number(visual.version)}</span>
          <span class="jg-visual-spacer"></span>
          <button type="button" class="jg-visual-btn" data-vcopy-source="${esc(id)}">复制源码</button>
        </div>
        <pre class="jg-visual-source" data-vsource="${esc(id)}">${esc(source)}</pre>
        <div class="jg-visual-versions">
          <div class="jg-visual-source-head"><span>版本记录 · ${versions.length} 个</span></div>
          ${rows || '<div class="jg-visual-shelf-empty">暂无版本记录</div>'}
        </div>`, { wide: true })
      if (mask) mask.dataset.visualId = id
    } catch (error) {
      toast(error?.message || '读取源码失败', true)
    }
  }

  async function restoreVersion(id, version) {
    try {
      const res = await api('/api/visuals/restore', {
        method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ id, version: Number(version) }),
      })
      if (!res.ok || !res.body?.visual) throw new Error(res.body?.error || '恢复版本失败')
      visualCache.set(id, res.body.visual)
      toast(`已恢复到 v${version}，并生成新的当前版本`)
      renderAll(document)
      openSource(id)
    } catch (error) {
      toast(error?.message || '恢复版本失败', true)
    }
  }

  function openSave(id) {
    fetchVisual(id).then((visual) => {
      const mask = host().openModal('保存可视化成果', `<div class="jg-visual-form">
          <label for="jgVisualName">成果名称</label>
          <input id="jgVisualName" value="${esc(visual.title || '')}" maxlength="120" autocomplete="off">
          <div class="jg-visual-form-foot">
            <button type="button" class="btn" data-vsave-cancel>取消</button>
            <button type="button" class="btn primary" data-vsave-confirm data-vid="${esc(id)}">保存为成果</button>
          </div>
        </div>`)
      if (!mask) return
      const input = $('.jg-visual-form input', mask)
      setTimeout(() => input?.focus(), 30)
      $('[data-vsave-cancel]', mask)?.addEventListener('click', () => mask.remove())
      const submit = async () => {
        const name = String(input?.value || '').trim() || visual.title
        try {
          const res = await api('/api/visuals/save', {
            method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ id, name }),
          })
          if (!res.ok || !res.body?.visual) throw new Error(res.body?.error || '保存失败')
          visualCache.set(id, res.body.visual)
          mask.remove()
          toast('已保存为长期成果')
          renderAll(document)
        } catch (error) {
          toast(error?.message || '保存失败', true)
        }
      }
      $('[data-vsave-confirm]', mask)?.addEventListener('click', submit)
      input?.addEventListener('keydown', (event) => { if (event.key === 'Enter') submit() })
    }).catch((error) => toast(error?.message || '读取可视化失败', true))
  }

  async function openShelf() {
    try {
      const res = await api('/api/visuals?saved=1')
      if (!res.ok) throw new Error(res.body?.error || '读取成果失败')
      const items = Array.isArray(res.body?.items) ? res.body.items : []
      const rows = items.length ? items.map((v) => `<div class="jg-visual-shelf-row" data-vopen="${esc(v.id)}" role="button" tabindex="0">
          <div class="jg-visual-shelf-main">
            <div class="jg-visual-shelf-title">${esc(v.title || '未命名可视化')}</div>
            <div class="jg-visual-shelf-meta">${esc(v.typeLabel || v.type)} · v${Number(v.version || 1)} · ${esc(new Date(v.updatedAt || 0).toLocaleString('zh-CN', { hour12: false }))}</div>
          </div>
          <span class="jg-visual-badge saved">长期成果</span>
          <span class="jg-visual-shelf-open">打开</span>
        </div>`).join('') : '<div class="jg-visual-shelf-empty">还没有保存的可视化成果。在聊天图形卡片上点击“保存成果”即可创建。</div>'
      host().openModal('可视化成果', `<div class="jg-visual-shelf">${rows}</div>`, { wide: true })
    } catch (error) {
      toast(error?.message || '读取成果失败', true)
    }
  }

  document.addEventListener('click', (event) => {
    const openRow = event.target.closest('[data-vopen]')
    if (openRow) { openZoom(openRow.dataset.vopen); return }
    const restore = event.target.closest('[data-vrestore]')
    if (restore) { restoreVersion(restore.dataset.vid, restore.dataset.vrestore); return }
    const copySource = event.target.closest('[data-vcopy-source]')
    if (copySource) {
      const id = copySource.dataset.vcopySource
      const pre = document.querySelector(`[data-vsource="${CSS.escape(id)}"]`)
      const text = pre?.textContent || ''
      navigator.clipboard?.writeText(text).then(() => toast('源码已复制')).catch(() => toast('源码复制失败', true))
      return
    }
    const btn = event.target.closest('[data-vact]')
    if (!btn) return
    const card = btn.closest('.jg-visual[data-visual-id]')
    const id = btn.dataset.vid || card?.dataset.visualId || (btn.closest('.jg-modal')?.dataset.visualId)
    if (!id) return
    const action = btn.dataset.vact
    if (action === 'zoom') openZoom(id)
    else if (action === 'copy') copyVisual(id)
    else if (action === 'export-png') exportVisual(id, 'png')
    else if (action === 'export-svg') exportVisual(id, 'svg')
    else if (action === 'source') openSource(id)
    else if (action === 'save') openSave(id)
    else if (action === 'retry' && card) {
      fetchVisual(id, true).then((visual) => renderCard(card, visual, true)).catch((error) => toast(error?.message || '重试失败', true))
    }
  })

  window.JGVisuals = { renderAll, openZoom, openShelf, fetchVisual, renderVisualInto }
})()
