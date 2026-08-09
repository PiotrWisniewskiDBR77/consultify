import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import {
  getCanonicalStatementTypeOrder,
  getCanonicalStatementTypes,
} from './financeCanonicalRegistry.js';
import {
  resolvePeriodLabel,
  serializeRowPeriodFields,
  serializeRowsPeriodFields,
  toPeriodIsoDate,
} from './financePeriodFormat.js';
import {
  type PeriodStatements,
  RECONCILE_ENFORCE,
  reconcileStatements,
  shouldBlockReady,
} from './reconciliationService.js';

export type StatementPackReadinessStatus = 'pending' | 'recoverable' | 'ready' | 'rejected';

type PackStatementRow = {
  id: string;
  organization_id: string;
  entity_name?: string | null;
  statement_type: string;
  period_start: string;
  period_end: string;
  period_label?: string | null;
  currency?: string | null;
  scaling?: string | null;
  status?: string | null;
  readiness_status?: string | null;
  readiness_score?: number | null;
  quality_summary?: string | null;
  source_file_name?: string | null;
  statement_pack_id?: string | null;
};

type PackAggregate = {
  packStatus: string;
  packReadinessStatus: StatementPackReadinessStatus;
  packReadinessScore: number;
  packQualitySummary: string;
  packQualityReasonCodes: string[];
  missingStatementTypes: string[];
  statementTypesPresent: string[];
  sourceStatementCount: number;
};

function isSchemaCompatError(error: unknown): boolean {
  const message = String((error as Error)?.message || error || '').toLowerCase();
  return (
    message.includes('does not exist') ||
    message.includes('no such column') ||
    message.includes('no such table') ||
    message.includes('undefined column')
  );
}

function normalizeText(value: unknown): string {
  return String(value || '').trim();
}

function toJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function normalizeStatementType(value: unknown): string {
  const normalized = normalizeText(value).toUpperCase();
  if (normalized === 'PL') return 'P&L';
  return normalized;
}

/**
 * FIN-005 root cause: `period_end` is a Postgres `DATE`, so node-pg hands this
 * function a JS `Date`. The old body was
 * `normalizeText(period_label) || normalizeText(period_end)` — i.e. `String(date)`
 * — which wrote `Thu Dec 31 2026 00:00:00 GMT+0000 (Coordinated Universal Time)`
 * into `financial_statement_packs.period_label`, where the UI then displayed it.
 * `resolvePeriodLabel` keeps the same fallback chain with the leak closed.
 */
function packPeriodLabel(statements: PackStatementRow[]): string {
  return resolvePeriodLabel(statements[0]?.period_label, statements[0]?.period_end);
}

