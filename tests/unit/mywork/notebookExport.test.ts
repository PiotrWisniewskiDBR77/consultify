import { describe, expect, it, vi } from 'vitest';

import {
  buildNotebookMarkdown,
  buildNotebookPrintHtml,
  exportNotebookPage,
  parseInlineMarkdown,
  stripInlineMarkdown,
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

describe('notebookExport — inline markdown parser (no raw markers in exports)', () => {
  it('parses bold, italic and inline code into styled segments', () => {
    const segs = parseInlineMarkdown('Ship **now** with _care_ and `code`.');
    const bold = segs.find((s) => s.bold);
    const italic = segs.find((s) => s.italic);
    const code = segs.find((s) => s.code);
    expect(bold?.text).toBe('now');
    expect(italic?.text).toBe('care');
    expect(code?.text).toBe('code');
    // No literal markdown markers survive in any segment text.
    expect(segs.some((s) => /[*`_]/.test(s.text))).toBe(false);
  });

  it('resolves links to "label (url)"', () => {
    const flat = stripInlineMarkdown('See [the deck](https://x.io/d).');
    expect(flat).toBe('See the deck (https://x.io/d).');
    expect(flat).not.toContain('](');
  });

  it('strips all markers when flattened to plain text', () => {
    expect(stripInlineMarkdown('**A** *b* `c`')).toBe('A b c');
  });

  it('handles plain text with no markers as a single segment', () => {
    const segs = parseInlineMarkdown('just words');
    expect(segs).toEqual([{ text: 'just words' }]);
  });
});

describe('notebookExport — print HTML renders inline emphasis (not raw markdown)', () => {
  it('emits <strong>/<em>/<code> and never shows literal ** or backticks', () => {
    const html = buildNotebookPrintHtml({
      title: 'T',
      contentText: 'Do **this** and `that` per [spec](https://s.io).',
      contentJson: undefined,
    });
    expect(html).toContain('<strong>this</strong>');
    expect(html).toContain('<code>that</code>');
    expect(html).toContain('spec (https://s.io)');
    // The literal bold marker must not leak into the rendered output.
    expect(html).not.toContain('**this**');
  });

  it('renders ordered-list markdown as <ol><li>', () => {
    const html = buildNotebookPrintHtml({
      title: 'T',
      contentText: '1. first\n2. second',
      contentJson: undefined,
    });
    expect(html).toMatch(/<ol>/);
    expect(html).toMatch(/<li>first<\/li>/);
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
