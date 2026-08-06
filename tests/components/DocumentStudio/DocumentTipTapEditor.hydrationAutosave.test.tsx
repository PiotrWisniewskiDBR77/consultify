import { act, render } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const saveMock = vi.fn();
let editorOptions: any;

vi.mock('@tiptap/react', () => ({
  EditorContent: () => <div data-testid="editor" />,
  useEditor: (options: any) => {
    editorOptions = options;
    return {
      setEditable: vi.fn(),
      getJSON: () => ({ type: 'doc', content: [] }),
      commands: { setContent: vi.fn() },
    };
  },
}));

vi.mock('@/components/DocumentStudio/api', () => ({
  DocumentManualSaveConflictError: class extends Error {},
  getDocumentStudioArtifact: vi.fn(),
  saveDocumentStudioManualContent: (...args: unknown[]) => saveMock(...args),
}));

vi.mock('@/components/DocumentStudio/inline-ai', () => ({
  DocumentInlineAIMenu: () => null,
}));

vi.mock('@/components/DocumentStudio/editor/documentEditorExtensions', () => ({
  getDocumentEditorExtensions: () => [],
}));

vi.mock('@/components/DocumentStudio/editor/schemaToTipTap', () => ({
  schemaToProseMirror: () => ({ type: 'doc', content: [] }),
}));

vi.mock('@/components/DocumentStudio/editor/tipTapToSchema', () => ({
  proseMirrorToSchema: (_doc: unknown, schema: unknown) => schema,
}));

import { DocumentTipTapEditor } from '@/components/DocumentStudio/editor/DocumentTipTapEditor';

describe('DocumentTipTapEditor hydration autosave boundary', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    saveMock.mockReset().mockResolvedValue({});
    editorOptions = undefined;
  });

  it('does not PUT when TipTap emits an initialization update, but still saves after a user gesture', async () => {
    const schema = {
      artifactId: 'artifact-canonical',
      title: 'Canonical',
      updatedAt: '2026-08-06T12:00:00.000Z',
      sections: [],
    } as any;
    render(<DocumentTipTapEditor schema={schema} artifactId="artifact-canonical" />);

    editorOptions.onUpdate({ editor: { getJSON: () => ({ type: 'doc', content: [] }) } });
    await act(async () => vi.advanceTimersByTimeAsync(600));
    expect(saveMock).not.toHaveBeenCalled();

    editorOptions.editorProps.handleDOMEvents.beforeinput();
    editorOptions.onUpdate({ editor: { getJSON: () => ({ type: 'doc', content: [] }) } });
    await act(async () => vi.advanceTimersByTimeAsync(600));
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(saveMock).toHaveBeenCalledWith('artifact-canonical', {
      sections: [],
      expectedVersion: '2026-08-06T12:00:00.000Z',
    });
  });
});
