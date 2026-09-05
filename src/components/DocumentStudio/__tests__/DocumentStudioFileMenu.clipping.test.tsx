/**
 * ODBIÓR NA ŻYWO 05.09 (pakiet 10 · Materiały, różnica #8) — menu „Plik" w
 * Document Studio było w DOM z kompletem pozycji, ale NIEWIDOCZNE i
 * NIEKLIKALNE: panel renderował się `position: absolute` wewnątrz przodka z
 * `overflow: auto` (pasek `mels-topbar-chips`), który go przycinał. Blokowało
 * to również ekran `document-studio-save-as-template` („Zrób z tego wzorzec"
 * leży w tym menu).
 *
 * Ten test broni ZABEZPIECZENIA, nie mechanizmu: renderuje wyzwalacz w
 * przodku z `overflow: auto` (dokładnie ta sama pułapka co w `TopBar`) i
 * sprawdza, że po otwarciu panel NIE jest potomkiem tego przodka (czyli nie
 * podlega jego przycinaniu) oraz że każda pozycja daje się kliknąć i wywołuje
 * swoją akcję.
 *
 * DOWÓD MUTACYJNY (wykonany): przywrócenie panelu do `absolute` wewnątrz
 * `<div className="relative">` (stan sprzed naprawy) wywala `nie leży wewnątrz
 * przodka przycinającego` — test czerwienieje.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { DocumentStudioFileMenu } from '../DocumentStudioFileMenu';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, d?: unknown) => (typeof d === 'string' ? d : _k) }),
}));

function renderInClippingBar(props: Partial<React.ComponentProps<typeof DocumentStudioFileMenu>>) {
  const onNew = vi.fn();
  const onOpen = vi.fn();
  const onSaveAs = vi.fn();
  const onSaveAsTemplate = vi.fn();
  const utils = render(
    <div data-testid="clipping-bar" style={{ overflowX: 'auto', overflowY: 'auto', width: 320 }}>
      <DocumentStudioFileMenu
        onNew={onNew}
        onOpen={onOpen}
        saveStatus="saved"
        onSaveAs={onSaveAs}
        onSaveAsTemplate={onSaveAsTemplate}
        {...props}
      />
    </div>
  );
  return { ...utils, onNew, onOpen, onSaveAs, onSaveAsTemplate };
}

describe('DocumentStudioFileMenu — panel poza przodkiem przycinającym', () => {
  it('nie leży wewnątrz przodka przycinającego (overflow: auto)', () => {
    renderInClippingBar({});
    fireEvent.click(screen.getByTestId('document-file-menu-trigger'));

    const panel = screen.getByTestId('document-file-menu');
    const bar = screen.getByTestId('clipping-bar');
    expect(bar.contains(panel)).toBe(false);
    // Portal celuje w `document.body`, więc panel jest poza całym poddrzewem paska.
    expect(panel.closest('[data-testid="clipping-bar"]')).toBeNull();
  });

  it('każda pozycja menu jest klikalna i wywołuje swoją akcję', () => {
    const { onNew, onOpen, onSaveAs, onSaveAsTemplate } = renderInClippingBar({});

    const openMenu = () => fireEvent.click(screen.getByTestId('document-file-menu-trigger'));

    openMenu();
    fireEvent.click(screen.getByTestId('document-file-menu-new'));
    expect(onNew).toHaveBeenCalledTimes(1);

    openMenu();
    fireEvent.click(screen.getByTestId('document-file-menu-open'));
    expect(onOpen).toHaveBeenCalledTimes(1);

    openMenu();
    fireEvent.click(screen.getByTestId('document-file-menu-save-as'));
    expect(onSaveAs).toHaveBeenCalledTimes(1);

    openMenu();
    fireEvent.click(screen.getByTestId('document-file-menu-save-as-template'));
    expect(onSaveAsTemplate).toHaveBeenCalledTimes(1);
  });

  it('„Zrób z tego wzorzec" jest osiągalne (ekran document-studio-save-as-template)', () => {
    renderInClippingBar({});
    fireEvent.click(screen.getByTestId('document-file-menu-trigger'));
    const panel = screen.getByTestId('document-file-menu');
    expect(
      within(panel).getByTestId('document-file-menu-save-as-template').textContent
    ).toContain('Zrób z tego wzorzec');
  });

  it('klik w pozycję panelu nie jest traktowany jako klik „na zewnątrz" (panel w portalu)', () => {
    const { onOpen } = renderInClippingBar({});
    fireEvent.click(screen.getByTestId('document-file-menu-trigger'));
    // mousedown na pozycji menu — gdyby handler „outside" nie znał portalu,
    // zamknąłby menu ZANIM doszłoby do kliknięcia.
    const item = screen.getByTestId('document-file-menu-open');
    fireEvent.mouseDown(item);
    expect(screen.queryByTestId('document-file-menu')).not.toBeNull();
    fireEvent.click(item);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
