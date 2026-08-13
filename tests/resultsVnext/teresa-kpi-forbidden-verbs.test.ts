/**
 * KPI-E006 — static, grep-able proof that Teresa has no code path to
 * approve/verify/close a KPI or deviation case.
 *
 * Design: docs/product/results-vnext/KPI_E006_TERESA_DESIGN.md §D.
 * "Static, grep-able proof (stronger than a behavioral test — cannot be
 * bypassed by a dynamic-import trick, since the existing `tryImport()`
 * pattern in this file takes a fixed specifier, never a runtime-constructed
 * function name)".
 *
 * -- DEVIATION FROM DESIGN: §D's own illustrative bash snippet says:
 *   grep -nE "approveDefinitionVersion|rejectDefinitionVersion|...|reopenDeviationCase" \
 *     server/src/services/v8/teresaCopilotService.ts server/src/services/v8/teresaCopilotCanon.ts
 *   # Expected: ZERO matches.
 * That is factually impossible once `P08_KPI_FORBIDDEN_VERBS`
 * (teresaCopilotCanon.ts, §A of the same design doc) exists — it is a
 * `string[]` literally containing every one of those verb names, in one of
 * the exact two files the snippet greps. Verified directly: `grep -c` for
 * the verb list against both files after landing §A/§B returns non-zero
 * (the FORBIDDEN_VERBS declaration line itself, plus one explanatory
 * comment in teresaCopilotService.ts referencing `approvePlan()` by name to
 * describe why self-approval enforcement still works downstream — that
 * comment is copied near-verbatim from this SAME design doc's own §B code).
 * A literal zero-substring-match assertion would therefore be **always
 * false by construction**, not a meaningful regression guard. The nearest
 * safe equivalent — and the one this file actually implements — is the
 * REAL invariant the design's prose around the snippet describes: Teresa
 * never IMPORTS (and therefore can never CALL) any forbidden verb. That is
 * exactly what the whitelist-import check below proves, and it is immune to
 * the same "the string appears in a comment" false-positive that a raw
 * substring assertion would trip over.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { P08_KPI_FORBIDDEN_VERBS } from '../../server/src/services/v8/teresaCopilotCanon.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

const CANON_PATH = path.join(REPO_ROOT, 'server/src/services/v8/teresaCopilotCanon.ts');
const SERVICE_PATH = path.join(REPO_ROOT, 'server/src/services/v8/teresaCopilotService.ts');

const canonSource = readFileSync(CANON_PATH, 'utf8');
const serviceSource = readFileSync(SERVICE_PATH, 'utf8');

/** The whitelist §D pins: "KPI imports are limited to the 6-name whitelist
 * (createKpiDraft, editDraft, submitRootCause, getKpi, listKpis,
 * getDeviationCase)". `editDraft` is imported aliased
 * (`editDraft as editKpiDraft`) — both the original and the alias are
 * accepted below (the alias is what the rest of the file actually uses;
 * the original name is what appears right after the `import {`). */
const ALLOWED_KPI_IMPORT_NAMES = new Set([
  'createKpiDraft',
  'editDraft',
  'editKpiDraft',
  'submitRootCause',
  'getKpi',
  'listKpis',
  'getDeviationCase',
]);

