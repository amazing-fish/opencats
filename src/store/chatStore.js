import { useState, useCallback, useRef, useEffect } from 'react'
import { streamProvider, fetchWithToken } from '../agents/gatewayAgent'

const newId = () => crypto.randomUUID()
const newConvId = () => crypto.randomUUID()

function makeConversation(agents) {
  return {
    id: newConvId(),
    label: '新对话',
    agents,
    messages: [],
    sessions: agents.map(agent => ({
      agent,
      status: 'IDLE',
      tokensIn: 0,
      tokensOut: 0,
    })),
    createdAt: Date.now(),
  }
}

function mergeHistory(messages) {
  const merged = []
  for (const m of messages) {
    const last = merged[merged.length - 1]
    if (last?.role === 'assistant' && m.role === 'assistant') {
      last.content += '\n\n' + m.content
    } else {
      merged.push({ role: m.role, content: m.content })
    }
  }
  return merged
}

function parseMentions(text, agents = []) {
  return agents
    .filter(a => text.includes(`@${a.name}`))
    .map(a => a.id)
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function stripMentions(text, agents = []) {
  return agents.reduce((t, a) => t.replace(new RegExp(`@${escapeRegExp(a.name)}(?=[^a-zA-Z0-9\\u4e00-\\u9fa5_]|$)`, 'g'), ''), text).trim()
}

function buildMeta(modelLabel, usage) {
  if (!usage) return modelLabel || ''
  return `${modelLabel || ''} · ${usage.input_tokens || 0}↑ ${usage.output_tokens || 0}↓`
}

export function useChatStore(agents = []) {
  // 用 ref 存 agents/agentMap，避免 useCallback 依赖数组变化导致无限重渲染
  const agentsRef = useRef(agents)
  const agentMapRef = useRef({})
  agentsRef.current = agents
  agentMapRef.current = agents.reduce((acc, a) => { acc[a.id] = a; return acc }, {})

  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState(null)
  // 用 ref 同步 activeId，避免 sendMessage 闭包读到旧值
  const activeIdRef = useRef(null)

  const setActiveIdSynced = useCallback((id) => {
    const val = typeof id === 'function' ? id(activeIdRef.current) : id
    activeIdRef.current = val
    setActiveId(val)
  }, [])

  const activeConv = conversations.find(c => c.id === activeId) || null
  const messages = activeConv?.messages || []
  const sessions = activeConv?.sessions || []

  const BRIDGE = import.meta.env.VITE_CODEX_BRIDGE_URL || 'http://localhost:4891'

  const isLoaded = useRef(false)
  useEffect(() => {
    fetchWithToken(`${BRIDGE}/conversations`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setConversations(data)
          setActiveIdSynced(data[0].id)
        }
      })
      .catch(err => console.warn('[store] load conversations failed:', err.message))
      .finally(() => { isLoaded.current = true })
  }, [])

  const saveTimerRef = useRef(null)
  useEffect(() => {
    if (!isLoaded.current) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      fetchWithToken(`${BRIDGE}/conversations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conversations),
      }).catch(err => console.warn('[store] save conversations failed:', err.message))
    }, 600)
  }, [conversations])

  const createConversation = useCallback((agentIds) => {
    const conv = makeConversation(agentIds)
    setConversations(prev => [conv, ...prev])
    setActiveIdSynced(conv.id)
    return conv
  }, [setActiveIdSynced])

  const switchConversation = useCallback((convId) => {
    setActiveIdSynced(convId)
  }, [setActiveIdSynced])

  const setSessionStatus = useCallback((convId, agent, status, usage) => {
    setConversations(prev => prev.map(c => {
      if (c.id !== convId) return c
      return {
        ...c,
        sessions: c.sessions.map(s =>
          s.agent === agent
            ? {
                ...s,
                status,
                ...(usage ? {
                  tokensIn: (s.tokensIn || 0) + (usage.input_tokens || 0),
                  tokensOut: (s.tokensOut || 0) + (usage.output_tokens || 0),
                } : {}),
              }
            : s
        ),
      }
    }))
  }, [])

  const triggerMentioned = useCallback((convId, mentionedAgents) => {
    const agentMsgs = mentionedAgents.map(agentId => {
      const cfg = agentMapRef.current[agentId] || {}
      return {
        id: newId(),
        role: 'assistant',
        agentType: agentId,
        name: cfg.name || agentId,
        avatarColor: cfg.avatarColor || 'bg-gray-400',
        bgColor: cfg.bgColor || 'bg-gray-50',
        content: '',
        streaming: true,
        time: new Date().toLocaleTimeString('zh', { hour: '2-digit', minute: '2-digit' }),
        meta: cfg.modelId || '',
      }
    })

    let history = []
    setConversations(prev => {
      const conv = prev.find(c => c.id === convId)
      if (!conv) return prev
      const existingAgents = new Set(conv.agents)
      const newAgents = mentionedAgents.filter(a => !existingAgents.has(a))
      history = mergeHistory(conv.messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-10)
        .map(m => ({ role: m.role, content: m.role === 'assistant' && m.name ? stripMentions(`[${m.name}]: ${m.content}`, agentsRef.current) : stripMentions(m.content, agentsRef.current) })))
      return prev.map(c => c.id !== convId ? c : {
        ...c,
        agents: [...c.agents, ...newAgents],
        sessions: [...c.sessions, ...newAgents.map(agent => ({ agent, status: 'IDLE', tokensIn: 0, tokensOut: 0 }))],
        messages: [...c.messages, ...agentMsgs],
      })
    })

    setTimeout(() => {
      agentMsgs.forEach((agentMsg) => {
        const agentId = agentMsg.agentType
        const cfg = agentMapRef.current[agentId] || {}
        const msgId = agentMsg.id
        setSessionStatus(convId, agentId, 'ACTIVE')
        const handlers = {
          onChunk: (chunk) => {
            setConversations(prev => prev.map(c => c.id !== convId ? c : {
              ...c,
              messages: c.messages.map(m => m.id === msgId ? { ...m, content: m.content + chunk } : m),
            }))
          },
          onDone: (fullText, usage) => {
            setConversations(prev => prev.map(c => c.id !== convId ? c : {
              ...c,
              messages: c.messages.map(m =>
                m.id === msgId ? { ...m, content: fullText, streaming: false, meta: buildMeta(cfg.modelId, usage) } : m
              ),
            }))
            setSessionStatus(convId, agentId, 'IDLE', usage)
            const mentioned = parseMentions(fullText, agentsRef.current).filter(t => t !== agentId)
            if (mentioned.length > 0) setTimeout(() => triggerMentioned(convId, mentioned), 0)
          },
          onError: (err) => {
            setConversations(prev => prev.map(c => c.id !== convId ? c : {
              ...c,
              messages: c.messages.map(m =>
                m.id === msgId ? { ...m, content: `[错误] ${err.message}`, streaming: false } : m
              ),
            }))
            setSessionStatus(convId, agentId, 'ERROR')
          },
        }
        const ctrl = streamProvider({ provider: cfg.provider, messages: history, model: cfg.modelId, systemPrompt: cfg.systemPrompt, agentId: agentId, ...handlers })
        abortRefs.current[msgId] = ctrl
      })
    }, 0)
  }, [setSessionStatus])

  const abortRefs = useRef({})

  const sendMessage = useCallback((userText, activeAgents) => {
    const userMsg = {
      id: newId(),
      role: 'user',
      content: userText,
      time: new Date().toLocaleTimeString('zh', { hour: '2-digit', minute: '2-digit' }),
    }

    const agentMsgs = activeAgents.map(agentId => {
      const cfg = agentMapRef.current[agentId] || {}
      return {
        id: newId(),
        role: 'assistant',
        agentType: agentId,
        name: cfg.name || agentId,
        avatarColor: cfg.avatarColor || 'bg-gray-400',
        bgColor: cfg.bgColor || 'bg-gray-50',
        content: '',
        streaming: true,
        time: new Date().toLocaleTimeString('zh', { hour: '2-digit', minute: '2-digit' }),
        meta: cfg.modelId || '',
      }
    })

    let resolvedConvId = null
    let history = []

    setConversations(prev => {
      // 用 activeIdRef.current 而非闭包里的 activeId，避免读到旧快照
      const convId = activeIdRef.current
      const currentConv = prev.find(c => c.id === convId)

      if (!currentConv) {
        const conv = makeConversation(activeAgents)
        resolvedConvId = conv.id
        history = [{ role: 'user', content: stripMentions(userText, agentsRef.current) }]
        return [{ ...conv, label: userText.slice(0, 20), messages: [userMsg, ...agentMsgs] }, ...prev]
      }

      resolvedConvId = convId
      history = mergeHistory([...currentConv.messages, userMsg]
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-10)
        .map(m => ({
          role: m.role,
          content: m.role === 'assistant' && m.name ? stripMentions(`[${m.name}]: ${m.content}`, agentsRef.current) : stripMentions(m.content, agentsRef.current),
        })))

      const firstMsg = currentConv.messages.length === 0
      const existingAgents = new Set(currentConv.agents)
      const newAgents = activeAgents.filter(a => !existingAgents.has(a))

      return prev.map(c => c.id !== convId ? c : {
        ...c,
        label: firstMsg ? userText.slice(0, 20) : c.label,
        agents: [...c.agents, ...newAgents],
        sessions: [...c.sessions, ...newAgents.map(agent => ({ agent, status: 'IDLE', tokensIn: 0, tokensOut: 0 }))],
        messages: [...c.messages, userMsg, ...agentMsgs],
      })
    })

    setTimeout(() => {
      const convId = resolvedConvId
      if (!convId) return
      // 如果是新建会话，同步 activeId
      if (activeIdRef.current !== convId) setActiveIdSynced(convId)

      agentMsgs.forEach((agentMsg, i) => {
        const agentId = activeAgents[i]
        const cfg = agentMapRef.current[agentId] || {}
        const msgId = agentMsg.id

        setSessionStatus(convId, agentId, 'ACTIVE')

        const handlers = {
          onChunk: (chunk) => {
            setConversations(prev => prev.map(c => c.id !== convId ? c : {
              ...c,
              messages: c.messages.map(m => m.id === msgId ? { ...m, content: m.content + chunk } : m),
            }))
          },
          onDone: (fullText, usage) => {
            setConversations(prev => prev.map(c => c.id !== convId ? c : {
              ...c,
              messages: c.messages.map(m =>
                m.id === msgId ? { ...m, content: fullText, streaming: false, meta: buildMeta(cfg.modelId, usage) } : m
              ),
            }))
            setSessionStatus(convId, agentId, 'IDLE', usage)
            const mentioned = parseMentions(fullText, agentsRef.current).filter(t => t !== agentId)
            if (mentioned.length > 0) setTimeout(() => triggerMentioned(convId, mentioned), 0)
          },
          onError: (err) => {
            setConversations(prev => prev.map(c => c.id !== convId ? c : {
              ...c,
              messages: c.messages.map(m =>
                m.id === msgId ? { ...m, content: `[错误] ${err.message}`, streaming: false } : m
              ),
            }))
            setSessionStatus(convId, agentId, 'ERROR')
          },
        }

        const ctrl = streamProvider({ provider: cfg.provider, messages: history, model: cfg.modelId, systemPrompt: cfg.systemPrompt, agentId: agentId, ...handlers })

        abortRefs.current[msgId] = ctrl
      })
    }, 0)
  }, [setActiveIdSynced, setSessionStatus, triggerMentioned])

  const stopAll = useCallback(() => {
    Object.values(abortRefs.current).forEach(c => c?.abort())
    abortRefs.current = {}
    setConversations(prev => prev.map(c => ({
      ...c,
      sessions: c.sessions.map(s => s.status === 'ACTIVE' ? { ...s, status: 'IDLE' } : s),
      messages: c.messages.map(m => m.streaming ? { ...m, streaming: false, meta: (m.meta || '') + ' · 已停止' } : m),
    })))
  }, [])

  return {
    conversations,
    activeId,
    messages,
    sessions,
    createConversation,
    switchConversation,
    sendMessage,
    stopAll,
  }
}
