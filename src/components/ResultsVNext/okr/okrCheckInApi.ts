/**
 * RN-G2 §G #25 — OKR Check-in API client (OKR-E004).
 *
 * Server source of truth:
 *  - `server/src/services/resultsVnext/okr/okrCheckInTypes.ts` (`OkrCheckIn`, `toOkrCheckIn`)
 *  - `server/src/services/resultsVnext/okr/okrCheckInSuggestionService.ts` (`suggestNextCheckInValue`)
 *  - `server/src/validators/resultsVnextOkr.validators.ts` L511-570
 *  - `server/src/routes/resultsVnext/okr.routes.ts` L1723-1895
 *
 * ── REAL, CONFIRMED GAP — no way to discover a valid `cadenceOccurrenceId` ──
 * `RecordOkrCheckInSchema` (`resultsVnextOkr.validators.ts` L535-552)
 * requires `cadenceOccurrenceId: z.string().uuid()` — REQUIRED, not
 * optional. That id names a row in `okr_vnext_checkin_occurrences`
 * (`okrCheckInScheduler.ts` L77-78, L215), a table this epic's scheduler
 * seeds server-side (obligation/cadence generation) — but grepping the FULL
 * `okr.routes.ts` (2998 lines) for `checkin_occurrences`/`occurrences` finds
 * ZERO routes that list or expose them. There is no `GET
 * .../key-results/:id/due-check-in` or similar. This is a genuine backend
 * gap, not a client oversight — confirmed by reading the scheduler, the
 * repository, and every route in the file.
 *
 * Per CLAUDE.md ("Nigdy nie wymyślaj... wartości domenowej, której nie
 * definiuje... realny kod serwera"), this client does NOT fabricate, guess,
 * or silently generate a `cadenceOccurrenceId` (e.g. `crypto.randomUUID()`
 * would produce a value the server will happily accept as a NEW occurrence
 * with no real cadence backing it — worse than an honest block, because it
 * would silently corrupt the append-only check-in history with occurrences
 * that don't correspond to any real scheduled cadence). `recordCheckIn`
 * below still takes `cadenceOccurrenceId` as a required, literal input — the
 * UI layer (`OkrCheckInRecordDialog.tsx`) exposes it as a manually-entered
 * field with a persistent, honest explanation of this exact gap, mirroring
 * `RoiCaseCreateModal.tsx`'s own "read-only by design, not an oversight"
 * precedent for a field with no real picker source. Flagged for the next
 * package: either the scheduler needs a `GET` route, or `recordCheckIn`
 * needs a variant that resolves "the KR's current due occurrence" itself.
 */
import { API_URL, getHeaders } from '@/services/api';

// ==========================================
// Enums (mirror okrCheckInTypes.ts CHECK constraints)
// ==========================================

export const OKR_CHECKIN_STATUS_VALUES = [
  'not_started',
  'on_track',
  'at_risk',
  'off_track',
  'achieved',
  'not_achieved',
  'cancelled',
] as const;
export type OkrCheckInStatus = (typeof OKR_CHECKIN_STATUS_VALUES)[number];

export const OKR_CHECKIN_CONFIDENCE_VALUES = ['high', 'medium', 'low', 'numeric'] as const;
export type OkrCheckInConfidence = (typeof OKR_CHECKIN_CONFIDENCE_VALUES)[number];

// ==========================================
// DTO — camelCase 1:1 with `toOkrCheckIn`
// ==========================================

