/**
 * Harness 通用基础服务
 * 这些服务不隶属于某个业务模块，可供 Chat、Work、项目页与 MCP 工具共同调用。
 * 目前落地的是代码审查与地下管网查询；后续静态检查、依赖审计等也在这里注册，而不是各自散在路由里。
 */
import { reviewCode } from './review.mjs'
import { searchPipelineFeatures } from './pipeline.mjs'

export const HARNESS_BASE_SERVICES = [
  {
    id: 'code-review',
    label: '代码审查',
    kind: 'analysis',
    description: '对项目源码目录执行语法检查、JSON 可解析性检查与静态规则扫描，输出带文件、行号和证据的报告。',
    input: ['projectId', 'scope(all|changed)', 'maxFiles'],
    output: ['findings', 'severity', 'syntax', 'json', 'git'],
    risk: '只读',
    note: '不是 DSH 的 auto-review 权限层；不修改文件、不生成伪造结论。',
  },
  {
    id: 'pipeline-query',
    label: '地下管网查询',
    kind: 'query',
    description: '在指定管网数据集中按编号、类别、材质、道路、权属等关键字检索管段或管点，返回原始属性与数据质量标记。',
    input: ['datasetId', 'query', 'kind(line|node)', 'limit'],
    output: ['items', 'total'],
    risk: '只读',
    note: '只做检索，不做几何判定；分析类结论必须通过专业分析接口计算，AI 不代为判定数值。',
  },
]

export function listHarnessServices() {
  return HARNESS_BASE_SERVICES
}

export function harnessServiceMeta(id) {
  return HARNESS_BASE_SERVICES.find((service) => service.id === id) || null
}

export async function runHarnessService(id, args = {}) {
  if (id === 'pipeline-query') {
    const datasetId = String(args.datasetId || '')
    if (!datasetId) throw Object.assign(new Error('缺少数据集编号'), { status: 400 })
    const result = searchPipelineFeatures(datasetId, {
      query: String(args.query || ''),
      kind: args.kind === 'node' ? 'node' : 'line',
      limit: Number(args.limit) || 50,
    })
    return { service: 'pipeline-query', datasetId, result }
  }
  if (id !== 'code-review') throw Object.assign(new Error(`未知的 Harness 基础服务：${id}`), { status: 404 })
  const cwd = String(args.cwd || '')
  if (!cwd) throw Object.assign(new Error('缺少待审查的源码目录'), { status: 400 })
  const report = await reviewCode(cwd, {
    scope: args.scope === 'changed' ? 'changed' : 'all',
    maxFiles: Number(args.maxFiles) || 160,
  })
  return { service: 'code-review', report }
}
