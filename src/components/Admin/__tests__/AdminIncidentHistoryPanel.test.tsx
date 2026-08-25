import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '../../../services/api';
import { AdminIncidentHistoryPanel } from '../AdminIncidentHistoryPanel';

vi.mock('../../../services/api', () => ({ Api: { getHealthPanelSummary: vi.fn() } }));
const get = vi.mocked(Api.getHealthPanelSummary);
const renderPanel = () =>
  render(
    <MemoryRouter>
      <AdminIncidentHistoryPanel />
    </MemoryRouter>
  );

describe('AdminIncidentHistoryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    get.mockResolvedValue({ summary: { total: 4, passed: 3, failed: 1, unknown: 0 } });
  });
  it('states honestly that tenant incident history does not exist', async () => {
    renderPanel();
    expect(
      screen.getByText(/Tenantowy rejestr incydentów operacyjnych nie jest jeszcze prowadzony/)
    ).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/admin/health/overview');
    expect(await screen.findByText('4')).toBeInTheDocument();
  });
  it('shows current tenant-safe health separately from history', async () => {
    renderPanel();
    expect(await screen.findByText('Stan bieżący, nie historia')).toBeInTheDocument();
    expect(await screen.findByText('4')).toBeInTheDocument();
  });
  it('shows the current-health API error without inventing incidents', async () => {
    get.mockRejectedValue(new Error('Summary unavailable'));
    renderPanel();
    expect(await screen.findByRole('alert')).toHaveTextContent('Summary unavailable');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
