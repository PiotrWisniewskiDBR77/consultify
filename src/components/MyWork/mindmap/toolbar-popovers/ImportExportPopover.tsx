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
import { useTranslation } from 'react-i18next';

interface ImportExportPopoverProps {
  isPl: boolean;
  onAction: (action: string) => void;
  onClose: () => void;
}

const IMPORT_ACTIONS = [
  {
    action: 'mm_import_device',
    tkey: 'myWorkMindmap.importExport.jsonMap',
    iconEl: Upload,
    labelEn: 'JSON map',
  },
  {
    action: 'mm_import_external',
    tkey: 'myWorkMindmap.importExport.xmindFreemindOpml',
    iconEl: FileUp,
    labelEn: 'XMind / FreeMind / OPML',
  },
  {
    action: 'mm_doc_to_map',
    tkey: 'myWorkMindmap.importExport.documentToMap',
    iconEl: FileText,
    labelEn: 'Document → Map',
  },
  {
    action: 'mm_voice',
    tkey: 'myWorkMindmap.importExport.voiceToNode',
    iconEl: Mic,
    labelEn: 'Voice to Node',
  },
  {
    action: 'mm_interview_to_map',
    tkey: 'myWorkMindmap.importExport.interviewsToMap',
    iconEl: MessageSquare,
    labelEn: 'Interviews → Map',
  },
];

const EXPORT_ACTIONS = [
  {
    action: 'mm_export_pdf',
    tkey: 'myWorkMindmap.importExport.exportPdf',
    iconEl: Printer,
    labelEn: 'Export PDF',
  },
  {
    action: 'mm_export_png',
    tkey: 'myWorkMindmap.importExport.png',
    iconEl: Image,
    labelEn: 'PNG',
  },
  {
    action: 'mm_export_svg',
    tkey: 'myWorkMindmap.importExport.svg',
    iconEl: Image,
    labelEn: 'SVG',
  },
  {
    action: 'mm_export_json',
    tkey: 'myWorkMindmap.importExport.json',
    iconEl: Download,
    labelEn: 'JSON',
  },
  {
    action: 'mm_export_diagram',
    tkey: 'myWorkMindmap.importExport.mermaidPlantuml',
    iconEl: Code,
    labelEn: 'Mermaid / PlantUML',
  },
  {
    action: 'mm_export_csv',
    tkey: 'myWorkMindmap.importExport.csvExcel',
    iconEl: FileText,
    labelEn: 'CSV (Excel)',
  },
  {
    action: 'mm_export_markdown',
    tkey: 'myWorkMindmap.importExport.markdownOutline',
    iconEl: List,
    labelEn: 'Markdown outline',
  },
  {
    action: 'mm_export_pptx',
    tkey: 'myWorkMindmap.importExport.htmlPresentation',
    iconEl: Presentation,
    labelEn: 'HTML Presentation',
  },
  {
    action: 'mm_embed_report',
    tkey: 'myWorkMindmap.importExport.embedInReport',
    iconEl: FileText,
    labelEn: 'Embed in report',
  },
];

export const ImportExportPopover: React.FC<ImportExportPopoverProps> = ({
  isPl: _isPl,
  onAction,
  onClose,
}) => {
  const { t } = useTranslation();
  const dispatch = (action: string) => {
    onAction(action);
    onClose();
  };

  return (
    <div
      data-testid="mindmap-import-export-popover"
      className="w-56 max-h-[420px] overflow-y-auto rounded-xl bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle dark:border-c-border-subtle shadow-xl"
    >
      <div className="px-1 py-1">
        <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary">
          {t('ideas.mindmap.import', 'Import')}
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
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-c-text-secondary dark:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors"
            >
              <Icon size={12} className="text-c-text-secondary shrink-0" />
              {t(a.tkey, a.labelEn)}
            </button>
          );
        })}
      </div>
      <div className="border-t border-c-border-subtle dark:border-c-border-subtle px-1 py-1">
        <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary">
          {t('ideas.mindmap.export', 'Export')}
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
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-c-text-secondary dark:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors"
            >
              <Icon size={12} className="text-c-text-secondary shrink-0" />
              {t(a.tkey, a.labelEn)}
            </button>
          );
        })}
      </div>
      <div className="border-t border-c-border-subtle dark:border-c-border-subtle px-1 py-1">
        <button
          data-testid="mindmap-import-export-action-mm_snapshot_history"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            dispatch('mm_snapshot_history');
          }}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-c-text-secondary dark:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors"
        >
          <Clock size={12} className="text-c-warning shrink-0" />
          {t('ideas.mindmap.versionHistory', 'Version History')}
          <span className="ml-auto text-[9px] text-c-text-secondary">⌘⇧H</span>
        </button>
      </div>
    </div>
  );
};
