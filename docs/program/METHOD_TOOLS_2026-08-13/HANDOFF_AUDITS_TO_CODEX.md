# HANDOFF AUDITS → CODEX

Dokument przejęcia modułu **Audits**. Wszystko poniżej zweryfikowane bezpośrednio
w Git i na dysku dnia 2026-08-14, bez opierania się na raportach agentów.
Tam, gdzie czegoś nie zmierzyłem, jest to napisane wprost jako `NOT_VERIFIED`
albo `MISSING` — nie jako brak wzmianki.

Pliki maszynowe w tym samym katalogu:
`HANDOFF_AUDITS_BRANCHES.tsv`, `HANDOFF_AUDITS_FILES.tsv`,
`HANDOFF_AUDITS_TESTS.tsv`, `HANDOFF_AUDITS_EVIDENCE.tsv`.

---

## 1. TOŻSAMOŚĆ KANDYDATA

| pozycja | wartość |
|---|---|
| moduł | Audits (metodyczny rdzeń audytu: Library → Sessions → Outputs → Reports → Initiatives) |
| integration branch | `codex/method-audits-20260813` |
| candidate SHA | `6a43c9a16473d0896bc5d11841b2461a47b9b366` |
| baseline SHA | `f3e7df565e0da826ba110d85aad3c3c81a1087f1` |
| merge-base(candidate, origin/demo) | `f3e7df565e0da826ba110d85aad3c3c81a1087f1` — identyczny z baseline |
| commity kandydata ponad baseline | 47 |
| commity demo, których kandydat nie ma | 44 |
| `git status --porcelain` | 0 linii (worktree czysty) |
| pushnięty? | **NIE** — `git branch -r --contains 6a43c9a164` nie zwraca nic |

Weryfikacja tożsamości obiektów:

```bash
git cat-file -t 6a43c9a164          # commit
git cat-file -t f3e7df565e          # commit
git merge-base 6a43c9a164 origin/demo
# → f3e7df565e0da826ba110d85aad3c3c81a1087f1
git rev-list --left-right --count origin/demo...6a43c9a164
# → 44   47
```

Baseline jest jednocześnie merge-base, więc `baseline...candidate` to czysty
zakres pracy modułu — bez domieszki commitów demo.

### Worktree modułu

Wszystkie istnieją i są przypięte do swoich gałęzi (`git worktree list`):

```
/Users/piotrwisniewski/consultify-wt/method-audits-20260813   6a43c9a164  [codex/method-audits-20260813]
/Users/piotrwisniewski/consultify-wt/u2 … u8                  (7 worktree)
/Users/piotrwisniewski/consultify-wt/w1 … w4                  (4 worktree)
```

Worktree **nie zostały usunięte** — Codex może wejść w każdy z nich bez odtwarzania.

Poza modułem istnieją też `~/.codex/worktrees/mac-audit2-a`, `mac-audit2-b`
(detached `e0afbc46a6`) i `mac-s7-a10-audit` (`codex/mac-s7-a10-audit-20260813`).
**Nie są częścią tego kandydata** — nazwa myli, treść niezwiązana; nie ruszałem ich.

### Gałęzie scalone / niescalone / odrzucone

- **Scalone: wszystkie 11** gałęzi roboczych. Każda jest liniowym przodkiem
  kandydata (`git merge-base --is-ancestor <b> 6a43c9a164` → prawda) i ma
  `git rev-list --count 6a43c9a164..<b>` = 0.
- **Niescalone: brak.**
- **Odrzucone: brak.** Żadna gałąź modułu nie została porzucona.
- `codex/method-audits-w4` wskazuje **dokładnie ten sam commit** co gałąź
  integracyjna (`6a43c9a164`) — to alias końca pracy, nie osobny zakres.

---

## 2. GENEALOGIA

Zweryfikowana przez `git merge-base` i `git rev-list`, nie przez nazwy.
Pełne dane w `HANDOFF_AUDITS_BRANCHES.tsv`.

