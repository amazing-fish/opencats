/**
 * Claude Code Agent
 * 通过 bridge 代理调用 Anthropic API，不在浏览器持有 API Key
 */

const BRIDGE = import.meta.env.VITE_CODEX_BRIDGE_URL || 'http://localhost:4891'

export const CLAUDE_MODELS = {
  opus: 'claude-opus-4-5-20250228',
  sonnet: 'claude-sonnet-4-6',
  haiku: 'claude-haiku-4-5-20251001',
}

/**
 * 发送消息到 Claude（经由 bridge），流式返回
 * @param {Array} messages - [{role, content}]
 * @param {string} model
 * @param {string} systemPrompt
 * @param {function} onChunk - (text) => void
 * @param {function} onDone - (fullText, usage) => void
 * @param {function} onError - (err) => void
 * @returns {AbortController}
 */
export function streamClaudeCode({ messages, model = CLAUDE_MODELS.sonnet, systemPrompt, onChunk, onDone, onError }) {
  const controller = new AbortController()

  const run = async () => {
    try {
      const body = { messages, model }
      if (systemPrompt) body.systemPrompt = systemPrompt

      const res = await fetch(`${BRIDGE}/claude/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }))
        throw new Error(err.message || `HTTP ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''
      let usage = null
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const json = JSON.parse(data)
            if (json.error) throw new Error(json.error)
            if (json.text) {
              fullText += json.text
              onChunk?.(json.text)
            }
            if (json.usage) usage = json.usage
          } catch (e) {
            if (e.message !== 'Unexpected end of JSON input') throw e
          }
        }
      }

      onDone?.(fullText, usage)
    } catch (err) {
      if (err.name !== 'AbortError') onError?.(err)
    }
  }

  run()
  return controller
}
