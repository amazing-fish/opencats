import { Settings, Info, ChevronUp } from 'lucide-react'

export default function RightSidebar({ sessions, agents = [] }) {
  const agentMap = agents.reduce((acc, a) => { acc[a.id] = a; return acc }, {})
  const agentStatusMap = sessions.reduce((acc, s) => ({ ...acc, [s.agent]: s }), {})

  return (
    <div className="w-[300px] bg-[#FAFAFA] border-l border-gray-200 flex flex-col h-full flex-shrink-0 z-10 overflow-y-auto custom-scrollbar">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <span className="text-sm font-semibold text-gray-800">当前模式: 空间</span>
        <Settings size={18} className="text-gray-400 cursor-pointer hover:text-gray-700" />
      </div>

      {/* 基础设定 */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex justify-between items-center mb-3 cursor-pointer group">
          <span className="text-sm font-semibold text-gray-800">基础设定</span>
          <ChevronUp size={16} className="text-gray-400" />
        </div>
        <div className="space-y-2 text-sm">
          {[['温度', '0'], ['最大 Token', '8096'], ['系统设定', '默认']].map(([k, v]) => (
            <div key={k} className="flex justify-between items-center">
              <span className="text-gray-500">{k}</span>
              <span className="text-gray-800 bg-gray-100 px-2 py-0.5 rounded text-xs">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Session Chain */}
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-semibold text-gray-800">Session Chain</span>
            <Info size={14} className="text-gray-400" />
          </div>
          <span className="text-xs text-gray-500 bg-gray-200/50 px-2 py-0.5 rounded-full">
            {sessions.length} sessions
          </span>
        </div>

        <div className="space-y-3 relative before:absolute before:inset-y-4 before:left-[11px] before:w-px before:bg-gray-200">
          {sessions.map((session, idx) => {
            const cfg = agentMap[session.agent]
            const isActive = session.status === 'ACTIVE'
            return (
              <div key={idx} className="relative pl-6">
                <div className={`absolute left-[8px] top-2 w-2 h-2 rounded-full border border-white ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                <div className={`border rounded-lg p-3 ${isActive ? 'bg-white border-green-200 shadow-sm' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold tracking-wider" style={{ color: isActive ? '#22C55E' : '#9CA3AF' }}>
                      {session.status}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-gray-800 mb-2">{cfg?.name || session.agent}</div>
                  <div className="flex flex-wrap gap-1">
                    <span className="text-[11px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                      {session.tokensIn}↑ {session.tokensOut}↓
                    </span>
                    <span className="text-[11px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                      {cfg?.modelLabel}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
