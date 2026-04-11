import { useCallback } from 'react';
import toast from 'react-hot-toast';

export function useMapExportPdf() {
  const exportAsPdf = useCallback(async (title: string) => {
    const reactFlowEl = document.querySelector('.react-flow') as HTMLElement;
    if (!reactFlowEl) return;

    try {
      const viewportEl = reactFlowEl.querySelector('.react-flow__viewport') as HTMLElement;
      if (!viewportEl) return;

      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(viewportEl, {
        backgroundColor: '#ffffff',
        quality: 1,
        pixelRatio: 2,
      });

      const safeTitle = String(title || 'Mind Map').replace(/[<>"&]/g, '');
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      printWindow.document.write(
        `<!DOCTYPE html>
<html>
<head><title>${safeTitle} — Mind Map</title>
<style>
  @page { size: landscape; margin: 1cm; }
  body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
  img { max-width: 100%; max-height: 100vh; object-fit: contain; }
  h1 { text-align: center; font-family: system-ui; font-size: 18px; color: #334155; margin-bottom: 12px; }
</style>
</head>
<body>
  <div>
    <h1>${safeTitle}</h1>
    <img src="${dataUrl}" />
  </div>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`
      );
      printWindow.document.close();
    } catch (err) {
      console.error('PDF export failed:', err);
      toast.error('PDF export failed. Please try again.', { id: 'mm-export-err', duration: 3000 });
    }
  }, []);

  return { exportAsPdf };
}
