/**
 * useIdeaFinancialCasePersistence — the save path RISK-12 said did not exist.
 * Program E / epic E09, stream S6-E09.
 *
 * Owns load/save/conflict for ONE idea's financial case against
 * `GET|PUT /api/idea-financial-case/:ideaId`. Lives beside the dialog rather
 * than inside `useFinancialCase` on purpose: `useFinancialCase` is a pure
 * client-side state machine with its own unit tests and no I/O, and it should
 * stay that way. This hook is the I/O half; the dialog composes the two.
 *
 * ── SAVE STRATEGY: EXPLICIT SAVE BUTTON, NOT DEBOUNCED AUTOSAVE ────────────
 * Decision recorded here because §5.7 point 4 asked for one, and because the
 * alternative is the more fashionable choice and someone will want to "fix"
 * this later. Debounced autosave was rejected for three concrete reasons:
 *
 *   1. OPTIMISTIC CONCURRENCY. Every save bumps `version`. An autosave firing
 *      every N seconds while the user types turns a single editing session
 *      into dozens of version bumps, so a second editor's dialog is
 *      permanently stale and 409s on every attempt. Explicit save keeps the
 *      version timeline meaningful.
 *   2. HALF-EDITED DRIVERS. The case is a driver MODEL, not prose. Autosave
 *      persists "Cloud hos" with an empty monthly series as a real, stored
 *      driver that downstream readers (approval gate, conversion) can pick up.
 *      Prose tolerates mid-word saves; a financial model does not.
 *   3. HIDDEN TRANSPORT FAILURE. An autosave that fails while the user is
 *      still typing produces a toast nobody reads, and the session continues
 *      looking healthy. With an explicit button, the failure lands on the
 *      exact click the user was waiting for.
 *
 * The cost of explicit save is that closing with unsaved work could throw it
 * away — which is the original RISK-12 defect. That cost is paid off by
 * `dirty` below plus the dialog's close-confirmation, NOT left as a footnote.
 *
 * ── NO FALSE SUCCESS ───────────────────────────────────────────────────────
 * `status` never reads 'saved' unless a PUT actually resolved 2xx. A 409 goes
 * to 'conflict' (local work preserved, server copy offered), any other failure
 * goes to 'error' with the real message. A load failure is 'error', never a
 * silently-empty case — see ideaFinancialCase.api.ts's header for why that
 * distinction is load-bearing here.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  fetchIdeaFinancialCase,
  IdeaFinancialCaseConflictError,
  saveIdeaFinancialCase,
  type IdeaFinancialCaseApiResult,
} from '@/services/api/ideaFinancialCase.api';

import type { FinancialCaseInput, FinancialCaseResult } from './financialTypes';

export type FinancialCasePersistenceStatus =
  /** No ideaId — persistence genuinely unavailable (harness/preview). */
  | 'disabled'
  | 'loading'
  | /** Loaded, nothing pending. */ 'ready'
  | /** Local edits not yet sent. */ 'dirty'
  | 'saving'
  | 'saved'
  | /** Server moved on; local work kept, user must choose. */ 'conflict'
  | 'error';

export interface UseIdeaFinancialCasePersistenceOptions {
  ideaId?: string;
  /** Load happens on open, not on mount — the dialog is rendered closed. */
  open: boolean;
}

