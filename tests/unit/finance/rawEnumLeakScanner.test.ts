/**
 * Static-analysis guard against raw enum leaks in the Finance UI.
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
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * SCOPE HISTORY — read before narrowing SCANNED_ROOTS again
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * This scanner originally hardcoded exactly two directories (`Finance/Analysis`,
 * `Finance/Valuation` — the two this task package owned at the time). Independent Gate J
 * verification (2026-08-12, AP-CLIENT package) flagged that as a measurement-tool bug, not a
 * coverage gap: a scanner with a hand-picked scope silently returns green for every file outside
 * it, and five AP-CLIENT directories (`Finance/compare`, `Finance/comments`, `Finance/lineage`,
 * `Finance/savedViews`, `Finance/exportImport`) were never scanned at all. This is the third time
 * in this program a measurement tool quietly lied about its own coverage (see
 * `verify-schema-vs-migrations.ts`'s bad parser producing false "missing migration" reports, and a
 * dev-render harness showing an ON state under an OFF label) — so the fix is structural, not just
 * "add five directories to the list":
 *   1. `SCANNED_ROOTS` now names ONE directory, `src/components/Finance`, and `listTsxFiles`
 *      recurses into every subdirectory under it. No directory can be silently excluded by a
 *      future rename/addition — new subdirectories are picked up automatically.
 *   2. The "sanity check on the scan itself" test below now asserts a much higher minimum file
 *      count (40, current actual is 44) instead of the old `> 5`. If someone reintroduces a
 *      narrow root, or a refactor breaks discovery, the file count collapses back toward ~13
 *      (the old Analysis+Valuation-only count) and this test goes RED loudly, before the "zero
 *      offenders" test gets a chance to vacuously pass on an empty scan.
 *   3. `src/components/Economics/**` was evaluated and deliberately NOT added to this scanner's
 *      scope (see EXTENDED SCOPE section below) — it is a materially different domain with its
 *      own concurrent-edit risk, not an oversight.
 *
 * NEW LEAK FOUND when the scope widened to all of `Finance/**` (files that were never reachable
 * under the old two-directory scope):
 *   - `src/components/Finance/FinancialStatementPackWorkspace.tsx` renders `{file.status}` (raw
 *     lowercase `pending`/`ready`/`recoverable` from `s.readinessStatus`, untranslated — the same
 *     file already has a `t(...)`-routed label for the sibling `packRow.status` a few hundred
 *     lines up, so this is the same bug family, just missed). NOT fixed in this pass: this file
 *     is a `*Workspace.tsx` file, and per this session's explicit hand-off boundary two other
 *     agents were concurrently editing FinanceHub.tsx and the workspace files it mounts
 *     (AP-mount / P0-RBAC packages). Editing a workspace file here risked colliding with that
 *     work. It is tracked below in `KNOWN_UNFIXED_LEAKS` with a staleness check so the exception
 *     cannot silently rot once someone does fix it.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * EXTENDED SCOPE CONSIDERED: src/components/Economics/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * Probed manually (same regex, same false-positive filter) against `src/components/Economics/**`
 * (55 `.tsx` files): it DOES contain matching bare interpolations — `FinanceLanePanel.tsx`
 * (`{kpiCoherence.status}`), `panels/BankingValuePanel.tsx` (`{statusResult.status}`),
 * `panels/ExtendedRatiosPanel.tsx` (`{r.status}`, `{benchmark.status}`), and
 * `panels/ValueCapturePipelinePanel.tsx` (`{gate.status}`). Decided NOT to fold these into this
 * scanner's enforced scope, for three reasons:
 *   1. Domain mismatch — Economics is KPI/valuation-office/banking-value tooling, not the
 *      Analysis/Valuation/AP-CLIENT surface this test package owns; its `.status` values may not
 *      even be the same SCREAMING_SNAKE_CASE vocabulary this scanner's property list targets.
 *   2. `src/components/Economics/FinanceHub.tsx` sits in the same directory tree and is the exact
 *      file this session was told not to touch (concurrent AP-mount/RBAC work); enforcing this
 *      scanner over `Economics/**` would mean either leaving it permanently red (an offender this
 *      agent is not allowed to fix) or growing the `KNOWN_UNFIXED_LEAKS` allowlist for an entire
 *      second domain on day one, which defeats the point of the assertion.
 *   3. This is a decision to revisit, not a closed door: if a future Finance-v3 task package picks
 *      up `Economics/**` as owned scope, add it as a second entry in `SCANNED_ROOTS` and let the
 *      minimum-file-count assertion below grow accordingly (it will need raising past the current
 *      Finance-only count).
 *
 * This is deliberately NOT scoped to the eight originally-fixed call sites alone: it statically
 * scans EVERY `.tsx` file under `src/components/Finance/**` for a bare JSX expression container
 * that interpolates one of a known set of enum-carrying property names DIRECTLY — i.e. NOT
 * wrapped in an approved `xLabel(...)` call. A future developer who adds a raw render of
 * `.methodType`, `.readiness`, `.status`, `.confidence`, `.industryCode`, `.sourceArtifactType`,
 * `.targetArtifactType`, or `.transformationKind` anywhere under `Finance/**` — in a file that
 * does not exist yet — should turn this test RED before a screenshot ever does.
 *
 * Verified genuinely load-bearing: reverted `AdvisorStep.tsx`'s
 * `{f.confidence && <span>...{f.confidence}</span>}` fix back to the raw form -- this test went
 * RED, correctly naming the file and quoting the exact matched raw-interpolation snippet.
 * Restored via `git diff` inspection (no `git checkout` needed, single-line change), reran ->
 * GREEN again.
 *
 * Re-verified after the 2026-08-12 scope widening with a NEGATIVE CONTROL in a directory the old
 * scope never touched: temporarily added `{cmp.status}` to
 * `src/components/Finance/compare/FinanceComparePanel.tsx` (one of the five previously-blind
 * AP-CLIENT directories) — the "no offenders" test went RED and named the exact file/line; the
 * inserted line was then removed and the test went GREEN again. See
 * `docs/validation/finance-v3/generated/gate-e/FIX_SCANNER_V8DELETE_report.md` for the transcript.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * KNOWN BLIND SPOTS — this scanner is a regex over source text, not a parser. It does NOT catch:
 * ══════════════════════════════════════════════════════════════════════════════════════════
 *   1. Intermediate variable:      `const s = m.status; return <div>{s}</div>;`
 *      (the JSX expression contains a bare identifier, not a property-access chain ending in an
 *      enum name — the enum access happened on the line above, out of view of the regex.)
 *   2. Template literal built from a variable:
 *      `const s = m.status; return <div>{`Status: ${s}`}</div>;`
 *      (same root cause as #1, plus the template-literal wrapping in #3/#4.)
 *   3. Direct template literal:    `<div>{`${m.status}`}</div>`
 *      (the brace's content starts with a backtick, not `[A-Za-z_$]`, so the bare-chain regex
 *      never matches — even though `m.status` is interpolated directly, one line away from the
 *      exact shape of the eight original bugs.)
 *   4. String concatenation:       `<div>{'Status: ' + m.status}</div>`
 *      (the `+` operator makes the brace content a BinaryExpression, not a bare chain, so it
 *      falls outside the regex the same way a function call does.)
 *   A reader who sees this test GREEN has proof there is no *literal, single-hop, bare-brace*
 *   enum leak in the scanned scope — not proof the UI never renders a raw enum code by any means.
 *   Treat green as "no regression of the exact bug shape we've hit four times," not as an
 *   absolute guarantee.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const SCANNED_ROOTS = [path.resolve(__dirname, '../../../src/components/Finance')];

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

/**
 * Real, currently-present leaks this pass found but deliberately did NOT fix — see the
 * "SCOPE HISTORY" doc comment above for why each one is here instead of being fixed on the spot.
 * Every entry MUST be a file this agent is barred from editing for a documented, session-specific
 * reason (never "ran out of time" or "seemed low priority"). The staleness test below fails if an
 * entry stops being a real offender — remove the entry then, don't leave it as dead weight.
 */
