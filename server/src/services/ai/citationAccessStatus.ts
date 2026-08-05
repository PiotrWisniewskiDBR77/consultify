/**
 * Citation Access Status — M01-P04B (GF-CHAT-08, source failure honesty).
 *
 * Maps the existing runtime citation verification report
 * (`runtimeCitationVerification.ts` → `citationVerifier.verify`) to the small,
 * SAFE-BY-CONSTRUCTION per-citation status the UI is allowed to see.
 *
 * WHY a dedicated module instead of inlining this in `ai.routes.ts`:
 * `VerificationResult` (see `citationVerifier.ts`) only ever carries
 * `{citationId, status, confidence, reason, sourceExists}` — no title, no
 * excerpt, no URL. Routing every caller through `buildCitationStatusPayload`
 * below (instead of hand-rolling the SSE payload inline) makes that guarantee
 * mechanical: there is no field in the output type that COULD carry a title,
 * so a future edit cannot silently start leaking one. This is the property the
 * M01-P04B negative control (b) exercises: "test ACL źródła MUSI padać, gdy
 * tytuł niedostępnego dokumentu trafi do odpowiedzi" — see
 * `citationAccessStatus.test.ts`.
 */

export type CitationAccessStatus = 'ready' | 'stale' | 'failed' | 'no_access';

export interface CitationStatusUpdate {
  id: string;
  status: CitationAccessStatus;
}

/**
 * `citationVerifier`'s taxonomy → the UI taxonomy the packet's evidence
 * states require (`ready` / `failed` / `stale` / `no_access`).
 *   - verified  → ready      (source resolved, exists, caller has access)
 *   - partial   → stale      (system doc reference recognized but unlinked,
 *                             or a plausible-but-unconfirmed URL — treat as
 *                             "may be outdated", not a hard failure)
 *   - unverified→ stale      (no resolvable source id — insufficient signal
 *                             to call it broken, but not confidently fresh
 *                             either)
 *   - broken    → failed     (source does not exist / invalid — the
 *                             citation cannot be honored)
 *   - no_access → no_access  (M01-006 — source EXISTS but its
 *                             `organization_id` does not match the
 *                             requesting caller's; see
 *                             `citationVerifier.ts#checkAccess`. Distinct
 *                             from `failed` so the UI can say "not
 *                             accessible to you" instead of "doesn't
 *                             exist" — `ChatCitation.status` and
 *                             `CitationList.getSafeCitationView` already
 *                             supported this value; the server never
 *                             produced it before this fix.)
 */
export function mapVerificationStatusToAccessStatus(
  status: 'verified' | 'unverified' | 'broken' | 'partial' | 'no_access' | string
): CitationAccessStatus {
  switch (status) {
    case 'verified':
      return 'ready';
    case 'partial':
    case 'unverified':
      return 'stale';
    case 'broken':
      return 'failed';
    case 'no_access':
      return 'no_access';
    default:
      return 'stale';
  }
}

/**
 * Builds the SSE-safe status delta from a verification report. Intentionally
 * accepts only the narrow shape it needs (not the full `VerificationReport`)
 * so nothing besides `citationId`/`status` can pass through, even if the
 * report type grows title/content fields later.
 */
export function buildCitationStatusPayload(
  report: { results?: Array<{ citationId: string; status: string }> } | null | undefined
): CitationStatusUpdate[] {
  if (!report || !Array.isArray(report.results)) return [];
  const out: CitationStatusUpdate[] = [];
  for (const r of report.results) {
    const id = String(r?.citationId || '').trim();
    if (!id) continue;
    out.push({ id, status: mapVerificationStatusToAccessStatus(r.status) });
  }
  return out;
}
