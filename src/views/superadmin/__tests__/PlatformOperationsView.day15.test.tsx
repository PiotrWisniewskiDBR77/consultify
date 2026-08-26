import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getPlatformOperationTargets,
  runPlatformOperation,
} from '../../../services/superadminPlatformOperationsApi';
import { PlatformOperationsView } from '../PlatformOperationsView';

vi.mock('react-i18next', async () => {
  const { createRealUseTranslation } = await import('../../../test-utils/realTranslations');
  return { useTranslation: createRealUseTranslation('pl') };
});

vi.mock('../../../services/superadminPlatformOperationsApi', () => ({
  getPlatformOperationTargets: vi.fn(),
  runPlatformOperation: vi.fn(),
}));
const getTargets = vi.mocked(getPlatformOperationTargets);
const run = vi.mocked(runPlatformOperation);

const choose = async (name: string, id: string) => {
  const article = (await screen.findByText(name)).closest('article')!;
  fireEvent.change(within(article).getByRole('combobox'), { target: { value: id } });
  fireEvent.click(within(article).getByRole('button', { name: 'Przejdź do potwierdzenia' }));
  return screen.findByRole('dialog');
};

describe('PlatformOperationsView Day 15 actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTargets.mockResolvedValue({
      organizations: [],
      users: [],
      connectors: [{ id: 'slack', name: 'Slack', affectedTenants: 3 }],
      virtualWorkers: [{ id: 'worker-1', name: 'Teresa', status: 'active' }],
    });
    run.mockResolvedValue({ success: true });
  });

  it('renders both newly exposed actions from real target catalogs', async () => {
    render(<PlatformOperationsView />);
    expect(await screen.findByText('Awaryjnie wyłącz konektor')).toBeInTheDocument();
    expect(screen.getByText('Zawieś pracownika wirtualnego')).toBeInTheDocument();
  });

  it('shows connector blast radius and keeps confirmation disabled without a reason', async () => {
    render(<PlatformOperationsView />);
    const dialog = await choose('Awaryjnie wyłącz konektor', 'slack');
    expect(within(dialog).getByText(/Zakres: 3 organizacji/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Wykonaj operację' })).toBeDisabled();
  });

  it('executes virtual-worker suspension and records server-confirmed success', async () => {
    render(<PlatformOperationsView />);
    const dialog = await choose('Zawieś pracownika wirtualnego', 'worker-1');
    fireEvent.change(within(dialog).getByLabelText('Powód'), {
      target: { value: 'operator decision' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Wykonaj operację' }));
    await waitFor(() =>
      expect(run).toHaveBeenCalledWith('/virtual-workers/worker-1/suspend', {
        confirmation: true,
        reason: 'operator decision',
      })
    );
    expect(
      await screen.findByText(/Zawieś pracownika wirtualnego · Teresa · Sukces/)
    ).toBeInTheDocument();
  });

  it('records a connector API error without a false success', async () => {
    run.mockRejectedValue(
      Object.assign(new Error('denied'), { status: 403, data: { code: 'FORBIDDEN' } })
    );
    render(<PlatformOperationsView />);
    const dialog = await choose('Awaryjnie wyłącz konektor', 'slack');
    fireEvent.change(within(dialog).getByLabelText('Powód'), {
      target: { value: 'security incident' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Wykonaj operację' }));
    expect(await screen.findByText(/Nie masz uprawnień/)).toBeInTheDocument();
    expect(
      screen.queryByText(/Awaryjnie wyłącz konektor · Slack · Sukces/)
    ).not.toBeInTheDocument();
  });
});
