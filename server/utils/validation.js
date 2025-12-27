/**
 * Validation Utility
 * 
 * Common validation functions used across services and routes.
 * Provides consistent validation logic and error messages.
 */

/**
 * Validate organization ID exists and user has access
 * @param {Object} db - Database instance
 * @param {string} orgId - Organization ID
 * @param {string} userId - User ID (optional, for access check)
 * @returns {Promise<{valid: boolean, error?: string, org?: Object}>}
 */
async function validateOrganization(db, orgId, userId = null) {
    if (!orgId) {
        return { valid: false, error: 'Organization ID is required' };
    }

    return new Promise((resolve) => {
        db.get('SELECT * FROM organizations WHERE id = ?', [orgId], (err, org) => {
            if (err) {
                resolve({ valid: false, error: 'Database error validating organization' });
            } else if (!org) {
                resolve({ valid: false, error: 'Organization not found' });
            } else if (org.status !== 'active') {
                resolve({ valid: false, error: 'Organization is not active' });
            } else if (userId) {
                // Check user belongs to organization
                db.get('SELECT id FROM users WHERE id = ? AND organization_id = ?', 
                    [userId, orgId], (err2, user) => {
                        if (err2 || !user) {
                            resolve({ valid: false, error: 'User does not belong to organization' });
                        } else {
                            resolve({ valid: true, org });
                        }
                    });
            } else {
                resolve({ valid: true, org });
            }
        });
    });
}

/**
 * Validate user has required role
 * @param {Object} user - User object with role property
 * @param {Array<string>} allowedRoles - Array of allowed roles
 * @returns {boolean}
 */
function validateUserRole(user, allowedRoles) {
    if (!user || !user.role) {
        return false;
    }
    return allowedRoles.includes(user.role);
}

/**
 * Validate user has access to resource (owns it or is admin)
 * @param {Object} user - User object
 * @param {string} resourceOwnerId - ID of resource owner
 * @returns {boolean}
 */
function validateResourceAccess(user, resourceOwnerId) {
    if (!user) return false;
    
    // Admins and superadmins have access to everything
    if (['ADMIN', 'SUPERADMIN'].includes(user.role)) {
        return true;
    }
    
    // User owns the resource
    return user.id === resourceOwnerId;
}

/**
 * Validate project exists and user has access
 * @param {Object} db - Database instance
 * @param {string} projectId - Project ID
 * @param {string} orgId - Organization ID
 * @returns {Promise<{valid: boolean, error?: string, project?: Object}>}
 */
async function validateProject(db, projectId, orgId) {
    if (!projectId) {
        return { valid: false, error: 'Project ID is required' };
    }

    return new Promise((resolve) => {
        db.get('SELECT * FROM projects WHERE id = ? AND organization_id = ?', 
            [projectId, orgId], (err, project) => {
                if (err) {
                    resolve({ valid: false, error: 'Database error validating project' });
                } else if (!project) {
                    resolve({ valid: false, error: 'Project not found or access denied' });
                } else {
                    resolve({ valid: true, project });
                }
            });
    });
}

/**
 * Validate initiative exists and user has access
 * @param {Object} db - Database instance
 * @param {string} initiativeId - Initiative ID
 * @param {string} orgId - Organization ID
 * @returns {Promise<{valid: boolean, error?: string, initiative?: Object}>}
 */
async function validateInitiative(db, initiativeId, orgId) {
    if (!initiativeId) {
        return { valid: false, error: 'Initiative ID is required' };
    }

    return new Promise((resolve) => {
        db.get('SELECT * FROM initiatives WHERE id = ? AND organization_id = ?', 
            [initiativeId, orgId], (err, initiative) => {
                if (err) {
                    resolve({ valid: false, error: 'Database error validating initiative' });
                } else if (!initiative) {
                    resolve({ valid: false, error: 'Initiative not found or access denied' });
                } else {
                    resolve({ valid: true, initiative });
                }
            });
    });
}

/**
 * Validate required fields in object
 * @param {Object} data - Data object to validate
 * @param {Array<string>} requiredFields - Array of required field names
 * @returns {Object} {valid: boolean, missingFields?: Array<string>}
 */
function validateRequiredFields(data, requiredFields) {
    const missingFields = requiredFields.filter(field => {
        const value = data[field];
        return value === undefined || value === null || value === '';
    });

    return {
        valid: missingFields.length === 0,
        missingFields: missingFields.length > 0 ? missingFields : undefined
    };
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean}
 */
function validateEmail(email) {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate UUID format
 * @param {string} uuid - UUID to validate
 * @returns {boolean}
 */
function validateUUID(uuid) {
    if (!uuid) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
}

/**
 * Sanitize string input (basic XSS prevention)
 * @param {string} input - Input string
 * @returns {string} Sanitized string
 */
function sanitizeString(input) {
    if (typeof input !== 'string') return input;
    return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

module.exports = {
    validateOrganization,
    validateUserRole,
    validateResourceAccess,
    validateProject,
    validateInitiative,
    validateRequiredFields,
    validateEmail,
    validateUUID,
    sanitizeString
};






