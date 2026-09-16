/**
 * M19 · DEC-543 — review findings are warnings and never block export.
 *
 * Zastępuje fałszywą zieleń network-testów p20 (które no-op bez live serwera)
 * deterministycznym kontraktem bramki jakości eksportu — bez localhost:3001.
 *
 * The legacy override parser remains compatible, while the export decision is
 * always HTTP 200 with structured `warnings[]` for every role.
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

describe('M19 · DEC-543 — enforceQualityGateForExport warning contract', () => {
  beforeEach(() => mockCheckGates.mockReset());

  it('review finding without override → 200 with warnings[]', async () => {
    mockCheckGates.mockResolvedValue({
      canExport: false,
      result: 'BLOCKED_P1',
      scorecard: {},
      gates: [{ id: 'finding-1', message: 'Add evidence.' }],
    });
    const res = await enforceQualityGateForExport({
      organizationId: 'org-1',
      deckId: 'deck-1',
      format: 'pdf',
      allowOverride: false,
    });
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(res.payload).toMatchObject({
      success: true,
      format: 'pdf',
      result: 'BLOCKED_P1',
      warnings: [{ id: 'finding-1', message: 'Add evidence.' }],
    });
  });

  it('review finding with legacy override has the same advisory result', async () => {
    mockCheckGates.mockResolvedValue({ canExport: false, result: 'fail', scorecard: {}, gates: [] });
    const res = await enforceQualityGateForExport({
      organizationId: 'org-1',
      deckId: 'deck-1',
      format: 'pdf',
      allowOverride: true,
    });
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
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
    expect(res.warnings).toEqual([]);
  });
});
