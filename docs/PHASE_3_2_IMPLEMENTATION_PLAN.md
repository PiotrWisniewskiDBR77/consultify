# Plan Realizacji FAZY 3.2 - Usunięcie createRequire() z Services

## Cel: Usunięcie createRequire() z pozostałych ~267 wrapper services

**Status:** W toku  
**Data rozpoczęcia:** 2025-01-XX  
**Szacowany czas:** 4-6 tygodni (batch processing)

---

## Obecny Stan

- ✅ **Ukończone:** 3 serwisy (dunningService, BillingWebhookService, SubscriptionAnalyticsService)
- ⏳ **Pozostało:** ~267 wrapper services wymagających migracji
- 📊 **Wszystkie wrappery są używane** → wymagają migracji (nie można ich usunąć)

---

## Strategia Realizacji

### 1. PRIORYTETYZACJA (Tydzień 1)

#### 1.1. Analiza i Kategoryzacja

**Krok 1:** Utworzenie skryptu analitycznego do kategoryzacji serwisów:

```bash
# Skrypt: scripts/categorize-wrappers.cjs
# Kategorie:
# - CRITICAL: Używane w >10 miejscach, krytyczne dla działania systemu
# - HIGH: Używane w 5-10 miejscach, ważne funkcjonalności
# - MEDIUM: Używane w 2-4 miejscach, standardowe funkcjonalności  
# - LOW: Używane w 1 miejscu, rzadko używane
# - UNUSED: Nie używane (można usunąć)
```

**Krok 2:** Analiza złożoności migracji:
- **SIMPLE:** <200 linii JS, prosta logika
- **MEDIUM:** 200-500 linii JS, średnia złożoność
- **COMPLEX:** >500 linii JS, złożona logika

**Krok 3:** Utworzenie macierzy priorytetów:

| Priorytet | Kryteria | Liczba | Strategia |
|-----------|----------|--------|-----------|
| **P0** | CRITICAL + SIMPLE | ~20-30 | Migracja natychmiastowa |
| **P1** | CRITICAL + MEDIUM | ~15-25 | Migracja w pierwszym tygodniu |
| **P2** | HIGH + SIMPLE | ~40-50 | Batch 1 (Tydzień 2) |
| **P3** | HIGH + MEDIUM | ~30-40 | Batch 2 (Tydzień 3) |
| **P4** | MEDIUM + SIMPLE | ~50-60 | Batch 3 (Tydzień 4) |
| **P5** | MEDIUM + COMPLEX | ~20-30 | Batch 4 (Tydzień 5) |
| **P6** | LOW + ALL | ~30-40 | Batch 5 (Tydzień 6) |

---

### 2. BATCH PROCESSING (Tydzień 2-6)

#### 2.1. Struktura Batcha

Każdy batch zawiera:
- **10-15 serwisów** (zarządzalna liczba)
- **Podobna złożoność** (ułatwia pracę)
- **Podobna funkcjonalność** (ułatwia testowanie)

#### 2.2. Proces Migracji Batcha

**Dla każdego serwisu w batchu:**

1. **Przygotowanie (15 min)**
   - Przeczytanie JS pliku źródłowego
   - Zidentyfikowanie wszystkich funkcji/metod
   - Zidentyfikowanie zależności
   - Sprawdzenie użycia w kodzie

2. **Migracja (1-3 godziny)**
   - Utworzenie interfejsów TypeScript
   - Migracja klasy/funkcji z pełnym typowaniem
   - Zamiana callbacków na async/await
   - Zamiana require() na ES module imports
   - Usunięcie wrapper code

3. **Testowanie (30 min)**
   - Sprawdzenie kompilacji TypeScript
   - Sprawdzenie linter errors
   - Test manualny (jeśli możliwe)
   - Sprawdzenie importów w routes/controllers

4. **Weryfikacja (15 min)**
   - Usunięcie starego wrapper code
   - Commit z opisem zmian
   - Aktualizacja statusu w planie

**Czas na batch:** ~2-3 dni robocze

---

### 3. TEMPLATE MIGRACJI

#### 3.1. Standardowy Template dla Prostej Migracji

