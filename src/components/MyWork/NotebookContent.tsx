import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import UnderlineExt from '@tiptap/extension-underline';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Archive,
  BookOpen,
  CheckSquare,
  ChevronDown,
  Clock,
  FileText,
  Filter,
  Inbox,
  Lightbulb,
  Pen,
  Pin,
  Play,
  Plus,
  Sparkles,
  Tag,
  Trash2,
  Type,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { useAppStore } from '@/store/useAppStore';
import { buildAskAIMessage } from './shared/askAiHelper';
import type {
  NotebookCounts,
  NotebookMaturity,
  NotebookPage,
  NotebookPageStatus,
  NotebookVisibility,
} from '@/types/myWork';

import { ActionItemsPanel } from './notebook/ActionItemsPanel';
import { AIChatInlinePanel, AI_BLOCK_MIME, type ConvertTarget } from './notebook/AIChatInlinePanel';
import { AICommandPrompt } from './notebook/AICommandPrompt';
import { AITopicsPanel } from './notebook/AITopicsPanel';
import { type AICommandType, AIInlineResponse } from './notebook/AIInlineResponse';
import { ConvertChecklistModal } from './notebook/ConvertChecklistModal';
import {
  CalloutNode,
  DetailsContentNode,
  DetailsNode,
  DetailsSummaryNode,
} from './notebook/extensions';
import { NewPageModal, type PageTemplate } from './notebook/NewPageModal';
import { NotebookContextPanel } from './notebook/NotebookContextPanel';
import { NotebookToolbar } from './notebook/NotebookToolbar';
import {
  detectSlashTrigger,
  INITIAL_SLASH_STATE,
  SlashMenu,
  type SlashMenuState,
} from './notebook/SlashMenu';

interface NotebookContentProps {
  projectId?: string | null;
  searchQuery: string;
  onCountsChange?: (counts: NotebookCounts) => void;
  linkedIdeasOpen?: boolean;
  onLinkedIdeasOpenChange?: (open: boolean) => void;
  topicsOpen?: boolean;
  onTopicsOpenChange?: (open: boolean) => void;
  chatOpen?: boolean;
  onChatOpenChange?: (open: boolean) => void;
  createPageRequestId?: number;
  refreshTrigger?: number;
}

const MATURITY_CONFIG: Record<
  NotebookMaturity,
  {
    dot: string;
    bg: string;
    text: string;
    border: string;
    label: string;
    labelPl: string;
    icon: string;
  }
> = {
  seed: {
    dot: 'bg-slate-400',
    bg: 'bg-slate-500/10',
    text: 'text-slate-500',
    border: 'border-slate-400/30',
    label: 'Seed',
    labelPl: 'Ziarno',
    icon: '🌱',
  },
  growing: {
    dot: 'bg-emerald-500',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/30',
    label: 'Growing',
    labelPl: 'Rośnie',
    icon: '🌿',
  },
  mature: {
    dot: 'bg-blue-500',
    bg: 'bg-blue-500/10',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-500/30',
    label: 'Mature',
    labelPl: 'Dojrzała',
    icon: '🎯',
  },
  actionable: {
    dot: 'bg-amber-500',
    bg: 'bg-amber-500/10',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/30',
    label: 'Actionable',
    labelPl: 'Do działania',
    icon: '⚡',
  },
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
.nb-callout[data-variant="purple"]   { border-color: #a855f7; background: linear-gradient(135deg, #faf5ff 0%, #f5f0ff 100%); }
.dark .nb-callout[data-variant="info"]     { background: linear-gradient(135deg, rgba(59,130,246,0.08), rgba(59,130,246,0.04)); }
.dark .nb-callout[data-variant="warning"]  { background: linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.04)); }
.dark .nb-callout[data-variant="success"]  { background: linear-gradient(135deg, rgba(34,197,94,0.08), rgba(34,197,94,0.04)); }
.dark .nb-callout[data-variant="critical"] { background: linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.04)); }
.dark .nb-callout[data-variant="purple"]   { background: linear-gradient(135deg, rgba(168,85,247,0.12), rgba(168,85,247,0.06)); }

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

