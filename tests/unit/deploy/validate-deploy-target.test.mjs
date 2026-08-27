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

const staging = {
  DEPLOY_ENVIRONMENT: 'staging',
  GIT_REF: 'refs/heads/develop',
  FRONTEND_URL: 'https://staging.consultify.ai',
  RELEASE_TARGET_DB_HOST_FINGERPRINT: 'test-fingerprint-a',
  STAGING_DB_HOST_FINGERPRINT: 'test-fingerprint-a',
};

test('accepts staging with its own frontend host and matching database declaration', () => {
  const result = runGuard(staging);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /db target fingerprint verified/);
});

test('rejects the demo frontend host for staging', () => {
  const result = runGuard({ ...staging, FRONTEND_URL: 'https://demo.consultify.ai' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /frontend host .* is not allowed for staging/);
});

test('rejects a missing release-target fingerprint', () => {
  const { RELEASE_TARGET_DB_HOST_FINGERPRINT: _omitted, ...env } = staging;
  const result = runGuard(env);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /RELEASE_TARGET_DB_HOST_FINGERPRINT/);
});

test('rejects a missing staging declaration', () => {
  const { STAGING_DB_HOST_FINGERPRINT: _omitted, ...env } = staging;
  const result = runGuard(env);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /STAGING_DB_HOST_FINGERPRINT/);
});

test('rejects different fingerprints without printing either value', () => {
  const result = runGuard({
    ...staging,
    RELEASE_TARGET_DB_HOST_FINGERPRINT: 'test-fingerprint-a',
    STAGING_DB_HOST_FINGERPRINT: 'test-fingerprint-b',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /database target mismatch for staging/);
  assert.doesNotMatch(result.stderr, /test-fingerprint-a|test-fingerprint-b/);
});

test('accepts the primary demo frontend host', () => {
  const result = runGuard({
    DEPLOY_ENVIRONMENT: 'demo',
    GIT_REF: 'refs/heads/demo',
    FRONTEND_URL: 'https://demo.consultify.ai',
    RELEASE_TARGET_DB_HOST_FINGERPRINT: 'test-fingerprint-a',
    DEMO_DB_HOST_FINGERPRINT: 'test-fingerprint-a',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
});

test('accepts the currently crossed demo environment domain', () => {
  const result = runGuard({
    DEPLOY_ENVIRONMENT: 'demo',
    GIT_REF: 'refs/heads/demo',
    FRONTEND_URL: 'https://stage.consultinity.ai',
    RELEASE_TARGET_DB_HOST_FINGERPRINT: 'test-fingerprint-a',
    DEMO_DB_HOST_FINGERPRINT: 'test-fingerprint-a',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
});

test('keeps production fail-closed and accepts only a matching declaration', () => {
  const result = runGuard({
    DEPLOY_ENVIRONMENT: 'production',
    GIT_REF: 'refs/heads/main',
    FRONTEND_URL: 'https://consultify.ai',
    RELEASE_TARGET_DB_HOST_FINGERPRINT: 'test-fingerprint-a',
    PRODUCTION_DB_HOST_FINGERPRINT: 'test-fingerprint-a',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
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
