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
  Clock,
  FileText,
  Lightbulb,
  Pen,
  Plus,
  Scale,
  Sparkles,
  Tag,
  Target,
  Trash2,
  Type,
  X,
  Zap,
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

const MATURITY_CONFIG: Record<NotebookMaturity, { dot: string; bg: string; text: string; border: string; label: string; labelPl: string; icon: string }> = {
  seed: { dot: 'bg-slate-400', bg: 'bg-slate-500/10', text: 'text-slate-500', border: 'border-slate-400/30', label: 'Seed', labelPl: 'Ziarno', icon: '🌱' },
  growing: { dot: 'bg-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30', label: 'Growing', labelPl: 'Rośnie', icon: '🌿' },
  mature: { dot: 'bg-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/30', label: 'Mature', labelPl: 'Dojrzała', icon: '🎯' },
  actionable: { dot: 'bg-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/30', label: 'Actionable', labelPl: 'Do działania', icon: '⚡' },
};

function computeMaturity(page: NotebookPage): NotebookMaturity {
  const textLen = (page.contentText || '').length;
  const tagCount = (page.tags || []).length;
  if (textLen >= 300 && tagCount >= 3) return 'actionable';
  if (textLen >= 300) return 'mature';
  if (textLen >= 100 && tagCount >= 1) return 'growing';
  return 'seed';
}

const relativeTime = (dateStr?: string): string => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
};

const wordCount = (text: string): number => {
  return text.trim().split(/\s+/).filter(Boolean).length;
};

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
/* Typography — premium feel */
.ProseMirror {
  line-height: 1.8;
  font-size: 0.9375rem;
  color: #1e293b;
  caret-color: #6366f1;
}
.dark .ProseMirror { color: #e2e8f0; caret-color: #818cf8; }
.ProseMirror h1 { font-size: 1.625rem; font-weight: 700; margin-top: 2rem; margin-bottom: 0.5rem; letter-spacing: -0.02em; }
.ProseMirror h2 { font-size: 1.325rem; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.4rem; letter-spacing: -0.01em; }
.ProseMirror h3 { font-size: 1.1rem; font-weight: 600; margin-top: 1.25rem; margin-bottom: 0.3rem; }
.ProseMirror > * + * { margin-top: 0.4rem; }
.ProseMirror p.is-editor-empty:first-child::before {
  color: #94a3b8;
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
  font-style: italic;
}
.dark .ProseMirror p.is-editor-empty:first-child::before { color: #475569; }

/* Block hover with subtle left accent */
.ProseMirror > *:not(table) {
  position: relative;
  transition: all 0.15s ease;
  border-radius: 0.375rem;
  padding-left: 0.25rem;
  border-left: 2px solid transparent;
}
.ProseMirror > *:not(table):hover {
  background-color: rgba(99,102,241,0.03);
  border-left-color: rgba(99,102,241,0.15);
}
.dark .ProseMirror > *:not(table):hover {
  background-color: rgba(99,102,241,0.05);
  border-left-color: rgba(129,140,248,0.2);
}

/* Task list — polished checkboxes */
.ProseMirror ul[data-type="taskList"] { padding-left: 0; list-style: none; }
.ProseMirror ul[data-type="taskList"] li {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.25rem 0;
}
.ProseMirror ul[data-type="taskList"] li label input[type="checkbox"] {
  accent-color: #6366f1;
  margin-top: 0.35rem;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  cursor: pointer;
}

/* Callout — glassmorphism-inspired */
.nb-callout {
  border-left: 3px solid;
  border-radius: 0.75rem;
  padding: 0.875rem 1.125rem;
  margin: 0.75rem 0;
  transition: all 0.2s ease;
  backdrop-filter: blur(4px);
}
.nb-callout:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
.nb-callout[data-variant="info"]     { border-color: #3b82f6; background: linear-gradient(135deg, #eff6ff 0%, #f0f7ff 100%); }
.nb-callout[data-variant="warning"]  { border-color: #f59e0b; background: linear-gradient(135deg, #fffbeb 0%, #fef9e7 100%); }
.nb-callout[data-variant="success"]  { border-color: #22c55e; background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); }
.nb-callout[data-variant="critical"] { border-color: #ef4444; background: linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%); }
.dark .nb-callout[data-variant="info"]     { background: linear-gradient(135deg, rgba(59,130,246,0.08), rgba(59,130,246,0.04)); }
.dark .nb-callout[data-variant="warning"]  { background: linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.04)); }
.dark .nb-callout[data-variant="success"]  { background: linear-gradient(135deg, rgba(34,197,94,0.08), rgba(34,197,94,0.04)); }
.dark .nb-callout[data-variant="critical"] { background: linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.04)); }

/* Details / Toggle — refined */
.nb-details {
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  margin: 0.75rem 0;
  overflow: hidden;
  transition: all 0.2s ease;
}
.nb-details:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.04); border-color: #cbd5e1; }
.dark .nb-details { border-color: rgba(255,255,255,0.08); }
.dark .nb-details:hover { border-color: rgba(255,255,255,0.14); }
.nb-summary {
  cursor: pointer;
  font-weight: 600;
  padding: 0.625rem 0.875rem;
  background: linear-gradient(180deg, #f8fafc, #f1f5f9);
  user-select: text;
  transition: background 0.15s;
}
.nb-summary:hover { background: linear-gradient(180deg, #f1f5f9, #e2e8f0); }
.dark .nb-summary { background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02)); }
.dark .nb-summary:hover { background: linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.04)); }
.nb-details-content { padding: 0.625rem 0.875rem 0.875rem; }

