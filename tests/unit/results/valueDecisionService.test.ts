import { describe, expect, it } from 'vitest';

import {
  recommendDecision,
  portfolioDecisions,
  decisionSummary,
  type DecisionAction,
} from '../../../server/src/services/results/valueDecisionService.js';

describe('valueDecisionService — recommendDecision', () => {
  it('SCALE: realizuje powyżej planu z wysoką pewnością → DOŁÓŻ', () => {
    const r = recommendDecision({ realizationPct: 1.25, confidence: 0.85, trend: 'improving' });
    expect(r.action).toBe('SCALE');
    expect(r.severity).toBe('info');
    // rationale cytuje wejścia
    expect(r.rationale.join(' ')).toContain('125%');
    expect(r.rationale.join(' ')).toContain('85%');
    expect(r.rationale.join(' ')).toMatch(/dołóż/i);
  });

  it('SCALE NIE odpala gdy pewność za niska (mimo realizacji ≥110%) → HOLD strefy środkowej', () => {
    const r = recommendDecision({ realizationPct: 1.2, confidence: 0.5 });
    expect(r.action).not.toBe('SCALE');
  });

  it('STOP: realizacja niska + trend spadkowy + niska pewność → ZABIJ (critical)', () => {
    const r = recommendDecision({
      realizationPct: 0.4,
      confidence: 0.3,
      trend: 'declining',
      valueAtStake: 1_000_000,
    });
    expect(r.action).toBe('STOP');
    expect(r.severity).toBe('critical');
    expect(r.rationale.join(' ')).toContain('40%');
    expect(r.rationale.join(' ')).toMatch(/zabij/i);
    expect(r.rationale.join(' ')).toMatch(/niska pewność/i);
  });

  it('STOP: realizacja niska + niska stawka (mimo OK pewności) → ZABIJ', () => {
    const r = recommendDecision({
      realizationPct: 0.5,
      confidence: 0.8,
      trend: 'declining',
      valueAtStake: 10_000,
    });
    expect(r.action).toBe('STOP');
    expect(r.rationale.join(' ')).toMatch(/niska stawka/i);
  });

  it('INTERVENE: realizacja niska, ale wysoka pewność i duża stawka → ratuj (critical)', () => {
    const r = recommendDecision({
      realizationPct: 0.45,
      confidence: 0.8,
      trend: 'declining',
      valueAtStake: 800_000,
    });
    expect(r.action).toBe('INTERVENE');
    expect(r.severity).toBe('critical');
    expect(r.rationale.join(' ')).toContain('45%');
    expect(r.rationale.join(' ')).toMatch(/trend spadkowy/i);
    expect(r.rationale.join(' ')).toMatch(/interweniuj/i);
  });

  it('INTERVENE: strefa zagrożenia przez słabą adopcję (trend improving) z dużą stawką', () => {
    const r = recommendDecision({
      realizationPct: 0.55,
      confidence: 0.75,
      adoptionScore: 0.2,
      trend: 'improving',
      valueAtStake: 500_000,
    });
    expect(r.action).toBe('INTERVENE');
    expect(r.rationale.join(' ')).toMatch(/słaba adopcja/i);
  });

  it('INTERVENE: strefa środkowa z trendem spadkowym → interweniuj (warning)', () => {
    const r = recommendDecision({ realizationPct: 0.9, confidence: 0.8, trend: 'declining' });
    expect(r.action).toBe('INTERVENE');
    expect(r.severity).toBe('warning');
    expect(r.rationale.join(' ')).toContain('90%');
    expect(r.rationale.join(' ')).toMatch(/spadkowy/i);
  });

  it('HOLD: w paśmie planu z trendem płaskim → utrzymaj kurs', () => {
    const r = recommendDecision({ realizationPct: 0.95, confidence: 0.8, trend: 'flat' });
    expect(r.action).toBe('HOLD');
    expect(r.severity).toBe('info');
    expect(r.rationale.join(' ')).toContain('95%');
    expect(r.rationale.join(' ')).toMatch(/utrzymaj/i);
  });

  it('HOLD: brak danych o realizacji → obserwuj', () => {
    const r = recommendDecision({ confidence: 0.9 });
    expect(r.action).toBe('HOLD');
    expect(r.rationale.join(' ')).toMatch(/brak danych/i);
  });

  it('rationale ZAWSZE cytuje podane wejścia (realizacja, pewność, adopcja, trend, stawka)', () => {
    const r = recommendDecision({
      realizationPct: 0.8,
      confidence: 0.7,
      adoptionScore: 0.6,
      trend: 'flat',
      valueAtStake: 123_456,
    });
    const joined = r.rationale.join(' ');
    expect(joined).toContain('80%');
    expect(joined).toContain('70%');
    expect(joined).toContain('60%');
    expect(joined).toMatch(/trend płaski/i);
    // 123456 sformatowane spacją PL (123 456) — sprawdź obecność cyfr stawki
    expect(joined).toMatch(/123/);
  });
});

