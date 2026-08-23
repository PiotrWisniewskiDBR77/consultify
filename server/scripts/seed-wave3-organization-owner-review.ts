#!/usr/bin/env npx tsx
/**
 * Wave 3 / Organization — isolated owner-review fixture.
 *
 * ORGANIZATION_OWNER_FIXTURE_CONFIRM=YES \
 * ORGANIZATION_OWNER_FIXTURE_DATABASE_URL=postgresql://.../consultify_w3_organization_owner_demo \
 * ORGANIZATION_OWNER_FIXTURE_MANIFEST=/absolute/new/path/organization-owner.json \
 *   npx tsx server/scripts/seed-wave3-organization-owner-review.ts seed
 *
 * This fixture deliberately preserves ORG-Q-001: profile fields are populated
 * using their existing canonical names and order; no new IA groups are stored.
 */

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import bcrypt from 'bcryptjs';
import pg from 'pg';

const COMMAND = process.argv[2] || 'readback';
const TARGET_URL = process.env.ORGANIZATION_OWNER_FIXTURE_DATABASE_URL || '';
const CONFIRM = process.env.ORGANIZATION_OWNER_FIXTURE_CONFIRM;
const MANIFEST_PATH = process.env.ORGANIZATION_OWNER_FIXTURE_MANIFEST || '';
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const DB_PREFIX = 'consultify_w3_organization_owner_';

const IDS = Object.freeze({
  mainOrg: '16000000-0000-4000-8000-000000000001',
  foreignOrg: '16000000-0000-4000-8000-000000000002',
  owner: '16000000-0000-4000-8000-000000000011',
  member: '16000000-0000-4000-8000-000000000012',
  revoked: '16000000-0000-4000-8000-000000000013',
  foreignOwner: '16000000-0000-4000-8000-000000000014',
});

const USERS = Object.freeze([
  {
    id: IDS.owner,
    org: IDS.mainOrg,
    email: 'w3.organization.owner@local.test',
    role: 'OWNER',
    membership: 'ACTIVE',
    password: 'Wave3OrganizationOwner!2026',
  },
  {
    id: IDS.member,
    org: IDS.mainOrg,
    email: 'w3.organization.member@local.test',
    role: 'MEMBER',
    membership: 'ACTIVE',
    password: 'Wave3OrganizationMember!2026',
  },
  {
    id: IDS.revoked,
    org: IDS.mainOrg,
    email: 'w3.organization.revoked@local.test',
    role: 'MEMBER',
    membership: 'INACTIVE',
    password: 'Wave3OrganizationRevoked!2026',
  },
  {
    id: IDS.foreignOwner,
    org: IDS.foreignOrg,
    email: 'w3.organization.foreign.owner@local.test',
    role: 'OWNER',
    membership: 'ACTIVE',
    password: 'Wave3OrganizationForeign!2026',
  },
]);

const PROFILE = Object.freeze({
  companyName: 'Northstar Advisory Group',
  description:
    'Independent professional-services firm delivering strategy, operating-model and transformation programmes for industrial clients.',
  industry: 'Management Consulting',
  industry_code: 'M70.22',
  industry_subsector: 'Strategy and operations advisory',
  company_size: '51-200',
  employee_count: 128,
  annual_revenue: 18400000,
  headquarters_country: 'Poland',
  organization_type: 'SERVICES',
  revenue_model: 'Project fees and managed advisory retainers',
  delivery_model: 'Hybrid client-site and remote delivery',
  core_systems: ['Microsoft 365', 'HubSpot', 'Jira', 'Power BI'],
  founding_year: 2012,
  digital_budget_percent: 6.5,
  market_share_estimate: 2.4,
  key_competitors: ['Regional strategy boutiques', 'Global advisory firms'],
  customer_segments: ['Mid-market industrial companies', 'Private-equity portfolio companies'],
  primary_markets: ['Poland', 'DACH', 'Nordics'],
  regulatory_environment: ['GDPR', 'Client confidentiality requirements'],
  risk_appetite: 'Moderate; controlled experimentation with client-data safeguards',
  budget_constraints: 'Investment cases require partner approval above EUR 100k',
  timeline_constraints: 'Transformation waves must fit quarterly client steering cycles',
  communication_style: 'Concise, evidence-led and executive-ready',
  industry_jargon_level: 'Professional',
  mission_statement: 'Turn complex transformation choices into measurable client outcomes.',
  vision_statement: 'Be the most trusted evidence-led transformation partner in Central Europe.',
  competitive_position: 'Senior-led delivery with strong industrial and execution expertise',
  growth_stage: 'Scale-up',
  technology_stack: ['TypeScript', 'PostgreSQL', 'Power BI', 'Azure'],
  cloud_adoption_level: 'Hybrid cloud',
  currency: 'EUR',
  strategic_priorities: [
    'Standardise delivery IP',
    'Increase recurring revenue',
    'Strengthen data governance',
  ],
  preferred_language: 'en',
  profile_completeness: 94,
});

