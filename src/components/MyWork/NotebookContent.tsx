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
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  AlertTriangle,
  Archive,
  BookOpen,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  Clock,
  FileText,
  History,
  Layers,
  Lightbulb,
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
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
import {
  detectMentionTrigger,
  INITIAL_MENTION_STATE,
  type MentionEntity,
  mentionEntityToEmbedRef,
  type MentionMenuState,
  NotebookMentionMenu,
} from './notebook/NotebookMentionMenu';
import { NotebookProgressChip } from './notebook/NotebookProgressChip';
import { NotebookQuickCapture } from './notebook/NotebookQuickCapture';
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
  isPolish
    ? 'Najpierw dopracuj notatkę: dodaj więcej treści albo czytelny outline, zanim przekonwertujesz ją do deliverable.'
    : 'Refine the note first: add more content or a clearer outline before converting it into a deliverable.';

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
    return isPolish
      ? [
          '- Kontekst i cel',
          '- Najważniejsze obserwacje',
          '- Implikacje biznesowe',
          '- Następne kroki',
        ].join('\n')
      : [
          '- Context and goal',
          '- Key observations',
          '- Business implications',
          '- Next steps',
        ].join('\n');
  }

  if (target === 'assessment') {
    return isPolish
      ? ['- Zakres oceny', '- Główne pytania', '- Evidence do zebrania', '- Obszary ryzyka'].join(
          '\n'
        )
      : ['- Assessment scope', '- Core questions', '- Evidence to collect', '- Risk areas'].join(
          '\n'
        );
  }

  return isPolish
    ? ['- Executive summary', '- Analiza problemu', '- Opcje działania', '- Rekomendacje'].join(
        '\n'
      )
    : ['- Executive summary', '- Problem analysis', '- Options', '- Recommendations'].join('\n');
};

/* ------------------------------------------------------------------ */
/*  Editor styles for custom blocks                                    */
/* ------------------------------------------------------------------ */

