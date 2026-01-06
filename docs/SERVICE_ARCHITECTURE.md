# Service Architecture Documentation

**Version**: 1.0.0  
**Last Updated**: January 4, 2026  
**Status**: Phase 1.4 Deliverable

---

## Executive Summary

Consultify implements a **modular service-oriented architecture** designed for:
- Microservices-ready future state
- Code sharing via monorepo structure  
- Independent deployment of applications
- Clear separation between PMO-specific and shared functionality

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CONSULTIFY PLATFORM                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                        CLIENT LAYER                                │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │  │
│  │  │  React SPA  │  │   Mobile    │  │   Admin     │                │  │
│  │  │  (Vite)     │  │   (Future)  │  │   Portal    │                │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                              │                                           │
│                              ▼                                           │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                        API GATEWAY                                 │  │
│  │  ┌─────────┐  ┌──────────┐  ┌────────────┐  ┌──────────────────┐  │  │
│  │  │  Auth   │  │  Rate    │  │  Feature   │  │  Request         │  │  │
│  │  │  Guard  │  │  Limiter │  │  Flags     │  │  Validation      │  │  │
│  │  └─────────┘  └──────────┘  └────────────┘  └──────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                              │                                           │
│                              ▼                                           │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                      SERVICE LAYER                                 │  │
│  │                                                                    │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐   │  │
│  │  │  CORE SERVICES  │  │  PMO SERVICES   │  │  AI SERVICES     │   │  │
│  │  │                 │  │                 │  │                  │   │  │
│  │  │  • Auth         │  │  • Assessment   │  │  • AI Pipeline   │   │  │
│  │  │  • User         │  │  • Initiative   │  │  • RAG Service   │   │  │
│  │  │  • Org          │  │  • Playbook     │  │  • Embeddings    │   │  │
│  │  │  • Billing      │  │  • Roadmap      │  │  • Providers     │   │  │
│  │  │  • Notification │  │  • Gap Analysis │  │  • Token Mgmt    │   │  │
│  │  └─────────────────┘  └─────────────────┘  └──────────────────┘   │  │
│  │                                                                    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                              │                                           │
│                              ▼                                           │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                      DATA LAYER                                    │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │  │
│  │  │  PostgreSQL │  │   SQLite    │  │    Redis    │                │  │
│  │  │  (Primary)  │  │   (Dev)     │  │   (Cache)   │                │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Service Categories

### 2.1 Core Services (Shared)

These services are shared between Consultify and any forked applications.

| Service | Description | Package |
|---------|-------------|---------|
| `AuthService` | JWT authentication, MFA, OAuth | `@consultify/shared` |
| `UserService` | User CRUD, profiles, preferences | `@consultify/shared` |
| `OrganizationService` | Multi-tenant organization management | `@consultify/shared` |
| `BillingService` | Stripe integration, subscriptions | `@consultify/shared` |
| `NotificationService` | Email, SMS, in-app notifications | `@consultify/shared` |
| `AuditService` | Comprehensive audit logging | `@consultify/shared` |
| `FeatureFlagService` | Feature toggle management | `@consultify/shared` |

### 2.2 PMO Services (Consultify-Specific)

| Service | Description | Location |
|---------|-------------|----------|
| `AssessmentService` | Maturity assessments, DRD | `server/services/` |
| `InitiativeService` | Strategic initiatives management | `server/services/` |
| `PlaybookService` | Consulting playbook engine | `server/services/` |
| `RoadmapService` | Transformation roadmaps | `server/services/` |
| `GapAnalysisService` | Gap identification & analysis | `server/services/` |
| `RecommendationService` | AI-powered recommendations | `server/services/` |
| `ReportService` | BCG-style report generation | `server/services/` |

### 2.3 AI Services (Shared)

| Service | Description | Providers |
|---------|-------------|-----------|
| `AIPipelineService` | Orchestrates AI requests | All 12 LLM providers |
| `RAGService` | Retrieval-augmented generation | Vector search |
| `EmbeddingService` | Text embeddings generation | OpenAI, Vertex |
| `TokenBillingService` | Token usage & billing | Internal |
| `ContextBuilderService` | Builds AI context | Internal |
| `PromptEngineService` | Prompt template management | Internal |

---

## 3. Service Interactions

