/**
 * RN-G5 §G #8 — D07 / OQ-UI-B non-leak assertion for
 * `buildKpiScorecardSnapshotPreview`.
 *
 * `kpiScorecardRepository.ts`'s own header (decision #6/#6a/#6b) documents:
 * a plain `listReviewSnapshots` row's `snapshot_payload` is NOT re-filtered
 * per reader — only `getPublishedSnapshot` does that. D07 (task brief):
 * NEVER render an unfiltered `snapshotPayload` anywhere; show only snapshot
 * METADATA. This test proves `buildKpiScorecardSnapshotPreview` (used by
 * both the live "Migawki przeglądu" tab and this package's new publish
 * wiring) honors that — even when a row's `snapshotPayload` is fully
 * populated (as `publishKpiScorecardReviewSnapshot`'s own response now is,
 * per decision #6a), nothing derived from it reaches the rendered preview.
 */
import { describe, expect, it } from 'vitest';

import { buildKpiScorecardSnapshotPreview } from '../../../src/components/ResultsVNext/kpiScorecards/kpiScorecardPresenters';
import type { KpiScorecardReviewSnapshotDto } from '../../../src/components/ResultsVNext/kpiScorecards/kpiScorecardApi';

const SENTINEL = 'SENTINEL_LEAK_TOKEN_KPI_ID_SHOULD_NEVER_RENDER';

function buildRowWithPopulatedPayload(): KpiScorecardReviewSnapshotDto {
  return {
    snapshotId: 'snap-1',
    scorecardId: 'sc-1',
    organizationId: 'org-1',
    reviewPeriodStart: '2026-08-01T00:00:00Z',
    reviewPeriodEnd: '2026-08-07T23:59:59Z',
    // A FULLY POPULATED payload — same shape `publishReviewSnapshot`'s
    // response now carries per decision #6a (publisher-time filtered, but
    // still real item facts). The sentinel makes any accidental render
    // trivially detectable via a string search.
    snapshotPayload: {
      items: [
        {
          kpiId: SENTINEL,
          definitionVersionId: 'defver-1',
          itemRole: 'primary',
          measurementId: 'meas-1',
          actualValue: 123.45,
          unit: '%',
          performanceStatus: 'on_target',
          dataQualityStatus: 'verified',
          periodStart: '2026-08-01T00:00:00Z',
          periodEnd: '2026-08-07T23:59:59Z',
        },
      ],
      statusCounts: { safe: 1, warning: 0, critical: 0, missing: 0 },
    },
    status: 'published',
    contentHash: 'hash-abc',
    publishedBy: 'user-1',
    publishedAt: '2026-08-08T09:00:00Z',
    supersededBySnapshotId: null,
    supersededAt: null,
    rowVersion: 2,
    createdBy: 'user-1',
    createdAt: '2026-08-07T18:00:00Z',
    updatedAt: '2026-08-08T09:00:00Z',
  };
}

describe('buildKpiScorecardSnapshotPreview — D07/OQ-UI-B non-leak', () => {
  it('never renders any field derived from snapshotPayload, even when the row carries a fully populated one', () => {
    const row = buildRowWithPopulatedPayload();
    const preview = buildKpiScorecardSnapshotPreview(row, {
      isPolish: false,
      busy: false,
      onClose: () => undefined,
      onPublish: () => undefined,
    });

    const serialized = JSON.stringify(preview, (_key, value) =>
      typeof value === 'function' ? '[fn]' : value
    );

    expect(serialized).not.toContain(SENTINEL);
    expect(serialized).not.toContain('actualValue');
    expect(serialized).not.toContain('statusCounts');

    const propertyIds = (preview.details?.properties ?? []).map((p) => p.id);
    expect(propertyIds).not.toContain('items');
    expect(propertyIds).not.toContain('snapshotPayload');
    // Only real metadata properties are present.
    expect(propertyIds.sort()).toEqual(
      ['contentHash', 'createdAt', 'createdBy', 'publishedAt', 'publishedBy', 'supersededAt'].sort()
    );
  });
});