| branch | SHA (skrót) | parent/baseline | zakres (z diffu, nie z nazwy) | scalona? | nadal potrzebna? | kolizje |
|---|---|---|---|---|---|---|
| `…-u2` | `8dd49c0631` | f3e7df565e | `server/src/services` | YES | nie (historia) | brak |
| `…-u3` | `50e1316cc7` | f3e7df565e | `server/src/services` | YES | nie | brak |
| `…-u4` | `1a051c1a92` | f3e7df565e | `server/src/routes`, `server/src/services` | YES | nie | brak |
| `…-u5` | `a7c5bfb272` | f3e7df565e | `server/src/services` | YES | nie | brak |
| `…-u6` | `d9a27ee6f3` | f3e7df565e | `server/src/routes`, `server/src/services` | YES | nie | brak |
| `…-u7` | `ee63d9772a` | f3e7df565e | `src/components/Audit`, `src/routes/AppRoutes.tsx` | YES | nie | dotyka trasy współdzielonej |
| `…-u8` | `5a4c297d2e` | f3e7df565e | `dev-render/main.tsx`, 2 ekrany harnessu | YES | nie | `dev-render/main.tsx` = plik wspólny |
| `…-w1` | `4e06f03151` | f3e7df565e | `src/components/Audit` | YES | nie | brak |
| `…-w2` | `d8d7c4edcf` | f3e7df565e | `src/components/Audit` | YES | nie | brak |
| `…-w3` | `96609b5ecb` | f3e7df565e | migracja `20260813b…`, `server/src/services` | YES | nie | druga migracja modułu |
| `…-w4` | `6a43c9a164` | f3e7df565e | = kandydat | YES | nie | alias kandydata |
| `…-20260813` | `6a43c9a164` | f3e7df565e | integracja całości | — | **TAK** | — |

### Kolejność semantyczna scaleń (odtworzona z zależności treści)

1. **u2, u3, u5** — warstwa danych i usług domenowych (fundament, bez zależności
   od tras i UI).
2. **u4, u6** — trasy HTTP nad tymi usługami (wymagają 1).
3. **w3** — druga migracja: rozdzielenie klasyfikacji źródeł na dwie osie
   (`source_type` × `verification_state`) plus dostosowanie usług. Musi iść po 1,
   bo modyfikuje kształt danych, na którym stoją usługi.
4. **u7, w1, w2** — powierzchnie UI modułu (wymagają 2).
5. **u8** — ekrany harnessu `dev-render` (weryfikacja wzrokiem; wymaga 4).
6. **…-20260813 / w4** — integracja, dokumentacja funkcjonalna, ekran warsztatu
   kryterium.

Kolejność jest odtworzeniem logiki, nie zapisem historii: faktyczna historia jest
**liniowa**, więc Codex nie musi jej odtwarzać — wystarczy `6a43c9a164`.

---

## 3. RZECZYWISTY DIFF

```bash
git diff --stat f3e7df565e...6a43c9a164 | tail -1
# → 106 files changed, 33117 insertions(+)
```

**Zero usunięć.** Kandydat wyłącznie dodaje — nie kasuje ani nie przepisuje
cudzego kodu. Pełna lista z klasyfikacją: `HANDOFF_AUDITS_FILES.tsv`.

| klasa | plików |
|---|---|
| `MODULE_OWNED` | 55 |
| `TEST` | 37 |
| `SHARED_CONTRACT` | 5 |
| `FOREIGN_OR_SUSPECT` | 4 |
| `EVIDENCE` | 3 |
| `MIGRATION` | 2 |

### Migracje (2)

- `server/migrations/20260813_audits_method_core.sql`
- `server/migrations/20260813b_audits_source_classification_split.sql`

### Współdzielony kontrakt (5) — **uwaga, tu jest kolizja, patrz §13 P0-1**

`src/method-core/contracts/{events,index,methodPack,session,teresa}.ts`
Wszystkie pięć to pliki **nowe** — nie istniały w baseline
(`git cat-file -e f3e7df565e:<path>` → brak). Kandydat Audits **wprowadza**
kontrakt kernela, nie modyfikuje istniejącego.

### Współdzielone UI

**Brak.** Kandydat nie zmienia `src/components/standard/` ani
`src/components/shared/` — cała warstwa TRIADY jest nietknięta.

### FOREIGN_OR_SUSPECT (4) — pochodzenie wyjaśnione

Wszystkie cztery to konieczne punkty podłączenia modułu, nie obce zmiany.
Każdy zweryfikowany przez policzenie wzmianek o audycie w samym diffie:

| plik | + linii | wzmianek „audit" w diffie | ocena |
|---|---|---|---|
| `server/src/Gateway.ts` | 6 | 11 | montaż 4 routerów modułu — konieczne |
| `src/hooks/useFeatureFlags.tsx` | 24 | 10 | deklaracja flagi `auditsFiveSurfacesV1` |
| `src/routes/AppRoutes.tsx` | 88 | 43 | trasa modułu za flagą |
| `server/scripts/cleanup-audit-test-data.ts` | 121 | 26 | sprzątanie danych testowych — de facto `MODULE_OWNED` |

