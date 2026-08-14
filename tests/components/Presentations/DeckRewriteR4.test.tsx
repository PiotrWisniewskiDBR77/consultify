/**
 * R4 — Deck Gamma-flow: per-slide AI rewrite contract tests (FT-1).
 *
 * Covers the blueprint acceptance criteria:
 *   1. regenerateSlide(instruction) mutates ONLY slides[idx] (no sibling touch).
 *   2. Without an instruction, non-narrative slides keep the legacy behaviour.
 *   3. The rebuilt FE-shaped card is returned so the client can updateCard().
 *   4. Fallback: when the Narrative Engine throws (AI off), the slide is left
 *      untouched and the call still resolves (no throw).
 *   5. handleRewriteCard→updateCard semantics + UNDO after rewrite (FE state).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

// ── Heavy server-side dependency mocks ─────────────────────────────
// We exercise the real regenerateSlide logic but stub out the DB,
// context-pack store, narrative engine, and PPTX pipeline.

const dbState: { deckRow: any; lastUpdate: any[] } = { deckRow: null, lastUpdate: [] };

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  get: vi.fn(async () => dbState.deckRow),
  run: vi.fn(async (_sql: string, params: any[]) => {
    dbState.lastUpdate = params;
  }),
  all: vi.fn(async () => []),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const generateNarrativeMock = vi.fn();
vi.mock('../../../server/src/services/narrativeEngine/index.js', () => ({
  generateNarrative: (...args: any[]) => generateNarrativeMock(...args),
}));

const getContextPackSnapshotMock = vi.fn();
vi.mock('../../../server/src/services/contextPackBuilder.js', () => ({
  buildContextPack: vi.fn(),
  saveContextPackSnapshot: vi.fn(),
  getContextPackSnapshot: (...args: any[]) => getContextPackSnapshotMock(...args),
}));

// deckDocumentFromUnifiedJson is used to rebuild the FE-shaped card; stub a
// deterministic 1:1 card-per-slide mapping so we can assert the returned card.
vi.mock('../../../server/src/services/presentationDeckDocumentService.js', () => ({
  deckDocumentFromUnifiedJson: (params: any) => ({
    deck_id: params.deckId,
    cards: params.unifiedJson.slides.map((s: any, i: number) => ({
      card_id: `card-${i}`,
      order_index: i,
      intent: s.intent,
      title: s.key_message || s.intent,
      blocks: [],
      _enrichment: (s as any)._narrative_enrichment ?? null,
    })),
  }),
}));

// Remaining imported services — stub to inert objects so the module loads.
vi.mock('../../../server/src/services/ai/deckVisualsService.js', () => ({
  materializePlannedVisual: vi.fn(),
}));
vi.mock('../../../server/src/services/organizationStyleProfileService.js', () => ({
  recordDeckGeneration: vi.fn(),
}));
vi.mock('../../../server/src/services/presentationApprovedTemplateService.js', () => ({
  applyApprovedTemplateToOutline: vi.fn(),
  resolveApprovedPresentationTemplate: vi.fn(),
}));
vi.mock('../../../server/src/services/presentationBrandLayoutService.js', () => ({
  applyBrandLayoutSystem: vi.fn(),
  buildBrandLayoutSystem: vi.fn(),
}));
vi.mock('../../../server/src/services/presentationNarrativePlannerService.js', () => ({
  buildPresentationNarrativePlan: vi.fn(),
}));
vi.mock('../../../server/src/services/presentationSourcePackService.js', () => ({
  preflightPresentationSourcePack: vi.fn(),
}));
vi.mock('../../../server/src/services/presentationStudioIntentDensityDefaultsService.js', () => ({
  applyIntentDensityDefaults: vi.fn(),
}));
vi.mock('../../../server/src/services/presentationStudioLayoutAuditService.js', () => ({
  auditPresentationStudioOutlineLayout: vi.fn(),
}));
vi.mock('../../../server/src/services/presentationStudioSlideAuditDecoratorService.js', () => ({
  decorateSlidesWithAuditFlags: vi.fn((slides: any) => slides),
}));
vi.mock('../../../server/src/services/presentationTemplateRuntimeService.js', () => ({
  applyTemplateRuntime: vi.fn(),
  buildSystemTemplateRuntime: vi.fn(),
  buildTemplateRuntimeFromRow: vi.fn(),
}));
vi.mock('../../../server/src/services/presentationVisionQAService.js', () => ({
  qaGatedImageGeneration: vi.fn(),
}));
vi.mock('../../../server/src/services/presentationVisualDirectorService.js', () => ({
  planDeckVisuals: vi.fn(),
}));
vi.mock('../../../server/src/services/report/pptx/PptxPipelineService.js', () => ({
  PptxPipelineService: class {},
}));
vi.mock('../../../server/src/services/slidePlanningEngineService.js', () => ({
  planSlides: vi.fn(),
}));
vi.mock('../../../server/src/services/transformationReadDeckPackService.js', () => ({
  applyTransformationPackToArtifactData: vi.fn(),
  buildTransformationReadDeckPack: vi.fn(),
}));
vi.mock('../../../server/src/services/v8/artifactRegistryService.js', () => ({
  registerArtifactOrigin: vi.fn(),
  mapPresentationStatusToDeliveryState: vi.fn(() => 'draft'),
}));

import {
  regenerateSlide,
  shouldRunNarrativeRewrite,
} from '../../../server/src/services/presentationGeneratorService';
import { useDeckState } from '../../../src/components/Presentations/DeckBuilder/useDeckState';
import type { Deck, DeckCard } from '../../../src/components/Presentations/wizard/types';

function makeUnifiedJson() {
  return {
    meta: { project: 'Proj', language: 'en' },
    slides: [
      { intent: 'cover', key_message: 'Cover msg' },
      { intent: 'key_messages', key_message: 'KM msg' },
      { intent: 'performance_overview', key_message: 'Perf msg' },
    ],
  };
}

function seedDeck() {
  dbState.deckRow = {
    id: 'deck-1',
    title: 'Deck',
    unified_json: JSON.stringify(makeUnifiedJson()),
  };
  dbState.lastUpdate = [];
}

beforeEach(() => {
  vi.clearAllMocks();
  seedDeck();
  getContextPackSnapshotMock.mockResolvedValue({ facts: [] });
  generateNarrativeMock.mockResolvedValue({
    content: 'REWRITTEN CONTENT',
    facts_used: ['f1'],
    observations_used: [],
    post_check: { passed: true },
  });
});

// ── FT-1.A — pure gate ─────────────────────────────────────────────
describe('R4 shouldRunNarrativeRewrite (pure gate)', () => {
  it('without instruction, the default extended narrative intents are rewritten', () => {
    expect(shouldRunNarrativeRewrite('key_messages')).toBe(true);
    expect(shouldRunNarrativeRewrite('executive_summary')).toBe(true);
    expect(shouldRunNarrativeRewrite('cover')).toBe(false);
    expect(shouldRunNarrativeRewrite('performance_overview')).toBe(true);
  });

  it('a free-text instruction unlocks ANY slide intent', () => {
    expect(shouldRunNarrativeRewrite('cover', 'make it punchier')).toBe(true);
    expect(shouldRunNarrativeRewrite('performance_overview', 'add a risk note')).toBe(true);
  });

  it('blank/whitespace instruction does NOT unlock non-narrative slides', () => {
    expect(shouldRunNarrativeRewrite('cover', '   ')).toBe(false);
    expect(shouldRunNarrativeRewrite('cover', '')).toBe(false);
  });
});

// ── FT-1.B — regenerateSlide mutation isolation + instruction wiring ─
describe('R4 regenerateSlide (server)', () => {
  it('instruction rewrites ONLY slides[idx]; siblings untouched', async () => {
    // Rewrite slide 0 (cover) — non-narrative, only reachable via instruction.
    const { card } = await regenerateSlide('deck-1', 0, 'org-1', {
      instruction: 'make the cover bolder',
    });

    // Persisted unified_json from the run() mock params.
    const persistedUnified = JSON.parse(dbState.lastUpdate[0]);
    expect(persistedUnified.slides[0]._narrative_enrichment.content).toBe('REWRITTEN CONTENT');
    expect(persistedUnified.slides[0]._narrative_enrichment.instruction).toBe('make the cover bolder');
    // Siblings have no enrichment.
    expect(persistedUnified.slides[1]._narrative_enrichment).toBeUndefined();
    expect(persistedUnified.slides[2]._narrative_enrichment).toBeUndefined();

    // The instruction is forwarded to the narrative engine.
    expect(generateNarrativeMock).toHaveBeenCalledTimes(1);
    expect(generateNarrativeMock.mock.calls[0][0].user_instruction).toBe('make the cover bolder');

    // Rebuilt FE-shaped card returned for updateCard().
    expect(card).toBeTruthy();
    expect((card as any).card_id).toBe('card-0');
  });

  it('without instruction, an extended narrative slide is rewritten by default', async () => {
    await regenerateSlide('deck-1', 2, 'org-1'); // performance_overview, default extension ON

    expect(generateNarrativeMock).toHaveBeenCalledTimes(1);
    const persistedUnified = JSON.parse(dbState.lastUpdate[0]);
    expect(persistedUnified.slides[2]._narrative_enrichment.content).toBe('REWRITTEN CONTENT');
  });

  it('without instruction, a narrative slide still rewrites (legacy path preserved)', async () => {
    await regenerateSlide('deck-1', 1, 'org-1'); // key_messages

    expect(generateNarrativeMock).toHaveBeenCalledTimes(1);
    expect(generateNarrativeMock.mock.calls[0][0].user_instruction).toBeUndefined();
    const persistedUnified = JSON.parse(dbState.lastUpdate[0]);
    expect(persistedUnified.slides[1]._narrative_enrichment.content).toBe('REWRITTEN CONTENT');
  });

  it('fallback: when the Narrative Engine throws, the slide is left untouched and no throw', async () => {
    generateNarrativeMock.mockRejectedValueOnce(new Error('AI disabled'));

    await expect(
      regenerateSlide('deck-1', 0, 'org-1', { instruction: 'rewrite please' })
    ).resolves.toBeTruthy();

    const persistedUnified = JSON.parse(dbState.lastUpdate[0]);
    expect(persistedUnified.slides[0]._narrative_enrichment).toBeUndefined();
  });
});

// ── FT-1.C — FE: handleRewriteCard→updateCard semantics + UNDO ──────
function makeCard(id: string, title: string): DeckCard {
  return {
    card_id: id,
    deck_id: 'test-deck',
    order_index: 0,
    intent: 'key_messages',
    layout_id: 'content_full',
    title,
    blocks: [],
    source_refs: [],
    has_refreshable_data: false,
    background: { type: 'theme' },
    animations: { entrance: 'fade', block_stagger: false },
    is_locked: false,
  };
}

function makeDeck(cards: DeckCard[]): Deck {
  return {
    deck_id: 'test-deck',
    organization_id: 'org',
    title: 'T',
    theme_id: 'default',
    presentation_mode: 'show',
    communication_register: 'professional',
    image_style_preset: 'minimal_no_images',
    color_set_id: 'midnight_navy',
    status: 'draft',
    card_size: '16:9',
    cards: cards.map((c, i) => ({ ...c, order_index: i })),
    source_refs: [],
    generation_settings: {
      text_mode: 'preserve',
      content_depth: 'concise',
      audience: 'internal',
      tone: 'professional',
      language: 'en',
      image_source: 'none',
    },
    animations_enabled: true,
    share_settings: { is_shared: false, permissions: 'view' },
    speaker_notes_generated: false,
    created_by: 'test',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as Deck;
}

describe('R4 handleRewriteCard semantics — updateCard + UNDO', () => {
  it('applying the rebuilt card via updateCard merges content and keeps card_id', () => {
    const { result } = renderHook(() =>
      useDeckState(makeDeck([makeCard('A', 'Old title'), makeCard('B', 'B')]))
    );

    // Simulate handleRewriteCard's OPTION-B merge: server card minus card_id.
    const serverCard = { card_id: 'card-0', title: 'Rewritten title', blocks: [] };
    const { card_id: _ignore, ...rest } = serverCard;
    act(() => result.current.updateCard('A', rest as Partial<DeckCard>));

    expect(result.current.deck!.cards[0].card_id).toBe('A'); // stable id preserved
    expect(result.current.deck!.cards[0].title).toBe('Rewritten title');
    expect(result.current.deck!.cards[1].title).toBe('B'); // sibling untouched
  });

  it('UNDO after a rewrite restores the previous slide content', () => {
    const { result } = renderHook(() => useDeckState(makeDeck([makeCard('A', 'Original')])));

    act(() => result.current.updateCard('A', { title: 'Rewritten' }));
    expect(result.current.deck!.cards[0].title).toBe('Rewritten');

    act(() => result.current.undo());
    expect(result.current.deck!.cards[0].title).toBe('Original');
  });
});
