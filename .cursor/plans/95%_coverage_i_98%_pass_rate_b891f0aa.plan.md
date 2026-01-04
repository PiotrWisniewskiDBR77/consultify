---
name: 95% Coverage i 98% Pass Rate
overview: Plan systematycznego zwiększenia pokrycia testami do 95% i pass rate do 98% poprzez naprawę 193 nieprzechodzących testów, redukcję flaky tests i uzupełnienie brakujących testów.
todos:
  - id: fix-i18n-errors
    content: Naprawić 21 testów z błędami i18n - NAPRAWIONO (helpSearchService.ts + testy)
    status: completed
  - id: fix-db-errors
    content: Naprawić 30 testów z błędami bazy danych - NAPRAWIONO (~26 testów, dodano tabele/kolumny do setup.ts)
    status: completed
  - id: fix-status-codes
    content: Naprawić 6 testów z błędami status codes - NAPRAWIONO (helpFeedback.test.js)
    status: completed
  - id: fix-experiment-status
    content: Naprawić 7 testów z błędami experiment status (wymaga refaktora async/callback w abTesting.js)
    status: completed
  - id: fix-race-conditions
    content: Naprawić 25 testów z race conditions (dodać await, waitFor)
    status: in_progress
    dependencies:
      - fix-i18n-errors
      - fix-db-errors
  - id: fix-timing-issues
    content: Naprawić 20 testów z timing issues (vi.useFakeTimers, właściwe delays)
    status: pending
    dependencies:
      - fix-race-conditions
  - id: fix-db-isolation
    content: Naprawić 15 testów z database isolation (cleanup przed/po testach)
    status: pending
    dependencies:
      - fix-db-errors
  - id: extend-superadmin-components
    content: Rozszerzyć testy komponentów SuperAdmin (edge cases, error handling, loading states)
    status: pending
    dependencies:
      - fix-i18n-errors
  - id: create-superadmin-integration
    content: Utworzyć testy integracyjne dla SuperAdmin routes (8 plików testowych)
    status: pending
    dependencies:
      - fix-db-errors
      - fix-status-codes
  - id: create-superadmin-e2e
    content: Utworzyć testy E2E dla SuperAdmin flows (5 plików testowych)
    status: pending
    dependencies:
      - extend-superadmin-components
  - id: fill-missing-tests
    content: Uzupełnić brakujące testy dla komponentów i routes (~70 testów)
    status: pending
    dependencies:
      - extend-superadmin-components
      - create-superadmin-integration
  - id: optimize-tests
    content: Zoptymalizować testy (usunąć duplikacje, poprawić wydajność)
    status: pending
    dependencies:
      - fill-missing-tests
  - id: final-verification
    content: "Finalna weryfikacja: pass rate ≥98%, pokrycie ≥95%, stabilność 3x"
    status: pending
    dependencies:
      - optimize-tests
      - create-superadmin-e2e
---

# Plan dojścia do 95% pokrycia testami i 98% pass rate

## Status początkowy

- **Pass rate**: 91.0% (2496/2741 testów przechodzi)
- **Nieprzechodzące testy**: 193 (7.0%)
- **Pokrycie**: ~85% (cel: 95%)
- **Flaky tests**: ~7% (cel: <1%)

## Status aktualny (po sesji naprawczej)

- **Pass rate**: 92.3% (2531/2741 testów przechodzi)
- **Nieprzechodzące testy**: 158 (5.8%)
- **Naprawiono**: 35 testów

### Wykonane naprawy:
1. ✅ **Błędy i18n** - Naprawiono 20+ testów poprzez aktualizację `helpSearchService.ts` i `helpSearchService.test.ts`
2. ✅ **Błędy bazy danych** - Naprawiono ~26 testów poprzez dodanie brakujących tabel i kolumn do `tests/setup.ts`
3. ✅ **Błędy status codes** - Naprawiono 6 testów w `helpFeedback.test.js`

## Cel końcowy

- **Pass rate**: ≥98% (≥2680/2733 testów)
- **Pokrycie**: ≥95% na wszystkich poziomach
- **Flaky tests**: <1% (<27 testów)

---

## Faza 1: Naprawa krytycznych błędów (Pass rate: 91% → 96%)

### 1.1 Naprawa błędów i18n (21 testów) - Wysoki priorytet

**Problem**: `Cannot read properties of undefined (reading 'en')`**Pliki do naprawy**:

- `tests/components/**/*.test.tsx` - wszystkie komponenty używające i18n
- `tests/setup.ts` - upewnić się, że mock i18n jest poprawny

**Działania**:

