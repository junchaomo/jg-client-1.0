import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { randomBytes, scryptSync } from 'node:crypto'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const tempDir = mkdtempSync(join(tmpdir(), 'jg-cloud-browser-electron-'))
const dataDir = join(tempDir, 'data')
const userDataDir = join(tempDir, 'electron')
const downloadDir = join(tempDir, 'downloads')
let electron
let socket
let electronOutput = ''

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      server.close(() => resolve(port))
    })
  })
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function waitFor(label, fn, timeout = 30000) {
  const end = Date.now() + timeout
  let last
  while (Date.now() < end) {
    try { const value = await fn(); if (value) return value; last = value } catch (error) { last = error }
    await sleep(200)
  }
  throw new Error(`${label} 超时：${String(last?.message || last)}`)
}
async function targets(port) {
  try { return await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() } catch { return [] }
}
function solveCaptcha(question) {
  const match = String(question || '').replace(/\s+/g, ' ').match(/(-?\d+)\s*([+\-÷*×])\s*(-?\d+)/)
  const [a, b] = [Number(match[1]), Number(match[3])]
  return match[2] === '+' ? a + b : match[2] === '-' ? a - b : ['*', '×'].includes(match[2]) ? a * b : Math.floor(a / b)
}
async function connect(target) {
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', reject, { once: true })
  })
  let seq = 0
  const waiters = new Map()
  const events = []
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    const waiter = waiters.get(message.id)
    if (!waiter) { events.push(message); return }
    waiters.delete(message.id)
    clearTimeout(waiter.timer)
    if (message.error) waiter.reject(new Error(JSON.stringify(message.error)))
    else waiter.resolve(message.result)
  })
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq
    const timer = setTimeout(() => { waiters.delete(id); reject(new Error(`CDP ${method} 超时 ${JSON.stringify(params).slice(0, 300)}`)) }, 15000)
    waiters.set(id, { resolve, reject, timer })
    ws.send(JSON.stringify({ id, method, params }))
  })
  call.events = events
  call.socket = ws
  return call
}
async function evaluate(cdp, expression) {
  const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
  return result.result?.value
}
after(() => {
  try { socket?.close() } catch {}
  if (electron?.pid) { try { execFileSync('taskkill', ['/PID', String(electron.pid), '/T', '/F'], { stdio: 'ignore' }) } catch {} }
  try { rmSync(tempDir, { recursive: true, force: true }) } catch {}
})

