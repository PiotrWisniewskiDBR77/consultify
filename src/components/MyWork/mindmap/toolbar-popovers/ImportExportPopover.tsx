import {
  Clock,
  Code,
  Download,
  FileText,
  FileUp,
  Image,
  List,
  MessageSquare,
  Mic,
  Presentation,
  Printer,
  Upload,
} from 'lucide-react';
import React from 'react';

interface ImportExportPopoverProps {
  isPl: boolean;
  onAction: (action: string) => void;
  onClose: () => void;
}

const IMPORT_ACTIONS = [
  { action: 'mm_import_device', iconEl: Upload, labelPl: 'Mapa JSON', labelEn: 'JSON map' },
  {
    action: 'mm_import_external',
    iconEl: FileUp,
    labelPl: 'XMind / FreeMind / OPML',
    labelEn: 'XMind / FreeMind / OPML',
  },
  {
    action: 'mm_doc_to_map',
    iconEl: FileText,
    labelPl: 'Dokument → Mapa',
    labelEn: 'Document → Map',
  },
  { action: 'mm_voice', iconEl: Mic, labelPl: 'Mów pomysły (Voice)', labelEn: 'Voice to Node' },
  {
    action: 'mm_interview_to_map',
    iconEl: MessageSquare,
    labelPl: 'Wywiady → Mapa',
    labelEn: 'Interviews → Map',
  },
];

const EXPORT_ACTIONS = [
  { action: 'mm_export_pdf', iconEl: Printer, labelPl: 'Eksport PDF', labelEn: 'Export PDF' },
  { action: 'mm_export_png', iconEl: Image, labelPl: 'PNG', labelEn: 'PNG' },
  { action: 'mm_export_svg', iconEl: Image, labelPl: 'SVG', labelEn: 'SVG' },
  { action: 'mm_export_json', iconEl: Download, labelPl: 'JSON', labelEn: 'JSON' },
  {
    action: 'mm_export_diagram',
    iconEl: Code,
    labelPl: 'Mermaid / PlantUML',
    labelEn: 'Mermaid / PlantUML',
  },
  { action: 'mm_export_csv', iconEl: FileText, labelPl: 'CSV (Excel)', labelEn: 'CSV (Excel)' },
  {
    action: 'mm_export_markdown',
    iconEl: List,
    labelPl: 'Markdown (konspekt)',
    labelEn: 'Markdown outline',
  },
  {
    action: 'mm_export_pptx',
    iconEl: Presentation,
    labelPl: 'Prezentacja (PPTX)',
    labelEn: 'Presentation (PPTX)',
  },
  {
    action: 'mm_embed_report',
    iconEl: FileText,
    labelPl: 'Osadź w raporcie',
    labelEn: 'Embed in report',
  },
];

export const ImportExportPopover: React.FC<ImportExportPopoverProps> = ({
  isPl,
  onAction,
  onClose,
}) => {
  const dispatch = (action: string) => {
    onAction(action);
    onClose();
  };

  return (
    <div
      data-testid="mindmap-import-export-popover"
      className="w-56 max-h-[420px] overflow-y-auto rounded-xl bg-white dark:bg-navy-900 border border-slate-200/60 dark:border-white/[0.06] shadow-xl"
    >
      <div className="px-1 py-1">
        <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">
          {isPl ? 'Import' : 'Import'}
        </div>
        {IMPORT_ACTIONS.map((a) => {
          const Icon = a.iconEl;
          return (
            <button
              key={a.action}
              data-testid={`mindmap-import-export-action-${a.action}`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                dispatch(a.action);
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
            >
              <Icon size={12} className="text-slate-400 shrink-0" />
              {isPl ? a.labelPl : a.labelEn}
            </button>
          );
        })}
      </div>
      <div className="border-t border-slate-200/30 dark:border-white/[0.04] px-1 py-1">
        <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">
          {isPl ? 'Eksport' : 'Export'}
        </div>
        {EXPORT_ACTIONS.map((a) => {
          const Icon = a.iconEl;
          return (
            <button
              key={a.action}
              data-testid={`mindmap-import-export-action-${a.action}`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                dispatch(a.action);
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
            >
              <Icon size={12} className="text-slate-400 shrink-0" />
              {isPl ? a.labelPl : a.labelEn}
            </button>
          );
        })}
      </div>
      <div className="border-t border-slate-200/30 dark:border-white/[0.04] px-1 py-1">
        <button
          data-testid="mindmap-import-export-action-mm_snapshot_history"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            dispatch('mm_snapshot_history');
          }}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
        >
          <Clock size={12} className="text-amber-500 shrink-0" />
          {isPl ? 'Historia wersji' : 'Version History'}
          <span className="ml-auto text-[9px] text-slate-400">⌘⇧H</span>
        </button>
      </div>
    </div>
  );
};
