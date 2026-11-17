import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyTask, routeModel } from '../model.mjs'

test('routeModel keeps Work and ordinary chat on the configured model', () => {
  assert.equal(routeModel({ baseModel: 'deepseek-chat', text: '只读检查项目代码入口', mode: 'work' }).model, 'deepseek-chat')
  assert.equal(routeModel({ baseModel: 'deepseek-chat', text: '解释一下这个函数的作用', mode: 'chat' }).model, 'deepseek-chat')
  assert.equal(routeModel({ baseModel: 'custom-model', text: '你好', mode: 'chat' }).model, 'custom-model')
})

test('routeModel uses the cheap model only when the quality floor allows it', () => {
  const quick = routeModel({ baseModel: 'deepseek-chat', text: '你好呀', mode: 'chat' })
  assert.equal(quick.taskClass, 'quick')
  assert.equal(quick.model, 'deepseek-flash')
  assert.equal(quick.reason, 'quick-cost')

  const retrieval = routeModel({ baseModel: 'deepseek-v4-pro', text: '查一下公告资源', mode: 'chat' })
  assert.equal(retrieval.taskClass, 'retrieval')
  assert.equal(retrieval.model, 'deepseek-chat')
  assert.equal(retrieval.reason, 'retrieval-cost')

  assert.equal(routeModel({ baseModel: 'deepseek-flash', text: '查一下公告资源', mode: 'chat' }).model, 'deepseek-flash')
})

test('routeModel handles image capability and deep think before cost routing', () => {
  const image = routeModel({ baseModel: 'deepseek-chat', text: '看看这张图', images: [{ type: 'image_url' }] })
  assert.equal(image.taskClass, 'vision')
  assert.equal(image.model, 'deepseek-flash')
  assert.equal(image.reason, 'image-capability-fallback')

  // reasoner 不支持图片，即使 base 已支持图片且开了 deepThink，也不能把图片送进 reasoner。
  const imageDeep = routeModel({ baseModel: 'deepseek-flash', text: '看看这张图', images: [{ type: 'image_url' }], deepThink: true })
  assert.equal(imageDeep.model, 'deepseek-flash')
  assert.equal(imageDeep.reason, 'image-capability-fallback')

  const deep = routeModel({ baseModel: 'deepseek-chat', text: '你好', mode: 'chat', deepThink: true })
  assert.equal(deep.model, 'deepseek-reasoner')
  assert.equal(deep.reason, 'deep-think')
})

test('classifyTask separates work, retrieval and quick', () => {
  assert.equal(classifyTask('修复接口并运行测试', { mode: 'work' }), 'work')
  assert.equal(classifyTask('查一下公告资源', { mode: 'chat' }), 'retrieval')
  assert.equal(classifyTask('你好呀', { mode: 'chat' }), 'quick')
})
