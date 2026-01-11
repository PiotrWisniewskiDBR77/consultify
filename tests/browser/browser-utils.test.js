/**
 * Browser API Tests
 * Tests for browser storage and history utilities
 *
 * @module tests/browser/browser-utils.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// LocalStorage wrapper
const createLocalStorageWrapper = (storage = {}) => {
  const data = { ...storage };

  return {
    getItem: (key) => {
      const value = data[key];
      if (value === undefined) return null;

      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    },

    setItem: (key, value) => {
      data[key] = JSON.stringify(value);
    },

    removeItem: (key) => {
      delete data[key];
    },

    clear: () => {
      for (const key of Object.keys(data)) {
        delete data[key];
      }
    },

    key: (index) => {
      return Object.keys(data)[index] || null;
    },

    get length() {
      return Object.keys(data).length;
    },

    getAll: () => {
      const result = {};
      for (const key of Object.keys(data)) {
        try {
          result[key] = JSON.parse(data[key]);
        } catch {
          result[key] = data[key];
        }
      }
      return result;
    },

    hasKey: (key) => key in data,
  };
};

// SessionStorage wrapper
const createSessionStorageWrapper = () => {
  return createLocalStorageWrapper();
};

// Cookie manager
const createCookieManager = () => {
  const cookies = {};

  const parseCookieOptions = (options) => {
    const parts = [];

    if (options.expires) {
      const date =
        options.expires instanceof Date
          ? options.expires
          : new Date(Date.now() + options.expires * 1000);
      parts.push(`expires=${date.toUTCString()}`);
    }

    if (options.maxAge) parts.push(`max-age=${options.maxAge}`);
    if (options.path) parts.push(`path=${options.path}`);
    if (options.domain) parts.push(`domain=${options.domain}`);
    if (options.secure) parts.push('secure');
    if (options.sameSite) parts.push(`samesite=${options.sameSite}`);
    if (options.httpOnly) parts.push('httponly');

    return parts.join('; ');
  };

  return {
    get: (name) => cookies[name],

    set: (name, value, options = {}) => {
      cookies[name] = {
        value,
        options,
        serialized: `${name}=${encodeURIComponent(value)}; ${parseCookieOptions(options)}`,
      };
    },

    remove: (name, options = {}) => {
      delete cookies[name];
    },

    getAll: () => {
      const result = {};
      for (const [name, cookie] of Object.entries(cookies)) {
        result[name] = cookie.value;
      }
      return result;
    },

    has: (name) => name in cookies,

    clear: () => {
      for (const key of Object.keys(cookies)) {
        delete cookies[key];
      }
    },
  };
};

// History manager
const createHistoryManager = () => {
  const history = [];
  let currentIndex = -1;
  const listeners = [];

  const notify = () => {
    const state = history[currentIndex];
    listeners.forEach((fn) => fn(state));
  };

  return {
    push: (state, title = '', url = '') => {
      // Remove forward history
      history.splice(currentIndex + 1);
      history.push({ state, title, url, timestamp: Date.now() });
      currentIndex++;
      notify();
    },

    replace: (state, title = '', url = '') => {
      if (currentIndex >= 0) {
        history[currentIndex] = { state, title, url, timestamp: Date.now() };
      } else {
        this.push(state, title, url);
      }
      notify();
    },

    back: () => {
      if (currentIndex > 0) {
        currentIndex--;
        notify();
        return true;
      }
      return false;
    },

    forward: () => {
      if (currentIndex < history.length - 1) {
        currentIndex++;
        notify();
        return true;
      }
      return false;
    },

    go: (delta) => {
      const newIndex = currentIndex + delta;
      if (newIndex >= 0 && newIndex < history.length) {
        currentIndex = newIndex;
        notify();
        return true;
      }
      return false;
    },

    getState: () => history[currentIndex]?.state,

    getLength: () => history.length,

    canGoBack: () => currentIndex > 0,

    canGoForward: () => currentIndex < history.length - 1,

    onPopState: (callback) => {
      listeners.push(callback);
      return () => {
        const idx = listeners.indexOf(callback);
        if (idx !== -1) listeners.splice(idx, 1);
      };
    },

    clear: () => {
      history.length = 0;
      currentIndex = -1;
    },
  };
};

// URL parser
const createURLParser = () => {
  return {
    parse: (urlString) => {
      const url = new URL(urlString, 'http://example.com');

      return {
        protocol: url.protocol.replace(':', ''),
        host: url.host,
        hostname: url.hostname,
        port: url.port,
        pathname: url.pathname,
        search: url.search,
        hash: url.hash,
        origin: url.origin,
      };
    },

    getQueryParams: (urlString) => {
      const url = new URL(urlString, 'http://example.com');
      const params = {};

      url.searchParams.forEach((value, key) => {
        if (params[key]) {
          if (!Array.isArray(params[key])) {
            params[key] = [params[key]];
          }
          params[key].push(value);
        } else {
          params[key] = value;
        }
      });

      return params;
    },

    buildQueryString: (params) => {
      const searchParams = new URLSearchParams();

      for (const [key, value] of Object.entries(params)) {
        if (Array.isArray(value)) {
          value.forEach((v) => searchParams.append(key, v));
        } else if (value !== undefined && value !== null) {
          searchParams.set(key, value);
        }
      }

      const str = searchParams.toString();
      return str ? `?${str}` : '';
    },

    join: (...parts) => {
      return parts
        .map((part, i) => {
          if (i === 0) return part.replace(/\/+$/, '');
          return part.replace(/^\/+|\/+$/g, '');
        })
        .filter(Boolean)
        .join('/');
    },
  };
};

describe('LocalStorage Wrapper Tests', () => {
  let storage;

  beforeEach(() => {
    storage = createLocalStorageWrapper();
  });

  it('should set and get item', () => {
    storage.setItem('key', { foo: 'bar' });

    expect(storage.getItem('key')).toEqual({ foo: 'bar' });
  });

  it('should return null for missing key', () => {
    expect(storage.getItem('missing')).toBeNull();
  });

  it('should remove item', () => {
    storage.setItem('key', 'value');
    storage.removeItem('key');

    expect(storage.getItem('key')).toBeNull();
  });

  it('should clear all', () => {
    storage.setItem('a', 1);
    storage.setItem('b', 2);
    storage.clear();

    expect(storage.length).toBe(0);
  });

  it('should check if has key', () => {
    storage.setItem('exists', true);

    expect(storage.hasKey('exists')).toBe(true);
    expect(storage.hasKey('missing')).toBe(false);
  });
});

describe('Cookie Manager Tests', () => {
  let cookies;

  beforeEach(() => {
    cookies = createCookieManager();
  });

  it('should set and get cookie', () => {
    cookies.set('name', 'value');

    expect(cookies.get('name').value).toBe('value');
  });

  it('should set cookie with options', () => {
    cookies.set('session', 'abc', { httpOnly: true, secure: true });

    const cookie = cookies.get('session');
    expect(cookie.serialized).toContain('secure');
  });

  it('should remove cookie', () => {
    cookies.set('temp', 'data');
    cookies.remove('temp');

    expect(cookies.has('temp')).toBe(false);
  });

  it('should get all cookies', () => {
    cookies.set('a', '1');
    cookies.set('b', '2');

    const all = cookies.getAll();
    expect(all.a).toBe('1');
    expect(all.b).toBe('2');
  });
});

describe('History Manager Tests', () => {
  let history;

  beforeEach(() => {
    history = createHistoryManager();
  });

  it('should push state', () => {
    history.push({ page: 1 });

    expect(history.getState()).toEqual({ page: 1 });
    expect(history.getLength()).toBe(1);
  });

  it('should go back', () => {
    history.push({ page: 1 });
    history.push({ page: 2 });
    history.back();

    expect(history.getState()).toEqual({ page: 1 });
  });

  it('should go forward', () => {
    history.push({ page: 1 });
    history.push({ page: 2 });
    history.back();
    history.forward();

    expect(history.getState()).toEqual({ page: 2 });
  });

  it('should check navigation availability', () => {
    history.push({ page: 1 });
    history.push({ page: 2 });

    expect(history.canGoBack()).toBe(true);
    expect(history.canGoForward()).toBe(false);
  });

  it('should notify on pop state', () => {
    const callback = vi.fn();
    history.onPopState(callback);

    history.push({ page: 1 });

    expect(callback).toHaveBeenCalled();
  });
});

describe('URL Parser Tests', () => {
  let parser;

  beforeEach(() => {
    parser = createURLParser();
  });

  it('should parse URL', () => {
    const result = parser.parse('https://example.com:8080/path?query=1#hash');

    expect(result.hostname).toBe('example.com');
    expect(result.port).toBe('8080');
    expect(result.pathname).toBe('/path');
  });

  it('should get query params', () => {
    const params = parser.getQueryParams('/path?foo=bar&baz=qux');

    expect(params.foo).toBe('bar');
    expect(params.baz).toBe('qux');
  });

  it('should build query string', () => {
    const qs = parser.buildQueryString({ a: 1, b: 2 });

    expect(qs).toContain('a=1');
    expect(qs).toContain('b=2');
  });

  it('should join paths', () => {
    expect(parser.join('/api/', '/users/', '/123')).toBe('/api/users/123');
  });
});
