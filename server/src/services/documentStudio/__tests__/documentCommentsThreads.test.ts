/**
 * Document Studio — Comment thread aggregation tests
 * (Epic E6, Slice 6.2).
 *
 * Covers the read-side surface that powers the reviewer rail:
 *   - listDocumentCommentThreads groups comments by threadId,
 *     mirrors the root's status / anchor on the thread row, and
 *     sorts most-recent-activity-first.
 *   - Soft-deleted root with replies: thread stays visible.
 *   - Soft-deleted root without replies: thread hidden by default
 *     (orphaned-deleted), opt-in via hideOrphanedDeleted: false.
 *   - Filters compose: status / anchorKind / sectionId / blockId.
 *   - getDocumentCommentSectionCounts returns top-level totals +
 *     per-section + per-block buckets; document-anchored threads
 *     count toward totals only.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  __resetDocumentCommentsForTests,
  createDocumentComment,
  deleteDocumentComment,
  getDocumentCommentSectionCounts,
  listDocumentCommentThreads,
  replyToDocumentComment,
  resolveDocumentComment,
} from '../documentCommentsService.js';

const ORG = 'org-thr';
const ORG_OTHER = 'org-thr-other';
const ARTIFACT = 'artifact-thr-1';
const USER = 'user-thr-1';
const REVIEWER = 'reviewer-thr-1';

function sleepTickIfNeeded(): Promise<void> {
  // The service stamps timestamps from `new Date().toISOString()`,
  // which has 1-millisecond granularity. Tests that rely on
  // updatedAt-desc ordering across rapid mutations need a tick.
  return new Promise((resolve) => setTimeout(resolve, 2));
}

beforeEach(() => {
  __resetDocumentCommentsForTests();
});

afterEach(() => {
  __resetDocumentCommentsForTests();
});

describe('listDocumentCommentThreads — basic shape', () => {
  it('returns one thread per threadId with the root + replies in order', () => {
    const root = createDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: USER,
      body: 'root',
      anchor: { kind: 'section', sectionId: 'sec-1' },
    });
    const r1 = replyToDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: REVIEWER,
      parentCommentId: root.commentId,
      body: 'reply 1',
    });
    const r2 = replyToDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: USER,
      parentCommentId: root.commentId,
      body: 'reply 2',
    });
    const threads = listDocumentCommentThreads(ARTIFACT, ORG);
    expect(threads).toHaveLength(1);
    expect(threads[0]!.root.commentId).toBe(root.commentId);
    expect(threads[0]!.replies.map((c) => c.commentId)).toEqual([r1.commentId, r2.commentId]);
    expect(threads[0]!.anchor).toEqual(root.anchor);
    expect(threads[0]!.status).toBe('open');
  });

  it('thread.status mirrors the root after thread-wide resolution', () => {
    const root = createDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: USER,
      body: 'r',
      anchor: { kind: 'document' },
    });
    replyToDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: REVIEWER,
      parentCommentId: root.commentId,
      body: 'reply',
    });
    resolveDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      userId: REVIEWER,
      commentId: root.commentId,
    });
    const threads = listDocumentCommentThreads(ARTIFACT, ORG);
    expect(threads[0]!.status).toBe('resolved');
  });

  it('sorts threads most-recent-activity first', async () => {
    const a = createDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: USER,
      body: 'A root (older)',
      anchor: { kind: 'document' },
    });
    await sleepTickIfNeeded();
    const b = createDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: USER,
      body: 'B root',
      anchor: { kind: 'document' },
    });
    await sleepTickIfNeeded();
    // Reply to A — bumps A.updatedAt → A should now sort first.
    replyToDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: REVIEWER,
      parentCommentId: a.commentId,
      body: 'reactivating A',
    });
    const threads = listDocumentCommentThreads(ARTIFACT, ORG);
    expect(threads.map((t) => t.threadId)).toEqual([a.threadId, b.threadId]);
  });
});

describe('listDocumentCommentThreads — orphaned soft-deleted', () => {
  it('hides threads where the root is deleted and there are no replies (default)', () => {
    const root = createDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: USER,
      body: 'doomed',
      anchor: { kind: 'document' },
    });
    deleteDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      userId: USER,
      commentId: root.commentId,
    });
    expect(listDocumentCommentThreads(ARTIFACT, ORG)).toHaveLength(0);
    expect(
      listDocumentCommentThreads(ARTIFACT, ORG, { hideOrphanedDeleted: false })
    ).toHaveLength(1);
  });

  it('keeps the thread visible when the root is deleted but replies exist', () => {
    const root = createDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: USER,
      body: 'doomed',
      anchor: { kind: 'document' },
    });
    replyToDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: REVIEWER,
      parentCommentId: root.commentId,
      body: 'reply',
    });
    deleteDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      userId: USER,
      commentId: root.commentId,
    });
    const threads = listDocumentCommentThreads(ARTIFACT, ORG);
    expect(threads).toHaveLength(1);
    expect(threads[0]!.root.deletedAt).toBeDefined();
    expect(threads[0]!.replies).toHaveLength(1);
  });
});

describe('listDocumentCommentThreads — filters', () => {
  it('filters by anchorKind / sectionId / blockId / status', () => {
    createDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: USER,
      body: 'doc',
      anchor: { kind: 'document' },
    });
    const sA = createDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: USER,
      body: 'sec-A',
      anchor: { kind: 'section', sectionId: 'sec-A' },
    });
    createDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: USER,
      body: 'sec-B',
      anchor: { kind: 'section', sectionId: 'sec-B' },
    });
    const blk = createDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: USER,
      body: 'block',
      anchor: { kind: 'block', sectionId: 'sec-A', blockId: 'blk-1' },
    });
    resolveDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      userId: REVIEWER,
      commentId: sA.commentId,
    });
    expect(
      listDocumentCommentThreads(ARTIFACT, ORG, { anchorKind: 'document' })
    ).toHaveLength(1);
    expect(
      listDocumentCommentThreads(ARTIFACT, ORG, { sectionId: 'sec-A' })
        .map((t) => t.threadId)
        .sort()
    ).toEqual([sA.threadId, blk.threadId].sort());
    expect(
      listDocumentCommentThreads(ARTIFACT, ORG, { blockId: 'blk-1' }).map((t) => t.threadId)
    ).toEqual([blk.threadId]);
    expect(
      listDocumentCommentThreads(ARTIFACT, ORG, { status: 'resolved' }).map((t) => t.threadId)
    ).toEqual([sA.threadId]);
  });

  it('cross-tenant returns []', () => {
    createDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: USER,
      body: 'r',
      anchor: { kind: 'document' },
    });
    expect(listDocumentCommentThreads(ARTIFACT, ORG_OTHER)).toEqual([]);
  });
});

describe('getDocumentCommentSectionCounts', () => {
  it('aggregates totals + per-section + per-block buckets', () => {
    // 1 document-anchored open
    createDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: USER,
      body: 'doc',
      anchor: { kind: 'document' },
    });
    // 2 section-anchored on sec-A: one open, one resolved
    createDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: USER,
      body: 'sec-A-1',
      anchor: { kind: 'section', sectionId: 'sec-A' },
    });
    const sA2 = createDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: USER,
      body: 'sec-A-2',
      anchor: { kind: 'section', sectionId: 'sec-A' },
    });
    resolveDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      userId: REVIEWER,
      commentId: sA2.commentId,
    });
    // 1 block-anchored on sec-A / blk-1 (open)
    createDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: USER,
      body: 'block-A1',
      anchor: { kind: 'block', sectionId: 'sec-A', blockId: 'blk-1' },
    });
    // 1 section-anchored on sec-B (open)
    createDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: USER,
      body: 'sec-B-1',
      anchor: { kind: 'section', sectionId: 'sec-B' },
    });

    const counts = getDocumentCommentSectionCounts(ARTIFACT, ORG);
    expect(counts.totalOpen).toBe(4);
    expect(counts.totalResolved).toBe(1);
    // sec-A: 1 section-anchored open + 1 section-anchored resolved + 1 block-anchored open.
    expect(counts.perSection['sec-A']).toEqual({ open: 2, resolved: 1 });
    expect(counts.perSection['sec-B']).toEqual({ open: 1, resolved: 0 });
    expect(counts.perBlock['blk-1']).toEqual({ open: 1, resolved: 0 });
    // document-anchored threads do not appear in perSection.
    expect(counts.perSection).not.toHaveProperty('document');
  });

  it('returns zero counts for an artifact with no comments', () => {
    const counts = getDocumentCommentSectionCounts('artifact-empty', ORG);
    expect(counts.totalOpen).toBe(0);
    expect(counts.totalResolved).toBe(0);
    expect(counts.perSection).toEqual({});
    expect(counts.perBlock).toEqual({});
  });

  it('cross-tenant counts are zero', () => {
    createDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: USER,
      body: 'r',
      anchor: { kind: 'section', sectionId: 'sec-A' },
    });
    const counts = getDocumentCommentSectionCounts(ARTIFACT, ORG_OTHER);
    expect(counts.totalOpen).toBe(0);
    expect(counts.perSection).toEqual({});
  });
});
