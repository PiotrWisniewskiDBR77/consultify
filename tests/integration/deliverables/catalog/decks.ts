/**
 * decks — katalog 30 scenariuszy M19 (prezentacje) jako executable TS.
 * Każdy wpis: meta + criteria + mockPass (known-good DeckLayoutDirectorResult).
 *
 * Źródło criteria: docs/qa/deliverables/scenarios/M19_DECKS.md
 */

import type { DeckCatalogEntry } from './catalogTypes.js';
import { deckPlan, withCoverKeywords, withAnyKeyword } from './builders.js';

const e = (
  id: string,
  tier: any,
  title: string,
  intent: string,
  criteria: any,
  mockPass: any
): DeckCatalogEntry => ({
  meta: { id, tier, title, intent, context: {} },
  criteria: { scenarioId: id, ...criteria },
  mockPass,
});

export const DECK_SCENARIOS: DeckCatalogEntry[] = [
  // ── Tier 1 — Sml ──────────────────────────────────────────────
  e(
    'M19.S01',
    'Sml',
    'Cover-only welcome slide',
    'Slajd otwierający dla prezentacji o cyfryzacji w MŚP',
    {
      minSlides: 1,
      maxSlides: 1,
      sequence: { 0: 'cover' },
      coverTitleContainsAny: ['cyfryzacja', 'MŚP'],
      requireSinglePalette: true,
      requireAllLlm: true,
      imageBriefMinSlides: 1,
    },
    withCoverKeywords(deckPlan(['cover'], 'harvard'), ['cyfryzacja', 'MŚP'])
  ),
  e(
    'M19.S02',
    'Sml',
    'Pojedyncze key_messages (3 slajdy)',
    '3 kluczowe wiadomości z diagnozy procesu rekrutacji',
    {
      minSlides: 3,
      maxSlides: 4,
      sequence: { 0: 'cover', last: 'next_steps' },
      keyMessageMinChars: 15,
    },
    deckPlan(['cover', 'key_messages', 'next_steps'], 'ocean')
  ),
  e(
    'M19.S03',
    'Sml',
    'Single comparison (2 slajdy)',
    'Porównaj 2 dostawców HR-tech: ATS-A vs ATS-B',
    {
      minSlides: 2,
      maxSlides: 2,
      sequence: { 1: 'comparison' },
      anyKeyMessageContains: ['ATS-A', 'ATS-B'],
      requireAllLlm: true,
    },
    withAnyKeyword(deckPlan(['cover', 'comparison'], 'slate'), ['ATS-A', 'ATS-B'])
  ),
  e(
    'M19.S04',
    'Sml',
    'Cover + single insight + next steps',
    'Najważniejszy insight z badania satysfakcji + co dalej (3 slajdy)',
    {
      minSlides: 3,
      maxSlides: 3,
      sequence: { 0: 'cover', 1: 'single_insight', 2: 'next_steps' },
      keyMessageMinChars: 20,
    },
    deckPlan(['cover', 'single_insight', 'next_steps'], 'forest')
  ),
  e(
    'M19.S05',
    'Sml',
    'Executive summary stand-alone',
    'Jednostronicowe streszczenie wykonawcze dla zarządu (1 slajd)',
    {
      minSlides: 1,
      maxSlides: 1,
      sequence: { 0: 'executive_summary' },
      coverTitleContainsAny: ['zarząd', 'kierownictwo', 'exec'],
      requireAllLlm: true,
    },
    withCoverKeywords(deckPlan(['executive_summary'], 'midnight'), ['zarząd'])
  ),

  // ── Tier 2 — Med ──────────────────────────────────────────────
  e(
    'M19.S06',
    'Med',
    'Diagnoza procesu HR (7 slajdów)',
    'Diagnoza procesu rekrutacji ACME: cover + status + 3 problemy + 1 rekomendacja + next_steps',
    {
      minSlides: 6,
      maxSlides: 8,
      sequence: { 0: 'cover', last: 'next_steps' },
      requireLayoutAtLeast: [
        { intent: 'executive_summary', min: 1 },
        { intent: 'recommendation_single', min: 1 },
        { intent: 'single_insight', min: 1 },
      ],
      coverTitleContainsAny: ['ACME'],
      imageBriefMinSlides: 3,
    },
    withCoverKeywords(
      deckPlan(
        ['cover', 'executive_summary', 'single_insight', 'single_insight', 'key_messages', 'recommendation_single', 'next_steps'],
        'harvard'
      ),
      ['ACME']
    )
  ),
  e(
    'M19.S07',
    'Med',
    'Comparison-heavy deck (4 dostawców)',
    'Porównaj 4 dostawców LMS: TalentLMS, Docebo, SAP SuccessFactors, Cornerstone',
    {
      minSlides: 5,
      maxSlides: 7,
      requireLayoutAtLeast: [{ intent: 'comparison', min: 2 }],
      minDistinctLayouts: 3,
      noTripleRun: true,
    },
    // 4 comparison ale przerywane assessment → no triple-run
    deckPlan(['cover', 'comparison', 'assessment', 'comparison', 'comparison', 'next_steps'], 'indigo')
  ),
  e(
    'M19.S08',
    'Med',
    'Roadmap + initiative portfolio (6 slajdów)',
    'Roadmapa wdrożenia AI w call center na 2 lata + portfolio 5 inicjatyw',
    {
      minSlides: 5,
      maxSlides: 7,
      requireLayoutAtLeast: [
        { intent: 'roadmap', min: 1 },
        { intent: 'initiative_portfolio', min: 1 },
        { intent: 'prioritization_matrix', min: 1 },
      ],
      imageBriefMinSlides: 4,
    },
    deckPlan(['cover', 'roadmap', 'initiative_portfolio', 'prioritization_matrix', 'key_messages', 'next_steps'], 'teal')
  ),
  e(
    'M19.S09',
    'Med',
    'Risk management deck (5 slajdów)',
    'Mapa ryzyk wdrożenia ERP w Apatorze: 5 głównych ryzyk + plan mitygacji',
    {
      minSlides: 4,
      maxSlides: 6,
      requireLayoutAtLeast: [
        { intent: 'risk_management', min: 1 },
        { intent: 'recommendation_single', min: 1 },
      ],
      coverTitleContainsAll: ['Apator', 'ERP'],
      requireAllLlm: true,
      preferredPalettes: ['ember', 'burgundy'],
    },
    withCoverKeywords(
      deckPlan(['cover', 'risk_management', 'single_insight', 'recommendation_single', 'next_steps'], 'ember'),
      ['Apator', 'ERP']
    )
  ),
  e(
    'M19.S10',
    'Med',
    'Root cause + recommendation (6 slajdów)',
    'Analiza root cause spadku NPS w VTS + rekomendacja portfolio działań',
    {
      minSlides: 5,
      maxSlides: 7,
      requireLayoutAtLeast: [
        { intent: 'root_cause', min: 1 },
        { intent: 'recommendation_portfolio', min: 1 },
      ],
      coverTitleContainsAll: ['VTS', 'NPS'],
      minDistinctLayouts: 4,
    },
    withCoverKeywords(
      deckPlan(['cover', 'executive_summary', 'root_cause', 'recommendation_portfolio', 'key_messages', 'next_steps'], 'slate'),
      ['VTS', 'NPS']
    )
  ),
  e(
    'M19.S11',
    'Med',
    'Assessment matrix (8 slajdów)',
    'Ocena 6 inicjatyw cyfryzacji wg matrycy impact×effort',
    {
      minSlides: 7,
      maxSlides: 9,
      requireLayoutAtLeast: [
        { intent: 'prioritization_matrix', min: 1 },
        { intent: 'assessment', min: 1 },
        { intent: 'initiative_portfolio', min: 1 },
      ],
      minDistinctLayouts: 5,
      noTripleRun: true,
    },
    deckPlan(
      ['cover', 'executive_summary', 'initiative_portfolio', 'assessment', 'prioritization_matrix', 'single_insight', 'key_messages', 'next_steps'],
      'graphite'
    )
  ),
  e(
    'M19.S12',
    'Med',
    'Performance overview KPI deck (5 slajdów)',
    'Wyniki kwartalne Elkomtech Q3: 4 KPI + komentarz CFO',
    {
      minSlides: 4,
      maxSlides: 6,
      requireLayoutAtLeast: [
        { intent: 'performance_overview', min: 1 },
        { intent: 'executive_summary', min: 1 },
      ],
      anyKeyMessageContains: ['Q3', 'kwartał'],
      preferredPalettes: ['harvard', 'slate', 'midnight'],
    },
    withAnyKeyword(
      deckPlan(['cover', 'executive_summary', 'performance_overview', 'key_messages', 'next_steps'], 'midnight'),
      ['Q3']
    )
  ),
  e(
    'M19.S13',
    'Med',
    'Section-bridged deck',
    'Prezentacja 2-częściowa: część 1 status, część 2 plan (6 slajdów z section_intro)',
    {
      minSlides: 5,
      maxSlides: 7,
      requireLayoutAtLeast: [{ intent: 'section_intro', min: 1 }],
      noTripleRun: true,
    },
    deckPlan(['cover', 'performance_overview', 'section_intro', 'roadmap', 'key_messages', 'next_steps'], 'arctic')
  ),
  e(
    'M19.S14',
    'Med',
    'Appendix + main (7 slajdów)',
    'Pełna prezentacja + 1 slajd appendix z metodologią',
    {
      minSlides: 6,
      maxSlides: 8,
      sequence: { 0: 'cover', last: 'appendix' },
    },
    deckPlan(['cover', 'executive_summary', 'single_insight', 'comparison', 'recommendation_single', 'next_steps', 'appendix'], 'sand')
  ),
  e(
    'M19.S15',
    'Med',
    'Bilingual labels (PL+EN deck)',
    'Bilingual deck (PL primary + EN subtitle on each slide)',
    {
      minSlides: 5,
      maxSlides: 8,
      coverTitleContainsAll: ['Strategia', 'Strategy'],
    },
    withCoverKeywords(
      deckPlan(['cover', 'executive_summary', 'key_messages', 'single_insight', 'recommendation_single', 'next_steps'], 'harvard'),
      ['Strategia', 'Strategy']
    )
  ),

  // ── Tier 3 — Lrg ──────────────────────────────────────────────
  e(
    'M19.S16',
    'Lrg',
    'Full diagnostic deck 12 slides',
    'Pełna diagnoza Apator Powogaz: exec summary, 3 obszary, 5 rekomendacji, roadmapa, ryzyko, next steps',
    {
      minSlides: 10,
      maxSlides: 14,
      sequence: { 0: 'cover', last: 'next_steps' },
      requireLayoutAtLeast: [
        { intent: 'executive_summary', min: 1 },
        { intent: 'root_cause', min: 1 },
        { intent: 'recommendation_portfolio', min: 1 },
        { intent: 'roadmap', min: 1 },
        { intent: 'risk_management', min: 1 },
      ],
      minDistinctLayouts: 8,
      noTripleRun: true,
      imageBriefMinSlides: 6,
    },
    deckPlan(
      ['cover', 'executive_summary', 'section_intro', 'single_insight', 'root_cause', 'comparison', 'recommendation_portfolio', 'initiative_portfolio', 'roadmap', 'risk_management', 'key_messages', 'next_steps'],
      'midnight'
    )
  ),
  e(
    'M19.S17',
    'Lrg',
    'Strategic plan 15-slide',
    'Plan strategiczny VTS Group 2026-2028: 5 priorytetów + 3 enablery + ryzyka + KPI',
    {
      minSlides: 13,
      maxSlides: 16,
      requireLayoutAtLeast: [
        { intent: 'initiative_portfolio', min: 1 },
        { intent: 'recommendation_portfolio', min: 1 },
        { intent: 'risk_management', min: 1 },
        { intent: 'performance_overview', min: 1 },
        { intent: 'roadmap', min: 1 },
      ],
      minDistinctLayouts: 8,
      noTripleRun: true,
    },
    deckPlan(
      ['cover', 'executive_summary', 'section_intro', 'initiative_portfolio', 'prioritization_matrix', 'recommendation_portfolio', 'single_insight', 'performance_overview', 'roadmap', 'risk_management', 'assessment', 'key_messages', 'comparison', 'next_steps'],
      'indigo'
    )
  ),
  e(
    'M19.S18',
    'Lrg',
    'Quarterly review 14 slides',
    'Q3 deep-dive Elkomtech: 8 KPI breakdownów + komentarz + plan korekt',
    {
      minSlides: 12,
      maxSlides: 16,
      requireLayoutAtLeast: [
        { intent: 'performance_overview', min: 3 },
        { intent: 'root_cause', min: 1 },
        { intent: 'recommendation_single', min: 1 },
      ],
      minDistinctLayouts: 8,
      noTripleRun: true,
    },
    deckPlan(
      ['cover', 'executive_summary', 'performance_overview', 'single_insight', 'performance_overview', 'comparison', 'performance_overview', 'root_cause', 'assessment', 'performance_overview', 'recommendation_single', 'key_messages', 'roadmap', 'next_steps'],
      'slate'
    )
  ),
  e(
    'M19.S19',
    'Lrg',
    'Industry benchmark 12 slides',
    'Benchmark technologii ATS: 5 dostawców na 6 wymiarach',
    {
      minSlides: 10,
      maxSlides: 14,
      requireLayoutAtLeast: [{ intent: 'comparison', min: 3 }, { intent: 'recommendation_single', min: 1 }],
      minDistinctLayouts: 6,
      noTripleRun: true,
    },
    deckPlan(
      ['cover', 'executive_summary', 'comparison', 'assessment', 'comparison', 'assessment', 'comparison', 'assessment', 'comparison', 'single_insight', 'recommendation_single', 'next_steps'],
      'graphite'
    )
  ),
  e(
    'M19.S20',
    'Lrg',
    'Process redesign 13 slides',
    'Redesign procesu obsługi klienta: as-is, gap, to-be, plan wdrożenia',
    {
      minSlides: 11,
      maxSlides: 15,
      requireLayoutAtLeast: [
        { intent: 'section_intro', min: 2 },
        { intent: 'root_cause', min: 1 },
        { intent: 'roadmap', min: 1 },
        { intent: 'recommendation_portfolio', min: 1 },
      ],
      minDistinctLayouts: 7,
    },
    deckPlan(
      ['cover', 'executive_summary', 'section_intro', 'single_insight', 'root_cause', 'comparison', 'section_intro', 'recommendation_portfolio', 'initiative_portfolio', 'roadmap', 'risk_management', 'key_messages', 'next_steps'],
      'ocean'
    )
  ),
  e(
    'M19.S21',
    'Lrg',
    'Risk-first deck 12 slides',
    'Audyt ryzyk wdrożenia Salesforce w VTS: 8 ryzyk + plan mitygacji + governance',
    {
      minSlides: 10,
      maxSlides: 14,
      requireLayoutAtLeast: [
        { intent: 'risk_management', min: 3 },
        { intent: 'recommendation_portfolio', min: 1 },
      ],
      minDistinctLayouts: 7,
      noTripleRun: true,
      preferredPalettes: ['ember', 'burgundy'],
    },
    deckPlan(
      ['cover', 'executive_summary', 'risk_management', 'root_cause', 'risk_management', 'single_insight', 'risk_management', 'assessment', 'recommendation_portfolio', 'roadmap', 'key_messages', 'next_steps'],
      'burgundy'
    )
  ),
  e(
    'M19.S22',
    'Lrg',
    'Innovation pipeline 14 slides',
    'Pipeline innowacji R&D Apator 2026: 6 inicjatyw w 3 stagach',
    {
      minSlides: 12,
      maxSlides: 16,
      requireLayoutAtLeast: [
        { intent: 'initiative_portfolio', min: 1 },
        { intent: 'prioritization_matrix', min: 1 },
        { intent: 'roadmap', min: 1 },
        { intent: 'section_intro', min: 1 },
      ],
      minDistinctLayouts: 8,
      preferredPalettes: ['indigo', 'teal'],
    },
    deckPlan(
      ['cover', 'executive_summary', 'section_intro', 'initiative_portfolio', 'single_insight', 'prioritization_matrix', 'section_intro', 'assessment', 'comparison', 'roadmap', 'recommendation_portfolio', 'risk_management', 'key_messages', 'next_steps'],
      'teal'
    )
  ),
  e(
    'M19.S23',
    'Lrg',
    'Cross-functional alignment 11 slides',
    'Cross-functional alignment HR+IT+Finance dla wdrożenia HRIS',
    {
      minSlides: 9,
      maxSlides: 13,
      requireLayoutAtLeast: [
        { intent: 'section_intro', min: 1 },
        { intent: 'recommendation_portfolio', min: 1 },
      ],
      minDistinctLayouts: 7,
    },
    deckPlan(
      ['cover', 'executive_summary', 'section_intro', 'single_insight', 'section_intro', 'comparison', 'section_intro', 'recommendation_portfolio', 'roadmap', 'key_messages', 'next_steps'],
      'arctic'
    )
  ),
  e(
    'M19.S24',
    'Lrg',
    'Maturity assessment 13 slides',
    'Ocena dojrzałości danych: 5 wymiarów × 4 poziomy',
    {
      minSlides: 11,
      maxSlides: 15,
      requireLayoutAtLeast: [
        { intent: 'assessment', min: 2 },
        { intent: 'key_messages', min: 1 },
        { intent: 'recommendation_portfolio', min: 1 },
      ],
      minDistinctLayouts: 7,
    },
    deckPlan(
      ['cover', 'executive_summary', 'assessment', 'single_insight', 'assessment', 'prioritization_matrix', 'comparison', 'assessment', 'key_messages', 'recommendation_portfolio', 'roadmap', 'risk_management', 'next_steps'],
      'olive'
    )
  ),
  e(
    'M19.S25',
    'Lrg',
    'Customer journey 14 slides',
    'Customer journey klienta B2B: 6 touchpointów + pain points + opportunities',
    {
      minSlides: 12,
      maxSlides: 16,
      requireLayoutAtLeast: [
        { intent: 'single_insight', min: 2 },
        { intent: 'root_cause', min: 1 },
        { intent: 'recommendation_portfolio', min: 1 },
        { intent: 'roadmap', min: 1 },
      ],
      minDistinctLayouts: 7,
    },
    deckPlan(
      ['cover', 'executive_summary', 'section_intro', 'single_insight', 'single_insight', 'root_cause', 'comparison', 'assessment', 'recommendation_portfolio', 'initiative_portfolio', 'roadmap', 'risk_management', 'key_messages', 'next_steps'],
      'forest'
    )
  ),

  // ── Tier 4 — Xtr ──────────────────────────────────────────────
  e(
    'M19.S26',
    'Xtr',
    'Board presentation 18 slides',
    'Prezentacja zarządcza dla rady nadzorczej VTS Group: strategia 5-letnia, finanse, ryzyko, sukcesja',
    {
      minSlides: 17,
      maxSlides: 20,
      requireLayoutAtLeast: [
        { intent: 'executive_summary', min: 1 },
        { intent: 'performance_overview', min: 2 },
        { intent: 'initiative_portfolio', min: 2 },
        { intent: 'risk_management', min: 1 },
        { intent: 'roadmap', min: 1 },
        { intent: 'appendix', min: 1 },
      ],
      minDistinctLayouts: 9,
      noTripleRun: true,
      imageBriefMinSlides: 10,
      preferredPalettes: ['harvard', 'slate', 'midnight'],
    },
    deckPlan(
      ['cover', 'executive_summary', 'section_intro', 'performance_overview', 'single_insight', 'performance_overview', 'initiative_portfolio', 'prioritization_matrix', 'initiative_portfolio', 'comparison', 'assessment', 'recommendation_portfolio', 'roadmap', 'risk_management', 'root_cause', 'key_messages', 'next_steps', 'appendix'],
      'midnight'
    )
  ),
  e(
    'M19.S27',
    'Xtr',
    'Multi-section IPO pitch 20 slides',
    'Pitch IPO dla inwestorów: company, market, product, team, finanse, plan, risks',
    {
      minSlides: 18,
      maxSlides: 22,
      requireLayoutAtLeast: [
        { intent: 'section_intro', min: 3 },
        { intent: 'performance_overview', min: 2 },
        { intent: 'initiative_portfolio', min: 1 },
        { intent: 'risk_management', min: 1 },
        { intent: 'appendix', min: 1 },
      ],
      minDistinctLayouts: 9,
      imageBriefMinSlides: 12,
      preferredPalettes: ['indigo', 'midnight', 'teal'],
    },
    deckPlan(
      ['cover', 'executive_summary', 'section_intro', 'single_insight', 'section_intro', 'comparison', 'assessment', 'section_intro', 'initiative_portfolio', 'performance_overview', 'performance_overview', 'section_intro', 'roadmap', 'prioritization_matrix', 'recommendation_portfolio', 'risk_management', 'root_cause', 'key_messages', 'next_steps', 'appendix'],
      'indigo'
    )
  ),
  e(
    'M19.S28',
    'Xtr',
    'Constraint: 0 use of key_messages',
    'Diagnoza HR 16 slajdów BEZ użycia generycznego layoutu key_messages',
    {
      minSlides: 15,
      maxSlides: 18,
      forbidLayouts: ['key_messages'],
      minDistinctLayouts: 10,
      noTripleRun: true,
    },
    deckPlan(
      ['cover', 'executive_summary', 'section_intro', 'single_insight', 'root_cause', 'comparison', 'assessment', 'prioritization_matrix', 'initiative_portfolio', 'recommendation_single', 'recommendation_portfolio', 'roadmap', 'risk_management', 'performance_overview', 'next_steps', 'appendix'],
      'graphite'
    )
  ),
  e(
    'M19.S29',
    'Xtr',
    'Multilingual board deck (PL+EN+DE)',
    'Multilingual deck rady: PL primary, EN+DE subtitles, 16 slajdów, finanse rok-do-roku',
    {
      minSlides: 15,
      maxSlides: 18,
      requireLayoutAtLeast: [
        { intent: 'performance_overview', min: 2 },
        { intent: 'appendix', min: 1 },
      ],
      anyKeyMessageContains: ['PL/EN/DE', 'Strategia/Strategy/Strategie'],
      minDistinctLayouts: 9,
      preferredPalettes: ['harvard', 'slate'],
    },
    withAnyKeyword(
      deckPlan(
        ['cover', 'executive_summary', 'section_intro', 'performance_overview', 'single_insight', 'performance_overview', 'comparison', 'assessment', 'initiative_portfolio', 'recommendation_portfolio', 'roadmap', 'risk_management', 'root_cause', 'key_messages', 'next_steps', 'appendix'],
        'harvard'
      ),
      ['Strategia/Strategy/Strategie']
    )
  ),
  e(
    'M19.S30',
    'Xtr',
    'Adversarial: kontrastowe wymagania CEO+CFO',
    'Slajdy dla mieszanego audytorium CEO (wizjonerskie) i CFO (ostrożne, dane): 16 slajdów wyważone',
    {
      minSlides: 15,
      maxSlides: 18,
      requireLayoutAtLeast: [
        { intent: 'executive_summary', min: 1 },
        { intent: 'performance_overview', min: 2 },
        { intent: 'risk_management', min: 1 },
        { intent: 'recommendation_portfolio', min: 1 },
      ],
      minDistinctLayouts: 8,
      noTripleRun: true,
      preferredPalettes: ['indigo'],
    },
    deckPlan(
      ['cover', 'executive_summary', 'section_intro', 'performance_overview', 'single_insight', 'performance_overview', 'initiative_portfolio', 'comparison', 'assessment', 'recommendation_portfolio', 'roadmap', 'risk_management', 'root_cause', 'key_messages', 'prioritization_matrix', 'next_steps'],
      'indigo'
    )
  ),
];
