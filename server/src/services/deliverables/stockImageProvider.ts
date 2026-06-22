/**
 * stockImageProvider — W5 / X4 (Seria X, domena assety)
 *
 * Fallback obrazów stockowych dla generacji deliverable (deck/doc): kiedy AI
 * provider obrazów jest OFF lub padnie, słajdy/sekcje wymagające ilustracji
 * dostają obraz stockowy zamiast pustego placeholdera.
 *
 * KONTRAKT (provider-agnostic):
 *   - `StockImageProvider.fetchImage(query, opts)` → `StockImageResult | null`
 *     null gdy brak klucza API, brak wyników, lub błąd sieci (fail-open).
 *   - Wszystkie providery zwracają **URL + attribution** (wymóg licencyjny
 *     Unsplash/Pexels), NIGDY surowych bajtów (te ściąga renderer/cache).
 *   - Provider chooser preferuje skonfigurowany provider, fallback na Null.
 *
 * Q5 (czeka na decyzję Piotra) = który provider jest "kanoniczny" dla
 * produkcji (Unsplash vs Pexels). Tutaj buduję OBA + Null + chooser; klient
 * wskazuje przez `provider` w config / env / org-config.
 *
 * NIE WPIĘTE w żywy pipeline (rendery deck/doc dziś go nie wołają) — eksport
 * tylko + opt-in. Bezpieczne dla klientów.
 *
 * @module services/deliverables/stockImageProvider
 */

import logger from '../../utils/Logger.js';

const LOG_PREFIX = '[stockImageProvider]';

// ──────────────────────────────────────────────────────────────
// Public contract
// ──────────────────────────────────────────────────────────────

export type StockImageProviderName = 'unsplash' | 'pexels' | 'null';

export interface StockImageResult {
  url: string;
  /** Required by Unsplash/Pexels TOS — credit string for embedding. */
  attribution: string;
  provider: StockImageProviderName;
  /** Optional: thumbnail URL (smaller variant) for previews. */
  thumbnailUrl?: string;
  width?: number;
  height?: number;
}

export interface StockImageFetchOptions {
  /** Preferowana orientacja — wpływa na query params providera. */
  orientation?: 'landscape' | 'portrait' | 'square';
  /** Minimalna szerokość obrazu (filtruje małe wyniki). */
  minWidth?: number;
}

export interface StockImageProvider {
  readonly name: StockImageProviderName;
  /**
   * Zwraca pierwszy pasujący obraz lub null (brak klucza / brak wyników /
   * błąd sieci). NIGDY nie rzuca.
   */
  fetchImage(query: string, opts?: StockImageFetchOptions): Promise<StockImageResult | null>;
}

export interface StockImageProviderConfig {
  /** Który provider preferować. Default = ENV STOCK_IMAGE_PROVIDER lub 'null'. */
  provider?: StockImageProviderName;
  /** Klucz API per-provider. Default = env (UNSPLASH_ACCESS_KEY / PEXELS_API_KEY). */
  unsplashAccessKey?: string;
  pexelsApiKey?: string;
}

// ──────────────────────────────────────────────────────────────
// HTTP helper — minimalny, testowalny (fetch is global in Node 18+)
// ──────────────────────────────────────────────────────────────

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

function getFetch(): FetchLike {
  // Wrap global fetch — pozwala testom mockować przez globalThis.fetch.
  if (typeof globalThis.fetch !== 'function') {
    throw new Error('global fetch unavailable (Node 18+ required)');
  }
  return globalThis.fetch.bind(globalThis);
}

// ──────────────────────────────────────────────────────────────
// Null provider — zawsze zwraca null (gdy brak klucza lub provider='null')
// ──────────────────────────────────────────────────────────────

export const nullStockImageProvider: StockImageProvider = {
  name: 'null',
  async fetchImage(): Promise<StockImageResult | null> {
    return null;
  },
};

// ──────────────────────────────────────────────────────────────
// Unsplash provider
// ──────────────────────────────────────────────────────────────

interface UnsplashSearchPhoto {
  id: string;
  width: number;
  height: number;
  urls: { regular?: string; small?: string };
  user?: { name?: string; links?: { html?: string } };
  links?: { html?: string };
}

interface UnsplashSearchResponse {
  results?: UnsplashSearchPhoto[];
}

