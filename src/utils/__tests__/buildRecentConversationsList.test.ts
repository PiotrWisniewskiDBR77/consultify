/**
 * Chat V9 / NAV-M3-lite — unit tests for
 * `buildRecentConversationsList`.
 *
 * We pin the filtering / sorting / truncation contract so the
 * popover never surprises the user with archived threads, the
 * active conversation, or silently-dropped rows. Every test
 * passes literal shapes (no Zustand hydration) so the builder
 * stays a pure function.
 */

import { describe, expect, it } from 'vitest';

import {
  buildRecentConversationsList,
  countEligibleRecentConversations,
  DEFAULT_MAX_RECENT_CONVERSATIONS,
  RECENT_CONVERSATION_TITLE_MAX,
} from '../buildRecentConversationsList';

describe('buildRecentConversationsList', () => {
  it('returns [] for a null / undefined / non-array input', () => {
    expect(
      buildRecentConversationsList({
        conversations: null,
        activeConversationId: null,
      })
    ).toEqual([]);
    expect(
      buildRecentConversationsList({
        conversations: undefined,
        activeConversationId: null,
      })
    ).toEqual([]);
    expect(
      buildRecentConversationsList({
        // @ts-expect-error - deliberate runtime misuse
        conversations: { not: 'an array' },
        activeConversationId: null,
      })
    ).toEqual([]);
  });

  it('returns [] for an empty array', () => {
    expect(
      buildRecentConversationsList({
        conversations: [],
        activeConversationId: null,
      })
    ).toEqual([]);
  });

  it('returns [] when maxItems is 0 or negative', () => {
    const conversations = [{ id: 'a', title: 'A', lastMessageAt: '2026-04-18T10:00:00Z' }];
    expect(
      buildRecentConversationsList({
        conversations,
        activeConversationId: null,
        maxItems: 0,
      })
    ).toEqual([]);
    expect(
      buildRecentConversationsList({
        conversations,
        activeConversationId: null,
        maxItems: -3,
      })
    ).toEqual([]);
  });

  it('filters out the currently active conversation', () => {
    const result = buildRecentConversationsList({
      conversations: [
        { id: 'active', title: 'me', lastMessageAt: '2026-04-18T10:00:00Z' },
        { id: 'b', title: 'sibling', lastMessageAt: '2026-04-18T09:00:00Z' },
      ],
      activeConversationId: 'active',
    });

    expect(result.map((e) => e.id)).toEqual(['b']);
  });

  it('filters out archived conversations', () => {
    const result = buildRecentConversationsList({
      conversations: [
        {
          id: 'a',
          title: 'archived',
          archived: true,
          lastMessageAt: '2026-04-18T10:00:00Z',
        },
        { id: 'b', title: 'alive', lastMessageAt: '2026-04-18T09:00:00Z' },
      ],
      activeConversationId: null,
    });

    expect(result.map((e) => e.id)).toEqual(['b']);
  });

  it('filters out soft-deleted conversations', () => {
    const result = buildRecentConversationsList({
      conversations: [
        {
          id: 'a',
          title: 'gone',
          deletedAt: '2026-04-18T11:00:00Z',
          lastMessageAt: '2026-04-18T10:00:00Z',
        },
        { id: 'b', title: 'here', lastMessageAt: '2026-04-18T09:00:00Z' },
      ],
      activeConversationId: null,
    });

    expect(result.map((e) => e.id)).toEqual(['b']);
  });

  it('treats empty-string / whitespace-only deletedAt as not-deleted', () => {
    const result = buildRecentConversationsList({
      conversations: [
        { id: 'a', title: 'here', deletedAt: '', lastMessageAt: '2026-04-18T10:00:00Z' },
        {
          id: 'b',
          title: 'also here',
          deletedAt: '   ',
          lastMessageAt: '2026-04-18T09:00:00Z',
        },
      ],
      activeConversationId: null,
    });

    expect(result.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('filters out rows with blank / whitespace-only title', () => {
    const result = buildRecentConversationsList({
      conversations: [
        { id: 'a', title: '', lastMessageAt: '2026-04-18T10:00:00Z' },
        { id: 'b', title: '   ', lastMessageAt: '2026-04-18T09:30:00Z' },
        { id: 'c', title: 'real', lastMessageAt: '2026-04-18T09:00:00Z' },
      ],
      activeConversationId: null,
    });

    expect(result.map((e) => e.id)).toEqual(['c']);
  });

  it('sorts newest first by lastMessageAt', () => {
    const result = buildRecentConversationsList({
      conversations: [
        { id: 'old', title: 'old', lastMessageAt: '2026-04-18T09:00:00Z' },
        { id: 'new', title: 'new', lastMessageAt: '2026-04-18T11:00:00Z' },
        { id: 'mid', title: 'mid', lastMessageAt: '2026-04-18T10:00:00Z' },
      ],
      activeConversationId: null,
    });

    expect(result.map((e) => e.id)).toEqual(['new', 'mid', 'old']);
  });

  it('falls back to updatedAt when lastMessageAt is missing / unparseable', () => {
    const result = buildRecentConversationsList({
      conversations: [
        { id: 'a', title: 'a', updatedAt: '2026-04-18T08:00:00Z' },
        { id: 'b', title: 'b', updatedAt: '2026-04-18T09:00:00Z' },
        {
          id: 'c',
          title: 'c',
          lastMessageAt: 'not-a-date',
          updatedAt: '2026-04-18T10:00:00Z',
        },
      ],
      activeConversationId: null,
    });

    expect(result.map((e) => e.id)).toEqual(['c', 'b', 'a']);
  });

  it('breaks ties deterministically by id', () => {
    const sameTs = '2026-04-18T10:00:00Z';
    const result = buildRecentConversationsList({
      conversations: [
        { id: 'zzz', title: 'z', lastMessageAt: sameTs },
        { id: 'aaa', title: 'a', lastMessageAt: sameTs },
        { id: 'mmm', title: 'm', lastMessageAt: sameTs },
      ],
      activeConversationId: null,
    });

    expect(result.map((e) => e.id)).toEqual(['aaa', 'mmm', 'zzz']);
  });

  it('caps the output at DEFAULT_MAX_RECENT_CONVERSATIONS', () => {
    const convs = Array.from({ length: DEFAULT_MAX_RECENT_CONVERSATIONS + 3 }, (_, i) => ({
      id: `id-${i}`,
      title: `Conversation ${i}`,
      lastMessageAt: new Date(2026, 3, 18, 10, 0, i).toISOString(),
    }));

    const result = buildRecentConversationsList({
      conversations: convs,
      activeConversationId: null,
    });

    expect(result).toHaveLength(DEFAULT_MAX_RECENT_CONVERSATIONS);
  });

  it('honours an explicit maxItems override (floored to int)', () => {
    const convs = Array.from({ length: 10 }, (_, i) => ({
      id: `id-${i}`,
      title: `C ${i}`,
      lastMessageAt: new Date(2026, 3, 18, 10, 0, i).toISOString(),
    }));

    const result = buildRecentConversationsList({
      conversations: convs,
      activeConversationId: null,
      maxItems: 3.9,
    });

    expect(result).toHaveLength(3);
  });

  it('truncates titles above RECENT_CONVERSATION_TITLE_MAX and flags them', () => {
    const longTitle = 'A'.repeat(RECENT_CONVERSATION_TITLE_MAX + 10);
    const result = buildRecentConversationsList({
      conversations: [{ id: 'a', title: longTitle, lastMessageAt: '2026-04-18T10:00:00Z' }],
      activeConversationId: null,
    });

    expect(result).toHaveLength(1);
    expect(result[0].truncated).toBe(true);
    expect(result[0].fullTitle).toBe(longTitle);
    expect(result[0].label.length).toBe(RECENT_CONVERSATION_TITLE_MAX);
    expect(result[0].label.endsWith('…')).toBe(true);
  });

  it('does not truncate a title at exactly the cap', () => {
    const justRight = 'B'.repeat(RECENT_CONVERSATION_TITLE_MAX);
    const result = buildRecentConversationsList({
      conversations: [{ id: 'a', title: justRight, lastMessageAt: '2026-04-18T10:00:00Z' }],
      activeConversationId: null,
    });

    expect(result).toHaveLength(1);
    expect(result[0].truncated).toBe(false);
    expect(result[0].label).toBe(justRight);
  });

  it('defensively skips null / non-object / no-id rows', () => {
    const result = buildRecentConversationsList({
      conversations: [
        null,
        undefined,
        // @ts-expect-error - deliberate runtime misuse
        42,
        { title: 'no id here', lastMessageAt: '2026-04-18T10:00:00Z' },
        { id: 42 as unknown as string, title: 'numeric id' },
        { id: 'good', title: 'real', lastMessageAt: '2026-04-18T09:00:00Z' },
      ],
      activeConversationId: null,
    });

    expect(result.map((e) => e.id)).toEqual(['good']);
  });

  it('accepts Date and number lastMessageAt values', () => {
    const result = buildRecentConversationsList({
      conversations: [
        { id: 'd', title: 'date', lastMessageAt: new Date('2026-04-18T11:00:00Z') },
        { id: 'n', title: 'number', lastMessageAt: Date.parse('2026-04-18T10:00:00Z') },
      ],
      activeConversationId: null,
    });

    expect(result.map((e) => e.id)).toEqual(['d', 'n']);
  });

  it('never contains the active conversation or blank-title rows in any scenario', () => {
    const conversations = [
      { id: 'active', title: 'me', lastMessageAt: '2026-04-18T10:00:00Z' },
      { id: 'blank', title: '', lastMessageAt: '2026-04-18T10:00:00Z' },
      { id: 'other', title: 'sibling', lastMessageAt: '2026-04-18T09:00:00Z' },
    ];

    const result = buildRecentConversationsList({
      conversations,
      activeConversationId: 'active',
    });

    expect(result.every((e) => e.id !== 'active')).toBe(true);
    expect(result.every((e) => e.fullTitle.trim().length > 0)).toBe(true);
  });

  // ---------------------------------------------------------------
  // NAV-M3-lite+ · pinned conversations first
  // ---------------------------------------------------------------
  describe('NAV-M3-lite+ pinned ordering', () => {
    const conversations = [
      { id: 'n1', title: 'newest-unpinned', lastMessageAt: '2026-04-18T12:00:00Z' },
      {
        id: 'p1',
        title: 'oldest-pinned',
        starred: true,
        lastMessageAt: '2026-04-18T08:00:00Z',
      },
      { id: 'n2', title: 'mid-unpinned', lastMessageAt: '2026-04-18T11:00:00Z' },
      {
        id: 'p2',
        title: 'recent-pinned',
        isPinned: true,
        lastMessageAt: '2026-04-18T09:00:00Z',
      },
    ];

    it('every entry has pinned=false when pinnedEnabled is false (v1 shape)', () => {
      const result = buildRecentConversationsList({
        conversations,
        activeConversationId: null,
        pinnedEnabled: false,
      });

      expect(result.map((e) => e.id)).toEqual(['n1', 'n2', 'p2', 'p1']);
      expect(result.every((e) => e.pinned === false)).toBe(true);
    });

    it('bubbles pinned entries to the top when pinnedEnabled is true', () => {
      const result = buildRecentConversationsList({
        conversations,
        activeConversationId: null,
        pinnedEnabled: true,
      });

      expect(result.map((e) => e.id)).toEqual(['p2', 'p1', 'n1', 'n2']);
    });

    it('preserves newest-first inside the pinned and non-pinned sub-groups', () => {
      const result = buildRecentConversationsList({
        conversations,
        activeConversationId: null,
        pinnedEnabled: true,
      });

      const pinned = result.filter((e) => e.pinned).map((e) => e.id);
      const unpinned = result.filter((e) => !e.pinned).map((e) => e.id);

      expect(pinned).toEqual(['p2', 'p1']);
      expect(unpinned).toEqual(['n1', 'n2']);
    });

    it('treats `starred` and `isPinned` interchangeably (true wins)', () => {
      const result = buildRecentConversationsList({
        conversations: [
          {
            id: 'a',
            title: 'starred',
            starred: true,
            lastMessageAt: '2026-04-18T10:00:00Z',
          },
          {
            id: 'b',
            title: 'ispinned',
            isPinned: true,
            lastMessageAt: '2026-04-18T09:00:00Z',
          },
        ],
        activeConversationId: null,
        pinnedEnabled: true,
      });

      expect(result.every((e) => e.pinned)).toBe(true);
    });

    it('ignores truthy-but-not-strictly-true values (defensive contract)', () => {
      const result = buildRecentConversationsList({
        conversations: [
          {
            id: 'loose1',
            title: 'one',
            starred: 1 as unknown as boolean,
            lastMessageAt: '2026-04-18T10:00:00Z',
          },
          {
            id: 'loose2',
            title: 'two',
            isPinned: 'yes' as unknown as boolean,
            lastMessageAt: '2026-04-18T09:00:00Z',
          },
        ],
        activeConversationId: null,
        pinnedEnabled: true,
      });

      expect(result.every((e) => e.pinned === false)).toBe(true);
    });

    it('keeps the global cap even when pins exceed maxItems (pinned win slots)', () => {
      const pins = Array.from({ length: 7 }, (_, i) => ({
        id: `p-${i}`,
        title: `Pin ${i}`,
        starred: true,
        lastMessageAt: new Date(2026, 3, 18, 10, 0, i).toISOString(),
      }));
      const regulars = Array.from({ length: 3 }, (_, i) => ({
        id: `r-${i}`,
        title: `Recent ${i}`,
        lastMessageAt: new Date(2026, 3, 18, 11, 0, i).toISOString(),
      }));

      const result = buildRecentConversationsList({
        conversations: [...regulars, ...pins],
        activeConversationId: null,
        pinnedEnabled: true,
      });

      expect(result).toHaveLength(DEFAULT_MAX_RECENT_CONVERSATIONS);
      expect(result.every((e) => e.pinned)).toBe(true);
    });

    it('leaves room for recents when pins are below the cap', () => {
      const conversations2 = [
        {
          id: 'pin-a',
          title: 'Pin A',
          starred: true,
          lastMessageAt: '2026-04-18T09:00:00Z',
        },
        {
          id: 'pin-b',
          title: 'Pin B',
          isPinned: true,
          lastMessageAt: '2026-04-18T08:00:00Z',
        },
        { id: 'r1', title: 'R 1', lastMessageAt: '2026-04-18T12:00:00Z' },
        { id: 'r2', title: 'R 2', lastMessageAt: '2026-04-18T11:00:00Z' },
        { id: 'r3', title: 'R 3', lastMessageAt: '2026-04-18T10:00:00Z' },
        { id: 'r4', title: 'R 4', lastMessageAt: '2026-04-18T07:00:00Z' },
      ];

      const result = buildRecentConversationsList({
        conversations: conversations2,
        activeConversationId: null,
        pinnedEnabled: true,
      });

      expect(result.map((e) => e.id)).toEqual(['pin-a', 'pin-b', 'r1', 'r2', 'r3']);
      expect(result.slice(0, 2).every((e) => e.pinned)).toBe(true);
      expect(result.slice(2).every((e) => !e.pinned)).toBe(true);
    });

    it('still filters out the active pinned conversation', () => {
      const result = buildRecentConversationsList({
        conversations: [
          {
            id: 'active',
            title: 'me',
            starred: true,
            lastMessageAt: '2026-04-18T10:00:00Z',
          },
          { id: 'other', title: 'sib', lastMessageAt: '2026-04-18T09:00:00Z' },
        ],
        activeConversationId: 'active',
        pinnedEnabled: true,
      });

      expect(result.map((e) => e.id)).toEqual(['other']);
    });
  });
});

// -----------------------------------------------------------
// NAV-M3-lite++ · countEligibleRecentConversations
// -----------------------------------------------------------
describe('countEligibleRecentConversations', () => {
  it('returns 0 for null / undefined / non-array input', () => {
    expect(
      countEligibleRecentConversations({
        conversations: null,
        activeConversationId: null,
      })
    ).toBe(0);
    expect(
      countEligibleRecentConversations({
        conversations: undefined,
        activeConversationId: null,
      })
    ).toBe(0);
    expect(
      countEligibleRecentConversations({
        // @ts-expect-error - deliberate runtime misuse
        conversations: { not: 'an array' },
        activeConversationId: null,
      })
    ).toBe(0);
  });

  it('returns 0 for an empty array', () => {
    expect(
      countEligibleRecentConversations({
        conversations: [],
        activeConversationId: null,
      })
    ).toBe(0);
  });

  it('counts only eligible rows (filters active / archived / deleted / blank)', () => {
    const result = countEligibleRecentConversations({
      conversations: [
        { id: 'active', title: 'me', lastMessageAt: '2026-04-18T10:00:00Z' },
        {
          id: 'arch',
          title: 'archived',
          archived: true,
          lastMessageAt: '2026-04-18T10:00:00Z',
        },
        {
          id: 'del',
          title: 'deleted',
          deletedAt: '2026-04-18T11:00:00Z',
          lastMessageAt: '2026-04-18T10:00:00Z',
        },
        { id: 'blank', title: '   ', lastMessageAt: '2026-04-18T10:00:00Z' },
        { id: 'ok-1', title: 'A', lastMessageAt: '2026-04-18T09:00:00Z' },
        { id: 'ok-2', title: 'B', lastMessageAt: '2026-04-18T08:00:00Z' },
      ],
      activeConversationId: 'active',
    });

    expect(result).toBe(2);
  });

  it('is not capped — returns the full eligible count even when >= 100', () => {
    const conversations = Array.from({ length: 120 }, (_, i) => ({
      id: `id-${i}`,
      title: `Conversation ${i}`,
      lastMessageAt: new Date(2026, 3, 18, 10, 0, i).toISOString(),
    }));

    expect(
      countEligibleRecentConversations({
        conversations,
        activeConversationId: null,
      })
    ).toBe(120);
  });

  it('agrees with buildRecentConversationsList on what is "eligible"', () => {
    const conversations = [
      { id: 'a', title: 'A', lastMessageAt: '2026-04-18T10:00:00Z' },
      {
        id: 'b',
        title: 'archived',
        archived: true,
        lastMessageAt: '2026-04-18T09:00:00Z',
      },
      { id: 'c', title: 'C', lastMessageAt: '2026-04-18T08:00:00Z' },
      { id: 'd', title: '', lastMessageAt: '2026-04-18T07:00:00Z' },
    ];

    // The cap-free count must equal the cap-free list we get
    // from `buildRecentConversationsList` when `maxItems` is
    // raised above all rows.
    const list = buildRecentConversationsList({
      conversations,
      activeConversationId: null,
      maxItems: 999,
    });

    expect(
      countEligibleRecentConversations({
        conversations,
        activeConversationId: null,
      })
    ).toBe(list.length);
  });

  it('treats a non-string activeConversationId as no-active-filter', () => {
    // Same behaviour as `buildRecentConversationsList`.
    expect(
      countEligibleRecentConversations({
        conversations: [{ id: 'a', title: 'A', lastMessageAt: '2026-04-18T10:00:00Z' }],
        // @ts-expect-error - deliberate runtime misuse
        activeConversationId: 42,
      })
    ).toBe(1);
  });

  it('skips null / undefined / non-object rows defensively', () => {
    const result = countEligibleRecentConversations({
      conversations: [
        null,
        undefined,
        // @ts-expect-error - deliberate runtime misuse
        42,
        { id: 'real', title: 'R', lastMessageAt: '2026-04-18T10:00:00Z' },
      ],
      activeConversationId: null,
    });

    expect(result).toBe(1);
  });
});
