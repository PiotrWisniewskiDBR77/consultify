/**
 * PMODocumentRenderer - Specialized renderer for PMO documents
 * Supports RACI matrices, Risk Registers, Status Reports, and more
 * Follows ISO 21500, PMBOK 7, and PRINCE2 standards
 */

import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Folder,
  Shield,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface PMODocumentRendererProps {
  content: string;
  templateType?: string;
  framework?: string;
  className?: string;
}

type PMOTemplateType =
  | 'raci'
  | 'risk-register'
  | 'status-report'
  | 'stakeholder-matrix'
  | 'decision-log'
  | 'change-request'
  | 'lessons-learned'
  | 'generic';

const TEMPLATE_ICONS: Record<PMOTemplateType, React.ReactNode> = {
  raci: <Users size={18} />,
  'risk-register': <AlertTriangle size={18} />,
  'status-report': <TrendingUp size={18} />,
  'stakeholder-matrix': <Users size={18} />,
  'decision-log': <CheckCircle2 size={18} />,
  'change-request': <FileText size={18} />,
  'lessons-learned': <Target size={18} />,
  generic: <Folder size={18} />,
};

const FRAMEWORK_BADGES: Record<string, { color: string; label: string }> = {
  ISO: {
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    label: 'ISO 21500',
  },
  PMBOK: {
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    label: 'PMBOK 7',
  },
  PRINCE2: {
    color: 'bg-c-surface-raised text-c-text-secondary dark:bg-c-surface-raised dark:text-c-text-secondary',
    label: 'PRINCE2',
  },
};

// Parse PMO document content (JSON or markdown-like format)
const parseDocument = (content: string) => {
  try {
    return JSON.parse(content);
  } catch {
    // Return as-is for non-JSON content
    return { type: 'generic', content };
  }
};

