/**
 * WorkbookGeneratorService — A1 PROMPT CONTRACT tests (deterministic, no LLM).
 *
 * Guards the two prompt-level guarantees of the autonomy work:
 *   1. The GENERATION prompt no longer tells the LLM to write a leading "=" in
 *      formulas (that leading "=" is the root cause of corrupted .xlsx — the
 *      builder adds "=" itself and a leading "=" / "==" breaks the file).
 *   2. The prompt teaches the new modeling primitives (scenarioSwitch,
 *      sensitivityTables) so the LLM can reach for them.
 *
 * We assert on the actual prompt source text. The prompts are module-private
 * consts, so we read the service source file directly — this keeps the public
 * API unchanged while still pinning the contract.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVICE_SRC = readFileSync(resolve(__dirname, '../WorkbookGeneratorService.ts'), 'utf8');

/** Isolate the GENERATION_SYSTEM_PROMPT template literal body. */
function generationPrompt(): string {
  const start = SERVICE_SRC.indexOf('const GENERATION_SYSTEM_PROMPT = `');
  expect(start).toBeGreaterThanOrEqual(0);
  const from = SERVICE_SRC.indexOf('`', start) + 1;
  const end = SERVICE_SRC.indexOf('`;', from);
  expect(end).toBeGreaterThan(from);
  return SERVICE_SRC.slice(from, end);
}

describe('WorkbookGeneratorService — A1 prompt contract', () => {
  it('GENERATION prompt does NOT instruct the LLM to write a leading "=" in formulas', () => {
    const p = generationPrompt();

    // The prompt must explicitly forbid the leading "=".
    expect(p.toLowerCase()).toContain('leading');

    // Drop lines that are the EXPLICIT prohibition/negative example (they legitimately
    // mention "=SUM(...)" only to say "do NOT write this"). What remains must contain
    // no formula-shaped example that carries a leading "=".
    const instructionalLines = p
      .split('\n')
      .filter((line) => {
        const l = line.toLowerCase();
        // Keep only lines that are NOT teaching against the leading "=".
        return !(l.includes('leading') || l.includes('do not write') || l.includes(' not "'));
      })
      .join('\n');

    // No "formula": "=..." style values, no bare "=SUM("/"=IF(" example bodies.
    expect(instructionalLines).not.toMatch(/"formula":\s*"=/);
    expect(instructionalLines).not.toMatch(/["'`]=SUM\(/);
    expect(instructionalLines).not.toMatch(/["'`]='[A-Za-z]/); // ='SheetName'!...
    expect(instructionalLines).not.toMatch(/["'`]=IF\(/);
    expect(instructionalLines).not.toMatch(/["'`]=B\d/); // "=B2*C2" etc.
  });

  it('GENERATION prompt references the new modeling primitives', () => {
    const p = generationPrompt();
    expect(p).toContain('scenarioSwitch');
    expect(p).toContain('sensitivityTables');
    // Also teaches input-cell / assumptions discipline (chain of formulas).
    expect(p.toLowerCase()).toContain('assumptions');
    expect(p).toContain('dataValidation');
  });
});
