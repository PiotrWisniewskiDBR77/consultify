/**
 * Notebook version snapshots — the missing writer.
 *
 * S1.14b / B6 (pomiar 13.09, staging): "Version history" in the note menu always
 * said "No saved versions yet" after ~1000 words of editing and dozens of PUTs,
 * and "Restore" was therefore unreachable. Cause measured in code, not guessed:
 * the backend has had `POST /api/v8/notebook/pages/:id/versions` since M04
 * (`server/src/routes/v8/notebookVersions.routes.ts`), but the whole front-end
 * had exactly three references to the versions route — a comment, the GET list
 * and `POST …/versions/:vid/restore` — and ZERO callers of the create endpoint.
 * Snapshots were never created by anything, so the feature could not work for
 * any organization, ever.
 *
 * This module is that writer, and nothing more: after a successful autosave the
 * notebook asks `maybeSnapshotNotebookPage` to record a version. The decision is
 * a pure function (`shouldSnapshot`) so the throttle is testable:
 *
 *   - the FIRST save of a page in this session always snapshots (so history is
 *     never empty while the user edits),
 *   - afterwards at most one snapshot per page per SNAPSHOT_MIN_INTERVAL_MS,
 *   - and only when the text actually moved by at least SNAPSHOT_MIN_DELTA_CHARS
 *     (autosave fires on every keystroke burst; a version per keystroke would be
 *     noise, not history).
 *
 * Fail-soft by design: a snapshot is bookkeeping, never a reason to fail or
 * even to warn about a save the user already sees as "Saved".
 */

export const SNAPSHOT_MIN_INTERVAL_MS = 10 * 60 * 1000;
export const SNAPSHOT_MIN_DELTA_CHARS = 200;

export interface SnapshotMark {
  /** Epoch ms of the last snapshot taken for this page. */
  at: number;
  /** Length of the content that was snapshotted. */
  length: number;
}

export interface SnapshotDecisionInput {
  previous: SnapshotMark | undefined;
  now: number;
  contentLength: number;
}

export function shouldSnapshot({
  previous,
  now,
  contentLength,
}: SnapshotDecisionInput): boolean {
  if (contentLength <= 0) return false;
  if (!previous) return true;
  if (now - previous.at < SNAPSHOT_MIN_INTERVAL_MS) return false;
  return Math.abs(contentLength - previous.length) >= SNAPSHOT_MIN_DELTA_CHARS;
}

const marks = new Map<string, SnapshotMark>();

/** Test seam only — resets the per-session throttle memory. */
export function resetNotebookSnapshotMarks(): void {
  marks.clear();
}

const authHeaders = (): Record<string, string> => {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('token') || '' : '';
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export interface SnapshotRequest {
  pageId: string;
  title?: string | null;
  contentJson?: unknown;
  contentText?: string | null;
}

/**
 * Records a version of the page if the throttle allows it. Returns true when a
 * snapshot request was actually sent. Never throws.
 */
export async function maybeSnapshotNotebookPage(
  page: SnapshotRequest,
  deps: { now?: () => number; fetchImpl?: typeof fetch } = {}
): Promise<boolean> {
  const pageId = String(page?.pageId || '').trim();
  if (!pageId) return false;

  const now = (deps.now ?? Date.now)();
  const contentLength = String(page.contentText || '').length;
  if (!shouldSnapshot({ previous: marks.get(pageId), now, contentLength })) return false;

  // Claim the slot BEFORE awaiting: autosave can fire again while this request
  // is in flight, and two snapshots of the same keystroke burst are noise.
  marks.set(pageId, { at: now, length: contentLength });

  try {
    const doFetch = deps.fetchImpl ?? fetch;
    const res = await doFetch(`/api/v8/notebook/pages/${encodeURIComponent(pageId)}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        title: page.title ?? undefined,
        contentJson: page.contentJson ?? undefined,
        contentText: page.contentText ?? undefined,
      }),
    });
    if (!res.ok) {
      // 503 = versions table not migrated in this environment; anything else is
      // a server-side problem. Either way the user's save already succeeded, so
      // this stays a console note and the throttle slot is released so the next
      // save can retry.
      marks.delete(pageId);
      console.warn('[notebookVersionSnapshot] snapshot rejected', res.status);
      return false;
    }
    return true;
  } catch (err) {
    marks.delete(pageId);
    console.warn('[notebookVersionSnapshot] snapshot failed', err);
    return false;
  }
}