function computePackAggregate(statements: PackStatementRow[]): PackAggregate {
  const requiredTypes = getCanonicalStatementTypes();
  const normalized = statements.filter(Boolean);
  const byType = new Map<string, PackStatementRow[]>();

  for (const statement of normalized) {
    const type = normalizeStatementType(statement.statement_type);
    const existing = byType.get(type) || [];
    existing.push(statement);
    byType.set(type, existing);
  }

  const statementTypesPresent = Array.from(byType.keys());
  const missingStatementTypes = requiredTypes.filter((type) => !byType.has(type));
  const duplicateTypes = Array.from(byType.entries())
    .filter(([, rows]) => rows.length > 1)
    .map(([type]) => type);
  const currencySet = new Set(
    normalized.map((statement) => normalizeText(statement.currency).toUpperCase()).filter(Boolean)
  );
  const scalingSet = new Set(
    normalized.map((statement) => normalizeText(statement.scaling).toLowerCase()).filter(Boolean)
  );
  const periodSet = new Set(
    normalized
      .map(
        (statement) =>
          `${normalizeText(statement.period_start)}:${normalizeText(statement.period_end)}:${normalizeText(statement.period_label)}`
      )
      .filter(Boolean)
  );
  const readinessValues = normalized.map((statement) =>
    normalizeText(statement.readiness_status).toLowerCase()
  );
  const rejectedCount = readinessValues.filter((value) => value === 'rejected').length;
  const readyCount = readinessValues.filter((value) => value === 'ready').length;
  const recoverableCount = readinessValues.filter((value) => value === 'recoverable').length;
  const pendingCount = readinessValues.filter((value) => !value || value === 'pending').length;
  const scores = normalized
    .map((statement) => Number(statement.readiness_score ?? 0))
    .filter((value) => Number.isFinite(value));

  const reasonCodes: string[] = [];
  if (missingStatementTypes.includes('P&L')) reasonCodes.push('MISSING_PL');
  if (missingStatementTypes.includes('BS')) reasonCodes.push('MISSING_BS');
  if (missingStatementTypes.includes('CF')) reasonCodes.push('MISSING_CF');
  if (duplicateTypes.length > 0) reasonCodes.push('DUPLICATE_STATEMENT_TYPE');
  if (currencySet.size > 1) reasonCodes.push('INCONSISTENT_CURRENCY');
  if (scalingSet.size > 1) reasonCodes.push('INCONSISTENT_SCALING');
  if (periodSet.size > 1) reasonCodes.push('INCONSISTENT_PERIOD');
  if (rejectedCount > 0) reasonCodes.push('HAS_REJECTED_STATEMENT');
  if (pendingCount > 0) reasonCodes.push('HAS_PENDING_STATEMENT');
  if (recoverableCount > 0) reasonCodes.push('HAS_RECOVERABLE_STATEMENT');

  let packReadinessStatus: StatementPackReadinessStatus = 'pending';
  if (normalized.length === 0) {
    packReadinessStatus = 'pending';
  } else if (
    missingStatementTypes.length === 0 &&
    duplicateTypes.length === 0 &&
    currencySet.size <= 1 &&
    scalingSet.size <= 1 &&
    periodSet.size <= 1 &&
    readyCount === requiredTypes.length
  ) {
    packReadinessStatus = 'ready';
  } else if (rejectedCount === normalized.length && normalized.length > 0) {
    packReadinessStatus = 'rejected';
  } else if (readyCount > 0 || recoverableCount > 0 || rejectedCount > 0) {
    packReadinessStatus = 'recoverable';
  }

  const scoreBase =
    scores.length > 0
      ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length)
      : 0;
  const completenessBonus = Math.round((statementTypesPresent.length / requiredTypes.length) * 25);
  const penalty =
    missingStatementTypes.length * 15 +
    duplicateTypes.length * 10 +
    Math.max(0, currencySet.size - 1) * 15 +
    Math.max(0, scalingSet.size - 1) * 10 +
    Math.max(0, periodSet.size - 1) * 20;
  const packReadinessScore = Math.max(0, Math.min(100, scoreBase + completenessBonus - penalty));

  const allConfirmed =
    missingStatementTypes.length === 0 &&
    duplicateTypes.length === 0 &&
    normalized.every((statement) => normalizeText(statement.status).toLowerCase() === 'confirmed');
  const packStatus =
    packReadinessStatus === 'ready'
      ? allConfirmed
        ? 'confirmed'
        : 'ready'
      : reasonCodes.some(
            (code) => code.startsWith('INCONSISTENT_') || code === 'DUPLICATE_STATEMENT_TYPE'
          )
        ? 'needs_review'
        : normalized.length >= requiredTypes.length
          ? 'needs_review'
          : 'partial';

  let packQualitySummary = 'Statement pack is still collecting required statements.';
  if (packReadinessStatus === 'ready') {
    packQualitySummary =
      'Statement pack contains a complete ready set of P&L, Balance Sheet, and Cash Flow.';
  } else if (packReadinessStatus === 'rejected') {
    packQualitySummary =
      'All statements in this pack are rejected and the pack cannot seed downstream work.';
  } else if (reasonCodes.length > 0) {
    packQualitySummary = `Statement pack needs attention: ${reasonCodes.join(', ')}.`;
  }

  return {
    packStatus,
    packReadinessStatus,
    packReadinessScore,
    packQualitySummary,
    packQualityReasonCodes: reasonCodes,
    missingStatementTypes,
    statementTypesPresent,
    sourceStatementCount: normalized.length,
  };
}

async function loadStatementForPack(statementId: string): Promise<PackStatementRow | null> {
  try {
    return (
      (await dbGet<PackStatementRow>(
        `SELECT id, organization_id, entity_name, statement_type, period_start, period_end, period_label,
                currency, scaling, status, readiness_status, readiness_score, quality_summary, source_file_name,
                statement_pack_id
         FROM financial_statements
         WHERE id = ?`,
        [statementId]
      )) || null
    );
  } catch (error) {
    if (!isSchemaCompatError(error)) throw error;
    return null;
  }
}

