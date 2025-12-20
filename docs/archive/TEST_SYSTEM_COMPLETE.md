# Kompletny System Testów - 5 Poziomów

## 📊 Przegląd Architektury

System testów został zorganizowany w 5 poziomach zgodnie z piramidą testowania:

```
        /\
       /E2E\          Poziom 4: E2E Tests (Playwright)
      /------\
     /Component\      Poziom 3: Component Tests (React Testing Library)
    /------------\
   / Integration \    Poziom 2: Integration Tests (Vitest + Supertest)
  /----------------\
 /    Unit Tests    \  Poziom 1: Unit Tests (Vitest)
/--------------------\
\ Performance Tests /  Poziom 5: Performance/Stress Tests
```

---

## Poziom 1: Unit Tests (Testy Jednostkowe)

### Backend Services
✅ **13 testów** - wszystkie używają prawdziwej bazy danych (SQLite in-memory)

- `activityService.test.js` - logowanie aktywności
- `aiService.test.js` - serwis AI (z mockami dla LLM)
- `analyticsService.test.js` - analityka i statystyki
- `billingService.test.js` - rozliczenia i plany
- `emailService.test.js` - wysyłka emaili
- `feedbackService.test.js` - feedback AI
- `financialService.test.js` - kalkulacje finansowe
- `knowledgeService.test.js` - baza wiedzy
- `ragService.test.js` - RAG i embeddings
- `tokenBillingService.test.js` - rozliczenia tokenów
- `usageService.test.js` - użycie zasobów
- `middleware/authMiddleware.test.js` - middleware autoryzacji

### Frontend Services
✅ **4 testy**

- `analytics.service.test.ts` - kalkulacje analityczne
- `api.service.test.ts` - wrapper API
- `drdStructure.test.ts` - struktura DRD
- `transformationEngine.test.ts` - generowanie inicjatyw
- `pdfExport.test.ts` - eksport PDF
- `roi.test.ts` - kalkulacje ROI

### React Components
✅ **11 testów**

- `Button.test.tsx`
- `ErrorBoundary.test.tsx`
- `FeedbackWidget.test.tsx`
- `InitiativeCard.test.tsx`
- `LLMSelector.test.tsx`
- `LoadingScreen.test.tsx`
- `PlanCard.test.tsx`
- `QuotaWarningBanner.test.tsx`
- `SystemHealth.test.tsx`
- `TaskCard.test.tsx`
- `UsageMeters.test.tsx`

### Hooks
✅ **2 testy**

- `useAIStream.test.ts`
- `useScreenContext.test.ts`

### Store
✅ **1 test**

- `store.test.ts` - Zustand store

**Uruchamianie:**
```bash
npm run test:unit
```

---

## Poziom 2: Integration Tests (Testy Integracyjne)

### API Integration
✅ **8 testów**

- `api.test.ts` - health check i routing
- `apiFullFlow.test.js` - pełny flow API (CRUD)
- `auth.test.js` - autoryzacja i sesje
- `initiatives.test.js` - inicjatywy
- `projects.test.js` - projekty
- `tasks.test.js` - zadania
- `storage_security.test.js` - bezpieczeństwo storage
- `backend/planLimits.test.js` - limity planów

### Database Integration
✅ **Nowe testy sprawności bazy danych**

- `databaseHealth.test.js` - health checks, integrity, performance
- `transaction.test.js` - transakcje, commit, rollback

### LLM Integration
✅ **Nowe testy sprawności LLMów**

- `llmHealth.test.js` - connection, latency, quality

**Uruchamianie:**
```bash
npm run test:integration
```

---

## Poziom 3: Component Tests (Testy Komponentów)

✅ **12 testów** - wszystkie komponenty React z mockami

- Wszystkie komponenty z poziomu 1
- `a11y.test.tsx` - podstawowe testy accessibility

**Uruchamianie:**
```bash
npm run test:component
```

