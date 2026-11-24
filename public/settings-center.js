/* 设置中心真实动作：只通过 JGSettingsHost 复用主应用的弹窗、请求与刷新机制。 */
const host = () => window.JGSettingsHost
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))
const fmt = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('zh-CN', { hour12: false })
}
const jsonOptions = (method, body) => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) })
const style = () => {
  if (document.querySelector('#jg-settings-center-style')) return
  const node = document.createElement('style')
  node.id = 'jg-settings-center-style'
  node.textContent = `
    .sc-stack{display:grid;gap:14px}.sc-row{display:flex;gap:12px;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--line)}
    .sc-row:last-child{border-bottom:0}.sc-main{min-width:0;flex:1}.sc-title{font-size:13px;font-weight:600;color:var(--text);margin-bottom:4px}.sc-desc{font-size:12px;line-height:1.65;color:var(--muted);overflow-wrap:anywhere}
    .sc-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.sc-field{display:grid;gap:6px}.sc-field>label{font-size:12px;font-weight:600}.sc-input,.sc-select,.sc-textarea{width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--text);padding:9px 10px;font:inherit}
    .sc-textarea{min-height:88px;resize:vertical}.sc-code{font:12px/1.65 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere;background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:10px;max-height:45vh;overflow:auto}
    .sc-status{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:999px;padding:2px 8px;font-size:11px;white-space:nowrap}.sc-status.ok{color:var(--green);border-color:var(--green)}.sc-status.bad{color:var(--red);border-color:var(--red)}
    .sc-list{display:grid;max-height:42vh;overflow:auto}.sc-check{display:flex;gap:9px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--line)}.sc-check input{margin-top:3px}.sc-empty{padding:20px 0;text-align:center;color:var(--muted);font-size:13px}.sc-note{border-left:3px solid var(--accent);padding:8px 12px;background:var(--panel);font-size:12px;line-height:1.7;color:var(--muted)}
    .sc-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.sc-help{cursor:pointer}.sc-doc{max-height:55vh;overflow:auto;white-space:pre-wrap;font:12px/1.75 ui-monospace,SFMono-Regular,Consolas,monospace}
    @media(max-width:720px){.sc-grid{grid-template-columns:1fr}.sc-row{align-items:flex-start;flex-direction:column}.sc-actions{width:100%}}
  `
  document.head.appendChild(node)
}
const busy = (button, pending, label = '处理中…') => {
  if (!button) return
  if (pending) { button.dataset.label = button.textContent; button.textContent = label; button.disabled = true }
  else { button.textContent = button.dataset.label || button.textContent; button.disabled = false }
}
const refresh = async () => host().refresh()
const fail = (error) => host().toast(String(error?.message || error || '操作失败'), true)
let mfaPrompt = null
function promptFreshMfa() {
  if (mfaPrompt) return mfaPrompt
  mfaPrompt = new Promise((resolve) => {
    const mask = host().openModal('敏感操作二次认证', `<div class="sc-stack"><div class="sc-note">此操作会改变配置、权限或导出数据。请输入当前账号认证器中的 6 位动态口令；认证仅对当前登录设备有效 10 分钟。</div><div class="sc-field"><label for="scStepUpCode">6 位动态口令</label><input class="sc-input" id="scStepUpCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code"></div><div class="sc-desc" id="scStepUpError"></div><div class="sc-actions"><button class="btn primary" id="scStepUpVerify">验证并继续</button><button class="btn" id="scStepUpCancel">取消操作</button></div></div>`)
    let settled = false
    const finish = (value) => { if (settled) return; settled = true; resolve(value) }
    mask.querySelector('.jg-modal-x')?.addEventListener('click', () => finish(false))
    mask.querySelector('#scStepUpCancel').onclick = () => { finish(false); mask.remove() }
    const input = mask.querySelector('#scStepUpCode')
    const button = mask.querySelector('#scStepUpVerify')
    const verify = async () => {
      busy(button, true, '校验中…')
      mask.querySelector('#scStepUpError').textContent = ''
      try {
        const { ok, body } = await host().api('/api/settings/mfa/verify', jsonOptions('POST', { code: input.value }))
        if (!ok) throw new Error(body.error || '动态口令校验失败')
        finish(true); mask.remove(); host().toast('二次认证通过，正在继续原操作')
      } catch (error) {
        mask.querySelector('#scStepUpError').textContent = String(error.message || error)
        busy(button, false); input.select()
      }
    }
    button.onclick = verify
    input.onkeydown = (event) => { if (event.key === 'Enter') verify() }
    input.focus()
  })
  return mfaPrompt.finally(() => { mfaPrompt = null })
}
async function request(path, options, retry = true) {
  const result = await host().api(path, options)
  if (retry && result.status === 428 && result.body?.code === 'MFA_REQUIRED') {
    const verified = await promptFreshMfa()
    if (verified) return request(path, options, false)
    return { ...result, body: { ...result.body, error: '已取消需要二次认证的操作' } }
  }
  return result
}
const rows = (items, empty = '暂无记录') => items.length ? items.join('') : `<div class="sc-empty">${esc(empty)}</div>`

