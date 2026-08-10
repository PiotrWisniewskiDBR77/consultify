/**
 * ExportPowerPoint — Exports mind map as a structured PPTX-like
 * downloadable HTML presentation. Each branch becomes a slide.
 */
import { Download, FileText, Loader2, Presentation, X } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';

import { Api } from '@/services/api';

import { isMindmapPptxNativeEnabled } from './mindmapExportFlags';

interface ExportPowerPointProps {
  open: boolean;
  onClose: () => void;
  ideaId: string;
  ideaTitle: string;
  branches: Array<{
    branchKey: string;
    label: string;
    nodes: Array<{ id: string; label: string; status?: string }>;
  }>;
}

function generateSlideHTML(title: string, branches: ExportPowerPointProps['branches']): string {
  const slideColors: Record<string, string> = {
    problem: '#fb7185',
    goal: '#34d399',
    options: '#fbbf24',
    evidence: '#38bdf8',
    risks: '#a78bfa',
    experiments: '#22d3ee',
  };

  const slides = [
    `<div style="page-break-after:always;padding:60px;min-height:700px;display:flex;flex-direction:column;justify-content:center;align-items:center;background:linear-gradient(135deg,#f59e0b22,#f59e0b11);">
      <h1 style="font-size:48px;font-weight:800;color:#1e293b;margin-bottom:16px;text-align:center;">${title}</h1>
      <p style="font-size:18px;color:#64748b;text-align:center;">Mind Map Overview &middot; ${branches.length} branches &middot; ${branches.reduce((s, b) => s + b.nodes.length, 0)} ideas</p>
    </div>`,
    ...branches.map((branch) => {
      const color = slideColors[branch.branchKey] || '#94a3b8';
      const nodesList = branch.nodes
        .map(
          (n) =>
            `<li style="margin-bottom:8px;font-size:16px;color:#334155;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:10px;"></span>${n.label}${n.status ? ` <span style="font-size:12px;color:#94a3b8;">(${n.status})</span>` : ''}</li>`
        )
        .join('');
      return `<div style="page-break-after:always;padding:60px;min-height:700px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:32px;">
          <div style="width:12px;height:12px;border-radius:50%;background:${color};"></div>
          <h2 style="font-size:36px;font-weight:700;color:#1e293b;margin:0;">${branch.label}</h2>
          <span style="font-size:14px;color:#94a3b8;margin-left:auto;">${branch.nodes.length} ideas</span>
        </div>
        <ul style="list-style:none;padding:0;margin:0;">${nodesList || '<li style="color:#94a3b8;font-size:16px;">No ideas yet</li>'}</ul>
      </div>`;
    }),
    `<div style="page-break-after:always;padding:60px;min-height:700px;display:flex;flex-direction:column;justify-content:center;align-items:center;background:linear-gradient(135deg,#6366f122,#6366f111);">
      <h2 style="font-size:36px;font-weight:700;color:#1e293b;margin-bottom:16px;">Summary</h2>
      <div style="display:flex;gap:24px;flex-wrap:wrap;justify-content:center;">
        ${branches.map((b) => `<div style="text-align:center;padding:16px 24px;border-radius:12px;background:white;box-shadow:0 2px 8px rgba(0,0,0,0.08);"><div style="font-size:28px;font-weight:800;color:${slideColors[b.branchKey] || '#94a3b8'};">${b.nodes.length}</div><div style="font-size:13px;color:#64748b;">${b.label}</div></div>`).join('')}
      </div>
    </div>`,
  ];

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title} - Mind Map Presentation</title>
  <style>
    @media print { body { margin: 0; } div { page-break-inside: avoid; } }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background: white; }
  </style>
</head>
<body>
  ${slides.join('\n')}
</body>
</html>`;
}

export const ExportPowerPoint: React.FC<ExportPowerPointProps> = ({
  open,
  onClose,
  ideaId,
  ideaTitle,
  branches,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [exporting, setExporting] = useState(false);
  const nativePptx = isMindmapPptxNativeEnabled();

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      if (nativePptx) {
        // ON: real .pptx via PptxPipelineService (BCG-grade), same pipeline
        // Report Builder uses. See server/src/services/mindmap/mindMapToUnifiedReport.ts.
        const blob = await Api.exportMyIdeaMapPptx(ideaId, {
          ideaTitle,
          branches,
          language: isPl ? 'pl' : 'en',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${ideaTitle || 'mindmap'}.pptx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(
          t('ideas.mindmap.presentationPptxExported', 'Presentation (.pptx) exported!'),
          {
            duration: 1500,
          }
        );
        onClose();
        return;
      }

      // OFF (default/fallback): legacy HTML blob, unchanged.
      const html = generateSlideHTML(ideaTitle, branches);
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${ideaTitle || 'mindmap'}-presentation.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t('ideas.mindmap.presentationExported', 'Presentation exported!'), {
        duration: 1500,
      });
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  }, [branches, ideaId, ideaTitle, isPl, nativePptx, onClose]);

  const handlePrint = useCallback(() => {
    const html = generateSlideHTML(ideaTitle, branches);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
  }, [branches, ideaTitle]);

  const containerRef = useRef<HTMLDivElement>(null);
  useDialogA11y({ open, onClose, containerRef });

  if (!open) return null;

  const totalIdeas = branches.reduce((s, b) => s + b.nodes.length, 0);

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-c-bg">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-power-point-modal-heading"
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl bg-c-surface-raised dark:bg-c-surface backdrop-blur-xl shadow-2xl overflow-hidden outline-none"
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-c-border-subtle dark:border-c-border-subtle">
          <div className="flex items-center gap-2">
            <Presentation size={16} className="text-c-info" />
            <h3 className="text-sm font-bold text-c-text dark:text-c-text" id="export-power-point-modal-heading">
              {t('ideas.mindmap.exportPresentation', 'Export Presentation')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-c-text-secondary hover:text-c-text-secondary dark:hover:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="p-3 rounded-xl bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle dark:border-c-border-subtle mb-4">
            <div className="text-[11px] font-bold text-c-text-secondary dark:text-c-text">
              {ideaTitle}
            </div>
            <div className="text-[10px] text-c-text-secondary mt-1">
              {branches.length} {t('ideas.mindmap.branches', 'branches')} · {totalIdeas}{' '}
              {t('ideas.mindmap.ideas', 'ideas')} · {branches.length + 2}{' '}
              {t('ideas.mindmap.slides', 'slides')}
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-c-surface-raised text-[11px] font-bold text-c-info dark:text-c-info transition-all disabled:opacity-40"
            >
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {nativePptx
                ? t('ideas.mindmap.downloadPptx', 'Download .pptx')
                : t('ideas.mindmap.downloadHtmlPdfPptx', 'Download HTML (for PDF/PPTX)')}
            </button>
            {!nativePptx ? (
              <button
                onClick={handlePrint}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-c-surface-raised dark:bg-c-surface text-[11px] font-bold text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface transition-all"
              >
                <FileText size={14} />
                {t('ideas.mindmap.printSaveAsPdf', 'Print / Save as PDF')}
              </button>
            ) : null}
          </div>

          <p className="text-[9px] text-c-text-secondary mt-3 text-center">
            {nativePptx
              ? t(
                  'ideas.mindmap.realPptxFileOpenPowerpointKeynote',
                  'Real .pptx file — open in PowerPoint or Keynote.'
                )
              : t(
                  'ideas.mindmap.openHtmlBrowserUseCtrlP',
                  'Open HTML in browser and use Ctrl+P to save as PDF.'
                )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ExportPowerPoint;
