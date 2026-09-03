import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import bcrypt from 'bcryptjs';
import express, { type Express } from 'express';
import { Client as PgClient } from 'pg';

// Dyżur "resztki fundamentu" (2026-09-03, worktree agent/resztki-fundamentu-20260903,
// marker 00f8e9dd65). Adapted from server/src/scripts/g05-przelot.ts's proven method
// (fresh PostgreSQL, real ApiGateway via npx tsx — never vitest, which stubs fetch;
// cold read = brand-new login + Connection: close; field-by-field comparison, never
// the write response, since Database.ts:686 returns changes:1 for every UPDATE).
// Scoped to the two genuinely open (non-owner-decision) G00-G05 gaps found by
// scripts/wave3/report-acceptance-gates.mjs on this checkout:
//   - 15_SETTINGS G02 (delegated notification-preferences write/readback)
//   - 16_PARTNER  G05 (write path from an org BOUND to a partner_organizations row)
const REQUIRED_ENV: Record<string, string> = {
  RUN_DB_TESTS: '1',
  MOCK_DB: 'false',
  DB_TYPE: 'postgres',
  NODE_ENV: 'test',
  ENABLE_V8_GLOBAL: 'true',
  ENABLE_TEST_AUTH_BYPASS: 'false',
  CI: 'true',
};

for (const [name, expected] of Object.entries(REQUIRED_ENV)) {
  assert.equal(process.env[name], expected, `${name} must equal ${expected}`);
}

const ALLOWED_DATABASE_URL = 'postgresql://cx:cx@127.0.0.1:6290/cxresztki';
assert.equal(
  process.env.DATABASE_URL,
  ALLOWED_DATABASE_URL,
  `DATABASE_URL must be this dyżur's own disposable database: ${ALLOWED_DATABASE_URL}`
);
assert.ok(process.env.JWT_SECRET, 'JWT_SECRET must be set');

const port = Number(process.env.PORT || '5302');
assert.ok([5302, 5303].includes(port), 'Harness may only use ports 5302 or 5303 (this dyżur only)');

