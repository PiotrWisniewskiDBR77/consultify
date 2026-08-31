/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';

const NO_RETRY = { retry: 0 } as const;

describe(
  'Day205 R1 organization store wisdom through real Gateway and PostgreSQL',
  NO_RETRY,
  () => {
    const organizationId = randomUUID();
    const userId = randomUUID();
    let app: Express;
    let sql: Client;
    let authorization = '';

    beforeAll(async () => {
      expect(process.env.DB_TYPE).toBe('postgres');
      expect(process.env.ENABLE_TEST_AUTH_BYPASS).toBe('false');
      await assertRealPostgresTestEnvironment();
      sql = new Client({ connectionString: String(process.env.DATABASE_URL) });
      await sql.connect();
      await sql.query(
        `INSERT INTO organizations (id,name,plan,status) VALUES ($1,'Day205 R1','enterprise','active')`,
        [organizationId]
      );
      await sql.query(
        `INSERT INTO users (id,organization_id,email,password,role,status)
       VALUES ($1,$2,$3,'unused','ADMIN','active')`,
        [userId, organizationId, `${userId}@example.test`]
      );
      await sql.query(
        `INSERT INTO organization_members (id,organization_id,user_id,role,status)
       VALUES ($1,$2,$3,'ADMIN','ACTIVE')`,
        [randomUUID(), organizationId, userId]
      );

      const [{ default: config }, { ApiGateway }] = await Promise.all([
        import('../../../config/Config.js'),
        import('../../../Gateway.js'),
      ]);
      authorization = `Bearer ${jwt.sign(
        { id: userId, userId, organizationId, role: 'ADMIN', email: `${userId}@example.test` },
        config.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '10m' }
      )}`;
      app = express();
      app.use(express.json());
      ApiGateway.getInstance().initializeRoutes(app);
    }, 60_000);

    afterAll(async () => {
      if (!sql) return;
      await sql.query(`DELETE FROM organization_context_claims WHERE organization_id=$1`, [
        organizationId,
      ]);
      await sql.query(`DELETE FROM organization_context_items WHERE organization_id=$1`, [
        organizationId,
      ]);
      await sql.query(`DELETE FROM organization_context_snapshots WHERE organization_id=$1`, [
        organizationId,
      ]);
      await sql.query(`DELETE FROM organization_context_store WHERE organization_id=$1`, [
        organizationId,
      ]);
      await sql.query(`DELETE FROM organization_members WHERE organization_id=$1`, [
        organizationId,
      ]);
      await sql.query(`DELETE FROM users WHERE id=$1`, [userId]);
      await sql.query(`DELETE FROM organizations WHERE id=$1`, [organizationId]);
      await sql.end();
    });

    it('writes three object claims and exposes their content in resolved manual context', async () => {
      const response = await request(app)
        .put('/api/organization-context-store')
        .set('Authorization', authorization)
        .send({
          goals: { ambition: 'Day205 measurable growth' },
          challenges: { blocker: 'Day205 constrained capacity' },
          synthesis: { risk: 'Day205 supplier concentration' },
        });
      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(response.body).toMatchObject({
        ok: true,
        companyProfileOwnership: 'organization_profiles',
      });
      expect(response.body.version).toEqual(expect.any(String));

      const item = await sql.query(
        `SELECT source_type FROM organization_context_items
       WHERE organization_id=$1 AND source_type='organization_context_store'`,
        [organizationId]
      );
      const claims = await sql.query<{ claim_path: string; value_json: unknown }>(
        `SELECT claim_path,value_json FROM organization_context_claims
       WHERE organization_id=$1 AND claim_path='notes.manualContext'`,
        [organizationId]
      );
      expect(item.rows).toHaveLength(1);
      expect(claims.rows).toHaveLength(3);
      expect(claims.rows.map((row) => row.claim_path)).toEqual([
        'notes.manualContext',
        'notes.manualContext',
        'notes.manualContext',
      ]);

      const { default: organizationContextService } =
        await import('../OrganizationContextService.js');
      const resolved = await organizationContextService.buildResolvedContext(organizationId);
      const json = JSON.stringify(resolved);
      expect(json).toContain('Day205 measurable growth');
      expect(json).toContain('Day205 constrained capacity');
      expect(json).toContain('Day205 supplier concentration');
    });

    it('keeps the CLOSED_FINAL response contract when the parallel claim writer fails', async () => {
      const { default: organizationContextService } =
        await import('../OrganizationContextService.js');
      const failure = vi
        .spyOn(organizationContextService, 'recordOrganizationContextStoreSave')
        .mockRejectedValueOnce(new Error('day205 injected claim failure'));
      const response = await request(app)
        .put('/api/organization-context-store')
        .set('Authorization', authorization)
        .send({ goals: { ambition: 'Day205 fail-soft save' } });
      failure.mockRestore();

      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(response.body).toMatchObject({
        ok: true,
        companyProfileOwnership: 'organization_profiles',
      });
      expect(response.body.version).toEqual(expect.any(String));
      const stored = await sql.query(
        `SELECT goals_json FROM organization_context_store WHERE organization_id=$1`,
        [organizationId]
      );
      expect(stored.rows[0]?.goals_json).toMatchObject({ ambition: 'Day205 fail-soft save' });
    });
  }
);
