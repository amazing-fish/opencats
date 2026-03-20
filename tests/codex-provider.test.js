import { afterEach, it } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const originalExe = process.env.CODEX_EXE_PATH

function importFresh(modulePath) {
  const url = pathToFileURL(path.resolve(modulePath)).href
  return import(`${url}?t=${Date.now()}-${Math.random()}`)
}

afterEach(() => {
  if (originalExe === undefined) delete process.env.CODEX_EXE_PATH
  else process.env.CODEX_EXE_PATH = originalExe
})

it('treats non-zero codex process exit as an error instead of success', async () => {
  process.env.CODEX_EXE_PATH = process.execPath

  const { stream } = await importFresh('./bridge/providers/codex.js')
  const events = []

  for await (const event of stream({
    messages: [{ role: 'user', content: 'hello' }],
    model: 'gpt-5.4',
  })) {
    events.push(event)
  }

  assert.deepEqual(events, [
    { type: 'error', message: 'codex CLI exited with code 1' },
  ])
})
