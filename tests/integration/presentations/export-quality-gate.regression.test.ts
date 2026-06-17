/**
 * M19 · L-02 (override role-gate regression) + L-07 (S5 — deterministic 422 gate).
 *
 * Zastępuje fałszywą zieleń network-testów p20 (które no-op bez live serwera)
 * deterministycznym kontraktem bramki jakości eksportu — bez localhost:3001.
 *
 * L-02: nie-admin z ?overrideQualityGate=true NIE omija bramki.
 * L-07/S5: deck z `canExport=false` → 422 QUALITY_GATE_BLOCKED, chyba że override
 *           (role-gated) jest aktywny.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCheckGates } = vi.hoisted(() => ({ mockCheckGates: vi.fn() }));

vi.mock('../../../server/src/services/presentationQualityGatesService.js', () => ({
  checkDeckQualityGates: mockCheckGates,
}));

import {
  canOverrideQualityGate,
  enforceQualityGateForExport,
} from '../../../server/src/routes/presentationExportGate.js';

describe('M19 · L-02 — quality-gate override is role-gated', () => {
  it('non-admin + overrideQualityGate=true → NOT allowed', () => {
    expect(
      canOverrideQualityGate({ user: { role: 'MEMBER' }, query: { overrideQualityGate: 'true' } })
    ).toBe(false);
  });

  it('no role + param → NOT allowed', () => {
    expect(canOverrideQualityGate({ query: { overrideQualityGate: 'true' } })).toBe(false);
  });

  it.each(['ADMIN', 'OWNER', 'SUPERADMIN'])('%s + param=true → allowed', (role) => {
    expect(
      canOverrideQualityGate({ user: { role }, query: { overrideQualityGate: 'true' } })
    ).toBe(true);
  });

  it('ADMIN WITHOUT param → NOT allowed (must explicitly opt in)', () => {
    expect(canOverrideQualityGate({ user: { role: 'ADMIN' }, query: {} })).toBe(false);
  });

  it('legacy req.userRole is honoured', () => {
    expect(
      canOverrideQualityGate({ userRole: 'OWNER', query: { overrideQualityGate: 'true' } })
    ).toBe(true);
  });
});

describe('M19 · L-07/S5 — enforceQualityGateForExport 422 contract', () => {
  beforeEach(() => mockCheckGates.mockReset());

  it('blocked deck (canExport=false) without override → 422 QUALITY_GATE_BLOCKED', async () => {
    mockCheckGates.mockResolvedValue({
      canExport: false,
      result: 'fail',
      scorecard: {},
      gates: [],
    });
    const res = await enforceQualityGateForExport({
      organizationId: 'org-1',
      deckId: 'deck-1',
      format: 'pdf',
      allowOverride: false,
    });
    expect(res.ok).toBe(false);
    expect((res as { status: number }).status).toBe(422);
    expect((res as { payload: { code: string } }).payload.code).toBe('QUALITY_GATE_BLOCKED');
  });

  it('blocked deck WITH role-gated override → passes through', async () => {
    mockCheckGates.mockResolvedValue({ canExport: false, result: 'fail', scorecard: {}, gates: [] });
    const res = await enforceQualityGateForExport({
      organizationId: 'org-1',
      deckId: 'deck-1',
      format: 'pdf',
      allowOverride: true,
    });
    expect(res.ok).toBe(true);
  });

  it('passing deck (canExport=true) → ok regardless of override', async () => {
    mockCheckGates.mockResolvedValue({ canExport: true, result: 'pass', scorecard: {}, gates: [] });
    const res = await enforceQualityGateForExport({
      organizationId: 'org-1',
      deckId: 'deck-1',
      format: 'pptx',
      allowOverride: false,
    });
    expect(res.ok).toBe(true);
  });
});