/* Link */
.ProseMirror .nb-link,
.ProseMirror a {
  color: #6366f1;
  text-decoration: underline;
  text-decoration-color: rgba(99,102,241,0.3);
  text-underline-offset: 2px;
  transition: text-decoration-color 0.15s;
  cursor: pointer;
}
.ProseMirror .nb-link:hover,
.ProseMirror a:hover { text-decoration-color: #6366f1; }
.dark .ProseMirror .nb-link,
.dark .ProseMirror a { color: #a5b4fc; text-decoration-color: rgba(165,180,252,0.3); }
.dark .ProseMirror .nb-link:hover,
.dark .ProseMirror a:hover { text-decoration-color: #a5b4fc; }

/* Highlight */
.ProseMirror mark {
  background: linear-gradient(120deg, rgba(250,204,21,0.25) 0%, rgba(250,204,21,0.4) 100%);
  border-radius: 2px;
  padding: 0.05em 0.1em;
}
.dark .ProseMirror mark { background: linear-gradient(120deg, rgba(250,204,21,0.15) 0%, rgba(250,204,21,0.25) 100%); }

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

/* Selection — persistent glow while user works with tools panel */
@keyframes nbSelectionPulse {
  0%, 100% { background-color: rgba(99,102,241,0.08); border-left-color: rgba(99,102,241,0.35); }
  50% { background-color: rgba(99,102,241,0.05); border-left-color: rgba(99,102,241,0.25); }
}
.ProseMirror .nb-active-block {
  background-color: rgba(99,102,241,0.08) !important;
  border-left-color: rgba(99,102,241,0.35) !important;
  animation: nbSelectionPulse 3s ease-in-out infinite;
  box-shadow: inset 0 0 0 1px rgba(99,102,241,0.06);
  border-radius: 0.375rem;
}
.dark .ProseMirror .nb-active-block {
  background-color: rgba(129,140,248,0.1) !important;
  border-left-color: rgba(129,140,248,0.4) !important;
}
.ProseMirror ::selection {
  background: rgba(99,102,241,0.18);
}
.dark .ProseMirror ::selection {
  background: rgba(129,140,248,0.22);
}

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
  topicsOpen,
  onTopicsOpenChange,
  chatOpen,
  onChatOpenChange,
  createPageRequestId,
  refreshTrigger,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const { emitMyWorkEvent, setChatKickoffMessage, isChatCollapsed, toggleChatCollapse } = useAppStore();
  const [pages, setPages] = useState<NotebookPage[]>([]);
  const [hasMore, setHasMore] = useState(true);
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

  // Active block highlight (7s persistence)
  const activeBlockTimer = useRef<number | null>(null);
  const lastActiveBlockEl = useRef<Element | null>(null);

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
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      UnderlineExt,
      Highlight.configure({ multicolor: false }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'nb-link' } }),
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

      // Active block highlight — keep block visually marked for 7s
      const { $from, empty } = ed.state.selection;
      if (!empty || $from.depth > 0) {
        const domNode = ed.view.domAtPos($from.before(1));
        const blockEl = domNode.node instanceof Element
          ? domNode.node
          : (domNode.node as Node).parentElement;
        const topBlock = blockEl?.closest('.ProseMirror > *');
        if (topBlock && topBlock !== lastActiveBlockEl.current) {
          lastActiveBlockEl.current?.classList.remove('nb-active-block');
          topBlock.classList.add('nb-active-block');
          lastActiveBlockEl.current = topBlock;
          if (activeBlockTimer.current) window.clearTimeout(activeBlockTimer.current);
          activeBlockTimer.current = window.setTimeout(() => {
            topBlock.classList.remove('nb-active-block');
            if (lastActiveBlockEl.current === topBlock) lastActiveBlockEl.current = null;
          }, 7000);
        } else if (topBlock && topBlock === lastActiveBlockEl.current) {
          if (activeBlockTimer.current) window.clearTimeout(activeBlockTimer.current);
          activeBlockTimer.current = window.setTimeout(() => {
            topBlock.classList.remove('nb-active-block');
            if (lastActiveBlockEl.current === topBlock) lastActiveBlockEl.current = null;
          }, 7000);
        }
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
    editor.commands.setContent(activePage.contentJson || { type: 'doc', content: [] }, {
      emitUpdate: false,
    });
    setTitle(activePage.title || '');
    setPageProjectId(activePage.projectId || '');
    setPageTags(activePage.tags || []);
  }, [activePage?.id, editor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Counts
  useEffect(() => {
    const inbox = pages.filter((p) => p.status === 'inbox').length;
    const active = pages.filter((p) => p.status === 'active').length;
    onCountsChange?.({ total: pages.length, inbox, active });
  }, [pages, onCountsChange]);

  const fetchPages = useMemo(
    () => async () => {
      try {
        const q = String(searchQuery || '').trim();
        if (q) trackFunnelEvent('notebook_search_used', { query: q });

        const list = await Api.getNotebookPages({
          projectId: projectId || undefined,
          q: q || undefined,
          limit: 50,
        });
        const arr = list || [];
        setPages(arr);
        setHasMore(arr.length >= 50);
        setActiveId((prev) => prev || arr?.[0]?.id || null);
      } catch (e) {
        console.error('Failed to load notebook pages', e);
        toast.error(t('myWork.errors.fetchFailed', 'Failed to load'));
      }
    },
    [projectId, searchQuery, t]
  );

  const loadMore = useCallback(async () => {
    try {
      const q = String(searchQuery || '').trim();
      const list = await Api.getNotebookPages({
        projectId: projectId || undefined,
        q: q || undefined,
        limit: 50,
        offset: pages.length,
      });
      const arr = list || [];
      setPages((prev) => [...prev, ...arr]);
      if (arr.length < 50) setHasMore(false);
    } catch (e) {
      console.error('Failed to load more notebook pages', e);
      toast.error(t('myWork.errors.fetchFailed', 'Failed to load'));
    }
  }, [projectId, searchQuery, pages.length, t]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages, refreshTrigger]);

  // Sidebar filters & inbox state
  const [sidebarTab, setSidebarTab] = useState<'inbox' | 'active' | 'all'>('all');
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'title'>('updated');
  const [maturityFilter, setMaturityFilter] = useState<NotebookMaturity | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);

  const inboxCount = useMemo(() => pages.filter((p) => p.status === 'inbox').length, [pages]);
  const activeCount = useMemo(() => pages.filter((p) => p.status === 'active').length, [pages]);

  const filteredPages = useMemo(() => {
    let result = [...pages];

    if (sidebarTab === 'inbox') result = result.filter((p) => p.status === 'inbox');
    else if (sidebarTab === 'active') result = result.filter((p) => p.status === 'active');

    if (maturityFilter !== 'all') result = result.filter((p) => (p.maturity || 'seed') === maturityFilter);

    result.sort((a, b) => {
      if ((a.pinned ? 1 : 0) !== (b.pinned ? 1 : 0)) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      if (sortBy === 'title') return (a.title || '').localeCompare(b.title || '');
      if (sortBy === 'created') return (b.createdAt || '').localeCompare(a.createdAt || '');
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    });

    return result;
  }, [pages, sidebarTab, sortBy, maturityFilter]);

  const handleTogglePin = useCallback(async (pageId: string) => {
    try {
      const result = await Api.pinNotebookPage(pageId);
      setPages((prev) => prev.map((p) => p.id === pageId ? { ...p, pinned: result.pinned } : p));
    } catch { toast.error('Failed to pin'); }
  }, []);

  const handleSetStatus = useCallback(async (pageId: string, status: NotebookPageStatus) => {
    try {
      await Api.setNotebookPageStatus(pageId, status);
      setPages((prev) => prev.map((p) => p.id === pageId ? { ...p, status } : p));
    } catch { toast.error('Failed to update status'); }
  }, []);

  const generateSummary = useCallback(
    (pageId: string, pageTitle: string, contentText: string) => {
      summaryAbortRef.current?.abort();
      const controller = new AbortController();
      summaryAbortRef.current = controller;

      let summaryText = '';
      Api.chatWithAIStream(
        `Summarize this note in 1-2 concise sentences (max 120 chars). Note title: "${pageTitle}". Content: ${contentText.slice(0, 1500)}`,
        [],
        (chunk) => {
          summaryText += chunk;
        },
        () => {
          const cleaned = summaryText.trim().slice(0, 200);
          if (cleaned) {
            Api.updateNotebookPage(pageId, { summary: cleaned }).catch(() => {});
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
        controller.signal
      ).catch(() => {});
    },
    [isPolish]
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

        Api.updateNotebookPage(updated.id, {
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
  const [checklistModalOpen, setChecklistModalOpen] = useState(false);
  const [actionItemsOpen, setActionItemsOpen] = useState(false);
  const [ideasOpenInternal, setIdeasOpenInternal] = useState(false);
  const ideasOpen = linkedIdeasOpen ?? ideasOpenInternal;
  const setIdeasOpen = onLinkedIdeasOpenChange ?? setIdeasOpenInternal;
  const [topicsOpenInternal, setTopicsOpenInternal] = useState(false);
  const topicsOpenResolved = topicsOpen ?? topicsOpenInternal;
  const setTopicsOpen = onTopicsOpenChange ?? setTopicsOpenInternal;
  const [chatOpenInternal, setChatOpenInternal] = useState(false);
  const chatOpenResolved = chatOpen ?? chatOpenInternal;
  const setChatOpen = onChatOpenChange ?? setChatOpenInternal;
  const aiCommandPromptInputRef = useRef<HTMLInputElement | null>(null);

  const handleNewPage = useCallback(
    async (template?: PageTemplate) => {
      try {
        const defaultTitle = template
          ? isPolish
            ? template.defaultTitlePl
            : template.defaultTitle
          : isPolish
            ? 'Nowa strona'
            : 'New page';
        const contentJson = template?.contentJson || { type: 'doc', content: [] };

        const created = await Api.createNotebookPage({
          title: defaultTitle,
          projectId: projectId || null,
          visibility: projectId ? 'project' : 'private',
          tags: [],
          contentJson,
          contentText: extractText(contentJson),
          icon: template?.defaultIcon || null,
        });

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
    [fetchPages, isPolish, projectId, t]
  );

  // Create page requested from top bar (MyWorkHub) → open template modal
  const lastCreateReqRef = useRef<number | null>(null);
  useEffect(() => {
    if (!createPageRequestId) return;
    if (lastCreateReqRef.current === createPageRequestId) return;
    lastCreateReqRef.current = createPageRequestId;
    setTemplateModalOpen(true);
  }, [createPageRequestId]);

  // Keyboard shortcuts (Cmd+Shift+N/P/K) + custom events from CommandPalette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.shiftKey && e.key === 'n') {
        e.preventDefault();
        setTemplateModalOpen(true);
      }
      if (e.metaKey && e.shiftKey && e.key === 'p') {
        e.preventDefault();
        if (activePage) handleTogglePin(activePage.id);
      }
      if (e.metaKey && e.shiftKey && e.key === 'k') {
        e.preventDefault();
        setIdeasOpen(!ideasOpen);
      }
      if (e.metaKey && e.shiftKey && e.key === 'a') {
        e.preventDefault();
        aiCommandPromptInputRef.current?.focus();
      }
      if (e.metaKey && e.shiftKey && e.key === 'Backspace') {
        e.preventDefault();
        if (editor) {
          const DELETABLE = ['callout', 'details', 'table', 'blockquote', 'horizontalRule'];
          const { $from } = editor.state.selection;
          for (let d = $from.depth; d > 0; d--) {
            const node = $from.node(d);
            if (DELETABLE.includes(node.type.name)) {
              const pos = $from.before(d);
              editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
              toast.success(isPolish ? 'Usunięto blok' : 'Block deleted');
              return;
            }
          }
        }
      }
    };
    const handleNewPage = () => setTemplateModalOpen(true);
    const handleExtractActions = () => setActionItemsOpen(true);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('notebook-new-page', handleNewPage);
    window.addEventListener('notebook-extract-actions', handleExtractActions);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('notebook-new-page', handleNewPage);
      window.removeEventListener('notebook-extract-actions', handleExtractActions);
    };
  }, [activePage, handleTogglePin, ideasOpen, setIdeasOpen, editor, isPolish]);

  // Slash-command entity creation events
  useEffect(() => {
    const handleCreateTask = async (e: Event) => {
      const { text } = (e as CustomEvent).detail || {};
      if (!activePage) return;
      try {
        const title = text?.trim() || activePage.title || 'Task from notebook';
        await Api.createPersonalTask({
          title,
          description: `From note: ${activePage.title}`,
          tags: ['from-notebook'],
        });
        emitMyWorkEvent({ type: 'item:created', entityType: 'task', entityId: activePage.id });
        toast.success(isPolish ? 'Zadanie utworzone' : 'Task created');
      } catch {
        toast.error(isPolish ? 'Nie udało się utworzyć zadania' : 'Failed to create task');
      }
    };

    const handleCreateDecision = async (e: Event) => {
      const { text } = (e as CustomEvent).detail || {};
      if (!activePage) return;
      try {
        const title = text?.trim() || activePage.title || 'Decision from notebook';
        await Api.createDecision({
          title,
          description: `From note: ${activePage.title}`,
          source_type: 'notebook',
          source_id: activePage.id,
        });
        emitMyWorkEvent({ type: 'item:created', entityType: 'decision', entityId: activePage.id });
        toast.success(isPolish ? 'Decyzja utworzona' : 'Decision created');
      } catch {
        toast.error(isPolish ? 'Nie udało się utworzyć decyzji' : 'Failed to create decision');
      }
    };

    const handleCreateIdea = async (e: Event) => {
      const { text } = (e as CustomEvent).detail || {};
      if (!activePage) return;
      try {
        const title = text?.trim() || activePage.title || 'Idea from notebook';
        await Api.createMyIdea({
          title,
          body: text || '',
          sourceType: 'notebook',
        });
        emitMyWorkEvent({ type: 'item:created', entityType: 'idea', entityId: activePage.id });
        toast.success(isPolish ? 'Pomysł zapisany' : 'Idea saved');
      } catch {
        toast.error(isPolish ? 'Nie udało się zapisać pomysłu' : 'Failed to save idea');
      }
    };

    window.addEventListener('notebook-create-task', handleCreateTask);
    window.addEventListener('notebook-create-decision', handleCreateDecision);
    window.addEventListener('notebook-create-idea', handleCreateIdea);
    return () => {
      window.removeEventListener('notebook-create-task', handleCreateTask);
      window.removeEventListener('notebook-create-decision', handleCreateDecision);
      window.removeEventListener('notebook-create-idea', handleCreateIdea);
    };
  }, [activePage, isPolish, emitMyWorkEvent]);

  // M9: Smart Note Routing — suggest conversion for mature notes
  useEffect(() => {
    if (!activePage || (activePage.maturity !== 'mature' && activePage.maturity !== 'actionable')) return;
    if (activePage.status === 'converted') return;

    const classify = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/my-work/notebook/pages/${activePage.id}/classify`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.suggestedType && data.suggestedType !== 'none') {
            const typeLabel = data.suggestedType === 'tasks' ? 'action items' : data.suggestedType;
            toast(
              (t) => (
                <div className="flex items-center gap-2">
                  <span className="text-sm">
                    {isPolish
                      ? `Ta notatka wygląda jak ${typeLabel}. Konwertować?`
                      : `This note looks like ${typeLabel}. Convert?`}
                  </span>
                  <button
                    onClick={() => {
                      toast.dismiss(t.id);
                      if (data.suggestedType === 'tasks') {
                        setActionItemsOpen(true);
                      } else {
                        window.dispatchEvent(
                          new CustomEvent(`notebook-create-${data.suggestedType}`, {
                            detail: { text: activePage.title },
                          })
                        );
                      }
                    }}
                    className="px-2 py-0.5 text-xs font-semibold rounded bg-purple-500/20 text-purple-700 hover:bg-purple-500/30"
                  >
                    {isPolish ? 'Konwertuj' : 'Convert'}
                  </button>
                </div>
              ),
              { duration: 8000 }
            );
          }
        }
      } catch {
        /* ignore classification errors */
      }
    };

    const timer = setTimeout(classify, 2000);
    return () => clearTimeout(timer);
  }, [activePage?.id, activePage?.maturity, activePage?.status, isPolish]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAskAI = () => {
    if (!activePage) return;
    setChatKickoffMessage(buildAskAIMessage({
      type: 'notebook',
      title: activePage.title || 'Untitled Note',
      description: (activePage.contentText || extractText(activePage.contentJson))?.slice(0, 500) || undefined,
    }));
    if (isChatCollapsed) toggleChatCollapse();
  };

  const handleDeletePage = async () => {
    if (!activePage) return;
    try {
      await Api.deleteNotebookPage(activePage.id);
      await fetchPages();
      toast.success(isPolish ? 'Usunięto stronę' : 'Page deleted');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to delete notebook page', e);
      toast.error(t('myWork.errors.deleteFailed', 'Failed to delete'));
    }
  };

  const handleConvertFromPanel = useCallback(
    async (target: ConvertTarget) => {
      if (!activePage) return;
      trackFunnelEvent('notebook_convert_triggered', { target, noteId: activePage.id });

      if (target === 'idea') {
        window.dispatchEvent(
          new CustomEvent('notebook-create-idea', { detail: { text: activePage.title } })
        );
        return;
      }

      if (target === 'assessment' || target === 'report' || target === 'presentation') return;

      const apiTarget = target as 'initiative' | 'task' | 'decision';
      try {
        const result = await Api.convertNotebookPage(activePage.id, apiTarget);
        const label = apiTarget === 'task' ? 'task' : apiTarget === 'decision' ? (isPolish ? 'decyzję' : 'decision') : (isPolish ? 'inicjatywę' : 'initiative');
        toast.success(
          isPolish
            ? `Utworzono ${label}: ${result.title}`
            : `Created ${apiTarget}: ${result.title}`
        );
        emitMyWorkEvent({ type: 'item:converted', entityType: 'notebook', entityId: activePage.id, meta: { target: apiTarget } });
        setPages((prev) =>
          prev.map((p) =>
            p.id === activePage.id
              ? { ...p, status: 'converted' as const, convertedTo: [...(p.convertedTo || []), { type: apiTarget, id: result.id }] }
              : p
          )
        );
      } catch (err: any) {
        toast.error(err?.message || 'Conversion failed');
      }
    },
    [activePage, isPolish, emitMyWorkEvent]
  );

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
                const count = filteredPages.filter(
                  (p) => (p.maturity || computeMaturity(p)) === m
                ).length;
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

        {/* Inbox/Active/All tab bar */}
        <div className="flex items-center border-b border-slate-200/60 dark:border-white/[0.06] px-2">
          {([
            { key: 'inbox' as const, label: 'Inbox', count: inboxCount, icon: <Inbox size={12} /> },
            { key: 'active' as const, label: isPolish ? 'Aktywne' : 'Active', count: activeCount, icon: <Play size={12} /> },
            { key: 'all' as const, label: isPolish ? 'Wszystkie' : 'All', count: pages.length, icon: <FileText size={12} /> },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSidebarTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1 py-2 text-[10px] font-semibold transition-all border-b-2 ${
                sidebarTab === tab.key
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-0.5 px-1 py-0 rounded-full text-[9px] ${
                  sidebarTab === tab.key
                    ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                    : 'bg-slate-100 dark:bg-white/[0.06] text-slate-400'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`p-1.5 rounded-md ml-1 transition-colors ${showFilters ? 'bg-indigo-500/10 text-indigo-500' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
            title={isPolish ? 'Filtry' : 'Filters'}
          >
            <Filter size={12} />
          </button>
        </div>

        {/* Filter bar (collapsible) */}
        {showFilters && (
          <div className="px-2 py-1.5 border-b border-slate-200/60 dark:border-white/[0.06] flex items-center gap-1.5 flex-wrap bg-slate-50/50 dark:bg-white/[0.01]">
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="appearance-none pl-2 pr-5 py-1 rounded-md bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/[0.08] text-[10px] text-slate-600 dark:text-slate-400 font-medium"
              >
                <option value="updated">{isPolish ? 'Ostatnio edytowane' : 'Last updated'}</option>
                <option value="created">{isPolish ? 'Data utworzenia' : 'Created'}</option>
                <option value="title">{isPolish ? 'Tytuł A-Z' : 'Title A-Z'}</option>
              </select>
              <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={maturityFilter}
                onChange={(e) => setMaturityFilter(e.target.value as any)}
                className="appearance-none pl-2 pr-5 py-1 rounded-md bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/[0.08] text-[10px] text-slate-600 dark:text-slate-400 font-medium"
              >
                <option value="all">{isPolish ? 'Wszystkie etapy' : 'All stages'}</option>
                <option value="seed">🌱 Seed</option>
                <option value="growing">🌿 Growing</option>
                <option value="mature">🌳 Mature</option>
                <option value="actionable">⚡ Actionable</option>
              </select>
              <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        )}

        {/* Page list */}
        <div className="flex-1 overflow-y-auto nb-scroll p-2 space-y-1">
          {filteredPages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-navy-800 dark:to-navy-700 flex items-center justify-center mb-3">
                <FileText size={20} className="text-slate-400" />
              </div>
              <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
                {sidebarTab === 'inbox'
                  ? (isPolish ? 'Inbox pusty!' : 'Inbox zero!')
                  : t('myWork.notebook.empty', 'No pages yet')}
              </div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                {isPolish ? 'Utwórz pierwszą stronę' : 'Create your first page'}
              </div>
            </div>
          ) : (
            <>
            {filteredPages.map((p) => {
              const isActive = p.id === activeId;
              const mat = (p.maturity as NotebookMaturity) || computeMaturity(p);
              const matCfg = MATURITY_CONFIG[mat];
              const timeAgo = relativeTime(p.updatedAt);
              const statusDot = p.status === 'inbox'
                ? 'bg-amber-400 animate-pulse'
                : p.status === 'converted'
                  ? 'bg-emerald-400'
                  : p.status === 'archived'
                    ? 'bg-slate-300 dark:bg-slate-600'
                    : 'bg-blue-400';
              return (
                <div
                  key={p.id}
                  className={`group relative rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-500/10 to-violet-500/8 border border-indigo-500/20 dark:border-indigo-400/15 shadow-sm'
                      : 'hover:bg-slate-50 dark:hover:bg-white/[0.03] border border-transparent'
                  }`}
                >
                  <button
                    onClick={() => setActiveId(p.id)}
                    className="w-full text-left px-3 py-2.5"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-lg leading-none mt-0.5 shrink-0">
                        {p.icon || matCfg.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot}`} />
                          {p.pinned && <Pin size={9} className="text-amber-500 shrink-0" />}
                          {p.visibility === 'project' && <Users size={9} className="text-blue-400 shrink-0" />}
                          <span
                            className={`font-semibold text-[13px] truncate flex-1 ${
                              isActive
                                ? 'text-indigo-700 dark:text-indigo-300'
                                : 'text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {p.title || (isPolish ? 'Bez tytułu' : 'Untitled')}
                          </span>
                          {timeAgo && (
                            <span className="text-[9px] text-slate-400 dark:text-slate-500 shrink-0 tabular-nums">
                              {timeAgo}
                            </span>
                          )}
                        </div>

                        {p.summary && (
                          <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500 line-clamp-1 leading-relaxed">
                            {p.summary}
                          </div>
                        )}

                        <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-0.5 rounded-md ${matCfg.bg} ${matCfg.text} px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${matCfg.dot}`} />
                            {isPolish ? matCfg.labelPl : matCfg.label}
                          </span>
                          {p.convertedTo && p.convertedTo.length > 0 && (
                            <span className="rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 text-[9px] font-medium">
                              ✓ {p.convertedTo[0].type}
                            </span>
                          )}
                          {p.tags &&
                            p.tags.slice(0, 2).map((tag) => (
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

                  {/* Quick triage actions on hover */}
                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-white/90 dark:bg-navy-900/90 rounded-lg shadow-sm border border-slate-200/60 dark:border-white/[0.08] px-0.5 py-0.5">
                    {p.status === 'inbox' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSetStatus(p.id, 'active'); }}
                        className="p-1 rounded text-blue-500 hover:bg-blue-500/10 transition-colors"
                        title={isPolish ? 'Zacznij pracować' : 'Start working'}
                      >
                        <Play size={10} />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleTogglePin(p.id); }}
                      className={`p-1 rounded transition-colors ${p.pinned ? 'text-amber-500 bg-amber-500/10' : 'text-slate-400 hover:text-amber-500 hover:bg-amber-500/10'}`}
                      title={isPolish ? 'Przypnij' : 'Pin'}
                    >
                      <Pin size={10} />
                    </button>
                    {p.status !== 'archived' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSetStatus(p.id, 'archived'); }}
                        className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-500/10 transition-colors"
                        title={isPolish ? 'Archiwizuj' : 'Archive'}
                      >
                        <Archive size={10} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {hasMore && (
              <button
                onClick={loadMore}
                className="w-full py-2 text-[11px] text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                {isPolish ? 'Załaduj więcej' : 'Load more'}
              </button>
            )}
            </>
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
                    {
                      icon: '📝',
                      label: isPolish ? 'Pusta strona' : 'Blank page',
                      desc: isPolish ? 'Zacznij od zera' : 'Start from scratch',
                      id: 'blank',
                    },
                    {
                      icon: '🧠',
                      label: isPolish ? 'Obserwacja strategiczna' : 'Strategic observation',
                      desc: isPolish ? 'Zapisz insight' : 'Capture an insight',
                      id: 'strategic',
                    },
                    {
                      icon: '⚠️',
                      label: isPolish ? 'Analiza ryzyka' : 'Risk analysis',
                      desc: isPolish ? 'Oceń zagrożenie' : 'Assess a threat',
                      id: 'risk',
                    },
                    {
                      icon: '💬',
                      label: isPolish ? 'Notatki ze spotkania' : 'Meeting notes',
                      desc: isPolish ? 'Ustal i zapisz' : 'Capture & align',
                      id: 'meeting',
                    },
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
              {/* Compact toolbar (text editing only) */}
              <div className="border-b border-slate-200/60 dark:border-navy-800/60 bg-white/80 dark:bg-navy-950/80 backdrop-blur-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Toolbar */}
                  {editor && <NotebookToolbar editor={editor} />}
                </div>
              </div>

              {/* AI Command Prompt — hidden; accessible via Tools panel Command button */}
              {editor && activePage && (
                <div className="sr-only" aria-hidden="true">
                  <AICommandPrompt
                    editor={editor}
                    noteTitle={title}
                    noteContent={activePage.contentText || extractText(activePage.contentJson)}
                    noteTags={pageTags}
                    inputRef={aiCommandPromptInputRef}
                    className="max-w-2xl"
                  />
                </div>
              )}

              {/* Editor area — drop zone for AI block */}
              <div
                className="flex-1 overflow-y-auto nb-scroll relative"
                ref={editorContainerRef}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes(AI_BLOCK_MIME)) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'copy';
                  }
                }}
                onDrop={(e) => {
                  const text = e.dataTransfer.getData(AI_BLOCK_MIME);
                  if (text) {
                    e.preventDefault();
                    e.stopPropagation();
                    window.dispatchEvent(new CustomEvent('notebook-ai-block-drop', { detail: { text } }));
                  }
                }}
              >
                <div className="mx-auto max-w-5xl px-6 py-6">
                  {/* Page icon + title — Notion-like */}
                  <div className="mb-4">
                    <div className="flex items-start gap-3 mb-1">
                      <span
                        className="text-3xl mt-1 cursor-default select-none"
                        title={isPolish ? 'Ikona strony' : 'Page icon'}
                      >
                        {activePage.icon ||
                          MATURITY_CONFIG[(activePage.maturity as NotebookMaturity) || 'seed'].icon}
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
                        editor
                          .chain()
                          .focus()
                          .insertContent({
                            type: 'paragraph',
                            content: [{ type: 'text', text }],
                          })
                          .run();
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

        {/* Unified context panel (Ideas + Initiatives + Tasks + Decisions + Notes) */}
        {ideasOpen && activePage && (
          <NotebookContextPanel
            open={ideasOpen}
            onClose={() => setIdeasOpen(false)}
            editor={editor}
            noteId={activePage.id}
            noteTitle={title}
            noteTags={pageTags}
            allNotes={pages}
          />
        )}

        {/* AI Action Items right panel */}
        {actionItemsOpen && activePage && (
          <ActionItemsPanel
            open={actionItemsOpen}
            onClose={() => setActionItemsOpen(false)}
            noteId={activePage.id}
            noteTitle={activePage.title}
          />
        )}

        {/* AI Topics to analyze right panel */}
        {topicsOpenResolved && activePage && editor && (
          <AITopicsPanel
            open={topicsOpenResolved}
            onClose={() => setTopicsOpen(false)}
            noteId={activePage.id}
            noteTitle={title}
            noteTags={pageTags}
            contentText={activePage.contentText || extractText(activePage.contentJson)}
            editor={editor}
          />
        )}

        {/* AI Chat inline panel */}
        {chatOpenResolved && activePage && editor && (
          <AIChatInlinePanel
            open={chatOpenResolved}
            onClose={() => setChatOpen(false)}
            editor={editor}
            noteTitle={title}
            noteContent={activePage.contentText || extractText(activePage.contentJson)}
            noteTags={pageTags}
            page={{
              id: activePage.id,
              maturity:
                (activePage.maturity as NotebookMaturity) || computeMaturity(activePage),
              summary: activePage.summary,
              updatedAt: activePage.updatedAt,
              visibility: (activePage.visibility as NotebookVisibility) || 'private',
              projectId: activePage.projectId,
              wordCount: wordCount(activePage.contentText || extractText(activePage.contentJson)),
            }}
            onAskAI={handleAskAI}
            onDeletePage={handleDeletePage}
            onSetVisibility={(next) => {
              if (!activePage) return;
              if (next === 'private') {
                scheduleSave({ projectId: null, visibility: 'private' });
                setPages((prev) =>
                  prev.map((p) =>
                    p.id === activePage.id ? { ...p, projectId: null, visibility: 'private' } : p
                  )
                );
                return;
              }
              if (activePage.projectId) {
                scheduleSave({ visibility: 'project' });
                setPages((prev) =>
                  prev.map((p) =>
                    p.id === activePage.id ? { ...p, visibility: 'project' } : p
                  )
                );
              }
            }}
            getRelativeTime={(iso) => relativeTime(iso)}
            onOpenAIChat={() => setChatOpen(true)}
            onFocusAICommand={() => aiCommandPromptInputRef.current?.focus()}
            onConvert={handleConvertFromPanel}
          />
        )}
      </div>

      <NewPageModal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        onSelectTemplate={(tmpl) => handleNewPage(tmpl)}
      />

      {activePage && (
        <ConvertChecklistModal
          open={checklistModalOpen}
          onClose={() => setChecklistModalOpen(false)}
          contentJson={activePage.contentJson}
          noteId={activePage.id}
          noteTitle={activePage.title}
          onConverted={() => fetchPages()}
        />
      )}
    </div>
  );
};
