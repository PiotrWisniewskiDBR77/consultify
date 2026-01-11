/**
 * Clipboard Operations Tests
 * Tests for clipboard read/write, paste handling, and data transfer
 *
 * @module tests/clipboard/clipboardOperations.test.js
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================
// HELPER IMPLEMENTATIONS (inline mocks)
// ============================================

/**
 * Creates a clipboard manager mock
 */
const createClipboardManager = () => {
  let clipboardData = new Map();
  const history = [];
  const maxHistory = 10;
  const listeners = new Map();

  return {
    write: async (data) => {
      const entry = {
        timestamp: Date.now(),
        items: {},
      };

      for (const [type, content] of Object.entries(data)) {
        clipboardData.set(type, content);
        entry.items[type] = content;
      }

      history.unshift(entry);
      if (history.length > maxHistory) history.pop();

      listeners.get('write')?.forEach((cb) => cb(entry));
      return true;
    },

    read: async (types = []) => {
      const result = {};

      if (types.length === 0) {
        for (const [type, content] of clipboardData) {
          result[type] = content;
        }
      } else {
        for (const type of types) {
          if (clipboardData.has(type)) {
            result[type] = clipboardData.get(type);
          }
        }
      }

      listeners.get('read')?.forEach((cb) => cb(result));
      return result;
    },

    writeText: async (text) => {
      return this.write({ 'text/plain': text });
    },

    readText: async () => {
      return clipboardData.get('text/plain') || '';
    },

    clear: () => {
      clipboardData.clear();
    },

    hasType: (type) => clipboardData.has(type),

    getHistory: () => [...history],

    getLatest: () => history[0] || null,

    on: (event, callback) => {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(callback);
      return () => {
        const cbs = listeners.get(event);
        const idx = cbs?.indexOf(callback);
        if (idx > -1) cbs.splice(idx, 1);
      };
    },
  };
};

/**
 * Creates a data transfer handler for drag/drop and paste
 */
const createDataTransferHandler = () => {
  const supportedTypes = [
    'text/plain',
    'text/html',
    'text/uri-list',
    'application/json',
    'image/png',
    'image/jpeg',
    'Files',
  ];

  return {
    createTransfer: (items = {}) => {
      const data = new Map(Object.entries(items));
      const files = [];

      return {
        getData: (type) => data.get(type) || '',
        setData: (type, value) => {
          data.set(type, value);
        },
        clearData: (type) => {
          if (type) {
            data.delete(type);
          } else {
            data.clear();
          }
        },
        get types() {
          return Array.from(data.keys());
        },
        files,
        items: {
          get length() {
            return data.size;
          },
          add: (content, type) => {
            data.set(type, content);
          },
        },
        effectAllowed: 'all',
        dropEffect: 'none',
      };
    },

    parseTransfer: (dataTransfer) => {
      const result = {
        text: null,
        html: null,
        json: null,
        files: [],
        uris: [],
      };

      for (const type of dataTransfer.types) {
        const value = dataTransfer.getData(type);

        if (type === 'text/plain') {
          result.text = value;
        } else if (type === 'text/html') {
          result.html = value;
        } else if (type === 'application/json') {
          try {
            result.json = JSON.parse(value);
          } catch {}
        } else if (type === 'text/uri-list') {
          result.uris = value.split('\n').filter((u) => !u.startsWith('#'));
        }
      }

      if (dataTransfer.files) {
        result.files = Array.from(dataTransfer.files);
      }

      return result;
    },

    isSupported: (type) => supportedTypes.includes(type),

    getSupportedTypes: () => [...supportedTypes],
  };
};

/**
 * Creates a paste handler with content sanitization
 */
const createPasteHandler = () => {
  const sanitizers = new Map();
  const handlers = new Map();

  // Default HTML sanitizer
  sanitizers.set('text/html', (html) => {
    // Simple sanitization - remove scripts and event handlers
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/\s*on\w+="[^"]*"/gi, '')
      .replace(/\s*on\w+='[^']*'/gi, '');
  });

  return {
    handle: async (event, options = {}) => {
      const dataTransfer = event.clipboardData;
      if (!dataTransfer) return null;

      const result = {
        type: null,
        content: null,
        raw: null,
        sanitized: false,
      };

      // Priority order: files, html, plain text
      if (dataTransfer.files?.length > 0) {
        result.type = 'files';
        result.content = Array.from(dataTransfer.files);
        return result;
      }

      const html = dataTransfer.getData('text/html');
      if (html && options.allowHtml !== false) {
        result.type = 'html';
        result.raw = html;
        result.content = sanitizers.get('text/html')?.(html) || html;
        result.sanitized = result.raw !== result.content;
        return result;
      }

      const text = dataTransfer.getData('text/plain');
      if (text) {
        result.type = 'text';
        result.content = text;
        return result;
      }

      return null;
    },

    registerSanitizer: (type, fn) => {
      sanitizers.set(type, fn);
    },

    registerHandler: (type, fn) => {
      handlers.set(type, fn);
    },

    getSanitizer: (type) => sanitizers.get(type),

    hasSanitizer: (type) => sanitizers.has(type),
  };
};