/**
 * Codex FIN-06 Blocker 1 fix (2026-08-02): the "bonus" columns this file
 * elsewhere assumes exist on `financial_statements`
 * (`readiness_status`/`readiness_score`/`quality_summary`/
 * `quality_reason_codes`/`values_version`) and on `financial_statement_values`
 * (`is_non_financial`) are added ONLY by `20260719_baseline_gap.sql` — a
 * best-effort prod-baseline-sync migration that is documented (see this
 * repo's own FIN-005 fresh-schema tooling notes) to fail/skip on a genuinely
 * empty database. A DB bootstrapped from a production baseline snapshot has
 * them; a DB migrated purely from `server/migrations` from scratch does not.
 *
 * The PREVIOUS code here called plain `dbAll()` (default `fallback: true`)
 * referencing those columns directly. On a schema missing them, Postgres
 * throws "column does not exist" -> `DbPromise.ts`'s default fallback
 * silently resolves `[]` -> every caller (including FIN-06's Statement Pack
 * candidate-handoff preview) saw an empty statements array and reported
 * "P&L x0, BS x0, CF x0" as if that were a real, successful, empty result —
 * indistinguishable from a genuinely empty pack. Root-caused independently
 * against a real, freshly-migrated Postgres instance, not assumed.
 *
 * Fix: probe with the full column list using `{ fallback: false }` (so a
 * genuine query error THROWS instead of being swallowed); if it throws a
 * schema-compat error specifically (`isSchemaCompatError`, the exact
 * predicate `loadStatementForPack` above already uses for this same class of
 * gap), retry with ONLY the columns guaranteed present by the base
 * `20260316_financial_statement_packs.sql` migration's unconditional
 * `CREATE TABLE financial_statements` — which is everything FIN-06's
 * statement-type counting actually needs (`statement_type`). Any OTHER
 * error (not a recognized schema-compat gap) is re-thrown, not masked —
 * callers must fail closed, never show a fabricated empty result.
 */
async function loadPackStatementsWithSchemaCompat(
  packId: string,
  organizationId: string
): Promise<any[]> {
  const fullSql = `SELECT fs.id, fs.statement_type, fs.period_start, fs.period_end, fs.period_label, fs.currency, fs.scaling,
            fs.source_file_name, fs.validation_status, fs.status, fs.readiness_status, fs.readiness_score,
            fs.quality_summary, fs.quality_reason_codes, fs.values_version, fs.updated_at, fs.created_at,
            COUNT(fsv.id) FILTER (WHERE COALESCE(fsv.is_non_financial, FALSE) = FALSE) AS total_line_count,
            COUNT(fsv.id) FILTER (WHERE COALESCE(fsv.is_non_financial, FALSE) = FALSE AND fsv.canonical_line_id IS NOT NULL) AS mapped_line_count,
            COUNT(fsv.id) FILTER (WHERE COALESCE(fsv.is_non_financial, FALSE) = FALSE AND fsv.canonical_line_id IS NULL) AS unmapped_line_count,
            COUNT(fsvl.id) FILTER (WHERE fsvl.validation_scope = 'statement' AND fsvl.status = 'fail') AS validation_fail_count,
            COUNT(fsvl.id) FILTER (WHERE fsvl.validation_scope = 'statement' AND fsvl.status = 'warning') AS validation_warning_count
     FROM financial_statements fs
     LEFT JOIN financial_statement_values fsv ON fsv.statement_id = fs.id
     LEFT JOIN financial_statement_validations fsvl ON fsvl.statement_id = fs.id
     WHERE fs.statement_pack_id = ?
       AND fs.organization_id = ?
     GROUP BY fs.id
     ORDER BY CASE fs.statement_type WHEN 'P&L' THEN 1 WHEN 'BS' THEN 2 WHEN 'CF' THEN 3 ELSE 9 END`;
  try {
    return await dbAll<any>(fullSql, [packId, organizationId], { fallback: false });
  } catch (error) {
    if (!isSchemaCompatError(error)) throw error;
  }

  // Schema-compat fallback: only columns the base migration guarantees.
  const coreSql = `SELECT fs.id, fs.statement_type, fs.period_start, fs.period_end, fs.period_label, fs.currency, fs.scaling,
            fs.source_file_name, fs.validation_status, fs.status, fs.updated_at, fs.created_at,
            COUNT(fsv.id) AS total_line_count,
            COUNT(fsv.id) FILTER (WHERE fsv.canonical_line_id IS NOT NULL) AS mapped_line_count,
            COUNT(fsv.id) FILTER (WHERE fsv.canonical_line_id IS NULL) AS unmapped_line_count,
            COUNT(fsvl.id) FILTER (WHERE fsvl.validation_scope = 'statement' AND fsvl.status = 'fail') AS validation_fail_count,
            COUNT(fsvl.id) FILTER (WHERE fsvl.validation_scope = 'statement' AND fsvl.status = 'warning') AS validation_warning_count
     FROM financial_statements fs
     LEFT JOIN financial_statement_values fsv ON fsv.statement_id = fs.id
     LEFT JOIN financial_statement_validations fsvl ON fsvl.statement_id = fs.id
     WHERE fs.statement_pack_id = ?
       AND fs.organization_id = ?
     GROUP BY fs.id
     ORDER BY CASE fs.statement_type WHEN 'P&L' THEN 1 WHEN 'BS' THEN 2 WHEN 'CF' THEN 3 ELSE 9 END`;
  return dbAll<any>(coreSql, [packId, organizationId], { fallback: false });
}

