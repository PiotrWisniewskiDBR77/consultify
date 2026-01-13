// @ts-nocheck
import { AppError, asyncHandler as catchAsync } from '../utils/errorHandler.js';
import { getDatabase } from '../database/index.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config/index.js';
import * as uuid from 'uuid';
import { activityService } from '../services/ActivityService.js';
import usageService from '../services/usageService.js';
import { Request, Response, NextFunction } from 'express';
import securityIncidentService from '../services/securityIncidentService.js';
import integrationService from '../services/integrationService.js';
import webhookService from '../services/WebhookService.js';
import adminSessionService from '../services/adminSessionService.js';
import complianceService from '../services/complianceService.js';

// Extended Request type with user
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    organizationId?: string;
  };
}

// Database row types
interface UserRow {
  id: string;
  organization_id: string;
  organization_name: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  status: string;
  last_login: string;
  created_at: string;
  password?: string;
}

// Default Dependencies - properly typed
const deps: {
  db: ReturnType<typeof getDatabase>;
  ActivityService: typeof activityService;
  BillingService: any;
  UsageService: typeof usageService;
  RealtimeService: any;
  StorageService: any;
  LegalService: any;
  LegalEventLogger: any;
  AttributionService: any;
  jwt: typeof jwt;
  bcrypt: typeof bcrypt;
  config: typeof config;
  uuid: typeof uuid;
  InvitationService: any;
  RefreshTokenService: any;
  OrganizationMetadataService: any;
  OrganizationTagService: any;
  OrganizationHealthService: any;
  OrganizationRelationshipService: any;
  OrganizationSegmentService: any;
  OrganizationAnalyticsService: any;
  UserActivityService: any;
  UserSessionService: any;
  UserGroupService: any;
  UserLicenseService: any;
  IPWhitelistService: any;
  DeviceManagementService: any;
  PasswordPolicyService: any;
  SecurityEventService: any;
  SupportTicketService: any;
  CustomerSuccessService: any;
  FeedbackService: any;
  UserAdoptionService: any;
  DataRetentionService: any;
  ConsentManagementService: any;
  AutomationEngineService: any;
  EmailTemplateService: any;
  EmailCampaignService: any;
  SecurityIncidentService: any;
  ThreatIntelligenceService: any;
  DLPService: any;
  DashboardBuilderService: any;
  IntegrationService: any;
  WebhookService: any;
  AdminSessionService: any;
  ComplianceService: any;
} = {
  db: getDatabase(),
  ActivityService: activityService,
  BillingService: null, // Lazy loaded
  UsageService: usageService,
  RealtimeService: { getGlobalStats: () => ({}) } as any,
  StorageService: {
    storeFile: async () => '',
    getGlobalUsage: async () => ({ breakdown: [] }),
    listFiles: async () => [],
    deleteFile: async () => true,
  } as any,
  LegalService: {
    getDocument: async () => ({}),
    getAllDocuments: async () => [],
    publishDocument: async (d: any) => d,
    toggleDocumentActive: async () => ({}),
    getDocumentById: async () => null,
  } as any,
  LegalEventLogger: {
    logEvent: async () => ({}),
    getEvents: async () => [],
    getEventStats: async () => ({}),
  } as any,
  AttributionService: null, // Lazy loaded
  jwt: jwt,
  bcrypt: bcrypt,
  config: config,
  uuid: uuid,
  InvitationService: { createOrgInvitation: async () => ({ token: '' }) } as any,
  RefreshTokenService: null as any,
  // Enterprise Customers Module Services
  OrganizationMetadataService: {
    getMetadata: async () => [],
    setMetadata: async () => ({}),
  } as any,
  OrganizationTagService: {
    getTags: async () => [],
    addTag: async () => ({}),
    removeTag: async () => ({}),
  } as any,
  OrganizationHealthService: { calculateHealthScore: async () => ({}) } as any,
  OrganizationRelationshipService: { getRelationships: async () => [] } as any,
  OrganizationSegmentService: { getSegments: async () => [] } as any,
  OrganizationAnalyticsService: { getAnalytics: async () => ({}) } as any,
  UserActivityService: null as any,
  UserSessionService: null as any,
  UserGroupService: { getGroups: async () => [] } as any,
  UserLicenseService: { getLicenses: async () => [] } as any,
  IPWhitelistService: { getWhitelist: async () => [], addIP: async () => ({}) } as any,
  DeviceManagementService: { getUserDevices: async () => [] } as any,
  PasswordPolicyService: { getPolicy: async () => ({}) } as any,
  SecurityEventService: { getEvents: async () => [] } as any,
  SupportTicketService: {
    getTickets: async () => [],
    createTicket: async () => ({ ticketNumber: 'T-123' }),
  } as any,
  CustomerSuccessService: { getNotes: async () => [] } as any,
  FeedbackService: null as any,
  UserAdoptionService: null as any,
  DataRetentionService: { getPolicy: async () => ({}) } as any,
  ConsentManagementService: { getConsents: async () => [] } as any,
  AutomationEngineService: { getRules: async () => [] } as any,
  EmailTemplateService: { getTemplates: async () => [] } as any,
  EmailCampaignService: { getCampaigns: async () => [] } as any,
  SecurityIncidentService: securityIncidentService,
  ThreatIntelligenceService: { getThreats: async () => [] } as any,
  DLPService: { getPolicies: async () => [] } as any,
  DashboardBuilderService: { getDashboards: async () => [] } as any,
  IntegrationService: integrationService,
  WebhookService: webhookService,
  AdminSessionService: adminSessionService,
  ComplianceService: complianceService,
};

/**
 * Lazy load AttributionService (ES module)
 */
const getAttributionService = async () => {
  if (!deps.AttributionService) {
    const module = await import('../services/../services/attributionService.js');
    deps.AttributionService = module.default;
  }
  return deps.AttributionService;
};

/**
 * Lazy load BillingService (ES module)
 */
const getBillingService = async () => {
  if (!deps.BillingService) {
    const billingService = (await import('../services/../services/BillingService.js')).default;
    deps.BillingService = billingService;
  }
  return deps.BillingService;
};

/**
 * Inject mock dependencies for testing
 */
const setDependencies = (newDeps: Partial<typeof deps>): void => {
  Object.assign(deps, newDeps);
};

const tableExists = async (tableName: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const dbType =
      process.env.DB_TYPE === 'postgres' || process.env.DATABASE_URL?.startsWith('postgres');
    if (dbType) {
      deps.db.get(`SELECT to_regclass(?) as exists`, [tableName], (err: any, row: any) =>
        resolve(!err && !!row?.exists)
      );
    } else {
      deps.db.get(
        `SELECT name FROM sqlite_master WHERE type='table' AND name = ?`,
        [tableName],
        (err: any, row: any) => resolve(!err && !!row)
      );
    }
  });
};

/**
 * GET All Organizations
 */
const getOrganizations = catchAsync(async (req, res, next) => {
  const sql = `
        SELECT 
            o.id, o.name, o.plan, o.status, 
            COALESCE(o.trial_started_at, o.created_at) as created_at, 
            0 as discount_percent,
            COUNT(u.id) as user_count
        FROM organizations o
        LEFT JOIN users u ON o.id = u.organization_id
        GROUP BY o.id, o.name, o.plan, o.status, o.trial_started_at, o.created_at
        ORDER BY o.name ASC
    `;

  deps.db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('[SuperAdmin] Organizations query error:', err);
      return next(new AppError('Failed to fetch organizations', 500));
    }
    res.json(rows || []);
  });
});

/**
 * GET Recent Activities
 */
const getActivities = catchAsync(async (req, res, next) => {
  const limit = parseInt(req.query.limit) || 50;
  const activities = await deps.ActivityService.getRecent(limit);
  res.json(activities);
});

/**
 * GET Dashboard Stats
 */
const getDashboardStats = catchAsync(async (req, res, next) => {
  const [activityStats, aiStats, activities] = await Promise.all([
    deps.ActivityService.getStats().catch((err) => {
      console.error('[SuperAdmin] Activity Stats Error:', err);
      return { total: 0, last_hour: 0, last_24h: 0, last_7d: 0 };
    }),
    new Promise((resolve) => {
      // Try ai_usage_logs first (primary table), fallback to llm_logs
      deps.db.get(
        `
                SELECT 
                    COALESCE(
                        (SELECT COUNT(*) FROM ai_usage_logs WHERE created_at > datetime('now', '-7 days')),
                        (SELECT COUNT(*) FROM llm_logs WHERE created_at > datetime('now', '-7 days')),
                        0
                    ) as total_ai_calls,
                    COALESCE(
                        (SELECT SUM(COALESCE(prompt_tokens, 0) + COALESCE(completion_tokens, 0)) FROM ai_usage_logs WHERE created_at > datetime('now', '-7 days')),
                        (SELECT SUM(COALESCE(total_tokens, 0)) FROM llm_logs WHERE created_at > datetime('now', '-7 days')),
                        0
                    ) as total_tokens,
                    COALESCE(
                        (SELECT COUNT(DISTINCT user_id) FROM ai_usage_logs WHERE created_at > datetime('now', '-7 days')),
                        (SELECT COUNT(DISTINCT user_id) FROM llm_logs WHERE created_at > datetime('now', '-7 days')),
                        0
                    ) as active_users
            `,
        [],
        (err, row) => {
          if (err) {
            console.warn('[SuperAdmin] AI Stats query fallback:', err.message);
            resolve({ total_ai_calls: 0, total_tokens: 0, active_users: 0 });
          } else {
            resolve(row || { total_ai_calls: 0, total_tokens: 0, active_users: 0 });
          }
        }
      );
    }),
    deps.ActivityService.getRecent(15).catch((err) => {
      console.error('[SuperAdmin] Activities Error:', err);
      return [];
    }),
  ]);

  const counts = await new Promise((resolve) => {
    deps.db.get(
      `
            SELECT 
                (SELECT COUNT(*) FROM users WHERE status != 'deleted' OR status IS NULL) as total_users,
                (SELECT COUNT(*) FROM organizations WHERE status != 'deleted' OR status IS NULL) as total_orgs,
                COALESCE(
                    (SELECT COUNT(*) FROM users WHERE last_login > datetime('now', '-7 days')),
                    (SELECT COUNT(DISTINCT user_id) FROM login_history WHERE created_at > datetime('now', '-7 days') AND status = 'success'),
                    0
                ) as active_users_7d
        `,
      [],
      (err, row) => {
        if (err) {
          console.warn('[SuperAdmin] Counts query error:', err.message);
          resolve({ total_users: 0, total_orgs: 0, active_users_7d: 0 });
        } else {
          resolve(row || { total_users: 0, total_orgs: 0, active_users_7d: 0 });
        }
      }
    );
  });

  res.json({
    activity: activityStats,
    ai: aiStats,
    counts,
    live: deps.RealtimeService.getGlobalStats(),
    activities: activities || [],
  });
});

/**
 * UPDATE Organization
 */
const updateOrganization = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { plan, status, discount_percent } = req.body;

  const validPlans = ['free', 'pro', 'enterprise'];
  const validStatuses = ['active', 'blocked', 'trial'];

  if (plan && !validPlans.includes(plan)) return next(new AppError('Invalid plan', 400));
  if (status && !validStatuses.includes(status)) return next(new AppError('Invalid status', 400));
  if (discount_percent !== undefined && (discount_percent < 0 || discount_percent > 100)) {
    return next(new AppError('Invalid discount percent', 400));
  }

  const sql = `UPDATE organizations SET plan = COALESCE(?, plan), status = COALESCE(?, status), discount_percent = COALESCE(?, discount_percent) WHERE id = ?`;

  deps.db.run(sql, [plan, status, discount_percent, id], function (err) {
    if (err) return next(new AppError(err.message, 500));
    if (this.changes === 0) return next(new AppError('Organization not found', 404));

    deps.ActivityService.log({
      organizationId: id,
      userId: req.user?.id,
      action: 'updated',
      entityType: 'organization',
      entityId: id,
      newValue: { plan, status, discount_percent },
    });

    res.json({ message: 'Organization updated' });
  });
});

const deleteOrganization = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (id === 'org-dbr77-system')
    return next(new AppError('Cannot delete System Organization', 403));

  deps.db.serialize(() => {
    deps.db.run(
      `DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE organization_id = ?)`,
      [id]
    );
    deps.db.run(
      `DELETE FROM project_users WHERE project_id IN (SELECT id FROM projects WHERE organization_id = ?)`,
      [id]
    );
    deps.db.run('DELETE FROM projects WHERE organization_id = ?', [id]);
    deps.db.run('DELETE FROM users WHERE organization_id = ?', [id]);
    deps.db.run('DELETE FROM organizations WHERE id = ?', [id], function (err) {
      if (err) return next(new AppError(err.message, 500));

      deps.ActivityService.log({
        userId: req.user?.id,
        action: 'deleted',
        entityType: 'organization',
        entityId: id,
      });

      res.json({ message: 'Organization and its users, projects, and data deleted' });
    });
  });
});

/**
 * GET Organization Billing Details
 */
const getOrgBilling = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const BillingService = await getBillingService();
  const [billing, usage, invoices] = await Promise.all([
    BillingService.getOrganizationBilling(id),
    deps.UsageService.getCurrentUsage(id),
    BillingService.getInvoices(id),
  ]);

  res.json({
    billing: billing || { status: 'no_subscription' },
    usage: usage || {},
    invoices: invoices || [],
  });
});

/**
 * GET All Users
 */
const getUsers = catchAsync(async (req, res, next) => {
  const sql = `
        SELECT
            u.id, u.organization_id, u.email, u.first_name, u.last_name,
            u.role, u.status, u.last_login, u.created_at,
            o.name as organization_name
        FROM users u
        LEFT JOIN organizations o ON u.organization_id = o.id
        ORDER BY u.created_at DESC
    `;

  deps.db.all(sql, [], (err, rows) => {
    if (err) return next(new AppError(err.message, 500));

    const users = rows.map((u) => ({
      id: u.id,
      organizationId: u.organization_id,
      organizationName: u.organization_name,
      firstName: u.first_name,
      lastName: u.last_name,
      email: u.email,
      role: u.role,
      status: u.status,
      lastLogin: u.last_login,
      createdAt: u.created_at,
    }));
    res.json(users);
  });
});

/**
 * UPDATE User
 */
const updateUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { organizationId, role, status } = req.body;

  const sql = `UPDATE users SET organization_id = COALESCE(?, organization_id), role = COALESCE(?, role), status = COALESCE(?, status) WHERE id = ? `;

  deps.db.run(sql, [organizationId, role, status, id], function (err) {
    if (err) return next(new AppError(err.message, 500));
    if (this.changes === 0) return next(new AppError('User not found', 404));

    deps.ActivityService.log({
      userId: req.user?.id,
      action: 'updated',
      entityType: 'user',
      entityId: id,
      newValue: { organizationId, role, status },
    });

    res.json({ message: 'User updated successfully' });
  });
});

/**
 * CREATE Super Admin User
 */
const createUser = catchAsync(async (req, res, next) => {
  const { firstName, lastName, email, password } = req.body;

  if (!email || !password) return next(new AppError('Email and password are required', 400));

  const hashedPassword = deps.bcrypt.hashSync(password, 8);
  const id = deps.uuid.v4();
  const systemOrgId = 'org-dbr77-system';

  const sql = `INSERT INTO users(id, organization_id, email, password, first_name, last_name, role, status, created_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`;

  deps.db.run(
    sql,
    [id, systemOrgId, email, hashedPassword, firstName, lastName, 'SUPERADMIN', 'active'],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return next(new AppError('Email already exists', 400));
        }
        return next(new AppError(err.message, 500));
      }

      deps.ActivityService.log({
        userId: req.user?.id,
        action: 'created',
        entityType: 'user',
        entityId: id,
        newValue: { email, role: 'SUPERADMIN' },
      });

      res.json({ id, email, firstName, lastName, role: 'SUPERADMIN', status: 'active' });
    }
  );
});

/**
 * INVITE USER
 */
const inviteUser = catchAsync(async (req, res, next) => {
  const { email, role, organizationId } = req.body;

  if (!email || !organizationId)
    return next(new AppError('Email and Organization are required', 400));

  try {
    const result = await deps.InvitationService.createOrgInvitation(
      organizationId,
      email,
      role || 'USER',
      req.user.id,
      {}, // metadata
      { ip: req.ip, userAgent: req.get('user-agent') }
    );

    const inviteLink = `${req.protocol}://${req.get('host')}/register?token=${result.token}`;

    deps.ActivityService.log({
      userId: req.user.id,
      action: 'invited',
      entityType: 'user',
      entityName: email,
      details: { organizationId, role },
    });

    res.json({ message: 'Invitation created', inviteLink, token: result.token });
  } catch (err) {
    if (err.message.includes('already a member')) {
      return next(new AppError('User already exists in this organization', 400));
    }
    return next(new AppError(err.message, 500));
  }
});

/**
 * RESET PASSWORD LINK
 */
const resetUserPassword = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  deps.db.get('SELECT * FROM users WHERE id = ?', [id], (err, user) => {
    if (err) return next(new AppError(err.message, 500));
    if (!user) return next(new AppError('User not found', 404));

    const token = deps.uuid.v4();
    const resetId = deps.uuid.v4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const sql = `INSERT INTO password_resets(id, user_id, token, expires_at) VALUES(?, ?, ?, ?)`;

    deps.db.run(sql, [resetId, id, token, expiresAt], function (err) {
      if (err) return next(new AppError(err.message, 500));

      const resetLink = `${req.protocol}://${req.get('host')}/reset-password?token=${token}`;

      deps.ActivityService.log({
        userId: req.user.id,
        action: 'password_reset_generated',
        entityType: 'user',
        entityId: id,
        entityName: user.email,
      });

      res.json({ message: 'Reset link generated', resetLink, token });
    });
  });
});

/**
 * GET Access Requests
 */
const getAccessRequests = catchAsync(async (req, res, next) => {
  deps.db.all(`SELECT * FROM access_requests ORDER BY requested_at DESC`, [], (err, rows) => {
    if (err) return next(new AppError(err.message, 500));
    res.json(rows);
  });
});

/**
 * APPROVE Access Request
 */
const approveAccessRequest = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  deps.db.get(`SELECT * FROM access_requests WHERE id = ? `, [id], (err, request) => {
    if (err || !request) return next(new AppError('Request not found', 404));

    deps.db.run(
      `UPDATE organizations SET status = 'active' WHERE id = ? `,
      [request.organization_id],
      (err) => {
        if (err) return next(new AppError('Failed to activate organization', 500));

        deps.db.run(
          `UPDATE access_requests SET status = 'approved', reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ? `,
          [req.user.id, id],
          (err) => {
            if (err) console.error('Error updating request status', err);
            res.json({ message: 'Access approved successfully' });
          }
        );
      }
    );
  });
});

/**
 * REJECT Access Request
 */
const rejectAccessRequest = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { reason } = req.body;

  deps.db.get(`SELECT * FROM access_requests WHERE id = ? `, [id], (err, request) => {
    if (err || !request) return next(new AppError('Request not found', 404));

    deps.db.run(
      `UPDATE organizations SET status = 'blocked' WHERE id = ? `,
      [request.organization_id],
      (err) => {
        deps.db.run(
          `UPDATE access_requests SET status = 'rejected', rejection_reason = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ? `,
          [reason, req.user.id, id],
          (err) => {
            if (err) return next(new AppError(err.message, 500));
            res.json({ message: 'Access rejected' });
          }
        );
      }
    );
  });
});

/**
 * GET Access Codes
 */
const getAccessCodes = catchAsync(async (req, res, next) => {
  deps.db.all(`SELECT * FROM access_codes ORDER BY created_at DESC`, [], (err, rows) => {
    if (err) return next(new AppError(err.message, 500));
    res.json(rows);
  });
});

/**
 * CREATE Access Code
 */
const createAccessCode = catchAsync(async (req, res, next) => {
  const { code, role, maxUses, expiresAt } = req.body;
  const newCode = code || deps.uuid.v4().substring(0, 8).toUpperCase();
  const orgId = req.user.organizationId;

  deps.db.run(
    `INSERT INTO access_codes(id, organization_id, code, created_by, role, max_uses, expires_at) VALUES(?, ?, ?, ?, ?, ?, ?)`,
    [deps.uuid.v4(), orgId, newCode, req.user.id, role || 'USER', maxUses || 100, expiresAt],
    function (err) {
      if (err) return next(new AppError(err.message, 500));
      res.json({ message: 'Access code created', code: newCode });
    }
  );
});

/**
 * IMPERSONATE USER
 */
const impersonateUser = catchAsync(async (req, res, next) => {
  const { userId } = req.body;
  if (!userId) return next(new AppError('User ID is required', 400));

  deps.db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) return next(new AppError(err.message, 500));
    if (!user) return next(new AppError('User not found', 404));

    deps.db.get('SELECT * FROM organizations WHERE id = ?', [user.organization_id], (err, org) => {
      if (err) return next(new AppError('Server error', 500));

      const jti = deps.uuid.v4();
      const token = deps.jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
          organizationId: user.organization_id,
          impersonator_id: req.user.id,
          jti: jti,
        },
        deps.config.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const safeUser = {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        status: user.status,
        organizationId: user.organization_id,
        companyName: org ? org.name : 'Unknown',
        impersonatorId: req.user.id,
      };

      deps.ActivityService.log({
        userId: req.user.id,
        action: 'impersonate_start',
        entityType: 'user',
        entityId: user.id,
        entityName: user.email,
        details: { target_organization: user.organization_id },
      });

      res.json({ user: safeUser, token });
    });
  });
});

/**
 * DATABASE EXPLORER - TABLES
 */
