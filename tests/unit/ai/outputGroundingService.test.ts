/**
 * Output Grounding Service — unit tests.
 *
 * Wiring pass (2026-07-15): this engine was orphaned (0 callers). These
 * tests lock in the validate() contract before exposing it via
 * POST /api/ai/trust/grounding/validate (server/src/routes/ai/ai-trust.routes.ts).
 *
 * DbPromise is mocked: `ai_grounding_logs` (server/migrations/671_...sql)
 * is NOT part of the auto-run migration set (see route file header for
 * details), so persistLog() must not be exercised against a real DB here.
 * The service already treats persistence as fire-and-forget/best-effort.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbRunMock = vi.fn(async () => ({ changes: 1 }));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => dbRunMock(...args),
}));

const { default: outputGroundingService } = await import(
  '../../../server/src/services/ai/outputGroundingService.js'
);

describe('outputGroundingService.validate', () => {
  beforeEach(() => {
    dbRunMock.mockClear();
  });

  it('returns the empty result for a blank response', async () => {
    const result = await outputGroundingService.validate({ response: '   ', contextChunks: [] });
    expect(result.totalClaims).toBe(0);
    expect(result.groundingScore).toBe(0);
    expect(result.disclaimer).toBeNull();
  });

  it('grounds a factual claim whose keywords appear in the context', async () => {
    const contextChunks = [
      'Revenue grew from 10 million PLN to 14 million PLN across Q3 2026, driven by the new enterprise segment.',
    ];
    const response =
      'According to the data, revenue increased 40% in Q3 2026, reaching 14 million PLN [DT].';

    const result = await outputGroundingService.validate({ response, contextChunks });

    expect(result.totalClaims).toBeGreaterThan(0);
    expect(result.groundedClaims).toBeGreaterThan(0);
    expect(result.citationAccuracy).toBeGreaterThan(0);
    expect(result.disclaimer).toBeNull();
  });

  it('flags an ungrounded factual claim with no supporting context', async () => {
    const response = 'Revenue increased 87% in Q3 2026 according to internal estimates.';
    const result = await outputGroundingService.validate({ response, contextChunks: [] });

    expect(result.totalClaims).toBeGreaterThan(0);
    expect(result.groundedClaims).toBe(0);
    expect(result.groundingScore).toBeLessThan(0.6);
    expect(result.disclaimer).toContain('may not be fully supported');
  });

  it('detects hallucination-signal phrases', async () => {
    const response =
      'As everyone knows, studies show that this approach always works in every industry.';
    const result = await outputGroundingService.validate({ response, contextChunks: [] });

    expect(result.hallucinationFlags.length).toBeGreaterThan(0);
    expect(result.hallucinationFlags.some((f) => f.includes('as everyone knows'))).toBe(true);
  });

  it('treats purely non-factual/opinion sentences as trivially grounded', async () => {
    const response = 'I think this is a reasonable direction for the team to explore together.';
    const result = await outputGroundingService.validate({ response, contextChunks: [] });

    // Non-factual sentences count as "grounded" by construction (nothing to verify).
    expect(result.groundedClaims).toBe(result.totalClaims);
  });

  it('does not throw when persistence fails (best-effort, fire-and-forget)', async () => {
    dbRunMock.mockRejectedValueOnce(new Error('relation "ai_grounding_logs" does not exist'));

    const result = await outputGroundingService.validate({
      response: 'Costs dropped 12% according to the Q2 2026 report.',
      contextChunks: ['Costs dropped 12% in the Q2 2026 report.'],
      organizationId: 'org-1',
      userId: 'user-1',
    });

    expect(result).toBeDefined();
    // give the fire-and-forget persistLog microtask a tick to run/reject
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(dbRunMock).toHaveBeenCalled();
  });
});
