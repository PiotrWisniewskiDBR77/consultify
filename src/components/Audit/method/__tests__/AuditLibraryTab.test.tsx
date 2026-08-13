/**
 * AuditLibraryTab — Library surface (pakiety audytowe).
 *
 * Mockuje `../auditsMethodApi` NA POZIOMIE MODUŁU (kształt serwera:
 * `getPack` zwraca `AuditPackDetail`, nie surowy fetch) — zgodnie z briefem
 * U7 "mock musi mieć kształt serwera".
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { defaultValue?: string }) => {
      if (typeof fallback === 'string') return fallback;
      if (fallback && typeof fallback === 'object' && fallback.defaultValue) return fallback.defaultValue;
      return key;
    },
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('../auditsMethodApi', async () => {
  const actual = await vi.importActual<typeof import('../auditsMethodApi')>('../auditsMethodApi');
  return {
    ...actual,
    getPack: vi.fn(),
  };
});

import { AuditLibraryTab } from '../tabs/AuditLibraryTab';
import { getPack, type AuditPackDetail, type AuditPackSummary } from '../auditsMethodApi';

const mockedGetPack = vi.mocked(getPack);

const verifiedPack: AuditPackSummary = {
  id: 'pack-1',
  packKey: 'iso-19011',
  version: 2,
  title: 'ISO 19011 Audit Pack',
  summary: 'Guidelines for auditing management systems',
  sourceId: 'src-1',
  sourceTitle: 'ISO 19011:2018',
  sourceVersion: '2018',
  classification: 'VERIFIED_NORMATIVE',
  publicationStatus: 'published',
  requiredRoles: ['lead_auditor', 'auditor'],
  criteriaCount: 42,
  updatedAt: '2026-08-01',
};

const demoPack: AuditPackSummary = {
  id: 'pack-2',
  packKey: 'demo-pack',
  version: 1,
  title: 'Demonstration Pack',
  summary: 'For demo purposes only',
  sourceId: null,
  sourceTitle: null,
  sourceVersion: null,
  classification: 'DEMONSTRATION',
  publicationStatus: 'draft',
  requiredRoles: [],
  criteriaCount: 3,
  updatedAt: '2026-08-02',
};

const packDetailFixture = (pack: AuditPackSummary): AuditPackDetail => ({
  ...pack,
  purpose: 'Verify conformity',
  scope: 'Whole organization',
  objectives: null,
  auditType: 'compliance',
  requiredCompetencies: [],
  findingTaxonomy: [],
  rightsStatus: 'licensed',
  rightsNote: null,
  criteria: [],
});

function renderTab(overrides: Partial<React.ComponentProps<typeof AuditLibraryTab>> = {}) {
  const onRetry = vi.fn();
  const onStartAudit = vi.fn();
  const utils = render(
    <AuditLibraryTab
      packs={[verifiedPack, demoPack]}
      loading={false}
      error={null}
      onRetry={onRetry}
      isPolish={false}
      onStartAudit={onStartAudit}
      startingPackId={null}
      {...overrides}
    />
  );
  return { ...utils, onRetry, onStartAudit };
}

describe('AuditLibraryTab', () => {
  it('renders a real StandardTable (native <table>), not a bespoke grid', () => {
    const { container } = renderTab();
    expect(container.querySelector('table')).toBeInTheDocument();
  });

  it('shows the classification chip for every pack row', () => {
    renderTab();
    expect(screen.getByText('Verified normative')).toBeInTheDocument();
    expect(screen.getByText('Demonstration')).toBeInTheDocument();
  });

  it('never gives the DEMONSTRATION chip a success (emerald) shell', () => {
    renderTab();
    const chip = screen.getByText('Demonstration').closest('[role="status"]');
    expect(chip).toBeTruthy();
    expect(chip?.className).not.toMatch(/emerald/);
    // Warning shell uses the amber scale (see auditStatusTones.packClassificationTone).
    expect(chip?.className).toMatch(/amber/);
  });

  it('gives the VERIFIED_NORMATIVE chip the success (emerald) shell', () => {
    renderTab();
    const chip = screen.getByText('Verified normative').closest('[role="status"]');
    expect(chip?.className).toMatch(/emerald/);
  });

  it('opens the docked preview on row click and disables "Start audit" for a draft pack with a visible reason', async () => {
    mockedGetPack.mockResolvedValue(packDetailFixture(demoPack));
    renderTab();

    fireEvent.click(screen.getByText('Demonstration Pack'));

    await waitFor(() => {
      expect(mockedGetPack).toHaveBeenCalledWith('pack-2');
    });

    const startButtons = await screen.findAllByRole('button', { name: 'Start audit' });
    const previewButton = startButtons[startButtons.length - 1];
    expect(previewButton).toBeDisabled();
    expect(
      screen.getByText(/not in "Published" status/i)
    ).toBeInTheDocument();
  });

  it('enables "Start audit" for a published pack and calls onStartAudit', async () => {
    mockedGetPack.mockResolvedValue(packDetailFixture(verifiedPack));
    const { onStartAudit } = renderTab();

    fireEvent.click(screen.getByText('ISO 19011 Audit Pack'));

    const startButtons = await screen.findAllByRole('button', { name: 'Start audit' });
    const previewButton = startButtons[startButtons.length - 1];
    expect(previewButton).not.toBeDisabled();

    fireEvent.click(previewButton);
    expect(onStartAudit).toHaveBeenCalledWith(verifiedPack);
  });

  it('shows ErrorState with a working retry when the pack list failed to load', () => {
    const { onRetry } = renderTab({ error: 'Network error', packs: [] } as any);
    expect(screen.getByText('Network error')).toBeInTheDocument();
    const retryButton = screen.getByRole('button', { name: /try again|retry/i });
    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalled();
  });

  it('shows an explanatory EmptyState when there are no packs at all', () => {
    renderTab({ packs: [] });
    expect(screen.getByText('No audit packs yet')).toBeInTheDocument();
    expect(screen.getByText(/library is empty/i)).toBeInTheDocument();
  });
});
