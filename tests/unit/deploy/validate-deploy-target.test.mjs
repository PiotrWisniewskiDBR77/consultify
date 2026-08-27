import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const guard = resolve(repoRoot, 'scripts/validate-deploy-target.sh');

function runGuard(env) {
  return spawnSync('bash', [guard], {
    env: { PATH: process.env.PATH, ...env },
    encoding: 'utf8',
  });
}

const SAKURA = 'postgresql://app:s3cret@sakura.proxy.rlwy.net:41234/railway';
const TROLLEY = 'postgresql://app:s3cret@trolley.proxy.rlwy.net:28146/railway';
const THOMAS = 'postgresql://app:s3cret@thomas.proxy.rlwy.net:28864/railway';

// FIX-2. The original suite only ever used `s3cret` — a password with neither
// `@` nor `/` — which is precisely why it stayed green next to a credential
// leak. Postgres passwords containing `@` are ordinary; a raw `/` makes the
// string an invalid URL that the old parser smeared into a printed "identity".
const PW_AT = 'pa@ss@word';
const PW_SLASH = 'taj/nehaslo';
const SAKURA_PW_AT = `postgresql://uzytkownik:${PW_AT}@sakura.proxy.rlwy.net:41234/railway`;
const TROLLEY_PW_AT = `postgresql://uzytkownik:${PW_AT}@trolley.proxy.rlwy.net:28146/railway`;
const SAKURA_PW_SLASH = `postgresql://uzytkownik:${PW_SLASH}@sakura.proxy.rlwy.net:41234/railway`;

/** Fully configured, armed staging: both sides point at the same database. */
const staging = {
  DEPLOY_ENVIRONMENT: 'staging',
  GIT_REF: 'refs/heads/develop',
  FRONTEND_URL: 'https://staging.consultify.ai',
  APP_DATABASE_URL: SAKURA,
  MIGRATION_DATABASE_URL: SAKURA,
  STAGING_DB_HOST_FINGERPRINT: 'sakura',
  DEPLOY_TARGET_GUARD_ENFORCE: '1',
};

// ---------------------------------------------------------------------------
// §A — environment mapping. Unconditionally fail-closed, arming irrelevant.
// ---------------------------------------------------------------------------

test('accepts staging with its own frontend host and one agreed database', () => {
  const result = runGuard(staging);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /db identity verified/);
});

