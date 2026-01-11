/**
 * Security Headers Middleware Test
 *
 * Tests for security headers middleware.
 *
 * @module tests/unit/backend/middleware/securityHeadersMiddleware.test.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create security headers middleware
const createSecurityHeadersMiddleware = (options = {}) => {
  const {
    enableHSTS = true,
    enableNoSniff = true,
    enableFrameOptions = true,
    enableXSSProtection = true,
    enableContentPolicy = true,
    hstsMaxAge = 31536000,
    framePolicy = 'DENY',
  } = options;

  return (req, res, next) => {
    // HSTS
    if (enableHSTS) {
      res.setHeader('Strict-Transport-Security', `max-age=${hstsMaxAge}; includeSubDomains`);
    }

    // No Sniff
    if (enableNoSniff) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }

    // Frame Options
    if (enableFrameOptions) {
      res.setHeader('X-Frame-Options', framePolicy);
    }

    // XSS Protection
    if (enableXSSProtection) {
      res.setHeader('X-XSS-Protection', '1; mode=block');
    }

    // Content Security Policy
    if (enableContentPolicy) {
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
      );
    }

    // Additional security headers
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    return next();
  };
};

describe('Security Headers Middleware', () => {
  let middleware;
  let mockReq;
  let mockRes;
  let mockNext;
  let setHeaders;

  beforeEach(() => {
    middleware = createSecurityHeadersMiddleware();
    setHeaders = {};

    mockReq = {};

    mockRes = {
      setHeader: vi.fn((name, value) => {
        setHeaders[name] = value;
      }),
    };

    mockNext = vi.fn();
  });

  describe('HSTS Header', () => {
    it('should set Strict-Transport-Security header', () => {
      middleware(mockReq, mockRes, mockNext);

      expect(setHeaders['Strict-Transport-Security']).toContain('max-age=31536000');
      expect(setHeaders['Strict-Transport-Security']).toContain('includeSubDomains');
    });

    it('should use custom max-age', () => {
      const customMiddleware = createSecurityHeadersMiddleware({ hstsMaxAge: 3600 });
      customMiddleware(mockReq, mockRes, mockNext);

      expect(setHeaders['Strict-Transport-Security']).toContain('max-age=3600');
    });
  });

  describe('X-Content-Type-Options', () => {
    it('should set nosniff header', () => {
      middleware(mockReq, mockRes, mockNext);

      expect(setHeaders['X-Content-Type-Options']).toBe('nosniff');
    });
  });

  describe('X-Frame-Options', () => {
    it('should set DENY by default', () => {
      middleware(mockReq, mockRes, mockNext);

      expect(setHeaders['X-Frame-Options']).toBe('DENY');
    });

    it('should use custom frame policy', () => {
      const customMiddleware = createSecurityHeadersMiddleware({ framePolicy: 'SAMEORIGIN' });
      customMiddleware(mockReq, mockRes, mockNext);

      expect(setHeaders['X-Frame-Options']).toBe('SAMEORIGIN');
    });
  });

  describe('XSS Protection', () => {
    it('should set X-XSS-Protection header', () => {
      middleware(mockReq, mockRes, mockNext);

      expect(setHeaders['X-XSS-Protection']).toBe('1; mode=block');
    });
  });

  describe('Content Security Policy', () => {
    it('should set CSP header', () => {
      middleware(mockReq, mockRes, mockNext);

      expect(setHeaders['Content-Security-Policy']).toContain("default-src 'self'");
    });
  });

  describe('Additional Headers', () => {
    it('should set Referrer-Policy', () => {
      middleware(mockReq, mockRes, mockNext);

      expect(setHeaders['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    });

    it('should set Permissions-Policy', () => {
      middleware(mockReq, mockRes, mockNext);

      expect(setHeaders['Permissions-Policy']).toContain('camera=()');
    });
  });

  describe('Configurable Options', () => {
    it('should skip HSTS when disabled', () => {
      const noHstsMiddleware = createSecurityHeadersMiddleware({ enableHSTS: false });
      noHstsMiddleware(mockReq, mockRes, mockNext);

      expect(setHeaders['Strict-Transport-Security']).toBeUndefined();
    });
  });

  it('should call next', () => {
    middleware(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });
});
