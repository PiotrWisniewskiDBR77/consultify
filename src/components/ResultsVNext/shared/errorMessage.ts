/**
 * RN-G5 polish — ONE place that turns a caught, unknown error into a
 * translatable, user-facing message for every ResultsVNext screen.
 *
 * THE BUG THIS FIXES: every `*ApiError` class in this domain
 * (`LegacyArchiveApiError`, `RoiApiError`, `OkrApiError`,
 * `OkrAdminApiError`, `OkrCheckInApiError`, `OkrObjectiveApiError`,
 * `OkrWorkspaceApiError` — each declared next to its own small `fetch`
 * client, e.g. `legacy/legacyArchiveApi.ts`) constructs `.message` as
 * `body.error || 'Request failed (${status})'` — i.e. the RAW backend
 * error string, always in the backend's language (English) regardless of
 * the app's current locale, and occasionally a driver/DB-level string that
 * was never meant for an end user. The old call-site pattern
 * `err instanceof Error ? err.message : String(err)` rendered that string
 * straight into a PL or EN screen unfiltered. This helper replaces the
 * screen-facing half of that: the raw detail still reaches telemetry via
 * `console.error` (so debugging an incident is unaffected), but the
 * SCREEN only ever gets a fixed, translated, honest sentence.
 *
 * SECURITY CLAUSE (D06, `RowActionsMenu.tsx`'s own comment, 2026-08-11): a
 * refusal caused by an access/security rule must stay GENERIC — it must
 * not confirm or deny that a locked object exists, and must not repeat
 * backend detail. `status === 401 | 403` is treated as exactly that: the
 * same generic "access restricted" copy every time, independent of
 * whatever the backend actually said.
 *
 * NOT for every error surface in this domain: `ResultsVNextForbiddenState`
 * (deep-link ABAC denial, a structured `{ reason, detail }` payload, not a
 * thrown `Error`) and `KpiDeviationCaseSubview`'s workflow/maker-checker
 * rejection copy (`deviationErrorDetail` — a SERVER-AUTHORED business rule
 * message like "NOT_PLAN_REQUIRED", deliberately shown verbatim per that
 * file's own header comment, distinct from an ABAC visibility denial) are
 * untouched by this helper; both already carry their own, more specific
 * translated/verbatim copy and were not the "raw stack-ish backend string"
 * bug this closes.
 */
export function toUserFacingErrorMessage(err: unknown, isPolish: boolean): string {
  // Telemetry keeps the real detail; the screen never does.
  // eslint-disable-next-line no-console
  console.error('[ResultsVNext] request failed:', err);

  const status = (err as { status?: unknown } | null | undefined)?.status;

  if (status === 401 || status === 403) {
    return isPolish
      ? 'Dostęp ograniczony — nie masz uprawnień do tej operacji.'
      : 'Access restricted — you do not have permission for this action.';
  }

  const isNetworkError = err instanceof TypeError || status === 0;
  if (isNetworkError) {
    return isPolish
      ? 'Brak połączenia z serwerem. Sprawdź sieć i spróbuj ponownie.'
      : 'Could not reach the server. Check your connection and try again.';
  }

  return isPolish
    ? 'Nie udało się wykonać tej operacji. Spróbuj ponownie.'
    : 'Something went wrong completing this action. Please try again.';
}

export default toUserFacingErrorMessage;
