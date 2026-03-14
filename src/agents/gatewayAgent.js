/**
 * Gateway Agent
 * 前端唯一的 provider 请求入口，通过 bridge /gateway/stream 统一调用
 * 不包含任何 provider-specific 逻辑
 */

const BRIDGE = import.meta.env.VITE_CODEX_BRIDGE_URL || 'http://localhost:4891'

/**
 * @param {string} provider - 'claudecode' | 'codex'
 * @param {Array} messages - [{role, content}]
 * @param {string} model
 * @param {string} systemPrompt
 * @param {function} onChunk - (text) => void
 * @param {function} onDone - (fullText, usage) => void
 * @param {function} onError - (err) => void
 * @returns {AbortController}
 */
export function streamProvider({ provider, messages, model, systemPrompt, onChunk, onDone, onError }) {
  const controller = new AbortController()

  const run = async () => {
    try {
      const body = { provider, messages, model }
      if (systemPrompt) body.systemPrompt = systemPrompt

      const res = await fetch(`${BRIDGE}/gateway/stream`, {
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
          try {
            const json = JSON.parse(data)
            if (json.type === 'chunk') {
              fullText += json.text
              onChunk?.(json.text)
            }
            if (json.type === 'usage') usage = json.usage
            if (json.type === 'error') throw new Error(json.message)
            if (json.type === 'done') break
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
