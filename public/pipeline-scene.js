/**
 * 地下管网三维场景（一期）：纯 Three.js 客户端渲染，不依赖 SuperMap / Cesium。
 * 数据来自 /api/pipeline/scene 的场景载荷（局部平面坐标 + 高程），在此体化为管体、管点与地面。
 * 坐标约定：数据 x → 世界 x（东），数据 y → 世界 -z（北），高程 z → 世界 y。
 */

import * as THREE from './vendor/pipeline/three.module.js'

export const PIPE_COLORS = {
  water: '#2f7dd1',
  sewer: '#5a8f4a',
  gas: '#c88a1e',
  heat: '#b4472f',
  power: '#7a4fb5',
  telecom: '#2f9c94',
  industrial: '#8a6b4a',
  gallery: '#6b6f76',
  other: '#9aa0a6',
}

export const PIPE_LABELS = {
  water: '给水', sewer: '排水', gas: '燃气', heat: '热力',
  power: '电力', telecom: '通信', industrial: '工业', gallery: '综合管廊', other: '其他',
}

const colorOf = (major) => PIPE_COLORS[major] || PIPE_COLORS.other

function pipeRadius(line) {
  const size = Number(line.sizeMm) || 0
  // 排管/箱涵的 sizeMm 常写成总宽（如 6000），不能直接当管径，按宽度或默认值处理
  if (size > 0 && size <= 2000) return Math.min(Math.max(size / 2000, 0.12), 1.2)
  if (line.width && line.height) return Math.min(Math.max(Math.max(line.width, line.height) / 2, 0.1), 1.2)
  return 0.3
}

