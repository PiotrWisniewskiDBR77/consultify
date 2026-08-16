import { randomUUID } from 'node:crypto';
import type { NextFunction, Response } from 'express';
import express from 'express';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  FINANCE_LEGACY_WRITER_ROLLBACK_ENV,
  financeLegacyCutoverGuard,
} from '../financeLegacyCutover.js';
import { createArtifact } from '../finance/canonical/artifactVersionService.js';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

describe.skipIf(!REAL_PG)('Finance legacy cutover telemetry (fresh real PostgreSQL)', () => {
  const fixtureId = randomUUID();
  const organizationId = `org-fin-cutover-${fixtureId}`;
  const userId = `user-fin-cutover-${fixtureId}`;
  const legacyId = `legacy-model-${fixtureId}`;
  let artifactId = '';
  let businessVersionId = '';
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: CONNECTION_STRING });
    await client.connect();
    await client.query(`INSERT INTO organizations(id,name) VALUES($1,$2)`, [
      organizationId,
      'Finance cutover fixture',
    ]);
    const canonical = await createArtifact({
      organizationId,
      artifactType: 'STATEMENT_PACK',
      createdBy: userId,
    });
    artifactId = canonical.artifact.artifact_id;
    businessVersionId = canonical.businessVersion.business_version_id;
    await client.query(
      `INSERT INTO finance_artifact_aliases
         (organization_id,legacy_table,legacy_id,artifact_id,business_version_id,
          mapping_confidence,mapping_reason,created_by)
       VALUES ($1,'financial_models',$2,$3,$4,'AUTO_MIGRATE','test fixture',$5)`,
      [organizationId, legacyId, artifactId, businessVersionId, userId]
    );
  });

  afterAll(async () => {
    delete process.env[FINANCE_LEGACY_WRITER_ROLLBACK_ENV];
    if (client) await client.end();
  });

  function req(): any {
    return {
      method: 'POST',
      path: `/models/${legacyId}/approve`,
      headers: { 'x-request-id': 'realpg-request' },
      v8Context: { organizationId, userId, userRole: 'finance_admin' },
    };
  }

  function res(): Response {
    const response: any = {};
    response.status = vi.fn(() => response);
    response.json = vi.fn(() => response);
    return response;
  }

  it('persists idempotent blocked and rollback usage with the tenant-resolved canonical ID pair', async () => {
    delete process.env[FINANCE_LEGACY_WRITER_ROLLBACK_ENV];
    const blockedNext: NextFunction = vi.fn();
    await financeLegacyCutoverGuard(req(), res(), blockedNext);
    expect(blockedNext).not.toHaveBeenCalled();
    await financeLegacyCutoverGuard(req(), res(), vi.fn());

    process.env[FINANCE_LEGACY_WRITER_ROLLBACK_ENV] = 'true';
    const rollbackNext: NextFunction = vi.fn();
    await financeLegacyCutoverGuard(req(), res(), rollbackNext);
    expect(rollbackNext).toHaveBeenCalledOnce();

    const result = await client.query(
      `SELECT access_kind,legacy_table,legacy_id,
              canonical_artifact_id::text,canonical_business_version_id::text
         FROM finance_legacy_usage_events
        WHERE organization_id = $1
        ORDER BY observed_at,id`,
      [organizationId]
    );
    expect(result.rows).toEqual([
      {
        access_kind: 'legacy_writer_blocked',
        legacy_table: 'financial_models',
        legacy_id: legacyId,
        canonical_artifact_id: artifactId,
        canonical_business_version_id: businessVersionId,
      },
      {
        access_kind: 'rollback_writer',
        legacy_table: 'financial_models',
        legacy_id: legacyId,
        canonical_artifact_id: artifactId,
        canonical_business_version_id: businessVersionId,
      },
    ]);
  });

  it('fails closed through the real mounted Finance router and advertises the canonical successor', async () => {
    delete process.env[FINANCE_LEGACY_WRITER_ROLLBACK_ENV];
    const { default: financeRouter } = await import('../../routes/v8/finance.routes.js');
    const app = express();
    app.use(express.json());
    app.use((request_: any, _response, next) => {
      request_.user = { id: userId, organizationId, role: 'finance_admin' };
      request_.userId = userId;
      request_.organizationId = organizationId;
      request_.v8Context = { organizationId, userId, userRole: 'finance_admin' };
      next();
    });
    app.use('/api/v8/finance', financeRouter);

    const response = await request(app)
      .post(`/api/v8/finance/models/${legacyId}/approve`)
      .set('x-request-id', 'mounted-realpg-request')
      .send({});
    expect(response.status).toBe(410);
    expect(response.body).toMatchObject({
      code: 'FINANCE_LEGACY_WRITER_DISABLED',
      successor: '/api/v8/finance-v2/models/:artifactId/approve',
    });
  });

  it('keeps an identical legacy ID in a foreign tenant disconnected from this alias', async () => {
    const foreignOrganizationId = `org-fin-cutover-foreign-${fixtureId}`;
    await client.query(`INSERT INTO organizations(id,name) VALUES($1,$2)`, [
      foreignOrganizationId,
      'Finance cutover foreign fixture',
    ]);
    const foreignReq: any = {
      ...req(),
      headers: { 'x-request-id': 'foreign-request' },
      v8Context: { organizationId: foreignOrganizationId, userId, userRole: 'finance_admin' },
    };
    await financeLegacyCutoverGuard(foreignReq, res(), vi.fn());

    const row = await client.query(
      `SELECT canonical_artifact_id,canonical_business_version_id
         FROM finance_legacy_usage_events
        WHERE organization_id=$1 AND request_id='foreign-request'`,
      [foreignOrganizationId]
    );
    expect(row.rows).toEqual([{ canonical_artifact_id: null, canonical_business_version_id: null }]);
  });

  it('survives a cold connection with stable identity and exactly one row per request', async () => {
    const cold = new Client({ connectionString: CONNECTION_STRING });
    await cold.connect();
    const rows = await cold.query(
      `SELECT request_id,access_kind,canonical_artifact_id,canonical_business_version_id
         FROM finance_legacy_usage_events
        WHERE organization_id=$1 AND request_id='realpg-request' ORDER BY access_kind`,
      [organizationId]
    );
    await cold.end();
    expect(rows.rows).toHaveLength(2);
    expect(rows.rows.every((row) => row.request_id === 'realpg-request')).toBe(true);
    expect(rows.rows.every((row) => row.canonical_artifact_id === artifactId)).toBe(true);
    expect(rows.rows.every((row) => row.canonical_business_version_id === businessVersionId)).toBe(true);
  });
});
