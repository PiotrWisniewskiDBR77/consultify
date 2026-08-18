/**
 * AMD-FLOW-ROI-VISIBILITY-002 (Variant B) — ROI read surface INVENTORY ratchet.
 *
 * RENAMED FROM roiReadSurfaceManifest.test.ts (originally landed as
 * b34e48c8b0). That name and its `classification: 'UNCLASSIFIED'` field on
 * every entry were CTO-reviewed and rejected as unable to support any
 * authority or closure claim, for two independent reasons that this
 * rewrite fixes one of and states plainly instead of fixing the other:
 *
 *  1. The detector missed whole classes of ROI reads: schema-qualified
 *     `public.rvn_roi_*`, quoted identifiers (`"rvn_roi_cases"`,
 *     `"public"."rvn_roi_cases"`), and dynamically-concatenated queries
 *     (table name assembled from a variable, so the literal text
 *     `FROM rvn_roi_...` never appears in the file). FIXED below — see
 *     DETECTION RULES and the self-tests that prove it, not merely claim
 *     it, including a negative control.
 *
 *  2. Forty entries all reading `UNCLASSIFIED` looks like "40 files
 *     inventoried and pending classification" but is trivially misreadable
 *     as "40 files classified (as unclassified)" — and worse, a reader
 *     citing this suite for "the ROI surface is accounted for" would be
 *     citing an inventory as if it were an authority audit. NOT fixed by
 *     assigning verdicts: verifying whether each of these 40 files
 *     correctly routes through the governed authority
 *     (`resolveRoiGovernedVisibility`, visibilityResolver.ts) requires
 *     reading each file's call chain individually. That has not been done
 *     here. Assigning 40 verdicts without having done that reading would
 *     be answering a question with a guess dressed as a fact — worse than
 *     not answering it. So: THE `classification` FIELD IS REMOVED, NOT
 *     RENAMED. `ROI_READ_SURFACE_INVENTORY` below is `readonly string[]`,
 *     not an array of `{path, classification}` objects — there is
 *     structurally no field left to misread as a verdict.
 *
 * THIS FILE, ON ITS OWN, CANNOT CLOSE THE F2 GOVERNED-ROI-AUTHORITY
 * QUESTION. It proves a list of files exists and stays current. It proves
 * NOTHING about whether any of them actually reach `resolveRoiGovernedVisibility`
 * before returning data. Do not cite this suite, or a green run of it, as
 * evidence that ROI visibility is "handled" or "covered" for any file it
 * lists. The question this suite answers is narrower and stated precisely:
 * "does a ROI-reading file exist that nobody has looked at yet" — never
 * "has every ROI-reading file been looked at and found correct".
 *
 * UNVERIFIED BLAST RADIUS — stated as UNVERIFIED, not as "known" and
 * absolutely not as "out of scope" or closed. An independent audit found,
 * and this file's author re-verified directly against this worktree:
 *   - 40 files under `tests/` call `createRoiCase(` — confirmed count:
 *     `grep -rlE "createRoiCase\(" --include="*.test.ts" tests/ server/src`.
 *   - Exactly one (`server/src/services/resultsVnext/platform/__tests__/roiOpenOrgBackfillVariantB.realdb.test.ts`,
 *     landed in this packet's own commit chain) exercises the real governed
 *     mechanism against a real Postgres. The other 39 were not individually
 *     re-run or read by this author.
 *   - One of those 39, `tests/resultsVnext/roi/roiCaseCreate.test.ts`, was
 *     RUN, not merely reasoned about, on this date: **4 of 4 tests in that
 *     file currently FAIL**, all with `RoiCaseCreationNotAuthorizedError`
 *     / `NO_GOVERNED_POLICY` — reproduced with the exact stack trace
 *     rooted at `roiCaseCommands.ts:361` (the `resolveRoiGovernedVisibility`
 *     gate this packet's Variant B commit added). Root cause traced to the
 *     file's own mock: `roiCaseCreate.test.ts:257-258` mocks
 *     `server/src/database/PostgresDatabase.js`'s `acquirePgClient` with a
 *     `fakeQuery` (defined at line 131) that pattern-matches a handful of
 *     known queries and falls through to `{ rows: [], rowCount: 0 }` for
 *     anything else (line 254) — including the `rvn_roi_visibility_governance`
 *     lookup `resolveRoiGovernedVisibility` now issues, which the mock has
 *     no branch for. Empty rows there reads as `NO_GOVERNED_POLICY`, which
 *     denies every actor, which is why every success-path test in that
 *     file now throws before it can assert anything.
 *   - The remaining 38 files are UNVERIFIED. Not assumed broken, not
 *     assumed fine. Whoever picks this up next should not treat "40 files
 *     call createRoiCase(" as background noise — it is the single largest
 *     open question this packet has not answered.
 *
 * DETECTION RULES (applied to every non-test `.ts` file under `server/src`)
 *   (a) direct SQL against the vNext canonical ROI schema: `FROM`/`JOIN`
 *       (case-insensitive) followed by an `rvn_roi_*` table name, now
 *       tolerant of an optional `public.`/`"public".` schema qualifier and
 *       optional double-quoting of either the schema or the table
 *       identifier, in any combination, OR
 *   (b) filename matches `RoiLegacyArchive` — the read-only legacy-table
 *       archive family (`routes/resultsVnext/roiLegacyArchive.routes.ts`,
 *       `services/resultsVnext/roi/roiLegacyArchiveRepository.ts`), which
 *       reads ROI-domain data under pre-vNext table names
 *       (`roi_assumptions`, `benefits_register`,
 *       `v8_roi_realization_entries`, ...) that rule (a) cannot see by
 *       design (they are not `rvn_roi_*`) — caught by NAME so a future
 *       `RoiLegacyArchiveV2*` sibling is still caught, not just the two
 *       files that happen to exist today, OR
 *   (c) NEW — a dynamically-constructed query: a `FROM`/`JOIN` immediately
 *       followed by a template interpolation (`${...}`) or string
 *       concatenation (`'...' +`), in a file that ALSO contains an
 *       `rvn_roi_*` token as a quoted string literal somewhere (single,
 *       double, or backtick-quoted). This is a HEURISTIC, stated as one:
 *       it cannot verify that the interpolated value is exactly that
 *       literal at runtime, and it can theoretically false-positive on a
 *       file that builds an unrelated dynamic query while separately
 *       mentioning an `rvn_roi_*` name in a comment. That is an accepted,
 *       deliberate tradeoff — a false positive here costs one human minute
 *       to read and dismiss; a false negative hides a real ROI reader
 *       permanently. Over-triggering is the safe failure direction for a
 *       ratchet; under-triggering is not.
 *
 * NOT IN SCOPE (deliberately, unchanged from the prior version of this
 * file): the much larger population of pre-vNext V8 ROI/benefits readers
 * scattered across `services/v8/*`, `routes/*.routes.ts` (e.g.
 * `resultsROIService.ts`, `benefits.routes.ts`,
 * `executiveAggregateService.ts`) that read the SAME legacy table names as
 * the archive above but are not part of this packet's vNext consolidation
 * and are not reachable through `resultsVnext`. Pulling those in would
 * bury the signal this ratchet exists to give. If ROI-VISIBILITY work
 * later extends to that legacy surface, it needs its own inventory, not a
 * silent widening of this one's detection rule.
 *
 * WHY THIS IS NOT CIRCULAR
 * The inventory below is a literal, checked-in array — but it is graded
 * against a live filesystem scan, not against itself. A file matching the
 * detection rule that is missing from the array fails the run by name. An
 * inventory entry whose file no longer exists on disk also fails the run
 * by name, so the inventory cannot rot into fiction either.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const SERVER_SRC = path.resolve(__dirname, '../../../..');

/**
 * THE INVENTORY.
 *
 * Every production file under `server/src` that reads ROI data, per the
 * detection rules above. Plain paths, NOT `{path, classification}` objects
 * — see the file header for why the classification field was removed
 * rather than populated. Measured directly with the detector this file
 * itself implements (see `discoverRoiReadSurfaces`, below); re-running the
 * expanded detector (rules a/b/c) against this exact worktree found the
 * SAME 40 files rule (a) alone found before this rewrite — nothing in this
 * codebase today actually uses schema-qualification, quoting, or dynamic
 * table concatenation for an `rvn_roi_*` read. That is a fact about today's
 * code, not a property of the detector — the self-tests below prove the
 * detector's capability independently of what it happens to find right now.
 */
