/**
 * AIAutoClustering — AI groups nodes into thematic clusters and suggests
 * reorganization of the map structure.
 */
import { Group, Loader2, Palette, RefreshCw, Sparkles, X, Zap } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

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

const CLUSTER_COLORS = [
  '#fb7185',
  '#34d399',
  '#fbbf24',
  '#38bdf8',
  '#a78bfa',
  '#22d3ee',
  '#f472b6',
  '#4ade80',
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
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

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
    toast.success(isPl ? 'Klastry zastosowane' : 'Clusters applied', { duration: 1200 });
    onClose();
  }, [clusters, isPl, onApplyClusters, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-lg rounded-2xl bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200/60 dark:border-navy-700/60">
          <div className="flex items-center gap-2">
            <Group size={16} className="text-blue-500" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">
              {isPl ? 'AI: Auto-Clustering' : 'AI: Auto-Clustering'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
          {clusters.length === 0 && !loading && (
            <div className="text-center py-8">
              <Palette size={36} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4">
                {isPl
                  ? 'AI pogrupuje pomysły w klastry tematyczne.'
                  : 'AI will group ideas into thematic clusters.'}
              </p>
              <button
                onClick={detectClusters}
                disabled={loading || locked}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500/15 to-blue-500/10 text-[11px] font-bold text-blue-700 dark:text-blue-300 hover:from-blue-500/25 hover:to-blue-500/15 transition-all disabled:opacity-40"
              >
                <Sparkles size={14} />
                {isPl ? 'Wykryj klastry' : 'Detect clusters'}
              </button>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 size={16} className="animate-spin text-blue-500" />
              <span className="text-[11px] text-slate-500">
                {isPl ? 'Grupuję...' : 'Clustering...'}
              </span>
            </div>
          )}

          {clusters.length > 0 && (
            <div className="space-y-2">
              {clusters.map((cluster) => (
                <div
                  key={cluster.id}
                  className="p-3 rounded-xl border border-slate-200/30 dark:border-navy-700/30"
                  style={{ borderLeftColor: cluster.color, borderLeftWidth: 3 }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: cluster.color }}
                    />
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                      {cluster.name}
                    </span>
                    <span className="text-[9px] text-slate-400">
                      ({cluster.nodeIds.length} nodes)
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {cluster.nodeIds.map((nid) => {
                      const node = nodes.find((n) => n.id === nid);
                      return (
                        <span
                          key={nid}
                          className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400"
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
                  className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700 transition-colors"
                >
                  <RefreshCw size={10} /> {isPl ? 'Ponownie' : 'Re-run'}
                </button>
                <div className="flex-1" />
                <button
                  onClick={handleApply}
                  disabled={locked}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 transition-colors disabled:opacity-40"
                >
                  <Zap size={12} /> {isPl ? 'Zastosuj klastry' : 'Apply clusters'}
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
