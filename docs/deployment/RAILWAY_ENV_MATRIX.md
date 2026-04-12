# Railway Environment Matrix

**Status:** Canonical deployment matrix  
**Last updated:** 2026-04-12

## Purpose

This matrix defines the expected split between `staging` and `production`.

## Branch and Deployment Matrix

| Area | Staging | Production |
| --- | --- | --- |
| Source branch | `develop` | `main` |
| Deploy trigger | automatic on push to `develop` | manual workflow dispatch |
| Railway target | isolated staging target | isolated production target |
| Purpose | QA, integration, pilot rehearsal | stable customer release |

## Runtime Configuration Matrix

| Area | Staging | Production |
| --- | --- | --- |
| `NODE_ENV` | `staging` | `production` |
| Frontend domain | staging domain | production domain |
| Backend health URL | staging API health endpoint | production API health endpoint |
| Database | dedicated staging database | dedicated production database |
| DB access from laptop | public/external DB URL only | public/external DB URL only |
| JWT secret | dedicated staging secret | dedicated production secret |
| MFA key | dedicated staging key | dedicated production key |
| Stripe | test keys only | live keys only |
| Email sender | staging sender/domain | production sender/domain |
| Sentry | staging DSN | production DSN |
| Monitoring alerts | non-prod routing | production routing |

## Railway Service Expectations

For each target, configure separate backend and frontend services:

- backend service uses `Dockerfile.api`
- frontend service uses `Dockerfile.frontend`

Do not rely on the default root `railway.json` alone when wiring multiple services. Confirm the Dockerfile path in the Railway UI for each service.

## CI/CD Variables

The deploy workflow expects repository variables for target selection:

### Staging variables

- `RAILWAY_STAGING_PROJECT_ID`
- `RAILWAY_STAGING_ENVIRONMENT`
- `RAILWAY_STAGING_BACKEND_SERVICE`
- `RAILWAY_STAGING_FRONTEND_SERVICE`
- `STAGING_API_HEALTH_URL`
- `STAGING_FRONTEND_URL`

### Production variables

- `RAILWAY_PRODUCTION_PROJECT_ID`
- `RAILWAY_PRODUCTION_ENVIRONMENT`
- `RAILWAY_PRODUCTION_BACKEND_SERVICE`
- `RAILWAY_PRODUCTION_FRONTEND_SERVICE`
- `PRODUCTION_API_HEALTH_URL`
- `PRODUCTION_FRONTEND_URL`

## CI/CD Secrets

- `RAILWAY_STAGING_TOKEN`
- `RAILWAY_PRODUCTION_TOKEN`

## Local Development Rules

- use `.env.staging.local` when connecting local code to staging
- never use `*.railway.internal` from a laptop
- prefer `DATABASE_PUBLIC_URL` outside Railway
- use `DATABASE_URL` inside Railway runtime

See [RAILWAY_DB_TARGET_RULES.md](../operations/RAILWAY_DB_TARGET_RULES.md) for enforcement details.
