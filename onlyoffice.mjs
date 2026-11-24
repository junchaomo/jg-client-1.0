/**
 * OnlyOffice 在线编辑接入
 * - 文档服务与中枢分开部署，OnlyOffice 通过签名 URL 读取源文件；
 * - 保存由 OnlyOffice callback 回传，中枢负责版本写回；
 * - 配置和 token 都使用 HS256 JWT，密钥只存在 data/onlyoffice.json / 环境变量。
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { dataDirPath } from './db.mjs'

const DEFAULT_PUBLIC_URL = 'http://127.0.0.1:8082'
const DEFAULT_DOCUMENT_HOST_URL = 'http://host.docker.internal:54270'
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000

function trimBase(value, fallback) {
  const text = String(value || '').trim() || fallback
  return text.replace(/\/+$/, '')
}

function readConfigFile() {
  try {
    const path = join(dataDirPath(), 'onlyoffice.json')
    if (!existsSync(path)) return {}
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return {}
  }
}

export function onlyOfficeConfig() {
  const file = readConfigFile()
  return {
    enabled: String(process.env.JG_ONLYOFFICE_ENABLED || '').trim() === '0' ? false : file.enabled !== false,
    internalUrl: trimBase(process.env.JG_ONLYOFFICE_URL, trimBase(file.internalUrl, DEFAULT_PUBLIC_URL)),
    publicUrl: trimBase(process.env.JG_ONLYOFFICE_PUBLIC_URL, trimBase(file.publicUrl, trimBase(file.internalUrl, DEFAULT_PUBLIC_URL))),
    documentHostUrl: trimBase(process.env.JG_ONLYOFFICE_DOCUMENT_HOST_URL, trimBase(file.documentHostUrl, DEFAULT_DOCUMENT_HOST_URL)),
    secret: String(process.env.JG_ONLYOFFICE_SECRET || file.secret || ''),
    header: String(process.env.JG_ONLYOFFICE_HEADER || file.header || 'AuthorizationJwt'),
  }
}

function base64url(value) {
  return Buffer.from(value).toString('base64url')
}

export function signOnlyOfficeJwt(payload, secret) {
  const head = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64url(JSON.stringify(payload))
  const signature = createHmac('sha256', String(secret || '')).update(`${head}.${body}`).digest('base64url')
  return `${head}.${body}.${signature}`
}

export function verifyOnlyOfficeJwt(token, secret) {
  const parts = String(token || '').split('.')
  if (parts.length !== 3) return null
  const [head, body, signature] = parts
  const expected = createHmac('sha256', String(secret || '')).update(`${head}.${body}`).digest('base64url')
  try {
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
  } catch {
    return null
  }
  let payload
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) } catch { return null }
  if (!payload || typeof payload !== 'object') return null
  if (payload.exp && Number(payload.exp) < Math.floor(Date.now() / 1000)) return null
  return payload
}

export function createOnlyOfficeToken({ purpose, source = {}, user = {}, name = '', docKey = '', ttlMs = TOKEN_TTL_MS }) {
  const config = onlyOfficeConfig()
  if (!config.secret) throw new Error('OnlyOffice JWT 密钥未配置')
  return signOnlyOfficeJwt({
    v: 1,
    p: String(purpose || 'file'),
    uid: String(user.id || user.accountId || ''),
    uname: String(user.name || ''),
    fid: String(source.fileId || ''),
    path: String(source.path || ''),
    name: String(name || source.name || ''),
    docKey: String(docKey || ''),
    net: String(source.net || ''),
    exp: Math.floor(Date.now() / 1000) + Math.max(60, Math.floor((Number(ttlMs) || TOKEN_TTL_MS) / 1000)),
  }, config.secret)
}

export function readOnlyOfficeToken(token, purpose) {
  const config = onlyOfficeConfig()
  if (!config.secret) return null
  const payload = verifyOnlyOfficeJwt(token, config.secret)
  if (!payload || payload.p !== purpose) return null
  if (!payload.fid && !payload.path) return null
  return payload
}

/* 只探测文档服务自身，不依赖中枢与容器的回源链路；健康检查失败时由预览入口回退 PDF。 */
export async function onlyOfficeReachable(timeoutMs = 1200) {
  const config = onlyOfficeConfig()
  if (!config.enabled || !config.secret) return false
  try {
    const response = await fetch(`${config.internalUrl}/healthcheck`, {
      signal: AbortSignal.timeout(Math.max(300, Number(timeoutMs) || 1200)),
    })
    return response.ok
  } catch {
    return false
  }
}

export function onlyOfficeType(name = '') {
  const ext = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || ''
  if (['doc', 'docx', 'docm', 'dot', 'dotx', 'odt', 'rtf', 'txt'].includes(ext)) return { documentType: 'word', fileType: ext }
  if (['xls', 'xlsx', 'xlsm', 'xlt', 'xltx', 'ods', 'csv'].includes(ext)) return { documentType: 'cell', fileType: ext }
  if (['ppt', 'pptx', 'pptm', 'pot', 'potx', 'odp'].includes(ext)) return { documentType: 'slide', fileType: ext }
  return null
}

