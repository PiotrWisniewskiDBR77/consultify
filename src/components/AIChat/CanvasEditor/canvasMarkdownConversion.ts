/**
 * Markdown ↔ HTML round-trip conversion for Canvas TipTap editor.
 * Canvas stores markdown as canonical format (contentMd).
 * TipTap works with HTML internally.
 *
 * Load path:  contentMd → marked → HTML → editor.setContent(html)
 * Save path:  editor.getHTML() → Turndown → markdown → updateMarkdown(md)
 */

import { marked } from 'marked';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

let turndownInstance: TurndownService | null = null;

function getTurndown(): TurndownService {
  if (turndownInstance) return turndownInstance;

  const td = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    fence: '```',
    emDelimiter: '*',
    strongDelimiter: '**',
    linkStyle: 'inlined',
  });

  td.use(gfm);

  // Preserve task list checkboxes
  td.addRule('taskListItem', {
    filter: (node) => {
      return node.nodeName === 'LI' && node.parentElement?.getAttribute('data-type') === 'taskList';
    },
    replacement: (_content, node) => {
      const checkbox = (node as HTMLElement).querySelector('input[type="checkbox"]');
      const checked = checkbox?.hasAttribute('checked') ? 'x' : ' ';
      const text = _content.replace(/^\n+/, '').replace(/\n+$/, '');
      return `- [${checked}] ${text}\n`;
    },
  });

  // C2 — preserve formats that TipTap loads as extensions but Turndown was
  // silently dropping on every save. Round-trip is now lossless for: Highlight,
  // Underline, TextAlign (block-level), Callout (data-type=callout), Details
  // (data-type=details). The markdownToHtml side parses them back below.

  // Highlight: <mark>text</mark> → ==text== (Obsidian/Pandoc convention).
  td.addRule('highlight', {
    filter: ['mark'],
    replacement: (content) => (content ? `==${content}==` : ''),
  });

  // Underline: Markdown has no native syntax — pass through as HTML so the
  // editor restores it on load. Empty <u> is dropped.
  td.addRule('underline', {
    filter: ['u'],
    replacement: (content) => (content ? `<u>${content}</u>` : ''),
  });

  // TextAlign: paragraph/heading with style="text-align: …". Markdown lacks
  // alignment, so we emit the original HTML element verbatim. Non-default
  // alignment only — `left` is the default and skipped.
  td.addRule('textAlign', {
    filter: (node) => {
      const style = String((node as HTMLElement).getAttribute?.('style') || '');
      const align = /text-align\s*:\s*(center|right|justify)/i.exec(style)?.[1];
      return !!align && ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(node.nodeName);
    },
    replacement: (_content, node) => {
      const el = node as HTMLElement;
      return `\n\n${el.outerHTML}\n\n`;
    },
  });

  // Callout (TipTap custom node, data-type="callout"): emit a recognisable
  // fenced block we can parse back.
  td.addRule('callout', {
    filter: (node) =>
      node.nodeType === 1 && (node as HTMLElement).getAttribute('data-type') === 'callout',
    replacement: (content, node) => {
      const variant = (node as HTMLElement).getAttribute('data-variant') || 'info';
      const body = String(content || '').trim();
      return `\n\n:::callout ${variant}\n${body}\n:::\n\n`;
    },
  });

  // Details (TipTap custom node, data-type="details"): preserve the
  // collapsible block. Summary lives in the first <summary> child.
  td.addRule('details', {
    filter: (node) =>
      node.nodeType === 1 && (node as HTMLElement).getAttribute('data-type') === 'details',
    replacement: (content, node) => {
      const summary =
        (node as HTMLElement).querySelector('summary')?.textContent?.trim() || 'Details';
      // The summary appears in `content` because Turndown walked into the
      // <summary> child; strip the leading line so we don't emit it twice.
      const body = String(content || '')
        .replace(new RegExp(`^${summary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`), '')
        .trim();
      return `\n\n:::details ${summary}\n${body}\n:::\n\n`;
    },
  });

  turndownInstance = td;
  return td;
}