function fail(message: string): never {
  throw new Error(`[W3 Organization fixture] BLOCKED: ${message}`);
}

function context() {
  if (!TARGET_URL) fail('ORGANIZATION_OWNER_FIXTURE_DATABASE_URL is required');
  if (!['seed', 'readback', 'reset', 'verify-two-cycle'].includes(COMMAND))
    fail(`unknown command ${COMMAND}`);
  let target: URL;
  try {
    target = new URL(TARGET_URL);
  } catch {
    fail('fixture database URL is invalid');
  }
  if (!LOCAL_HOSTS.has(target.hostname)) fail(`database host ${target.hostname} is not local`);
  const databaseName = target.pathname.replace(/^\//, '');
  if (
    !databaseName.startsWith(DB_PREFIX) ||
    !/^consultify_w3_organization_owner_[a-z0-9_]+$/.test(databaseName)
  ) {
    fail(`database name must match ${DB_PREFIX}* using lowercase letters, digits and underscores`);
  }
  const admin = new URL(target);
  admin.pathname = '/postgres';
  if (COMMAND === 'seed' || COMMAND === 'reset' || COMMAND === 'verify-two-cycle') {
    if (!MANIFEST_PATH) fail('ORGANIZATION_OWNER_FIXTURE_MANIFEST is required for seed/reset');
    if (!path.isAbsolute(MANIFEST_PATH) || MANIFEST_PATH.includes('://'))
      fail('manifest path must be an absolute local path');
    if ((COMMAND === 'seed' || COMMAND === 'verify-two-cycle') && fs.existsSync(MANIFEST_PATH))
      fail('manifest path already exists; overwrite is refused');
    if (COMMAND === 'reset' && !fs.existsSync(MANIFEST_PATH))
      fail('owned reset requires the matching manifest');
  }
  return { admin, databaseName, manifestPath: MANIFEST_PATH };
}

function requireYes() {
  if (CONFIRM !== 'YES') fail('seed/reset requires ORGANIZATION_OWNER_FIXTURE_CONFIRM=YES');
}

async function databaseExists(client: pg.Client, name: string) {
  return (
    Number(
      (await client.query('SELECT count(*)::int n FROM pg_database WHERE datname=$1', [name]))
        .rows[0].n
    ) === 1
  );
}

function logicalReplayDigest(readback: Record<string, unknown>) {
  const stable = {
    fixture: 'W3-ORGANIZATION-OWNER-v1',
    stableIds: IDS,
    profile: PROFILE,
    claimSemantics: readback.claim_semantics,
    industryValues: readback.industry_values,
    snapshotSourceRefSemantics: Array.isArray(readback.snapshot_source_refs)
      ? (readback.snapshot_source_refs as any[])
          .map(({ sourceType, sourceDocId, fileHash, docVersion }) => ({
            sourceType,
            sourceDocId,
            fileHash,
            docVersion,
          }))
          .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
      : [],
    counts: {
      personas: readback.personas,
      activeMainMemberships: readback.active_main_memberships,
      revokedMemberships: readback.revoked_memberships,
      contextItems: readback.context_items,
      contextClaims: readback.context_claims,
      approvedClaims: readback.approved_claims,
      governedSnapshots: readback.governed_snapshots,
      conflicts: readback.conflicts,
    },
  };
  return crypto.createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}

function manifest(databaseName: string, nonce: string, readback: Record<string, unknown>) {
  return {
    fixture: 'W3-ORGANIZATION-OWNER-v1',
    fixtureId: 'W3-ORGANIZATION-OWNER-v1',
    ownershipState: 'FINAL',
    databaseName,
    deepLink: '/organization',
    deepLinkVerified: false,
    mobile: 'DEFERRED_NON_GATING',
    orgQ001: 'OPEN_NOT_ENCODED',
    ownershipNonce: nonce,
    marker: {
      table: 'wave3_owner_fixture_markers',
      fixtureId: 'W3-ORGANIZATION-OWNER-v1',
      ownershipNonce: nonce,
    },
    personas: USERS.map(({ password: _password, ...persona }) => persona),
    canonicalProfileSections: 'existing fields only; no fixture-defined grouping',
    provenance: {
      sourceTypes: ['organization_profile', 'interview_context'],
      governedSnapshot: true,
    },
    readiness: {
      profileCompletenessUiPercent: PROFILE.profile_completeness,
      interpretation: 'fixture presentation evidence, not a release gate',
    },
    negativePersonas: {
      member: 'ACTIVE_NON_OWNER',
      revoked: 'INACTIVE_MEMBERSHIP',
      foreign: 'FOREIGN_TENANT_OWNER',
    },
    logicalReplayDigest: logicalReplayDigest(readback),
    perRunSnapshotHash: readback.content_hash,
    replayContract:
      'logicalReplayDigest covers stable fixture IDs plus full intended profile/claim/conflict semantics; per-run generated claim/snapshot coordinates are reported separately and intentionally excluded',
    perRunCoordinates: { snapshotId: readback.snapshot_id, claimIds: readback.claim_ids },
    snapshotProof: {
      snapshotId: readback.snapshot_id,
      version: readback.snapshot_version,
      claimCount: readback.snapshot_claim_count,
      createdBy: readback.snapshot_created_by,
      contentHash: readback.content_hash,
      snapshotJsonHashVerified: readback.snapshot_hash_verified,
      sourceTypes: readback.snapshot_source_types,
    },
    coldCanonicalProfileApi: readback.cold_profile_api,
    readback,
  };
}

function persistManifest(manifestPath: string, payload: ReturnType<typeof manifest>) {
  const bytes = `${JSON.stringify(payload, null, 2)}\n`;
  const temporary = `${manifestPath}.final-${process.pid}`;
  let handle: number | undefined;
  try {
    handle = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(handle, bytes, 'utf8');
  } finally {
    if (handle !== undefined) fs.closeSync(handle);
  }
  fs.renameSync(temporary, manifestPath);
  const mode = fs.statSync(manifestPath).mode & 0o777;
  const persisted = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (
    mode !== 0o600 ||
    persisted.fixture !== 'W3-ORGANIZATION-OWNER-v1' ||
    persisted.fixtureId !== 'W3-ORGANIZATION-OWNER-v1' ||
    !/^[0-9a-f]{32,128}$/.test(persisted.ownershipNonce || '') ||
    persisted.marker?.table !== 'wave3_owner_fixture_markers' ||
    persisted.marker?.ownershipNonce !== persisted.ownershipNonce
  )
    fail('manifest verification failed');
  const serialized = JSON.stringify(persisted);
  for (const user of USERS)
    if (serialized.includes(user.password)) fail('manifest contains a fixture password');
  if (serialized.includes(TARGET_URL)) fail('manifest contains the database URL');
  return { path: manifestPath, bytes: Buffer.byteLength(bytes), mode: '0600' };
}

function writeProvisionalReceipt(manifestPath: string, databaseName: string, nonce: string) {
  const handle = fs.openSync(manifestPath, 'wx', 0o600);
  try {
    fs.writeFileSync(
      handle,
      `${JSON.stringify({ fixture: 'W3-ORGANIZATION-OWNER-v1', fixtureId: 'W3-ORGANIZATION-OWNER-v1', databaseName, ownershipNonce: nonce, marker: { table: 'wave3_owner_fixture_markers', fixtureId: 'W3-ORGANIZATION-OWNER-v1', ownershipNonce: nonce }, state: 'PROVISIONAL' }, null, 2)}\n`,
      'utf8'
    );
  } finally {
    fs.closeSync(handle);
  }
}

function markProvisionalFailure(manifestPath: string, error: unknown) {
  const receipt = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  receipt.state = 'FAILED_BEFORE_DURABLE_MARKER';
  receipt.error =
    error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500);
  const temporary = `${manifestPath}.failed-${process.pid}`;
  const handle = fs.openSync(temporary, 'wx', 0o600);
  try {
    fs.writeFileSync(handle, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  } finally {
    fs.closeSync(handle);
  }
  fs.renameSync(temporary, manifestPath);
}

async function writeOwnershipMarker(nonce: string) {
  const client = new pg.Client({ connectionString: TARGET_URL });
  await client.connect();
  try {
    await client.query(
      `CREATE TABLE public.wave3_owner_fixture_markers (fixture_id TEXT PRIMARY KEY, ownership_nonce TEXT NOT NULL, database_name TEXT NOT NULL)`
    );
    await client.query(
      `INSERT INTO public.wave3_owner_fixture_markers(fixture_id,ownership_nonce,database_name) VALUES('W3-ORGANIZATION-OWNER-v1',$1,current_database())`,
      [nonce]
    );
  } finally {
    await client.end();
  }
}

async function seedBase() {
  const client = new pg.Client({ connectionString: TARGET_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO organizations(id,name,plan,status) VALUES($1,$2,'enterprise','active'),($3,$4,'enterprise','active')`,
      [IDS.mainOrg, PROFILE.companyName, IDS.foreignOrg, 'W3 Organization Foreign Boundary']
    );
    for (const user of USERS) {
      const hash = await bcrypt.hash(user.password, 10);
      await client.query(
        `INSERT INTO users(id,organization_id,email,password,first_name,last_name,role,status,language,timezone)
         VALUES($1,$2,$3,$4,$5,'Organization Fixture',$6,'active','en','Europe/Warsaw')`,
        [user.id, user.org, user.email, hash, user.role === 'OWNER' ? 'Owner' : 'Member', user.role]
      );
      await client.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,$4,$5)`,
        [`membership-${user.id}`, user.org, user.id, user.role, user.membership]
      );
    }
    await client.query(
      `INSERT INTO organization_profiles
       (id,organization_id,industry,company_size,employee_count,annual_revenue,headquarters_country,
        strategic_priorities,preferred_language,profile_completeness,organization_type,revenue_model,
        delivery_model,core_systems,founding_year,digital_budget_percent,market_share_estimate,
        key_competitors,customer_segments,primary_markets,regulatory_environment,risk_appetite,
        budget_constraints,timeline_constraints,communication_style,industry_jargon_level,
        mission_statement,vision_statement,competitive_position,growth_stage,technology_stack,
        cloud_adoption_level,industry_code,industry_subsector,currency)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35)`,
      [
        '16000000-0000-4000-8000-000000000021',
        IDS.mainOrg,
        PROFILE.industry,
        PROFILE.company_size,
        PROFILE.employee_count,
        PROFILE.annual_revenue,
        PROFILE.headquarters_country,
        JSON.stringify(PROFILE.strategic_priorities),
        PROFILE.preferred_language,
        PROFILE.profile_completeness,
        PROFILE.organization_type,
        PROFILE.revenue_model,
        PROFILE.delivery_model,
        JSON.stringify(PROFILE.core_systems),
        PROFILE.founding_year,
        PROFILE.digital_budget_percent,
        PROFILE.market_share_estimate,
        JSON.stringify(PROFILE.key_competitors),
        JSON.stringify(PROFILE.customer_segments),
        JSON.stringify(PROFILE.primary_markets),
        JSON.stringify(PROFILE.regulatory_environment),
        PROFILE.risk_appetite,
        PROFILE.budget_constraints,
        PROFILE.timeline_constraints,
        PROFILE.communication_style,
        PROFILE.industry_jargon_level,
        PROFILE.mission_statement,
        PROFILE.vision_statement,
        PROFILE.competitive_position,
        PROFILE.growth_stage,
        JSON.stringify(PROFILE.technology_stack),
        PROFILE.cloud_adoption_level,
        PROFILE.industry_code,
        PROFILE.industry_subsector,
        PROFILE.currency,
      ]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

async function seedCanonicalContext() {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DB_TYPE: 'postgres',
    MOCK_DB: 'false',
    RUN_DB_TESTS: '1',
    POSTGRES_SKIP_INIT_IN_TEST: '1',
    DATABASE_URL: TARGET_URL,
  });
  const database = await import('../src/database/Database.js');
  const postgresDatabase = (await import('../src/database/PostgresDatabase.js')).default;
  await database.resetConnection();
  const { default: service } =
    await import('../src/services/organizationContext/OrganizationContextService.js');

  await service.recordOrganizationProfile({
    organizationId: IDS.mainOrg,
    userId: IDS.owner,
    payload: PROFILE,
  });
  await service.recordContextSource({
    organizationId: IDS.mainOrg,
    sourceType: 'interview_context',
    sourceId: 'w3-organization-owner-interview-v1',
    authorUserId: IDS.owner,
    channel: 'interview',
    sourceLabel: 'Partner interview — market classification check',
    content: {
      note: 'A partner also describes the firm as an industrial transformation specialist.',
    },
    claims: [
      {
        claimPath: 'profile.industry',
        value: 'Industrial transformation advisory',
        confidence: 0.78,
        claimType: 'observation',
      },
    ],
  });

  const claims = await service.listGovernedClaims(IDS.mainOrg, {
    includeRestricted: true,
    limit: 500,
  });
  if (claims.length < 10) fail(`canonical profile produced too few claims: ${claims.length}`);
  for (const claim of claims) {
    const decision = await service.approveClaim(
      IDS.mainOrg,
      claim.claimId,
      IDS.owner,
      'Approved for isolated Wave 3 owner-review fixture'
    );
    if (!decision || decision.reviewState !== 'approved')
      fail(`claim approval failed for ${claim.claimId}`);
  }
  const published = await service.publishSnapshotVersion(IDS.mainOrg, IDS.owner);
  const reread = await service.getSnapshotVersion(IDS.mainOrg, published.version, {
    includeRestricted: true,
  });
  if (
    !reread ||
    reread.contentHash !== published.contentHash ||
    reread.claimCount !== claims.length
  )
    fail('canonical snapshot return/getSnapshotVersion integrity mismatch');
  await database.resetConnection();
  await postgresDatabase.close();
}

async function coldProfileApiProof() {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DB_TYPE: 'postgres',
    MOCK_DB: 'false',
    POSTGRES_SKIP_INIT_IN_TEST: '1',
    DATABASE_URL: TARGET_URL,
  });
  const [
    { default: express },
    { default: request },
    { default: jwt },
    { default: config },
    database,
    postgresDatabaseModule,
  ] = await Promise.all([
    import('express'),
    import('supertest'),
    import('jsonwebtoken'),
    import('../src/config/Config.js'),
    import('../src/database/Database.js'),
    import('../src/database/PostgresDatabase.js'),
  ]);
  await database.resetConnection();
  const { default: router } =
    await import('../src/routes/organization/organization-profiles.routes.js');
  const app = express();
  app.use(express.json());
  app.use('/', router);
  const token = jwt.sign(
    { id: IDS.owner, organizationId: IDS.mainOrg, role: 'OWNER', email: USERS[0].email },
    config.JWT_SECRET,
    { expiresIn: '5m' }
  );
  const response = await request(app)
    .get(`/${IDS.mainOrg}`)
    .set('Authorization', `Bearer ${token}`);
  if (
    response.status !== 200 ||
    response.body?.profile?.organization_type !== 'SERVICES' ||
    response.body?.completeness !== 60
  )
    fail(
      `cold canonical profile API mismatch: ${response.status} ${JSON.stringify(response.body)}`
    );
  await database.resetConnection();
  await postgresDatabaseModule.default.close();
  return {
    status: response.status,
    organization_type: response.body.profile.organization_type,
    profileCompletenessUiPercent: PROFILE.profile_completeness,
    apiCalculatedCompleteness: response.body.completeness,
    companySize: response.body.profile.companySize,
    industry: response.body.profile.industry,
  };
}

