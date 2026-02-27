# Plan Rozwoju Systemu Testow Automatycznych (0-3-6 miesiecy)

## Summary
Celem planu jest szybkie ustabilizowanie i uwiarygodnienie uruchamiania testow (Etap 0), nastepnie zbudowanie spojnego i efektywnego pipeline'u testowego (Etap 1), oraz podniesienie dojrzalosci (wydajnosc, niezawodnosc, automatyczne governance) w Etapie 2. Plan zaklada podzial zadan miedzy Agentow 1/2/3 i mierzalne kryteria sukcesu.

## Zakres i priorytety
- Zakres: System testow automatycznych (backend, frontend, integracyjne, security, performance, E2E).
- Priorytet krotkoterminowy: stabilnosc i gate'y jakosci.
- Dokument docelowy: `docs/PLAN_ROZWOJU.md`.

---

## Etap 0 (0-1 miesiac): Stabilnosc i spojnosci uruchomienia
**Cel:** testy uruchamiaja sie deterministycznie, bez "martwych" skryptow, z przejrzystym gate'ingiem.

### Status Etap 0 (aktualizacja)
- Naprawione uruchamianie performance (TS/JS + legacy).
- `test:memory-leak` przeniesiony do osobnego, dlugiego uruchomienia.
- `test:database` usuniety (martwy skrypt).
- `tests/component` ujednolicone do `tests/components`.
- Runbook CI: `docs/testing/CI_TESTING_RUNBOOK.md`.

### Zadania - Agent 1 (Testy/Backend)
1. Naprawa uruchamiania testow performance:
   - `vitest.perf.config.ts`: wlaczenie `*.test.{ts,js}` oraz obslugi plikow bez rozszerzenia (jesli zostaja).
2. Naprawa `test:memory-leak`:
   - Ujednolicenie sciezki do faktycznego pliku lub rename na `.test.ts/.test.js`.
3. Usuniecie lub naprawa `test:database` (brak katalogu).
4. Weryfikacja uruchomienia `test:performance` i `test:memory-leak` w CI/local.

### Zadania - Agent 2 (Infra/Quality Gates)
1. Ujednolicenie katalogow testow komponentowych:
   - Decyzja: `tests/components` jako jedyny katalog.
   - Migracja lub usuniecie `tests/component` z aktualizacja skryptow.
2. Re-wlaczenie gate'ow jakosci w CI (jesli pre-commit jest wylaczony):
   - `quality-check`, `skip-scan`, `security-integrity` jako obowiazkowe kroki w CI.
3. Aktualizacja `test-runner`:
   - `--changed-only` na merge-base (spojnosc z `test-impact-analysis`).

### Zadania - Agent 3 (Docs/Standaryzacja)
1. Uporzadkowanie dokumentacji testowej:
   - `tests/README.md` i `tests/SUMMARY.md` jako jeden "source of truth" (aktualne liczby, realny coverage, aktywne skrypty).
2. Zdefiniowanie standardu nazewnictwa (bez " 2", " 3", bez extensionless).
3. Wprowadzenie krotkiego "Runbook" dla developerow: 5-10 komend w praktyce.

### Kryteria sukcesu Etap 0
- `test:performance` uruchamia >= 90% testow z `tests/performance`.
- `test:memory-leak` nie wskazuje na nieistniejacy plik.
- Brak "martwych" skryptow w `package.json` (kazdy dziala lub jest usuniety).
- CI zawiera obowiazkowy gate: `quality-check` + `skip-scan`.

---

## Etap 1 (1-3 miesiace): Efektywnosc i governance
**Cel:** szybkie i tanie testy na PR + pelne testy w nocy, minimalna liczba flaky testow.

### Zadania - Agent 1 (Testy/Backend)
1. Rozbudowa testow integracyjnych w kluczowych sciezkach:
   - krytyczne middleware, auth, billing, security.
2. Zapewnienie "deterministic DB":
   - jednolity bootstrap, reset, i fixtures dla integracji.

### Zadania - Agent 2 (Infra/CI)
1. Pipeline testow:
   - PR: L1 + L2 + `test:impact` (targeted).
   - Nightly: L3 + security + performance.
   - Weekly: L4 E2E + pelny smoke.
2. Automatyczne raporty:
   - `quality-scorecard` + `flaky-test-tracker` jako artefakty.
3. Definicja "fail fast":
   - gate na `skip/only` oraz `quality-check` w kazdym PR.

### Zadania - Agent 3 (Docs/Monitoring)
1. Dashboard metryk:
   - pass rate, flaky rate, CI runtime, coverage.
2. Proces "Flaky cleanup":
   - SLA: 48h na naprawe flakow z raportu.

### Kryteria sukcesu Etap 1
- Flaky rate < 2% (testy niestabilne / calosc).
- PR pipeline < 20 min przy sredniej zmianie.
- Nightly przechodzi >= 95% przez 4 tygodnie.

---

## Etap 2 (3-6 miesiecy): Dojrzalosc i wydajnosc
**Cel:** testy wydajnosciowe i E2E steruja ryzykiem produkcyjnym.

### Zadania - Agent 1 (Testy/Backend)
1. Wydajnosc i SLO:
   - zdefiniowanie baseline p95/p99 i alertow regresji.
2. Testy kontraktowe (consumer/provider) na krytycznych API.

### Zadania - Agent 2 (Infra/CI)
1. Stabilny environment dla E2E:
   - hermetyczne srodowiska testowe (ephemeral).
2. Rozdzielenie testow performance na "quick" i "full".

### Zadania - Agent 3 (Docs/Standardy)
1. "Testing Maturity Model" i decyzje architektoniczne w docs.
2. Formalny "Definition of Done" dla nowych modulow.

### Kryteria sukcesu Etap 2
- Performance regresje wykrywane automatycznie w <= 24h.
- Testy E2E w tygodniu: pass rate >= 97%.
- Zdefiniowane SLO + budzety wydajnosci.

---

## Zmiany w interfejsach/publicznych kontraktach
- Zmiany w `package.json` (skrypty testow).
- Zmiany w konfiguracjach testow (`vitest.*`, `playwright.*`).
- Brak zmian w publicznym API produktu.

## Test Cases i walidacja
- Uruchomienie `npm run test:performance`, `test:memory-leak`, `test:security`, `test:integration`.
- Weryfikacja `test:impact` dla kilku scenariuszy zmian.
- Sprawdzenie gate'ow `quality-check` i `skip-scan`.

## Zalozenia i domyslne decyzje
- Dokument powstaje jako `docs/PLAN_ROZWOJU.md`.
- System docelowo uzywa `tests/components` jako jedynego katalogu dla komponentow.
- Priorytetem sa gate'y jakosci i stabilnosc, nie wzrost coverage w krotkim terminie.
