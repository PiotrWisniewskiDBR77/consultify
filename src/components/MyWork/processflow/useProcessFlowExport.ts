import { useCallback, useState } from 'react';

export type ExportFormat = 'json' | 'readback' | 'png';

interface UseProcessFlowExportOpts {
  processId: string | null;
  canvasRef: React.RefObject<HTMLDivElement | null>;
}

export function useProcessFlowExport({ processId, canvasRef }: UseProcessFlowExportOpts) {
  const [isExporting, setIsExporting] = useState(false);

  const exportAs = useCallback(async (format: ExportFormat) => {
    if (!processId) return;
    setIsExporting(true);
    try {
      if (format === 'png') {
        const { toPng } = await import('html-to-image');
        if (canvasRef.current) {
          const dataUrl = await toPng(canvasRef.current, { backgroundColor: '#ffffff' });
          const link = document.createElement('a');
          link.download = `process-flow-${processId}.png`;
          link.href = dataUrl;
          link.click();
        }
      } else {
        const res = await fetch(`/api/v8/process-flow/${processId}/export/${format}`);
        if (res.ok) {
          const data = await res.json();
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = `process-flow-${processId}.${format === 'json' ? 'json' : 'txt'}`;
          link.href = url;
          link.click();
          URL.revokeObjectURL(url);
        }
      }
    } catch {
      // Export error — toast will be handled by caller
    } finally {
      setIsExporting(false);
    }
  }, [processId, canvasRef]);

  return { isExporting, exportAs };
}
