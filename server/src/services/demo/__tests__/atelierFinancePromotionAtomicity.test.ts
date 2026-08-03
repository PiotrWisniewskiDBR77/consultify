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
 * cannot cover on its own: a failure OF the promotion writes themselves. Ten
 * scenarios — five writes × two ways a write can fail — each asserted by
 * READING THE STORE BACK rather than by trusting the returned object.
 *
 * THE TWO WAYS A WRITE FAILS, and why the second one is the whole point.
 *   (a) REJECTED, NEVER APPLIED — a constraint violation, a deadlock victim.
 *       The row is untouched.
 *   (b) APPLIED, THEN REJECTED — Postgres commits the UPDATE and the client
 *       never sees the result: connection reset, `pg_terminate_backend`, pool
 *       timeout, proxy hiccup. `pool.query` rejects, so the seed concludes the
 *       row was not promoted — while it sits there confirmed/pass/ready.
 * An earlier version of this file only expressed (a), and it asserted the
 * defect that (b) exposes AS INTENDED BEHAVIOUR: it required
 * `rolledBack === false` when the FIRST promotion threw ("nothing to undo"),
 * which skipped the compensating rollback AND its verification re-read. Under
 * (b) that produced a READY statement inside a fixture logged as INCOMPLETE,
 * with `rowsStillClaimingReady: []`. Those expectations are inverted here: the
 * rollback and the re-read now run on EVERY promotion error, over EVERY PLANNED
 * ROW, because a rejected promise is not evidence that the row was not written.
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
  type AtelierFinanceSeedResult,
  upsertAtelierFinanceGoldenFlow,
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
 * NOT the compensating rollback's UPDATE against the very same row (that one
 * writes `status='imported'`, so `isStatementPromotion` does not match it).
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

  /** Same run, but the failing write LANDS before the caller is told it failed. */
  async function seedAppliedThenRejected(
    onWriteAfterApply: FakeDbConfig['onWriteAfterApply']
  ): Promise<AtelierFinanceSeedResult> {
    fakeDb.reset({ schema: FULL_SCHEMA, onWriteAfterApply });
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
      // ALWAYS rolled back, including when the FIRST promotion is the one that
      // threw and the ledger recorded nothing. The old expectation here was
      // `ordinal > 1` — it made the short-circuit that skips the rollback (and
      // its verification re-read) the specification. A rejected promise is not
      // evidence the row was left alone; see the applied-then-rejected block.
      expect(result.promotion?.rolledBack).toBe(true);
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
      // Not "no promotion needed rolling back" any more, even at ordinal 1: the
      // rollback covers every planned row precisely because the counters cannot
      // prove a row was untouched.
      expect(line).toContain('every planned row was demoted and re-read as not-ready');
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
    expect(line).toContain('every planned row was demoted and re-read as not-ready');
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
    expect(line).toContain('every planned row was demoted and re-read as not-ready');
    expect(line).toContain(boom);
  });

  // -- THE case the "rejected == never applied" assumption got wrong ---------
  //
  // Every scenario below APPLIES the write and THEN rejects, exactly as a
  // connection reset between the UPDATE and its response does. The ledger
  // counters therefore UNDERSTATE what landed — which is why neither the
  // rollback nor its verification re-read may be scoped by them.

  for (const [index, slug] of PROMOTION_ORDER.entries()) {
    const ordinal = index + 1;

    it(`statement promotion #${ordinal} (${slug}) APPLIES then rejects -> demoted anyway`, async () => {
      const boom = `connection reset after statement promotion #${ordinal} landed`;
      let seen = 0;
      const result = await seedAppliedThenRejected((write: Write) => {
        if (!isStatementPromotion(write)) return null;
        seen += 1;
        return seen === ordinal ? boom : null;
      });

      expect(result.status).toBe('incomplete');
      expect(result.reason).toBe(`promotion write failed: ${boom}`);
      expect(result.statementIds).toEqual([]);

      // The ledger cannot know the write landed — it never got a response. That
      // is precisely why it must not be the rollback's source of truth.
      expect(result.promotion?.statementPromotionsIssued).toBe(ordinal - 1);
      expect(result.promotion?.rolledBack).toBe(true);
      expect(result.promotion?.rollbackErrors).toEqual([]);
      expect(result.promotion?.rowsStillClaimingReady).toEqual([]);

      // THE assertion: the row that really was written is not left READY.
      expectStoreHoldsNothingPromoted();

      const line = incompleteLogLine();
      expect(errored, 'a clean rollback must not be logged as an error').toEqual([]);
      expect(line).toContain('every planned row was demoted and re-read as not-ready');
    });
  }

  it('the analysis promotion APPLIES then rejects -> the analysis is demoted anyway', async () => {
    const boom = 'pg_terminate_backend after the analysis was approved';
    const result = await seedAppliedThenRejected((write: Write) =>
      isAnalysisPromotion(write) ? boom : null
    );

    expect(result.status).toBe('incomplete');
    expect(result.promotion?.statementPromotionsIssued).toBe(3);
    expect(result.promotion?.analysisPromotionIssued).toBe(false);
    expect(result.promotion?.rolledBack).toBe(true);
    expect(result.promotion?.rowsStillClaimingReady).toEqual([]);

    expectStoreHoldsNothingPromoted();
    expect(errored).toEqual([]);
  });

  it('the pack promotion APPLIES then rejects -> the pack is demoted anyway', async () => {
    const boom = 'pool timeout after the pack was marked ready';
    const result = await seedAppliedThenRejected((write: Write) =>
      isPackPromotion(write) ? boom : null
    );

    expect(result.status).toBe('incomplete');
    expect(result.promotion?.packPromotionIssued).toBe(false);
    expect(result.promotion?.rolledBack).toBe(true);
    expect(result.promotion?.rowsStillClaimingReady).toEqual([]);

    expectStoreHoldsNothingPromoted();
    expect(errored).toEqual([]);
  });
});