/**
 * Same Codex FIN-06 Blocker 1 root cause and fix strategy as
 * `loadPackStatementsWithSchemaCompat` above, for `recomputeStatementPack`'s
 * differently-shaped read (raw statement rows feeding `computePackAggregate`,
 * not the joined per-statement line-count view `getStatementPackDetail`
 * exposes). `recomputeStatementPack` is the function that actually WRITES
 * `pack_readiness_status` -- the exact signal FIN-06's Statement Pack
 * eligibility gate depends on -- so silently treating a schema-compat query
 * failure as "this pack has zero statements" here would have been a live,
 * broader data-integrity risk (`pruneEmptyPack` on a genuinely non-empty
 * pack), not just a cosmetic preview bug.
 */
async function loadRawPackStatementsWithSchemaCompat(packId: string): Promise<PackStatementRow[]> {
  const fullSql = `SELECT id, organization_id, entity_name, statement_type, period_start, period_end, period_label,
            currency, scaling, status, readiness_status, readiness_score, quality_summary, source_file_name,
            statement_pack_id
     FROM financial_statements
     WHERE statement_pack_id = ?
     ORDER BY statement_type, updated_at DESC`;
  try {
    return await dbAll<PackStatementRow>(fullSql, [packId], { fallback: false });
  } catch (error) {
    if (!isSchemaCompatError(error)) throw error;
  }

  const coreSql = `SELECT id, organization_id, entity_name, statement_type, period_start, period_end, period_label,
            currency, scaling, status, source_file_name, statement_pack_id
     FROM financial_statements
     WHERE statement_pack_id = ?
     ORDER BY statement_type, updated_at DESC`;
  return dbAll<PackStatementRow>(coreSql, [packId], { fallback: false });
}

async function findExistingPack(statement: PackStatementRow): Promise<string | null> {
  const entityName = normalizeText(statement.entity_name);
  const row = await dbGet<{ id?: string }>(
    `SELECT id
     FROM financial_statement_packs
     WHERE organization_id = ?
       AND COALESCE(entity_name, '') = ?
       AND period_start = ?
       AND period_end = ?
       AND COALESCE(currency, 'PLN') = ?
       AND COALESCE(scaling, 'units') = ?
       AND NOT EXISTS (
         SELECT 1
         FROM financial_statements fs
         WHERE fs.statement_pack_id = financial_statement_packs.id
           AND fs.id <> ?
           AND COALESCE(fs.status, 'draft') <> 'archived'
           AND fs.statement_type = ?
       )
     ORDER BY updated_at DESC
     LIMIT 1`,
    [
      statement.organization_id,
      entityName,
      statement.period_start,
      statement.period_end,
      normalizeText(statement.currency) || 'PLN',
      normalizeText(statement.scaling) || 'units',
      statement.id,
      normalizeStatementType(statement.statement_type),
    ]
  );
  return normalizeText(row?.id) || null;
}

async function createPack(statement: PackStatementRow): Promise<string> {
  const packId = uuidv4();
  await dbRun(
    `INSERT INTO financial_statement_packs
      (id, organization_id, entity_name, period_start, period_end, period_label, currency, scaling, pack_status,
       pack_readiness_status, pack_readiness_score, pack_quality_summary, pack_quality_reason_codes,
       source_statement_count, missing_statement_types, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', 'pending', 0, ?, ?, 0, ?, ?)`,
    [
      packId,
      statement.organization_id,
      normalizeText(statement.entity_name) || null,
      statement.period_start,
      statement.period_end,
      // Same Date-leak guard as packPeriodLabel: the source statement's label
      // may itself be a raw Date value coming back from a Postgres DATE column.
      resolvePeriodLabel(statement.period_label, statement.period_end) || null,
      normalizeText(statement.currency) || 'PLN',
      normalizeText(statement.scaling) || 'units',
      'Statement pack created from initial statement import.',
      '[]',
      toJson(['P&L', 'BS', 'CF']),
      toJson({
        createdFromStatementId: statement.id,
      }),
    ]
  );
  return packId;
}

