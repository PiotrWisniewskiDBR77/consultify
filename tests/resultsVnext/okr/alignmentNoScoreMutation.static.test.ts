/**
 * OKR-E005 — no-score-inheritance structural proof, Layer 2 of 4 (design
 * §B): static source-text proof that `okrAlignmentCommands.ts` contains no
 * REACHABLE code path that could mutate an Objective's `progress`/
 * `confidence`/roll-up, in either direction, on either endpoint.
 *
 * Modeled directly on `tests/resultsVnext/teresa-kpi-forbidden-verbs.test.ts`
 * (KPI-E006) — reads the SOURCE TEXT via `readFileSync`, never imports and
 * calls the module, so a dynamic-import trick cannot defeat the check (same
 * rationale that file's own header states verbatim).
 *
 * D09/OKR-F-015 (the defining constraint of this epic): "brak FK/roll-up
 * inheritance" (01_RESULTS_MASTER_IMPLEMENTATION_PLAN.md's D09
 * acceptance-evidence). This file is Layer 2 of the four-layer proof (design
 * §B):
 *   1. DDL absence — server/migrations/20260825_rvn_okr_alignment.sql has no
 *      CREATE TRIGGER.
 *   2. THIS FILE — static source-text proof.
 *   3. realDB full-row-equality proof —
 *      tests/resultsVnext/okr/alignmentNoScoreMutation.realdb.test.ts.
 *   4. DB trigger-introspection proof — same realdb.test.ts file.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const COMMANDS_PATH = path.join(REPO_ROOT, 'server/src/services/resultsVnext/okr/okrAlignmentCommands.ts');
const REPOSITORY_PATH = path.join(REPO_ROOT, 'server/src/services/resultsVnext/okr/okrAlignmentRepository.ts');
const MIGRATION_PATH = path.join(REPO_ROOT, 'server/migrations/20260825_rvn_okr_alignment.sql');

const commandsSource = readFileSync(COMMANDS_PATH, 'utf8');
const repositorySource = readFileSync(REPOSITORY_PATH, 'utf8');
const migrationSource = readFileSync(MIGRATION_PATH, 'utf8');

/**
 * Every exported MUTATION function from okrObjectiveCommands.ts/
 * okrKeyResultCommands.ts that could write to
 * okr_vnext_objectives.progress/confidence (directly or via roll-up
 * recomputation) or okr_vnext_key_results at all. Sourced from a direct
 * `grep -n "^export "` of both files at implementation time (not
 * placeholder names — re-verified against the actually-landed OKR-E003
 * exports, per IO-1).
 */
const OKR_ALIGNMENT_FORBIDDEN_OBJECTIVE_VERBS = [
  'recomputeObjectiveRollup',
  'createObjective',
  'updateObjective',
  'cancelObjective',
  'createKeyResult',
  'updateKeyResult',
  'cancelKeyResult',
] as const;

/** The ONLY name `okrAlignmentCommands.ts`/`okrAlignmentRepository.ts` may
 * import from `okrObjectiveCommands.js` — a pure error CLASS (not a
 * mutation function), reused for the same "Objective not found" condition
 * a propose/accept/reject/remove pre-check can legitimately hit. */
const ALLOWED_OBJECTIVE_COMMANDS_IMPORT_NAMES = new Set(['OkrObjectiveNotFoundError']);

