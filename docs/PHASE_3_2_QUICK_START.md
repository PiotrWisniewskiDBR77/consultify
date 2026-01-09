# Quick Start Guide - Faza 3.2 Migration

## Szybki Start

### 1. Sprawdź Status

```bash
node scripts/batch-status.cjs
```

### 2. Zobacz Kategoryzację

```bash
node scripts/categorize-wrappers.cjs
```

### 3. Wybierz Serwis do Migracji

Zobacz `wrapper-categorization.json` dla listy serwisów pogrupowanych według priorytetów.

**Rekomendowane kolejność:**
1. P1 (Critical + Complex) - 1 serwis
2. P3 (High + Medium/Complex) - 2 serwisy  
3. P4 (Medium + Simple) - 12 serwisów
4. P5 (Medium + Medium/Complex) - 43 serwisy
5. P6 (Low priority) - 207 serwisów

### 4. Migruj Serwis

1. Przeczytaj JS plik źródłowy: `server/services/[serviceName].js`
2. Utwórz TypeScript wersję w: `server/src/services/[serviceName].ts`
3. Użyj template z `docs/PHASE_3_2_IMPLEMENTATION_PLAN.md`
4. Zweryfikuj migrację: `node scripts/verify-migration.cjs server/src/services/[serviceName].ts`

### 5. Commit

```bash
git add server/src/services/[serviceName].ts
git commit -m "feat(services): Migrate [ServiceName]Service to TypeScript

- Migrated from server/services/[serviceName].js
- Converted callbacks to async/await
- Added TypeScript interfaces and types
- Removed createRequire() wrapper
- Maintained backward compatibility

Part of Phase 3.2 migration"
```

### 6. Sprawdź Postęp

```bash
node scripts/batch-status.cjs
```

---

## Template Migracji

Zobacz sekcję 3 w `docs/PHASE_3_2_IMPLEMENTATION_PLAN.md` dla pełnego template.

---

## Metryki Sukcesu

- ✅ 0 `createRequire()` w `server/src/services/`
- ✅ 0 `require()` w TypeScript plikach (poza komentarzami)
- ✅ Wszystkie testy przechodzą
- ✅ Build successful

---

## Pomoc

- Pełny plan: `docs/PHASE_3_2_IMPLEMENTATION_PLAN.md`
- Status: `node scripts/batch-status.cjs`
- Kategoryzacja: `node scripts/categorize-wrappers.cjs`
- Weryfikacja: `node scripts/verify-migration.cjs <file>`















