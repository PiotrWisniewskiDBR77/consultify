/**
 * Document Studio — ProseMirror (TipTap) JSON → DocumentSchema (R1 / E2).
 *
 * Inverse of `schemaToProseMirror`. Walks the flat top-level node stream,
 * re-grouping block nodes under the most recent `docSection` marker, and
 * reconstructs each `DocumentBlock` with its original identity (`blockId`,
 * `sourceRef`, `isAssumption`) and content shape.
 *
 * LOSSLESS CONTRACT (FT-1): for any schema `x`,
 *   `proseMirrorToSchema(schemaToProseMirror(x), x) ≈ x`
 * with ZERO loss of `blockId` / `sourceRef` / `isAssumption` / `sectionId`.
 * The original schema is passed back in so document-level metadata (title,
 * documentType, language, owner, …) — which is never encoded into the PM doc —
 * is preserved verbatim.
 *
 * LEGACY TOLERANCE: a `bulletList` / `orderedList` node maps to
 * `bullet_list` / `numbered_list`; an inbound block whose stored `blockType`
 * is the legacy `'list'` is tolerated and resolved by the live node type.
 */

import type { DocumentBlock, DocumentSchema, DocumentSection, DocumentSourceRef } from '../types';
import { DOC_SECTION_NODE_NAME } from './nodeNames';
import type { PMDoc, PMNode } from './schemaToTipTap';

// Re-export dla konsumentów odwrotnej konwersji (DocumentTipTapEditor importuje
// PMDoc razem z proseMirrorToSchema z tego modułu).
export type { PMDoc, PMNode } from './schemaToTipTap';

