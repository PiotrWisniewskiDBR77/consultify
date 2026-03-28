# 🛠️ PLAN NAPRAWY SYSTEMU TESTÓW

## Dokument: Źródło Prawdy dla Agentów

## Data: 2026-01-08

## Cel: 80% PRAWDZIWEGO Code Coverage

---

# 📋 PODZIAŁ PRACY NA AGENTÓW

## AGENT 1: Auth & Security (42 pliki)

**Priorytet:** 🔴 KRYTYCZNY
**Czas:** 3-4 dni

### Pliki do przepisania:

```
tests/auth/*.test.js (5 plików)
tests/security/*.test.js (17 plików)
tests/unit/backend/middleware/*.test.js (20 plików)
```

### Wzorzec:

```javascript
vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  process.env.SQLITE_PATH = `./test-auth-${process.env.VITEST_WORKER_ID || '0'}.db`;
});

// Używać prawdziwej bazy, prawdziwych tokenów JWT
// Weryfikować w bazie po każdej operacji
```

### Checklist:

- [ ] Przepisać testy auth z prawdziwymi tokenami
- [ ] Przepisać testy security z prawdziwymi atakami
- [ ] Przepisać middleware testy z prawdziwymi req/res
- [ ] Dodać cleanup po każdym teście

---

## AGENT 2: Backend Services (63 pliki)

**Priorytet:** 🔴 KRYTYCZNY
**Czas:** 5-7 dni

### Pliki do przepisania:

```
tests/unit/backend/*.test.js (60+ plików)
tests/unit/backend/utils/*.test.ts (3 pliki)
```

### Wzorzec:

```javascript
vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  process.env.SQLITE_PATH = `./test-backend-${process.env.VITEST_WORKER_ID || '0'}.db`;
});

import ServiceName from '../../../server/src/services/ServiceName.js';

// NIE mockować serwisu - importować prawdziwy!
// Weryfikować wyniki w bazie danych
```

### Checklist:

- [ ] Przepisać wszystkie testy serwisów
- [ ] Usunąć mockResolvedValue dla własnych serwisów
- [ ] Dodać weryfikację w bazie po CRUD
- [ ] Testować error cases z prawdziwymi błędami

---

## AGENT 3: Integration Tests (80+ plików)

**Priorytet:** 🟠 WAŻNY
**Czas:** 4-5 dni

### Pliki do przepisania:

```
tests/integration/*.test.js (46 plików)
tests/integration/routes/*.test.js (34 pliki)
```

### Wzorzec:

```javascript
vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  process.env.SQLITE_PATH = `./test-integration-${process.env.VITEST_WORKER_ID || '0'}.db`;
});

import request from 'supertest';
import app from '../../server/src/index.js';

// Prawdziwe HTTP requesty
// Prawdziwa autentykacja
// Weryfikacja w bazie
```

### Checklist:

- [ ] Przepisać wszystkie testy integracyjne
- [ ] Używać supertest z prawdziwym app
- [ ] Testować pełne flow (login → action → verify)
- [ ] Dodać testy error handling (401, 403, 404, 500)

---

## AGENT 4: Component Tests (80+ plików)

**Priorytet:** 🟡 NORMALNY
**Czas:** 3-4 dni

### Pliki do przepisania:

```
tests/components/*.test.tsx (60+ plików)
tests/components/*/*.test.tsx (podkatalogi)
```

### Wzorzec:

```typescript
// Komponenty mogą używać mocków dla API
// ALE muszą importować PRAWDZIWY komponent

import { Button } from '@/components/ui/Button'; // ✅ Prawdziwy
// NIE: const MockButton = () => <button /> // ❌ Fake

// Testować:
// - Renderowanie
// - Interakcję (click, input)
// - Stan (disabled, loading)
// - Accessibility
```

### Checklist:

- [ ] Sprawdzić czy importują prawdziwe komponenty
- [ ] Dodać testy interakcji (userEvent)
- [ ] Dodać testy accessibility (aria-\*)
- [ ] Usunąć redundantne mocki

---

## AGENT 5: TypeScript & Cleanup (39 plików + cleanup)

**Priorytet:** 🟠 WAŻNY
**Czas:** 2-3 dni

### Zadania:

1. **Naprawić 766 błędów TypeScript** w server/src/
2. **Wyczyścić setup.ts** - usunąć niepotrzebne globalne mocki
3. **Naprawić 9 failujących testów**
4. **Uruchomić E2E testy** i naprawić błędy

### Pliki TypeScript do naprawy:

