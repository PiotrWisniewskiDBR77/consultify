/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ApiGateway } from '../../../server/src/Gateway.js';
import config from '../../../server/src/config/Config.js';

const databaseUrl = process.env.DATABASE_URL ?? '';
const enabled = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false';
const NO_RETRY = { retry: 0 } as const;

describe.skipIf(!enabled)('day46 B.1 — KPI business name in the registry list', NO_RETRY, () => {
  const prefix = `day46-b1-${randomUUID()}`;
  const orgA = `${prefix}-org-a`;
  const orgB = `${prefix}-org-b`;
  const ownerA = `${prefix}-owner-a`;
  const ownerB = `${prefix}-owner-b`;
  const namedKpi = randomUUID();
  const draftKpi = randomUUID();
  const foreignKpi = randomUUID();
  const namedVersion = randomUUID();
  const foreignVersion = randomUUID();
  const pool = new Pool({ connectionString: databaseUrl });
  const app = express();

  app.use(express.json());
  ApiGateway.getInstance().initializeRoutes(app);

  const token = (userId: string, organizationId: string) =>
    jwt.sign(
      { id: userId, userId, organizationId, organization_id: organizationId, role: 'OWNER' },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    );

  beforeAll(async () => {
    expect(process.env.RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE).toBe('enforce');
    await pool.query(
      `INSERT INTO organizations(id,name,status) VALUES($1,$1,'active'),($2,$2,'active')`,
      [orgA, orgB]
    );
    for (const [userId, organizationId] of [
      [ownerA, orgA],
      [ownerB, orgB],
    ] as const) {
      await pool.query(
        `INSERT INTO users(id,organization_id,email,password,role,status)
         VALUES($1,$2,$3,'x','OWNER','active')`,
        [userId, organizationId, `${userId}@test.invalid`]
      );
      await pool.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status)
         VALUES($1,$2,$3,'OWNER','ACTIVE')`,
        [randomUUID(), organizationId, userId]
      );
    }
    for (const [organizationId, kpiId, code, owner] of [
      [orgA, namedKpi, 'KPI-NAMED', ownerA],
      [orgA, draftKpi, 'KPI-DRAFT', ownerA],
      [orgB, foreignKpi, 'KPI-FOREIGN', ownerB],
    ] as const) {
      await pool.query(
        `INSERT INTO rvn_kpi_definitions
           (kpi_id,organization_id,kpi_code,status,owner_user_id,created_by)
         VALUES($1,$2,$3,'draft',$4,$4)`,
        [kpiId, organizationId, code, owner]
      );
    }
    for (const [versionId, kpiId, organizationId, name, owner] of [
      [namedVersion, namedKpi, orgA, 'Terminowość realizacji zamówień', ownerA],
      [foreignVersion, foreignKpi, orgB, 'Poufny KPI obcej organizacji', ownerB],
    ] as const) {
      await pool.query(
        `INSERT INTO rvn_kpi_definition_versions
           (definition_version_id,kpi_id,organization_id,version_number,name,target_geometry,
            target_min,approval_status,created_by,effective_from)
         VALUES($1,$2,$3,1,$4,'threshold_min',1,'approved',$5,now())`,
        [versionId, kpiId, organizationId, name, owner]
      );
      await pool.query(
        `UPDATE rvn_kpi_definitions SET current_definition_version_id=$1 WHERE kpi_id=$2`,
        [versionId, kpiId]
      );
    }
    for (const [organizationId, owner, entries] of [
      [
        orgA,
        ownerA,
        [
          [namedKpi, 'kpi'],
          [draftKpi, 'kpi'],
        ],
      ],
      [orgB, ownerB, [[foreignKpi, 'kpi']]],
    ] as const) {
      const policy = await pool.query<{ policy_id: string }>(
        `INSERT INTO rvn_platform_visibility_policies
           (organization_id,domain,policy_version,visibility_mode,is_active,created_by)
         VALUES($1,'kpi',1,'OPEN_ORG',true,$2) RETURNING policy_id`,
        [organizationId, owner]
      );
      for (const [resourceId, resourceType] of entries) {
        await pool.query(
          `INSERT INTO rvn_platform_resource_visibility
             (resource_type,resource_id,organization_id,visibility_mode,policy_id,owner_user_id)
           VALUES($1,$2,$3,'OPEN_ORG',$4,$5)`,
          [resourceType, resourceId, organizationId, policy.rows[0]!.policy_id, owner]
        );
      }
    }
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id=ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(
      `UPDATE rvn_kpi_definitions SET current_definition_version_id=NULL WHERE organization_id=ANY($1)`,
      [[orgA, orgB]]
    );
    await pool.query(`DELETE FROM rvn_kpi_definition_versions WHERE organization_id=ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(`DELETE FROM rvn_kpi_definitions WHERE organization_id=ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id=ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id=ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(`DELETE FROM users WHERE id=ANY($1)`, [[ownerA, ownerB]]);
    await pool.query(`DELETE FROM organizations WHERE id=ANY($1)`, [[orgA, orgB]]);
    await pool.end();
    const pgModule = await import('../../../server/src/database/PostgresDatabase.js');
    await (pgModule as unknown as { closePool?: () => Promise<void> }).closePool?.();
  });

  const list = (query = '') =>
    request(app)
      .get(`/api/vnext/results/kpi${query}`)
      .set('Authorization', `Bearer ${token(ownerA, orgA)}`);

  it('returns the current business name additively in the list envelope', async () => {
    const response = await list();
    expect(response.status).toBe(200);
    expect(response.body.kpis).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kpiId: namedKpi, name: 'Terminowość realizacji zamówień' }),
      ])
    );
  });

  it('returns an honest null for a KPI without a current definition version', async () => {
    const response = await list();
    expect(response.body.kpis).toEqual(
      expect.arrayContaining([expect.objectContaining({ kpiId: draftKpi, name: null })])
    );
  });

  it('keeps filtering by the business name in the same SQL query', async () => {
    const response = await list('?q=Terminowość');
    expect(response.status).toBe(200);
    expect(response.body.kpis.map((row: { kpiId: string }) => row.kpiId)).toEqual([namedKpi]);
  });

  it('returns an honest empty list for a non-matching business name', async () => {
    const response = await list('?q=Nieistniejący');
    expect(response.status).toBe(200);
    expect(response.body.kpis).toEqual([]);
  });

  it('never leaks the foreign tenant business name', async () => {
    const response = await list('?q=Poufny');
    expect(response.status).toBe(200);
    expect(response.body.kpis).toEqual([]);
    expect(JSON.stringify(response.body)).not.toContain('Poufny KPI obcej organizacji');
  });
});
