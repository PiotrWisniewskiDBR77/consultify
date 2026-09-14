/**
 * @vitest-environment node
 *
 * W31 D-j — RealPG proof that the readers operate on the seven persisted P12
 * codes and treat BLOCKED as `on_hold`, not as a status value.
 */
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { activeOrgIds } from '../../../cron/ExecutionReportCron.js';
import { INITIATIVE_STAGE_TO_STATUS } from '../../../constants/initiativeLifecycleStages.js';
import { InitiativeStatus } from '../../../constants/initiativeStatuses.js';
import { normalizeLifecycleBucket } from '../resultsROIService.js';

const url = process.env.DATABASE_URL || '';
const demanded = process.env.RUN_DB_TESTS === '1';
const configured = demanded && process.env.MOCK_DB === 'false' && /^postgres(?:ql)?:\/\//.test(url);

if (demanded && !configured) {
  throw new Error(
    'D-j RealPG requires RUN_DB_TESTS=1, MOCK_DB=false and DATABASE_URL=postgresql://…'
  );
}

const describeReal = configured ? describe : describe.skip;

describeReal('W31 D-j — canonical status behavior on RealPG', () => {
  const client = new Client({ connectionString: url });

  beforeAll(async () => {
    await client.connect();
    await client.query('DROP TABLE IF EXISTS initiatives');
    await client.query(`
      CREATE TABLE initiatives (
        id text PRIMARY KEY,
        organization_id text NOT NULL,
        status text NOT NULL CHECK (status IN (
          'PROPOSED','DRAFT','PENDING_APPROVAL','APPROVED','IN_EXECUTION','CLOSED','REJECTED'
        )),
        on_hold boolean NOT NULL DEFAULT false
      )
    `);
    await client.query(
      `INSERT INTO initiatives (id, organization_id, status, on_hold) VALUES
       ('run', 'org-running', 'IN_EXECUTION', false),
       ('hold', 'org-held', 'IN_EXECUTION', true),
       ('backlog', 'org-approved', 'APPROVED', false),
       ('done', 'org-closed', 'CLOSED', false)`
    );
  });

  afterAll(async () => {
    await client.query('DROP TABLE IF EXISTS initiatives');
    await client.end();
  });

  it('cron discovers held and unheld execution rows, excluding other lifecycle codes', async () => {
    const orgs = await activeOrgIds();
    expect(orgs).toHaveLength(2);
    expect(orgs).toEqual(expect.arrayContaining(['org-held', 'org-running']));
  });

  it('the P12 constraint rejects every dead comparison value from this repair', async () => {
    for (const status of ['EXECUTING', 'BLOCKED', 'SCHEDULED', 'DONE']) {
      await expect(
        client.query('INSERT INTO initiatives (id, organization_id, status) VALUES ($1,$2,$3)', [
          `dead-${status}`,
          'org-dead',
          status,
        ])
      ).rejects.toMatchObject({ code: '23514' });
    }
  });

  it('transformation stage targets and ROI buckets agree with persisted readback', async () => {
    const rows = await client.query<{ status: string; on_hold: boolean }>(
      'SELECT status, on_hold FROM initiatives ORDER BY id'
    );
    const statuses = rows.rows.map((row) => row.status);

    expect(statuses).toContain(INITIATIVE_STAGE_TO_STATUS.SCHEDULED);
    expect(statuses).toContain(INITIATIVE_STAGE_TO_STATUS.IN_EXECUTION);
    expect(statuses).toContain(INITIATIVE_STAGE_TO_STATUS.DELIVERED);
    expect(normalizeLifecycleBucket(InitiativeStatus.CLOSED)).toBe('realized');
  });
});
