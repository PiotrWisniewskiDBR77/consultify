/**
 * Lane C (closure) — `handoffSpineService.ts` acceptance evidence, against a
 * REAL local Postgres (no mocks).
 *
 * Lives under `server/src/services/artifactHandoff/__tests__/` (not
 * `tests/artifact-handoff/`) specifically so the ROOT `vitest.config.ts`
 * collects it via its existing glob
 * `server/src/services/**\/__tests__/**\/*.{test,spec}.{js,ts,jsx,tsx}` —
 * and therefore so `scripts/testing/generate-test-inventory.ts` (and any
 * mandated gate reading that inventory) actually discovers this file. A
 * standalone per-directory Vitest config (the first draft of this suite)
 * runs green locally but is invisible to every frozen gate denominator —
 * a green test no gate runs is not closure evidence.
 *
 * Exercises the three tables from
 * `server/migrations/20260912_claude_c_handoff_spine.sql` plus the
 * follow-up `server/migrations/20260912_claude_c_handoff_spine_version_unique.sql`:
 *   - `artifact_handoff_proposals` / `artifact_handoff_receipts` — the
 *     propose -> human-approve -> materialize-exactly-once spine.
 *   - `artifact_export_receipts` — the hash-bound export receipt, including
 *     the MAT-POL-001 fail-closed "unavailable" path.
 *
 * Every fixture id is prefixed `claude_c_<runId>-...` and `afterAll` deletes
 * every row this file created, verified by a final COUNT(*) — demo data is
 * the product's face; this suite leaves zero rows behind.
 *
 * Run (root config — no --config flag; MOCK_DB=false is required because
 * `tests/setup.ts:387` does `process.env.MOCK_DB = process.env.MOCK_DB ||
 * 'true'`, which would otherwise force the pooled DB mock under NODE_ENV=test):
 *   export DATABASE_URL="postgresql://consultinity:consultinity@127.0.0.1:55432/consultinity"
 *   export DB_TYPE=postgres CI=true MOCK_DB=false RUN_DB_TESTS=1
 *   npx vitest run server/src/services/artifactHandoff/__tests__/handoffSpine.pg.test.ts \
 *     --no-file-parallelism --maxWorkers=1
 */
import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  approveProposal,
  canonicalSourceHash,
  completeExportReceipt,
  createProposal,
  failExportReceipt,
  HandoffSpineError,
  markExportUnavailable,
  materializeProposal,
  recordExportReceipt,
  rejectProposal,
} from '../handoffSpineService.js';

function requireLocalDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url || !/localhost|127\.0\.0\.1/.test(url)) {
    throw new Error(
      `handoffSpine.pg.test.ts requires a LOCAL DATABASE_URL (got: ${url || '(unset)'}). ` +
        'This suite writes real rows and must never point at a shared/demo/prod database.'
    );
  }
  return url;
}

const RUN_ID = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const PREFIX = `claude_c_${RUN_ID}-`;
const ORG_A = `${PREFIX}org-a`;
const ORG_B = `${PREFIX}org-b`;
const USER_A = `${PREFIX}user-a`;
const USER_B = `${PREFIX}user-b`;

const pool = new Pool({ connectionString: requireLocalDatabaseUrl() });

