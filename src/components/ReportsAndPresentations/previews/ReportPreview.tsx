/**
 * ReportPreview — Preview panel for reports
 * Uses shared PreviewPane building blocks for consistent UX.
 */

import { Download, ExternalLink } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  PreviewActionBar,
  PreviewDetailsSection,
  PreviewMetaCard,
  PreviewRelations,
  type ActionRow,
  type MetaPill,
  type RelationItem,
} from '@/components/shared/PreviewPane';

import { REPORT_STATUS_META, REPORT_TYPE_META, type ReportItem } from '../types';

interface ReportPreviewProps {
  report: ReportItem;
  onOpen?: () => void;
  onExport?: () => void;
}

export const ReportPreview: React.FC<ReportPreviewProps> = ({ report, onOpen, onExport }) => {
  const { i18n, t } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const typeMeta = REPORT_TYPE_META[report.reportType] || REPORT_TYPE_META.custom;
  const statusMeta = REPORT_STATUS_META[report.status] || REPORT_STATUS_META.draft;

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
    `${isPolish ? 'Utworzony' : 'Created'}: ${new Date(report.createdAt).toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    `${isPolish ? 'Ostatnia zmiana' : 'Updated'}: ${new Date(report.updatedAt).toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}`,
  ].join('\n');

  const relations: RelationItem[] = [
    ...(report.exportFormats?.length
      ? report.exportFormats.map((fmt) => ({ label: fmt }))
      : []),
    ...(report.sourceRefs?.length
      ? [{ label: `${report.sourceRefs.length} ${isPolish ? 'powiązań' : 'references'}` }]
      : []),
  ];

  const actionRows: ActionRow[] = [];
  if (onOpen || onExport) {
    actionRows.push({
      buttons: [
        ...(onOpen
          ? [{ label: t('rap.preview.openFull', 'Otwórz pełny'), icon: ExternalLink, onClick: onOpen, colorScheme: 'primary' as const, flex: true }]
          : []),
        ...(onExport
          ? [{ label: t('rap.actions.export', 'Eksportuj'), icon: Download, onClick: onExport, colorScheme: 'neutral' as const }]
          : []),
      ],
    });
  }

  return (
    <div className="space-y-4 text-sm">
      <PreviewMetaCard pills={pills} />
      <PreviewDetailsSection text={detailLines} label={isPolish ? 'SZCZEGÓŁY' : 'DETAILS'} />
      {relations.length > 0 && <PreviewRelations items={relations} />}
      {actionRows.length > 0 && <PreviewActionBar rows={actionRows} />}
    </div>
  );
};
