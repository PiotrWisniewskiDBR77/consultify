import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import TextAlign from '@tiptap/extension-text-align';
import UnderlineExt from '@tiptap/extension-underline';
import { TextSelection } from '@tiptap/pm/state';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  Clock,
  FileText,
  Layers,
  Lightbulb,
  Lock,
  MoreHorizontal,
  Network,
  Paperclip,
  Pen,
  Pin,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Tag,
  Trash2,
  Type,
  Unlink,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/primitives/Button';
import { useIsMobile } from '@/hooks/useDeviceType';
import { Api } from '@/services/api';
import * as apiModule from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { useAppStore } from '@/store/useAppStore';
import type {
  NotebookCounts,
  NotebookMaturity,
  NotebookPage,
  NotebookPageStatus,
  NotebookReviewCadence,
  NotebookVerificationStatus,
  NotebookVisibility,
} from '@/types/myWork';

import i18n from '../../i18n';
import { ConvertToOutputMenu } from './ConvertToOutputMenu';
import { AI_BLOCK_MIME, type ConvertTarget } from './notebook/AIChatInlinePanel';
import { AICommandPrompt } from './notebook/AICommandPrompt';
import { type AICommandType, AIInlineResponse } from './notebook/AIInlineResponse';
import { ConvertChecklistModal } from './notebook/ConvertChecklistModal';
import {
  CalloutNode,
  DetailsContentNode,
  DetailsNode,
  DetailsSummaryNode,
  EmbeddedRefNode,
  NOTEBOOK_CODE_LANGUAGES,
  NotebookBookmark,
  NotebookCodeBlock,
  NotebookImage,
} from './notebook/extensions';
import { NewPageModal, type PageTemplate } from './notebook/NewPageModal';
import { NotebookAttachmentsSection } from './notebook/NotebookAttachmentsSection';
import { NotebookBacklinksBar } from './notebook/NotebookBacklinksBar';
import { NotebookBubbleToolbar } from './notebook/NotebookBubbleToolbar';
import { getNotebookUploadSourceSummary } from './notebook/notebookCaptureSourceSummary';
import { getNotebookConvertedOutputSummary } from './notebook/notebookConvertedOutputSummary';
import { expandNotebookPageToCanvasDraft } from './notebook/notebookExpandToDocument';
import { NotebookExportMenu } from './notebook/NotebookExportMenu';
import { NotebookGraphView } from './notebook/NotebookGraphView';
import {
  type NotebookConvertTarget,
  NotebookHamburgerMenu,
} from './notebook/NotebookHamburgerMenu';
import { NotebookInlineAIMenu } from './notebook/NotebookInlineAIMenu';
import {
  detectMentionTrigger,
  INITIAL_MENTION_STATE,
  type MentionEntity,
  mentionEntityToEmbedRef,
  type MentionMenuState,
  NotebookMentionMenu,
} from './notebook/NotebookMentionMenu';
import { NotebookPresenceStack } from './notebook/NotebookPresenceStack';
import { NotebookProgressChip } from './notebook/NotebookProgressChip';
import { NotebookQuickCapture } from './notebook/NotebookQuickCapture';
import { NotebookReminderChip } from './notebook/NotebookReminderChip';
import { NotebookRightRail } from './notebook/NotebookRightRail';
import { NotebookToolbar } from './notebook/NotebookToolbar';
import { NotebookTopicChips } from './notebook/NotebookTopicChips';
import { NotebookTopicView } from './notebook/NotebookTopicView';
import { NotebookVersionHistory } from './notebook/NotebookVersionHistory';
import { CoverImageBar, IconPickerButton } from './notebook/NoteCoverPicker';
import {
  detectSlashTrigger,
  INITIAL_SLASH_STATE,
  SlashMenu,
  type SlashMenuState,
} from './notebook/SlashMenu';
import { NotebookSearchDialog } from './notebook/NotebookSearchDialog';
import { useNotebookPresence } from './notebook/useNotebookPresence';
import { NotebookHeaderActions } from './NotebookHeaderActions';
import { buildAskAIMessage } from './shared/askAiHelper';

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
  openPageId?: string | null;
  /** L1 container this workspace is scoped to (Notatnik). */
  notebookId?: string | null;
  notebookTitle?: string;
  /** Return to the notebook library (L1). When set, a back button is shown. */
  onBackToLibrary?: () => void;
  /** External page-status filter driven by Menu 3 in MyWorkHub (L2). */
  pageStatusFilter?: 'all' | 'inbox' | 'active';
  onPageStatusFilterChange?: (filter: 'all' | 'inbox' | 'active') => void;
}

type NotebookAIProposal = {
  id: string;
  pageId: string;
  proposalType: 'insert' | 'replace' | 'append';
  blockContent: Record<string, any>;
  rationale?: string;
  status: 'proposed' | 'accepted' | 'rejected';
  createdAt?: string;
};

type NotebookHeading = {
  level: number;
  text: string;
  pos: number;
};

type EmbeddedRefPreview = {
  artifactType: string;
  artifactId: string;
  title: string;
  status?: string;
  snippet?: string;
  updatedAt?: string;
};

type OutlineDraft = {
  target: 'report' | 'presentation' | 'assessment';
  title: string;
  outline: string;
  assessmentType: 'DRD' | 'SIRI' | 'ADMA' | 'CMMI' | 'LEAN';
};

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

const getDeliverableGuardMessage = (isPolish: boolean) =>
  i18n.t(
    'notebook.notebookContent.label',
    'Refine the note first: add more content or a clearer outline before converting it into a deliverable.'
  );

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

const extractHeadings = (json: any): NotebookHeading[] => {
  const headings: NotebookHeading[] = [];
  let cursor = 1;
  try {
    const walk = (node: any) => {
      if (!node || typeof node !== 'object') return;
      const nodeSize = typeof node.nodeSize === 'number' ? node.nodeSize : 1;
      if (node.type === 'heading') {
        const text = extractText(node);
        if (text.trim()) {
          headings.push({
            level: Number(node.attrs?.level || 1),
            text: text.trim(),
            pos: cursor,
          });
        }
      }
      if (Array.isArray(node.content)) {
        const start = cursor;
        cursor += 1;
        for (const child of node.content) {
          walk(child);
        }
        cursor = Math.max(cursor, start + nodeSize);
      } else {
        cursor += nodeSize;
      }
    };
    walk(json);
  } catch {
    return [];
  }
  return headings.slice(0, 24);
};

const buildOutlineDraft = (
  page: NotebookPage,
  target: OutlineDraft['target'],
  isPolish: boolean
): string => {
  const headings = extractHeadings(page.contentJson);
  if (headings.length > 0) {
    return headings
      .map((heading) => `${'  '.repeat(Math.max(0, heading.level - 1))}- ${heading.text}`)
      .join('\n');
  }

  const lines = (page.contentText || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);

  if (lines.length > 0) {
    return lines.map((line) => `- ${line}`).join('\n');
  }

  if (target === 'presentation') {
    return i18n.t(
      'notebook.notebookContent.outlinePresentation',
      '- Context and goal\n- Key observations\n- Business implications\n- Next steps'
    );
  }

  if (target === 'assessment') {
    return i18n.t(
      'notebook.notebookContent.outlineAssessment',
      '- Assessment scope\n- Core questions\n- Evidence to collect\n- Risk areas'
    );
  }

  return i18n.t(
    'notebook.notebookContent.outlineDefault',
    '- Executive summary\n- Problem analysis\n- Options\n- Recommendations'
  );
};

/* ------------------------------------------------------------------ */
/*  Editor styles for custom blocks                                    */
/* ------------------------------------------------------------------ */

