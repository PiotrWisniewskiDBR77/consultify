/**
 * EditableBlock — wraps any block with selection, hover state, and floating toolbar.
 * Uses TipTap for rich-text inline editing on text-based blocks.
 */

import { Copy, GripVertical, Image, RefreshCw, Trash2 } from 'lucide-react';
import React, { useCallback, useState } from 'react';

import type { CardBlock } from '../wizard/types';
import { TipTapEditor } from './TipTapEditor';

interface EditableBlockProps {
  block: CardBlock;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<CardBlock>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onRefresh?: () => void;
  children: React.ReactNode;
}

const TEXT_BLOCK_TYPES = ['heading', 'paragraph', 'bullet_list', 'numbered_list'];

export const EditableBlock: React.FC<EditableBlockProps> = ({
  block,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  onDuplicate,
  onRefresh,
  children,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const isTextBlock = TEXT_BLOCK_TYPES.includes(block.type);

  const handleDoubleClick = useCallback(() => {
    if (isTextBlock) {
      setIsEditing(true);
    }
  }, [isTextBlock]);

  const handleContentChange = useCallback(
    (html: string) => {
      const plainText = html.replace(/<[^>]+>/g, '').trim();
      if (block.type === 'heading' || block.type === 'paragraph') {
        onUpdate({ content: { ...block.content, text: plainText, html } });
      } else if (block.type === 'bullet_list' || block.type === 'numbered_list') {
        const items = html
          .split(/<li[^>]*>/g)
          .slice(1)
          .map((li) =>
            li
              .replace(/<\/li>.*$/s, '')
              .replace(/<[^>]+>/g, '')
              .trim()
          )
          .filter(Boolean);
        if (items.length > 0) {
          onUpdate({ content: { ...block.content, items } });
        }
      }
    },
    [block, onUpdate]
  );

  const handleBlur = useCallback(() => {
    setIsEditing(false);
  }, []);

  const getEditorContent = (): string => {
    if (block.content.html) return block.content.html as string;
    if (block.type === 'heading' || block.type === 'paragraph') {
      return (block.content.text as string) || '';
    }
    if (block.type === 'bullet_list' || block.type === 'numbered_list') {
      const items = (block.content.items as string[]) || [];
      const tag = block.type === 'numbered_list' ? 'ol' : 'ul';
      return `<${tag}>${items.map((i) => `<li>${i}</li>`).join('')}</${tag}>`;
    }
    return '';
  };

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onDoubleClick={handleDoubleClick}
      className={`relative group rounded-lg transition-all ${
        isSelected ? 'ring-2 ring-c-focus bg-c-accent-soft0' : 'hover:ring-1 hover:ring-c-border'
      }`}
    >
      {isSelected && (
        <div className="absolute -top-8 left-0 flex items-center gap-1 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg shadow-lg px-1 py-0.5 z-20">
          <button className="p-1 text-c-text-secondary cursor-grab hover:text-c-text-secondary">
            <GripVertical size={12} />
          </button>
          {block.is_refreshable && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRefresh?.();
              }}
              className="p-1 text-blue-400 hover:text-blue-600"
              title="Refresh from source"
            >
              <RefreshCw size={12} />
            </button>
          )}
          {block.type === 'image' && (
            <button
              className="p-1 text-c-text-secondary hover:text-c-text-secondary"
              title="Replace image"
            >
              <Image size={12} />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            className="p-1 text-c-text-secondary hover:text-c-text-secondary"
            title="Duplicate"
          >
            <Copy size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 text-danger-400 hover:text-danger-600"
            title="Delete"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}

      {isEditing && isTextBlock ? (
        <div className="p-1">
          <TipTapEditor
            content={getEditorContent()}
            onChange={handleContentChange}
            onBlur={handleBlur}
            isHeading={block.type === 'heading'}
            headingLevel={(block.content.level as 1 | 2 | 3 | 4) || 2}
            className={block.type === 'heading' ? 'text-2xl font-bold' : 'text-sm'}
            placeholder="Start typing..."
          />
        </div>
      ) : (
        children
      )}
    </div>
  );
};
