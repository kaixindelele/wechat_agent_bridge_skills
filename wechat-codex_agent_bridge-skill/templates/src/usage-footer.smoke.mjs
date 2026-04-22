import assert from 'node:assert/strict';
import { buildUsageFooter } from './usage-footer.ts';

// --- Test 1: rich footer with all fields ---
const richFooter = buildUsageFooter({
  usage: {
    inputTokens: 3,
    cachedInputTokens: 17_600,
    outputTokens: 144,
    reasoningOutputTokens: 332,
    totalTokens: 18_079,
  },
  durationMs: 8_800,
  commandCount: 3,
  model: 'gpt-5.4',
  serviceTier: 'max',
});

assert.match(richFooter, /📊/);
assert.match(richFooter, /in 3/);
assert.match(richFooter, /out 144/);
assert.match(richFooter, /cached 17\.6k/);
assert.match(richFooter, /⏱ 8\.8s/);
assert.match(richFooter, /reasoning 332/);
assert.match(richFooter, /tier max/);
assert.match(richFooter, /cmds 3/);
assert.match(richFooter, /💰 GPT-5\.4: \$/);
assert.doesNotMatch(richFooter, /💰 GPT-5\.4: ~/);

// --- Test 2: fallback footer (no usage) ---
const fallbackFooter = buildUsageFooter({
  durationMs: 1_200,
});

assert.match(fallbackFooter, /📊/);
assert.match(fallbackFooter, /tokens unavailable/);
assert.match(fallbackFooter, /1\.2s/);

// --- Test 3: known model with pricing ---
const codexMiniFooter = buildUsageFooter({
  usage: {
    inputTokens: 500_000,
    cachedInputTokens: 400_000,
    outputTokens: 20_000,
  },
  durationMs: 12_000,
  model: 'codex-mini',
});

assert.match(codexMiniFooter, /💰 codex-mini: \$/);
assert.doesNotMatch(codexMiniFooter, /💰 codex-mini: ~/);
assert.match(codexMiniFooter, /cached 400\.0k/);

// --- Test 4: unknown model → falls back to default pricing, shows model name ---
const unknownModelFooter = buildUsageFooter({
  usage: {
    inputTokens: 1_000,
    outputTokens: 500,
  },
  durationMs: 3_000,
  model: 'some-future-model',
});

assert.match(unknownModelFooter, /📊/);
assert.match(unknownModelFooter, /💰 some-future-model: ~\$/);
assert.doesNotMatch(unknownModelFooter, /🤖/);

// --- Test 5: no model → uses default pricing with ~ prefix ---
const noModelFooter = buildUsageFooter({
  usage: {
    inputTokens: 100,
    outputTokens: 50,
  },
  durationMs: 500,
});

assert.match(noModelFooter, /📊/);
assert.match(noModelFooter, /💰 \(default\): ~\$/);

// --- Test 6: no usage, no model → no pricing line ---
const bareFooter = buildUsageFooter({
  durationMs: 200,
});

assert.match(bareFooter, /📊/);
assert.doesNotMatch(bareFooter, /💰/);

console.log('usage footer smoke test passed ✅');
