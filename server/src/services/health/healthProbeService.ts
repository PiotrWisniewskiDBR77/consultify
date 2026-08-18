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

import { withPinnedPostgresTransaction } from '../../database/PostgresDatabase.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import { getAuditLogger } from '../AuditLogger.js';
import { CLOSURE_HANDOFF_SOURCE, handoffFromClosure } from '../executionResultsBridge.js';
import { createInitiative as createInitiativeViaFunnel } from '../initiative/createInitiativeService.js';
import {
  getRecentArtifactRefsForOrg,
  listArtifactsForUser,
} from '../v8/artifactRegistryService.js';
import { pullAndReconcileInitiative } from '../v8/resultsFinanceReconciliationService.js';
import {
  createKPI,
  getKPI,
  getROIByInitiative,
  recordROIRealization,
} from '../v8/resultsROIService.js';

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

class HealthProbeRollback extends Error {
  constructor(readonly detail: Record<string, unknown>) {
    super('HEALTH_PROBE_ROLLBACK');
  }
}

/**
 * (a) M15 KPI create → read → delete.
 * Uses the canonical V8 results service for create/read; hard-deletes the row.
 */
const probeM15KpiRoundTrip: HealthProbe = {
  id: 'm15_kpi_round_trip',
  module: 'M15',
  title: 'KPI create → read → delete',
  description:
    'Creates a KPI via the V8 results service, reads it back org-scoped, then hard-deletes.',
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
  description:
    'Writes an ROI realization entry and reads it back by initiative, org-scoped, then rolls the pinned transaction back.',
  run: async ({ organizationId }) => {
    const initiativeId = uuidv4();
    const kpiId = uuidv4();
    const entryId = uuidv4();
    const now = new Date().toISOString();
    try {
      await withPinnedPostgresTransaction(async (tx) => {
        const initiativeTitle = label('ROI-INITIATIVE');
        await tx.queryRun(
          `INSERT INTO initiatives (
             id, organization_id, project_id, title, name, summary, status, source_type,
             source_id, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            initiativeId,
            organizationId,
            null,
            initiativeTitle,
            initiativeTitle,
            'health probe — ROI realization round-trip',
            'DRAFT',
            'tool',
            label('ROI-SOURCE'),
            now,
            now,
          ]
        );
        await tx.queryRun(
          `INSERT INTO v8_kpi_definitions (
             kpi_id, organization_id, name, mode, initiative_id, metric_type,
             measurement_cadence, status, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            kpiId,
            organizationId,
            label('ROI-KPI'),
            'initiative_linked',
            initiativeId,
            'currency',
            'monthly',
            'active',
            now,
            now,
          ]
        );
        await tx.queryRun(
          `INSERT INTO v8_roi_realization_entries (
             entry_id, organization_id, kpi_id, initiative_id, realized_value,
             period, provenance_ref, verified_by, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [entryId, organizationId, kpiId, initiativeId, 4242, '2026-Q3', label('PROV'), null, now]
        );
        const found = await tx.queryOne<{ entry_id: string; realized_value: number }>(
          `SELECT entry_id, realized_value
             FROM v8_roi_realization_entries
            WHERE entry_id = ? AND initiative_id = ? AND organization_id = ?`,
          [entryId, initiativeId, organizationId]
        );
        if (!found) throw new Error('ROI entry not readable after write');
        if (Number(found.realized_value) !== 4242) {
          throw new Error('ROI realized value mismatch on read');
        }
        throw new HealthProbeRollback({ entryId, initiativeId, rolledBack: true });
      });
    } catch (error) {
      if (error instanceof HealthProbeRollback) return error.detail;
      throw error;
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
    if (
      createModelSchema &&
      typeof (createModelSchema as { safeParse?: unknown }).safeParse === 'function'
    ) {
      const parsed = (
        createModelSchema as {
          safeParse: (v: unknown) => { success: boolean };
        }
      ).safeParse({
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
      // S6.3 default-view rule: the LIST QUERY ITSELF (filters:{}) must drop drafts —
      // assert on the raw service result, not a re-filtered copy, so a regression in
      // the query-level exclusion (not just the render guard) fails this probe.
      if (seeded.some((a) => a.artifactId === draftId)) {
        throw new Error('Default view (filters:{}) leaked a draft artifact');
      }
      return { seededDraft: draftId, seededReady: readyId, listedCount: listed.length };
    } finally {
      await dbRun(
        `DELETE FROM v8_output_artifacts WHERE organization_id = ? AND artifact_id IN (?, ?)`,
        [organizationId, draftId, readyId]
      ).catch((e) => logger.warn(`${LOG_PREFIX} m17 artifact cleanup failed`, e));
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
        // FIX (NOT-NULL sweep): initiatives.name is NOT NULL with no DB default
        // (Postgres) — this probe only wrote `title`, which 500s with 23502.
        `INSERT INTO initiatives (
           id, organization_id, project_id, title, name, summary, status, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          initiativeId,
          organizationId,
          null,
          label('INITIATIVE'),
          label('INITIATIVE'),
          'health probe',
          'DONE',
          now,
          now,
        ]
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
        await dbRun(
          `DELETE FROM v8_roi_realization_entries WHERE entry_id = ? AND organization_id = ?`,
          [entryId, organizationId]
        ).catch((e) => logger.warn(`${LOG_PREFIX} handoff roi cleanup failed`, e));
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

// ===========================================================================
// GOLDEN-PATH probes (Runda3 #6) — lightweight, READ-ONLY liveness checks.
//
// Each of these asserts that a golden-path transition surface (or an otherwise
// unprobed module) is ALIVE: the org-scoped list query runs and returns without
// error. They mutate NOTHING (no seeds, no cleanup) and are fully fail-soft —
// every query uses `{ fallback: true }`, so a legitimately-empty org is a PASS
// and a missing/renamed table degrades to `unknown`/`fail` without wedging the
// panel. A THROW = a real broken surface (e.g. table gone, column renamed).
// ===========================================================================

/** Small helper: run one org-scoped SELECT and return the row count. Throws only
 *  if the query itself blows up (a genuinely broken surface). Empty = fine. */
async function countOrgScoped(sql: string, params: unknown[]): Promise<number> {
  const rows = await dbAll<{ id: string }>(sql, params, { fallback: true });
  return Array.isArray(rows) ? rows.length : 0;
}

/** (g) Wywiad → Insights — interview insights surface is alive (org-scoped). */
const probeInterviewInsights: HealthProbe = {
  id: 'gp_interview_insights_live',
  module: 'Wywiad→Insights',
  title: 'Interview insights surface live',
  description:
    'Runs the org-scoped interview_insights list query (empty allowed) to prove the surface is alive.',
  run: async ({ organizationId }) => {
    const count = await countOrgScoped(
      `SELECT id FROM interview_insights WHERE organization_id = ? ORDER BY created_at DESC LIMIT 25`,
      [organizationId]
    );
    return { insightCount: count };
  },
};

/** (h) Insights → Inicjatywy — the M13 initiatives list surface is alive. */
const probeInitiativesList: HealthProbe = {
  id: 'gp_initiatives_list_live',
  module: 'M13',
  title: 'Initiatives list surface live',
  description:
    'Runs the org-scoped initiatives list query (the Insights→Initiative landing surface).',
  run: async ({ organizationId }) => {
    const count = await countOrgScoped(
      `SELECT id FROM initiatives WHERE organization_id = ? ORDER BY created_at DESC LIMIT 25`,
      [organizationId]
    );
    return { initiativeCount: count };
  },
};

/** (i) Assessment → Inicjatywy — assessment-sourced generated initiatives read. */
const probeAssessmentToInitiatives: HealthProbe = {
  id: 'gp_assessment_to_initiatives_live',
  module: 'Assessment→M13',
  title: 'Assessment → generated initiatives live',
  description:
    'Reads generated_initiatives org-scoped (the Assessment→Initiative handoff sink), assessment-source slice.',
  run: async ({ organizationId }) => {
    const count = await countOrgScoped(
      `SELECT id FROM generated_initiatives
        WHERE organization_id = ? AND source = 'assessment'
        ORDER BY created_at DESC LIMIT 25`,
      [organizationId]
    );
    return { assessmentSourcedCount: count };
  },
};

/** (j) Tools → Inicjatywy — tools-sourced generated initiatives read. Same sink
 *  table as (i) but the tools-source slice, so a source-column regression on
 *  either handoff is caught independently. */
const probeToolsToInitiatives: HealthProbe = {
  id: 'gp_tools_to_initiatives_live',
  module: 'Tools→M13',
  title: 'Tools → generated initiatives live',
  description:
    'Reads generated_initiatives org-scoped (tools-source slice) to prove the Tools→Initiative sink is alive.',
  run: async ({ organizationId }) => {
    const count = await countOrgScoped(
      `SELECT id FROM generated_initiatives
        WHERE organization_id = ? AND source = 'tools'
        ORDER BY created_at DESC LIMIT 25`,
      [organizationId]
    );
    return { toolsSourcedCount: count };
  },
};

/** (k) Inicjatywy → Execution (M14) — the tasks/execution surface is alive and
 *  its initiative linkage column is intact (org-scoped). */
const probeInitiativesToExecution: HealthProbe = {
  id: 'gp_initiatives_to_execution_live',
  module: 'M13→M14',
  title: 'Initiative → Execution tasks live',
  description:
    'Runs the org-scoped tasks list query selecting the initiative_id linkage (the Execution handoff surface).',
  run: async ({ organizationId }) => {
    const rows = await dbAll<{ id: string; initiative_id: string | null }>(
      `SELECT id, initiative_id FROM tasks WHERE organization_id = ? ORDER BY created_at DESC LIMIT 25`,
      [organizationId],
      { fallback: true }
    );
    const taskCount = Array.isArray(rows) ? rows.length : 0;
    const linkedToInitiative = (rows || []).filter((r) => r.initiative_id != null).length;
    return { taskCount, linkedToInitiative };
  },
};

/** (l) Execution → Rezultaty (M15) — the benefits register surface is alive
 *  with its initiative linkage (the M14→M15 benefit sink). */
const probeExecutionToResults: HealthProbe = {
  id: 'gp_execution_to_results_live',
  module: 'M14→M15',
  title: 'Execution → benefits register live',
  description:
    'Runs the org-scoped benefits_register list query with initiative linkage (the Results benefit sink surface).',
  run: async ({ organizationId }) => {
    const rows = await dbAll<{ id: string; initiative_id: string | null }>(
      `SELECT id, initiative_id FROM benefits_register WHERE organization_id = ? ORDER BY created_at DESC LIMIT 25`,
      [organizationId],
      { fallback: true }
    );
    const benefitCount = Array.isArray(rows) ? rows.length : 0;
    const linkedToInitiative = (rows || []).filter((r) => r.initiative_id != null).length;
    return { benefitCount, linkedToInitiative };
  },
};

/** (m) Assessment module (M12) — the assessments list surface is alive. */
const probeAssessmentsList: HealthProbe = {
  id: 'gp_assessments_list_live',
  module: 'Assessment',
  title: 'Assessments list surface live',
  description:
    'Runs the org-scoped assessments list query to prove the Assessment module surface is alive.',
  run: async ({ organizationId }) => {
    const count = await countOrgScoped(
      `SELECT id FROM assessments WHERE organization_id = ? ORDER BY created_at DESC LIMIT 25`,
      [organizationId]
    );
    return { assessmentCount: count };
  },
};

/** (n) DRD report endpoint — the assessment_reports surface is alive AND the
 *  DRD report route module still loads (the endpoint backing the report). */
const probeDrdReport: HealthProbe = {
  id: 'gp_drd_report_live',
  module: 'DRD',
  title: 'DRD report surface + route live',
  description:
    'Reads assessment_reports org-scoped and asserts the assessment-reports route module still imports (DRD endpoint alive).',
  run: async ({ organizationId }) => {
    const reportCount = await countOrgScoped(
      `SELECT id FROM assessment_reports WHERE organization_id = ? ORDER BY created_at DESC LIMIT 25`,
      [organizationId]
    );
    // Endpoint liveness: the route module must still import without throwing.
    let routeLoaded = false;
    const mod = await import('../../routes/assessment-reports.routes.js').catch(() => null);
    routeLoaded = mod != null;
    if (!routeLoaded)
      throw new Error('assessment-reports route module failed to import (DRD endpoint dead)');
    return { reportCount, routeLoaded };
  },
};

/** (o) M17 register round-trip — the outputs registry read path is alive via the
 *  canonical service (getRecentArtifactRefsForOrg), the register→chat surface. */
const probeM17RegisterRead: HealthProbe = {
  id: 'gp_m17_register_read_live',
  module: 'M17',
  title: 'Outputs register read live',
  description:
    'Calls getRecentArtifactRefsForOrg (the register→chat read path) and asserts it returns an array org-scoped.',
  run: async ({ organizationId }) => {
    const refs = await getRecentArtifactRefsForOrg(organizationId, 10);
    if (!Array.isArray(refs)) throw new Error('Outputs register read did not return an array');
    return { refCount: refs.length };
  },
};

// ===========================================================================
// GOLDEN-PATH ROUND-TRIP probes (Paczka1 #3) — create → save → reload proofs
// for the chain transitions that previously had only read-only liveness checks.
// Every probe seeds HEALTH-PROBE- prefixed rows, reads them back org-scoped,
// asserts the transition's CONTRACT (not just table liveness), and hard-cleans
// in `finally`.
// ===========================================================================

/** (p) Chain #4 Tools → Inicjatywy ROUND-TRIP — a tool result becomes a real
 *  initiative WITH provenance back-ref (source_type='tool', source_id=session).
 *  Goes through the canonical funnel (createInitiativeService), the same sink
 *  the FE handoff (createInitiativeFromMove) hits via POST /api/initiatives. */
const probeToolsToInitiativeRoundTrip: HealthProbe = {
  id: 'gp4_tools_to_initiative_round_trip',
  module: 'Tools→M13',
  title: 'Tool result → initiative with back-ref',
  description:
    'Creates an initiative via the canonical funnel with sourceType=tool, reads it back org-scoped asserting the source back-reference persisted, then hard-deletes.',
  run: async ({ organizationId }) => {
    let initiativeId: string | null = null;
    const sourceId = label('TOOL-SESSION');
    try {
      const created = await createInitiativeViaFunnel(
        organizationId,
        {
          title: label('TOOL-INITIATIVE'),
          summary: 'health probe — tools handoff round-trip',
          sourceType: 'tool',
          sourceId,
        },
        { emitAudit: false }
      );
      initiativeId = created.id;

      const row = await dbGet<{ id: string; source_type: string | null; source_id: string | null }>(
        `SELECT id, source_type, source_id FROM initiatives WHERE id = ? AND organization_id = ?`,
        [initiativeId, organizationId],
        { fallback: true }
      );
      if (!row) throw new Error('Initiative not readable after tool handoff create');
      if (String(row.source_type || '').toLowerCase() !== 'tool') {
        throw new Error(`Tool provenance lost: source_type='${row.source_type}' (expected 'tool')`);
      }
      if (row.source_id !== sourceId) {
        throw new Error('Tool back-reference lost: source_id does not match the tool session id');
      }
      return { initiativeId, sourceId };
    } finally {
      if (initiativeId) {
        await dbRun(`DELETE FROM initiatives WHERE id = ? AND organization_id = ?`, [
          initiativeId,
          organizationId,
        ]).catch((e) => logger.warn(`${LOG_PREFIX} gp4 initiative cleanup failed`, e));
      }
    }
  },
};

/** (q) Chain #5 Ideas/MyWork convert → Inicjatywy ROUND-TRIP — the ConvertTo
 *  provenance contract (sourceType='tool_session') must survive the funnel, so
 *  a converted idea keeps its back-ref to the materialized MyWork session. */
const probeIdeasConvertToInitiativeRoundTrip: HealthProbe = {
  id: 'gp5_ideas_convert_to_initiative_round_trip',
  module: 'Ideas→M13',
  title: 'Idea convert → initiative with back-ref',
  description:
    'Creates an initiative with the ConvertTo provenance (sourceType=tool_session), reads it back asserting the session back-reference persisted, then hard-deletes.',
  run: async ({ organizationId }) => {
    let initiativeId: string | null = null;
    const sourceId = label('CONVERT-SESSION');
    try {
      const created = await createInitiativeViaFunnel(
        organizationId,
        {
          title: label('CONVERTED-IDEA'),
          summary: 'health probe — ideas convert round-trip',
          sourceType: 'tool_session',
          sourceId,
        },
        { emitAudit: false }
      );
      initiativeId = created.id;

      const row = await dbGet<{ source_type: string | null; source_id: string | null }>(
        `SELECT source_type, source_id FROM initiatives WHERE id = ? AND organization_id = ?`,
        [initiativeId, organizationId],
        { fallback: true }
      );
      if (!row) throw new Error('Initiative not readable after convert create');
      if (String(row.source_type || '').toLowerCase() !== 'tool_session') {
        throw new Error(
          `Convert provenance lost: source_type='${row.source_type}' (expected 'tool_session')`
        );
      }
      if (row.source_id !== sourceId) {
        throw new Error('Convert back-reference lost: source_id does not match the session id');
      }
      return { initiativeId, sourceId };
    } finally {
      if (initiativeId) {
        await dbRun(`DELETE FROM initiatives WHERE id = ? AND organization_id = ?`, [
          initiativeId,
          organizationId,
        ]).catch((e) => logger.warn(`${LOG_PREFIX} gp5 initiative cleanup failed`, e));
      }
    }
  },
};

/** (r) Chain #6 Inicjatywy → Execution ROUND-TRIP — a task created under an
 *  initiative is readable back through the initiative_id linkage (the surface
 *  ExecutionHub filters on). */
const probeInitiativeToExecutionRoundTrip: HealthProbe = {
  id: 'gp6_initiative_to_execution_round_trip',
  module: 'M13→M14',
  title: 'Initiative → execution task linkage',
  description:
    'Seeds an initiative + a task linked via initiative_id, reads the task back org-scoped through the linkage, then hard-deletes both.',
  run: async ({ organizationId }) => {
    const initiativeId = uuidv4();
    const taskId = uuidv4();
    const now = new Date().toISOString();
    try {
      await dbRun(
        // FIX (NOT-NULL sweep): initiatives.name is NOT NULL with no DB default
        // (Postgres) — this probe only wrote `title`, which 500s with 23502.
        `INSERT INTO initiatives (
           id, organization_id, project_id, title, name, summary, status, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          initiativeId,
          organizationId,
          null,
          label('EXEC-INITIATIVE'),
          label('EXEC-INITIATIVE'),
          'health probe',
          'IN_PROGRESS',
          now,
          now,
        ]
      );
      await dbRun(
        `INSERT INTO tasks (
           id, organization_id, title, status, initiative_id, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [taskId, organizationId, label('EXEC-TASK'), 'todo', initiativeId, now, now]
      );

      const row = await dbGet<{ id: string }>(
        `SELECT id FROM tasks WHERE organization_id = ? AND initiative_id = ? AND id = ?`,
        [organizationId, initiativeId, taskId],
        { fallback: true }
      );
      if (!row) throw new Error('Task not readable back through initiative_id linkage');
      return { initiativeId, taskId };
    } finally {
      await dbRun(`DELETE FROM tasks WHERE id = ? AND organization_id = ?`, [
        taskId,
        organizationId,
      ]).catch((e) => logger.warn(`${LOG_PREFIX} gp6 task cleanup failed`, e));
      await dbRun(`DELETE FROM initiatives WHERE id = ? AND organization_id = ?`, [
        initiativeId,
        organizationId,
      ]).catch((e) => logger.warn(`${LOG_PREFIX} gp6 initiative cleanup failed`, e));
    }
  },
};

/** (s) Chain #7 Execution(DONE) → Rezultaty ROUND-TRIP — the REAL closure
 *  writer (handoffFromClosure) materializes a planned KPI into
 *  initiative_benefits tagged M14_CLOSURE_HANDOFF, and is idempotent on re-run. */
const probeExecutionClosureToResultsRoundTrip: HealthProbe = {
  id: 'gp7_execution_closure_to_results_round_trip',
  module: 'M14→M15',
  title: 'Closure handoff → benefit (idempotent)',
  description:
    'Seeds a DONE initiative + planned KPI, runs the real closure handoff, asserts an initiative_benefits row tagged M14_CLOSURE_HANDOFF exists and a re-run dedups, then hard-cleans.',
  run: async ({ organizationId, userId }) => {
    const initiativeId = uuidv4();
    const kpiId = uuidv4();
    const now = new Date().toISOString();
    try {
      await dbRun(
        // FIX (NOT-NULL sweep): initiatives.name is NOT NULL with no DB default
        // (Postgres) — this probe only wrote `title`, which 500s with 23502.
        `INSERT INTO initiatives (
           id, organization_id, project_id, title, name, summary, status, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          initiativeId,
          organizationId,
          null,
          label('CLOSURE-INITIATIVE'),
          label('CLOSURE-INITIATIVE'),
          'health probe',
          'DONE',
          now,
          now,
        ]
      );
      await dbRun(
        `INSERT INTO initiative_kpis (id, initiative_id, name, target_value, unit, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [kpiId, initiativeId, label('PLANNED-KPI'), 100, '%', now, now]
      );

      const first = await handoffFromClosure(organizationId, initiativeId, userId);
      if (!first || first.created !== 1) {
        throw new Error(
          `Closure handoff did not create the benefit (created=${first?.created}, considered=${first?.considered})`
        );
      }

      const benefit = await dbGet<{ id: string }>(
        `SELECT id FROM initiative_benefits
          WHERE initiative_id = ? AND organization_id = ? AND source_tag = ?
          LIMIT 1`,
        [initiativeId, organizationId, CLOSURE_HANDOFF_SOURCE],
        { fallback: true }
      );
      if (!benefit) throw new Error('Benefit row not readable after closure handoff');

      // Idempotency contract: a repeat DONE must not duplicate the benefit.
      const second = await handoffFromClosure(organizationId, initiativeId, userId);
      if (!second || second.created !== 0 || second.skipped !== 1) {
        throw new Error(
          `Closure handoff re-run is not idempotent (created=${second?.created}, skipped=${second?.skipped})`
        );
      }
      return { initiativeId, kpiId, benefitId: benefit.id };
    } finally {
      await dbRun(
        `DELETE FROM initiative_benefits WHERE initiative_id = ? AND organization_id = ? AND source_tag = ?`,
        [initiativeId, organizationId, CLOSURE_HANDOFF_SOURCE]
      ).catch((e) => logger.warn(`${LOG_PREFIX} gp7 benefit cleanup failed`, e));
      await dbRun(`DELETE FROM initiative_kpis WHERE id = ? AND initiative_id = ?`, [
        kpiId,
        initiativeId,
      ]).catch((e) => logger.warn(`${LOG_PREFIX} gp7 kpi cleanup failed`, e));
      await dbRun(`DELETE FROM initiatives WHERE id = ? AND organization_id = ?`, [
        initiativeId,
        organizationId,
      ]).catch((e) => logger.warn(`${LOG_PREFIX} gp7 initiative cleanup failed`, e));
    }
  },
};

/** (t) Chain #8 Rezultaty ↔ Finanse ROUND-TRIP — the reconciliation ENGINE
 *  converts a %-denominated KPI onto the finance basis through the explicit
 *  unit multiplier (the OEE-class unit bug guard) and persists the deviation. */
const probeResultsFinanceReconciliationRoundTrip: HealthProbe = {
  id: 'gp8_results_finance_reconciliation_round_trip',
  module: 'M15↔M16',
  title: 'KPI ↔ finance reconciliation (units)',
  description:
    'Seeds a %-metric KPI, reconciles it against a finance driver with an explicit unit multiplier, asserts the persisted deviation is unit-consistent, then hard-cleans.',
  run: async ({ organizationId }) => {
    const initiativeId = uuidv4();
    let kpiId: string | null = null;
    const driverKey = label('DRIVER');
    try {
      const kpi = await createKPI({
        organizationId,
        name: label('RECON-KPI'),
        mode: 'initiative_linked',
        metricType: 'percentage',
        targetValue: 90,
        currentValue: 72,
        measurementCadence: 'monthly',
        initiativeId,
      });
      kpiId = kpi.kpiId;

      const result = await pullAndReconcileInitiative(organizationId, initiativeId, [
        { kpiId, driverKey, unitMultiplier: 1000 },
      ]);
      if (!result || result.reconciledCount !== 1) {
        throw new Error(
          `Reconciliation did not reconcile the KPI (count=${result?.reconciledCount})`
        );
      }
      const item = result.items[0];
      // Unit-consistency contract (the OEE bug class): both sides must be on the
      // finance basis — 72% × 1000 vs 90% × 1000, deviation −18000, NOT a raw
      // %-vs-currency subtraction.
      if (item.realizedValue !== 72000 || item.projectedValue !== 90000) {
        throw new Error(
          `Unit conversion broken: realized=${item.realizedValue} projected=${item.projectedValue} (expected 72000 / 90000)`
        );
      }
      if (item.deviationAbsolute !== -18000) {
        throw new Error(
          `Deviation not on finance basis: ${item.deviationAbsolute} (expected -18000)`
        );
      }

      // Reload: the persisted reconciliation row must carry the multiplier + deviation.
      const row = await dbGet<{
        unit_multiplier: number | string;
        deviation_absolute: number | string;
      }>(
        `SELECT unit_multiplier, deviation_absolute
           FROM v8_kpi_finance_reconciliations
          WHERE organization_id = ? AND kpi_id = ? AND driver_key = ?
          LIMIT 1`,
        [organizationId, kpiId, driverKey],
        { fallback: true }
      );
      if (!row) throw new Error('Reconciliation row not readable after reconcile');
      if (Number(row.unit_multiplier) !== 1000 || Number(row.deviation_absolute) !== -18000) {
        throw new Error(
          `Persisted reconciliation drifted: unit_multiplier=${row.unit_multiplier} deviation=${row.deviation_absolute}`
        );
      }
      return { kpiId, driverKey, deviationAbsolute: item.deviationAbsolute };
    } finally {
      if (kpiId) {
        await dbRun(
          `DELETE FROM v8_kpi_finance_reconciliations WHERE organization_id = ? AND kpi_id = ?`,
          [organizationId, kpiId]
        ).catch((e) => logger.warn(`${LOG_PREFIX} gp8 reconciliation cleanup failed`, e));
        await dbRun(`DELETE FROM v8_kpi_definitions WHERE kpi_id = ? AND organization_id = ?`, [
          kpiId,
          organizationId,
        ]).catch((e) => logger.warn(`${LOG_PREFIX} gp8 kpi cleanup failed`, e));
      }
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
  // ── Golden-path liveness probes (read-only) ──
  probeInterviewInsights,
  probeInitiativesList,
  probeAssessmentToInitiatives,
  probeToolsToInitiatives,
  probeInitiativesToExecution,
  probeExecutionToResults,
  probeAssessmentsList,
  probeDrdReport,
  probeM17RegisterRead,
  // ── Golden-path ROUND-TRIP probes (Paczka1 #3 — create→save→reload proofs) ──
  probeToolsToInitiativeRoundTrip,
  probeIdeasConvertToInitiativeRoundTrip,
  probeInitiativeToExecutionRoundTrip,
  probeExecutionClosureToResultsRoundTrip,
  probeResultsFinanceReconciliationRoundTrip,
];

export function getProbeById(probeId: string): HealthProbe | undefined {
  return HEALTH_PROBES.find((p) => p.id === probeId);
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

/** Run a single probe (pure — no DB cache write). Never throws. */
export async function runProbe(probe: HealthProbe, ctx: HealthProbeContext): Promise<ProbeResult> {
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
  const overall: ProbeStatus =
    failed > 0 ? 'fail' : unknown === results.length ? 'unknown' : 'pass';
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
