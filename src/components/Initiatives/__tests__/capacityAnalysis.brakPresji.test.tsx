/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/standard/StandardArtifactShell', () => ({
  StandardArtifactShell: ({ sections }: any) => <>{sections.map((section: any) => <section key={section.id}>{section.component}</section>)}</>,
}));
import { CapacityAnalysisCard } from '../cards/CapacityAnalysisCard';

const scenario = {
  scenarioId: 'capacity-123456789',
  name: 'Analiza mocy',
  status: 'PUBLISHED' as const,
  scenarioVersion: 1,
  planScenarioId: 'plan-123456789',
  planScenarioVersion: 1,
  periods: [],
  proposedAssignments: [],
  constraints: [],
  publishedAt: '2026-09-06',
};

describe('P11 — brak presji', () => {
  it('pokazuje polski komunikat zamiast pustego ekranu lub błędu', () => {
    render(<CapacityAnalysisCard noPressure onBack={() => undefined} onAnalyze={() => undefined} onPublish={() => undefined} scenario={scenario} />);
    // P15-K5: komunikat przeszedl na klucz i18n `initiatives.capacityAdvisor.noPressure`
    // (wymog pl+en); w tescie bez zaladowanych zasobow renderuje sie wartosc domyslna.
    expect(screen.getByRole('status')).toHaveTextContent(/Brak przeciążeń do rozwiązania/);
  });
});

/**
 * [ODMROZENIE 05_INITIATIVES DEC-421] P15-K5, test (j) z §6 paczki P15:
 * „Propozycje zmian" renderuja WARIANTY Z ODPOWIEDZI doradcy, nie stale zdanie.
 */
const wariant = (kind: 'RESEQUENCE' | 'SCOPE_SPLIT' | 'ADD_CAPACITY', rationale: string) => ({
  optionId: `opt-${kind}`,
  kind,
  assumptions: [],
  affectedMemberships: [],
  affectedPeriods: ['Tydzień 1'],
  affectedResources: [{ resourceRef: 'controls-engineer', version: 1 }],
  impact: {
    date: { low: null, base: null, high: null, unit: 'periods', knowledgeState: 'UNKNOWN' as const, confidence: 'UNKNOWN' as const, sourceRefs: [] },
    scope: { low: null, base: null, high: null, unit: 'items', knowledgeState: 'UNKNOWN' as const, confidence: 'UNKNOWN' as const, sourceRefs: [] },
    cost: { low: null, base: null, high: null, unit: 'PLN', knowledgeState: 'UNKNOWN' as const, confidence: 'UNKNOWN' as const, sourceRefs: [] },
    risk: { low: null, base: null, high: null, unit: 'score', knowledgeState: 'UNKNOWN' as const, confidence: 'UNKNOWN' as const, sourceRefs: [] },
  },
  rationale,
});

describe('P15-K5 — propozycje zmian z doradcy', () => {
  it('(j) renderuje 3 warianty z odpowiedzi, z nazwa przeciazonej roli', () => {
    render(
      <CapacityAnalysisCard
        onBack={() => undefined}
        onAnalyze={() => undefined}
        onPublish={() => undefined}
        scenario={scenario}
        comparisons={[
          {
            version: 1,
            comparisonId: 'advisor-capacity-1',
            planRef: { scenarioId: 'plan-123456789', version: 1 },
            capacityRef: { scenarioId: 'capacity-123456789', version: 1 },
            status: 'DRAFT',
            options: [
              wariant('RESEQUENCE', 'Przesuń kolejność prac dla zasobu rola Controls Engineer'),
              wariant('SCOPE_SPLIT', 'Wydziel 5 elementów popytu dla zasobu rola Controls Engineer'),
              wariant('ADD_CAPACITY', 'Uzupełnij brak podaży dla zasobu rola Controls Engineer'),
            ],
            selectedOptionId: null,
            nextGovernedInput: null,
          },
        ]}
      />
    );
    // MUTACJA: zastap panel stalym zdaniem („Uruchom Pracuj z AI…") -> RED.
    expect(screen.getAllByRole('region', { name: /^Opcja obciążenia:/ })).toHaveLength(3);
    expect(screen.getByText(/Przesuń kolejność prac dla zasobu rola Controls Engineer/)).toBeInTheDocument();
    expect(screen.getAllByText(/Controls Engineer/).length).toBeGreaterThanOrEqual(3);
  });

  it('bez odpowiedzi doradcy mowi wprost, ze porownania nie ma', () => {
    render(<CapacityAnalysisCard onBack={() => undefined} onAnalyze={() => undefined} onPublish={() => undefined} scenario={scenario} />);
    expect(screen.getByText(/Brak zapisanego porównania/)).toBeInTheDocument();
  });
});

/** Arkusz okres x rola — liczby i zrodlo podazy widoczne w karcie. */
describe('P15-K5 — arkusz okres x rola w karcie', () => {
  const range = (base: number | null) => ({ knowledgeState: base === null ? 'UNKNOWN' : 'KNOWN', base });
  it('rysuje wiersz per (okres, rola) z luka i zrodlem podazy', () => {
    render(
      <CapacityAnalysisCard
        onBack={() => undefined}
        onAnalyze={() => undefined}
        onPublish={() => undefined}
        scenario={{
          ...scenario,
          status: 'DRAFT',
          periods: [
            {
              periodId: 'Tydzień 1',
              demand: range(5.2),
              supply: range(5.5),
              roles: [
                { roleId: 'controls-engineer', roleLabel: 'Controls Engineer', demand: 5, supply: 2.5, supplySource: 'RESOURCE_PLAN', demandSource: 'PLAN' },
                { roleId: 'analityk', roleLabel: 'Analityk', demand: 0.2, supply: 2, supplySource: 'RESOURCE_PLAN', demandSource: 'PLAN' },
                { roleId: 'spawacz', roleLabel: 'Spawacz', demand: 1, supply: null, supplySource: 'UNKNOWN', demandSource: 'PLAN' },
              ],
            },
          ],
        }}
      />
    );
    // Suma okresu (5,2 wobec 5,5) NIE pokazuje luki — pokazuje ja dopiero rola.
    expect(screen.getAllByRole('row')).toHaveLength(4);
    expect(screen.getAllByText('Controls Engineer').length).toBeGreaterThanOrEqual(1);
    // Luka roli ujemna; separator dziesietny zalezy od jezyka i18n w tescie.
    expect(screen.getByText(/^-2[.,]5$/)).toBeInTheDocument();
    // Rola bez ani jednej osoby: „Nieznane", nigdy zero.
    expect(screen.getAllByText('Nieznane').length).toBeGreaterThanOrEqual(1);
  });
});
