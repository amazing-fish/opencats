import { ChevronDown } from 'lucide-react'
import CatIcon from './CatIcon'
import { User } from 'lucide-react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({ breaks: true, gfm: true })

function renderMarkdown(content) {
  return DOMPurify.sanitize(marked.parse(content || ''))
}

export function BotMessage({ name, time, avatarColor, content, meta, bgColor, quote, streaming }) {
  return (
    <div className="flex items-start max-w-4xl">
      <div className={`w-8 h-8 rounded-full ${avatarColor} flex items-center justify-center shrink-0 mt-1 shadow-sm`}>
        <CatIcon size={20} color="white" />
      </div>
      <div className="ml-4 flex flex-col items-start w-full min-w-0">
        <div className="flex items-center space-x-2 mb-1.5">
          <span className="text-sm font-medium text-gray-700">{name}</span>
          <span className="text-xs text-gray-400">{time}</span>
          {streaming && <span className="text-xs text-green-500 animate-pulse">●</span>}
        </div>
        {quote && (
          <div className="mb-2 pl-3 border-l-2 border-[#D87C65]/30 bg-[#FFF9F6] py-1.5 px-3 rounded-r-lg w-full max-w-[90%]">
            <span className="text-[11px] text-gray-500 mb-0.5 block">回复 {quote.author}</span>
            <p className="text-[13px] text-gray-600 line-clamp-2 leading-relaxed">{quote.text}</p>
          </div>
        )}
        <div className={`${bgColor} text-gray-800 text-[15px] px-5 py-4 rounded-2xl rounded-tl-sm shadow-sm w-full leading-relaxed border border-gray-50/50 min-h-[52px] prose prose-sm max-w-none`}>
          {streaming && !content
            ? <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse rounded" />
            : <div dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
          }
        </div>
        {meta && (
          <div className="flex items-center mt-2 space-x-2">
            <div className="bg-gray-50 border border-gray-100 text-gray-400 text-xs px-2 py-1 rounded-md">
              {meta}
            </div>
            <div className="text-xs text-gray-400 hover:bg-gray-100 p-1 rounded cursor-pointer">
              <ChevronDown size={14} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function UserMessage({ name, time, content }) {
  return (
    <div className="flex items-start justify-end w-full">
      <div className="mr-4 flex flex-col items-end w-full max-w-3xl">
        <div className="flex items-center space-x-2 mb-1.5">
          <span className="text-xs text-gray-400">{time}</span>
          <span className="text-sm font-medium text-gray-700">{name}</span>
        </div>
        <div className="bg-[#FDF3EB] text-[#4A3D36] text-[15px] px-5 py-4 rounded-2xl rounded-tr-sm shadow-sm leading-relaxed border border-[#FBE3D1]/50 inline-block text-left whitespace-pre-wrap">
          {content}
        </div>
      </div>
      <div className="w-8 h-8 rounded-full bg-[#F3D7C6] flex items-center justify-center shrink-0 mt-1 shadow-sm text-[#B47858]">
        <User size={20} />
      </div>
    </div>
  )
}
