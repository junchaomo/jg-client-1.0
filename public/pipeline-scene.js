/**
 * 地下管网三维场景（一期）：纯 Three.js 客户端渲染，不依赖 SuperMap / Cesium。
 * 数据来自 /api/pipeline/scene 的场景载荷（局部平面坐标 + 高程），在此体化为管体、管点与地面。
 * 坐标约定：数据 x → 世界 x（东），数据 y → 世界 -z（北），高程 z → 世界 y。
 */

import * as THREE from './vendor/pipeline/three.module.js'

export const PIPE_COLORS = {
  supply: '#2f7dd1',
  distribution: '#5fa8dd',
  rain: '#3f86a8',
  intercept: '#7f9440',
  sewage: '#5a8f4a',
  combined: '#8f8a4a',
  power: '#7a4fb5',
  telecom: '#2f9c94',
  gas: '#c88a1e',
  heat: '#b4472f',
  gallery: '#6b6f76',
  other: '#9aa0a6',
}

export const PIPE_LABELS = {
  supply: '供水', distribution: '配水', rain: '雨水', intercept: '截污', sewage: '污水', combined: '合流',
  power: '电力', telecom: '通信', gas: '燃气', heat: '热力', gallery: '管廊', other: '其他',
}

const colorOf = (major) => PIPE_COLORS[major] || PIPE_COLORS.other

function pipeRadius(line) {
  const size = Number(line.sizeMm) || 0
  // 排管/箱涵的 sizeMm 常写成总宽（如 6000），不能直接当管径，按宽度或默认值处理
  if (size > 0 && size <= 2000) return Math.min(Math.max(size / 1200, 0.4), 1.8)
  if (line.width && line.height) return Math.min(Math.max(Math.max(line.width, line.height) / 2, 0.35), 1.8)
  return 0.4
}

/** 一条线按顶点分段生成管体；矩形断面用 Box，其余用圆柱。 */
function buildPipeGroup(line, frameDict, material) {
  const group = new THREE.Group()
  const coords = line.coords || []
  const isRect = /矩形|方|箱涵|管沟/.test(String(line.profileType || ''))
  const floorR = frameDict.minRadius || 0
  const drew = pipeRadius(line)
  const radius = line.zGrade === 'none' ? Math.max(drew, 1.1) : Math.max(drew, floorR)
  for (let i = 1; i < coords.length; i += 1) {
    const a = frameDict.point(coords[i - 1])
    const b = frameDict.point(coords[i])
    if (!a || !b) continue
    const dir = new THREE.Vector3().subVectors(b, a)
    const length = dir.length()
    if (length < 0.01) continue
    let mesh
    if (isRect) {
      const w = Math.max((line.width || radius * 2), 0.2)
      const h = Math.max((line.height || radius * 2), 0.2)
      mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, length), material)
    } else {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 12, 1, false), material)
    }
    mesh.position.copy(a).add(b).multiplyScalar(0.5)
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
    mesh.userData = { kind: 'line', id: line.id, code: line.code, line }
    group.add(mesh)
  }
  return group
}

