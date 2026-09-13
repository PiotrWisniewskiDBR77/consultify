/**
 * S1.14b / B6 — notebook versions were never created by anything.
 *
 * Measured on staging 13.09: `GET /api/v8/notebook/pages/:id/versions` →
 * {"data":[],"count":0} after ~1000 words and dozens of PUTs; grep over the whole
 * `src/` found ZERO callers of `POST …/pages/:id/versions` (only the GET list and
 * the `/restore` POST). "Version history" could not fill and "Restore" could not
 * be reached — for any organization, ever.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  maybeSnapshotNotebookPage,
  resetNotebookSnapshotMarks,
  shouldSnapshot,
  SNAPSHOT_MIN_DELTA_CHARS,
  SNAPSHOT_MIN_INTERVAL_MS,
} from '../notebookVersionSnapshot';

describe('S1.14b/B6 — shouldSnapshot throttle', () => {
  it('snapshots the first save of a page so history is never empty', () => {
    expect(shouldSnapshot({ previous: undefined, now: 1000, contentLength: 50 })).toBe(true);
  });

  it('does not snapshot empty content', () => {
    expect(shouldSnapshot({ previous: undefined, now: 1000, contentLength: 0 })).toBe(false);
  });

  it('does not snapshot again inside the interval, however much the text moved', () => {
    const previous = { at: 0, length: 100 };
    expect(
      shouldSnapshot({
        previous,
        now: SNAPSHOT_MIN_INTERVAL_MS - 1,
        contentLength: 100 + SNAPSHOT_MIN_DELTA_CHARS * 10,
      })
    ).toBe(false);
  });

  it('does not snapshot after the interval when the text barely moved', () => {
    const previous = { at: 0, length: 100 };
    expect(
      shouldSnapshot({
        previous,
        now: SNAPSHOT_MIN_INTERVAL_MS + 1,
        contentLength: 100 + SNAPSHOT_MIN_DELTA_CHARS - 1,
      })
    ).toBe(false);
  });

  it('snapshots after the interval once the text moved enough', () => {
    const previous = { at: 0, length: 100 };
    expect(
      shouldSnapshot({
        previous,
        now: SNAPSHOT_MIN_INTERVAL_MS + 1,
        contentLength: 100 + SNAPSHOT_MIN_DELTA_CHARS,
      })
    ).toBe(true);
  });
});

describe('S1.14b/B6 — maybeSnapshotNotebookPage posts to the create endpoint', () => {
  beforeEach(() => resetNotebookSnapshotMarks());

  it('POSTs the snapshot to /api/v8/notebook/pages/:id/versions', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 201 }) as Response);
    const sent = await maybeSnapshotNotebookPage(
      { pageId: 'page-1', title: 'Order-to-Cash', contentText: 'hello world' },
      { now: () => 1_000, fetchImpl: fetchImpl as unknown as typeof fetch }
    );

    expect(sent).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/v8/notebook/pages/page-1/versions');
    expect(init.method).toBe('POST');
  });

  it('does not fire a second snapshot for the same page inside the interval', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 201 }) as Response);
    const opts = { now: () => 1_000, fetchImpl: fetchImpl as unknown as typeof fetch };
    await maybeSnapshotNotebookPage({ pageId: 'page-1', contentText: 'a'.repeat(500) }, opts);
    await maybeSnapshotNotebookPage({ pageId: 'page-1', contentText: 'b'.repeat(5000) }, opts);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('never throws when the versions table is missing (503)', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 503 }) as Response);
    await expect(
      maybeSnapshotNotebookPage(
        { pageId: 'page-2', contentText: 'x' },
        { now: () => 1_000, fetchImpl: fetchImpl as unknown as typeof fetch }
      )
    ).resolves.toBe(false);
  });
});

describe('S1.14b/B6 — the notebook actually calls the writer', () => {
  it('NotebookContent invokes maybeSnapshotNotebookPage after a successful save', async () => {
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/MyWork/NotebookContent.tsx'),
      'utf8'
    );
    expect(source).toContain("from '@/services/notebookVersionSnapshot'");
    expect(source).toContain('maybeSnapshotNotebookPage({');
  });
});
