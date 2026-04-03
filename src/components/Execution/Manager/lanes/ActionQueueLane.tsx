/**
 * ActionQueueLane
 *
 * Data wiring for the Action Queue lane.
 * Transforms legacy ManagerModuleDataContext into the cockpit model
 * and provides lane-specific metrics.
 */

import { ClipboardList } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { ManagerModuleDataContext } from '../../ManagerModuleView';
import { LaneCockpitShell } from '../LaneCockpitShell';
import type { ProblemEntry } from '../LaneProblemList';
import type { LaneAction, LaneAnalysis, MetricDef } from '../types';

interface ActionQueueLaneProps {
  analysis: LaneAnalysis | null;
  data: ManagerModuleDataContext;
  loading: boolean;
  onBack: () => void;
  onAction?: (action: LaneAction) => void;
  onRefresh?: () => void;
}

export const ActionQueueLane: React.FC<ActionQueueLaneProps> = ({
  analysis,
  data,
  loading,
  onBack,
  onAction,
  onRefresh,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const metrics: MetricDef[] = useMemo(() => {
    const byType: Record<string, number> = {};
    data.actionQueueItems.forEach((i) => { byType[i.type] = (byType[i.type] || 0) + 1; });
    return [
      { label: isPolish ? 'Łączne' : 'Total Items', value: data.actionQueueItems.length },
      { label: isPolish ? 'Decyzje' : 'Decisions', value: byType['decision_overdue'] || 0, variant: (byType['decision_overdue'] || 0) > 0 ? 'warn' : undefined },
      { label: isPolish ? 'Ryzyka' : 'Risks', value: byType['risk_high'] || 0, variant: (byType['risk_high'] || 0) > 0 ? 'critical' : undefined },
      { label: isPolish ? 'Odchylenia KPI' : 'KPI Deviations', value: byType['kpi_deviation_no_plan'] || 0 },
    ];
  }, [data, isPolish]);

  const problems: ProblemEntry[] = useMemo(() => {
    if (!analysis) return [];
    return analysis.insights
      .filter((i) => i.requiresAction)
      .map((i) => ({
        id: i.id,
        label: i.interpretation,
        severity: i.isSystemic ? 'critical' as const : 'warning' as const,
        secondaryLabel: `${i.observationIds.length} obs`,
      }));
  }, [analysis]);

  return (
    <LaneCockpitShell
      laneId="action-queue"
      title={isPolish ? 'Kolejka akcji' : 'Action Queue'}
      icon={<ClipboardList size={18} className="text-cyan-500" />}
      analysis={analysis}
      metrics={metrics}
      problems={problems}
      loading={loading}
      onBack={onBack}
      onAction={onAction}
      onRefresh={onRefresh}
    />
  );
};

export default ActionQueueLane;
