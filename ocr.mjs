/**
 * 服务端内置 OCR：把无文本层的 PDF 页面渲染为图片，再用 Tesseract.js 识别。
 * 仅在 PDF 没有可提取文本时进入，识别结果由笔记本正文缓存复用。
 */
import { createRequire } from 'node:module'
import { existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createCanvas } from '@napi-rs/canvas'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createWorker } from 'tesseract.js'

const require = createRequire(import.meta.url)
const LOCAL_LANG_PATH = resolve(process.cwd(), 'data', 'ocr-tessdata')
const CHI_LANG_PATH = existsSync(join(LOCAL_LANG_PATH, 'chi_sim.traineddata.gz'))
  ? LOCAL_LANG_PATH
  : require('@tesseract.js-data/chi_sim').langPath
const OCR_CACHE_PATH = resolve(process.cwd(), 'data', 'ocr-cache')

function cleanOcrText(text) {
  let value = String(text || '').replace(/\r\n?/g, '\n')
  value = value.replace(/[ \t]+/g, ' ')
  // Tesseract 的中文结果常在汉字之间插空格；去掉后让“湖口园区”这类问题能命中
  value = value.replace(/([\u4e00-\u9fff])[ ]*(?=[\u4e00-\u9fff])/g, '$1')
  value = value.replace(/[ \t]+([，。；：、！？])/g, '$1')
  value = value.replace(/([，。；：、！？])[ \t]+/g, '$1')
  return value
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * @param {Buffer|Uint8Array} buffer
 * @param {{ maxPages?: number, scale?: number, onProgress?: (progress: {page:number,total:number,chars:number})=>void }} options
 * @returns {Promise<{text:string,pages:number,totalPages:number,truncated:boolean,note:string}>}
 */
export async function ocrPdfBuffer(buffer, options = {}) {
  const data = new Uint8Array(buffer)
  const maxPages = Math.max(1, Math.min(50, Number(options.maxPages) || 20))
  const scale = Math.max(1.2, Math.min(3, Number(options.scale) || 2))
  const doc = await getDocument({ data, disableWorker: true, useSystemFonts: true }).promise
  const totalPages = Number(doc.numPages) || 0
  const pagesToScan = Math.min(totalPages, maxPages)
  const pageTexts = []
  let worker
  try {
    mkdirSync(OCR_CACHE_PATH, { recursive: true })
    worker = await createWorker('chi_sim', 1, {
      langPath: CHI_LANG_PATH,
      gzip: true,
      cachePath: OCR_CACHE_PATH,
    })
    for (let pageNo = 1; pageNo <= pagesToScan; pageNo += 1) {
      const page = await doc.getPage(pageNo)
      const viewport = page.getViewport({ scale })
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
      const ctx = canvas.getContext('2d')
      await page.render({ canvasContext: ctx, viewport }).promise
      const png = canvas.toBuffer('image/png')
      const result = await worker.recognize(png)
      const text = cleanOcrText(result?.data?.text || '')
      if (text) pageTexts.push(`【第 ${pageNo} 页 OCR】\n${text}`)
      page.cleanup()
      if (typeof options.onProgress === 'function') {
        options.onProgress({ page: pageNo, total: pagesToScan, chars: text.length })
      }
    }
  } finally {
    try { await worker?.terminate() } catch (_) {}
    try { await doc.destroy() } catch (_) {}
  }
  const truncated = totalPages > pagesToScan
  const text = [
    truncated ? `【OCR 识别范围：前 ${pagesToScan} 页（共 ${totalPages} 页）】` : '',
    ...pageTexts,
  ].filter(Boolean).join('\n\n')
  const note = truncated
    ? `OCR 只识别了前 ${pagesToScan} 页（共 ${totalPages} 页）；后续页面可在提高 OCR 页数上限后重新识别。`
    : ''
  return { text, pages: pageTexts.length, totalPages, truncated, note }
}
