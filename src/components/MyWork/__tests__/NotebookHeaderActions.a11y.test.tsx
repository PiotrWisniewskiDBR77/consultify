/**
 * @vitest-environment jsdom
 *
 * CB-01 — the Notebook sidebar header's back-to-library and new-page
 * buttons, extracted from NotebookContent so they can be mounted directly
 * instead of the whole notebook editor (which pulls in tiptap and OOMs
 * jsdom on mount). Verifies accessible names, focusability, and that
 * clicking each button invokes its callback — in both EN and real PL.
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
  props: { onBack?: () => void; onNewPage: () => void }
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

    // Real EN string: notebook.notebookContent.label26 = "All notebooks"
    const back = screen.getByRole('button', { name: 'All notebooks' });
    expect(back).toBeInTheDocument();
    back.focus();
    expect(back).toHaveFocus();
  });

  it('names the new-page button and it is focusable', async () => {
    await mountWithLang('en', { onBack: vi.fn(), onNewPage: vi.fn() });

    // Real EN string: myWork.notebook.new = "New page"
    const newPage = screen.getByRole('button', { name: 'New page' });
    expect(newPage).toBeInTheDocument();
    newPage.focus();
    expect(newPage).toHaveFocus();
  });

  it('invokes onBack when the back-to-library button is activated', async () => {
    const onBack = vi.fn();
    await mountWithLang('en', { onBack, onNewPage: vi.fn() });

    fireEvent.click(screen.getByRole('button', { name: 'All notebooks' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('invokes onNewPage when the new-page button is activated', async () => {
    const onNewPage = vi.fn();
    await mountWithLang('en', { onBack: vi.fn(), onNewPage });

    fireEvent.click(screen.getByRole('button', { name: 'New page' }));

    expect(onNewPage).toHaveBeenCalledTimes(1);
  });

  it('renders no back-to-library button when onBack is not provided', async () => {
    await mountWithLang('en', { onNewPage: vi.fn() });

    expect(screen.queryByRole('button', { name: 'All notebooks' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New page' })).toBeInTheDocument();
  });
});

describe('NotebookHeaderActions — accessible contract (real PL)', () => {
  it('names both buttons in real Polish, not English fallback', async () => {
    await mountWithLang('pl', { onBack: vi.fn(), onNewPage: vi.fn() });

    // Real PL strings: label26 = "Wszystkie notatniki", myWork.notebook.new = "Nowa strona"
    expect(screen.getByRole('button', { name: 'Wszystkie notatniki' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nowa strona' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'All notebooks' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New page' })).not.toBeInTheDocument();
  });

  it('invokes the real-Polish-labelled callbacks on activation', async () => {
    const onBack = vi.fn();
    const onNewPage = vi.fn();
    await mountWithLang('pl', { onBack, onNewPage });

    fireEvent.click(screen.getByRole('button', { name: 'Wszystkie notatniki' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nowa strona' }));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onNewPage).toHaveBeenCalledTimes(1);
  });
});
