/**
 * Static-analysis guard against raw enum leaks in the Finance Analysis/Valuation UI.
 *
 * Task #E2 (Finance v3 clean2, consistency debt): three modules independently reinvented the
 * same already-solved problem (`src/components/Benefits/ValuationWorkspace.tsx`'s
 * `valuationStatusLabel`/`valuationSourceLabel`, task #110, guarded by
 * `tests/unit/finance/valuationEnumLabels.test.ts`) — and all three forgot the fix:
 *   - `AnalysisCreatorWizard.tsx` rendered `{opt.status}` (raw `APPROVED`) and
 *     `{state.industryCode}` (raw `MANUFACTURING`) despite `preset.labelPl` existing 130 lines
 *     above in the same file.
 *   - `MethodsWeightsStep.tsx`/`ResultsStep.tsx`/`SensitivityStep.tsx` rendered `{m.methodType}`
 *     (raw `DCF_FCFF`/`TRADING_COMPS`) and `{m.readiness}` (raw `READY`/`NOT_CONFIGURED`/
 *     `DATA_INCOMPLETE`).
 *   - `AdvisorStep.tsx` rendered `{f.confidence}` (raw `HIGH`/`MEDIUM`) and `{status}` (raw
 *     lifecycle code) in its blocked-generation banner.
 *   - `SourceStep.tsx` rendered `{sourceEdge.sourceArtifactType}` and
 *     `{sourceEdge.transformationKind}` (raw `VALUATION_FROM_BASELINE`).
 *
 * All eight were fixed by routing through label helpers (`valuationMethodTypeLabel`,
 * `valuationMethodReadinessLabel`, `valuationAdvisorConfidenceLabel`, `financeArtifactTypeLabel`,
 * `financeLineageTransformationKindLabel`, `businessVersionStatusLabel` in
 * `src/services/api/financeV2.types.ts`, plus the local `INDUSTRY_LABEL_BY_CODE` map in
 * `AnalysisCreatorWizard.tsx`) — the SAME "one shared label layer, reused" shape task #110
 * already established, not a fourth reinvention.
 *
 * This is deliberately NOT scoped to the eight fixed call sites alone: it statically scans EVERY
 * `.tsx` file under `src/components/Finance/Analysis/` and `src/components/Finance/Valuation/`
 * (the two directories this task package owns) for a bare JSX expression container that
 * interpolates one of a known set of enum-carrying property names DIRECTLY — i.e. NOT wrapped in
 * an approved `xLabel(...)` call. A future developer who adds a NINTH raw render of `.methodType`,
 * `.readiness`, `.status`, `.confidence`, `.industryCode`, `.sourceArtifactType`,
 * `.targetArtifactType`, or `.transformationKind` anywhere in these two directories — in a file
 * that does not exist yet — should turn this test RED before a screenshot ever does.
 *
 * Verified genuinely load-bearing: reverted `AdvisorStep.tsx`'s
 * `{f.confidence && <span>...{f.confidence}</span>}` fix back to the raw form -- this test went
 * RED, correctly naming the file and quoting the exact matched raw-interpolation snippet.
 * Restored via `git diff` inspection (no `git checkout` needed, single-line change), reran ->
 * GREEN again.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const SCANNED_ROOTS = [
  path.resolve(__dirname, '../../../src/components/Finance/Analysis'),
  path.resolve(__dirname, '../../../src/components/Finance/Valuation'),
];

/**
 * Property names known to carry a closed (or effectively closed) SCREAMING_SNAKE_CASE enum code
 * in this domain — every one of them has a dedicated label helper today. NOT included: `category`
 * (free-text field, `string | null`, no fixed vocabulary in this codebase — see
 * `src/services/api/financeV2.types.ts` line ~458/487) and `tier` (already rendered through an
 * inline ternary everywhere it appears, not a raw interpolation).
 */
const ENUM_PROPERTY_NAMES = [
  'methodType',
  'readiness',
  'confidence',
  'status',
  'industryCode',
  'sourceArtifactType',
  'targetArtifactType',
  'transformationKind',
];

