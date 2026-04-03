/**
 * BlockersLane
 *
 * Data wiring for the Blockers & Escalations lane.
 */

import { AlertTriangle } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { ManagerModuleDataContext } from '../../ManagerModuleView';
import { LaneCockpitShell } from '../LaneCockpitShell';
import type { ProblemEntry } from '../LaneProblemList';
import type { LaneAction, LaneAnalysis, MetricDef } from '../types';

interface BlockersLaneProps {
  analysis: LaneAnalysis | null;
  data: ManagerModuleDataContext;
  loading: boolean;
  onBack: () => void;
  onAction?: (action: LaneAction) => void;
  onRefresh?: () => void;
}

export const BlockersLane: React.FC<BlockersLaneProps> = ({
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
    const highRisks = data.riskSignals.filter((r) => r.severity === 'CRITICAL' || r.severity === 'HIGH');
    return [
      { label: isPolish ? 'Zablokowane' : 'Blocked', value: data.blocked.length, variant: data.blocked.length > 0 ? 'critical' : undefined },
      { label: isPolish ? 'Ryzyka kryt./wys.' : 'Critical/High Risks', value: highRisks.length, variant: highRisks.length > 0 ? 'warn' : undefined },
      { label: isPolish ? 'Bliskie terminy' : 'Due Soon', value: data.dueSoonTasks.length },
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
      laneId="blockers"
      title={isPolish ? 'Blokery i eskalacje' : 'Blockers & Escalations'}
      icon={<AlertTriangle size={18} className="text-rose-500" />}
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

export default BlockersLane;
