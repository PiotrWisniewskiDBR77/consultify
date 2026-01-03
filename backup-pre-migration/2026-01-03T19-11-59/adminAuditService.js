/**
 * Admin Audit Service
 * 
 * Comprehensive audit logging for all admin actions with risk scoring,
 * filtering, export capabilities, and compliance features.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { v4: uuidv4 } = require('uuid');

// Dependency injection for testing
const deps = {
    db: require('../database')
};

/**
 * Set dependencies for testing
 */
const setDependencies = (newDeps) => {
    Object.assign(deps, newDeps);
};

/**
 * Risk level definitions based on action type
 */
const RISK_LEVELS = {
    // Critical risk actions
    delete_organization: 100,
    delete_user: 90,
    change_superadmin_role: 95,
    export_all_data: 85,
    modify_security_policy: 80,
    
    // High risk actions
    change_user_role: 70,
    modify_billing: 65,
    bulk_delete: 75,
    access_sensitive_data: 60,
    
    // Medium risk actions
    create_user: 40,
    modify_settings: 35,
    create_organization: 30,
    modify_user: 35,
    
    // Low risk actions
    view_data: 10,
    login: 5,
    logout: 5,
    search: 5,
    export_report: 15
};

/**
 * Action type categories
 */
const ACTION_CATEGORIES = {
    authentication: ['login', 'logout', 'mfa_verify', 'password_reset', 'session_revoke'],
    user_management: ['create_user', 'modify_user', 'delete_user', 'change_user_role', 'bulk_user_action'],
    organization_management: ['create_organization', 'modify_organization', 'delete_organization', 'change_org_status'],
    security: ['modify_security_policy', 'change_superadmin_role', 'ip_whitelist_change', 'mfa_config'],
    data_access: ['view_data', 'export_data', 'export_all_data', 'access_sensitive_data', 'search'],
    billing: ['modify_billing', 'create_invoice', 'process_payment', 'modify_subscription'],
    system: ['modify_settings', 'update_config', 'run_job', 'system_maintenance']
};

/**
 * Calculate risk score based on action type and context
 */
const calculateRiskScore = (actionType, context = {}) => {
    let baseScore = RISK_LEVELS[actionType] || 30;
    
    // Adjust based on context
    if (context.affectedCount && context.affectedCount > 10) {
        baseScore += Math.min(20, context.affectedCount);
    }
    
    if (context.isFirstTime) {
        baseScore += 5;
    }
    
    if (context.unusualHour) {
        baseScore += 10;
    }
    
    if (context.newIpAddress) {
        baseScore += 15;
    }
    
    return Math.min(100, baseScore);
};

/**
 * Log an admin action
 */
const logAction = async ({
    adminId,
    actionType,
    resourceType,
    resourceId = null,
    description,
    details = {},
    ipAddress = null,
    userAgent = null,
    status = 'success',
    context = {}
}) => {
        await initDeps();
        const id = deps.uuidv4();
    const riskScore = calculateRiskScore(actionType, context);
    const detailsJson = JSON.stringify(details);
    
    const sql = `
        INSERT INTO admin_audit_logs (
            id, admin_id, action_type, resource_type, resource_id,
            description, details, ip_address, user_agent, risk_score,
            status, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `;
    
    await deps.db.run(sql, [
        id, adminId, actionType, resourceType, resourceId,
        description, detailsJson, ipAddress, userAgent, riskScore,
        status
    ]);
    
    return {
        id,
        adminId,
        actionType,
        resourceType,
        resourceId,
        description,
        details,
        ipAddress,
        userAgent,
        riskScore,
        status,
        createdAt: new Date().toISOString()
    };
};

/**
 * Get audit logs with comprehensive filtering
 */
