/**
 * AIDependencyDetector — Detects semantic dependencies between nodes across
 * different branches and suggests cross-branch edges.
 */
import { ArrowRight, GitMerge, Loader2, Network, Plus, X } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';

import { Api } from '@/services/api';

export interface DetectedDependency {
  id: string;
  sourceNodeId: string;
  sourceLabel: string;
  sourceBranch: string;
  targetNodeId: string;
  targetLabel: string;
  targetBranch: string;
  relationship: string;
  confidence: number;
  type: 'depends_on' | 'enables' | 'conflicts_with' | 'related_to';
}

interface AIDependencyDetectorProps {
  open: boolean;
  onClose: () => void;
  ideaId: string;
  ideaTitle: string;
  nodes: Array<{ id: string; data: any }>;
  edges: Array<{ id: string; source: string; target: string }>;
  locked: boolean;
  onAddDependency: (dep: DetectedDependency) => void;
  onAddAll: (deps: DetectedDependency[]) => void;
}

const TYPE_CONFIG: Record<
  string,
  { color: string; colorBg: string; tkey: string; label: string; dash?: string }
> = {
  depends_on: {
    tkey: 'myWorkMindmap.dependency.dependsOn',
    color: 'var(--c-danger)',
    colorBg: 'color-mix(in srgb, var(--c-danger) 8%, transparent)',
    label: 'Depends on',
  },
  enables: {
    tkey: 'myWorkMindmap.dependency.enables',
    color: 'var(--c-success)',
    colorBg: 'color-mix(in srgb, var(--c-success) 8%, transparent)',
    label: 'Enables',
  },
  conflicts_with: {
    tkey: 'myWorkMindmap.dependency.conflictsWith',
    color: 'var(--c-warning)',
    colorBg: 'color-mix(in srgb, var(--c-warning) 8%, transparent)',
    label: 'Conflicts with',
    dash: '5 5',
  },
  related_to: {
    tkey: 'myWorkMindmap.dependency.relatedTo',
    color: 'var(--c-info)',
    colorBg: 'color-mix(in srgb, var(--c-info) 8%, transparent)',
    label: 'Related to',
    dash: '3 6',
  },
};

