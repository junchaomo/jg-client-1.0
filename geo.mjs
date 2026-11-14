const W = 960
const H = 640
const PAD = 36

function round(value) {
  return Math.round(Number(value || 0) * 1000) / 1000
}

function flattenCoords(value, out = []) {
  if (!Array.isArray(value)) return out
  if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
    out.push([value[0], value[1]])
  } else {
    for (const item of value) flattenCoords(item, out)
  }
  return out
}

function bboxOf(points) {
  if (!points.length) return null
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of points) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    minX = Math.min(minX, x); maxX = Math.max(maxX, x)
    minY = Math.min(minY, y); maxY = Math.max(maxY, y)
  }
  if (!Number.isFinite(minX)) return null
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}

function projector(bbox, flipY = false) {
  const w = Math.max(bbox.width, 1e-9)
  const h = Math.max(bbox.height, 1e-9)
  const scale = Math.min((W - PAD * 2) / w, (H - PAD * 2) / h)
  const offsetX = (W - w * scale) / 2
  const offsetY = (H - h * scale) / 2
  return ([x, y]) => {
    const px = offsetX + (x - bbox.minX) * scale
    const py = flipY ? H - offsetY - (y - bbox.minY) * scale : H - offsetY - (y - bbox.minY) * scale
    return [round(px), round(py)]
  }
}

