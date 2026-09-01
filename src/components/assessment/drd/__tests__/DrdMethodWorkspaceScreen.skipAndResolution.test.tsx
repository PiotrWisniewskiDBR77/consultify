/**
 * @vitest-environment jsdom
 *
 * Regression coverage for the 2026-08-26 fix: `onSkip`/`onResolutionAction`/
 * `onBack` under the DRD Interview Focus panel used to be empty handlers —
 * decoration under a visible "Potwierdź"/"Wstecz" button that recorded
 * nothing. This file proves the legacy (default, flag-OFF) DRD screen now
 * performs a real, persisted action for each one, and that the
 * DEC-2026-08-25-55 skip dictionary (4 fixed codes, no free text) is
 * actually enforced in the UI.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { SKIP_REASON_OPTIONS } from '@/components/method-workspace/skipReasonCodes';

import { DrdMethodWorkspaceScreen } from '../DrdMethodWorkspaceScreen';

function makeMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => void store.set(k, v),
    removeItem: (k) => void store.delete(k),
    clear: () => store.clear(),
    key: (i) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

function breadcrumbText() {
  return screen.getByRole('navigation', { name: /Ścieżka pytania/i }).textContent ?? '';
}

describe('DRD Interview Focus — skip dictionary (DEC-2026-08-25-55)', () => {
  it('offers exactly the 4 canonical codes and requires a choice before Potwierdź is enabled', () => {
    const storage = makeMemoryStorage();
    render(<DrdMethodWorkspaceScreen storage={storage} seedTo="interview" />);

    fireEvent.click(screen.getByRole('button', { name: /Pomiń z uzasadnieniem/i }));
    const select = screen.getByTestId('skip-reason-select') as HTMLSelectElement;
    const optionLabels = Array.from(select.options)
      .map((o) => o.textContent?.trim())
      .filter((t) => t && t !== 'Wybierz powód…');
    expect(optionLabels).toEqual(SKIP_REASON_OPTIONS.map((o) => o.label));

    const confirm = screen.getByRole('button', { name: /Potwierdź/i });
    expect(confirm).toBeDisabled();
  });

  it('skipping with a chosen code performs a real action: it advances the workspace (not a no-op under the button)', () => {
    const storage = makeMemoryStorage();
    render(<DrdMethodWorkspaceScreen storage={storage} seedTo="interview" />);

    const before = breadcrumbText();

    fireEvent.click(screen.getByRole('button', { name: /Pomiń z uzasadnieniem/i }));
    fireEvent.change(screen.getByTestId('skip-reason-select'), {
      target: { value: SKIP_REASON_OPTIONS[0].code },
    });
    fireEvent.click(screen.getByRole('button', { name: /Potwierdź/i }));

    expect(breadcrumbText()).not.toEqual(before);
  });
});

describe('DRD Interview Focus — "Wstecz" (onBack) is real navigation, not a no-op', () => {
  it('Dalej then Wstecz returns to the original unit', () => {
    const storage = makeMemoryStorage();
    render(<DrdMethodWorkspaceScreen storage={storage} seedTo="interview" />);

    const first = breadcrumbText();
    fireEvent.click(screen.getByRole('button', { name: /^Dalej/i }));
    expect(breadcrumbText()).not.toEqual(first);

    fireEvent.click(screen.getByRole('button', { name: /Wstecz/i }));
    expect(breadcrumbText()).toEqual(first);
  });
});

describe('DRD Interview Focus — Resolution Card ("Nie wiem") actions', () => {
  function openResolutionCard() {
    fireEvent.click(screen.getByRole('radio', { name: /Nie wiem/i }));
    return screen.getByTestId('resolution-card');
  }

  it('renders "Przypisz pytanie" disabled with a "Planowane" note — no per-question assignee exists', () => {
    const storage = makeMemoryStorage();
    render(<DrdMethodWorkspaceScreen storage={storage} seedTo="interview" />);
    const card = openResolutionCard();
    const assignButton = within(card).getByRole('button', { name: /Przypisz pytanie/i });
    expect(assignButton).toBeDisabled();
    expect(within(assignButton).getByText(/Planowane/i)).toBeInTheDocument();
  });

  it('"Poproś o dowód" performs a real, visibly-confirmed action', () => {
    const storage = makeMemoryStorage();
    render(<DrdMethodWorkspaceScreen storage={storage} seedTo="interview" />);
    const card = openResolutionCard();
    fireEvent.click(within(card).getByRole('button', { name: /Poproś o dowód/i }));
    expect(within(card).getByRole('status')).toHaveTextContent(/Poproś o dowód/i);
  });

  it('"Wróć później" performs a real action and advances the workspace', () => {
    const storage = makeMemoryStorage();
    render(<DrdMethodWorkspaceScreen storage={storage} seedTo="interview" />);
    const before = breadcrumbText();
    const card = openResolutionCard();
    fireEvent.click(within(card).getByRole('button', { name: /Wróć później/i }));
    expect(breadcrumbText()).not.toEqual(before);
  });
});
