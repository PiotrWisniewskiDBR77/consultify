/**
 * Bound an async operation to a maximum duration, rejecting with an explicit
 * message instead of letting the caller await forever.
 *
 * Added by A14 (2026-08-13) as a defensive backstop around the database
 * readiness sequence (schema verification → Table Platform migrations →
 * seeding): those steps run real SQL against a possibly slow or locked
 * database, and prior to this the only failure mode index.ts handled was a
 * *rejected* promise — anything that just never settled left `/api/ready`
 * reporting `{"status":"not_ready","error":null}` forever, indistinguishable
 * from "still starting up".
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    // Don't let this timer alone keep the process (or a test runner) alive.
    if (typeof (timer as unknown as { unref?: () => void }).unref === 'function') {
      (timer as unknown as { unref: () => void }).unref();
    }
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}
