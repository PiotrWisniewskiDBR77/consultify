/**
 * Document Studio — Epic E1 automatic version history.
 *
 * Covers the server-side auto-capture rule wired into the autosave path
 * (`updateDocumentManualContent` → `maybeAutoCaptureDocumentVersionSnapshot`,
 * `server/src/services/documentStudio/documentStudioService.ts`):
 *
 *   - decideAutoSnapshotCapture (pure rule, no store/IO):
 *       * no previous snapshot → always capture ("first snapshot").
 *       * time threshold: >=10 min since the last snapshot → capture,
 *         even with zero content change.
 *       * content-delta threshold: >15% change in serialized section
 *         length since the last snapshot → capture, even within the
 *         10-minute window.
 *       * neither threshold crossed → do not capture.
 *   - maybeAutoCaptureDocumentVersionSnapshot (effectful wrapper):
 *       * records an `'autosave'`-origin snapshot when the rule fires,
 *         and returns null (no-op) when it doesn't.
 *       * never throws — swallows any internal error and resolves null.
 *   - Retention: autosave-origin snapshots are capped at 30 per artifact,
 *     oldest-first pruning; manual / auto_status_change / rollback_revert
 *     snapshots are never pruned by the cap regardless of age.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentSchema, DocumentStatus } from '../../../server/src/services/documentStudio/documentStudioTypes.js';
import {
  AUTO_SNAPSHOT_CONTENT_DELTA_RATIO,
  AUTO_SNAPSHOT_MIN_INTERVAL_MS,
  AUTO_SNAPSHOT_RETENTION_LIMIT,
  __resetDocumentVersionSnapshotsForTests,
  createDocumentVersionSnapshot,
  decideAutoSnapshotCapture,
  listDocumentVersionSnapshots,
  maybeAutoCaptureDocumentVersionSnapshot,
} from '../../../server/src/services/documentStudio/documentVersionSnapshotService.js';

const ORG = 'org-e1';
const USER = 'user-1';

function fakeSchema(sectionBlockCount: number, overrides: Partial<DocumentSchema> = {}): DocumentSchema {
  return {
    documentId: 'doc-1',
    artifactId: 'artifact-1',
    title: 'Q3 Memo',
    documentType: 'executive_memo',
    language: 'en',
    audience: ['Board'],
    goal: 'decide',
    communicationRegister: 'executive',
    density: 'medium',
    languageStyle: 'consulting_neutral',
    confidentiality: 'internal',
    formattingSchema: {
      fonts: { body: 'Aptos 11', heading: 'Aptos Display' },
      headingStyles: { h1: '16pt bold', h2: '13pt bold', h3: '11pt bold' },
      tableStyles: { default: 'consultify_clean_table' },
      listStyles: { bullet: 'consultify_bullet', numbered: 'consultify_numbered' },
      page: { size: 'A4', marginsCm: { top: 2, bottom: 2, left: 2.3, right: 2.3 } },
      headers: { enabled: true },
      footers: { enabled: true, pageNumbering: true, confidentialityLabel: true },
      toc: true,
      coverPage: true,
      appendixStyle: 'lettered',
      citationStyle: 'inline_marker',
    },
    sections: [
      {
        sectionId: 'sec-1',
        orderIndex: 0,
        level: 1,
        title: 'Section 1',
        blocks: Array.from({ length: sectionBlockCount }, (_, i) => ({
          blockId: `block-${i}`,
          type: 'paragraph',
          content: 'x'.repeat(20),
        })) as unknown as DocumentSchema['sections'][number]['blocks'],
        sourceRefs: [],
      },
    ],
    sourceRefs: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    documentStatus: 'draft' satisfies DocumentStatus,
    ...overrides,
  };
}

beforeEach(() => {
  __resetDocumentVersionSnapshotsForTests();
});

afterEach(() => {
  __resetDocumentVersionSnapshotsForTests();
});

describe('decideAutoSnapshotCapture (pure rule)', () => {
  it('always captures when there is no previous snapshot', () => {
    const decision = decideAutoSnapshotCapture({
      previous: null,
      nextSchema: fakeSchema(5),
    });
    expect(decision.shouldCapture).toBe(true);
    expect(decision.reason).toMatch(/first snapshot/);
    expect(decision.elapsedMs).toBeNull();
    expect(decision.deltaRatio).toBeNull();
  });

  it('captures once the time threshold (>=10 min) has elapsed, even with no content change', () => {
    const previous = createDocumentVersionSnapshot({
      organizationId: ORG,
      artifactId: 'artifact-1',
      userId: USER,
      schema: fakeSchema(5),
      statusAtCapture: 'draft',
    });
    const now = new Date(previous.capturedAt).getTime() + AUTO_SNAPSHOT_MIN_INTERVAL_MS;
    const decision = decideAutoSnapshotCapture({
      previous,
      nextSchema: fakeSchema(5),
      now,
    });
    expect(decision.shouldCapture).toBe(true);
    expect(decision.reason).toMatch(/min since last snapshot/);
    expect(decision.elapsedMs).toBe(AUTO_SNAPSHOT_MIN_INTERVAL_MS);
  });

  it('does not capture just under the time threshold with an insignificant content delta', () => {
    const previous = createDocumentVersionSnapshot({
      organizationId: ORG,
      artifactId: 'artifact-1',
      userId: USER,
      schema: fakeSchema(5),
      statusAtCapture: 'draft',
    });
    const now = new Date(previous.capturedAt).getTime() + AUTO_SNAPSHOT_MIN_INTERVAL_MS - 1000;
    // A single extra block on a 5-block section is a real but small delta —
    // keep it comfortably under 15% by only tweaking existing content
    // length by ~1 char, i.e. essentially zero delta.
    const decision = decideAutoSnapshotCapture({
      previous,
      nextSchema: fakeSchema(5),
      now,
    });
    expect(decision.shouldCapture).toBe(false);
    expect(decision.elapsedMs).toBe(AUTO_SNAPSHOT_MIN_INTERVAL_MS - 1000);
    expect(decision.deltaRatio).toBe(0);
  });

  it('captures within the time window when the content-length delta exceeds 15%', () => {
    const previous = createDocumentVersionSnapshot({
      organizationId: ORG,
      artifactId: 'artifact-1',
      userId: USER,
      schema: fakeSchema(5),
      statusAtCapture: 'draft',
    });
    const now = new Date(previous.capturedAt).getTime() + 1000; // well within 10 min
    // Doubling the block count is a large, unambiguous content change.
    const decision = decideAutoSnapshotCapture({
      previous,
      nextSchema: fakeSchema(12),
      now,
    });
    expect(decision.shouldCapture).toBe(true);
    expect(decision.reason).toMatch(/content length changed/);
    expect(decision.deltaRatio).toBeGreaterThan(AUTO_SNAPSHOT_CONTENT_DELTA_RATIO);
  });

  it('does not capture when neither threshold is crossed', () => {
    const previous = createDocumentVersionSnapshot({
      organizationId: ORG,
      artifactId: 'artifact-1',
      userId: USER,
      schema: fakeSchema(5),
      statusAtCapture: 'draft',
    });
    const now = new Date(previous.capturedAt).getTime() + 60_000; // 1 min, under 10
    // Identical schema — zero content delta, well under the time
    // threshold. Neither condition fires.
    const decision = decideAutoSnapshotCapture({
      previous,
      nextSchema: fakeSchema(5),
      now,
    });
    expect(decision.shouldCapture).toBe(false);
  });
});

describe('maybeAutoCaptureDocumentVersionSnapshot (effectful wrapper)', () => {
  it('records an autosave-origin snapshot when the rule fires and returns null when it does not', () => {
    const first = maybeAutoCaptureDocumentVersionSnapshot({
      organizationId: ORG,
      artifactId: 'artifact-2',
      userId: USER,
      schema: fakeSchema(5),
      statusAtCapture: 'draft',
    });
    expect(first).not.toBeNull();
    expect(first!.origin).toBe('autosave');
    expect(first!.versionNumber).toBe(1);

    // Immediately calling again with an unchanged schema, well within
    // the time window, must be a no-op (no new snapshot recorded).
    const second = maybeAutoCaptureDocumentVersionSnapshot({
      organizationId: ORG,
      artifactId: 'artifact-2',
      userId: USER,
      schema: fakeSchema(5),
      statusAtCapture: 'draft',
    });
    expect(second).toBeNull();
    expect(listDocumentVersionSnapshots('artifact-2', ORG)).toHaveLength(1);
  });

  it('never throws — swallows errors from malformed input and resolves null', () => {
    expect(() =>
      maybeAutoCaptureDocumentVersionSnapshot({
        organizationId: '',
        artifactId: '',
        userId: '',
        schema: undefined as unknown as DocumentSchema,
        statusAtCapture: 'draft',
      })
    ).not.toThrow();
    const result = maybeAutoCaptureDocumentVersionSnapshot({
      organizationId: '',
      artifactId: '',
      userId: '',
      schema: undefined as unknown as DocumentSchema,
      statusAtCapture: 'draft',
    });
    expect(result).toBeNull();
  });
});

describe('autosave retention (30 auto-snapshots per artifact, oldest pruned first)', () => {
  // `maybeAutoCaptureDocumentVersionSnapshot` reads the wall clock
  // internally (no `now` override on that surface), so these tests use
  // fake timers and force the TIME threshold every iteration — the
  // deterministic way to guarantee every call captures regardless of
  // content, isolating the retention behavior from the capture rule
  // (already covered above).
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function advancePastTimeThreshold(): void {
    vi.advanceTimersByTime(AUTO_SNAPSHOT_MIN_INTERVAL_MS + 60_000);
  }

  it('caps autosave-origin snapshots at 30 and prunes the oldest first', () => {
    const artifactId = 'artifact-retention';
    const total = AUTO_SNAPSHOT_RETENTION_LIMIT + 5;
    for (let i = 0; i < total; i++) {
      if (i > 0) advancePastTimeThreshold();
      const snap = maybeAutoCaptureDocumentVersionSnapshot({
        organizationId: ORG,
        artifactId,
        userId: USER,
        schema: fakeSchema(5),
        statusAtCapture: 'draft',
      });
      expect(snap).not.toBeNull();
    }

    const list = listDocumentVersionSnapshots(artifactId, ORG);
    const autoSnapshots = list.filter((s) => s.origin === 'autosave');
    expect(autoSnapshots).toHaveLength(AUTO_SNAPSHOT_RETENTION_LIMIT);

    // The surviving snapshots are the most recent ones — the lowest
    // version numbers (the oldest 5) must have been pruned away.
    const versionNumbers = autoSnapshots.map((s) => s.versionNumber).sort((a, b) => a - b);
    expect(versionNumbers[0]).toBe(6); // versions 1..5 pruned
    expect(versionNumbers[versionNumbers.length - 1]).toBe(total);
  });

  it('never prunes manual / auto_status_change / rollback_revert snapshots, even when old', () => {
    const artifactId = 'artifact-retention-mixed';

    // Three manual/system snapshots recorded first (oldest of all).
    createDocumentVersionSnapshot({
      organizationId: ORG,
      artifactId,
      userId: USER,
      schema: fakeSchema(1),
      statusAtCapture: 'draft',
      origin: 'manual',
    });
    createDocumentVersionSnapshot({
      organizationId: ORG,
      artifactId,
      userId: USER,
      schema: fakeSchema(2),
      statusAtCapture: 'approved',
      origin: 'auto_status_change',
    });
    createDocumentVersionSnapshot({
      organizationId: ORG,
      artifactId,
      userId: USER,
      schema: fakeSchema(3),
      statusAtCapture: 'draft',
      origin: 'rollback_revert',
    });

    // Now push well past the retention cap with autosave-origin captures
    // (each one forced across the time threshold).
    const total = AUTO_SNAPSHOT_RETENTION_LIMIT + 10;
    for (let i = 0; i < total; i++) {
      advancePastTimeThreshold();
      maybeAutoCaptureDocumentVersionSnapshot({
        organizationId: ORG,
        artifactId,
        userId: USER,
        schema: fakeSchema(5),
        statusAtCapture: 'draft',
      });
    }

    const list = listDocumentVersionSnapshots(artifactId, ORG);
    const byOrigin = (origin: string) => list.filter((s) => s.origin === origin);

    expect(byOrigin('manual')).toHaveLength(1);
    expect(byOrigin('auto_status_change')).toHaveLength(1);
    expect(byOrigin('rollback_revert')).toHaveLength(1);
    expect(byOrigin('autosave')).toHaveLength(AUTO_SNAPSHOT_RETENTION_LIMIT);
  });
});