```typescript
/**
 * [Service Name] Service
 * [Description]
 * Fully migrated from server/services/[serviceName].js to TypeScript
 */

import type { IDatabase } from '../database/IDatabase.js';
import { getDatabase } from '../database/Database.js';
import logger from '../utils/Logger.js';
import { v4 as uuidv4 } from 'uuid';

// ==========================================
// TYPE DEFINITIONS
// ==========================================

export interface [Service]Data {
    // Define interfaces based on JS implementation
}

// Dependency injection interface for testing
export interface [Service]Dependencies {
    db: IDatabase;
    uuidv4: () => string;
}

// ==========================================
// SERVICE IMPLEMENTATION
// ==========================================

class [Service]Class {
    private deps: [Service]Dependencies;

    constructor(deps?: Partial<[Service]Dependencies>) {
        this.deps = {
            db: deps?.db ?? getDatabase(),
            uuidv4: deps?.uuidv4 ?? uuidv4
        };
    }

    // Migrate all methods from JS, converting callbacks to async/await
}

// Create singleton instance
const [service]Instance = new [Service]Class();

// Export individual functions for backward compatibility
export const [function1] = () => [service]Instance.[function1]();
// ... more exports

// Default export for backward compatibility
const [service] = {
    [function1],
    // ... more exports
};

export default [service];
```

#### 3.2. Checklist Migracji

- [ ] Przeczytać pełny JS plik źródłowy
- [ ] Zidentyfikować wszystkie funkcje/metody
- [ ] Utworzyć interfejsy TypeScript dla danych
- [ ] Zmigrować klasę z pełnym typowaniem
- [ ] Zamienić wszystkie callbacki na async/await
- [ ] Zamienić require() na ES module imports
- [ ] Usunąć createRequire() i wrapper code
- [ ] Dodać exporty dla backward compatibility
- [ ] Sprawdzić kompilację TypeScript
- [ ] Sprawdzić linter errors
- [ ] Zweryfikować importy w routes/controllers
- [ ] Commit z opisem zmian

---

### 4. AUTOMATYZACJA I NARZĘDZIA

#### 4.1. Skrypty Wspomagające

**scripts/categorize-wrappers.cjs**
- Analizuje użycie każdego wrapper service
- Kategoryzuje według częstotliwości użycia
- Szacuje złożoność migracji
- Generuje macierz priorytetów

**scripts/verify-migration.cjs**
- Sprawdza czy wrapper został usunięty
- Weryfikuje brak createRequire() w pliku
- Sprawdza kompilację TypeScript
- Generuje raport weryfikacji

**scripts/batch-status.cjs**
- Pokazuje status każdego batcha
- Lista ukończonych serwisów
- Lista pozostałych serwisów
- Metryki postępu

#### 4.2. CI/CD Checks

Dodanie automatycznych checków:
- TypeScript compilation check
- Linter check (no createRequire, no require)
- Import verification (czy wszystkie importy działają)

---

### 5. HARMONOGRAM REALIZACJI

#### Tydzień 1: Analiza i Przygotowanie
- **Dzień 1-2:** Utworzenie skryptów analitycznych
- **Dzień 3-4:** Kategoryzacja wszystkich wrapper services
- **Dzień 5:** Utworzenie macierzy priorytetów i planu batchów

#### Tydzień 2: Batch 1 - P0 + P1 (Critical Services)
- **Dzień 1-2:** Migracja P0 services (CRITICAL + SIMPLE)
- **Dzień 3-4:** Migracja P1 services (CRITICAL + MEDIUM)
- **Dzień 5:** Weryfikacja i testowanie

#### Tydzień 3: Batch 2 - P2 (High Priority Simple)
- **Dzień 1-3:** Migracja P2 services (HIGH + SIMPLE)
- **Dzień 4-5:** Weryfikacja i testowanie

#### Tydzień 4: Batch 3 - P3 (High Priority Medium)
- **Dzień 1-3:** Migracja P3 services (HIGH + MEDIUM)
- **Dzień 4-5:** Weryfikacja i testowanie

#### Tydzień 5: Batch 4 - P4 + P5 (Medium Priority)
- **Dzień 1-3:** Migracja P4 services (MEDIUM + SIMPLE)
- **Dzień 4-5:** Migracja P5 services (MEDIUM + COMPLEX)

#### Tydzień 6: Batch 5 - P6 (Low Priority) + Finalizacja
- **Dzień 1-3:** Migracja P6 services (LOW + ALL)
- **Dzień 4:** Finalna weryfikacja wszystkich serwisów
- **Dzień 5:** Dokumentacja i raport końcowy

---

### 6. METRYKI SUKCESU

#### 6.1. Metryki Postępu

