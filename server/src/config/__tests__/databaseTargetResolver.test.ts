import { describe, expect, it } from 'vitest';

import {
  assertNoProductionDatabaseOutsideVerifiedRuntime,
  getProductionDatabaseHostFingerprints,
  isKnownProductionDatabaseHost,
  isVerifiedProductionRuntime,
  resolveReachableDatabaseUrl,
} from '../databaseTargetResolver.js';

/**
 * WP-A04 — fail-closed guard against connecting a non-production runtime to
 * the production Postgres host.
 *
 * These tests exercise pure string/logic functions only. Nothing here opens
 * a network connection or touches a real database — every "host" below is a
 * fabricated hostname string used purely to check the allow/deny logic.
 */
describe('WP-A04 production database guard', () => {
  const PROD_URL = 'postgresql://user:pass@centerbeam.proxy.rlwy.net:37823/consultify';
  const DEMO_URL = 'postgresql://user:pass@trolley.proxy.rlwy.net:28146/consultify';
  const DEV_URL = 'postgresql://user:pass@thomas.proxy.rlwy.net:20221/consultify';

  describe('isKnownProductionDatabaseHost', () => {
    it('flags the known production host fingerprint', () => {
      expect(isKnownProductionDatabaseHost('centerbeam.proxy.rlwy.net', {})).toBe(true);
    });

    it('is case-insensitive', () => {
      expect(isKnownProductionDatabaseHost('CenterBeam.Proxy.Rlwy.Net', {})).toBe(true);
    });

    it('does not flag demo/staging or dev hosts', () => {
      expect(isKnownProductionDatabaseHost('trolley.proxy.rlwy.net', {})).toBe(false);
      expect(isKnownProductionDatabaseHost('thomas.proxy.rlwy.net', {})).toBe(false);
    });

    it('does not flag localhost', () => {
      expect(isKnownProductionDatabaseHost('localhost', {})).toBe(false);
    });

    it('returns false for empty/undefined host', () => {
      expect(isKnownProductionDatabaseHost(undefined, {})).toBe(false);
      expect(isKnownProductionDatabaseHost('', {})).toBe(false);
    });

    it('extends (never replaces) the denylist via PRODUCTION_DB_HOST_DENYLIST_EXTRA', () => {
      const env = { PRODUCTION_DB_HOST_DENYLIST_EXTRA: 'some-other-prod-alias' };
      expect(isKnownProductionDatabaseHost('some-other-prod-alias.internal', env)).toBe(true);
      // built-in default still applies even though an extra list was configured
      expect(isKnownProductionDatabaseHost('centerbeam.proxy.rlwy.net', env)).toBe(true);
    });

    it('getProductionDatabaseHostFingerprints always includes the built-in default', () => {
      expect(getProductionDatabaseHostFingerprints({})).toContain('centerbeam');
      expect(
        getProductionDatabaseHostFingerprints({ PRODUCTION_DB_HOST_DENYLIST_EXTRA: '' })
      ).toContain('centerbeam');
    });
  });

  describe('isVerifiedProductionRuntime', () => {
    it('is false with no Railway env at all', () => {
      expect(isVerifiedProductionRuntime({})).toBe(false);
    });

    it('is false when Railway env is present but environment name is not production', () => {
      expect(
        isVerifiedProductionRuntime({
          RAILWAY_SERVICE_ID: 'svc_123',
          RAILWAY_ENVIRONMENT_NAME: 'staging',
        })
      ).toBe(false);
    });

    it('is true only when running inside Railway AND environment name is production', () => {
      expect(
        isVerifiedProductionRuntime({
          RAILWAY_SERVICE_ID: 'svc_123',
          RAILWAY_ENVIRONMENT_NAME: 'production',
        })
      ).toBe(true);
    });

    it('is false when environment name claims production but there is no Railway service id (spoofable local env vars)', () => {
      expect(isVerifiedProductionRuntime({ RAILWAY_ENVIRONMENT_NAME: 'production' })).toBe(false);
    });
  });

  describe('assertNoProductionDatabaseOutsideVerifiedRuntime', () => {
    it('throws when DATABASE_URL points to the production host outside Railway', () => {
      expect(() =>
        assertNoProductionDatabaseOutsideVerifiedRuntime({ DATABASE_URL: PROD_URL })
      ).toThrow(/WP-A04/);
    });

    it('throws when DB_HOST points to the production host outside Railway', () => {
      expect(() =>
        assertNoProductionDatabaseOutsideVerifiedRuntime({
          DB_HOST: 'centerbeam.proxy.rlwy.net',
        })
      ).toThrow(/WP-A04/);
    });

    it('does not throw for a demo/staging DATABASE_URL', () => {
      expect(() =>
        assertNoProductionDatabaseOutsideVerifiedRuntime({ DATABASE_URL: DEMO_URL })
      ).not.toThrow();
    });

    it('does not throw for a local dev DATABASE_URL', () => {
      expect(() =>
        assertNoProductionDatabaseOutsideVerifiedRuntime({ DATABASE_URL: DEV_URL })
      ).not.toThrow();
    });

    it('allows the production host when running as the verified production Railway service', () => {
      expect(() =>
        assertNoProductionDatabaseOutsideVerifiedRuntime({
          DATABASE_URL: PROD_URL,
          RAILWAY_SERVICE_ID: 'svc_prod',
          RAILWAY_ENVIRONMENT_NAME: 'production',
        })
      ).not.toThrow();
    });

    it('does NOT accept a merely-claimed NODE_ENV=production as proof (the actual incident shape)', () => {
      // This is the exact incident pattern: a local process with production
      // database credentials copy-pasted in, regardless of what NODE_ENV
      // happens to be set to locally.
      expect(() =>
        assertNoProductionDatabaseOutsideVerifiedRuntime({
          DATABASE_URL: PROD_URL,
          NODE_ENV: 'production',
        })
      ).toThrow(/WP-A04/);
    });

    it('honors the explicit, narrowly-worded override sentinel', () => {
      expect(() =>
        assertNoProductionDatabaseOutsideVerifiedRuntime({
          DATABASE_URL: PROD_URL,
          PRODUCTION_DB_OVERRIDE_ACK: 'i-understand-this-is-production',
        })
      ).not.toThrow();
    });

    it('rejects a loose truthy override value (must match the sentinel phrase exactly)', () => {
      expect(() =>
        assertNoProductionDatabaseOutsideVerifiedRuntime({
          DATABASE_URL: PROD_URL,
          PRODUCTION_DB_OVERRIDE_ACK: 'true',
        })
      ).toThrow(/WP-A04/);
    });
  });

  describe('resolveReachableDatabaseUrl', () => {
    it('throws when DATABASE_URL resolves to the production host outside Railway', () => {
      expect(() => resolveReachableDatabaseUrl({ databaseUrl: PROD_URL, env: {} })).toThrow(
        /WP-A04/
      );
    });

    it('resolves normally for a demo/staging DATABASE_URL', () => {
      const result = resolveReachableDatabaseUrl({ databaseUrl: DEMO_URL, env: {} });
      expect(result).toEqual({ databaseUrl: DEMO_URL, source: 'DATABASE_URL' });
    });

    it('throws when DATABASE_PUBLIC_URL fallback resolves to the production host', () => {
      expect(() =>
        resolveReachableDatabaseUrl({ publicDatabaseUrl: PROD_URL, env: {} })
      ).toThrow(/WP-A04/);
    });
  });
});
