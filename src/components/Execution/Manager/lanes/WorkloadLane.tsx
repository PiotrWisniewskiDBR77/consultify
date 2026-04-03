/**
 * WorkloadLane
 *
 * Data wiring for the Resource & Workload lane with capacity visualization.
 */

import { Users } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { ManagerModuleDataContext } from '../../ManagerModuleView';
import { LaneCockpitShell } from '../LaneCockpitShell';
import type { ProblemEntry } from '../LaneProblemList';
import type { LaneAction, LaneAnalysis, MetricDef } from '../types';

interface WorkloadLaneProps {
  analysis: LaneAnalysis | null;
  data: ManagerModuleDataContext;
  loading: boolean;
  onBack: () => void;
  onAction?: (action: LaneAction) => void;
  onRefresh?: () => void;
}

export const WorkloadLane: React.FC<WorkloadLaneProps> = ({
  analysis,
  data,
  loading,
  onBack,
  onAction,
  onRefresh,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const { metrics, overloadedPeople } = useMemo(() => {
    const assignees: Record<string, { total: number }> = {};
    data.tasks.forEach((t: any) => {
      const a = t.assigneeName || t.assignee?.name || 'Unassigned';
      if (!assignees[a]) assignees[a] = { total: 0 };
      assignees[a].total++;
    });
    const sorted = Object.entries(assignees).sort(([, a], [, b]) => b.total - a.total);
    const overloaded = sorted.filter(([, s]) => s.total > 10);
    const unassigned = assignees['Unassigned']?.total || 0;

    const m: MetricDef[] = [
      { label: isPolish ? 'Łącznie zadań' : 'Total Tasks', value: data.tasks.length },
      { label: isPolish ? 'Osoby' : 'People', value: sorted.filter(([n]) => n !== 'Unassigned').length },
      { label: isPolish ? 'Przeciążeni' : 'Overloaded', value: overloaded.length, variant: overloaded.length > 0 ? 'warn' : undefined },
      { label: isPolish ? 'Nieprzypisane' : 'Unassigned', value: unassigned, variant: unassigned > 5 ? 'warn' : undefined },
    ];

    return { metrics: m, overloadedPeople: overloaded };
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
      laneId="workload"
      title={isPolish ? 'Zasoby i obciążenie' : 'Resource & Workload'}
      icon={<Users size={18} className="text-violet-500" />}
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

export default WorkloadLane;
