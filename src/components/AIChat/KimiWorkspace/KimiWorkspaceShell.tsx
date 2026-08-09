/**
 * KimiWorkspaceShell — KIMI-style split-screen: chat left ↔ artifact preview right.
 *
 * Shared shell for Wordy (P22), Excele (P23), and Prezentacje (P20) lanes.
 * Reuses UnifiedChatPanel in split mode + artifact preview pane.
 *
 * SSOT: FINAL_IMPLEMENTATION_PLAN_22_WORDY / FINAL_IMPLEMENTATION_PLAN_23_EXCELE
 */

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  LayoutGrid,
  Loader2,
  type LucideIcon,
  MoreVertical,
  Play,
  Presentation,
  RefreshCw,
  Sparkles,
  Table,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { useConversationStore } from '@/store/useConversationStore';
import { AppView } from '@/types';
import type {
  TabelePreviewRationale,
  TabelePreviewRelation,
  TabelePreviewSchemaField,
} from '@/types/tabeleArtifact';
import { createWorkspaceContext, getDefaultWorkspaceType } from '@/types/workspace';
import { deriveDeckBadgeFromNativeStatus } from '@/utils/deckLifecycleBadge';
import { isExceleEditEnabled } from '@/utils/exceleEditFlag';
import { isFormulaDisplayValue } from '@/utils/workbookGridPreview';

import { EditableSpreadsheetGrid } from './EditableSpreadsheetGrid';
import TabelePreviewLayout from './tabelePreview/TabelePreviewLayout';

export type KimiLane = 'excele' | 'prezentacje' | 'tabele';

// B3 fix (2026-07-22, workstream Excel): render only the first N rows of a big
// sheet by default — the "Show all" toggle un-caps the current sheet, the
// download button stays available so a huge sheet doesn't force a slow render.
const GRID_ROW_CAP = 100;

export type TaskStepStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface TaskStep {
  id: string;
  label: string;
  status: TaskStepStatus;
  detail?: string;
}

export type ArtifactPreviewType = 'pdf' | 'xlsx' | 'deck' | 'tabele' | 'none';

export interface ArtifactPreview {
  type: ArtifactPreviewType;
  title: string;
  url?: string;
  fileName?: string;
  pageCount?: number;
  sheetNames?: string[];
  summary?: string;
  kpiItems?: Array<{ label: string; value: string }>;
  tableData?: {
    columns: string[];
    rows: Array<Record<string, unknown>>;
  };
  perSheetData?: Array<{
    columns: string[];
    rows: Array<Record<string, unknown>>;
  }>;
  // "Najmniejszy arkusz, który jest naprawdę arkuszem" (2026-07-28): the RAW
  // WorkbookSchema sheets (columns[].key preserved, cells carry {value|formula}
  // separately — unlike `perSheetData` above, which collapses a formula cell
  // into a display string and loses the column key needed to address a PATCH).
  // Only `EditableSpreadsheetGrid` (behind `ff_excele_edit`) reads this; the
  // read-only table below keeps using `perSheetData` unchanged when the flag
  // is off or this is absent — zero regression.
  rawSheets?: import('@/utils/workbookFormulaEngine').FormulaSheet[];
  /** Optimistic concurrency token for generated_workbooks mutations. */
  workbookVersion?: number;
  workbookClassification?: 'public' | 'internal' | 'confidential';
  workbookLifecycle?: 'draft' | 'in_review' | 'approved' | 'final';
  workbookApprovalCurrent?: boolean;
  sourcePack?: unknown;
  evidenceRefs?: unknown[];
  qualityReport?: {
    score?: number;
    passed?: boolean;
    issues?: Array<{
      code?: string;
      severity?: 'CRITICAL' | 'MAJOR' | 'MINOR' | string;
      blocking?: boolean;
      sheet?: string;
      cell?: string | null;
      col?: string | null;
      message: string;
      fix?: string;
    }>;
  } | null;
  deckId?: string;
  deckStatus?: 'draft' | 'reviewed' | 'exported' | string;
  deckSlides?: Array<{
    slideId: string;
    intent: string;
    title: string;
    bulletPoints?: string[];
  }>;
  // Excele (P23) extras
  workbookId?: string;
  downloadUrl?: string;
  qualityScore?: number | null;
  pipelineLog?: unknown;
  // B3 fix (2026-07-22, workstream Excel): the real cell/formula grid
  // (perSheetData above) loads async from GET /api/workbook/:id/schema after
  // the fast metadata-only preview is already shown — these flags let the
  // grid area render its own loading/error state independent of the rest.
  gridLoading?: boolean;
  gridError?: string | null;
  // Tabele (Table Studio Foundation block) extras — populated by Sprint 3 / EPIC-2.
  // All optional; Sprint 2 only registers the shape so consumers can compile.
  tableId?: string;
  tabeleSchemaFields?: TabelePreviewSchemaField[];
  tabeleRelations?: TabelePreviewRelation[];
  tabeleRationale?: TabelePreviewRationale;
}

