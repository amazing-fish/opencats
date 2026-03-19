/**
 * Provider Gateway
 * POST /gateway/stream
 * body: { provider, messages, model, systemPrompt, agentId }
 * 统一 SSE 输出: { type: 'chunk'|'usage'|'error'|'done', ... }
 */
import * as claude from './providers/claude.js'
import * as codex from './providers/codex.js'
import { withPolicy } from './policy.js'

const PROVIDERS = { claudecode: claude, codex }

export function registerGateway(app, requireLocalToken, redis, agentsKey) {
  app.post('/gateway/stream', requireLocalToken, async (req, res) => {
    const { provider, messages = [], model, systemPrompt, agentId } = req.body
    const adapter = PROVIDERS[provider]

    if (!adapter) {
      res.status(400).json({ message: `Unknown provider: ${provider}` })
      return
    }

    // 查 agent 配置，取 apiKey/baseUrl（如有）
    let agentConfig = {}
    if (agentId && redis) {
      try {
        const data = await redis.get(agentsKey)
        const agents = data ? JSON.parse(data) : []
        const agent = agents.find(a => a.id === agentId)
        if (agent) agentConfig = { apiKey: agent.apiKey, baseUrl: agent.baseUrl, authType: agent.authType }
      } catch {
        // 查询失败时 fallback 到默认配置
      }
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const ac = new AbortController()
    res.on('close', () => ac.abort())

    try {
      for await (const event of withPolicy(provider, adapter.stream, { messages, model, systemPrompt, signal: ac.signal, ...agentConfig })) {
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