function svgWrap(inner, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" style="background:#fff">
  <rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>
  <g>${inner}</g>
  <text x="12" y="20" font-size="12" fill="#64748b">${escapeXml(label)}</text>
</svg>`
}

function escapeXml(text) {
  return String(text || '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]))
}

function geometryPaths(geometry, project) {
  const type = geometry?.type
  const coords = geometry?.coordinates
  if (!coords) return { svg: '', points: [] }
  const points = flattenCoords(coords)
  if (type === 'Point') {
    const [x, y] = project(coords)
    return { svg: `<circle cx="${x}" cy="${y}" r="3.5" fill="#2563eb"/>`, points }
  }
  if (type === 'MultiPoint') {
    return { svg: coords.map((pt) => { const [x, y] = project(pt); return `<circle cx="${x}" cy="${y}" r="2.5" fill="#2563eb"/>` }).join(''), points }
  }
  if (type === 'LineString') {
    return { svg: `<polyline points="${coords.map(project).map((p) => p.join(',')).join(' ')}" fill="none" stroke="#2563eb" stroke-width="1.3"/>`, points }
  }
  if (type === 'MultiLineString') {
    return { svg: coords.map((line) => `<polyline points="${line.map(project).map((p) => p.join(',')).join(' ')}" fill="none" stroke="#2563eb" stroke-width="1.2"/>`).join(''), points }
  }
  if (type === 'Polygon') {
    const outer = coords[0] || []
    return { svg: `<polygon points="${outer.map(project).map((p) => p.join(',')).join(' ')}" fill="#dbeafe" stroke="#2563eb" stroke-width="1.1"/>`, points }
  }
  if (type === 'MultiPolygon') {
    return { svg: coords.map((poly) => `<polygon points="${(poly[0] || []).map(project).map((p) => p.join(',')).join(' ')}" fill="#dbeafe" stroke="#2563eb" stroke-width="1.1"/>`).join(''), points }
  }
  if (type === 'GeometryCollection') {
    const parts = (geometry.geometries || []).map((item) => geometryPaths(item, project))
    return { svg: parts.map((part) => part.svg).join(''), points: parts.flatMap((part) => part.points) }
  }
  return { svg: '', points }
}

export function inspectGeoJSON(buffer, name = 'GeoJSON') {
  let data
  try { data = JSON.parse(Buffer.from(buffer).toString('utf8')) } catch (error) {
    throw new Error(`GeoJSON 解析失败：${error.message}`)
  }
  if (!data || typeof data !== 'object') throw new Error('GeoJSON 根节点不是对象')
  if (data.type === 'FeatureCollection') {
    if (!Array.isArray(data.features)) throw new Error('FeatureCollection 缺少 features 数组')
  } else if (data.type !== 'Feature' && !/Geometry$/.test(String(data.type || ''))) {
    throw new Error(`不支持的 GeoJSON 类型：${data.type || '未知'}`)
  }
  const features = data.type === 'FeatureCollection' ? data.features : [data]
  const points = []
  const geometryTypes = new Set()
  const layers = new Set()
  let invalid = 0
  features.forEach((feature, index) => {
    if (!feature) return
    const geometry = feature.type === 'Feature' ? feature.geometry : feature
    if (!geometry) { invalid += 1; return }
    geometryTypes.add(String(geometry.type || 'Unknown'))
    const props = feature.properties || {}
    if (props.layer) layers.add(String(props.layer))
    flattenCoords(geometry.coordinates, points).forEach((pt) => {
      if (Array.isArray(pt) && Number.isFinite(pt[0]) && Number.isFinite(pt[1])) points.push(pt)
    })
  })
  const bbox = bboxOf(points)
  if (!bbox) throw new Error('GeoJSON 中没有可用的二维坐标')
  const project = projector(bbox)
  const inner = features.map((feature) => {
    const geometry = feature?.type === 'Feature' ? feature.geometry : feature
    if (!geometry) return ''
    return geometryPaths(geometry, project).svg
  }).join('')
  return {
    kind: 'geojson',
    name,
    type: data.type,
    features: features.length,
    invalidFeatures: invalid,
    geometryTypes: [...geometryTypes],
    layers: [...layers],
    bbox: [round(bbox.minX), round(bbox.minY), round(bbox.maxX), round(bbox.maxY)],
    crs: data.crs?.properties?.name || (data.crs ? String(data.crs) : 'WGS84（GeoJSON 默认）'),
    pointCount: points.length,
    svg: svgWrap(inner, `GeoJSON · ${features.length} 个要素 · WGS84`),
  }
}

function dxfPairs(text) {
  const lines = text.split(/\r?\n/)
  const pairs = []
  for (let i = 0; i < lines.length - 1; i += 2) {
    const code = Number(String(lines[i]).trim())
    if (!Number.isFinite(code)) continue
    pairs.push([code, String(lines[i + 1]).trim()])
  }
  return pairs
}

export function inspectDXF(buffer, name = 'DXF') {
  const text = Buffer.from(buffer).toString('utf8')
  if (!/^\s*0\s*\r?\nSECTION/m.test(text) && !/\bSECTION\b/.test(text)) throw new Error('不是可识别的 ASCII DXF（缺少 SECTION 结构）')
  const pairs = dxfPairs(text)
  const entities = []
  const points = []
  let i = 0
  while (i < pairs.length) {
    if (pairs[i][0] === 0 && pairs[i][1] === 'LINE') {
      const entity = { type: 'LINE', layer: '0' }
      i += 1
      while (i < pairs.length && pairs[i][0] !== 0) {
        const [code, value] = pairs[i]
        if (code === 8) entity.layer = value
        if (code === 10) entity.x1 = Number(value)
        if (code === 20) entity.y1 = Number(value)
        if (code === 11) entity.x2 = Number(value)
        if (code === 21) entity.y2 = Number(value)
        i += 1
      }
      if ([entity.x1, entity.y1, entity.x2, entity.y2].every(Number.isFinite)) entities.push(entity)
      continue
    }
    if (pairs[i][0] === 0 && (pairs[i][1] === 'LWPOLYLINE' || pairs[i][1] === 'POLYLINE')) {
      const entity = { type: pairs[i][1], layer: '0', vertices: [] }
      i += 1
      while (i < pairs.length && pairs[i][0] !== 0) {
        const [code, value] = pairs[i]
        if (code === 8) entity.layer = value
        if (code === 10) entity.x = Number(value)
        if (code === 20) entity.y = Number(value)
        if (code === 10 || code === 20) {
          if (entity.x !== undefined && entity.y !== undefined) entity.vertices.push([entity.x, entity.y])
        }
        i += 1
      }
      if (entity.vertices.length >= 2) entities.push(entity)
      continue
    }
    if (pairs[i][0] === 0 && pairs[i][1] === 'CIRCLE') {
      const entity = { type: 'CIRCLE', layer: '0' }
      i += 1
      while (i < pairs.length && pairs[i][0] !== 0) {
        const [code, value] = pairs[i]
        if (code === 8) entity.layer = value
        if (code === 10) entity.cx = Number(value)
        if (code === 20) entity.cy = Number(value)
        if (code === 40) entity.r = Number(value)
        i += 1
      }
      if ([entity.cx, entity.cy, entity.r].every(Number.isFinite)) entities.push(entity)
      continue
    }
    if (pairs[i][0] === 0 && pairs[i][1] === 'TEXT') {
      const entity = { type: 'TEXT', layer: '0' }
      i += 1
      while (i < pairs.length && pairs[i][0] !== 0) {
        const [code, value] = pairs[i]
        if (code === 8) entity.layer = value
        if (code === 10) entity.x = Number(value)
        if (code === 20) entity.y = Number(value)
        if (code === 1) entity.text = value
        i += 1
      }
      if (Number.isFinite(entity.x) && Number.isFinite(entity.y)) entities.push(entity)
      continue
    }
    i += 1
  }
  const layers = new Set()
  for (const entity of entities) {
    layers.add(entity.layer || '0')
    if (entity.type === 'LINE') points.push([entity.x1, entity.y1], [entity.x2, entity.y2])
    else if (entity.vertices) points.push(...entity.vertices)
    else if (entity.type === 'CIRCLE') points.push([entity.cx - entity.r, entity.cy - entity.r], [entity.cx + entity.r, entity.cy + entity.r])
    else if (entity.type === 'TEXT') points.push([entity.x, entity.y])
  }
  const bbox = bboxOf(points)
  if (!bbox) throw new Error('DXF 中没有可显示的二维几何对象')
  const project = projector(bbox)
  const inner = entities.map((entity) => {
    if (entity.type === 'LINE') {
      const a = project([entity.x1, entity.y1])
      const b = project([entity.x2, entity.y2])
      return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#0f766e" stroke-width="1.2"/>`
    }
    if (entity.vertices) {
      return `<polyline points="${entity.vertices.map(project).map((p) => p.join(',')).join(' ')}" fill="none" stroke="#0f766e" stroke-width="1.2"/>`
    }
    if (entity.type === 'CIRCLE') {
      const c = project([entity.cx, entity.cy])
      const scale = Math.max(1, Math.min((W - PAD * 2) / Math.max(bbox.width, 1e-9), (H - PAD * 2) / Math.max(bbox.height, 1e-9)))
      return `<circle cx="${c[0]}" cy="${c[1]}" r="${round(entity.r * scale)}" fill="none" stroke="#0f766e" stroke-width="1.1"/>`
    }
    if (entity.type === 'TEXT') {
      const p = project([entity.x, entity.y])
      return `<text x="${p[0]}" y="${p[1]}" font-size="10" fill="#334155">${escapeXml(entity.text || '')}</text>`
    }
    return ''
  }).join('')
  return {
    kind: 'dxf',
    name,
    type: 'DXF',
    features: entities.length,
    entityTypes: [...new Set(entities.map((entity) => entity.type))],
    layers: [...layers],
    bbox: [round(bbox.minX), round(bbox.minY), round(bbox.maxX), round(bbox.maxY)],
    crs: 'DXF 图纸坐标（未声明 GIS 坐标系）',
    pointCount: points.length,
    // 保留解析出的实体，供平台格式基座做同格式回写；预览本身仍然只暴露 SVG。
    entities: entities.map((entity) => ({ ...entity })),
    svg: svgWrap(inner, `DXF · ${entities.length} 个实体 · ${layers.size} 个图层`),
  }
}

export function inspectSpatial(buffer, name) {
  const ext = String(name || '').toLowerCase().split('.').pop()
  if (ext === 'json' || ext === 'geojson') return inspectGeoJSON(buffer, name)
  if (ext === 'dxf') return inspectDXF(buffer, name)
  throw new Error(`暂不支持 ${ext || '未知'} 格式；当前独立运行时支持 GeoJSON 与 ASCII DXF，DWG 需先转换为 DXF。`)
}