/* Table — refined styling */
.ProseMirror table {
  border-collapse: collapse;
  width: 100%;
  margin: 0.75rem 0;
  border-radius: 0.75rem;
  overflow: hidden;
  border: 1px solid #e2e8f0;
}
.dark .ProseMirror table { border-color: rgba(255,255,255,0.08); }
.ProseMirror th,
.ProseMirror td {
  border: 1px solid #e2e8f0;
  padding: 0.5rem 0.875rem;
  text-align: left;
  vertical-align: top;
}
.dark .ProseMirror th,
.dark .ProseMirror td { border-color: rgba(255,255,255,0.08); }
.ProseMirror th {
  font-weight: 600;
  font-size: 0.8125rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: linear-gradient(180deg, #f8fafc, #f1f5f9);
  color: #64748b;
}
.dark .ProseMirror th { background: rgba(255,255,255,0.04); color: #94a3b8; }

/* Code block — polished */
.ProseMirror pre {
  background: linear-gradient(135deg, #0f172a, #1e293b);
  color: #e2e8f0;
  border-radius: 0.75rem;
  padding: 1rem 1.25rem;
  font-size: 0.8125rem;
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  line-height: 1.7;
  overflow-x: auto;
  border: 1px solid rgba(255,255,255,0.06);
}
.ProseMirror code:not(pre code) {
  background: rgba(99,102,241,0.1);
  color: #6366f1;
  padding: 0.15em 0.4em;
  border-radius: 0.25rem;
  font-size: 0.875em;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}
.dark .ProseMirror code:not(pre code) { background: rgba(129,140,248,0.15); color: #a5b4fc; }

/* Horizontal rule — gradient */
.ProseMirror hr {
  border: none;
  height: 2px;
  background: linear-gradient(90deg, transparent, #e2e8f0 20%, #e2e8f0 80%, transparent);
  margin: 2rem 0;
}
.dark .ProseMirror hr { background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1) 20%, rgba(255,255,255,0.1) 80%, transparent); }

/* Blockquote */
.ProseMirror blockquote {
  border-left: 3px solid #6366f1;
  padding-left: 1rem;
  margin: 0.75rem 0;
  color: #64748b;
  font-style: italic;
}
.dark .ProseMirror blockquote { border-left-color: #818cf8; color: #94a3b8; }

/* Lists */
.ProseMirror ul, .ProseMirror ol { padding-left: 1.5rem; }
.ProseMirror li::marker { color: #6366f1; }
.dark .ProseMirror li::marker { color: #818cf8; }

/* Focus ring on editor */
.ProseMirror:focus { outline: none; }

/* Page transition animation */
@keyframes nbFadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
.nb-page-enter { animation: nbFadeIn 0.25s ease-out; }

/* Sidebar page card hover */
@keyframes nbPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
.nb-saving { animation: nbPulse 1.5s ease-in-out infinite; }

/* Notebook scrollbar */
.nb-scroll::-webkit-scrollbar { width: 4px; }
.nb-scroll::-webkit-scrollbar-track { background: transparent; }
.nb-scroll::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.2); border-radius: 4px; }
.nb-scroll::-webkit-scrollbar-thumb:hover { background: rgba(148,163,184,0.4); }

/* Welcome card hover */
.nb-welcome-card {
  transition: all 0.2s ease;
  cursor: pointer;
}
.nb-welcome-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.08);
}
.dark .nb-welcome-card:hover {
  box-shadow: 0 8px 24px rgba(0,0,0,0.3);
}
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
      <div className="w-80 shrink-0 border-r border-slate-200/80 dark:border-navy-800/80 bg-gradient-to-b from-white via-white to-slate-50/50 dark:from-navy-950 dark:via-navy-950 dark:to-navy-900/30 flex flex-col">
        {/* Sidebar header */}
        <div className="px-4 py-3 border-b border-slate-200/60 dark:border-navy-800/60">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm">
                <BookOpen size={14} className="text-white" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {t('myWork.notebook.title', 'Notebook')}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500">
                  {filteredPages.length} {isPolish ? 'stron' : 'pages'}
                </div>
              </div>
            </div>
            <button
              onClick={() => setTemplateModalOpen(true)}
              className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 transition-colors"
              title={t('myWork.notebook.new', 'New page')}
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Maturity distribution mini-bar */}
          {filteredPages.length > 0 && (
            <div className="flex items-center gap-0.5 h-1.5 rounded-full overflow-hidden bg-slate-100 dark:bg-navy-800">
              {(['actionable', 'mature', 'growing', 'seed'] as NotebookMaturity[]).map((m) => {
                const count = filteredPages.filter((p) => (p.maturity || computeMaturity(p)) === m).length;
                if (!count) return null;
                const pct = (count / filteredPages.length) * 100;
                return (
                  <div
                    key={m}
                    className={`h-full ${MATURITY_CONFIG[m].dot} transition-all duration-300`}
                    style={{ width: `${pct}%` }}
                    title={`${MATURITY_CONFIG[m].label}: ${count}`}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Page list */}
        <div className="flex-1 overflow-y-auto nb-scroll p-2 space-y-1">
          {filteredPages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-navy-800 dark:to-navy-700 flex items-center justify-center mb-3">
                <FileText size={20} className="text-slate-400" />
              </div>
              <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
                {t('myWork.notebook.empty', 'No pages yet')}
              </div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                {isPolish ? 'Utwórz pierwszą stronę' : 'Create your first page'}
              </div>
            </div>
          ) : (
            filteredPages.map((p) => {
              const isActive = p.id === activeId;
              const mat = (p.maturity as NotebookMaturity) || computeMaturity(p);
              const matCfg = MATURITY_CONFIG[mat];
              const timeAgo = relativeTime(p.updatedAt);
              return (
                <button
                  key={p.id}
                  onClick={() => setActiveId(p.id)}
                  className={`group w-full text-left rounded-xl px-3 py-2.5 transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-500/10 to-violet-500/8 border border-indigo-500/20 dark:border-indigo-400/15 shadow-sm'
                      : 'hover:bg-slate-50 dark:hover:bg-white/[0.03] border border-transparent'
                  }`}
                >
                  {/* Top row: icon + title + time */}
                  <div className="flex items-start gap-2">
                    <span className="text-lg leading-none mt-0.5 shrink-0">
                      {p.icon || matCfg.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-semibold text-[13px] truncate flex-1 ${
                          isActive ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-200'
                        }`}>
                          {p.title || (isPolish ? 'Bez tytułu' : 'Untitled')}
                        </span>
                        {timeAgo && (
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 shrink-0 tabular-nums">
                            {timeAgo}
                          </span>
                        )}
                      </div>

                      {/* Summary */}
                      {p.summary && (
                        <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500 line-clamp-1 leading-relaxed">
                          {p.summary}
                        </div>
                      )}

                      {/* Bottom row: maturity badge + tags */}
                      <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                        <span className={`inline-flex items-center gap-0.5 rounded-md ${matCfg.bg} ${matCfg.text} px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${matCfg.dot}`} />
                          {isPolish ? matCfg.labelPl : matCfg.label}
                        </span>
                        {p.tags && p.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-md bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400 px-1.5 py-0.5 text-[9px] font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                        {p.tags && p.tags.length > 2 && (
                          <span className="text-[9px] text-slate-400">+{p.tags.length - 2}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Editor + Ideas panel */}
      <div className="flex-1 flex bg-gradient-to-br from-slate-50 via-white to-slate-50/50 dark:from-navy-950 dark:via-navy-950 dark:to-navy-900/20">
        <div className="flex-1 min-w-0 flex flex-col">
          {!activePage ? (
            <div className="flex h-full items-center justify-center p-8">
              <div className="max-w-lg w-full">
                {/* Welcome hero */}
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 shadow-lg shadow-indigo-500/20 mb-4">
                    <Pen size={28} className="text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                    {isPolish ? 'Living Notebook' : 'Living Notebook'}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                    {isPolish
                      ? 'Twoje notatki rosną, łączą się i pomagają podejmować decyzje'
                      : 'Your notes grow, connect, and help you make better decisions'}
                  </p>
                </div>

                {/* Quick start templates */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {[
                    { icon: '📝', label: isPolish ? 'Pusta strona' : 'Blank page', desc: isPolish ? 'Zacznij od zera' : 'Start from scratch', id: 'blank' },
                    { icon: '🧠', label: isPolish ? 'Obserwacja strategiczna' : 'Strategic observation', desc: isPolish ? 'Zapisz insight' : 'Capture an insight', id: 'strategic' },
                    { icon: '⚠️', label: isPolish ? 'Analiza ryzyka' : 'Risk analysis', desc: isPolish ? 'Oceń zagrożenie' : 'Assess a threat', id: 'risk' },
                    { icon: '💬', label: isPolish ? 'Notatki ze spotkania' : 'Meeting notes', desc: isPolish ? 'Ustal i zapisz' : 'Capture & align', id: 'meeting' },
                  ].map((tmpl) => (
                    <button
                      key={tmpl.id}
                      onClick={() => {
                        setTemplateModalOpen(true);
                      }}
                      className="nb-welcome-card flex items-start gap-3 p-3.5 rounded-xl border border-slate-200/80 dark:border-navy-700/60 bg-white dark:bg-navy-900/50 text-left group"
                    >
                      <span className="text-2xl mt-0.5">{tmpl.icon}</span>
                      <div>
                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {tmpl.label}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                          {tmpl.desc}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* AI suggestion prompt */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/20 border border-indigo-200/50 dark:border-indigo-800/30">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
                    <Sparkles size={14} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                      {isPolish ? 'AI jest gotowe do pomocy' : 'AI is ready to assist'}
                    </div>
                    <div className="text-[11px] text-indigo-500 dark:text-indigo-400 mt-0.5">
                      {isPolish
                        ? 'Wpisz / w edytorze aby zapytać, rozwinąć lub zakwestionować pomysł'
                        : 'Type / in the editor to ask, expand, or challenge your ideas'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col nb-page-enter" key={activePage.id}>
              {/* Compact toolbar + meta strip */}
              <div className="border-b border-slate-200/60 dark:border-navy-800/60 bg-white/80 dark:bg-navy-950/80 backdrop-blur-sm">
                {/* Toolbar */}
                {editor && (
                  <NotebookToolbar
                    editor={editor}
                    onAIClick={() => setAiCommand(aiCommand ? null : 'ask')}
                  />
                )}

                {/* Meta strip: maturity + auto-summary + project + actions */}
                <div className="flex items-center gap-2 px-4 py-1.5 text-[11px]">
                  {/* Maturity badge */}
                  {(() => {
                    const mat = (activePage.maturity as NotebookMaturity) || computeMaturity(activePage);
                    const cfg = MATURITY_CONFIG[mat];
                    return (
                      <span className={`inline-flex items-center gap-1 rounded-md border ${cfg.border} ${cfg.bg} ${cfg.text} px-2 py-0.5 font-semibold uppercase tracking-wide text-[9px]`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {isPolish ? cfg.labelPl : cfg.label}
                      </span>
                    );
                  })()}

                  {/* Auto-summary */}
                  {activePage?.summary && (
                    <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 italic truncate flex-1 min-w-0">
                      <Sparkles size={10} className="shrink-0 text-violet-400" />
                      <span className="truncate">{activePage.summary}</span>
                    </div>
                  )}
                  {!activePage?.summary && <div className="flex-1" />}

                  {/* Word count */}
                  <span className="text-slate-400 dark:text-slate-500 tabular-nums shrink-0 flex items-center gap-1">
                    <Type size={9} />
                    {wordCount(activePage.contentText || extractText(activePage.contentJson))}
                  </span>

                  {/* Relative time */}
                  {activePage.updatedAt && (
                    <span className="text-slate-400 dark:text-slate-500 tabular-nums shrink-0 flex items-center gap-1">
                      <Clock size={9} />
                      {relativeTime(activePage.updatedAt)}
                    </span>
                  )}

                  {/* Delete */}
                  <button
                    onClick={handleDeletePage}
                    className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0"
                    title={t('common.delete', 'Delete')}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {/* Convert-to CTA */}
              {activePage && (activePage.maturity === 'mature' || activePage.maturity === 'actionable') && (
                <div className="px-4 py-2 border-b border-amber-200/40 dark:border-amber-800/20 bg-gradient-to-r from-amber-50/80 to-orange-50/80 dark:from-amber-950/15 dark:to-orange-950/10">
                  <div className="mx-auto max-w-4xl flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Zap size={12} className="text-amber-600 dark:text-amber-400" />
                      <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                        {isPolish ? 'Gotowa do działania' : 'Ready for action'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          trackFunnelEvent('notebook_convert_triggered', { target: 'initiative', noteId: activePage.id });
                          toast.success(isPolish ? 'Tworzenie inicjatywy z notatki…' : 'Creating initiative from note…');
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-semibold hover:bg-blue-500/20 transition-all hover:shadow-sm"
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
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold hover:bg-emerald-500/20 transition-all hover:shadow-sm"
                      >
                        <CheckSquare size={10} />
                        Task
                        <ArrowRight size={8} />
                      </button>
                      <button
                        onClick={() => {
                          trackFunnelEvent('notebook_convert_triggered', { target: 'decision', noteId: activePage.id });
                          toast.success(isPolish ? 'Tworzenie decyzji z notatki…' : 'Creating decision from note…');
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-semibold hover:bg-amber-500/20 transition-all hover:shadow-sm"
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
              <div className="flex-1 overflow-y-auto nb-scroll relative" ref={editorContainerRef}>
                <div className="mx-auto max-w-3xl px-6 py-6">
                  {/* Page icon + title — Notion-like */}
                  <div className="mb-4">
                    <div className="flex items-start gap-3 mb-1">
                      <span className="text-3xl mt-1 cursor-default select-none" title={isPolish ? 'Ikona strony' : 'Page icon'}>
                        {activePage.icon || MATURITY_CONFIG[(activePage.maturity as NotebookMaturity) || 'seed'].icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <input
                          value={title}
                          onChange={(e) => {
                            setTitle(e.target.value);
                            scheduleSave({ title: e.target.value });
                          }}
                          placeholder={isPolish ? 'Bez tytułu' : 'Untitled'}
                          className="w-full bg-transparent text-2xl font-bold text-slate-900 dark:text-white outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
                        />
                        {/* Tags inline */}
                        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                          <Tag size={11} className="text-slate-300 dark:text-slate-600 shrink-0" />
                          {pageTags.map((tag) => (
                            <span
                              key={tag}
                              className="group/tag inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400 px-2 py-0.5 text-[11px] font-medium hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                            >
                              {tag}
                              <button
                                onClick={() => handleRemoveTag(tag)}
                                className="opacity-0 group-hover/tag:opacity-100 transition-opacity hover:text-red-500"
                                aria-label={`Remove tag ${tag}`}
                              >
                                <X size={9} />
                              </button>
                            </span>
                          ))}
                          <input
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={handleTagKeyDown}
                            onBlur={handleAddTag}
                            placeholder={isPolish ? '+ tag' : '+ tag'}
                            className="min-w-[50px] max-w-[120px] bg-transparent text-[11px] text-slate-400 dark:text-slate-500 outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Subtle divider */}
                    <div className="h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-navy-700 to-transparent mt-3" />
                  </div>

                  {/* Rich editor */}
                  <EditorContent editor={editor} />
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
