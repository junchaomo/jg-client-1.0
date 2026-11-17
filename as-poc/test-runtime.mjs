import { readFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { extractAppPackage } from '../plugin-scan.mjs'
import { appCapabilities, appVersionDir, setCurrentAppVersion, startApp, heartbeatApp, releaseApp, shutdownApps, callAppTool } from '../as-runtime.mjs'

const id = 'as-sample'
const version = '1.0.0'
const zip = join(process.cwd(), 'as-poc', 'as-sample-1.0.0.zip')
const target = appVersionDir(id, version)
mkdirSync(target, { recursive: true })
extractAppPackage(readFileSync(zip), target)
setCurrentAppVersion(id, version)
console.log('capabilities', JSON.stringify(appCapabilities(id).tools))

const a = await startApp({ id, userId: 'user-a' })
const b = await startApp({ id, userId: 'user-b' })
console.log(JSON.stringify({ samePid: a.pid === b.pid, a: { pid: a.pid, url: a.url, dataRoot: a.dataRoot, dataDir: a.dataDir }, b: { pid: b.pid, url: b.url, dataRoot: b.dataRoot, dataDir: b.dataDir } }))

for (const [user, started] of [['user-a', a], ['user-b', b]]) {
  const base = new URL(started.url).origin
  const res = await fetch(`${base}/api/open?asUser=${encodeURIComponent(user)}`, { method: 'POST' })
  console.log(user, res.status, await res.text())
}
const html = await (await fetch(a.url)).text()
console.log('page contains user-a dir:', html.includes(join(a.dataRoot, 'user-a')))
console.log('tool user-a', JSON.stringify(await callAppTool({ id, userId: 'user-a', tool: 'sample.get_state' })))
console.log('tool user-b', JSON.stringify(await callAppTool({ id, userId: 'user-b', tool: 'sample.get_state' })))
console.log(JSON.stringify({ hbA: heartbeatApp({ id, leaseId: a.leaseId }), stopA: releaseApp({ id, leaseId: a.leaseId, force: false }) }))
console.log(JSON.stringify({ stopB: releaseApp({ id, leaseId: b.leaseId, force: true }) }))
await shutdownApps()
