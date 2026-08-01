/**
 * FIN-005 — the seed must DETECT that no pinned transaction is possible, say so,
 * and fall back to the verify-then-promote path with its compensating rollback.
 *
 * WHY THIS MATTERS AS MUCH AS THE TRANSACTION ITSELF. The pinned adapter needs
 * a real `pg` connection. Tests replace the whole `DbPromise` module with an
 * in-memory fake; if the adapter grabbed a pool anyway, the fixture rows would
 * live in the fake store while the promotion ran against a real database —
 * split brain, and strictly worse than having no transaction at all. So
 * availability is decided by asking THE SAME MODULE THE SEED WRITES THROUGH.
 *
 * The two properties gated here:
 *   1. On a mocked/in-memory database the seed takes the FALLBACK path, and
 *      still produces a complete, honest fixture.
 *   2. The degradation is never silent — and in production it is logged at
 *      ERROR level, because a production seed run should have a real connection.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

import fs from 'fs';
import os from 'os';
import path from 'path';

import logger from '../../../utils/Logger.js';
import { probePinnedTransactionSupport } from '../atelierFinancePromotionTransaction.js';
import {
  acknowledgeAtelierFinanceCommitIndeterminate,
  atelierFinanceOperatorHoldPath,
  upsertAtelierFinanceGoldenFlow,
} from '../atelierFinanceSeed.js';

process.env.ATELIER_FINANCE_HOLD_DIR =
  process.env.ATELIER_FINANCE_HOLD_DIR ??
  fs.mkdtempSync(path.join(os.tmpdir(), 'fin005-holds-unit-'));

const ORG_ID = 'demo-atelier-pinned-fallback-test';

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

describe('FIN-005 — pinned transaction availability detection', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    fakeDb.reset({ schema: FULL_SCHEMA });
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  it('reports NOT SUPPORTED when the database module is a mock, and says why', async () => {
    const probe = await probePinnedTransactionSupport();
    expect(probe.supported).toBe(false);
    expect(probe.database).toBeNull();
    expect(probe.reason).toMatch(/not PostgreSQL/i);
  });

  it('falls back to verify-then-promote and still completes the fixture', async () => {
    const warn = vi.spyOn(logger, 'warn');

    const result = await upsertAtelierFinanceGoldenFlow({ organizationId: ORG_ID });

    expect(result.status, result.reason ?? '').toBe('complete');
    expect(result.statementIds).toHaveLength(3);
    expect(result.promotion?.statementPromotionsIssued).toBe(3);
    expect(result.promotion?.analysisPromotionIssued).toBe(true);
    expect(result.promotion?.packPromotionIssued).toBe(true);

    const lines = warn.mock.calls.map((call) => String(call[0]));
    expect(
      lines.some((line) => line.includes('WITHOUT a pinned transaction')),
      'the fallback must announce itself'
    ).toBe(true);
  });

  it('logs the unavailability at ERROR level in production — degradation is never silent', async () => {
    process.env.NODE_ENV = 'production';
    const error = vi.spyOn(logger, 'error');

    await upsertAtelierFinanceGoldenFlow({ organizationId: `${ORG_ID}-prod` });

    const lines = error.mock.calls.map((call) => String(call[0]));
    expect(
      lines.some((line) => line.includes('pinned promotion transaction UNAVAILABLE')),
      `expected a production ERROR log; saw: ${JSON.stringify(lines)}`
    ).toBe(true);
  });

  // -------------------------------------------------------------------------
  // FIN-005 P1-3c — the NEEDS_OPERATOR hold gates the seed BEFORE anything runs.
  //
  // The pg suite proves the whole cycle (in-doubt COMMIT -> hold -> blocked
  // run -> acknowledge -> heal). This proves the cheap half that matters most:
  // while a hold stands the seed touches NOTHING — not the schema probe, not
  // phase 0's heal, not a single write.
  // -------------------------------------------------------------------------
  it('REFUSES to run — and issues zero statements — while an unacknowledged hold stands', async () => {
    const heldOrg = `${ORG_ID}-held`;
    const holdFile = atelierFinanceOperatorHoldPath(heldOrg);
    fs.mkdirSync(path.dirname(holdFile), { recursive: true });
    fs.writeFileSync(
      holdFile,
      JSON.stringify({
        organizationId: heldOrg,
        recordedAt: '2026-08-01T00:00:00.000Z',
        packId: 'pack-x',
        analysisId: 'analysis-x',
        statementIds: ['s1', 's2', 's3'],
        reason: 'COMMIT did not return a result',
        reconciliation: 'MIXED state after a lost COMMIT ack: 4/5',
        applied: [],
        backendPid: 4242,
        rowsClaimingReady: ['s1', 's2', 's3', 'pack-x'],
        acknowledgement: `rm "${holdFile}"`,
      }),
      'utf8'
    );

    try {
      fakeDb.reset({ schema: FULL_SCHEMA });
      const result = await upsertAtelierFinanceGoldenFlow({ organizationId: heldOrg });

      expect(result.status).toBe('incomplete');
      expect(result.reason).toMatch(/NEEDS_OPERATOR — refusing to run/);
      expect(result.reason).toMatch(/MIXED state after a lost COMMIT ack: 4\/5/);
      expect(result.reason).toMatch(/has not been acknowledged/);
      // Not one statement was issued: the gate sits above the schema probe.
      expect(fakeDb.calls, 'a held tenant must produce no database traffic').toHaveLength(0);

      // Acknowledged — EXPLICITLY and ATTRIBUTABLY (FIN-005 P1-B #11) — the very
      // same call goes through. The acknowledgement is not a bare `rm`: it names
      // an operator, a decision and a note, and it writes a durable audit record
      // BEFORE it clears anything.
      const ack = acknowledgeAtelierFinanceCommitIndeterminate(heldOrg, {
        operator: 'fin005-suite',
        decision: 'commit-did-not-land',
        note: 'synthetic hold planted by the test; no real in-doubt COMMIT to investigate',
      });
      expect(ack.cleared).toBe(true);
      expect(ack.auditPath).toBeTruthy();
      expect(JSON.parse(fs.readFileSync(ack.auditPath as string, 'utf8')).operator).toBe(
        'fin005-suite'
      );
      const after = await upsertAtelierFinanceGoldenFlow({ organizationId: heldOrg });
      expect(after.status, after.reason ?? '').toBe('complete');
    } finally {
      fs.rmSync(holdFile, { force: true });
    }
  });

  it('a corrupt hold file still blocks — its content is evidence, not a permission slip', async () => {
    const heldOrg = `${ORG_ID}-corrupt`;
    const holdFile = atelierFinanceOperatorHoldPath(heldOrg);
    fs.mkdirSync(path.dirname(holdFile), { recursive: true });
    fs.writeFileSync(holdFile, 'this file was truncated mid-write {', 'utf8');
    try {
      fakeDb.reset({ schema: FULL_SCHEMA });
      const result = await upsertAtelierFinanceGoldenFlow({ organizationId: heldOrg });
      expect(result.status).toBe('incomplete');
      expect(result.reason).toMatch(/NEEDS_OPERATOR — refusing to run/);
      expect(result.reason).toMatch(/not valid JSON/);
      expect(fakeDb.calls).toHaveLength(0);
    } finally {
      fs.rmSync(holdFile, { force: true });
    }
  });

  it('logs the unavailability below ERROR outside production', async () => {
    process.env.NODE_ENV = 'test';
    const error = vi.spyOn(logger, 'error');
    const info = vi.spyOn(logger, 'info');

    await upsertAtelierFinanceGoldenFlow({ organizationId: `${ORG_ID}-dev` });

    expect(
      error.mock.calls
        .map((call) => String(call[0]))
        .some((line) => line.includes('pinned promotion transaction UNAVAILABLE'))
    ).toBe(false);
    expect(
      info.mock.calls
        .map((call) => String(call[0]))
        .some((line) => line.includes('pinned promotion transaction UNAVAILABLE'))
    ).toBe(true);
  });
});