---

## Poziom 4: E2E Tests (Testy End-to-End)

✅ **5 testów** - Playwright

- `auth.spec.ts` - flow autoryzacji (3 testy)
- `basic.spec.ts` - podstawowe ładowanie
- `navigation.spec.ts` - nawigacja między modułami
- `projects.spec.ts` - zarządzanie projektami
- `fullFlow.spec.ts` - pełne flow użytkownika (nowy)

**Uruchamianie:**
```bash
npm run test:e2e
```

**Wymagania:**
- Backend i frontend muszą być uruchomione
- Playwright automatycznie uruchamia serwery jeśli nie są dostępne

---

## Poziom 5: Performance/Stress Tests (Testy Wydajnościowe)

✅ **4 testy** - wydajność i obciążenie

- `load-test.js` - podstawowy load test (autocannon)
- `databasePerformance.test.js` - wydajność bazy danych
- `llmPerformance.test.js` - wydajność LLM (latency, throughput)
- `stress.test.js` - testy obciążeniowe i memory leaks

**Uruchamianie:**
```bash
npm run test:load
# lub
npm run test:performance
```

---

## Testy Sprawności Baz Danych

### Health Checks ✅
- ✅ Połączenie z bazą danych
- ✅ Dostępność wszystkich tabel
- ✅ Integralność foreign keys
- ✅ Dostępność indeksów
- ✅ Test transakcji (commit/rollback)

### Performance Tests ✅
- ✅ Czas odpowiedzi zapytań (< 10ms dla prostych)
- ✅ Wydajność JOIN operations (< 50ms)
- ✅ Wydajność agregacji (< 100ms)
- ✅ Concurrent queries (50+ jednocześnie)
- ✅ Bulk operations (1000+ rekordów)

### Integrity Tests ✅
- ✅ Referential integrity
- ✅ Constraint violations
- ✅ Data consistency
- ✅ Duplicate prevention
- ✅ Cascade delete

### Transaction Tests ✅
- ✅ Commit transactions
- ✅ Rollback on error
- ✅ Savepoints
- ✅ Concurrent transactions

**Pliki:**
- `tests/integration/databaseHealth.test.js`
- `tests/integration/transaction.test.js`
- `tests/performance/databasePerformance.test.js`

---

## Testy Sprawności LLMów

### Connection Tests ✅
- ✅ Test połączenia z providerami
- ✅ Handling timeout
- ✅ Invalid provider handling
- ✅ Error recovery

### Latency Tests ✅
- ✅ Czas odpowiedzi (< 5s dla prostych zapytań)
- ✅ Streaming latency (< 2s pierwszy chunk)
- ✅ Concurrent calls
- ✅ Batch processing

### Quality Tests ✅
- ✅ Respect system instructions
- ✅ Context history handling
- ✅ Token limits
- ✅ Context window efficiency

### Error Handling ✅
- ✅ API errors gracefully
- ✅ Rate limiting
- ✅ Transient error recovery

**Pliki:**
- `tests/integration/llmHealth.test.js`
- `tests/performance/llmPerformance.test.js`

---

## Statystyki Testów

### Obecny Stan
- **Test Files**: 25+ plików testowych
- **Unit Tests**: 144+ testów ✅
- **Integration Tests**: 44+ testów ✅
- **Component Tests**: 52+ testów ✅
- **E2E Tests**: 5+ testów ✅
- **Performance Tests**: 4+ testów ✅

### Pokrycie Kodu
- **Cel**: 90% pokrycia
- **Backend Services**: ~85% pokrycia
- **Frontend Services**: ~80% pokrycia
- **Components**: ~75% pokrycia

---

## Uruchamianie Wszystkich Testów

### Wszystkie testy jednocześnie
```bash
npm run test:all
```

### Z pokryciem kodu
```bash
npm run test:all -- --coverage
```

