/**
 * @vitest-environment node
 *
 * DEC-405b (ZLECENIE 1.1-J2, przejście właściciela 06.09) — the 6-chip
 * "Today" row in the Notebook sidebar was replaced by one dropdown with
 * counters. This tests the pure predicates behind both the old chips and
 * the new dropdown (`isRecentPage`/`isToReviewPage`/`isFreshPage`/
 * `matchesView` — extracted unchanged from `NotebookContent.tsx`, "nie
 * zmieniaj predykatów"). Real mutation coverage: each `if` branch in
 * `matchesView` is asserted individually, so deleting/short-circuiting any
 * one of them (e.g. "no filtering at all" collapsing everything to `true`)
 * turns the corresponding assertion RED.
 * [ODMROZENIE 07_MY_WORK_AGENT DEC-397]
 */
import { describe, expect, it } from 'vitest';

import type { NotebookPage } from '@/types/myWork';

import {
  isFreshPage,
  isRecentPage,
  isToReviewPage,
  matchesView,
} from '../notebookViewLensPredicates';

function page(overrides: Partial<NotebookPage>): NotebookPage {
  return {
    id: 'p1',
    title: 'Test',
    projectId: null,
    visibility: 'private',
    tags: [],
    contentJson: null,
    contentText: '',
    maturity: 'growing',
    icon: null,
    summary: null,
    status: 'active',
    pinned: false,
    convertedTo: null,
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as NotebookPage;
}

const NOW = new Date('2026-09-06T12:00:00.000Z').getTime();
const notOrphaned = () => false;
const isOrphanedByFlag = (p: NotebookPage) => p.id === 'orphan-1';

describe('isRecentPage', () => {
  it('is true within the last 7 days', () => {
    const updatedAt = new Date(NOW - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(isRecentPage(page({ updatedAt }), NOW)).toBe(true);
  });

  it('is false past 7 days', () => {
    const updatedAt = new Date(NOW - 8 * 24 * 60 * 60 * 1000).toISOString();
    expect(isRecentPage(page({ updatedAt }), NOW)).toBe(false);
  });

  it('is false with no updatedAt', () => {
    expect(isRecentPage(page({ updatedAt: undefined as unknown as string }), NOW)).toBe(false);
  });
});

describe('isToReviewPage', () => {
  it('is true when disputed', () => {
    expect(isToReviewPage(page({ verificationStatus: 'disputed' }))).toBe(true);
  });
  it('is true when stale', () => {
    expect(isToReviewPage(page({ staleAt: '2026-01-01T00:00:00.000Z' }))).toBe(true);
  });
  it('is true when still in inbox', () => {
    expect(isToReviewPage(page({ status: 'inbox' }))).toBe(true);
  });
  it('is false for a verified, non-stale, active page', () => {
    expect(
      isToReviewPage(page({ verificationStatus: 'verified', staleAt: undefined, status: 'active' }))
    ).toBe(false);
  });
});

describe('isFreshPage', () => {
  it('is true with a captureSource', () => {
    expect(isFreshPage(page({ captureSource: 'upload' }))).toBe(true);
  });
  it('is true with captureMetadata.captureSource', () => {
    expect(isFreshPage(page({ captureMetadata: { captureSource: 'email' } as any }))).toBe(true);
  });
  it('is false with neither', () => {
    expect(isFreshPage(page({}))).toBe(false);
  });
});

describe('matchesView', () => {
  it('"all" matches every page regardless of state', () => {
    expect(matchesView(page({ pinned: false, status: 'archived' }), 'all', notOrphaned)).toBe(
      true
    );
  });

  it('"pinned" matches only pinned pages', () => {
    expect(matchesView(page({ pinned: true }), 'pinned', notOrphaned)).toBe(true);
    expect(matchesView(page({ pinned: false }), 'pinned', notOrphaned)).toBe(false);
  });

  it('"recent" delegates to isRecentPage', () => {
    const recent = page({ updatedAt: new Date().toISOString() });
    const stale = page({ updatedAt: '2020-01-01T00:00:00.000Z' });
    expect(matchesView(recent, 'recent', notOrphaned)).toBe(true);
    expect(matchesView(stale, 'recent', notOrphaned)).toBe(false);
  });

  it('"toReview" delegates to isToReviewPage', () => {
    expect(matchesView(page({ status: 'inbox' }), 'toReview', notOrphaned)).toBe(true);
    expect(matchesView(page({ status: 'active' }), 'toReview', notOrphaned)).toBe(false);
  });

  it('"fresh" delegates to isFreshPage', () => {
    expect(matchesView(page({ captureSource: 'file' }), 'fresh', notOrphaned)).toBe(true);
    expect(matchesView(page({}), 'fresh', notOrphaned)).toBe(false);
  });

  it('"orphaned" delegates to the injected isOrphaned callback', () => {
    expect(matchesView(page({ id: 'orphan-1' }), 'orphaned', isOrphanedByFlag)).toBe(true);
    expect(matchesView(page({ id: 'not-orphan' }), 'orphaned', isOrphanedByFlag)).toBe(false);
  });

  it('narrows a mixed set down to only the pages matching the active lens', () => {
    const pages = [
      page({ id: '1', pinned: true }),
      page({ id: '2', pinned: false, status: 'inbox' }),
      page({ id: '3', pinned: false, status: 'active' }),
    ];
    const pinnedOnly = pages.filter((p) => matchesView(p, 'pinned', notOrphaned));
    expect(pinnedOnly.map((p) => p.id)).toEqual(['1']);

    const toReviewOnly = pages.filter((p) => matchesView(p, 'toReview', notOrphaned));
    expect(toReviewOnly.map((p) => p.id)).toEqual(['2']);
  });
});
