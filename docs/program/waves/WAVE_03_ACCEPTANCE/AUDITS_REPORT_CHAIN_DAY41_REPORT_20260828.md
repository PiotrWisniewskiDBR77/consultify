# Audyty dzień 41 — łańcuch wytworzenia raportu i eksport — raport dyżuru 2026-08-28

## Marker, baza i bezpieczeństwo

Marker `23652ec80a`; worktree `/private/tmp/cx-audits41`; gałąź `codex/audits-day41-20260828`. Własny PG: `postgres://postgres:cx@localhost:5693/cx_day41`, `pgvector/pgvector:pg16`, 855 migracji, `Postgres migrations complete`.

Każdy pomiar DB miał jawnie w tej samej linii `DATABASE_URL=postgres://postgres:cx@localhost:5693/cx_day41 RUN_DB_TESTS=1 MOCK_DB=false ENABLE_V8_GLOBAL=true` oraz dla serwera `DB_TYPE=postgres NODE_ENV=test POSTGRES_SKIP_INIT_IN_TEST=1 AI_PROVIDER_MODE=mock`.

- Z5/DEC-86: brak zapisu w chronionym checkoutcie; tylko zastany symlink `node_modules` do odczytu.
- Z27: nie użyto stash; `git stash list` pusty.
- Z28: zero połączeń do demo/staging/produkcji/Railway. Zero push/merge/deploy.
- `ff_auditsReportChain` nadal domyślnie `OFF`.
- `git diff --name-only 23652ec80a...HEAD | rg documentStudio` jest pusty: 0 zmienionych linii silnika.

## Errata, bramka wejściowa i REAL_PG

Backend miał działające, lecz nieosiągalne z klienta komendy. Lifecycle nie tworzy Outputu. Raport audytu zapisuje 13 sekcji; `/presentation` jest osobnym deckiem i nie może zasilać eksportu. Istniejący renderer przyjmuje `DocumentSchema`, więc adapter wystarczył bez zmian silnika. Trasa kryteriów nie stronicuje na serwerze; klient kroi po 25.

`day41.reportChainReachability.pg.test.ts`: 2 PASS / 0 FAIL / 0 SKIPPED, 14.64 s, realny `initializeRoutes`, niezależny `pg.Client`. Output HTTP 201/readback `version=1` i hash. Raport HTTP 201/readback dokładnie 13 sekcji w oczekiwanej kolejności, hash różny od Outputu. Drugi program przeszedł HTTP do `closure`, po czym readback Outputów wyniósł 0. Source guard klienta: 1/1 PASS.

## Pozycje D.1–D.11 i R.1

| Pozycja | Commit                     | Status               | Dowód                                                                            |
| ------- | -------------------------- | -------------------- | -------------------------------------------------------------------------------- |
| D.1     | `c8ecd4d3be`               | ZROBIONE_WG_DoD      | 2/2 Real-PG + 1/1 source guard; test-only                                        |
| D.2     | `76715d40f7`               | ZROBIONE_TECHNICZNIE | dwie ścisłe komendy klienta; pakiet API 14/14                                    |
| D.3     | `dea5aa8774`               | ZROBIONE_TECHNICZNIE | jedna flaga, default OFF, fail-closed                                            |
| D.4     | `e84ed17144`               | NOT_PROVEN_WG_DoD    | realna finalizacja; 5/5; brak 4 zrzutów                                          |
| D.5     | `2969f89ba0`               | NOT_PROVEN_WG_DoD    | oba rodzaje, data, odświeżenie i link; 7/7 nowych, 15/15 regresji; brak zrzutów  |
| D.6     | `c4202e0437`               | PARTIAL              | uczciwy empty state; brak zrzutów                                                |
| D.7     | `cc04f6efbc`               | ZROBIONE_WG_DoD      | adapter 211 linii, 10/10, realny bufor                                           |
| D.8     | `c287d797d7`, `0608e4b5ff` | ZROBIONE_WG_DoD      | trasa + 6/6 Real-PG HTTP; tenant, oba rodzaje, XML z payloadu; oględziny 4 stron |
| D.9     | `ea5cdec7a4`               | NOT_PROVEN_WG_DoD    | 5/5; download/loading/error, PDF nadal Planowane; brak zrzutów i browser click   |
| D.10    | —                          | NIE_WYKONANO         | brak jednego wymaganego `it` obejmującego cały łańcuch, v2 i supersede           |
| D.11    | `fafead88a8`               | ZROBIONE_WG_DoD      | 42/150/300, 5 przebiegów, EXPLAIN, cleanup, `AUD-PF-004`                         |
| R.1     | bieżący                    | WYKONANO             | raport nadpisany pełnym, niezawyżonym stanem                                     |