async function countFixtureRows(): Promise<{ proposals: number; receipts: number; exports: number }> {
  const result = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM artifact_handoff_proposals WHERE organization_id LIKE $1) AS proposals,
       (SELECT COUNT(*)::int FROM artifact_handoff_receipts  WHERE organization_id LIKE $1) AS receipts,
       (SELECT COUNT(*)::int FROM artifact_export_receipts   WHERE organization_id LIKE $1) AS exports`,
    [`${PREFIX}%`]
  );
  return result.rows[0];
}

beforeAll(async () => {
  // Fail loudly (not a silent skip) if the migrations this suite depends on
  // are missing — this suite's premise is that they are already applied to
  // the local database, per the worker brief.
  const tables = await pool.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('artifact_handoff_proposals', 'artifact_handoff_receipts', 'artifact_export_receipts')`
  );
  if (tables.rows.length !== 3) {
    throw new Error(
      `handoffSpine.pg.test.ts requires server/migrations/20260912_claude_c_handoff_spine.sql ` +
        `to be applied. Found ${tables.rows.length}/3 tables.`
    );
  }
  const versionIndex = await pool.query(
    `SELECT indexname FROM pg_indexes
      WHERE tablename = 'artifact_handoff_proposals' AND indexname = 'idx_handoff_proposal_version_unique'`
  );
  if (versionIndex.rows.length !== 1) {
    throw new Error(
      `handoffSpine.pg.test.ts requires ` +
        `server/migrations/20260912_claude_c_handoff_spine_version_unique.sql to be applied ` +
        `(missing index idx_handoff_proposal_version_unique).`
    );
  }
});

afterAll(async () => {
  try {
    // Children (FK -> proposals) before parents.
    await pool.query(`DELETE FROM artifact_handoff_receipts WHERE organization_id LIKE $1`, [`${PREFIX}%`]);
    await pool.query(`DELETE FROM artifact_handoff_proposals WHERE organization_id LIKE $1`, [`${PREFIX}%`]);
    await pool.query(`DELETE FROM artifact_export_receipts WHERE organization_id LIKE $1`, [`${PREFIX}%`]);

    const remaining = await countFixtureRows();
    expect(remaining).toEqual({ proposals: 0, receipts: 0, exports: 0 });
  } finally {
    await pool.end();
  }
});

describe('canonicalSourceHash', () => {
  it('is independent of object key order', () => {
    const a = canonicalSourceHash({ b: 2, a: 1, nested: { y: 2, x: 1 } });
    const b = canonicalSourceHash({ a: 1, nested: { x: 1, y: 2 }, b: 2 });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when a value changes', () => {
    const a = canonicalSourceHash({ a: 1, nested: { x: 1, y: 2 }, b: 2 });
    const changed = canonicalSourceHash({ a: 1, nested: { x: 1, y: 3 }, b: 2 });
    expect(changed).not.toBe(a);
  });

  it('preserves array order (arrays are not sorted, only object keys)', () => {
    const a = canonicalSourceHash({ items: [1, 2, 3] });
    const reordered = canonicalSourceHash({ items: [3, 2, 1] });
    expect(a).not.toBe(reordered);
  });
});

describe('create -> approve -> materialize happy path', () => {
  it('runs end to end and survives a cold, independent readback', async () => {
    const producerRecordId = `${PREFIX}idea-happy`;
    const payload = { title: 'Q3 plan', sections: ['a', 'b'] };

    const created = await createProposal({
      organizationId: ORG_A,
      producerKind: 'idea',
      producerRecordId,
      targetKind: 'document',
      payload,
      createdBy: USER_A,
    });
    expect(created.replayed).toBe(false);
    expect(created.proposal.state).toBe('pending');
    expect(created.proposal.sourceContentHash).toBe(canonicalSourceHash(payload));
    expect(created.proposal.sourceVersion).toBe(1);

    const approved = await approveProposal({
      organizationId: ORG_A,
      proposalId: created.proposal.proposalId,
      decidedBy: USER_B,
    });
    expect(approved.state).toBe('approved');
    expect(approved.selfApproved).toBe(false);

    const materialized = await materializeProposal({
      organizationId: ORG_A,
      proposalId: created.proposal.proposalId,
      targetRecordId: `${PREFIX}doc-happy`,
      materializedBy: USER_B,
      outputPayload: { html: '<p>done</p>' },
    });
    expect(materialized.replayed).toBe(false);
    expect(materialized.receipt.outputContentHash).toBe(canonicalSourceHash({ html: '<p>done</p>' }));

    // Cold readback: fresh SELECTs against the real table, never trusting the
    // JS objects the service handed back.
    const proposalRow = await pool.query(
      `SELECT * FROM artifact_handoff_proposals WHERE proposal_id = $1 AND organization_id = $2`,
      [created.proposal.proposalId, ORG_A]
    );
    expect(proposalRow.rows[0].state).toBe('materialized');
    expect(proposalRow.rows[0].decided_by).toBe(USER_B);

    const receiptRow = await pool.query(
      `SELECT * FROM artifact_handoff_receipts WHERE proposal_id = $1 AND organization_id = $2`,
      [created.proposal.proposalId, ORG_A]
    );
    expect(receiptRow.rows).toHaveLength(1);
    expect(receiptRow.rows[0].materialized_by).toBe(USER_B);
    expect(receiptRow.rows[0].target_record_id).toBe(`${PREFIX}doc-happy`);
  });
});

