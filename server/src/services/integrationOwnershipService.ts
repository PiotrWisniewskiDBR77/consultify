import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

async function ensureIntegrationOwnershipTable(): Promise<void> {
  // Fail-soft: opportunistic idempotent DDL invoked first by the read paths
  // (getIntegrationOwner / listIntegrationOwnershipByOrg). Use fallback:true so a
  // transient DDL failure can NEVER reject and bubble up as a bare HTTP 500 — the
  // reads degrade to null / empty instead. The ownership UPSERT keeps
  // fallback:false so real write failures still surface.
  await dbRun(
    `
      CREATE TABLE IF NOT EXISTS integration_ownership (
        integration_id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        owner_user_id TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `,
    [],
    { fallback: true }
  );
  await dbRun(
    `CREATE INDEX IF NOT EXISTS idx_integration_ownership_org ON integration_ownership(organization_id)`,
    [],
    { fallback: true }
  );
  await dbRun(
    `CREATE INDEX IF NOT EXISTS idx_integration_ownership_owner ON integration_ownership(owner_user_id)`,
    [],
    { fallback: true }
  );
}

export async function setIntegrationOwner(params: {
  integrationId: string;
  organizationId: string;
  ownerUserId: string;
}): Promise<void> {
  await ensureIntegrationOwnershipTable();

  const { integrationId, organizationId, ownerUserId } = params;

  await dbRun(
    `
      INSERT INTO integration_ownership (integration_id, organization_id, owner_user_id, created_at, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (integration_id) DO UPDATE SET
        organization_id = EXCLUDED.organization_id,
        owner_user_id = EXCLUDED.owner_user_id,
        updated_at = CURRENT_TIMESTAMP
    `,
    [integrationId, organizationId, ownerUserId],
    { fallback: false }
  );
}

export async function getIntegrationOwner(params: {
  integrationId: string;
  organizationId: string;
}): Promise<{ ownerUserId: string } | null> {
  await ensureIntegrationOwnershipTable();
  const row = await dbGet<{ owner_user_id: string }>(
    `SELECT owner_user_id FROM integration_ownership WHERE integration_id = ? AND organization_id = ? LIMIT 1`,
    [params.integrationId, params.organizationId],
    { fallback: true }
  );
  return row?.owner_user_id ? { ownerUserId: row.owner_user_id } : null;
}

export async function listIntegrationOwnershipByOrg(organizationId: string): Promise<
  Array<{
    integrationId: string;
    ownerUserId: string;
    createdAt: string | null;
    updatedAt: string | null;
  }>
> {
  await ensureIntegrationOwnershipTable();
  const rows =
    (await dbAll<{
      integration_id: string;
      owner_user_id: string;
      created_at: string | null;
      updated_at: string | null;
    }>(
      `SELECT integration_id, owner_user_id, created_at, updated_at
       FROM integration_ownership
       WHERE organization_id = ?
       ORDER BY updated_at DESC`,
      [organizationId],
      { fallback: true }
    )) || [];

  return rows.map((r) => ({
    integrationId: r.integration_id,
    ownerUserId: r.owner_user_id,
    createdAt: r.created_at ?? null,
    updatedAt: r.updated_at ?? null,
  }));
}
