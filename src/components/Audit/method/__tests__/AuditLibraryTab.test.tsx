/**
 * AuditLibraryTab — Library surface (pakiety audytowe).
 *
 * Mockuje `../auditsMethodApi` NA POZIOMIE MODUŁU (kształt serwera:
 * `getPack` zwraca `AuditPackDetail`, nie surowy fetch) — zgodnie z briefem
 * U7 "mock musi mieć kształt serwera".
 *
 * P0 2026-08-13 (rozdzielenie osi): te testy egzekwują wprost, że
 * `sourceType` (CZYM jest źródło) i `verificationStatus` (CZY sprawdzono)
 * nigdy się nie mieszają w renderowanym UI — patrz komentarze przy każdym
 * teście dla dokładnego wymogu z briefu.
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
import {
  AUDIT_VERIFICATION_STATES,
  getPack,
  type AuditPackDetail,
  type AuditPackSummary,
  type AuditVerificationState,
} from '../auditsMethodApi';

const mockedGetPack = vi.mocked(getPack);

function makePack(overrides: Partial<AuditPackSummary> = {}): AuditPackSummary {
  return {
    id: 'pack-1',
    packKey: 'demo-key',
    version: 1,
    title: 'Demo Pack',
    summary: null,
    sourceId: 'src-1',
    sourceTitle: 'Some source',
    sourceVersion: '1',
    sourceType: 'INTERNAL_PROCEDURE',
    verificationStatus: 'UNVERIFIED',
    publicationStatus: 'draft',
    requiredRoles: [],
    criteriaCount: 1,
    updatedAt: '2026-08-01',
    ...overrides,
  };
}

// Procedura QMS klienta, zweryfikowana przez eksperta — DOKŁADNIE ten pakiet,
// który w starej (jednoosiowej) wersji renderował się jako „Zweryfikowana
// norma". Musi renderować sie jako "Internal procedure" + "Verified".
const verifiedInternalProcedure = makePack({
  id: 'pack-1',
  title: 'Client QMS Procedure',
  sourceType: 'INTERNAL_PROCEDURE',
  verificationStatus: 'VERIFIED',
  publicationStatus: 'published',
  sourceId: 'src-1',
});

const demoPack = makePack({
  id: 'pack-2',
  title: 'Demonstration Pack',
  sourceType: 'DEMONSTRATION',
  verificationStatus: 'UNVERIFIED',
  publicationStatus: 'draft',
  sourceId: null,
  sourceTitle: null,
});

const legacyPack = makePack({
  id: 'pack-3',
  title: 'Legacy ISO Mapping',
  sourceType: 'LEGACY',
  verificationStatus: 'UNVERIFIED',
  publicationStatus: 'deprecated',
  sourceId: 'src-3',
});

const noSourcePublishedPack = makePack({
  id: 'pack-4',
  title: 'No-Source Pack',
  sourceType: 'INTERNAL_FRAMEWORK',
  verificationStatus: 'PENDING_REVIEW',
  // API defensywnie mówi "published", ale bez źródła to nie może liczyć się
  // jako opublikowana podstawa audytu w UI.
  publicationStatus: 'published',
  sourceId: null,
  sourceTitle: null,
});

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
      packs={[verifiedInternalProcedure, demoPack, legacyPack]}
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
  it('renders a real StandardTable element, not a bespoke grid', () => {
    const { container } = renderTab();
    expect(container.querySelector('table')).toBeInTheDocument();
  });

  it('shows a source-type chip AND a separate verification chip for every pack row (two axes, two columns)', () => {
    renderTab();
    expect(screen.getByText('Internal procedure')).toBeInTheDocument();
    expect(screen.getByText('Demonstration')).toBeInTheDocument();
    expect(screen.getByText('Legacy (retired)')).toBeInTheDocument();
    // Verification axis is a separate label from the type axis.
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getAllByText('Unverified').length).toBeGreaterThan(0);
  });

  it('never renders a "norm…" label for the verified internal procedure — the exact bug this model fixes', () => {
    const { container } = renderTab();
    const row = screen.getByText('Client QMS Procedure').closest('tr');
    expect(row).toBeTruthy();
    expect(within(row as HTMLElement).queryByText(/norm/i)).toBeNull();
    // Belt and braces: scan the whole rendered table text too.
    expect(container.textContent).not.toMatch(/verified normative/i);
  });

  it('never gives the DEMONSTRATION source-type chip a success (emerald) shell', () => {
    renderTab();
    const chip = screen.getByText('Demonstration').closest('[role="status"]');
    expect(chip).toBeTruthy();
    expect(chip?.className).not.toMatch(/emerald/);
    expect(chip?.className).toMatch(/amber/);
  });

  it('LEGACY chip never looks current — no emerald/blue/amber vivid fill (neutral shell)', () => {
    renderTab();
    const chip = screen.getByText('Legacy (retired)').closest('[role="status"]');
    expect(chip).toBeTruthy();
    expect(chip?.className).not.toMatch(/emerald|blue|amber/);
  });

  it('VERIFIED gets the success (emerald) shell on the verification axis', () => {
    renderTab();
    const chip = screen.getByText('Verified').closest('[role="status"]');
    expect(chip?.className).toMatch(/emerald/);
  });

  it('changing verificationStatus never changes the rendered source-type label — same pack, four verification states', async () => {
    for (const verificationStatus of AUDIT_VERIFICATION_STATES) {
      const pack = makePack({
        id: 'stable-type',
        title: 'Stable Type Pack',
        sourceType: 'REGULATION',
        verificationStatus,
      });
      const { unmount } = render(
        <AuditLibraryTab
          packs={[pack]}
          loading={false}
          error={null}
          onRetry={vi.fn()}
          isPolish={false}
          onStartAudit={vi.fn()}
          startingPackId={null}
        />
      );
      expect(screen.getByText('Regulation')).toBeInTheDocument();
      unmount();
    }
  });

  it('a pack with no source can never count as "published" in the UI — Start audit stays disabled with a visible reason', async () => {
    mockedGetPack.mockResolvedValue(packDetailFixture(noSourcePublishedPack));
    renderTab({ packs: [noSourcePublishedPack] });

    fireEvent.click(screen.getByText('No-Source Pack'));

    await waitFor(() => expect(mockedGetPack).toHaveBeenCalledWith('pack-4'));

    const startButtons = await screen.findAllByRole('button', { name: 'Start audit' });
    const previewButton = startButtons[startButtons.length - 1];
    expect(previewButton).toBeDisabled();
    expect(screen.getByText(/no source attached/i)).toBeInTheDocument();
  });

  it('shows the "compliance-audit basis" pill as No for DEMONSTRATION, keeping it visibly distinct from a compliance audit', async () => {
    mockedGetPack.mockResolvedValue(packDetailFixture(demoPack));
    renderTab();

    fireEvent.click(screen.getByText('Demonstration Pack'));
    await waitFor(() => expect(mockedGetPack).toHaveBeenCalledWith('pack-2'));

    // MetaPill renders "label: value" as one text node.
    const basisPill = await screen.findByText('Compliance-audit basis: No');
    expect(basisPill).toBeInTheDocument();
    expect(basisPill.className).not.toMatch(/emerald/);
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
  });

  it('enables "Start audit" for a published pack that HAS a source, and calls onStartAudit', async () => {
    mockedGetPack.mockResolvedValue(packDetailFixture(verifiedInternalProcedure));
    const { onStartAudit } = renderTab();

    fireEvent.click(screen.getByText('Client QMS Procedure'));

    const startButtons = await screen.findAllByRole('button', { name: 'Start audit' });
    const previewButton = startButtons[startButtons.length - 1];
    expect(previewButton).not.toBeDisabled();

    fireEvent.click(previewButton);
    expect(onStartAudit).toHaveBeenCalledWith(verifiedInternalProcedure);
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