describe('source_version monotonicity', () => {
  it('increments per (organizationId, producerKind, producerRecordId)', async () => {
    const producerRecordId = `${PREFIX}idea-versions`;
    const v1 = await createProposal({
      organizationId: ORG_A,
      producerKind: 'idea',
      producerRecordId,
      targetKind: 'document',
      payload: { v: 1 },
      createdBy: USER_A,
    });
    const v2 = await createProposal({
      organizationId: ORG_A,
      producerKind: 'idea',
      producerRecordId,
      targetKind: 'document',
      payload: { v: 2 },
      createdBy: USER_A,
    });
    expect(v1.proposal.sourceVersion).toBe(1);
    expect(v2.proposal.sourceVersion).toBe(2);
  });

  it('two CONCURRENT creates with NO idempotency key for a BRAND-NEW producer record still yield versions 1 and 2, never a duplicate or an error', async () => {
    // This is the race `SELECT ... FOR UPDATE` cannot close by itself:
    // Postgres cannot lock rows that do not exist yet, so two concurrent
    // first-time proposals for the same producer record could both compute
    // "next version = 1". `idx_handoff_proposal_version_unique`
    // (server/migrations/20260912_claude_c_handoff_spine_version_unique.sql)
    // catches that collision at the DB layer, and `createProposal` retries
    // the loser once with a freshly recomputed version instead of failing.
    const producerRecordId = `${PREFIX}idea-version-race`;
    const makeInput = () => ({
      organizationId: ORG_A,
      producerKind: 'idea' as const,
      producerRecordId,
      targetKind: 'document' as const,
      payload: { race: 'no-idempotency-key' },
      createdBy: USER_A,
    });

    const [r1, r2] = await Promise.all([createProposal(makeInput()), createProposal(makeInput())]);

    expect(r1.proposal.proposalId).not.toBe(r2.proposal.proposalId);
    const versions = [r1.proposal.sourceVersion, r2.proposal.sourceVersion].sort((a, b) => a - b);
    expect(versions).toEqual([1, 2]);

    const rows = await pool.query(
      `SELECT proposal_id, source_version FROM artifact_handoff_proposals
        WHERE organization_id = $1 AND producer_kind = 'idea' AND producer_record_id = $2
        ORDER BY source_version ASC`,
      [ORG_A, producerRecordId]
    );
    expect(rows.rows.map((row) => Number(row.source_version))).toEqual([1, 2]);
  });
});

