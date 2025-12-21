/**
 * Server Configuration
 * Centralizes environment variables and defaults
 */

module.exports = {
    // JWT Configuration
    JWT_SECRET: process.env.JWT_SECRET || 'supersecretkey_change_this_in_production',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d', // 7 days default, configurable

    // Refresh token settings (for future use)
    REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d',

    // Token cleanup interval (in milliseconds)
    TOKEN_CLEANUP_INTERVAL: parseInt(process.env.TOKEN_CLEANUP_INTERVAL) || 3600000, // 1 hour

    // Server settings
    PORT: process.env.PORT || 3005,
    NODE_ENV: process.env.NODE_ENV || 'development',

    // OAuth: Google
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3005/api/auth/google/callback',

    // OAuth: LinkedIn
    LINKEDIN_CLIENT_ID: process.env.LINKEDIN_CLIENT_ID,
    LINKEDIN_CLIENT_SECRET: process.env.LINKEDIN_CLIENT_SECRET,
    LINKEDIN_CALLBACK_URL: process.env.LINKEDIN_CALLBACK_URL || 'http://localhost:3005/api/auth/linkedin/callback',

    // Frontend URL (for OAuth redirects)
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
};
