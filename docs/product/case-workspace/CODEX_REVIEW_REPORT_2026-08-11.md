# Case Workspace V1 — RAPORT DLA NIEZALEŻNEGO ODBIORU CODEX

**Data:** 2026-08-11
**Status:** `WORK_IN_PROGRESS — NIE JEST KANDYDATEM`

> Ten raport **nie zgłasza kandydata do odbioru**. Sesja została zatrzymana na
> limicie tokenów w trakcie fali naprawczej. Przekazuję zmierzony stan, żeby
> odbiór mógł zacząć się od faktów, a nie od deklaracji.

---

## 1. Tożsamość

| co | wartość |
|---|---|
| worktree | `/Users/piotrwisniewski/dev/consultify-case-workspace-v1-20260809` |
| branch | `claude/case-workspace-v1-20260809` |
| BASE_SHA | `9d17cac11484a82f729a51044e30453e39fbcb02` |
| HEAD | `8c763a5a98` |
| poprzedni checkpoint | `292bafd4e8689ceae1fe72fc17e5d4075c179256` |
| push / merge / deploy | **żaden nie wykonany** |

Statystyki liczone wyłącznie `BASE_SHA..HEAD`.

---

## 2. Bramki — zmierzone, nie deklarowane

Wszystko uruchomione przez koordynatora na **stabilnym drzewie**, przy
wyłączonych agentach.

| bramka | wynik |
|---|---|
| testy domenowe + trasy + kontrakt, realny PostgreSQL | **583 / 588 PASS** |
| `server tsc --noEmit` | 0 błędów |
| `frontend tsc --noEmit` | 0 błędów |
| `git diff --check` (working tree) | 0 naruszeń |
| migracja fresh + idempotentny replay | PASS |
| restart kontenera + readback | PASS |
| bramki kanonu repo | wszystkie ✓ |
| dług fokusa crimson | **spadł** 130→129 plików |

**Pięć awarii** jest znanych, nazwanych i wypisanych w §4. Żadna nie została
zaokrąglona w górę.

---

## 3. Co jest zweryfikowane funkcjonalnie (nie tylko „testy zielone")

- **Ścieżka Teresa → Case działa na żywym backendzie.** Czat informacyjny =
  zero Case. Potwierdzenie = 201 z nowym zleceniem. Powtórka = 200 z **tym
  samym** `caseId` i `caseCreated:false`. W bazie: jeden Case, zdarzenia
  `case.created` + `case.intake.work_order_confirmed`.
- **Wiele Case w jednym projekcie** — potwierdzone zapytaniem HTTP i w bazie;
  `case_core_project_id_key` zdjęty (nazwa odczytana z `pg_constraint`).
- **Append-only egzekwowane triggerami bazodanowymi.** Wcześniej „dowodem" był
  regex po tekście pliku, a `UPDATE`/`DELETE` na outboxie przechodziły.
- **SEC-009** zamknięte na `by-project` i na 12 trasach plan-version, każde
  z kontrolą negatywną.
- **Runtime Run/NodeRun** z restartem w osobnym procesie V8, konkurencyjnym
  claimem i podwójnym startem dającym jeden NodeRun.
- **Worker outboxa wpięty w produkcyjny boot** — miał zero callerów.
- **12/12 scenariuszy Golden Case** pokrytych, z kontrolami negatywnymi.

---

## 4. Otwarte defekty — literalnie

```
P1  CW-SEC-ENUM-PLAYS-01 — cross-tenant Plays ujawniają istnienie (403 vs 404)
P2  OpenAPI: router montuje 125 operacji, spec deklaruje 110; duplikat operationId
P2  liveStack.e2e.part2 — 5. TRANSFORMATION (404 zamiast 200)
P2  liveStack.e2e.part2 — 6. Approval REJECT (400 zamiast 201)
P3  fullChainObservability — socket hang up (podejrzenie starego procesu backendu)
```

