import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const saveMock = vi.fn();
let editorOptions: any;
let currentEditor: any;
let lastInsertedContent: any;

vi.mock('@tiptap/react', () => ({
  Extension: { create: (config: unknown) => config },
  EditorContent: () => <div data-testid="editor" />,
  useEditor: (options: any) => {
    editorOptions = options;
    const editor: any = {
      setEditable: vi.fn(),
      getJSON: () => ({ type: 'doc', content: [] }),
      commands: { setContent: vi.fn() },
      isActive: vi.fn(() => false),
      getAttributes: vi.fn(() => ({})),
      state: {
        tr: { setMeta: vi.fn(function () { return this; }) },
        selection: { from: 0, to: 0 },
        doc: { descendants: vi.fn(), nodesBetween: vi.fn() },
      },
      view: { dispatch: vi.fn() },
    };
    const chain: any = {
      focus: () => chain,
      setParagraph: () => chain,
      toggleHeading: () => chain,
      toggleBulletList: () => chain,
      toggleOrderedList: () => chain,
      toggleBold: () => chain,
      toggleItalic: () => chain,
      toggleUnderline: () => chain,
      toggleStrike: () => chain,
      toggleHighlight: () => chain,
      setTextAlign: () => chain,
      setFontSize: () => chain,
      unsetFontSize: () => chain,
      setColor: () => chain,
      updateAttributes: () => chain,
      extendMarkRange: () => chain,
      setLink: () => chain,
      unsetLink: () => chain,
      insertContent: (content: any) => {
        lastInsertedContent = content;
        return chain;
      },
      setTextSelection: () => chain,
      scrollIntoView: () => chain,
      run: () => {
        options.onUpdate({ editor });
        return true;
      },
    };
    editor.chain = () => chain;
    currentEditor = editor;
    return editor;
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
  it('gives the editable document surface an accessible name', () => {
    const schema = {
      artifactId: 'artifact-accessible-editor',
      title: 'Accessible editor',
      updatedAt: '2026-08-06T12:00:00.000Z',
      sections: [],
    } as any;
    render(<DocumentTipTapEditor schema={schema} artifactId="artifact-accessible-editor" />);

    expect(editorOptions.editorProps.attributes).toEqual(
      expect.objectContaining({ 'aria-label': 'Treść dokumentu' })
    );
  });

  beforeEach(() => {
    vi.useFakeTimers();
    saveMock.mockReset().mockResolvedValue({});
    editorOptions = undefined;
    currentEditor = undefined;
    lastInsertedContent = undefined;
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

  it('shows the manual formatting toolbar and persists a toolbar command', async () => {
    const schema = {
      artifactId: 'artifact-manual-format',
      title: 'Manual formatting',
      updatedAt: '2026-08-06T12:00:00.000Z',
      sections: [],
    } as any;
    render(<DocumentTipTapEditor schema={schema} artifactId="artifact-manual-format" />);

    expect(screen.getByRole('toolbar', { name: 'Formatowanie dokumentu' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Nagłówek 2' }));
    await act(async () => vi.advanceTimersByTimeAsync(600));

    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(saveMock).toHaveBeenCalledWith('artifact-manual-format', {
      sections: [],
      expectedVersion: '2026-08-06T12:00:00.000Z',
    });
  });

  it('inserts a canonical KPI block through the manual toolbar and arms autosave', async () => {
    const schema = {
      artifactId: 'artifact-manual-kpi',
      title: 'Manual KPI',
      updatedAt: '2026-08-06T12:00:00.000Z',
      sections: [],
    } as any;
    render(<DocumentTipTapEditor schema={schema} artifactId="artifact-manual-kpi" />);

    fireEvent.click(screen.getByRole('button', { name: 'Wstaw: KPI' }));
    const input = screen.getByRole('textbox', {
      name: 'KPI w formacie Nazwa=Wartość; Nazwa=Wartość',
    });
    fireEvent.change(input, { target: { value: 'Postęp=72%;Budżet=1,4 mln EUR' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zastosuj' }));
    await act(async () => vi.advanceTimersByTimeAsync(600));

    expect(saveMock).toHaveBeenCalledTimes(1);
  });

  it('inserts a quote with an optional citation through the manual toolbar', async () => {
    const schema = {
      artifactId: 'artifact-manual-quote',
      title: 'Manual quote',
      updatedAt: '2026-08-06T12:00:00.000Z',
      sections: [],
    } as any;
    render(<DocumentTipTapEditor schema={schema} artifactId="artifact-manual-quote" />);

    fireEvent.click(screen.getByRole('button', { name: 'Wstaw: Cytat' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Treść cytatu' }), {
      target: { value: 'Automatyzacja skróci cykl o dwa dni.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Zastosuj' }));
    const citeInput = await screen.findByRole('textbox', {
      name: 'Autor lub źródło (opcjonalnie)',
    });
    fireEvent.change(citeInput, { target: { value: 'COO' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zastosuj' }));

    await waitFor(() => expect(lastInsertedContent).toBeDefined());
    expect(lastInsertedContent).toMatchObject({
      type: 'docQuote',
      attrs: { blockType: 'quote' },
    });
    expect(JSON.parse(lastInsertedContent.attrs.payloadJson)).toEqual({
      text: 'Automatyzacja skróci cykl o dwa dni.',
      cite: 'COO',
    });
  });

  it('inserts a canonical bar chart from manually entered category/value pairs', async () => {
    const schema = {
      artifactId: 'artifact-manual-chart',
      title: 'Manual chart',
      updatedAt: '2026-08-06T12:00:00.000Z',
      sections: [],
    } as any;
    render(<DocumentTipTapEditor schema={schema} artifactId="artifact-manual-chart" />);

    fireEvent.click(screen.getByRole('button', { name: 'Wstaw: Wykres' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Tytuł wykresu' }), {
      target: { value: 'Realizacja programu' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Zastosuj' }));
    const dataInput = await screen.findByRole('textbox', {
      name: 'Dane wykresu: kategoria|wartość; kategoria|wartość',
    });
    fireEvent.change(dataInput, { target: { value: 'Plan|100;Wykonanie|72' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zastosuj' }));

    await waitFor(() => expect(lastInsertedContent).toBeDefined());
    expect(lastInsertedContent).toMatchObject({
      type: 'docChart',
      attrs: { blockType: 'chart' },
    });
    expect(JSON.parse(lastInsertedContent.attrs.payloadJson)).toEqual({
      kind: 'bar',
      title: 'Realizacja programu',
      categories: ['Plan', 'Wykonanie'],
      series: [{ label: 'Wartość', values: [100, 72] }],
    });
  });

  it('refuses a block-format command that would consume a protected section marker', async () => {
    const schema = {
      artifactId: 'artifact-section-guard',
      title: 'Guarded sections',
      updatedAt: '2026-08-06T12:00:00.000Z',
      sections: [],
    } as any;
    render(<DocumentTipTapEditor schema={schema} artifactId="artifact-section-guard" />);
    currentEditor.state.selection = { from: 0, to: 20 };
    currentEditor.state.doc.nodesBetween.mockImplementation(
      (_from: number, _to: number, callback: (node: any) => void) =>
        callback({ type: { name: 'docSection' } })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Lista punktowana' }));
    await act(async () => vi.advanceTimersByTimeAsync(600));

    expect(saveMock).not.toHaveBeenCalled();
  });

  it('uploads a real inline image with required alt text and arms autosave', async () => {
    const schema = {
      artifactId: 'artifact-image-upload',
      title: 'Image upload',
      updatedAt: '2026-08-06T12:00:00.000Z',
      sections: [],
    } as any;
    render(<DocumentTipTapEditor schema={schema} artifactId="artifact-image-upload" />);
    const input = screen.getByLabelText('Wgraj lub zmień obraz') as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [new File(['png-bytes'], 'diagram.png', { type: 'image/png' })] },
    });
    const altInput = await screen.findByRole('textbox', {
      name: 'Opis alternatywny obrazu',
    });
    fireEvent.change(altInput, { target: { value: 'Schemat procesu Nova' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zastosuj' }));
    const captionInput = await screen.findByRole('textbox', {
      name: 'Podpis obrazu (opcjonalnie)',
    });
    fireEvent.change(captionInput, { target: { value: 'Proces docelowy' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zastosuj' }));
    await act(async () => vi.advanceTimersByTimeAsync(600));

    expect(lastInsertedContent).toMatchObject({
      type: 'docImage',
      attrs: { blockType: 'image' },
    });
    const payload = JSON.parse(lastInsertedContent.attrs.payloadJson);
    expect(payload).toMatchObject({
      mimeType: 'image/png',
      alt: 'Schemat procesu Nova',
      caption: 'Proces docelowy',
    });
    expect(payload.url).toMatch(/^data:image\/png;base64,/);
    expect(payload.dataBase64.length).toBeGreaterThan(0);
    expect(saveMock).toHaveBeenCalledTimes(1);
  });
});
