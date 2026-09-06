import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const appStore = vi.hoisted(() => ({
  isChatCollapsed: true,
  toggleChatCollapse: vi.fn(() => {
    appStore.isChatCollapsed = !appStore.isChatCollapsed;
  }),
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (state: typeof appStore) => unknown) => selector(appStore),
}));

import { resetJedenPanelForTests, useJedenPanel } from '../useJedenPanel';

const wrapperAt = (path: string) =>
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>;
  };

describe('useJedenPanel', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetJedenPanelForTests();
    appStore.isChatCollapsed = true;
    appStore.toggleChatCollapse.mockClear();
  });

  afterEach(() => resetJedenPanelForTests());

  it('pamięta świadome zamknięcie osobno dla każdego modułu', () => {
    const myWork = renderHook(() => useJedenPanel(), { wrapper: wrapperAt('/my-work') });

    act(() => myWork.result.current.zamknij());

    expect(myWork.result.current.zamkniety).toBe(true);
    expect(localStorage.getItem('consultify.listPanel.my-work.closed')).toBe('1');
    expect(localStorage.getItem('consultify.listPanel.assessment.closed')).toBeNull();

    const assessment = renderHook(() => useJedenPanel(), {
      wrapper: wrapperAt('/assessment'),
    });
    expect(assessment.result.current.zamkniety).toBe(false);
  });

  /*
   * ★ DEC-404: zakładka „Teresa" tego panelu NIE ISTNIEJE. Otwarty dok znaczy
   * teraz „schowaj kolumnę podglądu", a nie „przełącz ją na czat".
   */
  it('otwarty dok chowa podgląd, a jego zamknięcie oddaje podgląd w stanie sprzed', () => {
    appStore.isChatCollapsed = true;
    const panel = renderHook(() => useJedenPanel(), { wrapper: wrapperAt('/interview') });

    expect(panel.result.current.dokOtwarty).toBe(false);
    expect(panel.result.current.zamkniety).toBe(false);

    appStore.isChatCollapsed = false;
    panel.rerender();
    expect(panel.result.current.dokOtwarty).toBe(true);
    // Klucz kontraktu: dok NIE dotyka `zamkniety` — gospodarz chowa panel sam,
    // więc po zamknięciu doku wraca dokładnie ten sam stan.
    expect(panel.result.current.zamkniety).toBe(false);

    appStore.isChatCollapsed = true;
    panel.rerender();
    expect(panel.result.current.dokOtwarty).toBe(false);
    expect(panel.result.current.zamkniety).toBe(false);
  });

  it('świadome zamknięcie podglądu przeżywa otwarcie i zamknięcie doku', () => {
    const panel = renderHook(() => useJedenPanel(), { wrapper: wrapperAt('/interview') });
    act(() => panel.result.current.zamknij());
    expect(panel.result.current.zamkniety).toBe(true);

    appStore.isChatCollapsed = false;
    panel.rerender();
    appStore.isChatCollapsed = true;
    panel.rerender();

    expect(panel.result.current.zamkniety).toBe(true);
  });

  it('współdzieli stan między panelem i Menu 3, a „Pokaż panel" zwija dok', () => {
    const panel = renderHook(() => useJedenPanel(), { wrapper: wrapperAt('/finance/reports') });
    const menu = renderHook(() => useJedenPanel(), { wrapper: wrapperAt('/finance/reports') });

    act(() => panel.result.current.zamknij());
    expect(menu.result.current.zamkniety).toBe(true);

    appStore.isChatCollapsed = false;
    menu.rerender();
    act(() => menu.result.current.pokazPanel());

    expect(panel.result.current.zamkniety).toBe(false);
    // Dok i podgląd dzielą kolumnę — „Pokaż panel" musi dok zwinąć, inaczej
    // pigułka byłaby martwym przyciskiem.
    expect(appStore.toggleChatCollapse).toHaveBeenCalledTimes(1);
    expect(appStore.isChatCollapsed).toBe(true);
  });

  it('DEC-397b: `otworz()` czyści zamkniecie BEZ ruszania doku Teresy (MUTACJA: dołóż `toggleChatCollapse` do `otworz` → RED)', () => {
    appStore.isChatCollapsed = false; // dok otwarty
    const panel = renderHook(() => useJedenPanel(), { wrapper: wrapperAt('/initiatives') });

    act(() => panel.result.current.zamknij());
    expect(panel.result.current.zamkniety).toBe(true);

    act(() => panel.result.current.otworz());
    expect(panel.result.current.zamkniety).toBe(false);
    expect(localStorage.getItem('consultify.listPanel.initiatives.closed')).toBe('0');
    // Klucz różnicy vs `pokazPanel()`: `otworz()` NIE zwija doku — inaczej
    // klik wiersza przy otwartym doku Teresy (DEC-404) gasiłby dok.
    expect(appStore.toggleChatCollapse).not.toHaveBeenCalled();
    expect(appStore.isChatCollapsed).toBe(false);
  });

  it('KONTRAKT DEC-404: hook nie eksponuje już zakładki ani wejścia do Teresy', () => {
    const panel = renderHook(() => useJedenPanel(), { wrapper: wrapperAt('/my-work') });
    const api = panel.result.current as Record<string, unknown>;
    // MUTACJA: przywróć `zakladka`/`otworzTerese`/`ustawZakladke` → RED.
    expect(api.zakladka).toBeUndefined();
    expect(api.otworzTerese).toBeUndefined();
    expect(api.ustawZakladke).toBeUndefined();
  });
});
