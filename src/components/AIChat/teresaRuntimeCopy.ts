/**
 * Build a compact, admin-only diagnostic string from a stream error so the real
 * cause (HTTP status / error code / message) is visible in the chat instead of
 * being collapsed into the generic "temporarily unavailable" copy. Returns '' if
 * nothing useful can be extracted.
 */
export function formatTeresaAdminDiagnostic(err: unknown): string {
  const e = (err || {}) as Record<string, any>;
  const status =
    Number(e?.status ?? e?.statusCode ?? e?.httpStatus ?? e?.response?.status) || null;
  const code =
    typeof e?.code === 'string' && e.code.trim().length > 0 ? e.code.trim() : null;
  const message =
    typeof e?.message === 'string' && e.message.trim().length > 0
      ? e.message.trim().slice(0, 200)
      : null;
  const parts: string[] = [];
  if (status) parts.push(`HTTP ${status}`);
  if (code) parts.push(code);
  if (message) parts.push(message);
  return parts.join(' · ');
}

export function getTeresaStartFailureMessage(
  language?: string,
  adminDiagnostic?: string | null
): string {
  const base = String(language || 'en')
    .trim()
    .toLowerCase()
    .split('-')[0];
  const pl = base === 'pl';

  const main = pl
    ? '⚠️ Teresa jest chwilowo niedostepna. Sprobuj ponownie za chwile. Jesli problem wraca, rozpocznij nowa rozmowe lub odswiez widok.'
    : '⚠️ Teresa is temporarily unavailable. Please try again in a moment. If the problem persists, start a new chat or refresh the view.';

  const diag = String(adminDiagnostic || '').trim();
  if (!diag) return main;

  // Admin-only technical detail to speed up production diagnosis.
  const label = pl ? '🔧 Szczegoly (admin)' : '🔧 Details (admin)';
  const hint = pl
    ? 'Sprawdz /api/llm/health/detailed oraz logi serwera.'
    : 'Check /api/llm/health/detailed and server logs.';
  return `${main}\n\n${label}: ${diag}\n${hint}`;
}

export function getTeresaEmptyResponseMessage(language?: string): string {
  const base = String(language || 'en')
    .trim()
    .toLowerCase()
    .split('-')[0];

  if (base === 'pl') {
    return '⚠️ Teresa nie zwrocila pelnej odpowiedzi. Sprobuj ponownie za chwile.';
  }

  return '⚠️ Teresa did not return a complete answer. Please try again in a moment.';
}