## Trzy odpowiedzi odbiorcze

Raport da się wytworzyć z interfejsu po jawnym włączeniu `ff_auditsReportChain`: Sesje → podgląd → „Sfinalizuj Output”, następnie Outputs → menu wiersza → „Generuj raport audytu” albo „Generuj raport naprawczy”. Domyślnie flaga jest OFF.

Eksport oparto na istniejącym silniku. Adapter ma 211 linii; w `documentStudio/**` zmieniono 0. Trasa czyta zaplombowany `report.payload`, nie deck `/presentation`. Kto może przeczytać raport, może go pobrać: eksport używa tej samej bramki aktora i tenantowanego odczytu.

Skala: `SKALA_ZAMKNIĘTA`. Przy 300 realistycznych kryteriach payload miał 358.09 kB, mediana wyniosła 34.46 ms, a SQL wykonał indeksowy skan w 0.217 ms. Budżet dla obecnego maksimum jednego programu: 500 kB.

## Osiągalność i mapowanie dokumentu

D.4 montuje prawdziwy podgląd i dowodzi wywołania, wersji/hasha, konfliktu i blokady dubletu. D.5 dowodzi obu wariantów, opcjonalnej daty, deny superseded, błędu i widocznego linku bez auto-nawigacji. D.8 przez realny HTTP zwraca DOCX; rozpakowany `word/document.xml` zawiera `DAY41_PAYLOAD_ONLY` i „Macierz traceability”. D.9 dowodzi URL, disabled i błędu inline bez `alert()`, lecz nie realnego browser click. D.10 pozostaje `NOT_PROVEN`.

Mapowanie: `text → heading+paragraph`; `list → heading+bullet_list`; `table → heading+table`; `keyValue → heading+tabela właściwości`; `group → heading L2 + heading L3 + listy`. Puste treści dostają `[Brak danych: …]`. Stopka niesie wersję i hash. Kolejność jest 1:1 z payloadu.

## Oględziny DOCX D.8

`/private/tmp/day41-audit-report.docx` pobrano przez test HTTP, wyrenderowano `render_docx.py` do czterech PNG i obejrzano strona po stronie. Poprawne: polskie znaki i tytuł „Łódź — raport jakości”, okładka, spis treści, stopka z wersją/hashem/poufnością, strony 1/4–4/4 i wszystkie sekcje z macierzą. Brak ucięć i nakładania. Fixture ma techniczne tytuły i nie jest artefaktem klientowskim.

## Skala D.11

| Kryteria | Odpowiedź | Mediana 5 HTTP | Próbki ms                         |
| -------: | --------: | -------------: | --------------------------------- |
|       42 |  49.90 kB |       38.83 ms | 32.51, 35.70, 38.83, 53.44, 78.74 |
|      150 | 178.79 kB |       47.81 ms | 22.47, 27.49, 47.81, 50.93, 57.94 |
|      300 | 358.09 kB |       34.46 ms | 32.41, 33.48, 34.46, 39.12, 60.05 |

`EXPLAIN ANALYZE`: `Index Scan using idx_audit_program_criteria_status`, 300 rows; quicksort 174 kB; planning 0.115 ms; execution 0.217 ms. Planner wybrał równoważny indeks zaczynający się od `(organization_id, program_id)`, nie literalny indeks `program`; nie było seq scan.

## Polish-pass i zrzuty

Kontrole używają `c-*`, `ring-c-focus`, PL/EN oraz zastanych klas artefaktu. `check-list-canon` i `check-artefakt` nie wykazały nowych naruszeń. Brak kompletów OFF/ON × light/dark dla D.4/D.5/D.6/D.9; dlatego front nie jest oznaczony pełnym `ZROBIONE_WG_DoD`.

## Pełny pomiar §0.4a

- `services/audits`: 159 PASS / 0 FAIL / 21 SKIPPED.
- `routes/audits`: 25 PASS / 0 FAIL / 25 SKIPPED. Nowe Real-PG osobno bez skip: D.1 2/2, D.8 6/6, D.11 1/1.
- `documentStudio`: 964 PASS / 9 FAIL; 7 plików FAIL, 83 PASS, plus 1 suite ENOENT — dokładnie zastany czerwony baseline, poza diffem.
- golden DOCX: 13 PASS / 1 FAIL — zastany brak natywnego pola `TOC `.
- middleware membership: 18 PASS / 0 FAIL.
- front Audits + dwie zastane flagi: 149 PASS / 0 FAIL, 20/20 plików.
- `routes/__tests__ -t method-core`: 2 suite import FAIL i 1185 SKIPPED; zastany mismatch JWT w Financial Modeling i błędna ścieżka `server/server/...` w Interview. Nie jest zgłaszane jako PASS.

