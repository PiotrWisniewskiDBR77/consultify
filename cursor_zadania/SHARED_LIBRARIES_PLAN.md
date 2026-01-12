# Shared Libraries Extraction Plan
**Date**: 2026-01-03  
**Agent**: Antigravity  
**Status**: 🔄 In Progress

## Analysis Results

### Current Codebase
- **types.ts**: 6,727 lines (massive!)
- **Utils**: Multiple util folders (server/utils, tests/utils)
- **AI Services**: 12 LLM providers in server/ai
- **Auth**: JWT, bcrypt, session management
- **Database**: SQLite/PostgreSQL adapters

## Extraction Strategy

### Phase 1: Types Extraction (Priority P0)
**Target**: `@shared/types` package

**Files to extract**:
- Core types (User, Organization, Project)
- API types (Request/Response interfaces)
- Common enums (Status, Roles, etc.)

**Estimated size**: ~2000 lines of shared types

### Phase 2: Utils Extraction (Priority P0)
**Target**: `@shared/utils` package

**Categories**:
- Date/time utilities
- String manipulation
- Validation helpers
- Crypto utilities
- Format converters

**Estimated size**: ~500 lines

### Phase 3: AI Core Extraction (Priority P1)
**Target**: `@shared/ai-core` package

**Components**:
- AI Pipeline orchestrator
- Context builder
- Provider manager (12 providers)
- Token manager
- Response caching

**Estimated size**: ~1500 lines

### Phase 4: Auth Core Extraction (Priority P1)
**Target**: `@shared/auth` package

**Components**:
- JWT handling
- Password hashing
- Session management
- RBAC logic
- MFA support

**Estimated size**: ~800 lines

### Phase 5: Database Adapters (Priority P2)
**Target**: `@shared/database` package

**Components**:
- Database adapters (SQLite/PostgreSQL)
- Connection pooling
- Query builders
- Migration utilities

**Estimated size**: ~600 lines

### Phase 6: UI Components (Priority P2)
**Target**: `@shared/ui` package

**Components**:
- Form components
- Layout components
- Common modals
- Loading states
- Error boundaries

**Estimated size**: ~1000 lines

## Implementation Plan

### Week 1: Setup + Types
- [ ] Create Nx monorepo structure
- [ ] Extract @shared/types
- [ ] Update imports in consultify app

### Week 2: Utils + AI Core
- [ ] Extract @shared/utils
- [ ] Extract @shared/ai-core
- [ ] Test integration

### Week 3: Auth + Database
- [ ] Extract @shared/auth
- [ ] Extract @shared/database
- [ ] Test integration

### Week 4: UI + Finalization
- [ ] Extract @shared/ui
- [ ] Documentation
- [ ] CI/CD setup

## Success Criteria
- [ ] 6 shared packages created
- [ ] All packages buildable independently
- [ ] Consultify app uses shared packages
- [ ] Zero breaking changes
- [ ] Documentation complete

## Next Steps
1. Start with types.ts analysis
2. Identify truly shared types
3. Create extraction script
4. Begin Nx monorepo setup

**Status**: Analysis complete, ready for implementation