async function workspace(reset = false) {
  const center = host().state().boot.settingsCenter || {}
  const current = center.workspace?.path || ''
  if (reset) {
    const mask = host().openModal('重置默认工作区', `<div class="sc-stack"><div class="sc-note">恢复为应用托管目录：${esc(center.workspace?.defaultPath || '')}<br>只改变新会话的落盘位置，不移动或删除现有文件。</div><div class="sc-actions"><button class="btn primary" id="scReset">确认重置</button></div></div>`)
    mask.querySelector('#scReset').onclick = async (event) => {
      busy(event.currentTarget, true)
      try {
        const { ok, body } = await request('/api/settings/workspace', jsonOptions('POST', { reset: true }))
        if (!ok) throw new Error(body.error || '重置失败')
        await refresh(); mask.remove(); host().toast('默认工作区已重置，新会话生效')
      } catch (error) { busy(event.currentTarget, false); fail(error) }
    }
    return
  }
  const mask = host().openModal('更改默认工作区', `<div class="sc-stack">
    <div class="sc-field"><label for="scWorkspace">本机文件夹绝对路径</label><div class="sc-actions"><input class="sc-input" id="scWorkspace" value="${esc(current)}" spellcheck="false"><button class="btn" id="scBrowse">选择文件夹</button></div></div>
    <div class="sc-note">服务端会实际创建目录并测试写入。已有会话仍在原目录，新会话使用此处；不会自动迁移项目或聊天文件。</div>
    <div class="sc-actions"><button class="btn primary" id="scSaveWorkspace">验证并保存</button></div>
  </div>`)
  const input = mask.querySelector('#scWorkspace')
  const browse = mask.querySelector('#scBrowse')
  if (!window.jgClient?.chooseFolder) browse.style.display = 'none'
  browse.onclick = async () => {
    busy(browse, true, '选择中…')
    try {
      const result = await window.jgClient.chooseFolder({ title: '选择默认工作区', buttonLabel: '使用此文件夹' })
      if (!result?.canceled && result?.path) input.value = result.path
    } catch (error) { fail(error) } finally { busy(browse, false) }
  }
  mask.querySelector('#scSaveWorkspace').onclick = async (event) => {
    busy(event.currentTarget, true, '验证中…')
    try {
      const { ok, body } = await request('/api/settings/workspace', jsonOptions('POST', { path: input.value }))
      if (!ok) throw new Error(body.error || '保存失败')
      await refresh(); mask.remove(); host().toast(body.message || '工作区已保存')
    } catch (error) { busy(event.currentTarget, false); fail(error) }
  }
}

function bindTotp(mask, enrolling = false) {
  const button = mask.querySelector('#scVerifyMfa')
  const input = mask.querySelector('#scMfaCode')
  button.onclick = async () => {
    busy(button, true, '校验中…')
    try {
      const { ok, body } = await request('/api/settings/mfa/verify', jsonOptions('POST', { code: input.value }))
      if (!ok) throw new Error(body.error || '校验失败')
      await refresh(); mask.remove(); host().toast(body.message)
    } catch (error) { busy(button, false); fail(error); input.select() }
  }
  input.onkeydown = (event) => { if (event.key === 'Enter') button.click() }
  input.focus()
  if (enrolling) mask.querySelector('#scMfaCode')?.scrollIntoView({ block: 'nearest' })
}