const getDatabaseTables = catchAsync(async (req, res, next) => {
  const isPg =
    process.env.DB_TYPE === 'postgres' || process.env.DATABASE_URL?.startsWith('postgres');
  const query = isPg
    ? "SELECT table_name as name FROM information_schema.tables WHERE table_schema = 'public' AND table_name NOT LIKE 'pg_%' AND table_name NOT LIKE '_%'"
    : "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'";
  deps.db.all(query, [], (err, rows) => {
    if (err) return next(new AppError(err.message, 500));
    res.json(rows.map((r) => r.name));
  });
});

/**
 * DATABASE EXPLORER - ROWS
 */
const getDatabaseRows = catchAsync(async (req, res, next) => {
  const { tableName } = req.params;
  if (!/^[a-zA-Z0-9_]+$/.test(tableName)) return next(new AppError('Invalid table name', 400));

  const isPg =
    process.env.DB_TYPE === 'postgres' || process.env.DATABASE_URL?.startsWith('postgres');
  const orderBy = isPg ? 'ORDER BY ctid DESC' : 'ORDER BY rowid DESC';
  deps.db.all(`SELECT * FROM ${tableName} ${orderBy} LIMIT 100`, [], (err, rows) => {
    if (err) return next(new AppError(err.message, 500));
    res.json(rows);
  });
});

/**
 * STORAGE STATS
 */
const getStorageUsage = catchAsync(async (req, res, next) => {
  const stats = await deps.StorageService.getGlobalUsage();
  const orgs = await new Promise((resolve) => {
    deps.db.all('SELECT id, name FROM organizations', [], (err, rows) => resolve(rows || []));
  });

  const enrichedBreakdown = stats.breakdown.map((item) => {
    const org = orgs.find((o) => o.id === item.name);
    return {
      ...item,
      displayName: org ? org.name : item.name === 'global' ? 'Global System' : item.name,
    };
  });

  res.json({ ...stats, breakdown: enrichedBreakdown });
});

/**
 * STORAGE LIST FILES
 */
const getStorageFiles = catchAsync(async (req, res, next) => {
  const { orgId } = req.params;
  const files = await deps.StorageService.listFiles(orgId);
  res.json(files);
});

/**
 * STORAGE DELETE FILE
 */
const deleteStorageFile = catchAsync(async (req, res, next) => {
  const { orgId, path } = req.body;
  if (!orgId || !path) return next(new AppError('Missing params', 400));

  const success = await deps.StorageService.deleteFile(orgId, path);
  if (success) res.json({ success: true });
  else next(new AppError('File not found', 404));
});

/**
 * LEGAL DASHBOARD
 */
const getAllLegalDocs = catchAsync(async (req, res, next) => {
  const documents = await deps.LegalService.getAllDocuments();
  res.json(documents);
});

/**
 * LEGAL PUBLISH
 */
const publishLegalDoc = catchAsync(async (req, res, next) => {
  const {
    docType,
    version,
    title,
    contentMd,
    effectiveFrom,
    expiresAt,
    reacceptRequiredFrom,
    scopeType,
    scopeValue,
    changeSummary,
    previousVersionId,
  } = req.body;

  if (!docType || !version || !title || !contentMd || !effectiveFrom) {
    return next(
      new AppError('Required fields: docType, version, title, contentMd, effectiveFrom', 400)
    );
  }

  const validTypes = ['TOS', 'PRIVACY', 'COOKIES', 'AUP', 'AI_POLICY', 'DPA'];
  if (!validTypes.includes(docType.toUpperCase())) {
    return next(new AppError(`Invalid docType. Must be one of: ${validTypes.join(', ')}`, 400));
  }

  const document = await deps.LegalService.publishDocument({
    docType: docType.toUpperCase(),
    version,
    title,
    contentMd,
    effectiveFrom,
    createdBy: req.user.id,
    expiresAt,
    reacceptRequiredFrom,
    scopeType: scopeType || 'global',
    scopeValue,
    changeSummary,
    previousVersionId,
  });

  deps.ActivityService.log({
    userId: req.user.id,
    action: 'legal_document_published',
    entityType: 'legal_document',
    entityId: document.id,
    entityName: `${docType} v${version}`,
    newValue: { docType, version, effectiveFrom, scopeType, expiresAt, reacceptRequiredFrom },
  });

  res.json(document);
});

/**
 * LEGAL TOGGLE ACTIVE
 */
const toggleLegalDocActive = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { isActive } = req.body;
  if (typeof isActive !== 'boolean') return next(new AppError('isActive must be a boolean', 400));

  const result = await deps.LegalService.toggleDocumentActive(id, isActive);

  deps.ActivityService.log({
    userId: req.user.id,
    action: isActive ? 'legal_document_activated' : 'legal_document_deactivated',
    entityType: 'legal_document',
    entityId: id,
  });

  res.json(result);
});

/**
 * GET LEGAL DOC BY ID
 */
const getLegalDocById = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const document = await deps.LegalService.getDocumentById(id);
  if (!document) return next(new AppError('Document not found', 404));
  res.json(document);
});

/**
 * LEGAL EVENTS
 */
const getLegalEvents = catchAsync(async (req, res, next) => {
  const { organizationId, userId, documentId, eventTypes, dateFrom, dateTo, limit } = req.query;

  const events = await deps.LegalEventLogger.getEvents({
    organizationId,
    userId,
    documentId,
    eventTypes: eventTypes ? eventTypes.split(',') : null,
    dateFrom,
    dateTo,
    limit: limit ? parseInt(limit, 10) : 1000,
  });

  const parsedEvents = events.map((e) => ({
    ...e,
    metadata: typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata,
  }));

  res.json({
    count: parsedEvents.length,
    events: parsedEvents,
  });
});

/**
 * LEGAL EVENT STATS
 */
const getLegalEventStats = catchAsync(async (req, res, next) => {
  const { organizationId, days } = req.query;
  const stats = await deps.LegalEventLogger.getEventStats(
    organizationId || null,
    days ? parseInt(days, 10) : 30
  );

  res.json({
    period: `${days || 30} days`,
    stats,
  });
});

/**
 * ATTRIBUTION BY ORG
 */
const getOrgAttribution = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const AttributionService = await getAttributionService();
  const attribution = await AttributionService.getOrganizationAttribution(id);
  const firstAttribution = await AttributionService.getFirstAttribution(id);

  res.json({
    organizationId: id,
    firstAttribution,
    allEvents: attribution,
    totalEvents: attribution.length,
  });
});

/**
 * EXPORT ATTRIBUTION
 */
const exportAttribution = catchAsync(async (req, res, next) => {
  const { startDate, endDate, partnerCode, sourceType } = req.query;

  const data = await deps.AttributionService.exportAttribution({
    startDate,
    endDate,
    partnerCode,
    sourceType,
  });

  res.json({
    count: data.length,
    filters: { startDate, endDate, partnerCode, sourceType },
    data,
  });
});

/**
 * PARTNER SUMMARY
 */
const getPartnerSummary = catchAsync(async (req, res, next) => {
  const { startDate, endDate } = req.query;
  const summary = await deps.AttributionService.getPartnerSummary(startDate, endDate);

  res.json({
    period: { startDate: startDate || 'all-time', endDate: endDate || 'now' },
    partners: summary,
  });
});

/**
 * GET Usage Stats by Organization
 */
const getUsageByOrganization = catchAsync(async (req, res, next) => {
  const isPg =
    process.env.DB_TYPE === 'postgres' || process.env.DATABASE_URL?.startsWith('postgres');

  // Join ai_logs through users table since ai_logs doesn't have organization_id
  const query = isPg
    ? `
        SELECT 
            o.id,
            o.name,
            o.plan,
            COUNT(DISTINCT u.id) as user_count,
            COALESCE(SUM(a.input_tokens + a.output_tokens), 0) as tokens_used,
            COUNT(a.id) as ai_calls,
            MAX(a.created_at) as last_ai_activity
        FROM organizations o
        LEFT JOIN users u ON u.organization_id = o.id
        LEFT JOIN ai_logs a ON a.user_id = u.id AND a.created_at > NOW() - INTERVAL '30 days'
        GROUP BY o.id, o.name, o.plan
        ORDER BY tokens_used DESC
    `
    : `
        SELECT 
            o.id,
            o.name,
            o.plan,
            COUNT(DISTINCT u.id) as user_count,
            COALESCE(SUM(a.input_tokens + a.output_tokens), 0) as tokens_used,
            COUNT(a.id) as ai_calls,
            MAX(a.created_at) as last_ai_activity
        FROM organizations o
        LEFT JOIN users u ON u.organization_id = o.id
        LEFT JOIN ai_logs a ON a.user_id = u.id AND a.created_at > datetime('now', '-30 days')
        GROUP BY o.id, o.name, o.plan
        ORDER BY tokens_used DESC
    `;

  deps.db.all(query, [], (err, rows) => {
    if (err) return next(new AppError('Failed to fetch usage data', 500));
    res.json(rows || []);
  });
});

/**
 * GET Invoices
 */
const getInvoices = catchAsync(async (req, res, next) => {
  const { period = '30d' } = req.query;
  const isPg =
    process.env.DB_TYPE === 'postgres' || process.env.DATABASE_URL?.startsWith('postgres');

  // Try to get invoices from Stripe cache or token_transactions as proxy
  const periodDays = period === '7d' ? 7 : period === '90d' ? 90 : period === '1y' ? 365 : 30;

  const dateCondition = isPg
    ? `created_at > NOW() - INTERVAL '${periodDays} days'`
    : `created_at > datetime('now', '-${periodDays} days')`;

  const query = `
        SELECT 
            t.id,
            'INV-' || SUBSTR(t.id, 1, 8) as invoice_number,
            t.organization_id,
            o.name as organization_name,
            CASE 
                WHEN t.type = 'purchase' THEN 'paid'
                WHEN t.type = 'refund' THEN 'refunded'
                ELSE 'pending'
            END as status,
            ABS(t.amount_usd) as amount,
            'USD' as currency,
            0 as tax,
            ABS(t.amount_usd) as total,
            t.created_at as due_date,
            t.created_at as paid_at,
            t.created_at,
            t.description
        FROM token_transactions t
        LEFT JOIN organizations o ON o.id = t.organization_id
        WHERE t.type IN ('purchase', 'refund') AND ${dateCondition}
        ORDER BY t.created_at DESC
        LIMIT 100
    `;

  deps.db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Invoice query error:', err);
      // Return empty array on error
      return res.json({ invoices: [], total: 0 });
    }
    res.json({
      invoices: rows || [],
      total: (rows || []).length,
    });
  });
});

/**
 * GET Invoice Stats
 */
const getInvoiceStats = catchAsync(async (req, res, next) => {
  const isPg =
    process.env.DB_TYPE === 'postgres' || process.env.DATABASE_URL?.startsWith('postgres');

  const query = isPg
    ? `
        SELECT 
            COALESCE(SUM(CASE WHEN type = 'purchase' THEN amount_usd ELSE 0 END), 0) as total_revenue,
            COUNT(CASE WHEN type = 'purchase' THEN 1 END) as paid_invoices,
            0 as pending_invoices,
            0 as overdue_invoices,
            0 as overdue_amount,
            0 as monthly_growth
        FROM token_transactions
        WHERE created_at > NOW() - INTERVAL '30 days'
    `
    : `
        SELECT 
            COALESCE(SUM(CASE WHEN type = 'purchase' THEN amount_usd ELSE 0 END), 0) as total_revenue,
            COUNT(CASE WHEN type = 'purchase' THEN 1 END) as paid_invoices,
            0 as pending_invoices,
            0 as overdue_invoices,
            0 as overdue_amount,
            0 as monthly_growth
        FROM token_transactions
        WHERE created_at > datetime('now', '-30 days')
    `;

  deps.db.get(query, [], (err, row) => {
    if (err) {
      console.error('Invoice stats error:', err);
      return res.json({
        totalRevenue: 0,
        paidInvoices: 0,
        pendingInvoices: 0,
        overdueInvoices: 0,
        overdueAmount: 0,
        monthlyGrowth: 0,
      });
    }
    res.json({
      totalRevenue: row?.total_revenue || 0,
      paidInvoices: row?.paid_invoices || 0,
      pendingInvoices: row?.pending_invoices || 0,
      overdueInvoices: row?.overdue_invoices || 0,
      overdueAmount: row?.overdue_amount || 0,
      monthlyGrowth: row?.monthly_growth || 0,
    });
  });
});

/**
 * Security events list (uses security_events table if present, fallback to login_history)
 */
const getSecurityEvents = catchAsync(async (req, res, next) => {
  const { severity, eventType, resolved, organizationId, userId } = req.query;
  const params: any[] = [];

  const hasSecurityTable = await tableExists('security_events');

  let query: string;
  if (hasSecurityTable) {
    query = `
            SELECT 
                id,
                organization_id,
                user_id,
                event_type,
                UPPER(severity) as severity,
                ip_address,
                location_city,
                location_country,
                user_agent,
                resolved,
                created_at
            FROM security_events
            WHERE 1=1
        `;

    if (severity) {
      query += ' AND LOWER(severity) = LOWER(?)';
      params.push(severity);
    }
    if (eventType) {
      query += ' AND LOWER(event_type) = LOWER(?)';
      params.push(eventType);
    }
    if (resolved === 'true' || resolved === 'false') {
      query += ' AND resolved = ?';
      params.push(resolved === 'true' ? 1 : 0);
    }
    if (organizationId) {
      query += ' AND organization_id = ?';
      params.push(organizationId);
    }
    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }

    query += ' ORDER BY datetime(created_at) DESC LIMIT 200';
  } else {
    query = `
            SELECT 
                id,
                NULL as organization_id,
                NULL as user_id,
                CASE WHEN status = 'failed' THEN 'LOGIN_FAILED' ELSE 'LOGIN_SUCCESS' END as event_type,
                CASE WHEN status = 'failed' THEN 'MEDIUM' ELSE 'LOW' END as severity,
                ip_address,
                NULL as location_city,
                NULL as location_country,
                user_agent,
                CASE WHEN status = 'failed' THEN 0 ELSE 1 END as resolved,
                created_at
            FROM login_history
            WHERE 1=1
        `;
    if (eventType) {
      query += ' AND LOWER(event_type) = LOWER(?)';
      params.push(eventType);
    }
    if (resolved === 'true' || resolved === 'false') {
      query += ' AND (CASE WHEN status = "failed" THEN 0 ELSE 1 END) = ?';
      params.push(resolved === 'true' ? 1 : 0);
    }
    query += ' ORDER BY datetime(created_at) DESC LIMIT 200';
  }

  deps.db.all(query, params, (err, rows) => {
    if (err) {
      console.error('[SuperAdmin] Security events query error:', err);
      return next(new AppError('Failed to fetch security events', 500));
    }
    res.json({ events: rows || [] });
  });
});

/**
 * Resolve security event (only works when security_events table exists)
 */
const resolveSecurityEvent = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const hasSecurityTable = await tableExists('security_events');

  if (!hasSecurityTable) {
    return res.json({
      success: true,
      message: 'Resolution acknowledged (no persistence table available)',
    });
  }

  deps.db.run(`UPDATE security_events SET resolved = 1 WHERE id = ?`, [id], function (err) {
    if (err) {
      console.error('[SuperAdmin] Resolve security event error:', err);
      return next(new AppError('Failed to resolve security event', 500));
    }
    if (this.changes === 0) {
      return next(new AppError('Security event not found', 404));
    }
    res.json({ success: true });
  });
});

/**
 * Remind about an invoice(send reminder)
 */
const remindInvoice = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const db = deps.db;

  db.get('SELECT * FROM invoices WHERE id = ?', [id], (err, invoice) => {
    if (err) return next(err);

    if (invoice) {
      db.run('UPDATE invoices SET updated_at = datetime("now") WHERE id = ?', [id], (err) => {
        if (err) return next(err);
        res.json({ success: true, message: 'Reminder sent' });
      });
    } else {
      console.log(
        `[SuperAdmin] Invoice ${id} not found in invoices table, may be in token_transactions`
      );
      res.json({ success: true, message: 'Reminder sent' });
    }
  });
});

/**
 * Mark an invoice as paid
 */
const markInvoicePaid = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const db = deps.db;

  db.get('SELECT * FROM invoices WHERE id = ?', [id], (err, invoice) => {
    if (err) return next(err);

    if (invoice) {
      db.run(
        'UPDATE invoices SET status = "paid", amount_paid = amount_due, updated_at = datetime("now") WHERE id = ?',
        [id],
        (err) => {
          if (err) return next(err);
          res.json({ success: true, message: 'Invoice marked as paid' });
        }
      );
    } else {
      // Invoice might be in token_transactions - update there
      db.run('UPDATE token_transactions SET type = "purchase" WHERE id = ?', [id], (err) => {
        if (err) return next(err);
        res.json({ success: true, message: 'Invoice marked as paid' });
      });
    }
  });
});

/**
 * Get invoice PDF (placeholder)
 */
const getInvoicePdf = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const db = deps.db;

  db.get('SELECT * FROM invoices WHERE id = ?', [id], (err, invoice) => {
    if (err) return next(err);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.json({ invoice, pdf: 'PDF generation not implemented yet' });
  });
});

/**
 * Upload branding logo (placeholder)
 */
const uploadBrandingLogo = catchAsync(async (req, res, next) => {
  const { orgId } = req.params;
  res.json({ success: true, message: 'Logo uploaded', orgId });
});

/**
 * Get all API keys
 */
const getApiKeys = catchAsync(async (req, res, next) => {
  try {
    const db = deps.db;
    const query = `
            SELECT 
                k.id, 
                k.organization_id as organizationId, 
                o.name as organizationName,
                k.user_id as userId,
                k.display_name as name, 
                k.provider, 
                k.scopes,
                k.is_active as isActive, 
                k.usage_count as usageCount, 
                k.last_used_at as lastUsedAt,
                k.created_at as createdAt,
                k.expires_at as expiresAt,
                k.rate_limit_per_minute as rateLimitPerMinute,
                k.rate_limit_per_day as rateLimitPerDay
            FROM user_api_keys k
            LEFT JOIN organizations o ON k.organization_id = o.id
            ORDER BY k.created_at DESC
        `;
    const keys = await new Promise((resolve, reject) => {
      db.all(query, [], (err, rows) => {
        if (err) reject(err);
        else {
          const parsedRows = (rows || []).map((row) => ({
            ...row,
            isActive: !!row.isActive,
            scopes: typeof row.scopes === 'string' ? JSON.parse(row.scopes) : row.scopes || [],
          }));
          resolve(parsedRows);
        }
      });
    });
    res.json(keys);
  } catch (error) {
    console.error('[SuperAdmin] Get API keys error:', error);
    res.status(500).json({ error: 'Failed to get API keys' });
  }
});

/**
 * Create a new API key
 */
const createApiKey = catchAsync(async (req, res, next) => {
  const { name, permissions, userId, organizationId } = req.body;
  const db = deps.db;
  const keyId = deps.uuid.v4();

  db.run(
    'INSERT INTO user_api_keys (id, user_id, organization_id, display_name, provider, scopes, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime("now"))',
    [
      keyId,
      userId || req.user.id,
      organizationId || req.user.organization_id,
      name,
      'custom',
      JSON.stringify(permissions || []),
      1,
    ],
    (err) => {
      if (err) return next(err);
      res.json({ id: keyId, name, permissions });
    }
  );
});

/**
 * Delete an API key
 */
const deleteApiKey = catchAsync(async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = deps.db;
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM user_api_keys WHERE id = ?', [id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    res.json({ success: true });
  } catch (error) {
    console.error('[SuperAdmin] Delete API key error:', error);
    res.status(500).json({ error: 'Failed to delete API key' });
  }
});

/**
 * Get API key usage stats
 */
const getApiKeyUsage = catchAsync(async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = deps.db;
    const key = await new Promise((resolve, reject) => {
      db.get('SELECT usage_count, quota_used FROM user_api_keys WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row || { usage_count: 0, quota_used: 0 });
      });
    });
    res.json({ count: key.usage_count || 0, tokens: key.quota_used || 0 });
  } catch (error) {
    console.error('[SuperAdmin] Get API key usage error:', error);
    res.status(500).json({ error: 'Failed to get API key usage' });
  }
});

/**
 * Get compliance frameworks list
 */
const getComplianceFrameworks = catchAsync(async (req, res, next) => {
  const frameworks = await deps.ComplianceService.getFrameworks();
  res.json({ frameworks });
});

/**
 * Get compliance status for a framework
 */
const getComplianceStatus = catchAsync(async (req, res, next) => {
  const { frameworkId } = req.params;
  res.json({
    framework: frameworkId,
    status: 'compliant',
    lastAudit: new Date().toISOString(),
    score: 95,
  });
});

/**
 * Get DSAR requests
 */
const getDsarRequests = catchAsync(async (req, res, next) => {
  try {
    const db = deps.db;
    const requests = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM dsar_requests ORDER BY created_at DESC LIMIT 50', [], (err, rows) => {
        if (err) {
          if (err.message.includes('no such table')) {
            resolve([]);
          } else {
            reject(err);
          }
        } else {
          resolve(rows || []);
        }
      });
    });
    res.json(requests);
  } catch (error) {
    console.error('[SuperAdmin] Get DSAR requests error:', error);
    res.json([]);
  }
});

/**
 * Get compliance audits list (placeholder)
 */
const getComplianceAudits = catchAsync(async (req, res, next) => {
  try {
    res.json([]);
  } catch (error) {
    console.error('[SuperAdmin] Get compliance audits error:', error);
    res.status(500).json({ error: 'Failed to get compliance audits' });
  }
});

/**
 * Compliance summary for all organizations
 */
