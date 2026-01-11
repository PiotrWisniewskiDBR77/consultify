/**
 * Clipboard Utilities Tests
 * Tests for clipboard read/write operations
 *
 * @module tests/clipboard/clipboard-utils.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Clipboard manager
const createClipboardManager = () => {
  let clipboardData = { text: '', html: '', image: null };
  const listeners = [];

  return {
    writeText: async (text) => {
      clipboardData.text = text;
      listeners.forEach((fn) => fn({ type: 'write', data: text }));
      return true;
    },

    readText: async () => {
      return clipboardData.text;
    },

    writeHTML: async (html) => {
      clipboardData.html = html;
      return true;
    },

    readHTML: async () => {
      return clipboardData.html;
    },

    writeImage: async (imageData) => {
      clipboardData.image = imageData;
      return true;
    },

    readImage: async () => {
      return clipboardData.image;
    },

    clear: async () => {
      clipboardData = { text: '', html: '', image: null };
    },

    onChange: (callback) => {
      listeners.push(callback);
      return () => {
        const idx = listeners.indexOf(callback);
        if (idx !== -1) listeners.splice(idx, 1);
      };
    },

    hasText: () => clipboardData.text.length > 0,

    hasHTML: () => clipboardData.html.length > 0,

    hasImage: () => clipboardData.image !== null,
  };
};

// Copy to clipboard helper
const createCopyHelper = (clipboard) => {
  const history = [];
  const maxHistory = 10;

  const copy = async (text, options = {}) => {
    await clipboard.writeText(text);

    history.unshift({
      text: text.slice(0, 100), // Store first 100 chars
      timestamp: Date.now(),
      type: options.type || 'text',
    });

    if (history.length > maxHistory) {
      history.pop();
    }

    return true;
  };

  const copyRich = async (html, fallbackText) => {
    await clipboard.writeHTML(html);
    await clipboard.writeText(fallbackText);
    return true;
  };

  const copyJSON = async (data) => {
    const text = JSON.stringify(data, null, 2);
    return copy(text, { type: 'json' });
  };

  return {
    copy,
    copyRich,
    copyJSON,
    getHistory: () => [...history],
    clearHistory: () => {
      history.length = 0;
    },
    getLastCopied: () => history[0] || null,
  };
};

// Paste handler
const createPasteHandler = (clipboard) => {
  const handlers = new Map();

  return {
    registerHandler: (type, handler) => {
      handlers.set(type, handler);
    },

    handlePaste: async (e) => {
      const text = await clipboard.readText();
      const html = await clipboard.readHTML();
      const image = await clipboard.readImage();

      // Determine type
      if (image && handlers.has('image')) {
        return handlers.get('image')(image);
      }

      if (html && handlers.has('html')) {
        return handlers.get('html')(html);
      }

      // Try to detect JSON
      if (text) {
        try {
          const json = JSON.parse(text);
          if (handlers.has('json')) {
            return handlers.get('json')(json);
          }
        } catch {
          // Not JSON
        }

        if (handlers.has('text')) {
          return handlers.get('text')(text);
        }
      }

      return null;
    },

    hasHandler: (type) => handlers.has(type),

    removeHandler: (type) => handlers.delete(type),
  };
};

// Clipboard watcher
const createClipboardWatcher = (clipboard, interval = 1000) => {
  let lastText = '';
  let watcherId = null;
  const listeners = [];

  const check = async () => {
    const text = await clipboard.readText();

    if (text !== lastText) {
      lastText = text;
      listeners.forEach((fn) => fn(text));
    }
  };

  return {
    start: () => {
      if (watcherId) return;
      watcherId = setInterval(check, interval);
    },

    stop: () => {
      if (watcherId) {
        clearInterval(watcherId);
        watcherId = null;
      }
    },

    isWatching: () => watcherId !== null,

    onChange: (callback) => {
      listeners.push(callback);
      return () => {
        const idx = listeners.indexOf(callback);
        if (idx !== -1) listeners.splice(idx, 1);
      };
    },

    getListenerCount: () => listeners.length,
  };
};

// Secure clipboard (auto-clear sensitive data)
const createSecureClipboard = (clipboard, options = {}) => {
  const { autoClearTimeout = 30000 } = options;

  let clearTimerId = null;

  return {
    copySecure: async (text) => {
      await clipboard.writeText(text);

      // Clear any existing timer
      if (clearTimerId) {
        globalThis.clearTimeout(clearTimerId);
      }

      // Set timer to clear
      clearTimerId = globalThis.setTimeout(async () => {
        await clipboard.clear();
        clearTimerId = null;
      }, autoClearTimeout);

      return true;
    },

    cancelAutoClear: () => {
      if (clearTimerId) {
        globalThis.clearTimeout(clearTimerId);
        clearTimerId = null;
      }
    },

    isAutoClearPending: () => clearTimerId !== null,

    clearNow: async () => {
      if (clearTimerId) {
        globalThis.clearTimeout(clearTimerId);
        clearTimerId = null;
      }
      await clipboard.clear();
    },
  };
};

describe('Clipboard Manager Tests', () => {
  let clipboard;

  beforeEach(() => {
    clipboard = createClipboardManager();
  });

  it('should write and read text', async () => {
    await clipboard.writeText('Hello');

    const text = await clipboard.readText();
    expect(text).toBe('Hello');
  });

  it('should write and read HTML', async () => {
    await clipboard.writeHTML('<b>Bold</b>');

    expect(await clipboard.readHTML()).toBe('<b>Bold</b>');
  });

  it('should clear clipboard', async () => {
    await clipboard.writeText('data');
    await clipboard.clear();

    expect(clipboard.hasText()).toBe(false);
  });

  it('should notify on change', async () => {
    const callback = vi.fn();
    clipboard.onChange(callback);

    await clipboard.writeText('test');

    expect(callback).toHaveBeenCalled();
  });
});

describe('Copy Helper Tests', () => {
  let clipboard;
  let copyHelper;

  beforeEach(() => {
    clipboard = createClipboardManager();
    copyHelper = createCopyHelper(clipboard);
  });

  it('should copy text', async () => {
    await copyHelper.copy('Hello');

    expect(await clipboard.readText()).toBe('Hello');
  });

  it('should track history', async () => {
    await copyHelper.copy('First');
    await copyHelper.copy('Second');

    const history = copyHelper.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0].text).toBe('Second');
  });

  it('should copy JSON', async () => {
    await copyHelper.copyJSON({ foo: 'bar' });

    const text = await clipboard.readText();
    expect(JSON.parse(text)).toEqual({ foo: 'bar' });
  });

  it('should get last copied', async () => {
    await copyHelper.copy('Test');

    expect(copyHelper.getLastCopied().text).toBe('Test');
  });
});

describe('Paste Handler Tests', () => {
  let clipboard;
  let pasteHandler;

  beforeEach(() => {
    clipboard = createClipboardManager();
    pasteHandler = createPasteHandler(clipboard);
  });

  it('should handle text paste', async () => {
    const handler = vi.fn();
    pasteHandler.registerHandler('text', handler);

    await clipboard.writeText('pasted');
    await pasteHandler.handlePaste();

    expect(handler).toHaveBeenCalledWith('pasted');
  });

  it('should detect JSON paste', async () => {
    const handler = vi.fn();
    pasteHandler.registerHandler('json', handler);

    await clipboard.writeText('{"key": "value"}');
    await pasteHandler.handlePaste();

    expect(handler).toHaveBeenCalledWith({ key: 'value' });
  });

  it('should check if handler exists', () => {
    pasteHandler.registerHandler('text', vi.fn());

    expect(pasteHandler.hasHandler('text')).toBe(true);
    expect(pasteHandler.hasHandler('image')).toBe(false);
  });
});

describe('Clipboard Watcher Tests', () => {
  let clipboard;
  let watcher;

  beforeEach(() => {
    vi.useFakeTimers();
    clipboard = createClipboardManager();
    watcher = createClipboardWatcher(clipboard, 100);
  });

  afterEach(() => {
    watcher.stop();
    vi.useRealTimers();
  });

  it('should start and stop watching', () => {
    watcher.start();
    expect(watcher.isWatching()).toBe(true);

    watcher.stop();
    expect(watcher.isWatching()).toBe(false);
  });

  it('should detect changes', async () => {
    const callback = vi.fn();
    watcher.onChange(callback);
    watcher.start();

    await clipboard.writeText('new content');
    vi.advanceTimersByTime(100);

    expect(callback).toHaveBeenCalledWith('new content');
  });
});

describe('Secure Clipboard Tests', () => {
  let clipboard;
  let secureClipboard;

  beforeEach(() => {
    vi.useFakeTimers();
    clipboard = createClipboardManager();
    secureClipboard = createSecureClipboard(clipboard, { clearTimeout: 1000 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should copy secure data', async () => {
    await secureClipboard.copySecure('password');

    expect(await clipboard.readText()).toBe('password');
  });

  it('should auto-clear after timeout', async () => {
    await secureClipboard.copySecure('secret');

    vi.advanceTimersByTime(1000);

    expect(clipboard.hasText()).toBe(false);
  });

  it('should cancel auto-clear', async () => {
    await secureClipboard.copySecure('data');
    secureClipboard.cancelAutoClear();

    vi.advanceTimersByTime(1000);

    expect(await clipboard.readText()).toBe('data');
  });
});
