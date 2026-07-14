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
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

import {
  buildInteropMappingReport,
  parseBpmnXml,
  parseDiagramPackage,
  parseDrawIoXml,
} from './canvas/diagramInterop';
import type { IdeaWorkspaceImportPayload } from './ideaSelectionTypes';

/**
 * L-05 / D-01 / DP-5 — Server-side idea export is a STUB:
 * `POST /v4-final/ideas/:id/export` only records a row in `idea_exports`; no worker
 * ever produces a downloadable file (no `completeExport` caller). Per decision DP-5 we do
 * NOT build a server export worker — instead the server-export path is gated behind an
 * OFF-by-default flag. When off, no stub request is fired and no "server export" affordance
 * is presented as a working action. All genuinely-working CLIENT-side exports (PNG/SVG/PDF/
 * Markdown/JSON/package/mapping/share + report/presentation conversion) remain fully functional.
 */
export const IDEA_SERVER_EXPORT_ENABLED = import.meta.env.VITE_ENABLE_IDEA_SERVER_EXPORT === 'true';

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
  {
    id: 'package',
    icon: FileJson,
    labelPl: 'Pakiet diagramu',
    labelEn: 'Diagram package',
    descPl: 'Ustrukturyzowany pakiet z metadanymi, nodes, edges i extensions',
    descEn: 'Structured package with metadata, nodes, edges, and extensions',
    ext: 'diagram.json',
  },
  {
    id: 'mapping_report',
    icon: Code2,
    labelPl: 'Raport mapowania',
    labelEn: 'Mapping report',
    descPl: 'Raport fidelity i degradacji do interop/share',
    descEn: 'Fidelity and degradation report for interop/share',
    ext: 'mapping.md',
  },
  {
    id: 'share_manifest',
    icon: Code2,
    labelPl: 'Manifest share/embed',
    labelEn: 'Share/embed manifest',
    descPl: 'Permission-safe manifest do osadzeń i share flows.',
    descEn: 'Permission-safe manifest for embeds and share flows.',
    ext: 'share.json',
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
  canvasContainerRef?: React.RefObject<HTMLDivElement | null>;
  onImportGraph?: (payload: IdeaWorkspaceImportPayload) => void;
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
  onImportGraph,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [exporting, setExporting] = useState<string | null>(null);
  const [importFormat, setImportFormat] = useState<'drawio_xml' | 'bpmn_xml' | 'diagram_package'>(
    'drawio_xml'
  );
  const [importPayload, setImportPayload] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const whiteboardPolicy =
    extensions?.whiteboard &&
    typeof extensions.whiteboard === 'object' &&
    (extensions.whiteboard as Record<string, unknown>)?.sharePolicy &&
    typeof (extensions.whiteboard as Record<string, unknown>).sharePolicy === 'object'
      ? ((extensions.whiteboard as Record<string, unknown>).sharePolicy as Record<string, unknown>)
      : null;
  const exportFooter =
    whiteboardPolicy && typeof whiteboardPolicy.watermark === 'string'
      ? `${String(whiteboardPolicy.classification || 'internal').toUpperCase()} • ${whiteboardPolicy.watermark}`
      : 'Consultify Idea Workspace';
  const exportAllowed = whiteboardPolicy?.exportAllowed !== false;
  const shareAllowed = whiteboardPolicy?.shareAllowed !== false;

  const importPreview = useMemo(() => {
    if (!importPayload.trim()) return null;
    try {
      const parsed =
        importFormat === 'drawio_xml'
          ? parseDrawIoXml(importPayload)
          : importFormat === 'bpmn_xml'
            ? parseBpmnXml(importPayload)
            : parseDiagramPackage(importPayload);
      return {
        ok: true,
        parsed,
      } as const;
    } catch (error: any) {
      return {
        ok: false,
        error: error?.message || (isPl ? 'Import nie powiódł się' : 'Import failed'),
      } as const;
    }
  }, [importFormat, importPayload, isPl]);

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
        `*Exported from ${exportFooter} (${new Date().toISOString().slice(0, 10)})*`
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
        `Exported from ${exportFooter} • ${title || 'Map'} • ${new Date().toISOString().slice(0, 10)}`,
        margin,
        pageH - 5
      );
      pdf.save(`${safeFilename}.pdf`);
    } catch {
      exportPNG();
    } finally {
      setExporting(null);
    }
  }, [canvasContainerRef, exportFooter, exportPNG, safeFilename, title]);

  const exportJSON = useCallback(() => {
    setExporting('json');
    try {
      // A3 / P13 canon: round-trip safe — preserve the full node/edge shape (width,
      // height, parentNode, style, zIndex, …) so re-importing the JSON (diagram
      // package path) reproduces a visually identical canvas. Only transient
      // interaction state (selected/dragging) is stripped.
      const data = {
        id: ideaId,
        title,
        exportedAt: new Date().toISOString(),
        nodes: graphNodes.map((n: any) => {
          const { selected: _selected, dragging: _dragging, ...rest } = n;
          return { ...rest, data: { label: n.data?.label, ...n.data } };
        }),
        edges: graphEdges.map((e: any) => {
          const { selected: _selected, ...rest } = e;
          return { ...rest, label: e.label || e.data?.label };
        }),
        extensions: extensions || {},
      };
      downloadText(JSON.stringify(data, null, 2), `${safeFilename}.json`, 'application/json');
    } finally {
      setExporting(null);
    }
  }, [downloadText, extensions, graphEdges, graphNodes, ideaId, safeFilename, title]);

  const exportDiagramPackage = useCallback(() => {
    setExporting('package');
    try {
      const data = {
        packageType: 'consultify.diagram-package.v1',
        ideaId,
        title,
        exportedAt: new Date().toISOString(),
        stats: {
          nodes: graphNodes.length,
          edges: graphEdges.length,
        },
        nodes: graphNodes,
        edges: graphEdges,
        extensions: extensions || {},
      };
      downloadText(
        JSON.stringify(data, null, 2),
        `${safeFilename}.diagram.json`,
        'application/json'
      );
    } finally {
      setExporting(null);
    }
  }, [downloadText, extensions, graphEdges, graphNodes, ideaId, safeFilename, title]);

  const exportMappingReport = useCallback(() => {
    setExporting('mapping_report');
    try {
      const lines = buildInteropMappingReport({
        title,
        nodes: graphNodes,
        edges: graphEdges,
        extensions,
        format: 'native_export',
      });
      lines.splice(3, 0, `- Idea ID: ${ideaId}`);
      downloadText(lines.join('\n'), `${safeFilename}.mapping.md`, 'text/markdown');
    } finally {
      setExporting(null);
    }
  }, [downloadText, extensions, graphEdges.length, graphNodes.length, ideaId, safeFilename, title]);

  const exportShareManifest = useCallback(() => {
    setExporting('share_manifest');
    try {
      const data = {
        manifestType: 'consultify.share-manifest.v1',
        ideaId,
        title,
        exportedAt: new Date().toISOString(),
        stats: { nodes: graphNodes.length, edges: graphEdges.length },
        policy: {
          classification: whiteboardPolicy?.classification || 'internal',
          watermark: whiteboardPolicy?.watermark || 'Consultify',
          embedMode: 'permission_safe',
        },
        allowedEmbeds: ['report', 'presentation', 'notebook'],
      };
      downloadText(JSON.stringify(data, null, 2), `${safeFilename}.share.json`, 'application/json');
    } finally {
      setExporting(null);
    }
  }, [
    downloadText,
    graphEdges.length,
    graphNodes.length,
    ideaId,
    safeFilename,
    title,
    whiteboardPolicy,
  ]);

  const handleImport = useCallback(() => {
    if (!importPayload.trim() || !onImportGraph) return;
    try {
      const parsed = importPreview?.ok
        ? importPreview.parsed
        : importFormat === 'drawio_xml'
          ? parseDrawIoXml(importPayload)
          : importFormat === 'bpmn_xml'
            ? parseBpmnXml(importPayload)
            : parseDiagramPackage(importPayload);
      onImportGraph(parsed);
      setImportStatus(
        isPl
          ? `Zaimportowano ${parsed.nodes.length} węzłów i ${parsed.edges.length} połączeń`
          : `Imported ${parsed.nodes.length} nodes and ${parsed.edges.length} edges`
      );
      setImportPayload('');
      onClose();
    } catch (err: any) {
      setImportStatus(err?.message || (isPl ? 'Import nie powiódł się' : 'Import failed'));
    }
  }, [importFormat, importPayload, importPreview, isPl, onClose, onImportGraph]);

  // V5-IDEA-40: Report/deck export via conversion system
  const exportToReport = useCallback(() => {
    setExporting('report');
    window.dispatchEvent(
      new CustomEvent('idea-workspace-quick-action', {
        detail: { action: 'convert_report', ideaId },
      })
    );
    setExporting(null);
    onClose();
  }, [ideaId, onClose]);

  const exportToPresentation = useCallback(() => {
    setExporting('presentation');
    window.dispatchEvent(
      new CustomEvent('idea-workspace-quick-action', {
        detail: { action: 'convert_presentation', ideaId },
      })
    );
    setExporting(null);
    onClose();
  }, [ideaId, onClose]);

  const canExportFormat = useCallback(
    (formatId: string) => {
      if (!exportAllowed) return false;
      if (!shareAllowed && (formatId === 'report' || formatId === 'presentation')) return false;
      return true;
    },
    [exportAllowed, shareAllowed]
  );

  const recordExportRequest = useCallback(
    (formatId: string) => {
      // L-05 / DP-5: server export is a stub (records only, never produces a file).
      // Skip the request entirely unless the OFF-by-default flag is enabled.
      if (!IDEA_SERVER_EXPORT_ENABLED) return;
      Api.ideaRequestExport(ideaId, {
        exportType: 'whiteboard',
        exportFormat: formatId,
        watermarkText: exportFooter,
        includeMetadata: true,
      }).catch(() => undefined);
    },
    [exportFooter, ideaId]
  );

  const handleExport = useCallback(
    (formatId: string) => {
      if (!canExportFormat(formatId)) return;
      recordExportRequest(formatId);
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
        case 'package':
          exportDiagramPackage();
          break;
        case 'mapping_report':
          exportMappingReport();
          break;
        case 'share_manifest':
          exportShareManifest();
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
      canExportFormat,
      exportJSON,
      exportDiagramPackage,
      exportMappingReport,
      exportMarkdown,
      exportPDF,
      exportPNG,
      exportShareManifest,
      exportSVG,
      exportToPresentation,
      exportToReport,
      recordExportRequest,
    ]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-overlay flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-2xl border border-slate-200/60 dark:border-navy-700/60 w-full max-w-2xl overflow-hidden">
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

        <div className="grid grid-cols-2 gap-5 p-5">
          <div className="space-y-2">
            {FORMATS.map((format) => {
              const Icon = format.icon;
              const isExporting = exporting === format.id;
              return (
                <button
                  key={format.id}
                  onClick={() => handleExport(format.id)}
                  disabled={!!exporting || !canExportFormat(format.id)}
                  className="group w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200/60 dark:border-navy-700/60 hover:border-c-info/40 hover:bg-c-info/[0.02] transition-all disabled:opacity-50"
                >
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-c-info/10 to-c-info/10 flex items-center justify-center text-c-info shrink-0">
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
                    className="text-slate-600 dark:text-slate-400 group-hover:text-c-info transition-colors"
                  />
                </button>
              );
            })}
          </div>

          <div className="rounded-xl border border-slate-200/60 dark:border-navy-700/60 p-4 space-y-3">
            <div>
              <div className="text-[12px] font-bold text-slate-800 dark:text-slate-100">
                {isPl ? 'Import / Interop' : 'Import / Interop'}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                {isPl
                  ? 'Wklej `draw.io XML`, `BPMN XML` lub `diagram package`.'
                  : 'Paste `draw.io XML`, `BPMN XML`, or a `diagram package`.'}
              </div>
            </div>
            <select
              value={importFormat}
              onChange={(e) => setImportFormat(e.target.value as any)}
              className="w-full rounded-lg border border-slate-200/70 bg-white px-3 py-2 text-xs dark:border-navy-700/70 dark:bg-navy-950"
            >
              <option value="drawio_xml">draw.io XML</option>
              <option value="bpmn_xml">BPMN XML</option>
              <option value="diagram_package">Diagram package JSON</option>
            </select>
            <textarea
              value={importPayload}
              onChange={(e) => setImportPayload(e.target.value)}
              rows={11}
              placeholder={isPl ? 'Wklej payload do importu…' : 'Paste import payload…'}
              className="w-full rounded-lg border border-slate-200/70 bg-white px-3 py-2 text-[11px] font-mono dark:border-navy-700/70 dark:bg-navy-950"
            />
            {importPreview?.ok && (
              <div className="rounded-lg bg-emerald-50 px-3 py-2 text-[10px] text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                {isPl
                  ? `Gotowe do importu: ${importPreview.parsed.nodes.length} węzłów, ${importPreview.parsed.edges.length} połączeń`
                  : `Ready to import: ${importPreview.parsed.nodes.length} nodes, ${importPreview.parsed.edges.length} edges`}
              </div>
            )}
            {importPreview && !importPreview.ok && (
              <div className="rounded-lg bg-danger-50 px-3 py-2 text-[10px] text-danger-700 dark:bg-danger-900/30 dark:text-danger-300">
                {importPreview.error}
              </div>
            )}
            {importStatus && (
              <div className="rounded-lg bg-slate-100 px-3 py-2 text-[10px] text-slate-600 dark:bg-navy-800 dark:text-slate-300">
                {importStatus}
              </div>
            )}
            <button
              type="button"
              onClick={handleImport}
              disabled={!importPayload.trim() || !onImportGraph}
              className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF]"
            >
              <Download size={14} />
              {isPl ? 'Importuj do workspace' : 'Import into workspace'}
            </button>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-200/60 dark:border-navy-700/60">
          <div className="text-[10px] text-slate-600 dark:text-slate-500">
            {isPl
              ? `${graphNodes.length} elementów, ${graphEdges.length} połączeń`
              : `${graphNodes.length} elements, ${graphEdges.length} connections`}
          </div>
          {!exportAllowed && (
            <div className="mt-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
              {isPl
                ? 'Eksport zablokowany przez governance whiteboard.'
                : 'Export blocked by whiteboard governance.'}
            </div>
          )}
          {exportAllowed && !shareAllowed && (
            <div className="mt-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
              {isPl
                ? 'Udostępnianie zewnętrzne jest wyłączone: deck/report pozostają niedostępne.'
                : 'External sharing is disabled: deck/report exports are unavailable.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IdeaExportMenu;
