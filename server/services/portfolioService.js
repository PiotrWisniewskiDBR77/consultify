/**
 * Portfolio Service
 * 
 * Combines initiative and roadmap data for unified portfolio view.
 * Provides aggregated data, stats, and bulk operations.
 */

import { getDatabase } from '../src/database/index.js';
const db = getDatabase();
import * as queryHelpers from '../dist/utils/queryHelpers.js';
import { v4 as uuidv4 } from 'uuid';



/**
 * Safe JSON parsing helper
 */
const safeJsonParse = (str, defaultValue = []) => {
    if (!str || str === '' || str === 'null' || str === 'undefined') {
        return defaultValue;
    }
    try {
        const parsed = JSON.parse(str);
        return parsed || defaultValue;
    } catch (e) {
        return defaultValue;
    }
};

/**
 * Get portfolio data with roadmap information
 */
async function getPortfolioData(orgId, filters = {}) {
    const { projectId, status, priority, owner, quarter, search } = filters;
    
    let sql = `
        SELECT 
            i.*,
            ri.planned_start_date as roadmap_start,
            ri.planned_end_date as roadmap_end,
            ri.sequence_position,
            ri.is_critical_path,
            rw.id as wave_id,
            rw.name as wave_name,
            p.name as project_name,
            ob.first_name as ob_first_name,
            ob.last_name as ob_last_name,
            ob.avatar_url as ob_avatar,
            oe.first_name as oe_first_name,
            oe.last_name as oe_last_name,
            oe.avatar_url as oe_avatar,
            (SELECT COUNT(*) FROM initiative_dependencies WHERE to_initiative_id = i.id) as dependency_count
        FROM initiatives i
        LEFT JOIN roadmap_initiatives ri ON i.id = ri.initiative_id
        LEFT JOIN roadmap_waves rw ON ri.roadmap_id IN (SELECT id FROM roadmaps WHERE project_id = i.project_id) AND rw.project_id = i.project_id
        LEFT JOIN projects p ON i.project_id = p.id
        LEFT JOIN users ob ON i.owner_business_id = ob.id
        LEFT JOIN users oe ON i.owner_execution_id = oe.id
        WHERE i.organization_id = ?
    `;
    
    const params = [orgId];
    
    if (projectId) {
        sql += ` AND i.project_id = ?`;
        params.push(projectId);
    }
    
    if (status && status.length > 0) {
        const placeholders = status.map(() => '?').join(',');
        sql += ` AND i.status IN (${placeholders})`;
        params.push(...status);
    }
    
    if (priority && priority.length > 0) {
        const placeholders = priority.map(() => '?').join(',');
        sql += ` AND i.priority IN (${placeholders})`;
        params.push(...priority);
    }
    
    if (owner) {
        sql += ` AND (i.owner_business_id = ? OR i.owner_execution_id = ?)`;
        params.push(owner, owner);
    }
    
    if (quarter) {
        sql += ` AND i.target_quarter = ?`;
        params.push(quarter);
    }
    
    if (search) {
        sql += ` AND (i.name LIKE ? OR i.summary LIKE ? OR p.name LIKE ?)`;
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
    }
    
    sql += ` ORDER BY 
        CASE i.priority 
            WHEN 'CRITICAL' THEN 1 
            WHEN 'HIGH' THEN 2 
            WHEN 'MEDIUM' THEN 3 
            WHEN 'LOW' THEN 4 
        END,
        i.created_at DESC
    `;
    
    try {
        const rows = await queryHelpers.queryAll(sql, params);
        
        return rows.map(row => ({
            id: row.id,
            name: row.name,
            summary: row.summary,
            axis: row.axis,
            status: row.status,
            priority: row.priority || 'MEDIUM',
            progress: row.progress || 0,
            budget: row.cost_capex || 0,
            expectedRoi: row.expected_roi,
            plannedStartDate: row.roadmap_start || row.planned_start_date,
            plannedEndDate: row.roadmap_end || row.planned_end_date,
            targetQuarter: row.target_quarter,
            waveId: row.wave_id,
            waveName: row.wave_name,
            projectId: row.project_id,
            projectName: row.project_name,
            ownerBusiness: row.owner_business_id ? {
                id: row.owner_business_id,
                firstName: row.ob_first_name,
                lastName: row.ob_last_name,
                avatarUrl: row.ob_avatar
            } : null,
            ownerExecution: row.owner_execution_id ? {
                id: row.owner_execution_id,
                firstName: row.oe_first_name,
                lastName: row.oe_last_name,
                avatarUrl: row.oe_avatar
            } : null,
            isCriticalPath: row.is_critical_path === 1,
            sequencePosition: row.sequence_position,
            dependencyCount: row.dependency_count || 0,
            riskScore: calculateRiskScore(row),
            valueScore: calculateValueScore(row),
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }));
    } catch (error) {
        console.error('[PortfolioService] getPortfolioData error:', error);
        throw error;
    }
}

