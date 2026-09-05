import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type {
  KpiScorecardDto,
  KpiScorecardItemDto,
  KpiScorecardReviewSnapshotDto,
} from '../kpiScorecardApi';
import {
  buildKpiScorecardItemColumns,
  buildKpiScorecardItemPreview,
  buildKpiScorecardPreview,
  buildKpiScorecardSnapshotPreview,
} from '../kpiScorecardPresenters';

const UUID = 'd2b6a316-08c5-47cf-9bf7-4ba50311d5a2';
const noop = () => {};
const renderValue = (value: unknown) =>
  renderToStaticMarkup(<>{React.isValidElement(value) ? value : String(value ?? '')}</>);

describe('KPI Scorecard presenters hide technical identifiers', () => {
  it('uses member and scope resolvers in the scorecard preview', () => {
    const row: KpiScorecardDto = {
      scorecardId: UUID,
      organizationId: 'org-1',
      name: 'Karta zarządu',
      description: null,
      scopeType: 'organization',
      scopeId: 'org-1',
      ownerUserId: UUID,
      ownerName: null,
      reviewFrequency: 'monthly',
      lifecycleStatus: 'draft',
      rowVersion: 1,
      createdBy: UUID,
      createdAt: '2026-09-05T00:00:00.000Z',
      updatedAt: '2026-09-05T00:00:00.000Z',
    };
    const preview = buildKpiScorecardPreview(row, {
      isPolish: true,
      currentUserId: 'other-user',
      resolveMemberName: (id) => (id === UUID ? 'Piotr Wiśniewski' : null),
      resolveScopeName: (id) => (id === 'org-1' ? 'DBR77' : null),
      busy: false,
      onActivate: noop,
      onSuspend: noop,
      onArchive: noop,
      onClose: noop,
    });
    const text = preview.details?.properties?.map((property) => renderValue(property.value)).join(' ');
    expect(text).toContain('Piotr Wiśniewski');
    expect(text).toContain('DBR77');
    expect(text).not.toContain(UUID);
  });

  it('uses names or localized fallbacks for item and snapshot people', () => {
    const item: KpiScorecardItemDto = {
      itemId: UUID,
      scorecardId: UUID,
      kpiId: UUID,
      kpiName: null,
      organizationId: 'org-1',
      role: 'primary',
      sortOrder: 1,
      displayConfig: null,
      addedBy: UUID,
      addedByName: null,
      addedAt: '2026-09-05T00:00:00.000Z',
    };
    const columns = buildKpiScorecardItemColumns(true, () => 'Anna Kowalska');
    const columnText = columns.map((column) => renderValue(column.render?.(item))).join(' ');
    const itemPreview = buildKpiScorecardItemPreview(item, {
      isPolish: true,
      resolveMemberName: () => 'Anna Kowalska',
      onClose: noop,
      onOpenKpi: noop,
      onRemove: noop,
    });
    const itemText = itemPreview.details?.properties
      ?.map((property) => renderValue(property.value))
      .join(' ');
    expect(`${columnText} ${itemText}`).toContain('Anna Kowalska');
    expect(`${columnText} ${itemText}`).toContain('Nieznany wskaźnik');
    expect(`${columnText} ${itemText}`).not.toContain(UUID);

    const snapshot = {
      snapshotId: UUID,
      scorecardId: UUID,
      organizationId: 'org-1',
      status: 'published',
      reviewPeriodStart: '2026-09-01',
      reviewPeriodEnd: '2026-09-30',
      snapshotPayload: null,
      contentHash: 'technical-content-hash-123456',
      createdBy: UUID,
      createdByName: null,
      createdAt: '2026-09-05T00:00:00.000Z',
      publishedBy: UUID,
      publishedByName: null,
      publishedAt: '2026-09-05T00:00:00.000Z',
      supersededAt: null,
    } as KpiScorecardReviewSnapshotDto;
    const snapshotPreview = buildKpiScorecardSnapshotPreview(snapshot, {
      isPolish: true,
      resolveMemberName: () => 'Anna Kowalska',
      onClose: noop,
      onPublish: noop,
    });
    const snapshotText = snapshotPreview.details?.properties
      ?.map((property) => renderValue(property.value))
      .join(' ');
    expect(snapshotText).toContain('Anna Kowalska');
    expect(snapshotText).not.toContain(UUID);
  });
});
