/**
 * Codex CLI Agent
 * 通过子进程调用本地 `codex` CLI，读取其 stdout 流
 * OAuth 认证由 Codex CLI 自身处理（~/.codex/auth.json）
 *
 * 注意：浏览器环境无法直接调用子进程，需要通过 Vite 开发代理
 * 或 Electron/Tauri 等桌面容器。
 * 开发阶段通过 vite.config.js 的 proxy 将 /codex-api 转发到本地 Express 桥接服务。
 */

const CODEX_BRIDGE_URL = import.meta.env.VITE_CODEX_BRIDGE_URL || 'http://localhost:4891'

export const CODEX_MODELS = {
  codex: 'gpt-5.4',
  o3: 'o3',
}

/**
 * 通过本地桥接服务调用 codex CLI，流式返回输出
 * 桥接服务负责 spawn codex 子进程并将 stdout pipe 为 SSE
 *
 * @param {Array} messages - [{role, content}]
 * @param {string} model
 * @param {function} onChunk
 * @param {function} onDone
 * @param {function} onError
 * @returns {AbortController}
 */
export function streamCodex({ messages, model = CODEX_MODELS.codex, onChunk, onDone, onError }) {
  const controller = new AbortController()

  const run = async () => {
    console.log('[codex] → POST', `${CODEX_BRIDGE_URL}/codex/stream`, { messages, model })
    try {
      const res = await fetch(`${CODEX_BRIDGE_URL}/codex/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, model }),
        signal: controller.signal,
      })

      console.log('[codex] response status:', res.status, res.headers.get('content-type'))

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
        if (done) { console.log('[codex] stream done'); break }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          console.log('[codex] SSE data:', data)
          if (data === '[DONE]') continue
          try {
            const json = JSON.parse(data)
            if (json.text) {
              fullText += json.text
              onChunk?.(json.text)
            }
            if (json.usage) usage = json.usage
            if (json.error) throw new Error(json.error)
          } catch (e) {
            if (e.message && !e.message.startsWith('{')) throw e
          }
        }
      }

      console.log('[codex] done, fullText length:', fullText.length, 'usage:', usage)
      onDone?.(fullText, usage)
    } catch (err) {
      console.error('[codex] error:', err)
      if (err.name !== 'AbortError') onError?.(err)
    }
  }

  run()
  return controller
}
