/**
 * StudioToolbar - Bottom toolbar for adding nodes
 */

import {
  AlignHorizontalDistributeCenter,
  ChevronDown,
  ChevronUp,
  Circle,
  Diamond,
  LayoutGrid,
  Plus,
  Square,
  StickyNote,
  Users,
} from 'lucide-react';
import React, { useState } from 'react';

interface NodeTypeOption {
  type: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const NODE_TYPES: Record<string, NodeTypeOption[]> = {
  process_flow: [
    {
      type: 'processStep',
      label: 'Process Step',
      icon: <Square size={16} />,
      description: 'Action or task',
    },
    {
      type: 'decision',
      label: 'Decision',
      icon: <Diamond size={16} />,
      description: 'Yes/No branch',
    },
    {
      type: 'startEnd',
      label: 'Start/End',
      icon: <Circle size={16} />,
      description: 'Flow terminal',
    },
    { type: 'textNode', label: 'Note', icon: <StickyNote size={16} />, description: 'Annotation' },
  ],
  org_chart: [
    {
      type: 'orgUnit',
      label: 'Person/Team',
      icon: <Users size={16} />,
      description: 'Organization unit',
    },
    { type: 'textNode', label: 'Note', icon: <StickyNote size={16} />, description: 'Annotation' },
  ],
  mindmap: [
    {
      type: 'mindmapNode',
      label: 'Topic',
      icon: <Circle size={16} />,
      description: 'Mind map node',
    },
    { type: 'textNode', label: 'Note', icon: <StickyNote size={16} />, description: 'Annotation' },
  ],
  raci: [
    {
      type: 'raciCell',
      label: 'RACI Cell',
      icon: <LayoutGrid size={16} />,
      description: 'Matrix cell',
    },
  ],
  swimlane: [
    {
      type: 'swimlane',
      label: 'Swimlane',
      icon: <AlignHorizontalDistributeCenter size={16} />,
      description: 'Department lane',
    },
    {
      type: 'processStep',
      label: 'Process Step',
      icon: <Square size={16} />,
      description: 'Action or task',
    },
    {
      type: 'decision',
      label: 'Decision',
      icon: <Diamond size={16} />,
      description: 'Yes/No branch',
    },
  ],
};

interface StudioToolbarProps {
  diagramType: string;
  onAddNode: (type: string) => void;
  className?: string;
}

export const StudioToolbar: React.FC<StudioToolbarProps> = ({
  diagramType,
  onAddNode,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const nodeTypes = NODE_TYPES[diagramType] || NODE_TYPES.process_flow;

  return (
    <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 ${className}`}>
      {/* Expand/Collapse Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute -top-8 left-1/2 -translate-x-1/2 px-3 py-1 bg-c-surface-raised backdrop-blur-sm border border-c-border-subtle rounded-t-lg text-c-text-muted hover:text-c-text transition-colors"
      >
        {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>

      {/* Toolbar */}
      {isExpanded && (
        <div className="flex items-center gap-1 px-2 py-2 bg-c-surface-raised backdrop-blur-sm border border-c-border-subtle rounded-xl shadow-xl">
          {nodeTypes.map((nodeType) => (
            <button
              key={nodeType.type}
              onClick={() => onAddNode(nodeType.type)}
              className="group relative flex items-center gap-2 px-3 py-2 text-c-text-muted hover:text-c-text hover:bg-c-surface rounded-lg transition-all"
              title={nodeType.description}
            >
              {nodeType.icon}
              <span className="text-xs font-medium">{nodeType.label}</span>

              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-c-surface border border-c-border-subtle rounded text-[10px] text-c-text-muted whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                {nodeType.description}
              </div>
            </button>
          ))}

          <div className="w-px h-6 bg-c-border-subtle mx-1" />

          <button className="flex items-center gap-1 px-3 py-2 text-c-accent hover:text-c-accent hover:bg-c-accent-soft rounded-lg transition-all">
            <Plus size={14} />
            <span className="text-xs font-medium">More</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default StudioToolbar;
