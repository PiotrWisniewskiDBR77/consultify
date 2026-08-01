/**
 * OPS-DEMO-002 — startup configuration contract for the demo signup limiter.
 *
 * The point of this suite is that "the variable is set" is not evidence. It
 * pins, per posture, exactly which combinations refuse startup, which only log,
 * and — critically — that TODAY'S staging (nothing declared) is untouched.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  reportRateLimitStartupConfig,
  resolveRateLimitStartupConfig,
} from '../../../../server/src/config/rateLimitPosture.js';

// Shaped like a real connection string only so the scheme/host validation has
// something to accept. `.invalid` is reserved by RFC 2606 and cannot resolve, and
// the credentials are literal placeholders — no secret scanner should ever have to
// think twice about this line.
const REAL_REDIS = 'redis://fixture-user:fixture-placeholder@redis.invalid:6379';

function makeLogger() {
  const calls = { info: [] as string[], warn: [] as string[], error: [] as string[] };
  return {
    calls,
    logger: {
      info: (m: string) => calls.info.push(m),
      warn: (m: string) => calls.warn.push(m),
      error: (m: string) => calls.error.push(m),
    },
  };
}

describe('rate limit startup contract', () => {
  describe('today: nothing declared (staging must be unchanged)', () => {
    it('infers single-replica, local store, closed fail mode, and refuses nothing', () => {
      const config = resolveRateLimitStartupConfig({});

      expect(config.posture).toBe('single-replica');
      expect(config.postureInferred).toBe(true);
      expect(config.store).toBe('local');
      expect(config.storeDeclared).toBe(false);
      expect(config.failMode).toBe('closed');
      expect(config.errors).toEqual([]);
      expect(config.warnings).toEqual([]);
    });

    it('does not refuse startup even with DISABLE_RATE_LIMIT=true — it only screams', () => {
      // DISABLE_RATE_LIMIT is a long-standing local-dev convenience read
      // unconditionally by index.ts. Refusing here would turn a developer .env
      // into a boot failure for a process that never opted into the contract.
      const config = resolveRateLimitStartupConfig({ DISABLE_RATE_LIMIT: 'true' });

      expect(config.errors).toEqual([]);
      expect(config.warnings).toHaveLength(1);
      expect(config.warnings[0]).toContain('DISABLE_RATE_LIMIT=true');
    });

    it('logs the selected posture exactly once, and the warning at error level', () => {
      const { calls, logger } = makeLogger();
      reportRateLimitStartupConfig(logger, { DISABLE_RATE_LIMIT: 'true' });

      expect(calls.info).toHaveLength(1);
      expect(calls.info[0]).toContain('[RateLimit] startup posture:');
      expect(calls.info[0]).toContain('posture=single-replica (inferred, not declared)');
      expect(calls.info[0]).toContain('store=local (default)');
      expect(calls.info[0]).toContain('failMode=closed (default)');
      // "unmissable" means error level, not warn.
      expect(calls.error.some((m) => m.includes('MISCONFIGURATION'))).toBe(true);
    });
  });

  describe('declared single-replica', () => {
    it('accepts RATE_LIMIT_SHARED_STORE=local as a first-class declaration', () => {
      const config = resolveRateLimitStartupConfig({
        RATE_LIMIT_POSTURE: 'single-replica',
        RATE_LIMIT_SHARED_STORE: 'local',
      });

      expect(config.store).toBe('local');
      expect(config.storeDeclared).toBe(true);
      expect(config.postureInferred).toBe(false);
      expect(config.errors).toEqual([]);
      expect(config.summary).toContain('store=local');
      expect(config.summary).not.toContain('store=local (default)');
    });

    it('REFUSES startup when DISABLE_RATE_LIMIT is active', () => {
      const config = resolveRateLimitStartupConfig({
        RATE_LIMIT_POSTURE: 'single-replica',
        DISABLE_RATE_LIMIT: 'true',
      });

      expect(config.errors).toHaveLength(1);
      expect(config.errors[0]).toContain('contradicts RATE_LIMIT_POSTURE=single-replica');
    });

    it('warns, but boots, when redis is selected without a usable REDIS_URL', () => {
      const config = resolveRateLimitStartupConfig({
        RATE_LIMIT_POSTURE: 'single-replica',
        RATE_LIMIT_SHARED_STORE: 'redis',
      });

      expect(config.errors).toEqual([]);
      expect(config.warnings.join(' ')).toContain('REDIS_URL is missing or unusable');
    });
  });

  describe('typos must not silently select the laxer setting', () => {
    it('refuses an unknown posture', () => {
      const config = resolveRateLimitStartupConfig({ RATE_LIMIT_POSTURE: 'prod' });
      expect(config.errors.join(' ')).toContain('is not a known posture');
    });

    it('refuses an unknown store, which previously meant "local" by omission', () => {
      const config = resolveRateLimitStartupConfig({ RATE_LIMIT_SHARED_STORE: 'redis-cluster' });
      expect(config.errors.join(' ')).toContain('is not a known store');
    });

    it('refuses an unknown fail mode', () => {
      const config = resolveRateLimitStartupConfig({
        RATE_LIMIT_SHARED_STORE_FAIL_MODE: 'fail-closed',
      });
      expect(config.errors.join(' ')).toContain('is not a known fail mode');
    });
  });

  describe('public-production posture', () => {
    const valid = {
      RATE_LIMIT_POSTURE: 'public-production',
      RATE_LIMIT_SHARED_STORE: 'redis',
      RATE_LIMIT_SHARED_STORE_FAIL_MODE: 'closed',
      REDIS_URL: REAL_REDIS,
    };

    it('accepts a fully specified configuration', () => {
      const config = resolveRateLimitStartupConfig(valid);
      expect(config.errors).toEqual([]);
      expect(config.posture).toBe('public-production');
      expect(config.store).toBe('redis');
      expect(config.failMode).toBe('closed');
      expect(config.redisUrlConfigured).toBe(true);
    });

    it('accepts an omitted fail mode, because the default already is closed', () => {
      const config = resolveRateLimitStartupConfig({
        ...valid,
        RATE_LIMIT_SHARED_STORE_FAIL_MODE: undefined,
      });
      expect(config.errors).toEqual([]);
      expect(config.failMode).toBe('closed');
    });

    it('REQUIRES a shared store', () => {
      const config = resolveRateLimitStartupConfig({ ...valid, RATE_LIMIT_SHARED_STORE: 'local' });
      expect(config.errors.join(' ')).toContain('requires RATE_LIMIT_SHARED_STORE=redis');
    });

    it('REQUIRES failMode=closed', () => {
      for (const mode of ['local', 'open']) {
        const config = resolveRateLimitStartupConfig({
          ...valid,
          RATE_LIMIT_SHARED_STORE_FAIL_MODE: mode,
        });
        expect(config.errors.join(' ')).toContain(
          'requires RATE_LIMIT_SHARED_STORE_FAIL_MODE=closed'
        );
      }
    });

    it('REQUIRES a real REDIS_URL: absent means the mock client, which enforces nothing', () => {
      const config = resolveRateLimitStartupConfig({ ...valid, REDIS_URL: undefined });
      expect(config.redisUrlConfigured).toBe(false);
      expect(config.errors.join(' ')).toContain('requires a real REDIS_URL');
    });

    it('rejects an unexpanded Railway variable reference as a REDIS_URL', () => {
      const config = resolveRateLimitStartupConfig({
        ...valid,
        REDIS_URL: '${{Redis.REDIS_URL}}',
      });
      expect(config.redisUrlConfigured).toBe(false);
      expect(config.errors.join(' ')).toContain('requires a real REDIS_URL');
    });

    it('rejects a non-redis scheme', () => {
      const config = resolveRateLimitStartupConfig({ ...valid, REDIS_URL: 'http://redis:6379' });
      expect(config.redisUrlConfigured).toBe(false);
    });

    it('accepts rediss:// (TLS)', () => {
      const config = resolveRateLimitStartupConfig({
        ...valid,
        REDIS_URL: 'rediss://redis.internal:6380',
      });
      expect(config.errors).toEqual([]);
    });

    it('FORBIDS MOCK_REDIS=true', () => {
      const config = resolveRateLimitStartupConfig({ ...valid, MOCK_REDIS: 'true' });
      expect(config.errors.join(' ')).toContain('forbids MOCK_REDIS=true');
    });

    it('FORBIDS RATE_LIMIT_ALLOW_PROD_DISABLE=true', () => {
      const config = resolveRateLimitStartupConfig({
        ...valid,
        RATE_LIMIT_ALLOW_PROD_DISABLE: 'true',
      });
      expect(config.errors.join(' ')).toContain('forbids RATE_LIMIT_ALLOW_PROD_DISABLE=true');
    });

    it('FORBIDS DISABLE_RATE_LIMIT=true', () => {
      const config = resolveRateLimitStartupConfig({ ...valid, DISABLE_RATE_LIMIT: 'true' });
      expect(config.errors.join(' ')).toContain('forbids DISABLE_RATE_LIMIT=true');
    });

    it('reports every violation at once rather than one per boot attempt', () => {
      const config = resolveRateLimitStartupConfig({ RATE_LIMIT_POSTURE: 'public-production' });
      expect(config.errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('runtime agreement: the middleware reads the same variables', () => {
    it('treats an explicit "local" exactly like an unset variable', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.resetModules();
      const mod = await import('../../../../server/src/middleware/rateLimiting.middleware.js');

      vi.stubEnv('RATE_LIMIT_SHARED_STORE', 'local');
      expect(mod.__private__.isSharedStoreEnabled()).toBe(false);
      expect(mod.getRateLimitRuntimeState()).toEqual({
        store: 'local',
        failMode: 'closed',
        bypassed: false,
      });

      vi.stubEnv('RATE_LIMIT_SHARED_STORE', 'redis');
      expect(mod.getRateLimitRuntimeState().store).toBe('redis');

      vi.unstubAllEnvs();
      vi.resetModules();
    });

    it('reports bypassed=true exactly when the middleware waves requests through', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.resetModules();
      const mod = await import('../../../../server/src/middleware/rateLimiting.middleware.js');

      expect(mod.__private__.isRateLimitBypassed()).toBe(false);

      // Not honoured in production without the escape hatch.
      vi.stubEnv('DISABLE_RATE_LIMIT', 'true');
      expect(mod.__private__.isRateLimitBypassed()).toBe(false);

      vi.stubEnv('RATE_LIMIT_ALLOW_PROD_DISABLE', 'true');
      expect(mod.__private__.isRateLimitBypassed()).toBe(true);
      expect(mod.getRateLimitRuntimeState().bypassed).toBe(true);

      // A bypassed limiter is not ready, whatever the configuration says.
      const probe = await mod.probeRateLimiterHealth();
      expect(probe.ok).toBe(false);
      expect(probe.detail).toContain('disabled');

      vi.unstubAllEnvs();
      vi.resetModules();
    });
  });
});
