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
 *
 * 1.1-A5: dopisano `MemoryRouter` wokół każdego renderu (POMIAR — cały plik
 * był czerwony PRZED tą zmianą: `AuditLibraryTab` osadza `JedenPrawyPanel`,
 * który woła `useJedenPanel()`/`useLocation()` bezwarunkowo, patrz identyczny
 * ZNALEZISKO/naprawa w `AuditProcessesTab.finalizeOutput.test.tsx` —
 * "useLocation() may be used only in the context of a <Router>"). Dług
 * zastany niezwiązany z A5, naprawiony przy okazji bo blokował weryfikację
 * nowych testów w TYM SAMYM pliku.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
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

import {
  AuditLibraryTab,
  evaluateApproveExpertGate,
  evaluatePublishPackGate,
} from '../tabs/AuditLibraryTab';
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
    expertApprovedBy: null,
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
  const onApprovePackExpert = vi.fn();
  const onPublishPack = vi.fn();
  const utils = render(
    <MemoryRouter>
      <AuditLibraryTab
        packs={[verifiedInternalProcedure, demoPack, legacyPack]}
        loading={false}
        error={null}
        onRetry={onRetry}
        isPolish={false}
        onStartAudit={onStartAudit}
        startingPackId={null}
        canManagePackLibrary
        onApprovePackExpert={onApprovePackExpert}
        onPublishPack={onPublishPack}
        pendingPackActionKey={null}
        {...overrides}
      />
    </MemoryRouter>
  );
  return { ...utils, onRetry, onStartAudit, onApprovePackExpert, onPublishPack };
}

/** Otwiera kebab jedynego wiersza wyrenderowanej tabeli (jeden `packs`). */
function openRowKebab() {
  fireEvent.click(screen.getByLabelText('Row actions'));
}

function menuItemButtons(): HTMLButtonElement[] {
  const menu = document.querySelector('[role="menu"]') as HTMLElement;
  return [...menu.querySelectorAll('button[role="menuitem"]')] as HTMLButtonElement[];
}

