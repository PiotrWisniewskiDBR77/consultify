import logger from '../../utils/Logger.js';
import { AppError, type AuthenticatedRequest, catchAsync, deps, tableExists } from './shared.js';

/**
 * Get all security incidents
 */
export const getSecurityIncidents = catchAsync(async (req, res, next) => {
  const { status, severity, incidentType, limit = 100, offset = 0 } = req.query;
  const incidents = await deps.SecurityIncidentService.getIncidents({
    status,
    severity,
    incidentType,
    limit: parseInt(limit as string),
    offset: parseInt(offset as string),
  });
  res.json(incidents);
});

/**
 * Get security incident statistics
 */
export const getSecurityIncidentStats = catchAsync(async (req, res, next) => {
  const stats = await deps.SecurityIncidentService.getStats();
  res.json(stats);
});

/**
 * Get security incident by ID
 */
export const getSecurityIncidentById = catchAsync(async (req, res, next) => {
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
export const createSecurityIncident = catchAsync(async (req, res, next) => {
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
export const updateSecurityIncident = catchAsync(async (req, res, next) => {
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
export const resolveSecurityIncident = catchAsync(async (req: AuthenticatedRequest, res, next) => {
  const { id } = req.params;
  const { resolutionNotes } = req.body;

  const resolved = await deps.SecurityIncidentService.resolveIncident(
    id,
    req.user!.id,
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
export const deleteSecurityIncident = catchAsync(async (req, res, next) => {
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
export const getSecurityEventStats = catchAsync(async (req, res, next) => {
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
export const getIPAccessRules = catchAsync(async (req, res, next) => {
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

    res.json([]);
  } catch (error) {
    logger.error('getIPAccessRules error:', error);
    res.status(500).json({ error: 'Failed to fetch IP access rules' });
  }
});

/**
 * Update/Toggle IP access rule
 */
export const updateIPRule = catchAsync(async (req, res, next) => {
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
export const getSecurityPolicies = catchAsync(async (req, res, next) => {
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
    logger.error('getSecurityPolicies error:', error);
    res.status(500).json({ error: 'Failed to fetch security policies' });
  }
});

/**
 * Update security policy
 */
export const updateSecurityPolicy = catchAsync(async (req, res, next) => {
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
