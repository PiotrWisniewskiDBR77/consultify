import { Activity, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import React, { useMemo, useState } from 'react';

interface ProcessFlowHealthScoreProps {
  nodes: Array<{ id: string; data?: any; type?: string }>;
  edges: Array<{ id: string; source: string; target: string; data?: any }>;
  isPl?: boolean;
}

interface HealthMetric {
  key: string;
  labelPl: string;
  labelEn: string;
  score: number;
  detail: string;
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-success-600 dark:text-success-400';
  if (score >= 50) return 'text-warning-600 dark:text-warning-400';
  return 'text-danger-500 dark:text-danger-400';
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-success-500';
  if (score >= 50) return 'bg-warning-500';
  return 'bg-danger-500';
}

export const ProcessFlowHealthScore: React.FC<ProcessFlowHealthScoreProps> = ({
  nodes,
  edges,
  isPl,
}) => {
  const [expanded, setExpanded] = useState(false);

  const metrics: HealthMetric[] = useMemo(() => {
    const flowNodes = nodes.filter(
      (n) =>
        n.type === 'flowNode' ||
        n.type === 'start_event' ||
        n.type === 'end_event' ||
        n.type === 'task' ||
        n.type === 'decision_gateway' ||
        n.type === 'parallel_gateway' ||
        n.type === 'subprocess'
    );
    const result: HealthMetric[] = [];

    const hasStart = flowNodes.some(
      (n) =>
        ['start', 'bpmn_event', 'auto_trigger'].includes(String(n.data?.shape || '')) ||
        n.type === 'start_event'
    );
    const hasEnd = flowNodes.some(
      (n) => ['end', 'bpmn_event'].includes(String(n.data?.shape || '')) || n.type === 'end_event'
    );
    const completenessScore = hasStart && hasEnd ? 100 : hasStart || hasEnd ? 50 : 0;
    result.push({
      key: 'completeness',
      labelPl: 'Kompletność (Start/End)',
      labelEn: 'Completeness (Start/End)',
      score: completenessScore,
      detail:
        hasStart && hasEnd
          ? isPl
            ? 'Start i End obecne'
            : 'Start and End present'
          : isPl
            ? 'Brak Start lub End'
            : 'Missing Start or End',
    });

    const totalFlowNodes = flowNodes.length;
    const connectedNodes = new Set<string>();
    for (const e of edges) {
      connectedNodes.add(e.source);
      connectedNodes.add(e.target);
    }
    const danglingCount = flowNodes.filter((n) => !connectedNodes.has(n.id)).length;
    const connectivityScore =
      totalFlowNodes === 0
        ? 0
        : Math.round(((totalFlowNodes - danglingCount) / totalFlowNodes) * 100);
    result.push({
      key: 'connectivity',
      labelPl: 'Połączenia',
      labelEn: 'Connectivity',
      score: connectivityScore,
      detail:
        danglingCount === 0
          ? isPl
            ? 'Wszystkie elementy połączone'
            : 'All elements connected'
          : isPl
            ? `${danglingCount} niepołączonych`
            : `${danglingCount} disconnected`,
    });

    const labeledCount = flowNodes.filter(
      (n) => n.data?.label && String(n.data.label).trim().length > 0
    ).length;
    const labelScore = totalFlowNodes === 0 ? 0 : Math.round((labeledCount / totalFlowNodes) * 100);
    result.push({
      key: 'labels',
      labelPl: 'Etykiety',
      labelEn: 'Labels',
      score: labelScore,
      detail:
        labeledCount === totalFlowNodes
          ? isPl
            ? 'Wszystkie etykiety uzupełnione'
            : 'All labels filled'
          : isPl
            ? `${totalFlowNodes - labeledCount} bez etykiety`
            : `${totalFlowNodes - labeledCount} unlabeled`,
    });

    const decisions = flowNodes.filter(
      (n) =>
        ['decision', 'bpmn_gateway', 'org_handoff', 'auto_condition'].includes(
          String(n.data?.shape || '')
        ) ||
        n.type === 'decision_gateway' ||
        n.type === 'parallel_gateway'
    );
    let gatewayScore = 100;
    if (decisions.length > 0) {
      const wellFormed = decisions.filter((d) => {
        const outgoing = edges.filter((e) => e.source === d.id);
        return outgoing.length >= 2;
      });
      gatewayScore = Math.round((wellFormed.length / decisions.length) * 100);
    }
    result.push({
      key: 'gateways',
      labelPl: 'Bramki decyzyjne',
      labelEn: 'Decision gateways',
      score: gatewayScore,
      detail:
        decisions.length === 0
          ? isPl
            ? 'Brak bramek'
            : 'No gateways'
          : gatewayScore === 100
            ? isPl
              ? 'Wszystkie bramki poprawne'
              : 'All gateways valid'
            : isPl
              ? 'Niektóre bramki niepoprawne'
              : 'Some gateways invalid',
    });

    return result;
  }, [edges, isPl, nodes]);

  const overallScore = useMemo(() => {
    if (metrics.length === 0) return 0;
    return Math.round(metrics.reduce((sum, m) => sum + m.score, 0) / metrics.length);
  }, [metrics]);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-1 py-0.5 rounded hover:bg-c-surface-raised transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className={`text-lg font-bold tabular-nums ${scoreColor(overallScore)}`}>
            {overallScore}%
          </div>
          <div className="h-1.5 w-20 rounded-full bg-c-surface-raised overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${scoreBg(overallScore)}`}
              style={{ width: `${overallScore}%` }}
            />
          </div>
        </div>
        {expanded ? (
          <ChevronUp size={14} className="text-c-text-secondary" />
        ) : (
          <ChevronDown size={14} className="text-c-text-secondary" />
        )}
      </button>

      {expanded && (
        <div className="space-y-1.5 pl-1">
          {metrics.map((m) => (
            <div key={m.key} className="flex items-center gap-2">
              {m.score >= 80 ? (
                <CheckCircle2 size={12} className="text-success-500 flex-shrink-0" />
              ) : m.score >= 50 ? (
                <Activity size={12} className="text-warning-500 flex-shrink-0" />
              ) : (
                <AlertTriangle size={12} className="text-danger-500 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-medium text-c-text-secondary truncate">
                  {isPl ? m.labelPl : m.labelEn}
                </div>
                <div className="text-[9px] text-c-text-muted truncate">{m.detail}</div>
              </div>
              <span className={`text-[10px] font-bold tabular-nums ${scoreColor(m.score)}`}>
                {m.score}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