describe('KPI-E006 — Teresa forbidden-verbs static proof', () => {
  it('P08_KPI_FORBIDDEN_VERBS is a non-empty, exact match of the 11 verbs the design pins', () => {
    expect([...P08_KPI_FORBIDDEN_VERBS].sort()).toEqual(
      [
        'approveDefinitionVersion',
        'rejectDefinitionVersion',
        'activateKpi',
        'suspendKpi',
        'archiveKpi',
        'verifyMeasurement',
        'disputeMeasurement',
        'approvePlan',
        'submitEffectivenessVerification',
        'closeDeviationCase',
        'reopenDeviationCase',
      ].sort()
    );
  });

  it('every KPI-domain import in teresaCopilotService.ts comes from resultsVnext/kpi/ and every imported name is in the 6-name whitelist', () => {
    const importLines = serviceSource
      .split('\n')
      .filter((line) => /from '\.\.\/resultsVnext\/kpi\//.test(line));

    // Pinned by §D: "Expected — exactly these 4 lines, nothing else."
    expect(importLines).toHaveLength(4);

    const importedNames: string[] = [];
    for (const line of importLines) {
      const match = line.match(/^import\s*\{([^}]+)\}\s*from/);
      expect(match, `unrecognized import line shape: ${line}`).not.toBeNull();
      const names = match![1]
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .flatMap((part) => {
          // `editDraft as editKpiDraft` -> both tokens are meaningful; a
          // plain `getKpi` -> just itself.
          const asMatch = part.match(/^(\S+)\s+as\s+(\S+)$/);
          return asMatch ? [asMatch[1], asMatch[2]] : [part];
        });
      importedNames.push(...names);
    }

    expect(importedNames.length).toBeGreaterThan(0);
    for (const name of importedNames) {
      expect(ALLOWED_KPI_IMPORT_NAMES.has(name), `unexpected KPI-domain import: ${name}`).toBe(true);
    }
  });

  it('no forbidden verb is ever imported into teresaCopilotService.ts or teresaCopilotCanon.ts — the only mechanism by which Teresa could call one', () => {
    // Real invariant behind §D's illustrative (but literally-impossible, see
    // header) "ZERO matches" grep: a forbidden verb must never appear as an
    // IMPORTED BINDING (the only way JS/TS code can invoke a function it
    // does not define locally) in either file. Free-text mentions (this
    // file's own header, or an explanatory code comment) are explicitly not
    // what §D's underlying architectural claim is about, and are excluded
    // by construction here.
    const importBlockPattern = /^import\s+.*?;?\s*$/gm;
    for (const source of [canonSource, serviceSource]) {
      const importLines = (source.match(importBlockPattern) ?? []).join('\n');
      for (const verb of P08_KPI_FORBIDDEN_VERBS) {
        expect(importLines.includes(verb), `forbidden verb "${verb}" appears in an import statement`).toBe(
          false
        );
      }
    }
  });

  it('no forbidden verb is ever called as a function in teresaCopilotService.ts (a `verb(` invocation pattern)', () => {
    for (const verb of P08_KPI_FORBIDDEN_VERBS) {
      // Matches `verb(` optionally preceded by `.`/`await `/whitespace, but
      // NOT inside a plain-English sentence like "the real gate is
      // approvePlan() downstream" — that phrasing still contains
      // `approvePlan(` textually, so this check is intentionally scoped to
      // lines that are not comments (comments are permitted documentation,
      // per this design's own §B source, which documents the deny gate by
      // name; the architectural guarantee is about REACHABLE CODE, and a `//`
      // line is never reachable code).
      const codeLines = serviceSource
        .split('\n')
        .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'));
      const callPattern = new RegExp(`(?<![A-Za-z0-9_'"])${verb}\\s*\\(`);
      const offendingLine = codeLines.find((line) => callPattern.test(line));
      expect(offendingLine, `forbidden verb "${verb}" appears to be called in reachable code`).toBeUndefined();
    }
  });

  it('P08_KPI_FORBIDDEN_VERBS itself never appears in any *executable* (non-comment) line outside its own declaration in teresaCopilotCanon.ts', () => {
    const declarationLine = canonSource.split('\n').findIndex((line) => line.includes('P08_KPI_FORBIDDEN_VERBS ='));
    expect(declarationLine).toBeGreaterThanOrEqual(0);

    const canonLines = canonSource.split('\n');
    // Find the end of the array literal (the line with the closing `] as const;`).
    let endLine = declarationLine;
    while (!canonLines[endLine]!.includes('as const;')) endLine += 1;

    for (const verb of P08_KPI_FORBIDDEN_VERBS) {
      const occurrences = canonLines.reduce(
        (count, line, idx) => (idx < declarationLine || idx > endLine ? count + (line.includes(verb) ? 1 : 0) : count),
        0
      );
      expect(occurrences, `"${verb}" appears in teresaCopilotCanon.ts outside the P08_KPI_FORBIDDEN_VERBS declaration`).toBe(
        0
      );
    }
  });
});
