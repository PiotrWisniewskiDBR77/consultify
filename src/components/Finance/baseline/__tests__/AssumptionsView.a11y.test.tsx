/**
 * @vitest-environment jsdom
 *
 * Pakiet I (Dostępność) — dialog potwierdzenia zapisu mimo ostrzeżeń w
 * `AssumptionsView.tsx` (`confirmingDespiteWarnings`). PRZED naprawą:
 * `role="alertdialog"` bez pułapki fokusa/Escape/przywrócenia. Wyzwalacz
 * („Zapisz zestaw założeń", `baseline-assumptions-save`) NIE odmontowuje się
 * pod dialogiem, więc `useDialogA11y` przywraca fokus na niego bez
 * dodatkowego fallbacku (test to dowodzi).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { AssumptionsView } from '../AssumptionsView';
import type { UseBaselineAssumptionsEditorResult } from '../useBaselineAssumptionsEditor';

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    get() {
      return document.body;
    },
    configurable: true,
  });
});

function fakeEditor(overrides: Partial<UseBaselineAssumptionsEditorResult> = {}): UseBaselineAssumptionsEditorResult {
  return {
    loading: false,
    error: null,
    saving: false,
    saveError: null,
    rows: [],
    cells: new Map(),
    reload: vi.fn().mockResolvedValue(undefined),
    setCellValue: vi.fn(),
    pasteBatch: vi.fn(),
    resetCellToServer: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: false,
    canRedo: false,
    dirtyCount: 1,
    isDirty: () => false,
    preflightWarnings: [{ key: 'REVENUE_GROWTH_YOY::ent-1::per-2026-01', reason: 'MISSING' }],
    save: vi.fn().mockResolvedValue({ ok: true, writtenCount: 1 }),
    ...overrides,
  };
}

describe('AssumptionsView — dialog potwierdzenia zapisu mimo ostrzeżeń (a11y, Pakiet I)', () => {
  it('otwiera się z rolą alertdialog, fokus wchodzi w dialog (pierwszy fokusowalny)', async () => {
    render(<AssumptionsView editor={fakeEditor()} rowOrder={[]} />);
    fireEvent.click(screen.getByTestId('baseline-assumptions-save'));
    const dialog = await screen.findByTestId('baseline-assumptions-preflight-confirm');
    expect(dialog).toHaveAttribute('role', 'alertdialog');
    await waitFor(() => expect(document.activeElement).not.toBe(document.body));
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('Escape zamyka dialog i przywraca fokus na przycisk „Zapisz zestaw założeń"', async () => {
    render(<AssumptionsView editor={fakeEditor()} rowOrder={[]} />);
    const saveButton = screen.getByTestId('baseline-assumptions-save');
    // Wymuszamy fokus jawnie przed klikiem — `useDialogA11y` przechwytuje
    // `document.activeElement` W MOMENCIE otwarcia dialogu (nie zgaduje kto
    // "logicznie" go wyzwolił), więc test musi odtworzyć realny stan
    // klawiaturowego użytkownika (fokus na przycisku, potem aktywacja).
    saveButton.focus();
    fireEvent.click(saveButton);
    await screen.findByTestId('baseline-assumptions-preflight-confirm');

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByTestId('baseline-assumptions-preflight-confirm')).not.toBeInTheDocument());
    await waitFor(() => expect(saveButton).toHaveFocus());
  });

  it('"Zapisz mimo to" wywołuje editor.save()', async () => {
    const editor = fakeEditor();
    render(<AssumptionsView editor={editor} rowOrder={[]} />);
    fireEvent.click(screen.getByTestId('baseline-assumptions-save'));
    await screen.findByTestId('baseline-assumptions-preflight-confirm');
    fireEvent.click(screen.getByTestId('baseline-assumptions-preflight-confirm-save'));
    await waitFor(() => expect(editor.save).toHaveBeenCalledTimes(1));
  });

  it('KONTROLA NEGATYWNA: gdy brak ostrzeżeń preflight, klik "Zapisz" NIE otwiera dialogu (dowód, że test faktycznie zależy od preflightWarnings, nie zawsze się otwiera)', () => {
    render(<AssumptionsView editor={fakeEditor({ preflightWarnings: [] })} rowOrder={[]} />);
    fireEvent.click(screen.getByTestId('baseline-assumptions-save'));
    expect(screen.queryByTestId('baseline-assumptions-preflight-confirm')).not.toBeInTheDocument();
  });
});
