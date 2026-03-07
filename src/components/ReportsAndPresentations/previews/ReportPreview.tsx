/**
 * ReportPreview — Preview panel for reports
 * Golden standard §6.10a: Entity Meta → Content → AI Insight → Source Refs → Actions
 */

import { Download, ExternalLink } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

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

  return (
    <div className="space-y-4">
      {/* Entity Meta Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${typeMeta.color} bg-current/10`}
        >
          {report.reportType}
        </span>
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-500/10">
          <span className={`w-2 h-2 rounded-full ${statusMeta.dotColor}`} />
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {isPolish ? statusMeta.labelPl : statusMeta.label}
          </span>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-2">
        <DetailRow
          label={isPolish ? 'Typ raportu' : 'Report type'}
          value={isPolish ? typeMeta.labelPl : typeMeta.label}
        />
        <DetailRow label={isPolish ? 'Właściciel' : 'Owner'} value={report.owner} />
        <DetailRow
          label={isPolish ? 'Cel' : 'Goal'}
          value={report.goal || (isPolish ? 'Online report' : 'Online report')}
        />
        <DetailRow
          label={isPolish ? 'Rejestr komunikacji' : 'Communication register'}
          value={report.communicationRegister || '—'}
        />
        <DetailRow
          label={isPolish ? 'Poufność' : 'Confidentiality'}
          value={report.confidentiality || '—'}
        />
        <DetailRow label={isPolish ? 'Okres' : 'Period'} value={periodLabel} />
        <DetailRow
          label={isPolish ? 'Utworzony' : 'Created'}
          value={new Date(report.createdAt).toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        />
        <DetailRow
          label={isPolish ? 'Ostatnia zmiana' : 'Updated'}
          value={new Date(report.updatedAt).toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        />
      </div>

      {/* Export formats */}
      {report.exportFormats?.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {isPolish ? 'Eksporty' : 'Exports'}
          </span>
          <div className="flex items-center gap-1.5">
            {report.exportFormats.map((fmt) => (
              <span
                key={fmt}
                className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300"
              >
                {fmt}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Source references */}
      {report.sourceRefs && report.sourceRefs.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {isPolish ? 'Źródła danych' : 'Data Sources'}
          </span>
          <div className="text-xs text-slate-600 dark:text-slate-300">
            {report.sourceRefs.length} {isPolish ? 'powiązań' : 'references'}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex-1 flex items-center justify-center gap-2 h-9 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium transition-colors"
          onClick={onOpen}
        >
          <ExternalLink size={14} />
          {t('rap.preview.openFull', 'Otwórz pełny')}
        </button>
        <button
          type="button"
          className="h-9 w-9 flex items-center justify-center rounded-lg border border-slate-200/70 dark:border-white/[0.06] text-slate-500 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors"
          onClick={onExport}
          title={t('rap.actions.export', 'Eksportuj')}
        >
          <Download size={14} />
        </button>
      </div>
    </div>
  );
};

const DetailRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between text-sm">
    <span className="text-slate-500 dark:text-slate-400">{label}</span>
    <span className="text-slate-700 dark:text-slate-200 font-medium">{value}</span>
  </div>
);
