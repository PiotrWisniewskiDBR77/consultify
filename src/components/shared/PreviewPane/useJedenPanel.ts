import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';

import { useAppStore } from '@/store/useAppStore';

export type JedenPanelZakladka = 'rekord' | 'teresa';

interface JedenPanelState {
  zamkniety: boolean;
  zakladka: JedenPanelZakladka;
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
  const nowy = { zamkniety: wczytajZamkniecie(modul), zakladka: 'rekord' as const };
  stany.set(modul, nowy);
  return nowy;
};

const ustawStan = (modul: string, zmiana: Partial<JedenPanelState>): void => {
  const poprzedni = pobierzStan(modul);
  const nastepny = { ...poprzedni, ...zmiana };
  if (
    nastepny.zamkniety === poprzedni.zamkniety &&
    nastepny.zakladka === poprzedni.zakladka
  ) {
    return;
  }
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
  zamknij: () => void;
  pokazPanel: () => void;
  otworzTerese: () => void;
  ustawZakladke: (zakladka: JedenPanelZakladka) => void;
}

export function useJedenPanel(): UseJedenPanelResult {
  const { pathname } = useLocation();
  const modul = pathname.split('/').filter(Boolean)[0] || 'root';
  const isChatCollapsed = useAppStore((state) => state.isChatCollapsed) ?? true;
  const toggleChatCollapse = useAppStore((state) => state.toggleChatCollapse);
  const poprzedniStanCzatu = useRef(isChatCollapsed);

  const stan = useSyncExternalStore(
    useCallback((powiadom) => subskrybuj(modul, powiadom), [modul]),
    useCallback(() => pobierzStan(modul), [modul]),
    useCallback(() => pobierzStan(modul), [modul])
  );

  useEffect(() => {
    // Globalny stan czatu jest zdarzeniem przejścia, nigdy stanem początkowym zakładki.
    if (poprzedniStanCzatu.current !== isChatCollapsed) {
      ustawStan(modul, {
        zamkniety: false,
        zakladka: isChatCollapsed ? 'rekord' : 'teresa',
      });
      zapiszZamkniecie(modul, false);
      poprzedniStanCzatu.current = isChatCollapsed;
    }
  }, [isChatCollapsed, modul]);

  const ustawZakladke = useCallback(
    (zakladka: JedenPanelZakladka) => {
      ustawStan(modul, { zamkniety: false, zakladka });
      zapiszZamkniecie(modul, false);
      if (zakladka === 'teresa' && isChatCollapsed) toggleChatCollapse?.();
      if (zakladka === 'rekord' && !isChatCollapsed) toggleChatCollapse?.();
      poprzedniStanCzatu.current = zakladka !== 'teresa';
    },
    [isChatCollapsed, modul, toggleChatCollapse]
  );

  const zamknij = useCallback(() => {
    ustawStan(modul, { zamkniety: true, zakladka: 'rekord' });
    zapiszZamkniecie(modul, true);
    if (!isChatCollapsed) toggleChatCollapse?.();
    poprzedniStanCzatu.current = true;
  }, [isChatCollapsed, modul, toggleChatCollapse]);

  const pokazPanel = useCallback(() => {
    ustawStan(modul, { zamkniety: false, zakladka: 'rekord' });
    zapiszZamkniecie(modul, false);
    if (!isChatCollapsed) toggleChatCollapse?.();
    poprzedniStanCzatu.current = true;
  }, [isChatCollapsed, modul, toggleChatCollapse]);

  const otworzTerese = useCallback(() => ustawZakladke('teresa'), [ustawZakladke]);

  return { modul, ...stan, zamknij, pokazPanel, otworzTerese, ustawZakladke };
}

/** Wyłącznie do izolowania testów hooka. */
export function resetJedenPanelForTests(): void {
  stany.clear();
  sluchacze.clear();
}
