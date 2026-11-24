import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyTask, hasWorkIntent, isDirectAnswerable, needsLiveData, needsWorkspaceContext } from '../model.mjs'

/* 意图判定回归语料：取自真实提问与真实误判，改规则前先跑这一组。
   原则是“动作 + 对象”，名词单独出现不算任务意图。 */

test('名词出现不等于任务意图：数据、资料、分析不能把知识问答判成检索', () => {
  const negatives = [
    '用一句话说明城市体检数据的用途',
    '数据是怎么帮助城市规划的？',
    '城市体检数据包括哪些方面',
    '分析一下城市更新的趋势',
    '资料一般怎么归档',
    '什么是数据治理',
  ]
  for (const text of negatives) {
    assert.equal(hasWorkIntent(text), false, `不应判为工作意图：${text}`)
    assert.notEqual(classifyTask(text, { mode: 'chat' }), 'work', `不应判为 work：${text}`)
    assert.notEqual(classifyTask(text, { mode: 'chat' }), 'retrieval', `不应判为 retrieval：${text}`)
  }
})

test('动作加对象才升级：整理表格、导出报告、跑构建属于工作意图', () => {
  const positives = [
    '整理一下这张表格里的数据',
    '把这份报告导出成 PDF',
    '统计各部门本年度的项目数量',
    '运行 npm run build 看看报错',
    '帮我把这批图片压缩一下',
    '批量处理这些 CSV 文件',
    '做个工作流自动汇总周报',
    '把这个公文格式标准做成 skill',
  ]
  for (const text of positives) {
    assert.equal(hasWorkIntent(text), true, `应判为工作意图：${text}`)
    assert.equal(classifyTask(text, { mode: 'chat' }), 'work', `应判为 work：${text}`)
    assert.equal(isDirectAnswerable(text, { mode: 'chat' }), false, `不应轻量直连：${text}`)
  }
})

test('组织数据查询仍进工作模式，且归类为 retrieval', () => {
  const queries = ['查询米乐联系方式', '查一下公告资源', '列出组织架构', '帮我查一下通讯录里的工号']
  for (const text of queries) {
    assert.equal(hasWorkIntent(text), true, text)
    assert.equal(classifyTask(text, { mode: 'chat' }), 'retrieval', text)
    assert.equal(isDirectAnswerable(text, { mode: 'chat' }), false, text)
  }
})

test('轻量直连只覆盖对话模式的短问答', () => {
  const answerable = ['你好', '什么是城市体检', '为什么城市体检要分年度做？', '用一句话说明城市体检数据的用途', '城市体检和城市更新是什么关系']
  for (const text of answerable) {
    assert.equal(isDirectAnswerable(text, { mode: 'chat' }), true, text)
  }
  assert.equal(isDirectAnswerable('什么是城市体检', { mode: 'work' }), false)
  assert.equal(isDirectAnswerable('什么是城市体检', { mode: 'chat', projectId: 'P-1' }), false)
  assert.equal(isDirectAnswerable('什'.repeat(200), { mode: 'chat' }), false)
})

test('实时数据与工作区上下文问题不走轻量直连', () => {
  const live = ['今天九江天气怎么样', '最新的城市体检政策有哪些', '现在股价多少']
  for (const text of live) {
    assert.equal(needsLiveData(text), true, text)
    assert.equal(isDirectAnswerable(text, { mode: 'chat' }), false, text)
  }
  const workspace = ['九规智能中枢怎么安装插件', 'server.mjs 的静态资源缓存头在哪', '这个接口为什么报错', '代码覆盖率是什么']
  for (const text of workspace) {
    assert.equal(needsWorkspaceContext(text), true, text)
    assert.equal(isDirectAnswerable(text, { mode: 'chat' }), false, text)
  }
})

test('未知命令式短句默认进工作模式，不因没命中关键词掉进只读对话', () => {
  const unseenTasks = [
    '帮我把这个流程跑一遍',
    '帮我创建一份新的客户档案',
    '把这份材料润色一下',
  ]
  for (const text of unseenTasks) {
    assert.equal(isDirectAnswerable(text, { mode: 'chat' }), false, `不应轻量直答：${text}`)
    assert.equal(classifyTask(text, { mode: 'chat' }), 'work', `应默认进 work：${text}`)
  }
})

test('明确的知识问答仍走轻量直连，不被默认工作模式抬高成本', () => {
  const direct = [
    '城市体检的意义',
    '用一句话说明城市体检数据的用途',
    '分析一下城市更新的趋势',
  ]
  for (const text of direct) {
    assert.equal(isDirectAnswerable(text, { mode: 'chat' }), true, text)
    assert.notEqual(classifyTask(text, { mode: 'chat' }), 'work', text)
  }
})

test('短句且无问号归为 quick，长问答归为 chat', () => {
  assert.equal(classifyTask('你好呀', { mode: 'chat' }), 'quick')
  assert.equal(classifyTask('城市体检的意义', { mode: 'chat' }), 'quick')
  assert.equal(classifyTask('为什么城市体检要分年度做？', { mode: 'chat' }), 'chat')
})
