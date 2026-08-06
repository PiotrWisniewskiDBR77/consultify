import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';

import {
  collapsedSectionsPluginKey,
  setCollapsedSectionsMeta,
} from '@/components/DocumentStudio/editor/collapsedSectionsExtension';
import { getDocumentEditorExtensions } from '@/components/DocumentStudio/editor/documentEditorExtensions';

const content = (body = 'Body one') => ({
  type: 'doc',
  content: [
    {
      type: 'docSection',
      attrs: { sectionId: 'sec-1', level: 1, orderIndex: 0 },
      content: [{ type: 'text', text: 'Section one' }],
    },
    { type: 'paragraph', content: [{ type: 'text', text: body }] },
    {
      type: 'docSection',
      attrs: { sectionId: 'sec-2', level: 1, orderIndex: 1 },
      content: [{ type: 'text', text: 'Section two' }],
    },
    { type: 'paragraph', content: [{ type: 'text', text: 'Body two' }] },
  ],
});

describe('collapsed section ProseMirror decorations', () => {
  it('hides only body nodes until the next section and toggles from transaction meta', () => {
    const editor = new Editor({ extensions: getDocumentEditorExtensions(), content: content() });

    editor.view.dispatch(setCollapsedSectionsMeta(editor.state.tr, new Set(['sec-1'])));

    const children = [...editor.view.dom.children] as HTMLElement[];
    expect(children[0]).not.toHaveClass('document-section-body-collapsed');
    expect(children[1]).toHaveClass('document-section-body-collapsed');
    expect(children[1]).toHaveAttribute('aria-hidden', 'true');
    expect(children[1].style.getPropertyValue('display')).toBe('none');
    expect(children[1].style.getPropertyPriority('display')).toBe('important');
    expect(children[2]).not.toHaveClass('document-section-body-collapsed');
    expect(children[3]).not.toHaveClass('document-section-body-collapsed');

    editor.view.dispatch(setCollapsedSectionsMeta(editor.state.tr, new Set()));
    expect(editor.view.dom.children[1]).not.toHaveClass('document-section-body-collapsed');
    editor.destroy();
  });

  it('rebuilds decorations after setContent and ordinary document transactions', () => {
    const editor = new Editor({ extensions: getDocumentEditorExtensions(), content: content() });
    editor.view.dispatch(setCollapsedSectionsMeta(editor.state.tr, new Set(['sec-1'])));

    editor.commands.setContent(content('Replacement body'));
    expect(editor.view.dom.children[1]).toHaveClass('document-section-body-collapsed');
    expect(editor.view.dom.children[1].textContent).toBe('Replacement body');

    editor.commands.insertContentAt(25, ' updated');
    expect(editor.view.dom.children[1]).toHaveClass('document-section-body-collapsed');
    expect(collapsedSectionsPluginKey.getState(editor.state)?.ids.has('sec-1')).toBe(true);
    editor.destroy();
  });
});