### Tylko określony poziom
```bash
npm run test:unit          # Poziom 1
npm run test:component     # Poziom 3
npm run test:integration   # Poziom 2
npm run test:e2e           # Poziom 4
npm run test:load          # Poziom 5
```

### Watch mode (dla development)
```bash
npm run test:unit -- --watch
```

---

## Struktura Katalogów

```
tests/
├── __mocks__/              # Mocki globalne
├── components/             # Poziom 3: Component Tests
│   ├── *.test.tsx
│   └── a11y.test.tsx
├── e2e/                    # Poziom 4: E2E Tests
│   ├── *.spec.ts
│   └── fullFlow.spec.ts
├── helpers/                # Helpery dla testów
│   └── dbHelper.cjs
├── hooks/                  # Poziom 1: Hook Tests
│   └── *.test.ts
├── integration/           # Poziom 2: Integration Tests
│   ├── api.test.ts
│   ├── apiFullFlow.test.js
│   ├── auth.test.js
│   ├── databaseHealth.test.js
│   ├── llmHealth.test.js
│   ├── transaction.test.js
│   └── ...
├── performance/           # Poziom 5: Performance Tests
│   ├── load-test.js
│   ├── databasePerformance.test.js
│   ├── llmPerformance.test.js
│   └── stress.test.js
├── unit/                  # Poziom 1: Unit Tests
│   ├── backend/
│   │   └── *.test.js
│   ├── *.test.ts
│   └── utils.test.ts
└── setup.ts               # Konfiguracja testów
```

---

## Best Practices

### 1. Testy Backendowe
- ✅ Używają prawdziwej bazy danych (SQLite in-memory)
- ✅ Czyszczą dane przed każdym testem
- ✅ Są izolowane i niezależne
- ✅ Testują rzeczywiste operacje na bazie

### 2. Testy Frontendowe
- ✅ Mockują API i store
- ✅ Testują tylko logikę UI
- ✅ Używają React Testing Library
- ✅ Testują interakcje użytkownika

### 3. Testy Integracyjne
- ✅ Testują pełne ścieżki API
- ✅ Używają prawdziwej bazy danych
- ✅ Testują integrację między komponentami

### 4. Testy E2E
- ✅ Testują pełne scenariusze użytkownika
- ✅ Używają Playwright
- ✅ Testują w rzeczywistym środowisku

### 5. Testy Wydajnościowe
- ✅ Mierzą rzeczywiste metryki
- ✅ Testują pod obciążeniem
- ✅ Wykrywają memory leaks

---

## Następne Kroki (Roadmap)

### Krótkoterminowe
- [ ] Dodać więcej testów E2E dla pełnych flow
- [ ] Rozszerzyć testy accessibility (a11y)
- [ ] Dodać testy dla workspace components
- [ ] Dodać testy dla dashboard components

### Średnioterminowe
- [ ] Dodać testy migracji schematu bazy
- [ ] Rozszerzyć testy wydajnościowe
- [ ] Dodać testy cross-browser compatibility
- [ ] Dodać testy multi-user scenarios

### Długoterminowe
- [ ] Automatyczne uruchamianie testów w CI/CD
- [ ] Monitoring pokrycia kodu
- [ ] Testy bezpieczeństwa (security tests)
- [ ] Testy chaos engineering

---

## Dokumentacja Dodatkowa

- `TEST_STRATEGY_5_LEVELS.md` - Szczegółowa strategia testów
- `TEST_MIGRATION_PLAN.md` - Plan migracji na prawdziwą bazę danych
- `vitest.config.ts` - Konfiguracja Vitest
- `playwright.config.ts` - Konfiguracja Playwright

---

## Kontakt i Wsparcie

W razie pytań dotyczących testów, sprawdź:
1. Dokumentację w `TEST_STRATEGY_5_LEVELS.md`
2. Przykłady w istniejących testach
3. Helpery w `tests/helpers/dbHelper.cjs`

