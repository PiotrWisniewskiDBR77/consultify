# TypeScript Migration Guide

**Wersja:** 1.0  
**Data:** 2025-01-03

## Wprowadzenie

Ten dokument opisuje proces migracji backendu Consultify z JavaScript (CommonJS) do TypeScript (ES Modules).

## Obecny Stan Migracji

### ✅ Zmigrowane Komponenty
- Database Layer (`server/src/database/*.ts`)
- Config Layer (`server/src/config/*.ts`)
- Utils Layer (`server/src/utils/*.ts`)
- Middleware (`server/src/middleware/*.ts`)
- Routes (`server/src/routes/*.ts`)
- Controllers (`server/src/controllers/*.ts`)
- Entry Point (`server/src/index.ts`)

### ⚠️ W Trakcie Migracji
- Services (`server/src/services/*.ts` - większość to wrappery)
- Cron Jobs (`server/cron/*.js`)

### 📋 Pozostałe do Migracji
- Pełna migracja services z wrapperów do pełnych implementacji TS
- Migracja wszystkich cron jobs do TypeScript
- Usunięcie backward compatibility (`createRequire`)

## Jak Migrować Service

### Krok 1: Analiza
```bash
# Sprawdź zależności
grep -r "require.*serviceName" server/src/
grep -r "import.*serviceName" server/src/
```

### Krok 2: Przygotowanie
1. Utwórz nowy plik `server/src/services/serviceName.ts`
2. Skopiuj kod z `server/services/serviceName.js`
3. Przeanalizuj zależności

### Krok 3: Konwersja

#### Typy
```typescript
// Dodaj typy dla parametrów
function getData(id: string): Promise<DataRow | null>

// Dodaj typy dla zwracanych wartości
interface ServiceResult {
    success: boolean;
    data?: unknown;
    error?: string;
}
```

#### Imports
```typescript
// Przed (CommonJS)
const db = require('../database');
const logger = require('../utils/logger');

// Po (ES Modules)
import db from '../database/Database.js';
import logger from '../utils/Logger.js';
```

#### Exports
```typescript
// Przed (CommonJS)
module.exports = Service;

// Po (ES Modules)
export default Service;
```

### Krok 4: Testy
```bash
# Uruchom testy jednostkowe
npm run test:backend

# Uruchom testy integracyjne
npm run test:integration
```

### Krok 5: Aktualizacja Wrappera
Po migracji, zaktualizuj wrapper lub usuń go:

```typescript
// Przed (wrapper)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const serviceJS = require('../../services/serviceName.js');
export default serviceJS.default || serviceJS;

// Po (bezpośredni import)
export { default } from './serviceName.js';
```

## Najlepsze Praktyki

### 1. Typy
- Używaj `strict: true` w tsconfig.json
- Unikaj `any` - używaj konkretnych typów lub `unknown`
- Dodawaj JSDoc comments dla publicznych funkcji

### 2. Error Handling
```typescript
try {
    const result = await service.method();
    return { success: true, data: result };
} catch (error) {
    const err = error as Error;
    logger.error('Service error:', err.message);
    return { success: false, error: err.message };
}
```

### 3. Async/Await
```typescript
// Przed (callbacks)
db.get('SELECT * FROM data', (err, row) => {
    if (err) reject(err);
    else resolve(row);
});

// Po (async/await z promisami)
const row = await db.get('SELECT * FROM data');
```

### 4. Database Queries
Używaj helper functions z `server/src/utils/queryHelpers.ts`:

```typescript
import { queryHelpers } from '../utils/queryHelpers.js';

const data = await queryHelpers.queryOne(
    'SELECT * FROM data WHERE id = ?',
    [id]
);
```

## Troubleshooting

### Problem: Import nie działa
**Rozwiązanie:** Upewnij się, że używasz `.js` extension w imports:
```typescript
import service from './service.js'; // ✅
import service from './service';    // ❌
```

### Problem: createRequire nadal potrzebny
**Rozwiązanie:** Migruj zależności do TypeScript lub użyj dynamic import:
```typescript
// Zamiast createRequire
const module = await import('./legacy-module.js');
```

### Problem: Typy nie działają
**Rozwiązanie:** Sprawdź czy plik ma rozszerzenie `.ts` i czy typy są poprawnie zdefiniowane.

## Narzędzia

### Type Checking
```bash
npm run typecheck
```

### Build
```bash
npm run build
```

### Testy
```bash
npm run test:backend
npm run test:backend:coverage
```

## Przydatne Linki

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [ES Modules Guide](https://nodejs.org/api/esm.html)
- [Migration Best Practices](https://www.typescriptlang.org/docs/handbook/migrating-from-javascript.html)