Żaden z nich nie usuwa ani nie przepisuje cudzej logiki (0 usunięć w całym diffie).

---

## 4. ŚLAD PRODUKTOWY

Zweryfikowany przez odczyt plików, nie przez założenie.

| ogniwo | ścieżka / nazwa | status |
|---|---|---|
| route | `src/routes/AppRoutes.tsx:438` — `/audit-programs/method`, **za flagą** | OBECNE |
| flaga | `src/hooks/useFeatureFlags.tsx:204` — `auditsFiveSurfacesV1`, **default OFF** | OBECNE |
| screen | `src/components/Audit/AuditsHub.tsx` (5 powierzchni) | OBECNE |
| client API | `src/components/Audit/auditApi.ts` | OBECNE |
| HTTP endpoint | `server/src/Gateway.ts:71` → `server/src/routes/audits/index.ts` | OBECNE |
| controller/service | `server/src/services/audits/` — 20 serwisów (`criterionService`, `evidenceService`, `findingService`, `correctiveActionService`, `verificationService`, `outputService`, `reportService`, `reportRenderer`, `permissions`, `lifecycle`, `auditsDb`, …) | OBECNE |
| database tables | 22 tabele `audit_*` (potwierdzone w `information_schema`) | OBECNE |
| migrations | 2 (wyżej) | OBECNE |
| Output | `server/src/services/audits/outputService.ts`; tabela `audit_outputs` | **kod OBECNY, dane 0 wierszy** |
| Report | `reportService.ts` + `reportRenderer.ts`; `audit_reports` = 1 wiersz po golden flow | OBECNE |
| Presentation | — | **MISSING** — moduł nie ma powierzchni prezentacyjnej |
| Initiative | `audit_initiative_proposals` (0 wierszy), `proposalService.ts` | kod OBECNY, przebieg NOT_VERIFIED |
| E2E test | `server/src/services/audits/__tests__/goldenFlow.e2e.test.ts` — **serwisowy**, nie przeglądarkowy | patrz §9 |

**MISSING (bez zastępowania testem jednostkowym ani harnessem):**
- **Browser E2E** — nie istnieje żaden przebieg w prawdziwej przeglądarce.
- **Presentation** — ogniwa nie ma w module.
- **Podłączenie produkcyjne** — flaga `auditsFiveSurfacesV1` jest domyślnie OFF,
  więc trasa nie jest osiągalna dla użytkownika bez ręcznej zmiany.

---

## 5. MODEL DANYCH I ŹRÓDŁO PRAWDY

Stan zmierzony na świeżej bazie `consultify_audits_ho` po migracjach i po
przebiegu golden flow (liczby = realne wiersze).

| tabela | wierszy | producent | konsumenci | seed | status |
|---|---|---|---|---|---|
| `audit_domain_events` | 96 | `auditsDb.recordAuditEvent` | audit trail, lineage | z przebiegu | current |
| `audit_programs` | 22 | `programService` | Library, Sessions | test/przebieg | current |
| `audit_program_criteria` | 14 | `criterionService` | Criterion Workspace | przebieg | current |
| `audit_ai_proposals` | 11 | `aiProposalService` | propozycje AI | przebieg | current |
| `audit_program_members` | 10 | `programService` | role, SoD | przebieg | current |
| `audit_program_findings` | 5 | `findingService` | Findings, Report | przebieg | current |
| `audit_evidence` | 4 | `evidenceService` | dowody kryterium | przebieg | current |
| `audit_corrective_actions` | 3 | `correctiveActionService` | działania korygujące | przebieg | current |
| `audit_evidence_requests` | 1 | `evidenceService` | żądania dowodu | przebieg | current |
| `audit_reports` | 1 | `reportService` | Reports | przebieg | current |
| `audit_verifications` | 1 | `verificationService` | weryfikacja skuteczności | przebieg | current |
| `audit_findings` | **0** | — | — | — | **równoległy, nieużywany** |
| `audit_packs`, `audit_pack_criteria` | **0** | — | — | — | **równoległy, nieużywany** |
| `audit_outputs` | **0** | `outputService` (kod) | — | — | kod bez przebiegu |
| `audit_norm_sources` | **0** | `normSourceService` (kod) | rejestr norm | brak seedu | **EVIDENCE_MISSING** |
| `audit_initiative_proposals` | 0 | `proposalService` | Initiatives | — | kod bez przebiegu |
| `audits`, `audit_events`, `audit_log`, `audit_logs`, `audit_management_responses` | 0 | — | — | — | legacy/obce |

### Konflikty źródła prawdy (NIE rozstrzygam ich usuwaniem danych)

