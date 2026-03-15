import express from 'express'
import cors from 'cors'
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { randomBytes } from 'crypto'
import Redis from 'ioredis'
import Anthropic from '@anthropic-ai/sdk'
import { registerGateway } from './gateway.js'

// 启动时生成一次性本地 token，仅限 localhost 客户端获取
const LOCAL_TOKEN = randomBytes(32).toString('hex')

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
]

const app = express()
app.use(cors({
  origin: (origin, cb) => {
    // 允许无 origin（curl/本地直连）或白名单内的 localhost origin
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
    cb(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true,
}))
app.use(express.json())

// GET /token — 返回本地 token（bridge 已绑定 127.0.0.1，物理上只有 loopback 可达）
app.get('/token', (req, res) => {
  res.json({ token: LOCAL_TOKEN })
})

// provider 路由鉴权中间件
function requireLocalToken(req, res, next) {
  const token = req.headers['x-local-token']
  if (token !== LOCAL_TOKEN) {
    res.status(401).json({ message: 'Unauthorized: missing or invalid x-local-token' })
    return
  }
  next()
}

const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379')
const CONV_KEY = 'cat-cafe:conversations'
const AGENTS_KEY = 'cat-cafe:agents'

// GET /conversations — 读取所有会话
app.get('/conversations', requireLocalToken, async (req, res) => {
  try {
    const data = await redis.get(CONV_KEY)
    res.json(data ? JSON.parse(data) : [])
  } catch (err) {
    console.error('[redis] get error:', err.message)
    res.json([])
  }
})

// PUT /conversations — 覆盖保存所有会话
app.put('/conversations', requireLocalToken, async (req, res) => {
  try {
    await redis.set(CONV_KEY, JSON.stringify(req.body))
    res.json({ ok: true })
  } catch (err) {
    console.error('[redis] set error:', err.message)
    res.status(500).json({ message: err.message })
  }
})

// GET /agents — 读取自定义 agents（过滤敏感字段）
app.get('/agents', requireLocalToken, async (req, res) => {
  try {
    const data = await redis.get(AGENTS_KEY)
    const agents = data ? JSON.parse(data) : []
    const safe = agents.map(({ apiKey, baseUrl, ...rest }) => rest)
    res.json(safe)
  } catch (err) {
    console.error('[redis] get agents error:', err.message)
    res.json([])
  }
})

// PUT /agents — 保存自定义 agents（保留 apiKey/baseUrl 在 Redis，不回传前端）
app.put('/agents', requireLocalToken, async (req, res) => {
  try {
    const agents = Array.isArray(req.body) ? req.body : []
    await redis.set(AGENTS_KEY, JSON.stringify(agents))
    res.json({ ok: true })
  } catch (err) {
    console.error('[redis] set agents error:', err.message)
    res.status(500).json({ message: err.message })
  }
})

// POST /claude/stream — 旧路由保留向后兼容，已加 token 鉴权
app.post('/claude/stream', requireLocalToken, async (req, res) => {
  const { messages = [], model, systemPrompt } = req.body
  const apiKey = process.env.CLAUDE_API_KEY
  if (!apiKey) {
    res.status(500).json({ message: 'CLAUDE_API_KEY not set in bridge environment' })
    return
  }

  const client = new Anthropic({ apiKey })

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const params = { model: model || 'claude-sonnet-4-6', max_tokens: 8096, messages }
  if (systemPrompt) params.system = systemPrompt

  let aborted = false
  const stream = client.messages.stream(params)

  res.on('close', () => {
    aborted = true
    stream.abort()
  })

  try {
    for await (const event of stream) {
      if (aborted) break
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
      }
      if (event.type === 'message_delta' && event.usage) {
        res.write(`data: ${JSON.stringify({ usage: event.usage })}\n\n`)
      }
    }
    if (!aborted) {
      res.write('data: [DONE]\n\n')
      res.end()
    }
  } catch (err) {
    if (!aborted) {
      console.error('[bridge] claude stream error:', err.message)
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
      res.end()
    }
  }
})

// codex.exe 绝对路径（通过 npm -g 安装的 @openai/codex）
const CODEX_EXE = process.env.CODEX_EXE_PATH ||
  'C:\\Users\\Administrator\\AppData\\Roaming\\JetBrains\\WebStorm2024.2\\node\\versions\\23.0.0\\node_modules\\@openai\\codex\\node_modules\\@openai\\codex-win32-x64\\vendor\\x86_64-pc-windows-msvc\\codex\\codex.exe'

// POST /codex/stream — 旧路由保留向后兼容，已加 token 鉴权
app.post('/codex/stream', requireLocalToken, (req, res) => {
  const { messages = [], model } = req.body

  if (!existsSync(CODEX_EXE)) {
    res.status(500).json({ message: `codex.exe not found: ${CODEX_EXE}` })
    return
  }

  // 取最后一条用户消息作为主 prompt
  const lastUser = [...messages].reverse().find(m => m.role === 'user')
  if (!lastUser) {
    res.status(400).json({ message: '没有用户消息' })
    return
  }

  // 将历史消息拼接为上下文前缀（最后一条用户消息之前的内容）
  const lastUserIdx = messages.findLastIndex(m => m.role === 'user')
  const historyMessages = messages.slice(0, lastUserIdx)
  const contextPrefix = historyMessages.length > 0
    ? historyMessages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n') + '\n\nUser: '
    : ''
  const prompt = contextPrefix + lastUser.content

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const args = [
    'exec',
    '--json',
    '--skip-git-repo-check',
    '--ephemeral',
    '--dangerously-bypass-approvals-and-sandbox',
  ]
  if (model) args.push('-m', model)
  args.push(prompt)

  console.log('[bridge] spawn:', CODEX_EXE, args)
  const child = spawn(CODEX_EXE, args)
  let buffer = ''

  child.stdout.on('data', (chunk) => {
    buffer += chunk.toString()
    const lines = buffer.split('\n')
    buffer = lines.pop()

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      console.log('[bridge] stdout line:', trimmed.slice(0, 120))
      try {
        const json = JSON.parse(trimmed)

        // agent 回复文本
        if (json.type === 'item.completed' && json.item?.type === 'agent_message') {
          res.write(`data: ${JSON.stringify({ text: json.item.text })}\n\n`)
        }

        // usage 信息
        if (json.type === 'turn.completed' && json.usage) {
          res.write(`data: ${JSON.stringify({ usage: json.usage })}\n\n`)
        }
      } catch {
        // 忽略非 JSON 行
      }
    }
  })

  child.stderr.on('data', (chunk) => {
    console.error('[codex stderr]', chunk.toString())
  })

  child.on('close', (code) => {
    console.log(`[bridge] codex exited code=${code}`)
    res.write('data: [DONE]\n\n')
    res.end()
  })

  child.on('error', (err) => {
    console.error('[bridge] spawn error:', err.message)
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
    res.end()
  })

  // 客户端主动断开时才 kill
  res.on('close', () => {
    if (!child.killed) child.kill()
  })
})

registerGateway(app, requireLocalToken, redis, AGENTS_KEY)

// 同时绑定 IPv4 和 IPv6 loopback，避免 localhost 在 IPv6-first 环境解析到 ::1 时连接失败
const PORT = 4891
app.listen(PORT, '127.0.0.1', () => {
  console.log(`[bridge] listening on http://127.0.0.1:${PORT}`)
})
app.listen(PORT, '::1', () => {
  console.log(`[bridge] listening on http://[::1]:${PORT}`)
}).on('error', (err) => {
  // IPv6 不可用时静默忽略（部分 Windows 环境禁用 IPv6）
  if (err.code !== 'EADDRNOTAVAIL') console.error('[bridge] IPv6 listen error:', err.message)
})
