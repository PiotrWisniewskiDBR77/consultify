/**
 * ToolSessionPreview — Preview pane for Tools Sessions (V3-A07)
 *
 * Wraps PreviewPaneShell with tool session content:
 * - Kicker: tool category badge (e.g., "Dynamic SWOT")
 * - Title: session name
 * - Body: status, created date, last modified, current wizard step, progress %
 * - Footer: Open session, Resume wizard, Export
 *
 * @see docs/ui-standards/03-modules/table-preview-pane-standard.md
 */

import { Download, ExternalLink, Play } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { PreviewPaneShell } from '@/components/ui/ResizableTable';

/** Tool session data (API or store shape) */
export interface ToolSession {
  id: string;
  name: string;
  toolType: string;
  status?: string;
  progress?: number;
  currentStep?: number;
  steps?: { id: string; name?: string }[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ToolSessionPreviewProps {
  session: ToolSession;
  onOpen: () => void;
  onResume: () => void;
  onExport?: () => void;
  onClose?: () => void;
}

const TOOL_TYPE_LABELS: Record<string, { en: string; pl: string }> = {
  'dynamic-swot': { en: 'Dynamic SWOT', pl: 'Dynamiczny SWOT' },
  'market-forces': { en: 'Market Forces', pl: 'Siły Rynkowe' },
  'growth-paths': { en: 'Growth Paths', pl: 'Ścieżki Wzrostu' },
  'portfolio-priority': { en: 'Portfolio Priority', pl: 'Priorytetyzacja Portfela' },
  'risk-uncertainty': { en: 'Risk & Uncertainty', pl: 'Ryzyko i Niepewność' },
  'process-automation': { en: 'Process Automation', pl: 'Automatyzacja Procesów' },
  'vsm-builder': { en: 'VSM Builder', pl: 'Konstruktor VSM' },
  'sop-builder': { en: 'SOP Builder', pl: 'Konstruktor SOP' },
  'a3-problem-solving': { en: 'A3 Problem Solving', pl: 'Rozwiązywanie Problemów A3' },
};

const getToolCategoryLabel = (toolType: string, isPolish: boolean): string => {
  const normalized = String(toolType || '')
    .toLowerCase()
    .trim();
  const labels = TOOL_TYPE_LABELS[normalized];
  if (labels) return isPolish ? labels.pl : labels.en;
  return normalized
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
};

export const ToolSessionPreview: React.FC<ToolSessionPreviewProps> = ({
  session,
  onOpen,
  onResume,
  onExport,
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const kicker = getToolCategoryLabel(session.toolType, isPolish);
  const createdStr = session.createdAt
    ? new Date(session.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—';
  const updatedStr = session.updatedAt
    ? new Date(session.updatedAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—';
  const stepLabel =
    session.steps?.[session.currentStep ?? 0]?.name ??
    (session.currentStep != null
      ? `${t('preview.step', 'Step')} ${(session.currentStep ?? 0) + 1}`
      : '—');
  const progress = session.progress ?? 0;

  return (
    <PreviewPaneShell
      kicker={kicker}
      title={session.name}
      onClose={onClose}
      actions={
        <button
          onClick={onOpen}
          className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-navy-800/60 transition-colors"
          title={t('preview.openSession', 'Open session')}
        >
          <ExternalLink size={14} />
        </button>
      }
      footer={
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onOpen}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-primary-500/15 text-primary-600 dark:text-primary-400 hover:bg-primary-500/25 transition-colors"
          >
            <ExternalLink size={14} />
            {t('preview.openSession', 'Open session')}
          </button>
          <button
            onClick={onResume}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors"
          >
            <Play size={14} />
            {t('preview.resumeWizard', 'Resume wizard')}
          </button>
          {onExport && (
            <button
              onClick={onExport}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors"
            >
              <Download size={14} />
              {t('preview.export', 'Export')}
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <span className="text-slate-500 dark:text-slate-400">
            {t('preview.status', 'Status')}
          </span>
          <span className="text-slate-900 dark:text-white">
            {session.status ? String(session.status).replace(/_/g, ' ') : '—'}
          </span>

          <span className="text-slate-500 dark:text-slate-400">
            {t('preview.created', 'Created')}
          </span>
          <span className="text-slate-300 dark:text-slate-300">{createdStr}</span>

          <span className="text-slate-500 dark:text-slate-400">
            {t('preview.lastModified', 'Last modified')}
          </span>
          <span className="text-slate-300 dark:text-slate-300">{updatedStr}</span>

          <span className="text-slate-500 dark:text-slate-400">
            {t('preview.currentStep', 'Current step')}
          </span>
          <span className="text-slate-300 dark:text-slate-300">{stepLabel}</span>

          <span className="text-slate-500 dark:text-slate-400">
            {t('preview.progress', 'Progress')}
          </span>
          <span className="text-slate-300 dark:text-slate-300">{progress}%</span>
        </div>
      </div>
    </PreviewPaneShell>
  );
};

export default ToolSessionPreview;
