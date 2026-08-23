import { fireEvent, render, screen } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
import StarterKit from '@tiptap/starter-kit';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CalloutNode, DetailsContentNode, DetailsNode, DetailsSummaryNode } from '../extensions';
import { SlashMenu } from '../SlashMenu';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'en' } }),
}));

let editor: Editor | null = null;
const containerRef = { current: document.createElement('div') };

function renderContext(instance: Editor) {
  return render(
    <SlashMenu
      editor={instance as any}
      state={{
        open: true,
        query: '',
        triggerPos: instance.state.selection.from,
        coords: { top: 0, left: 0 },
        mode: 'context',
      }}
      onClose={vi.fn()}
      containerRef={containerRef}
    />
  );
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe('Notebook block-specific configuration', () => {
  it('shows only callout configuration and persists the selected semantic variant', () => {
    editor = new Editor({
      extensions: [StarterKit, CalloutNode],
      content: {
        type: 'doc',
        content: [
          {
            type: 'callout',
            attrs: { variant: 'info' },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Evidence' }] }],
          },
        ],
      },
    });
    editor.commands.setTextSelection(2);
    renderContext(editor);
    expect(screen.queryByRole('button', { name: /Table: Add row below/ })).not.toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('menuitem', { name: /Callout: Success/ }));
    expect(editor.getJSON().content?.[0]?.attrs?.variant).toBe('success');
  });

  it('configures the default open state of a Toggle block', () => {
    editor = new Editor({
      extensions: [StarterKit, DetailsNode, DetailsSummaryNode, DetailsContentNode],
      content: {
        type: 'doc',
        content: [
          {
            type: 'details',
            attrs: { open: true },
            content: [
              { type: 'detailsSummary', content: [{ type: 'text', text: 'Summary' }] },
              { type: 'detailsContent', content: [{ type: 'paragraph' }] },
            ],
          },
        ],
      },
    });
    editor.commands.setTextSelection(2);
    renderContext(editor);
    fireEvent.mouseDown(screen.getByRole('menuitem', { name: /Toggle: Collapsed/ }));
    expect(editor.getJSON().content?.[0]?.attrs?.open).toBe(false);
  });

  it('extends the current table from contextual row and column actions', () => {
    editor = new Editor({
      extensions: [
        StarterKit,
        Table.configure({ resizable: false }),
        TableRow,
        TableHeader,
        TableCell,
      ],
      content: '<table><tbody><tr><td><p>A</p></td></tr></tbody></table>',
    });
    let textPosition = 1;
    editor.state.doc.descendants((node, pos) => {
      if (node.isTextblock) {
        textPosition = pos + 1;
        return false;
      }
      return true;
    });
    editor.commands.setTextSelection(textPosition);
    renderContext(editor);
    fireEvent.mouseDown(screen.getByRole('menuitem', { name: /Table: Add row below/ }));
    expect(editor.getJSON().content?.[0]?.content).toHaveLength(2);
  });
});
