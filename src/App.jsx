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

  const { agents, createAgent, updateAgent, deleteAgent } = useAgentStore()

  const {
    conversations, activeId, messages, sessions,
    createConversation, switchConversation, sendMessage, stopAll,
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
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        activePage={activePage}
        agents={agents}
        onOpenNewChat={() => setIsModalOpen(true)}
        onSwitch={handleSwitch}
        onOpenCatNest={() => setActivePage(p => p === 'catnest' ? 'chat' : 'catnest')}
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
