import { useState } from 'react'
import Sidebar from './components/Sidebar'
import MainChatArea from './components/MainChatArea'
import RightSidebar from './components/RightSidebar'
import NewChatModal from './components/NewChatModal'
import CatNest from './components/CatNest'
import { useChatStore } from './store/chatStore'
import { useAgentStore } from './store/agentStore'

export default function App() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [activePage, setActivePage] = useState('chat') // 'chat' | 'catnest'

  const { agents, bridgeError, retryBridgeLoad, createAgent, updateAgent, deleteAgent } = useAgentStore()

  const {
    conversations, activeId, messages, sessions,
    createConversation, switchConversation, sendMessage, stopAll,
    isConfirmRequired, confirmDelete,
  } = useChatStore(agents)

  const handleStart = (agentIds) => {
    createConversation(agentIds)
    setIsModalOpen(false)
    setActivePage('chat')
  }

  const handleSwitch = (convId) => {
    switchConversation(convId)
    setActivePage('chat')
  }

  return (
    <div className="flex h-screen w-full bg-white text-[#333333] font-sans overflow-hidden">
      {bridgeError && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full mx-4 space-y-3">
            <div className="text-red-500 font-semibold text-base">Bridge 不可用</div>
            <div className="text-sm text-gray-600">{bridgeError}</div>
            <div className="text-xs text-gray-400">请确认 bridge 已启动，然后点击重试。</div>
            <button
              onClick={retryBridgeLoad}
              className="mt-2 px-4 py-2 bg-[#D87C65] text-white text-sm rounded-lg hover:bg-[#C56A55] transition-colors"
            >
              重试
            </button>
          </div>
        </div>
      )}
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        activePage={activePage}
        agents={agents}
        onOpenNewChat={() => setIsModalOpen(true)}
        onSwitch={handleSwitch}
        onOpenCatNest={() => setActivePage(p => p === 'catnest' ? 'chat' : 'catnest')}
        onDelete={confirmDelete}
        onConfirmDelete={confirmDelete}
        isConfirmRequired={isConfirmRequired}
      />

      {activePage === 'catnest' ? (
        <CatNest
          agents={agents}
          onCreate={createAgent}
          onUpdate={updateAgent}
          onDelete={deleteAgent}
        />
      ) : (
        <>
          <MainChatArea
            messages={messages}
            sessions={sessions}
            agents={agents}
            onSend={sendMessage}
            onStop={stopAll}
          />
          <RightSidebar sessions={sessions} agents={agents} />
        </>
      )}

      {isModalOpen && (
        <NewChatModal
          agents={agents}
          onClose={() => setIsModalOpen(false)}
          onStart={handleStart}
        />
      )}
    </div>
  )
}
