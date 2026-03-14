# OpenCats

> 人类在环的 Multi-Agents 协作工具 — 多个 AI 同时响应同一问题，可视化对比结果，支持链式协作。

---

## 一句话定位

把多个智能体像小型研发团队一样协作落到工程现实：**可接入主流模型供应商、可视化协作、@mention 路由、会话持久化、可在浏览器中一键启动**。

---

## 当前实现状态

### 已完成

| 模块 | 说明 |
|------|------|
| 多 Agent 并发对话 | 同一条消息同时发给多个 AI，并排流式展示回复 |
| @mention 路由 | AI 回复中 `@name` 自动触发目标 Agent 响应，支持链式协作 |
| 会话持久化 | Redis 存储全量会话，刷新不丢失，UUID 防冲突 |
| 自定义 Agent | 可配置任意 Claude / Codex 模型、system prompt、API Key |
| 流式输出 + 停止 | 实时显示 token，支持随时中断所有 Agent |
| Token 统计 | 每条回复显示 input/output token 用量 |
| Bridge 中转 | 前端不直连 AI API，全部经由本地 Express bridge |

### 待完成（P1）

| # | 问题 |
|---|------|
| P1-1 | API Key 目前仍可通过前端 bundle 读取，需移入 bridge `process.env` |
| P1-3 | streaming 期间每 chunk 触发 Redis 写入，需防抖至 `onDone` 时写 |

---

## 架构

```
浏览器 (Vite + React + Tailwind)
         ↕  fetch / SSE
bridge/server.js  (Express :4891)
         ↕
  Redis :6379          Anthropic API
  cat-cafe:conversations    /v1/messages
  cat-cafe:agents
         ↕
  codex.exe  (OpenAI Codex CLI，可选)
```

- 前端唯一状态源：`useChatStore` + `useAgentStore`（无 Zustand/Redux）
- Bridge 是唯一外部通信出口，持有 API Key
- 会话 ID 全部使用 `crypto.randomUUID()`

---

## 快速开始

### 依赖

| 依赖 | 说明 |
|------|------|
| Node.js 18+ | 前端 + bridge |
| Redis | WSL 内运行：`wsl redis-server --daemonize yes`，监听 `127.0.0.1:6379` |
| codex.exe | 可选，OpenAI Codex CLI，路径由 `CODEX_EXE_PATH` 环境变量指定 |

### 安装

```bash
npm install
cd bridge && npm install && cd ..
```

### 配置

```bash
cp .env.example .env
```

编辑 `.env`：

```env
VITE_CLAUDE_API_KEY=sk-ant-xxxxxxxx
VITE_CLAUDE_BASE_URL=https://api.anthropic.com
VITE_CODEX_BRIDGE_URL=http://localhost:4891

# 可选：指定 codex.exe 路径
# CODEX_EXE_PATH=C:\path\to\codex.exe
```

### 启动

```bash
npm run dev
```

同时启动 bridge（`:4891`）和 Vite 开发服务器（`:5173`）。

---

## 内置 Agent

| Agent | 模型 | Provider |
|-------|------|----------|
| 布偶猫 | claude-sonnet-4-6 | Anthropic API |
| 缅因猫 | gpt-5.4 | Codex CLI（本地） |

在右侧边栏可添加、编辑、删除 Agent，配置项包括：模型 ID、API Key、Base URL、System Prompt。

---

## 消息路由

- **广播**：默认向当前会话所有 Agent 发送
- **@mention**：在消息或 AI 回复中写 `@AgentName`，自动触发该 Agent 响应
- **链式协作**：Agent A 回复中 @mention Agent B，Agent B 自动接力，形成 Planner → Executor → Reviewer 等协作链路

---

## 目录结构

```
src/
  agents/
    claudeCodeAgent.js   # Anthropic API 流式请求封装
    codexAgent.js        # Codex CLI SSE 封装
  components/
    Sidebar.jsx          # 会话列表
    MainChatArea.jsx     # 消息流展示
    ChatInput.jsx        # 输入框
    RightSidebar.jsx     # Agent 管理面板
    NewChatModal.jsx     # 新建会话
    Messages.jsx         # 消息渲染（Markdown）
    CatNest.jsx          # Agent 状态展示
  store/
    chatStore.js         # 会话 / 消息 / 流式状态
    agentStore.js        # Agent 配置管理
bridge/
  server.js              # Express 桥接，spawn codex.exe，Redis 读写
```

---

## 技术栈

- 前端：Vite + React 18 + Tailwind CSS + marked + DOMPurify
- Bridge：Node.js + Express + ioredis
- 存储：Redis（会话 + Agent 配置）
- AI：Anthropic API（SSE）/ OpenAI Codex CLI（子进程 + JSON 流）

---

## License

MIT
