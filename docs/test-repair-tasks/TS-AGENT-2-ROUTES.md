# 🟠 TS-AGENT 2: Routes

## 📋 MISJA

Naprawić **~217 błędów TypeScript** w plikach routes.

**Szacowany czas:** 1-1.5h

---

## 📁 PLIKI DO NAPRAWY (8 plików)

| Plik                                            | Błędy    |
| ----------------------------------------------- | -------- |
| `server/src/routes/superadmin.routes.ts`        | 99       |
| `server/src/routes/ai/ai-budgets.routes.ts`     | 43       |
| `server/src/routes/knowledge.routes.ts`         | 28       |
| `server/src/routes/ai/ai-development.routes.ts` | 24       |
| `server/src/routes/ai/ai-operations.routes.ts`  | 14       |
| `server/src/routes/ai/ai-ab-testing.routes.ts`  | 5        |
| `server/src/routes/analyticsAdvanced.routes.ts` | 4        |
| **SUMA**                                        | **~217** |

---

## 🔍 SPRAWDŹ BŁĘDY

```bash
# Wszystkie błędy w routes
npm run type-check 2>&1 | grep "routes/" | head -50

# Konkretny plik
npm run type-check 2>&1 | grep "superadmin.routes"
```

---

## 📝 STRATEGIA NAPRAWY

### Krok 1: Utwórz plik typów dla routes

```typescript
// server/src/types/routes.types.ts
import { Request, Response, NextFunction, Router } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    organizationId: string;
  };
}

export interface PaginationQuery {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
  };
}

export type RouteHandler = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => Promise<void> | void;
```

### Krok 2: Typuj handlery route'ów

```typescript
// ❌ PRZED:
router.get('/users', async (req, res) => {
  const users = await getUsers(req.query);
  res.json(users);
});

// ✅ PO:
import { AuthenticatedRequest, ApiResponse } from '../types/routes.types';

interface UserResponse {
  id: string;
  email: string;
  role: string;
}

router.get(
  '/users',
  async (req: AuthenticatedRequest, res: Response<ApiResponse<UserResponse[]>>) => {
    try {
      const users = await getUsers(req.query as PaginationQuery);
      res.json({ success: true, data: users });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to fetch users' });
    }
  }
);
```

### Krok 3: Typuj middleware

```typescript
// ❌ PRZED:
const validateRequest = (req, res, next) => {
  if (!req.body.name) {
    return res.status(400).json({ error: 'Name required' });
  }
  next();
};

// ✅ PO:
const validateRequest: RouteHandler = (req, res, next) => {
  if (!req.body.name) {
    res.status(400).json({ error: 'Name required' });
    return;
  }
  next();
};
```

---

## 🎯 WZORZEC DLA ROUTE FILE

```typescript
/**
 * [Feature] Routes
 */
import { Router, Response } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types/routes.types';

const router = Router();

// Response types
interface FeatureItem {
  id: string;
  name: string;
  status: string;
}

// GET /api/feature
router.get('/', async (req: AuthenticatedRequest, res: Response<ApiResponse<FeatureItem[]>>) => {
  try {
    const items = await FeatureService.getAll(req.user?.organizationId);
    res.json({ success: true, data: items });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// POST /api/feature
interface CreateFeatureBody {
  name: string;
  description?: string;
}

router.post('/', async (req: AuthenticatedRequest, res: Response<ApiResponse<FeatureItem>>) => {
  try {
    const body = req.body as CreateFeatureBody;
    const item = await FeatureService.create(body, req.user?.id);
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create' });
  }
});

export default router;
```

---

## ✅ KOLEJNOŚĆ NAPRAWY

1. **superadmin.routes.ts** (99) - najważniejszy
2. **ai-budgets.routes.ts** (43)
3. **knowledge.routes.ts** (28)
4. **ai-development.routes.ts** (24)
5. Pozostałe mniejsze

---

## ✅ WERYFIKACJA

```bash
# Po każdym pliku:
npm run type-check 2>&1 | grep "routes/" | wc -l

# Cel: 0 błędów
```
