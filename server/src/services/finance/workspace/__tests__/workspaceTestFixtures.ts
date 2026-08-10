/**
 * AP-09 / AP-10 / AP-11 — Finance shared workspace layer tests: SHARED FIXTURES.
 *
 * This module holds the fixtures the three contract suites
 * (`workspaceBarContract.test.ts`, `moduleAdapters.test.ts`,
 * `lineageNavigatorContract.test.ts`) have in common, so the suites can be
 * edited independently without colliding on a single file. It is NOT a test
 * file: `server/vitest.config.ts` only collects `*.{test,spec}.{ts,tsx}`.
 *
 * The rationale below was written for the original single-file suite and
 * applies unchanged to all three:
 *
 * WHY THERE IS NO DATABASE HERE — a deliberate choice, documented because
 * `MEMORY.md`'s standing lesson is that "green tests" over a mock prove
 * nothing about a real system:
 *
 *   Everything under `server/src/services/finance/workspace/` is a CONTRACT:
 *   declarative configuration (which controls a module may put in the bar,
 *   which views it has) plus pure transformations over data the caller
 *   supplies. Not one function in this package opens a connection, and the
 *   only I/O-shaped thing — `loadLineageNavigator` — takes the lineage service
 *   as an injected `LineageServicePort` precisely so it can be exercised
 *   against mocked `getAncestors`/`getDescendants` results.
 *
 *   The DB-backed half of lineage is already tested where it belongs and
 *   against a real Postgres: `canonicalServices.pg.test.ts` covers
 *   `insertEdge`/`getAncestors`/`getDescendants` including the cycle trigger,
 *   and `lineageService.test.ts` covers the pure rank mirror. Re-testing those
 *   here would duplicate coverage without adding it. What a database CANNOT
 *   tell us is whether a module's bar has six controls — that is exactly what
 *   these files test.
 *
 *   Where a mock could hide drift, a real cross-check is used instead: the
 *   stage-rank test in `lineageNavigatorContract.test.ts` imports the genuine
 *   `lineageService.stageRank` and asserts this package's independently-derived
 *   order matches it, so the two cannot silently diverge.
 *
 * Same "pure core logic, no DB, no React" discipline as `operationStack.test.ts`
 * (AP-04), `KeyboardCommandRegistry.test.ts` (AP-03) and
 * `lineageService.test.ts` (WP-B03).
 */
import type { ArtifactRef } from '../../../../types/finance/ArtifactRef.js';
import { buildWorkspaceBarConfig, type FinanceModuleAdapter } from '../moduleAdapters.js';
import type {
  WorkspaceBarConfig,
  WorkspaceBarEvaluationContext,
} from '../workspaceBarContract.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

export const ORG = 'org-test';

export function artifactRef(overrides: Partial<ArtifactRef> = {}): ArtifactRef {
  return {
    organizationId: ORG,
    artifactId: 'artifact-1',
    businessVersionId: 'version-1',
    naturalKey: null,
    artifactType: 'STATEMENT_PACK',
    ...overrides,
  } as ArtifactRef;
}

export function evaluationContext(
  overrides: Partial<WorkspaceBarEvaluationContext> = {}
): WorkspaceBarEvaluationContext {
  return {
    status: 'DRAFT',
    role: 'preparer',
    freshness: 'CURRENT',
    gates: {},
    ...overrides,
  };
}

/** All completeness gates satisfied — the "fully configured artifact" case. */
export function allGatesSatisfied(): Record<string, boolean> {
  return {
    'statements.mappingComplete': true,
    'statements.checksPassed': true,
    'analysis.hasConfiguredKpis': true,
    'analysis.computed': true,
    'baselineModel.assumptionsConfirmed': true,
    'baselineModel.tieOutsPassed': true,
    'prediction.preflightResolved': true,
    'prediction.computed': true,
    'valuation.methodsConfigured': true,
    'valuation.computed': true,
  };
}

export function configFor(
  adapter: FinanceModuleAdapter,
  ctxOverrides: Partial<WorkspaceBarEvaluationContext> = {}
): WorkspaceBarConfig {
  const context = evaluationContext({ gates: allGatesSatisfied(), ...ctxOverrides });
  return buildWorkspaceBarConfig({
    adapter,
    artifactRef: artifactRef({ artifactType: adapter.artifactType }),
    name: 'Apator — sprawozdanie skonsolidowane FY2024',
    versionLabel: 'v3',
    hasUncommittedWorkingRevision: false,
    activeViewId: adapter.views[0].id,
    context,
  });
}
