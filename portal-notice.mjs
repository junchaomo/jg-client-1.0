/**
 * 规划公示采集器（九江市自然资源局门户网站）
 *
 * 背景：门户栏目页的列表由前端 JS 从同目录的 data_<年份>.xml 拉取，
 * 且该 XML 受站点网关保护——不带 x-api-key 头一律返回 404（nginx），
 * 请求头里必须带站点 JS 注入的固定 x-api-key（document_year.js 内常量）。
 * 因此这里用普通 HTTP + 该请求头直取 XML，解析 <ITEM> 节点，
 * 拿到的是栏目里真实发布的公示条目，而不是页面渲染后的空壳 HTML。
 *
 * 只采集列表元数据（标题 / 发布日期 / 发布部门 / 原文链接）；
 * 正文与附件（公示图、期限、反馈渠道）不在列表数据里，不做臆造。
 */

const PORTAL_ORIGIN = 'https://bnr.jiujiang.gov.cn'
const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
/** 站点网关要求的请求头常量（来自 20260602/images/document_year.js 的 loadAndFixXml） */
const DEFAULT_API_KEY = '********^^^^^^^^'

export const PORTAL_COLUMNS = {
  pre: {
    key: 'ghbzpqgs',
    group: 'pre',
    name: '规划编制、实施批前公示',
    dir: '/zwgk_255/zdly/ghsj/ghbzpqgs/',
  },
  post: {
    key: 'ghbzspgb',
    group: 'post',
    name: '规划编制、实施审批公布',
    dir: '/zwgk_255/zdly/ghsj/ghbzspgb/',
  },
}

function decodeEntities(text = '') {
  return String(text)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

function pickTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return m ? decodeEntities(m[1]).replace(/[\u200b\uFEFF]/g, '').replace(/\s+/g, ' ').trim() : ''
}

/** 解析栏目 XML：返回按发布日期倒序的条目列表。 */
export function parseColumnXml(xml, column) {
  const blocks = String(xml || '').match(/<ITEM>[\s\S]*?<\/ITEM>/gi) || []
  const items = []
  for (const block of blocks) {
    const title = pickTag(block, 'TITLE')
    const pubUrl = pickTag(block, 'PUBURL')
    const relTime = pickTag(block, 'RELTIME')
    if (!title) continue
    let url = ''
    if (pubUrl) {
      try {
        url = new URL(pubUrl, PORTAL_ORIGIN + column.dir).toString()
      } catch {
        url = ''
      }
    }
    items.push({
      title,
      date: relTime.slice(0, 10),
      dept: pickTag(block, 'TRUEUSER'),
      column: column.key,
      columnName: pickTag(block, 'HOMENAME') || column.name,
      url,
    })
  }
  return items.sort((a, b) => String(b.date).localeCompare(String(a.date)))
}

