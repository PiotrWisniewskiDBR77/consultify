/**
 * AuditConclusionsTab — zakładka „Wnioski" Audytów (DEC-417e, 1.1-A4).
 *
 * Test pilnuje trzech rzeczy, które łatwo zepsuć po cichu:
 *  1. FILTR ŹRÓDŁA — warstwa Wniosków jest org-wide; bez filtra zakładka
 *     Audytów pokazałaby wnioski z wywiadu, ocen i narzędzi jako swoje.
 *  2. SYNCHRONIZACJA RAZ NA WEJŚCIE — `POST /conclusions/sync` to ZAPIS
 *     (1.1-Z3: odczyt nie może pisać), więc leci dokładnie jeden raz, a jego
 *     odmowa (403) nie może ukryć wniosków, które już są w bazie.
 *  3. PODGLĄD NA KLIK — kanon TRIADA/DEC-397b (`JedenPrawyPanel`).
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sync = vi.fn();
const list = vi.fn();

vi.mock('@/services/api/conclusions.api', () => ({
  ConclusionsApi: {
    sync: (...args: unknown[]) => sync(...args),
    list: (...args: unknown[]) => list(...args),
    get: vi.fn(),
    listConversions: vi.fn(),
  },
}));

import { AuditConclusionsTab } from '../tabs/AuditConclusionsTab';

const WNIOSEK_AUDYTU = {
  id: 'concl-audit-1',
  organizationId: 'org-1',
  title: 'Wniosek z audytu Q3',
  statement: 'System spełnia wymagania z zastrzeżeniami.',
  sourceModule: 'audit',
  sourceArtifactRefs: [{ type: 'audit_report', id: 'arep-1', title: 'Raport poaudytowy — Q3' }],
  confidenceLevel: 'medium',
  limits: 'Próbka ograniczona do Q3.',
  evidenceRefs: [],
  recommendedNextAction: 'Wprowadzić ocenę dostawców',
  status: 'candidate',
  createdBy: 'user-1',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-02T10:00:00.000Z',
};

const WNIOSEK_OCENY = {
  ...WNIOSEK_AUDYTU,
  id: 'concl-assessment-1',
  title: 'Wniosek z oceny DRD',
  sourceModule: 'assessment_drd',
  sourceArtifactRefs: [{ type: 'assessment_report', id: 'rep-9', title: 'Raport DRD' }],
};

const WNIOSEK_BEZ_RODOWODU = {
  ...WNIOSEK_AUDYTU,
  id: 'concl-audit-brak-rodowodu',
  title: 'Wniosek bez rodowodu',
  sourceArtifactRefs: [],
};

function renderTab(props: Partial<React.ComponentProps<typeof AuditConclusionsTab>> = {}) {
  return render(
    <MemoryRouter initialEntries={['/audit-programs?tab=conclusions']}>
      <AuditConclusionsTab isPolish {...props} />
    </MemoryRouter>
  );
}

describe('AuditConclusionsTab', () => {
  beforeEach(() => {
    sync.mockReset().mockResolvedValue({ synced: { audit: 1 } });
    list
      .mockReset()
      .mockResolvedValue({
        conclusions: [WNIOSEK_AUDYTU, WNIOSEK_OCENY, WNIOSEK_BEZ_RODOWODU],
      });
  });

  it('pokazuje TYLKO wnioski z audytu — nie cudze wnioski z warstwy org-wide', async () => {
    renderTab();
    expect(await screen.findByText('Wniosek z audytu Q3')).toBeInTheDocument();
    // MUTACJA, którą ten test ma złapać: usunięcie filtra źródła w `load()`.
    expect(screen.queryByText('Wniosek z oceny DRD')).toBeNull();
    // Rodowód jest częścią reguły: wniosek `audit` bez referencji do raportu
    // audytu nie jest wnioskiem tego modułu.
    expect(screen.queryByText('Wniosek bez rodowodu')).toBeNull();
  });

  it('nazywa źródło i stan po ludzku, nie kodem technicznym', async () => {
    renderTab();
    expect(await screen.findByText('Raport audytu')).toBeInTheDocument();
    expect(screen.getByText('Kandydat')).toBeInTheDocument();
    expect(screen.queryByText('candidate')).toBeNull();
  });

  it('synchronizuje warstwę Wniosków DOKŁADNIE raz na wejście', async () => {
    const { rerender } = renderTab();
    await screen.findByText('Wniosek z audytu Q3');
    expect(sync).toHaveBeenCalledTimes(1);

    rerender(
      <MemoryRouter initialEntries={['/audit-programs?tab=conclusions']}>
        <AuditConclusionsTab isPolish reloadToken={1} />
      </MemoryRouter>
    );
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    // Przeładowanie listy po wygenerowaniu wniosku NIE synchronizuje ponownie.
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it('odmowa synchronizacji (403) nie ukrywa wniosków, które już są w bazie', async () => {
    sync.mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }));
    renderTab();
    expect(await screen.findByText('Wniosek z audytu Q3')).toBeInTheDocument();
  });

  it('otwiera podgląd na klik wiersza (kanon TRIADA / DEC-397b)', async () => {
    renderTab();
    const wiersz = await screen.findByText('Wniosek z audytu Q3');
    await userEvent.click(wiersz);
    await waitFor(() =>
      expect(screen.getByText('System spełnia wymagania z zastrzeżeniami.')).toBeInTheDocument()
    );
  });

  it('mówi prawdę w stanie pustym — skąd bierze się wniosek audytu', async () => {
    list.mockResolvedValue({ conclusions: [] });
    renderTab();
    expect(await screen.findByText('Brak wniosków')).toBeInTheDocument();
    expect(screen.getByText(/powstaje z raportu audytu/i)).toBeInTheDocument();
  });

  it('raportuje rozkład stanów dla chipów Menu 3 z TEJ SAMEJ listy', async () => {
    const onCountsChange = vi.fn();
    renderTab({ onCountsChange });
    await screen.findByText('Wniosek z audytu Q3');
    await waitFor(() => {
      const ostatni = onCountsChange.mock.calls.at(-1)![0];
      expect(ostatni.all).toBe(1);
      expect(ostatni.candidate).toBe(1);
    });
  });
});
