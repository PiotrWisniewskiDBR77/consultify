import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { afterEach, describe, expect, it } from 'vitest';

import {
  deleteSelectedNotebookBlock,
  duplicateSelectedNotebookBlock,
  moveSelectedNotebookBlock,
} from '../SlashMenu';

let editor: Editor | null = null;

function makeEditor() {
  editor = new Editor({
    extensions: [StarterKit],
    content: '<p>One</p><p>Two</p><p>Three</p>',
  });
  return editor;
}

function blockTexts(instance: Editor) {
  return (
    instance.getJSON().content?.map((node) => {
      const firstChild = node.content?.[0];
      return firstChild && 'text' in firstChild ? firstChild.text || '' : '';
    }) ?? []
  );
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe('Notebook contextual block lifecycle', () => {
  it('duplicates the selected top-level block as one undoable transaction', () => {
    const instance = makeEditor();
    instance.commands.setTextSelection(1);
    expect(duplicateSelectedNotebookBlock(instance)).toBe(true);
    expect(blockTexts(instance)).toEqual(['One', 'One', 'Two', 'Three']);
    expect(instance.commands.undo()).toBe(true);
    expect(blockTexts(instance)).toEqual(['One', 'Two', 'Three']);
  });

  it('moves a block up and down while preserving its content', () => {
    const instance = makeEditor();
    instance.commands.setTextSelection(6);
    expect(moveSelectedNotebookBlock(instance, 'up')).toBe(true);
    expect(blockTexts(instance)).toEqual(['Two', 'One', 'Three']);
    expect(moveSelectedNotebookBlock(instance, 'down')).toBe(true);
    expect(blockTexts(instance)).toEqual(['One', 'Two', 'Three']);
  });

  it('fails closed at document boundaries and deletes with Undo available', () => {
    const instance = makeEditor();
    instance.commands.setTextSelection(1);
    expect(moveSelectedNotebookBlock(instance, 'up')).toBe(false);
    expect(deleteSelectedNotebookBlock(instance)).toBe(true);
    expect(blockTexts(instance)).toEqual(['Two', 'Three']);
    expect(instance.commands.undo()).toBe(true);
    expect(blockTexts(instance)).toEqual(['One', 'Two', 'Three']);
  });
});
