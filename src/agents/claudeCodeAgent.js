/**
 * Claude Code Agent
 * 通过 SSE/流读取本地 Claude Code 的输出
 * 需要环境变量: VITE_CLAUDE_API_KEY, VITE_CLAUDE_BASE_URL
 */

const BASE_URL = import.meta.env.VITE_CLAUDE_BASE_URL || 'https://api.anthropic.com'
const API_KEY = import.meta.env.VITE_CLAUDE_API_KEY || ''

export const CLAUDE_MODELS = {
  opus: 'claude-opus-4-5-20250228',
  sonnet: 'claude-sonnet-4-6',
  haiku: 'claude-haiku-4-5-20251001',
}

/**
 * 发送消息到 Claude Code，流式返回
 * @param {Array} messages - [{role, content}]
 * @param {string} model
 * @param {function} onChunk - 每个 chunk 回调 (text) => void
 * @param {function} onDone - 完成回调 (fullText, usage) => void
 * @param {function} onError - 错误回调 (err) => void
 * @returns {AbortController} 可用于取消请求
 */
export function streamClaudeCode({ messages, model = CLAUDE_MODELS.sonnet, apiKey, baseUrl, systemPrompt, onChunk, onDone, onError }) {
  const controller = new AbortController()
  const resolvedKey = apiKey || API_KEY
  const resolvedBase = (baseUrl || BASE_URL).replace(/\/$/, '')

  const run = async () => {
    try {
      const body = { model, max_tokens: 8096, stream: true, messages }
      if (systemPrompt) body.system = systemPrompt

      const res = await fetch(`${resolvedBase}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': resolvedKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
        throw new Error(err.error?.message || `HTTP ${res.status}`)
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
        buffer = lines.pop() // 保留不完整的行

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const json = JSON.parse(data)
            if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
              fullText += json.delta.text
              onChunk?.(json.delta.text)
            }
            if (json.type === 'message_delta' && json.usage) {
              usage = json.usage
            }
          } catch {
            // 忽略解析错误
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
