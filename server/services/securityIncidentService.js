/**
 * Security Incident Service
 * Manages security incidents in the enterprise security module
 */

import { v4 as uuidv4 } from 'uuid';

import db from '../database.js';



// Dependency injection for testing
const deps = {
    db,
};

/**
 * Set dependencies for testing
 */
const setDependencies = (newDeps) => {
    Object.assign(deps, newDeps);
};

/**
 * Severity levels
 */
const SEVERITY = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    CRITICAL: 'CRITICAL'
};

/**
 * Status types
 */
const STATUS = {
    OPEN: 'open',
    IN_PROGRESS: 'in_progress',
    RESOLVED: 'resolved',
    CLOSED: 'closed'
};

/**
 * Incident types
 */
const INCIDENT_TYPES = {
    UNAUTHORIZED_ACCESS: 'unauthorized_access',
    DATA_BREACH: 'data_breach',
    MALWARE: 'malware',
    PHISHING: 'phishing',
    DOS_ATTACK: 'dos_attack',
    BRUTE_FORCE: 'brute_force',
    PRIVILEGE_ESCALATION: 'privilege_escalation',
    DATA_EXFILTRATION: 'data_exfiltration',
    INSIDER_THREAT: 'insider_threat',
    CONFIGURATION_ERROR: 'configuration_error',
    SUSPICIOUS_ACTIVITY: 'suspicious_activity',
    OTHER: 'other'
};

/**
 * Create a new security incident
 */
const createIncident = async ({ incidentType, severity, description, affectedResources = [], assignedTo }) => {
    const id = uuidv4();
    const detectedAt = new Date().toISOString();
    
    const sql = `
        INSERT INTO security_incidents (
            id, incident_type, severity, status, description, 
            affected_resources_json, detected_at, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `;
    
    await deps.db.run(sql, [
        id,
        incidentType,
        severity || SEVERITY.MEDIUM,
        STATUS.OPEN,
        description,
        JSON.stringify(affectedResources),
        detectedAt
    ]);
    
    return {
        id,
        incidentType,
        severity: severity || SEVERITY.MEDIUM,
        status: STATUS.OPEN,
        description,
        affectedResources,
        detectedAt,
        createdAt: detectedAt
    };
};

/**
 * Get incident by ID
 */
const getIncidentById = async (id) => {
    const sql = `
        SELECT 
            si.*,
            u.email as resolved_by_email,
            u.first_name as resolved_by_first_name,
            u.last_name as resolved_by_last_name
        FROM security_incidents si
        LEFT JOIN users u ON si.resolved_by = u.id
        WHERE si.id = ?
    `;
    
    const incident = await deps.db.get(sql, [id]);
    
    if (!incident) return null;
    
    return {
        id: incident.id,
        incidentType: incident.incident_type,
        severity: incident.severity,
        status: incident.status,
        description: incident.description,
        affectedResources: JSON.parse(incident.affected_resources_json || '[]'),
        detectedAt: incident.detected_at,
        resolvedAt: incident.resolved_at,
        resolutionNotes: incident.resolution_notes,
        createdAt: incident.created_at,
        resolvedBy: incident.resolved_by ? {
            id: incident.resolved_by,
            email: incident.resolved_by_email,
            firstName: incident.resolved_by_first_name,
            lastName: incident.resolved_by_last_name
        } : null
    };
};

/**
 * Get all incidents with filters
 */
