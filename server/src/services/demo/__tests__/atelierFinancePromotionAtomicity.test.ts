/**
 * FIN-005 — promotion is ATOMIC, or it is nothing.
 *
 * THE DEFECT THIS FILE GATES. Phase 2 used to promote incrementally: statement
 * 1, then statement 2, then statement 3, then the analysis, then the pack. A
 * failure part-way left the earlier promotions committed, so the fixture ended
 * up in a state that is neither honest nor complete — some statements at
 * `readiness_status='ready'`, others `pending` — while the seed reported
 * `incomplete`. A demo tenant in that state shows a half-approved Finance story
 * and nothing in the result object says which half.
 *
 * THE CONTRACT PROVED HERE. `incomplete` means, with no exceptions:
 *   - ZERO statements at `status='confirmed'` / `validation_status='pass'` /
 *     `readiness_status='ready'`,
 *   - the analysis NOT `APPROVED`,
 *   - the pack NOT `pack_readiness_status='ready'`.
 *
 * Read-back failures (a truncated value set, broken lineage) are covered by
 * `atelierFinanceSchemaGate.test.ts` — those are caught BEFORE the first
 * promotion write. This file covers the other half, which check-then-promote
 * cannot cover on its own: a failure OF the promotion writes themselves. Five
 * scenarios, one per write the promotion phase issues, each asserted by READING
 * THE STORE BACK rather than by trusting the returned object.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fakeDb, type FakeDbConfig } from './helpers/fakeFinanceDb.js';

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

import logger from '../../../utils/Logger.js';
import {
  upsertAtelierFinanceGoldenFlow,
  type AtelierFinanceSeedResult,
} from '../atelierFinanceSeed.js';

const ORG_ID = 'demo-atelier-atomicity-test';

/** A fully migrated Finance schema — the drift gate is not what is under test. */
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

/**
 * The order phase 2 promotes statements in — the same order as
 * `ATELIER_FY2014_STATEMENTS`, so "promotion #2" is unambiguous.
 */
const PROMOTION_ORDER = ['atelier-fy2014-pl', 'atelier-fy2014-bs', 'atelier-fy2014-cf'];

type Write = {
  kind: 'insert' | 'update';
  table: string;
  id: string | null;
  values: Record<string, unknown>;
};

/** Is this the UPDATE that PROMOTES a statement (as opposed to demoting it)? */
function isStatementPromotion(write: Write): boolean {
  return (
    write.kind === 'update' &&
    write.table === 'financial_statements' &&
    write.values.status === 'confirmed'
  );
}

function isAnalysisPromotion(write: Write): boolean {
  return (
    write.kind === 'update' &&
    write.table === 'financial_analyses' &&
    write.values.status === 'APPROVED'
  );
}

function isPackPromotion(write: Write): boolean {
  return (
    write.kind === 'update' &&
    write.table === 'financial_statement_packs' &&
    write.values.pack_status === 'confirmed'
  );
}

/**
 * Fail the Nth statement promotion (1-based) and nothing else — in particular
 * NOT the compensating rollback's UPDATE against the very same row.
 */
function failStatementPromotion(ordinal: number, message: string): FakeDbConfig['onWrite'] {
  let seen = 0;
  return (write: Write) => {
    if (!isStatementPromotion(write)) return null;
    seen += 1;
    return seen === ordinal ? message : null;
  };
}

/** THE assertion this file exists for, read from the STORE. */
function expectStoreHoldsNothingPromoted(): void {
  const statements = fakeDb.rows('financial_statements');
  expect(statements, 'the fixture was never written at all').toHaveLength(3);
  for (const row of statements) {
    const id = String(row.id);
    expect(row.status, `${id} is still promoted`).toBe('imported');
    expect(row.validation_status, `${id} is still promoted`).toBe('pending');
    expect(row.readiness_status, `${id} is still promoted`).toBe('pending');
    expect(Number(row.readiness_score), `${id} is still promoted`).toBe(0);
    expect(row.confirmed_by ?? null, `${id} still names a confirmer`).toBeNull();
    expect(JSON.parse(String(row.quality_reason_codes))).toEqual(['READ_BACK_PENDING']);
  }

  const analyses = fakeDb.rows('financial_analyses');
  expect(analyses).toHaveLength(1);
  expect(analyses[0].status, 'the analysis is still APPROVED').toBe('DRAFT');
  expect(analyses[0].approved_by ?? null).toBeNull();
  expect(analyses[0].approved_at ?? null).toBeNull();

  const packs = fakeDb.rows('financial_statement_packs');
  expect(packs).toHaveLength(1);
  expect(packs[0].pack_status, 'the pack is still promoted').toBe('draft');
  expect(packs[0].pack_readiness_status).toBe('pending');
  expect(Number(packs[0].pack_readiness_score)).toBe(0);
  expect(Number(packs[0].source_statement_count)).toBe(0);
  expect(JSON.parse(String(packs[0].missing_statement_types))).toEqual(['P&L', 'BS', 'CF']);
}

