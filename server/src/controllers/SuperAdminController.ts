// @ts-nocheck
// NOTE: This file is the legacy monolith being progressively decomposed into
// domain-specific controllers under ./superadmin/. New code should go there.
// The @ts-nocheck remains only for the legacy handlers still in this file;
// extracted domain controllers have full TypeScript checking.

// `speakeasy` was previously pulled in with `require('speakeasy')` inside the
// TOTP handlers. This package is ESM ("type": "module") and the file has no
// `createRequire`, so `require` is not defined at runtime — both handlers threw
// ReferenceError before reaching any SQL. speakeasy is CommonJS, so a default
// import is the correct interop form here.
import speakeasy from 'speakeasy';

import AccessCodeService from '../services/accessCodeService.js';
import auditEventsService from '../services/AuditEventsService.js';
import { alertPrivilegeEscalation } from '../services/securityAlerts.js';
import { hasColumn } from '../utils/dbSchema.js';
import logger from '../utils/Logger.js';
import { flagOn } from '../utils/pgFlags.js';
import { buildSeedExclusion, isSeedRequested } from '../utils/superadminSeedFilter.js';
import * as customerCtrl from './superadmin/customerController.js';
import {
  createContractAmendment,
  createCustomerContract,
  createLifecycleStage,
  createSuccessPlaybook,
  deleteCustomerContract,
  deleteLifecycleStage,
  deleteSuccessPlaybook,
  executeSuccessPlaybook,
  getContractAmendments,
  getContractStats,
  getCustomerContracts,
  getLifecycleStages,
  getLifecycleStats,
  getLifecycleTransitions,
  getPlaybookStats,
  getSuccessActions,
  getSuccessPlaybooks,
  getUpcomingRenewals,
  transitionOrganization,
  updateCustomerContract,
  updateLifecycleStage,
  updateSuccessPlaybook,
} from './superadmin/customerController.js';
import * as dashboardCtrl from './superadmin/dashboardController.js';
import {
  addDashboardWidget,
  cloneDashboard,
  createDashboard,
  deleteDashboard,
  getDashboardBuilderStats,
  getDashboardById,
  getDashboards,
  getDashboardWidgetData,
  removeDashboardWidget,
  reorderDashboardWidgets,
  toggleDashboardShare,
  updateDashboard,
  updateDashboardWidget,
} from './superadmin/dashboardController.js';
import * as integrationsCtrl from './superadmin/integrationsController.js';
import * as revenueCtrl from './superadmin/revenueController.js';
import {
  addPaymentMethod,
  addPlanFeature,
  approveSubscriptionChange,
  calculateProration,
  comparePricingPlans,
  createPricingPlan,
  createRevenueForecast,
  createRevenueRecognition,
  createSubscriptionChange,
  deletePaymentMethod,
  deletePricingPlan,
  deleteRevenueForecast,
  generateRevenueForecast,
  getPaymentFailures,
  getPaymentFailureStats,
  getPaymentMethods,
  getPlanFeatures,
  getPricingPlans,
  getRecognitionSchedule,
  getRevenueForecasts,
  getRevenueForecastStats,
  getRevenueRecognitions,
  getRevenueRecognitionStats,
  getSubscriptionChanges,
  getSubscriptionChangeStats,
  recognizeRevenue,
  rejectSubscriptionChange,
  removePlanFeature,
  retryPayment,
  updatePaymentMethod,
  updatePricingPlan,
  updateRevenueForecast,
  updateRevenueRecognition,
} from './superadmin/revenueController.js';
// Domain controllers extracted from this monolith. Namespace imports provide
// local bindings that the default export object can reference via spread.
import * as securityCtrl from './superadmin/securityController.js';
import {
  createSecurityIncident,
  deleteSecurityIncident,
  getIPAccessRules,
  getSecurityEventStats,
  getSecurityIncidentById,
  getSecurityIncidents,
  getSecurityIncidentStats,
  getSecurityPolicies,
  resolveSecurityIncident,
  updateIPRule,
  updateSecurityIncident,
  updateSecurityPolicy,
} from './superadmin/securityController.js';
import {
  AppError,
  catchAsync,
  crypto,
  deps,
  getAttributionService,
  getBillingService,
  setDependencies,
  tableExists,
} from './superadmin/shared.js';
import * as threatDlpCtrl from './superadmin/threatDlpController.js';
import {
  addThreat,
  blockThreat,
  bulkImportThreats,
  checkDomainReputation,
  checkIPReputation,
  createDLPPolicy,
  deleteDLPPolicy,
  deleteThreat,
  getBlockedDomains,
  getBlockedIPs,
  getDLPPolicies,
  getDLPPolicyById,
  getDLPStats,
  getDLPViolationById,
  getDLPViolations,
  getThreatById,
  getThreats,
  getThreatStats,
  resolveDLPViolation,
  scanResourceDLP,
  toggleDLPPolicy,
  unblockThreat,
  updateDLPPolicy,
  updateThreat,
} from './superadmin/threatDlpController.js';

/**
 * GET All Organizations
 */
const getOrganizations = catchAsync(async (req, res, next) => {
  const hasDiscountPercent = await hasColumn('organizations', 'discount_percent').catch(
    () => false
  );
  // Non-destructive seed filter: hide ephemeral `demo-org-session-*` scaffolding
  // orgs from the default listing (hundreds of them). `?includeSeed=true` shows all.
  const orgSeed = isSeedRequested(req.query)
    ? { clause: '', params: [] }
    : buildSeedExclusion({ orgIdCol: 'o.id' });
  const orgWhere = orgSeed.clause ? `WHERE ${orgSeed.clause}` : '';
  // Feedback #d11ec6b0 (restored after merge d675885189 dropped it): membership
  // lives in TWO places — users.organization_id (primary tenant) and the
  // organization_members join table. Counting only the former hides users whose
  // primary tenant is elsewhere but who are ACTIVE members here (e.g. an OWNER
  // of aplix-na with primary tenant vts). Count the DISTINCT union of both.
  const sql = `
        SELECT
            o.id, o.name, o.plan, o.status,
            COALESCE(o.trial_started_at, o.created_at) as created_at,
            ${hasDiscountPercent ? 'COALESCE(o.discount_percent, 0)' : '0'} as discount_percent,
            (
                SELECT COUNT(*) FROM (
                    SELECT u.id AS user_id
                      FROM users u
                     WHERE u.organization_id = o.id
                       AND COALESCE(LOWER(u.status), 'active') <> 'deleted'
                    UNION
                    SELECT om.user_id AS user_id
                      FROM organization_members om
                     WHERE om.organization_id = o.id
                       AND (om.status IS NULL OR UPPER(om.status) = 'ACTIVE')
                ) combined
            ) as user_count
        FROM organizations o
        ${orgWhere}
        ORDER BY o.name ASC
    `;

  deps.db.all(sql, orgSeed.params, (err, rows) => {
    if (err) {
      logger.error('[SuperAdmin] Organizations query error:', err);
      return next(new AppError('Failed to fetch organizations', 500));
    }
    res.json((rows || []).map((r: any) => ({ ...r, user_count: Number(r.user_count ?? 0) })));
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
      logger.error('[SuperAdmin] Activity Stats Error:', err);
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
            logger.warn('[SuperAdmin] AI Stats query fallback:', err.message);
            resolve({
              total_ai_calls: 0,
              total_tokens: 0,
              active_users: 0,
              degraded: true,
              error: 'ai_stats_unavailable',
            });
          } else {
            resolve(row || { total_ai_calls: 0, total_tokens: 0, active_users: 0 });
          }
        }
      );
    }),
    deps.ActivityService.getRecent(15).catch((err) => {
      logger.error('[SuperAdmin] Activities Error:', err);
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
          logger.warn('[SuperAdmin] Counts query error:', err.message);
          resolve({
            total_users: 0,
            total_orgs: 0,
            active_users_7d: 0,
            degraded: true,
            error: 'platform_counts_unavailable',
          });
        } else {
          resolve(row || { total_users: 0, total_orgs: 0, active_users_7d: 0 });
        }
      }
    );
  });

  const aiS = aiStats as any;
  const cts = counts as any;
  res.json({
    activity: {
      ...(activityStats as any),
      total: Number((activityStats as any)?.total ?? 0),
      last_hour: Number((activityStats as any)?.last_hour ?? 0),
      last_24h: Number((activityStats as any)?.last_24h ?? 0),
      last_7d: Number((activityStats as any)?.last_7d ?? 0),
    },
    ai: {
      ...aiS,
      total_ai_calls: Number(aiS?.total_ai_calls ?? 0),
      total_tokens: Number(aiS?.total_tokens ?? 0),
      active_users: Number(aiS?.active_users ?? 0),
    },
    counts: {
      ...cts,
      total_users: Number(cts?.total_users ?? 0),
      total_orgs: Number(cts?.total_orgs ?? 0),
      active_users_7d: Number(cts?.active_users_7d ?? 0),
    },
    live: deps.RealtimeService.getGlobalStats(),
    activities: activities || [],
  });
});

/**
 * UPDATE Organization
 */
const updateOrganization = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { name, plan, status, discount_percent } = req.body;

  const validPlans = ['free', 'trial', 'starter', 'pro', 'professional', 'enterprise'];
  const validStatuses = ['active', 'pending', 'blocked', 'suspended', 'cancelled', 'trial'];

  if (plan && !validPlans.includes(plan)) return next(new AppError('Invalid plan', 400));
  if (status && !validStatuses.includes(status)) return next(new AppError('Invalid status', 400));
  if (discount_percent !== undefined && (discount_percent < 0 || discount_percent > 100)) {
    return next(new AppError('Invalid discount percent', 400));
  }

  const updates: string[] = [];
  const params: any[] = [];
  if (name !== undefined) {
    updates.push('name = ?');
    params.push(name);
  }
  if (plan !== undefined) {
    updates.push('plan = ?');
    params.push(plan);
  }
  if (status !== undefined) {
    updates.push('status = ?');
    params.push(status);
  }
  if (discount_percent !== undefined && (await hasColumn('organizations', 'discount_percent'))) {
    updates.push('discount_percent = ?');
    params.push(discount_percent);
  }

  if (updates.length === 0) return res.json({ message: 'No changes submitted' });

  const sql = `UPDATE organizations SET ${updates.join(', ')} WHERE id = ?`;

  const criticalStatusChange = ['suspended', 'blocked', 'cancelled'].includes(status);
  const performUpdate = (beforeStatus) => {
    deps.db.run(sql, [...params, id], async function (err) {
      if (err) return next(new AppError(err.message, 500));
      if (this.changes === 0) return next(new AppError('Organization not found', 404));

      deps.ActivityService.log({
        organizationId: id,
        userId: req.user?.id,
        action: 'updated',
        entityType: 'organization',
        entityId: id,
        newValue: { name, plan, status, discount_percent },
      });

      if (criticalStatusChange) {
        try {
          await req.emitAuditEvent?.({
            action: 'organization.status_changed',
            resourceType: 'organization',
            resourceId: id,
            before: { status: beforeStatus },
            after: { status },
            metadata: {
              reason: res.locals.organizationStatusChangeReason || '',
              via: 'superadmin.update_organization',
            },
          });
        } catch (auditError) {
          return next(new AppError(`Audit write failed: ${auditError.message}`, 503));
        }
      }

      res.json({ message: 'Organization updated' });
    });
  };

  if (!criticalStatusChange) return performUpdate(undefined);
  deps.db.get('SELECT status FROM organizations WHERE id = ?', [id], (err, row) => {
    if (err) return next(new AppError(err.message, 500));
    if (!row) return next(new AppError('Organization not found', 404));
    performUpdate(row.status);
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
  const hasLicensePlanId = await hasColumn('users', 'license_plan_id').catch(() => false);
  const hasUserJobTitle = await hasColumn('users', 'job_title').catch(() => false);
  const hasUserDepartment = await hasColumn('users', 'department').catch(() => false);
  const hasUserProfiles = await tableExists('user_profiles').catch(() => false);
  const hasOrgMembers = await tableExists('organization_members').catch(() => false);
  const organizationId =
    typeof req.query.organizationId === 'string' ? req.query.organizationId.trim() : '';
  const role = typeof req.query.role === 'string' ? req.query.role.trim() : '';
  const status = typeof req.query.status === 'string' ? req.query.status.trim().toLowerCase() : '';
  const queryParams: string[] = [];
  const whereClauses: string[] = [];

  if (organizationId) {
    // Feedback #d11ec6b0 (restored after merge d675885189 dropped it): a user
    // whose primary tenant is elsewhere but who is an ACTIVE organization_members
    // row here must appear in this org's user list (e.g. OWNER of aplix-na with
    // primary tenant vts).
    if (hasOrgMembers) {
      whereClauses.push(
        `(u.organization_id = ? OR u.id IN (
            SELECT om.user_id FROM organization_members om
             WHERE om.organization_id = ?
               AND (om.status IS NULL OR UPPER(om.status) = 'ACTIVE')))`
      );
      queryParams.push(organizationId, organizationId);
    } else {
      whereClauses.push('u.organization_id = ?');
      queryParams.push(organizationId);
    }
  }

  if (role) {
    whereClauses.push('u.role = ?');
    queryParams.push(role);
  }

  if (status) {
    whereClauses.push(`COALESCE(LOWER(u.status), 'active') = ?`);
    queryParams.push(status);
  } else {
    whereClauses.push(`COALESCE(LOWER(u.status), 'active') != 'deleted'`);
  }

  // Non-destructive seed filter: hide seed/test accounts (demo.ateliertoys.com,
  // local.test, test.com, … and ephemeral demo-org-session-* orgs) from the
  // default listing. `?includeSeed=true` returns the full unfiltered set.
  // Skipped when the caller already scopes to a single org, so drilling into a
  // (possibly demo) org still shows all of its members.
  if (!organizationId && !isSeedRequested(req.query)) {
    const userSeed = buildSeedExclusion({ emailCol: 'u.email', orgIdCol: 'u.organization_id' });
    if (userSeed.clause) {
      whereClauses.push(userSeed.clause);
      queryParams.push(...userSeed.params);
    }
  }

  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sql = `
        SELECT
            u.id, u.organization_id, u.email, u.first_name, u.last_name,
            u.role, u.status, u.last_login, u.created_at,
            ${hasLicensePlanId ? 'u.license_plan_id' : 'NULL'} as license_plan_id,
            ${hasUserJobTitle ? 'u.job_title' : hasUserProfiles ? 'up.job_title' : 'NULL'} as job_title,
            ${
              hasUserDepartment
                ? hasUserProfiles
                  ? 'COALESCE(u.department, up.department)'
                  : 'u.department'
                : hasUserProfiles
                  ? 'up.department'
                  : 'NULL'
            } as department,
            ${hasUserProfiles ? 'up.preferences_json' : 'NULL'} as profile_preferences_json,
            o.name as organization_name
        FROM users u
        LEFT JOIN organizations o ON u.organization_id = o.id
        ${hasUserProfiles ? 'LEFT JOIN user_profiles up ON up.user_id = u.id' : ''}
        ${whereClause}
        ORDER BY u.created_at DESC
    `;

  deps.db.all(sql, queryParams, (err, rows) => {
    if (err) return next(new AppError(err.message, 500));

    const users = rows.map((u) => {
      let projectRole: string | undefined;
      if (u.profile_preferences_json) {
        try {
          const parsed = JSON.parse(String(u.profile_preferences_json));
          const candidate = parsed?.defaultProjectRole || parsed?.projectRole;
          if (typeof candidate === 'string' && candidate.trim()) {
            projectRole = candidate.trim();
          }
        } catch (_err) {
          projectRole = undefined;
        }
      }

      return {
        id: u.id,
        organizationId: u.organization_id,
        organizationName: u.organization_name,
        firstName: u.first_name,
        lastName: u.last_name,
        email: u.email,
        role: u.role,
        status: u.status,
        licensePlanId: u.license_plan_id,
        jobTitle: u.job_title || undefined,
        department: u.department || undefined,
        projectRole,
        lastLogin: u.last_login,
        createdAt: u.created_at,
      };
    });
    // Documented shape: { users, total } (see docs/api/SUPERADMIN_API). Keeps dashboard counts and list in sync.
    res.json({ users, total: users.length });
  });
});

