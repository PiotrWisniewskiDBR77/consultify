import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';

import { getDocumentEditorExtensions } from '@/components/DocumentStudio/editor/documentEditorExtensions';

describe('Document Studio editor schema', () => {
  it('does not allow keyboard-applied rich marks on structural section titles', () => {
    const editor = new Editor({
      extensions: getDocumentEditorExtensions(),
      content: {
        type: 'doc',
        content: [
          {
            type: 'docSection',
            attrs: { sectionId: 'sec-1', level: 1, orderIndex: 0 },
            content: [{ type: 'text', text: 'Protected section' }],
          },
          { type: 'paragraph', content: [{ type: 'text', text: 'Editable body' }] },
        ],
      },
    });

    editor.chain().setTextSelection({ from: 1, to: 18 }).toggleBold().run();

    expect(editor.getJSON().content?.[0]?.content?.[0]?.marks).toBeUndefined();
    editor.destroy();
  });
});
