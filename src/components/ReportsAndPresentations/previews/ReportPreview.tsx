import { FileDown, ClipboardCheck } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { PreviewActionBar } from '@/components/shared/PreviewPane/PreviewActionBar';
import { PreviewMetaCard, type MetaPill } from '@/components/shared/PreviewPane/PreviewMetaCard';
import { statusChipTone } from '@/components/ui/primitives/chips/EntityStatusChip';

import { reportTypeLabel, statusLabel } from '../previewLabels';
import {
  TrustStatePreviewSection,
  type TrustStatePreviewSectionProps,
} from '../TrustStatePreviewSection';
import type { ReportItem } from '../types';

type ReportPreviewFooterProps = {
  report: ReportItem;
  onStartReview?: () => Promise<void>;
  reviewActionDisabled?: boolean;
  onExport?: () => Promise<void> | void;
};

type ReportPreviewBodyProps = {
  report: ReportItem;
  trustProps?: TrustStatePreviewSectionProps;
};

/**
 * Report preview body — TABLE_AND_PREVIEW_CANON §7.3 meta bar.
 * Single title lives in the panel header (PreviewPaneShell); this renders the
 * meta bar (status chip + type/owner pills, localized) + Trust state. Raw enum
 * keys and bare English are gone; empty owner falls back to "—" (§0.12).
 */
export const ReportPreviewBody: React.FC<ReportPreviewBodyProps> = ({ report, trustProps }) => {
  const { t } = useTranslation();
  const DASH = '—';

  const pills: MetaPill[] = [
    {
      label: statusLabel(t, report.status),
      tone: (['info', 'neutral', 'success', 'warning', 'danger'] as const).includes(
        statusChipTone(report.status) as never
      )
        ? (statusChipTone(report.status) as MetaPill['tone'])
        : 'neutral',
    },
    {
      label: t('common.type', 'Type'),
      value: reportTypeLabel(t, report.reportType) || DASH,
      tone: 'neutral',
    },
    {
      label: t('common.owner', 'Owner'),
      value: report.owner?.trim() || DASH,
      tone: 'neutral',
    },
  ];

  return (
    <div className="space-y-3">
      <PreviewMetaCard pills={pills} />
      {trustProps ? <TrustStatePreviewSection {...trustProps} /> : null}
    </div>
  );
};

/**
 * Report preview footer — canon §7.3b: actions via PreviewActionBar.
 * "Updated" meta moves to a muted line above the action pills. Export/Review
 * are the only non-duplicated actions here (Open lives in the panel header).
 */
export const ReportPreviewFooter: React.FC<ReportPreviewFooterProps> = ({
  report,
  onStartReview,
  reviewActionDisabled = false,
  onExport,
}) => {
  const { t } = useTranslation();

  const buttons = [
    onExport
      ? {
          label: t('common.export', 'Export'),
          icon: FileDown,
          onClick: () => void onExport(),
          colorScheme: 'neutral' as const,
        }
      : null,
    onStartReview
      ? {
          label: t('reports.preview.startReview', 'Start review'),
          icon: ClipboardCheck,
          onClick: () => void onStartReview(),
          colorScheme: 'primary' as const,
          disabled: reviewActionDisabled,
        }
      : null,
  ].filter(Boolean) as NonNullable<
    Parameters<typeof PreviewActionBar>[0]['rows']
  >[number]['buttons'];

  return (
    <div className="space-y-2.5">
      {report.updatedAt ? (
        <div className="text-[11px] text-c-text-muted">
          {t('common.updated', 'Updated')}: {report.updatedAt}
        </div>
      ) : null}
      {buttons.length > 0 ? <PreviewActionBar rows={[{ buttons }]} /> : null}
    </div>
  );
};
