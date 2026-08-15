import { createHash } from 'node:crypto';

/**
 * ONE authority for "am I really pointed at the Railway `demo` environment?".
 *
 * WHY THIS EXISTS
 * ---------------
 * `server/src/config/demoPolicy.ts` answers a different question (which tenant is
 * the demo tenant) and `server/scripts/lib/scriptDatabaseTarget.ts` answers a
 * weaker one (is this connection string reachable). Neither proves the *identity*
 * of the deployment being mutated. `docs/program/WEEKEND_COMPLETION_2026-08-01/
 * ENVIRONMENT_AND_NAMING_AUTHORITY.md` fixes the only acceptance target — Railway
 * project `consultify`, environment `demo`, the `consultify` service, the
 * PostgreSQL service in that same environment — and requires that project,
 * environment and service be checked EXPLICITLY before every mutation. This
 * module is that check, in code.
 *
 * ALLOWLIST, NOT DENYLIST
 * -----------------------
 * A run is permitted only when every one of the eight elements below is
 * (a) DECLARED by the operator, (b) OBSERVED at runtime, and (c) equal. A target
 * that merely fails to look like production is NOT thereby demo. Anything that
 * cannot positively prove it is the declared demo fingerprint is refused.
 *
 * The production checks at the end are a redundant backstop for the one case the
 * allowlist cannot catch on its own — an operator who declares the production
 * fingerprint. They are not the primary gate.
 *
 * NO OVERRIDE
 * -----------
 * There is deliberately no force flag, no `--yes`, and no environment variable
 * that skips any of this. A refusal is final.
 */

// ---------------------------------------------------------------------------
// The fingerprint
// ---------------------------------------------------------------------------

export const DEMO_TARGET_ELEMENTS = [
  'railwayProjectId',
  'railwayEnvironmentId',
  'railwayEnvironmentName',
  'railwayServiceId',
  'railwayServiceName',
  'databaseHost',
  'databasePort',
  'databaseName',
] as const;

export type DemoTargetElement = (typeof DEMO_TARGET_ELEMENTS)[number];

export type DemoTargetFingerprint = Record<DemoTargetElement, string>;

/** Where the operator DECLARES the target. All eight are mandatory. */
export const DECLARED_TARGET_ENV_VARS: Record<DemoTargetElement, string> = {
  railwayProjectId: 'DEMO_TARGET_RAILWAY_PROJECT_ID',
  railwayEnvironmentId: 'DEMO_TARGET_RAILWAY_ENVIRONMENT_ID',
  railwayEnvironmentName: 'DEMO_TARGET_RAILWAY_ENVIRONMENT_NAME',
  railwayServiceId: 'DEMO_TARGET_RAILWAY_SERVICE_ID',
  railwayServiceName: 'DEMO_TARGET_RAILWAY_SERVICE_NAME',
  databaseHost: 'DEMO_TARGET_DATABASE_HOST',
  databasePort: 'DEMO_TARGET_DATABASE_PORT',
  databaseName: 'DEMO_TARGET_DATABASE_NAME',
};

/**
 * Where the five deployment-identity elements are OBSERVED. Railway injects
 * these; outside Railway the operator must export them from `railway status`
 * (the naming authority requires the check to be explicit, so typing them is the
 * point, not an inconvenience).
 *
 * The three database elements are NOT read from the environment — they are
 * parsed out of the connection string that will actually be opened, so a stale
 * `DB_HOST` cannot vouch for a different URL.
 */
export const OBSERVED_TARGET_ENV_VARS: Record<
  Exclude<DemoTargetElement, 'databaseHost' | 'databasePort' | 'databaseName'>,
  string
> = {
  railwayProjectId: 'RAILWAY_PROJECT_ID',
  railwayEnvironmentId: 'RAILWAY_ENVIRONMENT_ID',
  railwayEnvironmentName: 'RAILWAY_ENVIRONMENT_NAME',
  railwayServiceId: 'RAILWAY_SERVICE_ID',
  railwayServiceName: 'RAILWAY_SERVICE_NAME',
};