async function readback({ databaseName }: { databaseName: string }) {
  const client = new pg.Client({ connectionString: TARGET_URL });
  await client.connect();
  try {
    const result = await client.query(
      `SELECT
       (SELECT count(*)::int FROM users WHERE id=ANY($1::text[])) personas,
       (SELECT count(*)::int FROM organization_members WHERE organization_id=$2 AND status='ACTIVE') active_main_memberships,
       (SELECT count(*)::int FROM organization_members WHERE organization_id=$2 AND user_id=$3 AND status='INACTIVE') revoked_memberships,
       (SELECT count(*)::int FROM organization_members WHERE organization_id=$4 AND user_id=$5 AND status='ACTIVE') foreign_memberships,
       (SELECT count(*)::int FROM organization_profiles WHERE organization_id=$2 AND organization_type='SERVICES' AND profile_completeness=94) profiles,
       (SELECT count(*)::int FROM organization_context_items WHERE organization_id=$2) context_items,
       (SELECT count(*)::int FROM organization_context_claims WHERE organization_id=$2) context_claims,
       (SELECT count(*)::int FROM organization_context_claim_reviews WHERE organization_id=$2 AND review_state='approved') approved_claims,
       (SELECT count(*)::int FROM organization_context_snapshot_versions WHERE organization_id=$2) governed_snapshots,
       (SELECT count(DISTINCT value_json)::int FROM organization_context_claims WHERE organization_id=$2 AND claim_path='profile.industry') conflicts,
       (SELECT json_agg(value_json ORDER BY value_json) FROM organization_context_claims WHERE organization_id=$2 AND claim_path='profile.industry') industry_values,
       (SELECT json_agg(json_build_object('path',c.claim_path,'value',c.value_json,'sourceType',i.source_type,'sourceId',i.source_id,'confidence',c.confidence,'visibility',i.visibility_scope,'reviewState',r.review_state,'reviewActor',r.decided_by) ORDER BY c.claim_path,c.value_json,i.source_type) FROM organization_context_claims c JOIN organization_context_items i ON i.id=c.item_id LEFT JOIN organization_context_claim_reviews r ON r.claim_id=c.id WHERE c.organization_id=$2) claim_semantics,
       (SELECT version FROM organization_context_snapshot_versions WHERE organization_id=$2) snapshot_version,
       (SELECT id FROM organization_context_snapshot_versions WHERE organization_id=$2) snapshot_id,
       (SELECT claim_count FROM organization_context_snapshot_versions WHERE organization_id=$2) snapshot_claim_count,
       (SELECT created_by FROM organization_context_snapshot_versions WHERE organization_id=$2) snapshot_created_by,
       (SELECT content_hash FROM organization_context_snapshot_versions WHERE organization_id=$2) content_hash,
       (SELECT snapshot_json FROM organization_context_snapshot_versions WHERE organization_id=$2) snapshot_json,
       (SELECT source_refs_json FROM organization_context_snapshot_versions WHERE organization_id=$2) snapshot_source_refs,
       (SELECT json_agg(DISTINCT source_type ORDER BY source_type) FROM organization_context_items WHERE organization_id=$2) snapshot_source_types,
       (SELECT json_agg(id ORDER BY id) FROM organization_context_claims WHERE organization_id=$2) claim_ids,
       (SELECT ownership_nonce FROM public.wave3_owner_fixture_markers WHERE fixture_id='W3-ORGANIZATION-OWNER-v1' AND database_name=current_database()) ownership_nonce,
       (SELECT count(*)::int FROM schema_migrations WHERE status='success') successful_migrations`,
      [USERS.map((user) => user.id), IDS.mainOrg, IDS.revoked, IDS.foreignOrg, IDS.foreignOwner]
    );
    const rb = result.rows[0];
    rb.snapshot_source_refs = JSON.parse(String(rb.snapshot_source_refs));
    rb.snapshot_hash_verified =
      crypto.createHash('sha256').update(String(rb.snapshot_json)).digest('hex') ===
      rb.content_hash;
    if (
      !rb.snapshot_hash_verified ||
      Number(rb.snapshot_version) !== 1 ||
      Number(rb.snapshot_claim_count) !== Number(rb.context_claims) ||
      rb.snapshot_created_by !== IDS.owner
    )
      fail('direct snapshot row integrity mismatch');
    const parsedIndustry = (rb.industry_values as string[])
      .map((value) => JSON.parse(value))
      .sort();
    const expectedIndustry = ['Industrial transformation advisory', 'Management Consulting'].sort();
    if (JSON.stringify(parsedIndustry) !== JSON.stringify(expectedIndustry))
      fail('industry conflict values are not exact');
    rb.industry_values = parsedIndustry;
    rb.cold_profile_api = await coldProfileApiProof();
    const exact = {
      personas: 4,
      active_main_memberships: 2,
      revoked_memberships: 1,
      foreign_memberships: 1,
      profiles: 1,
      context_items: 2,
      governed_snapshots: 1,
      conflicts: 2,
    };
    for (const [key, expected] of Object.entries(exact))
      if (Number(rb[key]) !== expected)
        fail(`readback ${key} expected ${expected}, got ${rb[key]}`);
    if (Number(rb.context_claims) < 10 || Number(rb.approved_claims) !== Number(rb.context_claims))
      fail('claim governance readback mismatch');
    if (Number(rb.successful_migrations) !== 831)
      fail(`fresh migration ledger expected exactly 831, got ${rb.successful_migrations}`);
    const payload = manifest(databaseName, String(rb.ownership_nonce), rb);
    if (payload.logicalReplayDigest !== logicalReplayDigest(rb))
      fail('logical replay digest is not deterministic');
    console.log(JSON.stringify(payload, null, 2));
    return payload;
  } finally {
    await client.end();
  }
}