describe('createProposal idempotency', () => {
  it('sequential retry of the same key returns the same row, marked replayed', async () => {
    const idempotencyKey = `${PREFIX}idem-seq`;
    const producerRecordId = `${PREFIX}idea-idem-seq`;
    const input = {
      organizationId: ORG_A,
      producerKind: 'idea' as const,
      producerRecordId,
      targetKind: 'document' as const,
      payload: { a: 1 },
      createdBy: USER_A,
      idempotencyKey,
    };

    const first = await createProposal(input);
    const second = await createProposal(input);

    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(second.proposal.proposalId).toBe(first.proposal.proposalId);

    const rows = await pool.query(
      `SELECT COUNT(*)::int AS n FROM artifact_handoff_proposals WHERE organization_id = $1 AND idempotency_key = $2`,
      [ORG_A, idempotencyKey]
    );
    expect(rows.rows[0].n).toBe(1);
  });

  it('two CONCURRENT calls with the same key produce exactly one row total', async () => {
    const idempotencyKey = `${PREFIX}idem-concurrent`;
    const producerRecordId = `${PREFIX}idea-idem-concurrent`;
    const input = {
      organizationId: ORG_A,
      producerKind: 'idea' as const,
      producerRecordId,
      targetKind: 'document' as const,
      payload: { race: true },
      createdBy: USER_A,
      idempotencyKey,
    };

    const [r1, r2] = await Promise.all([createProposal(input), createProposal(input)]);

    const replayedCount = [r1.replayed, r2.replayed].filter(Boolean).length;
    expect(replayedCount).toBe(1);
    expect(r1.proposal.proposalId).toBe(r2.proposal.proposalId);

    const rows = await pool.query(
      `SELECT COUNT(*)::int AS n FROM artifact_handoff_proposals WHERE organization_id = $1 AND idempotency_key = $2`,
      [ORG_A, idempotencyKey]
    );
    expect(rows.rows[0].n).toBe(1);
  });
});

describe('approveProposal / rejectProposal', () => {
  it('two CONCURRENT approvals resolve to one approval, one idempotent replay, single decided_by', async () => {
    const producerRecordId = `${PREFIX}idea-approve-race`;
    const created = await createProposal({
      organizationId: ORG_A,
      producerKind: 'idea',
      producerRecordId,
      targetKind: 'document',
      payload: { x: 1 },
      createdBy: USER_A,
    });

    const [a1, a2] = await Promise.all([
      approveProposal({ organizationId: ORG_A, proposalId: created.proposal.proposalId, decidedBy: USER_A }),
      approveProposal({ organizationId: ORG_A, proposalId: created.proposal.proposalId, decidedBy: USER_B }),
    ]);

    expect(a1.state).toBe('approved');
    expect(a2.state).toBe('approved');
    // Both calls converge on ONE winner's decided_by — never two different
    // deciders for the same proposal.
    expect(a1.decidedBy).toBe(a2.decidedBy);

    const row = await pool.query(
      `SELECT decided_by FROM artifact_handoff_proposals WHERE proposal_id = $1`,
      [created.proposal.proposalId]
    );
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0].decided_by).toBe(a1.decidedBy);
  });

  it('approving an already-approved proposal is idempotent (same decision, no re-stamp)', async () => {
    const producerRecordId = `${PREFIX}idea-approve-idem`;
    const created = await createProposal({
      organizationId: ORG_A,
      producerKind: 'idea',
      producerRecordId,
      targetKind: 'document',
      payload: { i: 1 },
      createdBy: USER_A,
    });

    const first = await approveProposal({
      organizationId: ORG_A,
      proposalId: created.proposal.proposalId,
      decidedBy: USER_A,
    });
    const second = await approveProposal({
      organizationId: ORG_A,
      proposalId: created.proposal.proposalId,
      decidedBy: USER_A,
    });

    expect(second.state).toBe('approved');
    expect(second.decidedAt).toBe(first.decidedAt);
  });

  it('rejecting an approved proposal, and approving a rejected proposal, are both errors', async () => {
    const producerRecordId1 = `${PREFIX}idea-reject-after-approve`;
    const approvedFirst = await createProposal({
      organizationId: ORG_A,
      producerKind: 'idea',
      producerRecordId: producerRecordId1,
      targetKind: 'document',
      payload: { s: 1 },
      createdBy: USER_A,
    });
    await approveProposal({
      organizationId: ORG_A,
      proposalId: approvedFirst.proposal.proposalId,
      decidedBy: USER_A,
    });
    await expect(
      rejectProposal({
        organizationId: ORG_A,
        proposalId: approvedFirst.proposal.proposalId,
        decidedBy: USER_B,
      })
    ).rejects.toThrow(/cannot reject/);

    const producerRecordId2 = `${PREFIX}idea-approve-after-reject`;
    const rejectedFirst = await createProposal({
      organizationId: ORG_A,
      producerKind: 'idea',
      producerRecordId: producerRecordId2,
      targetKind: 'document',
      payload: { s: 2 },
      createdBy: USER_A,
    });
    await rejectProposal({
      organizationId: ORG_A,
      proposalId: rejectedFirst.proposal.proposalId,
      decidedBy: USER_A,
      reason: 'not needed',
    });
    await expect(
      approveProposal({
        organizationId: ORG_A,
        proposalId: rejectedFirst.proposal.proposalId,
        decidedBy: USER_B,
      })
    ).rejects.toThrow(/cannot approve/);
  });

  it('self-approval is recorded, not forbidden', async () => {
    const producerRecordId = `${PREFIX}idea-self-approve`;
    const created = await createProposal({
      organizationId: ORG_A,
      producerKind: 'chat',
      producerRecordId,
      targetKind: 'document',
      payload: { sa: 1 },
      createdBy: USER_A,
    });
    const approved = await approveProposal({
      organizationId: ORG_A,
      proposalId: created.proposal.proposalId,
      decidedBy: USER_A,
    });
    expect(approved.selfApproved).toBe(true);

    const row = await pool.query(
      `SELECT self_approved FROM artifact_handoff_proposals WHERE proposal_id = $1`,
      [created.proposal.proposalId]
    );
    expect(row.rows[0].self_approved).toBe(true);
  });

  it('rejects an empty or system actor — human approval is required', async () => {
    const producerRecordId = `${PREFIX}idea-bad-actor`;
    const created = await createProposal({
      organizationId: ORG_A,
      producerKind: 'idea',
      producerRecordId,
      targetKind: 'document',
      payload: { z: 1 },
      createdBy: USER_A,
    });

    await expect(
      approveProposal({ organizationId: ORG_A, proposalId: created.proposal.proposalId, decidedBy: '' })
    ).rejects.toThrow(HandoffSpineError);
    await expect(
      approveProposal({ organizationId: ORG_A, proposalId: created.proposal.proposalId, decidedBy: 'system' })
    ).rejects.toThrow(/human actor/);
    await expect(
      approveProposal({ organizationId: ORG_A, proposalId: created.proposal.proposalId, decidedBy: 'SYSTEM' })
    ).rejects.toThrow(/human actor/);

    const row = await pool.query(
      `SELECT state, decided_by FROM artifact_handoff_proposals WHERE proposal_id = $1`,
      [created.proposal.proposalId]
    );
    expect(row.rows[0].state).toBe('pending');
    expect(row.rows[0].decided_by).toBeNull();
  });
});

