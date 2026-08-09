/**
 * Finance v3 canonical — artifact / business-version / working-revision CRUD
 * and the two most safety-critical operations: atomic `approve` and
 * non-mutating `reopen`.
 *
 * Gate C, WP-C02 "compatibility services". Operates on the schema from
 * `server/migrations/20260809_finance_v3_b01_core_artifacts.sql` (+ b05/b06
 * additive columns), per the contract in
 * `docs/validation/finance-v3/generated/gate-b/WP-B02_lifecycle_concurrency_ADR.md`
 * sections 5 (atomic approval, 4 steps a-d) and 6 (reopen algorithm).
 *
 * WHY `withPinnedPostgresTransaction`, never `DbPromise`: `DbPromise.run`/
 * `.get`/`.all` default to `fallback: true`, which swallows real DB errors
 * and returns an empty/success-shaped result — exactly the "zielone testy,
 * fałszywy sukces" failure mode this program's own audits keep finding
 * elsewhere in Finance (see `financialModelingService.ts`'s comment on the
 * same function for the prior art this reuses). `approve`/`reopen` are
 * multi-statement, must-be-atomic, must-fail-loud operations — the
 * `SELECT ... FOR UPDATE` primitive additionally requires every statement in
 * the operation to run on the SAME physical connection, which `DbPromise`
 * cannot guarantee (see `setBaseline()` in `financialModelingService.ts` for
 * the same reasoning against a plain `dbRun()` pair).
 */

import { v4 as uuidv4 } from 'uuid';

import { withPinnedPostgresTransaction } from '../../../database/PostgresDatabase.js';
import type { FinanceArtifactType } from './lifecycleService.js';
import {
  checkSelfApproval,
  defaultRiskTierForArtifactType,
  validateTransition,
  type BusinessVersionStatus,
  type FinanceRole,
  type LifecycleAction,
  type RiskTier,
} from './lifecycleService.js';

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

/** WP-B06 §4.1 — `finance_business_versions.version_kind` CHECK constraint values. */
export type VersionKind = 'ORIGINAL' | 'RESTATED' | 'MANAGEMENT_ADJUSTED';

/** WP-B06 §4.1 — `finance_business_versions.restatement_class` CHECK constraint values. */
export type RestatementClass = 'ERROR_CORRECTION' | 'ACCOUNTING_POLICY_CHANGE' | 'RECLASSIFICATION' | 'OTHER';

export interface BusinessVersionRow {
  business_version_id: string;
  artifact_id: string;
  organization_id: string;
  version_no: number;
  version: number;
  status: BusinessVersionStatus;
  freshness: string;
  freshness_reason: string | null;
  stale_since: string | null;
  source_working_revision_id: string | null;
  parent_version_id: string | null;
  superseded_by_version_id: string | null;
  superseded_at: string | null;
  compute_snapshot_id: string | null;
  compute_run_id: string | null;
  engine_manifest_id: string;
  content_semantic_hash: string | null;
  risk_tier: RiskTier | null;
  submitted_by: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  approval_note: string | null;
  archived_by: string | null;
  archived_at: string | null;
  invalidated_reason: string | null;
  immutable_since: string | null;
  reopen_reason: string | null;
  reopened_by: string | null;
  reopened_at: string | null;
  result_quality: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** WP-B06 §4.1 (`20260809_finance_v3_b06_reproducibility_retention_export.sql`). */
  version_kind: VersionKind;
  restatement_reason: string | null;
  restatement_class: RestatementClass | null;
}

export interface WorkingRevisionRow {
  working_revision_id: string;
  artifact_id: string;
  organization_id: string;
  business_version_id: string | null;
  source_business_version_id: string | null;
  revision_seq: number;
  version: number;
  content_semantic_hash: string | null;
  compute_run_id: string | null;
  is_current: boolean;
  crash_recovery_checkpoint: boolean;
  edited_by: string | null;
  edited_at: string;
}

export interface ArtifactRow {
  artifact_id: string;
  organization_id: string;
  artifact_type: FinanceArtifactType;
  natural_key: string | null;
  current_business_version_id: string | null;
  created_by: string | null;
  created_at: string;
  archived_at: string | null;
  archived_reason: string | null;
}

const LEGACY_UNKNOWN_ENGINE_MANIFEST_SQL = `(SELECT engine_manifest_id FROM finance_engine_manifests
   WHERE engine_name = 'LEGACY_UNKNOWN' ORDER BY created_at ASC LIMIT 1)`;

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getArtifact(organizationId: string, artifactId: string): Promise<ArtifactRow | null> {
  return withPinnedPostgresTransaction((tx) =>
    tx.queryOne<ArtifactRow>(
      `SELECT * FROM finance_artifacts WHERE artifact_id = ? AND organization_id = ?`,
      [artifactId, organizationId]
    )
  );
}

