/**
 * Deck depth (A) — blank-brief decks must NOT degrade every analytical slide to a
 * "data gap" notice when the deck has zero source artifacts (narrative deck by design).
 * Guards the planSlides fix behind the richer blank-brief outline.
 */
import { describe, expect, it } from 'vitest';
import { planSlides } from '../../../server/src/services/slidePlanningEngineService';

const setup = {
  title: 'Diagnoza gotowości na AI',
  audience: 'executive',
  goal: 'decide',
  language: 'pl',
  theme: 'corporate',
  confidentiality: 'internal',
  sourceArtifacts: [],
} as never;

const arcOutline = [
  { intent: 'cover', title: 'Diagnoza', enabled: true },
  { intent: 'root_cause', title: 'Problem i kontekst', keyMessage: 'Jaki problem', enabled: true },
  { intent: 'performance_overview', title: 'Wyniki i analiza', keyMessage: 'Co pokazują dane', enabled: true },
  { intent: 'recommendation_portfolio', title: 'Rekomendacje', keyMessage: 'Co rekomendujemy', enabled: true },
  { intent: 'next_steps', title: 'Kolejne kroki', enabled: true },
] as never[];

describe('Deck outline depth (A) — blank-brief narrative deck', () => {
  it('zero źródeł → ZERO degradacji "data gap" (narracja, nie data-bound)', () => {
    const res = planSlides({ setup, outline: arcOutline });
    expect(res.evidenceGaps).toHaveLength(0);
    const degraded = res.outline.filter((o) => (o as any).fallbackPolicy === 'degradation_notice');
    expect(degraded).toHaveLength(0);
  });

  it('zachowuje keyMessage z outline (brak placeholderów "Key message for")', () => {
    const res = planSlides({ setup, outline: arcOutline });
    const problem = res.outline.find((o) => o.intent === 'root_cause');
    expect(problem?.keyMessage).toBe('Jaki problem');
    expect(problem?.keyMessage).not.toContain('Key message for');
  });

  it('z źródłami: index-fallback przypisuje źródło → też brak fałszywego gapu (regresja)', () => {
    const withSources = { ...setup, sourceArtifacts: [{ type: 'kpi_roi', id: 's1', label: 'KPI' }] } as never;
    const res = planSlides({ setup: withSources, outline: arcOutline });
    // planSlides ma index-fallback (sources[i % len]) — slajdy dostają źródło,
    // więc ścieżka z-źródłami pozostaje bez zmian po moim guardzie.
    expect(res.evidenceGaps).toHaveLength(0);
  });
});
