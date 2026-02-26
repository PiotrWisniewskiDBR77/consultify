/**
 * InterviewInsightPreview — Preview pane for Insights tab (App Table Standard)
 *
 * Wraps PreviewPaneShell with insight-specific content:
 * - Kicker: "Insight"
 * - Title: insight title
 * - Body: key fields (type, source interview, date, confidence)
 * - Footer: quick actions (Open full, Mark reviewed)
 *
 * @see docs/ui-standards/03-modules/table-preview-pane-standard.md
 */

import { Check, ExternalLink } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { PreviewPaneShell } from '@/components/ui/ResizableTable';

export interface InterviewInsight {
  id: string;
  sessionId?: string;
  title: string;
  content?: string;
  type?: string;
  insightType?: string;
  promptType?: string;
  confidence?: string;
  status?: string;
  sourceSessionCount?: number;
  createdAt?: string;
  createdBy?: string;
}

export interface InterviewInsightPreviewProps {
  insight: InterviewInsight | null;
  onClose: () => void;
  onOpenFull: (id: string) => void;
  onMarkReviewed?: (id: string) => void;
}

const getInsightTypeLabel = (type?: string, isPolish?: boolean) => {
  const t = (en: string, pl: string) => (isPolish ? pl : en);
  switch ((type || 'summary').toLowerCase()) {
    case 'summary':
      return t('Summary', 'Podsumowanie');
    case 'trends':
      return t('Trends', 'Trendy');
    case 'problems':
      return t('Problems', 'Problemy');
    case 'opportunities':
      return t('Opportunities', 'Szanse');
    case 'recommendations':
      return t('Recommendations', 'Rekomendacje');
    default:
      return type || '—';
  }
};

export const InterviewInsightPreview: React.FC<InterviewInsightPreviewProps> = ({
  insight,
  onClose,
  onOpenFull,
  onMarkReviewed,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  if (!insight) {
    return (
      <PreviewPaneShell
        kicker={isPolish ? 'Wnioski' : 'Insight'}
        title={isPolish ? 'Wybierz wniosek' : 'Select an insight'}
        onClose={onClose}
      >
        <div className="h-full flex items-center justify-center p-6 text-center">
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {isPolish
              ? 'Kliknij wiersz w tabeli, aby zobaczyć podgląd.'
              : 'Click a row to preview.'}
          </div>
        </div>
      </PreviewPaneShell>
    );
  }

  const type = (insight.promptType || insight.insightType || insight.type || 'summary') as string;
  const sourceLabel = insight.sourceSessionCount
    ? `${insight.sourceSessionCount} ${isPolish ? 'sesji' : 'sessions'}`
    : insight.sessionId
      ? `${isPolish ? 'Sesja' : 'Session'} ${insight.sessionId.slice(0, 8)}…`
      : '—';

  const dateStr = insight.createdAt
    ? new Date(insight.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—';

  return (
    <PreviewPaneShell
      kicker={isPolish ? 'Wnioski' : 'Insight'}
      title={insight.title}
      onClose={onClose}
      actions={
        <button
          onClick={() => onOpenFull(insight.id)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-primary-500/10 text-primary-600 dark:text-primary-400 hover:bg-primary-500/20 transition-colors"
          title={isPolish ? 'Otwórz pełny widok' : 'Open full detail'}
        >
          <ExternalLink size={13} />
          {isPolish ? 'Otwórz' : 'Open'}
        </button>
      }
      footer={
        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenFull(insight.id)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-primary-500/15 text-primary-600 dark:text-primary-400 hover:bg-primary-500/25 transition-colors"
          >
            <ExternalLink size={14} />
            {isPolish ? 'Otwórz pełny' : 'Open full'}
          </button>
          {onMarkReviewed && (
            <button
              onClick={() => onMarkReviewed(insight.id)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors"
            >
              <Check size={14} />
              {isPolish ? 'Oznacz jako przejrzany' : 'Mark reviewed'}
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <span className="text-slate-500 dark:text-slate-400">{isPolish ? 'Typ' : 'Type'}</span>
          <span className="text-slate-900 dark:text-white">
            {getInsightTypeLabel(type, isPolish)}
          </span>

          <span className="text-slate-500 dark:text-slate-400">
            {isPolish ? 'Źródło' : 'Source'}
          </span>
          <span className="text-slate-900 dark:text-white">{sourceLabel}</span>

          <span className="text-slate-500 dark:text-slate-400">{isPolish ? 'Data' : 'Date'}</span>
          <span className="text-slate-900 dark:text-white">{dateStr}</span>

          {insight.confidence && (
            <>
              <span className="text-slate-500 dark:text-slate-400">
                {isPolish ? 'Pewność' : 'Confidence'}
              </span>
              <span className="text-slate-900 dark:text-white">{insight.confidence}</span>
            </>
          )}
        </div>
        {insight.content && (
          <p className="text-slate-600 dark:text-slate-400 line-clamp-4 pt-2 border-t border-slate-200 dark:border-navy-700">
            {insight.content.slice(0, 200)}
            {insight.content.length > 200 ? '…' : ''}
          </p>
        )}
      </div>
    </PreviewPaneShell>
  );
};

export default InterviewInsightPreview;
