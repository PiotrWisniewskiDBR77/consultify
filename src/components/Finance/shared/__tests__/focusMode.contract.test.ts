/**
 * Kontrola negatywna kontraktu Focus Mode (Pakiet C, OWN-FIN-004).
 *
 * Dowodzi:
 *   - toggle NIGDY nie tworzy nowego `workspaceState` (referencja identyczna
 *     przed/po) — czyli „nie refetchuje" jest czymś sprawdzalnym, nie prozą.
 *   - `assertFocusModePreservation` faktycznie WYKRYWA regresję, gdy ktoś
 *     złamie tę zasadę (symulowane przez ręczne podmienienie referencji).
 *   - aktywna zakładka przetrwa wejście/wyjście.
 *   - precedencja Escape: modal/popover/cell-editing wygrywają z focus mode.
 */
import { describe, expect, it } from 'vitest';

import {
  FOCUS_MODE_HIDDEN_REGIONS,
  FOCUS_MODE_RETAINED_REGIONS,
  assertFocusModePreservation,
  createFocusModeSession,
  enterFocusMode,
  exitFocusMode,
  regionVisibilityInFocusMode,
  resolveEscapeKey,
  type FocusModeSession,
} from '../focusMode.contract';

interface DraftState {
  unsavedChanges: boolean;
  draftValue: string;
}

describe('focusMode.contract — dowód „nie refetchuje” (handoff §11)', () => {
  it('wejście w focus mode niesie TĘ SAMĄ referencję workspaceState', () => {
    const workspaceState: DraftState = { unsavedChanges: false, draftValue: 'v1' };
    const session = createFocusModeSession(workspaceState, { activeViewId: 'assumptions' });

    const result = enterFocusMode(session, { trigger: 'toggle-control', restoreFocusToControlId: 'fullscreen.toggle' });

    expect(result.session.workspaceState).toBe(workspaceState); // tożsamość referencji, nie głęboka równość
    expect(result.refetched).toBe(false);
    expect(result.session.active).toBe(true);
  });

  it('KONTROLA NEGATYWNA: niezapisana zmiana wprowadzona PRZED wejściem w focus mode przetrwa wyjście przez Esc', () => {
    // 1. Użytkownik wprowadza niezapisaną zmianę.
    const workspaceState: DraftState = { unsavedChanges: true, draftValue: 'draft wpisany przez użytkownika' };
    let session: FocusModeSession<DraftState> = createFocusModeSession(workspaceState, { activeViewId: 'outputs' });

    // 2. Włącza focus mode.
    const entered = enterFocusMode(session, { trigger: 'toggle-control', restoreFocusToControlId: 'fullscreen.toggle' });
    session = entered.session;
    expect(session.active).toBe(true);

    // 3. Wychodzi przez Esc.
    const exited = exitFocusMode(session, { trigger: 'escape-key' });

    // 4. Dowód: draft PRZETRWAŁ — ta sama referencja, te same wartości.
    expect(exited.session.workspaceState).toBe(workspaceState);
    expect(exited.session.workspaceState.unsavedChanges).toBe(true);
    expect(exited.session.workspaceState.draftValue).toBe('draft wpisany przez użytkownika');
    expect(exited.session.active).toBe(false);
  });

  it('aktywna zakładka (activeViewId) przetrwa wejście i wyjście', () => {
    const workspaceState: DraftState = { unsavedChanges: false, draftValue: '' };
    const session = createFocusModeSession(workspaceState, { activeViewId: 'outputs' });
    const entered = enterFocusMode(session, { trigger: 'toggle-control', restoreFocusToControlId: null });
    const exited = exitFocusMode(entered.session, { trigger: 'toggle-control' });
    expect(entered.session.activeViewId).toBe('outputs');
    expect(exited.session.activeViewId).toBe('outputs');
  });

  it('assertFocusModePreservation WYKRYWA regresję: jeśli caller złamie kontrakt i podmieni workspaceState przy toggle, test to łapie', () => {
    const before: FocusModeSession<DraftState> = createFocusModeSession({ unsavedChanges: true, draftValue: 'x' }, { activeViewId: 'a' });
    // Symulacja BŁĘDNEJ implementacji, która przebudowuje stan zamiast nieść referencję.
    const brokenAfter: FocusModeSession<DraftState> = {
      ...before,
      active: true,
      workspaceState: { unsavedChanges: true, draftValue: 'x' }, // NOWY obiekt, strukturalnie identyczny
    };
    const check = assertFocusModePreservation(before, brokenAfter);
    expect(check.ok).toBe(false);
    if (!check.ok) {
      expect(check.violations.some((v) => v.key === 'draft')).toBe(true);
    }
  });

  it('assertFocusModePreservation PRZECHODZI dla poprawnego toggle (referencja niesiona)', () => {
    const workspaceState: DraftState = { unsavedChanges: true, draftValue: 'x' };
    const before = createFocusModeSession(workspaceState, { activeViewId: 'a' });
    const { session: after } = enterFocusMode(before, { trigger: 'toggle-control', restoreFocusToControlId: null });
    expect(assertFocusModePreservation(before, after)).toEqual({ ok: true });
  });

  it('no-op: wyjście z nieaktywnej sesji zwraca TĘ SAMĄ sesję (nie tylko równą, ale identyczną)', () => {
    const workspaceState: DraftState = { unsavedChanges: false, draftValue: '' };
    const session = createFocusModeSession(workspaceState);
    const result = exitFocusMode(session, { trigger: 'toggle-control' });
    expect(result.noop).toBe(true);
    expect(result.session).toBe(session);
  });
});

