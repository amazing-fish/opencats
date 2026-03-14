/**
 * Gateway Policy Layer
 * 为所有 provider adapter 提供统一的：
 * - 请求超时
 * - retry / backoff（仅幂等场景）
 * - 并发限流
 * - 结构化日志
 * - usage/cost 统计 hook
 */

// ── 配置 ──────────────────────────────────────────────────────────────────────

const POLICY = {
  timeoutMs: Number(process.env.GATEWAY_TIMEOUT_MS) || 60_000,
  maxRetries: Number(process.env.GATEWAY_MAX_RETRIES) || 2,
  retryBaseMs: Number(process.env.GATEWAY_RETRY_BASE_MS) || 500,
  maxConcurrency: Number(process.env.GATEWAY_MAX_CONCURRENCY) || 10,
}

// ── 并发计数器 ────────────────────────────────────────────────────────────────

let activeRequests = 0

// ── 结构化日志 ────────────────────────────────────────────────────────────────

function log(level, provider, msg, extra = {}) {
  console[level]?.(JSON.stringify({
    ts: new Date().toISOString(),
    level,
    provider,
    msg,
    ...extra,
  }))
}

// ── 可重试错误判断 ────────────────────────────────────────────────────────────
// 只对网络/限流类错误重试，不重试业务错误（key 无效、内容违规等）

function isRetryable(err) {
  if (!err) return false
  const msg = err.message || ''
  return (
    err.status === 429 ||
    err.status === 503 ||
    err.status === 502 ||
    /network|ECONNRESET|ETIMEDOUT|socket hang up/i.test(msg)
  )
}

// ── sleep ─────────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// ── 核心：withPolicy ──────────────────────────────────────────────────────────

/**
 * 用 policy 层包装 provider adapter.stream，返回新的 async generator
 * @param {string} provider
 * @param {Function} streamFn  - adapter.stream(params) async generator factory
 * @param {object} params      - { messages, model, systemPrompt, signal }
 */
export async function* withPolicy(provider, streamFn, params) {
  // 并发限流
  if (activeRequests >= POLICY.maxConcurrency) {
    log('warn', provider, 'concurrency limit reached', { active: activeRequests, max: POLICY.maxConcurrency })
    yield { type: 'error', message: `Gateway busy: too many concurrent requests (max ${POLICY.maxConcurrency})` }
    return
  }

  activeRequests++
  const startTs = Date.now()
  log('info', provider, 'request start', { model: params.model })

  let attempt = 0
  let lastErr = null

  while (attempt <= POLICY.maxRetries) {
    if (attempt > 0) {
      const delay = POLICY.retryBaseMs * 2 ** (attempt - 1)
      log('warn', provider, 'retrying', { attempt, delayMs: delay, error: lastErr?.message })
      await sleep(delay)
    }

    try {
      // 超时控制：用独立 AbortController 包装，超时后 abort
      const timeoutAc = new AbortController()
      const timer = setTimeout(() => timeoutAc.abort(), POLICY.timeoutMs)

      // 合并外部 signal 和超时 signal
      const signal = params.signal
        ? anyAbort(params.signal, timeoutAc.signal)
        : timeoutAc.signal

      let usage = null
      let chunks = 0

      try {
        for await (const event of streamFn({ ...params, signal })) {
          if (event.type === 'chunk') chunks++
          if (event.type === 'usage') usage = event.usage
          yield event
          if (event.type === 'done' || event.type === 'error') break
        }
      } finally {
        clearTimeout(timer)
      }

      // 成功：记录 usage
      log('info', provider, 'request done', {
        durationMs: Date.now() - startTs,
        chunks,
        usage,
        attempt,
      })
      activeRequests--
      return

    } catch (err) {
      lastErr = err

      if (params.signal?.aborted) {
        log('info', provider, 'request aborted by client', { durationMs: Date.now() - startTs })
        activeRequests--
        return
      }

      if (err.name === 'AbortError' && !params.signal?.aborted) {
        // 超时
        log('warn', provider, 'request timeout', { timeoutMs: POLICY.timeoutMs, attempt })
        yield { type: 'error', message: `Request timed out after ${POLICY.timeoutMs}ms` }
        activeRequests--
        return
      }

      if (!isRetryable(err) || attempt >= POLICY.maxRetries) break
      attempt++
    }
  }

  // 重试耗尽
  log('error', provider, 'request failed', { error: lastErr?.message, attempts: attempt + 1 })
  yield { type: 'error', message: lastErr?.message || 'Unknown gateway error' }
  activeRequests--
}

// ── 工具：任意一个 signal abort 即触发 ────────────────────────────────────────

function anyAbort(...signals) {
  const ac = new AbortController()
  for (const s of signals) {
    if (s.aborted) { ac.abort(); break }
    s.addEventListener('abort', () => ac.abort(), { once: true })
  }
  return ac.signal
}