/** The canon: the only environment name that is ever an acceptable target. */
export const CANONICAL_DEMO_ENVIRONMENT_NAME = 'demo';

/** The canon: the only `consultify.ai` hostname that is not production. */
export const CANONICAL_DEMO_APP_HOSTNAME = 'demo.consultify.ai';

/** Env vars that may carry an app origin. A production origin is disqualifying. */
export const APP_ORIGIN_ENV_VARS = [
  'APP_URL',
  'PUBLIC_APP_URL',
  'FRONTEND_URL',
  'VITE_API_URL',
] as const;

/** Environment names that are never a target, whatever else is declared. */
const PRODUCTION_ENVIRONMENT_NAMES = ['production', 'prod', 'staging', 'stage', 'live'];

/** Database hosts that are unmistakably production. */
const PRODUCTION_HOST_PATTERNS = [/centerbeam/i];

export const REQUIRED_ORGANIZATION_TYPE = 'DEMO';

// ---------------------------------------------------------------------------
// Refusals
// ---------------------------------------------------------------------------

export type DemoTargetRefusalElement =
  | DemoTargetElement
  | 'connectionString'
  | 'appOrigin'
  | 'organization'
  | 'organization_type';

export interface DemoTargetRefusal {
  element: DemoTargetRefusalElement;
  reason: string;
}

export interface DemoTargetAuthorityResult {
  ok: boolean;
  refusals: DemoTargetRefusal[];
  /** Present only when `ok` is true. */
  fingerprint: DemoTargetFingerprint | null;
  /** Stable digest of the fingerprint; what the rollback manifest is bound to. */
  digest: string | null;
}

function normalize(value: unknown): string {
  return String(value ?? '').trim();
}

function refusalMessage(refusal: DemoTargetRefusal): string {
  return `DEMO TARGET REFUSED [${refusal.element}]: ${refusal.reason}`;
}

