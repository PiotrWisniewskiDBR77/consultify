/**
 * Module 10 (Wywiad — Interview) — kill-switch for the "Pending review" (④
 * Dopuszczenie) top-level tab.
 *
 * Decision D-04 (Harvard/wdrozenie-100/M10-wywiad.md, D-04 → "udokumentować gate
 * + ukryć"): the pending-review stage is FULLY built end-to-end —
 *   - tab type + resolver (`InterviewHub.tsx` `InterviewTab` union, `isInterviewTab`),
 *   - the `pendingReviewInsights` selector (`insights` filtered to `in_review`),
 *   - a complete render branch (`activeTab === 'pending_review'`: empty state +
 *     list of in-review insights with findings / cross-perspective / divergence
 *     counts + click-through to the insight viewer).
 * Only the TAB BUTTON was hidden ("intentionally hidden before client delivery").
 * Rather than leave that as a bare comment, this flag formalizes the gate: the
 * machinery stays wired and the stage is surfaceable for review/QA, but it is
 * OFF by default so client-facing prod (VTS wave 2) is unchanged.
 *
 * This is a SEPARATE flag from any other module stub (do NOT import another).
 *
 * Where this flag gates
 * ---------------------
 *   - The `pending_review` entry in `InterviewHub` `tabs` useMemo. When OFF the
 *     tab is not pushed (identical to today's hidden behaviour); the ④ stage is
 *     still reachable via the Przydzielone tab's approve/send-back. When ON the
 *     dedicated ④ Dopuszczenie inbox tab appears.
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_interviewPendingReviewTab=0|1` — operator bypass for QA/staging.
 *   2. `localStorage["ff.interview_pending_review_tab"]` — user / org override.
 *   3. `import.meta.env.VITE_INTERVIEW_PENDING_REVIEW_TAB` — build-time default.
 *   4. Default: OFF. Flip ON only once the ④ inbox is signed off for client delivery.
 */

const LS_KEY = 'ff.interview_pending_review_tab';
const QUERY_KEY = 'ff_interviewPendingReviewTab';
const ENV_KEY = 'VITE_INTERVIEW_PENDING_REVIEW_TAB';

/** Stable flag keys (resolution order: query > localStorage > env > default OFF). */
export const INTERVIEW_PENDING_REVIEW_TAB_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

function readEnvFlag(): boolean {
  try {
    const parsed = parseFlag(
      (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.[ENV_KEY]
    );
    // Default OFF: a deliberately-hidden, not-yet-delivered stage.
    return parsed === null ? false : parsed;
  } catch {
    return false;
  }
}

function readQueryOverride(): boolean | null {
  try {
    if (typeof window === 'undefined' || !window.location?.search) return null;
    const params = new URLSearchParams(window.location.search);
    return parseFlag(params.get(QUERY_KEY));
  } catch {
    return null;
  }
}

function readLocalStorageOverride(): boolean | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return parseFlag(window.localStorage.getItem(LS_KEY));
  } catch {
    return null;
  }
}

/**
 * Whether the "Pending review" (④ Dopuszczenie) interview tab should be shown.
 * Default OFF (D-04). The underlying view + selectors render regardless when the
 * tab is selected — this flag only controls the tab's visibility/discoverability.
 */
export function isInterviewPendingReviewTabEnabled(): boolean {
  const queryOverride = readQueryOverride();
  if (queryOverride !== null) return queryOverride;

  const lsOverride = readLocalStorageOverride();
  if (lsOverride !== null) return lsOverride;

  return readEnvFlag();
}
