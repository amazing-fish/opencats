# Issue 45 Streaming Timeout Semantics Implementation Plan

> **For AI:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove gateway-level wall-clock stream timeout semantics and make successful completion depend on explicit provider `done` signals instead of implicit stream closure.

**Architecture:** The fix stays within the existing gateway/provider/frontend pipeline. The gateway policy layer stops defining business-level stream failure based on total elapsed time, provider adapters become responsible for explicit success/error terminal events, and the frontend only treats a request as successful when it sees an explicit `done` event. Tests cover all affected exit paths so timeout removal does not silently weaken abnormal-exit detection.

**Tech Stack:** Node.js, Express SSE, async generators, React frontend fetch streaming, node:test

---

### Task 1: Lock The Current Failure Modes With Tests

**Files:**
- Modify: `D:\Develop\Project\claudecode\newtry\opencats\tests\auth.test.js` (do not touch)
- Create: `D:\Develop\Project\claudecode\newtry\opencats\tests\policy.test.js`
- Create: `D:\Develop\Project\claudecode\newtry\opencats\tests\gatewayAgent.test.js`
- Create: `D:\Develop\Project\claudecode\newtry\opencats\tests\codex-provider.test.js`

**Step 1: Write the failing policy test**

```js
it('does not emit timeout error solely because elapsed wall-clock time exceeds the old gateway limit', async () => {
  process.env.GATEWAY_TIMEOUT_MS = '50'
  const events = []
  for await (const event of withPolicy('demo', providerAwareSlowStream, { model: 'm' })) {
    events.push(event)
  }
  assert.deepEqual(events, [{ type: 'chunk', text: 'partial' }])
})
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/policy.test.js`
Expected: FAIL because current implementation appends `Request timed out after 50ms`

**Step 3: Write the failing codex abnormal-exit test**

```js
it('yields error instead of done when codex process exits non-zero', async () => {
  // stub child_process.spawn and feed a close(1) without turn.completed success marker
})
```

**Step 4: Run test to verify it fails**

Run: `node --test tests/codex-provider.test.js`
Expected: FAIL because current provider emits `done` on any close

**Step 5: Write the failing frontend completion test**

```js
it('does not call onDone when the SSE stream closes without an explicit done event', async () => {
  // stub fetch to return one chunk and then EOF
})
```

**Step 6: Run test to verify it fails**

Run: `node --test tests/gatewayAgent.test.js`
Expected: FAIL because current implementation calls `onDone` after EOF

### Task 2: Remove Gateway-Level Business Timeout Semantics

**Files:**
- Modify: `D:\Develop\Project\claudecode\newtry\opencats\bridge\policy.js`
- Test: `D:\Develop\Project\claudecode\newtry\opencats\tests\policy.test.js`

**Step 1: Implement minimal policy change**

```js
// remove timeoutAc/timedOut branch from withPolicy
// keep client abort handling, concurrency limiting, and retry-on-yielded-error-before-chunks
```

**Step 2: Run focused test**

Run: `node --test tests/policy.test.js`
Expected: PASS

**Step 3: Run broader affected tests**

Run: `node --test tests/policy.test.js tests/codex-provider.test.js`
Expected: existing provider semantics tests still show the remaining failing codex case only

### Task 3: Tighten Provider Terminal Semantics

**Files:**
- Modify: `D:\Develop\Project\claudecode\newtry\opencats\bridge\providers\codex.js`
- Optionally inspect only: `D:\Develop\Project\claudecode\newtry\opencats\bridge\providers\claude.js`
- Test: `D:\Develop\Project\claudecode\newtry\opencats\tests\codex-provider.test.js`

**Step 1: Write minimal codex fix**

```js
child.on('close', (code) => {
  if (!signal?.aborted) {
    if (code === 0) push({ type: 'done' })
    else push({ type: 'error', message: `codex exited with code ${code}` })
  }
  closed = true
  emitter.emit('data')
})
```

**Step 2: Run provider test**

Run: `node --test tests/codex-provider.test.js`
Expected: PASS

**Step 3: Run regression test on existing auth-related suite only if touched indirectly**

Run: `node --test tests/codex-provider.test.js tests/policy.test.js`
Expected: PASS

### Task 4: Require Explicit `done` On The Frontend

**Files:**
- Modify: `D:\Develop\Project\claudecode\newtry\opencats\src\agents\gatewayAgent.js`
- Test: `D:\Develop\Project\claudecode\newtry\opencats\tests\gatewayAgent.test.js`

**Step 1: Implement minimal frontend fix**

```js
let sawDone = false
// ...
if (json.type === 'done') {
  sawDone = true
  stopReading = true
}
// ...
if (!sawDone) throw new Error('Stream terminated without explicit done event')
onDone?.(fullText, usage)
```

**Step 2: Run frontend test**

Run: `node --test tests/gatewayAgent.test.js`
Expected: PASS

**Step 3: Re-run combined stream semantics tests**

Run: `node --test tests/policy.test.js tests/codex-provider.test.js tests/gatewayAgent.test.js`
Expected: PASS

### Task 5: Verify End-To-End Impact And Update Validation Surface

**Files:**
- Modify: `D:\Develop\Project\claudecode\newtry\opencats\package.json`
- Optionally create/update: `D:\Develop\Project\claudecode\newtry\opencats\tests\stream-semantics.test.js`
- Inspect only: `D:\Develop\Project\claudecode\newtry\opencats\tests\smoke.test.js`

**Step 1: Add targeted test script only if it materially improves workflow**

```json
"test:stream": "node --test tests/policy.test.js tests/codex-provider.test.js tests/gatewayAgent.test.js"
```

**Step 2: Run final verification**

Run: `npm run build`
Expected: PASS

Run: `node --test tests/policy.test.js tests/codex-provider.test.js tests/gatewayAgent.test.js`
Expected: PASS

Run: `npm run test:smoke`
Expected: PASS if local CLIs are available; otherwise document exact blocker and observed output

**Step 3: Commit**

```bash
git add bridge/policy.js bridge/providers/codex.js src/agents/gatewayAgent.js tests/policy.test.js tests/codex-provider.test.js tests/gatewayAgent.test.js package.json docs/plans/2026-03-20-issue-45-streaming-timeout-semantics.md
git commit -m "fix: tighten streaming completion semantics"
```
