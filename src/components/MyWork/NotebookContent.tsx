import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  ArrowRight,
  BookOpen,
  CheckSquare,
  Lightbulb,
  Plus,
  Scale,
  Search,
  Sparkles,
  Tag,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

import {
  CalloutNode,
  DetailsContentNode,
  DetailsNode,
  DetailsSummaryNode,
} from './notebook/extensions';
import { AIInlineResponse, type AICommandType } from './notebook/AIInlineResponse';
import { KnowledgePulse } from './notebook/KnowledgePulse';
import { NewPageModal, type PageTemplate } from './notebook/NewPageModal';
import { NotebookToolbar } from './notebook/NotebookToolbar';
import {
  detectSlashTrigger,
  INITIAL_SLASH_STATE,
  SlashMenu,
  type SlashMenuState,
} from './notebook/SlashMenu';

interface NotebookCounts {
  total: number;
}

interface NotebookContentProps {
  projectId?: string | null;
  searchQuery: string;
  onCountsChange?: (counts: NotebookCounts) => void;
  linkedIdeasOpen?: boolean;
  onLinkedIdeasOpenChange?: (open: boolean) => void;
  pulseOpen?: boolean;
  onPulseOpenChange?: (open: boolean) => void;
  createPageRequestId?: number;
}

export type NotebookVisibility = 'private' | 'project';

export type NotebookMaturity = 'seed' | 'growing' | 'mature' | 'actionable';

