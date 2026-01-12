# 📖 README - Cursor Zadania

## Struktura Foldera

```
cursor_zadania/
├── README.md                 # Ten plik
├── CURSOR_TASKS.md          # Zadania dla Cursor
├── CODEX_TASKS.md           # Zadania dla Codex
├── ANTIGRAVITY_TASKS.md     # Zadania dla Antigravity
└── TEAM_COORDINATION.md     # Koordynacja zespołu
```

## Quick Start

### Dla Cursor
```bash
# 1. Przeczytaj zadania
cat cursor_zadania/CURSOR_TASKS.md

# 2. Rozpocznij BATCH 1
npm run type-check 2>&1 | tee typescript_errors.log

# 3. Napraw błędy TypeScript

# 4. Zaktualizuj Master Plan
# Oznacz: [x] Rozwiązanie wszystkich 700+ błędów TS
```

### Dla Codex
```bash
# 1. Przeczytaj zadania
cat cursor_zadania/CODEX_TASKS.md

# 2. Rozpocznij BATCH 1
# Analiza dużych serwisów

# 3. Refaktoryzuj serwisy

# 4. Zaktualizuj Master Plan
# Oznacz: [x] Rozbicie monolitycznych serwisów
```

### Dla Antigravity
```bash
# 1. Przeczytaj zadania
cat cursor_zadania/ANTIGRAVITY_TASKS.md

# 2. Rozpocznij BATCH 1
npx create-nx-workspace@latest consultify-monorepo

# 3. Ekstrakcja shared packages

# 4. Zaktualizuj Master Plan
# Oznacz: [x] Initialize Nx workspace
```

## Master Plan Location

```
/Users/piotrwisniewski/.gemini/antigravity/brain/658d69d2-2532-40ab-b8fb-afc9d441319b/refactoring_master_plan.md
```

## Ważne Zasady

1. **Zawsze aktualizuj Master Plan** po ukończeniu zadania
2. **Testuj przed commitem**: `npm run test && npm run type-check`
3. **Komunikuj blokery** w TEAM_COORDINATION.md
4. **Małe, atomowe commity**
5. **Dokumentuj decyzje**

## Pomoc

Jeśli masz pytania:
- Sprawdź Master Plan
- Sprawdź TEAM_COORDINATION.md
- Sprawdź raporty audytu w `.gemini/antigravity/brain/`

**Powodzenia!** 🚀
