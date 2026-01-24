/**
 * Device and Browser Detection Tests
 * Tests for environment detection utilities
 *
 * @module tests/device/device-detection.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// User agent parser
const createUserAgentParser = () => {
  const patterns = {
    browsers: [
      { name: 'Chrome', pattern: /Chrome\/(\d+)/ },
      { name: 'Firefox', pattern: /Firefox\/(\d+)/ },
      { name: 'Safari', pattern: /Safari\/(\d+)/ },
      { name: 'Edge', pattern: /Edg\/(\d+)/ },
      { name: 'Opera', pattern: /OPR\/(\d+)/ },
      { name: 'IE', pattern: /MSIE (\d+)/ },
    ],
    os: [
      { name: 'Windows', pattern: /Windows NT (\d+\.\d+)/ },
      { name: 'macOS', pattern: /Mac OS X (\d+[._]\d+)/ },
      { name: 'iOS', pattern: /iPhone OS (\d+)/ },
      { name: 'Android', pattern: /Android (\d+)/ },
      { name: 'Linux', pattern: /Linux/ },
    ],
    device: [
      { type: 'mobile', pattern: /Mobile|Android|iPhone|iPad/ },
      { type: 'tablet', pattern: /iPad|Tablet/ },
      { type: 'desktop', pattern: /.*/ },
    ],
  };

  return {
    parse: (userAgent) => {
      const result = {
        browser: { name: 'Unknown', version: null },
        os: { name: 'Unknown', version: null },
        device: { type: 'desktop' },
        raw: userAgent,
      };

      // Detect browser
      for (const { name, pattern } of patterns.browsers) {
        const match = userAgent.match(pattern);
        if (match) {
          result.browser = { name, version: parseInt(match[1]) };
          break;
        }
      }

      // Detect OS
      for (const { name, pattern } of patterns.os) {
        const match = userAgent.match(pattern);
        if (match) {
          result.os = { name, version: match[1]?.replace('_', '.') || null };
          break;
        }
      }

      // Detect device type
      for (const { type, pattern } of patterns.device) {
        if (pattern.test(userAgent)) {
          result.device = { type };
          break;
        }
      }

      return result;
    },

    isMobile: (userAgent) => /Mobile|Android|iPhone/.test(userAgent),

    isTablet: (userAgent) => /iPad|Tablet/.test(userAgent),

    isDesktop: (userAgent) => !this.isMobile(userAgent) && !this.isTablet(userAgent),

    isBot: (userAgent) => /bot|crawler|spider|scraper/i.test(userAgent),
  };
};

// Feature detection
const createFeatureDetector = () => {
  return {
    supports: (feature) => {
      const features = {
        localStorage: () => {
          try {
            localStorage.setItem('test', 'test');
            localStorage.removeItem('test');
            return true;
          } catch {
            return false;
          }
        },
        sessionStorage: () => {
          try {
            sessionStorage.setItem('test', 'test');
            sessionStorage.removeItem('test');
            return true;
          } catch {
            return false;
          }
        },
        cookies: () => typeof document !== 'undefined' && navigator.cookieEnabled,
        webgl: () => {
          try {
            const canvas = document.createElement('canvas');
            return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
          } catch {
            return false;
          }
        },
        serviceWorker: () => 'serviceWorker' in navigator,
        webSocket: () => 'WebSocket' in globalThis,
        fetch: () => 'fetch' in globalThis,
        promise: () => 'Promise' in globalThis,
        intersectionObserver: () => 'IntersectionObserver' in globalThis,
        mutationObserver: () => 'MutationObserver' in globalThis,
      };

      const detector = features[feature];
      if (!detector) return false;

      try {
        return detector();
      } catch {
        return false;
      }
    },

    getCapabilities: () => {
      return {
        webSocket: 'WebSocket' in globalThis,
        fetch: 'fetch' in globalThis,
        promise: 'Promise' in globalThis,
        crypto: 'crypto' in globalThis,
      };
    },
  };
};

