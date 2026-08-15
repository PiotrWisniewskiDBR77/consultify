/**
 * InitiativeDocumentView — SECTION_AI_NOOP membership (K4 AI-fill dispatch).
 *
 * K4 wired REAL AI handlers for 'hypothesis', 'okr' and 'lessons-learned' inside
 * runActiveSectionAi's switch, and removed those three from SECTION_AI_NOOP (the set
 * of sections whose toolbar AI button is disabled because there's no real handler).
 * Regression risk: someone re-adds one of them to the no-op set, silently disabling
 * a shipped AI generator.
 *
 * Why a source-level test, not a component test:
 * SECTION_AI_NOOP is a private `useMemo` inside a ~10k-line component — it is NOT
 * exported and there is no smaller import seam. Rendering the full component to read
 * the set is impractical and brittle (dozens of providers/contexts). So we lock the
 * behavior at the smallest tractable seam: statically parse the SECTION_AI_NOOP Set
 * literal from the source and assert its membership. This still fails loudly if the
 * three K4 sections are re-added to the no-op set, or if the four real no-ops are
 * dropped from it.
 *
 * If SECTION_AI_NOOP is ever exported or extracted to a module, prefer importing it
 * directly and asserting on the runtime value instead of parsing source.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_PATH = path.resolve(
  __dirname,
  '../../src/components/Initiatives/InitiativeDocumentView.tsx'
);

/** Extract the string literals inside the `new Set<string>([ ... ])` passed to the
 *  SECTION_AI_NOOP useMemo. Returns a Set of those literal values. */
function parseSectionAiNoop(source: string): Set<string> {
  const anchor = source.indexOf('const SECTION_AI_NOOP_IDS');
  expect(anchor, 'SECTION_AI_NOOP declaration must exist').toBeGreaterThan(-1);

  // Find the `new Set<string>([` that follows the declaration, then its closing `])`.
  const setOpen = source.indexOf('new Set([', anchor);
  expect(setOpen, 'SECTION_AI_NOOP must initialize a new Set([...])').toBeGreaterThan(-1);
  const arrStart = source.indexOf('[', setOpen);
  const arrEnd = source.indexOf('])', arrStart);
  expect(arrEnd, 'SECTION_AI_NOOP set literal must be closed').toBeGreaterThan(arrStart);

  const body = source.slice(arrStart + 1, arrEnd);
  const literals = body.match(/'([^']+)'|"([^"]+)"/g) ?? [];
  return new Set(literals.map((l) => l.slice(1, -1)));
}

describe('InitiativeDocumentView — SECTION_AI_NOOP (K4 real AI handlers)', () => {
  const source = readFileSync(SOURCE_PATH, 'utf8');
  const noop = parseSectionAiNoop(source);

  it('no longer marks the K4 sections (hypothesis / okr / lessons-learned) as AI no-ops', () => {
    expect(noop.has('hypothesis')).toBe(false);
    expect(noop.has('okr')).toBe(false);
    expect(noop.has('lessons-learned')).toBe(false);
  });

  it('still marks the genuinely-unimplemented sections as AI no-ops', () => {
    expect(noop.has('raci')).toBe(true);
    expect(noop.has('change-log')).toBe(true);
    expect(noop.has('workstream-owners')).toBe(true);
    expect(noop.has('suggested-changes')).toBe(true);
  });

  it('the K4 sections have real case handlers in runActiveSectionAi', () => {
    // Cross-check: the three sections must be reachable as `case '<section>':` in the
    // dispatch switch, proving they were moved to real handlers (not just deleted).
    for (const section of ['hypothesis', 'okr', 'lessons-learned']) {
      expect(source.includes(`case '${section}':`)).toBe(true);
    }
  });
});
