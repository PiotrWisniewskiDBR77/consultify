/**
 * FIN-005 — the two gates that must produce ZERO FALSE "READY".
 *
 * 1. SCHEMA DRIFT. `information_schema` says a required column is missing. The
 *    old seed either returned an empty result or `continue`d past the statement:
 *    a silent half-fixture. It must now return an explicit
 *    `{ status: 'incomplete', missing: [...] }` and write nothing that claims to
 *    be ready.
 *
 * 2. READ-BACK FAILURE. The rows are written, but reading them back shows fewer
 *    values than the canonical contract requires, or a value with a null
 *    `canonical_line_id`. The affected statement must stay NOT ready and the
 *    pack must stay NOT ready — even though the in-memory fixture is perfect.
 *
 * Both are negative tests: the assertion that matters is the ABSENCE of
 * `readiness_status='ready'`, `validation_status='pass'` and
 * `pack_readiness_status='ready'` anywhere.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fakeDb } from './helpers/fakeFinanceDb.js';

vi.mock('../../../utils/DbPromise.js', async () => {
  const { createDbPromiseMock } = await import('./helpers/fakeFinanceDb.js');
  const { vi: vitest } = await import('vitest');
  return createDbPromiseMock(vitest as never);
});

vi.mock('../../organizationContext/OrganizationContextService.js', () => ({
  organizationContextService: {
    recordContextSource: vi.fn(async () => undefined),
    rebuildSnapshot: vi.fn(async () => undefined),
  },
}));

import { upsertAtelierFinanceGoldenFlow } from '../atelierFinanceSeed.js';

const ORG_ID = 'demo-atelier-schema-gate-test';

const FINANCE_TABLES = [
  'financial_statement_packs',
  'financial_statements',
  'financial_statement_values',
  'financial_analyses',
];

/** A fully migrated Finance schema, as `information_schema.columns` reports it. */
const FULL_SCHEMA: Record<string, string[]> = {
  financial_statement_packs: [
    'id',
    'organization_id',
    'entity_name',
    'period_start',
    'period_end',
    'period_label',
    'currency',
    'scaling',
    'pack_status',
    'pack_readiness_status',
    'pack_readiness_score',
    'pack_quality_summary',
    'pack_quality_reason_codes',
    'source_statement_count',
    'missing_statement_types',
    'metadata_json',
    'created_at',
    'updated_at',
  ],
  financial_statements: [
    'id',
    'organization_id',
    'statement_pack_id',
    'entity_name',
    'statement_type',
    'period_start',
    'period_end',
    'period_label',
    'currency',
    'scaling',
    'source_file_name',
    'source_file_path',
    'parse_method',
    'overall_confidence',
    'document_class',
    'extraction_strategy',
    'template_family',
    'status',
    'validation_status',
    'validation_messages',
    'readiness_status',
    'readiness_score',
    'quality_summary',
    'quality_reason_codes',
    'values_version',
    'notes',
    'created_by',
    'confirmed_by',
    'created_at',
    'updated_at',
  ],
  financial_statement_values: [
    'id',
    'statement_id',
    'canonical_line_id',
    'original_label',
    'value',
    'confidence',
    'source_page',
    'source_row',
    'mapping_status',
    'is_non_financial',
    'value_origin',
    'mapping_confidence',
    'period_granularity',
    'evidence_json',
    'created_at',
    'updated_at',
  ],
  financial_analyses: [
    'id',
    'organization_id',
    'project_id',
    'title',
    'description',
    'status',
    'analysis_type',
    'periods',
    'statement_data',
    'currency',
    'source_statement_ids',
    'source_statement_pack_id',
    'approved_by',
    'approved_at',
    'created_by',
    'created_at',
    'updated_at',
  ],
};

function schemaWithout(table: string, column: string): Record<string, string[]> {
  return {
    ...FULL_SCHEMA,
    [table]: FULL_SCHEMA[table].filter((candidate) => candidate !== column),
  };
}

/**
 * The single assertion this whole file exists for: nothing anywhere claims to
 * be ready / passing / confirmed.
 */