function reauth() {
  const mfa = host().state().boot.settingsCenter?.mfa || {}
  const body = mfa.enabled
    ? `<div class="sc-stack"><div class="sc-note">已绑定标准 TOTP 认证器。最近认证：${esc(fmt(mfa.lastVerifiedAt))}</div><div class="sc-field"><label for="scMfaCode">认证器当前 6 位动态口令</label><input class="sc-input" id="scMfaCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code"></div><div class="sc-actions"><button class="btn primary" id="scVerifyMfa">验证并写入审计</button></div></div>`
    : `<div class="sc-stack"><div class="sc-note">当前账号尚未绑定动态口令。点击生成密钥后，在支持 TOTP 的认证器中添加账号，再输入 6 位口令完成绑定。不会用页面自显验证码冒充二次认证。</div><div id="scMfaSetup"><button class="btn primary" id="scEnrollMfa">生成绑定密钥</button></div></div>`
  const mask = host().openModal('二次认证', body)
  if (mfa.enabled) bindTotp(mask)
  else mask.querySelector('#scEnrollMfa').onclick = async (event) => {
    busy(event.currentTarget, true, '生成中…')
    try {
      const { ok, body: enrollment } = await request('/api/settings/mfa/enroll', jsonOptions('POST'))
      if (!ok) throw new Error(enrollment.error || '生成失败')
      mask.querySelector('#scMfaSetup').innerHTML = `<div class="sc-stack">
        <div class="sc-field"><label>绑定密钥（在认证器中手动添加）</label><div class="sc-code">${esc(enrollment.secret)}</div></div>
        <div class="sc-field"><label>otpauth 地址</label><div class="sc-code">${esc(enrollment.otpauth)}</div></div>
        <div class="sc-field"><label for="scMfaCode">认证器当前 6 位动态口令</label><input class="sc-input" id="scMfaCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code"></div>
        <div class="sc-actions"><button class="btn primary" id="scVerifyMfa">完成绑定并验证</button></div>
      </div>`
      bindTotp(mask, true)
    } catch (error) { busy(event.currentTarget, false); fail(error) }
  }
}

async function devices() {
  const mask = host().openModal('登录设备', '<div class="sc-empty">正在读取服务端登录会话…</div>', { wide: true })
  try {
    const { ok, body } = await request('/api/settings/devices')
    if (!ok) throw new Error(body.error || '设备读取失败')
    mask.querySelector('.jg-modal-body').innerHTML = `<div class="sc-stack">
      <div class="sc-actions"><span class="sc-desc">共 ${body.items.length} 个有效会话</span><span style="flex:1"></span><button class="btn sm" id="scRevokeOthers" ${body.items.filter((item) => !item.current).length ? '' : 'disabled'}>注销其他设备</button></div>
      <div class="sc-list">${rows(body.items.map((item) => `<div class="sc-row"><div class="sc-main"><div class="sc-title">${item.current ? '当前设备' : '其他登录会话'} <span class="sc-status ${item.current ? 'ok' : ''}">${item.current ? '当前' : esc(item.network)}</span></div><div class="sc-desc">${esc(item.userAgent)}<br>IP：${esc(item.ipAddress)} · 登录：${esc(fmt(item.createdAt))}<br>最近活动：${esc(fmt(item.lastSeenAt))} · 到期：${esc(fmt(item.expiresAt))}</div></div>${item.current ? '' : `<button class="btn sm" data-revoke="${esc(item.token)}">注销</button>`}</div>`))}</div>
    </div>`
    const revoke = async (payload, button) => {
      busy(button, true, '注销中…')
      try {
        const result = await request('/api/settings/devices/revoke', jsonOptions('POST', payload))
        if (!result.ok) throw new Error(result.body.error || '注销失败')
        host().toast(`已注销 ${result.body.revoked} 个设备会话`)
        mask.remove(); await refresh(); devices()
      } catch (error) { busy(button, false); fail(error) }
    }
    mask.querySelectorAll('[data-revoke]').forEach((button) => { button.onclick = () => revoke({ token: button.dataset.revoke }, button) })
    mask.querySelector('#scRevokeOthers').onclick = (event) => revoke({ allOthers: true }, event.currentTarget)
  } catch (error) { mask.querySelector('.jg-modal-body').innerHTML = `<div class="sc-empty">${esc(error.message)}</div>` }
}