1. **`audit_program_findings` (5, żywe) vs `audit_findings` (0, martwe)** — dwa
   równoległe modele ustaleń. Żywy jest ten pierwszy.
2. **`audit_programs` (22, żywe) vs `audit_packs`/`audit_pack_criteria` (0)** —
   dwa modele „pakietu audytowego”.
3. **Trzy równoległe rodziny tras** zamontowane naraz w `Gateway.ts:68-71`:
   `audit.routes`, `audit-events.routes`, `audit-programs.routes`,
   `audits/index`. To cztery wejścia do zachodzących na siebie pojęć.
4. **`audit_norm_sources` puste** — rejestr źródeł normatywnych nie ma seedu.
   Bez niego klasyfikacja `LICENSED_STANDARD`/`REGULATION` nie ma czym się
   podeprzeć. Nie wypełniałem: to treść licencjonowana (ISO/IATF) —
   `EVIDENCE_MISSING` zostaje.

Rozstrzygnięcie 1–3 to decyzja produktowa (który model jest kanoniczny),
nie operacja techniczna.

---

## 6. MIGRACJE

Kolejność i wynik — **wyłącznie na jednorazowej bazie lokalnej**
(`postgres@17`, port 5439, baza `consultify_audits_ho`).
**Nie uruchamiane na demo, staging ani PROD.**

```bash
createdb -h 127.0.0.1 -p 5439 consultify_audits_ho
psql … -c "create extension if not exists vector;"
NODE_ENV=test DB_TYPE=postgres POSTGRES_SKIP_INIT_IN_TEST=1 \
DATABASE_URL=postgresql://…/consultify_audits_ho \
npx tsx server/scripts/migrate.postgres.ts
# → exit 0, "✅ Postgres migrations complete"
```

- **fresh bootstrap:** PASS — pełny łańcuch migracji repo przechodzi od zera,
  22 tabele `audit_*` powstają.
- **upgrade path:** NOT_VERIFIED — nie odtwarzałem migracji na bazie z wcześniejszym
  stanem modułu (brak takiej bazy poza demo, którego nie wolno ruszać).
- **ledger:** runner repo (`migrate.postgres.ts`) prowadzi własny rejestr
  zastosowanych plików; migracje modułu są w fazie DATED, więc idą po numerowanych.
- **information_schema:** 22 tabele `audit_*` potwierdzone zapytaniem, nie z kodu.
- **producent tabel:** obie migracje modułu (§3).
- **migracje pomijane przez filtry:** runner ma `isSqliteOnlyMigration()`, które
  po cichu pomija pliki numerowane < 500, oraz jest **nierekurencyjny** (pliki
  w podkatalogach nie zostaną uruchomione). Obie migracje Audits są DATED i leżą
  płasko, więc **nie są pomijane** — ale Codex musi o tym filtrze wiedzieć.
- **migracje nieuruchomione / odrzucone:** brak.
- **pgvector:** wymagany; zbudowany dla `postgresql@17/@18`, **nie dla @16**.
  Na pg16 łańcuch pada na `20260719_baseline_gap.sql`.

---

## 7. FUNKCJE I DoD

Rozdzielone celowo: *istnieje kod* ≠ *podłączone* ≠ *przetestowane* ≠ *odebrane*.

| requirement | implemented | wired in production | persisted | browser verified | evidence | status |
|---|---|---|---|---|---|---|
| Audit Pack / program | TAK | NIE (flaga OFF) | TAK (22 wiersze) | NIE | `programService` + baza | PARTIAL |
| Rejestr źródeł norm + prawa/licencje | TAK (kod) | NIE | **NIE (0 wierszy)** | NIE | `normSourceService` | EVIDENCE_MISSING |
| Klasyfikacja dwuosiowa (typ × weryfikacja) | TAK | NIE | TAK | NIE | migracja `…b`, `sourceClassificationAxes.test.ts` | PARTIAL |
| Procedury dowodowe (evidence) | TAK | NIE | TAK (4) | NIE | `evidenceService` + test | PARTIAL |
| Ustalenia (findings) | TAK | NIE | TAK (5) | NIE | `findingService` + test | PARTIAL |
| Działania korygujące | TAK | NIE | TAK (3) | NIE | `correctiveActionService` + test | PARTIAL |
| Weryfikacja skuteczności | TAK | NIE | TAK (1) | NIE | `verificationService` + test | PARTIAL |
| Zamknięcie ustalenia | TAK | NIE | TAK (golden flow) | NIE | `goldenFlow.e2e` | PARTIAL |
| Role i segregacja obowiązków | TAK | NIE | TAK (10 członków) | NIE | `segregationOfDuties.test.ts` | PARTIAL |
| Outputs | TAK (kod) | NIE | **NIE (0)** | NIE | `outputService` | NOT_VERIFIED |
| Reports | TAK | NIE | TAK (1) | NIE | `reportService`, `reportRenderer` | PARTIAL |
| Initiatives z audytu | TAK (kod) | NIE | **NIE (0)** | NIE | `proposalService` | NOT_VERIFIED |
| Teresa: Intent→Preview→Commit | TAK (kod) | NIE | NIE | NIE | `aiProposalService`, `aiBoundaries.test.ts` | NOT_VERIFIED |
| Pełny zestaw testów | TAK | — | — | — | 149/149 (§8) | PASS |
| Odbiór manualny / MPQ / TRIADA | — | — | — | NIE | brak zrzutów na dysku | EVIDENCE_MISSING |
| Browser E2E | NIE | — | — | NIE | — | MISSING |

