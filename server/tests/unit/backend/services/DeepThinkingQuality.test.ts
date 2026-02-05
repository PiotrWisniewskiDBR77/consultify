import { describe, expect, it } from 'vitest';

import { scoreDeepThinkingRubric, validateDeepThinkingDoD } from '../../../../src/services/ai/deepThinkingQuality.js';

describe('DeepThinkingQuality', () => {
  it('flags empty output', () => {
    const r = validateDeepThinkingDoD('');
    expect(r.ok).toBe(false);
    expect(r.missing).toContain('empty_output');
  });

  it('accepts a well-structured English report', () => {
    const text = `
Executive Summary
We recommend X because it best balances speed vs. risk. If we do nothing, the status quo cost compounds.

Problem Framing
Decision horizon: 90 days. Stakeholders: Ops + Finance. If we do nothing: churn risk increases.

Options
1. Path A
2. Path B

Trade-offs
Path A is faster but increases operational risk; Path B is slower but improves resilience.

Recommendation + boundary conditions
Do A unless Z (budget cut > 20% or vendor lock-in risk becomes material). If Z, pick Path B.

Risks & Blind spots
Key assumption: current team capacity is stable. Blind spot: missing data on supplier lead times.

Next actions
- Do this
- Do that
Early signals to monitor: weekly cycle time, error rate, and customer complaints.
`;
    const r = validateDeepThinkingDoD(text, 'en');
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it('accepts a well-structured Polish report', () => {
    const text = `
Podsumowanie
Rekomendujemy X, bo najlepiej balansuje szybkość vs ryzyko. Jeśli nic nie zrobimy, koszt status quo rośnie.

Ramy problemu
Horyzont decyzyjny: 3 miesiące. Interesariusze: operacje + finanse. Jeśli nic nie zrobimy: rośnie ryzyko utraty klientów.

Opcje
- Wariant A
- Wariant B

Trade-offy / kompromisy
Wariant A jest szybszy kosztem ryzyka operacyjnego; Wariant B wolniejszy, ale stabilniejszy.

Rekomendacja
Zrób A pod warunkiem Z; chyba że nastąpi X — wtedy wybierz B.

Ryzyka i ślepe plamki
Założenie: zespół ma stabilną przepustowość. Brak danych: lead time dostawców.

Kolejne kroki (checklista)
- Krok 1
- Krok 2
Wczesne sygnały: monitoruj wskaźniki jakości, opóźnienia i reklamacje.
`;
    const r = validateDeepThinkingDoD(text, 'pl');
    expect(r.ok).toBe(true);
  });

  it('requires at least two options when options section present', () => {
    const text = `
Executive Summary
We recommend X. If we do nothing, costs rise.
Problem Framing
If we do nothing: status quo persists.
Options
- Only one
Recommendation
Do A unless Z.
Risks
Assumption: unknown.
Next actions
- Step
Early signals: monitor.
`;
    const r = validateDeepThinkingDoD(text, 'en');
    expect(r.ok).toBe(false);
    expect(r.missing).toContain('min_two_options');
  });

  it('scores a strong report high without rewarding pure length', () => {
    const text = `
Executive Summary
We recommend A because it balances speed vs. risk. If we do nothing, quality degrades.

Problem Framing
Horizon: 6 months. If we do nothing: churn increases. Constraint: budget.

Options
1. A
2. B

Recommendation
Choose A unless budget is cut by >20%.

Risks & Blind spots
Assumption: stable demand. Gap: no baseline for cycle time.

Next actions
- Confirm baseline metrics
- Run pilot
Early signals: monitor defects and lead time.
`;
    const s = scoreDeepThinkingRubric(text, 'en');
    expect(s.total).toBeGreaterThanOrEqual(9);
  });
});

