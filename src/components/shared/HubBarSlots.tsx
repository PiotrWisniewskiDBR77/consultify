/**
 * HubBarSlots — mechanizm „dziecko wypełnia pasek rodzica" (jeden pasek na ekran).
 *
 * PROBLEM, KTÓRY ROZWIĄZUJE (zgłoszenie właściciela, 2026-07-27, żywe demo):
 * ekran zagnieżdżony w hubie (np. Run agent / Client Vault wewnątrz My Work)
 * renderował WŁASNY `StandardModuleBar`, mimo że hub już ma swój pasek. Efekt:
 * nad obszarem roboczym piętrzyły się CZTERY rzędy chrome —
 *   ① Menu 2 huba (lupa + zakładki modułu + CTA)
 *   ② Menu 3 huba (karty otwartych obiektów)
 *   ③ Menu 2 dziecka (lupa + filtr + CTA)     ← duplikat ①
 *   ④ Menu 3 dziecka (karty dziecka)          ← duplikat ②
 * Cytat właściciela: „za dużo miejsca ucieka […] odzyskamy całą tę ogromną
 * przestrzeń, która teraz bez sensu jest wykorzystana".
 *
 * ZASADA (kanon, do stosowania W CAŁEJ APLIKACJI — nie tylko w My Work):
 *   Na jednym ekranie jest DOKŁADNIE JEDEN pasek Menu 2 i JEDNO Menu 3.
 *   Renderuje je NAJWYŻSZY hub. Ekran-dziecko nie rysuje własnego paska —
 *   DEKLARUJE, co ma się w tym jednym pasku pojawić (`useHubBarSlot`).
 *
 * Dlaczego kontekst, a nie propsy: dziecko bywa oddzielone od huba przez
 * `React.lazy` + `Suspense` + kilka warstw layoutu (patrz MyWorkHub →
 * AgentHubShell). Przewlekanie propsów przez te warstwy wymagałoby zmian w
 * każdej z nich; kontekst zostawia je nietknięte i działa tak samo, gdy ten
 * sam ekran-dziecko zostanie kiedyś osadzony w innym hubie.
 *
 * Kontrakt slotów (mapowanie na kanon triady, `docs/ui-standards/TRIADA_KANON.md`):
 *   - `searchControl`  → Menu 2, lewy klaster, bezpośrednio po search toggle.
 *   - `filterControls` → Menu 2, lewa część prawego klastra (filtry/przełączniki
 *     zakresu). Kanon: filtry NIE mają własnego rzędu.
 *   - `viewControls`   → Menu 2, prawy klaster po filtrach (segment widoków).
 *   - `primaryCta`     → Menu 2, prawa krawędź (JEDEN przycisk dodawania,
 *     kontekstowy dla tego, co user właśnie widzi — „Nowy agent" w Run agent,
 *     nie generyczne „Nowy").
 *   - `openItems`/`activeItemId`/`onSelectItem`/`onCloseItem` → Menu 3, karty
 *     otwartych obiektów, DOKLEJANE do kart huba (nie zastępujące ich).
 *
 * Bezpieczeństwo wstecz: hub bez providera = `useHubBarSlot` jest no-opem
 * (dziecko renderuje się normalnie, tylko jego sloty nikną). Dzięki temu
 * migracja idzie ekran po ekranie, bez „wielkiego przełączenia".
 */
import type { LucideIcon } from 'lucide-react';
import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { OpenDocument } from './ModuleHub/types';

/**
 * CTA dodawania — jeden na ekran, kontekstowy dla widocznej treści.
 * `icon` opcjonalna — 1:1 kontrakt `StandardPrimaryCta` (`StandardModuleBar.tsx`),
 * renderowana przez huba TYMI SAMYMI klasami/rozmiarem (`size={16}`) co CTA
 * natywne huba (AGT-015 §6 D1: dziecko deklarujące primaryCta bez ikony
 * dostawało uboższy przycisk niż per-tab CTA huba).
 */
export interface HubBarPrimaryCta {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  /** Blokada w trakcie operacji (np. „Tworzenie…"). */
  disabled?: boolean;
  testId?: string;
}

/** Zestaw deklarowany przez ekran-dziecko. Każde pole opcjonalne. */
export interface HubBarSlotValue {
  searchControl?: ReactNode;
  filterControls?: ReactNode;
  viewControls?: ReactNode;
  primaryCta?: HubBarPrimaryCta | null;
  /** Karty do DOKLEJENIA do Menu 3 huba (obiekty otwarte wewnątrz dziecka). */
  openItems?: OpenDocument[];
  activeItemId?: string | null;
  onSelectItem?: (id: string) => void;
  onCloseItem?: (id: string) => void;
  /** „Lista" — powrót z otwartego obiektu do listy dziecka. */
  onShowList?: () => void;
}

interface HubBarSlotsContextValue {
  slot: HubBarSlotValue;
  register: (value: HubBarSlotValue) => void;
  clear: () => void;
}

const HubBarSlotsContext = createContext<HubBarSlotsContextValue | null>(null);

/**
 * Provider — zakłada go HUB (ten, który realnie rysuje pasek). Zwraca też
 * `slot`, żeby hub mógł wpleść zawartość w swoje Menu 2/3 (patrz `useHubBar`).
 */
export const HubBarSlotsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [slot, setSlot] = useState<HubBarSlotValue>({});

  const register = useCallback((value: HubBarSlotValue) => setSlot(value), []);
  const clear = useCallback(() => setSlot({}), []);

  const ctx = useMemo<HubBarSlotsContextValue>(
    () => ({ slot, register, clear }),
    [slot, register, clear]
  );

  return <HubBarSlotsContext.Provider value={ctx}>{children}</HubBarSlotsContext.Provider>;
};

/** Odczyt dla HUBA — co dziecko chce mieć w pasku. Poza providerem: pusty obiekt. */
export function useHubBar(): HubBarSlotValue {
  return useContext(HubBarSlotsContext)?.slot ?? {};
}

/**
 * Rejestracja dla EKRANU-DZIECKA. Woła się przy każdej zmianie `value` i
 * czyści sloty przy odmontowaniu (żeby CTA „Nowy agent" nie został w pasku
 * po przejściu na inną zakładkę).
 *
 * ★ Pułapka: `value` to obiekt tworzony inline przy każdym renderze, więc
 * zależnością efektu NIE może być samo `value` (pętla render→register→render).
 * Rozkładamy je na pola i porównujemy po referencjach pól — wołający ma
 * podać stabilne callbacki (`useCallback`) i memoizowane listy (`useMemo`),
 * dokładnie jak przy propsach Reacta.
 */
export function useHubBarSlot(value: HubBarSlotValue): void {
  const ctx = useContext(HubBarSlotsContext);
  const register = ctx?.register;
  const clear = ctx?.clear;

  const {
    searchControl,
    filterControls,
    viewControls,
    primaryCta,
    openItems,
    activeItemId,
    onSelectItem,
    onCloseItem,
    onShowList,
  } = value;

  useEffect(() => {
    if (!register) return;
    register({
      searchControl,
      filterControls,
      viewControls,
      primaryCta,
      openItems,
      activeItemId,
      onSelectItem,
      onCloseItem,
      onShowList,
    });
    return () => clear?.();
  }, [
    register,
    clear,
    searchControl,
    filterControls,
    viewControls,
    primaryCta,
    openItems,
    activeItemId,
    onSelectItem,
    onCloseItem,
    onShowList,
  ]);
}

export default HubBarSlotsProvider;