**Podsumowanie statusów:** PASS 1 · PARTIAL 9 · NOT_VERIFIED 3 · EVIDENCE_MISSING 2 · MISSING 1 · FAIL 0 · BLOCKED 0.

---

## 8. TEST DISCOVERY I REGRESJA

Komenda (dokładna, odtwarzalna):

```bash
cd /Users/piotrwisniewski/consultify-wt/method-audits-20260813
NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false \
POSTGRES_SKIP_INIT_IN_TEST=1 AI_PROVIDER_MODE=mock \
DATABASE_URL="postgresql://$USER@127.0.0.1:5439/consultify_audits_ho" \
npx vitest run server/src/services/audits --no-file-parallelism --retry=0
```

| pozycja | wartość |
|---|---|
| plików testowych modułu w drzewie | 19 (`git ls-tree` → `services/audits/__tests__/*.test.ts`) |
| odkrytych przez runner | 19 |
| wykonanych | 19 |
| testów | **149 passed (149)** |
| pominiętych | 0 |
| retry | **wyłączone** (`--retry=0`) — repo domyślnie ma `retry: 1`, co potrafi zamaskować twardy fail jako flaky |
| worker count | 1 (`--no-file-parallelism`) — równoległe ciężkie przebiegi bywają ubijane (exit 144) |
| środowisko | macOS, Node 24, `AI_PROVIDER_MODE=mock` |
| baza | PostgreSQL 17 @ 5439, `consultify_audits_ho`, realny schemat z migracji |

**Regresja względem baseline:** `identical_pre_existing` — nie dotyczy.
Kandydat **wyłącznie dodaje** pliki (0 usunięć, wszystkie 19 plików testowych to
pliki nowe), więc nie mógł zepsuć istniejącego testu przez modyfikację.

- introduced (nowe czerwone): **0**
- fixed: 0
- identical_pre_existing: n/d dla zakresu modułu
- flaky: 0 przy `--retry=0`

**NOT_VERIFIED:** pełny przebieg całego `server/` i całego `src/` na tym kandydacie.
Zmierzyłem wyłącznie zakres modułu. Liczby dla całego repo z innego kandydata
(Assessment) **nie przenoszą się** na ten SHA i nie zostały tu wpisane.

---

## 9. BROWSER E2E

**Status: MISSING.**

Nie istnieje żaden przebieg w prawdziwej przeglądarce dla tego modułu i **nie
zastępuję go niczym innym**. Klasyfikacja tego, co faktycznie zostało wykonane:

| poziom | co | wynik |
|---|---|---|
| `TRUE_BROWSER_UI` | — | **BRAK** |
| `BROWSER_PLUS_DIRECT_HTTP` | — | BRAK |
| `HTTP_ONLY` | — | BRAK (nie uruchamiałem serwera HTTP na tym kandydacie) |
| `HARNESS_ONLY` | ekrany `dev-render` (`audyty-warsztat-kryterium`, `audyty-piec-powierzchni`) istnieją w drzewie | kod obecny, **przebieg NOT_VERIFIED** |
| `UNIT_ONLY` | 149 testów serwisowych, w tym `goldenFlow.e2e` | PASS |

`goldenFlow.e2e.test.ts` mimo nazwy **nie jest testem przeglądarkowym** — woła
serwisy bezpośrednio. Jest mocnym dowodem logiki domenowej i żadnym dowodem UI.

Przeszkoda praktyczna dla Codex: trasa modułu jest za flagą `auditsFiveSurfacesV1`
(default OFF), więc samo uruchomienie aplikacji nie pokaże modułu.

