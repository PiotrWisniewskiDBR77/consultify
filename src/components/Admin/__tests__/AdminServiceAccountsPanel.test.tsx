import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createServiceAccount, getServiceAccounts } from '../../../services/adminServiceAccountsApi';
import { AdminServiceAccountsPanel } from '../AdminServiceAccountsPanel';

vi.mock('../../../services/adminServiceAccountsApi', () => ({ getServiceAccounts: vi.fn(), createServiceAccount: vi.fn(), revokeServiceAccount: vi.fn() }));
vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const get = vi.mocked(getServiceAccounts); const create = vi.mocked(createServiceAccount);
const account = { id: 'sa-1', name: 'Robot', description: null, token_prefix: 'tp_sa_abcd', scopes: ['records:read'], last_used_at: null, expires_at: null, created_at: '2026-08-24T20:00:00Z' };

describe('AdminServiceAccountsPanel', () => {
  beforeEach(() => { vi.clearAllMocks(); get.mockResolvedValue([account]); });
  it('lists masked service accounts without a full token', async () => { render(<AdminServiceAccountsPanel />); expect(await screen.findByText('Robot')).toBeInTheDocument(); expect(screen.getByText('tp_sa_abcd')).toBeInTheDocument(); });
  it('renders an honest empty state', async () => { get.mockResolvedValue([]); render(<AdminServiceAccountsPanel />); expect(await screen.findByText('Brak kont usługowych')).toBeInTheDocument(); });
  it('shows a newly created secret only after list readback', async () => { get.mockResolvedValueOnce([]).mockResolvedValueOnce([account]); create.mockResolvedValue({ account, token: 'tp_sa_FULL_SECRET' }); render(<AdminServiceAccountsPanel />); await screen.findByText('Brak kont usługowych'); fireEvent.change(screen.getByLabelText('Nazwa'), { target: { value: 'Robot' } }); fireEvent.click(screen.getByRole('button', { name: 'Utwórz' })); expect(await screen.findByText('tp_sa_FULL_SECRET')).toBeInTheDocument(); await waitFor(() => expect(get).toHaveBeenCalledTimes(2)); });
});
