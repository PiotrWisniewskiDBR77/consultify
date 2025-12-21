/**
 * OAuth Service
 * Handles OAuth user creation, linking, and token generation
 */

const db = require('../database');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { v4: uuidv4 } = require('uuid');
const ActivityService = require('./activityService');

/**
 * Find existing user by OAuth provider ID or email, or create new user
 * @param {string} provider - 'google' or 'linkedin'
 * @param {object} profile - OAuth profile data
 * @returns {Promise<{user: object, isNew: boolean}>}
 */
async function findOrCreateOAuthUser(provider, profile) {
    return new Promise((resolve, reject) => {
        const providerId = profile.id;
        const email = profile.emails?.[0]?.value || profile.email;
        const firstName = profile.name?.givenName || profile.given_name || profile.firstName || '';
        const lastName = profile.name?.familyName || profile.family_name || profile.lastName || '';
        const avatarUrl = profile.photos?.[0]?.value || profile.picture || profile.profilePicture?.displayImage;

        if (!email) {
            return reject(new Error('Email not provided by OAuth provider'));
        }

        const providerIdColumn = provider === 'google' ? 'google_id' : 'linkedin_id';

        // First, try to find by OAuth provider ID
        db.get(
            `SELECT * FROM users WHERE ${providerIdColumn} = ?`,
            [providerId],
            (err, user) => {
                if (err) return reject(err);

                if (user) {
                    // User found by provider ID - return existing user
                    return resolve({ user, isNew: false });
                }

                // Try to find by email
                db.get(
                    'SELECT * FROM users WHERE email = ?',
                    [email],
                    (err, existingUser) => {
                        if (err) return reject(err);

                        if (existingUser) {
                            // User exists with same email - link OAuth provider
                            db.run(
                                `UPDATE users SET ${providerIdColumn} = ?, avatar_url = COALESCE(avatar_url, ?) WHERE id = ?`,
                                [providerId, avatarUrl, existingUser.id],
                                (err) => {
                                    if (err) return reject(err);

                                    // Return updated user
                                    db.get('SELECT * FROM users WHERE id = ?', [existingUser.id], (err, updatedUser) => {
                                        if (err) return reject(err);
                                        resolve({ user: updatedUser, isNew: false, linked: true });
                                    });
                                }
                            );
                        } else {
                            // Create new user with OAuth
                            createOAuthUser(provider, providerId, email, firstName, lastName, avatarUrl)
                                .then(newUser => resolve({ user: newUser, isNew: true }))
                                .catch(reject);
                        }
                    }
                );
            }
        );
    });
}

/**
 * Create a new user via OAuth
 * @param {string} provider - 'google' or 'linkedin'
 * @param {string} providerId - Provider-specific user ID
 * @param {string} email - User email
 * @param {string} firstName - First name
 * @param {string} lastName - Last name
 * @param {string} avatarUrl - Profile picture URL
 * @returns {Promise<object>}
 */
async function createOAuthUser(provider, providerId, email, firstName, lastName, avatarUrl) {
    return new Promise((resolve, reject) => {
        const userId = uuidv4();
        const orgId = uuidv4();
        const providerIdColumn = provider === 'google' ? 'google_id' : 'linkedin_id';

        // First create organization for the user
        const companyName = `${firstName}'s Organization`;

        db.run(
            `INSERT INTO organizations (id, name, plan, status, billing_status, organization_type, trial_started_at, trial_expires_at)
             VALUES (?, ?, 'trial', 'active', 'PENDING', 'TRIAL', datetime('now'), datetime('now', '+14 days'))`,
            [orgId, companyName],
            (err) => {
                if (err) return reject(err);

                // Create user
                db.run(
                    `INSERT INTO users (id, organization_id, email, first_name, last_name, role, status, avatar_url, auth_provider, ${providerIdColumn})
                     VALUES (?, ?, ?, ?, ?, 'ADMIN', 'active', ?, ?, ?)`,
                    [userId, orgId, email, firstName, lastName, avatarUrl, provider, providerId],
                    (err) => {
                        if (err) {
                            // Rollback org creation
                            db.run('DELETE FROM organizations WHERE id = ?', [orgId]);
                            return reject(err);
                        }

                        // Add user as organization owner
                        db.run(
                            `INSERT INTO organization_members (id, organization_id, user_id, role, status)
                             VALUES (?, ?, ?, 'OWNER', 'ACTIVE')`,
                            [uuidv4(), orgId, userId],
                            (err) => {
                                if (err) console.error('Error adding org member:', err);

                                // Return the created user
                                db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
                                    if (err) return reject(err);

                                    // Log activity
                                    ActivityService.log({
                                        organizationId: orgId,
                                        userId: userId,
                                        action: 'oauth_register',
                                        entityType: 'user',
                                        entityId: userId,
                                        entityName: `${firstName} ${lastName}`,
                                        metadata: { provider }
                                    });

                                    resolve(user);
                                });
                            }
                        );
                    }
                );
            }
        );
    });
}

/**
 * Generate JWT token for OAuth-authenticated user
 * @param {object} user - User object from database
 * @returns {Promise<{token: string, safeUser: object}>}
 */
async function generateOAuthToken(user) {
    return new Promise((resolve, reject) => {
        // Get organization details
        db.get(
            'SELECT * FROM organizations WHERE id = ?',
            [user.organization_id],
            (err, org) => {
                if (err) return reject(err);

                const jti = uuidv4();
                const token = jwt.sign(
                    {
                        id: user.id,
                        email: user.email,
                        role: user.role,
                        organizationId: user.organization_id,
                        jti: jti
                    },
                    config.JWT_SECRET,
                    { expiresIn: config.JWT_EXPIRES_IN }
                );

                const safeUser = {
                    id: user.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    role: user.role,
                    status: user.status,
                    organizationId: user.organization_id,
                    companyName: org?.name || 'Unknown',
                    avatarUrl: user.avatar_url
                };

                // Update last login
                db.run(
                    'UPDATE users SET last_login = datetime("now") WHERE id = ?',
                    [user.id]
                );

                // Log login activity
                ActivityService.log({
                    organizationId: user.organization_id,
                    userId: user.id,
                    action: 'oauth_login',
                    entityType: 'session',
                    entityId: jti,
                    entityName: 'OAuth Login',
                    metadata: { provider: user.auth_provider }
                });

                resolve({ token, safeUser });
            }
        );
    });
}

module.exports = {
    findOrCreateOAuthUser,
    createOAuthUser,
    generateOAuthToken
};
