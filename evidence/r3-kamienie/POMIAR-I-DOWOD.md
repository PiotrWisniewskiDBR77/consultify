# R3 — kamienie milowe i baseline: pomiar, dowód, granice

Data: 2026-09-06 (noc). Gałąź `mvp/r3-kamienie-milowe`.
Środowisko dowodowe: **własna** baza `127.0.0.1:55611` (kontener `r3-milestones-pg`,
usunięty po teście), **własne** API `127.0.0.1:4141`, **własny** vite `localhost:3141`.
Baza właściciela (54400) była czytana i **nie została zapisana**.

## 1. Co kolumna „Odchylenie (dni)" liczyła PRZED

`src/components/Execution/executionRealData.ts:163` (przed zmianą):

```
export function initiativeDeviationDays(initiative, now = Date.now()) {
  const end = parseDate(initiative?.plannedEndDate);
  if (end == null) return null;
  return Math.floor((now - end) / DAY_MS);          // ← dziś − AKTUALNY plan
}
```

Czyli **dni pozostałe do końca AKTUALNEGO planu ze znakiem minus**, a nie odchylenie
od czegokolwiek. Stąd zrzut `evidence/realizacja-filtr/PO-realizacje.png`:
−55, −48, −35, −90 obok RAG „Na czas" w każdym wierszu. Miara była z definicji ślepa
na to, co miała mierzyć: **przesunięcie `plannedEndDate` kasowało opóźnienie bez śladu**.

## 2. Co istniało w bazie PRZED (pomiar na 54400, org DBR77)

| Byt | Stan |
| --- | --- |
| `initiative_milestones` | ISTNIEJE, **16 rekordów**, dwie daty: `target_date`, `actual_date`. **Brak trzeciej — planowanej zamrożonej.** |
| `initiative_schedule_baselines` | ISTNIEJE, **0 rekordów** |
| `initiatives.baseline_version` | 0 na **wszystkich** 72 inicjatywach |
| `delay_signals` | ISTNIEJE, **0 rekordów** → sygnał „Legacy Decommission / LATE_START / 40 dni", na który powołuje się plan, **NIE ISTNIEJE w danych** |
| inicjatywa „Legacy Decommission" | ISTNIEJE (`3258858d-…`), plan 27.07.2026 → 04.12.2026 |

## 3. Dowód wizualny

`PO-realizacje-odchylenie-od-baseline.png` — trasa `/execution?tab=list&view=table`,
1440 px, motyw jasny, `bledyKonsoli: []`, URL ≠ `/login`.
· **Legacy Decommission: +40** (baseline 04.12.2026, plan aktualny 13.01.2027) — czerwone
· ERP SAP Integration: +65 (po re-baseline'ie z decyzją)
· pozostałe: `0` — neutralne (plan zgodny ze zobowiązaniem), `—` dla inicjatyw bez dat.

+40 powstało **przez sam mechanizm R3** (pierwsze, dozwolone przesunięcie daty o 40 dni
względem zamrożonego planu), a nie przez wpisanie liczby — bo sygnału z planu w bazie nie ma.

## 4. Dowód reguły (mutacja)

`mutacja-rebaseline-inicjatywa.txt` — pełny zapis HTTP:
przesunięcie 1 bez decyzji → **200**; przesunięcie 2 bez decyzji → **409
`REBASELINE_DECISION_REQUIRED`**; z decyzją bez zatwierdzającego → **409
`REBASELINE_APPROVER_REQUIRED`**; z decyzją i zatwierdzającym → **200** + wiersz
w `initiative_rebaseline_log`.

`mutacja-rebaseline-kamien.txt` — ta sama próba na KAMIENIU: **nieosiągalna**
(409 `EXECUTION_RUNTIME_V1_WRITE_REQUIRED` z middleware, decyzja 26A). Udowodniony
jest tam wyłącznie **odczyt trzech dat** + `deviationDays`.

## 5. Migracja

`server/migrations/20262106_r3_milestone_baseline_rebaseline.sql`, addytywna.
Pełny łańcuch od PUSTEJ bazy: **0 błędów** (`✅ Postgres migrations complete`).
Drugi przebieg całego łańcucha: `Applying migrations: 0`. Wymuszony drugi przebieg
samego pliku (skasowany wiersz w `schema_migrations`): 0 błędów — **idempotentna**.
Backfill zamroził plan zastany jako baseline v1: 15/15 inicjatyw z datą, 16/16 kamieni.