async function assignStatementToPack(statementId: string, packId: string | null): Promise<void> {
  await dbRun(
    `UPDATE financial_statements
     SET statement_pack_id = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [packId, statementId]
  );
}

async function pruneEmptyPack(packId: string): Promise<void> {
  const countRow = await dbGet<{ total?: number }>(
    `SELECT COUNT(*) AS total
     FROM financial_statements
     WHERE statement_pack_id = ?`,
    [packId]
  );
  if (Number(countRow?.total || 0) > 0) return;
  await dbRun(`DELETE FROM financial_statement_packs WHERE id = ?`, [packId]);
}

async function persistPackValidations(packId: string, aggregate: PackAggregate): Promise<void> {
  try {
    await dbRun(
      `DELETE FROM financial_statement_validations
       WHERE statement_pack_id = ? AND validation_scope = 'pack'`,
      [packId],
      { fallback: false }
    );
  } catch (error) {
    if (!isSchemaCompatError(error)) throw error;
    return;
  }

  await dbRun(
    `INSERT INTO financial_statement_validations
      (id, statement_pack_id, validation_scope, check_code, check_name, severity, status, expected_value, actual_value, difference, tolerance, message, details_json)
     VALUES (?, ?, 'pack', 'PACK_COMPLETENESS', 'Pack Completeness', ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      packId,
      aggregate.missingStatementTypes.length === 0 ? 'info' : 'warning',
      aggregate.missingStatementTypes.length === 0 ? 'pass' : 'warning',
      getCanonicalStatementTypes().length,
      aggregate.statementTypesPresent.length,
      aggregate.missingStatementTypes.length,
      0,
      aggregate.missingStatementTypes.length === 0
        ? 'Statement pack contains all required statement types.'
        : `Statement pack is missing: ${aggregate.missingStatementTypes.join(', ')}`,
      JSON.stringify({
        presentTypes: aggregate.statementTypesPresent,
        missingTypes: aggregate.missingStatementTypes,
      }),
    ],
    { fallback: false }
  );

  await dbRun(
    `INSERT INTO financial_statement_validations
      (id, statement_pack_id, validation_scope, check_code, check_name, severity, status, expected_value, actual_value, difference, tolerance, message, details_json)
     VALUES (?, ?, 'pack', 'PACK_READINESS', 'Pack Readiness', ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      packId,
      aggregate.packReadinessStatus === 'ready' ? 'info' : 'warning',
      aggregate.packReadinessStatus === 'ready' ? 'pass' : 'warning',
      100,
      aggregate.packReadinessScore,
      100 - aggregate.packReadinessScore,
      0,
      aggregate.packQualitySummary,
      JSON.stringify({
        readinessStatus: aggregate.packReadinessStatus,
        reasonCodes: aggregate.packQualityReasonCodes,
      }),
    ],
    { fallback: false }
  );
}

// ---------------------------------------------------------------------------
// Reconcile R1-R8 — SHADOW adapter (import context)
// ---------------------------------------------------------------------------
// Purely observational: computes reconcile checks over the pack's canonical
// values and persists them to financial_statement_validations (scope='pack')
// WITHOUT ever changing pack_readiness_status. Enforcement is gated behind
// RECONCILE_ENFORCE (false) — see reconciliationService for the shadow contract.

type StatementValueRow = { statement_id: string; line_code: string; value: number };

/** Load {CODE: sum(value)} maps keyed by statement type for the given statements. */
export async function loadPackValueMaps(
  statements: Array<{ id: string; statement_type?: string | null }>
): Promise<{
  pnl: Record<string, number>;
  bs: Record<string, number>;
  cf: Record<string, number>;
}> {
  const maps = {
    pnl: {} as Record<string, number>,
    bs: {} as Record<string, number>,
    cf: {} as Record<string, number>,
  };
  const ids = statements.map((s) => s.id).filter(Boolean);
  if (ids.length === 0) return maps;

  const typeById = new Map<string, string>();
  for (const s of statements) typeById.set(String(s.id), normalizeStatementType(s.statement_type));

  const placeholders = ids.map(() => '?').join(',');
  const rows = (await dbAll<StatementValueRow>(
    `SELECT fsv.statement_id AS statement_id, COALESCE(UPPER(fsl.line_code), '') AS line_code, fsv.value AS value
     FROM financial_statement_values fsv
     LEFT JOIN financial_statement_lines fsl ON fsv.canonical_line_id = fsl.id
     WHERE fsv.statement_id IN (${placeholders})`,
    ids
  )) as StatementValueRow[];

  for (const row of rows || []) {
    const code = String(row.line_code || '').trim();
    if (!code) continue; // unmapped (canonical_line_id IS NULL) → do NOT default to 0
    const value = Number(row.value);
    if (!Number.isFinite(value)) continue;
    const type = typeById.get(String(row.statement_id));
    const target =
      type === 'P&L' ? maps.pnl : type === 'BS' ? maps.bs : type === 'CF' ? maps.cf : null;
    if (!target) continue;
    target[code] = (target[code] || 0) + value;
  }
  return maps;
}

/** Immediately-prior ready pack for the same org+entity (BoP for roll-forwards). */
async function loadPriorPeriodStatements(
  organizationId: string,
  entityName: string,
  periodEnd: string
): Promise<PeriodStatements | null> {
  const canonicalPeriodEnd = toPeriodIsoDate(periodEnd);
  if (!canonicalPeriodEnd) return null;
  try {
    const prior = await dbGet<{
      id: string;
      period_end?: string;
      period_label?: string;
      currency?: string;
      scaling?: string;
    }>(
      `SELECT id, period_end, period_label, currency, scaling
       FROM financial_statement_packs
       WHERE organization_id = ?
         AND COALESCE(entity_name, '') = ?
         AND period_end < ?
         AND LOWER(COALESCE(pack_readiness_status, 'pending')) = 'ready'
       ORDER BY period_end DESC
       LIMIT 1`,
      [organizationId, entityName || '', canonicalPeriodEnd]
    );
    if (!prior?.id) return null;
    const priorStatements = await dbAll<{ id: string; statement_type: string }>(
      `SELECT id, statement_type FROM financial_statements WHERE statement_pack_id = ?`,
      [prior.id]
    );
    if (!Array.isArray(priorStatements) || priorStatements.length === 0) return null;
    const maps = await loadPackValueMaps(priorStatements);
    return {
      pnl: maps.pnl,
      bs: maps.bs,
      cf: maps.cf,
      periodLabel: normalizeText(prior.period_label) || undefined,
      periodDate: normalizeText(prior.period_end) || undefined,
    };
  } catch (error) {
    if (isSchemaCompatError(error)) return null;
    throw error;
  }
}

async function shadowReconcilePack(packId: string, statements: PackStatementRow[]): Promise<void> {
  const maps = await loadPackValueMaps(statements);
  const canonical = statements[0]!;
  const orgId = String(canonical.organization_id || '');
  const entity = normalizeText(canonical.entity_name);
  const periodEnd = String(canonical.period_end || '');
  const scaling = (normalizeText(canonical.scaling) || 'units') as PeriodStatements['scaling'];

  let prior: PeriodStatements | null = null;
  if (orgId && periodEnd) {
    prior = await loadPriorPeriodStatements(orgId, entity, periodEnd);
  }

  const period: PeriodStatements = {
    pnl: maps.pnl,
    bs: maps.bs,
    cf: maps.cf,
    bsPrior: prior?.bs,
    plPrior: prior?.pnl,
    periodLabel: packPeriodLabel(statements) || undefined,
    periodDate: periodEnd || undefined,
    scaling,
    currency: normalizeText(canonical.currency) || 'PLN',
  };

  const result = reconcileStatements({ context: 'import', periods: [period] });

  // Persist observational records. Status column CHECK forbids 'skipped', so
  // skipped checks are NOT written as rows; they are captured in the summary.
  try {
    await dbRun(
      `DELETE FROM financial_statement_validations
       WHERE statement_pack_id = ? AND validation_scope = 'pack'
         AND (check_code LIKE 'R%' OR check_code = 'RECONCILE_SUMMARY')`,
      [packId],
      { fallback: false }
    );
  } catch (error) {
    if (isSchemaCompatError(error)) return;
    throw error;
  }

  const skippedCodes: string[] = [];
  for (const check of result.checks) {
    if (check.status === 'skipped') {
      skippedCodes.push(check.checkCode);
      continue;
    }
    const severity = check.severity === 'error' ? 'error' : 'warning';
    await dbRun(
      `INSERT INTO financial_statement_validations
        (id, statement_pack_id, validation_scope, check_code, check_name, severity, status, expected_value, actual_value, difference, tolerance, message, details_json)
       VALUES (?, ?, 'pack', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        packId,
        check.checkCode,
        check.checkName,
        severity,
        check.status,
        check.expected,
        check.actual,
        check.difference,
        check.tolerance,
        check.message,
        JSON.stringify({ ...(check.details || {}), shadow: true }),
      ],
      { fallback: false }
    );
  }

  // Summary row (info/pass) — audit trail for skipped checks + shadow verdict.
  await dbRun(
    `INSERT INTO financial_statement_validations
      (id, statement_pack_id, validation_scope, check_code, check_name, severity, status, expected_value, actual_value, difference, tolerance, message, details_json)
     VALUES (?, ?, 'pack', 'RECONCILE_SUMMARY', 'Reconcile R1-R8 (shadow)', 'info', 'pass', ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      packId,
      result.summary.passed,
      result.summary.failed,
      result.summary.warnings,
      0,
      `Reconcile shadow: ${result.summary.passed} pass, ${result.summary.warnings} warn, ${result.summary.failed} fail, ${result.summary.skipped} skipped.`,
      JSON.stringify({
        shadow: true,
        enforce: RECONCILE_ENFORCE,
        summary: result.summary,
        overallStatus: result.overallStatus,
        blocksReady: result.blocksReady,
        wouldBlockReady: shouldBlockReady(result), // false in shadow mode
        skippedChecks: skippedCodes,
        priorPeriodLoaded: Boolean(prior),
      }),
    ],
    { fallback: false }
  );

  // NOTE: pack_readiness_status is intentionally NOT changed here. When
  // RECONCILE_ENFORCE flips to true (post DBR77 calibration), gate readiness on
  // shouldBlockReady(result) at the recompute UPDATE above.
}

export async function recomputeStatementPack(packId: string): Promise<string | null> {
  const statements = await loadRawPackStatementsWithSchemaCompat(packId);
  if (!Array.isArray(statements) || statements.length === 0) {
    await pruneEmptyPack(packId);
    return null;
  }

  const aggregate = computePackAggregate(statements);
  const canonical = statements[0]!;
  await dbRun(
    `UPDATE financial_statement_packs
     SET organization_id = ?,
         entity_name = ?,
         period_start = ?,
         period_end = ?,
         period_label = ?,
         currency = ?,
         scaling = ?,
         pack_status = ?,
         pack_readiness_status = ?,
         pack_readiness_score = ?,
         pack_quality_summary = ?,
         pack_quality_reason_codes = ?,
         source_statement_count = ?,
         missing_statement_types = ?,
         metadata_json = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      canonical.organization_id,
      normalizeText(canonical.entity_name) || null,
      canonical.period_start,
      canonical.period_end,
      packPeriodLabel(statements) || null,
      normalizeText(canonical.currency) || 'PLN',
      normalizeText(canonical.scaling) || 'units',
      aggregate.packStatus,
      aggregate.packReadinessStatus,
      aggregate.packReadinessScore,
      aggregate.packQualitySummary,
      toJson(aggregate.packQualityReasonCodes),
      aggregate.sourceStatementCount,
      toJson(aggregate.missingStatementTypes),
      toJson({
        statementTypesPresent: aggregate.statementTypesPresent,
      }),
      packId,
    ]
  );

  // ── SHADOW: reconcile R1-R8 (observational; never changes pack readiness) ──
  // Wrapped so a reconcile fault can never affect the recompute contract.
  await shadowReconcilePack(packId, statements).catch((error) => {
    // eslint-disable-next-line no-console
    console.warn('[reconcile-shadow] pack reconcile failed (non-fatal)', {
      packId,
      error: (error as Error)?.message || String(error),
    });
  });

  return packId;
}

