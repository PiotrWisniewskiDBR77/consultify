// @vitest-environment node
/**
 * docContentGenE2E — pełny łańcuch B3 (struktura) → content-gen (treść) →
 * DocumentArtifact → scoring PEŁNYCH kryteriów (strukturalne + TREŚCIOWE).
 *
 * To domyka warstwę treści: docGeneratorE2E weryfikował tylko strukturę B3
 * (typy bloków). Tutaj content-gen layer wypełnia bloki treścią (KPI items,
 * chart series z paletą, table rows, callout tone, citations) i scoring
 * sprawdza WSZYSTKO — w tym kpiItemsRange, chartPaletteMax, minStyledCells,
 * minCitations, anyTextContains.
 *
 * Mock LLM (oba: B3 plan + content) zasilany z mockPass scenariusza. W LIVE
 * mode te same ścieżki, ale prawdziwy LLM produkuje treść (jakość = FT-6).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DOC_SCENARIOS } from './catalog/reports.js';
import { scoreDoc, type DocumentArtifact } from './scoring/docScoring.js';

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
  divider: 'paragraph',
};

/** mockPass → B3 plan input. */
function mockPassToB3Plan(doc: DocumentArtifact) {
  return {
    sections: doc.sections.map((s) => ({
      title: s.heading ?? '',
      purpose: '',
      blocks: s.blocks.map((b) => ({ type: SCORING_TO_B3[b.type] ?? 'paragraph', hint: `${b.type}` })),
    })),
  };
}

/** mockPass → content-gen LLM response (content keyed by blockId b-{si}-{bi}). */
function mockPassToContentResponse(doc: DocumentArtifact) {
  const blocks: Array<{ blockId: string; content: any }> = [];
  doc.sections.forEach((s, si) => {
    s.blocks.forEach((b, bi) => {
      blocks.push({ blockId: `b-${si}-${bi}`, content: b.content });
    });
  });
  return { blocks };
}

function deriveOutline(doc: DocumentArtifact) {
  return doc.sections.map((s) => ({ title: s.heading ?? '', purpose: '' }));
}

describe('Doc content-gen E2E — łańcuch B3→content-gen→pełne scoring', () => {
  let planDocumentStructure: typeof import('../../../server/src/services/documentStudio/documentStructureGenerator.js').planDocumentStructure;
  let generateDocumentContent: typeof import('../../../server/src/services/documentStudio/documentBlockContentGenerator.js').generateDocumentContent;

  beforeEach(async () => {
    vi.resetModules();
    llmCall.mockReset();
    flagState.premium = true;
    planDocumentStructure = (
      await import('../../../server/src/services/documentStudio/documentStructureGenerator.js')
    ).planDocumentStructure;
    generateDocumentContent = (
      await import('../../../server/src/services/documentStudio/documentBlockContentGenerator.js')
    ).generateDocumentContent;
  });
  afterEach(() => vi.clearAllMocks());

  it('30 doc-scenariuszy: B3→content-gen→pełne kryteria (struktura + treść)', async () => {
    const failures: string[] = [];

    for (const entry of DOC_SCENARIOS) {
      const outline = deriveOutline(entry.mockPass);

      // 1. B3 struktura (mock LLM = plan z mockPass).
      llmCall.mockReset();
      llmCall.mockResolvedValueOnce({ object: mockPassToB3Plan(entry.mockPass) });
      const plan = await planDocumentStructure(entry.meta.intent, outline, {
        orgId: 'org-e2e',
        preferPremium: true,
      });

      // 2. content-gen (mock LLM = treść z mockPass), citations gdy wymagane.
      llmCall.mockReset();
      llmCall.mockResolvedValueOnce({ object: mockPassToContentResponse(entry.mockPass) });
      const content = await generateDocumentContent(entry.meta.intent, plan, {
        orgId: 'org-e2e',
        preferPremium: true,
        citationCount: (entry.criteria as any).minCitations,
      });

      // 3. scoring PEŁNYCH kryteriów.
      const artifact: DocumentArtifact = {
        sections: content.sections.map((s) => ({
          sectionId: s.sectionId,
          heading: s.heading,
          blocks: s.blocks.map((b) => ({ blockId: b.blockId, type: b.type as any, content: b.content })),
        })),
        citations: content.citations,
      };

      const report = scoreDoc(artifact, entry.criteria);
      if (!report.passed) {
        failures.push(
          `${entry.meta.id}: ${report.failures
            .map((f) => `${f.criterion}[exp ${f.expected}, got ${f.got}]`)
            .join('; ')}`
        );
      }
    }

    expect(failures, `\nContent-gen chain zawiódł:\n${failures.join('\n')}`).toEqual([]);
  });
});