function diagnosticHtml(result) {
  return `<div class="sc-stack"><div class="sc-note">检查时间：${esc(fmt(result.checkedAt))}。以下为实际执行结果，失败项不会改写为成功。</div><div>${rows((result.checks || []).map((item) => `<div class="sc-row"><div class="sc-main"><div class="sc-title">${esc(item.label || item.name)}</div><div class="sc-desc">${esc(item.detail || '')}${item.latencyMs != null ? ` · ${item.latencyMs} ms` : ''}${item.certificateValidTo ? `<br>证书有效期至：${esc(item.certificateValidTo)}` : ''}</div></div><span class="sc-status ${item.ok ? 'ok' : 'bad'}">${item.ok ? '通过' : '失败'}</span></div>`))}</div><div class="sc-actions"><button class="btn" id="scDiagAgain">重新诊断</button></div></div>`
}
async function diagnostics() {
  const mask = host().openModal('运行诊断', '<div class="sc-empty">正在执行工作区写入、数据库查询、模型网关和 MCP 实测，请稍候…</div>', { wide: true })
  try {
    const { ok, body } = await request('/api/settings/diagnostics')
    if (!ok && !body.checks) throw new Error(body.error || '诊断失败')
    mask.querySelector('.jg-modal-body').innerHTML = diagnosticHtml(body)
    mask.querySelector('#scDiagAgain').onclick = () => diagnostics()
  } catch (error) { mask.querySelector('.jg-modal-body').innerHTML = `<div class="sc-empty">${esc(error.message)}</div><div class="sc-actions"><button class="btn" id="scDiagAgain">重试</button></div>`; mask.querySelector('#scDiagAgain').onclick = () => diagnostics() }
}

