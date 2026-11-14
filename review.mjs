import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, extname } from 'node:path'
import { spawnSync } from 'node:child_process'

const SOURCE_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.json'])
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'out', '.next', 'coverage', '.turbo', '.cache', '.tmp', 'vendor'])
const SKIP_FILE = /^(styles\.css|.*\.min\.js)$/i

function toPosix(value) {
  return String(value).replace(/\\/g, '/')
}

function listFiles(root, limit = 240) {
  const out = []
  const walk = (dir, depth) => {
    if (out.length >= limit || depth > 7) return
    let entries
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      if (out.length >= limit) return
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue
        walk(join(dir, entry.name), depth + 1)
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase()
        if (!SOURCE_EXT.has(ext) || SKIP_FILE.test(entry.name)) continue
        const full = join(dir, entry.name)
        try {
          if (statSync(full).size > 2 * 1024 * 1024) continue
        } catch { continue }
        out.push(full)
      }
    }
  }
  walk(root, 0)
  return out
}

function gitInfo(root) {
  if (!existsSync(join(root, '.git'))) return { available: false, changed: [], status: [], note: '目录不是 Git 仓库，按全量源码扫描。' }
  const status = spawnSync('git', ['-C', root, 'status', '--porcelain'], { encoding: 'utf8', timeout: 10000 })
  if (status.error || status.status !== 0) return { available: false, changed: [], status: [], note: 'Git 状态读取失败，按全量源码扫描。' }
  const rows = String(status.stdout || '').split(/\r?\n/).filter(Boolean)
  const changed = rows.map((line) => line.slice(3).trim()).filter(Boolean).map((p) => {
    const arrow = p.lastIndexOf(' -> ')
    return toPosix(arrow >= 0 ? p.slice(arrow + 4) : p)
  })
  return { available: true, changed, status: rows, note: `${rows.length} 个文件有工作区改动。` }
}

function finding(file, line, severity, rule, message, evidence) {
  return { file, line, severity, rule, message, evidence: String(evidence || '').trim().slice(0, 220) }
}

const RULES = [
  { rule: 'hardcoded-secret', severity: 'high', re: /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/, message: '疑似硬编码密钥/私钥，凭据不应进入源码与前端包。' },
  { rule: 'dynamic-eval', severity: 'high', re: /\beval\s*\(/, message: '使用 eval 执行动态字符串，存在代码注入风险。' },
  { rule: 'shell-exec', severity: 'medium', re: /child_process[^\n]*\bexec\s*\(/, message: '直接 exec 拼接命令，需确认参数是否来自外部输入。' },
  { rule: 'todo-marker', severity: 'low', re: /\b(TODO|FIXME|XXX)\b/, message: '未完成的待办标记，交付前应确认是否有意保留。' },
  { rule: 'debug-console', severity: 'low', re: /console\.(log|debug)\s*\(/, message: '调试输出，可能泄露运行细节或污染日志。' },
]

export function reviewCode(root, { scope = 'all', maxFiles = 160 } = {}) {
  const git = gitInfo(root)
  let files = listFiles(root)
  let changedOnly = false
  if (scope === 'changed' && git.available) {
    changedOnly = true
    const wanted = new Set(git.changed)
    files = files.filter((file) => wanted.has(toPosix(relative(root, file))))
    if (!files.length) {
      return {
        ok: true, root, scope, git, scanned: 0, changedOnly, findings: [],
        checks: { syntax: { checked: 0, failed: 0 }, json: { checked: 0, failed: 0 } },
        summary: { high: 0, medium: 0, low: 0, total: 0 },
        note: '工作区没有可扫描的源码改动；切换到全量扫描可查看整个项目。',
      }
    }
  }
  files = files.slice(0, maxFiles)
  const findings = []
  const checks = { syntax: { checked: 0, failed: 0 }, json: { checked: 0, failed: 0 } }
  for (const file of files) {
    const rel = toPosix(relative(root, file))
    const ext = extname(file).toLowerCase()
    let text = ''
    try { text = readFileSync(file, 'utf8') } catch { continue }
    if (ext === '.json') {
      checks.json.checked += 1
      try { JSON.parse(text) } catch (error) {
        checks.json.failed += 1
        findings.push(finding(rel, 1, 'high', 'invalid-json', `JSON 无法解析：${error.message}`, error.message))
      }
      continue
    }
    if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
      checks.syntax.checked += 1
      const run = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', timeout: 15000 })
      if (run.status !== 0) {
        checks.syntax.failed += 1
        const detail = String(run.stderr || run.stdout || '').split(/\r?\n/).filter(Boolean).slice(-3).join(' ')
        findings.push(finding(rel, 1, 'high', 'syntax-error', 'Node 语法检查失败。', detail))
      }
    }
    const lines = text.split(/\r?\n/)
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]
      for (const rule of RULES) {
        if (!rule.re.test(line)) continue
        // 本项目自身的安全扫描脚本会包含规则字面量，跳过规则定义行，避免自报。
        if (line.includes('hardcoded-secret') || line.includes('dynamic-eval') || line.includes('shell-exec')) continue
        findings.push(finding(rel, i + 1, rule.severity, rule.rule, rule.message, line.trim()))
      }
    }
  }
  const summary = {
    high: findings.filter((f) => f.severity === 'high').length,
    medium: findings.filter((f) => f.severity === 'medium').length,
    low: findings.filter((f) => f.severity === 'low').length,
    total: findings.length,
  }
  findings.sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.severity] - { high: 0, medium: 1, low: 2 }[b.severity] || a.file.localeCompare(b.file) || a.line - b.line))
  return {
    ok: true,
    root,
    scope,
    git,
    scanned: files.length,
    changedOnly,
    findings,
    checks,
    summary,
    note: `已扫描 ${files.length} 个源码文件；语法检查 ${checks.syntax.checked} 个，失败 ${checks.syntax.failed} 个；规则命中 ${findings.length} 条。`,
  }
}
