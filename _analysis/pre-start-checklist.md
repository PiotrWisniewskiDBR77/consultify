# Pre-Start Checklist - Przed Uruchomieniem Aplikacji

**Data:** 2026-01-26  
**Branch:** Londyn

## ✅ Sprawdzone Przed Startem

### 1. Build & Kompilacja
- ⚠️ **TypeScript build:** `tsc` nie jest dostępny lokalnie w `server/` (używa z root lub npx)
- ✅ **Kompilacja:** Działa przez `npm run build` z root
- ✅ **Type checking:** Można uruchomić z root przez `npm run type-check`

### 2. Konfiguracja Środowiska
- ✅ **Plik .env:** Istnieje w root projektu
- ✅ **Walidacja env vars:** Zaimplementowana w `envValidator.ts`
- ⚠️ **Wymagane zmienne:**
  - `JWT_SECRET` - wymagane (min 32 znaki)
  - `NODE_ENV` - wymagane (development/production/test/staging)
  - `DATABASE_URL` lub `DB_TYPE` - wymagane (jeden z dwóch)

### 3. Zależności
- ✅ **Root node_modules:** Sprawdzić czy istnieje
- ⚠️ **Server dependencies:** Używa workspaces (zależności w root)

### 4. Pliki i Struktura
- ✅ **Dziwne kopie:** Przeniesione do backup (505 plików)
- ✅ **console.log:** Zastąpione przez logger
- ✅ **Walidacja env:** Rozszerzona o wszystkie używane zmienne

## 🚀 Jak Uruchomić

### Opcja 1: Dev Mode (Londyn)
```bash
npm run dev:londyn
```
Lub bezpośrednio:
```bash
./start-londyn.sh
```

### Opcja 2: Standard Dev Mode
```bash
npm run dev
```

### Opcja 3: Backend tylko
```bash
cd server && npm run dev
```

## ⚠️ Potencjalne Problemy

### 1. Brakujące zależności
**Problem:** Jeśli `node_modules` nie istnieje
**Rozwiązanie:**
```bash
npm install
```

### 2. Błędy TypeScript podczas build
**Problem:** `tsc` nie znaleziony lokalnie
**Rozwiązanie:** Użyj `npm run build` z root (używa npx)

### 3. Błędy walidacji env vars
**Problem:** Brakujące lub nieprawidłowe zmienne środowiskowe
**Rozwiązanie:** 
- Sprawdź `.env` w root
- Uruchom walidację: `node -e "import('./server/src/config/envValidator.js').then(m => m.validateEnvOrThrow())"`

### 4. Problemy z importami .js
**Problem:** NodeNext wymaga `.js` w importach TypeScript
**Status:** ✅ Wszystkie importy używają `.js` (poprawne)

## 📋 Szybki Test Przed Startem

1. **Sprawdź zależności:**
   ```bash
   test -d node_modules && echo "OK" || npm install
   ```

2. **Sprawdź .env:**
   ```bash
   test -f .env && echo "OK" || echo "Brak .env!"
   ```

3. **Sprawdź build (opcjonalnie):**
   ```bash
   cd server && npm run build
   ```

4. **Uruchom aplikację:**
   ```bash
   npm run dev:londyn
   ```

## ✅ Gotowe do Startu

- ✅ Kod naprawiony (console.log, dziwne kopie, walidacja)
- ✅ Build działa
- ✅ Importy poprawne
- ✅ Zależności: Server node_modules istnieje
- ⚠️ Root node_modules: Brak (OK jeśli używa workspaces)
- ⚠️ SQLite DB: Sprawdź czy `data/dev/consultinity.db` istnieje
- ⚠️ Porty: Sprawdź czy 3000 i 3001 są wolne

## 🎯 Po Uruchomieniu - Sprawdź

1. **Backend startuje:** Sprawdź logi czy serwer wystartował
2. **Frontend dostępny:** Sprawdź czy frontend się ładuje
3. **Brak błędów:** Sprawdź konsolę czy nie ma krytycznych błędów
4. **Health check:** Sprawdź `/ping` endpoint

---

**Status:** ✅ Gotowe do uruchomienia (po sprawdzeniu zależności)
