/**
 * InitiativePreview — Preview pane for Initiatives hub (V3-A07)
 *
 * Wraps PreviewPaneShell with initiative content:
 * - Kicker: initiative level badge
 * - Title: initiative name
 * - Body: description (truncated), status, owner, priority, start date, target date, tool sessions count
 * - Footer: Open, Edit status
 *
 * @see docs/ui-standards/03-modules/table-preview-pane-standard.md
 */

import { ExternalLink, Pencil } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { PreviewPaneShell } from '@/components/ui/ResizableTable';
import i18n from '@/i18n';

/** Initiative data for preview (core/domain shape) */
export interface Initiative {
  id: string;
  name: string;
  title?: string;
  description?: string;
  summary?: string;
  status?: string;
  priority?: string;
  owner?: string;
  ownerName?: string;
  ownerBusiness?: { firstName?: string; lastName?: string };
  ownerExecution?: { firstName?: string; lastName?: string } | string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  startDate?: string;
  endDate?: string;
  toolSessionsCount?: number;
  [key: string]: unknown;
}

export interface InitiativePreviewProps {
  initiative: Initiative;
  onOpen: () => void;
  onEditStatus?: () => void;
  onClose?: () => void;
}

const getInitiativeLevelLabel = (status?: string, isPolish?: boolean): string => {
  if (!status) return i18n.t('initiatives.initiativePreview.initiative');
  const upper = String(status).toUpperCase();
  const labels: Record<string, { en: string; pl: string }> = {
    DRAFT: { en: 'Draft', pl: 'Szkic' },
    PENDING_REVIEW: { en: 'Pending Review', pl: 'Do przeglądu' },
    REVIEW: { en: 'Review', pl: 'Przegląd' },
    PROMOTED: { en: 'Promoted', pl: 'Promowana' },
    PLANNING: { en: 'Planning', pl: 'Planowanie' },
    APPROVED: { en: 'Approved', pl: 'Zatwierdzona' },
    SCHEDULED: { en: 'Scheduled', pl: 'Zaplanowana' },
    EXECUTING: { en: 'Executing', pl: 'W realizacji' },
    BLOCKED: { en: 'Blocked', pl: 'Zablokowana' },
    DONE: { en: 'Done', pl: 'Zakończona' },
    TRACKING: { en: 'Tracking', pl: 'Śledzenie' },
    CANCELLED: { en: 'Cancelled', pl: 'Anulowana' },
    ARCHIVED: { en: 'Archived', pl: 'Zarchiwizowana' },
  };
  const entry = labels[upper];
  return entry ? (isPolish ? entry.pl : entry.en) : status;
};

export const InitiativePreview: React.FC<InitiativePreviewProps> = ({
  initiative,
  onOpen,
  onEditStatus,
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const title = initiative.name || initiative.title || '—';
  const kicker = getInitiativeLevelLabel(initiative.status, isPolish);
  const description = initiative.description || initiative.summary || '';
  const truncatedDesc =
    description.length > 200 ? `${description.slice(0, 200)}…` : description || '—';

  const owner =
    initiative.ownerName ??
    (initiative.ownerBusiness
      ? `${initiative.ownerBusiness.firstName ?? ''} ${initiative.ownerBusiness.lastName ?? ''}`.trim()
      : initiative.owner) ??
    '—';

  const startStr =
    initiative.plannedStartDate || initiative.startDate
      ? new Date(initiative.plannedStartDate || initiative.startDate!).toLocaleDateString(
          undefined,
          {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          }
        )
      : '—';
  const targetStr =
    initiative.plannedEndDate || initiative.endDate
      ? new Date(initiative.plannedEndDate || initiative.endDate!).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : '—';

  return (
    <PreviewPaneShell
      kicker={kicker}
      title={title}
      onClose={onClose}
      actions={
        <button
          onClick={onOpen}
          className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-navy-800/60 transition-colors"
          title={t('preview.open', 'Open')}
        >
          <ExternalLink size={14} />
        </button>
      }
      footer={
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onOpen}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-c-info/15 text-c-info dark:text-c-info hover:bg-c-info/25 transition-colors"
          >
            <ExternalLink size={14} />
            {t('preview.open', 'Open')}
          </button>
          {onEditStatus && (
            <button
              onClick={onEditStatus}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors"
            >
              <Pencil size={14} />
              {t('preview.editStatus', 'Edit status')}
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-3 text-sm">
        {truncatedDesc !== '—' && (
          <p className="text-slate-300 dark:text-slate-300 line-clamp-4">{truncatedDesc}</p>
        )}
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <span className="text-slate-500 dark:text-slate-400">
            {t('preview.status', 'Status')}
          </span>
          <span className="text-slate-900 dark:text-white">
            {initiative.status ? getInitiativeLevelLabel(initiative.status, isPolish) : '—'}
          </span>

          <span className="text-slate-500 dark:text-slate-400">{t('preview.owner', 'Owner')}</span>
          <span className="text-slate-300 dark:text-slate-300">{owner}</span>

          <span className="text-slate-500 dark:text-slate-400">
            {t('preview.priority', 'Priority')}
          </span>
          <span className="text-slate-300 dark:text-slate-300">{initiative.priority ?? '—'}</span>

          <span className="text-slate-500 dark:text-slate-400">
            {t('preview.startDate', 'Start date')}
          </span>
          <span className="text-slate-300 dark:text-slate-300">{startStr}</span>

          <span className="text-slate-500 dark:text-slate-400">
            {t('preview.targetDate', 'Target date')}
          </span>
          <span className="text-slate-300 dark:text-slate-300">{targetStr}</span>

          {initiative.toolSessionsCount != null && (
            <>
              <span className="text-slate-500 dark:text-slate-400">
                {t('preview.toolSessions', 'Tool sessions')}
              </span>
              <span className="text-slate-300 dark:text-slate-300">
                {initiative.toolSessionsCount}
              </span>
            </>
          )}
        </div>
      </div>
    </PreviewPaneShell>
  );
};

export default InitiativePreview;