/**
 * Creates a copy formatter for exporting data
 */
const createCopyFormatter = () => {
  const formatters = new Map();

  // Default formatters
  formatters.set('table', (data) => {
    if (!Array.isArray(data) || data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const rows = data.map((row) => headers.map((h) => row[h] ?? '').join('\t'));

    return [headers.join('\t'), ...rows].join('\n');
  });

  formatters.set('json', (data) => JSON.stringify(data, null, 2));

  formatters.set('csv', (data) => {
    if (!Array.isArray(data) || data.length === 0) return '';

    const escapeCell = (cell) => {
      const str = String(cell ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headers = Object.keys(data[0]);
    const rows = data.map((row) => headers.map((h) => escapeCell(row[h])).join(','));

    return [headers.join(','), ...rows].join('\n');
  });

  formatters.set('markdown', (data) => {
    if (!Array.isArray(data) || data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const headerRow = `| ${headers.join(' | ')} |`;
    const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;
    const dataRows = data.map((row) => `| ${headers.map((h) => row[h] ?? '').join(' | ')} |`);

    return [headerRow, separatorRow, ...dataRows].join('\n');
  });

  return {
    format: (data, type = 'table') => {
      const formatter = formatters.get(type);
      if (!formatter) throw new Error(`Unknown format: ${type}`);
      return formatter(data);
    },

    formatMultiple: (data, types) => {
      const result = {};
      for (const type of types) {
        try {
          result[type] = formatters.get(type)?.(data) || null;
        } catch {
          result[type] = null;
        }
      }
      return result;
    },

    register: (type, fn) => {
      formatters.set(type, fn);
    },

    getFormats: () => Array.from(formatters.keys()),
  };
};

// ============================================
// TESTS
// ============================================

describe('Clipboard Operations Tests', () => {
  let clipboardManager;
  let dataTransferHandler;
  let pasteHandler;
  let copyFormatter;

  beforeEach(() => {
    clipboardManager = createClipboardManager();
    dataTransferHandler = createDataTransferHandler();
    pasteHandler = createPasteHandler();
    copyFormatter = createCopyFormatter();
  });

  describe('Clipboard Manager', () => {
    it('should write and read text', async () => {
      await clipboardManager.write({ 'text/plain': 'Hello World' });

      const text = await clipboardManager.readText();
      expect(text).toBe('Hello World');
    });

    it('should write multiple data types', async () => {
      await clipboardManager.write({
        'text/plain': 'Plain text',
        'text/html': '<p>HTML content</p>',
      });

      const data = await clipboardManager.read();
      expect(data['text/plain']).toBe('Plain text');
      expect(data['text/html']).toBe('<p>HTML content</p>');
    });

    it('should read specific types only', async () => {
      await clipboardManager.write({
        'text/plain': 'text',
        'text/html': 'html',
        'application/json': '{"a":1}',
      });

      const data = await clipboardManager.read(['text/plain']);
      expect(Object.keys(data)).toEqual(['text/plain']);
    });

    it('should maintain clipboard history', async () => {
      await clipboardManager.write({ 'text/plain': 'First' });
      await clipboardManager.write({ 'text/plain': 'Second' });
      await clipboardManager.write({ 'text/plain': 'Third' });

      const history = clipboardManager.getHistory();
      expect(history).toHaveLength(3);
      expect(history[0].items['text/plain']).toBe('Third');
    });

    it('should emit events on operations', async () => {
      const writeCallback = vi.fn();
      const readCallback = vi.fn();

      clipboardManager.on('write', writeCallback);
      clipboardManager.on('read', readCallback);

      await clipboardManager.write({ 'text/plain': 'test' });
      await clipboardManager.read();

      expect(writeCallback).toHaveBeenCalled();
      expect(readCallback).toHaveBeenCalled();
    });

    it('should check if type exists', async () => {
      await clipboardManager.write({ 'text/plain': 'text' });

      expect(clipboardManager.hasType('text/plain')).toBe(true);
      expect(clipboardManager.hasType('text/html')).toBe(false);
    });

    it('should clear clipboard', async () => {
      await clipboardManager.write({ 'text/plain': 'text' });
      clipboardManager.clear();

      expect(clipboardManager.hasType('text/plain')).toBe(false);
    });
  });

  describe('Data Transfer Handler', () => {
    it('should create data transfer object', () => {
      const dt = dataTransferHandler.createTransfer({
        'text/plain': 'Hello',
        'text/html': '<b>Hello</b>',
      });

      expect(dt.getData('text/plain')).toBe('Hello');
      expect(dt.types).toContain('text/plain');
    });

    it('should parse data transfer contents', () => {
      const dt = dataTransferHandler.createTransfer({
        'text/plain': 'Plain text',
        'text/html': '<p>HTML</p>',
        'application/json': '{"key":"value"}',
        'text/uri-list': 'http://example.com\nhttp://test.com',
      });

      const parsed = dataTransferHandler.parseTransfer(dt);

      expect(parsed.text).toBe('Plain text');
      expect(parsed.html).toBe('<p>HTML</p>');
      expect(parsed.json).toEqual({ key: 'value' });
      expect(parsed.uris).toEqual(['http://example.com', 'http://test.com']);
    });

    it('should check supported types', () => {
      expect(dataTransferHandler.isSupported('text/plain')).toBe(true);
      expect(dataTransferHandler.isSupported('text/html')).toBe(true);
      expect(dataTransferHandler.isSupported('application/unknown')).toBe(false);
    });

    it('should allow setting data on transfer', () => {
      const dt = dataTransferHandler.createTransfer({});
      dt.setData('text/plain', 'New text');

      expect(dt.getData('text/plain')).toBe('New text');
    });

    it('should clear data from transfer', () => {
      const dt = dataTransferHandler.createTransfer({
        'text/plain': 'text',
        'text/html': 'html',
      });

      dt.clearData('text/plain');
      expect(dt.getData('text/plain')).toBe('');

      dt.clearData();
      expect(dt.types).toHaveLength(0);
    });
  });

  describe('Paste Handler', () => {
    it('should handle plain text paste', async () => {
      const event = {
        clipboardData: dataTransferHandler.createTransfer({
          'text/plain': 'Pasted text',
        }),
      };

      const result = await pasteHandler.handle(event);

      expect(result.type).toBe('text');
      expect(result.content).toBe('Pasted text');
    });

    it('should sanitize HTML paste', async () => {
      const event = {
        clipboardData: dataTransferHandler.createTransfer({
          'text/html': '<p onclick="alert()">Text</p><script>evil()</script>',
        }),
      };

      const result = await pasteHandler.handle(event);

      expect(result.type).toBe('html');
      expect(result.content).not.toContain('script');
      expect(result.content).not.toContain('onclick');
      expect(result.sanitized).toBe(true);
    });

    it('should prefer HTML over text when available', async () => {
      const event = {
        clipboardData: dataTransferHandler.createTransfer({
          'text/plain': 'Plain',
          'text/html': '<b>Bold</b>',
        }),
      };

      const result = await pasteHandler.handle(event);

      expect(result.type).toBe('html');
    });

    it('should fall back to text when HTML disabled', async () => {
      const event = {
        clipboardData: dataTransferHandler.createTransfer({
          'text/plain': 'Plain',
          'text/html': '<b>Bold</b>',
        }),
      };

      const result = await pasteHandler.handle(event, { allowHtml: false });

      expect(result.type).toBe('text');
    });

    it('should register custom sanitizer', async () => {
      pasteHandler.registerSanitizer('text/plain', (text) => text.toUpperCase());

      expect(pasteHandler.hasSanitizer('text/plain')).toBe(true);
    });
  });

  describe('Copy Formatter', () => {
    const sampleData = [
      { name: 'Alice', age: 30, city: 'NYC' },
      { name: 'Bob', age: 25, city: 'LA' },
    ];

    it('should format as tab-separated table', () => {
      const result = copyFormatter.format(sampleData, 'table');

      expect(result).toContain('name\tage\tcity');
      expect(result).toContain('Alice\t30\tNYC');
    });

    it('should format as JSON', () => {
      const result = copyFormatter.format(sampleData, 'json');
      const parsed = JSON.parse(result);

      expect(parsed).toEqual(sampleData);
    });

    it('should format as CSV with proper escaping', () => {
      const dataWithCommas = [{ name: 'Alice, Jr.', note: 'Has "quotes"' }];

      const result = copyFormatter.format(dataWithCommas, 'csv');

      expect(result).toContain('"Alice, Jr."');
      expect(result).toContain('"Has ""quotes"""');
    });

    it('should format as Markdown table', () => {
      const result = copyFormatter.format(sampleData, 'markdown');

      expect(result).toContain('| name | age | city |');
      expect(result).toContain('| --- | --- | --- |');
      expect(result).toContain('| Alice | 30 | NYC |');
    });

    it('should format to multiple types at once', () => {
      const results = copyFormatter.formatMultiple(sampleData, ['table', 'json', 'csv']);

      expect(results.table).toBeDefined();
      expect(results.json).toBeDefined();
      expect(results.csv).toBeDefined();
    });

    it('should register custom formatter', () => {
      copyFormatter.register('custom', (data) => data.map((d) => d.name).join(', '));

      const result = copyFormatter.format(sampleData, 'custom');
      expect(result).toBe('Alice, Bob');
    });

    it('should list available formats', () => {
      const formats = copyFormatter.getFormats();

      expect(formats).toContain('table');
      expect(formats).toContain('json');
      expect(formats).toContain('csv');
      expect(formats).toContain('markdown');
    });
  });
});
