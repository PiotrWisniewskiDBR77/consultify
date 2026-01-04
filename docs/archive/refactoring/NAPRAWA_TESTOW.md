# Wielopoziomowy Plan Naprawy Testów (Multi-Agent Test Repair Plan)

**Cel:** Osiągnięcie 98% zdawalności testów i 95% pokrycia kodu.
**Strategia:** Równoległa naprawa przez niezależnych agentów (Missions).

Dokument ten dzieli prace naprawcze na niezależne pakiety (Misje), które mogą być realizowane równolegle przez różnych agentów.

---

## 🏗️ MISJA 1: Fundamenty i Infrastruktura (Infrastructure & Mocks)
**Cel:** Naprawa środowiska testowego, mrugania testów (flakiness) i problemów z importami (ESM/CJS).
**Priorytet:** KRYTYCZNY (Brak realizacji blokuje inne misje)

### Zadania:
1.  **Naprawa Interop ESM/CJS w Backendzie**
    *   **Problem:** Błędy `require() cannot be used on an ESM graph` w `aiPipeline.js` i `modelRouter.js`.
    *   **Akcja:** Zamiana wszystkich `require()` na dynamiczne `import()` lub statyczne importy w serwisach AI.
    *   **Pliki:** `server/services/ai/*.js`, `tests/unit/backend/aiPipeline.test.js`.
2.  **Standaryzacja Mockowania Bazy (`mockDb`)**
    *   **Problem:** Niespójne zachowanie `mockDb` w testach middleware vs context builder.
    *   **Akcja:** Weryfikacja `tests/setup.ts` i zapewnienie, że `resetModules` działa poprawnie między testami.
3.  **Globalne Wrappery Frontendowe**
    *   **Problem:** Testy komponentów padają z braku `ThemeProvider`, `StoreProvider` lub `i18n`.
    *   **Akcja:** Aktualizacja `tests/test-utils.tsx` (lub `setup.ts` dla frontu) o brakujące providery w globalnym wrapperze.

---

## 🛡️ MISJA 2: Backend Compliance & Logic (Guardrails)
**Cel:** Naprawa logiki biznesowej i testów middleware.
**Zależność:** Wymaga stabilnej infrastruktury (Misja 1).

### Zadania:
1.  **Naprawa Middleware Limitów (`planLimits`)**
    *   **Problem:** Testy `should check max_members limit` padają (6/8 fail). Logika nie odróżnia poprawnie planu Free/Pro w mocku.
    *   **Akcja:** Debug logiki `server/middleware/planLimits.js` i dopasowanie mocków w `tests/unit/backend/middleware/planLimits.test.js`.
2.  **Weryfikacja Struktur API (Integration Check)**
    *   **Problem:** Niezgodność schematów odpowiedzi w testach integracyjnych.
    *   **Akcja:** Przejście przez `tests/integration/*.test.ts` i aktualizacja asercji do obecnego kształtu API (np. brakujące pola w `task`).

---

## 🖥️ MISJA 3: Frontend Stability (UI Components)
**Cel:** Stabilizacja testów komponentów React.
**Niezależność:** Może byc realizowana niezależnie od Backendu.

### Zadania:
1.  **Naprawa `TaskInbox` i Komponentów Pracy**
    *   **Problem:** 2/5 testów pada w `TaskInbox.test.tsx`.
    *   **Akcja:** Poprawa selektorów (użycie `getByRole` zamiast klas), mockowanie hooków `useTasks` i `useAppStore`.
2.  **Pokrycie Testami Nowych Komponentów**
    *   **Cel:** Dobicie pokrycia do 95%.
    *   **Akcja:** Dodanie testów dla `components/settings/AISettings.tsx` oraz `TaskDropdown.tsx`.

---

## 🚀 MISJA 4: Performance & Security Gates
**Cel:** Ustawienie baseline wydajności i bezpieczeństwa.

### Zadania:
1.  **Baseline Wydajności (k6)**
    *   **Problem:** Brak ustalonych progów (thresholds) dla endpointów.
    *   **Akcja:** Uruchomienie `tests/performance/load-test.js`, zebranie wyników, wpisanie ich jako sztywne progi w `tests/performance/thresholds.json` (do utworzenia).
2.  **Skan Bezpieczeństwa (Security Audit)**
    *   **Akcja:** Uruchomienie `npm run test:security` i naprawa zinhalowanych podatności w `package.json` (npm audit fix).

---

## Instrukcja dla Agentów
1.  **Wybierz Misję:** Pobierz jeden z powyższych pakietów.
2.  **Wykonaj:** Napraw kod i testy w danym obszarze.
3.  **Weryfikuj:** Uruchom tylko testy ze swojego obszaru (np. `npx vitest tests/unit/backend/middleware` dla Misji 2).
4.  **Raportuj:** Zgłoś status wykonania i ewentualne blokery.
