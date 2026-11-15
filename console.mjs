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
  overview: { no: '01', label: '管理总览', desc: '待办审批、运行概况、风险告警；先处理事项，再看指标' },
  org: { no: '02', label: '组织与权限', desc: '组织架构、人员账号、角色权限、授权审批、账号生命周期' },
  ai: { no: '03', label: 'AI 能力管理', desc: '运行基线、模型网关、Agent 与 MCP、插件与技能市场' },
  data: { no: '04', label: '数据与资源', desc: '资源台账、登记与元数据、版本、授权、数据服务、下载与导出' },
  apps: { no: '05', label: '应用与集成', desc: 'AS 应用、业务应用、应用数据权限、版本与发布、接口连接' },
  ops: { no: '06', label: '运行与运维', desc: '服务健康、AS 进程与租约、DSH 与模型网关、任务调度、备份告警' },
  security: { no: '07', label: '安全与审计', desc: '安全策略、敏感访问、权限复核、操作日志、安全事件（对接深信服）' },
  service: { no: '08', label: '服务与工单', desc: '员工报障、人员变动、权限申请、反馈、问题处理' },
  settings: { no: '09', label: '系统设置', desc: '基础配置、客户端版本与环境配置' },
}

// 管理中心只保留结构定义。除总览、AI 能力与已接入的运行时计数外，
// 未接入真实数据源的模块一律返回空数据，不再下发演示数字或演示表格。
export const consoleSections = {
  overview: {
    title: '管理总览',
    meta: '先处理待办，再看运行概况；计数全部来自当前运行时接口',
    kpis: [],
    blocks: [],
  },
  org: {
    title: '组织与权限',
    meta: '组织主数据为空时显示真实账号目录；职责配置写入运行时并记录审计',
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
    title: '数据与资源',
    meta: '资源台账与数据服务来自数据中心真实接口；无资源时保持空态',
    kpis: [],
    blocks: [],
  },
  apps: {
    title: '应用与集成',
    meta: 'AS 应用、业务应用、能力声明与审核动作来自真实接口',
    kpis: [],
    blocks: [],
  },
  ops: {
    title: '运行与运维',
    meta: '服务健康、AS 进程与租约、任务来自真实接口',
    kpis: [],
    blocks: [],
  },
  security: {
    title: '安全与审计',
    meta: '审批决策、安全异常、审计日志与工具台账来自真实接口',
    kpis: [],
    blocks: [],
  },
  service: {
    title: '服务与工单',
    meta: '工单与反馈来自服务台真实接口；无数据时保持空态',
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
