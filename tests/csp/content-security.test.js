/**
 * Content Security Tests
 * Tests for content security policy and headers
 *
 * @module tests/csp/content-security.test.js
 */

import { describe, it, expect, beforeEach } from 'vitest';

// CSP builder implementation
const createCSPBuilder = () => {
  const directives = new Map();

  const addToDirective = (directive, ...values) => {
    if (!directives.has(directive)) {
      directives.set(directive, new Set());
    }
    values.forEach((v) => directives.get(directive).add(v));
  };

  return {
    defaultSrc: (...sources) => {
      addToDirective('default-src', ...sources);
      return this;
    },

    scriptSrc: (...sources) => {
      addToDirective('script-src', ...sources);
      return this;
    },

    styleSrc: (...sources) => {
      addToDirective('style-src', ...sources);
      return this;
    },

    imgSrc: (...sources) => {
      addToDirective('img-src', ...sources);
      return this;
    },

    fontSrc: (...sources) => {
      addToDirective('font-src', ...sources);
      return this;
    },

    connectSrc: (...sources) => {
      addToDirective('connect-src', ...sources);
      return this;
    },

    frameSrc: (...sources) => {
      addToDirective('frame-src', ...sources);
      return this;
    },

    frameAncestors: (...sources) => {
      addToDirective('frame-ancestors', ...sources);
      return this;
    },

    objectSrc: (...sources) => {
      addToDirective('object-src', ...sources);
      return this;
    },

    mediaSrc: (...sources) => {
      addToDirective('media-src', ...sources);
      return this;
    },

    formAction: (...sources) => {
      addToDirective('form-action', ...sources);
      return this;
    },

    baseUri: (...sources) => {
      addToDirective('base-uri', ...sources);
      return this;
    },

    reportUri: (uri) => {
      addToDirective('report-uri', uri);
      return this;
    },

    upgradeInsecureRequests: () => {
      addToDirective('upgrade-insecure-requests');
      return this;
    },

    blockAllMixedContent: () => {
      addToDirective('block-all-mixed-content');
      return this;
    },

    build: () => {
      const parts = [];

      for (const [directive, values] of directives) {
        if (values.size === 0) {
          parts.push(directive);
        } else {
          parts.push(`${directive} ${[...values].join(' ')}`);
        }
      }

      return parts.join('; ');
    },

    toHeader: () => ({
      'Content-Security-Policy': this.build(),
    }),

    clear: () => {
      directives.clear();
    },
  };
};

