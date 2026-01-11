# 🚨 AGENT 5: TypeScript Errors & Critical Fixes

## 📋 MISJA

Naprawa 766 błędów TypeScript w 39 plikach - krytyczne dla stabilności systemu.

---

## 📊 STATYSTYKI

| Metryka           | Wartość       |
| ----------------- | ------------- |
| Błędów TypeScript | **766**       |
| Plików do naprawy | **39**        |
| Priorytet         | **KRYTYCZNY** |

---

## 📁 PLIKI DO NAPRAWY (39 plików)

### 🔴 AI Services (9 plików) - NAJWYŻSZY PRIORYTET

```
server/src/ai/actionDecisionService.ts
server/src/ai/actionExecutionAdapter.ts
server/src/ai/actionProposalEngine.ts
server/src/ai/asyncJobService.ts
server/src/ai/auditExport.ts
server/src/ai/policyEngine.ts
server/src/ai/recommendationEngine.ts
server/src/ai/signalEngine.ts
server/src/ai/simulationEngine.ts
```

### 🟠 Controllers (4 pliki)

```
server/src/controllers/SuperAdminController.ts
server/src/controllers/ai/AIExperimentsController.ts
server/src/controllers/ai/AIPromptsController.ts
server/src/controllers/ai/AITrainingController.ts
```

### 🟡 Database & Middleware (8 plików)

```
server/src/database/ConnectionPool.ts
server/src/database/Database.ts
server/src/database/DatabaseMetrics.ts
server/src/middleware/auth.middleware.ts
server/src/middleware/projectQuota.middleware.ts
server/src/middleware/quotaMiddleware.ts
server/src/middleware/rbac.middleware.ts
server/src/queues/aiQueue.ts
```

### 🟢 Routes (9 plików)

```
server/src/routes/ai/ai-ab-testing.routes.ts
server/src/routes/ai/ai-budgets.routes.ts
server/src/routes/ai/ai-development.routes.ts
server/src/routes/ai/ai-operations.routes.ts
server/src/routes/ai/ai-settings.routes.ts
server/src/routes/analyticsAdvanced.routes.ts
server/src/routes/auth.routes.ts
server/src/routes/gamification.routes.ts
server/src/routes/knowledge.routes.ts
server/src/routes/media-ingestion.routes.ts
server/src/routes/superadmin.routes.ts
```

### 🔵 Services (6 plików)

```
server/src/services/RefreshTokenService.ts
server/src/services/ai/aiPipeline.ts
server/src/services/aiService.ts
server/src/services/emailService.ts
server/src/services/invitation/InvitationDataService.ts
server/src/models/megatrend.ts
```

### ⚪ Frontend (1 plik)

```
src/views/partner/PartnerPortalView.tsx
```

---

## 🔥 NAJCZĘSTSZE BŁĘDY I ROZWIĄZANIA

### 1. `TS18046: 'x' is of type 'unknown'`

**Problem:** Brak typowania dla wyników z bazy danych

```typescript
// ❌ BŁĄD:
db.get('SELECT * FROM users', [], (err, row) => {
  console.log(row.email); // Error: row is unknown
});

// ✅ ROZWIĄZANIE:
interface UserRow {
  id: string;
  email: string;
  role: string;
}

db.get<UserRow>('SELECT * FROM users', [], (err, row) => {
  console.log(row?.email); // OK
});

// LUB z asercją typu:
db.get('SELECT * FROM users', [], (err, row) => {
  const user = row as UserRow;
  console.log(user.email);
});
```

### 2. `TS2307: Cannot find module`

**Problem:** Brakujące pliki lub złe ścieżki importu

```typescript
// ❌ BŁĄD:
import { TaskExecutor } from './actionExecutors/taskExecutor.js';
// Error: Cannot find module

// ✅ ROZWIĄZANIA:
// A) Stwórz brakujący plik:
// server/src/ai/actionExecutors/taskExecutor.ts

// B) Usuń import jeśli nie jest potrzebny

// C) Zamień na stub:
const TaskExecutor = {
  execute: async () => ({ success: true }),
};
```

### 3. `TS2698: Spread types may only be created from object types`

**Problem:** Spread na nieznanym typie

```typescript
// ❌ BŁĄD:
const result = { ...row }; // row is unknown

// ✅ ROZWIĄZANIE:
const result = { ...(row as Record<string, unknown>) };

// LUB z typem:
interface ResultRow {
  id: string;
  name: string;
}
const result = { ...(row as ResultRow) };
```

### 4. `TS7034: Variable implicitly has type 'any[]'`

**Problem:** Brak typu dla tablicy

```typescript
// ❌ BŁĄD:
let results = [];

// ✅ ROZWIĄZANIE:
let results: MyType[] = [];
// LUB:
const results: Array<{ id: string; name: string }> = [];
```

### 5. `TS2353: Object literal may only specify known properties`

**Problem:** Obiekt zawiera właściwości których nie ma w typie

