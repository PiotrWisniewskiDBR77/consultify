import type { Editor } from '@tiptap/react';
import {
  ArrowRight,
  CheckSquare,
  ExternalLink,
  FileText,
  Lightbulb,
  Link2,
  Loader2,
  Minus,
  MoreHorizontal,
  Scale,
  Target,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { EmbeddedView } from '@/components/shared/NModeBlocks';
import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import type { NotebookPage } from '@/types/myWork';

import { type PulseItem, PulseItemPickerModal } from './PulseItemPickerModal';

type SectionKey = 'idea' | 'initiative' | 'task' | 'decision' | 'note';

type SuggestedIdea = {
  id: string;
  title: string;
  body?: string | null;
  tags?: string[];
};

type PulseType = PulseItem['type'];

const SECTION_CFG: Record<
  SectionKey,
  {
    label: string;
    labelPl: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    color: string;
    bg: string;
  }
> = {
  idea: {
    label: 'Ideas',
    labelPl: 'Pomysły',
    icon: Lightbulb,
    color: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-500/10',
  },
  initiative: {
    label: 'Initiatives',
    labelPl: 'Inicjatywy',
    icon: Target,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-500/10',
  },
  task: {
    label: 'Tasks',
    labelPl: 'Zadania',
    icon: CheckSquare,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
  },
  decision: {
    label: 'Decisions',
    labelPl: 'Decyzje',
    icon: Scale,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10',
  },
  note: {
    label: 'Notes',
    labelPl: 'Notatki',
    icon: FileText,
    color: 'text-slate-700 dark:text-slate-300',
    bg: 'bg-slate-500/10',
  },
};

function buildSearchTerms(noteTitle: string, noteTags: string[]): string {
  return [noteTitle, ...noteTags].filter(Boolean).join(' ').trim();
}

function scoreNoteCandidate(candidate: NotebookPage, terms: string[]): number {
  const title = String(candidate.title || '').toLowerCase();
  const tags = (candidate.tags || []).map((t) => String(t).toLowerCase());
  const summary = String(candidate.summary || '').toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (!term) continue;
    if (title.includes(term)) score += 4;
    if (tags.some((t) => t.includes(term))) score += 3;
    if (summary.includes(term)) score += 1;
  }
  return score;
}

interface NotebookContextPanelProps {
  open: boolean;
  onClose: () => void;
  editor: Editor | null;
  noteId: string;
  noteTitle: string;
  noteTags: string[];
  allNotes: NotebookPage[];
}