describe('FIN-005 — a failure DURING promotion leaves nothing promoted', () => {
  let warned: string[];
  let errored: string[];

  beforeEach(() => {
    warned = [];
    errored = [];
    vi.spyOn(logger, 'warn').mockImplementation(((message: unknown) => {
      warned.push(String(message));
      return logger;
    }) as never);
    vi.spyOn(logger, 'error').mockImplementation(((message: unknown) => {
      errored.push(String(message));
      return logger;
    }) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** The one INCOMPLETE line the seed emitted for this run. */
  function incompleteLogLine(): string {
    const lines = [...warned, ...errored].filter((line) => line.includes('INCOMPLETE'));
    expect(lines, 'the seed did not log its INCOMPLETE outcome').toHaveLength(1);
    return lines[0];
  }

  async function seed(onWrite: FakeDbConfig['onWrite']): Promise<AtelierFinanceSeedResult> {
    fakeDb.reset({ schema: FULL_SCHEMA, onWrite });
    return upsertAtelierFinanceGoldenFlow({ organizationId: ORG_ID, createdBy: 'user-cfo' });
  }

  for (const [index, slug] of PROMOTION_ORDER.entries()) {
    const ordinal = index + 1;

    it(`statement promotion #${ordinal} (${slug}) fails -> zero statements READY`, async () => {
      const boom = `deadlock detected on statement promotion #${ordinal}`;
      const result = await seed(failStatementPromotion(ordinal, boom));

      expect(result.status).toBe('incomplete');
      expect(result.reason).toBe(`promotion write failed: ${boom}`);
      expect(result.statementIds).toEqual([]);
      expect(result.unpromotedStatementIds).toHaveLength(3);
      expect(result.analysisId).toBeTruthy();

      // The ledger states what really happened: the promotions BEFORE the
      // failing one were issued, then compensated.
      expect(result.promotion?.statementPromotionsIssued).toBe(ordinal - 1);
      expect(result.promotion?.analysisPromotionIssued).toBe(false);
      expect(result.promotion?.packPromotionIssued).toBe(false);
      expect(result.promotion?.rolledBack).toBe(ordinal > 1);
      expect(result.promotion?.rollbackErrors).toEqual([]);
      expect(result.promotion?.rowsStillClaimingReady).toEqual([]);

      // THE assertion: read the store, do not trust the return value.
      expectStoreHoldsNothingPromoted();

      // The logger says exactly what happened — never "nothing promoted" when
      // something was.
      const line = incompleteLogLine();
      expect(errored, 'a clean rollback must not be logged as an error').toEqual([]);
      expect(line).toContain(`issued ${ordinal - 1}/3 statement promotion(s)`);
      expect(line).toContain('analysis=not promoted');
      expect(line).toContain('pack=not promoted');
      expect(line).toContain(
        ordinal > 1
          ? 'every issued promotion was rolled back and re-read as not-ready'
          : 'no promotion needed rolling back'
      );
      expect(line).toContain(boom);
    });
  }

  it('analysis promotion fails -> the three promoted statements are rolled back', async () => {
    const boom = 'connection reset while approving the analysis';
    const result = await seed((write: Write) => (isAnalysisPromotion(write) ? boom : null));

    expect(result.status).toBe('incomplete');
    expect(result.reason).toBe(`promotion write failed: ${boom}`);
    expect(result.statementIds).toEqual([]);
    expect(result.unpromotedStatementIds).toHaveLength(3);

    expect(result.promotion?.statementPromotionsIssued).toBe(3);
    expect(result.promotion?.analysisPromotionIssued).toBe(false);
    expect(result.promotion?.packPromotionIssued).toBe(false);
    expect(result.promotion?.rolledBack).toBe(true);
    expect(result.promotion?.rollbackErrors).toEqual([]);
    expect(result.promotion?.rowsStillClaimingReady).toEqual([]);

    expectStoreHoldsNothingPromoted();

    const line = incompleteLogLine();
    expect(errored).toEqual([]);
    expect(line).toContain('issued 3/3 statement promotion(s)');
    expect(line).toContain('analysis=not promoted');
    expect(line).toContain('every issued promotion was rolled back and re-read as not-ready');
    expect(line).toContain(boom);
  });

  it('pack promotion fails -> statements AND analysis are rolled back', async () => {
    const boom = 'check constraint violated on pack promotion';
    const result = await seed((write: Write) => (isPackPromotion(write) ? boom : null));

    expect(result.status).toBe('incomplete');
    expect(result.reason).toBe(`promotion write failed: ${boom}`);
    expect(result.statementIds).toEqual([]);

    expect(result.promotion?.statementPromotionsIssued).toBe(3);
    expect(result.promotion?.analysisPromotionIssued).toBe(true);
    expect(result.promotion?.packPromotionIssued).toBe(false);
    expect(result.promotion?.rolledBack).toBe(true);
    expect(result.promotion?.rollbackErrors).toEqual([]);
    expect(result.promotion?.rowsStillClaimingReady).toEqual([]);

    expectStoreHoldsNothingPromoted();

    const line = incompleteLogLine();
    expect(errored).toEqual([]);
    expect(line).toContain('issued 3/3 statement promotion(s)');
    // The analysis WAS promoted — the log must say so, not "nothing promoted".
    expect(line).toContain('analysis=promoted');
    expect(line).toContain('pack=not promoted');
    expect(line).toContain('every issued promotion was rolled back and re-read as not-ready');
    expect(line).toContain(boom);
  });
});

describe('FIN-005 — a rollback that itself fails is reported, never papered over', () => {
  let errored: string[];

  beforeEach(() => {
    errored = [];
    vi.spyOn(logger, 'warn').mockImplementation((() => logger) as never);
    vi.spyOn(logger, 'error').mockImplementation(((message: unknown) => {
      errored.push(String(message));
      return logger;
    }) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('a failed demotion is escalated to logger.error and named in the result', async () => {
    // The analysis promotion fails, and so does the demotion of the LAST
    // statement — the worst case: one row really is left claiming READY.
    fakeDb.reset({
      schema: FULL_SCHEMA,
      onWrite: (write: Write) => {
        if (isAnalysisPromotion(write)) return 'analysis promotion exploded';
        if (
          write.kind === 'update' &&
          write.table === 'financial_statements' &&
          write.values.status === 'imported' &&
          String(write.id ?? '').endsWith('atelier-fy2014-cf')
        ) {
          return 'rollback of the CF statement exploded';
        }
        return null;
      },
    });

    const result = await upsertAtelierFinanceGoldenFlow({
      organizationId: ORG_ID,
      createdBy: 'user-cfo',
    });

    expect(result.status).toBe('incomplete');
    expect(result.promotion?.rolledBack).toBe(true);
    expect(result.promotion?.rollbackErrors.join(' ')).toContain(
      'rollback of the CF statement exploded'
    );
    // Verified by RE-READING, not assumed: the CF row still claims READY.
    expect(result.promotion?.rowsStillClaimingReady.join(' ')).toContain('atelier-fy2014-cf');

    const cf = fakeDb
      .rows('financial_statements')
      .find((row) => String(row.id).endsWith('atelier-fy2014-cf'));
    expect(cf?.readiness_status).toBe('ready');

    // The two statements whose demotion succeeded really were demoted.
    for (const slug of ['atelier-fy2014-pl', 'atelier-fy2014-bs']) {
      const row = fakeDb.rows('financial_statements').find((item) => String(item.id).endsWith(slug));
      expect(row?.readiness_status, `${slug} was not rolled back`).toBe('pending');
    }

    const line = errored.find((entry) => entry.includes('INCOMPLETE'));
    expect(line, 'an incomplete rollback must be an ERROR, not a warning').toBeTruthy();
    expect(line).toContain('COMPENSATING ROLLBACK DID NOT COMPLETE');
    expect(line).toContain('rows still claiming READY');
    expect(line).toContain('atelier-fy2014-cf');
  });
});
