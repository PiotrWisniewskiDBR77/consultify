# Consultify Architecture Guide

## Overview

Consultify follows a feature-based (domain-driven) architecture for both frontend and backend, enabling scalability, maintainability, and team autonomy.

## Project Structure

```
consultify/
├── src/                          # Frontend source
│   ├── components/               # UI components
│   │   ├── ui/                   # Primitive UI components (Button, Card, etc.)
│   │   ├── layout/               # Layout components (Sidebar, Header, etc.)
│   │   ├── shared/               # Shared components across domains
│   │   ├── Admin/                # Admin panel components
│   │   ├── MyWork/               # Task management components
│   │   ├── assessment/           # Assessment module components
│   │   ├── billing/              # Billing components
│   │   ├── settings/             # Settings components
│   │   └── ...                   # Other domain components
│   ├── views/                    # Page-level components
│   ├── hooks/                    # Custom React hooks
│   ├── providers/                # Context providers
│   ├── layouts/                  # Layout wrappers
│   ├── routes/                   # Route definitions
│   └── types.ts                  # Core type definitions
├── services/                     # Frontend API services
│   ├── api/                      # Domain-specific API modules
│   │   ├── baseClient.ts         # Base HTTP client
│   │   ├── auth.api.ts           # Auth API
│   │   ├── ai.api.ts             # AI API
│   │   └── ...                   # Other domain APIs
│   └── modules/                  # Service modules
├── store/                        # State management (Zustand)
│   ├── slices/                   # Store slices
│   └── useAppStore.ts            # Main store
├── types/                        # Type definitions
│   ├── domain/                   # Domain types
│   ├── api/                      # API types
│   └── ui/                       # UI types
├── hooks/                        # Shared hooks
├── contexts/                     # React contexts
├── config/                       # Configuration files
├── server/                       # Backend source
│   └── src/
│       ├── routes/               # API routes (domain-organized)
│       │   ├── ai/               # AI routes
│       │   ├── assessment/       # Assessment routes
│       │   ├── billing/          # Billing routes
│       │   ├── integrations/     # Integration routes
│       │   ├── notifications/    # Notification routes
│       │   ├── organization/     # Org routes
│       │   ├── pmo/              # PMO routes
│       │   ├── user/             # User routes
│       │   └── index.ts          # Route aggregator
│       ├── services/             # Business logic services
│       ├── controllers/          # Request handlers
│       ├── middleware/           # Express middleware
│       ├── validators/           # Request validation
│       ├── database/             # Database layer
│       └── utils/                # Utility functions
└── tests/                        # Test files

```

## Domain Modules

### Frontend Domains

| Domain | Location | Description |
|--------|----------|-------------|
| AI | `components/ai/`, `components/AIChat/` | AI chat and intelligence features |
| Assessment | `components/assessment/` | Assessment framework components |
| Admin | `components/Admin/` | Organization admin panel |
| MyWork | `components/MyWork/` | Task and workflow management |
| PMO | `components/PMO/` | Project management office |
| Settings | `components/settings/` | User and org settings |
| Billing | `components/billing/` | Billing and subscription |

### Backend Domains

| Domain | Route Prefix | Location |
|--------|--------------|----------|
| AI | `/api/ai/*` | `server/src/routes/ai/` |
| Assessment | `/api/assessment/*` | `server/src/routes/assessment/` |
| Billing | `/api/billing/*` | `server/src/routes/billing/` |
| Organization | `/api/organizations/*` | `server/src/routes/organization/` |
| PMO | `/api/pmo/*` | `server/src/routes/pmo/` |
| User | `/api/users/*` | `server/src/routes/user/` |
| Notifications | `/api/notifications/*` | `server/src/routes/notifications/` |
| Integrations | `/api/integrations/*` | `server/src/routes/integrations/` |

## Code Standards

### TypeScript

- Strict mode enabled in tsconfig.json
- Avoid `any` type - use `unknown` for catch blocks
- Define proper interfaces for all data structures
- Export types from domain-specific type files

### Components

- Keep components under 500 lines
- Extract tabs and sections to separate files
- Use custom hooks for complex logic
- Follow naming convention: `ComponentName.tsx`

### API Services

- Use `baseClient.ts` utilities for HTTP requests
- Group related endpoints in domain-specific files
- Define request/response types in `types.ts`

### State Management

- Use Zustand slices for domain state
- Keep store slices focused and small
- Use selectors for derived state

## Migration Notes

### Routes Consolidation (2026-01-05)

Routes have been reorganized from flat structure to domain-based:

```
Before: server/src/routes/ai.routes.ts (180+ flat files)
After:  server/src/routes/ai/index.ts (domain aggregator)
        server/src/routes/ai/ai-analytics.routes.ts
        server/src/routes/ai/ai-budgets.routes.ts
        ...
```

### JavaScript to TypeScript Migration

All `.js` files in `server/src/` have been migrated to TypeScript.
Legacy `.js` route files have been removed after confirming `.routes.ts` equivalents exist.

## Testing Strategy

- Unit tests: `tests/unit/`
- Component tests: `tests/components/`
- Integration tests: `tests/integration/`
- E2E tests: `e2e/`

Run tests:
```bash
npm run test:unit
npm run test:component
npm run test:integration
npm run test:e2e
```


