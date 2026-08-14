/**
 * FALA D (2026-07-26, "deck-narrative-depth") — wiring test for the widened
 * Narrative Engine intent gate + Template Architect briefing consumption in
 * `generateDeck` (presentationGeneratorService.ts).
 *
 * Context: on the source-driven (Kreator) path — no chat brief, i.e.
 * `resolveDeckNarrativeBrief` returns null — only 4 slide intents
 * (executive_summary/key_messages/next_steps/recommendation_portfolio) used
 * to reach the Narrative Engine; `root_cause`/`single_insight`/
 * `performance_overview`/`roadmap`/`risk_management` fell back to the generic
 * deterministic template even when the deck's context pack carried real
 * facts. This test proves:
 *   1. A `root_cause` slide (newly covered) now reaches `generateNarrative`
 *      and its L4 output lands in the persisted `unified_json` as
 *      `_narrative_enrichment` (mirrors the existing legacy-4-intent path).
 *   2. `ENABLE_DECK_NARRATIVE_EXTENDED=false` reverts to the legacy gate — the
 *      `root_cause` slide is skipped again, `generateNarrative` is not called
 *      for it.
 *   3. The outline item's `keyMessage`/`dataNeeded` (Template Architect
 *      briefing) are folded into the `user_instruction` passed to
 *      `generateNarrative` for that slide.
 *
 * Heavy dependencies of `generateDeck` (DB, PPTX render pipeline, visuals,
 * evidence persistence, …) are stubbed exactly like the sibling HP-17 test
 * (`presentationGeneratorService.evidencePersist.test.ts`) — only
 * `narrativeEngine/index.js`'s `generateNarrative` is a controllable mock, so
 * this is a fast, deterministic unit test of the WIRING, not the LLM.
 */
import fs from 'fs';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dbRun = vi.fn().mockResolvedValue(undefined);
const generateNarrative = vi.fn();

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  get: vi.fn().mockResolvedValue(null),
  all: vi.fn().mockResolvedValue([]),
  run: (...args: unknown[]) => dbRun(...args),
}));

vi.mock('../../../../server/src/services/evidence/evidenceEnvelopeService.js', () => ({
  default: {
    upsertEnvelope: vi.fn().mockResolvedValue({ id: 'envelope-1' }),
    getEnvelope: vi.fn(),
  },
  upsertEnvelope: vi.fn().mockResolvedValue({ id: 'envelope-1' }),
  getEnvelope: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../../server/src/services/ai/deckVisualsService.js', () => ({
  materializePlannedVisual: vi.fn(),
}));

const MOCK_CONTEXT_PACK = {
  key_points: ['3 initiatives are overdue against plan'],
  data_points: [
    {
      label: 'Initiatives on track',
      value: 62,
      unit: '%',
      source_artifact_id: 'src-1',
      period: '2026-01-01',
    },
  ],
  sources: [
    { artifact_id: 'src-1', artifact_type: 'initiative_portfolio', artifact_name: 'Initiatives' },
  ],
  metadata: { confidence_score: 0.9 },
};

vi.mock('../../../../server/src/services/contextPackBuilder.js', () => ({
  buildContextPack: vi.fn().mockResolvedValue(MOCK_CONTEXT_PACK),
  getContextPackSnapshot: vi.fn(),
  saveContextPackSnapshot: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../server/src/services/deliverableContentGuard.js', () => ({
  contentLeaksTemplateInventory: vi.fn().mockReturnValue(false),
  isTemplateInventoryLeak: vi.fn().mockReturnValue(false),
}));

vi.mock('../../../../server/src/services/deliverableGenerationTier.js', () => ({
  resolveDeliverableTier: vi.fn().mockReturnValue('STANDARD'),
}));

vi.mock('../../../../server/src/services/deliverables/bundleContentGate.js', () => ({
  runBundleContentGate: vi.fn().mockReturnValue({ passed: true, issues: [], placeholderHits: [] }),
}));

vi.mock('../../../../server/src/services/narrativeEngine/index.js', () => ({
  generateNarrative: (...args: unknown[]) => generateNarrative(...args),
}));

vi.mock('../../../../server/src/services/organizationStyleProfileService.js', () => ({
  recordDeckGeneration: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../server/src/services/presentationApprovedTemplateService.js', () => ({
  applyApprovedTemplateToOutline: vi.fn(),
  resolveApprovedPresentationTemplate: vi.fn(),
}));