async function seed(ctx: ReturnType<typeof context>) {
  requireYes();
  const nonce = crypto.randomBytes(32).toString('hex');
  writeProvisionalReceipt(ctx.manifestPath, ctx.databaseName, nonce);
  let createdByThisInvocation = false;
  let durableMarkerWritten = false;
  try {
    const admin = new pg.Client({ connectionString: ctx.admin.toString() });
    await admin.connect();
    try {
      if (await databaseExists(admin, ctx.databaseName))
        fail('target database already exists; reset it first');
      await admin.query(`CREATE DATABASE "${ctx.databaseName}"`);
      createdByThisInvocation = true;
    } finally {
      await admin.end();
    }
    if (process.env.ORGANIZATION_OWNER_FIXTURE_INJECT_AFTER_CREATE_BEFORE_MARKER === 'YES')
      throw new Error('INJECTED_AFTER_CREATE_BEFORE_MARKER');
    await writeOwnershipMarker(nonce);
    durableMarkerWritten = true;
  } catch (error) {
    if (createdByThisInvocation && !durableMarkerWritten) {
      const cleanup = new pg.Client({ connectionString: ctx.admin.toString() });
      await cleanup.connect();
      try {
        await cleanup.query(`DROP DATABASE IF EXISTS "${ctx.databaseName}" WITH (FORCE)`);
      } finally {
        await cleanup.end();
      }
    }
    markProvisionalFailure(ctx.manifestPath, error);
    throw error;
  }
  const migration = spawnSync('npm', ['run', 'db:migrate:strict'], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: 'test', DB_TYPE: 'postgres', DATABASE_URL: TARGET_URL },
    encoding: 'utf8',
  });
  if (migration.status !== 0) fail(`migration failed: ${migration.stderr || migration.stdout}`);
  await seedBase();
  await seedCanonicalContext();
  const first = await readback(ctx);
  const second = await readback(ctx);
  if (second.ownershipNonce !== nonce)
    fail('manifest/database ownership nonce mismatch before persist');
  if (first.logicalReplayDigest !== second.logicalReplayDigest)
    fail('two logical readbacks produced different digests');
  console.log(
    JSON.stringify({ manifestWritten: persistManifest(ctx.manifestPath, second) }, null, 2)
  );
}

