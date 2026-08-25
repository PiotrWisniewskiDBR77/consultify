import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createRealT } from '@/test-utils/realTranslations';
import { getLegalHold } from '../../../services/adminLegalHoldApi';
import { AdminLegalHoldPanel } from '../AdminLegalHoldPanel';

// Opt-in to real PL translation resolution (tests/setup.ts's global
// react-i18next mock is key-agnostic by repo convention). This panel's
// own admin day-2 i18n contract (AdminDay2I18n.test.ts) forbids defaultValue
// fallbacks, so its tests assert literal Polish strings resolved from the
// real shipped translation.json instead.
vi.mock('react-i18next', () => {
  const t = createRealT('pl');
  return { useTranslation: () => ({ t, i18n: { language: 'pl' } }) };
});

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
