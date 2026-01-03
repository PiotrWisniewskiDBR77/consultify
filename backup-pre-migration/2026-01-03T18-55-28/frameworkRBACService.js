/**
 * Framework RBAC Service
 * 
 * Role-Based Access Control for multi-framework assessments.
 * Defines framework-specific roles and permissions.
 */

// ============================================
// ROLE DEFINITIONS
// ============================================

const FRAMEWORK_ROLES = {
    // SIRI Roles
    SIRI_ASSESSOR: {
        id: 'SIRI_ASSESSOR',
        name: 'SIRI Assessor',
        description: 'Can conduct and edit SIRI assessments',
        framework: 'SIRI',
        permissions: ['siri:create', 'siri:edit', 'siri:view', 'siri:submit'],
    },
    SIRI_REVIEWER: {
        id: 'SIRI_REVIEWER',
        name: 'SIRI Reviewer',
        description: 'Can review SIRI assessments',
        framework: 'SIRI',
        permissions: ['siri:view', 'siri:review', 'siri:comment'],
    },
    SIRI_CERTIFIED: {
        id: 'SIRI_CERTIFIED',
        name: 'SIRI Certified Assessor',
        description: 'Certified by Singapore EDB/TÜV SÜD for official SIRI assessments',
        framework: 'SIRI',
        permissions: ['siri:create', 'siri:edit', 'siri:view', 'siri:submit', 'siri:approve', 'siri:certify'],
    },
    
    // ADMA Roles
    ADMA_ASSESSOR: {
        id: 'ADMA_ASSESSOR',
        name: 'ADMA Assessor',
        description: 'Can conduct and edit ADMA assessments',
        framework: 'ADMA',
        permissions: ['adma:create', 'adma:edit', 'adma:view', 'adma:submit'],
    },
    ADMA_REVIEWER: {
        id: 'ADMA_REVIEWER',
        name: 'ADMA Reviewer',
        description: 'Can review ADMA assessments',
        framework: 'ADMA',
        permissions: ['adma:view', 'adma:review', 'adma:comment'],
    },
    ADMA_DIH_CERTIFIED: {
        id: 'ADMA_DIH_CERTIFIED',
        name: 'ADMA DIH Certified',
        description: 'Digital Innovation Hub certified assessor for official ADMA assessments',
        framework: 'ADMA',
        permissions: ['adma:create', 'adma:edit', 'adma:view', 'adma:submit', 'adma:approve', 'adma:certify'],
    },
    
    // CMMI Roles
    CMMI_ASSESSOR: {
        id: 'CMMI_ASSESSOR',
        name: 'CMMI Assessor',
        description: 'Can conduct CMMI assessments',
        framework: 'CMMI',
        permissions: ['cmmi:create', 'cmmi:edit', 'cmmi:view', 'cmmi:submit'],
    },
    CMMI_REVIEWER: {
        id: 'CMMI_REVIEWER',
        name: 'CMMI Reviewer',
        description: 'Can review CMMI assessments',
        framework: 'CMMI',
        permissions: ['cmmi:view', 'cmmi:review', 'cmmi:comment'],
    },
    CMMI_LEAD_APPRAISER: {
        id: 'CMMI_LEAD_APPRAISER',
        name: 'CMMI Lead Appraiser',
        description: 'ISACA certified Lead Appraiser for official CMMI appraisals',
        framework: 'CMMI',
        permissions: ['cmmi:create', 'cmmi:edit', 'cmmi:view', 'cmmi:submit', 'cmmi:approve', 'cmmi:certify', 'cmmi:lead'],
    },
    
    // Lean 4.0 / DBR77 Roles
    LEAN_CONSULTANT: {
        id: 'LEAN_CONSULTANT',
        name: 'Lean 4.0 Consultant',
        description: 'Can conduct Lean 4.0 assessments using DBR77 methodology',
        framework: 'LEAN',
        permissions: ['lean:create', 'lean:edit', 'lean:view', 'lean:submit'],
    },
    LEAN_REVIEWER: {
        id: 'LEAN_REVIEWER',
        name: 'Lean 4.0 Reviewer',
        description: 'Can review Lean 4.0 assessments',
        framework: 'LEAN',
        permissions: ['lean:view', 'lean:review', 'lean:comment'],
    },
    LEAN_MASTER: {
        id: 'LEAN_MASTER',
        name: 'Lean 4.0 Master',
        description: 'Senior consultant with approval rights',
        framework: 'LEAN',
        permissions: ['lean:create', 'lean:edit', 'lean:view', 'lean:submit', 'lean:approve'],
    },
    
    // Cross-framework roles
    MULTI_FRAMEWORK_ADMIN: {
        id: 'MULTI_FRAMEWORK_ADMIN',
        name: 'Multi-Framework Administrator',
        description: 'Full access to all framework assessments',
        framework: '*',
        permissions: ['*:*'],
    },
};

