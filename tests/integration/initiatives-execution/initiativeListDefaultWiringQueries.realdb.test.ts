import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';
import defaultRuntimeRouter from '../../../server/src/routes/pmo/initiativesExecutionRuntime.routes';
import {
  hasEffectiveCapability,
  resolveEffectiveAccess,
} from '../../../server/src/services/effectiveAccessService';

const databaseUrl = process.env.DATABASE_URL?.trim();
const describeRealDb = databaseUrl ? describe : describe.skip;
const organizationId = 'day21-default-wiring-org';
const projectId = 'day21-default-wiring-project';
const userId = 'day21-default-wiring-user';

describeRealDb('Day 21 default runtime wiring query count', () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  const app = express();
  app.use((req, _res, next) => {
    (req as any).user = { id: userId, organizationId, role: 'USER' };
    next();
  });
  app.use('/runtime-v1', defaultRuntimeRouter);

  beforeAll(async () => {
    await pool.query(
      `INSERT INTO organizations (id,name) VALUES ($1,'Day 21') ON CONFLICT (id) DO NOTHING`,
      [organizationId]
    );
    await pool.query(
      `INSERT INTO users (id,email,organization_id,status)
       VALUES ($1,'day21-default@local.test',$2,'active') ON CONFLICT (id) DO NOTHING`,
      [userId, organizationId]
    );
    await pool.query(
      `INSERT INTO projects (id,organization_id,name)
       VALUES ($1,$2,'Day 21 project') ON CONFLICT (id) DO NOTHING`,
      [projectId, organizationId]
    );
    await pool.query(
      `INSERT INTO organization_members (id,organization_id,user_id,role,status)
       VALUES ('day21-default-om',$1,$2,'OWNER','ACTIVE')
       ON CONFLICT (organization_id,user_id) DO UPDATE SET role='OWNER',status='ACTIVE'`,
      [organizationId, userId]
    );
    await pool.query(
      `INSERT INTO project_members (id,project_id,user_id,project_role)
       VALUES ('day21-default-pm',$1,$2,'PROJECT_LEADER')
       ON CONFLICT (project_id,user_id) DO UPDATE SET project_role='PROJECT_LEADER'`,
      [projectId, userId]
    );
    await Promise.all(
      Array.from({ length: 50 }, (_, index) => {
        const id = `day21-default-${String(index).padStart(3, '0')}`;
        return pool.query(
          `INSERT INTO ie_aggregate_state
             (organization_id,aggregate_type,aggregate_id,version,payload_json,updated_at)
           VALUES ($1,'initiative',$2,1,$3::jsonb,$4::timestamptz)
           ON CONFLICT (organization_id,aggregate_type,aggregate_id)
           DO UPDATE SET payload_json=EXCLUDED.payload_json,updated_at=EXCLUDED.updated_at`,
          [
            organizationId,
            id,
            JSON.stringify({ initiativeId: id, projectId }),
            `2026-02-01T00:${String(index).padStart(2, '0')}:00.000Z`,
          ]
        );
      })
    );
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM ie_aggregate_state WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM project_members WHERE id='day21-default-pm'`);
    await pool.query(`DELETE FROM organization_members WHERE id='day21-default-om'`);
    await pool.query(`DELETE FROM projects WHERE id=$1`, [projectId]);
    await pool.query(`DELETE FROM users WHERE id=$1`, [userId]);
    await pool.query(`DELETE FROM organizations WHERE id=$1`, [organizationId]);
    await pool.end();
  });

  const measuredRequest = async (limit: number) => {
    const original = Pool.prototype.query;
    let calls = 0;
    const spy = vi.spyOn(Pool.prototype, 'query').mockImplementation(function (...args: any[]) {
      calls += 1;
      return original.apply(this, args as any) as any;
    });
    try {
      const response = await request(app).get(`/runtime-v1/initiatives?limit=${limit}`);
      expect(response.status).toBe(200);
      return calls;
    } finally {
      spy.mockRestore();
    }
  };

  const measuredLegacyPerRow = async (limit: number) => {
    const original = Pool.prototype.query;
    let calls = 0;
    const spy = vi.spyOn(Pool.prototype, 'query').mockImplementation(function (...args: any[]) {
      calls += 1;
      return original.apply(this, args as any) as any;
    });
    try {
      const page = await new PostgresInitiativeReader(pool).listInitiativesPage(
        organizationId,
        limit,
        null
      );
      for (const item of page.initiatives) {
        const access = await resolveEffectiveAccess({
          userId,
          organizationId,
          applicationRole: 'USER',
          projectId: item.initiative.projectId,
          isImpersonating: false,
        });
        hasEffectiveCapability(access, 'initiative.view');
      }
      return calls;
    } finally {
      spy.mockRestore();
    }
  };

  it('keeps production-wired SQL query count constant from 5 to 50 rows', async () => {
    const warmup = await request(app).get('/runtime-v1/initiatives?limit=1');
    expect(warmup.status).toBe(200);
    const fiveRows = await measuredRequest(5);
    const fiftyRows = await measuredRequest(50);
    expect({ fiveRows, fiftyRows }).toEqual({ fiveRows: 5, fiftyRows: 5 });
  });

  it('proves the former per-row authorization query count grows with row count', async () => {
    const fiveRows = await measuredLegacyPerRow(5);
    const fiftyRows = await measuredLegacyPerRow(50);
    expect(fiftyRows).toBeGreaterThan(fiveRows * 5);
    expect({ fiveRows, fiftyRows }).toEqual({ fiveRows: 21, fiftyRows: 201 });
  });
});
