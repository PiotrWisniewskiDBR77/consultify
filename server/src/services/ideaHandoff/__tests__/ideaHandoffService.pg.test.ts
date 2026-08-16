/**
 * Lane C (closure) — `ideaHandoffService.ts` acceptance evidence, against a
 * REAL local Postgres (no mocks). This is the concrete proof that the Idea →
 * Document/Presentation/Workbook handoff closes the defect documented in the
 * header of `../ideaHandoffService.ts`: `POST /my-work/my-ideas/:id/convert`
 * has no idempotency key, no content hash, no approval step, and no receipt
 * — calling it twice creates two `reports` rows. This suite proves the
 * governed replacement (propose → human approve/reject → materialize
 * exactly once) does not have that defect, for all three supported target
 * kinds (`document`, `presentation`, `workbook` — the two gaps `/convert`
 * had: `presentation` was a dead 501, `workbook` did not exist at all).
 *
 * Lives under `server/src/services/ideaHandoff/__tests__/` so the ROOT
 * `vitest.config.ts` collects it via its existing glob
 * `server/src/services/**\/__tests__/**\/*.{test,spec}.{js,ts,jsx,tsx}` —
 * same reasoning as `../../artifactHandoff/__tests__/handoffSpine.pg.test.ts`
 * (a green test no gate runs is not closure evidence).
 *
 * Every fixture id is prefixed `claude_c_<runId>-...`; `afterAll` deletes
 * every row this file created (my_ideas + the two handoff spine tables),
 * verified by a final COUNT(*) query — demo data is the product's face,
 * this suite leaves zero rows behind.
 *
 * Run (root config — no --config flag; MOCK_DB=false is required because
 * `tests/setup.ts:387` does `process.env.MOCK_DB = process.env.MOCK_DB ||
 * 'true'`, which would otherwise force the pooled DB mock under NODE_ENV=test):
 *   export DATABASE_URL="postgresql://consultinity:consultinity@127.0.0.1:55432/consultinity"
 *   export DB_TYPE=postgres CI=true MOCK_DB=false RUN_DB_TESTS=1
 *   npx vitest run server/src/services/ideaHandoff/__tests__/ideaHandoffService.pg.test.ts \
 *     --no-file-parallelism --maxWorkers=1 --retry=0
 */
import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { HandoffSpineError } from '../../artifactHandoff/handoffSpineService.js';
import {
  buildIdeaArtifactPayload,
  canonicalSourceHash,
  decideIdeaArtifact,
  getIdeaArtifactProposal,
  IDEA_ARTIFACT_TARGET_KINDS,
  IdeaHandoffError,
  materializeIdeaArtifact,
  proposeIdeaArtifact,
} from '../ideaHandoffService.js';

function requireLocalDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url || !/localhost|127\.0\.0\.1/.test(url)) {
    throw new Error(
      `ideaHandoffService.pg.test.ts requires a LOCAL DATABASE_URL (got: ${url || '(unset)'}). ` +
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

interface SeedIdeaOptions {
  organizationId?: string;
  userId?: string;
  title?: string;
  body?: string;
}

/** Seeds a minimal `my_ideas` row. No FK to `organizations` exists on this
 * table (confirmed against the live schema), so an arbitrary prefixed
 * organization id is a valid, self-contained fixture — same idiom the spine
 * suite uses for `organization_id`. */
async function seedIdea(options: SeedIdeaOptions = {}): Promise<string> {
  const id = `${PREFIX}idea-${randomUUID()}`;
  await pool.query(
    `INSERT INTO my_ideas (id, user_id, organization_id, title, body, tags)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      options.userId ?? USER_A,
      options.organizationId ?? ORG_A,
      options.title ?? 'Q3 market entry idea',
      options.body ?? 'Detailed idea body text.',
      '[]',
    ]
  );
  return id;
}

async function countFixtureRows(): Promise<{ ideas: number; proposals: number; receipts: number }> {
  const result = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM my_ideas WHERE id LIKE $1) AS ideas,
       (SELECT COUNT(*)::int FROM artifact_handoff_proposals WHERE organization_id LIKE $1) AS proposals,
       (SELECT COUNT(*)::int FROM artifact_handoff_receipts WHERE organization_id LIKE $1) AS receipts`,
    [`${PREFIX}%`]
  );
  return result.rows[0];
}

beforeAll(async () => {
  const tables = await pool.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('my_ideas', 'artifact_handoff_proposals', 'artifact_handoff_receipts')`
  );
  if (tables.rows.length !== 3) {
    throw new Error(
      `ideaHandoffService.pg.test.ts requires my_ideas + the handoff spine tables ` +
        `(server/migrations/20260912_claude_c_handoff_spine.sql). Found ${tables.rows.length}/3.`
    );
  }
});

afterAll(async () => {
  try {
    // Children (FK -> proposals, and FK -> my_ideas) before parents.
    await pool.query(`DELETE FROM artifact_handoff_receipts WHERE organization_id LIKE $1`, [`${PREFIX}%`]);
    await pool.query(`DELETE FROM artifact_handoff_proposals WHERE organization_id LIKE $1`, [`${PREFIX}%`]);
    await pool.query(`DELETE FROM my_ideas WHERE id LIKE $1`, [`${PREFIX}%`]);

    const remaining = await countFixtureRows();
    expect(remaining).toEqual({ ideas: 0, proposals: 0, receipts: 0 });
  } finally {
    await pool.end();
  }
});

describe('propose -> approve -> materialize, per target kind', () => {
  for (const targetKind of IDEA_ARTIFACT_TARGET_KINDS) {
    it(`${targetKind}: yields exactly one receipt and survives a cold reopen`, async () => {
      const ideaId = await seedIdea({ title: `Idea for ${targetKind}` });

      const proposed = await proposeIdeaArtifact({
        organizationId: ORG_A,
        ideaId,
        targetKind,
        createdBy: USER_A,
      });
      expect(proposed.replayed).toBe(false);
      expect(proposed.proposal.state).toBe('pending');
      expect(proposed.proposal.targetKind).toBe(targetKind);
      expect(proposed.proposal.producerKind).toBe('idea');
      expect(proposed.proposal.producerRecordId).toBe(ideaId);

      const decided = await decideIdeaArtifact({
        organizationId: ORG_A,
        ideaId,
        proposalId: proposed.proposal.proposalId,
        decidedBy: USER_B,
        action: 'approve',
      });
      expect(decided.state).toBe('approved');

      const materialized = await materializeIdeaArtifact({
        organizationId: ORG_A,
        ideaId,
        proposalId: proposed.proposal.proposalId,
        materializedBy: USER_B,
      });
      expect(materialized.replayed).toBe(false);
      expect(materialized.receipt.targetKind).toBe(targetKind);
      expect(materialized.receipt.targetRecordId).toBe(`idea-artifact:${proposed.proposal.proposalId}`);

      const receiptCountRow = await pool.query(
        `SELECT COUNT(*)::int AS n FROM artifact_handoff_receipts WHERE proposal_id = $1`,
        [proposed.proposal.proposalId]
      );
      expect(receiptCountRow.rows[0].n).toBe(1);

      // Cold reopen: independent read, not the JS objects returned above.
      const reopened1 = await getIdeaArtifactProposal(ORG_A, ideaId, proposed.proposal.proposalId);
      const reopened2 = await getIdeaArtifactProposal(ORG_A, ideaId, proposed.proposal.proposalId);
      expect(reopened1.proposal.sourceContentHash).toBe(proposed.proposal.sourceContentHash);
      expect(reopened2.proposal.sourceContentHash).toBe(proposed.proposal.sourceContentHash);
      expect(reopened1.receipt?.targetRecordId).toBe(materialized.receipt.targetRecordId);
      expect(reopened2.receipt?.targetRecordId).toBe(materialized.receipt.targetRecordId);
      expect(reopened1.receipt?.targetRecordId).toBe(reopened2.receipt?.targetRecordId);
    });
  }
});

describe('the concrete duplicate-conversion fix', () => {
  it('the SAME idempotency key called twice yields ONE proposal, not two', async () => {
    const ideaId = await seedIdea({ title: 'Double-click protection idea' });
    const idempotencyKey = `${PREFIX}convert-idem-1`;

    const first = await proposeIdeaArtifact({
      organizationId: ORG_A,
      ideaId,
      targetKind: 'document',
      createdBy: USER_A,
      idempotencyKey,
    });
    const second = await proposeIdeaArtifact({
      organizationId: ORG_A,
      ideaId,
      targetKind: 'document',
      createdBy: USER_A,
      idempotencyKey,
    });

    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(second.proposal.proposalId).toBe(first.proposal.proposalId);

    const rows = await pool.query(
      `SELECT COUNT(*)::int AS n FROM artifact_handoff_proposals WHERE organization_id = $1 AND idempotency_key = $2`,
      [ORG_A, idempotencyKey]
    );
    expect(rows.rows[0].n).toBe(1);
  });

  it('two CONCURRENT calls with the same idempotency key also yield ONE proposal', async () => {
    const ideaId = await seedIdea({ title: 'Concurrent double-click idea' });
    const idempotencyKey = `${PREFIX}convert-idem-concurrent`;
    const makeCall = () =>
      proposeIdeaArtifact({
        organizationId: ORG_A,
        ideaId,
        targetKind: 'workbook',
        createdBy: USER_A,
        idempotencyKey,
      });

    const [r1, r2] = await Promise.all([makeCall(), makeCall()]);
    expect(r1.proposal.proposalId).toBe(r2.proposal.proposalId);
    const replayedCount = [r1.replayed, r2.replayed].filter(Boolean).length;
    expect(replayedCount).toBe(1);

    const rows = await pool.query(
      `SELECT COUNT(*)::int AS n FROM artifact_handoff_proposals WHERE organization_id = $1 AND idempotency_key = $2`,
      [ORG_A, idempotencyKey]
    );
    expect(rows.rows[0].n).toBe(1);
  });
});

describe('two CONCURRENT approvals converge to one decision and one receipt', () => {
  it('converges decidedBy, then a single materialize produces exactly one receipt', async () => {
    const ideaId = await seedIdea({ title: 'Concurrent approval idea' });
    const proposed = await proposeIdeaArtifact({
      organizationId: ORG_A,
      ideaId,
      targetKind: 'presentation',
      createdBy: USER_A,
    });

    const [a1, a2] = await Promise.all([
      decideIdeaArtifact({
        organizationId: ORG_A,
        ideaId,
        proposalId: proposed.proposal.proposalId,
        decidedBy: USER_A,
        action: 'approve',
      }),
      decideIdeaArtifact({
        organizationId: ORG_A,
        ideaId,
        proposalId: proposed.proposal.proposalId,
        decidedBy: USER_B,
        action: 'approve',
      }),
    ]);
    expect(a1.state).toBe('approved');
    expect(a2.state).toBe('approved');
    expect(a1.decidedBy).toBe(a2.decidedBy);

    const [m1, m2] = await Promise.all([
      materializeIdeaArtifact({
        organizationId: ORG_A,
        ideaId,
        proposalId: proposed.proposal.proposalId,
        materializedBy: USER_A,
      }),
      materializeIdeaArtifact({
        organizationId: ORG_A,
        ideaId,
        proposalId: proposed.proposal.proposalId,
        materializedBy: USER_B,
      }),
    ]);
    expect(m1.receipt.receiptId).toBe(m2.receipt.receiptId);
    const replayedCount = [m1.replayed, m2.replayed].filter(Boolean).length;
    expect(replayedCount).toBe(1);

    const rows = await pool.query(
      `SELECT COUNT(*)::int AS n FROM artifact_handoff_receipts WHERE proposal_id = $1`,
      [proposed.proposal.proposalId]
    );
    expect(rows.rows[0].n).toBe(1);
  });
});

describe('human approval is a hard requirement', () => {
  it('approve requires a human actor id, not the system sentinel', async () => {
    const ideaId = await seedIdea({ title: 'System-actor guard idea' });
    const proposed = await proposeIdeaArtifact({
      organizationId: ORG_A,
      ideaId,
      targetKind: 'document',
      createdBy: USER_A,
    });

    await expect(
      decideIdeaArtifact({
        organizationId: ORG_A,
        ideaId,
        proposalId: proposed.proposal.proposalId,
        decidedBy: 'system',
        action: 'approve',
      })
    ).rejects.toThrow(/human actor/);

    const row = await pool.query(
      `SELECT state FROM artifact_handoff_proposals WHERE proposal_id = $1`,
      [proposed.proposal.proposalId]
    );
    expect(row.rows[0].state).toBe('pending');
  });

  it('reject then approve is refused; materializing an unapproved proposal is refused', async () => {
    const ideaId = await seedIdea({ title: 'Reject-then-approve idea' });
    const proposed = await proposeIdeaArtifact({
      organizationId: ORG_A,
      ideaId,
      targetKind: 'document',
      createdBy: USER_A,
    });

    await decideIdeaArtifact({
      organizationId: ORG_A,
      ideaId,
      proposalId: proposed.proposal.proposalId,
      decidedBy: USER_A,
      action: 'reject',
      reason: 'not needed',
    });

    await expect(
      decideIdeaArtifact({
        organizationId: ORG_A,
        ideaId,
        proposalId: proposed.proposal.proposalId,
        decidedBy: USER_B,
        action: 'approve',
      })
    ).rejects.toThrow(/cannot approve/);

    await expect(
      materializeIdeaArtifact({
        organizationId: ORG_A,
        ideaId,
        proposalId: proposed.proposal.proposalId,
        materializedBy: USER_B,
      })
    ).rejects.toThrow(/must be 'approved'/);

    const receiptRows = await pool.query(
      `SELECT COUNT(*)::int AS n FROM artifact_handoff_receipts WHERE proposal_id = $1`,
      [proposed.proposal.proposalId]
    );
    expect(receiptRows.rows[0].n).toBe(0);
  });
});

describe('cross-tenant isolation', () => {
  it('propose against a foreign-org idea is refused', async () => {
    const ideaId = await seedIdea({ organizationId: ORG_A, title: 'Org A only idea' });

    await expect(
      proposeIdeaArtifact({
        organizationId: ORG_B,
        ideaId,
        targetKind: 'document',
        createdBy: USER_B,
      })
    ).rejects.toThrow(IdeaHandoffError);
  });

  it('decide/materialize/read from org B against org A proposal are all refused', async () => {
    const ideaId = await seedIdea({ organizationId: ORG_A, title: 'Tenant isolation idea' });
    const proposed = await proposeIdeaArtifact({
      organizationId: ORG_A,
      ideaId,
      targetKind: 'document',
      createdBy: USER_A,
    });

    await expect(
      decideIdeaArtifact({
        organizationId: ORG_B,
        ideaId,
        proposalId: proposed.proposal.proposalId,
        decidedBy: USER_B,
        action: 'approve',
      })
    ).rejects.toThrow(/not found/);

    await expect(
      getIdeaArtifactProposal(ORG_B, ideaId, proposed.proposal.proposalId)
    ).rejects.toThrow(/not found/);

    // Real approval, from the owning org — then org B still cannot materialize.
    await decideIdeaArtifact({
      organizationId: ORG_A,
      ideaId,
      proposalId: proposed.proposal.proposalId,
      decidedBy: USER_A,
      action: 'approve',
    });

    await expect(
      materializeIdeaArtifact({
        organizationId: ORG_B,
        ideaId,
        proposalId: proposed.proposal.proposalId,
        materializedBy: USER_B,
      })
    ).rejects.toThrow(/not found/);

    const row = await pool.query(
      `SELECT state, organization_id FROM artifact_handoff_proposals WHERE proposal_id = $1`,
      [proposed.proposal.proposalId]
    );
    expect(row.rows[0].organization_id).toBe(ORG_A);
    expect(row.rows[0].state).toBe('approved');
  });
});

describe('pinned content hash survives an edit made after approval', () => {
  it('editing the idea after approval does not change the approved proposal source_content_hash', async () => {
    const ideaId = await seedIdea({ title: 'Original title before approval' });
    const proposed = await proposeIdeaArtifact({
      organizationId: ORG_A,
      ideaId,
      targetKind: 'document',
      createdBy: USER_A,
    });
    const originalHash = proposed.proposal.sourceContentHash;

    await decideIdeaArtifact({
      organizationId: ORG_A,
      ideaId,
      proposalId: proposed.proposal.proposalId,
      decidedBy: USER_A,
      action: 'approve',
    });

    // Edit the idea AFTER approval — the bytes a human already signed off on
    // must not silently move underneath them.
    await pool.query(`UPDATE my_ideas SET title = $1, body = $2 WHERE id = $3`, [
      'Title changed after approval',
      'Body changed after approval too.',
      ideaId,
    ]);

    const reopened = await getIdeaArtifactProposal(ORG_A, ideaId, proposed.proposal.proposalId);
    expect(reopened.proposal.sourceContentHash).toBe(originalHash);
    expect(reopened.proposal.state).toBe('approved');

    // A NEW proposal against the edited idea pins a DIFFERENT hash — proving
    // the invariant is "the approved proposal is frozen", not "hashing is
    // broken and always returns the same value".
    const proposedAgain = await proposeIdeaArtifact({
      organizationId: ORG_A,
      ideaId,
      targetKind: 'document',
      createdBy: USER_A,
    });
    expect(proposedAgain.proposal.sourceContentHash).not.toBe(originalHash);
    expect(proposedAgain.proposal.sourceVersion).toBe(2);
  });
});

describe('buildIdeaArtifactPayload / canonicalSourceHash', () => {
  it('the hash pinned at propose time equals canonicalSourceHash of the built payload', async () => {
    const ideaId = await seedIdea({ title: 'Payload hash cross-check idea', body: 'Body xyz' });
    const ideaRow = await pool.query(
      `SELECT id, organization_id, user_id, title, body, tags, stage, potential, complexity, area,
              ai_expansion, summary_data, action_contract_json, source_pack_json, evidence_refs_json
         FROM my_ideas WHERE id = $1`,
      [ideaId]
    );
    const payload = buildIdeaArtifactPayload(ideaRow.rows[0] as any);
    const expectedHash = canonicalSourceHash(payload);

    const proposed = await proposeIdeaArtifact({
      organizationId: ORG_A,
      ideaId,
      targetKind: 'document',
      createdBy: USER_A,
    });
    expect(proposed.proposal.sourceContentHash).toBe(expectedHash);
  });
});