const EDITOR_STYLES = `
/* Typography — premium feel */
.ProseMirror {
  line-height: 1.75;
  font-size: 1rem;
  color: #1e293b;
  caret-color: #1E3A5F;
}
.dark .ProseMirror { color: #e2e8f0; caret-color: #8EAACF; }
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
  accent-color: #1E3A5F;
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
.nb-callout[data-variant="critical"] { border-color: #f43f5e; background: linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%); }
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
  background: rgba(30,58,95,0.08);
  color: #1E3A5F;
  padding: 0.15em 0.4em;
  border-radius: 0.25rem;
  font-size: 0.875em;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}
.dark .ProseMirror code:not(pre code) { background: rgba(142,170,207,0.15); color: #AECAEF; }

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
  border-left: 3px solid #1E3A5F;
  padding-left: 1rem;
  margin: 0.75rem 0;
  color: #64748b;
  font-style: italic;
}
.dark .ProseMirror blockquote { border-left-color: #6E8AAF; color: #94a3b8; }

/* Link */
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
.ProseMirror li::marker { color: #1E3A5F; }
.dark .ProseMirror li::marker { color: #8EAACF; }

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
  border: 1px solid #e2e8f0;
  display: block;
}
.dark .ProseMirror img.nb-image,
.dark .ProseMirror img { border-color: rgba(255,255,255,0.08); }
.ProseMirror img.ProseMirror-selectednode {
  outline: 2px solid #1E3A5F;
  outline-offset: 2px;
}
.dark .ProseMirror img.ProseMirror-selectednode { outline-color: #6E8AAF; }

/* Bookmark card (rich link preview) */
.ProseMirror a.nb-bookmark {
  display: flex;
  align-items: stretch;
  gap: 0;
  margin: 0.75rem 0;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  overflow: hidden;
  text-decoration: none;
  background: #ffffff;
  transition: border-color 0.15s, background 0.15s;
  cursor: pointer;
}
.ProseMirror a.nb-bookmark:hover { border-color: #cbd5e1; background: #f8fafc; }
.dark .ProseMirror a.nb-bookmark { border-color: rgba(255,255,255,0.10); background: rgba(255,255,255,0.02); }
.dark .ProseMirror a.nb-bookmark:hover { border-color: rgba(255,255,255,0.18); background: rgba(255,255,255,0.04); }
.ProseMirror a.nb-bookmark.ProseMirror-selectednode { outline: 2px solid #1E3A5F; outline-offset: 2px; }
.dark .ProseMirror a.nb-bookmark.ProseMirror-selectednode { outline-color: #6E8AAF; }
.ProseMirror .nb-bookmark-body { flex: 1 1 auto; min-width: 0; padding: 0.7rem 0.85rem; display: flex; flex-direction: column; gap: 0.2rem; }
.ProseMirror .nb-bookmark-title {
  font-weight: 600; font-size: 0.9rem; color: #0f172a;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.dark .ProseMirror .nb-bookmark-title { color: #e2e8f0; }
.ProseMirror .nb-bookmark-desc {
  font-size: 0.8rem; color: #64748b; line-height: 1.35;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.dark .ProseMirror .nb-bookmark-desc { color: #94a3b8; }
.ProseMirror .nb-bookmark-link { display: flex; align-items: center; gap: 0.35rem; margin-top: 0.1rem; font-size: 0.72rem; color: #94a3b8; }
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

/* Syntax highlighting (lowlight / highlight.js token classes) — dark code surface */
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
  const [pages, setPages] = useState<NotebookPage[]>([]);
  const [pagesLoading, setPagesLoading] = useState(true);
  const [pagesError, setPagesError] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const activePage = useMemo(() => pages.find((p) => p.id === activeId) || null, [pages, activeId]);
  const attemptedOpenPageRef = useRef<string | null>(null);

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
            isPolish
              ? 'Nie udało się otworzyć wskazanej notatki'
              : 'Failed to open the requested note'
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

  // Slash menu
  const [slashState, setSlashState] = useState<SlashMenuState>(INITIAL_SLASH_STATE);
  const [mentionState, setMentionState] = useState<MentionMenuState>(INITIAL_MENTION_STATE);
  // Bumped whenever this note's link graph changes, to refresh the backlinks bar.
  const [backlinksRefresh, setBacklinksRefresh] = useState(0);
  const editorContainerRef = useRef<HTMLDivElement>(null);

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
  const proposalRequestSeqRef = useRef(0);

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
          placeholder: isPolish
            ? 'Zacznij pisać… Wpisz / aby wstawić blok'
            : 'Start writing… Type / to insert a block',
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
      if (!safeSetContent({ type: 'doc', content: [] })) return;
      setTitle('');
      setPageProjectId('');
      setPageTags([]);
      return;
    }
    if (!safeSetContent(activePage.contentJson || { type: 'doc', content: [] })) return;
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
      try {
        const q = String(searchQuery || '').trim();
        if (q) trackFunnelEvent('notebook_search_used', { query: q });

        const list = await Api.getNotebookPages({
          projectId: projectId || undefined,
          notebookId: notebookId || undefined,
          q: q || undefined,
          limit: 50,
        });
        const arr = list || [];
        setPages(arr);
        setHasMore(arr.length >= 50);
        setActiveId((prev) => prev || arr?.[0]?.id || null);
        setPagesError(false);
      } catch (e) {
        console.error('Failed to load notebook pages', e);
        setPagesError(true);
        toast.error(t('myWork.errors.fetchFailed', 'Failed to load'));
      } finally {
        setPagesLoading(false);
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

  // Sidebar filters & inbox state
  // Status axis (Wszystkie/Inbox/Aktywne) is owned by Menu 3 in the hub — the
  // in-column tab bar that used to duplicate it is gone (N5/U11).
  const [statusTab, setStatusTab] = useState<'inbox' | 'active' | 'all'>(pageStatusFilter ?? 'all');
  useEffect(() => {
    if (pageStatusFilter !== undefined) setStatusTab(pageStatusFilter);
  }, [pageStatusFilter]);

  // N5 left-column lenses (independent of the status axis):
  //  • scope — who owns the page (mine vs the rest of the team)
  //  • view  — flattened "Today" sections (pinned / recent / to-review / fresh)
  type NotebookScopeLens = 'all' | 'mine' | 'team';
  type NotebookViewLens = 'all' | 'pinned' | 'recent' | 'toReview' | 'fresh';
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
      return true;
    },
    [isRecentPage, isToReviewPage, isFreshPage]
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
    }),
    [scopedPages, isRecentPage, isToReviewPage, isFreshPage]
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
      toast.error('Failed to pin');
    }
  }, []);

  const handleSetStatus = useCallback(async (pageId: string, status: NotebookPageStatus) => {
    try {
      await Api.setNotebookPageStatus(pageId, status);
      setPages((prev) => prev.map((p) => (p.id === pageId ? { ...p, status } : p)));
    } catch {
      toast.error('Failed to update status');
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
      toast.success(isPolish ? 'Powiązano' : 'Linked');
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

  const persistNotebookDraft = useCallback(
    async (draft: NotebookPage) => {
      queuedSaveRef.current = draft;
      if (isSavingRef.current) return;

      while (queuedSaveRef.current) {
        const nextDraft = queuedSaveRef.current;
        queuedSaveRef.current = null;
        isSavingRef.current = true;

        trackFunnelEvent('notebook_page_edited', { pageId: nextDraft.id });

        const newMaturity = computeMaturity(nextDraft);
        const persistedDraft: NotebookPage = { ...nextDraft, maturity: newMaturity };

        try {
          await Api.updateNotebookPage(persistedDraft.id, {
            title: persistedDraft.title,
            projectId: persistedDraft.projectId,
            visibility: persistedDraft.visibility,
            tags: persistedDraft.tags,
            contentJson: persistedDraft.contentJson,
            contentText: persistedDraft.contentText,
            maturity: newMaturity,
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
          // eslint-disable-next-line no-console
          console.error('Failed to save notebook page', e);
          toast.error(t('myWork.errors.updateFailed', 'Failed to update'));
        } finally {
          isSavingRef.current = false;
        }
      }
    },
    [generateSummary, t]
  );

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

  const handleNewPage = useCallback(
    async (template?: PageTemplate) => {
      try {
        await flushPendingSave();
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

        await fetchPages();
        if (created?.id) setActiveId(created.id);
        toast.success(isPolish ? 'Utworzono stronę' : 'Page created');
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
                  className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-500/20 text-slate-700 hover:bg-slate-500/30"
                >
                  {isPolish ? 'Konwertuj' : 'Convert'}
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
      toast.error(
        isPolish ? 'Nie udało się pobrać pliku źródłowego' : 'Failed to download source file'
      );
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
        toast.error(isPolish ? 'Nie udało się wgrać załączników' : 'Failed to upload attachments');
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
        toast.error(isPolish ? 'Obraz jest zbyt duży (max 5 MB)' : 'Image is too large (max 5 MB)');
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
        toast.error(isPolish ? 'Nie udało się wczytać obrazu' : 'Failed to load image');
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
      const toastId = toast.loading(isPolish ? 'Pobieram podgląd…' : 'Fetching preview…');
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
        toast.error(isPolish ? 'Nie udało się zapisać okładki' : 'Failed to save cover');
      }
    },
    [activePage?.id, coverUrl, isPolish]
  );

  const handlePickCover = useCallback(() => coverInputRef.current?.click(), []);

  const handleCoverFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) return;
      if (file.size > 5 * 1024 * 1024) {
        toast.error(
          isPolish ? 'Okładka jest zbyt duża (max 5 MB)' : 'Cover is too large (max 5 MB)'
        );
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
        toast.error(isPolish ? 'Nie udało się usunąć załącznika' : 'Failed to delete attachment');
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
        toast.error(
          isPolish ? 'Nie udało się odświeżyć propozycji AI' : 'Failed to refresh AI proposals'
        );
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
      const titleLabel = label || (isPolish ? 'Komentarz AI' : 'AI comment');
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
        toast.success(isPolish ? 'Propozycja AI gotowa do review' : 'AI proposal ready for review');
      } catch (error) {
        console.error('Failed to create notebook AI proposal', error);
        toast.error(
          isPolish ? 'Nie udało się utworzyć propozycji AI' : 'Failed to create AI proposal'
        );
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
            ? isPolish
              ? 'Propozycja została zaakceptowana'
              : 'Proposal accepted'
            : isPolish
              ? 'Propozycja została odrzucona'
              : 'Proposal rejected'
        );
      } catch (error) {
        console.error('Failed to resolve notebook AI proposal', error);
        toast.error(
          action === 'accepted'
            ? isPolish
              ? 'Nie udało się zaakceptować propozycji'
              : 'Failed to accept proposal'
            : isPolish
              ? 'Nie udało się odrzucić propozycji'
              : 'Failed to reject proposal'
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
          title: activePage.title || (isPolish ? 'Nowy artefakt' : 'New deliverable'),
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
            ? isPolish
              ? 'zadanie'
              : 'task'
            : apiTarget === 'decision'
              ? isPolish
                ? 'decyzję'
                : 'decision'
              : apiTarget === 'report'
                ? isPolish
                  ? 'raport'
                  : 'report'
                : apiTarget === 'presentation'
                  ? isPolish
                    ? 'prezentację'
                    : 'presentation'
                  : isPolish
                    ? 'inicjatywę'
                    : 'initiative';
        toast.success(
          isPolish ? `Utworzono ${label}: ${result.title}` : `Created ${apiTarget}: ${result.title}`
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
      const { chatUrl } = await expandNotebookPageToCanvasDraft({
        id: activePage.id,
        title: title || activePage.title || '',
        contentJson,
        contentText: activePage.contentText,
      });
      toast.success(
        isPolish ? 'Utworzono szkic dokumentu w Canvas' : 'Document draft created in Canvas'
      );
      navigate(chatUrl);
    } catch (error: any) {
      console.error('Failed to expand note into Canvas document', error);
      toast.error(isPolish ? 'Nie udało się utworzyć dokumentu' : 'Failed to create the document');
    } finally {
      setIsExpandingToDocument(false);
    }
  }, [activePage, editor, isExpandingToDocument, isPolish, navigate, title]);

  const handleHandoffInitiatives = useCallback(async () => {
    if (!activePage) return;
    try {
      await Api.convertNotebookPage(activePage.id, 'initiative', {
        title: activePage.title || (isPolish ? 'Inicjatywa z notatki' : 'Initiative from note'),
        description: activePage.contentText?.trim() || undefined,
      });
      toast.success(isPolish ? 'Inicjatywa utworzona' : 'Initiative created');
      trackFunnelEvent('notebook_handoff', { target: 'initiatives', noteId: activePage.id });
    } catch (err: any) {
      toast.error(
        err?.message ||
          (isPolish ? 'Nie udało się utworzyć inicjatywy' : 'Failed to create initiative')
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
          ? isPolish
            ? 'raport'
            : 'report'
          : target === 'presentation'
            ? isPolish
              ? 'prezentację'
              : 'presentation'
            : isPolish
              ? 'ocenę'
              : 'assessment';
      toast.success(
        isPolish ? `Utworzono ${label}: ${result.title}` : `Created ${target}: ${result.title}`
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
      toast.error(err?.message || (isPolish ? 'Konwersja nie powiodła się' : 'Conversion failed'));
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
    <div className="flex h-[calc(100vh-220px)] min-h-[520px] gap-1.5 p-3 overflow-hidden bg-white dark:bg-navy-950">
      <style>{EDITOR_STYLES}</style>

      {/* Sidebar */}
      <div className="w-80 shrink-0 rounded-2xl border border-slate-200/70 dark:border-white/[0.06] overflow-hidden bg-white dark:bg-navy-900 flex flex-col">
        {/* Sidebar header */}
        <div className="px-4 py-3 border-b border-slate-200/60 dark:border-navy-800/60">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5 min-w-0">
              {onBackToLibrary ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={onBackToLibrary}
                      data-testid="notebook-back-to-library"
                      className="w-7 h-7 shrink-0 rounded-lg bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors"
                    >
                      <ChevronLeft size={16} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isPolish ? 'Wszystkie notatniki' : 'All notebooks'}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <div className="w-7 h-7 shrink-0 rounded-lg bg-slate-100 dark:bg-navy-800 flex items-center justify-center">
                  <BookOpen size={14} className="text-slate-500 dark:text-slate-400" />
                </div>
              )}
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {notebookTitle || t('myWork.notebook.title', 'Notebook')}
                </div>
                <div className="text-[10px] text-slate-600 dark:text-slate-500">
                  {filteredPages.length} {isPolish ? 'stron' : 'pages'}
                </div>
              </div>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setTemplateModalOpen(true)}
                  data-testid="notebook-new-page-button"
                  className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 transition-colors"
                >
                  <Plus size={16} />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t('myWork.notebook.new', 'New page')}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* N5 — Capture box: drop a thought or link straight into this notebook */}
        <div className="px-3 pt-3 pb-2 border-b border-slate-200/60 dark:border-white/[0.06]">
          <NotebookQuickCapture notebookId={notebookId} onCreated={() => void fetchPages()} />
        </div>

        {/* N5 — Scope lens (who owns the page). Auto-hides when there is nothing
            from teammates, so personal notebooks stay clutter-free. */}
        {teamPagesExist && (
          <div className="px-3 pt-2.5">
            <div className="inline-flex w-full items-center rounded-lg bg-slate-100 dark:bg-white/[0.04] p-0.5">
              {(
                [
                  { key: 'all', label: isPolish ? 'Wszystkie' : 'All' },
                  { key: 'mine', label: isPolish ? 'Moje' : 'Mine' },
                  { key: 'team', label: isPolish ? 'Zespół' : 'Team' },
                ] as Array<{ key: NotebookScopeLens; label: string }>
              ).map((s) => (
                <button
                  key={s.key}
                  onClick={() => setScopeLens(s.key)}
                  className={`flex-1 rounded-md py-1 text-[11px] font-semibold transition-colors ${
                    scopeLens === s.key
                      ? 'bg-white dark:bg-navy-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* N5 — View lens (flattened "Today" sections as chips). */}
        <div className="flex flex-wrap items-center gap-1 px-3 py-2.5 border-b border-slate-200/60 dark:border-white/[0.06]">
          {(
            [
              { key: 'all', label: isPolish ? 'Wszystkie' : 'All', icon: null },
              { key: 'pinned', label: isPolish ? 'Przypięte' : 'Pinned', icon: <Pin size={11} /> },
              { key: 'recent', label: isPolish ? 'Ostatnie' : 'Recent', icon: <Clock size={11} /> },
              {
                key: 'toReview',
                label: isPolish ? 'Do przeglądu' : 'To review',
                icon: <AlertTriangle size={11} />,
              },
              { key: 'fresh', label: isPolish ? 'Świeże' : 'Fresh', icon: <Sparkles size={11} /> },
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
                    ? 'bg-slate-800 dark:bg-white text-white dark:text-navy-900'
                    : 'bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/[0.08]'
                }`}
              >
                {v.icon}
                {v.label}
                {v.key !== 'all' && count > 0 && (
                  <span
                    className={`rounded-full px-1 text-[9px] ${
                      active
                        ? 'bg-white/20 dark:bg-navy-900/20'
                        : 'bg-white dark:bg-white/[0.08] text-slate-500'
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
                <FileText size={20} className="text-slate-600" />
              </div>
              {(() => {
                // A lens/filter is narrowing an otherwise non-empty notebook →
                // say "no matches", not "create your first page".
                const isFiltered = statusTab !== 'all' || scopeLens !== 'all' || viewLens !== 'all';
                const hasAnyPages = pages.length > 0;
                if (isFiltered && hasAnyPages) {
                  return (
                    <>
                      <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        {isPolish ? 'Brak pasujących stron' : 'No matching pages'}
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-500 mt-1">
                        {isPolish ? 'Zmień filtr powyżej' : 'Try a different filter above'}
                      </div>
                    </>
                  );
                }
                return (
                  <>
                    <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
                      {t('myWork.notebook.empty', 'No pages yet')}
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-500 mt-1">
                      {isPolish ? 'Utwórz pierwszą stronę' : 'Create your first page'}
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
                        ? 'bg-slate-100 dark:bg-white/[0.08] border border-slate-200 dark:border-white/[0.10] shadow-sm'
                        : 'hover:bg-slate-50 dark:hover:bg-white/[0.03] border border-transparent'
                    }`}
                  >
                    <button
                      onClick={async () => {
                        await flushPendingSave();
                        setActiveId(p.id);
                      }}
                      className="w-full text-left px-3 py-2.5"
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
                                isActive
                                  ? 'text-slate-900 dark:text-white'
                                  : 'text-slate-800 dark:text-slate-200'
                              }`}
                            >
                              {p.title || (isPolish ? 'Bez tytułu' : 'Untitled')}
                            </span>
                            {timeAgo && (
                              <span className="text-[10px] text-c-text-muted shrink-0 tabular-nums">
                                {timeAgo}
                              </span>
                            )}
                          </div>

                          {p.summary && (
                            <div className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-500 line-clamp-1 leading-relaxed">
                              {p.summary}
                            </div>
                          )}

                          <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                            <span className="inline-flex items-center gap-1 rounded-full border border-c-border-subtle bg-c-surface px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-c-text-secondary">
                              <span className={`w-1.5 h-1.5 rounded-full ${matCfg.dot}`} />
                              {isPolish ? matCfg.labelPl : matCfg.label}
                            </span>
                            {(p as any).verificationStatus === 'verified' && (
                              <Badge
                                variant="outline"
                                className="border-emerald-300/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0 text-[9px]"
                                title={isPolish ? 'Zweryfikowana' : 'Verified'}
                              >
                                <CheckCircle2 size={9} className="inline" />
                              </Badge>
                            )}
                            {(p as any).staleAt && (
                              <Badge
                                variant="outline"
                                className="border-amber-300/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0 text-[9px]"
                                title={isPolish ? 'Nieaktualna' : 'Stale'}
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
                                  className="rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 px-1.5 py-0.5 text-[11px] font-medium"
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
                                  className="rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 text-[11px] font-medium"
                                  title={convertedSummary.visibleTypes.join(', ')}
                                >
                                  ✓ {convertedSummary.visibleTypes.join(', ')}
                                  {convertedSummary.extraCount > 0
                                    ? ` +${convertedSummary.extraCount}`
                                    : ''}
                                </span>
                              );
                            })()}
                            {p.tags &&
                              p.tags.slice(0, 2).map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-md bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400 px-1.5 py-0.5 text-[11px] font-medium"
                                >
                                  {tag}
                                </span>
                              ))}
                            {p.tags && p.tags.length > 2 && (
                              <span className="text-[9px] text-slate-600">
                                +{p.tags.length - 2}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>

                    {/* Quick triage actions on hover */}
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-white/90 dark:bg-navy-900/90 rounded-lg shadow-sm border border-slate-200/60 dark:border-white/[0.08] px-0.5 py-0.5">
                      {p.status === 'inbox' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetStatus(p.id, 'active');
                          }}
                          className="p-1 rounded text-blue-500 hover:bg-blue-500/10 transition-colors"
                          title={isPolish ? 'Zacznij pracować' : 'Start working'}
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
                        className={`p-1 rounded transition-colors ${p.pinned ? 'text-amber-500 bg-amber-500/10' : 'text-slate-600 hover:text-amber-500 hover:bg-amber-500/10'}`}
                        title={isPolish ? 'Przypnij' : 'Pin'}
                      >
                        <Pin size={10} />
                      </button>
                      {p.status !== 'archived' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetStatus(p.id, 'archived');
                          }}
                          className="p-1 rounded text-slate-600 hover:text-slate-600 hover:bg-slate-500/10 transition-colors"
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
      <div className="flex-1 flex min-w-0 gap-1.5 overflow-hidden">
        <div className="flex-1 min-w-0 flex flex-col rounded-2xl border border-slate-200/70 dark:border-white/[0.06] overflow-hidden bg-slate-50 dark:bg-navy-900">
          {!activePage && pagesLoading ? (
            /* Editor skeleton — avoids a blank "white" pane during first load. */
            <div className="flex-1 overflow-hidden">
              <div className="mx-auto max-w-3xl px-6 py-8" aria-hidden="true">
                <div className="mb-4 h-40 w-full rounded-2xl bg-slate-200/60 dark:bg-white/[0.05] animate-pulse" />
                <div className="mb-6 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-slate-200/70 dark:bg-white/[0.06] animate-pulse" />
                  <div className="h-7 w-2/3 rounded-lg bg-slate-200/70 dark:bg-white/[0.06] animate-pulse" />
                </div>
                <div className="space-y-3">
                  <div className="h-4 w-full rounded bg-slate-200/60 dark:bg-white/[0.05] animate-pulse" />
                  <div className="h-4 w-11/12 rounded bg-slate-200/60 dark:bg-white/[0.05] animate-pulse" />
                  <div className="h-4 w-4/5 rounded bg-slate-200/60 dark:bg-white/[0.05] animate-pulse" />
                  <div className="h-4 w-2/3 rounded bg-slate-200/60 dark:bg-white/[0.05] animate-pulse" />
                </div>
              </div>
            </div>
          ) : !activePage && pagesError ? (
            <div className="flex h-full items-center justify-center p-8">
              <div className="text-center">
                <AlertTriangle
                  size={36}
                  className="mx-auto mb-3 text-slate-400 dark:text-slate-500"
                />
                <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
                  {isPolish ? 'Nie udało się wczytać notatek.' : 'Failed to load notes.'}
                </p>
                <button
                  type="button"
                  onClick={() => void fetchPages()}
                  className="text-sm font-medium text-slate-600 hover:underline dark:text-slate-400"
                >
                  {isPolish ? 'Spróbuj ponownie' : 'Retry'}
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
                        <div className="text-[11px] text-slate-600 dark:text-slate-500 mt-0.5">
                          {tmpl.desc}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* AI suggestion prompt */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-navy-800/50 border border-slate-200/60 dark:border-white/[0.06]">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-navy-800 flex items-center justify-center shrink-0">
                    <Sparkles size={14} className="text-[var(--c-info)]" />
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
                  <NotebookExportMenu
                    page={{
                      id: activePage.id,
                      title: title,
                      contentJson: activePage.contentJson,
                      contentText: activePage.contentText,
                    }}
                    isPolish={isPolish}
                    className="shrink-0"
                  />
                  <button
                    onClick={() => setShowVersionHistory((v) => !v)}
                    title={isPolish ? 'Historia wersji' : 'Version history'}
                    aria-label={isPolish ? 'Historia wersji' : 'Version history'}
                    className={`shrink-0 p-1.5 rounded-lg transition-colors ${showVersionHistory ? 'bg-slate-200/70 dark:bg-navy-800 text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800'}`}
                  >
                    <History size={14} />
                  </button>
                  {/* N4 (U12): icon-only + tooltip — expand note into a Canvas document draft */}
                  <button
                    onClick={() => void handleExpandToDocument()}
                    disabled={isExpandingToDocument}
                    data-testid="notebook-expand-to-document"
                    title={
                      isPolish
                        ? 'Rozwiń w dokument — utwórz dokument w Canvas z kopią notatki'
                        : 'Expand into document — create a Canvas doc from this note'
                    }
                    aria-label={isPolish ? 'Rozwiń w dokument' : 'Expand into document'}
                    className="ml-auto shrink-0 p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors disabled:opacity-60 disabled:cursor-wait"
                  >
                    <FileText size={14} className={isExpandingToDocument ? 'animate-pulse' : ''} />
                  </button>
                  {/* N4 (U12): connection graph — icon-only + tooltip, monochrome active */}
                  <button
                    onClick={() => setShowGraphView((v) => !v)}
                    title={isPolish ? 'Graf powiązań' : 'Connection graph'}
                    aria-label={isPolish ? 'Graf powiązań' : 'Connection graph'}
                    className={`shrink-0 p-1.5 rounded-lg transition-colors ${showGraphView ? 'bg-slate-200/70 dark:bg-navy-800 text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800'}`}
                  >
                    <Network size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotebookRailOpen(!notebookRailOpen)}
                    title={
                      notebookRailOpen
                        ? isPolish
                          ? 'Zamknij panel boczny'
                          : 'Close side panel'
                        : isPolish
                          ? 'Otwórz panel boczny (narzędzia AI + kontekst)'
                          : 'Open side panel (AI tools + context)'
                    }
                    className={`mr-2 inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors ${
                      notebookRailOpen
                        ? 'border-indigo-400/60 bg-indigo-600 text-white dark:border-indigo-400/40 dark:bg-indigo-600'
                        : 'border-slate-200/60 bg-white/60 text-slate-500 hover:bg-slate-100 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-400 dark:hover:bg-white/[0.08]'
                    }`}
                  >
                    <Layers size={12} />
                  </button>
                  {/* N1: hamburger ⋯ — all note actions in one menu */}
                  <button
                    type="button"
                    onClick={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      setHamburgerPos({ x: Math.max(8, r.right - 240), y: r.bottom + 4 });
                    }}
                    title={isPolish ? 'Menu notatki' : 'Note menu'}
                    aria-label={isPolish ? 'Menu notatki' : 'Note menu'}
                    className="shrink-0 p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                  >
                    <MoreHorizontal size={16} />
                  </button>
                </div>
              </div>

              {hamburgerPos && activePage && (
                <NotebookHamburgerMenu
                  x={hamburgerPos.x}
                  y={hamburgerPos.y}
                  isPolish={!!isPolish}
                  onClose={() => setHamburgerPos(null)}
                  onExpandDocument={() => void handleExpandToDocument()}
                  onConvert={(t: NotebookConvertTarget) =>
                    void handleConvertFromPanel(t as ConvertTarget)
                  }
                  onAskAI={() => setAiCommand('action')}
                  onDelete={() => void handleDeletePage()}
                />
              )}

              {/* Version History panel (toggleable) */}
              {showVersionHistory && activePage && (
                <div className="border-b border-slate-200/60 dark:border-navy-800/60 bg-slate-50/80 dark:bg-navy-950/60 max-h-64 overflow-y-auto nb-scroll">
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
                          placeholder={isPolish ? 'Bez tytułu' : 'Untitled'}
                          className="w-full bg-transparent text-3xl font-semibold tracking-tight text-slate-900 dark:text-white outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
                        />
                        {/* Tags inline */}
                        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                          <Tag size={11} className="text-slate-600 dark:text-slate-400 shrink-0" />
                          {pageTags.map((tag) => (
                            <span
                              key={tag}
                              className="group/tag inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400 px-2 py-0.5 text-[11px] font-medium hover:bg-slate-200 dark:hover:bg-white/[0.1] hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
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
                            placeholder={isPolish ? '+ tag' : '+ tag'}
                            className="min-w-[50px] max-w-[120px] bg-transparent text-[11px] text-slate-600 dark:text-slate-500 outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
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
                                  className="inline-flex items-center rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 px-2 py-0.5 text-[11px] font-medium"
                                  title={uploadSource.title}
                                >
                                  {uploadSource.label}
                                </span>
                                {hasStoredSourceFile ? (
                                  <button
                                    type="button"
                                    onClick={() => void handleDownloadSourceFile()}
                                    disabled={isDownloadingSourceFile}
                                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 transition-colors hover:border-sky-200 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:border-sky-400/30 dark:hover:text-sky-300"
                                    title={
                                      isPolish
                                        ? 'Pobierz oryginalny plik źródłowy'
                                        : 'Download original source file'
                                    }
                                  >
                                    <Paperclip size={11} />
                                    {isPolish ? 'Pobierz źródło' : 'Download source'}
                                  </button>
                                ) : null}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* N3: Lifecycle strip — clean status pills (status-aware, no raw selects) */}
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
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
                        title={isPolish ? 'Weryfikacja' : 'Verification'}
                        className={`text-[11px] px-2.5 py-1 rounded-md border cursor-pointer transition-colors ${
                          (activePage.verificationStatus as NotebookVerificationStatus) ===
                          'verified'
                            ? 'bg-emerald-500/10 border-emerald-300/40 text-emerald-700 dark:text-emerald-300'
                            : (activePage.verificationStatus as NotebookVerificationStatus) ===
                                'disputed'
                              ? 'bg-amber-500/10 border-amber-300/40 text-amber-700 dark:text-amber-300'
                              : 'bg-slate-100 dark:bg-navy-800 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <option value="unverified">
                          {isPolish ? '○ Nieweryfikowana' : '○ Unverified'}
                        </option>
                        <option value="verified">
                          {isPolish ? '✓ Zweryfikowana' : '✓ Verified'}
                        </option>
                        <option value="disputed">
                          {isPolish ? '! Zakwestionowana' : '! Disputed'}
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
                        title={isPolish ? 'Cykl recenzji' : 'Review cadence'}
                        className="text-[11px] px-2.5 py-1 rounded-md border bg-slate-100 dark:bg-navy-800 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                      >
                        <option value="weekly">{isPolish ? 'Co tydzień' : 'Weekly'}</option>
                        <option value="monthly">{isPolish ? 'Co miesiąc' : 'Monthly'}</option>
                        <option value="quarterly">{isPolish ? 'Co kwartał' : 'Quarterly'}</option>
                        <option value="never">{isPolish ? 'Nigdy' : 'Never'}</option>
                      </select>
                      {(activePage.staleAt || activePage.lastReviewedAt) && (
                        <span className="text-[11px]">
                          {activePage.staleAt ? (
                            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                              <AlertTriangle size={11} />
                              {isPolish ? 'Nieaktualna' : 'Stale'}
                            </span>
                          ) : activePage.lastReviewedAt ? (
                            <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                              <CheckCircle2 size={11} className="text-emerald-500" />
                              {isPolish ? 'Sprawdzono' : 'Reviewed'}{' '}
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
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 text-[11px] font-medium transition-colors"
                      >
                        <RefreshCw size={10} />
                        {isPolish ? 'Oznacz sprawdzone' : 'Mark reviewed'}
                      </button>
                    </div>

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
                    <div className="mb-4 rounded-xl border border-slate-200/70 bg-slate-50/80 px-3 py-3 dark:border-white/[0.06] dark:bg-white/[0.03]">
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {isPolish ? 'Mini outline' : 'Mini outline'}
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
                            className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:bg-white/[0.06] dark:text-slate-300 dark:hover:bg-white/[0.1]"
                          >
                            {`H${heading.level} ${heading.text}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {proposalLoadError ? (
                    <div className="mb-4 rounded-xl border border-amber-200/70 bg-amber-50/80 px-3 py-3 text-[11px] text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                      {isPolish
                        ? 'Nie udało się załadować propozycji AI dla tej notatki. Odśwież stronę lub spróbuj ponownie za chwilę.'
                        : 'Could not load AI proposals for this note. Refresh the page or try again in a moment.'}
                    </div>
                  ) : null}

                  {pendingAIProposals.length > 0 && (
                    <div
                      ref={proposalReviewRef}
                      className="mb-4 rounded-xl border border-slate-200/70 bg-slate-50/80 px-3 py-3 dark:border-slate-500/20 dark:bg-slate-500/10"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {isPolish ? 'AI propose -> accept' : 'AI propose -> accept'}
                          </div>
                          <div className="text-[11px] text-slate-600 dark:text-slate-200/80">
                            {isPolish
                              ? `${pendingAIProposals.length} propozycje czekają na review`
                              : `${pendingAIProposals.length} proposals waiting for review`}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 space-y-2">
                        {pendingAIProposals.slice(0, 3).map((proposal) => (
                          <div
                            key={proposal.id}
                            className="rounded-lg border border-slate-200/80 bg-white/80 px-3 py-2 dark:border-slate-400/20 dark:bg-navy-950/40"
                          >
                            <div className="text-[11px] font-medium text-slate-700 dark:text-slate-200">
                              {proposal.rationale || (isPolish ? 'Propozycja AI' : 'AI proposal')}
                            </div>
                            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                              {extractText(proposal.blockContent)}
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  void resolveNotebookAIProposal(proposal.id, 'accepted')
                                }
                                className="rounded-md bg-slate-600 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-slate-500"
                              >
                                {isPolish ? 'Akceptuj' : 'Accept'}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void resolveNotebookAIProposal(proposal.id, 'rejected')
                                }
                                className="rounded-md bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:bg-white/[0.1]"
                              >
                                {isPolish ? 'Odrzuć' : 'Reject'}
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
                          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            {selectedEmbedPreview.artifactType}
                            {selectedEmbedPreview.status ? ` · ${selectedEmbedPreview.status}` : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedEmbedPreview(null)}
                          className="rounded-md p-1 text-slate-600 transition-colors hover:bg-white/70 hover:text-slate-600 dark:hover:bg-white/[0.06] dark:hover:text-slate-200"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      {selectedEmbedPreview.snippet ? (
                        <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">
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
                          ? isPolish
                            ? 'Odpowiedź AI do notatki'
                            : 'AI answer for note'
                          : aiCommand === 'expand'
                            ? isPolish
                              ? 'Rozwinięcie AI'
                              : 'AI expansion'
                            : aiCommand === 'challenge'
                              ? isPolish
                                ? 'Pytania krytyczne AI'
                                : 'AI challenge questions'
                              : isPolish
                                ? 'Plan działań AI'
                                : 'AI action plan',
                        aiCommand === 'ask'
                          ? isPolish
                            ? 'Odpowiedź AI'
                            : 'AI answer'
                          : aiCommand === 'expand'
                            ? isPolish
                              ? 'Rozwinięcie AI'
                              : 'AI expansion'
                            : aiCommand === 'challenge'
                              ? isPolish
                                ? 'Pytania krytyczne AI'
                                : 'AI challenge'
                              : isPolish
                                ? 'Plan działań AI'
                                : 'AI action plan'
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
                    className="absolute z-50 max-h-64 w-44 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-navy-700 dark:bg-navy-900"
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
                            ? 'bg-slate-500/10 text-slate-700 dark:text-slate-300'
                            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/[0.06]'
                        }`}
                      >
                        {lang.label}
                        {codeLangMenu.current === lang.id ? (
                          <CheckCircle2 size={13} className="text-slate-500" />
                        ) : null}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Graph view — toggleable panel (topic+backlink connections) */}
        {showGraphView && activePage && (
          <div className="w-72 shrink-0 rounded-2xl border border-slate-200/70 dark:border-white/[0.06] overflow-hidden bg-white dark:bg-navy-950 flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200/60 dark:border-navy-800/60">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                <Network size={13} />
                {isPolish ? 'Graf powiązań' : 'Connection graph'}
              </div>
              <button
                onClick={() => setShowGraphView(false)}
                className="p-0.5 rounded text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
              >
                <X size={13} />
              </button>
            </div>
            <NotebookGraphView pageId={activePage.id} pageTitle={title} isPolish={isPolish} />
          </div>
        )}

        {/* L-03: Consolidated right rail — Tab A (Praca/Work) + Tab B (Kontekst/Context) */}
        <NotebookRightRail
          open={notebookRailOpen}
          activeTab={notebookRailTab}
          onTabChange={setNotebookRailTab}
          onClose={() => setNotebookRailOpen(false)}
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
          getRelativeTime={(iso) => relativeTime(iso)}
          onOpenAIChat={() => setChatOpen(true)}
          onFocusAICommand={() => aiCommandPromptInputRef.current?.focus()}
          onConvert={handleConvertFromPanel}
          canConvertDeliverable={canConvertDeliverable}
          convertBlockedReason={deliverableGuardMessage}
        />
      </div>

      <NewPageModal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        onSelectTemplate={(tmpl) => handleNewPage(tmpl)}
        onUploadComplete={async (page) => {
          await fetchPages();
          if (page?.id) setActiveId(page.id);
          toast.success(
            isPolish ? 'Plik wgrano, utworzono notatkę' : 'File uploaded, note created'
          );
        }}
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
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/[0.08] dark:bg-navy-950">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  {isPolish ? 'Outline first' : 'Outline first'}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {isPolish
                    ? 'Przejrzyj i popraw outline przed utworzeniem artefaktu.'
                    : 'Review and edit the outline before creating the deliverable.'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOutlineDraft(null)}
                className="rounded-md p-1 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/[0.06] dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                  {isPolish ? 'Tytuł' : 'Title'}
                </label>
                <input
                  value={outlineDraft.title}
                  onChange={(e) =>
                    setOutlineDraft((prev) => (prev ? { ...prev, title: e.target.value } : prev))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white"
                />
              </div>

              {outlineDraft.target === 'assessment' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    {isPolish ? 'Typ oceny' : 'Assessment type'}
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
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white"
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
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                  {isPolish ? 'Outline' : 'Outline'}
                </label>
                <textarea
                  value={outlineDraft.outline}
                  onChange={(e) =>
                    setOutlineDraft((prev) => (prev ? { ...prev, outline: e.target.value } : prev))
                  }
                  rows={12}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOutlineDraft(null)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/[0.08] dark:text-slate-300 dark:hover:bg-white/[0.04]"
              >
                {isPolish ? 'Anuluj' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmOutlineDraft()}
                disabled={!outlineDraft.title.trim() || !outlineDraft.outline.trim()}
                className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPolish ? 'Utwórz artefakt' : 'Create deliverable'}
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
            className="relative w-full max-w-lg mx-4 rounded-2xl bg-white dark:bg-navy-900 shadow-2xl overflow-hidden"
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
