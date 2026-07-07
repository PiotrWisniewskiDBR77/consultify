/**
 * Deck Comments service tests (M19 Presentations, wzór Word Epic E6).
 *
 * Covers the reviewer-thread data plane, DB-free (the Postgres DAO is a
 * best-effort fire-and-forget write-through that swallows errors, so the
 * in-memory logic is exercised without a live DB — DbPromise is mocked to
 * a no-op so the fire-and-forget writes don't log):
 *   - create root (deck- and slide-anchored) + reply thread inheritance,
 *   - reply-to-reply guard,
 *   - resolve / reopen apply thread-wide,
 *   - author-only soft-delete keeps the row with empty body + deletedAt,
 *   - tenant safety: cross-tenant reads return [] and writes throw,
 *   - thread grouping + per-slide counts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: vi.fn(async () => []),
  run: vi.fn(async () => ({ success: true })),
  get: vi.fn(async () => null),
}));
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  __resetDeckCommentsForTests,
  createDeckComment,
  DeckCommentError,
  deleteDeckComment,
  getDeckCommentCounts,
  listDeckCommentThreads,
  replyToDeckComment,
  setDeckCommentResolved,
} from '../../../server/src/services/deckCommentsService.js';

const ORG = 'org-deck-cmt';
const ORG_OTHER = 'org-deck-cmt-other';
const DECK = 'deck-cmt-1';
const USER = 'user-cmt-1';
const REVIEWER = 'reviewer-cmt-1';

beforeEach(() => __resetDeckCommentsForTests());
afterEach(() => __resetDeckCommentsForTests());

describe('createDeckComment', () => {
  it('seeds threadId === id, unresolved, deck-anchored by default', () => {
    const c = createDeckComment({ organizationId: ORG, deckId: DECK, author: USER, body: 'hi' });
    expect(c.threadId).toBe(c.id);
    expect(c.resolved).toBe(false);
    expect(c.anchor).toEqual({ kind: 'deck' });
    expect(c.slideId).toBeNull();
  });

  it('anchors to a slide when slideId given', () => {
    const c = createDeckComment({
      organizationId: ORG,
      deckId: DECK,
      author: USER,
      body: 'on slide 2',
      slideId: 'slide-2',
    });
    expect(c.anchor).toEqual({ kind: 'slide', slideId: 'slide-2' });
    expect(c.slideId).toBe('slide-2');
  });

  it('rejects empty body', () => {
    expect(() =>
      createDeckComment({ organizationId: ORG, deckId: DECK, author: USER, body: '   ' })
    ).toThrow(DeckCommentError);
  });
});

describe('replyToDeckComment', () => {
  it('inherits threadId + slide anchor from the root and forbids reply-to-reply', () => {
    const root = createDeckComment({
      organizationId: ORG,
      deckId: DECK,
      author: USER,
      body: 'root',
      slideId: 'slide-1',
    });
    const reply = replyToDeckComment({
      organizationId: ORG,
      deckId: DECK,
      author: REVIEWER,
      parentCommentId: root.id,
      body: 'reply',
    });
    expect(reply.threadId).toBe(root.threadId);
    expect(reply.parentCommentId).toBe(root.id);
    expect(reply.anchor).toEqual({ kind: 'slide', slideId: 'slide-1' });

    expect(() =>
      replyToDeckComment({
        organizationId: ORG,
        deckId: DECK,
        author: USER,
        parentCommentId: reply.id,
        body: 'nested',
      })
    ).toThrow(/root of a thread/i);
  });
});

describe('resolve / reopen', () => {
  it('applies thread-wide and toggles counts', () => {
    const root = createDeckComment({
      organizationId: ORG,
      deckId: DECK,
      author: USER,
      body: 'root',
      slideId: 'slide-3',
    });
    replyToDeckComment({
      organizationId: ORG,
      deckId: DECK,
      author: REVIEWER,
      parentCommentId: root.id,
      body: 'reply',
    });

    const resolved = setDeckCommentResolved({
      organizationId: ORG,
      deckId: DECK,
      userId: REVIEWER,
      commentId: root.id,
      resolved: true,
    });
    expect(resolved.resolved).toBe(true);
    expect(resolved.resolvedBy).toBe(REVIEWER);

    let counts = getDeckCommentCounts(DECK, ORG);
    expect(counts.totalResolved).toBe(1);
    expect(counts.totalOpen).toBe(0);
    expect(counts.perSlide['slide-3']).toEqual({ open: 0, resolved: 1 });

    const reopened = setDeckCommentResolved({
      organizationId: ORG,
      deckId: DECK,
      userId: USER,
      commentId: root.id,
      resolved: false,
    });
    expect(reopened.resolved).toBe(false);
    expect(reopened.reopenedBy).toBe(USER);

    counts = getDeckCommentCounts(DECK, ORG);
    expect(counts.totalOpen).toBe(1);
    expect(counts.totalResolved).toBe(0);
  });
});

describe('deleteDeckComment', () => {
  it('is author-only and keeps the row as a soft-delete', () => {
    const c = createDeckComment({ organizationId: ORG, deckId: DECK, author: USER, body: 'mine' });
    expect(() =>
      deleteDeckComment({ organizationId: ORG, deckId: DECK, userId: REVIEWER, commentId: c.id })
    ).toThrow(/author/i);

    const deleted = deleteDeckComment({
      organizationId: ORG,
      deckId: DECK,
      userId: USER,
      commentId: c.id,
    });
    expect(deleted.deletedAt).toBeTruthy();
    expect(deleted.body).toBe('');
    // Soft-deleted root with no replies drops out of the default thread view.
    expect(listDeckCommentThreads(DECK, ORG)).toHaveLength(0);
  });
});

describe('tenant safety', () => {
  it('cross-tenant reads return [] and writes throw unknown_comment', () => {
    const c = createDeckComment({ organizationId: ORG, deckId: DECK, author: USER, body: 'hi' });
    expect(listDeckCommentThreads(DECK, ORG_OTHER)).toHaveLength(0);
    expect(() =>
      setDeckCommentResolved({
        organizationId: ORG_OTHER,
        deckId: DECK,
        userId: USER,
        commentId: c.id,
        resolved: true,
      })
    ).toThrow(DeckCommentError);
  });
});

describe('listDeckCommentThreads', () => {
  it('groups by thread, filters by slide, most-recent first', () => {
    const a = createDeckComment({
      organizationId: ORG,
      deckId: DECK,
      author: USER,
      body: 'A',
      slideId: 'slide-1',
    });
    createDeckComment({ organizationId: ORG, deckId: DECK, author: USER, body: 'B', slideId: 'slide-2' });
    replyToDeckComment({
      organizationId: ORG,
      deckId: DECK,
      author: REVIEWER,
      parentCommentId: a.id,
      body: 'reply on A',
    });

    const all = listDeckCommentThreads(DECK, ORG);
    expect(all).toHaveLength(2);
    // Thread A bumped by its reply → floats to the top.
    expect(all[0].root.id).toBe(a.id);
    expect(all[0].replies).toHaveLength(1);

    const slide2 = listDeckCommentThreads(DECK, ORG, { slideId: 'slide-2' });
    expect(slide2).toHaveLength(1);
    expect(slide2[0].root.body).toBe('B');
  });
});
