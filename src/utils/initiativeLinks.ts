/**
 * Initiative deep-link helpers (M13 flow redesign, 2026-07-02).
 *
 * SSOT for the canonical "initiative document" landing URL. Every creation
 * path (chat, insight handoff, tool conversion, manual wizard) should land
 * the user in the initiative DOCUMENT — not in a staging list — via these
 * helpers. The `/initiatives?open=<id>&mode=doc` deep link is consumed by
 * InitiativesHub (see the deep-link effect around `searchParams.get('open')`).
 */

export type InitiativeDocumentLinkOptions = {
  /** Optional extra query params to preserve (e.g. source attribution). */
  params?: Record<string, string>;
};

/** Canonical path that opens the full initiative document view. */
export function initiativeDocumentPath(
  initiativeId: string,
  options?: InitiativeDocumentLinkOptions
): string {
  const search = new URLSearchParams();
  search.set('open', String(initiativeId || '').trim());
  search.set('mode', 'doc');
  if (options?.params) {
    for (const [key, value] of Object.entries(options.params)) {
      if (key === 'open' || key === 'mode') continue;
      if (value != null && value !== '') search.set(key, value);
    }
  }
  return `/initiatives?${search.toString()}`;
}

export type HandoffLandingInput = {
  /** 'create' = a new DRAFT initiative was created; 'link' = linked to existing. */
  mode: 'create' | 'link';
  /** Initiative id returned by the handoff endpoint. */
  initiativeId?: string | null;
  /** Server-reported result type, when available. */
  resultType?: 'created' | 'linked' | string | null;
};

/**
 * Decide where the user should land right after an insight-finding handoff.
 *
 * Rule (owner acceptance 2026-06-29): creating a NEW initiative must open its
 * document immediately — the Interview staging list stays a source view, not
 * a landing place. Linking a finding to an EXISTING initiative keeps the user
 * in context (returns null → no navigation).
 */
export function getHandoffLandingPath(input: HandoffLandingInput): string | null {
  const id = String(input.initiativeId || '').trim();
  if (!id) return null;
  const created =
    input.mode === 'create' || String(input.resultType || '').toLowerCase() === 'created';
  if (!created) return null;
  return initiativeDocumentPath(id);
}
