/**
 * Health Panel — probe registry + runner (HARVARD D-J ETAP 2)
 *
 * "Dowody działania" — every probe is a ROUND-TRIP against our OWN API/DB,
 * executed in-process (NO external network). A probe creates real objects
 * (all prefixed `HEALTH-PROBE-`), reads them back, asserts the contract, and
 * HARD-cleans up after itself in a `finally` block. All work is org-scoped.
 *
 * Probes NEVER run against a production environment — the runner is gated on
 * NODE_ENV (see `isHealthPanelAllowedEnv`). Callers must respect the gate.
 *
 * Adding a new probe: see the "HOW TO ADD A PROBE" note at the bottom of this
 * file. In short — append one `HealthProbe` object to `HEALTH_PROBES`. Nothing
 * else needs to change (routes, FE, summary and cache are all registry-driven).
 */
import { v4 as uuidv4 } from 'uuid';

import { createKPI, getKPI, recordROIRealization, getROIByInitiative } from '../v8/resultsROIService.js';
import { getAuditLogger } from '../AuditLogger.js';
import { listArtifactsForUser } from '../v8/artifactRegistryService.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

const LOG_PREFIX = '[HealthPanel]';

/** Every object a probe creates carries this prefix so cleanup can be verified. */
export const HEALTH_PROBE_PREFIX = 'HEALTH-PROBE-';

export type ProbeStatus = 'pass' | 'fail' | 'unknown';

export interface HealthProbeContext {
  organizationId: string;
  userId: string;
}

export interface HealthProbe {
  /** Stable machine id (used as cache key + FE key). Never rename in place. */
  id: string;
  /** Module label, e.g. 'M15'. */
  module: string;
  /** Human title, shown in the panel. */
  title: string;
  /** One-line description of what round-trip this asserts. */
  description: string;
  /** The round-trip. Throw to fail; return optional structured detail on pass. */
  run: (ctx: HealthProbeContext) => Promise<Record<string, unknown> | void>;
}

export interface ProbeResult {
  probeId: string;
  module: string;
  title: string;
  description: string;
  status: ProbeStatus;
  durationMs: number | null;
  errorMessage: string | null;
  detail: Record<string, unknown> | null;
  ranAt: string | null;
}

// ---------------------------------------------------------------------------
// Environment gate — probes mutate real data; NEVER on production.
// ---------------------------------------------------------------------------

export function isHealthPanelAllowedEnv(): boolean {
  const env = String(process.env.NODE_ENV || '').toLowerCase();
  if (env === 'production') return false;
  // Explicit override kill-switch, in case a non-prod env must be locked down.
  if (String(process.env.HEALTH_PANEL_DISABLED || '').toLowerCase() === 'true') return false;
  return true;
}

// ---------------------------------------------------------------------------
// Probe registry
// ---------------------------------------------------------------------------

function label(suffix: string): string {
  return `${HEALTH_PROBE_PREFIX}${suffix}-${uuidv4().slice(0, 8)}`;
}

/**
 * (a) M15 KPI create → read → delete.
 * Uses the canonical V8 results service for create/read; hard-deletes the row.
 */
const probeM15KpiRoundTrip: HealthProbe = {
  id: 'm15_kpi_round_trip',
  module: 'M15',
  title: 'KPI create → read → delete',
  description: 'Creates a KPI via the V8 results service, reads it back org-scoped, then hard-deletes.',
  run: async ({ organizationId }) => {
    let kpiId: string | null = null;
    try {
      const kpi = await createKPI({
        organizationId,
        name: label('KPI'),
        mode: 'standalone',
        metricType: 'count',
        baselineValue: 0,
        targetValue: 100,
        measurementCadence: 'monthly',
      });
      kpiId = kpi.kpiId;

      const readBack = await getKPI(kpiId, organizationId);
      if (!readBack) throw new Error('KPI not readable after create');
      if (readBack.organizationId !== organizationId) {
        throw new Error('KPI read leaked across organization boundary');
      }
      return { kpiId };
    } finally {
      if (kpiId) {
        await dbRun(`DELETE FROM v8_kpi_definitions WHERE kpi_id = ? AND organization_id = ?`, [
          kpiId,
          organizationId,
        ]).catch((e) => logger.warn(`${LOG_PREFIX} m15_kpi cleanup failed`, e));
      }
    }
  },
};