describe('OKR-E005 — Alignment no-score-mutation static proof (Layer 2 of 4)', () => {
  it('okrAlignmentCommands.ts imports from okrObjectiveCommands.js are limited to the OkrObjectiveNotFoundError allowlist', () => {
    const importLines = commandsSource
      .split('\n')
      .filter((line) => /from '\.\/okrObjectiveCommands\.js'/.test(line));

    expect(importLines.length).toBeGreaterThan(0);

    const importedNames: string[] = [];
    for (const line of importLines) {
      const match = line.match(/^import\s*\{([^}]+)\}\s*from/);
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
      expect(
        ALLOWED_OBJECTIVE_COMMANDS_IMPORT_NAMES.has(name),
        `unexpected okrObjectiveCommands.js import in okrAlignmentCommands.ts: ${name}`
      ).toBe(true);
    }
  });

  it('okrAlignmentCommands.ts never imports from okrKeyResultCommands.js at all', () => {
    const hasKeyResultImport = /from '\.\/okrKeyResultCommands\.js'/.test(commandsSource);
    expect(hasKeyResultImport, 'okrAlignmentCommands.ts imports from okrKeyResultCommands.js — it should never need to').toBe(
      false
    );
  });

  it('okrAlignmentRepository.ts imports nothing at all from okrObjectiveCommands.js or okrKeyResultCommands.js', () => {
    expect(/from '\.\/okrObjectiveCommands\.js'/.test(repositorySource)).toBe(false);
    expect(/from '\.\/okrKeyResultCommands\.js'/.test(repositorySource)).toBe(false);
  });

  it('no forbidden Objective/KeyResult mutation verb is ever IMPORTED into okrAlignmentCommands.ts or okrAlignmentRepository.ts — the only mechanism by which either file could call one', () => {
    const importBlockPattern = /^import\s+.*?;?\s*$/gm;
    for (const source of [commandsSource, repositorySource]) {
      const importLines = (source.match(importBlockPattern) ?? []).join('\n');
      for (const verb of OKR_ALIGNMENT_FORBIDDEN_OBJECTIVE_VERBS) {
        expect(importLines.includes(verb), `forbidden verb "${verb}" appears in an import statement`).toBe(false);
      }
    }
  });

  it('no forbidden Objective/KeyResult mutation verb is ever CALLED in reachable (non-comment) code in either file', () => {
    for (const source of [commandsSource, repositorySource]) {
      const codeLines = source.split('\n').filter((line) => {
        const trimmed = line.trim();
        return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/**');
      });
      for (const verb of OKR_ALIGNMENT_FORBIDDEN_OBJECTIVE_VERBS) {
        const callPattern = new RegExp(`(?<![A-Za-z0-9_'"])${verb}\\s*\\(`);
        const offendingLine = codeLines.find((line) => callPattern.test(line));
        expect(offendingLine, `forbidden verb "${verb}" appears to be called in reachable code`).toBeUndefined();
      }
    }
  });

  it('okrAlignmentCommands.ts never contains a raw SQL string targeting okr_vnext_objectives/okr_vnext_key_results as an UPDATE/INSERT/DELETE target — only SELECT reads are permitted', () => {
    // The real invariant behind design §B Layer 2's illustrative regex: this
    // file may SELECT/read okr_vnext_objectives (needed for ownership/
    // cycle/visibility pre-checks) but may NEVER appear as the target of an
    // UPDATE/INSERT/DELETE. Scoped to non-comment lines, same discipline as
    // the call-pattern check above.
    const codeLines = commandsSource.split('\n').filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/**');
    });
    const codeText = codeLines.join('\n');

    const forbiddenWritePattern = /\b(UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+okr_vnext_(objectives|key_results)\b/i;
    expect(
      forbiddenWritePattern.test(codeText),
      'okrAlignmentCommands.ts contains a write statement (UPDATE/INSERT/DELETE) targeting okr_vnext_objectives or okr_vnext_key_results'
    ).toBe(false);

    // Every write this file DOES perform must target okr_vnext_alignments
    // only (or rvn_platform_* platform tables — events/outbox/obligations,
    // written via the shared executeAtomicCreate/executeAtomicCommand/
    // createObligation helpers, never a raw literal in this file for
    // okr_vnext_objectives).
    const alignmentWriteMatches = codeText.match(/\b(UPDATE|INSERT\s+INTO)\s+okr_vnext_alignments\b/gi) ?? [];
    expect(alignmentWriteMatches.length, 'expected at least one write to okr_vnext_alignments (proposeAlignment/accept/reject/remove)').toBeGreaterThan(
      0
    );
  });

  it('okrAlignmentRepository.ts never contains a raw SQL string targeting okr_vnext_objectives/okr_vnext_key_results as a write target (read-only repository)', () => {
    const codeLines = repositorySource.split('\n').filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/**');
    });
    const codeText = codeLines.join('\n');
    const forbiddenWritePattern = /\b(UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+okr_vnext_(objectives|key_results|alignments)\b/i;
    expect(
      forbiddenWritePattern.test(codeText),
      'okrAlignmentRepository.ts contains a write statement — this file must be strictly read-only'
    ).toBe(false);
  });

  it('the alignment migration (20260825_rvn_okr_alignment.sql) declares no CREATE TRIGGER at all — Layer 1 of the four-layer proof, re-asserted here statically alongside Layer 2', () => {
    expect(/CREATE\s+TRIGGER/i.test(migrationSource)).toBe(false);
  });
});