test('真实 Electron：多标签、下载文件、密码管理、常用工具、AI 确认转交与会话生命周期', async () => {
  const port = await freePort()
  const debugPort = await freePort()
  process.env.JG_DATA_DIR = dataDir
  const db = await import(pathToFileURL(join(ROOT, 'db.mjs')).href)
  db.upsertAccount({ id: 'A-UI-ADMIN', name: '界面验收员', role: 'admin', unit: '测试单位', duty: '测试岗位' })
  db.setAccountUsername('A-UI-ADMIN', 'browserui')
  const salt = randomBytes(16).toString('hex')
  db.setAccountPassword('A-UI-ADMIN', `scrypt$${salt}$${scryptSync('CloudPass123', salt, 64).toString('hex')}`, false)
  db.closeStore()
  writeFileSync(join(dataDir, 'cloud-systems.json'), JSON.stringify({ items: [
    { id: 'SYS-UI', name: '界面验收系统', host: 'example.com', net: 'inet', scopes: ['public'] },
  ] }))

  const exe = join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe')
  const env = { ...process.env, JG_DATA_DIR: dataDir, JG_ELECTRON_USER_DATA_DIR: userDataDir, JG_BROWSER_DOWNLOAD_DIR: downloadDir, JG_PORT: String(port), JG_CLOUD_PORT: '0', JG_AGENT_OFFLINE: '1' }
  delete env.ELECTRON_RUN_AS_NODE
  electron = spawn(exe, [`--remote-debugging-port=${debugPort}`, '.'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: false })
  electron.stdout.on('data', (chunk) => { electronOutput += chunk.toString() })
  electron.stderr.on('data', (chunk) => { electronOutput += chunk.toString() })
  const hub = await waitFor('中枢窗口', async () => (await targets(debugPort)).find((item) => item.type === 'page' && item.title.includes('九规智能中枢')))
  const cdp = await connect(hub)
  socket = cdp.socket
  await waitFor('预加载桥接', () => evaluate(cdp, '!!window.jgClient?.browser'))
  const baseUrl = `http://127.0.0.1:${port}`
  const captcha = await (await fetch(`${baseUrl}/api/captcha`)).json()
  const login = await fetch(`${baseUrl}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'browserui', password: 'CloudPass123', captchaId: captcha.captchaId, captchaAnswer: String(solveCaptcha(captcha.question)) }) })
  assert.equal(login.status, 200, await login.text())
  const cookie = login.headers.getSetCookie()[0].split(';')[0]
  const [name, value] = cookie.split('=')
  await cdp('Network.enable')
  await cdp('Network.setCookie', { name, value, url: baseUrl })
  await cdp('Page.reload', { ignoreCache: true })
  await waitFor('登录后首页', () => evaluate(cdp, `!!document.querySelector('#mbCloudToggle')`))
  await evaluate(cdp, `document.querySelector('#mbCloudToggle').click()`)
  await waitFor('云浏览器首页', () => evaluate(cdp, `document.querySelectorAll('[data-web-site]').length >= 2`))
  const sites = await evaluate(cdp, `[...document.querySelectorAll('[data-web-site]')].slice(0,2).map(x=>x.dataset.webSite)`)
  assert.equal(sites.length, 2)
  const enabled = await evaluate(cdp, `['cbDownload','cbMore','cbToolFile','cbToolMore'].every(id=>document.getElementById(id)?.disabled===false)`)
  assert.equal(enabled, true)
  await evaluate(cdp, `document.querySelector('[data-web-site="${sites[0]}"]').click()`)
  try {
    await waitFor('首个网页标签', () => evaluate(cdp, `document.querySelectorAll('.cb-tab[data-tab^="web-"]').length === 1`))
  } catch (error) {
    const diagnostic = await evaluate(cdp, `({tabs:[...document.querySelectorAll('[data-cloud-tab]')].map(x=>({cls:x.className,id:x.dataset.cloudTab})),text:document.querySelector('#cloudPanel')?.innerText.slice(0,800),url:location.href})`)
    throw new Error(`${error.message}；${JSON.stringify(diagnostic)}`)
  }
  await evaluate(cdp, `document.querySelector('#cbNew').click()`)
  await waitFor('第二个首页', () => evaluate(cdp, `document.querySelectorAll('[data-web-site]').length >= 2`))
  await evaluate(cdp, `document.querySelector('[data-web-site="${sites[1]}"]').click()`)
  await waitFor('两个网页标签', () => evaluate(cdp, `document.querySelectorAll('.cb-tab[data-tab^="web-"]').length === 2`))
  await waitFor('两个独立原生网页目标', async () => (await targets(debugPort)).filter((item) => item.type === 'page' && item.url.startsWith('https://')).length === 2)
  const extWorker = await waitFor('uBOL 真实扩展 Service Worker', async () => (await targets(debugPort)).find((item) => item.type === 'service_worker' && item.url.startsWith('chrome-extension://') && item.url.includes('/js/background.js')))
  assert.ok(extWorker.url)
  const extPageTarget = (await targets(debugPort)).find((item) => item.type === 'page' && item.url.startsWith('https://'))
  const extCdp = await connect(extPageTarget)
  await extCdp('Network.enable')
  const adUrl = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'
  extCdp.events.length = 0
  const firstBlockedAd = await evaluate(extCdp, `fetch(${JSON.stringify(adUrl)}, {mode:'no-cors',cache:'no-store'}).then(r=>({resolved:true,type:r.type})).catch(e=>({resolved:false,error:String(e)}))`)
  assert.equal(firstBlockedAd.resolved, false, `首次加载 uBOL 后广告脚本必须失败：${JSON.stringify(firstBlockedAd)}`)
  await waitFor('首次加载规则产生 ERR_BLOCKED_BY_CLIENT', () => extCdp.events.some((item) => item.method === 'Network.loadingFailed' && /blocked_by_client/i.test(item.params?.errorText || '')))
  await evaluate(cdp, `window.jgClient.browser.loadExtensions([])`)
  const baselineAd = await waitFor('停用后广告脚本恢复访问', async () => {
    extCdp.events.length = 0
    const result = await evaluate(extCdp, `fetch(${JSON.stringify(adUrl)}, {mode:'no-cors',cache:'no-store'}).then(r=>({resolved:true,type:r.type})).catch(e=>({resolved:false,error:String(e)}))`)
    const errors = extCdp.events.filter((item) => item.method === 'Network.loadingFailed').map((item) => item.params?.errorText || '')
    if (errors.some((text) => /blocked_by_client/i.test(text))) return { resolved: false, fatal: errors }
    return result.resolved ? result : null
  }, 20000)
  assert.equal(baselineAd.resolved, true, `停用后的基线异常：${JSON.stringify(baselineAd)}`)
  await waitFor('未启用扩展时收到广告脚本响应', () => extCdp.events.some((item) => item.method === 'Network.responseReceived' && item.params?.response?.url === adUrl))

  await evaluate(cdp, `window.jgClient.browser.loadExtensions(['ext-ubol'])`)
  try {
    await waitFor('重新启用 uBOL', async () => (await targets(debugPort)).some((item) => item.type === 'service_worker' && item.url.startsWith('chrome-extension://') && item.url.includes('/js/background.js')), 5000)
  } catch (error) {
    const nowTargets = await targets(debugPort)
    throw new Error(`${error.message}；目标=${JSON.stringify(nowTargets.map(x=>({type:x.type,url:x.url})))}；日志=${electronOutput.slice(-2500)}`)
  }
  extCdp.events.length = 0
  const blockedAd = await evaluate(extCdp, `fetch(${JSON.stringify(adUrl)}, {mode:'no-cors',cache:'no-store'}).then(r=>({resolved:true,type:r.type})).catch(e=>({resolved:false,error:String(e)}))`)
  assert.equal(blockedAd.resolved, false, `启用 uBOL 后广告脚本必须失败：${JSON.stringify(blockedAd)}`)
  const blockedEvent = await waitFor('Chromium 确认 ERR_BLOCKED_BY_CLIENT', () => extCdp.events.find((item) => item.method === 'Network.loadingFailed' && /blocked_by_client/i.test(item.params?.errorText || '')))
  assert.ok(blockedEvent.params.errorText)

  const opened = await evaluate(cdp, `[...document.querySelectorAll('.cb-tab[data-tab^="web-"]')].map(x=>x.dataset.tab)`)
  assert.equal(new Set(opened).size, 2)
  await evaluate(cdp, `document.querySelector('[data-x="${opened[0]}"]').click()`)
  await waitFor('仅关闭目标标签', async () => (await targets(debugPort)).filter((item) => item.type === 'page' && item.url.startsWith('https://')).length === 1)
  assert.equal(await evaluate(cdp, `!!document.querySelector('.cb-tab[data-tab="${opened[1]}"]')`), true)
  await evaluate(cdp, `document.querySelector('.cb-tab[data-tab="${opened[1]}"]').click()`)
  await waitFor('网页工具栏', () => evaluate(cdp, `!!document.querySelector('[data-web-handoff]') && !!document.querySelector('#cbMore')`))
  await evaluate(cdp, `document.querySelector('#cbMore').click()`)
  await waitFor('更多工具菜单', () => evaluate(cdp, `!!document.querySelector('[data-cbm="find"]')`))
  await evaluate(cdp, `document.querySelector('[data-cbm="find"]').click()`)
  await waitFor('页内查找工具', () => evaluate(cdp, `!!document.querySelector('#cbFindInput')`))
  await evaluate(cdp, `document.querySelector('#cbFindInput').value='的';document.querySelector('#cbFindInput').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`)
  await sleep(300)
  const passwordTarget = await waitFor('密码测试网页目标', async () => (await targets(debugPort)).find((item) => item.type === 'page' && item.url.startsWith('https://')))
  const webCdp = await connect(passwordTarget)
  await waitFor('密码测试页面 DOM 就绪', () => evaluate(webCdp, `!!document.body`))
  await evaluate(webCdp, `(()=>{document.querySelector('#cbPasswordTest')?.remove();const f=document.createElement('form');f.id='cbPasswordTest';f.innerHTML='<input id="cbTestUser" type="text" autocomplete="username"><input id="cbTestPass" type="password" autocomplete="current-password"><button type="submit">登录</button>';f.addEventListener('submit',e=>e.preventDefault());document.body.appendChild(f);document.querySelector('#cbTestUser').value='cloud-user';document.querySelector('#cbTestPass').value='Cloud-Secret-789';f.querySelector('button').click()})()`)
  assert.equal(await evaluate(cdp, `!!document.querySelector('#cbPwSave')`), false, '默认自动保存不应再要求用户确认')
  const passwordFile = join(userDataDir, 'cloud-passwords-v1.json')
  const encryptedStore = await waitFor('系统加密密码文件', () => { try { const text = readFileSync(passwordFile, 'utf8'); return text.includes('Cloud-Secret-789') ? null : text } catch { return null } })
  assert.equal(encryptedStore.includes('Cloud-Secret-789'), false)
  assert.notEqual(JSON.parse(encryptedStore).items[0].password, Buffer.from('Cloud-Secret-789').toString('base64'))
  await webCdp('Runtime.evaluate', { expression: `document.querySelector('#cbTestUser').value='';document.querySelector('#cbTestPass').value=''` })
  await evaluate(cdp, `document.querySelector('#cbMore').click()`)
  await waitFor('密码管理入口', () => evaluate(cdp, `!!document.querySelector('[data-cbm="passwords"]')`))
  await evaluate(cdp, `document.querySelector('[data-cbm="passwords"]').click()`)
  await waitFor('同源密码可手动填充', () => evaluate(cdp, `!!document.querySelector('[data-pw-fill]:not([disabled])')`))
  const passwordId = await evaluate(cdp, `document.querySelector('[data-pw-fill]:not([disabled])').dataset.pwFill`)
  await evaluate(cdp, `document.querySelector('[data-pw-fill]:not([disabled])').click()`)
  try {
    await waitFor('密码真实填充到目标网页', () => evaluate(webCdp, `document.querySelector('#cbTestUser')?.value==='cloud-user' && document.querySelector('#cbTestPass')?.value==='Cloud-Secret-789'`), 5000)
  } catch (error) {
    const activeId = await evaluate(cdp, `document.querySelector('.cb-tab.on')?.dataset.tab`)
    const retry = await evaluate(cdp, `window.jgClient.browser.fillPassword(${JSON.stringify(activeId)},${JSON.stringify(passwordId)})`)
    const values = await evaluate(webCdp, `({url:location.href,user:document.querySelector('#cbTestUser')?.value,pass:document.querySelector('#cbTestPass')?.value,body:!!document.body})`)
    throw new Error(`${error.message}；重试=${JSON.stringify(retry)}；值=${JSON.stringify(values)}；Electron=${electronOutput.slice(-1200)}`)
  }

  await evaluate(cdp, `document.querySelector('#cbMore').click()`)
  await waitFor('截图工具入口', () => evaluate(cdp, `!!document.querySelector('[data-cbm="shot"]')`))
  await evaluate(cdp, `document.querySelector('[data-cbm="shot"]').click()`)
  await waitFor('截图真实写入受控目录', () => readdirSync(downloadDir).some((name) => name.endsWith('.png')))
  await evaluate(cdp, `document.querySelector('[data-web-download]').click()`)
  await waitFor('文件工具显示真实记录', () => evaluate(cdp, `document.querySelector('#cbDlList')?.innerText.includes('.png')`))
  await evaluate(cdp, `document.querySelector('[data-mclose]')?.click()`)
  await evaluate(cdp, `document.querySelector('[data-web-handoff]').click()`)
  try {
    await waitFor('AI 转交预览', () => evaluate(cdp, `!!document.querySelector('#cbAiExcerpt')`))
  } catch (error) {
    const diagnostic = await evaluate(cdp, `({active:document.querySelector('.cb-tab.on')?.dataset.tab,handoff:!!document.querySelector('[data-web-handoff]'),masks:[...document.querySelectorAll('[class*="mask"]')].map(x=>x.innerText.slice(0,200)),body:document.body.innerText.slice(-800)})`)
    throw new Error(`${error.message}；${JSON.stringify(diagnostic)}`)
  }
  assert.equal(await evaluate(cdp, `document.querySelector('#cbAiExcerpt').parentElement.innerText.includes('不会读取密码框、Cookie')`), true)
  await evaluate(cdp, `document.querySelector('#cbAiExcerpt').value='用户确认的正文';document.querySelector('#cbAiQuestion').value='请提炼重点';document.querySelector('#cbAiConfirm').click()`)
  await waitFor('确认后进入对话草稿', () => evaluate(cdp, `document.querySelector('#draft')?.value.includes('用户确认的正文') && document.querySelector('#draft')?.value.includes('请提炼重点')`))
  await evaluate(cdp, `document.querySelector('#mbCloudToggle').click()`)
  await waitFor('重新展开云浏览器', () => evaluate(cdp, `!!document.querySelector('#cbNew')`))
  await evaluate(cdp, `document.querySelector('#cbNew').click()`)
  await waitFor('企业系统目录', () => evaluate(cdp, `!!document.querySelector('[data-open="SYS-UI"]')`))
  await evaluate(cdp, `document.querySelector('[data-open="SYS-UI"]').click()`)
  await waitFor('企业系统会话标签', () => evaluate(cdp, `!!document.querySelector('[data-end^="CS-"]')`))
  const sessionId = await evaluate(cdp, `document.querySelector('[data-end^="CS-"]').dataset.end`)
  await waitFor('企业系统真实网页目标', async () => (await targets(debugPort)).filter((item) => item.type === 'page' && item.url.startsWith('https://')).length === 2)
  assert.equal(await evaluate(cdp, `document.body.innerText.includes('服务端注入')`), false)

  await evaluate(cdp, `document.querySelector('[data-end="${sessionId}"]').click()`)
  await waitFor('会话原生目标销毁', async () => (await targets(debugPort)).filter((item) => item.type === 'page' && item.url.startsWith('https://')).length === 1)
  const cloud = await (await fetch(`${baseUrl}/api/cloud`, { headers: { cookie } })).json()
  assert.equal(cloud.sessions.find((item) => item.id === sessionId)?.state, 'closed')
})