async function applyAccess() {
  const mask = host().openModal('数据授权与审批', '<div class="sc-empty">正在读取资源、申请记录与审批队列…</div>', { wide: true })
  try {
    const { ok, body } = await request('/api/settings/access-requests')
    if (!ok) throw new Error(body.error || '读取失败')
    const admin = body.canReview ? await request('/api/settings/access-requests/admin') : { ok: true, body: { items: [] } }
    if (!admin.ok) throw new Error(admin.body.error || '审批队列读取失败')
    const requestable = body.resources.filter((item) => !item.accessible)
    const statusClass = (status) => status === 'approved' ? 'ok' : ['rejected', 'revoked', 'expired'].includes(status) ? 'bad' : ''
    const ownItems = rows(body.items.map((item) => `<div class="sc-row"><div class="sc-main"><div class="sc-title">${esc(item.resourceName)} <span class="sc-status ${statusClass(item.status)}">${esc(item.statusLabel || item.status)}</span></div><div class="sc-desc">${esc(item.reason)}<br>申请：${esc(fmt(item.createdAt))} · ${item.durationDays} 天${item.approvedUntil ? `<br>有效期至：${esc(fmt(item.approvedUntil))}` : ''}${item.reviewedBy ? `<br>处理人：${esc(item.reviewedBy)}${item.reviewNote ? ` · ${esc(item.reviewNote)}` : ''}` : ''}</div></div>${item.status === 'pending' ? `<button class="btn sm" data-cancel-access="${esc(item.id)}">取消申请</button>` : ''}</div>`), '尚未提交授权申请')
    const reviewItems = rows(admin.body.items.map((item) => `<div class="sc-row" data-review-row="${esc(item.id)}"><div class="sc-main"><div class="sc-title">${esc(item.resourceName)} <span class="sc-status ${statusClass(item.status)}">${esc(item.statusLabel || item.status)}</span></div><div class="sc-desc">${esc(item.applicant)} · ${esc(item.unit)} · ${item.durationDays} 天<br>${esc(item.reason)}${item.approvedUntil ? `<br>有效期至：${esc(fmt(item.approvedUntil))}` : ''}</div>${item.userId !== host().state().boot.user.id && ['pending', 'approved'].includes(item.status) ? `<textarea class="sc-textarea" data-review-note placeholder="审批意见；驳回时必填" style="min-height:54px;margin-top:8px"></textarea>` : ''}</div><div class="sc-actions">${item.userId === host().state().boot.user.id && item.status === 'pending' ? '<span class="sc-desc">须由其他管理员审批</span>' : ''}${item.userId !== host().state().boot.user.id && item.status === 'pending' ? `<button class="btn sm primary" data-review="approved" data-id="${esc(item.id)}">通过</button><button class="btn sm" data-review="rejected" data-id="${esc(item.id)}">驳回</button>` : ''}${item.userId !== host().state().boot.user.id && item.status === 'approved' ? `<button class="btn sm" data-review="revoked" data-id="${esc(item.id)}">撤销授权</button>` : ''}</div></div>`), '暂无审批记录')
    mask.querySelector('.jg-modal-body').innerHTML = `<div class="sc-stack">
      ${body.canReview ? `<div><div class="sc-title">审批队列 <span class="sc-status">${body.pendingReviewCount} 项待我审批</span></div><div class="sc-list" style="max-height:38vh">${reviewItems}</div></div>` : ''}
      <div><div class="sc-title">申请额外授权</div><div class="sc-grid" style="margin-top:10px"><div class="sc-field"><label for="scResource">数据资源</label><select class="sc-select" id="scResource">${requestable.map((item) => `<option value="${esc(item.id)}">${esc(item.name)} · ${esc(item.security || '')}</option>`).join('')}</select></div><div class="sc-field"><label for="scDuration">授权期限</label><select class="sc-select" id="scDuration"><option value="30">30 天</option><option value="90">90 天</option><option value="180">180 天</option><option value="365">365 天</option></select></div></div>
      <div class="sc-field" style="margin-top:10px"><label for="scReason">业务用途与使用范围</label><textarea class="sc-textarea" id="scReason" placeholder="至少 8 个字，例如：用于九江市城市体检年度更新，仅限项目组内查询和统计。"></textarea></div>
      <div class="sc-actions" style="margin-top:10px"><button class="btn primary" id="scSubmitAccess" ${requestable.length ? '' : 'disabled'}>提交申请</button>${requestable.length ? '' : '<span class="sc-desc">当前没有需要额外申请的数据资源</span>'}</div></div>
      <div><div class="sc-title">我的申请</div><div class="sc-list">${ownItems}</div></div>
    </div>`
    mask.querySelector('#scSubmitAccess').onclick = async (event) => {
      busy(event.currentTarget, true, '提交中…')
      try {
        const result = await request('/api/settings/access-requests', jsonOptions('POST', { resourceId: mask.querySelector('#scResource').value, durationDays: mask.querySelector('#scDuration').value, reason: mask.querySelector('#scReason').value }))
        if (!result.ok) throw new Error(result.body.error || '提交失败')
        await refresh(); host().toast(result.body.message); mask.remove(); applyAccess()
      } catch (error) { busy(event.currentTarget, false); fail(error) }
    }
    mask.querySelectorAll('[data-cancel-access]').forEach((button) => {
      button.onclick = async () => {
        busy(button, true, '取消中…')
        try {
          const result = await request('/api/settings/access-requests/cancel', jsonOptions('POST', { id: button.dataset.cancelAccess }))
          if (!result.ok) throw new Error(result.body.error || '取消失败')
          host().toast(result.body.message); mask.remove(); applyAccess()
        } catch (error) { busy(button, false); fail(error) }
      }
    })
    mask.querySelectorAll('[data-review]').forEach((button) => {
      button.onclick = async () => {
        const row = mask.querySelector(`[data-review-row="${button.dataset.id}"]`)
        const reviewNote = row?.querySelector('[data-review-note]')?.value || ''
        busy(button, true, '处理中…')
        try {
          const result = await request('/api/settings/access-requests/review', jsonOptions('POST', { id: button.dataset.id, decision: button.dataset.review, reviewNote }))
          if (!result.ok) throw new Error(result.body.error || '审批失败')
          await refresh(); host().toast(result.body.message); mask.remove(); applyAccess()
        } catch (error) { busy(button, false); fail(error) }
      }
    })
  } catch (error) { mask.querySelector('.jg-modal-body').innerHTML = `<div class="sc-empty">${esc(error.message)}</div>` }
}

