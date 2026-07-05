import { GripVertical, Lock, Trash2, Unlock, Wand2 } from 'lucide-react';
import React from 'react';

import { BlockType, ReportBlock } from '../../types';
import { CalloutBlock } from './blocks/CalloutBlock';
import { TableBlock } from './blocks/TableBlock';
import { TextBlock } from './blocks/TextBlock';

interface BlockRendererProps {
  block: ReportBlock;
  onUpdate: (updates: Partial<ReportBlock>) => void;
  onRegenerate: (instructions?: string) => void;
  onDelete: () => void;
  dragHandleProps?: any;
}

export const BlockRenderer: React.FC<BlockRendererProps> = ({
  block,
  onUpdate,
  onRegenerate,
  onDelete,
  dragHandleProps,
}) => {
  const renderContent = () => {
    switch (block.type) {
      case 'text':
        return <TextBlock block={block} onUpdate={onUpdate} />;
      case 'table':
        return <TableBlock block={block} onUpdate={onUpdate} />;
      case 'callout':
        return <CalloutBlock block={block} onUpdate={onUpdate} />;
      default:
        return (
          <div className="p-4 text-c-text-secondary italic">
            Unsupported block type: {block.type}
          </div>
        );
    }
  };

  const handleAiClick = () => {
    // Simple prompt for MVP
    const instructions = window.prompt(
      "Enter instructions for AI regeneration (e.g., 'Make it shorter'):"
    );
    if (instructions !== null) {
      onRegenerate(instructions);
    }
  };

  return (
    <div
      className={`group relative bg-c-surface rounded-xl border transition-all ${
        block.locked
          ? 'border-amber-200 dark:border-amber-900/30'
          : 'border-c-border-subtle hover:border-c-accent'
      } shadow-sm`}
    >
      {/* Block Header / Controls - Visible on Hover */}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-c-surface p-1 rounded backdrop-blur z-10">
        {/* Toggle Lock */}
        <button
          onClick={() => onUpdate({ locked: !block.locked })}
          className={`p-1.5 rounded hover:bg-c-surface-raised ${block.locked ? 'text-amber-500' : 'text-c-text-secondary'}`}
          title={block.locked ? 'Unlock' : 'Lock'}
        >
          {block.locked ? <Lock size={14} /> : <Unlock size={14} />}
        </button>

        {!block.locked && (
          <>
            {/* AI Action */}
            <button
              onClick={handleAiClick}
              className="p-1.5 rounded hover:bg-c-accent-soft text-c-accent"
              title="AI Rewrite"
            >
              <Wand2 size={14} />
            </button>

            {/* Delete */}
            <button
              onClick={onDelete}
              className="p-1.5 rounded hover:bg-danger-100 dark:hover:bg-danger-900/30 text-c-text-secondary hover:text-danger-500"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>

      {/* Drag Handle */}
      {!block.locked && (
        <div
          {...dragHandleProps}
          className="absolute top-1/2 -translate-y-1/2 -left-3 p-1.5 text-c-text-secondary hover:text-c-text-secondary cursor-move opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical size={16} />
        </div>
      )}

      {/* Content Area */}
      <div className="p-1">{renderContent()}</div>
    </div>
  );
};