/** Menu 1 kebab item (SPEC-A §11.2 D-D: object code + permalink live only here). */
export interface KimiHeaderKebabItem {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}

interface KimiWorkspaceShellProps {
  lane: KimiLane;
  taskSteps: TaskStep[];
  totalSteps: number;
  completedSteps: number;
  isGenerating: boolean;
  isCompleted: boolean;
  isFailed?: boolean;
  failureReason?: string | null;
  preview: ArtifactPreview | null;
  onReplay?: () => void;
  onRemix?: () => void;
  onDownload?: () => void;
  onDownloadPdf?: () => void;
  onPreviewFile?: () => void;
  onAllFiles?: () => void;
  onStartGeneration?: (goal: string) => Promise<void>;
  chatSystemPrompt?: string;
  /**
   * SPEC-A prawy panel (`ArtifactRightPanel`, §10.2/§11.2) — moduł deklaruje
   * treść (sekcje Akcje/Właściwości/Powiązania/Komentarze/Historia), ten
   * komponent tylko rezerwuje miejsce obok podglądu. Opcjonalne — brak = 1:1
   * jak wcześniej (Wordy/Prezentacje/Tabele nie przekazują tego propa).
   */
  rightPanel?: React.ReactNode;
  /**
   * Menu 1 kebab (⋮) — overflow menu (SPEC-A §11.2 D-D: kod obiektu + link).
   * Opcjonalne, addytywne — brak = pasek nagłówka bez zmian.
   */
  kebabItems?: KimiHeaderKebabItem[];
  kebabAriaLabel?: string;
}

/**
 * KebabMenu — generyczne menu przepełnienia (⋮) dla Menu 1 powłoki artefaktu.
 * Wzorzec 1:1 z `HeaderOverflowMenu` (src/components/shared/NModeLayout/NModeHeader.tsx)
 * — portal do `<body>`, tokeny wyłącznie `c-*`, fokus `c-focus`.
 */
const KebabMenu: React.FC<{ items: KimiHeaderKebabItem[]; ariaLabel: string }> = ({
  items,
  ariaLabel,
}) => {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const update = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (r)
        setPos({ top: r.bottom + 6, right: Math.max(8, Math.round(window.innerWidth - r.right)) });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded-hig-xs text-c-text-secondary hover:bg-c-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
        title={ariaLabel}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreVertical size={16} />
      </button>
      {open &&
        pos &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-context-menu"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <div
              role="menu"
              className="fixed z-context-menu min-w-[200px] rounded-lg border border-c-border-subtle bg-c-surface p-1 shadow-lg"
              style={{ top: pos.top, right: pos.right }}
            >
              {items.map((it) => {
                const Icon = it.icon;
                return (
                  <button
                    key={it.id}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      it.onClick();
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-c-text transition-colors hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
                  >
                    <Icon size={14} className="shrink-0 text-c-text-muted" />
                    <span className="min-w-0 flex-1 truncate">{it.label}</span>
                  </button>
                );
              })}
            </div>
          </>,
          document.body
        )}
    </div>
  );
};

const LANE_CONFIG = {
  wordy: {
    icon: FileText,
    label: 'Wordy',
    labelPl: 'Dokumenty',
    accentColor: 'purple',
    inputPlaceholder: 'Describe the document you want to create...',
    inputPlaceholderPl: 'Opisz dokument, który chcesz stworzyć...',
  },
  excele: {
    icon: FileSpreadsheet,
    label: 'Excele',
    labelPl: 'Tabele',
    accentColor: 'emerald',
    inputPlaceholder: 'Upload a spreadsheet to work with or create from scratch',
    inputPlaceholderPl: 'Prześlij arkusz lub stwórz od zera',
  },
  prezentacje: {
    icon: Presentation,
    label: 'Prezentacje',
    labelPl: 'Prezentacje',
    accentColor: 'fuchsia',
    inputPlaceholder: 'Describe the presentation you want to create...',
    inputPlaceholderPl: 'Opisz prezentację, którą chcesz stworzyć...',
  },
  tabele: {
    icon: Table,
    label: 'Table Studio',
    labelPl: 'Tabele Studio',
    accentColor: 'sky',
    inputPlaceholder: 'Describe the operational table you want to build...',
    inputPlaceholderPl: 'Opisz tabelę operacyjną, którą chcesz zbudować...',
  },
} as const;