async function downloadConversation(id, format, button) {
  busy(button, true, '生成中…')
  try {
    let response = await fetch(`/api/settings/export?id=${encodeURIComponent(id)}&format=${encodeURIComponent(format)}`, { credentials: 'same-origin' })
    if (response.status === 428) {
      const body = await response.json().catch(() => ({}))
      if (body.code === 'MFA_REQUIRED' && await promptFreshMfa()) response = await fetch(`/api/settings/export?id=${encodeURIComponent(id)}&format=${encodeURIComponent(format)}`, { credentials: 'same-origin' })
    }
    if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || '导出失败') }
    const blob = await response.blob()
    const disposition = response.headers.get('content-disposition') || ''
    const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1]
    const plain = /filename="([^"]+)"/i.exec(disposition)?.[1]
    const name = encoded ? decodeURIComponent(encoded) : plain || `九规会话.${format === 'json' ? 'json' : 'md'}`
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = name; document.body.appendChild(anchor); anchor.click(); anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 30000)
    host().toast(`已导出 ${name}`)
  } catch (error) { fail(error) } finally { busy(button, false) }
}

async function exportConversations() {
  const mask = host().openModal('导出会话', '<div class="sc-empty">正在读取可导出会话…</div>')
  try {
    const { ok, body } = await request('/api/settings/conversations?archived=0')
    if (!ok) throw new Error(body.error || '读取失败')
    mask.querySelector('.jg-modal-body').innerHTML = `<div class="sc-stack"><div class="sc-field"><label for="scExportId">选择会话</label><select class="sc-select" id="scExportId">${body.items.map((item) => `<option value="${esc(item.id)}">${esc(item.title)} · ${item.turns} 轮</option>`).join('')}</select></div><div class="sc-field"><label for="scExportFormat">文件格式</label><select class="sc-select" id="scExportFormat"><option value="markdown">Markdown（便于阅读）</option><option value="json">JSON（完整结构化记录）</option></select></div><div class="sc-note">导出内容包含所选会话的消息与执行记录；本次下载会写入审计。</div><div class="sc-actions"><button class="btn primary" id="scDoExport" ${body.items.length ? '' : 'disabled'}>生成并下载</button>${body.items.length ? '' : '<span class="sc-desc">暂无可导出的活动会话</span>'}</div></div>`
    mask.querySelector('#scDoExport').onclick = (event) => downloadConversation(mask.querySelector('#scExportId').value, mask.querySelector('#scExportFormat').value, event.currentTarget)
  } catch (error) { mask.querySelector('.jg-modal-body').innerHTML = `<div class="sc-empty">${esc(error.message)}</div>` }
}

async function archives() {
  const mask = host().openModal('会话归档', '<div class="sc-empty">正在读取会话…</div>', { wide: true })
  try {
    const [active, archived] = await Promise.all([request('/api/settings/conversations?archived=0'), request('/api/settings/conversations?archived=1')])
    if (!active.ok || !archived.ok) throw new Error(active.body.error || archived.body.error || '读取失败')
    const section = (items, isArchived) => rows(items.map((item) => `<label class="sc-check"><input type="checkbox" data-archive-id="${esc(item.id)}"><span class="sc-main"><span class="sc-title">${esc(item.title)}</span><span class="sc-desc">${item.turns} 轮 · ${esc(item.model || '')} · ${esc(item.time || '')}${item.status === 'running' ? ' · 运行中（不可归档）' : ''}</span></span></label>`), isArchived ? '暂无已归档会话' : '暂无活动会话')
    mask.querySelector('.jg-modal-body').innerHTML = `<div class="sc-grid"><div><div class="sc-title">活动会话</div><div class="sc-list" id="scActiveList">${section(active.body.items, false)}</div><div class="sc-actions" style="margin-top:10px"><button class="btn" id="scArchiveSelected" ${active.body.items.length ? '' : 'disabled'}>归档所选</button></div></div><div><div class="sc-title">已归档</div><div class="sc-list" id="scArchivedList">${section(archived.body.items, true)}</div><div class="sc-actions" style="margin-top:10px"><button class="btn" id="scRestoreSelected" ${archived.body.items.length ? '' : 'disabled'}>恢复到活动列表</button></div></div></div><div class="sc-note" style="margin-top:14px">归档不会删除消息或原始日志；恢复后重新出现在日常会话列表。</div>`
    const mutate = async (isArchived, button, listId) => {
      const ids = [...mask.querySelectorAll(`#${listId} [data-archive-id]:checked`)].map((input) => input.dataset.archiveId)
      if (!ids.length) return host().toast('请先勾选会话', true)
      busy(button, true)
      try {
        const result = await request('/api/settings/conversations/archive', jsonOptions('POST', { ids, archived: isArchived }))
        if (!result.ok) throw new Error(result.body.error || '操作失败')
        await refresh(); host().toast(isArchived ? `已归档 ${result.body.count} 个会话` : `已恢复 ${result.body.count} 个会话`); mask.remove(); archives()
      } catch (error) { busy(button, false); fail(error) }
    }
    mask.querySelector('#scArchiveSelected').onclick = (event) => mutate(true, event.currentTarget, 'scActiveList')
    mask.querySelector('#scRestoreSelected').onclick = (event) => mutate(false, event.currentTarget, 'scArchivedList')
  } catch (error) { mask.querySelector('.jg-modal-body').innerHTML = `<div class="sc-empty">${esc(error.message)}</div>` }
}

