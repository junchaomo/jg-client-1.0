/**
 * SHP / File Geodatabase 数据格式桥接。
 * Node 不直接加载 GDAL：由 gis-bridge.py 通过随包 vendor/gis 的 pyogrio 读写。
 * 输入支持 ZIP、单个 GeoJSON，以及直接选择的 SHP / GDB 文件夹（不要求压缩）。
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inspectGeoJSON } from './geo.mjs'

const ROOT = dirname(fileURLToPath(import.meta.url))
const VENDOR_GIS = join(ROOT, 'vendor', 'gis')
const BRIDGE = join(ROOT, 'gis-bridge.py')
const MAX_FEATURES = 2000
const MAX_DATASETS = 80

function runBridge(command, manifest) {
  const python = process.env.JG_GIS_PYTHON || 'python'
  const temp = mkdtempSync(join(tmpdir(), 'jg-gis-manifest-'))
  const manifestPath = join(temp, 'manifest.json')
  writeFileSync(manifestPath, JSON.stringify(manifest), 'utf8')
  return new Promise((resolve, reject) => {
    const child = spawn(python, [BRIDGE, command, `@${manifestPath}`], {
      cwd: ROOT,
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONPATH: [VENDOR_GIS, process.env.PYTHONPATH].filter(Boolean).join(process.platform === 'win32' ? ';' : ':'),
        PYTHONIOENCODING: 'utf-8',
      },
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', (error) => {
      rmSync(temp, { recursive: true, force: true })
      reject(Object.assign(new Error(`SHP/GDB 解析器启动失败：${error.message}`), { status: 503 }))
    })
    child.on('close', (code) => {
      rmSync(temp, { recursive: true, force: true })
      if (code !== 0) {
        const detail = (stderr || stdout).trim().split(/\r?\n/).filter(Boolean).pop() || `解析器退出码 ${code}`
        return reject(Object.assign(new Error(`SHP/GDB 处理失败：${detail}`), { status: 422 }))
      }
      try { resolve(JSON.parse(stdout.trim())) } catch {
        reject(Object.assign(new Error('SHP/GDB 解析器返回了无法识别的结果'), { status: 422 }))
      }
    })
  })
}

function safeRelative(relPath, fallback = 'data.bin') {
  const parts = String(relPath || fallback).replace(/\\/g, '/').split('/').filter((part) => part && part !== '.' && part !== '..')
  if (!parts.length) return fallback
  return join(...parts)
}

function makeInputFolder(files) {
  const temp = mkdtempSync(join(tmpdir(), 'jg-gis-input-'))
  for (const file of files) {
    if (!file?.buffer?.length) continue
    const relative = safeRelative(file.path || file.name)
    const full = join(temp, relative)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, file.buffer)
  }
  return temp
}

function findDatasets(root) {
  const found = []
  const stack = [root]
  while (stack.length) {
    const current = stack.pop()
    let entries = []
    try { entries = readdirSync(current, { withFileTypes: true }) } catch { continue }
    for (const entry of entries) {
      const full = join(current, entry.name)
      const lower = entry.name.toLowerCase()
      if (entry.isDirectory() && lower.endsWith('.gdb')) {
        found.push({ path: full, kind: 'gdb' })
        continue
      }
      if (entry.isFile() && lower.endsWith('.shp')) {
        found.push({ path: full, kind: 'shapefile' })
      }
      if (entry.isFile() && lower.endsWith('.geojson')) {
        found.push({ path: full, kind: 'geojson' })
      }
      if (entry.isDirectory()) stack.push(full)
    }
  }
  const unique = [...new Map(found.map((item) => [item.path.toLowerCase(), item])).values()]
  if (!unique.length) throw Object.assign(new Error('没有找到 .shp、.gdb 或 GeoJSON 数据集；SHP 请同时选择 .shp/.dbf/.shx/.prj'), { status: 422 })
  if (unique.length > MAX_DATASETS) throw Object.assign(new Error(`一次最多处理 ${MAX_DATASETS} 个数据集，请拆分后再试`), { status: 422 })
  return unique
}

function unpackArchive(buffer, name) {
  const temp = mkdtempSync(join(tmpdir(), 'jg-gis-'))
  const archive = join(temp, basename(name || 'dataset.zip'))
  writeFileSync(archive, buffer)
  const tar = spawnSync('tar', ['-xf', archive, '-C', temp], { windowsHide: true })
  let ok = tar.status === 0
  if (!ok) {
    const zipfile = spawnSync('python', ['-m', 'zipfile', '-e', archive, temp], { windowsHide: true })
    ok = zipfile.status === 0
  }
  if (!ok) {
    rmSync(temp, { recursive: true, force: true })
    throw Object.assign(new Error('压缩包解压失败，请确认是有效的 ZIP 包'), { status: 422 })
  }
  rmSync(archive, { force: true })
  return temp
}

function datasetErrorFor(kind, name) {
  if (kind === 'gdb') return 'GDB 需要一个完整的 .gdb 文件夹（不是只选 .gdbtable 等内部文件）'
  if (kind === 'shapefile') return 'SHP 需要同时包含 .shp/.dbf/.shx（建议带 .prj），可直接选择整个文件夹或一次多选这些文件'
  return '请选择 SHP / GDB 文件夹、GeoJSON 或 ZIP 包'
}

function pickDatasetPaths(datasets) {
  const paths = datasets.map((item) => item.path)
  if (paths.length > 1) {
    const kinds = new Set(datasets.map((item) => item.kind))
    if (kinds.has('gdb') && kinds.has('shapefile')) {
      throw Object.assign(new Error('同一文件夹里同时存在 SHP 和 GDB，请一次只处理一种数据源'), { status: 422 })
    }
  }
  return paths
}

function validateDatasets(datasets) {
  for (const dataset of datasets) {
    if (dataset.kind === 'shapefile') {
      const base = dataset.path.replace(/\.shp$/i, '')
      for (const ext of ['.dbf', '.shx']) {
        if (!existsSync(base + ext)) throw Object.assign(new Error(`SHP 缺少 ${ext}：${basename(dataset.path)}；请把 .shp/.dbf/.shx（建议带 .prj）一起选择`), { status: 422 })
      }
    }
    if (dataset.kind === 'gdb') {
      try {
        if (readdirSync(dataset.path).length < 2) throw Object.assign(new Error(`GDB 文件夹为空或不完整：${basename(dataset.path)}`), { status: 422 })
      } catch (error) {
        if (error?.status) throw error
        throw Object.assign(new Error(`GDB 文件夹不可读：${basename(dataset.path)}`), { status: 422 })
      }
    }
  }
}

async function inspectFolder(temp, name, sourceFiles) {
  const datasets = findDatasets(temp)
  validateDatasets(datasets)
  const paths = pickDatasetPaths(datasets)
  const payload = await runBridge('inspect', { paths, maxFeatures: MAX_FEATURES, name })
  const geo = inspectGeoJSON(Buffer.from(JSON.stringify(payload.geojson)), name || basename(paths[0]))
  const kind = payload.kind
  return {
    ...geo,
    format: 'gis',
    formatLabel: payload.formatLabel,
    kind,
    name: name || basename(paths[0]),
    sourceFiles: sourceFiles || datasets.map((item) => basename(item.path) || item.path),
    datasetCount: datasets.length,
    features: payload.totalFeatures,
    totalFeatures: payload.totalFeatures,
    previewFeatures: (payload.geojson?.features || []).length,
    layers: (payload.layers || []).map((layer) => layer.name),
    layerDetails: payload.layers || [],
    fields: payload.fields || [],
    crs: payload.crs,
    crsList: payload.crsList || [],
    crsMixed: Boolean(payload.crsMixed),
    driver: payload.driver,
    bbox: payload.bbox || geo.bbox,
    exportFormat: 'gis',
    exportTargets: ['shp', 'gdb'],
    note: kind === 'gdb'
      ? 'GDB 文件夹已真实读取（无需压缩）；预览每层最多读取 2000 个要素。可输出 SHP 或 GDB。'
      : kind === 'shapefile'
        ? `SHP ${datasets.length > 1 ? `共 ${datasets.length} 个文件，` : ''}已真实读取（无需压缩）；预览每个数据集最多读取 2000 个要素。可合并输出 GDB，也可输出 SHP。`
        : 'GeoJSON 已真实读取；可转换为 SHP 或 GDB。',
  }
}

export function isGeoArchive(name) {
  return /\.zip$/i.test(String(name || ''))
}

export async function inspectGeoArchive(buffer, name) {
  const temp = unpackArchive(buffer, name)
  try {
    const result = await inspectFolder(temp, String(name || '').replace(/\.zip$/i, ''), [name])
    result.note = result.kind === 'gdb'
      ? 'GDB 压缩包已真实读取；可输出 SHP 或 GDB。'
      : result.kind === 'shapefile'
        ? 'SHP 压缩包已真实读取；可合并输出 GDB，也可输出 SHP。'
        : 'GeoJSON 压缩包已真实读取；可转换为 SHP 或 GDB。'
    return result
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
}

export async function inspectGeoFiles(files, name) {
  if (!Array.isArray(files) || !files.length) throw Object.assign(new Error('缺少 SHP / GDB 文件夹内容'), { status: 400 })
  const temp = makeInputFolder(files)
  try {
    return await inspectFolder(temp, name)
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
}

async function convertFolder(temp, target, name) {
  const datasets = findDatasets(temp)
  validateDatasets(datasets)
  const paths = pickDatasetPaths(datasets)
  const outDir = mkdtempSync(join(tmpdir(), 'jg-gis-output-'))
  try {
    const result = await runBridge('convert', { paths, outDir, target, name })
    const files = []
    for (const output of result.outputs || []) {
      if (!output?.path || !existsSync(output.path)) continue
      const stat = statSync(output.path)
      const ext = String(output.name || '').toLowerCase()
      const mime = ext.endsWith('.zip')
        ? 'application/zip'
        : ext.endsWith('.shp')
          ? 'application/octet-stream'
          : ext.endsWith('.dbf')
            ? 'application/x-dbf'
            : ext.endsWith('.prj') || ext.endsWith('.cpg')
              ? 'text/plain'
              : 'application/octet-stream'
      files.push({ name: output.name, buffer: readFileSync(output.path), size: stat.size, mime })
    }
    if (!files.length) throw Object.assign(new Error('转换没有生成可下载文件'), { status: 422 })
    return {
      format: 'gis',
      target,
      outputs: files,
      layers: result.layers || [],
      features: result.features || 0,
      note: target === 'gdb'
        ? `已生成 ${datasets.length} 个数据源的 GDB，下载为 ZIP，解压后得到 .gdb 文件夹。`
        : '已生成 SHP；同一名称的 .shp/.dbf/.shx/.prj/.cpg 必须放在同一文件夹中使用。',
    }
  } finally {
    rmSync(outDir, { recursive: true, force: true })
  }
}

export async function convertGeoArchive(buffer, name, target) {
  const temp = unpackArchive(buffer, name)
  try {
    return await convertFolder(temp, target, String(name || '数据').replace(/\.zip$/i, ''))
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
}

export async function convertGeoFiles(files, name, target) {
  if (!Array.isArray(files) || !files.length) throw Object.assign(new Error('缺少 SHP / GDB 文件夹内容'), { status: 400 })
  const temp = makeInputFolder(files)
  try {
    return await convertFolder(temp, target, name)
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
}

export async function convertGeoBuffer(buffer, name, target) {
  const temp = mkdtempSync(join(tmpdir(), 'jg-gis-single-'))
  try {
    const safe = safeRelative(name || 'data.geojson')
    const full = join(temp, safe)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, buffer)
    return await convertFolder(temp, target, String(name || '数据').replace(/\.(geojson|json)$/i, ''))
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
}

export async function exportGeoArchive(buffer, name) {
  const temp = unpackArchive(buffer, name)
  try {
    const datasets = findDatasets(temp)
    const paths = pickDatasetPaths(datasets)
    const collection = await runBridge('export', { paths, maxFeatures: 0 })
    return {
      format: 'gis',
      outputs: [{
        name: `${String(name || '空间数据').replace(/\.zip$/i, '')}-规范化.geojson`,
        buffer: Buffer.from(JSON.stringify(collection), 'utf8'),
        format: 'gis',
        mime: 'application/geo+json',
      }],
    }
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
}
