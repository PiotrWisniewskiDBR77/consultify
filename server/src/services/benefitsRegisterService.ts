/**
 * Benefits Register Service (M14/F6 6.1)
 *
 * A benefit is a tracked outcome (KPI/ROI) an initiative is expected to deliver.
 * At initiative closure (M14) the realized KPI/ROI delta is handed off into the
 * benefits register so the benefit keeps being *tracked* into sustainment (M15).
 *
 * G1 fix (2026-07-10): this service used to own its own table
 * (`benefits_register`), a second, disconnected registry from the one the
 * REAL auto-trigger writes to (`initiative_benefits`, via
 * `executionResultsBridge.handoffFromClosure` — the live closure handoff at
 * `InitiativeController` on status → DONE). Nothing ever populated
 * `benefits_register` automatically, so the M14 panel backed by it
 * (`BenefitsRegisterPanel.tsx` → GET/POST `/api/benefits-register/benefits`)
 * was always empty unless a user manually clicked "+ Dodaj benefit".
 *
 * Per the rdzeń SSOT (`_KONCEPT_RDZEN_2026-07-10.md` §6.1): kanon =
 * `initiative_benefits`. `listBenefits` / `createBenefit` — the two functions
 * actually exercised by the M14 UI — now read/write `initiative_benefits`
 * directly (M14 CZYTA initiative_benefits). `handoffFromClosure` and
 * `promoteBenefitToKpi` below still target the legacy `benefits_register`
 * table; they have ZERO callers in the frontend today (audit 2026-07-10) so
 * they are left as-is (frozen) rather than migrated speculatively — retarget
 * or retire them in a follow-up if a real caller appears.
 *
 * node-pg, snake_case columns, org-scoped throughout. `?` placeholders are
 * translated to positional params by DbPromise.
 */

import { v4 as uuidv4 } from 'uuid';

import { createDefinition as createKpiDefinition } from './results/kpiDefinitionService.js';
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
 *
 * G1: reads the canonical `initiative_benefits` table (not the legacy
 * `benefits_register`) — the same table the M14→M15 closure handoff writes
 * to, so this now actually surfaces auto-materialized closure benefits, not
 * just manually-added ones. Column names are mapped to the `BenefitRecord`
 * shape the M14 panel already expects: `measurement_frequency` → `cadence`,
 * `source_tag` → `source`. `kpi_name` has no dedicated column on
 * `initiative_benefits` (the closure handoff writes the KPI name straight
 * into `name`) — returned as NULL, the panel already falls back to `name`.
 */
