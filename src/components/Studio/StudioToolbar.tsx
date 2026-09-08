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
import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';

interface NodeTypeOption {
  type: string;
  /** Klucz i18n etykiety węzła — pasek płótna idzie za językiem konta. */
  labelKey: string;
  labelDefault: string;
  icon: React.ReactNode;
  /** Klucz i18n dymka. */
  descriptionKey: string;
  descriptionDefault: string;
}

const NODE_TYPES: Record<string, NodeTypeOption[]> = {
  process_flow: [
    {
      type: 'processStep',
      labelKey: 'studio.node.processStep',
      labelDefault: 'Process step',
      icon: <Square size={16} />,
      descriptionKey: 'studio.node.desc.actionOrTask',
      descriptionDefault: 'Action or task',
    },
    {
      type: 'decision',
      labelKey: 'studio.node.decision',
      labelDefault: 'Decision',
      icon: <Diamond size={16} />,
      descriptionKey: 'studio.node.desc.yesNoBranch',
      descriptionDefault: 'Yes/No branch',
    },
    {
      type: 'startEnd',
      labelKey: 'studio.node.startEnd',
      labelDefault: 'Start/End',
      icon: <Circle size={16} />,
      descriptionKey: 'studio.node.desc.flowTerminal',
      descriptionDefault: 'Flow terminal',
    },
    { type: 'textNode', labelKey: 'studio.node.note',
      labelDefault: 'Note', icon: <StickyNote size={16} />, descriptionKey: 'studio.node.desc.annotation', descriptionDefault: 'Annotation' },
  ],
  org_chart: [
    {
      type: 'orgUnit',
      labelKey: 'studio.node.orgUnit',
      labelDefault: 'Person/Team',
      icon: <Users size={16} />,
      descriptionKey: 'studio.node.desc.orgUnit',
      descriptionDefault: 'Organisation unit',
    },
    { type: 'textNode', labelKey: 'studio.node.note',
      labelDefault: 'Note', icon: <StickyNote size={16} />, descriptionKey: 'studio.node.desc.annotation', descriptionDefault: 'Annotation' },
  ],
  mindmap: [
    {
      type: 'mindmapNode',
      labelKey: 'studio.node.topic',
      labelDefault: 'Topic',
      icon: <Circle size={16} />,
      descriptionKey: 'studio.node.desc.mindMapNode',
      descriptionDefault: 'Mind map node',
    },
    { type: 'textNode', labelKey: 'studio.node.note',
      labelDefault: 'Note', icon: <StickyNote size={16} />, descriptionKey: 'studio.node.desc.annotation', descriptionDefault: 'Annotation' },
  ],
  raci: [
    {
      type: 'raciCell',
      labelKey: 'studio.node.raciCell',
      labelDefault: 'RACI cell',
      icon: <LayoutGrid size={16} />,
      descriptionKey: 'studio.node.desc.matrixCell',
      descriptionDefault: 'Matrix cell',
    },
  ],
  swimlane: [
    {
      type: 'swimlane',
      labelKey: 'studio.node.swimlane',
      labelDefault: 'Swimlane',
      icon: <AlignHorizontalDistributeCenter size={16} />,
      descriptionKey: 'studio.node.desc.departmentLane',
      descriptionDefault: 'Department lane',
    },
    {
      type: 'processStep',
      labelKey: 'studio.node.processStep',
      labelDefault: 'Process step',
      icon: <Square size={16} />,
      descriptionKey: 'studio.node.desc.actionOrTask',
      descriptionDefault: 'Action or task',
    },
    {
      type: 'decision',
      labelKey: 'studio.node.decision',
      labelDefault: 'Decision',
      icon: <Diamond size={16} />,
      descriptionKey: 'studio.node.desc.yesNoBranch',
      descriptionDefault: 'Yes/No branch',
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
  const { t } = useTranslation();
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
              title={t(nodeType.descriptionKey, nodeType.descriptionDefault)}
            >
              {nodeType.icon}
              <span className="text-xs font-medium">{t(nodeType.labelKey, nodeType.labelDefault)}</span>

              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-c-surface border border-c-border-subtle rounded text-[10px] text-c-text-muted whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                {nodeType.description}
              </div>
            </button>
          ))}

          <div className="w-px h-6 bg-c-border-subtle mx-1" />

          <button className="flex items-center gap-1 px-3 py-2 text-c-accent hover:text-c-accent hover:bg-c-accent-soft rounded-lg transition-all">
            <Plus size={14} />
            <span className="text-xs font-medium">{t('common.more', 'More')}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default StudioToolbar;
