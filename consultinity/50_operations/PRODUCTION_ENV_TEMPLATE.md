# Consultify - Production Environment Configuration

## Overview

This document provides a template for the production environment configuration. Copy these values to your `.env.production` file and fill in with your actual values.

**IMPORTANT**: Never commit `.env.production` to version control.

## Required Environment Variables

### Server Configuration

```bash
NODE_ENV=production
PORT=3005
FRONTEND_URL=https://your-domain.com
TRUST_PROXY=1
```

### Database Configuration (PostgreSQL Recommended)

```bash
DB_TYPE=postgres
DATABASE_URL=postgresql://user:password@host:5432/consultify
DB_HOST=your-db-host.com
DB_PORT=5432
DB_NAME=consultify
DB_USER=consultify_user
DB_PASSWORD=your-secure-password
```

### Redis (Required for Rate Limiting & Caching)

```bash
REDIS_URL=redis://your-redis-host:6379
MOCK_REDIS=false
```

### JWT & Authentication

```bash
# Generate with: openssl rand -base64 64
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_IN=30d
```

### LLM Providers (At least one required)

```bash
# Google Gemini (recommended)
GEMINI_API_KEY=your_gemini_api_key

# OpenAI (optional)
OPENAI_API_KEY=your_openai_api_key

# Anthropic Claude (optional)
ANTHROPIC_API_KEY=your_anthropic_api_key

# Default provider
DEFAULT_LLM_PROVIDER=gemini
```

### Monitoring & Error Tracking

```bash
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
LOG_LEVEL=info
```

## Optional Environment Variables

### OAuth Providers

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=https://your-domain.com/api/auth/google/callback

# LinkedIn OAuth
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
LINKEDIN_CALLBACK_URL=https://your-domain.com/api/auth/linkedin/callback
```

### Stripe (Billing & Payments)

```bash
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

### Email (SMTP)

```bash
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_email@example.com
SMTP_PASS=your_app_password
SMTP_FROM="Consultify System" <system@consultify.com>
```

### Security

```bash
CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
SESSION_TIMEOUT=30
```

### Feature Flags

```bash
ENABLE_DEMO_MODE=false
ENABLE_MAINTENANCE_MODE=false
ENABLE_AI_FEATURES=true
ENABLE_BILLING=true
ENABLE_SSO=true
```

### File Storage

```bash
UPLOADS_DIR=./server/uploads
MAX_FILE_SIZE=10485760

# Cloud storage (optional)
# AWS_S3_BUCKET=your-bucket
# AWS_ACCESS_KEY_ID=your-access-key
# AWS_SECRET_ACCESS_KEY=your-secret-key
# AWS_REGION=eu-central-1
```

## Security Checklist

Before deploying to production, ensure:

- [ ] Strong JWT_SECRET generated with `openssl rand -base64 64`
- [ ] Database password is strong and unique
- [ ] All API keys are production keys (not test/sandbox)
- [ ] CORS_ORIGINS contains only your domains
- [ ] Sentry DSN is configured for error tracking
- [ ] Redis is configured (not MOCK_REDIS)
- [ ] HTTPS is enforced
- [ ] Rate limiting is enabled
- [ ] Logging is configured appropriately

## Deployment Platforms

### Railway

Variables are set in the Railway dashboard. The `railway.json` file contains deployment configuration.

### Docker

Pass environment variables via `-e` flags or an env file:

```bash
docker run --env-file .env.production consultify:latest
```

### Docker Compose

Use the `docker-compose.yml` with environment variables:

```bash
docker-compose --env-file .env.production up -d
```

