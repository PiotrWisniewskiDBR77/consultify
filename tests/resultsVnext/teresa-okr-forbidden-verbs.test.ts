/**
 * OKR-E008 — static, grep-able proof that Teresa has no code path to
 * approve/submit/score/carry-forward/close a Set, edit/cancel an existing
 * Objective, or ever write an OKR reflection's authoritative narrative
 * fields.
 *
 * Design: docs/product/results-vnext/OKR_E008_DESIGN.md §3.6/§3.8.
 * Structurally identical to `teresa-kpi-forbidden-verbs.test.ts`/
 * `teresa-roi-forbidden-verbs.test.ts`, with the same
 * "literal-zero-substring-match-is-impossible-by-construction" caveat those
 * files' own headers document: `P08_OKR_FORBIDDEN_VERBS` is itself a
 * `string[]` living in one of the two files a naive grep would search, so a
 * raw substring-count assertion would always be non-zero (the declaration
 * line itself). The real invariant proven below — same as both precedents —
 * is that Teresa never IMPORTS (and therefore can never CALL) any forbidden
 * verb; free-text mentions in comments/declarations are explicitly not what
 * the architectural guarantee is about.
 *
 * Five checks:
 *   1. Import whitelist: exactly the 6 `from '../resultsVnext/okr/...'`
 *      lines teresaCopilotService.ts actually carries, nothing else.
 *   2. Forbidden-verb grep: zero of `P08_OKR_FORBIDDEN_VERBS` ever imported
 *      or called as a function in teresaCopilotService.ts/
 *      teresaCopilotCanon.ts.
 *   3. `P08_OKR_FORBIDDEN_VERBS` never mentions Teresa's own three write
 *      calls (`createObjective`/`recordCheckIn`/
 *      `recordOkrReflectionTeresaDraft`) — the ONE-exception pattern both
 *      precedents establish.
 *   4. Static UPDATE-clause check: `recordOkrReflectionTeresaDraft`'s own
 *      `UPDATE ... SET` clause (okrReflectionCommands.ts) writes ONLY
 *      `teresa_draft_reflection_payload`/`teresa_draft_generated_at`/
 *      `row_version`/`updated_by`/`updated_at` — never `what_worked`/
 *      `what_did_not_work`/`why`/`learning`/`next_cycle_change`/
 *      `disposition`/`final_score*`. This is D-OKR8-7's core correctness
 *      guarantee (mirrors ROI-E008's AC-03 check exactly).
 *   5. Static UPDATE-clause check: `recordOkrReflectionTeresaDraftDisposition`'s
 *      own `UPDATE ... SET` clause writes ONLY `teresa_draft_disposition`/
 *      `teresa_draft_disposition_by`/`teresa_draft_disposition_at`/
 *      `row_version`/`updated_by`/`updated_at` — never any of the five
 *      narrative fields either (this file's own deliberate divergence from
 *      ROI's disposition command, which DOES copy text into
 *      `lessons_learned` — see okrReflectionCommands.ts's own header comment
 *      on that command for why OKR's shape differs).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { P08_OKR_FORBIDDEN_VERBS } from '../../server/src/services/v8/teresaCopilotCanon.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const CANON_PATH = path.join(REPO_ROOT, '../server/src/services/v8/teresaCopilotCanon.ts');
const SERVICE_PATH = path.join(REPO_ROOT, '../server/src/services/v8/teresaCopilotService.ts');
const REFLECTION_COMMANDS_PATH = path.join(
  REPO_ROOT,
  '../server/src/services/resultsVnext/okr/okrReflectionCommands.ts'
);

const canonSource = readFileSync(CANON_PATH, 'utf8');
const serviceSource = readFileSync(SERVICE_PATH, 'utf8');
const reflectionCommandsSource = readFileSync(REFLECTION_COMMANDS_PATH, 'utf8');

/** The 6-line, 8-name whitelist teresaCopilotService.ts actually carries —
 * `createObjective` (objective_draft), `getObjective`/`listObjectivesForSet`
 * (objective_quality_review target + duplicate-risk re-check), `getKeyResult`
 * (check_in_assist target read), `recordCheckIn` (check_in_assist write),
 * `listOrganizationOkrAttention` (manager_brief citation source),
 * `recordOkrReflectionTeresaDraft` (reflection_synthesis write),
 * `getOkrSet` (objective_draft's Set visibility check). */
const ALLOWED_OKR_IMPORT_NAMES = new Set([
  'createObjective',
  'getObjective',
  'listObjectivesForSet',
  'getKeyResult',
  'recordCheckIn',
  'listOrganizationOkrAttention',
  'recordOkrReflectionTeresaDraft',
  'getOkrSet',
]);