function TaskProgressBar({
  steps,
  total,
  completed,
  isGenerating,
  isCompleted,
  onReplay,
  onRemix,
}: {
  steps: TaskStep[];
  total: number;
  completed: number;
  isGenerating: boolean;
  isCompleted: boolean;
  onReplay?: () => void;
  onRemix?: () => void;
}) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border-t border-c-border-subtle bg-c-surface-raised">
      <div className="flex items-center justify-between px-4 py-2.5">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-controls="kimi-task-steps"
          className="flex items-center gap-3 hover:bg-c-surface-raised transition-colors rounded-hig-xs px-1 -mx-1"
        >
          {isGenerating ? (
            <Loader2 size={16} className="animate-spin text-c-text-secondary" />
          ) : isCompleted ? (
            <CheckCircle2 size={16} className="text-emerald-500" />
          ) : (
            <Sparkles size={16} className="text-c-text-secondary" />
          )}
          <span className="text-sm font-medium text-c-text">
            {isCompleted
              ? t('kimi.taskCompleted', 'Task completed')
              : isGenerating
                ? t('kimi.executingTask', 'Executing task...')
                : t('kimi.taskProgress', 'Task Progress')}
          </span>
          <span className="text-xs text-c-text-secondary font-mono">
            {completed}/{total}
          </span>
          {isExpanded ? (
            <ChevronUp size={14} className="text-c-text-secondary" />
          ) : (
            <ChevronDown size={14} className="text-c-text-secondary" />
          )}
        </button>
        <div className="flex items-center gap-2">
          {isCompleted && onReplay && (
            <button
              onClick={onReplay}
              className="flex items-center gap-1 px-2.5 py-1 rounded-hig-xs text-xs font-medium bg-c-border-subtle text-c-text hover:bg-c-border transition-colors"
            >
              <Play size={12} />
              {t('kimi.replay', 'Replay')}
            </button>
          )}
          {/* KANON KOLORU (CLAUDE.md §UI.3): „Remix" to CTA, nie semantyka krytyczna
              → neutralnie, identycznie jak sąsiedni „Replay". Rodzina `brand`
              w tailwind.config.js jest przekierowana na crimson #85182F. */}
          {isCompleted && onRemix && (
            <button
              onClick={onRemix}
              className="flex items-center gap-1 px-2.5 py-1 rounded-hig-xs text-xs font-medium bg-c-border-subtle text-c-text hover:bg-c-border transition-colors"
            >
              <RefreshCw size={12} />
              {t('kimi.remix', 'Remix')}
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-1">
        <div className="h-1 bg-c-border-subtle rounded-hig-full overflow-hidden">
          {/* KANON KOLORU: postęp to informacja neutralna (nie błąd/alert) —
              wypełnienie neutralne, czytelne na torze `c-border-subtle`. */}
          <div
            className="h-full bg-c-text-secondary rounded-hig-full transition-all duration-500 ease-out"
            style={{ width: total > 0 ? `${(completed / total) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* Expanded step list */}
      {isExpanded && (
        <div id="kimi-task-steps" className="px-4 pb-3 space-y-1.5 max-h-48 overflow-y-auto">
          {steps.map((step) => (
            <div key={step.id} className="flex items-center gap-2 text-xs">
              {step.status === 'running' ? (
                <Loader2 size={12} className="animate-spin text-c-text-secondary flex-shrink-0" />
              ) : step.status === 'completed' ? (
                <CheckCircle2 size={12} className="text-emerald-500 flex-shrink-0" />
              ) : step.status === 'failed' ? (
                <X size={12} className="text-danger-500 flex-shrink-0" />
              ) : (
                <div className="w-3 h-3 rounded-hig-full border border-c-border-subtle flex-shrink-0" />
              )}
              <span
                className={`${step.status === 'running' ? 'text-c-text font-medium' : 'text-c-text-secondary'}`}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ArtifactPreviewPane({
  preview,
  lane,
  isGenerating,
  isFailed,
  failureReason,
  onDownload,
  onDownloadPdf,
  onPreviewFile,
  onAllFiles,
  onStartGeneration,
  onRetry,
}: {
  preview: ArtifactPreview | null;
  lane: KimiLane;
  isGenerating: boolean;
  isFailed?: boolean;
  failureReason?: string | null;
  onDownload?: () => void;
  onDownloadPdf?: () => void;
  onPreviewFile?: () => void;
  onAllFiles?: () => void;
  onStartGeneration?: (goal: string) => Promise<void>;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  const config = LANE_CONFIG[lane];
  const Icon = config.icon;
  // Tabele was chat-only (start via the Teresa side-panel) — but that path
  // navigated back to the gallery instead of generating, leaving the table
  // impossible to create from the workspace. All other lanes use the center
  // "Generate" affordance wired to the SAME pipeline.startGeneration, which
  // works. Give tabele the same working center input + Generate button.
  const usesChatOnlyStart = false;
  const [activeSheet, setActiveSheet] = useState(0);
  // B3 fix (2026-07-22): xlsx grid renders only the first GRID_ROW_CAP rows by
  // default (perf on big sheets) — this un-caps the CURRENT sheet on request.
  // Reset whenever the visible sheet changes so switching tabs doesn't leave a
  // huge render behind.
  const [showAllRows, setShowAllRows] = useState(false);
  React.useEffect(() => {
    setShowAllRows(false);
  }, [activeSheet]);
  const [goalInput, setGoalInput] = React.useState('');
  const [isStarting, setIsStarting] = React.useState(false);

  const handleGenerate = React.useCallback(async () => {
    if (!goalInput.trim() || !onStartGeneration) return;
    setIsStarting(true);
    try {
      await onStartGeneration(goalInput.trim());
    } finally {
      setIsStarting(false);
    }
  }, [goalInput, onStartGeneration]);

  if (isGenerating && !preview) {
    return (
      <div className="flex-1 flex items-center justify-center bg-c-surface-raised">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-hig-lg bg-c-border-subtle flex items-center justify-center mx-auto">
            <Loader2 size={28} className="animate-spin text-c-text-secondary" />
          </div>
          <div>
            <p className="text-sm font-medium text-c-text">
              {t('kimi.generating', 'Generating...')}
            </p>
            <p className="text-xs text-c-text-secondary mt-1">
              {lane === 'excele'
                ? t('kimi.generatingSheet', 'Building your spreadsheet')
                : lane === 'tabele'
                  ? t('kimi.generatingTabele', 'Building your operational table')
                  : t('kimi.generatingDeck', 'Building your presentation')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isFailed && !preview) {
    return (
      <div className="flex-1 flex items-center justify-center bg-c-surface-raised">
        <div className="text-center space-y-4 max-w-md px-6">
          <div className="w-16 h-16 rounded-hig-lg bg-danger-50 dark:bg-danger-900/20 flex items-center justify-center mx-auto">
            <AlertTriangle size={28} className="text-danger-500 dark:text-danger-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-danger-700 dark:text-danger-300">
              {t('kimi.generationFailed', 'Generation failed')}
            </p>
            {failureReason && (
              <p className="text-xs text-danger-600/80 dark:text-danger-400/80 mt-1.5 leading-relaxed">
                {failureReason}
              </p>
            )}
          </div>
          <div className="flex gap-2 justify-center pt-1">
            {onRetry && (
              <button
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-hig-sm bg-c-text text-c-bg hover:opacity-90 transition-opacity"
              >
                <RefreshCw size={14} />
                {t('kimi.retry', 'Try again')}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!preview || preview.type === 'none') {
    return (
      <div className="flex-1 flex items-center justify-center bg-c-surface-raised">
        <div className="text-center space-y-5 max-w-md px-6">
          <div className="w-16 h-16 rounded-hig-lg bg-c-surface-raised flex items-center justify-center mx-auto">
            <Icon size={28} className="text-c-text-secondary" />
          </div>
          <div>
            <p className="text-sm font-medium text-c-text">
              {lane === 'excele'
                ? t('kimi.emptyExcele', 'Your spreadsheet will appear here')
                : lane === 'tabele'
                  ? t('kimi.emptyTabele', 'Your operational table will appear here')
                  : t('kimi.emptyDeck', 'Your presentation will appear here')}
            </p>
            <p className="text-xs text-c-text-secondary mt-1">
              {usesChatOnlyStart
                ? t(
                    'kimi.emptyTabeleChatHint',
                    'Describe the table in Teresa on the left. Your operational table will appear here.'
                  )
                : t('kimi.emptyHint', 'Describe what you need and click Generate')}
            </p>
          </div>
          {onStartGeneration && !usesChatOnlyStart && (
            <div className="space-y-3">
              <textarea
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                placeholder={t(`kimi.shell.inputPlaceholder.${lane}`, config.inputPlaceholder)}
                rows={3}
                className="w-full rounded-hig-md border border-c-border-subtle bg-c-surface px-4 py-3 text-sm text-c-text placeholder:text-c-text-muted outline-none focus:border-c-focus-solid focus:ring-1 focus:ring-c-focus resize-none"
              />
              <button
                onClick={handleGenerate}
                disabled={!goalInput.trim() || isStarting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-hig-md bg-c-text text-c-bg text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {isStarting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Sparkles size={16} />
                )}
                {lane === 'excele'
                  ? t('kimi.generateSheet', 'Generate Spreadsheet')
                  : lane === 'tabele'
                    ? t('kimi.generateTable', 'Generate Table')
                    : t('kimi.generateDeck', 'Generate Presentation')}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-c-surface">
      {/* Preview header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-c-border-subtle bg-c-surface-raised shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={16} className="text-c-text-secondary flex-shrink-0" />
          <span className="text-sm font-medium text-c-text truncate">{preview.title}</span>
          {preview.pageCount && (
            <span className="text-xs text-c-text-secondary flex-shrink-0">
              {preview.pageCount} {preview.pageCount === 1 ? 'page' : 'pages'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onDownloadPdf && (
            <button
              onClick={onDownloadPdf}
              className="flex items-center gap-1 px-2 py-1 rounded-hig-xs text-xs font-medium bg-c-surface-raised text-c-text-secondary hover:bg-c-border-subtle transition-colors"
              title="Export PDF"
            >
              <FileText size={12} />
              <span>PDF</span>
            </button>
          )}
          {onDownload && (
            <button
              onClick={onDownload}
              aria-label={t('kimi.download', 'Download')}
              /* KANON KOLORU: pobranie to CTA, nie semantyka krytyczna → neutralne
                 wypełnienie; hierarchia względem „PDF" (surface-raised) zachowana. */
              className="flex items-center gap-1 px-2 py-1 rounded-hig-xs text-xs font-medium bg-c-border-subtle text-c-text hover:bg-c-border transition-colors"
            >
              <Download size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Preview content */}
      <div className="flex-1 overflow-auto p-4">
        {preview.type === 'pdf' && preview.url && (
          <iframe
            src={preview.url}
            className="w-full h-full min-h-[600px] rounded-hig-sm border border-c-border-subtle"
            title={preview.title}
          />
        )}
        {preview.type === 'pdf' && !preview.url && (
          <div className="flex items-center justify-center h-full min-h-[400px]">
            <div className="text-center space-y-3">
              <FileText size={48} className="mx-auto text-c-text-secondary" />
              <p className="text-sm font-medium text-c-text">{preview.title}</p>
              <p className="text-xs text-c-text-secondary">
                {t('kimi.docReady', 'Document ready — use Preview File or Download')}
              </p>
            </div>
          </div>
        )}
        {preview.type === 'xlsx' && (
          <div className="space-y-4">
            {preview.summary && (
              <div className="p-4 bg-c-surface-raised rounded-hig-md border border-c-border-subtle">
                <p className="text-sm text-c-text">{preview.summary}</p>
              </div>
            )}
            {preview.kpiItems && preview.kpiItems.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {preview.kpiItems.map((kpi, i) => (
                  <div
                    key={i}
                    className="p-3 bg-c-surface rounded-hig-sm border border-c-border-subtle"
                  >
                    <p className="text-xs text-c-text-secondary">{kpi.label}</p>
                    <p className="text-lg font-semibold text-c-text mt-0.5">{kpi.value}</p>
                  </div>
                ))}
              </div>
            )}
            {isExceleEditEnabled() &&
            preview.workbookId &&
            preview.rawSheets &&
            preview.rawSheets.length > 0 ? (
              // "Najmniejszy arkusz, który jest naprawdę arkuszem" (2026-07-28,
              // za flagą ff_excele_edit, domyślnie OFF) — klik→edycja→przeliczenie
              // formuł zależnych→zapis, patrz EditableSpreadsheetGrid.tsx.
              <EditableSpreadsheetGrid
                workbookId={preview.workbookId}
                sheets={preview.rawSheets}
                activeSheetIndex={activeSheet}
              />
            ) : preview.gridLoading ? (
              <div className="bg-c-surface rounded-hig-md border border-c-border-subtle overflow-hidden">
                <div className="p-8 text-center text-c-text-secondary">
                  <Loader2 size={32} className="mx-auto mb-3 animate-spin" />
                  <p className="text-sm font-medium">
                    {t('kimi.xlsxGridLoading', 'Loading cells and formulas…')}
                  </p>
                </div>
              </div>
            ) : preview.gridError ? (
              <div className="bg-c-surface rounded-hig-md border border-c-border-subtle overflow-hidden">
                <div className="p-8 text-center text-c-text-secondary">
                  <AlertTriangle size={32} className="mx-auto mb-3 text-amber-500" />
                  <p className="text-sm font-medium text-c-text">{preview.gridError}</p>
                </div>
              </div>
            ) : (() => {
                const sheetData = preview.perSheetData?.[activeSheet] ?? preview.tableData;
                return sheetData && sheetData.columns.length > 0;
              })() ? (
              <div className="bg-c-surface rounded-hig-md border border-c-border-subtle overflow-hidden">
                <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                  {(() => {
                    const sheetData = (preview.perSheetData?.[activeSheet] ?? preview.tableData)!;
                    const visibleRows = showAllRows
                      ? sheetData.rows
                      : sheetData.rows.slice(0, GRID_ROW_CAP);
                    return (
                      <table
                        /* §27-exempt: edytor komorkowy/workspace, edycja cell-by-cell */ className="w-full text-xs"
                      >
                        <thead className="sticky top-0 z-10">
                          <tr className="bg-c-surface-raised">
                            {sheetData.columns.map((col, ci) => (
                              <th
                                key={`${col}-${ci}`}
                                className="px-3 py-2 text-left font-medium text-c-text-secondary border-b border-c-border-subtle whitespace-nowrap"
                              >
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {visibleRows.map((row, ri) => (
                            <tr
                              key={ri}
                              className="border-b border-c-border-subtle hover:bg-c-surface-raised"
                            >
                              {sheetData.columns.map((col, ci) => {
                                const raw = row[col];
                                const isFormula = isFormulaDisplayValue(raw);
                                return (
                                  <td
                                    key={`${col}-${ci}`}
                                    title={isFormula ? raw : undefined}
                                    className={`px-3 py-1.5 whitespace-nowrap max-w-[200px] truncate ${
                                      isFormula ? 'font-mono text-c-text-secondary' : 'text-c-text'
                                    }`}
                                  >
                                    {String(raw ?? '')}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
                {(() => {
                  const sheetData = preview.perSheetData?.[activeSheet] ?? preview.tableData;
                  return sheetData && sheetData.rows.length > GRID_ROW_CAP;
                })() && (
                  <div className="px-3 py-2 flex items-center justify-center gap-3 text-xs text-c-text-secondary border-t border-c-border-subtle">
                    <span>
                      {showAllRows
                        ? t('kimi.showingAllRows', 'Showing all {{total}} rows', {
                            total: (preview.perSheetData?.[activeSheet] ?? preview.tableData)!.rows
                              .length,
                          })
                        : t('kimi.showingRows', 'Showing first {{cap}} of {{total}} rows', {
                            cap: GRID_ROW_CAP,
                            total: (preview.perSheetData?.[activeSheet] ?? preview.tableData)!.rows
                              .length,
                          })}
                    </span>
                    {!showAllRows && (
                      <button
                        type="button"
                        onClick={() => setShowAllRows(true)}
                        className="px-2 py-0.5 rounded-hig-xs font-medium text-c-text hover:bg-c-border-subtle transition-colors"
                      >
                        {t('kimi.showAllRows', 'Show all')}
                      </button>
                    )}
                    {onDownload && (
                      <button
                        type="button"
                        onClick={onDownload}
                        className="px-2 py-0.5 rounded-hig-xs font-medium text-c-text hover:bg-c-border-subtle transition-colors"
                      >
                        {t('kimi.downloadInstead', 'Download file')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-c-surface rounded-hig-md border border-c-border-subtle overflow-hidden">
                <div className="p-8 text-center text-c-text-secondary">
                  <FileSpreadsheet size={48} className="mx-auto mb-3 opacity-50" />
                  <p className="text-sm font-medium">
                    {t('kimi.xlsxPreview', 'Spreadsheet preview')}
                  </p>
                  <p className="text-xs mt-1">{preview.fileName || 'spreadsheet.xlsx'}</p>
                </div>
              </div>
            )}
          </div>
        )}
        {preview.type === 'tabele' && (
          <TabelePreviewLayout preview={preview as ArtifactPreview & { type: 'tabele' }} />
        )}
        {preview.type === 'deck' && (
          <div className="space-y-4">
            {preview.summary && (
              <div className="p-4 bg-c-surface-raised rounded-hig-md border border-c-border-subtle">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-c-text">{preview.summary}</p>
                  {preview.deckStatus &&
                    (() => {
                      const badge = deriveDeckBadgeFromNativeStatus(preview.deckStatus);
                      return (
                        <span
                          className={`ml-3 px-2.5 py-0.5 rounded-hig-full text-xs font-medium whitespace-nowrap ${
                            badge === 'Exported'
                              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                              : badge === 'Reviewed'
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                : 'bg-c-surface-raised text-c-text-secondary'
                          }`}
                        >
                          {badge}
                        </span>
                      );
                    })()}
                </div>
              </div>
            )}
            {preview.kpiItems && preview.kpiItems.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {preview.kpiItems.map((kpi, i) => (
                  <div
                    key={i}
                    className="p-3 bg-c-surface rounded-hig-sm border border-c-border-subtle"
                  >
                    <p className="text-xs text-c-text-secondary">{kpi.label}</p>
                    <p className="text-lg font-semibold text-c-text mt-0.5">{kpi.value}</p>
                  </div>
                ))}
              </div>
            )}
            {preview.deckSlides && preview.deckSlides.length > 0 ? (
              <div className="space-y-3">
                {preview.deckSlides.map((slide, i) => (
                  <div
                    key={slide.slideId}
                    className="bg-c-surface rounded-hig-md border border-c-border-subtle overflow-hidden"
                  >
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-c-surface-raised border-b border-c-border-subtle">
                      <span className="w-7 h-7 rounded-hig-xs bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-600 dark:text-fuchsia-400 flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-c-text truncate">{slide.title}</p>
                        <p className="text-xs text-c-text-secondary">
                          {slide.intent.replace(/_/g, ' ')}
                        </p>
                      </div>
                    </div>
                    {slide.bulletPoints && slide.bulletPoints.length > 0 && (
                      <ul className="px-4 py-2.5 space-y-1">
                        {slide.bulletPoints.slice(0, 4).map((bp, bi) => (
                          <li
                            key={bi}
                            className="text-xs text-c-text-secondary flex items-start gap-2"
                          >
                            <span className="mt-1.5 w-1 h-1 rounded-hig-full bg-fuchsia-400 flex-shrink-0" />
                            {bp}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-c-surface rounded-hig-md border border-c-border-subtle overflow-hidden">
                <div className="p-8 text-center text-c-text-secondary">
                  <Presentation size={48} className="mx-auto mb-3 opacity-50" />
                  <p className="text-sm font-medium">
                    {t('kimi.deckPreview', 'Presentation preview')}
                  </p>
                  {preview.deckId && onPreviewFile && (
                    <button
                      type="button"
                      onClick={onPreviewFile}
                      data-testid="kimi-open-in-builder-empty"
                      className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-hig-sm text-sm font-medium bg-fuchsia-50 dark:bg-fuchsia-900/20 text-fuchsia-600 dark:text-fuchsia-400 hover:bg-fuchsia-100 dark:hover:bg-fuchsia-900/30 transition-colors"
                    >
                      <LayoutGrid size={14} />
                      {t('kimi.openInBuilder', 'Open in Builder')}
                    </button>
                  )}
                </div>
              </div>
            )}
            {preview.deckId &&
              preview.deckSlides &&
              preview.deckSlides.length > 0 &&
              onPreviewFile && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={onPreviewFile}
                    data-testid="kimi-open-in-builder-populated"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-hig-sm text-sm font-medium bg-fuchsia-50 dark:bg-fuchsia-900/20 text-fuchsia-600 dark:text-fuchsia-400 hover:bg-fuchsia-100 dark:hover:bg-fuchsia-900/30 transition-colors"
                  >
                    <LayoutGrid size={14} />
                    {t('kimi.openInBuilder', 'Open in Builder')}
                  </button>
                </div>
              )}
          </div>
        )}
      </div>

      {/* Sheet tabs (for xlsx) */}
      {preview.type === 'xlsx' && preview.sheetNames && preview.sheetNames.length > 0 && (
        <div
          role="tablist"
          className="flex items-center gap-0.5 px-2 py-1.5 border-t border-c-border-subtle bg-c-surface-raised overflow-x-auto shrink-0"
        >
          {preview.sheetNames.map((name, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={activeSheet === i}
              onClick={() => setActiveSheet(i)}
              className={`px-3 py-1 text-xs rounded-hig-xs whitespace-nowrap transition-colors ${
                activeSheet === i
                  ? 'bg-c-surface text-c-text font-medium shadow-sm'
                  : 'text-c-text-secondary hover:text-c-text'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {/* Download bar */}
      {(onPreviewFile || onAllFiles) && (
        <div className="flex items-center gap-3 px-4 py-3 border-t border-c-border-subtle bg-c-surface shrink-0">
          {onPreviewFile && (
            <button
              onClick={onPreviewFile}
              className="flex items-center gap-2 px-4 py-2 rounded-hig-sm text-sm font-medium bg-c-surface-raised text-c-text hover:bg-c-border-subtle transition-colors"
            >
              <Eye size={16} />
              <span>
                {preview.fileName ||
                  (lane === 'excele'
                    ? 'spreadsheet.xlsx'
                    : lane === 'tabele'
                      ? 'table.csv'
                      : 'presentation.pptx')}
              </span>
              <span className="text-xs text-c-text-secondary">
                {t('kimi.previewFile', 'Preview File')}
              </span>
            </button>
          )}
          {onAllFiles && (
            <button
              onClick={onAllFiles}
              className="flex items-center gap-2 px-4 py-2 rounded-hig-sm text-sm font-medium bg-c-surface-raised text-c-text hover:bg-c-border-subtle transition-colors"
            >
              <FolderOpen size={16} />
              <span>{t('kimi.allFiles', 'All files')}</span>
              <span className="text-xs text-c-text-secondary">
                {t('kimi.viewOrDownload', 'View or download files')}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export const KimiWorkspaceShell: React.FC<KimiWorkspaceShellProps> = ({
  lane,
  taskSteps,
  totalSteps,
  completedSteps,
  isGenerating,
  isCompleted,
  isFailed,
  failureReason,
  preview,
  onReplay,
  onRemix,
  onDownload,
  onDownloadPdf,
  onPreviewFile,
  onAllFiles,
  onStartGeneration,
  chatSystemPrompt,
  rightPanel,
  kebabItems,
  kebabAriaLabel,
}) => {
  const { t: tShell } = useTranslation();
  const setDisplayMode = useConversationStore((s) => s.setDisplayMode);
  const setWorkspaceContext = useConversationStore((s) => s.setWorkspaceContext);

  const workspaceContext = useMemo(() => {
    const laneViewMap: Record<KimiLane, AppView> = {
      excele: AppView.EXCELE,
      prezentacje: AppView.PREZENTACJE_GEN,
      tabele: AppView.TABELE,
    };
    const view = laneViewMap[lane];
    const type = getDefaultWorkspaceType(view);
    return createWorkspaceContext(view, type, {});
  }, [lane]);

  React.useEffect(() => {
    if (workspaceContext) {
      setWorkspaceContext(workspaceContext);
      setDisplayMode('split');
    }
  }, [workspaceContext, setWorkspaceContext, setDisplayMode]);

  return (
    <div className="flex flex-col w-full h-full min-h-0 overflow-hidden bg-c-surface-raised">
      {/*
       * No embedded chat panel in the Studio. Teresa is the single chat surface
       * (main chat / Canvas) — a duplicate chat per Studio is redundant. The
       * Studio is purely the artifact preview (full width) + the center Generate
       * input. The slim progress bar stays at the top so generation feedback is
       * still visible without a chat rail.
       */}
      {(isGenerating || isCompleted || taskSteps.length > 0) && (
        <TaskProgressBar
          steps={taskSteps}
          total={totalSteps}
          completed={completedSteps}
          isGenerating={isGenerating}
          isCompleted={isCompleted}
          onReplay={onReplay}
          onRemix={onRemix}
        />
      )}

      {/* Artifact preview (full width, or shared with SPEC-A right panel when supplied) */}
      <div className="flex-1 flex min-w-0 min-h-0">
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Module header / breadcrumb strip (Menu 1) */}
          <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-c-border-subtle bg-c-surface shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {React.createElement(LANE_CONFIG[lane].icon, {
                size: 16,
                className: 'text-c-text-secondary shrink-0',
              })}
              <span className="text-sm font-medium text-c-text truncate">
                {tShell(`kimi.shell.lane.${lane}`, LANE_CONFIG[lane].label)}
              </span>
              <span className="text-xs text-c-text-secondary shrink-0">
                / {tShell('kimi.workspace', 'Workspace')}
              </span>
            </div>
            {kebabItems && kebabItems.length > 0 && (
              <KebabMenu
                items={kebabItems}
                ariaLabel={kebabAriaLabel ?? tShell('kimi.shell.moreActions', 'Więcej akcji')}
              />
            )}
          </div>
          <ArtifactPreviewPane
            preview={preview}
            lane={lane}
            isGenerating={isGenerating}
            isFailed={isFailed}
            failureReason={failureReason}
            onDownload={onDownload}
            onDownloadPdf={onDownloadPdf}
            onPreviewFile={onPreviewFile}
            onAllFiles={onAllFiles}
            onStartGeneration={onStartGeneration}
            onRetry={onReplay}
          />
        </div>
        {rightPanel}
      </div>
    </div>
  );
};

export default KimiWorkspaceShell;
