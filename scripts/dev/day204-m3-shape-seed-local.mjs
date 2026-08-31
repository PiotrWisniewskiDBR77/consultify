#!/usr/bin/env node
import process from 'node:process';

import pg from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const parsed = new URL(databaseUrl);
if (!['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)) {
  throw new Error(`Day204 seed refuses non-loopback database host: ${parsed.hostname}`);
}

const organizationId = 'day204-m3-org';
const projectId = 'day204-m3-project';
const users = ['day204-owner', 'day204-assignee', 'day204-reporter'];
const initiatives = ['day204-initiative-1', 'day204-initiative-2', 'day204-initiative-3'];
const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
try {
  await client.query('BEGIN');
  await client.query('DELETE FROM legacy_task_cutover_ledger WHERE organization_id=$1', [organizationId]);
  await client.query('DELETE FROM tasks WHERE organization_id=$1', [organizationId]);
  await client.query('DELETE FROM initiatives WHERE organization_id=$1', [organizationId]);
  await client.query('DELETE FROM projects WHERE organization_id=$1', [organizationId]);
  await client.query('DELETE FROM users WHERE organization_id=$1', [organizationId]);
  await client.query('DELETE FROM organizations WHERE id=$1', [organizationId]);
  await client.query(`INSERT INTO organizations(id,name,status) VALUES($1,'Day204 M3 miniature','active')`, [organizationId]);
  for (const userId of users) {
    await client.query(
      `INSERT INTO users(id,organization_id,email,first_name,last_name,role,status)
       VALUES($1,$2,$3,'Day204','Fixture','USER','active')`,
      [userId, organizationId, `${userId}@example.invalid`]
    );
  }
  await client.query(
    `INSERT INTO projects(id,organization_id,name,status,owner_id)
     VALUES($1,$2,'Day204 M3 project','active',$3)`,
    [projectId, organizationId, users[0]]
  );
  for (const initiativeId of initiatives) {
    await client.query(
      `INSERT INTO initiatives(id,organization_id,project_id,name,status,owner_business_id,owner_execution_id)
       VALUES($1,$2,$3,$4,'DRAFT',$5,$5)`,
      [initiativeId, organizationId, projectId, `Legacy ${initiativeId}`, users[0]]
    );
  }
  const rows = [
    ['task-1a', initiatives[0], users[1], users[0], '2026-09-10T12:00:00Z'],
    ['task-1b', initiatives[0], users[1], null, '2026-09-11T12:00:00Z'],
    ['task-2a', initiatives[1], users[1], users[0], null],
    ['task-2b', initiatives[1], users[1], null, '2026-09-12T12:00:00Z'],
    ['task-3a', initiatives[2], users[1], users[0], '2026-09-13T12:00:00Z'],
    ['task-3b', initiatives[2], users[1], null, null],
    ['task-personal-1', null, users[1], users[0], '2026-09-14T12:00:00Z'],
    ['task-personal-2', null, null, null, null],
  ];
  for (const [id, initiativeId, assigneeId, ownerId, dueDate] of rows) {
    await client.query(
      `INSERT INTO tasks
       (id,project_id,organization_id,title,status,assignee_id,reporter_id,due_date,
        initiative_id,owner_id,created_by,sla_due_at)
       VALUES($1,$2,$3,$4,'todo',$5,$6,$7,$8,$9,$6,NULL)`,
      [id, projectId, organizationId, `Legacy ${id}`, assigneeId, users[2], dueDate, initiativeId, ownerId]
    );
  }
  await client.query('COMMIT');
  console.log(JSON.stringify({ organizationId, initiatives: initiatives.length, initiativeTasks: 6, personalTasks: 2, allWithoutSla: true }));
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
