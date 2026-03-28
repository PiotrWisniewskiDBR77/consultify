import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetPlatformHealth = vi.fn();
const mockGetDomainReadiness = vi.fn();
const mockGetV8Flags = vi.fn();
const mockGetAllOrgFlags = vi.fn();
const mockSetV8OrgFlag = vi.fn();
const mockIsV8Enabled = vi.fn();
const mockIsV8ShadowMode = vi.fn();

vi.mock('../../../services/v8/platformHealthService.js', () => ({
  getPlatformHealth: (...args: unknown[]) => mockGetPlatformHealth(...args),
  getDomainReadiness: (...args: unknown[]) => mockGetDomainReadiness(...args),
}));

vi.mock('../../../services/v8/featureFlagService.js', () => ({
  getV8Flags: (...args: unknown[]) => mockGetV8Flags(...args),
  getAllOrgFlags: (...args: unknown[]) => mockGetAllOrgFlags(...args),
  setV8OrgFlag: (...args: unknown[]) => mockSetV8OrgFlag(...args),
  isV8Enabled: (...args: unknown[]) => mockIsV8Enabled(...args),
  isV8ShadowMode: (...args: unknown[]) => mockIsV8ShadowMode(...args),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: vi.fn().mockResolvedValue({ rows: [] }) }),
}));

let mockUser: any = null;

vi.mock('../../../middleware/auth.middleware.js', () => ({
  default: (req: any, _res: any, next: () => void) => {
    if (!mockUser) {
      _res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    req.can = () => true;
    next();
  },
  verifyToken: (req: any, _res: any, next: () => void) => {
    if (!mockUser) {
      _res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    req.can = () => true;
    next();
  },
  requireSuperAdmin: (req: any, res: any, next: () => void) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!req.user.isSuperAdmin) {
      res.status(403).json({ error: 'Super admin access required' });
      return;
    }
    next();
  },
  requireRole:
    (..._roles: string[]) =>
    (_req: any, _res: any, next: () => void) =>
      next(),
  requireOrganization: (_req: any, _res: any, next: () => void) => next(),
  isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
}));

import { v8FeatureGate } from '../../../middleware/v8FeatureGate.middleware.js';
import v8Router from '../../../routes/v8/index.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v8', v8Router);
  return app;
}

/**
 * In production, Gateway.ts mounts: v8FeatureGate → v8Router.
 * The feature gate needs req.organizationId which is set by verifyToken.
 * This helper pre-seeds org context (simulating that auth ran) so the
 * gate can evaluate the per-org flag.
 */
function createAppWithFeatureGate(): Express {
  const app = express();
  app.use(express.json());
  app.use(
    '/api/v8',
    (req: any, _res: any, next: () => void) => {
      if (mockUser) {
        req.organizationId = mockUser.organizationId;
      }
      next();
    },
    v8FeatureGate,
    v8Router
  );
  return app;
}

describe('V8 Auth Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = null;
    process.env.ENABLE_V8_GLOBAL = 'true';
    mockIsV8Enabled.mockResolvedValue(true);
    mockIsV8ShadowMode.mockResolvedValue(false);
    mockGetPlatformHealth.mockResolvedValue({ overall: 'healthy', domains: {} });
    mockGetDomainReadiness.mockResolvedValue({ domains: [] });
    mockGetV8Flags.mockResolvedValue({ v8_enabled: true });
    mockGetAllOrgFlags.mockResolvedValue([]);
  });

  describe('unauthenticated requests', () => {
    it('returns 401 when no auth token is provided', async () => {
      const app = createApp();
      const res = await request(app).get('/api/v8/health');
      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('missing organization context', () => {
    it('returns 403 V8_MISSING_ORG_CONTEXT when token has no organizationId', async () => {
      mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test',
        role: 'ADMIN',
        organizationId: undefined,
        isSuperAdmin: false,
      };
      const app = createApp();
      const res = await request(app).get('/api/v8/health');
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('V8_MISSING_ORG_CONTEXT');
    });
  });

  describe('authenticated requests with org context', () => {
    beforeEach(() => {
      mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'ADMIN',
        organizationId: 'org-123',
        isSuperAdmin: false,
      };
    });

    it('returns 200 on health endpoint with valid auth and org', async () => {
      const app = createApp();
      const res = await request(app).get('/api/v8/health');
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.meta.version).toBe('v8');
    });

    it('returns 200 on readiness endpoint', async () => {
      const app = createApp();
      const res = await request(app).get('/api/v8/health/readiness');
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('passes organizationId to service layer', async () => {
      const app = createApp();
      await request(app).get('/api/v8/health');
      expect(mockGetPlatformHealth).toHaveBeenCalledWith('org-123');
    });
  });

  describe('V8 context attachment', () => {
    it('attaches v8Context to the request', async () => {
      mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'ADMIN',
        organizationId: 'org-123',
        isSuperAdmin: true,
      };
      const app = createApp();
      const res = await request(app).get('/api/v8/health');
      expect(res.status).toBe(200);
    });
  });

  describe('superadmin-protected admin routes', () => {
    it('blocks non-superadmin from admin/flags/all', async () => {
      mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'ADMIN',
        organizationId: 'org-123',
        isSuperAdmin: false,
      };
      const app = createApp();
      const res = await request(app).get('/api/v8/admin/flags/all');
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Super admin access required');
    });

    it('allows superadmin access to admin/flags/all', async () => {
      mockUser = {
        id: 'user-1',
        email: 'admin@dbr77.com',
        name: 'Super Admin',
        role: 'SUPERADMIN',
        organizationId: 'org-123',
        isSuperAdmin: true,
      };
      const app = createApp();
      const res = await request(app).get('/api/v8/admin/flags/all');
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('V8 feature gate', () => {
    it('returns 404 when V8 is globally disabled', async () => {
      process.env.ENABLE_V8_GLOBAL = 'false';
      mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'ADMIN',
        organizationId: 'org-123',
        isSuperAdmin: false,
      };
      const app = createAppWithFeatureGate();
      const res = await request(app).get('/api/v8/health');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('V8_DISABLED');
    });

    it('returns 404 when V8 is disabled for the organization', async () => {
      mockIsV8Enabled.mockResolvedValue(false);
      mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'ADMIN',
        organizationId: 'org-123',
        isSuperAdmin: false,
      };
      const app = createAppWithFeatureGate();
      const res = await request(app).get('/api/v8/health');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('V8_ORG_DISABLED');
    });
  });
});