---

## 10. MPQ, TRIADA I ACCESSIBILITY

**Status: EVIDENCE_MISSING.**

Sprawdziłem fizycznie (`test -f`) — **na dysku nie ma ani jednego zrzutu
ekranu dla tego modułu**. Wcześniejsza runda raportowała wynik TRIADY 21✓/18✗,
ale jest to raport agenta bez trwałych artefaktów, więc zgodnie z poleceniem
**nie deklaruję go jako dowodu**.

| widok | Light | Dark | MPQ | TRIADA | a11y | zoom | keyboard | VoiceOver | zrzut |
|---|---|---|---|---|---|---|---|---|---|
| Library / Sessions / Outputs / Reports / Initiatives | — | — | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED | **BRAK** |

### MISSING_EVIDENCE

- zrzuty Light/Dark dla 5 powierzchni modułu — **nie istnieją na dysku**;
- pomiar MPQ przy konkretnym SHA/URL/viewport — nie wykonany;
- pomiar pierścienia fokusa (`getComputedStyle`) na powierzchniach Audits — nie wykonany;
- test VoiceOver i zoom — nie wykonane;
- seed `audit_norm_sources` — brak (treść licencjonowana, świadomie).

Wszystkie pozycje `HANDOFF_AUDITS_EVIDENCE.tsv` mają `exists_on_disk=YES`,
ponieważ zadeklarowałem tam **wyłącznie** artefakty, które fizycznie sprawdziłem.
Braki są wypisane powyżej zamiast wpisywania ich jako fikcyjnych ścieżek.

---

## 11. ARTEFAKTY I LINEAGE — DOWÓD CRITERION WORKSPACE

Wymagany przebieg
`criterion → evidence → test → finding → corrective action → effectiveness verification → closure`
**jest udowodniony wykonaniem**, nie lekturą kodu.

Test: `server/src/services/audits/__tests__/goldenFlow.e2e.test.ts`
Nazwa przypadku: *„GOLDEN FLOW — audyt od pakietu do zamkniętego ustalenia →
przechodzi pełny łańcuch i zachowuje traceability”* — **PASS w 1035 ms**
(`--retry=0`, realny PostgreSQL).

Materialny ślad po przebiegu, odczytany z bazy zapytaniem, nie z logu testu:

| ogniwo łańcucha | tabela | wierszy |
|---|---|---|
| criterion | `audit_program_criteria` | 14 |
| evidence | `audit_evidence` (+ `audit_evidence_requests` 1) | 4 |
| finding | `audit_program_findings` | 5 |
| corrective action | `audit_corrective_actions` | 3 |
| effectiveness verification | `audit_verifications` | 1 |
| closure / raport | `audit_reports` | 1 |
| ślad zdarzeń (traceability) | `audit_domain_events` | 96 |
| role i SoD | `audit_program_members` | 10 |

Segregacja obowiązków jest osobno pokryta (`segregationOfDuties.test.ts`):
autor ustalenia nie zamyka własnego ustalenia, weryfikator jest niezależny,
AI nigdy nie zatwierdza (`aiBoundaries.test.ts`).

### Czego w lineage NIE MA (nie zaokrąglam)

- `audit_outputs` = **0** — ogniwo Output nie zostało wyprodukowane w przebiegu;
- `audit_initiative_proposals` = **0** — Initiative nie powstała;
- **reopen / supersession** — `NOT_VERIFIED`, brak przebiegu;
- **Presentation** — `MISSING` (ogniwa nie ma w module);
- identyfikatory rekordów pochodzą z jednorazowej bazy `consultify_audits_ho`
  utworzonej dziś; nie są stabilne między przebiegami, bo test generuje je losowo.

Dowód wspólnego pochodzenia artefaktów: wszystkie rekordy powstały w jednym
przebiegu jednego testu na świeżo utworzonej bazie (przed przebiegiem: 22 tabele,
0 wierszy). Nie ma tam danych z innego źródła.

---

## 12. READINESS

**Niczego nie podnosiłem i nie zmieniałem żadnej flagi.**

| kategoria | status | dowód |
|---|---|---|
| Technical | **PARTIAL** | migracje od zera exit 0; 149/149 testów; 0 usunięć w diffie; worktree czysty |
| Methodology | **BLOCKED** | `audit_norm_sources` = 0 wierszy; bez zatwierdzonego źródła normatywnego klasyfikacja `LICENSED_STANDARD`/`REGULATION` nie ma podstawy |
| Legal | **BLOCKED** | treść norm ISO/IATF nie została i nie może zostać skopiowana; `EVIDENCE_MISSING` zachowane świadomie |
| Runtime | **NOT_ACTIVE** | trasa za flagą `auditsFiveSurfacesV1`, default OFF; kandydat niepushnięty; brak deployu |
| Client publication | **BLOCKED** | brak odbioru wizualnego (§10), brak Browser E2E (§9), brak Presentation |

