/**
 * M19 · DEC-543 — review findings are warnings and never block export.
 *
 * Zastępuje fałszywą zieleń network-testów p20 (które no-op bez live serwera)
 * deterministycznym kontraktem bramki jakości eksportu — bez localhost:3001.
 *
 * The export decision is always HTTP 200 with structured `warnings[]`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCheckGates } = vi.hoisted(() => ({ mockCheckGates: vi.fn() }));

vi.mock('../../../server/src/services/presentationQualityGatesService.js', () => ({
  checkDeckQualityGates: mockCheckGates,
}));

import {
  canOverrideQualityGate,
  enforceQualityGateForExport,
  setQualityWarningHeaders,
} from '../../../server/src/routes/presentationExportGate.js';

describe('M19 · final-export override audit metadata', () => {
  it('records an explicit override only for governance roles', () => {
    expect(
      canOverrideQualityGate({ user: { role: 'MEMBER' }, query: { overrideQualityGate: 'true' } })
    ).toBe(false);
    for (const role of ['ADMIN', 'OWNER', 'SUPERADMIN']) {
      expect(
        canOverrideQualityGate({ user: { role }, query: { overrideQualityGate: 'true' } })
      ).toBe(true);
    }
  });
});

describe('M19 · warning response headers', () => {
  it('caps warning metadata and appends to existing exposed headers', () => {
    const headers = new Map<string, string>([['Access-Control-Expose-Headers', 'X-Request-Id']]);
    const response = {
      getHeader: (name: string) => headers.get(name),
      setHeader: (name: string, value: string) => headers.set(name, value),
    };
    setQualityWarningHeaders(response, {
      report: { result: 'WARN' },
      warnings: Array.from({ length: 30 }, (_, index) => ({ index, message: 'x'.repeat(500) })),
    });
    expect(headers.get('Access-Control-Expose-Headers')).toContain('X-Request-Id');
    expect(headers.get('Access-Control-Expose-Headers')).toContain(
      'X-Presentation-Quality-Warnings'
    );
    const encoded = headers.get('X-Presentation-Quality-Warnings') || '';
    expect(encoded.length).toBeLessThanOrEqual(4096);
    expect(JSON.parse(decodeURIComponent(encoded)).length).toBeLessThanOrEqual(20);
    expect(headers.get('X-Presentation-Quality-Warning-Count')).toBe('30');
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

  it('review finding has the same advisory result for every caller', async () => {
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
    });
    expect(res.ok).toBe(true);
    expect(res.warnings).toEqual([]);
  });
});