/**
 * UPDATE User
 */
const updateUser = catchAsync(async (req, res, next) => {
  const hasLicensePlanId = await hasColumn('users', 'license_plan_id').catch(() => false);
  const hasUserJobTitle = await hasColumn('users', 'job_title').catch(() => false);
  const hasUserDepartment = await hasColumn('users', 'department').catch(() => false);
  const hasUserProfiles = await tableExists('user_profiles').catch(() => false);
  const { id } = req.params;
  const { organizationId, role, status, email, firstName, lastName, licensePlanId } = req.body;
  const jobTitle =
    req.body?.jobTitle === undefined || req.body?.jobTitle === null
      ? undefined
      : String(req.body.jobTitle).trim();
  const department =
    req.body?.department === undefined || req.body?.department === null
      ? undefined
      : String(req.body.department).trim();
  const projectRole =
    req.body?.projectRole === undefined || req.body?.projectRole === null
      ? undefined
      : String(req.body.projectRole).trim();

  const updates: string[] = [];
  const params: any[] = [];

  // Snapshot the target's current role/email BEFORE the update so a privilege
  // escalation (→ SUPER_ADMIN/OWNER) can be alerted with old→new context.
  let priorUser: { role?: string; email?: string } | null = null;
  if (role !== undefined) {
    priorUser = await new Promise((resolve) => {
      deps.db.get('SELECT role, email FROM users WHERE id = ?', [id], (err, row) =>
        resolve((err ? null : (row as { role?: string; email?: string })) || null)
      );
    });
  }

  if (organizationId !== undefined) {
    const targetOrganization = await new Promise((resolve, reject) => {
      deps.db.get('SELECT id FROM organizations WHERE id = ?', [organizationId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    if (!targetOrganization) return next(new AppError('Target organization not found', 404));
    updates.push('organization_id = ?');
    params.push(organizationId);
  }
  if (role !== undefined) {
    updates.push('role = ?');
    params.push(role);
  }
  if (status !== undefined) {
    updates.push('status = ?');
    params.push(status);
  }
  if (email !== undefined) {
    updates.push('email = ?');
    params.push(email);
  }
  if (firstName !== undefined) {
    updates.push('first_name = ?');
    params.push(firstName);
  }
  if (lastName !== undefined) {
    updates.push('last_name = ?');
    params.push(lastName);
  }
  if (hasLicensePlanId && licensePlanId !== undefined) {
    updates.push('license_plan_id = ?');
    params.push(licensePlanId || null);
  }
  if (hasUserJobTitle && jobTitle !== undefined) {
    updates.push('job_title = ?');
    params.push(jobTitle || null);
  }
  if (hasUserDepartment && department !== undefined) {
    updates.push('department = ?');
    params.push(department || null);
  }

  if (updates.length === 0) {
    return res.json({ message: 'No changes submitted' });
  }

  const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;

  const persistProfileFields = (done: (error?: Error) => void) => {
    const shouldPersistProfile =
      hasUserProfiles &&
      (jobTitle !== undefined || department !== undefined || projectRole !== undefined);
    if (!shouldPersistProfile) {
      done();
      return;
    }

    deps.db.get(
      'SELECT job_title, department, preferences_json FROM user_profiles WHERE user_id = ?',
      [id],
      (profileReadErr, existingProfile) => {
        if (profileReadErr) {
          done(new AppError(profileReadErr.message, 500));
          return;
        }

        let preferences: Record<string, unknown> = {};
        const rawPreferences = existingProfile?.preferences_json;
        if (rawPreferences) {
          try {
            preferences = JSON.parse(String(rawPreferences));
          } catch (_err) {
            preferences = {};
          }
        }

        if (projectRole !== undefined) {
          if (projectRole) {
            preferences.defaultProjectRole = projectRole;
          } else {
            delete preferences.defaultProjectRole;
          }
        }

        const nextJobTitle =
          jobTitle !== undefined ? jobTitle || null : existingProfile?.job_title || null;
        const nextDepartment =
          department !== undefined ? department || null : existingProfile?.department || null;

        deps.db.run(
          `INSERT INTO user_profiles (id, user_id, job_title, department, preferences_json, updated_at)
           VALUES (?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT(user_id) DO UPDATE SET
             job_title = excluded.job_title,
             department = excluded.department,
             preferences_json = excluded.preferences_json,
             updated_at = datetime('now')`,
          [deps.uuid.v4(), id, nextJobTitle, nextDepartment, JSON.stringify(preferences)],
          (profileWriteErr) => {
            if (profileWriteErr) {
              done(new AppError(profileWriteErr.message, 500));
              return;
            }
            done();
          }
        );
      }
    );
  };

  deps.db.run(sql, [...params, id], function (err) {
    if (err) return next(new AppError(err.message, 500));
    if (this.changes === 0) return next(new AppError('User not found', 404));

    persistProfileFields((profileErr?: Error) => {
      if (profileErr) return next(profileErr);

      deps.ActivityService.log({
        userId: req.user?.id,
        action: 'updated',
        entityType: 'user',
        entityId: id,
        newValue: {
          organizationId,
          role,
          status,
          email,
          firstName,
          lastName,
          licensePlanId,
          department,
          jobTitle,
          projectRole,
        },
      });

      // Security signal: page when this update granted a privileged role.
      if (role !== undefined) {
        void alertPrivilegeEscalation({
          actorEmail: req.user?.email,
          targetEmail: email ?? priorUser?.email,
          targetUserId: id,
          oldRole: priorUser?.role,
          newRole: role,
        });
      }

      res.json({ message: 'User updated successfully' });
    });
  });
});

/**
 * CREATE Super Admin User
 */
const createUser = catchAsync(async (req, res, next) => {
  const { firstName, lastName, email, password, role, organizationId, licensePlanId } = req.body;
  const jobTitle =
    req.body?.jobTitle === undefined || req.body?.jobTitle === null
      ? undefined
      : String(req.body.jobTitle).trim();
  const department =
    req.body?.department === undefined || req.body?.department === null
      ? undefined
      : String(req.body.department).trim();
  const projectRole =
    req.body?.projectRole === undefined || req.body?.projectRole === null
      ? undefined
      : String(req.body.projectRole).trim();

  if (!email) return next(new AppError('Email is required', 400));

  const generatedPassword = password || deps.uuid.v4().slice(0, 12);
  const hashedPassword = deps.bcrypt.hashSync(generatedPassword, 8);
  const id = deps.uuid.v4();
  const targetOrgId = organizationId || 'org-dbr77-system';
  const targetRole = role || 'USER';
  const hasLicensePlanId = await hasColumn('users', 'license_plan_id').catch(() => false);
  const hasUserJobTitle = await hasColumn('users', 'job_title').catch(() => false);
  const hasUserDepartment = await hasColumn('users', 'department').catch(() => false);
  const hasUserProfiles = await tableExists('user_profiles').catch(() => false);
  const targetOrganization = await new Promise((resolve, reject) => {
    deps.db.get('SELECT id FROM organizations WHERE id = ?', [targetOrgId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
  if (!targetOrganization) return next(new AppError('Target organization not found', 404));

  const columns = [
    'id',
    'organization_id',
    'email',
    'password',
    'first_name',
    'last_name',
    'role',
    'status',
    'created_at',
  ];
  const values: any[] = [
    id,
    targetOrgId,
    email,
    hashedPassword,
    firstName || '',
    lastName || '',
    targetRole,
    'active',
  ];
  const placeholders = ['?', '?', '?', '?', '?', '?', '?', '?', "datetime('now')"];
  if (hasLicensePlanId && licensePlanId !== undefined) {
    columns.push('license_plan_id');
    values.push(licensePlanId || null);
    placeholders.push('?');
  }
  if (hasUserJobTitle && jobTitle !== undefined) {
    columns.push('job_title');
    values.push(jobTitle || null);
    placeholders.push('?');
  }
  if (hasUserDepartment && department !== undefined) {
    columns.push('department');
    values.push(department || null);
    placeholders.push('?');
  }

  const sql = `INSERT INTO users(${columns.join(', ')}) VALUES(${placeholders.join(', ')})`;

  deps.db.run(sql, values, function (err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return next(new AppError('Email already exists', 400));
      }
      return next(new AppError(err.message, 500));
    }

    const shouldPersistProfile =
      hasUserProfiles &&
      (jobTitle !== undefined || department !== undefined || projectRole !== undefined);

    const finalizeCreateResponse = () => {
      deps.ActivityService.log({
        userId: req.user?.id,
        action: 'created',
        entityType: 'user',
        entityId: id,
        newValue: {
          email,
          role: targetRole,
          organizationId: targetOrgId,
          department,
          jobTitle,
          projectRole,
        },
      });

      res.json({
        id,
        email,
        firstName,
        lastName,
        role: targetRole,
        status: 'active',
        organizationId: targetOrgId,
        department: department || undefined,
        jobTitle: jobTitle || undefined,
        projectRole: projectRole || undefined,
        temporaryPassword: password ? undefined : generatedPassword,
      });
    };

    if (!shouldPersistProfile) {
      finalizeCreateResponse();
      return;
    }

    const preferences: Record<string, unknown> = {};
    if (projectRole) {
      preferences.defaultProjectRole = projectRole;
    }

    deps.db.run(
      `INSERT INTO user_profiles (id, user_id, job_title, department, preferences_json, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         job_title = excluded.job_title,
         department = excluded.department,
         preferences_json = excluded.preferences_json,
         updated_at = datetime('now')`,
      [deps.uuid.v4(), id, jobTitle || null, department || null, JSON.stringify(preferences)],
      (profileErr) => {
        if (profileErr) return next(new AppError(profileErr.message, 500));
        finalizeCreateResponse();
      }
    );
  });
});

/**
 * DELETE User (soft delete)
 */
const deleteUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const sql = `UPDATE users SET status = 'deleted' WHERE id = ?`;

  deps.db.run(sql, [id], function (err) {
    if (err) return next(new AppError(err.message, 500));
    if (this.changes === 0) return next(new AppError('User not found', 404));

    deps.ActivityService.log({
      userId: req.user?.id,
      action: 'deleted',
      entityType: 'user',
      entityId: id,
    });

    res.json({ message: 'User deleted successfully' });
  });
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
            if (err) logger.error('Error updating request status', err);
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
 *
 * Dual-model reconciliation (CTO decision, 2026-07-20): access_codes carries
 * both the hash-model (accessCodeService: code_hash/uses_count/status) and
 * legacy (role/current_uses/is_active) columns on the same table. Business
 * logic for reading/normalizing the row lives in AccessCodeService now,
 * not as raw SQL here — see accessCodeService.listAllCodesAdmin().
 */
const getAccessCodes = catchAsync(async (req, res, next) => {
  try {
    const rows = await AccessCodeService.listAllCodesAdmin();
    res.json(rows);
  } catch (err: any) {
    next(new AppError(err.message, 500));
  }
});

/**
 * CREATE Access Code
 *
 * Switched to AccessCodeService.createLegacyCompatCode() (dual-model
 * reconciliation, 2026-07-20): preserves the exact prior feature set
 * (caller-supplied plaintext `code`, `role`, `maxUses`, `expiresAt`) while
 * also writing code_hash/uses_count/status so the code is immediately valid
 * through accessCodeService's hash-lookup validate/accept paths too.
 */
const createAccessCode = catchAsync(async (req, res, next) => {
  const { code, role, maxUses, expiresAt, organizationId } = req.body;
  const orgId = organizationId || req.user.organizationId || 'org-dbr77-system';
  // Preserve the exact prior default-code format (8 uppercase hex chars from
  // a uuid) rather than the service's own "JOIN-XXXXXX" fallback, so this
  // caller's behavior is byte-for-byte unchanged when no custom code is given.
  const newCode = code || deps.uuid.v4().substring(0, 8).toUpperCase();

  try {
    const created = await AccessCodeService.createLegacyCompatCode({
      code: newCode,
      organizationId: orgId,
      createdByUserId: req.user.id,
      role: role || 'USER',
      maxUses: maxUses || 100,
      expiresAt: expiresAt || null,
    });
    res.json({ message: 'Access code created', code: created.code });
  } catch (err: any) {
    next(new AppError(err.message, 500));
  }
});

/**
 * DEACTIVATE / REVOKE Access Code
 *
 * Switched to AccessCodeService.revokeCode() (dual-model reconciliation,
 * 2026-07-20): sets BOTH `status` and legacy `is_active` in one UPDATE,
 * replacing the old 3-attempt cascading SQL (which existed to guess which
 * schema generation was live — no longer needed now both column families
 * always exist).
 */
const deactivateAccessCode = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  try {
    const { changes } = await AccessCodeService.revokeCode(id);
    if (!changes) return next(new AppError('Access code not found', 404));
    res.json({ success: true });
  } catch (err: any) {
    next(new AppError(err.message || 'Failed to deactivate access code', 500));
  }
});

/**
 * IMPERSONATE USER
 */
const impersonateUser = catchAsync(async (req, res, next) => {
  const { userId, reason } = req.body;
  if (!userId) return next(new AppError('User ID is required', 400));

  deps.db.get('SELECT * FROM users WHERE id = ?', [userId], async (err, user) => {
    if (err) return next(new AppError(err.message, 500));
    if (!user) return next(new AppError('User not found', 404));

    deps.db.get(
      'SELECT * FROM organizations WHERE id = ?',
      [user.organization_id],
      async (err, org) => {
        if (err) return next(new AppError('Server error', 500));

        const sessionId = deps.uuid.v4();
        const jti = deps.uuid.v4();
        const sessionReason = String(reason || 'Superadmin support session').trim();

        deps.db.run(
          `INSERT INTO superadmin_impersonation_sessions
           (id, admin_id, target_user_id, reason, started_at, ip_address, is_active)
         VALUES (?, ?, ?, ?, datetime('now'), ?, 1)`,
          [sessionId, req.user.id, user.id, sessionReason, req.ip || null],
          async (sessionErr) => {
            if (sessionErr) return next(new AppError(sessionErr.message, 500));

            try {
              await auditEventsService.log({
                actorId: req.user.id,
                actorType: 'USER',
                organizationId: user.organization_id,
                action: 'user.impersonation_start',
                resourceType: 'user',
                resourceId: user.id,
                metadata: {
                  targetUserId: user.id,
                  targetUserEmail: user.email,
                  tenantId: user.organization_id,
                  durationMinutes: 30,
                  readOnly: true,
                  sessionId,
                  reason: sessionReason,
                },
                ip: req.ip,
                userAgent: req.headers['user-agent'],
              });
            } catch (auditErr) {
              return next(new AppError('Audit system unavailable for impersonation start', 503));
            }

            const token = deps.jwt.sign(
              {
                id: user.id,
                email: user.email,
                role: user.role,
                organizationId: user.organization_id,
                impersonatorId: req.user.id,
                impersonationSessionId: sessionId,
                jti: jti,
              },
              deps.config.JWT_SECRET,
              { expiresIn: '30m' }
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
              impersonationSessionId: sessionId,
              accessLevel: 'read_only',
            };

            deps.ActivityService.log({
              userId: req.user.id,
              action: 'impersonate_start',
              entityType: 'user',
              entityId: user.id,
              entityName: user.email,
              details: {
                target_organization: user.organization_id,
                read_only: true,
                duration_minutes: 30,
                session_id: sessionId,
              },
            });

            res.json({ user: safeUser, token });
          }
        );
      }
    );
  });
});

/**
 * DATABASE EXPLORER - TABLES
 */
const getDatabaseTables = catchAsync(async (req, res, next) => {
  const pgQuery =
    "SELECT table_name as name FROM information_schema.tables WHERE table_schema = 'public' AND table_name NOT LIKE 'pg_%' AND table_name NOT LIKE '_%'";
  deps.db.all(pgQuery, [], (err, rows) => {
    if (!err) {
      res.json((rows || []).map((r) => r.name));
      return;
    }

    // SQLite fallback (local/dev). information_schema doesn't exist there.
    const sqliteQuery =
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_%' ORDER BY name";
    deps.db.all(sqliteQuery, [], (err2, rows2) => {
      if (err2) return next(new AppError(err2.message, 500));
      res.json((rows2 || []).map((r) => r.name));
    });
  });
});

/**
 * DATABASE EXPLORER - ROWS
 */
const getDatabaseRows = catchAsync(async (req, res, next) => {
  const { tableName } = req.params;
  if (!/^[a-zA-Z0-9_]+$/.test(tableName)) return next(new AppError('Invalid table name', 400));

  const pgQuery = `SELECT * FROM ${tableName} ORDER BY ctid DESC LIMIT 100`;
  deps.db.all(pgQuery, [], (err, rows) => {
    if (!err) {
      res.json(rows);
      return;
    }

    // SQLite fallback (no ctid). rowid exists for most tables.
    const sqliteQuery = `SELECT * FROM ${tableName} ORDER BY rowid DESC LIMIT 100`;
    deps.db.all(sqliteQuery, [], (err2, rows2) => {
      if (err2) return next(new AppError(err2.message, 500));
      res.json(rows2);
    });
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

  const current = await deps.LegalService.getDocumentById(id);
  if (!current) return next(new AppError('Document not found', 404));
  const currentlyActive =
    current.is_active === true || current.is_active === 1 || current.status === 'active';

  const result =
    currentlyActive === isActive ? current : await deps.LegalService.toggleDocumentActive(id);

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

  // Same hardening as getAdminAuditLogs: never let one malformed metadata row
  // turn the whole endpoint into a 500. Keep the original raw value in
  // metadataRaw so QA can still inspect what came from the DB, and surface a
  // simple counter so the UI can warn the operator when integrity is degraded.
  let malformedMetadataCount = 0;
  const parsedEvents = events.map((e) => {
    if (typeof e.metadata !== 'string') return { ...e };
    try {
      return { ...e, metadata: JSON.parse(e.metadata) };
    } catch {
      malformedMetadataCount += 1;
      return { ...e, metadata: {}, metadataRaw: e.metadata };
    }
  });

  res.json({
    count: parsedEvents.length,
    events: parsedEvents,
    integrity: {
      degraded: malformedMetadataCount > 0,
      malformedMetadataCount,
    },
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
  const AttributionService = await getAttributionService();

  const data = await AttributionService.exportAttribution({
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
  const AttributionService = await getAttributionService();
  const summary = await AttributionService.getPartnerSummary(startDate, endDate);

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
    res.json(
      (rows || []).map((r: any) => ({
        ...r,
        user_count: Number(r.user_count ?? 0),
        tokens_used: Number(r.tokens_used ?? 0),
        ai_calls: Number(r.ai_calls ?? 0),
      }))
    );
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
      logger.error('Invoice query error:', err);
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
      logger.error('Invoice stats error:', err);
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
      logger.error('[SuperAdmin] Security events query error:', err);
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
      logger.error('[SuperAdmin] Resolve security event error:', err);
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
      logger.info(
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
 * Get invoice as downloadable HTML document.
 */
const getInvoicePdf = catchAsync(async (req: AuthenticatedRequest, res, next) => {
  const { id } = req.params;
  const isPg =
    process.env.DB_TYPE === 'postgres' || process.env.DATABASE_URL?.startsWith('postgres');

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
    WHERE t.id = ?
    LIMIT 1
  `;

  deps.db.get(query, [id], (err: any, row: any) => {
    if (err) return next(new AppError('Failed to fetch invoice', 500));
    if (!row) return next(new AppError('Invoice not found', 404));

    const inv = row;
    const invoiceNumber = inv.invoice_number || `INV-${String(inv.id).slice(0, 8)}`;
    const issueDate = inv.created_at ? new Date(inv.created_at).toLocaleDateString('en-US') : '-';
    const dueDate = inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-US') : '-';
    const statusLabel = (inv.status || 'pending').toUpperCase();
    const amount = parseFloat(inv.amount || 0).toFixed(2);
    const tax = parseFloat(inv.tax || 0).toFixed(2);
    const total = parseFloat(inv.total || inv.amount || 0).toFixed(2);
    const currency = inv.currency || 'USD';
    const orgName = inv.organization_name || 'N/A';
    const description = inv.description || 'Platform services';

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Invoice ${invoiceNumber}</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:40px;color:#1e293b;background:#fff}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px}
  .brand{font-size:24px;font-weight:700;color:#7c3aed}
  .inv-title{font-size:28px;font-weight:700;color:#0f172a}
  .inv-number{color:#64748b;font-size:14px;margin-top:4px}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px}
  .meta-block label{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;margin-bottom:4px}
  .meta-block span{font-size:14px;font-weight:500}
  .status{display:inline-block;padding:4px 12px;border-radius:9999px;font-size:12px;font-weight:600}
  .status-paid{background:#d1fae5;color:#065f46}
  .status-pending{background:#fef3c7;color:#92400e}
  .status-refunded{background:#dbeafe;color:#1e40af}
  table{width:100%;border-collapse:collapse;margin-bottom:24px}
  th{text-align:left;padding:12px 16px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;border-bottom:2px solid #e2e8f0}
  td{padding:12px 16px;border-bottom:1px solid #f1f5f9;font-size:14px}
  .text-right{text-align:right}
  .totals{margin-left:auto;width:280px}
  .totals tr td{border:none;padding:8px 16px}
  .totals .grand td{font-size:18px;font-weight:700;border-top:2px solid #e2e8f0;padding-top:12px}
  .footer{margin-top:48px;padding-top:24px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center}
  @media print{body{padding:20px}}
</style></head>
<body>
  <div class="header">
    <div><div class="brand">Consultify</div><div style="font-size:12px;color:#94a3b8">Enterprise Platform</div></div>
    <div style="text-align:right"><div class="inv-title">INVOICE</div><div class="inv-number">${invoiceNumber}</div></div>
  </div>
  <div class="meta">
    <div class="meta-block"><label>Bill To</label><span>${orgName}</span></div>
    <div class="meta-block" style="text-align:right"><label>Status</label><span class="status status-${inv.status || 'pending'}">${statusLabel}</span></div>
    <div class="meta-block"><label>Issue Date</label><span>${issueDate}</span></div>
    <div class="meta-block" style="text-align:right"><label>Due Date</label><span>${dueDate}</span></div>
  </div>
  <table>
    <thead><tr><th>Description</th><th class="text-right">Qty</th><th class="text-right">Unit Price</th><th class="text-right">Amount</th></tr></thead>
    <tbody><tr><td>${description}</td><td class="text-right">1</td><td class="text-right">${currency} ${amount}</td><td class="text-right">${currency} ${amount}</td></tr></tbody>
  </table>
  <table class="totals">
    <tr><td>Subtotal</td><td class="text-right">${currency} ${amount}</td></tr>
    <tr><td>Tax</td><td class="text-right">${currency} ${tax}</td></tr>
    <tr class="grand"><td>Total</td><td class="text-right">${currency} ${total}</td></tr>
  </table>
  <div class="footer">Generated by Consultify &middot; ${new Date().toISOString().slice(0, 10)}</div>
</body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoiceNumber}.html"`);
    res.send(html);
  });
});

/**
 * Upload branding logo
 *
 * Not implemented in this codebase yet → honest 503.
 */
const uploadBrandingLogo = catchAsync(async (req, res, next) => {
  return next(new AppError('Branding logo upload is not available', 503, 'FEATURE_UNAVAILABLE'));
});

/**
 * Get all API keys
 */
const ensureApiKeysSchema = async () => {
  const db = deps.db;

  const hasTable = await tableExists('api_keys');
  if (!hasTable) {
    await new Promise<void>((resolve, reject) => {
      db.run(
        `
          CREATE TABLE IF NOT EXISTS api_keys (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            user_id TEXT,
            name TEXT NOT NULL,
            description TEXT,
            key_hash TEXT NOT NULL,
            key_prefix TEXT NOT NULL,
            key_type TEXT,
            scopes TEXT,
            allowed_ips TEXT,
            rate_limit_per_minute INTEGER,
            rate_limit_per_day INTEGER,
            expires_at TEXT,
            is_active INTEGER DEFAULT 1,
            usage_count INTEGER DEFAULT 0,
            last_used_at TEXT,
            created_by TEXT,
            created_at DATETIME,
            revoked_at DATETIME,
            revoked_by TEXT,
            revoke_reason TEXT
          )
        `,
        [],
        (err: any) => (err ? reject(err) : resolve())
      );
    });
  }

  const cols = await new Promise<Set<string>>((resolve) => {
    db.all(`PRAGMA table_info(api_keys)`, [], (_err: any, rows: any[]) => {
      const s = new Set<string>();
      (rows || []).forEach((r: any) => s.add(String(r?.name || '').toLowerCase()));
      resolve(s);
    });
  });

  // Best-effort: add columns if missing (older schemas).
  // NOTE: We avoid DEFAULT expressions that differ across DBs; code sets values on insert.
  const maybeAdd = async (name: string, type: string) => {
    if (cols.has(name.toLowerCase())) return;
    await new Promise<void>((resolve) => {
      db.run(`ALTER TABLE api_keys ADD COLUMN ${name} ${type}`, [], () => resolve());
    });
  };

  await maybeAdd('user_id', 'TEXT');
  await maybeAdd('description', 'TEXT');
  await maybeAdd('key_type', 'TEXT');
  await maybeAdd('scopes', 'TEXT');
  await maybeAdd('permissions', 'TEXT');
  await maybeAdd('allowed_ips', 'TEXT');
  await maybeAdd('rate_limit_per_minute', 'INTEGER');
  await maybeAdd('rate_limit_per_day', 'INTEGER');
  await maybeAdd('expires_at', 'TEXT');
  await maybeAdd('is_active', 'INTEGER');
  await maybeAdd('usage_count', 'INTEGER');
  await maybeAdd('last_used_at', 'TEXT');
  await maybeAdd('created_by', 'TEXT');
  await maybeAdd('created_at', 'DATETIME');
  await maybeAdd('revoked_at', 'DATETIME');
  await maybeAdd('revoked_by', 'TEXT');
  await maybeAdd('revoke_reason', 'TEXT');
};

const getApiKeys = catchAsync(async (req, res, next) => {
  try {
    await ensureApiKeysSchema();

    const db = deps.db;
    const query = `
            SELECT 
                k.id, 
                k.organization_id as "organizationId", 
                o.name as "organizationName",
                k.user_id as "userId",
                k.name as name, 
                k.description as description,
                k.key_prefix as "keyPrefix",
                k.key_type as "keyType",
                k.scopes as scopes,
                k.allowed_ips as "allowedIps",
                k.is_active as "isActive", 
                k.usage_count as "usageCount", 
                k.last_used_at as "lastUsedAt",
                k.created_at as "createdAt",
                k.expires_at as "expiresAt",
                k.rate_limit_per_minute as "rateLimitPerMinute",
                k.rate_limit_per_day as "rateLimitPerDay"
            FROM api_keys k
            LEFT JOIN organizations o ON k.organization_id = o.id
            ORDER BY k.created_at DESC
        `;
    const fallbackQuery = `
            SELECT
                k.id,
                k.organization_id as "organizationId",
                NULL as "organizationName",
                k.user_id as "userId",
                k.name as name,
                k.description as description,
                k.key_prefix as "keyPrefix",
                k.key_type as "keyType",
                k.scopes as scopes,
                k.allowed_ips as "allowedIps",
                k.is_active as "isActive",
                k.usage_count as "usageCount",
                k.last_used_at as "lastUsedAt",
                k.created_at as "createdAt",
                k.expires_at as "expiresAt",
                k.rate_limit_per_minute as "rateLimitPerMinute",
                k.rate_limit_per_day as "rateLimitPerDay"
            FROM api_keys k
            ORDER BY k.created_at DESC
        `;
    const keys = await new Promise((resolve, reject) => {
      const parseRows = (rows: any[]) => {
        const parsedRows = (rows || []).map((row) => {
          const isActiveValue = row.isActive ?? row.isactive ?? row.is_active;
          return {
            ...row,
            isActive: isActiveValue === true || isActiveValue === 1 || isActiveValue === '1',
            scopes:
              typeof row.scopes === 'string'
                ? (() => {
                    try {
                      return JSON.parse(row.scopes);
                    } catch {
                      return [];
                    }
                  })()
                : row.scopes || [],
            allowedIps:
              typeof row.allowedIps === 'string'
                ? (() => {
                    try {
                      return JSON.parse(row.allowedIps);
                    } catch {
                      return [];
                    }
                  })()
                : row.allowedIps || [],
          };
        });
        resolve(parsedRows);
      };

      db.all(query, [], (err, rows) => {
        if (err) {
          db.all(fallbackQuery, [], (fallbackErr, fallbackRows) => {
            if (fallbackErr) reject(fallbackErr);
            else parseRows(fallbackRows || []);
          });
        } else {
          parseRows(rows || []);
        }
      });
    });
    res.json(keys);
  } catch (error) {
    logger.error('[SuperAdmin] Get API keys error:', error);
    res.status(500).json({ error: 'Failed to get API keys' });
  }
});

/**
 * Create a new API key
 */
const createApiKey = catchAsync(async (req, res, next) => {
  try {
    await ensureApiKeysSchema();

    const {
      organizationId,
      name,
      description,
      keyType,
      scopes,
      permissions,
      rateLimitPerMinute,
      rateLimitPerDay,
      allowedIps,
      expiresAt,
      userId,
    } = req.body || {};

    const orgId = String(organizationId || '').trim();
    const keyName = String(name || '').trim();
    if (!orgId || !keyName) {
      return res.status(400).json({ error: 'organizationId and name are required' });
    }

    const scopesArr = Array.isArray(scopes)
      ? scopes
      : Array.isArray(permissions)
        ? permissions
        : [];
    if (scopesArr.length === 0) {
      return res.status(400).json({ error: 'At least one scope is required' });
    }

    const db = deps.db;
    const keyId = deps.uuid.v4();
    const keyBody = crypto.randomBytes(32).toString('hex');
    const plainKey = `ck_${keyBody}`;
    const keyHash = crypto.createHash('sha256').update(keyBody).digest('hex');
    const keyPrefix = `${plainKey.substring(0, 12)}...`;

    const rlMin =
      typeof rateLimitPerMinute === 'number' && Number.isFinite(rateLimitPerMinute)
        ? Math.max(1, Math.floor(rateLimitPerMinute))
        : 60;
    const rlDay =
      typeof rateLimitPerDay === 'number' && Number.isFinite(rateLimitPerDay)
        ? Math.max(1, Math.floor(rateLimitPerDay))
        : 10000;

    const allowedIpsJson = Array.isArray(allowedIps) ? JSON.stringify(allowedIps) : null;
    const expiresAtValue = expiresAt ? String(expiresAt) : null;
    const userIdValue = userId ? String(userId) : null;

    await new Promise<void>((resolve, reject) => {
      db.run(
        `INSERT INTO api_keys (
          id, organization_id, user_id, name, description,
          key_hash, key_prefix, key_type, scopes, permissions,
          rate_limit_per_minute, rate_limit_per_day,
          allowed_ips, expires_at, is_active, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'))`,
        [
          keyId,
          orgId,
          userIdValue,
          keyName,
          description ? String(description) : null,
          keyHash,
          keyPrefix,
          keyType === 'service' || keyType === 'user' ? keyType : 'org',
          JSON.stringify(scopesArr),
          JSON.stringify(scopesArr),
          rlMin,
          rlDay,
          allowedIpsJson,
          expiresAtValue,
          req.user?.id || null,
        ],
        (err: any) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    return res.status(201).json({
      id: keyId,
      key: plainKey,
      name: keyName,
      keyPrefix,
      warning: 'Save this API key now. It cannot be shown again.',
    });
  } catch (error) {
    logger.error('[SuperAdmin] Create API key error:', error);
    return res.status(500).json({ error: 'Failed to create API key' });
  }
});

/**
 * Delete an API key
 */
const deleteApiKey = catchAsync(async (req, res, next) => {
  try {
    await ensureApiKeysSchema();

    const { id } = req.params;
    const db = deps.db;
    await new Promise<void>((resolve, reject) => {
      db.run(
        `UPDATE api_keys
         SET is_active = 0,
             revoked_at = datetime('now'),
             revoked_by = ?,
             revoke_reason = COALESCE(revoke_reason, 'revoked via superadmin')
         WHERE id = ?`,
        [req.user?.id || null, id],
        (err: any) => {
          if (!err) return resolve();
          // Fallback for older schemas (no revoke_* columns)
          db.run(`UPDATE api_keys SET is_active = 0 WHERE id = ?`, [id], (err2: any) => {
            if (err2) reject(err2);
            else resolve();
          });
        }
      );
    });
    res.json({ success: true });
  } catch (error) {
    logger.error('[SuperAdmin] Delete API key error:', error);
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

    const hasUsageTable = await tableExists('api_key_usage');
    if (!hasUsageTable) {
      const keyRow: any = await new Promise((resolve, reject) => {
        db.get(
          `SELECT usage_count, last_used_at FROM api_keys WHERE id = ?`,
          [id],
          (err: any, row: any) => {
            if (err) reject(err);
            else resolve(row || { usage_count: 0, last_used_at: null });
          }
        );
      });
      return res.json({
        totals: { total_requests: keyRow.usage_count || 0, total_errors: 0, avg_response_time: 0 },
        daily: [],
        endpoints: [],
        lastUsedAt: keyRow.last_used_at || null,
      });
    }

    const totals: any = await new Promise((resolve, reject) => {
      db.get(
        `
        SELECT
          COUNT(*) as total_requests,
          SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as total_errors,
          AVG(response_time_ms) as avg_response_time
        FROM api_key_usage
        WHERE api_key_id = ?
          AND created_at >= datetime('now', '-30 days')
        `,
        [id],
        (err: any, row: any) => {
          if (err) reject(err);
          else resolve(row || { total_requests: 0, total_errors: 0, avg_response_time: 0 });
        }
      );
    });

    const daily: any[] = await new Promise((resolve, reject) => {
      db.all(
        `
        SELECT
          substr(created_at, 1, 10) as date,
          COUNT(*) as requests,
          SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as errors,
          AVG(response_time_ms) as avg_response_time
        FROM api_key_usage
        WHERE api_key_id = ?
          AND created_at >= datetime('now', '-30 days')
        GROUP BY substr(created_at, 1, 10)
        ORDER BY date DESC
        `,
        [id],
        (err: any, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    const endpoints: any[] = await new Promise((resolve, reject) => {
      db.all(
        `
        SELECT
          endpoint,
          method,
          COUNT(*) as requests,
          SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as errors,
          AVG(response_time_ms) as avg_response_time
        FROM api_key_usage
        WHERE api_key_id = ?
          AND created_at >= datetime('now', '-30 days')
        GROUP BY endpoint, method
        ORDER BY requests DESC
        LIMIT 50
        `,
        [id],
        (err: any, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    return res.json({
      totals: {
        total_requests: totals?.total_requests || 0,
        total_errors: totals?.total_errors || 0,
        avg_response_time: totals?.avg_response_time || 0,
      },
      daily,
      endpoints,
    });
  } catch (error) {
    logger.error('[SuperAdmin] Get API key usage error:', error);
    res.status(500).json({ error: 'Failed to get API key usage' });
  }
});

/**
 * Get compliance frameworks list
 */
const getComplianceFrameworks = catchAsync(async (req, res, next) => {
  const hasFrameworksTable = await tableExists('compliance_frameworks');
  if (!hasFrameworksTable) {
    await new Promise<void>((resolve, reject) => {
      deps.db.run(
        `CREATE TABLE IF NOT EXISTS compliance_frameworks (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          display_name TEXT,
          description TEXT,
          version TEXT,
          requirements TEXT DEFAULT '[]',
          is_active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now'))
        )`,
        [],
        (err: any) => (err ? reject(err) : resolve())
      );
    });

    const defaultFrameworks = [
      {
        id: 'soc2',
        name: 'SOC 2 Type II',
        display_name: 'SOC 2 Type II',
        description: 'Service Organization Control 2 — Trust Services Criteria',
        version: '2017',
        requirements: JSON.stringify([
          {
            id: 'CC1.1',
            category: 'Control Environment',
            title: 'COSO Principle 1',
            description: 'The entity demonstrates a commitment to integrity and ethical values.',
          },
          {
            id: 'CC1.2',
            category: 'Control Environment',
            title: 'COSO Principle 2',
            description: 'The board of directors demonstrates independence from management.',
          },
          {
            id: 'CC2.1',
            category: 'Communication',
            title: 'COSO Principle 13',
            description: 'The entity obtains or generates relevant, quality information.',
          },
          {
            id: 'CC3.1',
            category: 'Risk Assessment',
            title: 'COSO Principle 6',
            description: 'The entity specifies objectives with sufficient clarity.',
          },
          {
            id: 'CC5.1',
            category: 'Control Activities',
            title: 'COSO Principle 10',
            description: 'The entity selects and develops control activities.',
          },
          {
            id: 'CC6.1',
            category: 'Logical Access',
            title: 'Logical Access Security',
            description: 'Logical access security measures are implemented.',
          },
          {
            id: 'CC7.1',
            category: 'System Operations',
            title: 'Detection of Changes',
            description: 'Procedures exist to detect changes to software and infrastructure.',
          },
          {
            id: 'CC8.1',
            category: 'Change Management',
            title: 'Change Management Process',
            description:
              'Authorization, design, development, testing, and implementation of changes.',
          },
        ]),
      },
      {
        id: 'gdpr',
        name: 'GDPR',
        display_name: 'GDPR',
        description: 'EU General Data Protection Regulation',
        version: '2016/679',
        requirements: JSON.stringify([
          {
            id: 'Art5',
            category: 'Principles',
            title: 'Principles of Processing',
            description: 'Lawfulness, fairness, transparency, purpose limitation.',
          },
          {
            id: 'Art6',
            category: 'Lawful Basis',
            title: 'Lawfulness of Processing',
            description: 'At least one lawful basis for processing personal data.',
          },
          {
            id: 'Art12',
            category: 'Data Subject Rights',
            title: 'Transparent Information',
            description: 'Communication and modalities for exercising data subject rights.',
          },
          {
            id: 'Art25',
            category: 'Design',
            title: 'Data Protection by Design',
            description: 'Data protection by design and by default.',
          },
          {
            id: 'Art30',
            category: 'Records',
            title: 'Records of Processing',
            description: 'Records of processing activities.',
          },
          {
            id: 'Art32',
            category: 'Security',
            title: 'Security of Processing',
            description: 'Appropriate technical and organisational measures.',
          },
          {
            id: 'Art33',
            category: 'Breach',
            title: 'Breach Notification',
            description: 'Notification to supervisory authority within 72 hours.',
          },
          {
            id: 'Art35',
            category: 'Impact',
            title: 'DPIA',
            description: 'Data protection impact assessment for high-risk processing.',
          },
        ]),
      },
      {
        id: 'hipaa',
        name: 'HIPAA',
        display_name: 'HIPAA',
        description: 'Health Insurance Portability and Accountability Act',
        version: '2013',
        requirements: JSON.stringify([
          {
            id: '164.308a1',
            category: 'Administrative',
            title: 'Security Management',
            description:
              'Implement policies to prevent, detect, contain, and correct security violations.',
          },
          {
            id: '164.308a3',
            category: 'Administrative',
            title: 'Workforce Security',
            description: 'Implement policies ensuring appropriate access to ePHI.',
          },
          {
            id: '164.308a5',
            category: 'Administrative',
            title: 'Security Awareness',
            description: 'Security awareness and training program.',
          },
          {
            id: '164.310a1',
            category: 'Physical',
            title: 'Facility Access',
            description: 'Limit physical access to electronic information systems.',
          },
          {
            id: '164.312a1',
            category: 'Technical',
            title: 'Access Control',
            description: 'Implement technical policies to allow access only to authorized persons.',
          },
          {
            id: '164.312c1',
            category: 'Technical',
            title: 'Integrity Controls',
            description: 'Implement mechanisms to authenticate ePHI.',
          },
          {
            id: '164.312e1',
            category: 'Technical',
            title: 'Transmission Security',
            description:
              'Implement measures to guard against unauthorized access during transmission.',
          },
        ]),
      },
      {
        id: 'iso27001',
        name: 'ISO 27001',
        display_name: 'ISO 27001:2022',
        description: 'Information Security Management System standard',
        version: '2022',
        requirements: JSON.stringify([
          {
            id: 'A5.1',
            category: 'Organizational',
            title: 'Information Security Policies',
            description: 'Management direction for information security.',
          },
          {
            id: 'A6.1',
            category: 'People',
            title: 'Screening',
            description: 'Background verification checks on candidates.',
          },
          {
            id: 'A7.1',
            category: 'Physical',
            title: 'Physical Security Perimeters',
            description: 'Security perimeters to protect information and assets.',
          },
          {
            id: 'A8.1',
            category: 'Technology',
            title: 'User Endpoint Devices',
            description:
              'Information stored on, processed by or accessible via user endpoint devices.',
          },
          {
            id: 'A8.5',
            category: 'Technology',
            title: 'Secure Authentication',
            description: 'Secure authentication technologies and procedures.',
          },
          {
            id: 'A8.9',
            category: 'Technology',
            title: 'Configuration Management',
            description: 'Configurations of hardware, software, services and networks.',
          },
        ]),
      },
    ];

    for (const fw of defaultFrameworks) {
      await new Promise<void>((resolve, reject) => {
        deps.db.run(
          `INSERT OR IGNORE INTO compliance_frameworks (id, name, display_name, description, version, requirements)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [fw.id, fw.name, fw.display_name, fw.description, fw.version, fw.requirements],
          (err: any) => (err ? reject(err) : resolve())
        );
      });
    }
  }

  deps.db.all(
    `SELECT id, name, display_name as "displayName", description, version, requirements
     FROM compliance_frameworks
     WHERE is_active = 1
     ORDER BY name ASC`,
    [],
    (err: any, rows: any[]) => {
      if (err) {
        logger.error('[SuperAdmin] Compliance frameworks query error:', err);
        return next(new AppError('Failed to fetch compliance frameworks', 500));
      }
      const frameworks =
        (rows || []).map((r: any) => {
          let reqs: any[] = [];
          try {
            reqs =
              typeof r?.requirements === 'string' ? JSON.parse(r.requirements) : r?.requirements;
          } catch {
            reqs = [];
          }
          return {
            id: r.id,
            name: r.name,
            displayName: r.displayName || r.display_name || r.name,
            description: r.description || '',
            version: r.version || '',
            requirements: Array.isArray(reqs) ? reqs : [],
          };
        }) || [];
      res.json({ frameworks });
    }
  );
});

/**
 * Get compliance status for a framework
 */
const getComplianceStatus = catchAsync(async (req, res, next) => {
  const { frameworkId } = req.params;
  const organizationIdRaw =
    (req.query.organizationId as any) ||
    (req.query.orgId as any) ||
    (req.query.organization_id as any) ||
    (req.user as any)?.organization_id ||
    (req.user as any)?.organizationId;
  const organizationId = String(organizationIdRaw || '').trim();

  const hasComplianceTable = await tableExists('compliance_status');
  if (!hasComplianceTable) {
    await new Promise<void>((resolve, reject) => {
      deps.db.run(
        `CREATE TABLE IF NOT EXISTS compliance_status (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          framework_id TEXT NOT NULL,
          requirement_id TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          notes TEXT,
          evidence TEXT,
          updated_at TEXT DEFAULT (datetime('now')),
          updated_by TEXT,
          UNIQUE(organization_id, framework_id, requirement_id)
        )`,
        [],
        (err: any) => (err ? reject(err) : resolve())
      );
    });
  }

  // Fetch framework metadata (incl. requirements for total)
  const fwRow = await new Promise<any>((resolve, reject) => {
    deps.db.get(
      `SELECT id, name, display_name as "displayName", requirements
       FROM compliance_frameworks
       WHERE id = ?
       LIMIT 1`,
      [frameworkId],
      (err: any, row: any) => {
        if (err) return reject(err);
        resolve(row);
      }
    );
  }).catch(() => null);

  let requirements: any[] = [];
  try {
    requirements =
      typeof fwRow?.requirements === 'string'
        ? JSON.parse(fwRow.requirements)
        : fwRow?.requirements;
  } catch {
    requirements = [];
  }
  const perOrgTotal = Array.isArray(requirements) ? requirements.length : 0;

  const computeForAllOrgs = !organizationId || organizationId === 'all';

  const orgCount = computeForAllOrgs
    ? await new Promise<number>((resolve) => {
        deps.db.get(`SELECT COUNT(*) as cnt FROM organizations`, [], (_e: any, row: any) => {
          resolve(Number(row?.cnt) || 0);
        });
      })
    : 1;

  const total = computeForAllOrgs ? perOrgTotal * orgCount : perOrgTotal;

  const rows = await new Promise<any[]>((resolve) => {
    const params = computeForAllOrgs ? [frameworkId] : [organizationId, frameworkId];
    const sql = computeForAllOrgs
      ? `SELECT status, COUNT(*) as cnt
         FROM compliance_status
         WHERE framework_id = ?
         GROUP BY status`
      : `SELECT status, COUNT(*) as cnt
         FROM compliance_status
         WHERE organization_id = ? AND framework_id = ?
         GROUP BY status`;
    deps.db.all(sql, params, (_err: any, r: any[]) => resolve(r || []));
  });

  const counts: Record<string, number> = {
    compliant: 0,
    in_progress: 0,
    pending: 0,
    non_compliant: 0,
    not_applicable: 0,
  };
  let knownSum = 0;
  for (const r of rows || []) {
    const key = String(r?.status || '').toLowerCase();
    const cnt = Number(r?.cnt) || 0;
    if (key && Object.prototype.hasOwnProperty.call(counts, key)) {
      counts[key] += cnt;
      knownSum += cnt;
    }
  }

  // Treat any missing requirement rows as pending
  const pending = Math.max(0, total - knownSum) + (counts.pending || 0);

  const compliant = counts.compliant || 0;
  const inProgress = counts.in_progress || 0;
  const nonCompliant = counts.non_compliant || 0;
  const score = total > 0 ? Math.round((compliant / total) * 100) : 0;

  res.json({
    framework: frameworkId,
    status: {
      frameworkId,
      frameworkName: fwRow?.displayName || fwRow?.name || frameworkId,
      total,
      compliant,
      inProgress,
      pending,
      nonCompliant,
      score,
    },
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
    logger.error('[SuperAdmin] Get DSAR requests error:', error);
    res.status(500).json({ error: 'Failed to fetch DSAR requests' });
  }
});

/**
 * Get compliance audits list (placeholder)
 */
const getComplianceAudits = catchAsync(async (req, res, next) => {
  try {
    const db = deps.db;
    const hasTable = await tableExists('compliance_audits');
    if (!hasTable) {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `CREATE TABLE IF NOT EXISTS compliance_audits (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            framework_id TEXT,
            audit_type TEXT DEFAULT 'internal',
            status TEXT DEFAULT 'planned',
            planned_start TEXT,
            planned_end TEXT,
            scope TEXT,
            auditor TEXT,
            findings_count INTEGER DEFAULT 0,
            notes TEXT,
            created_at TEXT DEFAULT (datetime('now'))
          )`,
          [],
          (err: any) => (err ? reject(err) : resolve())
        );
      });
    }

    const audits = await new Promise<any[]>((resolve, reject) => {
      db.all(
        'SELECT * FROM compliance_audits ORDER BY planned_start DESC LIMIT 50',
        [],
        (err: any, rows: any[]) => {
          if (err) {
            if (err.message?.includes('no such table')) {
              resolve([]);
            } else if (err.message?.includes('planned_start')) {
              db.all(
                'SELECT * FROM compliance_audits LIMIT 50',
                [],
                (fallbackErr: any, fallbackRows: any[]) => {
                  if (fallbackErr) reject(fallbackErr);
                  else resolve(fallbackRows || []);
                }
              );
            } else {
              reject(err);
            }
          } else {
            resolve(
              (rows || []).map((r: any) => ({
                id: r.id,
                name: r.name,
                frameworkId: r.framework_id,
                auditType: r.audit_type || 'internal',
                status: r.status || 'planned',
                plannedStart: r.planned_start,
                plannedEnd: r.planned_end,
                findingsCount: r.findings_count || 0,
              }))
            );
          }
        }
      );
    });
    res.json({ audits });
  } catch (error) {
    logger.error('[SuperAdmin] Get compliance audits error:', error);
    res.status(500).json({ error: 'Failed to fetch compliance audits' });
  }
});

/**
 * Update a compliance control (status, notes, etc.)
 */
const updateComplianceControl = catchAsync(async (req, res, next) => {
  const { controlId } = req.params;
  const { name, description, status, category, priority, notes } = req.body;

  if (!controlId) {
    return next(new AppError('Control ID is required', 400));
  }

  const hasTable = await tableExists('compliance_controls');
  if (!hasTable) {
    await new Promise<void>((resolve, reject) => {
      deps.db.run(
        `CREATE TABLE IF NOT EXISTS compliance_controls (
          id TEXT PRIMARY KEY,
          framework_id TEXT,
          requirement_id TEXT,
          name TEXT NOT NULL,
          description TEXT,
          status TEXT DEFAULT 'pending',
          category TEXT,
          priority TEXT DEFAULT 'medium',
          notes TEXT,
          updated_at TEXT DEFAULT (datetime('now')),
          updated_by TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        )`,
        [],
        (err: any) => (err ? reject(err) : resolve())
      );
    });
  }

  const existing = await new Promise<any>((resolve, reject) => {
    deps.db.get(
      `SELECT * FROM compliance_controls WHERE id = ?`,
      [controlId],
      (err: any, row: any) => {
        if (err) {
          if (err.message?.includes('no such table')) return resolve(null);
          return reject(err);
        }
        resolve(row || null);
      }
    );
  });

  const userId = (req as any).user?.id || 'system';

  if (existing) {
    await new Promise<void>((resolve, reject) => {
      deps.db.run(
        `UPDATE compliance_controls SET name = COALESCE(?, name), description = COALESCE(?, description),
         status = COALESCE(?, status), category = COALESCE(?, category), priority = COALESCE(?, priority),
         notes = COALESCE(?, notes), updated_at = datetime('now'), updated_by = ? WHERE id = ?`,
        [name, description, status, category, priority, notes, userId, controlId],
        (err: any) => (err ? reject(err) : resolve())
      );
    });
  } else {
    await new Promise<void>((resolve, reject) => {
      deps.db.run(
        `INSERT INTO compliance_controls (id, name, description, status, category, priority, notes, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          controlId,
          name || controlId,
          description || '',
          status || 'pending',
          category || '',
          priority || 'medium',
          notes || '',
          userId,
        ],
        (err: any) => (err ? reject(err) : resolve())
      );
    });
  }

  const updated = await new Promise<any>((resolve) => {
    deps.db.get(
      `SELECT * FROM compliance_controls WHERE id = ?`,
      [controlId],
      (_e: any, row: any) => resolve(row || {})
    );
  });

  res.json({ control: updated });
});

/**
 * Create a new DSAR request
 */
const createDsarRequest = catchAsync(async (req, res, next) => {
  const { subjectName, requesterEmail, requestType, description } = req.body;

  if (!requesterEmail || !requestType) {
    return next(new AppError('Requester email and request type are required', 400));
  }

  const hasTable = await tableExists('dsar_requests');
  if (!hasTable) {
    await new Promise<void>((resolve, reject) => {
      deps.db.run(
        `CREATE TABLE IF NOT EXISTS dsar_requests (
          id TEXT PRIMARY KEY,
          subject_name TEXT,
          requesterEmail TEXT NOT NULL,
          requestType TEXT NOT NULL,
          description TEXT,
          status TEXT DEFAULT 'pending',
          assignedTo TEXT,
          receivedAt TEXT DEFAULT (datetime('now')),
          dueDate TEXT,
          completedAt TEXT,
          notes TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        )`,
        [],
        (err: any) => (err ? reject(err) : resolve())
      );
    });
  }

  const id = `dsar_${uuid.v4().slice(0, 8)}`;
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await new Promise<void>((resolve, reject) => {
    deps.db.run(
      `INSERT INTO dsar_requests (id, subject_name, requesterEmail, requestType, description, status, dueDate)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      [id, subjectName || '', requesterEmail, requestType, description || '', dueDate],
      (err: any) => (err ? reject(err) : resolve())
    );
  });

  const created = await new Promise<any>((resolve) => {
    deps.db.get(`SELECT * FROM dsar_requests WHERE id = ?`, [id], (_e: any, row: any) =>
      resolve(row || {})
    );
  });

  res.status(201).json({ request: created });
});

/**
 * Get a single DSAR request by ID
 */
const getDsarRequestById = catchAsync(async (req, res, next) => {
  const { dsarId } = req.params;
  if (!dsarId) {
    return next(new AppError('DSAR ID is required', 400));
  }

  const request = await new Promise<any>((resolve, reject) => {
    deps.db.get(`SELECT * FROM dsar_requests WHERE id = ?`, [dsarId], (err: any, row: any) => {
      if (err) {
        if (err.message?.includes('no such table')) return resolve(null);
        return reject(err);
      }
      resolve(row || null);
    });
  });

  if (!request) {
    return next(new AppError('DSAR request not found', 404));
  }

  res.json({ request });
});

/**
 * Create a compliance audit
 */
const createComplianceAudit = catchAsync(async (req, res, next) => {
  const { name, auditType, scheduledDate, scope, auditor, frameworkId } = req.body;

  if (!name) {
    return next(new AppError('Audit name is required', 400));
  }

  const hasTable = await tableExists('compliance_audits');
  if (!hasTable) {
    await new Promise<void>((resolve, reject) => {
      deps.db.run(
        `CREATE TABLE IF NOT EXISTS compliance_audits (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          framework_id TEXT,
          audit_type TEXT DEFAULT 'internal',
          status TEXT DEFAULT 'planned',
          planned_start TEXT,
          planned_end TEXT,
          scope TEXT,
          auditor TEXT,
          findings_count INTEGER DEFAULT 0,
          notes TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        )`,
        [],
        (err: any) => (err ? reject(err) : resolve())
      );
    });
  }

  const id = `audit_${uuid.v4().slice(0, 8)}`;
  const plannedStart = scheduledDate || new Date().toISOString();
  const plannedEnd = new Date(
    new Date(plannedStart).getTime() + 14 * 24 * 60 * 60 * 1000
  ).toISOString();

  await new Promise<void>((resolve, reject) => {
    deps.db.run(
      `INSERT INTO compliance_audits (id, name, framework_id, audit_type, status, planned_start, planned_end, scope, auditor)
       VALUES (?, ?, ?, ?, 'planned', ?, ?, ?, ?)`,
      [
        id,
        name,
        frameworkId || '',
        auditType || 'internal',
        plannedStart,
        plannedEnd,
        scope || '',
        auditor || '',
      ],
      (err: any) => (err ? reject(err) : resolve())
    );
  });

  const created = await new Promise<any>((resolve) => {
    deps.db.get(`SELECT * FROM compliance_audits WHERE id = ?`, [id], (_e: any, row: any) =>
      resolve(row || {})
    );
  });

  res.status(201).json({
    audit: {
      id: created.id,
      name: created.name,
      frameworkId: created.framework_id,
      auditType: created.audit_type,
      status: created.status,
      plannedStart: created.planned_start,
      plannedEnd: created.planned_end,
      scope: created.scope,
      auditor: created.auditor,
      findingsCount: created.findings_count || 0,
    },
  });
});

/**
 * Create a data processing record (GDPR Art 30)
 */
const createProcessingRecord = catchAsync(async (req, res, next) => {
  const { name, purpose, dataCategories, legalBasis, retentionPeriod } = req.body;

  if (!name) {
    return next(new AppError('Processing record name is required', 400));
  }

  const hasTable = await tableExists('processing_records');
  if (!hasTable) {
    await new Promise<void>((resolve, reject) => {
      deps.db.run(
        `CREATE TABLE IF NOT EXISTS processing_records (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          purpose TEXT,
          data_categories TEXT,
          legal_basis TEXT,
          retention_period TEXT,
          status TEXT DEFAULT 'active',
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        )`,
        [],
        (err: any) => (err ? reject(err) : resolve())
      );
    });
  }

  const id = `pr_${uuid.v4().slice(0, 8)}`;

  await new Promise<void>((resolve, reject) => {
    deps.db.run(
      `INSERT INTO processing_records (id, name, purpose, data_categories, legal_basis, retention_period)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, name, purpose || '', dataCategories || '', legalBasis || '', retentionPeriod || ''],
      (err: any) => (err ? reject(err) : resolve())
    );
  });

  const created = await new Promise<any>((resolve) => {
    deps.db.get(`SELECT * FROM processing_records WHERE id = ?`, [id], (_e: any, row: any) =>
      resolve(row || {})
    );
  });

  res.status(201).json({ record: created });
});

/**
 * Get all processing records
 */
const getProcessingRecords = catchAsync(async (req, res, next) => {
  const hasTable = await tableExists('processing_records');
  if (!hasTable) {
    await new Promise<void>((resolve, reject) => {
      deps.db.run(
        `CREATE TABLE IF NOT EXISTS processing_records (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          purpose TEXT,
          data_categories TEXT,
          legal_basis TEXT,
          retention_period TEXT,
          status TEXT DEFAULT 'active',
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        )`,
        [],
        (err: any) => (err ? reject(err) : resolve())
      );
    });
  }

  const records = await new Promise<any[]>((resolve, reject) => {
    deps.db.all(
      `SELECT * FROM processing_records ORDER BY created_at DESC LIMIT 100`,
      [],
      (err: any, rows: any[]) => {
        if (err) {
          if (err.message?.includes('no such table')) return resolve([]);
          return reject(err);
        }
        resolve(rows || []);
      }
    );
  });
  res.json({ records });
});

/**
 * Export compliance report (JSON)
 */
const exportComplianceReport = catchAsync(async (req, res, next) => {
  const frameworks = await new Promise<any[]>((resolve) => {
    deps.db.all(
      `SELECT * FROM compliance_frameworks WHERE is_active = 1`,
      [],
      (_e: any, rows: any[]) => resolve(rows || [])
    );
  }).catch(() => []);

  const dsars = await new Promise<any[]>((resolve) => {
    deps.db.all(
      `SELECT * FROM dsar_requests ORDER BY created_at DESC`,
      [],
      (_e: any, rows: any[]) => resolve(rows || [])
    );
  }).catch(() => []);

  const audits = await new Promise<any[]>((resolve) => {
    deps.db.all(
      `SELECT * FROM compliance_audits ORDER BY planned_start DESC`,
      [],
      (_e: any, rows: any[]) => resolve(rows || [])
    );
  }).catch(() => []);

  const processingRecords = await new Promise<any[]>((resolve) => {
    deps.db.all(
      `SELECT * FROM processing_records ORDER BY created_at DESC`,
      [],
      (_e: any, rows: any[]) => resolve(rows || [])
    );
  }).catch(() => []);

  const controls = await new Promise<any[]>((resolve) => {
    deps.db.all(
      `SELECT * FROM compliance_controls ORDER BY created_at DESC`,
      [],
      (_e: any, rows: any[]) => resolve(rows || [])
    );
  }).catch(() => []);

  const report = {
    generatedAt: new Date().toISOString(),
    frameworks,
    dsarRequests: dsars,
    audits,
    processingRecords,
    controls,
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="compliance-report-${new Date().toISOString().slice(0, 10)}.json"`
  );
  res.json(report);
});

/**
 * Compliance summary for all organizations
 */
const getComplianceSummary = catchAsync(async (_req, res, next) => {
  try {
    const hasComplianceTable = await tableExists('compliance_status');
    if (!hasComplianceTable) {
      return res.json({ summary: [] });
    }

    const isPg =
      process.env.DB_TYPE === 'postgres' || process.env.DATABASE_URL?.startsWith('postgres');
    const query = isPg
      ? `
                SELECT 
                    o.id as org_id,
                    o.name as org_name,
                    SUM(CASE WHEN cs.framework_id = 'gdpr' AND cs.status = 'compliant' THEN 1 ELSE 0 END) as gdpr_ok,
                    SUM(CASE WHEN cs.framework_id = 'gdpr' THEN 1 ELSE 0 END) as gdpr_total,
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
                    SUM(CASE WHEN cs.framework_id = 'gdpr' AND cs.status = 'compliant' THEN 1 ELSE 0 END) as gdpr_ok,
                    SUM(CASE WHEN cs.framework_id = 'gdpr' THEN 1 ELSE 0 END) as gdpr_total,
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
        logger.error('[SuperAdmin] Compliance summary error:', err);
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
    logger.error('[SuperAdmin] Compliance summary error:', error);
    res.status(500).json({ error: 'Failed to fetch compliance summary' });
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

  // Test database connectivity and get basic stats
  const dbCheck = await new Promise((resolve) => {
    deps.db.get('SELECT 1 as test', [], (err) => {
      const responseTime = Date.now() - startTime;
      resolve({
        status: err ? 'error' : 'healthy',
        responseTime,
        type: 'PostgreSQL',
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

  const apiTot = Number(apiStats.total_requests ?? 0);
  const apiErr = Number(apiStats.error_count ?? 0);
  const aiTot = Number(aiStats.total_requests ?? 0);
  const aiTok = Number(aiStats.total_tokens ?? 0);
  const aiLat = Number(aiStats.avg_latency ?? 0);
  const aiErrC = Number(aiStats.error_count ?? 0);
  const uTot = Number(userStats.total_users ?? 0);
  const uAct = Number(userStats.active_users ?? 0);
  const prevApiTot = Number(prevApiStats.total_requests ?? 0);
  const prevAiTot = Number(prevAiStats.total_requests ?? 0);
  const prevAiTok = Number(prevAiStats.total_tokens ?? 0);

  res.json({
    metrics: {
      api: {
        total_requests: apiTot,
        error_count: apiErr,
        error_rate: apiTot > 0 ? Math.round((apiErr / apiTot) * 10000) / 100 : 0,
        change: calcChange(apiTot, prevApiTot),
      },
      ai: {
        total_requests: aiTot,
        total_tokens: aiTok,
        avg_latency: Math.round(aiLat),
        error_count: aiErrC,
        change: calcChange(aiTot, prevAiTot),
      },
      users: {
        total_users: uTot,
        active_today: uAct,
      },
      database: {
        total_queries: apiTot,
      },
    },
    charts: {
      api: {
        labels: apiDaily.map((d) => d.date),
        requests: apiDaily.map((d) => Number(d.requests ?? 0)),
        errors: apiDaily.map((d) => Number(d.errors ?? 0)),
      },
      ai: {
        labels: aiDaily.map((d) => d.date),
        requests: aiDaily.map((d) => Number(d.requests ?? 0)),
        tokens: aiDaily.map((d) => Math.round(Number(d.tokens ?? 0) / 1000)),
      },
    },
    topEndpoints: topEndpoints.slice(0, 4).map((e) => ({
      endpoint: `/api/${e.endpoint || 'unknown'}`,
      calls: Number(e.calls ?? 0),
    })),
    comparison: {
      api_requests: {
        current: apiTot,
        previous: prevApiTot,
        change: calcChange(apiTot, prevApiTot),
      },
      ai_requests: {
        current: aiTot,
        previous: prevAiTot,
        change: calcChange(aiTot, prevAiTot),
      },
      ai_tokens: {
        current: aiTok,
        previous: prevAiTok,
        change: calcChange(aiTok, prevAiTok),
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
  const { id, sessionId } = req.params;
  await deps.UserSessionService.endSession(id, sessionId, 'revoked');
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
  const secret = speakeasy.generateSecret({ name: `Consultify (${req.user.email})` });
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

  deps.db.get(
    // `"totp"` was a double-quoted literal — valid in SQLite, but Postgres
    // reads it as an IDENTIFIER, so this resolved to a column named `totp`
    // and failed with 42703 rather than matching any row.
    "SELECT secret FROM user_mfa_methods WHERE user_id = ? AND method_type = 'totp' AND is_primary = 1",
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
          // Same double-quote defect as the SELECT above. `datetime("now")` is
          // NOT a defect — `adaptQuery` rewrites it to NOW() for either quote
          // style — but it is normalised here so the statement reads as one
          // dialect rather than two.
          "UPDATE user_mfa_methods SET is_enabled = 1, last_used_at = datetime('now') WHERE user_id = ? AND method_type = 'totp'",
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
  const body = req.body || {};
  const normalizedPolicy = {
    ...body,
    min_length: body.min_length ?? body.minLength,
    require_uppercase: body.require_uppercase ?? body.requireUppercase,
    require_lowercase: body.require_lowercase ?? body.requireLowercase,
    require_numbers: body.require_numbers ?? body.requireNumbers,
    require_special_chars: body.require_special_chars ?? body.requireSpecialChars,
    max_age_days: body.max_age_days ?? body.maxAgeDays,
    prevent_reuse_count: body.prevent_reuse_count ?? body.preventReuseCount,
    lockout_attempts: body.lockout_attempts ?? body.lockoutAttempts,
    lockout_duration_minutes: body.lockout_duration_minutes ?? body.lockoutDurationMinutes,
    require_mfa: body.require_mfa ?? body.requireMfa,
  };
  if (Number(normalizedPolicy.min_length) < 6 || Number(normalizedPolicy.min_length) > 128) {
    return next(new AppError('Minimum password length must be between 6 and 128', 400));
  }
  const policy = await deps.PasswordPolicyService.setPolicy(id, normalizedPolicy);
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
  const { subject, description } = req.body || {};
  if (!String(subject || '').trim() || !String(description || '').trim()) {
    return next(new AppError('Subject and description are required', 400));
  }
  const ticket = await deps.SupportTicketService.createTicket({
    ...req.body,
    organizationId: req.body?.organizationId || req.user?.organizationId,
    userId: req.body?.userId || req.user?.id,
    subject: String(subject).trim(),
    description: String(description).trim(),
  });
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

const getTicketComments = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const comments = await deps.SupportTicketService.getComments(id);
  res.json(comments);
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
  const { title, content } = req.body || {};
  if (!String(title || '').trim() || !String(content || '').trim()) {
    return next(new AppError('Title and content are required', 400));
  }
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

// Admin Sessions
const getAdminSessions = catchAsync(async (req, res, next) => {
  const { adminId } = req.query;
  const sessions = await deps.AdminSessionService.getActiveSessions(adminId);
  res.json({ sessions });
});

const createAdminSession = catchAsync(async (req, res, next) => {
  const {
    adminId,
    mfaVerified,
    expiresInHours,
    sessionType,
    requestedCapability,
    justification,
    breakGlassReason,
    approvedBy,
  } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('user-agent') || 'Unknown';

  const session = await deps.AdminSessionService.createSession({
    adminId: adminId || req.user.id,
    ipAddress,
    userAgent,
    mfaVerified: mfaVerified || false,
    expiresInHours: expiresInHours || 8,
    sessionType,
    requestedCapability,
    justification,
    breakGlassReason,
    approvedBy,
    createdBy: req.user.id,
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
//
// Hardened against:
//  - malformed metadata_json (try/catch instead of throwing 500),
//  - malformed numeric query params (clamped, never NaN),
//  - missing dedicated audit table or DB outage (degraded JSON, never silent crash).
//
// Response shape: { logs, pagination } so the frontend can render pagination
// without losing back-compat (UI normalizers already accept this shape).
const ADMIN_AUDIT_LOG_STATUSES = new Set(['logged', 'reviewed', 'escalated', 'resolved']);

const clampInt = (
  value: unknown,
  { min, max, fallback }: { min: number; max: number; fallback: number }
): number => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return parsed;
};

const safeParseMetadata = (raw: unknown): { metadata: Record<string, unknown>; ok: boolean } => {
  if (raw == null) return { metadata: {}, ok: true };
  if (typeof raw === 'object') return { metadata: raw as Record<string, unknown>, ok: true };
  if (typeof raw !== 'string') return { metadata: {}, ok: true };
  const trimmed = raw.trim();
  if (!trimmed) return { metadata: {}, ok: true };
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { metadata: parsed as Record<string, unknown>, ok: true };
    }
    return { metadata: { value: parsed }, ok: true };
  } catch {
    return { metadata: { _raw: trimmed, _parseError: true }, ok: false };
  }
};

const normalizeAuditLogRow = (row: any) => {
  const { metadata, ok } = safeParseMetadata(row?.metadata_json);
  const firstName =
    typeof row?.first_name === 'string' && row.first_name.trim() ? row.first_name : null;
  const lastName =
    typeof row?.last_name === 'string' && row.last_name.trim() ? row.last_name : null;
  const email =
    typeof row?.admin_email === 'string' && row.admin_email.trim() ? row.admin_email : null;
  return {
    ...row,
    metadata_json: metadata,
    metadataJson: metadata,
    metadata_parse_ok: ok,
    admin: {
      id: row?.admin_id || null,
      email,
      firstName,
      lastName,
    },
  };
};

const getAdminAuditLogs = catchAsync(async (req, res, _next) => {
  const { adminId, actionType, status, fromDate, toDate } = req.query as Record<string, unknown>;

  const limit = clampInt(req.query.limit, { min: 1, max: 1000, fallback: 100 });
  const offset = clampInt(req.query.offset, { min: 0, max: 1_000_000, fallback: 0 });
  const riskScoreMinRaw = req.query.riskScoreMin;
  const riskScoreMin =
    riskScoreMinRaw === undefined || riskScoreMinRaw === ''
      ? null
      : clampInt(riskScoreMinRaw, { min: 0, max: 100, fallback: 0 });

  const normalizedStatus =
    typeof status === 'string' && ADMIN_AUDIT_LOG_STATUSES.has(status.toLowerCase())
      ? status.toLowerCase()
      : null;

  let sql = `
        SELECT 
            l.*, u.email as admin_email, u.first_name, u.last_name
        FROM admin_audit_logs l
        LEFT JOIN users u ON l.admin_id = u.id
        WHERE 1=1
    `;
  const params: any[] = [];

  if (adminId && typeof adminId === 'string') {
    sql += ' AND l.admin_id = ?';
    params.push(adminId);
  }
  if (actionType && typeof actionType === 'string') {
    sql += ' AND l.action_type = ?';
    params.push(actionType);
  }
  if (riskScoreMin !== null) {
    sql += ' AND l.risk_score >= ?';
    params.push(riskScoreMin);
  }
  if (normalizedStatus) {
    sql += ' AND l.status = ?';
    params.push(normalizedStatus);
  }
  if (fromDate && typeof fromDate === 'string') {
    sql += ' AND l.created_at >= ?';
    params.push(fromDate);
  }
  if (toDate && typeof toDate === 'string') {
    sql += ' AND l.created_at <= ?';
    params.push(toDate);
  }

  sql += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  let rows: any[] = [];
  let degraded = false;
  let degradedReason: string | null = null;

  try {
    rows = (await deps.db.all(sql, params)) || [];
  } catch (err: any) {
    const message = String(err?.message || '');
    const tableMissing =
      /no such table|does not exist|relation .* does not exist/i.test(message) ||
      /admin_audit_logs/i.test(message);
    logger.error('[SuperAdmin] getAdminAuditLogs query failed', {
      error: message,
      tableMissing,
    });
    rows = [];
    degraded = true;
    degradedReason = tableMissing
      ? 'Admin audit log storage is not provisioned in this environment.'
      : 'Admin audit log query failed; serving an empty list to preserve UI integrity.';
  }

  const logs = rows.map(normalizeAuditLogRow);
  const malformedMetadataCount = logs.filter((row) => row.metadata_parse_ok === false).length;

  res.json({
    logs,
    pagination: {
      limit,
      offset,
      count: logs.length,
      hasMore: logs.length === limit,
    },
    integrity: {
      degraded,
      reason: degradedReason,
      malformedMetadataCount,
    },
  });
});

const getAdminAuditStats = catchAsync(async (req, res, _next) => {
  const emptyStats = {
    total_logs: 0,
    unresolved_count: 0,
    high_risk_count: 0,
    medium_risk_count: 0,
    low_risk_count: 0,
    avg_risk_score: 0,
    degraded: false as boolean,
    reason: null as string | null,
  };

  try {
    const stats = await deps.db.get(`
        SELECT 
            COUNT(*) as total_logs,
            SUM(CASE WHEN status IN ('logged', 'escalated') THEN 1 ELSE 0 END) as unresolved_count,
            SUM(CASE WHEN risk_score >= 70 THEN 1 ELSE 0 END) as high_risk_count,
            SUM(CASE WHEN risk_score >= 31 AND risk_score < 70 THEN 1 ELSE 0 END) as medium_risk_count,
            SUM(CASE WHEN risk_score < 31 THEN 1 ELSE 0 END) as low_risk_count,
            AVG(risk_score) as avg_risk_score
        FROM admin_audit_logs
    `);

    const safeNumber = (value: unknown, fallback = 0): number => {
      const parsed = Number(value ?? fallback);
      return Number.isFinite(parsed) ? parsed : fallback;
    };

    res.json({
      ...emptyStats,
      total_logs: safeNumber(stats?.total_logs),
      unresolved_count: safeNumber(stats?.unresolved_count),
      high_risk_count: safeNumber(stats?.high_risk_count),
      medium_risk_count: safeNumber(stats?.medium_risk_count),
      low_risk_count: safeNumber(stats?.low_risk_count),
      avg_risk_score: safeNumber(stats?.avg_risk_score),
    });
  } catch (err: any) {
    const message = String(err?.message || '');
    const tableMissing = /no such table|does not exist|relation .* does not exist/i.test(message);
    logger.error('[SuperAdmin] getAdminAuditStats query failed', {
      error: message,
      tableMissing,
    });
    res.json({
      ...emptyStats,
      degraded: true,
      reason: tableMissing
        ? 'Admin audit log storage is not provisioned in this environment.'
        : 'Stats unavailable due to backend error; rendering safe defaults.',
    });
  }
});

const resolveAdminAuditLog = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { resolutionNotes } = req.body;
  await auditEventsService.log({
    actorId: req.user.id,
    actorType: 'USER',
    organizationId: req.user.organizationId,
    action: 'admin_audit_log.reviewed',
    resourceType: 'admin_audit_log',
    resourceId: id,
    metadata: {
      reviewNotes: resolutionNotes || '',
      immutable: true,
    },
  });

  res.json({ message: 'Audit log review note appended', immutable: true });
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
  if (!deps.PermissionsMatrixService?.getMatrix) {
    return next(
      new AppError('Permissions matrix service is not available', 503, 'FEATURE_UNAVAILABLE')
    );
  }
  const matrix = await deps.PermissionsMatrixService.getMatrix();
  res.json(matrix);
});

const updateRolePermissions = catchAsync(async (req, res, next) => {
  const { roleId } = req.params;
  const { permissions } = req.body;

  if (!permissions || !Array.isArray(permissions)) {
    return res.status(400).json({ error: 'permissions array is required' });
  }

  if (!deps.PermissionsMatrixService?.updateRolePermissions) {
    return next(
      new AppError('Permissions matrix service is not available', 503, 'FEATURE_UNAVAILABLE')
    );
  }
  const result = await deps.PermissionsMatrixService.updateRolePermissions(roleId, permissions);
  res.json({ success: true, message: 'Role permissions updated', ...result });
});

const toggleRolePermission = catchAsync(async (req, res, next) => {
  const { roleId, permissionKey } = req.params;
  const { enabled } = req.body;

  if (!deps.PermissionsMatrixService?.togglePermission) {
    return next(
      new AppError('Permissions matrix service is not available', 503, 'FEATURE_UNAVAILABLE')
    );
  }
  const result = await deps.PermissionsMatrixService.togglePermission(
    roleId,
    permissionKey,
    enabled
  );
  res.json({ success: true, ...result });
});

const copyRolePermissions = catchAsync(async (req, res, next) => {
  const { sourceRole, targetRole } = req.body;

  if (!sourceRole || !targetRole) {
    return res.status(400).json({ error: 'sourceRole and targetRole are required' });
  }

  if (!deps.PermissionsMatrixService?.copyRolePermissions) {
    return next(
      new AppError('Permissions matrix service is not available', 503, 'FEATURE_UNAVAILABLE')
    );
  }
  const result = await deps.PermissionsMatrixService.copyRolePermissions(sourceRole, targetRole);
  res.json({ success: true, message: 'Permissions copied', ...result });
});

const compareRoles = catchAsync(async (req, res, next) => {
  const { role1, role2 } = req.query;

  if (!role1 || !role2) {
    return res.status(400).json({ error: 'role1 and role2 query params are required' });
  }

  if (!deps.PermissionsMatrixService?.compareRoles) {
    return next(
      new AppError('Permissions matrix service is not available', 503, 'FEATURE_UNAVAILABLE')
    );
  }
  const diff = await deps.PermissionsMatrixService.compareRoles(role1, role2);
  res.json(diff);
});

const getPermissionsStats = catchAsync(async (req, res, next) => {
  if (!deps.PermissionsMatrixService?.getStats) {
    return next(
      new AppError('Permissions matrix service is not available', 503, 'FEATURE_UNAVAILABLE')
    );
  }
  const stats = await deps.PermissionsMatrixService.getStats();
  res.json(stats);
});

// Approval Workflows
const ensureApprovalWorkflowTables = async () => {
  const hasWorkflows = await tableExists('admin_approval_workflows');
  if (!hasWorkflows) {
    await new Promise<void>((resolve, reject) => {
      deps.db.run(
        `CREATE TABLE IF NOT EXISTS admin_approval_workflows (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          resource_type TEXT,
          trigger_conditions_json TEXT DEFAULT '{}',
          approvers_json TEXT DEFAULT '[]',
          created_by TEXT,
          is_active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        )`,
        [],
        (err: any) => (err ? reject(err) : resolve())
      );
    });
  }

  const hasRequests = await tableExists('admin_approval_requests');
  if (!hasRequests) {
    await new Promise<void>((resolve, reject) => {
      deps.db.run(
        `CREATE TABLE IF NOT EXISTS admin_approval_requests (
          id TEXT PRIMARY KEY,
          workflow_id TEXT,
          requester_id TEXT,
          status TEXT DEFAULT 'pending',
          approvers_json TEXT DEFAULT '[]',
          request_data_json TEXT DEFAULT '{}',
          completed_at TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        )`,
        [],
        (err: any) => (err ? reject(err) : resolve())
      );
    });
  }
};

const getApprovalWorkflows = catchAsync(async (req, res, next) => {
  await ensureApprovalWorkflowTables();

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
      isActive: flagOn(w.is_active),
    }))
  );
});

const createApprovalWorkflow = catchAsync(async (req, res, next) => {
  await ensureApprovalWorkflowTables();

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
  await ensureApprovalWorkflowTables();

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
  await ensureApprovalWorkflowTables();

  const { id } = req.params;
  await deps.db.run('DELETE FROM admin_approval_workflows WHERE id = ?', [id]);
  res.json({ message: 'Workflow deleted' });
});

const getApprovalRequests = catchAsync(async (req, res, next) => {
  await ensureApprovalWorkflowTables();

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
  await ensureApprovalWorkflowTables();

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
  await ensureApprovalWorkflowTables();

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

  res.json(metrics.map((m) => ({ ...m, isActive: flagOn(m.is_active) })));
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
      isActive: flagOn(m.is_active),
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

export {
  addDashboardWidget,
  addFeedbackComment,
  addIPWhitelist,
  addOrganizationTag,
  addPaymentMethod,
  addPlanFeature,
  addThreat,
  addTicketComment,
  approveAccessRequest,
  approveRequest,
  approveSubscriptionChange,
  assignUserLicense,
  blockDevice,
  blockThreat,
  bulkImportThreats,
  calculateBusinessMetric,
  calculateProration,
  checkDomainReputation,
  checkIPReputation,
  cloneDashboard,
  comparePricingPlans,
  compareRoles,
  copyRolePermissions,
  createAccessCode,
  createAdminPermission,
  createAdminSession,
  createAnalyticsDashboard,
  createAnalyticsReport,
  createApiKey,
  createApprovalWorkflow,
  createAutomationRule,
  createBusinessMetric,
  createComplianceAudit,
  createContractAmendment,
  createCustomerContract,
  createCustomerSuccessNote,
  createDashboard,
  createDataRetentionPolicy,
  createDLPPolicy,
  createDsarRequest,
  createEmailCampaign,
  createEmailTemplate,
  createFeedbackItem,
  createGDPRRequest,
  createLifecycleStage,
  createPredictiveModel,
  createPricingPlan,
  createProcessingRecord,
  createRevenueForecast,
  createRevenueRecognition,
  createSecurityIncident,
  createSubscriptionChange,
  createSuccessPlaybook,
  createSupportTicket,
  createUser,
  createWebhookSubscription,
  deleteAdminPermission,
  deleteAnalyticsDashboard,
  deleteAnalyticsReport,
  deleteApiKey,
  deleteApprovalWorkflow,
  deleteBusinessMetric,
  deleteCustomerContract,
  deleteDashboard,
  deleteDLPPolicy,
  deleteLifecycleStage,
  deleteOrganization,
  deletePaymentMethod,
  deletePredictiveModel,
  deletePricingPlan,
  deleteRevenueForecast,
  deleteSecurityIncident,
  deleteStorageFile,
  deleteSuccessPlaybook,
  deleteThreat,
  evaluatePredictiveModel,
  executeAnalyticsReport,
  executeSuccessPlaybook,
  exportAttribution,
  exportAuditLogs,
  exportComplianceReport,
  generateRevenueForecast,
  getAccessCodes,
  getAccessRequests,
  getActivities,
  getAdminAuditLogs,
  getAdminAuditStats,
  getAdminPermissions,
  // Phase 1: Advanced IAM Module
  getAdminSessions,
  getAdminSessionStats,
  getAllLegalDocs,
  getAnalyticsDashboardData,
  // Phase 3: Analytics Module
  getAnalyticsDashboards,
  getAnalyticsReports,
  getApiKeys,
  getApiKeyUsage,
  getApprovalRequests,
  getApprovalWorkflows,
  // Enterprise Customers Module - Automation
  getAutomationRules,
  getBlockedDomains,
  getBlockedIPs,
  getBusinessMetrics,
  getChurnPrediction,
  getComplianceAudits,
  getComplianceFrameworks,
  getComplianceStatus,
  getComplianceSummary,
  getContractAmendments,
  getContractStats,
  getCustomerContracts,
  getCustomerHealthCheck,
  getCustomerSuccessNotes,
  getDashboardBuilderStats,
  getDashboardById,
  // Dashboard Builder
  getDashboards,
  getDashboardStats,
  getDashboardWidgetData,
  getDatabaseRows,
  getDatabaseTables,
  // Enterprise Customers Module - Compliance
  getDataRetentionPolicies,
  // Data Loss Prevention (DLP)
  getDLPPolicies,
  getDLPPolicyById,
  getDLPStats,
  getDLPViolationById,
  getDLPViolations,
  getDsarRequestById,
  getDsarRequests,
  getEmailCampaigns,
  // Enterprise Customers Module - Communication
  getEmailTemplates,
  getFeatureRoadmap,
  // Enterprise Customers Module - Feedback
  getFeedbackItems,
  getGDPRRequests,
  getInvoicePdf,
  getInvoices,
  getInvoiceStats,
  // Enterprise Customers Module - Security
  getIPWhitelist,
  getLegalDocById,
  getLegalEvents,
  getLegalEventStats,
  // Phase 4: Customer Management Module
  getLifecycleStages,
  getLifecycleStats,
  getLifecycleTransitions,
  getMetricHistory,
  getMetricsStats,
  getMFAMethods,
  getModelPredictions,
  getNotificationPreferences,
  getOrganizationAnalytics,
  getOrganizationHealth,
  // Enterprise Customers Module - Organizations
  getOrganizationMetadata,
  getOrganizationRelationships,
  getOrganizations,
  getOrganizationTags,
  getOrgAttribution,
  getOrgBilling,
  getPartnerSummary,
  getPasswordPolicy,
  getPaymentFailures,
  getPaymentFailureStats,
  getPaymentMethods,
  getPermissionsMatrix,
  getPermissionsStats,
  getPlanFeatures,
  getPlaybookStats,
  getPredictiveModels,
  // Phase 5: Revenue Management Module
  getPricingPlans,
  getProcessingRecords,
  getRecentHighRiskActions,
  getRecognitionSchedule,
  getReportExecutions,
  getRevenueForecasts,
  getRevenueForecastStats,
  getRevenueRecognitions,
  getRevenueRecognitionStats,
  getSecurityEvents,
  getSecurityIncidentById,
  // Security Incident Management
  getSecurityIncidents,
  getSecurityIncidentStats,
  getStorageFiles,
  getStorageUsage,
  getSubscriptionChanges,
  getSubscriptionChangeStats,
  getSuccessActions,
  getSuccessPlaybooks,
  // Enterprise Customers Module - Support
  getSupportTickets,
  getSystemAnalytics,
  getSystemHealth,
  getThreatById,
  // Threat Intelligence
  getThreats,
  getThreatStats,
  getUpcomingRenewals,
  getUsageByOrganization,
  getUserActivity,
  // Enterprise Customers Module - Analytics
  getUserAdoptionMetrics,
  getUserConsents,
  getUserDevices,
  getUserGroups,
  getUserLicense,
  getUserOnboardingProgress,
  // Enterprise Customers Module - Users
  getUserProfileExtended,
  getUsers,
  getUserSessions,
  getWebhookSubscriptions,
  impersonateUser,
  inviteUser,
  makePrediction,
  markInvoicePaid,
  publishLegalDoc,
  recognizeRevenue,
  refreshToken,
  rejectAccessRequest,
  rejectRequest,
  rejectSubscriptionChange,
  remindInvoice,
  removeDashboardWidget,
  removeIPWhitelist,
  removeOrganizationTag,
  removePlanFeature,
  reorderDashboardWidgets,
  resetUserPassword,
  resolveAdminAuditLog,
  resolveDLPViolation,
  resolveSecurityEvent,
  resolveSecurityIncident,
  retryPayment,
  revokeAdminSession,
  revokeAllAdminSessions,
  revokeUserSession,
  scanResourceDLP,
  scheduleAnalyticsReport,
  setDependencies,
  setupTOTP,
  shareAnalyticsDashboard,
  toggleDashboardShare,
  toggleDLPPolicy,
  toggleLegalDocActive,
  toggleRolePermission,
  trainPredictiveModel,
  transitionOrganization,
  unblockThreat,
  updateAdminPermission,
  updateAnalyticsDashboard,
  updateAnalyticsReport,
  updateApprovalWorkflow,
  updateAutomationRule,
  updateBusinessMetric,
  updateComplianceControl,
  updateCustomerContract,
  updateDashboard,
  updateDashboardWidget,
  updateDLPPolicy,
  updateFeatureRoadmap,
  updateLifecycleStage,
  updateNotificationPreferences,
  updateOrganization,
  updateOrganizationMetadata,
  updatePasswordPolicy,
  updatePaymentMethod,
  updatePredictiveModel,
  updatePricingPlan,
  updateRevenueForecast,
  updateRevenueRecognition,
  updateRolePermissions,
  updateSecurityIncident,
  updateSuccessPlaybook,
  updateSupportTicket,
  updateThreat,
  updateUser,
  updateUserConsent,
  updateUserOnboardingProgress,
  updateUserProfileExtended,
  uploadBrandingLogo,
  verifyTOTP,
  voteFeedback,
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
  deleteUser,
  inviteUser,
  resetUserPassword,
  getAccessRequests,
  approveAccessRequest,
  rejectAccessRequest,
  getAccessCodes,
  createAccessCode,
  deactivateAccessCode,
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
  updateComplianceControl,
  createDsarRequest,
  getDsarRequestById,
  createComplianceAudit,
  createProcessingRecord,
  getProcessingRecords,
  exportComplianceReport,
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
  getTicketComments,
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

  // Extracted domain controllers (spread from namespace imports)
  ...securityCtrl,
  ...threatDlpCtrl,
  ...integrationsCtrl,
  ...dashboardCtrl,
  ...revenueCtrl,
  ...customerCtrl,
};
