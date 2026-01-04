/**
 * Server Configuration
 * Centralizes environment variables and defaults
 * 
 * ESM-compatible version
 */

// JWT Configuration
export const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey_change_this_in_production';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '365d'; // 1 year for development

// Refresh token settings (for future use)
export const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '30d';

// Token cleanup interval (in milliseconds)
export const TOKEN_CLEANUP_INTERVAL = parseInt(process.env.TOKEN_CLEANUP_INTERVAL) || 3600000; // 1 hour

// Server settings
export const PORT = process.env.PORT || 3005;
export const NODE_ENV = process.env.NODE_ENV || 'development';

// OAuth: Google
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
export const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3005/api/auth/google/callback';

// OAuth: LinkedIn
export const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
export const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
export const LINKEDIN_CALLBACK_URL = process.env.LINKEDIN_CALLBACK_URL || 'http://localhost:3005/api/auth/linkedin/callback';

// OAuth: Microsoft (Azure AD)
export const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
export const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;
export const MICROSOFT_CALLBACK_URL = process.env.MICROSOFT_CALLBACK_URL || 'http://localhost:3005/api/auth/microsoft/callback';

// Frontend URL (for OAuth redirects)
export const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Default export object for backward compatibility
const config = {
    JWT_SECRET,
    JWT_EXPIRES_IN,
    REFRESH_TOKEN_EXPIRES_IN,
    TOKEN_CLEANUP_INTERVAL,
    PORT,
    NODE_ENV,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_CALLBACK_URL,
    LINKEDIN_CLIENT_ID,
    LINKEDIN_CLIENT_SECRET,
    LINKEDIN_CALLBACK_URL,
    MICROSOFT_CLIENT_ID,
    MICROSOFT_CLIENT_SECRET,
    MICROSOFT_CALLBACK_URL,
    FRONTEND_URL,
};

export default config;
