/**
 * Environment Variables Validator
 * Validates required environment variables and their formats on application startup
 *
 * Usage: Call validateEnv() at application startup
 */

import logger from '../utils/Logger.js';
import { validateDemoPolicy } from './demoPolicy.js';

interface EnvValidationRule {
  key: string;
  required: boolean;
  validator?: (value: string) => boolean;
  errorMessage?: string;
  defaultValue?: string;
}

const validationRules: EnvValidationRule[] = [
  // Critical security
  {
    key: 'JWT_SECRET',
    required: true,
    validator: (value) => value.length >= 32,
    errorMessage: 'JWT_SECRET must be at least 32 characters long',
  },
  {
    key: 'NODE_ENV',
    required: true,
    validator: (value) => ['development', 'production', 'test', 'staging'].includes(value),
    errorMessage: 'NODE_ENV must be one of: development, production, test, staging',
  },

  // Database - PostgreSQL only
  {
    key: 'DATABASE_URL',
    required: false, // Not required when MOCK_DB=true (tests)
    validator: (value) => {
      if (!value) return true;
      if (value.startsWith('sqlite:') || value.includes('sqlite')) {
        return false;
      }
      return value.startsWith('postgresql://') || value.startsWith('postgres://');
    },
    errorMessage:
      'DATABASE_URL must be a PostgreSQL connection string (postgresql://...). SQLite is not supported.',
  },
  {
    key: 'DB_TYPE',
    required: false,
    validator: (value) => !value || value === 'postgres',
    errorMessage: 'DB_TYPE must be "postgres" (SQLite removed)',
  },

  // Redis (optional but recommended)
  {
    key: 'REDIS_URL',
    required: false,
    validator: (value) => !value || value.startsWith('redis://'),
    errorMessage: 'REDIS_URL must be a valid Redis connection string',
  },

  // AI Providers (at least one required)
  {
    key: 'GEMINI_API_KEY',
    required: false,
  },
  {
    key: 'OPENAI_API_KEY',
    required: false,
  },
  {
    key: 'ANTHROPIC_API_KEY',
    required: false,
  },
  {
    key: 'DEEPSEEK_API_KEY',
    required: false,
  },
  {
    key: 'ZHIPU_API_KEY',
    required: false,
  },
  {
    key: 'COHERE_API_KEY',
    required: false,
  },
  {
    key: 'NVIDIA_API_KEY',
    required: false,
  },
  {
    key: 'OLLAMA_ENDPOINT',
    required: false,
  },

  // Web Search (Tavily) — enables AI chat to search the internet
  {
    key: 'TAVILY_API_KEY',
    required: false,
    validator: (value) => !value || value.startsWith('tvly-'),
    errorMessage: 'TAVILY_API_KEY should start with "tvly-" (get one at https://tavily.com)',
  },

  // Application
  {
    key: 'PORT',
    required: false,
    defaultValue: '3005',
    validator: (value) => {
      const port = parseInt(value || '3005', 10);
      return port > 0 && port < 65536;
    },
    errorMessage: 'PORT must be a valid port number (1-65535)',
  },
  // Optional flags (boolean-like)
  {
    key: 'SKIP_ENV_VALIDATION',
    required: false,
    validator: (value) => !value || value === 'true' || value === 'false',
    errorMessage: 'SKIP_ENV_VALIDATION must be "true" or "false"',
  },
  {
    key: 'FRONTEND_URL',
    required: false,
    validator: (value) => !value || /^https?:\/\//.test(value),
    errorMessage: 'FRONTEND_URL must be a valid URL starting with http:// or https://',
  },
  {
    key: 'DISABLE_CONNECTION_POOL',
    required: false,
    validator: (value) => !value || value === 'true' || value === 'false',
    errorMessage: 'DISABLE_CONNECTION_POOL must be "true" or "false"',
  },
  {
    key: 'DISABLE_SCHEDULER',
    required: false,
    validator: (value) => !value || value === 'true' || value === 'false',
    errorMessage: 'DISABLE_SCHEDULER must be "true" or "false"',
  },
  {
    key: 'SKIP_STARTUP_VALIDATOR',
    required: false,
    validator: (value) => !value || value === 'true' || value === 'false',
    errorMessage: 'SKIP_STARTUP_VALIDATOR must be "true" or "false"',
  },
  {
    key: 'E2E_MODE',
    required: false,
    validator: (value) => !value || value === 'true' || value === 'false',
    errorMessage: 'E2E_MODE must be "true" or "false"',
  },
  {
    key: 'ENABLE_TEST_GATEWAY',
    required: false,
    validator: (value) => !value || value === 'true' || value === 'false',
    errorMessage: 'ENABLE_TEST_GATEWAY must be "true" or "false"',
  },
];

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate all environment variables
 */
