import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '../../../../services/api';
import { OrganizationProfileModule } from '../OrganizationProfileModule';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => {
      const copy: Record<string, string> = {
        'organization.profilePresentation.navigation': 'Organization profile sections',
        'organization.profilePresentation.hint': 'Review existing profile sections.',
        'organization.profilePresentation.sections.type.label': 'Organization Type',
        'organization.profilePresentation.sections.type.description': 'Existing type selection',
        'organization.profilePresentation.sections.identity.label': 'Identity & Scale',
        'organization.profilePresentation.sections.identity.description':
          'Existing identity fields',
        'organization.profilePresentation.sections.strategic.label': 'Strategic Position',
        'organization.profilePresentation.sections.strategic.description':
          'Existing strategy fields',
        'organization.profilePresentation.sections.digital.label': 'Digital & Technology',
        'organization.profilePresentation.sections.digital.description':
          'Existing technology fields',
        'organization.profilePresentation.sections.market.label': 'Market & Competition',
        'organization.profilePresentation.sections.market.description': 'Existing market fields',
        'organization.profilePresentation.sections.communication.label':
          'Communication & AI Preferences',
        'organization.profilePresentation.sections.communication.description':
          'Existing communication fields',
        'organization.profilePresentation.sections.constraints.label': 'Constraints & Risk',
        'organization.profilePresentation.sections.constraints.description':
          'Existing constraints fields',
        'organization.profilePresentation.sections.documentExtraction.label': 'Document extraction',
        'organization.profilePresentation.sections.documentExtraction.description':
          'Extract source proposals',
        'organization.profilePresentation.sections.readiness.label': 'Completeness & Readiness',
        'organization.profilePresentation.sections.readiness.description':
          'Existing readiness calculation',
      };
      return copy[key] ?? fallback ?? key;
    },
  }),
}));

vi.mock('../../../../store/useAppStore', () => ({
  useAppStore: () => ({
    currentUser: { id: 'owner-1', organizationId: 'org-1' },
    currentOrganization: { id: 'org-1' },
  }),
}));

vi.mock('../../../../services/api', () => ({
  Api: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
  },
}));

describe('OrganizationProfileModule owner-feedback layout', () => {
  beforeEach(() => {
    vi.mocked(Api.get).mockResolvedValue({ exists: false });
  });

  it('presents existing canonical sections without consolidating them into a new IA', async () => {
    render(<OrganizationProfileModule />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Organization Type/i })).toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: /^Identity & Scale/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Strategic Position/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Digital & Technology/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Market & Competition/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^Communication & AI Preferences/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Constraints & Risk/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Document extraction/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Completeness & Readiness/i })).toBeInTheDocument();

    expect(screen.getAllByText('Organization Type').at(-1)).toBeVisible();
    expect(screen.getAllByText('Strategic Position').at(-1)).not.toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: /^Strategic Position/i }));
    expect(screen.getAllByText('Strategic Position').at(-1)).toBeVisible();
    expect(screen.getAllByText('Organization Type').at(-1)).not.toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: /^Document extraction/i }));
    expect(screen.getByRole('button', { name: /Extract from document/i })).toBeVisible();
    expect(screen.queryByText('Module Readiness')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Completeness & Readiness/i }));
    expect(
      screen.queryByRole('button', { name: /Extract from document/i })
    ).not.toBeInTheDocument();
    expect(screen.getByText('Module Readiness')).toBeVisible();
  });
});
