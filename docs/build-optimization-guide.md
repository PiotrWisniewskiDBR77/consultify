# Build Optimization Guide

**Wersja:** 1.0  
**Data:** 2025-01-03

## Obecna Konfiguracja

### TypeScript Compiler Options
- **Target:** ES2022
- **Module:** NodeNext (ES Modules)
- **Incremental:** ✅ Enabled
- **Skip Lib Check:** ✅ Enabled
- **Source Maps:** ✅ Enabled

### Build Scripts
```json
{
  "build": "tsc --build",
  "build:clean": "rm -rf dist && tsc --build",
  "build:watch": "tsc --build --watch",
  "build:fast": "tsc --build --incremental"
}
```

## Optymalizacje Build

### 1. Incremental Builds
TypeScript używa pliku `.tsbuildinfo` do śledzenia zmian między buildami:
```bash
npm run build:fast  # Szybszy build dla małych zmian
```

### 2. Clean Build
Dla pełnego rebuild:
```bash
npm run build:clean  # Czyści dist i buduje od nowa
```

### 3. Watch Mode
Dla development:
```bash
npm run build:watch  # Automatyczny rebuild przy zmianach
```

## Performance Metrics

### Build Times (szacunkowe)
- **Full Build:** ~30-60 sekund (zależnie od liczby plików)
- **Incremental Build:** ~5-15 sekund (tylko zmienione pliki)
- **Type Check:** ~10-20 sekund (bez emit)

### Optymalizacje

#### 1. Project References (Zaawansowane)
Dla dużych projektów można użyć project references:
```json
{
  "compilerOptions": {
    "composite": true
  },
  "references": [
    { "path": "./services" },
    { "path": "./routes" }
  ]
}
```

#### 2. Exclude Test Files
Testy są wykluczone z build:
```json
{
  "exclude": [
    "**/*.test.ts",
    "**/*.spec.ts"
  ]
}
```

#### 3. Skip Lib Check
Pomija sprawdzanie typów w node_modules:
```json
{
  "skipLibCheck": true
}
```

## Monitoring Build Performance

### Mierzenie Czasu Build
```bash
# Full build time
time npm run build

# Incremental build time
time npm run build:fast
```

### Analiza Build Output
```bash
# Sprawdź rozmiar dist
du -sh dist/

# Sprawdź liczbę plików
find dist -name "*.js" | wc -l
```

## Troubleshooting

### Problem: Build jest wolny
**Rozwiązania:**
1. Użyj incremental builds: `npm run build:fast`
2. Sprawdź czy `skipLibCheck: true` jest włączone
3. Wyklucz niepotrzebne pliki z build
4. Rozważ project references dla dużych projektów

### Problem: Build info file jest duży
**Rozwiązanie:** Okresowo czyść `.tsbuildinfo`:
```bash
npm run clean
```

### Problem: Build nie wykrywa zmian
**Rozwiązanie:** Użyj clean build:
```bash
npm run build:clean
```

## Best Practices

1. **Development:** Użyj `tsx watch` zamiast build (szybsze)
2. **CI/CD:** Użyj `npm run build` dla pełnego build
3. **Local Testing:** Użyj `npm run build:fast` dla szybkich iteracji
4. **Production:** Zawsze użyj clean build przed deployment

## Przyszłe Optymalizacje

### 1. SWC Compiler
Rozważ użycie SWC zamiast TypeScript compiler dla szybszych buildów:
```bash
npm install --save-dev @swc/cli @swc/core
```

### 2. Parallel Builds
Dla dużych projektów można użyć równoległych buildów:
```bash
# Użyj pnpm lub yarn workspaces
pnpm build --parallel
```

### 3. Build Cache
Rozważ użycie build cache (np. Turborepo):
```bash
npm install --save-dev turbo
```





