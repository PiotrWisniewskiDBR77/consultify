/**
 * mutantLoader.ts — the "odwróć zabezpieczenie i udowodnij, że test staje
 * się CZERWONY" harness for negative-controls.test.ts.
 *
 * HOW IT WORKS
 * ------------
 * For each of the ten negative controls we need to run the REAL scenario
 * assertion twice: once against the real, unmutated code (must be green —
 * proven already by domain/**.test.ts and scenarios/*.test.ts) and once
 * against a text-mutated copy of exactly ONE protection (must go red — if it
 * stays green, the protection is fictional and that is reported as a
 * defect).
 *
 * Every file under server/src/services/meetingCore/ is copied VERBATIM into
 * a fresh temp directory (one directory per test, randomly named, deleted in
 * `cleanup()`), then EXACTLY the requested substring is mutated in EXACTLY
 * the requested file. All the sibling files stay byte-identical to the real
 * repo — a mutation to (say) lifecycle.ts still runs against the REAL
 * repo.ts, auditLog.ts, errors.ts, types.ts, meetingCoreService.ts, outputs.ts.
 * This is "wstrzyknij zmutowaną zależność przez istniejący szew": the
 * "seam" is the module boundary between these sibling files — we swap out
 * ONE file's contents and let the rest of the (still real) module graph
 * import it normally via ordinary relative specifiers, because the mutant
 * directory contains a complete, self-consistent copy of the whole package.
 *
 * The only cross-directory runtime import in this package is
 * `../../utils/pgTransaction.js` (from meetingCoreService.ts and
 * outputs.ts) — since utils/pgTransaction.ts is NOT copied (it is never the
 * target of a mutation in this suite, and copying it would require 'pg' to
 * be resolvable from the temp directory, which os.tmpdir() cannot
 * guarantee), that one import specifier is rewritten to an absolute
 * `file://` URL pointing at the REAL repo file. Every other import stays a
 * plain relative specifier resolved against the sibling copies in the same
 * temp directory.
 *
 * `server/src/services/meetingCore/**` and `server/src/utils/pgTransaction.ts`
 * are read-only inputs here — this module only ever WRITES into a directory
 * under `os.tmpdir()`, and `cleanup()` removes it. Nothing under `server/src`
 * is ever modified.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MEETING_CORE_DIR = resolve(__dirname, '../../../server/src/services/meetingCore');
const PG_TRANSACTION_ABS = resolve(__dirname, '../../../server/src/utils/pgTransaction.ts');

/** Every file in server/src/services/meetingCore/ that a mutant module graph needs, copied verbatim unless targeted by a Mutation. */
const SIBLING_FILES = [
  'types.ts',
  'errors.ts',
  'auditLog.ts',
  'lifecycle.ts',
  'repo.ts',
  'outputsMaterializer.ts',
  'meetingCoreService.ts',
  'outputs.ts',
] as const;

export type MeetingCoreFile = (typeof SIBLING_FILES)[number];

export interface Mutation {
  /** Which sibling file to mutate. */
  file: MeetingCoreFile;
  /** Exact substring that must be present in the REAL file (asserted — throws loudly if the real source has drifted). */
  find: string;
  /** Replacement text. */
  replace: string;
  /** Human-readable description, used in assertion failure messages. */
  label: string;
}

export interface Mutant {
  dir: string;
  /** import() this to get the mutant's meetingCoreService module. */
  importMeetingCoreService: () => Promise<
    typeof import('../../../server/src/services/meetingCore/meetingCoreService.js')
  >;
  /** import() this to get the mutant's outputs module. */
  importOutputs: () => Promise<
    typeof import('../../../server/src/services/meetingCore/outputs.js')
  >;
  /** import() this to get the mutant's lifecycle module. */
  importLifecycle: () => Promise<
    typeof import('../../../server/src/services/meetingCore/lifecycle.js')
  >;
  /** import() this to get the mutant's repo module. */
  importRepo: () => Promise<typeof import('../../../server/src/services/meetingCore/repo.js')>;
  /** Deletes the temp directory. Always call this, even on failure — use try/finally. */
  cleanup: () => void;
}

const PG_TRANSACTION_IMPORT_RE = /(['"])\.\.\/\.\.\/utils\/pgTransaction\.js\1/g;

/**
 * Builds one mutant copy of the meetingCore package with the given
 * mutation(s) applied. Verifies each `find` string actually exists in the
 * real source before mutating (a silent no-op mutation would be worse than
 * no test at all — see module docstring in negative-controls.test.ts).
 */
export function buildMutant(mutations: Mutation[]): Mutant {
  const dir = mkdtempSync(join(tmpdir(), 'consultify-meeting-core-mutant-'));

  for (const file of SIBLING_FILES) {
    const srcPath = join(MEETING_CORE_DIR, file);
    let content = readFileSync(srcPath, 'utf8');

    content = content.replace(
      PG_TRANSACTION_IMPORT_RE,
      (_m, quote: string) => `${quote}${pathToFileURL(PG_TRANSACTION_ABS).href}${quote}`
    );

    for (const mutation of mutations.filter((m) => m.file === file)) {
      if (!content.includes(mutation.find)) {
        throw new Error(
          `[mutantLoader] Mutation "${mutation.label}" expected to find the substring below in ${file} but it is not there ` +
            `(real source has likely changed — update the mutation, do not silently skip it):\n${mutation.find}`
        );
      }
      content = content.split(mutation.find).join(mutation.replace);
    }

    writeFileSync(join(dir, file), content, 'utf8');
  }

  let cleaned = false;
  const cleanup = (): void => {
    if (cleaned) return;
    cleaned = true;
    rmSync(dir, { recursive: true, force: true });
  };

  const importFile = (file: MeetingCoreFile) => pathToFileURL(join(dir, file)).href;

  return {
    dir,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    importMeetingCoreService: () =>
      import(/* @vite-ignore */ importFile('meetingCoreService.ts')) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    importOutputs: () => import(/* @vite-ignore */ importFile('outputs.ts')) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    importLifecycle: () => import(/* @vite-ignore */ importFile('lifecycle.ts')) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    importRepo: () => import(/* @vite-ignore */ importFile('repo.ts')) as any,
    cleanup,
  };
}
