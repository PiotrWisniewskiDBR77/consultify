# 🤖 Instrukcja dla Agenta Naprawy Testów

## ⚡ KONFIGURACJA AGENTA

**Jestem Agentem nr: [WPISZ NUMER 1-5]**

---

## 📋 Twoja Misja

Jesteś jednym z 5 agentów odpowiedzialnych za naprawę i uzupełnienie testów w projekcie Consultinity.

**Cel:** Uzupełnić ~317 brakujących/uszkodzonych testów do 95%+ pokrycia.

### Przydział Agentów

| Agent       | Domena            | Plik z zadaniami                 | Priorytet    |
| ----------- | ----------------- | -------------------------------- | ------------ |
| **Agent 1** | Auth & Security   | `AGENT-1-AUTH-SECURITY.md`       | 🔴 KRYTYCZNY |
| **Agent 2** | Backend & API     | `AGENT-2-BACKEND-API.md`         | 🔴 KRYTYCZNY |
| **Agent 3** | Integration Tests | `AGENT-3-INTEGRATION.md`         | 🟠 WYSOKI    |
| **Agent 4** | Unit & Components | `AGENT-4-UNIT-COMPONENTS.md`     | 🟡 ŚREDNI    |
| **Agent 5** | TypeScript Errors | `AGENT-5-TYPESCRIPT-CRITICAL.md` | 🔴 KRYTYCZNY |

---

## 🚀 Rozpoczęcie Pracy

### Krok 1: Wczytaj swój plik zadań

```
Przeczytaj plik: docs/test-repair-tasks/AGENT-[TWÓJ-NUMER]-*.md
```

### Krok 2: Zapoznaj się z kontekstem projektu

- **Struktura testów:** `tests/`
- **Backend:** `server/src/`
- **Frontend:** `src/`
- **Typy:** `src/types/`, `server/src/types/`
- **Baza danych:** SQLite (schemat w `server/src/database/schema/`)

### Krok 3: Wykonuj zadania systematycznie

1. Otwórz pierwszy plik z listy w swoim dokumencie
2. Zidentyfikuj problem (fałszywa asercja, brak testu, błąd importu)
3. Napraw według wzorca z dokumentu
4. Uruchom test: `npm run test -- [ścieżka-do-pliku]`
5. Przejdź do następnego pliku

---

## 📜 Zasady Obowiązujące WSZYSTKICH Agentów

### ✅ MUSISZ

1. **Używać prawdziwej bazy danych** w testach (nie mocków gdzie to możliwe)
2. **Testować rzeczywiste zachowanie** - nie `expect(true).toBe(true)`
3. **Czyścić dane** po każdym teście (afterEach/afterAll)
4. **Używać unikalnych ID** dla danych testowych (uuid)
5. **Zachować istniejącą strukturę** plików i katalogów

### ❌ NIE MOŻESZ

1. **Tworzyć duplikatów plików** (np. `Component 2.tsx`)
2. **Używać `any`** jako rozwiązania błędów TypeScript
3. **Zostawiać fałszywych asercji** typu `expect(401).toBe(401)`
4. **Modyfikować działającego kodu produkcyjnego** bez uzasadnienia
5. **Pomijać obsługi błędów** w testach

### ⚠️ Wzorzec `expect(true).toBe(false)` jest POPRAWNY gdy:

```javascript
// ✅ POPRAWNE - testuje że kod MUSI rzucić wyjątek
try {
  await dangerousOperation();
  expect(true).toBe(false); // Fail jeśli nie rzuci
} catch (error) {
  expect(error).toBeDefined();
}
```

### 🧹 Cleanup przed pracą

W katalogach `tests/auth/` i `tests/security/` są duplikaty plików z sufiksem " 2".
**Agent 1** powinien je usunąć na początku pracy.

---

## 🛠️ Wspólne Wzorce

### Setup testu z bazą danych

```javascript
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getDatabase } from '../../server/src/database/Database.js';
import { initializeDatabase } from '../../server/src/database/DatabaseInitializer.js';
import { v4 as uuidv4 } from 'uuid';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-${workerId}.db`;
});

describe('MyFeature', () => {
  const db = getDatabase();
  let testOrgId;

  beforeAll(async () => {
    await initializeDatabase();
    testOrgId = uuidv4();
    // Setup test data...
  });

  afterAll(async () => {
    // Cleanup test data...
  });

  it('should do something real', async () => {
    // Real test logic
  });
});
```

### Test komponentu React

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return ({ children }) => (
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>{children}</BrowserRouter>
        </QueryClientProvider>
    );
};

describe('MyComponent', () => {
    it('should render and respond to interaction', async () => {
        render(<MyComponent />, { wrapper: createWrapper() });

        expect(screen.getByRole('button')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button'));

        await waitFor(() => {
            expect(screen.getByText('Success')).toBeVisible();
        });
    });
});
```

### Test API endpoint

```javascript
import request from 'supertest';
import app from '../../server/src/index.js';

describe('POST /api/resource', () => {
  it('should create resource', async () => {
    const response = await request(app)
      .post('/api/resource')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ name: 'Test' });

    expect(response.status).toBe(201);
    expect(response.body.resource.name).toBe('Test');
  });

  it('should reject without auth', async () => {
    const response = await request(app).post('/api/resource').send({ name: 'Test' });

    expect([401, 403]).toContain(response.status);
  });
});
```

---

## ✅ Weryfikacja Pracy

### Po każdym pliku

```bash
npm run test -- [ścieżka-do-pliku]
```

### Po zakończeniu wszystkich plików

```bash
# Agent 1-4:
npm run test:all

# Agent 5:
npm run type-check
npm run build
```

### Raportowanie postępu

Po zakończeniu pracy, zgłoś:

1. Ile plików naprawiłeś
2. Ile testów dodałeś/naprawiłeś
3. Jakie problemy napotkałeś
4. Co wymaga dalszej pracy

---

## 📂 Lokalizacje Kluczowe

| Zasób           | Ścieżka                           |
| --------------- | --------------------------------- |
| Testy           | `tests/`                          |
| Komponenty      | `src/components/`                 |
| Hooki           | `src/hooks/`                      |
| Store           | `src/store/`                      |
| Serwisy Backend | `server/src/services/`            |
| Kontrolery      | `server/src/controllers/`         |
| Routes          | `server/src/routes/`              |
| Middleware      | `server/src/middleware/`          |
| Typy            | `src/types/`, `server/src/types/` |
| Helpers testowe | `tests/helpers/`                  |
| Setup testów    | `tests/setup.ts`                  |

---

## 🆘 Pomoc

Jeśli napotkasz problem:

1. **Błąd importu** → Sprawdź czy plik istnieje: `find src -name "FileName*"`
2. **Błąd bazy** → Upewnij się że `initializeDatabase()` jest wywołane
3. **Błąd TypeScript** → Dodaj typ lub interfejs, nie używaj `any`
4. **Test zawiesza się** → Sprawdź czy wszystkie Promise są resolved
5. **Brak modułu** → Sprawdź `package.json` i uruchom `npm install`

---

## 🎯 Rozpocznij Pracę!

1. **Wpisz swój numer agenta** na górze tego dokumentu
2. **Przeczytaj swój plik zadań** z `docs/test-repair-tasks/`
3. **Zacznij od pierwszego pliku** na liście
4. **Systematycznie naprawiaj** każdy test
5. **Weryfikuj** po każdym pliku

**Powodzenia! 🚀**
