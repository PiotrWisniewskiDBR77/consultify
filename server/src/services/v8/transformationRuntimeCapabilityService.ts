import { createHash } from 'node:crypto';

import { v4 as uuidv4 } from 'uuid';

import { queryAll, queryOne, withPgTransaction } from '../../utils/queryHelpers.js';

export type RuntimeCapabilityStatus = 'REAL' | 'PARTIAL' | 'BLOCKED' | 'EVIDENCE_MISSING';

export interface RuntimeEvidenceCheck {
  passed: boolean;
  evidenceRef?: string | null;
  observedAt?: string | null;
  detail?: string | null;
}

export interface RuntimeEvidenceContract {
  requiredChecks: string[];
}

export interface RuntimeCapability {
  runtimeCapabilityId: string;
  organizationId: string;
  lifecycleStage: string;
  capabilityKey: string;
  ownerModule: string;
  evidenceContract: RuntimeEvidenceContract;
  evidence: Record<string, RuntimeEvidenceCheck>;
  evidenceDigest: string | null;
  derivedStatus: RuntimeCapabilityStatus;
  statusReason: string;
  observedAt: string | null;
  version: number;
  updatedAt: string;
}

interface RuntimeCapabilityRow {
  runtime_capability_id: string;
  organization_id: string;
  lifecycle_stage: string;
  capability_key: string;
  owner_module: string;
  evidence_contract_json: RuntimeEvidenceContract | string;
  evidence_json: Record<string, RuntimeEvidenceCheck> | string;
  evidence_digest: string | null;
  derived_status: RuntimeCapabilityStatus;
  status_reason: string;
  observed_at: string | null;
  version: number;
  updated_at: string;
}

