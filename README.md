# OpenCats

> 人类在环的 Multi-Agents 协作工具 — 多个 AI 同时响应同一问题，可视化对比结果，支持链式协作。

---

## 一句话定位

把多个智能体像小型研发团队一样协作落到工程现实：**可视化协作、@mention 路由、会话持久化、可在浏览器中一键启动**。当前内置 Claude 和 Codex 两个 provider，Claude 内置 agent 通过本地 Claude Code CLI 运行；Claude-compatible backend 支持为每个自定义 Agent 配置独立的 baseUrl / apiKey；Codex provider 通过本地 CLI 调用，不支持自定义凭据。

---

## 当前实现状态

### 已完成

| 模块 | 说明 |
|------|------|
| 多 Agent 并发对话 | 同一条消息同时发给多个 AI，并排流式展示回复 |
| @mention 路由 | AI 回复中 `@name` 自动触发目标 Agent 响应，支持链式协作 |
| 会话持久化 | Redis 存储全量会话，刷新不丢失，UUID 防冲突 |
| 自定义 Agent | 可配置模型 ID、System Prompt；Claude provider 额外支持 baseUrl / apiKey（仅存 bridge Redis，不回传前端），留空则使用本地 Claude Code CLI 登录态；Codex provider 通过本地 CLI 调用，不支持自定义凭据 |
| 流式输出 + 停止 | 实时显示 token，支持随时中断所有 Agent |
| Token 统计 | 每条回复显示 input/output token 用量 |
| Bridge 中转 | 前端不直连 AI API，全部经由本地 Express bridge |

### 待完成（P1）

| # | 问题 |
|---|------|
| #16 | @mention 链式调用无循环保护，可能无限触发 |

---

## 架构

```
浏览器 (Vite + React + Tailwind)
         ↕  fetch / SSE  (localhost:4891, local token auth)
bridge/server.js  (Express :4891)
         ↕                    ↕
  Redis :6379          gateway.js + policy.js
  cat-cafe:conversations    ↕              ↕
  cat-cafe:agents    providers/claude.js  providers/codex.js
                          ↕                    ↕
                    Claude Code CLI        codex.exe (本地)
                    (本地子进程)
```

- 前端唯一状态源：`useChatStore` + `useAgentStore`（无 Zustand/Redux）
- Bridge 是唯一外部通信出口，API Key 仅在 bridge `process.env` 或 Redis（per-agent）中，不进前端 bundle
- 会话 ID 全部使用 `crypto.randomUUID()`
- `/gateway/stream` 等 AI 路由及 `/conversations`、`/agents` 数据路由均受 local token 鉴权保护

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
VITE_CODEX_BRIDGE_URL=http://localhost:4891

# 可选：指定 codex.exe 路径
# CODEX_EXE_PATH=C:\path\to\codex.exe

# 可选：内置 Claude agent 默认使用本地 Claude Code CLI 登录态（claude login）
# 如需为自定义 Claude-compatible agent 指定默认 API Key，可在此设置
# CLAUDE_API_KEY=sk-ant-xxxxxxxx
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
| 布偶猫 | claude-sonnet-4-6 | Claude Code CLI（本地） |
| 缅因猫 | gpt-5.4 | Codex CLI（本地） |

在右侧边栏可添加、编辑、删除 Agent，配置项包括：模型 ID、System Prompt。Claude-compatible provider 额外支持 Base URL（可选）和 API Key（可选），API Key 仅存 bridge Redis，不回传前端，留空则使用本地 Claude Code CLI 登录态；Codex provider 通过本地 CLI 调用，不支持自定义凭据。

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
    gatewayAgent.js      # 统一 gateway SSE 封装（所有 provider 共用）
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
  server.js              # Express 桥接，Redis 读写，local token 鉴权
  gateway.js             # Provider 路由，SSE 输出
  policy.js              # 超时 / 重试 / 限流 / 日志
  providers/
    claude.js            # Claude Code CLI 适配器（本地子进程）
    codex.js             # Codex CLI 适配器
```

---

## 技术栈

- 前端：Vite + React 18 + Tailwind CSS + marked + DOMPurify
- Bridge：Node.js + Express + ioredis
- 存储：Redis（会话 + Agent 配置）
- AI：Claude Code CLI（本地子进程 + JSON 流）/ OpenAI Codex CLI（子进程 + JSON 流）

---

## License

MIT
