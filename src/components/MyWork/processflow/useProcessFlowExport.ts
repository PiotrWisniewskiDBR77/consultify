import { useCallback, useState } from 'react';
import type { Edge, Node } from 'reactflow';

import { generateReadback, readbackToText, type LaneLike } from './generateReadback';
import { type ProcessFlowMode } from './ProcessFlowToolbar';

export type ExportFormat = 'json' | 'readback' | 'png';

export interface ProcessFlowExtensions {
  processFlow: {
    lanes: LaneLike[];
    flowMode: ProcessFlowMode;
    semanticKit: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface SerializedFlow {
  nodes: Node[];
  edges: Edge[];
  extensions: ProcessFlowExtensions;
  version: number;
  exportedAt: string;
}

/** Pure serialization of the in-memory graph into the export JSON shape. */
export function serializeFlowJson(
  nodes: Node[],
  edges: Edge[],
  lanes: LaneLike[],
  flowMode: ProcessFlowMode,
  semanticKit: string
): SerializedFlow {
  return {
    nodes,
    edges,
    extensions: {
      processFlow: {
        lanes,
        flowMode,
        semanticKit,
      },
    },
    version: 1,
    exportedAt: new Date().toISOString(),
  };
}

function downloadBlob(content: string, mimeType: string, filename: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

interface UseProcessFlowExportOpts {
  processId: string | null;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  nodes: Node[];
  edges: Edge[];
  lanes: LaneLike[];
  flowMode: ProcessFlowMode;
  semanticKit: string;
  isPl?: boolean;
}

/**
 * Process-flow export — fully client-side (DP-7). PNG export (html-to-image)
 * is untouched. JSON and readback-text previously POSTed to the dead V8
 * `/process-flow/:id/export/:format` route; both are now serialized/generated
 * from the in-memory graph and downloaded directly, no fetch involved.
 */
export function useProcessFlowExport({
  processId,
  canvasRef,
  nodes,
  edges,
  lanes,
  flowMode,
  semanticKit,
  isPl = false,
}: UseProcessFlowExportOpts) {
  const [isExporting, setIsExporting] = useState(false);

  const exportAs = useCallback(
    async (format: ExportFormat) => {
      if (!processId) return;
      setIsExporting(true);
      try {
        if (format === 'png') {
          const { toPng } = await import('html-to-image');
          if (canvasRef.current) {
            // Rasterizer needs a concrete color; resolve the canonical app-bg
            // token so the export matches the active (light/dark) theme.
            const exportBg =
              getComputedStyle(document.documentElement)
                .getPropertyValue('--c-bg')
                .trim() || '#ffffff';
            const dataUrl = await toPng(canvasRef.current, { backgroundColor: exportBg });
            const link = document.createElement('a');
            link.download = `process-flow-${processId}.png`;
            link.href = dataUrl;
            link.click();
          }
        } else if (format === 'json') {
          const data = serializeFlowJson(nodes, edges, lanes, flowMode, semanticKit);
          downloadBlob(
            JSON.stringify(data, null, 2),
            'application/json',
            `process-flow-${processId}.json`
          );
        } else {
          const readback = generateReadback(nodes, edges, lanes, isPl);
          const text = readbackToText(readback, isPl);
          downloadBlob(text, 'text/plain', `process-flow-${processId}.txt`);
        }
      } catch {
        // Export error — toast will be handled by caller
      } finally {
        setIsExporting(false);
      }
    },
    [processId, canvasRef, nodes, edges, lanes, flowMode, semanticKit, isPl]
  );

  return { isExporting, exportAs };
}
