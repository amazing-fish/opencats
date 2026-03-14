# Agent 默认配置 & History Alternating Turns 修复

Date: 2026-03-14

## 问题

### 问题 1：内置 agent 不可编辑
`BUILTIN_AGENTS` 带 `builtin: true` 标记，`CatNest.jsx` 用此标记隐藏编辑/删除按钮，`saveAgents` 也过滤掉内置 agent 不持久化。用户无法自定义布偶猫/缅因猫的 system prompt。

### 问题 2：多 agent 场景 history 违反 alternating turns
Anthropic API 要求 messages 数组 user/assistant 严格交替。多 agent 并发时，同一轮会产生多条连续 `assistant` 消息，导致 API 报错或 system prompt 被忽略。

## 方案

### 改动 1：移除 builtin 限制

**文件：`src/store/agentStore.js`**

- `BUILTIN_AGENTS` 去掉 `builtin: true` 字段
- `useAgentStore` 初始化：Redis 返回空数组时，用 `BUILTIN_AGENTS` 作为初始值并写入 Redis
- `saveAgents` 去掉 `filter(a => !a.builtin)`，所有 agent 全量持久化

`CatNest.jsx` 无需改动（`!agent.builtin` 条件因字段不存在自动为 true，编辑/删除按钮对所有 agent 显示）。

### 改动 2：合并连续 assistant 消息

**文件：`src/store/chatStore.js`**

history 构建时，将连续的 `assistant` 消息合并为一条：

```js
function mergeHistory(messages) {
  const merged = []
  for (const m of messages) {
    const last = merged[merged.length - 1]
    if (last?.role === 'assistant' && m.role === 'assistant') {
      last.content += '\n\n' + m.content
    } else {
      merged.push({ role: m.role, content: m.content })
    }
  }
  return merged
}
```

在 `sendMessage` 和 `triggerMentioned` 两处 history 构建后调用此函数。

## 影响范围

- `src/store/agentStore.js` — 移除 builtin 标记和过滤逻辑，加初始化写入
- `src/store/chatStore.js` — 加 `mergeHistory` 函数，两处调用
- `CatNest.jsx` — 无需改动
