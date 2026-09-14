/** @vitest-environment node */
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';

const databaseUrl = process.env.TEST_DATABASE_URL;
const maybeDescribe = databaseUrl ? describe : describe.skip;

maybeDescribe('initiative work report — real PostgreSQL', () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const orgId = randomUUID();
  const otherOrgId = randomUUID();
  const projectId = randomUUID();
  const managerId = randomUUID();

  beforeAll(async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id text PRIMARY KEY,
        organization_id text NOT NULL,
        first_name text,
        last_name text,
        email text
      );
      CREATE TABLE IF NOT EXISTS ie_aggregate_state (
        organization_id text NOT NULL,
        aggregate_type text NOT NULL,
        aggregate_id text NOT NULL,
        version integer NOT NULL,
        payload_json jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (organization_id, aggregate_type, aggregate_id)
      );
    `);
    await pool.query('TRUNCATE ie_aggregate_state, users');
    await pool.query(
      `INSERT INTO users(id,organization_id,first_name,last_name,email) VALUES($1,$2,'Maria','Manager','maria@example.test')`,
      [managerId, orgId]
    );
    await pool.query(
      `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json)
       VALUES
       ($1,'initiative','initiative-visible',4,$3::jsonb),
       ($1,'decision','decision-overdue',2,$4::jsonb),
       ($2,'initiative','initiative-foreign',9,$5::jsonb),
       ($1,'initiative','initiative-other-project',3,$6::jsonb)`,
      [
        orgId,
        otherOrgId,
        JSON.stringify({ title: 'Visible initiative', status: 'IN_EXECUTION', projectId }),
        JSON.stringify({
          status: 'PENDING',
          projectId,
          authorityId: managerId,
          dueAt: '2020-01-01T00:00:00.000Z',
        }),
        JSON.stringify({ title: 'Foreign initiative', status: 'DRAFT', projectId }),
        JSON.stringify({ title: 'Other project', status: 'DRAFT', projectId: randomUUID() }),
      ]
    );
  });

  afterAll(async () => {
    await pool.query('DROP TABLE IF EXISTS ie_aggregate_state; DROP TABLE IF EXISTS users;');
    await pool.end();
  });

  it('reads one tenant and project, with a PostgreSQL-backed overdue-decision rollup', async () => {
    const reader = new PostgresInitiativeReader(pool);
    const result = await reader.buildInitiativeWorkReport(orgId, {
      title: 'Pilot report',
      templateId: 'DECISION_BACKLOG',
      projectIds: [projectId],
    });

    expect(result.content.initiatives.map((item) => item.id)).toEqual(['initiative-visible']);
    expect(result.content.summary).toMatchObject({
      initiatives: 1,
      pendingDecisions: 1,
      overdueDecisions: 1,
    });
    expect(result.content.decisionDebtors).toEqual([
      expect.objectContaining({ authorityName: 'Maria Manager', pending: 1, overdue: 1 }),
    ]);
    expect(result.sources.map((source) => source.sourceId)).toEqual([
      'initiative-visible',
      'decision-overdue',
    ]);
  });
});
