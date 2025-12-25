# Przewodnik Testów - Quick Start

## 🚀 Szybki Start

### Uruchomienie wszystkich testów
```bash
npm run test:all
```

### Uruchomienie z pokryciem kodu
```bash
npm run test:coverage
```

### Uruchomienie konkretnego poziomu
```bash
npm run test:unit          # Poziom 1: Unit Tests
npm run test:component     # Poziom 3: Component Tests  
npm run test:integration   # Poziom 2: Integration Tests
npm run test:e2e           # Poziom 4: E2E Tests (Playwright)
npm run test:performance   # Poziom 5: Performance Tests
```

---

## 📋 Struktura Testów

### Poziom 1: Unit Tests
**Lokalizacja**: `tests/unit/`
- Backend services (używają prawdziwej bazy SQLite in-memory)
- Frontend services
- Utils i helpers

### Poziom 2: Integration Tests
**Lokalizacja**: `tests/integration/`
- API endpoints
- Database health & performance
- LLM health & performance
- Transactions
- Full API flows

### Poziom 3: Component Tests
**Lokalizacja**: `tests/components/`
- React components
- Accessibility tests

### Poziom 4: E2E Tests
**Lokalizacja**: `tests/e2e/`
- Full user flows
- Browser automation (Playwright)

### Poziom 5: Performance Tests
**Lokalizacja**: `tests/performance/`
- Database performance
- LLM performance
- Stress tests
- Load tests

---

## 🔧 Konfiguracja

### Environment Variables
Testy automatycznie używają:
- `NODE_ENV=test` - używa SQLite in-memory
- `MOCK_DB=false` - używa prawdziwej bazy

### Database Helper
Wszystkie testy backendowe mogą używać `tests/helpers/dbHelper.cjs`:
```javascript
const { initTestDb, cleanTables, dbAll, dbRun } = require('../../helpers/dbHelper.cjs');
```

---

## 📊 Statystyki

- **~252 testy zaimplementowane** ✅
- **~317+ testy do utworzenia** ⚠️
- **5 poziomów testowania**
- **Pokrycie**: ~44% (Cel: 90%)

📈 **Szczegółowe statystyki**: Zobacz [TEST_INDEX.md](./TEST_INDEX.md)

---

## 🐛 Troubleshooting

### Testy nie znajdują modułów
- Sprawdź ścieżki w `vitest.config.ts`
- Upewnij się, że używasz `.cjs` dla CommonJS modułów

### Błędy bazy danych
- Testy automatycznie używają SQLite in-memory
- Sprawdź czy `db.initPromise` jest await'owane

### Testy E2E nie działają
- Upewnij się, że backend i frontend są uruchomione
- Lub pozwól Playwright uruchomić je automatycznie

---

## 📚 Więcej Informacji

Zobacz:
- **[TEST_STRUCTURE_COMPLETE.md](./TEST_STRUCTURE_COMPLETE.md)** - ✨ **Kompletna struktura testów** - Mapowanie wszystkich testów do utworzenia
- **[TEST_INDEX.md](./TEST_INDEX.md)** - 📊 **Indeks testów** - Szybki przewodnik i statystyki
- `README_COMPREHENSIVE.md` - Pełna dokumentacja systemu testów
- `SUMMARY.md` - Podsumowanie systemu testów
- `TEST_SYSTEM_COMPLETE.md` - Pełna dokumentacja systemu testów
- `TEST_STRATEGY_5_LEVELS.md` - Strategia testów na 5 poziomach
- `TEST_MIGRATION_PLAN.md` - Plan migracji na prawdziwą bazę danych

