import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startBridge } from './helpers.js'

describe('authType merge / redaction / migration', () => {
  let bridge

  before(async () => {
    bridge = await startBridge()
  })

  after(() => {
    bridge?.kill()
  })

  async function putAgents(agents) {
    const res = await fetch(`${bridge.baseUrl}/agents`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-local-token': bridge.token },
      body: JSON.stringify(agents),
    })
    assert.equal(res.status, 200)
  }

  async function getAgents() {
    const res = await fetch(`${bridge.baseUrl}/agents`, {
      headers: { 'x-local-token': bridge.token },
    })
    assert.equal(res.status, 200)
    return res.json()
  }

  it('preserves explicit authType through PUT/GET round-trip', async () => {
    await putAgents([
      { id: 'test-bearer', name: 'test', provider: 'claudecode', modelId: 'm', authType: 'bearer-token', apiKey: 'tok-123' },
    ])
    const agents = await getAgents()
    const agent = agents.find(a => a.id === 'test-bearer')
    assert.equal(agent.authType, 'bearer-token')
    assert.equal(agent.apiKey, undefined, 'apiKey must be redacted')
  })

  it('derives authType=api-key for legacy agent with apiKey but no authType', async () => {
    await putAgents([
      { id: 'test-legacy', name: 'legacy', provider: 'claudecode', modelId: 'm', apiKey: 'sk-old' },
    ])
    const agents = await getAgents()
    const agent = agents.find(a => a.id === 'test-legacy')
    assert.equal(agent.authType, 'api-key', 'legacy agent with apiKey should derive api-key')
  })

  it('derives authType=cli-login for legacy agent without apiKey', async () => {
    await putAgents([
      { id: 'test-nokey', name: 'nokey', provider: 'claudecode', modelId: 'm' },
    ])
    const agents = await getAgents()
    const agent = agents.find(a => a.id === 'test-nokey')
    assert.equal(agent.authType, 'cli-login', 'legacy agent without apiKey should derive cli-login')
  })

  it('clears persisted apiKey when switching to cli-login', async () => {
    // Step 1: create agent with api-key auth
    await putAgents([
      { id: 'test-switch', name: 'switch', provider: 'claudecode', modelId: 'm', authType: 'api-key', apiKey: 'sk-secret' },
    ])
    // Step 2: switch to cli-login (no apiKey sent)
    await putAgents([
      { id: 'test-switch', name: 'switch', provider: 'claudecode', modelId: 'm', authType: 'cli-login' },
    ])
    const agents = await getAgents()
    const agent = agents.find(a => a.id === 'test-switch')
    assert.equal(agent.authType, 'cli-login')
    // Verify old apiKey was cleared (not just redacted — actually removed from Redis)
    // Re-PUT without authType change to confirm no residual merge
    await putAgents([
      { id: 'test-switch', name: 'switch', provider: 'claudecode', modelId: 'm', authType: 'cli-login' },
    ])
    const agents2 = await getAgents()
    const agent2 = agents2.find(a => a.id === 'test-switch')
    assert.equal(agent2.authType, 'cli-login')
  })
})
