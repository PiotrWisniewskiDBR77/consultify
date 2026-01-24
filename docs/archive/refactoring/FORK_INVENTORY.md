# Fork Inventory - Consultinity Split Analysis
**Date**: 2026-01-03  
**Phase**: 0 - Audit and Assessment  
**Purpose**: Prepare codebase for fork into two applications

---

## Executive Summary

**Codebase Size**:
- Frontend: 951 component files (.tsx)
- Backend: 814 service files (.ts/.js)
- Routes: 185 API endpoints
- **Total**: ~1,950 files to analyze

**Fork Strategy**: Monorepo with shared packages

---

## 1. Shared Core Components

### 1.1 Shared Types & Interfaces
**Location**: `/types`, `/server/src/types`

**Components**:
- User & Organization types
- Authentication types
- API response types
- Database schema types
- Common enums

**Recommendation**: Extract to `@shared/types` package

### 1.2 Shared Utilities
**Location**: `/utils`, `/server/src/utils`

**Components**:
- Date/time utilities
- String manipulation
- Validation helpers
- Encryption utilities
- Format converters

**Recommendation**: Extract to `@shared/utils` package

### 1.3 Shared AI Core
**Location**: `/server/ai`, `/server/src/services/ai`

**Components** (12 LLM providers):
- AI Pipeline orchestrator
- Context builder
- Prompt engineering
- Token management
- Response caching
- Provider adapters

**Recommendation**: Extract to `@shared/ai-core` package

### 1.4 Shared Authentication
**Location**: `/server/middleware`, `/server/src/services`

**Components**:
- JWT handling
- Password hashing
- Session management
- RBAC logic
- MFA support

**Recommendation**: Extract to `@shared/auth` package

### 1.5 Shared Database Layer
**Location**: `/server/database`, `/server/src/database`

**Components**:
- Database adapters
- Connection pooling
- Query builders
- Migration utilities
- Seed utilities

**Recommendation**: Extract to `@shared/database` package

### 1.6 Shared UI Components
**Location**: `/components` (selected)

**Components**:
- Form components
- Layout components
- Common modals
- Loading states
- Error boundaries

**Recommendation**: Extract to `@shared/ui` package

---

## 2. Consultinity-Specific Code

### 2.1 Assessment Framework
**Location**: `/server/src/services`, `/components`, `/views`

**Components**:
- DRD (Digital Readiness Diagnostic)
- Multi-framework support
- Maturity assessment logic
- Gap analysis
- BCG-style report generation

**Size**: ~150 files  
**Keep in**: Consultinity app

### 2.2 Consulting Features
**Location**: `/server/services`, `/components`

**Components**:
- Playbook engine
- Recommendation engine
- Strategic planning
- Transformation roadmap
- Initiative generator

**Size**: ~100 files  
**Keep in**: Consultinity app

### 2.3 Knowledge Base (Consulting)
**Location**: `/server/routes/knowledge`, `/views`

**Components**:
- Consulting templates
- Best practices library
- Framework documentation
- Case studies

**Size**: ~50 files  
**Keep in**: Consultinity app

### 2.4 Consulting-Specific UI
**Location**: `/views`, `/components`

**Views**:
- Assessment views
- Diagnostic views
- Report builder
- Roadmap planner
- Playbook executor

**Size**: ~200 files  
**Keep in**: Consultinity app

---

## 3. New Application Code

### 3.1 To Be Determined
**Note**: New application features not yet defined

**Potential Shared**:
- Project management core
- Task management
- Team collaboration
- Billing system
- User management

**Potential New**:
- Custom workflows
- Industry-specific features
- Integration requirements
- Unique UI/UX

---

## 4. Database Schema Split

### 4.1 Shared Tables
```sql
-- Core tables (both apps)
users
organizations
organization_members
roles
permissions
sessions
revoked_tokens
audit_logs

-- Billing (both apps)
billing_plans
subscriptions
invoices
payment_methods
usage_tracking

-- AI (both apps)
ai_providers
ai_conversations
ai_context
```

### 4.2 Consultinity-Specific Tables
```sql
-- Assessment & Diagnostics
maturity_assessments
assessment_responses
framework_mappings
gap_analyses

-- Consulting
playbooks
playbook_executions
recommendations
strategic_plans
transformation_roadmaps

-- Knowledge Base
knowledge_docs
knowledge_categories
best_practices
```

### 4.3 New App Tables
```sql
-- To be defined based on requirements
```

### 4.4 Multi-Tenant Strategy
**Option 1**: Shared database with tenant_id
**Option 2**: Separate databases per app
**Option 3**: Hybrid (shared core, separate app data)

**Recommendation**: Option 3 (Hybrid)

---

## 5. Monorepo Structure