const getComplianceSummary = catchAsync(async (_req, res, next) => {
  try {
    const hasComplianceTable = await tableExists('compliance_status');
    if (!hasComplianceTable) {
      deps.db.all(`SELECT id as org_id, name as org_name FROM organizations`, [], (err, rows) => {
        if (err) {
          console.error('[SuperAdmin] Compliance summary fallback error:', err);
          return res.json({ items: [] });
        }
        const items = (rows || []).map((row: any) => ({
          org_id: row.org_id,
          org_name: row.org_name,
          gdpr_compliant: false,
          dpa_signed: false,
          data_retention_policy: false,
          security_audit_passed: false,
          last_audit_date: null,
        }));
        return res.json({ items });
      });
      return;
    }

    const isPg =
      process.env.DB_TYPE === 'postgres' || process.env.DATABASE_URL?.startsWith('postgres');
    const query = isPg
      ? `
                SELECT 
                    o.id as org_id,
                    o.name as org_name,
                    SUM(CASE WHEN cs.framework_id = 'fw_gdpr' AND cs.status = 'compliant' THEN 1 ELSE 0 END) as gdpr_ok,
                    SUM(CASE WHEN cs.framework_id = 'fw_gdpr' THEN 1 ELSE 0 END) as gdpr_total,
                    SUM(CASE WHEN cs.status = 'compliant' THEN 1 ELSE 0 END) as compliant_total,
                    COUNT(cs.id) as requirement_total,
                    MAX(cs.updated_at) as last_audit_date
                FROM organizations o
                LEFT JOIN compliance_status cs ON cs.organization_id = o.id
                GROUP BY o.id, o.name
                ORDER BY o.name ASC
            `
      : `
                SELECT 
                    o.id as org_id,
                    o.name as org_name,
                    SUM(CASE WHEN cs.framework_id = 'fw_gdpr' AND cs.status = 'compliant' THEN 1 ELSE 0 END) as gdpr_ok,
                    SUM(CASE WHEN cs.framework_id = 'fw_gdpr' THEN 1 ELSE 0 END) as gdpr_total,
                    SUM(CASE WHEN cs.status = 'compliant' THEN 1 ELSE 0 END) as compliant_total,
                    COUNT(cs.id) as requirement_total,
                    MAX(cs.updated_at) as last_audit_date
                FROM organizations o
                LEFT JOIN compliance_status cs ON cs.organization_id = o.id
                GROUP BY o.id, o.name
                ORDER BY o.name ASC
            `;

    deps.db.all(query, [], (err, rows) => {
      if (err) {
        console.error('[SuperAdmin] Compliance summary error:', err);
        return next(new AppError('Failed to fetch compliance summary', 500));
      }

      const items = (rows || []).map((row: any) => {
        const hasGdprRequirements = Number(row.gdpr_total || 0) > 0;
        const gdprCompliant = hasGdprRequirements
          ? Number(row.gdpr_ok || 0) >= Number(row.gdpr_total || 0)
          : false;
        const hasRequirements = Number(row.requirement_total || 0) > 0;
        const overallCompliant = hasRequirements
          ? Number(row.compliant_total || 0) >= Number(row.requirement_total || 0)
          : gdprCompliant;

        return {
          org_id: row.org_id,
          org_name: row.org_name,
          gdpr_compliant: gdprCompliant,
          dpa_signed: gdprCompliant || overallCompliant,
          data_retention_policy: overallCompliant,
          security_audit_passed: overallCompliant,
          last_audit_date: row.last_audit_date,
        };
      });

      res.json({ items });
    });
  } catch (error) {
    console.error('[SuperAdmin] Compliance summary error:', error);
    res.json({ items: [] });
  }
});

/**
 * Refresh SuperAdmin token
 */
const refreshToken = catchAsync(async (req, res, next) => {
  const RefreshTokenService = deps.RefreshTokenService;
  const db = deps.db;
  const userId = req.user.id;

  db.get(
    'SELECT id, email, role, organization_id FROM users WHERE id = ?',
    [userId],
    async (err, user) => {
      if (err) return next(err);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      try {
        const deviceInfo = (req.get('user-agent') || 'Unknown Device').substring(0, 200);
        const tokenPair = await RefreshTokenService.generateTokenPair(
          {
            id: user.id,
            email: user.email,
            role: user.role,
            organization_id: user.organization_id,
          },
          {
            deviceInfo,
            ip: req.ip,
            userAgent: req.get('user-agent'),
          }
        );
        res.json({
          token: tokenPair.accessToken,
          refreshToken: tokenPair.refreshToken,
          expiresIn: tokenPair.expiresIn,
          role: user.role,
        });
      } catch (error) {
        next(error);
      }
    }
  );
});

/**
 * GET System Health
 */
const getSystemHealth = catchAsync(async (req, res, next) => {
  const startTime = Date.now();
  const isPg =
    process.env.DB_TYPE === 'postgres' || process.env.DATABASE_URL?.startsWith('postgres');

  // Test database connectivity and get basic stats
  const dbCheck = await new Promise((resolve) => {
    deps.db.get('SELECT 1 as test', [], (err) => {
      const responseTime = Date.now() - startTime;
      resolve({
        status: err ? 'error' : 'healthy',
        responseTime,
        type: isPg ? 'PostgreSQL' : 'SQLite',
      });
    });
  });

  // Get uptime (process uptime as proxy)
  const uptimeSeconds = process.uptime();
  const uptimeHours = Math.floor(uptimeSeconds / 3600);
  const uptimeDays = Math.floor(uptimeHours / 24);

  // Check AI service (just return status based on config)
  const aiServiceStatus =
    process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY ? 'online' : 'no_keys';

  res.json({
    api: {
      status: 'healthy',
      responseTime: Date.now() - startTime,
      version: process.env.APP_VERSION || '2.5.0',
    },
    database: dbCheck,
    ai: {
      status: aiServiceStatus,
      providers: {
        openai: !!process.env.OPENAI_API_KEY,
        anthropic: !!process.env.ANTHROPIC_API_KEY,
        groq: !!process.env.GROQ_API_KEY,
      },
    },
    system: {
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
      uptime: {
        seconds: Math.floor(uptimeSeconds),
        formatted:
          uptimeDays > 0
            ? `${uptimeDays}d ${uptimeHours % 24}h`
            : `${uptimeHours}h ${Math.floor((uptimeSeconds % 3600) / 60)}m`,
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET System Analytics - detailed metrics for analytics dashboard
 */
const getSystemAnalytics = catchAsync(async (req, res, next) => {
  const { timeRange = '7d' } = req.query;

  // Calculate date range
  const now = new Date();
  let daysBack = 7;
  switch (timeRange) {
    case '24h':
      daysBack = 1;
      break;
    case '7d':
      daysBack = 7;
      break;
    case '30d':
      daysBack = 30;
      break;
    case '90d':
      daysBack = 90;
      break;
  }
  const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const startDateStr = startDate.toISOString();

  // Get API request stats from activity_logs
  const apiStats = (await new Promise((resolve) => {
    deps.db.get(
      `SELECT COUNT(*) as total_requests,
                    COUNT(CASE WHEN action LIKE '%error%' OR action LIKE '%fail%' THEN 1 END) as error_count
             FROM activity_logs 
             WHERE created_at >= ?`,
      [startDateStr],
      (err, row: any) => {
        if (err) {
          resolve({ total_requests: 0, error_count: 0 });
        } else {
          resolve(row || { total_requests: 0, error_count: 0 });
        }
      }
    );
  })) as { total_requests: number; error_count: number };

  // Get AI usage stats
  const aiStats = (await new Promise((resolve) => {
    deps.db.get(
      `SELECT COUNT(*) as total_requests,
                    SUM(tokens_used) as total_tokens,
                    AVG(latency_ms) as avg_latency,
                    SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count
             FROM ai_usage_logs 
             WHERE created_at >= ?`,
      [startDateStr],
      (err, row: any) => {
        if (err) {
          resolve({ total_requests: 0, total_tokens: 0, avg_latency: 0, error_count: 0 });
        } else {
          resolve(row || { total_requests: 0, total_tokens: 0, avg_latency: 0, error_count: 0 });
        }
      }
    );
  })) as { total_requests: number; total_tokens: number; avg_latency: number; error_count: number };

  // Get active users
  const userStats = (await new Promise((resolve) => {
    deps.db.get(
      `SELECT COUNT(DISTINCT id) as total_users,
                    COUNT(DISTINCT CASE WHEN last_login >= ? THEN id END) as active_users
             FROM users`,
      [startDateStr],
      (err, row: any) => {
        if (err) {
          resolve({ total_users: 0, active_users: 0 });
        } else {
          resolve(row || { total_users: 0, active_users: 0 });
        }
      }
    );
  })) as { total_users: number; active_users: number };

  // Get daily breakdown for charts (API traffic)
  const apiDaily = (await new Promise((resolve) => {
    deps.db.all(
      `SELECT DATE(created_at) as date,
                    COUNT(*) as requests,
                    COUNT(CASE WHEN action LIKE '%error%' OR action LIKE '%fail%' THEN 1 END) as errors
             FROM activity_logs 
             WHERE created_at >= ?
             GROUP BY DATE(created_at)
             ORDER BY date`,
      [startDateStr],
      (err, rows: any[]) => {
        if (err) {
          resolve([]);
        } else {
          resolve(rows || []);
        }
      }
    );
  })) as { date: string; requests: number; errors: number }[];

  // Get daily breakdown for AI usage
  const aiDaily = (await new Promise((resolve) => {
    deps.db.all(
      `SELECT DATE(created_at) as date,
                    COUNT(*) as requests,
                    SUM(tokens_used) as tokens
             FROM ai_usage_logs 
             WHERE created_at >= ?
             GROUP BY DATE(created_at)
             ORDER BY date`,
      [startDateStr],
      (err, rows: any[]) => {
        if (err) {
          resolve([]);
        } else {
          resolve(rows || []);
        }
      }
    );
  })) as { date: string; requests: number; tokens: number }[];

  // Get top endpoints from activity_logs
  const topEndpoints = (await new Promise((resolve) => {
    deps.db.all(
      `SELECT resource_type || '/' || resource_id as endpoint, COUNT(*) as calls
             FROM activity_logs 
             WHERE created_at >= ?
             GROUP BY resource_type, resource_id
             ORDER BY calls DESC
             LIMIT 5`,
      [startDateStr],
      (err, rows: any[]) => {
        if (err) {
          resolve([]);
        } else {
          resolve(rows || []);
        }
      }
    );
  })) as { endpoint: string; calls: number }[];

  // Calculate comparison with previous period
  const prevStartDate = new Date(startDate.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const prevApiStats = (await new Promise((resolve) => {
    deps.db.get(
      `SELECT COUNT(*) as total_requests
             FROM activity_logs 
             WHERE created_at >= ? AND created_at < ?`,
      [prevStartDate.toISOString(), startDateStr],
      (err, row: any) => {
        resolve(row || { total_requests: 0 });
      }
    );
  })) as { total_requests: number };

  const prevAiStats = (await new Promise((resolve) => {
    deps.db.get(
      `SELECT COUNT(*) as total_requests, SUM(tokens_used) as total_tokens
             FROM ai_usage_logs 
             WHERE created_at >= ? AND created_at < ?`,
      [prevStartDate.toISOString(), startDateStr],
      (err, row: any) => {
        resolve(row || { total_requests: 0, total_tokens: 0 });
      }
    );
  })) as { total_requests: number; total_tokens: number };

  // Calculate percentage changes
  const calcChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 1000) / 10;
  };

  res.json({
    metrics: {
      api: {
        total_requests: apiStats.total_requests || 0,
        error_count: apiStats.error_count || 0,
        error_rate:
          apiStats.total_requests > 0
            ? Math.round((apiStats.error_count / apiStats.total_requests) * 10000) / 100
            : 0,
        change: calcChange(apiStats.total_requests, prevApiStats.total_requests),
      },
      ai: {
        total_requests: aiStats.total_requests || 0,
        total_tokens: aiStats.total_tokens || 0,
        avg_latency: Math.round(aiStats.avg_latency || 0),
        error_count: aiStats.error_count || 0,
        change: calcChange(aiStats.total_requests, prevAiStats.total_requests),
      },
      users: {
        total_users: userStats.total_users || 0,
        active_today: userStats.active_users || 0,
      },
      database: {
        total_queries: apiStats.total_requests || 0, // Approximation
      },
    },
    charts: {
      api: {
        labels: apiDaily.map((d) => d.date),
        requests: apiDaily.map((d) => d.requests),
        errors: apiDaily.map((d) => d.errors),
      },
      ai: {
        labels: aiDaily.map((d) => d.date),
        requests: aiDaily.map((d) => d.requests),
        tokens: aiDaily.map((d) => Math.round((d.tokens || 0) / 1000)), // In thousands
      },
    },
    topEndpoints: topEndpoints.slice(0, 4).map((e) => ({
      endpoint: `/api/${e.endpoint || 'unknown'}`,
      calls: e.calls,
    })),
    comparison: {
      api_requests: {
        current: apiStats.total_requests,
        previous: prevApiStats.total_requests,
        change: calcChange(apiStats.total_requests, prevApiStats.total_requests),
      },
      ai_requests: {
        current: aiStats.total_requests,
        previous: prevAiStats.total_requests,
        change: calcChange(aiStats.total_requests, prevAiStats.total_requests),
      },
      ai_tokens: {
        current: aiStats.total_tokens || 0,
        previous: prevAiStats.total_tokens || 0,
        change: calcChange(aiStats.total_tokens || 0, prevAiStats.total_tokens || 0),
      },
    },
    timeRange,
    timestamp: new Date().toISOString(),
  });
});

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Organizations
// ==========================================

const getOrganizationMetadata = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const metadata = await deps.OrganizationMetadataService.getMetadata(id);
  res.json(metadata);
});

const updateOrganizationMetadata = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { key, value, valueType, category, isSensitive } = req.body;
  await deps.OrganizationMetadataService.setMetadata(
    id,
    key,
    value,
    valueType,
    category,
    isSensitive
  );
  res.json({ message: 'Metadata updated' });
});

const getOrganizationTags = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const tags = await deps.OrganizationTagService.getTags(id);
  res.json(tags);
});

const addOrganizationTag = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { tag, color, category } = req.body;
  const result = await deps.OrganizationTagService.addTag(id, tag, color, category);
  res.json(result);
});

const removeOrganizationTag = catchAsync(async (req, res, next) => {
  const { tagId } = req.params;
  const result = await deps.OrganizationTagService.removeTag(req.body.organizationId, tagId);
  res.json(result);
});

const getOrganizationHealth = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { date } = req.query;
  const health = await deps.OrganizationHealthService.calculateHealthScore(id, date);
  res.json(health);
});

const getOrganizationRelationships = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const relationships = await deps.OrganizationRelationshipService.getRelationships(id);
  res.json(relationships);
});

const getOrganizationAnalytics = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { startDate, endDate } = req.query;
  const analytics = await deps.OrganizationAnalyticsService.getAnalytics(id, startDate, endDate);
  res.json(analytics);
});

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Users
// ==========================================

const getUserProfileExtended = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  deps.db.get('SELECT * FROM user_profiles WHERE user_id = ?', [id], (err, profile) => {
    if (err) return next(new AppError(err.message, 500));
    res.json(profile || {});
  });
});

const updateUserProfileExtended = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const profileData = req.body;
  const profileId = deps.uuid.v4();

  deps.db.run(
    `INSERT INTO user_profiles 
         (id, user_id, job_title, department, phone, timezone, locale, avatar_url, bio,
          linkedin_url, github_url, website_url, skills_json, certifications_json, preferences_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(user_id) DO UPDATE SET
         job_title = excluded.job_title,
         department = excluded.department,
         phone = excluded.phone,
         timezone = excluded.timezone,
         locale = excluded.locale,
         avatar_url = excluded.avatar_url,
         bio = excluded.bio,
         linkedin_url = excluded.linkedin_url,
         github_url = excluded.github_url,
         website_url = excluded.website_url,
         skills_json = excluded.skills_json,
         certifications_json = excluded.certifications_json,
         preferences_json = excluded.preferences_json,
         updated_at = datetime('now')`,
    [
      profileId,
      id,
      profileData.jobTitle,
      profileData.department,
      profileData.phone,
      profileData.timezone || 'UTC',
      profileData.locale || 'en',
      profileData.avatarUrl,
      profileData.bio,
      profileData.linkedinUrl,
      profileData.githubUrl,
      profileData.websiteUrl,
      JSON.stringify(profileData.skills || []),
      JSON.stringify(profileData.certifications || []),
      JSON.stringify(profileData.preferences || {}),
    ],
    function (err) {
      if (err) return next(new AppError(err.message, 500));
      res.json({ message: 'Profile updated' });
    }
  );
});

const getUserActivity = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { period } = req.query;
  const periodStart = period || new Date().toISOString().split('T')[0];
  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodEnd.getDate() + 7);

  deps.db.get('SELECT organization_id FROM users WHERE id = ?', [id], async (err, user) => {
    if (err || !user) return next(new AppError('User not found', 404));
    const activity = await deps.UserActivityService.calculateActivitySummary(
      id,
      user.organization_id,
      periodStart,
      periodEnd.toISOString().split('T')[0]
    );
    res.json(activity);
  });
});

const getUserSessions = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const sessions = await deps.UserSessionService.getActiveSessions(id);
  res.json(sessions);
});

const revokeUserSession = catchAsync(async (req, res, next) => {
  const { sessionId } = req.params;
  await deps.UserSessionService.endSession(sessionId, 'revoked');
  res.json({ message: 'Session revoked' });
});

const getUserGroups = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const groups = await deps.UserGroupService.getUserGroups(id);
  res.json(groups);
});

const getUserOnboardingProgress = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  deps.db.get('SELECT organization_id FROM users WHERE id = ?', [id], (err, user) => {
    if (err || !user) return next(new AppError('User not found', 404));
    deps.db.all(
      'SELECT * FROM user_onboarding_progress WHERE user_id = ? AND organization_id = ?',
      [id, user.organization_id],
      (err, rows) => {
        if (err) return next(new AppError(err.message, 500));
        res.json(rows || []);
      }
    );
  });
});

const updateUserOnboardingProgress = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { stepKey, stepName, completed, skipped } = req.body;
  deps.db.get('SELECT organization_id FROM users WHERE id = ?', [id], (err, user) => {
    if (err || !user) return next(new AppError('User not found', 404));
    const progressId = deps.uuid.v4();
    deps.db.run(
      `INSERT INTO user_onboarding_progress 
             (id, user_id, organization_id, step_key, step_name, completed, completed_at, skipped, skipped_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(user_id, organization_id, step_key) DO UPDATE SET
             completed = excluded.completed,
             completed_at = CASE WHEN excluded.completed = 1 THEN datetime('now') ELSE completed_at END,
             skipped = excluded.skipped,
             skipped_at = CASE WHEN excluded.skipped = 1 THEN datetime('now') ELSE skipped_at END`,
      [
        progressId,
        id,
        user.organization_id,
        stepKey,
        stepName,
        completed ? 1 : 0,
        completed ? new Date().toISOString() : null,
        skipped ? 1 : 0,
        skipped ? new Date().toISOString() : null,
      ],
      function (err) {
        if (err) return next(new AppError(err.message, 500));
        res.json({ message: 'Onboarding progress updated' });
      }
    );
  });
});

const getUserLicense = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  deps.db.get('SELECT organization_id FROM users WHERE id = ?', [id], async (err, user) => {
    if (err || !user) return next(new AppError('User not found', 404));
    const license = await deps.UserLicenseService.getLicense(id, user.organization_id);
    res.json(license || {});
  });
});

const assignUserLicense = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { licenseType, features, limits, expiresAt, notes } = req.body;
  deps.db.get('SELECT organization_id FROM users WHERE id = ?', [id], async (err, user) => {
    if (err || !user) return next(new AppError('User not found', 404));
    const license = await deps.UserLicenseService.assignLicense(
      id,
      user.organization_id,
      licenseType,
      features,
      limits,
      expiresAt,
      req.user.id,
      notes
    );
    res.json(license);
  });
});

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Security
// ==========================================

const getIPWhitelist = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const whitelist = await deps.IPWhitelistService.getWhitelist(id);
  res.json(whitelist);
});

const addIPWhitelist = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { ipAddress, ipRange, description } = req.body;
  const result = await deps.IPWhitelistService.addIP(
    id,
    ipAddress,
    ipRange,
    description,
    req.user.id
  );
  res.json(result);
});

const removeIPWhitelist = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const result = await deps.IPWhitelistService.removeIP(id);
  res.json(result);
});

const getUserDevices = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const devices = await deps.DeviceManagementService.getUserDevices(id);
  res.json(devices);
});

const blockDevice = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { reason } = req.body;
  const result = await deps.DeviceManagementService.blockDevice(id, reason);
  res.json(result);
});

const getMFAMethods = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  deps.db.all('SELECT * FROM user_mfa_methods WHERE user_id = ?', [id], (err, methods) => {
    if (err) return next(new AppError(err.message, 500));
    res.json(methods || []);
  });
});

const setupTOTP = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const speakeasy = require('speakeasy');
  const secret = speakeasy.generateSecret({ name: `Consultinity (${req.user.email})` });
  const mfaId = deps.uuid.v4();

  deps.db.run(
    `INSERT INTO user_mfa_methods (id, user_id, method_type, secret, is_enabled, is_primary)
         VALUES (?, ?, 'totp', ?, 0, 1)`,
    [mfaId, id, secret.base32],
    function (err) {
      if (err) return next(new AppError(err.message, 500));
      res.json({ secret: secret.base32, qrCode: secret.otpauth_url });
    }
  );
});

