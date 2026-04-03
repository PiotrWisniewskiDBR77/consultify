/**
 * PeopleChangeLane
 *
 * Data wiring for the People & Change lane with PeopleChangeWorkspace integration.
 */

import { Users } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { ManagerModuleDataContext } from '../../ManagerModuleView';
import { PeopleChangeWorkspace } from '../../PeopleChangeWorkspace';
import { LaneCockpitShell } from '../LaneCockpitShell';
import type { ProblemEntry } from '../LaneProblemList';
import type { LaneAction, LaneAnalysis, MetricDef } from '../types';

interface PeopleChangeLaneProps {
  analysis: LaneAnalysis | null;
  data: ManagerModuleDataContext;
  loading: boolean;
  onBack: () => void;
  onAction?: (action: LaneAction) => void;
  onRefresh?: () => void;
}

export const PeopleChangeLane: React.FC<PeopleChangeLaneProps> = ({
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
    const withoutOwner = data.initiatives.filter((i: any) => !i.ownerId && !i.assigneeId);
    return [
      { label: isPolish ? 'Inicjatywy' : 'Initiatives', value: data.initiatives.length },
      { label: isPolish ? 'Bez właściciela' : 'Missing Owners', value: withoutOwner.length, variant: withoutOwner.length > 0 ? 'warn' : undefined },
      { label: isPolish ? 'Bez dat' : 'Missing Dates', value: data.missingDates.length, variant: data.missingDates.length > 0 ? 'warn' : undefined },
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
      laneId="people-change"
      title={isPolish ? 'Ludzie i zmiana' : 'People & Change'}
      icon={<Users size={18} className="text-emerald-500" />}
      analysis={analysis}
      metrics={metrics}
      problems={problems}
      loading={loading}
      onBack={onBack}
      onAction={onAction}
      onRefresh={onRefresh}
    >
      <div className="mt-4 bg-white dark:bg-navy-900 border border-slate-200/50 dark:border-navy-700/50 rounded-xl overflow-hidden">
        <PeopleChangeWorkspace
          initiativeId={undefined}
          projectId={data.projectId}
        />
      </div>
    </LaneCockpitShell>
  );
};

export default PeopleChangeLane;
