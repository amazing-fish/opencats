/**
 * Smoke test helpers
 * - startBridge(): spawn bridge/server.js, wait for ready, return { baseUrl, token, kill }
 * - streamGateway(): POST /gateway/stream, parse SSE, return collected events
 */
import { spawn } from 'child_process'

const BRIDGE_PORT = 14891 // 用非默认端口避免与开发环境冲突
const BRIDGE_URL = `http://127.0.0.1:${BRIDGE_PORT}`
const STARTUP_TIMEOUT = 10_000

/**
 * 启动 bridge 子进程，等待 ready 输出
 * @returns {{ baseUrl: string, token: string, kill: () => void }}
 */
export function startBridge() {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['bridge/server.js'], {
      env: { ...process.env, BRIDGE_PORT: String(BRIDGE_PORT) },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error(`Bridge did not start within ${STARTUP_TIMEOUT}ms.\nstdout: ${stdout}`))
    }, STARTUP_TIMEOUT)

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
      if (stdout.includes('listening on')) {
        clearTimeout(timer)
        // 获取 token
        fetch(`${BRIDGE_URL}/token`)
          .then(r => r.json())
          .then(({ token }) => resolve({
            baseUrl: BRIDGE_URL,
            token,
            kill: () => child.kill(),
          }))
          .catch(reject)
      }
    })

    child.stderr.on('data', (chunk) => {
      // stderr 输出到 console 方便调试
      process.stderr.write(`[bridge] ${chunk}`)
    })

    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      if (code !== null && code !== 0) {
        reject(new Error(`Bridge exited with code ${code}.\nstdout: ${stdout}`))
      }
    })
  })
}

/**
 * POST /gateway/stream，收集 SSE 事件直到 done/error 或超时
 * @param {{ baseUrl: string, token: string }} bridge
 * @param {{ provider: string, message: string }} opts
 * @param {number} timeoutMs
 * @returns {Promise<{ chunks: string[], events: object[] }>}
 */
export async function streamGateway(bridge, { provider, message }, timeoutMs = 65_000) {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)

  const res = await fetch(`${bridge.baseUrl}/gateway/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-local-token': bridge.token,
    },
    body: JSON.stringify({
      provider,
      messages: [{ role: 'user', content: message }],
    }),
    signal: ac.signal,
  })

  if (!res.ok) {
    clearTimeout(timer)
    const body = await res.text()
    throw new Error(`Gateway returned ${res.status}: ${body}`)
  }

  const chunks = []
  const events = []
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop()
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const payload = line.slice(6).trim()
        if (!payload) continue
        try {
          const event = JSON.parse(payload)
          events.push(event)
          if (event.type === 'chunk' && event.text) chunks.push(event.text)
          if (event.type === 'done' || event.type === 'error') {
            clearTimeout(timer)
            return { chunks, events }
          }
        } catch { /* 忽略非 JSON */ }
      }
    }
  } finally {
    clearTimeout(timer)
  }

  return { chunks, events }
}
