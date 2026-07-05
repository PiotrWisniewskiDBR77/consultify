/**
 * Document Studio editor — table / risk_table / kpi_strip NodeView (R1, consumes R3).
 *
 * One atom NodeView backs all three tabular schema block types. It dispatches
 * on the preserved `blockType` attr:
 *
 *   - `kpi_strip`  → `<DocKpiStrip content={payload} />` (narrows internally)
 *   - `risk_table` → `<DocTableBlock content={narrowTableContent(p,{risk:true})} />`
 *   - `table`      → `<DocTableBlock content={narrowTableContent(p)} />`
 *
 * The whole `content` is carried opaquely as `payloadJson`, so edits never
 * corrupt the structured data. Garbage → `<pre>` fallback.
 */

import { mergeAttributes, Node } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import React from 'react';

import {
  DocKpiStrip,
  DocTableBlock,
  narrowTableContent,
} from '@/components/DocumentStudio/blocks';

import { KPI_STRIP_NODE_NAME } from '../nodeNames';
import { payloadBlockAttributes, parseNodePayload } from './payloadAttrs';

const KpiStripNodeComponent: React.FC<{
  node: { attrs: Record<string, unknown> };
  selected: boolean;
}> = ({ node, selected }) => {
  const payload = parseNodePayload(node.attrs);
  const blockType = String(node.attrs.blockType ?? 'kpi_strip');

  let rendered: React.ReactNode = null;
  if (blockType === 'kpi_strip') {
    rendered = <DocKpiStrip content={payload} />;
  } else {
    const table = narrowTableContent(payload, { riskSemantics: blockType === 'risk_table' });
    rendered = table ? <DocTableBlock content={table} /> : null;
  }

  return (
    <NodeViewWrapper
      data-doc-block={blockType}
      className={`my-3 rounded-lg border ${
        selected ? 'border-c-accent ring-1 ring-c-focus' : 'border-c-border-subtle'
      } bg-c-surface p-3`}
    >
      {rendered ?? (
        <pre className="whitespace-pre-wrap text-xs text-c-text-secondary">
          {JSON.stringify(payload, null, 2)}
        </pre>
      )}
    </NodeViewWrapper>
  );
};

export const KpiStripNode = Node.create({
  name: KPI_STRIP_NODE_NAME,
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return payloadBlockAttributes();
  },

  parseHTML() {
    return [{ tag: `div[data-doc-node="${KPI_STRIP_NODE_NAME}"]` }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-doc-node': KPI_STRIP_NODE_NAME }, HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(KpiStripNodeComponent as never) as never;
  },
});

export default KpiStripNode;
