import { it } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

function importFresh(modulePath) {
  const url = pathToFileURL(path.resolve(modulePath)).href
  return import(`${url}?t=${Date.now()}-${Math.random()}`)
}

it('does not emit a timeout error solely because total stream lifetime exceeds the old gateway wall-clock limit', async () => {
  const prevTimeout = process.env.GATEWAY_TIMEOUT_MS
  process.env.GATEWAY_TIMEOUT_MS = '50'

  try {
    const { withPolicy } = await importFresh('./bridge/policy.js')
    const events = []

    async function* slowButHealthyStream() {
      yield { type: 'chunk', text: 'partial' }
      await new Promise(resolve => setTimeout(resolve, 100))
      yield { type: 'done' }
    }

    for await (const event of withPolicy('demo', slowButHealthyStream, { model: 'demo-model' })) {
      events.push(event)
    }

    assert.deepEqual(events, [
      { type: 'chunk', text: 'partial' },
      { type: 'done' },
    ])
  } finally {
    if (prevTimeout === undefined) delete process.env.GATEWAY_TIMEOUT_MS
    else process.env.GATEWAY_TIMEOUT_MS = prevTimeout
  }
})

it('emits an explicit error when a provider stream closes without a done event', async () => {
  const { withPolicy } = await importFresh('./bridge/policy.js')
  const events = []

  async function* truncatedStream() {
    yield { type: 'chunk', text: 'partial' }
  }

  for await (const event of withPolicy('demo', truncatedStream, { model: 'demo-model' })) {
    events.push(event)
  }

  assert.deepEqual(events, [
    { type: 'chunk', text: 'partial' },
    { type: 'error', message: 'Stream terminated without explicit done event' },
  ])
})
