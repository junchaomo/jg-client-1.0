#!/usr/bin/env node
/**
 * 九规智能中枢 · 已安装应用端到端冒烟
 *
 * 覆盖“真实客户端入口 → 应用标签 → 应用内核心动作 → 结果真实落盘”：
 *   - 先通过应用市场 UI 点击“启动并打开”，确认右侧出现应用标签；
 *   - 交通流量分析：在断面页上传测试视频、在画布上画计数线、点击“开始分析”，
 *     校验 outputs 目录中的 CSV 与 history.json 记录；
 *   - 材质提取：进入工作台、通过 UI 新建项目，校验 SQLite 项目记录，随后清理测试项目。
 *
 * 运行：
 *   npm run test:as-smoke
 *   npm run test:as-smoke -- --app traffic-flow
 *   npm run test:as-smoke -- --keep-open
 *
 * 可选环境变量：
 *   JG_SMOKE_VIDEO  交通冒烟视频，默认 D:\projects-test\traffic_counter\videos\synth_traffic.mp4
 *   JG_SMOKE_PORT   Electron CDP 端口，默认 9222
 *
 * 说明：
 *   - 需要客户端已登录；脚本不会代替登录，也不会修改账号权限。
 *   - 默认可重复、可清理：交通测试的记录/产物会移入回收站并彻底删除，上传的测试视频会删除；
 *     材质测试项目会移入回收站并清空，不向真实工作区留演示数据。
 *   - 使用 Node 22 内置 WebSocket 与 node:sqlite，不新增依赖。
 */
