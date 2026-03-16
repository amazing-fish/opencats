import { useState, useEffect } from 'react'
import { Menu, Search, Edit3, BarChart2, ListTodo, Home, Book, Calendar, Settings, ChevronDown, Trash2, X, Check, Sun, Moon } from 'lucide-react'
import CatIcon from './CatIcon'

export default function Sidebar({ conversations, activeId, onOpenNewChat, onSwitch, onOpenCatNest, activePage, agents = [], isDark, onToggleTheme, onDelete, onConfirmDelete, isConfirmRequired }) {
  const [isAnimating, setIsAnimating] = useState(false)
  const agentMap = agents.reduce((acc, a) => { acc[a.id] = a; return acc }, {})
  const [pendingDeleteId, setPendingDeleteId] = useState(null)
  useEffect(() => {
    if (pendingDeleteId && !conversations.find(c => c.id === pendingDeleteId)) {
      setPendingDeleteId(null)
    }
  }, [conversations, pendingDeleteId])
  const navItems = [
    { icon: <Edit3 size={16} />, label: '发起新对话', action: onOpenNewChat },
    { icon: <BarChart2 size={16} />, label: '数据看板' },
    { icon: <ListTodo size={16} />, label: '任务队列' },
    { icon: <Home size={16} />, label: '猫窝', action: onOpenCatNest, page: 'catnest' },
    { icon: <Book size={16} />, label: '知识库' },
    { icon: <Calendar size={16} />, label: '计划板' },
  ]

  const handleToggle = () => {
    if (isAnimating) return
    setIsAnimating(true)
    onToggleTheme()
  }

  return (
    <>
      <style>{`
        @keyframes bounce-toggle {
          0%   { transform: scale(1) rotate(0deg); }
          25%  { transform: scale(1.4) rotate(-20deg); }
          50%  { transform: scale(0.8) rotate(15deg); }
          70%  { transform: scale(1.15) rotate(-8deg); }
          85%  { transform: scale(0.95) rotate(4deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        .animate-bounce-toggle {
          animation: bounce-toggle 0.45s cubic-bezier(0.36, 0.07, 0.19, 0.97) forwards;
        }
      `}</style>
      <div className="w-[260px] flex flex-col border-r border-gray-200 dark:border-gray-700 bg-[#FAFAFA] dark:bg-gray-800 h-full flex-shrink-0 z-10 transition-colors duration-300">
        <div className="flex items-center justify-between p-4 text-gray-500 dark:text-gray-400">
          <Menu size={20} className="cursor-pointer hover:text-gray-800 dark:hover:text-gray-100" />
          <div className="flex items-center space-x-3">
            <Search size={20} className="cursor-pointer hover:text-gray-800 dark:hover:text-gray-100" />
            <Edit3 size={20} className="cursor-pointer text-[#D87C65] hover:text-[#C56A55]" onClick={onOpenNewChat} />
            <button
              onClick={handleToggle}
              onAnimationEnd={() => setIsAnimating(false)}
              className={`cursor-pointer hover:text-gray-800 dark:hover:text-gray-100 focus:outline-none ${isAnimating ? 'animate-bounce-toggle' : ''}`}
              aria-label="切换深色模式"
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </div>

        <div className="flex flex-col px-2 space-y-0.5">
          {navItems.map((item, idx) => {
            const isNew = item.label === '发起新对话'
            const isActive = item.page && item.page === activePage
            return (
              <div
                key={idx}
                onClick={item.action}
                className={`flex items-center space-x-3 px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors ${
                  isNew ? 'text-[#D87C65] hover:bg-orange-50/50 dark:hover:bg-orange-900/20' :
                  isActive ? 'bg-[#EAEAEA] dark:bg-gray-700 text-gray-900 dark:text-gray-100' :
                  'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <span className={isNew ? 'text-[#D87C65]' : isActive ? 'text-gray-700 dark:text-gray-300' : 'text-gray-500 dark:text-gray-400'}>{item.icon}</span>
                <span className={isNew ? 'font-medium' : isActive ? 'font-medium' : ''}>{item.label}</span>
              </div>
            )
          })}
        </div>

        <div className="flex-1 overflow-y-auto mt-4 px-2 custom-scrollbar">
          <div className="flex items-center text-xs text-gray-400 dark:text-gray-500 px-3 mb-2">
            <ChevronDown size={14} className="mr-1" />
            <span>你的聊天</span>
          </div>
          <div className="space-y-0.5">
            {conversations.length === 0 && (
              <div className="px-3 py-4 text-xs text-gray-400 dark:text-gray-500 text-center">暂无对话，点击上方发起新对话</div>
            )}
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => { if (pendingDeleteId !== conv.id) onSwitch(conv.id) }}
                className={`group relative flex flex-col px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  conv.id === activeId
                    ? 'bg-[#EAEAEA] dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                {pendingDeleteId === conv.id ? (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">确认删除？</span>
                    <div className="flex space-x-1">
                      <button
                        onClick={e => { e.stopPropagation(); onConfirmDelete(conv.id); setPendingDeleteId(null) }}
                        className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        aria-label="确认删除"
                      >
                        <Check size={13} />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setPendingDeleteId(null) }}
                        className="p-1 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                        aria-label="取消删除"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm truncate pr-2 font-medium">{conv.label}</span>
                      <div className="flex items-center space-x-1">
                        <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                          {new Date(conv.createdAt).toLocaleTimeString('zh', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            if (isConfirmRequired()) {
                              setPendingDeleteId(conv.id)
                            } else {
                              onDelete(conv.id)
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 hover:bg-white/60 dark:hover:bg-gray-600 rounded transition-opacity"
                          aria-label={`删除会话 ${conv.label}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="flex mt-1.5 space-x-1">
                      {conv.agents.map((agentType, i) => (
                        <div key={i} className={`w-4 h-4 rounded-full ${agentMap[agentType]?.avatarColor || 'bg-gray-300'} border border-white dark:border-gray-800 flex items-center justify-center`}>
                          <CatIcon size={10} color="white" />
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 cursor-pointer">
            <Settings size={18} />
            <span>设置</span>
          </div>
        </div>
      </div>
    </>
  )
}
