# 🎯 INSTRUKCJE DLA AGENTÓW - STABILIZACJA TESTÓW

## 📊 AKTUALNY STAN (zmierzony przez Agent 5)

| Metryka | Wartość | Cel | Gap |
|---------|---------|-----|-----|
| **Ogólny pass rate** | 91.6% (884/966) | 97% | -5.4% |
| **Performance tests** | 88.7% (86/97) | 97% | -8.3% |
| **Security tests** | 49.5% (99/200) | 97% | -47.5% |
| **Failing tests** | 81 | 0 | -81 |
| **Wyłączonych testów** | 57 | 0 | -57 |

---

## 🔴 GŁÓWNE PROBLEMY DO NAPRAWY

### 1. AIContext Provider (Agent 3 - COMPONENT)
**Błąd:** `useAIContext must be used within an AIProvider`

**Lokalizacja:** Testy komponentów używające AI

**Rozwiązanie:**
```typescript
// tests/components/[Component].test.tsx
import { AIProvider } from '@/contexts/AIContext';

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <AIProvider>
        {ui}
      </AIProvider>
    </BrowserRouter>
  );
};
```

### 2. react-hot-toast Mock (Agent 3 - COMPONENT)
**Błąd:** `No "toast" export is defined on the "react-hot-toast" mock`

**Lokalizacja:** `tests/unit/components/settings/AISettings.test.tsx`

**Rozwiązanie:**
```typescript
// Na początku pliku testowego
vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
  Toaster: () => null,
}));
```

### 3. Database Mock (Agent 2 - UNIT, Agent 5 - PERFORMANCE)
**Błąd:** `db.run is not a function`

**Lokalizacja:** `tests/performance/stress.test.js`, testy backend

**Rozwiązanie:**
```javascript
// tests/helpers/dbMock.js
export const mockDb = {
  run: vi.fn((sql, params, callback) => callback?.(null)),
  get: vi.fn((sql, params, callback) => callback?.(null, {})),
  all: vi.fn((sql, params, callback) => callback?.(null, [])),
  exec: vi.fn((sql, callback) => callback?.(null)),
};

// W teście:
vi.mock('../../server/src/database/Database', () => ({
  default: mockDb,
  getDb: () => mockDb,
}));
```

### 4. Express App Undefined (Agent 5 - SECURITY)
**Błąd:** `Cannot read properties of undefined (reading 'address')`

**Lokalizacja:** Testy security używające supertest

**Rozwiązanie:**
```javascript
// tests/security/[test].test.js
import express from 'express';

// Tworzymy mock app
const app = express();
app.use(express.json());

// Mock routes
app.post('/api/projects', (req, res) => {
  res.json({ success: true, data: req.body });
});

// Używamy w testach
describe('Security Tests', () => {
  it('should work', async () => {
    const response = await request(app).post('/api/projects');
    expect(response.status).toBe(200);
  });
});
```

---

## 👨‍💻 PRZYDZIAŁY AGENTÓW

### AGENT 1 (KOORDYNATOR) - Wyłączone testy

**Zakres:** 57 testów wyłączonych w `vitest.config.ts`

**Zadania:**
1. Naprawić importy w każdym wyłączonym teście
2. Po naprawie usunąć z `exclude` w `vitest.config.ts`
3. Uruchomić naprawiony test: `npx vitest run [path]`

**Pliki do naprawy (priorytet):**
```
tests/unit/hooks/useAIStream.test.ts
tests/unit/hooks/useAccessPolicy.test.tsx
tests/unit/services/ai/agent.test.ts
tests/unit/services/ai/gemini.test.ts
tests/unit/backend/routes/*.test.js (12 plików)
```

**Typowe naprawy:**
```typescript
// ❌ Błędne
import { something } from '../../../server/services/something.js';

// ✅ Poprawne
import { something } from '@/services/something';
// lub
import { something } from '../../../server/src/services/something';
```

---

### AGENT 2 (UNIT BACKEND) - Backend tests

**Zakres:** `tests/unit/backend/`, `tests/unit/services/`

