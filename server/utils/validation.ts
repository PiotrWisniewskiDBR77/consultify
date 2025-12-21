/**
 * Validation Utility
 * 
 * Common validation functions used across services and routes.
 * Provides consistent validation logic and error messages.
 */

import db from '../database';

interface Database {
    get: (sql: string, params: unknown[], callback: (err: Error | null, row: unknown) => void) => void;
}

interface ValidationResult<T = unknown> {
    valid: boolean;
    error?: string;
    org?: T;
    project?: T;
    initiative?: T;
}

interface User {
    id?: string;
    role?: string;
}

interface ValidationFieldsResult {
    valid: boolean;
    missingFields?: string[];
}

/**
 * Validate organization ID exists and user has access
 */
export async function validateOrganization(
    dbInstance: Database,
    orgId: string | null | undefined,
    userId: string | null = null
): Promise<ValidationResult> {
    if (!orgId) {
        return { valid: false, error: 'Organization ID is required' };
    }

    return new Promise((resolve) => {
        dbInstance.get('SELECT * FROM organizations WHERE id = ?', [orgId], (err: Error | null, org: unknown) => {
            if (err) {
                resolve({ valid: false, error: 'Database error validating organization' });
            } else if (!org) {
                resolve({ valid: false, error: 'Organization not found' });
            } else {
                const orgObj = org as { status?: string };
                if (orgObj.status !== 'active') {
                    resolve({ valid: false, error: 'Organization is not active' });
                } else if (userId) {
                    // Check user belongs to organization
                    dbInstance.get('SELECT id FROM users WHERE id = ? AND organization_id = ?', 
                        [userId, orgId], (err2: Error | null, user: unknown) => {
                            if (err2 || !user) {
                                resolve({ valid: false, error: 'User does not belong to organization' });
                            } else {
                                resolve({ valid: true, org });
                            }
                        });
                } else {
                    resolve({ valid: true, org });
                }
            }
        });
    });
}

/**
 * Validate user has required role
 */
export function validateUserRole(user: User | null | undefined, allowedRoles: string[]): boolean {
    if (!user || !user.role) {
        return false;
    }
    return allowedRoles.includes(user.role);
}

/**
 * Validate user has access to resource (owns it or is admin)
 */
export function validateResourceAccess(user: User | null | undefined, resourceOwnerId: string | null | undefined): boolean {
    if (!user) return false;
    
    // Admins and superadmins have access to everything
    if (user.role && ['ADMIN', 'SUPERADMIN'].includes(user.role)) {
        return true;
    }
    
    // User owns the resource
    return user.id === resourceOwnerId;
}

/**
 * Validate project exists and user has access
 */
export async function validateProject(
    dbInstance: Database,
    projectId: string | null | undefined,
    orgId: string
): Promise<ValidationResult> {
    if (!projectId) {
        return { valid: false, error: 'Project ID is required' };
    }

    return new Promise((resolve) => {
        dbInstance.get('SELECT * FROM projects WHERE id = ? AND organization_id = ?', 
            [projectId, orgId], (err: Error | null, project: unknown) => {
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
 */
export async function validateInitiative(
    dbInstance: Database,
    initiativeId: string | null | undefined,
    orgId: string
): Promise<ValidationResult> {
    if (!initiativeId) {
        return { valid: false, error: 'Initiative ID is required' };
    }

    return new Promise((resolve) => {
        dbInstance.get('SELECT * FROM initiatives WHERE id = ? AND organization_id = ?', 
            [initiativeId, orgId], (err: Error | null, initiative: unknown) => {
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
 */
export function validateRequiredFields(
    data: Record<string, unknown>,
    requiredFields: string[]
): ValidationFieldsResult {
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
 */
export function validateEmail(email: string | null | undefined): boolean {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate UUID format
 */
export function validateUUID(uuid: string | null | undefined): boolean {
    if (!uuid) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
}

/**
 * Sanitize string input (basic XSS prevention)
 */
export function sanitizeString(input: unknown): string {
    if (typeof input !== 'string') return String(input);
    return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

