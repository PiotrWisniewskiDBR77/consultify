/**
 * @vitest-environment jsdom
 *
 * CB-01 — the Notebook sidebar header's back-to-library and new-page
 * buttons, extracted from NotebookContent so they can be mounted directly
 * instead of the whole notebook editor (which pulls in tiptap and OOMs
 * jsdom on mount). Verifies accessible names, focusability, and that
 * clicking each button invokes its callback — in both EN and real PL.
 *
 * DEC-405c (ZLECENIE 1.1-J2, przejście właściciela 06.09) — labels updated:
 *   label26 "Wszystkie notatniki"/"All notebooks" → "Wróć do notatników"/
 *     "Back to notebooks" (action-style, matches the owner's requested
 *     tooltip wording instead of a destination name).
 *   myWork.notebook.new "Nowa strona"/"New page" → "Nowa notatka"/"New note".
 *   The search-all-notebooks button's own tooltip/aria-label moved off the
 *   shared `notebook.notebookContent.searchAllNotebooks` key (that key is
 *   also the NotebookSearchDialog's own heading — renaming it there would
 *   have mislabelled a different, unrelated screen) onto a new
 *   `searchNotesButtonTooltip` key ("Szukaj w notatkach"/"Search notes"),
 *   scoped to just this button. `onClick` behaviour (opens the cross-
 *   notebook search dialog) is unchanged.
 * [ODMROZENIE 07_MY_WORK_AGENT DEC-397]
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createRealT } from '@/test-utils/realTranslations';

function mockI18n(lang: 'en' | 'pl') {
  const t = createRealT(lang);
  vi.doMock('react-i18next', () => ({
    useTranslation: () => ({ t, i18n: { language: lang } }),
  }));
}

let NotebookHeaderActionsImport: typeof import('../NotebookHeaderActions');

const mountWithLang = async (
  lang: 'en' | 'pl',
  props: { onBack?: () => void; onNewPage: () => void; onSearchAllNotebooks?: () => void }
) => {
  vi.resetModules();
  mockI18n(lang);
  NotebookHeaderActionsImport = await import('../NotebookHeaderActions');
  const { NotebookHeaderActions } = NotebookHeaderActionsImport;
  return render(<NotebookHeaderActions {...props} />);
};

beforeEach(() => {
  vi.resetModules();
});

describe('NotebookHeaderActions — accessible contract (EN)', () => {
  it('names the back-to-library button and it is focusable', async () => {
    await mountWithLang('en', { onBack: vi.fn(), onNewPage: vi.fn() });

    // Real EN string: notebook.notebookContent.label26 = "Back to notebooks"
    const back = screen.getByRole('button', { name: 'Back to notebooks' });
    expect(back).toBeInTheDocument();
    back.focus();
    expect(back).toHaveFocus();
  });

  it('names the new-page button and it is focusable', async () => {
    await mountWithLang('en', { onBack: vi.fn(), onNewPage: vi.fn() });

    // Real EN string: myWork.notebook.new = "New note"
    const newPage = screen.getByRole('button', { name: 'New note' });
    expect(newPage).toBeInTheDocument();
    newPage.focus();
    expect(newPage).toHaveFocus();
  });

  it('invokes onBack when the back-to-library button is activated', async () => {
    const onBack = vi.fn();
    await mountWithLang('en', { onBack, onNewPage: vi.fn() });

    fireEvent.click(screen.getByRole('button', { name: 'Back to notebooks' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('invokes onNewPage when the new-page button is activated', async () => {
    const onNewPage = vi.fn();
    await mountWithLang('en', { onBack: vi.fn(), onNewPage });

    fireEvent.click(screen.getByRole('button', { name: 'New note' }));

    expect(onNewPage).toHaveBeenCalledTimes(1);
  });

  it('renders no back-to-library button when onBack is not provided', async () => {
    await mountWithLang('en', { onNewPage: vi.fn() });

    expect(screen.queryByRole('button', { name: 'Back to notebooks' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New note' })).toBeInTheDocument();
  });

  // MYW-NBK-004
  it('renders no search-all-notebooks button when onSearchAllNotebooks is not provided', async () => {
    await mountWithLang('en', { onNewPage: vi.fn() });

    expect(screen.queryByRole('button', { name: 'Search notes' })).not.toBeInTheDocument();
  });

  it('names the search-all-notebooks button, it is focusable, and invokes the callback', async () => {
    const onSearchAllNotebooks = vi.fn();
    await mountWithLang('en', { onNewPage: vi.fn(), onSearchAllNotebooks });

    const search = screen.getByRole('button', { name: 'Search notes' });
    expect(search).toBeInTheDocument();
    search.focus();
    expect(search).toHaveFocus();

    fireEvent.click(search);
    expect(onSearchAllNotebooks).toHaveBeenCalledTimes(1);
  });

  // DEC-405c — the empty-tooltip bug (owner: "nad przyciskami wstecz/+/lupa
  // pojawia się pusty dymek") was the tooltip's default above-trigger
  // placement getting clipped by the sidebar's overflow-hidden ancestor, not
  // missing text — but a real regression test still needs to catch a
  // genuinely empty tooltip body (e.g. someone deleting the `t()` call's
  // children by mistake), so this asserts each of the three tooltips has
  // non-empty text once opened (mouseEnter), matching what the mutation
  // "delete the fallback string" must turn RED.
  it('shows non-empty tooltip text for all three header buttons on hover', async () => {
    await mountWithLang('en', {
      onBack: vi.fn(),
      onNewPage: vi.fn(),
      onSearchAllNotebooks: vi.fn(),
    });

    for (const testId of [
      'notebook-back-to-library',
      'notebook-new-page-button',
      'notebook-search-all-button',
    ]) {
      const button = screen.getByTestId(testId);
      fireEvent.mouseEnter(button);
      // The tooltip content sits as a sibling of the trigger inside the same
      // `.relative.inline-block` Tooltip wrapper.
      const tooltipBubble = button.parentElement?.querySelector('.absolute.z-dropdown');
      expect(tooltipBubble).toBeTruthy();
      expect(tooltipBubble?.textContent?.trim()).not.toBe('');
      fireEvent.mouseLeave(button);
    }
  });
});

describe('NotebookHeaderActions — accessible contract (real PL)', () => {
  it('names both buttons in real Polish, not English fallback', async () => {
    await mountWithLang('pl', { onBack: vi.fn(), onNewPage: vi.fn() });

    // Real PL strings: label26 = "Wróć do notatników", myWork.notebook.new = "Nowa notatka"
    expect(screen.getByRole('button', { name: 'Wróć do notatników' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nowa notatka' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back to notebooks' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New note' })).not.toBeInTheDocument();
  });

  it('invokes the real-Polish-labelled callbacks on activation', async () => {
    const onBack = vi.fn();
    const onNewPage = vi.fn();
    await mountWithLang('pl', { onBack, onNewPage });

    fireEvent.click(screen.getByRole('button', { name: 'Wróć do notatników' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nowa notatka' }));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onNewPage).toHaveBeenCalledTimes(1);
  });

  // MYW-NBK-004 / DEC-405c — real PL string: searchNotesButtonTooltip = "Szukaj w notatkach"
  it('names and invokes the search-all-notebooks button in real Polish', async () => {
    const onSearchAllNotebooks = vi.fn();
    await mountWithLang('pl', { onNewPage: vi.fn(), onSearchAllNotebooks });

    const search = screen.getByRole('button', { name: 'Szukaj w notatkach' });
    expect(search).toBeInTheDocument();

    fireEvent.click(search);
    expect(onSearchAllNotebooks).toHaveBeenCalledTimes(1);
  });

  // DEC-405c — same non-empty-tooltip guard as the EN describe block, in the
  // real PL strings.
  it('shows non-empty PL tooltip text for all three header buttons on hover', async () => {
    await mountWithLang('pl', {
      onBack: vi.fn(),
      onNewPage: vi.fn(),
      onSearchAllNotebooks: vi.fn(),
    });

    for (const testId of [
      'notebook-back-to-library',
      'notebook-new-page-button',
      'notebook-search-all-button',
    ]) {
      const button = screen.getByTestId(testId);
      fireEvent.mouseEnter(button);
      const tooltipBubble = button.parentElement?.querySelector('.absolute.z-dropdown');
      expect(tooltipBubble).toBeTruthy();
      expect(tooltipBubble?.textContent?.trim()).not.toBe('');
      fireEvent.mouseLeave(button);
    }
  });
});