const EDITOR_STYLES = `
/* Typography — premium feel */
.ProseMirror {
  line-height: 1.75;
  font-size: 1rem;
  color: var(--c-text);
  caret-color: #1E3A5F; /* celowy kolor edytora, brak tokenu (marka navy, nie c-info) */
}
.dark .ProseMirror { caret-color: #8EAACF; /* celowy kolor edytora, brak tokenu */ }
.ProseMirror h1 { font-size: 1.625rem; font-weight: 700; margin-top: 2rem; margin-bottom: 0.5rem; letter-spacing: -0.02em; }
.ProseMirror h2 { font-size: 1.325rem; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.4rem; letter-spacing: -0.01em; }
.ProseMirror h3 { font-size: 1.1rem; font-weight: 600; margin-top: 1.25rem; margin-bottom: 0.3rem; }
.ProseMirror > * + * { margin-top: 0.4rem; }
.ProseMirror p.is-editor-empty:first-child::before {
  color: var(--c-text-muted);
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
  font-style: italic;
}

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
  accent-color: #1E3A5F; /* celowy kolor edytora, brak tokenu */
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
/* Gradient tints (2 lekkie stopnie na wariant) celowo zostają — brak w tokenach
   odpowiednika "soft tint" dla warning/success/danger (jest tylko --c-accent-soft
   dla crimson). Border-color: info=niebieski i purple=fiolet celowo zostają
   literalne — c-info w tokenach to fiolet (#3b2883), więc "info" niebieski i
   "purple" fiolet nie mają jednoznacznego bezstratnego odpowiednika c-*. */
.nb-callout[data-variant="info"]     { border-color: #3b82f6; background: linear-gradient(135deg, #eff6ff 0%, #f0f7ff 100%); }
.nb-callout[data-variant="warning"]  { border-color: var(--c-warning); background: linear-gradient(135deg, #fffbeb 0%, #fef9e7 100%); }
.nb-callout[data-variant="success"]  { border-color: var(--c-success); background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); }
.nb-callout[data-variant="critical"] { border-color: var(--c-danger); background: linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%); }
.nb-callout[data-variant="purple"]   { border-color: #a855f7; background: linear-gradient(135deg, #faf5ff 0%, #f5f0ff 100%); }
.dark .nb-callout[data-variant="info"]     { background: linear-gradient(135deg, rgba(59,130,246,0.08), rgba(59,130,246,0.04)); }
.dark .nb-callout[data-variant="warning"]  { background: linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.04)); }
.dark .nb-callout[data-variant="success"]  { background: linear-gradient(135deg, rgba(34,197,94,0.08), rgba(34,197,94,0.04)); }
.dark .nb-callout[data-variant="critical"] { background: linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.04)); }
.dark .nb-callout[data-variant="purple"]   { background: linear-gradient(135deg, rgba(168,85,247,0.12), rgba(168,85,247,0.06)); }

/* Details / Toggle — refined */
.nb-details {
  border: 1px solid var(--c-border-subtle);
  border-radius: 0.75rem;
  margin: 0.75rem 0;
  overflow: hidden;
  transition: all 0.2s ease;
}
.nb-details:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.04); border-color: var(--c-border); }
.nb-summary {
  cursor: pointer;
  font-weight: 600;
  padding: 0.625rem 0.875rem;
  background: var(--c-surface-raised);
  user-select: text;
  transition: background 0.15s;
}
.nb-summary:hover { background: var(--c-border-subtle); }
.nb-details-content { padding: 0.625rem 0.875rem 0.875rem; }

/* Table — refined styling */
.ProseMirror table {
  border-collapse: collapse;
  width: 100%;
  margin: 0.75rem 0;
  border-radius: 0.75rem;
  overflow: hidden;
  border: 1px solid var(--c-border-subtle);
}
.ProseMirror th,
.ProseMirror td {
  border: 1px solid var(--c-border-subtle);
  padding: 0.5rem 0.875rem;
  text-align: left;
  vertical-align: top;
}
.ProseMirror th {
  font-weight: 600;
  font-size: 0.8125rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: var(--c-surface-raised);
  color: var(--c-text-muted);
}

/* Code block — polished. Background is INTENTIONALLY always-dark (code-editor
   convention) regardless of app theme, so these colors are NOT tokenized —
   var(--c-text) would go near-black in light mode and break contrast on the
   fixed-dark surface. celowy kolor edytora, brak tokenu. */
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
  background: rgba(30,58,95,0.08);
  color: #1E3A5F; /* celowy kolor edytora, brak tokenu (marka navy) */
  padding: 0.15em 0.4em;
  border-radius: 0.25rem;
  font-size: 0.875em;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}
.dark .ProseMirror code:not(pre code) { background: rgba(142,170,207,0.15); color: #AECAEF; /* celowy, brak tokenu */ }

/* Horizontal rule — gradient */
.ProseMirror hr {
  border: none;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--c-border) 20%, var(--c-border) 80%, transparent);
  margin: 2rem 0;
}

/* Blockquote */
.ProseMirror blockquote {
  border-left: 3px solid #1E3A5F; /* celowy kolor edytora, brak tokenu (marka navy) */
  padding-left: 1rem;
  margin: 0.75rem 0;
  color: var(--c-text-muted);
  font-style: italic;
}
.dark .ProseMirror blockquote { border-left-color: #6E8AAF; /* celowy, brak tokenu */ }

/* Link — celowy kolor edytora (marka navy), brak tokenu: c-info to fiolet,
   nie ma odpowiednika dla niebieskiego linku edytora. */
.ProseMirror .nb-link,
.ProseMirror a {
  color: #1E3A5F;
  text-decoration: underline;
  text-decoration-color: rgba(30,58,95,0.3);
  text-underline-offset: 2px;
  transition: text-decoration-color 0.15s;
  cursor: pointer;
}
.ProseMirror .nb-link:hover,
.ProseMirror a:hover { text-decoration-color: #1E3A5F; }
.dark .ProseMirror .nb-link,
.dark .ProseMirror a { color: #AECAEF; text-decoration-color: rgba(174,202,239,0.3); }
.dark .ProseMirror .nb-link:hover,
.dark .ProseMirror a:hover { text-decoration-color: #AECAEF; }

/* Highlight */
.ProseMirror mark {
  background: linear-gradient(120deg, rgba(250,204,21,0.25) 0%, rgba(250,204,21,0.4) 100%);
  border-radius: 2px;
  padding: 0.05em 0.1em;
}
.dark .ProseMirror mark { background: linear-gradient(120deg, rgba(250,204,21,0.15) 0%, rgba(250,204,21,0.25) 100%); }

/* Lists */
.ProseMirror ul, .ProseMirror ol { padding-left: 1.5rem; }
.ProseMirror li::marker { color: #1E3A5F; /* celowy kolor edytora, brak tokenu */ }
.dark .ProseMirror li::marker { color: #8EAACF; /* celowy, brak tokenu */ }

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

/* Inline images */
.ProseMirror img.nb-image,
.ProseMirror img {
  max-width: 100%;
  height: auto;
  border-radius: 0.75rem;
  margin: 0.75rem 0;
  border: 1px solid var(--c-border-subtle);
  display: block;
}
.ProseMirror img.ProseMirror-selectednode {
  outline: 2px solid #1E3A5F; /* celowy kolor edytora, brak tokenu */
  outline-offset: 2px;
}
.dark .ProseMirror img.ProseMirror-selectednode { outline-color: #6E8AAF; /* celowy, brak tokenu */ }

/* Bookmark card (rich link preview) */
.ProseMirror a.nb-bookmark {
  display: flex;
  align-items: stretch;
  gap: 0;
  margin: 0.75rem 0;
  border: 1px solid var(--c-border-subtle);
  border-radius: 0.75rem;
  overflow: hidden;
  text-decoration: none;
  background: var(--c-surface);
  transition: border-color 0.15s, background 0.15s;
  cursor: pointer;
}
.ProseMirror a.nb-bookmark:hover { border-color: var(--c-border); background: var(--c-surface-raised); }
.ProseMirror a.nb-bookmark.ProseMirror-selectednode { outline: 2px solid #1E3A5F; outline-offset: 2px; /* celowy kolor edytora, brak tokenu */ }
.dark .ProseMirror a.nb-bookmark.ProseMirror-selectednode { outline-color: #6E8AAF; /* celowy, brak tokenu */ }
.ProseMirror .nb-bookmark-body { flex: 1 1 auto; min-width: 0; padding: 0.7rem 0.85rem; display: flex; flex-direction: column; gap: 0.2rem; }
.ProseMirror .nb-bookmark-title {
  font-weight: 600; font-size: 0.9rem; color: var(--c-text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ProseMirror .nb-bookmark-desc {
  font-size: 0.8rem; color: var(--c-text-muted); line-height: 1.35;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.ProseMirror .nb-bookmark-link { display: flex; align-items: center; gap: 0.35rem; margin-top: 0.1rem; font-size: 0.72rem; color: var(--c-text-muted); }
.ProseMirror img.nb-bookmark-favicon { width: 14px; height: 14px; margin: 0; border: none; border-radius: 3px; display: inline-block; flex: none; }
.ProseMirror .nb-bookmark-thumb { flex: none; width: 120px; align-self: stretch; }
.ProseMirror .nb-bookmark-thumb img { width: 120px; height: 100%; object-fit: cover; margin: 0; border: none; border-radius: 0; display: block; }

/* Code-block language hint */
.ProseMirror pre.nb-code-block { position: relative; }
.ProseMirror pre.nb-code-block::after {
  content: 'alt+click → język';
  position: absolute;
  top: 0.4rem;
  right: 0.75rem;
  font-size: 0.625rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(226,232,240,0.45);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s;
}
.ProseMirror pre.nb-code-block:hover::after { opacity: 1; }

/* Syntax highlighting (lowlight / highlight.js token classes) — dark code surface.
   celowe kolory edytora, brak tokenu: paleta musi zostać czytelna na STAŁE
   ciemnym tle bloku kodu niezależnie od motywu aplikacji (c-chart-* zmieniają
   się light/dark i nie gwarantują kontrastu na navy). */
.ProseMirror pre .hljs-comment,
.ProseMirror pre .hljs-quote { color: #64748b; font-style: italic; }
.ProseMirror pre .hljs-keyword,
.ProseMirror pre .hljs-selector-tag,
.ProseMirror pre .hljs-built_in { color: #93c5fd; }
.ProseMirror pre .hljs-string,
.ProseMirror pre .hljs-attr,
.ProseMirror pre .hljs-regexp { color: #86efac; }
.ProseMirror pre .hljs-number,
.ProseMirror pre .hljs-literal { color: #fcd34d; }
.ProseMirror pre .hljs-title,
.ProseMirror pre .hljs-function .hljs-title,
.ProseMirror pre .hljs-section { color: #c4b5fd; }
.ProseMirror pre .hljs-type,
.ProseMirror pre .hljs-class .hljs-title { color: #67e8f9; }
.ProseMirror pre .hljs-variable,
.ProseMirror pre .hljs-template-variable { color: #fda4af; }
.ProseMirror pre .hljs-tag,
.ProseMirror pre .hljs-name { color: #93c5fd; }
.ProseMirror pre .hljs-meta { color: #94a3b8; }
.ProseMirror pre .hljs-emphasis { font-style: italic; }
.ProseMirror pre .hljs-strong { font-weight: 700; }

/* Cover image (note header) */
.nb-cover {
  position: relative;
  width: 100%;
  height: 180px;
  border-radius: 1rem;
  overflow: hidden;
  background-size: cover;
  background-position: center;
  margin-bottom: 0.5rem;
}
.nb-cover-actions { opacity: 0; transition: opacity 0.15s; }
.nb-cover:hover .nb-cover-actions { opacity: 1; }
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
  openPageId,
  notebookId,
  notebookTitle,
  onBackToLibrary,
  pageStatusFilter,
  onPageStatusFilterChange,
}) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isPolish = i18n.language === 'pl';
  // MW-08: below this breakpoint the sidebar/editor/rail three-column layout
  // no longer fits (measured live at 375px pre-fix: editor column collapsed
  // to 25px, unusable). Same hook/threshold as MW-07's CalendarView fix.
  const isMobile = useIsMobile();
  const {
    emitMyWorkEvent,
    setChatKickoffMessage,
    isChatCollapsed,
    toggleChatCollapse,
    notebookRailOpen,
    notebookRailTab,
    setNotebookRailOpen,
    setNotebookRailTab,
    currentUser,
  } = useAppStore();
  const currentUserId = String(currentUser?.id || '');
  const currentOrganizationId = String(currentUser?.organizationId || '');
  const [pages, setPages] = useState<NotebookPage[]>([]);
  // Live mirror of `pages` for use inside stable callbacks (e.g. autosave) that
  // must read the latest optimistic-lock version without re-subscribing.
  const pagesRef = useRef<NotebookPage[]>([]);
  // Guards fetchPages() against out-of-order responses when overlapping calls
  // are in flight (explicit call-site + the dependency-driven effect) — see
  // fetchPages' own comment for the real defect this closes.
  const fetchPagesGenerationRef = useRef(0);
  const [pagesLoading, setPagesLoading] = useState(true);
  const [pagesError, setPagesError] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const activePage = useMemo(() => pages.find((p) => p.id === activeId) || null, [pages, activeId]);
  // MYW-NBK-004 — cross-notebook search dialog (Api.notebookSemanticSearch).
  const [notebookSearchDialogOpen, setNotebookSearchDialogOpen] = useState(false);
  const [notebookExportOpen, setNotebookExportOpen] = useState(false);
  // DEC-25: both 'delete' and 'expand-document' are governed-api /
  // server-receipt-required note-menu actions (notebookActionRegistry.ts) —
  // NotebookHamburgerMenu only enables them when the caller proves (via a real
  // server round-trip, not just optimistic local state) that a durable receipt
  // is obtainable for THIS actor/org/page/version. One fetch backs both flags.
  const [actionCapabilities, setActionCapabilities] = useState<{
    pageId: string;
    pageVersion: string | null;
    actorUserId: string;
    organizationId: string;
    // FIX-7 (Day 3 acceptance): the server always returned a real, per-action
    // `reason` (e.g. "Only the note owner can delete this page.") — this
    // client type just never captured it, so NotebookHamburgerMenu fell back
    // to one blanket sentence for every unavailable action regardless of why.
    delete: { allowed: boolean; reason: string | null; receiptContract: string | null };
    expandDocument: { allowed: boolean; reason: string | null; receiptContract: string | null };
  } | null>(null);
  const isCapabilityCurrent = useMemo(
    () =>
      Boolean(
        activePage &&
        actionCapabilities &&
        actionCapabilities.pageId === activePage.id &&
        actionCapabilities.actorUserId === currentUserId &&
        actionCapabilities.organizationId === currentOrganizationId &&
        (!activePage.updatedAt ||
          (actionCapabilities.pageVersion !== null &&
            new Date(actionCapabilities.pageVersion).getTime() ===
              new Date(activePage.updatedAt).getTime()))
      ),
    [activePage, actionCapabilities, currentOrganizationId, currentUserId]
  );
  const isDeleteReceiptCapable = useMemo(
    () =>
      Boolean(
        isCapabilityCurrent &&
        actionCapabilities?.delete.allowed === true &&
        actionCapabilities.delete.receiptContract === 'notebook_delete_receipt_v1'
      ),
    [actionCapabilities, isCapabilityCurrent]
  );
  const isExpandDocumentReceiptCapable = useMemo(
    () =>
      Boolean(
        isCapabilityCurrent &&
        actionCapabilities?.expandDocument.allowed === true &&
        actionCapabilities.expandDocument.receiptContract === 'notebook_expand_document_receipt_v1'
      ),
    [actionCapabilities, isCapabilityCurrent]
  );
  const attemptedOpenPageRef = useRef<string | null>(null);

  useEffect(() => {
    const pageId = activePage?.id;
    const pageVersion = activePage?.updatedAt || null;
    if (!pageId || !currentUserId || !currentOrganizationId) {
      setActionCapabilities(null);
      return;
    }
    let cancelled = false;
    setActionCapabilities(null);
    void Api.getNotebookActionCapabilities(pageId)
      .then((result) => {
        if (cancelled) return;
        const versionMatches =
          pageVersion === null ||
          (result.pageVersion !== null &&
            new Date(result.pageVersion).getTime() === new Date(pageVersion).getTime());
        if (
          result.pageId !== pageId ||
          result.actorUserId !== currentUserId ||
          result.organizationId !== currentOrganizationId ||
          !versionMatches
        ) {
          return;
        }
        setActionCapabilities({
          pageId: result.pageId,
          pageVersion: result.pageVersion,
          actorUserId: result.actorUserId,
          organizationId: result.organizationId,
          delete: {
            allowed: result.actions.delete.allowed,
            reason: result.actions.delete.reason ?? null,
            receiptContract: result.actions.delete.receiptContract,
          },
          expandDocument: {
            allowed: result.actions.expandDocument.allowed,
            reason: result.actions.expandDocument.reason ?? null,
            receiptContract: result.actions.expandDocument.receiptContract,
          },
        });
      })
      .catch(() => {
        if (!cancelled) setActionCapabilities(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activePage?.id, activePage?.updatedAt, currentOrganizationId, currentUserId]);

  // #23 Notatnik-centrum-myśli — live presence for the open note. Reuses the Deck
  // presence protocol (/ws/notebook/:noteId). Fail-open to solo: no token /
  // gateway down → renders nothing, never blocks editing.
  const presenceUser = useMemo(
    () =>
      currentUser
        ? {
            userId: currentUserId,
            name:
              [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ').trim() ||
              currentUser.email ||
              'User',
            avatarUrl: currentUser.avatarUrl,
          }
        : null,
    [currentUser, currentUserId]
  );
  const notebookPresence = useNotebookPresence(activePage?.id ?? null, presenceUser, true);

  // Keep the ref in sync so autosave can read the freshest updatedAt token.
  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  // Allow external navigation to a specific note (e.g. from origin badges / backlinks)
  useEffect(() => {
    const targetId = String(openPageId || '').trim();
    if (!targetId) return;
    attemptedOpenPageRef.current = null;
  }, [openPageId]);

  useEffect(() => {
    const targetId = String(openPageId || '').trim();
    if (!targetId) return;
    let cancelled = false;
    const run = async () => {
      setActiveId(targetId);
      if (pages.some((p) => p.id === targetId)) return;
      if (attemptedOpenPageRef.current === targetId) return;
      attemptedOpenPageRef.current = targetId;
      try {
        const page = (await Api.getNotebookPage(targetId)) as any;
        if (cancelled || !page?.id) return;
        setPages((prev) => {
          const exists = prev.some((p) => p.id === page.id);
          return exists ? prev : [page as NotebookPage, ...prev];
        });
      } catch {
        if (!cancelled) {
          toast.error(
            t('notebook.notebookContent.toastError', 'Failed to open the requested note')
          );
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [openPageId, pages, isPolish]);

  const [title, setTitle] = useState(activePage?.title || '');
  const [pageProjectId, setPageProjectId] = useState(activePage?.projectId || '');
  const [pageTags, setPageTags] = useState<string[]>(activePage?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const saveTimer = useRef<number | null>(null);
  const isSavingRef = useRef(false);
  const pendingDraftRef = useRef<NotebookPage | null>(null);
  const queuedSaveRef = useRef<NotebookPage | null>(null);
  // MW-08 UX fix: every successful autosave bumps `pages[].updatedAt` to the
  // server's fresh value (below, in persistNotebookDraft) purely to keep the
  // NEXT save's optimistic-lock token correct. But the "sync editor" effect
  // is keyed on that same `activePage.updatedAt` — without these markers,
  // EVERY successful autosave would re-fire `editor.commands.setContent(...)`
  // with content that's already live in the editor, resetting the
  // ProseMirror selection (cursor jumps, e.g. to the start of the document)
  // after every autosave round-trip. Two refs are needed, not one:
  // `editorReflectsPageIdRef` — which page's content is CURRENTLY loaded in
  // the live editor, so a genuine page switch (away and back) always
  // resyncs even if `updatedAt` happens to match a stale self-save marker —
  // and `selfSavedUpdatedAtRef` — the (pageId, updatedAt) our OWN last
  // successful save just wrote, so that SPECIFIC bump can be told apart from
  // a genuinely external one (conflict-reload, another session's write).
  const editorReflectsPageIdRef = useRef<string | null>(null);
  const selfSavedUpdatedAtRef = useRef<{ pageId: string; updatedAt: string } | null>(null);

  // MW-08: explicit save-state surfaced to the user (Codex acceptance gate —
  // there was previously no visible autosave indicator at all, only a dead,
  // never-applied `.nb-saving` CSS rule). `null` = no edit made yet this
  // page-view. "saved" is set ONLY after the backend responds — never on
  // schedule/optimistically — so this can't show a premature success.
  const [saveState, setSaveState] = useState<
    'saving' | 'saved' | 'error' | 'conflict' | 'offline' | null
  >(null);
  // The owner-approved governance surface is NotebookRightRail. Keep the old
  // JSX unmounted during the migration so there is only one rendered control
  // for verification/review; remove the legacy source block in the cleanup pass.
  const showLegacyNotebookGovernanceControls: boolean = false;
  // Fresh server copy of the page returned by a 409 conflict response, kept
  // so the "Reload" action can load it without a second round-trip.
  const [conflictServerPage, setConflictServerPage] = useState<NotebookPage | null>(null);
  // Same navigator.onLine + online/offline listener pattern as
  // src/components/LLMSelector.tsx — no new hook, matches an existing
  // convention already used elsewhere in this codebase.
  const [isOnline, setIsOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // MW-08: which panel is shown at <768px, where list+editor can no longer
  // share the screen (see useIsMobile() below). Irrelevant on desktop, where
  // both panels always render. Starts on the editor when a specific page was
  // deep-linked (openPageId), otherwise on the list.
  const [mobileShowList, setMobileShowList] = useState(!openPageId);

  // Slash menu
  const [slashState, setSlashState] = useState<SlashMenuState>(INITIAL_SLASH_STATE);
  const [mentionState, setMentionState] = useState<MentionMenuState>(INITIAL_MENTION_STATE);
  // Bumped whenever this note's link graph changes, to refresh the backlinks bar.
  const [backlinksRefresh, setBacklinksRefresh] = useState(0);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [blockGutterTop, setBlockGutterTop] = useState(0);

  const notebookRailToggleRef = useRef<HTMLButtonElement>(null);

  // Inline-image upload bridge — set after the upload helper is defined so the
  // editor's paste/drop handlers (declared earlier inside useEditor) can call it.
  const uploadInlineImageRef = useRef<((file: File) => void) | null>(null);
  // K2 — fetch a URL's preview (SSRF-guarded) and insert a bookmark card.
  const insertBookmarkRef = useRef<((url: string) => void) | null>(null);
  // Hidden file input backing the slash "/image" command.
  const imageInputRef = useRef<HTMLInputElement>(null);
  // Cover image (note header) — stored server-side via notebookCover.routes.
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  // Living Notebook feature state
  const [openTopicId, setOpenTopicId] = useState<string | null>(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showGraphView, setShowGraphView] = useState(false);
  // N1: hamburger ⋯ menu position (null = closed)
  const [hamburgerPos, setHamburgerPos] = useState<{ x: number; y: number } | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  // Code-block language picker overlay anchor.
  const [codeLangMenu, setCodeLangMenu] = useState<{
    top: number;
    left: number;
    current: string;
  } | null>(null);

  // Active block highlight (7s persistence)
  const activeBlockTimer = useRef<number | null>(null);
  const lastActiveBlockEl = useRef<Element | null>(null);

  // AI inline response
  const [aiCommand, setAiCommand] = useState<AICommandType | null>(null);
  const [pendingAIProposals, setPendingAIProposals] = useState<NotebookAIProposal[]>([]);
  const [proposalLoadError, setProposalLoadError] = useState(false);
  const [selectedEmbedPreview, setSelectedEmbedPreview] = useState<EmbeddedRefPreview | null>(null);
  const [outlineDraft, setOutlineDraft] = useState<OutlineDraft | null>(null);
  const [isDownloadingSourceFile, setIsDownloadingSourceFile] = useState(false);
  const proposalReviewRef = useRef<HTMLDivElement | null>(null);
  const attachmentsSectionRef = useRef<HTMLDivElement | null>(null);
  // #19 (rewizja 07-12): scroll target for the ⋯ menu's "Verification & review"
  // item — mirrors the existing attachmentsSectionRef/onOpenAttachments pattern
  // instead of building a new panel (the N3 lifecycle strip already IS the
  // verification & review surface, just not reachable from the ⋯ menu before).
  const verificationStripRef = useRef<HTMLDivElement | null>(null);
  const proposalRequestSeqRef = useRef(0);
  const deleteRequestRef = useRef<{ pageId: string; idempotencyKey: string } | null>(null);

  // Auto-summary
  const summaryTimer = useRef<number | null>(null);
  const summaryAbortRef = useRef<AbortController | null>(null);
  const headingOutline = useMemo(
    () => (activePage?.contentJson ? extractHeadings(activePage.contentJson) : []),
    [activePage?.contentJson, activePage?.id]
  );
  const canConvertDeliverable = useMemo(() => {
    if (!activePage) return false;
    return (
      wordCount(activePage.contentText || extractText(activePage.contentJson)) >= 80 ||
      headingOutline.length >= 2
    );
  }, [activePage, headingOutline.length]);
  const deliverableGuardMessage = useMemo(() => getDeliverableGuardMessage(isPolish), [isPolish]);
  const notebookEditorExtensions = useMemo(
    () =>
      [
        // Disable StarterKit's plain codeBlock — NotebookCodeBlock (same node
        // name) replaces it with lowlight syntax highlighting + language picker.
        StarterKit.configure({ codeBlock: false }),
        NotebookCodeBlock,
        NotebookImage,
        TaskList,
        TaskItem.configure({ nested: true }),
        Placeholder.configure({
          placeholder: t(
            'notebook.notebookContent.label2',
            'Start writing… Type / to insert a block'
          ),
        }),
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        UnderlineExt,
        Highlight.configure({ multicolor: false }),
        Link.configure({ openOnClick: false, HTMLAttributes: { class: 'nb-link' } }),
        EmbeddedRefNode,
        NotebookBookmark,
        CalloutNode,
        DetailsNode,
        DetailsSummaryNode,
        DetailsContentNode,
        Table.configure({ resizable: false }),
        TableRow,
        TableHeader,
        TableCell,
      ] as any,
    [isPolish]
  );

  const editor = useEditor({
    extensions: notebookEditorExtensions,
    content: activePage?.contentJson || { type: 'doc', content: [] },
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none dark:prose-invert focus:outline-none min-h-[360px] px-3 py-3',
      },
      handleDOMEvents: {
        contextmenu: (view, event) => {
          const mouseEvent = event as MouseEvent;
          const hit = view.posAtCoords({ left: mouseEvent.clientX, top: mouseEvent.clientY });
          if (!hit) return false;
          mouseEvent.preventDefault();
          const selection = TextSelection.near(view.state.doc.resolve(hit.pos));
          view.dispatch(view.state.tr.setSelection(selection));
          setSlashState({
            open: true,
            query: '',
            triggerPos: selection.from,
            coords: { top: mouseEvent.clientY + 4, left: mouseEvent.clientX },
            mode: 'context',
          });
          return true;
        },
      },
      handleKeyDown: (view, event) => {
        if (!(event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))) return false;
        event.preventDefault();
        const from = view.state.selection.from;
        const coords = view.coordsAtPos(from);
        setSlashState({
          open: true,
          query: '',
          triggerPos: from,
          coords: { top: coords.bottom + 4, left: coords.left },
          mode: 'context',
        });
        return true;
      },
      handleClick: (_view, _pos, event) => {
        const target = event.target as HTMLElement | null;
        // Code block: alt/cmd-click the block opens the language picker.
        const pre = target?.closest?.('pre') as HTMLElement | null;
        if (pre && (event.altKey || event.metaKey)) {
          const containerRect = editorContainerRef.current?.getBoundingClientRect();
          const rect = pre.getBoundingClientRect();
          const codeEl = pre.querySelector('code');
          const current =
            codeEl
              ?.getAttribute('class')
              ?.split(/\s+/)
              .find((c) => c.startsWith('language-'))
              ?.replace('language-', '') || 'plaintext';
          setCodeLangMenu({
            top: rect.top - (containerRect?.top ?? 0) + 8,
            left: rect.left - (containerRect?.left ?? 0) + 8,
            current,
          });
          return true;
        }
        setCodeLangMenu((prev) => (prev ? null : prev));
        const chip = target?.closest?.('[data-embedded-ref]') as HTMLElement | null;
        if (!chip) return false;
        setSelectedEmbedPreview({
          artifactType: chip.getAttribute('data-artifact-type') || 'unknown',
          artifactId: chip.getAttribute('data-artifact-id') || '',
          title: chip.getAttribute('data-title') || chip.textContent || '',
          status: chip.getAttribute('data-status') || undefined,
          snippet: chip.getAttribute('data-snippet') || undefined,
          updatedAt: chip.getAttribute('data-updated-at') || undefined,
        });
        return true;
      },
      handlePaste: (view, event) => {
        const items = Array.from(event.clipboardData?.items || []);
        const imageItem = items.find((it) => it.type.startsWith('image/'));
        if (imageItem) {
          const file = imageItem.getAsFile();
          if (!file || !uploadInlineImageRef.current) return false;
          event.preventDefault();
          uploadInlineImageRef.current(file);
          return true;
        }
        // Pasting a single bare URL into an empty selection → rich bookmark card.
        // Never inside a code block — there the literal URL text is what's wanted.
        const text = (event.clipboardData?.getData('text/plain') || '').trim();
        const isBareUrl = /^https?:\/\/\S+$/i.test(text) && !/\s/.test(text);
        const inCodeBlock = view.state.selection.$from.parent.type.name === 'codeBlock';
        if (isBareUrl && !inCodeBlock && view.state.selection.empty && insertBookmarkRef.current) {
          event.preventDefault();
          insertBookmarkRef.current(text);
          return true;
        }
        return false;
      },
      handleDrop: (_view, event) => {
        const dt = (event as DragEvent).dataTransfer;
        const file = Array.from(dt?.files || []).find((f) => f.type.startsWith('image/'));
        if (!file || !uploadInlineImageRef.current) return false;
        event.preventDefault();
        uploadInlineImageRef.current(file);
        return true;
      },
    },
    onTransaction({ editor: ed }) {
      // Slash and @-mention are mutually exclusive (the cursor ends with one or
      // the other, never both). Detect slash first; fall through to mention.
      const trigger = detectSlashTrigger(ed);
      if (trigger) {
        setSlashState(trigger);
        if (mentionState.open) setMentionState(INITIAL_MENTION_STATE);
      } else {
        if (slashState.open) setSlashState(INITIAL_SLASH_STATE);
        const mention = detectMentionTrigger(ed);
        if (mention) {
          setMentionState(mention);
        } else if (mentionState.open) {
          setMentionState(INITIAL_MENTION_STATE);
        }
      }

      // Active block highlight — keep block visually marked for 7s
      const { $from, empty } = ed.state.selection;
      if (!empty || $from.depth > 0) {
        const domNode = ed.view.domAtPos($from.before(1));
        const blockEl =
          domNode.node instanceof Element ? domNode.node : (domNode.node as Node).parentElement;
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

  useEffect(() => {
    if (!editor) return;
    const update = () => {
      const container = editorContainerRef.current;
      if (!container) return;
      const caret = editor.view.coordsAtPos(editor.state.selection.from);
      const bounds = container.getBoundingClientRect();
      setBlockGutterTop(Math.max(8, caret.top - bounds.top + container.scrollTop));
    };
    update();
    editor.on('selectionUpdate', update);
    editor.on('focus', update);
    return () => {
      editor.off('selectionUpdate', update);
      editor.off('focus', update);
    };
  }, [editor]);

  // Sync editor when switching pages or when the same page gets fresher server content.
  useEffect(() => {
    if (!editor) return;
    // Tiptap can briefly expose an editor whose command bridge is not ready.
    // Accessing `editor.commands` may throw in that transition window.
    const safeSetContent = (content: unknown) => {
      try {
        editor.commands.setContent(content as any, { emitUpdate: false });
        return true;
      } catch {
        return false;
      }
    };
    if (!activePage) {
      editorReflectsPageIdRef.current = null;
      if (!safeSetContent({ type: 'doc', content: [] })) return;
      setTitle('');
      setPageProjectId('');
      setPageTags([]);
      return;
    }
    // Skip re-running setContent (which resets the ProseMirror selection)
    // ONLY when BOTH hold: (a) the editor already has THIS page loaded — a
    // genuine switch away and back must always resync, regardless of
    // updatedAt — and (b) this specific updatedAt is the one OUR OWN last
    // successful save just wrote, i.e. content already matches what's live.
    // An externally-sourced updatedAt (conflict-reload, "Save mine anyway"
    // response, another session's write) never matches (b), so those still
    // resync correctly.
    const editorAlreadyHasThisPage = editorReflectsPageIdRef.current === activePage.id;
    const isOwnAutosaveEcho =
      selfSavedUpdatedAtRef.current?.pageId === activePage.id &&
      selfSavedUpdatedAtRef.current?.updatedAt === activePage.updatedAt;
    if (editorAlreadyHasThisPage && isOwnAutosaveEcho) return;
    if (!safeSetContent(activePage.contentJson || { type: 'doc', content: [] })) return;
    editorReflectsPageIdRef.current = activePage.id;
    setTitle(activePage.title || '');
    setPageProjectId(activePage.projectId || '');
    setPageTags(activePage.tags || []);
  }, [activePage?.id, activePage?.updatedAt, editor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Counts
  useEffect(() => {
    const inbox = pages.filter((p) => p.status === 'inbox').length;
    const active = pages.filter((p) => p.status === 'active').length;
    onCountsChange?.({ total: pages.length, inbox, active });
  }, [pages, onCountsChange]);

  const fetchPages = useMemo(
    () => async () => {
      // Real defect, reproduced against Railway DEV (real network latency —
      // essentially never triggered on a near-zero-latency local backend):
      // `handleNewPage` calls `await fetchPages()` explicitly right after
      // creating a page, but the effect below ALSO calls `fetchPages()` on
      // its own dependency changes. With two overlapping calls in flight,
      // responses can arrive OUT OF ORDER — an earlier-dispatched request
      // (issued before the new page existed) resolving AFTER a later one
      // (issued after) silently overwrote `pages` with the STALE list,
      // dropping the just-created page entirely. `activePage` then never
      // pointed at the new page, and every keystroke into its title/content
      // silently no-op'd or (worse) mutated a DIFFERENT page's row — with
      // zero error, zero indication of data loss. A monotonic generation
      // counter, applied only when this call's response is still the latest
      // one issued, closes it.
      const generation = ++fetchPagesGenerationRef.current;
      try {
        const q = String(searchQuery || '').trim();
        if (q) trackFunnelEvent('notebook_search_used', { query: q });

        const list = await Api.getNotebookPages({
          projectId: projectId || undefined,
          notebookId: notebookId || undefined,
          q: q || undefined,
          limit: 50,
        });
        if (generation !== fetchPagesGenerationRef.current) return;
        const arr = list || [];
        setPages(arr);
        setHasMore(arr.length >= 50);
        setActiveId((prev) => prev || arr?.[0]?.id || null);
        setPagesError(false);
      } catch (e) {
        if (generation !== fetchPagesGenerationRef.current) return;
        console.error('Failed to load notebook pages', e);
        setPagesError(true);
        toast.error(t('myWork.errors.fetchFailed', 'Failed to load'));
      } finally {
        if (generation === fetchPagesGenerationRef.current) setPagesLoading(false);
      }
    },
    [projectId, notebookId, searchQuery, t]
  );

  const loadMore = useCallback(async () => {
    try {
      const q = String(searchQuery || '').trim();
      const list = await Api.getNotebookPages({
        projectId: projectId || undefined,
        notebookId: notebookId || undefined,
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
  }, [projectId, notebookId, searchQuery, pages.length, t]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages, refreshTrigger]);

  // #18 — orphan cleanup: page ids with zero link_graph_edges rows (no topics,
  // no @mentions, no backlinks). Org-scoped fetch, intersected client-side with
  // whatever `pages` this notebook already loaded — cheap and avoids a second
  // backend filter dimension per-notebook.
  const [orphanIds, setOrphanIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    let cancelled = false;
    void Api.getOrphanedNotebookPageIds(200).then((ids) => {
      if (!cancelled) setOrphanIds(new Set(ids));
    });
    return () => {
      cancelled = true;
    };
  }, [refreshTrigger]);
  const isOrphanedPage = useCallback((p: NotebookPage) => orphanIds.has(p.id), [orphanIds]);

  // Sidebar filters & inbox state
  // Status axis (Wszystkie/Inbox/Aktywne) is owned by Menu 3 in the hub — the
  // in-column tab bar that used to duplicate it is gone (N5/U11).
  const [statusTab, setStatusTab] = useState<'inbox' | 'active' | 'all'>(pageStatusFilter ?? 'all');
  useEffect(() => {
    if (pageStatusFilter !== undefined) setStatusTab(pageStatusFilter);
  }, [pageStatusFilter]);

  // N5 left-column lenses (independent of the status axis):
  //  • scope — who owns the page (mine vs the rest of the team)
  //  • view  — flattened "Today" sections (pinned / recent / to-review / fresh / orphaned)
  type NotebookScopeLens = 'all' | 'mine' | 'team';
  type NotebookViewLens = 'all' | 'pinned' | 'recent' | 'toReview' | 'fresh' | 'orphaned';
  const [scopeLens, setScopeLens] = useState<NotebookScopeLens>('all');
  const [viewLens, setViewLens] = useState<NotebookViewLens>('all');

  const isMinePage = useCallback(
    (p: NotebookPage) => !p.ownerUserId || p.ownerUserId === currentUserId,
    [currentUserId]
  );
  // A page is "to review" when its knowledge is disputed/stale or still in inbox.
  const isToReviewPage = useCallback(
    (p: NotebookPage) => p.verificationStatus === 'disputed' || !!p.staleAt || p.status === 'inbox',
    []
  );
  // "Fresh" = arrived via a capture source (quick-capture, email, file, canvas).
  const isFreshPage = useCallback(
    (p: NotebookPage) => !!(p.captureSource || p.captureMetadata?.captureSource),
    []
  );
  // "Recent" = touched within the last 7 days.
  const isRecentPage = useCallback((p: NotebookPage) => {
    if (!p.updatedAt) return false;
    const t = new Date(p.updatedAt).getTime();
    if (Number.isNaN(t)) return false;
    return Date.now() - t <= 7 * 24 * 60 * 60 * 1000;
  }, []);

  const matchesView = useCallback(
    (p: NotebookPage, lens: NotebookViewLens) => {
      if (lens === 'pinned') return !!p.pinned;
      if (lens === 'recent') return isRecentPage(p);
      if (lens === 'toReview') return isToReviewPage(p);
      if (lens === 'fresh') return isFreshPage(p);
      if (lens === 'orphaned') return isOrphanedPage(p);
      return true;
    },
    [isRecentPage, isToReviewPage, isFreshPage, isOrphanedPage]
  );

  // Pages after the status (Menu 3) + scope lens — the base the view chips count against.
  const scopedPages = useMemo(() => {
    let result = [...pages];
    if (statusTab === 'inbox') result = result.filter((p) => p.status === 'inbox');
    else if (statusTab === 'active') result = result.filter((p) => p.status === 'active');
    if (scopeLens === 'mine') result = result.filter(isMinePage);
    else if (scopeLens === 'team') result = result.filter((p) => !isMinePage(p));
    return result;
  }, [pages, statusTab, scopeLens, isMinePage]);

  const viewCounts = useMemo(
    () => ({
      all: scopedPages.length,
      pinned: scopedPages.filter((p) => p.pinned).length,
      recent: scopedPages.filter(isRecentPage).length,
      toReview: scopedPages.filter(isToReviewPage).length,
      fresh: scopedPages.filter(isFreshPage).length,
      orphaned: scopedPages.filter(isOrphanedPage).length,
    }),
    [scopedPages, isRecentPage, isToReviewPage, isFreshPage, isOrphanedPage]
  );

  const teamPagesExist = useMemo(() => pages.some((p) => !isMinePage(p)), [pages, isMinePage]);

  const filteredPages = useMemo(() => {
    const result = scopedPages.filter((p) => matchesView(p, viewLens));
    result.sort((a, b) => {
      if ((a.pinned ? 1 : 0) !== (b.pinned ? 1 : 0)) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    });
    return result;
  }, [scopedPages, viewLens, matchesView]);

  const handleTogglePin = useCallback(async (pageId: string) => {
    try {
      const result = await Api.pinNotebookPage(pageId);
      setPages((prev) => prev.map((p) => (p.id === pageId ? { ...p, pinned: result.pinned } : p)));
    } catch {
      toast.error(t('myWork.notebookContent.toast.pinFailed', 'Failed to pin'));
    }
  }, []);

  const handleSetStatus = useCallback(async (pageId: string, status: NotebookPageStatus) => {
    try {
      await Api.setNotebookPageStatus(pageId, status);
      setPages((prev) => prev.map((p) => (p.id === pageId ? { ...p, status } : p)));
    } catch {
      toast.error(t('myWork.notebookContent.toast.statusUpdateFailed', 'Failed to update status'));
    }
  }, []);

  // K1 @mention: replace the "@query" with an embeddedRef to the chosen entity
  // and record a link-graph edge (note → entity) so the mention is bidirectional
  // — the entity gains a backlink to this note (visible in its Context panel).
  const handleMentionSelect = useCallback(
    (entity: MentionEntity) => {
      if (!editor || !activePage) return;
      // Delete the literal "@query" deterministically from the trigger position
      // (length = 1 for "@" + the query). Reading editor.state.selection here is
      // fragile — clicking the menu can collapse/reset the editor selection,
      // yielding to < from and a no-op deleteRange.
      const from = mentionState.triggerPos;
      const to = from + 1 + mentionState.query.length;
      const ref = mentionEntityToEmbedRef(entity, isPolish);
      editor
        .chain()
        .focus()
        .deleteRange({ from, to })
        .insertContent({ type: 'embeddedRef', attrs: { ...ref, updatedAt: '' } })
        .insertContent({ type: 'text', text: ' ' })
        .run();
      setMentionState(INITIAL_MENTION_STATE);

      Api.createLinkGraphEdge({
        source: { type: 'notebook', id: activePage.id },
        target: { type: entity.type, id: entity.id },
        relation: 'ref',
        context: { containerType: 'notebook_mention', containerId: activePage.id },
      }).catch(() => undefined);

      // A mention is an OUTGOING edge (note → entity): it makes this note a
      // backlink of the entity, but does not change this note's own incoming
      // "Mentioned in" list — so we don't bump backlinksRefresh here. Just nudge
      // the side Context panel.
      emitMyWorkEvent({ type: 'item:updated', entityType: 'notebook', entityId: activePage.id });
      toast.success(t('notebook.notebookContent.toastSuccess', 'Linked'));
    },
    [editor, activePage, mentionState.triggerPos, mentionState.query, isPolish, emitMyWorkEvent]
  );

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
        t(
          'notebook.notebookContent.label3',
          'Provide a summary in 1-2 concise sentences (max 120 chars). Respond ONLY with the summary, no commentary.'
        ),
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

  const persistNotebookDraft = useCallback(
    async (draft: NotebookPage) => {
      queuedSaveRef.current = draft;
      if (isSavingRef.current) return;

      while (queuedSaveRef.current) {
        const nextDraft = queuedSaveRef.current;
        queuedSaveRef.current = null;

        // Don't even attempt the request while offline — it would just fail
        // and read as a generic error. Keep the draft queued (not lost) so
        // reconnecting resumes the save automatically (see the `isOnline`
        // effect below), and tell the user plainly instead of guessing.
        if (!navigator.onLine) {
          queuedSaveRef.current = nextDraft;
          setSaveState('offline');
          return;
        }

        isSavingRef.current = true;
        // Visible from the moment the request actually starts, not from the
        // debounce schedule — "Saving" means a save is in flight, not merely
        // pending. setSaveState('saved') below only happens after `await`
        // resolves, so this can never show a premature success.
        setSaveState('saving');

        trackFunnelEvent('notebook_page_edited', { pageId: nextDraft.id });

        const newMaturity = computeMaturity(nextDraft);
        const persistedDraft: NotebookPage = { ...nextDraft, maturity: newMaturity };

        // Optimistic-lock token: the updatedAt this draft was based on. We read
        // it from the last-known server state for this page so the backend can
        // detect if the row moved on elsewhere and reject last-write-wins.
        const knownUpdatedAt =
          pagesRef.current.find((p) => p.id === persistedDraft.id)?.updatedAt ??
          persistedDraft.updatedAt;

        try {
          const saved = await Api.updateNotebookPage(persistedDraft.id, {
            title: persistedDraft.title,
            projectId: persistedDraft.projectId,
            visibility: persistedDraft.visibility,
            tags: persistedDraft.tags,
            contentJson: persistedDraft.contentJson,
            contentText: persistedDraft.contentText,
            maturity: newMaturity,
            ...(knownUpdatedAt && { expectedUpdatedAt: knownUpdatedAt }),
            ...(persistedDraft.icon !== undefined && { icon: persistedDraft.icon }),
            ...(persistedDraft.verificationStatus !== undefined && {
              verificationStatus: persistedDraft.verificationStatus,
            }),
            ...(persistedDraft.reviewCadence !== undefined && {
              reviewCadence: persistedDraft.reviewCadence,
            }),
            ...(persistedDraft.lastReviewedAt !== undefined && {
              lastReviewedAt: persistedDraft.lastReviewedAt,
            }),
            ...(persistedDraft.staleAt !== undefined && {
              staleAt: persistedDraft.staleAt,
            }),
          });

          // Advance the local optimistic-lock token to the server's new value so
          // the next autosave carries the correct expected version.
          const savedUpdatedAt = (saved as NotebookPage | undefined)?.updatedAt;
          if (savedUpdatedAt) {
            // Mark this exact bump as OUR OWN save landing (see
            // `selfSavedUpdatedAtRef`'s declaration) so the "sync editor"
            // effect doesn't call setContent again and reset the cursor for
            // content that's already correctly live in the editor.
            selfSavedUpdatedAtRef.current = {
              pageId: persistedDraft.id,
              updatedAt: savedUpdatedAt,
            };
            setPages((prev) =>
              prev.map((p) =>
                p.id === persistedDraft.id ? { ...p, updatedAt: savedUpdatedAt } : p
              )
            );
          }
          // Only reachable after the backend has actually responded — the
          // golden-flow requirement this exists for ("sees Saving, and Saved
          // only after the backend responds").
          setSaveState('saved');
          setConflictServerPage(null);

          const textLen = (persistedDraft.contentText || '').length;
          if (textLen > 200 && persistedDraft.id) {
            if (summaryTimer.current) window.clearTimeout(summaryTimer.current);
            summaryTimer.current = window.setTimeout(() => {
              generateSummary(
                persistedDraft.id,
                persistedDraft.title,
                persistedDraft.contentText || ''
              );
            }, 3000);
          }
        } catch (e) {
          // `handleResponse` (src/services/api/baseClient.ts) sets `err.data` to
          // the FULL parsed response body, not the fresh row directly. The v8
          // conflict route (server/src/routes/v8/my-work.routes.ts) replies with
          // `{ error, code, data: freshRow, meta }`, so the fresh row lives one
          // level deeper at `err.data.data`. Confirmed against baseClient's
          // `err.data = data` assignment and the route's 409 payload — reading
          // `err.data` directly here would silently pick up the envelope
          // instead of the page, leaving `conflictServerPage.updatedAt`/
          // `.contentJson` always undefined (the token would never advance and
          // Reload would merge garbage fields into `pages`).
          const err = e as {
            status?: number;
            code?: string;
            data?: { data?: NotebookPage | null };
          };
          if (err?.status === 409 || err?.code === 'NOTEBOOK_PAGE_CONFLICT') {
            // Someone else (another tab/device/session) saved this page after we
            // loaded it. Do NOT silently overwrite their work. Sync our local
            // optimistic-lock token to the server's latest so the user can
            // reload/merge, and surface a non-destructive toast. Their unsaved
            // edits remain in the editor until they choose to reload.
            const serverPage = err?.data?.data ?? null;
            if (serverPage?.updatedAt) {
              // Advance the optimistic-lock token in the ref mirror ONLY (not
              // the rendered `pages` state) so a "Save mine anyway" retry can
              // send the correct expectedUpdatedAt without prematurely
              // changing activePage.updatedAt. If this used setPages here,
              // activePage.updatedAt would already equal the server's value
              // by the time handleReloadFromConflict merges the same row in —
              // the "sync editor with fresher server content" effect (keyed
              // on activePage.updatedAt) would see no change and never
              // re-fire, so clicking Reload would silently do nothing.
              pagesRef.current = pagesRef.current.map((p) =>
                p.id === persistedDraft.id ? { ...p, updatedAt: serverPage.updatedAt } : p
              );
            }
            // Persistent state (not just a toast, which fades) so the user
            // can't miss it and always has an explicit way out — the
            // acceptance gate this exists for: "UI never silently overwrites
            // a conflict, shows Reload/retry."
            setSaveState('conflict');
            setConflictServerPage(serverPage);
            toast.error(
              t(
                'notebook.notebookContent.toastError2',
                'This page was changed elsewhere. Reload to merge — your edits were not overwritten.'
              ),
              { duration: 8000 }
            );
          } else {
            // eslint-disable-next-line no-console
            console.error('Failed to save notebook page', e);
            setSaveState('error');
            toast.error(t('myWork.errors.updateFailed', 'Failed to update'));
          }
        } finally {
          isSavingRef.current = false;
        }
      }
    },
    [generateSummary, t, isPolish]
  );

  // Resume a save that was held back by the offline guard above, the moment
  // connectivity returns — the draft was never lost, only queued.
  useEffect(() => {
    if (isOnline && queuedSaveRef.current) {
      void persistNotebookDraft(queuedSaveRef.current);
    }
  }, [isOnline, persistNotebookDraft]);

  const flushPendingSave = useCallback(async () => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const pendingDraft = pendingDraftRef.current;
    if (!pendingDraft) return;
    pendingDraftRef.current = null;
    await persistNotebookDraft(pendingDraft);
  }, [persistNotebookDraft]);

  const scheduleSave = useCallback(
    (next: Partial<NotebookPage>) => {
      if (!activePage) return;
      const base = pages.find((p) => p.id === activePage.id);
      if (!base) return;

      const updated: NotebookPage = {
        ...base,
        ...next,
      };
      updated.maturity = computeMaturity(updated);

      pendingDraftRef.current = updated;
      setPages((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));

      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        const draft = pendingDraftRef.current;
        pendingDraftRef.current = null;
        saveTimer.current = null;
        if (!draft) return;
        void persistNotebookDraft(draft);
      }, 350);
    },
    [activePage, pages, persistNotebookDraft]
  );

  // Conflict recovery (MW-08 acceptance gate: no silent overwrite, explicit
  // Reload/retry). `conflictServerPage` is the fresh row the 409 response
  // already carried — no second fetch needed. Merging it into `pages` is
  // enough: the existing "sync editor when the active page gets fresher
  // server content" effect (keyed on activePage.updatedAt) picks it up and
  // resets the editor/title/tags for us.
  const handleReloadFromConflict = useCallback(() => {
    if (!activePage || !conflictServerPage) return;
    setPages((prev) =>
      prev.map((p) => (p.id === activePage.id ? { ...p, ...conflictServerPage } : p))
    );
    setSaveState(null);
    setConflictServerPage(null);
  }, [activePage, conflictServerPage]);

  // Explicit, user-initiated overwrite of the server's newer content with
  // what's currently in the editor — safe to retry because the conflict
  // handler already advanced the local optimistic-lock token to match the
  // server's latest `updatedAt`, so this attempt is not blind.
  const handleRetryAfterConflict = useCallback(() => {
    if (!activePage) return;
    const current = pages.find((p) => p.id === activePage.id);
    if (!current) return;
    setSaveState(null);
    setConflictServerPage(null);
    void persistNotebookDraft(current);
  }, [activePage, pages, persistNotebookDraft]);

  const handleRetrySave = useCallback(() => {
    if (!activePage) return;
    const current = pages.find((page) => page.id === activePage.id);
    if (!current) return;
    void persistNotebookDraft(current);
  }, [activePage, pages, persistNotebookDraft]);

  // Reset the indicator when switching notes — a "Saved"/"Conflict" left
  // over from the PREVIOUS page must never bleed into the newly opened one.
  useEffect(() => {
    setSaveState(null);
    setConflictServerPage(null);
  }, [activePage?.id]);

  // MW-08 mobile view switch: whenever a DIFFERENT page becomes active (any
  // selection path — page-list row, new-page creation, mention/backlink
  // jump, hamburger convert — there are half a dozen call sites for
  // `setActiveId`), show the editor instead of the list on mobile. Reactive
  // on the id itself rather than patching every call site, so this can't
  // miss one; tapping "back to list" doesn't change activeId, so it isn't
  // fought by this effect.
  useEffect(() => {
    if (isMobile && activePage) setMobileShowList(false);
  }, [isMobile, activePage?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [checklistModalOpen, setChecklistModalOpen] = useState(false);

  // L-03: Rail replaces individual panel flags. Keep local flags for legacy event
  // compatibility (notebook-extract-actions, keyboard shortcuts) but route them
  // to open the rail at the appropriate tab.
  const setActionItemsOpen = (open: boolean) => {
    if (open) {
      setNotebookRailOpen(true);
      setNotebookRailTab('work');
    }
  };

  const [ideasOpenInternal, setIdeasOpenInternal] = useState(false);
  // Ideas ("context" tab) can be driven externally (linkedIdeasOpen prop) or via the rail.
  const ideasOpen = linkedIdeasOpen ?? ideasOpenInternal;
  const setIdeasOpen = (open: boolean) => {
    if (onLinkedIdeasOpenChange) {
      onLinkedIdeasOpenChange(open);
    } else {
      setIdeasOpenInternal(open);
    }
    if (open) {
      setNotebookRailOpen(true);
      setNotebookRailTab('context');
    }
  };

  // Topics/chat panel: external props still honored (fire callbacks), but visually
  // routed to the consolidated rail "work" tab.
  const setTopicsOpen = (open: boolean) => {
    if (onTopicsOpenChange) onTopicsOpenChange(open);
    if (open) {
      setNotebookRailOpen(true);
      setNotebookRailTab('work');
    }
  };

  const setChatOpen = (open: boolean) => {
    if (onChatOpenChange) onChatOpenChange(open);
    if (open) {
      setNotebookRailOpen(true);
      setNotebookRailTab('work');
    }
  };
  const aiCommandPromptInputRef = useRef<HTMLInputElement | null>(null);

  // MYW-NBK-004 — open a page found via cross-notebook search. Mirrors the
  // `openPageId` prop's own fetch-if-missing effect above: a search hit can
  // live in a different notebook/project than the one currently scoped here,
  // so it may not already be in `pages`. Api.getNotebookPage(id) resolves it
  // by id regardless of the current notebookId/projectId filter.
  const handleOpenSearchResult = useCallback(
    async (pageId: string) => {
      setActiveId(pageId);
      if (pagesRef.current.some((p) => p.id === pageId)) return;
      try {
        const page = (await Api.getNotebookPage(pageId)) as any;
        if (!page?.id) return;
        setPages((prev) =>
          prev.some((p) => p.id === page.id) ? prev : [page as NotebookPage, ...prev]
        );
      } catch {
        toast.error(t('notebook.notebookContent.toastError', 'Failed to open the requested note'));
      }
    },
    [t]
  );

  const handleNewPage = useCallback(
    async (template?: PageTemplate) => {
      try {
        await flushPendingSave();
        const defaultTitle = template
          ? isPolish
            ? template.defaultTitlePl
            : template.defaultTitle
          : t('notebook.notebookContent.label5', 'New page');
        const contentJson = template?.contentJson || { type: 'doc', content: [] };

        const created = await Api.createNotebookPage({
          title: defaultTitle,
          projectId: projectId || null,
          notebookId: notebookId || undefined,
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

        // Real defect, reproduced against Railway DEV (real network latency —
        // near-invisible on a near-zero-latency local backend, where the gap
        // below is ~1-5ms instead of the ~100-200ms measured against a real
        // remote Postgres): `await fetchPages()` used to run BEFORE
        // `setActiveId(created.id)`, so for the full round-trip of that list
        // refetch, `activePage` still pointed at the PREVIOUSLY open page —
        // typing during that window (a fast typist, or any programmatic
        // client) silently landed on and mutated the WRONG page's row, not
        // the one just created. `created` is already the server's own
        // confirmed row from the POST above, the same shape `fetchPages()`
        // itself would return for this row — insert it directly and switch
        // immediately, no second round-trip required before it's safe to
        // type. A separate `fetchPages()` call here was ALSO found to race
        // an immediately-following rename: its full-list-replace could land
        // between the rename's optimistic local update and its PUT
        // response, overwriting the sidebar with the pre-rename snapshot.
        // Not calling it removes that race entirely rather than reordering
        // around it — nothing else in this flow needs a second read of a
        // row we already have in full from the write that just created it.
        if (created?.id) {
          setPages((prev) => (prev.some((p) => p.id === created.id) ? prev : [created, ...prev]));
          setActiveId(created.id);
        }
        toast.success(t('notebook.notebookContent.toastSuccess2', 'Page created'));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to create notebook page', e);
        toast.error(t('myWork.errors.createFailed', 'Failed to create'));
      }
    },
    [fetchPages, flushPendingSave, isPolish, projectId, t]
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
              editor
                .chain()
                .focus()
                .deleteRange({ from: pos, to: pos + node.nodeSize })
                .run();
              toast.success(t('notebook.notebookContent.toastSuccess3', 'Block deleted'));
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
        const created = await Api.createPersonalTask({
          title,
          description: `From note: ${activePage.title}`,
          tags: ['from-notebook'],
          sourceType: 'notebook',
          sourceId: activePage.id,
        });
        const createdId = String(created?.id || '').trim();
        if (createdId) {
          try {
            await Api.createLinkGraphEdge({
              source: { type: 'task', id: createdId },
              target: { type: 'notebook', id: activePage.id },
              relation: 'ref',
              context: { containerType: 'notebook_slash', containerId: activePage.id },
            });
          } catch {
            /* best-effort */
          }
          // Incoming edge (task → note) → refresh this note's "Mentioned in" bar.
          setBacklinksRefresh((k) => k + 1);
        }
        emitMyWorkEvent({
          type: 'item:created',
          entityType: 'task',
          entityId: createdId || activePage.id,
        });
        toast.success(t('notebook.notebookContent.toastSuccess4', 'Task created'));
      } catch {
        toast.error(t('notebook.notebookContent.toastError3', 'Failed to create task'));
      }
    };

    const handleCreateDecision = async (e: Event) => {
      const { text } = (e as CustomEvent).detail || {};
      if (!activePage) return;
      try {
        const title = text?.trim() || activePage.title || 'Decision from notebook';
        const created = await Api.createDecision({
          title,
          description: `From note: ${activePage.title}`,
          source_type: 'notebook',
          source_id: activePage.id,
        });
        const createdId = String(created?.id || '').trim();
        if (createdId) {
          try {
            await Api.createLinkGraphEdge({
              source: { type: 'decision', id: createdId },
              target: { type: 'notebook', id: activePage.id },
              relation: 'ref',
              context: { containerType: 'notebook_slash', containerId: activePage.id },
            });
          } catch {
            /* best-effort */
          }
          setBacklinksRefresh((k) => k + 1);
        }
        emitMyWorkEvent({
          type: 'item:created',
          entityType: 'decision',
          entityId: createdId || activePage.id,
        });
        toast.success(t('notebook.notebookContent.toastSuccess5', 'Decision created'));
      } catch {
        toast.error(t('notebook.notebookContent.toastError4', 'Failed to create decision'));
      }
    };

    const handleCreateIdea = async (e: Event) => {
      const { text } = (e as CustomEvent).detail || {};
      if (!activePage) return;
      try {
        const title = text?.trim() || activePage.title || 'Idea from notebook';
        const created = await Api.createMyIdea({
          title,
          body: text || '',
          sourceType: 'notebook',
          sourceConversationId: activePage.id,
          sourceMessageId: null,
        });
        const createdId = String(created?.id || '').trim();
        if (createdId) {
          try {
            await Api.createLinkGraphEdge({
              source: { type: 'idea', id: createdId },
              target: { type: 'notebook', id: activePage.id },
              relation: 'ref',
              context: { containerType: 'notebook_slash', containerId: activePage.id },
            });
          } catch {
            /* best-effort */
          }
          setBacklinksRefresh((k) => k + 1);
        }
        emitMyWorkEvent({
          type: 'item:created',
          entityType: 'idea',
          entityId: createdId || activePage.id,
        });
        toast.success(t('notebook.notebookContent.toastSuccess6', 'Idea saved'));
      } catch {
        toast.error(t('notebook.notebookContent.toastError5', 'Failed to save idea'));
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
    if (!activePage || (activePage.maturity !== 'mature' && activePage.maturity !== 'actionable'))
      return;
    if (activePage.status === 'converted') return;

    const classify = async () => {
      try {
        const data = await Api.classifyNotebookPage(activePage.id);
        if (data.suggestedType && data.suggestedType !== 'none') {
          const typeLabel = data.suggestedType === 'tasks' ? 'action items' : data.suggestedType;
          toast(
            (t) => (
              <div className="flex items-center gap-2">
                <span className="text-sm">
                  {i18n.t(
                    'notebook.notebookContent.classifyPrompt',
                    'This note looks like {{typeLabel}}. Convert?',
                    {
                      typeLabel,
                    }
                  )}
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
                  className="px-2 py-0.5 text-xs font-semibold rounded bg-c-surface-raised text-c-text hover:bg-c-surface-raised"
                >
                  {i18n.t('notebook.notebookContent.label6', 'Convert')}
                </button>
              </div>
            ),
            { duration: 8000 }
          );
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
    setChatKickoffMessage(
      buildAskAIMessage({
        type: 'notebook',
        title: activePage.title || 'Untitled Note',
        description:
          (activePage.contentText || extractText(activePage.contentJson))?.slice(0, 500) ||
          undefined,
      })
    );
    if (isChatCollapsed) toggleChatCollapse();
  };

  // Share via email — mirrors WorkspaceTools ShareSection.handleEmail so the ⋯ menu
  // exposes the same action as the Tools panel (canon: "Note" group parity, audit #19).
  const handleShareEmail = () => {
    if (!activePage) return;
    const noteTitle = title || activePage.title || t('notebook.notebookContent.label7', 'Note');
    const noteBody = (activePage.contentText || extractText(activePage.contentJson) || '').trim();
    const subject = encodeURIComponent(noteTitle);
    const body = encodeURIComponent(
      `${noteTitle}\n${'—'.repeat(30)}\n\n${noteBody.slice(0, 5000)}\n\n—\n${t('notebook.notebookContent.label8', 'Sent from Consultify')}`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    trackFunnelEvent('notebook_share_email', {});
    toast.success(t('notebook.notebookContent.toastSuccess7', 'Email client opened'));
  };

  const handleDeletePage = async () => {
    if (!activePage) return;
    if (!isDeleteReceiptCapable) {
      throw new Error('Notebook delete capability is unavailable or stale');
    }
    const request =
      deleteRequestRef.current?.pageId === activePage.id
        ? deleteRequestRef.current
        : {
            pageId: activePage.id,
            idempotencyKey: globalThis.crypto.randomUUID(),
          };
    deleteRequestRef.current = request;
    try {
      const receipt = await Api.deleteNotebookPage(
        activePage.id,
        request.idempotencyKey,
        activePage.updatedAt
      );
      const readBack = await Api.getNotebookActionReceipt(receipt.receiptId);
      if (
        readBack.receiptId !== receipt.receiptId ||
        readBack.resourceId !== activePage.id ||
        readBack.action !== 'NOTEBOOK_PAGE_DELETED'
      ) {
        throw new Error('Notebook delete receipt readback mismatch');
      }
      deleteRequestRef.current = null;
      await fetchPages();
      toast.success(t('notebook.notebookContent.toastSuccess8', 'Page deleted'));
      return receipt;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to delete notebook page', e);
      toast.error(t('myWork.errors.deleteFailed', 'Failed to delete'));
      throw e;
    }
  };

  const handleDownloadSourceFile = useCallback(async () => {
    if (!activePage?.id || isDownloadingSourceFile) return;
    setIsDownloadingSourceFile(true);
    try {
      const { blob, filename } = await Api.downloadNotebookSourceFile(activePage.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t('notebook.notebookContent.toastError6', 'Failed to download source file'));
    } finally {
      setIsDownloadingSourceFile(false);
    }
  }, [activePage?.id, isDownloadingSourceFile, isPolish]);

  const handleUploadNotebookAttachments = useCallback(
    async (files: FileList) => {
      if (!activePage?.id) return;
      try {
        const updated = await Api.uploadNotebookAttachments(activePage.id, files);
        if (!updated?.id) return;
        setPages((prev) => prev.map((page) => (page.id === updated.id ? updated : page)));
      } catch (error) {
        console.error('Failed to upload notebook attachments', error);
        toast.error(t('notebook.notebookContent.toastError7', 'Failed to upload attachments'));
      }
    },
    [activePage?.id, isPolish]
  );

  // Inline image: optimistically insert a local data: URL, then upload the file
  // as an attachment so it persists. We keep the data: URL in the content (the
  // attachment endpoint serves auth-gated blobs, not public srcs) — this means
  // the image survives reload because it lives inside contentJson.
  const uploadInlineImage = useCallback(
    (file: File) => {
      if (!editor) return;
      if (!file.type.startsWith('image/')) return;
      if (file.size > 5 * 1024 * 1024) {
        toast.error(t('notebook.notebookContent.toastError8', 'Image is too large (max 5 MB)'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        if (!dataUrl.startsWith('data:image/')) return;
        editor
          .chain()
          .focus()
          .setImage({ src: dataUrl, alt: file.name } as any)
          .createParagraphNear()
          .run();
      };
      reader.onerror = () => {
        toast.error(t('notebook.notebookContent.toastError9', 'Failed to load image'));
      };
      reader.readAsDataURL(file);

      // Best-effort: also archive the original as a page attachment for provenance.
      // Failure here does not affect the inline image already in the document.
      if (activePage?.id) {
        void Api.uploadNotebookAttachments(activePage.id, [file])
          .then((updated) => {
            if (updated?.id) {
              setPages((prev) => prev.map((page) => (page.id === updated.id ? updated : page)));
            }
          })
          .catch((error) => {
            console.error('Failed to archive inline image as attachment', error);
          });
      }
    },
    [editor, activePage?.id, isPolish]
  );

  useEffect(() => {
    uploadInlineImageRef.current = uploadInlineImage;
  }, [uploadInlineImage]);

  // K2 — turn a URL into a rich bookmark card: fetch OG metadata via the
  // SSRF-guarded /api/link-preview, then insert the bookmark node. On failure
  // we still insert a bookmark with just the URL (degrades, never blocks).
  const insertBookmarkFromUrl = useCallback(
    (rawUrl: string) => {
      if (!editor) return;
      const url = rawUrl.trim();
      if (!/^https?:\/\//i.test(url)) return;
      const toastId = toast.loading(
        t('notebook.notebookContent.toastLoading', 'Fetching preview…')
      );
      fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((meta) => {
          toast.dismiss(toastId);
          (editor.commands as any).setBookmark({
            url,
            title: meta?.ogTitle || '',
            description: meta?.ogDescription || '',
            image: meta?.ogImage || '',
            favicon: meta?.favicon || '',
          });
        })
        .catch(() => {
          toast.dismiss(toastId);
          (editor.commands as any).setBookmark({ url });
        });
    },
    [editor, isPolish]
  );

  useEffect(() => {
    insertBookmarkRef.current = insertBookmarkFromUrl;
  }, [insertBookmarkFromUrl]);

  // Slash "/image" command → open the hidden file picker.
  useEffect(() => {
    const openPicker = () => imageInputRef.current?.click();
    window.addEventListener('notebook-insert-image', openPicker);
    return () => window.removeEventListener('notebook-insert-image', openPicker);
  }, []);

  // Load the cover for the active page (round-trips via notebookCover.routes —
  // the main notebook list SELECT does not carry cover_url).
  useEffect(() => {
    setCoverUrl(null);
    const id = activePage?.id;
    if (!id) return;
    // Guard: skip when the API surface is unavailable (e.g. mocked in unit tests)
    // so we never fire a real fetch under fake timers.
    const { API_URL, getHeaders } = apiModule;
    if (typeof getHeaders !== 'function' || !API_URL) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${API_URL}/v8/notebook/pages/${encodeURIComponent(id)}/cover`, {
          headers: getHeaders(),
        });
        if (!res.ok || cancelled) return;
        const json = await res.json();
        if (!cancelled) setCoverUrl(json?.data?.coverUrl ?? null);
      } catch {
        /* cover is non-critical chrome — fail silently */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activePage?.id]);

  const persistCover = useCallback(
    async (nextCover: string | null) => {
      const id = activePage?.id;
      if (!id) return;
      const previous = coverUrl;
      setCoverUrl(nextCover); // optimistic
      const { API_URL, getHeaders } = apiModule;
      if (typeof getHeaders !== 'function' || !API_URL) return;
      try {
        const res = await fetch(`${API_URL}/v8/notebook/pages/${encodeURIComponent(id)}/cover`, {
          method: 'PUT',
          headers: { ...getHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ coverUrl: nextCover }),
        });
        if (!res.ok) throw new Error(String(res.status));
      } catch {
        setCoverUrl(previous); // rollback
        toast.error(t('notebook.notebookContent.toastError10', 'Failed to save cover'));
      }
    },
    [activePage?.id, coverUrl, isPolish]
  );

  const handlePickCover = useCallback(() => coverInputRef.current?.click(), []);

  const handleCoverFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) return;
      if (file.size > 5 * 1024 * 1024) {
        toast.error(t('notebook.notebookContent.toastError11', 'Cover is too large (max 5 MB)'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        if (dataUrl.startsWith('data:image/')) void persistCover(dataUrl);
      };
      reader.readAsDataURL(file);
    },
    [persistCover, isPolish]
  );

  const handleChangeIcon = useCallback(
    (icon: string | null) => {
      if (!activePage) return;
      setPages((prev) =>
        prev.map((page) => (page.id === activePage.id ? { ...page, icon } : page))
      );
      scheduleSave({ icon });
    },
    [activePage, scheduleSave] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleDeleteNotebookAttachment = useCallback(
    async (attachmentId: string) => {
      if (!activePage?.id) return;
      try {
        const updated = await Api.deleteNotebookAttachment(activePage.id, attachmentId);
        if (!updated?.id) return;
        setPages((prev) => prev.map((page) => (page.id === updated.id ? updated : page)));
      } catch (error) {
        console.error('Failed to delete notebook attachment', error);
        toast.error(t('notebook.notebookContent.toastError12', 'Failed to delete attachment'));
      }
    },
    [activePage?.id, isPolish]
  );

  const refreshAIProposals = useCallback(
    async (pageId: string) => {
      const requestSeq = ++proposalRequestSeqRef.current;
      try {
        setProposalLoadError(false);
        const result = await Api.notebookGetAIProposals(pageId, { status: 'proposed', limit: 20 });
        if (proposalRequestSeqRef.current !== requestSeq) return;
        const proposals = Array.isArray((result as any)?.proposals)
          ? ((result as any).proposals as NotebookAIProposal[])
          : Array.isArray(result)
            ? (result as NotebookAIProposal[])
            : [];
        setPendingAIProposals(proposals);
        setProposalLoadError(false);
      } catch (error) {
        if (proposalRequestSeqRef.current !== requestSeq) return;
        console.error('Failed to refresh notebook AI proposals', error);
        setProposalLoadError(true);
        setPendingAIProposals([]);
        toast.error(t('notebook.notebookContent.toastError13', 'Failed to refresh AI proposals'));
      }
    },
    [isPolish]
  );

  useEffect(() => {
    if (!activePage?.id) {
      setPendingAIProposals([]);
      return;
    }
    setSelectedEmbedPreview(null);
    void refreshAIProposals(activePage.id);
  }, [activePage?.id, refreshAIProposals]);

  const submitNotebookAIProposal = useCallback(
    async (text: string, rationale: string, label?: string) => {
      if (!activePage) return;
      const titleLabel = label || t('notebook.notebookContent.label9', 'AI comment');
      const paragraphs = text
        .split(/\n\n+/)
        .map((part) => part.trim())
        .filter(Boolean);
      if (paragraphs.length === 0) return;
      try {
        await Api.notebookCreateAIProposal(activePage.id, {
          proposalType: 'append',
          rationale,
          blockContent: {
            type: 'callout',
            attrs: { variant: 'purple' },
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: `✨ ${titleLabel}` }],
              },
              ...paragraphs.map((paragraph) => ({
                type: 'paragraph',
                content: [{ type: 'text', text: paragraph }],
              })),
            ],
          },
        });
        await refreshAIProposals(activePage.id);
        toast.success(t('notebook.notebookContent.toastSuccess9', 'AI proposal ready for review'));
      } catch (error) {
        console.error('Failed to create notebook AI proposal', error);
        toast.error(t('notebook.notebookContent.toastError14', 'Failed to create AI proposal'));
      }
    },
    [activePage, isPolish, refreshAIProposals]
  );

  const resolveNotebookAIProposal = useCallback(
    async (proposalId: string, action: 'accepted' | 'rejected') => {
      if (!activePage) return;
      try {
        await Api.notebookResolveAIProposal(proposalId, action);
        await Promise.all([refreshAIProposals(activePage.id), fetchPages()]);
        toast.success(
          action === 'accepted'
            ? t('notebook.notebookContent.label10', 'Proposal accepted')
            : t('notebook.notebookContent.label11', 'Proposal rejected')
        );
      } catch (error) {
        console.error('Failed to resolve notebook AI proposal', error);
        toast.error(
          action === 'accepted'
            ? t('notebook.notebookContent.label12', 'Failed to accept proposal')
            : t('notebook.notebookContent.label13', 'Failed to reject proposal')
        );
      }
    },
    [activePage, fetchPages, isPolish, refreshAIProposals]
  );

  const handleConvertFromPanel = useCallback(
    async (target: ConvertTarget) => {
      if (!activePage) return;
      trackFunnelEvent('notebook_convert_triggered', { target, noteId: activePage.id });
      trackFunnelEvent('mywork_convert_clicked', { from: 'notebook', to: target });

      if (target === 'idea') {
        window.dispatchEvent(
          new CustomEvent('notebook-create-idea', { detail: { text: activePage.title } })
        );
        return;
      }

      if (target === 'assessment' || target === 'report' || target === 'presentation') {
        if (!canConvertDeliverable) {
          toast.error(deliverableGuardMessage);
          return;
        }
        setOutlineDraft({
          target,
          title: activePage.title || t('notebook.notebookContent.label14', 'New deliverable'),
          outline: buildOutlineDraft(activePage, target, isPolish),
          assessmentType: 'DRD',
        });
        return;
      }

      const apiTarget = target as 'initiative' | 'task' | 'decision' | 'report' | 'presentation';
      try {
        const result = await Api.convertNotebookPage(activePage.id, apiTarget);
        const label =
          apiTarget === 'task'
            ? t('notebook.notebookContent.label15', 'task')
            : apiTarget === 'decision'
              ? t('notebook.notebookContent.label16', 'decision')
              : apiTarget === 'report'
                ? t('notebook.notebookContent.label17', 'report')
                : apiTarget === 'presentation'
                  ? t('notebook.notebookContent.label18', 'presentation')
                  : t('notebook.notebookContent.label19', 'initiative');
        toast.success(
          t('notebook.notebookContent.convertedToast', 'Created {{target}}: {{title}}', {
            target: label,
            title: result.title,
          })
        );
        emitMyWorkEvent({
          type: 'item:converted',
          entityType: 'notebook',
          entityId: activePage.id,
          meta: { target: apiTarget },
        });
        trackFunnelEvent('mywork_convert_completed', {
          from: 'notebook',
          toType: apiTarget,
          has_source: true,
        });
        if (result.sourceSessionId) {
          trackFunnelEvent('mywork_session_materialized', {
            source: 'notebook_convert',
            sourceEntityId: activePage.id,
            target: apiTarget,
            sessionId: result.sourceSessionId,
          });
        }
        setPages((prev) =>
          prev.map((p) =>
            p.id === activePage.id
              ? {
                  ...p,
                  status: 'converted' as const,
                  convertedTo: [...(p.convertedTo || []), { type: apiTarget, id: result.id }],
                }
              : p
          )
        );
      } catch (err: any) {
        toast.error(err?.message || 'Conversion failed');
        throw err;
      }
    },
    [activePage, canConvertDeliverable, deliverableGuardMessage, isPolish, emitMyWorkEvent]
  );

  // C3 (KROK 6): "Rozwiń w dokument" — copy the note into a Work Canvas draft
  // (provenance: notebook-expand, D-C-2 copy-no-sync) and open /chat split-view.
  const [isExpandingToDocument, setIsExpandingToDocument] = useState(false);
  const handleExpandToDocument = useCallback(async () => {
    if (!activePage || isExpandingToDocument) return;
    setIsExpandingToDocument(true);
    trackFunnelEvent('notebook_convert_triggered', {
      target: 'canvas-document',
      noteId: activePage.id,
    });
    try {
      // Prefer the live editor JSON — autosave debounces, so activePage may lag.
      const contentJson = editor?.getJSON() ?? activePage.contentJson;
      const result = await expandNotebookPageToCanvasDraft({
        id: activePage.id,
        title: title || activePage.title || '',
        contentJson,
        contentText: activePage.contentText,
      });
      toast.success(
        t('notebook.notebookContent.toastSuccess10', 'Document draft created in Canvas')
      );
      navigate(result.chatUrl);
      // DEC-25: NotebookHamburgerMenu's executeAction() requires a `receiptId`
      // on the resolved value for every 'server-receipt-required' contract
      // (see notebookActionRegistry.ts 'expand-document') — without it the
      // menu treats the action as failed even though the draft was created.
      return result;
    } catch (error: any) {
      console.error('Failed to expand note into Canvas document', error);
      toast.error(t('notebook.notebookContent.toastError15', 'Failed to create the document'));
      throw error;
    } finally {
      setIsExpandingToDocument(false);
    }
  }, [activePage, editor, isExpandingToDocument, isPolish, navigate, title]);

  const handleHandoffInitiatives = useCallback(async () => {
    if (!activePage) return;
    try {
      await Api.convertNotebookPage(activePage.id, 'initiative', {
        title: activePage.title || t('notebook.notebookContent.label20', 'Initiative from note'),
        description: activePage.contentText?.trim() || undefined,
      });
      toast.success(t('notebook.notebookContent.toastSuccess11', 'Initiative created'));
      trackFunnelEvent('notebook_handoff', { target: 'initiatives', noteId: activePage.id });
    } catch (err: any) {
      toast.error(
        err?.message || t('notebook.notebookContent.label21', 'Failed to create initiative')
      );
    }
  }, [activePage, isPolish]);

  const handleConfirmOutlineDraft = useCallback(async () => {
    if (!activePage || !outlineDraft) return;
    const target = outlineDraft.target;
    try {
      const result = await Api.convertNotebookPage(activePage.id, target, {
        title: outlineDraft.title,
        description: outlineDraft.outline,
        assessmentType: outlineDraft.assessmentType,
      });
      const label =
        target === 'report'
          ? t('notebook.notebookContent.label22', 'report')
          : target === 'presentation'
            ? t('notebook.notebookContent.label23', 'presentation')
            : t('notebook.notebookContent.label24', 'assessment');
      toast.success(
        t('notebook.notebookContent.convertedToast2', 'Created {{target}}: {{title}}', {
          target: label,
          title: result.title,
        })
      );
      emitMyWorkEvent({
        type: 'item:converted',
        entityType: 'notebook',
        entityId: activePage.id,
        meta: { target },
      });
      setPages((prev) =>
        prev.map((page) =>
          page.id === activePage.id
            ? {
                ...page,
                status: 'converted' as const,
                convertedTo: [...(page.convertedTo || []), { type: target, id: result.id }],
              }
            : page
        )
      );
      setOutlineDraft(null);
    } catch (err: any) {
      toast.error(err?.message || t('notebook.notebookContent.label25', 'Conversion failed'));
    }
  }, [activePage, emitMyWorkEvent, isPolish, outlineDraft]);

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

  useEffect(() => {
    return () => {
      void flushPendingSave();
    };
  }, [activePage?.id, flushPendingSave]);

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
    <div className="flex h-[calc(100vh-220px)] min-h-[520px] gap-1.5 p-3 overflow-hidden bg-c-bg">
      <style>{EDITOR_STYLES}</style>

      {/* Sidebar — on mobile this is the ONLY panel shown until a note is
          opened (see mobileShowList); never mounted at all while the editor
          is showing, so its controls never sit in the mobile tab order
          (same convention as MW-07's CalendarSidebar). */}
      {(!isMobile || mobileShowList) && (
        <div
          className={
            isMobile
              ? 'w-full flex flex-col rounded-2xl border border-slate-200/60 dark:border-white/[0.03] overflow-hidden bg-c-surface'
              : 'w-80 shrink-0 rounded-2xl border border-slate-200/60 dark:border-white/[0.03] overflow-hidden bg-c-surface flex flex-col'
          }
        >
          {/* Sidebar header */}
          <div className="px-4 py-3 border-b border-c-border-subtle">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <NotebookHeaderActions
                  onBack={onBackToLibrary}
                  onNewPage={() => setTemplateModalOpen(true)}
                  onSearchAllNotebooks={() => setNotebookSearchDialogOpen(true)}
                />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-c-text truncate">
                    {notebookTitle || t('myWork.notebook.title', 'Notebook')}
                  </div>
                  <div className="text-[10px] text-c-text-secondary">
                    {filteredPages.length} {t('notebook.notebookContent.label27', 'pages')}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* N5 — Capture box: drop a thought or link straight into this notebook */}
          <div className="px-3 pt-3 pb-2 border-b border-c-border-subtle">
            <NotebookQuickCapture notebookId={notebookId} onCreated={() => void fetchPages()} />
          </div>

          {/* N5 — Scope lens (who owns the page). Auto-hides when there is nothing
            from teammates, so personal notebooks stay clutter-free. */}
          {teamPagesExist && (
            <div className="px-3 pt-2.5">
              <div className="inline-flex w-full items-center rounded-lg bg-c-surface-raised p-0.5">
                {(
                  [
                    { key: 'all', label: t('notebook.notebookContent.label28', 'All') },
                    { key: 'mine', label: t('notebook.notebookContent.label29', 'Mine') },
                    { key: 'team', label: t('notebook.notebookContent.label30', 'Team') },
                  ] as Array<{ key: NotebookScopeLens; label: string }>
                ).map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setScopeLens(s.key)}
                    className={`flex-1 rounded-md py-1 text-[11px] font-semibold transition-colors ${
                      scopeLens === s.key
                        ? 'bg-c-surface text-c-text shadow-sm'
                        : 'text-c-text-muted hover:text-c-text'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* N5 — View lens (flattened "Today" sections as chips). */}
          <div className="flex flex-wrap items-center gap-1 px-3 py-2.5 border-b border-c-border-subtle">
            {(
              [
                { key: 'all', label: t('notebook.notebookContent.label31', 'All'), icon: null },
                {
                  key: 'pinned',
                  label: t('notebook.notebookContent.label32', 'Pinned'),
                  icon: <Pin size={11} />,
                },
                {
                  key: 'recent',
                  label: t('notebook.notebookContent.label33', 'Recent'),
                  icon: <Clock size={11} />,
                },
                {
                  key: 'toReview',
                  label: t('notebook.notebookContent.label34', 'To review'),
                  icon: <AlertTriangle size={11} />,
                },
                {
                  key: 'fresh',
                  label: t('notebook.notebookContent.label35', 'Fresh'),
                  icon: <Sparkles size={11} />,
                },
                {
                  key: 'orphaned',
                  label: t('notebook.notebookContent.label36', 'Orphaned'),
                  icon: <Unlink size={11} />,
                },
              ] as Array<{ key: NotebookViewLens; label: string; icon: React.ReactNode }>
            ).map((v) => {
              const count = viewCounts[v.key];
              const active = viewLens === v.key;
              return (
                <button
                  key={v.key}
                  onClick={() => setViewLens(v.key)}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    active
                      ? 'bg-c-text text-c-surface'
                      : 'bg-c-surface-raised text-c-text-secondary hover:bg-c-surface-raised'
                  }`}
                >
                  {v.icon}
                  {v.label}
                  {v.key !== 'all' && count > 0 && (
                    <span
                      className={`rounded-full px-1 text-[9px] ${
                        active ? 'bg-c-surface/20' : 'bg-c-surface text-c-text-muted'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Page list */}
          <div className="flex-1 overflow-y-auto nb-scroll p-2 space-y-1">
            {filteredPages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-navy-800 dark:to-navy-700 flex items-center justify-center mb-3">
                  <FileText size={20} className="text-c-text-secondary" />
                </div>
                {(() => {
                  // A lens/filter is narrowing an otherwise non-empty notebook →
                  // say "no matches", not "create your first page".
                  const isFiltered =
                    statusTab !== 'all' || scopeLens !== 'all' || viewLens !== 'all';
                  const hasAnyPages = pages.length > 0;
                  if (isFiltered && hasAnyPages) {
                    return (
                      <>
                        <div className="text-sm font-medium text-c-text-muted">
                          {t('notebook.notebookContent.label37', 'No matching pages')}
                        </div>
                        <div className="text-[11px] text-c-text-secondary mt-1">
                          {t('notebook.notebookContent.label38', 'Try a different filter above')}
                        </div>
                      </>
                    );
                  }
                  return (
                    <>
                      <div className="text-sm font-medium text-c-text-muted">
                        {t('myWork.notebook.empty', 'No pages yet')}
                      </div>
                      <div className="text-[11px] text-c-text-secondary mt-1">
                        {t('notebook.notebookContent.label39', 'Create your first page')}
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : (
              <>
                {filteredPages.map((p) => {
                  const isActive = p.id === activeId;
                  const mat = (p.maturity as NotebookMaturity) || computeMaturity(p);
                  const matCfg = MATURITY_CONFIG[mat] || MATURITY_CONFIG.seed;
                  const timeAgo = relativeTime(p.updatedAt);
                  const statusDot =
                    p.status === 'inbox'
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
                          ? 'bg-c-surface-raised border border-c-border-subtle shadow-sm'
                          : 'hover:bg-c-surface-raised border border-transparent'
                      }`}
                    >
                      <button
                        onClick={async () => {
                          await flushPendingSave();
                          setActiveId(p.id);
                          // MW-08 mobile fix: the isMobile+activePage.id effect
                          // that hides the list only re-fires when the id
                          // ACTUALLY changes. Re-opening the SAME note that was
                          // just backed out of via "All notes" (id unchanged)
                          // left the list showing with no way back into the
                          // editor — reproduced live: click registers (DOM
                          // screenshot confirms the list stays mounted), the
                          // effect's dependency array never sees a diff, so it
                          // never runs. Set it directly here too so opening a
                          // note always switches to editor mode, changed id or
                          // not.
                          if (isMobile) setMobileShowList(false);
                        }}
                        className="w-full text-left px-3 py-2.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                      >
                        {/* S1-U2a: Ideas-list row anatomy — leading signal dot
                          ("szyna skanu" §14.2), L2 title, L5 meta, neutral
                          chip shells with color only in the dot. */}
                        <div className="flex items-start gap-2">
                          {p.icon && /\p{Emoji}/u.test(p.icon) ? (
                            <span className="text-sm leading-none mt-0.5 shrink-0">{p.icon}</span>
                          ) : null}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot}`} />
                              {p.pinned && <Pin size={10} className="text-amber-500 shrink-0" />}
                              {p.visibility === 'project' && (
                                <Users size={10} className="text-c-text-muted shrink-0" />
                              )}
                              <span
                                className={`font-semibold text-[13px] truncate flex-1 ${
                                  isActive ? 'text-c-text' : 'text-c-text'
                                }`}
                              >
                                {p.title || t('notebook.notebookContent.label40', 'Untitled')}
                              </span>
                              {timeAgo && (
                                <span className="text-[10px] text-c-text-muted shrink-0 tabular-nums">
                                  {timeAgo}
                                </span>
                              )}
                            </div>

                            {p.summary && (
                              <div className="mt-0.5 text-[11px] text-c-text-secondary line-clamp-1 leading-relaxed">
                                {p.summary}
                              </div>
                            )}

                            <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                              <span className="inline-flex items-center gap-1 rounded-full border border-c-border-subtle bg-c-surface px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-c-text-secondary">
                                <span className={`w-1.5 h-1.5 rounded-full ${matCfg.dot}`} />
                                {t(`myWorkNotebook.notebookContent.maturity_${mat}`, matCfg.label)}
                              </span>
                              {(p as any).verificationStatus === 'verified' && (
                                <Badge
                                  variant="outline"
                                  className="border-emerald-300/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0 text-[9px]"
                                  title={t('notebook.notebookContent.title', 'Verified')}
                                >
                                  <CheckCircle2 size={9} className="inline" />
                                </Badge>
                              )}
                              {(p as any).staleAt && (
                                <Badge
                                  variant="outline"
                                  className="border-amber-300/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0 text-[9px]"
                                  title={t('notebook.notebookContent.title2', 'Stale')}
                                >
                                  <AlertTriangle size={9} className="inline" />
                                </Badge>
                              )}
                              {(() => {
                                const uploadSource = getNotebookUploadSourceSummary(
                                  (p as any).captureSource,
                                  (p as any).captureMetadata,
                                  isPolish
                                );
                                if (!uploadSource) return null;
                                return (
                                  <span
                                    className="rounded-md bg-c-info/10 text-c-info px-1.5 py-0.5 text-[11px] font-medium"
                                    title={uploadSource.title}
                                  >
                                    {uploadSource.label}
                                  </span>
                                );
                              })()}
                              {(() => {
                                const convertedSummary = getNotebookConvertedOutputSummary(
                                  p.convertedTo
                                );
                                if (convertedSummary.total === 0) return null;
                                return (
                                  <span
                                    className="rounded-md bg-c-success/10 text-c-success px-1.5 py-0.5 text-[11px] font-medium"
                                    title={convertedSummary.visibleTypes.join(', ')}
                                  >
                                    ✓ {convertedSummary.visibleTypes.join(', ')}
                                    {convertedSummary.extraCount > 0
                                      ? ` +${convertedSummary.extraCount}`
                                      : ''}
                                  </span>
                                );
                              })()}
                              {/* #18 — orphan mark: zero link_graph_edges rows (no topics/mentions/backlinks) */}
                              {orphanIds.has(p.id) && (
                                <span
                                  className="inline-flex items-center gap-0.5 rounded-md bg-c-warning/10 text-c-warning px-1.5 py-0.5 text-[11px] font-medium"
                                  title={t(
                                    'notebook.notebookContent.title3',
                                    'No connections — add a mention (@) or archive'
                                  )}
                                >
                                  <Unlink size={9} className="inline" />
                                  {t('notebook.notebookContent.label41', 'Unlinked')}
                                </span>
                              )}
                              {/* #21 reminder chip — reads capture_metadata.reminder */}
                              <NotebookReminderChip
                                captureMetadata={(p as any).captureMetadata}
                                isPolish={isPolish}
                                size="sm"
                              />
                              {p.tags &&
                                p.tags.slice(0, 2).map((tag) => (
                                  <span
                                    key={tag}
                                    className="rounded-md bg-c-surface-raised text-c-text-muted px-1.5 py-0.5 text-[11px] font-medium"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              {p.tags && p.tags.length > 2 && (
                                <span className="text-[9px] text-c-text-secondary">
                                  +{p.tags.length - 2}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* Quick triage actions on hover */}
                      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-c-surface/90 rounded-lg shadow-sm border border-slate-200/60 dark:border-white/[0.03] px-0.5 py-0.5">
                        {p.status === 'inbox' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetStatus(p.id, 'active');
                            }}
                            className="p-1 rounded text-blue-500 hover:bg-blue-500/10 transition-colors"
                            title={t('notebook.notebookContent.title4', 'Start working')}
                          >
                            <Play size={10} />
                          </button>
                        )}
                        <div onClick={(e) => e.stopPropagation()}>
                          <ConvertToOutputMenu
                            sourceType="notebook"
                            sourceId={p.id}
                            sourceTitle={p.title || ''}
                            onConvertComplete={() => fetchPages()}
                            variant="dropdown"
                            compact
                          />
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTogglePin(p.id);
                          }}
                          className={`p-1 rounded transition-colors ${p.pinned ? 'text-amber-500 bg-amber-500/10' : 'text-c-text-secondary hover:text-amber-500 hover:bg-amber-500/10'}`}
                          title={t('notebook.notebookContent.title5', 'Pin')}
                        >
                          <Pin size={10} />
                        </button>
                        {p.status !== 'archived' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetStatus(p.id, 'archived');
                            }}
                            className="p-1 rounded text-c-text-secondary hover:text-c-text hover:bg-c-surface-raised transition-colors"
                            title={t('notebook.notebookContent.title6', 'Archive')}
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
                    className="w-full py-2 text-[11px] text-c-text-muted hover:text-c-accent transition-colors"
                  >
                    {t('notebook.notebookContent.label42', 'Load more')}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Editor + Ideas panel — on mobile, only when a note is open. */}
      {(!isMobile || !mobileShowList) && (
        <div className="flex-1 flex min-w-0 gap-1.5 overflow-hidden">
          <div className="flex-1 min-w-0 flex flex-col rounded-2xl border border-c-border-subtle overflow-hidden bg-c-surface-raised">
            {isMobile && (
              <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-c-border-subtle">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<ChevronLeft size={14} />}
                  onClick={() => {
                    void flushPendingSave();
                    setMobileShowList(true);
                  }}
                  aria-label={t('notebook.notebookContent.backToList', 'All notes')}
                >
                  {t('notebook.notebookContent.backToList', 'All notes')}
                </Button>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-c-text-secondary">
                  {notebookTitle || t('myWork.notebook.title', 'Notebook')}
                </span>
              </div>
            )}
            {!activePage && pagesLoading ? (
              /* Editor skeleton — avoids a blank "white" pane during first load. */
              <div className="flex-1 overflow-hidden">
                <div className="mx-auto max-w-3xl px-6 py-8" aria-hidden="true">
                  <div className="mb-4 h-40 w-full rounded-2xl bg-c-surface-raised animate-pulse" />
                  <div className="mb-6 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-c-surface-raised animate-pulse" />
                    <div className="h-7 w-2/3 rounded-lg bg-c-surface-raised animate-pulse" />
                  </div>
                  <div className="space-y-3">
                    <div className="h-4 w-full rounded bg-c-surface-raised animate-pulse" />
                    <div className="h-4 w-11/12 rounded bg-c-surface-raised animate-pulse" />
                    <div className="h-4 w-4/5 rounded bg-c-surface-raised animate-pulse" />
                    <div className="h-4 w-2/3 rounded bg-c-surface-raised animate-pulse" />
                  </div>
                </div>
              </div>
            ) : !activePage && pagesError ? (
              <div className="flex h-full items-center justify-center p-8">
                <div className="text-center">
                  <AlertTriangle size={36} className="mx-auto mb-3 text-c-text-muted" />
                  <p className="mb-3 text-sm text-c-text-secondary">
                    {t('notebook.notebookContent.label43', 'Failed to load notes.')}
                  </p>
                  <button
                    type="button"
                    onClick={() => void fetchPages()}
                    className="text-sm font-medium text-c-text-secondary hover:underline"
                  >
                    {t('notebook.notebookContent.label44', 'Retry')}
                  </button>
                </div>
              </div>
            ) : !activePage ? (
              <div className="flex h-full items-center justify-center p-8">
                <div className="max-w-lg w-full">
                  {/* Welcome hero */}
                  <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-navy-700 via-navy-800 to-navy-900 shadow-lg shadow-navy-900/20 mb-4">
                      <Pen size={28} className="text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-c-text mb-1">
                      {t('notebook.notebookContent.label45', 'Living Notebook')}
                    </h2>
                    <p className="text-sm text-c-text-muted max-w-xs mx-auto">
                      {t(
                        'notebook.notebookContent.label46',
                        'Your notes grow, connect, and help you make better decisions'
                      )}
                    </p>
                  </div>

                  {/* Quick start templates */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    {[
                      {
                        icon: '📝',
                        label: t('notebook.notebookContent.label47', 'Blank page'),
                        desc: t('notebook.notebookContent.label48', 'Start from scratch'),
                        id: 'blank',
                      },
                      {
                        icon: '🧠',
                        label: t('notebook.notebookContent.label49', 'Strategic observation'),
                        desc: t('notebook.notebookContent.label50', 'Capture an insight'),
                        id: 'strategic',
                      },
                      {
                        icon: '⚠️',
                        label: t('notebook.notebookContent.label51', 'Risk analysis'),
                        desc: t('notebook.notebookContent.label52', 'Assess a threat'),
                        id: 'risk',
                      },
                      {
                        icon: '💬',
                        label: t('notebook.notebookContent.label53', 'Meeting notes'),
                        desc: t('notebook.notebookContent.label54', 'Capture & align'),
                        id: 'meeting',
                      },
                    ].map((tmpl) => (
                      <button
                        key={tmpl.id}
                        onClick={() => {
                          setTemplateModalOpen(true);
                        }}
                        className="nb-welcome-card flex items-start gap-3 p-3.5 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-left group"
                      >
                        <span className="text-2xl mt-0.5">{tmpl.icon}</span>
                        <div>
                          <div className="text-sm font-semibold text-c-text group-hover:text-c-accent transition-colors">
                            {tmpl.label}
                          </div>
                          <div className="text-[11px] text-c-text-secondary mt-0.5">
                            {tmpl.desc}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* AI suggestion prompt */}
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-c-surface-raised border border-c-border-subtle">
                    <div className="w-8 h-8 rounded-lg bg-c-surface-raised flex items-center justify-center shrink-0">
                      <Sparkles size={14} className="text-[var(--c-info)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-c-accent">
                        {t('notebook.notebookContent.label55', 'AI is ready to assist')}
                      </div>
                      <div className="text-[11px] text-c-accent mt-0.5">
                        {t(
                          'notebook.notebookContent.label56',
                          'Type / in the editor to ask, expand, or challenge your ideas'
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col nb-page-enter" key={activePage.id}>
                {/* Compact toolbar (text editing only) */}
                <div className="border-b border-c-border-subtle bg-c-surface/80 backdrop-blur-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Toolbar */}
                    {editor && <NotebookToolbar editor={editor} />}
                    <div
                      className="ml-auto flex shrink-0 items-center gap-1"
                      data-testid="notebook-toolbar-right-actions"
                    >
                      {/* MW-08: the rail (Teresa/Powiązania) is a fixed-width
                      third column with no mobile treatment of its own, and
                      its content is explicitly out of this package's scope
                      (Notes AI/handoffs). Rather than ship a broken overlay,
                      the toggle — and the rail itself, see below — are
                      simply not offered below the mobile breakpoint; this is
                      a deliberate, documented scope decision, not an
                      oversight. */}
                      {!isMobile && (
                        <button
                          ref={notebookRailToggleRef}
                          type="button"
                          onClick={() => setNotebookRailOpen(!notebookRailOpen)}
                          title={
                            notebookRailOpen
                              ? t('notebook.notebookContent.label57', 'Close side panel')
                              : t(
                                  'notebook.notebookContent.label58',
                                  'Open side panel (AI tools + context)'
                                )
                          }
                          className={`mr-2 inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors ${
                            notebookRailOpen
                              ? 'border-c-text bg-c-text text-c-surface'
                              : 'border-c-border-subtle bg-c-surface text-c-text-muted hover:bg-c-surface-raised'
                          }`}
                        >
                          <Layers size={12} />
                        </button>
                      )}
                      {/* N1: hamburger ⋯ — all note actions in one menu */}
                      <button
                        type="button"
                        onClick={(e) => {
                          const r = e.currentTarget.getBoundingClientRect();
                          setHamburgerPos({ x: Math.max(8, r.right - 240), y: r.bottom + 4 });
                        }}
                        title={t('notebook.notebookContent.title11', 'Note menu')}
                        aria-label={t('notebook.notebookContent.ariaLabel5', 'Note menu')}
                        className="shrink-0 p-1.5 rounded-lg text-c-text-muted hover:bg-c-surface-raised transition-colors"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                {hamburgerPos && activePage && (
                  <NotebookHamburgerMenu
                    x={hamburgerPos.x}
                    y={hamburgerPos.y}
                    isPolish={!!isPolish}
                    onClose={() => setHamburgerPos(null)}
                    onExport={() => setNotebookExportOpen(true)}
                    onVersionHistory={() => setShowVersionHistory((value) => !value)}
                    onSources={() =>
                      attachmentsSectionRef.current?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                      })
                    }
                    onVerification={() => {
                      setNotebookRailOpen(true);
                      setNotebookRailTab('work');
                      window.requestAnimationFrame(() => notebookRailToggleRef.current?.focus());
                    }}
                    onShare={handleShareEmail}
                    onExpandDocument={() => handleExpandToDocument()}
                    onGraph={() => setShowGraphView((v) => !v)}
                    onConvert={(t: NotebookConvertTarget) =>
                      handleConvertFromPanel(t as ConvertTarget)
                    }
                    onAskAI={() => setAiCommand('action')}
                    onDelete={() => handleDeletePage()}
                    receiptCapableActionIds={[
                      ...(isDeleteReceiptCapable ? ['delete'] : []),
                      ...(isExpandDocumentReceiptCapable ? ['expand-document'] : []),
                    ]}
                    receiptUnavailableReasons={{
                      ...(!isDeleteReceiptCapable && actionCapabilities?.delete.reason
                        ? { delete: actionCapabilities.delete.reason }
                        : {}),
                      ...(!isExpandDocumentReceiptCapable &&
                      actionCapabilities?.expandDocument.reason
                        ? { 'expand-document': actionCapabilities.expandDocument.reason }
                        : {}),
                    }}
                  />
                )}

                {activePage ? (
                  <NotebookExportMenu
                    page={{
                      id: activePage.id,
                      title,
                      contentJson: activePage.contentJson,
                      contentText: activePage.contentText,
                    }}
                    isPolish={isPolish}
                    open={notebookExportOpen}
                    onOpenChange={setNotebookExportOpen}
                    hideTrigger
                  />
                ) : null}

                {/* Version History panel (toggleable) */}
                {showVersionHistory && activePage && (
                  <div className="border-b border-c-border-subtle bg-c-surface-raised max-h-64 overflow-y-auto nb-scroll">
                    <NotebookVersionHistory
                      pageId={activePage.id}
                      currentText={activePage.contentText || ''}
                      isPolish={isPolish}
                      onRestored={() => {
                        setShowVersionHistory(false);
                        void fetchPages();
                      }}
                    />
                  </div>
                )}

                {/* AI Command Prompt — hidden; accessible via Tools panel Command button */}
                {editor && activePage && (
                  <div className="sr-only" aria-hidden="true">
                    <AICommandPrompt
                      editor={editor}
                      pageId={activePage.id}
                      noteTitle={title}
                      noteContent={activePage.contentText || extractText(activePage.contentJson)}
                      noteTags={pageTags}
                      onProposalCreated={() => void refreshAIProposals(activePage.id)}
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
                      window.dispatchEvent(
                        new CustomEvent('notebook-ai-block-drop', { detail: { text } })
                      );
                    }
                  }}
                >
                  {editor ? (
                    <div
                      data-testid="notebook-block-gutter"
                      className="group absolute left-1 z-20 flex -translate-y-1/2 gap-0.5 opacity-0 transition-opacity hover:opacity-100 focus-within:opacity-100"
                      style={{ top: blockGutterTop }}
                    >
                      <button
                        type="button"
                        aria-label={t('notebook.blockGutter.actions', 'Block actions')}
                        className="rounded border border-c-border-subtle bg-c-surface p-1 text-c-text-secondary hover:bg-c-surface-raised focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                        onClick={(event) => {
                          const rect = event.currentTarget.getBoundingClientRect();
                          setSlashState({
                            open: true,
                            query: '',
                            triggerPos: editor.state.selection.from,
                            coords: { top: rect.bottom + 4, left: rect.left },
                            mode: 'context',
                          });
                        }}
                      >
                        ⠿
                      </button>
                      <button
                        type="button"
                        aria-label={t('notebook.blockGutter.insertBelow', 'Insert block below')}
                        className="rounded border border-c-border-subtle bg-c-surface p-1 text-c-text-secondary hover:bg-c-surface-raised focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                        onClick={(event) => {
                          const rect = event.currentTarget.getBoundingClientRect();
                          const $from = editor.state.selection.$from;
                          const insertPos =
                            $from.depth > 0 ? $from.after(1) : editor.state.doc.content.size;
                          editor.commands.setTextSelection(insertPos);
                          setSlashState({
                            open: true,
                            query: '',
                            triggerPos: insertPos,
                            coords: { top: rect.bottom + 4, left: rect.left },
                            mode: 'insert',
                          });
                        }}
                      >
                        +
                      </button>
                    </div>
                  ) : null}
                  <div className="mx-auto max-w-3xl px-6 py-8">
                    {/* Hidden file input for the cover image. */}
                    <input
                      ref={coverInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleCoverFile(file);
                        e.target.value = '';
                      }}
                    />

                    {/* Cover image (note header) */}
                    <CoverImageBar
                      coverUrl={coverUrl}
                      onPick={handlePickCover}
                      onRemove={() => void persistCover(null)}
                      isPolish={isPolish}
                    />

                    {/* Page icon + title — Notion-like */}
                    <div className="mb-4">
                      <div className="flex items-start gap-3 mb-1">
                        <div className="mt-0.5">
                          <IconPickerButton
                            value={activePage.icon ?? null}
                            fallback={
                              (
                                MATURITY_CONFIG[
                                  (activePage.maturity as NotebookMaturity) || 'seed'
                                ] || MATURITY_CONFIG.seed
                              ).icon
                            }
                            onChange={handleChangeIcon}
                            isPolish={isPolish}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <input
                            value={title}
                            onChange={(e) => {
                              setTitle(e.target.value);
                              scheduleSave({ title: e.target.value });
                            }}
                            placeholder={t('notebook.notebookContent.placeholder', 'Untitled')}
                            className="w-full bg-transparent text-3xl font-semibold tracking-tight text-c-text outline-none placeholder:text-c-text-muted"
                          />
                          {/* Tags inline */}
                          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                            <Tag size={11} className="text-c-text-secondary shrink-0" />
                            {pageTags.map((tag) => (
                              <span
                                key={tag}
                                className="group/tag inline-flex items-center gap-1 rounded-md bg-c-surface-raised text-c-text-secondary px-2 py-0.5 text-[11px] font-medium hover:bg-c-surface-raised hover:text-c-text transition-colors"
                              >
                                {tag}
                                <button
                                  onClick={() => handleRemoveTag(tag)}
                                  className="opacity-0 group-hover/tag:opacity-100 transition-opacity hover:text-danger-500"
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
                              placeholder={t('notebook.notebookContent.placeholder2', '+ tag')}
                              className="min-w-[50px] max-w-[120px] bg-transparent text-[11px] text-c-text-secondary outline-none placeholder:text-c-text-muted"
                            />
                            {(() => {
                              const uploadSource = getNotebookUploadSourceSummary(
                                activePage.captureSource,
                                activePage.captureMetadata,
                                isPolish
                              );
                              if (!uploadSource) return null;
                              const hasStoredSourceFile = Boolean(
                                activePage.captureMetadata?.storedSourceFile &&
                                activePage.captureMetadata?.fileOriginalname
                              );
                              return (
                                <>
                                  <span
                                    className="inline-flex items-center rounded-md bg-c-info/10 text-c-info px-2 py-0.5 text-[11px] font-medium"
                                    title={uploadSource.title}
                                  >
                                    {uploadSource.label}
                                  </span>
                                  {hasStoredSourceFile ? (
                                    <button
                                      type="button"
                                      onClick={() => void handleDownloadSourceFile()}
                                      disabled={isDownloadingSourceFile}
                                      className="inline-flex items-center gap-1 rounded-md border border-c-border-subtle bg-c-surface px-2 py-0.5 text-[11px] font-medium text-c-text-secondary transition-colors hover:border-c-info hover:text-c-info disabled:cursor-not-allowed disabled:opacity-60"
                                      title={t(
                                        'notebook.notebookContent.title12',
                                        'Download original source file'
                                      )}
                                    >
                                      <Paperclip size={11} />
                                      {t('notebook.notebookContent.label59', 'Download source')}
                                    </button>
                                  ) : null}
                                </>
                              );
                            })()}
                            {/* #21 reminder chip — reads capture_metadata.reminder */}
                            <NotebookReminderChip
                              captureMetadata={activePage.captureMetadata}
                              isPolish={isPolish}
                            />
                          </div>
                        </div>
                        {/* #23 live presence — avatars of others viewing this note */}
                        <div className="mt-1 shrink-0">
                          <NotebookPresenceStack
                            users={notebookPresence.connectedUsers}
                            localUserId={currentUserId}
                            connectionStatus={notebookPresence.connectionStatus}
                            isPolish={isPolish}
                          />
                        </div>
                      </div>

                      {/* MW-08 — conflict recovery banner. Persistent (unlike
                        the toast, which fades) so the user can't miss it,
                        and never disappears until they explicitly choose an
                        action — the local edit stays exactly as typed. */}
                      {saveState === 'conflict' && (
                        <div
                          role="alert"
                          className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10 px-3 py-2 text-[12px] text-amber-900 dark:text-amber-200"
                        >
                          <span className="flex items-center gap-1.5">
                            <AlertTriangle size={13} />
                            {t(
                              'notebook.notebookContent.conflictBanner',
                              'This page was changed elsewhere. Your edits were not overwritten.'
                            )}
                          </span>
                          <span className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={handleReloadFromConflict}
                              className="rounded-md border border-amber-400 px-2 py-1 font-semibold text-amber-900 dark:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                            >
                              {t('notebook.notebookContent.conflictReload', 'Reload')}
                            </button>
                            <button
                              type="button"
                              onClick={handleRetryAfterConflict}
                              className="rounded-md px-2 py-1 font-semibold text-amber-900 dark:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                            >
                              {t('notebook.notebookContent.conflictRetry', 'Save mine anyway')}
                            </button>
                          </span>
                        </div>
                      )}

                      {/* Governance controls moved to the canonical Work rail (MYW-NBK-CORE-001). */}
                      {showLegacyNotebookGovernanceControls && (
                        <div
                          ref={verificationStripRef}
                          className="mt-3 flex items-center gap-2 flex-wrap"
                        >
                          <select
                            value={
                              (activePage.verificationStatus as NotebookVerificationStatus) ??
                              'unverified'
                            }
                            onChange={(e) => {
                              const v = e.target.value as NotebookVerificationStatus;
                              scheduleSave({ verificationStatus: v });
                              setPages((prev) =>
                                prev.map((p) =>
                                  p.id === activePage.id ? { ...p, verificationStatus: v } : p
                                )
                              );
                            }}
                            title={t('notebook.notebookContent.title13', 'Verification')}
                            className={`text-[11px] px-2.5 py-1 rounded-md border cursor-pointer transition-colors ${
                              (activePage.verificationStatus as NotebookVerificationStatus) ===
                              'verified'
                                ? 'bg-emerald-500/10 border-emerald-300/40 text-emerald-700 dark:text-emerald-300'
                                : (activePage.verificationStatus as NotebookVerificationStatus) ===
                                    'disputed'
                                  ? 'bg-amber-500/10 border-amber-300/40 text-amber-700 dark:text-amber-300'
                                  : 'bg-c-surface-raised border-c-border-subtle text-c-text-secondary'
                            }`}
                          >
                            <option value="unverified">
                              {t('notebook.notebookContent.label60', '○ Unverified')}
                            </option>
                            <option value="verified">
                              {t('notebook.notebookContent.label61', '✓ Verified')}
                            </option>
                            <option value="disputed">
                              {t('notebook.notebookContent.label62', '! Disputed')}
                            </option>
                          </select>
                          <select
                            value={(activePage.reviewCadence as NotebookReviewCadence) ?? 'monthly'}
                            onChange={(e) => {
                              const v = e.target.value as NotebookReviewCadence;
                              scheduleSave({ reviewCadence: v });
                              setPages((prev) =>
                                prev.map((p) =>
                                  p.id === activePage.id ? { ...p, reviewCadence: v } : p
                                )
                              );
                            }}
                            title={t('notebook.notebookContent.title14', 'Review cadence')}
                            className="text-[11px] px-2.5 py-1 rounded-md border bg-c-surface-raised border-c-border-subtle text-c-text-secondary cursor-pointer"
                          >
                            <option value="weekly">
                              {t('notebook.notebookContent.label63', 'Weekly')}
                            </option>
                            <option value="monthly">
                              {t('notebook.notebookContent.label64', 'Monthly')}
                            </option>
                            <option value="quarterly">
                              {t('notebook.notebookContent.label65', 'Quarterly')}
                            </option>
                            <option value="never">
                              {t('notebook.notebookContent.label66', 'Never')}
                            </option>
                          </select>
                          {(activePage.staleAt || activePage.lastReviewedAt) && (
                            <span className="text-[11px]">
                              {activePage.staleAt ? (
                                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                  <AlertTriangle size={11} />
                                  {t('notebook.notebookContent.label67', 'Stale')}
                                </span>
                              ) : activePage.lastReviewedAt ? (
                                <span className="inline-flex items-center gap-1 text-c-text-muted">
                                  <CheckCircle2 size={11} className="text-emerald-500" />
                                  {t('notebook.notebookContent.label68', 'Reviewed')}{' '}
                                  {relativeTime(activePage.lastReviewedAt)}
                                </span>
                              ) : null}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              const now = new Date().toISOString();
                              scheduleSave({
                                lastReviewedAt: now,
                                staleAt: null,
                                verificationStatus:
                                  (activePage.verificationStatus as NotebookVerificationStatus) ||
                                  'verified',
                              });
                              setPages((prev) =>
                                prev.map((p) =>
                                  p.id === activePage.id
                                    ? {
                                        ...p,
                                        lastReviewedAt: now,
                                        staleAt: null,
                                        verificationStatus:
                                          (p.verificationStatus as NotebookVerificationStatus) ||
                                          'verified',
                                      }
                                    : p
                                )
                              );
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-c-border-subtle text-c-text-secondary hover:bg-c-surface-raised text-[11px] font-medium transition-colors"
                          >
                            <RefreshCw size={10} />
                            {t('notebook.notebookContent.label69', 'Mark reviewed')}
                          </button>
                        </div>
                      )}

                      {/* Subtle divider */}
                      <div className="h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-navy-700 to-transparent mt-3" />

                      <NotebookProgressChip
                        isPolish={isPolish}
                        hasPendingAIProposals={pendingAIProposals.length > 0}
                        canConvertDeliverable={canConvertDeliverable}
                        convertBlockedReason={deliverableGuardMessage}
                        onOpenAttachments={() =>
                          attachmentsSectionRef.current?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                          })
                        }
                        onCreateAIProposal={() => setAiCommand('action')}
                        onReviewAIProposal={() =>
                          proposalReviewRef.current?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                          })
                        }
                        onConvert={() => void handleConvertFromPanel('report')}
                        onHandoffInitiatives={handleHandoffInitiatives}
                      />
                    </div>

                    {activePage && (
                      <div className="mb-3">
                        <NotebookTopicChips
                          noteId={activePage.id}
                          canEdit={true}
                          onOpenTopic={(topicId) => setOpenTopicId(topicId)}
                        />
                      </div>
                    )}

                    {headingOutline.length > 0 && (
                      <div className="mb-4 rounded-xl border border-c-border-subtle bg-c-surface-raised px-3 py-3">
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
                          {t('notebook.notebookContent.label70', 'Mini outline')}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {headingOutline.map((heading, index) => (
                            <button
                              key={`${heading.level}-${heading.text}-${index}`}
                              type="button"
                              onClick={() => {
                                if (!editor) return;
                                let selectionPos = 1;
                                editor.state.doc.descendants((node, pos) => {
                                  if (
                                    node.type.name === 'heading' &&
                                    Number(node.attrs?.level || 1) === heading.level &&
                                    extractText(node.toJSON()) === heading.text
                                  ) {
                                    selectionPos = pos + 1;
                                    return false;
                                  }
                                  return true;
                                });
                                editor.chain().focus().setTextSelection(selectionPos).run();
                                editor.view.dispatch(editor.state.tr.scrollIntoView());
                              }}
                              className="rounded-full bg-c-surface px-2.5 py-1 text-[11px] font-medium text-c-text-secondary transition-colors hover:bg-c-surface-raised"
                            >
                              {`H${heading.level} ${heading.text}`}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {proposalLoadError ? (
                      <div className="mb-4 rounded-xl border border-amber-200/70 bg-amber-50/80 px-3 py-3 text-[11px] text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                        {t(
                          'notebook.notebookContent.label71',
                          'Could not load AI proposals for this note. Refresh the page or try again in a moment.'
                        )}
                      </div>
                    ) : null}

                    {pendingAIProposals.length > 0 && (
                      <div
                        ref={proposalReviewRef}
                        className="mb-4 rounded-xl border border-c-border-subtle bg-c-surface-raised px-3 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-xs font-semibold text-c-text-secondary">
                              {t('notebook.notebookContent.label72', 'AI propose -> accept')}
                            </div>
                            <div className="text-[11px] text-c-text-secondary">
                              {t(
                                'notebook.notebookContent.pendingProposalsCount',
                                '{{count}} proposals waiting for review',
                                { count: pendingAIProposals.length }
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 space-y-2">
                          {pendingAIProposals.slice(0, 3).map((proposal) => (
                            <div
                              key={proposal.id}
                              className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2"
                            >
                              <div className="text-[11px] font-medium text-c-text-secondary">
                                {proposal.rationale ||
                                  t('notebook.notebookContent.label73', 'AI proposal')}
                              </div>
                              <div className="mt-1 text-[11px] text-c-text-muted line-clamp-2">
                                {extractText(proposal.blockContent)}
                              </div>
                              <div className="mt-2 flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    void resolveNotebookAIProposal(proposal.id, 'accepted')
                                  }
                                  className="rounded-md bg-c-text px-2.5 py-1 text-[11px] font-medium text-c-surface transition-colors hover:brightness-110"
                                >
                                  {t('notebook.notebookContent.label74', 'Accept')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void resolveNotebookAIProposal(proposal.id, 'rejected')
                                  }
                                  className="rounded-md bg-c-surface px-2.5 py-1 text-[11px] font-medium text-c-text-secondary transition-colors hover:bg-c-surface-raised"
                                >
                                  {t('notebook.notebookContent.label75', 'Reject')}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedEmbedPreview && (
                      <div className="mb-4 rounded-xl border border-amber-200/70 bg-amber-50/80 px-3 py-3 dark:border-amber-500/20 dark:bg-amber-500/10">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                              {selectedEmbedPreview.title}
                            </div>
                            <div className="mt-1 text-[11px] text-c-text-muted">
                              {selectedEmbedPreview.artifactType}
                              {selectedEmbedPreview.status
                                ? ` · ${selectedEmbedPreview.status}`
                                : ''}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedEmbedPreview(null)}
                            className="rounded-md p-1 text-c-text-secondary transition-colors hover:bg-c-surface-raised hover:text-c-text"
                          >
                            <X size={14} />
                          </button>
                        </div>
                        {selectedEmbedPreview.snippet ? (
                          <div className="mt-2 text-sm text-c-text-secondary">
                            {selectedEmbedPreview.snippet}
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* Hidden file input backing the slash "/image" command. */}
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadInlineImage(file);
                        e.target.value = '';
                      }}
                    />

                    {/* Rich editor */}
                    {editor && <NotebookBubbleToolbar editor={editor} />}
                    {/* J26 (channel 2): select → rewrite fragment in place via AI. */}
                    {editor && activePage && (
                      <NotebookInlineAIMenu
                        editor={editor}
                        pageId={activePage.id}
                        // FIX-7 (Day 3 acceptance): was hardcoded `[]`, which
                        // disabled every inline-AI action (isReceiptCapable()
                        // gates handleAction/handleApprove/handleReject on
                        // this list). These 7 ids ARE genuinely receipt-backed
                        // — the 5 rewrite actions create a durable
                        // notebook_ai_proposals row (Api.notebookCreateAIProposal,
                        // proposal.id is the receipt), and approve/reject
                        // mutate that same row's status (Api.notebookResolveAIProposal,
                        // readback via GET .../ai-proposals) — unlike
                        // expand-document, this durability does not depend on
                        // page ownership, so it is not gated by the
                        // action-capabilities endpoint.
                        receiptCapableActionIds={[
                          'shorten',
                          'expand',
                          'improve',
                          'formal',
                          'explain',
                          'approve',
                          'reject',
                        ]}
                        onApplied={() => {
                          void Promise.all([fetchPages(), refreshAIProposals(activePage.id)]);
                        }}
                      />
                    )}
                    {editor && (
                      <button
                        type="button"
                        onClick={(event) => {
                          const rect = event.currentTarget.getBoundingClientRect();
                          setSlashState({
                            open: true,
                            query: '',
                            triggerPos: editor.state.selection.from,
                            coords: { top: rect.bottom + 4, left: rect.left },
                            mode: 'insert',
                          });
                        }}
                        aria-label={t('notebook.notebookContent.insertBlock', 'Insert block')}
                        className="mb-2 inline-flex items-center gap-1.5 rounded-lg border border-c-border-subtle bg-c-surface px-2.5 py-1.5 text-xs font-medium text-c-text-secondary transition-colors hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                      >
                        <Plus size={13} aria-hidden="true" />
                        {t('notebook.notebookContent.insertBlock', 'Insert block')}
                      </button>
                    )}
                    <EditorContent editor={editor} />

                    {/* K1 — incoming backlinks ("Mentioned in") surfaced inline. */}
                    {activePage && (
                      <NotebookBacklinksBar
                        noteId={activePage.id}
                        isPolish={isPolish}
                        refreshKey={backlinksRefresh}
                      />
                    )}

                    {activePage ? (
                      <div ref={attachmentsSectionRef} className="mt-4">
                        <NotebookAttachmentsSection
                          noteId={activePage.id}
                          attachments={activePage.attachments || []}
                          onUpload={handleUploadNotebookAttachments}
                          onDelete={handleDeleteNotebookAttachment}
                        />
                      </div>
                    ) : null}
                  </div>

                  {/* AI inline response */}
                  {aiCommand && activePage && (
                    <AIInlineResponse
                      pageId={activePage.id}
                      commandType={aiCommand}
                      noteContent={activePage.contentText || extractText(activePage.contentJson)}
                      noteTitle={title}
                      onInsert={(text) => {
                        void submitNotebookAIProposal(
                          text,
                          aiCommand === 'ask'
                            ? t('notebook.notebookContent.label76', 'AI answer for note')
                            : aiCommand === 'expand'
                              ? t('notebook.notebookContent.label77', 'AI expansion')
                              : aiCommand === 'challenge'
                                ? t('notebook.notebookContent.label78', 'AI challenge questions')
                                : t('notebook.notebookContent.label79', 'AI action plan'),
                          aiCommand === 'ask'
                            ? t('notebook.notebookContent.label80', 'AI answer')
                            : aiCommand === 'expand'
                              ? t('notebook.notebookContent.label81', 'AI expansion')
                              : aiCommand === 'challenge'
                                ? t('notebook.notebookContent.label82', 'AI challenge')
                                : t('notebook.notebookContent.label83', 'AI action plan')
                        );
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
                      // FIX-7 (Day 3 acceptance): was hardcoded `[]`, which
                      // disabled the 3 slash create-* commands entirely
                      // (SlashMenu disables any command in
                      // ['create-task','create-decision','save-as-idea'] not
                      // in this list). All 3 dispatch a window event this
                      // same component listens for (handleCreateTask/
                      // handleCreateDecision/handleCreateIdea below) — each
                      // is a real, durable server write (Api.createPersonalTask/
                      // createDecision/createMyIdea) whose returned id is
                      // independently readable back in My Tasks/Decisions/Ideas.
                      receiptCapableActionIds={['create-task', 'create-decision', 'save-as-idea']}
                      onAICommand={(cmd) => setAiCommand(cmd)}
                    />
                  )}

                  {/* @mention entity picker (K1) — coords are container-relative
                    like SlashMenu, so the absolutely-positioned menu lands at the caret. */}
                  {editor &&
                    mentionState.open &&
                    (() => {
                      const rect = editorContainerRef.current?.getBoundingClientRect();
                      return (
                        <NotebookMentionMenu
                          open={mentionState.open}
                          query={mentionState.query}
                          position={{
                            x: mentionState.coords.left - (rect?.left ?? 0),
                            y: mentionState.coords.top - (rect?.top ?? 0),
                          }}
                          onSelect={handleMentionSelect}
                          onClose={() => setMentionState(INITIAL_MENTION_STATE)}
                          isPolish={isPolish}
                          notes={pages}
                          activeNoteId={activePage?.id ?? null}
                        />
                      );
                    })()}

                  {/* Code-block language picker */}
                  {editor && codeLangMenu && (
                    <div
                      className="absolute z-50 max-h-64 w-44 overflow-y-auto rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-1 shadow-lg"
                      style={{ top: codeLangMenu.top, left: codeLangMenu.left }}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      {NOTEBOOK_CODE_LANGUAGES.map((lang) => (
                        <button
                          key={lang.id}
                          type="button"
                          onClick={() => {
                            editor.chain().focus().setCodeBlock({ language: lang.id }).run();
                            setCodeLangMenu(null);
                          }}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                            codeLangMenu.current === lang.id
                              ? 'bg-c-surface-raised text-c-text'
                              : 'text-c-text-secondary hover:bg-c-surface-raised'
                          }`}
                        >
                          {lang.label}
                          {codeLangMenu.current === lang.id ? (
                            <CheckCircle2 size={13} className="text-c-text-muted" />
                          ) : null}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Graph view — toggleable panel (topic+backlink connections). Same
            fixed-width-third-column problem as the right rail below; not
            offered on mobile for the same documented reason. */}
          {!isMobile && showGraphView && activePage && (
            <div className="w-72 shrink-0 rounded-2xl border border-slate-200/60 dark:border-white/[0.03] overflow-hidden bg-c-surface flex flex-col">
              <div className="flex items-center justify-between px-3 py-2 border-b border-c-border-subtle">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-c-text-secondary">
                  <Network size={13} />
                  {t('notebook.notebookContent.label84', 'Connection graph')}
                </div>
                <button
                  onClick={() => setShowGraphView(false)}
                  className="p-0.5 rounded text-c-text-secondary hover:bg-c-surface-raised transition-colors"
                >
                  <X size={13} />
                </button>
              </div>
              <NotebookGraphView pageId={activePage.id} pageTitle={title} isPolish={isPolish} />
            </div>
          )}

          {/* L-03: Consolidated right rail — Tab A (Praca/Work) + Tab B (Kontekst/Context).
            Not offered on mobile — see the toggle button comment above. */}
          {!isMobile && (
            <NotebookRightRail
              open={notebookRailOpen}
              activeTab={notebookRailTab}
              onTabChange={setNotebookRailTab}
              onClose={() => {
                setNotebookRailOpen(false);
                window.requestAnimationFrame(() => notebookRailToggleRef.current?.focus());
              }}
              // DEC-26: own pages are labeled "You" (i18n PL/EN), never the
              // current user's own real name — that was previously shown
              // even to the note's own author, which reads as odd/impersonal
              // ("Piotr Test" on your own note). Someone else's page shows
              // their REAL name from the server (activePage.ownerDisplayName,
              // server/src/routes/v8/my-work.routes.ts buildNotebookSelectFields)
              // instead of collapsing into the same generic "unavailable"
              // copy as a page with no resolvable owner at all — that generic
              // copy (NotebookRightRail.tsx) is now reserved for the true
              // no-data case (ownerDisplayName null/undefined), so the two
              // states stay distinguishable.
              ownerLabel={
                activePage?.ownerUserId
                  ? activePage.ownerUserId === currentUserId
                    ? t('notebook.rightRail.ownerYou', 'You')
                    : activePage.ownerDisplayName || undefined
                  : undefined
              }
              activePage={activePage}
              allPages={pages}
              editor={editor}
              noteTitle={title}
              noteContent={
                activePage ? activePage.contentText || extractText(activePage.contentJson) : ''
              }
              noteTags={pageTags}
              notePage={
                activePage
                  ? {
                      id: activePage.id,
                      maturity:
                        (activePage.maturity as NotebookMaturity) || computeMaturity(activePage),
                      summary: activePage.summary,
                      updatedAt: activePage.updatedAt,
                      visibility: (activePage.visibility as NotebookVisibility) || 'private',
                      projectId: activePage.projectId,
                      wordCount: wordCount(
                        activePage.contentText || extractText(activePage.contentJson)
                      ),
                    }
                  : undefined
              }
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
                    prev.map((p) => (p.id === activePage.id ? { ...p, visibility: 'project' } : p))
                  );
                }
              }}
              saveState={saveState}
              // FIX-7 (Day 3 acceptance): was hardcoded `[]`, which disabled
              // every rail editing control (isReceiptCapable() gates all 8
              // — see NotebookRightRail.tsx). All 8 route through
              // scheduleSave()/persistNotebookDraft() above, the SAME real
              // PUT /notebook/pages/:id used everywhere else in this
              // component, with genuine server-confirmed error/conflict
              // handling (saveState reflects the real HTTP outcome, not an
              // optimistic guess) — durable and receipt-capable.
              receiptCapableActionIds={[
                'retry-save',
                'load-theirs',
                'keep-mine',
                'visibility-private',
                'visibility-project',
                'verification-status',
                'review-cadence',
                'mark-reviewed',
              ]}
              onRetrySave={handleRetrySave}
              onReloadConflict={handleReloadFromConflict}
              onKeepMineConflict={handleRetryAfterConflict}
              onSetVerificationStatus={(next) => {
                if (!activePage) return;
                scheduleSave({ verificationStatus: next });
              }}
              onSetReviewCadence={(next) => {
                if (!activePage) return;
                scheduleSave({ reviewCadence: next });
              }}
              onMarkReviewed={() => {
                if (!activePage) return;
                scheduleSave({
                  lastReviewedAt: new Date().toISOString(),
                  staleAt: null,
                  verificationStatus:
                    (activePage.verificationStatus as NotebookVerificationStatus) || 'verified',
                });
              }}
              getRelativeTime={(iso) => relativeTime(iso)}
              onOpenAIChat={() => setChatOpen(true)}
              onFocusAICommand={() => aiCommandPromptInputRef.current?.focus()}
              onConvert={handleConvertFromPanel}
              canConvertDeliverable={canConvertDeliverable}
              convertBlockedReason={deliverableGuardMessage}
            />
          )}
        </div>
      )}

      <NewPageModal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        onSelectTemplate={(tmpl) => handleNewPage(tmpl)}
        onUploadComplete={async (page) => {
          await fetchPages();
          if (page?.id) setActiveId(page.id);
          toast.success(
            t('notebook.notebookContent.toastSuccess12', 'File uploaded, note created')
          );
        }}
      />

      <NotebookSearchDialog
        open={notebookSearchDialogOpen}
        onClose={() => setNotebookSearchDialogOpen(false)}
        onOpenPage={(pageId) => void handleOpenSearchResult(pageId)}
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

      {outlineDraft && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-c-text">
                  {t('notebook.notebookContent.label85', 'Outline first')}
                </div>
                <div className="mt-1 text-xs text-c-text-muted">
                  {t(
                    'notebook.notebookContent.label86',
                    'Review and edit the outline before creating the deliverable.'
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOutlineDraft(null)}
                className="rounded-md p-1 text-c-text-secondary transition-colors hover:bg-c-surface-raised hover:text-c-text"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-c-text-secondary">
                  {t('notebook.notebookContent.label87', 'Title')}
                </label>
                <input
                  value={outlineDraft.title}
                  onChange={(e) =>
                    setOutlineDraft((prev) => (prev ? { ...prev, title: e.target.value } : prev))
                  }
                  className="w-full rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm text-c-text outline-none focus:border-c-accent"
                />
              </div>

              {outlineDraft.target === 'assessment' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-c-text-secondary">
                    {t('notebook.notebookContent.label88', 'Assessment type')}
                  </label>
                  <select
                    value={outlineDraft.assessmentType}
                    onChange={(e) =>
                      setOutlineDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              assessmentType: e.target.value as OutlineDraft['assessmentType'],
                            }
                          : prev
                      )
                    }
                    className="w-full rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm text-c-text outline-none focus:border-c-accent"
                  >
                    {['DRD', 'SIRI', 'ADMA', 'CMMI', 'LEAN'].map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-c-text-secondary">
                  {t('notebook.notebookContent.label89', 'Outline')}
                </label>
                <textarea
                  value={outlineDraft.outline}
                  onChange={(e) =>
                    setOutlineDraft((prev) => (prev ? { ...prev, outline: e.target.value } : prev))
                  }
                  rows={12}
                  className="w-full rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm text-c-text outline-none focus:border-c-accent"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOutlineDraft(null)}
                className="rounded-xl border border-c-border-subtle px-3 py-2 text-sm font-medium text-c-text-secondary transition-colors hover:bg-c-surface-raised"
              >
                {t('notebook.notebookContent.label90', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmOutlineDraft()}
                disabled={!outlineDraft.title.trim() || !outlineDraft.outline.trim()}
                className="rounded-xl bg-c-text px-3 py-2 text-sm font-medium text-c-surface transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('notebook.notebookContent.label91', 'Create deliverable')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Topic aggregate modal */}
      {openTopicId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setOpenTopicId(null)}
        >
          <div
            className="relative w-full max-w-lg mx-4 rounded-2xl bg-c-surface shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <NotebookTopicView
              topicId={openTopicId}
              onClose={() => setOpenTopicId(null)}
              onOpenNote={(id) => {
                setOpenTopicId(null);
                void flushPendingSave().then(() => setActiveId(id));
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
