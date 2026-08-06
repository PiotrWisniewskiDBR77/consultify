/**
 * Document Studio — DocumentSchema → ProseMirror (TipTap) JSON (R1 / E2).
 *
 * One half of the lossless round-trip pair (`tipTapToSchema.ts` is the inverse).
 * The TipTap editor is fed a single ProseMirror document whose top-level nodes
 * mirror the schema's sections and blocks. The transform is deliberately
 * EXPLICIT (no markdown round-tripping) so that every structural identity
 * carried by the schema survives editing:
 *
 *   - `blockId`     → carried on every block-level node's attrs.
 *   - `sectionId`   → carried on the section-heading node AND propagated onto
 *                     each child block's `sectionId` attr so a selection inside
 *                     the body can be traced back to its section (R2 inline-AI).
 *   - `sourceRef`   → serialized to a JSON string on the block's attrs.
 *   - `isAssumption`→ boolean attr.
 *
 * Rich block types that R3 renders (chart / table / risk_table / kpi_strip /
 * image / callout / quote) become atom NodeViews whose entire `content` lives
 * in a single `payloadJson` attr — a stable opaque contract that survives any
 * edit untouched. Text blocks (heading / paragraph / list) become editable
 * native ProseMirror nodes.
 *
 * Section structure is encoded as a flat stream of top-level nodes:
 *
 *   docSection(heading)  ← one per section, carries sectionId/title/level/...
 *   <block nodes for that section…>
 *   docSection(heading)  ← next section
 *   <block nodes…>
 *
 * The inverse walks that flat stream, re-grouping blocks under the most recent
 * `docSection` marker.
 */

import type { DocumentBlock, DocumentSchema, DocumentSection, DocumentSourceRef } from '../types';
import {
  CHART_NODE_NAME,
  DOC_IMAGE_NODE_NAME,
  DOC_SECTION_NODE_NAME,
  KPI_STRIP_NODE_NAME,
  QUOTE_NODE_NAME,
} from './nodeNames';

/** Minimal ProseMirror JSON node shape we emit / consume. */
export interface PMNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PMNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

export interface PMDoc {
  type: 'doc';
  content: PMNode[];
}

/** Serialize an optional sourceRef to a stable JSON string (or '' when absent). */
function serializeSourceRef(ref: DocumentSourceRef | undefined): string {
  if (!ref) return '';
  try {
    return JSON.stringify(ref);
  } catch {
    return '';
  }
}

/** Common identity attrs every block-level node carries. */
function blockIdentityAttrs(block: DocumentBlock, sectionId: string): Record<string, unknown> {
  return {
    blockId: block.blockId,
    sectionId,
    blockType: block.type,
    sourceRef: serializeSourceRef(block.sourceRef),
    isAssumption: Boolean(block.isAssumption),
  };
}

/** A paragraph node containing a single text leaf (empty text → no leaf). */
function textParagraph(text: string): PMNode {
  const trimmed = typeof text === 'string' ? text : '';
  return {
    type: 'paragraph',
    content: trimmed.length > 0 ? [{ type: 'text', text: trimmed }] : [],
  };
}

function richInlineContent(content: unknown, fallbackText: string): PMNode[] {
  const rich = (content as { richText?: unknown } | null)?.richText;
  if (!Array.isArray(rich)) {
    return fallbackText.length > 0 ? [{ type: 'text', text: fallbackText }] : [];
  }
  return rich
    .filter(
      (leaf): leaf is PMNode =>
        Boolean(leaf) &&
        typeof leaf === 'object' &&
        (leaf as PMNode).type === 'text' &&
        typeof (leaf as PMNode).text === 'string'
    )
    .map((leaf) => ({
      type: 'text',
      text: leaf.text,
      ...(Array.isArray(leaf.marks)
        ? {
            marks: leaf.marks.filter((mark) =>
              ['bold', 'italic', 'strike', 'underline', 'link', 'textStyle', 'highlight'].includes(
                mark?.type
              )
            ),
          }
        : {}),
    }));
}

/** An atom NodeView block carrying its entire content as `payloadJson`. */
function atomBlockNode(nodeName: string, block: DocumentBlock, sectionId: string): PMNode {
  let payloadJson = '';
  try {
    payloadJson = JSON.stringify(block.content ?? null);
  } catch {
    payloadJson = 'null';
  }
  return {
    type: nodeName,
    attrs: {
      ...blockIdentityAttrs(block, sectionId),
      payloadJson,
    },
  };
}

/**
 * Convert a single schema block into one (or more) ProseMirror nodes.
 *
 * Returns an array because a list block expands to a single list node while a
 * heading/paragraph maps 1:1 — keeping the signature uniform simplifies the
 * caller. Identity attrs are attached so the inverse can reconstruct losslessly.
 */
