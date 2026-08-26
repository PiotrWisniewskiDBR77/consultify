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

import type { UnifiedOutputRow } from '@/components/ReportsAndPresentations/types';
import {
  type AssessmentOriginOutputRow,
  useArtifactOutputsForInitiatives,
  useArtifactOutputsForOrigins,
  useAssessmentOutputsForOrigins,
} from '@/components/ReportsAndPresentations/useRapData';
import { EmbeddedView } from '@/components/shared/NModeBlocks';
import { EntityStatusChip } from '@/components/ui/primitives/chips/EntityStatusChip';
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
    color: 'text-c-warning',
    bg: 'bg-c-warning/10',
  },
  initiative: {
    label: 'Initiatives',
    labelPl: 'Inicjatywy',
    icon: Target,
    color: 'text-c-info',
    bg: 'bg-c-info/10',
  },
  task: {
    label: 'Tasks',
    labelPl: 'Zadania',
    icon: CheckSquare,
    color: 'text-c-success',
    bg: 'bg-c-success/10',
  },
  decision: {
    label: 'Decisions',
    labelPl: 'Decyzje',
    icon: Scale,
    color: 'text-c-warning',
    bg: 'bg-c-warning/10',
  },
  note: {
    label: 'Notes',
    labelPl: 'Notatki',
    icon: FileText,
    color: 'text-c-text-secondary',
    bg: 'bg-c-surface-raised',
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
  noteConvertedTo?: Array<{ type?: string | null; id?: string | null }>;
  /**
   * DEC-69 (SPEC-A accordion rail): when true, drop the panel's own card
   * chrome (border/rounded/fixed width) and header/close row — the host
   * (an accordion section, e.g. NotebookRightRail's "Powiązania") already
   * supplies both. Content below stays identical. Defaults to false so any
   * other future standalone usage keeps today's self-contained look.
   */
  embedded?: boolean;
}

