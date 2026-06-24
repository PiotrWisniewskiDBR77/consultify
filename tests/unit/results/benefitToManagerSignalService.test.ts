import { describe, expect, it } from 'vitest';

import {
  buildBenefitSignals,
  escalationForSignal,
  signalsSummary,
  type BenefitSignal,
} from 'server/src/services/results/benefitToManagerSignalService.js';

describe('buildBenefitSignals', () => {
  it('ignores healthy benefits (not atRisk, realization >= 0.6)', () => {
    const signals = buildBenefitSignals([
      { name: 'Oszczędności', realizationPct: 0.85 },
      { name: 'Wzrost przychodu', realizationPct: 0.6 },
    ]);
    expect(signals).toHaveLength(0);
  });

  it('emits a signal when realization < 0.6', () => {
    const signals = buildBenefitSignals([{ name: 'Redukcja kosztów', realizationPct: 0.55 }]);
    expect(signals).toHaveLength(1);
    expect(signals[0].type).toBe('BENEFIT_AT_RISK');
    expect(signals[0].severity).toBe('warning');
  });

  it('emits a signal when atRisk flag is set even if realization is fine', () => {
    const signals = buildBenefitSignals([{ name: 'NPS', realizationPct: 0.9, atRisk: true }]);
    expect(signals).toHaveLength(1);
    expect(signals[0].severity).toBe('warning');
  });

  it('marks critical when realization < 0.4', () => {
    const signals = buildBenefitSignals([{ name: 'Czas cyklu', realizationPct: 0.3 }]);
    expect(signals).toHaveLength(1);
    expect(signals[0].severity).toBe('critical');
    expect(signals[0].suggestedAction).toContain('sponsora');
  });

  it('marks critical when valueAtStake is high, regardless of realization', () => {
    const signals = buildBenefitSignals([
      { name: 'Marża', realizationPct: 0.55, valueAtStake: 250_000 },
    ]);
    expect(signals).toHaveLength(1);
    expect(signals[0].severity).toBe('critical');
    expect(signals[0].valueAtStake).toBe(250_000);
  });

  it('quotes the realization percentage in the title', () => {
    const signals = buildBenefitSignals([{ name: 'Adopcja', realizationPct: 0.42 }]);
    expect(signals[0].title).toContain('Adopcja');
    expect(signals[0].title).toContain('42%');
  });

  it('falls back to a generic label and unknown realization when name/pct missing', () => {
    const signals = buildBenefitSignals([{ atRisk: true }]);
    expect(signals).toHaveLength(1);
    expect(signals[0].title).toContain('Korzyść');
    expect(signals[0].title.toLowerCase()).toContain('nieznana');
  });

  it('passes through initiativeId', () => {
    const signals = buildBenefitSignals([
      { initiativeId: 'init-1', name: 'X', realizationPct: 0.2 },
    ]);
    expect(signals[0].initiativeId).toBe('init-1');
  });

  it('handles non-array / malformed input defensively', () => {
    // @ts-expect-error testing runtime guard
    expect(buildBenefitSignals(null)).toEqual([]);
    // @ts-expect-error testing runtime guard
    expect(buildBenefitSignals([null, undefined, 5])).toEqual([]);
  });
});

describe('escalationForSignal', () => {
  const baseCritical: BenefitSignal = {
    type: 'BENEFIT_AT_RISK',
    severity: 'critical',
    title: 'Korzyść zagrożona (realizacja 30%)',
    suggestedAction: 'eskaluj do sponsora / uruchom akcję naprawczą',
  };

  it('routes critical signals to the sponsor', () => {
    const target = escalationForSignal(baseCritical);
    expect(target.escalateTo).toBe('sponsor');
    expect(target.reason).toContain('krytycznie');
  });

  it('routes high-value warnings to pmo', () => {
    const target = escalationForSignal({
      ...baseCritical,
      severity: 'warning',
      valueAtStake: 150_000,
    });
    expect(target.escalateTo).toBe('pmo');
  });

  it('routes ordinary warnings to the owner', () => {
    const target = escalationForSignal({
      ...baseCritical,
      severity: 'warning',
      valueAtStake: 5_000,
    });
    expect(target.escalateTo).toBe('owner');
  });
});

describe('signalsSummary', () => {
  it('rolls up total, critical count and value at risk', () => {
    const signals = buildBenefitSignals([
      { name: 'A', realizationPct: 0.3, valueAtStake: 50_000 }, // critical
      { name: 'B', realizationPct: 0.55, valueAtStake: 20_000 }, // warning
      { name: 'C', realizationPct: 0.5, valueAtStake: 300_000 }, // critical (high value)
      { name: 'D', realizationPct: 0.95 }, // not a signal
    ]);

    const summary = signalsSummary(signals);
    expect(summary.total).toBe(3);
    expect(summary.critical).toBe(2);
    expect(summary.valueAtRisk).toBe(370_000);
  });

  it('returns zeros for empty / malformed input', () => {
    expect(signalsSummary([])).toEqual({ total: 0, critical: 0, valueAtRisk: 0 });
    // @ts-expect-error testing runtime guard
    expect(signalsSummary(null)).toEqual({ total: 0, critical: 0, valueAtRisk: 0 });
  });
});