/**
 * Calculate risk score (0-100) based on initiative attributes
 */
function calculateRiskScore(initiative) {
    let score = 50; // Base score
    
    // Higher budget = higher risk
    if (initiative.cost_capex > 500000) score += 20;
    else if (initiative.cost_capex > 200000) score += 10;
    
    // Priority affects risk perception
    if (initiative.priority === 'CRITICAL') score += 15;
    else if (initiative.priority === 'HIGH') score += 10;
    
    // Status affects risk
    if (initiative.status === 'BLOCKED') score += 25;
    else if (initiative.status === 'EXECUTING') score -= 10;
    
    // Dependencies increase risk
    if (initiative.dependency_count > 3) score += 15;
    else if (initiative.dependency_count > 0) score += 5;
    
    return Math.min(100, Math.max(0, score));
}

/**
 * Calculate value score (0-100) based on initiative attributes
 */
function calculateValueScore(initiative) {
    let score = 50; // Base score
    
    // ROI affects value
    if (initiative.expected_roi > 3) score += 30;
    else if (initiative.expected_roi > 2) score += 20;
    else if (initiative.expected_roi > 1) score += 10;
    
    // Business value assessment
    if (initiative.business_value === 'High') score += 20;
    else if (initiative.business_value === 'Medium') score += 10;
    
    // Strategic alignment (axis importance)
    if (initiative.axis === 'aiMaturity' || initiative.axis === 'dataManagement') score += 10;
    
    return Math.min(100, Math.max(0, score));
}

/**
 * Get portfolio statistics
 */
async function getPortfolioStats(orgId, projectId = null) {
    let whereClause = 'organization_id = ?';
    const params = [orgId];
    
    if (projectId) {
        whereClause += ' AND project_id = ?';
        params.push(projectId);
    }
    
    const sql = `
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'DRAFT' THEN 1 ELSE 0 END) as draft_count,
            SUM(CASE WHEN status = 'PLANNING' THEN 1 ELSE 0 END) as planning_count,
            SUM(CASE WHEN status = 'REVIEW' THEN 1 ELSE 0 END) as review_count,
            SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) as approved_count,
            SUM(CASE WHEN status = 'EXECUTING' THEN 1 ELSE 0 END) as executing_count,
            SUM(CASE WHEN status = 'DONE' THEN 1 ELSE 0 END) as done_count,
            SUM(CASE WHEN status = 'BLOCKED' THEN 1 ELSE 0 END) as blocked_count,
            SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_count,
            SUM(CASE WHEN priority = 'CRITICAL' THEN 1 ELSE 0 END) as critical_count,
            SUM(COALESCE(cost_capex, 0)) as total_budget,
            AVG(COALESCE(progress, 0)) as avg_progress
        FROM initiatives
        WHERE ${whereClause}
    `;
    
    try {
        const row = await queryHelpers.queryOne(sql, params);
        
        return {
            total: row.total || 0,
            byStatus: {
                DRAFT: row.draft_count || 0,
                PLANNING: row.planning_count || 0,
                REVIEW: row.review_count || 0,
                APPROVED: row.approved_count || 0,
                EXECUTING: row.executing_count || 0,
                DONE: row.done_count || 0,
                BLOCKED: row.blocked_count || 0,
                CANCELLED: row.cancelled_count || 0
            },
            totalBudget: row.total_budget || 0,
            averageProgress: Math.round(row.avg_progress || 0),
            criticalCount: row.critical_count || 0,
            blockedCount: row.blocked_count || 0
        };
    } catch (error) {
        console.error('[PortfolioService] getPortfolioStats error:', error);
        throw error;
    }
}

/**
 * Bulk update initiative statuses
 */
