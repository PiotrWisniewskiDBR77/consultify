import { useEffect, useState } from 'react';

/**
 * Naprawa Whiteboard 2026-07-26 (Zadanie A) — reaktywne wyszukiwanie DOM-node
 * po `id`, używane do portalowania `WhiteboardSessionPanel` do prawego panelu
 * (`IdeaWorkspaceTools`) bez prop-drillingu przez `IdeaMapWorkspace`.
 *
 * Zwraca element (lub `null`, gdy nieobecny) i AKTUALIZUJE się, gdy węzeł
 * pojawia się/znika w DOM — co dzieje się przy każdym przełączeniu zakładki
 * prawego panelu (`onlySection`, patrz `IdeaWorkspaceTools.tsx`), bo tam
 * sekcja „Inspektor tablicy" (i jej slot) montuje/odmontowuje się razem z
 * zakładką „Właściwości".
 */
export function usePortalSlot(id: string): HTMLElement | null {
  const [node, setNode] = useState<HTMLElement | null>(() =>
    typeof document === 'undefined' ? null : document.getElementById(id)
  );

  useEffect(() => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;

    const check = () => {
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
