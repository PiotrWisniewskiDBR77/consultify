/**
 * AMD-FLOW-ROI-VISIBILITY-002 (variant B) — ROI read surface manifest ratchet.
 *
 * WHAT THIS IS FOR
 * ROI visibility is being consolidated onto ONE governed authority
 * (same-tenant ACTIVE OWNER/ADMIN, or a holder of the canonical Finance
 * grant in `rvn_finance_reconciliation_grant_events` with capability
 * `results.roi.finance_reconciliation.resolve` — see
 * `services/resultsVnext/platform/visibilityResolver.ts`). The routing work
 * that wires each surface to that authority is a SNAPSHOT: it decays the
 * moment someone adds a new file that reads ROI data without going through
 * it. This suite is the RATCHET, not the routing. It does not know whether
 * any given file is correctly routed — a separate audit worker produces
 * verified per-file verdicts with file:line evidence. It only refuses to let
 * a new ROI read surface exist un-enumerated.
 *
 * DETECTION RULE (applied to every non-test `.ts` file under `server/src`)
 *   (a) direct SQL against the vNext canonical ROI schema:
 *       `FROM`/`JOIN` followed by an `rvn_roi_*` table name, anywhere in the
 *       file (this is what every repository/command file in
 *       `services/resultsVnext/roi/` and the two `finance/canonical`
 *       adapters trip), OR
 *   (b) filename matches `RoiLegacyArchive` — the read-only legacy-table
 *       archive (`routes/resultsVnext/roiLegacyArchive.routes.ts` and its
 *       `services/resultsVnext/roi/roiLegacyArchiveRepository.ts`) reads
 *       ROI-domain data under pre-vNext table names (`roi_assumptions`,
 *       `benefits_register`, `v8_roi_realization_entries`, ...), so rule
 *       (a) alone would miss it even though it is unmistakably a ROI read
 *       surface. Named explicitly so a `RoiLegacyArchiveV2*` sibling is
 *       still caught by name, not just by luck.
 *
 * NOT IN SCOPE (deliberately): the much larger population of pre-vNext V8
 * ROI/benefits readers scattered across `services/v8/*`, `routes/*.routes.ts`
 * (e.g. `resultsROIService.ts`, `benefits.routes.ts`,
 * `executiveAggregateService.ts`) that read the SAME legacy table names as
 * the archive above but are not part of this packet's vNext consolidation
 * and are not reachable through `resultsVnext`. Pulling those in would bury
 * the signal this ratchet exists to give. If ROI-VISIBILITY work later
 * extends to that legacy surface, it needs its own manifest, not a silent
 * widening of this one's detection rule.
 *
 * WHY THIS IS NOT CIRCULAR
 * The manifest below is a literal, checked-in array — but it is graded
 * against a live filesystem scan, not against itself. A file matching the
 * detection rule that is missing from the array fails the run by name. A
 * manifest entry whose file no longer exists on disk also fails the run by
 * name, so the manifest cannot rot into fiction either.
 *
 * CLASSIFICATION
 * Every entry below carries the placeholder `UNCLASSIFIED`. That is
 * intentional and, on its own, does NOT fail this suite — the bar this
 * suite enforces is "present in the manifest", not "verdict assigned".
 * Populating real verdicts (e.g. ROUTED_TO_GOVERNED_AUTHORITY,
 * BYPASSES_GOVERNED_AUTHORITY, OUT_OF_SCOPE_LEGACY) is the separate audit
 * worker's job; this shape exists so those verdicts drop into the
 * `classification` field of the matching entry without reshaping the array.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const SERVER_SRC = path.resolve(__dirname, '../../../..');

/** Placeholder classification — see file header. Never assigned by this suite. */
const UNCLASSIFIED = 'UNCLASSIFIED' as const;

type RoiReadSurfaceEntry = {
  /** Path relative to `server/src`, forward-slashed. */
  readonly path: string;
  readonly classification: typeof UNCLASSIFIED;
};

/**
 * THE MANIFEST.
 *
 * Every production file under `server/src` that reads ROI data, per the
 * detection rule in the file header. Measured directly with:
 *   grep -rlE '\b(FROM|JOIN)\s+rvn_roi_' --include="*.ts" server/src \
 *     | grep -v '__tests__' | grep -v '\.test\.ts$'
 * plus the two named `RoiLegacyArchive` files. 40 entries total.
 */