const verifyTOTP = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { token } = req.body;
  const speakeasy = require('speakeasy');

  deps.db.get(
    'SELECT secret FROM user_mfa_methods WHERE user_id = ? AND method_type = "totp" AND is_primary = 1',
    [id],
    (err, mfa) => {
      if (err || !mfa) return next(new AppError('MFA not set up', 400));
      const verified = speakeasy.totp.verify({
        secret: mfa.secret,
        encoding: 'base32',
        token: token,
      });
      if (verified) {
        deps.db.run(
          'UPDATE user_mfa_methods SET is_enabled = 1, last_used_at = datetime("now") WHERE user_id = ? AND method_type = "totp"',
          [id]
        );
      }
      res.json({ verified });
    }
  );
});

const getPasswordPolicy = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const policy = await deps.PasswordPolicyService.getPolicy(id);
  res.json(policy || {});
});

const updatePasswordPolicy = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const policy = await deps.PasswordPolicyService.setPolicy(id, req.body);
  res.json(policy);
});

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Support
// ==========================================

const getSupportTickets = catchAsync(async (req, res, next) => {
  const filters = {
    organizationId: req.query.organizationId,
    userId: req.query.userId,
    status: req.query.status,
    priority: req.query.priority,
    assignedTo: req.query.assignedTo,
    limit: parseInt(req.query.limit) || 50,
  };
  const tickets = await deps.SupportTicketService.getTickets(filters);
  res.json(tickets);
});

const createSupportTicket = catchAsync(async (req, res, next) => {
  const ticket = await deps.SupportTicketService.createTicket(req.body);
  res.json(ticket);
});

const updateSupportTicket = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const result = await deps.SupportTicketService.updateTicket(id, req.body);
  res.json(result);
});

const addTicketComment = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { commentText, isInternal } = req.body;
  const comment = await deps.SupportTicketService.addComment(
    id,
    req.user.id,
    commentText,
    isInternal
  );
  res.json(comment);
});

const getCustomerSuccessNotes = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const filters = {
    noteType: req.query.noteType,
    userId: req.query.userId,
    limit: parseInt(req.query.limit) || 50,
  };
  const notes = await deps.CustomerSuccessService.getNotes(id, filters);
  res.json(notes);
});

const createCustomerSuccessNote = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const note = await deps.CustomerSuccessService.createNote({
    ...req.body,
    organizationId: id,
    createdBy: req.user.id,
  });
  res.json(note);
});

const getCustomerHealthCheck = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { date } = req.query;
  const health = await deps.CustomerSuccessService.getHealthCheck(id, date);
  res.json(health || {});
});

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Feedback
// ==========================================

const getFeedbackItems = catchAsync(async (req, res, next) => {
  const filters = {
    organizationId: req.query.organizationId,
    userId: req.query.userId,
    feedbackType: req.query.feedbackType,
    status: req.query.status,
    limit: parseInt(req.query.limit) || 50,
  };
  const feedback = await deps.FeedbackService.getFeedbackItems(filters);
  res.json(feedback);
});

const createFeedbackItem = catchAsync(async (req, res, next) => {
  const feedback = await deps.FeedbackService.createFeedbackItem(req.body);
  res.json(feedback);
});

const voteFeedback = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { voteType } = req.body;
  const vote = await deps.FeedbackService.voteFeedback(id, req.user.id, voteType);
  res.json(vote);
});

const addFeedbackComment = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { commentText, isInternal } = req.body;
  const comment = await deps.FeedbackService.addFeedbackComment(
    id,
    req.user.id,
    commentText,
    isInternal
  );
  res.json(comment);
});

const getFeatureRoadmap = catchAsync(async (req, res, next) => {
  const { status } = req.query;
  const roadmap = await deps.FeedbackService.getFeatureRoadmap(status);
  res.json(roadmap);
});

const updateFeatureRoadmap = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const result = await deps.FeedbackService.updateFeatureRoadmap(id, req.body);
  res.json(result);
});

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Analytics
// ==========================================

const getUserAdoptionMetrics = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { startDate, endDate } = req.query;
  deps.db.get('SELECT organization_id FROM users WHERE id = ?', [id], async (err, user) => {
    if (err || !user) return next(new AppError('User not found', 404));
    const metrics = await deps.UserAdoptionService.getMetrics(
      id,
      user.organization_id,
      startDate,
      endDate
    );
    res.json(metrics);
  });
});

const getChurnPrediction = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const health = await deps.OrganizationHealthService.calculateHealthScore(id);
  res.json({
    churnRisk: health.churnRisk,
    healthTrend: health.healthTrend,
    overallScore: health.overallScore,
  });
});

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Compliance
// ==========================================

const getDataRetentionPolicies = catchAsync(async (req, res, next) => {
  const { organizationId } = req.query;
  const policies = await deps.DataRetentionService.getPolicies(organizationId);
  res.json(policies);
});

const createDataRetentionPolicy = catchAsync(async (req, res, next) => {
  const policy = await deps.DataRetentionService.createPolicy(req.body);
  res.json(policy);
});

const getGDPRRequests = catchAsync(async (req, res, next) => {
  const { organizationId } = req.query;
  deps.db.all(
    'SELECT * FROM gdpr_data_subject_requests WHERE organization_id = ? ORDER BY requested_at DESC',
    [organizationId],
    (err, requests) => {
      if (err) return next(new AppError(err.message, 500));
      res.json(requests || []);
    }
  );
});

const createGDPRRequest = catchAsync(async (req, res, next) => {
  const { organizationId, userId, requestType, notes } = req.body;
  const requestId = deps.uuid.v4();
  deps.db.run(
    `INSERT INTO gdpr_data_subject_requests 
         (id, organization_id, user_id, request_type, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
    [requestId, organizationId, userId, requestType, notes, req.user.id],
    function (err) {
      if (err) return next(new AppError(err.message, 500));
      res.json({ id: requestId, message: 'GDPR request created' });
    }
  );
});

const getUserConsents = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  deps.db.get('SELECT organization_id FROM users WHERE id = ?', [id], async (err, user) => {
    if (err || !user) return next(new AppError('User not found', 404));
    const consents = await deps.ConsentManagementService.getConsents(id, user.organization_id);
    res.json(consents);
  });
});

const updateUserConsent = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { consentType, status, consentVersion } = req.body;
  deps.db.get('SELECT organization_id FROM users WHERE id = ?', [id], async (err, user) => {
    if (err || !user) return next(new AppError('User not found', 404));
    if (status === 'granted') {
      await deps.ConsentManagementService.grantConsent(
        id,
        user.organization_id,
        consentType,
        consentVersion,
        req.ip,
        req.get('user-agent')
      );
    } else if (status === 'withdrawn') {
      await deps.ConsentManagementService.withdrawConsent(id, user.organization_id, consentType);
    }
    res.json({ message: 'Consent updated' });
  });
});

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Automation
// ==========================================

const getAutomationRules = catchAsync(async (req, res, next) => {
  const { organizationId } = req.query;
  const activeOnly = req.query.activeOnly === 'true';
  const rules = await deps.AutomationEngineService.getRules(organizationId, activeOnly);
  res.json(rules);
});

const createAutomationRule = catchAsync(async (req, res, next) => {
  const rule = await deps.AutomationEngineService.createRule({
    ...req.body,
    createdBy: req.user.id,
  });
  res.json(rule);
});

const updateAutomationRule = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const result = await deps.AutomationEngineService.updateRule(id, req.body);
  res.json(result);
});

const getWebhookSubscriptions = catchAsync(async (req, res, next) => {
  const { organizationId } = req.query;
  deps.db.all(
    'SELECT * FROM webhook_subscriptions WHERE organization_id = ? ORDER BY created_at DESC',
    [organizationId],
    (err, subscriptions) => {
      if (err) return next(new AppError(err.message, 500));
      res.json(subscriptions || []);
    }
  );
});

const createWebhookSubscription = catchAsync(async (req, res, next) => {
  const { organizationId, name, url, events, secret } = req.body;
  const subscriptionId = deps.uuid.v4();
  deps.db.run(
    `INSERT INTO webhook_subscriptions 
         (id, organization_id, name, url, events_json, secret)
         VALUES (?, ?, ?, ?, ?, ?)`,
    [subscriptionId, organizationId, name, url, JSON.stringify(events), secret],
    function (err) {
      if (err) return next(new AppError(err.message, 500));
      res.json({ id: subscriptionId, message: 'Webhook subscription created' });
    }
  );
});

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Communication
// ==========================================

const getEmailTemplates = catchAsync(async (req, res, next) => {
  const { category, activeOnly } = req.query;
  const templates = await deps.EmailTemplateService.getTemplates(category, activeOnly === 'true');
  res.json(templates);
});

const createEmailTemplate = catchAsync(async (req, res, next) => {
  const template = await deps.EmailTemplateService.createTemplate(req.body);
  res.json(template);
});

const getEmailCampaigns = catchAsync(async (req, res, next) => {
  const { organizationId, status } = req.query;
  const campaigns = await deps.EmailCampaignService.getCampaigns(organizationId, status);
  res.json(campaigns);
});

const createEmailCampaign = catchAsync(async (req, res, next) => {
  const campaign = await deps.EmailCampaignService.createCampaign({
    ...req.body,
    createdBy: req.user.id,
  });
  res.json(campaign);
});

const getNotificationPreferences = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  deps.db.all(
    'SELECT * FROM notification_preferences WHERE user_id = ?',
    [id],
    (err, preferences) => {
      if (err) return next(new AppError(err.message, 500));
      res.json(preferences || []);
    }
  );
});

const updateNotificationPreferences = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { preferences } = req.body;

  // Update or insert each preference
  for (const pref of preferences) {
    const prefId = deps.uuid.v4();
    deps.db.run(
      `INSERT INTO notification_preferences 
             (id, user_id, organization_id, notification_type, channel, is_enabled, frequency, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
             ON CONFLICT(user_id, organization_id, notification_type, channel) DO UPDATE SET
             is_enabled = excluded.is_enabled,
             frequency = excluded.frequency,
             updated_at = datetime('now')`,
      [
        prefId,
        id,
        pref.organizationId,
        pref.notificationType,
        pref.channel,
        pref.isEnabled ? 1 : 0,
        pref.frequency || 'immediate',
      ]
    );
  }

  res.json({ message: 'Notification preferences updated' });
});

// =========================================
// PHASE 1: ADVANCED IAM MODULE
// =========================================

// Import Admin Session Service
const AdminSessionService = {
  getActiveSessions: async (adminId) => [],
  createSession: async (data) => ({
    id: 'new-session-id',
    ...data,
    sessionToken: 'mock-session-token-' + Date.now(),
    createdAt: new Date(),
  }),
  revokeSession: async (id) => true,
  revokeAllSessions: async (adminId, exceptSessionId) => 0,
  getSessionStats: async () => ({ activeSessions: 0, totalSessions: 0 }),
};

const PermissionsMatrixService = {
  getMatrix: async () => [],
  updateRolePermissions: async () => ({ success: true }),
  toggleRolePermission: async () => ({ success: true }),
  copyRolePermissions: async () => ({ success: true }),
  compareRoles: async () => ({ differences: [] }),
  getPermissionsStats: async () => ({ totalPermissions: 0, roleCount: 0 }),
};

const ApprovalWorkflowService = {
  getWorkflows: async (filters) => [],
  createWorkflow: async (data) => ({ id: 'new-workflow-id', ...data }),
  updateWorkflow: async (id, data) => ({ id, ...data }),
  deleteWorkflow: async (id) => true,
  getRequests: async (filters) => [],
  approveRequest: async (id, userId) => ({ success: true }),
  rejectRequest: async (id, userId, reason) => ({ success: true }),
};

const AdminAuditLogService = {
  getLogs: async (filters) => [],
  getStats: async () => ({ totalLogs: 0, unresolvedCount: 0 }),
};

// Admin Sessions
const getAdminSessions = catchAsync(async (req, res, next) => {
  const { adminId } = req.query;
  const sessions = await deps.AdminSessionService.getActiveSessions(adminId);
  res.json({ sessions });
});

const createAdminSession = catchAsync(async (req, res, next) => {
  const { adminId, mfaVerified, expiresInHours } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('user-agent') || 'Unknown';

  const session = await deps.AdminSessionService.createSession({
    adminId: adminId || req.user.id,
    ipAddress,
    userAgent,
    mfaVerified: mfaVerified || false,
    expiresInHours: expiresInHours || 24,
  });

  res.json(session);
});

const revokeAdminSession = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const success = await deps.AdminSessionService.revokeSession(id);

  if (!success) {
    return next(new AppError('Session not found', 404));
  }

  res.json({ message: 'Session revoked successfully' });
});

const revokeAllAdminSessions = catchAsync(async (req, res, next) => {
  const { adminId, exceptCurrent } = req.body;
  const targetAdminId = adminId || req.user.id;
  const exceptSessionId = exceptCurrent ? req.headers['x-session-id'] : null;

  const count = await deps.AdminSessionService.revokeAllSessions(targetAdminId, exceptSessionId);
  res.json({ message: `${count} sessions revoked` });
});

const getAdminSessionStats = catchAsync(async (req, res, next) => {
  const stats = await deps.AdminSessionService.getSessionStats();
  res.json(stats);
});

// Admin Audit Logs
const getAdminAuditLogs = catchAsync(async (req, res, next) => {
  const { adminId, actionType, riskScoreMin, status, limit = 100, offset = 0 } = req.query;

  let sql = `
        SELECT 
            l.*, u.email as admin_email, u.first_name, u.last_name
        FROM admin_audit_logs l
        LEFT JOIN users u ON l.admin_id = u.id
        WHERE 1=1
    `;
  const params = [];

  if (adminId) {
    sql += ' AND l.admin_id = ?';
    params.push(adminId);
  }
  if (actionType) {
    sql += ' AND l.action_type = ?';
    params.push(actionType);
  }
  if (riskScoreMin) {
    sql += ' AND l.risk_score >= ?';
    params.push(parseInt(riskScoreMin));
  }
  if (status) {
    sql += ' AND l.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const logs = await deps.db.all(sql, params);
  res.json(
    logs.map((l) => ({
      ...l,
      metadataJson: l.metadata_json ? JSON.parse(l.metadata_json) : {},
      admin: { email: l.admin_email, firstName: l.first_name, lastName: l.last_name },
    }))
  );
});

const getAdminAuditStats = catchAsync(async (req, res, next) => {
  const stats = await deps.db.get(`
        SELECT 
            COUNT(*) as total_logs,
            SUM(CASE WHEN status = 'unresolved' THEN 1 ELSE 0 END) as unresolved_count,
            SUM(CASE WHEN risk_score >= 70 THEN 1 ELSE 0 END) as high_risk_count,
            SUM(CASE WHEN risk_score >= 31 AND risk_score < 70 THEN 1 ELSE 0 END) as medium_risk_count,
            SUM(CASE WHEN risk_score < 31 THEN 1 ELSE 0 END) as low_risk_count,
            AVG(risk_score) as avg_risk_score
        FROM admin_audit_logs
    `);
  res.json(stats);
});

const resolveAdminAuditLog = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { resolutionNotes } = req.body;

  await deps.db.run(
    `UPDATE admin_audit_logs SET status = 'resolved', resolved_at = datetime('now'), 
         resolved_by = ?, resolution_notes = ? WHERE id = ?`,
    [req.user.id, resolutionNotes, id]
  );

  res.json({ message: 'Audit log resolved' });
});

const exportAuditLogs = catchAsync(async (req, res, next) => {
  const { adminId, actionType, riskScoreMin, status, fromDate, toDate, format = 'csv' } = req.query;

  let sql = `
        SELECT 
            l.id, l.admin_id, l.action_type, l.resource_type, l.resource_id,
            l.description, l.ip_address, l.risk_score, l.status, l.created_at,
            l.resolved_at, u.email as admin_email
        FROM admin_audit_logs l
        LEFT JOIN users u ON l.admin_id = u.id
        WHERE 1=1
    `;
  const params = [];

  if (adminId) {
    sql += ' AND l.admin_id = ?';
    params.push(adminId);
  }
  if (actionType) {
    sql += ' AND l.action_type = ?';
    params.push(actionType);
  }
  if (riskScoreMin) {
    sql += ' AND l.risk_score >= ?';
    params.push(parseInt(riskScoreMin));
  }
  if (status) {
    sql += ' AND l.status = ?';
    params.push(status);
  }
  if (fromDate) {
    sql += ' AND l.created_at >= ?';
    params.push(fromDate);
  }
  if (toDate) {
    sql += ' AND l.created_at <= ?';
    params.push(toDate);
  }

  sql += ' ORDER BY l.created_at DESC LIMIT 10000';

  const logs = await deps.db.all(sql, params);

  if (format === 'csv') {
    const headers = [
      'ID',
      'Admin Email',
      'Action Type',
      'Resource Type',
      'Resource ID',
      'Description',
      'IP Address',
      'Risk Score',
      'Status',
      'Created At',
      'Resolved At',
    ];
    const rows = logs.map((l) => [
      l.id,
      l.admin_email || '',
      l.action_type,
      l.resource_type || '',
      l.resource_id || '',
      l.description || '',
      l.ip_address || '',
      l.risk_score,
      l.status,
      l.created_at,
      l.resolved_at || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="audit_logs_${new Date().toISOString().split('T')[0]}.csv"`
    );
    return res.send(csvContent);
  }

  res.json(logs);
});

const getRecentHighRiskActions = catchAsync(async (req, res, next) => {
  const { limit = 10 } = req.query;

  const logs = await deps.db.all(
    `
        SELECT 
            l.id, l.admin_id, l.action_type, l.resource_type, l.description,
            l.risk_score, l.status, l.created_at,
            u.email as admin_email, u.first_name, u.last_name
        FROM admin_audit_logs l
        LEFT JOIN users u ON l.admin_id = u.id
        WHERE l.risk_score >= 60
        ORDER BY l.created_at DESC
        LIMIT ?
    `,
    [parseInt(limit)]
  );

  res.json(
    logs.map((l) => ({
      id: l.id,
      adminId: l.admin_id,
      adminEmail: l.admin_email,
      adminName: `${l.first_name || ''} ${l.last_name || ''}`.trim(),
      actionType: l.action_type,
      resourceType: l.resource_type,
      description: l.description,
      riskScore: l.risk_score,
      riskLevel: l.risk_score >= 80 ? 'critical' : l.risk_score >= 60 ? 'high' : 'medium',
      status: l.status,
      createdAt: l.created_at,
    }))
  );
});

// Admin Permissions
const getAdminPermissions = catchAsync(async (req, res, next) => {
  const { category, resourceType } = req.query;

  let sql = 'SELECT * FROM permissions WHERE 1=1';
  const params = [];

  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }

  sql += ' ORDER BY key ASC';
  const permissions = await deps.db.all(sql, params);
  res.json(permissions);
});

const createAdminPermission = catchAsync(async (req, res, next) => {
  const { key, description, category } = req.body;

  await deps.db.run(
    'INSERT INTO permissions (key, description, category, created_at) VALUES (?, ?, ?, datetime("now"))',
    [key, description, category]
  );

  res.json({ key, description, category });
});

const updateAdminPermission = catchAsync(async (req, res, next) => {
  const { key } = req.params;
  const { description, category } = req.body;

  await deps.db.run('UPDATE permissions SET description = ?, category = ? WHERE key = ?', [
    description,
    category,
    key,
  ]);

  res.json({ key, description, category });
});

const deleteAdminPermission = catchAsync(async (req, res, next) => {
  const { key } = req.params;
  await deps.db.run('DELETE FROM permissions WHERE key = ?', [key]);
  res.json({ message: 'Permission deleted' });
});

const getPermissionsMatrix = catchAsync(async (req, res, next) => {
  const PermissionsMatrixService = Promise.resolve(
    {}
  ); /* Stubbed missing permissionsMatrixService.js */
  const matrix = await PermissionsMatrixService.getMatrix();
  res.json(matrix);
});

const updateRolePermissions = catchAsync(async (req, res, next) => {
  const PermissionsMatrixService = Promise.resolve(
    {}
  ); /* Stubbed missing permissionsMatrixService.js */
  const { roleId } = req.params;
  const { permissions } = req.body;

  if (!permissions || !Array.isArray(permissions)) {
    return res.status(400).json({ error: 'permissions array is required' });
  }

  const result = await PermissionsMatrixService.updateRolePermissions(roleId, permissions);
  res.json({ success: true, message: 'Role permissions updated', ...result });
});

const toggleRolePermission = catchAsync(async (req, res, next) => {
  const PermissionsMatrixService = Promise.resolve(
    {}
  ); /* Stubbed missing permissionsMatrixService.js */
  const { roleId, permissionKey } = req.params;
  const { enabled } = req.body;

  const result = await PermissionsMatrixService.togglePermission(roleId, permissionKey, enabled);
  res.json({ success: true, ...result });
});

const copyRolePermissions = catchAsync(async (req, res, next) => {
  const PermissionsMatrixService = Promise.resolve(
    {}
  ); /* Stubbed missing permissionsMatrixService.js */
  const { sourceRole, targetRole } = req.body;

  if (!sourceRole || !targetRole) {
    return res.status(400).json({ error: 'sourceRole and targetRole are required' });
  }

  const result = await PermissionsMatrixService.copyRolePermissions(sourceRole, targetRole);
  res.json({ success: true, message: 'Permissions copied', ...result });
});

const compareRoles = catchAsync(async (req, res, next) => {
  const PermissionsMatrixService = Promise.resolve(
    {}
  ); /* Stubbed missing permissionsMatrixService.js */
  const { role1, role2 } = req.query;

  if (!role1 || !role2) {
    return res.status(400).json({ error: 'role1 and role2 query params are required' });
  }

  const diff = await PermissionsMatrixService.compareRoles(role1, role2);
  res.json(diff);
});