**Failing tests do naprawy:**
```
tests/unit/backend/services/StageGateService.test.ts - duplikat
tests/unit/backend/stabilizationService.test.js
tests/unit/backend/controllers/UserController.test.js
```

**Zadania:**
1. Naprawić mock bazy danych
2. Użyć `initTestDb()` z `tests/helpers/dbHelper.cjs`
3. Naprawić importy

**Wzorzec:**
```javascript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initTestDb, cleanTables, getDb } from '../../helpers/dbHelper.cjs';

describe('Service', () => {
  let db;
  
  beforeEach(async () => {
    db = await initTestDb();
  });
  
  afterEach(async () => {
    await cleanTables();
  });
  
  it('should work', async () => {
    const result = await db.get('SELECT 1');
    expect(result).toBeDefined();
  });
});
```

---

### AGENT 3 (COMPONENT) - React components

**Zakres:** `tests/components/`, `tests/unit/components/`

**Failing tests do naprawy:**
```
tests/components/settings/AISettings.test.tsx - toast mock
tests/unit/views/MyWorkView.test.tsx - AIProvider
tests/unit/components/MyWork/TaskDetailModal.test.tsx
```

**Zadania:**
1. Dodać AIProvider do wszystkich testów używających AI
2. Naprawić mock react-hot-toast
3. Naprawić mock kontekstów

**Wzorzec renderowania:**
```typescript
import { AIProvider } from '@/contexts/AIContext';
import { AuthProvider } from '@/contexts/AuthContext';

const AllProviders = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <AuthProvider>
      <AIProvider>
        {children}
      </AIProvider>
    </AuthProvider>
  </BrowserRouter>
);

const renderWithProviders = (ui: React.ReactElement) => {
  return render(ui, { wrapper: AllProviders });
};
```

---

### AGENT 4 (INTEGRATION + E2E) - Integration tests

**Zakres:** `tests/integration/`, `tests/e2e/`

**Zadania:**
1. Sprawdzić czy serwer jest uruchomiony przed E2E
2. Naprawić timeouty
3. Naprawić selektory Playwright

**Uruchamianie E2E:**
```bash
# Najpierw uruchom serwer w osobnym terminalu
npm run dev:frontend &
npm run dev:backend &

# Potem testy
npm run test:e2e
```

---

### AGENT 5 (QUALITY) - Performance + Security (JA)

**Zakres:** `tests/performance/`, `tests/security/`

**Aktualny status:**
- Performance: 86/97 passed (88.7%)
- Security: 99/200 passed (49.5%)

**Do naprawy:**
1. Mock Express app dla security tests
2. Mock Database dla performance tests
3. Zwiększyć thresholdy czasowe gdzie potrzeba

---

## 📋 WORKFLOW NAPRAWY

### Krok 1: Identyfikacja błędu
```bash
npx vitest run [path/to/test] --reporter=verbose
```

### Krok 2: Diagnoza
- Sprawdź stack trace
- Znajdź brakujący import/mock

### Krok 3: Naprawa
- Dodaj brakujący mock
- Napraw import path
- Dodaj missing provider

### Krok 4: Weryfikacja
```bash
npx vitest run [path/to/test]
```

### Krok 5: Commit
```bash
git add [files]
git commit -m "fix(tests): [opis naprawy]"
```

---

## 🎯 CELE KOŃCOWE

| Metryka | Obecne | Cel |
|---------|--------|-----|
| Pass rate | 91.6% | 97% |
| Coverage | ~44% | 95% |
| Wyłączonych | 57 | 0 |

---

## 📞 RAPORTOWANIE

Każdy agent raportuje postęp przez:
1. Aktualizację tego pliku z wynikami
2. Komentarz w terminalu z podsumowaniem

**Format raportu:**
```
AGENT [N] - [CZAS]
- Naprawiono: [liczba] testów
- Pozostało: [liczba] failing
- Pass rate: [%]
- Problemy: [opis]
```

---

*Wygenerowano przez Agent 5 (QUALITY) - 2025-01-07*