function clearCache() {
  const mask = host().openModal('清理缓存', `<div class="sc-stack"><div class="sc-note">将清理 Electron HTTP/代码缓存、Cache Storage 和服务端临时界面缓存。不会删除 Cookie 登录态、本地设置、会话、项目或业务文件。</div><div class="sc-actions"><button class="btn primary" id="scClearCache">确认清理</button></div><div id="scCacheResult"></div></div>`)
  mask.querySelector('#scClearCache').onclick = async (event) => {
    busy(event.currentTarget, true, '清理中…')
    try {
      const server = await request('/api/settings/cache/clear', jsonOptions('POST'))
      if (!server.ok) throw new Error(server.body.error || '服务端缓存清理失败')
      let webCaches = 0
      if (window.caches?.keys) {
        const keys = await caches.keys()
        await Promise.all(keys.map((key) => caches.delete(key)))
        webCaches = keys.length
      }
      let desktop = null
      if (window.jgClient?.clearCache) desktop = await window.jgClient.clearCache()
      if (desktop && !desktop.ok) throw new Error(desktop.error || '客户端缓存清理失败')
      mask.querySelector('#scCacheResult').innerHTML = `<div class="sc-note">清理完成：浏览器 Cache Storage ${webCaches} 项；服务端临时项 ${server.body.removed} 个。业务数据未删除。</div>`
      await refresh()
    } catch (error) { fail(error) } finally { busy(event.currentTarget, false) }
  }
}

async function mcpTest() {
  const mask = host().openModal('MCP 连接测试', '<div class="sc-empty">正在启动独立 MCP 子进程，执行 initialize、tools/list、resources/list 与 ping…</div>')
  try {
    const { ok, body } = await request('/api/settings/mcp/test', jsonOptions('POST'))
    mask.querySelector('.jg-modal-body').innerHTML = `<div class="sc-stack"><div class="sc-note">${ok ? `连接正常：${body.toolCount} 项工具，${body.resourceCount} 项当前身份可见资源，耗时 ${body.latencyMs} ms。` : `测试失败：${esc(body.error || '未知错误')}`}</div><div>${rows((body.checks || []).map((item) => `<div class="sc-row"><div class="sc-main"><div class="sc-title">${esc(item.name)}</div><div class="sc-desc">${esc(item.detail)}</div></div><span class="sc-status ${item.ok ? 'ok' : 'bad'}">${item.ok ? '通过' : '失败'}</span></div>`))}</div>${body.diagnostic ? `<div class="sc-code">${esc(body.diagnostic)}</div>` : ''}<div class="sc-actions"><button class="btn" id="scMcpAgain">重新测试</button></div></div>`
    mask.querySelector('#scMcpAgain').onclick = () => mcpTest()
  } catch (error) { mask.querySelector('.jg-modal-body').innerHTML = `<div class="sc-empty">${esc(error.message)}</div>` }
}

