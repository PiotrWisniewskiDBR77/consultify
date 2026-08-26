# Chat — producent sygnałów, dzień 18 — raport dyżuru 2026-08-26

Baza zatwierdzona DEC-95: `codex/day18-instrukcja-20260826 @ 9d86fd6f4b`
Marker: `c31155205e` — POTWIERDZONY
Tip M03 przy starcie: `516c104e56`; pięć plików różnicy poza zakresem, świeżość §0.5 zatestowana przez nadzorcę w DEC-95
Gałąź robocza: `codex/chat-signals-day18-20260826`
Worktree: `/private/tmp/consultify-chat-signals-day18`
Porty aplikacji: żadne · lokalny PG: `cx-day18-pg` na `4320` (usunięty po testach: TAK)
Migracje: `20261080`, `20261081` (przenumerowane przy odbiorze — DEC-98 rezerwuje 20261076-79 dla dnia 17; pierwotnie utworzone jako `20261076`/`20261077` zgodnie z §0.1 instrukcji, która nie znała rezerwacji); `ls|grep` przed każdym plikiem: TAK

## Oświadczenia

- Chroniony katalog `/Users/piotrwisniewski/Developer/Consultify`: nie czytałem ani nie zmieniałem źródeł; jedyny kontakt to autoryzowany, read-only symlink `node_modules`: **TAK**.
- Nie zmieniłem `src/` ani `public/locales/`: **TAK**.
- Nie użyłem portu 3987, origin/demo, Railway, deployu ani zdalnej bazy: **TAK**.
- Nie wywołałem providera AI na żywo; testy W używały lokalnych mocków: **TAK**.
- Nie wysłałem maila, webhooka ani zewnętrznego wywołania: **TAK**.
- Nie wykonałem push ani merge: **TAK**.

## Koordynacja i warunki wstępne

| Kontrola | Wynik | Konsekwencja |
| --- | --- | --- |
| marker `c31155205e` | `MARKER OK` | baza dopuszczona |
| DEC-95 | dokładny START wiążący; marker bez zmiany | wznowiono po zasadnym STOP-ie |
| org filter fix | scalony w bazie | użyto istniejącego guarda |
| projekt wiążący | 763 linie | przeczytany w całości |
| ledger decyzji | 145, nie 144 linii; DEC-36/65/86/89 obecne | korekta bez zgadywania |
| baseline org isolation | 5/5 PASS przed implementacją | bramka wejściowa zielona |
| świeży lokalny PG | baseline 842 applied, replay 0, dry 0 | punkt odniesienia lokalny |

## Inwentarz źródeł dla 10 reguł

| # | ruleId | Źródło i warunek | Werdykt |
| --- | --- | --- | --- |
| 1 | `exec.task.overdue` | `tasks`: due_date, status, organization_id | ŹRÓDŁO_JEST |
| 2 | `exec.task.due_soon_not_started` | `tasks`: due_date, status, organization_id | ŹRÓDŁO_JEST |
| 3 | `exec.task.blocked_stale` | `tasks`: status, updated_at, organization_id | ŹRÓDŁO_JEST |
| 4 | `exec.initiative.no_baseline` | `initiatives` + `initiative_schedule_baselines` | ŹRÓDŁO_JEST |
| 5 | `dec.pending_stale` | `decisions`: status, created_at, organization_id | ŹRÓDŁO_JEST |
| 6 | `dec.blocking_dependents` | `decisions` + `decision_impacts.is_blocker` | ŹRÓDŁO_JEST |
| 7 | `res.kpi_threshold_breached` | `v8_kpi_signals` + `v8_kpi_definitions`, przez initiative tenant scope | ŹRÓDŁO_INNE; reguła częściowa względem bezpośredniego subject KPI |
| 8 | `res.roi_confidence_dropped` | **KOREKTA FIX-5(a):** pierwotne stwierdzenie „brak wersjonowanej historii confidence" jest NIEPRAWDZIWE. Żywy schemat ma `kpi_attribution_snapshots` (organization_id, kpi_id, overall_confidence, confidence_reasons, computed_at) — dokładnie wersjonowana historia — oraz `rvn_roi_forecast_versions`. Oba istnieją jako migracje, zweryfikowane na żywym schemacie. Wybór źródła i implementacja NIE rozstrzygnięte przez tego robotnika. | ŹRÓDŁO_INNE — STOP, kandydaci wskazani, decyzja wyboru źródła należy do właściciela/nadzorcy |
| 9 | `fin.budget_overspend` | `budget_overspend_signals`: budget/actual/variance | ŹRÓDŁO_JEST |
| 10 | `fin.benefit_not_realized` | Stwierdzenie o braku `benefit_realization_plans` PRAWDZIWE (zweryfikowane: tabela nie istnieje w żadnej migracji). **KOREKTA FIX-5(b):** pierwotny raport nie wymienił ~8 kandydatów obecnych na żywym schemacie: `benefit_tracking`, `benefits_register`, `initiative_benefits`, `benefit_targets`, `benefit_measurements`, `rvn_roi_benefit_lines`, `roi_realized_values`, `v8_roi_realization_entries` (wszystkie zweryfikowane jako istniejące migracje). | BRAK_DANYCH (deklarowana tabela) — STOP, kandydaci dopisani, decyzja wyboru należy do właściciela/nadzorcy |

