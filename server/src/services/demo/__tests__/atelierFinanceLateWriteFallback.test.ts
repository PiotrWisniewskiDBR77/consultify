/**
 * FIN-005 P1-2 (RED half) — the compensating fallback path CAN resurrect READY
 * after it has reported failure. Proved through a GENUINE full mock.
 *
 * ===========================================================================
 * WHY THIS FILE EXISTS AT ALL, AND WHY IT IS NOT A `.pg.test.ts`
 * ===========================================================================
 * The green half of this contract lives in `atelierFinanceLateWrite.pg.test.ts`:
 * on a real PostgreSQL the promotion goes through the pinned transaction, the
 * server's own `statement_timeout` cancels a slow UPDATE INSIDE the transaction,
 * and ROLLBACK is the boundary. A green half with no red half proves nothing —
 * it could be green because the fault never fires.
 *
 * The red half used to be produced by setting `MOCK_DB=true` mid-run ON A REAL
 * DATABASE, which forced the seed down the fallback. That is exactly the defect
 * FIN-005 P1-1b closed: an environment variable can no longer talk the module
 * off PostgreSQL, so that door is gone, and the pg suite now asserts it stays
 * shut. The fallback is therefore reachable only through a seam that is real —
 * a wholesale-doubled `DbPromise`, where no statement can reach PostgreSQL even
 * in principle — which is what this file uses.
 *
 * ===========================================================================
 * THE DEFECT, MODELLED EXACTLY
 * ===========================================================================
 * `DbPromise.run`'s timeout settles the JS promise. It does NOT cancel the query
 * in the driver, and it does not roll anything back: the statement keeps running
 * on its backend and lands whenever it lands. On the compensating path:
 *
 *     promotion UPDATE runs long
 *  -> the JS promise rejects
 *  -> the compensation demotes the rows and reports a clean failure
 *  -> the ORIGINAL UPDATE lands
 *  -> part of the fixture is READY again, AFTER the operation said it failed.
 *
 * The fake reproduces precisely that shape and nothing more: for ONE promotion
 * write it rejects immediately (as a JS timeout does) while scheduling the write
 * to be APPLIED TO THE STORE a moment later (as the server does). The second
 * tooth — the compensating demote of that row failing, so nothing papers over
 * the damage — is the fake's ordinary `onWrite` fault hook.
 *
 * A fake is honest here because the thing under test is the ALGORITHM: "verify,
 * promote, compensate on error" cannot survive a write that lands after the
 * compensation, whatever the store is. The pg suite proves the pinned path does
 * not have that shape, on a real database, with a real trigger.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fakeDb, type FakeRow } from './helpers/fakeFinanceDb.js';

/**
 * Writes the test wants to arrive LATE: rejected now, applied later.
 * Hoisted so the `vi.mock` factory can close over it.
 */
const late = vi.hoisted(() => ({
  /** Row id whose promotion UPDATE is deferred. */
  victimId: '',
  /** Resolves once the deferred write has actually been applied to the store. */
  landed: null as null | Promise<void>,
}));

vi.mock('../../../utils/DbPromise.js', async () => {
  const { createDbPromiseMock, fakeDb: store } = await import('./helpers/fakeFinanceDb.js');
  const { vi: vitest } = await import('vitest');
  const base = createDbPromiseMock(vitest as never) as Record<string, unknown>;
  const realRun = base.run as (sql: string, params?: unknown[]) => Promise<unknown>;

  // `get`, `all` AND `run` all stay `vi.fn()` doubles — this is a WHOLESALE
  // doubled module, i.e. the one seam `identifyNonPostgresSeam` may recognise
  // without asking a live database, because the probe would have to travel
  // through this very module.
  const run = vitest.fn((async (sql: string, params: unknown[] = []) => {
    const isPromotion =
      /^\s*UPDATE\s+financial_statements/i.test(sql) &&
      /readiness_status\s*=/i.test(sql) &&
      params.includes('ready') &&
      params.includes(late.victimId);

    if (isPromotion && late.victimId && !late.landed) {
      // THE FAULT. Reject the way a `DbPromise` JS timeout rejects — without
      // cancelling anything — and let the write land afterwards.
      late.landed = new Promise<void>((resolve) => {
        setTimeout(() => {
          void Promise.resolve(realRun(sql, params)).finally(() => resolve());
        }, 150);
      });
      throw new Error(`Query timeout after 1500ms: ${sql.slice(0, 40)}`);
    }
    return realRun(sql, params);
  }) as never);

  return { ...base, run };
});

