import { createRequire } from 'node:module'
import { inflateSync } from 'node:zlib'

const require = createRequire(import.meta.url)
const { PDFDocument, degrees } = require('./vendor/pdf-lib.min.js')

function pdfString(value) {
  const raw = String(value || '')
  const hex = raw.replace(/[^0-9a-fA-F]/g, '')
  if (!hex) return ''
  const bytes = Buffer.from(hex.length % 2 ? `${hex}0` : hex, 'hex')
  // 拉丁字体的 ASCII/PDFDocEncoding 文本全部落在可打印区间，直接按单字节解码，避免被误当成 UTF-16。
  if (bytes.length && bytes.every((b) => b === 9 || b === 10 || b === 13 || (b >= 32 && b <= 126))) {
    return bytes.toString('latin1')
  }
  // PDF 的中文字体通常把文字写成 UCS-2/UTF-16BE 十六进制串；先按大端转小端解码。
  try {
    if (bytes.length % 2 === 0) {
      const text = Buffer.from(bytes).swap16().toString('utf16le')
      if (text && !/[\u0000-\u0008\u000e-\u001f]/.test(text)) return text
    }
  } catch (_) {}
  const latin = bytes.toString('latin1')
  return latin
}

function decodeLiteral(raw) {
  const source = String(raw || '')
  let out = ''
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i]
    if (ch !== '\\') { out += ch; continue }
    const next = source[i + 1]
    if (next === undefined) break
    if (next === 'n') { out += '\n'; i += 1; continue }
    if (next === 'r') { out += '\r'; i += 1; continue }
    if (next === 't') { out += '\t'; i += 1; continue }
    if (next === 'b') { out += '\b'; i += 1; continue }
    if (next === 'f') { out += '\f'; i += 1; continue }
    if (next === '(' || next === ')' || next === '\\') { out += next; i += 1; continue }
    if (next === '\n') { i += 1; continue }
    if (next === '\r') { i += source[i + 2] === '\n' ? 2 : 1; continue }
    const octal = /^[0-7]{1,3}/.exec(source.slice(i + 1))
    if (octal) { out += String.fromCharCode(parseInt(octal[0], 8)); i += octal[0].length; continue }
    out += next
    i += 1
  }
  return out
}

function extractStreamText(content) {
  const chunks = []
  const push = (value) => { if (value) chunks.push(value) }
  const literalRe = /\((?:\\.|[^\\()])*\)\s*(?:Tj|')/g
  let match
  while ((match = literalRe.exec(content))) {
    push(decodeLiteral(match[0].replace(/\s*(?:Tj|')$/, '').slice(1, -1)))
  }
  const hexRe = /<([0-9A-Fa-f\s]+)>\s*Tj/g
  while ((match = hexRe.exec(content))) push(pdfString(match[1]))
  const tjRe = /\[(.*?)\]\s*TJ/gs
  while ((match = tjRe.exec(content))) {
    const inner = match[1]
    const strings = inner.match(/\((?:\\.|[^\\()])*\)|<[0-9A-Fa-f\s]+>/g) || []
    for (const item of strings) {
      push(item.startsWith('(') ? decodeLiteral(item.slice(1, -1)) : pdfString(item.slice(1, -1)))
    }
  }
  return chunks.join('').replace(/[\u0000-\u0008\u000e-\u001f]/g, '')
}

export async function inspectPdf(buffer) {
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true, updateMetadata: false })
  const pages = doc.getPages()
  let title = ''
  let author = ''
  try { title = doc.getTitle() || '' } catch (_) {}
  try { author = doc.getAuthor() || '' } catch (_) {}
  return {
    pageCount: pages.length,
    title,
    author,
    producer: (() => { try { return doc.getProducer() || '' } catch (_) { return '' } })(),
    pages: pages.map((page, index) => ({
      index: index + 1,
      width: Math.round(page.getWidth()),
      height: Math.round(page.getHeight()),
      rotation: page.getRotation().angle || 0,
    })),
    bytes: buffer.length,
  }
}

export async function mergePdfs(buffers) {
  if (!buffers.length) throw new Error('至少需要一个 PDF')
  const out = await PDFDocument.create()
  for (const buffer of buffers) {
    const source = await PDFDocument.load(buffer, { ignoreEncryption: true })
    const pages = await out.copyPages(source, source.getPageIndices())
    for (const page of pages) out.addPage(page)
  }
  out.setProducer('九规智能中枢 PDF 工具')
  out.setCreator('九规智能中枢')
  return Buffer.from(await out.save())
}

export function parseRanges(spec, pageCount) {
  const text = String(spec || '').trim()
  if (!text) throw new Error('请输入页码范围，例如 1-3,5')
  const result = []
  for (const part of text.split(',')) {
    const item = part.trim()
    if (!item) continue
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(item)
    if (!match) throw new Error(`页码范围格式不正确：${item}`)
    const start = Number(match[1])
    const end = Number(match[2] || match[1])
    if (start < 1 || end < start || end > pageCount) throw new Error(`页码范围超出文档页数（共 ${pageCount} 页）：${item}`)
    result.push({ start, end, label: start === end ? String(start) : `${start}-${end}` })
  }
  if (!result.length) throw new Error('请输入至少一个页码范围')
  return result
}

export async function splitPdf(buffer, ranges) {
  const source = await PDFDocument.load(buffer, { ignoreEncryption: true })
  const pageCount = source.getPageCount()
  const parsed = parseRanges(ranges, pageCount)
  const outputs = []
  for (const range of parsed) {
    const out = await PDFDocument.create()
    const indices = []
    for (let page = range.start; page <= range.end; page += 1) indices.push(page - 1)
    const pages = await out.copyPages(source, indices)
    for (const page of pages) out.addPage(page)
    out.setProducer('九规智能中枢 PDF 工具')
    outputs.push({ label: range.label, buffer: Buffer.from(await out.save()) })
  }
  return outputs
}

export function extractText(buffer) {
  const raw = Buffer.from(buffer).toString('latin1')
  const streams = []
  const streamRe = /<<([\s\S]*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g
  let match
  while ((match = streamRe.exec(raw))) {
    const dict = match[1]
    let content = Buffer.from(match[2], 'latin1')
    if (/\/Filter\s*\/FlateDecode/.test(dict)) {
      try { content = inflateSync(content) } catch (_) { continue }
    }
    streams.push(content.toString('latin1'))
  }
  if (!streams.length) return { text: '', streams: 0, note: '没有找到可读取的内容流；可能是扫描件或加密文档。' }
  const pages = streams.map((stream) => extractStreamText(stream)).filter((text) => text.trim())
  return { text: pages.join('\n\n'), pages: pages.length, streams: streams.length, note: '' }
}