// Permission requirements for specific actions
const ACTION_PERMISSIONS = {
    'create': ['create'],
    'edit': ['edit'],
    'view': ['view'],
    'delete': ['edit', 'delete'],
    'submit': ['submit'],
    'review': ['review'],
    'approve': ['approve'],
    'reject': ['approve'],
    'certify': ['certify'],
    'export': ['view'],
    'generate_report': ['view', 'report'],
    'generate_initiatives': ['view', 'initiatives'],
};

// ============================================
// SERVICE CLASS
// ============================================

class FrameworkRBACService {
    /**
     * Check if user has permission for action on framework
     * @param {string} userId - User ID
     * @param {string} framework - Framework (SIRI, ADMA, CMMI, LEAN)
     * @param {string} action - Action to perform
     * @param {Object} context - Additional context (organizationId, projectId)
     * @returns {Promise<boolean>} Has permission
     */
    static async hasPermission(userId, framework, action, context = {}) {
        const db = require('../database');
        
        // Get user roles
        const userRoles = await this.getUserRoles(userId);
        
        // Check for admin role
        if (userRoles.includes('MULTI_FRAMEWORK_ADMIN') || userRoles.includes('ADMIN')) {
            return true;
        }
        
        // Get required permissions for action
        const requiredPerms = ACTION_PERMISSIONS[action] || [action];
        const frameworkPrefix = framework.toLowerCase();
        
        // Check each user role
        for (const roleId of userRoles) {
            const role = FRAMEWORK_ROLES[roleId];
            if (!role) continue;
            
            // Check if role applies to this framework
            if (role.framework !== '*' && role.framework !== framework) {
                continue;
            }
            
            // Check permissions
            for (const requiredPerm of requiredPerms) {
                const fullPerm = `${frameworkPrefix}:${requiredPerm}`;
                const wildcardPerm = `${frameworkPrefix}:*`;
                const globalWildcard = '*:*';
                
                if (
                    role.permissions.includes(fullPerm) ||
                    role.permissions.includes(wildcardPerm) ||
                    role.permissions.includes(globalWildcard)
                ) {
                    return true;
                }
            }
        }
        
        return false;
    }

