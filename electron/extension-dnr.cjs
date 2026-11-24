const fs = require('fs')
const path = require('path')

/* Electron 当前只注册 MV3 扩展，不执行 declarativeNetRequest 静态规则。
   这里为审核扩展提供基础 block/allow 网络规则适配；高级重定向、资源类型、
   发起站条件、优先级和脚本/元素规则不伪装成已支持。 */
function hostMatches(host, domain) {
  return host === domain || host.endsWith(`.${domain}`)
}
function addPath(index, host, urlPath) {
  if (!index.has(host)) index.set(host, [])
  index.get(host).push(urlPath)
}
function addRule(index, rule) {
  const condition = rule?.condition || {}
  const keys = Object.keys(condition).filter((key) => condition[key] !== undefined)
  if (keys.some((key) => !['requestDomains', 'urlFilter'].includes(key))) return false
  const domains = Array.isArray(condition.requestDomains) ? condition.requestDomains : []
  const urlFilter = String(condition.urlFilter || '')
  if (domains.length && urlFilter) return false
  if (domains.length) {
    for (const domain of domains) {
      const normalized = String(domain || '').toLowerCase().replace(/\.$/, '')
      if (/^[a-z0-9.-]+$/i.test(normalized)) index.domains.add(normalized)
    }
    return true
  }
  if (!urlFilter.startsWith('||')) return false
  const body = urlFilter.slice(2)
  const match = body.match(/^([a-z0-9.-]+)(\/[^*^|]*)?$/i)
  if (!match) return false
  const host = match[1].toLowerCase()
  if (match[2]) addPath(index.paths, host, match[2])
  else index.domains.add(host)
  return true
}
function matchIndex(index, url) {
  for (let host = url.hostname.toLowerCase(); host; host = host.split('.').slice(1).join('.')) {
    if (index.domains.has(host)) return true
    const prefixes = index.paths.get(host)
    if (prefixes?.some((prefix) => `${url.pathname}${url.search}`.startsWith(prefix))) return true
    if (!host.includes('.')) break
  }
  return false
}
function createDnrBlocker(extensionPath) {
  const manifest = JSON.parse(fs.readFileSync(path.join(extensionPath, 'manifest.json'), 'utf8'))
  const resources = manifest.declarative_net_request?.rule_resources || []
  const indexes = {
    block: { domains: new Set(), paths: new Map() },
    allow: { domains: new Set(), paths: new Map() },
  }
  let rules = 0
  let unsupported = 0
  const rulesets = []
  for (const resource of resources) {
    if (!resource.enabled || !resource.id || !resource.path) continue
    const file = path.resolve(extensionPath, `.${resource.path}`)
    if (!file.startsWith(path.resolve(extensionPath) + path.sep)) continue
    let body
    try { body = JSON.parse(fs.readFileSync(file, 'utf8')) } catch (_) { continue }
    let accepted = 0
    for (const rule of Array.isArray(body) ? body : []) {
      const action = rule?.action?.type
      if (!['block', 'allow'].includes(action)) { unsupported++; continue }
      if (addRule(indexes[action], rule)) { rules++; accepted++ }
      else unsupported++
    }
    rulesets.push({ id: resource.id, rules: accepted })
  }
  return {
    rules, unsupported, rulesets,
    match(rawUrl) {
      let url
      try { url = new URL(String(rawUrl || '')) } catch (_) { return false }
      if (!['http:', 'https:'].includes(url.protocol)) return false
      if (matchIndex(indexes.allow, url)) return false
      return matchIndex(indexes.block, url)
    },
  }
}

module.exports = { createDnrBlocker }
