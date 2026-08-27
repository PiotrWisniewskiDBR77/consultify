# DYŻUR 36 — DANE DEMO: wypełniona sesja oceny DRD (raport)

## 0. Wiązanie i środowisko

- marker (pole „SHA markera”): `3e707a9d3c`; `git merge-base --is-ancestor 3e707a9d3c codex/m03-admin-20260824` → `MARKER OK`.
- `git log --oneline 3e707a9d3c..codex/m03-admin-20260824` → pusty; tip gałęzi bazowej jest markerem.
- gałąź robocza: `codex/demo-data-day36-20260828`; worktree: `/private/tmp/consultify-demodata`; HEAD wejściowy ustawiony dokładnie na `3e707a9d3c`.
- kontener: `cx-day36-pg`, port hosta `5602`.
- dowód celu:

  ```text
   current_database | inet_server_port
  ------------------+------------------
   cx_day36         |
  (1 row)
  ```

- `docker port cx-day36-pg`:

  ```text
  5432/tcp -> 0.0.0.0:5602
  5432/tcp -> [::]:5602
  ```

- migracje na pustej bazie: `Applying migrations: 854`; zakończenie `✅ Postgres migrations complete`; błędy migracyjne: BRAK.
- przedział `20261250–59`: pusty, żadnej migracji nie utworzono ani nie użyto.
- sprzątanie: końcowy `--purge` pokazał zera, następnie wykonano wyłącznie `docker rm -fv cx-day36-pg`; żadnego prune ani kasowania cudzych wolumenów.
- potwierdzenie Z8: nie uruchomiono CLI `railway`, `curl`/`fetch` do domen aplikacji, żadnego zdalnego `psql`, żadnego pliku `.env*`, `DATABASE_PUBLIC_URL` ani `DEMO_SEED_TARGET_CONFIRM`. Wszystkie komendy DB miały literalny `DATABASE_URL=postgres://postgres:cx@localhost:5602/...`.

## 1. Weryfikacja stanu wejściowego (§0.1 pkt 5)

```text
(a) 553:  '/sessions/:sessionId/assessment-report.docx',
(b) 113,115,147,167: content: null
(c) 7 39
(d) 6: poza_modelem_operacyjnym; dalej trzy pozostałe kody słownika
(e) server/scripts/seed-wave3-assessment-owner-review.ts oraz migracje method-core
(f) 191/193: wartownik Metalpol w day32.drdSchema.test.ts
(g) PRZEDZIAL 20261250-59 PUSTY
```

Wynik (e) koryguje tezę instrukcji o „ZERO ścieżek”: istniejący skrypt tworzy sesje przez realny router HTTP (`seed-wave3-assessment-owner-review.ts:237,241`), choć nie zawiera bezpośredniego `INSERT INTO method_sessions`. Nowy skrypt jest pierwszym lokalnym, idempotentnym seedem prezentacyjnym Metalpolu z czterema wymaganymi trybami.

## 2. Pomiar PRZED (pełny zakres §0.4 pkt 3, bez zawężania)

- `Test Files 13 failed | 108 passed (121)`.
- `Tests 33 failed | 1275 passed (1308)`.
- SKIPPED: `0` (wszystkie 1308 testów wykonano).
- ZASTANE czerwone: 33 testy w 13 plikach. Dominują błędy PDF `Not a supported font format or standard PDF font` w `documentPdfRenderer.polishFonts.test.ts`, `documentPdfRendererParity.test.ts`, `documentPdfFigureEmbedding.test.ts`, `documentRendererE15FormattingRender.test.ts`, `documentStudioExport.test.ts`, `documentStudioGenerateExportHappyPath.test.ts`; ponadto zastane błędy persistence/state m.in. `documentContentBlockService.test.ts`, `documentStudioEditorStatePersistence.test.ts`, `documentVersionLineage.pg.test.ts` oraz asercje formatowania DOCX/QA w zakresie Document Studio.
- Testy Day 32 i Assessment w zakresie toru raportu przechodziły; nie zmieniono globalnej infrastruktury testowej.

## 3. Pomiar bazowy dokumentu PRZED (§0.4 pkt 5)

| miara                                     |               PRZED |
| ----------------------------------------- | ------------------: |
| SŁOWA_OGÓŁEM                              |                2810 |
| SŁOWA_ZASTĘPCZE                           |                 746 |
| ODSETEK                                   | 26,548042704626335% |
| LICZBA_PLACEHOLDERÓW                      |                 102 |
| obszarów z oceną                          |              0 z 39 |
| osi ze zdaniem `Oś nie została oceniona.` |               7 z 7 |
| `skipped:true` / częściowe                |               0 / 0 |
| radar                                     |                brak |
| rozmiar DOCX                              |             73994 B |

