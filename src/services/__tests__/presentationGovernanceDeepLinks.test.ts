/**
 * presentationGovernanceDeepLinks.test
 *
 * Pure-logic test suite. Vitest's default `jsdom` environment makes
 * `window` and `history` available; the SSR-safe assertions explicitly
 * unset `globalThis.window` to verify the parser/applier no-ops without
 * a DOM.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyDashboardDeepLinkToLocation,
  buildDashboardDeepLink,
  type DashboardDeepLink,
  diffDeepLinkChanged,
  PARAM_KEYS,
  parseDashboardDeepLink,
  readDashboardDeepLinkFromLocation,
} from '../presentationGovernanceDeepLinks';

const EMPTY: DashboardDeepLink = {
  tab: null,
  deckId: null,
  slo: null,
  presetId: null,
  windowDays: null,
};

describe('parseDashboardDeepLink', () => {
  it('parses every supported param when present', () => {
    const parsed = parseDashboardDeepLink(
      '?tab=presentation-watchlist&deckId=deck_abc-123&slo=export_success_rate&presetId=preset_q1&windowDays=14'
    );

    expect(parsed).toEqual<DashboardDeepLink>({
      tab: 'presentation-watchlist',
      deckId: 'deck_abc-123',
      slo: 'export_success_rate',
      presetId: 'preset_q1',
      windowDays: 14,
    });
  });

  it('rejects an unknown tab value', () => {
    const parsed = parseDashboardDeepLink('?tab=nonexistent-tab&deckId=deck_1');
    expect(parsed.tab).toBeNull();
    expect(parsed.deckId).toBe('deck_1');
  });

  it('rejects an unknown slo value', () => {
    const parsed = parseDashboardDeepLink('?slo=not_a_real_slo');
    expect(parsed.slo).toBeNull();
  });

  it('rejects deckIds that exceed 80 chars or contain bad characters', () => {
    const tooLong = 'a'.repeat(81);
    const badChars = 'deck with spaces!';

    expect(parseDashboardDeepLink(`?deckId=${tooLong}`).deckId).toBeNull();
    expect(parseDashboardDeepLink(`?deckId=${encodeURIComponent(badChars)}`).deckId).toBeNull();
    expect(parseDashboardDeepLink('?deckId=').deckId).toBeNull();
  });

  it('clamps windowDays into the [1, 90] range and rejects garbage', () => {
    expect(parseDashboardDeepLink('?windowDays=0').windowDays).toBe(1);
    expect(parseDashboardDeepLink('?windowDays=-5').windowDays).toBe(1);
    expect(parseDashboardDeepLink('?windowDays=91').windowDays).toBe(90);
    expect(parseDashboardDeepLink('?windowDays=10000').windowDays).toBe(90);
    expect(parseDashboardDeepLink('?windowDays=42').windowDays).toBe(42);
    expect(parseDashboardDeepLink('?windowDays=banana').windowDays).toBeNull();
    expect(parseDashboardDeepLink('?windowDays=').windowDays).toBeNull();
  });

  it('returns the empty shape for an empty / nonsense search string', () => {
    expect(parseDashboardDeepLink('')).toEqual(EMPTY);
    expect(parseDashboardDeepLink('?')).toEqual(EMPTY);
  });

  it('ignores unknown query params without affecting parsed state (backwards compat)', () => {
    const parsed = parseDashboardDeepLink(
      '?utm_source=newsletter&tab=presentation-operations-health&random=xyz&slo=p95_generation_latency_ms&deckId=deck_x'
    );

    expect(parsed).toEqual<DashboardDeepLink>({
      tab: 'presentation-operations-health',
      deckId: 'deck_x',
      slo: 'p95_generation_latency_ms',
      presetId: null,
      windowDays: null,
    });
  });
});

describe('buildDashboardDeepLink', () => {
  it('round-trips through parseDashboardDeepLink', () => {
    const original: DashboardDeepLink = {
      tab: 'presentation-telemetry',
      deckId: 'deck_42',
      slo: 'agent_edit_success_rate',
      presetId: 'preset-alpha',
      windowDays: 7,
    };

    const url = buildDashboardDeepLink(original);
    const search = url.includes('?') ? url.slice(url.indexOf('?')) : '';
    const reparsed = parseDashboardDeepLink(search);

    expect(reparsed).toEqual(original);
  });

  it('omits null params from the emitted URL', () => {
    const url = buildDashboardDeepLink({
      tab: 'presentation-watchlist',
      deckId: null,
      slo: null,
      presetId: null,
      windowDays: 30,
    });

    expect(url).toContain(`${PARAM_KEYS.tab}=presentation-watchlist`);
    expect(url).toContain(`${PARAM_KEYS.windowDays}=30`);
    expect(url).not.toContain(PARAM_KEYS.deckId);
    expect(url).not.toContain(PARAM_KEYS.slo);
    expect(url).not.toContain(PARAM_KEYS.presetId);
  });

  it('emits keys in stable, documented order', () => {
    const url = buildDashboardDeepLink({
      tab: 'presentation-watchlist',
      deckId: 'deck_z',
      slo: 'generation_success_rate',
      presetId: 'preset_q4',
      windowDays: 30,
    });

    const expectedOrder = [
      `${PARAM_KEYS.tab}=presentation-watchlist`,
      `${PARAM_KEYS.deckId}=deck_z`,
      `${PARAM_KEYS.slo}=generation_success_rate`,
      `${PARAM_KEYS.presetId}=preset_q4`,
      `${PARAM_KEYS.windowDays}=30`,
    ];

    expect(url).toBe(`/?${expectedOrder.join('&')}`);
  });

  it('returns the bare baseUrl when state is fully empty', () => {
    expect(buildDashboardDeepLink(EMPTY)).toBe('/');
    expect(buildDashboardDeepLink(EMPTY, '/super-admin/system')).toBe('/super-admin/system');
  });
});

describe('applyDashboardDeepLinkToLocation', () => {
  it('is a no-op when window is undefined (SSR-safe)', () => {
    const originalWindow = (globalThis as { window?: unknown }).window;
    delete (globalThis as { window?: unknown }).window;
    try {
      expect(() => applyDashboardDeepLinkToLocation(EMPTY)).not.toThrow();
    } finally {
      (globalThis as { window?: unknown }).window = originalWindow;
    }
  });
});

describe('readDashboardDeepLinkFromLocation', () => {
  it('returns the empty shape when window is undefined (SSR-safe)', () => {
    const originalWindow = (globalThis as { window?: unknown }).window;
    delete (globalThis as { window?: unknown }).window;
    try {
      expect(readDashboardDeepLinkFromLocation()).toEqual(EMPTY);
    } finally {
      (globalThis as { window?: unknown }).window = originalWindow;
    }
  });
});

describe('diffDeepLinkChanged', () => {
  it('returns the keys that differ between two states (incl. tab, deckId, slo)', () => {
    const a: DashboardDeepLink = {
      tab: 'presentation-watchlist',
      deckId: 'deck_a',
      slo: null,
      presetId: 'preset_x',
      windowDays: 7,
    };
    const b: DashboardDeepLink = {
      tab: 'presentation-operations-health',
      deckId: 'deck_b',
      slo: 'export_success_rate',
      presetId: 'preset_x',
      windowDays: 7,
    };

    expect(diffDeepLinkChanged(a, b)).toEqual(['tab', 'deckId', 'slo']);
    expect(diffDeepLinkChanged(a, a)).toEqual([]);
  });
});

describe('applyDashboardDeepLinkToLocation (history side effects)', () => {
  let replaceSpy: ReturnType<typeof vi.spyOn>;
  let pushSpy: ReturnType<typeof vi.spyOn>;
  let originalSearch: string;
  let originalLocation: Location;

  beforeEach(() => {
    // The shared test setup replaces window.location with a frozen-ish
    // plain object, so we substitute a writable stand-in that exposes
    // pathname/search/hash for the apply function to read.
    originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: {
        pathname: '/super-admin/system',
        search: '?utm_source=mail&tab=stale&deckId=stale_deck',
        hash: '',
      },
    });
    originalSearch = window.location.search;
    replaceSpy = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
    pushSpy = vi.spyOn(window.history, 'pushState').mockImplementation(() => {});
  });

  afterEach(() => {
    replaceSpy.mockRestore();
    pushSpy.mockRestore();
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
    void originalSearch;
  });

  it('writes the canonical deep-link shape via replaceState and preserves unrelated params', () => {
    applyDashboardDeepLinkToLocation({
      tab: 'presentation-watchlist',
      deckId: 'deck_new',
      slo: null,
      presetId: null,
      windowDays: 14,
    });

    expect(replaceSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy).not.toHaveBeenCalled();
    const url = String(replaceSpy.mock.calls[0]?.[2] ?? '');
    expect(url.startsWith('/super-admin/system?')).toBe(true);
    expect(url).toContain('utm_source=mail');
    expect(url).toContain('tab=presentation-watchlist');
    expect(url).toContain('deckId=deck_new');
    expect(url).toContain('windowDays=14');
    expect(url).not.toContain('slo=');
    expect(url).not.toContain('presetId=');
  });

  it('uses pushState when replace is explicitly false', () => {
    applyDashboardDeepLinkToLocation(
      {
        tab: 'presentation-operations-health',
        deckId: null,
        slo: 'export_success_rate',
        presetId: null,
        windowDays: null,
      },
      { replace: false }
    );

    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(replaceSpy).not.toHaveBeenCalled();
  });
});
