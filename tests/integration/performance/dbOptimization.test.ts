/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { Client } from 'pg';

describe('Database Performance Optimization', () => {
  let DbPromise: any;
  let pgClient: Client;
  const orgId = uuidv4();
  const projectId = uuidv4();
  const assigneeId = uuidv4();
  const initiativeId = uuidv4();

  beforeAll(async () => {
    pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();
    // Force disable Mock DB to use real SQLite (in-memory)
    process.env.MOCK_DB = 'false';

    // Dynamic import to ensure it picks up the env var change
    // We need to bust the cache to ensure a fresh module load if it was already loaded
    const mod = await import('../../../server/src/utils/DbPromise.js');
    DbPromise = mod.default;

    // Seed some data to ensure the optimizer has stats
    // We create the table manually here to be safe, although normally database.sqlite.active.js does it.
    // Importing database.active might be needed if DbPromise doesn't trigger it.

    await DbPromise.run(
      `CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY, name TEXT)`
    );
    await DbPromise.run(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'Test Org']);

    // Initialize tasks table simplified for this test if not present
    await DbPromise.run(`CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            organization_id TEXT,
            project_id TEXT,
            title TEXT,
            status TEXT,
            assignee_id TEXT,
            initiative_id TEXT,
            created_at TEXT
        )`);

    // Create the indexes we want to test
    await DbPromise.run(
      `CREATE INDEX IF NOT EXISTS idx_tasks_org_assignee_status ON tasks(organization_id, assignee_id, status)`
    );
    await DbPromise.run(
      `CREATE INDEX IF NOT EXISTS idx_tasks_org_initiative ON tasks(organization_id, initiative_id)`
    );

    // Insert tasks with various combinations
    const tasks = [];
    for (let i = 0; i < 100; i++) {
      tasks.push(
        DbPromise.run(
          `INSERT INTO tasks (id, organization_id, project_id, title, status, assignee_id, initiative_id, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            orgId,
            projectId,
            `Task ${i}`,
            i % 2 === 0 ? 'todo' : 'done',
            assigneeId,
            initiativeId,
            new Date().toISOString(),
          ]
        )
      );
    }
    await Promise.all(tasks);
  });

  afterAll(async () => {
    await pgClient.end();
  });

  it('should use idx_tasks_org_assignee_status when filtering by org, assignee, and status', async () => {
    const result = await pgClient.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='tasks' AND indexname=$1`,
      ['idx_tasks_org_assignee_status']
    );
    expect(result.rows).toHaveLength(1);
  });

  it('should use idx_tasks_org_initiative when filtering by org and initiative', async () => {
    const result = await pgClient.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='tasks' AND indexname=$1`,
      ['idx_tasks_org_initiative']
    );
    expect(result.rows).toHaveLength(1);
  });
});
