# CI/CD Pipeline Documentation

## Overview

The monorepo uses a comprehensive CI/CD pipeline that supports:
- **Multiple Applications**: consultify and new-app
- **Shared Modules**: packages/shared
- **Efficient Builds**: Nx affected for incremental builds
- **Zero-Downtime Deployments**: Blue-green and canary strategies

## Pipeline Structure

### 1. Monorepo CI Pipeline (`.github/workflows/monorepo-ci.yml`)

#### Stage 0: Detect Changes
- Uses Nx affected to detect which projects changed
- Only builds/test what's necessary
- Supports manual triggers for specific apps

#### Stage 1: Shared Modules Pipeline
- Builds `packages/shared` first
- Runs tests for shared code
- Publishes to npm if version changed (on main branch with `[release]` commit)

#### Stage 2: Consultify App Pipeline
- **Lint & Type Check**: ESLint and TypeScript validation
- **Tests**: Matrix strategy for unit/integration/e2e tests
- **Build**: Frontend and backend builds

#### Stage 3: New-App Pipeline
- Same structure as Consultify
- Independent testing and building

#### Stage 4: Summary
- Generates summary of all pipeline results

### 2. Blue-Green Deployment (`.github/workflows/blue-green-deploy.yml`)

#### Deployment Strategies

**Blue-Green Deployment**
1. Deploy to inactive environment (green if blue is active)
2. Wait for health checks
3. Run smoke tests
4. Switch traffic to new environment
5. Monitor for 5 minutes
6. Rollback on failure

**Canary Deployment**
1. Deploy to canary environment (10% traffic)
2. Monitor metrics for 15 minutes
3. Promote to 100% if healthy

**Immediate Deployment**
- Direct deployment without staging

## Usage

### Triggering CI Pipeline

**Automatic Triggers:**
- Push to `main`, `develop`, or `staging` branches
- Pull requests to `main` or `develop`

**Manual Trigger:**
```bash
# Via GitHub Actions UI:
# - Go to Actions tab
# - Select "Monorepo CI/CD"
# - Click "Run workflow"
# - Choose app: all, consultify, or new-app
```

### Triggering Deployment

**Manual Deployment:**
```bash
# Via GitHub Actions UI:
# - Go to Actions tab
# - Select "Blue-Green Deployment"
# - Click "Run workflow"
# - Choose:
#   - App: consultify or new-app
#   - Environment: staging or production
#   - Strategy: blue-green, canary, or immediate
```

## Environment Variables

### Required Secrets

**Railway Tokens:**
- `RAILWAY_STAGING_TOKEN` - For staging deployments
- `RAILWAY_PRODUCTION_TOKEN` - For production deployments

**Sentry:**
- `STAGING_SENTRY_DSN` - Sentry DSN for staging
- `PRODUCTION_SENTRY_DSN` - Sentry DSN for production

**NPM:**
- `NPM_TOKEN` - For publishing shared packages

### Required Variables

**API URLs:**
- `STAGING_API_URL` - Staging API endpoint
- `PRODUCTION_API_URL` - Production API endpoint

## Nx Affected Detection

The pipeline uses Nx to detect which projects are affected by changes:

```bash
# Only changed projects are built/tested
nx show projects --affected --base=origin/main --head=HEAD
```

**Benefits:**
- Faster CI runs (only test what changed)
- Reduced resource usage
- Parallel execution of independent projects

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

### Blue-Green Deployment Flow

```
1. Build Application
   ↓
2. Deploy to Green Environment
   ↓
3. Health Check (30 retries, 10s interval)
   ↓
4. Smoke Tests
   ↓
5. Switch Traffic to Green
   ↓
6. Monitor (5 minutes)
   ↓
7. Success or Rollback
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
feat(consultify): Add new feature
fix(new-app): Fix critical bug
```

### Branch Strategy

- `main` - Production-ready code
- `develop` - Integration branch
- `staging/*` - Staging deployments
- Feature branches - Development

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
nx build consultify
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








