/**
 * Unit tests for financialModelingService.updateModel — approval-state
 * mass-assignment guard (M16 finance hardening).
 *
 * `updateModel` is the write path behind BOTH the legacy
 * `PUT /api/financial-modeling/models/:id` and the V8
 * `PUT /api/v8/finance/models/:modelId` (the latter forwards req.body with NO
 * zod validation). The `approved` lifecycle state may ONLY be reached through
 * approveModel(), which recomputes the model, enforces the validation gate,
 * writes the approved_snapshot, records approved_by, and bumps the version.
 *
 * These tests pin that a body-supplied `status: 'approved'` is dropped from the
 * UPDATE (so it cannot forge an approved model with no validation/snapshot),
 * while the legitimate draft↔review transitions and other allowlisted columns
 * still write through.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const run = vi.fn();

vi.mock('../../utils/DbPromise.js', () => ({
  all: vi.fn(),
  get: vi.fn(),
  run: (...args: unknown[]) => run(...args),
}));

import { updateModel } from '../financialModelingService.js';

beforeEach(() => {
  run.mockReset();
  run.mockResolvedValue({ changes: 1 });
});

describe('financialModelingService.updateModel — approval guard', () => {
  it('drops status=approved so it cannot be forged via a metadata update', async () => {
    await updateModel('model-1', { name: 'Renamed', status: 'approved' });

    expect(run).toHaveBeenCalledTimes(1);
    const [sql, params] = run.mock.calls[0] as [string, unknown[]];
    // The name write survives...
    expect(sql).toMatch(/name = \?/);
    expect(params).toContain('Renamed');
    // ...but status must NOT be written.
    expect(sql).not.toMatch(/status = \?/);
    expect(params).not.toContain('approved');
  });

  it('drops status=approved even when case/whitespace-obfuscated', async () => {
    await updateModel('model-1', { status: '  Approved ' });
    // Only updated_at remains → no status set → still issues an UPDATE but
    // without a status column write.
    if (run.mock.calls.length > 0) {
      const [sql, params] = run.mock.calls[0] as [string, unknown[]];
      expect(sql).not.toMatch(/status = \?/);
      expect(params).not.toContain('  Approved ');
    }
  });

  it('allows the draft↔review self-service transition through', async () => {
    await updateModel('model-1', { status: 'review' });
    expect(run).toHaveBeenCalledTimes(1);
    const [sql, params] = run.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/status = \?/);
    expect(params).toContain('review');
  });

  it('ignores non-allowlisted columns (organization_id, created_by)', async () => {
    await updateModel('model-1', {
      name: 'X',
      organization_id: 'org-hijack',
      created_by: 'attacker',
    } as Record<string, unknown>);
    const [sql, params] = run.mock.calls[0] as [string, unknown[]];
    expect(sql).not.toMatch(/organization_id = \?/);
    expect(sql).not.toMatch(/created_by = \?/);
    expect(params).not.toContain('org-hijack');
    expect(params).not.toContain('attacker');
  });
});