export function createPipeScene(container, options = {}) {
  const state = {
    payload: null,
    frame: null,
    visibleMajors: null,
    groundAlpha: 0.14,
    onPick: options.onPick || null,
    onMeasure: options.onMeasure || null,
    hover: null,
    dirty: true,
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(container.clientWidth || 1, container.clientHeight || 1)
  renderer.setClearColor(0xe9edf2, 1)
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(0xe9edf2, 900, 2600)

  const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 6000)
  camera.position.set(0, 300, 400)

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9c4d0, 1.05))
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.15)
  keyLight.position.set(120, 420, 180)
  scene.add(keyLight)
  const fillLight = new THREE.DirectionalLight(0xcfd9e4, 0.35)
  fillLight.position.set(-180, 160, -240)
  scene.add(fillLight)

  // 世界根，便于整体平移/缩放
  const world = new THREE.Group()
  scene.add(world)

  // 控制：左键旋转、右键/Shift 平移、滚轮缩放；WASD 平移漫游
  const cam = { theta: -Math.PI / 4, phi: 0.72, radius: 500, target: new THREE.Vector3(0, 0, 0) }
  let dragging = null
  let lastX = 0
  let lastY = 0
  let moved = 0
  let panMode = false
  let identifyMode = true

  function applyCamera() {
    const r = cam.radius
    const sp = Math.sin(cam.phi)
    camera.position.set(
      cam.target.x + r * sp * Math.sin(cam.theta),
      cam.target.y + r * Math.cos(cam.phi),
      cam.target.z + r * sp * Math.cos(cam.theta),
    )
    camera.lookAt(cam.target)
    // 雾化与裁切面随观察距离自适应：CAD 总图常达数公里，固定 900~2600 的雾会把整幅管网雾成底色
    const fogNear = Math.max(120, r * 0.35)
    const fogFar = Math.max(2400, r * 2.6)
    if (scene.fog) {
      scene.fog.near = fogNear
      scene.fog.far = fogFar
    }
    const far = Math.max(6000, r * 4)
    if (Math.abs(camera.far - far) > far * 0.02) {
      camera.far = far
      camera.near = Math.max(0.1, r * 0.0008)
      camera.updateProjectionMatrix()
    }
    state.dirty = true
  }

  const el = renderer.domElement

  el.addEventListener('pointerdown', (event) => {
    el.setPointerCapture(event.pointerId)
    dragging = event.button === 2 || event.shiftKey || panMode ? 'pan' : 'rotate'
    lastX = event.clientX
    lastY = event.clientY
    moved = 0
  })

  el.addEventListener('pointermove', (event) => {
    if (!dragging) return
    const dx = event.clientX - lastX
    const dy = event.clientY - lastY
    lastX = event.clientX
    lastY = event.clientY
    moved += Math.abs(dx) + Math.abs(dy)
    if (dragging === 'rotate') {
      cam.theta -= dx * 0.006
      cam.phi = Math.min(Math.max(cam.phi - dy * 0.005, 0.08), Math.PI / 2 - 0.02)
    } else {
      const scale = cam.radius * 0.0016
      const forward = new THREE.Vector3(Math.sin(cam.theta), 0, Math.cos(cam.theta))
      const right = new THREE.Vector3(forward.z, 0, -forward.x)
      cam.target.addScaledVector(right, dx * scale).addScaledVector(forward, dy * scale)
    }
    applyCamera()
  })

  const endDrag = (event) => {
    if (dragging && moved < 4 && dragging === 'rotate') {
      if (measure.enabled) measureClick(event)
      else if (identifyMode) pickAt(event)
    }
    dragging = null
    state.dirty = true
  }
  el.addEventListener('pointerup', endDrag)
  el.addEventListener('pointercancel', () => { dragging = null })
  el.addEventListener('contextmenu', (event) => event.preventDefault())
  el.addEventListener('wheel', (event) => {
    event.preventDefault()
    cam.radius = Math.min(Math.max(cam.radius * (1 + Math.sign(event.deltaY) * 0.12), 8), 30000)
    applyCamera()
  }, { passive: false })

  const pressed = new Set()
  el.addEventListener('pointerenter', () => el.focus())
  el.tabIndex = 0
  el.addEventListener('keydown', (event) => { pressed.add(event.key.toLowerCase()) })
  el.addEventListener('keyup', (event) => { pressed.delete(event.key.toLowerCase()) })
  el.addEventListener('blur', () => pressed.clear())

  function tickWalk() {
    if (!pressed.size) return
    const step = cam.radius * 0.012
    const forward = new THREE.Vector3(Math.sin(cam.theta), 0, Math.cos(cam.theta))
    const right = new THREE.Vector3(forward.z, 0, -forward.x)
    let delta = null
    if (pressed.has('w')) delta = forward.clone().multiplyScalar(-step)
    else if (pressed.has('s')) delta = forward.clone().multiplyScalar(step)
    else if (pressed.has('a')) delta = right.clone().multiplyScalar(-step)
    else if (pressed.has('d')) delta = right.clone().multiplyScalar(step)
    if (delta) { cam.target.add(delta); applyCamera() }
  }

  // 拾取
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  let pickGroup = null

  function pickAt(event) {
    const rect = el.getBoundingClientRect()
    const targets = pickGroup ? pickGroup.children : []
    // 管体在屏幕上很细，单点射线容易擦空：以命中点为中心做 3~5 像素的容差采样
    const offsets = [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3], [5, 2], [-5, -2]]
    let hit = null
    for (const [ox, oy] of offsets) {
      pointer.x = ((event.clientX + ox - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY + oy - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects(targets, false)
      hit = hits.find((item) => item.object.userData?.kind) || null
      if (hit) break
    }
    if (!state.onPick) return
    state.onPick(hit ? { ...hit.object.userData, point: hit.point } : null)
  }

  // 断面 / 开挖 / 量测覆盖层
  let sectionLayer = null
  let excavationLayer = null
  let measureLayer = null
  const measure = { enabled: false, points: [] }

  function clearMeasure() {
    measure.points = []
    if (measureLayer) {
      world.remove(measureLayer)
      measureLayer.traverse((node) => {
        if (node.geometry) node.geometry.dispose()
        if (node.material) node.material.dispose()
      })
      measureLayer = null
    }
    state.dirty = true
  }

  function setMeasure(enabled) {
    measure.enabled = Boolean(enabled)
    el.style.cursor = measure.enabled ? 'crosshair' : ''
    if (!measure.enabled) clearMeasure()
  }

  // 量测取点：优先打在管线/管点上，否则落到地面板
  function scenePointAt(event) {
    const rect = el.getBoundingClientRect()
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)
    const targets = []
    if (state.ground) targets.push(state.ground)
    if (pickGroup) for (const mesh of pickGroup.children) if (mesh.isMesh) targets.push(mesh)
    const hits = raycaster.intersectObjects(targets, false)
    return hits.length ? hits[0].point.clone() : null
  }

  function measureClick(event) {
    const point = scenePointAt(event)
    if (!point) return
    if (measure.points.length >= 2) clearMeasure()
    measure.points.push(point)
    if (!measureLayer) {
      measureLayer = new THREE.Group()
      world.add(measureLayer)
    }
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xef8b1f }),
    )
    dot.position.copy(point)
    measureLayer.add(dot)
    let distance = null
    if (measure.points.length === 2) {
      distance = measure.points[0].distanceTo(measure.points[1])
      const geo = new THREE.BufferGeometry().setFromPoints(measure.points)
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xef8b1f }))
      measureLayer.add(line)
    }
    state.dirty = true
    if (state.onMeasure) state.onMeasure({ distance, count: measure.points.length, points: measure.points.map((p) => ({ x: p.x, y: p.y, z: p.z })) })
  }

  function clearLayer(layer) {
    if (!layer) return
    world.remove(layer)
    layer.traverse((node) => {
      if (node.geometry) node.geometry.dispose()
      if (node.material) node.material.dispose()
    })
  }

  function setSection(result) {
    clearLayer(sectionLayer)
    sectionLayer = null
    if (!result || !state.frame) return
    const group = new THREE.Group()
    const f = state.frame
    const line = result.sectionLine
    const a = f.point([line[0][0], line[0][1], null])
    const b = f.point([line[1][0], line[1][1], null])
    const width = Math.max(result.width || 0.4, 0.4)
    const span = a.distanceTo(b) || 1
    const geo = new THREE.PlaneGeometry(span, f.height * 1.6)
    const mat = new THREE.MeshBasicMaterial({ color: 0x5b7cfa, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false })
    const plane = new THREE.Mesh(geo, mat)
    plane.position.copy(a).add(b).multiplyScalar(0.5)
    const dir = new THREE.Vector3().subVectors(b, a)
    plane.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.clone().normalize())
    group.add(plane)

    for (const hit of result.hits || []) {
      const color = colorOf(hit.major)
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(Math.max((hit.sizeMm || 200) / 2000, 0.14), 12, 10),
        new THREE.MeshBasicMaterial({ color }),
      )
      const p = f.point([hit.x, hit.y, hit.z])
      if (p) marker.position.copy(p)
      marker.userData = { kind: 'section-hit', code: hit.lineCode, hit }
      group.add(marker)
    }
    world.add(group)
    sectionLayer = group
    state.dirty = true
  }

  function setExcavation(result) {
    clearLayer(excavationLayer)
    excavationLayer = null
    if (!result || !state.frame || !Array.isArray(result.polygon)) return
    const f = state.frame
    const points = result.polygon.map((p) => f.point([p[0], p[1], null]))
    if (points.some((p) => !p)) return
    const shape = new THREE.Shape(points.map((p) => new THREE.Vector2(p.x, p.z)))
    const depth = Number(result.depth) || 2
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false })
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0xe0a94b, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false,
    }))
    mesh.rotation.x = Math.PI / 2
    mesh.position.y = f.groundY
    world.add(mesh)
    excavationLayer = mesh
    state.dirty = true
  }

  /** 稳健平面范围：CAD 图常有个别游离图元把整体包围盒撑到几十公里，取 1%~99% 分位作为实际取景范围 */
