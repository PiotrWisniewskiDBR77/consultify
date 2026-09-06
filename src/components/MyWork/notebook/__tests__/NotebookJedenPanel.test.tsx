/**
 * JEDEN PRAWY PANEL — Notatnik (decyzja CTO 2026-09-05).
 *
 * Zgłoszenie właściciela (05.09): „napraw temat menu bocznego, panelu
 * bocznego, zarówno w IDE, jak i w notatce". Na Notatniku stały obok siebie
 * DWA panele: własny pas notatki ORAZ globalny dok Teresy z `MainLayout`.
 *
 * ★ DEC-404 (właściciel, 06.09.2026) — oś 2 ODWRÓCONA. „Teresa jako zakładka
 * tego panelu" to dokładnie kształt, który właściciel odrzucił („tu nie jest
 * jej miejsce"). Notatnik NIE osadza już Teresy: `NotebookContent` nie podaje
 * railowi `teresaContent`, nie melduje się w rejestrze i chowa rail na czas
 * otwartego doku (`railWidoczny = notebookRailOpen && isChatCollapsed`).
 *
 * Ten test pilnuje kształtu PO naprawie, na trzech osiach mierzalnych bez
 * przeglądarki:
 *   1. panel ma DOKŁADNIE JEDEN korzeń `aside` (albo zero, gdy zamknięty),
 *   2. rail bez `teresaContent` nie buduje rzędu zakładek ani czatu,
 *   3. `MainLayout` NIE gasi doku rejestrem — dok wchodzi także tutaj, a rail
 *      ustępuje mu miejsca.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  isEmbeddedModuleChatHosted,
  registerEmbeddedModuleChatHost,
  resetEmbeddedModuleChatHost,
} from '@/components/shared/embeddedModuleChatHost';

import { NotebookRightRail } from '../NotebookRightRail';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
    i18n: { language: 'pl' },
  }),
}));

vi.mock('../NotebookContextPanel', () => ({
  NotebookContextPanel: () => <div>Context content</div>,
}));

const activePage = {
  id: 'page-1',
  title: 'Notatka o rynku DACH',
  content: '',
  tags: [],
  convertedTo: [],
  status: 'active',
  maturity: 'growing',
  visibility: 'private',
  ownerUserId: 'owner-1',
  verificationStatus: 'verified',
  reviewCadence: 'monthly',
  captureSource: 'manual',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-05T00:00:00.000Z',
} as never;

const wspolneProps = {
  open: true as const,
  activeTab: 'work' as const,
  onTabChange: vi.fn(),
  activePage,
  allPages: [activePage],
  editor: null,
  noteTitle: 'Notatka o rynku DACH',
  noteContent: '',
  noteTags: [],
  notePage: {
    id: 'page-1',
    maturity: 'growing' as const,
    wordCount: 12,
    visibility: 'private' as const,
  },
};

describe('Notatnik — jeden prawy panel (decyzja CTO 05.09)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetEmbeddedModuleChatHost();
  });

  it('renderuje DOKŁADNIE JEDEN korzeń panelu, także z osadzoną Teresą', () => {
    const { container } = render(
      <NotebookRightRail
        {...wspolneProps}
        onClose={vi.fn()}
        teresaContent={<div>rozmowa</div>}
        panelTab="note"
        onPanelTabChange={vi.fn()}
      />
    );
    expect(container.querySelectorAll('aside')).toHaveLength(1);
  });

  /*
   * ★ DEC-404 — PRZEPISANE. Poprzednia wersja żądała rzędu zakładek
   * „Notatka | Teresa" (`notebook-panel-tab-*`). Te testidy nie istnieją
   * w `NotebookRightRail.tsx` odkąd rail chodzi ścieżką
   * `isArtifactRightRailEnabled` — przypadek był CZERWONY już na bazie
   * `6bf5fa2bb2`, przed tą zmianą. DEC-404 i tak kasuje zakładkę Teresy, więc
   * zamiast wskrzeszać martwy kształt mierzymy kształt obowiązujący.
   */
  it('DEC-404: rail gospodarza nie ma zakładki Teresy i ma JEDEN przycisk zamknięcia', () => {
    render(<NotebookRightRail {...wspolneProps} onClose={vi.fn()} />);
    expect(screen.queryByTestId('notebook-panel-tab-teresa')).toBeNull();
    expect(screen.getAllByTestId('notebook-panel-close')).toHaveLength(1);
  });

  /*
   * ★ DEC-404 — PRZEPISANE (poprzednia wersja mierzyła zakładkę „Teresa"
   * w railu; taki rail nie powstaje już u gospodarza).
   */
  it('DEC-404: gospodarz nie podaje railowi Teresy — rail ma jeden korzeń i zero czatu', () => {
    const { container } = render(<NotebookRightRail {...wspolneProps} onClose={vi.fn()} />);
    expect(container.querySelectorAll('aside')).toHaveLength(1);
    expect(screen.queryByText('rozmowa')).toBeNull();

    const content = fs.readFileSync(path.resolve(__dirname, '../../NotebookContent.tsx'), 'utf8');
    // MUTACJA: przywróć `teresaContent={notebookTeresaNode}` → RED.
    expect(content).not.toMatch(/teresaContent=\{/);
    expect(content).not.toMatch(/from '@\/components\/AIChat\/UnifiedChatPanel'/);
    expect(content).not.toMatch(/import\('@\/components\/AIChat\/UnifiedChatPanel'\)/);
  });

  it('nagłówek panelu niesie NAZWĘ OBIEKTU i jego stan (kanon: nazwa + status + X)', () => {
    render(
      <NotebookRightRail
        {...wspolneProps}
        onClose={vi.fn()}
        teresaContent={<div>rozmowa</div>}
        panelTab="note"
        onPanelTabChange={vi.fn()}
      />
    );
    expect(screen.getByRole('heading', { name: 'Notatka o rynku DACH' })).toBeInTheDocument();
    expect(screen.getByTestId('notebook-panel-status')).toHaveTextContent('Rośnie');
  });

  it('zamknięty panel nie zostawia żadnego korzenia (aside = 0)', () => {
    const { container } = render(
      <NotebookRightRail
        {...wspolneProps}
        open={false}
        onClose={vi.fn()}
        teresaContent={<div>rozmowa</div>}
      />
    );
    expect(container.querySelectorAll('aside')).toHaveLength(0);
  });

  it('bez `teresaContent` panel zachowuje dotychczasową główkę (zero regresji u wołaczy)', () => {
    render(<NotebookRightRail {...wspolneProps} onClose={vi.fn()} />);
    expect(screen.queryByTestId('notebook-panel-tab-teresa')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Szczegóły notatki' })).toBeInTheDocument();
  });

  it('„Wstaw blok" i TAGI mieszkają w panelu — z handlerami gospodarza', () => {
    const onInsertBlock = vi.fn();
    render(
      <NotebookRightRail
        {...wspolneProps}
        onClose={vi.fn()}
        onInsertBlock={onInsertBlock}
        tags={['strategy', 'q2']}
        tagInput=""
        onTagInputChange={vi.fn()}
        onAddTag={vi.fn()}
        onRemoveTag={vi.fn()}
        onTagKeyDown={vi.fn()}
      />
    );
    // DEC-397 (06.09): Akcje/Właściwości now start collapsed — expand both
    // ("Wstaw blok" lives in Akcje, tags live in Właściwości). `fireEvent`
    // wraps the click in `act(...)`, unlike a bare native `.click()`, so the
    // resulting re-render (aria-expanded flip) is committed before the next
    // assertion reads the DOM.
    fireEvent.click(screen.getByRole('button', { name: /^Akcje/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Właściwości/ }));
    fireEvent.click(screen.getByText('Wstaw blok'));
    expect(onInsertBlock).toHaveBeenCalledOnce();
    const tagi = screen.getByTestId('notebook-rail-tags');
    expect(tagi).toHaveTextContent('strategy');
    expect(tagi).toHaveTextContent('q2');
  });
});

