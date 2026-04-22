export interface CodexUsageSnapshot {
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  reasoningOutputTokens?: number;
  totalTokens?: number;
}

export interface UsageFooterOptions {
  usage?: CodexUsageSnapshot;
  durationMs: number;
  commandCount?: number;
  model?: string;
  serviceTier?: string;
}

/* ---------- formatting helpers ---------- */

export function formatTokenCount(n: number | undefined): string {
  const v = n ?? 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 10_000) return `${(v / 1000).toFixed(1)}k`;
  if (v >= 1000) return `${(v / 1000).toFixed(2)}k`;
  return String(v);
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '-';
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remain = Math.round(seconds - minutes * 60);
  return `${minutes}m${remain}s`;
}

function formatUSD(v: number): string {
  if (!isFinite(v) || v <= 0) return '$0';
  if (v >= 1) return `$${v.toFixed(3)}`;
  if (v >= 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(6)}`;
}

/* ---------- OpenAI API pricing ($/1M tokens) ---------- */

interface ModelPricing {
  label: string;
  input: number;
  cachedInput: number;
  output: number;
}

const PRICING_TABLE: { match: RegExp; price: ModelPricing }[] = [
  // GPT-5.x series
  { match: /gpt[-_]?5\.4[-_]?mini/i,       price: { label: 'GPT-5.4 Mini',      input: 0.75,  cachedInput: 0.075, output: 4.5 } },
  { match: /gpt[-_]?5\.4[-_]?nano/i,       price: { label: 'GPT-5.4 Nano',      input: 0.2,   cachedInput: 0.02,  output: 1.25 } },
  { match: /gpt[-_]?5\.4/i,                price: { label: 'GPT-5.4',           input: 2.5,   cachedInput: 0.25,  output: 15 } },
  { match: /gpt[-_]?5\.3[-_]?codex/i,      price: { label: 'GPT-5.3 Codex',    input: 1.75,  cachedInput: 0.175, output: 14 } },
  { match: /gpt[-_]?5\.2[-_]?codex/i,      price: { label: 'GPT-5.2 Codex',    input: 1.75,  cachedInput: 0.175, output: 14 } },
  { match: /gpt[-_]?5\.2/i,                price: { label: 'GPT-5.2',           input: 1.75,  cachedInput: 0.175, output: 14 } },
  { match: /gpt[-_]?5\.1[-_]?codex[-_]?mini/i, price: { label: 'GPT-5.1 Codex Mini', input: 0.25, cachedInput: 0.025, output: 2 } },
  { match: /gpt[-_]?5\.1[-_]?codex/i,      price: { label: 'GPT-5.1 Codex',    input: 1.25,  cachedInput: 0.125, output: 10 } },
  { match: /gpt[-_]?5[-_]?codex/i,         price: { label: 'GPT-5 Codex',      input: 1.25,  cachedInput: 0.125, output: 10 } },
  { match: /gpt[-_]?5[-_]?mini/i,          price: { label: 'GPT-5 Mini',       input: 0.25,  cachedInput: 0.025, output: 2 } },
  { match: /gpt[-_]?5/i,                   price: { label: 'GPT-5',            input: 1.25,  cachedInput: 0.125, output: 10 } },
  // GPT-4.1 series
  { match: /gpt[-_]?4\.1[-_]?nano/i,       price: { label: 'GPT-4.1 Nano',     input: 0.10,  cachedInput: 0.025, output: 0.40 } },
  { match: /gpt[-_]?4\.1[-_]?mini/i,       price: { label: 'GPT-4.1 Mini',     input: 0.40,  cachedInput: 0.10,  output: 1.60 } },
  { match: /gpt[-_]?4\.1/i,                price: { label: 'GPT-4.1',          input: 2.00,  cachedInput: 0.50,  output: 8.00 } },
  // GPT-4o series
  { match: /gpt[-_]?4o[-_]?mini/i,         price: { label: 'GPT-4o Mini',      input: 0.15,  cachedInput: 0.075, output: 0.60 } },
  { match: /gpt[-_]?4o/i,                  price: { label: 'GPT-4o',           input: 2.50,  cachedInput: 1.25,  output: 10.0 } },
  // o-series reasoning models
  { match: /o4[-_]?mini/i,                 price: { label: 'o4-mini',          input: 1.10,  cachedInput: 0.275, output: 4.40 } },
  { match: /o3[-_]?pro/i,                  price: { label: 'o3-pro',           input: 20.0,  cachedInput: 10.0,  output: 80.0 } },
  { match: /o3[-_]?mini/i,                 price: { label: 'o3-mini',          input: 1.10,  cachedInput: 0.55,  output: 4.40 } },
  { match: /o3/i,                          price: { label: 'o3',              input: 2.00,  cachedInput: 1.00,  output: 8.00 } },
  { match: /o1[-_]?mini/i,                 price: { label: 'o1-mini',          input: 1.10,  cachedInput: 0.55,  output: 4.40 } },
  { match: /o1[-_]?pro/i,                  price: { label: 'o1-pro',           input: 20.0,  cachedInput: 10.0,  output: 80.0 } },
  { match: /o1/i,                          price: { label: 'o1',              input: 15.0,  cachedInput: 7.50,  output: 60.0 } },
  // Codex CLI default model
  { match: /codex[-_]?mini/i,              price: { label: 'codex-mini',       input: 1.50,  cachedInput: 0.375, output: 6.00 } },
];

/** gpt-5.4 — 当前 Codex CLI 默认模型，作为未知模型时的估价兜底 */
const DEFAULT_PRICING: ModelPricing = { label: '(default)', input: 2.50, cachedInput: 0.25, output: 15.0 };

function lookupPricing(model: string | undefined): ModelPricing | null {
  if (!model) return null;
  const hit = PRICING_TABLE.find(p => p.match.test(model));
  return hit ? hit.price : null;
}

function calcCost(usage: CodexUsageSnapshot, pricing: ModelPricing): number {
  const inTok = usage.inputTokens ?? 0;
  const outTok = usage.outputTokens ?? 0;
  const cachedTok = usage.cachedInputTokens ?? 0;
  const freshInput = Math.max(0, inTok - cachedTok);
  return (
    freshInput * pricing.input +
    cachedTok * pricing.cachedInput +
    outTok * pricing.output
  ) / 1_000_000;
}

/* ---------- footer builder ---------- */

export function buildUsageFooter(opts: UsageFooterOptions): string {
  const lines: string[] = [];

  // Line 1: 📊 tokens + duration
  if (opts.usage) {
    const inp = formatTokenCount(opts.usage.inputTokens);
    const out = formatTokenCount(opts.usage.outputTokens);
    const cached = formatTokenCount(opts.usage.cachedInputTokens);
    const dur = formatDuration(opts.durationMs);

    let tokenLine = `— 📊 tokens: in ${inp} · out ${out} · cached ${cached} · ⏱ ${dur}`;

    const extras: string[] = [];
    if ((opts.usage.reasoningOutputTokens ?? 0) > 0) {
      extras.push(`reasoning ${formatTokenCount(opts.usage.reasoningOutputTokens)}`);
    }
    if ((opts.commandCount ?? 0) > 0) {
      extras.push(`cmds ${opts.commandCount}`);
    }
    if (opts.serviceTier?.trim()) {
      extras.push(`tier ${opts.serviceTier.trim()}`);
    }
    if (extras.length) {
      tokenLine += ` · ${extras.join(' · ')}`;
    }

    lines.push(tokenLine);
  } else {
    lines.push(`— 📊 tokens unavailable · ⏱ ${formatDuration(opts.durationMs)}`);
  }

  // Line 2: 💰 cost estimation
  const modelName = opts.model?.trim() || undefined;
  const exactPricing = lookupPricing(modelName);
  const pricing = exactPricing ?? DEFAULT_PRICING;
  if (opts.usage) {
    const cost = calcCost(opts.usage, pricing);
    const label = exactPricing
      ? exactPricing.label
      : (modelName ?? '(default)');
    const approx = exactPricing ? '' : '~';
    lines.push(`— 💰 ${label}: ${approx}${formatUSD(cost)}`);
  } else if (modelName) {
    lines.push(`— 🤖 model: ${modelName}`);
  }

  return '\n\n' + lines.join('\n');
}
