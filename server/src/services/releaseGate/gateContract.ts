/**
 * Pure contract functions for the release migration gate.
 *
 * These live under src/ (not in the gate script) so tests can import them: the gate script
 * begins with a `#!/usr/bin/env tsx` shebang, which Vite/Rollup cannot parse when the module is
 * pulled into a test's graph.
 */

/**
 * Flags that would weaken the release chain. Their presence is a hard failure, never a warning.
 *   --only                 scopes the run to a hand-maintained list that silently goes stale
 *                          (the live Railway service ran a 22-file list covering 0 of 102 new migrations)
 *   --safe                 records genuine failures as 'skipped' and keeps going
 *   --allow-checksum-drift accepts a database that no longer matches the tree
 */
export const FORBIDDEN_FLAGS = ['--only', '--safe', '--allow-checksum-drift'] as const;

export function assertNoForbiddenFlags(argv: readonly string[]): void {
  const found = FORBIDDEN_FLAGS.filter((f) => argv.includes(f));
  if (found.length > 0) {
    throw new Error(
      `Release gate refuses forbidden flag(s): ${found.join(', ')}. ` +
        `The release chain must run in full, strict, checksum-verified form.`
    );
  }
}

/**
 * Positive target assertion. The WP-A04 denylist already refuses production hosts; this
 * additionally requires the operator to declare which environment they believe they are
 * targeting, so a mis-set DATABASE_URL cannot pass silently.
 */
export function assertExpectedTarget(databaseUrl: string, expected: string | undefined): string {
  const host = new URL(databaseUrl).hostname;
  if (!expected) {
    throw new Error(
      'RELEASE_TARGET_DB_HOST_FINGERPRINT is required. Set it to a distinctive substring of the ' +
        'host you intend to migrate, so the gate can prove the target matches the intent.'
    );
  }
  if (!host.toLowerCase().includes(expected.toLowerCase())) {
    throw new Error(
      `Target mismatch: resolved database host does not contain the expected fingerprint ` +
        `"${expected}". Refusing to migrate an unintended database.`
    );
  }
  return host;
}