function expectNothingClaimsReady(): void {
  const offences: string[] = [];

  for (const table of FINANCE_TABLES) {
    for (const row of fakeDb.rows(table)) {
      for (const [column, value] of Object.entries(row)) {
        const text = String(value ?? '');
        if (column === 'readiness_status' && text === 'ready') offences.push(`${table}.${column}`);
        if (column === 'pack_readiness_status' && text === 'ready')
          offences.push(`${table}.${column}`);
        if (column === 'validation_status' && text === 'pass') offences.push(`${table}.${column}`);
        if (column === 'status' && (text === 'confirmed' || text === 'APPROVED')) {
          offences.push(`${table}.${column}=${text}`);
        }
        if (column === 'pack_status' && text === 'confirmed') offences.push(`${table}.${column}`);
      }
    }
  }

  expect(offences, `rows falsely claiming READY: ${offences.join(', ')}`).toEqual([]);
}

describe('FIN-005 — schema drift never yields a half-fixture or a false READY', () => {
  beforeEach(() => {
    fakeDb.reset();
  });

  it('financial_statements without readiness_status -> incomplete, nothing written', async () => {
    fakeDb.reset({ schema: schemaWithout('financial_statements', 'readiness_status') });

    const result = await upsertAtelierFinanceGoldenFlow({ organizationId: ORG_ID });

    expect(result.status).toBe('incomplete');
    expect(result.missing).toContain('financial_statements.readiness_status');
    expect(result.reason).toMatch(/missing required tables\/columns/i);
    expect(result.packId).toBeNull();
    expect(result.statementIds).toEqual([]);
    expect(result.analysisId).toBeNull();

    // Fail-closed BEFORE the first write: no partial pack, no orphan statements.
    for (const table of FINANCE_TABLES) {
      expect(fakeDb.rows(table), `${table} was written despite schema drift`).toEqual([]);
    }
    expectNothingClaimsReady();
  });

  it('financial_statement_values without canonical_line_id -> incomplete, nothing written', async () => {
    fakeDb.reset({ schema: schemaWithout('financial_statement_values', 'canonical_line_id') });

    const result = await upsertAtelierFinanceGoldenFlow({ organizationId: ORG_ID });

    expect(result.status).toBe('incomplete');
    expect(result.missing).toContain('financial_statement_values.canonical_line_id');
    for (const table of FINANCE_TABLES) {
      expect(fakeDb.rows(table)).toEqual([]);
    }
    expectNothingClaimsReady();
  });

  it('financial_statement_packs without pack_readiness_status -> incomplete', async () => {
    fakeDb.reset({ schema: schemaWithout('financial_statement_packs', 'pack_readiness_status') });

    const result = await upsertAtelierFinanceGoldenFlow({ organizationId: ORG_ID });

    expect(result.status).toBe('incomplete');
    expect(result.missing).toContain('financial_statement_packs.pack_readiness_status');
    expectNothingClaimsReady();
  });

  it('a missing table is reported by name, not swallowed', async () => {
    fakeDb.reset({ schema: FULL_SCHEMA, missingTables: ['financial_analyses'] });

    const result = await upsertAtelierFinanceGoldenFlow({ organizationId: ORG_ID });

    expect(result.status).toBe('incomplete');
    expect(result.missing).toContain('financial_analyses');
    expectNothingClaimsReady();
  });

  it('several drifted columns are ALL reported, so one fix does not hide the next', async () => {
    const schema = schemaWithout('financial_statements', 'readiness_status');
    schema.financial_statements = schema.financial_statements.filter(
      (column) => column !== 'validation_status'
    );
    fakeDb.reset({ schema });

    const result = await upsertAtelierFinanceGoldenFlow({ organizationId: ORG_ID });

    expect(result.status).toBe('incomplete');
    expect(result.missing).toEqual(
      expect.arrayContaining([
        'financial_statements.readiness_status',
        'financial_statements.validation_status',
      ])
    );
    expectNothingClaimsReady();
  });

  it('the fully migrated schema still produces a complete golden flow', async () => {
    fakeDb.reset({ schema: FULL_SCHEMA });

    const result = await upsertAtelierFinanceGoldenFlow({ organizationId: ORG_ID });

    expect(result.status).toBe('complete');
    expect(result.statementIds).toHaveLength(3);
    for (const row of fakeDb.rows('financial_statements')) {
      expect(row.readiness_status).toBe('ready');
      expect(row.validation_status).toBe('pass');
    }
    expect(fakeDb.rows('financial_statement_packs')[0].pack_readiness_status).toBe('ready');
  });
});

