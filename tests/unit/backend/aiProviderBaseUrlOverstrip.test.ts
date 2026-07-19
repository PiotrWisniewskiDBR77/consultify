/** @vitest-environment node */
/**
 * Regression coverage for the anthropic-baseURL-404 bug and its latent twin.
 *
 * Bug: normalizeBaseUrl() stripped whole strings like '/v1/messages',
 * '/v1/completions', '/v1/responses' as a single suffix. For a DB row like
 * `llm_providers.endpoint = 'https://api.anthropic.com/v1/messages'` (the
 * seed value in llmConfigService.ts), that stripped the `/v1` segment along
 * with the operation path, producing the bare host
 * `https://api.anthropic.com`. @ai-sdk/anthropic (and OpenAI-compatible SDKs)
 * append their own operation path to the configured baseURL — e.g. POST
 * `${baseURL}/messages` — so a bare-host base means every real call 404s.
 *
 * Two copies of this function existed:
 *  - server/src/services/ai/llmService.ts (the live path for every provider
 *    call, including anthropic) — found on origin/demo STILL UNFIXED despite
 *    a prior memory note claiming it had been patched (the fix was
 *    apparently lost, a known failure mode for this project — ephemeral
 *    worktrees losing uncommitted commits).
 *  - server/src/services/ai/providerSentinel.ts (currently only reachable via
 *    the replicate IMAGE_MODEL health check, since TEXT_LLM checks delegate
 *    to llmService.testConnection — latent rather than firing today, but an
 *    identical landmine).
 *
 * Fix (same pattern in both files): strip ONLY the trailing operation
 * segment ('/chat/completions' | '/completions' | '/responses' | '/messages'),
 * leaving any /vN version prefix intact. llmService.ts additionally guards
 * the anthropic branch specifically: if the resolved base has no /vN at all
 * (a legitimate bare-host override), re-append /v1 before handing it to
 * createAnthropic().
 */
import { describe, expect, it } from 'vitest';

import { normalizeBaseUrl as llmServiceNormalizeBaseUrl } from '../../../server/src/services/ai/llmService.js';
import { normalizeBaseUrl as sentinelNormalizeBaseUrl } from '../../../server/src/services/ai/providerSentinel.js';

// The exact pre-fix suffix list (verified against `git show origin/demo:server/src/services/ai/llmService.ts`
// and the identical list in providerSentinel.ts before this fix) — kept here ONLY as a reference
// implementation to demonstrate the regression this test guards against; it is NOT production code.
function overStripBuggyNormalizeBaseUrl(endpoint?: string | null): string {
  const raw = String(endpoint || '').trim();
  if (!raw) return '';
  let base = raw.replace(/\/+$/, '');
  const suffixes = [
    '/chat/completions',
    '/v1/chat/completions',
    '/v1/completions',
    '/v1/responses',
    '/v1/messages',
  ];
  const lower = base.toLowerCase();
  for (const s of suffixes) {
    if (lower.endsWith(s)) {
      base = base.slice(0, -s.length).replace(/\/+$/, '');
      break;
    }
  }
  return base;
}

const ANTHROPIC_ENDPOINT_VARIANTS = [
  'https://api.anthropic.com/v1/messages',
  'https://api.anthropic.com/v1/messages/',
  'https://api.anthropic.com/v1',
  'https://api.anthropic.com/v1/',
];

describe('BEFORE (documented regression): buggy suffix list over-strips /v1', () => {
  it('reproduces the bare-host bug the fix guards against', () => {
    // This is the failure this whole test file exists to prevent — captured
    // here so the regression is legible even if someone reads only this file.
    expect(overStripBuggyNormalizeBaseUrl('https://api.anthropic.com/v1/messages')).toBe(
      'https://api.anthropic.com' // BUG: /v1 gone -> SDK POSTs bare-host/messages -> 404
    );
  });
});

describe('AFTER: llmService.ts normalizeBaseUrl (live provider-call path)', () => {
  it.each(ANTHROPIC_ENDPOINT_VARIANTS)(
    'keeps /v1 for endpoint variant %s',
    (endpoint) => {
      const result = llmServiceNormalizeBaseUrl(endpoint);
      expect(result).toBe('https://api.anthropic.com/v1');
      expect(result).not.toBe('https://api.anthropic.com'); // must never over-strip to bare host
    }
  );

  it('still strips a bare chat/completions suffix for openai-compatible endpoints', () => {
    expect(llmServiceNormalizeBaseUrl('https://openrouter.ai/api/v1/chat/completions')).toBe(
      'https://openrouter.ai/api/v1'
    );
  });

  it('returns undefined for an empty/undefined endpoint', () => {
    expect(llmServiceNormalizeBaseUrl(undefined)).toBeUndefined();
    expect(llmServiceNormalizeBaseUrl('')).toBeUndefined();
  });
});

describe('AFTER: providerSentinel.ts normalizeBaseUrl (twin, replicate health-check path today)', () => {
  it.each(ANTHROPIC_ENDPOINT_VARIANTS)(
    'keeps /v1 for endpoint variant %s',
    (endpoint) => {
      const result = sentinelNormalizeBaseUrl(endpoint);
      expect(result).toBe('https://api.anthropic.com/v1');
      expect(result).not.toBe('https://api.anthropic.com');
    }
  );

  it('still strips a bare chat/completions suffix for openai-compatible endpoints', () => {
    expect(sentinelNormalizeBaseUrl('https://openrouter.ai/api/v1/chat/completions')).toBe(
      'https://openrouter.ai/api/v1'
    );
  });

  it('returns empty string for a null/empty endpoint (this function never returns undefined)', () => {
    expect(sentinelNormalizeBaseUrl(null)).toBe('');
    expect(sentinelNormalizeBaseUrl('')).toBe('');
  });

  it('produces byte-identical output to llmService.ts for every anthropic variant (twins in sync)', () => {
    for (const endpoint of ANTHROPIC_ENDPOINT_VARIANTS) {
      expect(sentinelNormalizeBaseUrl(endpoint)).toBe(llmServiceNormalizeBaseUrl(endpoint));
    }
  });
});
