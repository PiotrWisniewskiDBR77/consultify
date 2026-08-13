/**
 * useAssessmentSaveIndicator — the single visible offline/save state for
 * Assessment's HTTP-source-of-truth workspaces (S3, 2026-08-13).
 *
 * ★ This is a LABEL LAYER, not a second state machine. Every one of the
 * eight product states below is a pure derivation of two things that
 * already exist and are owned elsewhere:
 *   1. `MethodSaveState` (`@/method-core/contracts/session.ts`) — the
 *      kernel's own save-state machine, driven by
 *      `useMethodWorkspaceSave` (`src/components/method-workspace/`).
 *   2. The session runtime's connectivity status
 *      (`DrdHttpRuntimeStatus` — `loading | ready | error | offline |
 *      conflict | recovery`, `src/method-core/methods/drd/drdHttpSessionRuntime.ts`)
 *      plus its `pendingWriteCount`.
 * No new persistence, no new source of truth — `deriveAssessmentSaveIndicator`
 * is a total function of those two contracts' current values, and the hook
 * adds only two SHORT-LIVED, purely presentational timers (RECONNECTING /
 * RECOVERED) that never influence what data is shown, only how the badge
 * reads for a few seconds around a reconciliation attempt.
 *
 * Mapping (product state -> `MethodSaveState` × runtime status):
 *
 *   SERVER          <- CLEAN | SAVED, runtime 'ready', no reconciliation in
 *                      flight. "What you see is what the server confirmed."
 *   SAVING          <- SAVING (kernel autosave/manual save in flight, online).
 *   SAVED           <- SAVED (kernel just confirmed a write via read-back).
 *   OFFLINE         <- runtime 'offline' (or kernel OFFLINE_PENDING) with NO
 *                      unsaved local draft yet — connectivity lost, nothing
 *                      to reconcile yet, work is not blocked.
 *   RECOVERY_DRAFT  <- an UNSAVED local draft exists while disconnected:
 *                      kernel DIRTY/OFFLINE_PENDING/SAVE_FAILED while runtime
 *                      is 'offline', OR runtime 'recovery' (a write queue is
 *                      sitting in localStorage, not yet reconciled). Per the
 *                      product rule, this label is used ONLY for that
 *                      unsaved-draft condition — it is never a stand-in for
 *                      confirmed server data.
 *   CONFLICT        <- runtime 'conflict' (server rejected a write/transition
 *                      with 409 version_conflict: the local revision is
 *                      OLDER than the server's). Requires an explicit human
 *                      choice; never auto-resolved.
 *   RECONNECTING    <- transient: an explicit reconciliation call
 *                      (refresh() / retryPending() / discardPendingAndReloadServer())
 *                      is in flight after being offline/recovery/conflict.
 *   RECOVERED       <- transient: that reconciliation call just SUCCEEDED
 *                      (runtime back to 'ready', pendingWriteCount 0) —
 *                      shown for `recoveredDisplayMs` before settling back to
 *                      SERVER/SAVED, so a user who was mid-recovery gets
 *                      positive confirmation instead of the badge silently
 *                      snapping back to normal.
 *
 * Kept OUT of this taxonomy on purpose: kernel DIRTY while fully online (not
 * disconnected, no queue) is a sub-second waypoint on the way to SAVING
 * (the autosave debounce is 800ms in `DrdHttpMethodWorkspaceScreen`) — adding
 * a ninth visible state for that interval would contradict the "widoczne,
 * rozróżnialne stany" goal by making the badge flicker on every keystroke
 * instead of only when something meaningfully different is true. It still
 * renders as SERVER underneath (see `deriveAssessmentSaveIndicator`'s
 * default branch) — the kernel's own DIRTY value is untouched and still
 * drives `useMethodWorkspaceSave`'s leave-guard.
 *
 * A generic (non-conflict, non-offline) SAVE_FAILED — e.g. a 500 — is folded
 * into RECOVERY_DRAFT rather than silently shown as SERVER/SAVED: the user's
 * edit is still just an unconfirmed local draft, and RECOVERY_DRAFT is the
 * only one of the eight labels that says exactly that without claiming a
 * network state (offline) that may not be true.
 */
import { useEffect, useRef, useState } from 'react';

import type { MethodSaveState } from '@/method-core/contracts';

export type AssessmentSaveIndicatorState =
  | 'SERVER'
  | 'SAVING'
  | 'SAVED'
  | 'OFFLINE'
  | 'RECOVERY_DRAFT'
  | 'CONFLICT'
  | 'RECONNECTING'
  | 'RECOVERED';

export const ASSESSMENT_SAVE_INDICATOR_STATES: readonly AssessmentSaveIndicatorState[] = [
  'SERVER',
  'SAVING',
  'SAVED',
  'OFFLINE',
  'RECOVERY_DRAFT',
  'CONFLICT',
  'RECONNECTING',
  'RECOVERED',
];