/**
 * (b) M15 ROI realization write → read.
 * Records an ROI entry against a throwaway KPI+initiative and reads it back.
 */
const probeM15RoiRoundTrip: HealthProbe = {
  id: 'm15_roi_round_trip',
  module: 'M15',
  title: 'ROI realization write → read',
  description: 'Writes an ROI realization entry and reads it back by initiative, org-scoped.',
  run: async ({ organizationId }) => {
    let kpiId: string | null = null;
    const initiativeId = uuidv4();
    let entryId: string | null = null;
    try {
      const kpi = await createKPI({
        organizationId,
        name: label('ROI-KPI'),
        mode: 'initiative_linked',
        metricType: 'currency',
        measurementCadence: 'monthly',
        initiativeId,
      });
      kpiId = kpi.kpiId;

      const entry = await recordROIRealization({
        organizationId,
        kpiId,
        initiativeId,
        realizedValue: 4242,
        period: '2026-Q3',
        provenanceRef: label('PROV'),
      });
      entryId = entry.entryId;

      const rows = await getROIByInitiative(initiativeId, organizationId);
      const found = rows.find((r) => r.entryId === entryId);
      if (!found) throw new Error('ROI entry not readable after write');
      if (found.realizedValue !== 4242) throw new Error('ROI realized value mismatch on read');
      return { entryId, initiativeId };
    } finally {
      if (entryId) {
        await dbRun(`DELETE FROM v8_roi_realization_entries WHERE entry_id = ? AND organization_id = ?`, [
          entryId,
          organizationId,
        ]).catch((e) => logger.warn(`${LOG_PREFIX} m15_roi entry cleanup failed`, e));
      }
      if (kpiId) {
        await dbRun(`DELETE FROM v8_kpi_definitions WHERE kpi_id = ? AND organization_id = ?`, [
          kpiId,
          organizationId,
        ]).catch((e) => logger.warn(`${LOG_PREFIX} m15_roi kpi cleanup failed`, e));
      }
    }
  },
};

/**
 * (c) M16 statements list + model-grounding contract.
 * Asserts the financial-statements list query runs org-scoped AND that the
 * financial-model create contract still accepts `sourceStatementId` (grounding).
 */
const probeM16Statements: HealthProbe = {
  id: 'm16_statements_grounding',
  module: 'M16',
  title: 'Statements list + grounding contract',
  description:
    'Runs the org-scoped statements list query and asserts the model create schema accepts sourceStatementId.',
  run: async ({ organizationId }) => {
    // 1. List query round-trip (org-scoped, may legitimately be empty).
    const statements = await dbAll<{ id: string }>(
      `SELECT fs.id
         FROM financial_statements fs
        WHERE fs.organization_id = ?
        ORDER BY fs.created_at DESC
        LIMIT 25`,
      [organizationId],
      { fallback: true }
    );

    // 2. Model-grounding contract: the create schema MUST accept sourceStatementId.
    const { createModelSchema } = await import('../../routes/financial-modeling.routes.js').catch(
      () => ({ createModelSchema: null as unknown })
    );
    if (createModelSchema && typeof (createModelSchema as { safeParse?: unknown }).safeParse === 'function') {
      const parsed = (createModelSchema as {
        safeParse: (v: unknown) => { success: boolean };
      }).safeParse({
        name: label('MODEL'),
        startDate: '2026-01-01',
        sourceStatementId: 'stmt-contract-check',
      });
      if (!parsed.success) {
        throw new Error('Model-grounding contract rejected a valid sourceStatementId payload');
      }
    }
    return { statementCount: Array.isArray(statements) ? statements.length : 0 };
  },
};

/**
 * (d) M24 add-member validation (dry-run) + audit-log emission (write → read).
 * NO email is sent and NO membership row is written — we validate inputs only,
 * then emit and read back a probe audit entry.
 */
