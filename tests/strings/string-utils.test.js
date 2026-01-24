/**
 * String Utilities Tests
 * Tests for string manipulation and parsing
 *
 * @module tests/strings/string-utils.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// String utilities
const createStringUtils = () => {
  return {
    capitalize: (str) => str.charAt(0).toUpperCase() + str.slice(1),

    capitalizeWords: (str) => str.replace(/\b\w/g, (char) => char.toUpperCase()),

    camelCase: (str) => str.replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : '')),

    snakeCase: (str) =>
      str
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, '')
        .replace(/[-\s]+/g, '_'),

    kebabCase: (str) =>
      str
        .replace(/([A-Z])/g, '-$1')
        .toLowerCase()
        .replace(/^-/, '')
        .replace(/[_\s]+/g, '-'),

    pascalCase: (str) => {
      const camel = str.replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''));
      return camel.charAt(0).toUpperCase() + camel.slice(1);
    },

    truncate: (str, length, suffix = '...') => {
      if (str.length <= length) return str;
      return str.slice(0, length - suffix.length) + suffix;
    },

    truncateWords: (str, count, suffix = '...') => {
      const words = str.split(/\s+/);
      if (words.length <= count) return str;
      return words.slice(0, count).join(' ') + suffix;
    },

    slugify: (str) =>
      str
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/^-+|-+$/g, ''),

    pad: (str, length, char = ' ', direction = 'right') => {
      if (str.length >= length) return str;
      const padding = char.repeat(length - str.length);
      return direction === 'left' ? padding + str : str + padding;
    },

    reverse: (str) => str.split('').reverse().join(''),

    isBlank: (str) => !str || /^\s*$/.test(str),

    isEmpty: (str) => str === '' || str === null || str === undefined,

    countOccurrences: (str, substr) => {
      let count = 0;
      let pos = 0;
      while ((pos = str.indexOf(substr, pos)) !== -1) {
        count++;
        pos += substr.length;
      }
      return count;
    },

    removeAccents: (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, ''),

    stripHtml: (str) => str.replace(/<[^>]*>/g, ''),

    escapeHtml: (str) =>
      str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;'),

    unescapeHtml: (str) =>
      str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'"),
  };
};

// Template engine
const createTemplateEngine = () => {
  return {
    render: (template, data) => {
      return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
        return data[key] ?? '';
      });
    },

    renderNested: (template, data) => {
      return template.replace(/\{\{([\w.]+)\}\}/g, (_, path) => {
        return path.split('.').reduce((obj, key) => obj?.[key], data) ?? '';
      });
    },

    compile: (template) => {
      return (data) => template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? '');
    },
  };
};

// Text analyzer
const createTextAnalyzer = () => {
  return {
    wordCount: (text) =>
      text
        .trim()
        .split(/\s+/)
        .filter((w) => w.length > 0).length,

    charCount: (text, includeSpaces = true) =>
      includeSpaces ? text.length : text.replace(/\s/g, '').length,

    lineCount: (text) => text.split(/\r\n|\r|\n/).length,

    sentenceCount: (text) => (text.match(/[.!?]+/g) || []).length,

    paragraphCount: (text) => text.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length,

    readingTime: (text, wordsPerMinute = 200) => {
      const words = text.split(/\s+/).filter((w) => w.length > 0).length;
      return Math.ceil(words / wordsPerMinute);
    },

    getWordFrequency: (text) => {
      const words = text.toLowerCase().match(/\b\w+\b/g) || [];
      const freq = new Map();
      for (const word of words) {
        freq.set(word, (freq.get(word) || 0) + 1);
      }
      return freq;
    },

    getTopWords: (text, limit = 10) => {
      const freq = this.getWordFrequency(text);
      return [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([word, count]) => ({ word, count }));
    },
  };
};

// URL parser
const createUrlParser = () => {
  return {
    parse: (urlString) => {
      try {
        const url = new URL(urlString);
        return {
          protocol: url.protocol.replace(':', ''),
          host: url.host,
          hostname: url.hostname,
          port: url.port,
          pathname: url.pathname,
          search: url.search,
          hash: url.hash,
          params: Object.fromEntries(url.searchParams),
        };
      } catch {
        return null;
      }
    },

    build: (parts) => {
      const base = `${parts.protocol || 'https'}://${parts.host || parts.hostname || ''}`;
      const url = new URL(parts.pathname || '/', base);

      if (parts.port) url.port = parts.port;
      if (parts.params) {
        for (const [key, value] of Object.entries(parts.params)) {
          url.searchParams.set(key, value);
        }
      }
      if (parts.hash) url.hash = parts.hash;

      return url.toString();
    },

    addParams: (urlString, params) => {
      const url = new URL(urlString);
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
      return url.toString();
    },

    removeParams: (urlString, keys) => {
      const url = new URL(urlString);
      for (const key of keys) {
        url.searchParams.delete(key);
      }
      return url.toString();
    },
  };
};

describe('String Utils Tests', () => {
  let utils;

  beforeEach(() => {
    utils = createStringUtils();
  });

  it('should capitalize', () => {
    expect(utils.capitalize('hello')).toBe('Hello');
    expect(utils.capitalizeWords('hello world')).toBe('Hello World');
  });

  it('should convert cases', () => {
    expect(utils.camelCase('hello-world')).toBe('helloWorld');
    expect(utils.snakeCase('helloWorld')).toBe('hello_world');
    expect(utils.kebabCase('helloWorld')).toBe('hello-world');
    expect(utils.pascalCase('hello-world')).toBe('HelloWorld');
  });

  it('should truncate', () => {
    expect(utils.truncate('Hello World', 8)).toBe('Hello...');
    expect(utils.truncateWords('The quick brown fox', 2)).toBe('The quick...');
  });

  it('should slugify', () => {
    expect(utils.slugify('Hello World!')).toBe('hello-world');
    expect(utils.slugify('Product Name (v2.0)')).toBe('product-name-v20');
  });

  it('should check blank/empty', () => {
    expect(utils.isBlank('   ')).toBe(true);
    expect(utils.isBlank('text')).toBe(false);
    expect(utils.isEmpty('')).toBe(true);
  });

  it('should count occurrences', () => {
    expect(utils.countOccurrences('abcabc', 'abc')).toBe(2);
  });

  it('should escape/unescape HTML', () => {
    expect(utils.escapeHtml('<div>')).toBe('&lt;div&gt;');
    expect(utils.unescapeHtml('&lt;div&gt;')).toBe('<div>');
    expect(utils.stripHtml('<p>Hello</p>')).toBe('Hello');
  });
});

describe('Template Engine Tests', () => {
  let engine;

  beforeEach(() => {
    engine = createTemplateEngine();
  });

  it('should render template', () => {
    const result = engine.render('Hello {{name}}!', { name: 'Alice' });

    expect(result).toBe('Hello Alice!');
  });

  it('should render nested', () => {
    const result = engine.renderNested('{{user.name}}', { user: { name: 'Bob' } });

    expect(result).toBe('Bob');
  });

  it('should compile template', () => {
    const compiled = engine.compile('Hi {{name}}');

    expect(compiled({ name: 'A' })).toBe('Hi A');
    expect(compiled({ name: 'B' })).toBe('Hi B');
  });
});

describe('Text Analyzer Tests', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = createTextAnalyzer();
  });

  it('should count words', () => {
    expect(analyzer.wordCount('Hello world test')).toBe(3);
  });

  it('should count chars', () => {
    expect(analyzer.charCount('Hello')).toBe(5);
    expect(analyzer.charCount('Hello World', false)).toBe(10);
  });

  it('should count sentences', () => {
    expect(analyzer.sentenceCount('Hello. World! Test?')).toBe(3);
  });

  it('should calculate reading time', () => {
    const text = 'word '.repeat(400);
    expect(analyzer.readingTime(text, 200)).toBe(2);
  });

  it('should get word frequency', () => {
    const freq = analyzer.getWordFrequency('the cat and the dog');

    expect(freq.get('the')).toBe(2);
    expect(freq.get('cat')).toBe(1);
  });
});

describe('URL Parser Tests', () => {
  let parser;

  beforeEach(() => {
    parser = createUrlParser();
  });

  it('should parse URL', () => {
    const result = parser.parse('https://example.com:8080/path?foo=bar#section');

    expect(result.protocol).toBe('https');
    expect(result.host).toBe('example.com:8080');
    expect(result.pathname).toBe('/path');
    expect(result.params.foo).toBe('bar');
  });

  it('should build URL', () => {
    const url = parser.build({
      protocol: 'https',
      hostname: 'example.com',
      pathname: '/api',
      params: { key: 'value' },
    });

    expect(url).toContain('https://example.com/api');
    expect(url).toContain('key=value');
  });

  it('should add/remove params', () => {
    const url = 'https://example.com/page?a=1';

    expect(parser.addParams(url, { b: '2' })).toContain('b=2');
    expect(parser.removeParams(url, ['a'])).not.toContain('a=1');
  });
});
