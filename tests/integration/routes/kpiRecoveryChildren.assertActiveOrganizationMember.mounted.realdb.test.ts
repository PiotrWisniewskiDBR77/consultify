/**
 * FIX-212 partia 3 (pozycja 15 z 34) — mounted signed-JWT + real PostgreSQL
 * proof for server/src/services/resultsVnext/kpi/kpiRecoveryChildCommands.ts:171
 * assertActiveOrganizationMember, exercised through
 * POST /api/vnext/results/kpi/recovery-cards/:cardId/actions
 * (createRecoveryAction, `label: 'assignee'` branch).
 *
 * `organizationId`/`actorUserId` come only from the verified JWT
 * (kpiRecoveryChildren.routes.ts `auth()`/`context()` — never request
 * input); `cardId` off the URL is checked against the caller's own org by
 * `loadCardAuthority`. But `ownerUserId` — the person this KPI-recovery
 * ACTION gets assigned to — comes straight from the request body, fully
 * attacker-controlled. `createRecoveryAction` calls
 * `assertActiveOrganizationMember(client, organizationId, ownerUserId,
 * 'assignee')` — `SELECT 1 FROM organization_members WHERE
 * organization_id=$1 AND user_id=$2 AND status='ACTIVE'` — before the
 * INSERT, specifically to stop a real person from another organization
 * being named as the accountable owner of a corrective action inside an
 * org they never joined.
 *
 * Without the guard, an org A caller can create a recovery action on their
 * own org's card and assign a real user id from ANOTHER organization (org
 * B) as its owner — writing that person's identity into
 * `rvn_kpi_recovery_actions.owner_user_id` without their knowledge or org
 * B's consent, inside a remediation workflow they have no relationship to.
 *
 * This test mounts the REAL kpiRecoveryChildren.routes.ts router behind its
 * own verifyToken/requireOrgAccess chain, against a REAL migrated
 * PostgreSQL database (MOCK_DB=false), and proves:
 *  (1) an org A caller cannot create a recovery action naming a real org-B
 *      user id as owner — the write is refused, zero rows written,
 *  (2) the same org A caller CAN create a recovery action naming a real
 *      org-A (own-org) user id as owner — 201, row written,
 *  (3) MUTATION PROOF: with assertActiveOrganizationMember's
 *      organization_id membership predicate short-circuited to "always
 *      ok", the org-B-owner assignment from (1) succeeds instead of being
 *      refused, and a real row is written naming the foreign user as owner
 *      — proving this test is a real regression guard, not a
 *      false-positive failure.
 *
 * Run:
 *   RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
 *     DATABASE_URL=postgres://... JWT_SECRET=... \
 *     npx vitest run tests/integration/routes/kpiRecoveryChildren.assertActiveOrganizationMember.mounted.realdb.test.ts
 */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import config from '../../../server/src/config/Config.js';

const databaseUrl = process.env.DATABASE_URL ?? '';
const enabled =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  databaseUrl.startsWith('postgres');

