import { AppError, type AuthenticatedRequest, catchAsync, deps } from './shared.js';

/**
 * Get all threats
 */
export const getThreats = catchAsync(async (req, res, next) => {
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
    limit: parseInt(String(limit)),
    offset: parseInt(String(offset)),
  });
  res.json(threats);
});

/**
 * Get threat statistics
 */
export const getThreatStats = catchAsync(async (req, res, next) => {
  const stats = await deps.ThreatIntelligenceService.getStats();
  res.json(stats);
});

/**
 * Get threat by ID
 */
export const getThreatById = catchAsync(async (req, res, next) => {
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
export const addThreat = catchAsync(async (req, res, next) => {
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
export const updateThreat = catchAsync(async (req, res, next) => {
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
export const blockThreat = catchAsync(async (req, res, next) => {
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
export const unblockThreat = catchAsync(async (req, res, next) => {
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
export const deleteThreat = catchAsync(async (req, res, next) => {
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
export const checkIPReputation = catchAsync(async (req, res, next) => {
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
export const checkDomainReputation = catchAsync(async (req, res, next) => {
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
export const getBlockedIPs = catchAsync(async (req, res, next) => {
  const blockedIPs = await deps.ThreatIntelligenceService.getBlockedIPs();
  res.json(blockedIPs);
});

/**
 * Get blocked domains
 */
export const getBlockedDomains = catchAsync(async (req, res, next) => {
  const blockedDomains = await deps.ThreatIntelligenceService.getBlockedDomains();
  res.json(blockedDomains);
});

/**
 * Bulk import threats
 */
export const bulkImportThreats = catchAsync(async (req, res, next) => {
  const { threats } = req.body;

  if (!threats || !Array.isArray(threats) || threats.length === 0) {
    return next(new AppError('Threats array is required', 400));
  }

  const result = await deps.ThreatIntelligenceService.bulkImport(threats);
  res.json(result);
});

/**
 * Get all DLP policies
 */
export const getDLPPolicies = catchAsync(async (req, res, next) => {
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
export const getDLPPolicyById = catchAsync(async (req, res, next) => {
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
export const createDLPPolicy = catchAsync(async (req, res, next) => {
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
    createdBy: (req as AuthenticatedRequest).user!.id,
  });

  res.status(201).json(policy);
});

/**
 * Update a DLP policy
 */
export const updateDLPPolicy = catchAsync(async (req, res, next) => {
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
export const toggleDLPPolicy = catchAsync(async (req, res, next) => {
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
export const deleteDLPPolicy = catchAsync(async (req, res, next) => {
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
export const getDLPViolations = catchAsync(async (req, res, next) => {
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
export const getDLPViolationById = catchAsync(async (req, res, next) => {
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
export const resolveDLPViolation = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const resolved = await deps.DLPService.resolveViolation(
    id,
    (req as AuthenticatedRequest).user!.id
  );

  if (!resolved) {
    return next(new AppError('DLP Violation not found', 404));
  }

  const violation = await deps.DLPService.getViolationById(id);
  res.json(violation);
});

/**
 * Get DLP statistics
 */
export const getDLPStats = catchAsync(async (req, res, next) => {
  const stats = await deps.DLPService.getStats();
  res.json(stats);
});

/**
 * Scan a resource for DLP violations
 */
export const scanResourceDLP = catchAsync(async (req, res, next) => {
  const { resourceType, resourceId, content } = req.body;

  if (!resourceType || !content) {
    return next(new AppError('Resource type and content are required', 400));
  }

  const result = await deps.DLPService.scanResource(resourceType, resourceId, content);
  res.json(result);
});