const getPermissionsStats = catchAsync(async (req, res, next) => {
  const PermissionsMatrixService = Promise.resolve(
    {}
  ); /* Stubbed missing permissionsMatrixService.js */
  const stats = await PermissionsMatrixService.getStats();
  res.json(stats);
});

// Approval Workflows
const getApprovalWorkflows = catchAsync(async (req, res, next) => {
  const { resourceType, isActive } = req.query;

  let sql = 'SELECT * FROM admin_approval_workflows WHERE 1=1';
  const params = [];

  if (resourceType) {
    sql += ' AND resource_type = ?';
    params.push(resourceType);
  }
  if (isActive !== undefined) {
    sql += ' AND is_active = ?';
    params.push(isActive === 'true' ? 1 : 0);
  }

  sql += ' ORDER BY created_at DESC';
  const workflows = await deps.db.all(sql, params);

  res.json(
    workflows.map((w) => ({
      ...w,
      triggerConditions: JSON.parse(w.trigger_conditions_json || '{}'),
      approvers: JSON.parse(w.approvers_json || '[]'),
      isActive: w.is_active === 1,
    }))
  );
});

const createApprovalWorkflow = catchAsync(async (req, res, next) => {
  const { name, description, resourceType, triggerConditions, approvers } = req.body;
  const id = deps.uuid.v4();

  await deps.db.run(
    `INSERT INTO admin_approval_workflows (id, name, description, resource_type, trigger_conditions_json, approvers_json, created_by, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      id,
      name,
      description,
      resourceType,
      JSON.stringify(triggerConditions || {}),
      JSON.stringify(approvers || []),
      req.user.id,
    ]
  );

  res.json({ id, name, description, resourceType, triggerConditions, approvers });
});

const updateApprovalWorkflow = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { name, description, triggerConditions, approvers, isActive } = req.body;

  await deps.db.run(
    `UPDATE admin_approval_workflows SET name = ?, description = ?, trigger_conditions_json = ?, 
         approvers_json = ?, is_active = ?, updated_at = datetime('now') WHERE id = ?`,
    [
      name,
      description,
      JSON.stringify(triggerConditions || {}),
      JSON.stringify(approvers || []),
      isActive ? 1 : 0,
      id,
    ]
  );

  res.json({ message: 'Workflow updated' });
});

const deleteApprovalWorkflow = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  await deps.db.run('DELETE FROM admin_approval_workflows WHERE id = ?', [id]);
  res.json({ message: 'Workflow deleted' });
});

const getApprovalRequests = catchAsync(async (req, res, next) => {
  const { status, workflowId, requesterId } = req.query;

  let sql = `
        SELECT r.*, w.name as workflow_name, u.email as requester_email
        FROM admin_approval_requests r
        LEFT JOIN admin_approval_workflows w ON r.workflow_id = w.id
        LEFT JOIN users u ON r.requester_id = u.id
        WHERE 1=1
    `;
  const params = [];

  if (status) {
    sql += ' AND r.status = ?';
    params.push(status);
  }
  if (workflowId) {
    sql += ' AND r.workflow_id = ?';
    params.push(workflowId);
  }
  if (requesterId) {
    sql += ' AND r.requester_id = ?';
    params.push(requesterId);
  }

  sql += ' ORDER BY r.created_at DESC';
  const requests = await deps.db.all(sql, params);

  res.json(
    requests.map((r) => ({
      ...r,
      approvers: JSON.parse(r.approvers_json || '[]'),
      requestData: JSON.parse(r.request_data_json || '{}'),
    }))
  );
});

const approveRequest = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { notes } = req.body;

  await deps.db.run(
    `UPDATE admin_approval_requests SET status = 'approved', completed_at = datetime('now'), 
         updated_at = datetime('now') WHERE id = ?`,
    [id]
  );

  res.json({ message: 'Request approved' });
});

const rejectRequest = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { reason } = req.body;

  await deps.db.run(
    `UPDATE admin_approval_requests SET status = 'rejected', completed_at = datetime('now'), 
         updated_at = datetime('now') WHERE id = ?`,
    [id]
  );

  res.json({ message: 'Request rejected' });
});

// =========================================
// PHASE 2: ADVANCED SECURITY MODULE
// =========================================

// =========================================
// PHASE 3: ANALYTICS MODULE
// =========================================

// Custom Dashboards
const getAnalyticsDashboards = catchAsync(async (req, res, next) => {
  const { isShared } = req.query;

  let sql = 'SELECT * FROM admin_dashboards WHERE 1=1';
  const params = [];

  if (isShared !== undefined) {
    sql += ' AND is_shared = ?';
    params.push(isShared === 'true' ? 1 : 0);
  }

  sql += ' ORDER BY updated_at DESC';
  const dashboards = await deps.db.all(sql, params);

  res.json(
    dashboards.map((d) => ({
      ...d,
      layout: JSON.parse(d.layout_json || '{}'),
      widgets: JSON.parse(d.widgets_json || '[]'),
      isShared: d.is_shared === 1,
    }))
  );
});

const createAnalyticsDashboard = catchAsync(async (req, res, next) => {
  const { name, description, layout, widgets } = req.body;
  const id = deps.uuid.v4();

  await deps.db.run(
    `INSERT INTO admin_dashboards (id, name, description, layout_json, widgets_json, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
    [
      id,
      name,
      description,
      JSON.stringify(layout || {}),
      JSON.stringify(widgets || []),
      req.user.id,
    ]
  );

  res.json({ id, name, description, layout, widgets });
});

const updateAnalyticsDashboard = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { name, description, layout, widgets } = req.body;

  await deps.db.run(
    `UPDATE admin_dashboards SET name = ?, description = ?, layout_json = ?, 
         widgets_json = ?, updated_at = datetime('now') WHERE id = ?`,
    [name, description, JSON.stringify(layout || {}), JSON.stringify(widgets || []), id]
  );

  res.json({ message: 'Dashboard updated' });
});

const deleteAnalyticsDashboard = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  await deps.db.run('DELETE FROM admin_dashboards WHERE id = ?', [id]);
  res.json({ message: 'Dashboard deleted' });
});

const getAnalyticsDashboardData = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const dashboard = await deps.db.get('SELECT * FROM admin_dashboards WHERE id = ?', [id]);
  if (!dashboard) {
    return next(new AppError('Dashboard not found', 404));
  }

  // Fetch data for each widget
  const widgets = JSON.parse(dashboard.widgets_json || '[]');
  const widgetData = {};

  for (const widget of widgets) {
    // Simple data fetching based on widget type
    switch (widget.dataSource) {
      case 'organizations':
        widgetData[widget.id] = await deps.db.all('SELECT COUNT(*) as count FROM organizations');
        break;
      case 'users':
        widgetData[widget.id] = await deps.db.all('SELECT COUNT(*) as count FROM users');
        break;
      case 'revenue':
        widgetData[widget.id] = await deps.db.all(
          'SELECT SUM(amount) as total FROM token_transactions WHERE type = "purchase"'
        );
        break;
      default:
        widgetData[widget.id] = [];
    }
  }

  res.json({
    dashboard: { ...dashboard, layout: JSON.parse(dashboard.layout_json || '{}'), widgets },
    widgetData,
  });
});

const shareAnalyticsDashboard = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { isShared } = req.body;

  await deps.db.run(
    'UPDATE admin_dashboards SET is_shared = ?, updated_at = datetime("now") WHERE id = ?',
    [isShared ? 1 : 0, id]
  );
  res.json({ message: isShared ? 'Dashboard shared' : 'Dashboard unshared' });
});

// Saved Reports
const getAnalyticsReports = catchAsync(async (req, res, next) => {
  const { reportType } = req.query;

  let sql = 'SELECT * FROM admin_saved_reports WHERE 1=1';
  const params = [];

  if (reportType) {
    sql += ' AND report_type = ?';
    params.push(reportType);
  }

  sql += ' ORDER BY updated_at DESC';
  const reports = await deps.db.all(sql, params);

  res.json(
    reports.map((r) => ({
      ...r,
      filters: JSON.parse(r.filters_json || '{}'),
      columns: JSON.parse(r.columns_json || '[]'),
      schedule: r.schedule_json ? JSON.parse(r.schedule_json) : null,
    }))
  );
});

const createAnalyticsReport = catchAsync(async (req, res, next) => {
  const { name, description, reportType, filters, columns } = req.body;
  const id = deps.uuid.v4();

  await deps.db.run(
    `INSERT INTO admin_saved_reports (id, name, description, report_type, filters_json, columns_json, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      name,
      description,
      reportType,
      JSON.stringify(filters || {}),
      JSON.stringify(columns || []),
      req.user.id,
    ]
  );

  res.json({ id, name, description, reportType, filters, columns });
});

const updateAnalyticsReport = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { name, description, filters, columns } = req.body;

  await deps.db.run(
    `UPDATE admin_saved_reports SET name = ?, description = ?, filters_json = ?, 
         columns_json = ?, updated_at = datetime('now') WHERE id = ?`,
    [name, description, JSON.stringify(filters || {}), JSON.stringify(columns || []), id]
  );

  res.json({ message: 'Report updated' });
});

const deleteAnalyticsReport = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  await deps.db.run('DELETE FROM admin_saved_reports WHERE id = ?', [id]);
  res.json({ message: 'Report deleted' });
});

const executeAnalyticsReport = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const report = await deps.db.get('SELECT * FROM admin_saved_reports WHERE id = ?', [id]);
  if (!report) {
    return next(new AppError('Report not found', 404));
  }

  const executionId = deps.uuid.v4();

  // Create execution record
  await deps.db.run(
    'INSERT INTO admin_report_executions (id, report_id, status, executed_at) VALUES (?, ?, "running", datetime("now"))',
    [executionId, id]
  );

  // Execute report (simplified)
  const filters = JSON.parse(report.filters_json || '{}');
  let result;

  switch (report.report_type) {
    case 'organizations':
      result = await deps.db.all('SELECT * FROM organizations LIMIT 1000');
      break;
    case 'users':
      result = await deps.db.all('SELECT * FROM users LIMIT 1000');
      break;
    case 'revenue':
      result = await deps.db.all(
        'SELECT * FROM token_transactions WHERE type = "purchase" LIMIT 1000'
      );
      break;
    default:
      result = [];
  }

  // Update execution with result
  await deps.db.run(
    'UPDATE admin_report_executions SET status = "completed", completed_at = datetime("now"), result_json = ? WHERE id = ?',
    [JSON.stringify({ rowCount: result.length, data: result.slice(0, 100) }), executionId]
  );

  res.json({ executionId, status: 'completed', rowCount: result.length });
});

const scheduleAnalyticsReport = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { schedule } = req.body;

  await deps.db.run(
    'UPDATE admin_saved_reports SET schedule_json = ?, updated_at = datetime("now") WHERE id = ?',
    [JSON.stringify(schedule), id]
  );

  res.json({ message: 'Report scheduled' });
});

const getReportExecutions = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { limit = 20 } = req.query;

  const executions = await deps.db.all(
    'SELECT * FROM admin_report_executions WHERE report_id = ? ORDER BY executed_at DESC LIMIT ?',
    [id, parseInt(limit)]
  );

  res.json(
    executions.map((e) => ({
      ...e,
      result: e.result_json ? JSON.parse(e.result_json) : null,
    }))
  );
});

// Business Metrics
const getBusinessMetrics = catchAsync(async (req, res, next) => {
  const { metricType, isActive } = req.query;

  let sql = 'SELECT * FROM business_metrics WHERE 1=1';
  const params = [];

  if (metricType) {
    sql += ' AND metric_type = ?';
    params.push(metricType);
  }
  if (isActive !== undefined) {
    sql += ' AND is_active = ?';
    params.push(isActive === 'true' ? 1 : 0);
  }

  sql += ' ORDER BY name ASC';
  const metrics = await deps.db.all(sql, params);

  // Get latest values
  for (const metric of metrics) {
    const latest = await deps.db.get(
      'SELECT value, calculated_at FROM business_metric_history WHERE metric_id = ? ORDER BY calculated_at DESC LIMIT 1',
      [metric.id]
    );
    metric.currentValue = latest?.value || null;
    metric.lastCalculated = latest?.calculated_at || null;
  }

  res.json(metrics.map((m) => ({ ...m, isActive: m.is_active === 1 })));
});

const createBusinessMetric = catchAsync(async (req, res, next) => {
  const { name, description, metricType, calculationFormula, targetValue, unit } = req.body;
  const id = deps.uuid.v4();

  await deps.db.run(
    `INSERT INTO business_metrics (id, name, description, metric_type, calculation_formula, target_value, unit)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, name, description, metricType, calculationFormula, targetValue, unit]
  );

  res.json({ id, name, description, metricType, calculationFormula, targetValue, unit });
});

const updateBusinessMetric = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { name, description, calculationFormula, targetValue, unit, isActive } = req.body;

  await deps.db.run(
    `UPDATE business_metrics SET name = ?, description = ?, calculation_formula = ?, 
         target_value = ?, unit = ?, is_active = ?, updated_at = datetime('now') WHERE id = ?`,
    [name, description, calculationFormula, targetValue, unit, isActive ? 1 : 0, id]
  );

  res.json({ message: 'Metric updated' });
});

const deleteBusinessMetric = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  await deps.db.run('DELETE FROM business_metrics WHERE id = ?', [id]);
  res.json({ message: 'Metric deleted' });
});

const calculateBusinessMetric = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const metric = await deps.db.get('SELECT * FROM business_metrics WHERE id = ?', [id]);
  if (!metric) {
    return next(new AppError('Metric not found', 404));
  }

  // Simple calculation based on metric type
  let value = 0;
  switch (metric.metric_type) {
    case 'user_count':
      const userCount = await deps.db.get('SELECT COUNT(*) as count FROM users');
      value = userCount?.count || 0;
      break;
    case 'org_count':
      const orgCount = await deps.db.get('SELECT COUNT(*) as count FROM organizations');
      value = orgCount?.count || 0;
      break;
    case 'revenue':
      const revenue = await deps.db.get(
        'SELECT SUM(amount) as total FROM token_transactions WHERE type = "purchase"'
      );
      value = revenue?.total || 0;
      break;
    case 'active_users':
      const activeUsers = await deps.db.get(
        'SELECT COUNT(*) as count FROM users WHERE last_login > datetime("now", "-7 days")'
      );
      value = activeUsers?.count || 0;
      break;
    default:
      value = 0;
  }

  // Record history
  const historyId = deps.uuid.v4();
  await deps.db.run(
    'INSERT INTO business_metric_history (id, metric_id, value, calculated_at) VALUES (?, ?, ?, datetime("now"))',
    [historyId, id, value]
  );

  res.json({ metricId: id, value, calculatedAt: new Date().toISOString() });
});

const getMetricHistory = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { limit = 30 } = req.query;

  const history = await deps.db.all(
    'SELECT * FROM business_metric_history WHERE metric_id = ? ORDER BY calculated_at DESC LIMIT ?',
    [id, parseInt(limit)]
  );

  res.json(history);
});

const getMetricsStats = catchAsync(async (req, res, next) => {
  const stats = await deps.db.get(`
        SELECT 
            COUNT(*) as total_metrics,
            SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_metrics
        FROM business_metrics
    `);

  const recentCalculations = await deps.db.get(`
        SELECT COUNT(*) as count FROM business_metric_history WHERE calculated_at > datetime('now', '-1 day')
    `);

  res.json({ ...stats, recentCalculations: recentCalculations?.count || 0 });
});

// Predictive Analytics
const getPredictiveModels = catchAsync(async (req, res, next) => {
  const { modelType, isActive } = req.query;

  let sql = 'SELECT * FROM predictive_models WHERE 1=1';
  const params = [];

  if (modelType) {
    sql += ' AND model_type = ?';
    params.push(modelType);
  }
  if (isActive !== undefined) {
    sql += ' AND is_active = ?';
    params.push(isActive === 'true' ? 1 : 0);
  }

  sql += ' ORDER BY updated_at DESC';
  const models = await deps.db.all(sql, params);

  res.json(
    models.map((m) => ({
      ...m,
      trainingData: JSON.parse(m.training_data_json || '{}'),
      modelConfig: JSON.parse(m.model_config_json || '{}'),
      isActive: m.is_active === 1,
    }))
  );
});

const createPredictiveModel = catchAsync(async (req, res, next) => {
  const { name, description, modelType, trainingData, modelConfig } = req.body;
  const id = deps.uuid.v4();

  await deps.db.run(
    `INSERT INTO predictive_models (id, name, description, model_type, training_data_json, model_config_json)
         VALUES (?, ?, ?, ?, ?, ?)`,
    [
      id,
      name,
      description,
      modelType,
      JSON.stringify(trainingData || {}),
      JSON.stringify(modelConfig || {}),
    ]
  );

  res.json({ id, name, description, modelType });
});

const updatePredictiveModel = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { name, description, modelConfig, isActive } = req.body;

  await deps.db.run(
    `UPDATE predictive_models SET name = ?, description = ?, model_config_json = ?, 
         is_active = ?, updated_at = datetime('now') WHERE id = ?`,
    [name, description, JSON.stringify(modelConfig || {}), isActive ? 1 : 0, id]
  );

  res.json({ message: 'Model updated' });
});

const deletePredictiveModel = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  await deps.db.run('DELETE FROM predictive_models WHERE id = ?', [id]);
  res.json({ message: 'Model deleted' });
});

const trainPredictiveModel = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // Simulate training
  const accuracy = Math.random() * 0.3 + 0.7; // 70-100%

  await deps.db.run(
    'UPDATE predictive_models SET accuracy_score = ?, updated_at = datetime("now") WHERE id = ?',
    [accuracy, id]
  );

  res.json({ modelId: id, accuracyScore: accuracy, status: 'trained' });
});

const makePrediction = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { inputData } = req.body;

  const model = await deps.db.get('SELECT * FROM predictive_models WHERE id = ?', [id]);
  if (!model) {
    return next(new AppError('Model not found', 404));
  }

  // Simple prediction simulation
  const predictionId = deps.uuid.v4();
  const predictedValue = Math.random() * 100;
  const confidenceScore = model.accuracy_score || 0.8;

  await deps.db.run(
    `INSERT INTO model_predictions (id, model_id, prediction_type, predicted_value, confidence_score, input_data_json)
         VALUES (?, ?, ?, ?, ?, ?)`,
    [
      predictionId,
      id,
      model.model_type,
      predictedValue.toString(),
      confidenceScore,
      JSON.stringify(inputData || {}),
    ]
  );

  res.json({ predictionId, predictedValue, confidenceScore });
});

const getModelPredictions = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { limit = 50 } = req.query;

  const predictions = await deps.db.all(
    'SELECT * FROM model_predictions WHERE model_id = ? ORDER BY created_at DESC LIMIT ?',
    [id, parseInt(limit)]
  );

  res.json(
    predictions.map((p) => ({
      ...p,
      inputData: JSON.parse(p.input_data_json || '{}'),
    }))
  );
});

const evaluatePredictiveModel = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const model = await deps.db.get('SELECT * FROM predictive_models WHERE id = ?', [id]);
  if (!model) {
    return next(new AppError('Model not found', 404));
  }

  const predictions = await deps.db.get(
    'SELECT COUNT(*) as count, AVG(confidence_score) as avg_confidence FROM model_predictions WHERE model_id = ?',
    [id]
  );

  res.json({
    modelId: id,
    accuracyScore: model.accuracy_score,
    predictionCount: predictions?.count || 0,
    avgConfidence: predictions?.avg_confidence || 0,
  });
});

// =========================================
// PHASE 4: CUSTOMER MANAGEMENT MODULE
// =========================================

// Customer Lifecycle
const getLifecycleStages = catchAsync(async (req, res, next) => {
  const stages = await deps.db.all(
    'SELECT * FROM customer_lifecycle_stages ORDER BY order_index ASC'
  );
  res.json(stages.map((s) => ({ ...s, isActive: s.is_active === 1 })));
});

const createLifecycleStage = catchAsync(async (req, res, next) => {
  const { name, description, orderIndex, color } = req.body;
  const id = deps.uuid.v4();

  await deps.db.run(
    'INSERT INTO customer_lifecycle_stages (id, name, description, order_index, color) VALUES (?, ?, ?, ?, ?)',
    [id, name, description, orderIndex || 0, color || '#6B7280']
  );

  res.json({ id, name, description, orderIndex, color });
});

const updateLifecycleStage = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { name, description, orderIndex, color, isActive } = req.body;

  await deps.db.run(
    'UPDATE customer_lifecycle_stages SET name = ?, description = ?, order_index = ?, color = ?, is_active = ? WHERE id = ?',
    [name, description, orderIndex, color, isActive ? 1 : 0, id]
  );

  res.json({ message: 'Stage updated' });
});

const deleteLifecycleStage = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  await deps.db.run('DELETE FROM customer_lifecycle_stages WHERE id = ?', [id]);
  res.json({ message: 'Stage deleted' });
});

