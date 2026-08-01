/**
 * Rate limit POSTURE — startup configuration contract (OPS-DEMO-002)
 *
 * The demo signup endpoint is unauthenticated and provisions a seeded tenant per
 * success, so its limiter is the only network-level brake on the demo database.
 * Whether that brake actually works depends on a handful of environment
 * variables that, until now, were only ever read lazily, per request, with silent
 * defaults. A typo, a missing `REDIS_URL`, or a leftover `DISABLE_RATE_LIMIT=true`
 * produced a server that booted happily and enforced nothing.
 *
 * This module turns that into an explicit, declared contract that is evaluated
 * ONCE at startup. It is deliberately PURE: it reads an env bag and returns a
 * verdict. `server/src/index.ts` owns the decision to log or to refuse, which
 * keeps this unit-testable without spawning a process.
 *
 * TWO POSTURES
 * ------------
 * `single-replica` (today's staging/demo): one Railway replica, in-process
 *   counters are sufficient because there is nothing to share the count WITH.
 * `public-production` (not yet in use): multiple replicas and/or genuinely
 *   public traffic. In-process counters multiply the quota by the replica count,
 *   so a shared Redis store, a `closed` fail mode and a real Redis URL are all
 *   mandatory.
 *
 * DEFAULTS ARE UNCHANGED. With `RATE_LIMIT_POSTURE` unset the posture is
 * INFERRED as single-replica and nothing refuses startup — exactly the behaviour
 * that shipped before this module existed. Declaring the posture explicitly is
 * what turns the contract on.
 */

export const RATE_LIMIT_POSTURE_ENV = 'RATE_LIMIT_POSTURE';
export const RATE_LIMIT_SHARED_STORE_ENV = 'RATE_LIMIT_SHARED_STORE';
export const RATE_LIMIT_SHARED_STORE_FAIL_MODE_ENV = 'RATE_LIMIT_SHARED_STORE_FAIL_MODE';
export const RATE_LIMIT_DISABLE_ENV = 'DISABLE_RATE_LIMIT';
export const RATE_LIMIT_ALLOW_PROD_DISABLE_ENV = 'RATE_LIMIT_ALLOW_PROD_DISABLE';

export type RateLimitPosture = 'single-replica' | 'public-production';
export type RateLimitStoreSelection = 'local' | 'redis';
export type RateLimitFailMode = 'closed' | 'local' | 'open';

export interface RateLimitStartupConfig {
  /** The posture actually in force. */
  posture: RateLimitPosture;
  /** `true` when nobody declared it and we fell back to single-replica. */
  postureInferred: boolean;
  /** Which counting store the demo limiters will use. */
  store: RateLimitStoreSelection;
  /** `true` when the operator wrote `local` rather than leaving it unset. */
  storeDeclared: boolean;
  failMode: RateLimitFailMode;
  failModeDeclared: boolean;
  disableRateLimitRequested: boolean;
  allowProdDisableRequested: boolean;
  mockRedisRequested: boolean;
  redisUrlConfigured: boolean;
  /** Refuse startup. */
  errors: string[];
  /** Log loudly, keep booting. */
  warnings: string[];
  /** One line an operator can read in the boot log. */
  summary: string;
}

