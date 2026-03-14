import { useState } from 'react'
import { X, Search, Box, Folder, Users, ToggleRight } from 'lucide-react'

export default function NewChatModal({ onClose, onStart, agents = [] }) {
  const [selectedIds, setSelectedIds] = useState(agents[0] ? [agents[0].id] : [])
  const [isChainEnabled, setIsChainEnabled] = useState(true)

  const toggleAgent = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id])
  }

  const handleStart = () => {
    onStart?.(selectedIds)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-[560px] max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">新建对话</h2>
          <X size={20} className="text-gray-400 cursor-pointer hover:text-gray-700" onClick={onClose} />
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* 参与者配置 */}
          <div>
            <div className="text-sm font-medium text-gray-700 mb-3">
              参与者配置 <span className="text-xs text-gray-400 font-normal">多选时将创建协作空间</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {agents.map(agent => (
                <div
                  key={agent.id}
                  onClick={() => toggleAgent(agent.id)}
                  className={`px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors ${
                    selectedIds.includes(agent.id)
                      ? 'border-[#D87C65] bg-[#FDF3EB] text-[#D87C65] font-medium'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {agent.name}
                </div>
              ))}
            </div>
          </div>

          {/* 连续对话 */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
            <div>
              <div className="text-sm font-medium text-gray-800">连续对话</div>
              <div className="text-xs text-gray-500 mt-0.5">将注入最近的 Session Chain 作为上下文</div>
            </div>
            <ToggleRight
              size={32}
              className={`cursor-pointer ${isChainEnabled ? 'text-green-500' : 'text-gray-300'}`}
              onClick={() => setIsChainEnabled(!isChainEnabled)}
            />
          </div>

          {/* 预设列表 */}
          <div>
            <div className="relative mb-3">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="搜索场景或框架..."
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#D87C65]"
              />
            </div>
            <div className="space-y-1">
              {[
                { icon: <Box size={18} className="text-blue-500 mt-0.5" />, name: 'dare-framework', path: '/workspace/prompt/dare-framework' },
                { icon: <Folder size={18} className="text-yellow-500 mt-0.5" />, name: 'cat-cafe', path: '/workspace/prompt/ui-cat-cafe' },
                { icon: <Users size={18} className="text-purple-500 mt-0.5" />, name: '大厅 (沉浸式)', path: '默认协作空间' },
              ].map((item, i) => (
                <div key={i} className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer border border-transparent hover:border-gray-100">
                  {item.icon}
                  <div>
                    <div className="text-sm font-medium text-gray-800">{item.name}</div>
                    <div className="text-xs text-gray-400 font-mono mt-0.5">{item.path}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 bg-white border border-gray-200 rounded-lg transition-colors">
            取消
          </button>
          <button
            onClick={handleStart}
            disabled={selectedIds.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-[#D87C65] hover:bg-[#C56A55] disabled:opacity-50 rounded-lg transition-colors shadow-sm"
          >
            发起新对话
          </button>
        </div>
      </div>
    </div>
  )
}