1. Sprawdzić mock `react-i18next` w `tests/setup.ts`
2. Dodać domyślne wartości dla wszystkich kluczy tłumaczeń
3. Naprawić wszystkie testy komponentów, które używają `useTranslation()`

### 1.2 Naprawa błędów bazy danych (30 testów) - Wysoki priorytet

**Problem**: `SQLITE_ERROR: no such column: forecast_amount` i inne schema errors**Pliki do naprawy**:

- `tests/setup.ts` - upewnić się, że wszystkie tabele są tworzone
- `tests/helpers/dbHelper.cjs` - sprawdzić schema migrations
- `tests/unit/backend/**/*.test.js` - testy używające nieistniejących kolumn

**Działania**:

1. Zidentyfikować wszystkie brakujące kolumny w schema
2. Dodać CREATE TABLE statements w `tests/setup.ts`
3. Naprawić testy używające nieistniejących kolumn

### 1.3 Naprawa błędów status codes (6 testów) - Średni priorytet

**Problem**: `expected 400 to be 201`**Pliki do naprawy**:

- `tests/integration/routes/**/*.test.js` - testy API routes

**Działania**:

1. Sprawdzić oczekiwane status codes w testach
2. Poprawić walidację w routes lub oczekiwania w testach

### 1.4 Naprawa błędów experiment status (7 testów) - Średni priorytet

**Problem**: `Cannot start experiment with status: undefined`**Pliki do naprawy**:

- `tests/unit/backend/**/*experiment*.test.js`
- `tests/integration/**/*experiment*.test.js`

**Działania**:

1. Dodać domyślne wartości status w testach
2. Sprawdzić walidację w serwisach

---

## Faza 2: Redukcja flaky tests (Pass rate: 96% → 97%)

### 2.1 Naprawa race conditions w async testach (25 testów)

**Pliki do naprawy**:

- `tests/unit/backend/**/*.test.js` - testy async
- `tests/integration/**/*.test.js` - testy API

**Działania**:

1. Dodać `await` dla wszystkich promises
2. Użyć `waitFor` z `@testing-library/react` dla komponentów
3. Dodać właściwe timeouts

### 2.2 Naprawa timing issues (20 testów)

**Pliki do naprawy**:

- `tests/components/**/*.test.tsx` - testy komponentów z timers
- `tests/e2e/**/*.spec.ts` - testy E2E

**Działania**:

1. Użyć `vi.useFakeTimers()` dla testów z timers
2. Dodać właściwe delays w testach E2E
3. Poprawić Playwright waits/timeouts

### 2.3 Naprawa database isolation (15 testów)

**Pliki do naprawy**:

- `tests/unit/backend/**/*.test.js` - wszystkie testy backendowe

**Działania**:

1. Upewnić się, że każdy test czyści dane przed i po
2. Użyć `beforeEach` i `afterEach` dla cleanup
3. Sprawdzić, że testy nie wpływają na siebie

---

## Faza 3: Uzupełnienie testów SuperAdmin (Pokrycie: 75% → 95%)

### 3.1 Rozszerzenie testów komponentów SuperAdmin

**Pliki do modyfikacji**:

- `tests/components/SuperAdmin/OverviewModule.test.tsx` - dodać edge cases, error handling
- `tests/components/SuperAdmin/CustomersModule.test.tsx` - dodać badge updates, error handling
- `tests/components/SuperAdmin/AIPlatformModule.test.tsx` - dodać error states
- `tests/components/SuperAdmin/SystemModule.test.tsx` - dodać loading states
- `tests/components/SuperAdmin/ContentModule.test.tsx` - dodać empty states
- `tests/components/SuperAdmin/RevenueModule.test.tsx` - dodać error handling
- `tests/components/SuperAdmin/SecurityModule.test.tsx` - dodać edge cases
- `tests/components/SuperAdmin/ConfigurationModule.test.tsx` - dodać validation tests
- `tests/components/layout/SuperAdminSidebar.test.tsx` - dodać hover, badge updates, pin/unpin

**Działania**:

1. Dodać testy dla wszystkich edge cases
2. Dodać testy error handling
3. Dodać testy loading/empty states
4. Dodać testy interakcji użytkownika

### 3.2 Utworzenie testów integracyjnych SuperAdmin Routes

**Pliki do utworzenia**:

- `tests/integration/routes/superadmin-overview.test.js` - GET /api/superadmin/dashboard
- `tests/integration/routes/superadmin-customers.test.js` - CRUD organizacji, użytkowników
- `tests/integration/routes/superadmin-ai-platform.test.js` - LLM config, intelligence
- `tests/integration/routes/superadmin-system.test.js` - health, audit log, feature flags
- `tests/integration/routes/superadmin-content.test.js` - playbooks, email templates
- `tests/integration/routes/superadmin-revenue.test.js` - billing, invoices, usage
- `tests/integration/routes/superadmin-security.test.js` - SSO, policies, API keys
- `tests/integration/routes/superadmin-configuration.test.js` - settings, whitelabel, legal

