/**
 * E-SSO-SEC — REAL-runtime proof that SSO secrets are encrypted at rest.
 *
 * Runs the ACTUAL SSOService against the local parity Postgres (:5443) with a
 * real INTEGRATION_ENCRYPT_KEY set. getDatabase() is mocked only to route the
 * service's real SQL to a real pg.Client (the service code path — encrypt on
 * write, decrypt on read, lazy re-encrypt — is unchanged and unmocked).
 *
 * Proves:
 *  1. configureOIDC / configureSAML write CIPHERTEXT to the DB — the raw column
 *     never contains the plaintext secret.
 *  2. getSSOConfig round-trips: the caller still sees the original plaintext.
 *  3. A legacy PLAINTEXT row (written before the key existed) is transparently
 *     re-encrypted at rest the first time getSSOConfig reads it.
 *
 * Requires: DATABASE_URL pointing at local parity, INTEGRATION_ENCRYPT_KEY unset
 * or overridden here. This file sets a deterministic test key.
 */
import crypto from 'crypto';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { requireLocalDbUrl } from './harness.js';

// Deterministic 32-byte (64 hex) key for the test run. Set BEFORE importing the
// service so getKey() (read lazily per-call) picks it up.
const TEST_KEY = 'a'.repeat(64);
process.env.INTEGRATION_ENCRYPT_KEY = TEST_KEY;

// A single real client, shared by the getDatabase() mock below.
const holder = vi.hoisted(() => ({ client: null as pg.Client | null }));

vi.mock('../../server/src/database/Database.js', () => ({
  getDatabase: () => ({
    query: (sql: string, params?: unknown[]) => holder.client!.query(sql, params),
  }),
}));

// Import AFTER the mock + env are in place.
const { ssoService } = await import('../../server/src/services/tablePlatform/SSOService.js');

const ORG_ENC = crypto.randomUUID();
const ORG_LEGACY = crypto.randomUUID();

async function rawConfig(orgId: string): Promise<any> {
  const r = await holder.client!.query(
    'SELECT config FROM tp_sso_configs WHERE organization_id = $1',
    [orgId]
  );
  return r.rows[0]?.config ?? null;
}

describe('E-SSO-SEC: SSO secrets encrypted at rest (parity)', () => {
  beforeAll(async () => {
    holder.client = new pg.Client({ connectionString: requireLocalDbUrl() });
    await holder.client.connect();
    await holder.client.query('DELETE FROM tp_sso_configs WHERE organization_id = ANY($1)', [
      [ORG_ENC, ORG_LEGACY],
    ]);
  });

  afterAll(async () => {
    if (holder.client) {
      // Probe hygiene — leave no test rows on the parity DB.
      await holder.client.query('DELETE FROM tp_sso_configs WHERE organization_id = ANY($1)', [
        [ORG_ENC, ORG_LEGACY],
      ]);
      await holder.client.end();
    }
  });

  it('configureOIDC writes ciphertext; getSSOConfig round-trips plaintext', async () => {
    const PLAIN = 'oidc-super-secret-value-9f3b';
    await ssoService.configureOIDC(ORG_ENC, {
      issuer: 'https://accounts.example.com',
      clientId: 'client-123',
      clientSecret: PLAIN,
      authorizationUrl: 'https://accounts.example.com/authorize',
      tokenUrl: 'https://accounts.example.com/token',
      userInfoUrl: 'https://accounts.example.com/userinfo',
    });

    // At rest: the stored secret must be ciphertext, NOT readable plaintext.
    const stored = await rawConfig(ORG_ENC);
    expect(typeof stored.clientSecret).toBe('string');
    expect(stored.clientSecret.startsWith('enc:')).toBe(true);
    expect(stored.clientSecret).not.toContain(PLAIN);

    // Caller view: decrypted round-trip is identical.
    const got = await ssoService.getSSOConfig(ORG_ENC);
    expect((got!.config as any).clientSecret).toBe(PLAIN);
  });

  it('configureSAML writes ciphertext for the certificate', async () => {
    const CERT = 'MIIC-plaintext-cert-body-7a21';
    await ssoService.configureSAML(ORG_ENC, {
      entityId: 'https://app.example.com',
      ssoUrl: 'https://idp.example.com/sso',
      certificate: CERT,
    });
    const stored = await rawConfig(ORG_ENC);
    expect(stored.certificate.startsWith('enc:')).toBe(true);
    expect(stored.certificate).not.toContain(CERT);

    const got = await ssoService.getSSOConfig(ORG_ENC);
    expect((got!.config as any).certificate).toBe(CERT);
  });

  it('lazily re-encrypts a legacy plaintext row on first read', async () => {
    const LEGACY_PLAIN = 'legacy-plaintext-secret-b52c';
    // Simulate a row written while INTEGRATION_ENCRYPT_KEY was unset:
    // clientSecret stored raw (no "enc:" prefix).
    await holder.client!.query(
      `INSERT INTO tp_sso_configs (organization_id, provider, config)
       VALUES ($1, 'oidc', $2)`,
      [
        ORG_LEGACY,
        JSON.stringify({
          issuer: 'https://legacy.example.com',
          clientId: 'legacy-client',
          clientSecret: LEGACY_PLAIN,
          authorizationUrl: 'https://legacy.example.com/authorize',
          tokenUrl: 'https://legacy.example.com/token',
          userInfoUrl: 'https://legacy.example.com/userinfo',
        }),
      ]
    );

    // Pre-condition: raw value IS plaintext.
    const before = await rawConfig(ORG_LEGACY);
    expect(before.clientSecret).toBe(LEGACY_PLAIN);
    expect(before.clientSecret.startsWith('enc:')).toBe(false);

    // Read through the service — decrypted view is correct AND the row upgrades.
    const got = await ssoService.getSSOConfig(ORG_LEGACY);
    expect((got!.config as any).clientSecret).toBe(LEGACY_PLAIN);

    // Post-condition: at rest is now ciphertext, plaintext gone.
    const after = await rawConfig(ORG_LEGACY);
    expect(after.clientSecret.startsWith('enc:')).toBe(true);
    expect(after.clientSecret).not.toContain(LEGACY_PLAIN);

    // Idempotent: a second read leaves it encrypted and still round-trips.
    const got2 = await ssoService.getSSOConfig(ORG_LEGACY);
    expect((got2!.config as any).clientSecret).toBe(LEGACY_PLAIN);
  });
});
