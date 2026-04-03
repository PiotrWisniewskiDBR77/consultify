/**
 * RiskLane
 *
 * Data wiring for the Execution Risk lane with confidence scoring.
 */

import { Shield } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { ManagerModuleDataContext } from '../../ManagerModuleView';
import { LaneCockpitShell } from '../LaneCockpitShell';
import type { ProblemEntry } from '../LaneProblemList';
import type { LaneAction, LaneAnalysis, MetricDef } from '../types';

interface RiskLaneProps {
  analysis: LaneAnalysis | null;
  data: ManagerModuleDataContext;
  loading: boolean;
  onBack: () => void;
  onAction?: (action: LaneAction) => void;
  onRefresh?: () => void;
}

export const RiskLane: React.FC<RiskLaneProps> = ({
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
    const risks = data.riskSignals;
    const delays = data.delaySignals;
    const critical = risks.filter((r) => r.severity === 'CRITICAL').length;
    return [
      { label: isPolish ? 'Sygnały ryzyka' : 'Risk Signals', value: risks.length, variant: risks.length > 3 ? 'warn' : undefined },
      { label: isPolish ? 'Krytyczne' : 'Critical', value: critical, variant: critical > 0 ? 'critical' : undefined },
      { label: isPolish ? 'Sygnały opóźnień' : 'Delay Signals', value: delays.length, variant: delays.length > 2 ? 'warn' : undefined },
      { label: isPolish ? 'Zablokowane' : 'Blocked', value: data.blocked.length, variant: data.blocked.length > 0 ? 'critical' : undefined },
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
      laneId="risk"
      title={isPolish ? 'Ryzyko realizacji' : 'Execution Risk'}
      icon={<Shield size={18} className="text-rose-500" />}
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

export default RiskLane;