async function withPg<T>(fn: (client: PgClient) => Promise<T>): Promise<T> {
  const client = new PgClient({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

type Json = Record<string, any>;

async function requestJson(
  method: string,
  path: string,
  options: { token?: string; body?: Json; headers?: Record<string, string> } = {}
): Promise<{ status: number; body: Json }> {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      Connection: 'close',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  let body: Json;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  return { status: response.status, body };
}

const PASSWORD = 'Resztki-Local-Only-Password-1';

async function register(email: string, companyName: string): Promise<Json> {
  const result = await requestJson('POST', '/api/auth/register', {
    body: {
      email,
      password: PASSWORD,
      firstName: 'Resztki',
      lastName: 'Fundamentu',
      companyName,
      isDemo: true,
    },
  });
  assert.equal(result.status, 200, `registration failed: ${JSON.stringify(result.body)}`);
  assert.ok(result.body.user?.organizationId);
  return result.body;
}

async function login(email: string, password = PASSWORD): Promise<{ token: string; userId: string }> {
  const result = await requestJson('POST', '/api/auth/login', { body: { email, password } });
  assert.equal(result.status, 200, `login failed: ${JSON.stringify(result.body)}`);
  assert.ok(result.body.token, 'login did not issue a fresh access token');
  return { token: result.body.token as string, userId: result.body.user?.id as string };
}

// ---------------------------------------------------------------------------
// SETTINGS G02 — delegated notification-preferences write/readback.
// server/src/routes/settings.routes.ts:1132-1191 (POST /api/settings/notifications):
// pulls actor role + target status FROM organization_members (not the token),
// requires actor role owner/admin when userId != requesterId, requires target
// status ACTIVE. GET /api/settings/notifications (:1094) reads the same row
// back for the authenticated caller.
// ---------------------------------------------------------------------------
async function runSettingsG02(): Promise<void> {
  const nonce = Date.now();
  const ownerEmail = `resztki-set-owner-${nonce}@local.test`;
  const registered = await register(ownerEmail, `Resztki Settings Org ${nonce}`);
  const organizationId = registered.user.organizationId as string;
  const ownerUserId = registered.user.id as string;

  // Fixture setup only (mirrors how other Wave 3 owner-review seed scripts add
  // teammates by direct row insert): a MEMBER target for the positive case, a
  // MEMBER actor for the negative "non-admin delegator" case, and a REVOKED
  // target for the negative "inactive target" case. Passwords are bcrypt-hashed
  // exactly like the real registration path so each can log in for real.
  const targetEmail = `resztki-set-target-${nonce}@local.test`;
  const memberActorEmail = `resztki-set-memberactor-${nonce}@local.test`;
  const revokedTargetEmail = `resztki-set-revoked-${nonce}@local.test`;
  const targetPassword = 'Resztki-Target-Password-1';
  const memberActorPassword = 'Resztki-MemberActor-Password-1';
  const revokedPassword = 'Resztki-Revoked-Password-1';

  const targetUserId = crypto.randomUUID();
  const memberActorUserId = crypto.randomUUID();
  const revokedTargetUserId = crypto.randomUUID();

  await withPg(async (c) => {
    for (const [id, email, password] of [
      [targetUserId, targetEmail, targetPassword],
      [memberActorUserId, memberActorEmail, memberActorPassword],
      [revokedTargetUserId, revokedTargetEmail, revokedPassword],
    ] as const) {
      const hash = await bcrypt.hash(password, 10);
      await c.query(
        `INSERT INTO users(id, organization_id, email, password, first_name, last_name, role, status)
         VALUES ($1,$2,$3,$4,'Resztki','Fixture','USER','active')`,
        [id, organizationId, email, hash]
      );
    }
    await c.query(
      `INSERT INTO organization_members(id, organization_id, user_id, role, status) VALUES
        (gen_random_uuid()::text,$1,$2,'MEMBER','ACTIVE'),
        (gen_random_uuid()::text,$1,$3,'MEMBER','ACTIVE'),
        (gen_random_uuid()::text,$1,$4,'MEMBER','REVOKED')`,
      [organizationId, targetUserId, memberActorUserId, revokedTargetUserId]
    );
  });

  const results: Json = {};

  // --- Positive: OWNER delegates a write onto an ACTIVE teammate. ---
  const owner = await login(ownerEmail);
  const sentPreferences = {
    channels: { email: true, sms: false, push: true },
    quietHours: { start: '08:15', end: '17:45' },
    marker: `resztki-g02-${nonce}`,
  };
  const write = await requestJson('POST', '/api/settings/notifications', {
    token: owner.token,
    body: { userId: targetUserId, preferences: sentPreferences },
  });

  // Cold DB read: independent connection, field-by-field, not the write response.
  const dbRow = await withPg((c) =>
    c.query(`SELECT value FROM user_preferences WHERE user_id = $1 AND key = $2`, [
      targetUserId,
      'settings:notifications-channel-admin',
    ])
  );
  const dbPreferences = dbRow.rows[0]?.value ? JSON.parse(dbRow.rows[0].value) : null;

  // Cold API read: brand-new login as the TARGET (not the writer), Connection: close.
  const targetLogin = await login(targetEmail, targetPassword);
  const apiRead = await requestJson('GET', '/api/settings/notifications', { token: targetLogin.token });

  results.positiveDelegatedWrite = {
    write: { status: write.status, body: write.body },
    dbColdRead: { rowFound: !!dbRow.rows[0], value: dbPreferences },
    apiColdRead: { status: apiRead.status, body: apiRead.body },
    dbMatchesSent: JSON.stringify(dbPreferences) === JSON.stringify(sentPreferences),
    apiMatchesSent: JSON.stringify(apiRead.body) === JSON.stringify(sentPreferences),
  };

  // --- Negative 1: MEMBER (non-owner/admin) attempts a delegated write. ---
  const memberActor = await login(memberActorEmail, memberActorPassword);
  const deniedByRole = await requestJson('POST', '/api/settings/notifications', {
    token: memberActor.token,
    body: { userId: targetUserId, preferences: { marker: `resztki-g02-denied-role-${nonce}` } },
  });
  const dbRowAfterRoleDenial = await withPg((c) =>
    c.query(`SELECT value FROM user_preferences WHERE user_id = $1 AND key = $2`, [
      targetUserId,
      'settings:notifications-channel-admin',
    ])
  );
  results.negativeNonAdminActor = {
    status: deniedByRole.status,
    body: deniedByRole.body,
    refused: deniedByRole.status === 403,
    // The prior (positive) value must still be the one on disk - the denied
    // write must not have landed.
    databaseUnchanged:
      JSON.stringify(JSON.parse(dbRowAfterRoleDenial.rows[0]?.value || 'null')) ===
      JSON.stringify(sentPreferences),
  };

  // --- Negative 2: OWNER attempts a delegated write onto a REVOKED target. ---
  const deniedByTargetStatus = await requestJson('POST', '/api/settings/notifications', {
    token: owner.token,
    body: { userId: revokedTargetUserId, preferences: { marker: `resztki-g02-denied-target-${nonce}` } },
  });
  const dbRowRevokedTarget = await withPg((c) =>
    c.query(`SELECT value FROM user_preferences WHERE user_id = $1 AND key = $2`, [
      revokedTargetUserId,
      'settings:notifications-channel-admin',
    ])
  );
  results.negativeInactiveTarget = {
    status: deniedByTargetStatus.status,
    body: deniedByTargetStatus.body,
    refused: deniedByTargetStatus.status === 403,
    databaseUntouched: dbRowRevokedTarget.rows.length === 0,
  };

  console.log(JSON.stringify({ phase: 'SETTINGS-G02', organizationId, ownerUserId, results }, null, 2));
}

// ---------------------------------------------------------------------------
// PARTNER G05 — write path from an org BOUND to partner_organizations.
// server/src/routes/v8/partner.routes.ts:1368 (PUT /organization) writes
// contact_phone/website via getBoundPartnerOrgId(req), which resolves through
// getActivePartnerOrgIdForTenantUser(organizationId, userId). The prior
// measurement (g05-przelot.ts runR6) only tried a freshly self-registered,
// UNBOUND org and correctly got 403 PARTNER_ORG_REQUIRED. This phase runs the
// same kind of probe against the OWNER persona from
// server/scripts/seed-wave3-partner-owner-review.ts, whose org IS bound.
// ---------------------------------------------------------------------------
async function runPartnerG05(): Promise<void> {
  const ownerEmail = 'wave3.partner.owner.20260821@local.test';
  const ownerPassword = process.env.PARTNER_OWNER_FIXTURE_PASSWORD;
  assert.ok(ownerPassword, 'PARTNER_OWNER_FIXTURE_PASSWORD must be set (same value used to seed the fixture)');
  const partnerOrgId = 'b1620000-0000-4000-8000-000000000001';

  const results: Json = {};

  const owner = await login(ownerEmail, ownerPassword!);
  const nonce = Date.now();
  const sentPhone = `+48-resztki-${nonce}`;
  const sentWebsite = `https://resztki-g05-${nonce}.example.test`;

  const write = await requestJson('PUT', '/api/v8/partner/organization', {
    token: owner.token,
    body: { contactPhone: sentPhone, website: sentWebsite },
  });

  // Cold DB read: independent connection, field-by-field, not the write response.
  const dbRow = await withPg((c) =>
    c.query(`SELECT contact_phone, website FROM partner_organizations WHERE id = $1`, [partnerOrgId])
  );

  results.boundOwnerWrite = {
    write: { status: write.status, body: write.body },
    dbColdRead: dbRow.rows[0] || null,
    matchPhone: dbRow.rows[0]?.contact_phone === sentPhone,
    matchWebsite: dbRow.rows[0]?.website === sentWebsite,
  };

  // Negative control (repeat of the prior measurement, kept here for a single
  // self-contained record): a freshly self-registered, UNBOUND org gets the
  // same 403 PARTNER_ORG_REQUIRED as before.
  const freshEmail = `resztki-partner-fresh-${nonce}@local.test`;
  const registered = await register(freshEmail, `Resztki Partner Fresh Org ${nonce}`);
  const freshLogin = await login(freshEmail);
  const legacyAttempt = await requestJson('PUT', '/api/partners/organization', {
    token: freshLogin.token,
    body: { name: 'Resztki Fresh Partner', contactEmail: freshEmail },
  });
  const v8Attempt = await requestJson('PUT', '/api/v8/partner/organization', {
    token: freshLogin.token,
    body: { contactPhone: '+1-should-not-write', website: 'https://should-not-write.example.test' },
  });
  results.negativeUnboundFreshOrg = {
    organizationId: registered.user.organizationId,
    legacy: { status: legacyAttempt.status, body: legacyAttempt.body },
    v8: { status: v8Attempt.status, body: v8Attempt.body },
    legacyGone: legacyAttempt.status === 410,
    v8Refused: v8Attempt.status === 403 && v8Attempt.body?.code === 'PARTNER_ORG_REQUIRED',
  };

  console.log(JSON.stringify({ phase: 'PARTNER-G05', results }, null, 2));
}

async function main(): Promise<void> {
  const app: Express = express();
  app.use(express.json({ limit: '2mb' }));

  const { ApiGateway } = await import('../Gateway.js');
  ApiGateway.getInstance().initializeRoutes(app);
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[resztki] unhandled route error', error);
    res.status(500).json({ error: 'resztki_harness_error', detail: String(error) });
  });

  const server = app.listen(port, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const phase = process.env.RESZTKI_PHASE || 'SETTINGS';

  try {
    if (phase === 'SETTINGS') await runSettingsG02();
    else if (phase === 'PARTNER') await runPartnerG05();
    else throw new Error(`unknown phase ${phase}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error('[resztki] FAILED', error);
    process.exit(1);
  }
);
