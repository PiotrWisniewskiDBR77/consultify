/**
 * AP-04 — AutosaveScheduler: debounce/scheduling policy for autosave.
 *
 * Program: `docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md`
 * section 3 point 4 ("autosave"). ADR:
 * `docs/validation/finance-v3/generated/gate-d/AP-04_undo_autosave_conflicts_ADR.md`.
 *
 * Pure scheduling logic — no DB, no knowledge of `finance_working_revisions`.
 * Wraps an injected `flush` callback (in production, `autosaveService.
 * checkpointOperationStack`) with a debounce-with-max-wait policy: unit
 * testable with real short timers or `vi.useFakeTimers()`, no Postgres
 * needed, matching the task's "unit (OperationStack logika bez DB)" scope for
 * this collaboration layer.
 */

export interface AutosaveSchedulerOptions {
  /** Flush this long after the LAST edit, if no further edit arrives. */
  debounceMs?: number;
  /**
   * Hard cap: flush at most this long after the FIRST unflushed edit, even
   * under continuous typing. Without this, a `notifyEdit()` on every
   * keystroke could postpone the debounce timer indefinitely — exactly the
   * unbounded-accumulation risk AP-00 ADR section 10 point 3 flags for
   * `unsavedOperationStack`. `OperationStack`'s own `maxDepth` bounds entry
   * COUNT; `maxWaitMs` bounds TIME, independently.
   */
  maxWaitMs?: number;
}

export const DEFAULT_AUTOSAVE_DEBOUNCE_MS = 2_000;
export const DEFAULT_AUTOSAVE_MAX_WAIT_MS = 15_000;

export type FlushFn = () => Promise<void>;

export class AutosaveScheduler {
  private readonly debounceMs: number;
  private readonly maxWaitMs: number;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private maxWaitTimer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;
  private pendingRerun = false;
  private disposed = false;
  /** Count of completed flush() calls — test/observability hook. */
  private flushCount = 0;

  constructor(
    private readonly flush: FlushFn,
    options: AutosaveSchedulerOptions = {}
  ) {
    this.debounceMs = options.debounceMs ?? DEFAULT_AUTOSAVE_DEBOUNCE_MS;
    this.maxWaitMs = options.maxWaitMs ?? DEFAULT_AUTOSAVE_MAX_WAIT_MS;
    if (this.debounceMs <= 0 || this.maxWaitMs <= 0) {
      throw new Error('AutosaveScheduler: debounceMs and maxWaitMs must be positive');
    }
  }

  /** Call on every local edit (`OperationStack.push`). Idempotent to call repeatedly. */
  notifyEdit(): void {
    if (this.disposed) return;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => void this.trigger(), this.debounceMs);
    if (!this.maxWaitTimer) {
      this.maxWaitTimer = setTimeout(() => void this.trigger(), this.maxWaitMs);
    }
  }

  /** Explicit save, navigation-away, or beforeunload guard — bypasses the debounce window and flushes immediately. */
  async flushNow(): Promise<void> {
    this.clearTimers();
    await this.trigger();
  }

  isPending(): boolean {
    return this.debounceTimer !== null || this.maxWaitTimer !== null || this.flushing;
  }

  getFlushCount(): number {
    return this.flushCount;
  }

  dispose(): void {
    this.disposed = true;
    this.clearTimers();
  }

  private clearTimers(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.maxWaitTimer) {
      clearTimeout(this.maxWaitTimer);
      this.maxWaitTimer = null;
    }
  }

  /** Serializes concurrent triggers: if a flush is already running when another fires, coalesce into one re-run immediately after, rather than two overlapping DB writes racing each other. */
  private async trigger(): Promise<void> {
    this.clearTimers();
    if (this.flushing) {
      this.pendingRerun = true;
      return;
    }
    this.flushing = true;
    try {
      await this.flush();
      this.flushCount += 1;
    } finally {
      this.flushing = false;
      if (this.pendingRerun) {
        this.pendingRerun = false;
        await this.trigger();
      }
    }
  }
}
