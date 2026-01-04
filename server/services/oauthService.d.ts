declare namespace _default {
    export { findOrCreateOAuthUser };
    export { createOAuthUser };
    export { generateOAuthToken };
}
export default _default;
/**
 * Find existing user by OAuth provider ID or email, or create new user
 * @param {string} provider - 'google' or 'linkedin'
 * @param {object} profile - OAuth profile data
 * @returns {Promise<{user: object, isNew: boolean}>}
 */
export function findOrCreateOAuthUser(provider: string, profile: object): Promise<{
    user: object;
    isNew: boolean;
}>;
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
export function createOAuthUser(provider: string, providerId: string, email: string, firstName: string, lastName: string, avatarUrl: string): Promise<object>;
/**
 * Generate JWT token for OAuth-authenticated user
 * @param {object} user - User object from database
 * @returns {Promise<{token: string, safeUser: object}>}
 */
export function generateOAuthToken(user: object): Promise<{
    token: string;
    safeUser: object;
}>;
//# sourceMappingURL=oauthService.d.ts.map