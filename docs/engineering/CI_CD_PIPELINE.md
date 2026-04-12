# CI/CD Pipeline Documentation

> This document reflects the active GitHub Actions and Railway deployment model as of 2026-04-12.
> Deprecated references to `monorepo-ci.yml` and `blue-green-deploy.yml` have been replaced by the
> current workflow set.

## Overview

The active CI/CD model uses:

- `test-suite.yml` as the quality gate on `main` and `develop`
- `railway-deploy.yml` as the deployment workflow
- `develop` as the staging deployment branch
- `main` as the production deployment branch

## Pipeline Structure

### 1. Quality Gate (`.github/workflows/test-suite.yml`)

The active quality gate runs:

- lint and type-check
- unit, integration, component, performance, security, and E2E layers
- coverage and patch-coverage gates
- summary reporting

### 2. Railway Deployment (`.github/workflows/railway-deploy.yml`)

Deployment policy:

- push to `develop` triggers staging deploy
- manual dispatch is required for production deploy
- backend and frontend are deployed to their dedicated Railway services
- post-deploy health verification runs against configured URLs

## Usage

### Triggering CI Pipeline

**Automatic Triggers:**

- Push to `main`, `develop`, or `Londyn` branches for quality checks
- Pull requests to `main` or `develop`

**Manual Trigger:**

```bash
# Via GitHub Actions UI:
# - Go to Actions tab
# - Select "Monorepo CI/CD"
# - Click "Run workflow"
# - Choose app: all, consultinity, or new-app
```

### Triggering Deployment

**Staging deployment:**

```bash
git push origin develop
```

**Production deployment:**

```bash
# Merge approved release PR into main, then:
# GitHub Actions -> Railway Deploy -> environment=production
```

## Environment Variables

### Required Secrets

**Railway Tokens:**

- `RAILWAY_STAGING_TOKEN`
- `RAILWAY_PRODUCTION_TOKEN`

**Sentry:**

- `STAGING_SENTRY_DSN` - Sentry DSN for staging
- `PRODUCTION_SENTRY_DSN` - Sentry DSN for production

**NPM:**

- `NPM_TOKEN` - For publishing shared packages

### Required Variables

**Target selection:**

- `RAILWAY_STAGING_PROJECT_ID`
- `RAILWAY_STAGING_ENVIRONMENT`
- `RAILWAY_STAGING_BACKEND_SERVICE`
- `RAILWAY_STAGING_FRONTEND_SERVICE`
- `RAILWAY_PRODUCTION_PROJECT_ID`
- `RAILWAY_PRODUCTION_ENVIRONMENT`
- `RAILWAY_PRODUCTION_BACKEND_SERVICE`
- `RAILWAY_PRODUCTION_FRONTEND_SERVICE`

**Health and verification URLs:**

- `STAGING_API_HEALTH_URL`
- `STAGING_FRONTEND_URL`
- `PRODUCTION_API_HEALTH_URL`
- `PRODUCTION_FRONTEND_URL`

## Branch Strategy

- `feature/*` -> merge to `develop`
- `develop` -> auto-deploy to staging
- `develop -> main` -> release promotion
- `main` -> manual production deployment

## Testing Strategy

### Per-App Testing

Each app runs tests in parallel using matrix strategy:

**Unit Tests:**

- Fast, isolated tests
- Mocked dependencies
- Target: <5 minutes

**Integration Tests:**

- Real services (Redis, Database)
- Limited parallelism
- Target: <15 minutes

**E2E Tests:**

- Playwright tests
- Full browser automation
- Target: <30 minutes

### Test Results

Test results are uploaded as artifacts:

- Coverage reports
- JUnit XML reports
- Playwright HTML reports

## Deployment Process

```
1. Merge feature work into develop
   ↓
2. CI passes on develop
   ↓
3. Staging deploy runs automatically
   ↓
4. Staging smoke and business validation
   ↓
5. PR develop -> main
   ↓
6. CI passes on main
   ↓
7. Manual production deploy
   ↓
8. Production verification
```

### Health Checks

The deployment process checks:

- `/api/health` - Basic health
- `/api/health/ready` - Readiness probe
- `/api/health/live` - Liveness probe

### Rollback Strategy

Automatic rollback triggers:

- Health check failures after traffic switch
- Smoke test failures
- Error rate >5% during monitoring

## Monitoring & Alerts

### Deployment Notifications

**Success:**

- GitHub Actions summary
- Optional: Slack/Discord webhook

**Failure:**

- GitHub Actions summary
- Alert notification (Slack/Discord)
- Rollback initiated

### Metrics

Post-deployment verification includes:

- E2E test execution
- Performance checks (Lighthouse)
- Error rate monitoring

## Best Practices

### Commit Messages

**For Shared Package Releases:**

```
[release] Update shared package
```

**For App Deployments:**

```
feat(consultinity): Add new feature
fix(new-app): Fix critical bug
```

## Related Documents

- `docs/operations/STAGING_PRODUCTION_OPERATING_MODEL.md`
- `docs/deployment/RAILWAY_ENV_MATRIX.md`
- `docs/operations/LOCAL_TO_STAGING_RUNBOOK.md`
- `docs/operations/STAGING_TO_PRODUCTION_RUNBOOK.md`

### Deployment Windows

**Staging:**

- Anytime (automated on push to develop)

**Production:**

- Manual trigger only
- Recommended: Business hours
- Avoid: Peak traffic times

## Troubleshooting

### Pipeline Failures

**Lint/Type Errors:**

```bash
# Fix locally first
npm run lint
npm run type-check
```

**Test Failures:**

```bash
# Run tests locally
npm run test:unit
npm run test:integration
npm run test:e2e
```

**Build Failures:**

```bash
# Check build locally
npm run build
nx build consultinity
nx build new-app
```

### Deployment Failures

**Health Check Timeout:**

- Check application logs
- Verify environment variables
- Check database/Redis connectivity

**Smoke Test Failures:**

- Review test output
- Check API endpoints manually
- Verify environment configuration

**Rollback Issues:**

- Manual rollback via deployment platform
- Check previous deployment status
- Verify traffic routing

## Future Enhancements

- [ ] Automated performance budgets
- [ ] Security scanning in pipeline
- [ ] Automated dependency updates
- [ ] Multi-region deployment support
- [ ] A/B testing integration
- [ ] Feature flag deployment