async function reset(ctx: ReturnType<typeof context>) {
  requireYes();
  const client = new pg.Client({ connectionString: ctx.admin.toString() });
  await client.connect();
  try {
    if (!(await databaseExists(client, ctx.databaseName)))
      fail('owned reset target database is absent');
    const stat = fs.statSync(ctx.manifestPath);
    if ((stat.mode & 0o777) !== 0o600) fail('owned reset manifest mode is not 0600');
    const persisted = JSON.parse(fs.readFileSync(ctx.manifestPath, 'utf8'));
    const target = new pg.Client({ connectionString: TARGET_URL });
    await target.connect();
    let marker: string | undefined;
    try {
      marker = (
        await target.query(
          `SELECT ownership_nonce FROM public.wave3_owner_fixture_markers WHERE fixture_id='W3-ORGANIZATION-OWNER-v1' AND database_name=current_database()`
        )
      ).rows[0]?.ownership_nonce;
    } finally {
      await target.end();
    }
    if (
      !marker ||
      persisted?.ownershipNonce !== marker ||
      persisted?.databaseName !== ctx.databaseName
    )
      fail('owned reset refused: durable database marker and manifest binding do not match');
    await client.query(`DROP DATABASE "${ctx.databaseName}" WITH (FORCE)`);
    console.log(
      JSON.stringify(
        {
          fixture: 'W3-ORGANIZATION-OWNER-v1',
          databaseName: ctx.databaseName,
          dropped: true,
          catalogAbsent: !(await databaseExists(client, ctx.databaseName)),
        },
        null,
        2
      )
    );
  } finally {
    await client.end();
  }
}

