import { useCallback } from 'react';
import type { Edge, Node } from 'reactflow';

import { isStructuralEdge } from './useMindMapNodes';

export interface ExportMarkdownOptions {
  includeMetadata?: boolean;
}

/**
 * Build an indented markdown outline from the mindmap tree.
 * Traverses only structural edges; handles cycles via a visited set.
 */
export function exportToMarkdown(
  nodes: Node[],
  edges: Edge[],
  options?: ExportMarkdownOptions
): string {
  const includeMetadata = options?.includeMetadata ?? false;

  const childrenMap = new Map<string, string[]>();
  for (const edge of edges) {
    if (!isStructuralEdge(edge)) continue;
    const list = childrenMap.get(edge.source) ?? [];
    list.push(edge.target);
    childrenMap.set(edge.source, list);
  }

  const nodeMap = new Map<string, Node>();
  for (const node of nodes) nodeMap.set(node.id, node);

  const rootNode = nodes.find((n) => n.id === 'root') ?? nodes.find((n) => n.type === 'center');
  if (!rootNode) return '';

  const lines: string[] = [];
  const visited = new Set<string>();

  const walk = (nodeId: string, depth: number) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (!node) return;

    const label = String(node.data?.label || node.id);
    const indent = '  '.repeat(depth);
    lines.push(`${indent}- **${label}**`);

    if (includeMetadata) {
      const metaIndent = '  '.repeat(depth + 1);
      const notes = node.data?.notes;
      if (notes) lines.push(`${metaIndent}${String(notes)}`);
      const tags: string[] = Array.isArray(node.data?.tags) ? node.data.tags : [];
      if (tags.length > 0) lines.push(`${metaIndent}[tags: ${tags.join(', ')}]`);
      const status = node.data?.status;
      if (status) lines.push(`${metaIndent}[status: ${status}]`);
      const semanticType = node.data?.semanticType;
      if (semanticType) lines.push(`${metaIndent}[type: ${semanticType}]`);
    }

    const children = childrenMap.get(nodeId) ?? [];
    for (const childId of children) walk(childId, depth + 1);
  };

  walk(rootNode.id, 0);
  return lines.join('\n');
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

export function useMapExport() {
  const exportAsPNG = useCallback(async (filename = 'mindmap.png') => {
    try {
      const { toPng } = await import('html-to-image');
      const viewport = document.querySelector('.react-flow__viewport') as HTMLElement;
      if (!viewport) return;
      const dataUrl = await toPng(viewport, {
        backgroundColor: '#f8fafc',
        pixelRatio: 2,
      });
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      link.click();
    } catch {
      // html-to-image may not be available
    }
  }, []);

  const exportAsSVG = useCallback(async (filename = 'mindmap.svg') => {
    try {
      const { toSvg } = await import('html-to-image');
      const viewport = document.querySelector('.react-flow__viewport') as HTMLElement;
      if (!viewport) return;
      const dataUrl = await toSvg(viewport, { backgroundColor: '#f8fafc' });
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      link.click();
    } catch {
      // html-to-image may not be available
    }
  }, []);

  const exportAsJSON = useCallback(
    (
      nodes: Node[],
      edges: Edge[],
      extensions?: Record<string, unknown>,
      filename = 'mindmap.json'
    ) => {
      const data = JSON.stringify({ nodes, edges, extensions }, null, 2);
      downloadBlob(new Blob([data], { type: 'application/json' }), filename);
    },
    []
  );

  const exportAsMarkdown = useCallback(
    (nodes: Node[], edges: Edge[], options?: ExportMarkdownOptions, filename = 'mindmap.md') => {
      const md = exportToMarkdown(nodes, edges, options);
      navigator.clipboard?.writeText(md).catch(() => {});
      downloadBlob(new Blob([md], { type: 'text/markdown;charset=utf-8' }), filename);
      return md;
    },
    []
  );

  return { exportAsPNG, exportAsSVG, exportAsJSON, exportAsMarkdown };
}
