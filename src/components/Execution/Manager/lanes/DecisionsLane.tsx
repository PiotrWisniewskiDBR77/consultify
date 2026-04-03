/**
 * DecisionsLane
 *
 * Data wiring for the Decisions & Approvals lane with approval routing.
 */

import { Scale } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { ManagerModuleDataContext } from '../../ManagerModuleView';
import { LaneCockpitShell } from '../LaneCockpitShell';
import type { ProblemEntry } from '../LaneProblemList';
import type { LaneAction, LaneAnalysis, MetricDef } from '../types';

interface DecisionsLaneProps {
  analysis: LaneAnalysis | null;
  data: ManagerModuleDataContext;
  loading: boolean;
  onBack: () => void;
  onAction?: (action: LaneAction) => void;
  onRefresh?: () => void;
}

export const DecisionsLane: React.FC<DecisionsLaneProps> = ({
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
    const overdue = data.overdueDecisions;
    const pending = data.decisions.filter((d) => String(d.status).toUpperCase() === 'PENDING');
    const approved = data.decisions.filter((d) => String(d.status).toUpperCase() === 'APPROVED');
    return [
      { label: isPolish ? 'Przeterminowane' : 'Overdue', value: overdue.length, variant: overdue.length > 0 ? 'critical' : undefined },
      { label: isPolish ? 'Oczekujące' : 'Pending', value: pending.length, variant: pending.length > 5 ? 'warn' : undefined },
      { label: isPolish ? 'Zatwierdzone' : 'Approved', value: approved.length },
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
      laneId="decisions"
      title={isPolish ? 'Decyzje i zatwierdzenia' : 'Decisions & Approvals'}
      icon={<Scale size={18} className="text-amber-500" />}
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

export default DecisionsLane;
