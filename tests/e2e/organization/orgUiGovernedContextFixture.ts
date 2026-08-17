import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';

import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import type { BrowserContext, Page } from '@playwright/test';

export type OrgUiPersona = 'owner' | 'member' | 'revoked' | 'foreign';

export interface OrgUiGovernedFixture {
  pool: Pool;
  organizationId: string;
  foreignOrganizationId: string;
  readonly docId: string | null;
  tokens: Record<OrgUiPersona, string>;
  users: Record<OrgUiPersona, { id: string; organizationId: string; role: string }>;
  bindUploadedDocument(docId: string, filename: string): Promise<string>;
  setUploadedDocumentHash(fileHash: string | null): Promise<void>;
  deleteUploadedDocument(): Promise<void>;
  cleanup(): Promise<void>;
}

const CLEANUP_OPT_IN = 'ORG_UI_ALLOW_IMMUTABLE_FIXTURE_CLEANUP';
const DISPOSABLE_DB_PREFIX_ENV = 'ORG_UI_DISPOSABLE_DB_PREFIX';

export async function createOrgUiGovernedFixture(): Promise<OrgUiGovernedFixture> {
  const databaseUrl = process.env.DATABASE_URL ?? '';
  if (!databaseUrl.startsWith('postgres')) throw new Error('real PostgreSQL DATABASE_URL required');
  if (process.env[CLEANUP_OPT_IN] !== '1') {
    throw new Error(`${CLEANUP_OPT_IN}=1 is required for scoped immutable fixture cleanup`);
  }
  const disposablePrefix = process.env[DISPOSABLE_DB_PREFIX_ENV]?.trim();
  if (!disposablePrefix) {
    throw new Error(`${DISPOSABLE_DB_PREFIX_ENV} is required`);
  }
  const pool = new Pool({ connectionString: databaseUrl });
  const database = await pool.query<{ name: string }>('SELECT current_database() AS name');
  if (!database.rows[0]?.name.startsWith(disposablePrefix)) {
    await pool.end();
    throw new Error(
      `Refusing ORG UI fixture cleanup outside disposable database prefix ${disposablePrefix}`
    );
  }
  const organizationId = randomUUID();
  const foreignOrganizationId = randomUUID();
  let docId: string | null = null;
  let uploadedFilePath: string | null = null;
  const users = {
    owner: { id: randomUUID(), organizationId, role: 'OWNER' },
    member: { id: randomUUID(), organizationId, role: 'MEMBER' },
    revoked: { id: randomUUID(), organizationId, role: 'MEMBER' },
    foreign: { id: randomUUID(), organizationId: foreignOrganizationId, role: 'OWNER' },
  } satisfies Record<OrgUiPersona, { id: string; organizationId: string; role: string }>;

  for (const [id, name] of [
    [organizationId, 'ORG UI governed tenant'],
    [foreignOrganizationId, 'ORG UI foreign tenant'],
  ]) {
    await pool.query(
      `INSERT INTO organizations (id,name,plan,status) VALUES ($1,$2,'enterprise','active')`,
      [id, name]
    );
  }
  for (const [persona, user] of Object.entries(users) as Array<
    [OrgUiPersona, (typeof users)[OrgUiPersona]]
  >) {
    await pool.query(
      `INSERT INTO users (id,organization_id,email,password,role,status)
       VALUES ($1,$2,$3,'unused',$4,'active')`,
      [user.id, user.organizationId, `${user.id}@example.test`, user.role]
    );
    await pool.query(
      `INSERT INTO organization_members (id,organization_id,user_id,role,status)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        randomUUID(),
        user.organizationId,
        user.id,
        user.role,
        persona === 'revoked' ? 'INACTIVE' : 'ACTIVE',
      ]
    );
  }
  const { default: config } = await import('../../../server/src/config/Config.js');
  const tokens = Object.fromEntries(
    (Object.entries(users) as Array<[OrgUiPersona, (typeof users)[OrgUiPersona]]>).map(
      ([persona, user]) => [
        persona,
        jwt.sign(
          {
            id: user.id,
            organizationId: user.organizationId,
            role: user.role,
            email: `${user.id}@example.test`,
          },
          config.JWT_SECRET,
          { expiresIn: '10m' }
        ),
      ]
    )
  ) as Record<OrgUiPersona, string>;

  const cleanupRows = async () => {
    const cleanupClient = await pool.connect();
    const orgIds = [organizationId, foreignOrganizationId];
    const userIds = Object.values(users).map((u) => u.id);
    try {
      await cleanupClient.query('BEGIN');
      await cleanupClient.query(
        `SELECT pg_advisory_xact_lock(hashtext('org-ui-governed-fixture-cleanup'))`
      );
      await cleanupClient.query(
        `DELETE FROM organization_context_snapshot_versions WHERE organization_id = ANY($1)`,
        [orgIds]
      );
      await cleanupClient.query(
        `DELETE FROM organization_context_claim_reviews WHERE organization_id = ANY($1)`,
        [orgIds]
      );
      await cleanupClient.query(
        `DELETE FROM organization_context_claims WHERE organization_id = ANY($1)`,
        [orgIds]
      );
      await cleanupClient.query(
        `DELETE FROM organization_context_items WHERE organization_id = ANY($1)`,
        [orgIds]
      );
      await cleanupClient.query(
        `DELETE FROM organization_context_snapshots WHERE organization_id = ANY($1)`,
        [orgIds]
      );
      if (docId) await cleanupClient.query(`DELETE FROM knowledge_docs WHERE id=$1`, [docId]);
      await cleanupClient.query(
        `DELETE FROM organization_members WHERE organization_id = ANY($1)`,
        [orgIds]
      );
      await cleanupClient.query(`DELETE FROM users WHERE id = ANY($1)`, [userIds]);
      await cleanupClient.query(`DELETE FROM organizations WHERE id = ANY($1)`, [orgIds]);
      const residue = await cleanupClient.query<{ n: number }>(
        `SELECT
         (SELECT count(*) FROM organization_context_snapshot_versions WHERE organization_id = ANY($1))::int +
         (SELECT count(*) FROM organization_context_claim_reviews WHERE organization_id = ANY($1))::int +
         (SELECT count(*) FROM organization_context_claims WHERE organization_id = ANY($1))::int +
         (SELECT count(*) FROM organization_context_items WHERE organization_id = ANY($1))::int +
         (SELECT count(*) FROM organization_context_snapshots WHERE organization_id = ANY($1))::int +
         (SELECT count(*) FROM knowledge_docs WHERE id = $2)::int +
         (SELECT count(*) FROM organization_members WHERE organization_id = ANY($1))::int +
         (SELECT count(*) FROM users WHERE id = ANY($3))::int +
         (SELECT count(*) FROM organizations WHERE id = ANY($1))::int AS n`,
        [orgIds, docId, userIds]
      );
      if (residue.rows[0]?.n !== 0) {
        throw new Error(`ORG UI fixture residue=${residue.rows[0]?.n}`);
      }
      await cleanupClient.query('COMMIT');
    } catch (error) {
      await cleanupClient.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      cleanupClient.release();
    }
  };

  const bindUploadedDocument = async (uploadedDocId: string, filename: string) => {
    if (docId && docId !== uploadedDocId) throw new Error('ORG UI source document already bound');
    const persisted = await pool.query<{
      file_hash: string | null;
      filepath: string | null;
      original_name: string | null;
    }>(
      `SELECT file_hash, filepath, original_name FROM knowledge_docs WHERE id=$1 AND organization_id=$2`,
      [uploadedDocId, organizationId]
    );
    if (persisted.rows.length !== 1 || !persisted.rows[0].file_hash) {
      throw new Error('production upload did not persist a verifiable source digest');
    }
    docId = uploadedDocId;
    uploadedFilePath = persisted.rows[0].filepath;
    expectFilename(filename, persisted.rows[0].original_name);
    return persisted.rows[0].file_hash;
  };

  const setUploadedDocumentHash = async (fileHash: string | null) => {
    if (!docId) throw new Error('ORG UI source document is not bound');
    await pool.query(`UPDATE knowledge_docs SET file_hash=$1 WHERE id=$2 AND organization_id=$3`, [
      fileHash,
      docId,
      organizationId,
    ]);
  };

  const deleteUploadedDocument = async () => {
    if (!docId) throw new Error('ORG UI source document is not bound');
    await pool.query(`DELETE FROM knowledge_docs WHERE id=$1 AND organization_id=$2`, [
      docId,
      organizationId,
    ]);
  };

  try {
    const { default: organizationContextService } =
      await import('../../../server/src/services/organizationContext/OrganizationContextService.js');
    // The source writer creates organization-visible evidence. Add one restricted
    // claim through the same production service contract to prove API filtering.
    await organizationContextService.recordContextSource({
      organizationId,
      sourceType: 'manual_context',
      sourceId: `restricted-${organizationId}`,
      sourceVersion: '1',
      visibilityScope: 'restricted',
      createdBy: users.owner.id,
      claims: [
        {
          claimPath: 'metadata.custom',
          value: 'Restricted board evidence',
          confidence: 0.9,
          claimType: 'fact',
          reviewStatus: 'pending',
        },
      ],
      rebuildSnapshot: false,
    });
  } catch (error) {
    await cleanupRows();
    await pool.end();
    throw error;
  }

  const cleanup = async () => {
    try {
      await cleanupRows();
      if (uploadedFilePath) await fs.rm(uploadedFilePath, { force: true });
    } finally {
      await pool.end();
    }
  };

  return {
    pool,
    organizationId,
    foreignOrganizationId,
    get docId() {
      return docId;
    },
    tokens,
    users,
    bindUploadedDocument,
    setUploadedDocumentHash,
    deleteUploadedDocument,
    cleanup,
  };
}

function expectFilename(actual: string, expected: string | null): void {
  if (actual !== expected) throw new Error(`unexpected ORG UI source filename: ${actual}`);
}

export async function seedOrgUiBrowserAuth(
  target: Page | BrowserContext,
  fixture: OrgUiGovernedFixture,
  persona: OrgUiPersona
): Promise<void> {
  const user = fixture.users[persona];
  await target.addInitScript(
    ({ token, user }) => {
      const browserUser = {
        ...user,
        email: `${user.id}@example.test`,
        organizationName: 'ORG UI governed tenant',
        isAuthenticated: true,
        accessLevel: 'full',
        isDemo: false,
      };
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(browserUser));
      localStorage.setItem(`consultify_onboarding_done:${user.id}`, 'true');
      localStorage.setItem(
        'consultify-storage',
        JSON.stringify({
          state: {
            sessionMode: 'FULL',
            isDemoMode: false,
            isDemoSession: false,
            currentUser: browserUser,
            currentOrganization: { id: user.organizationId, name: 'ORG UI governed tenant' },
          },
          version: 0,
        })
      );
    },
    { token: fixture.tokens[persona], user }
  );
}