describe('valueDecisionService — portfolioDecisions', () => {
  it('sortuje malejąco po valueAtStake', () => {
    const out = portfolioDecisions([
      { id: 'a', realizationPct: 1.2, confidence: 0.8, valueAtStake: 100_000 },
      { id: 'b', realizationPct: 0.4, confidence: 0.3, trend: 'declining', valueAtStake: 900_000 },
      { id: 'c', realizationPct: 0.9, confidence: 0.8, trend: 'flat', valueAtStake: 300_000 },
    ]);
    expect(out.map((d) => d.id)).toEqual(['b', 'c', 'a']);
    expect(out.every((d) => typeof d.action === 'string')).toBe(true);
  });

  it('brakujący valueAtStake liczy się jako 0 (ląduje na końcu)', () => {
    const out = portfolioDecisions([
      { id: 'noval', realizationPct: 0.95, confidence: 0.8 },
      { id: 'big', realizationPct: 0.95, confidence: 0.8, valueAtStake: 50_000 },
    ]);
    expect(out[0].id).toBe('big');
    expect(out[1].id).toBe('noval');
    expect(out[1].valueAtStake).toBe(0);
  });

  it('przepisuje id/name oraz przenosi decyzję z recommendDecision', () => {
    const out = portfolioDecisions([
      { id: 'x1', name: 'Inicjatywa X', realizationPct: 1.3, confidence: 0.9, valueAtStake: 10 },
    ]);
    expect(out[0]).toMatchObject({ id: 'x1', name: 'Inicjatywa X', action: 'SCALE' });
    expect(Array.isArray(out[0].rationale)).toBe(true);
  });

  it('pusta lista → pusta lista', () => {
    expect(portfolioDecisions([])).toEqual([]);
  });
});

describe('valueDecisionService — decisionSummary', () => {
  it('agreguje count i value per akcja', () => {
    const decisions = portfolioDecisions([
      { id: 'a', realizationPct: 1.3, confidence: 0.9, valueAtStake: 100_000 }, // SCALE
      { id: 'b', realizationPct: 1.2, confidence: 0.8, valueAtStake: 200_000 }, // SCALE
      { id: 'c', realizationPct: 0.4, confidence: 0.3, trend: 'declining', valueAtStake: 30_000 }, // STOP
      { id: 'd', realizationPct: 0.9, confidence: 0.8, trend: 'declining', valueAtStake: 50_000 }, // INTERVENE
      { id: 'e', realizationPct: 0.95, confidence: 0.8, trend: 'flat', valueAtStake: 70_000 }, // HOLD
    ]);
    const sum = decisionSummary(decisions);

    expect(sum.SCALE).toEqual({ count: 2, value: 300_000 });
    expect(sum.STOP).toEqual({ count: 1, value: 30_000 });
    expect(sum.INTERVENE).toEqual({ count: 1, value: 50_000 });
    expect(sum.HOLD).toEqual({ count: 1, value: 70_000 });
  });

  it('zwraca wszystkie 4 klucze nawet dla pustego wejścia', () => {
    const sum = decisionSummary([]);
    const actions: DecisionAction[] = ['SCALE', 'INTERVENE', 'STOP', 'HOLD'];
    for (const a of actions) {
      expect(sum[a]).toEqual({ count: 0, value: 0 });
    }
  });
});
