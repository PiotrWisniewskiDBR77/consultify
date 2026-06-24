/**
 * Benefits Register Service (M14/F6 6.1)
 *
 * A benefit is a tracked outcome (KPI/ROI) an initiative is expected to deliver.
 * At initiative closure (M14) the realized KPI/ROI delta is handed off into the
 * benefits register so the benefit keeps being *tracked* into sustainment (M15).
 *
 * This is the real persistence behind what was previously a "preview only"
 * closure handoff: `handoffFromClosure` now writes an actual org-scoped row
 * tagged `source = 'M14_CLOSURE_HANDOFF'`.
 *
 * node-pg, snake_case columns, org-scoped throughout. `?` placeholders are
 * translated to positional params by DbPromise.
 */

import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

export const BENEFIT_HANDOFF_SOURCE = 'M14_CLOSURE_HANDOFF';

export interface BenefitRecord {
  id: string;
  organization_id: string;
  initiative_id: string | null;
  name: string;
  owner_id: string | null;
  kpi_name: string | null;
  baseline_value: number | null;
  target_value: number | null;
  current_value: number | null;
  cadence: string | null;
  status: string;
  source: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBenefitInput {
  initiativeId?: string | null;
  name: string;
  ownerId?: string | null;
  kpiName?: string | null;
  baselineValue?: number | null;
  targetValue?: number | null;
  currentValue?: number | null;
  cadence?: string | null;
  status?: string;
  source?: string | null;
}

/**
 * Closure KPI/ROI delta produced by the M14 closure step. Carries the data
 * needed to seed a tracked benefit: which KPI, who owns it, the baseline it
 * started from, the target it should hit, where it landed, and how often it is
 * reviewed.
 */
export interface ClosureKpiDelta {
  name?: string;
  kpiName?: string;
  ownerId?: string | null;
  baselineValue?: number | null;
  targetValue?: number | null;
  currentValue?: number | null;
  cadence?: string | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * List benefits for an organization, optionally scoped to one initiative.
 * Always org-scoped.
 */
export async function listBenefits(
  organizationId: string,
  initiativeId?: string
): Promise<BenefitRecord[]> {
  if (!organizationId) return [];

  const params: unknown[] = [organizationId];
  let sql = `SELECT * FROM benefits_register WHERE organization_id = ?`;

  if (initiativeId) {
    sql += ` AND initiative_id = ?`;
    params.push(initiativeId);
  }

  sql += ` ORDER BY created_at DESC`;

  const rows = await dbAll<BenefitRecord>(sql, params);
  return rows || [];
}

/**
 * Create a benefit row. Org-scoped: organizationId is required and stamped on
 * the row. Returns the persisted record.
 */
export async function createBenefit(
  organizationId: string,
  data: CreateBenefitInput
): Promise<BenefitRecord> {
  if (!organizationId) {
    throw new Error('createBenefit: organizationId is required');
  }
  if (!data || !data.name || !data.name.trim()) {
    throw new Error('createBenefit: name is required');
  }

  const id = uuidv4();
  const ts = nowIso();
  const record: BenefitRecord = {
    id,
    organization_id: organizationId,
    initiative_id: data.initiativeId ?? null,
    name: data.name.trim(),
    owner_id: data.ownerId ?? null,
    kpi_name: data.kpiName ?? null,
    baseline_value: toNumberOrNull(data.baselineValue),
    target_value: toNumberOrNull(data.targetValue),
    current_value: toNumberOrNull(data.currentValue),
    cadence: data.cadence ?? null,
    status: data.status?.trim() || 'tracking',
    source: data.source ?? 'MANUAL',
    created_at: ts,
    updated_at: ts,
  };

  await dbRun(
    `INSERT INTO benefits_register (
       id, organization_id, initiative_id, name, owner_id, kpi_name,
       baseline_value, target_value, current_value, cadence, status, source,
       created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.organization_id,
      record.initiative_id,
      record.name,
      record.owner_id,
      record.kpi_name,
      record.baseline_value,
      record.target_value,
      record.current_value,
      record.cadence,
      record.status,
      record.source,
      record.created_at,
      record.updated_at,
    ]
  );

  return record;
}

/**
 * Handoff M14 → M15: create a tracked benefit from an initiative's realized
 * KPI/ROI delta at closure. Replaces the previous preview-only behaviour with
 * a real, org-scoped persisted row tagged `source = 'M14_CLOSURE_HANDOFF'`.
 *
 * Idempotent-ish: if a handoff benefit already exists for this org + initiative
 * + KPI, the existing record is returned rather than duplicating it.
 */
export async function handoffFromClosure(
  organizationId: string,
  initiativeId: string,
  kpiDelta: ClosureKpiDelta
): Promise<BenefitRecord> {
  if (!organizationId) {
    throw new Error('handoffFromClosure: organizationId is required');
  }
  if (!initiativeId) {
    throw new Error('handoffFromClosure: initiativeId is required');
  }

  const kpiName = (kpiDelta?.kpiName || '').trim() || null;
  const name =
    (kpiDelta?.name || '').trim() ||
    (kpiName ? `Benefit: ${kpiName}` : 'Initiative benefit');

  // Dedupe against an existing handoff row for the same KPI on this initiative.
  const existing = await dbGet<BenefitRecord>(
    `SELECT * FROM benefits_register
     WHERE organization_id = ? AND initiative_id = ? AND source = ?
       AND ((kpi_name IS NULL AND ? IS NULL) OR kpi_name = ?)
     ORDER BY created_at DESC LIMIT 1`,
    [organizationId, initiativeId, BENEFIT_HANDOFF_SOURCE, kpiName, kpiName]
  );

  if (existing) {
    logger.info?.('[benefitsRegister] handoff dedupe — returning existing benefit', {
      organizationId,
      initiativeId,
      benefitId: existing.id,
    });
    return existing;
  }

  return createBenefit(organizationId, {
    initiativeId,
    name,
    ownerId: kpiDelta?.ownerId ?? null,
    kpiName,
    baselineValue: toNumberOrNull(kpiDelta?.baselineValue),
    targetValue: toNumberOrNull(kpiDelta?.targetValue),
    currentValue: toNumberOrNull(kpiDelta?.currentValue),
    cadence: kpiDelta?.cadence ?? null,
    status: 'tracking',
    source: BENEFIT_HANDOFF_SOURCE,
  });
}

export const BenefitsRegisterService = {
  listBenefits,
  createBenefit,
  handoffFromClosure,
};

export default BenefitsRegisterService;
