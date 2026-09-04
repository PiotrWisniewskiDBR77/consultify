# R5 — ZASTANA kontra REGRESJA

## Baza i kompilowalność

Baza porównawcza: `f65c4ff6a0`, marker użyty przez dyżur 336 do jego klasyfikacji. Utworzono odłączony sparse-worktree w `/private/tmp/cx-day347-403-przyczyna-artefakty/baza`, aby nie zejść poniżej progu 5 GiB.

Z 142 bieżących czerwieni wyprowadzono 26 unikalnych plików testowych. Wszystkie 26 istniały na bazie i każdy przeszedł `npx esbuild` (`ESBUILD_OK=26`, `MISSING=0`) przed uruchomieniem testów.

## Wynik po pełnych nazwach

| Klasa | Liczba |
| --- | ---: |
| ZASTANA | 139 |
| REGRESJA | 2 |
| NIEORZECZONA | 1 |
| **Suma** | **142** |

Pełna tabela `fullName` → klasa i status na bazie znajduje się w `r5-klasy.tsv`. Imienny dług zastany znajduje się w `dlug-po-naprawie.md`.

Regresje:

1. `02-interview-serwer.json | interviewAiReviewTimeoutFallback.pg.test.ts | evaluateSessionAnswers server-side timeout — real PostgreSQL HEADLINE: responds within the bound with an explicit, non-fabricated fallback — and the persisted answer is untouched` — na bazie PASS, na pełnym HEAD 2005 ms wobec progu `<2000`; natychmiastowy recheck HEAD 2/2 PASS, więc to niestabilność czasowa, ale według reguły `fullName` pozostaje klasą REGRESJA dla tego przebiegu.
2. `09-results-serwer.json | roiFinanceSeam.routes.test.ts | POST .../finance-reconciliations 201s on success` — na bazie PASS, na HEAD FAIL również po korekcie przyczyny 403.

NIEORZECZONA:

- `12-audits-serwer.json | fixtureGenerator.pg.test.ts | auditProgramFixtures — fixture skali Audits (Postgres realny — AUD-MVP-DATA-001) CLEANUP: po sprzątaniu wszystkie pięć liczników wraca do zera, zero wierszy claude_a_ pozostaje` — na bazie przypadek był `skipped`, więc baza nie wykonała asercji.

## Mianownik bazy

- grupa Results/Finance bez `enforce`: 156 testów, 26 PASS, 114 FAIL, 16 pending;
- pozostałe pliki z `enforce`: 108 testów, 58 PASS, 25 FAIL, 25 pending.

Do klasyfikacji użyto wyłącznie dokładnego statusu tej samej pełnej nazwy. `failed` po obu stronach oznacza ZASTANA; `passed` na bazie i `failed` na HEAD oznacza REGRESJA; `skipped`/brak wykonania oznacza NIEORZECZONA.

## Dysk i sprzątanie

Przed usunięciem bazowego worktree: 8.3 GiB wolnego. Po usunięciu: 8.6 GiB. Vault potwierdził `BAZOWY WORKTREE USUNIETY`.

