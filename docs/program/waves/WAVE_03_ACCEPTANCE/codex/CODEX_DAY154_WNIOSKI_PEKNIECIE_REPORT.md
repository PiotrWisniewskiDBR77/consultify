# CODEX DAY154 — Wnioski: pęknięcie Wywiad → Wnioski

Data pomiaru: 2026-08-30
Gałąź: `codex/day154-wnioski-pekniecie-20260830`
Marker: `e4ff8e21ae`
Werdykt wykonawcy: **R1–R4 wykonane; B1–B6 i B8 PASS; B7 PARTIAL / assessment NOT PROVEN**.

## Stan wejściowy

Instrukcję odczytano w całości z
`/private/tmp/cx-day154-wnioski-pekniecie-scratch/INSTRUKCJA_DYZUR_154.md`.
Zastosowano `§0.1-BIS`; nie wykonano fetchu, tworzenia worktree ani pushu.

```text
$ git merge-base --is-ancestor e4ff8e21ae HEAD && echo "BAZA OK" || echo "MARKER BRAK — STOP"
BAZA OK
$ git status --short

$ git branch --show-current
codex/day154-wnioski-pekniecie-20260830
$ ls -la node_modules
lrwxr-xr-x@ 1 piotrwisniewski wheel 56 Aug 30 11:50 node_modules -> /Users/piotrwisniewski/Developer/Consultify/node_modules
$ df -h /
Filesystem        Size    Used   Avail Capacity iused ifree %iused Mounted on
/dev/disk3s1s1   1.8Ti    12Gi    27Gi    31%    459k  284M    0% /
$ git rev-parse HEAD
e4ff8e21ae3071592ce40e879a11e44c54998cfb
$ git log --oneline -1
e4ff8e21ae docs(funkcje): odbior 148-152 — pierwszy formalnie oceniony dokument, rubryka FAIL, dwie rozlaczne przyczyny
```

Kontrola zasobów przed startem:

```text
PORT 6040 WOLNY
PORT 4974 WOLNY
PORT 4975 WOLNY
docker ps -a --filter name='^/cx-day154-pg$': brak wyniku
```

Migracje na `pgvector/pgvector:pg16`, kontenerze `cx-day154-pg`, bazie `cx154`
i porcie `127.0.0.1:6040`:

```text
pierwszy przebieg: ✅ Postgres migrations complete
drugi przebieg: Applying migrations: 0
drugi przebieg: ✅ Postgres migrations complete
```

## Korekty wobec instrukcji

1. Rozstrzygnięcia z `§0.1-BIS` przyjęto bez ponownego zgłaszania: nie było
   pushu; martwe odwołanie Z24/§0.4a pominięto; użyto configu poza repo.
2. R1 potwierdził T1–T4. Nie znaleziono migracji koniecznej do naprawy.
3. B7 jest **PARTIAL**, nie PASS. Test udowadnia, że przy awarii interview
   równoległa gałąź tools zapisuje swój wniosek. Gałąź assessment ma niezależny
   defekt R4: zapytanie wybiera `title` i `report_type`, których realna tabela
   `assessment_reports` nie ma, po czym błąd jest połykany. Nie zmieniono go,
   bo nie jest licencjonowany w Day154. Kontynuacja danych assessment w tym
   scenariuszu pozostaje **NOT PROVEN**.
4. Instrukcja zawiera dwa wiersze nazwane B8. Oba spełniono: R4 jest spisane,
   a sekcje „Korekty” i „TWIERDZENIA NIEZWERYFIKOWANE” istnieją.

## R1 — realny schemat

Pomiar `information_schema.columns` po pełnych migracjach dał:

- `interview_insights` (42): `id`, `organization_id`, `title`, `prompt_type`,
  `source_session_ids`, `filters`, `content`, `status`, `error_message`,
  `source_session_count`, `tokens_used`, `generation_time_ms`, `created_by`,
  `created_at`, `updated_at`, `analysis_scope_json`, `material_quality_json`,
  `context_mode`, `analysis_mode`, `topic_focus_json`, `generation_context_json`,
  `section_overrides`, `structured_content`, `evidence_links`, `unknowns`,
  `counterpoints`, `assumptions`, `confidence_score`, `inference_run_id`,
  `insight_category`, `archived_at`, `archived_by`, `category`,
  `evidence_map_json`, `executive_summary`, `issues_json`, `missing_data_json`,
  `opportunities_json`, `section_completions`, `session_id`, `signals_json`,
  `themes_json`.
- `interview_insight_findings` (20): `id`, `organization_id`, `insight_id`,
  `source_section_type`, `source_section_index`, `source_key`,
  `finding_statement`, `confidence_level`, `limits_text`, `limits_json`,
  `next_action_text`, `next_action_json`, `review_status`, `created_by`,
  `updated_by`, `created_at`, `updated_at`, `readback_status`,
  `readback_summary`, `readback_updated_at`.
