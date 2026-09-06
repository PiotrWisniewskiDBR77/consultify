# 1.11 — Statusy inicjatyw: POMIAR STANU ZASTANEGO

Data pomiaru: 2026-09-06. Gałąź: `mvp/111-statusy-inicjatyw` (baza `codex/m03-admin-20260824`, HEAD `8d1600d530`).
Metoda: czytanie realnego kodu (`src/`, `server/src/`, `server/migrations/`) + liczenie wierszy na lokalnej bazie
`consultify-noc-pg / consultify_noc`. Dokumentów NIE traktowano jako źródła. Każde twierdzenie ma `plik:linia`.

Wejście z rejestru I2 mówiło o „~6 słownikach". **Zmierzono 19.** Wejście R3 potwierdzone.
Teza „propozycje z Audytów nie mają drogi do inicjatywy" — **OBALONA** (droga istnieje, §3.7).

---

## §1. Inwentarz słowników statusów

| # | Słownik (enum/typ/kolumna) | plik:linia | Wartości | Kto zapisuje | Kto czyta | Źródło |
|---|---|---|---|---|---|---|
| 1 | `InitiativeStatus` (SSOT serwera, 13) | `server/src/constants/initiativeStatuses.ts:34` | DRAFT · PENDING_REVIEW · REVIEW · PROMOTED · PLANNING · APPROVED · SCHEDULED · EXECUTING · BLOCKED · DONE · TRACKING · CANCELLED · ARCHIVED | `executeInitiativeTransition` (`server/src/services/initiative/initiativeTransitionService.ts:387`) przez `PATCH /api/initiatives/:id/status` (`server/src/routes/pmo/initiatives.routes.ts:3118`) | cały rejestr inicjatyw, Realizacja, Wyniki | Inicjatywy |
| 2 | `enum InitiativeStatus` (front, 13) | `src/types/core.ts:732` | jw. | tylko typowanie/atrapy (`src/components/Initiatives/initiativesDemoData.ts:999`) | `initiativeRegisterProjection.ts` | Inicjatywy |
| 3 | `type InitiativeStatus` (filtr, 13) | `src/components/shared/ModuleHub/StatusDropdown.tsx:23` | jw. | — (tylko filtr) | Menu 2/3 wszystkich modułów listowych | wspólny |
| 4 | `LEGACY_INITIATIVE_STATUSES` (13) | `src/contracts/initiatives-execution/legacyCompatibility.ts:9` | jw. | — | rzutowanie legacy→runtime | Inicjatywy |
| 5 | `INITIATIVE_LIFECYCLE` (runtime-v1, 12) | `src/contracts/initiatives-execution/foundation.ts:1` | REGISTERED_DRAFT · DEFINED · ANALYZING · READY_FOR_DECISION · APPROVED_BACKLOG · SCHEDULED · IN_EXECUTION · DELIVERED · BENEFITS_TRACKING · EFFECTIVENESS_REVIEWED · CLOSED · ARCHIVED | domena zdarzeniowa `server/src/domain/initiatives-execution/*` → `ie_aggregate_state.payload_json` (`postgresMaterialCommandUnitOfWork.ts`) | `InitiativesHub`, `InitiativeDocumentView` przez `src/services/initiatives-execution/runtimeApi.ts:85` | Inicjatywy/Realizacja |
| 6 | `INITIATIVE_LIFECYCLE_LABELS` (14 kluczy) | `src/components/Initiatives/initiativeRegisterProjection.ts:38` | dodaje `DEFINING` i `CANCELLED`, których w słowniku 5 NIE MA | — | kolumna „Cykl życia" rejestru | Inicjatywy |
| 7 | `GateType`/`GATE_PERMISSIONS` (14 bramek) | `server/src/constants/initiativeStatuses.ts:91` i `:117` | SUBMIT_FOR_REVIEW … CANCEL | — | walidacja RBAC przejścia | Inicjatywy |
| 8 | lustro bramek na froncie | `src/services/initiativeLifecycle.ts:634` (GateType), `:673` (GATE_PERMISSIONS) | jw. + role `ADMIN`,`TEAM_MEMBER` | — | wyszarzanie akcji w UI | Inicjatywy |
| 9 | `InitiativeStatus` (deprecated, 5, małe litery) | `server/src/types/index.ts:164` | draft·planning·active·completed·cancelled | — | interfejs `Initiative` (legacy) | serwer |
| 10 | `InitiativeStatus` (8, małe litery) | `packages/shared/src/types/domain/project.ts:217` | draft·planning·approved·active·on_hold·completed·cancelled·archived | — | pakiet współdzielony | wspólny |
| 11 | `InitiativeStatus` (5, małe litery) | `server/src/services/reportInitiativeService.ts:21` | draft·proposed·approved·in_progress·completed | generator z raportu Oceny | Raport oceny | Ocena |
| 12 | `GeneratedInitiativeStatus` (3) | `src/types/core.ts:3275` | DRAFT·APPROVED·TRANSFERRED | — | typ generatora | Ocena |
| 13 | `CandidateStatus` (3) | `server/src/services/initiative/initiativeCandidateService.ts:55`, kolumna `initiative_candidates.status` (`server/migrations/20260627_initiative_candidates.sql:24`) | pending·accepted·dismissed | `POST /api/initiative-candidates/:id/accept|dismiss` (`server/src/routes/initiativeCandidates.routes.ts:153`,`:197`) | zakładka „Kandydaci" | Wywiad/Ocena/Audyty |
| 14 | `PROPOSAL_STATUSES` (5) | `server/src/services/audits/types.ts:740`, tabela `audit_initiative_proposals` | draft·sent_to_candidates·registered·deferred·dismissed | `server/src/services/audits/proposalService.ts:405`,`:440`,`:510` | zakładka Propozycje audytu | Audyty |
| 15 | `AI_PROPOSAL_STATUSES` (5) | `server/src/services/audits/types.ts:790` | pending·accepted·rejected·superseded·expired | `server/src/routes/audits/ai.routes.ts:84` | Teresa w Audytach | Audyty |
| 16 | `SourceProposalDisposition` (6) | `server/src/domain/initiatives-execution/materialCommand.ts:122` | REGISTER·MERGE·EXTEND·RETURN·DEFER·DISMISS | `decideSourceProposal.ts:104` | skrzynka propozycji runtime-v1 | wszystkie źródła |
| 17 | `InitiativeDisposition` (6) / `GateState` (6) / `ExecutionState` (6) | `src/contracts/initiatives-execution/foundation.ts:50`,`:35`,`:58` | ACTIVE·DEFERRED·REJECTED·MERGED·STOPPED·CANCELLED / … | domena runtime-v1 (`handoffAcceptance.ts:147`,`:285`) | prawy panel artefaktu | Realizacja |
| 18 | `InitiativeGenerationRunStatus` (5) | `server/src/services/assessmentInitiativeGenerationRunService.ts:23` | RUNNING·SUCCEEDED·PARTIAL·FAILED·CANCELLED | tamże `:261`,`:284`,`:508` | modal generatora (`src/components/Initiatives/Generator/types.ts:51`) | Ocena |
| 19 | `KPI_STATUSES` (5) + `KPI_APPROVAL_STATUSES` (4) | `server/src/services/resultsVnext/kpi/kpiTypes.ts:21`,`:30` | draft·pending_approval·active·suspended·archived / draft·submitted·approved·rejected | komendy KPI | karta wyników | KPI |

