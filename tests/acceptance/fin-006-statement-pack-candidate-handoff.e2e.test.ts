/**
 * FIN-06 — Statement Pack (Finance) -> canonical Candidate handoff
 * acceptance: real router + real auth + local PostgreSQL.
 *
 * Mirrors tests/acceptance/int-008-candidate-handoff.e2e.test.ts's shape
 * (real Express app mounting the actual production router behind the real
 * verifyToken middleware, mintToken/pgClient from harness.js, SEED/seed()
 * from seed.mjs) for the sole Statement Pack source-type adapter this
 * packet owns (`financeStatementPackCandidateHandoff.ts` /
 * `financeCandidateHandoffStatementPack.routes.ts`). The route file is NOT
 * mounted in Gateway.ts yet (a later packet wires all three Finance source
 * adapters in together), so this test mounts it directly the same way the
 * production Gateway eventually will.
 *
 * `finance_candidate_handoffs` (the FIN-06 core's shared receipt table) is
 * applied defensively here via its own migration file, mirroring
 * tests/integration/tls-007-swot-candidate-handoff.realdb.test.ts's
 * self-contained-migration pattern — CREATE TABLE/INDEX IF NOT EXISTS only,
 * safe to re-run.
 *
 * Covers:
 *   1. Preview: not-ready pack -> eligible:false; ready pack -> eligible:true
 *      with real-DB-grounded title/rationale.
 *   2. Confirm: first call creates candidate + receipt; retry is idempotent
 *      (same candidateId, zero extra rows — verified via direct DB query).
 *   3. Concurrency: N=5 concurrent confirms for the same pack -> exactly one
 *      candidate row.
 *   4. Cross-tenant: org B cannot preview/confirm/reopen org A's pack.
 *   5. TOCTOU: pack is `ready` at preview time, flipped to `pending` before
 *      confirm -> confirm re-checks eligibility INSIDE the lock and fails,
 *      never trusting the earlier preview.
 */
import fs from 'node:fs/promises';

import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

const PREFIX = 'odbior--fin006--';
const ORG_B_ID = `${PREFIX}org-b`;
const USER_B_ID = `${PREFIX}user-b`;
const EMAIL_B = `${PREFIX}b@acceptance.local`;

const PACK = {
  golden: `${PREFIX}pack-golden`,
  notReady: `${PREFIX}pack-not-ready`,
  toctou: `${PREFIX}pack-toctou`,
  concurrency: `${PREFIX}pack-concurrency`,
  crossTenant: `${PREFIX}pack-cross-tenant`,
} as const;

const STATEMENT = {
  goldenPl: `${PREFIX}stmt-golden-pl`,
  goldenBs: `${PREFIX}stmt-golden-bs`,
};

let app: Express;
let ownerToken: string;
let orgBToken: string;

async function insertPack(
  client: ReturnType<typeof pgClient>,
  params: {
    id: string;
    organizationId: string;
    readiness: 'pending' | 'recoverable' | 'ready' | 'rejected';
    readinessScore?: number;
    qualitySummary?: string;
  }
) {
  await client.query(
    `INSERT INTO financial_statement_packs
       (id, organization_id, entity_name, period_start, period_end, period_label, currency,
        scaling, pack_status, pack_readiness_status, pack_readiness_score, pack_quality_summary,
        pack_quality_reason_codes, source_statement_count, missing_statement_types)
     VALUES ($1, $2, 'Acme Consulting Sp. z o.o.', '2026-01-01', '2026-03-31', 'Q1 2026', 'PLN',
             'units', 'ready', $3, $4, $5, '["complete"]', 2, '[]')
     ON CONFLICT (id) DO UPDATE SET pack_readiness_status = EXCLUDED.pack_readiness_status`,
    [
      params.id,
      params.organizationId,
      params.readiness,
      params.readinessScore ?? 82,
      params.qualitySummary ?? 'All statements reconciled, no material findings.',
    ]
  );
}

