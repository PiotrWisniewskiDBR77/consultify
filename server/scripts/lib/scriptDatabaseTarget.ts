import '../../src/config/loadEnv.js';

import { URL } from 'node:url';

import {
  assertNoLocalDatabaseOutsideTests,
  assertNoPrivateRailwayDbHostOutsideRailway,
  getDatabaseHost,
  resolveReachableDatabaseUrl,
} from '../../src/config/databaseTargetResolver.js';

type ResolveScriptDatabaseTargetOptions = {
  label: string;
  databaseUrl?: string;
  publicDatabaseUrl?: string;
  requireExplicitTarget?: boolean;
};

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
  assertNoLocalDatabaseOutsideTests(process.env);
  assertNoPrivateRailwayDbHostOutsideRailway(process.env);

  const resolved = resolveReachableDatabaseUrl({
    databaseUrl: options.databaseUrl,
    publicDatabaseUrl: options.publicDatabaseUrl,
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