## Pozycje

| Pozycja | Status | Commit | Dowód / uwaga |
| --- | --- | --- | --- |
| D.1 | ZROBIONE_WG_DoD | `3371a02759` | tabela, constrainty, indeksy; real PG |
| D.2 | ZROBIONE_WG_DoD | `b231acbcff` | ledger + muted domains; real PG |
| D.3 | ZROBIONE_WG_DoD | `a56ca0addd` | typy i słowniki, 5/5 |
| E.1 | ZROBIONE_WG_DoD | `28e7613684` | walidator rejestru, 5/5 |
| E.2 | ZROBIONE_WG_DoD | `6fed5fff90` | dedupe, resolve, supersede, limit, isolation |
| E.3 | ZROBIONE_WG_DoD | `c0855c3a97` | cztery reguły, real PG, 16/16 |
| E.4 | ZROBIONE_WG_DoD | `a656253e69` | dwie reguły, real PG, 8/8 |
| E.5 | CZĘŚCIOWO | `8f326c6980` | KPI 4/4; ROI ŹRÓDŁO_INNE/STOP (kandydaci wskazani po FIX-5(a), decyzja właściciela oczekująca) |
| E.6 | CZĘŚCIOWO | `3717071562` | budget 4/4; benefit BRAK_DANYCH/STOP (kandydaci dopisani po FIX-5(b), decyzja właściciela oczekująca) |
| S.1 | ZROBIONE_WG_DoD | `3ed0b2803f` | cron 15 min, producer default OFF |
| S.2 | ZROBIONE_WG_DoD | `f4dd3d906d` | durable throttle i mismatch org |
| S.3 | ZROBIONE_WG_DoD | `bd925573cf` | FAILED/PARTIAL ledger + alarm |
| A.1 | ZROBIONE_WG_DoD | `18e8cc2bf4` | canonical feed, legacy superset, `severityRaw` |
| A.2 | ZROBIONE_WG_DoD | `143d350a9c` | my-work czyta canonical store |
| A.3 | ZROBIONE_WG_DoD | `71ec0c1e5e` | snooze/dismiss/mute z tenant readback |
| A.4 | ZROBIONE_WG_DoD | `18e8cc2bf4`–`71ec0c1e5e` | 18/18 integracyjnych negatywów/kontraktów |
| W.1 | ZROBIONE_WG_DoD | `22880d6755` | OFF i SKIPPED_NO_PROVIDER |
| W.2 | ZROBIONE_WG_DoD | `22880d6755` | ≥2 deterministic, open, same-org refs |
| W.3 | CZĘŚCIOWO | `22880d6755` | privacy/limit/budget/provenance; bez live provider i bez generycznego AI ledger API |
| X.1 | ZROBIONE_WG_DoD | `492ac3da15` | real PG: canonical + legacy, idempotencja, rollup, tenant, PARTIAL |
| X.2 | ZROBIONE_WG_DoD | — | `automated_insights`: 0 wyników; legacy trigger niezmieniony |
| T.1–T.4 | CZĘŚCIOWO | wszystkie powyżej | wszystkie zbudowane reguły zielone; 2/10 zatrzymane (1× ŹRÓDŁO_INNE/STOP, 1× BRAK_DANYCH/STOP — kandydaci obu wskazani po FIX-5) |
| R.1 | STOP | — | w MODULE_ACCEPTANCE brak atomowego wpisu `CHAT-OWN-004`; jest tylko zbiorczy `CHAT-OWN-001–017`, więc nie zmieniono go bez zgadywania |

## Bramki evaluatora i reguł

E.2: idempotencja PASS; auto-resolve PASS; supersede PASS; izolacja błędu PASS; limit 25 PASS; negatyw tenanta PASS.

