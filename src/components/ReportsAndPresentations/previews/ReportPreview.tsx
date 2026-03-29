/**
 * ReportPreview — Preview panel for reports
 * Uses shared PreviewPane building blocks for consistent UX.
 * Exports Body + Footer for proper TableWithPreviewLayout split.
 */

import { Download, ExternalLink, ShieldCheck } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  type ActionRow,
  type MetaPill,
  PreviewActionBar,
  PreviewAIHintStrip,
  PreviewDetailsSection,
  PreviewMetaCard,
  PreviewRelations,
  type RelationItem,
} from '@/components/shared/PreviewPane';

import { REPORT_STATUS_META, REPORT_TYPE_META, type ReportItem } from '../types';

interface ReportPreviewProps {
  report: ReportItem;
  onOpen?: () => void;
  onExport?: () => void;
  onStartReview?: () => void;
  reviewActionDisabled?: boolean;
}

function useReportPreviewData(report: ReportItem) {
  const { i18n, t } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const typeMeta = REPORT_TYPE_META[report.reportType] || REPORT_TYPE_META.custom;
  const statusMeta = REPORT_STATUS_META[report.status] || REPORT_STATUS_META.draft;
  const governance = report.governance;

  const periodLabel = (() => {
    if (!report.periodFrom) return '—';
    const from = new Date(report.periodFrom).toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
      day: 'numeric',
      month: 'short',
    });
    const to = report.periodTo
      ? new Date(report.periodTo).toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : '...';
    return `${from} — ${to}`;
  })();

  const pills: MetaPill[] = [
    { label: report.reportType, className: `${typeMeta.color} bg-current/10` },
    {
      label: isPolish ? statusMeta.labelPl : statusMeta.label,
      className: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
      dot: statusMeta.dotColor,
    },
  ];

  const detailLines = [
    `${isPolish ? 'Typ raportu' : 'Report type'}: ${isPolish ? typeMeta.labelPl : typeMeta.label}`,
    `${isPolish ? 'Właściciel' : 'Owner'}: ${report.owner}`,
    `${isPolish ? 'Cel' : 'Goal'}: ${report.goal || 'Online report'}`,
    `${isPolish ? 'Rejestr komunikacji' : 'Communication register'}: ${report.communicationRegister || '—'}`,
    `${isPolish ? 'Poufność' : 'Confidentiality'}: ${report.confidentiality || '—'}`,
    `${isPolish ? 'Okres' : 'Period'}: ${periodLabel}`,
    `${isPolish ? 'Visibility' : 'Visibility'}: ${governance?.visibilityScope || '—'}`,
    `${isPolish ? 'Validation state' : 'Validation state'}: ${governance?.validationState || '—'}`,
    `${isPolish ? 'Execution state' : 'Execution state'}: ${governance?.executionState || '—'}`,
    `${isPolish ? 'Publish state' : 'Publish state'}: ${governance?.publishState || '—'}`,
    `${isPolish ? 'Review gates' : 'Review gates'}: ${governance?.reviewGateCount ?? 0}`,
    `${isPolish ? 'Project' : 'Project'}: ${governance?.projectId || '—'}`,
    `${isPolish ? 'Execution run' : 'Execution run'}: ${governance?.executionRunId || '—'}`,
    `${isPolish ? 'Export authority' : 'Export authority'}: ${governance?.authority || '—'}`,
    `${isPolish ? 'ACL control' : 'ACL control'}: ${governance?.canManageAccess ? (isPolish ? 'Can manage' : 'Can manage') : (isPolish ? 'Read only' : 'Read only')}`,
    `${isPolish ? 'Utworzony' : 'Created'}: ${new Date(report.createdAt).toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    `${isPolish ? 'Ostatnia zmiana' : 'Updated'}: ${new Date(report.updatedAt).toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}`,
  ].join('\n');

  const relations: RelationItem[] = [
    ...(report.exportFormats?.length ? report.exportFormats.map((fmt) => ({ label: fmt })) : []),
    ...(report.sourceRefs?.length
      ? [{ label: `${report.sourceRefs.length} ${isPolish ? 'powiązań' : 'references'}` }]
      : []),
    ...(governance?.originLinks?.length
      ? [{ label: `${governance.originLinks.length} ${isPolish ? 'linków pochodzenia' : 'origin links'}` }]
      : []),
    ...(governance?.publishReviewers?.length
      ? [
          {
            label: `${governance.publishReviewers.length} ${isPolish ? 'reviewerów' : 'reviewers'}`,
          },
        ]
      : []),
    ...(governance?.accessGrants?.length
      ? [
          {
            label: `${governance.accessGrants.length} ${isPolish ? 'grantów dostępu' : 'access grants'}`,
          },
        ]
      : []),
    ...(governance?.exportHistory?.length
      ? [
          {
            label: `${governance.exportHistory.length} ${isPolish ? 'śladów eksportu' : 'export traces'}`,
          },
        ]
      : []),
  ];

  return { isPolish, t, pills, detailLines, relations };
}

export const ReportPreviewBody: React.FC<ReportPreviewProps> = ({ report }) => {
  const { isPolish, pills, detailLines } = useReportPreviewData(report);

  return (
    <div className="space-y-4">
      <PreviewMetaCard pills={pills} />
      <PreviewDetailsSection text={detailLines} label={isPolish ? 'SZCZEGÓŁY' : 'DETAILS'} />
    </div>
  );
};

export const ReportPreviewFooter: React.FC<ReportPreviewProps> = ({
  report,
  onOpen,
  onExport,
  onStartReview,
  reviewActionDisabled,
}) => {
  const { isPolish, t, relations } = useReportPreviewData(report);
  const governance = report.governance;

  const actionRows: ActionRow[] = [];
  if (onOpen || onExport) {
    actionRows.push({
      buttons: [
        ...(onStartReview
          ? [
              {
                label: t('rap.actions.startReview', 'Start review'),
                icon: ShieldCheck,
                onClick: onStartReview,
                colorScheme: 'purple' as const,
                disabled: reviewActionDisabled,
                shortcut: 'R',
              },
            ]
          : []),
        ...(onOpen
          ? [
              {
                label: t('rap.preview.openFull', 'Otwórz pełny'),
                icon: ExternalLink,
                onClick: onOpen,
                colorScheme: 'primary' as const,
                flex: true,
                shortcut: 'O',
              },
            ]
          : []),
        ...(onExport
          ? [
              {
                label: t('rap.actions.export', 'Eksportuj'),
                icon: Download,
                onClick: onExport,
                colorScheme: 'neutral' as const,
                shortcut: 'E',
              },
            ]
          : []),
      ],
    });
  }

  const dividerClass = 'border-t border-slate-200/50 dark:border-white/[0.06] my-3';

  return (
    <div className="space-y-0">
      <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.03] p-2.5">
        <PreviewAIHintStrip
          hints={
            [
              isPolish ? 'Raport gotowy do przeglądu' : 'Report ready for review',
              governance?.visibilityScope
                ? `${isPolish ? 'Scope' : 'Scope'}: ${governance.visibilityScope}`
                : null,
              governance?.publishState
                ? `${isPolish ? 'Review' : 'Review'}: ${governance.publishState}`
                : null,
              governance?.validationState
                ? `${isPolish ? 'Validation' : 'Validation'}: ${governance.validationState}`
                : null,
              governance?.executionState
                ? `${isPolish ? 'Execution' : 'Execution'}: ${governance.executionState}`
                : null,
            ].filter(Boolean) as string[]
          }
        />
      </div>
      {relations.length > 0 && (
        <>
          <div className={dividerClass} />
          <PreviewRelations items={relations} />
        </>
      )}
      <div className={dividerClass} />
      {actionRows.length > 0 && <PreviewActionBar rows={actionRows} />}
    </div>
  );
};

/** @deprecated Use ReportPreviewBody + ReportPreviewFooter for Body/Footer split */
export const ReportPreview: React.FC<ReportPreviewProps> = (props) => {
  return (
    <>
      <ReportPreviewBody {...props} />
      <ReportPreviewFooter {...props} />
    </>
  );
};
