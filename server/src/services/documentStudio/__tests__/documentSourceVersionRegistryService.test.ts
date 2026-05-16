/**
 * Document Studio — Slice E5.6.qa.hard — source version registry tests.
 *
 * Pure-unit specs for `documentSourceVersionRegistryService`. The
 * registry is in-memory append-only state with three public surfaces:
 *
 *   - `recordSeenSourceVersion` — observation appender (idempotent
 *     on `(version, snapshotId)`, refreshes `recordedAt` on
 *     re-observation).
 *   - `getLatestKnownSourceVersion` — recency-based latest lookup.
 *   - `compareSourceVersionPin` — three-way comparison (no entry /
 *     in-sync / hard drift) used by `runSourceDriftQa`.
 *
 * Tests cover:
 *   - empty registry → `null` lookup, `no_registry_entry` compare;
 *   - single observation → in-sync compare, latest matches;
 *   - second observation → hard-drift compare for the older pin;
 *   - re-observation of a known (version, snapshot) → no
 *     duplication, but `recordedAt` updates;
 *   - tenant isolation — orgA observation does not leak to orgB;
 *   - empty / whitespace inputs are silently ignored;
 *   - `__resetSourceVersionRegistryForTests` clears state cleanly.
 */

import { afterEach, describe, expect, it } from 'vitest';

import {
  __resetSourceVersionRegistryForTests,
  compareSourceVersionPin,
  getLatestKnownSourceVersion,
  recordSeenSourceVersion,
} from '../documentSourceVersionRegistryService.js';