export const NotebookContextPanel: React.FC<NotebookContextPanelProps> = ({
  open,
  onClose,
  editor,
  noteId,
  noteTitle,
  noteTags,
  allNotes,
}) => {
  const { i18n } = useTranslation();
  const pl = i18n.language === 'pl';

  const [loading, setLoading] = useState(false);
  const [backlinksLoading, setBacklinksLoading] = useState(false);
  const [ideas, setIdeas] = useState<SuggestedIdea[]>([]);
  const [initiatives, setInitiatives] = useState<PulseItem[]>([]);
  const [tasks, setTasks] = useState<PulseItem[]>([]);
  const [decisions, setDecisions] = useState<PulseItem[]>([]);
  const [usedIn, setUsedIn] = useState<
    Array<{
      id: string;
      sourceType: string;
      sourceId: string;
      createdAt?: string;
    }>
  >([]);

  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
    idea: false,
    initiative: false,
    task: false,
    decision: false,
    note: false,
  });

  const [pickerType, setPickerType] = useState<PulseType | null>(null);

  const searchTerms = useMemo(() => buildSearchTerms(noteTitle, noteTags), [noteTitle, noteTags]);
  const searchTermTokens = useMemo(
    () =>
      searchTerms
        .toLowerCase()
        .split(/\s+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 8),
    [searchTerms]
  );

  const noteSuggestions = useMemo(() => {
    const candidates = (allNotes || []).filter((n) => n.id !== noteId);
    const scored = candidates
      .map((n) => ({ n, score: scoreNoteCandidate(n, searchTermTokens) }))
      .filter((x) => x.score > 0);
    scored.sort((a, b) => b.score - a.score);
    return scored.map((x) => x.n);
  }, [allNotes, noteId, searchTermTokens]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setBacklinksLoading(true);
      try {
        const q = searchTerms.slice(0, 300);

        const [ideasRes, initiativesRes, tasksRes, decisionsRes, backlinksRes] = await Promise.allSettled([
          q ? Api.suggestMyIdeas(q, 12) : Api.getMyIdeas({ limit: 12 }),
          Api.get(`/initiatives?q=${encodeURIComponent(q.slice(0, 100))}&limit=12`),
          Api.get(`/my-work/tasks?q=${encodeURIComponent(q.slice(0, 100))}&limit=12`),
          Api.get(`/decisions?q=${encodeURIComponent(q.slice(0, 100))}&limit=12`),
          Api.getLinkGraphBacklinks({ type: 'notebook', id: noteId, limit: 50 }),
        ]);

        if (!cancelled) {
          const ideasList = ideasRes.status === 'fulfilled' ? ideasRes.value : [];
          setIdeas(Array.isArray(ideasList) ? (ideasList as any[]).slice(0, 12) : []);

          const initRaw =
            initiativesRes.status === 'fulfilled'
              ? (Array.isArray(initiativesRes.value)
                  ? initiativesRes.value
                  : (initiativesRes.value as any)?.initiatives) || []
              : [];
          setInitiatives(
            (initRaw || []).slice(0, 12).map((i: any) => ({
              id: i.id,
              type: 'initiative',
              title: i.title || i.name || '',
              status: i.status,
            }))
          );

          const tasksRaw =
            tasksRes.status === 'fulfilled'
              ? (Array.isArray(tasksRes.value) ? tasksRes.value : (tasksRes.value as any)?.tasks) ||
                []
              : [];
          setTasks(
            (tasksRaw || []).slice(0, 12).map((t: any) => ({
              id: t.id,
              type: 'task',
              title: t.title || t.name || '',
              status: t.status,
            }))
          );

          const decisionsRaw =
            decisionsRes.status === 'fulfilled'
              ? (Array.isArray(decisionsRes.value)
                  ? decisionsRes.value
                  : (decisionsRes.value as any)?.decisions) || []
              : [];
          setDecisions(
            (decisionsRaw || []).slice(0, 12).map((d: any) => ({
              id: d.id,
              type: 'decision',
              title: d.title || d.name || '',
              status: d.status,
            }))
          );

          const backlinks =
            backlinksRes.status === 'fulfilled' && Array.isArray(backlinksRes.value)
              ? (backlinksRes.value as any[])
              : [];
          setUsedIn(
            backlinks
              .map((x: any) => ({
                id: String(x?.id || ''),
                sourceType: String(x?.sourceType || ''),
                sourceId: String(x?.sourceId || ''),
                createdAt: x?.createdAt ? String(x.createdAt) : undefined,
              }))
              .filter((x: any) => x.sourceType && x.sourceId)
              .slice(0, 50)
          );

          trackFunnelEvent('notebook_context_panel_opened', {
            noteId,
            q: q.slice(0, 100),
            ideas: Array.isArray(ideasList) ? ideasList.length : 0,
          });
        }
      } catch {
        if (!cancelled) {
          setIdeas([]);
          setInitiatives([]);
          setTasks([]);
          setDecisions([]);
          setUsedIn([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setBacklinksLoading(false);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [open, noteId, searchTerms]);

  if (!open) return null;

  const take = (key: SectionKey, arr: any[]) =>
    expanded[key] ? arr.slice(0, 12) : arr.slice(0, 4);

  const insertCallout = (title: string, body?: string) => {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'callout',
        attrs: { variant: 'info' },
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: title }] },
          ...(body ? [{ type: 'paragraph', content: [{ type: 'text', text: body }] }] : []),
        ],
      })
      .run();
  };

  const handleInsertIdea = (idea: SuggestedIdea) => {
    insertCallout(`💡 ${idea.title}`, idea.body || undefined);
    Api.createLinkGraphEdge({
      source: { type: 'notebook', id: noteId },
      target: { type: 'idea', id: idea.id },
      relation: 'ref',
      context: { containerType: 'notebook_embed', containerId: noteId },
    }).catch(() => undefined);
    trackFunnelEvent('my_idea_used', { source: 'notebook_context_panel', ideaId: idea.id });
    toast.success(pl ? 'Wstawiono pomysł' : 'Idea inserted');
  };

  const handleInsertPulseRef = (item: PulseItem) => {
    const typeLabel = item.type === 'initiative' ? '🎯' : item.type === 'task' ? '✅' : '⚖️';
    insertCallout(`${typeLabel} ${item.title} [${item.type}]`);
    Api.createLinkGraphEdge({
      source: { type: 'notebook', id: noteId },
      target: { type: item.type, id: item.id },
      relation: 'ref',
      context: { containerType: 'notebook_embed', containerId: noteId },
    }).catch(() => undefined);
    toast.success(pl ? 'Wstawiono odniesienie' : 'Reference inserted');
  };

  const handleInsertNoteRef = (n: NotebookPage) => {
    insertCallout(`📄 ${n.title || (pl ? 'Bez tytułu' : 'Untitled')}`, n.summary || undefined);
    Api.createLinkGraphEdge({
      source: { type: 'notebook', id: noteId },
      target: { type: 'notebook', id: n.id },
      relation: 'ref',
      context: { containerType: 'notebook_embed', containerId: noteId },
    }).catch(() => undefined);
    toast.success(pl ? 'Wstawiono odniesienie do notatki' : 'Note reference inserted');
  };

  const openItem = (
    type: 'idea' | 'initiative' | 'task' | 'decision' | 'notebook' | 'report' | 'presentation',
    id: string,
    name: string
  ) => {
    window.dispatchEvent(
      new CustomEvent('mywork-open-item', {
        detail: { type, id, name },
      })
    );
  };

  const Section: React.FC<{
    k: SectionKey;
    count: number;
    children: React.ReactNode;
    onMore?: () => void;
  }> = ({ k, count, children, onMore }) => {
    const cfg = SECTION_CFG[k];
    const Icon = cfg.icon;
    return (
      <div className="px-3 py-3 border-b border-slate-200 dark:border-navy-800">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className={`flex items-center gap-2 text-xs font-semibold ${cfg.color}`}>
            <Icon size={14} />
            <span>{pl ? cfg.labelPl : cfg.label}</span>
            <span className={`${cfg.bg} px-1.5 py-0.5 rounded-full text-[10px]`}>{count}</span>
          </div>
          <div className="flex items-center gap-1">
            {count > 4 && (
              <button
                onClick={() => setExpanded((p) => ({ ...p, [k]: !p[k] }))}
                className="text-[10px] font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
                title={pl ? 'Więcej/mniej' : 'More/Less'}
              >
                {expanded[k] ? (pl ? 'Mniej' : 'Less') : pl ? 'Więcej' : 'More'}
              </button>
            )}
            {onMore && (
              <button
                onClick={onMore}
                className="text-[10px] font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
                title={pl ? 'Przeglądaj wszystkie' : 'Browse all'}
              >
                {pl ? 'Wszystkie' : 'All'}
              </button>
            )}
          </div>
        </div>
        <div className="space-y-2">{children}</div>
      </div>
    );
  };

  const Row: React.FC<{
    title: string;
    subtitle?: string | null;
    badge?: string | null;
    onInsert: () => void;
    onOpen?: () => void;
  }> = ({ title, subtitle, badge, onInsert, onOpen }) => (
    <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50/80 dark:bg-navy-900/60 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
            {title}
          </div>
          {subtitle ? (
            <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
              {subtitle}
            </div>
          ) : null}
          {badge ? (
            <div className="mt-1 text-[10px] text-slate-400 dark:text-slate-500 capitalize">
              {badge}
            </div>
          ) : null}
        </div>
        <button
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
          title={pl ? 'Akcje' : 'Actions'}
          onClick={onInsert}
        >
          <MoreHorizontal size={14} />
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={onInsert}
          className="flex-1 flex items-center justify-center gap-1 rounded-md bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.06] text-slate-700 dark:text-slate-300 px-2 py-1 text-[11px] font-medium hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
        >
          <ArrowRight size={12} />
          {pl ? 'Wstaw' : 'Insert'}
        </button>
        {onOpen ? (
          <button
            onClick={onOpen}
            className="flex items-center justify-center gap-1 rounded-md bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400 px-2 py-1 text-[11px] font-medium hover:bg-slate-200 dark:hover:bg-white/[0.1] transition-colors"
          >
            <ExternalLink size={12} />
            {pl ? 'Otwórz' : 'Open'}
          </button>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="w-80 shrink-0 rounded-2xl border border-slate-200/70 dark:border-white/[0.06] overflow-hidden bg-white dark:bg-navy-950 flex flex-col">
      <div className="flex items-center justify-between px-3 py-3 border-b border-slate-200/60 dark:border-white/[0.06]">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
          <Lightbulb size={16} />
          <span>{pl ? 'Kontekst notatki' : 'Note context'}</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
          title={pl ? 'Zamknij' : 'Close'}
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto nb-scroll">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={18} className="animate-spin text-slate-400" />
          </div>
        ) : (
          <>
            <div className="px-3 py-3 border-b border-slate-200 dark:border-navy-800">
              <EmbeddedView
                title={pl ? 'Użyte w (backlinks)' : 'Used in (backlinks)'}
                count={usedIn.length}
                loading={backlinksLoading}
                readOnly
                viewModes={['list']}
              >
                {usedIn.length === 0 && !backlinksLoading ? (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 px-1">
                    {pl ? 'Brak powiązań' : 'No links yet'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {usedIn.slice(0, 8).map((x) => (
                      <div
                        key={x.id || `${x.sourceType}:${x.sourceId}`}
                        className="rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50/80 dark:bg-navy-900/60 px-3 py-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                              {x.sourceType}
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {x.sourceId}
                            </div>
                          </div>
                          {['task', 'decision', 'idea', 'initiative', 'notebook', 'report', 'presentation'].includes(
                            String(x.sourceType)
                          ) ? (
                            <button
                              onClick={() =>
                                openItem(
                                  x.sourceType as any,
                                  x.sourceId,
                                  `${x.sourceType} ${x.sourceId}`.slice(0, 120)
                                )
                              }
                              className="flex items-center justify-center gap-1 rounded-md bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400 px-2 py-1 text-[11px] font-medium hover:bg-slate-200 dark:hover:bg-white/[0.1] transition-colors"
                            >
                              <ExternalLink size={12} />
                              {pl ? 'Otwórz' : 'Open'}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </EmbeddedView>
            </div>

            <Section k="idea" count={ideas.length}>
              {take('idea', ideas).length === 0 ? (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 px-1">
                  {pl ? 'Brak sugestii' : 'No suggestions'}
                </div>
              ) : (
                take('idea', ideas).map((idea) => (
                  <Row
                    key={idea.id}
                    title={idea.title}
                    subtitle={idea.body || null}
                    onInsert={() => handleInsertIdea(idea)}
                    onOpen={() => openItem('idea', idea.id, idea.title)}
                  />
                ))
              )}
            </Section>

            <Section
              k="initiative"
              count={initiatives.length}
              onMore={() => setPickerType('initiative')}
            >
              {take('initiative', initiatives).length === 0 ? (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 px-1">
                  {pl ? 'Brak sugestii' : 'No suggestions'}
                </div>
              ) : (
                take('initiative', initiatives).map((item) => (
                  <Row
                    key={item.id}
                    title={item.title}
                    badge={item.status || null}
                    onInsert={() => handleInsertPulseRef(item)}
                    onOpen={() => openItem('initiative', item.id, item.title)}
                  />
                ))
              )}
            </Section>

            <Section k="task" count={tasks.length} onMore={() => setPickerType('task')}>
              {take('task', tasks).length === 0 ? (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 px-1">
                  {pl ? 'Brak sugestii' : 'No suggestions'}
                </div>
              ) : (
                take('task', tasks).map((item) => (
                  <Row
                    key={item.id}
                    title={item.title}
                    badge={item.status || null}
                    onInsert={() => handleInsertPulseRef(item)}
                    onOpen={() => openItem('task', item.id, item.title)}
                  />
                ))
              )}
            </Section>

            <Section k="decision" count={decisions.length} onMore={() => setPickerType('decision')}>
              {take('decision', decisions).length === 0 ? (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 px-1">
                  {pl ? 'Brak sugestii' : 'No suggestions'}
                </div>
              ) : (
                take('decision', decisions).map((item) => (
                  <Row
                    key={item.id}
                    title={item.title}
                    badge={item.status || null}
                    onInsert={() => handleInsertPulseRef(item)}
                    onOpen={() => openItem('decision', item.id, item.title)}
                  />
                ))
              )}
            </Section>

            <Section k="note" count={noteSuggestions.length}>
              {take('note', noteSuggestions).length === 0 ? (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 px-1">
                  {pl ? 'Brak sugestii' : 'No suggestions'}
                </div>
              ) : (
                take('note', noteSuggestions).map((n) => (
                  <Row
                    key={n.id}
                    title={n.title || (pl ? 'Bez tytułu' : 'Untitled')}
                    subtitle={n.summary || null}
                    onInsert={() => handleInsertNoteRef(n)}
                    onOpen={() => openItem('notebook', n.id, n.title || 'Note')}
                  />
                ))
              )}
            </Section>
          </>
        )}
      </div>

      <PulseItemPickerModal
        open={pickerType !== null}
        onClose={() => setPickerType(null)}
        type={pickerType ?? 'initiative'}
        onInsertReference={handleInsertPulseRef}
        onOpenItem={(item) => openItem(item.type, item.id, item.title)}
      />
    </div>
  );
};
