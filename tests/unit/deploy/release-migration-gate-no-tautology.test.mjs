/**
 * FIX-1 anti-regression guard (DEC-2026-08-28-165).
 *
 * The release migration gate runs as `preDeployCommand` INSIDE the application
 * service (railway.json), so its `process.env` IS the application's
 * environment. Any "second source" it derives from that same environment is
 * the first source computed twice. Two rounds of fixes shipped exactly that
 * tautology in two different spellings.
 *
 * This test does not simulate a deploy; it asserts the shape of the source, so
 * that the tautology cannot come back a third time without someone deleting an
 * explicit test that says why it must not.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const gatePath = resolve(repoRoot, 'server/scripts/release-migration-gate.ts');
const gate = readFileSync(gatePath, 'utf8');
const code = gate
  .split('\n')
  .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
  .join('\n');

test('the gate does not claim the application identity agrees with the migration identity', () => {
  assert.doesNotMatch(
    code,
    /appIdentityMatches/,
    'the gate logged a green cross-service claim it cannot substantiate'
  );
});

test('the gate does not re-derive an "application" identity from its own process.env', () => {
  assert.doesNotMatch(
    code,
    /resolveApplicationDatabaseIdentity\s*\(/,
    'deriving both sides from one process.env is one expression counted twice'
  );
  assert.doesNotMatch(
    code,
    /databaseIdentitiesMatch\s*\(/,
    'there is no honest second identity in this process to compare against'
  );
  assert.doesNotMatch(
    code,
    /emitDatabaseIdentity\s*\(\s*'app'/,
    'a role=app line emitted here invites an operator to compare two copies of one value'
  );
});

test('the gate states its own limitation in the deploy log', () => {
  assert.match(code, /CANNOT observe a migration\/application database divergence/);
  assert.match(code, /validate-deploy-target\.sh/);
});

test('the gate still fails closed on an unidentifiable migration target', () => {
  assert.match(code, /parseDatabaseIdentityFromUrl\(databaseUrl, 'migration:resolved-url'\)/);
  assert.match(code, /Refusing to migrate an unidentifiable target/);
});

test('the cross-service check the gate defers to actually exists and is reachable', () => {
  const guard = readFileSync(resolve(repoRoot, 'scripts/validate-deploy-target.sh'), 'utf8');
  assert.match(guard, /APP_DATABASE_URL/);
  assert.match(guard, /MIGRATION_DATABASE_URL/);
  assert.match(guard, /DEC-165 DIVERGENCE/);
});
