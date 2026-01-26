/**
 * Environment Variables Validator
 * Validates required environment variables and their formats on application startup
 *
 * Usage: Call validateEnv() at application startup
 */

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

  // Database
  {
    key: 'DATABASE_URL',
    required: false, // Can use DB_TYPE + separate config
    validator: (value) => {
      if (!value) return true; // Optional if DB_TYPE is set
      return value.startsWith('postgresql://') || value.startsWith('sqlite:');
    },
    errorMessage: 'DATABASE_URL must be a valid PostgreSQL or SQLite connection string',
  },
  {
    key: 'DB_TYPE',
    required: false,
    validator: (value) => !value || ['postgres', 'sqlite'].includes(value),
    errorMessage: 'DB_TYPE must be "postgres" or "sqlite"',
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

  // Check database configuration
  const hasDatabaseUrl = !!process.env.DATABASE_URL;
  const hasDbType = !!process.env.DB_TYPE;

  if (!hasDatabaseUrl && !hasDbType) {
    errors.push('Either DATABASE_URL or DB_TYPE must be set');
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
    console.warn('\n⚠️  Environment Variable Warnings:');
    result.warnings.forEach((w) => console.warn(`  - ${w}`));
    console.warn('');
  }

  if (result.errors.length > 0) {
    console.error('\n❌ Environment Variable Validation Failed:\n');
    result.errors.forEach((e) => console.error(`  - ${e}`));
    console.error('\nPlease fix the above errors before starting the application.\n');
    process.exit(1);
  }

  if (result.valid) {
    console.log('✅ Environment variables validated successfully');
  }
}

// Auto-validate on import (can be disabled for tests)
if (process.env.NODE_ENV !== 'test' && !process.env.SKIP_ENV_VALIDATION) {
  validateEnvOrThrow();
}
