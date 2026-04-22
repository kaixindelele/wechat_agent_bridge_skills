/**
 * 桥接配置（bridge.config.json + 默认值）
 * 运行后端为 OpenAI Codex CLI (`codex exec --json`)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const TEMPLATES_ROOT = path.join(__dirname, '..');
export const CONFIG_PATH = path.join(TEMPLATES_ROOT, 'bridge.config.json');
export const EXAMPLE_CONFIG_PATH = path.join(TEMPLATES_ROOT, 'bridge.config.example.json');

export type CodexSandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access';

export interface BridgeConfig {
  cwd: string;
  codexPath: string;
  model: string;
  sandboxMode: CodexSandboxMode;
  skipGitRepoCheck: boolean;
  addDirs: string[];
  agentTimeoutMs: number;

  maxMessageLength: number;
  enableSession: boolean;
  sessionTimeoutMs: number;

  sendThinkingHint: boolean;
  thinkingHintText: string;
  verbose: boolean;
  showTokenUsage: boolean;

  allowedUserIds: string[];
  replyAllowedUserIds: string[];
  replyDeniedMessage: string;
}

export const defaultConfig: BridgeConfig = {
  cwd: '',
  codexPath: 'codex',
  model: '',
  sandboxMode: 'workspace-write',
  skipGitRepoCheck: true,
  addDirs: [],
  agentTimeoutMs: 30 * 60 * 1000,

  maxMessageLength: 4000,
  enableSession: true,
  sessionTimeoutMs: 30 * 60 * 1000,

  sendThinkingHint: true,
  thinkingHintText: '✅ 已收到，正在调用 Codex 处理...',
  verbose: false,
  showTokenUsage: true,

  allowedUserIds: [],
  replyAllowedUserIds: [],
  replyDeniedMessage: '⚠️ 您没有查看回复的权限。请联系管理员将您的 ID 加入白名单。',
};

function normalizeSandboxMode(value: unknown): CodexSandboxMode | undefined {
  if (value === 'read-only' || value === 'workspace-write' || value === 'danger-full-access') {
    return value;
  }
  return undefined;
}

/**
 * 当 codexPath 不是绝对路径时，通过 `which` 解析其完整路径。
 * 解决 npm scripts / spawn 子进程中 PATH 查找失败（ENOENT）的问题。
 */
function resolveExecPath(raw: string): string {
  if (path.isAbsolute(raw)) return raw;
  try {
    const resolved = execSync(`which ${raw}`, { encoding: 'utf-8', timeout: 5000 }).trim();
    if (resolved) return resolved;
  } catch {}
  return raw;
}

/**
 * 解析 cwd：空值 / 相对路径 → 基于 TEMPLATES_ROOT 展开为绝对路径；
 * 目录不存在时回退到 TEMPLATES_ROOT 并打印警告。
 */
function resolveCwd(raw: string): string {
  if (!raw) return TEMPLATES_ROOT;
  const abs = path.isAbsolute(raw) ? raw : path.resolve(TEMPLATES_ROOT, raw);
  if (fs.existsSync(abs)) return abs;
  console.warn(`[config] cwd "${abs}" 不存在，回退到项目目录: ${TEMPLATES_ROOT}`);
  return TEMPLATES_ROOT;
}

export function loadBridgeConfig(): BridgeConfig {
  let partial: Partial<BridgeConfig> = {};
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      partial = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) as Partial<BridgeConfig>;
    } catch (e) {
      console.error('[config] 解析 bridge.config.json 失败，使用默认配置:', e);
    }
  } else if (fs.existsSync(EXAMPLE_CONFIG_PATH)) {
    console.warn('[config] 未找到 bridge.config.json，从 bridge.config.example.json 读取（建议复制并改名为 bridge.config.json）');
    try {
      partial = JSON.parse(fs.readFileSync(EXAMPLE_CONFIG_PATH, 'utf-8')) as Partial<BridgeConfig>;
    } catch {
      // ignore
    }
  }

  const merged = { ...defaultConfig, ...partial };
  merged.codexPath = resolveExecPath(merged.codexPath);
  merged.cwd = resolveCwd(merged.cwd);
  merged.sandboxMode = normalizeSandboxMode(partial.sandboxMode) ?? defaultConfig.sandboxMode;
  merged.addDirs = Array.isArray(partial.addDirs) ? partial.addDirs.filter(x => typeof x === 'string') : defaultConfig.addDirs;
  return merged;
}
