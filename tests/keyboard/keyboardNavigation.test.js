/**
 * Keyboard Navigation Tests
 * Tests for keyboard shortcuts, focus management, and navigation patterns
 *
 * @module tests/keyboard/keyboardNavigation.test.js
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ============================================
// HELPER IMPLEMENTATIONS (inline mocks)
// ============================================

/**
 * Creates a keyboard shortcut manager
 */
const createShortcutManager = () => {
  const shortcuts = new Map();
  const contexts = new Map();
  let activeContext = 'global';
  let isEnabled = true;

  const parseShortcut = (shortcut) => {
    const parts = shortcut.toLowerCase().split('+');
    return {
      key: parts[parts.length - 1],
      ctrl: parts.includes('ctrl') || parts.includes('cmd'),
      alt: parts.includes('alt'),
      shift: parts.includes('shift'),
      meta: parts.includes('meta') || parts.includes('cmd'),
    };
  };

  const matchesEvent = (parsed, event) => {
    return (
      parsed.key === event.key.toLowerCase() &&
      parsed.ctrl === event.ctrlKey &&
      parsed.alt === event.altKey &&
      parsed.shift === event.shiftKey
    );
  };

  return {
    register: (shortcut, handler, options = {}) => {
      const context = options.context || 'global';
      const id = `${context}:${shortcut}`;

      shortcuts.set(id, {
        shortcut,
        handler,
        context,
        parsed: parseShortcut(shortcut),
        description: options.description || '',
        preventDefault: options.preventDefault !== false,
      });

      return id;
    },

    unregister: (id) => {
      return shortcuts.delete(id);
    },

    handleKeyDown: (event) => {
      if (!isEnabled) return false;

      for (const [id, config] of shortcuts) {
        // Skip shortcuts that don't match the current context
        // Only allow global shortcuts when we're in global context
        if (config.context !== activeContext) continue;

        if (matchesEvent(config.parsed, event)) {
          if (config.preventDefault) {
            event.preventDefault?.();
          }
          config.handler(event);
          return true;
        }
      }
      return false;
    },

    setContext: (context) => {
      activeContext = context;
    },

    getContext: () => activeContext,

    enable: () => {
      isEnabled = true;
    },
    disable: () => {
      isEnabled = false;
    },
    isEnabled: () => isEnabled,

    getShortcuts: (context) => {
      const result = [];
      for (const [id, config] of shortcuts) {
        if (!context || config.context === context) {
          result.push({ id, shortcut: config.shortcut, description: config.description });
        }
      }
      return result;
    },

    clear: () => {
      shortcuts.clear();
    },
  };
};

/**
 * Creates a roving tabindex manager for list navigation
 */
const createRovingTabindex = () => {
  let items = [];
  let activeIndex = 0;
  const listeners = [];

  const notifyChange = (prevIndex, newIndex) => {
    listeners.forEach((cb) => cb({ prevIndex, newIndex, item: items[newIndex] }));
  };

  return {
    setItems: (newItems) => {
      items = newItems;
      activeIndex = Math.min(activeIndex, items.length - 1);
      if (activeIndex < 0) activeIndex = 0;
    },

    getItems: () => [...items],
    getActiveIndex: () => activeIndex,
    getActiveItem: () => items[activeIndex],

    setActiveIndex: (index) => {
      if (index >= 0 && index < items.length && index !== activeIndex) {
        const prev = activeIndex;
        activeIndex = index;
        notifyChange(prev, activeIndex);
      }
    },

    next: () => {
      if (items.length === 0) return;
      const prev = activeIndex;
      activeIndex = (activeIndex + 1) % items.length;
      notifyChange(prev, activeIndex);
      return items[activeIndex];
    },

    prev: () => {
      if (items.length === 0) return;
      const prev = activeIndex;
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      notifyChange(prev, activeIndex);
      return items[activeIndex];
    },

    first: () => {
      if (items.length === 0) return;
      const prev = activeIndex;
      activeIndex = 0;
      notifyChange(prev, activeIndex);
      return items[activeIndex];
    },

    last: () => {
      if (items.length === 0) return;
      const prev = activeIndex;
      activeIndex = items.length - 1;
      notifyChange(prev, activeIndex);
      return items[activeIndex];
    },

    handleKeyDown: (event) => {
      switch (event.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          event.preventDefault?.();
          return this.next();
        case 'ArrowUp':
        case 'ArrowLeft':
          event.preventDefault?.();
          return this.prev();
        case 'Home':
          event.preventDefault?.();
          return this.first();
        case 'End':
          event.preventDefault?.();
          return this.last();
      }
      return null;
    },

    onChange: (callback) => {
      listeners.push(callback);
      return () => {
        const idx = listeners.indexOf(callback);
        if (idx > -1) listeners.splice(idx, 1);
      };
    },

    getTabIndices: () =>
      items.map((item, i) => ({
        item,
        tabIndex: i === activeIndex ? 0 : -1,
      })),
  };
};