### Proposed Structure
```
/consultinity-monorepo
  /packages
    /shared-types
    /shared-utils
    /shared-ai-core
    /shared-auth
    /shared-database
    /shared-ui
  /apps
    /consultinity
      /client
      /server
    /new-app
      /client
      /server
  /tools
    /scripts
    /migrations
```

### Package Management
- **Tool**: Nx or Turborepo
- **Versioning**: Independent versioning
- **Publishing**: Private npm registry or git submodules

---

## 6. Shared Package Details

### 6.1 @shared/types
**Size**: ~50 files  
**Dependencies**: None  
**Exports**: TypeScript definitions

### 6.2 @shared/utils
**Size**: ~30 files  
**Dependencies**: Minimal (date-fns, lodash)  
**Exports**: Utility functions

### 6.3 @shared/ai-core
**Size**: ~100 files  
**Dependencies**: AI SDKs (12 providers)  
**Exports**: AI orchestration layer

### 6.4 @shared/auth
**Size**: ~20 files  
**Dependencies**: JWT, bcrypt, passport  
**Exports**: Auth middleware & services

### 6.5 @shared/database
**Size**: ~15 files  
**Dependencies**: SQLite3, PostgreSQL, Redis  
**Exports**: Database adapters

### 6.6 @shared/ui
**Size**: ~80 files  
**Dependencies**: React, TailwindCSS  
**Exports**: Reusable UI components

---

## 7. Migration Strategy

### Phase 1: Setup Monorepo (Week 1)
- [ ] Initialize Nx workspace
- [ ] Create package structure
- [ ] Set up build system
- [ ] Configure TypeScript paths

### Phase 2: Extract Shared Packages (Weeks 2-3)
- [ ] Extract @shared/types
- [ ] Extract @shared/utils
- [ ] Extract @shared/auth
- [ ] Extract @shared/database
- [ ] Extract @shared/ai-core
- [ ] Extract @shared/ui

### Phase 3: Refactor Applications (Weeks 4-5)
- [ ] Update Consultinity imports
- [ ] Create new app skeleton
- [ ] Configure shared dependencies
- [ ] Test integration

### Phase 4: Database Split (Week 6)
- [ ] Analyze data dependencies
- [ ] Create migration scripts
- [ ] Test multi-tenant setup
- [ ] Implement data isolation

### Phase 5: CI/CD Setup (Week 7)
- [ ] Configure build pipelines
- [ ] Set up deployment workflows
- [ ] Implement testing strategy
- [ ] Configure monitoring

---

## 8. Dependency Analysis

### Shared Dependencies (Both Apps)
```json
{
  "express": "^4.x",
  "react": "^18.x",
  "typescript": "^5.x",
  "ai": "^6.x",
  "bcrypt": "^5.x",
  "jsonwebtoken": "^9.x",
  "zustand": "^5.x"
}
```

### Consultinity-Specific
```json
{
  "jspdf": "^4.x",
  "chart.js": "^4.x"
}
```

### New App-Specific
```json
{
  // To be determined
}
```

---

## 9. Build & Deployment

### Build Strategy
- **Shared packages**: Build once, use in both apps
- **Applications**: Independent builds
- **Versioning**: Semantic versioning per package

### Deployment Strategy
- **Shared packages**: Published to private registry
- **Consultinity**: Independent deployment
- **New App**: Independent deployment
- **Infrastructure**: Shared or separate (TBD)

---

## 10. Testing Strategy

### Shared Package Tests
- Unit tests for each package
- Integration tests for package interactions
- 90% coverage requirement

### Application Tests
- Unit tests for app-specific code
- Integration tests for API endpoints
- E2E tests for user workflows
- Performance tests

---

## 11. Risk Assessment

### High Risk
1. **Breaking changes** during extraction
2. **Circular dependencies** between packages
3. **Database migration** complexity
4. **Version conflicts** in shared packages

### Mitigation
1. Comprehensive testing at each phase
2. Feature flags for gradual rollout
3. Rollback procedures
4. Version pinning strategy

---

## 12. Effort Estimation

| Phase | Duration | Effort |
|-------|----------|--------|
| Monorepo Setup | 1 week | 40h |
| Package Extraction | 2 weeks | 80h |
| App Refactoring | 2 weeks | 80h |
| Database Split | 1 week | 40h |
| CI/CD Setup | 1 week | 40h |
| Testing & QA | 1 week | 40h |
| **TOTAL** | **8 weeks** | **320h** |

---

## 13. Success Criteria

- [ ] Monorepo structure established
- [ ] 6 shared packages extracted
- [ ] Both apps build independently
- [ ] All tests passing
- [ ] CI/CD pipelines configured
- [ ] Documentation complete
- [ ] Zero breaking changes for existing users

---

## 14. Next Steps

1. **Approve fork strategy**
2. **Set up Nx workspace**
3. **Start package extraction** (types first)
4. **Create migration plan**
5. **Weekly progress reviews**

---

**Analyzed by**: Antigravity AI Agent  
**Status**: Ready for implementation
