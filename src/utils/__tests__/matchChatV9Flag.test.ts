/**
 * Chat V9 / ADMIN AG1 v1.5 — unit tests for the admin flag filter
 * predicate.
 *
 * These tests anchor the filter's observable contract:
 *
 *   - Empty / whitespace query matches every flag.
 *   - Matching is case-insensitive across every searchable field.
 *   - Multi-token queries are AND-joined (order-independent).
 *   - The description is NOT part of the haystack (tests pin the
 *     exact fields included).
 *
 * Keeping these independent of the registry means any future
 * descriptor shape change surfaces as a clean type error here
 * rather than silent filter misses in the panel.
 */

import { describe, expect, it } from 'vitest';

import type { ChatV9FlagDescriptor } from '../chatV9FeatureFlags';
import { buildChatV9FlagHaystack, matchChatV9Flag } from '../matchChatV9Flag';

function makeFlag(overrides: Partial<ChatV9FlagDescriptor> = {}): ChatV9FlagDescriptor {
  return {
    id: 'trust-badge',
    ticket: 'T-TR1',
    block: 'trust',
    title: 'Trust badge',
    description:
      'Renders a "Sources + model" pill next to each assistant message so users can audit the reply without opening a side panel.',
    default: true,
    keys: {
      localStorage: 'ff.trust_badge',
      query: 'ff_trustBadge',
      env: 'VITE_TRUST_BADGE',
    },
    isEnabled: () => true,
    telemetry: [],
    testId: 'trust-badge',
    specDocs: [],
    ...overrides,
  } as ChatV9FlagDescriptor;
}

describe('buildChatV9FlagHaystack', () => {
  it('joins title, ticket, block, id and localStorage key (lowercased)', () => {
    const flag = makeFlag();
    const haystack = buildChatV9FlagHaystack(flag);
    expect(haystack).toContain('trust badge');
    expect(haystack).toContain('t-tr1');
    expect(haystack).toContain('trust');
    expect(haystack).toContain('trust-badge');
    expect(haystack).toContain('ff.trust_badge');
  });

  it('does NOT include description (prevents noisy matches)', () => {
    const flag = makeFlag({ description: 'uniqueneedlestring' });
    expect(buildChatV9FlagHaystack(flag)).not.toContain('uniqueneedlestring');
  });
});

describe('matchChatV9Flag', () => {
  it('matches every flag for empty query', () => {
    expect(matchChatV9Flag(makeFlag(), '')).toBe(true);
  });

  it('matches every flag for whitespace-only query', () => {
    expect(matchChatV9Flag(makeFlag(), '   \t\n  ')).toBe(true);
  });

  it('is case-insensitive', () => {
    const flag = makeFlag({ title: 'Voice Mode Legend' });
    expect(matchChatV9Flag(flag, 'voice')).toBe(true);
    expect(matchChatV9Flag(flag, 'VOICE')).toBe(true);
    expect(matchChatV9Flag(flag, 'VoIcE')).toBe(true);
  });

  it('matches by ticket', () => {
    expect(matchChatV9Flag(makeFlag({ ticket: 'VM3.1' }), 'vm3.1')).toBe(true);
    expect(matchChatV9Flag(makeFlag({ ticket: 'T-TR1' }), 't-tr1')).toBe(true);
  });

  it('matches by block', () => {
    expect(matchChatV9Flag(makeFlag({ block: 'admin' }), 'admin')).toBe(true);
  });

  it('matches by id', () => {
    expect(matchChatV9Flag(makeFlag({ id: 'back-to-chat-button' }), 'back')).toBe(true);
  });

  it('matches by localStorage key', () => {
    expect(
      matchChatV9Flag(
        makeFlag({ keys: { localStorage: 'ff.trust_badge', query: 'q', env: 'E' } }),
        'ff.trust_badge'
      )
    ).toBe(true);
  });

  it('returns false when no field contains the query', () => {
    expect(matchChatV9Flag(makeFlag(), 'definitelynotpresent')).toBe(false);
  });

  it('AND-joins multiple tokens (all must match, order irrelevant)', () => {
    const flag = makeFlag({ title: 'Voice mode legend', block: 'voice', ticket: 'VM3' });
    expect(matchChatV9Flag(flag, 'voice legend')).toBe(true);
    expect(matchChatV9Flag(flag, 'legend voice')).toBe(true);
    expect(matchChatV9Flag(flag, 'voice admin')).toBe(false);
  });

  it('does not match when query contains a token absent from every field', () => {
    const flag = makeFlag({ title: 'Trust badge', block: 'trust', ticket: 'T-TR1' });
    expect(matchChatV9Flag(flag, 'trust missing')).toBe(false);
  });

  it('ignores surrounding whitespace', () => {
    expect(matchChatV9Flag(makeFlag({ title: 'Trust badge' }), '  trust  ')).toBe(true);
  });
});
