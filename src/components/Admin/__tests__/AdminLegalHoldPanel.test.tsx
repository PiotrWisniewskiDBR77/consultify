import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { getLegalHold } from '../../../services/adminLegalHoldApi';
import { AdminLegalHoldPanel } from '../AdminLegalHoldPanel';
vi.mock('../../../services/adminLegalHoldApi', () => ({ getLegalHold: vi.fn() }));
describe('AdminLegalHoldPanel', () => {
  it('shows factual state and honest missing registry', async () => {
    vi.mocked(getLegalHold).mockResolvedValue({
      legalHoldEnabled: true,
      blockedOperations: ['data_export', 'organization_deletion'],
      matterRegistryAvailable: false,
    });
    render(<AdminLegalHoldPanel />);
    expect(await screen.findByText('Wstrzymanie aktywne')).toBeInTheDocument();
    expect(screen.getByText(/Rejestr spraw nie jest jeszcze prowadzony/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders an honest inactive state when legal hold is off', async () => {
    vi.mocked(getLegalHold).mockResolvedValue({
      legalHoldEnabled: false,
      blockedOperations: [],
      matterRegistryAvailable: false,
    });
    render(<AdminLegalHoldPanel />);
    expect(await screen.findByText('Wstrzymanie nieaktywne')).toBeInTheDocument();
  });

  it('renders an API error', async () => {
    vi.mocked(getLegalHold).mockRejectedValue(new Error('legal hold service down'));
    render(<AdminLegalHoldPanel />);
    expect(await screen.findByText('legal hold service down')).toBeInTheDocument();
  });
});
