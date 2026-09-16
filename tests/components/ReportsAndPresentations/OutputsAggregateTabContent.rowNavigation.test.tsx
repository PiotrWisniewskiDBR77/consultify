/**
 * @vitest-environment jsdom
 *
 * Materials registry fix (2026-08-25) — row→card navigation coverage for the
 * common "All" registry (OutputsAggregateTabContent, embedded in
 * ReportsAndPresentationsHub's outputs_all/outputs_documents/outputs_sheets
 * tabs). Root-cause diagnosis: the client projection/navigation code here was
 * already correct (see useRapData.canonicalArtifacts.test.tsx and
 * artifactNavigation.test.ts) — the actual defect was a fixture bug in
 * server/scripts/seed-wave3-materials-owner-review.ts (Document/Sheet rows
 * seeded with is_draft=1, silently excluded by the server's default M17
 * draft filter). This file closes the one real gap found during that
 * diagnosis: there was no end-to-end test proving a double-click on a
 * Document or Sheet row in this exact component actually navigates to its
 * real card route with the artifact's id.
 *
 * Row payload shapes mirror the real `GET /api/artifacts` response mapped
 * through `mapRegistryItemToUnified` (useRapData.ts): `governance.openPath`
 * for document/presentation (server-computed in
 * `buildActionTargetPayload`, artifacts.routes.ts), and the sheet-specific
 * `openGovernedSheetRow` flow (server never sets `openPath` for
 * originRuntime='sheet' — the client resolves the open route itself).
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { OutputsAggregateTabContent } from '../../../src/components/ReportsAndPresentations/OutputsAggregateTabContent';

const navigateMock = vi.fn();

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next');
  return {
    ...actual,
    useTranslation: () => ({
      t: (_k: string, fallback?: string | { defaultValue?: string }) =>
        typeof fallback === 'string'
          ? fallback
          : ((fallback as { defaultValue?: string } | undefined)?.defaultValue ?? _k),
      i18n: { language: 'pl' },
    }),
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => ({
      pathname: '/presentations',
      search: '',
      hash: '',
      key: 'test-key',
      state: null,
    }),
  };
});

vi.mock('../../../src/hooks/useOpenChatWithContext', () => ({
  useOpenChatWithContext: () => vi.fn(),
}));

vi.mock('../../../src/components/ReportsAndPresentations/useTrustState', () => ({
  useTrustState: (_artifactId?: string, governance?: any) => governance,
}));

const isEnabledMock = vi.fn().mockReturnValue(false);
vi.mock('../../../src/contexts/FeatureFlagsContext', () => ({
  useFeatureFlagsContext: () => ({
    flags: {},
    isEnabled: (flag: string) => isEnabledMock(flag),
  }),
}));

const resolveTablePlatformWorkspaceIdForTableMock = vi.fn();
const downloadSheetArtifactXlsxMock = vi.fn();
vi.mock('../../../src/utils/sheetArtifactOpen', () => ({
  downloadSheetArtifactXlsx: (...args: unknown[]) => downloadSheetArtifactXlsxMock(...args),
  resolveTablePlatformWorkspaceIdForTable: (...args: unknown[]) =>
    resolveTablePlatformWorkspaceIdForTableMock(...args),
}));

// Same fix as OutputsAggregateTabContent.deeplink.test.tsx: StandardTable
// pulls FilterableTable from the concrete submodule, not the ModuleHub
// barrel — mock the exact import target so row clicks are reachable.
vi.mock('../../../src/components/shared/ModuleHub/FilterableTable', () => ({
  FilterableTable: ({ data, selectedRowId, onRowClick, onRowDoubleClick }: any) => (
    <div data-testid="filterable-table">
      {data.map((row: any) => (
        <button
          key={row.id}
          onClick={() => onRowClick?.(row)}
          onDoubleClick={() => onRowDoubleClick?.(row)}
          data-testid={`row-${row.id}`}
        >
          {row.title}
        </button>
      ))}
      <div data-testid="selected-row">{selectedRowId || 'none'}</div>
    </div>
  ),
}));

vi.mock('../../../src/components/shared/ModuleHub', () => ({
  GridView: () => <div data-testid="grid-view" />,
}));

const actions = {
  exportReportPdf: vi.fn(),
  exportDeckPptx: vi.fn(),
  archiveReport: vi.fn().mockResolvedValue(true),
  archiveDeck: vi.fn().mockResolvedValue(true),
  startArtifactReview: vi.fn().mockResolvedValue(true),
};

describe('OutputsAggregateTabContent — row-to-card navigation (Document/Sheet)', () => {
  beforeEach(() => {
    navigateMock.mockClear();
    isEnabledMock.mockReset().mockReturnValue(false);
    resolveTablePlatformWorkspaceIdForTableMock.mockReset();
    downloadSheetArtifactXlsxMock.mockReset();
  });

  it('double-clicking a Document row navigates to /document-studio/:id (server-computed openPath)', () => {
    render(
      <OutputsAggregateTabContent
        viewMode="table"
        searchQuery=""
        activeFilters={[]}
        onFilterChange={() => {}}
        rows={
          [
            {
              kind: 'document',
              originRecordId: 'doc-real-id-1',
              artifactId: 'art-doc-real-1',
              title: 'Plan transformacji operacyjnej',
              owner: 'Piotr Wisniewski',
              statusKey: 'ready',
              updatedAt: '2026-08-23T12:00:00Z',
              exportFormats: ['docx'],
              fileFormat: 'DOCX',
              // Mirrors buildActionTargetPayload (artifacts.routes.ts) for
              // originRuntime='native_artifact'.
              governance: { openPath: '/document-studio/doc-real-id-1' },
            },
          ] as any
        }
        loading={false}
        error={null}
        onRefresh={() => {}}
        actions={actions as any}
      />
    );

    fireEvent.doubleClick(screen.getByTestId('row-document:doc-real-id-1'));

    expect(navigateMock).toHaveBeenCalledWith('/document-studio/doc-real-id-1');
  });

  it('double-clicking a Sheet row navigates to /excele?artifactId=:id for a real (non-platform) workbook', async () => {
    // The canonical registry discriminator says this is a generated workbook,
    // so opening it must not probe table-platform or artifact-action routes.
    isEnabledMock.mockReturnValue(true);

    render(
      <OutputsAggregateTabContent
        viewMode="table"
        searchQuery=""
        activeFilters={[]}
        onFilterChange={() => {}}
        rows={
          [
            {
              kind: 'sheet',
              originRecordId: 'workbook-real-id-1',
              artifactId: 'art-sheet-real-1',
              title: 'Budżet pilotażu',
              owner: 'Piotr Wisniewski',
              statusKey: 'ready',
              updatedAt: '2026-08-23T12:30:00Z',
              exportFormats: ['xlsx'],
              fileFormat: 'XLSX',
              sheetOrigin: 'workbook',
              // Server never sets governance.openPath for originRuntime='sheet'
              // (buildActionTargetPayload, artifacts.routes.ts) — the client
              // must resolve the open route itself via openGovernedSheetRow.
              governance: {},
            },
          ] as any
        }
        loading={false}
        error={null}
        onRefresh={() => {}}
        actions={actions as any}
      />
    );

    fireEvent.doubleClick(screen.getByTestId('row-sheet:workbook-real-id-1'));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/excele?artifactId=workbook-real-id-1');
    });
    expect(resolveTablePlatformWorkspaceIdForTableMock).not.toHaveBeenCalled();
    expect(downloadSheetArtifactXlsxMock).not.toHaveBeenCalled();
  });

  it('still resolves a governed table export through its tenant-scoped Table Platform base', async () => {
    isEnabledMock.mockReturnValue(true);
    resolveTablePlatformWorkspaceIdForTableMock.mockResolvedValue('workspace-1');

    render(
      <OutputsAggregateTabContent
        viewMode="table"
        searchQuery=""
        activeFilters={[]}
        onFilterChange={() => {}}
        rows={
          [
            {
              kind: 'sheet',
              originRecordId: 'table-real-id-1',
              artifactId: 'art-table-real-1',
              title: 'Supplier register',
              owner: 'Piotr Wisniewski',
              statusKey: 'ready',
              updatedAt: '2026-09-16T12:30:00Z',
              exportFormats: ['xlsx'],
              fileFormat: 'XLSX',
              sheetOrigin: 'table_export',
              governance: { visibilityScope: 'organization' },
            },
          ] as any
        }
        loading={false}
        error={null}
        onRefresh={() => {}}
        actions={actions as any}
      />
    );

    fireEvent.doubleClick(screen.getByTestId('row-sheet:table-real-id-1'));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith(
        '/my-work/sheets/workspace-1/tables/table-real-id-1'
      );
    });
    expect(resolveTablePlatformWorkspaceIdForTableMock).toHaveBeenCalledWith('table-real-id-1');
  });

  it('keeps the resolver for an ambiguous legacy sheet without a verified runtime marker', async () => {
    isEnabledMock.mockReturnValue(true);
    resolveTablePlatformWorkspaceIdForTableMock.mockResolvedValue('legacy-workspace');

    render(
      <OutputsAggregateTabContent
        viewMode="table"
        searchQuery=""
        activeFilters={[]}
        onFilterChange={() => {}}
        rows={
          [
            {
              kind: 'sheet',
              originRecordId: 'legacy-sheet-id-1',
              artifactId: 'art-legacy-sheet-1',
              title: 'Legacy sheet',
              owner: 'Legacy owner',
              statusKey: 'ready',
              updatedAt: '2026-09-16T12:30:00Z',
              exportFormats: ['xlsx'],
              fileFormat: 'XLSX',
              governance: { visibilityScope: 'organization' },
            },
          ] as any
        }
        loading={false}
        error={null}
        onRefresh={() => {}}
        actions={actions as any}
      />
    );

    fireEvent.doubleClick(screen.getByTestId('row-sheet:legacy-sheet-id-1'));

    await waitFor(() => {
      expect(resolveTablePlatformWorkspaceIdForTableMock).toHaveBeenCalledWith(
        'legacy-sheet-id-1'
      );
    });
    expect(navigateMock).toHaveBeenCalledWith(
      '/my-work/sheets/legacy-workspace/tables/legacy-sheet-id-1'
    );
  });
});
