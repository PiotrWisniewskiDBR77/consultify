/**
 * Server Configuration
 * Centralizes environment variables and defaults
 * 
 * ESM-compatible version
 * Uses ConfigValidator for production-safe validation
 */

import { validateConfig } from './src/config/ConfigValidator.js';

// Validate configuration (throws in production if invalid)
const validatedConfig = validateConfig();

// JWT Configuration (validated - no hardcoded defaults in production)
export const JWT_SECRET = validatedConfig.JWT_SECRET;
export const JWT_EXPIRES_IN = validatedConfig.JWT_EXPIRES_IN;
export const REFRESH_TOKEN_EXPIRES_IN = validatedConfig.REFRESH_TOKEN_EXPIRES_IN;
export const TOKEN_CLEANUP_INTERVAL = validatedConfig.TOKEN_CLEANUP_INTERVAL;

// Server settings
export const PORT = validatedConfig.PORT;
export const NODE_ENV = validatedConfig.NODE_ENV;

// OAuth: Google (validated - all or nothing)
export const GOOGLE_CLIENT_ID = validatedConfig.GOOGLE_CLIENT_ID;
export const GOOGLE_CLIENT_SECRET = validatedConfig.GOOGLE_CLIENT_SECRET;
export const GOOGLE_CALLBACK_URL = validatedConfig.GOOGLE_CALLBACK_URL || 'http://localhost:3005/api/auth/google/callback';

// OAuth: LinkedIn (validated - all or nothing)
export const LINKEDIN_CLIENT_ID = validatedConfig.LINKEDIN_CLIENT_ID;
export const LINKEDIN_CLIENT_SECRET = validatedConfig.LINKEDIN_CLIENT_SECRET;
export const LINKEDIN_CALLBACK_URL = validatedConfig.LINKEDIN_CALLBACK_URL || 'http://localhost:3005/api/auth/linkedin/callback';

// OAuth: Microsoft (Azure AD) (validated - all or nothing)
export const MICROSOFT_CLIENT_ID = validatedConfig.MICROSOFT_CLIENT_ID;
export const MICROSOFT_CLIENT_SECRET = validatedConfig.MICROSOFT_CLIENT_SECRET;
export const MICROSOFT_CALLBACK_URL = validatedConfig.MICROSOFT_CALLBACK_URL || 'http://localhost:3005/api/auth/microsoft/callback';

// Frontend URL (for OAuth redirects)
export const FRONTEND_URL = validatedConfig.FRONTEND_URL;

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
