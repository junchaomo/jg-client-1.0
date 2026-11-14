/**
 * 九规智能中枢本地 MCP 桥
 * 由 dsh-mcp-client 以 stdio 子进程启动，把产品现有 /api/ai/invoke 工具
 * 暴露为 mcp__jg__* 工具。只监听本机，使用进程内随机令牌，不暴露到外网。
 */
import { createInterface } from 'node:readline'
import { stdin, stdout, stderr } from 'node:process'
import { appendFileSync } from 'node:fs'

const debug = process.env.JG_MCP_DEBUG ? (line) => appendFileSync(process.env.JG_MCP_DEBUG, `${new Date().toISOString()} ${line}\n`) : () => {}

const baseUrl = (process.env.JG_MCP_URL || 'http://127.0.0.1:4173').replace(/\/$/, '')
const endpoint = `${baseUrl}/api/ai/invoke`
const token = process.env.JG_MCP_TOKEN || ''
const account = process.env.JG_MCP_ACCOUNT || 'A-7788-01'
const conversation = process.env.JG_MCP_CONVERSATION || ''

const tools = [
  {
    name: 'drive_search',
    description: '搜索企业云空间文件与目录，返回名称、类型、部门、所有者。',
    inputSchema: { type: 'object', properties: { q: { type: 'string', description: '关键词' }, type: { type: 'string', description: '文件类型' } } },
  },
  {
    name: 'drive_read',
    description: '读取云空间一个文件/数据集的元数据或正文。',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: '文件 ID' } }, required: ['id'] },
  },
  {
    name: 'notice_list',
    description: '检索通知公告。',
    inputSchema: { type: 'object', properties: { q: { type: 'string', description: '关键词' } } },
  },
  {
    name: 'academy_search',
    description: '检索教学园地课程与资料。',
    inputSchema: { type: 'object', properties: { q: { type: 'string', description: '关键词' } } },
  },
  {
    name: 'contacts_find',
    description: '按姓名、职责、部门检索通讯录。',
    inputSchema: { type: 'object', properties: { q: { type: 'string', description: '关键词' } } },
  },
  {
    name: 'im_send',
    description: '向指定即时通讯会话发送一条消息。',
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, text: { type: 'string' } }, required: ['id', 'text'] },
  },
  {
    name: 'notice_read',
    description: '读取一条通知公告正文。',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'notebook_search',
    description: '在智能笔记本范围检索引用资源。',
    inputSchema: { type: 'object', properties: { q: { type: 'string' }, notebook: { type: 'string' } } },
  },
  {
    name: 'resource_query',
    description: '查询数据中心资源目录。',
    inputSchema: { type: 'object', properties: { q: { type: 'string' } } },
  },
  {
    name: 'format_capabilities',
    description: '列出平台格式基座支持的 PDF、GIS/GeoJSON、CAD/DXF 读写能力与边界。',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'format_inspect',
    description: '解析平台文件中的 PDF、GeoJSON 或 ASCII DXF，返回页数、要素、图层、范围等元数据。',
    inputSchema: { type: 'object', properties: { fileId: { type: 'string', description: '平台文件 ID' }, name: { type: 'string', description: '原始文件名，用于识别格式' }, mime: { type: 'string' } }, required: ['fileId'] },
  },
  {
    name: 'format_extract',
    description: '读取 PDF 文本，或返回 GIS/CAD 的要素、图层与范围摘要。',
    inputSchema: { type: 'object', properties: { fileId: { type: 'string', description: '平台文件 ID' }, name: { type: 'string' }, mime: { type: 'string' } }, required: ['fileId'] },
  },
  {
    name: 'format_export',
    description: '输出平台数据格式：PDF 合并/拆分、GeoJSON 规范化、ASCII DXF 回写。',
    inputSchema: {
      type: 'object',
      properties: {
        format: { type: 'string', enum: ['pdf', 'gis', 'cad'] },
        op: { type: 'string', enum: ['merge', 'split', 'normalize'] },
        fileId: { type: 'string' },
        fileIds: { type: 'array', items: { type: 'string' } },
        ranges: { type: 'string' },
        name: { type: 'string' },
      },
      required: ['format', 'op'],
    },
  },
  {
    name: 'code_review',
    description: 'Harness 通用基础服务：审查一个项目的源码目录，返回语法、JSON 与静态规则命中。',
    inputSchema: { type: 'object', properties: { projectId: { type: 'string' }, scope: { type: 'string', enum: ['all', 'changed'] }, maxFiles: { type: 'number' } }, required: ['projectId'] },
  },
  {
    name: 'visual_create',
    description: 'Visual Engine：在聊天中创建可视化对象并返回对象 id/版本。用户要求流程图、架构图、统计图、信息图、可调参数的交互计算器时优先调用。type=mermaid 时 source 填 Mermaid；type=echarts 时 config 填声明式 ECharts option（不要函数）；type=svg 时 source 填完整 SVG；type=interactive 时 config 填 {kind:"loan-calculator", fields:[{key:"principal"},{key:"rate"},{key:"years"}]}。调用后不要重复把源码贴进回答。',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['mermaid', 'echarts', 'svg', 'interactive'], description: '渲染类型：流程/关系用 mermaid，统计图表用 echarts，自定义信息图用 svg，滑块/实时计算的交互组件用 interactive' },
        title: { type: 'string', description: '图形标题，中文，简短' },
        source: { type: 'string', description: 'mermaid、svg 或 interactive 的源码/JSON 字符串；echarts 也可传 JSON 字符串' },
        config: { type: 'object', description: 'echarts 的声明式 option 对象；interactive 的 {kind:"loan-calculator",fields:[...]} 配置；禁止函数、外部 URL 和 custom/renderItem' },
        caption: { type: 'string', description: '可选的一句说明' },
        sessionId: { type: 'string', description: '当前会话 ID；通常由运行时自动补齐，模型可不填' },
      },
      required: ['type', 'title'],
    },
  },
  {
    name: 'visual_update',
    description: 'Visual Engine：更新已有可视化对象并生成新版本。用户说“把刚才的图改成…/增加…/调整颜色”时，先用 visual_get 或根据会话上下文定位 id，再调用本工具；不要重新创建无关图形。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '可视化对象 id，例如 VIS-...' },
        type: { type: 'string', enum: ['mermaid', 'echarts', 'svg', 'interactive'] },
        title: { type: 'string' },
        source: { type: 'string' },
        config: { type: 'object', description: 'echarts 的新 option；只需传新配置' },
        caption: { type: 'string' },
        changeNote: { type: 'string', description: '本次修改说明，会写入版本记录' },
      },
      required: ['id'],
    },
  },
  {
    name: 'visual_get',
    description: 'Visual Engine：读取一个可视化对象的类型、标题、源码、版本与状态，用于连续修改或查看。',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'visual_export',
    description: 'Visual Engine：登记并返回可视化导出信息；实际 SVG/PNG 导出在聊天卡片或放大窗口中完成。',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, format: { type: 'string', enum: ['svg', 'png'] } },
      required: ['id'],
    },
  },
  {
    name: 'visual_save',
    description: 'Visual Engine：把会话内可视化保存为长期成果，可自定义名称；保存后仍可继续修改并查看版本历史。',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, name: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'task_create',
    description: '创建一个待办任务（当前为产品任务接口登记）。',
    inputSchema: { type: 'object', properties: { title: { type: 'string' } } },
  },
]

