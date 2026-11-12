/**
 * 插件包基础检查：解析 ZIP 目录与文本内容，不执行插件代码。
 * 不依赖第三方库；zip 的 store / deflate 两种压缩方式均支持。
 */
import { inflateRawSync } from 'node:zlib'

const MAX_ENTRIES = 2000
const MAX_ENTRY_BYTES = 8 * 1024 * 1024
const MAX_TOTAL_BYTES = 48 * 1024 * 1024
const TEXT_EXT = /\.(js|cjs|mjs|ts|json|yml|yaml|md|txt|xml|html|css|sh|ps1|bat|cmd)$/i

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

  const required = ['package.json', 'index.js', 'cordis.patch.yml']
  const missing = required.filter((f) => !names.some((n) => n.split(/[\\/]/).pop() === f))
  const bundlePass = missing.length === 0
  if (!bundlePass) issues.push(`缺少必需文件：${missing.join('、')}`)

  let packageJson = null
  const pkgText = texts.get(names.find((n) => n.split(/[\\/]/).pop() === 'package.json') || '')
  if (pkgText) {
    try { packageJson = JSON.parse(pkgText) } catch { issues.push('package.json 不是合法 JSON') }
  }
  const deps = packageJson && packageJson.dependencies ? Object.keys(packageJson.dependencies) : []
  const depDefault = deps.filter((d) => !/^(@jg|jg-|node:)/.test(d))
  const depPass = !pkgText ? '不通过' : depDefault.length === 0 ? '通过' : '待复核'
  const depNote = !pkgText ? 'package.json 无法读取' : depDefault.length === 0 ? '未声明外部依赖' : `声明外部依赖：${depDefault.slice(0, 8).join('、')}`

  const permText = [pkgText, texts.get(names.find((n) => n.split(/[\\/]/).pop() === 'cordis.patch.yml') || '')].filter(Boolean).join('\n')
  const hasWrite = /(write|写|fs\.write|writeFile|mutate|update)/i.test(permText)
  const hasPermissionBlock = /(permission|权限|scope)/i.test(permText)
  const permVerdict = !hasPermissionBlock ? '待复核' : hasWrite ? '待复核' : '通过'
  const permNote = !hasPermissionBlock ? '未见明确权限声明' : hasWrite ? '包含写入类声明，需管理员核对' : '仅声明读取类权限'

  const dangerous = names.filter((n) => /\.(exe|dll|ps1|bat|cmd|com|scr|jar|so)$/i.test(n))
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
    entries: names.slice(0, 200),
    entryCount: entries.length,
    totalBytes: entries.reduce((s, e) => s + e.uncompSize, 0),
    packageName: packageJson?.name || '',
    checks: [
      ['DSH Bundle 格式', bundlePass ? '通过' : '不通过', bundlePass ? `根目录包含 ${required.join(' / ')}` : `缺少 ${missing.join('、')}`],
      ['依赖与版本', depPass, depNote],
      ['权限声明', permVerdict, permNote],
      ['静态安全扫描', scanVerdict, scanNotes],
      ['隔离测试', '未执行', '当前版本只做静态检查，未执行插件代码；沙箱测试需在隔离环境完成'],
    ],
  }
}
