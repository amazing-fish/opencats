import { useRef, useEffect } from 'react'
import { FileText, Columns, Download, MoreHorizontal, StopCircle } from 'lucide-react'
import { BotMessage, UserMessage } from './Messages'
import ChatInput from './ChatInput'

export default function MainChatArea({ messages, sessions, onSend, onStop, agents }) {
  const bottomRef = useRef(null)
  const isStreaming = sessions.some(s => s.status === 'ACTIVE')

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-gray-900 relative min-w-0 transition-colors duration-300">
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 z-10">
        <div className="flex items-center space-x-3">
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Cat Cafe</h1>
          <span className="text-sm text-gray-400 dark:text-gray-500">AI 猫猫协作空间</span>
        </div>
        <div className="flex items-center space-x-4 text-gray-400 dark:text-gray-500">
          {isStreaming && (
            <button
              onClick={onStop}
              className="flex items-center space-x-1 text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 px-2 py-1 rounded-lg transition-colors"
            >
              <StopCircle size={14} />
              <span>停止</span>
            </button>
          )}
          <div className="flex items-center space-x-3 border-r border-gray-200 dark:border-gray-700 pr-4">
            <FileText size={18} className="cursor-pointer hover:text-gray-600 dark:hover:text-gray-300" />
            <Columns size={18} className="cursor-pointer hover:text-gray-600 dark:hover:text-gray-300" />
            <Download size={18} className="cursor-pointer hover:text-gray-600 dark:hover:text-gray-300" />
          </div>
          <MoreHorizontal size={20} className="cursor-pointer hover:text-gray-600 dark:hover:text-gray-300" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 custom-scrollbar pb-36">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 space-y-2">
            <span className="text-4xl">🐱</span>
            <p className="text-sm">选择 Agent，开始对话</p>
          </div>
        )}
        {messages.map(msg =>
          msg.role === 'user'
            ? <UserMessage key={msg.id} name="铲屎官" time={msg.time} content={msg.content} />
            : <BotMessage key={msg.id} {...msg} />
        )}
        <div ref={bottomRef} />
      </div>

      <ChatInput onSend={onSend} agents={agents} />
    </div>
  )
}
