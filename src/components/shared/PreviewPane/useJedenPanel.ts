import { useCallback, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';

import { useAppStore } from '@/store/useAppStore';

interface JedenPanelState {
  zamkniety: boolean;
}

const stany = new Map<string, JedenPanelState>();
const sluchacze = new Map<string, Set<() => void>>();

const kluczPamieci = (modul: string) => `consultify.listPanel.${modul}.closed`;

const wczytajZamkniecie = (modul: string): boolean => {
  try {
    return window.localStorage.getItem(kluczPamieci(modul)) === '1';
  } catch {
    return false;
  }
};

const zapiszZamkniecie = (modul: string, zamkniety: boolean): void => {
  try {
    window.localStorage.setItem(kluczPamieci(modul), zamkniety ? '1' : '0');
  } catch {
    // Pamięć panelu jest udogodnieniem; tryb prywatny nie może blokować ekranu.
  }
};

const pobierzStan = (modul: string): JedenPanelState => {
  const istniejacy = stany.get(modul);
  if (istniejacy) return istniejacy;
  const nowy = { zamkniety: wczytajZamkniecie(modul) };
  stany.set(modul, nowy);
  return nowy;
};

const ustawStan = (modul: string, zmiana: Partial<JedenPanelState>): void => {
  const poprzedni = pobierzStan(modul);
  const nastepny = { ...poprzedni, ...zmiana };
  if (nastepny.zamkniety === poprzedni.zamkniety) return;
  stany.set(modul, nastepny);
  sluchacze.get(modul)?.forEach((powiadom) => powiadom());
};

const subskrybuj = (modul: string, powiadom: () => void): (() => void) => {
  const zbior = sluchacze.get(modul) ?? new Set<() => void>();
  zbior.add(powiadom);
  sluchacze.set(modul, zbior);
  return () => {
    zbior.delete(powiadom);
    if (zbior.size === 0) sluchacze.delete(modul);
  };
};

export interface UseJedenPanelResult extends JedenPanelState {
  modul: string;
  /**
   * ★ DEC-404 — dok Teresy JEST otwarty (globalny `isChatCollapsed === false`).
   * Gospodarz P1 chowa wtedy kolumnę podglądu: dok ZASTĘPUJE podgląd, nie staje
   * obok niego. `zamkniety` zostaje nietknięty, więc po zamknięciu doku podgląd
   * wraca DOKŁADNIE w stanie sprzed otwarcia (nie ma czego przywracać ręcznie).
   */
  dokOtwarty: boolean;
  zamknij: () => void;
  pokazPanel: () => void;
  /**
   * ★ DEC-397b (właściciel, 06.09.2026 15:47 — „preview jest otwierany tak,
   * jak wszędzie indziej: działa przy pojedynczym kliknięciu na linię").
   * Nadpisuje DEC-397 (05.09): X zostaje lepki wobec biernych re-renderów
   * (nowe dane pod tym samym zaznaczeniem, przełączenie zakładki), ALE
   * pojedynczy klik wiersza — czyli faktyczna ZMIANA zaznaczenia — ma
   * PONOWNIE otworzyć podgląd. `otworz()` czyści WYŁĄCZNIE `zamkniety`;
   * w odróżnieniu od `pokazPanel()` (pigułka Menu 3) NIE zwija doku Teresy —
   * gdy dok jest otwarty, klik wiersza nie ma otwierać drugiego panelu
   * (DEC-404), więc wołający musi to wywołać TYLKO z prawdziwego kliknięcia
   * wiersza (zmiana `selectedId`/wybranego rekordu), nigdy z efektu
   * obserwującego samą treść rekordu.
   */
  otworz: () => void;
}

/**
 * ★ DEC-404 (właściciel, 06.09.2026 — „tu nie jest jej miejsce",
 * „zupełnie bez sensu"). Do 06.09 ten hook trzymał JESZCZE zakładkę
 * (`zakladka: 'rekord' | 'teresa'`): klik ikony Teresy w Menu 1 przełączał
 * kolumnę podglądu na czat wciśnięty w 380 px, z podwójnym nagłówkiem
 * („Teresa" + zakładka „Teresa" + pasek czatu). Właściciel to odrzucił.
 *
 * OD TERAZ: Teresa ma na KAŻDYM ekranie jedną postać — standardowy dok
 * `UnifiedChatPanel` montowany przez `MainLayout` (ten sam co na /results,
 * /organization, /chat). Na ekranie listowym dok ZASTĘPUJE kolumnę podglądu,
 * więc nadal jest dokładnie JEDEN `<aside>` i JEDEN `UnifiedChatPanel`.
 * Panel podglądu = wyłącznie rekord; nie ma tu żadnej zakładki.
 */
export function useJedenPanel(): UseJedenPanelResult {
  const { pathname } = useLocation();
  const modul = pathname.split('/').filter(Boolean)[0] || 'root';
  const isChatCollapsed = useAppStore((state) => state.isChatCollapsed) ?? true;
  const toggleChatCollapse = useAppStore((state) => state.toggleChatCollapse);

  const stan = useSyncExternalStore(
    useCallback((powiadom) => subskrybuj(modul, powiadom), [modul]),
    useCallback(() => pobierzStan(modul), [modul]),
    useCallback(() => pobierzStan(modul), [modul])
  );

  const zamknij = useCallback(() => {
    ustawStan(modul, { zamkniety: true });
    zapiszZamkniecie(modul, true);
  }, [modul]);

  const pokazPanel = useCallback(() => {
    ustawStan(modul, { zamkniety: false });
    zapiszZamkniecie(modul, false);
    // Dok i podgląd zajmują tę samą kolumnę — „Pokaż panel" przy otwartym doku
    // musi go najpierw zwinąć, inaczej pigułka byłaby martwym przyciskiem.
    if (!isChatCollapsed) toggleChatCollapse?.();
  }, [isChatCollapsed, modul, toggleChatCollapse]);

  const otworz = useCallback(() => {
    // ★ DEC-397b: WYŁĄCZNIE `zamkniety=false` — celowo BEZ `toggleChatCollapse`,
    // żeby klik wiersza przy otwartym doku Teresy (DEC-404) nie gasił doku i
    // nie otwierał drugiego panelu w tej samej kolumnie.
    ustawStan(modul, { zamkniety: false });
    zapiszZamkniecie(modul, false);
  }, [modul]);

  return { modul, ...stan, dokOtwarty: !isChatCollapsed, zamknij, pokazPanel, otworz };
}

/** Wyłącznie do izolowania testów hooka. */
export function resetJedenPanelForTests(): void {
  stany.clear();
  sluchacze.clear();
}