Dwa ostatnie były mierzone przy backendzie ze **starym kodem** (`tsx` bez
watch). Backend zrestartowano, ale **nie zdążyłem powtórzyć pomiaru** — więc
nie twierdzę, że to artefakty. To pozostaje do rozstrzygnięcia.

---

## 5. Ograniczenia — zgłoszone, nie ukryte

- Adaptery **Assessment / Results / Documents-Presentation** nie zbudowane.
  Zbudowano cztery kompletne (Decision, Initiative/Execution, KPI, Finance)
  zamiast ośmiu pozornych.
- Polityki join **ANY / N_OF_M** nie zaimplementowane (tylko `ALL`).
- Gałąź niewybrana przez `DECISION_GATEWAY` nie dostaje `SKIPPED`
  w `node_result_acceptances`.
- `advanceRun` nigdy nie deklaruje Run `FAILED` automatycznie — świadome.
- `recordInboxProcessingFailure` to martwy kod.
- Backoff workera per-tick, nie per-row (brak `next_retry_at` w schemacie).
- **30-minutowy Run:** `EVIDENCE_MISSING`.
- **Walidacja schematu OpenAPI:** `BLOCKED` — brak walidatora offline.
- **Matryca a11y** (VoiceOver, axe, pełne 7 breakpointów × 2 motywy):
  częściowa; zmierzone 320/375/430, reszta `EVIDENCE_MISSING`.
- **UI nigdy nie było testowane z żywym backendem w pełnym zakresie** — część
  scenariuszy ma dowód, część nie.

---

## 6. Rejestry — liczby z parsera

```
Wiersze efektywne: 1682
NOT_IMPLEMENTED 1273 · PARTIAL 201 · IMPLEMENTED_AND_PROVEN 187
EVIDENCE_MISSING 16 · OUT_OF_SCOPE_THIS_WAVE 5
IMPLEMENTED_AND_PROVEN bez dowodu: 0
```

Po deduplikacji semantycznej: **836 grup** z 1505 wierszy niosących
`requirement_text`.

**Nie deklaruję „zero GAP".** Znacząca część z 1273 pochodzi z szerokich
dokumentów V8 i może nie należeć do Case Workspace V1 — ale to wymaga
adjudykacji z cytatem kanonu dla każdego wyłączenia i **nie zostało dokończone**.

---

## 7. Trzy rzeczy, na które warto spojrzeć krytycznie przy odbiorze

1. **`DbPromise.run()` połyka błędy SQL** (`fallback:true`) — funkcja zwraca
   wygenerowane id niezależnie od tego, czy cokolwiek zapisano. Znalezione
   w Finance, obronione ponownym odczytem w adapterze, ale **wzorzec jest
   ogólnosystemowy** i prawdopodobnie występuje w innych miejscach repo.
2. **`PiiRedactor` dopasowuje po podciągu** — `'caseName'.includes('name')`
   było prawdą, więc nazwa zlecenia trafiała do zdarzeń jako `[REDACTED]`
   i zabijała weryfikację digestu w całym przepływie intake. Naprawione, ale
   warto sprawdzić inne pola biznesowe pod tym kątem.
3. **Determinizm testów** wymaga `POSTGRES_SKIP_INIT_IN_TEST=1` — bez tego
   równoległe pliki ścigają się o `CREATE INDEX` w `initDb()`. Każdy wynik
   uzyskany bez tej zmiennej jest podejrzany.

---

## 8. Czego ten raport NIE stwierdza

Nie stwierdza gotowości do odbioru. Nie stwierdza `FINAL PASS`. Nie stwierdza,
że zakres V1 jest kompletny. Zgłasza **zmierzony stan pośredni** z otwartą,
literalną listą braków, żeby kolejna sesja i odbiór mogły zacząć od faktów.

Dokumenty towarzyszące:
- `docs/product/case-workspace/RESUME_HANDOFF_2026-08-11.md`
- `docs/product/case-workspace/SUCCESSOR_PROMPT_2026-08-11.md`