export function useIdeaFinancialCasePersistence({
  ideaId,
  open,
}: UseIdeaFinancialCasePersistenceOptions) {
  const enabled = Boolean(ideaId);

  const [status, setStatus] = useState<FinancialCasePersistenceStatus>(
    enabled ? 'loading' : 'disabled'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadedCase, setLoadedCase] = useState<FinancialCaseInput | undefined>(undefined);
  const [version, setVersion] = useState<number | undefined>(undefined);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [serverVersion, setServerVersion] = useState<number | null>(null);
  /**
   * Bumped on every (re)load. The dialog uses it as a React `key` on
   * `FinancialCaseView` so a reload genuinely re-seeds `useFinancialCase`'s
   * state — that hook reads `initialCase` only in a lazy initializer, so
   * without a key change a reload would update this hook and leave the visible
   * drivers untouched. That silent divergence is precisely the class of bug
   * this stream exists to remove.
   */
  const [loadKey, setLoadKey] = useState(0);

  /** Latest local edits, refs so a save always sends the newest snapshot. */
  const pendingInput = useRef<FinancialCaseInput | null>(null);
  const pendingResult = useRef<FinancialCaseResult | null>(null);
  const pendingComputedAt = useRef<string | null>(null);
  /** Guards against a late in-flight load overwriting a newer one. */
  const loadSeq = useRef(0);

  const applyLoaded = useCallback((row: IdeaFinancialCaseApiResult | null) => {
    if (row) {
      setLoadedCase(row.payload?.input as FinancialCaseInput | undefined);
      setVersion(row.version);
      pendingResult.current = (row.payload?.result as FinancialCaseResult | null) ?? null;
      pendingComputedAt.current = row.payload?.lastComputedAt ?? null;
      setLastSavedAt(row.updatedAt ?? null);
    } else {
      // No row yet: a genuinely new case. `undefined` (not an empty object)
      // so `useFinancialCase` falls back to its own createEmptyCase().
      setLoadedCase(undefined);
      setVersion(undefined);
      pendingResult.current = null;
      pendingComputedAt.current = null;
      setLastSavedAt(null);
    }
    pendingInput.current = null;
    setServerVersion(null);
    setErrorMessage(null);
    setStatus('ready');
    setLoadKey((k) => k + 1);
  }, []);

  /**
   * Returns `Promise<boolean>` (added for the S12-REGISTRY action-registry
   * wiring, R10 closure) — `true` only when THIS call's fetch actually landed
   * and was applied; `false` on a transport error OR when a newer `load()`
   * call superseded this one before it resolved (`loadSeq` guard: the
   * superseding call is the one whose result matters, so THIS call reports
   * "not confirmed" rather than guessing). Existing callers (`useEffect`
   * below, `reloadFromServer`) already ignored the return value, so this is
   * additive — no behaviour change for them.
   */
  const load = useCallback(async (): Promise<boolean> => {
    if (!ideaId) {
      setStatus('disabled');
      return false;
    }
    const mySeq = ++loadSeq.current;
    setStatus('loading');
    setErrorMessage(null);
    try {
      const row = await fetchIdeaFinancialCase(ideaId);
      if (mySeq !== loadSeq.current) return false;
      applyLoaded(row);
      return true;
    } catch (err) {
      if (mySeq !== loadSeq.current) return false;
      // Honest failure: the dialog shows an error with a retry, and does NOT
      // render an empty case that the user could mistake for "nothing saved".
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : String(err));
      return false;
    }
  }, [ideaId, applyLoaded]);

  useEffect(() => {
    if (!open) return;
    if (!ideaId) {
      setStatus('disabled');
      return;
    }
    void load();
    // Re-load on every open: another editor may have changed the case since
    // this tab last looked, and starting from a stale version guarantees a 409.
  }, [open, ideaId, load]);

  const onCaseChange = useCallback((next: FinancialCaseInput) => {
    pendingInput.current = next;
    setStatus((s) => (s === 'disabled' || s === 'loading' ? s : 'dirty'));
  }, []);

  const onResultChange = useCallback(
    (result: FinancialCaseResult | null, computedAt: string | null) => {
      pendingResult.current = result;
      pendingComputedAt.current = computedAt;
    },
    []
  );

  /**
   * True whenever unsent local edits still exist. `status` alone is NOT enough:
   * after a FAILED save the status is 'error' but `pendingInput` is still full
   * of the user's work. Deriving `dirty` from status only (the first version of
   * this hook) disabled the Save button in exactly the state where the user
   * most needs it, and let the dialog close without warning after a failed
   * save — re-creating RISK-12's silent discard through the error path.
   * Caught by looking at the `error` screenshot, not by a test.
   */
  const hasPendingEdits = pendingInput.current !== null;
  const dirty =
    status === 'dirty' ||
    status === 'conflict' ||
    (status === 'error' && hasPendingEdits);

  /**
   * Returns `Promise<boolean>` (added for the S12-REGISTRY action-registry
   * wiring, R10 closure) — `true` ONLY when the PUT actually landed (2xx);
   * `false` on a 409 conflict, a transport error, or the no-`ideaId` guard.
   * The "nothing pending" no-op returns `true` (nothing needed saving, so
   * nothing is unconfirmed) but the Save button is disabled whenever
   * `!dirty`, so callers reach that branch only via the retry path, and only
   * when `hasPendingEdits` is already false there. This is the ONLY change
   * to this function's behaviour — every existing state transition
   * (`saving`→`saved`/`conflict`/`error`) is unchanged.
   */
  const save = useCallback(async (): Promise<boolean> => {
    if (!ideaId) return false;
    const input = pendingInput.current;
    // Nothing edited this session — saving would bump `version` for no reason
    // and invalidate other editors' copies. Not an error, just a no-op.
    if (!input) return true;
    setStatus('saving');
    setErrorMessage(null);
    try {
      const row = await saveIdeaFinancialCase(
        ideaId,
        {
          input,
          result: pendingResult.current,
          lastComputedAt: pendingComputedAt.current,
        },
        version
      );
      setVersion(row.version);
      setLastSavedAt(row.updatedAt ?? new Date().toISOString());
      setServerVersion(null);
      pendingInput.current = null;
      setStatus('saved');
      return true;
    } catch (err) {
      if (err instanceof IdeaFinancialCaseConflictError) {
        // Local work is deliberately NOT discarded and NOT auto-merged: the
        // user decides between reloading the server copy and re-saving.
        setServerVersion(err.currentVersion);
        setStatus('conflict');
        setErrorMessage(null);
        return false;
      }
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : String(err));
      return false;
    }
  }, [ideaId, version]);

  /** Conflict resolution: take the server copy, dropping local edits — an
   * explicit, user-chosen discard, which is the opposite of a silent one. */
  const reloadFromServer = useCallback(async () => {
    await load();
  }, [load]);

  return {
    enabled,
    status,
    errorMessage,
    loadedCase,
    loadKey,
    version,
    serverVersion,
    lastSavedAt,
    dirty,
    /** Lets the UI tell a FAILED SAVE (retry the save) from a FAILED LOAD
     *  (refetch). Refetching after a failed save would throw the edits away. */
    hasPendingEdits,
    onCaseChange,
    onResultChange,
    save,
    reload: load,
    reloadFromServer,
  };
}

export type UseIdeaFinancialCasePersistenceReturn = ReturnType<
  typeof useIdeaFinancialCasePersistence
>;
