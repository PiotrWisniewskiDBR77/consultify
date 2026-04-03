/**
 * LaneCockpitShell
 *
 * Shared shell for all 6 manager lanes.
 * Provides: header, summary strip, master-detail layout,
 * and the 6-section analytical cycle.
 */

import { ArrowLeft } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Callout } from '../../shared/NModeBlocks/Callout';
import { LaneDecisionsSection } from './LaneDecisionsSection';
import { LaneEffectsSection } from './LaneEffectsSection';
import { LaneExecutionSection } from './LaneExecutionSection';
import { LaneInsightsSection } from './LaneInsightsSection';
import { LaneObservationsSection } from './LaneObservationsSection';
import { LaneProblemList, type ProblemEntry } from './LaneProblemList';
import { LaneSuggestionsSection } from './LaneSuggestionsSection';
import { LaneSummaryStrip } from './LaneSummaryStrip';
import type { LaneAction, LaneAnalysis, ManagerLaneId, MetricDef } from './types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LaneCockpitShellProps {
  laneId: ManagerLaneId;
  title: string;
  icon: React.ReactNode;
  analysis: LaneAnalysis | null;
  metrics: MetricDef[];
  problems: ProblemEntry[];
  loading?: boolean;
  onBack: () => void;
  onAction?: (action: LaneAction) => void;
  onRefresh?: () => void;
  /** Extra content injected below the 6 sections (e.g. PeopleChangeWorkspace) */
  children?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const LaneCockpitShell: React.FC<LaneCockpitShellProps> = ({
  laneId,
  title,
  icon,
  analysis,
  metrics,
  problems,
  loading = false,
  onBack,
  onAction,
  onRefresh,
  children,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const [selectedProblem, setSelectedProblem] = useState<string | undefined>(
    problems[0]?.id
  );

  const handleAction = useCallback(
    (action: LaneAction) => onAction?.(action),
    [onAction]
  );

  const hasSidebar = problems.length > 0;

  if (!analysis) {
    return (
      <div className="h-full flex flex-col bg-white dark:bg-navy-950 overflow-hidden">
        <ShellHeader icon={icon} title={title} onBack={onBack} />
        <div className="flex-1 flex items-center justify-center">
          {loading ? (
            <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
          ) : (
            <Callout variant="info">
              {isPolish ? 'Brak danych do analizy tego lane\'u.' : 'No data available for this lane analysis.'}
            </Callout>
          )}
        </div>
      </div>
    );
  }

  const {
    observations,
    insights,
    effects,
    suggestions,
    decisions,
    executionPlan,
    severity,
    confidence,
    lastRefreshed,
  } = analysis;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-navy-950 overflow-hidden">
      {/* Header */}
      <ShellHeader icon={icon} title={title} onBack={onBack} />

      {/* Summary strip */}
      <div className="shrink-0 px-6 py-3">
        <LaneSummaryStrip
          severity={severity}
          confidence={confidence}
          lastRefreshed={new Date(lastRefreshed)}
          metrics={metrics}
          onRefresh={onRefresh}
        />
      </div>

      {/* Master-detail body */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
        {/* Left sidebar — problem list (hidden on mobile, shown as top strip) */}
        {hasSidebar && (
          <div className="md:w-64 shrink-0 border-b md:border-b-0 md:border-r border-slate-100 dark:border-navy-800 overflow-y-auto md:overflow-y-auto max-h-32 md:max-h-none py-2 px-2">
            <LaneProblemList
              problems={problems}
              selectedId={selectedProblem}
              onSelect={setSelectedProblem}
            />
          </div>
        )}

        {/* Right panel — 6 sections */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-3">
          {confidence === 'degraded' && (
            <Callout variant="warning" compact>
              {isPolish
                ? 'Dane niepełne — wyniki analizy mogą być niedokładne. Uzupełnij brakujące daty, estymaty i właścicieli.'
                : 'Data is incomplete — analysis results may be inaccurate. Fill in missing dates, estimates, and owners.'}
            </Callout>
          )}

          <LaneObservationsSection observations={observations} defaultOpen />
          <LaneInsightsSection insights={insights} defaultOpen />
          <LaneEffectsSection effects={effects} />
          <LaneSuggestionsSection suggestions={suggestions} onAction={handleAction} />
          <LaneDecisionsSection
            decisions={decisions}
            suggestions={suggestions}
            onAction={handleAction}
          />
          <LaneExecutionSection executionPlan={executionPlan} />

          {children}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Shell header (internal)
// ---------------------------------------------------------------------------

const ShellHeader: React.FC<{ icon: React.ReactNode; title: string; onBack: () => void }> = ({
  icon,
  title,
  onBack,
}) => {
  const { t } = useTranslation();
  return (
    <div className="shrink-0 px-6 pt-4 pb-3 border-b border-slate-100 dark:border-navy-800">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-navy-800">
          {icon}
        </div>
        <div>
          <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            {t('execution.manager.moduleSubtitle', 'Execution Management · {{date}}', {
              date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
            })}
          </p>
        </div>
      </div>
    </div>
  );
};

export default LaneCockpitShell;