async function update() {
  const mask = host().openModal('检查更新', '<div class="sc-empty">正在读取当前版本并检查更新清单…</div>')
  try {
    const { body } = await request('/api/settings/update/check', jsonOptions('POST'))
    const canDownload = body.status === 'available' && body.downloadUrl
    mask.querySelector('.jg-modal-body').innerHTML = `<div class="sc-stack"><div class="sc-row"><div class="sc-main"><div class="sc-title">当前版本</div><div class="sc-desc">${esc(body.currentVersion)}</div></div><span class="sc-status ${body.status === 'available' ? 'bad' : body.status === 'current' ? 'ok' : ''}">${body.status === 'available' ? '有更新' : body.status === 'current' ? '已一致' : body.status === 'not_configured' ? '未配置' : '检查失败'}</span></div>${body.latestVersion ? `<div class="sc-row"><div class="sc-main"><div class="sc-title">更新源版本</div><div class="sc-desc">${esc(body.latestVersion)}</div></div></div>` : ''}<div class="sc-note">${esc(body.message)}<br>检查时间：${esc(fmt(body.checkedAt))}</div>${body.notes ? `<div class="sc-code">${esc(body.notes)}</div>` : ''}<div class="sc-actions">${canDownload ? '<button class="btn primary" id="scDownloadUpdate">打开下载地址</button>' : ''}<button class="btn" id="scUpdateAgain">重新检查</button></div></div>`
    mask.querySelector('#scUpdateAgain').onclick = () => update()
    if (canDownload) mask.querySelector('#scDownloadUpdate').onclick = () => {
      if (window.jgClient?.browser?.openExternal) window.jgClient.browser.openExternal(body.downloadUrl)
      else window.open(body.downloadUrl, '_blank', 'noopener,noreferrer')
    }
  } catch (error) { mask.querySelector('.jg-modal-body').innerHTML = `<div class="sc-empty">${esc(error.message)}</div>` }
}

async function help() {
  const mask = host().openModal('帮助与反馈', '<div class="sc-empty">正在读取帮助目录…</div>', { wide: true })
  try {
    const { ok, body } = await request('/api/settings/help')
    if (!ok) throw new Error(body.error || '帮助读取失败')
    mask.querySelector('.jg-modal-body').innerHTML = `<div class="sc-grid"><div><div class="sc-title">使用说明</div>${rows(body.sections.map((item) => `<div class="sc-row"><div class="sc-main"><div class="sc-title">${esc(item.title)}</div><div class="sc-desc">${esc(item.body)}</div></div></div>`))}</div><div><div class="sc-title">本机文档</div>${rows(body.documents.map((item) => `<div class="sc-row sc-help" data-doc="${esc(item.id)}" role="button" tabindex="0"><div class="sc-main"><div class="sc-title">${esc(item.title)}</div><div class="sc-desc">从客户端安装目录读取，不依赖外部文档站</div></div><button class="btn sm">阅读</button></div>`))}<div id="scDocView" style="margin-top:12px"></div></div></div>`
    const openDoc = async (target) => {
      const view = mask.querySelector('#scDocView')
      view.innerHTML = '<div class="sc-empty">读取中…</div>'
      try {
        const result = await request(`/api/settings/help/document?id=${encodeURIComponent(target.dataset.doc)}`)
        if (!result.ok) throw new Error(result.body.error || '读取失败')
        view.innerHTML = `<div class="sc-title">${esc(result.body.title)}</div><pre class="sc-doc">${esc(result.body.text)}</pre>`
      } catch (error) { view.innerHTML = `<div class="sc-empty">${esc(error.message)}</div>` }
    }
    mask.querySelectorAll('[data-doc]').forEach((target) => { target.onclick = () => openDoc(target); target.onkeydown = (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openDoc(target) } } })
  } catch (error) { mask.querySelector('.jg-modal-body').innerHTML = `<div class="sc-empty">${esc(error.message)}</div>` }
}

const handlers = { workspace: () => workspace(false), workspaceReset: () => workspace(true), reauth, devices, diag: diagnostics, applyAccess, export: exportConversations, archive: archives, clearCache, testMcp: mcpTest, update, help }
window.JGSettingsCenter = {
  handles: (action) => Boolean(handlers[action]),
  open: async (action) => {
    style()
    const handler = handlers[action]
    if (!handler) return false
    try { await handler(); return true } catch (error) { fail(error); return false }
  },
}
