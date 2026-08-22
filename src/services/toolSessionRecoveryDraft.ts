/**
 * toolSessionRecoveryDraft — localStorage recovery draft for tool sessions.
 *
 * NOT THE SOURCE OF TRUTH. The server (PostgreSQL `tool_sessions` table) is
 * authoritative — see `toolSessionApi.ts`. This module exists ONLY so an
 * edit made in the seconds before a debounced autosave fires, or made
 * while offline, is not silently lost if the tab closes/crashes/reloads
 * before the PUT reaches the server. It is read by `useToolSessionSync`
 * immediately after every server load and is otherwise inert: nothing
 * here is ever treated as authoritative, and every draft either gets
 * discarded (server moved on) or explicitly offered back to the user for
 * recovery (server did not move on, and the draft differs) — never
 * applied silently.
 *
 * Namespacing: `consultify:toolSession:recoveryDraft:v1:<toolId>` — scoped
 * per session id so drafts from different sessions/tools never collide,
 * and version-tagged (`v1`) so a future shape change can ignore old
 * drafts instead of crashing on them.
 */

const DRAFT_KEY_PREFIX = 'consultify:toolSession:recoveryDraft:v1:';

export interface ToolSessionRecoveryDraft<TData = unknown> {
  toolId: string;
  /** `updatedAt` of the server session this draft was built on top of, if known. */
  baseUpdatedAt: string | null;
  /** Server `version` this draft was built on top of, if a session had already loaded. */
  baseVersion?: number;
  data: TData;
  /** local wall-clock time the draft was written (ISO string). */
  savedAt: string;
}

function storageKey(toolId: string): string {
  return `${DRAFT_KEY_PREFIX}${toolId}`;
}

function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    // Private-mode / disabled storage — recovery is best-effort, never fatal.
    return null;
  }
}

export function writeRecoveryDraft<TData>(
  toolId: string | null | undefined,
  draft: { baseUpdatedAt: string | null; baseVersion?: number; data: TData }
): void {
  const storage = getStorage();
  if (!storage || !toolId) return;
  const record: ToolSessionRecoveryDraft<TData> = {
    toolId,
    baseUpdatedAt: draft.baseUpdatedAt,
    baseVersion: draft.baseVersion,
    data: draft.data,
    savedAt: new Date().toISOString(),
  };
  try {
    storage.setItem(storageKey(toolId), JSON.stringify(record));
  } catch {
    // Quota exceeded or blocked — best-effort, never fatal.
  }
}

export function readRecoveryDraft<TData = unknown>(
  toolId: string | null | undefined
): ToolSessionRecoveryDraft<TData> | null {
  const storage = getStorage();
  if (!storage || !toolId) return null;
  try {
    const raw = storage.getItem(storageKey(toolId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed.toolId !== toolId) return null;
    return parsed as ToolSessionRecoveryDraft<TData>;
  } catch {
    return null;
  }
}

export function clearRecoveryDraft(toolId: string | null | undefined): void {
  const storage = getStorage();
  if (!storage || !toolId) return;
  try {
    storage.removeItem(storageKey(toolId));
  } catch {
    // no-op
  }
}

export type RecoveryDecision = 'discard-stale' | 'offer-recovery' | 'none';

/**
 * Decide what to do with a local draft once the server's authoritative
 * state has been loaded.
 *
 * - 'none': no draft, or the draft's data is identical to the server's —
 *   nothing to recover, nothing to discard-and-notify about.
 * - 'discard-stale': the server has moved on since this draft was taken
 *   (server.updatedAt is strictly newer than draft.baseUpdatedAt) — the
 *   draft cannot safely be reapplied on top of newer server data, so only
 *   the server state is used and the caller should tell the user a stale
 *   local draft was discarded.
 * - 'offer-recovery': the server has NOT moved on since this draft was
 *   taken, but the draft's data differs from what the server has — this
 *   is likely genuine unsynced local work (the autosave never completed,
 *   e.g. the tab closed mid-debounce or the connection dropped), so it is
 *   offered back to the user instead of silently dropped.
 */
export function evaluateRecoveryDraft<TData>(
  draft: ToolSessionRecoveryDraft<TData> | null,
  server: { updatedAt: string | null; data: TData }
): RecoveryDecision {
  if (!draft) return 'none';
  if (deepEqualJson(draft.data, server.data)) return 'none';

  const serverTime = Date.parse(server.updatedAt || '');
  const baseTime = Date.parse(draft.baseUpdatedAt || '');
  if (Number.isFinite(serverTime) && Number.isFinite(baseTime) && serverTime > baseTime) {
    return 'discard-stale';
  }
  return 'offer-recovery';
}

function deepEqualJson(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}