## 4. Pozycje

| poz. | status          | dowód                                                                                                                            |
| ---- | --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| A    | ZROBIONE_WG_DoD | `scripts/demo-seed/metalpolDrdDataset.ts`; 23 wpisy, test 14 wartości radaru i rozkład 14/3/6: 4/4 PASS                          |
| B    | ZROBIONE_WG_DoD | `scripts/seed-demo-drd-metalpol.ts:33,120,318`; dry-run bez zapisu, cztery tryby, bramka 4/4 PASS, idempotencja i readback       |
| C    | ZROBIONE_WG_DoD | 23 decyzje, cztery kody; real-PG kontrakt 1/1 PASS                                                                               |
| D    | ZROBIONE        | PRZED: `typeof currentLevel = string "3"`; PO: `typeof currentLevel = number 3`; DOCX zawiera `3 — Kontrola procesu` i `5 — MES` |
| E    | ZROBIONE_WG_DoD | realny router/JWT/PG 1/1 PASS; oba DOCX i surowe artefakty w katalogu evidence                                                   |
| R.1  | ZROBIONE_WG_DoD | ten raport                                                                                                                       |

## 5. Łańcuch osiągalności (Z20)

`npx tsx scripts/seed-demo-drd-metalpol.ts --apply` (`run`: linia 318, transakcja: 120) → `organizations 1`, `users 1`, `projects 1`, `method_sessions 1`, `method_events 24`, `method_snapshots 1`, `method_outputs 1`, `method_findings 23`, `assessment_skip_reasons 23` → `GET /api/method/sessions/demo-metalpol-session/assessment-report.docx` z Bearer JWT → realny router `method-core.routes.ts:552-565` → kontrakt `assessmentReportContractService.ts:19-55` → mapper `assessmentDrdReportSchemaService.ts` → `renderDocumentSchemaToDocxBuffer` (`documentDocxRenderer.ts:1749`) → HTTP 200, MIME DOCX, `Content-Disposition` z `Raport_DRD_Metalpol`, 101286 bajtów i realne `word/document.xml`.

Ostatnim ogniwem jest koperta HTTP i bufor DOCX. Konsument frontowy nadal nie istnieje i nie był dodawany.

## 6. Rozstrzygnięcie w sprawie treści narracyjnej — wykonanie i szkic v2

Seed nie zawiera narracji ze złotego wzorca. Katalog danych zawiera tylko tożsamość, poziomy, klasy i kody; wymagane teksty NOT NULL są deterministycznym przekształceniem `unitId/current/target/gap` z prefiksem `[demo-seed]`. Kontrola: 102 placeholdery przed i po, brak importu/kopii `data.cjs`, brak odczytu pól narracyjnych.

Szkic kontraktu v2 (niezaimplementowany):

```text
narrativeBlock {
  blockId
  content
  source: engine | consultant | demo-seed | ai
  sourceRef
  createdAt
  approvedBy
}
renderer: drukuje source przy każdym bloku
contract: nie scala bloków o różnych source
```

## 7. Idempotencja i odwracalność

- `--apply` bieg 1 i bieg 2: identyczne liczniki `1/1,1/1,1/1,1/1,24/24,1/1,1/1,23/23,23/23`.
- `--verify` po obu biegach: identyczne liczniki.
- `--purge`: usunięto odpowiednio `23,23,1,1,24,1,1,1,1`; readback wszystkich tabel = 0.
- ponowny `--apply` odtworzył pełny zestaw.
- próba `--apply` na pustej bazie `cx_day36_unmigrated` zakończyła się przed zapisem błędem `42P01 relation "organizations" does not exist`; liczba tabel publicznych po próbie: `0`.

## 8. Pomiar PO (pełny zakres, bez zawężania)