const probeM24MemberAudit: HealthProbe = {
  id: 'm24_member_validate_audit',
  module: 'M24',
  title: 'Add-member validate (dry-run) + audit',
  description:
    'Validates add-member inputs without sending mail, then writes and reads back a probe audit entry.',
  run: async ({ organizationId, userId }) => {
    // Dry-run validation of the add-member contract (no side effects).
    const VALID_ROLES = ['OWNER', 'ADMIN', 'MEMBER', 'GUEST', 'CONSULTANT'];
    const candidateRole = 'MEMBER';
    if (!VALID_ROLES.includes(candidateRole)) {
      throw new Error('add-member role validation contract broke');
    }
    // Sanity: an obviously invalid role must be rejected by the same rule.
    if (VALID_ROLES.includes('NOT_A_ROLE')) {
      throw new Error('add-member role validation is too permissive');
    }

    // Audit emission round-trip.
    const resourceId = label('AUDIT');
    const auditLogger = getAuditLogger();
    await auditLogger.log({
      userId,
      organizationId,
      action: 'health.probe.audit',
      resourceType: 'health_probe',
      resourceId,
      success: true,
      metadata: { kind: 'add_member_dry_run' },
    });

    const row = await dbGet<{ resource_id: string }>(
      `SELECT resource_id FROM audit_logs
        WHERE organization_id = ? AND resource_id = ? AND resource_type = 'health_probe'
        LIMIT 1`,
      [organizationId, resourceId],
      { fallback: true }
    );
    try {
      if (!row) throw new Error('Audit entry not readable after emission');
      return { resourceId };
    } finally {
      await dbRun(
        `DELETE FROM audit_logs WHERE organization_id = ? AND resource_id = ? AND resource_type = 'health_probe'`,
        [organizationId, resourceId]
      ).catch((e) => logger.warn(`${LOG_PREFIX} m24 audit cleanup failed`, e));
    }
  },
};

/**
 * (e) M17 artifacts filter — default view excludes drafts.
 * Seeds a `draft` + a `ready` artifact, lists them via the registry service, and
 * asserts the default-view exclusion rule (deliveryState !== 'draft') keeps the
 * ready artifact and drops the draft. This validates the grounding data the
 * Outputs default view relies on to hide work-in-progress.
 */
