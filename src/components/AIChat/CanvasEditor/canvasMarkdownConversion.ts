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
      return (
        node.nodeName === 'LI' &&
        node.parentElement?.getAttribute('data-type') === 'taskList'
      );
    },
    replacement: (_content, node) => {
      const checkbox = (node as HTMLElement).querySelector('input[type="checkbox"]');
      const checked = checkbox?.hasAttribute('checked') ? 'x' : ' ';
      const text = _content.replace(/^\n+/, '').replace(/\n+$/, '');
      return `- [${checked}] ${text}\n`;
    },
  });

  turndownInstance = td;
  return td;
}

export function markdownToHtml(md: string): string {
  if (!md?.trim()) return '';
  return marked.parse(md, { async: false, gfm: true, breaks: false }) as string;
}

export function htmlToMarkdown(html: string): string {
  if (!html?.trim()) return '';
  const td = getTurndown();
  return td.turndown(html).trim();
}
