/**
 * Document Studio editor — image block NodeView (R1).
 *
 * Renders a schema `image` block from its opaque `payloadJson` (`{ url, alt,
 * caption? }`). Atom block, lossless round-trip; missing url → `<pre>` fallback.
 */

import { mergeAttributes, Node } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import React from 'react';

import { DOC_IMAGE_NODE_NAME } from '../nodeNames';
import { parseNodePayload, payloadBlockAttributes } from './payloadAttrs';

const DocImageNodeComponent: React.FC<{
  node: { attrs: Record<string, unknown> };
  selected: boolean;
}> = ({ node, selected }) => {
  const payload = parseNodePayload(node.attrs) as {
    url?: string;
    alt?: string;
    caption?: string;
  } | null;
  const url = payload && typeof payload.url === 'string' ? payload.url : '';

  return (
    <NodeViewWrapper
      data-doc-block="image"
      className={`my-3 rounded-lg border ${
        selected ? 'border-c-accent ring-1 ring-c-focus' : 'border-c-border-subtle'
      } bg-c-surface p-3`}
    >
      {url ? (
        <figure className="m-0">
          <img
            src={url}
            alt={payload?.alt ?? ''}
            className="mx-auto max-h-[360px] rounded object-contain"
          />
          {payload?.caption ? (
            <figcaption className="mt-2 text-center text-xs text-c-text-secondary">
              {payload.caption}
            </figcaption>
          ) : null}
        </figure>
      ) : (
        <pre className="whitespace-pre-wrap text-xs text-c-text-secondary">
          {JSON.stringify(payload, null, 2)}
        </pre>
      )}
    </NodeViewWrapper>
  );
};

export const DocImageNode = Node.create({
  name: DOC_IMAGE_NODE_NAME,
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return payloadBlockAttributes();
  },

  parseHTML() {
    return [{ tag: `div[data-doc-node="${DOC_IMAGE_NODE_NAME}"]` }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-doc-node': DOC_IMAGE_NODE_NAME }, HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DocImageNodeComponent as never) as never;
  },
});

export default DocImageNode;
