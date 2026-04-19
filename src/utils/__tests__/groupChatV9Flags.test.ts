/**
 * Chat V9 / ADMIN AG1 v1.6 — unit tests for the pure grouping helper.
 *
 * These tests pin the observable contract:
 *
 *   - Blocks render in first-seen registry order (not alphabetical).
 *   - Empty blocks are excluded entirely.
 *   - `totalFlags` is always the full-registry count, regardless of
 *     what the filter dropped.
 *   - `visibleFlags` mirrors the filtered input.
 *   - `hasMatches` is the pure boolean shorthand.
 */

import { describe, expect, it } from 'vitest';

import type { ChatV9FlagDescriptor } from '../chatV9FeatureFlags';
import { groupChatV9Flags } from '../groupChatV9Flags';

function makeFlag(overrides: Partial<ChatV9FlagDescriptor> = {}): ChatV9FlagDescriptor {
  return {
    id: 'x',
    ticket: 'X1',
    block: 'voice',
    title: 'X',
    description: 'X',
    default: true,
    keys: { localStorage: 'ff.x', query: 'ff_x', env: 'VITE_X' },
    isEnabled: () => true,
    telemetry: [],
    testId: null,
    specDocs: [],
    ...overrides,
  } as ChatV9FlagDescriptor;
}

describe('groupChatV9Flags', () => {
  it('returns one group per block in first-seen registry order', () => {
    const all = [
      makeFlag({ id: 'voice-a', block: 'voice' }),
      makeFlag({ id: 'admin-a', block: 'admin' }),
      makeFlag({ id: 'voice-b', block: 'voice' }),
      makeFlag({ id: 'trust-a', block: 'trust' }),
    ];
    const groups = groupChatV9Flags(all, all);
    expect(groups.map((g) => g.block)).toEqual(['voice', 'admin', 'trust']);
  });

  it('excludes blocks with zero registered flags (never renders an empty section)', () => {
    const all = [makeFlag({ id: 'voice-a', block: 'voice' })];
    const groups = groupChatV9Flags(all, all);
    expect(groups.map((g) => g.block)).toEqual(['voice']);
    expect(groups.every((g) => g.totalFlags > 0)).toBe(true);
  });

  it('keeps `totalFlags` equal to the full-registry count even when the filter drops some', () => {
    const all = [
      makeFlag({ id: 'voice-a', block: 'voice' }),
      makeFlag({ id: 'voice-b', block: 'voice' }),
      makeFlag({ id: 'admin-a', block: 'admin' }),
    ];
    const filtered = [makeFlag({ id: 'voice-a', block: 'voice' })];
    const groups = groupChatV9Flags(filtered, all);
    const voice = groups.find((g) => g.block === 'voice')!;
    const admin = groups.find((g) => g.block === 'admin')!;
    expect(voice.totalFlags).toBe(2);
    expect(voice.visibleFlags.map((f) => f.id)).toEqual(['voice-a']);
    expect(admin.totalFlags).toBe(1);
    expect(admin.visibleFlags).toEqual([]);
  });

  it('sets hasMatches to false when the filter drops every flag in a block', () => {
    const all = [
      makeFlag({ id: 'voice-a', block: 'voice' }),
      makeFlag({ id: 'admin-a', block: 'admin' }),
    ];
    const filtered = [makeFlag({ id: 'admin-a', block: 'admin' })];
    const groups = groupChatV9Flags(filtered, all);
    const voice = groups.find((g) => g.block === 'voice')!;
    const admin = groups.find((g) => g.block === 'admin')!;
    expect(voice.hasMatches).toBe(false);
    expect(admin.hasMatches).toBe(true);
  });

  it('passes the same list twice = full unfiltered view', () => {
    const all = [
      makeFlag({ id: 'voice-a', block: 'voice' }),
      makeFlag({ id: 'admin-a', block: 'admin' }),
    ];
    const groups = groupChatV9Flags(all, all);
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.hasMatches)).toBe(true);
    expect(groups.every((g) => g.visibleFlags.length === g.totalFlags)).toBe(true);
  });

  it('preserves the within-group order from the visible input', () => {
    const all = [
      makeFlag({ id: 'voice-a', block: 'voice' }),
      makeFlag({ id: 'voice-b', block: 'voice' }),
      makeFlag({ id: 'voice-c', block: 'voice' }),
    ];
    // A filter could legally hand back a reordered subset — we echo
    // the caller's order rather than the registry's.
    const filtered = [
      makeFlag({ id: 'voice-c', block: 'voice' }),
      makeFlag({ id: 'voice-a', block: 'voice' }),
    ];
    const groups = groupChatV9Flags(filtered, all);
    expect(groups[0].visibleFlags.map((f) => f.id)).toEqual(['voice-c', 'voice-a']);
  });

  it('handles an empty visible list (filter dropped every flag)', () => {
    const all = [
      makeFlag({ id: 'voice-a', block: 'voice' }),
      makeFlag({ id: 'admin-a', block: 'admin' }),
    ];
    const groups = groupChatV9Flags([], all);
    expect(groups.map((g) => g.block)).toEqual(['voice', 'admin']);
    expect(groups.every((g) => g.visibleFlags.length === 0)).toBe(true);
    expect(groups.every((g) => g.hasMatches === false)).toBe(true);
  });
});
