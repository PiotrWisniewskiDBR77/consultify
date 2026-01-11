/**
 * Clipboard Tests
 * Tests for clipboard operations
 *
 * @module tests/ui/clipboard.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Clipboard manager implementation
const createClipboardManager = () => {
  let clipboardContent = null;
  let clipboardType = 'text';
  const history = [];
  const maxHistory = 10;
  const listeners = { copy: [], paste: [], cut: [], clear: [] };

  const emit = (event, data) => {
    listeners[event]?.forEach((fn) => fn(data));
  };

  return {
    copy: (content, type = 'text') => {
      clipboardContent = content;
      clipboardType = type;

      history.unshift({ content, type, timestamp: Date.now() });
      if (history.length > maxHistory) {
        history.pop();
      }

      emit('copy', { content, type });
      return true;
    },

    paste: () => {
      if (clipboardContent === null) return null;

      emit('paste', { content: clipboardContent, type: clipboardType });
      return { content: clipboardContent, type: clipboardType };
    },

    cut: (content, type = 'text') => {
      this.copy(content, type);
      emit('cut', { content, type });
      return true;
    },

    clear: () => {
      clipboardContent = null;
      clipboardType = 'text';
      emit('clear', {});
    },

    hasContent: () => clipboardContent !== null,

    getContent: () => clipboardContent,

    getType: () => clipboardType,

    getHistory: () => [...history],

    pasteFromHistory: (index) => {
      const item = history[index];
      if (!item) return null;

      clipboardContent = item.content;
      clipboardType = item.type;

      return { content: item.content, type: item.type };
    },

    clearHistory: () => {
      history.length = 0;
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

// Clipboard format handler
const createClipboardFormatter = () => {
  const formatters = new Map();

  // Default formatters
  formatters.set('text', {
    serialize: (content) => String(content),
    deserialize: (data) => data,
  });

  formatters.set('json', {
    serialize: (content) => JSON.stringify(content),
    deserialize: (data) => {
      try {
        return JSON.parse(data);
      } catch {
        return null;
      }
    },
  });

  formatters.set('html', {
    serialize: (content) => content,
    deserialize: (data) => data,
    mimeType: 'text/html',
  });

  return {
    register: (type, formatter) => {
      formatters.set(type, formatter);
    },

    serialize: (content, type) => {
      const formatter = formatters.get(type);
      if (!formatter) return String(content);
      return formatter.serialize(content);
    },

    deserialize: (data, type) => {
      const formatter = formatters.get(type);
      if (!formatter) return data;
      return formatter.deserialize(data);
    },

    getMimeType: (type) => {
      const formatter = formatters.get(type);
      return formatter?.mimeType || 'text/plain';
    },

    getTypes: () => [...formatters.keys()],
  };
};

// Rich clipboard (multiple formats)
const createRichClipboard = () => {
  const data = new Map();

  return {
    set: (type, content) => {
      data.set(type, content);
    },

    get: (type) => {
      return data.get(type);
    },

    has: (type) => {
      return data.has(type);
    },

    getTypes: () => [...data.keys()],

    getBestMatch: (preferredTypes) => {
      for (const type of preferredTypes) {
        if (data.has(type)) {
          return { type, content: data.get(type) };
        }
      }
      return null;
    },

    clear: () => {
      data.clear();
    },

    isEmpty: () => data.size === 0,

    toPlainText: () => {
      return (
        data.get('text/plain') || data.get('text') || (data.get('text/html') ? 'HTML content' : '')
      );
    },
  };
};

describe('Clipboard Manager Tests', () => {
  let clipboard;

  beforeEach(() => {
    clipboard = createClipboardManager();
  });

  // ═══════════════════════════════════════════════════════════════════
  // COPY / PASTE
  // ═══════════════════════════════════════════════════════════════════

  describe('copy / paste', () => {
    it('should copy content', () => {
      clipboard.copy('Hello, World!');

      expect(clipboard.hasContent()).toBe(true);
      expect(clipboard.getContent()).toBe('Hello, World!');
    });

    it('should paste content', () => {
      clipboard.copy('Test content');

      const result = clipboard.paste();

      expect(result.content).toBe('Test content');
    });

    it('should return null when empty', () => {
      expect(clipboard.paste()).toBeNull();
    });

    it('should support different types', () => {
      clipboard.copy({ key: 'value' }, 'json');

      expect(clipboard.getType()).toBe('json');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // CUT
  // ═══════════════════════════════════════════════════════════════════

  describe('cut', () => {
    it('should cut content', () => {
      clipboard.cut('Cut this');

      expect(clipboard.getContent()).toBe('Cut this');
    });

    it('should emit cut event', () => {
      const handler = vi.fn();
      clipboard.on('cut', handler);

      clipboard.cut('Content');

      expect(handler).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // HISTORY
  // ═══════════════════════════════════════════════════════════════════

  describe('history', () => {
    it('should track copy history', () => {
      clipboard.copy('First');
      clipboard.copy('Second');
      clipboard.copy('Third');

      const history = clipboard.getHistory();

      expect(history.length).toBe(3);
      expect(history[0].content).toBe('Third');
    });

    it('should limit history size', () => {
      for (let i = 0; i < 15; i++) {
        clipboard.copy(`Item ${i}`);
      }

      expect(clipboard.getHistory().length).toBe(10);
    });

    it('should paste from history', () => {
      clipboard.copy('First');
      clipboard.copy('Second');

      clipboard.pasteFromHistory(1);

      expect(clipboard.getContent()).toBe('First');
    });

    it('should clear history', () => {
      clipboard.copy('Item');
      clipboard.clearHistory();

      expect(clipboard.getHistory().length).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // EVENTS
  // ═══════════════════════════════════════════════════════════════════

  describe('events', () => {
    it('should emit copy event', () => {
      const handler = vi.fn();
      clipboard.on('copy', handler);

      clipboard.copy('Test');

      expect(handler).toHaveBeenCalledWith({ content: 'Test', type: 'text' });
    });

    it('should emit paste event', () => {
      const handler = vi.fn();
      clipboard.on('paste', handler);

      clipboard.copy('Test');
      clipboard.paste();

      expect(handler).toHaveBeenCalled();
    });

    it('should emit clear event', () => {
      const handler = vi.fn();
      clipboard.on('clear', handler);

      clipboard.copy('Test');
      clipboard.clear();

      expect(handler).toHaveBeenCalled();
    });
  });
});

describe('Clipboard Formatter Tests', () => {
  let formatter;

  beforeEach(() => {
    formatter = createClipboardFormatter();
  });

  it('should serialize text', () => {
    expect(formatter.serialize('Hello', 'text')).toBe('Hello');
  });

  it('should serialize JSON', () => {
    const result = formatter.serialize({ key: 'value' }, 'json');
    expect(result).toBe('{"key":"value"}');
  });

  it('should deserialize JSON', () => {
    const result = formatter.deserialize('{"key":"value"}', 'json');
    expect(result.key).toBe('value');
  });

  it('should handle invalid JSON', () => {
    const result = formatter.deserialize('invalid', 'json');
    expect(result).toBeNull();
  });

  it('should register custom formatter', () => {
    formatter.register('csv', {
      serialize: (arr) => arr.join(','),
      deserialize: (str) => str.split(','),
    });

    expect(formatter.serialize(['a', 'b', 'c'], 'csv')).toBe('a,b,c');
    expect(formatter.deserialize('a,b,c', 'csv')).toEqual(['a', 'b', 'c']);
  });

  it('should get mime type', () => {
    expect(formatter.getMimeType('html')).toBe('text/html');
    expect(formatter.getMimeType('text')).toBe('text/plain');
  });
});

describe('Rich Clipboard Tests', () => {
  let richClipboard;

  beforeEach(() => {
    richClipboard = createRichClipboard();
  });

  it('should store multiple formats', () => {
    richClipboard.set('text/plain', 'Plain text');
    richClipboard.set('text/html', '<b>Bold</b>');

    expect(richClipboard.has('text/plain')).toBe(true);
    expect(richClipboard.has('text/html')).toBe(true);
  });

  it('should get by type', () => {
    richClipboard.set('text/plain', 'Plain');
    richClipboard.set('text/html', '<p>HTML</p>');

    expect(richClipboard.get('text/plain')).toBe('Plain');
    expect(richClipboard.get('text/html')).toBe('<p>HTML</p>');
  });

  it('should get best match', () => {
    richClipboard.set('text/plain', 'Plain');
    richClipboard.set('text/html', '<p>HTML</p>');

    const result = richClipboard.getBestMatch(['text/html', 'text/plain']);

    expect(result.type).toBe('text/html');
  });

  it('should list types', () => {
    richClipboard.set('text/plain', 'A');
    richClipboard.set('text/html', 'B');

    expect(richClipboard.getTypes()).toContain('text/plain');
    expect(richClipboard.getTypes()).toContain('text/html');
  });

  it('should convert to plain text', () => {
    richClipboard.set('text/plain', 'Plain text version');
    richClipboard.set('text/html', '<b>HTML version</b>');

    expect(richClipboard.toPlainText()).toBe('Plain text version');
  });
});
