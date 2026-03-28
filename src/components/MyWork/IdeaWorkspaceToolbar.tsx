/**
 * IdeaWorkspaceToolbar — Floating workspace-system switcher.
 *
 * This control only changes the active work system inside one shared workspace.
 * Panel navigation lives separately in the right-side WorkspacePanelStrip.
 */
import { GitBranch, Layers, StickyNote, Table2, Workflow } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { CanvasToolType } from './ideaSelectionTypes';

export interface IdeaWorkspaceToolbarProps {
  activeTool: CanvasToolType;
  onToolChange: (tool: CanvasToolType) => void;
  familyCounts?: Record<string, number>;
}

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

export const IdeaWorkspaceToolbar: React.FC<IdeaWorkspaceToolbarProps> = ({
  activeTool,
  onToolChange,
  familyCounts,
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
          const hasContent = (familyCounts?.[tool.id] ?? 0) > 0;
          return (
            <button
              key={tool.id}
              onClick={() => onToolChange(tool.id)}
              className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-semibold transition-all ${
                isActive
                  ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800'
              }`}
              title={isPl ? tool.labelPl : tool.labelEn}
            >
              <Icon size={14} />
              <span className="hidden sm:inline">{isPl ? tool.labelPl : tool.labelEn}</span>
              {hasContent && !isActive && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary-500/60" />
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
              <Layers size={10} className="text-slate-400" />
              <span className="text-[8px] text-slate-400 font-medium">+{otherFamilies.length}</span>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default IdeaWorkspaceToolbar;