Martwe: `multi_framework_initiatives.status` (DRAFT·PROPOSED·APPROVED·IN_ROADMAP·IN_PROGRESS·DONE·CANCELLED,
`server/migrations/20260719_baseline_gap.sql:27007`) — **zero** pisarzy w `src/`/`server/src/`, 0 wierszy w bazie.

---

## §2. Przejścia zastane

### 2.1 Słownik 1 (13 statusów, `initiatives.status`) — jedyny z prawdziwym automatem
Tabela przejść: `server/src/constants/initiativeStatuses.ts:312` (`VALID_TRANSITIONS`).
Bramki i role: `:117` (`GATE_PERMISSIONS`), `:146` (`GATE_TRANSITIONS`). Egzekucja: `initiativeTransitionService.ts:571-580`.

| z → na | bramka | kto zmienia (rola sprawdzana w kodzie) | gdzie widać | co blokuje |
|---|---|---|---|---|
| DRAFT → PENDING_REVIEW | SUBMIT_FOR_REVIEW | CONSULTANT, INITIATIVE_OWNER (`:119`) | Ocena/Narzędzia, lista szkiców | — |
| PENDING_REVIEW → REVIEW | APPROVE_TO_INITIATIVE | PROJECT_MANAGER, PROJECT_LEAD, PMO (`:121`) | Inicjatywy | — |
| PENDING_REVIEW → DRAFT | SEND_BACK | PM/LEAD/PMO (`:120`) | Inicjatywy | — |
| REVIEW → PROMOTED | ACCEPT | PROJECT_SPONSOR, STEERING_COMMITTEE (`:124`) | Inicjatywy | wymóg artefaktów (`:752-758`) |
| REVIEW → DRAFT | REJECT | SPONSOR, STEERING (`:125`) | Inicjatywy | — |
| PROMOTED → PLANNING | START_PLANNING | PMO (`:126`) | Inicjatywy | — |
| PLANNING → APPROVED | APPROVE | STEERING_COMMITTEE (`:127`) | Inicjatywy | — |
| APPROVED → SCHEDULED | SCHEDULE | PMO (`:128`) | Inicjatywy | — |
| SCHEDULED → EXECUTING | START | PMO (`:131`) + aktor systemowy cron (`initiativeAutoStartJob.ts:34`) | Realizacja | aktualność decyzji GO/NO-GO (`initiativeTransitionService.ts:119`) |
| EXECUTING → BLOCKED | BLOCK | INITIATIVE_OWNER, PMO (`:132`) | Realizacja | wymagany powód (`:735`) |
| BLOCKED → EXECUTING | UNBLOCK | SPONSOR, STEERING (`:133`) | Realizacja | — |
| EXECUTING → DONE | COMPLETE | INITIATIVE_OWNER, PMO (`:134`) | Realizacja | 0 otwartych zadań + brak blokujących decyzji (`:740-750`) |
| DONE → TRACKING | START_TRACKING | BUSINESS_OWNER (`:137`) | Wyniki | — |
| dowolny aktywny → CANCELLED | CANCEL | PMO, STEERING (`:140`) | wszędzie | — |
| **TRACKING → ARCHIVED** | **BRAK** | **każdy zalogowany** — `canExecuteGate` zwraca `true` dla przejścia bez bramki (`initiativeCapabilityMatrix.ts:267`) | Wyniki | nic |
| **CANCELLED → ARCHIVED** | **BRAK** | **każdy zalogowany** (jw.) | Inicjatywy | nic |

