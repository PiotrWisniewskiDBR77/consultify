/**
 * TLS-04 fix packet (Codex BLOCKER 1) — standing writer inventory.
 *
 * `swot_proposals.expected_version` / `acceptSwotProposal`'s optimistic-
 * concurrency CAS is only meaningful if `tool_sessions.version` genuinely
 * moves on EVERY write that changes SWOT content (`answers_json`). This is a
 * static-analysis guard, not a runtime test: it scans the ENTIRE
 * `server/src` tree (not just `ToolController.ts`) for every place SQL sets
 * `answers_json` on `tool_sessions` and asserts a `version = version + 1`
 * bump exists in the SAME enclosing method (function/handler) -- not
 * necessarily the same literal SQL statement, since this codebase's real
 * writer (`updateToolSession`) builds its SET clause DYNAMICALLY
 * (`setClauses.push('answers_json = ?')` / `setClauses.push('version =
 * version + 1')` as separate pushes, joined into one statement at runtime)
 * -- a naive single-statement-text check would silently miss that pattern
 * entirely (confirmed: an earlier, single-statement-only version of this
 * test stayed GREEN even after physically deleting the version-bump push,
 * because the literal SQL text `UPDATE tool_sessions SET
 * ${setClauses.join(', ')} ...` never contains the substring "answers_json"
 * at all -- it's assembled from variables). Method-boundary-scoped
 * proximity search is what actually catches this codebase's real
 * writer shape.
 *
 * This is deliberately NOT scoped to `ToolController.ts` alone -- a FUTURE
 * writer added anywhere in the codebase (a new controller, a new service, a
 * new route file) that sets `answers_json` without bumping `version` should
 * turn this test RED before it ever reaches a real database.
 *
 * Verified genuinely load-bearing: temporarily removed the
 * `setClauses.push('version = version + 1')` line from
 * `updateToolSession` in `ToolController.ts` -- this test went RED,
 * correctly naming `updateToolSession` and quoting the answers_json push it
 * found with no nearby version bump. Restored via `git checkout --
 * server/src/controllers/ToolController.ts` (verified with `git diff`),
 * reran -> GREEN again.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const SERVER_SRC = path.resolve(__dirname, '../../../server/src');

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      out.push(...listSourceFiles(full));
    } else if (
      (entry.name.endsWith('.ts') || entry.name.endsWith('.js')) &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.test.js') &&
      !entry.name.endsWith('.d.ts')
    ) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Matches BOTH shapes this codebase actually uses to set answers_json on
 * tool_sessions: a literal SQL fragment (`answers_json = $1` / `= ?` inside
 * a template literal) AND a dynamically-pushed SET-clause fragment
 * (`setClauses.push('answers_json = ?')`).
 */
const ANSWERS_JSON_SET_RE = /answers_json\s*=\s*(\$\d+|\?)/g;

/** Matches the version-bump fragment, however it appears (literal or pushed). */
const VERSION_BUMP_RE = /version\s*=\s*version\s*\+\s*1/;

/**
 * "which enclosing method am I in" boundary finder. Deliberately narrow --
 * only this controller-class style (`static someMethod = asyncHandler(`,
 * confirmed as EVERY relevant method's exact declaration shape in this
 * file) and a plain top-level `async function name(` / `function name(` for
 * service files. An earlier, looser 3-way alternation (also matching bare
 * `const x = (` / `const x = async (`) was too permissive -- it fired on
 * unrelated inner `const` closures inside a method body, which silently
 * widened the search window past the METHOD's real end and let it pick up
 * an unrelated LATER method's version bump, making this test pass even with
 * the guard it's supposed to check physically deleted. Verified: this
 * exact narrower pattern correctly turns RED when
 * updateToolSession's version-bump push is removed (see the file header).
 */
const METHOD_BOUNDARY_RE =
  /(?:^|\n)\s*(?:static\s+\w+\s*=\s*asyncHandler\s*\(|(?:export\s+)?(?:async\s+)?function\s+\w+\s*\()/g;

function findMethodWindow(source: string, occurrenceIndex: number): { start: number; end: number } {
  const boundaries: number[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(METHOD_BOUNDARY_RE);
  while ((m = re.exec(source))) boundaries.push(m.index);

  let start = 0;
  let end = source.length;
  for (let i = 0; i < boundaries.length; i++) {
    if (boundaries[i] <= occurrenceIndex) {
      start = boundaries[i];
    } else {
      end = boundaries[i];
      break;
    }
  }
  return { start, end };
}

describe('TLS-04 standing inventory: every UPDATE tool_sessions writer touching answers_json bumps version', () => {
  it('scans the whole server/src tree -- zero writers set answers_json without version = version + 1 in the same method', () => {
    const files = listSourceFiles(SERVER_SRC);
    expect(files.length).toBeGreaterThan(50); // sanity: the scan actually walked the real tree

    const offenders: string[] = [];
    let answersJsonWriteSites = 0;

    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      if (!source.includes('tool_sessions')) continue; // cheap pre-filter
      if (!source.includes('answers_json')) continue;

      let match: RegExpExecArray | null;
      const re = new RegExp(ANSWERS_JSON_SET_RE);
      while ((match = re.exec(source))) {
        const { start, end } = findMethodWindow(source, match.index);
        const windowText = source.slice(start, end);

        // Only count sites that are plausibly about tool_sessions -- the
        // "is this about tool_sessions" check MUST use the same
        // method-boundary window as the version-bump check below, not a
        // fixed-radius slice: this codebase's real writer
        // (updateToolSession) builds its SQL statement (which mentions
        // "UPDATE tool_sessions") near the TOP of the method, but pushes
        // 'answers_json = ?' onto setClauses much further down (a fixed
        // ~1500-char radius missed it entirely in an earlier version of
        // this test, silently skipping the one real writer this test
        // exists to check).
        if (!windowText.includes('tool_sessions')) continue;

        answersJsonWriteSites++;
        if (!VERSION_BUMP_RE.test(windowText)) {
          const lineNo = source.slice(0, match.index).split('\n').length;
          offenders.push(
            `${path.relative(SERVER_SRC, file)}:${lineNo} — sets answers_json on tool_sessions with no "version = version + 1" found in the same enclosing method`
          );
        }
      }
    }

    // Sanity: this inventory must have actually found at least the known
    // real writer (updateToolSession) -- if this drops to 0 the scan itself
    // is broken (e.g. the codebase's writer shape changed), which would
    // silently defeat the whole point of this test.
    expect(answersJsonWriteSites).toBeGreaterThanOrEqual(1);

    if (offenders.length > 0) {
      throw new Error(
        `Found ${offenders.length} tool_sessions writer(s) that set answers_json WITHOUT bumping version in the same method (breaks swot_proposals CAS -- a stale AI proposal could silently clobber a newer manual edit):\n\n${offenders.join('\n')}`
      );
    }

    expect(offenders).toHaveLength(0);
  });
});
