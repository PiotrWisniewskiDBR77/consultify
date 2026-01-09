# Architecture Map - Consultinity
**Date**: 2026-01-03  
**Phase**: 0 - Audit and Assessment  
**Purpose**: System architecture documentation for fork planning

---

## System Overview

**Architecture Style**: Monolithic Full-Stack Application  
**Target**: Microservices-Ready Modular Architecture  
**Deployment**: Single application (preparing for fork)

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                         │
│  React + TypeScript + Zustand + TailwindCSS           │
└────────────────┬────────────────────────────────────────┘
                 │ HTTP/REST
┌────────────────┴────────────────────────────────────────┐
│                   API GATEWAY                           │
│  Express.js + Middleware (Auth, RBAC, Rate Limit)     │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────┴────────────────────────────────────────┐
│                 SERVICE LAYER                           │
│  Business Logic + AI Orchestration + Integrations      │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────┴────────────────────────────────────────┐
│                  DATA LAYER                             │
│  SQLite/PostgreSQL + Redis + File Storage              │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Frontend Architecture

### Technology Stack
- **Framework**: React 18
- **Language**: TypeScript
- **State Management**: Zustand
- **Styling**: TailwindCSS
- **Routing**: React Router
- **i18n**: react-i18next (8 languages)
- **UI Components**: Custom + Lucide icons

### Directory Structure
```
/components
  /admin          - Admin panel components
  /settings       - User settings modules
  /ReportBuilder  - Report generation UI
  /MyWork         - Personal execution hub
  /...            - Feature-specific components

/views
  /admin          - Admin views
  /superadmin     - SuperAdmin views
  /...            - Main application views

/store
  useAppStore.ts  - Global state management

/services
  api.ts          - API client
  /...            - Frontend services
```

### Key Features
- **Multi-language Support**: 8 languages (EN, PL, ES, FR, DE, IT, JA, AR)
- **Role-Based UI**: User, Admin, SuperAdmin views
- **Responsive Design**: Desktop + Mobile
- **Dark Mode**: Theme support
- **Real-time Updates**: WebSocket ready

---

## 3. Backend Architecture

### Technology Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript + JavaScript (migrating)
- **Database**: SQLite (dev) / PostgreSQL (prod)
- **Caching**: Redis
- **Queue**: BullMQ
- **Monitoring**: Sentry
- **AI**: 12 LLM providers

### Directory Structure
```
/server
  /src
    /services     - Business logic (TypeScript)
    /utils        - Utility functions
    /database     - Database layer
  /routes         - API endpoints
  /middleware     - Express middleware
  /controllers    - Request handlers
  /ai             - AI orchestration
  /cron           - Scheduled jobs
  /jobs           - Background jobs
  /workers        - Queue workers
  /seeds          - Database seeding
  /migrations     - Schema migrations
```

### Service Layer Patterns
- **Class-based Async DI**: Modern service pattern
- **Lazy Loading**: Dependencies loaded on demand
- **Singleton Pattern**: Service instances
- **Event-Driven**: Event bus for inter-service communication

---

## 4. Core Modules

### 4.1 Authentication & Authorization
**Location**: `/server/middleware`, `/server/src/services`

**Components**:
- JWT-based authentication
- Role-Based Access Control (RBAC)
- MFA support (partial)
- Session management
- Token revocation

**Middleware**:
- `authMiddleware.js` - User authentication
- `adminMiddleware.js` - Admin authorization
- `superAdminMiddleware.js` - SuperAdmin authorization

### 4.2 AI Orchestration
**Location**: `/server/ai`, `/server/src/services/ai`

**Providers** (12 total):
- OpenAI (GPT-4, GPT-3.5)
- Anthropic (Claude)
- Google (Gemini)
- Mistral
- Groq
- Together AI
- NVIDIA
- DeepSeek
- Qwen
- Ernie
- Z.AI
- Ollama (local)

**Components**:
- AI Pipeline orchestrator
- Context builder
- Prompt engineering
- Response caching
- Fallback chains
- Token management

### 4.3 Assessment & Diagnostics
**Location**: `/server/src/services`, `/components`

**Frameworks**:
- DRD (Digital Readiness Diagnostic)
- Multi-framework support
- Custom assessment builder

**Features**:
- Maturity assessment
- Gap analysis
- Recommendation engine
- Report generation (BCG-style)

### 4.4 Project Management
**Location**: `/server/routes`, `/views`

**Components**:
- Project lifecycle management
- Initiative tracking
- Task management
- Team collaboration
- Workstream organization

### 4.5 Billing & Subscriptions
**Location**: `/server/src/services`

**Features**:
- Stripe integration
- Subscription management
- Usage tracking
- Invoice generation
- Dunning management
- Webhook handling

