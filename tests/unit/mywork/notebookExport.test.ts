import { describe, expect, it, vi } from 'vitest';

import {
  buildNotebookMarkdown,
  buildNotebookPrintHtml,
  exportNotebookPage,
  type NotebookExportPage,
} from '@/utils/notebookExport';

const page: NotebookExportPage = {
  id: 'p1',
  title: 'Q2 Strategy',
  contentText: 'Objective: enter 3 verticals\n- Manufacturing\n- Logistics',
  contentJson: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Goals' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Ship by Q2.' }] },
    ],
  },
};

describe('notebookExport — Markdown builder', () => {
  it('prefixes the title as an H1 and renders the body', () => {
    const md = buildNotebookMarkdown(page);
    expect(md.startsWith('# Q2 Strategy')).toBe(true);
    expect(md).toContain('Goals');
    expect(md).toContain('Ship by Q2.');
    expect(md.endsWith('\n')).toBe(true);
  });

  it('falls back to "Untitled note" when the title is empty', () => {
    const md = buildNotebookMarkdown({ ...page, title: '   ' });
    expect(md.startsWith('# Untitled note')).toBe(true);
  });

  it('uses contentText when contentJson is missing', () => {
    const md = buildNotebookMarkdown({ title: 'Plain', contentJson: undefined, contentText: 'just text' });
    expect(md).toContain('just text');
  });
});

describe('notebookExport — print HTML builder', () => {
  it('produces a full HTML doc with the title and escaped content', () => {
    const html = buildNotebookPrintHtml({ title: 'A & B <x>', contentText: 'line', contentJson: undefined });
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('A &amp; B &lt;x&gt;');
    expect(html).toContain('<body>');
  });

  it('renders markdown headings as <h*> and bullets as <li>', () => {
    const html = buildNotebookPrintHtml({
      title: 'T',
      contentText: undefined,
      contentJson: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Head' }] },
          { type: 'bulletList', content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one' }] }] },
          ] },
        ],
      },
    });
    expect(html).toMatch(/<h1>Head<\/h1>/);
    expect(html).toMatch(/<li>one<\/li>/);
  });
});

describe('notebookExport — dispatch', () => {
  it('markdown format triggers a blob download (jsdom-safe, no throw)', async () => {
    const createEl = vi.spyOn(document, 'createElement');
    await expect(exportNotebookPage(page, 'markdown')).resolves.toBeUndefined();
    expect(createEl).toHaveBeenCalledWith('a');
    createEl.mockRestore();
  });

  it('unknown format degrades to markdown without throwing', async () => {
    await expect(exportNotebookPage(page, 'totally-unknown' as any)).resolves.toBeUndefined();
  });
});