vi.mock('../../../../server/src/services/presentationBrandLayoutService.js', () => ({
  applyBrandLayoutSystem: vi.fn((doc: unknown) => doc),
  buildBrandLayoutSystem: vi.fn().mockReturnValue({}),
}));

vi.mock('../../../../server/src/services/presentationDeckDocumentService.js', () => ({
  deckDocumentFromUnifiedJson: vi.fn().mockReturnValue({
    meta: {},
    generation: { warnings: [] },
    lifecycle: {},
  }),
}));

vi.mock('../../../../server/src/services/presentationLayoutVariantsService.js', () => ({
  generateDeckVariants: vi.fn().mockResolvedValue({ variants: [], tierUsed: 'STANDARD' }),
}));

vi.mock('../../../../server/src/services/presentationNarrativePlannerService.js', () => ({
  buildPresentationNarrativePlan: vi.fn().mockReturnValue({ warnings: [] }),
}));

vi.mock('../../../../server/src/services/presentationSourcePackService.js', () => ({
  preflightPresentationSourcePack: vi
    .fn()
    .mockReturnValue({ ok: true, sourcePack: {}, missingInputs: [], warnings: [] }),
}));

vi.mock(
  '../../../../server/src/services/presentationStudioIntentDensityDefaultsService.js',
  () => ({
    applyIntentDensityDefaults: vi.fn(),
  })
);

vi.mock('../../../../server/src/services/presentationStudioLayoutAuditService.js', () => ({
  auditPresentationStudioOutlineLayout: vi.fn().mockReturnValue({}),
}));

vi.mock('../../../../server/src/services/presentationStudioSlideAuditDecoratorService.js', () => ({
  decorateSlidesWithAuditFlags: vi.fn((args: { slides: unknown[] }) => ({
    slides: args.slides,
    decoratedCount: 0,
  })),
}));

vi.mock('../../../../server/src/services/presentationTemplateRuntimeService.js', () => ({
  applyTemplateRuntime: vi.fn(),
  buildSystemTemplateRuntime: vi.fn(),
  buildTemplateRuntimeFromRow: vi.fn(),
}));

vi.mock('../../../../server/src/services/presentationVisionQAService.js', () => ({
  qaGatedImageGeneration: vi.fn(),
}));

vi.mock('../../../../server/src/services/presentationVisualDirectorService.js', () => ({
  planDeckVisuals: vi.fn(),
  planDeckVisualsTiered: vi.fn(),
}));

vi.mock('../../../../server/src/services/report/pptx/PptxPipelineService.js', () => ({
  PptxPipelineService: vi.fn().mockImplementation(function PptxPipelineServiceMock(this: {
    generateFromUnifiedJson: () => Promise<unknown>;
  }) {
    this.generateFromUnifiedJson = vi.fn().mockResolvedValue({
      buffer: Buffer.from('test-pptx-bytes'),
      warnings: [],
      slideCount: 1,
    });
  }),
}));

vi.mock('../../../../server/src/services/slidePlanningEngineService.js', () => ({
  planSlides: vi.fn(),
}));

vi.mock('../../../../server/src/services/transformationReadDeckPackService.js', () => ({
  buildTransformationReadDeckPack: vi.fn().mockReturnValue({}),
  applyTransformationPackToArtifactData: vi.fn((data: unknown) => data),
}));

vi.mock('../../../../server/src/services/v8/artifactRegistryService.js', () => ({
  registerArtifactOrigin: vi.fn().mockResolvedValue(undefined),
  mapPresentationStatusToDeliveryState: vi.fn().mockReturnValue('delivered'),
}));

function makeSetup(overrides: Record<string, unknown> = {}) {
  return {
    title: 'FALA D test deck',
    audience: 'internal' as const,
    goal: 'inform' as const,
    language: 'en' as const,
    theme: 'corporate' as const,
    confidentiality: 'internal' as const,
    brandColor: '#123456',
    sourceArtifacts: [
      { type: 'initiative_portfolio', id: 'src-1', artifactId: 'src-1', label: 'Initiatives' },
    ],
    visuals: { enabled: false },
    ...overrides,
  };
}

function makeOutline() {
  return [
    { intent: 'cover', title: 'Cover', enabled: true },
    {
      intent: 'root_cause',
      title: 'Problem & Context',
      keyMessage: 'Delivery slippage concentrates in procurement, not engineering',
      dataNeeded: ['procurement lead time', 'engineering velocity'],
      enabled: true,
    },
  ];
}

