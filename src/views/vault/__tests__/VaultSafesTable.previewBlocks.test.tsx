/**
 * Podgląd sejfu — bloki kanonu [ODMROZENIE 07_MY_WORK_AGENT DEC-397]
 *
 * Zgłoszenie właściciela (POWTÓRZONE, 06.09): podgląd „Mojego sejfu" był
 * atrapą — chipy i surowa nazwa pliku z magazynu. Ten test pilnuje, że po
 * kliknięciu wiersza podgląd renderuje bloki kanonu
 * (`.claude/skills/consultify-preview/SKILL.md`): META · TREŚĆ · AKCJE ·
 * „Co dalej", oraz że nazwa dokumentu jest CZYTELNA, nie surowa.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: unknown) =>
      typeof fallback === 'string' ? fallback : String(_key),
    i18n: { language: 'pl' },
  }),
}));

const apiMocks = vi.hoisted(() => ({
  getVaultSafes: vi.fn(),
  getKnowledgeDocuments: vi.fn(),
}));
vi.mock('../../../services/api', () => ({ Api: apiMocks }));
vi.mock('@/services/api', () => ({ Api: apiMocks }));

// StandardTable zastąpiony atrapą, która daje jeden klikalny wiersz — test
// sprawdza PODGLĄD, nie tabelę (ta ma własne testy kanonu).
vi.mock('@/components/standard', () => ({
  StandardTable: ({
    data,
    onRowClick,
  }: {
    data: Array<{ id: string }>;
    onRowClick?: (row: { id: string }) => void;
  }) => (
    <div>
      {data.map((row) => (
        <button key={row.id} type="button" onClick={() => onRowClick?.(row)}>
          wiersz-{row.id}
        </button>
      ))}
    </div>
  ),
}));

import { VaultSafesTable } from '../VaultSafesTable';

const SEJF = {
  id: 'user',
  type: 'user' as const,
  isSystem: true,
  projectId: null,
  name: 'My safe',
  documentCount: 1,
  lastModified: '2026-08-07T10:00:00.000Z',
  sizeBytes: 15 * 1024 * 1024,
  indexedCount: 1,
  errorCount: 0,
};

const DOKUMENT = {
  id: 'doc-1',
  filename: '1786125362405-Tesco_2026_Annual_Report_and_Financial_Statements_EN.pdf',
  category: 'Other',
  tags: [],
  status: 'indexed',
  created_at: '2026-08-07T10:00:00.000Z',
  chunk_count: 12,
  file_size_bytes: 15 * 1024 * 1024,
  scope: 'user',
  project_id: null,
  owner_id: null,
  folder_id: null,
};

const otworzPodglad = async (nadpisz?: Partial<typeof SEJF>) => {
  apiMocks.getVaultSafes.mockResolvedValue([{ ...SEJF, ...nadpisz }]);
  apiMocks.getKnowledgeDocuments.mockResolvedValue([DOKUMENT]);
  const onOpenSafe = vi.fn();
  render(
    <MemoryRouter>
      <VaultSafesTable onOpenSafe={onOpenSafe} />
    </MemoryRouter>
  );
  const wiersz = await screen.findByText('wiersz-user');
  await userEvent.click(wiersz);
  return onOpenSafe;
};

describe('VaultSafesTable — podgląd sejfu (kanon podglądu)', () => {
  it('renderuje bloki kanonu: meta + treść + akcje', async () => {
    await otworzPodglad();

    await waitFor(() => expect(document.querySelector('[data-preview-block="meta"]')).toBeTruthy());
    expect(document.querySelector('[data-preview-block="details"]')).toBeTruthy();
    // Blok 2 — cztery pomiary stanu sejfu, w tym błędy indeksowania.
    // `PreviewMetaCard` skleja pigułkę jako „Etykieta: wartość".
    const meta = document.querySelector('[data-preview-block="meta"]') as HTMLElement;
    expect(meta.textContent).toContain('Dokumenty: 1');
    expect(meta.textContent).toContain('Rozmiar: 15 MB');
    expect(meta.textContent).toContain('W wiedzy AI: 1/1');
    expect(meta.textContent).toContain('Błędy indeksowania: 0');
    // Blok 1 (dopełnienie) — plakietka zakresu i data ostatniej zmiany.
    expect(screen.getByText('Mój')).toBeTruthy();
    expect(screen.getByText(/Ostatnia zmiana/)).toBeTruthy();
    // Blok 6 — akcja-pill.
    expect(screen.getByRole('button', { name: /Dodaj dokument/ })).toBeTruthy();
  });

  it('pokazuje CZYTELNĄ nazwę dokumentu, nie surową z magazynu', async () => {
    await otworzPodglad();

    const nazwa = await screen.findByText('Tesco 2026 Annual Report and Financial Statements EN');
    expect(nazwa).toBeTruthy();
    expect(screen.queryByText(/1786125362405/)).toBeNull();
  });

  it('klik w dokument prowadzi do jego podglądu w sejfie', async () => {
    const onOpenSafe = await otworzPodglad();

    const nazwa = await screen.findByText('Tesco 2026 Annual Report and Financial Statements EN');
    await userEvent.click(nazwa);
    expect(onOpenSafe).toHaveBeenCalledWith(expect.objectContaining({ id: 'user' }), {
      dokumentId: 'doc-1',
    });
  });

  it('„Co dalej" pojawia się dopiero, gdy sejf czegoś potrzebuje', async () => {
    await otworzPodglad();
    await waitFor(() => expect(document.querySelector('[data-preview-block="meta"]')).toBeTruthy());
    // Sejf zdrowy i niepusty — brak bloku „Co dalej" (kanon: blok bez danych ukryty).
    expect(document.querySelector('[data-preview-block="whatsnext"]')).toBeNull();
  });

  it('pusty sejf dostaje „Co dalej" z dodaniem pierwszego dokumentu', async () => {
    apiMocks.getKnowledgeDocuments.mockResolvedValue([]);
    await otworzPodglad({ documentCount: 0, indexedCount: 0, sizeBytes: 0 });

    await waitFor(() =>
      expect(document.querySelector('[data-preview-block="whatsnext"]')).toBeTruthy()
    );
    expect(screen.getByRole('button', { name: /Dodaj pierwszy dokument/ })).toBeTruthy();
  });

  it('sejf z błędami indeksowania dostaje „Co dalej" z wejściem w błędy', async () => {
    await otworzPodglad({ errorCount: 2 });

    await waitFor(() =>
      expect(document.querySelector('[data-preview-block="whatsnext"]')).toBeTruthy()
    );
    expect(screen.getByRole('button', { name: /Pokaż błędy indeksowania/ })).toBeTruthy();
  });
});