| ruleId | sygnał | auto-resolve | destination | evidence |
| --- | --- | --- | --- | --- |
| exec.task.overdue | PASS | PASS | PASS | PASS |
| exec.task.due_soon_not_started | PASS | PASS | PASS | PASS |
| exec.task.blocked_stale | PASS | PASS | PASS | PASS |
| exec.initiative.no_baseline | PASS | PASS | PASS | PASS |
| dec.pending_stale | PASS | PASS | PASS | PASS |
| dec.blocking_dependents | PASS | PASS | PASS | PASS |
| res.kpi_threshold_breached | PASS | PASS | PASS | PASS |
| res.roi_confidence_dropped | BRAK_DANYCH | BRAK_DANYCH | BRAK_DANYCH | BRAK_DANYCH |
| fin.budget_overspend | PASS | PASS | PASS | PASS |
| fin.benefit_not_realized | BRAK_DANYCH | BRAK_DANYCH | BRAK_DANYCH | BRAK_DANYCH |

## A.4 — negatywy i kontrakty API

Pakiet real-PG `signals.feed.postgres.integration.test.ts`: **18/18 PASS**. Obejmuje obcy org, obcą rolę, lowercase role, zignorowane query `role`/`organizationId`, 403 guarda, wyciszenia/snooze/dismiss, cursor bez OFFSET, on-demand disabled/throttle/org mismatch, cross-org i cross-role mutations, legacy/unknown key bez 500. Dodatkowy guard my-work: **6/6 PASS**.

## S i W

| Scenariusz | Wynik |
| --- | --- |
| producer OFF | `SKIPPED_DISABLED`, zero evaluatora |
| producer ON | dokładnie wskazany tenant; błąd jednego nie zatrzymuje kolejnego |
| interpreter OFF | fail-closed, zero providera |
| brak providera | `SKIPPED_NO_PROVIDER`, zero substytutu |
| mniej niż 5 deterministycznych | zero kosztu |
| więcej niż 3 propozycje | zapis maksymalnie 3 |
| evidenceRefs <2 / cross-org / interpreted / UNKNOWN | odrzucone |

## Migracje

| Plik | Addytywna | Przebieg 1 | Przebieg 2 | Dry | Stan wydania |
| --- | --- | --- | --- | --- | --- |
| `20261080_chat_signals_day18_work_signals.sql` | TAK | applied | 0 | 0 pending | MIGRATION_PREPARED |
| `20261081_chat_signals_day18_run_ledger.sql` | TAK | applied | 0 | 0 pending | MIGRATION_PREPARED |

Pierwsza próba runnera bez `NODE_ENV=test` została prawidłowo odrzucona przez lokal-host guard. Powtórzono wyłącznie na lokalnym kontenerze z `NODE_ENV=test RUN_DB_TESTS=1`: `2 applied → 0 applied → 0 pending`. Nie wykonano migracji zdalnej.

## Flagi i licencje Z17

| Flaga | Default | Czytelnik | Test |
| --- | --- | --- | --- |
| `ENABLE_SIGNAL_PRODUCER` | false | `jobs/workSignalProducerJob.ts` | 4/4 |
| `ENABLE_SIGNAL_INTERPRETER` | false | `services/signals/signalInterpreter.ts` | 8/8 |

| Licencja | Zmiana |
| --- | --- |
| L1 `FeatureFlags.ts` | dokładnie dwie flagi default false |
| L2 `Scheduler.ts` | dwa rejestratory: deterministic 15 min, interpreted daily |
| L3 `Gateway.ts` | montaż `/api/signals` za istniejącymi guardami |
| L4 `my-work.routes.ts` | NIC |

`executionVisibilityService.ts`, `aiEvidenceGovernance.ts`, `notificationService`, entitlementy i frontend pozostały nietknięte.

## Testy końcowe

- my-work routes: 21/21 PASS
- signals services z realnym lokalnym PG: 59/59 PASS
- signals unit: 5/5 PASS
- canonical feed real PG: 18/18 PASS
- cron: 6 PASS, 5 niezwiązanych testów wymagających osobnego DB pominiętych
- config: 26/26 PASS
- adapter osobno: 2/2; evaluator real PG z adapterem: 7/7
- migracje: 2 applied, następnie 0 applied, dry 0 pending
- SQL formatter: Prettier nie ma skonfigurowanego parsera `.sql`; migracje zweryfikowano runnerem, `git diff --check` i realnym PG.

## STOP-y i znaleziska

