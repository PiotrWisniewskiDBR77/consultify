import { describe, expect, it } from 'vitest';

import {
  resolveDeckNarrativeBrief,
  shouldRunNarrativeRewrite,
} from '../presentationGeneratorService.js';

/**
 * Deck #2 (audyt 2026-07-22) — brief z czatu grounduje temat slajdów, ale TYLKO
 * na ścieżce czatu (brak rich-source), i nigdy jako źródło faktów. Ten test
 * przypina DYSKRYMINATOR chat-vs-Kreator (zero regresji dla decków ze źródłami).
 */
describe('resolveDeckNarrativeBrief — dyskryminator chat vs Kreator', () => {
  it('czat: brief + brak źródeł → zwraca brief (rewrite ON)', () => {
    expect(
      resolveDeckNarrativeBrief({ brief: 'deck dla zarządu o pilocie faktur', sourceArtifacts: [] })
    ).toBe('deck dla zarządu o pilocie faktur');
  });

  it('Kreator: brief + rich source (kpi_roi) → null (rewrite OFF, deck sterowany danymi)', () => {
    expect(
      resolveDeckNarrativeBrief({
        brief: 'deck dla zarządu',
        sourceArtifacts: [{ type: 'kpi_roi', id: 'k1', label: 'KPI' } as never],
      })
    ).toBeNull();
  });

  it('brak briefu → null', () => {
    expect(resolveDeckNarrativeBrief({ sourceArtifacts: [] })).toBeNull();
    expect(resolveDeckNarrativeBrief({ brief: '   ', sourceArtifacts: [] })).toBeNull();
  });

  it('custom placeholder (nie-rich) traktowany jak blank-brief → zwraca brief', () => {
    expect(
      resolveDeckNarrativeBrief({
        brief: 'temat',
        sourceArtifacts: [{ type: 'custom', id: 'c1', label: 'x' } as never],
      })
    ).toBe('temat');
  });
});

describe('shouldRunNarrativeRewrite — brief poszerza bramkę na slajdy arc', () => {
  it('z briefem: dowolny slajd arc wchodzi do Narrative Engine', () => {
    for (const intent of [
      'root_cause',
      'single_insight',
      'performance_overview',
      'roadmap',
      'risk_management',
    ] as const) {
      expect(shouldRunNarrativeRewrite(intent, 'jakiś brief')).toBe(true);
    }
  });
  it('bez briefu: slajdy arc pomijane (legacy), tylko 4 narracyjne', () => {
    expect(shouldRunNarrativeRewrite('root_cause')).toBe(false);
    expect(shouldRunNarrativeRewrite('roadmap')).toBe(false);
    expect(shouldRunNarrativeRewrite('executive_summary')).toBe(true);
    expect(shouldRunNarrativeRewrite('key_messages')).toBe(true);
  });
});
