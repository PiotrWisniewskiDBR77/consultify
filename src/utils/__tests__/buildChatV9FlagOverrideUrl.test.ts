/**
 * Chat V9 / ADMIN AG1 v1.12 — tests for the override-URL
 * builder.
 *
 * We pin the contract end-to-end:
 *   - Registry order is preserved across ON / OFF mixes.
 *   - Flags at their shipped default are omitted.
 *   - Non-`ff_*` query params the admin already has are
 *     preserved verbatim.
 *   - Any pre-existing `ff_*` params are dropped and
 *     replaced with the current override set (the URL is
 *     a snapshot, not a merge).
 *   - Idempotence — round-tripping the output back through
 *     the builder does not accumulate params.
 *   - Graceful degradation when `location.search` is empty
 *     / the admin has zero overrides.
 */

import { describe, expect, it } from 'vitest';

import { buildChatV9FlagOverrideUrl } from '../buildChatV9FlagOverrideUrl';
import type { ChatV9FlagDescriptor } from '../chatV9FeatureFlags';

const makeFlag = (id: string, query: string, defaultOn = true): ChatV9FlagDescriptor => ({
  id,
  ticket: 'AG1.0',
  block: 'admin',
  title: id,
  description: 'test',
  default: defaultOn,
  keys: { localStorage: `ff.${id}`, query, env: `VITE_${id}` },
  isEnabled: () => defaultOn,
  telemetry: [],
  testId: null,
  specDocs: [],
});

const FLAGS: readonly ChatV9FlagDescriptor[] = [
  makeFlag('trust-badge', 'ff_trustBadge'),
  makeFlag('pii-heuristic-toast', 'ff_piiHeuristicToast'),
  makeFlag('next-model-chip', 'ff_nextModelChip'),
];

const LOC = {
  origin: 'https://admin.test',
  pathname: '/app',
  search: '',
};

describe('buildChatV9FlagOverrideUrl', () => {
  it('returns a bare URL when there are no overrides', () => {
    const url = buildChatV9FlagOverrideUrl({
      flags: FLAGS,
      getOverride: () => null,
      location: LOC,
    });
    expect(url).toBe('https://admin.test/app');
  });

  it('encodes ON overrides as `=1` and OFF overrides as `=0`', () => {
    const url = buildChatV9FlagOverrideUrl({
      flags: FLAGS,
      getOverride: (id) =>
        id === 'trust-badge' ? 'off' : id === 'pii-heuristic-toast' ? 'on' : null,
      location: LOC,
    });
    expect(url).toBe('https://admin.test/app?ff_trustBadge=0&ff_piiHeuristicToast=1');
  });

  it('emits overrides in registry order, not override-map order', () => {
    const url = buildChatV9FlagOverrideUrl({
      flags: FLAGS,
      getOverride: (id) => {
        if (id === 'next-model-chip') return 'off';
        if (id === 'trust-badge') return 'on';
        return null;
      },
      location: LOC,
    });
    // `trust-badge` (index 0) must come before `next-model-chip`
    // (index 2), regardless of which override we read first.
    expect(url).toBe('https://admin.test/app?ff_trustBadge=1&ff_nextModelChip=0');
  });

  it('skips flags that have no override (matches default)', () => {
    const url = buildChatV9FlagOverrideUrl({
      flags: FLAGS,
      getOverride: (id) => (id === 'pii-heuristic-toast' ? 'off' : null),
      location: LOC,
    });
    expect(url).toBe('https://admin.test/app?ff_piiHeuristicToast=0');
  });

  it('preserves non-`ff_*` query params the admin already has', () => {
    const url = buildChatV9FlagOverrideUrl({
      flags: FLAGS,
      getOverride: (id) => (id === 'trust-badge' ? 'off' : null),
      location: { ...LOC, search: '?tenant=acme&v9flags=1' },
    });
    expect(url).toBe('https://admin.test/app?tenant=acme&v9flags=1&ff_trustBadge=0');
  });

  it('drops pre-existing `ff_*` params and replaces them with the current override set', () => {
    const url = buildChatV9FlagOverrideUrl({
      flags: FLAGS,
      getOverride: (id) => (id === 'pii-heuristic-toast' ? 'on' : null),
      location: {
        ...LOC,
        // Stale ff_trustBadge; current overrides say it is default.
        search: '?ff_trustBadge=0&tenant=acme',
      },
    });
    expect(url).toBe('https://admin.test/app?tenant=acme&ff_piiHeuristicToast=1');
  });

  it('is idempotent — round-trip through URL returns the same search set', () => {
    const first = buildChatV9FlagOverrideUrl({
      flags: FLAGS,
      getOverride: (id) => (id === 'trust-badge' ? 'off' : null),
      location: LOC,
    });
    const url = new URL(first);
    const second = buildChatV9FlagOverrideUrl({
      flags: FLAGS,
      getOverride: (id) => (id === 'trust-badge' ? 'off' : null),
      location: {
        origin: url.origin,
        pathname: url.pathname,
        search: url.search,
      },
    });
    expect(second).toBe(first);
  });

  it('returns the bare origin+pathname when both overrides and preserved search are empty', () => {
    const url = buildChatV9FlagOverrideUrl({
      flags: FLAGS,
      getOverride: () => null,
      location: { origin: 'https://admin.test', pathname: '/app', search: '' },
    });
    expect(url).toBe('https://admin.test/app');
    expect(url.endsWith('?')).toBe(false);
  });

  it('handles a leading `?` in `location.search` correctly', () => {
    const url = buildChatV9FlagOverrideUrl({
      flags: FLAGS,
      getOverride: (id) => (id === 'trust-badge' ? 'on' : null),
      location: { ...LOC, search: '?foo=bar' },
    });
    expect(url).toBe('https://admin.test/app?foo=bar&ff_trustBadge=1');
  });

  it('handles a missing leading `?` in `location.search` gracefully', () => {
    const url = buildChatV9FlagOverrideUrl({
      flags: FLAGS,
      getOverride: (id) => (id === 'trust-badge' ? 'on' : null),
      location: { ...LOC, search: 'foo=bar' },
    });
    expect(url).toBe('https://admin.test/app?foo=bar&ff_trustBadge=1');
  });

  it('handles an empty flags registry cleanly', () => {
    const url = buildChatV9FlagOverrideUrl({
      flags: [],
      getOverride: () => 'on',
      location: LOC,
    });
    expect(url).toBe('https://admin.test/app');
  });
});
