import { describe, expect, it } from 'vitest';

import {
  assuranceAlerts,
  assuranceStatus,
  assuranceSummary,
  type AssuranceItem,
} from '../../../server/src/services/valueAssuranceService.js';

describe('assuranceStatus', () => {
  it('attests when attestedBy + provenance + evidenceReconciled all present', () => {
    const res = assuranceStatus({
      value: 100_000,
      attestedBy: 'cfo@acme.com',
      provenance: 'GL-2026-Q2',
      evidenceReconciled: true,
    });
    expect(res.status).toBe('attested');
    expect(res.flags).toEqual([]);
  });

  it('is unverified when attestation is missing', () => {
    const res = assuranceStatus({
      value: 50_000,
      provenance: 'GL-2026-Q2',
      evidenceReconciled: true,
    });
    expect(res.status).toBe('unverified');
    expect(res.flags).toContain('NO_ATTESTOR');
  });

  it('is unverified when evidence not yet reconciled', () => {
    const res = assuranceStatus({
      value: 50_000,
      attestedBy: 'cfo@acme.com',
      provenance: 'GL-2026-Q2',
      // evidenceReconciled undefined
    });
    expect(res.status).toBe('unverified');
    expect(res.flags).toContain('NOT_RECONCILED');
  });

  it('is disputed when reconciliation explicitly mismatches', () => {
    const res = assuranceStatus({
      value: 50_000,
      attestedBy: 'cfo@acme.com',
      provenance: 'GL-2026-Q2',
      evidenceReconciled: false,
    });
    expect(res.status).toBe('disputed');
    expect(res.flags).toContain('RECONCILIATION_MISMATCH');
  });

  it('disputed dominates even with full attestation', () => {
    const res = assuranceStatus({
      value: 1,
      attestedBy: 'x',
      provenance: 'y',
      evidenceReconciled: false,
    });
    expect(res.status).toBe('disputed');
  });

  it('flags missing/non-finite value', () => {
    const res = assuranceStatus({ value: Number.NaN });
    expect(res.flags).toContain('NO_VALUE');
    expect(res.status).toBe('unverified');
  });

  it('treats whitespace-only attestor/provenance as missing', () => {
    const res = assuranceStatus({
      value: 10,
      attestedBy: '   ',
      provenance: '',
      evidenceReconciled: true,
    });
    expect(res.status).toBe('unverified');
    expect(res.flags).toContain('NO_ATTESTOR');
    expect(res.flags).toContain('NO_PROVENANCE');
  });
});

