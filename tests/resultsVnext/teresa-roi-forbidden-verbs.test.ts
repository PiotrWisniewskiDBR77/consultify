/**
 * ROI-E008 — static, grep-able proof that Teresa has no code path to
 * create/model/submit/approve/reject/forecast/record-actual/verify/
 * dispute/schedule/close an ROI Case or PIR.
 *
 * Design: docs/product/results-vnext/ROI_E008_DESIGN.md §2/A3.
 * Structurally identical to `teresa-kpi-forbidden-verbs.test.ts` (KPI-E006),
 * with the SAME "literal-zero-substring-match-is-impossible-by-construction"
 * caveat that file's own header documents: `P08_ROI_FORBIDDEN_VERBS` is
 * itself a `string[]` living in one of the two files a naive grep would
 * search, so a raw substring-count assertion would always be non-zero
 * (the declaration line itself). The real invariant proven below — same as
 * the KPI precedent — is that Teresa never IMPORTS (and therefore can never
 * CALL) any forbidden verb; free-text mentions in comments/declarations are
 * explicitly not what the architectural guarantee is about.
 *
 * Three checks (design §2/A3):
 *   1. Import whitelist: exactly the 2 `from '../resultsVnext/roi/...'`
 *      lines A1 pins, nothing else.
 *   2. Forbidden-verb grep: zero of `P08_ROI_FORBIDDEN_VERBS` ever imported
 *      or called as a function in teresaCopilotService.ts/
 *      teresaCopilotCanon.ts.
 *   3. Static UPDATE-clause check: `recordRoiPirTeresaLessonsDraft`'s own
 *      `UPDATE ... SET` clause (roiPirCommands.ts) writes ONLY
 *      `teresa_draft_lessons_payload`/`teresa_draft_generated_at`/
 *      `row_version`/`updated_by`/`updated_at` — never `lessons_learned` or
 *      any other narrative column. This is the epic's core correctness
 *      guarantee (AC-03).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { P08_ROI_FORBIDDEN_VERBS } from '../../server/src/services/v8/teresaCopilotCanon.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

const CANON_PATH = path.join(REPO_ROOT, 'server/src/services/v8/teresaCopilotCanon.ts');
const SERVICE_PATH = path.join(REPO_ROOT, 'server/src/services/v8/teresaCopilotService.ts');
const PIR_COMMANDS_PATH = path.join(REPO_ROOT, 'server/src/services/resultsVnext/roi/roiPirCommands.ts');

const canonSource = readFileSync(CANON_PATH, 'utf8');
const serviceSource = readFileSync(SERVICE_PATH, 'utf8');
const pirCommandsSource = readFileSync(PIR_COMMANDS_PATH, 'utf8');

/** The whitelist A1 pins: "Only 2 imports" —
 * `recordRoiPirTeresaLessonsDraft` (roiPirCommands.js, NEW) and
 * `getRoiPostInvestmentReview` (roiPirRepository.js, read-only). */
const ALLOWED_ROI_IMPORT_NAMES = new Set(['recordRoiPirTeresaLessonsDraft', 'getRoiPostInvestmentReview']);