export interface NotebookPage {
  id: string;
  title: string;
  projectId: string | null;
  visibility: NotebookVisibility;
  tags: string[];
  contentJson: any;
  contentText: string;
  maturity?: NotebookMaturity;
  icon?: string | null;
  summary?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

const MATURITY_CONFIG: Record<NotebookMaturity, { dot: string; label: string; labelPl: string }> = {
  seed: { dot: 'bg-slate-400', label: 'Seed', labelPl: 'Ziarno' },
  growing: { dot: 'bg-emerald-500', label: 'Growing', labelPl: 'Rośnie' },
  mature: { dot: 'bg-blue-500', label: 'Mature', labelPl: 'Dojrzała' },
  actionable: { dot: 'bg-amber-500', label: 'Actionable', labelPl: 'Do działania' },
};

function computeMaturity(page: NotebookPage): NotebookMaturity {
  const textLen = (page.contentText || '').length;
  const tagCount = (page.tags || []).length;
  if (textLen >= 300 && tagCount >= 3) return 'actionable';
  if (textLen >= 300) return 'mature';
  if (textLen >= 100 && tagCount >= 1) return 'growing';
  return 'seed';
}

const extractText = (json: any): string => {
  try {
    const parts: string[] = [];
    const walk = (node: any) => {
      if (!node) return;
      if (typeof node.text === 'string') parts.push(node.text);
      if (Array.isArray(node.content)) node.content.forEach(walk);
    };
    walk(json);
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
};

/* ------------------------------------------------------------------ */
/*  Editor styles for custom blocks                                    */
/* ------------------------------------------------------------------ */

const EDITOR_STYLES = `
/* Typography */
.ProseMirror {
  line-height: 1.75;
  font-size: 0.9375rem;
}
.ProseMirror h1 { font-size: 1.5rem; font-weight: 700; margin-top: 1.5rem; margin-bottom: 0.5rem; }
.ProseMirror h2 { font-size: 1.25rem; font-weight: 600; margin-top: 1.25rem; margin-bottom: 0.4rem; }
.ProseMirror h3 { font-size: 1.1rem; font-weight: 600; margin-top: 1rem; margin-bottom: 0.3rem; }
.ProseMirror > * + * { margin-top: 0.3rem; }
.ProseMirror p.is-editor-empty:first-child::before {
  color: #94a3b8;
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}
.dark .ProseMirror p.is-editor-empty:first-child::before { color: #475569; }

/* Block hover handles */
.ProseMirror > *:not(table) {
  position: relative;
  transition: background-color 0.1s;
  border-radius: 0.25rem;
}
.ProseMirror > *:not(table):hover {
  background-color: rgba(148,163,184,0.04);
}

/* Task list */
.ProseMirror ul[data-type="taskList"] li {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}
.ProseMirror ul[data-type="taskList"] li label input[type="checkbox"] {
  accent-color: #6366f1;
  margin-top: 0.35rem;
}

/* Callout */
.nb-callout {
  border-left: 4px solid;
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  margin: 0.5rem 0;
  transition: box-shadow 0.15s;
}
.nb-callout:hover { box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
.nb-callout[data-variant="info"]     { border-color: #3b82f6; background: #eff6ff; }
.nb-callout[data-variant="warning"]  { border-color: #f59e0b; background: #fffbeb; }
.nb-callout[data-variant="success"]  { border-color: #22c55e; background: #f0fdf4; }
.nb-callout[data-variant="critical"] { border-color: #ef4444; background: #fef2f2; }
.dark .nb-callout[data-variant="info"]     { background: rgba(59,130,246,0.08); }
.dark .nb-callout[data-variant="warning"]  { background: rgba(245,158,11,0.08); }
.dark .nb-callout[data-variant="success"]  { background: rgba(34,197,94,0.08); }
.dark .nb-callout[data-variant="critical"] { background: rgba(239,68,68,0.08); }

/* Details / Toggle */
.nb-details {
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  margin: 0.5rem 0;
  overflow: hidden;
  transition: box-shadow 0.15s;
}
.nb-details:hover { box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
.dark .nb-details { border-color: rgba(255,255,255,0.08); }
.nb-summary {
  cursor: pointer;
  font-weight: 600;
  padding: 0.5rem 0.75rem;
  background: #f8fafc;
  user-select: text;
  transition: background-color 0.1s;
}
.nb-summary:hover { background: #f1f5f9; }
.dark .nb-summary { background: rgba(255,255,255,0.03); }
.dark .nb-summary:hover { background: rgba(255,255,255,0.06); }
.nb-details-content { padding: 0.5rem 0.75rem 0.75rem; }

/* Table */
.ProseMirror table {
  border-collapse: collapse;
  width: 100%;
  margin: 0.5rem 0;
  border-radius: 0.5rem;
  overflow: hidden;
}
.ProseMirror th,
.ProseMirror td {
  border: 1px solid #e2e8f0;
  padding: 0.5rem 0.75rem;
  text-align: left;
  vertical-align: top;
}
.dark .ProseMirror th,
.dark .ProseMirror td { border-color: rgba(255,255,255,0.1); }
.ProseMirror th {
  font-weight: 600;
  background: #f8fafc;
  font-size: 0.875rem;
}
.dark .ProseMirror th { background: rgba(255,255,255,0.04); }

/* Code block */
.ProseMirror pre {
  background: #1e293b;
  color: #e2e8f0;
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  font-size: 0.8125rem;
  line-height: 1.6;
  overflow-x: auto;
}
.dark .ProseMirror pre { background: rgba(15,23,42,0.8); }

/* Horizontal rule */
.ProseMirror hr {
  border: none;
  border-top: 2px solid #e2e8f0;
  margin: 1.5rem 0;
}
.dark .ProseMirror hr { border-color: rgba(255,255,255,0.08); }

/* Focus ring on editor */
.ProseMirror:focus { outline: none; }

/* Page transition animation */
@keyframes nbFadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
.nb-page-enter { animation: nbFadeIn 0.2s ease-out; }
`;

export const NotebookContent: React.FC<NotebookContentProps> = ({
  projectId,
  searchQuery,
  onCountsChange,
  linkedIdeasOpen,
  onLinkedIdeasOpenChange,
  pulseOpen,
  onPulseOpenChange,
  createPageRequestId,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const [pages, setPages] = useState<NotebookPage[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const activePage = useMemo(() => pages.find((p) => p.id === activeId) || null, [pages, activeId]);

  const [title, setTitle] = useState(activePage?.title || '');
  const [pageProjectId, setPageProjectId] = useState(activePage?.projectId || '');
  const [pageTags, setPageTags] = useState<string[]>(activePage?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const saveTimer = useRef<number | null>(null);
  const isSavingRef = useRef(false);

  // Slash menu
  const [slashState, setSlashState] = useState<SlashMenuState>(INITIAL_SLASH_STATE);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // AI inline response
  const [aiCommand, setAiCommand] = useState<AICommandType | null>(null);

  // Auto-summary
  const summaryTimer = useRef<number | null>(null);
  const summaryAbortRef = useRef<AbortController | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder: isPolish
          ? 'Zacznij pisać… Wpisz / aby wstawić blok'
          : 'Start writing… Type / to insert a block',
      }),
      CalloutNode,
      DetailsNode,
      DetailsSummaryNode,
      DetailsContentNode,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: activePage?.contentJson || { type: 'doc', content: [] },
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none dark:prose-invert focus:outline-none min-h-[360px] px-3 py-3',
      },
    },
    onTransaction({ editor: ed }) {
      const trigger = detectSlashTrigger(ed);
      if (trigger) {
        setSlashState(trigger);
      } else if (slashState.open) {
        setSlashState(INITIAL_SLASH_STATE);
      }
    },
  });

  // Sync editor when switching pages
  useEffect(() => {
    if (!editor) return;
    if (!activePage) {
      editor.commands.setContent({ type: 'doc', content: [] }, { emitUpdate: false });
      setTitle('');
      setPageProjectId('');
      setPageTags([]);
      return;
    }
    editor.commands.setContent(
      activePage.contentJson || { type: 'doc', content: [] },
      { emitUpdate: false }
    );
    setTitle(activePage.title || '');
    setPageProjectId(activePage.projectId || '');
    setPageTags(activePage.tags || []);
  }, [activePage?.id, editor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Counts
  useEffect(() => {
    onCountsChange?.({ total: pages.length });
  }, [pages.length, onCountsChange]);

  const fetchPages = useMemo(
    () => async () => {
      try {
        const params = new URLSearchParams();
        if (projectId) params.set('projectId', projectId);
        const q = String(searchQuery || '').trim();
        if (q) {
          params.set('q', q);
          trackFunnelEvent('notebook_search_used', { query: q });
        }
        params.set('limit', '200');

        const res = (await Api.get(`/my-work/notebook/pages?${params.toString()}`)) as any;
        const list = Array.isArray(res) ? res : res?.pages || [];
        setPages(list || []);
        setActiveId((prev) => prev || list?.[0]?.id || null);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to load notebook pages', e);
        toast.error(t('myWork.errors.fetchFailed', 'Failed to load'));
      }
    },
    [projectId, searchQuery, t]
  );

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  const filteredPages = pages;

  const generateSummary = useCallback(
    (pageId: string, pageTitle: string, contentText: string) => {
      summaryAbortRef.current?.abort();
      const controller = new AbortController();
      summaryAbortRef.current = controller;

      let summaryText = '';
      Api.chatWithAIStream(
        `Summarize this note in 1-2 concise sentences (max 120 chars). Note title: "${pageTitle}". Content: ${contentText.slice(0, 1500)}`,
        [],
        (chunk) => { summaryText += chunk; },
        () => {
          const cleaned = summaryText.trim().slice(0, 200);
          if (cleaned) {
            Api.put(`/my-work/notebook/pages/${encodeURIComponent(pageId)}`, { summary: cleaned }).catch(() => {});
            setPages((prev) => prev.map((p) => (p.id === pageId ? { ...p, summary: cleaned } : p)));
          }
        },
        isPolish
          ? 'Podaj streszczenie notatki w 1-2 zwięzłych zdaniach (max 120 znaków). Odpowiedz TYLKO streszczeniem, bez żadnych komentarzy.'
          : 'Provide a summary in 1-2 concise sentences (max 120 chars). Respond ONLY with the summary, no commentary.',
        undefined,
        undefined,
        isPolish ? 'pl' : 'en',
        undefined,
        { responseStyle: 'concise', selectedTier: 'BUDGET' },
        controller.signal,
      ).catch(() => {});
    },
    [isPolish],
  );

  const scheduleSave = useCallback(
    (next: Partial<NotebookPage>) => {
      if (!activePage) return;
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        const base = pages.find((p) => p.id === activePage.id);
        if (!base) return;
        const updated: NotebookPage = { ...base, ...next };
        setPages((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));

        if (isSavingRef.current) return;
        isSavingRef.current = true;

        trackFunnelEvent('notebook_page_edited', { pageId: updated.id });

        const newMaturity = computeMaturity(updated);
        updated.maturity = newMaturity;

        Api.put(`/my-work/notebook/pages/${encodeURIComponent(updated.id)}`, {
          title: updated.title,
          projectId: updated.projectId,
          visibility: updated.visibility,
          tags: updated.tags,
          contentJson: updated.contentJson,
          contentText: updated.contentText,
          maturity: newMaturity,
        })
          .then(() => {
            // Trigger auto-summary generation for substantial content
            const textLen = (updated.contentText || '').length;
            if (textLen > 200 && updated.id) {
              if (summaryTimer.current) window.clearTimeout(summaryTimer.current);
              summaryTimer.current = window.setTimeout(() => {
                generateSummary(updated.id, updated.title, updated.contentText || '');
              }, 3000);
            }
          })
          .catch((e) => {
            // eslint-disable-next-line no-console
            console.error('Failed to save notebook page', e);
            toast.error(t('myWork.errors.updateFailed', 'Failed to update'));
          })
          .finally(() => {
            isSavingRef.current = false;
          });
      }, 350);
    },
    [activePage, pages, t]
  );

  const [templateModalOpen, setTemplateModalOpen] = useState(false);

  const handleNewPage = useCallback(
    async (template?: PageTemplate) => {
      try {
        const defaultTitle = template
          ? (isPolish ? template.defaultTitlePl : template.defaultTitle)
          : (isPolish ? 'Nowa strona' : 'New page');
        const contentJson = template?.contentJson || { type: 'doc', content: [] };

        const created = (await Api.post('/my-work/notebook/pages', {
          title: defaultTitle,
          projectId: projectId || null,
          visibility: projectId ? 'project' : 'private',
          tags: [],
          contentJson,
          contentText: extractText(contentJson),
          icon: template?.defaultIcon || null,
        })) as any;

        trackFunnelEvent('notebook_page_created', {
          pageId: created?.id,
          visibility: projectId ? 'project' : 'private',
          template: template?.id || 'blank',
        });
        if (template && template.id !== 'blank') {
          trackFunnelEvent('notebook_template_used', { template: template.id });
        }

        await fetchPages();
        if (created?.id) setActiveId(created.id);
        toast.success(isPolish ? 'Utworzono stronę' : 'Page created');
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to create notebook page', e);
        toast.error(t('myWork.errors.createFailed', 'Failed to create'));
      }
    },
    [fetchPages, isPolish, projectId, t],
  );

  // Create page requested from top bar (MyWorkHub) → open template modal
  const lastCreateReqRef = useRef<number | null>(null);
  useEffect(() => {
    if (!createPageRequestId) return;
    if (lastCreateReqRef.current === createPageRequestId) return;
    lastCreateReqRef.current = createPageRequestId;
    setTemplateModalOpen(true);
  }, [createPageRequestId]);

  const handleDeletePage = async () => {
    if (!activePage) return;
    try {
      await Api.delete(`/my-work/notebook/pages/${encodeURIComponent(activePage.id)}`);
      await fetchPages();
      toast.success(isPolish ? 'Usunięto stronę' : 'Page deleted');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to delete notebook page', e);
      toast.error(t('myWork.errors.deleteFailed', 'Failed to delete'));
    }
  };

  // Persist editor changes
  useEffect(() => {
    if (!editor || !activePage) return;
    const handler = () => {
      const json = editor.getJSON();
      const text = extractText(json);
      scheduleSave({ contentJson: json, contentText: text });
    };
    editor.on('update', handler);
    return () => {
      editor.off('update', handler);
    };
  }, [editor, activePage?.id, scheduleSave]);

  // Tag management
  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (!tag || pageTags.includes(tag)) {
      setTagInput('');
      return;
    }
    const next = [...pageTags, tag];
    setPageTags(next);
    setTagInput('');
    scheduleSave({ tags: next });
  };

  const handleRemoveTag = (tag: string) => {
    const next = pageTags.filter((t2) => t2 !== tag);
    setPageTags(next);
    scheduleSave({ tags: next });
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag();
    }
    if (e.key === 'Backspace' && !tagInput && pageTags.length > 0) {
      handleRemoveTag(pageTags[pageTags.length - 1]);
    }
  };

  // ----------------------------------------------------------------
  // Linked Ideas panel (T009 → T011)
  // ----------------------------------------------------------------
  interface LinkedIdea {
    id: string;
    title: string;
    body?: string | null;
    tags?: string[];
  }

  const [ideasOpenInternal, setIdeasOpenInternal] = useState(false);
  const ideasOpen = linkedIdeasOpen ?? ideasOpenInternal;
  const setIdeasOpen = onLinkedIdeasOpenChange ?? setIdeasOpenInternal;

  const [pulseOpenInternal, setPulseOpenInternal] = useState(false);
  const isPulseOpen = pulseOpen ?? pulseOpenInternal;
  const setPulseOpen = onPulseOpenChange ?? setPulseOpenInternal;
  const [linkedIdeas, setLinkedIdeas] = useState<LinkedIdea[]>([]);
  const [linkedIdeasLoading, setLinkedIdeasLoading] = useState(false);

  useEffect(() => {
    if (!ideasOpen) return;
    let cancelled = false;
    const load = async () => {
      setLinkedIdeasLoading(true);
      try {
        const q = [title, pageTags.join(' ')].filter(Boolean).join(' ').trim();
        const ideas = q
          ? await Api.suggestMyIdeas(q.slice(0, 300), 10)
          : await Api.getMyIdeas({ limit: 10 });
        if (!cancelled) setLinkedIdeas(Array.isArray(ideas) ? ideas : []);
      } catch {
        if (!cancelled) setLinkedIdeas([]);
      } finally {
        if (!cancelled) setLinkedIdeasLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [ideasOpen, title, pageTags]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleInsertIdea = (idea: LinkedIdea) => {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'callout',
        attrs: { variant: 'info' },
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: `💡 ${idea.title}` }],
          },
          ...(idea.body
            ? [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: idea.body }],
                },
              ]
            : []),
        ],
      })
      .run();
    trackFunnelEvent('my_idea_used', { source: 'notebook', ideaId: idea.id });
    toast.success(isPolish ? 'Wstawiono pomysł' : 'Idea inserted');
  };

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[520px]">
      <style>{EDITOR_STYLES}</style>

      {/* Sidebar */}
      <div className="w-72 shrink-0 border-r border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950">
        <div className="flex items-center justify-between px-3 py-3 border-b border-slate-200 dark:border-navy-800">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
            <BookOpen size={16} />
            <span>{t('myWork.notebook.title', 'Notebook')}</span>
          </div>
          <button
            onClick={() => setTemplateModalOpen(true)}
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
            title={t('myWork.notebook.new', 'New page')}
            aria-label={t('myWork.notebook.new', 'New page')}
          >
            <Plus size={18} />
          </button>
        </div>

        <div className="px-3 py-2 border-b border-slate-200 dark:border-navy-800">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-900 px-2 py-1.5">
            <Search size={14} className="text-slate-500 dark:text-slate-400" />
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t('myWork.notebook.searchHint', 'Use the main search above')}
            </div>
          </div>
        </div>

        <div className="overflow-y-auto p-2 space-y-1">
          {filteredPages.length === 0 ? (
            <div className="p-3 text-xs text-slate-500 dark:text-slate-400">
              {t('myWork.notebook.empty', 'No pages yet')}
            </div>
          ) : (
            filteredPages.map((p) => {
              const isActive = p.id === activeId;
              const mat = (p.maturity as NotebookMaturity) || computeMaturity(p);
              const matCfg = MATURITY_CONFIG[mat];
              return (
                <button
                  key={p.id}
                  onClick={() => setActiveId(p.id)}
                  className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-all duration-150 ${
                    isActive
                      ? 'bg-primary-500/12 text-primary-700 dark:text-primary-300 shadow-sm'
                      : 'hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {p.icon && <span className="text-base shrink-0">{p.icon}</span>}
                    <div
                      className={`w-2 h-2 rounded-full shrink-0 ${matCfg.dot}`}
                      title={isPolish ? matCfg.labelPl : matCfg.label}
                    />
                    <span className="font-medium truncate flex-1">
                      {p.title || (isPolish ? 'Bez tytułu' : 'Untitled')}
                    </span>
                  </div>
                  {p.summary && (
                    <div className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500 line-clamp-1 pl-4">
                      {p.summary}
                    </div>
                  )}
                  <div className="mt-0.5 flex items-center gap-1 flex-wrap pl-4">
                    {p.tags && p.tags.length > 0 && (
                      p.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-primary-500/10 text-primary-600 dark:text-primary-400 px-1.5 py-0.5 text-[9px] font-medium"
                        >
                          {tag}
                        </span>
                      ))
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Editor + Ideas panel */}
      <div className="flex-1 flex bg-slate-50 dark:bg-navy-950">
        <div className="flex-1 min-w-0">
          {!activePage ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {t('myWork.notebook.noSelection', 'Select or create a page')}
                </div>
                <button
                  onClick={() => setTemplateModalOpen(true)}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white px-3 py-2 text-sm font-medium"
                >
                  <Plus size={16} />
                  {t('myWork.notebook.new', 'New page')}
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col nb-page-enter" key={activePage.id}>
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950">
                <div className="flex-1 min-w-0">
                  <input
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      scheduleSave({ title: e.target.value });
                    }}
                    placeholder={isPolish ? 'Tytuł strony…' : 'Page title…'}
                    className="w-full bg-transparent text-lg font-semibold text-slate-900 dark:text-white outline-none"
                  />
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <input
                      value={pageProjectId}
                      onChange={(e) => {
                        setPageProjectId(e.target.value);
                        scheduleSave({
                          projectId: e.target.value || null,
                          visibility: e.target.value ? 'project' : 'private',
                        });
                      }}
                      placeholder={isPolish ? 'Project ID (opcjonalnie)' : 'Project ID (optional)'}
                      className="w-48 rounded-md border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-900 px-2 py-1 text-xs text-slate-700 dark:text-slate-200 outline-none"
                    />
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {t('myWork.notebook.autoSaved', 'Auto-saved')}
                    </span>
                  </div>

                  {/* Tags */}
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    <Tag size={12} className="text-slate-400 shrink-0" />
                    {pageTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-full bg-primary-500/10 text-primary-700 dark:text-primary-300 px-2 py-0.5 text-[11px] font-medium"
                      >
                        {tag}
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:text-primary-900 dark:hover:text-primary-100"
                          aria-label={`Remove tag ${tag}`}
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                    <input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleTagKeyDown}
                      onBlur={handleAddTag}
                      placeholder={isPolish ? 'Dodaj tag…' : 'Add tag…'}
                      className="min-w-[80px] max-w-[160px] bg-transparent text-[11px] text-slate-600 dark:text-slate-300 outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <button
                    onClick={handleDeletePage}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.10] text-slate-700 dark:text-slate-200 px-3 py-2 text-sm font-medium"
                    title={t('common.delete', 'Delete')}
                  >
                    <Trash2 size={16} />
                    {t('common.delete', 'Delete')}
                  </button>
                </div>
              </div>

              {/* Toolbar */}
              {editor && (
                <NotebookToolbar
                  editor={editor}
                  onAIClick={() => setAiCommand(aiCommand ? null : 'ask')}
                />
              )}

              {/* Auto-summary */}
              {activePage?.summary && (
                <div className="px-4 py-1.5 border-b border-slate-100 dark:border-navy-800/50 bg-slate-50/50 dark:bg-navy-950/50">
                  <div className="mx-auto max-w-4xl flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 italic">
                    <Sparkles size={10} className="shrink-0 text-violet-400" />
                    <span className="line-clamp-1">{activePage.summary}</span>
                  </div>
                </div>
              )}

              {/* Convert-to CTA */}
              {activePage && (activePage.maturity === 'mature' || activePage.maturity === 'actionable') && (
                <div className="px-4 py-2 border-b border-amber-200/60 dark:border-amber-800/30 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/10">
                  <div className="mx-auto max-w-4xl flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                      {isPolish ? 'Ta notatka wygląda na gotową do działania' : 'This note looks ready for action'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          trackFunnelEvent('notebook_convert_triggered', { target: 'initiative', noteId: activePage.id });
                          toast.success(isPolish ? 'Tworzenie inicjatywy z notatki…' : 'Creating initiative from note…');
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-300 text-[10px] font-medium hover:bg-blue-500/20 transition-colors"
                      >
                        <Target size={10} />
                        {isPolish ? 'Inicjatywa' : 'Initiative'}
                        <ArrowRight size={8} />
                      </button>
                      <button
                        onClick={() => {
                          trackFunnelEvent('notebook_convert_triggered', { target: 'task', noteId: activePage.id });
                          toast.success(isPolish ? 'Tworzenie taska z notatki…' : 'Creating task from note…');
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-medium hover:bg-emerald-500/20 transition-colors"
                      >
                        <CheckSquare size={10} />
                        {isPolish ? 'Task' : 'Task'}
                        <ArrowRight size={8} />
                      </button>
                      <button
                        onClick={() => {
                          trackFunnelEvent('notebook_convert_triggered', { target: 'decision', noteId: activePage.id });
                          toast.success(isPolish ? 'Tworzenie decyzji z notatki…' : 'Creating decision from note…');
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] font-medium hover:bg-amber-500/20 transition-colors"
                      >
                        <Scale size={10} />
                        {isPolish ? 'Decyzja' : 'Decision'}
                        <ArrowRight size={8} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Editor area */}
              <div className="flex-1 overflow-y-auto relative" ref={editorContainerRef}>
                <div className="mx-auto max-w-4xl py-4">
                  <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950">
                    <EditorContent editor={editor} />
                  </div>
                </div>

                {/* AI inline response */}
                {aiCommand && activePage && (
                  <AIInlineResponse
                    commandType={aiCommand}
                    noteContent={activePage.contentText || extractText(activePage.contentJson)}
                    noteTitle={title}
                    onInsert={(text) => {
                      if (editor) {
                        editor.chain().focus().insertContent({
                          type: 'paragraph',
                          content: [{ type: 'text', text }],
                        }).run();
                      }
                      setAiCommand(null);
                    }}
                    onDismiss={() => setAiCommand(null)}
                  />
                )}

                {/* Slash command menu */}
                {editor && (
                  <SlashMenu
                    editor={editor}
                    state={slashState}
                    onClose={() => setSlashState(INITIAL_SLASH_STATE)}
                    containerRef={editorContainerRef}
                    onAICommand={(cmd) => setAiCommand(cmd)}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Knowledge Pulse right panel */}
        {isPulseOpen && activePage && (
          <KnowledgePulse
            noteTitle={title}
            noteTags={pageTags}
            noteId={activePage.id}
            onInsertReference={(item) => {
              if (!editor) return;
              const typeLabel = item.type === 'initiative' ? '🎯' : item.type === 'task' ? '✅' : '⚖️';
              editor.chain().focus().insertContent({
                type: 'callout',
                attrs: { variant: 'info' },
                content: [{ type: 'paragraph', content: [{ type: 'text', text: `${typeLabel} ${item.title} [${item.type}]` }] }],
              }).run();
              toast.success(isPolish ? 'Wstawiono odniesienie' : 'Reference inserted');
            }}
            onClose={() => setPulseOpen(false)}
          />
        )}

        {/* Linked Ideas right panel (T009 → T011) */}
        {ideasOpen && activePage && (
          <div className="w-72 shrink-0 border-l border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 flex flex-col">
            <div className="flex items-center justify-between px-3 py-3 border-b border-slate-200 dark:border-navy-800">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
                <Lightbulb size={16} />
                <span>{t('myWork.notebook.linkedIdeas', 'Linked Ideas')}</span>
              </div>
              <button
                onClick={() => setIdeasOpen(false)}
                className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {linkedIdeasLoading ? (
                <div className="p-3 text-xs text-slate-500 dark:text-slate-400 text-center">
                  {t('common.loading', 'Loading…')}
                </div>
              ) : linkedIdeas.length === 0 ? (
                <div className="p-3 text-xs text-slate-500 dark:text-slate-400 text-center">
                  {t('myWork.notebook.noLinkedIdeas', 'No related ideas found')}
                </div>
              ) : (
                linkedIdeas.map((idea) => (
                  <div
                    key={idea.id}
                    className="rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50/80 dark:bg-navy-900/60 px-3 py-2.5"
                  >
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                      {idea.title}
                    </div>
                    {idea.body && (
                      <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                        {idea.body}
                      </div>
                    )}
                    {idea.tags && idea.tags.length > 0 && (
                      <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                        {idea.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 text-[10px]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => handleInsertIdea(idea)}
                      className="mt-2 w-full text-center rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2 py-1 text-[11px] font-medium transition-colors"
                    >
                      {t('myWork.notebook.insertIdea', 'Insert into page')}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <NewPageModal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        onSelectTemplate={(tmpl) => handleNewPage(tmpl)}
      />
    </div>
  );
};
