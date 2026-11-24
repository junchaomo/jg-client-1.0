/**
 * 打包发布目录：把技能 / Bundle / AS App 的源码目录压成平台可扫描的 ZIP。
 *
 * 只做“目录 → ZIP”这一段，不判断包类型是否合法；类型与安全校验统一交给
 * plugin-scan.mjs，避免发布工具和上传接口出现两套扫描口径。
 */
import { lstatSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs'
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path'

export const PACKAGE_LIMITS = {
  skill: { maxFiles: 2000, maxBytes: 48 * 1024 * 1024 },
  bundle: { maxFiles: 2000, maxBytes: 48 * 1024 * 1024 },
  app: { maxFiles: 4000, maxBytes: 256 * 1024 * 1024 },
}

const IGNORED_DIRS = new Set(['.git', 'node_modules', '__pycache__', '.cache', '.tmp', '.idea', '.vscode'])
const IGNORED_FILE_RE = /^(?:\.env(?:\.|$)|\.DS_Store$|Thumbs\.db$|.*\.log$|.*\.sqlite(?:-wal|-shm)?$|.*\.bak$|.*\.zstd$|~\$.*)$/i

function zipName(name) {
  return String(name || '').replace(/\\/g, '/').replace(/^\/+/, '')
}

function isIgnoredFile(name) {
  return IGNORED_FILE_RE.test(name)
}

function collect(dir, limits) {
  const root = realpathSync(dir)
  const files = []
  let totalBytes = 0
  const walk = (current) => {
    const entries = readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
    for (const entry of entries) {
      const full = join(current, entry.name)
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue
        walk(full)
        continue
      }
      if (!entry.isFile() || isIgnoredFile(entry.name)) continue
      const rel = zipName(relative(root, full).split(sep).join('/'))
      if (!rel || rel.split('/').includes('..')) throw new Error(`发布目录包含非法路径：${rel}`)
      const stat = statSync(full)
      totalBytes += stat.size
      if (files.length >= limits.maxFiles) throw new Error(`发布目录文件数超过上限 ${limits.maxFiles}`)
      if (totalBytes > limits.maxBytes) throw new Error(`发布目录总大小超过上限 ${Math.round(limits.maxBytes / 1024 / 1024)} MB`)
      files.push({ name: rel, data: readFileSync(full), mtime: stat.mtime })
    }
  }
  walk(root)
  return { root, files, totalBytes }
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buffer) {
  let c = 0xffffffff
  for (let i = 0; i < buffer.length; i++) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function dosDateTime(value) {
  const d = value instanceof Date && !Number.isNaN(value.getTime()) ? value : new Date()
  const year = Math.max(1980, Math.min(2107, d.getFullYear()))
  return {
    time: ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((Math.floor(d.getSeconds() / 2)) & 31),
    date: (((year - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31),
  }
}

/**
 * 生成 ZIP（store 模式，不压缩）。平台扫描只看中央目录与解压内容，
 * store 模式实现简单、结果稳定，也不会把压缩算法差异带进扫描口径。
 */
export function buildZip(files) {
  if (!Array.isArray(files) || !files.length) throw new Error('没有可打包的文件')
  if (files.length > 65535) throw new Error('ZIP 文件数超过 65535，无法生成')
  const localParts = []
  const centralParts = []
  let offset = 0
  for (const file of files) {
    const name = Buffer.from(zipName(file.name), 'utf8')
    const data = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data || '')
    const crc = crc32(data)
    const { time, date } = dosDateTime(file.mtime)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6)
    local.writeUInt16LE(0, 8)
    local.writeUInt16LE(time, 10)
    local.writeUInt16LE(date, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x0800, 8)
    central.writeUInt16LE(0, 10)
    central.writeUInt16LE(time, 12)
    central.writeUInt16LE(date, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt16LE(0, 30)
    central.writeUInt16LE(0, 32)
    central.writeUInt16LE(0, 34)
    central.writeUInt16LE(0, 36)
    central.writeUInt32LE(0x81a40000, 38)
    central.writeUInt32LE(offset, 42)

    localParts.push(local, name, data)
    centralParts.push(central, name)
    offset += local.length + name.length + data.length
  }
  const central = Buffer.concat(centralParts)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(files.length, 8)
  eocd.writeUInt16LE(files.length, 10)
  eocd.writeUInt32LE(central.length, 12)
  eocd.writeUInt32LE(offset, 16)
  eocd.writeUInt16LE(0, 20)
  return Buffer.concat([...localParts, central, eocd])
}

/**
 * 把一个目录打包成 ZIP，并检查根目录清单。
 * kind: skill | bundle | app
 */
export function packDirectoryToZip(dir, { kind = 'skill' } = {}) {
  const raw = String(dir || '').trim()
  if (!raw) throw new Error('缺少 dir：请传入要发布的目录')
  const target = isAbsolute(raw) ? resolve(raw) : resolve(process.cwd(), raw)
  let stat
  try { stat = lstatSync(target) } catch { throw new Error(`发布目录不存在：${target}`) }
  if (!stat.isDirectory()) throw new Error(`发布路径不是目录：${target}`)
  const manifest = kind === 'app' ? 'app.json' : kind === 'bundle' ? 'package.json' : 'SKILL.md'
  const manifestPath = join(target, manifest)
  try {
    if (!statSync(manifestPath).isFile()) throw new Error('not a file')
  } catch {
    throw new Error(`发布目录根目录缺少 ${manifest}：${target}`)
  }
  const collected = collect(target, PACKAGE_LIMITS[kind] || PACKAGE_LIMITS.skill)
  if (!collected.files.length) throw new Error('发布目录为空')
  return {
    buffer: buildZip(collected.files),
    root: collected.root,
    fileCount: collected.files.length,
    totalBytes: collected.totalBytes,
    manifest,
    name: basename(target),
  }
}
