/**
 * Provider Gateway
 * POST /gateway/stream
 * body: { provider, messages, model, systemPrompt }
 * 统一 SSE 输出: { type: 'chunk'|'usage'|'error'|'done', ... }
 */
import * as claude from './providers/claude.js'
import * as codex from './providers/codex.js'

const PROVIDERS = { claudecode: claude, codex }

export function registerGateway(app) {
  app.post('/gateway/stream', async (req, res) => {
    const { provider, messages = [], model, systemPrompt } = req.body
    const adapter = PROVIDERS[provider]

    if (!adapter) {
      res.status(400).json({ message: `Unknown provider: ${provider}` })
      return
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const ac = new AbortController()
    res.on('close', () => ac.abort())

    try {
      for await (const event of adapter.stream({ messages, model, systemPrompt, signal: ac.signal })) {
        if (ac.signal.aborted) break
        res.write(`data: ${JSON.stringify(event)}\n\n`)
        if (event.type === 'done' || event.type === 'error') break
      }
    } catch (err) {
      if (!ac.signal.aborted) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`)
      }
    }

    if (!ac.signal.aborted) res.end()
  })
}