const ROI_READ_SURFACE_INVENTORY: readonly string[] = [
  'routes/resultsVnext/roiLegacyArchive.routes.ts',
  'services/finance/canonical/roiFinanceLinkAdapter.ts',
  'services/finance/canonical/roiFinanceReconciliationAdapter.ts',
  'services/resultsVnext/platform/financeProjectionConsumer.ts',
  'services/resultsVnext/platform/myworkProjectionConsumer.ts',
  'services/resultsVnext/platform/visibilityResolver.ts',
  'services/resultsVnext/roi/roiActualEntryCommands.ts',
  'services/resultsVnext/roi/roiActualEntryRepository.ts',
  'services/resultsVnext/roi/roiActualSnapshotCommands.ts',
  'services/resultsVnext/roi/roiActualSnapshotRepository.ts',
  'services/resultsVnext/roi/roiApprovalSnapshotRepository.ts',
  'services/resultsVnext/roi/roiAssumptionCommands.ts',
  'services/resultsVnext/roi/roiBaselineCommands.ts',
  'services/resultsVnext/roi/roiBenefitEvidenceLinkCommands.ts',
  'services/resultsVnext/roi/roiBenefitLineCommands.ts',
  'services/resultsVnext/roi/roiBenefitsRealizationCommands.ts',
  'services/resultsVnext/roi/roiBenefitsRealizationRepository.ts',
  'services/resultsVnext/roi/roiCalculationPolicyCommands.ts',
  'services/resultsVnext/roi/roiCalculationRunCommands.ts',
  'services/resultsVnext/roi/roiCaseApprovalCommands.ts',
  'services/resultsVnext/roi/roiCaseCommands.ts',
  'services/resultsVnext/roi/roiCompareRepository.ts',
  'services/resultsVnext/roi/roiCostLineCommands.ts',
  'services/resultsVnext/roi/roiEconomicModelReadiness.ts',
  'services/resultsVnext/roi/roiEconomicModelRepository.ts',
  'services/resultsVnext/roi/roiFinanceLinkCommands.ts',
  'services/resultsVnext/roi/roiFinanceLinkRepository.ts',
  'services/resultsVnext/roi/roiFinanceProjectionRepository.ts',
  'services/resultsVnext/roi/roiFinanceReconciliationCommands.ts',
  'services/resultsVnext/roi/roiForecastVersionCommands.ts',
  'services/resultsVnext/roi/roiForecastVersionRepository.ts',
  'services/resultsVnext/roi/roiLegacyArchiveRepository.ts',
  'services/resultsVnext/roi/roiOrgPerspectiveRepository.ts',
  'services/resultsVnext/roi/roiPirCommands.ts',
  'services/resultsVnext/roi/roiPirRepository.ts',
  'services/resultsVnext/roi/roiRepository.ts',
  'services/resultsVnext/roi/roiScenarioCommands.ts',
  'services/resultsVnext/roi/roiTrackingCommands.ts',
  'services/resultsVnext/roi/roiVarianceCommands.ts',
  'services/resultsVnext/roi/roiVarianceRepository.ts',
];

