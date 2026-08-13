#!/usr/bin/env node
/**
 * RN-G6-A2 — illustrative gate-blocking dataset (NOT a copy of real demo data).
 *
 * Purpose: give a concrete, countable shape to the "initiative lifecycle gate
 * divergence" finding from RN_G6_A2_INITIATIVE_GATE_DIVERGENCE.md, on a
 * throwaway local Postgres. Numbers here are INVENTED to be plausible and
 * readable, not sampled from any real customer environment. Do not quote
 * these counts as "how many real customers are affected".
 *
 * Refuses to run unless DATABASE_URL is localhost/127.0.0.1.
 *
 * Usage:
 *   DATABASE_URL=postgresql://postgres@127.0.0.1:55911/rn_a2s_gate_scale \
 *   node scripts/rn-g6-a2-seed-gate-dataset.mjs
 */
import bcrypt from 'bcryptjs';
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL || !/localhost|127\.0\.0\.1/.test(DATABASE_URL)) {
  console.error(`[seed] REFUSING: DATABASE_URL must be LOCAL. Got: ${DATABASE_URL || '(unset)'}`);
  process.exit(2);
}

const ORG_ID = 'rn-g6-a2-org-0001';
const USER_ID = 'rn-g6-a2-user-0001';
const PROJECT_ID = 'rn-g6-a2-project-0001';
const EMAIL = 'rn-g6-a2-owner@acceptance.local';
const PASSWORD = 'RnG6A2Harness!2026';

// Gate-blocking status -> pmo_domain gate it needs to LEAVE that status.
const GATE_DOMAIN_BY_STATUS = {
  REVIEW: 'GOVERNANCE_DECISION_MAKING', // REVIEW -> PROMOTED
  PROMOTED: 'RESOURCE_RESPONSIBILITY', // PROMOTED -> PLANNING
  APPROVED: 'SCHEDULE_MILESTONES', // APPROVED -> SCHEDULED
  SCHEDULED: 'GOVERNANCE_DECISION_MAKING', // SCHEDULED -> EXECUTING (per H16 test)
  BLOCKED: 'GOVERNANCE_DECISION_MAKING', // BLOCKED -> EXECUTING (unblock)
  EXECUTING: 'CLOSURE', // EXECUTING -> DONE
};

// (status, count, howManyOfThoseGetAnApprovedOldTableDecision)
const PLAN = [
  ['DRAFT', 5, 0],
  ['PENDING_REVIEW', 2, 0],
  ['REVIEW', 4, 3],
  ['PROMOTED', 3, 2],
  ['PLANNING', 2, 0],
  ['APPROVED', 4, 3],
  ['SCHEDULED', 4, 3],
  ['BLOCKED', 2, 1],
  ['EXECUTING', 3, 2],
  ['DONE', 3, 0],
  ['CANCELLED', 1, 0],
  ['ARCHIVED', 1, 0],
];

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const now = new Date().toISOString();
    const passwordHash = bcrypt.hashSync(PASSWORD, 10);

    await client.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1, $2, 'enterprise', 'active', 1, $3)
       ON CONFLICT (id) DO NOTHING`,
      [ORG_ID, 'RN-G6-A2 Illustrative Org', now]
    );

    await client.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1, $2, $3, $4, 'ADMIN', 'active', 'RnG6A2', 'Owner', $5)
       ON CONFLICT (id) DO NOTHING`,
      [USER_ID, ORG_ID, EMAIL, passwordHash, now]
    );

    await client.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
       SELECT $5, $1, $2, 'OWNER', $4, $3
       WHERE NOT EXISTS (
         SELECT 1 FROM organization_members WHERE organization_id = $1 AND user_id = $2
       )`,
      [ORG_ID, USER_ID, now, 'ACTIVE', 'rn-g6-a2-mem-0001']
    );

    await client.query(
      `INSERT INTO projects (id, organization_id, name, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO NOTHING`,
      [PROJECT_ID, ORG_ID, 'RN-G6-A2 illustrative project']
    );

    let seq = 0;
    let totalInitiatives = 0;
    let totalWithApprovedOldDecision = 0;
    const created = [];

    for (const [status, count, withDecision] of PLAN) {
      for (let i = 0; i < count; i++) {
        seq += 1;
        const id = `rn-g6-a2--init-${String(seq).padStart(3, '0')}--${status.toLowerCase()}`;
        await client.query(
          `INSERT INTO initiatives
             (id, organization_id, project_id, name, title, status, owner_execution_id,
              planned_start_date, planned_end_date, created_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $4, $5, $6, $7, $8, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
          [
            id,
            ORG_ID,
            PROJECT_ID,
            `RN-G6-A2 illustrative initiative ${seq} (${status})`,
            status,
            USER_ID,
            status === 'SCHEDULED' || status === 'EXECUTING' ? '2026-09-01' : null,
            status === 'SCHEDULED' || status === 'EXECUTING' ? '2026-12-01' : null,
          ]
        );
        totalInitiatives += 1;
        created.push({ id, status });

        if (i < withDecision) {
          const domain = GATE_DOMAIN_BY_STATUS[status];
          const decisionId = `rn-g6-a2--decision-${String(seq).padStart(3, '0')}`;
          await client.query(
            `INSERT INTO decisions
               (id, organization_id, initiative_id, title, type, decision_maker_id, deadline,
                status, pmo_domain, created_by, created_at)
             VALUES ($1, $2, $3, $4, 'GO_NO_GO', $5, $6, 'approved', $7, $5, CURRENT_TIMESTAMP)
             ON CONFLICT (id) DO UPDATE SET status = 'approved'`,
            [
              decisionId,
              ORG_ID,
              id,
              `RN-G6-A2 illustrative decision for ${id}`,
              USER_ID,
              '2026-08-15T00:00:00.000Z',
              domain,
            ]
          );
          totalWithApprovedOldDecision += 1;
        }
      }
    }

    console.log('[seed] org', ORG_ID, 'project', PROJECT_ID, 'user', USER_ID);
    console.log('[seed] total initiatives created:', totalInitiatives);
    console.log(
      '[seed] initiatives in gate-blocking statuses with an APPROVED old-table decision:',
      totalWithApprovedOldDecision
    );
    console.log('[seed] done.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
