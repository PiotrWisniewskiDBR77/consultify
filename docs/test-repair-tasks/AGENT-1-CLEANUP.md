# Agent 1: Oczyszczenie (Cleanup)

**Rola:** Usunięcie duplikatów, porządkowanie, przygotowanie bazy pod Agent 2 i 3.

**Priorytet:** PIERWSZY — musi skończyć przed Agent 2 i 3.

---

## Zadania (w kolejności)

### Zadanie 1.1: Skrypt remove-duplicates.sh

**Utwórz plik:** `scripts/testing/remove-duplicates.sh`

**Zawartość:**

```bash
#!/bin/bash
# Usuwa duplikaty plików testowych (test 2.ts, test 3.ts, itd.)
# Użycie: ./scripts/testing/remove-duplicates.sh [--dry-run|--execute]

set -e
DRY_RUN=true
if [ "$1" = "--execute" ]; then
  DRY_RUN=false
fi

echo "🔍 Szukam duplikatów..."

# tests/
count_tests=$(find tests/ -type f \( -name "* 2.*" -o -name "* 3.*" -o -name "* 4.*" -o -name "* 5.*" \) 2>/dev/null | wc -l)
# server/tests/
count_server=$(find server/tests/ -type f \( -name "* 2.*" -o -name "* 3.*" -o -name "* 4.*" -o -name "* 5.*" \) 2>/dev/null | wc -l)

echo "Znaleziono: $count_tests w tests/, $count_server w server/tests/"

if [ "$DRY_RUN" = true ]; then
  echo "📋 DRY RUN - lista plików do usunięcia:"
  find tests/ server/tests/ -type f \( -name "* 2.*" -o -name "* 3.*" -o -name "* 4.*" -o -name "* 5.*" \) 2>/dev/null || true
  echo "⚠️  Uruchom z --execute aby usunąć."
  exit 0
fi

echo "🗑️  Usuwam..."
find tests/ -type f \( -name "* 2.*" -o -name "* 3.*" -o -name "* 4.*" -o -name "* 5.*" \) -delete 2>/dev/null || true
find server/tests/ -type f \( -name "* 2.*" -o -name "* 3.*" -o -name "* 4.*" -o -name "* 5.*" \) -delete 2>/dev/null || true
echo "✅ Usunięto duplikaty testów."
```

**Weryfikacja:** `chmod +x scripts/testing/remove-duplicates.sh`

---

### Zadanie 1.2: Usunięcie duplikatów testów

1. Uruchom `./scripts/testing/remove-duplicates.sh --dry-run` — sprawdź listę
2. Zrób commit obecnego stanu (backup)
3. Uruchom `./scripts/testing/remove-duplicates.sh --execute`
4. Uruchom `npm run test:unit` — upewnij się że testy nadal działają
5. Commit: `fix: remove duplicate test files (test 2, 3, 4, 5)`

---

### Zadanie 1.3: Usunięcie duplikatów workflow

**Ścieżki do sprawdzenia:** `.github/workflows/`

**Pliki do usunięcia** (wszystkie z " 2", " 3", " 4" ... w nazwie):

- `test-suite 2.yml`, `test-suite 3.yml`
- `security-scan 2.yml` … `security-scan 13.yml`
- Wszystkie inne `* 2.*`, `* 3.*` itd.

**Zostawić:** `test-suite.yml`, `security-scan.yml` (jeśli istnieje oryginał), `i18n-check.yml`

**Skrypt (opcjonalnie):**

```bash
cd .github/workflows/
for f in *\ 2.* *\ 3.* *\ 4.* *\ 5.*; do
  [ -f "$f" ] && rm -v "$f"
done
```

**Weryfikacja:** `ls .github/workflows/` — brak plików z spacją i cyfrą.

**Commit:** `fix: remove duplicate workflow files`

---

### Zadanie 1.4: Skrypt audit-extensionless.sh

**Utwórz plik:** `scripts/testing/audit-extensionless.sh`

**Cel:** Lista plików `.test` bez rozszerzenia (.ts/.tsx/.js) — nie są wykonywane przez Vitest.

**Zawartość:**

```bash
#!/bin/bash
# Lista plików .test bez rozszerzenia (martwe pliki)
echo "🔍 Pliki .test bez rozszerzenia (nie wykonywane przez Vitest):"
find tests/ server/tests/ -type f -name "*.test" 2>/dev/null | head -50
echo "..."
total=$(find tests/ server/tests/ -type f -name "*.test" 2>/dev/null | wc -l)
echo "Razem: $total plików"
```

**Weryfikacja:** Uruchom, zapisz output do `docs/test-repair-tasks/EXTENSIONLESS-AUDIT.txt` (dla decyzji później)

---

### Zadanie 1.5: Oznaczenie placeholderów (opcjonalne, limit 5 katalogów)

**Katalogi:** `tests/unit/mes/`, `tests/unit/hse/`, `tests/unit/qms/`, `tests/unit/industrial/`, `tests/unit/scheduler/`

**Akcja:** Na początku każdego pliku `.test.ts` w tych katalogach dodaj:

```typescript
/**
 * @test-quality PLACEHOLDER - needs real implementation
 * @see docs/testing/plans/TEST_REMEDIATION_PLAN.md
 */
```

**Uwaga:** To opcjonalne. Można pominąć jeśli czas ograniczony — Agent 2 i tak wykryje placeholdery przez quality-check.

---

## Kryteria ukończenia (Agent 1)

- [ ] `scripts/testing/remove-duplicates.sh` istnieje i działa
- [ ] `find tests/ -name "* 2.*"` zwraca 0 plików
- [ ] `find server/tests/ -name "* 2.*"` zwraca 0 plików
- [ ] `.github/workflows/` nie zawiera plików " 2", " 3" itd.
- [ ] `scripts/testing/audit-extensionless.sh` istnieje
- [ ] `npm run test:unit` przechodzi (lub ten sam stan co przed)
- [ ] Commit z opisem zmian

---

## Raportowanie

Po zakończeniu wypełnij:

```
AGENT 1 - RAPORT UKOŃCZENIA
Data: [DATA]
- Usunięto plików testowych: [N]
- Usunięto plików workflow: [N]
- Problemy napotkane: [OPIS LUB BRAK]
- npm run test:unit: [PASS/FAIL]
```

---

## Następny krok

Po zatwierdzeniu przez nadzorcę — Agent 2 i Agent 3 mogą rozpocząć pracę.
