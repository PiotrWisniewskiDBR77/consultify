# Consultify Architecture Map

**Document Version:** 1.0.0  
**Last Updated:** January 4, 2026  
**Status:** Phase 1 - Architectural Modernization

---

## Executive Summary

Consultify is an enterprise SaaS platform for digital transformation consulting, implementing a Meta-PMO Framework compliant with ISO 21500, PMBOK 7, and PRINCE2 standards. The architecture follows a monolithic modular design with clear separation of concerns, preparing for future microservices extraction and application fork.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CONSULTIFY PLATFORM                             │
├─────────────────────────────────────────────────────────────────────────┤
│  Frontend (React 19 + TypeScript)                                        │
│  ├── components/     (717 TSX files) - UI Components                     │
│  ├── views/          (187 TSX files) - Page Views                        │
│  ├── hooks/          (47 files)      - Custom React Hooks                │
│  ├── contexts/       (6 files)       - React Contexts                    │
│  └── store/          (13 files)      - Zustand State Management          │
├─────────────────────────────────────────────────────────────────────────┤
│  Backend (Node.js + Express 5 + TypeScript)                              │
│  ├── server/src/     (877 TS files)  - TypeScript Implementation         │
│  │   ├── services/   (418 files)     - Business Logic                    │
│  │   ├── routes/     (187 files)     - API Endpoints                     │
│  │   ├── validators/ (192 files)     - Input Validation (Joi)            │
│  │   ├── middleware/ (22 files)      - Express Middleware                │
│  │   ├── controllers/(12 files)      - Request Handlers                  │
│  │   ├── utils/      (22 files)      - Utilities                         │
│  │   ├── cron/       (9 files)       - Scheduled Jobs                    │
│  │   └── database/   (4 files)       - Database Abstraction              │
│  └── server/         (Legacy JS)     - Production Entry Point            │
├─────────────────────────────────────────────────────────────────────────┤
│  Data Layer                                                              │
│  ├── SQLite (Development/Default)                                        │
│  ├── PostgreSQL (Production)                                             │
│  └── Redis (Caching, Rate Limiting, Queues)                              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

### Backend Architecture (`server/src/`)

```
server/src/
├── config/                    # Configuration Management
│   ├── Config.ts              # Environment configuration
│   ├── DatabaseConfig.ts      # Database connection settings
│   ├── FeatureFlags.ts        # Feature flag definitions
│   ├── QueueConfig.ts         # BullMQ queue configuration
│   └── SentryConfig.ts        # Error monitoring setup
│
├── controllers/               # Request Handlers (12 files)
│   ├── AuthController.ts      # Authentication logic
│   ├── UserController.ts      # User management
│   ├── ProjectController.ts   # Project operations
│   ├── TaskController.ts      # Task management
│   ├── InitiativeController.ts# Initiative handling
│   ├── DecisionController.ts  # Decision tracking
│   ├── StageGateController.ts # Stage gate management
│   └── ...
│
├── cron/                      # Scheduled Jobs (9 files)
│   ├── Scheduler.ts           # Main scheduler orchestration
│   ├── BackupCron.ts          # Database backup jobs
│   ├── BillingCron.ts         # Billing cycle jobs
│   ├── DunningCron.ts         # Payment dunning
│   ├── TrialCron.ts           # Trial management
│   ├── HealthCheckJob.ts      # System health monitoring
│   ├── CleanupRevokedTokens.ts# Token cleanup
│   └── SnapshotMetrics.ts     # Metrics aggregation
│
├── database/                  # Database Abstraction Layer
│   ├── IDatabase.ts           # Database interface contract
│   ├── Database.ts            # Factory & singleton
│   ├── PostgresDatabase.ts    # PostgreSQL implementation
│   └── index.ts               # Exports
│
├── middleware/                # Express Middleware (22 files)
│   ├── auth.middleware.ts     # JWT authentication
│   ├── rbac.middleware.ts     # Role-based access control
│   ├── permission.middleware.ts# Permission checking
│   ├── orgContext.middleware.ts# Organization context
│   ├── quota.middleware.ts    # Usage quota enforcement
│   ├── planLimits.middleware.ts# Plan-based limits
│   ├── featureGate.middleware.ts# Feature flag gates
│   ├── validation.middleware.ts# Input validation
│   ├── errorHandler.ts        # Error handling
│   ├── auditLog.middleware.ts # Audit logging
│   ├── securityHeaders.middleware.ts
│   ├── performanceMetrics.middleware.ts
│   └── ...
│
├── routes/                    # API Routes (187 files)
│   ├── auth.routes.ts         # /api/auth/*
│   ├── users.routes.ts        # /api/users/*
│   ├── projects.routes.ts     # /api/projects/*
│   ├── tasks.routes.ts        # /api/tasks/*
│   ├── initiatives.routes.ts  # /api/initiatives/*
│   ├── billing.routes.ts      # /api/billing/*
│   ├── ai.routes.ts           # /api/ai/*
│   ├── ...                    # 180+ more route files
│   └── (Full list in Appendix A)
│
├── services/                  # Business Logic (418 files)
│   ├── ai/                    # AI Subsystem (110 files)
│   │   ├── AIPipeline.ts      # Main AI orchestration
│   │   ├── llmService.ts      # LLM provider abstraction
│   │   ├── modelRouter.ts     # Model selection logic
│   │   ├── embeddingService.ts# Vector embeddings
│   │   ├── ragService.ts      # RAG implementation
│   │   ├── circuitBreaker.ts  # Fault tolerance
│   │   ├── cacheService.ts    # Response caching
│   │   ├── healthMonitor.ts   # AI health monitoring
│   │   ├── learningSystem.ts  # Self-learning system
│   │   ├── enterpriseSecurity.ts# PII redaction
│   │   └── ...
│   │
│   ├── billing/               # Billing Subsystem (7 files)
│   │   ├── stripeService.ts
│   │   ├── invoiceService.ts
│   │   └── ...
│   │
│   ├── integrations/          # External Integrations (4 files)
│   │
│   ├── cqrs/                  # CQRS Patterns (10 files)
│   │
│   └── (287 service files)    # Core business services
│       ├── authService.ts
│       ├── userService.ts
│       ├── projectService.ts
│       ├── assessmentService.ts
│       ├── initiativeService.ts
│       ├── pmoHealthService.ts
│       └── ...
│
├── types/                     # TypeScript Types (4 files)
│   ├── ai.types.ts
│   ├── common.ts
│   ├── shared.ts
│   └── index.ts
│
├── utils/                     # Utilities (22 files)
│   ├── Logger.ts              # Winston logger
│   ├── ErrorHandler.ts        # Error handling utils
│   ├── DbPromise.ts           # Promise-based DB wrapper
│   ├── RedisClient.ts         # Redis connection
│   ├── cacheHelper.ts         # Caching utilities
│   ├── piiRedactor.ts         # PII redaction
│   └── ...
│
├── validators/                # Input Validators (192 files)
│   └── (Joi schemas for all endpoints)
│
└── index.ts                   # Application entry point
```

