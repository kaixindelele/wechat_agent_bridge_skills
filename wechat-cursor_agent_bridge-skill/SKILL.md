---
name: wechat-cursor-agent-bridge
description: >-
  微信 ↔ 本地 Claude Agent SDK（与 Cursor 同款工具/权限模型）桥接：支持文字、图片、文件收发；
  微信端用数字 1/2/3 或关键词确认工具权限。在用户提到微信桥接 Cursor、远程批权限、微信控制
  agent、ilink ClawBot 与 Claude Agent SDK 联调时使用。
---

# 微信 ↔ Cursor 侧 Claude Agent 桥接

用微信连接 **本机运行的 Claude Agent SDK** 进程（与 Cursor / Claude Code 同源工具与权限语义）。你在 Cursor 里熟悉的「工具权限 / 会话 / 项目目录」可与本桥接对齐：将 `bridge.config.json` 的 `cwd` 设为 Cursor 工作区根目录，并按需开启 `settingSources: ["project"]` 以加载 `.claude/`、`CLAUDE.md` 与项目技能。

如需在全局 Cursor 对话中被自动召回，可将本目录下的 `SKILL.md` 复制到 `~/.cursor/skills/wechat-cursor-agent-bridge/SKILL.md`（与路径中的 `bridge` 拼写无关，技能名以 frontmatter 为准）。

如果需要修改和微信桥接的功能代码，可以参考wechat_agent_bridge_skills/openclaw-weixin的原版SDK通信协议和逻辑。

## 目录说明

| 路径 | 作用 |
|------|------|
| `templates/` | 可独立运行的 Node 桥接服务（npm 安装依赖后 `npm run setup` / `npm start`） |
| `templates/src/ilink.ts` | 微信 ilink（ClawBot）HTTP API：收发消息、媒体加解密 |
| `templates/src/bridge.ts` | 主循环：`getupdates` + `query()` + `canUseTool` 微信确认 |
| `templates/bridge.config.example.json` | 配置模板，复制为 `bridge.config.json` |

## ilink 层与 Tencent openclaw-weixin 对齐