Ponadto: role `ADMIN`/`SUPERADMIN` omijają **każdą** bramkę bezwarunkowo (`initiativeCapabilityMatrix.ts:98`,`:266`).
Priorytet inicjatywy nie jest częścią automatu — ustawia go `createInitiative` z pola źródła
(`server/src/services/audits/proposalService.ts:491`) i późniejszy `quick-update` (`initiatives.routes.ts:3129`), bez roli.

### 2.2 Słownik 5 (runtime-v1 `lifecycleState`) — drugi automat, osobny magazyn
Tabela przejść: `src/contracts/initiatives-execution/foundation.ts:19` (liniowa, po jednym następniku).
Egzekucja po stronie serwera przez twarde `if` w komendach domeny: `definitionDecision.ts:136`, `scheduleDecision.ts:207`,
`planScenario.ts:167`, `deliveryAcceptance.ts:109`, `executionBvpService.ts:99`. Magazyn: `ie_aggregate_state` (0 wierszy lokalnie).
Handoff do Realizacji: `handoffAcceptance.ts:126` ustawia `status:'PENDING'` i `executionState:'HANDOFF_PENDING'`,
`:285` na `ACTIVE` po akcepcie. **`initiatives.status` nie jest przy tym dotykany** (§3.5).

### 2.3 Słowniki 13/14/15 (kandydaci i propozycje) — bez ról bramkowych
`pending → accepted|dismissed` (`initiativeCandidates.routes.ts:153`,`:197`) — sprawdzana jest tylko org i istnienie rekordu;
brak roli. `draft → registered|deferred|dismissed` w Audytach ma uprawnienie `proposal.register`
(`proposalService.ts:474`), reszta przejść — `proposal.update`. Statusy 15 (Teresa) zmienia `POST /ai/proposals/:id/decide`.

---

## §3. Dziury i sprzeczności (każda z dowodem)