- `interview_sessions` ma m.in. `id`, `organization_id`, `project_id`.

Źródła schematu: baza `interview_insights` — `305_interview_insights.sql` i
`20260222_interview_conversational_inference.sql`; findingi oraz późniejsze
kolumny/naprawy — `20260719_baseline_gap.sql`; sesje i `project_id` —
`295_interview_context.sql` / `727_beta_missing_tables.sql`; `session_id` i indeks
`idx_interview_insights_session_id` — `20260719_baseline_gap.sql`.

Rozstrzygnięcie:

- uczciwa relacja `project_id` to
  `interview_insight_findings.insight_id → interview_insights.id →
  interview_insights.session_id → interview_sessions.id →
  interview_sessions.project_id`;
- użyto `LEFT JOIN`, więc starszy insight bez sesji nie znika, lecz daje
  uczciwe `project_id = NULL`;
- nie ma uczciwego odpowiednika `reviewed_by`; `updated_by` oznacza ostatniego
  edytującego, nie recenzenta. Zapytanie zwraca jawne `NULL AS reviewed_by`.

## R2 — naprawa zapytania

`ConclusionService.syncInterviewFindings` wybiera teraz `s.project_id`, jawne
`NULL AS reviewed_by` i dołącza sesję przez tenantowy `LEFT JOIN` po
`session_id` oraz `organization_id`. Nie zmieniono schematu ani downstream
upsertu.

Dowód DB z dwóch przebiegów tego samego kontraktu:

```text
finding z przebiegu marker/red:
finding_edfd79ae-8274-4d34-b135-b1d2ea993e60
session_id=41265471-45ba-4343-9af1-791e2a72a8db
project_id=f305d41a-7d86-409b-9cb0-d250a156f246
conclusion_id=NULL, conclusion_project_id=NULL

finding z przebiegu po naprawie/green:
finding_f68cf988-462f-437c-9567-efc11f130a8e
session_id=7976863a-1649-4256-9121-e4159ce2edae
project_id=50f073db-5e1e-45a3-a4ad-1057ab7e8306
conclusion_id=c0779466-e0b0-484f-8d64-6041b0dc07d7
conclusion_project_id=50f073db-5e1e-45a3-a4ad-1057ab7e8306
```

Finding powstał przez realne
`POST /api/v8/interview/insights/:insightId/findings`, następnie realne
`GET /api/conclusions` przeszło przez `ApiGateway`, podpisany JWT i realny PG.

## R3 — koniec cichego sukcesu

Usunięto `.catch(() => [])` wyłącznie z głównego zapytania interview. Catch
loguje komunikat rzeczywistego błędu przez `Logger` i rzuca ten sam błąd dalej.
`asyncHandler` przekazuje go do obsługi Express; kontrakt otrzymuje HTTP 500,
nie `200 { conclusions: [] }`.

Kontrolowana awaria polegała na czasowej zmianie nazwy kolumny `title` wyłącznie
w efemerycznej bazie. Kolumnę przywrócono w `finally`. Test sprawdził treść logu
(`title`, `column ... does not exist`) oraz HTTP 500. Ponieważ `Promise.all`
uruchamia wszystkie trzy gałęzie przed odrzuceniem, test odczytał następnie
rzeczywisty wiersz `source_module='tools'`. To dowodzi tools, nie assessment.

## R4 — pozostałe ciche miejsca (nie naprawiano)

| Plik:linia po zmianie | Zapytanie | Co ginie cicho |
|---|---|---|
| `ConclusionService.ts:564` | `interview_insight_evidence_pointers` | Pointery dowodowe findingu; wniosek wygląda jak pozbawiony dowodów. |
| `ConclusionService.ts:587` | `assessment_reports` | Wszystkie rekomendacje assessment dla organizacji; realny schemat dodatkowo nie ma wybieranych `title` i `report_type`. |
| `ConclusionService.ts:662` | `tool_sessions` | Wszystkie sesyjne wnioski tools, gdy główne zapytanie padnie mimo wcześniejszego sondowania `output_json`. |

W żadnym z tych miejsc nie dokonano zmiany.

## W-A i W-C — przebiegi różnicowe po pełnych nazwach

Ta sama komenda Vitest była wykonywana z `RUN_DB_TESTS=1 MOCK_DB=false
DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true
ENABLE_TEST_AUTH_BYPASS=false RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`,
jawnym `DATABASE_URL` na 6040, `JWT_SECRET`, zewnętrznym configiem i `--retry=0`.

Marker/red (`day154-red.json`): 2 total, 0 passed, 2 failed, 0 pending.

- `... persists an HTTP-created finding as an interview conclusion with the session project` — FAILED: `expected undefined to be defined`.
- `... returns a visible error, logs the SQL message, and lets the tools sibling finish` — FAILED: `expected 200 to be 500`.