describe('OKR-E008 — Teresa forbidden-verbs static proof', () => {
  it('P08_OKR_FORBIDDEN_VERBS is a non-empty array', () => {
    expect(P08_OKR_FORBIDDEN_VERBS.length).toBeGreaterThan(0);
  });

  it('P08_OKR_FORBIDDEN_VERBS never includes createObjective/recordCheckIn/recordOkrReflectionTeresaDraft (Teresa\'s own three write calls)', () => {
    const forbidden = P08_OKR_FORBIDDEN_VERBS as readonly string[];
    expect(forbidden.includes('createObjective')).toBe(false);
    expect(forbidden.includes('recordCheckIn')).toBe(false);
    expect(forbidden.includes('recordOkrReflectionTeresaDraft')).toBe(false);
  });

  it('P08_OKR_FORBIDDEN_VERBS DOES include recordOkrReflectionTeresaDraftDisposition/recordObjectiveReflection/finalScoreOkrSet — the human-only commands Teresa never calls', () => {
    const forbidden = P08_OKR_FORBIDDEN_VERBS as readonly string[];
    expect(forbidden.includes('recordOkrReflectionTeresaDraftDisposition')).toBe(true);
    expect(forbidden.includes('recordObjectiveReflection')).toBe(true);
    expect(forbidden.includes('finalScoreOkrSet')).toBe(true);
  });

  it('every OKR-domain import in teresaCopilotService.ts comes from resultsVnext/okr/ and every imported name is in the 8-name whitelist', () => {
    const importLines = serviceSource
      .split('\n')
      .filter((line) => /from '\.\.\/resultsVnext\/okr\//.test(line));

    // Pinned by this file's own header: "exactly the 6 lines", nothing else.
    expect(importLines).toHaveLength(6);

    const importedNames: string[] = [];
    for (const line of importLines) {
      const match = line.match(/^import\s*(?:type\s*)?\{([^}]+)\}\s*from/);
      expect(match, `unrecognized import line shape: ${line}`).not.toBeNull();
      const names = match![1]
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .flatMap((part) => {
          const asMatch = part.match(/^(\S+)\s+as\s+(\S+)$/);
          return asMatch ? [asMatch[1], asMatch[2]] : [part];
        });
      importedNames.push(...names);
    }

    expect(importedNames.length).toBeGreaterThan(0);
    for (const name of importedNames) {
      expect(ALLOWED_OKR_IMPORT_NAMES.has(name), `unexpected OKR-domain import: ${name}`).toBe(true);
    }
  });

  it('no forbidden verb is ever imported into teresaCopilotService.ts or teresaCopilotCanon.ts — the only mechanism by which Teresa could call one', () => {
    const importBlockPattern = /^import\s+.*?;?\s*$/gm;
    for (const source of [canonSource, serviceSource]) {
      const importLines = (source.match(importBlockPattern) ?? []).join('\n');
      for (const verb of P08_OKR_FORBIDDEN_VERBS) {
        expect(importLines.includes(verb), `forbidden verb "${verb}" appears in an import statement`).toBe(false);
      }
    }
  });

  it('no forbidden verb is ever called as a function in teresaCopilotService.ts (a `verb(` invocation pattern)', () => {
    const codeLines = serviceSource
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'));
    for (const verb of P08_OKR_FORBIDDEN_VERBS) {
      const callPattern = new RegExp(`(?<![A-Za-z0-9_'"])${verb}\\s*\\(`);
      const offendingLine = codeLines.find((line) => callPattern.test(line));
      expect(offendingLine, `forbidden verb "${verb}" appears to be called in reachable code`).toBeUndefined();
    }
  });

  it('P08_OKR_FORBIDDEN_VERBS itself never appears in any *executable* (non-comment) line outside its own declaration in teresaCopilotCanon.ts', () => {
    const declarationLine = canonSource.split('\n').findIndex((line) => line.includes('P08_OKR_FORBIDDEN_VERBS ='));
    expect(declarationLine).toBeGreaterThanOrEqual(0);

    const canonLines = canonSource.split('\n');
    let endLine = declarationLine;
    while (!canonLines[endLine]!.includes('as const;')) endLine += 1;

    for (const verb of P08_OKR_FORBIDDEN_VERBS) {
      const occurrences = canonLines.reduce(
        (count, line, idx) => (idx < declarationLine || idx > endLine ? count + (line.includes(verb) ? 1 : 0) : count),
        0
      );
      expect(
        occurrences,
        `"${verb}" appears in teresaCopilotCanon.ts outside the P08_OKR_FORBIDDEN_VERBS declaration`
      ).toBe(0);
    }
  });

  describe('Static UPDATE-clause check — recordOkrReflectionTeresaDraft (D-OKR8-7 core guarantee)', () => {
    it('every UPDATE ... SET clause in the function writes only the 5 permitted columns, never any narrative/score field', () => {
      const fnStart = reflectionCommandsSource.indexOf('export async function recordOkrReflectionTeresaDraft(');
      expect(fnStart, 'recordOkrReflectionTeresaDraft not found in okrReflectionCommands.ts').toBeGreaterThan(-1);

      const rest = reflectionCommandsSource.slice(fnStart);
      const nextExportIdx = rest.indexOf('\nexport ', 1);
      const fnBody = nextExportIdx === -1 ? rest : rest.slice(0, nextExportIdx);

      const updateMatches = [...fnBody.matchAll(/UPDATE\s+okr_vnext_reflections\s+SET([\s\S]*?)WHERE/g)];
      expect(updateMatches.length, 'no UPDATE ... SET ... WHERE clause found in recordOkrReflectionTeresaDraft').toBeGreaterThan(0);

      for (const match of updateMatches) {
        const setClause = match[1]!;
        for (const permitted of ['teresa_draft_reflection_payload', 'teresa_draft_generated_at', 'row_version', 'updated_by', 'updated_at']) {
          expect(setClause.includes(permitted), `expected SET clause to write "${permitted}"`).toBe(true);
        }
        for (const forbidden of [
          'what_worked',
          'what_did_not_work',
          'why =',
          'learning',
          'next_cycle_change',
          'disposition =',
          'final_score',
          'scoring_model_unsupported',
          'finalized_by',
          'finalized_at',
        ]) {
          expect(
            setClause.includes(forbidden),
            `recordOkrReflectionTeresaDraft's UPDATE SET clause must NEVER write "${forbidden}" — D-OKR8-7 violation`
          ).toBe(false);
        }
      }

      // The INSERT path (row does not exist yet) must also never populate a
      // narrative/score column — only the two Teresa-draft columns +
      // identity/audit columns.
      const insertMatch = fnBody.match(/INSERT INTO okr_vnext_reflections\s*\(([\s\S]*?)\)/);
      expect(insertMatch, 'no INSERT INTO okr_vnext_reflections(...) found in recordOkrReflectionTeresaDraft').not.toBeNull();
      const insertColumns = insertMatch![1]!;
      for (const forbidden of ['what_worked', 'what_did_not_work', 'why', 'learning', 'next_cycle_change', 'disposition', 'final_score']) {
        expect(
          insertColumns.includes(forbidden),
          `recordOkrReflectionTeresaDraft's INSERT column list must NEVER include "${forbidden}" — D-OKR8-7 violation`
        ).toBe(false);
      }
    });
  });

  describe('Static UPDATE-clause check — recordOkrReflectionTeresaDraftDisposition (the human-only gate)', () => {
    it('the UPDATE ... SET clause writes only the disposition + audit columns, never any narrative/score field', () => {
      const fnStart = reflectionCommandsSource.indexOf('export async function recordOkrReflectionTeresaDraftDisposition(');
      expect(fnStart, 'recordOkrReflectionTeresaDraftDisposition not found in okrReflectionCommands.ts').toBeGreaterThan(-1);

      const rest = reflectionCommandsSource.slice(fnStart);
      const fnBody = rest; // last function in the file — runs to EOF.

      const updateMatch = fnBody.match(/UPDATE\s+okr_vnext_reflections\s+SET([\s\S]*?)WHERE/);
      expect(updateMatch, 'no UPDATE ... SET ... WHERE clause found in recordOkrReflectionTeresaDraftDisposition').not.toBeNull();
      const setClause = updateMatch![1]!;

      for (const permitted of ['teresa_draft_disposition', 'teresa_draft_disposition_by', 'teresa_draft_disposition_at', 'row_version', 'updated_by', 'updated_at']) {
        expect(setClause.includes(permitted), `expected SET clause to write "${permitted}"`).toBe(true);
      }
      // The authoritative `disposition` column (bare, not the
      // `teresa_draft_disposition*` triplet) must never be assigned here —
      // matched with a negative lookbehind so "teresa_draft_disposition ="
      // itself (permitted, checked above) is not a false positive.
      expect(
        /(?<!teresa_draft_)disposition\s*=/.test(setClause),
        'recordOkrReflectionTeresaDraftDisposition must NEVER write the authoritative "disposition" column'
      ).toBe(false);
      for (const forbidden of [
        'what_worked',
        'what_did_not_work',
        'why =',
        'learning',
        'next_cycle_change',
        'final_score',
        'teresa_draft_reflection_payload', // this command must NEVER also (re)write the draft payload itself — only record its fate.
      ]) {
        expect(
          setClause.includes(forbidden),
          `recordOkrReflectionTeresaDraftDisposition's UPDATE SET clause must NEVER write "${forbidden}"`
        ).toBe(false);
      }
    });
  });
});
