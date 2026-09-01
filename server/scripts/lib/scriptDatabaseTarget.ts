import '../../src/config/loadEnv.js';

import { URL } from 'node:url';

import {
  assertNoLocalDatabaseOutsideTests,
  assertNoPrivateRailwayDbHostOutsideRailway,
  getDatabaseHost,
  isLocalHost,
  resolveReachableDatabaseUrl,
} from '../../src/config/databaseTargetResolver.js';

type ResolveScriptDatabaseTargetOptions = {
  label: string;
  databaseUrl?: string;
  publicDatabaseUrl?: string;
  requireExplicitTarget?: boolean;
  /**
   * FIX-204-4 (Z28 reversal): before this flag, EVERY script — this one
   * included — was pushed toward a remote (demo/staging) Postgres target:
   * `assertNoLocalDatabaseOutsideTests` refused a loopback DATABASE_URL
   * outright unless the operator faked a test environment (NODE_ENV=test /
   * CI=true / VITEST=1), and the production denylist covers only the
   * production host fingerprint — demo and staging were wide open. That is
   * backwards for a migration runner meant to be piloted locally first.
   *
   * When true: a loopback target (localhost/127.0.0.1/::1) is accepted as
   * the normal path with NO special environment flags. Reaching a
   * NON-loopback host still requires a SEPARATE, explicit operator
   * acknowledgement via `ALLOW_REMOTE_DB_TARGET` (see
   * REMOTE_DB_TARGET_ENV/VALUE below) — this is intentionally NOT satisfied
   * by NODE_ENV/CI/VITEST, so it cannot be flipped on by accident the way
   * the old local-host bypass could. The production-host denylist
   * (`assertHostIsNotUnverifiedProduction`) still runs unconditionally on
   * top of this — this flag only concerns the loopback-vs-remote axis.
   */
  allowOnlyLoopback?: boolean;
};

const REMOTE_DB_TARGET_ENV = 'ALLOW_REMOTE_DB_TARGET';
const REMOTE_DB_TARGET_VALUE = 'i-understand-this-leaves-loopback';

export type ScriptDatabaseTarget = {
  connectionString: string;
  host: string;
  database: string;
  source: 'DATABASE_URL' | 'DATABASE_PUBLIC_URL' | 'none';
  reason?: string;
};

function parseDatabaseName(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname.replace(/^\/+/, '') || 'unknown';
  } catch {
    return 'unknown';
  }
}

function printable(value: string | undefined): string {
  return value && value.trim() ? value : '<unset>';
}

export function describeTargetInputs(params: {
  databaseUrl?: string;
  publicDatabaseUrl?: string;
}): string {
  return `DATABASE_URL=${printable(params.databaseUrl)}, DATABASE_PUBLIC_URL=${printable(
    params.publicDatabaseUrl
  )}`;
}

export function resolveScriptDatabaseTarget(
  options: ResolveScriptDatabaseTargetOptions
): ScriptDatabaseTarget {
  const allowOnlyLoopback = options.allowOnlyLoopback === true;

  // The historical "no local database outside tests" guard exists to stop a
  // script from silently landing on a developer's own machine when a remote
  // target was intended. For an `allowOnlyLoopback` caller that guard is
  // exactly backwards — loopback IS the intended, safe default — so skip it
  // here; the loopback-vs-remote check a few lines down enforces the
  // correct direction instead.
  if (!allowOnlyLoopback) {
    assertNoLocalDatabaseOutsideTests(process.env);
  }
  assertNoPrivateRailwayDbHostOutsideRailway(process.env);

  const resolved = resolveReachableDatabaseUrl({
    databaseUrl: options.databaseUrl,
    publicDatabaseUrl: options.publicDatabaseUrl,
    allowLocalHost: allowOnlyLoopback,
  });
  const connectionString = resolved.databaseUrl;

  if (!connectionString) {
    throw new Error(
      `[${options.label}] Missing database target. ${describeTargetInputs({
        databaseUrl: options.databaseUrl,
        publicDatabaseUrl: options.publicDatabaseUrl,
      })}`
    );
  }

  const host = getDatabaseHost(connectionString);
  if (!host) {
    throw new Error(`[${options.label}] Failed to parse database host from selected target.`);
  }

  if (options.requireExplicitTarget && !options.databaseUrl && !options.publicDatabaseUrl) {
    throw new Error(
      `[${options.label}] Explicit database target is required. ${describeTargetInputs({
        databaseUrl: options.databaseUrl,
        publicDatabaseUrl: options.publicDatabaseUrl,
      })}`
    );
  }

  if (allowOnlyLoopback && !isLocalHost(host)) {
    const ack = String(process.env[REMOTE_DB_TARGET_ENV] || '').trim();
    if (ack !== REMOTE_DB_TARGET_VALUE) {
      throw new Error(
        `[${options.label}] Target host "${host}" is not loopback. This script defaults to a ` +
          `local database (D-13: pilot locally before touching anything remote). To ` +
          `deliberately point it at a remote host, set ${REMOTE_DB_TARGET_ENV}=${REMOTE_DB_TARGET_VALUE} ` +
          `(the production-host denylist still applies on top of this).`
      );
    }
  }

  return {
    connectionString,
    host,
    database: parseDatabaseName(connectionString),
    source: resolved.source,
    reason: resolved.reason,
  };
}

export function logSelectedDatabaseTarget(
  label: string,
  target: Pick<ScriptDatabaseTarget, 'host' | 'database' | 'source' | 'reason'>
): void {
  const suffix = target.reason ? ` (${target.reason})` : '';
  // eslint-disable-next-line no-console
  console.log(
    `[${label}] Target: source=${target.source} host=${target.host} database=${target.database}${suffix}`
  );
}

export function requireConfirmation(envName: string, expectedValue: string, label: string): void {
  const actual = String(process.env[envName] || '').trim();
  if (actual === expectedValue) {
    return;
  }

  throw new Error(
    `[${label}] Confirmation required. Set ${envName}=${expectedValue} to continue. Current value: ${printable(actual)}`
  );
}
