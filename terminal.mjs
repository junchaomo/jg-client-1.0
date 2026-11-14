/**
 * 平台持久终端：每个管理员账号一个常驻 PowerShell 进程。
 * 这里只执行管理员在管理页显式输入的命令；命令与输出都是真实系统结果。
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'

const sessions = new Map()
const MAX_BUFFER = 1024 * 1024
const JOB_LIMIT_SCRIPT = fileURLToPath(new URL('./sandbox/job-limit.ps1', import.meta.url))
const TERM_MEMORY_MB = Math.max(256, Number(process.env.JG_TERM_MEMORY_MB || 1024))
const TERM_MAX_PROCESSES = Math.max(2, Math.min(32, Number(process.env.JG_TERM_MAX_PROCESSES || 8)))

function killTree(pid) {
  if (!pid) return
  if (process.platform === 'win32') {
    try { spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, timeout: 5000 }) } catch {}
    return
  }
  try { process.kill(pid, 'SIGKILL') } catch {}
}

function resourceSnapshot() {
  return new Promise((resolve) => {
    const script = 'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,WorkingSetSize | ConvertTo-Json -Compress'
    let settled = false
    let host = null
    const done = (value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(value)
    }
    const timer = setTimeout(() => done([]), 8000)
    try {
      host = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-Command', script], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] })
    } catch { return done([]) }
    let text = ''
    host.stdout.on('data', (chunk) => { text += String(chunk) })
    host.on('error', () => done([]))
    host.on('exit', () => {
      try {
        const rows = JSON.parse(text)
        done(Array.isArray(rows) ? rows : [rows])
      } catch { done([]) }
    })
  })
}

function treeUsage(rows, rootPid) {
  const byParent = new Map()
  const byId = new Map()
  for (const row of rows) {
    const id = Number(row.ProcessId)
    const parent = Number(row.ParentProcessId)
    if (!Number.isFinite(id)) continue
    byId.set(id, row)
    if (!byParent.has(parent)) byParent.set(parent, [])
    byParent.get(parent).push(id)
  }
  const queue = [Number(rootPid)]
  const seen = new Set()
  let memory = 0
  while (queue.length) {
    const id = queue.shift()
    if (seen.has(id)) continue
    seen.add(id)
    const row = byId.get(id)
    if (row) memory += Number(row.WorkingSetSize || 0)
    for (const child of byParent.get(id) || []) queue.push(child)
  }
  return { count: seen.size, memory }
}

function startResourceWatch(session, userId) {
  const limitBytes = TERM_MEMORY_MB * 1024 * 1024
  const timer = setInterval(async () => {
    if (!session.child?.pid || session.child.killed) return
    if (session.watchBusy) return
    session.watchBusy = true
    let rows = []
    try { rows = await resourceSnapshot() } finally { session.watchBusy = false }
    if (!rows.length) return
    const usage = treeUsage(rows, session.child.pid)
    if (usage.memory <= limitBytes && usage.count <= TERM_MAX_PROCESSES) return
    const reason = usage.memory > limitBytes
      ? `终端进程树内存超过 ${TERM_MEMORY_MB} MB，已终止`
      : `终端进程树超过 ${TERM_MAX_PROCESSES} 个进程，已终止`
    const done = session.pending
    session.pending = null
    session.resourceKilled = reason
    if (done) {
      clearTimeout(done.timer)
      done.resolve({ output: reason, exitCode: -1, timedOut: true, resourceLimit: true })
    }
    killTree(session.child.pid)
    try { session.jobHost?.kill() } catch {}
    clearInterval(session.watchTimer)
    sessions.delete(String(userId))
  }, 3000)
  timer.unref?.()
  session.watchTimer = timer
  return timer
}

function attachJobLimit(pid) {  return new Promise((resolve) => {
    let settled = false
    let output = ''
    let host = null
    const done = (result) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ ...result, host })
    }
    try {
      host = spawn('powershell.exe', [
        '-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', JOB_LIMIT_SCRIPT,
        '-TargetPid', String(pid), '-MemoryMB', String(TERM_MEMORY_MB), '-MaxProcesses', String(TERM_MAX_PROCESSES),
      ], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (error) {
      return done({ ok: false, error: String(error?.message || error) })
    }
    const timer = setTimeout(() => done({ ok: false, error: '等待 Job Object 就绪超时' }), 2500)
    host.stdout.on('data', (chunk) => {
      output = (output + String(chunk)).slice(-4096)
      if (output.includes('READY:')) done({ ok: true, memoryMB: TERM_MEMORY_MB, maxProcesses: TERM_MAX_PROCESSES })
    })
    host.stderr.on('data', (chunk) => {
      output = (output + String(chunk)).slice(-4096)
    })
    host.on('error', (error) => done({ ok: false, error: String(error?.message || error) }))
    host.on('exit', (code) => {
      if (!settled) done({ ok: false, error: `Job Object 宿主退出：${code ?? 'unknown'}` })
    })
  })
}

function cleanOutput(text, marker) {
  return String(text || '')
    .split(marker)[0]
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .split(/\r?\n/)
    .filter((line) => !/^PS [^\n]*>$/.test(line.trim()))
    .join('\n')
    .replace(marker, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function terminalStatus(userId, root) {
  const s = sessions.get(String(userId))
  const cwd = s?.cwd || root
  return {
    open: Boolean(s && !s.child.killed),
    pid: s?.child?.pid || null,
    cwd,
    startedAt: s?.startedAt || 0,
    root,
    limited: true,
    limitMode: s?.limit?.ok ? 'job-object' : 'process-watch',
    memoryMB: TERM_MEMORY_MB,
    maxProcesses: TERM_MAX_PROCESSES,
    limitError: s?.limit?.error || '',
  }
}

function startSession(userId, root) {
  if (!existsSync(root)) mkdirSync(root, { recursive: true })
  const child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-Command', '-'], {
    cwd: root,
    env: { ...process.env, TERM: 'dumb' },
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  const session = { child, cwd: root, root, startedAt: Date.now(), buffer: '', pending: null, limit: null, jobHost: null }
  session.limitReady = attachJobLimit(child.pid).then((limit) => {
    session.limit = limit
    session.jobHost = limit.host || null
    return limit
  })
  const onData = (chunk) => {
    session.buffer = (session.buffer + String(chunk)).slice(-MAX_BUFFER)
    if (session.pending) {
      const marker = session.pending.marker
      if (session.buffer.includes(marker)) {
        const done = session.pending
        session.pending = null
        clearTimeout(done.timer)
        const raw = session.buffer
        session.buffer = ''
        const exitText = raw.split(marker)[1]?.split('\n')[0]?.trim() || ''
        done.resolve({ output: cleanOutput(raw, marker), exitCode: Number.isFinite(Number(exitText)) ? Number(exitText) : null })
      }
    }
  }
  child.stdout.on('data', onData)
  child.stderr.on('data', onData)
  child.on('exit', () => {
    if (session.pending) {
      const done = session.pending
      session.pending = null
      clearTimeout(done.timer)
      done.resolve({ output: cleanOutput(session.buffer, done.marker), exitCode: -1, closed: true })
    }
    try { session.jobHost?.kill() } catch {}
    clearInterval(session.watchTimer)
    if (sessions.get(String(userId)) === session) sessions.delete(String(userId))
  })
  child.on('error', (error) => {
    if (session.pending) {
      const done = session.pending
      session.pending = null
      clearTimeout(done.timer)
      done.resolve({ output: `终端启动失败：${error.message}`, exitCode: -1, closed: true })
    }
    try { session.jobHost?.kill() } catch {}
    clearInterval(session.watchTimer)
    sessions.delete(String(userId))
  })
  sessions.set(String(userId), session)
  return session
}

export async function execTerminal(userId, root, command, timeoutMs = 60000) {
  const text = String(command || '').trim()
  if (!text) return { ok: false, error: '命令为空' }
  let session = sessions.get(String(userId))
  if (!session || session.child.killed) session = startSession(userId, root)
  if (session.limitReady) await session.limitReady
  if (session.pending) return { ok: false, error: '上一条命令仍在执行', busy: true }
  const id = randomBytes(4).toString('hex')
  const marker = `__JG_TERM_${id}__`
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      const done = session.pending
      session.pending = null
      killTree(session.child.pid)
      try { session.jobHost?.kill() } catch {}
      clearInterval(session.watchTimer)
      sessions.delete(String(userId))
      if (done) done.resolve({ output: cleanOutput(session.buffer, marker), exitCode: -1, timeout: true })
      resolve({ ok: false, timeout: true, output: `命令超过 ${Math.round(timeoutMs / 1000)} 秒，终端进程树已终止`, cwd: session.cwd })
    }, timeoutMs)
    session.pending = {
      marker,
      timer,
      resolve: (result) => {
        // 允许 `cd` 改变后续命令的工作目录；不读取进程内部 cwd，按命令结果更新。
        const cd = text.match(/^\s*(?:cd|Set-Location)\s+["']?([^"'\r\n]+)["']?\s*$/i)
        if (cd && !result.timeout && !result.closed) {
          const target = cd[1].trim()
          session.cwd = target === '..' ? session.cwd.replace(/[\\/][^\\/]+$/, '') || session.root : join(session.cwd, target)
        }
        resolve({
          ok: !result.timeout && !result.closed && (result.exitCode === 0 || result.exitCode === null),
          output: result.output,
          exitCode: result.exitCode,
          cwd: session.cwd,
          closed: Boolean(result.closed),
          timeout: Boolean(result.timeout),
          resourceLimit: Boolean(result.resourceLimit),
        })
        clearInterval(session.watchTimer)
        session.watchTimer = null
      },
    }
    if (!session.watchTimer) session.watchTimer = startResourceWatch(session, userId)
    session.child.stdin.write(`${text}\n`)
    session.child.stdin.write(`Write-Output "${marker}:$LASTEXITCODE"\n`)
  })
}

export function resetTerminal(userId) {
  const session = sessions.get(String(userId))
  if (session) {
    killTree(session.child.pid)
    try { session.jobHost?.kill() } catch {}
    clearInterval(session.watchTimer)
    sessions.delete(String(userId))
  }
  return { ok: true }
}