---

## Service Layer Architecture

### AI Services Subsystem (110 files)

The AI subsystem is the most complex part of the architecture, implementing:

```
AI Pipeline Architecture
├── Orchestration Layer
│   ├── AIPipeline.ts          # Main orchestrator
│   ├── consultingFlowEngine.ts# Workflow engine
│   └── actionExecutor.ts      # Action execution
│
├── LLM Integration Layer
│   ├── llmService.ts          # LLM abstraction (12+ providers)
│   ├── modelRouter.ts         # Intelligent model routing
│   ├── fallbackService.ts     # Provider fallback chain
│   └── circuitBreaker.ts      # Fault tolerance
│
├── Context & Memory Layer
│   ├── enhancedContextBuilder.ts
│   ├── projectMemoryStore.ts
│   ├── organizationMemoryStore.ts
│   └── conversationTracker.ts
│
├── RAG Layer
│   ├── ragService.ts          # RAG orchestration
│   ├── embeddingService.ts    # Vector embeddings
│   ├── knowledgeIndexer.ts    # Document indexing
│   └── rerankerService.ts     # Result reranking
│
├── Security Layer
│   ├── enterpriseSecurity.ts  # PII redaction, compliance
│   ├── aiGateway.ts           # Request validation
│   └── quotaService.ts        # Usage enforcement
│
└── Monitoring Layer
    ├── healthMonitor.ts       # AI health checks
    ├── metrics.ts             # Performance metrics
    ├── observability.ts       # Tracing
    └── alerting.ts            # Alert triggers
```

### LLM Provider Support

The system supports 12+ LLM providers with intelligent routing:

| Provider | Tier | Use Case |
|----------|------|----------|
| OpenAI GPT-4 | Premium | Complex reasoning |
| Anthropic Claude | Premium | Long context, analysis |
| Google Gemini | Premium | Multimodal |
| Mistral | Standard | General tasks |
| Groq | Budget | Fast inference |
| Ollama | Local | On-premise deployment |
| Qwen | Standard | Multilingual |
| DeepSeek | Budget | Cost optimization |

---

## Database Architecture

### Abstraction Layer

```typescript
// server/src/database/IDatabase.ts
interface IDatabase {
    get<T>(sql: string, params?: unknown[]): Promise<T | null>;
    all<T>(sql: string, params?: unknown[]): Promise<T[]>;
    run(sql: string, params?: unknown[]): Promise<RunResult>;
    exec(sql: string): Promise<void>;
    query<T>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
}
```

