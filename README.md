# OpenCats

> 人类在环的 Multi-Agents 协作工具 — 多个 AI 同时响应同一问题，可视化对比结果，支持链式协作。

---

## 一句话定位

把多个智能体像小型研发团队一样协作落到工程现实：**可视化协作、@mention 路由、会话持久化、可在浏览器中一键启动**。当前内置 Claude 和 Codex 两个 provider，Claude 内置 agent 通过本地 Claude Code CLI 运行；自定义 Claude agent 支持三种认证方式（CLI 登录态 / Anthropic API Key / Bearer Token）和可选 Base URL；Codex provider 通过本地 CLI 调用，不支持自定义凭据。

---

## 当前实现状态

### 已完成

| 模块 | 说明 |
|------|------|
| 多 Agent 并发对话 | 同一条消息同时发给多个 AI，并排流式展示回复 |
| @mention 路由 | AI 回复中 `@name` 自动触发目标 Agent 响应，支持链式协作 |
| 会话持久化 | Redis 存储全量会话，刷新不丢失，UUID 防冲突 |
| 自定义 Agent | 可配置模型 ID、System Prompt；Claude provider 额外支持认证方式选择（CLI 登录态 / API Key / Bearer Token）和 Base URL，凭据仅存 bridge Redis，不回传前端；Codex provider 通过本地 CLI 调用，不支持自定义凭据 |
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
| Claude Code CLI | 内置 Claude agent 必需；安装后执行 `claude login`；或通过 `CLAUDE_EXE_PATH` 指定路径 |
| codex.exe | 可选，OpenAI Codex CLI，路径由 `CODEX_EXE_PATH` 环境变量指定 |

### 安装

```bash
npm install
cd bridge && npm install && cd ..
```

### 配置

`.env` 仅供 Vite 前端读取（`VITE_*` 变量）。bridge 侧变量需通过 shell 环境变量传入（`export` 或在启动命令前设置）。

```bash
cp .env.example .env
```

`.env`（Vite 前端变量）：

```env
VITE_CODEX_BRIDGE_URL=http://localhost:4891
```

bridge 侧 shell 环境变量（可选）：

```bash
# Claude CLI 路径（默认使用 PATH 中的 claude）
export CLAUDE_EXE_PATH=C:\path\to\claude.exe

# Codex CLI 路径
export CODEX_EXE_PATH=C:\path\to\codex.exe
```

内置 Claude agent 默认使用本地 `claude login` 登录态，无需额外配置。自定义 agent 的凭据（API Key 或 Bearer Token）在 UI 中单独配置，存 Redis，不经过环境变量。

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

在右侧边栏可添加、编辑、删除 Agent，配置项包括：模型 ID、System Prompt。Claude Code provider 额外支持认证方式选择和 Base URL（可选）：

| 认证方式 | 说明 | CLI 环境变量 |
|---------|------|-------------|
| CLI 登录态（默认） | 使用本地 `claude login` 凭据 | 无需配置 |
| Anthropic API Key | 直连 Anthropic API 或兼容网关 | `ANTHROPIC_API_KEY` |
| Bearer Token | 使用 `Authorization: Bearer` header 认证（适用于需要 bearer auth 的网关） | `ANTHROPIC_AUTH_TOKEN` |

凭据仅存 bridge Redis，不回传前端。Codex provider 通过本地 CLI 调用，不支持自定义凭据。

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
