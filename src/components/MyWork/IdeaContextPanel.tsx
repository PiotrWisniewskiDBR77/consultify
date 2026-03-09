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
  GitBranch,
  GripVertical,
  Lightbulb,
  Link2,
  Loader2,
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
  ideaId: string;
  title: string;
  selectedNodeId?: string | null;
  refreshToken?: number;
  onInsertToCanvas?: (item: { text: string; type: string; detail?: string }) => void;
}

type SectionKey =
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
  ideaId,
  title,
  selectedNodeId,
  refreshToken,
  onInsertToCanvas,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [loading, setLoading] = useState(false);
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [contextItems, setContextItems] = useState<ContextItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<SectionKey>>(
    new Set(['notes', 'evidence', 'artifacts', 'initiatives', 'gaps', 'insights'])
  );

  // V5-IDEA-28: Notes, evidence, artifacts
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [linkedArtifacts, setLinkedArtifacts] = useState<LinkedArtifact[]>([]);
  const [nodeArtifactMap, setNodeArtifactMap] = useState<(LinkedArtifact & { nodeId?: string })[]>([]);
  const [newNoteText, setNewNoteText] = useState('');

  const displayedArtifacts = useMemo(() => {
    if (!selectedNodeId) return linkedArtifacts;
    return nodeArtifactMap.filter((a) => a.nodeId === selectedNodeId);
  }, [linkedArtifacts, nodeArtifactMap, selectedNodeId]);

  const subtitle = useMemo(() => (isPl ? 'Kontekst firmy' : 'Company context'), [isPl]);

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

      try {
        const [backlinksRes, suggestionsRes, mapRes] = await Promise.allSettled([
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
          Api.getMyIdeaMap(ideaId, { language: i18n.language }),
        ]);

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

        // V5-IDEA-28: Extract notes, evidence, artifacts from workspace graph
        if (mapRes.status === 'fulfilled') {
          const map = (mapRes as PromiseFulfilledResult<any>).value?.map;
          const ext = map?.extensions || {};
          const nodes = Array.isArray(map?.nodes) ? map.nodes : [];

          const extractedNotes: NoteItem[] = nodes
            .filter((n: any) => n?.type === 'noteCard' || n?.data?.kind === 'note_card')
            .map((n: any) => ({
              id: n.id,
              text: n.data?.label || '',
              createdAt: n.data?.createdAt,
            }));
          setNotes(extractedNotes);

          const extractedEvidence: EvidenceItem[] = nodes
            .filter((n: any) => n?.type === 'evidenceCard' || n?.data?.kind === 'evidence_card')
            .map((n: any) => ({
              id: n.id,
              type: n.data?.evidenceType || 'note',
              title: n.data?.label || '',
              url: n.data?.url,
              artifactId: n.data?.artifactId,
            }));
          setEvidence(extractedEvidence);

          const extractedArtifacts: LinkedArtifact[] = nodes
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
          // V51-30: Also extract artifacts from node.data.artifactLinks (with fallback to node.artifactLinks)
          const nodeArtifactLinks: (LinkedArtifact & { nodeId?: string })[] = nodes.flatMap((n: any) => {
            const links = Array.isArray(n?.data?.artifactLinks)
              ? n.data.artifactLinks
              : Array.isArray(n?.artifactLinks) ? n.artifactLinks : null;
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
          const merged = [
            ...extractedArtifacts,
            ...nodeArtifactLinks.filter((a) => !seen.has(a.id)),
          ];
          setLinkedArtifacts(merged);
          setNodeArtifactMap(nodeArtifactLinks);
        }
      } catch (err: any) {
        if (signal?.cancelled) return;
        setError(
          err?.message || (isPl ? 'Nie udało się wczytać kontekstu' : 'Failed to load context')
        );
      } finally {
        if (!signal?.cancelled) setLoading(false);
      }
    },
    [i18n.language, ideaId, isPl, title]
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

  if (!open) return null;

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
      color: 'text-red-600 dark:text-red-400',
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
      color: 'text-violet-600 dark:text-violet-400',
      items: grouped.similar,
    },
  ];

  return (
    <ToolsPanelShell
      title={isPl ? 'Kontekst' : 'Context'}
      subtitle={subtitle}
      icon={
        <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center">
          <Search size={14} className="text-slate-600 dark:text-slate-300" />
        </div>
      }
      onClose={onClose}
    >
      <div className="px-3 py-3 border-b border-slate-200/30 dark:border-white/[0.04]">
        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
          {title || (isPl ? 'Wyzwanie' : 'Idea')}
        </div>
        {onInsertToCanvas && (
          <div className="mt-1 text-[9px] text-slate-400 dark:text-slate-500">
            {isPl ? 'Przeciągnij element na canvas lub kliknij +' : 'Drag to canvas or click +'}
          </div>
        )}
      </div>

      <div className="px-3 py-2 flex-1 overflow-auto space-y-3">
        {/* V4-IDEA-09: EmbeddedView for "Used in" parity with Notebook/Tools/Initiatives */}
        <EmbeddedView
          title={isPl ? 'Użyte w (backlinks)' : 'Used in (backlinks)'}
          count={backlinks.length}
          loading={loading}
          readOnly
          viewModes={['list']}
        >
          {backlinks.length === 0 && !loading ? (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 px-1">
              {isPl ? 'Brak powiązań' : 'No links yet'}
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
                      {bl.sourceType}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                      {bl.sourceId}
                    </div>
                  </div>
                  <button
                    onClick={() => openItem(bl.sourceType, bl.sourceId)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors shrink-0"
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
              {isPl ? 'Notatki' : 'Notes'} ({notes.length})
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
                  placeholder={isPl ? 'Dodaj notatkę...' : 'Add a note...'}
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
                <div className="text-[10px] text-slate-400">
                  {isPl ? 'Brak notatek' : 'No notes yet'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* V5-IDEA-28: Evidence section */}
        <div className="rounded-xl border border-cyan-200/40 dark:border-cyan-800/30 bg-cyan-50/30 dark:bg-cyan-900/10 p-2.5">
          <button
            type="button"
            onClick={() => toggleSection('evidence')}
            className="flex items-center gap-1.5 w-full text-left"
          >
            <Shield size={12} className="text-cyan-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 flex-1">
              {isPl ? 'Dowody' : 'Evidence'} ({evidence.length})
            </span>
            {expandedSections.has('evidence') ? (
              <ChevronUp size={12} className="text-cyan-400" />
            ) : (
              <ChevronDown size={12} className="text-cyan-400" />
            )}
          </button>
          {expandedSections.has('evidence') && (
            <div className="mt-2 space-y-1.5">
              {evidence.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center gap-2 bg-white/50 dark:bg-white/[0.03] rounded-lg p-2 border border-cyan-200/30 dark:border-cyan-800/20"
                >
                  <ExternalLink size={10} className="text-cyan-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate">
                      {ev.title}
                    </div>
                    {ev.url && <div className="text-[8px] text-cyan-400 truncate">{ev.url}</div>}
                  </div>
                  <span className="text-[8px] font-bold uppercase text-cyan-500/60 shrink-0">
                    {ev.type}
                  </span>
                </div>
              ))}
              {/* V5-IDEA-29: Capture/import flows for evidence */}
              <div className="flex flex-wrap gap-1 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    const url = window.prompt(isPl ? 'Wklej URL:' : 'Paste URL:');
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
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-medium text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors"
                >
                  <Link2 size={9} />
                  {isPl ? 'Dodaj URL' : 'Add URL'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const text = window.prompt(
                      isPl ? 'Wklej tekst dowodu:' : 'Paste evidence text:'
                    );
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
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-medium text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors"
                >
                  <FileText size={9} />
                  {isPl ? 'Importuj tekst' : 'Import text'}
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
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-medium text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors"
                >
                  <Plus size={9} />
                  {isPl ? 'Na canvas' : 'To canvas'}
                </button>
              </div>
              {evidence.length === 0 && (
                <div className="text-[10px] text-slate-400 mt-1">
                  {isPl
                    ? 'Dodaj dowody przez URL, tekst lub kartę na canvas'
                    : 'Add evidence via URL, text, or canvas card'}
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
                ? (isPl ? 'Artefakty węzła' : 'Node Artifacts')
                : (isPl ? 'Powiązane artefakty' : 'Linked Artifacts')}{' '}
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
                <div className="text-[10px] text-slate-400">
                  {isPl
                    ? 'Dodaj karty wiedzy na canvas, aby je tu zobaczyć'
                    : 'Add knowledge cards on canvas to see them here'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* V5-IDEA-30: Search and insert knowledge */}
        <div className="rounded-xl border border-violet-200/40 dark:border-violet-800/30 bg-violet-50/30 dark:bg-violet-900/10 p-2.5">
          <div className="flex items-center gap-1.5 mb-2">
            <Search size={12} className="text-violet-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
              {isPl ? 'Szukaj wiedzy' : 'Search Knowledge'}
            </span>
          </div>
          <div className="flex gap-1">
            <input
              placeholder={
                isPl
                  ? 'Szukaj w wywiadach, narzędziach, notatkach...'
                  : 'Search interviews, tools, notes...'
              }
              className="flex-1 text-[10px] px-2 py-1.5 rounded-lg border border-violet-200/40 dark:border-violet-800/30 bg-white/50 dark:bg-white/[0.02] text-slate-700 dark:text-slate-300 placeholder:text-slate-400/60 outline-none focus:ring-1 focus:ring-violet-400/40"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const query = (e.target as HTMLInputElement).value.trim();
                  if (query) {
                    window.dispatchEvent(
                      new CustomEvent('idea-workspace-chat-prompt', {
                        detail: {
                          prompt: isPl
                            ? `Znajdź w bazie wiedzy firmy informacje związane z: "${query}". Zwróć kluczowe fakty, insights i źródła.`
                            : `Search the company knowledge base for information related to: "${query}". Return key facts, insights, and sources.`,
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
                        prompt: isPl
                          ? `Przeszukaj ${src.labelPl.toLowerCase()} i znajdź informacje powiązane z: "${title}". Zwróć jako karty wiedzy.`
                          : `Search ${src.labelEn.toLowerCase()} and find information related to: "${title}". Return as knowledge cards.`,
                        ideaId,
                      },
                    })
                  );
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-medium text-violet-600 dark:text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 transition-colors"
              >
                <src.icon size={9} />
                {isPl ? src.labelPl : src.labelEn}
              </button>
            ))}
          </div>
        </div>

        {loading ? null : error ? (
          <div className="rounded-xl border border-red-200/60 dark:border-red-800/40 bg-red-50/60 dark:bg-red-900/10 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
              <div className="text-[11px] text-red-700 dark:text-red-300">{error}</div>
            </div>
            <button
              onClick={() => fetchData()}
              className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-red-700 dark:text-red-300 bg-red-100/60 dark:bg-red-900/20 hover:bg-red-200/60 transition-colors"
            >
              <RefreshCw size={10} />
              {isPl ? 'Spróbuj ponownie' : 'Retry'}
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
                    <span className="text-[9px] text-slate-400 mr-1">{items.length}</span>
                    {isExpanded ? (
                      <ChevronUp size={12} className="text-slate-400" />
                    ) : (
                      <ChevronDown size={12} className="text-slate-400" />
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
                                className="text-slate-300 dark:text-slate-600 mt-0.5 shrink-0"
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
                                  <span className="text-[8px] text-slate-400 bg-slate-100 dark:bg-navy-800 px-1.5 py-0.5 rounded">
                                    {item.source}
                                  </span>
                                )}
                                {item.value != null && (
                                  <span className="text-[8px] text-slate-400">{item.value}</span>
                                )}
                              </div>
                            </div>
                            {onInsertToCanvas && (
                              <button
                                onClick={() => handleInsert(item)}
                                className="text-violet-400 hover:text-violet-600 dark:hover:text-violet-300 transition-colors shrink-0 mt-0.5"
                                title={isPl ? 'Dodaj na canvas' : 'Add to canvas'}
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
              <div className="text-center py-8 text-[11px] text-slate-400">
                {isPl
                  ? 'Brak kontekstu. Dodaj opis wyzwania.'
                  : 'No context yet. Add a challenge description.'}
              </div>
            )}
          </div>
        )}
      </div>
    </ToolsPanelShell>
  );
};

export default IdeaContextPanel;
