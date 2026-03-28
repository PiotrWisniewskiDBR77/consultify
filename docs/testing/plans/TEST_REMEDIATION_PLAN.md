# Plan Naprawczy Systemu Testów — 3 Agenty + Nadzór

**Wersja:** 1.0  
**Data:** 2026-02-14  
**Model:** 3 agenty równoległe + nadzór do pełnego sukcesu

---

## Przegląd

| Agent       | Domena                     | Plik zadań                                         | Kolejność                                        |
| ----------- | -------------------------- | -------------------------------------------------- | ------------------------------------------------ |
| **Agent 1** | Oczyszczenie               | `docs/test-repair-tasks/AGENT-1-CLEANUP.md`        | **PIERWSZY** (blokuje 2 i 3)                     |
| **Agent 2** | Infrastruktura weryfikacji | `docs/test-repair-tasks/AGENT-2-INFRASTRUCTURE.md` | **DRUGI** (po Agent 1)                           |
| **Agent 3** | Prawdziwe testy            | `docs/test-repair-tasks/AGENT-3-REAL-TESTS.md`     | **TRZECI** (może startować równolegle z Agent 2) |

**Nadzór:** `docs/test-repair-tasks/SUPERVISOR-GUIDE.md` — checkpointy, kryteria sukcesu, weryfikacja końcowa.

---

## Zależności między agentami

```
Agent 1 (Oczyszczenie) ──► Agent 2 (Infrastruktura) ──┐
         │                                              ├──► SUKCES
         └──────────────────► Agent 3 (Prawdziwe testy) ─┘
```

- **Agent 1** musi skończyć przed Agent 2 i 3 (usuwa duplikaty, porządkuje)
- **Agent 2** i **Agent 3** mogą pracować równolegle po zakończeniu Agent 1
- **Agent 2** dostarcza skrypty (`quality-check`, `block-duplicates`) — Agent 3 ich nie potrzebuje do pisania testów
- **Sukces** = wszystkie 3 agenty zakończone + weryfikacja nadzorcy

---

## Kryteria sukcesu (pełny sukces)

| #   | Kryterium                            | Jak zweryfikować                                               |
| --- | ------------------------------------ | -------------------------------------------------------------- |
| 1   | Brak duplikatów                      | `find tests/ -name "* 2.*"` zwraca 0 plików                    |
| 2   | Brak duplikatów workflow             | `find .github/workflows/ -name "* 2.*"` zwraca 0               |
| 3   | Skrypt quality-check działa          | `npm run test:quality-check` zwraca exit 0                     |
| 4   | Skrypt block-duplicates w pre-commit | Pre-commit blokuje plik "test 2.ts"                            |
| 5   | run-audit parsuje real coverage      | Brak hardcoded "96" w run-audit.ts                             |
| 6   | Prawdziwe testy P0 przechodzą        | `npm run test:unit:critical` + `npm run test:integration` pass |
| 7   | CI ma job test-quality-check         | Workflow zawiera `test-quality-check`                          |
| 8   | Autentyczność ≥ 25%                  | `npm run test:quality-check` raportuje ≥ 25%                   |

---

## Jak używać

1. **Przeczytaj** `SUPERVISOR-GUIDE.md` — checkpointy, kolejność, weryfikacja
2. **Wydaj pracę Agent 1** — skopiuj prompt z `PROMPT-FOR-3-AGENTS.md`
3. **Zweryfikuj** po Agent 1 (checkpoint 1)
4. **Wydaj pracę Agent 2 i Agent 3** (można równolegle)
5. **Zweryfikuj** po każdym (checkpoint 2 i 3)
6. **Weryfikacja końcowa** — checklist z SUPERVISOR-GUIDE

---

## Pliki do utworzenia przez agentów

| Plik                                           | Agent | Opis                                                                |
| ---------------------------------------------- | ----- | ------------------------------------------------------------------- |
| `scripts/testing/remove-duplicates.sh`         | 1     | Usuwanie duplikatów                                                 |
| `scripts/testing/audit-extensionless.sh`       | 1     | Lista plików .test bez rozszerzenia                                 |
| `scripts/testing/quality-check.ts`             | 2     | Wykrywanie placeholderów                                            |
| `scripts/testing/block-duplicates.sh`          | 2     | Blokada pre-commit                                                  |
| `scripts/testing/verify-integrity.js`          | 2     | Weryfikacja integracji                                              |
| Modyfikacja `run-audit.ts`                     | 2     | Parsowanie real coverage                                            |
| Modyfikacja `.husky/pre-commit`                | 2     | Integracja block-duplicates                                         |
| Modyfikacja `.github/workflows/test-suite.yml` | 2     | Job test-quality-check                                              |
| Prawdziwe testy P0                             | 3     | Auth, billing, access policy, component, integration, E2E, security |

---

_Plan żywy — aktualizuj po każdej fazie._