```
server/src/ai/*.ts (9 plików)
server/src/controllers/*.ts (4 pliki)
server/src/database/*.ts (3 pliki)
server/src/middleware/*.ts (5 plików)
server/src/routes/*.ts (11 plików)
server/src/services/*.ts (6 plików)
```

### Checklist:

- [ ] Naprawić błędy TS (nie używać `any`!)
- [ ] Wyczyścić setup.ts z niepotrzebnych mocków
- [ ] Naprawić 9 failujących plików
- [ ] Uruchomić i naprawić E2E

---

# 🔧 TECHNICZNE INSTRUKCJE

## Jak przepisać test z mocka na prawdziwy:

### PRZED (fałszywy):

```javascript
vi.mock('../../../server/src/services/ProjectService.js', () => ({
  default: {
    create: vi.fn().mockResolvedValue({ id: '123', name: 'Test' }),
    getById: vi.fn().mockResolvedValue({ id: '123', name: 'Test' }),
  },
}));

it('should create project', async () => {
  const result = await ProjectService.create({ name: 'Test' });
  expect(result.id).toBe('123'); // ❌ Testuje mock!
});
```

### PO (prawdziwy):

```javascript
vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  process.env.SQLITE_PATH = `./test-project-${process.env.VITEST_WORKER_ID || '0'}.db`;
});

import ProjectService from '../../../server/src/services/ProjectService.js';
import { getDatabase } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

describe('ProjectService', () => {
  const db = getDatabase();
  let testOrgId;

  beforeAll(async () => {
    await initializeDatabase();
    testOrgId = uuidv4();
    await db.run('INSERT INTO organizations (id, name) VALUES (?, ?)', [testOrgId, 'Test']);
  });

  afterAll(async () => {
    await db.run('DELETE FROM organizations WHERE id = ?', [testOrgId]);
  });

  it('should create project in database', async () => {
    const result = await ProjectService.create({
      name: 'Test Project',
      organizationId: testOrgId,
    });

    expect(result.id).toBeDefined();

    // ✅ Weryfikacja w bazie!
    const dbProject = await new Promise((resolve) => {
      db.get('SELECT * FROM projects WHERE id = ?', [result.id], (_, row) => resolve(row));
    });

    expect(dbProject).toBeDefined();
    expect(dbProject.name).toBe('Test Project');

    // Cleanup
    await db.run('DELETE FROM projects WHERE id = ?', [result.id]);
  });
});
```

---

# 📊 HARMONOGRAM

## Tydzień 1:

- **Dzień 1-2:** Agent 5 - TypeScript errors + cleanup
- **Dzień 3-4:** Agent 1 - Auth & Security (start)
- **Dzień 5:** Agent 2 - Backend Services (start)

## Tydzień 2:

- **Dzień 1-3:** Agent 1 + Agent 2 (kontynuacja)
- **Dzień 4-5:** Agent 3 - Integration (start)

## Tydzień 3:

- **Dzień 1-3:** Agent 3 + Agent 4 - Components
- **Dzień 4-5:** Code review + E2E testy

## Tydzień 4:

- **Dzień 1-3:** Poprawki po review
- **Dzień 4-5:** Finalny coverage check + dokumentacja

---

# ✅ DEFINITION OF DONE

Test jest "naprawiony" gdy:

1. ✅ `MOCK_DB='false'` dla testów backend/integration
2. ✅ Importuje PRAWDZIWY serwis/komponent
3. ✅ NIE ma `mockResolvedValue` dla własnego kodu
4. ✅ Weryfikuje wynik w bazie danych (dla backend)
5. ✅ Cleanup po sobie (usuwa dane testowe)
6. ✅ Przechodzi w izolacji (`npm run test -- path/to/test.js`)
7. ✅ Nie używa `any` w TypeScript

---

# 🎯 METRYKI KOŃCOWE

| Metryka           | Cel  | Jak mierzyć                     |
| ----------------- | ---- | ------------------------------- |
| Pass Rate         | 100% | `npm run test:all`              |
| Code Coverage     | 80%+ | `npm run test:coverage`         |
| Real Tests        | 70%+ | Liczba plików z `MOCK_DB=false` |
| TypeScript Errors | 0    | `npm run type-check`            |
| E2E Pass Rate     | 100% | `npm run test:e2e`              |

---

# 📞 ESKALACJA

Jeśli agent napotka problem:

1. Sprawdź czy podobny test już istnieje (wzorzec)
2. Sprawdź dokumentację serwisu (`server/src/services/`)
3. Sprawdź schemat bazy (`server/src/database/schema/`)
4. Oznacz jako `it.todo()` i kontynuuj
5. Zgłoś w daily standup

---

**ZATWIERDZIŁ:** [Twój podpis]
**DATA:** 2026-01-08