describe('focusMode.contract — regiony chrome (handoff §11)', () => {
  it('menu1/workspaceBar/viewNavigation/workspace są RETAINED', () => {
    for (const region of FOCUS_MODE_RETAINED_REGIONS) {
      expect(regionVisibilityInFocusMode(region)).toBe('retained');
    }
  });

  it('globalTopbar i financeStatusStrip są HIDDEN', () => {
    expect(regionVisibilityInFocusMode('globalTopbar')).toBe('hidden');
    expect(regionVisibilityInFocusMode('financeStatusStrip')).toBe('hidden');
  });

  it('regiony retained+hidden są rozłączne i kompletne (partycja)', () => {
    const retainedSet = new Set(FOCUS_MODE_RETAINED_REGIONS);
    const hiddenSet = new Set(FOCUS_MODE_HIDDEN_REGIONS);
    for (const r of retainedSet) expect(hiddenSet.has(r)).toBe(false);
    expect(retainedSet.size + hiddenSet.size).toBe(11);
  });
});

describe('focusMode.contract — precedencja Escape (modal > command-palette > popover > cell-editing > focus-mode)', () => {
  it('focus mode aktywny, nic więcej otwarte → focus-mode konsumuje Esc', () => {
    expect(
      resolveEscapeKey({ modalOpen: false, commandPaletteOpen: false, popoverOpen: false, cellEditing: false, focusModeActive: true })
    ).toBe('focus-mode');
  });

  it('KONTROLA NEGATYWNA: modal otwarty NAD focus mode → modal wygrywa, focus mode NIE gaśnie', () => {
    const consumer = resolveEscapeKey({
      modalOpen: true,
      commandPaletteOpen: false,
      popoverOpen: false,
      cellEditing: false,
      focusModeActive: true,
    });
    expect(consumer).toBe('modal');
    expect(consumer).not.toBe('focus-mode');
  });

  it('popover otwarty → popover wygrywa nad focus mode', () => {
    expect(
      resolveEscapeKey({ modalOpen: false, commandPaletteOpen: false, popoverOpen: true, cellEditing: false, focusModeActive: true })
    ).toBe('popover');
  });

  it('nic otwarte, focus mode nieaktywny → none', () => {
    expect(
      resolveEscapeKey({ modalOpen: false, commandPaletteOpen: false, popoverOpen: false, cellEditing: false, focusModeActive: false })
    ).toBe('none');
  });
});
