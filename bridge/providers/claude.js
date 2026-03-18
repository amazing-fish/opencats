/**
 * Claude Code CLI provider adapter
 * 输入: { messages, model, systemPrompt, signal, apiKey?, baseUrl? }
 * 输出: async generator，yield { type, ... }
 *
 * CLI flags: claude --print --output-format stream-json --verbose
 * per-agent auth via ANTHROPIC_API_KEY / ANTHROPIC_BASE_URL env vars
 */
import { spawn } from 'child_process'
import { EventEmitter } from 'events'

export const id = 'claudecode'

const CLAUDE_EXE = process.env.CLAUDE_EXE_PATH || 'claude'

export function isAvailable() {
  return true // claude CLI assumed on PATH; spawn error handled at runtime
}

export async function* stream({ messages, model, systemPrompt, signal, apiKey, baseUrl }) {
  const lastUserIdx = messages.findLastIndex(m => m.role === 'user')
  const lastUser = messages[lastUserIdx]
  if (!lastUser) {
    yield { type: 'error', message: '没有用户消息' }
    return
  }

  // 历史拼接（同 codex.js 模式）
  const history = messages.slice(0, lastUserIdx)
  const prefix = history.length
    ? history.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${
        Array.isArray(m.content)
          ? m.content.filter(b => b.type === 'text').map(b => b.text).join('')
          : m.content
      }`).join('\n') + '\n\nUser: '
    : ''
  const prompt = prefix + (
    Array.isArray(lastUser.content)
      ? lastUser.content.filter(b => b.type === 'text').map(b => b.text).join('')
      : lastUser.content
  )

  const args = ['--print', '--output-format', 'stream-json', '--verbose']
  if (model) args.push('--model', model)
  if (systemPrompt) args.push('--system-prompt', systemPrompt)
  args.push(prompt)

  // per-agent 环境变量注入
  const env = { ...process.env }
  if (apiKey)  env.ANTHROPIC_API_KEY  = apiKey
  if (baseUrl) env.ANTHROPIC_BASE_URL = baseUrl

  const child = spawn(CLAUDE_EXE, args, { env })
  signal?.addEventListener('abort', () => { if (!child.killed) child.kill() })

  const emitter = new EventEmitter()
  const queue = []
  let closed = false
  let terminated = false

  const push = (event) => { queue.push(event); emitter.emit('data') }

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

        // text chunks from assistant turns
        if (json.type === 'assistant' && json.message?.content) {
          for (const block of json.message.content) {
            if (block.type === 'text' && block.text) {
              push({ type: 'chunk', text: block.text })
            }
            // tool_use blocks: ignored, CLI handles execution internally
          }
        }

        // terminal event
        if (json.type === 'result') {
          terminated = true
          if (json.is_error) {
            push({ type: 'error', message: json.result })
          } else {
            if (json.usage) push({ type: 'usage', usage: json.usage })
            push({ type: 'done' })
          }
        }

        // type: "user" (tool_result feedback) and type: "system": ignored
      } catch { /* 忽略非 JSON 行 */ }
    }
  })

  child.stderr.on('data', (chunk) => console.error('[claude stderr]', chunk.toString()))

  child.on('error', (err) => {
    push({ type: 'error', message: err.message })
    closed = true
    emitter.emit('data')
  })

  child.on('close', () => {
    if (!signal?.aborted && !terminated) push({ type: 'done' })
    closed = true
    emitter.emit('data')
  })

  while (true) {
    if (queue.length > 0) yield queue.shift()
    else if (closed) break
    else await new Promise(r => emitter.once('data', r))
  }
}