function parseSourceRef(raw: unknown): DocumentSourceRef | undefined {
  if (typeof raw !== 'string' || raw.length === 0) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && typeof parsed.sourceId === 'string') {
      return parsed as DocumentSourceRef;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

function parsePayload(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw ?? null;
  if (raw.length === 0) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Collapse a node's inline content into plain text. */
function nodeText(node: PMNode): string {
  if (typeof node.text === 'string') return node.text;
  if (!Array.isArray(node.content)) return '';
  return node.content.map(nodeText).join('');
}

function richInlineContent(node: PMNode): PMNode[] | undefined {
  if (!Array.isArray(node.content)) return undefined;
  const leaves = node.content
    .filter((leaf) => leaf.type === 'text' && typeof leaf.text === 'string')
    .map((leaf) => ({
      type: 'text',
      text: leaf.text,
      ...(Array.isArray(leaf.marks) && leaf.marks.length > 0
        ? {
            marks: leaf.marks
              .filter((mark) =>
                [
                  'bold',
                  'italic',
                  'strike',
                  'underline',
                  'link',
                  'textStyle',
                  'highlight',
                ].includes(mark?.type)
              )
              .map((mark) => ({
                type: mark.type,
                ...(mark.attrs ? { attrs: mark.attrs } : {}),
              })),
          }
        : {}),
    }));
  return leaves.some((leaf) => Array.isArray(leaf.marks) && leaf.marks.length > 0)
    ? leaves
    : undefined;
}

/** Each `listItem` collapses to one line of plain text. */
function listItems(node: PMNode): string[] {
  if (!Array.isArray(node.content)) return [];
  return node.content.map((li) => nodeText(li));
}

let assemblyCounter = 0;
function synthBlockId(): string {
  assemblyCounter += 1;
  try {
    return `blk-${crypto.randomUUID()}`;
  } catch {
    return `blk-${Date.now()}-${assemblyCounter}`;
  }
}

/** Common identity recovered from any block-level node's attrs. */
function recoverIdentity(node: PMNode): {
  blockId: string;
  sourceRef?: DocumentSourceRef;
  isAssumption: boolean;
} {
  const attrs = (node.attrs ?? {}) as Record<string, unknown>;
  const blockId =
    typeof attrs.blockId === 'string' && attrs.blockId ? attrs.blockId : synthBlockId();
  const sourceRef = parseSourceRef(attrs.sourceRef);
  const isAssumption = attrs.isAssumption === true;
  return { blockId, sourceRef, isAssumption };
}

function attachIdentity(
  block: Omit<DocumentBlock, 'sourceRef' | 'isAssumption'>,
  identity: { sourceRef?: DocumentSourceRef; isAssumption: boolean }
): DocumentBlock {
  const out: DocumentBlock = { ...block };
  if (identity.sourceRef) out.sourceRef = identity.sourceRef;
  if (identity.isAssumption) out.isAssumption = true;
  return out;
}

/**
 * Convert a single ProseMirror block-level node back into a {@link DocumentBlock}
 * (or `null` when the node is structural-only, e.g. a `docSection` marker).
 */
export function pmNodeToBlock(node: PMNode): DocumentBlock | null {
  const attrs = (node.attrs ?? {}) as Record<string, unknown>;
  const declaredType = typeof attrs.blockType === 'string' ? attrs.blockType : undefined;
  const identity = recoverIdentity(node);

  switch (node.type) {
    case 'heading': {
      const level = typeof attrs.level === 'number' ? attrs.level : 2;
      const richText = richInlineContent(node);
      return attachIdentity(
        {
          blockId: identity.blockId,
          type: 'heading',
          content: {
            level,
            text: nodeText(node),
            ...(richText ? { richText } : {}),
            ...(typeof attrs.textAlign === 'string' ? { textAlign: attrs.textAlign } : {}),
          },
        },
        identity
      );
    }

    case 'paragraph': {
      // A paragraph may originally have been a footnote/citation — restore that
      // type from the stored blockType so those round-trip exactly.
      const restoredType =
        declaredType === 'footnote' || declaredType === 'citation' ? declaredType : 'paragraph';
      const richText = richInlineContent(node);
      return attachIdentity(
        {
          blockId: identity.blockId,
          type: restoredType,
          content: {
            text: nodeText(node),
            ...(richText ? { richText } : {}),
            ...(typeof attrs.textAlign === 'string' ? { textAlign: attrs.textAlign } : {}),
          },
        },
        identity
      );
    }

    case 'bulletList':
    case 'orderedList': {
      const type = node.type === 'orderedList' ? 'numbered_list' : 'bullet_list';
      return attachIdentity(
        { blockId: identity.blockId, type, content: { items: listItems(node) } },
        identity
      );
    }

    case 'callout': {
      const variant = typeof attrs.variant === 'string' ? attrs.variant : 'info';
      return attachIdentity(
        { blockId: identity.blockId, type: 'callout', content: { variant, text: nodeText(node) } },
        identity
      );
    }

    case 'docQuote':
    case 'docChart':
    case 'docKpiStrip':
    case 'docImage': {
      // Atom NodeView: the entire content was preserved as `payloadJson` and the
      // original schema block type was stored in `blockType`.
      const type = declaredType ?? 'paragraph';
      return attachIdentity(
        { blockId: identity.blockId, type, content: parsePayload(attrs.payloadJson) },
        identity
      );
    }

    default:
      return null;
  }
}

/**
 * Reassemble the flat PM node stream into ordered sections + blocks.
 *
 * Blocks appearing BEFORE the first `docSection` marker (which should not
 * normally happen) are gathered into a synthetic leading section so nothing is
 * silently dropped.
 */
function regroupSections(nodes: PMNode[], priorSections: DocumentSection[]): DocumentSection[] {
  const priorById = new Map(priorSections.map((s) => [s.sectionId, s]));
  const sections: DocumentSection[] = [];
  let current: DocumentSection | null = null;
  let orderIndex = 0;

  // Zwraca nową sekcję, a przypisanie `current` robimy w miejscu wywołania —
  // TS nie śledzi przypisań wewnątrz domknięcia i zawężał `current` do `never`.
  const startSection = (node: PMNode | null): DocumentSection => {
    const attrs = (node?.attrs ?? {}) as Record<string, unknown>;
    const sectionId =
      typeof attrs.sectionId === 'string' && attrs.sectionId
        ? attrs.sectionId
        : `sec-synth-${orderIndex}`;
    const prior = priorById.get(sectionId);
    let sourceRefs: DocumentSourceRef[] = prior?.sourceRefs ?? [];
    if (typeof attrs.sourceRefs === 'string') {
      try {
        const parsed = JSON.parse(attrs.sourceRefs);
        if (Array.isArray(parsed)) sourceRefs = parsed as DocumentSourceRef[];
      } catch {
        /* keep prior */
      }
    }
    const section: DocumentSection = {
      sectionId,
      orderIndex: orderIndex++,
      level: (typeof attrs.level === 'number' ? attrs.level : (prior?.level ?? 1)) as 1 | 2 | 3,
      title: node ? nodeText(node) : (prior?.title ?? ''),
      purpose:
        typeof attrs.purpose === 'string' && attrs.purpose.length > 0
          ? attrs.purpose
          : prior?.purpose,
      blocks: [],
      sourceRefs,
    };
    sections.push(section);
    return section;
  };

  for (const node of nodes) {
    if (node.type === DOC_SECTION_NODE_NAME) {
      current = startSection(node);
      continue;
    }
    if (!current) current = startSection(null);
    const block = pmNodeToBlock(node);
    if (block) current.blocks.push(block);
  }

  return sections;
}

/**
 * Convert a ProseMirror document JSON back into a {@link DocumentSchema}.
 *
 * @param doc        The (possibly edited) PM document from the editor.
 * @param baseSchema The original schema — supplies document-level metadata that
 *                   is never encoded into the PM doc (title, documentType,
 *                   language, audience, owner, …) and per-section fallbacks.
 */
export function proseMirrorToSchema(doc: PMDoc, baseSchema: DocumentSchema): DocumentSchema {
  const nodes = Array.isArray(doc?.content) ? doc.content : [];
  let sections = regroupSections(nodes, baseSchema.sections ?? []);

  // When the original schema had no sections, `schemaToProseMirror` seeds a
  // single empty paragraph so ProseMirror is satisfied. The inverse would
  // reconstruct that as a synthetic section with one empty paragraph block.
  // Strip it so an empty-in → empty-out round-trip holds.
  if ((baseSchema.sections ?? []).length === 0 && sections.length === 1) {
    const synth = sections[0];
    const isPlaceholder =
      synth.blocks.length === 0 ||
      (synth.blocks.length === 1 &&
        synth.blocks[0].type === 'paragraph' &&
        (synth.blocks[0].content as { text?: string })?.text === '');
    if (isPlaceholder) sections = [];
  }

  return {
    ...baseSchema,
    sections,
  };
}
