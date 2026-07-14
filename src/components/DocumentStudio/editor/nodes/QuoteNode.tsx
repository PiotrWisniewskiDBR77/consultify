/**
 * Document Studio editor — quote block NodeView (R1).
 *
 * Renders a schema `quote` block as a styled blockquote. The block's text lives
 * in the opaque `payloadJson` (`{ text }`), so the round-trip is lossless. The
 * quote is an atom (not inline-editable in E1/E2 — text editing of quotes lands
 * with the dedicated affordance later); garbage payload → `<pre>` fallback.
 */

import { mergeAttributes, Node } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import React from 'react';

import { QUOTE_NODE_NAME } from '../nodeNames';
import { parseNodePayload, payloadBlockAttributes } from './payloadAttrs';

const QuoteNodeComponent: React.FC<{
  node: { attrs: Record<string, unknown> };
  selected: boolean;
}> = ({ node, selected }) => {
  const payload = parseNodePayload(node.attrs) as { text?: string; cite?: string } | null;
  const text = payload && typeof payload.text === 'string' ? payload.text : null;

  return (
    <NodeViewWrapper
      data-doc-block="quote"
      className={`my-3 ${selected ? 'ring-1 ring-c-focus rounded' : ''}`}
    >
      {text !== null ? (
        <blockquote className="border-l-4 border-c-accent bg-c-accent-soft0 px-4 py-2 italic text-c-text">
          {text}
          {payload?.cite ? (
            <cite className="mt-1 block text-xs not-italic text-c-text-secondary">
              — {payload.cite}
            </cite>
          ) : null}
        </blockquote>
      ) : (
        <pre className="whitespace-pre-wrap text-xs text-c-text-secondary">
          {JSON.stringify(payload, null, 2)}
        </pre>
      )}
    </NodeViewWrapper>
  );
};

export const QuoteNode = Node.create({
  name: QUOTE_NODE_NAME,
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return payloadBlockAttributes();
  },

  parseHTML() {
    return [{ tag: `div[data-doc-node="${QUOTE_NODE_NAME}"]` }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-doc-node': QUOTE_NODE_NAME }, HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(QuoteNodeComponent as never) as never;
  },
});

export default QuoteNode;