### Database Support

| Database | Environment | Features |
|----------|-------------|----------|
| SQLite | Development, Testing | Simple, file-based |
| PostgreSQL | Production | Full ACID, connection pooling |

### Migration System

- **138 SQL migration files** in `server/migrations/`
- Sequential versioning (001_*, 002_*, ...)
- Supports both SQLite and PostgreSQL syntax

### Key Tables

```
Core Entities:
├── users                    # User accounts
├── organizations            # Multi-tenant organizations
├── projects                 # Project management
├── tasks                    # Task tracking
├── initiatives              # Strategic initiatives
├── decisions                # Decision log
├── stage_gates              # Stage gate approvals

AI System:
├── ai_conversations         # Chat history
├── ai_project_memory        # Project context
├── ai_org_memory            # Organization context
├── ai_audit_logs            # AI decision audit
├── ai_feedback              # User feedback

Billing:
├── subscriptions            # Subscription records
├── invoices                 # Invoice history
├── token_usage              # AI token consumption
├── billing_events           # Billing events

Security:
├── refresh_tokens           # JWT refresh tokens
├── revoked_tokens           # Revoked token list
├── audit_logs               # System audit trail
├── mfa_secrets              # MFA configuration
```

---

## API Architecture

### Route Organization

All API routes follow RESTful conventions:

```
/api
├── /auth                    # Authentication
│   ├── POST /login
│   ├── POST /register
│   ├── POST /logout
│   ├── POST /refresh
│   └── /mfa/*
│
├── /users                   # User management
├── /organizations           # Organization management
├── /projects                # Project CRUD
├── /tasks                   # Task management
├── /initiatives             # Initiative management
├── /decisions               # Decision tracking
├── /stage-gates             # Stage gate management
│
├── /ai                      # AI endpoints
│   ├── POST /chat           # Main chat endpoint
│   ├── POST /stream         # Streaming responses
│   ├── /actions/*           # AI action execution
│   ├── /memory/*            # Memory management
│   └── /learning/*          # Learning system
│
├── /billing                 # Billing operations
├── /analytics               # Analytics data
├── /reports                 # Report generation
└── /admin-*                 # Admin endpoints
```

### Middleware Stack

Request processing order:
1. `helmet` - Security headers
2. `compression` - Response compression
3. `cors` - CORS handling
4. `express.json` - Body parsing
5. `correlationMiddleware` - Request tracking
6. `rateLimit` - Rate limiting
7. `auditLogMiddleware` - Audit logging
8. `authMiddleware` - JWT validation (on protected routes)
9. `rbacMiddleware` - Role checking (where required)
10. Route handler
11. `errorHandlerMiddleware` - Error handling

---

## Security Architecture

### Authentication Flow

```
┌─────────┐    ┌──────────┐    ┌───────────┐    ┌──────────┐
│ Client  │───▶│ Auth API │───▶│ JWT Sign  │───▶│ Response │
└─────────┘    └──────────┘    └───────────┘    └──────────┘
                    │
                    ▼
              ┌──────────┐
              │ MFA Check│
              └──────────┘
```

### Security Features

| Feature | Implementation |
|---------|----------------|
| Authentication | JWT with refresh tokens |
| MFA | TOTP (speakeasy) |
| Password Hashing | bcrypt (cost factor 10) |
| Rate Limiting | Redis-backed with express-rate-limit |
| Security Headers | Helmet.js (OWASP compliant) |
| Input Validation | Joi schemas |
| SQL Injection | Parameterized queries |
| XSS Prevention | DOMPurify |
| CSRF Protection | SameSite cookies |
| Audit Logging | All state-changing operations |

---

## Cron Job Architecture

The scheduler manages 17 recurring jobs:

| Job | Schedule | Purpose |
|-----|----------|---------|
| Retention Cleanup | Daily 3:00 AM | Data retention policy |
| Storage Reconciliation | Weekly Sun 4:00 AM | Storage audit |
| Trial Tasks | Daily 2:30 AM | Trial/demo management |
| Metrics Snapshot | Daily 2:45 AM | Metrics aggregation |
| SLA Check | Every 10 min | SLA monitoring & escalation |
| AI Budget Reset | Monthly 1st | Reset AI usage budgets |
| Scheduled Reports | Hourly | Report generation |
| Email Processing | Every 15 min | Send scheduled emails |
| AI Pattern Extraction | Every 6 hours | Learning system |
| AI Consolidation | Daily 4:30 AM | Learning consolidation |
| AI Cleanup | Weekly Mon 5:00 AM | Memory cleanup |
| Token Cleanup | Daily | Remove expired tokens |
| Backup | Configurable | Database backups |

---

## Frontend Architecture

### Component Structure