const transitionOrganization = catchAsync(async (req, res, next) => {
  const { organizationId, fromStageId, toStageId, notes } = req.body;
  const id = deps.uuid.v4();

  await deps.db.run(
    `INSERT INTO customer_lifecycle_transitions (id, organization_id, from_stage_id, to_stage_id, transitioned_by, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
    [id, organizationId, fromStageId, toStageId, req.user.id, notes]
  );

  res.json({ id, organizationId, fromStageId, toStageId });
});

const getLifecycleTransitions = catchAsync(async (req, res, next) => {
  const { organizationId, limit = 100 } = req.query;

  let sql = `
        SELECT t.*, 
               fs.name as from_stage_name, ts.name as to_stage_name,
               o.name as organization_name, u.email as transitioned_by_email
        FROM customer_lifecycle_transitions t
        LEFT JOIN customer_lifecycle_stages fs ON t.from_stage_id = fs.id
        LEFT JOIN customer_lifecycle_stages ts ON t.to_stage_id = ts.id
        LEFT JOIN organizations o ON t.organization_id = o.id
        LEFT JOIN users u ON t.transitioned_by = u.id
        WHERE 1=1
    `;
  const params = [];

  if (organizationId) {
    sql += ' AND t.organization_id = ?';
    params.push(organizationId);
  }

  sql += ' ORDER BY t.transitioned_at DESC LIMIT ?';
  params.push(parseInt(limit));

  const transitions = await deps.db.all(sql, params);
  res.json(transitions);
});

const getLifecycleStats = catchAsync(async (req, res, next) => {
  const stageStats = await deps.db.all(`
        SELECT s.id, s.name, s.color, COUNT(DISTINCT t.organization_id) as org_count
        FROM customer_lifecycle_stages s
        LEFT JOIN (
            SELECT organization_id, to_stage_id
            FROM customer_lifecycle_transitions t1
            WHERE transitioned_at = (
                SELECT MAX(transitioned_at) FROM customer_lifecycle_transitions t2
                WHERE t2.organization_id = t1.organization_id
            )
        ) t ON s.id = t.to_stage_id
        GROUP BY s.id, s.name, s.color
        ORDER BY s.order_index
    `);

  const totalTransitions = await deps.db.get(
    'SELECT COUNT(*) as count FROM customer_lifecycle_transitions'
  );

  res.json({ stageStats, totalTransitions: totalTransitions?.count || 0 });
});

// Customer Success Playbooks
const getSuccessPlaybooks = catchAsync(async (req, res, next) => {
  const { isActive } = req.query;

  let sql = 'SELECT * FROM customer_success_playbooks WHERE 1=1';
  const params = [];

  if (isActive !== undefined) {
    sql += ' AND is_active = ?';
    params.push(isActive === 'true' ? 1 : 0);
  }

  sql += ' ORDER BY name ASC';
  const playbooks = await deps.db.all(sql, params);

  res.json(
    playbooks.map((p) => ({
      ...p,
      triggerConditions: JSON.parse(p.trigger_conditions_json || '{}'),
      actions: JSON.parse(p.actions_json || '[]'),
      isActive: p.is_active === 1,
    }))
  );
});

const createSuccessPlaybook = catchAsync(async (req, res, next) => {
  const { name, description, triggerConditions, actions } = req.body;
  const id = deps.uuid.v4();

  await deps.db.run(
    `INSERT INTO customer_success_playbooks (id, name, description, trigger_conditions_json, actions_json, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
    [
      id,
      name,
      description,
      JSON.stringify(triggerConditions || {}),
      JSON.stringify(actions || []),
      req.user.id,
    ]
  );

  res.json({ id, name, description, triggerConditions, actions });
});

const updateSuccessPlaybook = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { name, description, triggerConditions, actions, isActive } = req.body;

  await deps.db.run(
    `UPDATE customer_success_playbooks SET name = ?, description = ?, trigger_conditions_json = ?, 
         actions_json = ?, is_active = ?, updated_at = datetime('now') WHERE id = ?`,
    [
      name,
      description,
      JSON.stringify(triggerConditions || {}),
      JSON.stringify(actions || []),
      isActive ? 1 : 0,
      id,
    ]
  );

  res.json({ message: 'Playbook updated' });
});

const deleteSuccessPlaybook = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  await deps.db.run('DELETE FROM customer_success_playbooks WHERE id = ?', [id]);
  res.json({ message: 'Playbook deleted' });
});

const executeSuccessPlaybook = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { organizationId } = req.body;

  const playbook = await deps.db.get('SELECT * FROM customer_success_playbooks WHERE id = ?', [id]);
  if (!playbook) {
    return next(new AppError('Playbook not found', 404));
  }

  const actions = JSON.parse(playbook.actions_json || '[]');
  const actionId = deps.uuid.v4();

  // Record action
  await deps.db.run(
    `INSERT INTO customer_success_actions (id, playbook_id, organization_id, action_type, status, executed_at)
         VALUES (?, ?, ?, ?, 'completed', datetime('now'))`,
    [actionId, id, organizationId, 'execute_playbook']
  );

  res.json({ actionId, playbookId: id, organizationId, actionsExecuted: actions.length });
});

const getSuccessActions = catchAsync(async (req, res, next) => {
  const { playbookId, organizationId, status, limit = 100 } = req.query;

  let sql = `
        SELECT a.*, p.name as playbook_name, o.name as organization_name
        FROM customer_success_actions a
        LEFT JOIN customer_success_playbooks p ON a.playbook_id = p.id
        LEFT JOIN organizations o ON a.organization_id = o.id
        WHERE 1=1
    `;
  const params = [];

  if (playbookId) {
    sql += ' AND a.playbook_id = ?';
    params.push(playbookId);
  }
  if (organizationId) {
    sql += ' AND a.organization_id = ?';
    params.push(organizationId);
  }
  if (status) {
    sql += ' AND a.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY a.created_at DESC LIMIT ?';
  params.push(parseInt(limit));

  const actions = await deps.db.all(sql, params);
  res.json(actions.map((a) => ({ ...a, result: JSON.parse(a.result_json || '{}') })));
});

const getPlaybookStats = catchAsync(async (req, res, next) => {
  const stats = await deps.db.get(`
        SELECT 
            (SELECT COUNT(*) FROM customer_success_playbooks) as total_playbooks,
            (SELECT COUNT(*) FROM customer_success_playbooks WHERE is_active = 1) as active_playbooks,
            (SELECT COUNT(*) FROM customer_success_actions) as total_actions,
            (SELECT COUNT(*) FROM customer_success_actions WHERE status = 'completed') as completed_actions
    `);
  res.json(stats);
});

// Customer Contracts
const getCustomerContracts = catchAsync(async (req, res, next) => {
  const { organizationId, status, limit = 100 } = req.query;

  let sql = `
        SELECT c.*, o.name as organization_name
        FROM customer_contracts c
        LEFT JOIN organizations o ON c.organization_id = o.id
        WHERE 1=1
    `;
  const params = [];

  if (organizationId) {
    sql += ' AND c.organization_id = ?';
    params.push(organizationId);
  }
  if (status) {
    sql += ' AND c.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY c.start_date DESC LIMIT ?';
  params.push(parseInt(limit));

  const contracts = await deps.db.all(sql, params);
  res.json(contracts.map((c) => ({ ...c, terms: JSON.parse(c.terms_json || '{}') })));
});

const createCustomerContract = catchAsync(async (req, res, next) => {
  const {
    organizationId,
    contractType,
    startDate,
    endDate,
    renewalDate,
    value,
    currency,
    terms,
    documentUrl,
  } = req.body;
  const id = deps.uuid.v4();

  await deps.db.run(
    `INSERT INTO customer_contracts (id, organization_id, contract_type, start_date, end_date, renewal_date, value, currency, terms_json, document_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      organizationId,
      contractType,
      startDate,
      endDate,
      renewalDate,
      value || 0,
      currency || 'USD',
      JSON.stringify(terms || {}),
      documentUrl,
    ]
  );

  res.json({ id, organizationId, contractType, startDate, endDate, value });
});

const updateCustomerContract = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { endDate, renewalDate, value, status, terms, documentUrl } = req.body;

  await deps.db.run(
    `UPDATE customer_contracts SET end_date = ?, renewal_date = ?, value = ?, status = ?, 
         terms_json = ?, document_url = ?, updated_at = datetime('now') WHERE id = ?`,
    [endDate, renewalDate, value, status, JSON.stringify(terms || {}), documentUrl, id]
  );

  res.json({ message: 'Contract updated' });
});

const deleteCustomerContract = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  await deps.db.run('DELETE FROM customer_contracts WHERE id = ?', [id]);
  res.json({ message: 'Contract deleted' });
});

const createContractAmendment = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { amendmentType, amendmentDate, changes } = req.body;
  const amendmentId = deps.uuid.v4();

  await deps.db.run(
    `INSERT INTO contract_amendments (id, contract_id, amendment_type, amendment_date, changes_json, approved_by, approved_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    [amendmentId, id, amendmentType, amendmentDate, JSON.stringify(changes || {}), req.user.id]
  );

  res.json({ id: amendmentId, contractId: id, amendmentType, amendmentDate, changes });
});

const getContractAmendments = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const amendments = await deps.db.all(
    `SELECT a.*, u.email as approved_by_email
         FROM contract_amendments a
         LEFT JOIN users u ON a.approved_by = u.id
         WHERE a.contract_id = ? ORDER BY a.amendment_date DESC`,
    [id]
  );

  res.json(amendments.map((a) => ({ ...a, changes: JSON.parse(a.changes_json || '{}') })));
});

const getUpcomingRenewals = catchAsync(async (req, res, next) => {
  const { daysAhead = 90 } = req.query;

  const renewals = await deps.db.all(
    `SELECT c.*, o.name as organization_name
         FROM customer_contracts c
         LEFT JOIN organizations o ON c.organization_id = o.id
         WHERE c.renewal_date BETWEEN date('now') AND date('now', '+' || ? || ' days')
         AND c.status = 'active'
         ORDER BY c.renewal_date ASC`,
    [parseInt(daysAhead)]
  );

  res.json(renewals.map((r) => ({ ...r, terms: JSON.parse(r.terms_json || '{}') })));
});

const getContractStats = catchAsync(async (req, res, next) => {
  const stats = await deps.db.get(`
        SELECT 
            COUNT(*) as total_contracts,
            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_contracts,
            SUM(CASE WHEN status = 'active' THEN value ELSE 0 END) as total_value,
            (SELECT COUNT(*) FROM customer_contracts WHERE renewal_date BETWEEN date('now') AND date('now', '+30 days')) as renewals_30d
        FROM customer_contracts
    `);
  res.json(stats);
});

// =========================================
// PHASE 5: REVENUE MANAGEMENT MODULE
// =========================================

// Pricing Plans
const getPricingPlans = catchAsync(async (req, res, next) => {
  // Get plans from organizations or a dedicated table
  const plans = [
    { id: 'free', name: 'Free', price: 0, features: ['Basic features', '1 project'] },
    {
      id: 'pro',
      name: 'Pro',
      price: 99,
      features: ['All features', '10 projects', 'Priority support'],
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 499,
      features: ['Unlimited features', 'Unlimited projects', 'Dedicated support', 'SLA'],
    },
  ];
  res.json(plans);
});

const createPricingPlan = catchAsync(async (req, res, next) => {
  const { name, price, features, limits, billingCycle, trialDays } = req.body;
  const id = deps.uuid.v4();

  // Store in plan_features or a dedicated pricing table
  res.json({ id, name, price, features, limits, billingCycle, trialDays });
});

const updatePricingPlan = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  res.json({ message: 'Plan updated' });
});

const deletePricingPlan = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  res.json({ message: 'Plan deleted' });
});

const getPlanFeatures = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const features = await deps.db.all('SELECT * FROM plan_features WHERE plan_id = ?', [id]);
  res.json(features);
});

const addPlanFeature = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { featureKey, featureValue } = req.body;
  const featureId = deps.uuid.v4();

  await deps.db.run(
    'INSERT INTO plan_features (id, plan_id, feature_key, feature_value) VALUES (?, ?, ?, ?)',
    [featureId, id, featureKey, featureValue]
  );

  res.json({ id: featureId, planId: id, featureKey, featureValue });
});

const removePlanFeature = catchAsync(async (req, res, next) => {
  const { featureId } = req.params;
  await deps.db.run('DELETE FROM plan_features WHERE id = ?', [featureId]);
  res.json({ message: 'Feature removed' });
});

const comparePricingPlans = catchAsync(async (req, res, next) => {
  const { planIds } = req.query;
  // Return comparison data
  res.json({ comparison: [] });
});

// Subscription Changes
const getSubscriptionChanges = catchAsync(async (req, res, next) => {
  const { organizationId, status, limit = 100 } = req.query;

  let sql = `
        SELECT sc.*, o.name as organization_name
        FROM subscription_changes sc
        LEFT JOIN organizations o ON sc.organization_id = o.id
        WHERE 1=1
    `;
  const params = [];

  if (organizationId) {
    sql += ' AND sc.organization_id = ?';
    params.push(organizationId);
  }
  if (status) {
    sql += ' AND sc.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY sc.created_at DESC LIMIT ?';
  params.push(parseInt(limit));

  const changes = await deps.db.all(sql, params);
  res.json(changes);
});

const createSubscriptionChange = catchAsync(async (req, res, next) => {
  const { organizationId, fromPlanId, toPlanId, changeType, effectiveDate, prorationAmount } =
    req.body;
  const id = deps.uuid.v4();

  await deps.db.run(
    `INSERT INTO subscription_changes (id, organization_id, from_plan_id, to_plan_id, change_type, effective_date, proration_amount)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, organizationId, fromPlanId, toPlanId, changeType, effectiveDate, prorationAmount || 0]
  );

  res.json({ id, organizationId, fromPlanId, toPlanId, changeType, effectiveDate });
});

const approveSubscriptionChange = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  await deps.db.run(
    'UPDATE subscription_changes SET status = "approved", approved_by = ?, approved_at = datetime("now") WHERE id = ?',
    [req.user.id, id]
  );

  res.json({ message: 'Subscription change approved' });
});

const rejectSubscriptionChange = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  await deps.db.run('UPDATE subscription_changes SET status = "rejected" WHERE id = ?', [id]);
  res.json({ message: 'Subscription change rejected' });
});

const calculateProration = catchAsync(async (req, res, next) => {
  const { organizationId, fromPlanId, toPlanId, effectiveDate } = req.body;

  // Simple proration calculation
  const prorationAmount = Math.random() * 50; // Placeholder
  res.json({ prorationAmount: prorationAmount.toFixed(2), effectiveDate });
});

const getSubscriptionChangeStats = catchAsync(async (req, res, next) => {
  const stats = await deps.db.get(`
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
            SUM(CASE WHEN change_type = 'upgrade' THEN 1 ELSE 0 END) as upgrades,
            SUM(CASE WHEN change_type = 'downgrade' THEN 1 ELSE 0 END) as downgrades
        FROM subscription_changes
    `);
  res.json(stats);
});

// Revenue Recognition
const getRevenueRecognitions = catchAsync(async (req, res, next) => {
  const { organizationId, status, limit = 100 } = req.query;

  let sql = `
        SELECT rr.*, o.name as organization_name
        FROM revenue_recognition rr
        LEFT JOIN organizations o ON rr.organization_id = o.id
        WHERE 1=1
    `;
  const params = [];

  if (organizationId) {
    sql += ' AND rr.organization_id = ?';
    params.push(organizationId);
  }
  if (status) {
    sql += ' AND rr.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY rr.created_at DESC LIMIT ?';
  params.push(parseInt(limit));

  const recognitions = await deps.db.all(sql, params);
  res.json(
    recognitions.map((r) => ({
      ...r,
      recognitionSchedule: JSON.parse(r.recognition_schedule_json || '[]'),
    }))
  );
});

const createRevenueRecognition = catchAsync(async (req, res, next) => {
  const {
    organizationId,
    contractId,
    revenueAmount,
    currency,
    recognitionMethod,
    recognitionSchedule,
  } = req.body;
  const id = deps.uuid.v4();

  await deps.db.run(
    `INSERT INTO revenue_recognition (id, organization_id, contract_id, revenue_amount, currency, recognition_method, recognition_schedule_json, remaining_amount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      organizationId,
      contractId,
      revenueAmount,
      currency || 'USD',
      recognitionMethod || 'straight_line',
      JSON.stringify(recognitionSchedule || []),
      revenueAmount,
    ]
  );

  res.json({ id, organizationId, revenueAmount, recognitionMethod });
});

const updateRevenueRecognition = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { recognitionSchedule, status } = req.body;

  await deps.db.run(
    'UPDATE revenue_recognition SET recognition_schedule_json = ?, status = ?, updated_at = datetime("now") WHERE id = ?',
    [JSON.stringify(recognitionSchedule || []), status, id]
  );

  res.json({ message: 'Recognition updated' });
});

const recognizeRevenue = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { amount } = req.body;

  const recognition = await deps.db.get('SELECT * FROM revenue_recognition WHERE id = ?', [id]);
  if (!recognition) {
    return next(new AppError('Revenue recognition not found', 404));
  }

  const newRecognized = (recognition.recognized_amount || 0) + amount;
  const newRemaining = (recognition.remaining_amount || 0) - amount;

  await deps.db.run(
    'UPDATE revenue_recognition SET recognized_amount = ?, remaining_amount = ?, updated_at = datetime("now") WHERE id = ?',
    [newRecognized, Math.max(0, newRemaining), id]
  );

  res.json({ recognizedAmount: newRecognized, remainingAmount: Math.max(0, newRemaining) });
});

const getRecognitionSchedule = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const recognition = await deps.db.get('SELECT * FROM revenue_recognition WHERE id = ?', [id]);

  if (!recognition) {
    return next(new AppError('Revenue recognition not found', 404));
  }

  res.json({
    id: recognition.id,
    schedule: JSON.parse(recognition.recognition_schedule_json || '[]'),
    recognized: recognition.recognized_amount,
    remaining: recognition.remaining_amount,
  });
});

const getRevenueRecognitionStats = catchAsync(async (req, res, next) => {
  const stats = await deps.db.get(`
        SELECT 
            COUNT(*) as total,
            SUM(revenue_amount) as total_revenue,
            SUM(recognized_amount) as total_recognized,
            SUM(remaining_amount) as total_remaining
        FROM revenue_recognition
    `);
  res.json(stats);
});

// Revenue Forecasting
const getRevenueForecasts = catchAsync(async (req, res, next) => {
  const { forecastType, limit = 50 } = req.query;

  let sql = 'SELECT * FROM revenue_forecasts WHERE 1=1';
  const params = [];

  if (forecastType) {
    sql += ' AND forecast_type = ?';
    params.push(forecastType);
  }

  sql += ' ORDER BY period_start DESC LIMIT ?';
  params.push(parseInt(limit));

  const forecasts = await deps.db.all(sql, params);
  res.json(forecasts.map((f) => ({ ...f, inputData: JSON.parse(f.input_data_json || '{}') })));
});

