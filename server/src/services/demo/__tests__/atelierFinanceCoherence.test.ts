/**
 * FIN-005 — Atelier Toys Finance golden-flow coherence gate.
 *
 * Two questions this test answers, both raised by the 2026-08-01 staging probe:
 *
 * 1. **Does the canonical Atelier demo fixture tell ONE story?**
 *    statement pack -> analysis -> model, all Atelier Toys, one currency, one
 *    period, with real foreign keys between them — and no DBR77, no Apator, no
 *    technical seed leftovers, no `(kopia)` duplicates.
 *
 * 2. **Is "READY" earned or asserted?**
 *    The seed writes `readiness_status = 'ready'` / `validation_status = 'pass'`.
 *    A literal proves nothing. So the captured statement values are fed back
 *    through the PRODUCTION functions — `validateStatement()` and
 *    `evaluateStatementReadiness()` from `financialStatementService` — and the
 *    computed verdict must equal the persisted one. If somebody edits a number
 *    and the balance sheet stops balancing, the seed's stored `ready` becomes a
 *    lie and this test fails.
 *
 * SCOPE — deliberately narrow. Every assertion runs against the rows THIS SEED
 * WRITES for one throw-away org id. It never queries live data and never
 * inspects other tenants, so historical DBR77/Apator records outside the
 * canonical demo fixture are untouched and unjudged by this gate.
 *
 * The DB layer is mocked (same pattern as `atelierSpineCoherence.test.ts`), so
 * this runs anywhere with no Postgres.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';

interface CapturedRow {
  table: string;
  columns: string[];
  row: Record<string, unknown>;
}

const captured: CapturedRow[] = [];

function parseInsert(sql: string, params: unknown[]): CapturedRow | null {
  const match = sql.match(/INSERT\s+INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/i);
  if (!match) return null;
  const table = match[1];
  const columns = match[2]
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  const row: Record<string, unknown> = {};
  columns.forEach((col, i) => {
    row[col] = params[i];
  });
  return { table, columns, row };
}

function handleSchemaProbe(sql: string): { handled: boolean; result?: unknown } {
  if (/information_schema\.tables/i.test(sql)) return { handled: true, result: { exists: true } };
  if (/information_schema\.columns/i.test(sql) && /EXISTS/i.test(sql)) {
    return { handled: true, result: { exists: true } };
  }
  return { handled: false };
}

vi.mock('../../../utils/DbPromise.js', () => {
  const get = vi.fn(async (sql: string) => {
    const probe = handleSchemaProbe(sql);
    if (probe.handled) return probe.result;
    return null;
  });
  const all = vi.fn(async () => []);
  const run = vi.fn(async (sql: string, params: unknown[] = []) => {
    const parsed = parseInsert(sql, params as unknown[]);
    if (parsed) captured.push(parsed);
    return { success: true, changes: 1 };
  });
  return {
    get,
    all,
    run,
    transaction: vi.fn(async () => ({ success: true, results: [] })),
    tableExists: vi.fn(async () => true),
    columnExists: vi.fn(async () => true),
    exec: vi.fn(async () => ({ success: true })),
    safeAll: vi.fn(async () => []),
    count: vi.fn(async () => 0),
    DbPromise: {},
    default: {},
  };
});

vi.mock('../../organizationContext/OrganizationContextService.js', () => ({
  organizationContextService: {
    recordContextSource: vi.fn(async () => undefined),
    rebuildSnapshot: vi.fn(async () => undefined),
  },
}));

import {
  evaluateStatementReadiness,
  validateStatement,
} from '../../financialStatementService.js';
import {
  assertAtelierFy2014Coherent,
  ATELIER_CANONICAL_MODEL_NAME_EN,
  ATELIER_FINANCE_CURRENCY,
  ATELIER_FINANCE_ENTITY_NAME,
  ATELIER_FINANCE_PERIOD_END,
  ATELIER_FINANCE_PERIOD_LABEL,
  ATELIER_FINANCE_PERIOD_START,
  ATELIER_FINANCE_SCALING,
  ATELIER_FY2014_BS,
  ATELIER_FY2014_CF,
  ATELIER_FY2014_PL,
  buildAtelierAnalysisStatementData,
  upsertAtelierFinanceGoldenFlow,
} from '../atelierFinanceSeed.js';
import { seedAtelierToysDemoDataset } from '../demoSeedService.js';

const ORG_ID = 'demo-atelier-finance-test';

function rowsFor(table: string): Array<Record<string, unknown>> {
  return captured.filter((c) => c.table === table).map((c) => c.row);
}

function str(value: unknown): string {
  return String(value ?? '');
}

describe('FIN-005 — Atelier Finance fixture arithmetic', () => {
  it('the FY2014 numbers reconcile before anything is written', () => {
    expect(() => assertAtelierFy2014Coherent()).not.toThrow();
  });

  it('the analysis payload is built from the same lines as the statements', () => {
    const { periods, statementData } = buildAtelierAnalysisStatementData();
    expect(periods).toEqual([ATELIER_FINANCE_PERIOD_LABEL]);

    // Same codes, same values — the analysis cannot drift from its source.
    const plCodes = statementData.pl.map((line) => line.code);
    expect(plCodes).toEqual(ATELIER_FY2014_PL.map((line) => line.code));
    for (const line of ATELIER_FY2014_PL) {
      const analysisLine = statementData.pl.find((item) => item.code === line.code);
      expect(analysisLine?.values[ATELIER_FINANCE_PERIOD_LABEL]).toBe(line.value);
    }
    expect(statementData.bs).toHaveLength(ATELIER_FY2014_BS.length);
    expect(statementData.cf).toHaveLength(ATELIER_FY2014_CF.length);
  });
});

describe('FIN-005 — statements earn READY through production code', () => {
  beforeAll(async () => {
    captured.length = 0;
    await upsertAtelierFinanceGoldenFlow({ organizationId: ORG_ID, createdBy: 'user-cfo' });
  });

  const cases = [
    { type: 'P&L', slug: 'atelier-fy2014-pl', lines: ATELIER_FY2014_PL },
    { type: 'BS', slug: 'atelier-fy2014-bs', lines: ATELIER_FY2014_BS },
    { type: 'CF', slug: 'atelier-fy2014-cf', lines: ATELIER_FY2014_CF },
  ];

  for (const testCase of cases) {
    it(`${testCase.type} — validateStatement returns pass with zero warnings`, () => {
      const result = validateStatement(
        testCase.lines.map((line) => ({
          canonicalLineId: line.lineId,
          value: line.value,
          originalLabel: line.label,
          mappingStatus: 'auto',
          isNonFinancial: false,
        })),
        testCase.type
      );

      const problems = result.messages.filter((message) => message.type !== 'info');
      expect(
        problems.map((message) => `${message.code}: ${message.message}`),
        `${testCase.type} produced validation problems`
      ).toEqual([]);
      expect(result.status).toBe('pass');
    });

    it(`${testCase.type} — evaluateStatementReadiness computes the persisted verdict`, () => {
      const values = testCase.lines.map((line) => ({
        canonicalLineId: line.lineId,
        value: line.value,
        isNonFinancial: false,
      }));
      const validation = validateStatement(
        testCase.lines.map((line) => ({
          canonicalLineId: line.lineId,
          value: line.value,
          isNonFinancial: false,
        })),
        testCase.type
      );

      const readiness = evaluateStatementReadiness({
        rawStatus: 'confirmed',
        statementType: testCase.type,
        validationStatus: validation.status,
        currency: ATELIER_FINANCE_CURRENCY,
        scaling: ATELIER_FINANCE_SCALING,
        validationMessages: validation.messages,
        values,
      });

      // The seed stores these literals; production must agree with them.
      const persisted = rowsFor('financial_statements').find((row) =>
        str(row.id).endsWith(testCase.slug)
      );
      expect(persisted, `${testCase.type} statement was not written`).toBeTruthy();

      expect(readiness.readinessStatus).toBe('ready');
      expect(readiness.readinessStatus).toBe(str(persisted?.readiness_status));
      expect(validation.status).toBe(str(persisted?.validation_status));
      expect(readiness.readinessScore).toBe(100);
      expect(Number(persisted?.readiness_score)).toBe(readiness.readinessScore);
    });
  }

  it('every statement value is mapped to a canonical line (100% coverage)', () => {
    const values = rowsFor('financial_statement_values');
    expect(values.length).toBe(
      ATELIER_FY2014_PL.length + ATELIER_FY2014_BS.length + ATELIER_FY2014_CF.length
    );
    for (const value of values) {
      expect(str(value.canonical_line_id)).toMatch(/^fsl-(pl|bs|cf)-/);
      expect(value.is_non_financial).toBe(false);
      expect(str(value.value_origin)).toBe('mapped');
    }
  });

  it('the pack is complete: one P&L, one BS, one CF, no missing types', () => {
    const packs = rowsFor('financial_statement_packs');
    expect(packs).toHaveLength(1);
    const pack = packs[0];

    expect(str(pack.entity_name)).toBe(ATELIER_FINANCE_ENTITY_NAME);
    expect(str(pack.pack_readiness_status)).toBe('ready');
    expect(JSON.parse(str(pack.missing_statement_types))).toEqual([]);
    expect(Number(pack.source_statement_count)).toBe(3);

    const types = rowsFor('financial_statements').map((row) => str(row.statement_type)).sort();
    expect(types).toEqual(['BS', 'CF', 'P&L']);
  });

  it('no raw JS Date value reaches the period columns', () => {
    const rawDate = /^[A-Z][a-z]{2}\s+[A-Z][a-z]{2}\s+\d{1,2}\s+\d{4}\b/;
    const periodRows = [...rowsFor('financial_statement_packs'), ...rowsFor('financial_statements')];
    expect(periodRows.length).toBeGreaterThan(0);
    for (const row of periodRows) {
      expect(str(row.period_start)).toBe(ATELIER_FINANCE_PERIOD_START);
      expect(str(row.period_end)).toBe(ATELIER_FINANCE_PERIOD_END);
      expect(str(row.period_label)).toBe(ATELIER_FINANCE_PERIOD_LABEL);
      expect(str(row.period_label)).not.toMatch(rawDate);
    }
  });
});

describe('FIN-005 — the golden flow is linked end to end', () => {
  beforeAll(async () => {
    captured.length = 0;
    await seedAtelierToysDemoDataset({ organizationId: ORG_ID, locale: 'en' });
  });

  it('statements belong to the canonical pack', () => {
    const packId = str(rowsFor('financial_statement_packs')[0]?.id);
    expect(packId).toBeTruthy();

    const statements = rowsFor('financial_statements');
    expect(statements).toHaveLength(3);
    for (const statement of statements) {
      expect(str(statement.statement_pack_id)).toBe(packId);
      expect(str(statement.organization_id)).toBe(ORG_ID);
    }
  });

  it('the approved analysis is seeded from that pack and those statements', () => {
    const packId = str(rowsFor('financial_statement_packs')[0]?.id);
    const statementIds = rowsFor('financial_statements').map((row) => str(row.id)).sort();

    const analyses = rowsFor('financial_analyses');
    expect(analyses).toHaveLength(1);
    const analysis = analyses[0];

    expect(str(analysis.status)).toBe('APPROVED');
    expect(str(analysis.source_statement_pack_id)).toBe(packId);
    expect(JSON.parse(str(analysis.source_statement_ids)).sort()).toEqual(statementIds);
    expect(JSON.parse(str(analysis.periods))).toEqual([ATELIER_FINANCE_PERIOD_LABEL]);
    expect(str(analysis.organization_id)).toBe(ORG_ID);
  });

  it('the canonical ROI model is grounded on the same pack', () => {
    const packId = str(rowsFor('financial_statement_packs')[0]?.id);
    const models = rowsFor('financial_models');
    expect(models).toHaveLength(1);
    const model = models[0];

    expect(str(model.name)).toBe(ATELIER_CANONICAL_MODEL_NAME_EN);
    expect(str(model.source_statement_pack_id)).toBe(packId);
    expect(str(model.status)).toBe('approved');
    // The program starts the year after the baseline statement.
    expect(str(model.start_date)).toBe('2015-01-01');
    expect(str(model.initiative_id)).toBeTruthy();
  });

  it('one currency across statements, analysis, model and model events', () => {
    const currencies = new Set(
      [
        ...rowsFor('financial_statement_packs'),
        ...rowsFor('financial_statements'),
        ...rowsFor('financial_analyses'),
        ...rowsFor('financial_models'),
        ...rowsFor('financial_model_events'),
        ...rowsFor('analysis_financials'),
      ].map((row) => str(row.currency))
    );
    expect([...currencies]).toEqual([ATELIER_FINANCE_CURRENCY]);
  });

  it('one period identity across the pack and its statements', () => {
    const labels = new Set(
      [...rowsFor('financial_statement_packs'), ...rowsFor('financial_statements')].map((row) =>
        str(row.period_label)
      )
    );
    expect([...labels]).toEqual([ATELIER_FINANCE_PERIOD_LABEL]);
  });
});

describe('FIN-005 — no foreign or technical records in the canonical demo fixture', () => {
  beforeAll(async () => {
    captured.length = 0;
    await seedAtelierToysDemoDataset({ organizationId: ORG_ID, locale: 'en' });
  });

  /**
   * Names the staging probe found inside the Atelier demo workspace. These are
   * other tenants' records and operator leftovers; none of them may ever be
   * produced by the canonical seed.
   *
   * The check runs ONLY over rows this seed wrote. It is not a global ban on
   * the strings — real DBR77 and Apator data outside the demo tenant is
   * legitimate and untouched.
   */
  const FORBIDDEN_NAME_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
    { label: 'other tenant: DBR77', pattern: /\bDBR\s*77\b/i },
    { label: 'other tenant: Apator', pattern: /\bapator\b/i },
    { label: 'environment leak: "staging"', pattern: /\bstaging\b/i },
    { label: 'UI duplicate leftover: "(kopia)" / "(copy)"', pattern: /\((?:kopia|copy)\)/i },
    { label: 'placeholder: "test"/"tmp" record', pattern: /\b(?:test record|tmp|temp seed)\b/i },
  ];

  /** Tables whose rows carry the customer-visible Finance naming. */
  const FINANCE_TABLES = [
    'financial_statement_packs',
    'financial_statements',
    'financial_analyses',
    'financial_models',
    'financial_model_events',
    'financial_statement_values',
    'digitization_analyses',
  ];

  /** Columns a user actually reads on screen. */
  const NAME_COLUMNS = [
    'name',
    'title',
    'entity_name',
    'description',
    'notes',
    'original_label',
    'quality_summary',
    'source_file_name',
  ];

  it('no forbidden organization or technical name appears in any Finance row', () => {
    const offences: string[] = [];

    for (const table of FINANCE_TABLES) {
      for (const row of rowsFor(table)) {
        for (const column of NAME_COLUMNS) {
          const value = row[column];
          if (typeof value !== 'string' || !value) continue;
          for (const { label, pattern } of FORBIDDEN_NAME_PATTERNS) {
            if (pattern.test(value)) {
              offences.push(`${table}.${column} = "${value}" (${label})`);
            }
          }
        }
      }
    }

    expect(offences, `foreign records in the canonical Atelier demo fixture:\n${offences.join('\n')}`).toEqual(
      []
    );
  });

  it('every customer-visible Finance record names Atelier Toys', () => {
    const packs = rowsFor('financial_statement_packs');
    const statements = rowsFor('financial_statements');
    const analyses = rowsFor('financial_analyses');
    const models = rowsFor('financial_models');

    expect(packs.length + statements.length + analyses.length + models.length).toBeGreaterThan(0);

    for (const row of [...packs, ...statements]) {
      expect(str(row.entity_name)).toBe(ATELIER_FINANCE_ENTITY_NAME);
    }
    for (const row of [...analyses, ...models]) {
      expect(str(row.title || row.name)).toContain('Atelier Toys');
    }
  });

  it('no two Finance records share a name (the four-duplicate failure mode)', () => {
    for (const table of ['financial_models', 'financial_analyses', 'financial_statement_packs']) {
      const names = rowsFor(table).map((row) => str(row.name || row.title || row.entity_name));
      expect(new Set(names).size, `${table} contains duplicate names: ${names.join(' | ')}`).toBe(
        names.length
      );
    }
  });

  it('every Finance row is scoped to the seeded tenant', () => {
    for (const table of FINANCE_TABLES) {
      for (const row of rowsFor(table)) {
        if (!('organization_id' in row)) continue;
        expect(str(row.organization_id)).toBe(ORG_ID);
      }
    }
  });
});