export function validateEnv(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const rule of validationRules) {
    const value = process.env[rule.key];

    if (rule.required && !value && !rule.defaultValue) {
      errors.push(`Missing required environment variable: ${rule.key}`);
      continue;
    }

    const actualValue = value || rule.defaultValue || '';

    // Run validator if provided
    if (rule.validator && actualValue) {
      const isValid = rule.validator(actualValue);
      if (!isValid) {
        const errorMsg = rule.errorMessage || `Invalid format for ${rule.key}`;
        errors.push(`${rule.key}: ${errorMsg}`);
      }
    }
  }

  // Check that at least one AI provider is configured
  const aiProviders = [
    'GEMINI_API_KEY',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'MISTRAL_API_KEY',
    'DEEPSEEK_API_KEY',
    'ZHIPU_API_KEY',
    'COHERE_API_KEY',
    'NVIDIA_API_KEY',
  ];

  const hasAiProvider = aiProviders.some((key) => process.env[key]);
  if (!hasAiProvider) {
    warnings.push('No AI provider API key configured. AI features will not work.');
  }

  // Speech-to-text (Interview voice answers). STT works with a native OpenAI /
  // Groq Whisper key OR the Gemini/Google key that also powers Teresa's voice.
  // If none is set, voice answers still SAVE (browser transcript fallback in the
  // Interview UI), but server-side transcription is disabled — flag it loudly so
  // demo/staging can be verified without guessing.
  const openaiStt = (process.env.OPENAI_API_KEY || '').trim();
  const hasWhisperKey =
    (openaiStt.length > 0 && !openaiStt.startsWith('sk-or-') && !openaiStt.startsWith('sk-test')) ||
    !!(process.env.GROQ_API_KEY || '').trim();
  const geminiStt = (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ''
  ).trim();
  const hasSttProvider =
    hasWhisperKey || (geminiStt.length > 0 && geminiStt !== 'YOUR_GEMINI_API_KEY_HERE');
  if (!hasSttProvider) {
    warnings.push(
      'No speech-to-text provider configured. Interview voice answers will fall back to the ' +
        'browser transcript (still saved) but server transcription is OFF. ' +
        'Set one of: OPENAI_API_KEY, GROQ_API_KEY, GEMINI_API_KEY, GOOGLE_AI_API_KEY, GOOGLE_API_KEY.'
    );
  }

  // Check database configuration - PostgreSQL required when not using mock
  const useMockDb =
    process.env.NODE_ENV === 'test' &&
    (process.env.MOCK_DB === 'true' ||
      (process.env.MOCK_DB !== 'false' && !process.env.DATABASE_URL));
  const hasDatabaseUrl = !!process.env.DATABASE_URL;
  const hasDbHost = !!process.env.DB_HOST;

  if (!useMockDb && !hasDatabaseUrl && !hasDbHost) {
    errors.push(
      'DATABASE_URL or DB_HOST required (PostgreSQL only). Use MOCK_DB=true for unit tests.'
    );
  }
  if (hasDatabaseUrl && process.env.DATABASE_URL!.toLowerCase().includes('sqlite')) {
    errors.push('DATABASE_URL must be PostgreSQL (postgresql://...). SQLite is not supported.');
  }

  // Security warnings for development
  if (process.env.NODE_ENV === 'production') {
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 64) {
      warnings.push('JWT_SECRET should be at least 64 characters in production');
    }

    if (!process.env.REDIS_URL) {
      warnings.push('REDIS_URL not set. Rate limiting and caching will use in-memory fallback.');
    }
  }

  const demoPolicy = validateDemoPolicy(process.env);
  errors.push(...demoPolicy.errors);
  warnings.push(...demoPolicy.warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate and throw on startup if invalid
 */
export function validateEnvOrThrow(): void {
  const result = validateEnv();

  if (result.warnings.length > 0) {
    logger.warn('\n⚠️  Environment Variable Warnings:');
    result.warnings.forEach((w) => logger.warn(`  - ${w}`));
    logger.warn('');
  }

  if (result.errors.length > 0) {
    logger.error('\n❌ Environment Variable Validation Failed:\n');
    result.errors.forEach((e) => logger.error(`  - ${e}`));
    logger.error('\nPlease fix the above errors before starting the application.\n');
    process.exit(1);
  }

  if (result.valid) {
    logger.info('✅ Environment variables validated successfully');
  }
}

// Auto-validate on import (can be disabled for tests)
if (process.env.NODE_ENV !== 'test' && !process.env.SKIP_ENV_VALIDATION) {
  validateEnvOrThrow();
}