function jsonValue<T>(value: T | string, fallback: T): T {
  if (typeof value !== 'string') return value ?? fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function digest(value: unknown): string {
  return createHash('sha256').update(stable(value)).digest('hex');
}

export function evaluateRuntimeEvidence(
  contract: RuntimeEvidenceContract,
  evidence: Record<string, RuntimeEvidenceCheck>
): { status: RuntimeCapabilityStatus; reason: string; digest: string } {
  const required = [
    ...new Set(contract.requiredChecks.map((value) => value.trim()).filter(Boolean)),
  ].sort();
  const normalizedContract = { requiredChecks: required };
  const evidenceDigest = digest({ contract: normalizedContract, evidence });
  if (required.length === 0) {
    return {
      status: 'EVIDENCE_MISSING',
      reason: 'Evidence contract has no required checks.',
      digest: evidenceDigest,
    };
  }
  const present = required.filter((key) => evidence[key]);
  if (present.length === 0) {
    return {
      status: 'EVIDENCE_MISSING',
      reason: 'No required runtime evidence has been reported.',
      digest: evidenceDigest,
    };
  }
  const failed = required.filter((key) => evidence[key]?.passed === false);
  if (failed.length > 0) {
    return {
      status: 'BLOCKED',
      reason: `Required checks failed: ${failed.join(', ')}.`,
      digest: evidenceDigest,
    };
  }
  const incomplete = required.filter((key) => {
    const check = evidence[key];
    return !check?.passed || !check.evidenceRef?.trim() || !check.observedAt;
  });
  if (incomplete.length > 0) {
    return {
      status: 'PARTIAL',
      reason: `Evidence incomplete: ${incomplete.join(', ')}.`,
      digest: evidenceDigest,
    };
  }
  return {
    status: 'REAL',
    reason: 'Every required runtime check passed with provenance and observation time.',
    digest: evidenceDigest,
  };
}

function toPublic(row: RuntimeCapabilityRow): RuntimeCapability {
  return {
    runtimeCapabilityId: row.runtime_capability_id,
    organizationId: row.organization_id,
    lifecycleStage: row.lifecycle_stage,
    capabilityKey: row.capability_key,
    ownerModule: row.owner_module,
    evidenceContract: jsonValue(row.evidence_contract_json, { requiredChecks: [] }),
    evidence: jsonValue(row.evidence_json, {}),
    evidenceDigest: row.evidence_digest,
    derivedStatus: row.derived_status,
    statusReason: row.status_reason,
    observedAt: row.observed_at,
    version: Number(row.version),
    updatedAt: row.updated_at,
  };
}

export async function registerRuntimeCapability(params: {
  organizationId: string;
  actorUserId: string;
  lifecycleStage: string;
  capabilityKey: string;
  ownerModule: string;
  evidenceContract: RuntimeEvidenceContract;
}): Promise<RuntimeCapability> {
  const requiredChecks = [
    ...new Set(params.evidenceContract.requiredChecks.map((v) => v.trim()).filter(Boolean)),
  ].sort();
  if (
    !params.lifecycleStage.trim() ||
    !params.capabilityKey.trim() ||
    !params.ownerModule.trim() ||
    requiredChecks.length === 0
  ) {
    throw new Error('runtime_capability_invalid_registration');
  }
  const existing = await queryOne<RuntimeCapabilityRow>(
    `SELECT * FROM transformation_runtime_capabilities
      WHERE organization_id=? AND lifecycle_stage=?`,
    [params.organizationId, params.lifecycleStage]
  );
  const contract = { requiredChecks };
  if (existing) {
    if (
      existing.capability_key !== params.capabilityKey ||
      existing.owner_module !== params.ownerModule ||
      digest(jsonValue(existing.evidence_contract_json, { requiredChecks: [] })) !==
        digest(contract)
    ) {
      throw new Error('runtime_capability_registration_conflict');
    }
    return toPublic(existing);
  }
  const id = uuidv4();
  await withPgTransaction(async (client) => {
    await client.query(
      `INSERT INTO transformation_runtime_capabilities
       (runtime_capability_id,organization_id,lifecycle_stage,capability_key,owner_module,
        evidence_contract_json,registered_by_user_id,updated_by_user_id)
       VALUES (?,?,?,?,?,?::jsonb,?,?) ON CONFLICT (organization_id,lifecycle_stage) DO NOTHING`,
      [
        id,
        params.organizationId,
        params.lifecycleStage,
        params.capabilityKey,
        params.ownerModule,
        JSON.stringify(contract),
        params.actorUserId,
        params.actorUserId,
      ]
    );
  });
  const row = await queryOne<RuntimeCapabilityRow>(
    `SELECT * FROM transformation_runtime_capabilities WHERE organization_id=? AND lifecycle_stage=?`,
    [params.organizationId, params.lifecycleStage]
  );
  if (!row) throw new Error('runtime_capability_registration_failed');
  if (
    row.capability_key !== params.capabilityKey ||
    row.owner_module !== params.ownerModule ||
    digest(jsonValue(row.evidence_contract_json, { requiredChecks: [] })) !== digest(contract)
  ) {
    throw new Error('runtime_capability_registration_conflict');
  }
  return toPublic(row);
}

export async function reportRuntimeEvidence(params: {
  organizationId: string;
  actorUserId: string;
  lifecycleStage: string;
  evidence: Record<string, RuntimeEvidenceCheck>;
}): Promise<RuntimeCapability> {
  await withPgTransaction(async (client) => {
    const result = await client.query<RuntimeCapabilityRow>(
      `SELECT * FROM transformation_runtime_capabilities
        WHERE organization_id=? AND lifecycle_stage=? FOR UPDATE`,
      [params.organizationId, params.lifecycleStage]
    );
    const current = result.rows[0];
    if (!current) throw new Error('runtime_capability_not_found');
    const contract = jsonValue(current.evidence_contract_json, { requiredChecks: [] });
    const evaluation = evaluateRuntimeEvidence(contract, params.evidence);
    if (current.evidence_digest === evaluation.digest) return;
    const observedAt =
      Object.values(params.evidence)
        .map((check) => check.observedAt)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? null;
    await client.query(
      `UPDATE transformation_runtime_capabilities SET evidence_json=?::jsonb,evidence_digest=?,
       derived_status=?,status_reason=?,observed_at=?,updated_by_user_id=?,version=version+1,updated_at=NOW()
       WHERE runtime_capability_id=? AND organization_id=?`,
      [
        JSON.stringify(params.evidence),
        evaluation.digest,
        evaluation.status,
        evaluation.reason,
        observedAt,
        params.actorUserId,
        current.runtime_capability_id,
        params.organizationId,
      ]
    );
  });
  const row = await queryOne<RuntimeCapabilityRow>(
    `SELECT * FROM transformation_runtime_capabilities WHERE organization_id=? AND lifecycle_stage=?`,
    [params.organizationId, params.lifecycleStage]
  );
  if (!row) throw new Error('runtime_capability_not_found');
  return toPublic(row);
}

export async function listRuntimeCapabilities(
  organizationId: string
): Promise<RuntimeCapability[]> {
  const rows = await queryAll<RuntimeCapabilityRow>(
    `SELECT * FROM transformation_runtime_capabilities WHERE organization_id=? ORDER BY lifecycle_stage`,
    [organizationId]
  );
  return rows.map(toPublic);
}

export async function reconcileTransformationPlan(params: {
  organizationId: string;
  transformationCaseId: string;
  actorUserId: string;
}): Promise<{ changedSteps: number; idempotentReplay: boolean; registryDigest: string }> {
  return withPgTransaction(async (client) => {
    const planResult = await client.query<{ plan_id: string }>(
      `SELECT active_plan_id AS plan_id FROM transformation_cases
        WHERE transformation_case_id=? AND organization_id=? FOR UPDATE`,
      [params.transformationCaseId, params.organizationId]
    );
    const planId = planResult.rows[0]?.plan_id;
    if (!planId) throw new Error('transformation_case_or_active_plan_not_found');
    const registry = await client.query<RuntimeCapabilityRow>(
      `SELECT * FROM transformation_runtime_capabilities WHERE organization_id=? ORDER BY lifecycle_stage`,
      [params.organizationId]
    );
    const registryDigest = digest(
      registry.rows.map((row) => ({
        lifecycleStage: row.lifecycle_stage,
        evidenceDigest: row.evidence_digest,
        status: row.derived_status,
      }))
    );
    const replay = await client.query<{ reconciliation_id: string }>(
      `SELECT reconciliation_id FROM transformation_capability_reconciliations
        WHERE organization_id=? AND transformation_case_id=? AND plan_id=? AND registry_digest=?`,
      [params.organizationId, params.transformationCaseId, planId, registryDigest]
    );
    if (replay.rows[0]) return { changedSteps: 0, idempotentReplay: true, registryDigest };
    let changedSteps = 0;
    for (const capability of registry.rows) {
      const blockerReason = capability.derived_status === 'REAL' ? null : capability.status_reason;
      const updated = await client.query(
        `UPDATE transformation_plan_steps SET capability_status=?,blocker_reason=?
          WHERE plan_id=? AND transformation_case_id=? AND organization_id=? AND lifecycle_stage=?
            AND (capability_status IS DISTINCT FROM ? OR blocker_reason IS DISTINCT FROM ?)`,
        [
          capability.derived_status,
          blockerReason,
          planId,
          params.transformationCaseId,
          params.organizationId,
          capability.lifecycle_stage,
          capability.derived_status,
          blockerReason,
        ]
      );
      changedSteps += updated.rowCount ?? 0;
    }
    await client.query(
      `INSERT INTO transformation_capability_reconciliations
       (reconciliation_id,organization_id,transformation_case_id,plan_id,registry_digest,
        changed_steps,reconciled_by_user_id,detail_json)
       VALUES (?,?,?,?,?,?,?,?::jsonb)`,
      [
        uuidv4(),
        params.organizationId,
        params.transformationCaseId,
        planId,
        registryDigest,
        changedSteps,
        params.actorUserId,
        JSON.stringify({ capabilityCount: registry.rows.length }),
      ]
    );
    return { changedSteps, idempotentReplay: false, registryDigest };
  });
}
