export const consoleRoles = [
  { id: 'platform', name: '集团平台管理员', scope: '集团全部管理范围', scopes: ['全部可管理范围', '本单位', '本部门'], modules: ['overview', 'org', 'ai', 'data', 'apps', 'ops', 'security', 'service', 'settings'] },
  { id: 'data', name: '数据管理员', scope: '数据与资源范围', scopes: ['全部可管理范围', '本单位'], modules: ['overview', 'org', 'ai', 'data', 'apps'] },
  { id: 'security', name: '安全管理员', scope: '安全与审计范围', scopes: ['全部可管理范围', '本单位'], modules: ['overview', 'org', 'security', 'service', 'settings'] },
  { id: 'subsidiary', name: '子公司管理员', scope: '九江市规划设计集团', scopes: ['本单位', '本部门'], modules: ['overview', 'org', 'apps', 'ops', 'service'] },
]

export const consoleNav = [
  { group: '治理', items: ['overview', 'org', 'ai', 'data', 'apps'] },
  { group: '运行', items: ['ops', 'security', 'service', 'settings'] },
]

export const consoleModules = {
  overview: { no: '01', label: '管理总览', desc: '运行概况、待办审批、风险告警、平台使用分析' },
  org: { no: '02', label: '组织与权限', desc: '组织架构、人员账号、角色权限、授权审批、账号生命周期' },
  ai: { no: '03', label: 'AI 能力管理', desc: '运行基线、模型网关、Agent 与 MCP、插件与技能市场' },
  data: { no: '04', label: '数据治理', desc: '数据源、资源、元数据、质量、索引、存储、数据服务、数据授权' },
  apps: { no: '05', label: '应用与集成', desc: '应用注册、审核发布、版本管理、接口连接、系统集成' },
  ops: { no: '06', label: '运维监控', desc: '服务监控、服务器资源、任务调度、告警、备份、故障管理' },
  security: { no: '07', label: '安全与审计', desc: '安全策略、敏感访问、权限复核、操作日志、安全事件（对接深信服）' },
  service: { no: '08', label: '服务与工单', desc: '员工报障、人员变动、权限申请、反馈、问题处理' },
  settings: { no: '09', label: '系统设置', desc: '基础配置、客户端版本与环境配置' },
}

// 管理中心只保留结构定义。除总览、AI 能力与已接入的运行时计数外，
// 未接入真实数据源的模块一律返回空数据，不再下发演示数字或演示表格。
export const consoleSections = {
  overview: {
    title: '管理总览',
    meta: '运行概况只展示当前运行时实际计数；未接入监控的指标不展示',
    kpis: [],
    blocks: [],
  },
  org: {
    title: '组织与权限',
    meta: '人事主数据与账号目录尚未接入；本模块暂不展示演示数据',
    kpis: [],
    blocks: [],
  },
  ai: {
    title: 'AI 能力管理',
    meta: '按四层结构管理：系统级运行基线 → 模型网关 → Agent 与 MCP → 员工插件与技能市场',
    kpis: [],
    blocks: [],
  },
  data: {
    title: '数据治理',
    meta: '数据源、质量、索引与授权指标尚未接入；当前只展示数据中心真实资源计数',
    kpis: [],
    blocks: [],
  },
  apps: {
    title: '应用与集成',
    meta: '应用审核、版本与接口健康尚未接入；当前只展示应用注册的真实数量',
    kpis: [],
    blocks: [],
  },
  ops: {
    title: '运维监控',
    meta: '服务监控、服务器资源与告警尚未接入；本模块暂不展示演示数据',
    kpis: [],
    blocks: [],
  },
  security: {
    title: '安全与审计',
    meta: '安全策略、敏感访问与审计日志尚未接入；本模块暂不展示演示数据',
    kpis: [],
    blocks: [],
  },
  service: {
    title: '服务与工单',
    meta: '工单与服务级别数据尚未接入管理中心；本模块暂不展示演示数据',
    kpis: [],
    blocks: [],
  },
  settings: {
    title: '系统设置',
    meta: '基础配置写入运行时设置；客户端版本与环境配置只读展示',
    kpis: [],
    blocks: [],
  },
}

export const consoleScopeOptions = ['全部可管理范围', '本单位', '本部门']