/**
 * Markdown → HTML parser additions: convert the round-trip conventions emitted
 * by our Turndown rules above back into the HTML shapes TipTap expects. Applied
 * AFTER `marked` so we work on already-rendered HTML.
 *
 * `==text==` → <mark>text</mark>
 * `:::callout variant\nbody\n:::` → <div data-type="callout" data-variant="variant">body</div>
 * `:::details Summary\nbody\n:::` → <details data-type="details"><summary>Summary</summary>body</details>
 * `<u>` and inline text-align HTML survive `marked` as-is.
 */
function rehydrateCanvasExtensions(html: string): string {
  let out = html;

  // Highlight: ==text== (but not inside code/pre — `marked` already
  // protected those). Avoid spans across line breaks.
  out = out.replace(/==([^=\n]+?)==/g, '<mark>$1</mark>');

  // Callout fence — multi-line block. Tolerates `:::callout warning\nbody\n:::`.
  out = out.replace(
    /:::callout\s+(\w+)\s*\n([\s\S]*?)\n:::/g,
    (_m, variant: string, body: string) =>
      `<div data-type="callout" data-variant="${variant}">${body.trim()}</div>`
  );

  // Details fence — summary is the rest of the opening line.
  out = out.replace(
    /:::details\s+([^\n]+)\n([\s\S]*?)\n:::/g,
    (_m, summary: string, body: string) =>
      `<details data-type="details"><summary>${summary.trim()}</summary>${body.trim()}</details>`
  );

  return out;
}

export function markdownToHtml(md: string): string {
  if (!md?.trim()) return '';
  const html = marked.parse(md, { async: false, gfm: true, breaks: false }) as string;
  // C2 — rehydrate the Highlight / Callout / Details fences our Turndown rules
  // emit on save, and let inline <u> / text-align HTML pass through unchanged.
  return rehydrateCanvasExtensions(html);
}

/**
 * L3 (deliverables sheet) — normalizacja tabel TipTapa przed Turndownem.
 * TipTap emituje `<table><tbody><tr><th>…` (bez `<thead>`) i owija treść komórek
 * w `<p>`. Plugin gfm Turndowna rozpoznaje tylko tabele z `<thead>`, a `<p>`
 * w komórce wstrzykuje puste linie łamiące wiersz pipe-tabeli. Bez tej
 * normalizacji KAŻDA tabela w rich-edytorze była przy autosave zapisywana jako
 * wyescapowany HTML — destrukcyjny round-trip treści.
 */
function normalizeTablesForTurndown(html: string): string {
  if (!html.includes('<table')) return html;
  if (typeof DOMParser === 'undefined') return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');

  doc.querySelectorAll('table').forEach((table) => {
    // Komórki: <p>a</p><p>b</p> → "a<br>b" (inline, bez bloków).
    table.querySelectorAll('th, td').forEach((cell) => {
      const paragraphs = Array.from(cell.querySelectorAll(':scope > p'));
      if (paragraphs.length > 0) {
        cell.innerHTML = paragraphs.map((p) => p.innerHTML).join('<br>');
      }
    });
    // Wiersz nagłówkowy z <th> w <tbody> → przenosimy do <thead>.
    if (!table.querySelector('thead')) {
      const firstRow = table.querySelector('tr');
      if (firstRow && firstRow.querySelector('th')) {
        const thead = doc.createElement('thead');
        thead.appendChild(firstRow);
        table.insertBefore(thead, table.firstChild);
      }
    }
  });

  return doc.body.innerHTML;
}

export function htmlToMarkdown(html: string): string {
  if (!html?.trim()) return '';
  const td = getTurndown();
  return td.turndown(normalizeTablesForTurndown(html)).trim();
}
