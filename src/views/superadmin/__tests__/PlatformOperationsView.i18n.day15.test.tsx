import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getPlatformOperationTargets } from '../../../services/superadminPlatformOperationsApi';
import { PlatformOperationsView } from '../PlatformOperationsView';

vi.mock('react-i18next', async () => {
  const { createRealUseTranslation } = await import('../../../test-utils/realTranslations');
  return { useTranslation: createRealUseTranslation('en') };
});

vi.mock('../../../services/superadminPlatformOperationsApi', () => ({
  getPlatformOperationTargets: vi.fn(),
  runPlatformOperation: vi.fn(),
}));

describe('PlatformOperationsView Day 15 English locale', () => {
  beforeEach(() => {
    vi.mocked(getPlatformOperationTargets).mockResolvedValue({
      organizations: [],
      users: [],
      connectors: [{ id: 'slack', name: 'Slack', affectedTenants: 3 }],
      virtualWorkers: [{ id: 'worker-1', name: 'Teresa', status: 'active' }],
    });
  });

  it('renders shipped English action labels without exposing raw translation keys', async () => {
    render(<PlatformOperationsView />);
    expect(await screen.findByText('Emergency connector shutdown')).toBeInTheDocument();
    expect(screen.getByText('Suspend virtual worker')).toBeInTheDocument();
    expect(screen.queryByText('superadmin.platformOperations.title')).not.toBeInTheDocument();
  });
});
