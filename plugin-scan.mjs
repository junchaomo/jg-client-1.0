/**
 * 插件包基础检查：解析 ZIP 目录与文本内容，不执行插件代码。
 * 不依赖第三方库；zip 的 store / deflate 两种压缩方式均支持。
 */
import { inflateRawSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const MAX_ENTRIES = 2000
const MAX_ENTRY_BYTES = 8 * 1024 * 1024
const MAX_TOTAL_BYTES = 48 * 1024 * 1024
const TEXT_EXT = /\.(js|cjs|mjs|ts|json|yml|yaml|md|txt|xml|html|css|sh|ps1|bat|cmd)$/i
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

function parseCentralDirectory(buffer) {
  const eocd = findEocd(buffer)
  if (eocd < 0) throw new Error('不是有效的 ZIP 文件（缺少中央目录）')
  const count = buffer.readUInt16LE(eocd + 10)
  const cdOffset = buffer.readUInt32LE(eocd + 16)
  if (count > MAX_ENTRIES) throw new Error(`ZIP 内文件数 ${count} 超过上限 ${MAX_ENTRIES}`)
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
    if (total > MAX_TOTAL_BYTES) throw new Error(`ZIP 解压后体积超过 ${Math.round(MAX_TOTAL_BYTES / 1024 / 1024)} MB`)
    offset += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

function extractEntry(buffer, entry) {
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

function inspectSkillZipEntries(buffer, entries) {
  const names = normalizedNames(entries)
  const found = findSkillRoot(names)
  const issues = []
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
    if (!entry || entry.uncompSize > MAX_ENTRY_BYTES) continue
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

export function extractSkillPackage(buffer, targetDir) {
  const entries = parseCentralDirectory(buffer)
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
    const data = extractEntry(buffer, entry)
    if (!data) throw new Error(`技能包文件解压失败：${rel}`)
    const out = join(targetDir, ...rel.split('/'))
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, data)
    written.push(rel)
  }
  if (!written.includes('SKILL.md')) throw new Error('技能包根目录缺少 SKILL.md')
  return written
}

export function extractBundlePackage(buffer, targetDir) {
  const entries = parseCentralDirectory(buffer)
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
    const data = extractEntry(buffer, entry)
    if (!data) throw new Error(`插件包文件解压失败：${rel}`)
    const out = join(targetDir, ...rel.split('/'))
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, data)
    written.push(rel)
  }
  if (!written.includes('package.json')) throw new Error('插件包根目录缺少 package.json')
  return written
}

export function inspectPluginZip(buffer) {
  const issues = []
  let entries = []
  try {
    entries = parseCentralDirectory(buffer)
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
  const names = entries.map((e) => e.name)
  if (normalizedNames(entries).some((name) => name === 'SKILL.md' || name.endsWith('/SKILL.md'))) {
    return inspectSkillZipEntries(buffer, entries)
  }
  const texts = new Map()
  for (const entry of entries) {
    if (!TEXT_EXT.test(entry.name)) continue
    if (entry.uncompSize > MAX_ENTRY_BYTES) {
      issues.push(`${entry.name} 体积 ${Math.round(entry.uncompSize / 1024)} KB，超过单文件扫描上限`)
      continue
    }
    try {
      const data = extractEntry(buffer, entry)
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
}