/** Subset of `DrdHttpRuntimeStatus` this derivation cares about. Kept as an
 * inline union (rather than importing the concrete runtime type) so this
 * hook stays reusable by any HTTP-source-of-truth session runtime in
 * Assessment, not only DRD's. */
export type AssessmentRuntimeConnectivityStatus =
  | 'loading'
  | 'ready'
  | 'error'
  | 'offline'
  | 'conflict'
  | 'recovery';

export interface DeriveAssessmentSaveIndicatorInput {
  readonly runtimeStatus: AssessmentRuntimeConnectivityStatus;
  readonly saveState: MethodSaveState;
  /** Writes queued in localStorage, not yet reconciled with the server. */
  readonly pendingWriteCount: number;
  /** True while an explicit reconciliation call is in flight. */
  readonly isReconnecting: boolean;
  /** True for a short window right after a reconciliation call succeeded. */
  readonly justRecovered: boolean;
}

/**
 * Pure derivation — no timers, no React. `useAssessmentSaveIndicator` below
 * is the only thing that manages the two transient booleans; this function
 * is the actual mapping table and is exercised directly by unit tests for
 * every one of the eight states without needing fake timers.
 */
export function deriveAssessmentSaveIndicator(
  input: DeriveAssessmentSaveIndicatorInput
): AssessmentSaveIndicatorState {
  const { runtimeStatus, saveState, pendingWriteCount, isReconnecting, justRecovered } = input;

  // A 409 (local revision older than the server's) always wins — this is
  // the one state that MUST interrupt a reconciliation-in-flight badge too,
  // since a conflict discovered mid-reconciliation is exactly the case the
  // "never silently overwrite" rule exists for.
  if (runtimeStatus === 'conflict') return 'CONFLICT';

  if (isReconnecting) return 'RECONNECTING';
  if (justRecovered) return 'RECOVERED';

  const disconnected =
    runtimeStatus === 'offline' ||
    runtimeStatus === 'recovery' ||
    saveState === 'OFFLINE_PENDING' ||
    saveState === 'SAVE_FAILED';

  if (disconnected) {
    const hasUnsavedLocalDraft =
      pendingWriteCount > 0 ||
      saveState === 'DIRTY' ||
      saveState === 'OFFLINE_PENDING' ||
      saveState === 'SAVE_FAILED';
    return hasUnsavedLocalDraft ? 'RECOVERY_DRAFT' : 'OFFLINE';
  }

  if (saveState === 'SAVING') return 'SAVING';
  if (saveState === 'SAVED') return 'SAVED';
  return 'SERVER';
}

export interface UseAssessmentSaveIndicatorOptions {
  readonly runtimeStatus: AssessmentRuntimeConnectivityStatus;
  readonly saveState: MethodSaveState;
  readonly pendingWriteCount: number;
  /** Caller sets this true for the duration of refresh()/retryPending()/
   * discardPendingAndReloadServer() so the badge can show RECONNECTING
   * while that call is in flight. */
  readonly isReconciling: boolean;
  /** How long RECOVERED stays visible after a successful reconciliation
   * before falling back to SERVER/SAVED. Default 2500ms. */
  readonly recoveredDisplayMs?: number;
}

export interface UseAssessmentSaveIndicatorReturn {
  readonly state: AssessmentSaveIndicatorState;
}

export function useAssessmentSaveIndicator(
  options: UseAssessmentSaveIndicatorOptions
): UseAssessmentSaveIndicatorReturn {
  const { runtimeStatus, saveState, pendingWriteCount, isReconciling, recoveredDisplayMs = 2500 } = options;

  const [justRecovered, setJustRecovered] = useState(false);
  const wasReconcilingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  useEffect(() => {
    const wasReconciling = wasReconcilingRef.current;
    wasReconcilingRef.current = isReconciling;

    if (!wasReconciling || isReconciling) return;
    // A reconciliation attempt just finished. Only celebrate a clean landing
    // — a conflict or a still-nonzero queue means it did NOT actually
    // recover, so no RECOVERED flash (the CONFLICT/RECOVERY_DRAFT branch in
    // `deriveAssessmentSaveIndicator` already takes priority over this flag
    // regardless, but we also should not arm a timer for a failed attempt).
    if (runtimeStatus !== 'ready' || pendingWriteCount !== 0) return;

    setJustRecovered(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setJustRecovered(false), recoveredDisplayMs);
  }, [isReconciling, runtimeStatus, pendingWriteCount, recoveredDisplayMs]);

  const state = deriveAssessmentSaveIndicator({
    runtimeStatus,
    saveState,
    pendingWriteCount,
    isReconnecting: isReconciling,
    justRecovered,
  });

  return { state };
}

export default useAssessmentSaveIndicator;
