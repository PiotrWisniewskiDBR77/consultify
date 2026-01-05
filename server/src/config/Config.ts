/**
 * Server Configuration
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Centralizes environment variables and defaults with Zod validation
 */

import { z } from 'zod';

import logger from '../utils/Logger.js';

// ==========================================
// ZOD SCHEMAS
// ==========================================

const AppConfigSchema = z.object({
    // JWT Configuration
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters in production'),
    JWT_EXPIRES_IN: z.string().default('365d'),
    REFRESH_TOKEN_EXPIRES_IN: z.string().default('30d'),
    TOKEN_CLEANUP_INTERVAL: z.number().int().positive().default(3600000),

    // Server settings
    PORT: z.number().int().positive().max(65535).default(3005),
    NODE_ENV: z.enum(['development', 'production', 'test', 'staging']).default('development'),

    // Billing & Stripe Configuration
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    MOCK_BILLING: z.coerce.boolean().default(false),

    // OAuth: Google
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_CALLBACK_URL: z.string().url().optional(),

    // OAuth: LinkedIn
    LINKEDIN_CLIENT_ID: z.string().optional(),
    LINKEDIN_CLIENT_SECRET: z.string().optional(),
    LINKEDIN_CALLBACK_URL: z.string().url().optional(),

    // OAuth: Microsoft (Azure AD)
    MICROSOFT_CLIENT_ID: z.string().optional(),
    MICROSOFT_CLIENT_SECRET: z.string().optional(),
    MICROSOFT_CALLBACK_URL: z.string().url().optional(),

    // Frontend URL
    FRONTEND_URL: z.string().url().default('http://localhost:3000'),

    // Alerting Configuration
    SLACK_WEBHOOK_URL: z.string().url().optional(),
    DISCORD_WEBHOOK_URL: z.string().url().optional(),
    AI_ALERTING_ENABLED: z.enum(['true', 'false']).default('true'),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

// ==========================================
// CONFIGURATION LOADING
// ==========================================

/**
 * Load and validate configuration from environment variables
 */
function loadConfig(): AppConfig {
    const isProduction = process.env.NODE_ENV === 'production';
    const isTest = process.env.NODE_ENV === 'test';

    // In production, JWT_SECRET is REQUIRED - no defaults allowed
    if (isProduction && !process.env.JWT_SECRET) {
        throw new Error(
            'JWT_SECRET is required in production. Please set JWT_SECRET environment variable (minimum 32 characters).',
        );
    }

    // In production, validate JWT_SECRET length before using
    if (isProduction && process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
        throw new Error(
            `JWT_SECRET must be at least 32 characters in production. Current length: ${process.env.JWT_SECRET.length}`,
        );
    }

    const rawConfig = {
        // Use default only in development/test, never in production
        JWT_SECRET:
            process.env.JWT_SECRET ||
            (isProduction
                ? undefined
                : isTest
                    ? 'test-secret-key-for-testing-only-min-32-chars'
                    : 'supersecretkey_change_this_in_production'),
        JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '365d',
        REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d',
        TOKEN_CLEANUP_INTERVAL: parseInt(process.env.TOKEN_CLEANUP_INTERVAL || '3600000', 10),
        PORT: parseInt(process.env.PORT || '3005', 10),
        NODE_ENV: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test' | 'staging',

        // Billing Config
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
        STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
        MOCK_BILLING: process.env.MOCK_BILLING === 'true',

        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
        GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3005/api/auth/google/callback',
        LINKEDIN_CLIENT_ID: process.env.LINKEDIN_CLIENT_ID,
        LINKEDIN_CLIENT_SECRET: process.env.LINKEDIN_CLIENT_SECRET,
        LINKEDIN_CALLBACK_URL: process.env.LINKEDIN_CALLBACK_URL || 'http://localhost:3005/api/auth/linkedin/callback',
        MICROSOFT_CLIENT_ID: process.env.MICROSOFT_CLIENT_ID,
        MICROSOFT_CLIENT_SECRET: process.env.MICROSOFT_CLIENT_SECRET,
        MICROSOFT_CALLBACK_URL:
            process.env.MICROSOFT_CALLBACK_URL || 'http://localhost:3005/api/auth/microsoft/callback',
        FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
        SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL,
        DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL,
        AI_ALERTING_ENABLED: (process.env.AI_ALERTING_ENABLED || 'true') as 'true' | 'false',
    };

    // Validate configuration
    const result = AppConfigSchema.safeParse(rawConfig);

    if (!result.success) {
        logger.error('[Config] Configuration validation failed:');
        result.error.issues.forEach((issue) => {
            logger.error(`  - ${issue.path.join('.')}: ${issue.message}`);
        });

        // In production, fail fast on invalid config
        if (isProduction) {
            throw new Error(
                'Invalid application configuration. Please check your environment variables. Critical secrets must be set.',
            );
        }

        // In development/test, use defaults but warn
        logger.warn(
            '[Config] Using defaults for invalid values. Fix configuration errors before deploying to production.',
        );

        // Ensure JWT_SECRET meets minimum length for dev/test
        const devJwtSecret =
            rawConfig.JWT_SECRET && rawConfig.JWT_SECRET.length >= 32
                ? rawConfig.JWT_SECRET
                : 'supersecretkey_change_this_in_production'.repeat(2);

        return AppConfigSchema.parse({
            ...rawConfig,
            JWT_SECRET: devJwtSecret,
        });
    }

    const config = result.data;

    // Production Validation for Billing
    if (isProduction) {
        if (!config.MOCK_BILLING && !config.STRIPE_SECRET_KEY) {
            throw new Error(
                'STRIPE_SECRET_KEY is required in production. Either provide the key or set MOCK_BILLING=true to explicitly enable billing mocking.',
            );
        }
    }

    return config;
}

// ==========================================
// EXPORT
// ==========================================

export const config = loadConfig();

export default config;