export function buildOnlyOfficeConfig({ source, user, displayName, key, fileToken, callbackToken, mode = 'edit', pluginToken = '', pluginOrigin = '' }) {
  const config = onlyOfficeConfig()
  const type = onlyOfficeType(displayName)
  if (!type) throw new Error('OnlyOffice 不支持该文件类型')
  const docUrl = `${config.documentHostUrl}/api/office/file?token=${encodeURIComponent(fileToken)}`
  const callbackUrl = `${config.documentHostUrl}/api/office/callback?token=${encodeURIComponent(callbackToken)}`
  const payload = {
    document: {
      fileType: type.fileType,
      key: String(key || '').slice(0, 128),
      title: String(displayName || '文档'),
      url: docUrl,
      info: {
        owner: String(user.name || user.id || ''),
        uploaded: new Date().toISOString(),
      },
      permissions: {
        edit: mode === 'edit',
        download: true,
        print: true,
        review: true,
        comment: true,
        fillForms: mode === 'edit',
        modifyFilter: mode === 'edit',
        modifyContentControl: mode === 'edit',
      },
    },
    documentType: type.documentType,
    editorConfig: {
      mode,
      lang: 'zh-CN',
      callbackUrl,
      user: { id: String(user.id || user.accountId || 'anonymous'), name: String(user.name || '用户') },
      customization: {
        autosave: true,
        forcesave: true,
        chat: false,
        comments: true,
        compactHeader: false,
        compactToolbar: false,
        help: false,
        hideRightMenu: true,
        hideRulers: false,
        toolbarNoTabs: false,
        uiTheme: 'theme-light',
        anonymous: { request: false },
        // 中文公文被英文词典判错会整段标红下划线；内嵌预览/编辑场景关闭拼写检查。
        // features.spellcheck 为 7.1 之后的新键，旧键 spellcheck 保留做向下兼容。
        features: { spellcheck: { mode: false } },
        spellcheck: false,
      },
      // 无界面选区桥：OnlyOffice 内不出现 AI 面板，选区只同步给左侧对话。
      // pluginsData 必须是浏览器可访问的中枢地址，不能使用 documentHostUrl（仅容器内可解析）。
      plugins: pluginToken && pluginOrigin ? {
        pluginsData: [`${String(pluginOrigin).replace(/\/$/, '')}/api/office/plugin/config.json?token=${encodeURIComponent(pluginToken)}&origin=${encodeURIComponent(String(pluginOrigin).replace(/\/$/, ''))}`],
        autostart: ['asc.{7EA2E7A2-2C71-4E5F-9C39-6E7A2B1F9D31}'],
      } : undefined,
    },
    width: '100%',
    height: '100%',
  }
  payload.token = signOnlyOfficeJwt(payload, config.secret)
  return payload
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
}

