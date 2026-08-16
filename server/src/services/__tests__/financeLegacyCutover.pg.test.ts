import { randomUUID } from 'node:crypto';
import type { NextFunction, Response } from 'express';
import { Client } from 'pg';
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

  it('persists blocked and rollback usage with the resolved canonical ID pair', async () => {
    delete process.env[FINANCE_LEGACY_WRITER_ROLLBACK_ENV];
    const blockedNext: NextFunction = vi.fn();
    await financeLegacyCutoverGuard(req(), res(), blockedNext);
    expect(blockedNext).not.toHaveBeenCalled();

    process.env[FINANCE_LEGACY_WRITER_ROLLBACK_ENV] = 'true';
    const rollbackNext: NextFunction = vi.fn();
    await financeLegacyCutoverGuard(req(), res(), rollbackNext);
    expect(rollbackNext).toHaveBeenCalledOnce();

    const result = await client.query(
      `SELECT access_kind,legacy_table,legacy_id,
              canonical_artifact_id::text,canonical_business_version_id::text
         FROM finance_legacy_usage_events
        ORDER BY observed_at,id`
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
});
