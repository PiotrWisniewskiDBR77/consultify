// @vitest-environment node
/**
 * docGeneratorE2E — przepuszcza doc-scenariusze M18 przez PRAWDZIWY
 * `planDocumentStructure` (B3) i scoruje WARSTWĘ STRUKTURALNĄ wyniku.
 *
 * ARCHITEKTURA (udokumentowana testem):
 * B3 (`documentStructureGenerator`) to PLANNER STRUKTURY — z outline + intent
 * dobiera SEKWENCJĘ TYPÓW bloków per sekcja ({type, hint}), NIE generuje treści.
 * Treść (KPI items, chart series, table rows, cell styling, citations) powstaje
 * w OSOBNYM kroku content-gen (documentContentGenerator + block generators).
 *
 * Dlatego scoring dzieli się na 2 warstwy:
 *   - STRUKTURALNA (własność B3): section count, typy bloków obecne, distinct
 *     types, forbidden types, section headings → TEN test je weryfikuje
 *   - TREŚCIOWA (content-gen, NIE B3): kpiItemsRange, chartPaletteMax,
 *     chartSeriesMax, minStyledCells, minCitations, chartKind, anyTextContains
 *     → poza zasięgiem B3; test liczy ile scenariuszy ich wymaga (need-content-gen)
 *
 * Dodatkowo: B3 używa innych nazw typów (kpi_strip/paragraph/bullet_list) niż
 * docScoring (kpi/text/bulletList) — test mapuje (realny gap integracyjny do
 * domknięcia przy wpięciu w żywy pipeline).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DOC_SCENARIOS } from './catalog/reports.js';
import { scoreDoc, type DocumentArtifact, type DocBlockType } from './scoring/docScoring.js';

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
// Mapowanie typów: docScoring ↔ B3 (ALLOWED_BLOCK_TYPES)
// ──────────────────────────────────────────────────────────────
const SCORING_TO_B3: Record<string, string> = {
  heading: 'heading',
  text: 'paragraph',
  bulletList: 'bullet_list',
  numberedList: 'numbered_list',
  quote: 'quote',
  callout: 'callout',
  chart: 'chart',
  table: 'table',
  kpi: 'kpi_strip',
  image: 'image',
  divider: 'paragraph', // brak odpowiednika w B3 → paragraph
};
const B3_TO_SCORING: Record<string, DocBlockType> = {
  heading: 'heading',
  paragraph: 'text',
  bullet_list: 'bulletList',
  numbered_list: 'numberedList',
  quote: 'quote',
  callout: 'callout',
  chart: 'chart',
  table: 'table',
  risk_table: 'table',
  kpi_strip: 'kpi',
  image: 'image',
  footnote: 'text',
  citation: 'text',
};

// Kryteria TREŚCIOWE — poza zasięgiem B3 (content-gen).
const CONTENT_KEYS = [
  'kpiItemsRange',
  'chartPaletteMax',
  'chartSeriesMax',
  'minStyledCells',
  'minCitations',
  'anyTextContains',
] as const;

function needsContentGen(criteria: any): boolean {
  if (CONTENT_KEYS.some((k) => criteria[k] !== undefined)) return true;
  // chartKind wewnątrz requireBlockType też jest content-level.
  if (Array.isArray(criteria.requireBlockType)) {
    return criteria.requireBlockType.some((r: any) => r.chartKind);
  }
  return false;
}

/** Strip kryteriów treściowych — zostaje warstwa strukturalna. */
function structuralCriteria(criteria: any): any {
  const out: any = { ...criteria };
  for (const k of CONTENT_KEYS) delete out[k];
  if (Array.isArray(out.requireBlockType)) {
    out.requireBlockType = out.requireBlockType.map((r: any) => ({ type: r.type, min: r.min }));
  }
  return out;
}

