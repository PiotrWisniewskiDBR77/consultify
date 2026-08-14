/**
 * HP-17 bridge — deck (presentationGeneratorService.generateDeck) must persist
 * its inline HP-16 `EvidenceContract` as an `EvidenceEnvelope` via
 * `evidenceEnvelopeService.upsertEnvelope` (artifactType='deck'). Before this
 * bridge, the contract was computed and returned to the caller but never
 * written to `artifact_evidence` — the evidence panel (fala 9,
 * ArtifactRightPanel) showed an empty state for decks despite the engine
 * having real data.
 *
 * This test exercises the REAL `evidenceContractBridge.ts` (not mocked) so the
 * mapping + fire-and-forget persist call is proven end-to-end from inside
 * `generateDeck`; only `evidenceEnvelopeService.js` (the DB-touching leaf) and
 * every other heavy dependency of `generateDeck` (DB/AI/PPTX-render pipeline)
 * are stubbed to keep this a fast, deterministic unit test.
 */
import fs from 'fs';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const upsertEnvelope = vi.fn().mockResolvedValue({ id: 'envelope-1' });

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  get: vi.fn().mockResolvedValue(null),
  all: vi.fn().mockResolvedValue([]),
  run: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../server/src/services/evidence/evidenceEnvelopeService.js', () => ({
  default: { upsertEnvelope, getEnvelope: vi.fn().mockResolvedValue(null) },
  upsertEnvelope,
  getEnvelope: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../../server/src/services/ai/deckVisualsService.js', () => ({
  materializePlannedVisual: vi.fn(),
}));

vi.mock('../../../../server/src/services/contextPackBuilder.js', () => ({
  buildContextPack: vi.fn().mockResolvedValue({
    key_points: [],
    data_points: [],
    metadata: { confidence_score: 1 },
  }),
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
  generateNarrative: vi.fn(),
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
    generation: { warnings: [] },
    lifecycle: {},
    meta: {},
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

const TEST_DECK_ID = 'test-deck-hp17-evidence-persist';
const TEST_ORG_ID = 'org-hp17-test';
const EXPORT_PATH = path.join(process.cwd(), 'exports', 'presentations', `${TEST_DECK_ID}.pptx`);

describe('presentationGeneratorService.generateDeck — HP-17 evidence persist', () => {
  beforeEach(() => {
    upsertEnvelope.mockClear();
  });

  afterEach(() => {
    if (fs.existsSync(EXPORT_PATH)) fs.unlinkSync(EXPORT_PATH);
  });

  it('persists the deck EvidenceContract as an EvidenceEnvelope (artifactType=deck)', async () => {
    const { generateDeck } =
      await import('../../../../server/src/services/presentationGeneratorService.js');

    const outline = [
      {
        intent: 'cover',
        title: 'Test cover slide',
        enabled: true,
      },
    ];
    const setup = {
      title: 'HP-17 test deck',
      audience: 'internal' as const,
      goal: 'inform' as const,
      language: 'en' as const,
      theme: 'corporate' as const,
      confidentiality: 'internal' as const,
      brandColor: '#123456',
      sourceArtifacts: [],
      visuals: { enabled: false },
    };

    const result = await generateDeck(TEST_DECK_ID, outline as never, setup as never, TEST_ORG_ID);

    expect(result.evidence).toBeDefined();
    // The persist call is fire-and-forget (`void safePersistEvidenceContract(...)`,
    // by design — a write failure must never block deck generation), so it can
    // still be settling on the microtask queue when `generateDeck` resolves.
    await vi.waitFor(() => expect(upsertEnvelope).toHaveBeenCalledTimes(1));
    const input = upsertEnvelope.mock.calls[0][0];
    expect(input.artifactType).toBe('deck');
    expect(input.artifactId).toBe(TEST_DECK_ID);
    expect(input.organizationId).toBe(TEST_ORG_ID);
    expect(input.computedBy.service).toBe('presentationGeneratorService');
    // 0 source artifacts -> deterministic 'low' confidence -> numeric 0.25
    expect(input.confidence).toBe(0.25);
  });
});
