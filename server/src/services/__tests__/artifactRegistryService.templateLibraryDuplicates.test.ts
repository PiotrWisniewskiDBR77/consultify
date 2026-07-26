/**
 * Template Library duplicate rows — root-cause fix (2026-07-26).
 *
 * Piotr saw paired cards in the Template Library ("KPI Review Report" x2,
 * "Cotygodniowy status PMO" x2, etc — one with a LEGACY badge, one without),
 * flagged as a known debt in
 * docs/product/MATERIALS_TARGET_STATE_AND_TEMPLATE_CANON_2026-07-24.md §7.
 *
 * Live diagnosis on the demo DB (trolley, read-only SELECTs) found:
 *  - `report_builder_templates` and `document_studio_templates` (the source
 *    tables) have exactly ONE row per template name — no duplicate DATA.
 *  - `v8_output_artifacts` (artifact_family='template') has 347 rows, of
 *    which 180 (52%!) have NO matching `v8_artifact_origin_links` row —
 *    orphans left behind by a race in `registerArtifactOrigin`: the
 *    existence check + two-step insert (artifact row, then origin-link row)
 *    is not transactional, so concurrent calls for the same origin key can
 *    each insert their own artifact row before any of them commits the link;
 *    `DbPromise.run()`'s default `fallback: true` then silently swallows the
 *    losing link inserts' unique-constraint violation.
 *  - `dedupeArtifacts` keys on title+outputType+originRuntime. Orphans get
 *    `originRuntime = null` (no matching link row via the LEFT JOIN), so
 *    every orphan for a given title collapses into ONE representative row —
 *    but that row has a DIFFERENT key than the correctly-linked sibling
 *    (whose originRuntime is e.g. 'report_template'), so exactly TWO cards
 *    survive per affected title. `enrichTemplateOriginSummaries` additionally
 *    skips items with no recognized `originRuntime`, so the orphan keeps its
 *    incomplete write-time snapshot (no `legacy` flag) while the linked
 *    sibling gets a live-computed 'legacy' badge — reproducing the exact
 *    "one badged, one not" pairing from the screenshot.
 *
 * This suite verifies the two-part fix:
 *  1. `matchesViewFilters` now excludes template-family artifacts with no
 *     origin link — they can never resolve to a real template, so they must
 *     never surface as Library cards (no data is deleted; doctrine: don't
 *     index the duplicate).
 *  2. `registerArtifactOrigin` recovers from a lost registration race:
 *     if the origin link that exists right after our insert isn't ours, we
 *     clean up our own orphan rows and adopt the winning artifact instead
 *     of returning/leaving behind a phantom duplicate.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbAll = vi.fn();
const mockDbGet = vi.fn();
const mockDbRun = vi.fn();

vi.mock('../../utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => mockDbAll(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  run: (...args: unknown[]) => mockDbRun(...args),
}));

vi.mock('../v8/featureFlagService.js', () => ({
  isV8Enabled: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../utils/Logger.js', () => ({
  default: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import type { ArtifactListItem } from '../../types/artifactRegistry.js';
import { matchesViewFilters, registerArtifactOrigin } from '../v8/artifactRegistryService.js';

function templateListItem(overrides: Partial<ArtifactListItem> = {}): ArtifactListItem {
  return {
    artifactId: 'art-1',
    organizationId: 'org-alpha',
    outputType: 'report',
    artifactFamily: 'template',
    deliveryState: 'ready',
    titleSnapshot: 'KPI Review Report',
    ownerUserId: null,
    canonicalHome: 'outputs_library',
    visibilityScope: 'organization',
    projectId: null,
    contextSnapshotId: null,
    executionRunId: null,
    templateFamilyRef: null,
    sourceInitiativeId: null,
    aiGovernancePresetRef: null,
    originSummary: null,
    isDraft: false,
    createdBy: 'system',
    createdAt: '2026-07-20T14:04:24.179Z',
    lastTransitionAt: '2026-07-20T14:04:24.179Z',
    originRuntime: 'report_template',
    originRecordId: 'tpl-results-kpi-report-default',
    resolvedTitle: 'KPI Review Report',
    originTitle: null,
    originStatus: null,
    reportType: 'RESULTS_KPI_REPORT',
    presentationMode: null,
    slideCount: null,
    exportFormat: null,
    sourceRefs: [],
    publishState: null,
    publishReviewers: [],
    reviewGateCount: 0,
    ownerName: null,
    duplicateCount: 1,
    duplicateArtifactIds: [],
    ...overrides,
  } as ArtifactListItem;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDbAll.mockResolvedValue([]);
  mockDbGet.mockResolvedValue(null);
  mockDbRun.mockResolvedValue({ success: true });
});

describe('matchesViewFilters — orphaned template exclusion (H3 fix)', () => {
  it('hides a template-family artifact with no origin link (the exact demo-DB defect)', () => {
    const orphan = templateListItem({
      artifactId: 'orphan-1',
      originRuntime: null,
      originRecordId: null,
    });
    expect(matchesViewFilters(orphan, { artifactFamily: 'template' }, 'user-1')).toBe(false);
  });

  it('still shows the correctly-linked sibling for the same title', () => {
    const linked = templateListItem({ artifactId: 'linked-1' });
    expect(matchesViewFilters(linked, { artifactFamily: 'template' }, 'user-1')).toBe(true);
  });

  it('reproduces the reported bug end-to-end: filtering a [linked, orphan, orphan] library page leaves exactly ONE "KPI Review Report" card', () => {
    const items = [
      templateListItem({ artifactId: 'linked-1', originRuntime: 'report_template' }),
      templateListItem({ artifactId: 'orphan-1', originRuntime: null, originRecordId: null }),
      templateListItem({ artifactId: 'orphan-2', originRuntime: null, originRecordId: null }),
    ];
    const visible = items.filter((item) =>
      matchesViewFilters(item, { artifactFamily: 'template' }, 'user-1')
    );
    expect(visible).toHaveLength(1);
    expect(visible[0].artifactId).toBe('linked-1');
  });

  it('does not affect non-template artifacts, which have no origin-link requirement', () => {
    const report = templateListItem({
      artifactFamily: 'document',
      originRuntime: null,
      originRecordId: null,
    });
    // No artifactFamily filter → non-templates pass through unaffected by the new guard.
    expect(matchesViewFilters(report, {}, 'user-1')).toBe(true);
  });
});

describe('registerArtifactOrigin — origin-link race recovery (root-cause fix)', () => {
  const baseParams = {
    organizationId: 'org-alpha',
    outputType: 'report' as const,
    artifactFamily: 'template' as const,
    originRuntime: 'report_template' as const,
    originRecordId: 'mck-doc-business-case',
    titleSnapshot: 'Uzasadnienie biznesowe (Business Case)',
    createdBy: 'system',
  };

  function artifactRow(artifactId: string) {
    return {
      artifact_id: artifactId,
      organization_id: 'org-alpha',
      output_type: 'report',
      artifact_family: 'template',
      delivery_state: 'ready',
      title_snapshot: baseParams.titleSnapshot,
      owner_user_id: null,
      canonical_home: 'outputs_library',
      visibility_scope: 'organization',
      project_id: null,
      context_snapshot_id: null,
      execution_run_id: null,
      template_family_ref: null,
      source_initiative_id: null,
      ai_governance_preset_ref: null,
      origin_summary_json: null,
      is_draft: 0,
      created_by: 'system',
      created_at: '2026-07-26T00:00:00.000Z',
      last_transition_at: '2026-07-26T00:00:00.000Z',
    };
  }

  it('registers normally when no one else is racing (no pre-existing link, ours wins)', async () => {
    mockDbGet.mockImplementation(async (sql: string) => {
      if (String(sql).includes('FROM v8_artifact_origin_links')) return null; // never any competing link
      if (String(sql).includes('FROM v8_output_artifacts')) {
        // Return whatever artifact_id was inserted (grab it from the latest INSERT call).
        const insertCall = mockDbRun.mock.calls.find((c) =>
          String(c[0]).includes('INSERT INTO v8_output_artifacts')
        );
        const insertedId = (insertCall?.[1] as unknown[])?.[0] as string;
        return artifactRow(insertedId);
      }
      return null;
    });

    const record = await registerArtifactOrigin(baseParams);
    expect(record).not.toBeNull();

    // We never hit the race-recovery cleanup path.
    const deletes = mockDbRun.mock.calls
      .map((c) => String(c[0]))
      .filter((sql) => /^\s*DELETE/i.test(sql));
    expect(deletes).toEqual([]);
  });

  it('cleans up our own orphan and adopts the winner when we lose the registration race', async () => {
    const winnerArtifactId = 'winner-artifact-id';
    const winnerLink = {
      link_id: 'winner-link-id',
      artifact_id: winnerArtifactId,
      organization_id: 'org-alpha',
      origin_runtime: 'report_template',
      origin_record_id: baseParams.originRecordId,
      is_primary_origin: 1,
      created_at: '2026-07-26T00:00:00.000Z',
    };

    let originLinkLookups = 0;
    mockDbGet.mockImplementation(async (sql: string) => {
      if (String(sql).includes('FROM v8_artifact_origin_links')) {
        originLinkLookups += 1;
        // 1st call = pre-insert existence check → nobody has registered yet.
        // 2nd call = post-insert reconciliation → a concurrent caller won.
        return originLinkLookups === 1 ? null : winnerLink;
      }
      if (String(sql).includes('FROM v8_output_artifacts')) {
        return artifactRow(winnerArtifactId);
      }
      return null;
    });

    const record = await registerArtifactOrigin(baseParams);

    expect(record).not.toBeNull();
    expect(record!.artifactId).toBe(winnerArtifactId);

    // Our own losing artifact row (the one we inserted before discovering we
    // lost) must be the target of a cleanup DELETE — never the winner's.
    const artifactDelete = mockDbRun.mock.calls.find(
      (c) =>
        String(c[0]).includes('DELETE FROM v8_output_artifacts') &&
        String(c[0]).includes('WHERE artifact_id')
    );
    expect(artifactDelete).toBeDefined();
    const deletedArtifactId = (artifactDelete![1] as unknown[])[0];
    expect(deletedArtifactId).not.toBe(winnerArtifactId);

    const linkDelete = mockDbRun.mock.calls.find((c) =>
      String(c[0]).includes('DELETE FROM v8_artifact_origin_links')
    );
    expect(linkDelete).toBeDefined();
    expect((linkDelete![1] as unknown[])[0]).toBe(deletedArtifactId);

    // The winner's own rows are never touched by a DELETE.
    const allDeleteParams = mockDbRun.mock.calls
      .filter((c) => /^\s*DELETE/i.test(String(c[0])))
      .flatMap((c) => c[1] as unknown[]);
    expect(allDeleteParams).not.toContain(winnerArtifactId);
  });
});
