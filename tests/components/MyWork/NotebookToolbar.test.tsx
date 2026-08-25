import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const i18nState = vi.hoisted(() => ({ language: 'en' }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: i18nState,
    t: (k: string, fallback?: string) => {
      if (fallback) return fallback;
      const en: Record<string, string> = {
        'myWorkNotebook.toolbar.undo': 'Undo',
        'myWorkNotebook.toolbar.redo': 'Redo',
        'myWorkNotebook.toolbar.bold': 'Bold (Ctrl+B)',
        'myWorkNotebook.toolbar.italic': 'Italic (Ctrl+I)',
        'myWorkNotebook.toolbar.heading1': 'Heading 1',
        'myWorkNotebook.toolbar.bulletList': 'Bullet list',
        'myWorkNotebook.toolbar.alignCenter': 'Align center',
        'myWorkNotebook.toolbar.link': 'Link (Ctrl+K)',
      };
      if (i18nState.language === 'pl' && k === 'myWorkNotebook.toolbar.bold') {
        return 'Pogrubienie (Ctrl+B)';
      }
      return en[k] ?? k;
    },
  }),
}));

import { NotebookToolbar } from '@/components/MyWork/notebook/NotebookToolbar';

function makeEditor(opts: { canUndo?: boolean; canRedo?: boolean; active?: string } = {}) {
  const chain: any = {};
  const methods = [
    'focus',
    'undo',
    'redo',
    'toggleBold',
    'toggleItalic',
    'toggleUnderline',
    'toggleStrike',
    'toggleHighlight',
    'toggleCode',
    'extendMarkRange',
    'setLink',
    'unsetLink',
    'setTextAlign',
    'toggleHeading',
    'toggleBulletList',
    'toggleOrderedList',
    'toggleTaskList',
    'toggleBlockquote',
    'clearNodes',
    'unsetAllMarks',
  ];
  methods.forEach((m) => (chain[m] = vi.fn(() => chain)));
  chain.run = vi.fn();
  return {
    _chain: chain,
    chain: () => chain,
    can: () => ({ undo: () => opts.canUndo ?? true, redo: () => opts.canRedo ?? true }),
    isActive: vi.fn((name: any) => name === opts.active),
    getAttributes: vi.fn(() => ({})),
  } as any;
}

describe('NotebookToolbar', () => {
  beforeEach(() => {
    i18nState.language = 'en';
  });

  it('renders the core formatting controls', () => {
    render(<NotebookToolbar editor={makeEditor()} />);
    expect(screen.getByRole('toolbar', { name: 'Note formatting' })).toHaveClass(
      'max-w-full',
      'overflow-x-auto'
    );
    expect(screen.getByTitle('Bold (Ctrl+B)')).toBeInTheDocument();
    expect(screen.getByTitle('Italic (Ctrl+I)')).toBeInTheDocument();
    expect(screen.getByTitle('Heading 1')).toBeInTheDocument();
    expect(screen.getByTitle('Bullet list')).toBeInTheDocument();
    expect(screen.getByTitle('Undo')).toBeInTheDocument();
  });

  it('invokes toggleBold through the editor chain on click', () => {
    const editor = makeEditor();
    render(<NotebookToolbar editor={editor} />);
    fireEvent.click(screen.getByTitle('Bold (Ctrl+B)'));
    expect(screen.getByRole('button', { name: 'Bold (Ctrl+B)' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(editor._chain.toggleBold).toHaveBeenCalled();
    expect(editor._chain.run).toHaveBeenCalled();
  });

  it('invokes toggleHeading level 1 for the H1 button', () => {
    const editor = makeEditor();
    render(<NotebookToolbar editor={editor} />);
    fireEvent.click(screen.getByTitle('Heading 1'));
    expect(editor._chain.toggleHeading).toHaveBeenCalledWith({ level: 1 });
  });

  it('invokes setTextAlign for alignment buttons', () => {
    const editor = makeEditor();
    render(<NotebookToolbar editor={editor} />);
    fireEvent.click(screen.getByTitle('Align center'));
    expect(editor._chain.setTextAlign).toHaveBeenCalledWith('center');
  });

  it('disables Undo when the editor cannot undo', () => {
    render(<NotebookToolbar editor={makeEditor({ canUndo: false })} />);
    expect(screen.getByTitle('Undo')).toBeDisabled();
  });

  it('prompts for a URL and sets the link', () => {
    const editor = makeEditor();
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('https://example.com');
    render(<NotebookToolbar editor={editor} />);
    fireEvent.click(screen.getByTitle('Link (Ctrl+K)'));
    expect(editor._chain.setLink).toHaveBeenCalledWith({ href: 'https://example.com' });
    promptSpy.mockRestore();
  });

  it('unsets the link when the prompt returns empty', () => {
    const editor = makeEditor();
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('');
    render(<NotebookToolbar editor={editor} />);
    fireEvent.click(screen.getByTitle('Link (Ctrl+K)'));
    expect(editor._chain.unsetLink).toHaveBeenCalled();
    promptSpy.mockRestore();
  });

  it('renders Polish tooltips when language is pl', () => {
    i18nState.language = 'pl';
    render(<NotebookToolbar editor={makeEditor()} />);
    expect(screen.getByTitle('Pogrubienie (Ctrl+B)')).toBeInTheDocument();
  });
});