export async function syncStatementToPack(statementId: string): Promise<string | null> {
  const statement = await loadStatementForPack(statementId);
  if (!statement) return null;

  const currentPackId = normalizeText(statement.statement_pack_id) || null;
  let targetPackId = await findExistingPack(statement);
  if (!targetPackId) {
    targetPackId = await createPack(statement);
  }

  if (currentPackId !== targetPackId) {
    await assignStatementToPack(statementId, targetPackId);
  }
  if (currentPackId && currentPackId !== targetPackId) {
    await recomputeStatementPack(currentPackId);
  }
  await recomputeStatementPack(targetPackId);
  return targetPackId;
}

export async function detachStatementFromPack(statementId: string): Promise<void> {
  const statement = await loadStatementForPack(statementId);
  const currentPackId = normalizeText(statement?.statement_pack_id) || null;
  if (!currentPackId) return;
  await assignStatementToPack(statementId, null);
  await recomputeStatementPack(currentPackId);
}

export async function listStatementPacks(
  organizationId: string,
  readinessFilter?: string
): Promise<any[]> {
  const normalizedFilter = normalizeText(readinessFilter).toLowerCase();
  const rows = await dbAll<any>(
    `SELECT p.id, p.organization_id, p.entity_name, p.period_start, p.period_end, p.period_label, p.currency,
            p.scaling, p.pack_status, p.pack_readiness_status, p.pack_readiness_score, p.pack_quality_summary,
            p.pack_quality_reason_codes, p.source_statement_count, p.missing_statement_types, p.created_at,
            p.updated_at,
            COUNT(fs.id) FILTER (WHERE fs.statement_type = 'P&L') AS pl_count,
            COUNT(fs.id) FILTER (WHERE fs.statement_type = 'BS') AS bs_count,
            COUNT(fs.id) FILTER (WHERE fs.statement_type = 'CF') AS cf_count,
            MAX(fs.updated_at) AS latest_statement_updated_at
     FROM financial_statement_packs p
     LEFT JOIN financial_statements fs ON fs.statement_pack_id = p.id
     WHERE p.organization_id = ?
       AND (? = '' OR LOWER(COALESCE(p.pack_readiness_status, 'pending')) = ?)
     GROUP BY p.id
     ORDER BY p.period_end DESC, p.updated_at DESC
     LIMIT 100`,
    [organizationId, normalizedFilter, normalizedFilter]
  );
  // Read boundary: `period_start`/`period_end` are Postgres DATE columns and
  // arrive as JS `Date` objects. Serialize them (and repair any label already
  // persisted as a raw Date string) so no client can render a raw Date.
  return serializeRowsPeriodFields(rows);
}

