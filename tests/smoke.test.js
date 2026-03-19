import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startBridge, streamGateway } from './helpers.js'

describe('built-in agent smoke test', () => {
  let bridge

  before(async () => {
    bridge = await startBridge()
  })

  after(() => {
    bridge?.kill()
  })

  it('Claude agent (claudecode) returns non-empty response to hello', async () => {
    const { chunks, events } = await streamGateway(bridge, {
      provider: 'claudecode',
      message: 'hello',
      model: 'claude-sonnet-4-6',
      agentId: 'claude',
    })

    const doneEvent = events.find(e => e.type === 'done')
    const errorEvent = events.find(e => e.type === 'error')

    assert.ok(!errorEvent, `Expected no error, got: ${errorEvent?.message}`)
    assert.ok(doneEvent, 'Expected a done event')
    assert.ok(chunks.length > 0, 'Expected at least one text chunk')
    assert.ok(chunks.join('').trim().length > 0, 'Expected non-empty response text')
  })

  it('Codex agent (codex) returns non-empty response to hello', async (t) => {
    const { chunks, events } = await streamGateway(bridge, {
      provider: 'codex',
      message: 'hello',
      model: 'gpt-5.4',
      agentId: 'codex',
    })

    const errorEvent = events.find(e => e.type === 'error')

    // codex.exe 是可选依赖，不可用时跳过而非失败
    if (errorEvent?.message?.includes('not found')) {
      t.skip('codex.exe not available')
      return
    }

    const doneEvent = events.find(e => e.type === 'done')

    assert.ok(!errorEvent, `Expected no error, got: ${errorEvent?.message}`)
    assert.ok(doneEvent, 'Expected a done event')
    assert.ok(chunks.length > 0, 'Expected at least one text chunk')
    assert.ok(chunks.join('').trim().length > 0, 'Expected non-empty response text')
  })
})
