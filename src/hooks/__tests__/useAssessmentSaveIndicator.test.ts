/**
 * useAssessmentSaveIndicator — pure derivation + transient-timer coverage
 * (S3, 2026-08-13).
 *
 * Part 1 exercises `deriveAssessmentSaveIndicator` directly: no React, no
 * timers — every one of the eight product states, reached through the exact
 * `MethodSaveState` × runtime-connectivity-status combination documented in
 * the hook's own header.
 *
 * Part 2 exercises the `useAssessmentSaveIndicator` hook's RECONNECTING /
 * RECOVERED transient behaviour with fake timers — this is UI-layer-only
 * timing, not a new persisted state, so it is safe to test with
 * `renderHook` + `vi.useFakeTimers()` rather than a live component tree.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ASSESSMENT_SAVE_INDICATOR_STATES,
  deriveAssessmentSaveIndicator,
  useAssessmentSaveIndicator,
} from '../useAssessmentSaveIndicator';

describe('deriveAssessmentSaveIndicator — the eight-state mapping table', () => {
  it('SERVER: kernel CLEAN, runtime ready, nothing dirty/queued/reconciling', () => {
    expect(
      deriveAssessmentSaveIndicator({
        runtimeStatus: 'ready',
        saveState: 'CLEAN',
        pendingWriteCount: 0,
        isReconnecting: false,
        justRecovered: false,
      })
    ).toBe('SERVER');
  });

  it('SAVING: kernel SAVING while online', () => {
    expect(
      deriveAssessmentSaveIndicator({
        runtimeStatus: 'ready',
        saveState: 'SAVING',
        pendingWriteCount: 0,
        isReconnecting: false,
        justRecovered: false,
      })
    ).toBe('SAVING');
  });

  it('SAVED: kernel SAVED, runtime ready', () => {
    expect(
      deriveAssessmentSaveIndicator({
        runtimeStatus: 'ready',
        saveState: 'SAVED',
        pendingWriteCount: 0,
        isReconnecting: false,
        justRecovered: false,
      })
    ).toBe('SAVED');
  });

  it('OFFLINE: connectivity lost, no unsaved local draft yet (scenario: "utrata API w trakcie pracy")', () => {
    expect(
      deriveAssessmentSaveIndicator({
        runtimeStatus: 'offline',
        saveState: 'CLEAN',
        pendingWriteCount: 0,
        isReconnecting: false,
        justRecovered: false,
      })
    ).toBe('OFFLINE');
  });

  it('RECOVERY_DRAFT: a local edit made WHILE offline (scenario: "zmiana lokalna przy braku łączności")', () => {
    expect(
      deriveAssessmentSaveIndicator({
        runtimeStatus: 'offline',
        saveState: 'DIRTY',
        pendingWriteCount: 0,
        isReconnecting: false,
        justRecovered: false,
      })
    ).toBe('RECOVERY_DRAFT');
  });

  it('RECOVERY_DRAFT: runtime "recovery" — a queued write is not yet reconciled, never treated as source of truth', () => {
    expect(
      deriveAssessmentSaveIndicator({
        runtimeStatus: 'recovery',
        saveState: 'CLEAN',
        pendingWriteCount: 2,
        isReconnecting: false,
        justRecovered: false,
      })
    ).toBe('RECOVERY_DRAFT');
  });

  it('RECOVERY_DRAFT: kernel OFFLINE_PENDING is itself an unsaved-draft signal, independent of runtime status', () => {
    expect(
      deriveAssessmentSaveIndicator({
        runtimeStatus: 'ready',
        saveState: 'OFFLINE_PENDING',
        pendingWriteCount: 0,
        isReconnecting: false,
        justRecovered: false,
      })
    ).toBe('RECOVERY_DRAFT');
  });

  it('RECOVERY_DRAFT: a non-conflict SAVE_FAILED is folded in — never silently reported as SAVED/SERVER', () => {
    expect(
      deriveAssessmentSaveIndicator({
        runtimeStatus: 'ready',
        saveState: 'SAVE_FAILED',
        pendingWriteCount: 0,
        isReconnecting: false,
        justRecovered: false,
      })
    ).toBe('RECOVERY_DRAFT');
  });

  it('CONFLICT: local revision older than the server\'s (409 version_conflict) — never silently overwritten', () => {
    expect(
      deriveAssessmentSaveIndicator({
        runtimeStatus: 'conflict',
        saveState: 'SAVE_FAILED',
        pendingWriteCount: 0,
        isReconnecting: false,
        justRecovered: false,
      })
    ).toBe('CONFLICT');
  });

  it('CONFLICT wins over a reconciliation-in-flight flag — discovering a conflict mid-retry must interrupt RECONNECTING', () => {
    expect(
      deriveAssessmentSaveIndicator({
        runtimeStatus: 'conflict',
        saveState: 'SAVE_FAILED',
        pendingWriteCount: 0,
        isReconnecting: true,
        justRecovered: false,
      })
    ).toBe('CONFLICT');
  });

  it('RECONNECTING: an explicit reconciliation call is in flight', () => {
    expect(
      deriveAssessmentSaveIndicator({
        runtimeStatus: 'recovery',
        saveState: 'CLEAN',
        pendingWriteCount: 3,
        isReconnecting: true,
        justRecovered: false,
      })
    ).toBe('RECONNECTING');
  });

  it('RECOVERED: reconciliation just succeeded, shown before settling back to SERVER', () => {
    expect(
      deriveAssessmentSaveIndicator({
        runtimeStatus: 'ready',
        saveState: 'CLEAN',
        pendingWriteCount: 0,
        isReconnecting: false,
        justRecovered: true,
      })
    ).toBe('RECOVERED');
  });

  it('all eight declared states are reachable — every entry in ASSESSMENT_SAVE_INDICATOR_STATES has a covering case above', () => {
    expect(ASSESSMENT_SAVE_INDICATOR_STATES).toEqual([
      'SERVER',
      'SAVING',
      'SAVED',
      'OFFLINE',
      'RECOVERY_DRAFT',
      'CONFLICT',
      'RECONNECTING',
      'RECOVERED',
    ]);
  });
});

describe('useAssessmentSaveIndicator — RECONNECTING -> RECOVERED transient timing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reopen after a restart: the hook never claims RECOVERED on its own — only a caller-driven reconciliation earns it', () => {
    // "reopen po kolejnym restarcie — serwer wygrywa": a fresh mount with no
    // reconciliation ever having been in flight must render SERVER/whatever
    // the runtime says, never a phantom RECOVERED celebration.
    const { result } = renderHook(() =>
      useAssessmentSaveIndicator({
        runtimeStatus: 'ready',
        saveState: 'CLEAN',
        pendingWriteCount: 0,
        isReconciling: false,
      })
    );
    expect(result.current.state).toBe('SERVER');
  });

  it('shows RECONNECTING while isReconciling is true, then RECOVERED once it flips back with a clean landing', () => {
    const { result, rerender } = renderHook(
      (props: { isReconciling: boolean; runtimeStatus: 'ready' | 'recovery'; pendingWriteCount: number }) =>
        useAssessmentSaveIndicator({
          runtimeStatus: props.runtimeStatus,
          saveState: 'CLEAN',
          pendingWriteCount: props.pendingWriteCount,
          isReconciling: props.isReconciling,
        }),
      { initialProps: { isReconciling: false, runtimeStatus: 'recovery', pendingWriteCount: 2 } }
    );
    expect(result.current.state).toBe('RECOVERY_DRAFT');

    // Reconciliation starts (user clicked "apply pending" / "retry").
    rerender({ isReconciling: true, runtimeStatus: 'recovery', pendingWriteCount: 2 });
    expect(result.current.state).toBe('RECONNECTING');

    // Reconciliation succeeds: runtime settles to ready, queue drains to 0.
    rerender({ isReconciling: false, runtimeStatus: 'ready', pendingWriteCount: 0 });
    expect(result.current.state).toBe('RECOVERED');

    // After the display window, it settles back to SERVER — not stuck.
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(result.current.state).toBe('SERVER');
  });

  it('does NOT show RECOVERED when the reconciliation attempt lands back in conflict — CONFLICT must win instead', () => {
    const { result, rerender } = renderHook(
      (props: { isReconciling: boolean; runtimeStatus: 'ready' | 'recovery' | 'conflict'; pendingWriteCount: number }) =>
        useAssessmentSaveIndicator({
          runtimeStatus: props.runtimeStatus,
          saveState: 'SAVE_FAILED',
          pendingWriteCount: props.pendingWriteCount,
          isReconciling: props.isReconciling,
        }),
      { initialProps: { isReconciling: false, runtimeStatus: 'recovery', pendingWriteCount: 1 } }
    );

    rerender({ isReconciling: true, runtimeStatus: 'recovery', pendingWriteCount: 1 });
    expect(result.current.state).toBe('RECONNECTING');

    // The retry surfaced a 409 instead of succeeding.
    rerender({ isReconciling: false, runtimeStatus: 'conflict', pendingWriteCount: 1 });
    expect(result.current.state).toBe('CONFLICT');

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    // Still CONFLICT — no RECOVERED flash was ever armed for a failed landing.
    expect(result.current.state).toBe('CONFLICT');
  });

  it('does NOT show RECOVERED when the queue is still non-empty after the attempt (partial retry)', () => {
    const { result, rerender } = renderHook(
      (props: { isReconciling: boolean; pendingWriteCount: number }) =>
        useAssessmentSaveIndicator({
          runtimeStatus: 'recovery',
          saveState: 'CLEAN',
          pendingWriteCount: props.pendingWriteCount,
          isReconciling: props.isReconciling,
        }),
      { initialProps: { isReconciling: false, pendingWriteCount: 3 } }
    );

    rerender({ isReconciling: true, pendingWriteCount: 3 });
    expect(result.current.state).toBe('RECONNECTING');

    // Still offline for the remaining items — 1 of 3 succeeded, still recovery.
    rerender({ isReconciling: false, pendingWriteCount: 2 });
    expect(result.current.state).toBe('RECOVERY_DRAFT');
  });

  it('respects a custom recoveredDisplayMs window', () => {
    const { result, rerender } = renderHook(
      (props: { isReconciling: boolean; runtimeStatus: 'ready' | 'offline'; pendingWriteCount: number }) =>
        useAssessmentSaveIndicator({
          runtimeStatus: props.runtimeStatus,
          saveState: 'CLEAN',
          pendingWriteCount: props.pendingWriteCount,
          isReconciling: props.isReconciling,
          recoveredDisplayMs: 500,
        }),
      { initialProps: { isReconciling: false, runtimeStatus: 'offline', pendingWriteCount: 0 } }
    );

    rerender({ isReconciling: true, runtimeStatus: 'offline', pendingWriteCount: 0 });
    rerender({ isReconciling: false, runtimeStatus: 'ready', pendingWriteCount: 0 });
    expect(result.current.state).toBe('RECOVERED');

    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(result.current.state).toBe('RECOVERED');

    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(result.current.state).toBe('SERVER');
  });
});