function reply(id, result) {
  stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n')
}

function fail(id, code, message) {
  stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n')
}

const EXTERNAL_WRITE_TOOLS = new Set(['im_send', 'task_create'])

async function requestApproval(name, args) {
  const res = await fetch(`${baseUrl}/api/mcp/approval`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-jg-mcp-token': token,
      'x-jg-mcp-account': account,
      ...(conversation ? { 'x-jg-conversation': conversation } : {}),
    },
    body: JSON.stringify({ tool: name, args: args || {} }),
    signal: AbortSignal.timeout(9 * 60 * 1000),
  })
  const data = await res.json().catch(() => ({}))
  debug(`approval ${name} -> HTTP ${res.status} ${JSON.stringify(data).slice(0, 200)}`)
  if (!res.ok) throw new Error(data.error || `审批未通过（HTTP ${res.status}）`)
}

async function callTool(name, args) {
  if (!token) throw new Error('MCP token missing')
  if (EXTERNAL_WRITE_TOOLS.has(name)) await requestApproval(name, args)
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-jg-mcp-token': token,
      'x-jg-mcp-account': account,
      ...(conversation ? { 'x-jg-conversation': conversation } : {}),
    },
    body: JSON.stringify({ tool: name, args: args || {} }),
  })
  const data = await res.json().catch(() => ({}))
  debug(`call ${name} -> HTTP ${res.status} ${JSON.stringify(data).slice(0, 200)}`)
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

