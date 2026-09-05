/**
 * JEDEN PRAWY PANEL — Notatnik (decyzja CTO 2026-09-05).
 *
 * Zgłoszenie właściciela (05.09): „napraw temat menu bocznego, panelu
 * bocznego, zarówno w IDE, jak i w notatce". Na Notatniku stały obok siebie
 * DWA panele: własny pas notatki ORAZ globalny dok Teresy z `MainLayout`.
 *
 * Ten test pilnuje kształtu PO naprawie, na trzech osiach, które da się
 * zmierzyć bez przeglądarki:
 *   1. panel ma DOKŁADNIE JEDEN korzeń `aside` (albo zero, gdy zamknięty),
 *   2. Teresa jest ZAKŁADKĄ tego panelu, nie drugą kolumną,
 *   3. gospodarz melduje się w rejestrze `embeddedModuleChatHost`, więc
 *      globalny dok na tym ekranie nie wchodzi — a na LIŚCIE notatników
 *      (brak otwartej notatki) wchodzi jak dotąd.
 *
 * Zrzuty z żywego renderu: `proof-notatnik-*.png` (aside = 1 / 1 / 0).
 */
import { render, screen } from '@testing-library/react';
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

  it('daje w główce zakładki „Notatka" | „Teresa" i JEDEN przycisk zamknięcia', () => {
    render(
      <NotebookRightRail
        {...wspolneProps}
        onClose={vi.fn()}
        teresaContent={<div>rozmowa</div>}
        panelTab="note"
        onPanelTabChange={vi.fn()}
      />
    );
    expect(screen.getByTestId('notebook-panel-tab-note')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('notebook-panel-tab-teresa')).toHaveAttribute(
      'aria-selected',
      'false'
    );
    expect(screen.getAllByTestId('notebook-panel-close')).toHaveLength(1);
  });

  it('w zakładce „Teresa" pokazuje rozmowę ZAMIAST sekcji — nie obok nich', () => {
    const { container } = render(
      <NotebookRightRail
        {...wspolneProps}
        onClose={vi.fn()}
        teresaContent={<div>rozmowa</div>}
        panelTab="teresa"
        onPanelTabChange={vi.fn()}
      />
    );
    expect(container.querySelectorAll('aside')).toHaveLength(1);
    expect(screen.getByText('rozmowa')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Akcje/ })).toBeNull();
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
    screen.getByText('Wstaw blok').click();
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

  it('MainLayout łączy rejestr ze ścieżką — lista notatników zachowuje globalny dok', () => {
    const layout = fs.readFileSync(
      path.resolve(__dirname, '../../../../layouts/MainLayout.tsx'),
      'utf8'
    );
    expect(layout).toContain('useEmbeddedModuleChatHost');
    expect(layout).toContain(
      'const hasEmbeddedModuleChat = hasEmbeddedModuleChatByPath || embeddedModuleChatHosted;'
    );
    // Notatnik NIE jest wpisany po ścieżce — inaczej dok znikałby także na
    // liście notatników, gdzie nikt Teresy nie osadza („zamknięte przez
    // wygaszenie").
    const bramkaPoSciezce = layout.slice(
      layout.indexOf('const hasEmbeddedModuleChatByPath'),
      layout.indexOf('const hasEmbeddedModuleChat =')
    );
    expect(bramkaPoSciezce).not.toContain('/my-work/notebook');

    const content = fs.readFileSync(path.resolve(__dirname, '../../NotebookContent.tsx'), 'utf8');
    expect(content).toContain('const notebookHostsTeresa = Boolean(activePage) && !isMobile;');
    expect(content).toContain('return registerEmbeddedModuleChatHost();');
    // Teresa w panelu to TEN SAM komponent, co dok globalny (moduł 13_CHAT
    // jest zamrożony — importujemy, nie kopiujemy).
    expect(content).toContain("import('@/components/AIChat/UnifiedChatPanel')");
    expect(content).toContain('mode="split"');
  });
});