const getIncidents = async ({ status, severity, incidentType, limit = 100, offset = 0 } = {}) => {
    let sql = `
        SELECT 
            si.*,
            u.email as resolved_by_email,
            u.first_name as resolved_by_first_name,
            u.last_name as resolved_by_last_name
        FROM security_incidents si
        LEFT JOIN users u ON si.resolved_by = u.id
        WHERE 1=1
    `;
    const params = [];
    
    if (status) {
        sql += ` AND si.status = ?`;
        params.push(status);
    }
    if (severity) {
        sql += ` AND si.severity = ?`;
        params.push(severity);
    }
    if (incidentType) {
        sql += ` AND si.incident_type = ?`;
        params.push(incidentType);
    }
    
    sql += ` ORDER BY si.detected_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    const incidents = await deps.db.all(sql, params);
    
    return incidents.map(incident => ({
        id: incident.id,
        incidentType: incident.incident_type,
        severity: incident.severity,
        status: incident.status,
        description: incident.description,
        affectedResources: JSON.parse(incident.affected_resources_json || '[]'),
        detectedAt: incident.detected_at,
        resolvedAt: incident.resolved_at,
        resolutionNotes: incident.resolution_notes,
        createdAt: incident.created_at,
        resolvedBy: incident.resolved_by ? {
            id: incident.resolved_by,
            email: incident.resolved_by_email,
            firstName: incident.resolved_by_first_name,
            lastName: incident.resolved_by_last_name
        } : null
    }));
};

/**
 * Update incident status
 */
const updateIncidentStatus = async (id, status) => {
    const sql = `UPDATE security_incidents SET status = ? WHERE id = ?`;
    const result = await deps.db.run(sql, [status, id]);
    return result.changes > 0;
};

/**
 * Resolve an incident
 */
const resolveIncident = async (id, resolvedBy, resolutionNotes) => {
    const sql = `
        UPDATE security_incidents 
        SET status = ?, resolved_at = datetime('now'), resolved_by = ?, resolution_notes = ?
        WHERE id = ?
    `;
    const result = await deps.db.run(sql, [STATUS.RESOLVED, resolvedBy, resolutionNotes, id]);
    return result.changes > 0;
};

/**
 * Update incident
 */
const updateIncident = async (id, updates) => {
    const allowedFields = ['severity', 'description', 'status'];
    const setClauses = [];
    const params = [];
    
    for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key) && value !== undefined) {
            setClauses.push(`${key} = ?`);
            params.push(value);
        }
    }
    
    if (setClauses.length === 0) return false;
    
    params.push(id);
    const sql = `UPDATE security_incidents SET ${setClauses.join(', ')} WHERE id = ?`;
    const result = await deps.db.run(sql, params);
    return result.changes > 0;
};

/**
 * Delete incident
 */
const deleteIncident = async (id) => {
    const sql = `DELETE FROM security_incidents WHERE id = ?`;
    const result = await deps.db.run(sql, [id]);
    return result.changes > 0;
};

/**
 * Get incident statistics
 */
const getStats = async () => {
    const sql = `
        SELECT 
            COUNT(*) as total_incidents,
            SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_count,
            SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_count,
            SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_count,
            SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_count,
            SUM(CASE WHEN severity = 'CRITICAL' THEN 1 ELSE 0 END) as critical_count,
            SUM(CASE WHEN severity = 'HIGH' THEN 1 ELSE 0 END) as high_count,
            SUM(CASE WHEN severity = 'MEDIUM' THEN 1 ELSE 0 END) as medium_count,
            SUM(CASE WHEN severity = 'LOW' THEN 1 ELSE 0 END) as low_count
        FROM security_incidents
    `;
    
    const stats = await deps.db.get(sql);
    
    return {
        totalIncidents: stats?.total_incidents || 0,
        byStatus: {
            open: stats?.open_count || 0,
            inProgress: stats?.in_progress_count || 0,
            resolved: stats?.resolved_count || 0,
            closed: stats?.closed_count || 0
        },
        bySeverity: {
            critical: stats?.critical_count || 0,
            high: stats?.high_count || 0,
            medium: stats?.medium_count || 0,
            low: stats?.low_count || 0
        }
    };
};

/**
 * Get incidents by time range
 */
const getIncidentsByTimeRange = async (startDate, endDate) => {
    const sql = `
        SELECT 
            DATE(detected_at) as date,
            COUNT(*) as count,
            severity
        FROM security_incidents
        WHERE detected_at BETWEEN ? AND ?
        GROUP BY DATE(detected_at), severity
        ORDER BY date ASC
    `;
    
    return deps.db.all(sql, [startDate, endDate]);
};

export default {
    setDependencies,
    createIncident,
    getIncidentById,
    getIncidents,
    updateIncidentStatus,
    resolveIncident,
    updateIncident,
    deleteIncident,
    getStats,
    getIncidentsByTimeRange,
    SEVERITY,
    STATUS,
    INCIDENT_TYPES
};