Werdykt: `PEŁNY POMIAR, CZERWONY ZASTANY`. Czerwone wprowadzone przez Day 41: 0. Nowe Real-PG pominięte przez env: 0. Istniejące SKIPPED w dwóch szerokich pakietach: 46. Nie osłabiono wcześniejszych asercji.

## Migracje, korekty, STOP i znaleziska

Zero nowych migracji; zakres `20261300`–`20261309` wolny. Testy serwera wymagają cwd `server`. `prettier` dużego `AuditReportDocumentView.tsx` dawał 541 zmienionych linii; zgodnie z instrukcją przywrócono kopię i zachowano punktowy diff 56 linii, a test sformatowano normalnie.

D.10 pozostaje niewykonane; zbiór testów ogniw nie zastępuje jednego E2E. Zrzuty frontowe są `EVIDENCE_MISSING`. Wspólny renderer ma zastane czerwienie TOC/snapshot/persistence i suite zależną od cwd; nie naprawiano chronionego modułu. D.11 wybrał indeks `status`; estimate `rows=1` przy 300 wskazuje na nieświeże statystyki fixture po seedzie.

## Twierdzenia NIEZWERYFIKOWANE

- Brak realnego browser harnessu i kompletów light/dark nowych kontrolek.
- Brak jednego D.10 od pakietu do raportu v2 oraz odmowy publikacji po supersede.
- Brak weryfikacji demo/staging/produkcji — połączenia były zakazane.
- Nie zmierzono pamięci browsera przy 300 kryteriach; werdykt opiera się na payloadzie, HTTP i SQL.

## Sprzątanie

`docker rm -fv cx-day41-pg` wykonano; wynik `cx-day41-pg`. Kontener i anonimowy wolumen usunięto. `git stash list` pusty.

## Dodatek — naprawy po odbiorze adwersaryjnym (gałąź `day41-fixes-20260828`, 2026-08-27)

Odbiór dał werdykt WARUNKOWO ODRZUCONE: rdzeń (D.1–D.3, D.7, D.8, D.11) dobry, ale brakowało ostatniego ogniwa (eksport bez wołacza w UI) i dowodów wzrokowych. Poniżej stan po FIX-1..FIX-5. Baza: `codex/audits-day41-20260828` HEAD w chwili przekazania zadania `2969f89ba0`; przy starcie pracy gałąź miała już 4 dalsze commity innego wykonawcy (`c8ecd4d3be`, `ea5cdec7a4`, `0608e4b5ff`, `fafead88a8`) adresujące D.1/D.9/D.8-evidence/D.11 równolegle (dual-producer) — zweryfikowano je zamiast duplikować, patrz `CONSULTANTS_DUAL_PRODUCER_AUDIT_2026-08-26.md`.

**FIX-1 (wołacz eksportu w `AuditReportsTab.tsx`) — ZROBIONE.** Poprzedni wołacz (`ea5cdec7a4`) trafił WYŁĄCZNIE do `AuditReportDocumentView.tsx` (pełny widok raportu); lista Raportów (`AuditReportsTab.tsx`) nadal nie miała żadnego. Dodano kanoniczny slot „⋮ Pobierz" w kebabie bloku Details podglądu (`StandardPreviewDetails.onDownload`/`downloadLabel`), za `ff_auditsReportChain`. `AuditReportsTab.export.test.tsx` (3/3 PASS): flaga OFF renderuje zero akcji w kebabie, flaga ON woła realną trasę i pobiera, błąd HTTP pokazuje się inline (nie `alert()`). Dowód mutacyjny: odcięcie `onDownload` wywraca 2/3 testów na czerwono; przywrócenie — zieleń. Zero regresji w `AuditReportsTab.test.tsx` (4/4) i `check-list-canon.sh` (0 nowych naruszeń).

**FIX-2 (test HTTP eksportu) — ZWERYFIKOWANE, nie duplikowane.** `day41.reportExport.pg.test.ts` (dostarczony przez równoległego wykonawcę, `0608e4b5ff`) już spełnia literę: 200 + `Content-Type` wordprocessingml + niepusty bufor z nagłówkiem `PK` + 404 dla brakującego ID — 6/6 PASS na własnym PG (port 5813, kontener `cx-fix41-pg`). Dowód mutacyjny wykonany osobiście: zmiana trasy `/:id/export.docx` → `/:id/export-BROKEN.docx` w routerze wywala 6/6 testów na czerwono (404/ECONNREFUSED/zip-parse błędy); przywrócenie oryginału — 6/6 zieleń.