### 4.6 Knowledge Base
**Location**: `/server/routes/knowledge`, `/views`

**Features**:
- Document management
- RAG (Retrieval-Augmented Generation)
- Search functionality
- Version control

---

## 5. Data Layer

### Database Schema
**Type**: Relational (SQLite/PostgreSQL)

**Key Tables**:
- `users` - User accounts
- `organizations` - Organization data
- `projects` - Project management
- `initiatives` - Strategic initiatives
- `tasks` - Task tracking
- `maturity_assessments` - Assessment data
- `knowledge_docs` - Knowledge base
- `billing_*` - Billing tables
- `ai_*` - AI-related data

**Relationships**:
- Multi-tenant architecture
- Organization → Projects → Initiatives → Tasks
- User → Organization (many-to-many)
- Project → Team Members (RBAC)

### Caching Strategy
**Redis** (planned):
- Session storage
- API response caching
- AI response caching
- Rate limiting

---

## 6. Integration Points

### External Services
1. **Stripe** - Payment processing
2. **Sentry** - Error tracking
3. **LLM Providers** - AI services (12 providers)
4. **Email** - Transactional emails
5. **OAuth** - Social login (Google, Microsoft)
6. **Slack/Teams** - Notifications (planned)

### API Endpoints
**Total Routes**: 176+ endpoints

**Categories**:
- `/api/auth` - Authentication
- `/api/users` - User management
- `/api/projects` - Project management
- `/api/initiatives` - Initiative tracking
- `/api/assessments` - Maturity assessments
- `/api/ai` - AI services
- `/api/billing` - Billing operations
- `/api/admin` - Admin operations
- `/api/superadmin` - SuperAdmin operations

---

## 7. Security Architecture

### Authentication Flow
```
Client → API Gateway → Auth Middleware → JWT Validation
                                       ↓
                              Token Revocation Check
                                       ↓
                              User/Role Verification
                                       ↓
                              Request Processing
```

### Authorization Layers
1. **Public** - No auth required
2. **Authenticated** - Valid JWT
3. **Admin** - Organization admin role
4. **SuperAdmin** - Platform admin role

### Security Measures
- JWT tokens with expiration
- Token revocation list
- Password hashing (bcrypt)
- Rate limiting
- CORS policy
- Security headers (Helmet.js)

---

## 8. Deployment Architecture

### Current Setup
**Environment**: Single server deployment

**Components**:
- Node.js application server
- SQLite database (dev)
- File storage (local)

### Target Setup (Production)
**Environment**: Multi-region cloud deployment

**Components**:
- Load balancer
- Multiple app servers
- PostgreSQL (managed)
- Redis cluster
- S3/Cloud storage
- CDN for static assets

---

## 9. Scalability Considerations

### Current Limitations
- Monolithic architecture
- Single database instance
- No horizontal scaling
- Limited caching

### Planned Improvements
1. **Microservices separation**
2. **Database read replicas**
3. **Redis caching layer**
4. **Horizontal scaling**
5. **CDN integration**
6. **Queue-based processing**

---

## 10. Fork Preparation

### Shared Components (Common)
```
/shared
  /types          - TypeScript definitions
  /utils          - Utility functions
  /constants      - Shared constants
  /ai-core        - AI orchestration
  /auth-core      - Authentication
  /db-adapters    - Database layer
```

### Consultinity-Specific
```
/consultinity
  /assessment     - DRD framework
  /consulting     - Consulting features
  /reports        - BCG-style reports
  /playbooks      - Consulting playbooks
```

### New Application
```
/new-app
  /features       - App-specific features
  /workflows      - Custom workflows
  /integrations   - Specific integrations
```

---

## 11. Technical Debt

### Architecture Debt
1. Monolithic structure (needs microservices)
2. Mixed TypeScript/JavaScript
3. Circular dependencies (some)
4. Large service files
5. Tight coupling in some areas

### Recommendations
1. Gradual microservices extraction
2. Complete TypeScript migration
3. Resolve circular dependencies
4. Implement proper service boundaries
5. Add API versioning

---

## 12. Performance Bottlenecks

### Identified Issues
1. N+1 queries in some endpoints
2. Large payload responses
3. No response compression
4. Limited caching
5. AI service latency

### Optimization Plan
1. Query optimization
2. Pagination implementation
3. Response compression (Gzip)
4. Redis caching
5. AI response caching

---

## 13. Monitoring & Observability

### Current Setup
- Sentry for error tracking
- Basic logging (Winston)
- No metrics collection
- No distributed tracing

### Target Setup
- Prometheus for metrics
- Grafana for dashboards
- ELK stack for logs
- Distributed tracing (Jaeger)
- Health check endpoints

---

**Documented by**: Antigravity AI Agent  
**Status**: Ready for fork planning