/** Extracts the persisted unified_json from the `UPDATE presentation_decks ... unified_json = ?` call. */
function readPersistedUnifiedJson(): {
  slides: Array<{ intent: string; _narrative_enrichment?: unknown }>;
} {
  const call = dbRun.mock.calls.find(
    (c) =>
      typeof c[0] === 'string' && c[0].includes('unified_json') && c[0].includes("status = 'ready'")
  );
  if (!call) throw new Error('No unified_json persist call found in dbRun.mock.calls');
  const params = call[1] as unknown[];
  // Column order: deck_json, unified_json, slide_count, export_path, validation_warnings, outline_json, deckId, orgId
  const unifiedJsonRaw = params[1] as string;
  return JSON.parse(unifiedJsonRaw);
}

const TEST_DECK_ID = 'test-deck-fala-d-narrative-extended';
const TEST_ORG_ID = 'org-fala-d-test';
const EXPORT_PATH = path.join(process.cwd(), 'exports', 'presentations', `${TEST_DECK_ID}.pptx`);

describe('generateDeck — FALA D narrative-extended intent gate + template briefing', () => {
  beforeEach(() => {
    dbRun.mockClear();
    generateNarrative.mockReset();
    generateNarrative.mockResolvedValue({
      content: '## Root Cause\n\nProcurement is the bottleneck [Fact: fact_src-1_0].',
      facts_used: ['fact_src-1_0'],
      observations_used: [],
      discourse_plan: {
        section_key: 'root_cause',
        section_title: 'x',
        segments: [],
        communication_register: 'x',
        density: 'x',
      },
      post_check: { passed: true, warnings: [], errors: [] },
    });
    delete process.env.ENABLE_DECK_NARRATIVE_EXTENDED;
  });

  afterEach(() => {
    delete process.env.ENABLE_DECK_NARRATIVE_EXTENDED;
    if (fs.existsSync(EXPORT_PATH)) fs.unlinkSync(EXPORT_PATH);
  });

  it('default (flag unset = ON): root_cause slide reaches generateNarrative and gets _narrative_enrichment', async () => {
    const { generateDeck } =
      await import('../../../../server/src/services/presentationGeneratorService.js');

    await generateDeck(TEST_DECK_ID, makeOutline() as never, makeSetup() as never, TEST_ORG_ID);

    const rootCauseCall = generateNarrative.mock.calls.find(
      (c) => (c[0] as { section_type: string }).section_type === 'root_cause'
    );
    expect(rootCauseCall).toBeDefined();

    const persisted = readPersistedUnifiedJson();
    const rootCauseSlide = persisted.slides.find((s) => s.intent === 'root_cause');
    expect(rootCauseSlide?._narrative_enrichment).toMatchObject({
      content: expect.stringContaining('Procurement is the bottleneck'),
    });
  });

  it('folds the outline item keyMessage + dataNeeded into user_instruction for generateNarrative', async () => {
    const { generateDeck } =
      await import('../../../../server/src/services/presentationGeneratorService.js');

    await generateDeck(TEST_DECK_ID, makeOutline() as never, makeSetup() as never, TEST_ORG_ID);

    const rootCauseCall = generateNarrative.mock.calls.find(
      (c) => (c[0] as { section_type: string }).section_type === 'root_cause'
    );
    const instruction = (rootCauseCall?.[0] as { user_instruction?: string }).user_instruction;
    expect(instruction).toContain('Delivery slippage concentrates in procurement, not engineering');
    expect(instruction).toContain('procurement lead time');
    expect(instruction).toContain('engineering velocity');
  });

  it("ENABLE_DECK_NARRATIVE_EXTENDED='false' reverts to legacy gate: root_cause is skipped", async () => {
    process.env.ENABLE_DECK_NARRATIVE_EXTENDED = 'false';
    const { generateDeck } =
      await import('../../../../server/src/services/presentationGeneratorService.js');

    await generateDeck(TEST_DECK_ID, makeOutline() as never, makeSetup() as never, TEST_ORG_ID);

    const rootCauseCall = generateNarrative.mock.calls.find(
      (c) => (c[0] as { section_type: string }).section_type === 'root_cause'
    );
    expect(rootCauseCall).toBeUndefined();

    const persisted = readPersistedUnifiedJson();
    const rootCauseSlide = persisted.slides.find((s) => s.intent === 'root_cause');
    expect(rootCauseSlide?._narrative_enrichment).toBeUndefined();
  });
});
