#!/usr/bin/env tsx
/** Guarded Wave 3 Partner owner-review fixture. Local disposable PostgreSQL only. */
import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import bcrypt from 'bcryptjs';
import { Client } from 'pg';

const confirmation = process.env.SEED_WAVE3_PARTNER_OWNER_REVIEW;
const databaseUrl = process.env.DATABASE_URL ?? '';
const manifestPath = process.env.PARTNER_OWNER_FIXTURE_MANIFEST ?? '';
const fixturePassword = process.env.PARTNER_OWNER_FIXTURE_PASSWORD ?? '';
const reset = process.argv.includes('--reset');

if (confirmation !== 'YES') throw new Error('SEED_WAVE3_PARTNER_OWNER_REVIEW=YES is required');
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const parsed = new URL(databaseUrl);
const databaseName = parsed.pathname.replace(/^\//, '');
if (!['127.0.0.1', 'localhost'].includes(parsed.hostname)) {
  throw new Error('Partner owner fixture requires loopback PostgreSQL');
}
if (!/^consultify_w3_partner_owner_[a-z0-9_]+$/.test(databaseName)) {
  throw new Error('Database name must match consultify_w3_partner_owner_*');
}

const adminUrl = new URL(databaseUrl);
adminUrl.pathname = '/postgres';

async function dropWholeDatabase() {
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
       WHERE datname=$1 AND pid <> pg_backend_pid()`,
      [databaseName]
    );
    await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    const absent = await admin.query(`SELECT 1 FROM pg_database WHERE datname=$1`, [databaseName]);
    if (absent.rowCount !== 0) throw new Error('Partner owner database remains in catalog');
    process.stdout.write(
      `${JSON.stringify({ fixture: 'wave3-partner-owner-review-v1', reset: true, catalogAbsent: true })}\n`
    );
  } finally {
    await admin.end();
  }
}

if (reset) {
  await dropWholeDatabase();
  process.exit(0);
}
if (!manifestPath || !fixturePassword) {
  throw new Error('PARTNER_OWNER_FIXTURE_MANIFEST and PARTNER_OWNER_FIXTURE_PASSWORD are required');
}
if (fs.existsSync(manifestPath)) throw new Error('Refusing to overwrite existing Partner manifest');

const IDs = {
  ownerOrg: 'b1600000-0000-4000-8000-000000000001',
  foreignOrg: 'b1600000-0000-4000-8000-000000000002',
  participantOrg: 'b1600000-0000-4000-8000-000000000003',
  ownerUser: 'b1610000-0000-4000-8000-000000000001',
  adminUser: 'b1610000-0000-4000-8000-000000000002',
  memberUser: 'b1610000-0000-4000-8000-000000000003',
  revokedUser: 'b1610000-0000-4000-8000-000000000004',
  unboundUser: 'b1610000-0000-4000-8000-000000000005',
  partnerOrg: 'b1620000-0000-4000-8000-000000000001',
  unboundPartnerOrg: 'b1620000-0000-4000-8000-000000000002',
  attribution: 'b1630000-0000-4000-8000-000000000001',
  ledger: 'b1640000-0000-4000-8000-000000000001',
  certificationProgress: 'b1650000-0000-4000-8000-000000000001',
  certificationComplete: 'b1650000-0000-4000-8000-000000000002',
};
const emails = {
  owner: 'wave3.partner.owner.20260821@local.test',
  admin: 'wave3.partner.admin.20260821@local.test',
  member: 'wave3.partner.member.20260821@local.test',
  revoked: 'wave3.partner.revoked.20260821@local.test',
  unbound: 'wave3.partner.unbound.20260821@local.test',
};
const digest = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fixtureId = 'W3-PARTNER-OWNER-v1';
const ownershipNonce = randomBytes(32).toString('hex');
const sourceRef = {
  fixture: 'wave3-partner-owner-review-v1',
  classification: 'non-economic-referral-lineage',
  attributionId: IDs.attribution,
  commissionRatePercent: 0,
};
const passwordHash = await bcrypt.hash(fixturePassword, 10);
const db = new Client({ connectionString: databaseUrl });
await db.connect();

try {
  const current = await db.query<{ name: string }>('SELECT current_database() AS name');
  if (current.rows[0]?.name !== databaseName) throw new Error('Connected database identity mismatch');
  const migrations = await db.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM schema_migrations WHERE status IN ('applied','success')`
  );
  if (Number(migrations.rows[0]?.count) !== 817)
    throw new Error('Partner owner database must have exactly 817 successful migrations');

  await db.query('BEGIN');
  await db.query(
    `CREATE TABLE IF NOT EXISTS public.wave3_owner_fixture_markers(
       fixture_id TEXT PRIMARY KEY,
       ownership_nonce TEXT NOT NULL,
       database_name TEXT NOT NULL
     )`
  );
  await db.query(
    `INSERT INTO public.wave3_owner_fixture_markers(fixture_id,ownership_nonce,database_name)
     VALUES($1,$2,current_database())`,
    [fixtureId, ownershipNonce]
  );
  await db.query(`SET LOCAL session_replication_role='replica'`);
  await db.query(`DELETE FROM partner_participant_ledger WHERE id=$1`, [IDs.ledger]);
  await db.query(`DELETE FROM partner_attributions WHERE id=$1`, [IDs.attribution]);
  await db.query(`DELETE FROM partner_certifications WHERE id IN ($1,$2)`, [
    IDs.certificationProgress,
    IDs.certificationComplete,
  ]);
  await db.query(`DELETE FROM partner_users WHERE user_id::text=ANY($1::text[])`, [
    [IDs.ownerUser, IDs.adminUser, IDs.memberUser, IDs.revokedUser, IDs.unboundUser],
  ]);
  await db.query(`DELETE FROM organization_members WHERE user_id=ANY($1::text[])`, [
    [IDs.ownerUser, IDs.adminUser, IDs.memberUser, IDs.revokedUser, IDs.unboundUser],
  ]);
  await db.query(`DELETE FROM partner_organizations WHERE id IN ($1,$2)`, [
    IDs.partnerOrg,
    IDs.unboundPartnerOrg,
  ]);
  await db.query(`DELETE FROM users WHERE id=ANY($1::text[])`, [
    [IDs.ownerUser, IDs.adminUser, IDs.memberUser, IDs.revokedUser, IDs.unboundUser],
  ]);
  await db.query(`DELETE FROM organizations WHERE id=ANY($1::text[])`, [
    [IDs.ownerOrg, IDs.foreignOrg, IDs.participantOrg],
  ]);
  await db.query(`SET LOCAL session_replication_role='origin'`);

  await db.query(
    `INSERT INTO organizations(id,name) VALUES
      ($1,'Wave 3 Partner Owner'),($2,'Wave 3 Foreign Tenant'),($3,'Wave 3 Referred Participant')`,
    [IDs.ownerOrg, IDs.foreignOrg, IDs.participantOrg]
  );
  const users = [
    [IDs.ownerUser, IDs.ownerOrg, emails.owner, 'Owner', 'Reviewer', 'ADMIN'],
    [IDs.adminUser, IDs.ownerOrg, emails.admin, 'Admin', 'Reviewer', 'ADMIN'],
    [IDs.memberUser, IDs.ownerOrg, emails.member, 'Partner', 'Member', 'USER'],
    [IDs.revokedUser, IDs.ownerOrg, emails.revoked, 'Revoked', 'Reviewer', 'USER'],
    [IDs.unboundUser, IDs.ownerOrg, emails.unbound, 'Unbound', 'Reviewer', 'USER'],
  ];
  for (const [id, organizationId, email, firstName, lastName, role] of users) {
    await db.query(
      `INSERT INTO users(id,organization_id,email,password,first_name,last_name,role,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'active')`,
      [id, organizationId, email, passwordHash, firstName, lastName, role]
    );
  }
  const memberships = [
    [IDs.ownerOrg, IDs.ownerUser, 'OWNER', 'ACTIVE'],
    [IDs.foreignOrg, IDs.ownerUser, 'ADMIN', 'ACTIVE'],
    [IDs.ownerOrg, IDs.adminUser, 'ADMIN', 'ACTIVE'],
    [IDs.ownerOrg, IDs.memberUser, 'MEMBER', 'ACTIVE'],
    [IDs.ownerOrg, IDs.revokedUser, 'MEMBER', 'REVOKED'],
    [IDs.ownerOrg, IDs.unboundUser, 'MEMBER', 'ACTIVE'],
  ];
  for (const [organizationId, userId, role, status] of memberships) {
    await db.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES (gen_random_uuid()::text,$1,$2,$3,$4)`,
      [organizationId, userId, role, status]
    );
  }
  await db.query(
    `INSERT INTO partner_organizations
      (id,name,contact_email,tier,status,partner_since,public_listing_enabled,created_by,updated_by,
       owner_organization_id,referral_code,referral_link_slug,commission_rate_percent)
     VALUES
      ($1,'Wave 3 Trusted Partner',$2,'certified','active',now(),true,$3,$3,$4,'W3PARTNER','w3-partner-owner',0),
      ($5,'Wave 3 Unbound Historical',$6,'registered','active',now(),false,$7,$7,NULL,'W3UNBOUND','w3-unbound',0)`,
    [
      IDs.partnerOrg,
      emails.owner,
      IDs.ownerUser,
      IDs.ownerOrg,
      IDs.unboundPartnerOrg,
      emails.unbound,
      IDs.unboundUser,
    ]
  );
  const partnerUsers = [
    [IDs.partnerOrg, IDs.ownerUser, 'owner', 'active'],
    [IDs.partnerOrg, IDs.adminUser, 'admin', 'active'],
    [IDs.partnerOrg, IDs.memberUser, 'member', 'active'],
    [IDs.partnerOrg, IDs.revokedUser, 'member', 'active'],
    [IDs.unboundPartnerOrg, IDs.unboundUser, 'owner', 'active'],
  ];
  for (const [partnerOrgId, userId, role, status] of partnerUsers) {
    await db.query(
      `INSERT INTO partner_users(id,partner_org_id,user_id,role,status,joined_at)
       VALUES (gen_random_uuid(),$1,$2,$3,$4,now())`,
      [partnerOrgId, userId, role, status]
    );
  }
  await db.query(
    `INSERT INTO partner_certifications
      (id,partner_org_id,user_id,certification_name,certification_type,status,progress_percent,
       started_at,completed_at,certificate_id)
     VALUES
      ($1,$2,$3,'Consultify Partner Foundation','foundation','in_progress',60,now()-interval '14 days',NULL,NULL),
      ($4,$2,$5,'Consultify Partner Foundation','foundation','completed',100,now()-interval '45 days',now()-interval '7 days','W3-PARTNER-CERT-001')`,
    [
      IDs.certificationProgress,
      IDs.partnerOrg,
      IDs.memberUser,
      IDs.certificationComplete,
      IDs.ownerUser,
    ]
  );
  await db.query(
    `INSERT INTO partner_attributions
      (id,partner_org_id,organization_id,attribution_type,referral_code_used,
       commission_rate_percent,status,attributed_at,utm_source)
     VALUES ($1,$2,$3,'REFERRAL_LINK','W3PARTNER',0,'PENDING',now(),'wave3-owner-review-non-economic')`,
    [IDs.attribution, IDs.partnerOrg, IDs.participantOrg]
  );
  await db.query(
    `INSERT INTO partner_participant_ledger
      (id,tenant_organization_id,partner_org_id,event_type,participant_organization_id,
       source_kind,source_id,source_version,source_digest,request_digest,source_ref,
       actor_id,idempotency_key,occurred_at)
     VALUES ($1,$2,$3,'referral.attributed',$4,'partner_attribution',$5,
       'partner-participant-referral-v1',$6,$7,$8::jsonb,$9,'wave3-owner-referral-001',now())`,
    [
      IDs.ledger,
      IDs.ownerOrg,
      IDs.partnerOrg,
      IDs.participantOrg,
      IDs.attribution,
      digest(sourceRef),
      digest({ tenant: IDs.ownerOrg, partner: IDs.partnerOrg, key: 'wave3-owner-referral-001' }),
      JSON.stringify(sourceRef),
      IDs.ownerUser,
    ]
  );
  await db.query('COMMIT');

  const readback = await db.query(
    `SELECT
      (SELECT COUNT(*)::int FROM partner_organizations WHERE id::text=$1 AND owner_organization_id::text=$2) bound_partner,
      (SELECT COUNT(*)::int FROM partner_certifications WHERE partner_org_id::text=$1) certifications,
      (SELECT COUNT(*)::int FROM partner_participant_ledger WHERE partner_org_id::text=$1) participant_facts,
      (SELECT COUNT(*)::int FROM partner_commission_transactions WHERE partner_org_id::text=$1) commissions,
      (SELECT COUNT(*)::int FROM partner_payouts WHERE partner_org_id::text=$1) payouts`,
    [IDs.partnerOrg, IDs.ownerOrg]
  );
  const negatives = await db.query(
    `SELECT
      (SELECT COUNT(*)::int FROM partner_organizations po JOIN partner_users pu ON pu.partner_org_id::text=po.id::text
        WHERE po.owner_organization_id::text=$1 AND pu.user_id::text=$2 AND lower(pu.status)='active') foreign_bound,
      (SELECT COUNT(*)::int FROM organization_members WHERE organization_id=$2 AND user_id=$3 AND upper(status)='ACTIVE') revoked_active,
      (SELECT COUNT(*)::int FROM partner_organizations WHERE id::text=$4 AND owner_organization_id IS NOT NULL) unbound_bound`,
    [IDs.foreignOrg, IDs.ownerUser, IDs.revokedUser, IDs.unboundPartnerOrg]
  );
  const row = readback.rows[0];
  const denied = negatives.rows[0];
  if (
    row.bound_partner !== 1 ||
    row.certifications !== 2 ||
    row.participant_facts !== 1 ||
    row.commissions !== 0 ||
    row.payouts !== 0 ||
    denied.foreign_bound !== 0 ||
    denied.revoked_active !== 0 ||
    denied.unbound_bound !== 0
  ) {
    throw new Error('Partner owner fixture independent readback failed');
  }

  const manifest = {
    schemaVersion: 1,
    fixture: 'wave3-partner-owner-review-v1',
    fixtureId,
    ownershipState: 'FINAL',
    ownershipNonce,
    databaseName,
    marker: { table: 'wave3_owner_fixture_markers', fixtureId, ownershipNonce },
    fixtureState: 'READY_FOR_LOCAL_OWNER_REVIEW',
    ownerReviewReady: true,
    database: { name: databaseName, disposable: true, loopbackOnly: true },
    deepLinkVerified: false,
    deepLinks: {
      partner: '/partner',
      anonymousReferral: '/r/w3-partner-owner',
    },
    personas: {
      owner: { email: emails.owner, organizationId: IDs.ownerOrg, userId: IDs.ownerUser },
      admin: { email: emails.admin, organizationId: IDs.ownerOrg, userId: IDs.adminUser },
      member: { email: emails.member, organizationId: IDs.ownerOrg, userId: IDs.memberUser },
      sameUserForeignTenant: { email: emails.owner, organizationId: IDs.foreignOrg },
      revoked: { email: emails.revoked, organizationId: IDs.ownerOrg },
      unbound: { email: emails.unbound, organizationId: IDs.ownerOrg },
      anonymousReferral: { authenticated: false, referralCode: 'W3PARTNER' },
    },
    partner: {
      organizationId: IDs.partnerOrg,
      profileState: 'active_certified',
      referralCode: 'W3PARTNER',
      certificationIds: [IDs.certificationProgress, IDs.certificationComplete],
      participantLedgerId: IDs.ledger,
      participantOrganizationId: IDs.participantOrg,
    },
    economics: {
      policyDisabled: true,
      historicalReadOnly: true,
      accrualEnabled: false,
      payoutEnabled: false,
      commissionsSeeded: 0,
      payoutsSeeded: 0,
    },
    negativeReadback: {
      sameUserForeignTenantBoundRows: denied.foreign_bound,
      revokedActiveMembershipRows: denied.revoked_active,
      unboundRowsWithOwner: denied.unbound_bound,
      economicRows: Number(row.commissions) + Number(row.payouts),
    },
    credentials: { storedInManifest: false, suppliedByEnvironment: true },
    reproducibility: {
      stableIds: true,
      manifestExclusiveCreate: true,
      resetCommand: 'rerun this script with --reset and the same guarded environment',
    },
  };
  fs.mkdirSync(path.dirname(path.resolve(manifestPath)), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  process.stdout.write(
    `${JSON.stringify({ fixture: manifest.fixture, manifestPath: path.resolve(manifestPath), readback: row })}\n`
  );
} catch (error) {
  try {
    await db.query('ROLLBACK');
  } catch {
    // no active transaction
  }
  throw error;
} finally {
  await db.end();
}
