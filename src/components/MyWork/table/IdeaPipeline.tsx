/**
 * IdeaPipeline — Idea → Initiative conversion pipeline with stage gates.
 *
 * Workflow: Draft → Validated → Approved → Initiative
 * Each stage has configurable criteria. Shows a conversion funnel dashboard.
 */
import {
  ArrowRight,
  Check,
  ChevronRight,
  Filter,
  Flag,
  Loader2,
  Rocket,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';

import type { TableNode } from './tableTypes';
import { ROW_ACCENT_COLORS } from './tableTypes';

export interface PipelineStage {
  id: string;
  label: string;
  labelPl: string;
  color: string;
  icon: React.ReactNode;
  criteria: string[];
  criteriaPl: string[];
}

const DEFAULT_STAGES: PipelineStage[] = [
  {
    id: 'draft',
    label: 'Draft',
    labelPl: 'Szkic',
    color: 'var(--c-text-muted)',
    icon: <Flag size={12} />,
    criteria: ['Has a title', 'Has a description'],
    criteriaPl: ['Ma tytuł', 'Ma opis'],
  },
  {
    id: 'validated',
    label: 'Validated',
    labelPl: 'Zwalidowany',
    color: 'var(--c-warning)',
    icon: <Shield size={12} />,
    criteria: ['Impact assessed', 'Effort estimated', 'At least 1 supporter'],
    criteriaPl: ['Oceniony wpływ', 'Oszacowany wysiłek', 'Min. 1 zwolennik'],
  },
  {
    id: 'approved',
    label: 'Approved',
    labelPl: 'Zatwierdzony',
    color: 'var(--c-success)',
    icon: <Check size={12} />,
    criteria: ['Scoring > 60', 'Budget allocated', 'Sponsor assigned'],
    criteriaPl: ['Scoring > 60', 'Budżet przydzielony', 'Sponsor wyznaczony'],
  },
  {
    id: 'initiative',
    label: 'Initiative',
    labelPl: 'Inicjatywa',
    color: 'var(--c-info)',
    icon: <Rocket size={12} />,
    criteria: ['Converted to initiative module', 'Team assigned'],
    criteriaPl: ['Skonwertowany do modułu inicjatyw', 'Zespół przydzielony'],
  },
];

interface IdeaPipelineProps {
  open: boolean;
  onClose: () => void;
  nodes: TableNode[];
  ideaId: string;
  onStageChange: (nodeId: string, stage: string) => void;
  onConvertToInitiative?: (nodeId: string) => void;
}

function evaluateCriteria(
  node: TableNode,
  stage: PipelineStage
): { met: number; total: number; details: boolean[] } {
  const data = node.data || {};
  const details: boolean[] = [];

  for (const criterion of stage.criteria) {
    const lower = criterion.toLowerCase();
    if (lower.includes('title')) {
      details.push(!!data.label && String(data.label).trim().length > 0);
    } else if (lower.includes('description')) {
      details.push(!!data.description || !!data.bodyMarkdown);
    } else if (lower.includes('impact')) {
      details.push(data.impact != null && Number(data.impact) > 0);
    } else if (lower.includes('effort')) {
      details.push(data.effort != null && Number(data.effort) > 0);
    } else if (lower.includes('supporter') || lower.includes('zwolennik')) {
      details.push(Array.isArray(data.supporters) ? data.supporters.length > 0 : !!data.owner);
    } else if (lower.includes('scoring')) {
      const threshold = parseInt(lower.match(/\d+/)?.[0] || '60');
      details.push(Number(data.score || 0) >= threshold);
    } else if (lower.includes('budget')) {
      details.push(!!data.budget || !!data.cost);
    } else if (lower.includes('sponsor')) {
      details.push(!!data.sponsor || !!data.owner);
    } else if (lower.includes('converted') || lower.includes('skonwertowany')) {
      details.push(data.pipelineStage === 'initiative');
    } else if (lower.includes('team') || lower.includes('zespół')) {
      details.push(Array.isArray(data.team) ? data.team.length > 0 : !!data.owner);
    } else {
      details.push(true);
    }
  }

  return { met: details.filter(Boolean).length, total: details.length, details };
}

function getNodeStage(node: TableNode): string {
  return node.data?.pipelineStage || 'draft';
}

export const IdeaPipeline: React.FC<IdeaPipelineProps> = ({
  open,
  onClose,
  nodes,
  ideaId,
  onStageChange,
  onConvertToInitiative,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);

  const stages = DEFAULT_STAGES;

  const stageGroups = useMemo(() => {
    const groups = new Map<string, TableNode[]>();
    for (const stage of stages) groups.set(stage.id, []);
    for (const node of nodes) {
      const s = getNodeStage(node);
      const bucket = groups.get(s) || groups.get('draft')!;
      bucket.push(node);
    }
    return groups;
  }, [nodes, stages]);

  const funnelData = useMemo(() => {
    return stages.map((stage) => ({
      stage,
      count: stageGroups.get(stage.id)?.length || 0,
    }));
  }, [stageGroups, stages]);

  const totalIdeas = nodes.length;
  const conversionRate =
    totalIdeas > 0
      ? Math.round(((stageGroups.get('initiative')?.length || 0) / totalIdeas) * 100)
      : 0;

  const handlePromote = useCallback(
    (nodeId: string, currentStage: string) => {
      const idx = stages.findIndex((s) => s.id === currentStage);
      if (idx < 0 || idx >= stages.length - 1) return;
      const nextStage = stages[idx + 1].id;
      setPromotingId(nodeId);

      if (nextStage === 'initiative' && onConvertToInitiative) {
        onConvertToInitiative(nodeId);
      }
      onStageChange(nodeId, nextStage);
      setTimeout(() => setPromotingId(null), 600);
    },
    [onConvertToInitiative, onStageChange, stages]
  );

  const containerRef = useRef<HTMLDivElement>(null);
  useDialogA11y({ open, onClose, containerRef });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="idea-pipeline-heading"
        tabIndex={-1}
        className="w-[680px] max-w-[95vw] max-h-[85vh] rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-2xl overflow-hidden flex flex-col outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-c-border-subtle">
          <Rocket size={16} className="text-c-text-secondary" />
          <span id="idea-pipeline-heading" className="text-sm font-bold text-c-text">
            {t('myWorkTable.ideaPipeline.title')}
          </span>
          <div className="flex-1" />
          <div className="flex items-center gap-1.5 mr-3">
            <TrendingUp size={11} className="text-emerald-500" />
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              {conversionRate}% {t('myWorkTable.ideaPipeline.conversion')}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-c-surface-raised transition-colors"
          >
            <X size={14} className="text-c-text-secondary" />
          </button>
        </div>

        {/* Funnel visualization */}
        <div className="px-5 py-4 border-b border-c-border-subtle">
          <div className="flex items-center gap-1">
            {funnelData.map((item, idx) => {
              const maxCount = Math.max(...funnelData.map((f) => f.count), 1);
              const widthPct = Math.max((item.count / maxCount) * 100, 20);
              return (
                <React.Fragment key={item.stage.id}>
                  <button
                    onClick={() =>
                      setSelectedStage(selectedStage === item.stage.id ? null : item.stage.id)
                    }
                    className={`flex-1 rounded-xl px-3 py-2.5 transition-all cursor-pointer ${selectedStage === item.stage.id ? 'ring-2 ring-c-focus' : 'hover:ring-1 hover:ring-c-border'}`}
                    style={{
                      backgroundColor: `color-mix(in srgb, ${item.stage.color} 10%, transparent)`,
                    }}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span style={{ color: item.stage.color }}>{item.stage.icon}</span>
                      <span
                        className="text-[9px] font-bold uppercase tracking-wider"
                        style={{ color: item.stage.color }}
                      >
                        {isPl ? item.stage.labelPl : item.stage.label}
                      </span>
                    </div>
                    <div className="text-lg font-black text-c-text">{item.count}</div>
                    <div className="mt-1 h-1 rounded-full bg-c-border-subtle overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${widthPct}%`, backgroundColor: item.stage.color }}
                      />
                    </div>
                  </button>
                  {idx < funnelData.length - 1 && (
                    <ChevronRight size={14} className="text-c-text-secondary flex-shrink-0" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Stage detail / items */}
        <div className="flex-1 overflow-auto px-5 py-4">
          {selectedStage ? (
            (() => {
              const stage = stages.find((s) => s.id === selectedStage)!;
              const stageNodes = stageGroups.get(selectedStage) || [];
              return (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span style={{ color: stage.color }}>{stage.icon}</span>
                    <span className="text-xs font-bold text-c-text">
                      {isPl ? stage.labelPl : stage.label} ({stageNodes.length})
                    </span>
                  </div>

                  {/* Criteria */}
                  <div className="mb-4 p-3 rounded-xl bg-c-surface-raised border border-c-border-subtle">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-c-text-muted">
                      {t('myWorkTable.ideaPipeline.stageGateCriteria')}
                    </span>
                    <div className="mt-1.5 space-y-1">
                      {(isPl ? stage.criteriaPl : stage.criteria).map((c, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-1.5 text-[10px] text-c-text-secondary"
                        >
                          <div
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: stage.color }}
                          />
                          {c}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Items */}
                  {stageNodes.length === 0 ? (
                    <p className="text-xs text-c-text-secondary text-center py-4">
                      {t('myWorkTable.ideaPipeline.noIdeasAtStage')}
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {stageNodes.map((node) => {
                        const eval_ = evaluateCriteria(node, stage);
                        const nextStageIdx = stages.findIndex((s) => s.id === selectedStage) + 1;
                        const nextStage =
                          nextStageIdx < stages.length ? stages[nextStageIdx] : null;
                        const canPromote = nextStage && eval_.met === eval_.total;
                        const nodeColor = node.data?.color || ROW_ACCENT_COLORS[0];

                        return (
                          <div
                            key={node.id}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-c-surface border border-slate-200/60 dark:border-white/[0.03]"
                          >
                            <div
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: nodeColor }}
                            />
                            <span className="text-[11px] font-medium text-c-text flex-1 truncate">
                              {node.data?.label || node.id}
                            </span>
                            <div className="flex items-center gap-1">
                              <span
                                className={`text-[9px] font-bold ${eval_.met === eval_.total ? 'text-emerald-500' : 'text-amber-500'}`}
                              >
                                {eval_.met}/{eval_.total}
                              </span>
                              <div className="w-8 h-1 rounded-full bg-c-border-subtle overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${(eval_.met / Math.max(eval_.total, 1)) * 100}%`,
                                    backgroundColor:
                                      eval_.met === eval_.total
                                        ? 'var(--c-success)'
                                        : 'var(--c-warning)',
                                  }}
                                />
                              </div>
                            </div>
                            {nextStage && (
                              <button
                                onClick={() => handlePromote(node.id, selectedStage)}
                                disabled={!canPromote || promotingId === node.id}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold transition-colors ${canPromote ? 'text-white hover:opacity-90' : 'text-c-text-secondary bg-c-surface-raised cursor-not-allowed'}`}
                                style={
                                  canPromote ? { backgroundColor: nextStage.color } : undefined
                                }
                                title={
                                  canPromote
                                    ? t('myWorkTable.ideaPipeline.promoteTo', {
                                        stage: isPl ? nextStage.labelPl : nextStage.label,
                                      })
                                    : t('myWorkTable.ideaPipeline.meetCriteriaFirst')
                                }
                              >
                                {promotingId === node.id ? (
                                  <Loader2 size={9} className="animate-spin" />
                                ) : (
                                  <ArrowRight size={9} />
                                )}
                                {isPl ? nextStage.labelPl : nextStage.label}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            <div className="text-center py-8">
              <Target size={24} className="text-c-text-secondary mx-auto mb-2" />
              <p className="text-xs text-c-text-secondary">
                {t('myWorkTable.ideaPipeline.clickStageHint')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IdeaPipeline;