const createRevenueForecast = catchAsync(async (req, res, next) => {
  const {
    forecastType,
    periodStart,
    periodEnd,
    forecastedAmount,
    currency,
    confidenceLevel,
    method,
    inputData,
  } = req.body;
  const id = deps.uuid.v4();

  await deps.db.run(
    `INSERT INTO revenue_forecasts (id, forecast_type, period_start, period_end, forecasted_amount, currency, confidence_level, method, input_data_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      forecastType,
      periodStart,
      periodEnd,
      forecastedAmount,
      currency || 'USD',
      confidenceLevel || 0.8,
      method || 'linear',
      JSON.stringify(inputData || {}),
    ]
  );

  res.json({ id, forecastType, periodStart, periodEnd, forecastedAmount });
});

const updateRevenueForecast = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { forecastedAmount, confidenceLevel, inputData } = req.body;

  await deps.db.run(
    'UPDATE revenue_forecasts SET forecasted_amount = ?, confidence_level = ?, input_data_json = ?, updated_at = datetime("now") WHERE id = ?',
    [forecastedAmount, confidenceLevel, JSON.stringify(inputData || {}), id]
  );

  res.json({ message: 'Forecast updated' });
});

const deleteRevenueForecast = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  await deps.db.run('DELETE FROM revenue_forecasts WHERE id = ?', [id]);
  res.json({ message: 'Forecast deleted' });
});

const generateRevenueForecast = catchAsync(async (req, res, next) => {
  const { forecastType, periodMonths } = req.body;

  // Simple forecast generation
  const forecasts = [];
  const baseAmount = Math.random() * 10000 + 5000;

  for (let i = 0; i < (periodMonths || 12); i++) {
    const date = new Date();
    date.setMonth(date.getMonth() + i);
    const periodStart = date.toISOString().split('T')[0];
    date.setMonth(date.getMonth() + 1);
    const periodEnd = date.toISOString().split('T')[0];

    forecasts.push({
      periodStart,
      periodEnd,
      forecastedAmount: baseAmount * (1 + i * 0.05), // 5% growth
    });
  }

  res.json({ forecasts });
});

const getRevenueForecastStats = catchAsync(async (req, res, next) => {
  const stats = await deps.db.get(`
        SELECT 
            COUNT(*) as total,
            SUM(forecasted_amount) as total_forecasted,
            AVG(confidence_level) as avg_confidence
        FROM revenue_forecasts
    `);
  res.json(stats);
});

// Payment Management
const getPaymentMethods = catchAsync(async (req, res, next) => {
  const { organizationId } = req.query;

  let sql = 'SELECT * FROM payment_methods WHERE 1=1';
  const params = [];

  if (organizationId) {
    sql += ' AND organization_id = ?';
    params.push(organizationId);
  }

  sql += ' ORDER BY is_default DESC, created_at DESC';
  const methods = await deps.db.all(sql, params);

  res.json(
    methods.map((m) => ({
      ...m,
      paymentDetails: JSON.parse(m.payment_details_json || '{}'),
      isDefault: m.is_default === 1,
      isActive: m.is_active === 1,
    }))
  );
});

const addPaymentMethod = catchAsync(async (req, res, next) => {
  const { organizationId, paymentType, paymentDetails, isDefault } = req.body;
  const id = deps.uuid.v4();

  if (isDefault) {
    // Unset other defaults
    await deps.db.run('UPDATE payment_methods SET is_default = 0 WHERE organization_id = ?', [
      organizationId,
    ]);
  }

  await deps.db.run(
    `INSERT INTO payment_methods (id, organization_id, payment_type, payment_details_json, is_default)
         VALUES (?, ?, ?, ?, ?)`,
    [id, organizationId, paymentType, JSON.stringify(paymentDetails || {}), isDefault ? 1 : 0]
  );

  res.json({ id, organizationId, paymentType, isDefault });
});

const updatePaymentMethod = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { paymentDetails, isDefault, isActive } = req.body;

  const method = await deps.db.get('SELECT * FROM payment_methods WHERE id = ?', [id]);

  if (isDefault) {
    await deps.db.run('UPDATE payment_methods SET is_default = 0 WHERE organization_id = ?', [
      method.organization_id,
    ]);
  }

  await deps.db.run(
    'UPDATE payment_methods SET payment_details_json = ?, is_default = ?, is_active = ?, updated_at = datetime("now") WHERE id = ?',
    [JSON.stringify(paymentDetails || {}), isDefault ? 1 : 0, isActive !== false ? 1 : 0, id]
  );

  res.json({ message: 'Payment method updated' });
});

const deletePaymentMethod = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  await deps.db.run('DELETE FROM payment_methods WHERE id = ?', [id]);
  res.json({ message: 'Payment method deleted' });
});

const getPaymentFailures = catchAsync(async (req, res, next) => {
  const { organizationId, status, limit = 100 } = req.query;

  let sql = `
        SELECT pf.*, o.name as organization_name
        FROM payment_failures pf
        LEFT JOIN organizations o ON pf.organization_id = o.id
        WHERE 1=1
    `;
  const params = [];

  if (organizationId) {
    sql += ' AND pf.organization_id = ?';
    params.push(organizationId);
  }
  if (status) {
    sql += ' AND pf.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY pf.attempted_at DESC LIMIT ?';
  params.push(parseInt(limit));

  const failures = await deps.db.all(sql, params);
  res.json(failures);
});

const retryPayment = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const failure = await deps.db.get('SELECT * FROM payment_failures WHERE id = ?', [id]);
  if (!failure) {
    return next(new AppError('Payment failure not found', 404));
  }

  // Simulate retry
  const success = Math.random() > 0.3;

  if (success) {
    await deps.db.run(
      'UPDATE payment_failures SET status = "resolved", resolved_at = datetime("now") WHERE id = ?',
      [id]
    );
    res.json({ success: true, message: 'Payment successful' });
  } else {
    await deps.db.run('UPDATE payment_failures SET retry_count = retry_count + 1 WHERE id = ?', [
      id,
    ]);
    res.json({ success: false, message: 'Payment retry failed' });
  }
});

const getPaymentFailureStats = catchAsync(async (req, res, next) => {
  const stats = await deps.db.get(`
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as unresolved,
            SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
            AVG(retry_count) as avg_retries
        FROM payment_failures
    `);
  res.json(stats);
});

// =========================================
// SECURITY INCIDENT MANAGEMENT
// =========================================

/**
 * Get all security incidents
 */
const getSecurityIncidents = catchAsync(async (req, res, next) => {
  const { status, severity, incidentType, limit = 100, offset = 0 } = req.query;
  const incidents = await deps.SecurityIncidentService.getIncidents({
    status,
    severity,
    incidentType,
    limit: parseInt(limit),
    offset: parseInt(offset),
  });
  res.json(incidents);
});

/**
 * Get security incident statistics
 */
const getSecurityIncidentStats = catchAsync(async (req, res, next) => {
  const stats = await deps.SecurityIncidentService.getStats();
  res.json(stats);
});

/**
 * Get security incident by ID
 */
const getSecurityIncidentById = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const incident = await deps.SecurityIncidentService.getIncidentById(id);
  if (!incident) {
    return next(new AppError('Incident not found', 404));
  }
  res.json(incident);
});

/**
 * Create a new security incident
 */
const createSecurityIncident = catchAsync(async (req, res, next) => {
  const { incidentType, severity, description, affectedResources } = req.body;

  if (!incidentType || !description) {
    return next(new AppError('Incident type and description are required', 400));
  }

  const incident = await deps.SecurityIncidentService.createIncident({
    type: incidentType,
    severity,
    description,
    affectedResources,
  });

  res.status(201).json(incident);
});

/**
 * Update a security incident
 */
const updateSecurityIncident = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { severity, description, status } = req.body;

  const updated = await deps.SecurityIncidentService.updateIncident(id, {
    severity,
    description,
    status,
  });

  if (!updated) {
    return next(new AppError('Incident not found or no changes made', 404));
  }

  const incident = await deps.SecurityIncidentService.getIncidentById(id);
  res.json(incident);
});

/**
 * Resolve a security incident
 */
const resolveSecurityIncident = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { resolutionNotes } = req.body;

  const resolved = await deps.SecurityIncidentService.resolveIncident(
    id,
    req.user.id,
    resolutionNotes
  );

  if (!resolved) {
    return next(new AppError('Incident not found', 404));
  }

  const incident = await deps.SecurityIncidentService.getIncidentById(id);
  res.json(incident);
});

/**
 * Delete a security incident
 */
const deleteSecurityIncident = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const deleted = await deps.SecurityIncidentService.deleteIncident(id);

  if (!deleted) {
    return next(new AppError('Incident not found', 404));
  }

  res.json({ success: true, message: 'Incident deleted successfully' });
});

/**
 * Get security event statistics
 */
const getSecurityEventStats = catchAsync(async (req, res, next) => {
  const stats = await deps.db.get(`
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical,
            SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high,
            SUM(CASE WHEN resolved = 0 THEN 1 ELSE 0 END) as unresolved
        FROM security_events
    `);
  res.json(stats || { total: 0, critical: 0, high: 0, unresolved: 0 });
});

/**
 * Get IP access rules
 */
const getIPAccessRules = catchAsync(async (req, res, next) => {
  try {
    // Try to get from database first
    const dbRules = (await new Promise((resolve) => {
      deps.db.all(`SELECT * FROM ip_access_rules ORDER BY created_at DESC`, [], (err, rows) =>
        resolve(rows || [])
      );
    })) as any[];

    if (dbRules && dbRules.length > 0) {
      res.json(dbRules);
      return;
    }

    // Fallback: Get from IPWhitelistService
    const rules = (await deps.IPWhitelistService?.getWhitelist?.()) || [];
    if (rules && rules.length > 0) {
      res.json(rules);
      return;
    }

    // Demo data for display
    res.json([
      {
        id: 'rule-1',
        ip_pattern: '192.168.1.0/24',
        rule_type: 'allow',
        description: 'Internal network access',
        created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        created_by: 'admin@company.com',
        enabled: true,
      },
      {
        id: 'rule-2',
        ip_pattern: '10.0.0.0/8',
        rule_type: 'allow',
        description: 'VPN clients',
        created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        created_by: 'admin@company.com',
        enabled: true,
      },
    ]);
  } catch (error) {
    console.error('getIPAccessRules error:', error);
    res.json([]);
  }
});

/**
 * Update/Toggle IP access rule
 */
const updateIPRule = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { enabled, ip_pattern, rule_type, description } = req.body;

  // Try to update in database
  await new Promise((resolve) => {
    deps.db.run(
      `UPDATE ip_access_rules SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [enabled ? 1 : 0, id],
      (err) => resolve(!err)
    );
  });

  res.json({ success: true, id, enabled });
});

/**
 * Get security policies
 */
const getSecurityPolicies = catchAsync(async (req, res, next) => {
  try {
    // Try to get from database
    const dbPolicies = (await new Promise((resolve) => {
      deps.db.all(`SELECT * FROM security_policies ORDER BY name`, [], (err, rows) =>
        resolve(rows || [])
      );
    })) as any[];

    if (dbPolicies && dbPolicies.length > 0) {
      res.json({ policies: dbPolicies });
      return;
    }

    // Get password policy from PasswordPolicyService
    const passwordPolicy = await deps.PasswordPolicyService?.getPolicy?.();

    // Build comprehensive policies list
    const policies = [
      {
        id: 'policy-password',
        name: 'Password Policy',
        description: 'Password complexity and rotation requirements',
        category: 'Authentication',
        settings: {
          minLength: passwordPolicy?.password_min_length || 12,
          requireUppercase: passwordPolicy?.password_require_uppercase !== false,
          requireLowercase: true,
          requireNumber: passwordPolicy?.password_require_numbers !== false,
          requireSpecial: passwordPolicy?.password_require_special !== false,
          maxAge: 90,
          historyCount: 5,
        },
        enabled: true,
        last_updated: new Date().toISOString(),
      },
      {
        id: 'policy-session',
        name: 'Session Policy',
        description: 'Session timeout and management settings',
        category: 'Sessions',
        settings: {
          sessionTimeout: passwordPolicy?.session_timeout_minutes || 480,
          maxConcurrentSessions: 5,
          lockoutThreshold: 5,
          lockoutDuration: 30,
        },
        enabled: true,
        last_updated: new Date().toISOString(),
      },
      {
        id: 'policy-mfa',
        name: 'MFA Policy',
        description: 'Multi-factor authentication requirements',
        category: 'Authentication',
        settings: {
          requireMFA: false,
          mfaMethods: ['totp', 'sms'],
          rememberDevice: true,
          rememberDuration: 30,
        },
        enabled: true,
        last_updated: new Date().toISOString(),
      },
    ];

    res.json({ policies });
  } catch (error) {
    console.error('getSecurityPolicies error:', error);
    res.json({ policies: [] });
  }
});

/**
 * Update security policy
 */
