/**
 * markdownStructTokenize — normalize marked's token stream into a flat list of
 * structural tokens the export renderers can walk without re-implementing
 * markdown grammar.
 *
 * Why this exists (Canvas M-4):
 * The prior `UnifiedExportService` rendered DOCX/PDF/PPTX by mapping each
 * markdown LINE to one paragraph. Headings, lists, tables, code blocks all
 * rendered as literal text (`##`, `|`, `- [ ]` showed up in the .docx). A
 * consultant downloading the Canvas would see raw markdown — well below
 * ChatGPT Canvas's baseline. The fix is to walk a real markdown AST per format
 * and project structural nodes onto each renderer's native shape (docx
 * Heading/ListParagraph/Table, pdfkit fontSize/text, pptxgenjs addText array).
 *
 * Why not raw marked tokens?
 * marked produces nested inline trees, lists with nested items, table headers
 * as `align`-typed cell objects. Each renderer would need bespoke recursion.
 * This module flattens lists to top-level `list_item` tokens with depth,
 * collapses table headers + rows to a uniform row shape, and exposes a single
 * `InlineRun[]` representation so emphasis/strong/code/link styling can be
 * mapped by each renderer in one place.
 */

import { marked, type Token, type Tokens } from 'marked';

/** A leaf-styled span inside a paragraph / heading / list item / cell. */
export interface InlineRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  /** When set, the run is a hyperlink target. */
  href?: string;
  /** When set, the run was inside a strikethrough span. */
  strike?: boolean;
}

export type StructToken =
  | { kind: 'heading'; depth: 1 | 2 | 3 | 4 | 5 | 6; runs: InlineRun[] }
  | { kind: 'paragraph'; runs: InlineRun[] }
  | {
      kind: 'list_item';
      ordered: boolean;
      depth: number; // 0-indexed nesting depth
      task?: boolean;
      checked?: boolean;
      runs: InlineRun[];
    }
  | { kind: 'code'; lang: string | null; text: string }
  | { kind: 'blockquote'; runs: InlineRun[] }
  | { kind: 'hr' }
  | { kind: 'table'; header: InlineRun[][]; rows: InlineRun[][][] }
  | { kind: 'space' };

/**
 * Walk marked inline tokens into a flat InlineRun list, carrying nested
 * formatting flags down. marked emits `strong`/`em`/`codespan`/`link`/`del`
 * nodes whose `tokens` children inherit the parent style — we propagate via
 * `flags` so a `**bold *and italic***` span emerges as `{bold:true, italic:true}`.
 */
function inlineWalk(
  tokens: Token[] | undefined,
  flags: Partial<Omit<InlineRun, 'text'>> = {}
): InlineRun[] {
  if (!tokens || tokens.length === 0) return [];
  const out: InlineRun[] = [];
  for (const tok of tokens) {
    switch (tok.type) {
      case 'text': {
        // marked sometimes nests further `tokens` inside a text node (when the
        // raw included inline markdown). Recurse to preserve formatting.
        const inner = (tok as Tokens.Text).tokens;
        if (inner && inner.length > 0) {
          out.push(...inlineWalk(inner, flags));
        } else {
          out.push({ ...flags, text: (tok as Tokens.Text).text });
        }
        break;
      }
      case 'strong':
        out.push(...inlineWalk((tok as Tokens.Strong).tokens, { ...flags, bold: true }));
        break;
      case 'em':
        out.push(...inlineWalk((tok as Tokens.Em).tokens, { ...flags, italic: true }));
        break;
      case 'codespan':
        out.push({ ...flags, code: true, text: (tok as Tokens.Codespan).text });
        break;
      case 'del':
        out.push(...inlineWalk((tok as Tokens.Del).tokens, { ...flags, strike: true }));
        break;
      case 'link': {
        const link = tok as Tokens.Link;
        out.push(...inlineWalk(link.tokens, { ...flags, href: link.href }));
        break;
      }
      case 'br':
        out.push({ ...flags, text: '\n' });
        break;
      case 'image': {
        const img = tok as Tokens.Image;
        // Images can't survive into a runs list — render the alt as plain text
        // with a small parenthetical so a downstream consumer sees what was there.
        out.push({ ...flags, text: img.text ? `[image: ${img.text}]` : '[image]' });
        break;
      }
      case 'escape':
        out.push({ ...flags, text: (tok as Tokens.Escape).text });
        break;
      case 'html':
        // Strip HTML tags but keep the text content — Word/PPT can't render the
        // raw HTML anyway, so we surface the text instead of an empty paragraph.
        out.push({ ...flags, text: (tok as Tokens.HTML).text.replace(/<[^>]+>/g, '') });
        break;
      default:
        // Unknown inline node — try to surface its raw text if it has one.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((tok as any).text) out.push({ ...flags, text: String((tok as any).text) });
    }
  }
  return out;
}