/** One-line summary suitable for an abort reason. Names every failing element. */
export function describeDemoTargetRefusals(refusals: DemoTargetRefusal[]): string {
  if (refusals.length === 0) return '';
  return refusals.map(refusalMessage).join(' | ');
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

export interface ParsedConnectionTarget {
  host: string;
  /** Empty string when the URL carries no explicit port. NEVER defaulted to 5432. */
  port: string;
  database: string;
  parsed: boolean;
}

/**
 * Splits a connection string WITHOUT inventing anything. A missing port stays
 * missing: defaulting to 5432 would let a URL that never named a port satisfy a
 * declaration that did, which is exactly the ambiguity this gate exists to kill.
 */
export function parseConnectionTarget(connectionString: string): ParsedConnectionTarget {
  const raw = normalize(connectionString);
  if (!raw) return { host: '', port: '', database: '', parsed: false };
  try {
    const url = new URL(raw);
    return {
      host: url.hostname || '',
      port: url.port || '',
      database: decodeURIComponent(url.pathname.replace(/^\/+/, '')) || '',
      parsed: true,
    };
  } catch {
    return { host: '', port: '', database: '', parsed: false };
  }
}

export function readDeclaredDemoFingerprint(
  env: NodeJS.ProcessEnv
): Partial<DemoTargetFingerprint> {
  const declared: Partial<DemoTargetFingerprint> = {};
  for (const element of DEMO_TARGET_ELEMENTS) {
    const value = normalize(env[DECLARED_TARGET_ENV_VARS[element]]);
    if (value) declared[element] = value;
  }
  return declared;
}

export function readObservedDemoFingerprint(params: {
  env: NodeJS.ProcessEnv;
  connectionString: string;
}): Partial<DemoTargetFingerprint> {
  const observed: Partial<DemoTargetFingerprint> = {};
  for (const [element, envVar] of Object.entries(OBSERVED_TARGET_ENV_VARS)) {
    const value = normalize(params.env[envVar]);
    if (value) observed[element as DemoTargetElement] = value;
  }
  const connection = parseConnectionTarget(params.connectionString);
  if (connection.host) observed.databaseHost = connection.host;
  if (connection.port) observed.databasePort = connection.port;
  if (connection.database) observed.databaseName = connection.database;
  return observed;
}

/** Stable, order-independent digest. The manifest is bound to this value. */
export function demoTargetDigest(fingerprint: DemoTargetFingerprint): string {
  const canonical = DEMO_TARGET_ELEMENTS.map(
    (element) => `${element}=${fingerprint[element]}`
  ).join('\n');
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

// ---------------------------------------------------------------------------
// The gate
// ---------------------------------------------------------------------------

export interface AssertDemoTargetAuthorityParams {
  env: NodeJS.ProcessEnv;
  connectionString: string;
  /**
   * Optional pinned declaration. When the real Railway identifiers are committed
   * to the repo they belong here; until then the operator declares them through
   * `DEMO_TARGET_*` and this stays undefined.
   */
  declaredOverride?: Partial<DemoTargetFingerprint>;
}

/**
 * The ONLY entry point. Returns every refusal it found — not just the first —
 * so an operator fixes the whole target in one pass instead of eight runs.
 */
export function assertDemoTargetAuthority(
  params: AssertDemoTargetAuthorityParams
): DemoTargetAuthorityResult {
  const refusals: DemoTargetRefusal[] = [];
  const declared = {
    ...readDeclaredDemoFingerprint(params.env),
    ...(params.declaredOverride ?? {}),
  };
  const observed = readObservedDemoFingerprint({
    env: params.env,
    connectionString: params.connectionString,
  });

  const connection = parseConnectionTarget(params.connectionString);
  if (!connection.parsed) {
    refusals.push({
      element: 'connectionString',
      reason: normalize(params.connectionString)
        ? 'the database connection string is not a parseable URL.'
        : 'no database connection string was resolved.',
    });
  }

  for (const element of DEMO_TARGET_ELEMENTS) {
    const declaredValue = declared[element];
    const observedValue = observed[element];

    if (!declaredValue) {
      refusals.push({
        element,
        reason:
          `not declared. Set ${DECLARED_TARGET_ENV_VARS[element]}. ` +
          `All ${DEMO_TARGET_ELEMENTS.length} elements of the demo fingerprint are mandatory; there is no override.`,
      });
    }

    if (!observedValue) {
      refusals.push({
        element,
        reason:
          element === 'databasePort'
            ? 'the connection string carries no explicit port. A defaulted port is never accepted.'
            : element === 'databaseHost' || element === 'databaseName'
              ? `could not be read from the connection string.`
              : `not observed at runtime. Export ${
                  OBSERVED_TARGET_ENV_VARS[element as keyof typeof OBSERVED_TARGET_ENV_VARS]
                } (from \`railway status\`).`,
      });
    }

    if (declaredValue && observedValue && declaredValue !== observedValue) {
      refusals.push({
        element,
        reason: `observed "${observedValue}" does not match declared "${declaredValue}".`,
      });
    }
  }

  // Canon: the environment name is not a free variable. `demo` or nothing.
  for (const [label, value] of [
    ['declared', declared.railwayEnvironmentName],
    ['observed', observed.railwayEnvironmentName],
  ] as const) {
    if (value && value.toLowerCase() !== CANONICAL_DEMO_ENVIRONMENT_NAME) {
      refusals.push({
        element: 'railwayEnvironmentName',
        reason: `${label} environment name is "${value}"; the only acceptable target is "${CANONICAL_DEMO_ENVIRONMENT_NAME}".`,
      });
    }
  }

  // --- Backstop. Redundant with the allowlist above; kept for the one case the
  // --- allowlist cannot see: an operator who declares production as "demo".
  for (const [label, value] of [
    ['declared', declared.railwayEnvironmentName],
    ['observed', observed.railwayEnvironmentName],
  ] as const) {
    if (value && PRODUCTION_ENVIRONMENT_NAMES.includes(value.toLowerCase())) {
      refusals.push({
        element: 'railwayEnvironmentName',
        reason: `${label} environment name "${value}" is a production-class environment. Refused unconditionally.`,
      });
    }
  }

  const hostsToScreen = [
    declared.databaseHost,
    observed.databaseHost,
    normalize(params.connectionString),
  ];
  for (const candidate of hostsToScreen) {
    if (!candidate) continue;
    for (const pattern of PRODUCTION_HOST_PATTERNS) {
      if (pattern.test(candidate)) {
        refusals.push({
          element: 'databaseHost',
          reason: `"${observed.databaseHost || declared.databaseHost || candidate}" matches the production host pattern ${pattern}. Refused unconditionally.`,
        });
        break;
      }
    }
  }

  for (const envVar of APP_ORIGIN_ENV_VARS) {
    const raw = normalize(params.env[envVar]);
    if (!raw) continue;
    let hostname = raw.toLowerCase();
    try {
      hostname = (new URL(raw).hostname || raw).toLowerCase();
    } catch {
      /* not a URL — screen the raw value */
    }
    if (hostname.endsWith('consultify.ai') && hostname !== CANONICAL_DEMO_APP_HOSTNAME) {
      refusals.push({
        element: 'appOrigin',
        reason: `${envVar}=${raw} points at a non-demo consultify.ai origin. Refused unconditionally.`,
      });
    }
  }

  if (refusals.length > 0) {
    return { ok: false, refusals, fingerprint: null, digest: null };
  }

  const fingerprint = Object.fromEntries(
    DEMO_TARGET_ELEMENTS.map((element) => [element, observed[element] as string])
  ) as DemoTargetFingerprint;

  return { ok: true, refusals: [], fingerprint, digest: demoTargetDigest(fingerprint) };
}

// ---------------------------------------------------------------------------
// Tenant class — the target row must be a DEMO organization
// ---------------------------------------------------------------------------

export interface DemoOrganizationRow {
  id: string;
  name?: string | null;
  organization_type?: string | null;
}

/** Read-only. Parameterized; never interpolated. */
export const DEMO_ORGANIZATION_SQL =
  'SELECT id, name, organization_type FROM organizations WHERE id = ?';

export function evaluateDemoOrganizationRow(params: {
  organizationId: string;
  row: DemoOrganizationRow | null | undefined;
}): DemoTargetRefusal | null {
  if (!params.row) {
    return {
      element: 'organization',
      reason: `organization "${params.organizationId}" does not exist on this target. Refusing to create or guess it.`,
    };
  }
  const organizationType = normalize(params.row.organization_type);
  if (!organizationType) {
    return {
      element: 'organization_type',
      reason: `organization "${params.organizationId}" has no organization_type. Only "${REQUIRED_ORGANIZATION_TYPE}" tenants may be materialized.`,
    };
  }
  if (organizationType !== REQUIRED_ORGANIZATION_TYPE) {
    return {
      element: 'organization_type',
      reason: `organization "${params.organizationId}" has organization_type="${organizationType}". Only "${REQUIRED_ORGANIZATION_TYPE}" tenants may be materialized; there is no override.`,
    };
  }
  return null;
}

/**
 * Read-only tenant-class check. The caller supplies the query seam so this module
 * never imports a database driver (and unit tests never open a connection).
 */
export async function assertDemoOrganization(params: {
  organizationId: string;
  query: (sql: string, values: unknown[]) => Promise<DemoOrganizationRow[]>;
}): Promise<DemoTargetRefusal | null> {
  let rows: DemoOrganizationRow[];
  try {
    rows = await params.query(DEMO_ORGANIZATION_SQL, [params.organizationId]);
  } catch (error) {
    return {
      element: 'organization',
      reason: `could not read the organizations row for "${params.organizationId}": ${String(error)}. Unproven is not proven.`,
    };
  }
  return evaluateDemoOrganizationRow({ organizationId: params.organizationId, row: rows?.[0] });
}