describe('documentSourceVersionRegistryService — recordSeenSourceVersion + getLatestKnownSourceVersion', () => {
  afterEach(() => {
    __resetSourceVersionRegistryForTests();
  });

  it('returns null for an unobserved tuple', () => {
    expect(
      getLatestKnownSourceVersion({
        organizationId: 'org-X',
        sourceType: 'transcript',
        sourceId: 'src-1',
      })
    ).toBeNull();
  });

  it('returns the recorded version after a single observation', () => {
    recordSeenSourceVersion({
      organizationId: 'org-X',
      sourceType: 'transcript',
      sourceId: 'src-1',
      sourceVersion: 'v1',
      recordedAt: '2026-01-01T00:00:00.000Z',
    });
    const latest = getLatestKnownSourceVersion({
      organizationId: 'org-X',
      sourceType: 'transcript',
      sourceId: 'src-1',
    });
    expect(latest).toEqual({
      sourceVersion: 'v1',
      sourceSnapshotId: undefined,
      recordedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('returns the most-recent recorded version after multiple observations (recency wins, not insertion order)', () => {
    // Insert v3 first (older recordedAt), then v2 (newer recordedAt).
    // The "latest" is whichever has the max recordedAt — v2.
    recordSeenSourceVersion({
      organizationId: 'org-X',
      sourceType: 'transcript',
      sourceId: 'src-1',
      sourceVersion: 'v3',
      recordedAt: '2026-01-01T00:00:00.000Z',
    });
    recordSeenSourceVersion({
      organizationId: 'org-X',
      sourceType: 'transcript',
      sourceId: 'src-1',
      sourceVersion: 'v2',
      recordedAt: '2026-02-01T00:00:00.000Z',
    });
    const latest = getLatestKnownSourceVersion({
      organizationId: 'org-X',
      sourceType: 'transcript',
      sourceId: 'src-1',
    });
    expect(latest?.sourceVersion).toBe('v2');
  });

  it('refreshes recordedAt when the same (version, snapshot) is re-observed without duplicating entries', () => {
    recordSeenSourceVersion({
      organizationId: 'org-X',
      sourceType: 'transcript',
      sourceId: 'src-1',
      sourceVersion: 'v1',
      sourceSnapshotId: 'snap-a',
      recordedAt: '2026-01-01T00:00:00.000Z',
    });
    recordSeenSourceVersion({
      organizationId: 'org-X',
      sourceType: 'transcript',
      sourceId: 'src-1',
      sourceVersion: 'v1',
      sourceSnapshotId: 'snap-a',
      recordedAt: '2026-03-01T00:00:00.000Z',
    });
    const latest = getLatestKnownSourceVersion({
      organizationId: 'org-X',
      sourceType: 'transcript',
      sourceId: 'src-1',
    });
    expect(latest?.recordedAt).toBe('2026-03-01T00:00:00.000Z');
    expect(latest?.sourceSnapshotId).toBe('snap-a');
  });

  it('keeps observations isolated per organization', () => {
    recordSeenSourceVersion({
      organizationId: 'org-A',
      sourceType: 'transcript',
      sourceId: 'src-1',
      sourceVersion: 'v1',
    });
    expect(
      getLatestKnownSourceVersion({
        organizationId: 'org-B',
        sourceType: 'transcript',
        sourceId: 'src-1',
      })
    ).toBeNull();
    expect(
      getLatestKnownSourceVersion({
        organizationId: 'org-A',
        sourceType: 'transcript',
        sourceId: 'src-1',
      })
    ).not.toBeNull();
  });

  it('silently ignores empty / whitespace inputs', () => {
    recordSeenSourceVersion({
      organizationId: '',
      sourceType: 'transcript',
      sourceId: 'src-1',
      sourceVersion: 'v1',
    });
    recordSeenSourceVersion({
      organizationId: 'org-X',
      sourceType: 'transcript',
      sourceId: '',
      sourceVersion: 'v1',
    });
    recordSeenSourceVersion({
      organizationId: 'org-X',
      sourceType: 'transcript',
      sourceId: 'src-1',
      sourceVersion: '   ',
    });
    expect(
      getLatestKnownSourceVersion({
        organizationId: 'org-X',
        sourceType: 'transcript',
        sourceId: 'src-1',
      })
    ).toBeNull();
  });
});

describe('documentSourceVersionRegistryService — compareSourceVersionPin', () => {
  afterEach(() => {
    __resetSourceVersionRegistryForTests();
  });

  it('returns no_registry_entry for an unobserved tuple', () => {
    expect(
      compareSourceVersionPin({
        organizationId: 'org-X',
        sourceType: 'transcript',
        sourceId: 'src-1',
        pinnedSourceVersion: 'v1',
      })
    ).toEqual({ kind: 'no_registry_entry', latest: null });
  });

  it('returns in_sync when pinned matches the latest known version', () => {
    recordSeenSourceVersion({
      organizationId: 'org-X',
      sourceType: 'transcript',
      sourceId: 'src-1',
      sourceVersion: 'v3',
      recordedAt: '2026-01-01T00:00:00.000Z',
    });
    const cmp = compareSourceVersionPin({
      organizationId: 'org-X',
      sourceType: 'transcript',
      sourceId: 'src-1',
      pinnedSourceVersion: 'v3',
    });
    expect(cmp.kind).toBe('in_sync');
  });

  it('returns hard_drift when pinned differs from the latest known version', () => {
    recordSeenSourceVersion({
      organizationId: 'org-X',
      sourceType: 'transcript',
      sourceId: 'src-1',
      sourceVersion: 'v1',
      recordedAt: '2026-01-01T00:00:00.000Z',
    });
    recordSeenSourceVersion({
      organizationId: 'org-X',
      sourceType: 'transcript',
      sourceId: 'src-1',
      sourceVersion: 'v2',
      recordedAt: '2026-02-01T00:00:00.000Z',
    });
    const cmp = compareSourceVersionPin({
      organizationId: 'org-X',
      sourceType: 'transcript',
      sourceId: 'src-1',
      pinnedSourceVersion: 'v1',
    });
    expect(cmp.kind).toBe('hard_drift');
    if (cmp.kind === 'hard_drift') {
      expect(cmp.latest.sourceVersion).toBe('v2');
    }
  });

  it('treats whitespace-padded pin equality as in_sync (trim-aware)', () => {
    recordSeenSourceVersion({
      organizationId: 'org-X',
      sourceType: 'transcript',
      sourceId: 'src-1',
      sourceVersion: 'v3',
    });
    const cmp = compareSourceVersionPin({
      organizationId: 'org-X',
      sourceType: 'transcript',
      sourceId: 'src-1',
      pinnedSourceVersion: '  v3  ',
    });
    expect(cmp.kind).toBe('in_sync');
  });
});