const ROI_READ_SURFACE_MANIFEST: readonly RoiReadSurfaceEntry[] = [
  { path: 'routes/resultsVnext/roiLegacyArchive.routes.ts', classification: UNCLASSIFIED },
  { path: 'services/finance/canonical/roiFinanceLinkAdapter.ts', classification: UNCLASSIFIED },
  {
    path: 'services/finance/canonical/roiFinanceReconciliationAdapter.ts',
    classification: UNCLASSIFIED,
  },
  {
    path: 'services/resultsVnext/platform/financeProjectionConsumer.ts',
    classification: UNCLASSIFIED,
  },
  {
    path: 'services/resultsVnext/platform/myworkProjectionConsumer.ts',
    classification: UNCLASSIFIED,
  },
  { path: 'services/resultsVnext/platform/visibilityResolver.ts', classification: UNCLASSIFIED },
  { path: 'services/resultsVnext/roi/roiActualEntryCommands.ts', classification: UNCLASSIFIED },
  { path: 'services/resultsVnext/roi/roiActualEntryRepository.ts', classification: UNCLASSIFIED },
  { path: 'services/resultsVnext/roi/roiActualSnapshotCommands.ts', classification: UNCLASSIFIED },
  {
    path: 'services/resultsVnext/roi/roiActualSnapshotRepository.ts',
    classification: UNCLASSIFIED,
  },
  {
    path: 'services/resultsVnext/roi/roiApprovalSnapshotRepository.ts',
    classification: UNCLASSIFIED,
  },
  { path: 'services/resultsVnext/roi/roiAssumptionCommands.ts', classification: UNCLASSIFIED },
  { path: 'services/resultsVnext/roi/roiBaselineCommands.ts', classification: UNCLASSIFIED },
  {
    path: 'services/resultsVnext/roi/roiBenefitEvidenceLinkCommands.ts',
    classification: UNCLASSIFIED,
  },
  { path: 'services/resultsVnext/roi/roiBenefitLineCommands.ts', classification: UNCLASSIFIED },
  {
    path: 'services/resultsVnext/roi/roiBenefitsRealizationCommands.ts',
    classification: UNCLASSIFIED,
  },
  {
    path: 'services/resultsVnext/roi/roiBenefitsRealizationRepository.ts',
    classification: UNCLASSIFIED,
  },
  {
    path: 'services/resultsVnext/roi/roiCalculationPolicyCommands.ts',
    classification: UNCLASSIFIED,
  },
  { path: 'services/resultsVnext/roi/roiCalculationRunCommands.ts', classification: UNCLASSIFIED },
  { path: 'services/resultsVnext/roi/roiCaseApprovalCommands.ts', classification: UNCLASSIFIED },
  { path: 'services/resultsVnext/roi/roiCaseCommands.ts', classification: UNCLASSIFIED },
  { path: 'services/resultsVnext/roi/roiCompareRepository.ts', classification: UNCLASSIFIED },
  { path: 'services/resultsVnext/roi/roiCostLineCommands.ts', classification: UNCLASSIFIED },
  { path: 'services/resultsVnext/roi/roiEconomicModelReadiness.ts', classification: UNCLASSIFIED },
  {
    path: 'services/resultsVnext/roi/roiEconomicModelRepository.ts',
    classification: UNCLASSIFIED,
  },
  { path: 'services/resultsVnext/roi/roiFinanceLinkCommands.ts', classification: UNCLASSIFIED },
  { path: 'services/resultsVnext/roi/roiFinanceLinkRepository.ts', classification: UNCLASSIFIED },
  {
    path: 'services/resultsVnext/roi/roiFinanceProjectionRepository.ts',
    classification: UNCLASSIFIED,
  },
  {
    path: 'services/resultsVnext/roi/roiFinanceReconciliationCommands.ts',
    classification: UNCLASSIFIED,
  },
  { path: 'services/resultsVnext/roi/roiForecastVersionCommands.ts', classification: UNCLASSIFIED },
  {
    path: 'services/resultsVnext/roi/roiForecastVersionRepository.ts',
    classification: UNCLASSIFIED,
  },
  { path: 'services/resultsVnext/roi/roiLegacyArchiveRepository.ts', classification: UNCLASSIFIED },
  { path: 'services/resultsVnext/roi/roiOrgPerspectiveRepository.ts', classification: UNCLASSIFIED },
  { path: 'services/resultsVnext/roi/roiPirCommands.ts', classification: UNCLASSIFIED },
  { path: 'services/resultsVnext/roi/roiPirRepository.ts', classification: UNCLASSIFIED },
  { path: 'services/resultsVnext/roi/roiRepository.ts', classification: UNCLASSIFIED },
  { path: 'services/resultsVnext/roi/roiScenarioCommands.ts', classification: UNCLASSIFIED },
  { path: 'services/resultsVnext/roi/roiTrackingCommands.ts', classification: UNCLASSIFIED },
  { path: 'services/resultsVnext/roi/roiVarianceCommands.ts', classification: UNCLASSIFIED },
  { path: 'services/resultsVnext/roi/roiVarianceRepository.ts', classification: UNCLASSIFIED },
];