async function verifyTwoCycle(ctx: ReturnType<typeof context>) {
  requireYes();
  const attempted: Array<{ suffix: string; url: string; manifestPath: string }> = [];
  const results: any[] = [];
  const errors: Error[] = [];
  try {
    for (const suffix of ['cycle_a', 'cycle_b']) {
      const url = new URL(TARGET_URL);
      url.pathname = `/${ctx.databaseName}_${suffix}`;
      const manifestPath = `${ctx.manifestPath}.${suffix}.json`;
      attempted.push({ suffix, url: url.toString(), manifestPath });
      if (fs.existsSync(manifestPath)) {
        errors.push(new Error(`two-cycle manifest already exists: ${manifestPath}`));
        continue;
      }
      const common = {
        ...process.env,
        ORGANIZATION_OWNER_FIXTURE_CONFIRM: 'YES',
        ORGANIZATION_OWNER_FIXTURE_DATABASE_URL: url.toString(),
        ORGANIZATION_OWNER_FIXTURE_MANIFEST: manifestPath,
      };
      const seeded = spawnSync('npx', ['tsx', path.resolve(process.argv[1]), 'seed'], {
        cwd: process.cwd(),
        env: common,
        encoding: 'utf8',
      });
      if (seeded.status !== 0) {
        errors.push(
          new Error(`two-cycle ${suffix} seed failed: ${seeded.stderr || seeded.stdout}`)
        );
        continue;
      }
      results.push(JSON.parse(fs.readFileSync(manifestPath, 'utf8')));
    }
    if (results.length === 2 && results[0].logicalReplayDigest !== results[1].logicalReplayDigest)
      errors.push(new Error('two-cycle semantic digests differ'));
    if (results.length === 2 && results[0].perRunSnapshotHash === results[1].perRunSnapshotHash)
      errors.push(new Error('two-cycle per-run snapshot hashes unexpectedly match'));
    console.log(
      JSON.stringify(
        {
          fixture: 'W3-ORGANIZATION-OWNER-v1',
          command: 'verify-two-cycle',
          semanticDigest: results[0]?.logicalReplayDigest,
          cycles: results.map((r) => ({
            databaseName: r.databaseName,
            manifest: {
              fixtureId: r.fixtureId,
              ownershipNonce: r.ownershipNonce,
              marker: r.marker,
            },
            snapshotHash: r.perRunSnapshotHash,
          })),
        },
        null,
        2
      )
    );
  } finally {
    for (const receipt of attempted) {
      if (!fs.existsSync(receipt.manifestPath)) continue;
      let catalog: pg.Client | null = null;
      let knownAbsent = false;
      try {
        const targetUrl = new URL(receipt.url);
        const attemptedDbName = targetUrl.pathname.replace(/^\//, '');
        targetUrl.pathname = '/postgres';
        catalog = new pg.Client({ connectionString: targetUrl.toString() });
        await catalog.connect();
        if (process.env.ORGANIZATION_OWNER_FIXTURE_INJECT_PREFLIGHT_FAILURE === receipt.suffix)
          throw new Error(`injected catalog preflight failure for ${receipt.suffix}`);
        knownAbsent = !(await databaseExists(catalog, attemptedDbName));
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      } finally {
        if (catalog)
          await catalog
            .end()
            .catch((error) =>
              errors.push(error instanceof Error ? error : new Error(String(error)))
            );
      }
      if (knownAbsent) continue;
      try {
        const cleaned = spawnSync('npx', ['tsx', path.resolve(process.argv[1]), 'reset'], {
          cwd: process.cwd(),
          env: {
            ...process.env,
            ORGANIZATION_OWNER_FIXTURE_CONFIRM: 'YES',
            ORGANIZATION_OWNER_FIXTURE_DATABASE_URL: receipt.url,
            ORGANIZATION_OWNER_FIXTURE_MANIFEST: receipt.manifestPath,
          },
          encoding: 'utf8',
        });
        if (cleaned.status !== 0)
          errors.push(
            new Error(
              `two-cycle cleanup failed for ${receipt.url}: ${cleaned.stderr || cleaned.stdout}`
            )
          );
        else if (process.env.ORGANIZATION_OWNER_FIXTURE_INJECT_CLEANUP_FAILURE === receipt.suffix)
          errors.push(
            new Error(`injected cleanup failure after verified drop for ${receipt.suffix}`)
          );
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }
  if (errors.length) throw new AggregateError(errors, 'verify-two-cycle failed');
}

const ctx = context();
if (COMMAND === 'seed') await seed(ctx);
else if (COMMAND === 'readback') await readback(ctx);
else if (COMMAND === 'reset') await reset(ctx);
else await verifyTwoCycle(ctx);