export async function getStatementPackDetail(
  organizationId: string,
  packId: string
): Promise<any | null> {
  const pack = await dbGet<any>(
    `SELECT *
     FROM financial_statement_packs
     WHERE id = ? AND organization_id = ?`,
    [packId, organizationId]
  );
  if (!pack) return null;

  // Keep both guarantees: fail closed on schema errors and explicitly scope
  // the nested statement read to the organization owning the pack.
  const statements = await loadPackStatementsWithSchemaCompat(packId, organizationId);
  const packValidations = await dbAll<any>(
    `SELECT check_code, check_name, severity, status, expected_value, actual_value, difference, tolerance, message, details_json, computed_at
     FROM financial_statement_validations
     WHERE statement_pack_id = ? AND validation_scope = 'pack'
     ORDER BY computed_at DESC, check_code ASC`,
    [packId]
  );

  return {
    ...serializeRowPeriodFields(pack),
    statements: serializeRowsPeriodFields(statements).sort(
      (left: any, right: any) =>
        getCanonicalStatementTypeOrder(left.statement_type) -
        getCanonicalStatementTypeOrder(right.statement_type)
    ),
    validations: packValidations || [],
  };
}

export async function recomputeStatementPackForOrganization(
  organizationId: string,
  packId: string
): Promise<any | null> {
  const pack = await dbGet<any>(
    `SELECT id
     FROM financial_statement_packs
     WHERE id = ? AND organization_id = ?`,
    [packId, organizationId]
  );
  if (!pack) return null;
  const resolvedId = await recomputeStatementPack(packId);
  if (!resolvedId) return null;
  return getStatementPackDetail(organizationId, resolvedId);
}

