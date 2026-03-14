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

// ── 合并多个 AbortSignal ──────────────────────────────────────────────────────

function anyAbort(...signals) {
  const ac = new AbortController()
  for (const s of signals) {
    if (s.aborted) { ac.abort(); break }
    s.addEventListener('abort', () => ac.abort(), { once: true })
  }
  return ac.signal
}

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

  // finally 块保证无论何种退出路径都释放计数
  try {
    let attempt = 0
    let lastErr = null

    while (attempt <= POLICY.maxRetries) {
      if (attempt > 0) {
        const delay = POLICY.retryBaseMs * 2 ** (attempt - 1)
        log('warn', provider, 'retrying', { attempt, delayMs: delay, error: lastErr?.message })
        await sleep(delay)
      }

      // 客户端已断开，不再重试
      if (params.signal?.aborted) {
        log('info', provider, 'request aborted by client', { durationMs: Date.now() - startTs })
        return
      }

      const timeoutAc = new AbortController()
      const timer = setTimeout(() => timeoutAc.abort(), POLICY.timeoutMs)
      const signal = params.signal
        ? anyAbort(params.signal, timeoutAc.signal)
        : timeoutAc.signal

      let usage = null
      let chunks = 0
      let yieldedError = null  // adapter 以 event 形式 yield 的错误
      let timedOut = false

      try {
        for await (const event of streamFn({ ...params, signal })) {
          if (event.type === 'chunk') chunks++
          if (event.type === 'usage') usage = event.usage

          if (event.type === 'error') {
            // 把 yielded error 转为内部错误，走 retry 判断，保留 status 供 isRetryable() 使用
            yieldedError = Object.assign(new Error(event.message || 'provider error'), { status: event.status })
            break
          }

          yield event
          if (event.type === 'done') break
        }
      } finally {
        clearTimeout(timer)
        // 超时：timeoutAc 已 abort 但客户端未 abort
        if (timeoutAc.signal.aborted && !params.signal?.aborted) {
          timedOut = true
        }
      }

      // 客户端主动断开
      if (params.signal?.aborted) {
        log('info', provider, 'request aborted by client', { durationMs: Date.now() - startTs })
        return
      }

      // 超时
      if (timedOut) {
        log('warn', provider, 'request timeout', { timeoutMs: POLICY.timeoutMs, attempt })
        lastErr = Object.assign(new Error(`Request timed out after ${POLICY.timeoutMs}ms`), { _timeout: true })
        // 超时不重试（流式请求不幂等）
        yield { type: 'error', message: lastErr.message }
        return
      }

      // adapter yielded error → 判断是否可重试
      // 只有在尚未向客户端发出任何 chunk 时才重试，避免重复/损坏输出
      if (yieldedError) {
        lastErr = yieldedError
        if (isRetryable(yieldedError) && attempt < POLICY.maxRetries && chunks === 0) {
          attempt++
          continue
        }
        log('error', provider, 'request failed', { error: lastErr.message, attempts: attempt + 1, chunks })
        yield { type: 'error', message: lastErr.message }
        return
      }

      // 成功
      log('info', provider, 'request done', {
        durationMs: Date.now() - startTs,
        chunks,
        usage,
        attempt,
      })
      return
    }

    // 重试耗尽（thrown error 路径）
    log('error', provider, 'request failed', { error: lastErr?.message, attempts: attempt + 1 })
    yield { type: 'error', message: lastErr?.message || 'Unknown gateway error' }

  } catch (err) {
    if (params.signal?.aborted) {
      log('info', provider, 'request aborted by client', { durationMs: Date.now() - startTs })
      return
    }
    log('error', provider, 'unexpected error', { error: err.message })
    yield { type: 'error', message: err.message }
  } finally {
    activeRequests--
  }
}