/** 一条线按顶点分段生成管体；矩形断面用 Box，其余用圆柱。 */
function buildPipeGroup(line, frameDict, material) {
  const group = new THREE.Group()
  const coords = line.coords || []
  const isRect = /矩形|方|箱涵|管沟/.test(String(line.profileType || ''))
  const radius = line.zGrade === 'none' ? Math.max(pipeRadius(line), 0.55) : pipeRadius(line)
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
  renderer.setClearColor(0x0f1620, 1)
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(0x0f1620, 800, 2200)

  const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 6000)
  camera.position.set(0, 300, 400)

  scene.add(new THREE.HemisphereLight(0xdbe7ff, 0x33404f, 1.15))
  const keyLight = new THREE.DirectionalLight(0xf2f6ff, 1.5)
  keyLight.position.set(120, 420, 180)
  scene.add(keyLight)
  const fillLight = new THREE.DirectionalLight(0x8fb4d9, 0.55)
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

  function applyCamera() {
    const r = cam.radius
    const sp = Math.sin(cam.phi)
    camera.position.set(
      cam.target.x + r * sp * Math.sin(cam.theta),
      cam.target.y + r * Math.cos(cam.phi),
      cam.target.z + r * sp * Math.cos(cam.theta),
    )
    camera.lookAt(cam.target)
    state.dirty = true
  }

  const el = renderer.domElement

  el.addEventListener('pointerdown', (event) => {
    el.setPointerCapture(event.pointerId)
    dragging = event.button === 2 || event.shiftKey ? 'pan' : 'rotate'
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
      else pickAt(event)
    }
    dragging = null
    state.dirty = true
  }
  el.addEventListener('pointerup', endDrag)
  el.addEventListener('pointercancel', () => { dragging = null })
  el.addEventListener('contextmenu', (event) => event.preventDefault())
  el.addEventListener('wheel', (event) => {
    event.preventDefault()
    cam.radius = Math.min(Math.max(cam.radius * (1 + Math.sign(event.deltaY) * 0.12), 8), 6000)
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
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)
    const targets = pickGroup ? pickGroup.children : []
    const hits = raycaster.intersectObjects(targets, false)
    const hit = hits.find((item) => item.object.userData?.kind)
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
      new THREE.MeshBasicMaterial({ color: 0xffd166 }),
    )
    dot.position.copy(point)
    measureLayer.add(dot)
    let distance = null
    if (measure.points.length === 2) {
      distance = measure.points[0].distanceTo(measure.points[1])
      const geo = new THREE.BufferGeometry().setFromPoints(measure.points)
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffd166 }))
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

    const cx = (bounds.minX + bounds.maxX) / 2
    const cy = (bounds.minY + bounds.maxY) / 2
    const topZ = Number.isFinite(bounds.maxZ) ? bounds.maxZ : 0
    const lowZ = Number.isFinite(bounds.minZ) ? bounds.minZ : topZ - 6
    const spanX = Math.max(bounds.maxX - bounds.minX, 10)
    const spanY = Math.max(bounds.maxY - bounds.minY, 10)
    const baseZ = lowZ
    // 地面高程优先用管点的实测地面高程中位数，缺失时才抬到最高管顶之上
    const grounds = (payload.nodes || []).map((node) => node.groundElev).filter((value) => Number.isFinite(value))
    const groundZ = grounds.length
      ? grounds.reduce((sum, value) => sum + value, 0) / grounds.length
      : topZ + 0.6

    const frame = {
      cx, cy, baseZ, topZ,
      groundY: Math.max(groundZ - baseZ, topZ - baseZ + 0.2),
      height: Math.max(groundZ - baseZ + 1.5, 3),
      point: (coord) => {
        if (!coord || !Number.isFinite(coord[0]) || !Number.isFinite(coord[1])) return null
        const z = Number.isFinite(coord[2]) ? coord[2] : baseZ + 0.2
        return new THREE.Vector3(coord[0] - cx, z - baseZ, -(coord[1] - cy))
      },
    }
    state.frame = frame

    // 地面：网格 + 半透明板，可调透明度用于"地下漫游"
    const gridSize = Math.max(spanX, spanY) * 1.6
    const grid = new THREE.GridHelper(gridSize, 24, 0x2a3b4d, 0x1b2836)
    grid.position.y = frame.groundY
    world.add(grid)

    const groundGeo = new THREE.PlaneGeometry(gridSize, gridSize)
    const groundMat = new THREE.MeshBasicMaterial({ color: 0x1b2634, transparent: true, opacity: state.groundAlpha, depthWrite: false })
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
          color: planned ? 0xffffff : color,
          emissive: planned ? new THREE.Color(color).multiplyScalar(0.55) : 0x000000,
          metalness: 0.18, roughness: 0.62,
          transparent: line.zGrade === 'none' || planned,
          opacity: line.zGrade === 'none' && !planned ? 0.45 : (planned ? 0.62 : 1),
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
    const nodeMaterial = new THREE.MeshStandardMaterial({ color: 0xb8c6d4, metalness: 0.2, roughness: 0.55 })
    for (const node of payload.nodes || []) {
      const p = frame.point([node.x, node.y, node.z])
      if (!p) continue
      const isWell = /井|阀门|三通|弯头/.test(String(node.category || ''))
      const r = isWell ? 0.62 : 0.28
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

    // 相机取景：把整幅管网放进视野，避免初始视角贴在管线中间
    cam.target.set(0, frame.groundY * 0.75, 0)
    cam.radius = Math.max(spanX, spanY, 20) * 0.95 + 12
    cam.theta = -Math.PI / 4
    cam.phi = 0.66
    applyCamera()
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

  function resetView() {
    if (!state.payload?.bounds) return
    const b = state.payload.bounds
    cam.target.set(0, Math.max(((b.maxZ ?? 0) - (b.minZ ?? 0)) * 0.5, 0), 0)
    cam.radius = Math.max(b.maxX - b.minX, b.maxY - b.minY, 10) * 0.85
    cam.theta = -Math.PI / 4
    cam.phi = 0.72
    applyCamera()
  }

  function topView() {
    if (!state.payload?.bounds) return
    cam.phi = 0.09
    applyCamera()
  }

  function zoomBy(factor) {
    const f = Number(factor) || 1
    cam.radius = Math.min(Math.max(cam.radius * f, 8), 6000)
    applyCamera()
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
    focus, resetView, topView, zoomBy, setMeasure, clearMeasure, resize, dispose,
    renderOnce() { resize(); renderer.render(scene, camera); state.dirty = false; return true },
    get renderer() { return renderer },
  }
}