vi.mock('../../organizationContext/OrganizationContextService.js', () => ({
  organizationContextService: {
    recordContextSource: vi.fn(async () => undefined),
    rebuildSnapshot: vi.fn(async () => undefined),
  },
}));

import logger from '../../../utils/Logger.js';
import {
  getAtelierFinanceCanonicalIds,
  upsertAtelierFinanceGoldenFlow,
} from '../atelierFinanceSeed.js';

const ORG_ID = 'demo-atelier-late-write-fallback';

/** The seed only projects columns the schema probe reports, so describe them. */
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
    'created_by',
    'approved_by',
    'approved_at',
    'updated_at',
  ],
};

function claimsReady(row: FakeRow | undefined): boolean {
  if (!row) return false;
  return (
    String(row.status ?? '') === 'confirmed' ||
    String(row.validation_status ?? '') === 'pass' ||
    String(row.readiness_status ?? '') === 'ready'
  );
}

describe('FIN-005 — the compensating fallback cannot be trusted with a late write', () => {
  beforeEach(() => {
    late.victimId = '';
    late.landed = null;
    fakeDb.reset({ schema: FULL_SCHEMA });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it(
    'RED: on the fallback path the abandoned UPDATE lands and re-promotes the row AFTER the seed reported failure',
    async () => {
      const ids = getAtelierFinanceCanonicalIds(ORG_ID);
      const victim = ids.statementIds[0];

      // Build the fixture once, cleanly, so the fault lands on the promotion
      // rather than on the fixture build.
      const first = await upsertAtelierFinanceGoldenFlow({ organizationId: ORG_ID });
      expect(first.status, first.reason ?? '').toBe('complete');

      // Demote everything back to phase 1 so the next run has to re-promote.
      for (const statementId of ids.statementIds) {
        Object.assign(fakeDb.row('financial_statements', statementId) ?? {}, {
          status: 'imported',
          validation_status: 'pending',
          readiness_status: 'pending',
          readiness_score: 0,
        });
      }
      Object.assign(fakeDb.row('financial_analyses', ids.analysisId) ?? {}, { status: 'DRAFT' });
      Object.assign(fakeDb.row('financial_statement_packs', ids.packId) ?? {}, {
        pack_status: 'draft',
        pack_readiness_status: 'pending',
        pack_readiness_score: 0,
      });

      // Arm both teeth: the victim's promotion is abandoned-but-not-cancelled,
      // and its compensating demote is lost, so nothing papers over the damage.
      late.victimId = victim;
      // `kind === 'update'` is load-bearing: phase 1's INSERT writes
      // `readiness_status = 'pending'` too, and failing THAT would break the
      // fixture build instead of the compensation.
      fakeDb.config.onWrite = (write) =>
        write.kind === 'update' &&
        write.table === 'financial_statements' &&
        write.id === victim &&
        write.values.readiness_status === 'pending'
          ? `FIN005_LATE_WRITE_DEMOTE_LOST ${victim}`
          : null;

      const warn = vi.spyOn(logger, 'warn');
      let warnLines: string[];
      let result: Awaited<ReturnType<typeof upsertAtelierFinanceGoldenFlow>>;
      try {
        result = await upsertAtelierFinanceGoldenFlow({ organizationId: ORG_ID });
      } finally {
        warnLines = warn.mock.calls.map((call) => String(call[0]));
        warn.mockRestore();
      }

      // The fallback really did run — otherwise this proves nothing about it.
      expect(
        warnLines.some((line) => line.includes('WITHOUT a pinned transaction')),
        'this half of the proof requires the fallback path'
      ).toBe(true);

      // The operation returned FAILURE and said its compensation could not
      // reach the row it needed to undo...
      expect(result.status).toBe('incomplete');
      expect(result.promotion?.rolledBack).toBe(true);
      expect(result.promotion?.rollbackErrors.join(' | ')).toMatch(
        new RegExp(`statement ${victim}: `)
      );
      // ...while still reporting, truthfully AT THAT INSTANT, that nothing in
      // the fixture claims READY. This is the claim that decays.
      expect(result.promotion?.rowsStillClaimingReady ?? []).toEqual([]);
      expect(claimsReady(fakeDb.row('financial_statements', victim))).toBe(false);

      // ...and then the write nobody cancelled landed.
      expect(late.landed, 'the deferred promotion must have been scheduled').not.toBeNull();
      await late.landed;

      expect(
        claimsReady(fakeDb.row('financial_statements', victim)),
        'RED PROOF: the UPDATE the JS timeout abandoned lands and re-promotes the row, long after the seed reported failure'
      ).toBe(true);
    },
    60_000
  );
});
