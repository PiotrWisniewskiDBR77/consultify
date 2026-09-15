import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { organizationGovernedContextApi } from '../../../services/organizationGovernedContextApi';
import { GovernedContextWorkspace } from '../GovernedContextWorkspace';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string, vars?: Record<string, number>) =>
      (fallback ?? _key)
        .replace('{{shown}}', String(vars?.shown ?? ''))
        .replace('{{total}}', String(vars?.total ?? '')),
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));

vi.mock('../../../services/organizationGovernedContextApi', () => ({
  organizationGovernedContextApi: {
    listClaimsPage: vi.fn(),
    listVersions: vi.fn(),
  },
  summarizeClaimValue: (value: unknown) => String(value),
  claimValueKey: (value: unknown) => String(value),
}));

describe('GovernedContextWorkspace claim total', () => {
  beforeEach(() => {
    vi.mocked(organizationGovernedContextApi.listClaimsPage).mockResolvedValue({
      claims: Array.from({ length: 200 }, (_, index) => ({
        claimId: `claim-${index}`, itemId: `item-${index}`, claimPath: `path.${index}`,
        value: `value-${index}`, confidence: 1, sourceType: 'document',
        visibilityScope: 'organization', reviewState: 'pending', approved: false,
        approvalSource: 'explicit_review', decidedBy: null, decidedAt: null,
        createdAt: '2026-09-14T00:00:00Z',
      })),
      total: 727,
      limit: 200,
    });
    vi.mocked(organizationGovernedContextApi.listVersions).mockResolvedValue([]);
  });

  it('shows the server total and the visible page size instead of presenting LIMIT 200 as the total', async () => {
    render(<GovernedContextWorkspace isAdmin />);
    expect(await screen.findByText('Claims (727)')).toBeInTheDocument();
    expect(screen.getByTestId('governed-claims-page-summary')).toHaveTextContent('Showing 200 of 727');
    await waitFor(() => expect(organizationGovernedContextApi.listClaimsPage).toHaveBeenCalledWith());
  });
});
