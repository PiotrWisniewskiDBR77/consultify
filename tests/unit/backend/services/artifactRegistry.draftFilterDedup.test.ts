/**
 * S6.3 — M17 junk filter. Unit coverage for the presentational draft filter and
 * dedup that keep the Outputs Library (M17) and the presentation generator's
 * "Select Data Sources" step showing only real/final artifacts by default.
 *
 * These are pure functions (no DB), so we exercise the exact ranking/count logic
 * the HTTP list route relies on. NO data is ever mutated by dedup.
 */
import { describe, expect, it } from 'vitest';

import {
  dedupeArtifacts,
  isDraftHeuristicTitle,
  matchesViewFilters,
} from '../../../../../server/src/services/v8/artifactRegistryService.js';
import type {
  ArtifactListFilters,
  ArtifactListItem,
} from '../../../../../server/src/types/artifactRegistry.js';

function makeItem(overrides: Partial<ArtifactListItem> = {}): ArtifactListItem {
  return {
    artifactId: overrides.artifactId ?? 'art-1',
    organizationId: 'org-1',
    outputType: 'presentation',
    artifactFamily: 'presentation',
    deliveryState: 'ready',
    titleSnapshot: 'Executive presentation',
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
    createdAt: '2026-07-01T00:00:00.000Z',
    lastTransitionAt: '2026-07-01T00:00:00.000Z',
    originRuntime: 'presentation',
    originRecordId: 'deck-1',
    resolvedTitle: 'Executive presentation',
    originTitle: 'Executive presentation',
    originStatus: null,
    reportType: null,
    presentationMode: 'briefing',
    slideCount: 10,
    exportFormat: 'pptx',
    sourceRefs: [],
    publishState: null,
    publishReviewers: [],
    reviewGateCount: 0,
    ownerName: null,
    duplicateCount: 1,
    duplicateArtifactIds: [],
    ...overrides,
  };
}

const baseFilters: ArtifactListFilters = {};

describe('isDraftHeuristicTitle', () => {
  it('flags test/throwaway scaffolding names', () => {
    for (const title of [
      'E2E ToReport-abc',
      'smoke test deck',
      'PROBE-123',
      'FT6-THROWAWAY-deck',
      'ToReport-xyz',
      'my test presentation',
      'test',
    ]) {
      expect(isDraftHeuristicTitle(title)).toBe(true);
    }
  });

  it('does NOT flag legitimate output names (no false positives)', () => {
    for (const title of [
      'Executive presentation draft',
      'Q4 Board Deck',
      'Attestation report',
      'Latest strategy update',
      'Structured sheet draft',
      null,
      '',
    ]) {
      expect(isDraftHeuristicTitle(title)).toBe(false);
    }
  });
});

describe('matchesViewFilters — draft visibility (M17 junk filter)', () => {
  const draftItem = makeItem({ artifactId: 'draft-1', isDraft: true });
  const realItem = makeItem({ artifactId: 'real-1', isDraft: false });

  it('default (undefined) excludes drafts, keeps real', () => {
    expect(matchesViewFilters(realItem, baseFilters, 'user-1')).toBe(true);
    expect(matchesViewFilters(draftItem, baseFilters, 'user-1')).toBe(false);
  });

  it("drafts:'exclude' excludes drafts", () => {
    expect(matchesViewFilters(draftItem, { drafts: 'exclude' }, 'user-1')).toBe(false);
    expect(matchesViewFilters(realItem, { drafts: 'exclude' }, 'user-1')).toBe(true);
  });

  it("drafts:'include' returns both real and drafts", () => {
    expect(matchesViewFilters(draftItem, { drafts: 'include' }, 'user-1')).toBe(true);
    expect(matchesViewFilters(realItem, { drafts: 'include' }, 'user-1')).toBe(true);
  });

  it("drafts:'only' returns drafts only (Robocze view)", () => {
    expect(matchesViewFilters(draftItem, { drafts: 'only' }, 'user-1')).toBe(true);
    expect(matchesViewFilters(realItem, { drafts: 'only' }, 'user-1')).toBe(false);
  });
});

describe('dedupeArtifacts — presentational dedup', () => {
  it('collapses identical name+type+origin, keeping newest with a version count', () => {
    // Input is newest→oldest (list query orders by last_transition_at DESC).
    const newest = makeItem({ artifactId: 'v3', resolvedTitle: 'Structured sheet draft', outputType: 'sheet', originRuntime: 'sheet' });
    const mid = makeItem({ artifactId: 'v2', resolvedTitle: 'Structured sheet draft', outputType: 'sheet', originRuntime: 'sheet' });
    const oldest = makeItem({ artifactId: 'v1', resolvedTitle: 'Structured sheet draft', outputType: 'sheet', originRuntime: 'sheet' });

    const result = dedupeArtifacts([newest, mid, oldest]);

    expect(result).toHaveLength(1);
    expect(result[0].artifactId).toBe('v3');
    expect(result[0].duplicateCount).toBe(3);
    expect(result[0].duplicateArtifactIds).toEqual(['v2', 'v1']);
  });

  it('keeps distinct rows when type or origin differ', () => {
    const asSheet = makeItem({ artifactId: 's1', resolvedTitle: 'Same title', outputType: 'sheet', originRuntime: 'sheet' });
    const asReport = makeItem({ artifactId: 'r1', resolvedTitle: 'Same title', outputType: 'report', originRuntime: 'report' });

    const result = dedupeArtifacts([asSheet, asReport]);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.duplicateCount === 1)).toBe(true);
  });

  it('is case/whitespace-insensitive on the title key', () => {
    const a = makeItem({ artifactId: 'a', resolvedTitle: '  Executive Presentation ' });
    const b = makeItem({ artifactId: 'b', resolvedTitle: 'executive presentation' });

    const result = dedupeArtifacts([a, b]);
    expect(result).toHaveLength(1);
    expect(result[0].duplicateCount).toBe(2);
  });

  it('does not mutate the input items', () => {
    const a = makeItem({ artifactId: 'a', resolvedTitle: 'Dup' });
    const b = makeItem({ artifactId: 'b', resolvedTitle: 'Dup' });
    dedupeArtifacts([a, b]);
    expect(a.duplicateCount).toBe(1);
    expect(a.duplicateArtifactIds).toEqual([]);
  });
});