/** Rule (a): direct SQL against an `rvn_roi_*` table. `\s` already spans newlines. */
const DIRECT_ROI_SQL = /\b(FROM|JOIN)\s+rvn_roi_[A-Za-z0-9_]*/;

/** Rule (b): the named legacy-archive family — see file header. */
const LEGACY_ARCHIVE_NAME = /RoiLegacyArchive/i;

function isRoiReadSurface(relativePath: string, source: string): boolean {
  return DIRECT_ROI_SQL.test(source) || LEGACY_ARCHIVE_NAME.test(path.basename(relativePath));
}

/**
 * Walks `server/src`, skipping `__tests__` directories and `*.test.ts` /
 * `*.spec.ts` files (those are test code, not production read surfaces —
 * and several of them intentionally contain `rvn_roi_` SQL fixtures/mocks
 * that would otherwise pollute the count). Returns every `.ts` file path,
 * relative to `server/src`, that matches the detection rule.
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

describe('ROI read surface manifest — ratchet gate', () => {
  it('SANITY: the detection rule finds a non-zero number of files (a silently-empty regex is a false green)', () => {
    const discovered = discoverRoiReadSurfaces();
    expect(discovered.length).toBeGreaterThan(0);
    // Pinned so a rule that quietly stops matching (or starts over-matching)
    // is itself visible as a diff here, not just as a manifest mismatch.
    expect(discovered.length).toBe(ROI_READ_SURFACE_MANIFEST.length);
  });

  it('FAILS on any ROI read surface on disk that is not in the manifest — unclassified means RED', () => {
    const discovered = discoverRoiReadSurfaces();
    const manifestPaths = new Set(ROI_READ_SURFACE_MANIFEST.map((e) => e.path));

    const unlisted = discovered.filter((file) => !manifestPaths.has(file));

    const messages = unlisted.map(
      (file) =>
        `UNCLASSIFIED ROI read surface: ${file}\n` +
        `  This file matches the ROI-read detection rule (direct SQL against ` +
        `an rvn_roi_* table, or the RoiLegacyArchive family) but has no entry in ` +
        `ROI_READ_SURFACE_MANIFEST in this file ` +
        `(server/src/services/resultsVnext/platform/__tests__/roiReadSurfaceManifest.test.ts).\n` +
        `  ACTION: add a manifest entry classifying it. Do NOT delete or skip this ` +
        `test to make it pass — classify the file, do not delete the line.`
    );

    expect(messages, messages.join('\n\n')).toEqual([]);
  });

  it('FAILS if a manifest entry no longer exists on disk — the manifest cannot rot into fiction', () => {
    const missing = ROI_READ_SURFACE_MANIFEST.filter((entry) => {
      try {
        statSync(path.join(SERVER_SRC, entry.path));
        return false;
      } catch {
        return true;
      }
    });

    const messages = missing.map(
      (entry) =>
        `STALE manifest entry: ${entry.path}\n` +
        `  This path no longer exists on disk. Update or remove this entry in ` +
        `ROI_READ_SURFACE_MANIFEST (it was likely moved, renamed, or deleted) ` +
        `so the manifest keeps describing the real tree.`
    );

    expect(messages, messages.join('\n\n')).toEqual([]);
  });

  it('has no duplicate paths in the manifest', () => {
    const seen = new Set<string>();
    const duplicates = ROI_READ_SURFACE_MANIFEST.map((e) => e.path).filter((p) => {
      if (seen.has(p)) return true;
      seen.add(p);
      return false;
    });
    expect(duplicates).toEqual([]);
  });
});
