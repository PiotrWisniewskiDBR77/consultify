# 🤖 ZADANIA DLA ANTIGRAVITY - Refactoring Consultify

## 📋 Informacje Ogólne

**Master Plan (LOKALNY)**: `cursor_zadania/MASTER_PLAN.md` ← **AKTUALIZUJ TUTAJ!**  
**Progress Report**: `cursor_zadania/PROGRESS_REPORT.md` ← **RAPORTUJ TUTAJ!**

**Rola**: Strategia, Architektura, Shared Libraries, Fork Preparation

---

## 🏛️ BATCH 1: Shared Core Library Extraction (Priorytet P0)

### Cel
Wydzielić wspólne komponenty do shared packages

### Zakres
- **Packages**: 6 shared packages
- **Pattern**: Monorepo (Nx)
- **Czas**: 10-12 godzin

### Zadania

#### 1.1 Setup Nx Monorepo
```bash
npx create-nx-workspace@latest consultify-monorepo \
  --preset=ts \
  --packageManager=npm

cd consultify-monorepo
```

#### 1.2 Create Shared Packages
```bash
# @shared/types
nx generate @nx/js:library shared-types --directory=packages/shared-types

# @shared/utils
nx generate @nx/js:library shared-utils --directory=packages/shared-utils

# @shared/ai-core
nx generate @nx/js:library shared-ai-core --directory=packages/shared-ai-core

# @shared/auth
nx generate @nx/js:library shared-auth --directory=packages/shared-auth

# @shared/database
nx generate @nx/js:library shared-database --directory=packages/shared-database

# @shared/ui
nx generate @nx/react:library shared-ui --directory=packages/shared-ui
```

#### 1.3 Extract Types
```typescript
// packages/shared-types/src/index.ts
export * from './user.types';
export * from './organization.types';
export * from './project.types';
export * from './api.types';
```

#### 1.4 Extract Utils
```typescript
// packages/shared-utils/src/index.ts
export * from './date.utils';
export * from './string.utils';
export * from './validation.utils';
export * from './crypto.utils';
```

#### 1.5 Extract AI Core
```typescript
// packages/shared-ai-core/src/index.ts
export * from './orchestrator';
export * from './context-builder';
export * from './provider-manager';
export * from './token-manager';
```

### Aktualizacja Master Planu
```markdown
- [x] Extract common types
- [x] Extract common utils
- [x] Extract AI core
- [x] Extract auth core
- [x] Extract DB adapters
- [x] Initialize Nx workspace
```

---

## 🗄️ BATCH 2: Database Optimization (Priorytet P0)

### Cel
Optymalizacja queries i dodanie indexes

### Zadania

#### 2.1 Query Analysis
```sql
-- Znajdź slow queries
EXPLAIN ANALYZE SELECT * FROM projects 
  WHERE organization_id = '...' 
  AND status = 'active';
```

#### 2.2 Add Missing Indexes
```sql
-- Migration: add_performance_indexes.sql
CREATE INDEX IF NOT EXISTS idx_projects_org_status 
  ON projects(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_initiatives_project_status 
  ON initiatives(project_id, status);

CREATE INDEX IF NOT EXISTS idx_tasks_initiative_status 
  ON tasks(initiative_id, status);

CREATE INDEX IF NOT EXISTS idx_members_org_user 
  ON organization_members(organization_id, user_id);
```

#### 2.3 Query Optimization
```typescript
// ❌ Przed: N+1
const projects = await db.all('SELECT * FROM projects');
for (const project of projects) {
  project.initiatives = await db.all(
    'SELECT * FROM initiatives WHERE project_id = ?', 
    project.id
  );
}

// ✅ Po: JOIN
const projects = await db.all(`
  SELECT 
    p.*,
    json_group_array(
      json_object(
        'id', i.id,
        'name', i.name,
        'status', i.status
      )
    ) as initiatives
  FROM projects p
  LEFT JOIN initiatives i ON p.id = i.project_id
  GROUP BY p.id
`);
```

### Aktualizacja Master Planu
```markdown
- [x] Identify N+1 queries
- [x] Optimize slow queries
- [x] Add missing indexes
- [x] Implement query caching
```

---

## 🔧 BATCH 3: API Gateway Pattern (Priorytet P1)

### Cel
Wprowadzić API Gateway layer

### Zadania

#### 3.1 Gateway Implementation
```typescript
// server/gateway/APIGateway.ts
export class APIGateway {
  constructor(
    private rateLimiter: RateLimiter,
    private cache: CacheManager,
    private router: Router
  ) {}
  
  async handle(req: Request, res: Response) {
    // 1. Rate limiting
    await this.rateLimiter.check(req);
    
    // 2. Cache check
    const cached = await this.cache.get(req.path);
    if (cached) return res.json(cached);
    
    // 3. Route to service
    const result = await this.router.route(req);
    
    // 4. Cache response
    await this.cache.set(req.path, result);
    
    return res.json(result);
  }
}
```

#### 3.2 Rate Limiting
```typescript
// server/gateway/RateLimiter.ts
export class RateLimiter {
  private limits = new Map<string, number>();
  
  async check(req: Request) {
    const key = `${req.ip}:${req.path}`;
    const count = this.limits.get(key) || 0;
    
    if (count >= 100) { // 100 requests per minute
      throw new Error('Rate limit exceeded');
    }
    
    this.limits.set(key, count + 1);
    setTimeout(() => this.limits.delete(key), 60000);
  }
}
```

### Aktualizacja Master Planu
```markdown
- [x] Design gateway layer
- [x] Implement request routing
- [x] Add rate limiting
- [x] Implement caching
```

---

## 🍴 BATCH 4: Fork Strategy Documentation (Priorytet P1)

### Cel
Dokumentacja strategii forka i deployment

### Zadania

#### 4.1 Fork Architecture Document
```markdown
# Fork Architecture

## Monorepo Structure
/consultify-monorepo
  /packages
    /shared-*        # Shared packages
  /apps
    /consultify      # Original app
    /new-app         # New application

## Deployment Strategy
- Consultify: consultify.com
- New App: newapp.com
- Shared packages: Private npm registry

## Database Strategy
- Shared tables: users, organizations
- App-specific tables: separate schemas
```

#### 4.2 Migration Guide
```markdown
# Migration Guide

## Phase 1: Setup Monorepo
1. Create Nx workspace
2. Move existing code to /apps/consultify
3. Extract shared packages

## Phase 2: Configure CI/CD
1. Separate pipelines per app
2. Shared package versioning
3. Deployment automation
```

### Aktualizacja Master Planu
```markdown
- [x] Monorepo structure
- [x] Shared package(s)
- [x] Fork strategy documentation
- [x] Deployment guides per app
```

---

## 📊 Progress Tracking

### Batch Status
- [ ] BATCH 1: Shared Libraries (P0)
- [ ] BATCH 2: Database Optimization (P0)
- [ ] BATCH 3: API Gateway (P1)
- [ ] BATCH 4: Fork Documentation (P1)

### Coordination
- **Cursor**: TypeScript errors, tests
- **Codex**: Service refactoring, CQRS
- **Antigravity**: Architecture, shared libs, fork prep

---

## 🚨 Ważne Zasady

1. **Architecture First**: Plan before implementation
2. **Documentation**: Document all decisions
3. **Coordination**: Sync with Cursor and Codex
4. **Master Plan**: Keep updated
5. **Quality**: No shortcuts on architecture

**Powodzenia!** 🚀