export const AIDependencyDetector: React.FC<AIDependencyDetectorProps> = ({
  open,
  onClose,
  ideaId,
  ideaTitle,
  nodes,
  edges,
  locked,
  onAddDependency,
  onAddAll,
}) => {
  const { t, i18n } = useTranslation();

  const [dependencies, setDependencies] = useState<DetectedDependency[]>([]);
  const [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState<Set<string>>(new Set());

  const detectDependencies = useCallback(async () => {
    setLoading(true);
    try {
      const ideaNodes = nodes.filter((n) => n.id !== 'root' && !n.id.startsWith('branch-'));
      const nodeLabels = ideaNodes.map(
        (n) => `[${n.data?.branchKey || '?'}] ${n.data?.label || n.id}`
      );

      const res = await Api.getMyIdeaAISuggestions(ideaId, {
        seedText: `Analyze dependencies between these mind map nodes for "${ideaTitle}". Find cross-branch relationships (depends_on, enables, conflicts_with, related_to). Nodes:\n${nodeLabels.join('\n')}\n\nReturn JSON array: [{"sourceIdx":0,"targetIdx":1,"type":"depends_on|enables|conflicts_with|related_to","relationship":"brief description","confidence":0.8}]`,
        mapNodes: nodes.map((n) => ({
          id: n.id,
          type: 'idea',
          data: { label: n.data?.label, branchKey: n.data?.branchKey },
        })),
        activeTool: 'mindmap',
        language: i18n.language,
      });

      if (res?.suggestions && Array.isArray(res.suggestions)) {
        const detected: DetectedDependency[] = [];
        for (const s of res.suggestions) {
          // Map suggestion pairs to actual nodes
          const srcIdx = typeof s.sourceIdx === 'number' ? s.sourceIdx : 0;
          const tgtIdx = typeof s.targetIdx === 'number' ? s.targetIdx : 1;
          const srcNode = ideaNodes[srcIdx] || ideaNodes[0];
          const tgtNode = ideaNodes[tgtIdx] || ideaNodes[1];

          if (!srcNode || !tgtNode || srcNode.id === tgtNode.id) continue;
          if (srcNode.data?.branchKey === tgtNode.data?.branchKey) continue;

          // Check if edge already exists
          const exists = edges.some(
            (e) =>
              (e.source === srcNode.id && e.target === tgtNode.id) ||
              (e.source === tgtNode.id && e.target === srcNode.id)
          );
          if (exists) continue;

          detected.push({
            id: s.id || `dep-${detected.length}`,
            sourceNodeId: srcNode.id,
            sourceLabel: srcNode.data?.label || srcNode.id,
            sourceBranch: srcNode.data?.branchKey || '?',
            targetNodeId: tgtNode.id,
            targetLabel: tgtNode.data?.label || tgtNode.id,
            targetBranch: tgtNode.data?.branchKey || '?',
            relationship: s.detail || s.text || s.relationship || '',
            confidence: s.confidence ?? 0.7,
            type: (['depends_on', 'enables', 'conflicts_with', 'related_to'].includes(s.category)
              ? s.category
              : 'related_to') as DetectedDependency['type'],
          });
        }
        setDependencies(detected);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to detect dependencies');
    } finally {
      setLoading(false);
    }
  }, [edges, i18n.language, ideaId, ideaTitle, nodes]);

  const handleApply = useCallback(
    (dep: DetectedDependency) => {
      onAddDependency(dep);
      setApplied((prev) => new Set([...prev, dep.id]));
      toast.success(t('ideas.mindmap.dependencyAdded', 'Dependency added'), { duration: 800 });
    },
    [onAddDependency, t]
  );

  const handleApplyAll = useCallback(() => {
    const unapplied = dependencies.filter((d) => !applied.has(d.id));
    if (unapplied.length === 0) return;
    onAddAll(unapplied);
    setApplied(new Set(dependencies.map((d) => d.id)));
    toast.success(
      t('ideas.mindmap.addedNDependencies', 'Added {{count}} dependencies', {
        count: unapplied.length,
      }),
      { duration: 1200 }
    );
  }, [applied, dependencies, onAddAll, t]);

  const containerRef = useRef<HTMLDivElement>(null);
  useDialogA11y({ open, onClose, containerRef });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-c-bg">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="a-i-dependency-detector-modal-heading"
        tabIndex={-1}
        className="w-full max-w-2xl rounded-2xl bg-c-surface-raised dark:bg-c-surface backdrop-blur-xl shadow-2xl overflow-hidden outline-none"
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-c-border-subtle dark:border-c-border-subtle">
          <div>
            <div className="flex items-center gap-2">
              <Network size={16} className="text-c-text-secondary" />
              <h3 className="text-sm font-bold text-c-text dark:text-c-text" id="a-i-dependency-detector-modal-heading">
                {t('ideas.mindmap.aiDependencyDetection', 'AI: Dependency Detection')}
              </h3>
            </div>
            <p className="text-[11px] text-c-text-secondary dark:text-c-text-muted mt-1">
              {t(
                'ideas.mindmap.aiAnalyzesRelationshipsBetweenNodesAcross',
                'AI analyzes relationships between nodes across different branches.'
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-c-text-secondary hover:text-c-text-secondary dark:hover:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
          {dependencies.length === 0 && !loading && (
            <div className="text-center py-8">
              <GitMerge
                size={36}
                className="text-c-text-secondary dark:text-c-text-muted mx-auto mb-3"
              />
              <p className="text-[11px] text-c-text-secondary dark:text-c-text-muted mb-4">
                {t(
                  'ideas.mindmap.discoverHiddenDependenciesBetweenIdeas',
                  'Discover hidden dependencies between ideas.'
                )}
              </p>
              <button
                onClick={detectDependencies}
                disabled={loading || locked}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-c-surface-raised dark:bg-c-surface text-[11px] font-bold text-c-text-secondary dark:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface transition-all disabled:opacity-40"
              >
                <Network size={14} />
                {t('ideas.mindmap.analyzeDependencies', 'Analyze dependencies')}
              </button>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 size={16} className="animate-spin text-c-text-secondary" />
              <span className="text-[11px] text-c-text-secondary">
                {t('ideas.mindmap.analyzingConnections', 'Analyzing connections...')}
              </span>
            </div>
          )}

          {dependencies.length > 0 && (
            <div className="space-y-2">
              {dependencies.map((dep) => {
                const cfg = TYPE_CONFIG[dep.type] || TYPE_CONFIG.related_to;
                const isApplied = applied.has(dep.id);
                return (
                  <div
                    key={dep.id}
                    className={`p-3 rounded-xl border transition-all ${isApplied ? 'border-c-success bg-c-surface-raised' : 'border-c-border-subtle dark:border-c-border-subtle bg-c-surface-raised dark:bg-c-surface'}`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: cfg.colorBg, color: cfg.color }}
                      >
                        {t(cfg.tkey, cfg.label)}
                      </span>
                      <span className="text-[9px] text-c-text-secondary">
                        {Math.round(dep.confidence * 100)}%
                      </span>
                      {isApplied && (
                        <span className="text-[9px] text-c-success font-bold ml-auto">ADDED</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px]">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-c-text-secondary dark:text-c-text truncate">
                          {dep.sourceLabel}
                        </div>
                        <div className="text-[9px] text-c-text-secondary">{dep.sourceBranch}</div>
                      </div>
                      <ArrowRight size={14} style={{ color: cfg.color }} className="shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-c-text-secondary dark:text-c-text truncate">
                          {dep.targetLabel}
                        </div>
                        <div className="text-[9px] text-c-text-secondary">{dep.targetBranch}</div>
                      </div>
                    </div>

                    {dep.relationship && (
                      <div className="text-[10px] text-c-text-secondary dark:text-c-text-muted mt-1.5 leading-relaxed">
                        {dep.relationship}
                      </div>
                    )}

                    {!isApplied && (
                      <button
                        onClick={() => handleApply(dep)}
                        disabled={locked}
                        className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-bold text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors disabled:opacity-40"
                      >
                        <Plus size={9} />
                        {t('ideas.mindmap.addConnection', 'Add connection')}
                      </button>
                    )}
                  </div>
                );
              })}

              <div className="flex items-center gap-2 pt-2 border-t border-c-border-subtle dark:border-c-border-subtle">
                <button
                  onClick={detectDependencies}
                  disabled={loading}
                  className="text-[10px] font-medium text-c-text-secondary hover:text-c-text-secondary dark:text-c-text-muted dark:hover:text-c-text transition-colors"
                >
                  {t('ideas.mindmap.reAnalyze', 'Re-analyze')}
                </button>
                <div className="flex-1" />
                <button
                  onClick={handleApplyAll}
                  disabled={locked || applied.size === dependencies.length}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold bg-c-surface dark:bg-c-surface-raised text-c-text-secondary dark:text-c-text hover:bg-c-surface dark:hover:bg-c-surface-raised transition-colors disabled:opacity-40"
                >
                  <Network size={12} />
                  {t('ideas.mindmap.addAll', 'Add all')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIDependencyDetector;
