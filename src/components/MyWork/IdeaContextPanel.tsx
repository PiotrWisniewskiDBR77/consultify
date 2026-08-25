/**
 * IdeaContextPanel — Extended context panel for Idea Workspace.
 *
 * Sections: Backlinks, Related Initiatives, Assessment Gaps,
 * Interview Insights, KPI Trends, Similar Ideas.
 * Each section supports "Add to canvas" via drag or click.
 */
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  GripVertical,
  Lightbulb,
  Link2,
  MessageSquare,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Shield,
  StickyNote,
  Target,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getSourceDisplayLabel } from '@/components/Initiatives/InitiativeSourceLink';
import { EmbeddedView } from '@/components/shared/NModeBlocks';
import { ToolsPanelShell } from '@/components/shared/WorkspaceTools';
import { Api } from '@/services/api';

type Backlink = {
  id: string;
  sourceType: string;
  sourceId: string;
  createdAt?: string;
};

interface ContextItem {
  id: string;
  type: 'initiative' | 'gap' | 'insight' | 'kpi' | 'idea';
  title: string;
  detail?: string;
  source?: string;
  value?: string | number;
}

interface IdeaContextPanelProps {
  open: boolean;
  onClose: () => void;
  /**
   * EditorShell Wave W (W-1) / SPEC-A consolidated panel: render inside the
   * parent's accordion body (drops the panel's own fixed-width / bordered
   * drawer chrome + close button). Additive — default false = legacy sliding
   * drawer unchanged. Mirrors IdeaWorkspaceTools's `embedded` prop.
   */
  embedded?: boolean;
  ideaId: string;
  title: string;
  selectedNodeId?: string | null;
  selectionMeta?: Record<string, any> | null;
  refreshToken?: number;
  onInsertToCanvas?: (item: { text: string; type: string; detail?: string }) => void;
  liveGraphNodes?: any[];
  liveGraphEdges?: any[];
  mapExtensions?: Record<string, any>;
  activeTool?: string;
  stage?: string;
  seedText?: string;
}

type SectionKey =
  | 'selected_node'
  | 'map_stats'
  | 'warnings'
  | 'notes'
  | 'evidence'
  | 'artifacts'
  | 'initiatives'
  | 'gaps'
  | 'insights'
  | 'kpis'
  | 'similar';

interface NoteItem {
  id: string;
  text: string;
  createdAt?: string;
}

interface EvidenceItem {
  id: string;
  type: 'url' | 'artifact' | 'note' | 'document';
  title: string;
  url?: string;
  artifactId?: string;
}

interface LinkedArtifact {
  id: string;
  type: string;
  title: string;
  moduleIcon?: string;
  artifactId?: string;
}

