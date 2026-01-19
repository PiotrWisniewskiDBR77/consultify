# 📝 SZABLONY PROMPTÓW DLA AGENTÓW

## Instrukcja użycia:
Skopiuj odpowiedni prompt i wklej do nowego agenta.

---

# 🔐 AGENT 1: Auth & Security

```
Jesteś Agent 1 odpowiedzialny za naprawę testów Auth & Security.

## TWOJE ZADANIE:
Przepisz 42 pliki testowe z mocków na PRAWDZIWE testy z bazą danych.

## PLIKI DO NAPRAWY:
- tests/auth/*.test.js (5 plików)
- tests/security/*.test.js (17 plików)
- tests/unit/backend/middleware/*.test.js (20 plików)

## WZORZEC (kopiuj do każdego pliku):
vi.hoisted(() => {
    process.env.MOCK_DB = 'false';
    process.env.SQLITE_PATH = `./test-auth-${process.env.VITEST_WORKER_ID || '0'}.db`;
});

## ZASADY:
1. NIE mockuj własnych serwisów - importuj prawdziwe
2. Weryfikuj wyniki w bazie danych
3. Cleanup po każdym teście
4. Testuj prawdziwe scenariusze (SQL injection, XSS, rate limiting)

## WZORCOWY PLIK:
tests/integration/auth.test.js

## DOKUMENTACJA:
docs/test-repair-tasks/AGENT-1-AUTH-SECURITY.md

## WERYFIKACJA:
npm run test:unit -- tests/auth/
npm run test:unit -- tests/security/
npm run test:unit -- tests/unit/backend/middleware/

## CEL:
- 100% testów przechodzi
- Każdy test używa prawdziwej bazy
- Każdy test weryfikuje wynik w bazie
```

---

# 🖥️ AGENT 2: Backend Services

```
Jesteś Agent 2 odpowiedzialny za naprawę testów Backend Services.

## TWOJE ZADANIE:
Przepisz 63 pliki testowe serwisów z mocków na PRAWDZIWE testy.

## PLIKI DO NAPRAWY:
- tests/unit/backend/*.test.js (60 plików)
- tests/unit/backend/utils/*.test.ts (3 pliki)

## WZORZEC (kopiuj do każdego pliku):
vi.hoisted(() => {
    process.env.MOCK_DB = 'false';
    process.env.SQLITE_PATH = `./test-backend-${process.env.VITEST_WORKER_ID || '0'}.db`;
});

import ServiceName from '../../../server/src/services/ServiceName.js';
import { getDatabase } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

## ZASADY:
1. NIE używaj mockResolvedValue dla własnych serwisów
2. Importuj PRAWDZIWY serwis
3. Weryfikuj CRUD w bazie danych
4. Testuj error handling (brak danych, nieprawidłowe dane)

## WZORCOWY PLIK:
tests/unit/backend/taskService.test.js

## DOKUMENTACJA:
docs/test-repair-tasks/AGENT-2-BACKEND-API.md

## WERYFIKACJA:
npm run test:backend

## CEL:
- 100% testów przechodzi
- Każdy test importuje prawdziwy serwis
- Każdy test weryfikuje wynik w bazie
```

---

# 🔄 AGENT 3: Integration Tests

```
Jesteś Agent 3 odpowiedzialny za naprawę testów integracyjnych.

## TWOJE ZADANIE:
Przepisz 80+ plików testów integracyjnych na prawdziwe HTTP requesty.

## PLIKI DO NAPRAWY:
- tests/integration/*.test.js (46 plików)
- tests/integration/routes/*.test.js (34 pliki)

## WZORZEC (kopiuj do każdego pliku):
vi.hoisted(() => {
    process.env.MOCK_DB = 'false';
    process.env.SQLITE_PATH = `./test-integration-${process.env.VITEST_WORKER_ID || '0'}.db`;
});

import request from 'supertest';
import app from '../../server/src/index.js';
import { getDatabase } from '../../server/src/database/Database.js';

## ZASADY:
1. Używaj supertest do prawdziwych HTTP requestów
2. Loguj się i używaj prawdziwego tokenu
3. Testuj pełne flow: auth → action → verify
4. Testuj error codes: 401, 403, 404, 500

## WZORCOWY PLIK:
tests/integration/auth.test.js

## DOKUMENTACJA:
docs/test-repair-tasks/AGENT-3-INTEGRATION.md

## WERYFIKACJA:
npm run test:integration

## CEL:
- 100% testów przechodzi
- Każdy test robi prawdziwe HTTP requesty
- Każdy test testuje pełny flow
```

