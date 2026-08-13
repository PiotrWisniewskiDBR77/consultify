/**
 * CrossTableRelations — Manage relations between ideas across different tables/ideas.
 *
 * Features:
 * - Browse other idea maps in the organization
 * - Create cross-references (edges) between tables
 * - Rollup aggregations from related tables
 * - "Idea Network" visualization showing all connections
 */
import {
  ArrowRight,
  ExternalLink,
  Link2,
  Loader2,
  Network,
  Plus,
  Search,
  Sigma,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';

import type { TableEdge, TableNode } from './tableTypes';
import { ROW_ACCENT_COLORS } from './tableTypes';

interface ExternalIdeaMap {
  id: string;
  title: string;
  nodeCount: number;
  updatedAt: string;
}

interface CrossRelation {
  id: string;
  sourceIdeaId: string;
  sourceNodeId: string;
  sourceLabel: string;
  targetIdeaId: string;
  targetNodeId: string;
  targetLabel: string;
  relationType: 'depends_on' | 'related_to' | 'blocks' | 'duplicates' | 'parent_of';
}

interface RollupConfig {
  sourceIdeaId: string;
  sourceField: string;
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max';
  label: string;
}

interface CrossTableRelationsProps {
  open: boolean;
  onClose: () => void;
  ideaId: string;
  currentNodes: TableNode[];
  currentEdges: TableEdge[];
  onAddEdge: (edge: TableEdge) => void;
  onAddRollupColumn?: (config: RollupConfig) => void;
}

const RELATION_TYPES: {
  id: CrossRelation['relationType'];
  label: string;
  labelPl: string;
  color: string;
}[] = [
  { id: 'related_to', label: 'Related to', labelPl: 'Powiązany z', color: 'var(--c-info)' },
  { id: 'depends_on', label: 'Depends on', labelPl: 'Zależy od', color: 'var(--c-warning)' },
  { id: 'blocks', label: 'Blocks', labelPl: 'Blokuje', color: 'var(--c-danger)' },
  { id: 'duplicates', label: 'Duplicates', labelPl: 'Duplikuje', color: 'var(--c-text-muted)' },
  { id: 'parent_of', label: 'Parent of', labelPl: 'Rodzic', color: 'var(--c-success)' },
];

export const CrossTableRelations: React.FC<CrossTableRelationsProps> = ({
  open,
  onClose,
  ideaId,
  currentNodes,
  currentEdges,
  onAddEdge,
  onAddRollupColumn,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [externalMaps, setExternalMaps] = useState<ExternalIdeaMap[]>([]);
  const [selectedMap, setSelectedMap] = useState<ExternalIdeaMap | null>(null);
  const [externalNodes, setExternalNodes] = useState<TableNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'relations' | 'network' | 'rollups'>('relations');

  const [linkSource, setLinkSource] = useState<string | null>(null);
  const [linkRelType, setLinkRelType] = useState<CrossRelation['relationType']>('related_to');

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      try {
        const { Api } = await import('@/services/api');
        const result = await (Api as any).listIdeaMaps?.({ exclude: ideaId });
        if (Array.isArray(result?.maps)) {
          setExternalMaps(result.maps);
        } else {
          setExternalMaps([
            {
              id: 'demo-1',
              title: t('myWorkTable.crossTableRelations.digitalStrategy'),
              nodeCount: 12,
              updatedAt: new Date().toISOString(),
            },
            {
              id: 'demo-2',
              title: t('myWorkTable.crossTableRelations.processOptimization'),
              nodeCount: 8,
              updatedAt: new Date().toISOString(),
            },
            {
              id: 'demo-3',
              title: t('myWorkTable.crossTableRelations.productInnovation'),
              nodeCount: 15,
              updatedAt: new Date().toISOString(),
            },
          ]);
        }
      } catch {
        setExternalMaps([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [ideaId, isPl, open]);

  const handleSelectMap = useCallback(
    async (map: ExternalIdeaMap) => {
      setSelectedMap(map);
      setLoading(true);
      try {
        const { Api } = await import('@/services/api');
        const result = await Api.getMyIdeaMap(map.id, { language: i18n.language });
        const nodes = Array.isArray(result?.map?.nodes) ? (result.map.nodes as TableNode[]) : [];
        setExternalNodes(nodes);
      } catch {
        setExternalNodes([]);
      } finally {
        setLoading(false);
      }
    },
    [i18n.language]
  );

  const handleCreateLink = useCallback(
    (targetNodeId: string) => {
      if (!linkSource || !selectedMap) return;
      const sourceNode = currentNodes.find((n) => n.id === linkSource);
      const targetNode = externalNodes.find((n) => n.id === targetNodeId);

      const newRelation: CrossRelation = {
        id: `xrel-${Date.now()}`,
        sourceIdeaId: ideaId,
        sourceNodeId: linkSource,
        sourceLabel: sourceNode?.data?.label || linkSource,
        targetIdeaId: selectedMap.id,
        targetNodeId,
        targetLabel: targetNode?.data?.label || targetNodeId,
        relationType: linkRelType,
      };
      const edge: TableEdge = {
        id: newRelation.id,
        source: linkSource,
        target: targetNodeId,
        type: linkRelType,
        data: { crossTable: true, targetIdeaId: selectedMap.id, relationType: linkRelType },
      };
      onAddEdge(edge);
      setLinkSource(null);
    },
    [currentNodes, externalNodes, ideaId, linkRelType, linkSource, onAddEdge, selectedMap]
  );

  const existingRelations = useMemo(() => {
    return currentEdges
      .filter((e) => e.data?.crossTable)
      .map((e) => ({
        id: e.id,
        sourceIdeaId: ideaId,
        sourceNodeId: e.source,
        sourceLabel: currentNodes.find((n) => n.id === e.source)?.data?.label || e.source,
        targetIdeaId: String(e.data?.targetIdeaId || ''),
        targetNodeId: e.target,
        targetLabel: e.target,
        relationType: (e.data?.relationType || 'related_to') as CrossRelation['relationType'],
      }));
  }, [currentEdges, currentNodes, ideaId]);

  const allRelations = existingRelations;

  const filteredExternalNodes = searchQuery
    ? externalNodes.filter((n) =>
        (n.data?.label || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : externalNodes;

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
        aria-labelledby="cross-table-relations-heading"
        tabIndex={-1}
        className="w-[600px] max-w-[95vw] max-h-[85vh] rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-2xl overflow-hidden flex flex-col outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-c-border-subtle">
          <Network size={16} className="text-c-text-secondary" />
          <span id="cross-table-relations-heading" className="text-sm font-bold text-c-text">
            {t('myWorkTable.crossTableRelations.crossTableRelations')}
          </span>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-c-surface-raised transition-colors"
          >
            <X size={14} className="text-c-text-secondary" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-5 py-2 border-b border-c-border-subtle">
          {(['relations', 'network', 'rollups'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${activeTab === tab ? 'bg-c-border-subtle text-c-text' : 'text-c-text-secondary hover:text-c-text-secondary'}`}
            >
              {tab === 'relations'
                ? t('myWorkTable.crossTableRelations.relations')
                : tab === 'network'
                  ? t('myWorkTable.crossTableRelations.network')
                  : 'Rollups'}
              {tab === 'relations' && allRelations.length > 0 && ` (${allRelations.length})`}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {activeTab === 'relations' && (
            <div className="flex h-full">
              {/* Left: external maps */}
              <div className="w-48 border-r border-c-border-subtle p-3 overflow-auto flex-shrink-0">
                <span className="text-[9px] font-bold uppercase tracking-wider text-c-text-secondary block mb-2">
                  {t('myWorkTable.crossTableRelations.otherIdeaMaps')}
                </span>
                {loading && externalMaps.length === 0 ? (
                  <Loader2 size={14} className="animate-spin text-c-text-secondary mx-auto mt-4" />
                ) : (
                  <div className="space-y-1">
                    {externalMaps.map((map) => (
                      <button
                        key={map.id}
                        onClick={() => handleSelectMap(map)}
                        className={`w-full text-left px-2 py-1.5 rounded-lg text-[10px] transition-colors ${selectedMap?.id === map.id ? 'bg-c-border-subtle text-c-text font-bold' : 'text-c-text-secondary hover:bg-c-surface-raised'}`}
                      >
                        <div className="font-medium truncate">{map.title}</div>
                        <div className="text-[8px] text-c-text-secondary">
                          {map.nodeCount} {t('myWorkTable.crossTableRelations.items')}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: nodes from selected map */}
              <div className="flex-1 p-3 overflow-auto">
                {!selectedMap ? (
                  <div className="text-center py-8">
                    <Link2 size={20} className="text-c-text-secondary mx-auto mb-2" />
                    <p className="text-xs text-c-text-secondary">
                      {t('myWorkTable.crossTableRelations.selectAMapToSee')}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="relative flex-1">
                        <Search
                          size={10}
                          className="absolute left-2 top-1/2 -translate-y-1/2 text-c-text-secondary"
                        />
                        <input
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder={t('myWorkTable.crossTableRelations.search')}
                          className="w-full h-7 pl-7 pr-2 rounded-lg text-[10px] bg-c-surface-raised border border-c-border-subtle text-c-text outline-none focus:ring-2 focus:ring-blue-500/30"
                        />
                      </div>
                      {linkSource && (
                        <select
                          value={linkRelType}
                          onChange={(e) => setLinkRelType(e.target.value as any)}
                          className="h-7 px-1 rounded-lg text-[9px] bg-c-surface-raised border border-c-border-subtle text-c-text"
                        >
                          {RELATION_TYPES.map((rt) => (
                            <option key={rt.id} value={rt.id}>
                              {isPl ? rt.labelPl : rt.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Source node selector */}
                    {!linkSource && (
                      <div className="mb-3 p-2 rounded-xl bg-amber-500/5 border border-amber-500/20">
                        <p className="text-[9px] font-bold text-amber-600 mb-1.5">
                          {t('myWorkTable.crossTableRelations.selectSourceFromCurrentTable')}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {currentNodes.slice(0, 10).map((n) => (
                            <button
                              key={n.id}
                              onClick={() => setLinkSource(n.id)}
                              className="px-2 py-1 rounded-lg text-[9px] font-medium bg-c-surface border border-slate-200/60 dark:border-white/[0.03] text-c-text-secondary hover:border-c-border transition-colors truncate max-w-[120px]"
                            >
                              {n.data?.label || n.id}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {linkSource && (
                      <div className="mb-2 flex items-center gap-1 text-[9px] text-c-text">
                        <span className="font-bold">
                          {currentNodes.find((n) => n.id === linkSource)?.data?.label || linkSource}
                        </span>
                        <ArrowRight size={9} />
                        <span className="text-c-text-secondary">
                          {t('myWorkTable.crossTableRelations.selectTarget')}
                        </span>
                        <button
                          onClick={() => setLinkSource(null)}
                          className="ml-auto text-c-text-secondary hover:text-c-text-secondary"
                        >
                          <X size={9} />
                        </button>
                      </div>
                    )}

                    <div className="space-y-1">
                      {filteredExternalNodes.map((node, idx) => {
                        const color =
                          node.data?.color || ROW_ACCENT_COLORS[idx % ROW_ACCENT_COLORS.length];
                        return (
                          <div
                            key={node.id}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-c-surface-raised transition-colors"
                          >
                            <div
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            <span className="text-[10px] font-medium text-c-text flex-1 truncate">
                              {node.data?.label || node.id}
                            </span>
                            {linkSource && (
                              <button
                                onClick={() => handleCreateLink(node.id)}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg text-[8px] font-bold text-c-text bg-c-surface-raised hover:bg-c-surface-raised/80 transition-colors"
                              >
                                <Link2 size={8} />
                                {t('myWorkTable.crossTableRelations.link')}
                              </button>
                            )}
                            <ExternalLink size={9} className="text-c-text-secondary" />
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === 'network' && (
            <div className="p-5">
              <div className="text-center mb-4">
                <Network size={32} className="text-c-text-secondary mx-auto mb-2" />
                <p className="text-xs font-bold text-c-text">
                  {t('myWorkTable.crossTableRelations.ideaNetwork')}
                </p>
                <p className="text-[10px] text-c-text-secondary">
                  {allRelations.length} {t('myWorkTable.crossTableRelations.connections')}
                </p>
              </div>
              {allRelations.length === 0 ? (
                <p className="text-xs text-c-text-secondary text-center">
                  {t('myWorkTable.crossTableRelations.noRelationsCreateOneIn')}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {allRelations.map((rel) => {
                    const relType = RELATION_TYPES.find((r) => r.id === rel.relationType);
                    return (
                      <div
                        key={rel.id}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-c-surface-raised"
                      >
                        <span className="text-[10px] font-medium text-c-text truncate flex-1">
                          {rel.sourceLabel}
                        </span>
                        <span
                          className="text-[8px] font-bold px-1.5 py-0.5 rounded-md"
                          style={{
                            backgroundColor: `color-mix(in srgb, ${relType?.color || 'var(--c-info)'} 12%, transparent)`,
                            color: relType?.color || 'var(--c-info)',
                          }}
                        >
                          {isPl ? relType?.labelPl : relType?.label}
                        </span>
                        <span className="text-[10px] font-medium text-c-text truncate flex-1 text-right">
                          {rel.targetLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'rollups' && (
            <div className="p-5">
              <div className="text-center py-6">
                <Sigma size={24} className="text-c-text-secondary mx-auto mb-2" />
                <p className="text-xs font-bold text-c-text mb-1">
                  {t('myWorkTable.crossTableRelations.rollupAggregations')}
                </p>
                <p className="text-[10px] text-c-text-secondary mb-4">
                  {t('myWorkTable.crossTableRelations.aggregateDataFromRelatedTables')}
                </p>
                {onAddRollupColumn && (
                  <button
                    onClick={() =>
                      onAddRollupColumn({
                        sourceIdeaId: '',
                        sourceField: '',
                        aggregation: 'count',
                        label: 'Cross-table count',
                      })
                    }
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-bold text-c-text bg-c-surface-raised hover:bg-c-surface-raised/80 transition-colors"
                  >
                    <Plus size={10} />
                    {t('myWorkTable.crossTableRelations.addRollupColumn')}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CrossTableRelations;