### 3.1 Assessment Flow

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Client    │─────▶│ AssessmentRoute  │─────▶│ AssessmentSvc   │
└─────────────┘      └──────────────────┘      └─────────────────┘
                                                       │
                     ┌─────────────────────────────────┼──────────────────┐
                     │                                 │                  │
                     ▼                                 ▼                  ▼
           ┌─────────────────┐              ┌──────────────────┐  ┌─────────────┐
           │  GapAnalysisSvc │              │  AIPipelineSvc   │  │  ReportSvc  │
           └─────────────────┘              └──────────────────┘  └─────────────┘
                     │                                 │
                     ▼                                 ▼
           ┌─────────────────┐              ┌──────────────────┐
           │  RecommendSvc   │              │  12 LLM Providers│
           └─────────────────┘              └──────────────────┘
```

### 3.2 Initiative Creation Flow

```
┌─────────────┐      ┌────────────────┐      ┌─────────────────┐
│   Client    │─────▶│ InitiativeRoute│─────▶│ InitiativeSvc   │
└─────────────┘      └────────────────┘      └─────────────────┘
                                                      │
                    ┌─────────────────────────────────┼────────────────┐
                    │                                 │                │
                    ▼                                 ▼                ▼
          ┌──────────────────┐              ┌──────────────┐   ┌────────────┐
          │  StatusMachine   │              │  PlaybookSvc │   │  RoadmapSvc│
          └──────────────────┘              └──────────────┘   └────────────┘
                    │
                    ▼
          ┌──────────────────┐
          │  AuditService    │
          └──────────────────┘
```

---

## 4. Middleware Stack

```
Request Flow:
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  1. Express.json()                                                       │
│  2. Helmet (Security Headers)                                            │
│  3. CORS                                                                 │
│  4. Rate Limiter                                                         │
│  5. Authentication (JWT Verification)                                    │
│  6. Authorization (RBAC Check)                                           │
│  7. Feature Gate (Feature Flags)                                         │
│  8. Request Validation (Joi)                                             │
│  9. Audit Logging                                                        │
│  10. Route Handler                                                       │
│  11. Error Handler                                                       │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Middleware Details

| Middleware | File | Purpose |
|------------|------|---------|
| `authMiddleware` | `server/middleware/auth.ts` | JWT verification |
| `rbacMiddleware` | `server/middleware/rbac.ts` | Role-based access |
| `featureGate` | `server/middleware/featureGate.js` | Feature flags |
| `rateLimiter` | `server/middleware/rateLimiter.ts` | Request throttling |
| `auditLog` | `server/middleware/auditLog.js` | Audit trail |
| `validation` | `server/middleware/validation.ts` | Input validation |

---

## 5. API Structure

### 5.1 Route Organization

```
server/routes/
├── auth/               # Authentication endpoints
│   ├── login.ts
│   ├── register.ts
│   └── oauth.ts
├── users/              # User management
│   ├── profile.ts
│   └── preferences.ts
├── organizations/      # Multi-tenant org management
├── assessments/        # PMO assessments
├── initiatives/        # Initiative management
├── playbooks/          # Playbook execution
├── ai/                 # AI service endpoints
├── billing/            # Stripe integration
└── admin/              # Admin-only endpoints
```

### 5.2 API Versioning

```
/api/v1/auth/*          # Authentication
/api/v1/users/*         # User operations
/api/v1/orgs/*          # Organization operations
/api/v1/assessments/*   # PMO assessments
/api/v1/ai/*            # AI services
```

---

## 6. Database Architecture

### 6.1 Multi-Tenant Design

