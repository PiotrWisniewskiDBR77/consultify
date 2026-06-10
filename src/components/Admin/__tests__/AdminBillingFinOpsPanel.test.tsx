/**
 * AdminBillingFinOpsPanel — manual-billing plan & limit assignment (Module 17).
 *
 * Verifies the tenant-admin billing surface loads its summary, exposes the
 * "Plan & limits" tab, and that assigning a plan posts the manual-billing
 * payload (plan + credit/storage/seat/expiry limits) through the admin API.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '../../../services/api';
import { AdminBillingFinOpsPanel } from '../AdminBillingFinOpsPanel';

vi.mock('react-hot-toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
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
    assignAdminBillingPlan: vi.fn(),
  },
}));

const mockedApi = Api as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.getAdminBillingSummary.mockResolvedValue({
    summary: { plan: { name: 'Trial', tokenLimit: 0 }, billing: { status: 'active' }, usage: {} },
  });
  mockedApi.getAdminBillingPaymentMethods.mockResolvedValue({ paymentMethods: [] });
  mockedApi.getAdminBillingInvoices.mockResolvedValue({ invoices: [] });
  mockedApi.getAdminBillingAlerts.mockResolvedValue({ alerts: [] });
  mockedApi.getAdminBillingTaxSettings.mockResolvedValue({ settings: {} });
  mockedApi.getAdminBillingUsageDetails.mockResolvedValue({ summary: {} });
  mockedApi.getAdminBillingPlans.mockResolvedValue({
    plans: [{ id: 'plan-pro', name: 'Pro' }],
  });
  mockedApi.assignAdminBillingPlan.mockResolvedValue({
    success: true,
    summary: {
      plan: { name: 'Pro', tokenLimit: 500000 },
      billing: { status: 'active' },
      usage: {},
    },
  });
});

describe('AdminBillingFinOpsPanel', () => {
  it('loads the billing summary and plan options on mount', async () => {
    render(<AdminBillingFinOpsPanel />);
    await waitFor(() => expect(mockedApi.getAdminBillingSummary).toHaveBeenCalled());
    expect(mockedApi.getAdminBillingPlans).toHaveBeenCalled();
  });

  it('assigns a plan with credit, storage, seat, and expiry limits', async () => {
    render(<AdminBillingFinOpsPanel />);
    await waitFor(() => expect(mockedApi.getAdminBillingPlans).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Plan & limits' }));

    fireEvent.change(await screen.findByLabelText('Subscription plan'), {
      target: { value: 'plan-pro' },
    });
    fireEvent.change(screen.getByLabelText('Token / credit limit'), {
      target: { value: '500000' },
    });
    fireEvent.change(screen.getByLabelText('Storage limit (MB)'), { target: { value: '2048' } });
    fireEvent.change(screen.getByLabelText('Seats (max users)'), { target: { value: '25' } });
    fireEvent.change(screen.getByLabelText('Expiry / period end'), {
      target: { value: '2026-12-31' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Assign plan & limits' }));

    await waitFor(() => expect(mockedApi.assignAdminBillingPlan).toHaveBeenCalledTimes(1));
    const payload = mockedApi.assignAdminBillingPlan.mock.calls[0][0];
    expect(payload).toMatchObject({
      planId: 'plan-pro',
      tokenLimit: 500000,
      storageLimitMb: 2048,
      seats: 25,
    });
    expect(payload.expiresAt).toContain('2026-12-31');
  });

  it('does not reference the removed pm_demo_4242 hardcoded hint', async () => {
    render(<AdminBillingFinOpsPanel />);
    await waitFor(() => expect(mockedApi.getAdminBillingSummary).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Payment methods' }));
    expect(screen.queryByPlaceholderText('pm_demo_4242')).not.toBeInTheDocument();
  });
});
