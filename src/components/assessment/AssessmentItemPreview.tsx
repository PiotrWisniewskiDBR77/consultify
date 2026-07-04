/**
 * AssessmentItemPreview — Preview pane for Assessment items (V3-A07)
 *
 * Wraps PreviewPaneShell with assessment item content:
 * - Kicker: assessment area/dimension
 * - Title: item/question text
 * - Body: current score, target score, gap, evidence count, recommendations count
 * - Footer: Open detail, Add evidence
 *
 * @see docs/ui-standards/03-modules/table-preview-pane-standard.md
 */

import { ExternalLink, FilePlus } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { PreviewPaneShell } from '@/components/ui/ResizableTable';

/** Assessment item data for preview */
export interface AssessmentItem {
  id: string;
  name: string;
  framework?: string;
  status?: string;
  progress?: number;
  /** Assessment area or dimension (e.g. "Process", "Technology") */
  area?: string;
  /** Current maturity score */
  currentScore?: number;
  /** Target maturity score */
  targetScore?: number;
  /** Gap (target - current) */
  gap?: number;
  /** Number of evidence items */
  evidenceCount?: number;
  /** Number of recommendations */
  recommendationsCount?: number;
  updatedAt?: Date | string;
  [key: string]: unknown;
}

export interface AssessmentItemPreviewProps {
  item: AssessmentItem;
  onOpen: () => void;
  onAddEvidence?: () => void;
  onClose?: () => void;
}

const getFrameworkLabel = (framework?: string, isPolish?: boolean): string => {
  if (!framework) return isPolish ? 'Ocena' : 'Assessment';
  const upper = String(framework).toUpperCase();
  const labels: Record<string, { en: string; pl: string }> = {
    DRD: { en: 'DRD', pl: 'DRD' },
    SIRI: { en: 'SIRI', pl: 'SIRI' },
    ADMA: { en: 'ADMA', pl: 'ADMA' },
    CMMI: { en: 'CMMI', pl: 'CMMI' },
    LEAN: { en: 'Lean 4.0', pl: 'Lean 4.0' },
  };
  const entry = labels[upper];
  return entry ? (isPolish ? entry.pl : entry.en) : framework;
};

export const AssessmentItemPreview: React.FC<AssessmentItemPreviewProps> = ({
  item,
  onOpen,
  onAddEvidence,
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const kicker = item.area ?? getFrameworkLabel(item.framework, isPolish);
  const title = item.name || '—';
  const gap =
    item.gap ??
    (item.targetScore != null && item.currentScore != null
      ? item.targetScore - item.currentScore
      : undefined);

  return (
    <PreviewPaneShell
      kicker={kicker}
      title={title}
      onClose={onClose}
      actions={
        <button
          onClick={onOpen}
          className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-navy-800/60 transition-colors"
          title={t('preview.openDetail', 'Open detail')}
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
            {t('preview.openDetail', 'Open detail')}
          </button>
          {onAddEvidence && (
            <button
              onClick={onAddEvidence}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors"
            >
              <FilePlus size={14} />
              {t('preview.addEvidence', 'Add evidence')}
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <span className="text-slate-500 dark:text-slate-400">
            {t('preview.currentScore', 'Current score')}
          </span>
          <span className="text-slate-600 dark:text-slate-300">{item.currentScore ?? '—'}</span>

          <span className="text-slate-500 dark:text-slate-400">
            {t('preview.targetScore', 'Target score')}
          </span>
          <span className="text-slate-600 dark:text-slate-300">{item.targetScore ?? '—'}</span>

          <span className="text-slate-500 dark:text-slate-400">{t('preview.gap', 'Gap')}</span>
          <span className="text-slate-600 dark:text-slate-300">{gap != null ? gap : '—'}</span>

          <span className="text-slate-500 dark:text-slate-400">
            {t('preview.evidenceCount', 'Evidence')}
          </span>
          <span className="text-slate-600 dark:text-slate-300">{item.evidenceCount ?? '—'}</span>

          <span className="text-slate-500 dark:text-slate-400">
            {t('preview.recommendationsCount', 'Recommendations')}
          </span>
          <span className="text-slate-600 dark:text-slate-300">
            {item.recommendationsCount ?? '—'}
          </span>
        </div>
      </div>
    </PreviewPaneShell>
  );
};

export default AssessmentItemPreview;