test('rejects the demo frontend host for staging even when unarmed', () => {
  const result = runGuard({
    DEPLOY_ENVIRONMENT: 'staging',
    GIT_REF: 'refs/heads/develop',
    FRONTEND_URL: 'https://demo.consultify.ai',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /frontend host .* is not allowed for staging/);
});

test('rejects an unknown environment and names the supported set', () => {
  const result = runGuard({ DEPLOY_ENVIRONMENT: 'foo' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /expected staging, demo, or production/);
});

test('preserves the staging git-ref guard', () => {
  const result = runGuard({ ...staging, GIT_REF: 'refs/heads/main' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /does not match staging branch list/);
});

// ---------------------------------------------------------------------------
// §B — DEC-165 divergence. Two independent inputs, mutation-style coverage.
// ---------------------------------------------------------------------------

test('MUTATION: an injected divergence between application and migration is refused', () => {
  const result = runGuard({ ...staging, APP_DATABASE_URL: TROLLEY });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /DEC-165 DIVERGENCE for staging/);
  assert.match(result.stderr, /trolley\.proxy\.rlwy\.net/);
  assert.match(result.stderr, /sakura\.proxy\.rlwy\.net/);
});

test('MUTATION REVERSED: removing the divergence lets the deploy through', () => {
  const result = runGuard(staging);
  assert.equal(result.status, 0, result.stderr);
});

test('a divergence is refused even when the guard is NOT armed', () => {
  const { DEPLOY_TARGET_GUARD_ENFORCE: _unarmed, ...env } = staging;
  const result = runGuard({ ...env, APP_DATABASE_URL: TROLLEY });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /DEC-165 DIVERGENCE/);
});

test('an identical database NAME on different hosts is still a divergence', () => {
  // The DEC-165 trap: three databases are all named `railway`.
  const result = runGuard({
    DEPLOY_ENVIRONMENT: 'demo',
    GIT_REF: 'refs/heads/demo',
    FRONTEND_URL: 'https://demo.consultify.ai',
    APP_DATABASE_URL: THOMAS,
    MIGRATION_DATABASE_URL: TROLLEY,
    DEMO_DB_HOST_FINGERPRINT: 'trolley',
    DEPLOY_TARGET_GUARD_ENFORCE: '1',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /DEC-165 DIVERGENCE for demo/);
});

test('never prints database credentials, in success or in failure', () => {
  const ok = runGuard(staging);
  const bad = runGuard({ ...staging, APP_DATABASE_URL: TROLLEY });
  for (const result of [ok, bad]) {
    assert.doesNotMatch(result.stdout + result.stderr, /s3cret/);
    assert.doesNotMatch(result.stdout + result.stderr, /postgresql:\/\//);
  }
});

test('pins the derived host to the environment fingerprint', () => {
  // Both sides agree — but on the wrong environment's database.
  const result = runGuard({
    ...staging,
    APP_DATABASE_URL: TROLLEY,
    MIGRATION_DATABASE_URL: TROLLEY,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /database target mismatch for staging/);
});

test('accepts pre-derived identities instead of connection strings', () => {
  const { APP_DATABASE_URL: _a, MIGRATION_DATABASE_URL: _m, ...env } = staging;
  const result = runGuard({
    ...env,
    APP_DB_IDENTITY: 'sakura.proxy.rlwy.net:41234/railway',
    MIGRATION_DB_IDENTITY: 'sakura.proxy.rlwy.net:41234/railway',
  });
  assert.equal(result.status, 0, result.stderr);
});

test('rejects contradictory fingerprint declarations', () => {
  const result = runGuard({ ...staging, RELEASE_TARGET_DB_HOST_FINGERPRINT: 'trolley' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /declaration conflict for staging/);
});

test('keeps production fail-closed and accepts only a matching declaration', () => {
  const result = runGuard({
    DEPLOY_ENVIRONMENT: 'production',
    GIT_REF: 'refs/heads/main',
    FRONTEND_URL: 'https://consultify.ai',
    APP_DATABASE_URL: 'postgresql://app:s3cret@centerbeam.proxy.rlwy.net:5432/railway',
    MIGRATION_DATABASE_URL: 'postgresql://app:s3cret@centerbeam.proxy.rlwy.net:5432/railway',
    PRODUCTION_DB_HOST_FINGERPRINT: 'centerbeam',
    DEPLOY_TARGET_GUARD_ENFORCE: '1',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
});

test('accepts the currently crossed demo environment domain', () => {
  const result = runGuard({
    DEPLOY_ENVIRONMENT: 'demo',
    GIT_REF: 'refs/heads/demo',
    FRONTEND_URL: 'https://stage.consultinity.ai',
    APP_DATABASE_URL: TROLLEY,
    MIGRATION_DATABASE_URL: TROLLEY,
    DEMO_DB_HOST_FINGERPRINT: 'trolley',
    DEPLOY_TARGET_GUARD_ENFORCE: '1',
  });
  assert.equal(result.status, 0, result.stderr);
});

// ---------------------------------------------------------------------------
// FIX-4 — arming. Merging must not freeze deployments.
// ---------------------------------------------------------------------------

test('UNARMED: a completely unconfigured environment still deploys, loudly', () => {
  const result = runGuard({
    DEPLOY_ENVIRONMENT: 'staging',
    GIT_REF: 'refs/heads/develop',
    FRONTEND_URL: 'https://staging.consultify.ai',
    GITHUB_ACTIONS: 'true',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PASSED WITHOUT DATABASE VERIFICATION/);
  assert.match(result.stderr, /missing APP_DATABASE_URL/);
  assert.match(result.stdout, /::warning title=deploy-target guard not armed::/);
});

test('ARMED: the same unconfigured environment is refused', () => {
  const result = runGuard({
    DEPLOY_ENVIRONMENT: 'staging',
    GIT_REF: 'refs/heads/develop',
    FRONTEND_URL: 'https://staging.consultify.ai',
    DEPLOY_TARGET_GUARD_ENFORCE: '1',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /DEPLOY_TARGET_GUARD_ENFORCE is on/);
});

test('ARMED: a missing environment fingerprint is refused', () => {
  const { STAGING_DB_HOST_FINGERPRINT: _omitted, ...env } = staging;
  const result = runGuard(env);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /STAGING_DB_HOST_FINGERPRINT/);
});

test('ARMED: a missing migration source is refused', () => {
  const { MIGRATION_DATABASE_URL: _omitted, ...env } = staging;
  const result = runGuard(env);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /MIGRATION_DATABASE_URL/);
});

test('arming accepts the documented spellings and rejects the rest', () => {
  for (const value of ['1', 'true', 'TRUE', 'yes', 'on', 'enforce']) {
    const result = runGuard({
      DEPLOY_ENVIRONMENT: 'staging',
      GIT_REF: 'refs/heads/develop',
      FRONTEND_URL: 'https://staging.consultify.ai',
      DEPLOY_TARGET_GUARD_ENFORCE: value,
    });
    assert.notEqual(result.status, 0, `expected ${value} to arm the guard`);
  }
  for (const value of ['', '0', 'false', 'warn']) {
    const result = runGuard({
      DEPLOY_ENVIRONMENT: 'staging',
      GIT_REF: 'refs/heads/develop',
      FRONTEND_URL: 'https://staging.consultify.ai',
      DEPLOY_TARGET_GUARD_ENFORCE: value,
    });
    assert.equal(result.status, 0, `expected ${value} to leave the guard advisory`);
  }
});

// ---------------------------------------------------------------------------
// FIX-2 — credentials must never reach a log line, whatever the password is.
// ---------------------------------------------------------------------------

test('MUTATION: a password containing @ never leaks, and the host is still right', () => {
  const result = runGuard({
    ...staging,
    APP_DATABASE_URL: SAKURA_PW_AT,
    MIGRATION_DATABASE_URL: TROLLEY_PW_AT,
  });
  const output = result.stdout + result.stderr;
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /DEC-165 DIVERGENCE for staging/);
  // The whole password, and every tail of it that the first-@ cut used to
  // leave behind, must be absent.
  assert.doesNotMatch(output, /pa@ss@word/);
  assert.doesNotMatch(output, /ss@word/);
  assert.doesNotMatch(output, /word@/);
  assert.doesNotMatch(output, /uzytkownik/);
  // ...and the identity must be the one new URL() derives (LAST @), not the
  // one the old sed derived (FIRST @).
  assert.match(result.stderr, /app 'sakura\.proxy\.rlwy\.net:41234\/railway'/);
  assert.match(result.stderr, /migration 'trolley\.proxy\.rlwy\.net:28146\/railway'/);
});

test('MUTATION: a password containing / is refused without printing the string', () => {
  const result = runGuard({ ...staging, APP_DATABASE_URL: SAKURA_PW_SLASH });
  const output = result.stdout + result.stderr;
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(output, /taj\/nehaslo/);
  assert.doesNotMatch(output, /nehaslo/);
  assert.doesNotMatch(output, /uzytkownik/);
  assert.match(result.stderr, /no valid host:port could be parsed/);
});

test('the shell parser and new URL() agree on where userinfo ends', () => {
  // databaseIdentity.ts (the in-Railway side) parses with new URL(), which
  // splits userinfo at the LAST @. The shell guard must not disagree, or the
  // two guards derive different identities from one connection string.
  const parsed = new URL(SAKURA_PW_AT);
  assert.equal(parsed.hostname, 'sakura.proxy.rlwy.net');
  const result = runGuard({
    ...staging,
    APP_DATABASE_URL: SAKURA_PW_AT,
    MIGRATION_DATABASE_URL: TROLLEY_PW_AT,
  });
  assert.match(result.stderr, new RegExp(`app '${parsed.hostname.replace(/\./g, '\\.')}:41234/`));
  // And on the /-password case: new URL() throws, the shell refuses.
  assert.throws(() => new URL(SAKURA_PW_SLASH));
});

test('an agreed pair with an @-password still deploys and prints no credentials', () => {
  const result = runGuard({
    ...staging,
    APP_DATABASE_URL: SAKURA_PW_AT,
    MIGRATION_DATABASE_URL: SAKURA_PW_AT,
  });
  assert.equal(result.status, 0, result.stderr);
  const output = result.stdout + result.stderr;
  assert.doesNotMatch(output, /pa@ss@word/);
  assert.doesNotMatch(output, /ss@word/);
  assert.doesNotMatch(output, /uzytkownik/);
});

// ---------------------------------------------------------------------------
// FIX-4 — the fingerprint pins the HOST, not the whole identity string.
// ---------------------------------------------------------------------------

test('MUTATION: a fingerprint set to the database name is refused, not accepted', () => {
  // Before the fix this exited 0: `railway` is a substring of
  // `trolley.proxy.rlwy.net:28146/railway`, so every host on earth passed.
  const result = runGuard({
    ...staging,
    APP_DATABASE_URL: TROLLEY,
    MIGRATION_DATABASE_URL: TROLLEY,
    STAGING_DB_HOST_FINGERPRINT: 'railway',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /set to the DATABASE NAME, not to a host fragment/);
});

test('a fingerprint that only matches the database name does not pass', () => {
  // The fingerprint is a substring of the DATABASE part but not of the host.
  // The old whole-string match accepted it; only the host may satisfy the pin.
  const result = runGuard({
    ...staging,
    APP_DATABASE_URL: 'postgresql://app:s3cret@trolley.proxy.rlwy.net:28146/sakura_prod',
    MIGRATION_DATABASE_URL: 'postgresql://app:s3cret@trolley.proxy.rlwy.net:28146/sakura_prod',
    STAGING_DB_HOST_FINGERPRINT: 'sakura',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /the resolved database HOST does not contain the fingerprint/);
});

test('MUTATION REVERSED: a genuine host fragment still passes', () => {
  const result = runGuard(staging);
  assert.equal(result.status, 0, result.stderr);
});

test('the port is never mistaken for a fingerprint match', () => {
  const result = runGuard({
    ...staging,
    STAGING_DB_HOST_FINGERPRINT: '41234',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /HOST does not contain the fingerprint/);
});

// ---------------------------------------------------------------------------
// FIX-5 — a pre-derived identity without a port is not a divergence.
// ---------------------------------------------------------------------------

test('a pre-derived identity without a port is completed to :5432', () => {
  const { APP_DATABASE_URL: _a, ...env } = staging;
  const result = runGuard({
    ...env,
    APP_DB_IDENTITY: 'sakura.proxy.rlwy.net/railway',
    MIGRATION_DATABASE_URL: 'postgresql://app:s3cret@sakura.proxy.rlwy.net:5432/railway',
  });
  assert.equal(result.status, 0, result.stderr);
});

test('a URL without a port and an identity with :5432 are the same database', () => {
  const { APP_DATABASE_URL: _a, ...env } = staging;
  const result = runGuard({
    ...env,
    APP_DB_IDENTITY: 'sakura.proxy.rlwy.net:5432/railway',
    MIGRATION_DATABASE_URL: 'postgresql://app:s3cret@sakura.proxy.rlwy.net/railway',
  });
  assert.equal(result.status, 0, result.stderr);
});

test('a real port difference is still a divergence', () => {
  const { APP_DATABASE_URL: _a, ...env } = staging;
  const result = runGuard({
    ...env,
    APP_DB_IDENTITY: 'sakura.proxy.rlwy.net:41234/railway',
    MIGRATION_DATABASE_URL: 'postgresql://app:s3cret@sakura.proxy.rlwy.net:5432/railway',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /DEC-165 DIVERGENCE/);
});

test('a connection string pasted into APP_DB_IDENTITY is refused, not printed', () => {
  const { APP_DATABASE_URL: _a, ...env } = staging;
  const result = runGuard({ ...env, APP_DB_IDENTITY: SAKURA_PW_AT });
  const output = result.stdout + result.stderr;
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(output, /pa@ss@word/);
  assert.doesNotMatch(output, /uzytkownik/);
  assert.match(result.stderr, /is not a bare host\[:port\]\/database/);
});
test('a bare secret pasted into APP_DATABASE_URL is refused, not echoed as a host', () => {
  // No scheme, no '@' to strip: the old parser would have emitted the secret
  // itself as "host". A scheme is required, exactly as new URL() requires one.
  const result = runGuard({ ...staging, APP_DATABASE_URL: 'tajnehaslo123' });
  const output = result.stdout + result.stderr;
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(output, /tajnehaslo123/);
  assert.match(result.stderr, /no valid host:port could be parsed/);
});
