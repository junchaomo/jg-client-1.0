/**
 * 插件包基础检查：解析 ZIP 目录与文本内容，不执行插件代码。
 * 不依赖第三方库；zip 的 store / deflate 两种压缩方式均支持。
 */
import { inflateRawSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { openSync, closeSync, readSync, fstatSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { normalizeAppCapabilities } from './app-contract.mjs'

const LEGACY_MAX_ENTRIES = 2000
const LEGACY_MAX_ENTRY_BYTES = 8 * 1024 * 1024
const LEGACY_MAX_TOTAL_BYTES = 48 * 1024 * 1024

// AS 应用包：代码与资源分层限额。资源默认放在应用包根目录的 assets/ 下。
// 代码包保持小上限，资源包单独放宽；总解压上限仍由 ZIP 解析器硬卡住。
export const APP_PACKAGE_POLICY = {
  codeEntryBytes: LEGACY_MAX_ENTRY_BYTES,
  codeTotalBytes: 64 * 1024 * 1024,
  assetEntryBytes: 64 * 1024 * 1024,
  totalBytes: 256 * 1024 * 1024,
  entries: 4000,
  assetsDir: 'assets',
}

const MAX_ENTRIES = APP_PACKAGE_POLICY.entries
const MAX_TOTAL_BYTES = APP_PACKAGE_POLICY.totalBytes
const TEXT_EXT = /\.(js|cjs|mjs|ts|tsx|jsx|json|yml|yaml|md|txt|xml|html|css|scss|less|py|sh|ps1|bat|cmd)$/i
const CODE_EXT = /\.(js|cjs|mjs|ts|tsx|jsx|html|css|scss|less|py|sh|ps1|bat|cmd)$/i
const DATA_EXT = /\.(json|yml|yaml|md|txt|xml)$/i
const ASSET_EXT = /\.(png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|otf|eot|mp3|mp4|webm|pdf|zip|gz|tgz|bin|dat|onnx|pt|pth|whl|wasm|map|glb|gltf|obj|fbx|dcm|tif|tiff)$/i
const SKILL_ASSET_EXT = /\.(md|txt|json|csv|ya?ml|png|jpe?g|gif|webp|svg|pdf)$/i
const SKILL_EXEC_EXT = /\.(js|cjs|mjs|ts|py|sh|ps1|bat|cmd|exe|dll|com|scr|jar|so|msi|vbs)$/i

function readUInt64(buffer, offset) {
  // ZIP64 extra 暂不支持；常规字段足够本场景。
  return Number(buffer.readBigUInt64LE(offset))
}

function findEocd(buffer) {
  const min = Math.max(0, buffer.length - 0xffff - 22)
  for (let i = buffer.length - 22; i >= min; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) return i
  }
  return -1
}

function parseCentralDirectory(buffer, limits = {}) {
  const maxEntries = Number(limits.maxEntries || MAX_ENTRIES)
  const maxTotalBytes = Number(limits.maxTotalBytes || MAX_TOTAL_BYTES)
  const eocd = findEocd(buffer)
  if (eocd < 0) throw new Error('不是有效的 ZIP 文件（缺少中央目录）')
  const count = buffer.readUInt16LE(eocd + 10)
  const cdOffset = buffer.readUInt32LE(eocd + 16)
  if (count > maxEntries) throw new Error(`ZIP 内文件数 ${count} 超过上限 ${maxEntries}`)
  if (cdOffset >= buffer.length) throw new Error('ZIP 中央目录偏移不合法')
  const entries = []
  let offset = cdOffset
  let total = 0
  for (let i = 0; i < count; i += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) break
    const flags = buffer.readUInt16LE(offset + 8)
    const method = buffer.readUInt16LE(offset + 10)
    const compSize = buffer.readUInt32LE(offset + 20)
    const uncompSize = buffer.readUInt32LE(offset + 24)
    const nameLen = buffer.readUInt16LE(offset + 28)
    const extraLen = buffer.readUInt16LE(offset + 30)
    const commentLen = buffer.readUInt16LE(offset + 32)
    const localOffset = buffer.readUInt32LE(offset + 42)
    const name = buffer.subarray(offset + 46, offset + 46 + nameLen).toString('utf8')
    entries.push({ name, method, compSize, uncompSize, flags, localOffset })
    total += uncompSize
    if (total > maxTotalBytes) throw new Error(`ZIP 解压后体积超过 ${Math.round(maxTotalBytes / 1024 / 1024)} MB`)
    offset += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

class ZipFile {
  constructor(filePath) {
    this.path = filePath
    this.fd = openSync(filePath, 'r')
    try {
      this.size = Number(fstatSync(this.fd).size || 0)
      this.entries = this.readCentralDirectory()
    } catch (error) {
      this.close()
      throw error
    }
  }

  readRange(start, length) {
    const out = Buffer.alloc(Math.max(0, length))
    let offset = 0
    while (offset < out.length) {
      const chunk = readSync(this.fd, out, offset, out.length - offset, start + offset)
      if (chunk <= 0) throw new Error('ZIP 文件读取中断')
      offset += chunk
    }
    return out
  }

  readCentralDirectory() {
    if (this.size < 22) throw new Error('不是有效的 ZIP 文件（文件过小）')
    const tailLength = Math.min(this.size, 0xffff + 22)
    const tailStart = this.size - tailLength
    const tail = this.readRange(tailStart, tailLength)
    const eocd = findEocd(tail)
    if (eocd < 0) throw new Error('不是有效的 ZIP 文件（缺少中央目录）')
    const count = tail.readUInt16LE(eocd + 10)
    const cdSize = tail.readUInt32LE(eocd + 12)
    const cdOffset = tail.readUInt32LE(eocd + 16)
    if (count > MAX_ENTRIES) throw new Error(`ZIP 内文件数 ${count} 超过上限 ${MAX_ENTRIES}`)
    if (cdOffset + cdSize > this.size) throw new Error('ZIP 中央目录偏移不合法')
    const cd = this.readRange(cdOffset, cdSize)
    const entries = []
    let offset = 0
    let total = 0
    for (let i = 0; i < count; i += 1) {
      if (offset + 46 > cd.length || cd.readUInt32LE(offset) !== 0x02014b50) break
      const flags = cd.readUInt16LE(offset + 8)
      const method = cd.readUInt16LE(offset + 10)
      const compSize = cd.readUInt32LE(offset + 20)
      const uncompSize = cd.readUInt32LE(offset + 24)
      const nameLen = cd.readUInt16LE(offset + 28)
      const extraLen = cd.readUInt16LE(offset + 30)
      const commentLen = cd.readUInt16LE(offset + 32)
      const localOffset = cd.readUInt32LE(offset + 42)
      const name = cd.subarray(offset + 46, offset + 46 + nameLen).toString('utf8')
      entries.push({ name, method, compSize, uncompSize, flags, localOffset })
      total += uncompSize
      if (total > MAX_TOTAL_BYTES) throw new Error(`ZIP 解压后体积超过 ${Math.round(MAX_TOTAL_BYTES / 1024 / 1024)} MB`)
      offset += 46 + nameLen + extraLen + commentLen
    }
    return entries
  }

  readEntry(entry) {
    const off = entry.localOffset
    if (off + 30 > this.size) return null
    const header = this.readRange(off, 30)
    if (header.readUInt32LE(0) !== 0x04034b50) return null
    const nameLen = header.readUInt16LE(26)
    const extraLen = header.readUInt16LE(28)
    const start = off + 30 + nameLen + extraLen
    if (start + entry.compSize > this.size) return null
    const compressed = entry.compSize ? this.readRange(start, entry.compSize) : Buffer.alloc(0)
    if (!compressed.length) return Buffer.alloc(0)
    if (entry.method === 0) return compressed
    if (entry.method === 8) return inflateRawSync(compressed)
    return null
  }

  close() {
    if (this.fd !== null) {
      try { closeSync(this.fd) } catch {}
      this.fd = null
    }
  }
}

function extractEntry(buffer, entry) {
  if (buffer && typeof buffer.readEntry === 'function') return buffer.readEntry(entry)
  const off = entry.localOffset
  if (off + 30 > buffer.length || buffer.readUInt32LE(off) !== 0x04034b50) return null
  const nameLen = buffer.readUInt16LE(off + 26)
  const extraLen = buffer.readUInt16LE(off + 28)
  const start = off + 30 + nameLen + extraLen
  const compressed = buffer.subarray(start, start + entry.compSize)
  if (!compressed.length) return Buffer.alloc(0)
  if (entry.method === 0) return compressed
  if (entry.method === 8) return inflateRawSync(compressed)
  return null
}

function normalizedNames(entries) {
  return entries
    .map((entry) => entry.name.replace(/\\/g, '/'))
    .filter((name) => !name.endsWith('/') && !name.startsWith('__MACOSX/'))
}

function findSkillRoot(names) {
  const hits = names.filter((name) => name === 'SKILL.md' || name.endsWith('/SKILL.md'))
  if (hits.length !== 1) {
    return { error: hits.length ? '技能包内存在多个 SKILL.md，无法确定根目录' : '技能包根目录缺少 SKILL.md' }
  }
  return { root: hits[0].slice(0, -'SKILL.md'.length) }
}

function findBundleRoot(names) {
  const hits = names.filter((name) => name.split('/').pop() === 'package.json')
  if (!hits.length) return { error: '插件包根目录缺少 package.json' }
  const sorted = hits.map((name) => ({ name, depth: name.split('/').length })).sort((a, b) => a.depth - b.depth)
  const shallow = sorted[0]
  if (sorted.filter((item) => item.depth === shallow.depth).length > 1) {
    return { error: '插件包内存在多个同级 package.json，无法确定根目录' }
  }
  return { root: shallow.name.slice(0, -'package.json'.length) }
}

function safeBundleRel(name, root) {
  if (root && !name.startsWith(root)) return null
  const rel = root ? name.slice(root.length) : name
  if (!rel || rel.split('/').includes('..') || rel.startsWith('/') || /^[A-Za-z]:/.test(rel)) {
    throw new Error(`插件包包含非法路径：${name}`)
  }
  return rel
}

function findAppRoot(names) {
  const hits = names.filter((name) => name.split('/').pop() === 'app.json')
  if (!hits.length) return { error: '应用包根目录缺少 app.json' }
  const sorted = hits.map((name) => ({ name, depth: name.split('/').length })).sort((a, b) => a.depth - b.depth)
  const shallow = sorted[0]
  if (sorted.filter((item) => item.depth === shallow.depth).length > 1) {
    return { error: '应用包内存在多个同级 app.json，无法确定根目录' }
  }
  return { root: shallow.name.slice(0, -'app.json'.length) }
}

function appSafeRel(value) {
  const rel = String(value || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '')
  if (!rel || rel.split('/').includes('..') || rel.startsWith('/') || /^[A-Za-z]:/.test(rel)) return ''
  return rel
}

function inspectAppZipEntries(buffer, entries) {
  const names = normalizedNames(entries)
  const found = findAppRoot(names)
  const issues = []
  if (found.error) issues.push(found.error)
  const root = found.root || ''
  const appEntry = names.find((name) => name === `${root}app.json`)
  let appJson = null
  if (appEntry) {
    const entry = entries.find((item) => item.name.replace(/\\/g, '/') === appEntry)
    try {
      const data = extractEntry(buffer, entry)
      if (data) appJson = JSON.parse(data.toString('utf8'))
    } catch (error) {
      issues.push(`app.json 解析失败：${error.message}`)
    }
  }

  const app = appJson && typeof appJson === 'object' ? appJson : {}
  const required = ['id', 'name', 'version', 'runtime', 'entry']
  for (const key of required) {
    if (!String(app[key] || '').trim()) issues.push(`app.json 缺少 ${key}`)
  }
  const runtime = String(app.runtime || '').trim().toLowerCase()
  if (runtime && !['node', 'python'].includes(runtime)) issues.push(`不支持的 runtime：${runtime}`)
  const capabilities = normalizeAppCapabilities(app)
  for (const issue of capabilities.issues) issues.push(`应用能力：${issue}`)
  const manifestPass = !issues.length

  const appDirRel = appSafeRel(app.appDir || '.')
  const entryRel = appSafeRel(app.entry || '')
  const entryPath = appDirRel && appDirRel !== '.'
    ? `${root}${appDirRel}/${entryRel}`
    : `${root}${entryRel}`
  const entryExists = Boolean(entryRel && names.includes(entryPath))
  if (entryRel && !entryExists) issues.push(`应用入口不存在：${entryPath}`)
  const entryPass = entryExists

  const permissions = app.permissions && typeof app.permissions === 'object' && !Array.isArray(app.permissions)
  const permVerdict = permissions ? '通过' : '待复核'
  const permNote = permissions ? '已声明应用权限' : 'app.json 未声明 permissions，需管理员核对'

  const assetsDirRaw = app.assetsDir === undefined ? APP_PACKAGE_POLICY.assetsDir : String(app.assetsDir || '')
  const assetsDirRel = appSafeRel(assetsDirRaw)
  const policyIssues = []
  if (!assetsDirRel) policyIssues.push('app.json 的 assetsDir 不是合法相对路径')
  const effectiveAssetsDir = assetsDirRel || APP_PACKAGE_POLICY.assetsDir
  const appFiles = entries.map((entry) => {
    const name = entry.name.replace(/\\/g, '/')
    const rel = root && name.startsWith(root) ? name.slice(root.length) : (root ? '' : name)
    return { entry, name, rel }
  }).filter((item) => item.rel && !item.rel.endsWith('/') && !item.rel.startsWith('__MACOSX/'))
  let codeBytes = 0
  let assetBytes = 0
  let codeFiles = 0
  let assetFiles = 0
  const assetItems = []
  for (const item of appFiles) {
    const { entry, rel } = item
    const inAssets = rel.startsWith(`${effectiveAssetsDir}/`)
    const isCode = CODE_EXT.test(rel) || (DATA_EXT.test(rel) && !inAssets)
    const isAsset = !isCode && (ASSET_EXT.test(rel) || inAssets)
    if (isAsset) {
      assetFiles += 1
      assetBytes += entry.uncompSize
      assetItems.push({ rel, entry })
      if (entry.uncompSize > APP_PACKAGE_POLICY.assetEntryBytes) {
        policyIssues.push(`资源文件 ${rel} 超过单文件上限 ${Math.round(APP_PACKAGE_POLICY.assetEntryBytes / 1024 / 1024)} MB`)
      }
    } else {
      codeFiles += 1
      codeBytes += entry.uncompSize
      if (entry.uncompSize > APP_PACKAGE_POLICY.codeEntryBytes) {
        policyIssues.push(`代码文件 ${rel} 超过单文件上限 ${Math.round(APP_PACKAGE_POLICY.codeEntryBytes / 1024 / 1024)} MB，不能靠跳过扫描放行`)
      }
    }
  }
  if (codeBytes > APP_PACKAGE_POLICY.codeTotalBytes) {
    policyIssues.push(`代码总量 ${Math.round(codeBytes / 1024 / 1024)} MB 超过 ${Math.round(APP_PACKAGE_POLICY.codeTotalBytes / 1024 / 1024)} MB`)
  }
  const totalBytes = entries.reduce((sum, entry) => sum + entry.uncompSize, 0)
  if (totalBytes > APP_PACKAGE_POLICY.totalBytes) {
    policyIssues.push(`解压总量 ${Math.round(totalBytes / 1024 / 1024)} MB 超过 ${Math.round(APP_PACKAGE_POLICY.totalBytes / 1024 / 1024)} MB`)
  }
  let packagePolicyPass = policyIssues.length === 0
  let packagePolicyNote = packagePolicyPass
    ? `代码 ${codeFiles} 个 / ${Math.round(codeBytes / 1024 / 1024)} MB，资源 ${assetFiles} 个 / ${Math.round(assetBytes / 1024 / 1024)} MB；单文件代码 ${Math.round(APP_PACKAGE_POLICY.codeEntryBytes / 1024 / 1024)} MB、资源 ${Math.round(APP_PACKAGE_POLICY.assetEntryBytes / 1024 / 1024)} MB`
    : policyIssues.slice(0, 4).join('；')

  const dangerous = names.filter((n) => /\.(exe|dll|ps1|bat|cmd|com|scr|jar|so|msi)$/i.test(n))
  if (dangerous.length) policyIssues.push(`包内含可执行文件：${dangerous.slice(0, 6).join('、')}`)
  const assetHashes = []
  let hashFailures = 0
  for (const item of assetItems) {
    if (item.entry.uncompSize > APP_PACKAGE_POLICY.assetEntryBytes) continue
    try {
      const data = extractEntry(buffer, item.entry)
      if (data) assetHashes.push({ path: item.rel, size: item.entry.uncompSize, sha256: createHash('sha256').update(data).digest('hex') })
    } catch {
      hashFailures += 1
    }
  }
  if (hashFailures) policyIssues.push(`${hashFailures} 个资源文件无法计算 SHA-256`)
  const malwareScan = {
    status: 'not-configured',
    note: '未配置病毒扫描器；当前只做资源大小、扩展名与 SHA-256 校验',
  }
  packagePolicyPass = policyIssues.length === 0
  packagePolicyNote = packagePolicyPass
    ? `代码 ${codeFiles} 个 / ${Math.round(codeBytes / 1024 / 1024)} MB，资源 ${assetFiles} 个 / ${Math.round(assetBytes / 1024 / 1024)} MB；资源 SHA-256 ${assetHashes.length}/${assetItems.length}；病毒扫描未配置`
    : policyIssues.slice(0, 4).join('；')
  const externalRefs = []
  const dynamicExec = []
  for (const item of appFiles) {
    const { entry, rel } = item
    if (!TEXT_EXT.test(rel)) continue
    if (entry.uncompSize > APP_PACKAGE_POLICY.codeEntryBytes) continue
    try {
      const data = extractEntry(buffer, entry)
      const text = data ? data.toString('utf8') : ''
      if (/https?:\/\//i.test(text)) externalRefs.push(rel)
      if (/eval\s*\(|new\s+Function\s*\(|child_process|require\s*\(\s*['"](?:http|https|net|tls)['"]\s*\)/.test(text)) dynamicExec.push(rel)
    } catch {}
  }
  const scanVerdict = !manifestPass || !entryPass || !packagePolicyPass
    ? '不通过'
    : dangerous.length || externalRefs.length || dynamicExec.length
      ? '待复核'
      : '通过'
  const scanNotes = [
    dangerous.length ? `含可执行文件：${dangerous.slice(0, 6).join('、')}` : '',
    externalRefs.length ? `含外部网络地址：${externalRefs.slice(0, 6).join('、')}` : '',
    dynamicExec.length ? `含动态执行/子进程调用：${dynamicExec.slice(0, 6).join('、')}` : '',
    policyIssues.length ? policyIssues.slice(0, 4).join('；') : '',
    issues.length ? issues.slice(0, 4).join('；') : '',
  ].filter(Boolean).join('；') || '未发现可执行文件、外部网络地址或动态执行'
  const allIssues = [...issues, ...policyIssues]

  return {
    ok: true,
    kind: 'app',
    appId: String(app.id || '').trim(),
    appName: String(app.name || '').trim(),
    appVersion: String(app.version || '').trim(),
    appDir: appDirRel || '.',
    entry: entryRel,
    runtime,
    appCapabilities: {
      declared: capabilities.declared,
      tools: capabilities.tools.length,
      resources: capabilities.resources.length,
    },
    packagePolicy: {
      assetsDir: effectiveAssetsDir,
      codeBytes,
      assetBytes,
      codeFiles,
      assetFiles,
      hashAlgorithm: 'sha256',
      assetHashes,
      malwareScan,
      limits: APP_PACKAGE_POLICY,
    },
    entries: names.slice(0, 200),
    entryCount: entries.length,
    totalBytes,
    checks: [
      ['AS App 清单', manifestPass ? '通过' : '不通过', manifestPass ? `app.json 必填字段完整（${runtime}）` : allIssues.join('；')],
      ['应用入口', entryPass ? '通过' : '不通过', entryPass ? `${entryPath}` : `找不到 ${entryPath || '有效入口'}`],
      ['应用能力', capabilities.declared ? capabilities.verdict : '待复核', capabilities.note],
      ['包体策略', packagePolicyPass ? '通过' : '不通过', packagePolicyNote],
      ['权限声明', permVerdict, permNote],
      ['静态安全扫描', scanVerdict, scanNotes],
      ['隔离测试', '未执行', '当前版本只做静态检查，不执行应用代码；启动与健康探测由 AS Runtime 完成'],
    ],
  }
}

export function extractAppPackage(input, targetDir) {
  let archive = null
  try {
  let entries
  if (typeof input === 'string') {
    archive = new ZipFile(input)
    entries = archive.entries
  } else {
    entries = parseCentralDirectory(input, {
      maxEntries: APP_PACKAGE_POLICY.entries,
      maxTotalBytes: APP_PACKAGE_POLICY.totalBytes,
    })
  }
  const source = archive || input
  const scan = inspectAppZipEntries(source, entries)
  const failed = (scan.checks || []).find((check) => check[1] === '不通过')
  if (failed) throw new Error(`应用包未通过包体或安全检测：${failed[0]}（${failed[2]}）`)
  const names = normalizedNames(entries)
  const found = findAppRoot(names)
  if (found.error) throw new Error(found.error)
  const root = found.root || ''
  const written = []
  for (const entry of entries) {
    const name = entry.name.replace(/\\/g, '/')
    if (name.endsWith('/') || name.startsWith('__MACOSX/')) continue
    const rel = safeBundleRel(name, root)
    if (!rel) continue
    const data = extractEntry(source, entry)
    if (!data) throw new Error(`应用包文件解压失败：${rel}`)
    const out = join(targetDir, ...rel.split('/'))
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, data)
    written.push(rel)
  }
  if (!written.includes('app.json')) throw new Error('应用包根目录缺少 app.json')
  const hashes = scan.packagePolicy?.assetHashes || []
  const policy = scan.packagePolicy?.limits || APP_PACKAGE_POLICY
  writeFileSync(join(targetDir, '.as-assets.json'), `${JSON.stringify({
    assetsDir: scan.packagePolicy?.assetsDir || policy.assetsDir,
    hashAlgorithm: 'sha256',
    assets: hashes,
    malwareScan: scan.packagePolicy?.malwareScan || { status: 'not-configured' },
    installedAt: new Date().toISOString(),
  }, null, 2)}\n`, 'utf8')
  return written
  } finally {
    if (archive) archive.close()
  }
}

function inspectSkillZipEntries(buffer, entries) {
  const names = normalizedNames(entries)
  const found = findSkillRoot(names)
  const issues = []
  const totalBytes = entries.reduce((sum, entry) => sum + entry.uncompSize, 0)
  if (entries.length > LEGACY_MAX_ENTRIES) issues.push(`技能包文件数 ${entries.length} 超过上限 ${LEGACY_MAX_ENTRIES}`)
  if (totalBytes > LEGACY_MAX_TOTAL_BYTES) issues.push(`技能包解压后体积 ${Math.round(totalBytes / 1024 / 1024)} MB 超过 ${Math.round(LEGACY_MAX_TOTAL_BYTES / 1024 / 1024)} MB`)
  if (found.error) issues.push(found.error)
  const root = found.root || ''
  const skillEntry = names.find((name) => name === `${root}SKILL.md`)
  let skillText = ''
  if (skillEntry) {
    const entry = entries.find((item) => item.name.replace(/\\/g, '/') === skillEntry)
    try {
      const data = extractEntry(buffer, entry)
      if (data) skillText = data.toString('utf8')
    } catch (error) {
      issues.push(`SKILL.md 解压失败：${error.message}`)
    }
  }
  const frontmatter = skillText.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  const meta = frontmatter ? frontmatter[1] : ''
  const skillName = (meta.match(/^name:\s*([^\r\n]+)/m) || [])[1]?.trim() || ''
  const description = (meta.match(/^description:\s*([^\r\n]+)/m) || [])[1]?.trim() || ''
  if (!frontmatter) issues.push('SKILL.md 缺少 frontmatter')
  if (!skillName) issues.push('SKILL.md 缺少 name')
  if (!description) issues.push('SKILL.md 缺少 description')

  const executable = names.filter((name) => SKILL_EXEC_EXT.test(name))
  const unsupported = names.filter((name) => {
    if (name === `${root}SKILL.md`) return false
    return !SKILL_ASSET_EXT.test(name)
  })
  const externalRefs = []
  for (const name of names) {
    if (!/\.(md|txt|json|ya?ml)$/i.test(name)) continue
    const entry = entries.find((item) => item.name.replace(/\\/g, '/') === name)
    if (!entry || entry.uncompSize > LEGACY_MAX_ENTRY_BYTES) continue
    try {
      const data = extractEntry(buffer, entry)
      if (data && /https?:\/\//i.test(data.toString('utf8'))) externalRefs.push(name)
    } catch {
      // 解压失败已在其余检查中体现，这里不重复抛出。
    }
  }
  if (unsupported.length) issues.push(`包含不支持的技能包文件：${unsupported.slice(0, 6).join('、')}`)

  const formatPass = !found.error
  const metaPass = Boolean(frontmatter && skillName && description)
  const permPass = executable.length === 0
  const scanPass = executable.length === 0 && externalRefs.length === 0 && issues.length === 0
  const scanNotes = [
    executable.length ? `含可执行文件：${executable.slice(0, 6).join('、')}` : '',
    externalRefs.length ? `含外部网络地址：${externalRefs.slice(0, 6).join('、')}` : '',
    issues.length ? issues.slice(0, 4).join('；') : '',
  ].filter(Boolean).join('；') || '未发现可执行文件、外部网络地址或路径越界'

  return {
    ok: true,
    kind: 'skill',
    entries: names.slice(0, 200),
    entryCount: entries.length,
    totalBytes: entries.reduce((sum, entry) => sum + entry.uncompSize, 0),
    packageName: skillName || '',
    skillRoot: root,
    checks: [
      ['技能包格式', formatPass ? '通过' : '不通过', formatPass ? `根目录包含 SKILL.md（${root || '/'}）` : found.error],
      ['技能元信息', metaPass ? '通过' : '不通过', metaPass ? `name=${skillName}` : 'SKILL.md 的 name/description 不完整'],
      ['权限声明', permPass ? '通过' : '不通过', permPass ? '技能包只包含提示词与参考文件，不注册可执行工具' : `包含可执行文件：${executable.slice(0, 6).join('、')}`],
      ['静态安全扫描', scanPass ? '通过' : '不通过', scanNotes],
      ['隔离测试', '未执行', '技能包不执行代码；安装后由运行时按技能规则加载'],
    ],
  }
}

export function extractSkillPackage(input, targetDir) {
  let archive = null
  try {
  let entries
  if (typeof input === 'string') {
    archive = new ZipFile(input)
    entries = archive.entries
  } else {
    entries = parseCentralDirectory(input, {
      maxEntries: LEGACY_MAX_ENTRIES,
      maxTotalBytes: LEGACY_MAX_TOTAL_BYTES,
    })
  }
  const source = archive || input
  const names = normalizedNames(entries)
  const found = findSkillRoot(names)
  if (found.error) throw new Error(found.error)
  const root = found.root || ''
  const written = []
  for (const entry of entries) {
    const name = entry.name.replace(/\\/g, '/')
    if (name.endsWith('/') || name.startsWith('__MACOSX/')) continue
    if (root && !name.startsWith(root)) continue
    const rel = root ? name.slice(root.length) : name
    if (!rel || rel.split('/').includes('..') || rel.startsWith('/') || /^[A-Za-z]:/.test(rel)) {
      throw new Error(`技能包包含非法路径：${name}`)
    }
    if (!(rel === 'SKILL.md' || SKILL_ASSET_EXT.test(rel))) {
      throw new Error(`技能包包含不支持的文件：${rel}`)
    }
    const data = extractEntry(source, entry)
    if (!data) throw new Error(`技能包文件解压失败：${rel}`)
    const out = join(targetDir, ...rel.split('/'))
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, data)
    written.push(rel)
  }
  if (!written.includes('SKILL.md')) throw new Error('技能包根目录缺少 SKILL.md')
  return written
  } finally {
    if (archive) archive.close()
  }
}

export function extractBundlePackage(input, targetDir) {
  let archive = null
  try {
  let entries
  if (typeof input === 'string') {
    archive = new ZipFile(input)
    entries = archive.entries
  } else {
    entries = parseCentralDirectory(input, {
      maxEntries: LEGACY_MAX_ENTRIES,
      maxTotalBytes: LEGACY_MAX_TOTAL_BYTES,
    })
  }
  const source = archive || input
  const names = normalizedNames(entries)
  const found = findBundleRoot(names)
  if (found.error) throw new Error(found.error)
  const root = found.root || ''
  const written = []
  for (const entry of entries) {
    const name = entry.name.replace(/\\/g, '/')
    if (name.endsWith('/') || name.startsWith('__MACOSX/')) continue
    const rel = safeBundleRel(name, root)
    if (!rel) continue
    const data = extractEntry(source, entry)
    if (!data) throw new Error(`插件包文件解压失败：${rel}`)
    const out = join(targetDir, ...rel.split('/'))
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, data)
    written.push(rel)
  }
  if (!written.includes('package.json')) throw new Error('插件包根目录缺少 package.json')
  return written
  } finally {
    if (archive) archive.close()
  }
}

export function inspectPluginZip(input) {
  const issues = []
  let entries = []
  let archive = null
  try {
    if (typeof input === 'string') {
      archive = new ZipFile(input)
      entries = archive.entries
    } else {
      entries = parseCentralDirectory(input)
    }
  } catch (error) {
    return {
      ok: false,
      error: error.message,
      entries: [],
      checks: [
        ['DSH Bundle 格式', '不通过', error.message],
        ['依赖与版本', '未执行', '包结构不合法，无法读取 package.json'],
        ['权限声明', '未执行', '包结构不合法，无法读取权限声明'],
        ['静态安全扫描', '未执行', '包结构不合法'],
        ['隔离测试', '未执行', '前置检查未通过'],
      ],
    }
  }
  const source = archive || input
  try {
  const names = entries.map((e) => e.name)
  if (normalizedNames(entries).some((name) => name.split('/').pop() === 'app.json')) {
    return inspectAppZipEntries(source, entries)
  }
  if (normalizedNames(entries).some((name) => name === 'SKILL.md' || name.endsWith('/SKILL.md'))) {
    return inspectSkillZipEntries(source, entries)
  }
  const texts = new Map()
  const totalBytes = entries.reduce((sum, entry) => sum + entry.uncompSize, 0)
  if (entries.length > LEGACY_MAX_ENTRIES) issues.push(`Bundle 文件数 ${entries.length} 超过上限 ${LEGACY_MAX_ENTRIES}`)
  if (totalBytes > LEGACY_MAX_TOTAL_BYTES) issues.push(`Bundle 解压后体积 ${Math.round(totalBytes / 1024 / 1024)} MB 超过 ${Math.round(LEGACY_MAX_TOTAL_BYTES / 1024 / 1024)} MB`)
  for (const entry of entries) {
    if (!TEXT_EXT.test(entry.name)) continue
    if (entry.uncompSize > LEGACY_MAX_ENTRY_BYTES) {
      issues.push(`${entry.name} 体积 ${Math.round(entry.uncompSize / 1024)} KB，超过单文件扫描上限`)
      continue
    }
    try {
      const data = extractEntry(source, entry)
      if (data) texts.set(entry.name, data.toString('utf8'))
    } catch (error) {
      issues.push(`${entry.name} 解压失败：${error.message}`)
    }
  }

  const bundleFound = findBundleRoot(names)
  if (bundleFound.error) issues.push(bundleFound.error)
  const root = bundleFound.root || ''
  const pkgName = `${root}package.json`
  let packageJson = null
  const pkgText = texts.get(pkgName) || texts.get(names.find((n) => n.split(/[\\/]/).pop() === 'package.json') || '')
  if (pkgText) {
    try { packageJson = JSON.parse(pkgText) } catch { issues.push('package.json 不是合法 JSON') }
  } else {
    issues.push('插件包根目录缺少 package.json')
  }
  const bundleMeta = packageJson && packageJson.dsh && packageJson.dsh.bundle
  const patchRel = String(bundleMeta && bundleMeta.patch ? bundleMeta.patch : 'cordis.patch.yml').replace(/^\.\//, '').replace(/\\/g, '/')
  const patchExists = names.includes(`${root}${patchRel}`)
  const mainRel = packageJson && packageJson.main ? String(packageJson.main).replace(/^\.\//, '') : ''
  const mainExists = !mainRel || names.includes(`${root}${mainRel}`)
  const missing = []
  if (!pkgText) missing.push('package.json')
  if (!bundleMeta) missing.push('dsh.bundle')
  if (!patchExists) missing.push(patchRel)
  if (!mainExists) missing.push(mainRel)
  if (missing.length) issues.push(`缺少必需文件：${missing.join('、')}`)
  const bundlePass = missing.length === 0

  const deps = packageJson && packageJson.dependencies ? Object.keys(packageJson.dependencies) : []
  const depDefault = deps.filter((d) => !/^(@jg|jg-|node:)/.test(d))
  const depPass = !pkgText ? '不通过' : depDefault.length === 0 ? '通过' : '待复核'
  const depNote = !pkgText ? 'package.json 无法读取' : depDefault.length === 0 ? '未声明外部依赖' : `声明外部依赖：${depDefault.slice(0, 8).join('、')}`

  const permText = [pkgText, texts.get(`${root}${patchRel}`) || ''].filter(Boolean).join('\n')
  const hasWrite = /(write|写|fs\.write|writeFile|mutate|update)/i.test(permText)
  const hasPermissionBlock = /(permission|权限|scope)/i.test(permText)
  const permVerdict = !hasPermissionBlock ? '待复核' : hasWrite ? '待复核' : '通过'
  const permNote = !hasPermissionBlock ? '未见明确权限声明' : hasWrite ? '包含写入类声明，需管理员核对' : '仅声明读取类权限'

  const dangerous = names.filter((n) => /\.(exe|dll|ps1|bat|cmd|com|scr|jar|so|msi)$/i.test(n))
  const externalRefs = []
  for (const [name, text] of texts) {
    if (/https?:\/\//i.test(text)) externalRefs.push(name)
  }
  const dynamicExec = [...texts.entries()].filter(([, text]) => /eval\s*\(|new\s+Function\s*\(|child_process|require\s*\(\s*['"](?:http|https|net|tls)['"]\s*\)/.test(text)).map(([n]) => n)
  const scanPass = dangerous.length === 0 && externalRefs.length === 0 && dynamicExec.length === 0 && issues.length === 0
  const warnOnly = dangerous.length === 0 && issues.length === 0
  const scanVerdict = scanPass ? '通过' : warnOnly ? '待复核' : '不通过'
  const scanNotes = [
    dangerous.length ? `含可执行文件：${dangerous.slice(0, 6).join('、')}` : '',
    externalRefs.length ? `含外部网络地址：${externalRefs.slice(0, 6).join('、')}` : '',
    dynamicExec.length ? `含动态执行/子进程调用：${dynamicExec.slice(0, 6).join('、')}` : '',
    issues.length ? issues.slice(0, 4).join('；') : '',
  ].filter(Boolean).join('；') || '未发现可执行文件、外部网络地址或动态执行'

  return {
    ok: true,
    kind: 'bundle',
    entries: names.slice(0, 200),
    entryCount: entries.length,
    totalBytes: entries.reduce((s, e) => s + e.uncompSize, 0),
    packageName: packageJson?.name || '',
    bundleRoot: root,
    checks: [
      ['DSH Bundle 格式', bundlePass ? '通过' : '不通过', bundlePass ? `根目录包含 package.json / ${patchRel}${mainRel ? ` / ${mainRel}` : ''}` : `缺少 ${missing.join('、')}`],
      ['依赖与版本', depPass, depNote],
      ['权限声明', permVerdict, permNote],
      ['静态安全扫描', scanVerdict, scanNotes],
      ['隔离测试', '未执行', '当前版本只做静态检查，未执行插件代码；沙箱测试需在隔离环境完成'],
    ],
  }
  } finally {
    if (archive) archive.close()
  }
}