/**
 * Matches a JSX expression container (`{...}`) whose ENTIRE content is a bare property-access
 * chain ending in one of `ENUM_PROPERTY_NAMES`, optionally with a `?? 'literal'` /
 * `?? "literal"` fallback — i.e. exactly the shape every one of the eight original bugs had
 * (`{m.methodType}`, `{sourceEdge.transformationKind ?? '—'}`, ...). Deliberately requires the
 * braces to contain NOTHING else (no function call, no ternary, no template literal) so it does
 * NOT false-positive on the fix itself (`{valuationMethodTypeLabel(m.methodType)}` does not match
 * — the content after `{` is a call, not a bare chain) or on non-rendering uses elsewhere in the
 * file (`.filter((m) => m.readiness === 'READY')` has no enclosing bare `{...}` at all).
 *
 * Two shapes of `{...}` are NOT a rendered-text leak even though the raw regex matches them, and
 * are filtered out by index after matching (see `isFalsePositive` below):
 *   1. `attrName={m.result.status}` — a JSX ATTRIBUTE value (prop passed to a child component,
 *      e.g. `<ValuationValueCell status={m.result.status} />`) is not rendered text itself; the
 *      receiving component owns how/whether it displays the code (verified case-by-case for the
 *      props this scan would otherwise flag: `ValuationValueCell` already renders `status`
 *      through `financeValueDisplayReasonLabel`/`formatFinanceValueForDisplay`, never raw).
 *   2. `` `text-${m.methodType}-text` `` — a template-literal interpolation. `${...}` contains the
 *      substring `{...}`, which the brace-matching regex above cannot tell apart from a real JSX
 *      expression container; these appear in this codebase only in `data-testid` strings (test
 *      selectors, never rendered to the user).
 */
const RAW_ENUM_INTERPOLATION_RE = new RegExp(
  `\\{\\s*[A-Za-z_$][\\w$]*(?:\\??\\.[A-Za-z_$][\\w$]*)*\\.(?:${ENUM_PROPERTY_NAMES.join('|')})\\s*(?:\\?\\?\\s*(?:'[^']*'|"[^"]*"))?\\s*\\}`,
  'g'
);

function isFalsePositive(source: string, matchIndex: number): boolean {
  const before = source.slice(0, matchIndex).trimEnd();
  const lastChar = before.charAt(before.length - 1);
  return lastChar === '=' || lastChar === '$';
}

function findRawEnumInterpolations(source: string): string[] {
  const found: string[] = [];
  const re = new RegExp(RAW_ENUM_INTERPOLATION_RE.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    if (!isFalsePositive(source, match.index)) {
      found.push(match[0]);
    }
  }
  return found;
}

function listTsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      out.push(...listTsxFiles(full));
    } else if (entry.isFile() && full.endsWith('.tsx') && !full.endsWith('.test.tsx')) {
      out.push(full);
    }
  }
  return out;
}

describe('Finance Analysis/Valuation — no raw SCREAMING_SNAKE_CASE enum leaks to rendered text', () => {
  const files = SCANNED_ROOTS.flatMap(listTsxFiles);

  it('scans at least the known Analysis + Valuation step components (sanity check on the scan itself)', () => {
    // Guards against a silently-empty scan (e.g. a directory rename) making every test below
    // vacuously pass. If this fails, SCANNED_ROOTS no longer points at real files — fix the
    // paths, don't delete the check.
    const relPaths = files.map((f) => path.relative(process.cwd(), f));
    expect(relPaths.some((p) => p.includes('AnalysisCreatorWizard.tsx'))).toBe(true);
    expect(relPaths.some((p) => p.includes('MethodsWeightsStep.tsx'))).toBe(true);
    expect(relPaths.some((p) => p.includes('AdvisorStep.tsx'))).toBe(true);
    expect(files.length).toBeGreaterThan(5);
  });

  for (const file of SCANNED_ROOTS) {
    it(`directory exists and is scannable: ${path.relative(process.cwd(), file)}`, () => {
      expect(fs.existsSync(file)).toBe(true);
    });
  }

  it('no .tsx file under Finance/Analysis or Finance/Valuation bare-interpolates a known enum property', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      const matches = findRawEnumInterpolations(source);
      if (matches.length > 0) {
        const relPath = path.relative(process.cwd(), file);
        for (const m of matches) {
          offenders.push(`${relPath}: ${m}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