export const NotebookContextPanel: React.FC<NotebookContextPanelProps> = ({
  open,
  embedded = false,
  onClose,
  editor,
  noteId,
  noteTitle,
  noteTags,
  allNotes,
  noteConvertedTo = [],
}) => {
  type LinkedOutputRow = UnifiedOutputRow | AssessmentOriginOutputRow;
  const { t } = useTranslation();

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
  const [backlinkChips, setBacklinkChips] = useState<
    Record<
      string,
      {
        title: string;
        snippet?: string;
        status?: string;
      }
    >
  >({});

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

  const initiativeBacklinkIds = useMemo(
    () =>
      Array.from(
        new Set(
          usedIn
            .filter(
              (item) =>
                String(item.sourceType || '')
                  .trim()
                  .toLowerCase() === 'initiative'
            )
            .map((item) => String(item.sourceId || '').trim())
            .filter(Boolean)
        )
      ),
    [usedIn]
  );
  const {
    rows: linkedOutputRows,
    loading: linkedOutputsLoading,
    error: linkedOutputsError,
  } = useArtifactOutputsForInitiatives(initiativeBacklinkIds, 8);
  const {
    rows: directOutputRows,
    loading: directOutputsLoading,
    error: directOutputsError,
  } = useArtifactOutputsForOrigins(noteConvertedTo, 8);
  const {
    rows: directAssessmentRows,
    loading: directAssessmentsLoading,
    error: directAssessmentsError,
  } = useAssessmentOutputsForOrigins(noteConvertedTo, 8);
  const allLinkedOutputRows = useMemo<LinkedOutputRow[]>(() => {
    const seen = new Set<string>();
    return [...directAssessmentRows, ...directOutputRows, ...linkedOutputRows].filter((row) => {
      const key = row.artifactId || `${row.kind}:${row.originRecordId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [directAssessmentRows, directOutputRows, linkedOutputRows]);
  const linkedOutputsErrorMessage =
    directAssessmentsError || directOutputsError || linkedOutputsError;
  const linkedOutputsBusy =
    directAssessmentsLoading || directOutputsLoading || linkedOutputsLoading;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setBacklinksLoading(true);
      try {
        const q = searchTerms.slice(0, 300);

        const [ideasRes, initiativesRes, tasksRes, decisionsRes, backlinksRes, backlinksPageRes] =
          await Promise.allSettled([
            q ? Api.suggestMyIdeas(q, 12) : Api.getMyIdeas({ limit: 12 }),
            Api.get(`/initiatives?q=${encodeURIComponent(q.slice(0, 100))}&limit=12`),
            Api.get(`/my-work/tasks?q=${encodeURIComponent(q.slice(0, 100))}&limit=12`),
            Api.get(`/decisions?q=${encodeURIComponent(q.slice(0, 100))}&limit=12`),
            Api.getLinkGraphBacklinks({ type: 'notebook', id: noteId, limit: 50 }),
            Api.getLinkGraphBacklinks({ type: 'notebook_page', id: noteId, limit: 50 }),
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

          const backlinksA =
            backlinksRes.status === 'fulfilled' && Array.isArray(backlinksRes.value)
              ? (backlinksRes.value as any[])
              : [];
          const backlinksB =
            backlinksPageRes.status === 'fulfilled' && Array.isArray(backlinksPageRes.value)
              ? (backlinksPageRes.value as any[])
              : [];
          const backlinks = [...backlinksA, ...backlinksB];
          const backlinkRows = backlinks
            .map((x: any) => ({
              id: String(x?.id || ''),
              sourceType: String(x?.sourceType || ''),
              sourceId: String(x?.sourceId || ''),
              createdAt: x?.createdAt ? String(x.createdAt) : undefined,
            }))
            .filter((x: any) => x.sourceType && x.sourceId)
            .slice(0, 50);
          setUsedIn(backlinkRows);

          if (backlinkRows.length > 0) {
            try {
              const chipRes = await Api.notebookResolveEmbedChips(
                backlinkRows.slice(0, 20).map((row) => ({ type: row.sourceType, id: row.sourceId }))
              );
              if (!cancelled) {
                const nextChips = Object.fromEntries(
                  ((chipRes as any)?.chips || []).map((chip: any) => [
                    `${chip.artifactType}:${chip.artifactId}`,
                    {
                      title: String(chip.title || `${chip.artifactType} ${chip.artifactId}`),
                      snippet: chip.snippet ? String(chip.snippet) : undefined,
                      status: chip.status ? String(chip.status) : undefined,
                    },
                  ])
                );
                setBacklinkChips(nextChips);
              }
            } catch {
              if (!cancelled) setBacklinkChips({});
            }
          } else {
            setBacklinkChips({});
          }

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
          setBacklinkChips({});
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

  const insertEmbeddedRef = (payload: {
    artifactType: string;
    artifactId: string;
    title: string;
    label: string;
    status?: string;
    snippet?: string;
    updatedAt?: string;
  }) => {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'embeddedRef',
        attrs: {
          artifactType: payload.artifactType,
          artifactId: payload.artifactId,
          title: payload.title,
          label: payload.label,
          status: payload.status || '',
          snippet: payload.snippet || '',
          updatedAt: payload.updatedAt || '',
        },
      })
      .insertContent({ type: 'text', text: ' ' })
      .run();
  };

  const handleInsertIdea = (idea: SuggestedIdea) => {
    insertEmbeddedRef({
      artifactType: 'idea',
      artifactId: idea.id,
      title: idea.title,
      label: `💡 ${idea.title}`,
      snippet: idea.body || undefined,
    });
    Api.createLinkGraphEdge({
      source: { type: 'notebook', id: noteId },
      target: { type: 'idea', id: idea.id },
      relation: 'ref',
      context: { containerType: 'notebook_embed', containerId: noteId },
    }).catch(() => undefined);
    trackFunnelEvent('my_idea_used', { source: 'notebook_context_panel', ideaId: idea.id });
    toast.success(t('myWorkNotebook.contextPanel.ideaInserted'));
  };

  const handleInsertPulseRef = (item: PulseItem) => {
    const typeLabel = item.type === 'initiative' ? '🎯' : item.type === 'task' ? '✅' : '⚖️';
    insertEmbeddedRef({
      artifactType: item.type,
      artifactId: item.id,
      title: item.title,
      label: `${typeLabel} ${item.title}`,
      status: item.status,
    });
    Api.createLinkGraphEdge({
      source: { type: 'notebook', id: noteId },
      target: { type: item.type, id: item.id },
      relation: 'ref',
      context: { containerType: 'notebook_embed', containerId: noteId },
    }).catch(() => undefined);
    toast.success(t('myWorkNotebook.contextPanel.referenceInserted'));
  };

  const handleInsertNoteRef = (n: NotebookPage) => {
    insertEmbeddedRef({
      artifactType: 'notebook_page',
      artifactId: n.id,
      title: n.title || t('myWorkNotebook.contextPanel.untitled'),
      label: `📄 ${n.title || t('myWorkNotebook.contextPanel.untitled')}`,
      snippet: n.summary || undefined,
      status: n.status,
      updatedAt: n.updatedAt || undefined,
    });
    Api.createLinkGraphEdge({
      source: { type: 'notebook', id: noteId },
      target: { type: 'notebook_page', id: n.id },
      relation: 'ref',
      context: { containerType: 'notebook_embed', containerId: noteId },
    }).catch(() => undefined);
    toast.success(t('myWorkNotebook.contextPanel.noteReferenceInserted'));
  };

  const openItem = (
    type:
      | 'idea'
      | 'initiative'
      | 'task'
      | 'decision'
      | 'notebook'
      | 'assessment'
      | 'report'
      | 'presentation'
      | 'sheet',
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
      <div className="px-3 py-3 border-b border-c-border-subtle">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className={`flex items-center gap-2 text-xs font-semibold ${cfg.color}`}>
            <Icon size={14} />
            <span>{t(`myWorkNotebook.contextPanel.section_${k}`, cfg.label)}</span>
            <span className={`${cfg.bg} px-1.5 py-0.5 rounded-full text-[10px]`}>{count}</span>
          </div>
          <div className="flex items-center gap-1">
            {count > 4 && (
              <button
                onClick={() => setExpanded((p) => ({ ...p, [k]: !p[k] }))}
                className="text-[10px] font-semibold text-c-text-muted hover:text-c-text-secondary px-2 py-1 rounded-md hover:bg-c-surface-raised transition-colors"
                title={t('myWorkNotebook.contextPanel.moreLess')}
              >
                {expanded[k]
                  ? t('myWorkNotebook.contextPanel.less')
                  : t('myWorkNotebook.contextPanel.more')}
              </button>
            )}
            {onMore && (
              <button
                onClick={onMore}
                className="text-[10px] font-semibold text-c-text-muted hover:text-c-text-secondary px-2 py-1 rounded-md hover:bg-c-surface-raised transition-colors"
                title={t('myWorkNotebook.contextPanel.browseAll')}
              >
                {t('myWorkNotebook.contextPanel.all')}
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
    <div className="rounded-xl border border-c-border-subtle bg-c-surface-raised px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-medium text-c-text truncate">{title}</div>
          {subtitle ? (
            <div className="mt-0.5 text-[11px] text-c-text-muted line-clamp-2">{subtitle}</div>
          ) : null}
          {badge ? (
            // FIX-18 (Day 3 layer-2 acceptance): plain `capitalize` CSS on a raw
            // status ("in_progress") only uppercases the FIRST character of the
            // whole string ("In_progress") — the underscore is not a word
            // boundary. Route through the app's canonical status dictionary
            // (statusChip.* — same one every other status pill in the app uses)
            // instead of fabricating a new humanization rule here.
            <div className="mt-1">
              <EntityStatusChip status={badge} size="sm" />
            </div>
          ) : null}
        </div>
        <button
          className="p-1.5 rounded-lg text-c-text-secondary hover:text-c-text hover:bg-c-surface-raised transition-colors"
          title={t('myWorkNotebook.contextPanel.actions')}
          onClick={onInsert}
        >
          <MoreHorizontal size={14} />
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={onInsert}
          className="flex-1 flex items-center justify-center gap-1 rounded-md bg-c-surface border border-c-border-subtle text-c-text-secondary px-2 py-1 text-[11px] font-medium hover:bg-c-surface-raised transition-colors"
        >
          <ArrowRight size={12} />
          {t('myWorkNotebook.contextPanel.insert')}
        </button>
        {onOpen ? (
          <button
            onClick={onOpen}
            className="flex items-center justify-center gap-1 rounded-md bg-c-surface-raised text-c-text-secondary px-2 py-1 text-[11px] font-medium hover:bg-c-surface-raised transition-colors"
          >
            <ExternalLink size={12} />
            {t('myWorkNotebook.contextPanel.open')}
          </button>
        ) : null}
      </div>
    </div>
  );

  return (
    <div
      className={
        embedded
          ? 'flex flex-col'
          : 'w-80 shrink-0 rounded-2xl border border-slate-200/60 dark:border-white/[0.03] overflow-hidden bg-c-surface flex flex-col'
      }
    >
      {embedded ? null : (
        <div className="flex items-center justify-between px-3 py-3 border-b border-c-border-subtle">
          <div className="flex items-center gap-2 text-sm font-semibold text-c-warning">
            <Lightbulb size={16} />
            <span>{t('myWorkNotebook.contextPanel.noteContext')}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-c-text-muted hover:bg-c-surface-raised"
            title={t('myWorkNotebook.contextPanel.close')}
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className={embedded ? 'flex-1' : 'flex-1 overflow-y-auto nb-scroll'}>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={18} className="animate-spin text-c-text-secondary" />
          </div>
        ) : (
          <>
            <div className="px-3 py-3 border-b border-c-border-subtle">
              <EmbeddedView
                title={t('myWorkNotebook.contextPanel.usedIn')}
                count={usedIn.length}
                loading={backlinksLoading}
                readOnly
                viewModes={['list']}
              >
                {usedIn.length === 0 && !backlinksLoading ? (
                  <div className="text-[11px] text-c-text-muted px-1">
                    {t('myWorkNotebook.contextPanel.noLinks')}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {usedIn.slice(0, 8).map((x, idx) => {
                      const chip = backlinkChips[`${x.sourceType}:${x.sourceId}`];
                      return (
                        <div
                          key={`${x.sourceType}:${x.sourceId}:${x.id || ''}:${idx}`}
                          className="rounded-xl border border-c-border-subtle bg-c-surface-raised px-3 py-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-c-text truncate">
                                {chip?.title ||
                                  t(
                                    `myWorkNotebook.contextPanel.sourceType_${x.sourceType}`,
                                    x.sourceType
                                  )}
                              </div>
                              {chip?.snippet ? (
                                <div className="mt-0.5 text-[11px] text-c-text-muted truncate">
                                  {chip.snippet}
                                </div>
                              ) : null}
                              {chip?.status ? (
                                // FIX-18 (Day 3 layer-2 acceptance): same fix as the
                                // Row badge above — route the raw status through the
                                // canonical statusChip.* dictionary instead of a bare
                                // uppercase/raw string.
                                <div className="mt-1">
                                  <EntityStatusChip status={chip.status} size="sm" />
                                </div>
                              ) : null}
                            </div>
                            {[
                              'task',
                              'decision',
                              'idea',
                              'initiative',
                              'notebook',
                              'report',
                              'presentation',
                            ].includes(String(x.sourceType)) ? (
                              <button
                                onClick={() =>
                                  openItem(
                                    x.sourceType as any,
                                    x.sourceId,
                                    `${x.sourceType} ${x.sourceId}`.slice(0, 120)
                                  )
                                }
                                className="flex items-center justify-center gap-1 rounded-md bg-c-surface-raised text-c-text-secondary px-2 py-1 text-[11px] font-medium hover:bg-c-surface-raised transition-colors"
                              >
                                <ExternalLink size={12} />
                                {t('myWorkNotebook.contextPanel.open')}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </EmbeddedView>
            </div>

            {allLinkedOutputRows.length === 0 &&
            !linkedOutputsBusy &&
            !linkedOutputsErrorMessage ? (
              <div className="flex items-center gap-2 px-3 py-2 border-b border-c-border-subtle text-[11px] text-c-text-muted">
                <Link2 size={12} />
                <span>{t('myWorkNotebook.contextPanel.noLinkedOutputs')}</span>
              </div>
            ) : (
              <div className="px-3 py-3 border-b border-c-border-subtle">
                <EmbeddedView
                  title={t('myWorkNotebook.contextPanel.linkedOutputs')}
                  count={allLinkedOutputRows.length}
                  loading={linkedOutputsBusy}
                  readOnly
                  viewModes={['list']}
                >
                  {linkedOutputsErrorMessage ? (
                    <div className="rounded-xl border border-c-warning/30 bg-c-warning/8 px-3 py-2 text-[11px] text-c-warning">
                      {linkedOutputsErrorMessage}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {allLinkedOutputRows.slice(0, 8).map((row) => (
                        <div
                          key={row.artifactId || `${row.kind}:${row.originRecordId}`}
                          className="rounded-xl border border-c-border-subtle bg-c-surface-raised px-3 py-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-c-text truncate">
                                {row.title}
                              </div>
                              <div className="mt-0.5 text-[11px] text-c-text-muted truncate">
                                {row.kind} · {row.statusKey} ·{' '}
                                {row.governance?.visibilityScope || 'private'}
                              </div>
                            </div>
                            <button
                              onClick={() =>
                                openItem(
                                  row.kind === 'assessment'
                                    ? 'assessment'
                                    : row.kind === 'document'
                                      ? 'report'
                                      : row.kind === 'presentation'
                                        ? 'presentation'
                                        : 'sheet',
                                  row.originRecordId,
                                  row.title
                                )
                              }
                              className="flex items-center justify-center gap-1 rounded-md bg-c-surface-raised text-c-text-secondary px-2 py-1 text-[11px] font-medium hover:bg-c-surface-raised transition-colors"
                            >
                              <ExternalLink size={12} />
                              {t('myWorkNotebook.contextPanel.open')}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </EmbeddedView>
              </div>
            )}

            {ideas.length > 0 && (
              <Section k="idea" count={ideas.length}>
                {take('idea', ideas).map((idea) => (
                  <Row
                    key={idea.id}
                    title={idea.title}
                    subtitle={idea.body || null}
                    onInsert={() => handleInsertIdea(idea)}
                    onOpen={() => openItem('idea', idea.id, idea.title)}
                  />
                ))}
              </Section>
            )}

            <Section
              k="initiative"
              count={initiatives.length}
              onMore={() => setPickerType('initiative')}
            >
              {take('initiative', initiatives).length === 0 ? (
                <div className="text-[11px] text-c-text-muted px-1">
                  {t('myWorkNotebook.contextPanel.noneAddViaAll')}
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
                <div className="text-[11px] text-c-text-muted px-1">
                  {t('myWorkNotebook.contextPanel.noneAddViaAll')}
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
                <div className="text-[11px] text-c-text-muted px-1">
                  {t('myWorkNotebook.contextPanel.noneAddViaAll')}
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

            {noteSuggestions.length > 0 && (
              <Section k="note" count={noteSuggestions.length}>
                {take('note', noteSuggestions).map((n) => (
                  <Row
                    key={n.id}
                    title={n.title || t('myWorkNotebook.contextPanel.untitled')}
                    subtitle={n.summary || null}
                    onInsert={() => handleInsertNoteRef(n)}
                    onOpen={() => openItem('notebook', n.id, n.title || 'Note')}
                  />
                ))}
              </Section>
            )}
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
