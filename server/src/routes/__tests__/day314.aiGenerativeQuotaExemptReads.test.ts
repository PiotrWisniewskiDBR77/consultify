/**
 * Day 314 — GET /api/ai/stream/partial/:sessionId and
 * GET /api/ai/conversations/:id/proposals are polled in the background by the
 * chat view while the user is idle. Both are plain tenant-scoped SELECTs, but
 * they sat under `aiRateLimiter` (30/min in production, keyed by IP when
 * userId is null), so thirty background polls exhausted the generative budget
 * and the chat answered "AI request failed (RATE_LIMIT_EXCEEDED)".
 *
 * Mutations and every provider-reaching route must stay under the limiter.
 */
import { describe, expect, it } from 'vitest';

import { isAgentHubDatabaseRead, isGenerativeQuotaExemptRead } from '../ai.routes.js';

describe('Day 314 — generative quota exemption for pure database reads', () => {
  it.each([
    ['/stream/partial/session-1'],
    ['/stream/partial/11111111-1111-4111-8111-111111111111'],
    ['/conversations/abc/proposals'],
    ['/conversations/11111111-1111-4111-8111-111111111111/proposals'],
    ['/actions/pending'],
    ['/actions/center'],
    ['/actions/runs'],
    ['/actions/proposals'],
    ['/governance/approval-requests'],
    ['/soft-cap-status'],
    ['/budget/status'],
    ['/tier-limits'],
  ])('keeps the background GET %s outside the generative bucket', (path) => {
    expect(isGenerativeQuotaExemptRead('GET', path)).toBe(true);
  });

  it('still covers the Agent Hub reads that were exempted first', () => {
    for (const path of ['/agent-plan', '/agent-plan/plan-1', '/agent-manifests']) {
      expect(isAgentHubDatabaseRead('GET', path)).toBe(true);
      expect(isGenerativeQuotaExemptRead('GET', path)).toBe(true);
    }
  });

  it.each([
    ['POST', '/chat/stream'],
    ['POST', '/chat'],
    ['POST', '/chat/quick'],
    ['POST', '/generate'],
    ['POST', '/refine-text'],
    ['POST', '/recommend'],
    ['POST', '/deep-research/clarify'],
    // A mutation on an otherwise exempt path must not inherit the exemption.
    ['POST', '/actions/pending'],
    ['POST', '/conversations/abc/proposals'],
    ['DELETE', '/stream/partial/session-1'],
  ])('retains the generative limiter for %s %s', (method, path) => {
    expect(isGenerativeQuotaExemptRead(method, path)).toBe(false);
  });

  it.each([
    // Near-misses must not be exempted by a sloppy prefix/regex match.
    ['/stream/partial'],
    ['/conversations/abc/proposals/extra'],
    ['/conversations/proposals'],
    ['/actions/pending/extra'],
    ['/budget/status/history'],
  ])('does not exempt the non-matching read %s', (path) => {
    expect(isGenerativeQuotaExemptRead('GET', path)).toBe(false);
  });
});
