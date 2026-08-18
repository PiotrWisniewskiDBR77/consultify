/**
 * Admin IAM queue alert evaluator.
 *
 * Satisfies AMD-OBSERVABILITY-INTERNAL-GATE-002 (internal, exercised alert with a
 * linked runbook, a positive-control activation, and a verified recovery/clear
 * event) for the `admin_iam_jobs` queue described in
 * docs/runbooks/ADMIN_IAM_OPERATIONS_RUNBOOK.md. External paging/deployment is
 * explicitly out of scope — this only produces durable, internally-consumable
 * alert state + an outbox row that a delivery worker can later pick up.
 *
 * WHY NO MIGRATION: this evaluator writes directly to the existing
 * `operational_alert_tenant_states` and `operational_alert_delivery_outbox`
 * tables (see server/migrations/20260931_operational_alert_signal_delivery.sql).
 * Both tables declare `kind TEXT NOT NULL` with NO `CHECK` constraint, so a new
 * `AdminIamAlertKind` value can be stored without a schema change. This
 * deliberately does NOT touch `operational_alert_signals` — that table's `kind`
 * column has a `CHECK (kind IN ('WRITE_FAILURE_RATE', ...))` closed to the four
 * pre-existing operational-alert kinds, so writing an admin-IAM kind there would
 * violate the constraint. The admin-IAM condition is computed directly from
 * `admin_iam_jobs` on every evaluation instead of being fed through the
 * signals ledger, which is why there is no signal-insert step here.
 *
 * WHY A DISJOINT LOCK NAMESPACE: `evaluateOperationalAlertWindows` (in
 * operationalAlertSignalDeliveryService.ts) takes `pg_advisory_xact_lock(hashtext(
 * 'ops-eval:<org>:<kind>'))` for its own four kinds. This evaluator locks on
 * `adm-iam-alert-eval:<org>:<kind>` instead — a different string prefix, so
 * `hashtext()` cannot collide with the existing evaluator's lock keys, letting
 * both evaluators run concurrently for the same organization without blocking
 * each other or racing on the same advisory-lock slot.
 *
 * RUNBOOK ANCHOR: `ADMIN_IAM_ALERT_RUNBOOK_ID` points at the "Retry and incident
 * handling" section of docs/runbooks/ADMIN_IAM_OPERATIONS_RUNBOOK.md, which is
 * the section documenting these exact alert conditions (a growing `running`
 * count past the lease interval, or any `failed` count) and the response steps.
 *
 * SECRETS — deliberately EXCLUDED from the outbox payload: this evaluator never
 * reads or forwards `admin_iam_jobs.payload_json` (the job's business payload),
 * `admin_iam_jobs.last_error` (may contain upstream error detail per the
 * runbook's own "confirm the last error contains no secret before sharing it"
 * warning), or `admin_iam_jobs.lease_token` (a bearer-style fencing credential).
 * The measurement queries below only ever SELECT a `count(*)`, never the job
 * rows themselves, so those columns never even enter process memory here. The
 * outbox payload is built from a fixed, closed field list (see
 * `buildAlertPayload` below) and is additionally passed through `safePayload`,
 * a duplicate of the `safeMetadata`/`SECRET_KEY` guard from
 * operationalAlertSignalDeliveryService.ts, as defense in depth.
 */
import { type PgTransactionClient, withPgTransaction } from '../utils/queryHelpers.js';

export type AdminIamAlertKind = 'ADMIN_IAM_JOB_STALE' | 'ADMIN_IAM_JOB_FAILED';

export type AdminIamAlertStatus = 'INACTIVE' | 'ACTIVE' | 'RECOVERED';

export const ADMIN_IAM_ALERT_RUNBOOK_ID = 'ADMIN_IAM_OPERATIONS_RUNBOOK#queue-alert-conditions';

/**
 * Both conditions fire on "greater than zero" (docs/runbooks/ADMIN_IAM_OPERATIONS_RUNBOOK.md:22-23:
 * "A growing `running` count past the lease interval or any `failed` count is an
 * alert condition."). Exported so callers/tests reference this instead of
 * duplicating the magic number.
 */
