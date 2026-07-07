/**
 * IdeaWorkspaceToolbar — Floating workspace-system switcher.
 *
 * This control only changes the active work system inside one shared workspace.
 * Panel navigation lives separately in the right-side WorkspacePanelStrip.
 */
import {
  GitBranch,
  HelpCircle,
  Layers,
  MessagesSquare,
  Search,
  StickyNote,
  Table2,
  Workflow,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { CanvasToolType } from './ideaSelectionTypes';

export interface IdeaWorkspaceToolbarProps {
  activeTool: CanvasToolType;
  onToolChange: (tool: CanvasToolType) => void;
  familyCounts?: Record<string, number>;
  /** Opens the in-canvas search (also bound to Cmd/Ctrl+F and `/`). */
  onSearch?: () => void;
  /** Opens the keyboard shortcuts help (also bound to `?`). */
  onShowHelp?: () => void;
  /** C5: Serializes the map and seeds a Teresa chat to discuss it. */
  onDiscuss?: () => void;
  /** Disables the discuss action when the map is empty. */
  discussDisabled?: boolean;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

const TOOL_CONFIG: Array<{
  id: CanvasToolType;
  labelPl: string;
  labelEn: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}> = [
  { id: 'mindmap', labelPl: 'Mapa rekomendacji', labelEn: 'Recommendation map', icon: GitBranch },
  { id: 'whiteboard', labelPl: 'Tablica', labelEn: 'Whiteboard', icon: StickyNote },
  { id: 'process_flow', labelPl: 'Przepływ', labelEn: 'Process Flow', icon: Workflow },
  { id: 'table', labelPl: 'Tabela', labelEn: 'Table', icon: Table2 },
];

export function getIdeaWorkspaceToolLabel(activeTool: CanvasToolType, isPolish: boolean): string {
  const match = TOOL_CONFIG.find((tool) => tool.id === activeTool);
  if (!match) return activeTool;
  return isPolish ? match.labelPl : match.labelEn;
}

export const IdeaWorkspaceToolbar: React.FC<IdeaWorkspaceToolbarProps> = ({
  activeTool,
  onToolChange,
  familyCounts,
  onSearch,
  onShowHelp,
  onDiscuss,
  discussDisabled,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const searchLabel = isPl ? 'Szukaj' : 'Search';
  const searchShortcut = isMac ? '⌘F' : 'Ctrl+F';
  const helpLabel = isPl ? 'Skróty klawiszowe' : 'Keyboard shortcuts';
  const discussLabel = isPl ? 'Omów z Teresą' : 'Discuss with Teresa';
  const hasLeadingActions = Boolean(onSearch || onShowHelp || onDiscuss);

  return (
    <div className="absolute top-3 right-3 z-sticky pointer-events-none">
      <div className="flex items-center gap-0.5 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm rounded-2xl border border-slate-200/60 dark:border-navy-700/60 shadow-xl px-2 py-1.5 pointer-events-auto">
        {/* Workspace actions (search, help) */}
        {onSearch && (
          <button
            type="button"
            onClick={onSearch}
            aria-label={`${searchLabel} (${searchShortcut})`}
            title={`${searchLabel} · ${searchShortcut}`}
            className="flex items-center justify-center h-9 w-9 rounded-hig-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition-all"
          >
            <Search size={14} />
          </button>
        )}
        {onShowHelp && (
          <button
            type="button"
            onClick={onShowHelp}
            aria-label={`${helpLabel} (?)`}
            title={`${helpLabel} · ?`}
            className="flex items-center justify-center h-9 w-9 rounded-hig-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition-all"
          >
            <HelpCircle size={14} />
          </button>
        )}
        {onDiscuss && (
          <button
            type="button"
            onClick={onDiscuss}
            disabled={discussDisabled}
            aria-label={discussLabel}
            title={discussLabel}
            className="flex items-center gap-1.5 h-9 px-3 rounded-hig-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-500/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          >
            <MessagesSquare size={14} />
            <span className="hidden md:inline">{discussLabel}</span>
          </button>
        )}
        {hasLeadingActions && (
          <span
            className="mx-0.5 h-5 w-px bg-slate-200/70 dark:bg-navy-700/70"
            aria-hidden="true"
          />
        )}

        {/* Canvas tool switcher */}
        {TOOL_CONFIG.map((tool) => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;
          const hasContent = (familyCounts?.[tool.id] ?? 0) > 0;
          return (
            <button
              key={tool.id}
              onClick={() => onToolChange(tool.id)}
              className={`relative flex items-center gap-1.5 h-9 px-3 rounded-hig-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-slate-500/10 text-slate-700 dark:text-slate-300'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800'
              }`}
              title={getIdeaWorkspaceToolLabel(tool.id, Boolean(isPl))}
            >
              <Icon size={14} />
              <span className="hidden sm:inline">
                {getIdeaWorkspaceToolLabel(tool.id, Boolean(isPl))}
              </span>
              {hasContent && !isActive && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-c-info/60" />
              )}
            </button>
          );
        })}

        {/* V51-08: Cross-family indicator */}
        {(() => {
          const otherFamilies = TOOL_CONFIG.filter(
            (t) => t.id !== activeTool && (familyCounts?.[t.id] ?? 0) > 0
          );
          if (otherFamilies.length === 0) return null;
          return (
            <div className="flex items-center gap-0.5 ml-0.5">
              <Layers size={10} className="text-slate-600" />
              <span className="text-[8px] text-slate-600 font-medium">+{otherFamilies.length}</span>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default IdeaWorkspaceToolbar;