```
components/
├── common/                  # Shared components
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Modal.tsx
│   └── ...
│
├── admin/                   # Admin panel components
├── assessment/              # Assessment module
├── initiatives/             # Initiative management
├── projects/                # Project views
├── tasks/                   # Task management
├── ai/                      # AI chat interface
├── reports/                 # Reporting components
└── ...
```

### State Management

- **Zustand** for global state
- **React Query** patterns for server state
- **React Context** for feature-specific state

---

## Entry Points

### Current State (Dual Entry)

| Entry Point | Environment | Technology |
|-------------|-------------|------------|
| `server/index.cjs` | Production | CommonJS |
| `server/src/index.ts` | Development | TypeScript ES Modules |

### Target State (Post-Migration)

| Entry Point | Environment | Technology |
|-------------|-------------|------------|
| `server/dist/index.js` | All | Compiled TypeScript |

---

## Dependencies Overview

### Core Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| express | 5.2.1 | Web framework |
| react | 19.2.1 | Frontend framework |
| typescript | 5.8.2 | Type system |
| pg | 8.16.3 | PostgreSQL client |
| redis | 5.10.0 | Redis client |
| bullmq | 5.65.1 | Job queue |
| jsonwebtoken | 9.0.3 | JWT handling |
| bcrypt | 6.0.0 | Password hashing |
| zod | 4.1.13 | Runtime validation |
| winston | 3.19.0 | Logging |

### AI SDK Dependencies

| Package | Purpose |
|---------|---------|
| @ai-sdk/openai | OpenAI integration |
| @ai-sdk/anthropic | Anthropic Claude |
| @ai-sdk/google | Google Gemini |
| @ai-sdk/mistral | Mistral AI |
| openai | Direct OpenAI SDK |
| @google/generative-ai | Google AI SDK |

---

## Appendix A: Complete Route List

<details>
<summary>All 187 Route Files</summary>

```
auth.routes.ts, users.routes.ts, projects.routes.ts, tasks.routes.ts,
initiatives.routes.ts, decisions.routes.ts, stage-gates.routes.ts,
billing.routes.ts, ai.routes.ts, ai-analytics.routes.ts, ai-feedback.routes.ts,
ai-memory.routes.ts, ai-settings.routes.ts, analytics.routes.ts,
assessment.routes.ts, audit.routes.ts, backup.routes.ts, branding.routes.ts,
budgets.routes.ts, capacity.routes.ts, connectors.routes.ts, content.routes.ts,
conversations.routes.ts, daily-brief.routes.ts, demo.routes.ts,
documents.routes.ts, economics.routes.ts, execution.routes.ts,
feedback.routes.ts, featureFlags.routes.ts, gamification.routes.ts,
gdpr.routes.ts, governance.routes.ts, help.routes.ts, initiatives.routes.ts,
integrations.routes.ts, invitations.routes.ts, knowledge.routes.ts,
legal.routes.ts, llm.routes.ts, mcp.routes.ts, metrics.routes.ts,
mfa.routes.ts, notifications.routes.ts, organizations.routes.ts,
pmo.routes.ts, pricing.routes.ts, reports.routes.ts, roadmap.routes.ts,
scenarios.routes.ts, security.routes.ts, sessions.routes.ts,
settings.routes.ts, sso.routes.ts, stabilization.routes.ts,
status.routes.ts, superadmin.routes.ts, systemHealth.routes.ts,
teams.routes.ts, trial.routes.ts, voice.routes.ts, webhooks.routes.ts,
workqueue.routes.ts, workstreams.routes.ts, ...
```

</details>

---

## Appendix B: Service Categories

<details>
<summary>Service Organization by Domain</summary>

**Authentication & Authorization (15 services)**
- authService, mfaService, oauthService, ssoService, refreshTokenService,
  rbacService, permissionService, accessPolicyService, accessCodeService...

**User & Organization (12 services)**
- userService, organizationService, userPreferencesService, userSessionService,
  userProfileExtendedService, organizationHealthService...

**Project Management (18 services)**
- projectService, taskService, initiativeService, stageGateService,
  decisionService, roadmapService, capacityService, progressService...

**AI & Intelligence (110 services)**
- aiPipeline, llmService, ragService, embeddingService, memoryManager,
  learningSystem, healthMonitor, circuitBreaker...

**Billing & Payments (12 services)**
- billingService, invoiceService, subscriptionService, tokenBillingService,
  stripeService, payAsYouGoService, promoCodeService...

**Reporting & Analytics (15 services)**
- reportService, analyticsService, metricsService, dashboardBuilderService,
  managementReportsService, pmoHealthService...

**Integration & External (10 services)**
- integrationService, webhookService, slackService, emailService,
  smsService, calendarIntegrationService...

</details>

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-04 | AI Assistant | Initial architecture documentation |

---

*This document is part of the Phase 1 Architectural Modernization deliverables.*

