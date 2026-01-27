/**
 * Drag and Drop Tests
 * Tests for drag and drop functionality
 *
 * @module tests/ui/drag-drop.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Drag manager implementation
const createDragManager = () => {
  let dragState = null;
  const dropZones = new Map();
  const listeners = { start: [], move: [], end: [], enter: [], leave: [], drop: [] };

  const emit = (event, data) => {
    listeners[event]?.forEach((fn) => fn(data));
  };

  return {
    startDrag: (item, event) => {
      dragState = {
        item,
        startX: event.clientX,
        startY: event.clientY,
        currentX: event.clientX,
        currentY: event.clientY,
        offsetX: event.offsetX || 0,
        offsetY: event.offsetY || 0,
        startTime: Date.now(),
      };
      emit('start', { state: dragState });
      return dragState;
    },

    updateDrag: (event) => {
      if (!dragState) return null;

      dragState.currentX = event.clientX;
      dragState.currentY = event.clientY;
      dragState.deltaX = dragState.currentX - dragState.startX;
      dragState.deltaY = dragState.currentY - dragState.startY;

      emit('move', { state: dragState });
      return dragState;
    },

    endDrag: () => {
      if (!dragState) return null;

      const finalState = { ...dragState, endTime: Date.now() };
      emit('end', { state: finalState });
      dragState = null;
      return finalState;
    },

    getDragState: () => dragState,

    isDragging: () => dragState !== null,

    registerDropZone: (id, config) => {
      dropZones.set(id, {
        id,
        accept: config.accept || (() => true),
        onEnter: config.onEnter,
        onLeave: config.onLeave,
        onDrop: config.onDrop,
        data: config.data,
      });
    },

    unregisterDropZone: (id) => {
      dropZones.delete(id);
    },

    enterDropZone: (zoneId) => {
      const zone = dropZones.get(zoneId);
      if (!zone || !dragState) return false;

      if (!zone.accept(dragState.item)) return false;

      dragState.overZone = zoneId;
      zone.onEnter?.(dragState);
      emit('enter', { zone, state: dragState });
      return true;
    },

    leaveDropZone: (zoneId) => {
      const zone = dropZones.get(zoneId);
      if (!zone || !dragState) return false;

      if (dragState.overZone === zoneId) {
        dragState.overZone = null;
      }
      zone.onLeave?.(dragState);
      emit('leave', { zone, state: dragState });
      return true;
    },

    drop: (zoneId) => {
      const zone = dropZones.get(zoneId);
      if (!zone || !dragState) return null;

      if (!zone.accept(dragState.item)) return null;

      const result = zone.onDrop?.(dragState.item, zone.data);
      emit('drop', { zone, item: dragState.item, result });

      this.endDrag();
      return result;
    },

    on: (event, handler) => {
      if (listeners[event]) {
        listeners[event].push(handler);
      }
      return () => {
        const index = listeners[event]?.indexOf(handler);
        if (index !== -1) listeners[event].splice(index, 1);
      };
    },
  };
};

// Sortable list implementation
const createSortableList = (items = []) => {
  let currentItems = [...items];
  const listeners = { reorder: [] };

  return {
    getItems: () => [...currentItems],

    setItems: (newItems) => {
      currentItems = [...newItems];
    },

    moveItem: (fromIndex, toIndex) => {
      if (fromIndex < 0 || fromIndex >= currentItems.length) return false;
      if (toIndex < 0 || toIndex > currentItems.length) return false;
      if (fromIndex === toIndex) return false;

      const [item] = currentItems.splice(fromIndex, 1);
      currentItems.splice(toIndex, 0, item);

      listeners.reorder.forEach((fn) =>
        fn({
          item,
          fromIndex,
          toIndex,
          items: [...currentItems],
        })
      );

      return true;
    },

    getDropIndex: (y, itemHeight) => {
      return Math.floor(y / itemHeight);
    },

    onReorder: (handler) => {
      listeners.reorder.push(handler);
      return () => {
        const index = listeners.reorder.indexOf(handler);
        if (index !== -1) listeners.reorder.splice(index, 1);
      };
    },
  };
};

// Drag preview helper
const createDragPreview = () => {
  let preview = null;

  return {
    create: (element, options = {}) => {
      const { opacity = 0.8, scale = 1, cursor = 'grabbing' } = options;

      preview = {
        visible: true,
        opacity,
        scale,
        cursor,
        element,
        x: 0,
        y: 0,
      };

      return preview;
    },

    update: (x, y) => {
      if (!preview) return;
      preview.x = x;
      preview.y = y;
    },

    destroy: () => {
      preview = null;
    },

    getPreview: () => preview,

    isVisible: () => preview?.visible || false,
  };
};

describe('Drag Manager Tests', () => {
  let manager;

  beforeEach(() => {
    manager = createDragManager();
  });

  // ═══════════════════════════════════════════════════════════════════
  // DRAG OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  describe('drag operations', () => {
    it('should start drag', () => {
      const item = { id: 1, name: 'Item 1' };
      const state = manager.startDrag(item, { clientX: 100, clientY: 100 });

      expect(manager.isDragging()).toBe(true);
      expect(state.item).toBe(item);
    });

    it('should update drag position', () => {
      manager.startDrag({ id: 1 }, { clientX: 100, clientY: 100 });
      const state = manager.updateDrag({ clientX: 150, clientY: 120 });

      expect(state.deltaX).toBe(50);
      expect(state.deltaY).toBe(20);
    });

    it('should end drag', () => {
      manager.startDrag({ id: 1 }, { clientX: 100, clientY: 100 });
      const finalState = manager.endDrag();

      expect(manager.isDragging()).toBe(false);
      expect(finalState.item.id).toBe(1);
    });

    it('should emit events', () => {
      const startHandler = vi.fn();
      const moveHandler = vi.fn();
      const endHandler = vi.fn();

      manager.on('start', startHandler);
      manager.on('move', moveHandler);
      manager.on('end', endHandler);

      manager.startDrag({ id: 1 }, { clientX: 0, clientY: 0 });
      manager.updateDrag({ clientX: 10, clientY: 10 });
      manager.endDrag();

      expect(startHandler).toHaveBeenCalled();
      expect(moveHandler).toHaveBeenCalled();
      expect(endHandler).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // DROP ZONES
  // ═══════════════════════════════════════════════════════════════════

  describe('drop zones', () => {
    it('should register drop zone', () => {
      manager.registerDropZone('zone-1', { data: { type: 'list' } });

      // Verify zone accepts the drag
      manager.startDrag({ id: 1 }, { clientX: 0, clientY: 0 });
      const entered = manager.enterDropZone('zone-1');
      expect(entered).toBe(true);
    });

    it('should handle enter/leave', () => {
      const onEnter = vi.fn();
      const onLeave = vi.fn();

      manager.registerDropZone('zone-1', { onEnter, onLeave });
      manager.startDrag({ id: 1 }, { clientX: 0, clientY: 0 });

      manager.enterDropZone('zone-1');
      expect(onEnter).toHaveBeenCalled();

      manager.leaveDropZone('zone-1');
      expect(onLeave).toHaveBeenCalled();
    });

    it('should handle drop', () => {
      const onDrop = vi.fn().mockReturnValue({ success: true });

      manager.registerDropZone('zone-1', { onDrop });
      manager.startDrag({ id: 1 }, { clientX: 0, clientY: 0 });

      const result = manager.drop('zone-1');

      expect(onDrop).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(manager.isDragging()).toBe(false);
    });

    it('should respect accept function', () => {
      const onDrop = vi.fn();

      manager.registerDropZone('zone-1', {
        accept: (item) => item.type === 'image',
        onDrop,
      });

      manager.startDrag({ id: 1, type: 'text' }, { clientX: 0, clientY: 0 });
      manager.enterDropZone('zone-1');

      expect(manager.getDragState().overZone).toBeUndefined();
    });
  });
});

describe('Sortable List Tests', () => {
  let sortable;

  beforeEach(() => {
    sortable = createSortableList(['a', 'b', 'c', 'd', 'e']);
  });

  it('should get items', () => {
    expect(sortable.getItems()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('should move item forward', () => {
    sortable.moveItem(0, 2);

    expect(sortable.getItems()).toEqual(['b', 'c', 'a', 'd', 'e']);
  });

  it('should move item backward', () => {
    sortable.moveItem(3, 1);

    expect(sortable.getItems()).toEqual(['a', 'd', 'b', 'c', 'e']);
  });

  it('should emit reorder event', () => {
    const handler = vi.fn();
    sortable.onReorder(handler);

    sortable.moveItem(0, 2);

    expect(handler).toHaveBeenCalledWith({
      item: 'a',
      fromIndex: 0,
      toIndex: 2,
      items: ['b', 'c', 'a', 'd', 'e'],
    });
  });

  it('should calculate drop index', () => {
    const index = sortable.getDropIndex(75, 50);

    expect(index).toBe(1);
  });

  it('should reject invalid moves', () => {
    expect(sortable.moveItem(-1, 2)).toBe(false);
    expect(sortable.moveItem(10, 2)).toBe(false);
    expect(sortable.moveItem(1, 1)).toBe(false);
  });
});

describe('Drag Preview Tests', () => {
  let preview;

  beforeEach(() => {
    preview = createDragPreview();
  });

  it('should create preview', () => {
    preview.create({ id: 'element' }, { opacity: 0.5 });

    expect(preview.isVisible()).toBe(true);
    expect(preview.getPreview().opacity).toBe(0.5);
  });

  it('should update position', () => {
    preview.create({ id: 'element' });
    preview.update(100, 200);

    expect(preview.getPreview().x).toBe(100);
    expect(preview.getPreview().y).toBe(200);
  });

  it('should destroy preview', () => {
    preview.create({ id: 'element' });
    preview.destroy();

    expect(preview.isVisible()).toBe(false);
  });
});