**3.1 Dwa żywe rejestry, dwa słowniki, dwa magazyny.** Klasyczny (`initiatives.status`, 78 wierszy lokalnie) i zdarzeniowy
(`ie_aggregate_state.payload_json.lifecycleState`, 0 wierszy lokalnie). Front musi je zszywać na kliencie
(`initiativeRegisterProjection.ts:253` i `initiativeRegisterColumns.shared.ts:59`).

**3.2 Mapowanie 13↔12 nie jest odwracalne — statusy giną.** Wprzód `initiativeRegisterColumns.shared.ts:59-72`,
wstecz `initiativeRegisterProjection.ts:253-264`. Złożenie:
`PLANNING → DEFINING → (brak gałęzi) → DRAFT`, `PENDING_REVIEW → DEFINED → REVIEW`, `PROMOTED → READY_FOR_DECISION → REVIEW`,
`BLOCKED → IN_EXECUTION → EXECUTING`. Cztery z trzynastu statusów nie wracają do siebie.
Dodatkowo `DEFINING` (`shared.ts:61`) w ogóle nie istnieje w `INITIATIVE_LIFECYCLE` (`foundation.ts:1-13`).

**3.3 `POST /api/initiatives/:id/submit-review` jest trwale zepsuty.** Strażnik porównuje z małą literą
`initiative.status !== 'planning'` (`InitiativeController.ts:2123`), a w bazie stoi `PLANNING` (CHECK wymusza wielkie litery —
`initiatives_status_check`, zweryfikowane na żywej bazie). Każde wywołanie kończy się 400. Gdyby przeszło — zapisałby
`status='review'` surowym UPDATE (`:2133`), z pominięciem silnika i bramki.

**3.4 `POST /api/initiatives/:id/block` pisze wartość zabronioną przez bazę.** `UPDATE initiatives SET status='blocked'`
(`InitiativeController.ts:2386`) — mała litera łamie `initiatives_status_check`; poza tym omija wymóg powodu z bramki BLOCK
(`initiativeStatuses.ts:735`). Analogicznie `archiveInitiative` (`:2799`) pisze `ARCHIVED` surowo, bez bramki.
Trasy: `initiatives.routes.ts:3243` i `:3297`.

**3.5 Wartość spoza jakiegokolwiek słownika.** `managerActionExecutionService.ts:316` i `:354` piszą
`status = 'IN_PROGRESS'` — nie ma jej ani w 13 statusach, ani w CHECK bazy. Każda akcja „unblock"/„scope_reduction"
menedżera kończy się naruszeniem ograniczenia.

**3.6 Kanoniczny walidator przejść jest martwy.** `validateInitiativeStatus` (`server/src/middleware/pmoValidation.middleware.ts:231`)
nie jest zamontowany na żadnej trasie — jedyne wystąpienie poza plikiem to shim w `server/src/_backup/`.
Cała walidacja opiera się na `executeInitiativeTransition`, którego trzy trasy wyżej omijają.

**3.7 Masowe „prześlij do przeglądu" z Oceny omija silnik.** `bulkSubmitRunDrafts`
(`assessmentInitiativeGenerationRunService.ts:429-453`) robi `UPDATE initiatives SET status='PENDING_REVIEW'` wprost.
Rola sprawdzana doraźnie: CONSULTANT tylko własne, **każda inna rola — wszystkie szkice biegu**. Brak wpisu audytowego bramki.

**3.8 R3 potwierdzone: maker-checker KPI omijany.** `addScorecardItem`
(`server/src/services/resultsVnext/kpi/kpiScorecardCommands.ts:397-407`) sprawdza wyłącznie istnienie KPI
(`SELECT 1 FROM rvn_kpi_definitions WHERE kpi_id=$1 AND organization_id=$2`). Brak warunku na `status`,
choć słownik ma `draft`/`pending_approval` (`kpiTypes.ts:21`). Szkic definicji trafia na kartę wyników bez zatwierdzenia.

**3.9 Trzy niezależne źródła etykiet polskich, już rozjechane.** Serwer `STATUS_METADATA.labelPL` mówi o REVIEW
„W przeglądzie biznesowym" (`initiativeStatuses.ts:396`), i18n mówi „W przeglądzie"
(`public/locales/pl/translation.json:630`), a drugi blok i18n (`:7755`) zna tylko 6 z 13 statusów.

