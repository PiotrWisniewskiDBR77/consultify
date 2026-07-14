/**
 * deckImageResolverService — W5 / brief→image POST-STEP for the DECK premium path
 *
 * B1 (presentationLayoutDirectorService.planDeckLayout) outputs a `SlideLayoutPlan`
 * per slide carrying an `imageBrief` (a short prompt like "modern industrial water
 * meter facility at dusk, blue tones") but NO actual image. This service is the
 * missing brief→image step that turns those briefs into REAL stock images so the
 * deck reaches a "100% premium" look on export (PDF/PNG via playwrightPdfRenderer,
 * which loads <img src> on `networkidle`).
 *
 * DESIGN — deliberately a SEPARATE post-step (NOT inside the layout director):
 *   - The layout director (B1) is owned by another agent; image-resolution stays
 *     decoupled so the two can evolve independently.
 *   - Takes a plan (or just briefs) → queries the configured stock provider
 *     (Q5 = Unsplash) via stockImageProvider → returns one result per slide.
 *
 * SAFETY (program Znalezisko #1 — generation touches live clients):
 *   - FAIL-OPEN per slide: no key / no result / network error → `imageUrl: null`
 *     for that slide. This function NEVER throws.
 *   - No key configured (UNSPLASH_ACCESS_KEY absent) → provider chooser falls back
 *     to the null provider → every slide resolves to null. The deck still renders,
 *     just without photos. The `providerUsed` field makes the absence observable.
 *   - Concurrency is bounded so resolving a 20-slide deck doesn't open 20 sockets.
 *
 * ORIENTATION heuristic: cover/section_intro slides → landscape hero image;
 * everything else also landscape (deck canvas is 1920×1080). Portrait reserved
 * for future side-rail layouts.
 *
 * @module services/deliverables/deckImageResolverService
 */

import logger from '../../utils/Logger.js';
import type { SlideLayoutPlan } from '../presentationLayoutDirectorService.js';
import {
  selectStockImageProvider,
  type StockImageFetchOptions,
  type StockImageProvider,
  type StockImageProviderConfig,
  type StockImageProviderName,
} from './stockImageProvider.js';

const LOG_PREFIX = '[deckImageResolver]';

/** Bound parallel stock-API calls so a big deck doesn't fan out unboundedly. */
const DEFAULT_CONCURRENCY = 4;

// ──────────────────────────────────────────────────────────────
// Public contract
// ──────────────────────────────────────────────────────────────

export interface ResolvedSlideImage {
  slideIndex: number;
  /** The brief that drove the query (echoed back for traceability). */
  brief: string | null;
  /** Resolved image URL, or null when no key / no result / brief was empty. */
  imageUrl: string | null;
  /** Smaller variant for previews, when the provider returned one. */
  thumbnailUrl?: string | null;
  /** Licensing credit string (Unsplash/Pexels TOS) — null when no image. */
  attribution: string | null;
  width?: number | null;
  height?: number | null;
}

export interface DeckImageResolutionResult {
  images: ResolvedSlideImage[];
  /** Which provider actually serviced the queries ('null' = no key configured). */
  providerUsed: StockImageProviderName;
  /** How many slides resolved to a real (non-null) image URL. */
  resolvedCount: number;
  /** How many slides carried a non-empty brief (i.e. were eligible). */
  briefCount: number;
}

