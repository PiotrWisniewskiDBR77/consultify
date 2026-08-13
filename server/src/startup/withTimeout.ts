/**
 * Bound an async operation to a maximum duration, rejecting with an explicit
 * `TimeoutError` instead of letting the caller await forever.
 *
 * Added by A14 (2026-08-13) as a defensive backstop around the database
 * readiness sequence (schema verification → Table Platform migrations →
 * seeding): those steps run real SQL against a possibly slow or locked
 * database, and prior to this the only failure mode index.ts handled was a
 * *rejected* promise — anything that just never settled left `/api/ready`
 * reporting `{"status":"not_ready","error":null}` forever, indistinguishable
 * from "still starting up".
 *
 * P0A (2026-08-13) — HONEST SEMANTICS, READ BEFORE CHANGING CALLERS:
 *
 * ★ THIS IS NOT REAL CANCELLATION. `withTimeout` wraps an arbitrary
 * `Promise<T>` that was already created and is already running by the time
 * this function receives it (a `Promise` in JS has no "don't start yet"
 * state). When the deadline fires, this function REJECTS ITS OWN wrapper
 * promise — it does not, and structurally cannot, stop whatever produced
 * `promise` from continuing to run. Concretely, for the one real caller
 * today (`establishDatabaseReadiness()` in index.ts, wrapping
 * `runMigrations()`/`seedTemplates()` SQL against `pg`): after a timeout, the
 * migration/seed queries already in flight keep executing against the
 * database in the background. There is no cancellation token threaded
 * through `migrationRunner.ts`/`TemplateService.ts`/the `pg` pool to abort
 * them, and wiring true query cancellation (Postgres `pg_cancel_backend()`
 * over a second connection, or an `AbortSignal` plumbed through every layer)
 * is a real architectural change out of scope here. This is a DOCUMENTED
 * LIMITATION, not an oversight — do not describe this function as
 * "cancelling" or "aborting" the operation in logs, comments, or docs.
 *
 * What this function DOES guarantee:
 *  1. The caller gets an explicit, typed rejection (`TimeoutError`) at
 *     exactly `ms`, never an unbounded hang.
 *  2. The background operation's eventual outcome (success OR failure) is
 *     read exactly once, right here, and then silently discarded — it is
 *     never exposed to the caller of `withTimeout`. Concretely: the `.then`
 *     handler below still runs when `promise` finally settles after the
 *     timeout already fired, but by then this wrapper promise has already
 *     rejected and settled promises can only settle once, so that late
 *     settlement is a no-op from the caller's perspective. This is what
 *     stops a slow-but-eventually-successful migration run from
 *     retroactively flipping a timed-out boot back to "ready" — see
 *     index.ts's outer catch block, which unconditionally sets
 *     `dbReady = false` and `tpMigrationStatus = { state: 'failed', ... }`
 *     on ANY rejection from this function, timeout or otherwise, and never
 *     re-reads the original `promise`.
 *  3. The timer itself is `unref()`'d so a fired-but-pending timeout can't
 *     keep the process (or a test runner) alive on its own.
 *
 * Net effect for the one real caller: on timeout, `/api/ready` and
 * `/api/health/migrations` report `failed`/`not_ready` immediately and stay
 * that way — the process never presents itself as ready based on a
 * background result it stopped listening for. The underlying SQL may still
 * complete (or fail) later, invisibly; that is the accepted tradeoff of not
 * having true cancellation, not a "looks cancelled" pretense.
 */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      reject(new TimeoutError(message));
    }, ms);
    // Don't let this timer alone keep the process (or a test runner) alive.
    if (typeof (timer as unknown as { unref?: () => void }).unref === 'function') {
      (timer as unknown as { unref: () => void }).unref();
    }
    promise.then(
      (value) => {
        clearTimeout(timer);
        // If the timeout already fired, this wrapper promise is already
        // rejected/settled — `resolve` here is a documented no-op (a Promise
        // executor's resolve/reject after the first call does nothing). We
        // still land here every time so the underlying promise's rejection
        // path below also always runs and never becomes an unhandled
        // rejection — see the class doc above.
        if (!settled) resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        if (!settled) reject(err);
      }
    );
  });
}