**Działania**:

1. Utworzyć testy dla wszystkich SuperAdmin routes
2. Przetestować CRUD operations
3. Przetestować error handling
4. Przetestować authentication/authorization

### 3.3 Utworzenie testów E2E SuperAdmin

**Pliki do utworzenia**:

- `tests/e2e/superadmin-navigation.spec.ts` - nawigacja między modułami
- `tests/e2e/superadmin-customers.spec.ts` - zarządzanie klientami
- `tests/e2e/superadmin-ai-platform.spec.ts` - konfiguracja AI
- `tests/e2e/superadmin-system.spec.ts` - monitoring systemu
- `tests/e2e/superadmin-revenue.spec.ts` - zarządzanie przychodami

**Działania**:

1. Utworzyć testy E2E dla wszystkich SuperAdmin flows
2. Przetestować critical user paths
3. Przetestować error scenarios

---

## Faza 4: Finalizacja i optymalizacja (Pass rate: 97% → 98%, Pokrycie: 90% → 95%)

### 4.1 Uzupełnienie brakujących testów

**Obszary do uzupełnienia**:

- Komponenty bez testów (szacunkowo ~50 komponentów)
- API routes bez testów (szacunkowo ~20 routes)
- Edge cases w istniejących testach

**Działania**:

1. Zidentyfikować wszystkie komponenty bez testów
2. Utworzyć podstawowe testy dla brakujących komponentów
3. Uzupełnić edge cases w istniejących testach

### 4.2 Optymalizacja testów

**Pliki do optymalizacji**:

- `vitest.config.ts` - sprawdzić konfigurację
- `tests/setup.ts` - zoptymalizować setup
- Wszystkie testy - usunąć duplikacje

**Działania**:

1. Zoptymalizować czas wykonania testów
2. Usunąć duplikacje w testach
3. Poprawić organizację testów

### 4.3 Finalna weryfikacja

**Działania**:

1. Uruchomić wszystkie testy 3x pod rząd
2. Sprawdzić pokrycie dla wszystkich poziomów
3. Zweryfikować, że pass rate ≥98%
4. Zweryfikować, że pokrycie ≥95%
5. Zaktualizować dokumentację

---

## Harmonogram

### Tydzień 1: Naprawa krytycznych błędów (91% → 96%)

- **Dzień 1-2**: Naprawa błędów i18n (21 testów)
- **Dzień 3-4**: Naprawa błędów bazy danych (30 testów)
- **Dzień 5**: Naprawa błędów status codes i experiment status (13 testów)
- **Dzień 6-7**: Weryfikacja i stabilizacja

### Tydzień 2: Redukcja flaky tests (96% → 97%)

- **Dzień 1-2**: Naprawa race conditions (25 testów)
- **Dzień 3**: Naprawa timing issues (20 testów)
- **Dzień 4**: Naprawa database isolation (15 testów)
- **Dzień 5-7**: Weryfikacja i stabilizacja

### Tydzień 3: Uzupełnienie testów SuperAdmin (75% → 95%)

- **Dzień 1-2**: Rozszerzenie testów komponentów SuperAdmin
- **Dzień 3-4**: Utworzenie testów integracyjnych SuperAdmin Routes
- **Dzień 5**: Utworzenie testów E2E SuperAdmin
- **Dzień 6-7**: Weryfikacja pokrycia SuperAdmin

### Tydzień 4: Finalizacja (97% → 98%, 90% → 95%)

- **Dzień 1-3**: Uzupełnienie brakujących testów
- **Dzień 4**: Optymalizacja testów
- **Dzień 5-7**: Finalna weryfikacja i dokumentacja

---

## Metryki sukcesu

### Przed rozpoczęciem:

- Pass rate: 91.0% (2496/2741)
- Pokrycie: ~85%
- Flaky tests: ~7% (193 testy)

### Po zakończeniu:

- Pass rate: ≥98% (≥2680/2733)
- Pokrycie: ≥95% na wszystkich poziomach
- Flaky tests: <1% (<27 testów)
- Stabilność: Wszystkie testy przechodzą 3x pod rząd

---

## Zasoby

### Kluczowe pliki:

- `tests/setup.ts` - global test setup
- `vitest.config.ts` - test configuration
- `tests/helpers/dbHelper.cjs` - database helper
- `tests/components/SuperAdmin/` - SuperAdmin component tests
- `tests/integration/routes/` - integration tests
- `tests/e2e/` - E2E tests

### Dokumentacja: