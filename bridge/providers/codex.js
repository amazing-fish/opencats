/**
 * Codex provider adapter
 * 输入: { messages, model }
 * 输出: async generator，yield { type, ... }
 */
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { EventEmitter } from 'events'

export const id = 'codex'

const CODEX_EXE = process.env.CODEX_EXE_PATH ||
  'C:\\Users\\Administrator\\AppData\\Roaming\\JetBrains\\WebStorm2024.2\\node\\versions\\23.0.0\\node_modules\\@openai\\codex\\node_modules\\@openai\\codex-win32-x64\\vendor\\x86_64-pc-windows-msvc\\codex\\codex.exe'

export function isAvailable() {
  return existsSync(CODEX_EXE)
}

export async function* stream({ messages, model, signal }) {
  if (!isAvailable()) {
    yield { type: 'error', message: `codex.exe not found: ${CODEX_EXE}` }
    return
  }

  const lastUserIdx = messages.findLastIndex(m => m.role === 'user')
  const lastUser = messages[lastUserIdx]
  if (!lastUser) {
    yield { type: 'error', message: '没有用户消息' }
    return
  }

  const historyMessages = messages.slice(0, lastUserIdx)
  const contextPrefix = historyMessages.length > 0
    ? historyMessages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n') + '\n\nUser: '
    : ''
  const prompt = contextPrefix + lastUser.content

  const args = ['exec', '--json', '--skip-git-repo-check', '--ephemeral', '--dangerously-bypass-approvals-and-sandbox']
  if (model) args.push('-m', model)
  args.push(prompt)

  const child = spawn(CODEX_EXE, args)
  signal?.addEventListener('abort', () => { if (!child.killed) child.kill() })

  // async queue via EventEmitter
  const emitter = new EventEmitter()
  const queue = []
  let closed = false

  const push = (event) => {
    queue.push(event)
    emitter.emit('data')
  }

  let buffer = ''
  child.stdout.on('data', (chunk) => {
    buffer += chunk.toString()
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const json = JSON.parse(trimmed)
        if (json.type === 'item.completed' && json.item?.type === 'agent_message') {
          push({ type: 'chunk', text: json.item.text })
        }
        if (json.type === 'turn.completed' && json.usage) {
          push({ type: 'usage', usage: json.usage })
        }
      } catch { /* 忽略非 JSON 行 */ }
    }
  })

  child.stderr.on('data', (chunk) => console.error('[codex stderr]', chunk.toString()))

  child.on('error', (err) => {
    push({ type: 'error', message: err.message })
    closed = true
    emitter.emit('data')
  })

  child.on('close', (code) => {
    if (!signal?.aborted) {
      if (code === 0) {
        push({ type: 'done' })
      } else {
        push({ type: 'error', message: `codex CLI exited with code ${code}` })
      }
    }
    closed = true
    emitter.emit('data')
  })

  while (true) {
    if (queue.length > 0) {
      yield queue.shift()
    } else if (closed) {
      break
    } else {
      await new Promise(resolve => emitter.once('data', resolve))
    }
  }
}
