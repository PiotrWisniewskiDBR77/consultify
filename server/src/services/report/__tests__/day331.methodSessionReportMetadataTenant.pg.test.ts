/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';

const NO_RETRY = { retry: 0 } as const;

describe('Day331 method-session report metadata tenant guard', NO_RETRY, () => {
  const ownerOrg = randomUUID();
  const foreignOrg = randomUUID();
  const ownerUser = randomUUID();
  const sessionId = randomUUID();
  let sql: Client;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();
    sql = new Client({ connectionString: String(process.env.DATABASE_URL) });
    await sql.connect();
    await sql.query(`INSERT INTO organizations (id,name) VALUES ($1,'Day331 owner'),($2,'Day331 foreign')`, [ownerOrg, foreignOrg]);
    await sql.query(`INSERT INTO users (id,organization_id,email,role) VALUES ($1,$2,$3,'user')`, [ownerUser, ownerOrg, `${ownerUser}@example.test`]);
    await sql.query(
      `INSERT INTO method_sessions
       (id,organization_id,module,method_pack_id,method_pack_version,state,mode,owner_user_id)
       VALUES ($1,$2,'assessment','drd','v1','active','guided_manual',$3)`,
      [sessionId, ownerOrg, ownerUser]
    );
  });

  afterAll(async () => {
    if (!sql) return;
    await sql.query('DELETE FROM method_sessions WHERE id=$1', [sessionId]);
    await sql.query('DELETE FROM users WHERE id=$1', [ownerUser]);
    await sql.query('DELETE FROM organizations WHERE id IN ($1,$2)', [ownerOrg, foreignOrg]);
    await sql.end();
  });

  it('allows the owner tenant and refuses a foreign overwrite without changing the cold read', async () => {
    const { methodSessionReportMetadataService: service } = await import('../methodSessionReportMetadataService.js');
    const input = (organizationId: string, studyScope: string) => ({
      sessionId,
      organizationId,
      advisoryTeam: [],
      clientTeam: [],
      studyPeriod: '2026-09',
      studyScope,
      exclusions: [],
      calendarEntries: [],
      recommendations: [],
      recommendedCeilingRationales: {},
      updatedBy: ownerUser,
    });

    await service.save(input(ownerOrg, 'owner value'));
    await expect(service.save(input(foreignOrg, 'foreign overwrite'))).rejects.toThrow(
      'report metadata save refused'
    );

    const cold = new Client({ connectionString: String(process.env.DATABASE_URL) });
    await cold.connect();
    const stored = await cold.query(
      'SELECT organization_id,study_scope FROM method_session_report_metadata WHERE session_id=$1',
      [sessionId]
    );
    await cold.end();
    expect(stored.rows).toEqual([{ organization_id: ownerOrg, study_scope: 'owner value' }]);
  });
});
