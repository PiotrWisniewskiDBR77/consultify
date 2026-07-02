// @vitest-environment node
/**
 * Unit tests — stockImageProvider + iconSuggestionService (X4, W5 / Seria X)
 *
 * FT-1: ≥3 (suggest icon happy/fallback, null provider, Unsplash success)
 * FT-2: ≥2 (selectStockImageProvider z env, brak klucza → null)
 * FT-8: ≥2 (Unsplash HTTP error → null; Pexels fetch throw → null)
 *
 * Mocks:
 *   - globalThis.fetch — kontrolowany per test
 *   - utils/Logger.js  — silence
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const fetchMock = vi.fn();

describe('iconSuggestionService (X4)', () => {
  let suggestIconFor: typeof import('../../../server/src/services/deliverables/iconSuggestionService.js').suggestIconFor;
  let suggestIconsForList: typeof import('../../../server/src/services/deliverables/iconSuggestionService.js').suggestIconsForList;
  let ICON_FALLBACK: typeof import('../../../server/src/services/deliverables/iconSuggestionService.js').ICON_FALLBACK;

  beforeEach(async () => {
    const mod = await import(
      '../../../server/src/services/deliverables/iconSuggestionService.js'
    );
    suggestIconFor = mod.suggestIconFor;
    suggestIconsForList = mod.suggestIconsForList;
    ICON_FALLBACK = mod.ICON_FALLBACK;
  });

  it('FT-1/1: domain-specific keyword → specific icon', () => {
    expect(suggestIconFor('Ryzyka projektu Apator')).toBe('alert-triangle');
    expect(suggestIconFor('Budżet inicjatywy')).toBe('wallet');
    expect(suggestIconFor('Roadmap Q3')).toBe('map');
    expect(suggestIconFor('KPI wskaźnik')).toBe('gauge');
  });

  it('FT-1/2: case-insensitive matching', () => {
    expect(suggestIconFor('RISK assessment')).toBe('alert-triangle');
    expect(suggestIconFor('AI assistant')).toBe('sparkles');
  });

  it('FT-1/3: no match → FALLBACK_ICON (never null)', () => {
    expect(suggestIconFor('xyzzy gibberish')).toBe(ICON_FALLBACK);
    expect(suggestIconFor('')).toBe(ICON_FALLBACK);
    expect(suggestIconFor(undefined as any)).toBe(ICON_FALLBACK);
  });

  it('FT-1/4: suggestIconsForList — dedup consecutive repeats', () => {
    const icons = suggestIconsForList(['Ryzyko 1', 'Ryzyko 2', 'Budżet']);
    expect(icons).toHaveLength(3);
    expect(icons[0]).toBe('alert-triangle');
    expect(icons[1]).toBe(ICON_FALLBACK); // dedup
    expect(icons[2]).toBe('wallet');
  });
});

describe('stockImageProvider (X4)', () => {
  let createUnsplashProvider: typeof import('../../../server/src/services/deliverables/stockImageProvider.js').createUnsplashProvider;
  let createPexelsProvider: typeof import('../../../server/src/services/deliverables/stockImageProvider.js').createPexelsProvider;
  let selectStockImageProvider: typeof import('../../../server/src/services/deliverables/stockImageProvider.js').selectStockImageProvider;
  let nullStockImageProvider: typeof import('../../../server/src/services/deliverables/stockImageProvider.js').nullStockImageProvider;

  beforeEach(async () => {
    vi.resetModules();
    fetchMock.mockReset();
    (globalThis as any).fetch = fetchMock;
    const mod = await import(
      '../../../server/src/services/deliverables/stockImageProvider.js'
    );
    createUnsplashProvider = mod.createUnsplashProvider;
    createPexelsProvider = mod.createPexelsProvider;
    selectStockImageProvider = mod.selectStockImageProvider;
    nullStockImageProvider = mod.nullStockImageProvider;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────
  // FT-1 — Null provider
  // ──────────────────────────────────────────────────────────────

  it('FT-1/5: null provider → always returns null (no fetch)', async () => {
    const result = await nullStockImageProvider.fetchImage('cars');
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────────────────────
  // FT-1 — Unsplash happy path
  // ──────────────────────────────────────────────────────────────

  it('FT-1/6: Unsplash success → returns URL + attribution + provider="unsplash"', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          {
            id: 'abc123',
            width: 1920,
            height: 1080,
            urls: { regular: 'https://images.unsplash.com/photo-abc.jpg' },
            user: { name: 'Jan Kowalski' },
            links: { html: 'https://unsplash.com/photos/abc123' },
          },
        ],
      }),
    } as any);

    const provider = createUnsplashProvider('test-key');
    const result = await provider.fetchImage('mountain landscape', {
      orientation: 'landscape',
    });

    expect(result).not.toBeNull();
    expect(result!.url).toBe('https://images.unsplash.com/photo-abc.jpg');
    expect(result!.provider).toBe('unsplash');
    expect(result!.attribution).toContain('Jan Kowalski');
    expect(result!.attribution).toContain('Unsplash');
    expect(result!.width).toBe(1920);

    // Sprawdź autoryzację + query string
    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[0]).toContain('api.unsplash.com/search/photos');
    expect(callArgs[0]).toContain('orientation=landscape');
    expect(callArgs[1].headers.Authorization).toBe('Client-ID test-key');
  });

  it('FT-1/7: Unsplash empty results → null', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ results: [] }),
    } as any);

    const provider = createUnsplashProvider('test-key');
    const result = await provider.fetchImage('quasar fnord');
    expect(result).toBeNull();
  });

  it('FT-1/8: Unsplash empty query / empty key → null without fetch', async () => {
    const provider = createUnsplashProvider('test-key');
    expect(await provider.fetchImage('')).toBeNull();
    expect(await provider.fetchImage('   ')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    const noKey = createUnsplashProvider('');
    expect(await noKey.fetchImage('forest')).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────
  // FT-1 — Pexels happy path
  // ──────────────────────────────────────────────────────────────

  it('FT-1/9: Pexels success → returns URL + attribution + provider="pexels"', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        photos: [
          {
            id: 42,
            width: 2400,
            height: 1600,
            url: 'https://www.pexels.com/photo/42/',
            photographer: 'Anna Nowak',
            src: { large2x: 'https://images.pexels.com/photos/42/large2x.jpg' },
          },
        ],
      }),
    } as any);

    const provider = createPexelsProvider('pexels-key');
    const result = await provider.fetchImage('city skyline');

    expect(result).not.toBeNull();
    expect(result!.provider).toBe('pexels');
    expect(result!.url).toContain('pexels.com');
    expect(result!.attribution).toContain('Anna Nowak');
    expect(result!.attribution).toContain('Pexels');

    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[1].headers.Authorization).toBe('pexels-key');
  });

  // ──────────────────────────────────────────────────────────────
  // FT-2 — Provider chooser
  // ──────────────────────────────────────────────────────────────

  it('FT-2/10: selectStockImageProvider with explicit unsplash + key → unsplash', () => {
    const provider = selectStockImageProvider({
      provider: 'unsplash',
      unsplashAccessKey: 'xyz',
    });
    expect(provider.name).toBe('unsplash');
  });

  it('FT-2/11: selectStockImageProvider with unsplash but NO key → null provider (fallback)', () => {
    // Wyczyść env, żeby chooser nie zassał klucza z innego miejsca.
    const oldEnv = process.env.UNSPLASH_ACCESS_KEY;
    delete process.env.UNSPLASH_ACCESS_KEY;
    try {
      const provider = selectStockImageProvider({ provider: 'unsplash' });
      expect(provider.name).toBe('null');
    } finally {
      if (oldEnv) process.env.UNSPLASH_ACCESS_KEY = oldEnv;
    }
  });

  it('FT-2/12: selectStockImageProvider default → null when no provider specified', () => {
    const oldP = process.env.STOCK_IMAGE_PROVIDER;
    delete process.env.STOCK_IMAGE_PROVIDER;
    try {
      const provider = selectStockImageProvider({});
      expect(provider.name).toBe('null');
    } finally {
      if (oldP) process.env.STOCK_IMAGE_PROVIDER = oldP;
    }
  });

  // ──────────────────────────────────────────────────────────────
  // FT-8 — fail-open paths
  // ──────────────────────────────────────────────────────────────

  it('FT-8/13: Unsplash HTTP 503 → null (no throw)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({}),
    } as any);

    const provider = createUnsplashProvider('test-key');
    const result = await provider.fetchImage('rivers');
    expect(result).toBeNull();
  });

  it('FT-8/14: Pexels fetch throws → null (caught, no propagation)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ENETUNREACH'));

    const provider = createPexelsProvider('test-key');
    const result = await provider.fetchImage('ocean');
    expect(result).toBeNull();
  });
});