/**
 * The single assertion the ALL-OR-NOTHING contract rests on: after an
 * `incomplete` run, ZERO statements are at READY/confirmed/pass, the analysis is
 * not APPROVED and the pack is not READY — read from the STORE, not from the
 * return value.
 *
 * The previous version of this file tolerated the opposite: the truncated-P&L
 * test asserted `result.statementIds` had length 2 and only checked that the
 * refused statement stayed pending, i.e. it accepted BS and CF sitting at
 * `readiness_status='ready'` inside a fixture the seed reported as incomplete.
 * That partial state IS the FIN-005 defect, so the expectation is inverted here.
 */
function expectNothingPromoted(): void {
  for (const row of fakeDb.rows('financial_statements')) {
    expect(row.status, `${String(row.id)} was promoted`).toBe('imported');
    expect(row.validation_status, `${String(row.id)} was promoted`).toBe('pending');
    expect(row.readiness_status, `${String(row.id)} was promoted`).toBe('pending');
    expect(Number(row.readiness_score)).toBe(0);
    expect(row.confirmed_by ?? null).toBeNull();
  }
  for (const row of fakeDb.rows('financial_analyses')) {
    expect(row.status, `${String(row.id)} was approved`).toBe('DRAFT');
  }
  for (const row of fakeDb.rows('financial_statement_packs')) {
    expect(row.pack_status, `${String(row.id)} was promoted`).toBe('draft');
    expect(row.pack_readiness_status).toBe('pending');
    expect(Number(row.pack_readiness_score)).toBe(0);
    expect(JSON.parse(String(row.missing_statement_types))).toEqual(['P&L', 'BS', 'CF']);
    expect(Number(row.source_statement_count)).toBe(0);
  }
}

describe('FIN-005 — a failed read-back refuses promotion, for ALL statements', () => {
  it('fewer values on disk than the canonical contract -> NOTHING is promoted', async () => {
    // The P&L write is silently truncated by one row on the way back out.
    // BS and CF are perfect — and must STILL not be promoted, because a fixture
    // with two READY statements and one pending is neither honest nor complete.
    fakeDb.reset({
      schema: FULL_SCHEMA,
      onSelect: (table, rows) => {
        if (table !== 'financial_statement_values') return rows;
        if (!rows.some((row) => String(row.id ?? '').includes('atelier-fy2014-pl'))) return rows;
        return rows.slice(1);
      },
    });

    const result = await upsertAtelierFinanceGoldenFlow({ organizationId: ORG_ID });

    expect(result.status).toBe('incomplete');
    expect(result.reason).toMatch(/read-back found \d+ values, expected \d+/);
    expect(result.reason).toMatch(/so NONE was promoted/);
    expect(result.statementIds).toEqual([]);
    expect(result.unpromotedStatementIds).toHaveLength(3);
    expect(result.promotion?.statementPromotionsIssued).toBe(0);
    expect(result.promotion?.analysisPromotionIssued).toBe(false);
    expect(result.promotion?.packPromotionIssued).toBe(false);

    expectNothingPromoted();
    expectNothingClaimsReady();
  });

  it('a value with a null canonical_line_id -> NOTHING is promoted', async () => {
    fakeDb.reset({
      schema: FULL_SCHEMA,
      onSelect: (table, rows) => {
        if (table !== 'financial_statement_values') return rows;
        return rows.map((row, index) =>
          index === 0 && String(row.id ?? '').includes('atelier-fy2014-bs')
            ? { ...row, canonical_line_id: null }
            : row
        );
      },
    });

    const result = await upsertAtelierFinanceGoldenFlow({ organizationId: ORG_ID });

    expect(result.status).toBe('incomplete');
    expect(result.reason).toMatch(/null canonical_line_id/);
    expect(result.statementIds).toEqual([]);
    expect(result.unpromotedStatementIds).toHaveLength(3);

    expectNothingPromoted();
    expectNothingClaimsReady();
  });

  it('a statement whose lineage points at the wrong pack -> NOTHING is promoted', async () => {
    fakeDb.reset({
      schema: FULL_SCHEMA,
      onSelect: (table, rows) => {
        if (table !== 'financial_statements') return rows;
        return rows.map((row) =>
          String(row.id ?? '').endsWith('atelier-fy2014-cf')
            ? { ...row, statement_pack_id: 'some-other-tenant-pack' }
            : row
        );
      },
    });

    const result = await upsertAtelierFinanceGoldenFlow({ organizationId: ORG_ID });

    expect(result.status).toBe('incomplete');
    expect(result.reason).toMatch(/statement_pack_id mismatch/);
    expect(result.statementIds).toEqual([]);

    expectNothingPromoted();
    expectNothingClaimsReady();
  });
});
