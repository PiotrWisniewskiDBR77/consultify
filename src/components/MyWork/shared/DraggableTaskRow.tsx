/**
 * DraggableTaskRow
 * Wrapper component for making table rows draggable
 * Uses @dnd-kit for smooth drag and drop experience
 */

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import React from 'react';

interface DraggableTaskRowProps {
  id: string;
  children: React.ReactNode;
  disabled?: boolean;
}

export const DraggableTaskRow: React.FC<DraggableTaskRowProps> = ({
  id,
  children,
  disabled = false,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id,
    disabled,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 999 : 'auto',
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`
        ${isDragging ? 'bg-primary-50 dark:bg-primary-500/10 shadow-lg' : ''}
        ${isOver ? 'bg-primary-50/50 dark:bg-primary-500/5' : ''}
      `}
    >
      {/* Drag Handle */}
      <td className="w-6 px-1 py-2">
        <button
          {...attributes}
          {...listeners}
          className={`
            p-1 rounded cursor-grab active:cursor-grabbing
            text-slate-300 dark:text-navy-500
            hover:text-slate-500 dark:hover:text-navy-300
            hover:bg-slate-100 dark:hover:bg-navy-700
            transition-colors
            ${disabled ? 'invisible' : ''}
          `}
          title="Drag to reorder"
        >
          <GripVertical size={14} />
        </button>
      </td>
      {children}
    </tr>
  );
};

export default DraggableTaskRow;
