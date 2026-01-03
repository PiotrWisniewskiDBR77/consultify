# Plan Migracji TypeScript - Usunięcie Backward Compatibility

**Data utworzenia:** 2025-01-03  
**Status:** W trakcie realizacji

## Obecny Stan

### Pliki używające createRequire()
- **Łączna liczba:** ~568 plików TypeScript
- **Lokalizacja:** `server/src/**/*.ts`
- **Typ:** Większość to wrappery importujące JS services

### Struktura Wrapperów

Większość plików TS w `server/src/services/` to wrappery używające wzorca:

```typescript
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const serviceJS = require('../../services/serviceName.js');
export default serviceJS.default || serviceJS;
```

## Plan Migracji

### Faza 1: Migracja Cron Jobs (Priorytet: Wysoki)
- [x] `scheduler.js` → `server/src/cron/scheduler.ts` (częściowo)
- [ ] `trialCron.js` → `server/src/cron/trialCron.ts`
- [ ] `healthCheckJob.js` → `server/src/cron/healthCheckJob.ts`
- [ ] `cleanupRevokedTokens.js` → `server/src/cron/cleanupRevokedTokens.ts`
- [ ] `backupCron.js` → `server/src/cron/backupCron.ts`
- [ ] `billingCron.js` → `server/src/cron/billingCron.ts`
- [ ] `dunningCron.js` → `server/src/cron/dunningCron.ts`
- [ ] `snapshotMetrics.js` → `server/src/cron/snapshotMetrics.ts`

**Szacowany czas:** 2-3 dni

### Faza 2: Migracja Entry Point (Priorytet: Wysoki)
- [x] `server/src/index.ts` - częściowo zaktualizowany
- [ ] Usunięcie wszystkich `require()` z entry point
- [ ] Migracja wszystkich imports do ES modules
- [ ] Aktualizacja startup logic

**Szacowany czas:** 1-2 dni

### Faza 3: Migracja Services (Priorytet: Średni)
Strategia: Migracja w grupach funkcjonalnych

#### Grupa 1: Core Services (~30 plików)
- [ ] `userService.js` → pełna migracja TS
- [ ] `organizationService.js` → pełna migracja TS
- [ ] `projectService.js` → pełna migracja TS
- [ ] `taskService.js` → pełna migracja TS

#### Grupa 2: AI Services (~50 plików)
- [ ] `aiService.js` → pełna migracja TS
- [ ] `aiPipeline.js` → pełna migracja TS
- [ ] `ragService.js` → pełna migracja TS

#### Grupa 3: Billing & Financial Services (~20 plików)
- [ ] `billingService.js` → pełna migracja TS
- [ ] `invoiceService.js` → pełna migracja TS
- [ ] `subscriptionService.js` → pełna migracja TS

**Szacowany czas:** 15-20 dni (można równolegle)

### Faza 4: Usunięcie Wrapperów (Priorytet: Niski)
Po migracji wszystkich services, usunięcie wrapperów:
- [ ] Usunięcie wszystkich plików wrapper z `server/src/services/`
- [ ] Aktualizacja wszystkich imports
- [ ] Weryfikacja że wszystko działa

**Szacowany czas:** 2-3 dni

## Metodyka Migracji

### Krok 1: Analiza zależności
```bash
# Znajdź wszystkie użycia service
grep -r "require.*serviceName" server/src/
```

### Krok 2: Migracja service
1. Skopiuj kod z `server/services/serviceName.js`
2. Przekonwertuj do TypeScript:
   - Dodaj typy dla wszystkich parametrów i zwracanych wartości
   - Usuń `module.exports` → użyj `export default`
   - Zamień `require()` → `import`
   - Dodaj JSDoc comments
3. Utwórz testy jednostkowe (jeśli brakuje)
4. Zaktualizuj wrapper lub usuń go

### Krok 3: Weryfikacja
1. Uruchom testy jednostkowe
2. Uruchom testy integracyjne
3. Sprawdź czy aplikacja startuje
4. Sprawdź czy funkcjonalność działa

## Przykład Migracji

### Przed (CommonJS):
```javascript
// server/services/exampleService.js
const db = require('../database');

const ExampleService = {
    getData: async (id) => {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM data WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }
};

module.exports = ExampleService;
```

### Po (TypeScript ES Modules):
```typescript
// server/src/services/exampleService.ts
import db from '../database/Database.js';
import type { DataRow } from '../types/database.js';

const ExampleService = {
    /**
     * Get data by ID
     * @param id - Data ID
     * @returns Promise with data row or null
     */
    getData: async (id: string): Promise<DataRow | null> => {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM data WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row as DataRow | null);
            });
        });
    }
};

export default ExampleService;
```

## Metryki Sukcesu

- ✅ 0 użyć `createRequire()` w plikach TypeScript
- ✅ 0 użyć `require()` w plikach TypeScript (poza entry point podczas migracji)
- ✅ 100% plików w `server/src/` używa ES modules
- ✅ Wszystkie testy przechodzą
- ✅ Aplikacja startuje bez błędów

## Harmonogram

- **Tydzień 1:** Migracja cron jobs + entry point
- **Tydzień 2-4:** Migracja core services
- **Tydzień 5-7:** Migracja AI services
- **Tydzień 8-9:** Migracja billing services
- **Tydzień 10:** Usunięcie wrapperów + weryfikacja

**Całkowity szacowany czas:** 10 tygodni (można skrócić przez równoległą pracę)

## Uwagi

1. **Priorytetyzacja:** Rozpocząć od krytycznych komponentów (cron jobs, entry point)
2. **Równoległa praca:** Różne grupy services mogą być migrowane równolegle
3. **Incremental testing:** Dodawać testy podczas migracji
4. **Code review:** Wszystkie zmiany wymagają code review przed merge