**FIX-3 (D.1 dowód łańcucha na realnym PG) — ZWERYFIKOWANE, nie duplikowane.** `day41.reportChainReachability.pg.test.ts` (`c8ecd4d3be`) ma dokładnie żądaną nazwę pliku i treść: `describe.skipIf(!REAL_PG)`, finalize → 201, `POST /reports` → 201, assercja 13 ID sekcji w kolejności (porównanie z realnym zapisem w bazie po przejściu przez prawdziwy `renderAuditReport`, nie ręczny fixture), `content_hash` raportu ≠ hash Outputu, oraz osobny test dowodzący że 9-etapowe przejście cyklu życia NIE tworzy Outputu. 2/2 PASS na własnym PG.

**FIX-4 (drobiazgi) — ZROBIONE, 4/4:**
1. Pusty stan w `AuditReportsTab.tsx` mówił „użyj akcji «Wystaw raport»" — etykieta nie istnieje. Ujednolicono z realnymi etykietami kebaba Outputów: „Generuj raport audytu" / „Generuj raport naprawczy" (landowało razem z commitem FIX-1, ten sam plik).
2. `reports.routes.ts:46` przestał podstawiać `{programName: null, organizationName: null}` na sztywno — `resolveReportContext()` czyta `audit_programs.name` i `organizations.name` dla tenantu raportu. Nowy test `day41.reportExportContext.pg.test.ts` (2/2 PASS) dowodzi, że nagłówek DOCX niesie realną nazwę organizacji zamiast degradować do tytułu raportu.
3. `reports.routes.ts:43` — `report.payload as unknown as AuditReportDocument` bez straży dawało `TypeError`→500 dla wiersza bez `sections`. `requireReportPayloadShape()` waliduje kształt i zwraca czytelne `422 AUDIT_REPORT_INVALID_PAYLOAD`. Ten sam nowy test dowodzi obu ścieżek. Dowód mutacyjny: przywrócenie starego kodu (bez kontekstu i bez straży) wywraca oba nowe testy na czerwono — nagłówek spada do tytułu raportu, malformed payload daje 500 zamiast 422; naprawiony kod — oba zielone.
4. Ten dokument — zaktualizowany o niniejszy dodatek (poprzedni fałsz „D.4/D.5 NIE_WYKONANO" przy istniejących commitach `e84ed17144`/`2969f89ba0` był już poprawiony przez równoległego wykonawcę w `9cc6c6e766`/R.1 przed startem tej pracy).

**FIX-5 (zrzuty do akceptu, flaga OFF) — ZROBIONE.** Uruchomiono realny front (Vite :3000) + realny backend (`server/src/index.ts`, `NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false` żeby ominąć pułapkę „cichego mocka" — patrz `server/src/startup/testModeGates.ts`) na własnym PG :5813 z zasianymi realnymi danymi (org „Fabryka Komponentów Wisła S.A.", program „Audyt jakości — Zakład Produkcyjny Wisła Q3 2026", 3 kryteria ISO 9001 z realną treścią). Flaga włączona WYŁĄCZNIE parametrem URL (`?ff_auditsReportChain=1`), nie w repo. Trzy akcje wykonane na żywo (nie zasymulowane): „Finalize Output" (D.4), „Generate audit report" (D.5), „Download DOCX" (FIX-1, sieciowo potwierdzone `200 OK` na `/export.docx`). Zrzuty light+dark (motyw wymuszony przez `consultify-storage` localStorage, bo domyślny motyw appki jest zahardkodowany na `dark` niezależnie od `prefers-color-scheme` — `uiSlice.ts:141`) w `docs/program/waves/WAVE_03_ACCEPTANCE/evidence/audits-day41-fixes/`. Obejrzane osobiście: zero crimson poza istniejącą kropką statusu „Model" (semantyka, nie CTA), etykiety PL, zero placeholderów/lorem ipsum, fokus niebieski zachowany.

**Nowe TWIERDZENIA NIEZWERYFIKOWANE (dodatek):**
- Panel „NEXT-STAGE GATES" w podglądzie sesji utknął na „Loading…" w zrzutach — poza zakresem tego dyżuru (nie dotknięto tego komponentu), nie zbadano przyczyny.
- Nie wykonano testu D.10 (jeden E2E cały łańcuch + v2 + supersede) — nadal `NIE_WYKONANO`, poza zakresem FIX-1..FIX-5.
- Zrzuty pokazują WYŁĄCZNIE trzy zakładki wymienione w zadaniu; nie wykonano pełnej 40-punktowej listy czekowania kanonu (`TRIADA_KANON.md` część B) — do zrobienia przy właściwym odbiorze wizualnym Piotra.

SHA commitów tej sesji (branch `day41-fixes-20260828`, worktree `/private/tmp/fix-day41`): `5e47f383ca` (FIX-4 backend), `f88ddcbe7c` (FIX-1), `53c8e43413` (FIX-5 evidence), plus ten commit (R.2 dodatek).