---

# 🧩 AGENT 4: Component Tests

```
Jesteś Agent 4 odpowiedzialny za naprawę testów komponentów React.

## TWOJE ZADANIE:
Sprawdź i napraw 80+ plików testów komponentów.

## PLIKI DO NAPRAWY:
- tests/components/*.test.tsx (60+ plików)
- tests/components/*/*.test.tsx (podkatalogi)

## ZASADY DLA KOMPONENTÓW:
1. ZAWSZE importuj PRAWDZIWY komponent (nie mock)
2. Możesz mockować:
   - API calls (vi.mock('@/services/api'))
   - Router (MemoryRouter)
   - Zewnętrzne biblioteki (framer-motion)
3. NIE mockuj:
   - Samego komponentu który testujesz
   - Child komponentów (chyba że są bardzo złożone)

## WZORZEC:
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentName } from '@/components/ComponentName'; // ✅ Prawdziwy!

## CO TESTOWAĆ:
1. Renderowanie (czy się wyświetla)
2. Props (różne warianty)
3. Interakcję (click, input, submit)
4. Stan (loading, error, success)
5. Accessibility (aria-labels, roles)

## DOKUMENTACJA:
docs/test-repair-tasks/AGENT-4-UNIT-COMPONENTS.md

## WERYFIKACJA:
npm run test:component

## CEL:
- 100% testów przechodzi
- Każdy test importuje prawdziwy komponent
- Każdy test ma sensowne asercje
```

---

# 🚨 AGENT 5: TypeScript & Cleanup

```
Jesteś Agent 5 odpowiedzialny za naprawę błędów TypeScript i cleanup.

## TWOJE ZADANIA:
1. Napraw 766 błędów TypeScript w server/src/
2. Wyczyść setup.ts z niepotrzebnych mocków
3. Napraw 9 failujących plików testowych
4. Uruchom i napraw E2E testy

## PLIKI TS DO NAPRAWY:
- server/src/ai/*.ts (9 plików)
- server/src/controllers/*.ts (4 pliki)
- server/src/database/*.ts (3 pliki)
- server/src/middleware/*.ts (5 plików)
- server/src/routes/*.ts (11 plików)
- server/src/services/*.ts (6 plików)

## ZASADY TS:
1. NIE używaj `any` - twórz interfejsy
2. Dla `unknown` używaj type guards lub asercji
3. Dla db.get/db.run dodaj typy generyczne

## CLEANUP setup.ts:
1. Usuń niepotrzebne globalne mocki
2. Zostaw tylko:
   - react-i18next (tłumaczenia)
   - react-hot-toast (notyfikacje)
   - Zewnętrzne API (OpenAI, Google AI)
3. NIE mockuj globalnie:
   - Database
   - Api service
   - Własnych serwisów

## DOKUMENTACJA:
docs/test-repair-tasks/AGENT-5-TYPESCRIPT-CRITICAL.md

## WERYFIKACJA:
npm run type-check
npm run test:e2e

## CEL:
- 0 błędów TypeScript
- setup.ts bez zbędnych mocków
- 100% E2E przechodzi
```

---

# 📋 INSTRUKCJA DLA AGENTA

## Rozpoczęcie pracy:
1. Przeczytaj swoją dokumentację w `docs/test-repair-tasks/`
2. Przeczytaj `docs/TESTS_AUDIT_REPORT.md`
3. Przeczytaj `docs/TESTS_REPAIR_PLAN.md`
4. Zacznij od pierwszego pliku na liście

## Podczas pracy:
1. Przepisz jeden plik na raz
2. Uruchom test: `npm run test:unit -- path/to/file.test.js`
3. Upewnij się że przechodzi
4. Przejdź do następnego pliku

## Po zakończeniu:
1. Uruchom wszystkie swoje testy
2. Zgłoś wyniki: ile naprawione, ile pozostało
3. Oznacz jako `it.todo()` testy których nie udało się naprawić

## Jeśli masz problem:
1. Sprawdź wzorcowy plik
2. Sprawdź dokumentację serwisu
3. Oznacz jako `it.todo()` i przejdź dalej
```

---

**Ostatnia aktualizacja:** 2026-01-08
