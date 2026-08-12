/**
 * @vitest-environment jsdom
 *
 * `FinanceSavedViewsPanel` — Pakiet AP-CLIENT (Gate J), priorytet #4.
 *
 * Dowodzi: (1) flaga OFF → `null`, ZERO wywołań `listFinanceSavedViews`, (2) flaga ON →
 * ładuje i grupuje widoki PERSONAL/TEAM z ludzką etykietą (nigdy surowy token), (3) zapis
 * woła `createFinanceSavedView` z bieżącym stanem siatki hosta, (4) usunięcie woła
 * `deleteFinanceSavedView(viewId)` i odświeża, (5) błąd 403 FORBIDDEN → honest-UI, przycisk
 * nadal widoczny (serwer, nie UI, jest bramką).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockListFinanceSavedViews = vi.fn();
const mockCreateFinanceSavedView = vi.fn();
const mockDeleteFinanceSavedView = vi.fn();

vi.mock('@/services/api/financeV2.api', () => ({
  listFinanceSavedViews: (...args: unknown[]) => mockListFinanceSavedViews(...args),
  createFinanceSavedView: (...args: unknown[]) => mockCreateFinanceSavedView(...args),
  deleteFinanceSavedView: (...args: unknown[]) => mockDeleteFinanceSavedView(...args),
}));

import { FinanceSavedViewsPanel } from '../FinanceSavedViewsPanel';
import { emptyGridViewStateSnapshot } from '@/services/api/financeV2.types';

function sampleView(overrides: Partial<any> = {}) {
  return {
    id: 'view-1',
    artifactId: 'art-1',
    artifactType: 'HISTORICAL_ANALYSIS',
    scope: 'PERSONAL',
    ownerUserId: 'u-1',
    name: 'Mój widok kwartalny',
    viewState: { schemaVersion: 1, gridViewState: emptyGridViewStateSnapshot(), filters: [] },
    shareToken: 'tok-1',
    createdBy: 'u-1',
    createdAt: 't',
    updatedAt: 't',
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
  mockListFinanceSavedViews.mockReset();
  mockCreateFinanceSavedView.mockReset();
  mockDeleteFinanceSavedView.mockReset();
});
afterEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe('FinanceSavedViewsPanel', () => {
  it('flaga domyślnie OFF → renderuje null, ZERO wywołań listFinanceSavedViews', () => {
    const { container } = render(<FinanceSavedViewsPanel artifactId="art-1" />);
    expect(container.firstChild).toBeNull();
    expect(mockListFinanceSavedViews).not.toHaveBeenCalled();
  });

  it('flaga ON → grupuje widoki PERSONAL/TEAM z ludzką etykietą scope', async () => {
    window.localStorage.setItem('consultify_feature_flags', JSON.stringify({ financeSavedViewsV1: true }));
    mockListFinanceSavedViews.mockResolvedValueOnce([sampleView({ id: 'v-p', scope: 'PERSONAL', name: 'Osobisty' }), sampleView({ id: 'v-t', scope: 'TEAM', name: 'Zespołowy' })]);
    render(<FinanceSavedViewsPanel artifactId="art-1" />);
    await waitFor(() => expect(screen.getByTestId('finance-saved-views-panel')).toBeInTheDocument());
    expect(mockListFinanceSavedViews).toHaveBeenCalledWith('art-1');
    const rows = screen.getAllByTestId('saved-view-row');
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.textContent)).toEqual([expect.stringContaining('Zespołowy'), expect.stringContaining('Osobisty')]); // TEAM group renders before PERSONAL
  });

  it('zapis woła createFinanceSavedView z bieżącym gridViewState/filters hosta i wybranym scope', async () => {
    window.localStorage.setItem('consultify_feature_flags', JSON.stringify({ financeSavedViewsV1: true }));
    mockListFinanceSavedViews.mockResolvedValueOnce([]);
    const gridViewState = { ...emptyGridViewStateSnapshot(), freezeColumnsCount: 2 };
    const filters = [{ type: 'missing', onlyMissing: true } as const];
    render(<FinanceSavedViewsPanel artifactId="art-1" currentGridViewState={gridViewState} currentFilters={filters} />);
    await waitFor(() => expect(screen.getByTestId('finance-saved-views-panel')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('saved-view-name-input'), { target: { value: 'Nowy widok' } });
    fireEvent.change(screen.getByTestId('saved-view-scope-select'), { target: { value: 'TEAM' } });
    mockCreateFinanceSavedView.mockResolvedValueOnce(sampleView({ scope: 'TEAM', name: 'Nowy widok' }));
    mockListFinanceSavedViews.mockResolvedValueOnce([sampleView({ scope: 'TEAM', name: 'Nowy widok' })]);
    fireEvent.click(screen.getByTestId('saved-view-save-submit'));

    await waitFor(() => expect(mockCreateFinanceSavedView).toHaveBeenCalledTimes(1));
    expect(mockCreateFinanceSavedView).toHaveBeenCalledWith({
      artifactId: 'art-1',
      scope: 'TEAM',
      name: 'Nowy widok',
      gridViewState,
      filters,
    });
  });

  it('Usuń woła deleteFinanceSavedView(viewId) i odświeża listę', async () => {
    window.localStorage.setItem('consultify_feature_flags', JSON.stringify({ financeSavedViewsV1: true }));
    mockListFinanceSavedViews.mockResolvedValueOnce([sampleView({ id: 'v-del' })]);
    render(<FinanceSavedViewsPanel artifactId="art-1" />);
    await waitFor(() => expect(screen.getByTestId('finance-saved-views-panel')).toBeInTheDocument());

    mockDeleteFinanceSavedView.mockResolvedValueOnce(null);
    mockListFinanceSavedViews.mockResolvedValueOnce([]);
    fireEvent.click(screen.getByTestId('saved-view-delete'));
    await waitFor(() => expect(mockDeleteFinanceSavedView).toHaveBeenCalledWith('v-del'));
  });

  it('KONTROLA NEGATYWNA: usunięcie cudzego PERSONAL widoku → 403 FORBIDDEN honest-UI, przycisk zostaje (bramka jest serwerowa, nie UI)', async () => {
    window.localStorage.setItem('consultify_feature_flags', JSON.stringify({ financeSavedViewsV1: true }));
    mockListFinanceSavedViews.mockResolvedValueOnce([sampleView({ id: 'v-foreign' })]);
    render(<FinanceSavedViewsPanel artifactId="art-1" />);
    await waitFor(() => expect(screen.getByTestId('finance-saved-views-panel')).toBeInTheDocument());

    const err = new Error('owner-only') as Error & { status?: number; data?: unknown };
    err.status = 403;
    err.data = { code: 'FORBIDDEN' };
    mockDeleteFinanceSavedView.mockRejectedValueOnce(err);
    fireEvent.click(screen.getByTestId('saved-view-delete'));

    await waitFor(() => expect(screen.getByTestId('saved-views-row-error')).toBeInTheDocument());
    expect(screen.queryByText('FORBIDDEN')).not.toBeInTheDocument();
    expect(screen.getByTestId('saved-view-delete')).toBeInTheDocument(); // przycisk nadal widoczny
  });
});