**3.10 Cztery kopie tej samej listy 13 wartości** (§1 poz. 1-4) + dwie kopie tabeli bramek (poz. 7-8).
Żadna nie jest generowana z pozostałych — rozjazd jest kwestią czasu, nie ryzyka.

**3.11 Obalone.** Propozycje z Audytów MAJĄ drogę do inicjatywy: `POST /audits/proposals/:id/register`
(`server/src/routes/audits/proposals.routes.ts:109`) → `registerAsInitiative` (`proposalService.ts:467`) → kanoniczny
`createInitiative`, status startowy `DRAFT` (`createInitiativeService.ts:260`). Zapis do wiersza propozycji: `registered`.

---

## §4. Propozycja JEDNEJ tablicy docelowej (do akceptu właściciela)

**Rekomendacja CTO: Tak.** Jeden słownik 7 statusów dla wszystkich źródeł; wszystko poniżej „Propozycji" (kandydaci,
propozycje audytu, propozycje Teresy) zostaje przy własnych, wąskich słownikach — to skrzynki wejściowe, nie inicjatywy.

| Status | z → na | kto zmienia (rola) | gdzie widać | co blokuje | priorytet nadaje |
|---|---|---|---|---|---|
| **Propozycja** | Propozycja → Szkic | Konsultant (autor) | Skrzynka kandydatów | wymagany tytuł + uzasadnienie | — |
| | Propozycja → Odrzucona | Kierownik projektu | Skrzynka | wymagany powód | — |
| **Szkic** | Szkic → Do zatwierdzenia | Konsultant (autor) | Inicjatywy | komplet karty (opis, właściciel, zakres) | Kierownik projektu |
| **Do zatwierdzenia** | → Zatwierdzona | Sponsor / Komitet | Inicjatywy | aktualna decyzja GO | Sponsor |
| | → Szkic (zwrot) | Sponsor / Komitet | Inicjatywy | wymagany powód | — |
| | → Odrzucona | Sponsor / Komitet | Inicjatywy | wymagany powód | — |
| **Zatwierdzona** | → W realizacji | PMO | Realizacja | przyjęty handoff + termin startu | PMO |
| | → Odrzucona | PMO / Komitet | Inicjatywy | wymagany powód | — |
| **W realizacji** | → Zamknięta | Właściciel inicjatywy / PMO | Realizacja | 0 otwartych zadań, 0 blokujących decyzji | — |
| | → Odrzucona (wstrzymana) | PMO / Komitet | Realizacja | wymagany powód | — |
| **Zamknięta** | terminalny (archiwizacja to atrybut, nie status) | — | Wyniki | — | — |
| **Odrzucona** | terminalny | — | Inicjatywy (filtr) | — | — |

Zablokowanie przestaje być statusem — staje się flagą `wstrzymana` na statusie „W realizacji" (dziś BLOCKED jest osobnym
statusem i gubi się w mapowaniu, §3.2).

### Mapowanie zastane → docelowe

| Docelowy | Ze słownika 1 (13) | Ze słownika 5 (runtime-v1) | Z pozostałych |
|---|---|---|---|
| Propozycja | — | — | `initiative_candidates.pending`; `audit_initiative_proposals.draft`/`sent_to_candidates` |
| Szkic | DRAFT | REGISTERED_DRAFT, DEFINED | `reportInitiativeService` `draft`/`proposed` |
| Do zatwierdzenia | PENDING_REVIEW, REVIEW, PROMOTED, PLANNING | ANALYZING, READY_FOR_DECISION | — |
| Zatwierdzona | APPROVED, SCHEDULED | APPROVED_BACKLOG, SCHEDULED | `audit_…proposals.registered` |
| W realizacji | EXECUTING, BLOCKED (BLOCKED → flaga) | IN_EXECUTION | `IN_PROGRESS` (§3.5) |
| Zamknięta | DONE, TRACKING, ARCHIVED (→ flaga archiwum) | DELIVERED, BENEFITS_TRACKING, EFFECTIVENESS_REVIEWED, CLOSED, ARCHIVED | — |
| Odrzucona | CANCELLED | CANCELLED (etykieta bez wartości w kontrakcie) | `dismissed`, `deferred` |

### Koszt migracji danych — policzone na `consultify_noc` 2026-09-06

