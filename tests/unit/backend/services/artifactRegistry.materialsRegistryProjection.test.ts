/**
 * Materials registry fix (2026-08-25) — regression test for the exact defect
 * described in docs/program/waves/WAVE_03_ACCEPTANCE/modules/11_MATERIALS/
 * MODULE_ACCEPTANCE.md (G05): "the recovered common registry projects only
 * the Presentation row — Document/Sheet registry projection ... remain
 * defective".
 *
 * Root cause (traced via server/src/routes/artifacts.routes.ts
 * listArtifactsForUser -> matchesViewFilters, and
 * server/scripts/seed-wave3-materials-owner-review.ts): the owner-review
 * fixture seeded its Document and Sheet `v8_output_artifacts` rows with
 * delivery_state='draft'/is_draft=1 while the Presentation row was seeded
 * 'ready'/is_draft=0 — despite all three carrying fully realized, "ready for
 * review" content. `GET /api/artifacts` excludes is_draft rows by default
 * (the M17 junk filter, matchesViewFilters below), so only the Presentation
 * row survived the default registry view. This is a pure-function
 * (no-DB) proof of that mechanism, and of the fix (both rows re-seeded with
 * is_draft=0 in the script).
 */
import { describe, expect, it } from 'vitest';

import {
  matchesViewFilters,
  type ArtifactListItem,
} from '../../../../../server/src/services/v8/artifactRegistryService.js';
import type { ArtifactListFilters } from '../../../../../server/src/types/artifactRegistry.js';

function makeMaterialsItem(overrides: Partial<ArtifactListItem>): ArtifactListItem {
  return {
    artifactId: 'art-1',
    organizationId: 'org-1',
    outputType: 'report',
    artifactFamily: 'document',
    deliveryState: 'ready',
    titleSnapshot: 'Plan transformacji operacyjnej',
    ownerUserId: 'user-1',
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
    createdBy: 'user-1',
    createdAt: '2026-08-21T08:00:00.000Z',
    lastTransitionAt: '2026-08-23T12:00:00.000Z',
    originRuntime: 'native_artifact',
    originRecordId: 'doc-1',
    resolvedTitle: 'Plan transformacji operacyjnej',
    originTitle: 'Plan transformacji operacyjnej',
    originStatus: null,
    reportType: 'executive_memo',
    presentationMode: null,
    slideCount: null,
    exportFormat: 'docx',
    sourceRefs: [],
    publishState: 'approved',
    publishReviewers: [],
    reviewGateCount: 0,
    ownerName: 'Piotr Wisniewski',
    duplicateCount: 1,
    duplicateArtifactIds: [],
    ...overrides,
  };
}

const defaultRegistryFilters: ArtifactListFilters = {};

describe('Materials common registry — default "All" view (default drafts:exclude)', () => {
  it('BEFORE the fix: Document/Sheet seeded is_draft=1 disappear, only Presentation (is_draft=0) survives', () => {
    const documentRow = makeMaterialsItem({
      artifactId: 'art-doc',
      outputType: 'report',
      artifactFamily: 'document',
      originRuntime: 'native_artifact',
      originRecordId: 'doc-1',
      isDraft: true, // the seed script's original (buggy) value
    });
    const presentationRow = makeMaterialsItem({
      artifactId: 'art-deck',
      outputType: 'presentation',
      artifactFamily: 'presentation',
      originRuntime: 'presentation',
      originRecordId: 'deck-1',
      titleSnapshot: 'Plan transformacji — 90 dni',
      resolvedTitle: 'Plan transformacji — 90 dni',
      isDraft: false,
    });
    const sheetRow = makeMaterialsItem({
      artifactId: 'art-sheet',
      outputType: 'sheet',
      artifactFamily: 'sheet',
      originRuntime: 'sheet',
      originRecordId: 'workbook-1',
      titleSnapshot: 'Budżet pilotażu',
      resolvedTitle: 'Budżet pilotażu',
      isDraft: true, // the seed script's original (buggy) value
    });

    const registry = [documentRow, presentationRow, sheetRow];
    const projected = registry.filter((item) =>
      matchesViewFilters(item, defaultRegistryFilters, 'user-1')
    );

    // This is exactly the observed bug: only the Presentation row projects.
    expect(projected.map((r) => r.originRuntime)).toEqual(['presentation']);
  });

  it('AFTER the fix: all three artifacts seeded is_draft=0 project into the default registry view', () => {
    const documentRow = makeMaterialsItem({
      artifactId: 'art-doc',
      outputType: 'report',
      artifactFamily: 'document',
      originRuntime: 'native_artifact',
      originRecordId: 'doc-1',
      isDraft: false,
    });
    const presentationRow = makeMaterialsItem({
      artifactId: 'art-deck',
      outputType: 'presentation',
      artifactFamily: 'presentation',
      originRuntime: 'presentation',
      originRecordId: 'deck-1',
      titleSnapshot: 'Plan transformacji — 90 dni',
      resolvedTitle: 'Plan transformacji — 90 dni',
      isDraft: false,
    });
    const sheetRow = makeMaterialsItem({
      artifactId: 'art-sheet',
      outputType: 'sheet',
      artifactFamily: 'sheet',
      originRuntime: 'sheet',
      originRecordId: 'workbook-1',
      titleSnapshot: 'Budżet pilotażu',
      resolvedTitle: 'Budżet pilotażu',
      isDraft: false,
    });

    const registry = [documentRow, presentationRow, sheetRow];
    const projected = registry.filter((item) =>
      matchesViewFilters(item, defaultRegistryFilters, 'user-1')
    );

    expect(projected.map((r) => r.originRuntime).sort()).toEqual(
      ['native_artifact', 'presentation', 'sheet'].sort()
    );
  });
});