export async function assignStatementToExistingPack(params: {
  organizationId: string;
  statementId: string;
  packId: string;
}): Promise<void> {
  const pack = await dbGet<any>(
    `SELECT id
     FROM financial_statement_packs
     WHERE id = ? AND organization_id = ?`,
    [params.packId, params.organizationId]
  );
  if (!pack) throw new Error('Statement pack not found');
  const statement = await loadStatementForPack(params.statementId);
  if (!statement || statement.organization_id !== params.organizationId) {
    throw new Error('Statement not found');
  }
  const previousPackId = normalizeText(statement.statement_pack_id) || null;
  await assignStatementToPack(params.statementId, params.packId);
  if (previousPackId && previousPackId !== params.packId) {
    await recomputeStatementPack(previousPackId);
  }
  await recomputeStatementPack(params.packId);
}

export async function getVerifiedPackSeed(params: {
  organizationId: string;
  packId: string;
}): Promise<{ statementIds: string[]; currency: string; periodLabel: string }> {
  const detail = await getStatementPackDetail(params.organizationId, params.packId);
  if (!detail) throw new Error('Statement pack not found');
  const readinessStatus = normalizeText(detail.pack_readiness_status).toLowerCase();
  if (readinessStatus !== 'ready') {
    throw new Error('Statement pack must be ready before it can seed downstream work');
  }
  const statements = Array.isArray(detail.statements) ? detail.statements : [];
  const byType = new Map<string, any>();
  for (const statement of statements) {
    byType.set(normalizeStatementType(statement.statement_type), statement);
  }
  const ordered = ['P&L', 'BS', 'CF'].map((type) => byType.get(type)).filter(Boolean);
  if (ordered.length !== 3) {
    throw new Error('Statement pack must contain P&L, Balance Sheet, and Cash Flow');
  }
  return {
    statementIds: ordered.map((statement) => String(statement.id)),
    currency: normalizeText(detail.currency) || 'PLN',
    periodLabel: normalizeText(detail.period_label),
  };
}
