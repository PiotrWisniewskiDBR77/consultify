import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OrganizationDecisionQualityPanel } from '../../../src/components/Organization/OrganizationDecisionQualityPanel';
import { organizationGovernedContextApi } from '../../../src/services/organizationGovernedContextApi';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { resolvedLanguage: 'pl', language: 'pl' } }),
}));

vi.mock('../../../src/services/organizationGovernedContextApi', () => ({
  organizationGovernedContextApi: {
    listClaims: vi.fn(),
    listVersions: vi.fn(),
  },
}));

const claim = (overrides: Record<string, unknown>) => ({
  claimId: 'claim-1',
  itemId: 'source-1',
  claimPath: 'industry',
  value: 'Management Consulting',
  confidence: 0.91,
  sourceType: 'interview',
  visibilityScope: 'organization',
  reviewState: 'approved',
  approved: true,
  approvalSource: 'explicit_review',
  decidedBy: 'owner-1',
  decidedAt: '2026-08-21T10:00:00.000Z',
  createdAt: '2026-08-21T09:00:00.000Z',
  ...overrides,
});

describe('OrganizationDecisionQualityPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders real counts and the exact conflicting values instead of UNKNOWN placeholders', async () => {
    vi.mocked(organizationGovernedContextApi.listClaims).mockResolvedValue([
      claim({ claimId: 'claim-1', value: 'Management Consulting' }),
      claim({
        claimId: 'claim-2',
        itemId: 'source-2',
        value: 'Industrial transformation advisory',
        sourceType: 'document',
      }),
    ] as never);
    vi.mocked(organizationGovernedContextApi.listVersions).mockResolvedValue([
      {
        snapshotId: 'snapshot-1',
        organizationId: 'org-1',
        version: 1,
        schemaVersion: 1,
        contentHash: 'hash-1',
        claimCount: 2,
        createdAt: '2026-08-21T11:00:00.000Z',
        createdBy: 'owner-1',
      },
    ]);

    render(
      <MemoryRouter>
        <OrganizationDecisionQualityPanel screen="summary" title="Gotowość organizacji" />
      </MemoryRouter>
    );

    expect(await screen.findByText('1 blokada wymaga działania')).toBeInTheDocument();
    expect(
      screen.getByText(/Management Consulting.*Industrial transformation advisory/)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rozstrzygnij/i })).toBeInTheDocument();
    expect(screen.queryByText('UNKNOWN')).not.toBeInTheDocument();
  });

  it('fails visibly when canonical readiness data cannot be read', async () => {
    vi.mocked(organizationGovernedContextApi.listClaims).mockRejectedValue(new Error('offline'));
    vi.mocked(organizationGovernedContextApi.listVersions).mockResolvedValue([]);

    render(
      <MemoryRouter>
        <OrganizationDecisionQualityPanel screen="summary" title="Gotowość organizacji" />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Nie można potwierdzić gotowości')
    );
    expect(screen.queryByText('READY')).not.toBeInTheDocument();
  });
});