function robustPlanBox(payload) {
  const b = payload?.bounds
  if (!b) return null
  const xs = []
  const ys = []
  for (const n of payload.nodes || []) {
    if (Number.isFinite(n.x)) xs.push(n.x)
    if (Number.isFinite(n.y)) ys.push(n.y)
  }
  for (const l of payload.lines || []) {
    const c = l.coords || []
    if (!c.length) continue
    const a = c[0]
    const z = c[c.length - 1]
    if (Number.isFinite(a?.[0])) xs.push(a[0])
    if (Number.isFinite(a?.[1])) ys.push(a[1])
    if (Number.isFinite(z?.[0])) xs.push(z[0])
    if (Number.isFinite(z?.[1])) ys.push(z[1])
  }
  if (xs.length < 20 || ys.length < 20) return b
  xs.sort((p, q) => p - q)
  ys.sort((p, q) => p - q)
  const pick = (arr, p) => arr[Math.min(arr.length - 1, Math.max(0, Math.round((arr.length - 1) * p)))]
  return {
    minX: pick(xs, 0.01), maxX: pick(xs, 0.99),
    minY: pick(ys, 0.01), maxY: pick(ys, 0.99),
    minZ: b.minZ, maxZ: b.maxZ,
  }
}

function setData(payload) {
    state.payload = payload
    while (world.children.length) world.remove(world.children[0])
    sectionLayer = null
    excavationLayer = null
    measureLayer = null
    measure.points = []
    pickGroup = new THREE.Group()

    const bounds = payload?.bounds
    if (!bounds) { state.frame = null; state.dirty = true; return }
    const viewBounds = robustPlanBox(payload) || bounds
    state.viewBounds = viewBounds

    const cx = (viewBounds.minX + viewBounds.maxX) / 2
    const cy = (viewBounds.minY + viewBounds.maxY) / 2
    const topZ = Number.isFinite(bounds.maxZ) ? bounds.maxZ : 0
    const lowZ = Number.isFinite(bounds.minZ) ? bounds.minZ : topZ - 6
    const spanX = Math.max(viewBounds.maxX - viewBounds.minX, 10)
    const spanY = Math.max(viewBounds.maxY - viewBounds.minY, 10)
    const baseZ = lowZ
    // 地面高程优先用管点的实测地面高程中位数，缺失时才抬到最高管顶之上
    const grounds = (payload.nodes || []).map((node) => node.groundElev).filter((value) => Number.isFinite(value))
    const groundZ = grounds.length
      ? grounds.reduce((sum, value) => sum + value, 0) / grounds.length
      : topZ + 0.6

    const frame = {
      cx, cy, baseZ, topZ,
      // 图上直径几十毫米的管在公里级取景下不足一个像素，按平面尺度给一个可见下限
      minRadius: Math.max(0.35, Math.max(spanX, spanY) / 1500),
      groundY: Math.max(groundZ - baseZ, topZ - baseZ + 0.2),
      height: Math.max(groundZ - baseZ + 1.5, 3),
      point: (coord) => {
        if (!coord || !Number.isFinite(coord[0]) || !Number.isFinite(coord[1])) return null
        const z = Number.isFinite(coord[2]) ? coord[2] : baseZ + 0.2
        return new THREE.Vector3(coord[0] - cx, z - baseZ, -(coord[1] - cy))
      },
    }
    state.frame = frame

    // 地面：浅色网格 + 半透明板，可调透明度用于"地下漫游"
    const gridSize = Math.max(spanX, spanY) * 1.6
    const grid = new THREE.GridHelper(gridSize, 24, 0xa9b4c2, 0xc3ccd8)
    grid.position.y = frame.groundY
    world.add(grid)

    const groundGeo = new THREE.PlaneGeometry(gridSize, gridSize)
    const groundMat = new THREE.MeshBasicMaterial({ color: 0xdae1e9, transparent: true, opacity: state.groundAlpha, depthWrite: false })
    const ground = new THREE.Mesh(groundGeo, groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = frame.groundY - 0.06
    ground.userData = { kind: 'ground' }
    world.add(ground)
    state.ground = ground

    // 管线（按大类 + 数据业务状态分组：拟建方案用半透明亮色，便于与现状叠加区分）
    const majorGroups = new Map()
    for (const line of payload.lines || []) {
      const planned = line.stage === 'planned'
      const key = `${line.major || 'other'}|${planned ? 'planned' : 'existing'}`
      if (!majorGroups.has(key)) {
        const color = colorOf(line.major)
        const material = new THREE.MeshStandardMaterial({
          // 拟建方案用同一大类的浅色调 + 轻微自发光，浅色底图上仍能分辨，又和现状实色区分
          color: planned ? new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.22) : color,
          emissive: planned ? new THREE.Color(color).multiplyScalar(0.28) : 0x000000,
          metalness: 0.18, roughness: 0.62,
          transparent: line.zGrade === 'none' || planned,
          opacity: line.zGrade === 'none' && !planned ? 0.85 : (planned ? 0.9 : 1),
        })
        majorGroups.set(key, { material, group: new THREE.Group(), major: line.major || 'other' })
        world.add(majorGroups.get(key).group)
      }
      const bucket = majorGroups.get(key)
      const group = buildPipeGroup(line, frame, bucket.material)
      if (!group) continue
      bucket.group.add(group)
      for (const mesh of group.children) if (mesh?.isMesh) pickGroup.add(mesh)
    }

    // 管点（检查井用较大圆柱，其余用小圆柱）
    const nodeMaterial = new THREE.MeshStandardMaterial({ color: 0x6f7c8c, metalness: 0.2, roughness: 0.55 })
    for (const node of payload.nodes || []) {
      const p = frame.point([node.x, node.y, node.z])
      if (!p) continue
      const isWell = /井|阀门|三通|弯头/.test(String(node.category || ''))
      const r = Math.max(isWell ? 0.8 : 0.45, (frame.minRadius || 0) * 1.6)
      const h = isWell ? 1.7 : 0.5
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 12), nodeMaterial)
      mesh.position.set(p.x, p.y - h / 2, p.z)
      mesh.userData = { kind: 'node', id: node.id, code: node.code, node }
      world.add(mesh)
      pickGroup.add(mesh)
    }

    world.add(pickGroup)
    state.majorGroups = majorGroups
    applyVisibility()

    // 相机取景：先用包围盒粗算距离，再按实际投影结果迭代收敛，保证整幅管网完整入画且不留大片空白
    cam.target.set(0, frame.groundY, 0)
    cam.theta = 0
    cam.phi = 0.52
    cam.radius = Math.max(spanX, spanY, 10) * 0.9
    fitCamera()
  }

  function applyVisibility() {
    const majors = state.visibleMajors
    for (const [, bucket] of state.majorGroups || []) {
      bucket.group.visible = !majors || majors.has(bucket.major)
    }
    if (state.ground) state.ground.material.opacity = state.groundAlpha
    state.dirty = true
  }

  function setVisibleMajors(list) {
    state.visibleMajors = list ? new Set(list) : null
    applyVisibility()
  }

  function setGroundOpacity(alpha) {
    state.groundAlpha = Math.min(Math.max(Number(alpha) || 0, 0), 1)
    applyVisibility()
  }

  function toggleGround(visible) {
    if (state.ground) { state.ground.visible = visible; state.dirty = true }
  }

  function focus(coord) {
    if (!state.frame || !coord) return
    const p = state.frame.point(coord)
    if (!p) return
    cam.target.copy(p)
    cam.radius = Math.min(cam.radius, 60)
    applyCamera()
  }

  /** 按包围盒实际投影结果迭代调整相机距离，避免固定系数在不同视口下裁边或留白 */
  function fitCamera(phi = cam.phi, theta = cam.theta, margin = 0.86) {
    const b = state.viewBounds || state.payload?.bounds
    const f = state.frame
    if (!b || !f) return
    const zLow = b.minZ ?? 0
    let zHigh = b.maxZ ?? zLow + 2
    // CAD 图里偶发的超高/超低 Z（如构件标注值）会把取景拉远到整幅图缩成一团：取景时把竖向跨度压到平面尺度的范围
    const planSpan = Math.max(b.maxX - b.minX, b.maxY - b.minY, 10)
    if (zHigh - zLow > planSpan * 0.08) zHigh = zLow + planSpan * 0.08
    const corners = []
    for (const x of [b.minX, b.maxX]) {
      for (const y of [b.minY, b.maxY]) {
        for (const z of [zLow, zHigh]) corners.push(f.point([x, y, z]))
      }
    }
    cam.phi = phi
    cam.theta = theta
    cam.radius = Math.max(b.maxX - b.minX, b.maxY - b.minY, 10) * 1.2
    for (let i = 0; i < 4; i += 1) {
      applyCamera()
      camera.updateMatrixWorld()
      camera.updateProjectionMatrix()
      let extent = 0
      for (const p of corners) {
        if (!p) continue
        const v = p.clone().project(camera)
        extent = Math.max(extent, Math.abs(v.x), Math.abs(v.y))
      }
      if (!Number.isFinite(extent) || extent < 0.05) break
      const ratio = extent / margin
      if (Math.abs(ratio - 1) < 0.03) break
      cam.radius = Math.min(Math.max(cam.radius * ratio, 8), 30000)
    }
    applyCamera()
  }

  function resetView() {
    if (!state.payload?.bounds) return
    const b = state.payload.bounds
    cam.target.set(0, state.frame ? state.frame.groundY : 0, 0)
    fitCamera(0.58, 0)
  }

  function topView() {
    if (!state.payload?.bounds) return
    cam.phi = 0.09
    applyCamera()
  }

  function zoomBy(factor) {
    const f = Number(factor) || 1
    cam.radius = Math.min(Math.max(cam.radius * f, 8), 30000)
    applyCamera()
  }

  /** 水平旋转相机（正值为逆时针方向，单位：度） */
  function rotateBy(deg) {
    cam.theta += (Number(deg) || 0) * Math.PI / 180
    applyCamera()
  }

  /** 正北朝上：把水平角归零并保持当前俯仰与距离 */
  function resetNorth() {
    cam.theta = 0
    applyCamera()
  }

  /** 平移模式：开启后左键拖动为平移（与右键/Shift 等效） */
  function setPanMode(on) {
    panMode = Boolean(on)
    el.style.cursor = panMode ? 'grab' : ''
  }

  /** 缩放到图层：按当前数据集包络重新取景 */
  function zoomToLayer() {
    resetView()
  }

  /** 识别模式：开启后单击管段/管点拾取属性 */
  function setIdentify(on) {
    identifyMode = Boolean(on)
    if (measure.enabled) return
    el.style.cursor = identifyMode ? 'crosshair' : ''
  }

  function resize() {
    const w = container.clientWidth || 1
    const h = container.clientHeight || 1
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    state.dirty = true
  }

  const observer = new ResizeObserver(() => resize())
  observer.observe(container)

  let raf = 0
  function loop() {
    raf = requestAnimationFrame(loop)
    if (document.hidden) return
    tickWalk()
    if (state.dirty) {
      renderer.render(scene, camera)
      state.dirty = false
    }
  }
  applyCamera()
  loop()

  function dispose() {
    cancelAnimationFrame(raf)
    observer.disconnect()
    renderer.dispose()
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement)
  }

  return {
    setData, setSection, setExcavation, setVisibleMajors, setGroundOpacity, toggleGround,
    focus, resetView, topView, zoomBy, rotateBy, resetNorth, setPanMode, zoomToLayer, setIdentify,
    setMeasure, clearMeasure, resize, dispose,
    renderOnce() { resize(); renderer.render(scene, camera); state.dirty = false; return true },
    get renderer() { return renderer },
  }
}


