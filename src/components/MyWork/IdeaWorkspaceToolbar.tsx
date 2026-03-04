/**
 * IdeaWorkspaceToolbar — Floating bottom toolbar for the Idea Workspace.
 *
 * Quick toggles for: canvas tool switching, voting mode, export,
 * and AI features. Always visible at the bottom of the canvas.
 */
import {
  Bookmark,
  Brain,
  Download,
  GitBranch,
  LayoutGrid,
  MessageSquare,
  Network,
  Pen,
  Sparkles,
  StickyNote,
  Table2,
  ThumbsUp,
  Workflow,
} from 'lucide-react';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import type { CanvasToolType } from './ideaSelectionTypes';

export interface IdeaWorkspaceToolbarProps {
  activeTool: CanvasToolType;
  onToolChange: (tool: CanvasToolType) => void;
  isAccepted: boolean;
  onToggleVoting?: () => void;
  onToggleAI?: () => void;
  onToggleContext?: () => void;
  onExport?: () => void;
  votingActive?: boolean;
}

const TOOL_CONFIG: Array<{
  id: CanvasToolType;
  labelPl: string;
  labelEn: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}> = [
  { id: 'mindmap', labelPl: 'Mapa myśli', labelEn: 'Mind Map', icon: GitBranch },
  { id: 'whiteboard', labelPl: 'Tablica', labelEn: 'Whiteboard', icon: StickyNote },
  { id: 'process_flow', labelPl: 'Przepływ', labelEn: 'Process Flow', icon: Workflow },
  { id: 'table', labelPl: 'Tabela', labelEn: 'Table', icon: Table2 },
];

export const IdeaWorkspaceToolbar: React.FC<IdeaWorkspaceToolbarProps> = ({
  activeTool,
  onToolChange,
  isAccepted,
  onToggleVoting,
  onToggleAI,
  onToggleContext,
  onExport,
  votingActive,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[50]">
      <div className="flex items-center gap-0.5 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm rounded-2xl border border-slate-200/60 dark:border-navy-700/60 shadow-xl px-2 py-1.5">
        {/* Canvas tool switcher */}
        {TOOL_CONFIG.map((tool) => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => onToolChange(tool.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-semibold transition-all ${
                isActive
                  ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800'
              }`}
              title={isPl ? tool.labelPl : tool.labelEn}
            >
              <Icon size={14} />
              <span className="hidden sm:inline">{isPl ? tool.labelPl : tool.labelEn}</span>
            </button>
          );
        })}

        <div className="w-px h-5 bg-slate-200 dark:bg-navy-700 mx-1" />

        {/* Quick actions */}
        {isAccepted && (
          <>
            {onToggleVoting && (
              <ToolbarAction
                icon={ThumbsUp}
                label={isPl ? 'Głosowanie' : 'Vote'}
                onClick={onToggleVoting}
                active={votingActive}
              />
            )}
            {onToggleAI && (
              <ToolbarAction
                icon={Sparkles}
                label="AI"
                onClick={onToggleAI}
              />
            )}
            {onToggleContext && (
              <ToolbarAction
                icon={Brain}
                label={isPl ? 'Kontekst' : 'Context'}
                onClick={onToggleContext}
              />
            )}
            {onExport && (
              <ToolbarAction
                icon={Download}
                label={isPl ? 'Eksport' : 'Export'}
                onClick={onExport}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

const ToolbarAction: React.FC<{
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  onClick: () => void;
  active?: boolean;
}> = ({ icon: Icon, label, onClick, active }) => (
  <button
    onClick={onClick}
    className={`p-1.5 rounded-xl transition-all ${
      active
        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800'
    }`}
    title={label}
  >
    <Icon size={14} />
  </button>
);

export default IdeaWorkspaceToolbar;