import { spawn, execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, rmSync, statSync, unlinkSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APPS_DIR = path.join(ROOT, 'data', 'apps')
const PORT = Number(process.env.JG_SMOKE_PORT || 9222)
const VIDEO = process.env.JG_SMOKE_VIDEO || path.join(ROOT, 'tests', 'fixtures', 'smoke-traffic.mp4')
const KEEP_OPEN = process.argv.includes('--keep-open')
const ONLY_APP = argValue('--app')

let ownedClient = null
let hubCdp = null
let currentApp = null

main().catch(async (error) => {
  console.error(`\n[as-smoke] 失败：${error?.stack || error}`)
  await cleanupAfterFailure()
  process.exitCode = 1
}).finally(async () => {
  await closeCdp()
  if (ownedClient && !KEEP_OPEN) stopOwnedClient()
})

async function main() {
  if (!existsSync(VIDEO)) throw new Error(`测试视频不存在：${VIDEO}（可用 JG_SMOKE_VIDEO 覆盖）`)
  if (!existsSync(path.join(ROOT, 'package.json'))) throw new Error(`客户端根目录不正确：${ROOT}`)

  await ensureClient()
  hubCdp = await connectToTarget(await requireHubTarget())
  await requireLoggedIn()
  await requireElectronBridge()

  const installed = await readInstalledApps()
  if (!installed.length) throw new Error('没有发现已安装应用')
  if (ONLY_APP && !installed.some((app) => app.appId === ONLY_APP || app.id === ONLY_APP || app.name === ONLY_APP)) {
    throw new Error(`未发现应用：${ONLY_APP}`)
  }

  const results = []
  for (const app of installed) {
    if (ONLY_APP && app.appId !== ONLY_APP && app.id !== ONLY_APP && app.name !== ONLY_APP) continue
    console.log(`\n[as-smoke] === ${app.name} (${app.appId}) ===`)
    currentApp = app
    const startedAt = Date.now()
    try {
      await resetApp(app)
      await openAppViaMarket(app)
      const runtime = await waitRuntime(app.id)
      const target = await waitForTarget(runtime.url)
      const detail = app.appId === 'traffic-flow'
        ? await runTrafficSmoke(app, runtime, target)
        : app.appId === 'jg-material-studio'
          ? await runMaterialSmoke(app, runtime, target)
          : (() => { throw new Error(`未配置该应用的核心动作：${app.appId}`) })()
      results.push({ app: app.name, appId: app.appId, status: 'passed', ms: Date.now() - startedAt, ...detail })
      console.log(`[as-smoke] PASS ${app.name} · ${detail.summary}`)
    } catch (error) {
      results.push({ app: app.name, appId: app.appId, status: 'failed', ms: Date.now() - startedAt, error: String(error?.message || error) })
      console.error(`[as-smoke] FAIL ${app.name} · ${error?.message || error}`)
      await cleanupAfterFailure()
      // 一个应用失败不掩盖另一个应用的真实结果；最后统一以非零退出。
    } finally {
      await stopAndCloseApp(app)
      currentApp = null
    }
  }

  const passed = results.filter((item) => item.status === 'passed').length
  console.log('\n[as-smoke] 结果：')
  for (const item of results) {
    console.log(`  ${item.status === 'passed' ? 'PASS' : 'FAIL'} ${item.app}${item.summary ? ` · ${item.summary}` : ''}${item.error ? ` · ${item.error}` : ''}`)
  }
  console.log(`[as-smoke] ${passed}/${results.length} 通过`)
  if (passed !== results.length) process.exitCode = 1
}

function argValue(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : ''
}

// ---------------------------------------------------------------------------
// Electron / CDP
// ---------------------------------------------------------------------------

async function ensureClient() {
  const existing = await hubTargetOrNull()
  if (existing) {
    console.log('[as-smoke] 复用已运行客户端与 CDP')
    return
  }
  const exe = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe')
  if (!existsSync(exe)) throw new Error(`Electron 不存在：${exe}`)
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  ownedClient = spawn(exe, [`--remote-debugging-port=${PORT}`, '.'], {
    cwd: ROOT,
    env,
    stdio: 'ignore',
    windowsHide: false,
  })
  ownedClient.once('error', (error) => console.error(`[as-smoke] Electron 启动错误：${error.message}`))
  const started = Date.now()
  await waitFor('客户端 CDP 就绪', async () => Boolean(await hubTargetOrNull()), 30_000, 500)
  console.log(`[as-smoke] 已启动客户端（PID ${ownedClient.pid}，CDP ${PORT}）`)
  if (Date.now() - started > 30_000) throw new Error('客户端启动超时')
}

function stopOwnedClient() {
  if (!ownedClient?.pid) return
  try {
    execFileSync('taskkill', ['/PID', String(ownedClient.pid), '/T', '/F'], { stdio: 'ignore' })
    console.log(`[as-smoke] 已关闭本次启动的客户端 PID ${ownedClient.pid}`)
  } catch {
    // 客户端可能已自行退出。
  }
  ownedClient = null
}

async function cdpTargets() {
  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/json/list`, { signal: AbortSignal.timeout(3000) })
    if (!response.ok) return []
    return await response.json()
  } catch {
    return []
  }
}

async function hubTargetOrNull() {
  return (await cdpTargets()).find((target) => target.type === 'page' && target.title.includes('九规智能中枢'))
}

async function requireHubTarget() {
  const hub = await hubTargetOrNull()
  if (!hub) throw new Error(`找不到中枢页面；请确认客户端已运行并开放 CDP ${PORT}`)
  return hub
}

async function waitForTarget(appUrl, timeout = 30_000) {
  const origin = new URL(appUrl).origin
  let found = null
  await waitFor('应用标签 target', async () => {
    const targets = await cdpTargets()
    found = targets.find((target) => target.type === 'page' && target.url.startsWith(origin + '/'))
    return Boolean(found)
  }, timeout, 500)
  return found
}

async function connectToTarget(target) {
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', () => reject(new Error(`CDP 连接失败：${target.title}`)), { once: true })
  })
  let seq = 0
  const waiters = new Map()
  socket.addEventListener('message', (event) => {
    let message
    try { message = JSON.parse(event.data) } catch { return }
    if (!message.id || !waiters.has(message.id)) return
    const waiter = waiters.get(message.id)
    waiters.delete(message.id)
    clearTimeout(waiter.timer)
    if (message.error) waiter.reject(new Error(JSON.stringify(message.error)))
    else waiter.resolve(message.result)
  })
  socket.addEventListener('close', () => {
    for (const waiter of waiters.values()) {
      clearTimeout(waiter.timer)
      waiter.reject(new Error('CDP 连接已关闭'))
    }
    waiters.clear()
  })
  const send = (method, params = {}, timeout = 30_000) => new Promise((resolve, reject) => {
    const id = ++seq
    const timer = setTimeout(() => {
      waiters.delete(id)
      reject(new Error(`CDP 超时：${method}`))
    }, timeout)
    waiters.set(id, { resolve, reject, timer })
    socket.send(JSON.stringify({ id, method, params }))
  })
  return {
    send,
    socket,
    target,
    async evaluate(expression, timeout = 30_000) {
      const result = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
        timeout,
      }, timeout + 5000)
      if (result.exceptionDetails) {
        const exception = result.exceptionDetails.exception
        throw new Error(exception?.description || result.exceptionDetails.text || '页面执行异常')
      }
      return result.result?.value
    },
    close() {
      try { socket.close() } catch { /* ignore */ }
    },
  }
}

async function closeCdp() {
  if (!hubCdp) return
  hubCdp.close()
  hubCdp = null
}

async function hubEval(expression, timeout = 30000) {
  if (!hubCdp) throw new Error('中枢 CDP 未连接')
  return hubCdp.evaluate(expression, timeout)
}

async function hubJson(expression, timeout = 30000) {
  return parseJson(await hubEval(expression, timeout), '中枢接口返回')
}

// ---------------------------------------------------------------------------
// 市场 UI、运行态与客户端登录
// ---------------------------------------------------------------------------

async function requireLoggedIn() {
  const text = await hubEval('document.body.innerText.slice(0, 400)')
  if (/登录|请输入账号|扫码登录/.test(text) && !/退出登录/.test(text)) {
    throw new Error('客户端未登录；请先在真实客户端完成登录后重跑')
  }
}

async function requireElectronBridge() {
  const bridge = await hubEval('Boolean(window.jgClient?.asApp?.open)')
  if (!bridge) throw new Error('当前不是 Electron 客户端视图，无法验证原生应用标签')
}

async function readInstalledApps() {
  const payload = await hubJson('fetch("/api/as/status").then(r => r.json()).then(j => JSON.stringify(j))')
  const items = payload.items || []
  return items.filter((item) => item.appId && item.name)
}

async function requireRuntime(id) {
  const runtime = await readRuntime(id)
  if (!runtime?.running || !runtime.url) throw new Error(`应用未进入 running：${JSON.stringify(runtime).slice(0, 300)}`)
  return runtime
}

async function waitRuntime(id, timeout = 90_000) {
  return waitFor('应用运行态 running', async () => {
    const runtime = await readRuntime(id)
    return runtime?.running && runtime.url ? runtime : null
  }, timeout, 500)
}

async function readRuntime(id) {
  const status = await hubJson(`fetch("/api/as/status?id=${encodeURIComponent(id)}").then(r => r.json()).then(j => JSON.stringify(j))`)
  return status.runtime || status.item?.runtime || status
}

async function resetApp(app) {
  console.log(`[as-smoke] 重置 ${app.name} 运行态与标签`)
  await hubEval(`fetch('/api/as/stop', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: ${JSON.stringify(app.id)}, force: true }),
  }).then(async r => r.text()).catch(e => String(e))`)
  await new Promise((resolve) => setTimeout(resolve, 1200))
  await hubEval('location.reload(); "reload"')
  await new Promise((resolve) => setTimeout(resolve, 1800))
  await waitFor('中枢页面重新加载', async () => Boolean(await hubEval('document.body.innerText.length > 0')), 15_000, 300)
}

async function openAppViaMarket(app) {
  console.log(`[as-smoke] 通过应用市场点击“启动并打开”`)
  await hubEval(`(() => {
    const rail = [...document.querySelectorAll('.rail-btn')].find(x => x.getAttribute('title') === '插件与技能')
      || [...document.querySelectorAll('[title]')].find(x => (x.getAttribute('title') || '').includes('插件与技能'))
    if (rail) rail.click()
    return rail ? 'ok' : 'no-rail'
  })()`)
  await waitFor('应用市场打开', async () => /已安装/.test(await hubEval('document.body.innerText.slice(0, 800)')), 15_000, 300)
  await hubEval(`(() => {
    const tab = [...document.querySelectorAll('button')].find(x => x.dataset.sktab === 'app')
    if (tab) tab.click()
    return tab ? 'ok' : 'no-tab'
  })()`)
  await waitFor('应用已安装列表', async () => await hubEval(`[...document.querySelectorAll('.pl-inst-name')].some(x => x.innerText.trim() === ${JSON.stringify(app.name)})`), 15_000, 300)
  await hubEval(`(() => {
    const item = [...document.querySelectorAll('.pl-inst')].find(x => (x.innerText || '').includes(${JSON.stringify(app.name)}))
    if (!item) return 'no-item'
    item.click()
    return 'ok'
  })()`)
  await waitFor('应用详情启动按钮', async () => await hubEval(`Boolean([...document.querySelectorAll('button[data-as-start]')][0])`), 15_000, 300)
  await hubEval(`(() => {
    const button = [...document.querySelectorAll('button[data-as-start]')][0]
    if (!button) return 'no-button'
    button.click()
    return 'ok'
  })()`)
  await waitFor('应用标签出现', async () => {
    const tabs = await hubEval(`[...document.querySelectorAll('.cb-tab')].map(x => x.innerText)`)
    return Array.isArray(tabs) && tabs.some((text) => text.includes(app.name))
  }, 45_000, 500)
  await hubEval(`(() => {
    const tab = [...document.querySelectorAll('.cb-tab')].find(x => (x.innerText || '').includes(${JSON.stringify(app.name)}))
    if (tab) tab.click()
    return tab ? 'ok' : 'no-tab'
  })()`)
  await sleep(500)
}

async function stopAndCloseApp(app) {
  try {
    console.log(`[as-smoke] 停止 ${app.name}`)
    await hubEval(`fetch('/api/as/stop', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: ${JSON.stringify(app.id)}, force: true }),
    }).then(async r => r.text()).catch(e => String(e))`)
    await new Promise((resolve) => setTimeout(resolve, 1200))
    await hubEval('location.reload(); "reload"')
    await new Promise((resolve) => setTimeout(resolve, 1200))
  } catch (error) {
    console.error(`[as-smoke] 清理运行态失败：${error.message}`)
    try { await hubEval('location.reload(); "reload"') } catch { /* ignore */ }
  }
}

async function cleanupAfterFailure() {
  if (!currentApp) return
  try {
    console.log(`[as-smoke] 失败后清理 ${currentApp.name}`)
    if (currentApp.appId === 'traffic-flow') await cleanupTrafficArtifacts(currentApp, null, true).catch(() => {})
    await stopAndCloseApp(currentApp)
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// 交通流量分析：真实 UI 上传 + 画线 + 开始分析 + 产物校验
// ---------------------------------------------------------------------------

async function runTrafficSmoke(app, runtime, target) {
  const appDir = appVersionDir(app, runtime.version)
  const uploadsBefore = snapshotFiles(path.join(appDir, 'uploads'))
  const historyBefore = readTrafficHistory(appDir)
  const outputsBefore = snapshotFiles(path.join(appDir, 'outputs'))
  let cdp = null
  let record = null
  let uploaded = []
  let evidence = null
  try {
    cdp = await connectToTarget(target)
    try { await cdp.send('Page.bringToFront') } catch { /* 非 Chromium 页面可忽略 */ }
    try { await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true }) } catch { /* 旧版本可忽略 */ }
    await cdp.evaluate('location.href = "/section"; "navigate"')
    await new Promise((resolve) => setTimeout(resolve, 1200))
    target = await waitForTarget(runtime.url)
    cdp.close()
    cdp = await connectToTarget(target)
    try { await cdp.send('Page.bringToFront') } catch { /* ignore */ }
    try { await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true }) } catch { /* ignore */ }
    await waitFor('交通断面页', async () => {
      const text = await cdp.evaluate('document.body.innerText.slice(0, 300)')
      return /交通流量分析工具/.test(text) && /选择视频/.test(text)
    }, 15_000, 400)

    console.log('[as-smoke] 交通：上传测试视频并等待画布')
    await cdp.send('DOM.enable')
    const documentNode = await cdp.send('DOM.getDocument', { depth: 0 })
    const input = await cdp.send('DOM.querySelector', { nodeId: documentNode.root.nodeId, selector: '#videoInput' })
    if (!input.nodeId) throw new Error('找不到 #videoInput')
    await cdp.send('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [VIDEO] })
    await waitFor('视频画布展开', async () => {
      const state = parseJson(await cdp.evaluate(`JSON.stringify((() => {
        const c = document.querySelector('#cv'); const r = c?.getBoundingClientRect();
        return { w: c?.width || 0, h: c?.height || 0, box: r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null,
                 preview: document.querySelector('#previewBox')?.style.display, err: document.querySelector('.err')?.innerText || '' }
      })())`), '画布状态')
      if (state.err) throw new Error(`上传视频失败：${state.err}`)
      return state.w > 0 && state.h > 0 && state.preview === 'block' && state.box?.w > 0 && state.box?.h > 0
    }, 60_000, 500)

    const rect = parseJson(await cdp.evaluate(`JSON.stringify((() => {
      const r = document.querySelector('#cv').getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    })())`), '画布坐标')
    await cdp.evaluate(`(() => {
      window.__smokeEvents = { down: 0, up: 0, move: 0 };
      document.querySelector('#cv').addEventListener('mousedown', () => { window.__smokeEvents.down += 1 });
      window.addEventListener('mouseup', () => { window.__smokeEvents.up += 1 });
      document.querySelector('#cv').addEventListener('mousemove', () => { window.__smokeEvents.move += 1 });
      return 'instrumented'
    })()`)
    console.log(`[as-smoke] 交通：画布 ${Math.round(rect.w)}x${Math.round(rect.h)}，点击两个点绘制计数线`)
    console.log('[as-smoke] 交通：命中元素 ' + await cdp.evaluate(`(() => {
      const el = document.elementFromPoint(${rect.x + rect.w * 0.1}, ${rect.y + rect.h * 0.5});
      return el ? (el.id || el.tagName) + ' @ ' + el.className : 'none'
    })()`))
    await clickCanvas(cdp, rect.x + rect.w * 0.1, rect.y + rect.h * 0.5)
    await sleep(300)
    console.log('[as-smoke] 交通：第一点后 ' + await cdp.evaluate('document.querySelector("#zoneHint")?.innerText || ""'))
    console.log('[as-smoke] 交通：事件 ' + await cdp.evaluate('JSON.stringify(window.__smokeEvents)'))
    await clickCanvas(cdp, rect.x + rect.w * 0.9, rect.y + rect.h * 0.5)
    await sleep(300)
    console.log('[as-smoke] 交通：第二点后 ' + await cdp.evaluate('document.querySelector("#zoneHint")?.innerText || ""'))
    await waitFor('计数线完成', async () => {
      const hint = await cdp.evaluate('document.querySelector("#zoneHint")?.innerText || ""')
      return hint.includes('已画 1 条计数线') || hint.includes('已完成 1 条计数线')
    }, 10_000, 300)
    await cdp.evaluate('document.querySelector("#btnDone")?.click(); "done"')
    // 冒烟只验证链路，不追求全帧精度；把抽帧间隔调到 20，避免 CPU 推理把一次冒烟拖到 5 分钟。
    await cdp.evaluate(`(() => {
      const skip = document.querySelector('#skip')
      if (!skip) return 'no-skip'
      const proto = skip.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
      setter.call(skip, '20')
      skip.dispatchEvent(new Event('input', { bubbles: true }))
      skip.dispatchEvent(new Event('change', { bubbles: true }))
      return skip.value
    })()`)
    await cdp.evaluate('document.querySelector("#submit")?.click(); "submit"')
    console.log('[as-smoke] 交通：已点击开始分析，等待真实分析结果')

    let lastStatusLog = 0
    await waitFor('交通分析结果', async () => {
      const state = parseJson(await cdp.evaluate(`JSON.stringify({
        body: document.body.innerText.slice(-1200),
        stats: document.querySelector('#rStats')?.innerText || '',
        csv: document.querySelector('#dlCsv')?.getAttribute('href') || '',
        spin: document.querySelector('#spin')?.style.display || '',
        spinMeta: document.querySelector('#spinMeta')?.innerText || '',
        pbar: document.querySelector('#pbarFill')?.style.width || '',
        err: document.querySelector('.err')?.innerText || ''
      })`), '分析结果')
      if (state.err && /分析失败|请求失败|请先/.test(state.err)) throw new Error(`交通分析失败：${state.err}`)
      if (Date.now() - lastStatusLog > 10_000) {
        lastStatusLog = Date.now()
        console.log(`[as-smoke] 交通：进行中 spin=${state.spin} pbar=${state.pbar} ${state.spinMeta}`)
      }
      return Boolean(state.stats) && Boolean(state.csv)
    }, 180_000, 1000)

    const resultState = parseJson(await cdp.evaluate(`JSON.stringify({
      stats: document.querySelector('#rStats')?.innerText || '',
      csv: document.querySelector('#dlCsv')?.getAttribute('href') || '',
      body: document.body.innerText.slice(-1000)
    })`), '分析结果快照')
    const uploadedAfter = snapshotFiles(path.join(appDir, 'uploads'))
    uploaded = diffSnapshot(uploadsBefore, uploadedAfter)
    const historyAfter = readTrafficHistory(appDir)
    record = historyAfter.find((item) => !historyBefore.some((before) => before.id === item.id))
    if (!record) throw new Error('分析成功但 history.json 没有新增记录')
    if (record.status !== 'success') throw new Error(`history.json 记录状态不是 success：${record.status}`)
    if (!record.csv_url) throw new Error('history.json 记录没有 csv_url')

    const csvPath = path.join(appDir, 'outputs', path.basename(new URL(record.csv_url, 'http://x').pathname))
    if (!existsSync(csvPath)) throw new Error(`CSV 未落盘：${csvPath}`)
    const csvBytes = statSync(csvPath).size
    if (csvBytes < 20) throw new Error(`CSV 为空或过小：${csvBytes} bytes`)
    const csvText = readFileSync(csvPath, 'utf8')
    if (!csvText.includes(',') || csvText.split(/\r?\n/).filter(Boolean).length < 2) throw new Error('CSV 不是有效表格')

    evidence = {
      runId: record.id,
      historyPath: path.join(appDir, 'data', 'history.json'),
      csvPath,
      csvBytes,
      csvHeader: csvText.split(/\r?\n/)[0].slice(0, 200),
      record: {
        id: record.id, status: record.status, total: record.total, pce: record.pce,
        csv_url: record.csv_url, created_at: record.created_at,
      },
      uiStats: resultState.stats.replace(/\s+/g, ' ').slice(0, 200),
      uploaded: uploaded.map((file) => path.basename(file)),
    }
    console.log(`[as-smoke] 交通：CSV ${csvBytes} bytes，历史记录 ${record.id}，UI：${evidence.uiStats}`)
    return {
      summary: `标签已开，分析完成，CSV ${csvBytes} bytes，history ${record.id}`,
      evidence,
    }
  } finally {
    if (cdp) cdp.close()
    // 先清理应用记录/产物，再由外层停止应用；失败路径同样清理。
    const allUploaded = diffSnapshot(uploadsBefore, snapshotFiles(path.join(appDir, 'uploads')))
    const allOutputs = diffSnapshot(outputsBefore, snapshotFiles(path.join(appDir, 'outputs')))
      .filter((file) => path.basename(file).includes('smoke-traffic'))
    await cleanupTrafficArtifacts(app, {
      record,
      uploaded: uploaded.length ? uploaded : allUploaded,
      outputs: allOutputs,
      historyBefore,
      outputsBefore,
    }).catch((error) => {
      console.error(`[as-smoke] 交通清理失败：${error.message}`)
      throw error
    })
  }
}

async function clickCanvas(cdp, x, y) {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 })
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 })
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 })
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 })
}

async function cleanupTrafficArtifacts(app, context, allowWithoutContext = false) {
  if (!app) return
  const appDir = appVersionDir(app)
  let record = context?.record || null
  let uploaded = context?.uploaded || []
  let outputs = context?.outputs || []
  try {
    if (record?.id) {
      console.log(`[as-smoke] 交通：把测试记录 ${record.id} 移入回收站并彻底删除`)
      await trafficApi(app, `/api/history/${encodeURIComponent(record.id)}`, { method: 'DELETE' })
      await trafficApi(app, `/api/trash/${encodeURIComponent(record.id)}`, { method: 'DELETE' })
      if (readTrafficHistory(appDir).some((item) => item.id === record.id)) throw new Error('测试历史记录未清除')
    }
  } finally {
    // 只删除本次上传新增的文件，绝不动用户原有上传。
    const uploadsDir = path.join(appDir, 'uploads')
    for (const file of uploaded) {
      if (file && existsSync(file) && path.dirname(file) === uploadsDir) {
        try { unlinkSync(file) } catch (error) { console.error(`[as-smoke] 删除测试上传失败：${file} · ${error.message}`) }
      }
    }
    const outputsDir = path.join(appDir, 'outputs')
    for (const file of outputs) {
      if (file && existsSync(file) && path.dirname(file) === outputsDir && path.basename(file).includes('smoke-traffic')) {
        try { unlinkSync(file) } catch (error) { console.error(`[as-smoke] 删除测试产物失败：${file} · ${error.message}`) }
      }
    }
    // 本地推理会在 uploads/_tmp 下生成 PyTorch 编译缓存；它不是用户上传内容，测试结束后一并移除。
    const cacheDir = path.join(uploadsDir, '_tmp')
    if (existsSync(cacheDir)) {
      try { rmSync(cacheDir, { recursive: true, force: true }) } catch (error) { console.error(`[as-smoke] 删除推理缓存失败：${cacheDir} · ${error.message}`) }
    }
  }
}

async function trafficApi(app, pathname, options = {}) {
  const runtime = await requireRuntime(app.id)
  const url = new URL(pathname, runtime.url).toString()
  const target = await waitForTarget(runtime.url)
  const cdp = await connectToTarget(target)
  try {
    const result = await cdp.evaluate(`fetch(${JSON.stringify(url)}, ${JSON.stringify({
      method: options.method || 'GET',
      headers: { 'content-type': 'application/json' },
    })}).then(async r => JSON.stringify({ status: r.status, text: (await r.text()).slice(0, 300) }))`)
    const parsed = parseJson(result, `交通 API ${pathname}`)
    if (parsed.status >= 400) throw new Error(`交通 API ${pathname} -> ${parsed.status}: ${parsed.text}`)
    return parsed
  } finally {
    cdp.close()
  }
}

function readTrafficHistory(appDir) {
  const file = path.join(appDir, 'data', 'history.json')
  if (!existsSync(file)) return []
  try {
    return JSON.parse(readFileSync(file, 'utf8')).runs || []
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// 材质提取：工作台 hydration + UI 新建项目 + SQLite 落盘 + 清理
// ---------------------------------------------------------------------------

async function runMaterialSmoke(app, runtime, target) {
  let cdp = await connectToTarget(target)
  let project = null
  try {
    await waitFor('材质落地页', async () => /AI材质提取/.test(await cdp.evaluate('document.title + "\\n" + document.body.innerText.slice(0, 300)')), 20_000, 400)
    console.log('[as-smoke] 材质：从落地页点击进入工作台（验证真实 hydration）')
    await cdp.evaluate(`(() => {
      const link = [...document.querySelectorAll('a[href="/app/extract"]')].find(x => /进入工作台|开始提取材质|进入材质工作台/.test(x.innerText))
      if (link) link.click(); else location.href = '/app/extract';
      return 'ok'
    })()`)
    await new Promise((resolve) => setTimeout(resolve, 1800))
    target = await waitForTarget(runtime.url)
    cdp.close()
    cdp = await connectToTarget(target)
    await waitFor('材质工作台 hydration', async () => {
      const text = await cdp.evaluate('document.body.innerText.slice(0, 500)')
      return /新建材质项目/.test(text) && Boolean(await cdp.evaluate('Boolean(document.querySelector("#overview-project"))'))
    }, 25_000, 500)

    const projectName = `端到端冒烟-${Date.now()}`
    console.log(`[as-smoke] 材质：通过 UI 新建项目「${projectName}」`)
    await cdp.evaluate(`(() => {
      const input = document.querySelector('#overview-project')
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      setter.call(input, ${JSON.stringify(projectName)})
      input.dispatchEvent(new Event('input', { bubbles: true }))
      const button = [...document.querySelectorAll('button')].find(x => x.innerText.includes('创建项目'))
      if (!button) throw new Error('找不到创建项目按钮')
      button.click()
      return 'ok'
    })()`)

    let createError = ''
    await waitFor('材质项目创建结果', async () => {
      const state = parseJson(await cdp.evaluate(`JSON.stringify({
        url: location.href,
        notice: [...document.querySelectorAll('[role="status"]')].map(x => x.innerText).join('\\n'),
        text: document.body.innerText.slice(0, 300)
      })`), '材质创建结果')
      if (state.notice && /来源站点|未获允许|创建失败|请从本机/.test(state.notice)) {
        createError = state.notice
        throw new Error(`材质创建项目失败：${state.notice}`)
      }
      return /\/app\/projects\/[0-9a-f-]{36}\/extract/.test(state.url)
    }, 20_000, 500)

    const pageInfo = parseJson(await cdp.evaluate(`JSON.stringify({
      url: location.href,
      text: document.body.innerText.slice(0, 500)
    })`), '材质项目页')
    const projectId = pageInfo.url.match(/\/app\/projects\/([0-9a-f-]{36})\/extract/)?.[1]
    if (!projectId) throw new Error('项目已创建但 URL 中没有项目 ID')
    if (!pageInfo.text.includes(projectName)) throw new Error('项目页没有显示测试项目名称')

    // 从页面拿到本地 token 与项目列表；同时校验 API 视角已可见。
    const apiConfig = parseJson(await cdp.evaluate(`fetch('/api/config').then(r => r.json()).then(j => JSON.stringify(j))`), '材质 config')
    if (!apiConfig.token) throw new Error('材质 /api/config 未返回本机 token')
    const token = apiConfig.token
    const projectList = parseJson(await cdp.evaluate(`fetch('/api/v1/projects', { headers: { Authorization: 'Bearer ' + ${JSON.stringify(token)} } })
      .then(async r => JSON.stringify({ status: r.status, body: await r.json() }))`), '材质项目列表')
    if (projectList.status >= 400) throw new Error(`材质项目列表读取失败：${projectList.status}`)
    project = (projectList.body.projects || []).find((item) => item.id === projectId)
    if (!project) throw new Error('项目已创建但 /api/v1/projects 中不存在')

    const status = parseJson(await cdp.evaluate(`fetch('/api/status').then(r => r.json()).then(j => JSON.stringify(j))`), '材质状态')
    const home = status.home
    if (!home) throw new Error('材质 /api/status 未返回 home，无法定位 SQLite')
    const dbPath = path.join(home, 'local-data', 'studio.sqlite')
    if (!existsSync(dbPath)) throw new Error(`材质 SQLite 不存在：${dbPath}`)
    const db = new DatabaseSync(dbPath, { readOnly: true })
    let row
    try {
      row = db.prepare('SELECT id, data FROM projects WHERE id = ?').get(projectId)
    } finally {
      db.close()
    }
    if (!row) throw new Error('UI 创建成功，但 SQLite projects 表没有对应记录')
    const dbProject = JSON.parse(row.data)
    if (dbProject.name !== projectName) throw new Error(`SQLite 项目名不一致：${dbProject.name}`)

    const evidence = {
      projectId,
      projectName,
      dbPath,
      dbRowId: row.id,
      apiProjectCount: projectList.body.projects.length,
      pageUrl: pageInfo.url,
      sqliteName: dbProject.name,
    }
    project.dbPath = dbPath
    console.log(`[as-smoke] 材质：SQLite 已落盘 ${dbPath} #${projectId}`)
    return {
      summary: `标签已开，项目已创建并落盘，SQLite #${projectId}`,
      evidence,
    }
  } finally {
    if (project) {
      await cleanupMaterialProject(cdp, project).catch((error) => {
        console.error(`[as-smoke] 材质清理失败：${error.message}`)
      })
    }
    if (cdp) cdp.close()
  }
}