function normalize(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeLower(value: unknown): string {
  return normalize(value).toLowerCase();
}

function isTrue(value: unknown): boolean {
  return normalizeLower(value) === 'true';
}

/**
 * A real, reachable-looking Redis URL. Deliberately strict about two things the
 * previous round found the hard way:
 *
 * 1. an UNSET `REDIS_URL` is not "no Redis" — `RedisClient` silently substitutes
 *    `redis://localhost:6379` and, when that fails to connect, swaps itself for
 *    the in-process mock whose `incr()` returns a constant 1. A limiter on top of
 *    that looks alive and enforces nothing;
 * 2. Railway variable references that never expanded (`${{Redis.REDIS_URL}}`)
 *    reach the process verbatim and take the same mock path.
 */
function isUsableRedisUrl(raw: unknown): boolean {
  const value = normalize(raw);
  if (!value) return false;
  if (value.includes('${{')) return false;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') return false;
    return Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

export function resolveRateLimitStartupConfig(
  env: NodeJS.ProcessEnv = process.env
): RateLimitStartupConfig {
  const errors: string[] = [];
  const warnings: string[] = [];

  // --- posture -------------------------------------------------------------
  const rawPosture = normalizeLower(env[RATE_LIMIT_POSTURE_ENV]);
  const postureInferred = rawPosture === '';
  let posture: RateLimitPosture = 'single-replica';
  if (rawPosture === 'public-production') {
    posture = 'public-production';
  } else if (rawPosture !== '' && rawPosture !== 'single-replica') {
    // A typo must not silently select the laxer posture. This can only fire for
    // someone who set the new variable, so it cannot affect today's staging.
    errors.push(
      `${RATE_LIMIT_POSTURE_ENV}="${normalize(env[RATE_LIMIT_POSTURE_ENV])}" is not a known posture (expected "single-replica" or "public-production")`
    );
  }

  // --- store ---------------------------------------------------------------
  const rawStore = normalizeLower(env[RATE_LIMIT_SHARED_STORE_ENV]);
  const storeDeclared = rawStore !== '';
  let store: RateLimitStoreSelection = 'local';
  if (rawStore === 'redis') {
    store = 'redis';
  } else if (rawStore !== '' && rawStore !== 'local') {
    // Same reasoning: before this contract, `RATE_LIMIT_SHARED_STORE=redis-cluster`
    // meant "local" by omission. The posture must be declared, not inferred from
    // a value that failed to match.
    errors.push(
      `${RATE_LIMIT_SHARED_STORE_ENV}="${normalize(env[RATE_LIMIT_SHARED_STORE_ENV])}" is not a known store (expected "local" or "redis")`
    );
  }

  // --- fail mode -----------------------------------------------------------
  const rawFailMode = normalizeLower(env[RATE_LIMIT_SHARED_STORE_FAIL_MODE_ENV]);
  const failModeDeclared = rawFailMode !== '';
  let failMode: RateLimitFailMode = 'closed';
  if (rawFailMode === 'open' || rawFailMode === 'local') {
    failMode = rawFailMode;
  } else if (rawFailMode !== '' && rawFailMode !== 'closed') {
    errors.push(
      `${RATE_LIMIT_SHARED_STORE_FAIL_MODE_ENV}="${normalize(env[RATE_LIMIT_SHARED_STORE_FAIL_MODE_ENV])}" is not a known fail mode (expected "closed", "local" or "open")`
    );
  }

  // --- disable switches ----------------------------------------------------
  const disableRateLimitRequested = isTrue(env[RATE_LIMIT_DISABLE_ENV]);
  const allowProdDisableRequested = isTrue(env[RATE_LIMIT_ALLOW_PROD_DISABLE_ENV]);
  const mockRedisRequested = isTrue(env.MOCK_REDIS);
  const redisUrlConfigured = isUsableRedisUrl(env.REDIS_URL);

  if (posture === 'single-replica') {
    if (disableRateLimitRequested) {
      const message =
        `${RATE_LIMIT_DISABLE_ENV}=true disables EVERY rate limiter, including the public demo signup brake`;
      if (postureInferred) {
        // Behaviour-preserving: `DISABLE_RATE_LIMIT` is a long-standing local
        // development convenience read unconditionally by index.ts. Refusing to
        // boot on it would turn a developer's .env into a crash, and this branch
        // is reached by every process that has NOT opted into the contract.
        // So it is unmissable, but not fatal.
        warnings.push(`${message} — set ${RATE_LIMIT_POSTURE_ENV} to make this a startup failure`);
      } else {
        // Explicitly declaring a served posture and then switching the limiters
        // off is a contradiction, and only reachable via the new variable.
        errors.push(`${message}, which contradicts ${RATE_LIMIT_POSTURE_ENV}=single-replica`);
      }
    }
    if (allowProdDisableRequested && !postureInferred) {
      warnings.push(
        `${RATE_LIMIT_ALLOW_PROD_DISABLE_ENV}=true is set; it lets ${RATE_LIMIT_DISABLE_ENV} take effect even in production`
      );
    }
    if (store === 'redis' && !redisUrlConfigured) {
      warnings.push(
        `${RATE_LIMIT_SHARED_STORE_ENV}=redis but REDIS_URL is missing or unusable; the limiters will fail over per ${RATE_LIMIT_SHARED_STORE_FAIL_MODE_ENV}=${failMode}`
      );
    }
  }

  if (posture === 'public-production') {
    if (store !== 'redis') {
      errors.push(
        `${RATE_LIMIT_POSTURE_ENV}=public-production requires ${RATE_LIMIT_SHARED_STORE_ENV}=redis (in-process counters multiply the quota by the replica count)`
      );
    }
    if (failMode !== 'closed') {
      errors.push(
        `${RATE_LIMIT_POSTURE_ENV}=public-production requires ${RATE_LIMIT_SHARED_STORE_FAIL_MODE_ENV}=closed (got "${failMode}")`
      );
    }
    if (!redisUrlConfigured) {
      errors.push(
        `${RATE_LIMIT_POSTURE_ENV}=public-production requires a real REDIS_URL (redis:// or rediss://); without it RedisClient hands out the in-process mock, whose INCR returns a constant 1 and enforces nothing`
      );
    }
    if (mockRedisRequested) {
      errors.push(
        `${RATE_LIMIT_POSTURE_ENV}=public-production forbids MOCK_REDIS=true; the mock client enforces no quota at all`
      );
    }
    if (disableRateLimitRequested) {
      errors.push(
        `${RATE_LIMIT_POSTURE_ENV}=public-production forbids ${RATE_LIMIT_DISABLE_ENV}=true`
      );
    }
    if (allowProdDisableRequested) {
      errors.push(
        `${RATE_LIMIT_POSTURE_ENV}=public-production forbids ${RATE_LIMIT_ALLOW_PROD_DISABLE_ENV}=true`
      );
    }
  }

  const summary =
    `posture=${posture}${postureInferred ? ' (inferred, not declared)' : ' (declared)'} ` +
    `store=${store}${storeDeclared ? '' : ' (default)'} ` +
    `failMode=${failMode}${failModeDeclared ? '' : ' (default)'} ` +
    `disableRateLimit=${disableRateLimitRequested} ` +
    `allowProdDisable=${allowProdDisableRequested} ` +
    `redisUrl=${redisUrlConfigured ? 'configured' : 'absent'} ` +
    `mockRedis=${mockRedisRequested}`;

  return {
    posture,
    postureInferred,
    store,
    storeDeclared,
    failMode,
    failModeDeclared,
    disableRateLimitRequested,
    allowProdDisableRequested,
    mockRedisRequested,
    redisUrlConfigured,
    errors,
    warnings,
    summary,
  };
}

export interface RateLimitStartupLogger {
  info: (message: string, ...meta: unknown[]) => void;
  warn: (message: string, ...meta: unknown[]) => void;
  error: (message: string, ...meta: unknown[]) => void;
}

/**
 * Logs the selected posture ONCE, loudly, and reports whether startup should be
 * refused. The caller decides how to refuse (index.ts exits) so this stays pure
 * enough to unit-test.
 */
export function reportRateLimitStartupConfig(
  logger: RateLimitStartupLogger,
  env: NodeJS.ProcessEnv = process.env
): RateLimitStartupConfig {
  const config = resolveRateLimitStartupConfig(env);

  logger.info(`[RateLimit] startup posture: ${config.summary}`);

  for (const warning of config.warnings) {
    logger.error(`[RateLimit] MISCONFIGURATION: ${warning}`);
  }
  for (const error of config.errors) {
    logger.error(`[RateLimit] FATAL MISCONFIGURATION: ${error}`);
  }

  return config;
}