| miara                                     |               PRZED |                                                PO |
| ----------------------------------------- | ------------------: | ------------------------------------------------: |
| SŁOWA_OGÓŁEM                              |                2810 |                                              3370 |
| SŁOWA_ZASTĘPCZE                           |                 746 |                                               714 |
| ODSETEK                                   | 26,548042704626335% |                               21,186943620178042% |
| LICZBA_PLACEHOLDERÓW                      |                 102 |                                               102 |
| obszarów z oceną                          |                   0 |                                                23 |
| osi ze zdaniem `Oś nie została oceniona.` |                   7 |                                                 0 |
| obszarów `skipped:true`                   |                   0 |                                                 3 |
| obszarów z pominięciem częściowym         |                   0 |                                                 3 |
| radar obecny/docelowy                     |                brak | `39/64, 33/67, 27/60, 39/71, 50/78, 33/78, 27/67` |
| rozmiar DOCX                              |             73994 B |                                          101286 B |

Komenda pomiaru: `npx tsx scripts/demo-seed/measureDrdDocx.ts <PRZED.docx> <PO.docx>`.

- pełny pomiar PO: `Test Files 12 failed | 109 passed (121)`; `Tests 32 failed | 1276 passed (1308)`; SKIPPED `0`.
- nowe czerwone: BRAK. Zakres poprawił się o jeden test względem PRZED; pozostałe czerwone należą do zastanego długu Document Studio, przede wszystkim fontów PDF i współdzielonego stanu testów.
- testy własne: jednostkowe 8/8 PASS; kontrakt real-PG 1/1 PASS; realny route/JWT/DOCX 1/1 PASS.

## 9. Korekty wobec instrukcji

1. Runner migracji na markerze to `server/scripts/migrate.postgres.ts`, nie nieistniejący `server/src/database/migrate.postgres.ts`. Lokalny bieg wymagał ponadto jawnego `NODE_ENV=test`, bo runner poprawnie odrzuca localhost poza testem.
2. Oczekiwane „ok. 61%” nie odpowiada precyzyjnej metryce §E.2. Zgodnie z literalną metodą wyszło 26,548042704626335% PRZED i 21,186943620178042% PO.
3. Repo miało już pośrednią ścieżkę tworzenia `method_sessions`: `server/scripts/seed-wave3-assessment-owner-review.ts:237-241` montuje router i woła `POST /api/method/sessions`. Nie było bezpośredniego `INSERT`, ale twierdzenie „ZERO ścieżek zaseedowania” było zbyt szerokie.
4. Polecenie pomiaru §D.2 z top-level `await` nie działa pod bieżącym `tsx` (`cjs output format`); równoważny pomiar wykonano w async IIFE.

## 10. Znaleziska poza zakresem

- P1: `declared` jest nieosiągalne przez `validateFreezeInput`; sześć zaakceptowanych klasyfikacji wymaga surowego SQL w seedzie.
- P1: brak `levelLabelsPL` dla osi 3–7 powoduje angielskie etykiety na osiach 3, 4 i 7.
- komentarz `drdStructure.ts:5` mówi 34 obszary, kod ma 39.
- `seed-m16-demo.py` zawiera zaszyte dane logowania i błędny komentarz bezpieczeństwa.
- globalny runner pełnego zakresu ma zastane problemy z lokalnymi fontami PDF.
- w `seed-wave3-assessment-owner-review.ts` istnieje ścieżka sesji, ale nie jest to bezpieczny czterotrybowy seed prezentacyjny Metalpolu.

## 11. Inwentarz pustych ekranów demo (§E.4)

| moduł                | tabela                                                       | seed? (plik:linia)                                                                           | werdykt                   | priorytet | czy seed wystarczy                                |
| -------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------- | --------: | ------------------------------------------------- |
| Inicjatywy           | `ie_aggregate_state`, `initiative_candidates`, `initiatives` | tylko skrypty ręczne, np. `seed-wave3-initiatives-owner-review.ts:266,422`                   | PUSTY w samych migracjach |         1 | NIE — znana awaria projekcji klienckiej           |
| Realizacja / Zadania | `initiatives`, `tasks`, `v8_lane_decisions`                  | ręczne skrypty/dev i stare `server/seed`                                                     | PUSTY w samych migracjach |         1 | TAK dla danych, lecz nie naprawi innych projekcji |
| Spotkania            | `meetings`, `meeting_follow_ups`                             | `seed-wave3-meetings-owner-review.mjs:74`; brak seeda follow-upów                            | PUSTY                     |         2 | TAK                                               |
| Wyniki               | `rvn_kpi_definitions`                                        | `seed-wave3-results-owner-review.ts:214`                                                     | PUSTY w migracjach        |         2 | TAK                                               |
| Ocena                | `method_sessions`                                            | istniejący seed przez HTTP `seed-wave3-assessment-owner-review.ts:237-241`; nowy seed Day 36 | WYPEŁNIALNY po Day 36     |         1 | TAK — dostarczono                                 |
| Wywiad               | `interview_sessions`, `interview_library_templates`          | biblioteka w `20260720_seed_v6_interview_library_templates.sql:39`; sesje tylko skrypty      | CZĘŚCIOWY                 |         2 | TAK                                               |
| Finanse              | `financial_statement_packs`, `financial_models`              | tylko skrypty ręczne, m.in. `reset-and-seed-finance-demo.ts:872`                             | PUSTY                     |         2 | TAK                                               |
| Materiały            | `v8_output_artifacts`, `presentation_decks`                  | systemowe szablony `20260412_seed_business_templates.sql:25,78,131`; deki tylko skrypty      | CZĘŚCIOWY                 |         2 | TAK                                               |
| Moja praca           | `notebook_pages`, `tasks`, `meetings`, `decisions`           | wyłącznie skrypty ręczne/stare seedy                                                         | PUSTY                     |         1 | TAK                                               |

