/**
 * Document Studio editor — chart block NodeView (R1, consumes R3).
 *
 * An atom block node carrying its entire chart `content` as a single opaque
 * `payloadJson` attr (stable contract — survives any editing round-trip). The
 * NodeView narrows that payload with R3's `narrowChartContent` and renders the
 * `DocChartBlock`; on garbage it falls back to a `<pre>` JSON dump.
 */

import { mergeAttributes, Node } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import React from 'react';

import { DocChartBlock, narrowChartContent } from '@/components/DocumentStudio/blocks';

import { CHART_NODE_NAME } from '../nodeNames';
import { payloadBlockAttributes, parseNodePayload } from './payloadAttrs';

const ChartNodeComponent: React.FC<{
  node: { attrs: Record<string, unknown> };
  selected: boolean;
}> = ({ node, selected }) => {
  const payload = parseNodePayload(node.attrs);
  const content = narrowChartContent(payload);

  return (
    <NodeViewWrapper
      data-doc-block="chart"
      className={`my-3 rounded-lg border ${
        selected ? 'border-c-accent ring-1 ring-c-focus' : 'border-c-border-subtle'
      } bg-c-surface p-3`}
    >
      {content ? (
        <DocChartBlock content={content} />
      ) : (
        <pre className="whitespace-pre-wrap text-xs text-c-text-secondary">
          {JSON.stringify(payload, null, 2)}
        </pre>
      )}
    </NodeViewWrapper>
  );
};

export const ChartNode = Node.create({
  name: CHART_NODE_NAME,
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return payloadBlockAttributes();
  },

  parseHTML() {
    return [{ tag: `div[data-doc-node="${CHART_NODE_NAME}"]` }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-doc-node': CHART_NODE_NAME }, HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ChartNodeComponent as never) as never;
  },
});

export default ChartNode;