/**
 * Creates a type-ahead search for list selection
 */
const createTypeAhead = () => {
  let items = [];
  let buffer = '';
  let timeoutId = null;
  const TIMEOUT = 500;

  const normalizeText = (text) => text.toLowerCase().trim();

  return {
    setItems: (newItems) => {
      items = newItems.map((item) => ({
        ...item,
        searchText: normalizeText(item.label || item.text || String(item)),
      }));
    },

    handleKeyPress: (char) => {
      if (char.length !== 1) return null;

      clearTimeout(timeoutId);
      buffer += char.toLowerCase();

      timeoutId = setTimeout(() => {
        buffer = '';
      }, TIMEOUT);

      // Find first match
      const match = items.find((item) => item.searchText.startsWith(buffer));

      return match || null;
    },

    getBuffer: () => buffer,

    clear: () => {
      buffer = '';
      clearTimeout(timeoutId);
    },

    search: (query) => {
      const normalized = normalizeText(query);
      return items.filter((item) => item.searchText.includes(normalized));
    },
  };
};

/**
 * Creates a focus zone manager for composite widgets
 */
const createFocusZone = () => {
  const zones = new Map();
  let activeZoneId = null;

  return {
    registerZone: (id, config = {}) => {
      zones.set(id, {
        id,
        items: [],
        activeIndex: 0,
        wrap: config.wrap !== false,
        orientation: config.orientation || 'vertical',
        onFocus: config.onFocus,
        onBlur: config.onBlur,
      });
      return id;
    },

    unregisterZone: (id) => {
      zones.delete(id);
      if (activeZoneId === id) activeZoneId = null;
    },

    setZoneItems: (zoneId, items) => {
      const zone = zones.get(zoneId);
      if (zone) zone.items = items;
    },

    focusZone: (zoneId) => {
      const prevZone = zones.get(activeZoneId);
      if (prevZone?.onBlur) prevZone.onBlur();

      activeZoneId = zoneId;
      const zone = zones.get(zoneId);
      if (zone?.onFocus) zone.onFocus();

      return zone;
    },

    getActiveZone: () => zones.get(activeZoneId) || null,

    navigate: (direction) => {
      const zone = zones.get(activeZoneId);
      if (!zone || zone.items.length === 0) return null;

      const delta = direction === 'next' ? 1 : -1;
      let newIndex = zone.activeIndex + delta;

      if (zone.wrap) {
        newIndex = (newIndex + zone.items.length) % zone.items.length;
      } else {
        newIndex = Math.max(0, Math.min(zone.items.length - 1, newIndex));
      }

      zone.activeIndex = newIndex;
      return zone.items[newIndex];
    },

    moveFocus: (zoneId, index) => {
      const zone = zones.get(zoneId);
      if (zone && index >= 0 && index < zone.items.length) {
        zone.activeIndex = index;
        return zone.items[index];
      }
      return null;
    },

    handleKeyDown: (event) => {
      const zone = zones.get(activeZoneId);
      if (!zone) return false;

      const isVertical = zone.orientation === 'vertical';
      const nextKeys = isVertical ? ['ArrowDown'] : ['ArrowRight'];
      const prevKeys = isVertical ? ['ArrowUp'] : ['ArrowLeft'];

      if (nextKeys.includes(event.key)) {
        event.preventDefault?.();
        this.navigate('next');
        return true;
      }
      if (prevKeys.includes(event.key)) {
        event.preventDefault?.();
        this.navigate('prev');
        return true;
      }

      return false;
    },

    getZones: () => Array.from(zones.values()),
  };
};