export const ADMIN_IAM_ALERT_THRESHOLDS: Record<AdminIamAlertKind, number> = {
  ADMIN_IAM_JOB_STALE: 0,
  ADMIN_IAM_JOB_FAILED: 0,
};

// Duplicated from operationalAlertSignalDeliveryService.ts (~lines 5-6, 20-27). Neither
// SAFE_ID/required nor SECRET_KEY/safeMetadata are exported from that module — it keeps
// them module-private — so this evaluator cannot import them and instead replicates the
// exact same regex and 512-char rule verbatim, to preserve the identical id-validation
// and secret-rejection discipline the rest of this codebase relies on.
const SAFE_ID = /^[A-Za-z0-9._:@/-]{1,160}$/;
const SECRET_KEY = /(authorization|cookie|password|secret|token|api.?key)/i;

function required(value: string, code: string): string {
  const normalized = value?.trim();
  if (!SAFE_ID.test(normalized)) throw new Error(code);
  return normalized;
}

/** Duplicate of safeMetadata() from operationalAlertSignalDeliveryService.ts — see note above. */
function safePayload(input: Record<string, unknown>): Record<string, unknown> {
  for (const [key, value] of Object.entries(input)) {
    if (SECRET_KEY.test(key) || (typeof value === 'string' && value.length > 512)) {
      throw new Error('ADM_IAM_ALERT_PAYLOAD_UNSAFE');
    }
  }
  return input;
}

type AdminIamAlertTransition = 'DETECTED' | 'RECOVERED';

interface AdminIamAlertResult {
  kind: AdminIamAlertKind;
  status: AdminIamAlertStatus;
  version: number;
  latestValue: number;
  threshold: number;
}

/**
 * Counts the condition for one alert kind as of `now` (an explicit, threaded
 * timestamp — never `Date.now()`/`now()` inline — so a test can freeze time and
 * get a deterministic stale/not-stale boundary).
 */
async function measure(
  tx: PgTransactionClient,
  organizationId: string,
  kind: AdminIamAlertKind,
  now: string
): Promise<number> {
  if (kind === 'ADMIN_IAM_JOB_STALE') {
    const result = await tx.query<{ cnt: number }>(
      `SELECT count(*)::int AS cnt FROM admin_iam_jobs
         WHERE organization_id=? AND status='running' AND lease_expires_at < ?::timestamptz`,
      [organizationId, now]
    );
    return Number(result.rows[0]?.cnt ?? 0);
  }
  const result = await tx.query<{ cnt: number }>(
    `SELECT count(*)::int AS cnt FROM admin_iam_jobs WHERE organization_id=? AND status='failed'`,
    [organizationId]
  );
  return Number(result.rows[0]?.cnt ?? 0);
}

function buildAlertPayload(input: {
  organizationId: string;
  kind: AdminIamAlertKind;
  transition: AdminIamAlertTransition;
  stateVersion: number;
  latestValue: number;
  threshold: number;
  evaluatorId: string;
  now: string;
}): Record<string, unknown> {
  const base = {
    version: 1,
    organizationId: input.organizationId,
    kind: input.kind,
    transition: input.transition,
    stateVersion: input.stateVersion,
    latestValue: input.latestValue,
    threshold: input.threshold,
    evaluatorId: input.evaluatorId,
    runbookId: ADMIN_IAM_ALERT_RUNBOOK_ID,
    ...(input.transition === 'DETECTED' ? { detectedAt: input.now } : { recoveredAt: input.now }),
  };
  return safePayload(base);
}

/**
 * Evaluates both admin-IAM queue alert conditions for one organization,
 * transactionally, mirroring the DETECTED/RECOVERED state+outbox pattern of
 * `evaluateOperationalAlertWindows` in operationalAlertSignalDeliveryService.ts
 * (~lines 105-136): per-kind advisory lock, `FOR UPDATE` read of the current
 * tenant state, a monotonically increasing `version` bumped only on an actual
 * status transition, and an outbox insert keyed by the table's own
 * `UNIQUE (organization_id, kind, transition, state_version)` constraint so a
 * replayed evaluation for an unchanged condition is a no-op: no second DETECTED
 * row, no version bump.
 */