    /**
     * Get user's framework roles
     * @param {string} userId - User ID
     * @returns {Promise<Array>} Role IDs
     */
    static async getUserRoles(userId) {
        const db = require('../database');
        
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT role_id FROM user_framework_roles WHERE user_id = ?
                UNION
                SELECT role FROM users WHERE id = ?
            `;
            
            db.all(sql, [userId, userId], (err, rows) => {
                if (err) return reject(err);
                const roles = rows.map(r => r.role_id || r.role).filter(Boolean);
                resolve(roles);
            });
        });
    }

    /**
     * Assign framework role to user
     * @param {string} userId - User ID
     * @param {string} roleId - Role ID
     * @param {string} assignedBy - Assigning user ID
     * @returns {Promise<void>}
     */
    static async assignRole(userId, roleId, assignedBy) {
        const db = require('../database');
        const { v4: uuidv4 } = require('uuid');
        
        if (!FRAMEWORK_ROLES[roleId]) {
            throw new Error(`Invalid role: ${roleId}`);
        }
        
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT OR REPLACE INTO user_framework_roles (
                    id, user_id, role_id, assigned_by, assigned_at
                ) VALUES (?, ?, ?, ?, datetime('now'))
            `;
            
            db.run(sql, [uuidv4(), userId, roleId, assignedBy], (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    /**
     * Remove framework role from user
     * @param {string} userId - User ID
     * @param {string} roleId - Role ID
     * @returns {Promise<void>}
     */
    static async removeRole(userId, roleId) {
        const db = require('../database');
        
        return new Promise((resolve, reject) => {
            const sql = `DELETE FROM user_framework_roles WHERE user_id = ? AND role_id = ?`;
            
            db.run(sql, [userId, roleId], (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    /**
     * Get available roles for a framework
     * @param {string} framework - Framework ID
     * @returns {Array} Available roles
     */
    static getFrameworkRoles(framework) {
        return Object.values(FRAMEWORK_ROLES).filter(
            role => role.framework === framework || role.framework === '*'
        );
    }

    /**
     * Get all framework roles
     * @returns {Object} All roles
     */
    static getAllRoles() {
        return FRAMEWORK_ROLES;
    }

    /**
     * Check if user can approve framework assessment
     * @param {string} userId - User ID
     * @param {string} framework - Framework
     * @returns {Promise<boolean>}
     */
    static async canApprove(userId, framework) {
        return this.hasPermission(userId, framework, 'approve');
    }

    /**
     * Check if user can certify framework assessment (for official certifications)
     * @param {string} userId - User ID
     * @param {string} framework - Framework
     * @returns {Promise<boolean>}
     */
    static async canCertify(userId, framework) {
        return this.hasPermission(userId, framework, 'certify');
    }

    /**
     * Get users who can approve a specific framework
     * @param {string} framework - Framework
     * @param {string} organizationId - Organization ID
     * @returns {Promise<Array>} Users with approval rights
     */
    static async getApprovers(framework, organizationId) {
        const db = require('../database');
        
        const approverRoles = Object.entries(FRAMEWORK_ROLES)
            .filter(([, role]) => 
                (role.framework === framework || role.framework === '*') &&
                role.permissions.some(p => p.includes('approve'))
            )
            .map(([id]) => id);
        
        return new Promise((resolve, reject) => {
            const placeholders = approverRoles.map(() => '?').join(',');
            const sql = `
                SELECT DISTINCT u.id, u.first_name, u.last_name, u.email, ufr.role_id
                FROM users u
                JOIN user_framework_roles ufr ON u.id = ufr.user_id
                WHERE ufr.role_id IN (${placeholders})
                AND u.organization_id = ?
            `;
            
            db.all(sql, [...approverRoles, organizationId], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }

    /**
     * Validate workflow transition based on user role
     * @param {string} userId - User ID
     * @param {string} framework - Framework
     * @param {string} fromStatus - Current status
     * @param {string} toStatus - Target status
     * @returns {Promise<{allowed: boolean, reason: string}>}
     */
    static async validateWorkflowTransition(userId, framework, fromStatus, toStatus) {
        // Status transition rules
        const transitions = {
            'DRAFT': ['IN_REVIEW'],
            'IN_REVIEW': ['AWAITING_APPROVAL', 'DRAFT'],
            'AWAITING_APPROVAL': ['APPROVED', 'REJECTED'],
            'REJECTED': ['DRAFT'],
            'APPROVED': ['ARCHIVED'],
        };

        // Check if transition is valid
        const allowedTransitions = transitions[fromStatus] || [];
        if (!allowedTransitions.includes(toStatus)) {
            return {
                allowed: false,
                reason: `Transition from ${fromStatus} to ${toStatus} is not allowed`,
            };
        }

        // Check user permission for the transition
        let requiredAction;
        if (toStatus === 'IN_REVIEW') requiredAction = 'submit';
        else if (toStatus === 'APPROVED') requiredAction = 'approve';
        else if (toStatus === 'REJECTED') requiredAction = 'approve';
        else requiredAction = 'edit';

        const hasPermission = await this.hasPermission(userId, framework, requiredAction);
        
        if (!hasPermission) {
            return {
                allowed: false,
                reason: `User does not have permission to ${requiredAction} ${framework} assessments`,
            };
        }

        // Special check for CMMI approval - requires Lead Appraiser
        if (framework === 'CMMI' && toStatus === 'APPROVED') {
            const userRoles = await this.getUserRoles(userId);
            if (!userRoles.includes('CMMI_LEAD_APPRAISER') && !userRoles.includes('MULTI_FRAMEWORK_ADMIN')) {
                return {
                    allowed: false,
                    reason: 'CMMI approval requires a certified Lead Appraiser',
                };
            }
        }

        return { allowed: true, reason: '' };
    }
}

module.exports = {
    FrameworkRBACService,
    FRAMEWORK_ROLES,
    ACTION_PERMISSIONS,
};







