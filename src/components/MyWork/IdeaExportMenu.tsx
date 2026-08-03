/**
 * IdeaExportMenu — Visual export options for Idea Workspace.
 *
 * Supports: PNG (html-to-image), SVG, Markdown, JSON.
 * PDF generation via jsPDF is optional and loaded dynamically.
 */
import {
  AlertTriangle,
  Code2,
  Download,
  FileImage,
  FileJson,
  FileText,
  Loader2,
  RotateCcw,
  X,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useFeatureFlagsContext } from '@/contexts/FeatureFlagsContext';
import { Api } from '@/services/api';

import {
  buildInteropMappingReport,
  parseBpmnXml,
  parseDiagramPackage,
  parseDrawIoXml,
} from './canvas/diagramInterop';
import {
  buildVectorSvg,
  captureMapRaster,
  isDarkColor,
  MapExportError,
  renderTextStrip,
  toRgbTriplet,
} from './canvas/mapExportRender';
import type { IdeaWorkspaceImportPayload } from './ideaSelectionTypes';

/**
 * L-05 / D-01 / DP-5 — Server-side idea export is OFF by default. Historically
 * `POST /v4-final/ideas/:id/export` was a pure stub (records a row, no worker ever
 * produced a file). It now has a real — but backend-flag-gated — generator for
 * `json`/`markdown` (server/src/services/finalBatchService.ts#requestAndGenerateExport,
 * env `IDEA_SERVER_EXPORT_ENABLED`, default OFF); formats needing a live canvas
 * (png/svg/pdf/…) still can't be produced server-side and the endpoint fails those
 * explicitly (501) rather than faking success. Per decision DP-5 this path stays
 * gated behind THIS client flag: when off (default), no request is fired at all and
 * no "server export" affordance is presented as a working action — all genuinely
 * working exports run entirely CLIENT-side (PNG/SVG/PDF/Markdown/JSON/package/mapping/
 * share) and never depend on the server round-trip. Report/presentation NIE naleza
 * juz tutaj — to Konwersja (P1-7/D6), przeniesiona do panelu Konwertuj.
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
    // Nazwa „wektor" byla wczesniej NIEPRAWDZIWA: eksport produkowal jeden
    // <foreignObject> z surowym XHTML (0 elementow <text>), ktorego edytory
    // wektorowe nie renderuja. Od naprawy eksportu rysujemy realne prymitywy
    // SVG, wiec opis moze to obiecywac wprost.
    descPl: 'Krzywe i tekst do edycji — Illustrator, Inkscape, Figma',
    descEn: 'Editable shapes and text — Illustrator, Inkscape, Figma',
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
  // P1-7 / D6 (docs/standards/idea-workspace/10_KONWERSJA_EKSPORT_IMPORT_SZABLONY.md §3):
  // pozycje „Raport" i „Prezentacja (deck)" (V5-IDEA-40) zostaly STAD USUNIETE.
  // Nie produkowaly pliku — dispatchowaly `convert_report`/`convert_presentation`,
  // czyli tworzyly TRWALY REKORD w module Reports/Presentations. To jest Konwersja,
  // nie Eksport. Byly zarazem duplikatem: rejestr konwersji (`ideaConvertTargets.ts`)
  // ma `report` i `presentation` jako `live`, a panel Konwersji (IdeaWorkspaceTools,
  // grupa „Generatory dokumentow") wola dokladnie ten sam `handleConvert`.
  // Ten dropdown zawiera odtad WYLACZNIE formaty tworzace plik do pobrania.
];

// P0-2 (docs/standards/idea-workspace/10_KONWERSJA_EKSPORT_IMPORT_SZABLONY.md §4.1):
// human-readable source labels for the destructive-import guard rail. Mirrors
// the <option> labels below — kept as a separate map so the confirm/summary
// copy can quote the source format without re-deriving it from the <select>.
const IMPORT_FORMAT_LABELS: Record<'drawio_xml' | 'bpmn_xml' | 'diagram_package', string> = {
  drawio_xml: 'draw.io XML',
  bpmn_xml: 'BPMN XML',
  diagram_package: 'Diagram package JSON',
};

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
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  // P0-2 guard rail (docs/standards/idea-workspace/10_KONWERSJA_EKSPORT_IMPORT_SZABLONY.md
  // §4.1) is a visual change → stays behind a flag OFF by default until Piotr accepts the
  // dev-render screenshots (rule #7, CLAUDE.md). OFF preserves today's exact behavior
  // (immediate, unconfirmed replace) via legacyImport below.
  const { isEnabled } = useFeatureFlagsContext();
  const importGuardRailEnabled = isEnabled('ideaImportGuardRail');
  const [exporting, setExporting] = useState<string | null>(null);
  // Bez cichych podmian formatu (patrz `reportExportFailure`): nieudany eksport
  // zostawia tu KONKRETNY powod, ktory widac w oknie, zamiast po cichu podac
  // uzytkownikowi inny plik niz ten, ktory kliknal.
  const [exportError, setExportError] = useState<{
    formatId: string;
    formatLabel: string;
    reason: string;
  } | null>(null);
  const [importFormat, setImportFormat] = useState<'drawio_xml' | 'bpmn_xml' | 'diagram_package'>(
    'drawio_xml'
  );
  const [importPayload, setImportPayload] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  // P0-2 guard rail: parsing no longer imports immediately — it stages the
  // parsed graph here until the user explicitly confirms the replacement.
  const [pendingImport, setPendingImport] = useState<{
    parsed: {
      nodes: any[];
      edges: any[];
      extensions?: Record<string, unknown>;
      mappingReport?: string[];
    };
    sourceFormat: 'drawio_xml' | 'bpmn_xml' | 'diagram_package';
  } | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  // Post-import summary + one-click undo. beforeSnapshot is the graph as it
  // stood immediately before the destructive replace — kept in memory so
  // "Cofnij" works instantly even if the best-effort server snapshot below
  // failed to persist.
  const [importSummary, setImportSummary] = useState<{
    importedNodes: number;
    importedEdges: number;
    previousNodes: number;
    previousEdges: number;
    sourceLabel: string;
    beforeSnapshot: { nodes: any[]; edges: any[]; extensions?: Record<string, unknown> };
  } | null>(null);
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
  // P1-7: `sharePolicy.shareAllowed` bramkowalo TYLKO pozycje „Raport"/„Prezentacja",
  // ktore wyjechaly stad do Konwersji (D6). W tym oknie nie ma juz czego bramkowac,
  // wiec pole nie jest tu czytane. UWAGA — bramka NIE zostala przeniesiona na sciezke
  // Konwersji (panel Konwertuj nie dostaje `extensions`); to osobne zadanie.

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
        error: error?.message || t('myWorkIdeas.exportMenu.importFailed'),
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

  // Nazwa pliku zachowuje polskie znaki — poprzednia maska `[^a-zA-Z0-9_-]`
  // robila z „Wejscie na rynek DACH" plik `Wej_cie_na_rynek_DACH`. Usuwamy
  // tylko znaki wrogie systemom plikow.
  const safeFilename =
    (title || '')
      // Control characters are intentionally excluded from exported filenames.
      // eslint-disable-next-line no-control-regex
      .replace(/[\\/:*?"<>| -]/g, ' ')
      .trim()
      .replace(/\s+/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60) || 'idea-map';

  const formatLabel = useCallback(
    (formatId: string) => {
      const format = FORMATS.find((entry) => entry.id === formatId);
      if (!format) return formatId.toUpperCase();
      return isPl ? format.labelPl : format.labelEn;
    },
    [isPl]
  );

  /**
   * ZERO CICHYCH PODMIAN FORMATU.
   *
   * Wczesniej `exportPNG`/`exportSVG` mialy `catch { exportJSON(); }`, a
   * `exportPDF` — `catch { exportPNG(); }`. Uzytkownik klikal „PDF", dostawal
   * PNG (albo JSON) i nie mial ZADNEJ informacji, ze cos poszlo nie tak: brak
   * komunikatu, brak logu, inny plik w Pobranych. To najgorszy z trzech
   * defektow eksportu, bo niszczy zaufanie do calego okna.
   *
   * Teraz: mowimy CO sie stalo i CZEGO nie ma, a zapasowy JSON jest OFERTA
   * (przycisk w oknie), nie decyzja podjeta za plecami uzytkownika.
   */
  const reportExportFailure = useCallback(
    (formatId: string, error: unknown) => {
      const code = error instanceof MapExportError ? error.code : 'render_failed';
      const detail = (error as Error)?.message || '';
      const reason =
        code === 'canvas_not_found'
          ? t('myWorkIdeas.exportMenu.exportFailedCanvasNotFound')
          : code === 'empty_map'
            ? t('myWorkIdeas.exportMenu.exportFailedEmptyMap')
            : t('myWorkIdeas.exportMenu.exportFailedRender', { reason: detail });
      setExportError({ formatId, formatLabel: formatLabel(formatId), reason });
      toast.error(
        t('myWorkIdeas.exportMenu.exportFailedToast', { format: formatLabel(formatId) }),
        { id: 'idea-export-failed' }
      );
      // Diagnostyka dla wsparcia — bez tego nieudany eksport nie zostawial sladu.
      console.error('[IdeaExportMenu] export failed', { formatId, code, error });
    },
    [formatLabel, t]
  );

  const exportPNG = useCallback(async () => {
    setExporting('png');
    setExportError(null);
    try {
      const container = canvasContainerRef?.current;
      if (!container) throw new MapExportError('canvas_not_found', 'canvasContainerRef is empty');
      const capture = await captureMapRaster(container);
      const res = await fetch(capture.dataUrl);
      const blob = await res.blob();
      downloadBlob(blob, `${safeFilename}.png`);
    } catch (error) {
      reportExportFailure('png', error);
    } finally {
      setExporting(null);
    }
  }, [canvasContainerRef, downloadBlob, reportExportFailure, safeFilename]);

  const exportSVG = useCallback(() => {
    setExporting('svg');
    setExportError(null);
    try {
      const container = canvasContainerRef?.current;
      if (!container) throw new MapExportError('canvas_not_found', 'canvasContainerRef is empty');
      // Etykiety bierzemy z danych grafu, nie z DOM — DOM ma je pocięte na
      // wiersze i wymieszane z odznakami/licznikami.
      const labelsById = new Map<string, string>(
        graphNodes.map((node: any) => [String(node.id), String(node.data?.label ?? '')])
      );
      const svgContent = buildVectorSvg(container, {
        labelsById,
        title: title || 'Idea Map',
        footer: `${exportFooter} • ${title || 'Map'} • ${new Date().toISOString().slice(0, 10)}`,
      });
      downloadText(svgContent, `${safeFilename}.svg`, 'image/svg+xml');
    } catch (error) {
      reportExportFailure('svg', error);
    } finally {
      setExporting(null);
    }
  }, [
    canvasContainerRef,
    downloadText,
    exportFooter,
    graphNodes,
    reportExportFailure,
    safeFilename,
    title,
  ]);

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
    setExportError(null);
    try {
      const container = canvasContainerRef?.current;
      if (!container) throw new MapExportError('canvas_not_found', 'canvasContainerRef is empty');
      const capture = await captureMapRaster(container);
      const { jsPDF } = await import('jspdf');

      // Orientacja idzie za ksztaltem mapy — mapa pionowa na poziomej kartce
      // marnowala ~40% strony (plik wlasciciela: obraz 331 pkt na stronie 595).
      const landscape = capture.widthPx >= capture.heightPx;
      const pdf = new jsPDF({
        orientation: landscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4',
        // Bez kompresji raster szedl do pliku jako surowy DeviceRGB — PDF
        // wlasciciela wazyl 15 MB przy jednej stronie.
        compress: true,
      });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const footerBand = 8;
      const maxW = pageW - 2 * margin;
      const maxH = pageH - 2 * margin - footerBand;

      // Tlo strony = tlo eksportu, zeby ciemny raster nie lezal na bialej
      // kartce z bialymi pasami dookola.
      const [bgR, bgG, bgB] = toRgbTriplet(capture.background);
      pdf.setFillColor(bgR, bgG, bgB);
      pdf.rect(0, 0, pageW, pageH, 'F');

      // Dopasowanie do strony z zachowaniem proporcji + wysrodkowanie w obu osiach.
      const aspect = capture.heightPx / capture.widthPx;
      let imgW = maxW;
      let imgH = imgW * aspect;
      if (imgH > maxH) {
        imgH = maxH;
        imgW = imgH / aspect;
      }
      const x = margin + (maxW - imgW) / 2;
      const y = margin + (maxH - imgH) / 2;
      pdf.addImage(capture.dataUrl, 'PNG', x, y, imgW, imgH, undefined, 'FAST');

      // Stopka jako obraz — patrz `renderTextStrip`: standardowa Helvetica w PDF
      // jest jednobajtowa (WinAnsi) i nie ma polskich diakrytykow, przez co
      // „Wejscie" wychodzilo jako „Wej[cie".
      const dark = isDarkColor(capture.background);
      const strip = renderTextStrip(
        `Exported from ${exportFooter} • ${title || 'Map'} • ${new Date().toISOString().slice(0, 10)}`,
        {
          color: dark ? '#94a3b8' : '#6b7280',
          background: capture.background,
          fontPx: 11,
          scale: 4,
        }
      );
      if (strip) {
        const ratio = strip.widthPx / strip.heightPx;
        let stripH = 3.6;
        let stripW = stripH * ratio;
        if (stripW > maxW) {
          stripW = maxW;
          stripH = stripW / ratio;
        }
        pdf.addImage(strip.dataUrl, 'PNG', margin, pageH - margin / 2 - stripH, stripW, stripH);
      }
      pdf.save(`${safeFilename}.pdf`);
    } catch (error) {
      reportExportFailure('pdf', error);
    } finally {
      setExporting(null);
    }
  }, [canvasContainerRef, exportFooter, reportExportFailure, safeFilename, title]);

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

  // Flag OFF (default): today's exact behavior — parse and replace immediately,
  // no confirmation, no pre-change snapshot. Kept only so the guard rail above
  // stays an additive, reversible change (flip the flag off → old behavior back).
  const legacyImport = useCallback(() => {
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
        t('myWorkIdeas.exportMenu.importedNodesEdges', {
          nodes: parsed.nodes.length,
          edges: parsed.edges.length,
        })
      );
      setImportPayload('');
      onClose();
    } catch (err: any) {
      setImportStatus(err?.message || t('myWorkIdeas.exportMenu.importFailed'));
    }
  }, [importFormat, importPayload, importPreview, onClose, onImportGraph, t]);

  // Flag ON — P0-2 guard rail.
  // Step 1 (podgląd już istnieje w importPreview powyżej) → Step 2: staging.
  // Parses eagerly (so a bad payload fails here, not after the user confirms)
  // but does NOT touch the workspace graph yet — that only happens in
  // confirmImport, after the user has seen exactly what will be lost/gained.
  const requestGuardedImport = useCallback(() => {
    if (!importPayload.trim() || !onImportGraph) return;
    try {
      const parsed = importPreview?.ok
        ? importPreview.parsed
        : importFormat === 'drawio_xml'
          ? parseDrawIoXml(importPayload)
          : importFormat === 'bpmn_xml'
            ? parseBpmnXml(importPayload)
            : parseDiagramPackage(importPayload);
      setImportStatus(null);
      setPendingImport({ parsed, sourceFormat: importFormat });
    } catch (err: any) {
      setImportStatus(err?.message || t('myWorkIdeas.exportMenu.importFailed'));
    }
  }, [importFormat, importPayload, importPreview, onImportGraph, t]);

  const requestImport = importGuardRailEnabled ? requestGuardedImport : legacyImport;

  const cancelPendingImport = useCallback(() => {
    setPendingImport(null);
  }, []);

  // Step 3+4: jawne potwierdzenie już się dokonało (użytkownik kliknął
  // "Potwierdź i zastąp") → snapshot PRZED zmianą (best-effort na backendzie,
  // zawsze trzymany lokalnie), DOPIERO POTEM wykonanie importu (P0-2).
  const confirmImport = useCallback(async () => {
    if (!pendingImport || !onImportGraph) return;
    setImportBusy(true);
    const beforeSnapshot = {
      nodes: graphNodes,
      edges: graphEdges,
      extensions,
    };
    try {
      await Api.createMyIdeaMapSnapshot(ideaId, {
        label: t('myWorkIdeas.exportMenu.beforeImportSnapshotLabel', {
          sourceFormat: IMPORT_FORMAT_LABELS[pendingImport.sourceFormat],
        }),
        nodes: graphNodes,
        edges: graphEdges,
        ...(extensions ? { extensions } : {}),
      }).catch(() => null);

      onImportGraph({
        ideaId,
        sourceFormat: pendingImport.sourceFormat,
        nodes: pendingImport.parsed.nodes,
        edges: pendingImport.parsed.edges,
        extensions: pendingImport.parsed.extensions,
        mappingReport: pendingImport.parsed.mappingReport,
      });

      setImportSummary({
        importedNodes: pendingImport.parsed.nodes.length,
        importedEdges: pendingImport.parsed.edges.length,
        previousNodes: graphNodes.length,
        previousEdges: graphEdges.length,
        sourceLabel: IMPORT_FORMAT_LABELS[pendingImport.sourceFormat],
        beforeSnapshot,
      });
      setImportPayload('');
      setPendingImport(null);
      setImportStatus(null);
    } finally {
      setImportBusy(false);
    }
  }, [pendingImport, onImportGraph, graphNodes, graphEdges, extensions, ideaId, t]);

  // Step 7: cofnięcie jednym klikiem — replays the pre-import snapshot through
  // the SAME import path (captures a fresh checkpoint too, so redo stays
  // possible from Historia).
  const undoImport = useCallback(() => {
    if (!importSummary || !onImportGraph) return;
    onImportGraph({
      ideaId,
      sourceFormat: 'diagram_package',
      title: t('myWorkIdeas.exportMenu.undoImportTitle'),
      nodes: importSummary.beforeSnapshot.nodes,
      edges: importSummary.beforeSnapshot.edges,
      extensions: importSummary.beforeSnapshot.extensions,
    });
    setImportStatus(t('myWorkIdeas.exportMenu.undoImportDone'));
    setImportSummary(null);
  }, [importSummary, onImportGraph, ideaId, t]);

  // P1-7 / D6: `exportToReport` i `exportToPresentation` (dispatch `convert_report` /
  // `convert_presentation`) usuniete razem z pozycjami menu — konwersja odbywa sie
  // wylacznie sciezka Konwersji (panel „Konwertuj" → `handleConvert`).
  const canExportFormat = useCallback(
    (formatId: string) => {
      // P1-7: warunek na `shareAllowed` dotyczyl wylacznie usunietych pozycji
      // `report`/`presentation` — po ich usunieciu byl martwy. Zostaje jedyna
      // realna bramka governance dla PLIKOW: `sharePolicy.exportAllowed`.
      void formatId;
      return exportAllowed;
    },
    [exportAllowed]
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
      setExportError(null);
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
              {t('myWorkIdeas.exportMenu.exportMap')}
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
            {importGuardRailEnabled && importSummary ? (
              // Step 6 (podsumowanie) + Step 7 (cofnięcie) — P0-2 §4.1.
              <>
                <div>
                  <div className="text-[12px] font-bold text-slate-800 dark:text-slate-100">
                    {t('myWorkIdeas.exportMenu.importSummaryTitle')}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                    {t('myWorkIdeas.exportMenu.importSummaryBody', {
                      importedNodes: importSummary.importedNodes,
                      importedEdges: importSummary.importedEdges,
                      previousNodes: importSummary.previousNodes,
                      previousEdges: importSummary.previousEdges,
                    })}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                    {t('myWorkIdeas.exportMenu.confirmReplaceSource', {
                      format: importSummary.sourceLabel,
                    })}
                  </div>
                </div>
                {importStatus && (
                  <div className="rounded-lg bg-emerald-50 px-3 py-2 text-[10px] text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                    {importStatus}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={undoImport}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200/70 dark:border-navy-700/70 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800"
                  >
                    <RotateCcw size={14} />
                    {t('myWorkIdeas.exportMenu.undoImport')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportSummary(null)}
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800"
                  >
                    {t('myWorkIdeas.exportMenu.startNewImport')}
                  </button>
                </div>
              </>
            ) : importGuardRailEnabled && pendingImport ? (
              // Step 1 (podgląd) already happened via importPreview above; this
              // is Step 2 (źródło) + Step 3 (jawne potwierdzenie) — P0-2 §4.1.
              // Nothing in the workspace graph has changed yet at this point.
              <>
                <div>
                  <div className="text-[12px] font-bold text-slate-800 dark:text-slate-100">
                    {t('myWorkIdeas.exportMenu.confirmReplaceTitle')}
                  </div>
                  <div className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 mt-1.5">
                    {/*
                      Polski ma trzy formy liczby mnogiej (1 / 2-4 / 5+), wiec
                      liczb NIE wolno wstawiac w jedno zdanie z zaszyta koncowka
                      — dawalo „wstawi 2 wezlow i 1 polaczen". Kazda liczebnosc
                      jest osobnym kluczem z odmiana, zdanie tylko je sklada.
                    */}
                    {t('myWorkIdeas.exportMenu.confirmReplaceBody', {
                      obecne: `${t('myWorkIdeas.exportMenu.nodeCount', { count: graphNodes.length })} i ${t('myWorkIdeas.exportMenu.edgeCount', { count: graphEdges.length })}`,
                      przychodzace: `${t('myWorkIdeas.exportMenu.nodeCount', { count: pendingImport.parsed.nodes.length })} i ${t('myWorkIdeas.exportMenu.edgeCount', { count: pendingImport.parsed.edges.length })}`,
                    })}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5">
                    {t('myWorkIdeas.exportMenu.confirmReplaceSource', {
                      format: IMPORT_FORMAT_LABELS[pendingImport.sourceFormat],
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={confirmImport}
                    disabled={importBusy}
                    className="inline-flex items-center gap-2 rounded-lg bg-danger-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 hover:bg-danger-700 dark:bg-danger-500 dark:hover:bg-danger-600"
                  >
                    {importBusy ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Download size={14} />
                    )}
                    {t('myWorkIdeas.exportMenu.confirmReplaceConfirm')}
                  </button>
                  <button
                    type="button"
                    onClick={cancelPendingImport}
                    disabled={importBusy}
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 disabled:opacity-50"
                  >
                    {t('myWorkIdeas.exportMenu.confirmReplaceCancel')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <div className="text-[12px] font-bold text-slate-800 dark:text-slate-100">
                    {t('myWorkIdeas.exportMenu.importInterop')}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    {t('myWorkIdeas.exportMenu.pasteDrawIoXmlBpmnXml')}
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
                  placeholder={t('myWorkIdeas.exportMenu.pasteImportPayload')}
                  className="w-full rounded-lg border border-slate-200/70 bg-white px-3 py-2 text-[11px] font-mono dark:border-navy-700/70 dark:bg-navy-950"
                />
                {importPreview?.ok && (
                  <div className="rounded-lg bg-emerald-50 px-3 py-2 text-[10px] text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                    {t('myWorkIdeas.exportMenu.readyToImport', {
                      nodes: importPreview.parsed.nodes.length,
                      edges: importPreview.parsed.edges.length,
                    })}
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
                  onClick={requestImport}
                  disabled={!importPayload.trim() || !onImportGraph}
                  className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF]"
                >
                  <Download size={14} />
                  {t('myWorkIdeas.exportMenu.importIntoWorkspace')}
                </button>
              </>
            )}
          </div>
        </div>

        {/*
          Nieudany eksport MUSI byc widoczny. Wczesniej blad byl polykany i
          uzytkownik dostawal po cichu inny format (PDF→PNG, PNG/SVG→JSON).
          Tutaj mowimy czego NIE MA, dlaczego, a zapasowy JSON jest osobnym,
          swiadomym kliknieciem.
        */}
        {exportError && (
          <div className="mx-5 mb-1 rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 dark:border-amber-500/40 dark:bg-amber-950/30">
            <div className="flex items-start gap-2">
              <AlertTriangle
                size={14}
                className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
              />
              <div className="flex-1">
                <div className="text-[12px] font-bold text-amber-800 dark:text-amber-200">
                  {t('myWorkIdeas.exportMenu.exportFailedTitle', {
                    format: exportError.formatLabel,
                  })}
                </div>
                <div className="mt-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                  {exportError.reason}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setExportError(null);
                      exportJSON();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300/70 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-500/40 dark:text-amber-200 dark:hover:bg-amber-900/40"
                  >
                    <FileJson size={12} />
                    {t('myWorkIdeas.exportMenu.exportFallbackJson')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportError(null)}
                    className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/40"
                  >
                    {t('myWorkIdeas.exportMenu.exportFailedDismiss')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="px-5 py-3 border-t border-slate-200/60 dark:border-navy-700/60">
          <div className="text-[10px] text-slate-600 dark:text-slate-500">
            {t('myWorkIdeas.exportMenu.elementsConnectionsCount', {
              elements: graphNodes.length,
              connections: graphEdges.length,
            })}
          </div>
          {!exportAllowed && (
            <div className="mt-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
              {t('myWorkIdeas.exportMenu.exportBlockedWhiteboardGovernance')}
            </div>
          )}
          {/*
            P1-7: komunikat „zewnetrzne udostepnianie wylaczone — eksport deck/raport"
            zniknal razem z pozycjami, ktorych dotyczyl. Zostawienie go tutaj byloby
            informacja o czyms, czego w tym oknie juz nie ma.
          */}
        </div>
      </div>
    </div>
  );
};

export default IdeaExportMenu;