export async function getBusinessVersion(
  organizationId: string,
  businessVersionId: string
): Promise<BusinessVersionRow | null> {
  return withPinnedPostgresTransaction((tx) =>
    tx.queryOne<BusinessVersionRow>(
      `SELECT * FROM finance_business_versions WHERE business_version_id = ? AND organization_id = ?`,
      [businessVersionId, organizationId]
    )
  );
}

export async function listBusinessVersions(
  organizationId: string,
  artifactId: string
): Promise<BusinessVersionRow[]> {
  return withPinnedPostgresTransaction((tx) =>
    tx.queryAll<BusinessVersionRow>(
      `SELECT * FROM finance_business_versions WHERE artifact_id = ? AND organization_id = ? ORDER BY version_no ASC`,
      [artifactId, organizationId]
    )
  );
}

// ---------------------------------------------------------------------------
// T1 — create_artifact
// ---------------------------------------------------------------------------

export interface CreateArtifactParams {
  organizationId: string;
  artifactType: FinanceArtifactType;
  naturalKey?: string | null;
  createdBy: string;
  riskTier?: RiskTier; // override of the computed default (never a downgrade — caller's job to enforce)
}

export interface CreateArtifactResult {
  artifact: ArtifactRow;
  businessVersion: BusinessVersionRow;
  workingRevision: WorkingRevisionRow;
}

/** T1 (WP-B02 §3.2) — new artifact_id + business_version_id v1 (DRAFT) + working_revision_id v1, one transaction. */
export async function createArtifact(params: CreateArtifactParams): Promise<CreateArtifactResult> {
  const artifactId = uuidv4();
  const businessVersionId = uuidv4();
  const workingRevisionId = uuidv4();
  const riskTier = params.riskTier ?? defaultRiskTierForArtifactType(params.artifactType);

  return withPinnedPostgresTransaction(async (tx) => {
    const artifact = await tx.queryOne<ArtifactRow>(
      `INSERT INTO finance_artifacts (artifact_id, organization_id, artifact_type, natural_key, created_by)
       VALUES (?, ?, ?, ?, ?) RETURNING *`,
      [artifactId, params.organizationId, params.artifactType, params.naturalKey ?? null, params.createdBy]
    );
    if (!artifact) throw new Error('finance_artifacts insert returned no row');

    const businessVersion = await tx.queryOne<BusinessVersionRow>(
      `INSERT INTO finance_business_versions (
         business_version_id, artifact_id, organization_id, version_no, status,
         risk_tier, engine_manifest_id, created_by
       ) VALUES (?, ?, ?, 1, 'DRAFT', ?, ${LEGACY_UNKNOWN_ENGINE_MANIFEST_SQL}, ?)
       RETURNING *`,
      [businessVersionId, artifactId, params.organizationId, riskTier, params.createdBy]
    );
    if (!businessVersion) throw new Error('finance_business_versions insert returned no row');

    const workingRevision = await tx.queryOne<WorkingRevisionRow>(
      `INSERT INTO finance_working_revisions (
         working_revision_id, artifact_id, organization_id, business_version_id, revision_seq, is_current, edited_by
       ) VALUES (?, ?, ?, ?, 1, true, ?)
       RETURNING *`,
      [workingRevisionId, artifactId, params.organizationId, businessVersionId, params.createdBy]
    );
    if (!workingRevision) throw new Error('finance_working_revisions insert returned no row');

    await tx.queryRun(
      `UPDATE finance_business_versions SET source_working_revision_id = ? WHERE business_version_id = ?`,
      [workingRevisionId, businessVersionId]
    );

    await tx.queryRun(
      `INSERT INTO artifact_lifecycle_events (
         event_id, organization_id, artifact_id, business_version_id, action, from_status, to_status, actor_id, risk_tier
       ) VALUES (?, ?, ?, ?, 'CREATE', NULL, 'DRAFT', ?, ?)`,
      [uuidv4(), params.organizationId, artifactId, businessVersionId, params.createdBy, riskTier]
    );

    return { artifact, businessVersion: { ...businessVersion, source_working_revision_id: workingRevisionId }, workingRevision };
  });
}

// ---------------------------------------------------------------------------
// T2-T7, T10-T11 — generic single-row status transition (CAS + audit log)
// ---------------------------------------------------------------------------

