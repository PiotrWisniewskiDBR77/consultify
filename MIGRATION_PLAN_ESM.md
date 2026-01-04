# 🔧 Plan Migracji ES Modules - Consultify Backend

## 📊 Diagnoza

### Aktualny stan:
- `server/package.json` ma `"type": "module"` (wymusza ESM dla .js)
- `server/src/` - **pełna struktura TypeScript** (418 services, 187 routes)
- `server/services/`, `server/cron/`, `server/routes/` - **STARE pliki .js** używające `require()`
- `server/src/index.ts` - importuje STARE pliki z `../services/` zamiast nowych z `./services/`

### Problem:
- Backend nie startuje bo `"type": "module"` + `require()` = błąd
- 78+ plików używa `require()` zamiast `import`

---

## ✅ Strategia Rozwiązania

### Faza 1: Naprawić index.ts (5 min)
Zmienić dynamiczne importy z `../services/` na `./services/` (TypeScript)

### Faza 2: Skrypt do masowej zmiany .js → .cjs (dla utility scripts)
Pliki seed_*.js, scripts/*.js, test_*.js - nie są częścią głównej aplikacji

### Faza 3: Usunąć/zarchiwizować stare pliki .js
Stare pliki w `server/services/`, `server/routes/` są duplikatami TypeScript

---

## 🚀 Wykonanie

### KROK 1: Naprawić server/src/index.ts

Zmienić te dynamiczne importy:

```typescript
// PRZED (stare pliki CommonJS)
await import('../services/ai/healthMonitor.js');
await import('../services/realtimeService.js');
await import('../cron/cleanupRevokedTokens.js');
await import('../cron/snapshotMetrics.js');
await import('../services/ai/redisClient.js');
await import('../services/ai/cacheService.js');
await import('../services/ai/rateLimiter.js');
await import('../workers/aiWorker.js');
await import('../services/systemIntegrity.js');

// PO (nowe pliki TypeScript w src/)
await import('./services/ai/healthMonitor.js');
await import('./services/realtimeService.js');
await import('./cron/CleanupRevokedTokens.js');
await import('./cron/SnapshotMetrics.js');
await import('./services/ai/redisClient.js');
await import('./services/ai/cacheService.js');
await import('./services/ai/rateLimiter.js');
// aiWorker wymaga migracji
await import('./services/systemIntegrity.js');
```

### KROK 2: Skrypt do zmiany seed/scripts na .cjs

```bash
#!/bin/bash
# change_to_cjs.sh

cd /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/server

# Lista plików do zmiany na .cjs (utility scripts, nie główna aplikacja)
FILES_TO_CONVERT=(
  # Seed files
  "seed_*.js"
  "seed/*.js"
  "scripts/seed*.js"
  # Test utility files
  "test_*.js"
  # Migration scripts
  "migrate_*.js"
  # One-off scripts
  "check_*.js"
  "fix_*.js"
  "list_*.js"
  "restore_*.js"
  "verify_*.js"
  "apply_*.js"
  "cleanup_*.js"
  "force_*.js"
  "inspect_*.js"
  # Database setup
  "database.sqlite*.js"
)

for pattern in "${FILES_TO_CONVERT[@]}"; do
  for file in $pattern; do
    if [ -f "$file" ]; then
      newname="${file%.js}.cjs"
      mv "$file" "$newname"
      echo "Renamed: $file -> $newname"
    fi
  done
done
```

### KROK 3: Automatyczna konwersja require() → import dla serwisów

Dla plików które MUSZĄ być ESM (nie utility scripts), użyć sed:

```bash
# Konwersja const X = require('Y') → import X from 'Y'
find server/services -name "*.js" -exec sed -i '' \
  "s/const \([a-zA-Z_][a-zA-Z0-9_]*\) = require('\([^']*\)')/import \1 from '\2'/g" {} \;

# Konwersja module.exports = X → export default X
find server/services -name "*.js" -exec sed -i '' \
  "s/module\.exports = /export default /g" {} \;

# Konwersja module.exports.X = → export const X =
find server/services -name "*.js" -exec sed -i '' \
  "s/module\.exports\.\([a-zA-Z_][a-zA-Z0-9_]*\) = /export const \1 = /g" {} \;
```

### KROK 4: Usunąć/zarchiwizować stare pliki

```bash
# Backup starych plików
mkdir -p backup/legacy-js-files
cp -r server/services/*.js backup/legacy-js-files/
cp -r server/routes/*.js backup/legacy-js-files/

# Po potwierdzeniu że wszystko działa - usunąć stare .js
# (NIE usuwać od razu, najpierw przetestować!)
```

---

## 📋 Checklist

- [ ] Krok 1: Naprawić importy w index.ts
- [ ] Krok 2: Zmienić seed/scripts na .cjs
- [ ] Krok 3: Konwertować pozostałe require() → import
- [ ] Krok 4: Przetestować backend (`npm run dev`)
- [ ] Krok 5: Zarchiwizować stare pliki .js
- [ ] Krok 6: Uruchomić produkcję

---

## 🔥 Najszybsze rozwiązanie (alternatywa)

Jeśli powyższe jest zbyt czasochłonne:

**OPCJA A: Zmiana na CommonJS**
```json
// server/package.json
{
  "type": "commonjs"
}
```
I zmiana wszystkich plików .ts na generowanie CommonJS (tsconfig: `"module": "CommonJS"`)

**OPCJA B: tsx dev mode (działa TERAZ)**
```bash
cd server
npx tsx src/index.ts
```
`tsx` obsługuje zarówno ESM jak i CommonJS transparentnie!

---

## 📌 Rekomendacja

**Najszybsze rozwiązanie produkcyjne:**

1. Użyć `tsx` do uruchomienia dev mode (już działa)
2. Stopniowo migrować pliki przy okazji innych zmian
3. NIE robić masowej migracji naraz - zbyt duże ryzyko

```bash
# Uruchomienie backendu:
cd server
npm run dev  # używa tsx watch src/index.ts
```

---

## 📁 Pliki do usunięcia (duplikaty)

Po migracji te pliki można usunąć (mają odpowiedniki w src/):
- `server/services/*.js` (418 duplikatów)
- `server/routes/*.js` (7 plików)
- `server/cron/*.js` (duplikaty)
- `server/workers/*.js` (2 pliki)

**UWAGA**: Pliki seed, scripts, migrations - zachować jako .cjs

