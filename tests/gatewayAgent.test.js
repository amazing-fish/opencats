import { it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

function importFresh(modulePath) {
  const url = pathToFileURL(path.resolve(modulePath)).href
  return import(`${url}?t=${Date.now()}-${Math.random()}`)
}

async function importGatewayAgentForNode() {
  const sourcePath = path.resolve('./src/agents/gatewayAgent.js')
  const source = await fs.readFile(sourcePath, 'utf8')
  const patched = source.replace(
    "const BRIDGE = import.meta.env.VITE_CODEX_BRIDGE_URL || 'http://localhost:4891'",
    "const BRIDGE = 'http://localhost:4891'"
  )
  return import(`data:text/javascript;base64,${Buffer.from(patched).toString('base64')}`)
}

function makeStreamResponse(chunks) {
  let idx = 0
  return {
    ok: true,
    body: {
      getReader() {
        return {
          async read() {
            if (idx >= chunks.length) return { done: true, value: undefined }
            return { done: false, value: new TextEncoder().encode(chunks[idx++]) }
          },
        }
      },
    },
  }
}

it('does not call onDone when the stream closes without an explicit done event', async () => {
  const fetchCalls = []
  global.fetch = async (url) => {
    fetchCalls.push(String(url))
    if (String(url).endsWith('/token')) {
      return {
        json: async () => ({ token: 'local-token' }),
      }
    }
    return makeStreamResponse([
      'data: {"type":"chunk","text":"hello"}\n\n',
    ])
  }

  const { streamProvider } = await importGatewayAgentForNode()

  const result = await new Promise((resolve) => {
    streamProvider({
      provider: 'claudecode',
      messages: [{ role: 'user', content: 'hello' }],
      model: 'claude-sonnet-4-6',
      onChunk: () => {},
      onDone: (fullText) => resolve({ kind: 'done', fullText }),
      onError: (err) => resolve({ kind: 'error', message: err.message }),
    })
  })

  assert.deepEqual(fetchCalls.length, 2)
  assert.deepEqual(result, {
    kind: 'error',
    message: 'Stream terminated without explicit done event',
  })
})

it('calls onDone when an explicit done event is received', async () => {
  global.fetch = async (url) => {
    if (String(url).endsWith('/token')) {
      return {
        json: async () => ({ token: 'local-token' }),
      }
    }
    return makeStreamResponse([
      'data: {"type":"chunk","text":"hello"}\n\n',
      'data: {"type":"done"}\n\n',
    ])
  }

  const { streamProvider } = await importGatewayAgentForNode()

  const result = await new Promise((resolve) => {
    streamProvider({
      provider: 'claudecode',
      messages: [{ role: 'user', content: 'hello' }],
      model: 'claude-sonnet-4-6',
      onChunk: () => {},
      onDone: (fullText) => resolve({ kind: 'done', fullText }),
      onError: (err) => resolve({ kind: 'error', message: err.message }),
    })
  })

  assert.deepEqual(result, {
    kind: 'done',
    fullText: 'hello',
  })
})
