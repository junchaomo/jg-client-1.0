/* 九规 AI 选区桥：OnlyOffice 无界面 background 插件。
 * 只做三件事：上报选区、接收左侧对话下发的替换命令、回执。
 * 不创建任何右侧面板，所有交互都留在左侧九规 AI 对话框。 */
(function () {
  'use strict'
  var query = new URLSearchParams(location.search)
  var token = query.get('token') || ''
  var docKey = (query.get('docKey') || '').split('?')[0]
  var lastReported = ''
  var eventSource = null
  var reconnectTimer = null
  var channel = null
  var started = false
  var selectionTimer = null
  try { channel = new BroadcastChannel('jg-office-bridge') } catch (_) { channel = null }

  function scheduleReport() {
    clearTimeout(selectionTimer)
    selectionTimer = setTimeout(reportSelection, 160)
  }

  function attachSelectionEvents() {
    if (!window.Asc || !Asc.plugin) return
    try {
      if (typeof Asc.plugin.attachEditorEvent === 'function') {
        Asc.plugin.attachEditorEvent('onSelectionChanged', scheduleReport)
        Asc.plugin.attachEditorEvent('onTargetPositionChanged', scheduleReport)
      }
    } catch (_) { /* 旧版本不支持 attachEditorEvent 时依赖 initOnSelectionChanged */ }
  }

  function normalize(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim()
  }

  function api(path, body) {
    return fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-jg-office-token': token },
      body: JSON.stringify(Object.assign({ token: token, docKey: docKey }, body || {})),
      keepalive: true,
    }).then(function (response) {
      return response.json().catch(function () { return {} }).then(function (data) {
        if (!response.ok) throw new Error(data.error || ('HTTP ' + response.status))
        return data
      })
    })
  }

  function getSelectedText(callback) {
    if (!window.Asc || !Asc.plugin) return callback('')
    /* 新版插件 API 的 executeMethod 直接映射编辑器方法，选区读取比 callCommand 稳定。 */
    if (typeof Asc.plugin.executeMethod === 'function') {
      try {
        var ok = Asc.plugin.executeMethod('GetSelectedText', [{
          Numbering: false,
          Math: false,
          TableCellSeparator: '\n',
          TableRowSeparator: '\r\n',
          ParaSeparator: '\r\n',
          TabSymbol: '\t',
          NewLineSeparator: '\r',
        }], function (result) {
          callback(String(result == null ? '' : result))
        })
        if (ok !== false) return
      } catch (_) { /* 回退到 callCommand */ }
    }
    try {
      Asc.plugin.callCommand(function () {
        try { return Api.GetSelectedText() } catch (_) { return '' }
      }, false, false, function (result) {
        callback(String(result == null ? '' : result))
      })
    } catch (_) { callback('') }
  }

  function getSelectedHtml(callback) {
    if (!window.Asc || !Asc.plugin) return callback('')
    try {
      Asc.plugin.callCommand(function () {
        try { return Api.GetSelectedContent({ type: 'html' }) } catch (_) { return '' }
      }, false, false, function (result) {
        callback(String(result == null ? '' : result))
      })
    } catch (_) { callback('') }
  }

  function reportSelection() {
    getSelectedText(function (text) {
      getSelectedHtml(function (html) {
        var normalized = normalize(text)
        /* 空选区也要上报一次，左侧 chip 才能及时消失；相同文本不重复请求。 */
        if (normalized === lastReported) return
        lastReported = normalized
        api('/api/office/bridge/selection', { text: text, html: html }).then(function (data) {
          if (data && data.selection && channel) {
            channel.postMessage({ type: 'selection', selection: data.selection })
          }
        }).catch(function () { /* 文档未保存或令牌过期时静默重试 */ })
      })
    })
  }

  function ack(commandId, ok, payload) {
    api('/api/office/bridge/ack', Object.assign({ commandId: commandId, ok: ok }, payload || {})).catch(function () {})
  }

  function replaceFallback(command) {
    var literal = JSON.stringify(command.paragraphs || []).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
    try {
      Asc.plugin.callCommand(new Function('return function(){ Api.ReplaceTextSmart(' + literal + '); return true; }')(), false, false, function (result) {
        ack(command.commandId, true, { result: { method: 'callCommand', value: result } })
        reportSelection()
      })
    } catch (error) {
      ack(command.commandId, false, { code: 'OFFICE_REPLACE_FAILED', error: String(error && error.message || error) })
    }
  }

  function runCommand(command) {
    if (!command || command.action !== 'replaceSelection') return
    var expected = normalize(command.sourceText)
    getSelectedText(function (current) {
      /* 左侧发指令后用户可能又改选了；此时宁可拒绝，也不能把旧建议落到新位置。 */
      if (expected && normalize(current) !== expected) {
        ack(command.commandId, false, { code: 'OFFICE_SELECTION_STALE', error: '当前选区已变化，请重新选中后再试' })
        return
      }
      var settled = false
      function finish(ok, payload) {
        if (settled) return
        settled = true
        ack(command.commandId, ok, payload)
        reportSelection()
      }
      try {
        if (typeof Asc.plugin.executeMethod !== 'function') throw new Error('executeMethod unavailable')
        Asc.plugin.executeMethod('ReplaceTextSmart', [command.paragraphs || []], function (result) {
          finish(true, { result: { method: 'ReplaceTextSmart', value: result } })
        })
        setTimeout(function () { if (!settled) replaceFallback(command) }, 1200)
      } catch (_) {
        replaceFallback(command)
      }
    })
  }

  function connectEvents() {
    if (!token || eventSource) return
    var url = '/api/office/bridge/events?token=' + encodeURIComponent(token) + '&docKey=' + encodeURIComponent(docKey)
    try {
      eventSource = new EventSource(url)
      eventSource.addEventListener('command', function (event) {
        var command = null
        try { command = JSON.parse(event.data || '{}') } catch (_) {}
        if (command) runCommand(command)
      })
      eventSource.onerror = function () {
        try { eventSource.close() } catch (_) {}
        eventSource = null
        clearTimeout(reconnectTimer)
        reconnectTimer = setTimeout(connectEvents, 2500)
      }
    } catch (_) {
      eventSource = null
      clearTimeout(reconnectTimer)
      reconnectTimer = setTimeout(connectEvents, 3000)
    }
  }

  function startBridge() {
    if (started) return
    started = true
    attachSelectionEvents()
    connectEvents()
    reportSelection()
    /* 事件在不同 OnlyOffice 版本里触发不稳定；选区读取本身很轻，轮询作为兜底。 */
    setInterval(reportSelection, 1200)
  }

  function selectionFromInitData(data) {
    if (typeof data === 'string') return data
    if (data && typeof data === 'object') return String(data.text || data.html || data.data || '')
    return ''
  }

  window.Asc = window.Asc || {}
  window.Asc.plugin = window.Asc.plugin || {}
  window.Asc.plugin.init = function (data) {
    startBridge()
    var initText = normalize(selectionFromInitData(data))
    /* initDataType=text 且 initOnSelectionChanged=true 时，init 每次都会带最新选区。 */
    if (initText && initText !== lastReported) {
      lastReported = initText
      api('/api/office/bridge/selection', { text: initText, html: '' }).then(function (payload) {
        if (payload && payload.selection && channel) channel.postMessage({ type: 'selection', selection: payload.selection })
      }).catch(function () {})
      return
    }
    reportSelection()
  }
  window.Asc.plugin.onExternalMouseUp = reportSelection
  window.Asc.plugin.onSelectionChanged = reportSelection
  window.addEventListener('focus', reportSelection)
  /* 部分 OnlyOffice 版本不会主动回调 background 插件的 init；脚本加载后自行兜底启动。 */
  setTimeout(startBridge, 600)
  setTimeout(function () { if (!started) startBridge() }, 2500)
})()
