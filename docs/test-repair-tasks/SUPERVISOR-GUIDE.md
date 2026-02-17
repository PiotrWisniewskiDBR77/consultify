# Przewodnik nadzorcy — 3 agenty do pełnego sukcesu

**Rola nadzorcy:** Wydawanie pracy agentom, weryfikacja checkpointów, zatwierdzenie końcowe.

---

## Kolejność pracy

```
1. Agent 1 (Oczyszczenie)     → CHECKPOINT 1
2. Agent 2 (Infrastruktura)   → CHECKPOINT 2
   Agent 3 (Prawdziwe testy)  → CHECKPOINT 3   [równolegle z Agent 2]
3. WERYFIKACJA KOŃCOWA      → SUKCES
```

---

## CHECKPOINT 1: Po Agent 1

**Wydaj pracę:** Skopiuj prompt z `PROMPT-FOR-3-AGENTS.md` → Agent 1

**Po zakończeniu Agent 1 — zweryfikuj:**

| #   | Sprawdzenie                       | Komenda / Akcja                                                  |
| --- | --------------------------------- | ---------------------------------------------------------------- | ---------------- |
| 1   | Brak duplikatów w tests/          | `find tests/ -name "* 2.*" -o -name "* 3.*"` → powinno zwrócić 0 |
| 2   | Brak duplikatów w server/tests/   | `find server/tests/ -name "* 2.*"` → 0                           |
| 3   | Brak duplikatów workflow          | `ls .github/workflows/                                           | grep " 2"` → nic |
| 4   | Skrypt remove-duplicates istnieje | `ls scripts/testing/remove-duplicates.sh`                        |
| 5   | Testy nadal działają              | `npm run test:unit` → pass                                       |

**Jeśli wszystko OK:** Zatwierdź Agent 1, wydaj pracę Agent 2 i Agent 3.

**Jeśli coś failuje:** Zwróć Agent 1 do poprawki.

---

## CHECKPOINT 2: Po Agent 2

**Wydaj pracę:** Skopiuj prompt z `PROMPT-FOR-3-AGENTS.md` → Agent 2

**Po zakończeniu Agent 2 — zweryfikuj:**

| #   | Sprawdzenie                   | Komenda / Akcja                                                           |
| --- | ----------------------------- | ------------------------------------------------------------------------- |
| 1   | quality-check działa          | `npm run test:quality-check`                                              |
| 2   | block-duplicates w pre-commit | `grep block-duplicates .husky/pre-commit` → znaleziono                    |
| 3   | run-audit bez hardcoded 96    | `grep "96" scripts/testing/run-audit.ts` → nie powinno być                |
| 4   | CI ma job test-quality-check  | `grep "test-quality-check" .github/workflows/test-suite.yml` → znaleziono |
| 5   | test:integrity działa         | `npm run test:integrity`                                                  |

**Jeśli wszystko OK:** Zatwierdź Agent 2.

**Jeśli quality-check failuje (autentyczność < 25%):** To oczekiwane przed Agent 3. Zatwierdź Agent 2, Agent 3 ma podnieść autentyczność.

---

## CHECKPOINT 3: Po Agent 3

**Wydaj pracę:** Skopiuj prompt z `PROMPT-FOR-3-AGENTS.md` → Agent 3

**Po zakończeniu Agent 3 — zweryfikuj:**

| #   | Sprawdzenie                 | Komenda / Akcja                                                            |
| --- | --------------------------- | -------------------------------------------------------------------------- |
| 1   | Prawdziwe testy przechodzą  | `npm run test:unit` + `npm run test:integration` + `npm run test:security` |
| 2   | quality-check autentyczność | `npm run test:quality-check` → exit 0, autentyczność ≥ 25%                 |
| 3   | Brak regresji               | `npm run test:all` → pass                                                  |

---

## WERYFIKACJA KOŃCOWA (pełny sukces)

| #   | Kryterium                     | Jak zweryfikować                                               |
| --- | ----------------------------- | -------------------------------------------------------------- |
| 1   | Brak duplikatów               | `find tests/ server/tests/ -name "* 2.*" -o -name "* 3.*"` → 0 |
| 2   | Brak duplikatów workflow      | `find .github/workflows/ -name "* 2.*"` → 0                    |
| 3   | quality-check                 | `npm run test:quality-check` → exit 0                          |
| 4   | block-duplicates w pre-commit | `grep block-duplicates .husky/pre-commit`                      |
| 5   | run-audit bez hardcoded       | `grep -c "~96%" scripts/testing/run-audit.ts` → 0              |
| 6   | Prawdziwe testy P0            | `npm run test:unit:critical` + `npm run test:integration` pass |
| 7   | CI ma test-quality-check      | Job w workflow                                                 |
| 8   | Autentyczność ≥ 25%           | `npm run test:quality-check` raportuje                         |
| 9   | test:integrity                | `npm run test:integrity` → exit 0                              |

**Wszystkie 9 = SUKCES.**

---

## Co robić gdy agent się zgubi

1. **Przypomnij:** "Przeczytaj plik zadań: docs/test-repair-tasks/AGENT-X-\*.md"
2. **Sprawdź kryteria ukończenia** na końcu pliku agenta
3. **Uruchom weryfikację** z tego przewodnika
4. **Jeśli coś failuje:** Wskaż konkretny punkt (np. "Checkpoint 1, punkt 1 — nadal są duplikaty")

---

## Szablony komunikatów

### Wydanie pracy Agent 1

```
Skopiuj prompt "Agent 1" z docs/test-repair-tasks/PROMPT-FOR-3-AGENTS.md i wklej do agenta.
```

### Wydanie pracy Agent 2 + 3 (po Agent 1)

```
Agent 1 zakończony. Checkpoint 1 passed.
Wydaj pracę Agent 2 i Agent 3 — skopiuj prompty z PROMPT-FOR-3-AGENTS.md.
Można uruchomić obu równolegle (w różnych sesjach).
```

### Zwrot do poprawki

```
Agent [X], Checkpoint [N] nie passed.
- Punkt [nr]: [opis problemu]
- Napraw i zgłoś ponownie.
```

### Zatwierdzenie końcowe

```
Wszystkie checkpoints passed. Weryfikacja końcowa OK.
SUKCES — plan naprawczy zakończony.
```

---

## Cykliczna weryfikacja (po zakończeniu)

Co 2 tygodnie (lub przed release):

1. `npm run test:integrity`
2. `npm run test:quality-check`
3. `find tests/ -name "* 2.*"` → 0
4. Sprawdź czy nikt nie przywrócił hardcoded w run-audit

---

_Nadzorca: Ty. Agenty: 1, 2, 3. Cel: pełny sukces._
