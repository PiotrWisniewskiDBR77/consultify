import { createHash, randomUUID } from 'node:crypto';

import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import type { BrowserContext, Page } from '@playwright/test';

export type OrgUiPersona = 'owner' | 'member' | 'revoked' | 'foreign';

export interface OrgUiGovernedFixture {
  pool: Pool;
  organizationId: string;
  foreignOrganizationId: string;
  docId: string;
  tokens: Record<OrgUiPersona, string>;
  users: Record<OrgUiPersona, { id: string; organizationId: string; role: string }>;
  cleanup(): Promise<void>;
}

export async function createOrgUiGovernedFixture(): Promise<OrgUiGovernedFixture> {
  const databaseUrl = process.env.DATABASE_URL ?? '';
  if (!databaseUrl.startsWith('postgres')) throw new Error('real PostgreSQL DATABASE_URL required');
  const pool = new Pool({ connectionString: databaseUrl });
  const organizationId = randomUUID();
  const foreignOrganizationId = randomUUID();
  const docId = randomUUID();
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
  await pool.query(
    `INSERT INTO knowledge_docs (id,filename,file_hash,version,organization_id,status)
     VALUES ($1,'governed-strategy.txt',$2,1,$3,'ready')`,
    [docId, createHash('sha256').update('ORG UI governed source').digest('hex'), organizationId]
  );

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
    await pool.query(
      `DELETE FROM organization_context_snapshot_versions WHERE organization_id = ANY($1)`,
      [[organizationId, foreignOrganizationId]]
    );
    await pool.query(`DELETE FROM organization_context_claim_reviews WHERE organization_id = ANY($1)`, [
      [organizationId, foreignOrganizationId],
    ]);
    await pool.query(`DELETE FROM organization_context_claims WHERE organization_id = ANY($1)`, [
      [organizationId, foreignOrganizationId],
    ]);
    await pool.query(`DELETE FROM organization_context_items WHERE organization_id = ANY($1)`, [
      [organizationId, foreignOrganizationId],
    ]);
    await pool.query(`DELETE FROM organization_context_snapshots WHERE organization_id = ANY($1)`, [
      [organizationId, foreignOrganizationId],
    ]);
    await pool.query(`DELETE FROM knowledge_docs WHERE id=$1`, [docId]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [
      [organizationId, foreignOrganizationId],
    ]);
    await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [Object.values(users).map((u) => u.id)]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [
      [organizationId, foreignOrganizationId],
    ]);
    const residue = await pool.query<{ n: number }>(
      `SELECT
       (SELECT count(*) FROM organization_context_items WHERE organization_id = ANY($1))::int +
       (SELECT count(*) FROM organization_context_snapshot_versions WHERE organization_id = ANY($1))::int +
       (SELECT count(*) FROM users WHERE id = ANY($2))::int AS n`,
      [[organizationId, foreignOrganizationId], Object.values(users).map((u) => u.id)]
    );
    if (residue.rows[0]?.n !== 0) throw new Error(`ORG UI fixture residue=${residue.rows[0]?.n}`);
  };

  try {
    const { default: organizationContextService } = await import(
      '../../../server/src/services/organizationContext/OrganizationContextService.js'
    );
    await organizationContextService.recordAttachmentExtraction({
      organizationId,
      userId: users.owner.id,
      payload: {
        docId,
        filename: 'governed-strategy.txt',
        extractedText: 'The organization serves industrial transformation customers.',
      },
    });
    // The source writer creates organization-visible evidence. Add one restricted
    // claim through the same production service contract to prove API filtering.
    await organizationContextService.recordContextSource({
      organizationId,
      sourceType: 'manual_context',
      sourceId: `restricted-${docId}`,
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
    await cleanupRows();
    await pool.end();
  };

  return { pool, organizationId, foreignOrganizationId, docId, tokens, users, cleanup };
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