beforeAll(async () => {
  await seed();
  const client = pgClient();
  await client.connect();
  try {
    const now = new Date().toISOString();

    // Defensive, idempotent application of FIN-06's own receipt-table
    // migration — CREATE TABLE/INDEX IF NOT EXISTS only, mirrors TLS-07's
    // self-contained-migration acceptance pattern.
    const migrationSql = await fs.readFile(
      'server/migrations/20260802_fin006_candidate_handoff.sql',
      'utf8'
    );
    await client.query(migrationSql);

    // Defensive, idempotent application of the `source_snapshot` retrofit
    // migration too (additive ALTER TABLE ... ADD COLUMN IF NOT EXISTS).
    const snapshotMigrationSql = await fs.readFile(
      'server/migrations/20260802_fin006_candidate_handoff_source_snapshot.sql',
      'utf8'
    );
    await client.query(snapshotMigrationSql);

    // Org B (cross-tenant fixture) + its owning user + ACTIVE membership.
    await client.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1, $2, 'enterprise', 'active', 1, $3)
       ON CONFLICT (id) DO NOTHING`,
      [ORG_B_ID, 'Odbior FIN-06 Org B', now]
    );
    await client.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1, $2, $3, 'unused', 'OWNER', 'active', 'Org', 'B', $4)
       ON CONFLICT (id) DO NOTHING`,
      [USER_B_ID, ORG_B_ID, EMAIL_B, now]
    );
    await client.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
       VALUES ($1, $2, $3, 'OWNER', 'ACTIVE', $4)
       ON CONFLICT (id) DO NOTHING`,
      [`${PREFIX}org-b-membership`, ORG_B_ID, USER_B_ID, now]
    );

    // Fixture packs (all owned by SEED.ORG_ID / "org A" unless noted).
    await insertPack(client, { id: PACK.golden, organizationId: SEED.ORG_ID, readiness: 'ready' });
    await insertPack(client, {
      id: PACK.notReady,
      organizationId: SEED.ORG_ID,
      readiness: 'pending',
    });
    await insertPack(client, { id: PACK.toctou, organizationId: SEED.ORG_ID, readiness: 'ready' });
    await insertPack(client, {
      id: PACK.concurrency,
      organizationId: SEED.ORG_ID,
      readiness: 'ready',
    });
    await insertPack(client, {
      id: PACK.crossTenant,
      organizationId: SEED.ORG_ID,
      readiness: 'ready',
    });

    // A couple of real statements on the golden pack so the preview's
    // rationale reflects real per-type counts (P&L x1, BS x1, CF x0).
    await client.query(
      `INSERT INTO financial_statements
         (id, organization_id, entity_name, statement_type, period_start, period_end, period_label,
          currency, status, statement_pack_id, created_at, updated_at)
       VALUES ($1, $2, 'Acme Consulting Sp. z o.o.', 'P&L', '2026-01-01', '2026-03-31', 'Q1 2026',
               'PLN', 'confirmed', $3, $4, $4)`,
      [STATEMENT.goldenPl, SEED.ORG_ID, PACK.golden, now]
    );
    await client.query(
      `INSERT INTO financial_statements
         (id, organization_id, entity_name, statement_type, period_start, period_end, period_label,
          currency, status, statement_pack_id, created_at, updated_at)
       VALUES ($1, $2, 'Acme Consulting Sp. z o.o.', 'BS', '2026-01-01', '2026-03-31', 'Q1 2026',
               'PLN', 'confirmed', $3, $4, $4)`,
      [STATEMENT.goldenBs, SEED.ORG_ID, PACK.golden, now]
    );
  } finally {
    await client.end();
  }

  const statementPackRouter = (
    await import('../../server/src/routes/financeCandidateHandoffStatementPack.routes.js')
  ).default;

  app = express();
  app.use(express.json());
  app.use('/api/finance/candidate-handoff/statement-pack', statementPackRouter);

  ownerToken = mintToken();
  orgBToken = mintToken({ id: USER_B_ID, email: EMAIL_B, organizationId: ORG_B_ID, organization_id: ORG_B_ID, role: 'OWNER' });
}, 60_000);

afterAll(async () => {
  const client = pgClient();
  await client.connect();
  try {
    await client.query(`DELETE FROM finance_candidate_handoffs WHERE source_id LIKE $1`, [
      `${PREFIX}%`,
    ]);
    await client.query(`DELETE FROM initiative_candidates WHERE source_id LIKE $1`, [`${PREFIX}%`]);
    await client.query(`DELETE FROM financial_statements WHERE id LIKE $1`, [`${PREFIX}%`]);
    await client.query(`DELETE FROM financial_statement_packs WHERE id LIKE $1`, [`${PREFIX}%`]);
    await client.query(`DELETE FROM organization_members WHERE id LIKE $1`, [`${PREFIX}%`]);
    await client.query(`DELETE FROM users WHERE id = $1`, [USER_B_ID]);
    await client.query(`DELETE FROM organizations WHERE id = $1`, [ORG_B_ID]);
  } finally {
    await client.end();
  }
}, 30_000);

describe('FIN-06 — statement pack candidate handoff (golden flow, idempotency, concurrency, tenant isolation, TOCTOU)', () => {
  it('preview: not-ready pack -> eligible:false; ready pack -> eligible:true with real-DB data', async () => {
    const notReady = await request(app)
      .get(`/api/finance/candidate-handoff/statement-pack/${PACK.notReady}/preview`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(notReady.status, JSON.stringify(notReady.body)).toBe(200);
    expect(notReady.body.data.eligible).toBe(false);
    expect(notReady.body.data.reason).toBe('NOT_READY');

    const golden = await request(app)
      .get(`/api/finance/candidate-handoff/statement-pack/${PACK.golden}/preview`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(golden.status, JSON.stringify(golden.body)).toBe(200);
    expect(golden.body.data.eligible).toBe(true);
    expect(golden.body.data.preview.sourceType).toBe('finance_statement_pack');
    expect(golden.body.data.preview.sourceId).toBe(PACK.golden);
    expect(golden.body.data.preview.title).toContain('Acme Consulting Sp. z o.o.');
    expect(golden.body.data.preview.title).toContain('Q1 2026');
    expect(golden.body.data.preview.rationale).toContain('P&L x1');
    expect(golden.body.data.preview.rationale).toContain('BS x1');
    expect(golden.body.data.preview.rationale).toContain('CF x0');
    expect(golden.body.data.preview.rationale).toContain('PLN');
    expect(golden.body.data.preview.fitScore).toBeCloseTo(0.82, 2);

    // sourceSnapshot: every field present (real value or literal 'unknown'),
    // never missing, never a fabricated/estimated number.
    const snap = golden.body.data.preview.sourceSnapshot;
    expect(snap).toBeDefined();
    for (const key of [
      'currency',
      'capex',
      'opex',
      'npv',
      'irr',
      'roi',
      'payback',
      'baselineOrScenario',
      'assumptions',
      'risks',
      'sourceVersion',
      'sourceFingerprint',
    ]) {
      expect(snap, `sourceSnapshot.${key} must be present`).toHaveProperty(key);
      expect(snap[key], `sourceSnapshot.${key} must never be null`).not.toBeNull();
    }
    // Real value, carried over verbatim from the pack row.
    expect(snap.currency).toBe('PLN');
    // financial_statement_packs has no capex/opex/npv/irr/roi/payback/
    // scenario/assumptions/version column at all — honestly 'unknown'.
    expect(snap.capex).toBe('unknown');
    expect(snap.opex).toBe('unknown');
    expect(snap.npv).toBe('unknown');
    expect(snap.irr).toBe('unknown');
    expect(snap.roi).toBe('unknown');
    expect(snap.payback).toBe('unknown');
    expect(snap.baselineOrScenario).toBe('unknown');
    expect(snap.assumptions).toBe('unknown');
    expect(snap.sourceVersion).toBe('unknown');
    // Real, stored pack_quality_reason_codes (fixture hardcodes '["complete"]').
    expect(snap.risks).toEqual(['complete']);
    expect(typeof snap.sourceFingerprint).toBe('string');
    expect(snap.sourceFingerprint.length).toBeGreaterThan(0);
  });

  it('confirm: creates candidate + receipt; retry is idempotent (same candidateId, no duplicate rows)', async () => {
    const confirm1 = await request(app)
      .post(`/api/finance/candidate-handoff/statement-pack/${PACK.golden}/confirm`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});
    expect(confirm1.status, JSON.stringify(confirm1.body)).toBe(201);
    expect(confirm1.body.data.created).toBe(true);
    const candidateId = confirm1.body.data.candidateId;
    expect(candidateId).toBeTruthy();

    // Confirm response carries the same real-values-only snapshot preview did.
    expect(confirm1.body.data.sourceSnapshot).toBeDefined();
    expect(confirm1.body.data.sourceSnapshot.currency).toBe('PLN');
    expect(confirm1.body.data.sourceSnapshot.risks).toEqual(['complete']);
    expect(confirm1.body.data.sourceSnapshot.npv).toBe('unknown');

    const client = pgClient();
    await client.connect();
    try {
      const candidateRow = await client.query(
        `SELECT source_type, source_id FROM initiative_candidates WHERE id = $1`,
        [candidateId]
      );
      expect(candidateRow.rows).toHaveLength(1);
      expect(candidateRow.rows[0].source_type).toBe('finance_statement_pack');
      expect(candidateRow.rows[0].source_id).toBe(PACK.golden);

      // Direct-DB verification: the persisted source_snapshot column
      // matches exactly what the confirm response returned.
      const handoffRow = await client.query(
        `SELECT source_snapshot FROM finance_candidate_handoffs WHERE source_id = $1`,
        [PACK.golden]
      );
      expect(handoffRow.rows).toHaveLength(1);
      expect(handoffRow.rows[0].source_snapshot).toEqual(confirm1.body.data.sourceSnapshot);
    } finally {
      await client.end();
    }

    const confirm2 = await request(app)
      .post(`/api/finance/candidate-handoff/statement-pack/${PACK.golden}/confirm`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});
    expect(confirm2.status, JSON.stringify(confirm2.body)).toBe(200);
    expect(confirm2.body.data.created).toBe(false);
    expect(confirm2.body.data.candidateId).toBe(candidateId);

    const client2 = pgClient();
    await client2.connect();
    try {
      const candidateCount = await client2.query(
        `SELECT count(*)::int AS n FROM initiative_candidates WHERE source_id = $1`,
        [PACK.golden]
      );
      expect(candidateCount.rows[0].n).toBe(1);
      const handoffCount = await client2.query(
        `SELECT count(*)::int AS n FROM finance_candidate_handoffs WHERE source_id = $1`,
        [PACK.golden]
      );
      expect(handoffCount.rows[0].n).toBe(1);
    } finally {
      await client2.end();
    }

    const lineage = await request(app)
      .get(`/api/finance/candidate-handoff/statement-pack/${PACK.golden}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(lineage.status, JSON.stringify(lineage.body)).toBe(200);
    expect(lineage.body.data.sourceId).toBe(PACK.golden);
    expect(lineage.body.data.candidateId).toBe(candidateId);
    expect(lineage.body.data.sourceType).toBe('finance_statement_pack');
    // Reopen preserves the SAME source_snapshot captured at confirm time.
    expect(lineage.body.data.sourceSnapshot).toEqual(confirm1.body.data.sourceSnapshot);
  });

  it('confirm rejects a not-ready pack (409 SOURCE_NOT_ELIGIBLE, reason NOT_READY)', async () => {
    const res = await request(app)
      .post(`/api/finance/candidate-handoff/statement-pack/${PACK.notReady}/confirm`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});
    expect(res.status, JSON.stringify(res.body)).toBe(409);
    expect(res.body.code).toBe('SOURCE_NOT_ELIGIBLE');
    expect(res.body.details.reason).toBe('NOT_READY');
  });

  it('reopen: unknown/never-confirmed pack -> 404 NO_CANDIDATE_HANDOFF', async () => {
    const res = await request(app)
      .get(`/api/finance/candidate-handoff/statement-pack/${PACK.notReady}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status, JSON.stringify(res.body)).toBe(404);
    expect(res.body.code).toBe('NO_CANDIDATE_HANDOFF');
  });

  it('concurrent confirm calls on the same pack never create a duplicate', async () => {
    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app)
          .post(`/api/finance/candidate-handoff/statement-pack/${PACK.concurrency}/confirm`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({})
      )
    );

    const statuses = responses.map((r) => r.status).sort((a, b) => a - b);
    const dump = JSON.stringify(responses.map((r) => r.body));
    // Exactly one confirm creates (201); the other four find the receipt
    // the first one just committed and short-circuit (200).
    expect(statuses, dump).toEqual([200, 200, 200, 200, 201]);
    expect(responses.filter((r) => r.body.data.created === true).length, dump).toBe(1);

    const candidateIds = new Set(responses.map((r) => r.body.data.candidateId));
    expect(candidateIds.size).toBe(1);

    const client = pgClient();
    await client.connect();
    try {
      const candidateCount = await client.query(
        `SELECT count(*)::int AS n FROM initiative_candidates WHERE source_id = $1`,
        [PACK.concurrency]
      );
      expect(candidateCount.rows[0].n).toBe(1);
      const handoffCount = await client.query(
        `SELECT count(*)::int AS n FROM finance_candidate_handoffs WHERE source_id = $1`,
        [PACK.concurrency]
      );
      expect(handoffCount.rows[0].n).toBe(1);
    } finally {
      await client.end();
    }
  });

  it('cross-tenant: org B cannot preview, confirm, or reopen org A\'s pack', async () => {
    const preview = await request(app)
      .get(`/api/finance/candidate-handoff/statement-pack/${PACK.crossTenant}/preview`)
      .set('Authorization', `Bearer ${orgBToken}`);
    expect(preview.status, JSON.stringify(preview.body)).toBe(200);
    expect(preview.body.data.eligible).toBe(false);
    expect(preview.body.data.reason).toBe('NOT_FOUND');

    const confirm = await request(app)
      .post(`/api/finance/candidate-handoff/statement-pack/${PACK.crossTenant}/confirm`)
      .set('Authorization', `Bearer ${orgBToken}`)
      .send({});
    expect(confirm.status, JSON.stringify(confirm.body)).toBe(409);
    expect(confirm.body.code).toBe('SOURCE_NOT_ELIGIBLE');
    expect(confirm.body.details.reason).toBe('NOT_FOUND');

    // Confirm as org A owner (positive control — proves the pack itself is
    // handoff-eligible and the org-B rejections above are tenant isolation,
    // not a broken fixture), then confirm org B still cannot read it back.
    const ownerConfirm = await request(app)
      .post(`/api/finance/candidate-handoff/statement-pack/${PACK.crossTenant}/confirm`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});
    expect(ownerConfirm.status, JSON.stringify(ownerConfirm.body)).toBe(201);

    const reopenAsB = await request(app)
      .get(`/api/finance/candidate-handoff/statement-pack/${PACK.crossTenant}`)
      .set('Authorization', `Bearer ${orgBToken}`);
    expect(reopenAsB.status, JSON.stringify(reopenAsB.body)).toBe(404);
    expect(reopenAsB.body.code).toBe('NO_CANDIDATE_HANDOFF');

    const reopenAsOwner = await request(app)
      .get(`/api/finance/candidate-handoff/statement-pack/${PACK.crossTenant}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(reopenAsOwner.status, JSON.stringify(reopenAsOwner.body)).toBe(200);
    expect(reopenAsOwner.body.data.candidateId).toBe(ownerConfirm.body.data.candidateId);
  });

  it('TOCTOU: pack becomes non-ready between preview and confirm -> confirm re-checks inside the lock and fails', async () => {
    const preview = await request(app)
      .get(`/api/finance/candidate-handoff/statement-pack/${PACK.toctou}/preview`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(preview.status, JSON.stringify(preview.body)).toBe(200);
    expect(preview.body.data.eligible).toBe(true);

    // Simulate the pack's readiness flipping (e.g. a statement got
    // un-confirmed and readiness recomputed) AFTER the preview above but
    // BEFORE the confirm call below — a direct, already-committed write,
    // exactly like a real recompute would produce.
    const client = pgClient();
    await client.connect();
    try {
      await client.query(
        `UPDATE financial_statement_packs SET pack_readiness_status = 'pending' WHERE id = $1`,
        [PACK.toctou]
      );
    } finally {
      await client.end();
    }

    const confirm = await request(app)
      .post(`/api/finance/candidate-handoff/statement-pack/${PACK.toctou}/confirm`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});
    expect(confirm.status, JSON.stringify(confirm.body)).toBe(409);
    expect(confirm.body.code).toBe('SOURCE_NOT_ELIGIBLE');
    expect(confirm.body.details.reason).toBe('NOT_READY');

    const client2 = pgClient();
    await client2.connect();
    try {
      const candidateCount = await client2.query(
        `SELECT count(*)::int AS n FROM initiative_candidates WHERE source_id = $1`,
        [PACK.toctou]
      );
      expect(candidateCount.rows[0].n).toBe(0);
      const handoffCount = await client2.query(
        `SELECT count(*)::int AS n FROM finance_candidate_handoffs WHERE source_id = $1`,
        [PACK.toctou]
      );
      expect(handoffCount.rows[0].n).toBe(0);
    } finally {
      await client2.end();
    }
  });

  it('Blocker 1: real per-type statement counts (P&L x1, BS x1, CF x0) direct DB read-back matches the preview exactly', async () => {
    // Direct DB proof (not just the API response) that the fixture really
    // has exactly 1 P&L, 1 BS, 0 CF for PACK.golden.
    const client = pgClient();
    await client.connect();
    try {
      const counts = await client.query(
        `SELECT statement_type, count(*)::int AS n FROM financial_statements
         WHERE statement_pack_id = $1 GROUP BY statement_type`,
        [PACK.golden]
      );
      const byType = Object.fromEntries(counts.rows.map((r) => [r.statement_type, r.n]));
      expect(byType['P&L']).toBe(1);
      expect(byType['BS']).toBe(1);
      expect(byType['CF']).toBeUndefined(); // zero rows -> no group at all

      const preview = await request(app)
        .get(`/api/finance/candidate-handoff/statement-pack/${PACK.golden}/preview`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(preview.status, JSON.stringify(preview.body)).toBe(200);
      expect(preview.body.data.eligible).toBe(true);
      expect(preview.body.data.preview.rationale).toContain('P&L x1');
      expect(preview.body.data.preview.rationale).toContain('BS x1');
      expect(preview.body.data.preview.rationale).toContain('CF x0');
    } finally {
      await client.end();
    }
  });

  it('Blocker 1: a genuinely broken required schema fails closed, never shows a fake eligible P&L x0/BS x0/CF x0 preview', async () => {
    // Deliberately break a column BOTH the primary and the schema-compat
    // fallback query require (`statement_type` -- guaranteed by the base
    // migration, never treated as an optional "bonus" column). This is NOT
    // the class of gap the fix's fallback is designed to tolerate -- it must
    // propagate as a real failure, never silently resolve to an
    // empty-but-200-eligible result.
    const client = pgClient();
    await client.connect();
    try {
      await client.query(`ALTER TABLE financial_statements RENAME COLUMN statement_type TO statement_type__sabotaged`);
    } finally {
      await client.end();
    }

    try {
      const preview = await request(app)
        .get(`/api/finance/candidate-handoff/statement-pack/${PACK.golden}/preview`)
        .set('Authorization', `Bearer ${ownerToken}`);
      // Must NOT be a false-positive "eligible" result with fabricated zero
      // counts. A real failure (5xx) is the only acceptable outcome here --
      // explicitly assert it is NOT the shape the original bug produced.
      const looksLikeFakeEmptySuccess =
        preview.status === 200 &&
        preview.body?.data?.eligible === true &&
        typeof preview.body?.data?.preview?.rationale === 'string' &&
        preview.body.data.preview.rationale.includes('P&L x0');
      expect(looksLikeFakeEmptySuccess, JSON.stringify(preview.body)).toBe(false);
      expect(preview.status, JSON.stringify(preview.body)).toBeGreaterThanOrEqual(500);
    } finally {
      const restore = pgClient();
      await restore.connect();
      try {
        await restore.query(
          `ALTER TABLE financial_statements RENAME COLUMN statement_type__sabotaged TO statement_type`
        );
      } finally {
        await restore.end();
      }
    }

    // Confirm the sabotage was fully reverted: the golden preview is back to
    // normal, real, correct counts.
    const recovered = await request(app)
      .get(`/api/finance/candidate-handoff/statement-pack/${PACK.golden}/preview`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(recovered.status, JSON.stringify(recovered.body)).toBe(200);
    expect(recovered.body.data.eligible).toBe(true);
    expect(recovered.body.data.preview.rationale).toContain('P&L x1');
  });
});
