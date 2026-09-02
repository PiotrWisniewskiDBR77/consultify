/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../config/Config.js';
import { ApiGateway } from '../../Gateway.js';

const databaseUrl = process.env.DATABASE_URL ?? '';

describe(
  'Day 276 workbook cell persistence through ApiGateway and real PostgreSQL',
  { retry: 0 },
  () => {
    const suffix = randomUUID().slice(0, 8);
    const ownerOrgId = `day276_wb_org_${suffix}`;
    const foreignOrgId = `day276_wb_foreign_org_${suffix}`;
    const ownerId = `day276_wb_owner_${suffix}`;
    const foreignId = `day276_wb_foreign_${suffix}`;
    const workbookId = `day276_wb_${suffix}`;
    const pool = new Pool({ connectionString: databaseUrl });
    const app = express();
    let ownerToken = '';
    let foreignToken = '';

    const schema = {
      title: 'Day 276',
      sheets: [
        {
          id: randomUUID(),
          name: 'Plan',
          columns: [
            { key: 'metric', header: 'Metric' },
            { key: 'value', header: 'Value' },
          ],
          rows: [{ cells: { metric: { value: 'Revenue' }, value: { value: 10 } } }],
        },
      ],
    };

    beforeAll(async () => {
      expect(process.env.DB_TYPE).toBe('postgres');
      await assertRealPostgresTestEnvironment();
      app.use(express.json());
      ApiGateway.getInstance().initializeRoutes(app);
      for (const [orgId, userId, label] of [
        [ownerOrgId, ownerId, 'owner'],
        [foreignOrgId, foreignId, 'foreign'],
      ]) {
        await pool.query('INSERT INTO organizations (id, name) VALUES ($1, $2)', [
          orgId,
          `Day 276 ${label}`,
        ]);
        await pool.query(
          `INSERT INTO users (id, organization_id, email, role, status, is_active)
         VALUES ($1, $2, $3, 'OWNER', 'active', 1)`,
          [userId, orgId, `${userId}@example.test`]
        );
        await pool.query(
          `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1, $2, $3, 'OWNER', 'ACTIVE')`,
          [`member_${userId}`, orgId, userId]
        );
      }
      await pool.query(
        `INSERT INTO generated_workbooks
       (id, organization_id, title, schema_json, sheet_count, created_by, version)
       VALUES ($1, $2, 'Day 276 workbook', $3, 1, $4, 0)`,
        [workbookId, ownerOrgId, JSON.stringify(schema), ownerId]
      );
      ownerToken = jwt.sign(
        {
          id: ownerId,
          userId: ownerId,
          organizationId: ownerOrgId,
          organization_id: ownerOrgId,
          role: 'OWNER',
        },
        config.JWT_SECRET
      );
      foreignToken = jwt.sign(
        {
          id: foreignId,
          userId: foreignId,
          organizationId: foreignOrgId,
          organization_id: foreignOrgId,
          role: 'OWNER',
        },
        config.JWT_SECRET
      );
    });

    afterAll(async () => {
      await pool.query('DELETE FROM generated_workbook_revisions WHERE workbook_id = $1', [
        workbookId,
      ]);
      await pool.query('DELETE FROM generated_workbooks WHERE id = $1', [workbookId]);
      await pool.query('DELETE FROM organization_members WHERE organization_id = ANY($1)', [
        [ownerOrgId, foreignOrgId],
      ]);
      await pool.query('DELETE FROM users WHERE id = ANY($1)', [[ownerId, foreignId]]);
      await pool.query('DELETE FROM organizations WHERE id = ANY($1)', [
        [ownerOrgId, foreignOrgId],
      ]);
      await pool.end();
    });

    const command = (value: number, idempotencyKey: string) => ({
      commandId: 'xlsx.cell.edit',
      baseVersion: 0,
      idempotencyKey,
      operations: [{ type: 'setCell', sheetIndex: 0, rowIndex: 0, columnKey: 'value', value }],
    });

    it('owner persists a setCell value, advances version and creates a revision row', async () => {
      const response = await request(app)
        .post(`/api/workbook/${workbookId}/commands`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(command(99, `owner-${suffix}`));
      expect(response.status).toBe(200);

      const persisted = await pool.query(
        'SELECT schema_json, version FROM generated_workbooks WHERE id = $1 AND organization_id = $2',
        [workbookId, ownerOrgId]
      );
      expect(JSON.parse(persisted.rows[0].schema_json).sheets[0].rows[0].cells.value.value).toBe(
        99
      );
      expect(persisted.rows[0].version).toBe(1);
      const revisions = await pool.query(
        'SELECT count(*)::int AS count FROM generated_workbook_revisions WHERE workbook_id = $1 AND organization_id = $2',
        [workbookId, ownerOrgId]
      );
      expect(revisions.rows[0].count).toBe(1);
    });

    it('foreign tenant cannot see or mutate the workbook', async () => {
      const before = await pool.query(
        'SELECT schema_json, version FROM generated_workbooks WHERE id = $1',
        [workbookId]
      );
      const attack = await request(app)
        .post(`/api/workbook/${workbookId}/commands`)
        .set('Authorization', `Bearer ${foreignToken}`)
        .send({ ...command(777, `foreign-${suffix}`), baseVersion: 1 });
      expect([403, 404]).toContain(attack.status);
      const after = await pool.query(
        'SELECT schema_json, version FROM generated_workbooks WHERE id = $1',
        [workbookId]
      );
      expect(after.rows[0]).toEqual(before.rows[0]);
    });
  }
);
