import { useState, useCallback, useEffect } from 'react'

const BRIDGE = import.meta.env.VITE_CODEX_BRIDGE_URL || 'http://localhost:4891'
const AGENTS_KEY = 'cat-cafe:agents'

export const PROVIDERS = {
  claudecode: { label: 'Claude Code', color: 'bg-purple-400' },
  codex: { label: 'Codex', color: 'bg-green-400' },
}

// 默认 agents（首次加载时写入 Redis，用户可自由编辑/删除）
export const BUILTIN_AGENTS = [
  {
    id: 'claude',
    name: '布偶猫',
    provider: 'claudecode',
    modelId: 'claude-sonnet-4-6',
    systemPrompt: '',
    avatarColor: 'bg-purple-400',
    bgColor: 'bg-[#EAE4F2]',
  },
  {
    id: 'codex',
    name: '缅因猫',
    provider: 'codex',
    modelId: 'gpt-5.4',
    systemPrompt: '',
    avatarColor: 'bg-green-400',
    bgColor: 'bg-[#F2EDF8]',
  },
]

const AVATAR_COLORS = [
  'bg-purple-400', 'bg-green-400', 'bg-blue-400', 'bg-pink-400',
  'bg-yellow-400', 'bg-orange-400', 'bg-teal-400', 'bg-red-400',
]
const BG_COLORS = [
  'bg-[#EAE4F2]', 'bg-[#F2EDF8]', 'bg-[#E4EEF2]', 'bg-[#F2E4EE]',
  'bg-[#F2F0E4]', 'bg-[#F2EAE4]', 'bg-[#E4F2EE]', 'bg-[#F2E4E4]',
]

export function pickColors(idx) {
  return {
    avatarColor: AVATAR_COLORS[idx % AVATAR_COLORS.length],
    bgColor: BG_COLORS[idx % BG_COLORS.length],
  }
}

export function useAgentStore() {
  const [agents, setAgents] = useState(BUILTIN_AGENTS)
  const isLoaded = { current: false }

  useEffect(() => {
    fetch(`${BRIDGE}/agents`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setAgents(data)
        } else {
          // 首次加载：写入默认 agents
          setAgents(BUILTIN_AGENTS)
          fetch(`${BRIDGE}/agents`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(BUILTIN_AGENTS),
          }).catch(() => {})
        }
      })
      .catch(() => {})
      .finally(() => { isLoaded.current = true })
  }, [])

  const saveAgents = useCallback((list) => {
    fetch(`${BRIDGE}/agents`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(list),
    }).catch(() => {})
  }, [])

  const createAgent = useCallback((data) => {
    const duplicate = agents.find(a => a.name === data.name)
    if (duplicate) return { error: `已存在同名 Agent "${data.name}"` }
    const idx = Math.floor(Math.random() * AVATAR_COLORS.length)
    const agent = {
      ...data,
      ...pickColors(idx),
      id: data.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_' + Date.now(),
    }
    setAgents(prev => {
      const next = [...prev, agent]
      saveAgents(next)
      return next
    })
    return agent
  }, [saveAgents])

  const updateAgent = useCallback((id, data) => {
    setAgents(prev => {
      const next = prev.map(a => a.id === id ? { ...a, ...data } : a)
      saveAgents(next)
      return next
    })
  }, [saveAgents])

  const deleteAgent = useCallback((id) => {
    setAgents(prev => {
      const next = prev.filter(a => a.id !== id)
      saveAgents(next)
      return next
    })
  }, [saveAgents])

  return { agents, createAgent, updateAgent, deleteAgent }
}
