/**
 * Audit Log Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Comprehensive audit logging for enterprise compliance and security.
 * Features:
 * - Immutable audit trail
 * - Risk level classification
 * - Compliance tagging (GDPR, SOC2, ISO27001)
 * - Search and filtering
 * - Export capabilities
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ComplianceTag = 'GDPR' | 'SOC2' | 'ISO27001' | 'HIPAA' | 'PCI_DSS';

export interface AuditLogData {
    user_id?: string;
    user_email?: string;
    ip_address?: string;
    user_agent?: string;
    action_type: string;
    resource_type: string;
    resource_id?: string;
    before_data?: unknown;
    after_data?: unknown;
    risk_level?: RiskLevel;
    compliance_tags?: ComplianceTag[];
    request_id?: string;
    organization_id?: string;
    metadata?: Record<string, unknown>;
}

export interface AuditLog {
    id: string;
    timestamp: string;
    user_id?: string;
    user_email?: string;
    ip_address?: string;
    user_agent?: string;
    action_type: string;
    resource_type: string;
    resource_id?: string;
    before_data?: string;
    after_data?: string;
    risk_level: RiskLevel;
    compliance_tags: string;
    request_id?: string;
    organization_id?: string;
    metadata: string;
}

export interface AuditLogFilters {
    search?: string;
    riskLevel?: RiskLevel;
    flaggedOnly?: boolean;
    startDate?: string;
    endDate?: string;
    userId?: string;
    actionType?: string;
    resourceType?: string;
    resourceId?: string;
    organizationId?: string;
    complianceTag?: ComplianceTag;
}

export interface Pagination {
    page: number;
    pageSize: number;
}

export interface PaginatedAuditLogs {
    logs: AuditLog[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

// ==========================================
// AUDIT LOG SERVICE
// ==========================================

class AuditLogService {
    private _db: IDatabase;

    constructor(dbInstance?: IDatabase) {
        this._db = dbInstance || getDatabase();
    }

    /**
     * Create an audit log entry
     */
    async createLog(logData: AuditLogData): Promise<{ id: string; timestamp: string }> {
        const {
            user_id,
            user_email,
            ip_address,
            user_agent,
            action_type,
            resource_type,
            resource_id,
            before_data,
            after_data,
            risk_level = 'LOW',
            compliance_tags = [],
            request_id,
            organization_id,
            metadata = {},
        } = logData;

        const id = uuidv4();
        const timestamp = new Date().toISOString();

        try {
            await DbPromise.run(
                `INSERT INTO audit_logs (
                    id, timestamp, user_id, user_email, ip_address, user_agent,
                    action_type, resource_type, resource_id, before_data, after_data,
                    risk_level, compliance_tags, request_id, organization_id, metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id,
                    timestamp,
                    user_id,
                    user_email,
                    ip_address,
                    user_agent,
                    action_type,
                    resource_type,
                    resource_id,
                    before_data ? JSON.stringify(before_data) : null,
                    after_data ? JSON.stringify(after_data) : null,
                    risk_level,
                    JSON.stringify(compliance_tags),
                    request_id,
                    organization_id,
                    JSON.stringify(metadata),
                ],
            );
            return { id, timestamp };
        } catch (err: unknown) {
            logger.error('[AuditLog] Error creating log:', err instanceof Error ? err : null);
            throw err;
        }
    }

    /**
     * Get audit logs with filtering and pagination
     */
    async getLogs(
        filters: AuditLogFilters = {},
        pagination: Pagination = { page: 1, pageSize: 50 },
    ): Promise<PaginatedAuditLogs> {
        const {
            search,
            riskLevel,
            flaggedOnly,
            startDate,
            endDate,
            userId,
            actionType,
            resourceType,
            resourceId,
            organizationId,
            complianceTag,
        } = filters;

        const { page = 1, pageSize = 50 } = pagination;
        const offset = (page - 1) * pageSize;

        let query = 'SELECT * FROM audit_logs WHERE 1=1';
        const params: unknown[] = [];

        if (search) {
            query += ` AND (
                action_type LIKE ? OR 
                resource_type LIKE ? OR 
                user_email LIKE ? OR
                request_id LIKE ?
            )`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        if (riskLevel) {
            query += ' AND risk_level = ?';
            params.push(riskLevel);
        }

        if (flaggedOnly) {
            query += ' AND risk_level IN (?, ?)';
            params.push('HIGH', 'CRITICAL');
        }

        if (startDate) {
            query += ' AND timestamp >= ?';
            params.push(startDate);
        }

        if (endDate) {
            query += ' AND timestamp <= ?';
            params.push(endDate);
        }

        if (userId) {
            query += ' AND user_id = ?';
            params.push(userId);
        }

        if (actionType) {
            query += ' AND action_type = ?';
            params.push(actionType);
        }

        if (resourceType) {
            query += ' AND resource_type = ?';
            params.push(resourceType);
        }

        if (resourceId) {
            query += ' AND resource_id = ?';
            params.push(resourceId);
        }

        if (organizationId) {
            query += ' AND organization_id = ?';
            params.push(organizationId);
        }

        if (complianceTag) {
            query += ' AND compliance_tags LIKE ?';
            params.push(`%${complianceTag}%`);
        }

        // Get total count
        const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
        const countResult = await DbPromise.get<{ total: number }>(countQuery, params);
        const total = countResult?.total || 0;

        // Get paginated results
        query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
        params.push(pageSize, offset);

        const logs = await DbPromise.all<AuditLog>(query, params);

        return {
            logs,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    }
}

export const auditLogService = new AuditLogService();
export default auditLogService;