export const IdeaContextPanel: React.FC<IdeaContextPanelProps> = ({
  open,
  onClose,
  embedded = false,
  ideaId,
  title,
  selectedNodeId,
  selectionMeta,
  refreshToken,
  onInsertToCanvas,
  liveGraphNodes,
  liveGraphEdges,
  mapExtensions,
  activeTool,
  stage,
  seedText,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [loading, setLoading] = useState(false);
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [contextItems, setContextItems] = useState<ContextItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<SectionKey>>(
    new Set([
      'selected_node',
      'map_stats',
      'warnings',
      'notes',
      'evidence',
      'artifacts',
      'initiatives',
      'gaps',
      'insights',
    ])
  );

  // V5-IDEA-28: Notes, evidence, artifacts
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [linkedArtifacts, setLinkedArtifacts] = useState<LinkedArtifact[]>([]);
  const [nodeArtifactMap, setNodeArtifactMap] = useState<(LinkedArtifact & { nodeId?: string })[]>(
    []
  );
  const [newNoteText, setNewNoteText] = useState('');

  const extractGraphData = useCallback((graphNodes: any[]) => {
    const extractedNotes: NoteItem[] = graphNodes
      .filter((n: any) => n?.type === 'noteCard' || n?.data?.kind === 'note_card')
      .map((n: any) => ({
        id: n.id,
        text: n.data?.label || '',
        createdAt: n.data?.createdAt,
      }));
    setNotes(extractedNotes);

    const extractedEvidence: EvidenceItem[] = graphNodes
      .filter((n: any) => n?.type === 'evidenceCard' || n?.data?.kind === 'evidence_card')
      .map((n: any) => ({
        id: n.id,
        type: n.data?.evidenceType || 'note',
        title: n.data?.label || '',
        url: n.data?.url,
        artifactId: n.data?.artifactId,
      }));
    setEvidence(extractedEvidence);

    const extractedArtifacts: LinkedArtifact[] = graphNodes
      .filter(
        (n: any) =>
          n?.type === 'knowledgeCard' ||
          n?.data?.kind === 'artifact_ref' ||
          n?.data?.kind === 'linked_artifact_card'
      )
      .map((n: any) => ({
        id: n.id,
        type: n.data?.artifactType || n.data?.kind || 'knowledge',
        title: n.data?.label || '',
        moduleIcon: n.data?.moduleIcon,
      }));
    const nodeArtLinks: (LinkedArtifact & { nodeId?: string })[] = graphNodes.flatMap((n: any) => {
      const links = Array.isArray(n?.data?.artifactLinks)
        ? n.data.artifactLinks
        : Array.isArray(n?.artifactLinks)
          ? n.artifactLinks
          : null;
      if (!Array.isArray(links)) return [];
      return links.map((link: any) => {
        const realType = link.artifactRef?.type || link.artifactType || link.type || 'unknown';
        const realId = link.artifactRef?.id || link.artifactId || link.id || '';
        return {
          id: `${n.id}__${realType}:${realId}`,
          type: realType,
          title: link.label || link.title || `${realType}:${realId}`,
          moduleIcon: link.moduleIcon,
          artifactId: realId,
          nodeId: String(n.id),
        };
      });
    });
    const seen = new Set(extractedArtifacts.map((a) => a.id));
    const merged = [...extractedArtifacts, ...nodeArtLinks.filter((a) => !seen.has(a.id))];
    setLinkedArtifacts(merged);
    setNodeArtifactMap(nodeArtLinks);
  }, []);

  useEffect(() => {
    if (liveGraphNodes && liveGraphNodes.length > 0) {
      extractGraphData(liveGraphNodes);
    }
  }, [liveGraphNodes, extractGraphData]);

  const displayedArtifacts = useMemo(() => {
    if (!selectedNodeId) return linkedArtifacts;
    return nodeArtifactMap.filter((a) => a.nodeId === selectedNodeId);
  }, [linkedArtifacts, nodeArtifactMap, selectedNodeId]);

  // ── MM-10: Selected node full detail ──────────────────────────────────────
  const selectedNodeData = useMemo(() => {
    if (!selectedNodeId || !liveGraphNodes) return null;
    const node = liveGraphNodes.find((n: any) => String(n?.id) === String(selectedNodeId));
    if (!node) return null;
    const d = node.data || {};
    return {
      id: node.id,
      label: d.label || node.label || '',
      notes: d.notes || '',
      context: d.context || '',
      goal: d.goal || '',
      rationale: d.rationale || '',
      riskNote: d.riskNote || '',
      description: d.description || '',
      tags: Array.isArray(d.tags) ? d.tags : [],
      status: d.status || 'idea',
      semanticType: d.semanticType || '',
      owner: d.owner || '',
      priority: d.priority ?? null,
      artifactLinks: Array.isArray(d.artifactLinks) ? d.artifactLinks : [],
      evidenceLinks: Array.isArray(d.evidenceLinks) ? d.evidenceLinks : [],
      branchKey: d.branchKey || '',
    };
  }, [selectedNodeId, liveGraphNodes]);

  // ── MM-10: Map statistics ────────────────────────────────────────────────
  const mapStats = useMemo(() => {
    const nodes = liveGraphNodes || [];
    const edges = liveGraphEdges || [];
    const total = nodes.length;
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    for (const n of nodes) {
      const t = n?.data?.semanticType || n?.type || 'default';
      byType[t] = (byType[t] || 0) + 1;
      const s = n?.data?.status || 'idea';
      byStatus[s] = (byStatus[s] || 0) + 1;
    }
    return { total, edges: edges.length, byType, byStatus };
  }, [liveGraphNodes, liveGraphEdges]);

  // ── MM-10: Warnings ──────────────────────────────────────────────────────
  const warnings = useMemo(() => {
    const nodes = liveGraphNodes || [];
    const edges = liveGraphEdges || [];
    const result: Array<{
      type: 'orphan' | 'no_label' | 'broken_link';
      message: string;
      nodeId?: string;
    }> = [];

    const connectedIds = new Set<string>();
    for (const e of edges) {
      if (e?.source) connectedIds.add(String(e.source));
      if (e?.target) connectedIds.add(String(e.target));
    }

    for (const n of nodes) {
      const nid = String(n?.id || '');
      const label = String(n?.data?.label || n?.label || '').trim();
      if (!label) {
        result.push({
          type: 'no_label',
          message: t('myWorkIdeas.contextPanel.nodeWithoutLabel', { value: nid.slice(0, 12) }),
          nodeId: nid,
        });
      }
      if (nodes.length > 1 && !connectedIds.has(nid)) {
        result.push({
          type: 'orphan',
          message: t('myWorkIdeas.contextPanel.orphanNode', {
            value: label || nid.slice(0, 12),
          }),
          nodeId: nid,
        });
      }
    }

    const nodeIdSet = new Set(nodes.map((n: any) => String(n?.id || '')));
    for (const e of edges) {
      const src = String(e?.source || '');
      const tgt = String(e?.target || '');
      if (src && !nodeIdSet.has(src)) {
        result.push({
          type: 'broken_link',
          message: t('myWorkIdeas.contextPanel.brokenLinkSource', {
            value: src.slice(0, 12),
          }),
        });
      }
      if (tgt && !nodeIdSet.has(tgt)) {
        result.push({
          type: 'broken_link',
          message: t('myWorkIdeas.contextPanel.brokenLinkTarget', {
            value: tgt.slice(0, 12),
          }),
        });
      }
    }

    return result;
  }, [liveGraphNodes, liveGraphEdges, isPl]);

  const subtitle = useMemo(() => t('myWorkIdeas.contextPanel.contextStatistics'), [isPl, t]);

  const toggleSection = useCallback((key: SectionKey) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const fetchData = useCallback(
    async (signal?: { cancelled: boolean }) => {
      setLoading(true);
      setError(null);

      const hasLiveGraph = liveGraphNodes && liveGraphNodes.length > 0;

      try {
        const promises: Promise<any>[] = [
          Api.getLinkGraphBacklinks({ type: 'idea', id: ideaId, limit: 50 }),
          Api.getIdeaAISuggestions(ideaId, {
            context: {
              title,
              seedText: '',
              currentNodes: [],
              currentEdges: [],
              activeTool: 'mindmap',
            },
            mode: 'passive',
            language: i18n.language,
          }),
        ];
        if (!hasLiveGraph) {
          promises.push(Api.getMyIdeaMap(ideaId, { language: i18n.language }));
        }
        const results = await Promise.allSettled(promises);
        const [backlinksRes, suggestionsRes] = results;
        const mapRes = hasLiveGraph ? undefined : results[2];

        if (signal?.cancelled) return;

        if (backlinksRes.status === 'fulfilled') {
          setBacklinks(
            (Array.isArray(backlinksRes.value) ? backlinksRes.value : [])
              .map((x: any) => ({
                id: String(x?.id || ''),
                sourceType: String(x?.sourceType || ''),
                sourceId: String(x?.sourceId || ''),
                createdAt: x?.createdAt ? String(x.createdAt) : undefined,
              }))
              .filter((x) => x.sourceType && x.sourceId)
          );
        }

        if (suggestionsRes.status === 'fulfilled') {
          const result = suggestionsRes.value;
          const items: ContextItem[] = [];

          if (result?.companyContext?.initiatives) {
            for (const init of result.companyContext.initiatives) {
              items.push({
                id: `init-${init.id || items.length}`,
                type: 'initiative',
                title: init.title || init.name || '',
                detail: init.status || '',
                source: 'PMO',
              });
            }
          }

          if (result?.companyContext?.assessmentGaps) {
            for (const gap of result.companyContext.assessmentGaps) {
              items.push({
                id: `gap-${gap.id || items.length}`,
                type: 'gap',
                title: gap.dimension || gap.title || '',
                detail: gap.description || gap.gap || '',
                source: gap.framework || 'Assessment',
                value: gap.score,
              });
            }
          }

          if (result?.companyContext?.interviewInsights) {
            for (const ins of result.companyContext.interviewInsights) {
              items.push({
                id: `ins-${ins.id || items.length}`,
                type: 'insight',
                title: ins.insight || ins.title || '',
                detail: ins.context || '',
                source: ins.interviewee || 'Interview',
              });
            }
          }

          if (result?.companyContext?.kpiHighlights) {
            for (const kpi of result.companyContext.kpiHighlights) {
              items.push({
                id: `kpi-${kpi.id || items.length}`,
                type: 'kpi',
                title: kpi.name || '',
                detail: kpi.trend || '',
                source: 'Results',
                value: kpi.value,
              });
            }
          }

          if (result?.suggestions) {
            for (const sug of result.suggestions.slice(0, 5)) {
              if (sug.source) {
                items.push({
                  id: `sug-${sug.id || items.length}`,
                  type: 'idea',
                  title: sug.text,
                  detail: sug.detail,
                  source: sug.source,
                });
              }
            }
          }

          setContextItems(items);
        }

        if (mapRes && mapRes.status === 'fulfilled') {
          const map = (mapRes as PromiseFulfilledResult<any>).value?.map;
          const graphNodes = Array.isArray(map?.nodes) ? map.nodes : [];
          extractGraphData(graphNodes);
        }
      } catch (err: any) {
        if (signal?.cancelled) return;
        setError(err?.message || t('myWorkIdeas.contextPanel.failedLoadContext'));
      } finally {
        if (!signal?.cancelled) setLoading(false);
      }
    },
    [extractGraphData, i18n.language, ideaId, isPl, liveGraphNodes, title]
  );

  useEffect(() => {
    if (!open) return;
    const signal = { cancelled: false };
    fetchData(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [fetchData, open, refreshToken]);

  const grouped = useMemo(() => {
    const map: Record<string, ContextItem[]> = {
      initiatives: [],
      gaps: [],
      insights: [],
      kpis: [],
      similar: [],
    };
    for (const item of contextItems) {
      if (item.type === 'initiative') map.initiatives.push(item);
      else if (item.type === 'gap') map.gaps.push(item);
      else if (item.type === 'insight') map.insights.push(item);
      else if (item.type === 'kpi') map.kpis.push(item);
      else if (item.type === 'idea') map.similar.push(item);
    }
    return map;
  }, [contextItems]);

  const openItem = (type: string, id: string) => {
    window.dispatchEvent(
      new CustomEvent('mywork-open-item', { detail: { type, id, name: `${type} ${id}` } })
    );
  };

  const handleInsert = useCallback(
    (item: ContextItem) => {
      onInsertToCanvas?.({
        text: item.title,
        type: item.type,
        detail: item.detail,
      });
    },
    [onInsertToCanvas]
  );

  const handleDragStart = useCallback((e: React.DragEvent, item: ContextItem) => {
    e.dataTransfer.setData('application/idea-context-item', JSON.stringify(item));
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  // Legacy sliding-drawer path is gated by `open`. In embedded (consolidated
  // accordion panel) mode the parent only mounts this section when its
  // accordion item is open, so visibility is the parent's responsibility —
  // don't self-hide here (mirrors IdeaWorkspaceTools).
  if (!embedded && !open) return null;

  const SECTIONS: Array<{
    key: SectionKey;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    labelPl: string;
    labelEn: string;
    color: string;
    items: ContextItem[];
  }> = [
    {
      key: 'initiatives',
      icon: Target,
      labelPl: 'Inicjatywy',
      labelEn: 'Initiatives',
      color: 'text-amber-600 dark:text-amber-400',
      items: grouped.initiatives,
    },
    {
      key: 'gaps',
      icon: AlertTriangle,
      labelPl: 'Luki (Assessment)',
      labelEn: 'Gaps (Assessment)',
      color: 'text-danger-600 dark:text-danger-400',
      items: grouped.gaps,
    },
    {
      key: 'insights',
      icon: MessageSquare,
      labelPl: 'Insights (Wywiady)',
      labelEn: 'Insights (Interviews)',
      color: 'text-blue-600 dark:text-blue-400',
      items: grouped.insights,
    },
    {
      key: 'kpis',
      icon: BarChart3,
      labelPl: 'KPI / Metryki',
      labelEn: 'KPIs / Metrics',
      color: 'text-emerald-600 dark:text-emerald-400',
      items: grouped.kpis,
    },
    {
      key: 'similar',
      icon: Lightbulb,
      labelPl: 'Powiązane pomysły',
      labelEn: 'Related ideas',
      color: 'text-c-info',
      items: grouped.similar,
    },
  ];

  return (
    <ToolsPanelShell
      title={t('myWorkIdeas.contextPanel.context')}
      subtitle={subtitle}
      icon={
        <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center">
          <Search size={14} className="text-slate-600 dark:text-slate-300" />
        </div>
      }
      embedded={embedded}
      onClose={onClose}
    >
      <div className="px-3 py-3 border-b border-slate-200/30 dark:border-white/[0.04]">
        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
          {title || t('myWorkIdeas.contextPanel.idea')}
        </div>
        {onInsertToCanvas && (
          <div className="mt-1 text-[9px] text-slate-600 dark:text-slate-500">
            {t('myWorkIdeas.contextPanel.dragCanvasClick')}
          </div>
        )}
      </div>

      <div className="px-3 py-2 flex-1 overflow-auto space-y-3">
        {/* MM-10: Selected node detail — reactive to selection changes */}
        {selectedNodeData ? (
          <div className="rounded-xl border border-c-info/20 bg-c-info/5 p-2.5 space-y-2">
            <button
              type="button"
              onClick={() => toggleSection('selected_node')}
              className="flex items-center gap-1.5 w-full text-left"
            >
              <Target size={12} className="text-c-info" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-c-info flex-1">
                {t('myWorkIdeas.contextPanel.selectedNode')}
              </span>
              {expandedSections.has('selected_node') ? (
                <ChevronUp size={12} className="text-c-info" />
              ) : (
                <ChevronDown size={12} className="text-c-info" />
              )}
            </button>
            {expandedSections.has('selected_node') && (
              <div className="space-y-1.5">
                <div className="text-[12px] font-semibold text-slate-800 dark:text-slate-200">
                  {selectedNodeData.label || t('myWorkIdeas.contextPanel.noLabel')}
                </div>
                {selectedNodeData.semanticType && (
                  <span className="inline-block text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-navy-800 text-slate-500">
                    {selectedNodeData.semanticType}
                  </span>
                )}
                {selectedNodeData.status && (
                  <span className="inline-block ml-1 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-navy-800 text-slate-500">
                    {selectedNodeData.status}
                  </span>
                )}
                {selectedNodeData.owner && (
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    {t('myWorkIdeas.contextPanel.owner')}: {selectedNodeData.owner}
                  </div>
                )}
                {selectedNodeData.description && (
                  <div className="text-[10px] text-slate-600 dark:text-slate-300 bg-white/40 dark:bg-navy-950/30 rounded-lg p-2">
                    {selectedNodeData.description.slice(0, 200)}
                    {selectedNodeData.description.length > 200 ? '…' : ''}
                  </div>
                )}
                {selectedNodeData.notes && (
                  <div className="text-[10px] text-slate-600 dark:text-slate-300">
                    <span className="font-semibold text-slate-500">
                      {t('myWorkIdeas.contextPanel.notes')}
                    </span>
                    {selectedNodeData.notes.slice(0, 150)}
                    {selectedNodeData.notes.length > 150 ? '…' : ''}
                  </div>
                )}
                {selectedNodeData.context && (
                  <div className="text-[10px] text-slate-600 dark:text-slate-300">
                    <span className="font-semibold text-slate-500">
                      {t('myWorkIdeas.contextPanel.context2')}
                    </span>
                    {selectedNodeData.context.slice(0, 150)}
                    {selectedNodeData.context.length > 150 ? '…' : ''}
                  </div>
                )}
                {selectedNodeData.goal && (
                  <div className="text-[10px] text-slate-600 dark:text-slate-300">
                    <span className="font-semibold text-slate-500">
                      {t('myWorkIdeas.contextPanel.goal')}
                    </span>
                    {selectedNodeData.goal.slice(0, 150)}
                  </div>
                )}
                {selectedNodeData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedNodeData.tags.map((tag: string) => (
                      <span
                        key={tag}
                        className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
                {selectedNodeData.artifactLinks.length > 0 && (
                  <div className="text-[10px] text-slate-500">
                    <Paperclip size={9} className="inline mr-1" />
                    {selectedNodeData.artifactLinks.length}{' '}
                    {t('myWorkIdeas.contextPanel.artifacts')}
                  </div>
                )}
                {selectedNodeData.evidenceLinks.length > 0 && (
                  <div className="text-[10px] text-slate-500">
                    <Link2 size={9} className="inline mr-1" />
                    {selectedNodeData.evidenceLinks.length}{' '}
                    {t('myWorkIdeas.contextPanel.evidenceLinks')}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200/40 dark:border-navy-700/40 bg-slate-50/30 dark:bg-navy-900/20 p-2.5 text-center">
            <div className="text-[10px] text-slate-600 dark:text-slate-500">
              {t('myWorkIdeas.contextPanel.clickNodeSeeDetails')}
            </div>
          </div>
        )}

        {/* MM-10: Map statistics */}
        <div className="rounded-xl border border-slate-200/40 dark:border-navy-700/40 bg-slate-50/30 dark:bg-navy-900/10 p-2.5">
          <button
            type="button"
            onClick={() => toggleSection('map_stats')}
            className="flex items-center gap-1.5 w-full text-left"
          >
            <BarChart3 size={12} className="text-slate-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex-1">
              {t('myWorkIdeas.contextPanel.mapStatistics')}
            </span>
            {expandedSections.has('map_stats') ? (
              <ChevronUp size={12} className="text-slate-600" />
            ) : (
              <ChevronDown size={12} className="text-slate-600" />
            )}
          </button>
          {expandedSections.has('map_stats') && (
            <div className="mt-2 space-y-1.5">
              <div className="grid grid-cols-2 gap-1.5">
                <div className="rounded-lg bg-white/50 dark:bg-white/[0.03] p-2 border border-slate-200/30 dark:border-navy-700/30">
                  <div className="text-[16px] font-bold text-slate-800 dark:text-slate-200">
                    {mapStats.total}
                  </div>
                  <div className="text-[9px] text-slate-600">
                    {t('myWorkIdeas.contextPanel.nodes')}
                  </div>
                </div>
                <div className="rounded-lg bg-white/50 dark:bg-white/[0.03] p-2 border border-slate-200/30 dark:border-navy-700/30">
                  <div className="text-[16px] font-bold text-slate-800 dark:text-slate-200">
                    {mapStats.edges}
                  </div>
                  <div className="text-[9px] text-slate-600">
                    {t('myWorkIdeas.contextPanel.edges')}
                  </div>
                </div>
              </div>
              {Object.keys(mapStats.byStatus).length > 0 && (
                <div>
                  <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    {t('myWorkIdeas.contextPanel.byStatus')}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(mapStats.byStatus).map(([s, count]) => (
                      <span
                        key={s}
                        className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300"
                      >
                        {s}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {Object.keys(mapStats.byType).length > 1 && (
                <div>
                  <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    {t('myWorkIdeas.contextPanel.byType')}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(mapStats.byType)
                      .slice(0, 8)
                      .map(([t, count]) => (
                        <span
                          key={t}
                          className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300"
                        >
                          {t}: {count}
                        </span>
                      ))}
                  </div>
                </div>
              )}
              {stage && (
                <div className="text-[10px] text-slate-500">
                  {t('myWorkIdeas.contextPanel.stage')}:{' '}
                  <span className="font-semibold">{stage}</span>
                </div>
              )}
              {activeTool && (
                <div className="text-[10px] text-slate-500">
                  {t('myWorkIdeas.contextPanel.tool')}:{' '}
                  <span className="font-semibold">{activeTool}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* MM-10: Warnings */}
        {warnings.length > 0 && (
          <div className="rounded-xl border border-amber-200/40 dark:border-amber-800/30 bg-amber-50/30 dark:bg-amber-900/10 p-2.5">
            <button
              type="button"
              onClick={() => toggleSection('warnings')}
              className="flex items-center gap-1.5 w-full text-left"
            >
              <AlertTriangle size={12} className="text-amber-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex-1">
                {t('myWorkIdeas.contextPanel.warnings')} ({warnings.length})
              </span>
              {expandedSections.has('warnings') ? (
                <ChevronUp size={12} className="text-amber-400" />
              ) : (
                <ChevronDown size={12} className="text-amber-400" />
              )}
            </button>
            {expandedSections.has('warnings') && (
              <div className="mt-2 space-y-1">
                {warnings.slice(0, 10).map((w, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-1.5 text-[10px] text-amber-700 dark:text-amber-300 bg-white/40 dark:bg-white/[0.02] rounded-lg p-1.5"
                  >
                    <AlertTriangle size={10} className="text-amber-500 mt-0.5 shrink-0" />
                    <span>{w.message}</span>
                  </div>
                ))}
                {warnings.length > 10 && (
                  <div className="text-[9px] text-amber-500">
                    +{warnings.length - 10} {t('myWorkIdeas.contextPanel.more')}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* V4-IDEA-09: EmbeddedView for "Used in" parity with Notebook/Tools/Initiatives */}
        <EmbeddedView
          title={t('myWorkIdeas.contextPanel.usedBacklinks')}
          count={backlinks.length}
          loading={loading}
          readOnly
          viewModes={['list']}
        >
          {backlinks.length === 0 && !loading ? (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 px-1">
              {t('myWorkIdeas.contextPanel.noLinksYet')}
            </div>
          ) : (
            <div className="space-y-2">
              {backlinks.slice(0, 10).map((bl) => (
                <div
                  key={bl.id}
                  className="rounded-xl border border-slate-200/40 dark:border-white/[0.04] bg-white/40 dark:bg-white/[0.02] p-2.5 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium text-slate-800 dark:text-slate-200 truncate">
                      {getSourceDisplayLabel(bl.sourceType, isPl)}
                    </div>
                    {/* MYW-IDEAS-CORE-001: never print the raw source UUID to the
                        owner — show when the link was created instead. */}
                    {bl.createdAt && (
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {new Date(bl.createdAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => openItem(bl.sourceType, bl.sourceId)}
                    className="text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 transition-colors shrink-0"
                  >
                    <ExternalLink size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </EmbeddedView>

        {/* V5-IDEA-28: Notes section */}
        <div className="rounded-xl border border-amber-200/40 dark:border-amber-800/30 bg-amber-50/30 dark:bg-amber-900/10 p-2.5">
          <button
            type="button"
            onClick={() => toggleSection('notes')}
            className="flex items-center gap-1.5 w-full text-left"
          >
            <StickyNote size={12} className="text-amber-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex-1">
              {t('myWorkIdeas.contextPanel.notes2')} ({notes.length})
            </span>
            {expandedSections.has('notes') ? (
              <ChevronUp size={12} className="text-amber-400" />
            ) : (
              <ChevronDown size={12} className="text-amber-400" />
            )}
          </button>
          {expandedSections.has('notes') && (
            <div className="mt-2 space-y-1.5">
              {notes.map((n) => (
                <div
                  key={n.id}
                  className="text-[11px] text-slate-700 dark:text-slate-300 bg-white/50 dark:bg-white/[0.03] rounded-lg p-2 border border-amber-200/30 dark:border-amber-800/20"
                >
                  {n.text}
                  {n.createdAt && (
                    <div className="text-[8px] text-amber-400 mt-0.5">
                      {new Date(n.createdAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              ))}
              <div className="flex gap-1">
                <input
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder={t('myWorkIdeas.contextPanel.addNote')}
                  className="flex-1 text-[10px] px-2 py-1 rounded-lg border border-amber-200/40 dark:border-amber-800/30 bg-white/50 dark:bg-white/[0.02] text-slate-700 dark:text-slate-300 placeholder:text-slate-400/60 outline-none focus:ring-1 focus:ring-amber-400/40"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newNoteText.trim()) {
                      onInsertToCanvas?.({ text: newNoteText, type: 'note' });
                      setNotes((prev) => [
                        ...prev,
                        {
                          id: `note-${Date.now()}`,
                          text: newNoteText,
                          createdAt: new Date().toISOString(),
                        },
                      ]);
                      setNewNoteText('');
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newNoteText.trim()) {
                      onInsertToCanvas?.({ text: newNoteText, type: 'note' });
                      setNotes((prev) => [
                        ...prev,
                        {
                          id: `note-${Date.now()}`,
                          text: newNoteText,
                          createdAt: new Date().toISOString(),
                        },
                      ]);
                      setNewNoteText('');
                    }
                  }}
                  className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-medium hover:bg-amber-500/20 transition-colors"
                >
                  <Plus size={10} />
                </button>
              </div>
              {notes.length === 0 && (
                <div className="text-[10px] text-slate-600">
                  {t('myWorkIdeas.contextPanel.noNotesYet')}
                </div>
              )}
            </div>
          )}
        </div>

        {/* V5-IDEA-28: Evidence section */}
        <div className="rounded-xl border border-blue-200/40 dark:border-blue-800/30 bg-blue-50/30 dark:bg-blue-900/10 p-2.5">
          <button
            type="button"
            onClick={() => toggleSection('evidence')}
            className="flex items-center gap-1.5 w-full text-left"
          >
            <Shield size={12} className="text-blue-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex-1">
              {t('myWorkIdeas.contextPanel.evidence')} ({evidence.length})
            </span>
            {expandedSections.has('evidence') ? (
              <ChevronUp size={12} className="text-blue-400" />
            ) : (
              <ChevronDown size={12} className="text-blue-400" />
            )}
          </button>
          {expandedSections.has('evidence') && (
            <div className="mt-2 space-y-1.5">
              {evidence.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center gap-2 bg-white/50 dark:bg-white/[0.03] rounded-lg p-2 border border-blue-200/30 dark:border-blue-800/20"
                >
                  <ExternalLink size={10} className="text-blue-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate">
                      {ev.title}
                    </div>
                    {ev.url && <div className="text-[8px] text-blue-400 truncate">{ev.url}</div>}
                  </div>
                  <span className="text-[8px] font-bold uppercase text-blue-500/60 shrink-0">
                    {ev.type}
                  </span>
                </div>
              ))}
              {/* V5-IDEA-29: Capture/import flows for evidence */}
              <div className="flex flex-wrap gap-1 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    const url = window.prompt(t('myWorkIdeas.contextPanel.pasteUrl'));
                    if (url?.trim()) {
                      const ev: EvidenceItem = {
                        id: `ev-url-${Date.now()}`,
                        type: 'url',
                        title: url.trim(),
                        url: url.trim(),
                      };
                      setEvidence((prev) => [...prev, ev]);
                      onInsertToCanvas?.({ text: url.trim(), type: 'evidence', detail: 'url' });
                    }
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                >
                  <Link2 size={9} />
                  {t('myWorkIdeas.contextPanel.addUrl')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const text = window.prompt(t('myWorkIdeas.contextPanel.pasteEvidenceText'));
                    if (text?.trim()) {
                      const ev: EvidenceItem = {
                        id: `ev-note-${Date.now()}`,
                        type: 'note',
                        title: text.trim().slice(0, 120),
                      };
                      setEvidence((prev) => [...prev, ev]);
                      onInsertToCanvas?.({ text: text.trim(), type: 'evidence', detail: 'note' });
                    }
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                >
                  <FileText size={9} />
                  {t('myWorkIdeas.contextPanel.importText')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent('idea-workspace-quick-action', {
                        detail: { action: 'mm_add_evidence', ideaId },
                      })
                    );
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                >
                  <Plus size={9} />
                  {t('myWorkIdeas.contextPanel.toCanvas')}
                </button>
              </div>
              {evidence.length === 0 && (
                <div className="text-[10px] text-slate-600 mt-1">
                  {t('myWorkIdeas.contextPanel.addEvidenceViaUrlTextOr')}
                </div>
              )}
            </div>
          )}
        </div>

        {/* V5-IDEA-28: Linked Artifacts section */}
        <div className="rounded-xl border border-indigo-200/40 dark:border-indigo-800/30 bg-indigo-50/30 dark:bg-indigo-900/10 p-2.5">
          <button
            type="button"
            onClick={() => toggleSection('artifacts')}
            className="flex items-center gap-1.5 w-full text-left"
          >
            <Paperclip size={12} className="text-indigo-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex-1">
              {selectedNodeId
                ? t('myWorkIdeas.contextPanel.nodeArtifacts')
                : t('myWorkIdeas.contextPanel.linkedArtifacts')}{' '}
              ({displayedArtifacts.length})
            </span>
            {expandedSections.has('artifacts') ? (
              <ChevronUp size={12} className="text-indigo-400" />
            ) : (
              <ChevronDown size={12} className="text-indigo-400" />
            )}
          </button>
          {expandedSections.has('artifacts') && (
            <div className="mt-2 space-y-1.5">
              {displayedArtifacts.map((art) => (
                <div
                  key={art.id}
                  className="flex items-center gap-2 bg-white/50 dark:bg-white/[0.03] rounded-lg p-2 border border-indigo-200/30 dark:border-indigo-800/20 cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-colors"
                  onClick={() => openItem(art.type, art.artifactId || art.id)}
                >
                  <BookOpen size={10} className="text-indigo-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate">
                      {art.title}
                    </div>
                  </div>
                  <span className="text-[8px] font-bold uppercase text-indigo-500/60 shrink-0">
                    {art.type}
                  </span>
                </div>
              ))}
              {displayedArtifacts.length === 0 && (
                <div className="text-[10px] text-slate-600">
                  {t('myWorkIdeas.contextPanel.addKnowledgeCardsCanvasSeeThem')}
                </div>
              )}
            </div>
          )}
        </div>

        {/* V5-IDEA-30: Search and insert knowledge */}
        <div className="rounded-xl border border-c-info/20 bg-c-info/5 p-2.5">
          <div className="flex items-center gap-1.5 mb-2">
            <Search size={12} className="text-c-info" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-c-info">
              {t('myWorkIdeas.contextPanel.searchKnowledge')}
            </span>
          </div>
          <div className="flex gap-1">
            <input
              placeholder={t('myWorkIdeas.contextPanel.searchInterviewsToolsNotes')}
              className="flex-1 text-[10px] px-2 py-1.5 rounded-lg border border-c-info/20 bg-white/50 dark:bg-white/[0.02] text-slate-700 dark:text-slate-300 placeholder:text-slate-400/60 outline-none focus:ring-1 focus:ring-c-focus"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const query = (e.target as HTMLInputElement).value.trim();
                  if (query) {
                    window.dispatchEvent(
                      new CustomEvent('idea-workspace-chat-prompt', {
                        detail: {
                          prompt: t('myWorkIdeas.contextPanel.searchKnowledgeBasePrompt', {
                            value: query,
                          }),
                          ideaId,
                        },
                      })
                    );
                  }
                }
              }}
            />
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {[
              {
                action: 'search_interviews',
                labelPl: 'Wywiady',
                labelEn: 'Interviews',
                icon: MessageSquare,
              },
              { action: 'search_tools', labelPl: 'Narzędzia', labelEn: 'Tools', icon: FileText },
              {
                action: 'search_insights',
                labelPl: 'Insights',
                labelEn: 'Insights',
                icon: Lightbulb,
              },
            ].map((src) => (
              <button
                key={src.action}
                type="button"
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent('idea-workspace-chat-prompt', {
                      detail: {
                        prompt: t('myWorkIdeas.contextPanel.searchSourcePrompt', {
                          label: (isPl ? src.labelPl : src.labelEn).toLowerCase(),
                          value: title,
                        }),
                        ideaId,
                      },
                    })
                  );
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-medium text-c-info bg-c-info/10 hover:bg-c-info/20 transition-colors"
              >
                <src.icon size={9} />
                {isPl ? src.labelPl : src.labelEn}
              </button>
            ))}
          </div>
        </div>

        {loading ? null : error ? (
          <div className="rounded-xl border border-danger-200/60 dark:border-danger-800/40 bg-danger-50/60 dark:bg-danger-900/10 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="text-danger-500 mt-0.5 flex-shrink-0" />
              <div className="text-[11px] text-danger-700 dark:text-danger-300">{error}</div>
            </div>
            <button
              onClick={() => fetchData()}
              className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-danger-700 dark:text-danger-300 bg-danger-100/60 dark:bg-danger-900/20 hover:bg-danger-200/60 transition-colors"
            >
              <RefreshCw size={10} />
              {t('myWorkIdeas.contextPanel.retry')}
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {SECTIONS.map(({ key, icon: Icon, labelPl, labelEn, color, items }) => {
              if (items.length === 0) return null;
              const isExpanded = expandedSections.has(key);

              return (
                <div key={key}>
                  <button
                    onClick={() => toggleSection(key)}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <Icon size={14} className={color} />
                    <span className={`text-[11px] font-bold flex-1 text-left ${color}`}>
                      {isPl ? labelPl : labelEn}
                    </span>
                    <span className="text-[9px] text-slate-600 mr-1">{items.length}</span>
                    {isExpanded ? (
                      <ChevronUp size={12} className="text-slate-600" />
                    ) : (
                      <ChevronDown size={12} className="text-slate-600" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="ml-2 space-y-1 pb-1">
                      {(items as ContextItem[]).map((item) => (
                        <div
                          key={item.id}
                          draggable={!!onInsertToCanvas}
                          onDragStart={(e) => handleDragStart(e, item)}
                          className="rounded-xl border border-slate-200/40 dark:border-white/[0.04] bg-white/40 dark:bg-white/[0.02] p-2.5 cursor-grab active:cursor-grabbing"
                        >
                          <div className="flex items-start gap-2">
                            {onInsertToCanvas && (
                              <GripVertical
                                size={12}
                                className="text-slate-600 dark:text-slate-400 mt-0.5 shrink-0"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                                {item.title}
                              </div>
                              {item.detail && (
                                <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                                  {item.detail}
                                </div>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                {item.source && (
                                  <span className="text-[8px] text-slate-600 bg-slate-100 dark:bg-navy-800 px-1.5 py-0.5 rounded">
                                    {item.source}
                                  </span>
                                )}
                                {item.value != null && (
                                  <span className="text-[8px] text-slate-600">{item.value}</span>
                                )}
                              </div>
                            </div>
                            {onInsertToCanvas && (
                              <button
                                onClick={() => handleInsert(item)}
                                className="text-c-info hover:text-c-info/80 transition-colors shrink-0 mt-0.5"
                                title={t('myWorkIdeas.contextPanel.addCanvas')}
                              >
                                <Plus size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {contextItems.length === 0 && (
              <div className="text-center py-8 text-[11px] text-slate-600">
                {t('myWorkIdeas.contextPanel.noContextYetAddChallengeDescription')}
              </div>
            )}
          </div>
        )}
      </div>
    </ToolsPanelShell>
  );
};

export default IdeaContextPanel;