export interface OkrCheckInDto {
  checkInId: string;
  organizationId: string;
  keyResultId: string;
  objectiveId: string;
  setId: string;
  cadenceOccurrenceId: string;
  previousValue: string | null;
  newValue: string | null;
  /**
   * `NUMERIC NULL` on the wire, computed once at submission time
   * (`calculateKeyResultProgress`, `okrCheckInCommands.ts` L456-465) and
   * frozen on this row forever (append-only, never recomputed later). UNLIKE
   * the KR's own `progress`/`progressCalcReason` pair, `okr_vnext_checkins`
   * has NO `calculated_progress_reason` column
   * (`okrCheckInTypes.ts` L39-61 — confirmed by reading the full row
   * interface) — the engine's `reason` string is computed at insert time
   * (`okrCheckInCommands.ts` L456) but simply discarded, only
   * `progressCalc.progress` is persisted (L471). So `calculatedProgress` on
   * a check-in is a genuinely 2-way domain on the wire (real value or
   * `null`) — the SAME limitation OQ-UI-C already documented for the Set's
   * `overallProgress`, but for a DIFFERENT, independently-confirmed reason
   * (Set: the reason is never computed for a rollup persisted this way;
   * Check-in: the reason IS computed but the column to store it doesn't
   * exist). Never render this as `'not_calculable'` — there is no reason
   * string to attach to that chip.
   */
  calculatedProgress: string | null;
  ownerDeclaredStatus: OkrCheckInStatus | null;
  systemSuggestedStatus: OkrCheckInStatus | null;
  confidence: OkrCheckInConfidence | null;
  confidenceNumericValue: string | null;
  note: string;
  blocker: string | null;
  supportRequested: string | null;
  evidenceRefs: unknown[];
  correctionOfCheckInId: string | null;
  correctionReason: string | null;
  submittedBy: string;
  submittedAt: string;
}

// ==========================================
// Fetch plumbing — same shape as `okrObjectiveApi.ts`.
// ==========================================