export function onlyOfficeEditorPage({ config, name, backUrl = '', downloadUrl = '', saveUrl = '', saveKey = '' }) {
  const title = escapeHtml(name || config?.document?.title || 'Office 文档')
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · 在线编辑</title>
<style>
  :root{--line:#e2e8f0;--muted:#64748b;--brand:#2563eb}
  *{box-sizing:border-box}html,body{height:100%;margin:0}
  body{display:flex;flex-direction:column;background:#f1f5f9;font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;color:#0f172a}
  .oo-top{height:46px;flex:0 0 46px;display:flex;align-items:center;gap:10px;padding:0 12px;background:#fff;border-bottom:1px solid var(--line)}
  .oo-dot{width:9px;height:9px;border-radius:9px;background:#16a34a;box-shadow:0 0 0 3px rgba(22,163,74,.12)}
  .oo-title{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
  .oo-sub{color:var(--muted);font-size:11px;margin-left:4px}
  .oo-actions{display:flex;gap:8px;flex:0 0 auto}
  .oo-btn{display:inline-flex;align-items:center;justify-content:center;height:30px;padding:0 11px;border:1px solid var(--line);border-radius:7px;background:#f8fafc;color:#334155;font-size:12px;line-height:1;text-decoration:none;cursor:pointer;white-space:nowrap}
  .oo-btn.primary{border-color:#bfdbfe;background:#eff6ff;color:var(--brand)}
  #oo-editor{flex:1;min-height:0;background:#e5e7eb}
  .oo-fail{display:none;padding:32px;max-width:760px;margin:40px auto;background:#fff;border:1px solid var(--line);border-radius:12px;color:#334155}
  .oo-fail b{display:block;margin-bottom:8px;color:#b91c1c}
  .oo-fail code{display:block;margin-top:10px;white-space:pre-wrap;word-break:break-word;font-size:12px;color:#64748b}
</style>
</head>
<body>
  <div class="oo-top">
    <span class="oo-dot"></span>
    <span class="oo-title" title="${title}">${title}<span class="oo-sub">OnlyOffice 在线编辑 · 自动保存</span></span>
    <div class="oo-actions">
      ${backUrl ? `<a class="oo-btn" href="${escapeHtml(backUrl)}">只读预览</a>` : ''}
      <button type="button" class="oo-btn primary" id="oo-save">保存到中枢</button>
      ${downloadUrl ? `<a class="oo-btn" href="${escapeHtml(downloadUrl)}">下载原文件</a>` : ''}
    </div>
  </div>
  <div id="oo-editor"></div>
  <div id="oo-fail" class="oo-fail"><b>OnlyOffice 编辑器没有启动</b><span>请确认文档服务可访问，且中枢访问地址与文档服务地址一致。</span><code id="oo-error"></code></div>
  <script src="${escapeHtml(onlyOfficeConfig().publicUrl)}/web-apps/apps/api/documents/api.js"></script>
  <script>
    (function(){
      var config = ${safeJson(config)};
      var page = ${safeJson({ saveUrl, saveKey })};
      function fail(err){
        var box=document.getElementById('oo-fail'), code=document.getElementById('oo-error');
        if(box) box.style.display='block';
        if(code) code.textContent=String(err && (err.stack || err.message) || err || '未知错误');
      }
      window.addEventListener('error', function(e){ fail(e.error || e.message) });
      if(!window.DocsAPI || !DocsAPI.DocEditor){ fail('DocsAPI 未加载，请检查 OnlyOffice publicUrl'); return }
      try {
        window.__jgOnlyOfficeEditor = new DocsAPI.DocEditor('oo-editor', config);
      } catch (err) { fail(err) }
      var saveBtn = document.getElementById('oo-save');
      if (saveBtn) {
        saveBtn.addEventListener('click', async function(){
          if (!window.__jgOnlyOfficeEditor) return fail('编辑器尚未就绪');
          if (!page.saveUrl) return fail('保存入口未配置');
          try {
            saveBtn.disabled = true;
            saveBtn.textContent = '保存中…';
            var response = await fetch(page.saveUrl, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ key: page.saveKey }),
            });
            var data = await response.json().catch(function(){ return {} });
            if (!response.ok || data.error) throw new Error(data.error || ('保存失败 HTTP ' + response.status));
            saveBtn.textContent = data.changed === false ? '无新改动' : '已保存';
            setTimeout(function(){ saveBtn.disabled = false; saveBtn.textContent = '保存到中枢'; }, 2200);
          } catch (err) {
            saveBtn.disabled = false;
            saveBtn.textContent = '保存到中枢';
            fail(err);
          }
        });
      }
    })();
  </script>
</body>
</html>`
}

function allowedSaveUrl(value) {
  let parsed
  try { parsed = new URL(String(value || '')) } catch { return false }
  if (!['http:', 'https:'].includes(parsed.protocol)) return false
  const cfg = onlyOfficeConfig()
  const allowedHosts = new Set(['127.0.0.1', 'localhost', 'host.docker.internal', 'jg-onlyoffice'])
  try { allowedHosts.add(new URL(cfg.internalUrl).hostname) } catch {}
  try { allowedHosts.add(new URL(cfg.publicUrl).hostname) } catch {}
  return allowedHosts.has(parsed.hostname)
}

export async function forceOnlyOfficeSave(key) {
  const config = onlyOfficeConfig()
  if (!config.secret) throw new Error('OnlyOffice JWT 密钥未配置')
  if (!String(key || '').trim()) throw new Error('OnlyOffice 保存缺少文档 key')
  const command = { c: 'forcesave', key: String(key) }
  const token = signOnlyOfficeJwt(command, config.secret)
  const response = await fetch(`${config.internalUrl}/command?shardkey=${encodeURIComponent(command.key)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...command, token }),
    signal: AbortSignal.timeout(30000),
  })
  if (!response.ok) throw new Error(`OnlyOffice 命令服务返回 HTTP ${response.status}`)
  const data = await response.json().catch(() => ({}))
  if (Number(data.error) === 4) return { ...data, changed: false }
  if (Number(data.error) !== 0) throw new Error(`OnlyOffice 强制保存失败，error=${data.error}`)
  return { ...data, changed: true }
}

export async function downloadOnlyOfficeSave(url) {  if (!allowedSaveUrl(url)) throw new Error('OnlyOffice 保存地址不在允许范围内')
  const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(120000) })
  if (!response.ok) throw new Error(`OnlyOffice 保存文件下载失败：HTTP ${response.status}`)
  const length = Number(response.headers.get('content-length') || 0)
  if (length > 300 * 1024 * 1024) throw new Error('OnlyOffice 保存文件超过 300MB 限制')
  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.length > 300 * 1024 * 1024) throw new Error('OnlyOffice 保存文件超过 300MB 限制')
  return { buffer, contentType: response.headers.get('content-type') || '' }
}
