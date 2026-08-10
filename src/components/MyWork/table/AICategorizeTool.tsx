/**
 * AICategorizeTool — AI-powered auto-categorization, clustering, and duplicate detection.
 *
 * Analyzes all rows and proposes: category tags, thematic clusters,
 * potential duplicates, and merge suggestions.
 */
import { Check, GitMerge, Layers, Loader2, Sparkles, Tag, X, Zap } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';

import type { TableNode } from './tableTypes';
import { ROW_ACCENT_COLORS } from './tableTypes';

interface AICategorizeToolProps {
  open: boolean;
  onClose: () => void;
  nodes: TableNode[];
  ideaId: string;
  onApplyTags: (nodeId: string, tags: string[]) => void;
  onApplyCluster: (nodeId: string, cluster: string, color: string) => void;
  onMergeNodes?: (keepId: string, removeId: string) => void;
}

interface CategoryResult {
  nodeId: string;
  suggestedTags: string[];
  cluster: string;
  clusterColor: string;
  confidence: number;
}

interface DuplicatePair {
  nodeA: string;
  nodeB: string;
  similarity: number;
  reason: string;
}

export const AICategorizeTool: React.FC<AICategorizeToolProps> = ({
  open,
  onClose,
  nodes,
  ideaId,
  onApplyTags,
  onApplyCluster,
  onMergeNodes,
}) => {
  const { t, i18n } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<CategoryResult[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicatePair[]>([]);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'clusters' | 'duplicates'>('clusters');

  const handleAnalyze = useCallback(async () => {
    setLoading(true);
    setCategories([]);
    setDuplicates([]);
    try {
      const { Api } = await import('@/services/api');
      const result = await Api.getIdeaAISuggestions(ideaId, {
        context: {
          title: 'Categorize & Cluster',
          seedText: nodes
            .map(
              (n) =>
                `[${n.id}] ${n.data?.label || ''}: ${n.data?.description || n.data?.bodyMarkdown || ''}`
            )
            .join('\n'),
          currentNodes: nodes.map((n) => ({ id: n.id, type: n.type, label: n.data?.label })),
          currentEdges: [],
          activeTool: 'table',
        },
        mode: 'on_demand',
        prompt: `Analyze these ${nodes.length} ideas and return JSON with two arrays:
1. "categories": for each idea, suggest tags (2-3 keywords) and assign to a thematic cluster (give cluster a short name and hex color).
2. "duplicates": find pairs of ideas that are very similar (>70% overlap), with similarity score and reason.
Format: { "categories": [{ "nodeId": "...", "suggestedTags": [...], "cluster": "...", "clusterColor": "#...", "confidence": 0.0-1.0 }], "duplicates": [{ "nodeA": "...", "nodeB": "...", "similarity": 0.0-1.0, "reason": "..." }] }`,
        language: i18n.language,
      });

      const suggestions = result?.suggestions || [];
      const jsonStr = suggestions.map((s: any) => s.text || s.detail || '').join('');

      try {
        const match = jsonStr.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (Array.isArray(parsed.categories)) setCategories(parsed.categories);
          if (Array.isArray(parsed.duplicates)) setDuplicates(parsed.duplicates);
        }
      } catch {
        // Fallback: generate local clusters based on simple keyword matching
        const clusterMap = new Map<string, string[]>();
        for (const node of nodes) {
          const label = (node.data?.label || '').toLowerCase();
          const firstWord = label.split(/\s+/)[0] || 'other';
          if (!clusterMap.has(firstWord)) clusterMap.set(firstWord, []);
          clusterMap.get(firstWord)!.push(node.id);
        }
        let colorIdx = 0;
        const localCats: CategoryResult[] = [];
        for (const [cluster, ids] of clusterMap) {
          const color = ROW_ACCENT_COLORS[colorIdx % ROW_ACCENT_COLORS.length];
          for (const id of ids) {
            localCats.push({
              nodeId: id,
              suggestedTags: [cluster],
              cluster,
              clusterColor: color,
              confidence: 0.5,
            });
          }
          colorIdx++;
        }
        setCategories(localCats);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [i18n.language, ideaId, nodes]);

  const handleApplyCategory = useCallback(
    (cat: CategoryResult) => {
      onApplyTags(cat.nodeId, cat.suggestedTags);
      onApplyCluster(cat.nodeId, cat.cluster, cat.clusterColor);
      setAppliedIds((prev) => new Set([...prev, cat.nodeId]));
    },
    [onApplyCluster, onApplyTags]
  );

  const handleApplyAll = useCallback(() => {
    for (const cat of categories) {
      onApplyTags(cat.nodeId, cat.suggestedTags);
      onApplyCluster(cat.nodeId, cat.cluster, cat.clusterColor);
    }
    setAppliedIds(new Set(categories.map((c) => c.nodeId)));
  }, [categories, onApplyCluster, onApplyTags]);

  const getNodeLabel = (id: string) => nodes.find((n) => n.id === id)?.data?.label || id;

  const clusters = React.useMemo(() => {
    const map = new Map<string, { color: string; nodes: CategoryResult[] }>();
    for (const cat of categories) {
      if (!map.has(cat.cluster)) map.set(cat.cluster, { color: cat.clusterColor, nodes: [] });
      map.get(cat.cluster)!.nodes.push(cat);
    }
    return Array.from(map.entries());
  }, [categories]);

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
        aria-labelledby="ai-categorize-tool-heading"
        tabIndex={-1}
        className="w-[520px] max-w-[90vw] max-h-[80vh] rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-2xl overflow-hidden flex flex-col outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-c-border-subtle">
          <Sparkles size={16} className="text-c-text-secondary" />
          <span id="ai-categorize-tool-heading" className="text-sm font-bold text-c-text">
            {t('myWorkTable.aiCategorizeTool.title')}
          </span>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-c-surface-raised transition-colors"
          >
            <X size={14} className="text-c-text-secondary" />
          </button>
        </div>

        {/* Action bar */}
        <div className="px-5 py-3 border-b border-c-border-subtle flex items-center gap-2">
          <button
            onClick={handleAnalyze}
            disabled={loading || nodes.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-c-text text-c-surface hover:bg-c-text/90 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            {loading
              ? t('myWorkTable.aiCategorizeTool.analyzing')
              : t('myWorkTable.aiCategorizeTool.analyzeIdeas', { count: nodes.length })}
          </button>
          {categories.length > 0 && (
            <button
              onClick={handleApplyAll}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
            >
              <Check size={12} />
              {t('myWorkTable.aiCategorizeTool.applyAll')}
            </button>
          )}
        </div>

        {/* Tabs */}
        {(categories.length > 0 || duplicates.length > 0) && (
          <div className="flex items-center gap-1 px-5 py-2 border-b border-c-border-subtle">
            <button
              onClick={() => setActiveTab('clusters')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${activeTab === 'clusters' ? 'bg-c-border-subtle text-c-text' : 'text-c-text-secondary hover:text-c-text-secondary'}`}
            >
              <Layers size={10} className="inline mr-1" />
              {t('myWorkTable.aiCategorizeTool.clusters')} ({clusters.length})
            </button>
            <button
              onClick={() => setActiveTab('duplicates')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${activeTab === 'duplicates' ? 'bg-c-border-subtle text-c-text' : 'text-c-text-secondary hover:text-c-text-secondary'}`}
            >
              <GitMerge size={10} className="inline mr-1" />
              {t('myWorkTable.aiCategorizeTool.duplicates')} ({duplicates.length})
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto p-5">
          {categories.length === 0 && duplicates.length === 0 && !loading && (
            <div className="text-center py-8">
              <Sparkles size={24} className="text-c-text-secondary mx-auto mb-2" />
              <p className="text-xs text-c-text-secondary">
                {t('myWorkTable.aiCategorizeTool.clickAnalyzeHint')}
              </p>
            </div>
          )}

          {activeTab === 'clusters' && clusters.length > 0 && (
            <div className="space-y-4">
              {clusters.map(([clusterName, { color, nodes: clusterNodes }]) => (
                <div
                  key={clusterName}
                  className="rounded-xl border border-c-border-subtle overflow-hidden"
                >
                  <div className="flex items-center gap-2 px-3 py-2 bg-c-surface-raised">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-[11px] font-bold text-c-text">{clusterName}</span>
                    <span className="text-[9px] text-c-text-secondary ml-auto">
                      {clusterNodes.length} {t('myWorkTable.aiCategorizeTool.items')}
                    </span>
                  </div>
                  <div className="p-2 space-y-1">
                    {clusterNodes.map((cat) => (
                      <div
                        key={cat.nodeId}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-c-surface-raised"
                      >
                        <span className="text-[11px] text-c-text flex-1 truncate">
                          {getNodeLabel(cat.nodeId)}
                        </span>
                        <div className="flex items-center gap-1">
                          {cat.suggestedTags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[8px] font-bold px-1.5 py-0.5 rounded-md bg-c-surface-raised text-c-text-secondary"
                            >
                              <Tag size={7} className="inline mr-0.5" />
                              {tag}
                            </span>
                          ))}
                        </div>
                        {!appliedIds.has(cat.nodeId) ? (
                          <button
                            onClick={() => handleApplyCategory(cat)}
                            className="p-1 rounded text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                          >
                            <Check size={11} />
                          </button>
                        ) : (
                          <Check size={11} className="text-emerald-400" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'duplicates' && (
            <div className="space-y-2">
              {duplicates.length === 0 && (
                <p className="text-xs text-c-text-secondary text-center py-4">
                  {t('myWorkTable.aiCategorizeTool.noDuplicatesFound')}
                </p>
              )}
              {duplicates.map((dup, idx) => (
                <div key={idx} className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <GitMerge size={12} className="text-amber-500" />
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                      {Math.round(dup.similarity * 100)}%{' '}
                      {t('myWorkTable.aiCategorizeTool.similar')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[11px] font-medium text-c-text flex-1 truncate">
                      {getNodeLabel(dup.nodeA)}
                    </span>
                    <span className="text-[9px] text-c-text-secondary">↔</span>
                    <span className="text-[11px] font-medium text-c-text flex-1 truncate text-right">
                      {getNodeLabel(dup.nodeB)}
                    </span>
                  </div>
                  <p className="text-[10px] text-c-text-muted mb-2">{dup.reason}</p>
                  {onMergeNodes && (
                    <button
                      onClick={() => onMergeNodes(dup.nodeA, dup.nodeB)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 transition-colors"
                    >
                      <GitMerge size={9} />
                      {t('myWorkTable.aiCategorizeTool.merge')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AICategorizeTool;
