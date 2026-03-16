import { useState, useRef, useEffect } from 'react'
import { Paperclip, Mic, Send, Lock, ChevronRight } from 'lucide-react'
import { PROVIDERS } from '../store/agentStore'
import CatIcon from './CatIcon'

export function parseAgentsFromText(text, agents) {
  const mentioned = new Set()
  agents.forEach(agent => {
    if (text.includes(`@${agent.name}`)) {
      mentioned.add(agent.id)
    }
  })
  return [...mentioned]
}

export default function ChatInput({ onSend, agents = [] }) {
  const [text, setText] = useState('')
  const [atQuery, setAtQuery] = useState(null)   // null=关闭
  const [atIndex, setAtIndex] = useState(-1)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [providerFilter, setProviderFilter] = useState(null) // null=顶层, string=provider
  const textareaRef = useRef(null)
  const panelRef = useRef(null)

  // 顶层：provider 列表 + 直接匹配 agent
  // 二级：某 provider 下的 agents
  const providerList = Object.entries(PROVIDERS)

  const getFiltered = () => {
    const q = (atQuery || '').toLowerCase()
    if (providerFilter) {
      // 二级：该 provider 下的 agents，按 query 过滤
      return agents
        .filter(a => a.provider === providerFilter)
        .filter(a => !q || a.id.includes(q) || a.name.toLowerCase().includes(q))
        .map(a => ({ type: 'agent', data: a }))
    }
    if (!q) {
      // 顶层无输入：显示所有 provider
      return providerList.map(([k, v]) => ({ type: 'provider', key: k, data: v }))
    }
    // 有输入：模糊匹配 agent id/name，同时匹配 provider label
    const agentMatches = agents
      .filter(a => a.id.includes(q) || a.name.toLowerCase().includes(q))
      .map(a => ({ type: 'agent', data: a }))
    const providerMatches = providerList
      .filter(([k, v]) => k.includes(q) || v.label.toLowerCase().includes(q))
      .map(([k, v]) => ({ type: 'provider', key: k, data: v }))
    return [...providerMatches, ...agentMatches]
  }

  const filtered = getFiltered()

  useEffect(() => { setSelectedIdx(0) }, [atQuery, providerFilter])

  const insertAgent = (agent) => {
    const cursor = textareaRef.current.selectionStart
    const before = text.slice(0, atIndex)
    const after = text.slice(cursor)
    const inserted = `@${agent.name} `
    const newText = before + inserted + after
    setText(newText)
    setAtQuery(null)
    setProviderFilter(null)
    setTimeout(() => {
      const pos = atIndex + inserted.length
      textareaRef.current.focus()
      textareaRef.current.setSelectionRange(pos, pos)
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 192) + 'px'
    }, 0)
  }

  const selectItem = (item) => {
    if (item.type === 'provider') {
      setProviderFilter(item.key)
      setSelectedIdx(0)
    } else {
      insertAgent(item.data)
    }
  }

  const handleInput = (e) => {
    const val = e.target.value
    setText(val)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 192) + 'px'
    const cursor = e.target.selectionStart
    const before = val.slice(0, cursor)
    const match = before.match(/@([^@\s]*)$/)
    if (match) {
      setAtQuery(match[1])
      setAtIndex(before.lastIndexOf('@'))
      setProviderFilter(null)
    } else {
      setAtQuery(null)
      setProviderFilter(null)
    }
  }

  const handleKeyDown = (e) => {
    if (atQuery !== null && filtered.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => (i + 1) % filtered.length); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => (i - 1 + filtered.length) % filtered.length); return }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault(); selectItem(filtered[selectedIdx]); return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        if (providerFilter) { setProviderFilter(null); return }
        setAtQuery(null); return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    const agentIds = parseAgentsFromText(trimmed, agents)
    if (agentIds.length === 0) return
    onSend(trimmed, agentIds)
    setText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setAtQuery(null)
    setProviderFilter(null)
  }

  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setAtQuery(null); setProviderFilter(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const mentionedIds = parseAgentsFromText(text, agents)
  const mentionedAgents = agents.filter(a => mentionedIds.includes(a.id))
  const canSend = text.trim() && mentionedAgents.length > 0

  return (
    <div className="px-6 pb-6 pt-2 bg-gradient-to-t from-white via-white dark:from-gray-900 dark:via-gray-900 to-transparent absolute bottom-0 w-full z-10">
      {/* @ 选择面板 */}
      {atQuery !== null && filtered.length > 0 && (
        <div
          ref={panelRef}
          className="absolute bottom-full mb-2 left-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden z-20 min-w-[220px]"
        >
          {providerFilter && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setProviderFilter(null)}
              className="flex items-center space-x-2 w-full px-4 py-2 text-xs text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700"
            >
              <ChevronRight size={12} className="rotate-180" />
              <span>返回</span>
              <span className="text-gray-500 font-medium">{PROVIDERS[providerFilter]?.label}</span>
            </button>
          )}
          {filtered.map((item, idx) => (
            <button
              key={item.type === 'provider' ? item.key : item.data.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectItem(item)}
              onMouseEnter={() => setSelectedIdx(idx)}
              className={`flex items-center justify-between w-full px-4 py-2.5 text-left transition-colors ${idx === selectedIdx ? 'bg-[#FDF3EB] dark:bg-orange-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
            >
              {item.type === 'provider' ? (
                <>
                  <div className="flex items-center space-x-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${item.data.color}`} />
                    <span className="text-sm text-gray-700 dark:text-gray-200">{item.data.label}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{agents.filter(a => a.provider === item.key).length} agents</span>
                  </div>
                  <ChevronRight size={14} className="text-gray-400 dark:text-gray-500" />
                </>
              ) : (
                <>
                  <div className="flex items-center space-x-2">
                    <div className={`w-5 h-5 rounded-full ${item.data.avatarColor} flex items-center justify-center`}>
                      <CatIcon size={12} color="white" />
                    </div>
                    <span className="text-sm text-gray-700 dark:text-gray-200">{item.data.name}</span>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500 ml-4">@{item.data.name}</span>
                </>
              )}
            </button>
          ))}
          <div className="px-4 py-1.5 border-t border-gray-100 dark:border-gray-700 flex space-x-3 text-[11px] text-gray-400 dark:text-gray-500">
            <span>↑↓ 选择</span><span>Tab/Enter 确认</span><span>Esc 返回</span>
          </div>
        </div>
      )}

      {/* 已召唤 agent 标签 */}
      {mentionedAgents.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 px-1">
          {mentionedAgents.map(agent => (
            <span key={agent.id} className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs border border-[#D87C65] bg-[#FDF3EB] text-[#D87C65]">
              <span className={`w-2 h-2 rounded-full ${agent.avatarColor}`} />
              <span>{agent.name}</span>
              <span className="opacity-60">@{agent.name}</span>
            </span>
          ))}
        </div>
      )}

      <div className="relative flex items-end border border-gray-200 dark:border-gray-600 bg-[#FBFBFB] dark:bg-gray-800 rounded-2xl p-2 shadow-sm focus-within:ring-1 focus-within:ring-[#D87C65]/30 focus-within:border-[#D87C65]/50 transition-all">
        <div className="p-2 text-gray-400 hover:text-gray-600 cursor-pointer mb-1 shrink-0">
          <Paperclip size={20} />
        </div>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          className="flex-1 max-h-48 min-h-[44px] bg-transparent border-none focus:ring-0 resize-none py-3 px-2 text-[15px] text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none leading-relaxed"
          placeholder="输入 @ 召唤 Agent... (Enter 发送, Shift+Enter 换行)"
          rows={1}
        />
        <div className="flex items-center space-x-1 p-2 mb-1 shrink-0">
          <div className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 cursor-pointer rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
            <Lock size={18} />
          </div>
          <div className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 cursor-pointer rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
            <Mic size={18} />
          </div>
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={`p-2 rounded-full ml-1 transition-colors ${canSend ? 'bg-[#D87C65] text-white hover:bg-[#C56A55] cursor-pointer' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'}`}
          >
            <Send size={16} className="ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