describe('ROI-E008 — Teresa forbidden-verbs static proof', () => {
  it('P08_ROI_FORBIDDEN_VERBS is a non-empty array', () => {
    expect(P08_ROI_FORBIDDEN_VERBS.length).toBeGreaterThan(0);
  });

  it('P08_ROI_FORBIDDEN_VERBS never includes recordRoiPirTeresaLessonsDraft (the one exception)', () => {
    expect((P08_ROI_FORBIDDEN_VERBS as readonly string[]).includes('recordRoiPirTeresaLessonsDraft')).toBe(false);
  });

  it('every ROI-domain import in teresaCopilotService.ts comes from resultsVnext/roi/ and every imported name is in the 2-name whitelist', () => {
    const importLines = serviceSource
      .split('\n')
      .filter((line) => /from '\.\.\/resultsVnext\/roi\//.test(line));

    // Pinned by A1: "Only 2 imports" — exactly these 2 lines, nothing else.
    expect(importLines).toHaveLength(2);

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
      expect(ALLOWED_ROI_IMPORT_NAMES.has(name), `unexpected ROI-domain import: ${name}`).toBe(true);
    }
  });

  it('no forbidden verb is ever imported into teresaCopilotService.ts or teresaCopilotCanon.ts — the only mechanism by which Teresa could call one', () => {
    const importBlockPattern = /^import\s+.*?;?\s*$/gm;
    for (const source of [canonSource, serviceSource]) {
      const importLines = (source.match(importBlockPattern) ?? []).join('\n');
      for (const verb of P08_ROI_FORBIDDEN_VERBS) {
        expect(importLines.includes(verb), `forbidden verb "${verb}" appears in an import statement`).toBe(false);
      }
    }
  });

  it('no forbidden verb is ever called as a function in teresaCopilotService.ts (a `verb(` invocation pattern)', () => {
    const codeLines = serviceSource
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'));
    for (const verb of P08_ROI_FORBIDDEN_VERBS) {
      const callPattern = new RegExp(`(?<![A-Za-z0-9_'"])${verb}\\s*\\(`);
      const offendingLine = codeLines.find((line) => callPattern.test(line));
      expect(offendingLine, `forbidden verb "${verb}" appears to be called in reachable code`).toBeUndefined();
    }
  });

  it('P08_ROI_FORBIDDEN_VERBS itself never appears in any *executable* (non-comment) line outside its own declaration in teresaCopilotCanon.ts', () => {
    const declarationLine = canonSource.split('\n').findIndex((line) => line.includes('P08_ROI_FORBIDDEN_VERBS ='));
    expect(declarationLine).toBeGreaterThanOrEqual(0);

    const canonLines = canonSource.split('\n');
    let endLine = declarationLine;
    while (!canonLines[endLine]!.includes('as const;')) endLine += 1;

    for (const verb of P08_ROI_FORBIDDEN_VERBS) {
      const occurrences = canonLines.reduce(
        (count, line, idx) => (idx < declarationLine || idx > endLine ? count + (line.includes(verb) ? 1 : 0) : count),
        0
      );
      expect(
        occurrences,
        `"${verb}" appears in teresaCopilotCanon.ts outside the P08_ROI_FORBIDDEN_VERBS declaration`
      ).toBe(0);
    }
  });

  describe('Static UPDATE-clause check — recordRoiPirTeresaLessonsDraft (AC-03 core guarantee)', () => {
    it('the UPDATE ... SET clause writes only the 5 permitted columns, never lessons_learned/outcome/recommendation/open_variance_waiver_reason', () => {
      const fnStart = pirCommandsSource.indexOf('export async function recordRoiPirTeresaLessonsDraft');
      expect(fnStart, 'recordRoiPirTeresaLessonsDraft not found in roiPirCommands.ts').toBeGreaterThan(-1);

      // Isolate this function's body — up to the next top-level `export`
      // (or EOF), same bounding technique used to isolate a single function
      // in a large source file without a full parser.
      const rest = pirCommandsSource.slice(fnStart + 'export async function recordRoiPirTeresaLessonsDraft'.length);
      const nextExportIdx = rest.indexOf('\nexport ');
      const fnBody = nextExportIdx === -1 ? rest : rest.slice(0, nextExportIdx);

      const updateMatch = fnBody.match(/UPDATE\s+rvn_roi_post_investment_reviews\s+SET([\s\S]*?)WHERE/);
      expect(updateMatch, 'no UPDATE ... SET ... WHERE clause found in recordRoiPirTeresaLessonsDraft').not.toBeNull();
      const setClause = updateMatch![1]!;

      // Permitted columns (design's own AC-03 pin).
      for (const permitted of [
        'teresa_draft_lessons_payload',
        'teresa_draft_generated_at',
        'row_version',
        'updated_by',
        'updated_at',
      ]) {
        expect(setClause.includes(permitted), `expected SET clause to write "${permitted}"`).toBe(true);
      }

      // Forbidden columns — the epic's entire correctness guarantee is that
      // NONE of these are ever touched by this function.
      for (const forbidden of [
        'lessons_learned',
        'outcome',
        'recommendation',
        'open_variance_waiver_reason',
        'teresa_draft_disposition',
        'finalized_by',
        'finalized_at',
      ]) {
        expect(
          setClause.includes(forbidden),
          `recordRoiPirTeresaLessonsDraft's UPDATE SET clause must NEVER write "${forbidden}" — AC-03 violation`
        ).toBe(false);
      }
    });
  });
});
