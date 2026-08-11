/**
 * `useFinanceFocusMode` — wiąże `focusMode.contract.ts` (Pakiet C) z DOM.
 *
 * Kontrakt (czysta logika) mówi CO jest zachowywane i CO się dzieje przy
 * toggle; ten hook robi TO w przeglądarce:
 *   - `Esc` wychodzi z focus mode (OWN-FIN-004), ale respektuje precedencję
 *     (`resolveEscapeKey`) — modal/command-palette/popover/edycja komórki
 *     wygrywają, więc `Esc` w otwartym menu paska nie wywala trybu spod
 *     spodu (kontrakt też to gwarantuje przez `EscapeContext`, ale ten hook
 *     musi dostarczyć PRAWDZIWY stan tych warstw — patrz `escapeContext` param).
 *   - focus restore: po wyjściu, fokus klawiatury wraca na kontrolkę, która
 *     otworzyła tryb (`restoreFocusToControlId`) — DOM `id` lub `data-testid`.
 *   - `document.body` dostaje klasę `finance-focus-mode-active` na czas trybu,
 *     żeby powłoka mogła ukryć `FOCUS_MODE_HIDDEN_REGIONS` przez CSS (żaden
 *     region nie jest unmountowany — to jest KLUCZOWE dla „nie refetchuje":
 *     unmount/remount region ukrytego stanu (np. filtry w innym panelu)
 *     zresetowałby go).
 *
 * Stan roboczy modułu (`TState`) NIGDY nie jest tworzony/kopiowany przez ten
 * hook — wchodzi jako referencja z zewnątrz i wraca tą samą referencją; to
 * jest dowód „nie refetchuje", potwierdzony `assertFocusModePreservation`
 * w testach.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  FOCUS_MODE_HIDDEN_REGIONS,
  assertFocusModePreservation,
  createFocusModeSession,
  enterFocusMode,
  exitFocusMode,
  resolveEscapeKey,
  type EscapeContext,
  type FocusModeSession,
  type FocusModeTrigger,
} from '@/components/Finance/shared/focusMode.contract';

const FOCUS_MODE_BODY_CLASS = 'finance-focus-mode-active';

export interface UseFinanceFocusModeParams<TState> {
  workspaceState: TState;
  activeViewId: string | null;
  /** Warstwy nad focus mode w precedencji Escape — DOMYŚLNIE wszystko `false` (żadna nie jest otwarta). */
  escapeContext?: Omit<EscapeContext, 'focusModeActive'>;
}

export interface UseFinanceFocusModeResult<TState> {
  active: boolean;
  session: FocusModeSession<TState>;
  enter: (restoreFocusToControlId: string | null, trigger?: FocusModeTrigger) => void;
  exit: (trigger?: FocusModeTrigger) => void;
  toggle: (restoreFocusToControlId: string | null) => void;
  /** Dowód dla kontroli negatywnej: porównaj sesję przed/po ostatnim toggle. */
  lastPreservationCheck: ReturnType<typeof assertFocusModePreservation<TState>> | null;
}

export function useFinanceFocusMode<TState>(
  params: UseFinanceFocusModeParams<TState>
): UseFinanceFocusModeResult<TState> {
  const sessionRef = useRef<FocusModeSession<TState>>(
    createFocusModeSession(params.workspaceState, { activeViewId: params.activeViewId })
  );
  // Stan roboczy modułu jest referencyjnie zewnętrzny — aktualizujemy uchwyt
  // sesji, gdy caller podmienia referencję (edycja draftu), ale NIGDY
  // wewnątrz toggle (patrz nagłówek pliku).
  sessionRef.current = { ...sessionRef.current, workspaceState: params.workspaceState };

  const [, forceRender] = useState(0);
  const [lastPreservationCheck, setLastPreservationCheck] = useState<UseFinanceFocusModeResult<TState>['lastPreservationCheck']>(null);

  const applyToggle = useCallback((next: FocusModeSession<TState>, before: FocusModeSession<TState>) => {
    sessionRef.current = next;
    setLastPreservationCheck(assertFocusModePreservation(before, next));
    document.body.classList.toggle(FOCUS_MODE_BODY_CLASS, next.active);
    forceRender((n) => n + 1);
  }, []);

  const enter = useCallback(
    (restoreFocusToControlId: string | null, trigger: FocusModeTrigger = 'toggle-control') => {
      const before = sessionRef.current;
      const result = enterFocusMode(before, { trigger, restoreFocusToControlId });
      applyToggle(result.session, before);
    },
    [applyToggle]
  );

  const exit = useCallback(
    (trigger: FocusModeTrigger = 'toggle-control') => {
      const before = sessionRef.current;
      const result = exitFocusMode(before, { trigger });
      applyToggle(result.session, before);
      // A11y focus-restore: fokus wraca na kontrolkę, która otworzyła tryb.
      const controlId = before.restoreFocusToControlId;
      if (controlId) {
        // Odłożone na kolejny tick, żeby DOM chowanego regionu zdążył się z powrotem pokazać.
        window.setTimeout(() => {
          const el = document.getElementById(controlId) ?? document.querySelector<HTMLElement>(`[data-testid="${controlId}"]`);
          el?.focus();
        }, 0);
      }
    },
    [applyToggle]
  );

  const toggle = useCallback(
    (restoreFocusToControlId: string | null) => {
      if (sessionRef.current.active) exit('toggle-control');
      else enter(restoreFocusToControlId, 'toggle-control');
    },
    [enter, exit]
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key !== 'Escape') return;
      const ctx: EscapeContext = {
        modalOpen: params.escapeContext?.modalOpen ?? false,
        commandPaletteOpen: params.escapeContext?.commandPaletteOpen ?? false,
        popoverOpen: params.escapeContext?.popoverOpen ?? false,
        cellEditing: params.escapeContext?.cellEditing ?? false,
        focusModeActive: sessionRef.current.active,
      };
      const consumer = resolveEscapeKey(ctx);
      if (consumer === 'focus-mode') {
        e.preventDefault();
        exit('escape-key');
      }
      // Wszystkie inne konsumenty (modal/command-palette/popover/cell-editing)
      // zamykają się SAME (własny listener wyżej w precedencji) — ten hook
      // celowo nic dla nich nie robi, patrz kontrakt (`resolveEscapeKey`).
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exit, params.escapeContext?.modalOpen, params.escapeContext?.commandPaletteOpen, params.escapeContext?.popoverOpen, params.escapeContext?.cellEditing]);

  useEffect(() => {
    return () => {
      document.body.classList.remove(FOCUS_MODE_BODY_CLASS);
    };
  }, []);

  return useMemo(
    () => ({
      active: sessionRef.current.active,
      session: sessionRef.current,
      enter,
      exit,
      toggle,
      lastPreservationCheck,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionRef.current, enter, exit, toggle, lastPreservationCheck]
  );
}

export { FOCUS_MODE_HIDDEN_REGIONS, FOCUS_MODE_BODY_CLASS };
export default useFinanceFocusMode;