describe('assuranceAlerts', () => {
  it('emits PAST_GATE_NO_EVIDENCE for a gated initiative with no evidence', () => {
    const items: AssuranceItem[] = [
      { initiativeId: 'i1', value: 200_000, gatePassed: true },
    ];
    const alerts = assuranceAlerts(items);
    const a = alerts.find((x) => x.type === 'PAST_GATE_NO_EVIDENCE');
    expect(a).toBeDefined();
    expect(a?.initiativeId).toBe('i1');
    expect(a?.severity).toBe('high');
  });

  it('does NOT emit PAST_GATE_NO_EVIDENCE when provenance backs the gate', () => {
    const items: AssuranceItem[] = [
      {
        initiativeId: 'i1',
        value: 200_000,
        gatePassed: true,
        provenance: 'GL-1',
        attestedBy: 'cfo',
        evidenceReconciled: true,
      },
    ];
    const alerts = assuranceAlerts(items);
    expect(alerts.some((x) => x.type === 'PAST_GATE_NO_EVIDENCE')).toBe(false);
  });

  it('emits TARGET_REALIZED_GAP when realized materially diverges from target', () => {
    const items: AssuranceItem[] = [
      { initiativeId: 'i2', value: 50_000, targetValue: 100_000, realizedValue: 50_000 },
    ];
    const alerts = assuranceAlerts(items);
    const a = alerts.find((x) => x.type === 'TARGET_REALIZED_GAP');
    expect(a).toBeDefined();
    expect(a?.severity).toBe('high'); // 50% drift
  });

  it('does NOT emit TARGET_REALIZED_GAP within tolerance (±10%)', () => {
    const items: AssuranceItem[] = [
      { initiativeId: 'i2', value: 95_000, targetValue: 100_000, realizedValue: 95_000 },
    ];
    const alerts = assuranceAlerts(items);
    expect(alerts.some((x) => x.type === 'TARGET_REALIZED_GAP')).toBe(false);
  });

  it('emits UNATTESTED_VALUE for non-zero value that is unverified', () => {
    const items: AssuranceItem[] = [
      { initiativeId: 'i3', value: 75_000 },
    ];
    const alerts = assuranceAlerts(items);
    const a = alerts.find((x) => x.type === 'UNATTESTED_VALUE');
    expect(a).toBeDefined();
    expect(a?.severity).toBe('medium');
  });

  it('does NOT emit UNATTESTED_VALUE for fully attested items', () => {
    const items: AssuranceItem[] = [
      {
        initiativeId: 'i3',
        value: 75_000,
        attestedBy: 'cfo',
        provenance: 'GL',
        evidenceReconciled: true,
      },
    ];
    const alerts = assuranceAlerts(items);
    expect(alerts.some((x) => x.type === 'UNATTESTED_VALUE')).toBe(false);
  });

  it('covers all three alert types across a portfolio', () => {
    const items: AssuranceItem[] = [
      { initiativeId: 'g', value: 100, gatePassed: true }, // PAST_GATE + UNATTESTED
      { initiativeId: 't', value: 100, targetValue: 1000, realizedValue: 100, attestedBy: 'c', provenance: 'p', evidenceReconciled: true }, // GAP only
      { initiativeId: 'u', value: 100 }, // UNATTESTED only
    ];
    const types = new Set(assuranceAlerts(items).map((a) => a.type));
    expect(types.has('PAST_GATE_NO_EVIDENCE')).toBe(true);
    expect(types.has('TARGET_REALIZED_GAP')).toBe(true);
    expect(types.has('UNATTESTED_VALUE')).toBe(true);
  });

  it('handles empty / invalid input safely', () => {
    expect(assuranceAlerts([])).toEqual([]);
    expect(assuranceAlerts(undefined as unknown as AssuranceItem[])).toEqual([]);
    expect(assuranceAlerts([{ value: 1 } as AssuranceItem])).toEqual([]); // no initiativeId
  });
});

describe('assuranceSummary', () => {
  it('aggregates attestedPct, values, disputedCount and coverage', () => {
    const items: AssuranceItem[] = [
      // attested 100k, has provenance
      { initiativeId: 'a', value: 100_000, attestedBy: 'cfo', provenance: 'GL-1', evidenceReconciled: true },
      // unverified 50k, no provenance
      { initiativeId: 'b', value: 50_000 },
      // disputed 50k, has provenance
      { initiativeId: 'c', value: 50_000, attestedBy: 'cfo', provenance: 'GL-2', evidenceReconciled: false },
    ];
    const s = assuranceSummary(items);

    expect(s.attestedValue).toBe(100_000);
    expect(s.unverifiedValue).toBe(50_000);
    expect(s.disputedCount).toBe(1);
    // total value = 200k, attested = 100k → 0.5
    expect(s.attestedPct).toBe(0.5);
    // 2 of 3 items carry provenance → 0.6667
    expect(s.coverage).toBe(0.6667);
  });

  it('returns a zeroed summary for empty input', () => {
    expect(assuranceSummary([])).toEqual({
      attestedPct: 0,
      attestedValue: 0,
      unverifiedValue: 0,
      disputedCount: 0,
      coverage: 0,
    });
  });

  it('avoids divide-by-zero when total value is zero', () => {
    const s = assuranceSummary([{ initiativeId: 'z', value: 0 }]);
    expect(s.attestedPct).toBe(0);
    expect(s.coverage).toBe(0);
  });
});