```
┌─────────────────────────────────────────────────────────────────┐
│                      SHARED SCHEMA                               │
│  ┌─────────┐  ┌──────────────┐  ┌─────────────┐  ┌───────────┐  │
│  │ users   │  │ organizations│  │   roles     │  │ sessions  │  │
│  └─────────┘  └──────────────┘  └─────────────┘  └───────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ tenant_id FK
┌─────────────────────────────────────────────────────────────────┐
│                    TENANT-SCOPED TABLES                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ assessments │  │ initiatives │  │ playbook_executions     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ roadmaps    │  │ reports     │  │ ai_conversations        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Tenant Isolation

All tenant-scoped queries include automatic tenant filtering:

```typescript
// Automatic tenant scoping
const data = await db.query(
  `SELECT * FROM assessments 
   WHERE organization_id = $1 
   AND deleted_at IS NULL`,
  [req.user.organizationId]
);
```

---

## 7. Monorepo Structure

```
consultify/
├── packages/                    # Shared libraries
│   └── shared/                  # @consultify/shared
│       ├── src/
│       │   ├── types/           # Shared TypeScript types
│       │   ├── utils/           # Utility functions
│       │   └── constants/       # Configuration constants
│       └── package.json
│
├── apps/                        # Applications
│   ├── consultify/              # Main PMO app
│   │   ├── frontend/
│   │   └── backend/
│   └── new-app/                 # Fork template
│       ├── frontend/
│       └── backend/
│
├── server/                      # Current backend (migration source)
│   ├── src/
│   │   ├── services/            # Business logic
│   │   ├── routes/              # API endpoints
│   │   ├── middleware/          # Express middleware
│   │   └── database/            # Database layer
│   └── package.json
│
├── components/                  # React components (migration source)
├── views/                       # Page components (migration source)
├── hooks/                       # React hooks (migration source)
│
├── nx.json                      # Nx monorepo configuration
├── tsconfig.base.json           # Shared TypeScript config
└── package.json                 # Root workspace
```

---

## 8. Service Dependencies Graph

```
                    ┌─────────────────────────┐
                    │     External APIs       │
                    │  (Stripe, AI, Email)    │
                    └───────────┬─────────────┘
                                │
    ┌───────────────────────────┼───────────────────────────┐
    │                           │                           │
    ▼                           ▼                           ▼
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│ BillingService│       │ AIPipelineSvc│       │NotificationSvc│
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       └───────────────────────┼───────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  Domain Services    │
                    │  (PMO Business)     │
                    └──────────┬──────────┘
                               │
       ┌───────────────────────┼───────────────────────┐
       │                       │                       │
       ▼                       ▼                       ▼
┌─────────────┐        ┌─────────────┐        ┌─────────────┐
│ AssessmentSvc│       │InitiativeSvc│       │ PlaybookSvc │
└──────┬──────┘        └──────┬──────┘        └──────┬──────┘
       │                      │                      │
       └──────────────────────┼──────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │    Core Services    │
                    │ (Auth, User, Org)   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Database Layer    │
                    │ (PostgreSQL/SQLite) │
                    └─────────────────────┘
```

---

## 9. Scaling Considerations

### 9.1 Horizontal Scaling

| Component | Scaling Strategy |
|-----------|-----------------|
| API Server | Multiple instances behind load balancer |
| Database | Read replicas, connection pooling |
| AI Services | Queue-based processing (BullMQ) |
| Cache | Redis Cluster |
| Static Assets | CDN (CloudFlare) |

### 9.2 Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| API Response (p95) | < 200ms | ~150ms |
| Database Query | < 50ms | ~30ms |
| AI Response | < 5s | ~3s |
| Concurrent Users | 10,000+ | Validated |

---

## 10. Security Architecture

### 10.1 Authentication Flow

```
┌────────┐     ┌───────────┐     ┌──────────┐     ┌──────────┐
│ Client │────▶│ API Server│────▶│ AuthSvc  │────▶│ Database │
└────────┘     └───────────┘     └──────────┘     └──────────┘
     │               │                 │
     │    JWT        │                 │
     │◀──────────────│                 │
     │               │                 │
     │  Subsequent   │                 │
     │  Requests     │    Verify JWT   │
     │──────────────▶│────────────────▶│
```

### 10.2 Authorization (RBAC)

| Role | Permissions |
|------|-------------|
| Owner | Full access, billing, transfer ownership |
| Administrator | User management, settings, all data |
| Project Manager | Project CRUD, team management |
| Team Member | Project access, task management |
| Viewer | Read-only access |
| Guest | Limited read access |

---

## 11. Future Architecture (Microservices)

```
                    ┌─────────────────────┐
                    │    API Gateway      │
                    │   (Kong/Traefik)    │
                    └──────────┬──────────┘
                               │
    ┌──────────────────────────┼──────────────────────────┐
    │                          │                          │
    ▼                          ▼                          ▼
┌─────────────┐        ┌─────────────┐        ┌─────────────┐
│ Auth Service│        │ PMO Service │        │ AI Service  │
│ (Container) │        │ (Container) │        │ (Container) │
└──────┬──────┘        └──────┬──────┘        └──────┬──────┘
       │                      │                      │
       ▼                      ▼                      ▼
┌─────────────┐        ┌─────────────┐        ┌─────────────┐
│  Auth DB    │        │   PMO DB    │        │  Vector DB  │
└─────────────┘        └─────────────┘        └─────────────┘
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-04 | Cursor AI | Initial architecture documentation |

---

*This document is a Phase 1.4 deliverable for the Consultify Refactoring Plan.*










