/**
 * Password Policy Service
 * Manages password policies for organizations
 */

import db from '../database.js';
import { v4 as uuidv4 } from 'uuid';



const PasswordPolicyService = {
    /**
     * Get password policy for an organization
     */
    getPolicy: (organizationId) => {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM organization_password_policies WHERE organization_id = ?',
                [organizationId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row || null);
                }
            );
        });
    },

    /**
     * Create or update password policy
     */
    setPolicy: (organizationId, policy) => {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT id FROM organization_password_policies WHERE organization_id = ?',
                [organizationId],
                (err, existing) => {
                    if (err) return reject(err);

                    if (existing) {
                        // Update existing policy
                        db.run(
                            `UPDATE organization_password_policies SET
                             min_length = ?,
                             require_uppercase = ?,
                             require_lowercase = ?,
                             require_numbers = ?,
                             require_special_chars = ?,
                             max_age_days = ?,
                             prevent_reuse_count = ?,
                             lockout_attempts = ?,
                             lockout_duration_minutes = ?,
                             require_mfa = ?
                             WHERE organization_id = ?`,
                            [
                                policy.minLength || 8,
                                policy.requireUppercase ? 1 : 0,
                                policy.requireLowercase ? 1 : 0,
                                policy.requireNumbers ? 1 : 0,
                                policy.requireSpecialChars ? 1 : 0,
                                policy.maxAgeDays || null,
                                policy.preventReuseCount || 5,
                                policy.lockoutAttempts || 5,
                                policy.lockoutDurationMinutes || 30,
                                policy.requireMfa ? 1 : 0,
                                organizationId
                            ],
                            function (updateErr) {
                                if (updateErr) return reject(updateErr);
                                resolve({ updated: true, organizationId, ...policy });
                            }
                        );
                    } else {
                        // Create new policy
                        const id = uuidv4();
                        db.run(
                            `INSERT INTO organization_password_policies 
                             (id, organization_id, min_length, require_uppercase, require_lowercase,
                              require_numbers, require_special_chars, max_age_days, prevent_reuse_count,
                              lockout_attempts, lockout_duration_minutes, require_mfa)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [
                                id, organizationId,
                                policy.minLength || 8,
                                policy.requireUppercase ? 1 : 0,
                                policy.requireLowercase ? 1 : 0,
                                policy.requireNumbers ? 1 : 0,
                                policy.requireSpecialChars ? 1 : 0,
                                policy.maxAgeDays || null,
                                policy.preventReuseCount || 5,
                                policy.lockoutAttempts || 5,
                                policy.lockoutDurationMinutes || 30,
                                policy.requireMfa ? 1 : 0
                            ],
                            function (insertErr) {
                                if (insertErr) return reject(insertErr);
                                resolve({ id, organizationId, ...policy });
                            }
                        );
                    }
                }
            );
        });
    },

    /**
     * Validate password against policy
     */
    validatePassword: async (organizationId, password) => {
        const policy = await this.getPolicy(organizationId);
        if (!policy) return { valid: true }; // No policy = allow

        const errors = [];

        if (password.length < policy.min_length) {
            errors.push(`Password must be at least ${policy.min_length} characters`);
        }
        if (policy.require_uppercase && !/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }
        if (policy.require_lowercase && !/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }
        if (policy.require_numbers && !/[0-9]/.test(password)) {
            errors.push('Password must contain at least one number');
        }
        if (policy.require_special_chars && !/[^A-Za-z0-9]/.test(password)) {
            errors.push('Password must contain at least one special character');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
};

export default PasswordPolicyService;