export class OkrCheckInApiError extends Error {
  status: number;
  code?: string;
  details?: Record<string, unknown>;
  constructor(message: string, status: number, code?: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'OkrCheckInApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function getJson<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const query = params
    ? Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  const url = `${API_URL}${path}${query ? `?${query}` : ''}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: getHeaders() });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new OkrCheckInApiError(`Network error contacting ${url}: ${msg}`, 0);
  }
  if (!res.ok) {
    let body: { error?: string; code?: string } = {};
    try {
      body = await res.json();
    } catch {
      // non-JSON error body — fall through with generic message
    }
    throw new OkrCheckInApiError(body.error || `Request failed (${res.status})`, res.status, body.code);
  }
  return res.json() as Promise<T>;
}

async function mutateJson<T>(method: 'POST', path: string, body: unknown): Promise<T> {
  const url = `${API_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, { method, headers: getHeaders(), body: JSON.stringify(body) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new OkrCheckInApiError(`Network error contacting ${url}: ${msg}`, 0);
  }
  let parsed: Record<string, unknown> = {};
  try {
    parsed = await res.json();
  } catch {
    // non-JSON body — fall through
  }
  if (!res.ok) {
    const { error, code, ...details } = parsed as { error?: string; code?: string; [k: string]: unknown };
    throw new OkrCheckInApiError(
      (typeof error === 'string' && error) || `Request failed (${res.status})`,
      res.status,
      typeof code === 'string' ? code : undefined,
      Object.keys(details).length > 0 ? details : undefined
    );
  }
  return parsed as T;
}

export function newOkrCheckInIdempotencyKey(): string {
  return crypto.randomUUID();
}

// ==========================================
// GET /api/vnext/results/okr/key-results/:keyResultId/check-ins — listCheckIns
// (`okr.routes.ts` L1731-1757, query = `ListOkrCheckInsQuerySchema`)
// ==========================================

export async function listCheckIns(keyResultId: string, currentOnly = true): Promise<OkrCheckInDto[]> {
  const { checkIns } = await getJson<{ checkIns: OkrCheckInDto[] }>(
    `/vnext/results/okr/key-results/${encodeURIComponent(keyResultId)}/check-ins`,
    { currentOnly }
  );
  return checkIns;
}

// ==========================================
// POST /api/vnext/results/okr/key-results/:keyResultId/check-ins — recordCheckIn
// (`okr.routes.ts` L1763-1808, body = `RecordOkrCheckInSchema`)
//
// Server-side gates NOT pre-validated here (server 409s honestly, message
// shown verbatim — never pre-guessed client-side):
//  - KR must not be `'cancelled'` (`okrCheckInCommands.ts` L433-439,
//    `KEY_RESULT_CANCELLED`)
//  - the OWNING Set must be `status === 'active'`
//    (`okrCheckInCommands.ts` L441-446, `SET_NOT_ACTIVE`) — the OPPOSITE
//    lifecycle window from Objective/KR content edits, which require
//    `draft`/`changes_requested` (see `okrObjectiveApi.ts` header). This is
//    a real, deliberate asymmetry: you plan Objectives/KRs while the Set is
//    a draft, then check in against them only once the Set is active.
// ==========================================

export interface RecordOkrCheckInInput {
  cadenceOccurrenceId: string;
  newValue: number | null;
  ownerDeclaredStatus?: OkrCheckInStatus | null;
  confidence?: OkrCheckInConfidence | null;
  confidenceNumericValue?: number | null;
  note: string;
  blocker?: string | null;
  supportRequested?: string | null;
  reason?: string | null;
  idempotencyKey: string;
}

export interface RecordOkrCheckInResponse {
  outcome: 'applied' | 'duplicate';
  checkIn: OkrCheckInDto;
}

export async function recordCheckIn(keyResultId: string, input: RecordOkrCheckInInput): Promise<RecordOkrCheckInResponse> {
  return mutateJson<RecordOkrCheckInResponse>(
    'POST',
    `/vnext/results/okr/key-results/${encodeURIComponent(keyResultId)}/check-ins`,
    input
  );
}

// ==========================================
// POST .../key-results/:keyResultId/check-ins/:checkinId/correct — correctCheckIn
// (`okr.routes.ts` L1814-1860, body = `CorrectOkrCheckInSchema`) — append-only
// correction (creates a NEW row pointing back at the original via
// `correctionOfCheckInId`), same "correction, never a mutation in place"
// pattern as `kpi/measurements/:id/corrections`. NOT gated on Set status
// (confirmed by reading `correctCheckIn` — `okrCheckInCommands.ts` L692-703
// loads the Set row but never checks `status !== 'active'` the way
// `recordCheckIn` does) — a genuine, real asymmetry: a correction to a
// past check-in is allowed regardless of the Set's current lifecycle phase.
// ==========================================

export interface CorrectOkrCheckInInput {
  newValue?: number | null;
  ownerDeclaredStatus?: OkrCheckInStatus | null;
  confidence?: OkrCheckInConfidence | null;
  confidenceNumericValue?: number | null;
  correctionReason: string;
  idempotencyKey: string;
}

export interface CorrectOkrCheckInResponse {
  outcome: 'applied' | 'duplicate';
  original: OkrCheckInDto;
  checkIn: OkrCheckInDto;
}

export async function correctCheckIn(
  keyResultId: string,
  checkInId: string,
  input: CorrectOkrCheckInInput
): Promise<CorrectOkrCheckInResponse> {
  return mutateJson<CorrectOkrCheckInResponse>(
    'POST',
    `/vnext/results/okr/key-results/${encodeURIComponent(keyResultId)}/check-ins/${encodeURIComponent(checkInId)}/correct`,
    input
  );
}

// ==========================================
// GET .../key-results/:keyResultId/suggested-next-check-in-value
// (`okr.routes.ts` L1875-1895 — calls
// `suggestNextCheckInValue(priorCheckIns, keyResult)` directly, PURE/DB-free,
// `okrCheckInSuggestionService.ts`)
//
// `basis` is a 3-value union (`'linear_trend' | 'no_history' |
// 'not_calculable'`) but the REAL implementation only ever returns the
// first two (read in full: `suggestNextCheckInValue` has exactly two return
// paths, `no_history` for <2 numeric prior check-ins and `linear_trend`
// otherwise — `not_calculable` is declared in the type for
// forward-compatibility/exhaustiveness but is DEAD on this exact function,
// same "declared-but-unreachable" shape as OQ-UI-C's Set-level finding).
// This client surfaces whichever `basis`/`reason` the server actually sends
// — never computes its own trend.
// ==========================================

export type OkrSuggestNextCheckInBasis = 'linear_trend' | 'no_history' | 'not_calculable';

export interface OkrSuggestNextCheckInValue {
  suggestedValue: number | null;
  basis: OkrSuggestNextCheckInBasis;
  reason: string;
}

export async function suggestNextCheckInValue(keyResultId: string): Promise<OkrSuggestNextCheckInValue> {
  const { suggestion } = await getJson<{ suggestion: OkrSuggestNextCheckInValue }>(
    `/vnext/results/okr/key-results/${encodeURIComponent(keyResultId)}/suggested-next-check-in-value`
  );
  return suggestion;
}
