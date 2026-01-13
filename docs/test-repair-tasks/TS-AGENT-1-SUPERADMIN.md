# 🔴 TS-AGENT 1: SuperAdmin Controller

## 📋 MISJA

Naprawić **321 błędów TypeScript** w jednym pliku - największy plik z błędami.

**Szacowany czas:** 1.5-2h

---

## 📁 PLIK DO NAPRAWY

```
server/src/controllers/SuperAdminController.ts  →  321 błędów
```

---

## 🔍 GŁÓWNE TYPY BŁĘDÓW

```bash
# Sprawdź błędy w tym pliku
npm run type-check 2>&1 | grep "SuperAdminController"
```

### Najczęstsze błędy:

1. **TS2339** - Property does not exist on type
2. **TS7006** - Parameter implicitly has 'any' type
3. **TS2345** - Argument type mismatch
4. **TS18046** - 'x' is of type 'unknown'

---

## 📝 STRATEGIA NAPRAWY

### Krok 1: Zdefiniuj interfejsy Request/Response

```typescript
// Na początku pliku dodaj:
import { Request, Response, NextFunction } from 'express';

interface SuperAdminRequest extends Request {
  user?: {
    id: string;
    role: string;
    organizationId?: string;
  };
  params: {
    id?: string;
    userId?: string;
    orgId?: string;
  };
  query: {
    page?: string;
    limit?: string;
    search?: string;
    status?: string;
    [key: string]: string | undefined;
  };
  body: Record<string, unknown>;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

### Krok 2: Typuj parametry funkcji

```typescript
// ❌ PRZED:
async getUsers(req, res) {
    const { page, limit } = req.query;
    // ...
}

// ✅ PO:
async getUsers(req: SuperAdminRequest, res: Response): Promise<void> {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    // ...
}
```

### Krok 3: Typuj wyniki z bazy danych

```typescript
// ❌ PRZED:
const users = await db.all('SELECT * FROM users');
users.forEach((u) => console.log(u.email)); // Error: u is unknown

// ✅ PO:
interface UserRow {
  id: string;
  email: string;
  role: string;
  status: string;
  organization_id: string;
  created_at: string;
}

const users = await db.all<UserRow>('SELECT * FROM users');
users.forEach((u) => console.log(u.email)); // OK
```

---

## 🎯 WZORZEC DLA METOD KONTROLERA

```typescript
class SuperAdminController {
  /**
   * Get all organizations with pagination
   */
  async getOrganizations(req: SuperAdminRequest, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page || '1', 10);
      const limit = parseInt(req.query.limit || '20', 10);
      const offset = (page - 1) * limit;

      interface OrgRow {
        id: string;
        name: string;
        plan: string;
        status: string;
        created_at: string;
      }

      const organizations = await new Promise<OrgRow[]>((resolve, reject) => {
        db.all<OrgRow>(
          'SELECT * FROM organizations LIMIT ? OFFSET ?',
          [limit, offset],
          (err, rows) => (err ? reject(err) : resolve(rows || []))
        );
      });

      const total = await new Promise<number>((resolve) => {
        db.get<{ count: number }>('SELECT COUNT(*) as count FROM organizations', [], (_, row) =>
          resolve(row?.count || 0)
        );
      });

      res.json({
        data: organizations,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error('Error getting organizations:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
```

---

## ✅ WERYFIKACJA

```bash
# Po naprawie sprawdź:
npm run type-check 2>&1 | grep "SuperAdminController" | wc -l

# Cel: 0 błędów
```

---

## 📞 POMOC

- Typy Express: `@types/express`
- Istniejące typy: `server/src/types/`
- Schema bazy: `server/src/database/schema/`
