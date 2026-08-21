import { createHash } from 'node:crypto';
import { withPinnedPostgresTransaction } from '../../../database/PostgresDatabase.js';
import {
  persistClassifiedDcfFailureIfUnpublished,
  runDcfFcffValuation,
} from './valuationComputeService.js';
import {
  assertFinanceEditor,
  readCanonicalLegacyValuationInputs,
} from './valuationLegacySuccessorService.js';

const UNIT: Record<string, number> = {
  UNITS: 1,
  THOUSANDS: 1_000,
  MILLIONS: 1_000_000,
  BILLIONS: 1_000_000_000,
};

export async function runCanonicalLegacyValuationCompute(params: {
  organizationId: string;
  userId: string;
  legacyId: string;
  idempotencyKey: string;
  requestId?: string | null;
}) {
  const outcome = await withPinnedPostgresTransaction(async (gateTx) => {
    await assertFinanceEditor(gateTx, params.organizationId, params.userId);
    await gateTx.queryOne(`SELECT pg_advisory_xact_lock(hashtextextended(?,0))`, [
      `${params.organizationId}:${params.idempotencyKey}:VALUATION_COMPUTE`,
    ]);
    const preLockInput = await readCanonicalLegacyValuationInputs(
      params.organizationId,
      params.legacyId
    );
    await gateTx.queryOne(`SELECT pg_advisory_xact_lock(hashtextextended(?,0))`, [
      `${params.organizationId}:${preLockInput.identity.business_version_id}:VALUATION_INPUTS`,
    ]);
    const input = await readCanonicalLegacyValuationInputs(params.organizationId, params.legacyId);
    const identityFields = [
      'artifact_id',
      'business_version_id',
      'working_revision_id',
      'working_revision_version',
    ] as const;
    if (
      identityFields.some(
        (field) => String(preLockInput.identity[field]) !== String(input.identity[field])
      )
    )
      throw Object.assign(
        new Error('Canonical valuation identity changed while acquiring the input lock'),
        { code: 'CANONICAL_IDENTITY_CAS_CONFLICT' }
      );
    if (!input.assumptions)
      throw Object.assign(new Error('Canonical assumptions are required'), {
        code: 'CANONICAL_INPUTS_MISSING',
      });
    const derived = await withPinnedPostgresTransaction(async (tx) => {
      const edge = await tx.queryAll<any>(
        `SELECT source_version_id,source_artifact_type FROM finance_lineage_edges WHERE organization_id=? AND target_version_id=? AND edge_type IN ('MODEL_TO_VALUATION','SCENARIO_TO_VALUATION') ORDER BY created_at,id`,
        [params.organizationId, input.identity.business_version_id]
      );
      if (edge.length !== 1)
        throw Object.assign(new Error('Exactly one canonical valuation source edge is required'), {
          code: 'CANONICAL_SOURCE_AMBIGUOUS',
        });
      const prediction = edge[0].source_artifact_type === 'PREDICTION_SCENARIO';
      const outputTable = prediction
        ? 'finance_prediction_outputs_effective'
        : 'finance_baseline_outputs';
      const filter = prediction
        ? "AND o.consolidation_scope='CONSOLIDATED'"
        : "AND o.consolidation_scope='CONSOLIDATED' AND o.value_kind='FORECAST'";
      const periods = await tx.queryAll<any>(
        `SELECT DISTINCT o.entity_id,p.period_id,p.fiscal_year,p.period_start::text AS period_start,p.period_end::text AS period_end FROM ${outputTable} o JOIN finance_stmt_periods p ON p.period_id=o.period_id AND p.organization_id=o.organization_id WHERE o.organization_id=? AND o.business_version_id=? ${filter} ORDER BY period_start,period_end`,
        [params.organizationId, edge[0].source_version_id]
      );
      const outputRows = await tx.queryAll<any>(
        `SELECT o.entity_id,o.period_id,o.canonical_line_id,o.value_status,o.value_decimal::text,o.presentation_currency,o.unit,o.multiplier::text,o.consolidation_scope FROM ${outputTable} o WHERE o.organization_id=? AND o.business_version_id=? ${filter} ORDER BY o.entity_id,o.period_id,o.canonical_line_id`,
        [params.organizationId, edge[0].source_version_id]
      );
      const entities = [...new Set(periods.map((p: any) => p.entity_id))];
      if (entities.length !== 1 || periods.length === 0)
        throw Object.assign(
          new Error('Canonical source must resolve one entity and forecast periods'),
          { code: 'CANONICAL_PERIOD_LINEAGE_MISSING' }
        );
      const projectionYears = [...new Set(periods.map((p: any) => Number(p.fiscal_year)))].map(
        (year) => ({
          fiscalYear: year,
          periodIds: periods
            .filter((p: any) => Number(p.fiscal_year) === year)
            .map((p: any) => p.period_id),
        })
      );
      let baselineVersionId = edge[0].source_version_id;
      if (prediction) {
        const base = await tx.queryOne<any>(
          `SELECT source_version_id FROM finance_lineage_edges WHERE organization_id=? AND target_version_id=? AND edge_type='MODEL_TO_SCENARIO'`,
          [params.organizationId, edge[0].source_version_id]
        );
        if (!base)
          throw Object.assign(new Error('Prediction baseline lineage missing'), {
            code: 'CANONICAL_PERIOD_LINEAGE_MISSING',
          });
        baselineVersionId = base.source_version_id;
      }
      const stmt = await tx.queryOne<any>(
        `SELECT source_version_id FROM finance_lineage_edges WHERE organization_id=? AND target_version_id=? AND edge_type='STATEMENT_TO_MODEL'`,
        [params.organizationId, baselineVersionId]
      );
      if (!stmt)
        throw Object.assign(new Error('Opening working-capital lineage missing'), {
          code: 'CANONICAL_PERIOD_LINEAGE_MISSING',
        });
      const opening = await tx.queryOne<any>(
        `SELECT s.value_decimal,s.unit,s.multiplier FROM finance_stmt_lines s JOIN financial_statement_lines l ON l.id=s.canonical_line_id JOIN finance_stmt_periods p ON p.period_id=s.period_id WHERE s.organization_id=? AND s.business_version_id=? AND s.entity_id=? AND l.line_code='WORKING_CAPITAL' AND s.value_status IN ('PRESENT_ZERO','PRESENT_NONZERO') AND p.period_end < ? ORDER BY p.period_end DESC LIMIT 1`,
        [params.organizationId, stmt.source_version_id, entities[0], periods[0].period_start]
      );
      if (!opening)
        throw Object.assign(new Error('Pinned opening working capital is missing'), {
          code: 'CANONICAL_PERIOD_LINEAGE_MISSING',
        });
      const bv = await tx.queryOne<any>(
        `SELECT engine_manifest_id FROM finance_business_versions WHERE organization_id=? AND business_version_id=?`,
        [params.organizationId, input.identity.business_version_id]
      );
      if (!bv?.engine_manifest_id)
        throw Object.assign(new Error('Pinned engine manifest missing'), {
          code: 'CANONICAL_PERIOD_LINEAGE_MISSING',
        });
      return {
        entityId: entities[0],
        projectionYears,
        openingWorkingCapital:
          Number(opening.value_decimal) * (UNIT[opening.unit] ?? NaN) * Number(opening.multiplier),
        engineManifestId: bv.engine_manifest_id,
        outputTable,
        sourceVersionId: edge[0].source_version_id,
        sourceFilter: filter,
        sourceFingerprint: {
          edge,
          periods,
          outputRows,
          baselineVersionId,
          statementVersionId: stmt.source_version_id,
          opening: {
            value: String(opening.value_decimal),
            unit: opening.unit,
            multiplier: String(opening.multiplier),
          },
          engineManifestId: bv.engine_manifest_id,
        },
      };
    });
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          assumptionsRequestSha256: (input.assumptions as any).requestSha256,
          source: derived.sourceFingerprint,
        })
      )
      .digest('hex');
    const replay = await gateTx.queryOne<any>(
      `SELECT * FROM finance_valuation_compute_command_receipts WHERE organization_id=? AND idempotency_key=?`,
      [params.organizationId, params.idempotencyKey]
    );
    if (replay) {
      if (replay.request_sha256 !== fingerprint)
        throw Object.assign(
          new Error('Compute idempotency key reused after canonical inputs changed'),
          { code: 'IDEMPOTENCY_KEY_REUSED' }
        );
      return {
        ok: true as const,
        value: {
          identity: input.identity,
          result: {
            job: { id: replay.job_id },
            enterpriseValue: Number(replay.enterprise_value_decimal),
            equityValue:
              replay.equity_value_decimal === null ? null : Number(replay.equity_value_decimal),
            terminalValue: Number(replay.terminal_value_decimal),
          },
          replay: true,
        },
      };
    }
    const result = await runDcfFcffValuation({
      organizationId: params.organizationId,
      valuationBusinessVersionId: input.identity.business_version_id,
      entityId: derived.entityId,
      requestedByUserId: params.userId,
      engineManifestId: derived.engineManifestId,
      requestId: params.requestId ?? null,
      projectionYears: derived.projectionYears,
      openingWorkingCapital: derived.openingWorkingCapital,
      terminal: {},
      directCashTaxRatePct: Number((input.assumptions as any).cashTaxRatePct),
      valuationAsOfDate: String((input.assumptions as any).valuationAsOfDate),
      inputCommandHash: fingerprint,
      publicationTx: gateTx,
    });
    if (!result.ok)
      return { ok: false as const, result, businessVersionId: input.identity.business_version_id };
    const postSource = await (async () => {
      const edge = await gateTx.queryAll<any>(
        `SELECT source_version_id,source_artifact_type FROM finance_lineage_edges WHERE organization_id=? AND target_version_id=? AND edge_type IN ('MODEL_TO_VALUATION','SCENARIO_TO_VALUATION') ORDER BY created_at,id`,
        [params.organizationId, input.identity.business_version_id]
      );
      const periods = await gateTx.queryAll<any>(
        `SELECT DISTINCT o.entity_id,p.period_id,p.fiscal_year,p.period_start::text AS period_start,p.period_end::text AS period_end FROM ${derived.outputTable} o JOIN finance_stmt_periods p ON p.period_id=o.period_id AND p.organization_id=o.organization_id WHERE o.organization_id=? AND o.business_version_id=? ${derived.sourceFilter} ORDER BY period_start,period_end`,
        [params.organizationId, derived.sourceVersionId]
      );
      const outputRows = await gateTx.queryAll<any>(
        `SELECT o.entity_id,o.period_id,o.canonical_line_id,o.value_status,o.value_decimal::text,o.presentation_currency,o.unit,o.multiplier::text,o.consolidation_scope FROM ${derived.outputTable} o WHERE o.organization_id=? AND o.business_version_id=? ${derived.sourceFilter} ORDER BY o.entity_id,o.period_id,o.canonical_line_id`,
        [params.organizationId, derived.sourceVersionId]
      );
      let baselineVersionId = derived.sourceVersionId;
      if (edge[0]?.source_artifact_type === 'PREDICTION_SCENARIO') {
        const base = await gateTx.queryOne<any>(
          `SELECT source_version_id FROM finance_lineage_edges WHERE organization_id=? AND target_version_id=? AND edge_type='MODEL_TO_SCENARIO'`,
          [params.organizationId, derived.sourceVersionId]
        );
        baselineVersionId = base?.source_version_id;
      }
      const stmt = await gateTx.queryOne<any>(
        `SELECT source_version_id FROM finance_lineage_edges WHERE organization_id=? AND target_version_id=? AND edge_type='STATEMENT_TO_MODEL'`,
        [params.organizationId, baselineVersionId]
      );
      const opening = await gateTx.queryOne<any>(
        `SELECT s.value_decimal,s.unit,s.multiplier FROM finance_stmt_lines s JOIN financial_statement_lines l ON l.id=s.canonical_line_id JOIN finance_stmt_periods p ON p.period_id=s.period_id WHERE s.organization_id=? AND s.business_version_id=? AND s.entity_id=? AND l.line_code='WORKING_CAPITAL' AND s.value_status IN ('PRESENT_ZERO','PRESENT_NONZERO') AND p.period_end < ? ORDER BY p.period_end DESC LIMIT 1`,
        [params.organizationId, stmt?.source_version_id, derived.entityId, periods[0]?.period_start]
      );
      const bv = await gateTx.queryOne<any>(
        `SELECT engine_manifest_id FROM finance_business_versions WHERE organization_id=? AND business_version_id=?`,
        [params.organizationId, input.identity.business_version_id]
      );
      return {
        edge,
        periods,
        outputRows,
        baselineVersionId,
        statementVersionId: stmt?.source_version_id,
        opening: opening
          ? {
              value: String(opening.value_decimal),
              unit: opening.unit,
              multiplier: String(opening.multiplier),
            }
          : null,
        engineManifestId: bv?.engine_manifest_id,
      };
    })();
    if (JSON.stringify(postSource) !== JSON.stringify(derived.sourceFingerprint))
      throw Object.assign(new Error('Canonical source changed during valuation compute'), {
        code: 'CANONICAL_SOURCE_CAS_CONFLICT',
      });
    await gateTx.queryRun(
      `INSERT INTO finance_valuation_compute_command_receipts(organization_id,idempotency_key,request_sha256,business_version_id,job_id,enterprise_value_decimal,equity_value_decimal,terminal_value_decimal,created_by) VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        params.organizationId,
        params.idempotencyKey,
        fingerprint,
        input.identity.business_version_id,
        result.job.id,
        result.enterpriseValue,
        result.equityValue,
        result.terminalValue,
        params.userId,
      ]
    );
    return { ok: true as const, value: { identity: input.identity, result, replay: false } };
  });
  if (!outcome.ok) {
    const readiness =
      outcome.result.code === 'FCFF_NOT_FULLY_PRESENT'
        ? ('DATA_INCOMPLETE' as const)
        : outcome.result.code === 'TERMINAL_G_MUST_BE_LESS_THAN_WACC' ||
            outcome.result.code === 'INVALID_EXIT_MULTIPLE_INPUT'
          ? ('COMPUTE_FAILED' as const)
          : null;
    if (readiness) {
      await persistClassifiedDcfFailureIfUnpublished({
        organizationId: params.organizationId,
        businessVersionId: outcome.businessVersionId,
        createdBy: params.userId,
        readiness,
      });
    }
    throw Object.assign(new Error(outcome.result.message), { code: outcome.result.code });
  }
  return outcome.value;
}