export async function evaluateAdminIamQueueAlerts(params: {
  organizationId: string;
  evaluatorId: string;
  now?: string;
}): Promise<AdminIamAlertResult[]> {
  const organizationId = required(params.organizationId, 'ADM_IAM_ALERT_ORGANIZATION_INVALID');
  const evaluatorId = required(params.evaluatorId, 'ADM_IAM_ALERT_EVALUATOR_ID_INVALID');
  const now = params.now ?? new Date().toISOString();

  return withPgTransaction(async (tx) => {
    const output: AdminIamAlertResult[] = [];

    for (const kind of Object.keys(ADMIN_IAM_ALERT_THRESHOLDS) as AdminIamAlertKind[]) {
      // Disjoint from operationalAlertSignalDeliveryService.ts's `ops-eval:` namespace —
      // see file header. Held for the rest of this transaction (xact-scoped lock).
      await tx.query(`SELECT pg_advisory_xact_lock(hashtext(?))`, [`adm-iam-alert-eval:${organizationId}:${kind}`]);

      const threshold = ADMIN_IAM_ALERT_THRESHOLDS[kind];
      const latestValue = await measure(tx, organizationId, kind, now);
      const active = latestValue > threshold;

      const selected = await tx.query<{ status: AdminIamAlertStatus; version: number }>(
        `SELECT status, version FROM operational_alert_tenant_states WHERE organization_id=? AND kind=? FOR UPDATE`,
        [organizationId, kind]
      );
      const existing = selected.rows[0];
      const wasActive = existing?.status === 'ACTIVE';
      const transition: AdminIamAlertTransition | null =
        active && !wasActive ? 'DETECTED' : !active && wasActive ? 'RECOVERED' : null;
      const nextStatus: AdminIamAlertStatus = active
        ? 'ACTIVE'
        : transition === 'RECOVERED'
          ? 'RECOVERED'
          : (existing?.status ?? 'INACTIVE');
      const version = transition ? Number(existing?.version ?? 0) + 1 : Number(existing?.version ?? 0);
      const correlationId = `adm-iam-alert-eval:${organizationId}:${kind}:${new Date(now).toISOString()}`;

      const state = await tx.query<{ status: AdminIamAlertStatus; version: number }>(
        `INSERT INTO operational_alert_tenant_states
           (organization_id,kind,status,detected_at,recovered_at,latest_value,threshold,correlation_id,evaluator_id,version,updated_at)
         VALUES(?,?,?,CASE WHEN ?='DETECTED' THEN ?::timestamptz END,CASE WHEN ?='RECOVERED' THEN ?::timestamptz END,?,?,?,?,?,?::timestamptz)
         ON CONFLICT(organization_id,kind) DO UPDATE SET status=excluded.status,
           detected_at=CASE WHEN ?='DETECTED' THEN ?::timestamptz ELSE operational_alert_tenant_states.detected_at END,
           recovered_at=CASE WHEN ?='RECOVERED' THEN ?::timestamptz WHEN ?='DETECTED' THEN NULL ELSE operational_alert_tenant_states.recovered_at END,
           latest_value=excluded.latest_value,threshold=excluded.threshold,correlation_id=excluded.correlation_id,evaluator_id=excluded.evaluator_id,version=excluded.version,updated_at=excluded.updated_at
         RETURNING status, version`,
        [
          organizationId, kind, nextStatus,
          transition, now,
          transition, now,
          latestValue, threshold, correlationId, evaluatorId, version, now,
          transition, now,
          transition, now, transition,
        ]
      );

      if (transition) {
        const payload = buildAlertPayload({
          organizationId,
          kind,
          transition,
          stateVersion: version,
          latestValue,
          threshold,
          evaluatorId,
          now,
        });
        await tx.query(
          `INSERT INTO operational_alert_delivery_outbox
             (organization_id,kind,transition,state_version,correlation_id,payload_json)
           VALUES(?,?,?,?,?,?::jsonb) ON CONFLICT DO NOTHING`,
          [organizationId, kind, transition, version, correlationId, JSON.stringify(payload)]
        );
      }

      output.push({
        kind,
        status: state.rows[0].status,
        version: Number(state.rows[0].version),
        latestValue,
        threshold,
      });
    }

    return output;
  });
}
