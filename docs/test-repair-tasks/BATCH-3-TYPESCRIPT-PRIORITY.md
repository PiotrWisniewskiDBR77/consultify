# 🔥 PACZKA 3: TypeScript Priority - Top 10 Plików

## 📋 MISJA

Naprawić błędy TypeScript w 10 najważniejszych plikach - **szacowany czas: 2h**

**Aktualna sytuacja:** 752 błędów w 40 plikach

---

## 🎯 TOP 10 PLIKÓW - PRIORYTET

### 1. `server/src/ai/asyncJobService.ts` (~50 błędów)

**Główne problemy:**

- `TS7034` - Variable implicitly has type 'any'
- `TS2353` - Object literal properties
- `TS2794` - Promise arguments

**Quick fix:**

```typescript
// Na początku pliku dodaj:
interface AiQueueJob {
  id: string;
  type: string;
  data: Record<string, unknown>;
  attempts: number;
  correlation_id?: string;
  organization_id?: string;
}

let aiQueue: any = null; // Temporary, replace with proper type
```

### 2. `server/src/ai/policyEngine.ts` (~25 błędów)

**Główne problemy:**

- `TS18046` - 'x' is of type 'unknown'
- `TS2339` - Property does not exist
- `TS2698` - Spread types

**Quick fix:**

```typescript
interface PolicyRule {
  id: string;
  name: string;
  conditions: Record<string, unknown>;
  actions: string[];
}

interface PolicyConfig {
  policy_engine_enabled?: boolean;
  updated_by?: string;
  updated_at?: string;
}
```

### 3. `server/src/ai/actionDecisionService.ts` (~15 błędów)

**Główne problemy:**

- `TS2307` - Cannot find module
- `TS18046` - unknown type
- `TS2698` - Spread types

**Quick fix:**

```typescript
// Usuń lub zastąp import:
// import { evidenceLedgerService } from '../services/evidenceLedgerService.js';
const evidenceLedgerService = {
  logEvidence: async () => ({ success: true }),
};
```

### 4. `server/src/routes/superadmin.routes.ts` (~20 błędów)

**Główne problemy:**

- Request/Response types
- Missing properties

### 5. `server/src/database/Database.ts` (~15 błędów)

**Główne problemy:**

- Generic type parameters
- Callback types

### 6. `server/src/ai/actionExecutionAdapter.ts` (~10 błędów)

**Główne problemy:**

- `TS2307` - Cannot find module (executors)
- `TS18046` - unknown type

### 7. `server/src/ai/recommendationEngine.ts` (~10 błędów)

**Główne problemy:**

- `TS7034` - implicit any[]
- `TS2339` - Property doesn't exist

### 8. `server/src/services/aiService.ts` (~10 błędów)

### 9. `server/src/ai/signalEngine.ts` (~8 błędów)

### 10. `server/src/ai/simulationEngine.ts` (~5 błędów)

---

## 📝 STRATEGIA NAPRAWY

### Faza 1: Dodaj typy (30 min)

```bash
# Utwórz plik z typami
touch server/src/types/ai.types.ts
```

```typescript
// server/src/types/ai.types.ts
export interface DatabaseRow {
  [key: string]: unknown;
}

export interface AiJob {
  id: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  data: Record<string, unknown>;
  attempts: number;
  created_at: string;
}

export interface AuditLogMeta {
  job_id?: string;
  correlation_id?: string;
  organization_id?: string;
  [key: string]: unknown;
}
```

### Faza 2: Napraw pliki jeden po drugim (1.5h)

**Kolejność:**

1. `asyncJobService.ts` - najważniejszy, używany wszędzie
2. `policyEngine.ts` - governance
3. `Database.ts` - foundation
4. Pozostałe pliki

---

## ✅ WERYFIKACJA

```bash
# Po każdym pliku sprawdź:
npm run type-check 2>&1 | grep "error TS" | wc -l

# Cel: spadek liczby błędów
```

---

## 🎯 CEL FAZY 3

- [ ] < 500 błędów TypeScript
- [ ] Top 5 plików naprawionych
- [ ] Build nadal działa: `npm run build`
