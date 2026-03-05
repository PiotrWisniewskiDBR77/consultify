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
  Plus,
  RefreshCw,
  Search,
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
  onInsertToCanvas?: (item: { text: string; type: string; detail?: string }) => void;
}

type SectionKey = 'initiatives' | 'gaps' | 'insights' | 'kpis' | 'similar';

export const IdeaContextPanel: React.FC<IdeaContextPanelProps> = ({
  open,
  onClose,
  ideaId,
  title,
  onInsertToCanvas,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [loading, setLoading] = useState(false);
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [contextItems, setContextItems] = useState<ContextItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<SectionKey>>(
    new Set(['initiatives', 'gaps', 'insights'])
  );

  const subtitle = useMemo(() => (isPl ? 'Kontekst firmy' : 'Company context'), [isPl]);

  const toggleSection = useCallback((key: SectionKey) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const fetchData = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoading(true);
    setError(null);

    try {
      const [backlinksRes, suggestionsRes] = await Promise.allSettled([
        Api.getLinkGraphBacklinks({ type: 'idea', id: ideaId, limit: 50 }),
        Api.getIdeaAISuggestions(ideaId, {
          context: { title, seedText: '', currentNodes: [], currentEdges: [], activeTool: 'mindmap' },
          mode: 'passive',
          language: i18n.language,
        }),
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
    } catch (err: any) {
      if (signal?.cancelled) return;
      setError(err?.message || (isPl ? 'Nie udało się wczytać kontekstu' : 'Failed to load context'));
    } finally {
      if (!signal?.cancelled) setLoading(false);
    }
  }, [i18n.language, ideaId, isPl, title]);

  useEffect(() => {
    if (!open) return;
    const signal = { cancelled: false };
    fetchData(signal);
    return () => { signal.cancelled = true; };
  }, [fetchData, open]);

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
    window.dispatchEvent(new CustomEvent('mywork-open-item', { detail: { type, id, name: `${type} ${id}` } }));
  };

  const handleInsert = useCallback((item: ContextItem) => {
    onInsertToCanvas?.({
      text: item.title,
      type: item.type,
      detail: item.detail,
    });
  }, [onInsertToCanvas]);

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
    { key: 'initiatives', icon: Target, labelPl: 'Inicjatywy', labelEn: 'Initiatives', color: 'text-amber-600 dark:text-amber-400', items: grouped.initiatives },
    { key: 'gaps', icon: AlertTriangle, labelPl: 'Luki (Assessment)', labelEn: 'Gaps (Assessment)', color: 'text-red-600 dark:text-red-400', items: grouped.gaps },
    { key: 'insights', icon: MessageSquare, labelPl: 'Insights (Wywiady)', labelEn: 'Insights (Interviews)', color: 'text-blue-600 dark:text-blue-400', items: grouped.insights },
    { key: 'kpis', icon: BarChart3, labelPl: 'KPI / Metryki', labelEn: 'KPIs / Metrics', color: 'text-emerald-600 dark:text-emerald-400', items: grouped.kpis },
    { key: 'similar', icon: Lightbulb, labelPl: 'Powiązane pomysły', labelEn: 'Related ideas', color: 'text-violet-600 dark:text-violet-400', items: grouped.similar },
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
                    {isExpanded ? <ChevronUp size={12} className="text-slate-400" /> : <ChevronDown size={12} className="text-slate-400" />}
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
                                  <GripVertical size={12} className="text-slate-300 dark:text-slate-600 mt-0.5 shrink-0" />
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
                                      <span className="text-[8px] text-slate-400">
                                        {item.value}
                                      </span>
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
                {isPl ? 'Brak kontekstu. Dodaj opis wyzwania.' : 'No context yet. Add a challenge description.'}
              </div>
            )}
          </div>
        )}
      </div>
    </ToolsPanelShell>
  );
};

export default IdeaContextPanel;