export function createUnsplashProvider(accessKey: string): StockImageProvider {
  return {
    name: 'unsplash',
    async fetchImage(
      query: string,
      opts: StockImageFetchOptions = {}
    ): Promise<StockImageResult | null> {
      if (!accessKey || !query.trim()) return null;

      const params = new URLSearchParams({
        query: query.trim(),
        per_page: '1',
      });
      if (opts.orientation) params.set('orientation', opts.orientation);

      const url = `https://api.unsplash.com/search/photos?${params.toString()}`;

      try {
        const res = await getFetch()(url, {
          headers: {
            Authorization: `Client-ID ${accessKey}`,
            'Accept-Version': 'v1',
          },
        });
        if (!res.ok) {
          logger.warn(`${LOG_PREFIX} Unsplash HTTP ${res.status} for "${query}"`);
          return null;
        }
        const json = (await res.json()) as UnsplashSearchResponse;
        const photo = json.results?.[0];
        if (!photo?.urls?.regular) return null;

        const photographer = photo.user?.name ?? 'Unsplash photographer';
        const photoLink = photo.links?.html ?? `https://unsplash.com/photos/${photo.id}`;
        return {
          url: photo.urls.regular,
          thumbnailUrl: photo.urls.small,
          width: photo.width,
          height: photo.height,
          provider: 'unsplash',
          // Format zgodny z Unsplash API Guidelines.
          attribution: `Photo by ${photographer} on Unsplash (${photoLink})`,
        };
      } catch (err) {
        logger.warn(`${LOG_PREFIX} Unsplash fetch failed`, (err as Error).message);
        return null;
      }
    },
  };
}

// ──────────────────────────────────────────────────────────────
// Pexels provider
// ──────────────────────────────────────────────────────────────

interface PexelsSearchPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url?: string;
  src: { large2x?: string; large?: string; medium?: string; small?: string };
}

interface PexelsSearchResponse {
  photos?: PexelsSearchPhoto[];
}

export function createPexelsProvider(apiKey: string): StockImageProvider {
  return {
    name: 'pexels',
    async fetchImage(
      query: string,
      opts: StockImageFetchOptions = {}
    ): Promise<StockImageResult | null> {
      if (!apiKey || !query.trim()) return null;

      const params = new URLSearchParams({
        query: query.trim(),
        per_page: '1',
      });
      if (opts.orientation) params.set('orientation', opts.orientation);

      const url = `https://api.pexels.com/v1/search?${params.toString()}`;

      try {
        const res = await getFetch()(url, {
          headers: { Authorization: apiKey },
        });
        if (!res.ok) {
          logger.warn(`${LOG_PREFIX} Pexels HTTP ${res.status} for "${query}"`);
          return null;
        }
        const json = (await res.json()) as PexelsSearchResponse;
        const photo = json.photos?.[0];
        if (!photo?.src) return null;

        const imgUrl = photo.src.large2x ?? photo.src.large ?? photo.src.medium;
        if (!imgUrl) return null;

        return {
          url: imgUrl,
          thumbnailUrl: photo.src.medium ?? photo.src.small,
          width: photo.width,
          height: photo.height,
          provider: 'pexels',
          attribution: `Photo by ${photo.photographer} on Pexels (${photo.url})`,
        };
      } catch (err) {
        logger.warn(`${LOG_PREFIX} Pexels fetch failed`, (err as Error).message);
        return null;
      }
    },
  };
}

// ──────────────────────────────────────────────────────────────
// Chooser — wybiera provider z config + env, fallback Null
// ──────────────────────────────────────────────────────────────

/**
 * Zwraca aktywny provider zgodnie z konfiguracją.
 *
 * Kolejność rozstrzygania:
 *   1. config.provider (jawnie zadeklarowany)
 *   2. env STOCK_IMAGE_PROVIDER
 *   3. 'null' (zawsze bezpieczne — brak obrazu, brak side-effectu)
 *
 * Jeśli wskazany provider nie ma klucza API → fallback do Null + warn.
 */
export function selectStockImageProvider(
  config: StockImageProviderConfig = {}
): StockImageProvider {
  const env = (typeof process !== 'undefined' ? process.env : {}) as Record<string, string>;
  const chosen =
    config.provider ?? (env.STOCK_IMAGE_PROVIDER as StockImageProviderName) ?? 'null';

  if (chosen === 'unsplash') {
    const key = config.unsplashAccessKey ?? env.UNSPLASH_ACCESS_KEY ?? '';
    if (!key) {
      logger.warn(`${LOG_PREFIX} Unsplash requested but UNSPLASH_ACCESS_KEY missing — using null`);
      return nullStockImageProvider;
    }
    return createUnsplashProvider(key);
  }

  if (chosen === 'pexels') {
    const key = config.pexelsApiKey ?? env.PEXELS_API_KEY ?? '';
    if (!key) {
      logger.warn(`${LOG_PREFIX} Pexels requested but PEXELS_API_KEY missing — using null`);
      return nullStockImageProvider;
    }
    return createPexelsProvider(key);
  }

  return nullStockImageProvider;
}
