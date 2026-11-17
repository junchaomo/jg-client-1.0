import { readFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { extractAppPackage, inspectPluginZip } from '../plugin-scan.mjs'
import { appCapabilities, appVersionDir, setCurrentAppVersion, startApp, releaseApp, shutdownApps, callAppTool } from '../as-runtime.mjs'

const id = 'as-python-sample'
const version = '1.0.0'
const zip = join(process.cwd(), 'as-poc', 'as-python-sample-1.0.0.zip')
const scan = inspectPluginZip(readFileSync(zip))
console.log('scan', JSON.stringify({ kind: scan.kind, appId: scan.appId, runtime: scan.runtime, checks: scan.checks }))
const target = appVersionDir(id, version)
mkdirSync(target, { recursive: true })
extractAppPackage(readFileSync(zip), target)
setCurrentAppVersion(id, version)
console.log('capabilities', JSON.stringify(appCapabilities(id).tools))

const a = await startApp({ id, userId: 'user-a' })
const b = await startApp({ id, userId: 'user-b' })
console.log('started', JSON.stringify({ samePid: a.pid === b.pid, a: { pid: a.pid, url: a.url }, b: { pid: b.pid, url: b.url } }))
for (const [user, started] of [['user-a', a], ['user-b', b]]) {
  const base = new URL(started.url).origin
  const health = await (await fetch(`${base}/health`)).json()
  console.log(user, 'health', JSON.stringify(health))
  console.log(user, 'open', await (await fetch(`${base}/api/open?asUser=${encodeURIComponent(user)}`, { method: 'POST' })).text())
}
console.log('page', (await (await fetch(a.url)).text()).includes(join(a.dataRoot, 'user-a')))
console.log('tool user-a', JSON.stringify(await callAppTool({ id, userId: 'user-a', tool: 'python.get_state' })))
console.log('tool user-b', JSON.stringify(await callAppTool({ id, userId: 'user-b', tool: 'python.get_state' })))
console.log('force stop', JSON.stringify(releaseApp({ id, leaseId: b.leaseId, force: true })))
await shutdownApps()
