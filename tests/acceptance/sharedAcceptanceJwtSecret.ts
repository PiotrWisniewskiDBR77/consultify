/**
 * Shared acceptance-suite JWT test-secret hermeticity.
 *
 * Originally built for INI-005 (see git history: `tests/acceptance/
 * ini005TestSecret.ts`), renamed and generalized during the
 * Decision+Initiative/Execution integration round (2026-08-01) once running
 * both suites in ONE vitest invocation (this repo's `vitest.acceptance.config.ts`
 * uses `pool: 'forks'` + `fileParallelism: false` — a single sequential fork,
 * one shared Node process/module-cache for every file in the run) proved the
 * MW-DEC-001 acceptance suite hits the EXACT SAME root-cause bug below
 * whenever `JWT_SECRET` isn't exported in the shell — confirmed empirically:
 * `mw-dec-001-decision-workflow.e2e.test.ts` +
 * `mw-dec-001-falsification-review.e2e.test.ts` alone, `JWT_SECRET` unset ->
 * 27 failed / 4 passed; same two files with
 * `JWT_SECRET=development_secret_key_change_in_production_abc123xyz`
 * (MW-DEC-003's own documented run command) -> 31/31. The Decision line
 * worked around this operationally (always pass the env var explicitly);
 * this module fixes it structurally, the same way it already does for
 * INI-005. One canonical secret now backs the entire acceptance suite,
 * removing any possibility of two different "pinned" secrets ever existing
 * side by side regardless of which files a given vitest invocation includes
 * or what order it runs them in.
 *
 * ROOT CAUSE (confirmed 2026-08-01 by direct read of both files):
 *   - tests/acceptance/harness.ts `getJwtSecret()` falls back to
 *     'development_secret_key_change_in_production_abc123xyz' when
 *     process.env.JWT_SECRET is unset.
 *   - server/src/config/Config.ts `loadConfig()` falls back (under
 *     NODE_ENV=test) to 'test-secret-key-for-testing-only-min-32-chars' —
 *     a COMPLETELY DIFFERENT string.
 *   When the test-runner's shell has JWT_SECRET unset, `mintToken()`
 *   (harness, uses harness's fallback) signs tokens with a different secret
 *   than the one the real `verifyToken` middleware (Config, uses Config's
 *   fallback) verifies against -> every authenticated acceptance request
 *   401s with `[AuthMiddleware] Verification failed`.
 *
 *   `.env` question (investigated): no committed `.env` / `.env.local`
 *   exists anywhere in this repo (repo root or `server/`) that would supply
 *   JWT_SECRET. A `server/.env.test` file DOES exist and DOES contain a
 *   `JWT_SECRET` line, but it is DEAD — `server/src/config/loadEnv.ts` only
 *   ever reads `.env` / `.env.local` (repo-root or `server/`), never
 *   `.env.test`, and a repo-wide grep confirms nothing in the codebase
 *   references `.env.test` at all. So the 37/37-vs-30-failing discrepancy
 *   between prior session runs and Codex's fresh-shell run is explained by
 *   an AMBIENT `JWT_SECRET` exported in one shell's environment and not the
 *   other: when it's exported, both fallbacks are skipped and harness +
 *   Config trivially agree (both just use the same ambient value); when
 *   it's unset, the two different hardcoded fallback strings diverge and
 *   auth breaks.
 *
 * FIX: pin ONE explicit secret here and set it as the very first side
 * effect of importing this module — before any dynamic import of
 * `server/src/config/Config.ts` / the auth middleware can occur — plus an
 * explicit divergence guard (`assertJwtSecretHermetic`) that fails loudly if
 * harness and the real Config ever disagree again for any reason.
 *
 * Why "first executable statement" is safe here even though ESM hoists all
 * static imports ahead of any module body: none of the OTHER static imports
 * used by the INI-005 test files (`express`, `supertest`, `vitest`,
 * `./harness.js`, `./seed.mjs`) transitively load `server/src/config/
 * Config.ts` at static-import time — `seed.mjs` only imports `bcryptjs` and
 * `pg`; `harness.ts` only imports `express`, `jsonwebtoken`, `pg`, and
 * `./seed.mjs`. `server/src/config/Config.ts` (and therefore the auth
 * middleware, which imports it) is only ever reached via the DYNAMIC
 * `await import(...)` calls inside `harness.ts`'s `buildApp()`, which is
 * itself only ever called from inside a `beforeAll` — i.e. at runtime,
 * strictly after every test file's static imports (including this module)
 * have already finished executing. So setting `process.env.JWT_SECRET` in
 * this module's top-level body is guaranteed to run before Config.ts is
 * ever evaluated, regardless of import order within the test file.
 *
 * Import this module FIRST — before `./harness.js` — at the very top of
 * every INI-005 acceptance test file that mints tokens.
 */

export const SHARED_ACCEPTANCE_TEST_JWT_SECRET =
  'shared-acceptance-suite-hermetic-test-secret-do-not-use-elsewhere-32c';

/** @deprecated kept as an alias so any pre-existing importer of the old name still compiles */
export const INI005_TEST_JWT_SECRET = SHARED_ACCEPTANCE_TEST_JWT_SECRET;

// Side effect: runs as soon as this module is imported. See the module
// doc-comment above for why this is guaranteed to happen before Config.ts's
// own JWT_SECRET fallback could ever be evaluated.
process.env.JWT_SECRET = SHARED_ACCEPTANCE_TEST_JWT_SECRET;

/**
 * Fail loudly and immediately if the real server Config's resolved
 * JWT_SECRET ever diverges from what `harness.getJwtSecret()` will sign
 * tokens with (e.g. if someone later changes one fallback string without
 * updating the other, or if this module stops being imported first).
 *
 * Call this as the first line of a `beforeAll` in every acceptance test
 * file that uses `mintToken()`.
 */
export async function assertJwtSecretHermetic(): Promise<void> {
  const [{ getJwtSecret }, { config }] = await Promise.all([
    import('./harness.js'),
    import('../../server/src/config/Config.js'),
  ]);

  const harnessSecret = getJwtSecret();
  const configSecret = config.JWT_SECRET;

  if (harnessSecret !== configSecret) {
    throw new Error(
      '[INI-005 JWT hermeticity] DIVERGENCE DETECTED: harness.getJwtSecret() ' +
        `returned "${harnessSecret}" but the real server Config resolved ` +
        `JWT_SECRET to "${configSecret}". mintToken() and the real ` +
        'verifyToken middleware would sign/verify with DIFFERENT secrets — ' +
        'every authenticated request in this suite would 401. Check that ' +
        "tests/acceptance/sharedAcceptanceJwtSecret.ts is imported first " +
        "(before './harness.js') in this test file, and that " +
        'process.env.JWT_SECRET is not being overwritten elsewhere after ' +
        'that import.'
    );
  }
}