```typescript
// ❌ BŁĄD:
const auditParams: AuditLogParams = {
  job_id: '123', // Error: job_id doesn't exist
  event: 'test',
};

// ✅ ROZWIĄZANIE A - Rozszerz typ:
interface ExtendedAuditLogParams extends AuditLogParams {
  job_id?: string;
  correlation_id?: string;
}

// ✅ ROZWIĄZANIE B - Użyj meta:
const auditParams: AuditLogParams = {
  event: 'test',
  meta: { job_id: '123' },
};
```

### 6. `TS2794: Expected 1 arguments, but got 0`

**Problem:** Promise resolve bez argumentu

```typescript
// ❌ BŁĄD:
new Promise((resolve) => {
  resolve(); // Error: Expected 1 argument
});

// ✅ ROZWIĄZANIE:
new Promise<void>((resolve) => {
  resolve();
});
```

### 7. `TS2339: Property 'x' does not exist on type '{}'`

**Problem:** Dostęp do właściwości na pustym obiekcie

```typescript
// ❌ BŁĄD:
const config = {};
console.log(config.policy_engine_enabled); // Error

// ✅ ROZWIĄZANIE:
interface PolicyConfig {
  policy_engine_enabled?: boolean;
  updated_by?: string;
}
const config: PolicyConfig = {};
```

---

## 📝 WZORZEC NAPRAWY PLIKU

```typescript
/**
 * [FileName] - TypeScript Error Fixes
 *
 * Fixed errors:
 * - TS18046: Added types for database results
 * - TS2307: Fixed import paths
 * - TS7034: Added explicit array types
 */

// 1. Dodaj interfejsy na początku pliku
interface DatabaseRow {
  id: string;
  created_at: string;
  // ... inne pola
}

interface AuditLogMeta {
  job_id?: string;
  correlation_id?: string;
  organization_id?: string;
}

// 2. Dodaj typy do funkcji
async function getData(): Promise<DatabaseRow[]> {
  return new Promise((resolve, reject) => {
    db.all<DatabaseRow>('SELECT * FROM table', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

// 3. Użyj asercji typu dla unknown
function processRow(row: unknown): DatabaseRow {
  return row as DatabaseRow;
}
```

---

## 🎯 STRATEGIA NAPRAWY

### Faza 1: Quick Fixes (30 min)

Napraw najprostsze błędy:

- `TS7034` - dodaj typy do tablic
- `TS2794` - dodaj `<void>` do Promise
- `TS18046` - dodaj `as Type` asercje

### Faza 2: Interface Creation (1h)

Stwórz brakujące interfejsy:

```
server/src/types/database.types.ts  - typy dla wyników z DB
server/src/types/audit.types.ts     - typy dla audit logów
server/src/types/ai.types.ts        - typy dla AI services
```

### Faza 3: Missing Modules (30 min)

Napraw brakujące moduły:

- Stwórz stuby dla brakujących executorów
- Napraw ścieżki importów

---

## 🧪 E2E TESTY DO PRZEGLĄDU

Po naprawie TypeScript, sprawdź testy E2E:

```
tests/e2e/assessment.e2e.cjs
tests/e2e/rapidlean-observations.e2e.cjs
tests/economics/economics.e2e.test
```

Uruchom:

```bash
npx playwright test tests/e2e/
```

---

## ✅ WERYFIKACJA

### Sprawdź postęp:

```bash
# Policz błędy
npm run type-check 2>&1 | grep "error TS" | wc -l

# Pokaż błędy w konkretnym pliku
npm run type-check 2>&1 | grep "actionDecisionService"
```

### Cel:

- [ ] 0 błędów TypeScript
- [ ] `npm run build` przechodzi
- [ ] `npm run type-check` przechodzi

---

## 🚀 KOMENDY

```bash
# Sprawdź błędy TS
npm run type-check

# Build (sprawdza TS + kompiluje)
npm run build

# Sprawdź błędy w konkretnym pliku
npx tsc --noEmit server/src/ai/actionDecisionService.ts

# Szybki test czy działa
npm run dev
```

---

## ⚠️ UWAGI

1. **NIE używaj `any` jako rozwiązania** - to tylko ukrywa błędy
2. **Twórz interfejsy** zamiast inline typów dla lepszej reużywalności
3. **Sprawdzaj dokumentację** przed tworzeniem nowych typów - mogą już istnieć w `src/types/`
4. **Testuj zmiany** - po każdej naprawie uruchom `npm run type-check`

---

## 📁 STRUKTURA TYPÓW

Nowe typy dodawaj do:

```
server/src/types/
├── database.types.ts    ← wyniki z DB
├── audit.types.ts       ← audit log params
├── ai.types.ts          ← AI services
├── api.types.ts         ← API requests/responses
└── index.ts             ← eksporty
```

---

## 📞 POMOC

Istniejące typy: `src/types/`, `server/src/types/`
Schema bazy: `server/src/database/schema/`