const getLogs = async (filters = {}) => {
    const {
        adminId,
        actionType,
        resourceType,
        status,
        riskLevel, // 'low', 'medium', 'high', 'critical'
        fromDate,
        toDate,
        searchTerm,
        limit = 100,
        offset = 0
    } = filters;
    
    let sql = `
        SELECT 
            l.id, l.admin_id, l.action_type, l.resource_type, l.resource_id,
            l.description, l.details, l.ip_address, l.user_agent, l.risk_score,
            l.status, l.created_at, l.resolved_at,
            u.email as admin_email, u.first_name, u.last_name
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
    
    if (resourceType) {
        sql += ' AND l.resource_type = ?';
        params.push(resourceType);
    }
    
    if (status) {
        sql += ' AND l.status = ?';
        params.push(status);
    }
    
    if (riskLevel) {
        switch (riskLevel) {
            case 'critical':
                sql += ' AND l.risk_score >= 80';
                break;
            case 'high':
                sql += ' AND l.risk_score >= 60 AND l.risk_score < 80';
                break;
            case 'medium':
                sql += ' AND l.risk_score >= 30 AND l.risk_score < 60';
                break;
            case 'low':
                sql += ' AND l.risk_score < 30';
                break;
        }
    }
    
    if (fromDate) {
        sql += ' AND l.created_at >= ?';
        params.push(fromDate);
    }
    
    if (toDate) {
        sql += ' AND l.created_at <= ?';
        params.push(toDate);
    }
    
    if (searchTerm) {
        sql += ' AND (l.description LIKE ? OR l.details LIKE ?)';
        const searchPattern = `%${searchTerm}%`;
        params.push(searchPattern, searchPattern);
    }
    
    // Get total count
    const countSql = sql.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as count FROM');
    const countResult = await deps.db.get(countSql, params);
    const total = countResult?.count || 0;
    
    // Add ordering and pagination
    sql += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const logs = await deps.db.all(sql, params);
    
    return {
        logs: logs.map(l => ({
            id: l.id,
            adminId: l.admin_id,
            actionType: l.action_type,
            resourceType: l.resource_type,
            resourceId: l.resource_id,
            description: l.description,
            details: l.details ? JSON.parse(l.details) : {},
            ipAddress: l.ip_address,
            userAgent: l.user_agent,
            riskScore: l.risk_score,
            riskLevel: getRiskLevel(l.risk_score),
            status: l.status,
            createdAt: l.created_at,
            resolvedAt: l.resolved_at,
            admin: {
                email: l.admin_email,
                firstName: l.first_name,
                lastName: l.last_name
            }
        })),
        total,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
        totalPages: Math.ceil(total / limit)
    };
};

/**
 * Get risk level label from score
 */
const getRiskLevel = (score) => {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 30) return 'medium';
    return 'low';
};

/**
 * Get a single audit log by ID
 */
const getLogById = async (logId) => {
    const sql = `
        SELECT 
            l.*, 
            u.email as admin_email, u.first_name, u.last_name
        FROM admin_audit_logs l
        LEFT JOIN users u ON l.admin_id = u.id
        WHERE l.id = ?
    `;
    
    const log = await deps.db.get(sql, [logId]);
    
    if (!log) return null;
    
    return {
        id: log.id,
        adminId: log.admin_id,
        actionType: log.action_type,
        resourceType: log.resource_type,
        resourceId: log.resource_id,
        description: log.description,
        details: log.details ? JSON.parse(log.details) : {},
        ipAddress: log.ip_address,
        userAgent: log.user_agent,
        riskScore: log.risk_score,
        riskLevel: getRiskLevel(log.risk_score),
        status: log.status,
        createdAt: log.created_at,
        resolvedAt: log.resolved_at,
        admin: {
            email: log.admin_email,
            firstName: log.first_name,
            lastName: log.last_name
        }
    };
};

/**
 * Mark log as resolved
 */
const resolveLog = async (logId, resolverId, comment = null) => {
    const sql = `
        UPDATE admin_audit_logs 
        SET status = 'resolved', 
            resolved_at = datetime('now'),
            details = json_set(COALESCE(details, '{}'), '$.resolvedBy', ?, '$.resolveComment', ?)
        WHERE id = ?
    `;
    
    await deps.db.run(sql, [resolverId, comment, logId]);
    return getLogById(logId);
};

/**
 * Get audit statistics
 */
const getStats = async (period = 'day') => {
    let dateFilter;
    switch (period) {
        case 'week':
            dateFilter = "datetime('now', '-7 days')";
            break;
        case 'month':
            dateFilter = "datetime('now', '-30 days')";
            break;
        case 'year':
            dateFilter = "datetime('now', '-365 days')";
            break;
        default: // day
            dateFilter = "datetime('now', '-24 hours')";
    }
    
    const sql = `
        SELECT 
            COUNT(*) as total_logs,
            SUM(CASE WHEN risk_score >= 80 THEN 1 ELSE 0 END) as critical_count,
            SUM(CASE WHEN risk_score >= 60 AND risk_score < 80 THEN 1 ELSE 0 END) as high_count,
            SUM(CASE WHEN risk_score >= 30 AND risk_score < 60 THEN 1 ELSE 0 END) as medium_count,
            SUM(CASE WHEN risk_score < 30 THEN 1 ELSE 0 END) as low_count,
            SUM(CASE WHEN status = 'unresolved' THEN 1 ELSE 0 END) as unresolved_count,
            COUNT(DISTINCT admin_id) as unique_admins,
            AVG(risk_score) as avg_risk_score
        FROM admin_audit_logs
        WHERE created_at >= ${dateFilter}
    `;
    
    const stats = await deps.db.get(sql);
    
    // Get action type breakdown
    const actionSql = `
        SELECT action_type, COUNT(*) as count
        FROM admin_audit_logs
        WHERE created_at >= ${dateFilter}
        GROUP BY action_type
        ORDER BY count DESC
        LIMIT 10
    `;
    
    const actionBreakdown = await deps.db.all(actionSql);
    
    // Get top admins by activity
    const adminSql = `
        SELECT 
            l.admin_id, u.email, u.first_name, u.last_name,
            COUNT(*) as action_count,
            AVG(l.risk_score) as avg_risk_score
        FROM admin_audit_logs l
        LEFT JOIN users u ON l.admin_id = u.id
        WHERE l.created_at >= ${dateFilter}
        GROUP BY l.admin_id
        ORDER BY action_count DESC
        LIMIT 10
    `;
    
    const topAdmins = await deps.db.all(adminSql);
    
    return {
        totalLogs: stats?.total_logs || 0,
        byRiskLevel: {
            critical: stats?.critical_count || 0,
            high: stats?.high_count || 0,
            medium: stats?.medium_count || 0,
            low: stats?.low_count || 0
        },
        unresolvedCount: stats?.unresolved_count || 0,
        uniqueAdmins: stats?.unique_admins || 0,
        avgRiskScore: Math.round(stats?.avg_risk_score || 0),
        byActionType: actionBreakdown.reduce((acc, a) => {
            acc[a.action_type] = a.count;
            return acc;
        }, {}),
        topAdmins: topAdmins.map(a => ({
            adminId: a.admin_id,
            email: a.email,
            name: `${a.first_name || ''} ${a.last_name || ''}`.trim(),
            actionCount: a.action_count,
            avgRiskScore: Math.round(a.avg_risk_score)
        }))
    };
};

/**
 * Export audit logs to CSV format
 */
const exportToCsv = async (filters = {}) => {
    const { logs } = await getLogs({ ...filters, limit: 10000, offset: 0 });
    
    const headers = [
        'ID', 'Admin Email', 'Action Type', 'Resource Type', 'Resource ID',
        'Description', 'Risk Score', 'Risk Level', 'Status', 'IP Address',
        'Created At', 'Resolved At'
    ];
    
    const rows = logs.map(log => [
        log.id,
        log.admin.email || '',
        log.actionType,
        log.resourceType,
        log.resourceId || '',
        log.description || '',
        log.riskScore,
        log.riskLevel,
        log.status,
        log.ipAddress || '',
        log.createdAt,
        log.resolvedAt || ''
    ]);
    
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    return csvContent;
};

/**
 * Get recent high-risk actions for dashboard
 */
const getRecentHighRisk = async (limit = 10) => {
    const sql = `
        SELECT 
            l.id, l.admin_id, l.action_type, l.resource_type, l.description,
            l.risk_score, l.status, l.created_at,
            u.email as admin_email, u.first_name, u.last_name
        FROM admin_audit_logs l
        LEFT JOIN users u ON l.admin_id = u.id
        WHERE l.risk_score >= 60
        ORDER BY l.created_at DESC
        LIMIT ?
    `;
    
    const logs = await deps.db.all(sql, [limit]);
    
    return logs.map(l => ({
        id: l.id,
        adminId: l.admin_id,
        adminEmail: l.admin_email,
        adminName: `${l.first_name || ''} ${l.last_name || ''}`.trim(),
        actionType: l.action_type,
        resourceType: l.resource_type,
        description: l.description,
        riskScore: l.risk_score,
        riskLevel: getRiskLevel(l.risk_score),
        status: l.status,
        createdAt: l.created_at
    }));
};

/**
 * Cleanup old audit logs (data retention)
 */
const cleanupOldLogs = async (retentionDays = 365) => {
    const sql = `
        DELETE FROM admin_audit_logs 
        WHERE created_at < datetime('now', '-' || ? || ' days')
        AND status = 'resolved'
    `;
    
    const result = await deps.db.run(sql, [retentionDays]);
    return result.changes;
};

export default {
    setDependencies,
    RISK_LEVELS,
    ACTION_CATEGORIES,
    calculateRiskScore,
    getRiskLevel,
    logAction,
    getLogs,
    getLogById,
    resolveLog,
    getStats,
    exportToCsv,
    getRecentHighRisk,
    cleanupOldLogs
};





