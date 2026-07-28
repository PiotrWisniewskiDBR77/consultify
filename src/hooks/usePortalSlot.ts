import { useEffect, useState } from 'react';

/**
 * Reaktywne wyszukiwanie DOM-node po `id` — cel dla `createPortal`, gdy
 * komponent-źródło i komponent-cel są w zupełnie różnych gałęziach drzewa i
 * prop-drilling między nimi byłby przebudową (np. klaster poleceń powłoki
 * `ExecutiveModuleShell/TopBar` → rząd pilli `MyWorkHub`).
 *
 * Zwraca element (lub `null`, gdy nieobecny) i AKTUALIZUJE się, gdy węzeł
 * pojawia się/znika w DOM — a to się dzieje: cel montuje się dopiero po tym,
 * jak host wyrenderuje swój rząd, i znika przy zamknięciu ostatniej karty.
 * Dzięki temu brak celu = czysty `null`, a nie wyścig na pierwszym renderze.
 *
 * BLIŹNIAK: `src/components/MyWork/whiteboard/usePortalSlot.ts` (ta sama
 * mechanika, użyta dla panelu sesji Whiteboard). Świadomie NIE scalam ich w tej
 * zmianie — tamten plik jest w zakresie równoległej pracy; scalenie to osobny
 * krok porządkowy.
 */
export function usePortalSlot(id: string | null | undefined): HTMLElement | null {
  const [node, setNode] = useState<HTMLElement | null>(() =>
    typeof document === 'undefined' || !id ? null : document.getElementById(id)
  );

  useEffect(() => {
    if (!id) {
      setNode(null);
      return;
    }
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;

    const check = (): void => {
      const found = document.getElementById(id);
      setNode((prev) => (prev === found ? prev : found));
    };
    check();

    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [id]);

  return node;
}

export default usePortalSlot;