describe('materializeProposal', () => {
  it('two CONCURRENT materializations of the same proposal yield EXACTLY ONE receipt row', async () => {
    const producerRecordId = `${PREFIX}idea-materialize-race`;
    const created = await createProposal({
      organizationId: ORG_A,
      producerKind: 'idea',
      producerRecordId,
      targetKind: 'document',
      payload: { y: 1 },
      createdBy: USER_A,
    });
    await approveProposal({ organizationId: ORG_A, proposalId: created.proposal.proposalId, decidedBy: USER_B });

    const targetRecordId = `${PREFIX}doc-materialize-race`;
    const [m1, m2] = await Promise.all([
      materializeProposal({
        organizationId: ORG_A,
        proposalId: created.proposal.proposalId,
        targetRecordId,
        materializedBy: USER_A,
      }),
      materializeProposal({
        organizationId: ORG_A,
        proposalId: created.proposal.proposalId,
        targetRecordId,
        materializedBy: USER_B,
      }),
    ]);

    const replayedCount = [m1.replayed, m2.replayed].filter(Boolean).length;
    expect(replayedCount).toBe(1);
    expect(m1.receipt.receiptId).toBe(m2.receipt.receiptId);

    const rows = await pool.query(
      `SELECT COUNT(*)::int AS n FROM artifact_handoff_receipts WHERE proposal_id = $1`,
      [created.proposal.proposalId]
    );
    expect(rows.rows[0].n).toBe(1);

    const proposalRow = await pool.query(
      `SELECT state FROM artifact_handoff_proposals WHERE proposal_id = $1`,
      [created.proposal.proposalId]
    );
    expect(proposalRow.rows[0].state).toBe('materialized');
  });

  it('is rejected when the proposal has not been approved', async () => {
    const producerRecordId = `${PREFIX}idea-no-approval`;
    const created = await createProposal({
      organizationId: ORG_A,
      producerKind: 'idea',
      producerRecordId,
      targetKind: 'document',
      payload: { n: 1 },
      createdBy: USER_A,
    });

    await expect(
      materializeProposal({
        organizationId: ORG_A,
        proposalId: created.proposal.proposalId,
        targetRecordId: `${PREFIX}doc-no-approval`,
        materializedBy: USER_A,
      })
    ).rejects.toThrow(/must be 'approved'/);

    const rows = await pool.query(
      `SELECT COUNT(*)::int AS n FROM artifact_handoff_receipts WHERE proposal_id = $1`,
      [created.proposal.proposalId]
    );
    expect(rows.rows[0].n).toBe(0);
  });
});