function menuItemByLabel(label: string): HTMLButtonElement {
  const found = menuItemButtons().find((b) => b.textContent?.trim().startsWith(label));
  if (!found) throw new Error(`kebab item "${label}" not found`);
  return found;
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
        <MemoryRouter>
          <AuditLibraryTab
            packs={[pack]}
            loading={false}
            error={null}
            onRetry={vi.fn()}
            isPolish={false}
            onStartAudit={vi.fn()}
            startingPackId={null}
            canManagePackLibrary
            onApprovePackExpert={vi.fn()}
            onPublishPack={vi.fn()}
            pendingPackActionKey={null}
          />
        </MemoryRouter>
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

  // KOSMETYKA RAPORT_B #8 (evidence/audyt-mvp-20260906/B/RAPORT_B.md, 12-2):
  // pod tytułem pakietu widniał surowy slug techniczny (`row.packKey`, np.
  // "dbr77–robotyzacja–linia–spawalnicza") bez żadnej etykiety kontekstowej.
  // `row.title` (nazwa) jest już widoczna — surowy klucz jest ukryty, nie
  // ozdobiony etykietą "ID:".
  it('never renders the raw technical packKey under the title (RAPORT_B #8)', () => {
    const packWithDistinctiveKey = makePack({
      id: 'pack-5',
      title: 'Audyt gotowości do robotyzacji — linia spawalnicza',
      packKey: 'dbr77-robotyzacja-linia-spawalnicza',
    });
    renderTab({ packs: [packWithDistinctiveKey] });
    expect(
      screen.getByText('Audyt gotowości do robotyzacji — linia spawalnicza')
    ).toBeInTheDocument();
    expect(screen.queryByText('dbr77-robotyzacja-linia-spawalnicza')).not.toBeInTheDocument();
  });

  // 1.1-A5 (DEC-428): pakiet audytowy wymaga `approve-expert` + `publish`
  // zanim `createProgramFromPack` przepuści go do audytu (409
  // `AUDIT_INVALID_STATE` — `programService.ts:388`); Biblioteka nie miała
  // dotąd ŻADNEGO przycisku do tych dwóch tras (`packs.routes.ts:192/210`).
  describe('1.1-A5 — Zatwierdź (ekspert) / Publikuj w kebabie', () => {
    it('kebab pakietu w statusie szkicu pokazuje OBIE pozycje, włączone, gdy actor może zarządzać biblioteką', () => {
      renderTab({ packs: [makePack({ id: 'draft-1', publicationStatus: 'draft', expertApprovedBy: null })] });
      openRowKebab();
      const approve = menuItemByLabel('Approve (expert)');
      const publish = menuItemByLabel('Publish');
      expect(approve).not.toBeDisabled();
      // Publish requires expert approval FIRST — even for an admin, a
      // not-yet-approved draft must stay disabled with a genuine reason.
      expect(publish).toBeDisabled();
    });

    it('klik „Zatwierdź (ekspert)" woła onApprovePackExpert z tym pakietem', () => {
      const pack = makePack({ id: 'draft-2', publicationStatus: 'draft', expertApprovedBy: null });
      const { onApprovePackExpert } = renderTab({ packs: [pack] });
      openRowKebab();
      fireEvent.click(menuItemByLabel('Approve (expert)'));
      expect(onApprovePackExpert).toHaveBeenCalledWith(pack);
    });

    it('po zatwierdzeniu eksperckim „Publikuj" jest włączony i woła onPublishPack', () => {
      const pack = makePack({ id: 'draft-3', publicationStatus: 'draft', expertApprovedBy: 'expert-1' });
      const { onPublishPack } = renderTab({ packs: [pack] });
      openRowKebab();
      const approve = menuItemByLabel('Approve (expert)');
      const publish = menuItemByLabel('Publish');
      // Już zatwierdzony — "Zatwierdź" nie dubluje kliku.
      expect(approve).toBeDisabled();
      expect(publish).not.toBeDisabled();
      fireEvent.click(publish);
      expect(onPublishPack).toHaveBeenCalledWith(pack);
    });

    it('bez uprawnień administratora organizacji OBIE pozycje są widoczne, ale wyłączone z uczciwym powodem — nigdy ukryte', () => {
      renderTab({
        packs: [makePack({ id: 'draft-4', publicationStatus: 'draft', expertApprovedBy: 'expert-1' })],
        canManagePackLibrary: false,
      });
      openRowKebab();
      const approve = menuItemByLabel('Approve (expert)');
      const publish = menuItemByLabel('Publish');
      expect(approve).toBeDisabled();
      expect(publish).toBeDisabled();
      // Both items carry the SAME honest reason (one per menu item).
      expect(screen.getAllByText(/organization admin permissions/i).length).toBe(2);
    });

    it('dla pakietu już opublikowanego obie pozycje kebaba są wyłączone', () => {
      renderTab({
        packs: [makePack({ id: 'published-1', publicationStatus: 'published', expertApprovedBy: 'expert-1' })],
      });
      openRowKebab();
      expect(menuItemByLabel('Approve (expert)')).toBeDisabled();
      expect(menuItemByLabel('Publish')).toBeDisabled();
    });

    it('evaluateApproveExpertGate: odmawia bez uprawnień, potem bez statusu przedpublikacyjnego, potem gdy już zatwierdzony, przepuszcza w przeciwnym razie', () => {
      const draft = makePack({ publicationStatus: 'draft', expertApprovedBy: null });
      expect(evaluateApproveExpertGate(draft, false, false).allowed).toBe(false);
      expect(evaluateApproveExpertGate({ ...draft, publicationStatus: 'published' }, false, true).allowed).toBe(
        false
      );
      expect(evaluateApproveExpertGate({ ...draft, expertApprovedBy: 'x' }, false, true).allowed).toBe(false);
      expect(evaluateApproveExpertGate(draft, false, true).allowed).toBe(true);
    });

    it('evaluatePublishPackGate: odmawia bez uprawnień, gdy już opublikowany/wycofany, i gdy brak zatwierdzenia eksperckiego', () => {
      const approvedDraft = makePack({ publicationStatus: 'draft', expertApprovedBy: 'expert-1' });
      expect(evaluatePublishPackGate(approvedDraft, false, false).allowed).toBe(false);
      expect(evaluatePublishPackGate({ ...approvedDraft, publicationStatus: 'published' }, false, true).allowed).toBe(
        false
      );
      expect(evaluatePublishPackGate({ ...approvedDraft, publicationStatus: 'deprecated' }, false, true).allowed).toBe(
        false
      );
      expect(evaluatePublishPackGate({ ...approvedDraft, expertApprovedBy: null }, false, true).allowed).toBe(false);
      expect(evaluatePublishPackGate(approvedDraft, false, true).allowed).toBe(true);
    });
  });
});
