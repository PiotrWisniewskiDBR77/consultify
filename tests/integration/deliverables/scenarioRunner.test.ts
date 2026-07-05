// @vitest-environment node
/**
 * scenarioRunner — egzekucja katalogu scenariuszy M18/M19/M20.
 *
 * **Tryb mock** (domyślny, CI-friendly):
 *   - llmService.call jest mockowany; zwraca canned "premium-quality" JSON
 *   - testuje że scoring engine PRAWIDŁOWO wykrywa pass/fail dla znanych inputów
 *   - sprawdza ŚCIEŻKĘ TESTOWANIA, nie jakość rzeczywistego LLM-a
 *
 * **Tryb live** (gdy ENABLE_DELIVERABLES_PREMIUM=1 + DELIVERABLE_SCENARIOS_LIVE=1):
 *   - prawdziwe LLM calls (Claude/Anthropic API)
 *   - mierzy faktyczną jakość B-series w realnym wykonaniu
 *   - feeduje self-healing loop
 *
 * Tutaj implementujemy MOCK mode + scoring asercje na 9 scenariuszach pilotowych
 * (3 sml/med/lrg per moduł). Live mode dziedziczy tę samą strukturę — tylko
 * llmCall.mockResolvedValue zastąpione faktycznym wywołaniem.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { scoreDeck, type DeckCriteria } from './scoring/deckScoring.js';
import { scoreDoc, type DocCriteria, type DocumentArtifact } from './scoring/docScoring.js';
import {
  scoreTable,
  type GeneratedTable,
  type TableCriteria,
} from './scoring/tableScoring.js';

// ──────────────────────────────────────────────────────────────
// Test setup — flagi premium + mock LLM
// ──────────────────────────────────────────────────────────────

const llmCall = vi.fn();
vi.mock('../../../server/src/services/ai/llmService.js', () => ({
  llmService: { call: (...args: any[]) => llmCall(...args) },
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const flagState = { premium: true };
vi.mock('../../../server/src/config/FeatureFlags.js', () => ({
  default: {
    get ENABLE_DELIVERABLES_PREMIUM() {
      return flagState.premium;
    },
  },
}));

// ──────────────────────────────────────────────────────────────
// Deck pilots (M19 — S01 Sml, S06 Med, S16 Lrg)
// ──────────────────────────────────────────────────────────────

describe('Scenario runner — M19 decks (pilot)', () => {
  let planDeckLayout: typeof import('../../../server/src/services/presentationLayoutDirectorService.js').planDeckLayout;

  beforeEach(async () => {
    vi.resetModules();
    llmCall.mockReset();
    flagState.premium = true;
    const mod = await import(
      '../../../server/src/services/presentationLayoutDirectorService.js'
    );
    planDeckLayout = mod.planDeckLayout;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('S01 [Sml] cover-only welcome slide — passes when LLM zwraca poprawny cover', async () => {
    llmCall.mockResolvedValueOnce({
      object: {
        plans: [
          {
            slideIndex: 0,
            layoutIntent: 'cover',
            paletteId: 'harvard',
            imageBrief: 'Digital transformation for SMB — modern professional cover',
            reasoning: 'Cover for cyfryzacja prezentacji MŚP',
          },
        ],
      },
    });

    const result = await planDeckLayout(
      [{ content: { title: 'Cyfryzacja w MŚP — jak zacząć' } as any } as any],
      { language: 'PL', client: 'MŚP klient', template: 'corporate' } as any,
      { orgId: 'org-1', preferPremium: true }
    );

    const criteria: DeckCriteria = {
      scenarioId: 'M19.S01',
      minSlides: 1,
      maxSlides: 1,
      sequence: { 0: 'cover' },
      coverTitleContainsAny: ['cyfryzacja', 'MŚP'],
      requireSinglePalette: true,
      requireAllLlm: true,
      imageBriefMinSlides: 1,
    };

    const report = scoreDeck(result, criteria);
    expect(report.passed, JSON.stringify(report, null, 2)).toBe(true);
    expect(report.scorePct).toBe(100);
  });

  it('S06 [Med] diagnoza HR — fails when brak rekomendacji (validates scoring catches gap)', async () => {
    // Symulujemy LLM który zapomniał wstawić recommendation
    llmCall.mockResolvedValueOnce({
      object: {
        plans: [
          { slideIndex: 0, layoutIntent: 'cover', paletteId: 'harvard', imageBrief: 'ACME HR', reasoning: 'Cover ACME diagnoza HR' },
          { slideIndex: 1, layoutIntent: 'executive_summary', paletteId: 'harvard', imageBrief: 'Status', reasoning: 'exec summary' },
          { slideIndex: 2, layoutIntent: 'single_insight', paletteId: 'harvard', imageBrief: null, reasoning: 'problem 1' },
          { slideIndex: 3, layoutIntent: 'single_insight', paletteId: 'harvard', imageBrief: null, reasoning: 'problem 2' },
          { slideIndex: 4, layoutIntent: 'single_insight', paletteId: 'harvard', imageBrief: null, reasoning: 'problem 3' },
          // Brak recommendation slide!
          { slideIndex: 5, layoutIntent: 'next_steps', paletteId: 'harvard', imageBrief: 'NS', reasoning: 'next steps' },
        ],
      },
    });

    const result = await planDeckLayout(
      Array.from({ length: 6 }, () => ({ content: {} as any } as any)),
      { language: 'PL', client: 'ACME', project: 'HR diagnostic' } as any,
      { orgId: 'org-1', preferPremium: true }
    );

    const criteria: DeckCriteria = {
      scenarioId: 'M19.S06',
      minSlides: 6,
      maxSlides: 8,
      sequence: { 0: 'cover', last: 'next_steps' },
      requireLayoutAtLeast: [
        { intent: 'recommendation_single', min: 1 }, // ← scoring powinien złapać brak
      ],
      coverTitleContainsAny: ['ACME'],
      imageBriefMinSlides: 3,
    };

    const report = scoreDeck(result, criteria);
    expect(report.passed).toBe(false);
    // Sprawdź że ZŁAPAŁ właściwy gap
    const recFailure = report.failures.find((f) =>
      f.criterion.includes('recommendation_single')
    );
    expect(recFailure).toBeDefined();
    // Self-heal hint kieruje do prompta B1
    expect(report.selfHealHints.some((h) => h.includes('LLM nie wybiera'))).toBe(true);
  });

  it('S16 [Lrg] full diagnostic 12-slide — passes when LLM dał pełen repertuar', async () => {
    const plans = [
      { slideIndex: 0, layoutIntent: 'cover', paletteId: 'midnight', imageBrief: 'cover', reasoning: 'Apator diagnostic' },
      { slideIndex: 1, layoutIntent: 'executive_summary', paletteId: 'midnight', imageBrief: 'exec summary', reasoning: 'exec' },
      { slideIndex: 2, layoutIntent: 'section_intro', paletteId: 'midnight', imageBrief: 'sec 1', reasoning: 'context' },
      { slideIndex: 3, layoutIntent: 'single_insight', paletteId: 'midnight', imageBrief: 'insight 1', reasoning: 'problem 1' },
      { slideIndex: 4, layoutIntent: 'root_cause', paletteId: 'midnight', imageBrief: 'rc', reasoning: 'root cause' },
      { slideIndex: 5, layoutIntent: 'comparison', paletteId: 'midnight', imageBrief: 'cmp', reasoning: 'comparison' },
      { slideIndex: 6, layoutIntent: 'recommendation_portfolio', paletteId: 'midnight', imageBrief: 'rec', reasoning: 'portfolio' },
      { slideIndex: 7, layoutIntent: 'initiative_portfolio', paletteId: 'midnight', imageBrief: 'init', reasoning: 'init portfolio' },
      { slideIndex: 8, layoutIntent: 'roadmap', paletteId: 'midnight', imageBrief: 'roadmap', reasoning: 'roadmap' },
      { slideIndex: 9, layoutIntent: 'risk_management', paletteId: 'midnight', imageBrief: 'risk', reasoning: 'risk' },
      { slideIndex: 10, layoutIntent: 'key_messages', paletteId: 'midnight', imageBrief: 'km', reasoning: 'summary' },
      { slideIndex: 11, layoutIntent: 'next_steps', paletteId: 'midnight', imageBrief: 'ns', reasoning: 'next steps' },
    ];
    llmCall.mockResolvedValueOnce({ object: { plans } });

    const result = await planDeckLayout(
      Array.from({ length: 12 }, () => ({ content: {} as any } as any)),
      { language: 'PL', client: 'Apator Powogaz' } as any,
      { orgId: 'org-1', preferPremium: true }
    );

    const criteria: DeckCriteria = {
      scenarioId: 'M19.S16',
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
    };

    const report = scoreDeck(result, criteria);
    expect(report.passed, JSON.stringify(report, null, 2)).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────
// Doc pilots (M18 — S01 Sml, S06 Med, S16 Lrg)
// ──────────────────────────────────────────────────────────────

describe('Scenario runner — M18 reports (pilot, scoring isolation)', () => {
  // Doc generator (B3 documentStructureGenerator) używa zewnętrznego LLM —
  // testy doc tutaj testują SAM SCORER (nie wywołują B3), bo B3 schema doc
  // jest oddzielne od DeckLayoutDirectorResult. Symulujemy artifact bezpośrednio.

  it('S01 [Sml] memo — passes when artifact ma 1 sekcję z heading+prozą', () => {
    const doc: DocumentArtifact = {
      sections: [
        {
          sectionId: 'sec-1',
          heading: 'CRM rollout — status memo',
          blocks: [
            { blockId: 'b-1', type: 'heading', content: { text: 'CRM rollout — status memo' } },
            { blockId: 'b-2', type: 'text', content: { text: 'Para 1...' } },
            { blockId: 'b-3', type: 'text', content: { text: 'Para 2...' } },
            { blockId: 'b-4', type: 'text', content: { text: 'Para 3...' } },
            { blockId: 'b-5', type: 'callout', content: { text: 'Key callout', tone: 'info' } },
          ],
        },
      ],
    };

    const criteria: DocCriteria = {
      scenarioId: 'M18.S01',
      minSections: 1,
      maxSections: 1,
      minBlocks: 5,
      maxBlocks: 7,
      requireBlockType: [{ type: 'heading', min: 1 }],
      requireSectionHeading: ['CRM'],
    };

    const report = scoreDoc(doc, criteria);
    expect(report.passed, JSON.stringify(report, null, 2)).toBe(true);
  });

  it('S06 [Med] HR diagnostic — fails gdy brak KPI block', () => {
    const doc: DocumentArtifact = {
      sections: [
        { sectionId: 's1', heading: 'Wprowadzenie', blocks: [{ blockId: 'b1', type: 'text', content: { text: 'intro' } }] },
        // brak section z heading "rekomendacja"!
        { sectionId: 's2', heading: 'Stan obecny', blocks: [{ blockId: 'b2', type: 'text', content: { text: 'status' } }] },
        { sectionId: 's3', heading: 'Problemy', blocks: [
          { blockId: 'b3', type: 'callout', content: { text: 'problem 1' } },
          { blockId: 'b4', type: 'callout', content: { text: 'problem 2' } },
        ] },
        { sectionId: 's4', heading: 'Next steps', blocks: [{ blockId: 'b5', type: 'bulletList', content: { items: ['a', 'b'] } }] },
        // brak KPI block!
      ],
    };

    const criteria: DocCriteria = {
      scenarioId: 'M18.S06',
      minSections: 3,
      maxSections: 5,
      requireBlockType: [
        { type: 'kpi', min: 1 }, // ← powinien złapać brak
        { type: 'callout', min: 2 },
        { type: 'bulletList', min: 1 },
      ],
      requireSectionHeading: ['rekomendacja', 'next steps'], // OR — Next steps złapie
    };

    const report = scoreDoc(doc, criteria);
    expect(report.passed).toBe(false);
    const kpiFail = report.failures.find((f) => f.criterion.includes('kpi'));
    expect(kpiFail).toBeDefined();
  });

  it('S16 [Lrg] full diagnostic — passes z różnorodnymi blokami', () => {
    const doc: DocumentArtifact = {
      sections: [
        { sectionId: 's1', heading: 'Executive summary', blocks: [
          { blockId: 'h1', type: 'heading', content: { text: 'Executive summary' } },
          { blockId: 'k1', type: 'kpi', content: { items: [
            { label: 'Revenue', value: '12M', delta: '+8%' },
            { label: 'Margin', value: '18%', delta: '+2pp' },
            { label: 'NPS', value: '42', delta: '+5' },
          ] } },
        ] },
        { sectionId: 's2', heading: 'Kontekst', blocks: [{ blockId: 't1', type: 'text', content: { text: 'kontekst' } }] },
        { sectionId: 's3', heading: 'Metodyka', blocks: [{ blockId: 't2', type: 'text', content: { text: 'metoda' } }] },
        { sectionId: 's4', heading: 'Obszar problemowy 1', blocks: [
          { blockId: 'k2', type: 'kpi', content: { items: [{ label: 'X', value: '1', delta: '0' }, { label: 'Y', value: '2', delta: '0' }, { label: 'Z', value: '3', delta: '0' }] } },
          { blockId: 'c1', type: 'callout', content: { text: 'problem 1', tone: 'warning' } },
        ] },
        { sectionId: 's5', heading: 'Obszar problemowy 2', blocks: [
          { blockId: 'k3', type: 'kpi', content: { items: [{ label: 'X', value: '1', delta: '0' }, { label: 'Y', value: '2', delta: '0' }, { label: 'Z', value: '3', delta: '0' }] } },
          { blockId: 'c2', type: 'callout', content: { text: 'problem 2', tone: 'warning' } },
        ] },
        { sectionId: 's6', heading: 'Obszar problemowy 3', blocks: [
          { blockId: 'k4', type: 'kpi', content: { items: [{ label: 'X', value: '1', delta: '0' }, { label: 'Y', value: '2', delta: '0' }, { label: 'Z', value: '3', delta: '0' }] } },
          { blockId: 'c3', type: 'callout', content: { text: 'problem 3', tone: 'danger' } },
        ] },
        { sectionId: 's7', heading: 'Rekomendacje', blocks: [
          { blockId: 'bl1', type: 'bulletList', content: { items: ['rec 1', 'rec 2', 'rec 3'] } },
        ] },
        { sectionId: 's8', heading: 'Roadmapa', blocks: [
          { blockId: 'tb1', type: 'table', content: { rows: [{ cells: { faza: { value: 'I' }, dzialanie: { value: 'X' }, owner: { value: 'A' }, termin: { value: '2026' } } }] } },
        ] },
        { sectionId: 's9', heading: 'Ryzyka', blocks: [
          { blockId: 'tb2', type: 'table', content: { rows: [{ cells: { ryzyko: { value: 'R1' } } }, { cells: { ryzyko: { value: 'R2' } } }, { cells: { ryzyko: { value: 'R3' } } }, { cells: { ryzyko: { value: 'R4' } } }, { cells: { ryzyko: { value: 'R5' } } }] } },
        ] },
      ],
    };

    const criteria: DocCriteria = {
      scenarioId: 'M18.S16',
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
    };

    const report = scoreDoc(doc, criteria);
    expect(report.passed, JSON.stringify(report, null, 2)).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────
// Table pilots (M20 — S01 Sml, S07 Med, S17 Lrg)
// ──────────────────────────────────────────────────────────────

describe('Scenario runner — M20 tables (pilot, scoring isolation)', () => {
  it('S01 [Sml] TODO list — passes z typed schema (singleSelect z kolorami)', () => {
    const table: GeneratedTable = {
      fields: [
        { key: 'name', header: 'Nazwa', type: 'singleLineText' },
        { key: 'owner', header: 'Owner', type: 'singleLineText' },
        { key: 'deadline', header: 'Termin', type: 'date' },
        {
          key: 'status',
          header: 'Status',
          type: 'singleSelect',
          options: [
            { label: 'To Do', color: '#2563EB' },
            { label: 'In Progress', color: '#D97706' },
            { label: 'Done', color: '#16A34A' },
          ],
        },
      ],
      seedRows: [
        { name: 'A', owner: 'AA', deadline: '2026-07-01', status: 'To Do' },
        { name: 'B', owner: 'BB', deadline: '2026-07-15', status: 'In Progress' },
        { name: 'C', owner: 'CC', deadline: '2026-08-01', status: 'Done' },
        { name: 'D', owner: 'DD', deadline: '2026-09-01', status: 'To Do' },
      ],
    };

    const criteria: TableCriteria = {
      scenarioId: 'M20.S01',
      minFields: 3,
      maxFields: 5,
      minRows: 3,
      maxRows: 6,
      requireFieldType: [
        { type: 'singleLineText', min: 1 },
        { type: 'date', min: 1 },
        { type: 'singleSelect', min: 1 },
      ],
      requireSelectLabels: [{ fieldHint: 'status', labels: ['todo', 'in progress', 'done'] }],
      requireSelectColors: true,
      minTypedFields: 2,
    };

    const report = scoreTable(table, criteria);
    expect(report.passed, JSON.stringify(report, null, 2)).toBe(true);
  });

  it('S07 [Med] project portfolio — fails gdy singleSelect bez kolorów', () => {
    const table: GeneratedTable = {
      fields: [
        { key: 'name', header: 'Project', type: 'singleLineText' },
        { key: 'owner', header: 'Owner', type: 'singleLineText' },
        {
          key: 'status',
          header: 'Status',
          type: 'singleSelect',
          options: [
            { label: 'To Do' }, // ← brak color!
            { label: 'In Progress' },
            { label: 'Done' },
          ],
        },
        { key: 'priority', header: 'Priority', type: 'singleSelect', options: [{ label: 'P0', color: '#DC2626' }, { label: 'P1', color: '#F59E0B' }, { label: 'P2', color: '#2563EB' }, { label: 'P3', color: '#6B7280' }] },
        { key: 'start', header: 'Start', type: 'date' },
        { key: 'end', header: 'End', type: 'date' },
        { key: 'budget', header: 'Budget', type: 'currency' },
        { key: 'progress', header: 'Progress', type: 'percent' },
      ],
      seedRows: Array.from({ length: 8 }, (_, i) => ({
        name: `P${i}`,
        owner: `O${i}`,
        status: 'To Do',
        priority: 'P1',
        start: '2026-01-01',
        end: '2026-12-31',
        budget: 100000,
        progress: 0.25,
      })),
    };

    const criteria: TableCriteria = {
      scenarioId: 'M20.S07',
      minFields: 8,
      maxFields: 10,
      minRows: 8,
      requireFieldType: [
        { type: 'singleSelect', min: 2 },
        { type: 'date', min: 2 },
        { type: 'currency', min: 1 },
        { type: 'percent', min: 1 },
      ],
      requireSelectColors: true, // ← scoring złapie brak kolorów na status
    };

    const report = scoreTable(table, criteria);
    expect(report.passed).toBe(false);
    const colorFail = report.failures.find((f) => f.criterion.includes('select colors'));
    expect(colorFail).toBeDefined();
  });

  it('S17 [Lrg] risk register z iconSet — passes z pełnym CF', () => {
    const table: GeneratedTable = {
      fields: [
        { key: 'risk', header: 'Ryzyko', type: 'singleLineText' },
        {
          key: 'severity',
          header: 'Severity',
          type: 'singleSelect',
          options: [
            { label: 'Critical', color: '#DC2626' },
            { label: 'High', color: '#F59E0B' },
            { label: 'Medium', color: '#FBBF24' },
            { label: 'Low', color: '#16A34A' },
          ],
        },
        { key: 'likelihood', header: 'Likelihood', type: 'rating' },
        { key: 'impact', header: 'Impact', type: 'rating' },
        { key: 'owner', header: 'Owner', type: 'singleLineText' },
      ],
      seedRows: Array.from({ length: 8 }, (_, i) => ({
        risk: `R${i}`,
        severity: ['Critical', 'High', 'Medium', 'Low'][i % 4],
        likelihood: (i % 5) + 1,
        impact: (i % 5) + 1,
        owner: `Person${i}`,
      })),
      conditionalFormatting: [
        { ref: 'C2:C9', rules: [{ type: 'iconSet', iconSet: '3Arrows' }] },
        { ref: 'D2:D9', rules: [{ type: 'colorScale', colors: ['#DC2626', '#F59E0B', '#16A34A'] }] },
      ],
    };

    const criteria: TableCriteria = {
      scenarioId: 'M20.S17',
      minFields: 5,
      maxFields: 6,
      minRows: 8,
      requireFieldType: [
        { type: 'singleSelect', min: 1 },
        { type: 'rating', min: 2 },
      ],
      requireSelectLabels: [
        { fieldHint: 'severity', labels: ['critical', 'high', 'medium', 'low'] },
      ],
      requireSelectColors: true,
      requireCfRule: [
        { type: 'iconSet', min: 1 },
        { type: 'colorScale', min: 1 },
      ],
      expectTrafficLightColors: [{ fieldHint: 'severity' }],
    };

    const report = scoreTable(table, criteria);
    expect(report.passed, JSON.stringify(report, null, 2)).toBe(true);
  });
});