- **Target:** 0 `createRequire()` w `server/src/services/`
- **Target:** 0 `require()` w TypeScript plikach
- **Target:** 100% ES modules w services
- **Target:** Wszystkie testy przechodzą
- **Target:** Build successful

#### 6.2. Metryki Jakości

- **TypeScript errors:** 0
- **Linter errors:** 0
- **Test coverage:** >90% dla zmigrowanych serwisów
- **Build time:** Bez degradacji

#### 6.3. Tracking

Codzienne aktualizacje:
- Liczba zmigrowanych serwisów
- Liczba pozostałych wrapperów
- Błędy napotkane
- Czas spędzony na migracji

---

### 7. RYZYKA I MITIGACJE

#### Ryzyko 1: Regression w funkcjonalności
**Mitigacja:**
- Testowanie każdego zmigrowanego serwisu
- Code review przed commit
- Incremental commits (pojedyncze serwisy)
- Rollback plan dla każdego batcha

#### Ryzyko 2: Złożone zależności między serwisami
**Mitigacja:**
- Analiza zależności przed migracją
- Migracja w odpowiedniej kolejności (zależności najpierw)
- Testowanie integracji po każdej migracji

#### Ryzyko 3: Brak czasu na migrację wszystkich serwisów
**Mitigacja:**
- Priorytetyzacja (critical services najpierw)
- Batch processing (zarządzalne części)
- Możliwość kontynuacji w następnej fazie

#### Ryzyko 4: Błędy w migracji callback → async/await
**Mitigacja:**
- Użycie sprawdzonych wzorców migracji
- Testowanie każdej zmigrowanej funkcji
- Code review z naciskiem na async patterns

---

### 8. BEST PRACTICES

#### 8.1. Podczas Migracji

1. **Zawsze zaczynaj od interfejsów**
   - Zdefiniuj typy przed implementacją
   - Ułatwia to migrację i zapewnia type safety

2. **Zachowaj backward compatibility**
   - Eksportuj zarówno named exports jak i default export
   - Zachowaj te same nazwy funkcji/metod

3. **Używaj dependency injection**
   - Ułatwia testowanie
   - Umożliwia mockowanie zależności

4. **Dokumentuj zmiany**
   - Komentarze w kodzie
   - Commit messages z opisem zmian
   - Aktualizacja dokumentacji

#### 8.2. Podczas Testowania

1. **Testuj każdy zmigrowany serwis osobno**
2. **Sprawdź wszystkie miejsca użycia**
3. **Zweryfikuj brak regresji**
4. **Sprawdź performance (jeśli możliwe)**

---

### 9. TEMPLATE COMMIT MESSAGE

```
feat(services): Migrate [ServiceName]Service to TypeScript

- Migrated from server/services/[serviceName].js
- Converted callbacks to async/await
- Added TypeScript interfaces and types
- Removed createRequire() wrapper
- Maintained backward compatibility

Closes #[issue-number]
Part of Phase 3.2 migration
```

---

### 10. FINALNA WERYFIKACJA

Po zakończeniu wszystkich batchów:

1. **Sprawdzenie kompletności:**
   ```bash
   grep -r "createRequire" server/src/services --include="*.ts" | wc -l
   # Powinno zwrócić: 0
   ```

2. **Sprawdzenie require():**
   ```bash
   grep -r "require(" server/src/services --include="*.ts" | grep -v "//" | wc -l
   # Powinno zwrócić: 0 (lub tylko komentarze)
   ```

3. **Build verification:**
   ```bash
   npm run build
   # Powinno przejść bez błędów
   ```

4. **Test verification:**
   ```bash
   npm test
   # Wszystkie testy powinny przejść
   ```

5. **Linter verification:**
   ```bash
   npm run lint
   # Brak błędów
   ```

---

## PODSUMOWANIE

**Cel:** Usunięcie createRequire() z ~267 wrapper services  
**Czas:** 4-6 tygodni  
**Metoda:** Batch processing z priorytetyzacją  
**Sukces:** 0 createRequire(), 0 require(), 100% ES modules, wszystkie testy przechodzą

**Następne kroki:**
1. Utworzenie skryptów analitycznych (Tydzień 1)
2. Rozpoczęcie Batch 1 - Critical Services (Tydzień 2)
3. Kontynuacja batch processing (Tydzień 3-6)
4. Finalna weryfikacja i dokumentacja

---

*Plan utworzony: 2025-01-XX*  
*Ostatnia aktualizacja: 2025-01-XX*

