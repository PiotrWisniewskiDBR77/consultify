/**
 * @vitest-environment jsdom
 *
 * Pakiet I (Dostępność), wymaganie #7 — `FinanceSavedViewsPanel.tsx`. PRZED
 * naprawą: „Kopiuj link" zmieniał WYŁĄCZNIE widoczny tekst przycisku na
 * „Skopiowano" (2s) — czytnik ekranu bez fokusu akurat na tym przycisku
 * nigdy się o tym nie dowiadywał.
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

import { emptyGridViewStateSnapshot } from '@/services/api/financeV2.types';

import { FinanceSavedViewsPanel } from '../FinanceSavedViewsPanel';

function sampleView(overrides: Partial<Record<string, unknown>> = {}) {
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
  window.localStorage.setItem('consultify_feature_flags', JSON.stringify({ financeSavedViewsV1: true }));
});
afterEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe('FinanceSavedViewsPanel — ogłaszanie stanów dynamicznych (a11y, Pakiet I)', () => {
  it('kliknięcie "Kopiuj link" ogłasza to przez role="status" (nie tylko zmienia tekst przycisku)', async () => {
    mockListFinanceSavedViews.mockResolvedValueOnce([sampleView()]);
    render(<FinanceSavedViewsPanel artifactId="art-1" />);
    await screen.findByTestId('finance-saved-views-panel');

    fireEvent.click(screen.getByTestId('saved-view-copy-link'));

    await waitFor(() =>
      expect(screen.getByTestId('finance-status-announcer')).toHaveTextContent('Link do widoku „Mój widok kwartalny" skopiowany.')
    );
  });

  it('usunięcie widoku ogłasza "Widok usunięty."', async () => {
    mockListFinanceSavedViews.mockResolvedValueOnce([sampleView()]);
    mockDeleteFinanceSavedView.mockResolvedValueOnce(undefined);
    mockListFinanceSavedViews.mockResolvedValueOnce([]);
    render(<FinanceSavedViewsPanel artifactId="art-1" />);
    await screen.findByTestId('finance-saved-views-panel');

    fireEvent.click(screen.getByTestId('saved-view-delete'));

    await waitFor(() => expect(screen.getByTestId('finance-status-announcer')).toHaveTextContent('Widok usunięty.'));
  });

  it('błąd ładowania → role="status" priority=assertive', async () => {
    mockListFinanceSavedViews.mockRejectedValueOnce(new Error('boom'));
    render(<FinanceSavedViewsPanel artifactId="art-1" />);
    await waitFor(() => expect(screen.getByTestId('finance-status-announcer')).toHaveAttribute('aria-live', 'assertive'));
  });

  it('KONTROLA NEGATYWNA: przy fladze OFF brak jakiegokolwiek role="status"', () => {
    window.localStorage.clear();
    const { container } = render(<FinanceSavedViewsPanel artifactId="art-1" />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('finance-status-announcer')).not.toBeInTheDocument();
  });
});
