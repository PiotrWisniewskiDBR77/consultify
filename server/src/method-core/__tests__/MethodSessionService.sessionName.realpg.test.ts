/**
 * @vitest-environment node
 *
 * OP-1/W205 + Z-63b: real Postgres proof that `method_sessions.name` is not
 * a source-only promise. Creating a method session without a name must persist
 * a visible fallback name, and reopening a frozen session must persist the same
 * name on the new active revision.
 */
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL =
  process.env.OP1_REALPG_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:6454/consultify_op1';
const RUN_REAL = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false';

const ORG = 'op1-z63b-org';
const USER = 'op1-z63b-user';

async function resetSchema(client: Client): Promise<void> {
  await client.query(`CREATE TABLE IF NOT EXISTS organizations (id text PRIMARY KEY, name text)`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS method_sessions (
      id text PRIMARY KEY,
      name text,
      organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      project_id text,
      module text NOT NULL,
      method_pack_id text NOT NULL,
      method_pack_version text NOT NULL,
      state text NOT NULL DEFAULT 'draft',
      domain_stage text,
      mode text NOT NULL,
      owner_user_id text NOT NULL,
      version integer NOT NULL DEFAULT 1,
      frozen_snapshot_id text,
      revision_of_session_id text REFERENCES method_sessions(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      demo_bypass_active boolean NOT NULL DEFAULT false
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS method_session_roles (
      id text PRIMARY KEY,
      organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      session_id text NOT NULL REFERENCES method_sessions(id) ON DELETE CASCADE,
      user_id text NOT NULL,
      role text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (session_id, user_id, role)
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS method_session_role_events (
      id text PRIMARY KEY,
      organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      session_id text NOT NULL REFERENCES method_sessions(id) ON DELETE CASCADE,
      user_id text NOT NULL,
      role text NOT NULL,
      action text NOT NULL,
      actor_user_id text NOT NULL,
      occurred_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.query(`DELETE FROM method_session_role_events WHERE organization_id = $1`, [ORG]);
  await client.query(`DELETE FROM method_session_roles WHERE organization_id = $1`, [ORG]);
  await client.query(`DELETE FROM method_sessions WHERE organization_id = $1`, [ORG]);
  await client.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`, [ORG, 'OP1 Z63b Org']);
}

describe.runIf(RUN_REAL)('MethodSessionService session names — RealPG', () => {
  let client: Client;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DB_TYPE = 'postgres';
    process.env.DATABASE_URL = DATABASE_URL;
    process.env.MOCK_DB = 'false';
    process.env.RUN_DB_TESTS = '1';
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    await resetSchema(client);
  });

  afterAll(async () => {
    if (client) {
      await client.query(`DELETE FROM method_session_role_events WHERE organization_id = $1`, [ORG]);
      await client.query(`DELETE FROM method_session_roles WHERE organization_id = $1`, [ORG]);
      await client.query(`DELETE FROM method_sessions WHERE organization_id = $1`, [ORG]);
      await client.end();
    }
  });

  it('persists fallback name on create and carries it to a reopened active revision', async () => {
    const { MethodEventStore } = await import('../MethodEventStore.js');
    const { MethodSessionService } = await import('../MethodSessionService.js');

    const service = new MethodSessionService(
      { getReadiness: async () => ({ canStart: true, readiness: 'released' }) },
      new MethodEventStore()
    );

    const created = await service.createSession({
      organizationId: ORG,
      projectId: null,
      module: 'assessment',
      methodPackId: 'drd-method-pack-v1',
      methodPackVersion: '1.0.0',
      ownerUserId: USER,
      mode: 'guided_manual',
      name: null,
    });

    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error('createSession refused unexpectedly');
    expect(created.session.name).toMatch(/^DRD — op1-z63b — \d{4}-\d{2}-\d{2}$/);

    const createReadback = await client.query<{ name: string | null }>(
      `SELECT name FROM method_sessions WHERE id = $1`,
      [created.session.id]
    );
    expect(createReadback.rows[0]?.name).toBe(created.session.name);

    await service.assignRole(ORG, created.session.id, USER, 'owner', USER);
    await client.query(`UPDATE method_sessions SET state = 'frozen' WHERE id = $1`, [created.session.id]);

    const reopened = await service.transition({
      sessionId: created.session.id,
      actorKind: 'human',
      actorUserId: USER,
      to: 'active',
    });
    expect(reopened.ok).toBe(true);

    const revisions = await client.query<{ id: string; name: string | null; revision_of_session_id: string | null; state: string }>(
      `SELECT id, name, revision_of_session_id, state
         FROM method_sessions
        WHERE organization_id = $1 AND revision_of_session_id = $2`,
      [ORG, created.session.id]
    );
    expect(revisions.rows).toHaveLength(1);
    expect(revisions.rows[0]).toMatchObject({
      name: created.session.name,
      revision_of_session_id: created.session.id,
      state: 'active',
    });
  });
});