export function blockToPMNodes(block: DocumentBlock, sectionId: string): PMNode[] {
  const identity = blockIdentityAttrs(block, sectionId);

  switch (block.type) {
    case 'heading': {
      const c = (block.content ?? {}) as {
        level?: number;
        text?: string;
        richText?: PMNode[];
        textAlign?: string;
      };
      const rawLevel = typeof c.level === 'number' ? c.level : 2;
      const level = Math.min(3, Math.max(1, rawLevel)) as 1 | 2 | 3;
      return [
        {
          type: 'heading',
          attrs: { ...identity, level, ...(c.textAlign ? { textAlign: c.textAlign } : {}) },
          content: richInlineContent(c, typeof c.text === 'string' ? c.text : ''),
        },
      ];
    }

    case 'paragraph': {
      const c = (block.content ?? {}) as {
        text?: string;
        richText?: PMNode[];
        textAlign?: string;
      };
      return [
        {
          type: 'paragraph',
          attrs: { ...identity, ...(c.textAlign ? { textAlign: c.textAlign } : {}) },
          content: richInlineContent(c, c.text ?? ''),
        },
      ];
    }

    case 'bullet_list':
    case 'numbered_list': {
      const c = (block.content ?? {}) as { items?: unknown };
      const items = Array.isArray(c.items) ? c.items : [];
      const listType = block.type === 'numbered_list' ? 'orderedList' : 'bulletList';
      return [
        {
          type: listType,
          attrs: identity,
          content: items.map((it) => ({
            type: 'listItem',
            content: [textParagraph(typeof it === 'string' ? it : String(it ?? ''))],
          })),
        },
      ];
    }

    case 'callout': {
      // Callout reuses the notebook `callout` node (editable block content).
      const c = (block.content ?? {}) as { variant?: string; text?: string };
      return [
        {
          type: 'callout',
          attrs: { ...identity, variant: c.variant ?? 'info' },
          content: [textParagraph(c.text ?? '')],
        },
      ];
    }

    case 'quote':
      return [atomBlockNode(QUOTE_NODE_NAME, block, sectionId)];

    case 'chart':
      return [atomBlockNode(CHART_NODE_NAME, block, sectionId)];

    case 'table':
    case 'risk_table':
    case 'kpi_strip':
      // table / risk_table / kpi_strip all flow through the KPI/table NodeView
      // family. We keep the original `blockType` in attrs so the inverse can
      // restore the exact schema type; the NodeView dispatches on it.
      return [atomBlockNode(KPI_STRIP_NODE_NAME, block, sectionId)];

    case 'image':
      return [atomBlockNode(DOC_IMAGE_NODE_NAME, block, sectionId)];

    case 'footnote':
    case 'citation': {
      // Footnotes / citations are short text annotations — keep them editable
      // as paragraphs but tag the original blockType so they round-trip back.
      const c = (block.content ?? {}) as { text?: string };
      return [{ ...textParagraph(c.text ?? ''), attrs: identity }];
    }

    default:
      // Unknown / future block type: preserve it losslessly as an atom so the
      // payload survives an editing round-trip even if we cannot render it.
      return [atomBlockNode(KPI_STRIP_NODE_NAME, block, sectionId)];
  }
}

/** Convert a single section (its heading marker + blocks) into PM nodes. */
export function sectionToPMNodes(section: DocumentSection): PMNode[] {
  const headingNode: PMNode = {
    type: DOC_SECTION_NODE_NAME,
    attrs: {
      sectionId: section.sectionId,
      level: section.level ?? 1,
      orderIndex: section.orderIndex ?? 0,
      purpose: section.purpose ?? '',
      sourceRefs: ((): string => {
        try {
          return JSON.stringify(section.sourceRefs ?? []);
        } catch {
          return '[]';
        }
      })(),
    },
    content:
      typeof section.title === 'string' && section.title.length > 0
        ? [{ type: 'text', text: section.title }]
        : [],
  };

  const blockNodes = section.blocks.flatMap((b) => blockToPMNodes(b, section.sectionId));
  return [headingNode, ...blockNodes];
}

/**
 * Convert a full {@link DocumentSchema} into a ProseMirror document JSON.
 *
 * The returned doc is fed straight to `editor.commands.setContent` (or the
 * `content` prop of `useEditor`). Document-level metadata (title, documentType,
 * language, …) is NOT encoded in the PM doc — it is preserved verbatim by the
 * inverse from the original schema and is out of scope for in-body editing.
 */
export function schemaToProseMirror(schema: DocumentSchema): PMDoc {
  const content: PMNode[] = [];
  const sections = Array.isArray(schema.sections) ? schema.sections : [];
  for (const section of sections) {
    content.push(...sectionToPMNodes(section));
  }
  // ProseMirror requires a non-empty doc; seed an empty paragraph when blank.
  if (content.length === 0) content.push({ type: 'paragraph', content: [] });
  return { type: 'doc', content };
}
