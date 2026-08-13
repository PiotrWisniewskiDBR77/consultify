/**
 * AIAutoClustering — AI groups nodes into thematic clusters and suggests
 * reorganization of the map structure.
 */
import { Group, Loader2, Palette, RefreshCw, Sparkles, X, Zap } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';

import { Api } from '@/services/api';

export interface Cluster {
  id: string;
  name: string;
  color: string;
  nodeIds: string[];
  suggestedBranch?: string;
}

interface AIAutoClusteringProps {
  open: boolean;
  onClose: () => void;
  ideaId: string;
  ideaTitle: string;
  nodes: Array<{ id: string; data: any }>;
  locked: boolean;
  onApplyClusters: (clusters: Cluster[]) => void;
}

// Cluster colors = DATA (series). Canonical identity palette, blue-first (§15.1).
const CLUSTER_COLORS = [
  'var(--c-tag-1)',
  'var(--c-tag-2)',
  'var(--c-tag-6)',
  'var(--c-tag-9)',
  'var(--c-tag-3)',
  'var(--c-tag-4)',
  'var(--c-tag-11)',
  'var(--c-tag-12)',
];

export const AIAutoClustering: React.FC<AIAutoClusteringProps> = ({
  open,
  onClose,
  ideaId,
  ideaTitle,
  nodes,
  locked,
  onApplyClusters,
}) => {
  const { t, i18n } = useTranslation();

  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(false);

  const detectClusters = useCallback(async () => {
    setLoading(true);
    try {
      const ideaNodes = nodes.filter((n) => n.id !== 'root' && !n.id.startsWith('branch-'));
      const labels = ideaNodes.map((n) => n.data?.label || n.id);

      const res = await Api.getMyIdeaAISuggestions(ideaId, {
        seedText: `Group these ideas into 3-6 thematic clusters for "${ideaTitle}". Ideas: ${labels.join(', ')}. Return clusters with names and which ideas belong to each.`,
        mapNodes: nodes.map((n) => ({
          id: n.id,
          type: 'idea',
          data: { label: n.data?.label, branchKey: n.data?.branchKey },
        })),
        activeTool: 'mindmap',
        language: i18n.language,
      });

      if (res?.suggestions && Array.isArray(res.suggestions)) {
        const detected: Cluster[] = res.suggestions.slice(0, 6).map((s: any, idx: number) => {
          const matchedIds = ideaNodes
            .filter((n) => {
              const label = (n.data?.label || '').toLowerCase();
              const clusterText = (s.text || s.detail || '').toLowerCase();
              return (
                clusterText.includes(label.slice(0, 10)) || label.includes(clusterText.slice(0, 10))
              );
            })
            .map((n) => n.id);

          return {
            id: `cluster-${idx}`,
            name: s.text || `Cluster ${idx + 1}`,
            color: CLUSTER_COLORS[idx % CLUSTER_COLORS.length],
            nodeIds:
              matchedIds.length > 0
                ? matchedIds
                : ideaNodes.slice(idx * 2, idx * 2 + 2).map((n) => n.id),
            suggestedBranch: s.category || undefined,
          };
        });
        setClusters(detected);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to detect clusters');
    } finally {
      setLoading(false);
    }
  }, [i18n.language, ideaId, ideaTitle, nodes]);

  const handleApply = useCallback(() => {
    onApplyClusters(clusters);
    toast.success(t('ideas.mindmap.clustersApplied', 'Clusters applied'), { duration: 1200 });
    onClose();
  }, [clusters, onApplyClusters, onClose]);

  const containerRef = useRef<HTMLDivElement>(null);
  useDialogA11y({ open, onClose, containerRef });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-c-bg">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="a-i-auto-clustering-modal-heading"
        tabIndex={-1}
        className="w-full max-w-lg rounded-2xl bg-c-surface-raised dark:bg-c-surface backdrop-blur-xl shadow-2xl overflow-hidden outline-none"
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-c-border-subtle dark:border-c-border-subtle">
          <div className="flex items-center gap-2">
            <Group size={16} className="text-c-info" />
            <h3 className="text-sm font-bold text-c-text dark:text-c-text" id="a-i-auto-clustering-modal-heading">
              {t('ideas.mindmap.aiAutoClustering', 'AI: Auto-Clustering')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-c-text-secondary hover:text-c-text-secondary dark:hover:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
          {clusters.length === 0 && !loading && (
            <div className="text-center py-8">
              <Palette
                size={36}
                className="text-c-text-secondary dark:text-c-text-muted mx-auto mb-3"
              />
              <p className="text-[11px] text-c-text-secondary dark:text-c-text-muted mb-4">
                {t(
                  'ideas.mindmap.aiWillGroupIdeasIntoThematic',
                  'AI will group ideas into thematic clusters.'
                )}
              </p>
              <button
                onClick={detectClusters}
                disabled={loading || locked}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-c-surface-raised text-[11px] font-bold text-c-info dark:text-c-info transition-all disabled:opacity-40"
              >
                <Sparkles size={14} />
                {t('ideas.mindmap.detectClusters', 'Detect clusters')}
              </button>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 size={16} className="animate-spin text-c-info" />
              <span className="text-[11px] text-c-text-secondary">
                {t('ideas.mindmap.clustering', 'Clustering...')}
              </span>
            </div>
          )}

          {clusters.length > 0 && (
            <div className="space-y-2">
              {clusters.map((cluster) => (
                <div
                  key={cluster.id}
                  className="p-3 rounded-xl border border-c-border-subtle dark:border-c-border-subtle"
                  style={{ borderLeftColor: cluster.color, borderLeftWidth: 3 }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: cluster.color }}
                    />
                    <span className="text-[11px] font-bold text-c-text-secondary dark:text-c-text">
                      {cluster.name}
                    </span>
                    <span className="text-[9px] text-c-text-secondary">
                      ({cluster.nodeIds.length} nodes)
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {cluster.nodeIds.map((nid) => {
                      const node = nodes.find((n) => n.id === nid);
                      return (
                        <span
                          key={nid}
                          className="text-[9px] px-1.5 py-0.5 rounded-full bg-c-surface-raised dark:bg-c-surface text-c-text-secondary dark:text-c-text-muted"
                        >
                          {node?.data?.label || nid}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={detectClusters}
                  disabled={loading}
                  className="inline-flex items-center gap-1 text-[10px] text-c-text-secondary hover:text-c-text-secondary transition-colors"
                >
                  <RefreshCw size={10} /> {t('ideas.mindmap.reRun', 'Re-run')}
                </button>
                <div className="flex-1" />
                <button
                  onClick={handleApply}
                  disabled={locked}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold bg-c-surface-raised text-c-info dark:text-c-info hover:bg-c-surface-raised transition-colors disabled:opacity-40"
                >
                  <Zap size={12} /> {t('ideas.mindmap.applyClusters', 'Apply clusters')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIAutoClustering;
