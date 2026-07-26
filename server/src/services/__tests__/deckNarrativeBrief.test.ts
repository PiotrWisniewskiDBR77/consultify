import { afterEach, describe, expect, it } from 'vitest';

import {
  buildTemplateBriefingInstruction,
  getNarrativeRewriteIntents,
  NARRATIVE_REWRITE_INTENTS,
  NARRATIVE_REWRITE_INTENTS_EXTENDED,
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
});

/**
 * FALA D (2026-07-26, "deck-narrative-depth") — bez briefu/instrukcji, na
 * ścieżce Kreator (real sourceArtifacts), bramka domyślna teraz obejmuje 5
 * dodatkowych intencji arc (root_cause/single_insight/performance_overview/
 * roadmap/risk_management) — DOKŁADNIE ten sam zestaw, który `resolveDeckNarrativeBrief`
 * + `shouldRunNarrativeRewrite`'s free-text branch już odblokowywały na
 * ścieżce czatu. Kill-switch `ENABLE_DECK_NARRATIVE_EXTENDED='false'` wraca do
 * historycznych 4 intencji bez deployu.
 */
describe('shouldRunNarrativeRewrite / getNarrativeRewriteIntents — domyślna bramka Kreatora (FALA D)', () => {
  afterEach(() => {
    delete process.env.ENABLE_DECK_NARRATIVE_EXTENDED;
  });

  it('domyślnie (flaga nieustawiona = ON): 5 nowych intencji arc + 4 historyczne', () => {
    delete process.env.ENABLE_DECK_NARRATIVE_EXTENDED;
    expect(shouldRunNarrativeRewrite('root_cause')).toBe(true);
    expect(shouldRunNarrativeRewrite('single_insight')).toBe(true);
    expect(shouldRunNarrativeRewrite('performance_overview')).toBe(true);
    expect(shouldRunNarrativeRewrite('roadmap')).toBe(true);
    expect(shouldRunNarrativeRewrite('risk_management')).toBe(true);
    expect(shouldRunNarrativeRewrite('executive_summary')).toBe(true);
    expect(shouldRunNarrativeRewrite('key_messages')).toBe(true);
    expect(shouldRunNarrativeRewrite('next_steps')).toBe(true);
    expect(shouldRunNarrativeRewrite('recommendation_portfolio')).toBe(true);
    expect(getNarrativeRewriteIntents()).toEqual(NARRATIVE_REWRITE_INTENTS_EXTENDED);
  });

  it('intencje strukturalne (tabela/matryca) NIE wchodzą do bramki domyślnej', () => {
    for (const intent of [
      'cover',
      'section_intro',
      'appendix',
      'comparison',
      'assessment',
      'initiative_portfolio',
      'prioritization_matrix',
      'recommendation_single',
    ] as const) {
      expect(shouldRunNarrativeRewrite(intent)).toBe(false);
    }
  });

  it("ENABLE_DECK_NARRATIVE_EXTENDED='false' → wraca do zachowania historycznego (4 intencje)", () => {
    process.env.ENABLE_DECK_NARRATIVE_EXTENDED = 'false';
    expect(shouldRunNarrativeRewrite('root_cause')).toBe(false);
    expect(shouldRunNarrativeRewrite('roadmap')).toBe(false);
    expect(shouldRunNarrativeRewrite('single_insight')).toBe(false);
    expect(shouldRunNarrativeRewrite('performance_overview')).toBe(false);
    expect(shouldRunNarrativeRewrite('risk_management')).toBe(false);
    // Legacy 4 stay ON even with the extension flag off.
    expect(shouldRunNarrativeRewrite('executive_summary')).toBe(true);
    expect(shouldRunNarrativeRewrite('key_messages')).toBe(true);
    expect(getNarrativeRewriteIntents()).toEqual(NARRATIVE_REWRITE_INTENTS);
  });

  it('dowolna inna wartość env (nie literalnie "false") NIE wyłącza rozszerzenia (fail-open)', () => {
    process.env.ENABLE_DECK_NARRATIVE_EXTENDED = '0';
    expect(shouldRunNarrativeRewrite('root_cause')).toBe(true);
  });

  it('instrukcja autora nadal odblokowuje KAŻDY slajd nawet z flagą OFF', () => {
    process.env.ENABLE_DECK_NARRATIVE_EXTENDED = 'false';
    expect(shouldRunNarrativeRewrite('comparison', 'przepisz ten slajd')).toBe(true);
  });
});

/**
 * FALA D — Template Architect briefing (keyMessage/dataNeeded) → Narrative
 * Engine `user_instruction`. keyMessage/dataNeeded są dyrektywami
 * STRUKTURALNYMI (jaką tezę otworzyć, jakich danych szukać), nigdy źródłem
 * faktów — L5 post-checks nadal odrzucają niepotwierdzone liczby.
 */
describe('buildTemplateBriefingInstruction — briefing szablonu jako dyrektywa L4', () => {
  it('zwraca null gdy brak keyMessage i dataNeeded', () => {
    expect(buildTemplateBriefingInstruction({}, 'en')).toBeNull();
    expect(buildTemplateBriefingInstruction(undefined, 'en')).toBeNull();
    expect(buildTemplateBriefingInstruction({ keyMessage: '   ' }, 'en')).toBeNull();
  });

  it('keyMessage → instrukcja PL zawiera tezę', () => {
    const out = buildTemplateBriefingInstruction(
      { keyMessage: 'Koszty przekraczają budżet o 12%' },
      'pl'
    );
    expect(out).toContain('Koszty przekraczają budżet o 12%');
    expect(out).toContain('nie zastępuj jej inną tezą');
  });

  it('dataNeeded → instrukcja EN wymienia wskazane dane i zakazuje zmyślania', () => {
    const out = buildTemplateBriefingInstruction(
      { dataNeeded: ['quarterly revenue by segment', 'churn rate'] },
      'en'
    );
    expect(out).toContain('quarterly revenue by segment');
    expect(out).toContain('churn rate');
    expect(out).toContain('do NOT invent them');
  });

  it('filtruje wpisy dataNeeded puste/nie-string', () => {
    const out = buildTemplateBriefingInstruction(
      { dataNeeded: ['real one', '', '   ', 42 as unknown as string, null as unknown as string] },
      'en'
    );
    expect(out).toContain('real one');
    expect(out?.match(/real one/g)?.length).toBe(1);
  });

  it('keyMessage + dataNeeded razem → obie linie obecne', () => {
    const out = buildTemplateBriefingInstruction(
      { keyMessage: 'thesis', dataNeeded: ['data point'] },
      'en'
    );
    expect(out).toContain('thesis');
    expect(out).toContain('data point');
  });
});
