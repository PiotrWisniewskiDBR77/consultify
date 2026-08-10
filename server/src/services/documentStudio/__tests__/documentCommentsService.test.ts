/**
 * Document Studio — Comments service tests (Epic E6, Slice 6.1).
 *
 * Covers the data plane:
 *   - createDocumentComment / replyToDocumentComment (anchor +
 *     thread inheritance + reply-to-reply guard).
 *   - resolve / reopen apply thread-wide and are idempotent on
 *     same-state requests (throw stable codes).
 *   - delete is author-only soft-delete; deleted comments stay in
 *     the timeline with empty body + deletedAt stamp.
 *   - Tenant safety: cross-tenant reads return null/[]; cross-tenant
 *     writes throw `unknown_comment` (no existence leak).
 *   - Audit pump receives one entry per real mutation with stable
 *     details shape.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import {
  __resetDocumentCommentsForTests,
  createDocumentComment,
  deleteDocumentComment,
  DocumentCommentError,
  getDocumentComment,
  listDocumentComments,
  registerDocumentCommentsAuditPump,
  reopenDocumentComment,
  replyToDocumentComment,
  resolveDocumentComment,
} from '../documentCommentsService.js';
import type { DocumentAuditEntry } from '../documentStudioTypes.js';

const ORG = 'org-cmt';
const ORG_OTHER = 'org-cmt-other';
const ARTIFACT = 'artifact-cmt-1';
const USER = 'user-cmt-1';
const REVIEWER = 'reviewer-cmt-1';

let auditPumpSpy: Mock<(entry: DocumentAuditEntry) => void>;

beforeEach(() => {
  __resetDocumentCommentsForTests();
  auditPumpSpy = vi.fn();
  registerDocumentCommentsAuditPump((entry: DocumentAuditEntry) => {
    auditPumpSpy(entry);
  });
});

afterEach(() => {
  __resetDocumentCommentsForTests();
});

describe('createDocumentComment', () => {
  it('seeds threadId === commentId and status=open on a new root', () => {
    const c = createDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: USER,
      body: 'first comment',
      anchor: { kind: 'document' },
    });
    expect(c.commentId).toBeTruthy();
    expect(c.threadId).toBe(c.commentId);
    expect(c.status).toBe('open');
    expect(c.parentCommentId).toBeUndefined();
    expect(c.body).toBe('first comment');
  });

  it('honors all three anchor kinds with their required ids', () => {
    const a1 = createDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: USER,
      body: 'a',
      anchor: { kind: 'document' },
    });
    const a2 = createDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: USER,
      body: 'b',
      anchor: { kind: 'section', sectionId: 'sec-1' },
    });
    const a3 = createDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: USER,
      body: 'c',
      anchor: { kind: 'block', sectionId: 'sec-1', blockId: 'blk-1' },
    });
    expect(a1.anchor.kind).toBe('document');
    expect((a2.anchor as { sectionId: string }).sectionId).toBe('sec-1');
    expect(a3.anchor).toMatchObject({ kind: 'block', sectionId: 'sec-1', blockId: 'blk-1' });
  });

  it('rejects empty / oversize bodies and missing anchor ids', () => {
    expect(() =>
      createDocumentComment({
        organizationId: ORG,
        artifactId: ARTIFACT,
        authorId: USER,
        body: '   ',
        anchor: { kind: 'document' },
      })
    ).toThrowError(/body must not be empty/);
    expect(() =>
      createDocumentComment({
        organizationId: ORG,
        artifactId: ARTIFACT,
        authorId: USER,
        body: 'x'.repeat(10_001),
        anchor: { kind: 'document' },
      })
    ).toThrowError(/exceeds 10000/);
    expect(() =>
      createDocumentComment({
        organizationId: ORG,
        artifactId: ARTIFACT,
        authorId: USER,
        body: 'ok',
        anchor: { kind: 'section' } as unknown as { kind: 'section'; sectionId: string },
      })
    ).toThrowError(/sectionId is required/);
    expect(() =>
      createDocumentComment({
        organizationId: ORG,
        artifactId: ARTIFACT,
        authorId: USER,
        body: 'ok',
        anchor: { kind: 'block', sectionId: 'sec' } as unknown as {
          kind: 'block';
          sectionId: string;
          blockId: string;
        },
      })
    ).toThrowError(/blockId is required/);
  });

  it('emits a comment_added audit row with stable details', () => {
    auditPumpSpy.mockClear();
    const c = createDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: USER,
      body: 'audit me',
      anchor: { kind: 'section', sectionId: 'sec-1' },
    });
    expect(auditPumpSpy).toHaveBeenCalledTimes(1);
    const entry = auditPumpSpy.mock.calls[0]![0] as DocumentAuditEntry;
    expect(entry.action).toBe('comment_added');
    const details = entry.details as Record<string, unknown>;
    expect(details.commentId).toBe(c.commentId);
    expect(details.threadId).toBe(c.threadId);
  });
});

describe('replyToDocumentComment', () => {
  it('inherits parent anchor + threadId and bumps the root updatedAt', () => {
    const root = createDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: USER,
      body: 'root',
      anchor: { kind: 'section', sectionId: 'sec-1' },
    });
    const reply = replyToDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: REVIEWER,
      parentCommentId: root.commentId,
      body: 'reply',
    });
    expect(reply.threadId).toBe(root.threadId);
    expect(reply.parentCommentId).toBe(root.commentId);
    expect(reply.anchor).toEqual(root.anchor);
    const updatedRoot = getDocumentComment(root.commentId, ORG);
    expect(updatedRoot!.updatedAt >= root.updatedAt).toBe(true);
  });

  it('rejects replies-to-replies (flat thread model)', () => {
    const root = createDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: USER,
      body: 'r',
      anchor: { kind: 'document' },
    });
    const reply = replyToDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: REVIEWER,
      parentCommentId: root.commentId,
      body: 'first reply',
    });
    let caught: unknown;
    try {
      replyToDocumentComment({
        organizationId: ORG,
        artifactId: ARTIFACT,
        authorId: USER,
        parentCommentId: reply.commentId,
        body: 'reply to reply',
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(DocumentCommentError);
    expect((caught as DocumentCommentError).code).toBe('reply_to_reply_forbidden');
  });

  it('throws unknown_comment when parent does not exist or is in another tenant', () => {
    const root = createDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: USER,
      body: 'root',
      anchor: { kind: 'document' },
    });
    expect(() =>
      replyToDocumentComment({
        organizationId: ORG_OTHER,
        artifactId: ARTIFACT,
        authorId: USER,
        parentCommentId: root.commentId,
        body: 'cross-tenant',
      })
    ).toThrowError(/comment .* not found/);
  });

  it('throws forbidden when parent belongs to a different artifact', () => {
    const root = createDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: USER,
      body: 'root',
      anchor: { kind: 'document' },
    });
    let caught: unknown;
    try {
      replyToDocumentComment({
        organizationId: ORG,
        artifactId: 'artifact-different',
        authorId: USER,
        parentCommentId: root.commentId,
        body: 'wrong artifact',
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(DocumentCommentError);
    expect((caught as DocumentCommentError).code).toBe('forbidden');
  });
});

describe('resolveDocumentComment / reopenDocumentComment', () => {
  it('resolution is thread-wide: every comment in the thread flips to resolved', () => {
    const root = createDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: USER,
      body: 'root',
      anchor: { kind: 'document' },
    });
    replyToDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: REVIEWER,
      parentCommentId: root.commentId,
      body: 'r1',
    });
    replyToDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: USER,
      parentCommentId: root.commentId,
      body: 'r2',
    });
    const resolvedRoot = resolveDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      userId: REVIEWER,
      commentId: root.commentId,
      reason: 'addressed in v2',
    });
    expect(resolvedRoot.status).toBe('resolved');
    expect(resolvedRoot.resolveReason).toBe('addressed in v2');

    const all = listDocumentComments(ARTIFACT, ORG);
    expect(all).toHaveLength(3);
    expect(all.every((c) => c.status === 'resolved')).toBe(true);
    expect(all.every((c) => c.resolvedBy === REVIEWER)).toBe(true);
  });

  it('resolving via a reply still resolves the whole thread', () => {
    const root = createDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: USER,
      body: 'root',
      anchor: { kind: 'document' },
    });
    const reply = replyToDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: REVIEWER,
      parentCommentId: root.commentId,
      body: 'r',
    });
    resolveDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      userId: REVIEWER,
      commentId: reply.commentId,
    });
    expect(getDocumentComment(root.commentId, ORG)!.status).toBe('resolved');
  });

  it('comment_already_resolved on double-resolve, comment_not_resolved on reopen-of-open', () => {
    const root = createDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: USER,
      body: 'r',
      anchor: { kind: 'document' },
    });
    resolveDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      userId: REVIEWER,
      commentId: root.commentId,
    });
    let caught: unknown;
    try {
      resolveDocumentComment({
        organizationId: ORG,
        artifactId: ARTIFACT,
        userId: REVIEWER,
        commentId: root.commentId,
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(DocumentCommentError);
    expect((caught as DocumentCommentError).code).toBe('comment_already_resolved');

    reopenDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      userId: USER,
      commentId: root.commentId,
    });
    let caught2: unknown;
    try {
      reopenDocumentComment({
        organizationId: ORG,
        artifactId: ARTIFACT,
        userId: USER,
        commentId: root.commentId,
      });
    } catch (err) {
      caught2 = err;
    }
    expect(caught2).toBeInstanceOf(DocumentCommentError);
    expect((caught2 as DocumentCommentError).code).toBe('comment_not_resolved');
  });

  it('reopen clears resolved* and stamps reopened* on every comment in the thread', () => {
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
    const reopened = reopenDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      userId: USER,
      commentId: root.commentId,
      reason: 'still broken',
    });
    expect(reopened.status).toBe('open');
    expect(reopened.reopenedBy).toBe(USER);
    expect(reopened.resolvedBy).toBeUndefined();
    expect(reopened.resolvedAt).toBeUndefined();
    expect(listDocumentComments(ARTIFACT, ORG).every((c) => c.status === 'open')).toBe(true);
  });
});

describe('deleteDocumentComment', () => {
  it('soft-deletes by author with empty body + deletedAt stamp; row stays in listing', () => {
    const c = createDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: USER,
      body: 'sensitive content',
      anchor: { kind: 'document' },
    });
    deleteDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      userId: USER,
      commentId: c.commentId,
    });
    const all = listDocumentComments(ARTIFACT, ORG, { hideDeleted: false });
    expect(all).toHaveLength(1);
    expect(all[0]!.body).toBe('');
    expect(all[0]!.deletedBy).toBe(USER);
    expect(all[0]!.deletedAt).toBeDefined();
    // Default listing hides deleted.
    expect(listDocumentComments(ARTIFACT, ORG)).toHaveLength(0);
  });

  it('forbidden when the deleter is not the author', () => {
    const c = createDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: USER,
      body: 'r',
      anchor: { kind: 'document' },
    });
    let caught: unknown;
    try {
      deleteDocumentComment({
        organizationId: ORG,
        artifactId: ARTIFACT,
        userId: REVIEWER,
        commentId: c.commentId,
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(DocumentCommentError);
    expect((caught as DocumentCommentError).code).toBe('forbidden');
  });

  it('deleted comments cannot be replied to', () => {
    const root = createDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: USER,
      body: 'root',
      anchor: { kind: 'document' },
    });
    deleteDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      userId: USER,
      commentId: root.commentId,
    });
    let caught: unknown;
    try {
      replyToDocumentComment({
        organizationId: ORG,
        artifactId: ARTIFACT,
        authorId: REVIEWER,
        parentCommentId: root.commentId,
        body: 'reply',
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(DocumentCommentError);
    expect((caught as DocumentCommentError).code).toBe('comment_deleted');
  });
});

describe('listDocumentComments — filters', () => {
  it('filters by anchor kind / sectionId / blockId / status', () => {
    createDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: USER,
      body: 'doc-level',
      anchor: { kind: 'document' },
    });
    createDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: USER,
      body: 'sec-A',
      anchor: { kind: 'section', sectionId: 'sec-A' },
    });
    const sB = createDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: USER,
      body: 'sec-B-1',
      anchor: { kind: 'section', sectionId: 'sec-B' },
    });
    const blk = createDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: USER,
      body: 'block-1',
      anchor: { kind: 'block', sectionId: 'sec-B', blockId: 'blk-1' },
    });
    resolveDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      userId: REVIEWER,
      commentId: sB.commentId,
    });
    expect(
      listDocumentComments(ARTIFACT, ORG, { anchorKind: 'document' }).map((c) => c.body)
    ).toEqual(['doc-level']);
    expect(listDocumentComments(ARTIFACT, ORG, { sectionId: 'sec-B' }).map((c) => c.body)).toEqual([
      'sec-B-1',
      'block-1',
    ]);
    expect(
      listDocumentComments(ARTIFACT, ORG, { blockId: 'blk-1' }).map((c) => c.commentId)
    ).toEqual([blk.commentId]);
    expect(listDocumentComments(ARTIFACT, ORG, { status: 'resolved' }).map((c) => c.body)).toEqual([
      'sec-B-1',
    ]);
    expect(
      listDocumentComments(ARTIFACT, ORG, { status: 'open' }).every((c) => c.status === 'open')
    ).toBe(true);
  });
});

describe('Tenancy isolation', () => {
  it('cross-tenant list returns [] and getDocumentComment returns null', () => {
    const c = createDocumentComment({
      organizationId: ORG,
      artifactId: ARTIFACT,
      authorId: USER,
      body: 'r',
      anchor: { kind: 'document' },
    });
    expect(listDocumentComments(ARTIFACT, ORG_OTHER)).toEqual([]);
    expect(getDocumentComment(c.commentId, ORG_OTHER)).toBeNull();
  });
});