describe('tenant isolation', () => {
  it('org B cannot approve, materialize, or affect org A proposal', async () => {
    const producerRecordId = `${PREFIX}idea-tenant`;
    const created = await createProposal({
      organizationId: ORG_A,
      producerKind: 'idea',
      producerRecordId,
      targetKind: 'document',
      payload: { t: 1 },
      createdBy: USER_A,
    });

    await expect(
      approveProposal({ organizationId: ORG_B, proposalId: created.proposal.proposalId, decidedBy: USER_B })
    ).rejects.toThrow(/not found/);

    // Real approval, from the owning org.
    await approveProposal({ organizationId: ORG_A, proposalId: created.proposal.proposalId, decidedBy: USER_A });

    await expect(
      materializeProposal({
        organizationId: ORG_B,
        proposalId: created.proposal.proposalId,
        targetRecordId: `${PREFIX}doc-tenant`,
        materializedBy: USER_B,
      })
    ).rejects.toThrow(/not found/);

    const row = await pool.query(
      `SELECT state, organization_id FROM artifact_handoff_proposals WHERE proposal_id = $1`,
      [created.proposal.proposalId]
    );
    expect(row.rows[0].organization_id).toBe(ORG_A);
    expect(row.rows[0].state).toBe('approved');

    const receiptRows = await pool.query(
      `SELECT COUNT(*)::int AS n FROM artifact_handoff_receipts WHERE proposal_id = $1`,
      [created.proposal.proposalId]
    );
    expect(receiptRows.rows[0].n).toBe(0);
  });
});