export async function listBenefits(
  organizationId: string,
  initiativeId?: string
): Promise<BenefitRecord[]> {
  if (!organizationId) return [];

  const params: unknown[] = [organizationId];
  let sql = `SELECT
       id, organization_id, initiative_id, name, owner_id,
       NULL AS kpi_name,
       baseline_value, target_value, current_value,
       measurement_frequency AS cadence,
       status,
       source_tag AS source,
       created_at, updated_at
     FROM initiative_benefits WHERE organization_id = ?`;

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
 *
 * G1: writes to the canonical `initiative_benefits` table. Unlike the legacy
 * `benefits_register`, `initiative_benefits.initiative_id` is NOT NULL (a
 * benefit/"Rezultat" is anchored to an initiative — see rdzeń SSOT §2.1
 * "REZULTAT/WARTOŚĆ jako węzeł pierwszej klasy"), so `initiativeId` is now
 * required and validated up front instead of silently landing an orphaned
 * row. The one caller today (`BenefitsRegisterPanel.tsx`, org-wide render
 * with no `initiativeId` prop) will get a clear 400 rather than a DB
 * constraint error — flagged as a follow-up to give that panel an initiative
 * picker.
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
  if (!data.initiativeId) {
    throw new Error(
      'createBenefit: initiativeId is required (initiative_benefits.initiative_id is NOT NULL)'
    );
  }

  const id = uuidv4();
  const ts = nowIso();
  const record: BenefitRecord = {
    id,
    organization_id: organizationId,
    initiative_id: data.initiativeId,
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
    `INSERT INTO initiative_benefits (
       id, organization_id, initiative_id, name, description, benefit_type, kpi_id,
       owner_id, baseline_value, target_value, current_value,
       measurement_frequency, status, source_tag,
       created_by, created_at, updated_at
     ) VALUES (?, ?, ?, ?, NULL, 'quantitative', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.organization_id,
      record.initiative_id,
      record.kpi_name ? `${record.name} (${record.kpi_name})` : record.name,
      record.owner_id,
      record.baseline_value,
      record.target_value ?? 0,
      record.current_value,
      record.cadence,
      record.status,
      record.source,
      null, // created_by — CreateBenefitInput has no separate actor field; route layer doesn't pass one either
      record.created_at,
      record.updated_at,
    ]
  );

  return record;
}

/**
 * @deprecated (G1, 2026-07-10) LEGACY / orphaned — writes to `benefits_register`,
 * which `listBenefits`/`createBenefit` above no longer read from. Zero
 * frontend callers as of this audit (only reachable via
 * `POST /api/benefits-register/benefits/handoff/:initiativeId`, which nothing
 * calls). The REAL, live closure handoff is
 * `executionResultsBridge.handoffFromClosure` (writes `initiative_benefits`,
 * auto-triggered by every DONE transition via `fireClosureHandoff`). Left
 * in place rather than deleted/retargeted to avoid touching an unexercised
 * surface speculatively — retarget to `initiative_benefits` (or remove) if a
 * real caller shows up.
 *
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
    (kpiDelta?.name || '').trim() || (kpiName ? `Benefit: ${kpiName}` : 'Initiative benefit');

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

/** Map a benefit review cadence to a KPI measurement frequency. */
function cadenceToFrequency(cadence: string | null | undefined): string {
  const c = String(cadence || '').toLowerCase();
  if (c.includes('day') || c.includes('dzien') || c.includes('dzień')) return 'DAILY';
  if (c.includes('week') || c.includes('tyg')) return 'WEEKLY';
  if (c.includes('quart') || c.includes('kwart')) return 'QUARTERLY';
  return 'MONTHLY';
}

export interface PromoteResult {
  kpiId: string;
  benefit: BenefitRecord;
  alreadyPromoted: boolean;
}

/**
 * @deprecated (G1, 2026-07-10) LEGACY / orphaned — operates on `benefits_register`.
 * The REAL, live promote flow the M15 inbox UI uses is
 * `POST /api/v8/results/benefits/:benefitId/promote` in `results.routes.ts`,
 * which reads/writes `initiative_benefits` directly (guarded by
 * `source_tag === CLOSURE_HANDOFF_SOURCE`). This function has no route
 * wired to a frontend caller — left in place rather than retargeted
 * speculatively; see the `handoffFromClosure` deprecation note above for the
 * same reasoning.
 *
 * M15/W1 (G1 bridge) — promote a benefits_register row (the M14 handoff inbox)
 * into a tracked KPI (initiative_kpis, the M15 canonical engine). This is what
 * makes the M14→M15 handoff *visible and tracked* instead of stranded. Org-scoped,
 * idempotent (a benefit already promoted returns its existing KPI).
 */
export async function promoteBenefitToKpi(
  organizationId: string,
  benefitId: string
): Promise<PromoteResult> {
  if (!organizationId) throw new Error('promoteBenefitToKpi: organizationId is required');
  if (!benefitId) throw new Error('promoteBenefitToKpi: benefitId is required');

  const benefit = await dbGet<BenefitRecord & { promoted_kpi_id?: string | null }>(
    `SELECT * FROM benefits_register WHERE id = ? AND organization_id = ?`,
    [benefitId, organizationId]
  );
  if (!benefit) throw new Error('benefit_not_found');

  if (benefit.promoted_kpi_id) {
    return { kpiId: benefit.promoted_kpi_id, benefit, alreadyPromoted: true };
  }

  // RES-02: canonical write goes through kpiDefinitionService — no direct SQL
  // against initiative_kpis here anymore (this was one of two independent
  // benefit-promotion writers; the other lives in v8/results.routes.ts
  // POST /benefits/:benefitId/promote — both create through the same
  // canonical service now).
  const kpiName = (benefit.kpi_name || benefit.name || 'Benefit KPI').trim();
  const created = await createKpiDefinition({
    organizationId,
    initiativeId: benefit.initiative_id,
    name: kpiName,
    description: `Przekazane z wdrożenia (M14) — ${benefit.name}`,
    unit: null,
    baselineValue: benefit.baseline_value ?? null,
    targetValue: benefit.target_value ?? null,
    measurementFrequency: cadenceToFrequency(benefit.cadence),
    alertThreshold: null,
    alertDirection: 'BELOW',
    ownerUserId: benefit.owner_id ?? null,
    direction: 'HIGHER_IS_BETTER',
    thresholdMode: 'PERCENT_FROM_TARGET',
    amberThresholdPct: 0.1,
    redThresholdPct: 0.2,
    currentValue: benefit.current_value ?? null,
    source: 'benefitsRegisterService',
    reason: `m14-benefit-promotion:${benefitId}`,
  });
  const kpiId = created.id;

  await dbRun(
    `UPDATE benefits_register SET promoted_kpi_id = ?, status = 'promoted', updated_at = ? WHERE id = ? AND organization_id = ?`,
    [kpiId, nowIso(), benefitId, organizationId]
  );

  logger.info?.('[benefitsRegister] promoted benefit to tracked KPI', {
    organizationId,
    benefitId,
    kpiId,
  });

  return { kpiId, benefit: { ...benefit, status: 'promoted' }, alreadyPromoted: false };
}

export const BenefitsRegisterService = {
  listBenefits,
  createBenefit,
  handoffFromClosure,
  promoteBenefitToKpi,
};

export default BenefitsRegisterService;