// RACI Matrix Renderer
const RACIMatrixRenderer: React.FC<{ data: any }> = ({ data }) => {
  const { t } = useTranslation();

  const roles = data.roles || [];
  const tasks = data.tasks || [];
  const matrix = data.matrix || {};

  const getRACIColor = (value: string) => {
    switch (value?.toUpperCase()) {
      case 'R':
        return 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300';
      case 'A':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
      case 'C':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      case 'I':
        return 'bg-slate-100 text-slate-700 dark:bg-slate-700/30 dark:text-slate-300';
      default:
        return '';
    }
  };

  return (
    <div className="overflow-auto">
      <table
        /* §27-exempt: renderer artefaktu AI/markdown read-only, poza zakresem 1.2 */ className="min-w-full border-collapse"
      >
        <thead>
          <tr className="bg-slate-50 dark:bg-navy-800">
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-navy-700">
              {t('pmo.task', 'Task/Activity')}
            </th>
            {roles.map((role: string, idx: number) => (
              <th
                key={idx}
                className="px-3 py-3 text-center text-sm font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-navy-700 min-w-[100px]"
              >
                {role}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.map((task: string, taskIdx: number) => (
            <tr key={taskIdx} className="hover:bg-slate-50 dark:hover:bg-navy-800/50">
              <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-navy-700">
                {task}
              </td>
              {roles.map((role: string, roleIdx: number) => {
                const value = matrix[task]?.[role] || '';
                return (
                  <td
                    key={roleIdx}
                    className="px-3 py-3 text-center border-b border-slate-200 dark:border-navy-700"
                  >
                    {value && (
                      <span
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${getRACIColor(value)}`}
                      >
                        {value.toUpperCase()}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 px-4 py-3 bg-slate-50 dark:bg-navy-800/50 rounded-b-lg">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${getRACIColor('R')}`}
          >
            R
          </span>
          <span className="text-sm text-slate-600 dark:text-slate-400">
            {t('pmo.responsible', 'Responsible')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${getRACIColor('A')}`}
          >
            A
          </span>
          <span className="text-sm text-slate-600 dark:text-slate-400">
            {t('pmo.accountable', 'Accountable')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${getRACIColor('C')}`}
          >
            C
          </span>
          <span className="text-sm text-slate-600 dark:text-slate-400">
            {t('pmo.consulted', 'Consulted')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${getRACIColor('I')}`}
          >
            I
          </span>
          <span className="text-sm text-slate-600 dark:text-slate-400">
            {t('pmo.informed', 'Informed')}
          </span>
        </div>
      </div>
    </div>
  );
};

// Risk Register Renderer
const RiskRegisterRenderer: React.FC<{ data: any }> = ({ data }) => {
  const { t } = useTranslation();
  const risks = data.risks || [];

  const getRiskColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'critical':
      case 'very high':
        return 'bg-danger-500 text-white';
      case 'high':
        return 'bg-amber-500 text-white';
      case 'medium':
        return 'bg-amber-500 text-white';
      case 'low':
        return 'bg-green-500 text-white';
      default:
        return 'bg-slate-400 text-white';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'open':
        return <AlertTriangle size={14} className="text-amber-500" />;
      case 'mitigated':
        return <Shield size={14} className="text-blue-500" />;
      case 'closed':
        return <CheckCircle2 size={14} className="text-green-500" />;
      default:
        return <Clock size={14} className="text-slate-600 dark:text-slate-500" />;
    }
  };

  return (
    <div className="space-y-4 p-4">
      {risks.map((risk: any, idx: number) => (
        <div
          key={idx}
          className="border border-slate-200 dark:border-navy-700 rounded-lg overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-navy-800/50">
            <div className="flex items-center gap-3">
              <span
                className={`px-2 py-1 rounded text-xs font-semibold ${getRiskColor(risk.level)}`}
              >
                {risk.level || 'Unknown'}
              </span>
              <h4 className="font-semibold text-slate-900 dark:text-white">
                {risk.id || `Risk ${idx + 1}`}: {risk.title}
              </h4>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(risk.status)}
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {risk.status || 'Open'}
              </span>
            </div>
          </div>
          <div className="px-4 py-3 space-y-3">
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                {t('pmo.description', 'Description')}
              </span>
              <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">{risk.description}</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  {t('pmo.probability', 'Probability')}
                </span>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                  {risk.probability || '—'}
                </p>
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  {t('pmo.impact', 'Impact')}
                </span>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                  {risk.impact || '—'}
                </p>
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  {t('pmo.owner', 'Owner')}
                </span>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                  {risk.owner || '—'}
                </p>
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  {t('pmo.dueDate', 'Due Date')}
                </span>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                  {risk.dueDate || '—'}
                </p>
              </div>
            </div>
            {risk.mitigation && (
              <div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  {t('pmo.mitigation', 'Mitigation Strategy')}
                </span>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">{risk.mitigation}</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// Status Report Renderer
const StatusReportRenderer: React.FC<{ data: any }> = ({ data }) => {
  const { t } = useTranslation();

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'green':
      case 'on track':
        return 'bg-green-500';
      case 'amber':
      case 'yellow':
      case 'at risk':
        return 'bg-amber-500';
      case 'red':
      case 'off track':
        return 'bg-danger-500';
      default:
        return 'bg-slate-400';
    }
  };

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {data.projectName || 'Project Status Report'}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {data.reportDate ? new Date(data.reportDate).toLocaleDateString() : 'Latest Report'}
          </p>
        </div>
        <div
          className={`w-12 h-12 rounded-full ${getStatusColor(data.overallStatus)}`}
          title={data.overallStatus}
        />
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t('pmo.schedule', 'Schedule'), value: data.schedule, icon: Calendar },
          { label: t('pmo.budget', 'Budget'), value: data.budget, icon: TrendingUp },
          { label: t('pmo.scope', 'Scope'), value: data.scope, icon: Target },
          { label: t('pmo.quality', 'Quality'), value: data.quality, icon: CheckCircle2 },
        ].map((metric, idx) => (
          <div key={idx} className="bg-slate-50 dark:bg-navy-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <metric.icon size={16} className="text-slate-600 dark:text-slate-500" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {metric.label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${getStatusColor(metric.value?.status)}`} />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                {metric.value?.status || '—'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      {data.summary && (
        <div>
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            {t('pmo.executiveSummary', 'Executive Summary')}
          </h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">{data.summary}</p>
        </div>
      )}

      {/* Accomplishments & Next Steps */}
      <div className="grid md:grid-cols-2 gap-4">
        {data.accomplishments && (
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-green-700 dark:text-green-300 mb-2">
              {t('pmo.accomplishments', 'Key Accomplishments')}
            </h4>
            <ul className="space-y-1">
              {data.accomplishments.map((item: string, idx: number) => (
                <li
                  key={idx}
                  className="text-sm text-green-600 dark:text-green-400 flex items-start gap-2"
                >
                  <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
        {data.nextSteps && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2">
              {t('pmo.nextSteps', 'Next Steps')}
            </h4>
            <ul className="space-y-1">
              {data.nextSteps.map((item: string, idx: number) => (
                <li
                  key={idx}
                  className="text-sm text-blue-600 dark:text-blue-400 flex items-start gap-2"
                >
                  <Clock size={14} className="mt-0.5 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

// Generic Document Renderer (for plain text/markdown)
const GenericDocumentRenderer: React.FC<{ content: string }> = ({ content }) => {
  return (
    <div className="p-4">
      <pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 font-sans leading-relaxed">
        {content}
      </pre>
    </div>
  );
};

export const PMODocumentRenderer: React.FC<PMODocumentRendererProps> = ({
  content,
  templateType,
  framework,
  className = '',
}) => {
  const { t } = useTranslation();

  const document = useMemo(() => parseDocument(content), [content]);
  const docType = (templateType || document.type || 'generic') as PMOTemplateType;

  const renderDocument = () => {
    switch (docType) {
      case 'raci':
        return <RACIMatrixRenderer data={document} />;
      case 'risk-register':
        return <RiskRegisterRenderer data={document} />;
      case 'status-report':
        return <StatusReportRenderer data={document} />;
      default:
        return (
          <GenericDocumentRenderer
            content={typeof content === 'string' ? content : JSON.stringify(content, null, 2)}
          />
        );
    }
  };

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-navy-900 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/50">
        <div className="flex items-center gap-3">
          <span className="text-brand">{TEMPLATE_ICONS[docType] || TEMPLATE_ICONS.generic}</span>
          <h3 className="font-semibold text-slate-900 dark:text-white">
            {document.title ||
              t(
                `pmo.templates.${docType}`,
                docType.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
              )}
          </h3>
        </div>

        {/* Framework badges */}
        <div className="flex items-center gap-2">
          {framework && FRAMEWORK_BADGES[framework] && (
            <span
              className={`px-2 py-1 rounded text-xs font-semibold ${FRAMEWORK_BADGES[framework].color}`}
            >
              {FRAMEWORK_BADGES[framework].label}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">{renderDocument()}</div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/50">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>{t('pmo.generatedBy', 'Generated by Consultify AI')}</span>
          {document.version && (
            <span>
              {t('pmo.version', 'Version')} {document.version}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default PMODocumentRenderer;
