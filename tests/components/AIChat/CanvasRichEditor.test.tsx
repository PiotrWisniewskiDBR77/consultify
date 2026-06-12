/**
 * Component-render coverage for the Canvas rich editor (TipTap).
 *
 * Renders the real headless TipTap editor in jsdom (same approach the
 * canvasDiffOps unit tests use to construct a live Editor). Covers:
 *  - markdown → rich HTML round-trip on load
 *  - the formatting toolbar renders with its accessible (title) controls
 *  - editing fires the debounced onContentChange with markdown
 *  - editable={false} renders a non-editable editor
 *  - selecting text surfaces the CanvasAIFloatingMenu (see jsdom note below)
 */

import type { Editor } from '@tiptap/core';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CanvasRichEditor } from '../../../src/components/AIChat/CanvasEditor/CanvasRichEditor';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('CanvasRichEditor', () => {
  it('renders markdown content as rich HTML (heading + bold)', async () => {
    const { container } = render(
      <CanvasRichEditor
        contentMd={'# Heading\n\nSome **bold** text'}
        onContentChange={vi.fn()}
      />
    );

    // The TipTap editor mounts asynchronously; wait for the ProseMirror surface.
    await waitFor(() => {
      expect(container.querySelector('.ProseMirror')).toBeTruthy();
    });

    const editorRoot = container.querySelector('.ProseMirror') as HTMLElement;
    const heading = editorRoot.querySelector('h1');
    expect(heading).toBeTruthy();
    expect(heading?.textContent).toContain('Heading');

    const strong = editorRoot.querySelector('strong');
    expect(strong).toBeTruthy();
    expect(strong?.textContent).toBe('bold');
  });

  it('renders the formatting toolbar with accessible controls', async () => {
    render(<CanvasRichEditor contentMd={'plain text'} onContentChange={vi.fn()} />);

    // Toolbar buttons expose accessible names via the `title` attribute.
    expect(await screen.findByTitle('Bold (Ctrl+B)')).toBeInTheDocument();
    expect(screen.getByTitle('Italic (Ctrl+I)')).toBeInTheDocument();
    expect(screen.getByTitle('Heading 1')).toBeInTheDocument();
    expect(screen.getByTitle('Heading 2')).toBeInTheDocument();
    expect(screen.getByTitle('Bullet list')).toBeInTheDocument();
    expect(screen.getByTitle('Insert table')).toBeInTheDocument();
  });

  it('fires onContentChange with markdown after the debounce when the document changes', async () => {
    vi.useFakeTimers();
    const onContentChange = vi.fn();
    let editor: Editor | null = null;

    render(
      <CanvasRichEditor
        contentMd={'Start'}
        onContentChange={onContentChange}
        onEditorReady={(ed) => {
          editor = ed;
        }}
      />
    );

    // Flush the async editor-mount effect under fake timers.
    await vi.waitFor(() => {
      expect(editor).not.toBeNull();
    });

    // Programmatic edit: append a paragraph. This triggers onUpdate → debounced save.
    editor!.commands.insertContentAt(editor!.state.doc.content.size, '<p>Appended line</p>');

    // Debounce is SAVE_DEBOUNCE_MS (300ms); nothing should have fired yet.
    expect(onContentChange).not.toHaveBeenCalled();

    vi.advanceTimersByTime(350);

    expect(onContentChange).toHaveBeenCalledTimes(1);
    const md = onContentChange.mock.calls[0][0] as string;
    expect(typeof md).toBe('string');
    expect(md).toContain('Start');
    expect(md).toContain('Appended line');
  });

  it('renders read-only when editable={false}', async () => {
    let editor: Editor | null = null;
    const { container } = render(
      <CanvasRichEditor
        contentMd={'# Read only'}
        onContentChange={vi.fn()}
        editable={false}
        onEditorReady={(ed) => {
          editor = ed;
        }}
      />
    );

    await waitFor(() => {
      expect(editor).not.toBeNull();
    });

    expect(editor!.isEditable).toBe(false);
    const editorRoot = container.querySelector('.ProseMirror') as HTMLElement;
    expect(editorRoot.getAttribute('contenteditable')).toBe('false');
  });

  it('surfaces the AI floating menu when text is selected', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    let editor: Editor | null = null;

    render(
      <CanvasRichEditor
        contentMd={'The quick brown fox'}
        onContentChange={vi.fn()}
        onSelectionChange={onSelectionChange}
        onEditorReady={(ed) => {
          editor = ed;
        }}
      />
    );

    await waitFor(() => {
      expect(editor).not.toBeNull();
    });

    // The floating menu positions itself from window.getSelection()'s
    // getBoundingClientRect(), which returns a zero rect in jsdom — that path
    // bails out and the menu stays hidden. Stub a non-zero rect so the menu
    // mounts. (We do NOT touch editor.view.coordsAtPos; this component derives
    // position from the DOM Range, not from coordsAtPos.)
    const realGetSelection = window.getSelection.bind(window);
    vi.spyOn(window, 'getSelection').mockImplementation(() => {
      const sel = realGetSelection();
      if (sel) {
        sel.getRangeAt = () =>
          ({
            getBoundingClientRect: () => ({
              top: 100,
              left: 100,
              width: 50,
              height: 16,
              right: 150,
              bottom: 116,
              x: 100,
              y: 100,
              toJSON: () => ({}),
            }),
          }) as unknown as Range;
        Object.defineProperty(sel, 'rangeCount', { configurable: true, get: () => 1 });
      }
      return sel;
    });

    // Select "quick brown" inside the single paragraph. Positions account for
    // the leading paragraph open token (+1), matching the canvasDiffOps tests.
    // Wrapped in act() because the selection drives React state (the menu).
    act(() => {
      editor!.commands.setTextSelection({ from: 5, to: 16 });
    });

    // onSelectionChange should report the selected text.
    await waitFor(() => {
      expect(onSelectionChange).toHaveBeenCalled();
    });
    const lastSel = onSelectionChange.mock.calls.at(-1)?.[0];
    expect(lastSel?.selectedText).toContain('quick');

    // The floating menu's "Ask AI" trigger should appear.
    expect(await screen.findByTitle('Ask Teresa')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ask AI/i })).toBeInTheDocument();

    // Opening Quick actions reveals the preset prompts. "Final polish" is a
    // dropdown-only preset (the inline toolbar has its own Expand/Shorten
    // buttons), so it unambiguously proves the Quick actions panel opened.
    await user.click(screen.getByRole('button', { name: /Actions/i }));
    expect(await screen.findByRole('button', { name: 'Final polish' })).toBeInTheDocument();
  });
});
