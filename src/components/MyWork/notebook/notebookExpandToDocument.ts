/**
 * C3 "Rozwiń w dokument" (KROK 6) — expand a notebook page into a Work Canvas
 * document draft and open the chat split-view on it.
 *
 * Decision D-C-2 (ratified): COPY with provenance, no live-sync. The draft is a
 * snapshot of the note at expand time; save-back later creates a NEW notebook
 * page with a link to the original (handled by the existing save-to-workspace).
 *
 * Pure helpers live here (TipTap JSON → markdown + request building) so they
 * are unit-testable without mounting the 2.9k-line NotebookContent component.
 */

export interface NotebookExpandPageInput {
  id: string;
  title: string;
  contentJson: any;
  contentText?: string | null;
}

export interface NotebookExpandResult {
  draftId: string;
  /** Canonical deep-link consumed by UnifiedChatPanel (workPanel + canvasDraftId). */
  chatUrl: string;
  /**
   * DEC-25: the durable action receipt NotebookHamburgerMenu's executeAction()
   * requires for every 'server-receipt-required' contract (see
   * notebookActionRegistry.ts 'expand-document'). There is no separate audit
   * receipt endpoint for canvas-draft creation the way notebook delete has
   * (/notebook/action-receipts/:receiptId) — the created draft itself is the
   * durable evidence, retrievable via GET /api/work-canvas/drafts/:draftId, so
   * the draft id doubles as the receipt id.
   */
  receiptId: string;
}

const escapeTableCell = (text: string): string => text.replace(/\|/g, '\\|').replace(/\n+/g, ' ');

/** Serialize TipTap marks on a text node into inline markdown. */
const renderTextNode = (node: any): string => {
  let text = String(node?.text ?? '');
  if (!text) return '';
  const marks: any[] = Array.isArray(node?.marks) ? node.marks : [];
  for (const mark of marks) {
    switch (mark?.type) {
      case 'bold':
        text = `**${text}**`;
        break;
      case 'italic':
        text = `*${text}*`;
        break;
      case 'strike':
        text = `~~${text}~~`;
        break;
      case 'code':
        text = `\`${text}\``;
        break;
      case 'link': {
        const href = String(mark?.attrs?.href || '').trim();
        if (href) text = `[${text}](${href})`;
        break;
      }
      // underline / highlight have no portable markdown — pass text through.
      default:
        break;
    }
  }
  return text;
};

const renderInline = (node: any): string => {
  if (!node) return '';
  if (typeof node.text === 'string') return renderTextNode(node);
  if (node.type === 'hardBreak') return '\n';
  if (Array.isArray(node.content)) return node.content.map(renderInline).join('');
  return '';
};

const prefixLines = (text: string, prefix: string): string =>
  text
    .split('\n')
    .map((line) => `${prefix}${line}`)
    .join('\n');

const renderListItems = (
  items: any[],
  options: { ordered?: boolean; start?: number; task?: boolean; indent?: string }
): string => {
  const { ordered = false, start = 1, task = false, indent = '' } = options;
  const lines: string[] = [];
  items.forEach((item, index) => {
    const children: any[] = Array.isArray(item?.content) ? item.content : [];
    const inlineParts: string[] = [];
    const blockParts: string[] = [];
    for (const child of children) {
      if (child?.type === 'paragraph') {
        inlineParts.push(renderInline(child));
      } else {
        const rendered = renderBlock(child, `${indent}  `);
        if (rendered.trim()) blockParts.push(rendered);
      }
    }
    const checkbox = task ? (item?.attrs?.checked ? '[x] ' : '[ ] ') : '';
    const bullet = ordered ? `${start + index}. ` : '- ';
    lines.push(`${indent}${bullet}${checkbox}${inlineParts.join(' ').trim()}`);
    for (const blockPart of blockParts) lines.push(blockPart);
  });
  return lines.join('\n');
};

const renderTable = (node: any): string => {
  const rows: any[] = Array.isArray(node?.content) ? node.content : [];
  if (rows.length === 0) return '';
  const renderedRows = rows.map((row) => {
    const cells: any[] = Array.isArray(row?.content) ? row.content : [];
    return cells.map((cell) => escapeTableCell(renderInline(cell).trim()) || ' ');
  });
  const columnCount = Math.max(...renderedRows.map((cells) => cells.length), 1);
  const toRow = (cells: string[]) => {
    const padded = [...cells];
    while (padded.length < columnCount) padded.push(' ');
    return `| ${padded.join(' | ')} |`;
  };
  const lines = [toRow(renderedRows[0]), `| ${Array(columnCount).fill('---').join(' | ')} |`];
  for (const cells of renderedRows.slice(1)) lines.push(toRow(cells));
  return lines.join('\n');
};

