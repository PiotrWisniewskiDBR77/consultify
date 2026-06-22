/**
 * reports — katalog 30 scenariuszy M18 (raporty) jako executable TS.
 * Źródło criteria: docs/qa/deliverables/scenarios/M18_REPORTS.md
 */

import type { DocCatalogEntry } from './catalogTypes.js';
import {
  doc,
  section,
  heading,
  text,
  callout,
  kpiN,
  chart,
  bulletList,
  numberedList,
  quote,
  tableBlock,
  citations,
} from './builders.js';

const e = (
  id: string,
  tier: any,
  title: string,
  intent: string,
  criteria: any,
  mockPass: any
): DocCatalogEntry => ({
  meta: { id, tier, title, intent, context: {} },
  criteria: { scenarioId: id, ...criteria },
  mockPass,
});

// helper: tabela z N wierszami, opcjonalnie ze stylowanymi komórkami
function tbl(rowCount: number, styledCells = 0): ReturnType<typeof tableBlock> {
  const rows = Array.from({ length: rowCount }, (_, i) => {
    const cells: Record<string, { value?: unknown; style?: { bgColor?: string } }> = {
      col1: { value: `R${i}` },
      col2: { value: i },
    };
    if (i < styledCells) cells.col2.style = { bgColor: '#DC2626' };
    return cells;
  });
  return tableBlock(rows);
}

