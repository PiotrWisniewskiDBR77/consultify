import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAdminDependencies } from '../../../services/adminDependenciesApi';
import { AdminDependenciesPanel } from '../AdminDependenciesPanel';

vi.mock('../../../services/adminDependenciesApi', () => ({ getAdminDependencies: vi.fn() }));
const get = vi.mocked(getAdminDependencies);

describe('AdminDependenciesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    get.mockResolvedValue({
      success: true,
      dependencies: [
        {
          dependencyId: 'primary_data_store',
          label: 'Baza danych',
          kind: 'database',
          status: 'unknown',
          probeIds: ['m15_kpi_round_trip'],
          lastCheckedAt: null,
        },
      ],
      undeclaredProbes: [],
      generatedAt: '2026-08-25T05:00:00.000Z',
    });
  });

  it('renders cached dependency status without claiming health', async () => {
    render(<AdminDependenciesPanel />);
    expect(await screen.findByText('Baza danych')).toBeInTheDocument();
    expect(screen.getByText('Brak wyniku')).toBeInTheDocument();
    expect(screen.queryByText('Działa')).not.toBeInTheDocument();
  });

  it('renders an honest empty state', async () => {
    get.mockResolvedValue({
      success: true,
      dependencies: [],
      undeclaredProbes: [],
      generatedAt: '',
    });
    render(<AdminDependenciesPanel />);
    expect(await screen.findByText('Brak zadeklarowanych zależności')).toBeInTheDocument();
  });

  it('renders a backend error', async () => {
    get.mockRejectedValue(new Error('Cache unavailable'));
    render(<AdminDependenciesPanel />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Cache unavailable');
  });
});