async function cleanupMaterialProject(cdp, project) {
  console.log(`[as-smoke] 材质：清理测试项目 ${project.id}`)
  const config = await fetch('http://127.0.0.1:4191/api/config').then((response) => response.json())
  if (!config.token) throw new Error('材质 /api/config 未返回 token，无法清理测试项目')
  const headers = { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' }
  const deleted = await fetch(`http://127.0.0.1:4191/api/v1/projects/${project.id}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: project.name, status: 'deleted' }),
  })
  if (!deleted.ok) throw new Error(`材质删除测试项目失败：${deleted.status} ${(await deleted.text()).slice(0, 200)}`)

  // 删除接口只把项目标记为 deleted；SQLite 行可能已被其他清理流程删除，因此按行状态决定是否清空回收站。
  const dbRow = project.dbPath ? readMaterialProjectRow(project.dbPath, project.id) : null
  if (dbRow) {
    const emptied = await fetch('http://127.0.0.1:4191/api/v1/recycle-bin/empty', {
      method: 'POST',
      headers,
      body: JSON.stringify({ projectIds: [project.id] }),
    })
    if (!emptied.ok) throw new Error(`材质清空回收站失败：${emptied.status} ${(await emptied.text()).slice(0, 200)}`)
  }
  const listed = await fetch('http://127.0.0.1:4191/api/v1/projects', { headers }).then((response) => response.json())
  if ((listed.projects || []).some((item) => item.id === project.id)) throw new Error('材质测试项目仍在项目列表中')
  if (project.dbPath && readMaterialProjectRow(project.dbPath, project.id)) throw new Error('材质测试项目仍在 SQLite 中')
}

function readMaterialProjectRow(dbPath, projectId) {
  if (!existsSync(dbPath)) return null
  const db = new DatabaseSync(dbPath, { readOnly: true })
  try {
    return db.prepare('SELECT id, data FROM projects WHERE id = ?').get(projectId) || null
  } finally {
    db.close()
  }
}

// ---------------------------------------------------------------------------
// 通用
// ---------------------------------------------------------------------------

async function waitFor(label, check, timeout = 20_000, interval = 300) {
  const started = Date.now()
  let lastError = null
  while (Date.now() - started < timeout) {
    try {
      const value = await check()
      if (value) return value
    } catch (error) {
      lastError = error
    }
    await sleep(interval)
  }
  throw new Error(`等待超时：${label}${lastError ? ` · ${lastError.message}` : ''}`)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseJson(value, label) {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    throw new Error(`${label} 不是合法 JSON：${value.slice(0, 200)}`)
  }
}

function appVersionDir(app, version) {
  const current = JSON.parse(readFileSync(path.join(APPS_DIR, app.appId, 'current.json'), 'utf8'))
  return path.join(APPS_DIR, app.appId, 'versions', version || current.version)
}

function snapshotFiles(directory) {
  if (!existsSync(directory)) return []
  try {
    return readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(directory, entry.name))
  } catch {
    return []
  }
}

function diffSnapshot(before, after) {
  const known = new Set(before)
  return after.filter((file) => !known.has(file))
}
