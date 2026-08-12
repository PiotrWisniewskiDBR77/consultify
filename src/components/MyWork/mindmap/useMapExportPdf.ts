import { useCallback } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

/**
 * M06 FALA3 3.4 — hardening pass (no flag; fixes an existing feature):
 *
 * Previously this hook:
 *  - always requested `pixelRatio: 2`, which on a large map (thousands of px
 *    wide viewport) produces a multi-thousand-pixel-square canvas that can
 *    silently exceed the browser's max canvas size (toDataURL then throws or
 *    returns a blank image) — no bounds check existed.
 *  - opened a blank `about:blank` tab and wrote to it with ZERO feedback
 *    while `toPng` was still running (large maps can take multiple seconds),
 *    so the user just sees a blank popup with no indication anything is
 *    happening ("cichy window.print()" — no progress state).
 *  - `window.print()` fired from an unconditional `onload`, with no guard
 *    for the image having failed to decode.
 *
 * Fixes:
 *  - clamp `pixelRatio` down from the requested retina value based on the
 *    viewport's actual CSS size, so the rendered bitmap never exceeds a safe
 *    browser canvas budget (~16k px on the long edge, with real-world
 *    engines choking well before that on memory for a 2x-scaled multi-
 *    thousand-node map).
 *  - explicit loading toast while `toPng` runs + explicit success/failure
 *    toast instead of a silent popup.
 *  - image `onerror` guard before calling `window.print()`.
 */

// Conservative browser-safe ceiling for a single canvas dimension. Real limits
// vary (Chrome ~16384-32767, Safari ~4096-8192 depending on memory), so we
// stay well under the lowest common denominator while still allowing crisp
// retina exports for reasonably sized maps.
const MAX_CANVAS_DIMENSION_PX = 8000;

function computeSafePixelRatio(widthPx: number, heightPx: number, requested: number): number {
  if (!widthPx || !heightPx || !Number.isFinite(widthPx) || !Number.isFinite(heightPx)) {
    return 1;
  }
  const longestEdge = Math.max(widthPx, heightPx);
  if (longestEdge <= 0) return 1;
  const maxRatioForBounds = MAX_CANVAS_DIMENSION_PX / longestEdge;
  const safeRatio = Math.min(requested, maxRatioForBounds);
  // Never go below 1 (still renders, just not upscaled) and never above requested.
  return Math.max(1, Math.min(requested, safeRatio));
}

export function useMapExportPdf() {
  const { t } = useTranslation();

  const exportAsPdf = useCallback(async (title: string) => {
    const canvasNotFoundMsg = t('ideas.mindmap.canvasNotFound', 'Mind map canvas not found. Please try again.');
    const reactFlowEl = document.querySelector('.react-flow') as HTMLElement;
    if (!reactFlowEl) {
      toast.error(canvasNotFoundMsg, {
        id: 'mm-export-err',
        duration: 3000,
      });
      return;
    }

    const viewportEl = reactFlowEl.querySelector('.react-flow__viewport') as HTMLElement;
    if (!viewportEl) {
      toast.error(canvasNotFoundMsg, {
        id: 'mm-export-err',
        duration: 3000,
      });
      return;
    }

    const rect = viewportEl.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      toast.error(t('ideas.mindmap.canvasEmptyNothingToExport', 'Mind map appears empty — nothing to export.'), {
        id: 'mm-export-err',
        duration: 3000,
      });
      return;
    }

    const toastId = 'mm-export-pdf';
    toast.loading(t('ideas.mindmap.preparingPdfExport', 'Preparing PDF export…'), { id: toastId });

    try {
      const requestedPixelRatio = window.devicePixelRatio > 1 ? 2 : 1.5;
      const pixelRatio = computeSafePixelRatio(rect.width, rect.height, requestedPixelRatio);

      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(viewportEl, {
        backgroundColor: '#ffffff',
        quality: 1,
        pixelRatio,
      });

      if (!dataUrl || dataUrl === 'data:,') {
        throw new Error('Rendered image was empty');
      }

      const mindMapLabel = t('mindmap.mindMap', 'Mind map');
      const safeTitle = String(title || mindMapLabel).replace(/[<>"&]/g, '');
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error(t('ideas.mindmap.popupBlockedForPdf', 'Pop-up blocked. Please allow pop-ups to export the PDF.'), {
          id: toastId,
          duration: 4000,
        });
        return;
      }

      // This message is rendered by an inline <script> inside the popup
      // window's own document (not React), so it must be pre-translated and
      // escaped for embedding in a single-quoted JS string literal.
      const renderErrorMsg = t(
        'ideas.mindmap.failedToRenderImageRetry',
        'Failed to render the mind map image. Please close this tab and try again.'
      )
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'");

      printWindow.document.write(
        `<!DOCTYPE html>
<html>
<head><title>${safeTitle} — ${mindMapLabel}</title>
<style>
  @page { size: landscape; margin: 1cm; }
  body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
  img { max-width: 100%; max-height: 100vh; object-fit: contain; }
  h1 { text-align: center; font-family: system-ui; font-size: 18px; color: #334155; margin-bottom: 12px; }
  .mm-export-error { font-family: system-ui; color: #b91c1c; text-align: center; padding: 24px; }
</style>
</head>
<body>
  <div>
    <h1>${safeTitle}</h1>
    <img id="mm-export-img" src="${dataUrl}" />
  </div>
  <script>
    (function () {
      var img = document.getElementById('mm-export-img');
      img.onload = function () { window.print(); };
      img.onerror = function () {
        document.body.innerHTML = '<div class="mm-export-error">${renderErrorMsg}</div>';
      };
    })();
  </script>
</body>
</html>`
      );
      printWindow.document.close();

      toast.success(t('ideas.mindmap.pdfReadyPrintDialog', 'PDF ready — use the print dialog to save it.'), {
        id: toastId,
        duration: 2500,
      });
    } catch (err) {
      console.error('PDF export failed:', err);
      toast.error(t('ideas.mindmap.pdfExportFailedRetry', 'PDF export failed. Please try again.'), {
        id: toastId,
        duration: 3000,
      });
    }
  }, [t]);

  return { exportAsPdf };
}
