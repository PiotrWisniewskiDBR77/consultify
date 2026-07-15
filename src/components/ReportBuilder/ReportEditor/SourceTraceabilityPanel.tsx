/**
 * SourceTraceabilityPanel
 *
 * Sidebar panel showing all source artifacts referenced by a report.
 * Displays type icon, name, section usage count, and a "refresh from source" button.
 */

import {
  BarChart3,
  Database,
  ExternalLink,
  FileText,
  RefreshCw,
  Target,
  Users,
  Wallet,
} from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

// ==========================================
// TYPES
// ==========================================

export interface SourceRefEntry {
  artifact_id: string;
  artifact_type: string;
  artifact_name: string;
  usedInSections?: Array<{ sectionKey: string; sectionTitle: string }>;
  lastUsed?: string;
}

interface SourceTraceabilityPanelProps {
  reportId: string;
  sourceRefs: SourceRefEntry[];
  isPl: boolean;
}

// ==========================================
// HELPERS
// ==========================================

const ARTIFACT_ICON_MAP: Record<string, React.ElementType> = {
  initiative: Target,
  initiative_portfolio: Target,
  task: Users,
  execution_tasks: Users,
  decision: FileText,
  benefit: BarChart3,
  benefits_tracking: BarChart3,
  kpi_roi: Database,
  financial_analysis: Wallet,
  economic_analysis: Wallet,
  budget: Wallet,
  valuation: Wallet,
  execution_status: Users,
  risk: FileText,
  raid: FileText,
  tool_session: Database,
};

const ARTIFACT_COLOR_MAP: Record<string, string> = {
  initiative: 'text-c-accent',
  initiative_portfolio: 'text-c-accent',
  task: 'text-blue-400',
  execution_tasks: 'text-blue-400',
  decision: 'text-amber-400',
  benefit: 'text-green-400',
  benefits_tracking: 'text-green-400',
  kpi_roi: 'text-blue-400',
  financial_analysis: 'text-emerald-400',
  economic_analysis: 'text-emerald-400',
  budget: 'text-emerald-400',
  valuation: 'text-emerald-400',
  execution_status: 'text-blue-400',
  risk: 'text-danger-400',
  raid: 'text-danger-400',
  tool_session: 'text-blue-400',
};

function formatArtifactType(type: string, isPl: boolean): string {
  const labels: Record<string, [string, string]> = {
    initiative: ['Initiative', 'Inicjatywa'],
    initiative_portfolio: ['Initiative Portfolio', 'Portfel inicjatyw'],
    task: ['Task', 'Zadanie'],
    execution_tasks: ['Tasks', 'Zadania'],
    decision: ['Decision', 'Decyzja'],
    benefit: ['Benefit', 'Korzyść'],
    benefits_tracking: ['Benefits', 'Korzyści'],
    kpi_roi: ['KPI / ROI', 'KPI / ROI'],
    financial_analysis: ['Financial Analysis', 'Analiza finansowa'],
    economic_analysis: ['Economic Analysis', 'Analiza ekonomiczna'],
    budget: ['Budget', 'Budżet'],
    valuation: ['Valuation', 'Wycena'],
    execution_status: ['Execution', 'Realizacja'],
    risk: ['Risk', 'Ryzyko'],
    raid: ['RAID', 'RAID'],
    tool_session: ['Idea Workspace', 'Workspace pomysłu'],
  };
  const pair = labels[type];
  return pair ? pair[isPl ? 1 : 0] : type;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ==========================================
// COMPONENT
// ==========================================

const SourceTraceabilityPanel: React.FC<SourceTraceabilityPanelProps> = ({
  reportId,
  sourceRefs,
  isPl,
}) => {
  const { t } = useTranslation();

  const sortedRefs = useMemo(
    () =>
      [...sourceRefs].sort((a, b) => {
        const countA = a.usedInSections?.length ?? 0;
        const countB = b.usedInSections?.length ?? 0;
        return countB - countA;
      }),
    [sourceRefs]
  );

  if (sortedRefs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <Database className="h-10 w-10 text-c-text mb-3" />
        <p className="text-sm text-c-text">
          {t('reportBuilder.sourceTraceabilityPanel.noLinkedDataSources', 'No linked data sources.')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 py-2">
      <div className="px-4 pb-2 mb-1 border-b border-c-border-subtle">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-c-text">
          {t('reportBuilder.sourceTraceabilityPanel.dataSources', 'Data Sources')}
        </h3>
        <p className="text-[11px] text-c-text mt-0.5">
          {t('reportBuilder.sourceTraceabilityPanel.nArtifactsLinked', {
            defaultValue: `${sortedRefs.length} artifacts linked to report`,
            count: sortedRefs.length,
          })}
        </p>
      </div>

      {sortedRefs.map((ref) => {
        const Icon = ARTIFACT_ICON_MAP[ref.artifact_type] || FileText;
        const colorClass = ARTIFACT_COLOR_MAP[ref.artifact_type] || 'text-c-text';
        const sectionCount = ref.usedInSections?.length ?? 0;

        return (
          <div
            key={ref.artifact_id}
            className="group mx-2 rounded-xl px-3 py-2.5 hover:bg-c-surface/[0.04] transition-colors"
          >
            <div className="flex items-start gap-2.5">
              <div
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-c-surface/[0.06] ${colorClass}`}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-c-text truncate">
                    {ref.artifact_name || ref.artifact_id}
                  </span>
                  <ExternalLink className="h-3 w-3 text-c-text opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>

                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-c-text">
                    {formatArtifactType(ref.artifact_type, isPl)}
                  </span>
                  {sectionCount > 0 && (
                    <span className="text-[11px] text-c-text">
                      ·{' '}
                      {t('reportBuilder.sourceTraceabilityPanel.nSections', {
                        defaultValue: `${sectionCount} section${sectionCount !== 1 ? 's' : ''}`,
                        count: sectionCount,
                      })}
                    </span>
                  )}
                </div>

                {ref.lastUsed && (
                  <div className="text-[10px] text-c-text mt-0.5">
                    {t('reportBuilder.sourceTraceabilityPanel.used', 'Used: ')}
                    {formatDate(ref.lastUsed)}
                  </div>
                )}

                {ref.usedInSections && ref.usedInSections.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {ref.usedInSections.slice(0, 4).map((sec) => (
                      <span
                        key={sec.sectionKey}
                        className="inline-block rounded-md bg-c-surface/[0.05] px-1.5 py-0.5 text-[10px] text-c-text"
                        title={sec.sectionTitle}
                      >
                        {sec.sectionTitle.length > 20
                          ? sec.sectionTitle.slice(0, 20) + '…'
                          : sec.sectionTitle}
                      </span>
                    ))}
                    {ref.usedInSections.length > 4 && (
                      <span className="text-[10px] text-c-text">
                        +{ref.usedInSections.length - 4}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <button
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md
                           text-c-text hover:text-c-text hover:bg-c-surface/[0.06]
                           opacity-0 group-hover:opacity-100 transition-all"
                title={t('reportBuilder.sourceTraceabilityPanel.refreshFromSource', 'Refresh from source')}
                onClick={() => {
                  /* Phase 8: wire to actual refresh */
                }}
              >
                <RefreshCw className="h-3 w-3" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SourceTraceabilityPanel;