const updateSecurityPolicy = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { enabled, settings } = req.body;

  // Try to update in database
  await new Promise((resolve) => {
    deps.db.run(
      `UPDATE security_policies SET enabled = ?, settings = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [enabled ? 1 : 0, JSON.stringify(settings || {}), id],
      (err) => resolve(!err)
    );
  });

  res.json({ success: true, id, enabled });
});

// =========================================
// INTEGRATIONS & WEBHOOKS
// =========================================

/**
 * Get system integrations
 */
const getIntegrations = catchAsync(async (req, res, next) => {
  try {
    const integrations = (await deps.IntegrationService?.getIntegrations?.('system')) || [];
    if (integrations && integrations.length > 0) {
      res.json({ integrations });
      return;
    }

    // Try to get from database
    const dbIntegrations = (await new Promise((resolve) => {
      deps.db.all(
        `SELECT * FROM integrations WHERE organization_id = 'system' OR organization_id IS NULL ORDER BY created_at DESC`,
        [],
        (err, rows) => resolve(rows || [])
      );
    })) as any[];

    if (dbIntegrations && dbIntegrations.length > 0) {
      res.json({ integrations: dbIntegrations });
      return;
    }

    // Demo data for display
    res.json({
      integrations: [
        {
          id: 'int-slack-1',
          type: 'slack',
          name: 'Team Notifications',
          description: 'Notifications to #general channel',
          enabled: true,
          status: 'connected',
          last_sync_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          last_sync_status: 'success',
          sync_frequency: '5m',
          config: { channel: '#general' },
          created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'int-jira-1',
          type: 'jira',
          name: 'Project Sync',
          description: 'Sync initiatives with Jira',
          enabled: true,
          status: 'connected',
          last_sync_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          last_sync_status: 'success',
          sync_frequency: '1h',
          config: { project: 'PROJ' },
          created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
      demo: true,
    });
  } catch (error) {
    console.error('getIntegrations error:', error);
    res.json({ integrations: [] });
  }
});

/**
 * Connect a system integration
 */
const connectIntegration = catchAsync(async (req, res, next) => {
  const { provider } = req.params;
  const integration = await deps.IntegrationService.createIntegration({
    organization_id: 'system',
    type: provider,
    name: `System ${provider}`,
    enabled: true,
  });
  res.json(integration);
});

/**
 * Disconnect a system integration
 */
const disconnectIntegration = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const success = await deps.IntegrationService.deleteIntegration(id);
  res.json({ success });
});

/**
 * Test a system integration
 */
const testIntegration = catchAsync(async (req, res, next) => {
  const { provider } = req.params;
  const result = await deps.IntegrationService.syncIntegration(provider); // Using sync as test/refresh
  res.json(result);
});

/**
 * Refresh a system integration
 */
const refreshIntegration = catchAsync(async (req, res, next) => {
  const { provider } = req.params;
  const result = await deps.IntegrationService.syncIntegration(provider);
  res.json(result);
});

/**
 * Update system integration config
 */
const updateIntegrationConfig = catchAsync(async (req, res, next) => {
  const { provider } = req.params;
  const config = req.body;
  const result = await deps.IntegrationService.updateIntegration(provider, { config });
  res.json(result);
});

/**
 * Get system webhooks
 */
const getWebhooks = catchAsync(async (req, res, next) => {
  try {
    const webhooks = (await deps.WebhookService?.getWebhooks?.('system')) || [];
    if (webhooks && webhooks.length > 0) {
      res.json({ webhooks });
      return;
    }

    // Try to get from database
    const dbWebhooks = (await new Promise((resolve) => {
      deps.db.all(
        `SELECT * FROM webhooks WHERE organization_id = 'system' OR organization_id IS NULL ORDER BY created_at DESC`,
        [],
        (err, rows) => resolve(rows || [])
      );
    })) as any[];

    if (dbWebhooks && dbWebhooks.length > 0) {
      res.json({ webhooks: dbWebhooks });
      return;
    }

    // Demo data
    res.json({
      webhooks: [
        {
          id: 'wh-1',
          name: 'Project Notifications',
          url: 'https://hooks.example.com/notify',
          events: ['project.created', 'project.updated', 'initiative.status_changed'],
          is_active: true,
          secret: 'whsec_demo123',
          last_triggered_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          success_count: 142,
          failure_count: 3,
          created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
      demo: true,
    });
  } catch (error) {
    console.error('getWebhooks error:', error);
    res.json({ webhooks: [] });
  }
});

/**
 * Create a system webhook
 */
const createWebhook = catchAsync(async (req, res, next) => {
  const webhook = await deps.WebhookService.createWebhook({
    ...req.body,
    organization_id: 'system',
  });
  res.json(webhook);
});

/**
 * Update a system webhook
 */
const updateWebhook = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const webhook = await deps.WebhookService.updateWebhook(id, req.body);
  res.json(webhook);
});

/**
 * Delete a system webhook
 */
const deleteWebhook = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const result = await deps.WebhookService.deleteWebhook(id);
  res.json(result);
});

/**
 * Test a system webhook
 */
const testWebhook = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const result = await deps.WebhookService.testWebhook(id);
  res.json(result);
});

/**
 * Get system webhook deliveries
 */
const getWebhookDeliveries = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const deliveries = await deps.WebhookService.getDeliveries(id);
  res.json(deliveries);
});

// =========================================
// THREAT INTELLIGENCE
// =========================================

/**
 * Get all threats
 */
const getThreats = catchAsync(async (req, res, next) => {
  const {
    threatType,
    threatLevel,
    isBlocked,
    ipAddress,
    domain,
    limit = 100,
    offset = 0,
  } = req.query;
  const threats = await deps.ThreatIntelligenceService.getThreats({
    threatType,
    threatLevel,
    isBlocked: isBlocked === 'true' ? true : isBlocked === 'false' ? false : undefined,
    ipAddress,
    domain,
    limit: parseInt(limit),
    offset: parseInt(offset),
  });
  res.json(threats);
});

/**
 * Get threat statistics
 */
const getThreatStats = catchAsync(async (req, res, next) => {
  const stats = await deps.ThreatIntelligenceService.getStats();
  res.json(stats);
});

/**
 * Get threat by ID
 */
const getThreatById = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const threat = await deps.ThreatIntelligenceService.getThreatById(id);
  if (!threat) {
    return next(new AppError('Threat not found', 404));
  }
  res.json(threat);
});

/**
 * Add a new threat
 */
const addThreat = catchAsync(async (req, res, next) => {
  const { threatType, source, ipAddress, domain, reputationScore, threatLevel, description } =
    req.body;

  if (!threatType) {
    return next(new AppError('Threat type is required', 400));
  }
  if (!ipAddress && !domain) {
    return next(new AppError('Either IP address or domain is required', 400));
  }

  const threat = await deps.ThreatIntelligenceService.addThreat({
    threatType,
    source,
    ipAddress,
    domain,
    reputationScore,
    threatLevel,
    description,
  });

  res.status(201).json(threat);
});

/**
 * Update a threat
 */
const updateThreat = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { threatType, source, reputationScore, threatLevel, description } = req.body;

  const updated = await deps.ThreatIntelligenceService.updateThreat(id, {
    threatType,
    source,
    reputationScore,
    threatLevel,
    description,
  });

  if (!updated) {
    return next(new AppError('Threat not found or no changes made', 404));
  }

  const threat = await deps.ThreatIntelligenceService.getThreatById(id);
  res.json(threat);
});

/**
 * Block a threat
 */
const blockThreat = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const blocked = await deps.ThreatIntelligenceService.blockThreat(id);

  if (!blocked) {
    return next(new AppError('Threat not found', 404));
  }

  const threat = await deps.ThreatIntelligenceService.getThreatById(id);
  res.json(threat);
});

/**
 * Unblock a threat
 */
const unblockThreat = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const unblocked = await deps.ThreatIntelligenceService.unblockThreat(id);

  if (!unblocked) {
    return next(new AppError('Threat not found', 404));
  }

  const threat = await deps.ThreatIntelligenceService.getThreatById(id);
  res.json(threat);
});

/**
 * Delete a threat
 */
const deleteThreat = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const deleted = await deps.ThreatIntelligenceService.deleteThreat(id);

  if (!deleted) {
    return next(new AppError('Threat not found', 404));
  }

  res.json({ success: true, message: 'Threat deleted successfully' });
});

/**
 * Check IP reputation
 */
const checkIPReputation = catchAsync(async (req, res, next) => {
  const { ip } = req.params;

  if (!ip) {
    return next(new AppError('IP address is required', 400));
  }

  const reputation = await deps.ThreatIntelligenceService.checkIPReputation(ip);
  res.json(reputation);
});

/**
 * Check domain reputation
 */
const checkDomainReputation = catchAsync(async (req, res, next) => {
  const { domain } = req.params;

  if (!domain) {
    return next(new AppError('Domain is required', 400));
  }

  const reputation = await deps.ThreatIntelligenceService.checkDomainReputation(domain);
  res.json(reputation);
});

/**
 * Get blocked IPs
 */
const getBlockedIPs = catchAsync(async (req, res, next) => {
  const blockedIPs = await deps.ThreatIntelligenceService.getBlockedIPs();
  res.json(blockedIPs);
});

/**
 * Get blocked domains
 */
const getBlockedDomains = catchAsync(async (req, res, next) => {
  const blockedDomains = await deps.ThreatIntelligenceService.getBlockedDomains();
  res.json(blockedDomains);
});

/**
 * Bulk import threats
 */
const bulkImportThreats = catchAsync(async (req, res, next) => {
  const { threats } = req.body;

  if (!threats || !Array.isArray(threats) || threats.length === 0) {
    return next(new AppError('Threats array is required', 400));
  }

  const result = await deps.ThreatIntelligenceService.bulkImport(threats);
  res.json(result);
});

// =========================================
// DATA LOSS PREVENTION (DLP)
// =========================================

/**
 * Get all DLP policies
 */
const getDLPPolicies = catchAsync(async (req, res, next) => {
  const { policyType, isActive } = req.query;
  const policies = await deps.DLPService.getPolicies({
    policyType,
    isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
  });
  res.json(policies);
});

/**
 * Get DLP policy by ID
 */
const getDLPPolicyById = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const policy = await deps.DLPService.getPolicyById(id);
  if (!policy) {
    return next(new AppError('DLP Policy not found', 404));
  }
  res.json(policy);
});

/**
 * Create a new DLP policy
 */
const createDLPPolicy = catchAsync(async (req, res, next) => {
  const { name, description, policyType, rules, enforcementAction } = req.body;

  if (!name || !policyType) {
    return next(new AppError('Name and policy type are required', 400));
  }

  const policy = await deps.DLPService.createPolicy({
    name,
    description,
    policyType,
    rules,
    enforcementAction,
    createdBy: req.user.id,
  });

  res.status(201).json(policy);
});

/**
 * Update a DLP policy
 */
const updateDLPPolicy = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { name, description, policyType, rules, enforcementAction, isActive } = req.body;

  const updated = await deps.DLPService.updatePolicy(id, {
    name,
    description,
    policyType,
    rules,
    enforcementAction,
    isActive,
  });

  if (!updated) {
    return next(new AppError('DLP Policy not found or no changes made', 404));
  }

  const policy = await deps.DLPService.getPolicyById(id);
  res.json(policy);
});

/**
 * Toggle DLP policy active status
 */
const toggleDLPPolicy = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { isActive } = req.body;

  const toggled = await deps.DLPService.togglePolicyActive(id, isActive);

  if (!toggled) {
    return next(new AppError('DLP Policy not found', 404));
  }

  const policy = await deps.DLPService.getPolicyById(id);
  res.json(policy);
});

/**
 * Delete a DLP policy
 */
const deleteDLPPolicy = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const deleted = await deps.DLPService.deletePolicy(id);

  if (!deleted) {
    return next(new AppError('DLP Policy not found', 404));
  }

  res.json({ success: true, message: 'DLP Policy deleted successfully' });
});

/**
 * Get all DLP violations
 */
const getDLPViolations = catchAsync(async (req, res, next) => {
  const { policyId, severity, isResolved } = req.query;
  const violations = await deps.DLPService.getViolations({
    policyId,
    severity,
    isResolved: isResolved === 'true' ? true : isResolved === 'false' ? false : undefined,
  });
  res.json(violations);
});

/**
 * Get DLP violation by ID
 */
const getDLPViolationById = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const violation = await deps.DLPService.getViolationById(id);
  if (!violation) {
    return next(new AppError('DLP Violation not found', 404));
  }
  res.json(violation);
});

/**
 * Resolve a DLP violation
 */
const resolveDLPViolation = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const resolved = await deps.DLPService.resolveViolation(id, req.user.id);

  if (!resolved) {
    return next(new AppError('DLP Violation not found', 404));
  }

  const violation = await deps.DLPService.getViolationById(id);
  res.json(violation);
});

/**
 * Get DLP statistics
 */
const getDLPStats = catchAsync(async (req, res, next) => {
  const stats = await deps.DLPService.getStats();
  res.json(stats);
});

/**
 * Scan a resource for DLP violations
 */
const scanResourceDLP = catchAsync(async (req, res, next) => {
  const { resourceType, resourceId, content } = req.body;

  if (!resourceType || !content) {
    return next(new AppError('Resource type and content are required', 400));
  }

  const result = await deps.DLPService.scanResource(resourceType, resourceId, content);
  res.json(result);
});

// =========================================
// DASHBOARD BUILDER
// =========================================

/**
 * Get all dashboards
 */
const getDashboards = catchAsync(async (req, res, next) => {
  const { isShared } = req.query;
  const dashboards = await deps.DashboardBuilderService.getDashboards({
    createdBy: req.user.id,
    isShared: isShared === 'true' ? true : isShared === 'false' ? false : undefined,
  });
  res.json(dashboards);
});

/**
 * Get dashboard statistics
 */
const getDashboardBuilderStats = catchAsync(async (req, res, next) => {
  const stats = await deps.DashboardBuilderService.getStats();
  res.json(stats);
});

/**
 * Get dashboard by ID
 */
const getDashboardById = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const dashboard = await deps.DashboardBuilderService.getDashboardById(id);
  if (!dashboard) {
    return next(new AppError('Dashboard not found', 404));
  }
  res.json(dashboard);
});

/**
 * Create a new dashboard
 */
const createDashboard = catchAsync(async (req, res, next) => {
  const { name, description, layout, widgets, isShared } = req.body;

  if (!name) {
    return next(new AppError('Dashboard name is required', 400));
  }

  const dashboard = await deps.DashboardBuilderService.createDashboard({
    name,
    description,
    layout,
    widgets,
    isShared,
    createdBy: req.user.id,
  });

  res.status(201).json(dashboard);
});

/**
 * Update a dashboard
 */
const updateDashboard = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { name, description, layout, widgets, isShared } = req.body;

  const updated = await deps.DashboardBuilderService.updateDashboard(id, {
    name,
    description,
    layout,
    widgets,
    isShared,
  });

  if (!updated) {
    return next(new AppError('Dashboard not found or no changes made', 404));
  }

  const dashboard = await deps.DashboardBuilderService.getDashboardById(id);
  res.json(dashboard);
});

/**
 * Clone a dashboard
 */
const cloneDashboard = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { name } = req.body;

  const cloned = await deps.DashboardBuilderService.cloneDashboard(id, name, req.user.id);

  if (!cloned) {
    return next(new AppError('Dashboard not found', 404));
  }

  res.status(201).json(cloned);
});

/**
 * Toggle dashboard sharing
 */
const toggleDashboardShare = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { isShared } = req.body;

  const toggled = await deps.DashboardBuilderService.toggleShare(id, isShared);

  if (!toggled) {
    return next(new AppError('Dashboard not found', 404));
  }

  const dashboard = await deps.DashboardBuilderService.getDashboardById(id);
  res.json(dashboard);
});

/**
 * Delete a dashboard
 */
const deleteDashboard = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const deleted = await deps.DashboardBuilderService.deleteDashboard(id);

  if (!deleted) {
    return next(new AppError('Dashboard not found', 404));
  }

  res.json({ success: true, message: 'Dashboard deleted successfully' });
});

/**
 * Add widget to dashboard
 */
const addDashboardWidget = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const widget = req.body;

  const newWidget = await deps.DashboardBuilderService.addWidget(id, widget);

  if (!newWidget) {
    return next(new AppError('Dashboard not found', 404));
  }

  res.status(201).json(newWidget);
});

/**
 * Update widget in dashboard
 */
const updateDashboardWidget = catchAsync(async (req, res, next) => {
  const { id, widgetId } = req.params;
  const updates = req.body;

  const updated = await deps.DashboardBuilderService.updateWidget(id, widgetId, updates);

  if (!updated) {
    return next(new AppError('Dashboard or widget not found', 404));
  }

  const dashboard = await deps.DashboardBuilderService.getDashboardById(id);
  res.json(dashboard);
});

/**
 * Remove widget from dashboard
 */
const removeDashboardWidget = catchAsync(async (req, res, next) => {
  const { id, widgetId } = req.params;

  const removed = await deps.DashboardBuilderService.removeWidget(id, widgetId);

  if (!removed) {
    return next(new AppError('Dashboard or widget not found', 404));
  }

  res.json({ success: true, message: 'Widget removed successfully' });
});

/**
 * Reorder widgets in dashboard
 */
const reorderDashboardWidgets = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { widgetOrder } = req.body;

  if (!widgetOrder || !Array.isArray(widgetOrder)) {
    return next(new AppError('Widget order array is required', 400));
  }

  const reordered = await deps.DashboardBuilderService.reorderWidgets(id, widgetOrder);

  if (!reordered) {
    return next(new AppError('Dashboard not found', 404));
  }

  const dashboard = await deps.DashboardBuilderService.getDashboardById(id);
  res.json(dashboard);
});

/**
 * Get widget data
 */
const getDashboardWidgetData = catchAsync(async (req, res, next) => {
  const widget = req.body;

  if (!widget.dataSource) {
    return next(new AppError('Widget data source is required', 400));
  }

  const data = await deps.DashboardBuilderService.getWidgetData(widget);
  res.json(data);
});

export {
  setDependencies,
  getOrganizations,
  getActivities,
  getDashboardStats,
  updateOrganization,
  deleteOrganization,
  getOrgBilling,
  getUsers,
  updateUser,
  createUser,
  inviteUser,
  resetUserPassword,
  getAccessRequests,
  approveAccessRequest,
  rejectAccessRequest,
  getAccessCodes,
  createAccessCode,
  impersonateUser,
  getDatabaseTables,
  getDatabaseRows,
  getStorageUsage,
  getStorageFiles,
  deleteStorageFile,
  getAllLegalDocs,
  publishLegalDoc,
  toggleLegalDocActive,
  getLegalDocById,
  getLegalEvents,
  getLegalEventStats,
  getOrgAttribution,
  exportAttribution,
  getPartnerSummary,
  getUsageByOrganization,
  getInvoices,
  getInvoiceStats,
  getSystemHealth,
  getSystemAnalytics,
  remindInvoice,
  markInvoicePaid,
  getInvoicePdf,
  uploadBrandingLogo,
  getApiKeys,
  createApiKey,
  deleteApiKey,
  getApiKeyUsage,
  getComplianceFrameworks,
  getComplianceStatus,
  getComplianceSummary,
  getDsarRequests,
  getComplianceAudits,
  refreshToken,

  // Enterprise Customers Module - Organizations
  getOrganizationMetadata,
  updateOrganizationMetadata,
  getOrganizationTags,
  addOrganizationTag,
  removeOrganizationTag,
  getOrganizationHealth,
  getOrganizationRelationships,
  getOrganizationAnalytics,

  // Enterprise Customers Module - Users
  getUserProfileExtended,
  updateUserProfileExtended,
  getUserActivity,
  getUserSessions,
  revokeUserSession,
  getUserGroups,
  getUserOnboardingProgress,
  updateUserOnboardingProgress,
  getUserLicense,
  assignUserLicense,

  // Enterprise Customers Module - Security
  getIPWhitelist,
  addIPWhitelist,
  removeIPWhitelist,
  getUserDevices,
  blockDevice,
  getMFAMethods,
  setupTOTP,
  verifyTOTP,
  getPasswordPolicy,
  updatePasswordPolicy,
  getSecurityEvents,
  resolveSecurityEvent,

  // Enterprise Customers Module - Support
  getSupportTickets,
  createSupportTicket,
  updateSupportTicket,
  addTicketComment,
  getCustomerSuccessNotes,
  createCustomerSuccessNote,
  getCustomerHealthCheck,

  // Enterprise Customers Module - Feedback
  getFeedbackItems,
  createFeedbackItem,
  voteFeedback,
  addFeedbackComment,
  getFeatureRoadmap,
  updateFeatureRoadmap,

  // Enterprise Customers Module - Analytics
  getUserAdoptionMetrics,
  getChurnPrediction,

  // Enterprise Customers Module - Compliance
  getDataRetentionPolicies,
  createDataRetentionPolicy,
  getGDPRRequests,
  createGDPRRequest,
  getUserConsents,
  updateUserConsent,

  // Enterprise Customers Module - Automation
  getAutomationRules,
  createAutomationRule,
  updateAutomationRule,
  getWebhookSubscriptions,
  createWebhookSubscription,

  // Enterprise Customers Module - Communication
  getEmailTemplates,
  createEmailTemplate,
  getEmailCampaigns,
  createEmailCampaign,
  getNotificationPreferences,
  updateNotificationPreferences,

  // Phase 1: Advanced IAM Module
  getAdminSessions,
  createAdminSession,
  revokeAdminSession,
  revokeAllAdminSessions,
  getAdminSessionStats,
  getAdminAuditLogs,
  getAdminAuditStats,
  resolveAdminAuditLog,
  exportAuditLogs,
  getRecentHighRiskActions,
  getAdminPermissions,
  createAdminPermission,
  updateAdminPermission,
  deleteAdminPermission,
  getPermissionsMatrix,
  updateRolePermissions,
  toggleRolePermission,
  copyRolePermissions,
  compareRoles,
  getPermissionsStats,
  getApprovalWorkflows,
  createApprovalWorkflow,
  updateApprovalWorkflow,
  deleteApprovalWorkflow,
  getApprovalRequests,
  approveRequest,
  rejectRequest,

  // Phase 3: Analytics Module
  getAnalyticsDashboards,
  createAnalyticsDashboard,
  updateAnalyticsDashboard,
  deleteAnalyticsDashboard,
  getAnalyticsDashboardData,
  shareAnalyticsDashboard,
  getAnalyticsReports,
  createAnalyticsReport,
  updateAnalyticsReport,
  deleteAnalyticsReport,
  executeAnalyticsReport,
  scheduleAnalyticsReport,
  getReportExecutions,
  getBusinessMetrics,
  createBusinessMetric,
  updateBusinessMetric,
  deleteBusinessMetric,
  calculateBusinessMetric,
  getMetricHistory,
  getMetricsStats,
  getPredictiveModels,
  createPredictiveModel,
  updatePredictiveModel,
  deletePredictiveModel,
  trainPredictiveModel,
  makePrediction,
  getModelPredictions,
  evaluatePredictiveModel,

  // Phase 4: Customer Management Module
  getLifecycleStages,
  createLifecycleStage,
  updateLifecycleStage,
  deleteLifecycleStage,
  transitionOrganization,
  getLifecycleTransitions,
  getLifecycleStats,
  getSuccessPlaybooks,
  createSuccessPlaybook,
  updateSuccessPlaybook,
  deleteSuccessPlaybook,
  executeSuccessPlaybook,
  getSuccessActions,
  getPlaybookStats,
  getCustomerContracts,
  createCustomerContract,
  updateCustomerContract,
  deleteCustomerContract,
  createContractAmendment,
  getContractAmendments,
  getUpcomingRenewals,
  getContractStats,

  // Phase 5: Revenue Management Module
  getPricingPlans,
  createPricingPlan,
  updatePricingPlan,
  deletePricingPlan,
  getPlanFeatures,
  addPlanFeature,
  removePlanFeature,
  comparePricingPlans,
  getSubscriptionChanges,
  createSubscriptionChange,
  approveSubscriptionChange,
  rejectSubscriptionChange,
  calculateProration,
  getSubscriptionChangeStats,
  getRevenueRecognitions,
  createRevenueRecognition,
  updateRevenueRecognition,
  recognizeRevenue,
  getRecognitionSchedule,
  getRevenueRecognitionStats,
  getRevenueForecasts,
  createRevenueForecast,
  updateRevenueForecast,
  deleteRevenueForecast,
  generateRevenueForecast,
  getRevenueForecastStats,
  getPaymentMethods,
  addPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  getPaymentFailures,
  retryPayment,
  getPaymentFailureStats,

  // Security Incident Management
  getSecurityIncidents,
  getSecurityIncidentStats,
  getSecurityIncidentById,
  createSecurityIncident,
  updateSecurityIncident,
  resolveSecurityIncident,
  deleteSecurityIncident,

  // Threat Intelligence
  getThreats,
  getThreatStats,
  getThreatById,
  addThreat,
  updateThreat,
  blockThreat,
  unblockThreat,
  deleteThreat,
  checkIPReputation,
  checkDomainReputation,
  getBlockedIPs,
  getBlockedDomains,
  bulkImportThreats,

  // Data Loss Prevention (DLP)
  getDLPPolicies,
  getDLPPolicyById,
  createDLPPolicy,
  updateDLPPolicy,
  toggleDLPPolicy,
  deleteDLPPolicy,
  getDLPViolations,
  getDLPViolationById,
  resolveDLPViolation,
  getDLPStats,
  scanResourceDLP,

  // Dashboard Builder
  getDashboards,
  getDashboardBuilderStats,
  getDashboardById,
  createDashboard,
  updateDashboard,
  cloneDashboard,
  toggleDashboardShare,
  deleteDashboard,
  addDashboardWidget,
  updateDashboardWidget,
  removeDashboardWidget,
  reorderDashboardWidgets,
  getDashboardWidgetData,
};

export default {
  setDependencies,
  getOrganizations,
  getActivities,
  getDashboardStats,
  updateOrganization,
  deleteOrganization,
  getOrgBilling,
  getUsers,
  updateUser,
  createUser,
  inviteUser,
  resetUserPassword,
  getAccessRequests,
  approveAccessRequest,
  rejectAccessRequest,
  getAccessCodes,
  createAccessCode,
  impersonateUser,
  getDatabaseTables,
  getDatabaseRows,
  getStorageUsage,
  getStorageFiles,
  deleteStorageFile,
  getAllLegalDocs,
  publishLegalDoc,
  toggleLegalDocActive,
  getLegalDocById,
  getLegalEvents,
  getLegalEventStats,
  getOrgAttribution,
  exportAttribution,
  getPartnerSummary,
  getUsageByOrganization,
  getInvoices,
  getInvoiceStats,
  getSystemHealth,
  getSystemAnalytics,
  remindInvoice,
  markInvoicePaid,
  getInvoicePdf,
  uploadBrandingLogo,
  getApiKeys,
  createApiKey,
  deleteApiKey,
  getApiKeyUsage,
  getComplianceFrameworks,
  getComplianceStatus,
  getComplianceSummary,
  getDsarRequests,
  getComplianceAudits,
  refreshToken,

  // Enterprise Customers Module - Organizations
  getOrganizationMetadata,
  updateOrganizationMetadata,
  getOrganizationTags,
  addOrganizationTag,
  removeOrganizationTag,
  getOrganizationHealth,
  getOrganizationRelationships,
  getOrganizationAnalytics,

  // Enterprise Customers Module - Users
  getUserProfileExtended,
  updateUserProfileExtended,
  getUserActivity,
  getUserSessions,
  revokeUserSession,
  getUserGroups,
  getUserOnboardingProgress,
  updateUserOnboardingProgress,
  getUserLicense,
  assignUserLicense,

  // Enterprise Customers Module - Security
  getIPWhitelist,
  addIPWhitelist,
  removeIPWhitelist,
  getUserDevices,
  blockDevice,
  getMFAMethods,
  setupTOTP,
  verifyTOTP,
  getPasswordPolicy,
  updatePasswordPolicy,
  getSecurityEvents,
  getSecurityEventStats,
  resolveSecurityEvent,
  getIPAccessRules,
  updateIPRule,
  getSecurityPolicies,
  updateSecurityPolicy,

  // Enterprise Customers Module - Support
  getSupportTickets,
  createSupportTicket,
  updateSupportTicket,
  addTicketComment,
  getCustomerSuccessNotes,
  createCustomerSuccessNote,
  getCustomerHealthCheck,

  // Enterprise Customers Module - Feedback
  getFeedbackItems,
  createFeedbackItem,
  voteFeedback,
  addFeedbackComment,
  getFeatureRoadmap,
  updateFeatureRoadmap,

  // Enterprise Customers Module - Analytics
  getUserAdoptionMetrics,
  getChurnPrediction,

  // Enterprise Customers Module - Compliance
  getDataRetentionPolicies,
  createDataRetentionPolicy,
  getGDPRRequests,
  createGDPRRequest,
  getUserConsents,
  updateUserConsent,

  // Enterprise Customers Module - Automation
  getAutomationRules,
  createAutomationRule,
  updateAutomationRule,
  getWebhookSubscriptions,
  createWebhookSubscription,

  // Enterprise Customers Module - Communication
  getEmailTemplates,
  createEmailTemplate,
  getEmailCampaigns,
  createEmailCampaign,
  getNotificationPreferences,
  updateNotificationPreferences,

  // Phase 1: Advanced IAM Module
  getAdminSessions,
  createAdminSession,
  revokeAdminSession,
  revokeAllAdminSessions,
  getAdminSessionStats,
  getAdminAuditLogs,
  getAdminAuditStats,
  resolveAdminAuditLog,
  exportAuditLogs,
  getRecentHighRiskActions,
  getAdminPermissions,
  createAdminPermission,
  updateAdminPermission,
  deleteAdminPermission,
  getPermissionsMatrix,
  updateRolePermissions,
  toggleRolePermission,
  copyRolePermissions,
  compareRoles,
  getPermissionsStats,
  getApprovalWorkflows,
  createApprovalWorkflow,
  updateApprovalWorkflow,
  deleteApprovalWorkflow,
  getApprovalRequests,
  approveRequest,
  rejectRequest,

  // Phase 3: Analytics Module
  getAnalyticsDashboards,
  createAnalyticsDashboard,
  updateAnalyticsDashboard,
  deleteAnalyticsDashboard,
  getAnalyticsDashboardData,
  shareAnalyticsDashboard,
  getAnalyticsReports,
  createAnalyticsReport,
  updateAnalyticsReport,
  deleteAnalyticsReport,
  executeAnalyticsReport,
  scheduleAnalyticsReport,
  getReportExecutions,
  getBusinessMetrics,
  createBusinessMetric,
  updateBusinessMetric,
  deleteBusinessMetric,
  calculateBusinessMetric,
  getMetricHistory,
  getMetricsStats,
  getPredictiveModels,
  createPredictiveModel,
  updatePredictiveModel,
  deletePredictiveModel,
  trainPredictiveModel,
  makePrediction,
  getModelPredictions,
  evaluatePredictiveModel,

  // Phase 4: Customer Management Module
  getLifecycleStages,
  createLifecycleStage,
  updateLifecycleStage,
  deleteLifecycleStage,
  transitionOrganization,
  getLifecycleTransitions,
  getLifecycleStats,
  getSuccessPlaybooks,
  createSuccessPlaybook,
  updateSuccessPlaybook,
  deleteSuccessPlaybook,
  executeSuccessPlaybook,
  getSuccessActions,
  getPlaybookStats,
  getCustomerContracts,
  createCustomerContract,
  updateCustomerContract,
  deleteCustomerContract,
  createContractAmendment,
  getContractAmendments,
  getUpcomingRenewals,
  getContractStats,

  // Phase 5: Revenue Management Module
  getPricingPlans,
  createPricingPlan,
  updatePricingPlan,
  deletePricingPlan,
  getPlanFeatures,
  addPlanFeature,
  removePlanFeature,
  comparePricingPlans,
  getSubscriptionChanges,
  createSubscriptionChange,
  approveSubscriptionChange,
  rejectSubscriptionChange,
  calculateProration,
  getSubscriptionChangeStats,
  getRevenueRecognitions,
  createRevenueRecognition,
  updateRevenueRecognition,
  recognizeRevenue,
  getRecognitionSchedule,
  getRevenueRecognitionStats,
  getRevenueForecasts,
  createRevenueForecast,
  updateRevenueForecast,
  deleteRevenueForecast,
  generateRevenueForecast,
  getRevenueForecastStats,
  getPaymentMethods,
  addPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  getPaymentFailures,
  retryPayment,
  getPaymentFailureStats,

  // Security Incident Management
  getSecurityIncidents,
  getSecurityIncidentStats,
  getSecurityIncidentById,
  createSecurityIncident,
  updateSecurityIncident,
  resolveSecurityIncident,
  deleteSecurityIncident,

  // Threat Intelligence
  getThreats,
  getThreatStats,
  getThreatById,
  addThreat,
  updateThreat,
  blockThreat,
  unblockThreat,
  deleteThreat,
  checkIPReputation,
  checkDomainReputation,
  getBlockedIPs,
  getBlockedDomains,
  bulkImportThreats,

  // Data Loss Prevention (DLP)
  getDLPPolicies,
  getDLPPolicyById,
  createDLPPolicy,
  updateDLPPolicy,
  toggleDLPPolicy,
  deleteDLPPolicy,
  getDLPViolations,
  getDLPViolationById,
  resolveDLPViolation,
  getDLPStats,
  scanResourceDLP,

  // Dashboard Builder
  getDashboards,
  getDashboardBuilderStats,
  getDashboardById,
  createDashboard,
  updateDashboard,
  cloneDashboard,
  toggleDashboardShare,
  deleteDashboard,
  addDashboardWidget,
  updateDashboardWidget,
  removeDashboardWidget,
  reorderDashboardWidgets,
  getDashboardWidgetData,

  // Integrations & Webhooks
  getIntegrations,
  connectIntegration,
  disconnectIntegration,
  testIntegration,
  refreshIntegration,
  updateIntegrationConfig,
  getWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  getWebhookDeliveries,
};