describe('export receipts', () => {
  it('complete requires hash + size; unavailable is explicit, never a fake success', async () => {
    const sourceRecordId = `${PREFIX}doc-export-1`;
    const recorded = await recordExportReceipt({
      organizationId: ORG_A,
      artifactKind: 'document',
      sourceRecordId,
      sourceVersion: 1,
      sourceContentHash: canonicalSourceHash({ body: 'v1' }),
      outputFormat: 'pdf',
      providerKey: 'native:pdfkit',
      createdBy: USER_A,
    });
    expect(recorded.receipt.status).toBe('pending');

    await expect(
      completeExportReceipt({
        organizationId: ORG_A,
        exportReceiptId: recorded.receipt.exportReceiptId,
        outputContentHash: '',
        outputByteSize: 100,
      })
    ).rejects.toThrow(HandoffSpineError);

    await expect(
      completeExportReceipt({
        organizationId: ORG_A,
        exportReceiptId: recorded.receipt.exportReceiptId,
        outputContentHash: 'abc',
        outputByteSize: -1,
      })
    ).rejects.toThrow(HandoffSpineError);

    const completed = await completeExportReceipt({
      organizationId: ORG_A,
      exportReceiptId: recorded.receipt.exportReceiptId,
      outputContentHash: 'deadbeef',
      outputByteSize: 1234,
    });
    expect(completed.status).toBe('succeeded');
    expect(completed.outputByteSize).toBe(1234);

    // A provider that isn't approved yet (MAT-POL-001) — fails CLOSED.
    const recorded2 = await recordExportReceipt({
      organizationId: ORG_A,
      artifactKind: 'workbook',
      sourceRecordId: `${PREFIX}wb-export-1`,
      sourceVersion: 1,
      sourceContentHash: canonicalSourceHash({ body: 'wb' }),
      outputFormat: 'xlsx',
      providerKey: 'unavailable',
      createdBy: USER_A,
    });
    const unavailable = await markExportUnavailable({
      organizationId: ORG_A,
      exportReceiptId: recorded2.receipt.exportReceiptId,
      failureCode: 'PROVIDER_NOT_APPROVED',
    });
    expect(unavailable.status).toBe('unavailable');
    expect(unavailable.outputContentHash).toBeNull();
    expect(unavailable.outputByteSize).toBeNull();

    // Defense-in-depth proof: the DB check constraint blocks 'succeeded'
    // without hash+size even if application validation were bypassed.
    await expect(
      pool.query(`UPDATE artifact_export_receipts SET status = 'succeeded' WHERE export_receipt_id = $1`, [
        recorded2.receipt.exportReceiptId,
      ])
    ).rejects.toThrow(/artifact_export_receipts_success_check|violates check constraint/);
  });

  it('failExportReceipt records an explicit failure code', async () => {
    const recorded = await recordExportReceipt({
      organizationId: ORG_A,
      artifactKind: 'presentation',
      sourceRecordId: `${PREFIX}deck-export-fail`,
      sourceVersion: 1,
      sourceContentHash: canonicalSourceHash({ body: 'deck' }),
      outputFormat: 'pptx',
      providerKey: 'native:pptxgenjs',
      createdBy: USER_A,
    });
    const failed = await failExportReceipt({
      organizationId: ORG_A,
      exportReceiptId: recorded.receipt.exportReceiptId,
      failureCode: 'RENDER_TIMEOUT',
    });
    expect(failed.status).toBe('failed');
    expect(failed.failureCode).toBe('RENDER_TIMEOUT');
    expect(failed.outputContentHash).toBeNull();
  });

  it('retrying a completed export with the same idempotency key yields ONE receipt', async () => {
    const idempotencyKey = `${PREFIX}export-idem`;
    const sourceRecordId = `${PREFIX}doc-export-retry`;
    const input = {
      organizationId: ORG_A,
      artifactKind: 'document' as const,
      sourceRecordId,
      sourceVersion: 1,
      sourceContentHash: canonicalSourceHash({ body: 'retry' }),
      outputFormat: 'docx',
      providerKey: 'native:docx',
      createdBy: USER_A,
      idempotencyKey,
    };

    const first = await recordExportReceipt(input);
    await completeExportReceipt({
      organizationId: ORG_A,
      exportReceiptId: first.receipt.exportReceiptId,
      outputContentHash: 'cafebabe',
      outputByteSize: 4096,
    });

    const retry = await recordExportReceipt(input);
    expect(retry.replayed).toBe(true);
    expect(retry.receipt.exportReceiptId).toBe(first.receipt.exportReceiptId);
    // The replay reflects the CURRENT committed state, not a fresh 'pending'.
    expect(retry.receipt.status).toBe('succeeded');

    const rows = await pool.query(
      `SELECT COUNT(*)::int AS n FROM artifact_export_receipts WHERE organization_id = $1 AND idempotency_key = $2`,
      [ORG_A, idempotencyKey]
    );
    expect(rows.rows[0].n).toBe(1);
  });
});
