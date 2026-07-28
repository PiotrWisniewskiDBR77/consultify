/**
 * useFullscreenPortalTarget — węzeł-cel dla `createPortal`, który PRZEŻYWA
 * pełny ekran.
 *
 * PROBLEM (zgłoszenie właściciela 2026-07-28: „jak zrobiłem cały ekran to nie
 * mam menu lewego — oddaj mi je :)"):
 * `IdeaMapWorkspace` woła `requestFullscreen()` na swoim korzeniu
 * (`workspaceRootRef`), a lewy pasek ikon (`CanvasLeftToolbar`) portaluje się
 * do `document.body`. Przeglądarka w pełnym ekranie rysuje WYŁĄCZNIE poddrzewo
 * elementu pełnoekranowego — pasek jest jego RODZEŃSTWEM, więc znika razem z
 * popoverem, wskaźnikiem trybu, przełącznikiem reprezentacji, menu kontekstowym
 * i paletą poleceń. To nie jest błąd stylowania: to struktura DOM.
 *
 * WYBRANE ROZWIĄZANIE (i dlaczego nie inne):
 *  - ❌ `requestFullscreen()` na wspólnym przodku paska i płótna — jedynym takim
 *    przodkiem jest `document.body`, więc w pełnym ekranie wróciłaby CAŁA
 *    powłoka aplikacji (lewa nawigacja, nagłówek). To już nie jest „pełne
 *    płótno".
 *  - ❌ Przeniesienie paska z portalu do drzewa płótna — portal jest tam
 *    świadomie (bezpieczeństwo z-index + kontrakt `data-mels-floating-rail-surface`
 *    z `ExecutiveModuleShell`, który mierzy pasek i rezerwuje rynnę).
 *  - ✅ PRZEPINANIE CELU PORTALU na `fullscreenchange`. Jedna linia w miejscu
 *    portalu, zero zmian w układzie, działa dla dowolnego elementu
 *    pełnoekranowego (także tego z trybu prezentacji).
 *
 * ★ NIEZMIENNIK (naprawa B3 z 2026-07-27, komentarz w `CanvasLeftToolbar`):
 * pasek i jego popover żyją w JEDNYM portalu — „popover żyje i umiera dokładnie
 * tam, gdzie rail". Ten hook zwraca JEDEN węzeł na komponent, więc niezmiennik
 * zostaje: kto woła go raz i portaluje `<>{rail}{popover}</>`, ten dalej ma oba
 * w tym samym miejscu.
 *
 * Pozycjonowanie się nie psuje: pasek jest `position: fixed`, a `overflow:hidden`
 * przodka nie przycina elementów `fixed` (przycięłby tylko przodek z
 * `transform`/`filter`/`contain`). W pełnym ekranie element pełnoekranowy ma
 * rozmiar ekranu, więc współrzędne z `getBoundingClientRect()` płótna nadal się
 * zgadzają.
 */
import { useEffect, useState } from 'react';

/** Element pełnoekranowy niezależnie od prefiksu producenta (Safari/starsze WebKit). */
function currentFullscreenElement(): Element | null {
  if (typeof document === 'undefined') return null;
  const d = document as Document & {
    webkitFullscreenElement?: Element | null;
    msFullscreenElement?: Element | null;
  };
  return d.fullscreenElement ?? d.webkitFullscreenElement ?? d.msFullscreenElement ?? null;
}

function pickTarget(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const fs = currentFullscreenElement();
  // Gdy pełny ekran obejmuje <html> (tryb prezentacji) albo nikogo — `body` jest
  // WEWNĄTRZ widocznego poddrzewa, więc zostaje domyślnym, sprawdzonym celem.
  if (!fs || fs === document.documentElement || fs === document.body) return document.body;
  return fs as HTMLElement;
}

export function useFullscreenPortalTarget(): HTMLElement | null {
  const [target, setTarget] = useState<HTMLElement | null>(() => pickTarget());

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const sync = () => setTarget(pickTarget());
    sync();
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  return target;
}

export default useFullscreenPortalTarget;