`initiatives` = **78 wierszy**, 0 z małą literą. Rozkład: EXECUTING 17 · DRAFT 15 · SCHEDULED 7 · BLOCKED 6 ·
PROMOTED 5 · DONE 5 · APPROVED 5 · REVIEW 5 · PLANNING 5 · TRACKING 3 · CANCELLED 3 · PENDING_REVIEW 1 · ARCHIVED 1.
Do przemapowania: **78/78** (każdy wiersz zmienia nazwę statusu), z czego 6 (BLOCKED) wymaga dodatkowo nowej flagi
`wstrzymana`, a 4 (ARCHIVED + część TRACKING) — flagi archiwum.
`initiative_candidates` = 0 · `audit_initiative_proposals` = 0 · `multi_framework_initiatives` = 0 (martwa) —
migracja tych trzech to sam DDL. `ie_aggregate_state` = 0 wierszy (runtime-v1 pusty lokalnie — na demo POLICZYĆ OSOBNO
przed migracją; to jedyna niewiadoma tego rachunku). `rvn_kpi_definitions` = 138, wszystkie `active` — R3 nie wymaga
migracji danych, tylko dołożenia warunku.

---

## §5. Zakres pracy dla Codexa (pliki/trasy do zmiany — bez pisania kodu)

1. **Jeden słownik.** Nowy moduł `shared/` (albo `server/src/constants/initiativeStatuses.ts` jako jedyne źródło + generowany
   plik dla frontu). Usunąć kopie: `src/types/core.ts:732`, `src/components/shared/ModuleHub/StatusDropdown.tsx:23`,
   `src/contracts/initiatives-execution/legacyCompatibility.ts:9`, `server/src/types/index.ts:164`,
   `packages/shared/src/types/domain/project.ts:217`, `server/src/services/reportInitiativeService.ts:21`, `src/types/core.ts:3275`.
2. **Jedna tabela bramek.** Zlikwidować lustro `src/services/initiativeLifecycle.ts:634-700` — front pobiera profil
   zatwierdzania z serwera (`computeApprovalProfile`, `initiativeCapabilityMatrix.ts:291`).
3. **Zamknąć trzy obejścia silnika** na `executeInitiativeTransition`:
   `InitiativeController.ts:2085` (submit-review), `:2372` (block), `:2763` (archive) — trasy
   `server/src/routes/pmo/initiatives.routes.ts:3192`, `:3243`, `:3297`.
4. **Czwarte obejście:** `server/src/services/assessmentInitiativeGenerationRunService.ts:404-464` (bulkSubmitRunDrafts)
   ma iterować po inicjatywach przez silnik, nie robić masowego UPDATE.
5. **Wartość spoza słownika:** `server/src/services/v8/managerActionExecutionService.ts:316`, `:354` (`IN_PROGRESS`).
6. **Bramki brakujące:** dodać bramkę dla TRACKING→ARCHIVED i CANCELLED→ARCHIVED w
   `server/src/constants/initiativeStatuses.ts:146` (dziś przejścia bez roli).
7. **R3 (maker-checker KPI):** `server/src/services/resultsVnext/kpi/kpiScorecardCommands.ts:397` — warunek
   `status IN ('active')` (lub `active`+`suspended`) przy dodaniu KPI do karty, z nowym kodem błędu.
8. **Mapowanie 13↔12:** `src/components/Initiatives/initiativeRegisterColumns.shared.ts:59` i
   `src/components/Initiatives/initiativeRegisterProjection.ts:253` — jedna tabela, dwukierunkowa, z testem odwracalności.
9. **Etykiety:** jedno źródło PL — `public/locales/pl/translation.json:627`; usunąć `labelPL` z
   `server/src/constants/initiativeStatuses.ts:368-520` i skrócony blok `translation.json:7755`.
10. **Baza:** migracja addytywna — kolumna `status` na nowy słownik + flagi `wstrzymana`/`zarchiwizowana`,
    nowy `initiatives_status_check` (uwaga: `server/migrations/20260624_initiative_status_normalize.sql:91` używa
    `UPPER(status) IN (…)`, a `20260802_mvp_core_schema_parity.sql:36` `status IN (…)` — dwa różne warunki pod tą samą nazwą).
11. **Martwe do usunięcia:** `server/src/middleware/pmoValidation.middleware.ts` (0 konsumentów),
    tabela `multi_framework_initiatives` (0 pisarzy, 0 wierszy).
