/**
 * Generic in-process retry-with-backoff for best-effort, idempotent side
 * effects (registry writes, etc.) that must never fail the primary
 * operation but were previously attempted only ONCE and silently dropped on
 * failure.
 *
 * Context (rejestr, fala sprzątania 1b, 2026-07-27): documentStudioService's
 * document materialization path (`server/src/routes/document-studio.routes.ts`
 * `registerGeneratedDocumentOrigin`) and the Excel/Arkusz workbook path
 * (`server/src/routes/workbook.routes.ts`) both register the freshly created
 * artifact in the Outputs registry via a single `try { await ... } catch {
 * logger.warn(...) }` — one transient DB hiccup and the artifact silently
 * never appears in the Outputs Library / Template Library until the next
 * `ensureBackfilledOutputsForOrg` reconciliation pass picks it up (which can
 * be much later, or never, for orgs that stop generating new content).
 * `registerArtifactOrigin` / `registerOutputArtifactTransactional` are both
 * idempotent (they look up the existing origin link before inserting — see
 * the 2026-07-26 race-recovery fix in `artifactRegistryService.ts`), so
 * re-invoking them after a transient failure is always safe.
 *
 * This helper only shrinks the failure window (a real per-artifact retry
 * marker / durable queue is out of scope here) — `ensureBackfilledOutputsForOrg`
 * remains the actual safety net for whatever still slips through after all
 * attempts are exhausted.
 */

export interface RetryWithBackoffOptions {
  /** Total attempts (including the first), default 3. */
  attempts?: number;
  /** Linear backoff base in ms — attempt N waits `baseDelayMs * N`. Default 150ms. */
  baseDelayMs?: number;
  /** Called after each FAILED attempt (not the final exhaustion) — the caller decides how to log it. */
  onAttemptFailed?: (attempt: number, attempts: number, err: unknown) => void;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryWithBackoffOptions = {}
): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 3);
  const baseDelayMs = options.baseDelayMs ?? 150;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      options.onAttemptFailed?.(attempt, attempts, err);
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * attempt));
      }
    }
  }
  throw lastErr;
}
