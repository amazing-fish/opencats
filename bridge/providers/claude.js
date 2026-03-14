/**
 * Claude provider adapter
 * 输入: { messages, model, systemPrompt }
 * 输出: async generator，yield { type, ... }
 */
import Anthropic from '@anthropic-ai/sdk'

export const id = 'claudecode'

export function isAvailable() {
  return !!process.env.CLAUDE_API_KEY
}

export async function* stream({ messages, model = 'claude-sonnet-4-6', systemPrompt, signal }) {
  if (!isAvailable()) {
    yield { type: 'error', message: 'CLAUDE_API_KEY not set in bridge environment' }
    return
  }

  const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY })

  const params = { model, max_tokens: 8096, messages }
  if (systemPrompt) params.system = systemPrompt

  const anthropicStream = client.messages.stream(params)

  signal?.addEventListener('abort', () => anthropicStream.abort())

  try {
    for await (const event of anthropicStream) {
      if (signal?.aborted) break
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        yield { type: 'chunk', text: event.delta.text }
      }
      if (event.type === 'message_delta' && event.usage) {
        yield { type: 'usage', usage: event.usage }
      }
    }
    if (!signal?.aborted) yield { type: 'done' }
  } catch (err) {
    if (!signal?.aborted) yield { type: 'error', message: err.message }
  }
}
