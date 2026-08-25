import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '../../../services/api';
import { V8FinanceApi } from '../../../services/api/v8/finance';
import { AdminOrganizationDefaultsPanel } from '../AdminOrganizationDefaultsPanel';

vi.mock('../../../services/api', () => ({ Api: { get: vi.fn(), put: vi.fn() } }));
vi.mock('../../../services/api/v8/finance', () => ({
  V8FinanceApi: { getSettings: vi.fn(), updateSettings: vi.fn() },
}));

const profileResponse = {
  profile: { defaultTimezone: 'Europe/Warsaw', defaultLanguage: 'pl', dateFormat: 'DD/MM/YYYY' },
};

describe('AdminOrganizationDefaultsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.get).mockResolvedValue(profileResponse);
    vi.mocked(Api.put).mockResolvedValue({});
    vi.mocked(V8FinanceApi.getSettings).mockResolvedValue({
      defaultCurrency: 'PLN',
      defaultWacc: 10,
      defaultHorizonYears: 5,
      version: 3,
    });
  });

  it('loads both sources independently and saves profile with GET readback', async () => {
    render(<AdminOrganizationDefaultsPanel organizationId="org-1" />);
    expect(await screen.findByDisplayValue('Europe/Warsaw')).toBeInTheDocument();
    expect(await screen.findByDisplayValue('PLN')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Strefa czasowa'), { target: { value: 'UTC' } });
    fireEvent.click(screen.getByText('Zapisz lokalizację i format'));
    await waitFor(() =>
      expect(Api.put).toHaveBeenCalledWith(
        '/admin/organization-profile',
        expect.objectContaining({ defaultTimezone: 'UTC' })
      )
    );
    expect(Api.get).toHaveBeenCalledTimes(2);
  });

  it('uses optimistic version and response state as finance readback', async () => {
    vi.mocked(V8FinanceApi.updateSettings).mockResolvedValue({
      state: { defaultCurrency: 'EUR', defaultWacc: 8, defaultHorizonYears: 4, version: 4 },
      receiptId: 'r1',
      idempotentReplay: false,
    });
    render(<AdminOrganizationDefaultsPanel organizationId="org-1" />);
    await screen.findByDisplayValue('PLN');
    fireEvent.change(screen.getByLabelText('Domyślna waluta'), { target: { value: 'EUR' } });
    fireEvent.click(screen.getByText('Zapisz domyślne finansowe'));
    await waitFor(() =>
      expect(V8FinanceApi.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({ defaultCurrency: 'EUR' }),
        3,
        expect.any(String)
      )
    );
    expect(await screen.findByDisplayValue('EUR')).toBeInTheDocument();
  });

  it('keeps profile active when V8 is disabled', async () => {
    vi.mocked(V8FinanceApi.getSettings).mockRejectedValue(
      Object.assign(new Error('V8_DISABLED'), { data: { code: 'V8_DISABLED' } })
    );
    render(<AdminOrganizationDefaultsPanel organizationId="org-1" />);
    expect(await screen.findByText(/V8 nie jest włączone/)).toBeInTheDocument();
    expect(screen.getByText('Zapisz lokalizację i format')).toBeEnabled();
  });

  it('blocks profile save after a failed read and offers retry', async () => {
    vi.mocked(Api.get).mockRejectedValue(new Error('profile unavailable'));
    render(<AdminOrganizationDefaultsPanel organizationId="org-1" />);
    expect(await screen.findByText('profile unavailable')).toBeInTheDocument();
    expect(screen.getByText('Zapisz lokalizację i format')).toBeDisabled();
    expect(screen.getAllByText('Spróbuj ponownie').length).toBeGreaterThan(0);
  });

  it('blocks finance save after a failed read and offers retry', async () => {
    vi.mocked(V8FinanceApi.getSettings).mockRejectedValue(new Error('finance unavailable'));
    render(<AdminOrganizationDefaultsPanel organizationId="org-1" />);
    expect(await screen.findByText('finance unavailable')).toBeInTheDocument();
    expect(screen.getByText('Zapisz domyślne finansowe')).toBeDisabled();
  });
});
