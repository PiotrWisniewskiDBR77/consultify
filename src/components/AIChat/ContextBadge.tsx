/**
 * ContextBadge - Shows what AI currently "sees" (workspace, project, entity)
 *
 * Renders a subtle, collapsible badge above the chat messages area
 * so the user always knows what data/context the AI is working with.
 */

import {
  BarChart3,
  BookOpen,
  Briefcase,
  ChevronDown,
  ChevronUp,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  MapPin,
  MessageSquare,
  NotebookPen,
  Presentation,
  Sparkles,
  Wallet,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { WorkspaceContext, WorkspaceType } from '../../types/workspace';

interface ContextBadgeProps {
  workspaceContext?: WorkspaceContext | null;
  focusMode?: string;
  compact?: boolean;
  className?: string;
}

const WORKSPACE_ICONS: Record<WorkspaceType, React.ReactNode> = {
  task: <ListChecks size={14} />,
  initiative: <Sparkles size={14} />,
  assessment: <BarChart3 size={14} />,
  roadmap: <MapPin size={14} />,
  artifact: <FileText size={14} />,
  document: <BookOpen size={14} />,
  decision: <FolderKanban size={14} />,
  idea: <Lightbulb size={14} />,
  report: <FileText size={14} />,
  dashboard: <LayoutDashboard size={14} />,
  project: <Briefcase size={14} />,
  notebook: <NotebookPen size={14} />,
  finance: <Wallet size={14} />,
  insight: <Lightbulb size={14} />,
  interview: <MessageSquare size={14} />,
  presentation: <Presentation size={14} />,
  canvas: <NotebookPen size={14} />,
  general: <Sparkles size={14} />,
  empty: <Sparkles size={14} />,
};

const WORKSPACE_LABELS: Record<WorkspaceType, string> = {
  task: 'Task',
  initiative: 'Initiative',
  assessment: 'Assessment',
  roadmap: 'Roadmap',
  artifact: 'Artifact',
  document: 'Document',
  decision: 'Decision',
  idea: 'Idea',
  report: 'Report',
  dashboard: 'Dashboard',
  project: 'Project',
  notebook: 'Notebook',
  finance: 'Finance',
  insight: 'Insight',
  interview: 'Interview',
  presentation: 'Presentation',
  canvas: 'Canvas',
  general: 'General',
  empty: 'Chat',
};

/**
 * ★ Znalezisko 203-polski (2026-09-02, chipy Teresy — `teresa-chipy-sugestii`
 * / `teresa-chipy-panel-artefaktu`): `WORKSPACE_LABELS` (wyżej) nie miał
 * ŻADNEGO polskiego wariantu — chip kontekstu pokazywał „Presentation:",
 * „Report:", „Insight:" po angielsku w polskim UI, bo `primaryLabel`
 * (niżej) czytał wyłącznie tę mapę. Dopisujemy bliźniaczą mapę PL zamiast
 * przechodzić na klucze i18n — to lokalny idiom tego pliku (patrz
 * `FOCUS_LABELS_PL` obok), nie SSOT dzielony z innymi ekranami.
 */
const WORKSPACE_LABELS_PL: Record<WorkspaceType, string> = {
  task: 'Zadanie',
  initiative: 'Inicjatywa',
  assessment: 'Ocena',
  roadmap: 'Mapa drogowa',
  artifact: 'Artefakt',
  document: 'Dokument',
  decision: 'Decyzja',
  idea: 'Pomysł',
  report: 'Raport',
  dashboard: 'Panel',
  project: 'Projekt',
  notebook: 'Notatnik',
  finance: 'Finanse',
  insight: 'Wniosek',
  interview: 'Wywiad',
  presentation: 'Prezentacja',
  canvas: 'Płótno',
  general: 'Ogólny',
  empty: 'Czat',
};

const FOCUS_LABELS: Record<string, string> = {
  all: 'All sources',
  'pmo-docs': 'PMO Standards',
  'project-data': 'Project Data',
  research: 'Research',
  web: 'Web Search',
};

const FOCUS_LABELS_PL: Record<string, string> = {
  all: 'Wszystkie źródła',
  'pmo-docs': 'Standardy PMO',
  'project-data': 'Dane projektu',
  research: 'Badania',
  web: 'Wyszukiwanie w sieci',
};

export const ContextBadge: React.FC<ContextBadgeProps> = ({
  workspaceContext,
  focusMode = 'all',
  compact = false,
  className = '',
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = (i18n.language || '').toLowerCase().startsWith('pl');
  const workspaceLabels = isPolish ? WORKSPACE_LABELS_PL : WORKSPACE_LABELS;
  const focusLabels = isPolish ? FOCUS_LABELS_PL : FOCUS_LABELS;
  const [isExpanded, setIsExpanded] = useState(false);

  const hasContext = useMemo(
    () => workspaceContext && workspaceContext.type !== 'empty',
    [workspaceContext]
  );

  const contextItems = useMemo(() => {
    const items: Array<{ label: string; value: string; icon?: React.ReactNode }> = [];

    if (workspaceContext?.entityName) {
      items.push({
        label: workspaceLabels[workspaceContext.type] || (isPolish ? 'Obiekt' : 'Entity'),
        value: workspaceContext.entityName,
        icon: WORKSPACE_ICONS[workspaceContext.type],
      });
    }

    if (workspaceContext?.projectName) {
      items.push({
        label: t('contextBadge.project', 'Project'),
        value: workspaceContext.projectName,
        icon: <Briefcase size={14} />,
      });
    }

    if (focusMode && focusMode !== 'all') {
      items.push({
        label: t('contextBadge.focus', 'Focus'),
        value: focusLabels[focusMode] || focusMode,
      });
    }

    return items;
  }, [workspaceContext, focusMode, t, workspaceLabels, focusLabels, isPolish]);

  // Don't render anything if there's no meaningful context
  if (!hasContext && focusMode === 'all') return null;

  // Single-line badge (collapsed)
  const primaryLabel = workspaceContext?.entityName
    ? `${workspaceLabels[workspaceContext.type] || 'AI'}: ${workspaceContext.entityName}`
    : focusMode !== 'all'
      ? `${t('contextBadge.focus', 'Focus')}: ${focusLabels[focusMode] || focusMode}`
      : null;

  if (!primaryLabel) return null;

  return (
    <div className={`${className}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`
          w-full flex items-center gap-2 
          ${compact ? 'px-2 py-1' : 'px-3 py-1.5'}
          rounded-lg text-xs
          bg-slate-50 dark:bg-navy-800/50
          border border-slate-200 dark:border-navy-700/50
          hover:bg-slate-100 dark:hover:bg-navy-800
          text-slate-500 dark:text-slate-400
          transition-all duration-200
        `}
      >
        <span className="text-primary-500 dark:text-primary-400 shrink-0">
          {workspaceContext?.type ? WORKSPACE_ICONS[workspaceContext.type] : <Sparkles size={14} />}
        </span>

        <span className="flex-1 text-left truncate">
          {t('contextBadge.aiSees', 'AI sees')}:{' '}
          <span className="font-medium text-slate-600 dark:text-slate-300">{primaryLabel}</span>
        </span>

        {contextItems.length > 1 && (
          <span className="shrink-0 text-slate-600 dark:text-slate-500">
            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </span>
        )}
      </button>

      {/* Expanded details */}
      {isExpanded && contextItems.length > 0 && (
        <div className="mt-1 px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800/30 border border-slate-200 dark:border-navy-700/30 space-y-1">
          {contextItems.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs">
              {item.icon && (
                <span className="text-slate-600 dark:text-slate-500 shrink-0">{item.icon}</span>
              )}
              <span className="text-slate-600 dark:text-slate-500">{item.label}:</span>
              <span className="text-slate-600 dark:text-slate-300 font-medium truncate">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ContextBadge;