---

## 13. ZNANE DEFEKTY I BRAKI

### P0-1 — Rozjazd współdzielonego kontraktu kernela z kandydatem Assessment

- **Reprodukcja:**
  ```bash
  git rev-parse 6a43c9a164:src/method-core/contracts/index.ts   # 149222810c…
  git rev-parse 031772082b:src/method-core/contracts/index.ts   # 144f8193f4…
  ```
- **Przyczyna:** oba kandydaty **niezależnie wprowadzają** ten sam plik kontraktu
  (na `origin/demo` go nie ma). Rozjechane 4 z 5 plików: `index`, `methodPack`,
  `session`, `teresa`. Identyczny: `events`.
- **Skala:** `index.ts` różni się o ~20 linii — kolizja realna, ale mała.
- **Ryzyko:** przy scalaniu obu kandydatów Git zgłosi konflikt w plikach, które
  są **kontraktem dwóch modułów naraz**. Rozstrzygnięcie „po jednej stronie”
  może po cichu cofnąć zmiany drugiego modułu.
- **Proponowana naprawa:** wybrać kontrakt kanoniczny **przed** scaleniem,
  scalić go osobnym commitem, potem dopiero moduły. W repo Assessment istnieje
  `contractMirrorDrift.test.ts` wymagający bajtowej zgodności kopii serwerowej —
  uruchomić go po scaleniu.
- **Brakujący test:** brak testu pilnującego zgodności kontraktu **między
  modułami** (istniejący pilnuje tylko kopii serwer↔klient w Assessment).

### P0-2 — Moduł nie jest podłączony produkcyjnie

- **Reprodukcja:** uruchom aplikację, wejdź na `/audit-programs/method` → trasa
  nieaktywna, bo `auditsFiveSurfacesV1` = OFF (`useFeatureFlags.tsx:204`).
- **Przyczyna:** świadome zabezpieczenie (moduł nieodebrany wizualnie).
- **Ryzyko:** każdy raport „moduł gotowy” liczony bez tego faktu jest zawyżony.
- **Naprawa:** dopiero po §10 i §9. Nie podnosić samodzielnie.

### P1-1 — Trzy równoległe modele danych audytu

- **Reprodukcja:** `audit_program_findings`=5 vs `audit_findings`=0;
  `audit_programs`=22 vs `audit_packs`=0; cztery routery w `Gateway.ts:68-71`.
- **Ryzyko:** drugie źródło prawdy; przyszły kod może zapisać do martwej tabeli
  i „zniknąć” dane.
- **Naprawa:** decyzja produktowa, który model jest kanoniczny; potem migracja
  wygaszająca — **nie usuwać danych w ramach porządków**.
- **Brakujący test:** brak asercji, że moduł pisze wyłącznie do modelu kanonicznego.

### P1-2 — Brak Browser E2E i odbioru wizualnego

- Patrz §9 i §10. Brak jakichkolwiek trwałych zrzutów na dysku.
- **Naprawa:** przebieg w prawdziwej przeglądarce po włączeniu flagi lokalnie,
  ze zrzutami Light i Dark zapisanymi jako pliki.

### P1-3 — Rejestr źródeł normatywnych pusty

- `audit_norm_sources` = 0. Bez tego oś `verification_state` nie ma o co się oprzeć.
- **Naprawa:** decyzja licencyjna właściciela. **Nie generować treści norm.**

### P2-1 — Ogniwa Output / Initiative bez przebiegu

- `audit_outputs` = 0, `audit_initiative_proposals` = 0 mimo istniejących serwisów.
- **Brakujący test:** rozszerzenie golden flow o Output i propozycję inicjatywy.

### P2-2 — Pułapki runnera migracji

- `isSqliteOnlyMigration()` po cichu pomija pliki < 500; runner nierekurencyjny.
- Migracje Audits nie są dotknięte, ale przyszła migracja w podkatalogu **nie
  uruchomi się bez ostrzeżenia**.

---

## 14. NASTĘPNE KROKI DLA CODEX

1. **Pierwszy checkout — dokładnie ten SHA:**
   ```bash
   git checkout 6a43c9a16473d0896bc5d11841b2461a47b9b366
   # albo wejdź w gotowy worktree:
   cd /Users/piotrwisniewski/consultify-wt/method-audits-20260813
   ```
   Nie odtwarzaj u2…w4 — historia jest liniowa, kandydat zawiera wszystko.