async function bulkUpdateStatus(initiativeIds, newStatus, reason, userId) {
    if (!initiativeIds || initiativeIds.length === 0) {
        throw new Error('No initiative IDs provided');
    }
    
    const placeholders = initiativeIds.map(() => '?').join(',');
    const sql = `
        UPDATE initiatives 
        SET status = ?, updated_at = datetime('now')
        WHERE id IN (${placeholders})
    `;
    
    try {
        await queryHelpers.run(sql, [newStatus, ...initiativeIds]);
        
        // Log status changes
        for (const initiativeId of initiativeIds) {
            await queryHelpers.run(`
                INSERT INTO status_history (id, initiative_id, from_status, to_status, reason, changed_by, changed_at)
                VALUES (?, ?, NULL, ?, ?, ?, datetime('now'))
            `, [uuidv4(), initiativeId, newStatus, reason || null, userId]);
        }
        
        return { updated: initiativeIds.length };
    } catch (error) {
        console.error('[PortfolioService] bulkUpdateStatus error:', error);
        throw error;
    }
}

/**
 * Quick update initiative (for inline editing)
 */
async function quickUpdate(initiativeId, updates, userId) {
    const allowedFields = ['name', 'priority', 'target_quarter', 'planned_start_date', 'planned_end_date', 'cost_capex'];
    const setClauses = [];
    const params = [];
    
    for (const [key, value] of Object.entries(updates)) {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase(); // camelCase to snake_case
        if (allowedFields.includes(dbKey)) {
            setClauses.push(`${dbKey} = ?`);
            params.push(value);
        }
    }
    
    if (setClauses.length === 0) {
        throw new Error('No valid fields to update');
    }
    
    setClauses.push('updated_at = datetime(\'now\')');
    params.push(initiativeId);
    
    const sql = `UPDATE initiatives SET ${setClauses.join(', ')} WHERE id = ?`;
    
    try {
        await queryHelpers.run(sql, params);
        return { success: true };
    } catch (error) {
        console.error('[PortfolioService] quickUpdate error:', error);
        throw error;
    }
}

/**
 * Reorder initiatives (for drag-drop)
 */
async function reorderInitiatives(initiativeIds, newOrder) {
    // This updates sequence_position in roadmap_initiatives
    try {
        for (let i = 0; i < initiativeIds.length; i++) {
            await queryHelpers.run(`
                UPDATE roadmap_initiatives 
                SET sequence_position = ?
                WHERE initiative_id = ?
            `, [i, initiativeIds[i]]);
        }
        return { success: true };
    } catch (error) {
        console.error('[PortfolioService] reorderInitiatives error:', error);
        throw error;
    }
}

/**
 * Get initiative dependencies for timeline view
 */
async function getInitiativeDependencies(orgId, projectId = null) {
    let sql = `
        SELECT 
            d.id,
            d.from_initiative_id,
            d.to_initiative_id,
            d.type,
            d.is_satisfied,
            fi.name as from_name,
            ti.name as to_name
        FROM initiative_dependencies d
        JOIN initiatives fi ON d.from_initiative_id = fi.id
        JOIN initiatives ti ON d.to_initiative_id = ti.id
        WHERE fi.organization_id = ?
    `;
    const params = [orgId];
    
    if (projectId) {
        sql += ` AND fi.project_id = ?`;
        params.push(projectId);
    }
    
    try {
        return await queryHelpers.queryAll(sql, params);
    } catch (error) {
        console.error('[PortfolioService] getInitiativeDependencies error:', error);
        throw error;
    }
}

/**
 * Get roadmap waves for timeline view
 */
async function getRoadmapWaves(projectId) {
    const sql = `
        SELECT 
            id,
            name,
            description,
            start_date,
            end_date,
            sort_order,
            status
        FROM roadmap_waves
        WHERE project_id = ?
        ORDER BY sort_order ASC
    `;
    
    try {
        return await queryHelpers.queryAll(sql, [projectId]);
    } catch (error) {
        console.error('[PortfolioService] getRoadmapWaves error:', error);
        throw error;
    }
}

export {
getPortfolioData,
    getPortfolioStats,
    bulkUpdateStatus,
    quickUpdate,
    reorderInitiatives,
    getInitiativeDependencies,
    getRoadmapWaves
};

export default {
    getPortfolioData,
    getPortfolioStats,
    bulkUpdateStatus,
    quickUpdate,
    reorderInitiatives,
    getInitiativeDependencies,
    getRoadmapWaves
};