// ============================================
// TESTS
// ============================================

describe('Keyboard Navigation Tests', () => {
  let shortcutManager;
  let rovingTabindex;
  let typeAhead;
  let focusZone;

  beforeEach(() => {
    shortcutManager = createShortcutManager();
    rovingTabindex = createRovingTabindex();
    typeAhead = createTypeAhead();
    focusZone = createFocusZone();
    vi.useFakeTimers();
  });

  afterEach(() => {
    shortcutManager.clear();
    vi.useRealTimers();
  });

  describe('Shortcut Manager', () => {
    it('should register and trigger shortcuts', () => {
      const handler = vi.fn();
      shortcutManager.register('ctrl+s', handler);

      const event = { key: 's', ctrlKey: true, altKey: false, shiftKey: false };
      const handled = shortcutManager.handleKeyDown(event);

      expect(handled).toBe(true);
      expect(handler).toHaveBeenCalled();
    });

    it('should handle multi-key shortcuts', () => {
      const handler = vi.fn();
      shortcutManager.register('ctrl+shift+p', handler);

      shortcutManager.handleKeyDown({ key: 'p', ctrlKey: true, shiftKey: true, altKey: false });

      expect(handler).toHaveBeenCalled();
    });

    it('should respect context-specific shortcuts', () => {
      const globalHandler = vi.fn();
      const modalHandler = vi.fn();

      shortcutManager.register('escape', globalHandler, { context: 'global' });
      shortcutManager.register('escape', modalHandler, { context: 'modal' });

      shortcutManager.setContext('modal');
      shortcutManager.handleKeyDown({
        key: 'escape',
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
      });

      expect(modalHandler).toHaveBeenCalled();
      expect(globalHandler).not.toHaveBeenCalled();
    });

    it('should enable and disable shortcuts', () => {
      const handler = vi.fn();
      shortcutManager.register('ctrl+a', handler);

      shortcutManager.disable();
      shortcutManager.handleKeyDown({ key: 'a', ctrlKey: true, altKey: false, shiftKey: false });
      expect(handler).not.toHaveBeenCalled();

      shortcutManager.enable();
      shortcutManager.handleKeyDown({ key: 'a', ctrlKey: true, altKey: false, shiftKey: false });
      expect(handler).toHaveBeenCalled();
    });

    it('should unregister shortcuts', () => {
      const handler = vi.fn();
      const id = shortcutManager.register('ctrl+x', handler);

      shortcutManager.unregister(id);
      shortcutManager.handleKeyDown({ key: 'x', ctrlKey: true, altKey: false, shiftKey: false });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should list registered shortcuts', () => {
      shortcutManager.register('ctrl+s', () => {}, { description: 'Save' });
      shortcutManager.register('ctrl+z', () => {}, { description: 'Undo' });

      const shortcuts = shortcutManager.getShortcuts();

      expect(shortcuts).toHaveLength(2);
      expect(shortcuts.some((s) => s.description === 'Save')).toBe(true);
    });
  });

  describe('Roving Tabindex', () => {
    beforeEach(() => {
      rovingTabindex.setItems(['item1', 'item2', 'item3', 'item4']);
    });

    it('should navigate to next item', () => {
      rovingTabindex.next();
      expect(rovingTabindex.getActiveIndex()).toBe(1);

      rovingTabindex.next();
      expect(rovingTabindex.getActiveIndex()).toBe(2);
    });

    it('should navigate to previous item', () => {
      rovingTabindex.setActiveIndex(2);
      rovingTabindex.prev();
      expect(rovingTabindex.getActiveIndex()).toBe(1);
    });

    it('should wrap around at boundaries', () => {
      rovingTabindex.setActiveIndex(3);
      rovingTabindex.next();
      expect(rovingTabindex.getActiveIndex()).toBe(0);

      rovingTabindex.prev();
      expect(rovingTabindex.getActiveIndex()).toBe(3);
    });

    it('should jump to first and last', () => {
      rovingTabindex.last();
      expect(rovingTabindex.getActiveIndex()).toBe(3);

      rovingTabindex.first();
      expect(rovingTabindex.getActiveIndex()).toBe(0);
    });

    it('should return correct tab indices', () => {
      rovingTabindex.setActiveIndex(1);
      const indices = rovingTabindex.getTabIndices();

      expect(indices[0].tabIndex).toBe(-1);
      expect(indices[1].tabIndex).toBe(0);
      expect(indices[2].tabIndex).toBe(-1);
    });

    it('should emit change events', () => {
      const callback = vi.fn();
      rovingTabindex.onChange(callback);

      rovingTabindex.next();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          prevIndex: 0,
          newIndex: 1,
        })
      );
    });
  });

  describe('Type-Ahead Search', () => {
    beforeEach(() => {
      typeAhead.setItems([
        { label: 'Apple' },
        { label: 'Apricot' },
        { label: 'Banana' },
        { label: 'Cherry' },
      ]);
    });

    it('should find items by first letter', () => {
      const result = typeAhead.handleKeyPress('a');
      expect(result.label).toBe('Apple');
    });

    it('should accumulate characters for longer matches', () => {
      typeAhead.handleKeyPress('a');
      typeAhead.handleKeyPress('p');
      typeAhead.handleKeyPress('r');

      expect(typeAhead.getBuffer()).toBe('apr');
    });

    it('should reset buffer after timeout', () => {
      typeAhead.handleKeyPress('a');
      vi.advanceTimersByTime(600);

      expect(typeAhead.getBuffer()).toBe('');
    });

    it('should search for items containing query', () => {
      const results = typeAhead.search('an');
      const labels = results.map((r) => r.label);

      expect(labels).toContain('Banana');
    });

    it('should return null when no match found', () => {
      const result = typeAhead.handleKeyPress('z');
      expect(result).toBeNull();
    });
  });

  describe('Focus Zone', () => {
    beforeEach(() => {
      focusZone.registerZone('menu', { orientation: 'vertical' });
      focusZone.setZoneItems('menu', ['Item 1', 'Item 2', 'Item 3']);
    });

    it('should register and focus zones', () => {
      focusZone.focusZone('menu');
      expect(focusZone.getActiveZone().id).toBe('menu');
    });

    it('should navigate within zone', () => {
      focusZone.focusZone('menu');

      const next = focusZone.navigate('next');
      expect(next).toBe('Item 2');

      const prev = focusZone.navigate('prev');
      expect(prev).toBe('Item 1');
    });

    it('should wrap navigation by default', () => {
      focusZone.focusZone('menu');
      focusZone.navigate('prev'); // Should wrap to last

      const zone = focusZone.getActiveZone();
      expect(zone.activeIndex).toBe(2);
    });

    it('should call focus/blur callbacks', () => {
      const onFocus = vi.fn();
      const onBlur = vi.fn();

      focusZone.registerZone('zone1', { onFocus, onBlur });
      focusZone.registerZone('zone2', {});

      focusZone.focusZone('zone1');
      expect(onFocus).toHaveBeenCalled();

      focusZone.focusZone('zone2');
      expect(onBlur).toHaveBeenCalled();
    });

    it('should move focus to specific index', () => {
      focusZone.focusZone('menu');
      const item = focusZone.moveFocus('menu', 2);

      expect(item).toBe('Item 3');
    });

    it('should list all zones', () => {
      focusZone.registerZone('toolbar', {});
      focusZone.registerZone('sidebar', {});

      const zones = focusZone.getZones();
      expect(zones).toHaveLength(3);
    });
  });
});