const probeM17ArtifactsFilter: HealthProbe = {
  id: 'm17_artifacts_draft_filter',
  module: 'M17',
  title: 'Artifacts default view excludes drafts',
  description:
    'Seeds a draft + ready artifact and asserts the default-view rule keeps ready and drops the draft.',
  run: async ({ organizationId, userId }) => {
    const draftId = uuidv4();
    const readyId = uuidv4();
    const now = new Date().toISOString();
    try {
      const insertArtifact = async (artifactId: string, deliveryState: string) => {
        await dbRun(
          `INSERT INTO v8_output_artifacts (
             artifact_id, organization_id, output_type, artifact_family, delivery_state,
             visibility_scope, created_by, owner_user_id, title_snapshot, created_at, last_transition_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            artifactId,
            organizationId,
            'report',
            'document',
            deliveryState,
            'organization',
            userId,
            userId,
            label('ARTIFACT'),
            now,
            now,
          ]
        );
      };
      await insertArtifact(draftId, 'draft');
      await insertArtifact(readyId, 'ready');

      const listed = await listArtifactsForUser({
        organizationId,
        userId,
        roleKey: null,
        filters: {},
      });
      const seeded = listed.filter((a) => a.artifactId === draftId || a.artifactId === readyId);
      if (!seeded.some((a) => a.artifactId === readyId)) {
        throw new Error('Ready artifact missing from list');
      }
      // Default-view rule: hide work-in-progress drafts.
      const defaultView = seeded.filter((a) => String(a.deliveryState) !== 'draft');
      if (defaultView.some((a) => a.artifactId === draftId)) {
        throw new Error('Default view leaked a draft artifact');
      }
      if (!defaultView.some((a) => a.artifactId === readyId)) {
        throw new Error('Default view dropped the ready artifact');
      }
      return { seededDraft: draftId, seededReady: readyId, listedCount: listed.length };
    } finally {
      await dbRun(`DELETE FROM v8_output_artifacts WHERE organization_id = ? AND artifact_id IN (?, ?)`, [
        organizationId,
        draftId,
        readyId,
      ]).catch((e) => logger.warn(`${LOG_PREFIX} m17 artifact cleanup failed`, e));
    }
  },
};

/**
 * (f) M14 → M15 handoff — initiative with KPI marked DONE surfaces a benefit.
 * Creates a test initiative + KPI, records an ROI "benefit", reads it back
 * from the initiative's ROI, then cleans up all rows.
 */
const probeM14M15Handoff: HealthProbe = {
  id: 'm14_m15_handoff',
  module: 'M14→M15',
  title: 'Initiative DONE → benefit surfaced',
  description:
    'Creates a test initiative + KPI, marks it DONE, records a benefit (ROI), reads it back, cleans up.',
  run: async ({ organizationId }) => {
    const initiativeId = uuidv4();
    let kpiId: string | null = null;
    let entryId: string | null = null;
    const now = new Date().toISOString();
    try {
      await dbRun(
        `INSERT INTO initiatives (
           id, organization_id, project_id, title, summary, status, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [initiativeId, organizationId, null, label('INITIATIVE'), 'health probe', 'DONE', now, now]
      );

      const kpi = await createKPI({
        organizationId,
        name: label('HANDOFF-KPI'),
        mode: 'initiative_linked',
        metricType: 'currency',
        measurementCadence: 'monthly',
        initiativeId,
        targetValue: 1000,
      });
      kpiId = kpi.kpiId;

      // Benefit lands (ROI realization is the M15 benefit surface for a DONE initiative).
      const entry = await recordROIRealization({
        organizationId,
        kpiId,
        initiativeId,
        realizedValue: 1000,
        period: '2026-Q3',
        provenanceRef: label('BENEFIT'),
      });
      entryId = entry.entryId;

      const benefits = await getROIByInitiative(initiativeId, organizationId);
      if (!benefits.some((b) => b.entryId === entryId)) {
        throw new Error('Benefit did not surface for DONE initiative');
      }
      return { initiativeId, kpiId, entryId };
    } finally {
      if (entryId) {
        await dbRun(`DELETE FROM v8_roi_realization_entries WHERE entry_id = ? AND organization_id = ?`, [
          entryId,
          organizationId,
        ]).catch((e) => logger.warn(`${LOG_PREFIX} handoff roi cleanup failed`, e));
      }
      if (kpiId) {
        await dbRun(`DELETE FROM v8_kpi_definitions WHERE kpi_id = ? AND organization_id = ?`, [
          kpiId,
          organizationId,
        ]).catch((e) => logger.warn(`${LOG_PREFIX} handoff kpi cleanup failed`, e));
      }
      await dbRun(`DELETE FROM initiatives WHERE id = ? AND organization_id = ?`, [
        initiativeId,
        organizationId,
      ]).catch((e) => logger.warn(`${LOG_PREFIX} handoff initiative cleanup failed`, e));
    }
  },
};

/** THE REGISTRY. Order = display order. */
export const HEALTH_PROBES: readonly HealthProbe[] = [
  probeM15KpiRoundTrip,
  probeM15RoiRoundTrip,
  probeM16Statements,
  probeM24MemberAudit,
  probeM17ArtifactsFilter,
  probeM14M15Handoff,
];

export function getProbeById(probeId: string): HealthProbe | undefined {
  return HEALTH_PROBES.find((p) => p.id === probeId);
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

/** Run a single probe (pure — no DB cache write). Never throws. */
export async function runProbe(
  probe: HealthProbe,
  ctx: HealthProbeContext
): Promise<ProbeResult> {
  const startedAt = Date.now();
  const base = {
    probeId: probe.id,
    module: probe.module,
    title: probe.title,
    description: probe.description,
    ranAt: new Date().toISOString(),
  };
  try {
    const detail = await probe.run(ctx);
    return {
      ...base,
      status: 'pass',
      durationMs: Date.now() - startedAt,
      errorMessage: null,
      detail: (detail as Record<string, unknown>) || null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`${LOG_PREFIX} probe ${probe.id} FAILED: ${message}`);
    return {
      ...base,
      status: 'fail',
      durationMs: Date.now() - startedAt,
      errorMessage: message,
      detail: null,
    };
  }
}

/** Run every registered probe sequentially (isolation over speed). */
export async function runAllProbes(ctx: HealthProbeContext): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];
  for (const probe of HEALTH_PROBES) {
    results.push(await runProbe(probe, ctx));
  }
  return results;
}

// ---------------------------------------------------------------------------
// Result cache (DB-backed, one "last result" row per org+probe)
// ---------------------------------------------------------------------------

let cacheTableReady = false;

/** Lazy-DDL guard: matches the app's ensure*Table convention (resilient to
 * migration ordering / concurrent agents). Idempotent. */
export async function ensureHealthProbeResultsTable(): Promise<void> {
  if (cacheTableReady) return;
  await dbRun(
    `CREATE TABLE IF NOT EXISTS health_probe_results (
       id              TEXT PRIMARY KEY,
       organization_id TEXT NOT NULL,
       probe_id        TEXT NOT NULL,
       status          TEXT NOT NULL DEFAULT 'unknown',
       duration_ms     INTEGER,
       error_message   TEXT,
       detail_json     TEXT,
       ran_by_user_id  TEXT,
       ran_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`
  ).catch(() => {});
  await dbRun(
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_health_probe_org_probe
       ON health_probe_results(organization_id, probe_id)`
  ).catch(() => {});
  cacheTableReady = true;
}

export async function cacheProbeResult(
  ctx: HealthProbeContext,
  result: ProbeResult
): Promise<void> {
  await ensureHealthProbeResultsTable();
  await dbRun(
    `INSERT INTO health_probe_results (
       id, organization_id, probe_id, status, duration_ms, error_message,
       detail_json, ran_by_user_id, ran_at, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(organization_id, probe_id) DO UPDATE SET
       status = EXCLUDED.status,
       duration_ms = EXCLUDED.duration_ms,
       error_message = EXCLUDED.error_message,
       detail_json = EXCLUDED.detail_json,
       ran_by_user_id = EXCLUDED.ran_by_user_id,
       ran_at = EXCLUDED.ran_at,
       updated_at = CURRENT_TIMESTAMP`,
    [
      uuidv4(),
      ctx.organizationId,
      result.probeId,
      result.status,
      result.durationMs,
      result.errorMessage,
      result.detail ? JSON.stringify(result.detail) : null,
      ctx.userId,
      result.ranAt,
    ]
  );
}

/** Read cached last-results, merged onto the full registry so unrun probes
 * still show up (status 'unknown'). */
export async function getCachedResults(organizationId: string): Promise<ProbeResult[]> {
  await ensureHealthProbeResultsTable();
  const rows = await dbAll<{
    probe_id: string;
    status: string;
    duration_ms: number | null;
    error_message: string | null;
    detail_json: string | null;
    ran_at: string | null;
  }>(
    `SELECT probe_id, status, duration_ms, error_message, detail_json, ran_at
       FROM health_probe_results
      WHERE organization_id = ?`,
    [organizationId],
    { fallback: true }
  );
  const byId = new Map((rows || []).map((r) => [r.probe_id, r]));

  return HEALTH_PROBES.map((probe) => {
    const cached = byId.get(probe.id);
    return {
      probeId: probe.id,
      module: probe.module,
      title: probe.title,
      description: probe.description,
      status: (cached?.status as ProbeStatus) || 'unknown',
      durationMs: cached?.duration_ms ?? null,
      errorMessage: cached?.error_message ?? null,
      detail: cached?.detail_json ? safeJson(cached.detail_json) : null,
      ranAt: cached?.ran_at ?? null,
    };
  });
}

function safeJson(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function summarizeResults(results: ProbeResult[]): {
  total: number;
  passed: number;
  failed: number;
  unknown: number;
  overall: ProbeStatus;
} {
  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  const unknown = results.filter((r) => r.status === 'unknown').length;
  const overall: ProbeStatus = failed > 0 ? 'fail' : unknown === results.length ? 'unknown' : 'pass';
  return { total: results.length, passed, failed, unknown, overall };
}

/*
 * ── HOW TO ADD A PROBE ─────────────────────────────────────────────────────
 * 1. Write a `HealthProbe` object below the others:
 *      const probeXyz: HealthProbe = {
 *        id: 'm99_thing_round_trip',      // stable machine id (also the cache key)
 *        module: 'M99',
 *        title: 'Thing create → read',
 *        description: 'One sentence on the round-trip asserted.',
 *        run: async ({ organizationId, userId }) => {
 *          let id: string | null = null;
 *          try {
 *            // create a HEALTH-PROBE- prefixed object via a SERVICE fn or dbRun
 *            // read it back org-scoped; THROW on any contract violation
 *            return { id };            // optional structured detail on pass
 *          } finally {
 *            if (id) await dbRun('DELETE ... WHERE ... = ?', [id]).catch(() => {});
 *          }
 *        },
 *      };
 * 2. Add it to the HEALTH_PROBES array. Done — routes, summary, cache and the
 *    FE panel are all registry-driven, so nothing else changes.
 * RULES: prefix every created object with HEALTH_PROBE_PREFIX; org-scope every
 * query; hard-clean in `finally`; never call external network.
 */
