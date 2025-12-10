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
};
