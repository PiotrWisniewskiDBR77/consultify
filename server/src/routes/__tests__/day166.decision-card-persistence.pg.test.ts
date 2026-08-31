/** @vitest-environment node */

import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../config/Config.js';
import { ApiGateway } from '../../Gateway.js';

const NO_RETRY = { retry: 0 } as const;
const ARTIFACT = '/private/tmp/cx-day166-karta-decyzji-artefakty/day166-http-db-evidence.json';

describe(
  'Day 166 decision-card persistence through real ApiGateway and PostgreSQL',
  NO_RETRY,
  () => {
    const organizationId = randomUUID();
    const userId = randomUUID();
    const stakeholderUserId = randomUUID();
    const decisionId = randomUUID();
    const evidence: unknown[] = [];
    let app: Express;
    let sql: Client;
    let authorization: string;

    beforeAll(async () => {
      process.env.DB_TYPE = 'postgres';
      expect(process.env.DB_TYPE).toBe('postgres');
      await assertRealPostgresTestEnvironment();
      sql = new Client({ connectionString: String(process.env.DATABASE_URL) });
      await sql.connect();
      await sql.query(
        `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1, 'Day 166', 'enterprise', 'active', 1, now())`,
        [organizationId]
      );
      for (const [id, email, firstName] of [
        [userId, 'owner-day166@example.test', 'Owner'],
        [stakeholderUserId, 'stakeholder-day166@example.test', 'Stakeholder'],
      ]) {
        await sql.query(
          `INSERT INTO users
           (id, organization_id, email, password, first_name, last_name, role, status, created_at)
         VALUES ($1, $2, $3, 'x', $4, 'Day166', 'ADMIN', 'active', now())`,
          [id, organizationId, email, firstName]
        );
      }
      await sql.query(
        `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
       VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE', now())`,
        [randomUUID(), organizationId, userId]
      );
      await sql.query(
        `INSERT INTO decisions (id, organization_id, title, created_by, decision_maker_id, status)
       VALUES ($1, $2, 'Day 166 persistence', $3, $3, 'pending')`,
        [decisionId, organizationId, userId]
      );
      authorization = `Bearer ${jwt.sign(
        { id: userId, userId, email: 'owner-day166@example.test', organizationId, role: 'ADMIN' },
        config.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '1h' }
      )}`;
      app = express();
      app.use(express.json());
      ApiGateway.getInstance().initializeRoutes(app);
    });

    afterAll(async () => {
      writeFileSync(ARTIFACT, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
      if (!sql) return;
      await sql.query('DELETE FROM decision_risks WHERE decision_id = $1', [decisionId]);
      await sql.query('DELETE FROM decision_stakeholders WHERE decision_id = $1', [decisionId]);
      await sql.query('DELETE FROM decisions WHERE id = $1', [decisionId]);
      await sql.query('DELETE FROM organization_members WHERE organization_id = $1', [
        organizationId,
      ]);
      await sql.query('DELETE FROM users WHERE organization_id = $1', [organizationId]);
      await sql.query('DELETE FROM organizations WHERE id = $1', [organizationId]);
      await sql.end();
    });

    it('persists risk category and contingency and reads them from the detail aggregate', async () => {
      const create = await request(app)
        .post(`/api/decisions/${decisionId}/risks`)
        .set('Authorization', authorization)
        .send({
          description: 'Supplier outage',
          severity: 'HIGH',
          likelihood: 'MEDIUM',
          category: 'operational',
          contingency: 'Switch to the secondary supplier',
        });
      expect(create.status, JSON.stringify(create.body)).toBe(201);
      const direct = await sql.query(
        'SELECT category, contingency FROM decision_risks WHERE id = $1',
        [create.body.id]
      );
      const detail = await request(app)
        .get(`/api/decisions/${decisionId}/detail`)
        .set('Authorization', authorization);
      expect(detail.status, JSON.stringify(detail.body)).toBe(200);
      expect(detail.body.dossierRisks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: 'operational',
            contingency: 'Switch to the secondary supplier',
          }),
        ])
      );
      evidence.push({ create: create.body, direct: direct.rows, detail: detail.body.dossierRisks });
    });

    it('replaces and then reads RACI stakeholders from PostgreSQL', async () => {
      const replace = await request(app)
        .put(`/api/decisions/${decisionId}/stakeholders`)
        .set('Authorization', authorization)
        .send({ stakeholders: [{ userId: stakeholderUserId, role: 'accountable' }] });
      expect(replace.status, JSON.stringify(replace.body)).toBe(200);
      const direct = await sql.query(
        'SELECT user_id, role FROM decision_stakeholders WHERE decision_id = $1',
        [decisionId]
      );
      const read = await request(app)
        .get(`/api/decisions/${decisionId}/stakeholders`)
        .set('Authorization', authorization);
      expect(read.status, JSON.stringify(read.body)).toBe(200);
      expect(read.body.stakeholders).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ userId: stakeholderUserId, role: 'accountable' }),
        ])
      );
      evidence.push({ replace: replace.body, direct: direct.rows, read: read.body });
    });
  }
);