/**
 * Flatten a marked list into top-level `list_item` struct tokens, carrying
 * nesting depth and propagating `ordered` from the parent list. Nested lists
 * inside an item become further list_item tokens with depth+1.
 */
function flattenList(list: Tokens.List, depth: number, out: StructToken[]): void {
  for (const item of list.items) {
    // Each item's `tokens` contains the item's own inline content plus any
    // nested lists. We collect inline runs from the inline tokens and recurse
    // for nested lists.
    const inlineTokens: Token[] = [];
    const nestedLists: Tokens.List[] = [];
    for (const child of item.tokens || []) {
      if (child.type === 'list') nestedLists.push(child as Tokens.List);
      else inlineTokens.push(child);
    }
    out.push({
      kind: 'list_item',
      ordered: list.ordered,
      depth,
      task: item.task ?? undefined,
      checked: item.task ? (item.checked ?? false) : undefined,
      runs: inlineWalk(inlineTokens),
    });
    for (const nested of nestedLists) {
      flattenList(nested, depth + 1, out);
    }
  }
}

/**
 * Project marked's lexer output into a flat StructToken list. Top-level marked
 * tokens (heading/paragraph/list/code/table/blockquote/hr) become one entry
 * each; lists are flattened so renderers iterate sequentially without
 * recursion.
 */
export function tokenizeMarkdown(markdown: string): StructToken[] {
  // GFM is enabled by default in marked v9+, so tables + task lists + strike
  // are recognized without an explicit option.
  const tokens = marked.lexer(markdown || '');
  const out: StructToken[] = [];
  for (const tok of tokens) {
    switch (tok.type) {
      case 'heading': {
        const h = tok as Tokens.Heading;
        const depth = (Math.max(1, Math.min(6, h.depth)) as 1 | 2 | 3 | 4 | 5 | 6);
        out.push({ kind: 'heading', depth, runs: inlineWalk(h.tokens) });
        break;
      }
      case 'paragraph': {
        const p = tok as Tokens.Paragraph;
        out.push({ kind: 'paragraph', runs: inlineWalk(p.tokens) });
        break;
      }
      case 'list':
        flattenList(tok as Tokens.List, 0, out);
        break;
      case 'code': {
        const c = tok as Tokens.Code;
        out.push({ kind: 'code', lang: c.lang || null, text: c.text || '' });
        break;
      }
      case 'blockquote': {
        const q = tok as Tokens.Blockquote;
        // Flatten child block contents into a single run sequence — Word's
        // quote style applies per paragraph but consultants rarely have multi-
        // paragraph quotes; collapsing keeps the output readable.
        const runs: InlineRun[] = [];
        for (const child of q.tokens || []) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((child as any).tokens) runs.push(...inlineWalk((child as any).tokens));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          else if ((child as any).text) runs.push({ text: String((child as any).text) });
        }
        out.push({ kind: 'blockquote', runs });
        break;
      }
      case 'hr':
        out.push({ kind: 'hr' });
        break;
      case 'table': {
        const t = tok as Tokens.Table;
        out.push({
          kind: 'table',
          header: t.header.map((cell) => inlineWalk(cell.tokens)),
          rows: t.rows.map((row) => row.map((cell) => inlineWalk(cell.tokens))),
        });
        break;
      }
      case 'space':
        out.push({ kind: 'space' });
        break;
      case 'html': {
        // Surface raw HTML as plain text so users see the content; raw tags
        // can't render natively in any of our targets.
        const text = (tok as Tokens.HTML).text.replace(/<[^>]+>/g, '').trim();
        if (text) out.push({ kind: 'paragraph', runs: [{ text }] });
        break;
      }
      default: {
        // Fallback for unknown block tokens — best-effort plain text render.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const text = (tok as any).text;
        if (text) out.push({ kind: 'paragraph', runs: [{ text: String(text) }] });
      }
    }
  }
  return out;
}

/**
 * Render a runs sequence to plain text — used as a last-resort fallback by
 * renderers that don't support inline formatting (e.g. an XLSX cell).
 */
export function runsToPlainText(runs: InlineRun[]): string {
  return runs.map((r) => r.text).join('');
}
