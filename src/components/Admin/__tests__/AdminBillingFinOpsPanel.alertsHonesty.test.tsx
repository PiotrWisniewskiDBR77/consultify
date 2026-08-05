/**
 * M15-H02 (warstwa UI) — koniec z podwójną fabrykacją progów budżetowych.
 *
 * Regresja: gdy serwer nie zwrócił żadnych progów, panel podmieniał pustą listę
 * na `DEFAULT_BILLING_ALERTS` (80 / 75) i rysował je tak, jakby były zapisane.
 * Razem z serwerowym `success: true` nad nieistniejącą tabelą dawało to pełny
 * fałszywy sukces: zielony toast i „zapisane" wartości, których nigdzie nie ma.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '../../../services/api';
import { AdminBillingFinOpsPanel } from '../AdminBillingFinOpsPanel';

const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock('react-hot-toast', () => ({
  toast: {
    success: (...args: any[]) => toastSuccess(...args),
    error: (...args: any[]) => toastError(...args),
  },
}));

vi.mock('../../../services/api', () => ({
  Api: {
    getAdminBillingSummary: vi.fn(),
    getAdminBillingPaymentMethods: vi.fn(),
    getAdminBillingInvoices: vi.fn(),
    getAdminBillingAlerts: vi.fn(),
    getAdminBillingTaxSettings: vi.fn(),
    getAdminBillingUsageDetails: vi.fn(),
    getAdminBillingPlans: vi.fn(),
    updateAdminBillingAlerts: vi.fn(),
    assignAdminBillingPlan: vi.fn(),
    addAdminBillingPaymentMethod: vi.fn(),
    setAdminBillingDefaultPaymentMethod: vi.fn(),
    removeAdminBillingPaymentMethod: vi.fn(),
    updateAdminBillingTaxSettings: vi.fn(),
  },
}));

const mockedApi = Api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function primeApi(alertsResponse: any) {
  mockedApi.getAdminBillingSummary.mockResolvedValue({ summary: {} });
  mockedApi.getAdminBillingPaymentMethods.mockResolvedValue({ paymentMethods: [] });
  mockedApi.getAdminBillingInvoices.mockResolvedValue({ invoices: [] });
  mockedApi.getAdminBillingAlerts.mockResolvedValue(alertsResponse);
  mockedApi.getAdminBillingTaxSettings.mockResolvedValue({ settings: {} });
  mockedApi.getAdminBillingUsageDetails.mockResolvedValue({ summary: {} });
  mockedApi.getAdminBillingPlans.mockResolvedValue({ plans: [] });
}

async function openControlsTab() {
  render(<AdminBillingFinOpsPanel />);
  await waitFor(() => expect(mockedApi.getAdminBillingAlerts).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: /Budgets & tax|Budżety i podatki/i }));
}

describe('M15-H02 (UI) — progi budżetowe nie są fabrykowane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it('pokazuje stan niedostępności zamiast domyślnych progów', async () => {
    primeApi({ available: false, unavailableReason: 'BILLING_ALERTS_STORAGE_UNAVAILABLE', alerts: [] });

    await openControlsTab();

    await waitFor(() => {
      expect(screen.getByTestId('billing-alerts-unavailable')).toBeInTheDocument();
    });
    // Żadnego pola progu — nie ma czego pokazać jako "ustawione".
    expect(screen.queryByDisplayValue('80')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('75')).not.toBeInTheDocument();
  });

  it('blokuje zapis, gdy magazyn progów jest niedostępny', async () => {
    primeApi({ available: false, unavailableReason: 'BILLING_ALERTS_STORAGE_UNAVAILABLE', alerts: [] });

    await openControlsTab();

    await waitFor(() => {
      expect(screen.getByTestId('billing-alerts-save')).toBeDisabled();
    });
  });

  it('nie melduje sukcesu, gdy serwer odrzuci zapis', async () => {
    primeApi({ available: true, alerts: [{ id: 'a1', type: 'tokens', threshold: 80 }] });
    mockedApi.updateAdminBillingAlerts.mockRejectedValue(
      new Error('Nie udało się trwale zapisać progów budżetowych.')
    );

    await openControlsTab();
    await waitFor(() => expect(screen.getByTestId('billing-alerts-save')).toBeEnabled());
    fireEvent.click(screen.getByTestId('billing-alerts-save'));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastSuccess).not.toHaveBeenCalled();
    // Po odmowie progi są oznaczone jako niedostępne, nie „zapisane".
    await waitFor(() =>
      expect(screen.getByTestId('billing-alerts-unavailable')).toBeInTheDocument()
    );
  });

  it('melduje sukces wyłącznie po potwierdzeniu z serwera', async () => {
    primeApi({ available: true, alerts: [{ id: 'a1', type: 'tokens', threshold: 80 }] });
    mockedApi.updateAdminBillingAlerts.mockResolvedValue({
      success: true,
      alerts: [{ id: 'a1', type: 'tokens', threshold: 80 }],
    });

    await openControlsTab();
    await waitFor(() => expect(screen.getByTestId('billing-alerts-save')).toBeEnabled());
    fireEvent.click(screen.getByTestId('billing-alerts-save'));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(toastError).not.toHaveBeenCalled();
  });

  it('pusta lista przy działającym magazynie to stan pusty, nie niedostępność', async () => {
    primeApi({ available: true, alerts: [] });

    await openControlsTab();

    await waitFor(() => {
      expect(screen.getByTestId('billing-alerts-empty')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('billing-alerts-unavailable')).not.toBeInTheDocument();
  });
});