describe('FIN-005 — an applied-then-rejected write the compensation cannot fix is REPORTED', () => {
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

  /**
   * The worst case, and the one that proves the applied-then-rejected write
   * REALLY LANDED: the FIRST statement promotion applies and then rejects, and
   * the demotion of that same row fails too. Nothing can repair the row, so the
   * ledger has to NAME it — read back out of the database, not inferred.
   *
   * Under the old code this run recorded `statementPromotionsIssued: 0`,
   * concluded "nothing to roll back", skipped the re-read, reported
   * `rowsStillClaimingReady: []` and logged at WARN — while the P&L sat at
   * confirmed/pass/ready inside a fixture called INCOMPLETE.
   */
  it('names the row still claiming READY and escalates to logger.error', async () => {
    const boom = 'connection reset after the P&L promotion landed';
    fakeDb.reset({
      schema: FULL_SCHEMA,
      onWriteAfterApply: (write: Write) => {
        let ordinal = 0;
        if (isStatementPromotion(write)) ordinal = 1;
        return ordinal === 1 && String(write.id ?? '').endsWith('atelier-fy2014-pl') ? boom : null;
      },
      onWrite: (write: Write) =>
        write.kind === 'update' &&
        write.table === 'financial_statements' &&
        write.values.status === 'imported' &&
        String(write.id ?? '').endsWith('atelier-fy2014-pl')
          ? 'demotion of the P&L exploded too'
          : null,
    });

    const result = await upsertAtelierFinanceGoldenFlow({
      organizationId: ORG_ID,
      createdBy: 'user-cfo',
    });

    expect(result.status).toBe('incomplete');
    // Zero promotions RECORDED — and a rollback ran regardless.
    expect(result.promotion?.statementPromotionsIssued).toBe(0);
    expect(result.promotion?.rolledBack).toBe(true);
    expect(result.promotion?.rollbackErrors.join(' ')).toContain(
      'demotion of the P&L exploded too'
    );
    expect(result.promotion?.rowsStillClaimingReady.join(' ')).toContain('atelier-fy2014-pl');

    // The store proves the "failed" write had really been applied.
    const pl = fakeDb
      .rows('financial_statements')
      .find((row) => String(row.id).endsWith('atelier-fy2014-pl'));
    expect(pl?.status).toBe('confirmed');
    expect(pl?.validation_status).toBe('pass');
    expect(pl?.readiness_status).toBe('ready');

    // The other two were never promoted, and the demotion no-ops left them alone.
    for (const slug of ['atelier-fy2014-bs', 'atelier-fy2014-cf']) {
      const row = fakeDb
        .rows('financial_statements')
        .find((item) => String(item.id).endsWith(slug));
      expect(row?.readiness_status, `${slug} drifted`).toBe('pending');
    }

    const line = errored.find((entry) => entry.includes('INCOMPLETE'));
    expect(
      line,
      'a fixture still holding a READY row must be an ERROR, not a warning'
    ).toBeTruthy();
    expect(line).toContain('COMPENSATING ROLLBACK DID NOT COMPLETE');
    expect(line).toContain('atelier-fy2014-pl');
    expect(warned.filter((entry) => entry.includes('INCOMPLETE'))).toEqual([]);
  });

  /**
   * The residual state above, left on disk by a run that then DIED (SIGTERM on a
   * redeploy, OOM kill) instead of returning: the next run's phase 0 must find
   * the mixed fixture and demote it before re-seeding, so the fixture is never
   * both half-READY and reported INCOMPLETE.
   */
  it('a MIXED fixture left by a crash is healed on the next run', async () => {
    fakeDb.reset({ schema: FULL_SCHEMA });
    const first = await upsertAtelierFinanceGoldenFlow({
      organizationId: ORG_ID,
      createdBy: 'user-cfo',
    });
    expect(first.status).toBe('complete');

    // Simulate the crash residue: the BS and CF statements never got promoted.
    for (const slug of ['atelier-fy2014-bs', 'atelier-fy2014-cf']) {
      const row = fakeDb
        .rows('financial_statements')
        .find((item) => String(item.id).endsWith(slug)) as Record<string, unknown>;
      row.status = 'imported';
      row.validation_status = 'pending';
      row.readiness_status = 'pending';
      row.readiness_score = 0;
    }
    fakeDb.config = {
      ...fakeDb.config,
      // The re-run's read-back gate refuses, so phase 2 promotes NOTHING — the
      // only thing that can clean the P&L up is phase 0.
      onSelect: (table, rows) =>
        table === 'financial_statement_values' &&
        rows.some((row) => String(row.id ?? '').includes('atelier-fy2014-pl'))
          ? rows.slice(1)
          : rows,
    };

    const second = await upsertAtelierFinanceGoldenFlow({
      organizationId: ORG_ID,
      createdBy: 'user-cfo',
    });

    expect(second.status).toBe('incomplete');
    expect(warned.some((entry) => entry.includes('residual MIXED promotion state'))).toBe(true);

    for (const row of fakeDb.rows('financial_statements')) {
      expect(row.status, `${String(row.id)} survived the heal`).toBe('imported');
      expect(row.readiness_status, `${String(row.id)} survived the heal`).toBe('pending');
    }
    expect(fakeDb.rows('financial_analyses')[0].status).toBe('DRAFT');
    expect(fakeDb.rows('financial_statement_packs')[0].pack_readiness_status).toBe('pending');
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
      const row = fakeDb
        .rows('financial_statements')
        .find((item) => String(item.id).endsWith(slug));
      expect(row?.readiness_status, `${slug} was not rolled back`).toBe('pending');
    }

    const line = errored.find((entry) => entry.includes('INCOMPLETE'));
    expect(line, 'an incomplete rollback must be an ERROR, not a warning').toBeTruthy();
    expect(line).toContain('COMPENSATING ROLLBACK DID NOT COMPLETE');
    expect(line).toContain('rows still claiming READY');
    expect(line).toContain('atelier-fy2014-cf');
  });
});
