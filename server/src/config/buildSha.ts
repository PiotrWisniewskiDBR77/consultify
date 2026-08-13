/**
 * Single source of truth for "which commit is this process running".
 *
 * WHY: before this module there were two different resolution orders in the codebase, and they
 * could disagree for the same deployment:
 *   - HealthCheckController used  RAILWAY_GIT_COMMIT_SHA || GITHUB_SHA || GIT_SHA
 *     (it did NOT consult APP_BUILD_SHA at all)
 *   - index.ts (crash-loop detection, Slack deploy announcement) used
 *     APP_BUILD_SHA || RAILWAY_GIT_COMMIT_SHA || GITHUB_SHA || GIT_SHA
 * So if APP_BUILD_SHA were ever set to anything other than RAILWAY_GIT_COMMIT_SHA, the Slack
 * announcement and /api/health would report different commits for the same deploy, and any
 * verifier that curls /api/health would confirm the wrong thing.
 *
 * One order, one resolver, used by every consumer: health, readiness, startup log, Slack
 * announcement and the release receipt.
 *
 * Resolved once at module load from the environment only — never by shelling out to git, which
 * on an unauthenticated endpoint would be a process-spawn vector.
 */

export const BUILD_SHA_UNKNOWN = 'UNKNOWN';

/** The canonical precedence. Exported so tests can assert it rather than restate it. */
export const BUILD_SHA_ENV_PRECEDENCE = [
  'APP_BUILD_SHA',
  'RAILWAY_GIT_COMMIT_SHA',
  'GITHUB_SHA',
  'GIT_SHA',
] as const;

function normalize(value: string | undefined): string | undefined {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * @param env override for tests; defaults to process.env
 * @returns the resolved commit sha, or the literal string 'UNKNOWN' when none is configured
 *          (local dev). Never returns an empty string, so consumers can print it unconditionally.
 */
export function resolveBuildSha(env: NodeJS.ProcessEnv = process.env): string {
  for (const key of BUILD_SHA_ENV_PRECEDENCE) {
    const value = normalize(env[key]);
    if (value) return value;
  }
  return BUILD_SHA_UNKNOWN;
}

/** Short form for logs and Slack messages. Keeps 'UNKNOWN' intact rather than truncating it. */
export function resolveShortBuildSha(env: NodeJS.ProcessEnv = process.env): string {
  const sha = resolveBuildSha(env);
  return sha === BUILD_SHA_UNKNOWN ? sha : sha.slice(0, 10);
}