`templates/src/ilink.ts` 已与官方 SDK 行为对齐（对照 `openclaw-weixin/` 与上游 [Tencent/openclaw-weixin](https://github.com/Tencent/openclaw-weixin)）：

- 请求头：`iLink-App-Id`（`package.json` 顶层 `ilink_appid`，当前为 `bot`）、`iLink-App-ClientVersion`（由桥接包 `version` 计算 0x00MMNNPP）、`X-WECHAT-UIN`（`crypto.randomBytes`）。
- `base_info.channel_version`：使用本桥接 `package.json` 的 `version` 字段（与 openclaw 使用其自身 npm 版本一致）。
- CDN 下载：`{cdnBaseUrl}/download?encrypted_query_param=...`（不再把 `encrypt_query_param` 当作整段 query 拼在主机名后）。
- 长轮询：`getupdates` 客户端超时返回 `ret: 0, msgs: []` 并保留 `get_updates_buf`。
- 扫码：`scaned_but_redirect` 时切换 `redirect_host` 轮询；网络错误时轮询返回 `wait` 并重试。
- 可选：若需多地域路由标签，设置环境变量 `ILINK_SK_ROUTE_TAG`（对应 openclaw 的 `SKRouteTag`）。

## 前置条件

- Node.js ≥ 18
- `ANTHROPIC_API_KEY`（或 Bedrock / Vertex 等 SDK 支持的认证方式）
- 微信侧已完成 ClawBot / ilink 机器人绑定（通过 `npm run setup` 扫码完成）

## 安装与启动（由 Agent 执行）

```bash
cd wechat-cursor_agent_bridge-skill/templates
cp bridge.config.example.json bridge.config.json
# 编辑 bridge.config.json：至少设置 cwd 为 Cursor 项目根目录
npm install
npm run setup    # 扫码，生成 credentials.json
npm start        # 启动桥接
```

## 微信端：权限确认（核心）

当 Agent 请求执行敏感工具时，你会收到一条带说明的权限消息。在 **同一会话** 中回复以下任一形式：

| 回复 | 含义 |
|------|------|
| `1` / `y` / `yes` / `允许` / `好` / `ok` | 允许**本次**工具执行 |
| `2` / `n` / `no` / `拒绝` / `否` | **跳过**本次操作，Agent 继续后续工作 |
| `3` / `always` / `始终允许` | 允许本次，并应用 SDK 给出的**权限建议**（`updatedPermissions`） |
| 任意其他文本 | **跳过**本次操作 + 将你的文本作为指示传递给 Agent |

### 拒绝行为：跳过 vs 终止

- **普通危险操作**（匹配 `dangerousCommandPatterns`）：拒绝后**仅跳过当前操作**，Agent 继续执行其余任务。
- **关键危险操作**（匹配 `criticalCommandPatterns`，如 `rm -rf /`、`sudo rm`、`mkfs`、`dd if=`）：拒绝后**终止整个 Agent**，因为此类操作不可安全跳过。

### 自由文本指示

等待权限时，你可以直接发送任意文本（不限于数字）。该文本会被视为"拒绝当前操作"，同时你的文字会作为追问写入 `.bridge-followup.md`，Agent 可在后续执行中读取并参考。

超时未回复：普通操作自动**跳过**，关键操作自动**终止**（时长见 `dangerousCommandTimeoutMs`）。

## 微信端：文字 / 图片 / 文件

- **文字**：直接发送。
- **图片**：下载解密后作为多模态内容随用户消息提交给 Agent。
- **文件 / 语音 / 视频**：保存到本地缓存目录，并在提示中附带路径，供 Agent 用 Read 等工具打开。

体量过大的回复会按 `maxMessageLength` **分条**推送。

## 微信端指令

- `/help` — 简要说明
- `/clear` — 清除该用户本地保存的会话续接 ID（下一轮为新会话）
- `/stop` — 终止当前任务，继续处理队列
- `/stopall` — 终止当前任务 + 清空队列 + 追问
- `/send <路径>` — 发送服务器上的文件到微信
- `/model` — 查看当前模型（下列子命令均可在对话中使用）
  - `/model list` — 列出 Cursor CLI 当前账号可用的全部模型（按 auto / Claude / GPT / Composer / Gemini 家族分组，并标出"当前"与"默认"）
  - `/model search <关键词>` — 模糊搜索（按 slug / 显示名）
  - `/model <slug>` — 切换模型：内部调 `agent --list-models` 校验后，更新内存 `cfg.model` 并**写回** `bridge.config.json`，下一轮 agent 调用生效
  - `/model <slug> !` — 跳过校验强制切换（拿到新模型但本地缓存尚未更新时用）
  - `/model clear` — 恢复 Cursor 默认模型（把 `model` 字段清空）
  - `/model refresh` — 强制刷新本地模型缓存（默认 TTL 5 分钟）

## 与 Cursor 的关系

- 本 skill **不嵌入 Cursor IDE 进程**，而是独立 Node 进程调用 **Claude Agent SDK**，工具与权限模型与 Cursor / Claude Code 一致，适合「手机微信审批、PC 上仍用 Cursor 打开同一仓库」的用法。
- 本地 **Cursor CLI** 的 `approvalMode`、`cli-config.json` 仅影响 CLI 本体，**不**自动同步到本桥接；桥接的权限以本服务内的 `permissionMode` + 微信对 `canUseTool` 的回复为准。

## 故障排查

- 无回复：检查 `ANTHROPIC_API_KEY`、网络、以及 `cwd` 是否存在且可读写。
- 权限总被拒绝：确认 `permissionMode` 不是 `dontAsk` / `plan` 等导致无需用户同意的策略与预期不符；需要最严格人工卡口时用 `default`。
- `bypassPermissions`：必须在配置中同时设 `allowDangerouslySkipPermissions: true`（见 `bridge.config.example.json`）。

## 附加资源

- 微信 API 层参考：`templates/src/ilink.ts` 或上游 [Tencent/openclaw-weixin](https://github.com/Tencent/openclaw-weixin)
- Claude Agent SDK 权限：[Agent SDK permissions](https://docs.claude.com/en/docs/agent-sdk/permissions)