/** mockPass (pełny artefakt) → B3 plan input (sekcje z typami bloków). */
function mockPassToB3Plan(doc: DocumentArtifact) {
  return {
    sections: doc.sections.map((s) => ({
      title: s.heading ?? '',
      purpose: '',
      blocks: s.blocks.map((b) => ({
        type: SCORING_TO_B3[b.type] ?? 'paragraph',
        hint: `hint for ${b.type}`,
      })),
    })),
  };
}

/** B3 plan (po normalizacji) → DocumentArtifact (typy mapowane, treść pusta). */
function b3PlanToArtifact(plan: any): DocumentArtifact {
  return {
    sections: (plan.sections ?? []).map((s: any, si: number) => ({
      sectionId: `sec-${si}`,
      heading: s.title,
      blocks: (s.blocks ?? []).map((b: any, bi: number) => ({
        blockId: `b-${si}-${bi}`,
        type: B3_TO_SCORING[b.type] ?? 'text',
        content: {},
      })),
    })),
  };
}

function deriveOutline(doc: DocumentArtifact) {
  return doc.sections.map((s) => ({ title: s.heading ?? '', purpose: '' }));
}

describe('B3 doc structure generator E2E — warstwa strukturalna', () => {
  let planDocumentStructure: typeof import('../../../server/src/services/documentStudio/documentStructureGenerator.js').planDocumentStructure;

  beforeEach(async () => {
    vi.resetModules();
    llmCall.mockReset();
    flagState.premium = true;
    const mod = await import('../../../server/src/services/documentStudio/documentStructureGenerator.js');
    planDocumentStructure = mod.planDocumentStructure;
  });

  afterEach(() => vi.clearAllMocks());

  it('B3 produkuje poprawną STRUKTURĘ dla wszystkich 30 doc-scenariuszy', async () => {
    const failures: string[] = [];

    for (const entry of DOC_SCENARIOS) {
      const outline = deriveOutline(entry.mockPass);
      llmCall.mockReset();
      llmCall.mockResolvedValueOnce({ object: mockPassToB3Plan(entry.mockPass) });

      const plan = await planDocumentStructure(entry.meta.intent, outline, {
        orgId: 'org-e2e',
        preferPremium: true,
      });

      const artifact = b3PlanToArtifact(plan);
      const report = scoreDoc(artifact, structuralCriteria(entry.criteria));
      if (!report.passed) {
        failures.push(
          `${entry.meta.id}: ${report.failures
            .map((f) => `${f.criterion}[exp ${f.expected}, got ${f.got}]`)
            .join('; ')}`
        );
      }
    }

    expect(failures, `\nB3 struktura zawiodła:\n${failures.join('\n')}`).toEqual([]);
  });

  it('mapa: ile scenariuszy wymaga content-gen (treść poza B3)', () => {
    const needContent = DOC_SCENARIOS.filter((e) => needsContentGen(e.criteria));
    const structuralOnly = DOC_SCENARIOS.filter((e) => !needsContentGen(e.criteria));

    expect(structuralOnly.length + needContent.length).toBe(30);
    // eslint-disable-next-line no-console
    console.log(
      `[B3 layer map] structural-only=${structuralOnly.length}, need-content-gen=${needContent.length}: ${needContent.map((e) => e.meta.id).join(', ')}`
    );
    // Sanity: B3 sam pokrywa warstwę strukturalną wszystkich 30.
    expect(DOC_SCENARIOS).toHaveLength(30);
  });

  it('STANDARD tier → fallback heading+paragraph, NIE woła LLM', async () => {
    flagState.premium = false;
    const plan = await planDocumentStructure(
      'jakikolwiek dokument',
      [{ title: 'Sekcja 1', purpose: 'x' }],
      { orgId: 'org-e2e' }
    );
    expect(plan.tierUsed).toBe('STANDARD');
    expect(plan.fallbackUsed).toBe(true);
    expect(llmCall).not.toHaveBeenCalled();
    // Fallback = heading + paragraph
    expect(plan.sections[0].blocks.map((b) => b.type)).toEqual(['heading', 'paragraph']);
  });
});