const renderBlock = (node: any, indent = ''): string => {
  if (!node || typeof node !== 'object') return '';
  const children: any[] = Array.isArray(node.content) ? node.content : [];
  switch (node.type) {
    case 'heading': {
      const level = Math.min(Math.max(Number(node.attrs?.level || 1), 1), 6);
      return `${'#'.repeat(level)} ${renderInline(node).trim()}`;
    }
    case 'paragraph':
      return renderInline(node).trim();
    case 'bulletList':
      return renderListItems(children, { indent });
    case 'orderedList':
      return renderListItems(children, {
        ordered: true,
        start: Number(node.attrs?.start || 1),
        indent,
      });
    case 'taskList':
      return renderListItems(children, { task: true, indent });
    case 'blockquote':
      return prefixLines(
        children
          .map((child) => renderBlock(child))
          .filter(Boolean)
          .join('\n\n'),
        '> '
      );
    case 'codeBlock': {
      const language = String(node.attrs?.language || '').trim();
      return `\`\`\`${language}\n${children.map(renderInline).join('')}\n\`\`\``;
    }
    case 'horizontalRule':
      return '---';
    case 'table':
      return renderTable(node);
    // Notebook custom nodes — degrade gracefully to portable markdown.
    case 'callout':
      return prefixLines(
        children
          .map((child) => renderBlock(child))
          .filter(Boolean)
          .join('\n\n'),
        '> '
      );
    case 'details':
    case 'detailsContent':
      return children
        .map((child) => renderBlock(child, indent))
        .filter((part) => part.trim())
        .join('\n\n');
    case 'detailsSummary':
      return `**${renderInline(node).trim()}**`;
    default: {
      // Unknown node: try inline first, then recurse into block children.
      const inline = renderInline(node).trim();
      if (inline) return inline;
      return children
        .map((child) => renderBlock(child, indent))
        .filter((part) => part.trim())
        .join('\n\n');
    }
  }
};

/**
 * Convert a notebook page's TipTap `contentJson` to markdown for the Canvas
 * draft. Falls back to the plain `contentText` when the JSON yields nothing.
 */
export function notebookContentToMarkdown(contentJson: any, fallbackText?: string | null): string {
  try {
    const blocks: any[] = Array.isArray(contentJson?.content) ? contentJson.content : [];
    const markdown = blocks
      .map((block) => renderBlock(block))
      .filter((part) => part.trim().length > 0)
      .join('\n\n')
      .trim();
    if (markdown) return markdown;
  } catch {
    // fall through to plain-text fallback
  }
  return String(fallbackText || '').trim();
}

/** Build the POST /api/work-canvas/drafts body for a notebook-expand draft. */
export function buildNotebookExpandDraftBody(
  page: NotebookExpandPageInput
): Record<string, unknown> {
  const title = String(page.title || '').trim() || 'Untitled note';
  const contentMd = notebookContentToMarkdown(page.contentJson, page.contentText);
  return {
    kind: 'document',
    title,
    content: contentMd,
    contentMd,
    canonicalFormat: 'markdown',
    provenance: {
      source: 'notebook-expand',
      sourceType: 'notebook',
      sourceId: page.id,
      sourceTitle: title,
    },
  };
}

/** Deep-link consumed by UnifiedChatPanel (`workPanel=1&canvasDraftId=…`). */
export function buildExpandChatUrl(draftId: string): string {
  return `/chat?workPanel=1&canvasDraftId=${encodeURIComponent(draftId)}`;
}

/**
 * Create the Work Canvas draft (copy of the note) and return the `/chat`
 * deep-link that mounts it in the split-view canvas.
 */
export async function expandNotebookPageToCanvasDraft(
  page: NotebookExpandPageInput
): Promise<NotebookExpandResult> {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('token') || '' : '';
  const response = await fetch('/api/work-canvas/drafts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(buildNotebookExpandDraftBody(page)),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(json?.error || 'Failed to create Canvas draft from note'));
  }
  const saved = json?.data?.draft || json?.data || {};
  const draftId = String(saved?.draftId || saved?.id || '').trim();
  if (!draftId) {
    throw new Error('Canvas draft was created but no draft id was returned');
  }
  return { draftId, chatUrl: buildExpandChatUrl(draftId), receiptId: draftId };
}
