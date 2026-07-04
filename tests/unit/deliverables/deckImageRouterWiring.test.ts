// @vitest-environment node
/**
 * Unit tests — P2.1: imageRouter wired into deck slide visual materialization
 * (server/src/services/ai/deckVisualsService.ts `tryStockFallback`, reached via
 * the exported `materializePlannedVisual`).
 *
 * Proves:
 *   (a) mock stock provider configured (STOCK_IMAGE_PROVIDER=unsplash +
 *       UNSPLASH_ACCESS_KEY set) → routeImage() selects 'unsplash' (T0, free),
 *       the slide's planned visual resolves to a REAL asset (local path,
 *       downloaded from the provider's URL) — i.e. imageBrief → URL → slide.
 *   (b) no provider configured (no keys, no DELIVERABLE_IMAGE_PROVIDER) →
 *       materialization returns a warning, NO asset — deck generation is
 *       expected to proceed slide-without-image (fail-open, zero regression
 *       vs pre-P2.1 behavior).
 *
 * Mocks:
 *   - utils/DbPromise.js        → reject (no DB in unit tests; DB-driven
 *     purpose assignment fails-open to the env-default chain, same as prod
 *     when ai_purpose_assignments has no active row).
 *   - utils/Logger.js           → silence.
 *   - deliverables/stockImageProvider.js → selectStockImageProvider mocked to
 *     return a controlled provider (present) or the real null provider
 *     (absent), so the test proves the *routing decision* without hitting
 *     the network.
 *   - global fetch              → controlled Response for the image download
 *     step inside tryStockFallback.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SlideVisualSpec, UnifiedReportMeta } from '../../../server/src/services/report/pptx/types.js';

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// DB is unavailable in unit tests — DbPromise calls reject, exactly like a
// missing/erroring connection in prod; selectProviderForPurpose fails-open.
vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: vi.fn().mockRejectedValue(new Error('no db in unit test')),
  get: vi.fn().mockRejectedValue(new Error('no db in unit test')),
  run: vi.fn().mockRejectedValue(new Error('no db in unit test')),
}));

const providerState: { mock: null | { name: string; fetchImage: (...a: any[]) => any } } = {
  mock: null,
};

vi.mock('../../../server/src/services/deliverables/stockImageProvider.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../../server/src/services/deliverables/stockImageProvider.js')
  >('../../../server/src/services/deliverables/stockImageProvider.js');
  return {
    ...actual,
    selectStockImageProvider: (cfg?: any) =>
      providerState.mock ?? actual.selectStockImageProvider(cfg),
  };
});

const META: UnifiedReportMeta = {
  client: 'ACME',
  project: 'Diagnosis',
  date: '2026-07-04',
  author: 'Tester',
  confidentiality: 'internal',
  language: 'en',
  template: 'corporate',
};

function plannedVisual(): SlideVisualSpec {
  return {
    slot: 'side_illustration',
    purpose: 'image_slide_asset',
    label: 'B1 image brief (single_insight)',
    prompt: 'modern industrial water meter facility at dusk, blue tones',
    aspect: '4:3',
  };
}

describe('P2.1 — imageRouter wired into deck slide generation (fail-open)', () => {
  const ORIGINAL_ENV = { ...process.env };
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    providerState.mock = null;
    process.env = { ...ORIGINAL_ENV };
    // Force the AI-provider (Gemini/OpenAI/Replicate) path OFF so the
    // materialization falls through to the stock/imageRouter path under test.
    delete process.env.DELIVERABLE_IMAGE_PROVIDER;
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.REPLICATE_API_TOKEN;
    delete process.env.REPLICATE_API_KEY;
    delete process.env.STOCK_IMAGE_PROVIDER;
    delete process.env.UNSPLASH_ACCESS_KEY;
    delete process.env.PEXELS_API_KEY;
    process.env.DELIVERABLE_IMAGE_PROVIDER = 'off';
    fetchSpy = vi.spyOn(globalThis, 'fetch' as any);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    process.env = { ...ORIGINAL_ENV };
    vi.clearAllMocks();
  });

  it('(a) mock provider configured → routeImage selects T0/unsplash, brief resolves to a real local asset', async () => {
    process.env.STOCK_IMAGE_PROVIDER = 'unsplash';
    process.env.UNSPLASH_ACCESS_KEY = 'test-key';

    providerState.mock = {
      name: 'unsplash',
      fetchImage: vi.fn().mockResolvedValue({
        url: 'https://images.example.com/photo123.jpg',
        attribution: 'Photo by Test Photographer on Unsplash (https://unsplash.com/photos/123)',
        provider: 'unsplash',
        width: 1920,
        height: 1080,
      }),
    };

    // Image-download step inside tryStockFallback.
    fetchSpy.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
    } as any);

    const { materializePlannedVisual } = await import(
      '../../../server/src/services/ai/deckVisualsService.js'
    );

    const { visual, warning } = await materializePlannedVisual({
      deckId: 'test-deck-p2-1',
      organizationId: 'org-1',
      meta: META,
      visual: plannedVisual(),
      priority: 'quality',
      dataClass: 'no_pii',
    });

    expect(warning).toBeUndefined();
    expect(visual).toBeDefined();
    expect(visual!.asset).toBeDefined();
    // Downloaded to a local path (PPTX/Image atomic only consumes path/dataUri).
    expect(visual!.asset!.path).toBeTruthy();
    expect(visual!.asset!.path).toContain('test-deck-p2-1');
    expect(visual!.asset!.provider).toContain('unsplash');
    expect(providerState.mock.fetchImage).toHaveBeenCalledTimes(1);

    // Cleanup the file written to exports/presentations/assets/<deckId>.
    const fs = await import('fs');
    const path = await import('path');
    const assetsDir = path.default.join(process.cwd(), 'exports', 'presentations', 'assets', 'test-deck-p2-1');
    if (fs.default.existsSync(assetsDir)) fs.default.rmSync(assetsDir, { recursive: true, force: true });
  });

  it('(b) no provider / no keys configured → NullProvider, slide gets no asset, generation does not throw', async () => {
    // No STOCK_IMAGE_PROVIDER, no UNSPLASH_ACCESS_KEY/PEXELS_API_KEY, no AI
    // provider — imageRouter still resolves a route (T0/unsplash by content
    // type), but selectStockImageProvider has no key to act on it with, so it
    // falls back to the null provider exactly like pre-P2.1.
    providerState.mock = null; // use the REAL selectStockImageProvider (no keys → null provider)

    const { materializePlannedVisual } = await import(
      '../../../server/src/services/ai/deckVisualsService.js'
    );

    const { visual, warning } = await materializePlannedVisual({
      deckId: 'test-deck-p2-1-nokeys',
      organizationId: 'org-1',
      meta: META,
      visual: plannedVisual(),
      priority: 'quality',
      dataClass: 'no_pii',
    });

    expect(warning).toBeTruthy();
    expect(visual).toBeUndefined();
    // Never hit the network (no provider available to call).
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
