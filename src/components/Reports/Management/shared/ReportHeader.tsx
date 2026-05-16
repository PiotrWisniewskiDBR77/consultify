/**
 * Report Header Component
 * Header with title, period, and metadata
 */

import { Building2, Calendar, Clock, FileText } from 'lucide-react';
import React from 'react';

import { ManagementReportScope, ManagementReportType, RAGStatus } from '../../../../types';
import { RAGIndicator } from './RAGIndicator';

interface ReportHeaderProps {
  title: string;
  reportType: ManagementReportType;
  scope: ManagementReportScope;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  generatedBy?: string;
  projectName?: string;
  organizationName?: string;
  overallHealth?: RAGStatus;
  className?: string;
}

const reportTypeLabels = {
  TEAM_MEETING: { label: 'Team Meeting Report', icon: '📋', color: 'bg-blue-500' },
  TEAM_WEEKLY: { label: 'Team Weekly Report', icon: '🗓️', color: 'bg-sky-500' },
  STEERING_COMMITTEE: { label: 'Steering Committee Report', icon: '🏛️', color: 'bg-primary-500' },
  PORTFOLIO_HEALTH: { label: 'Portfolio Health Report', icon: '📈', color: 'bg-emerald-500' },
  RAID: { label: 'Risk, Assumptions, Issues, Dependencies', icon: '⚠️', color: 'bg-amber-500' },
};

const scopeLabels = {
  PROJECT: 'Single Project',
  PORTFOLIO: 'Portfolio',
};

export const ReportHeader: React.FC<ReportHeaderProps> = ({
  title,
  reportType,
  scope,
  periodStart,
  periodEnd,
  generatedAt,
  generatedBy,
  projectName,
  organizationName,
  overallHealth,
  className = '',
}) => {
  const typeConfig = reportTypeLabels[reportType] || reportTypeLabels.TEAM_MEETING;

  return (
    <div
      className={`bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 px-5 py-4 ${className}`}
    >
      {/* Top row - title, badges, and health */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-xl font-bold text-navy-900 dark:text-white truncate">{title}</h1>
          <span
            className={`shrink-0 px-2.5 py-0.5 rounded-full ${typeConfig.color} text-white text-xs font-medium`}
          >
            {typeConfig.icon} {typeConfig.label}
          </span>
          <span className="shrink-0 px-2 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 text-[11px] font-medium">
            {scopeLabels[scope]}
          </span>
        </div>
        {overallHealth && <RAGIndicator status={overallHealth} size="lg" showLabel />}
      </div>

      {/* Compact metadata row */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-2 text-xs text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <Calendar size={13} className="text-slate-400 dark:text-slate-500" />
          {periodStart} – {periodEnd}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock size={13} className="text-slate-400 dark:text-slate-500" />
          {new Date(generatedAt).toLocaleDateString()}
        </span>
        {(projectName || organizationName) && (
          <span className="inline-flex items-center gap-1.5">
            <Building2 size={13} className="text-slate-400 dark:text-slate-500" />
            {projectName || organizationName}
          </span>
        )}
        {generatedBy && (
          <span className="inline-flex items-center gap-1.5">
            <FileText size={13} className="text-slate-400 dark:text-slate-500" />
            {generatedBy}
          </span>
        )}
      </div>
    </div>
  );
};

export default ReportHeader;