async function fetchXml(column, year, { apiKey, timeoutMs = 20000 } = {}) {
  const url = `${PORTAL_ORIGIN}${column.dir}data_${year}.xml`
  const res = await fetch(url, {
    headers: {
      'x-api-key': apiKey,
      'user-agent': DEFAULT_UA,
      'accept': 'application/xml,text/xml,*/*',
      'accept-language': 'zh-CN,zh;q=0.9',
      'referer': `${PORTAL_ORIGIN}${column.dir}index.html`,
    },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) return { url, year, status: res.status, items: [] }
  const xml = await res.text()
  return { url, year, status: res.status, bytes: xml.length, items: parseColumnXml(xml, column) }
}

/**
 * 采集指定栏目最近若干年份的公示条目。
 * years 默认取今年及往前两年——栏目按年分文件，当年文件不存在时站点同样 404。
 */
export async function collectPlanningPublicity({
  columns = [PORTAL_COLUMNS.pre, PORTAL_COLUMNS.post],
  years = null,
  apiKey = DEFAULT_API_KEY,
  now = Date.now(),
} = {}) {
  const baseYear = new Date(now).getFullYear()
  const targets = Array.isArray(years) && years.length ? years : [baseYear, baseYear - 1, baseYear - 2]
  const fetches = []
  const all = []
  for (const column of columns) {
    for (const year of targets) {
      const got = await fetchXml(column, year, { apiKey })
      fetches.push({ column: column.key, columnName: column.name, year, status: got.status, bytes: got.bytes || 0, count: got.items.length, url: got.url })
      all.push(...got.items.map((item) => ({ ...item, columnGroup: column.group || column.key })))
    }
  }
  const seen = new Set()
  const items = []
  for (const item of all) {
    const key = itemKey(item)
    if (seen.has(key)) continue
    seen.add(key)
    items.push(item)
  }
  items.sort((a, b) => String(b.date).localeCompare(String(a.date)))
  return {
    items,
    fetches,
    columns: columns.map((c) => ({ key: c.key, name: c.name, url: `${PORTAL_ORIGIN}${c.dir}index.html` })),
    collectedAt: now,
    latestDate: items[0]?.date || '',
    totalCount: items.length,
    columnCount: {
      pre: items.filter((i) => i.columnGroup === 'pre').length,
      post: items.filter((i) => i.columnGroup === 'post').length,
    },
  }
}

export function itemKey(item) {
  return `${item.date}|${item.title}`
}

/**
 * 与上次快照比对。首次采集只建基线，不把历史条目当成“新增”刷屏。
 */
export function diffAgainstSnapshot(collection, snapshot) {
  const seen = snapshot && snapshot.seen && typeof snapshot.seen === 'object' ? snapshot.seen : null
  if (!seen) {
    return { baseline: true, added: [], removed: [], totalCount: collection.totalCount, seenCount: 0 }
  }
  const nowKeys = new Set(collection.items.map(itemKey))
  const added = collection.items.filter((item) => !seen[itemKey(item)])
  const removed = Object.keys(seen).filter((key) => !nowKeys.has(key))
  return { baseline: false, added, removed, totalCount: collection.totalCount, seenCount: Object.keys(seen).length }
}

/** 把本次采集写进快照：记录每条首次出现时间，供下次比对。 */
export function nextSnapshot(collection, previous, now = Date.now()) {
  const origin = previous && previous.seen && typeof previous.seen === 'object' ? previous.seen : {}
  const seen = { ...origin }
  for (const item of collection.items) {
    if (!seen[itemKey(item)]) seen[itemKey(item)] = now
  }
  return {
    version: 1,
    updatedAt: now,
    lastRunAt: now,
    latestDate: collection.latestDate,
    totalCount: collection.totalCount,
    seen,
    columns: collection.columnCount,
    fetches: collection.fetches,
  }
}

/** 最近 N 天内发布的条目（列表没有公示截止日，只能按发布日期判断“近期在公示”）。 */
export function recentItems(items, days = 14, now = Date.now()) {
  const from = now - days * 24 * 3600 * 1000
  return items.filter((item) => {
    const ts = Date.parse(item.date)
    return Number.isFinite(ts) && ts >= from
  })
}

function fmtCnDate(dateStr) {
  return String(dateStr || '').slice(0, 10) || '—'
}

/** 追加要求里写了“N 天”时，摘要与报告的窗口跟着变，默认 14 天。 */
export function extraWindowDays(extras = [], fallback = 14) {
  const hit = extras.map((e) => String(e?.text || '')).join(' ').match(/(\d{1,3})\s*天/)
  return hit ? Math.min(365, Math.max(1, Number(hit[1]))) : fallback
}

/** 无模型时的确定性摘要：只陈述采集到的事实。 */
export function buildDeterministicSummary({ name, collection, diff, snapshot, extras = [] }) {
  const added = diff.added || []
  const days = extraWindowDays(extras)
  const lines = []
  if (diff.baseline) {
    lines.push(`首次采集建立基线：栏目现有 ${collection.totalCount} 条（批前 ${collection.columnCount.pre} · 批后 ${collection.columnCount.post}），最新 ${fmtCnDate(collection.latestDate)}`)
  } else {
    lines.push(`新增 ${added.length} 条 / 现有 ${collection.totalCount} 条（批前 ${collection.columnCount.pre} · 批后 ${collection.columnCount.post}）`)
    if (added.length) lines.push(`新增明细：${added.slice(0, 3).map((i) => `${fmtCnDate(i.date)} ${i.title}`).join('；')}${added.length > 3 ? ` 等 ${added.length} 条` : ''}`)
  }
  const recent = recentItems(collection.items, days, collection.collectedAt)
  lines.push(recent.length ? `近 ${days} 天发布 ${recent.length} 条：${recent.slice(0, 2).map((i) => i.title).join('；')}` : `近 ${days} 天无新发布`)
  lines.push(`最新一条：${fmtCnDate(collection.latestDate)} ${collection.items[0]?.title || '—'}（${collection.items[0]?.columnName || '—'}）`)
  if (extras.length) lines.push(`追加要求：${extras.map((e) => `${e.text}（${e.scope === 'now' ? '本次' : '下次'}执行）`).join('；').slice(0, 220)}`)
  lines.push(`来源：九江市自然资源局 门户网站 · ${collection.columns.map((c) => c.name).join(' / ')}`)
  return lines.join('\n')
}

/** 生成前端任务详情可直接渲染的 report 结构（字段与既有 rp 约定一致）。 */
export function buildReport({ name, collection, diff, extras = [], summaryLines = [] }) {
  const added = diff.added || []
  const recent = recentItems(collection.items, extraWindowDays(extras), collection.collectedAt)
  const toLink = (i) => ({ name: fmtCnDate(i.date) + '　' + String(i.title || '').slice(0, 90), url: i.url })
  const dateLabel = new Date(collection.collectedAt).toLocaleDateString('zh-CN')
  const items = []
  if (diff.baseline) {
    items.push({
      h: '首次采集基线',
      p: `栏目现有 ${collection.totalCount} 条公示（批前 ${collection.columnCount.pre} 条 · 批后 ${collection.columnCount.post} 条），最新一条发布于 ${fmtCnDate(collection.latestDate)}。后续执行只报告与本次基线的差异。`,
      src: collection.columns.map((c) => c.name).join(' / '),
      links: collection.columns.map((c) => ({ name: c.name, url: c.url })),
    })
  } else {
    items.push({
      h: `新增公示（${added.length} 条）`,
      p: added.length
        ? added.slice(0, 5).map((i) => `${fmtCnDate(i.date)}　${i.title}`).join('\n') + (added.length > 5 ? `\n… 其余 ${added.length - 5} 条见执行记录` : '')
        : '与上次快照相比没有新增公示。',
      src: '批前公示 / 批后公布 栏目列表',
      links: added.slice(0, 5).map(toLink),
    })
  }
  items.push({
    h: '近期在公示的项目',
    p: recent.length
      ? recent.slice(0, 5).map((i) => `${fmtCnDate(i.date)}　${i.title}`).join('\n')
      : `近 ${extraWindowDays(extras)} 天栏目内没有新发布的公示。`,
    src: '按发布日期判断，公示期限以原文为准',
    links: recent.slice(0, 5).map(toLink),
  })
  items.push({
    h: '数据口径',
    p: `采集时间 ${new Date(collection.collectedAt).toLocaleString('zh-CN', { hour12: false })}；共请求 ${collection.fetches.length} 个年度数据文件，成功 ${collection.fetches.filter((f) => f.status === 200).length} 个。仅采集栏目列表的标题、发布日期、发布部门与原文链接；正文附件中的公示期限、反馈渠道需打开原文查看。`,
    src: '栏目列表页与年度数据文件',
    links: collection.columns.map((c) => ({ name: c.name, url: c.url })),
  })
  if (extras.length) {
    items.push({
      h: '追加要求',
      p: extras.map((e) => `${e.text}（${e.scope === 'now' ? '本次' : '下次'}执行）`).join('\n'),
      src: '任务详情 · 追加要求',
    })
  }
  return {
    title: name,
    date: dateLabel,
    period: `采集 ${new Date(collection.collectedAt).toLocaleString('zh-CN', { hour12: false })} · 数据截至 ${fmtCnDate(collection.latestDate)}`,
    lead: summaryLines[0] || '',
    summary: summaryLines.join('\n'),
    items,
    note: `来源：九江市自然资源局门户网站（bnr.jiujiang.gov.cn）规划公示栏目；只读取公开公示列表，不登录、不提交意见、不下载图纸。`,
    sourceUrl: collection.columns[0]?.url || `${PORTAL_ORIGIN}${PORTAL_COLUMNS.pre.dir}index.html`,
    collectedAt: collection.collectedAt,
    addedCount: diff.baseline ? 0 : added.length,
    totalCount: collection.totalCount,
    baseline: Boolean(diff.baseline),
    columns: collection.columnCount,
  }
}