Po zmianie/green (`day154-green.json`): te same dwa `fullName` — PASSED,
2 total, 2 passed, 0 failed, 0 pending.

Mutacja po commicie: zamieniono `s.project_id` z powrotem na nieistniejące
`i.project_id`. `day154-mutation-red.json`: pierwszy pełny test FAILED
(`expected 500 to be 200`), drugi PASSED. Plik przywrócono przez `cp` zgodnie z
Z27; `git diff --exit-code -- ConclusionService.ts` dał:
`MUTACJA COFNIETA — DIFF PUSTY`. Następny
`day154-mutation-restored-green.json`: oba pełne testy PASSED, 0 pending.

Finalny `day154-final-green.json`: te same dwa pełne testy PASSED; 2/2, 0
failed, 0 pending.

## Pułapki (a)–(e)

- (a) `ENABLE_V8_GLOBAL=true` było w tej samej linii; trasa V8 findingu zwróciła 201.
- (b) `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` było w tej samej linii.
- (c) użyto configu poza repo, który usuwa `test.env.DB_TYPE`; pierwszy `beforeAll`
  asertuje `process.env.DB_TYPE === 'postgres'`, a strażnik RealPG przeszedł.
- (d) `ENABLE_TEST_AUTH_BYPASS=false`; żądania miały podpisany JWT.
- (e) kontrakt mierzy główne zapytanie interview; pozostałe miejsca są tylko
  zinwentaryzowane w R4.

## Z30 — brak wysyłki

```text
$ env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL|ENABLE_LIVE_EMAIL)" || echo "BRAK ZMIENNYCH POCZTY"
BRAK ZMIENNYCH POCZTY
$ SELECT key, left(coalesce(value,''),8) FROM settings WHERE key LIKE 'smtp%';
(0 rows)
$ grep -n "startNotificationOutboxDrainCron\|outboxWorker\|platformOutboxDrainCron" server/src/Gateway.ts
(0 trafień)
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało
wysłane.

## Kontrole końcowe

Lint dwóch zmienionych plików: **0 errors, 18 warnings**. Sześć ostrzeżeń
`no-console` jest celowymi znacznikami dowodowymi testu; dwanaście ostrzeżeń
`no-explicit-any` jest zastanym stylem `ConclusionService.ts`, w tym w
istniejących i mierzonych funkcjach. Nie użyto wyciszeń ani autofixu.

```text
$ git diff --name-only e4ff8e21ae..HEAD
server/src/routes/__tests__/day154.interview-conclusions.pg.test.ts
server/src/services/conclusions/ConclusionService.ts

$ git diff --name-only e4ff8e21ae..HEAD -- server/migrations/
(pusto)
```

Po dodaniu niniejszego raportu oczekiwany finalny zakres zawiera dokładnie trzy
licencjonowane pliki: serwis, test Day154 i ten raport.

Artefakty poza repo:

```text
68177b3fcd6a3ef08f8191e19b900485966dc1738db86cccb186b39e4b33cd6d  day154-red.json
0da414b9c89ce96fc13e7bc5ff83646abd12b52a985b79074c8113a38d0f4e14  day154-green.json
52c0044b24abbb6a549b776eff7645beac8773438361b81b63b9639bc3cc0405  day154-mutation-red.json
298cd0043446a8a6e9179e0d15fc080d02b6cb6ebb1e4b1f8dd2caa4145f67c3  day154-mutation-restored-green.json
```

Ścieżka: `/private/tmp/cx-day154-wnioski-pekniecie-artefakty/`.

## TWIERDZENIA NIEZWERYFIKOWANE

1. **Assessment sibling przy awarii interview — NOT PROVEN.** Niezależny,
   zastany defekt zapytania assessment uniemożliwia uczciwy dowód jego danych
   bez wyjścia poza licencję Day154. Tools sibling jest PROVEN.
2. **Konsument frontendowy — NOT PROVEN.** `src/**` było nietykalne i poza
   zakresem; nie uruchamiano runtime 4974/4975 ani przeglądarki. Dowód kończy się
   na realnym API i DB.
3. **Zachowanie na zdalnej/demo/staging/produkcyjnej bazie — NOT PROVEN i
   celowo niemierzone** z powodu Z8/Z9/Z28.
4. **Starszy insight z `session_id=NULL` — zachowanie SQL jest ustalone przez
   `LEFT JOIN` (`project_id=NULL`), ale nie wykonano osobnego HTTP przypadku
   akceptacyjnego dla takiego historycznego wiersza.

## Commity

- `a0bfef6387` — rdzeń R2/R3 i kontrakt RealPG.
- `f9b76e8c74` — ręczne uporządkowanie importów po lint.
- raport — osobny commit poniżej w historii gałęzi.

Nie wykonano pushu.