export type TransitionErrorCode =
  | 'NOT_FOUND'
  | 'VERSION_CONFLICT'
  | 'STATE_PRECONDITION_FAILED'
  | 'FORBIDDEN'
  | 'REASON_REQUIRED';

export type TransitionServiceResult =
  | { ok: true; businessVersion: BusinessVersionRow }
  | {
      ok: false;
      code: TransitionErrorCode;
      message: string;
      currentVersion?: number;
      currentStatus?: BusinessVersionStatus;
    };

export interface TransitionParams {
  organizationId: string;
  businessVersionId: string;
  action: Exclude<LifecycleAction, 'approve' | 'reopen'>;
  actorId: string;
  role: FinanceRole;
  expectedVersion: number;
  reason?: string;
}

const ACTOR_FIELD_BY_ACTION: Partial<Record<TransitionParams['action'], { by: string; at: string }>> = {
  submit_for_review: { by: 'submitted_by', at: 'submitted_at' },
  archive: { by: 'archived_by', at: 'archived_at' },
};

export async function transition(params: TransitionParams): Promise<TransitionServiceResult> {
  return withPinnedPostgresTransaction(async (tx) => {
    const current = await tx.queryOne<BusinessVersionRow>(
      `SELECT * FROM finance_business_versions WHERE business_version_id = ? AND organization_id = ? FOR UPDATE`,
      [params.businessVersionId, params.organizationId]
    );
    if (!current) {
      return { ok: false, code: 'NOT_FOUND', message: 'Business version not found' };
    }
    if (current.version !== params.expectedVersion) {
      return {
        ok: false,
        code: 'VERSION_CONFLICT',
        message: 'Version conflict',
        currentVersion: current.version,
        currentStatus: current.status,
      };
    }

    const decision = validateTransition(current.status, params.action, params.role, {
      reasonProvided: Boolean(params.reason && params.reason.trim().length > 0),
    });
    if (!decision.ok) {
      return { ok: false, code: decision.code, message: decision.message, currentStatus: current.status };
    }

    const actorFields = ACTOR_FIELD_BY_ACTION[params.action];
    const extraSet = actorFields ? `, ${actorFields.by} = ?, ${actorFields.at} = now()` : '';
    const extraParams = actorFields ? [params.actorId] : [];
    const invalidatedSet = params.action === 'invalidate' ? `, invalidated_reason = ?` : '';
    const invalidatedParams = params.action === 'invalidate' ? [params.reason ?? null] : [];

    const updated = await tx.queryOne<BusinessVersionRow>(
      `UPDATE finance_business_versions
          SET status = ?, version = version + 1${extraSet}${invalidatedSet}
        WHERE business_version_id = ? AND organization_id = ? AND version = ?
        RETURNING *`,
      [decision.toStatus, ...extraParams, ...invalidatedParams, params.businessVersionId, params.organizationId, params.expectedVersion]
    );
    if (!updated) {
      // Lost the race between the SELECT FOR UPDATE and here is not possible
      // within one transaction/connection, but keep the guard for safety.
      return { ok: false, code: 'VERSION_CONFLICT', message: 'Version conflict', currentStatus: current.status };
    }

    await tx.queryRun(
      `INSERT INTO artifact_lifecycle_events (
         event_id, organization_id, artifact_id, business_version_id, action, from_status, to_status, actor_id, reason, risk_tier
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        params.organizationId,
        current.artifact_id,
        params.businessVersionId,
        params.action.toUpperCase(),
        current.status,
        decision.toStatus,
        params.actorId,
        params.reason ?? null,
        current.risk_tier,
      ]
    );

    return { ok: true, businessVersion: updated };
  });
}

// ---------------------------------------------------------------------------
// T8 — approve: the atomic 4-step transaction (WP-B02 §5)
// ---------------------------------------------------------------------------

export type ApproveErrorCode =
  | 'NOT_FOUND'
  | 'VERSION_CONFLICT'
  | 'STATE_PRECONDITION_FAILED'
  | 'APPROVAL_BLOCKED'
  | 'SELF_APPROVAL_FORBIDDEN'
  | 'WORKING_REVISION_NOT_FOUND';

export type ApproveResult =
  | {
      ok: true;
      businessVersion: BusinessVersionRow;
      computeSnapshotId: string;
      idempotentReplay: boolean;
    }
  | {
      ok: false;
      code: ApproveErrorCode;
      message: string;
      currentVersion?: number;
      currentStatus?: BusinessVersionStatus;
      riskTier?: RiskTier;
      conflictingRole?: 'preparer' | 'reviewer';
    };

export interface ApproveVersionParams {
  organizationId: string;
  businessVersionId: string;
  actorId: string;
  role: FinanceRole;
  expectedVersion: number;
  idempotencyKey?: string;
  /** Editors since submission, for the SoD check (WP-B02 §7.2.6). Caller supplies from artifact_lifecycle_events if it wants full enforcement; defaults to [] (submitted_by-only check). */
  editorUserIds?: readonly string[];
  reviewStartedBy?: string | null;
}

/**
 * WP-B02 §5 — one transaction, five ordered steps: (a) completeness/freshness/
 * blocking-exception/SoD validation, (b) freeze compute snapshot (INSERT,
 * never UPDATE), (T9) supersede the parent version FIRST if this is a
 * reopened/restated version being approved, (c) status transition with
 * compute_snapshot_id in the SAME statement, (d) append-only audit log
 * insert. T9 is kept in-transaction (rather than a separate follow-up
 * transaction) per §5.2's documented tradeoff, since this work package has
 * no background reconciliation job yet to repair a post-commit T9 failure —
 * but it MUST run BEFORE (c), not after: `uq_finance_bv_one_approved` is a
 * partial UNIQUE INDEX (not DEFERRABLE — Postgres does not allow DEFERRABLE
 * on an index with a WHERE predicate), so its uniqueness check fires at the
 * end of each UPDATE statement, not at COMMIT. Superseding the child's still-
 * APPROVED parent before flipping the child to APPROVED avoids ever having
 * two APPROVED rows for the same artifact_id at any point in the transaction
 * (BUG-GOLDCO-03 fix, 2026-08-09 — see
 * docs/validation/finance-v3/generated/gate-d/GOLDCO_STATEMENTS_VERTICAL_SLICE_REPORT.md
 * and the corrected WP-B02_lifecycle_concurrency_ADR.md §5/§6.4).
 */
export async function approveVersion(params: ApproveVersionParams): Promise<ApproveResult> {
  return withPinnedPostgresTransaction(async (tx) => {
    if (params.idempotencyKey) {
      const replay = await tx.queryOne<{ business_version_id: string; to_status: BusinessVersionStatus; snapshot_id: string | null }>(
        `SELECT business_version_id, to_status, snapshot_id FROM artifact_lifecycle_events
          WHERE organization_id = ? AND business_version_id = ? AND action = 'APPROVE' AND idempotency_key = ?
          ORDER BY created_at DESC LIMIT 1`,
        [params.organizationId, params.businessVersionId, params.idempotencyKey]
      );
      if (replay) {
        const bv = await tx.queryOne<BusinessVersionRow>(
          `SELECT * FROM finance_business_versions WHERE business_version_id = ? AND organization_id = ?`,
          [params.businessVersionId, params.organizationId]
        );
        if (bv) {
          return {
            ok: true,
            businessVersion: bv,
            computeSnapshotId: replay.snapshot_id || bv.compute_snapshot_id || '',
            idempotentReplay: true,
          };
        }
      }
    }

    // (a1) SELECT ... FOR UPDATE — pins the row for the rest of the transaction.
    const current = await tx.queryOne<BusinessVersionRow>(
      `SELECT * FROM finance_business_versions WHERE business_version_id = ? AND organization_id = ? FOR UPDATE`,
      [params.businessVersionId, params.organizationId]
    );
    if (!current) return { ok: false, code: 'NOT_FOUND', message: 'Business version not found' };

    if (current.version !== params.expectedVersion) {
      return {
        ok: false,
        code: 'VERSION_CONFLICT',
        message: 'Version conflict',
        currentVersion: current.version,
        currentStatus: current.status,
      };
    }

    if (current.status !== 'IN_REVIEW') {
      return {
        ok: false,
        code: 'STATE_PRECONDITION_FAILED',
        message: `Cannot approve: version is in status ${current.status}, not IN_REVIEW`,
        currentStatus: current.status,
      };
    }

    // (a2) freshness must be CURRENT (WP-B02 §5.1 point 1(i)).
    if (current.freshness !== 'CURRENT') {
      return {
        ok: false,
        code: 'APPROVAL_BLOCKED',
        message: `Cannot approve: freshness is ${current.freshness}, not CURRENT`,
      };
    }

    // (a3) no blocking (SECURITY-severity) OPEN exceptions (WP-B02 §5.1 point 1(ii) / DEC-FIN-009).
    const blocking = await tx.queryOne<{ id: string }>(
      `SELECT fe.id FROM finance_exceptions_current fe
        WHERE fe.organization_id = ? AND fe.business_version_id = ? AND fe.severity = 'SECURITY' AND fe.state = 'OPEN'
        LIMIT 1`,
      [params.organizationId, params.businessVersionId]
    );
    if (blocking) {
      return { ok: false, code: 'APPROVAL_BLOCKED', message: 'Blocking SECURITY exception is still OPEN' };
    }

    // (a4) SoD self-approval gate (WP-B02 §7.2.6).
    const riskTier = (current.risk_tier ?? 'LOW') as RiskTier;
    const sod = checkSelfApproval({
      riskTier,
      approverUserId: params.actorId,
      submittedBy: current.submitted_by,
      editorUserIds: params.editorUserIds,
      reviewStartedBy: params.reviewStartedBy,
    });
    if (sod.forbidden) {
      return {
        ok: false,
        code: 'SELF_APPROVAL_FORBIDDEN',
        message: `Approver must differ from ${sod.conflictingRole} for ${riskTier} artifacts`,
        riskTier,
        conflictingRole: sod.conflictingRole,
      };
    }

    // (b) freeze compute snapshot — INSERT, never UPDATE.
    const workingRevision = await tx.queryOne<WorkingRevisionRow>(
      `SELECT * FROM finance_working_revisions WHERE artifact_id = ? AND organization_id = ? AND is_current = true`,
      [current.artifact_id, params.organizationId]
    );
    if (!workingRevision) {
      return { ok: false, code: 'WORKING_REVISION_NOT_FOUND', message: 'No current working revision to freeze' };
    }

    const computeSnapshotId = uuidv4();
    const snapshot = await tx.queryOne<{ compute_snapshot_id: string }>(
      `INSERT INTO finance_compute_snapshots (
         compute_snapshot_id, artifact_id, organization_id, working_revision_id, compute_run_id,
         engine_manifest_id, as_of, content_semantic_hash, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, now(), ?, ?)
       RETURNING compute_snapshot_id`,
      [
        computeSnapshotId,
        current.artifact_id,
        params.organizationId,
        workingRevision.working_revision_id,
        workingRevision.compute_run_id,
        current.engine_manifest_id,
        workingRevision.content_semantic_hash,
        params.actorId,
      ]
    );
    if (!snapshot) throw new Error('finance_compute_snapshots insert returned no row');

    // T9 — supersede the parent (if any) BEFORE the child's own status flip to
    // APPROVED (BUG-GOLDCO-03 fix, 2026-08-09). `uq_finance_bv_one_approved`
    // (server/migrations/20260809_finance_v3_b01_core_artifacts.sql:143) is a
    // partial UNIQUE INDEX, not a table CONSTRAINT — Postgres does not allow
    // DEFERRABLE on an index with a WHERE predicate, so its uniqueness check
    // fires at the end of EACH UPDATE statement, not at COMMIT. Since
    // `reopenVersion()` only ever reopens an APPROVED row, `current.parent_version_id`
    // (when set) is *always* still APPROVED at this point — flipping the CHILD
    // to APPROVED first (the previous order here, and the order the WP-B02 ADR's
    // own §5 sequence diagram showed as a *post-commit* best-effort step) collides
    // with the still-APPROVED parent on that same partial index the instant the
    // child's UPDATE runs, before this step ever gets a chance to execute — see
    // BUG-GOLDCO-03 in docs/validation/finance-v3/generated/gate-d/GOLDCO_STATEMENTS_VERTICAL_SLICE_REPORT.md
    // and the corrected ordering in WP-B02_lifecycle_concurrency_ADR.md §5/§6.4.
    // Demoting the parent FIRST removes it from the partial index before the
    // child ever tries to claim the "one APPROVED per artifact_id" slot, so a
    // plain non-deferred unique index is sufficient — no schema change needed.
    if (current.parent_version_id) {
      await tx.queryRun(
        `UPDATE finance_business_versions
            SET status = 'SUPERSEDED', superseded_at = now(), superseded_by_version_id = ?
          WHERE business_version_id = ? AND organization_id = ? AND status = 'APPROVED'`,
        [params.businessVersionId, current.parent_version_id, params.organizationId]
      );
    }

    // (c) status transition — compute_snapshot_id in the SAME statement as the status flip.
    const approved = await tx.queryOne<BusinessVersionRow>(
      `UPDATE finance_business_versions
          SET status = 'APPROVED', version = version + 1, approved_by = ?, approved_at = now(),
              compute_snapshot_id = ?
        WHERE business_version_id = ? AND organization_id = ? AND version = ?
        RETURNING *`,
      [params.actorId, computeSnapshotId, params.businessVersionId, params.organizationId, params.expectedVersion]
    );
    if (!approved) {
      return {
        ok: false,
        code: 'VERSION_CONFLICT',
        message: 'Version conflict during approval commit',
        currentStatus: current.status,
      };
    }

    // (d) audit log — same transaction, append-only.
    await tx.queryRun(
      `INSERT INTO artifact_lifecycle_events (
         event_id, organization_id, artifact_id, business_version_id, action, from_status, to_status,
         actor_id, idempotency_key, snapshot_id, risk_tier
       ) VALUES (?, ?, ?, ?, 'APPROVE', 'IN_REVIEW', 'APPROVED', ?, ?, ?, ?)`,
      [
        uuidv4(),
        params.organizationId,
        current.artifact_id,
        params.businessVersionId,
        params.actorId,
        params.idempotencyKey ?? null,
        computeSnapshotId,
        riskTier,
      ]
    );

    return { ok: true, businessVersion: approved, computeSnapshotId, idempotentReplay: false };
  });
}

// ---------------------------------------------------------------------------
// T12 — reopen: never mutates the Approved row; spawns vN+1 = DRAFT (WP-B02 §6)
// ---------------------------------------------------------------------------

export type ReopenErrorCode =
  | 'NOT_FOUND'
  | 'VERSION_CONFLICT'
  | 'STATE_PRECONDITION_FAILED'
  | 'FORBIDDEN'
  | 'REASON_REQUIRED'
  | 'DRAFT_ALREADY_EXISTS'
  | 'RESTATEMENT_METADATA_REQUIRED';

export type ReopenResult =
  | {
      ok: true;
      previousBusinessVersionId: string;
      businessVersion: BusinessVersionRow;
      workingRevision: WorkingRevisionRow;
      idempotentReplay: boolean;
    }
  | { ok: false; code: ReopenErrorCode; message: string; existingDraftVersionId?: string; currentStatus?: BusinessVersionStatus };

const REOPEN_ALLOWED_ROLES: readonly FinanceRole[] = ['approver', 'finance_admin'];

export interface ReopenVersionParams {
  organizationId: string;
  businessVersionId: string; // vN, must be APPROVED
  actorId: string;
  role: FinanceRole;
  expectedVersion: number;
  reason: string;
  idempotencyKey?: string;
  /**
   * BUG-GOLDCO-01 fix (2026-08-09). WP-B06 §4.2's documented restatement
   * mechanism ("restatement to nie osobna operacja state machine, to reopen
   * (B02 T12) z dodatkowymi metadanymi... `versionKind: 'RESTATED'`") — the
   * caller marks THIS reopen as a restatement by passing `versionKind:
   * 'RESTATED'` plus `restatementReason`/`restatementClass`. Omitted (or
   * explicitly `'ORIGINAL'`) means a plain reopen — `vN+1.version_kind`
   * defaults to `'ORIGINAL'`, matching WP-B06 §4.2's own default rule
   * ("version_kind nie jest dziedziczone automatycznie... domyślnie nowy
   * vN+1 też jest ORIGINAL"). `'MANAGEMENT_ADJUSTED'` is intentionally not
   * reachable through reopen — WP-B06 §4.4 models it as a separate
   * `artifact_id`, not a version_kind reachable via this function.
   */
  versionKind?: Extract<VersionKind, 'ORIGINAL' | 'RESTATED'>;
  restatementReason?: string;
  restatementClass?: RestatementClass;
}

/**
 * WP-B02 §6.2 algorithm, verbatim: SELECT FOR UPDATE vN -> validate -> INSERT
 * vN+1 (DRAFT, parent_version_id=vN) -> copy-on-write INSERT working_revision
 * -> audit log -> COMMIT. Step 6 of the ADR is the load-bearing invariant this
 * function must uphold: **no `UPDATE` statement ever touches vN's row** in
 * this function — `vN.status` stays `APPROVED` until T9 fires later (inside
 * `approveVersion` when vN+1 itself is approved). This is exactly the bug
 * class WP-B02 §6.1 documents (`financialModelingService.ts` lines
 * 2001/2047/2059 mutating Approved in place) and this function's own unit/
 * integration test asserts vN is byte-identical before/after a reopen call.
 */
export async function reopenVersion(params: ReopenVersionParams): Promise<ReopenResult> {
  if (!params.reason || !params.reason.trim()) {
    return { ok: false, code: 'REASON_REQUIRED', message: 'reopen requires a non-empty reason' };
  }
  if (!REOPEN_ALLOWED_ROLES.includes(params.role)) {
    return { ok: false, code: 'FORBIDDEN', message: `Role ${params.role} may not reopen` };
  }
  // BUG-GOLDCO-01 fix: mirror `chk_finance_bv_restatement_reason`
  // (`version_kind != 'RESTATED' OR (restatement_reason IS NOT NULL AND
  // restatement_class IS NOT NULL)`, WP-B06 §4.1) at the application layer so
  // a caller gets a clean 400-shaped error instead of a raw Postgres
  // check-violation surfacing from inside the transaction below.
  if (params.versionKind === 'RESTATED' && (!params.restatementReason?.trim() || !params.restatementClass)) {
    return {
      ok: false,
      code: 'RESTATEMENT_METADATA_REQUIRED',
      message: "versionKind='RESTATED' requires both restatementReason and restatementClass",
    };
  }

  try {
    return await withPinnedPostgresTransaction(async (tx) => {
      const vN = await tx.queryOne<BusinessVersionRow>(
        `SELECT * FROM finance_business_versions WHERE business_version_id = ? AND organization_id = ? FOR UPDATE`,
        [params.businessVersionId, params.organizationId]
      );
      if (!vN) return { ok: false, code: 'NOT_FOUND', message: 'Business version not found' };

      if (params.idempotencyKey) {
        const replay = await tx.queryOne<{ business_version_id: string }>(
          `SELECT business_version_id FROM artifact_lifecycle_events
            WHERE organization_id = ? AND action = 'REOPEN' AND idempotency_key = ?
              AND (metadata->>'fromVersionId') = ?
            ORDER BY created_at DESC LIMIT 1`,
          [params.organizationId, params.idempotencyKey, vN.business_version_id]
        );
        if (replay) {
          const childBv = await tx.queryOne<BusinessVersionRow>(
            `SELECT * FROM finance_business_versions WHERE business_version_id = ? AND organization_id = ?`,
            [replay.business_version_id, params.organizationId]
          );
          const childWr = childBv
            ? await tx.queryOne<WorkingRevisionRow>(
                `SELECT * FROM finance_working_revisions WHERE business_version_id = ? AND organization_id = ?`,
                [replay.business_version_id, params.organizationId]
              )
            : null;
          if (childBv && childWr) {
            return {
              ok: true,
              previousBusinessVersionId: vN.business_version_id,
              businessVersion: childBv,
              workingRevision: childWr,
              idempotentReplay: true,
            };
          }
        }
      }

      if (vN.version !== params.expectedVersion) {
        return {
          ok: false,
          code: 'VERSION_CONFLICT',
          message: 'Version conflict',
          currentStatus: vN.status,
        };
      }
      if (vN.status !== 'APPROVED') {
        return {
          ok: false,
          code: 'STATE_PRECONDITION_FAILED',
          message: `Cannot reopen: version is in status ${vN.status}, not APPROVED`,
          currentStatus: vN.status,
        };
      }

      const existingChild = await tx.queryOne<{ business_version_id: string }>(
        `SELECT business_version_id FROM finance_business_versions
          WHERE parent_version_id = ? AND status NOT IN ('SUPERSEDED', 'ARCHIVED', 'INVALIDATED')
          LIMIT 1`,
        [vN.business_version_id]
      );
      if (existingChild) {
        return {
          ok: false,
          code: 'DRAFT_ALREADY_EXISTS',
          message: 'An open draft already exists for this version',
          existingDraftVersionId: existingChild.business_version_id,
        };
      }

      const maxVersionRow = await tx.queryOne<{ max_version_no: number }>(
        `SELECT MAX(version_no) AS max_version_no FROM finance_business_versions WHERE artifact_id = ?`,
        [vN.artifact_id]
      );
      const nextVersionNo = (maxVersionRow?.max_version_no ?? vN.version_no) + 1;

      // BUG-GOLDCO-01 fix: persist version_kind/restatement_reason/restatement_class
      // on vN+1 itself, instead of leaving every reopened version defaulting to
      // version_kind='ORIGINAL' regardless of caller intent (WP-B06 §4.2).
      const versionKind: VersionKind = params.versionKind ?? 'ORIGINAL';
      const restatementReason = versionKind === 'RESTATED' ? (params.restatementReason ?? null) : null;
      const restatementClass = versionKind === 'RESTATED' ? (params.restatementClass ?? null) : null;

      const newBusinessVersionId = uuidv4();
      const newVersion = await tx.queryOne<BusinessVersionRow>(
        `INSERT INTO finance_business_versions (
           business_version_id, artifact_id, organization_id, version_no, status,
           parent_version_id, reopen_reason, reopened_by, reopened_at,
           engine_manifest_id, risk_tier, created_by,
           version_kind, restatement_reason, restatement_class
         ) VALUES (?, ?, ?, ?, 'DRAFT', ?, ?, ?, now(), ?, ?, ?, ?, ?, ?)
         RETURNING *`,
        [
          newBusinessVersionId,
          vN.artifact_id,
          params.organizationId,
          nextVersionNo,
          vN.business_version_id,
          params.reason,
          params.actorId,
          vN.engine_manifest_id,
          vN.risk_tier,
          params.actorId,
          versionKind,
          restatementReason,
          restatementClass,
        ]
      );
      if (!newVersion) throw new Error('finance_business_versions insert (reopen) returned no row');

      // Copy-on-write working revision. Demote the old "current" row first
      // (uq_finance_wr_one_current is a partial unique index on is_current) —
      // ordering matters within this one transaction/connection.
      const sourceRevision = await tx.queryOne<WorkingRevisionRow>(
        `SELECT * FROM finance_working_revisions WHERE artifact_id = ? AND organization_id = ? AND is_current = true`,
        [vN.artifact_id, params.organizationId]
      );

      await tx.queryRun(
        `UPDATE finance_working_revisions SET is_current = false WHERE artifact_id = ? AND is_current = true`,
        [vN.artifact_id]
      );

      const maxSeqRow = await tx.queryOne<{ max_seq: number }>(
        `SELECT MAX(revision_seq) AS max_seq FROM finance_working_revisions WHERE artifact_id = ?`,
        [vN.artifact_id]
      );
      const nextSeq = (maxSeqRow?.max_seq ?? 0) + 1;

      const newWorkingRevisionId = uuidv4();
      const newWorkingRevision = await tx.queryOne<WorkingRevisionRow>(
        `INSERT INTO finance_working_revisions (
           working_revision_id, artifact_id, organization_id, business_version_id,
           source_business_version_id, revision_seq, content_semantic_hash, is_current, edited_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, true, ?)
         RETURNING *`,
        [
          newWorkingRevisionId,
          vN.artifact_id,
          params.organizationId,
          newBusinessVersionId,
          vN.business_version_id,
          nextSeq,
          sourceRevision?.content_semantic_hash ?? null,
          params.actorId,
        ]
      );
      if (!newWorkingRevision) throw new Error('finance_working_revisions insert (reopen) returned no row');

      await tx.queryRun(
        `UPDATE finance_business_versions SET source_working_revision_id = ? WHERE business_version_id = ?`,
        [newWorkingRevisionId, newBusinessVersionId]
      );

      await tx.queryRun(
        `INSERT INTO artifact_lifecycle_events (
           event_id, organization_id, artifact_id, business_version_id, action, from_status, to_status,
           actor_id, reason, risk_tier, metadata, idempotency_key
         ) VALUES (?, ?, ?, ?, 'REOPEN', 'APPROVED', 'DRAFT', ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          params.organizationId,
          vN.artifact_id,
          newBusinessVersionId,
          params.actorId,
          params.reason,
          vN.risk_tier,
          JSON.stringify({ fromVersionId: vN.business_version_id }),
          params.idempotencyKey ?? null,
        ]
      );

      return {
        ok: true,
        previousBusinessVersionId: vN.business_version_id,
        businessVersion: { ...newVersion, source_working_revision_id: newWorkingRevisionId },
        workingRevision: newWorkingRevision,
        idempotentReplay: false,
      };
    });
  } catch (error: any) {
    const message = String(error?.message || error);
    if (error?.code === '23505' || /uq_finance_bv_one_open_child/.test(message)) {
      // Belt-and-suspenders: two concurrent reopen calls raced past the
      // app-level existingChild check (WP-B02 §6.3) and the partial unique
      // index caught the second one. Re-read to report the winner.
      const winner = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ business_version_id: string }>(
          `SELECT business_version_id FROM finance_business_versions
            WHERE parent_version_id = ? AND status NOT IN ('SUPERSEDED', 'ARCHIVED', 'INVALIDATED')
            LIMIT 1`,
          [params.businessVersionId]
        )
      );
      return {
        ok: false,
        code: 'DRAFT_ALREADY_EXISTS',
        message: 'An open draft already exists for this version',
        existingDraftVersionId: winner?.business_version_id,
      };
    }
    throw error;
  }
}