1. **[SPROSTOWANIE po FIX-5(a), naprawa 2026-08-26]** `res.roi_confidence_dropped`: pierwotne „brak wersjonowanej historii confidence" było BŁĘDNE. Żywy schemat ma `kpi_attribution_snapshots` (organization_id, kpi_id, overall_confidence, confidence_reasons, computed_at — dokładnie wersjonowana historia) i `rvn_roi_forecast_versions`, oba zweryfikowane jako istniejące migracje. STOP: reguła nadal NIE zaimplementowana — wybór między tymi dwoma źródłami i kształt reguły to decyzja właściciela/nadzorcy, nie tego robotnika.
2. **[UZUPEŁNIENIE po FIX-5(b), naprawa 2026-08-26]** `fin.benefit_not_realized`: stwierdzenie o braku `benefit_realization_plans` pozostaje PRAWDZIWE. Pierwotny raport pominął jednak ~8 realnych kandydatów istniejących na żywym schemacie: `benefit_tracking`, `benefits_register`, `initiative_benefits`, `benefit_targets`, `benefit_measurements`, `rvn_roi_benefit_lines`, `roi_realized_values`, `v8_roi_realization_entries`. STOP: wybór kandydata to decyzja właściciela/nadzorcy.
3. Generyczne wejście do `aiRunLedgerService`: istniejący kontrakt jest action-centric. Interpreter zapisuje `ai_run_id` w `work_signal_runs`; rozszerzenia shared API nie zgadywano. **[Naprawa FIX-4, 2026-08-26]:** do czasu takiego API `ai_run_id` zapisuje się jako `null`, nie jako `randomUUID()` — poprzedni zapis wyglądał jak realna referencja do przebiegu AI, a nią nie był (fałszywa prowenienacja).
4. `MODULE_ACCEPTANCE`: brak atomowego wiersza `CHAT-OWN-004`; zbiorczego wpisu nie rozbijano bez autoryzacji.
5. `aiNotificationTriggers` ma ręcznego callera w `ai.routes.ts`; nie reanimowano ani nie usuwano. `automated_insights` ma zero odczytów/zapisów w `server/src` i pozostaje HISTORICAL.
6. Kontrakt pełnej wagi DTO: wybrano konsekwentnie `severityRaw`; legacy `blocker` mapuje się na `CRITICAL`.
7. **[UJAWNIENIE FIX-7e, naprawa 2026-08-26]** Zmiana zachowania przy snooze/dismiss dla kluczy spoza kanonicznego modelu (np. dawne `predict_overdue_*`, `bottleneck_decision_*` — zbiorczo określane jako „prediction:*"): stary handler (`signals.routes.ts` sprzed A.2) uznawał KAŻDY klucz bez prefiksu `notification:` za automatycznie „owned" (`if (!key.startsWith('notification:')) return true;`) i zwracał 200 + zapis w `my_work_signal_snoozes`/`dismissals`. Po remapie A.2 na kanoniczny `ownedSignal()` te same klucze — nieodpowiadające żadnemu wierszowi `work_signals` — zwracają 404. To zamierzona konsekwencja przejścia na kanoniczny model (silniejsza gwarancja tenant-isolation), ale NIE była ujawniona w pierwotnym raporcie jako zmiana zachowania. Brak dedykowanej migracji dla istniejących wierszy `my_work_signal_snoozes`/`dismissals` zapisanych pod starymi kluczami — pozostają nieużywalne (nikt już ich nie odpyta), ale nieszkodliwe.

## Korekty wobec instrukcji

- Ledger ma 145, nie 144 linii.
- KPI jest tenant-scoped przez initiative, ponieważ zamrożony `SourceObjectType` nie ma KPI; pozycja E.5 pozostaje CZĘŚCIOWO.
- `benefit_realization_plans` nie istnieje po rzeczywistym replay baseline mimo wskazania w mapie; regułę zatrzymano.
- DEC-95 zastąpiła pierwotny STOP bazowy atestacją dokładnego START-u; nie wykonano rebase/cherry-pick pięciu obcych plików.

## Dowód zamrożenia DEC-65

Końcowy audit względem zatwierdzonego exact-start `9d86fd6f4b`: `src/` pusty; `public/locales/` pusty; migracje tylko dwa pliki day18; dwie nowe flagi mają default false; brak zmian entitlement; brak zmian `executionVisibilityService`/`aiEvidenceGovernance`/`notificationService`; po sprzątnięciu brak kontenera i wolumenu `cx-day18`.

Z tego dyżuru nie wyszła ani jedna zdalna operacja: zero deployów, zero Railway, zero zdalnych migracji, zero zapisów do wspólnej bazy, zero wywołań AI na żywo, zero wysyłek.

## Licznik i czego nie zrobiono

22 pozycje: 16 ZROBIONE_WG_DoD, 4 CZĘŚCIOWO, 2 STOP (1× ŹRÓDŁO_INNE po korekcie FIX-5(a), 1× BRAK_DANYCH z uzupełnionymi kandydatami po FIX-5(b)) agregowane w E.5/E.6; obie flagi nadal OFF. Mechanika jest gotowa do konsumpcji przez blok frontowy, ale nie ma deklaracji odbioru wizualnego ani release.

## Naprawy warstwy 1 (2026-08-26, po odbiorze)

Rdzeń deterministyczny odebrany pozytywnie; warstwa AI (interpreter) zgłoszona jako zbudowana okazała się martwa na ścieżce produkcyjnej. Naprawiono na gałęzi `codex/chat-signals-day18-20260826`, commit-per-fix:

| Fix | Problem | Naprawa |
| --- | --- | --- |
| FIX-1 (P0) | `signalInterpreter.ts` czytał nieistniejące `output.proposals`; `llmService.generateResponse` zwraca `{content, usage}` — JSON z `content` nigdy nie był parsowany, więc AI-warstwa zawsze zwracała zero propozycji, nawet z poprawną odpowiedzią modelu | `defaultDependencies.generate` parsuje i waliduje `output.content` (`parseInterpretedProposals`); błąd parsowania/kształtu → PARTIAL + wpis w `errors`, nigdy cichy fallback do `[]`; dodany test domyślnego okablowania (bez wstrzykniętych dependencies) |
| FIX-2 (P1) | Cichy `catch { failed += 1 }` w ticku producenta; rejestratory cron bez `logger.info`/`.catch()` | `catch (error)` z `logger.error` (org + błąd); oba rejestratory Scheduler.ts doprowadzone do wzorca job7b |
| FIX-3 (P1) | Rejestratory bezwarunkowe → `SKIPPED_DISABLED` zapisywany dla każdej organizacji co 15 min przy fladze OFF | Ścieżka CRON nie zapisuje `SKIPPED_DISABLED`; ścieżka ON_DEMAND nadal zapisuje |
| FIX-4 (P1) | `ai_run_id` zapisywany jako `randomUUID()` — fałszywa prowenienacja, nie wskazuje żadnego rekordu | `ai_run_id = null` do czasu realnego API `aiRunLedgerService` |
| FIX-5 (P1) | `res.roi_confidence_dropped` zgłoszony jako BRAK_DANYCH mimo istniejących `kpi_attribution_snapshots`/`rvn_roi_forecast_versions`; `fin.benefit_not_realized` nie wymieniał ~8 realnych kandydatów | Raport skorygowany (patrz wyżej); reguły NIE zaimplementowane bez decyzji właściciela |
| FIX-6 (P2) | Test org-isolation osłabiony do `mockResolvedValue(null)` — usunięcie `organization_id = ?` z zapytania nie wywalało testu | Przywrócona asercja parametrów na zapytaniu `ownedSignal` |
| FIX-7a (P2) | `ENABLE_SIGNAL_PRODUCER`/`ENABLE_SIGNAL_INTERPRETER` w `FeatureFlags.ts` martwe (realni czytelnicy sięgają wprost do `process.env`) | Wpisy usunięte |
| FIX-7b (P2) | Kosmetyczny reformat `Scheduler.ts:41-47` poza zakresem | Cofnięty |
| FIX-7c (P2) | Brak `.toUpperCase()` w handlerze mute-type | Przywrócone; DODATKOWO `signalReadModel.ts` — filtr `muted_types_json` zmieniony na porównanie `UPPER(...)` po obu stronach, inaczej normalizacja tylko po stronie zapisu psułaby dopasowanie do `signal_type` przechowywanego małymi literami (rzeczywisty format reguł, np. `task_overdue`) i regresowałaby test `signals.feed.postgres.integration.test.ts` |
| FIX-7d (P2) | Brak testu na odrzucenie `severity='BLOCKER'` przez CHECK | Dodany `tests/integration/signals/work-signals-severity-check.pg.test.ts` |
| FIX-7e (P2) | Zmiana zachowania kluczy `predict_*`/`bottleneck_*` przy snooze (200+zapis → 404) nieujawniona | Ujawniona w sekcji STOP-y powyżej |

Nie zbudowano dwóch reguł bez prawdziwego źródła, nie zmieniono zbiorczego rejestru ownera, nie rozszerzono shared AI ledger, nie dotknięto frontu i nie wykonano żadnej operacji wydaniowej — zgodnie z „STOP zamiast zgadywania” i DEC-65/95.
