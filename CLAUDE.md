# Cat Cafe — 项目指南

## 产品定位

本地多 Agent 协作 IDE 助手。核心价值：多个 AI 同时响应同一问题，用户对比结果。

## 架构概览

```
前端 (Vite + React + Tailwind)  ←→  bridge/server.js (Express :4891)  ←→  Redis / codex.exe / Claude Code CLI
                                         └── gateway.js (统一 provider 路由)
                                               ├── providers/claude.js  → Claude Code CLI（本地子进程）
                                               └── providers/codex.js   → codex.exe（本地子进程）
```

- 前端不直连任何 AI API，全部经由 bridge 中转
- 前端只调用 `src/agents/gatewayAgent.js`，不含任何 provider-specific 逻辑
- bridge `POST /gateway/stream` 是唯一 AI 请求入口，provider 差异收敛在 `bridge/providers/`
- `useChatStore` 是唯一状态源，无 Zustand/Redux
- Redis key: `cat-cafe:conversations`，存全量会话 JSON

## 不可漂移的红线

1. **API Key 永远不进前端 bundle** — Claude/OpenAI key 只在 bridge `process.env` 或 Redis（per-agent 凭据）中读取；`GET /agents` 永远 strip 凭据字段，不回传前端
2. **会话 ID 永远用 `crypto.randomUUID()`** — 禁止自增整数，刷新后会冲突
3. **Redis 写入必须防抖** — 不在 streaming chunk 期间逐次写，至少 500ms 防抖或仅在 `onDone`/`stopAll` 时写
4. **bridge 是唯一外部通信出口** — 前端只 fetch `localhost:4891`

## 环境依赖

| 依赖 | 说明 |
|------|------|
| Redis | WSL 内运行，`wsl redis-server --daemonize yes`，监听 `127.0.0.1:6379` |
| Claude Code CLI | `claude` 命令需在 PATH，或通过 `CLAUDE_EXE_PATH` 环境变量指定；默认使用本地登录态（`claude login`），per-agent 可通过 Redis 中的 `authType` 选择认证方式（API Key / Bearer Token / CLI 登录态） |
| codex.exe | 路径由 `CODEX_EXE_PATH` 环境变量指定 |
| `.env` | 复制 `.env.example`；内置 Claude agent 默认走本地 CLI 登录态，无需 `CLAUDE_API_KEY` |

启动：`npm run dev`（同时启动 bridge + Vite）

## 已知问题状态

| # | 问题 | 状态 |
|---|------|------|
| P1-1 | API Key 暴露在前端 bundle | ✅ 已修复（Key 移入 bridge process.env，Redis 过滤敏感字段） |
| P1-2 | 会话 ID 自增，刷新后冲突 | ✅ 已修复（UUID） |
| P1-3 | streaming 期间频繁写 Redis | ✅ 已修复（600ms 防抖，conversations 变化时写） |
| P1-4 | sendMessage 闭包快照导致历史丢失 | ✅ 已修复（activeIdRef 同步读取） |
| P1-5 | codex bridge 丢弃多轮上下文 | ✅ 已修复（历史拼接） |
| #14 | bridge 绑定所有接口，local token 可被 LAN 绕过 | ✅ 已修复（loopback bind） |
| #15 | `/conversations` / `/agents` 无鉴权 | ✅ 已修复（local token auth） |
| #17 | 自定义 Agent 无法配置 baseUrl / apiKey | ✅ 已修复（per-agent 后端连接支持） |
| #18 | bridge 不可用时无明确错误提示 | ✅ 已修复（全屏错误横幅 + 重试） |
| #23 | @mention token 泄漏进 provider prompt | ✅ 已修复（stripMentions） |
| #33 | claude provider 实现与本地 agent 架构不符 | ✅ 已修复（CLI 后端替换） |
| #36 | Claude CLI provider stdin 未关闭导致所有请求 timeout | ✅ 已修复（child.stdin.end()） |
| #37 | 内置 agent e2e smoke test | ✅ 已修复（node:test + gateway SSE 验证） |
| #43 | claudecode 自定义 agent auth 仅支持 Anthropic apiKey | ✅ 已修复（authType 枚举 + bearer-token 支持） |
| #16 | @mention 链式调用无循环保护 | 🔴 待修复 |

## 演进路径

```
当前（MVP）
  多 Agent 并发对话 ✓ / Redis 持久化 ✓ / 停止切换会话 ✓
  统一 provider gateway ✓
  gateway policy 层（timeout / retry / concurrency / logging）✓
  bridge auth 加固（loopback bind ✓、数据路由 token 鉴权 ✓）
  per-agent 自定义后端连接（authType 认证方式选择 + baseUrl，Claude provider）✓
  bridge 不可用错误提示 + 重试 ✓
  @mention token 不泄漏进 provider prompt ✓
  Claude provider 替换为本地 Claude Code CLI 后端 ✓
  内置 agent e2e smoke test ✓
  自定义 agent auth model 扩展（bearer-token 支持）✓

下一步
  @mention 链式调用循环保护（issue #16）
  Agent 工作目录隔离（每会话独立 cwd）
  消息导出（Markdown/JSON）

未来
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