// Viewport detector
const createViewportDetector = () => {
  const breakpoints = {
    xs: 0,
    sm: 576,
    md: 768,
    lg: 992,
    xl: 1200,
    xxl: 1400,
  };

  return {
    getWidth: () => (typeof window !== 'undefined' ? window.innerWidth : 1024),

    getHeight: () => (typeof window !== 'undefined' ? window.innerHeight : 768),

    getBreakpoint: (width = this.getWidth()) => {
      if (width >= breakpoints.xxl) return 'xxl';
      if (width >= breakpoints.xl) return 'xl';
      if (width >= breakpoints.lg) return 'lg';
      if (width >= breakpoints.md) return 'md';
      if (width >= breakpoints.sm) return 'sm';
      return 'xs';
    },

    isBreakpoint: (breakpoint, width = this.getWidth()) => {
      return this.getBreakpoint(width) === breakpoint;
    },

    isAtLeast: (breakpoint, width = this.getWidth()) => {
      return width >= breakpoints[breakpoint];
    },

    isAtMost: (breakpoint, width = this.getWidth()) => {
      const nextBreakpoint = {
        xs: breakpoints.sm,
        sm: breakpoints.md,
        md: breakpoints.lg,
        lg: breakpoints.xl,
        xl: breakpoints.xxl,
        xxl: Infinity,
      };
      return width < nextBreakpoint[breakpoint];
    },

    isMobile: (width = this.getWidth()) => width < breakpoints.md,

    isDesktop: (width = this.getWidth()) => width >= breakpoints.lg,

    getBreakpoints: () => ({ ...breakpoints }),
  };
};

// Connection detector
const createConnectionDetector = () => {
  return {
    getType: () => {
      if (typeof navigator === 'undefined') return 'unknown';
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      return conn?.effectiveType || 'unknown';
    },

    isOnline: () => (typeof navigator !== 'undefined' ? navigator.onLine : true),

    isSlow: () => {
      const type = this.getType();
      return type === 'slow-2g' || type === '2g';
    },

    isFast: () => {
      const type = this.getType();
      return type === '4g' || type === 'wifi';
    },

    getDownlink: () => {
      if (typeof navigator === 'undefined') return null;
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      return conn?.downlink || null;
    },
  };
};

describe('User Agent Parser Tests', () => {
  let parser;

  beforeEach(() => {
    parser = createUserAgentParser();
  });

  it('should detect Chrome', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';
    const result = parser.parse(ua);

    expect(result.browser.name).toBe('Chrome');
    expect(result.browser.version).toBe(120);
  });

  it('should detect Firefox', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0';
    const result = parser.parse(ua);

    expect(result.browser.name).toBe('Firefox');
  });

  it('should detect Windows', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0';
    const result = parser.parse(ua);

    expect(result.os.name).toBe('Windows');
  });

  it('should detect mobile', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148';

    expect(parser.isMobile(ua)).toBe(true);
  });

  it('should detect bot', () => {
    const ua = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

    expect(parser.isBot(ua)).toBe(true);
  });
});

describe('Feature Detector Tests', () => {
  let detector;

  beforeEach(() => {
    detector = createFeatureDetector();
  });

  it('should check feature support', () => {
    expect(detector.supports('promise')).toBe(true);
    expect(detector.supports('fetch')).toBe(true);
  });

  it('should get capabilities', () => {
    const caps = detector.getCapabilities();

    expect(caps).toHaveProperty('promise');
    expect(caps).toHaveProperty('fetch');
  });

  it('should return false for unknown features', () => {
    expect(detector.supports('unknownFeature')).toBe(false);
  });
});

describe('Viewport Detector Tests', () => {
  let viewport;

  beforeEach(() => {
    viewport = createViewportDetector();
  });

  it('should get breakpoint', () => {
    expect(viewport.getBreakpoint(320)).toBe('xs');
    expect(viewport.getBreakpoint(768)).toBe('md');
    expect(viewport.getBreakpoint(1200)).toBe('xl');
  });

  it('should check isAtLeast', () => {
    expect(viewport.isAtLeast('md', 800)).toBe(true);
    expect(viewport.isAtLeast('lg', 800)).toBe(false);
  });

  it('should check mobile/desktop', () => {
    expect(viewport.isMobile(500)).toBe(true);
    expect(viewport.isDesktop(1024)).toBe(true);
  });
});
