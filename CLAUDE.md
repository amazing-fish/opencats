# Cat Cafe — 项目指南

## 产品定位

本地多 Agent 协作 IDE 助手。核心价值：多个 AI 同时响应同一问题，用户对比结果。

## 架构概览

```
前端 (Vite + React + Tailwind)  ←→  bridge/server.js (Express :4891)  ←→  Redis / codex.exe / Anthropic API
                                         └── gateway.js (统一 provider 路由)
                                               ├── providers/claude.js
                                               └── providers/codex.js
```

- 前端不直连任何 AI API，全部经由 bridge 中转
- 前端只调用 `src/agents/gatewayAgent.js`，不含任何 provider-specific 逻辑
- bridge `POST /gateway/stream` 是唯一 AI 请求入口，provider 差异收敛在 `bridge/providers/`
- `useChatStore` 是唯一状态源，无 Zustand/Redux
- Redis key: `cat-cafe:conversations`，存全量会话 JSON

## 不可漂移的红线

1. **API Key 永远不进前端 bundle** — Claude/OpenAI key 只在 bridge `process.env` 中读取
2. **会话 ID 永远用 `crypto.randomUUID()`** — 禁止自增整数，刷新后会冲突
3. **Redis 写入必须防抖** — 不在 streaming chunk 期间逐次写，至少 500ms 防抖或仅在 `onDone`/`stopAll` 时写
4. **bridge 是唯一外部通信出口** — 前端只 fetch `localhost:4891`

## 环境依赖

| 依赖 | 说明 |
|------|------|
| Redis | WSL 内运行，`wsl redis-server --daemonize yes`，监听 `127.0.0.1:6379` |
| codex.exe | 路径由 `CODEX_EXE_PATH` 环境变量指定，或修改 `bridge/server.js:38` |
| `.env` | 复制 `.env.example`，填入 `CLAUDE_API_KEY`（bridge 侧，不进前端） |

启动：`npm run dev`（同时启动 bridge + Vite）

## 已知 P1 问题状态

| # | 问题 | 状态 |
|---|------|------|
| P1-1 | API Key 暴露在前端 bundle | ✅ 已修复（Key 移入 bridge process.env，Redis 过滤敏感字段） |
| P1-2 | 会话 ID 自增，刷新后冲突 | ✅ 已修复（UUID） |
| P1-3 | streaming 期间频繁写 Redis | ✅ 已修复（600ms 防抖，conversations 变化时写） |
| P1-4 | sendMessage 闭包快照导致历史丢失 | ✅ 已修复（activeIdRef 同步读取） |
| P1-5 | codex bridge 丢弃多轮上下文 | ✅ 已修复（历史拼接） |

## 演进路径

```
当前（MVP）
  多 Agent 并发对话 ✓ / Redis 持久化 ✓ / 停止切换会话 ✓
  统一 provider gateway ✓ / bridge-only auth ✓ / CORS + token 鉴权 ✓
  gateway policy 层（timeout / retry / concurrency / logging）✓

下一步
  issue #9 follow-up: gateway policy 进一步完善（per-provider 策略差异）
  Agent 工作目录隔离（每会话独立 cwd）

未来
  消息导出（Markdown/JSON）
  Agent 自定义 system prompt
  Codex 原生多轮 API 支持
```

## 目录结构

```
src/
  agents/         # gatewayAgent.js — 唯一前端 provider 请求入口
  components/     # UI 组件
  store/          # chatStore.js — 唯一状态源
bridge/
  server.js       # Express 桥接，持有 API Key，token 鉴权
  gateway.js      # 统一 provider 路由
  providers/      # claude.js / codex.js — provider adapter
```
