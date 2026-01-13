# 🟢 TS-AGENT 4: Middleware & Database

## 📋 MISJA

Naprawić **~62 błędów TypeScript** w middleware, database i pozostałych plikach.

**Szacowany czas:** 45 min - 1h

---

## 📁 PLIKI DO NAPRAWY (8+ plików)

| Plik                                             | Błędy   |
| ------------------------------------------------ | ------- |
| `server/src/middleware/quotaMiddleware.ts`       | 12      |
| `server/src/database/DatabaseMetrics.ts`         | 4       |
| `server/src/database/ConnectionPool.ts`          | ~5      |
| `server/src/database/Database.ts`                | ~10     |
| `server/src/services/RefreshTokenService.ts`     | ~8      |
| `server/src/services/emailService.ts`            | ~5      |
| `server/src/middleware/auth.middleware.ts`       | ~8      |
| `server/src/middleware/rbac.middleware.ts`       | ~5      |
| `server/src/views/partner/PartnerPortalView.tsx` | ~5      |
| **SUMA**                                         | **~62** |

---

## 🔍 SPRAWDŹ BŁĘDY

```bash
# Middleware
npm run type-check 2>&1 | grep "middleware/" | head -20

# Database
npm run type-check 2>&1 | grep "database/" | head -20

# Wszystkie pozostałe
npm run type-check 2>&1 | grep -v "SuperAdminController\|routes/\|/ai/" | head -30
```

---

## 📝 STRATEGIA NAPRAWY

### Middleware - Express Types

```typescript
// server/src/types/middleware.types.ts
import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'SUPERADMIN' | 'ADMIN' | 'USER' | 'VIEWER';
  organizationId: string;
  permissions?: string[];
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  organizationId?: string;
}

export type MiddlewareFunction = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

export interface QuotaLimits {
  maxProjects: number;
  maxUsers: number;
  maxStorage: number; // in bytes
  maxApiCalls: number; // per day
}
```

### Database - Generic Types

```typescript
// server/src/database/Database.ts
import sqlite3 from 'sqlite3';

// Dodaj typy generyczne do metod
class Database {
  private db: sqlite3.Database;

  get<T = unknown>(
    sql: string,
    params: unknown[],
    callback: (err: Error | null, row: T | undefined) => void
  ): void {
    this.db.get(sql, params, callback);
  }

  all<T = unknown>(
    sql: string,
    params: unknown[],
    callback: (err: Error | null, rows: T[]) => void
  ): void {
    this.db.all(sql, params, callback);
  }

  run(sql: string, params: unknown[], callback?: (err: Error | null) => void): void {
    this.db.run(sql, params, callback);
  }
}
```

---

## 🎯 WZORZEC DLA MIDDLEWARE

```typescript
/**
 * Quota Middleware
 * Enforces plan limits
 */
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, QuotaLimits } from '../types/middleware.types';
import { getDatabase } from '../database/Database';

const db = getDatabase();

interface PlanLimits {
  plan: string;
  max_projects: number;
  max_users: number;
  max_storage: number;
}

const PLAN_LIMITS: Record<string, QuotaLimits> = {
  free: { maxProjects: 3, maxUsers: 5, maxStorage: 1e9, maxApiCalls: 1000 },
  pro: { maxProjects: 20, maxUsers: 50, maxStorage: 10e9, maxApiCalls: 10000 },
  enterprise: { maxProjects: -1, maxUsers: -1, maxStorage: -1, maxApiCalls: -1 },
};

export const checkProjectQuota = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get organization plan
    const org = await new Promise<{ plan: string } | undefined>((resolve) => {
      db.get<{ plan: string }>('SELECT plan FROM organizations WHERE id = ?', [orgId], (_, row) =>
        resolve(row)
      );
    });

    if (!org) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    const limits = PLAN_LIMITS[org.plan] || PLAN_LIMITS.free;

    // Check current count
    const count = await new Promise<number>((resolve) => {
      db.get<{ count: number }>(
        'SELECT COUNT(*) as count FROM projects WHERE organization_id = ?',
        [orgId],
        (_, row) => resolve(row?.count || 0)
      );
    });

    if (limits.maxProjects !== -1 && count >= limits.maxProjects) {
      res.status(403).json({
        error: 'Project limit reached',
        limit: limits.maxProjects,
        current: count,
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Quota check error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
};
```

---

## 🎯 WZORZEC DLA DATABASE SERVICE

```typescript
/**
 * DatabaseMetrics
 */
interface QueryMetric {
  query: string;
  duration: number;
  timestamp: Date;
  success: boolean;
}

class DatabaseMetrics {
  private metrics: QueryMetric[] = [];
  private readonly maxMetrics = 1000;

  record(query: string, duration: number, success: boolean): void {
    this.metrics.push({
      query: query.substring(0, 100), // Truncate
      duration,
      timestamp: new Date(),
      success,
    });

    // Trim if too many
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  getStats(): { avgDuration: number; successRate: number; totalQueries: number } {
    if (this.metrics.length === 0) {
      return { avgDuration: 0, successRate: 1, totalQueries: 0 };
    }

    const totalDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0);
    const successCount = this.metrics.filter((m) => m.success).length;

    return {
      avgDuration: totalDuration / this.metrics.length,
      successRate: successCount / this.metrics.length,
      totalQueries: this.metrics.length,
    };
  }
}

export default new DatabaseMetrics();
```

---

## ✅ KOLEJNOŚĆ NAPRAWY

1. **Utwórz `server/src/types/middleware.types.ts`**
2. **Database.ts** - foundation
3. **quotaMiddleware.ts** - używa Database
4. **auth.middleware.ts**
5. **rbac.middleware.ts**
6. Pozostałe

---

## ✅ WERYFIKACJA

```bash
# Po naprawie:
npm run type-check 2>&1 | grep "middleware/\|database/\|RefreshToken\|emailService" | wc -l

# Cel: 0 błędów

# Całkowita weryfikacja:
npm run type-check 2>&1 | grep "error TS" | wc -l
# Cel: 0 (wszystkie agenty skończone)
```

---

## 🎯 FINAL CHECK

Po zakończeniu pracy wszystkich 4 agentów:

```bash
# Powinno być 0
npm run type-check 2>&1 | grep "error TS" | wc -l

# Build powinien przejść
npm run build
```