Weryfikacja pokazała też, że stan bazowy instrukcji „jedyna migracja wstawiająca treść modułu” jest zbyt wąski: biblioteka wywiadów ma własne inserty migracyjne, co sama tabela instrukcji później poprawnie wskazuje.

## 12. Twierdzenia NIEZWERYFIKOWANE

- Nie zweryfikowano żadnego środowiska zdalnego ani zachowania po wdrożeniu — celowo i zgodnie z Z8.
- Nie zweryfikowano konsumenta frontowego — nie istnieje w zakresie.
- Nie wykonano odbioru wizualnego w Wordzie ani PDF; dowodem jest XML i koperta HTTP.
- Nie wykonano właścicielskiego odbioru zawartości danych ani release.

## 13. Commity

- `bc9cbbfec9` — `feat(demo-data): add the Metalpol DRD demo dataset as measured values only (A)`
- `124e58af0a` — `test(demo-data): pin the seven axis percentages against the accepted golden radar (A.5)`
- `1aa09c9b97` — `feat(demo-data): seed a fully answered DRD assessment session, local-only by default (B)`
- `77671b8a42` — `feat(demo-data): seed full and partial skip decisions across all four dictionary codes (C)`
- `d4b3a88ad2` — `fix(method-core): coerce numeric finding levels so matrix highlighting matches (D)`
- `0ae8bada46` — `test(demo-data): prove the generated docx drops from an empty form to a filled report (E)`
- R.1 — niniejszy commit `docs(demo-data): day 36 duty report (R.1)`.

## Brief wynikowy

1. **Marker**: związany — `3e707a9d3c`, MARKER OK.
2. **Czy dokument przestał być pusty**: TAK — 26,548042704626335% → 21,186943620178042%, placeholdery 102 → 102.
3. **Ile obszarów ma ocenę**: 23 z 39; osi z `Oś nie została oceniona.`: 0 z 7.
4. **Radar**: 14 wartości zgodnych ze wzorcem — TAK.
5. **Idempotencja**: dwa biegi `--apply` dały identyczne liczniki — TAK.
6. **Odwracalność**: `--purge` → zera → ponowny `--apply` odtworzył — TAK.
7. **Proza w seedzie**: BRAK — potwierdzone stałością 102 placeholderów i inspekcją katalogu danych.
8. **§D (NUMERIC)**: potwierdzone i naprawione lokalnie w `toFindingRecord`.
9. **Kontakt ze środowiskami zdalnymi**: ZERO — brak komend Railway/domen/remote DB/env plików.
10. **Pozycje**: A ZROBIONE; B ZROBIONE; C ZROBIONE; D ZROBIONE; E ZROBIONE; R.1 ZROBIONE.
11. **Znaleziska P1**: `declared` nieosiągalne produkcyjną ścieżką; brak polskich etykiet osi 3,4,7; zastany dług fontów PDF.
12. **Czego NIE zweryfikowano**: zdalnego runtime, frontu, Word/PDF visual QA, owner acceptance i release.
13. **Jedno zdanie dla właściciela**: po uruchomieniu seeda dokument pokaże Metalpol, 23 oceny, pełny radar i prawdziwe pominięcia, lecz nadal uczciwie zachowa 102 puste sloty narracyjne do czasu kontraktu v2 lub silnika AI.

Silnik dostał dwadzieścia trzy mierzalne oceny i dwadzieścia trzy decyzje o pominięciu — bez ani jednego akapitu udającego analizę.
