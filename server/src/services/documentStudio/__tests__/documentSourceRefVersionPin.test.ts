/**
 * Document Studio — DocumentSourceRef version-pinning tests
 * (Slice E5.6, NFR-17).
 *
 * Verifies the backwards-compatible source-version-pinning contract
 * added in slice E5.6:
 *
 *   - pre-E5.6 sourceRefs (no `sourceVersion` / `sourceSnapshotId`)
 *     are treated as unpinned;
 *   - a non-empty `sourceVersion` qualifies as pinned;
 *   - a non-empty `sourceSnapshotId` qualifies as pinned;
 *   - whitespace-only values are NOT treated as pinned (callers
 *     should not be able to bypass the contract by writing "   ");
 *   - undefined / null inputs do not throw.
 *
 * The renderer + QA-side warning pipeline that consumes this helper
 * lands in a follow-up slice on top of the type substrate; this test
 * file pins the type contract so the follow-up has a stable target.
 */

import { describe, expect, it } from 'vitest';

import { type DocumentSourceRef, documentSourceRefHasVersionPin } from '../documentStudioTypes.js';

describe('DocumentSourceRef — source-version pinning (Slice E5.6)', () => {
  it('treats a pre-E5.6 sourceRef (no version / snapshot) as unpinned', () => {
    const ref: DocumentSourceRef = {
      sourceType: 'transcript',
      sourceId: 'transcript-42',
      sourceTitle: 'Q2 board meeting',
    };
    expect(documentSourceRefHasVersionPin(ref)).toBe(false);
  });

  it('treats a sourceRef with a non-empty sourceVersion as pinned', () => {
    const ref: DocumentSourceRef = {
      sourceType: 'document',
      sourceId: 'doc-77',
      sourceVersion: 'v3.0.0',
    };
    expect(documentSourceRefHasVersionPin(ref)).toBe(true);
  });

  it('treats a sourceRef with a non-empty sourceSnapshotId as pinned', () => {
    const ref: DocumentSourceRef = {
      sourceType: 'sourcepack',
      sourceId: 'pack-12',
      sourceSnapshotId: 'snap_2026_05_08_abc123',
    };
    expect(documentSourceRefHasVersionPin(ref)).toBe(true);
  });

  it('treats both fields populated as pinned (snapshot + version)', () => {
    const ref: DocumentSourceRef = {
      sourceType: 'document',
      sourceId: 'doc-77',
      sourceVersion: '7',
      sourceSnapshotId: 'snap-7',
    };
    expect(documentSourceRefHasVersionPin(ref)).toBe(true);
  });

  it('rejects whitespace-only sourceVersion as not pinned', () => {
    const ref: DocumentSourceRef = {
      sourceType: 'document',
      sourceId: 'doc-77',
      sourceVersion: '   ',
    };
    expect(documentSourceRefHasVersionPin(ref)).toBe(false);
  });

  it('rejects whitespace-only sourceSnapshotId as not pinned', () => {
    const ref: DocumentSourceRef = {
      sourceType: 'document',
      sourceId: 'doc-77',
      sourceSnapshotId: '   ',
    };
    expect(documentSourceRefHasVersionPin(ref)).toBe(false);
  });

  it('rejects empty-string version + snapshot as not pinned', () => {
    const ref: DocumentSourceRef = {
      sourceType: 'document',
      sourceId: 'doc-77',
      sourceVersion: '',
      sourceSnapshotId: '',
    };
    expect(documentSourceRefHasVersionPin(ref)).toBe(false);
  });

  it('handles undefined input gracefully (no throw, returns false)', () => {
    expect(documentSourceRefHasVersionPin(undefined)).toBe(false);
  });

  it('handles null input gracefully (no throw, returns false)', () => {
    expect(documentSourceRefHasVersionPin(null)).toBe(false);
  });

  it('does NOT require sourceTitle to be present (only version/snapshot matters)', () => {
    // Source title is unrelated to version pinning — a ref with only a
    // version + sourceType + sourceId (no title) is still pinned.
    const ref: DocumentSourceRef = {
      sourceType: 'document',
      sourceId: 'doc-77',
      sourceVersion: 'v1',
    };
    expect(documentSourceRefHasVersionPin(ref)).toBe(true);
  });
});
