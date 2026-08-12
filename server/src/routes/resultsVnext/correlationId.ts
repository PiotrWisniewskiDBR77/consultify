/**
 * Shared correlation-id validation for every Results Next write route
 * (RN-G6 P0 fix — F1).
 *
 * ROOT CAUSE (confirmed in this session, reproduced end-to-end on a real
 * browser/backend/Postgres): `src/services/apiUtils.ts` used to mint
 * `Math.random().toString(36).substring(2, 15) + ...` as the
 * `X-Correlation-ID` header value — NOT a UUID. `apiLoggingMiddleware`
 * (`server/src/middleware/apiLogging.middleware.ts`, mounted globally in
 * `Gateway.ts`) attaches that header to `req.correlationId`, but its own
 * `sanitizeCorrelationId` only strips characters unsafe for the `api_logs`
 * text column (`/^[A-Za-z0-9._~-]+$/`) — it does NOT enforce UUID shape,
 * because that middleware has no reason to know some *other* downstream
 * column happens to be typed `UUID NOT NULL`. Every resultsVnext route had
 * its own copy of `getCorrelationId(req)` that trusted `req.correlationId`
 * (or the raw header) as-is once it was non-empty, so the malformed value
 * flowed unchanged into `PlatformEventEnvelope.correlationId`
 * (`services/resultsVnext/platform/eventEnvelope.ts`) and from there into
 * `rvn_platform_events.correlation_id` (`UUID NOT NULL`,
 * `server/migrations/20260809_rvn_platform_events_outbox.sql`) — Postgres
 * rejects it with "invalid input syntax for type uuid", surfaced to the
 * caller as an unhandled 500 on every KPI/ROI/OKR write (~124 call sites
 * across the six route files below).
 *
 * DEFENSE IN DEPTH — the client fix (`apiUtils.ts`) now only ever sends a
 * real UUID and discards any pre-existing, invalid `sessionStorage` value.
 * But this header arrives from OUTSIDE the app's control (any HTTP client,
 * proxy, or replay) and must never be trusted as-is server-side either. This
 * module is the ONE place that validates UUID shape for the whole
 * resultsVnext surface — every route imports `getCorrelationId` from here
 * instead of re-implementing the check (previously duplicated verbatim six
 * times: kpi/kpiDeviation/kpiPerspectives/kpiScorecard/roi/okr routes).
 *
 * An invalid or missing correlation id resolves to `undefined` here, not to
 * a locally-generated UUID — every resultsVnext command function already
 * does `correlationId ?? randomUUID()` right before building the event
 * envelope (see e.g. `kpiDefinitionCommands.ts`), so `undefined` is the
 * correct "let the existing fallback mint a fresh one" signal, and a single
 * malformed request is REJECTED (never inserted into the UUID column) and
 * SILENTLY REPLACED (the write still succeeds), matching the task's "waliduj
 * kształt UUID i odrzucaj albo zastępuj" requirement.
 */
import type { AuthenticatedRequest } from '../../types/index.js';

/** RFC 4122-shaped UUID (any version/variant nibble accepted — this is a
 * shape check for a DB `UUID` column, not a version-strictness check). */
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidCorrelationId(value: unknown): value is string {
  return typeof value === 'string' && UUID_SHAPE.test(value);
}

/**
 * Established repo convention (documents.routes.ts, conversations.routes.ts,
 * report-builder.routes.ts, ...): prefer a correlation id a prior middleware
 * already attached to the request, fall back to the client-supplied header.
 * Both are validated as UUID-shaped before being trusted — neither source is
 * guaranteed to be one (see module doc comment above).
 */
export function getCorrelationId(req: AuthenticatedRequest): string | undefined {
  const attached = (req as { correlationId?: unknown }).correlationId;
  if (isValidCorrelationId(attached)) return attached;

  const header = req.get?.('X-Correlation-ID');
  if (isValidCorrelationId(header)) return header;

  return undefined;
}
