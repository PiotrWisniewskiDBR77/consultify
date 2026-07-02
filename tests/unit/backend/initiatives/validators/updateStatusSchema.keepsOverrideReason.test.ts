import { describe, expect, it } from 'vitest';

import { UpdateInitiativeStatusSchema } from '../../../../../server/src/validators/initiative.validators.js';

/**
 * R3 golden-path fix: the M13 AI-gate soft-block (422 INITIATIVE_GATE_AI_SOFT_BLOCK)
 * asks the caller to retry with `overrideReason`, and the controller reads
 * `req.body.overrideReason` — but validateBody replaces req.body with the zod-parsed
 * object. When the schema did not declare the field, zod stripped it and a
 * below-threshold initiative could NEVER leave the gate (infinite 422 loop).
 */
describe('UpdateInitiativeStatusSchema — AI-gate override', () => {
  it('keeps overrideReason after parsing (not stripped)', () => {
    const parsed = UpdateInitiativeStatusSchema.parse({
      status: 'PENDING_REVIEW',
      reason: 'submit',
      overrideReason: 'owner accepts readiness gap — client demo walkthrough',
    });
    expect(parsed.overrideReason).toBe('owner accepts readiness gap — client demo walkthrough');
  });

  it('still validates without overrideReason (optional)', () => {
    const parsed = UpdateInitiativeStatusSchema.parse({ status: 'REVIEW' });
    expect(parsed.status).toBe('REVIEW');
    expect(parsed.overrideReason).toBeUndefined();
  });

  it('rejects an over-long overrideReason (max 1000)', () => {
    const result = UpdateInitiativeStatusSchema.safeParse({
      status: 'REVIEW',
      overrideReason: 'x'.repeat(1001),
    });
    expect(result.success).toBe(false);
  });
});
