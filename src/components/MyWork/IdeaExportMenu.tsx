/**
 * IdeaExportMenu — Visual export options for Idea Workspace.
 *
 * Supports: PNG (html-to-image), SVG, Markdown, JSON.
 * PDF generation via jsPDF is optional and loaded dynamically.
 */
import {
  Code2,
  Download,
  FileBarChart2,
  FileImage,
  FileJson,
  FileText,
  Loader2,
  Presentation,
  X,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ExportFormat {
  id: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  labelPl: string;
  labelEn: string;
  descPl: string;
  descEn: string;
  ext: string;
}

const FORMATS: ExportFormat[] = [
  {
    id: 'png',
    icon: FileImage,
    labelPl: 'PNG (obraz)',
    labelEn: 'PNG (image)',
    descPl: 'Eksport jako obraz rastrowy',
    descEn: 'Export as raster image',
    ext: 'png',
  },
  {
    id: 'svg',
    icon: FileImage,
    labelPl: 'SVG (wektor)',
    labelEn: 'SVG (vector)',
    descPl: 'Eksport jako grafika wektorowa',
    descEn: 'Export as vector graphic',
    ext: 'svg',
  },
  {
    id: 'pdf',
    icon: FileText,
    labelPl: 'PDF',
    labelEn: 'PDF',
    descPl: 'Eksport do PDF (V4-IDEA-06)',
    descEn: 'Export to PDF',
    ext: 'pdf',
  },
  {
    id: 'markdown',
    icon: FileText,
    labelPl: 'Markdown',
    labelEn: 'Markdown',
    descPl: 'Tekstowa reprezentacja mapy (outline)',
    descEn: 'Text representation / outline',
    ext: 'md',
  },
  {
    id: 'json',
    icon: FileJson,
    labelPl: 'JSON (dane)',
    labelEn: 'JSON (data)',
    descPl: 'Surowe dane do backup/import',
    descEn: 'Raw data for backup/import',
    ext: 'json',
  },
  // V5-IDEA-40: Report/deck export from workspace
  {
    id: 'report',
    icon: FileBarChart2,
    labelPl: 'Raport',
    labelEn: 'Report',
    descPl: 'Generuj raport z zaznaczenia lub całości',
    descEn: 'Generate report from selection or whole idea',
    ext: 'report',
  },
  {
    id: 'presentation',
    icon: Presentation,
    labelPl: 'Prezentacja (deck)',
    labelEn: 'Presentation (deck)',
    descPl: 'Generuj deck z zaznaczenia lub całości',
    descEn: 'Generate deck from selection or whole idea',
    ext: 'deck',
  },
];

export interface IdeaExportMenuProps {
  open: boolean;
  onClose: () => void;
  ideaId: string;
  title: string;
  graphNodes: any[];
  graphEdges: any[];
  extensions?: Record<string, unknown>;
  canvasContainerRef?: React.RefObject<HTMLDivElement>;
}

export const IdeaExportMenu: React.FC<IdeaExportMenuProps> = ({
  open,
  onClose,
  ideaId,
  title,
  graphNodes,
  graphEdges,
  extensions,
  canvasContainerRef,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [exporting, setExporting] = useState<string | null>(null);

  const downloadBlob = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const downloadText = useCallback(
    (content: string, filename: string, mimeType: string) => {
      const blob = new Blob([content], { type: mimeType });
      downloadBlob(blob, filename);
    },
    [downloadBlob]
  );

  const safeFilename = title?.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50) || 'idea-map';

  const exportPNG = useCallback(async () => {
    setExporting('png');
    try {
      const container = canvasContainerRef?.current?.querySelector('.react-flow') as HTMLElement;
      if (!container) throw new Error('Canvas not found');
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(container, {
        backgroundColor: '#ffffff',
        quality: 0.95,
        pixelRatio: 2,
      });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      downloadBlob(blob, `${safeFilename}.png`);
    } catch {
      // fallback: export as JSON
      exportJSON();
    } finally {
      setExporting(null);
    }
  }, [canvasContainerRef, downloadBlob, safeFilename]);

  const exportSVG = useCallback(async () => {
    setExporting('svg');
    try {
      const container = canvasContainerRef?.current?.querySelector('.react-flow') as HTMLElement;
      if (!container) throw new Error('Canvas not found');
      const { toSvg } = await import('html-to-image');
      const dataUrl = await toSvg(container, { backgroundColor: '#ffffff' });
      const svgContent = decodeURIComponent(dataUrl.split(',')[1] || '');
      downloadText(svgContent, `${safeFilename}.svg`, 'image/svg+xml');
    } catch {
      exportJSON();
    } finally {
      setExporting(null);
    }
  }, [canvasContainerRef, downloadText, safeFilename]);

  const exportMarkdown = useCallback(() => {
    setExporting('markdown');
    try {
      const lines: string[] = [`# ${title || 'Idea Map'}`, ''];

      const nodeMap = new Map(graphNodes.map((n) => [n.id, n]));
      const childMap = new Map<string, any[]>();

      for (const edge of graphEdges) {
        const children = childMap.get(edge.source) || [];
        const targetNode = nodeMap.get(edge.target);
        if (targetNode) children.push(targetNode);
        childMap.set(edge.source, children);
      }

      const rootNodes = graphNodes.filter((n) => !graphEdges.some((e: any) => e.target === n.id));

      const renderNode = (node: any, depth: number) => {
        const label = node.data?.label || node.id;
        const prefix = depth === 0 ? '## ' : '  '.repeat(depth - 1) + '- ';
        lines.push(`${prefix}${label}`);
        const children = childMap.get(node.id) || [];
        for (const child of children) {
          renderNode(child, depth + 1);
        }
      };

      if (rootNodes.length > 0) {
        for (const root of rootNodes) renderNode(root, 0);
      } else {
        for (const node of graphNodes) {
          lines.push(`- ${node.data?.label || node.id}`);
        }
      }

      lines.push(
        '',
        `---`,
        `*Exported from Idea Workspace (${new Date().toISOString().slice(0, 10)})*`
      );
      downloadText(lines.join('\n'), `${safeFilename}.md`, 'text/markdown');
    } finally {
      setExporting(null);
    }
  }, [downloadText, graphEdges, graphNodes, safeFilename, title]);

  const exportPDF = useCallback(async () => {
    setExporting('pdf');
    try {
      const container = canvasContainerRef?.current?.querySelector('.react-flow') as HTMLElement;
      if (!container) throw new Error('Canvas not found');
      const { toPng } = await import('html-to-image');
      const { jsPDF } = await import('jspdf');
      const dataUrl = await toPng(container, {
        backgroundColor: '#ffffff',
        quality: 0.95,
        pixelRatio: 2,
      });
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const maxW = pageW - 2 * margin;
      const maxH = pageH - 2 * margin - 8;
      const aspect = container.offsetHeight / container.offsetWidth;
      let imgW = maxW;
      let imgH = imgW * aspect;
      if (imgH > maxH) {
        imgH = maxH;
        imgW = imgH / aspect;
      }
      const x = margin + (maxW - imgW) / 2;
      pdf.addImage(dataUrl, 'PNG', x, margin, imgW, imgH);
      pdf.setFontSize(8);
      pdf.setTextColor(128, 128, 128);
      pdf.text(
        `Exported from Consultify Idea Workspace • ${title || 'Map'} • ${new Date().toISOString().slice(0, 10)}`,
        margin,
        pageH - 5
      );
      pdf.save(`${safeFilename}.pdf`);
    } catch {
      exportPNG();
    } finally {
      setExporting(null);
    }
  }, [canvasContainerRef, exportPNG, safeFilename, title]);

  const exportJSON = useCallback(() => {
    setExporting('json');
    try {
      const data = {
        id: ideaId,
        title,
        exportedAt: new Date().toISOString(),
        nodes: graphNodes.map((n) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: { label: n.data?.label, ...n.data },
        })),
        edges: graphEdges.map((e: any) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label || e.data?.label,
        })),
        extensions: extensions || {},
      };
      downloadText(JSON.stringify(data, null, 2), `${safeFilename}.json`, 'application/json');
    } finally {
      setExporting(null);
    }
  }, [downloadText, extensions, graphEdges, graphNodes, ideaId, safeFilename, title]);

  // V5-IDEA-40: Report/deck export via conversion system
  const exportToReport = useCallback(() => {
    setExporting('report');
    window.dispatchEvent(
      new CustomEvent('idea-workspace-quick-action', {
        detail: { action: 'convert_report', ideaId },
      })
    );
    setTimeout(() => {
      setExporting(null);
      onClose();
    }, 500);
  }, [ideaId, onClose]);

  const exportToPresentation = useCallback(() => {
    setExporting('presentation');
    window.dispatchEvent(
      new CustomEvent('idea-workspace-quick-action', {
        detail: { action: 'convert_presentation', ideaId },
      })
    );
    setTimeout(() => {
      setExporting(null);
      onClose();
    }, 500);
  }, [ideaId, onClose]);

  const handleExport = useCallback(
    (formatId: string) => {
      switch (formatId) {
        case 'png':
          exportPNG();
          break;
        case 'svg':
          exportSVG();
          break;
        case 'pdf':
          exportPDF();
          break;
        case 'markdown':
          exportMarkdown();
          break;
        case 'json':
          exportJSON();
          break;
        case 'report':
          exportToReport();
          break;
        case 'presentation':
          exportToPresentation();
          break;
      }
    },
    [
      exportJSON,
      exportMarkdown,
      exportPDF,
      exportPNG,
      exportSVG,
      exportToPresentation,
      exportToReport,
    ]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-2xl border border-slate-200/60 dark:border-navy-700/60 w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/60 dark:border-navy-700/60">
          <div className="flex items-center gap-2">
            <Download size={16} className="text-slate-600 dark:text-slate-300" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {isPl ? 'Eksport mapy' : 'Export map'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          >
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-2">
          {FORMATS.map((format) => {
            const Icon = format.icon;
            const isExporting = exporting === format.id;
            return (
              <button
                key={format.id}
                onClick={() => handleExport(format.id)}
                disabled={!!exporting}
                className="group w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200/60 dark:border-navy-700/60 hover:border-primary-400/40 hover:bg-primary-500/[0.02] transition-all disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500/10 to-violet-500/10 flex items-center justify-center text-primary-600 dark:text-primary-400 shrink-0">
                  {isExporting ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Icon size={18} />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <div className="text-[12px] font-bold text-slate-800 dark:text-slate-100">
                    {isPl ? format.labelPl : format.labelEn}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    {isPl ? format.descPl : format.descEn}
                  </div>
                </div>
                <Code2
                  size={14}
                  className="text-slate-300 dark:text-slate-600 group-hover:text-primary-400 transition-colors"
                />
              </button>
            );
          })}
        </div>

        <div className="px-5 py-3 border-t border-slate-200/60 dark:border-navy-700/60">
          <div className="text-[10px] text-slate-400 dark:text-slate-500">
            {isPl
              ? `${graphNodes.length} elementów, ${graphEdges.length} połączeń`
              : `${graphNodes.length} elements, ${graphEdges.length} connections`}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IdeaExportMenu;