// Security headers implementation
const createSecurityHeaders = (options = {}) => {
  const { reportTo } = options;

  return {
    getAll: () => {
      const headers = {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(), camera=(), microphone=()',
      };

      if (reportTo) {
        headers['Report-To'] = JSON.stringify(reportTo);
      }

      return headers;
    },

    strict: () => ({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'geolocation=(), camera=(), microphone=(), payment=()',
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Resource-Policy': 'same-origin',
    }),

    api: () => ({
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
    }),

    cors: (origin = '*') => ({
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }),

    hsts: (maxAge = 31536000, includeSubDomains = true, preload = false) => {
      let value = `max-age=${maxAge}`;
      if (includeSubDomains) value += '; includeSubDomains';
      if (preload) value += '; preload';

      return { 'Strict-Transport-Security': value };
    },

    middleware: () => {
      return (req, res, next) => {
        const headers = this.getAll();
        Object.entries(headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
        next();
      };
    },
  };
};

describe('Content Security Tests', () => {
  // ═══════════════════════════════════════════════════════════════════
  // CSP BUILDER
  // ═══════════════════════════════════════════════════════════════════

  describe('CSP Builder', () => {
    let csp;

    beforeEach(() => {
      csp = createCSPBuilder();
    });

    describe('directives', () => {
      it('should build default-src', () => {
        const result = csp.defaultSrc("'self'").build();
        expect(result).toBe("default-src 'self'");
      });

      it('should build multiple sources', () => {
        const result = csp.scriptSrc("'self'", 'https://cdn.example.com').build();
        expect(result).toBe("script-src 'self' https://cdn.example.com");
      });

      it('should build multiple directives', () => {
        const result = csp
          .defaultSrc("'self'")
          .scriptSrc("'self'", "'unsafe-inline'")
          .styleSrc("'self'", 'https://fonts.googleapis.com')
          .build();

        expect(result).toContain("default-src 'self'");
        expect(result).toContain("script-src 'self' 'unsafe-inline'");
        expect(result).toContain('style-src');
      });

      it('should build img-src', () => {
        const result = csp.imgSrc("'self'", 'data:', 'https:').build();
        expect(result).toContain('img-src');
        expect(result).toContain('data:');
      });

      it('should build font-src', () => {
        const result = csp.fontSrc("'self'", 'https://fonts.gstatic.com').build();
        expect(result).toContain('font-src');
      });

      it('should build connect-src', () => {
        const result = csp.connectSrc("'self'", 'https://api.example.com').build();
        expect(result).toContain('connect-src');
      });

      it('should build frame-ancestors', () => {
        const result = csp.frameAncestors("'none'").build();
        expect(result).toBe("frame-ancestors 'none'");
      });

      it('should build form-action', () => {
        const result = csp.formAction("'self'").build();
        expect(result).toContain('form-action');
      });

      it('should build base-uri', () => {
        const result = csp.baseUri("'self'").build();
        expect(result).toContain('base-uri');
      });

      it('should build report-uri', () => {
        const result = csp.reportUri('/csp-report').build();
        expect(result).toContain('report-uri /csp-report');
      });
    });

    describe('flags', () => {
      it('should add upgrade-insecure-requests', () => {
        const result = csp.upgradeInsecureRequests().build();
        expect(result).toBe('upgrade-insecure-requests');
      });

      it('should add block-all-mixed-content', () => {
        const result = csp.blockAllMixedContent().build();
        expect(result).toBe('block-all-mixed-content');
      });
    });

    describe('toHeader', () => {
      it('should return header object', () => {
        const header = csp.defaultSrc("'self'").toHeader();

        expect(header['Content-Security-Policy']).toBe("default-src 'self'");
      });
    });

    describe('chaining', () => {
      it('should support method chaining', () => {
        const result = csp
          .defaultSrc("'self'")
          .scriptSrc("'self'")
          .styleSrc("'self'")
          .imgSrc("'self'", 'data:')
          .fontSrc("'self'")
          .connectSrc("'self'")
          .frameAncestors("'none'")
          .upgradeInsecureRequests()
          .build();

        expect(result).toContain("default-src 'self'");
        expect(result).toContain("frame-ancestors 'none'");
        expect(result).toContain('upgrade-insecure-requests');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SECURITY HEADERS
  // ═══════════════════════════════════════════════════════════════════

  describe('Security Headers', () => {
    let securityHeaders;

    beforeEach(() => {
      securityHeaders = createSecurityHeaders();
    });

    describe('getAll', () => {
      it('should return all security headers', () => {
        const headers = securityHeaders.getAll();

        expect(headers['X-Content-Type-Options']).toBe('nosniff');
        expect(headers['X-Frame-Options']).toBe('DENY');
        expect(headers['X-XSS-Protection']).toBe('1; mode=block');
        expect(headers['Referrer-Policy']).toBeDefined();
        expect(headers['Permissions-Policy']).toBeDefined();
      });
    });

    describe('strict', () => {
      it('should return strict headers', () => {
        const headers = securityHeaders.strict();

        expect(headers['Referrer-Policy']).toBe('no-referrer');
        expect(headers['Cache-Control']).toBe('no-store, max-age=0');
        expect(headers['Cross-Origin-Opener-Policy']).toBe('same-origin');
        expect(headers['Cross-Origin-Embedder-Policy']).toBe('require-corp');
      });
    });

    describe('api', () => {
      it('should return API headers', () => {
        const headers = securityHeaders.api();

        expect(headers['X-Content-Type-Options']).toBe('nosniff');
        expect(headers['Content-Type']).toBe('application/json; charset=utf-8');
      });
    });

    describe('cors', () => {
      it('should return CORS headers with wildcard', () => {
        const headers = securityHeaders.cors();

        expect(headers['Access-Control-Allow-Origin']).toBe('*');
        expect(headers['Access-Control-Allow-Methods']).toContain('GET');
      });

      it('should return CORS headers with specific origin', () => {
        const headers = securityHeaders.cors('https://example.com');

        expect(headers['Access-Control-Allow-Origin']).toBe('https://example.com');
      });
    });

    describe('hsts', () => {
      it('should return HSTS header', () => {
        const headers = securityHeaders.hsts();

        expect(headers['Strict-Transport-Security']).toContain('max-age=31536000');
        expect(headers['Strict-Transport-Security']).toContain('includeSubDomains');
      });

      it('should include preload', () => {
        const headers = securityHeaders.hsts(31536000, true, true);

        expect(headers['Strict-Transport-Security']).toContain('preload');
      });

      it('should exclude includeSubDomains', () => {
        const headers = securityHeaders.hsts(31536000, false);

        expect(headers['Strict-Transport-Security']).not.toContain('includeSubDomains');
      });
    });

    describe('middleware', () => {
      it('should create middleware', () => {
        const middleware = securityHeaders.middleware();
        expect(typeof middleware).toBe('function');
      });

      it('should set headers', () => {
        const middleware = securityHeaders.middleware();
        const req = {};
        const res = { setHeader: vi.fn() };
        const next = vi.fn();

        middleware(req, res, next);

        expect(res.setHeader).toHaveBeenCalled();
        expect(next).toHaveBeenCalled();
      });
    });
  });
});