/** Rule (a): direct SQL against an `rvn_roi_*` table, tolerant of an
 * optional `public.` (quoted or not) schema qualifier and optional
 * quoting of the table identifier itself, case-insensitive on FROM/JOIN. */
const DIRECT_ROI_SQL = /\b(FROM|JOIN)\s+(?:"?public"?\s*\.\s*)?"?rvn_roi_[A-Za-z0-9_]*"?/i;

/** Rule (b): the named legacy-archive family — see file header. */
const LEGACY_ARCHIVE_NAME = /RoiLegacyArchive/i;

/** Rule (c): a query-shaped FROM/JOIN whose table is a template
 * interpolation or string-concatenation, combined with an `rvn_roi_*`
 * string-literal token anywhere in the same file. Deliberately a
 * heuristic that over-triggers rather than under-triggers — see file
 * header "DETECTION RULES (c)". */
const DYNAMIC_TABLE_QUERY = /\b(FROM|JOIN)\s*(?:\$\{|['"]?\s*\+)/i;
const RVN_ROI_STRING_LITERAL = /['"`]rvn_roi_[A-Za-z0-9_]*['"`]/;

function isRoiReadSurface(relativePath: string, source: string): boolean {
  if (DIRECT_ROI_SQL.test(source)) return true;
  if (LEGACY_ARCHIVE_NAME.test(path.basename(relativePath))) return true;
  if (DYNAMIC_TABLE_QUERY.test(source) && RVN_ROI_STRING_LITERAL.test(source)) return true;
  return false;
}

/**
 * Walks `server/src`, skipping `__tests__` directories and `*.test.ts` /
 * `*.spec.ts` files (those are test code, not production read surfaces —
 * and several of them intentionally contain `rvn_roi_` SQL fixtures/mocks
 * that would otherwise pollute the count). Returns every `.ts` file path,
 * relative to `server/src`, that matches the detection rules.
 */
function discoverRoiReadSurfaces(dir = '.'): string[] {
  const found: string[] = [];
  const walk = (relative: string): void => {
    const absolute = path.join(SERVER_SRC, relative);
    for (const entry of readdirSync(absolute)) {
      const relativeEntry = relative === '.' ? entry : path.posix.join(relative, entry);
      const entryAbsolute = path.join(SERVER_SRC, relativeEntry);
      const stats = statSync(entryAbsolute);
      if (stats.isDirectory()) {
        if (entry === '__tests__' || entry === 'node_modules') continue;
        walk(relativeEntry);
        continue;
      }
      if (!entry.endsWith('.ts')) continue;
      if (entry.endsWith('.test.ts') || entry.endsWith('.spec.ts')) continue;
      const source = readFileSync(entryAbsolute, 'utf8');
      if (isRoiReadSurface(relativeEntry, source)) found.push(relativeEntry);
    }
  };
  walk(dir);
  return found.sort();
}

describe('ROI read surface inventory — ratchet gate (inventory only, NOT an authority audit)', () => {
  it('SANITY: the detection rule finds a non-zero number of files (a silently-empty regex is a false green)', () => {
    const discovered = discoverRoiReadSurfaces();
    expect(discovered.length).toBeGreaterThan(0);
    // Pinned so a rule that quietly stops matching (or starts over-matching)
    // is itself visible as a diff here, not just as an inventory mismatch.
    expect(discovered.length).toBe(ROI_READ_SURFACE_INVENTORY.length);
  });

  it('FAILS on any ROI read surface on disk that is not in the inventory — unlisted means RED', () => {
    const discovered = discoverRoiReadSurfaces();
    const inventoryPaths = new Set(ROI_READ_SURFACE_INVENTORY);

    const unlisted = discovered.filter((file) => !inventoryPaths.has(file));

    const messages = unlisted.map(
      (file) =>
        `UNLISTED ROI read surface: ${file}\n` +
        `  This file matches the ROI-read detection rule (direct SQL against ` +
        `an rvn_roi_* table, a dynamically-constructed rvn_roi_* query, or the ` +
        `RoiLegacyArchive family) but has no entry in ROI_READ_SURFACE_INVENTORY ` +
        `in this file ` +
        `(server/src/services/resultsVnext/platform/__tests__/roiReadSurfaceInventory.test.ts).\n` +
        `  ACTION: add this path to the inventory array. Do NOT delete or skip this ` +
        `test to make it pass, and do NOT assign this file a verdict this suite has ` +
        `no field for — just add the path.`
    );

    expect(messages, messages.join('\n\n')).toEqual([]);
  });

  it('FAILS if an inventory entry no longer exists on disk — the inventory cannot rot into fiction', () => {
    const missing = ROI_READ_SURFACE_INVENTORY.filter((entryPath) => {
      try {
        statSync(path.join(SERVER_SRC, entryPath));
        return false;
      } catch {
        return true;
      }
    });

    const messages = missing.map(
      (entryPath) =>
        `STALE inventory entry: ${entryPath}\n` +
        `  This path no longer exists on disk. Update or remove this entry in ` +
        `ROI_READ_SURFACE_INVENTORY (it was likely moved, renamed, or deleted) ` +
        `so the inventory keeps describing the real tree.`
    );

    expect(messages, messages.join('\n\n')).toEqual([]);
  });

  it('has no duplicate paths in the inventory', () => {
    const seen = new Set<string>();
    const duplicates = ROI_READ_SURFACE_INVENTORY.filter((p) => {
      if (seen.has(p)) return true;
      seen.add(p);
      return false;
    });
    expect(duplicates).toEqual([]);
  });

  describe('detector self-tests (synthetic fixtures, not real files — prove capability independently of what the real tree happens to contain today)', () => {
    it('CATCHES a schema-qualified table reference: FROM public.rvn_roi_cases', () => {
      const source = 'await client.query(`SELECT * FROM public.rvn_roi_cases WHERE x = $1`, [x]);';
      expect(isRoiReadSurface('positive-control-schema-qualified.ts', source)).toBe(true);
    });

    it('CATCHES a double-quoted identifier form: FROM "public"."rvn_roi_cases"', () => {
      const source = 'await client.query(`SELECT * FROM "public"."rvn_roi_cases" WHERE x = $1`, [x]);';
      expect(isRoiReadSurface('positive-control-quoted-identifier.ts', source)).toBe(true);
    });

    it('CATCHES a dynamically-concatenated query string (table name assembled from a variable, ' +
      'so the literal text "FROM rvn_roi_" never appears)', () => {
      const source =
        "const table = 'rvn_roi_' + 'cases';\n" +
        'await client.query(`SELECT * FROM ${table} WHERE x = $1`, [x]);';
      expect(source.includes('FROM rvn_roi_')).toBe(false); // confirms this is a genuine evasion of rule (a) alone
      expect(isRoiReadSurface('positive-control-dynamic-concat.ts', source)).toBe(true);
    });

    it('CATCHES a legacy-table read via the RoiLegacyArchive filename family (rule b), independent of table name', () => {
      const source = 'await client.query(`SELECT * FROM roi_assumptions WHERE x = $1`, [x]);';
      expect(DIRECT_ROI_SQL.test(source)).toBe(false); // confirms rule (a) alone cannot see a legacy table name
      expect(isRoiReadSurface('roiLegacyArchiveFixture.ts', source)).toBe(true);
    });

    it('DOES NOT fire on a negative control: rvn_roi_ mentioned only in a comment, next to an ' +
      'unrelated real query — proves this is not a bare substring match', () => {
      const source =
        '// This helper intentionally does NOT read rvn_roi_cases; see roiRepository.ts instead.\n' +
        "export async function unrelatedHelper(db: { query: (s: string) => unknown }) {\n" +
        "  return db.query('SELECT 1');\n" +
        '}\n';
      expect(isRoiReadSurface('negative-control-comment-only.ts', source)).toBe(false);
    });
  });
});