async function getResource(path) {
  if (!token) throw new Error('MCP token missing')
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { 'x-jg-mcp-token': token, 'x-jg-mcp-account': account },
  })
  const data = await res.json().catch(() => ({}))
  debug(`resource ${path} -> HTTP ${res.status}`)
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

const rl = createInterface({ input: stdin, crlfDelay: Infinity })
rl.on('line', async (line) => {
  let msg
  try { msg = JSON.parse(line) } catch { return }
  if (!msg || msg.jsonrpc !== '2.0') return
  const id = msg.id
  if (id === undefined || id === null) return
  try {
    if (msg.method === 'initialize') {
      reply(id, {
        protocolVersion: msg.params?.protocolVersion || '2025-06-18',
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: 'jg-product-tools', version: '1.0.0' },
      })
      return
    }
    if (msg.method === 'ping') { reply(id, {}); return }
    if (msg.method === 'resources/list') {
      const data = await getResource('/api/mcp/resources')
      reply(id, {
        resources: (data.items || []).map((r) => ({
          uri: r.uri,
          name: r.name,
          description: r.description,
          mimeType: r.mimeType || 'application/json',
        })),
      })
      return
    }
    if (msg.method === 'resources/templates/list') {
      reply(id, {
        resourceTemplates: [
          { uriTemplate: 'jg://resource/{id}', name: '数据中心资源', description: '按资源 ID 读取元数据', mimeType: 'application/json' },
          { uriTemplate: 'jg://notice/{id}', name: '通知公告', description: '按公告 ID 读取正文', mimeType: 'application/json' },
        ],
      })
      return
    }
    if (msg.method === 'resources/read') {
      const uri = String(msg.params?.uri || '')
      if (!/^jg:\/\/[a-z]+[\/]/.test(uri)) return fail(id, -32602, `unsupported resource uri: ${uri}`)
      const data = await getResource(`/api/mcp/resource?uri=${encodeURIComponent(uri)}`)
      reply(id, { contents: [{ uri, mimeType: data.mimeType || 'application/json', text: data.text || '' }] })
      return
    }
    if (msg.method === 'tools/list') {
      reply(id, { tools })
      return
    }
    if (msg.method === 'tools/call') {
      const rawName = String(msg.params?.name || '')
      const name = rawName.replace(/^mcp__jg__/, '')
      if (!tools.some((t) => t.name === name)) return fail(id, -32602, `unknown tool: ${rawName}`)
      const data = await callTool(name, msg.params?.arguments)
      reply(id, {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        isError: data?.ok === false,
      })
      return
    }
    fail(id, -32601, `method not found: ${msg.method}`)
  } catch (error) {
    fail(id, -32603, String(error?.message || error))
  }
})

stderr.write(`[jg-mcp] ready endpoint=${endpoint} account=${account}\n`)