const KNOWN_UNFIXED_LEAKS = new Set<string>([
  'src/components/Finance/FinancialStatementPackWorkspace.tsx: {file.status}',
]);

describe('Finance/** — no raw SCREAMING_SNAKE_CASE enum leaks to rendered text', () => {
  const files = SCANNED_ROOTS.flatMap(listTsxFiles);

  it('scans a realistic slice of Finance/** (sanity check on the scan itself — MUST fail loudly on an empty/shrunk scope)', () => {
    // Guards against a silently-empty (or silently-narrowed) scan making every test below
    // vacuously pass. If this fails, SCANNED_ROOTS no longer points at real files, or discovery
    // regressed back toward the old two-directory scope (~13 files) — fix the root, don't lower
    // this threshold to make it pass. Actual count at the time this was raised: 44.
    const relPaths = files.map((f) => path.relative(process.cwd(), f));
    expect(relPaths.some((p) => p.includes('AnalysisCreatorWizard.tsx'))).toBe(true);
    expect(relPaths.some((p) => p.includes('MethodsWeightsStep.tsx'))).toBe(true);
    expect(relPaths.some((p) => p.includes('AdvisorStep.tsx'))).toBe(true);
    expect(files.length).toBeGreaterThanOrEqual(40);
  });

  it('discovers all five previously-blind AP-CLIENT directories (compare/comments/lineage/savedViews/exportImport)', () => {
    // These five directories were never reachable under the old hardcoded
    // [Finance/Analysis, Finance/Valuation] SCANNED_ROOTS. Pinning their presence here means a
    // future accidental re-narrowing of SCANNED_ROOTS shows up as a named, specific failure
    // instead of just a smaller number in the count-based sanity check above.
    const relPaths = files.map((f) => path.relative(process.cwd(), f));
    for (const dir of ['compare', 'comments', 'lineage', 'savedViews', 'exportImport']) {
      expect(
        relPaths.some((p) => p.includes(`Finance/${dir}/`) || p.includes(`Finance\\${dir}\\`)),
        `expected at least one scanned file under Finance/${dir}/`
      ).toBe(true);
    }
  });

  for (const file of SCANNED_ROOTS) {
    it(`directory exists and is scannable: ${path.relative(process.cwd(), file)}`, () => {
      expect(fs.existsSync(file)).toBe(true);
    });
  }

  it('no .tsx file under Finance/** bare-interpolates a known enum property (excluding tracked, deliberately-unfixed exceptions)', () => {
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
    const newOffenders = offenders.filter((o) => !KNOWN_UNFIXED_LEAKS.has(o));
    expect(newOffenders).toEqual([]);
  });

  it('KNOWN_UNFIXED_LEAKS entries are still real offenders (fails if someone fixes one without removing the exception)', () => {
    const currentOffenders = new Set<string>();
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      const matches = findRawEnumInterpolations(source);
      const relPath = path.relative(process.cwd(), file);
      for (const m of matches) {
        currentOffenders.add(`${relPath}: ${m}`);
      }
    }
    for (const known of KNOWN_UNFIXED_LEAKS) {
      expect(
        currentOffenders.has(known),
        `${known} is listed as a known-unfixed leak but is no longer detected — remove it from KNOWN_UNFIXED_LEAKS`
      ).toBe(true);
    }
  });
});