describe('embeddedModuleChatHost — globalny dok Teresy ustępuje osadzonemu', () => {
  beforeEach(() => resetEmbeddedModuleChatHost());

  it('liczy gospodarzy, więc przeplot mount/unmount przy zmianie trasy nie gubi stanu', () => {
    expect(isEmbeddedModuleChatHosted()).toBe(false);
    const zwolnijA = registerEmbeddedModuleChatHost();
    const zwolnijB = registerEmbeddedModuleChatHost(); // nowy gospodarz montuje się przed odejściem starego
    zwolnijA();
    expect(isEmbeddedModuleChatHosted()).toBe(true);
    zwolnijB();
    expect(isEmbeddedModuleChatHosted()).toBe(false);
  });

  it('podwójne zwolnienie tego samego meldunku nie zeruje licznika innego gospodarza', () => {
    const zwolnij = registerEmbeddedModuleChatHost();
    registerEmbeddedModuleChatHost();
    zwolnij();
    zwolnij();
    expect(isEmbeddedModuleChatHosted()).toBe(true);
  });

  it('DEC-404: rejestr NIE gasi doku, a Notatnik nie melduje się jako gospodarz Teresy', () => {
    const layout = fs.readFileSync(
      path.resolve(__dirname, '../../../../layouts/MainLayout.tsx'),
      'utf8'
    );
    // MUTACJA: dopisz `|| embeddedModuleChatHosted` → RED (wraca odrzucony
    // kształt „Teresa w kolumnie podglądu / w railu").
    const linia = layout
      .split('\n')
      .find((wiersz) => wiersz.includes('const hasEmbeddedModuleChat ='));
    expect(linia).toBeDefined();
    expect(linia).not.toContain('embeddedModuleChatHosted');

    // Notatnik NIE jest wpisany po ścieżce — inaczej dok znikałby także na
    // liście notatników, gdzie nikt Teresy nie osadza („zamknięte przez
    // wygaszenie").
    const bramkaPoSciezce = layout.slice(
      layout.indexOf('const hasEmbeddedModuleChatByPath'),
      layout.indexOf('const hasEmbeddedModuleChat =')
    );
    expect(bramkaPoSciezce).not.toContain('/my-work/notebook');

    const content = fs.readFileSync(path.resolve(__dirname, '../../NotebookContent.tsx'), 'utf8');
    // MUTACJA: przywróć meldunek → RED.
    expect(content).not.toContain('registerEmbeddedModuleChatHost');
    // Rail ustępuje dokowi: `notebookRailOpen` zostaje nietknięty, więc po
    // zamknięciu doku rail wraca w stanie sprzed.
    expect(content).toContain('const railWidoczny = notebookRailOpen && isChatCollapsed;');
  });
});