2. **Odtwórz bramkę bazową (jednorazowa baza, nigdy demo):**
   ```bash
   createdb -h 127.0.0.1 -p 5439 audits_verify
   psql -h 127.0.0.1 -p 5439 -d audits_verify -c "create extension if not exists vector;"
   NODE_ENV=test DB_TYPE=postgres POSTGRES_SKIP_INIT_IN_TEST=1 \
   DATABASE_URL="postgresql://$USER@127.0.0.1:5439/audits_verify" \
   npx tsx server/scripts/migrate.postgres.ts
   ```
   Wymagany PostgreSQL **17 lub 18** (pgvector nie działa na 16).

3. **Powtórz bramkę testową (musi dać 149/149):**
   ```bash
   NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false \
   POSTGRES_SKIP_INIT_IN_TEST=1 AI_PROVIDER_MODE=mock \
   DATABASE_URL="postgresql://$USER@127.0.0.1:5439/audits_verify" \
   npx vitest run server/src/services/audits --no-file-parallelism --retry=0
   ```
   `--retry=0` jest istotne: domyślne `retry: 1` maskuje twarde błędy.

4. **Kolejność scalania, jeśli łączysz Audits z Assessment (`031772082b`):**
   1. rozstrzygnij kontrakt kernela (P0-1) i scal go **osobnym commitem**;
   2. dopiero potem scal moduły;
   3. po każdym scaleniu uruchom: `npx tsc -p server --noEmit` (oczekiwane 0),
      testy kernela Assessment (259/259) i testy Audits (149/149);
   4. jeśli obecny jest `contractMirrorDrift.test.ts` — musi być zielony,
      **nie wyłączaj go**.

5. **Konflikty semantyczne do przewidzenia:**
   - `src/method-core/contracts/*` — 4 z 5 plików (P0-1);
   - `dev-render/main.tsx` — wspólny rejestr ekranów, dopisują do niego wszystkie
     strumienie; konflikt tekstowy, rozwiązanie = suma wpisów;
   - `server/src/Gateway.ts` — montaż routerów, sąsiadujące linie;
   - `src/routes/AppRoutes.tsx`, `src/hooks/useFeatureFlags.tsx` — dopisywane wpisy.

6. **Pierwsza prawdziwa bramka runtime** (dotąd nieprzekroczona):
   uruchomić serwer na jednorazowej bazie, włączyć `auditsFiveSurfacesV1`
   **lokalnie**, wejść na `/audit-programs/method` w przeglądarce i przejść
   Criterion Workspace klikaniem. Dopiero to zamyka §9 i §10.

7. **Wznowienie pozycji PARTIAL/NOT_VERIFIED:**
   - Output + Initiative: rozszerzyć `goldenFlow.e2e.test.ts` o `outputService`
     i `proposalService`, potem sprawdzić `select count(*) from audit_outputs`;
   - reopen/supersession: brak testu — napisać;
   - MPQ/TRIADA: przebieg w `dev-render` (`audyty-piec-powierzchni`,
     `audyty-warsztat-kryterium`) ze zrzutami zapisanymi na dysk.

---

## 15. ZAKAZY I STAN KOŃCOWY

Potwierdzam, zweryfikowane w Git:

- **zero merge do `demo`/`main`/`Londyn`** — kandydat nie jest przodkiem żadnej
  z nich (`git branch -r --contains 6a43c9a164` nie zwraca nic);
- **zero push** — kandydat nie istnieje w żadnym zdalnym repozytorium;
- **zero deploy**;
- **PROD nietknięty** — wszystkie operacje bazodanowe wyłącznie na lokalnej,
  jednorazowej bazie `consultify_audits_ho` (port 5439);
- **brak `reset` / `clean` / `stash`** na tym module;
- **brak usuwania worktree** — wszystkie 12 nadal istnieją i są przypięte;
- **brak podniesienia RUNTIME_ACTIVE** — flaga `auditsFiveSurfacesV1` pozostaje OFF;
- **brak przepisywania wspólnej historii** — historia liniowa, bez rebase i bez
  force.

Jedyne zapisy wykonane przy tworzeniu tego handoffu to ten dokument i cztery
pliki `.tsv` w `docs/program/METHOD_TOOLS_2026-08-13/`. Kod produktu nietknięty.

---

*Sporządzono 2026-08-14. Kandydat `6a43c9a164`, baseline `f3e7df565e`.*