export interface ResolveDeckImagesOptions extends StockImageProviderConfig {
  /** Max parallel provider calls. Default {@link DEFAULT_CONCURRENCY}. */
  concurrency?: number;
  /**
   * Inject a provider directly (tests / callers that already resolved one).
   * When supplied, the chooser config (provider/keys) is ignored.
   */
  provider?: StockImageProviderName;
  providerInstance?: StockImageProvider;
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

/**
 * Layout intent → preferred image orientation. Deck canvas is landscape
 * (1920×1080), so almost everything wants landscape; this is a seam for
 * future portrait/side-rail layouts.
 */
function orientationForIntent(intent: string | undefined): StockImageFetchOptions['orientation'] {
  // All current deck layouts are landscape-friendly. Kept as a function so the
  // mapping can grow without touching the resolve loop.
  void intent;
  return 'landscape';
}

/** Bounded-concurrency map: runs `fn` over items, at most `limit` in flight. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const safeLimit = Math.max(1, Math.min(limit, items.length || 1));

  async function worker(): Promise<void> {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: safeLimit }, () => worker()));
  return results;
}

function emptyResult(slideIndex: number, brief: string | null): ResolvedSlideImage {
  return {
    slideIndex,
    brief,
    imageUrl: null,
    thumbnailUrl: null,
    attribution: null,
    width: null,
    height: null,
  };
}

// ──────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────

/**
 * Resolve a list of (slideIndex, brief) pairs into stock images. Lower-level
 * entry point used by {@link resolveDeckImages}; exported for callers that
 * have briefs but not full SlideLayoutPlans.
 *
 * FAIL-OPEN: every failure mode (no key, empty brief, no result, network
 * error) yields `imageUrl: null` for that slide. NEVER throws.
 */
export async function resolveImageBriefs(
  briefs: Array<{ slideIndex: number; brief: string | null }>,
  opts: ResolveDeckImagesOptions = {}
): Promise<DeckImageResolutionResult> {
  const provider: StockImageProvider =
    opts.providerInstance ??
    selectStockImageProvider({
      provider: opts.provider,
      unsplashAccessKey: opts.unsplashAccessKey,
      pexelsApiKey: opts.pexelsApiKey,
    });

  const concurrency = opts.concurrency ?? DEFAULT_CONCURRENCY;

  const images = await mapWithConcurrency(briefs, concurrency, async (entry) => {
    const brief = typeof entry.brief === 'string' && entry.brief.trim() ? entry.brief.trim() : null;
    if (!brief) return emptyResult(entry.slideIndex, null);

    try {
      const hit = await provider.fetchImage(brief, {
        orientation: 'landscape',
        minWidth: 1280,
      });
      if (!hit) return emptyResult(entry.slideIndex, brief);
      return {
        slideIndex: entry.slideIndex,
        brief,
        imageUrl: hit.url,
        thumbnailUrl: hit.thumbnailUrl ?? null,
        attribution: hit.attribution,
        width: hit.width ?? null,
        height: hit.height ?? null,
      } satisfies ResolvedSlideImage;
    } catch (err) {
      // Provider already fails-open to null, but belt-and-suspenders here so a
      // single bad brief can never poison the whole deck.
      logger.warn(
        `${LOG_PREFIX} resolve failed for slide ${entry.slideIndex}`,
        (err as Error).message
      );
      return emptyResult(entry.slideIndex, brief);
    }
  });

  const briefCount = briefs.filter(
    (b) => typeof b.brief === 'string' && b.brief.trim().length > 0
  ).length;
  const resolvedCount = images.filter((i) => i.imageUrl !== null).length;

  return {
    images,
    providerUsed: provider.name,
    resolvedCount,
    briefCount,
  };
}

/**
 * Resolve images for a full deck plan (output of `planDeckLayout`). Reads
 * `imageBrief` per `SlideLayoutPlan`, preserving `slideIndex`. Orientation is
 * derived from each plan's `layoutIntent`.
 *
 * FAIL-OPEN: slides with no brief, or any resolution failure, get
 * `imageUrl: null`. NEVER throws. When no provider key is configured the
 * whole deck resolves to null and `providerUsed === 'null'`.
 */
export async function resolveDeckImages(
  plans: SlideLayoutPlan[],
  opts: ResolveDeckImagesOptions = {}
): Promise<DeckImageResolutionResult> {
  const safePlans = Array.isArray(plans) ? plans : [];

  const provider: StockImageProvider =
    opts.providerInstance ??
    selectStockImageProvider({
      provider: opts.provider,
      unsplashAccessKey: opts.unsplashAccessKey,
      pexelsApiKey: opts.pexelsApiKey,
    });

  const concurrency = opts.concurrency ?? DEFAULT_CONCURRENCY;

  const images = await mapWithConcurrency(safePlans, concurrency, async (plan) => {
    const brief =
      typeof plan.imageBrief === 'string' && plan.imageBrief.trim() ? plan.imageBrief.trim() : null;
    if (!brief) return emptyResult(plan.slideIndex, null);

    try {
      const hit = await provider.fetchImage(brief, {
        orientation: orientationForIntent(plan.layoutIntent),
        minWidth: 1280,
      });
      if (!hit) return emptyResult(plan.slideIndex, brief);
      return {
        slideIndex: plan.slideIndex,
        brief,
        imageUrl: hit.url,
        thumbnailUrl: hit.thumbnailUrl ?? null,
        attribution: hit.attribution,
        width: hit.width ?? null,
        height: hit.height ?? null,
      } satisfies ResolvedSlideImage;
    } catch (err) {
      logger.warn(
        `${LOG_PREFIX} resolve failed for slide ${plan.slideIndex}`,
        (err as Error).message
      );
      return emptyResult(plan.slideIndex, brief);
    }
  });

  const briefCount = safePlans.filter(
    (p) => typeof p.imageBrief === 'string' && p.imageBrief.trim().length > 0
  ).length;
  const resolvedCount = images.filter((i) => i.imageUrl !== null).length;

  return {
    images,
    providerUsed: provider.name,
    resolvedCount,
    briefCount,
  };
}
