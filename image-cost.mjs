/**
 * 图像成本汇总：只统计真正落库的成本，不做估算补齐。
 * 迁移到选区重绘之前的历史版本没有 cost 字段，按“未记录”单列，避免把回算值混进实付总额。
 * 画布标注、缩放、去背景等本地操作不产生模型费用，单独计为“本地操作”，不拉低覆盖率。
 */
const LOCAL_EDIT_MODELS = new Set(['canvas-annotate', 'canvas-resize', 'canvas-crop', 'remove-image-background'])

export function summarizeImageCost(rows = []) {
  const summary = {
    revisions: 0,
    recorded: 0,
    unrecorded: 0,
    unpriced: 0,
    local: 0,
    costCny: 0,
    costCredits: 0,
    coverage: 0,
    models: [],
  }
  const byModel = new Map()

  for (const row of rows) {
    let params = {}
    try {
      params = row?.params ? JSON.parse(row.params) : {}
    } catch {
      params = {}
    }
    const cost = params && typeof params.cost === 'object' && params.cost ? params.cost : null
    const modelKey = String(row?.modelId || row?.model || '未知模型')
    const isLocal = LOCAL_EDIT_MODELS.has(modelKey)
    const item = byModel.get(modelKey) || {
      modelId: modelKey,
      model: String(row?.model || ''),
      revisions: 0,
      recorded: 0,
      unrecorded: 0,
      unpriced: 0,
      local: 0,
      costCny: 0,
      costCredits: 0,
    }

    summary.revisions += 1
    item.revisions += 1

    if (isLocal) {
      summary.local += 1
      item.local += 1
    } else if (!cost) {
      summary.unrecorded += 1
      item.unrecorded += 1
    } else if (cost.priced === false || cost.cny == null) {
      summary.unpriced += 1
      item.unpriced += 1
    } else {
      const cny = Number(cost.cny) || 0
      const credits = Number(cost.credits) || cny * 100
      summary.recorded += 1
      summary.costCny += cny
      summary.costCredits += credits
      item.recorded += 1
      item.costCny += cny
      item.costCredits += credits
    }
    byModel.set(modelKey, item)
  }

  summary.costCny = Number(summary.costCny.toFixed(6))
  summary.costCredits = Number(summary.costCredits.toFixed(2))
  const billable = summary.revisions - summary.local
  summary.coverage = billable ? Number((summary.recorded / billable).toFixed(3)) : 0
  summary.models = [...byModel.values()]
    .map((item) => ({
      ...item,
      costCny: Number(item.costCny.toFixed(6)),
      costCredits: Number(item.costCredits.toFixed(2)),
    }))
    .sort((a, b) => b.costCny - a.costCny || b.revisions - a.revisions)
  return summary
}
