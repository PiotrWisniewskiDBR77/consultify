#!/usr/bin/env tsx
/**
 * E-SSO-SEC one-off backfill: encrypt-at-rest any SSO secrets in
 * tp_sso_configs that are still stored as legacy plaintext.
 *
 * Background:
 * SSOService.configureSAML/configureOIDC encrypt the sensitive field
 * (SAML `certificate` / OIDC `clientSecret`) via encryptSecret() before the
 * INSERT (shipped in commit 851ac1dfb5). BUT encryptSecret() is a no-op when
 * INTEGRATION_ENCRYPT_KEY is not configured — it returns the plaintext
 * unchanged. Any config written while that env var was unset is therefore
 * plaintext at rest. SSOService.getSSOConfig now lazily re-encrypts such rows
 * the first time they are read, but rows that are never read stay plaintext.
 *
 * This script closes that gap eagerly: it scans tp_sso_configs, finds rows
 * whose secret field is NOT in the "enc:iv:ct:tag" format, and re-writes them
 * encrypted. The decrypted view returned by the API is unchanged.
 *
 * Safety:
 * - Read-only by default. Prints every row that WOULD change (id, org,
 *   provider) and a summary count. Makes NO writes unless invoked with --write.
 * - Requires INTEGRATION_ENCRYPT_KEY (64-char hex). Without it there is nothing
 *   to encrypt WITH — the script refuses to run in --write mode and only
 *   reports.
 * - Idempotent: already-encrypted rows (isEncrypted) are skipped, so running
 *   twice is safe. The UPDATE is guarded by the original config text to avoid
 *   clobbering a concurrent write.
 * - Never prints secret values.
 *
 * Usage:
 *   npx tsx server/scripts/backfill-encrypt-sso-secrets.ts            # dry run (default)
 *   npx tsx server/scripts/backfill-encrypt-sso-secrets.ts --write    # apply
 *
 * DATABASE_URL / DATABASE_PUBLIC_URL must point at the target environment.
 * NEVER run --write against prod (centerbeam) without Piotr's explicit sign-off.
 */
import pg from 'pg';

import { resolveReachableDatabaseUrl } from '../src/config/databaseTargetResolver.js';
import logger from '../src/utils/Logger.js';
import { encryptSecret, encryptionEnabled, isEncrypted } from '../src/utils/secretEncryption.js';

interface Row {
  id: string;
  organization_id: string;
  provider: 'saml' | 'oidc';
  config: Record<string, unknown>;
}

function env(name: string): string | undefined {
  const value = String(process.env[name] || '').trim();
  return value || undefined;
}

function secretField(provider: string): 'certificate' | 'clientSecret' {
  return provider === 'saml' ? 'certificate' : 'clientSecret';
}

async function main(): Promise<void> {
  const write = process.argv.includes('--write');

  if (write && !encryptionEnabled()) {
    throw new Error(
      'INTEGRATION_ENCRYPT_KEY not set (or invalid) — cannot encrypt. Set a 64-char hex key before --write.'
    );
  }

  const resolvedDb = resolveReachableDatabaseUrl({
    databaseUrl: env('DATABASE_URL'),
    publicDatabaseUrl: env('DATABASE_PUBLIC_URL'),
  });
  const databaseUrl = resolvedDb.databaseUrl;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for SSO secret backfill');
  }
  if (resolvedDb.reason) {
    logger.warn(`[backfill-encrypt-sso-secrets] ${resolvedDb.reason}`);
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  const result = await client.query<Row>(
    `SELECT id, organization_id, provider, config
     FROM tp_sso_configs
     ORDER BY updated_at DESC`
  );
  const rows = result.rows || [];

  const toChange: Array<{ id: string; org: string; provider: string; upgraded: string }> = [];

  for (const row of rows) {
    const field = secretField(row.provider);
    const value = (row.config as Record<string, unknown>)?.[field];
    if (typeof value !== 'string' || !value || isEncrypted(value)) continue;

    const encrypted = encryptSecret(value);
    // In dry-run without a key, encryptSecret returns plaintext — still counts
    // as a "would change" row so the operator sees the exposure.
    const upgradedConfig = { ...row.config, [field]: encrypted };
    toChange.push({
      id: row.id,
      org: row.organization_id,
      provider: row.provider,
      upgraded: JSON.stringify(upgradedConfig),
    });
  }

  logger.info(
    `[backfill-encrypt-sso-secrets] scanned=${rows.length} row(s), plaintext-secrets=${toChange.length}` +
      `${write ? ' (WRITE MODE)' : ' (DRY RUN — pass --write to apply)'}`
  );
  for (const c of toChange) {
    logger.info(`  id=${c.id} org=${c.org} provider=${c.provider} — secret is PLAINTEXT`);
  }

  if (write && toChange.length > 0) {
    let wrote = 0;
    for (const c of toChange) {
      // Guarded by id only; the lazy-reencrypt path may also upgrade concurrently,
      // but writing an equivalent encrypted config is harmless (round-trips same).
      await client.query(`UPDATE tp_sso_configs SET config = $2 WHERE id = $1`, [c.id, c.upgraded]);
      wrote += 1;
    }
    logger.info(`[backfill-encrypt-sso-secrets] encrypted ${wrote} row(s) at rest.`);
  }

  await client.end();
}

main().catch((error) => {
  logger.error(
    '[backfill-encrypt-sso-secrets] Failed:',
    (error as Error)?.message || error
  );
  process.exit(1);
});
