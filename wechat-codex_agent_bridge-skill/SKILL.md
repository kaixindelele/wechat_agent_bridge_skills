---
name: wechat-codex-agent-bridge
description: >-
  微信 ↔ 本地 OpenAI Codex CLI 桥接：支持文字、图片、文件收发、会话续接、微信侧切换 model 和
  sandbox。用户提到微信桥接 Codex、手机微信控制 Codex、ClawBot 对 Codex 联调、远程用微信驱动
  Codex 做代码任务时使用。
---

# 微信 ↔ Codex CLI 桥接

用微信连接本机运行的 `codex` CLI。桥接服务基于 `codex exec --json`，支持：

- 文字消息转发给 Codex
- 图片作为 `--image` 输入传给 Codex
- 文件、语音、视频落盘后把本地路径交给 Codex
- 使用 `thread_id` 自动续接上下文
- 微信端控制 `/model`、`/sandbox`、`/stop`、`/clear`、`/send`

如果需要修改和微信桥接相关的底层协议，可以参考 `wechat_agent_bridge_skills/openclaw-weixin` 原版 SDK。

## 目录说明

| 路径 | 作用 |
|------|------|
| `templates/` | 可独立运行的 Node 桥接服务 |
| `templates/src/ilink.ts` | 微信 ilink（ClawBot）HTTP API：收发消息、媒体加解密 |
| `templates/src/bridge.ts` | 主循环：`getupdates` + `codex exec --json` |
| `templates/bridge.config.example.json` | 配置模板，复制为 `bridge.config.json` |

## 前置条件

- Node.js >= 18
- 已安装并登录 `codex` CLI（先执行 `codex login`）
- 微信侧已完成 ClawBot / ilink 机器人绑定

## 安装与启动

```bash
cd wechat-codex_agent_bridge-skill/templates
cp bridge.config.example.json bridge.config.json
# 编辑 bridge.config.json：至少设置 cwd 为项目根目录
npm install
npm run setup
npm start
```

## 微信端指令

- `/help` - 查看帮助
- `/status` - 查看当前 bridge 状态
- `/clear` - 清除会话、终止任务、清空队列和追问
- `/stop` - 终止当前任务
- `/stopall` - 终止当前任务并清空队列和追问
- `/send <路径>` - 发送服务器上的文件到微信
- `/model` - 查看当前模型
- `/model <名称>` - 设置下一轮执行使用的模型
- `/model clear` - 恢复 Codex 默认模型
- `/sandbox` - 查看当前 sandbox
- `/sandbox read-only|workspace-write|danger-full-access` - 切换 sandbox

## 重要限制

Codex 版桥接使用的是非交互式 `codex exec`。因此：

- 支持稳定的消息桥接、会话续接、图片输入和文件回传
- 不支持像 Cursor 版那样对每一次工具调用做微信侧逐条审批
- 需要通过 `/sandbox` 控制整体执行范围，而不是在工具执行中途弹微信确认

## 发送文件给微信

如果希望 Codex 把本机文件主动发回微信，在回复中输出：

```text
[SEND_FILE:/绝对路径/文件.ext]
```

桥接层会自动识别并上传该文件。