export const DOC_SCENARIOS: DocCatalogEntry[] = [
  // ── Tier 1 — Sml ──────────────────────────────────────────────
  e(
    'M18.S01',
    'Sml',
    'Single-section memo',
    'Krótki memo do zarządu: stan prac nad wdrożeniem CRM (5 paragrafów)',
    {
      minSections: 1,
      maxSections: 1,
      minBlocks: 5,
      maxBlocks: 7,
      requireBlockType: [{ type: 'heading', min: 1 }],
      requireSectionHeading: ['CRM'],
    },
    doc([
      section('CRM rollout — status memo', [
        heading('CRM rollout — status memo'),
        text('Paragraf 1 kontekstu.'),
        text('Paragraf 2.'),
        text('Paragraf 3.'),
        callout('Kluczowy callout.', 'info'),
      ]),
    ])
  ),
  e(
    'M18.S02',
    'Sml',
    'KPI-only one-pager',
    'Jednostronicowy KPI dashboard: 4 KPI Q3 dla Elkomtech',
    {
      minSections: 1,
      maxSections: 1,
      requireBlockType: [{ type: 'kpi', min: 1 }],
      kpiItemsRange: [3, 5],
    },
    doc([section('KPI Q3', [kpiN(4)])])
  ),
  e(
    'M18.S03',
    'Sml',
    'Single callout warning',
    'Krótki dokument z ostrzeżeniem o ryzyku GDPR (1 callout + 2 paragrafy)',
    {
      minSections: 1,
      maxSections: 1,
      minBlocks: 3,
      maxBlocks: 4,
      requireBlockType: [{ type: 'callout', min: 1 }],
      anyTextContains: ['GDPR', 'RODO'],
    },
    doc([
      section('Ostrzeżenie', [
        callout('Ryzyko GDPR / RODO wykryte w przepływie danych.', 'warning'),
        text('Kontekst 1.'),
        text('Kontekst 2.'),
      ]),
    ])
  ),
  e(
    'M18.S04',
    'Sml',
    'Quote-driven brief',
    'Brief otwierający z cytatem CEO + 3 paragrafy kontekstu',
    {
      minSections: 1,
      maxSections: 1,
      requireBlockType: [{ type: 'quote', min: 1 }, { type: 'text', min: 3 }],
    },
    doc([
      section('Brief', [
        quote('Transformacja to nasz priorytet.', 'CEO'),
        text('Kontekst 1.'),
        text('Kontekst 2.'),
        text('Kontekst 3.'),
      ]),
    ])
  ),
  e(
    'M18.S05',
    'Sml',
    'Bullet-only executive summary',
    'Streszczenie wykonawcze w 5 punktach (sama lista, bez prozy)',
    {
      minSections: 1,
      maxSections: 1,
      minBlocks: 1,
      maxBlocks: 2,
      requireBlockType: [{ type: 'bulletList', min: 1 }],
    },
    doc([section('Streszczenie', [bulletList(['P1', 'P2', 'P3', 'P4', 'P5'])])])
  ),

  // ── Tier 2 — Med ──────────────────────────────────────────────
  e(
    'M18.S06',
    'Med',
    'Diagnoza procesu HR',
    'Diagnoza rekrutacji ACME: wprowadzenie, stan (KPI), 3 problemy (callouts), rekomendacja (lista)',
    {
      minSections: 3,
      maxSections: 5,
      requireBlockType: [
        { type: 'kpi', min: 1 },
        { type: 'callout', min: 2 },
        { type: 'bulletList', min: 1 },
      ],
      requireSectionHeading: ['rekomendacja'],
      kpiItemsRange: [3, 5],
    },
    doc([
      section('Wprowadzenie', [text('Intro.')]),
      section('Stan obecny', [kpiN(4)]),
      section('Problemy', [callout('Problem 1', 'warning'), callout('Problem 2', 'warning')]),
      section('Rekomendacja', [bulletList(['R1', 'R2', 'R3'])]),
    ])
  ),
  e(
    'M18.S07',
    'Med',
    'Quarterly performance report',
    'Raport Q3 Elkomtech: KPI, wykres trendu, komentarz, top 3 issues, plan korekt',
    {
      minSections: 3,
      maxSections: 6,
      requireBlockType: [
        { type: 'kpi', min: 1 },
        { type: 'chart', min: 1, chartKind: 'line' },
        { type: 'bulletList', min: 1 },
      ],
      chartPaletteMax: 7,
      chartSeriesMax: 6,
    },
    doc([
      section('KPI', [kpiN(4)]),
      section('Trend', [chart('line', 2)]),
      section('Issues', [bulletList(['I1', 'I2', 'I3'])]),
      section('Plan korekt', [numberedList(['K1', 'K2'])]),
    ])
  ),
  e(
    'M18.S08',
    'Med',
    'Comparison report 3 dostawców',
    'Porównaj 3 dostawców LMS na 5 kryteriach: wprowadzenie, tabela, rekomendacja',
    {
      minSections: 2,
      maxSections: 4,
      requireBlockType: [{ type: 'table', min: 1 }, { type: 'callout', min: 1 }],
    },
    doc([
      section('Wprowadzenie', [text('Intro porównania.')]),
      section('Porównanie', [tbl(3)]),
      section('Rekomendacja', [callout('Wybór: dostawca B', 'success')]),
    ])
  ),
  e(
    'M18.S09',
    'Med',
    'Risk assessment matrix',
    'Ocena ryzyk wdrożenia ERP: 5 ryzyk, prawdopodobieństwo×wpływ, mitygacje',
    {
      minSections: 2,
      maxSections: 4,
      requireBlockType: [{ type: 'table', min: 1 }, { type: 'callout', min: 1 }],
      minStyledCells: 3,
    },
    doc([
      section('Ryzyka', [tbl(5, 5)]),
      section('Mitygacja', [callout('Najpilniejsze: R1', 'danger')]),
    ])
  ),
  e(
    'M18.S10',
    'Med',
    'Customer feedback synthesis',
    'Synteza 20 wywiadów: tematy, częstość, ilustracje cytatami',
    {
      minSections: 2,
      maxSections: 4,
      requireBlockType: [
        { type: 'chart', min: 1, chartKind: 'bar' },
        { type: 'quote', min: 2 },
        { type: 'kpi', min: 1 },
      ],
      kpiItemsRange: [3, 3],
    },
    doc([
      section('Tematy', [chart('bar', 1), kpiN(3)]),
      section('Głosy klientów', [quote('Świetna obsługa.', 'Klient A'), quote('Za wolno.', 'Klient B')]),
    ])
  ),
  e(
    'M18.S11',
    'Med',
    'Process documentation',
    'Procedura onboardingu: 5 etapów, każdy z opisem + responsibility',
    {
      minSections: 2,
      maxSections: 4,
      requireBlockType: [{ type: 'numberedList', min: 1 }, { type: 'table', min: 1 }],
    },
    doc([
      section('Etapy', [numberedList(['Etap 1 opis ≥30 znaków tutaj.', 'Etap 2 opis dłuższy niż trzydzieści.', 'Etap 3', 'Etap 4', 'Etap 5'])]),
      section('Odpowiedzialności', [tbl(5)]),
    ])
  ),
  e(
    'M18.S12',
    'Med',
    'Strategy memo 4 sekcje',
    'Memo strategiczne: kontekst, 3 priorytety, ryzyka, rekomendowane decyzje',
    {
      minSections: 4,
      maxSections: 4,
      requireBlockType: [{ type: 'callout', min: 1 }, { type: 'bulletList', min: 1 }],
    },
    doc([
      section('Kontekst', [text('Kontekst strategiczny opisany w stu słowach mniej więcej.')]),
      section('Priorytety', [callout('P1', 'info'), callout('P2', 'info'), callout('P3', 'info')]),
      section('Ryzyka', [text('Ryzyka.')]),
      section('Decyzje', [bulletList(['D1', 'D2'])]),
    ])
  ),
  e(
    'M18.S13',
    'Med',
    'Financial analysis',
    'Analiza finansowa: 5 KPI, wykres trendu marży, tabela kosztów per kategoria',
    {
      minSections: 2,
      maxSections: 4,
      requireBlockType: [
        { type: 'kpi', min: 1 },
        { type: 'chart', min: 1, chartKind: 'line' },
        { type: 'table', min: 1 },
      ],
      kpiItemsRange: [5, 5],
    },
    doc([
      section('KPI', [kpiN(5)]),
      section('Marża', [chart('line', 1)]),
      section('Koszty', [tbl(4)]),
    ])
  ),
  e(
    'M18.S14',
    'Med',
    'Research summary multi-source',
    'Streszczenie badań (5 źródeł): finding, evidence, citation',
    {
      minSections: 2,
      maxSections: 4,
      requireBlockType: [{ type: 'bulletList', min: 1 }],
      minCitations: 5,
    },
    doc(
      [
        section('Findings', [bulletList(['Finding 1 [1]', 'Finding 2 [2]', 'Finding 3 [3]'])]),
        section('Evidence', [text('Dowody z [4] i [5].')]),
      ],
      citations(5)
    )
  ),
  e(
    'M18.S15',
    'Med',
    'Compliance report',
    'Status zgodności z 5 wymogami RODO: per wymóg status + dowód + plan',
    {
      minSections: 1,
      maxSections: 3,
      requireBlockType: [{ type: 'table', min: 1 }],
      minStyledCells: 5,
    },
    doc([section('Status RODO', [tbl(5, 5)])])
  ),

  // ── Tier 3 — Lrg ──────────────────────────────────────────────
  e(
    'M18.S16',
    'Lrg',
    'Full diagnostic report 8 sekcji',
    'Pełny raport diagnostyczny Apator: exec summary, kontekst, metodyka, 3 obszary, rekomendacje, roadmapa, ryzyko, appendix',
    {
      minSections: 7,
      maxSections: 9,
      requireBlockType: [
        { type: 'kpi', min: 3 },
        { type: 'callout', min: 3 },
        { type: 'bulletList', min: 1 },
        { type: 'table', min: 1 },
      ],
      kpiItemsRange: [3, 5],
      minDistinctBlockTypes: 5,
    },
    doc([
      section('Executive summary', [heading('Executive summary'), kpiN(3)]),
      section('Kontekst', [text('Kontekst.')]),
      section('Metodyka', [text('Metoda.')]),
      section('Obszar 1', [kpiN(3), callout('Problem 1', 'warning')]),
      section('Obszar 2', [kpiN(3), callout('Problem 2', 'warning')]),
      section('Obszar 3', [kpiN(3), callout('Problem 3', 'danger')]),
      section('Rekomendacje', [bulletList(['R1', 'R2', 'R3'])]),
      section('Roadmapa', [tbl(1)]),
      section('Ryzyka', [tbl(5)]),
    ])
  ),
  e(
    'M18.S17',
    'Lrg',
    'Strategic plan 10 sekcji',
    'Plan strategiczny 2026-2028: wizja, 5 priorytetów, 3 enablery, governance, KPI, ryzyko, roadmapa, finansowanie, sukcesja, appendix',
    {
      minSections: 9,
      maxSections: 11,
      requireBlockType: [
        { type: 'callout', min: 1 },
        { type: 'table', min: 1 },
        { type: 'kpi', min: 1 },
      ],
      minDistinctBlockTypes: 5,
      kpiItemsRange: [3, 5],
    },
    doc([
      section('Wizja', [heading('Wizja'), text('Wizja.')]),
      section('Priorytety', [callout('P1', 'info'), bulletList(['P2', 'P3', 'P4', 'P5'])]),
      section('Enablery', [bulletList(['E1', 'E2', 'E3'])]),
      section('Governance', [text('Governance.')]),
      section('KPI', [kpiN(4)]),
      section('Ryzyko', [tbl(5)]),
      section('Roadmapa', [tbl(3)]),
      section('Finansowanie', [text('Finansowanie.')]),
      section('Sukcesja', [text('Sukcesja.')]),
      section('Appendix', [text('Appendix.')]),
    ])
  ),
  e(
    'M18.S18',
    'Lrg',
    'Industry benchmark 8 sekcji',
    'Benchmark technologii ATS: 5 dostawców × 8 wymiarów + winnik + uzasadnienie + risks',
    {
      minSections: 6,
      maxSections: 10,
      requireBlockType: [
        { type: 'table', min: 1 },
        { type: 'chart', min: 1, chartKind: 'scatter' },
        { type: 'callout', min: 1 },
        { type: 'bulletList', min: 1 },
      ],
      chartPaletteMax: 7,
    },
    doc([
      section('Wprowadzenie', [text('Intro.')]),
      section('Macierz', [tbl(5)]),
      section('Positioning', [chart('scatter', 3)]),
      section('Winner', [callout('Dostawca C', 'success')]),
      section('Rationale', [bulletList(['R1', 'R2'])]),
      section('Ryzyka', [text('Risks.')]),
    ])
  ),
  e(
    'M18.S19',
    'Lrg',
    'Process redesign 9 sekcji',
    'Redesign procesu obsługi klienta: as-is, gap, to-be, plan, governance, ryzyka, KPI, koszty, harmonogram',
    {
      minSections: 7,
      maxSections: 11,
      requireBlockType: [
        { type: 'heading', min: 2 },
        { type: 'table', min: 1 },
        { type: 'callout', min: 1 },
        { type: 'numberedList', min: 1 },
        { type: 'kpi', min: 1 },
      ],
      kpiItemsRange: [3, 5],
    },
    doc([
      section('As-is', [heading('As-is'), callout('Problem 1', 'warning')]),
      section('Gap', [tbl(3)]),
      section('To-be', [heading('To-be'), text('To-be.')]),
      section('Plan wdrożenia', [numberedList(['Faza 1', 'Faza 2'])]),
      section('Governance', [text('Gov.')]),
      section('Ryzyka', [text('Risks.')]),
      section('KPI', [kpiN(3)]),
      section('Koszty', [text('Koszty.')]),
      section('Harmonogram', [tbl(3)]),
    ])
  ),
  e(
    'M18.S20',
    'Lrg',
    'Vendor selection report 7 sekcji',
    'Selekcja dostawcy CRM: 4 kandydatów, criteria, scoring, demo, decision, transition',
    {
      minSections: 5,
      maxSections: 9,
      requireBlockType: [
        { type: 'table', min: 1 },
        { type: 'callout', min: 1 },
        { type: 'numberedList', min: 1 },
        { type: 'kpi', min: 1 },
      ],
      kpiItemsRange: [3, 3],
    },
    doc([
      section('Kandydaci', [tbl(4)]),
      section('Scoring', [tbl(4, 4)]),
      section('Rekomendacja', [callout('Winner: CRM-B', 'success')]),
      section('Transition', [numberedList(['T1', 'T2'])]),
      section('Savings', [kpiN(3)]),
    ])
  ),
  e(
    'M18.S21',
    'Lrg',
    'Annual report 10 sekcji',
    'Roczny raport: highlights, biznes, finanse (3 wykresy), HR, technologia, klienci, ryzyko, ESG, perspektywa, appendix',
    {
      minSections: 9,
      maxSections: 11,
      requireBlockType: [
        { type: 'chart', min: 3 },
        { type: 'kpi', min: 1 },
        { type: 'quote', min: 1 },
        { type: 'table', min: 1 },
      ],
      kpiItemsRange: [3, 5],
    },
    doc([
      section('Highlights', [kpiN(4)]),
      section('Biznes', [text('Biznes.')]),
      section('Finanse', [chart('bar', 2), chart('line', 2), chart('pie', 3)]),
      section('HR', [text('HR.')]),
      section('Technologia', [text('Tech.')]),
      section('Klienci', [quote('Polecam.', 'CEO klienta')]),
      section('Ryzyko', [tbl(3)]),
      section('ESG', [text('ESG.')]),
      section('Perspektywa', [text('Outlook.')]),
      section('Appendix', [text('Appendix.')]),
    ])
  ),
  e(
    'M18.S22',
    'Lrg',
    'Customer journey deep-dive 8 sekcji',
    'Customer journey B2B: 6 touchpointów, pain points, opportunities, plan, ROI projection',
    {
      minSections: 6,
      maxSections: 10,
      requireBlockType: [
        { type: 'bulletList', min: 1 },
        { type: 'callout', min: 3 },
        { type: 'chart', min: 1, chartKind: 'line' },
        { type: 'numberedList', min: 1 },
      ],
    },
    doc([
      section('Touchpointy', [bulletList(['T1', 'T2', 'T3', 'T4', 'T5', 'T6'])]),
      section('Pain points', [callout('P1', 'warning'), callout('P2', 'danger'), callout('P3', 'warning')]),
      section('Opportunities', [text('Opps.')]),
      section('ROI', [chart('line', 1)]),
      section('Plan', [numberedList(['A1', 'A2'])]),
      section('Mierniki', [text('Mierniki sukcesu.')]),
    ])
  ),
  e(
    'M18.S23',
    'Lrg',
    'Audit report 9 sekcji',
    'Audyt bezpieczeństwa IT: 6 obszarów, severity, evidence, recommendations, timeline',
    {
      minSections: 5,
      maxSections: 11,
      requireBlockType: [{ type: 'table', min: 1 }, { type: 'callout', min: 3 }],
      minStyledCells: 4,
    },
    doc([
      section('Obszary', [tbl(6, 6)]),
      section('Critical 1', [callout('Krytyczne C1', 'danger')]),
      section('Critical 2', [callout('Krytyczne C2', 'danger')]),
      section('Critical 3', [callout('Krytyczne C3', 'danger')]),
      section('Timeline', [tbl(3)]),
    ])
  ),
  e(
    'M18.S24',
    'Lrg',
    'Innovation pipeline 8 sekcji',
    'R&D pipeline: 8 inicjatyw w 4 stagach, score, koszt, ETA, ryzyko',
    {
      minSections: 5,
      maxSections: 10,
      requireBlockType: [
        { type: 'table', min: 1 },
        { type: 'chart', min: 1, chartKind: 'bar' },
        { type: 'bulletList', min: 1 },
      ],
      minStyledCells: 8,
    },
    doc([
      section('Pipeline', [tbl(8, 8)]),
      section('Funnel', [chart('bar', 1)]),
      section('Top ranked', [bulletList(['#1', '#2', '#3'])]),
      section('Stage 1', [text('Discovery.')]),
      section('Koszty', [tbl(4)]),
    ])
  ),
  e(
    'M18.S25',
    'Lrg',
    'Talent strategy 9 sekcji',
    'Strategia talentu: rotacja, attrition drivers, employer brand, retention, comp, leadership, DEI, learning, KPI',
    {
      minSections: 6,
      maxSections: 11,
      requireBlockType: [
        { type: 'chart', min: 1, chartKind: 'line' },
        { type: 'callout', min: 3 },
        { type: 'kpi', min: 1 },
        { type: 'bulletList', min: 1 },
      ],
      kpiItemsRange: [3, 5],
    },
    doc([
      section('Attrition', [chart('line', 1)]),
      section('Drivers', [callout('D1', 'warning'), callout('D2', 'warning'), callout('D3', 'danger')]),
      section('KPI', [kpiN(4)]),
      section('Retention', [bulletList(['R1', 'R2'])]),
      section('Employer brand', [text('Brand.')]),
      section('Leadership pipeline', [text('Leadership.')]),
    ])
  ),

  // ── Tier 4 — Xtr ──────────────────────────────────────────────
  e(
    'M18.S26',
    'Xtr',
    'Board-level annual review 14 sekcji',
    'Raport roczny dla rady: 14 sekcji, ≥4 wykresy, ≥3 KPI strips, ≥2 tabele, citations 8+',
    {
      minSections: 13,
      maxSections: 16,
      requireBlockType: [
        { type: 'chart', min: 4 },
        { type: 'kpi', min: 3 },
        { type: 'table', min: 2 },
        { type: 'quote', min: 1 },
      ],
      kpiItemsRange: [3, 5],
      minCitations: 8,
    },
    doc(
      [
        section('S1', [kpiN(4), chart('bar', 2)]),
        section('S2', [chart('line', 2)]),
        section('S3', [kpiN(3)]),
        section('S4', [chart('pie', 3)]),
        section('S5', [tbl(3)]),
        section('S6', [chart('area', 2)]),
        section('S7', [kpiN(3)]),
        section('S8', [tbl(4)]),
        section('S9', [quote('Mocny rok.', 'CEO')]),
        section('S10', [text('t')]),
        section('S11', [text('t')]),
        section('S12', [text('t')]),
        section('S13', [text('t')]),
        section('S14', [text('Appendix')]),
      ],
      citations(8)
    )
  ),
  e(
    'M18.S27',
    'Xtr',
    'IPO prospectus excerpt 12 sekcji',
    'IPO prospectus EN: company, market, product, finances (6 charts), risk factors, use of proceeds, mgmt',
    {
      minSections: 11,
      maxSections: 13,
      requireBlockType: [
        { type: 'chart', min: 6 },
        { type: 'table', min: 1 },
      ],
    },
    doc([
      section('Company', [text('Company.')]),
      section('Market', [chart('bar', 2)]),
      section('Product', [text('Product.')]),
      section('Hist 1', [chart('line', 2)]),
      section('Hist 2', [chart('bar', 2)]),
      section('Hist 3', [chart('area', 2)]),
      section('Proj 1', [chart('line', 2)]),
      section('Proj 2', [chart('line', 2)]),
      section('Proj 3', [chart('area', 2)]),
      section('Risk factors', [tbl(10)]),
      section('Use of proceeds', [text('Proceeds.')]),
      section('Mgmt', [text('Team.')]),
    ])
  ),
  e(
    'M18.S28',
    'Xtr',
    'Constraint: 0 prose (data-only)',
    'Raport BEZ paragrafów prozy — same KPI, tabele, wykresy, callouts',
    {
      minSections: 8,
      maxSections: 12,
      forbidBlockType: ['text'],
      minDistinctBlockTypes: 4,
    },
    doc([
      section('S1', [heading('S1'), kpiN(4)]),
      section('S2', [tbl(3)]),
      section('S3', [chart('bar', 2)]),
      section('S4', [callout('C', 'info')]),
      section('S5', [kpiN(3)]),
      section('S6', [tbl(4)]),
      section('S7', [chart('line', 2)]),
      section('S8', [callout('C2', 'warning')]),
    ])
  ),
  e(
    'M18.S29',
    'Xtr',
    'Multilingual whitepaper PL+EN',
    'Whitepaper bilingual PL+EN (każda sekcja w obu językach), 10 sekcji, 4 wykresy',
    {
      minSections: 9,
      maxSections: 12,
      requireBlockType: [{ type: 'chart', min: 4 }, { type: 'table', min: 1 }],
    },
    doc([
      section('Intro PL/EN', [text('PL ... / EN ...')]),
      section('S2', [chart('bar', 2)]),
      section('S3', [chart('line', 2)]),
      section('S4', [chart('pie', 3)]),
      section('S5', [chart('area', 2)]),
      section('S6', [tbl(3)]),
      section('S7', [text('t')]),
      section('S8', [text('t')]),
      section('S9', [text('t')]),
      section('S10', [text('t')]),
    ])
  ),
  e(
    'M18.S30',
    'Xtr',
    'Adversarial: contradictory data',
    'Raport gdy 2 źródła dają sprzeczne dane (sales=120, finance=95) — zaznacz rozjazd',
    {
      minSections: 2,
      maxSections: 5,
      requireBlockType: [{ type: 'callout', min: 1 }, { type: 'bulletList', min: 1 }, { type: 'table', min: 1 }],
      anyTextContains: ['rozbieżność', 'discrepancy'],
    },
    doc([
      section('Dane', [tbl(2)]),
      section('Uwaga', [callout('Wykryto rozbieżność: sales=120 vs finance=95', 'warning')]),
      section('Weryfikacja', [bulletList(['Sprawdź źródło sales (120)', 'Sprawdź finance (95)'])]),
    ])
  ),
];
