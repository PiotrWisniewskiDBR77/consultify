import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getPlatformOperationTargets,
  runPlatformOperation,
} from '../../../services/superadminPlatformOperationsApi';
import { PlatformOperationsView } from '../PlatformOperationsView';

vi.mock('../../../services/superadminPlatformOperationsApi', () => ({
  getPlatformOperationTargets: vi.fn(),
  runPlatformOperation: vi.fn(),
}));
const getTargets = vi.mocked(getPlatformOperationTargets);
const run = vi.mocked(runPlatformOperation);

const openAction = async (name: string, targetId = 'org-1') => {
  const article = (await screen.findByText(name)).closest('article')!;
  fireEvent.change(within(article).getByRole('combobox'), { target: { value: targetId } });
  fireEvent.click(within(article).getByRole('button', { name: 'Przejdź do potwierdzenia' }));
  return screen.findByRole('dialog');
};

describe('PlatformOperationsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTargets.mockResolvedValue({
      organizations: [{ id: 'org-1', name: 'Acme', status: 'active' }],
      users: [{ id: 'user-1', name: 'ada@example.com', status: 'active' }],
    });
    run.mockResolvedValue({ success: true });
  });

  it('renders the five actions backed by selectable target lists', async () => {
    render(<PlatformOperationsView />);
    expect(await screen.findByText('Reaktywuj organizację')).toBeInTheDocument();
    expect(screen.getByText('Wymuś reset MFA')).toBeInTheDocument();
    expect(screen.getByText('Zawieś organizację')).toBeInTheDocument();
    expect(screen.getByText('Awaryjnie zablokuj organizację')).toBeInTheDocument();
    expect(screen.getByText('Zaplanuj trwałe usunięcie danych')).toBeInTheDocument();
  });

  it('keeps confirmation disabled without a reason', async () => {
    render(<PlatformOperationsView />);
    const dialog = await openAction('Zawieś organizację');
    expect(within(dialog).getByRole('button', { name: 'Wykonaj operację' })).toBeDisabled();
  });

  it('keeps purge disabled until the exact tenant name is typed', async () => {
    render(<PlatformOperationsView />);
    const dialog = await openAction('Zaplanuj trwałe usunięcie danych');
    fireEvent.change(within(dialog).getByLabelText('Powód'), {
      target: { value: 'cleanup approved' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Przepisz dokładnie/), {
      target: { value: 'Wrong' },
    });
    expect(within(dialog).getByRole('button', { name: 'Wykonaj operację' })).toBeDisabled();
  });

  it('records a successful operation in the session log', async () => {
    render(<PlatformOperationsView />);
    const dialog = await openAction('Reaktywuj organizację');
    fireEvent.change(within(dialog).getByLabelText('Powód'), {
      target: { value: 'incident resolved' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Wykonaj operację' }));
    expect(await screen.findByText(/Reaktywuj organizację · Acme · Sukces/)).toBeInTheDocument();
    expect(run).toHaveBeenCalledWith('/tenants/org-1/reactivate', {
      confirmation: true,
      reason: 'incident resolved',
    });
  });

  it('records a backend error instead of optimistic success', async () => {
    run.mockRejectedValue(new Error('Brak uprawnień do tej operacji.'));
    render(<PlatformOperationsView />);
    const dialog = await openAction('Wymuś reset MFA', 'user-1');
    fireEvent.change(within(dialog).getByLabelText('Powód'), { target: { value: 'lost device' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Wykonaj operację' }));
    await waitFor(() =>
      expect(screen.getByText(/Brak uprawnień do tej operacji/)).toBeInTheDocument()
    );
    expect(
      screen.queryByText(/Wymuś reset MFA · ada@example.com · Sukces/)
    ).not.toBeInTheDocument();
  });
});
