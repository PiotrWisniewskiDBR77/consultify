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
  Play,
  Presentation,
  RefreshCw,
  Sparkles,
  Table,
  X,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
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

import TabelePreviewLayout from './tabelePreview/TabelePreviewLayout';

export type KimiLane = 'wordy' | 'excele' | 'prezentacje' | 'tabele';

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
  // Tabele (Table Studio Foundation block) extras — populated by Sprint 3 / EPIC-2.
  // All optional; Sprint 2 only registers the shape so consumers can compile.
  tableId?: string;
  tabeleSchemaFields?: TabelePreviewSchemaField[];
  tabeleRelations?: TabelePreviewRelation[];
  tabeleRationale?: TabelePreviewRationale;
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
}

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
    <div className="border-t border-slate-200/60 dark:border-white/5 bg-slate-50 dark:bg-navy-900">
      <div className="flex items-center justify-between px-4 py-2.5">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-controls="kimi-task-steps"
          className="flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors rounded-hig-xs px-1 -mx-1"
        >
          {isGenerating ? (
            <Loader2 size={16} className="animate-spin text-brand" />
          ) : isCompleted ? (
            <CheckCircle2 size={16} className="text-emerald-500" />
          ) : (
            <Sparkles size={16} className="text-slate-600" />
          )}
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {isCompleted
              ? t('kimi.taskCompleted', 'Task completed')
              : isGenerating
                ? t('kimi.executingTask', 'Executing task...')
                : t('kimi.taskProgress', 'Task Progress')}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            {completed}/{total}
          </span>
          {isExpanded ? (
            <ChevronUp size={14} className="text-slate-600" />
          ) : (
            <ChevronDown size={14} className="text-slate-600" />
          )}
        </button>
        <div className="flex items-center gap-2">
          {isCompleted && onReplay && (
            <button
              onClick={onReplay}
              className="flex items-center gap-1 px-2.5 py-1 rounded-hig-xs text-xs font-medium bg-slate-200 dark:bg-navy-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-navy-600 transition-colors"
            >
              <Play size={12} />
              {t('kimi.replay', 'Replay')}
            </button>
          )}
          {isCompleted && onRemix && (
            <button
              onClick={onRemix}
              className="flex items-center gap-1 px-2.5 py-1 rounded-hig-xs text-xs font-medium bg-brand/10 text-brand hover:bg-brand/20 transition-colors"
            >
              <RefreshCw size={12} />
              {t('kimi.remix', 'Remix')}
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-1">
        <div className="h-1 bg-slate-200 dark:bg-navy-700 rounded-hig-full overflow-hidden">
          <div
            className="h-full bg-brand rounded-hig-full transition-all duration-500 ease-out"
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
                <Loader2 size={12} className="animate-spin text-brand flex-shrink-0" />
              ) : step.status === 'completed' ? (
                <CheckCircle2 size={12} className="text-emerald-500 flex-shrink-0" />
              ) : step.status === 'failed' ? (
                <X size={12} className="text-danger-500 flex-shrink-0" />
              ) : (
                <div className="w-3 h-3 rounded-hig-full border border-slate-300 dark:border-navy-600 flex-shrink-0" />
              )}
              <span
                className={`${step.status === 'running' ? 'text-slate-800 dark:text-slate-100 font-medium' : 'text-slate-600 dark:text-slate-400'}`}
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
      <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-navy-950">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-hig-lg bg-brand/10 flex items-center justify-center mx-auto">
            <Loader2 size={28} className="animate-spin text-brand" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {t('kimi.generating', 'Generating...')}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {lane === 'wordy'
                ? t('kimi.generatingDoc', 'Building your document')
                : lane === 'excele'
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
      <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-navy-950">
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
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-hig-sm bg-navy-900 dark:bg-[#F4F7FB] text-white dark:text-navy-950 hover:bg-navy-800 dark:hover:bg-[#DDE5EF] transition-colors"
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
      <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-navy-950">
        <div className="text-center space-y-5 max-w-md px-6">
          <div className="w-16 h-16 rounded-hig-lg bg-slate-100 dark:bg-navy-800 flex items-center justify-center mx-auto">
            <Icon size={28} className="text-slate-600 dark:text-slate-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {lane === 'wordy'
                ? t('kimi.emptyWordy', 'Your document will appear here')
                : lane === 'excele'
                  ? t('kimi.emptyExcele', 'Your spreadsheet will appear here')
                  : lane === 'tabele'
                    ? t('kimi.emptyTabele', 'Your operational table will appear here')
                    : t('kimi.emptyDeck', 'Your presentation will appear here')}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
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
                placeholder={t(
                  `kimi.shell.inputPlaceholder.${lane}`,
                  config.inputPlaceholder
                )}
                rows={3}
                className="w-full rounded-hig-md border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 resize-none"
              />
              <button
                onClick={handleGenerate}
                disabled={!goalInput.trim() || isStarting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-hig-md bg-navy-900 dark:bg-[#F4F7FB] text-white dark:text-navy-950 text-sm font-medium hover:bg-navy-800 dark:hover:bg-[#DDE5EF] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isStarting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Sparkles size={16} />
                )}
                {lane === 'wordy'
                  ? t('kimi.generateDoc', 'Generate Document')
                  : lane === 'excele'
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
    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-navy-900">
      {/* Preview header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200/60 dark:border-white/5 bg-slate-50 dark:bg-navy-900 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={16} className="text-slate-500 flex-shrink-0" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
            {preview.title}
          </span>
          {preview.pageCount && (
            <span className="text-xs text-slate-600 flex-shrink-0">
              {preview.pageCount} {preview.pageCount === 1 ? 'page' : 'pages'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onDownloadPdf && (
            <button
              onClick={onDownloadPdf}
              className="flex items-center gap-1 px-2 py-1 rounded-hig-xs text-xs font-medium bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-600 transition-colors"
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
              className="flex items-center gap-1 px-2 py-1 rounded-hig-xs text-xs font-medium bg-brand/10 text-brand hover:bg-brand/20 transition-colors"
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
            className="w-full h-full min-h-[600px] rounded-hig-sm border border-slate-200 dark:border-navy-700"
            title={preview.title}
          />
        )}
        {preview.type === 'pdf' && !preview.url && (
          <div className="flex items-center justify-center h-full min-h-[400px]">
            <div className="text-center space-y-3">
              <FileText size={48} className="mx-auto text-slate-600 dark:text-slate-500" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {preview.title}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('kimi.docReady', 'Document ready — use Preview File or Download')}
              </p>
            </div>
          </div>
        )}
        {preview.type === 'xlsx' && (
          <div className="space-y-4">
            {preview.summary && (
              <div className="p-4 bg-slate-50 dark:bg-navy-800 rounded-hig-md border border-slate-200 dark:border-navy-700">
                <p className="text-sm text-slate-700 dark:text-slate-300">{preview.summary}</p>
              </div>
            )}
            {preview.kpiItems && preview.kpiItems.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {preview.kpiItems.map((kpi, i) => (
                  <div
                    key={i}
                    className="p-3 bg-white dark:bg-navy-800 rounded-hig-sm border border-slate-200 dark:border-navy-700"
                  >
                    <p className="text-xs text-slate-500 dark:text-slate-400">{kpi.label}</p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white mt-0.5">
                      {kpi.value}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {(() => {
              const sheetData = preview.perSheetData?.[activeSheet] ?? preview.tableData;
              return sheetData && sheetData.columns.length > 0;
            })() ? (
              <div className="bg-white dark:bg-navy-800 rounded-hig-md border border-slate-200 dark:border-navy-700 overflow-hidden">
                <div className="overflow-x-auto">
                  {(() => {
                    const sheetData = (preview.perSheetData?.[activeSheet] ?? preview.tableData)!;
                    return (
                      <table /* §27-exempt: edytor komorkowy/workspace, edycja cell-by-cell */  className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-navy-700/50">
                            {sheetData.columns.map((col) => (
                              <th
                                key={col}
                                className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-navy-600 whitespace-nowrap"
                              >
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sheetData.rows.slice(0, 25).map((row, ri) => (
                            <tr
                              key={ri}
                              className="border-b border-slate-200 dark:border-navy-700/50 hover:bg-slate-50 dark:hover:bg-navy-700/30"
                            >
                              {sheetData.columns.map((col) => (
                                <td
                                  key={col}
                                  className="px-3 py-1.5 text-slate-700 dark:text-slate-300 whitespace-nowrap max-w-[200px] truncate"
                                >
                                  {String(row[col] ?? '')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
                {(() => {
                  const sheetData = preview.perSheetData?.[activeSheet] ?? preview.tableData;
                  return sheetData && sheetData.rows.length > 25;
                })() && (
                  <div className="px-3 py-2 text-xs text-slate-600 dark:text-slate-500 text-center border-t border-slate-200/60 dark:border-white/5">
                    {t('kimi.showingRows', 'Showing 25 of {{total}} rows', {
                      total: (preview.perSheetData?.[activeSheet] ?? preview.tableData)!.rows
                        .length,
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white dark:bg-navy-800 rounded-hig-md border border-slate-200 dark:border-navy-700 overflow-hidden">
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
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
              <div className="p-4 bg-slate-50 dark:bg-navy-800 rounded-hig-md border border-slate-200 dark:border-navy-700">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-700 dark:text-slate-300">{preview.summary}</p>
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
                                : 'bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-400'
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
                    className="p-3 bg-white dark:bg-navy-800 rounded-hig-sm border border-slate-200 dark:border-navy-700"
                  >
                    <p className="text-xs text-slate-500 dark:text-slate-400">{kpi.label}</p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white mt-0.5">
                      {kpi.value}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {preview.deckSlides && preview.deckSlides.length > 0 ? (
              <div className="space-y-3">
                {preview.deckSlides.map((slide, i) => (
                  <div
                    key={slide.slideId}
                    className="bg-white dark:bg-navy-800 rounded-hig-md border border-slate-200 dark:border-navy-700 overflow-hidden"
                  >
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 dark:bg-navy-700/50 border-b border-slate-200 dark:border-navy-600">
                      <span className="w-7 h-7 rounded-hig-xs bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-600 dark:text-fuchsia-400 flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                          {slide.title}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-500">
                          {slide.intent.replace(/_/g, ' ')}
                        </p>
                      </div>
                    </div>
                    {slide.bulletPoints && slide.bulletPoints.length > 0 && (
                      <ul className="px-4 py-2.5 space-y-1">
                        {slide.bulletPoints.slice(0, 4).map((bp, bi) => (
                          <li
                            key={bi}
                            className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2"
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
              <div className="bg-white dark:bg-navy-800 rounded-hig-md border border-slate-200 dark:border-navy-700 overflow-hidden">
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
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
          className="flex items-center gap-0.5 px-2 py-1.5 border-t border-slate-200/60 dark:border-white/5 bg-slate-50 dark:bg-navy-900 overflow-x-auto shrink-0"
        >
          {preview.sheetNames.map((name, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={activeSheet === i}
              onClick={() => setActiveSheet(i)}
              className={`px-3 py-1 text-xs rounded-hig-xs whitespace-nowrap transition-colors ${
                activeSheet === i
                  ? 'bg-white dark:bg-navy-800 text-slate-800 dark:text-white font-medium shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {/* Download bar */}
      {(onPreviewFile || onAllFiles) && (
        <div className="flex items-center gap-3 px-4 py-3 border-t border-slate-200/60 dark:border-white/5 bg-white dark:bg-navy-900 shrink-0">
          {onPreviewFile && (
            <button
              onClick={onPreviewFile}
              className="flex items-center gap-2 px-4 py-2 rounded-hig-sm text-sm font-medium bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors"
            >
              <Eye size={16} />
              <span>
                {preview.fileName ||
                  (lane === 'wordy'
                    ? 'document.pdf'
                    : lane === 'excele'
                      ? 'spreadsheet.xlsx'
                      : lane === 'tabele'
                        ? 'table.csv'
                        : 'presentation.pptx')}
              </span>
              <span className="text-xs text-slate-600">
                {t('kimi.previewFile', 'Preview File')}
              </span>
            </button>
          )}
          {onAllFiles && (
            <button
              onClick={onAllFiles}
              className="flex items-center gap-2 px-4 py-2 rounded-hig-sm text-sm font-medium bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors"
            >
              <FolderOpen size={16} />
              <span>{t('kimi.allFiles', 'All files')}</span>
              <span className="text-xs text-slate-600">
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
}) => {
  const { t: tShell } = useTranslation();
  const setDisplayMode = useConversationStore((s) => s.setDisplayMode);
  const setWorkspaceContext = useConversationStore((s) => s.setWorkspaceContext);

  const workspaceContext = useMemo(() => {
    const laneViewMap: Record<KimiLane, AppView> = {
      wordy: AppView.WORDY,
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
    <div className="flex flex-col w-full h-full min-h-0 overflow-hidden bg-slate-50 dark:bg-navy-950">
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

      {/* Artifact preview (full width) */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Module header / breadcrumb strip */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200/60 dark:border-white/5 bg-white dark:bg-navy-900 shrink-0">
          {React.createElement(LANE_CONFIG[lane].icon, {
            size: 16,
            className: 'text-slate-500 dark:text-slate-400',
          })}
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {tShell(`kimi.shell.lane.${lane}`, LANE_CONFIG[lane].label)}
          </span>
          <span className="text-xs text-slate-600 dark:text-slate-500">
            / {tShell('kimi.workspace', 'Workspace')}
          </span>
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
    </div>
  );
};

export default KimiWorkspaceShell;
