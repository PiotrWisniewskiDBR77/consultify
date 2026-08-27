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
