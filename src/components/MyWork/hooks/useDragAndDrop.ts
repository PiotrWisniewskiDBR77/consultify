/**
 * useDragAndDrop
 * Hook for managing drag and drop reordering of tasks
 * Uses @dnd-kit for smooth animations
 */

import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useCallback, useState } from 'react';

interface UseDragAndDropOptions<T extends { id: string }> {
  items: T[];
  onReorder: (items: T[]) => void;
  onDragStart?: (item: T) => void;
  onDragEnd?: (item: T, oldIndex: number, newIndex: number) => void;
}

export const useDragAndDrop = <T extends { id: string }>({
  items,
  onReorder,
  onDragStart,
  onDragEnd,
}: UseDragAndDropOptions<T>) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Minimum drag distance before activation
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      setActiveId(active.id as string);
      
      const item = items.find((i) => i.id === active.id);
      if (item && onDragStart) {
        onDragStart(item);
      }
    },
    [items, onDragStart]
  );

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    setOverId(over?.id as string | null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      
      setActiveId(null);
      setOverId(null);

      if (!over || active.id === over.id) {
        return;
      }

      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      if (oldIndex === -1 || newIndex === -1) {
        return;
      }

      const newItems = arrayMove(items, oldIndex, newIndex);
      onReorder(newItems);

      const item = items[oldIndex];
      if (item && onDragEnd) {
        onDragEnd(item, oldIndex, newIndex);
      }
    },
    [items, onReorder, onDragEnd]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOverId(null);
  }, []);

  const activeItem = activeId ? items.find((i) => i.id === activeId) : null;

  return {
    // DnD Kit components (for re-export)
    DndContext,
    SortableContext,
    
    // Sensor configuration
    sensors,
    
    // Event handlers
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    
    // State
    activeId,
    overId,
    activeItem,
    
    // Utilities
    itemIds: items.map((i) => i.id),
    sortingStrategy: verticalListSortingStrategy,
    collisionDetection: closestCenter,
  };
};

export default useDragAndDrop;
