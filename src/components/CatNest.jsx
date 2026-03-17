import { useState } from 'react'
import { Plus, Trash2, Edit2, X, Check, ChevronDown } from 'lucide-react'
import { PROVIDERS, BUILTIN_AGENTS, pickColors } from '../store/agentStore'
import CatIcon from './CatIcon'

function AgentForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || {
    name: '', provider: 'claudecode', modelId: '', systemPrompt: '', baseUrl: '', apiKey: '',
  })
  const [error, setError] = useState('')
  const set = (k, v) => { setError(''); setForm(f => ({ ...f, [k]: v })) }
  const valid = form.name.trim() && form.modelId.trim()

  const handleSave = () => {
    if (!valid) return
    const result = onSave(form)
    if (result?.error) setError(result.error)
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-4 shadow-sm">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">名称 (用于 @)</label>
          <input
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="如: 侦探猫"
            className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#D87C65] bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Provider</label>
          <select
            value={form.provider}
            onChange={e => set('provider', e.target.value)}
            className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#D87C65] bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
          >
            {Object.entries(PROVIDERS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Model ID</label>
          <input
            value={form.modelId}
            onChange={e => set('modelId', e.target.value)}
            placeholder="如: claude-sonnet-4-6"
            className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#D87C65] bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Base URL <span className="text-gray-300 dark:text-gray-600">（可选）</span></label>
          <input
            value={form.baseUrl}
            onChange={e => set('baseUrl', e.target.value)}
            placeholder="如: https://api.example.com"
            className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#D87C65] bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">API Key <span className="text-gray-300 dark:text-gray-600">（可选，留空使用 bridge 默认）</span></label>
          <input
            type="password"
            value={form.apiKey}
            onChange={e => set('apiKey', e.target.value)}
            placeholder="sk-..."
            className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#D87C65] bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">System Prompt</label>
          <textarea
            value={form.systemPrompt}
            onChange={e => set('systemPrompt', e.target.value)}
            placeholder="你是一只..."
            rows={3}
            className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#D87C65] resize-none bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
          />
        </div>
      </div>
      {error && <div className="text-xs text-red-500 px-1">{error}</div>}
      <div className="flex justify-end space-x-2">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">取消</button>
        <button
          onClick={handleSave}
          disabled={!valid}
          className={`px-4 py-2 text-sm rounded-lg transition-colors ${valid ? 'bg-[#D87C65] text-white hover:bg-[#C56A55]' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
        >
          保存
        </button>
      </div>
    </div>
  )
}

export default function CatNest({ agents, onCreate, onUpdate, onDelete }) {
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const byProvider = Object.keys(PROVIDERS).reduce((acc, p) => {
    acc[p] = agents.filter(a => a.provider === p)
    return acc
  }, {})

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-gray-900 relative min-w-0 transition-colors duration-300">
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">猫窝</h1>
          <span className="text-sm text-gray-400 dark:text-gray-500">Agent 管理</span>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#D87C65] text-white text-sm rounded-lg hover:bg-[#C56A55] transition-colors"
        >
          <Plus size={15} />
          <span>新建 Agent</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8 custom-scrollbar">
        {creating && (
          <div>
            <h2 className="text-sm font-semibold text-gray-600 mb-3">新建 Agent</h2>
            <AgentForm
              onSave={(data) => {
                const result = onCreate(data)
                if (!result?.error) setCreating(false)
                return result
              }}
              onCancel={() => setCreating(false)}
            />
          </div>
        )}

        {Object.entries(PROVIDERS).map(([providerKey, provider]) => (
          <div key={providerKey}>
            <div className="flex items-center space-x-2 mb-3">
              <span className={`w-2.5 h-2.5 rounded-full ${provider.color}`} />
              <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-300">{provider.label}</h2>
              <span className="text-xs text-gray-400 dark:text-gray-500">{byProvider[providerKey]?.length || 0} agents</span>
            </div>
            <div className="space-y-3">
              {(byProvider[providerKey] || []).map(agent => (
                <div key={agent.id}>
                  {editingId === agent.id ? (
                    <AgentForm
                      initial={agent}
                      onSave={(data) => { onUpdate(agent.id, data); setEditingId(null) }}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <div className={`${agent.bgColor} dark:bg-gray-700 border border-gray-100 dark:border-gray-700 rounded-xl p-4 flex items-start justify-between`}>
                      <div className="flex items-start space-x-3">
                        <div className={`w-9 h-9 rounded-full ${agent.avatarColor} flex items-center justify-center shrink-0 shadow-sm`}>
                          <CatIcon size={20} color="white" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{agent.name}</span>
                            <span className="text-xs text-gray-400 dark:text-gray-500 bg-white/60 dark:bg-gray-700/60 px-1.5 py-0.5 rounded">@{agent.id}</span>
                            {agent.builtin && <span className="text-xs text-[#D87C65] bg-[#FDF3EB] dark:bg-orange-900/30 px-1.5 py-0.5 rounded">内置</span>}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{agent.modelId}</div>
                          {agent.systemPrompt && (
                            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1 line-clamp-2 max-w-sm">{agent.systemPrompt}</div>
                          )}
                        </div>
                      </div>
                      {!agent.builtin && (
                        <div className="flex space-x-1 shrink-0">
                          <button onClick={() => setEditingId(agent.id)} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/60 dark:hover:bg-gray-700 rounded-lg">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => onDelete(agent.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-white/60 dark:hover:bg-gray-700 rounded-lg">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {(byProvider[providerKey] || []).length === 0 && (
                <div className="text-xs text-gray-400 dark:text-gray-500 py-3 px-4 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-center">
                  暂无 {provider.label} agents
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