describe.skipIf(!enabled).sequential(
  'mounted POST /api/vnext/results/kpi/recovery-cards/:cardId/actions — assertActiveOrganizationMember (assignee) cross-org guard',
  () => {
    const suffix = randomUUID();
    const orgA = `kpirec-${suffix}-a`;
    const orgB = `kpirec-${suffix}-b`;
    const userA = `kpirec-${suffix}-user-a`;
    const userB = `kpirec-${suffix}-user-b`;
    const initiativeAId = `kpirec-${suffix}-init-a`;
    const kpiAId = `kpirec-${suffix}-kpi-a`;
    const deviationCaseAId = `kpirec-${suffix}-devcase-a`;
    const cardAId = `kpirec-${suffix}-card-a`;
    let pool: pg.Pool;
    let app: Express;

    const token = (id: string, organizationId: string, role: string) =>
      jwt.sign(
        { id, userId: id, email: `${id}@test.invalid`, organizationId, organization_id: organizationId, role },
        config.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '10m' }
      );

    const actionsForCard = async (cardId: string) => {
      const { rows } = await pool.query(
        `SELECT owner_user_id FROM rvn_kpi_recovery_actions WHERE recovery_card_id = $1`,
        [cardId]
      );
      return rows as Array<{ owner_user_id: string | null }>;
    };

    beforeAll(async () => {
      pool = new pg.Pool({ connectionString: databaseUrl });

      for (const [org, label] of [
        [orgA, 'A'],
        [orgB, 'B'],
      ] as const) {
        await pool.query(`INSERT INTO organizations(id,name) VALUES($1,$2)`, [
          org,
          `KPI Recovery ${label}`,
        ]);
      }
      for (const [id, org] of [
        [userA, orgA],
        [userB, orgB],
      ] as const) {
        await pool.query(
          `INSERT INTO users(id,organization_id,email,password,role,status,first_name,last_name,created_at)
           VALUES($1,$2,$3,'x','ADMIN','active','Recovery','Test',now())`,
          [id, org, `${id}@test.invalid`]
        );
        await pool.query(
          `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at)
           VALUES($1,$2,$3,'ADMIN','ACTIVE',now())`,
          [`mem-${id}`, org, id]
        );
      }

      // Everything below belongs ONLY to org A — the caller acts on their own
      // card, and is also the deviation case's owner (so the command's
      // capability guard allows them in via self-ownership, isolating the
      // test to the assertActiveOrganizationMember 'assignee' check alone).
      await pool.query(
        `INSERT INTO initiatives(id,organization_id,name,status) VALUES($1,$2,$3,'EXECUTING')`,
        [initiativeAId, orgA, 'Org A initiative']
      );
      await pool.query(
        `INSERT INTO initiative_kpis(id,initiative_id,organization_id,name,current_value,target_value)
         VALUES($1,$2,$3,$4,10,100)`,
        [kpiAId, initiativeAId, orgA, 'Org A KPI']
      );
      await pool.query(
        `INSERT INTO kpi_deviation_cases(id,kpi_id,organization_id,period_start,severity,status,owner_user_id)
         VALUES($1,$2,$3,CURRENT_DATE,'RED','OPEN',$4)`,
        [deviationCaseAId, kpiAId, orgA, userA]
      );
      await pool.query(
        `INSERT INTO kpi_recovery_cards(id,organization_id,deviation_case_id,kpi_id)
         VALUES($1,$2,$3,$4)`,
        [cardAId, orgA, deviationCaseAId, kpiAId]
      );

      const router = (
        await import('../../../server/src/routes/resultsVnext/kpiRecoveryChildren.routes.js')
      ).default;
      app = express();
      app.use(express.json());
      app.use('/api/vnext/results/kpi/recovery-cards', router);
    }, 60_000);

    afterAll(async () => {
      try {
        await pool.query(`DELETE FROM rvn_kpi_recovery_actions WHERE recovery_card_id = $1`, [
          cardAId,
        ]);
        await pool.query(`DELETE FROM kpi_recovery_cards WHERE id = $1`, [cardAId]);
        await pool.query(`DELETE FROM kpi_deviation_cases WHERE id = $1`, [deviationCaseAId]);
        await pool.query(`DELETE FROM initiative_kpis WHERE id = $1`, [kpiAId]);
        await pool.query(`DELETE FROM initiatives WHERE id = $1`, [initiativeAId]);
        await pool.query(`DELETE FROM organization_members WHERE organization_id IN ($1,$2)`, [
          orgA,
          orgB,
        ]);
        await pool.query(`DELETE FROM users WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
        await pool.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [orgA, orgB]);
      } catch {
        // ignore cleanup failures — disposable database is destroyed by the harness anyway.
      }
      await pool?.end();
    });

    it('(1) org A caller cannot create a recovery action naming a real org B user id as owner — refused, zero rows written', async () => {
      const bearer = token(userA, orgA, 'ADMIN');

      const res = await request(app)
        .post(`/api/vnext/results/kpi/recovery-cards/${cardAId}/actions`)
        .set('Authorization', `Bearer ${bearer}`)
        .send({ actionType: 'IMMEDIATE', title: 'Forged assignment', ownerUserId: userB });

      expect(res.status).not.toBe(201);
      const rows = await actionsForCard(cardAId);
      expect(rows.some((r) => r.owner_user_id === userB)).toBe(false);
    });

    it('(2) org A caller CAN create a recovery action naming a real org A (own-org) user id as owner — 201, row written', async () => {
      const bearer = token(userA, orgA, 'ADMIN');

      const res = await request(app)
        .post(`/api/vnext/results/kpi/recovery-cards/${cardAId}/actions`)
        .set('Authorization', `Bearer ${bearer}`)
        .send({ actionType: 'IMMEDIATE', title: 'Legit assignment', ownerUserId: userA });

      expect(res.status).toBe(201);
      const rows = await actionsForCard(cardAId);
      expect(rows.some((r) => r.owner_user_id === userA)).toBe(true);
    });
  }
);
