/**
 * Structured Logging Tests
 * Tests for logging patterns and formatters
 *
 * @module tests/logging/structured-logging.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Log levels
const LOG_LEVELS = {
  TRACE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
  FATAL: 5,
};

// Structured logger
const createLogger = (options = {}) => {
  const { level = LOG_LEVELS.INFO, transport = console } = options;

  let context = {};
  const children = [];

  const formatMessage = (lvl, message, data) => {
    return {
      timestamp: new Date().toISOString(),
      level: Object.keys(LOG_LEVELS).find((k) => LOG_LEVELS[k] === lvl),
      message,
      ...context,
      ...data,
    };
  };

  const log = (lvl, message, data = {}) => {
    if (lvl < level) return;

    const entry = formatMessage(lvl, message, data);

    switch (lvl) {
      case LOG_LEVELS.ERROR:
      case LOG_LEVELS.FATAL:
        transport.error?.(entry) || transport.log?.(entry);
        break;
      case LOG_LEVELS.WARN:
        transport.warn?.(entry) || transport.log?.(entry);
        break;
      default:
        transport.log?.(entry);
    }

    return entry;
  };

  return {
    trace: (msg, data) => log(LOG_LEVELS.TRACE, msg, data),
    debug: (msg, data) => log(LOG_LEVELS.DEBUG, msg, data),
    info: (msg, data) => log(LOG_LEVELS.INFO, msg, data),
    warn: (msg, data) => log(LOG_LEVELS.WARN, msg, data),
    error: (msg, data) => log(LOG_LEVELS.ERROR, msg, data),
    fatal: (msg, data) => log(LOG_LEVELS.FATAL, msg, data),

    setContext: (ctx) => {
      context = { ...context, ...ctx };
    },

    child: (ctx) => {
      const childLogger = createLogger({ level, transport });
      childLogger.setContext({ ...context, ...ctx });
      children.push(childLogger);
      return childLogger;
    },

    getContext: () => ({ ...context }),

    getLevel: () => level,
  };
};

// Log formatter
const createLogFormatter = (format = 'json') => {
  return {
    format: (entry) => {
      switch (format) {
        case 'json':
          return JSON.stringify(entry);

        case 'text':
          const { timestamp, level, message, ...rest } = entry;
          const extra = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : '';
          return `[${timestamp}] ${level}: ${message}${extra}`;

        case 'compact':
          return `${entry.level[0]} ${entry.message}`;

        default:
          return JSON.stringify(entry);
      }
    },

    parse: (line) => {
      try {
        return JSON.parse(line);
      } catch {
        // Parse text format
        const match = line.match(/\[(.+)\] (\w+): (.+)/);
        if (match) {
          return {
            timestamp: match[1],
            level: match[2],
            message: match[3],
          };
        }
        return null;
      }
    },
  };
};

// Log aggregator
const createLogAggregator = () => {
  const logs = [];
  const subscribers = [];

  return {
    add: (entry) => {
      logs.push(entry);

      for (const subscriber of subscribers) {
        subscriber(entry);
      }
    },

    query: (filter = {}) => {
      let result = [...logs];

      if (filter.level) {
        result = result.filter((l) => l.level === filter.level);
      }

      if (filter.from) {
        result = result.filter((l) => new Date(l.timestamp) >= filter.from);
      }

      if (filter.to) {
        result = result.filter((l) => new Date(l.timestamp) <= filter.to);
      }

      if (filter.search) {
        result = result.filter((l) =>
          l.message.toLowerCase().includes(filter.search.toLowerCase())
        );
      }

      if (filter.limit) {
        result = result.slice(-filter.limit);
      }

      return result;
    },

    subscribe: (callback) => {
      subscribers.push(callback);
      return () => {
        const idx = subscribers.indexOf(callback);
        if (idx !== -1) subscribers.splice(idx, 1);
      };
    },

    getCount: () => logs.length,

    clear: () => {
      logs.length = 0;
    },

    getLevelCounts: () => {
      const counts = {};
      for (const log of logs) {
        counts[log.level] = (counts[log.level] || 0) + 1;
      }
      return counts;
    },
  };
};

// Log rotation manager
const createLogRotation = (options = {}) => {
  const { maxSize = 10 * 1024 * 1024, maxFiles = 5 } = options;

  let currentSize = 0;
  const files = [];

  return {
    write: (data) => {
      const size = typeof data === 'string' ? data.length : JSON.stringify(data).length;

      if (currentSize + size > maxSize) {
        this.rotate();
      }

      currentSize += size;
      return true;
    },

    rotate: () => {
      files.push({
        rotatedAt: new Date().toISOString(),
        size: currentSize,
      });

      if (files.length > maxFiles) {
        files.shift(); // Remove oldest
      }

      currentSize = 0;
      return files.length;
    },

    getCurrentSize: () => currentSize,

    getRotatedFiles: () => [...files],

    needsRotation: () => currentSize >= maxSize,
  };
};

describe('Logger Tests', () => {
  let transport;
  let logger;

  beforeEach(() => {
    transport = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
    logger = createLogger({ level: LOG_LEVELS.DEBUG, transport });
  });

  it('should log message', () => {
    logger.info('Hello');

    expect(transport.log).toHaveBeenCalled();
    const entry = transport.log.mock.calls[0][0];
    expect(entry.message).toBe('Hello');
    expect(entry.level).toBe('INFO');
  });

  it('should include data', () => {
    logger.info('Request', { userId: 123 });

    const entry = transport.log.mock.calls[0][0];
    expect(entry.userId).toBe(123);
  });

  it('should respect log level', () => {
    logger = createLogger({ level: LOG_LEVELS.WARN, transport });

    logger.info('Ignored');
    logger.warn('Not ignored');

    expect(transport.log).not.toHaveBeenCalled();
    expect(transport.warn).toHaveBeenCalled();
  });

  it('should set context', () => {
    logger.setContext({ service: 'api' });
    logger.info('Message');

    const entry = transport.log.mock.calls[0][0];
    expect(entry.service).toBe('api');
  });

  it('should create child logger', () => {
    const child = logger.child({ requestId: 'abc' });
    child.info('Child message');

    const entry = transport.log.mock.calls[0][0];
    expect(entry.requestId).toBe('abc');
  });
});

describe('Log Formatter Tests', () => {
  it('should format as JSON', () => {
    const formatter = createLogFormatter('json');
    const entry = { timestamp: '2024-01-01', level: 'INFO', message: 'Test' };

    const formatted = formatter.format(entry);

    expect(JSON.parse(formatted)).toEqual(entry);
  });

  it('should format as text', () => {
    const formatter = createLogFormatter('text');
    const entry = { timestamp: '2024-01-01', level: 'INFO', message: 'Test' };

    const formatted = formatter.format(entry);

    expect(formatted).toContain('[2024-01-01]');
    expect(formatted).toContain('INFO');
  });

  it('should parse JSON', () => {
    const formatter = createLogFormatter();
    const line = '{"level":"INFO","message":"Test"}';

    const parsed = formatter.parse(line);

    expect(parsed.level).toBe('INFO');
  });
});

describe('Log Aggregator Tests', () => {
  let aggregator;

  beforeEach(() => {
    aggregator = createLogAggregator();
  });

  it('should add and query logs', () => {
    aggregator.add({ level: 'INFO', message: 'Test 1' });
    aggregator.add({ level: 'ERROR', message: 'Test 2' });

    const all = aggregator.query();
    expect(all).toHaveLength(2);
  });

  it('should filter by level', () => {
    aggregator.add({ level: 'INFO', message: 'Info' });
    aggregator.add({ level: 'ERROR', message: 'Error' });

    const errors = aggregator.query({ level: 'ERROR' });
    expect(errors).toHaveLength(1);
  });

  it('should search messages', () => {
    aggregator.add({ level: 'INFO', message: 'User logged in' });
    aggregator.add({ level: 'INFO', message: 'User logged out' });

    const results = aggregator.query({ search: 'logged in' });
    expect(results).toHaveLength(1);
  });

  it('should subscribe to new logs', () => {
    const callback = vi.fn();
    aggregator.subscribe(callback);

    aggregator.add({ level: 'INFO', message: 'New log' });

    expect(callback).toHaveBeenCalled();
  });

  it('should count by level', () => {
    aggregator.add({ level: 'INFO' });
    aggregator.add({ level: 'ERROR' });
    aggregator.add({ level: 'ERROR' });

    const counts = aggregator.getLevelCounts();
    expect(counts.INFO).toBe(1);
    expect(counts.ERROR).toBe(2);
  });
});

describe('Log Rotation Tests', () => {
  let rotation;

  beforeEach(() => {
    rotation = createLogRotation({ maxSize: 100, maxFiles: 3 });
  });

  it('should track size', () => {
    rotation.write('Hello');

    expect(rotation.getCurrentSize()).toBe(5);
  });

  it('should rotate when full', () => {
    rotation.write('x'.repeat(101));

    const files = rotation.getRotatedFiles();
    expect(files).toHaveLength(1);
  });

  it('should limit rotated files', () => {
    for (let i = 0; i < 5; i++) {
      rotation.rotate();
    }

    expect(rotation.getRotatedFiles()).toHaveLength(3);
  });

  it('should check if needs rotation', () => {
    rotation.write('x'.repeat(100));

    expect(rotation.needsRotation()).toBe(true);
  });
});
