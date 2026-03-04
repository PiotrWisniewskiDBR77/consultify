import { useCallback } from 'react';
import type { Edge, Node } from 'reactflow';

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
    (nodes: Node[], edges: Edge[], extensions?: Record<string, unknown>, filename = 'mindmap.json') => {
      const data = JSON.stringify({ nodes, edges, extensions }, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = filename;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    },
    []
  );

  return { exportAsPNG, exportAsSVG, exportAsJSON };
}
