/**
 * IdeaCanvasToolSelector — V3-C06
 *
 * Compact icon-only selector for switching between canvas tools in the Ideas workspace.
 * Positioned in the top-right corner of the Ideas workspace.
 *
 * Tools: MindMap (default), Process Flow, Table, Whiteboard
 * Shared data model: IdeaWorkspaceGraph — switching tools preserves nodes/edges.
 */

import { Network, PenTool, Table2, Workflow } from 'lucide-react';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

// Re-export from canonical location
export type { CanvasToolType } from './ideaSelectionTypes';
import type { CanvasToolType } from './ideaSelectionTypes';

export interface IdeaNode {
  id: string;
  label: string;
  type: 'idea' | 'group' | 'note' | 'decision';
  position?: { x: number; y: number };
  parentId?: string;
  metadata?: Record<string, unknown>;
  clusterIds?: string[];
  outcomeType?: 'task' | 'decision' | 'initiative' | 'insight';
  artifactRef?: { type: string; id: string };
}

export interface IdeaEdge {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
  type?: 'relation' | 'dependency' | 'flow';
}

export interface IdeaWorkspaceGraph {
  nodes: IdeaNode[];
  edges: IdeaEdge[];
  extensions: Record<string, unknown>;
  preferredTool: CanvasToolType;
}

// ── Component ────────────────────────────────────────────────────────────────

const TOOL_CONFIG: Record<
  CanvasToolType,
  {
    icon: React.ComponentType<{ size?: number; className?: string }>;
    labelKey: string;
    tooltipKey: string;
  }
> = {
  mindmap: {
    icon: Network,
    labelKey: 'myWork.ideas.canvasTools.mindmap',
    tooltipKey: 'myWork.ideas.canvasTools.mindmapTooltip',
  },
  process_flow: {
    icon: Workflow,
    labelKey: 'myWork.ideas.canvasTools.processFlow',
    tooltipKey: 'myWork.ideas.canvasTools.processFlowTooltip',
  },
  table: {
    icon: Table2,
    labelKey: 'myWork.ideas.canvasTools.table',
    tooltipKey: 'myWork.ideas.canvasTools.tableTooltip',
  },
  whiteboard: {
    icon: PenTool,
    labelKey: 'myWork.ideas.canvasTools.whiteboard',
    tooltipKey: 'myWork.ideas.canvasTools.whiteboardTooltip',
  },
};

const TOOLS: CanvasToolType[] = ['mindmap', 'process_flow', 'table', 'whiteboard'];

export interface IdeaCanvasToolSelectorProps {
  activeTool: CanvasToolType;
  onToolChange: (tool: CanvasToolType) => void;
  disabledTools?: CanvasToolType[];
  className?: string;
}

export const IdeaCanvasToolSelector: React.FC<IdeaCanvasToolSelectorProps> = ({
  activeTool,
  onToolChange,
  disabledTools = [],
  className = '',
}) => {
  const { t } = useTranslation();

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, tool: CanvasToolType) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (disabledTools.includes(tool)) return;
        onToolChange(tool);
      }
    },
    [disabledTools, onToolChange]
  );

  return (
    <div
      className={`inline-flex items-center gap-0.5 p-0.5 rounded-full bg-slate-100/80 dark:bg-navy-800/80 border border-slate-200/60 dark:border-navy-700/60 ${className}`}
      role="radiogroup"
      aria-label={t('myWork.ideas.canvasTools.ariaLabel')}
    >
      {TOOLS.map((tool) => {
        const config = TOOL_CONFIG[tool];
        const Icon = config.icon;
        const isActive = activeTool === tool;
        const isDisabled = disabledTools.includes(tool);
        const label = t(config.labelKey);
        const tooltip = t(config.tooltipKey);

        return (
          <button
            key={tool}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-disabled={isDisabled}
            aria-label={label}
            title={isDisabled ? `${tooltip} — ${t('comingSoon')}` : tooltip}
            tabIndex={isActive ? 0 : -1}
            disabled={isDisabled}
            onClick={() => {
              if (isDisabled) return;
              onToolChange(tool);
            }}
            onKeyDown={(e) => handleKeyDown(e, tool)}
            className={`
              relative flex items-center justify-center p-2 rounded-full
              text-slate-500 dark:text-slate-400
              transition-all duration-200 ease-out
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-1
              ${
                isDisabled
                  ? 'opacity-40 cursor-not-allowed'
                  : isActive
                    ? 'bg-white dark:bg-navy-700 text-c-info shadow-sm scale-105'
                    : 'hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-700/50 hover:scale-105 active:scale-95'
              }
            `}
          >
            <Icon size={18} className={isActive ? 'transition-transform duration-200' : ''} />
          </button>
        );
      })}
    </div>
  );
};

export default IdeaCanvasToolSelector;
