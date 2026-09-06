# P12 — Jeden słownik statusów inicjatyw (7 statusów + 2 flagi)

> Paczka programu naprawczego 2026-09-05 · **DEC-424** · autor: Opus (nadzorca: Fable) · dla Codexa.
> Wejście pomiarowe (czytaj razem z tą paczką): `docs/program/PROGRAM_NAPRAWCZY_20260905/1_11_STATUSY_INICJATYW_POMIAR.md`.
> Wzór formatu: `P11_PLAN_I_OBCIAZENIE.md`. Szablon: `00_SZABLON_PACZKI.md`.
> Każde `plik:linia` w tej paczce zostało **sprawdzone ponownie** na gałęzi bazowej `codex/m03-admin-20260824`
> (HEAD `8d1600d530`) 2026-09-06. Osiem miejsc, w których pomiar 1.11 się myli albo mówi za mało, jest
> zebranych w **§3.12 — poprawki do pomiaru**; tam obowiązuje ta paczka, nie pomiar.
> Moduły zamrożone dotknięte: `05_INITIATIVES`, `06_EXECUTION` (+ te, które wypisze hook) —
> marker `[ODMROZENIE <MODUL> DEC-424]` w KAŻDYM commicie.

---

## §0. Bezpieczniki i zakazy

**Katalog roboczy.** Własne worktree `/private/tmp/codex-p12-statusy`, gałąź `codex/p12-statusy`
od `codex/m03-admin-20260824`. Nie twórz katalogu ręcznie z góry — §0.1 procedury robi worktree sam.
`node_modules` = symlink, niczego nie instaluj.

**Zakazy (bez wyjątków):** sparse-checkout · `git stash` (zamiast tego `git show codex/m03-admin-20260824:<plik>`) ·
`git worktree remove/prune` · `--no-verify` · `pkill` · `git push` · dodawanie lub zmiana flag env
(zmiana wchodzi jawnie albo nie wchodzi) · `rm -rf` poza własnym worktree · dotykanie `/private/tmp/m03`
i `/private/tmp/stanowisko-noc` (wolno TYLKO czytać `auth.json` i `server.env`) · pełne `tsc` i pełny `vitest`
(wyłącznie per plik) · staging, demo, produkcja (żadnego połączenia, żadnej migracji, żadnego deployu) ·
sub-agenci · pytania do właściciela (niejasność → wiersz w `P12/99_DECYZJE_WLASCICIELA.md`).

**Stanowisko lokalne:** API `127.0.0.1:4100`, PostgreSQL `127.0.0.1:54400`, vite podglądowy `3090`
(`scripts/dev/stanowisko-lokalne/README.md`). Do pomiaru **stawiasz własne procesy**: serwer na wolnym
porcie `41xx` i vite `31xx` (`lsof -nP -iTCP:<port> -sTCP:LISTEN`); zabijasz na koniec tylko swoje
(`kill $(cat /tmp/<twoj>.pid)`, nigdy `pkill`).

**Commity:** commit-per-krok, wiadomość po polsku, marker `[ODMROZENIE <MODUL> DEC-424]` dla każdego
zamrożonego modułu, którego pliki ruszasz; nazwy modułów wyłącznie z `docs/program/MVP_FINAL_ZAMROZONE.json`.
Bramka siedzi w `.husky/commit-msg` → `scripts/mvp-final/check-freeze.sh` i **sama wypisze brakujące
moduły** — dopisz i commituj ponownie. Zmierzone: z plików tej paczki na liście zamrożeń jest tylko front
(`05_INITIATIVES`: `InitiativesHub.tsx`, `initiativeRegisterProjection.ts`, `initiativeRegisterColumns.shared.ts`;
`06_EXECUTION`: `ExecutionHub.tsx`, `ExecutionInitiativeStatusControl.tsx`; `04_ASSESSMENT`:
`InitiativesManagementPanel.tsx`; `12_AUDITS`: `AuditInitiativesTab.tsx`; `02_INTERVIEW`:
`InterviewInitiativePreview.tsx`). Pliki serwera nie są w spisie — **wierz hookowi, nie tej tabeli**.

**Migracje:** TYLKO addytywne i idempotentne (`IF NOT EXISTS`, `DO $$ … END $$` ze sprawdzeniem),
nowy plik w `server/migrations/`, **zero modyfikacji istniejących plików migracji**.
Nazwa: kolejność wykonania to nie kolejność alfabetyczna — `server/scripts/migrationOrdering.ts:330-357`
sortuje najpierw pliki numerowane (faza 0), potem datowane (faza 1) po `YYYYMMDD`. Najwyższa istniejąca
data to `20262102_okr_p7k_report_fields.sql`, więc plik nazwany `202609xx` wykona się **przed** ~200
późniejszymi migracjami. Użyj `20262103_p12_initiative_status_slownik.sql` i **udowodnij** pozycję:
wypisz posortowaną listę z `sortMigrationsDeterministically` i pokaż, że Twój plik jest ostatni.

**STOP zamiast zgadywania.** Pozycja wymagająca decyzji produktowej albo dotykająca pliku innego
robotnika → nie rób, wpisz do raportu jako STOP z powodem i propozycją.

---

## §1. Cel dla użytkownika

Konsultant widzi w każdym module ten sam, siedmiostopniowy status inicjatywy po polsku — od „Propozycji"
do „Zamkniętej" albo „Odrzuconej" — i ten sam status znaczy wszędzie to samo. Wstrzymanie i archiwum
przestają być statusami: to znaczniki obok statusu, więc inicjatywa wstrzymana nadal jest „W realizacji"
i nie znika z listy. Żadna droga w systemie nie potrafi już zapisać statusu z pominięciem reguł przejść,
więc to, co widać na liście, jest tym, co naprawdę zaszło.

---

## §2. Zakres i poza zakresem

### W zakresie

Słownik serwera (`initiativeStatuses.ts:35` + `labelPL` `:372+`) i cztery jego kopie (§3.10) · kontrakt
runtime-v1 (`foundation.ts:1`) i mapowanie w obie strony (`initiativeRegisterColumns.shared.ts:59`,
`initiativeRegisterProjection.ts:253`) · lustro bramek na froncie (`initiativeLifecycle.ts:634`,`:673`)
· pięć tras piszących status poza silnikiem (§3.3–3.7) · martwy walidator (`pmoValidation.middleware.ts:231`)
· R3 maker-checker KPI (`kpiScorecardCommands.ts:397-407`) · 9 bloków etykiet w `pl/translation.json` (§3.9)
· baza: `initiatives.status` (78 wierszy lokalnie) i dwa różne CHECK-i pod jedną nazwą (§3.12 poz. 1).
Moduły zamrożone dotknięte: `05_INITIATIVES`, `06_EXECUTION`, `04_ASSESSMENT`, `12_AUDITS`, `02_INTERVIEW`.

### Poza zakresem (jawnie — nie rób tego w tej paczce)

1. **Pełny model ~12 statusów = Fala 2.** Właściciel rozstrzygnął 06.09 (DEC-424): teraz JEDEN słownik
   7 statusów z §4 pomiaru. Rozbudowa do pełnego cyklu (m.in. rozdzielenie „Do zatwierdzenia" na przegląd
   merytoryczny i decyzję komitetu, osobny „Pomiar korzyści") to osobna paczka po MVP. Jeśli w trakcie
   pracy wyjdzie, że czegoś brakuje — **wiersz w `99_DECYZJE`, nie własny status**.
2. **Skrzynki wejściowe zostają przy swoich wąskich słownikach** — `initiative_candidates.status`
   (`initiativeCandidateService.ts:55`), `PROPOSAL_STATUSES` (`server/src/services/audits/types.ts:740`)
   i `AI_PROPOSAL_STATUSES` (`types.ts:790`) to poczekalnie, nie inicjatywy. Bez zmian; zmienia się tylko
   to, że po zarejestrowaniu inicjatywa dostaje status z jednego słownika.
3. **Nie ruszamy słownika KPI** (`KPI_STATUSES`, `kpiTypes.ts:22`) poza dołożeniem warunku z §4(e).
4. **Nie przepisujemy domeny zdarzeniowej runtime-v1** — `lifecycleState` zostaje jak jest, dochodzi
   JEDNA funkcja mapująca (§4c).
5. **Zero zmian kanonu wizualnego** — bez nowych komponentów list, bez nowych kolorów poza §4(g).

---

## §3. Przyczyna źródłowa (zweryfikowane ponownie, plik:linia)

**3.1 Dwa automaty, dwa magazyny.** Klasyczny: `initiatives.status`, przejścia
`server/src/constants/initiativeStatuses.ts:312`, bramki `:117` i `:146`, egzekucja
`initiativeTransitionService.ts:387`. Zdarzeniowy: `INITIATIVE_LIFECYCLE`
(`src/contracts/initiatives-execution/foundation.ts:1`, 12 wartości, przejścia `:18`)
w `ie_aggregate_state.payload_json`. Front zszywa oba na kliencie.

**3.2 Mapowanie 13↔12 nie jest odwracalne.** Wprzód `initiativeRegisterColumns.shared.ts:59`, wstecz
`initiativeRegisterProjection.ts:253`. `PLANNING → DEFINING → (brak gałęzi) → DRAFT`;
`PENDING_REVIEW → DEFINED → REVIEW`; `PROMOTED → READY_FOR_DECISION → REVIEW`;
`BLOCKED → IN_EXECUTION → EXECUTING`. `DEFINING` nie istnieje w `INITIATIVE_LIFECYCLE`, a
`INITIATIVE_LIFECYCLE_LABELS` (`initiativeRegisterProjection.ts:38`) zna 14 kluczy — dwa spoza kontraktu.

**3.3 `submit-review` jest trwale zepsuty.** `InitiativeController.ts:2123` porównuje
`initiative.status !== 'planning'` małą literą, a w bazie stoi `PLANNING` → każde wywołanie kończy się 400.
Gdyby przeszło, `:2133` zapisałby `status = 'review'` surowym `UPDATE`, poza silnikiem.
Trasa: `server/src/routes/pmo/initiatives.routes.ts:3192`.

**3.4 `block` pisze małą literą i omija wymóg powodu.** `InitiativeController.ts:2386`:
`UPDATE initiatives SET status = 'blocked'`, bez transakcji, bez blokady wiersza, bez bramki BLOCK
(wymaga powodu — `initiativeStatuses.ts:735`). Trasa `initiatives.routes.ts:3243`. Komentarz w kodzie
(`:2340-2367`) sam nazywa to długiem: `unblockInitiative` jest już nakładką na silnik (`:2461`),
`completeInitiative` zamknięto przez 410, `blockInitiative` został.

**3.5 `archive` pisze surowo.** `InitiativeController.ts:2799` — `UPDATE … SET status = 'ARCHIVED'`
poza silnikiem. Stan sprawdzony (`:2789`, DONE/CANCELLED), roli brak, a `UPDATE` ma `WHERE id = ?`
**bez `organization_id`** (§3.12 poz. 5). Trasa `initiatives.routes.ts:3297`.

**3.6 Czwarte obejście — masowe „prześlij do przeglądu" z Oceny.**
`server/src/services/assessmentInitiativeGenerationRunService.ts:431` i `:444`:
`UPDATE initiatives SET status = 'PENDING_REVIEW'` wprost, bez bramki i bez wpisu audytowego.

**3.7 Wartość spoza jakiegokolwiek słownika.** `server/src/services/v8/managerActionExecutionService.ts:316`
i `:354` piszą `status = 'IN_PROGRESS'` — nie ma jej w 13 statusach ani w CHECK bazy.

**3.8 Kanoniczny walidator jest martwy.** `validateInitiativeStatus`
(`server/src/middleware/pmoValidation.middleware.ts:231`) — `grep` po `src` i `server/src` (bez `--include`)
daje **jedno** trafienie: samą definicję. Zero konsumentów.

**3.9 Etykiety PL rozjechane w dziewięciu miejscach.** W `public/locales/pl/translation.json` jest
**9 bloków** ze statusami inicjatywy: `common.initiativeStatus` (13 kluczy),
`assessment.hub.table.initiativeStatus` (6), `assessment.initiativesPanel.status` (13),
`initiatives.status` (14), `initiatives.statusDescription` (14), `status` (8), `statusChip` (79),
`initiativeStatus` (13), `initiativeStatusDescription` (13). Rozjazd jest faktem: PROMOTED =
„Promowana" vs „Zatwierdzona", APPROVED = „Zatwierdzona" vs „Zaakceptowana", TRACKING = „Śledzenie"
vs „Monitorowanie". Szósty zestaw to `labelPL` serwera (`initiativeStatuses.ts:358` typ, `:372+` wartości).

**3.10 Cztery kopie listy 13 wartości** (`initiativeStatuses.ts:35`, `core.ts:732`, `StatusDropdown.tsx:23`,
`legacyCompatibility.ts:9`), dwie kopie tabeli bramek (`initiativeStatuses.ts:117`,
`src/services/initiativeLifecycle.ts:673`) i piąta kopia metadanych statusu (`initiativeLifecycle.ts:155`).
Żadna nie jest generowana z pozostałych.

**3.11 R3 — maker-checker KPI omijany.** `kpiScorecardCommands.ts:397-407` sprawdza wyłącznie istnienie
KPI (`SELECT 1 FROM rvn_kpi_definitions WHERE kpi_id = $1 AND organization_id = $2`), bez warunku na
`status`, choć słownik zna `draft` i `pending_approval` (`kpiTypes.ts:22`) — szkic definicji trafia
na kartę wyników bez zatwierdzenia.

### 3.12 Poprawki do pomiaru 1.11 (tu obowiązuje paczka, nie pomiar)

| # | Pomiar mówi | Zmierzone naprawdę | Skutek dla pracy |
|---|---|---|---|
| 1 | §3.4: mała litera `'blocked'` łamie `initiatives_status_check` | **Zależy od tego, który CHECK powstał.** `server/migrations/20260624_initiative_status_normalize.sql:91` zakłada `CHECK (UPPER(status) IN (…))` — pod nim `'blocked'` **przechodzi**. `20260802_mvp_core_schema_parity.sql:36` zakłada `CHECK (status IN (…))` — pod nim wywala. Oba pod tą samą nazwą, oba z `IF NOT EXISTS`, kolejność datowana stawia 20260624 pierwszy | **Krok 0:** zmierz `pg_get_constraintdef` dla `initiatives_status_check` na 54400 i wpisz wynik do raportu. Jeśli obowiązuje wariant `UPPER`, w tabeli mogą LEŻEĆ wartości małą literą — policz je przed migracją |
| 2 | §3.9: trzy źródła etykiet PL | **9 bloków** w `pl/translation.json` + `labelPL` na serwerze (§3.9) | próg §7 liczony na 9, nie na 3 |
| 3 | §1 poz. 2: `initiativesDemoData.ts:999` zapisuje status inicjatywy | To status **DECYZJI** (`'PENDING'`/`'APPROVED'` dla obiektu decyzji, `:999`, `:1017`, `:1197`), nie inicjatywy. Plik ma **4 żywych importerów** (`InitiativesHub.tsx:139`, `InitiativeDocumentView.tsx:201`, `ExecutionHub.tsx:130`, test `initiativeKartaRealnyRekord.test.ts:24`) | **NIE usuwaj** tego pliku ani tych mapowań. Zdanie z §5.1 pomiaru o „martwym mapowaniu" jest błędne |
| 4 | §3.2: cztery statusy nie wracają do siebie | Gorzej: `lifecycleToInitiativeStatus` (`initiativeRegisterProjection.ts:253-264`) nie zna `EFFECTIVENESS_REVIEWED` ani `CANCELLED` — oba wpadają w `return InitiativeStatus.DRAFT` (`:264`). Anulowana inicjatywa pokazuje się jako **Szkic** | test odwracalności musi objąć wszystkie 12 wartości `INITIATIVE_LIFECYCLE`, nie próbkę |
| 5 | — (pomiar milczy) | `InitiativeController.ts:2797-2801` — `UPDATE initiatives … WHERE id = ?` bez `organization_id`. `SELECT` wyżej (`:2773`) jest org-owy, więc to okno czasowe, nie dziura otwarta, ale przy przepisaniu na silnik znika | napraw przy okazji kroku 4; wpisz do raportu jako znalezisko |
| 6 | §1 poz. 8: front ma lustro bramek | Ma **także** piątą kopię metadanych statusu: `src/services/initiativeLifecycle.ts:155` (`STATUS_METADATA`, własne klucze `initiatives.status.*` i `initiatives.statusDescription.*`), używaną m.in. przez `ExecutionInitiativeStatusControl.tsx:29` | §4(f) obejmuje ten plik |
| 7 | §1 poz. 19: `KPI_STATUSES` `kpiTypes.ts:21`, `KPI_APPROVAL_STATUSES` `:30` | naprawdę `:22` i `:31` | drobiazg, ale cytuj poprawnie |
| 8 | §5.10: migracja addytywna | dodatkowo: kolumny `blocked_at`, `blocked_reason`, `archived_at` **już istnieją** (`server/migrations/247_initiative_enhancements.sql:17-19`, `20260719_baseline_gap.sql:12750`) | flagi backfilluj z nich i ze statusu; nie dubluj kolumn dat |

---

## §4. Projekt rozwiązania

### (a) JEDEN słownik — `server/src/constants/initiativeStatuses.ts`

Ten plik zostaje jedynym źródłem. Nowy słownik docelowy — **7 wartości**, kody techniczne po angielsku
wielkimi literami, etykiety WYŁĄCZNIE przez i18n:

| Kod | Etykieta PL | Etykieta EN |
|---|---|---|
| `PROPOSED` | Propozycja | Proposal |
| `DRAFT` | Szkic | Draft |
| `PENDING_APPROVAL` | Do zatwierdzenia | Pending approval |
| `APPROVED` | Zatwierdzona | Approved |
| `IN_EXECUTION` | W realizacji | In execution |
| `CLOSED` | Zamknięta | Closed |
| `REJECTED` | Odrzucona | Rejected |

Do tego **dwie flagi**, nie statusy: `on_hold` (wstrzymana) i `archived` (zarchiwizowana). Flaga nigdy
nie zastępuje statusu — inicjatywa wstrzymana ma status `IN_EXECUTION` i flagę `on_hold=true`.

Kopie do usunięcia (importy na SSOT): `src/types/core.ts:732` i `:3275`, `StatusDropdown.tsx:23`,
`legacyCompatibility.ts:9`, `server/src/types/index.ts:164`, `packages/shared/src/types/domain/project.ts:217`,
`server/src/services/reportInitiativeService.ts:21`. Front nie importuje z `server/src` — SSOT ląduje
w `packages/shared` albo w pliku generowanym (nagłówek „NIE EDYTUJ RĘCZNIE" + skrypt), a
`initiativeStatuses.ts` go reeksportuje. **Wybraną drogę opisz w raporcie, nie zgaduj w ciszy.**

### (b) Tabela przejść jako DANE, jeden egzekutor

Jedna macierz w kodzie (wprost z §4 pomiaru), każdy wiersz z rolą i warunkiem:

| z → na | rola | warunek merytoryczny |
|---|---|---|
| `PROPOSED → DRAFT` | Konsultant (autor) | tytuł + uzasadnienie niepuste |
| `PROPOSED → REJECTED` | Kierownik projektu | wymagany powód |
| `DRAFT → PENDING_APPROVAL` | Konsultant (autor) | komplet karty: opis, właściciel, zakres |
| `PENDING_APPROVAL → APPROVED` | Sponsor / Komitet | aktualna decyzja GO |
| `PENDING_APPROVAL → DRAFT` | Sponsor / Komitet | wymagany powód (zwrot) |
| `PENDING_APPROVAL → REJECTED` | Sponsor / Komitet | wymagany powód |
| `APPROVED → IN_EXECUTION` | PMO | przyjęty handoff + termin startu |
| `APPROVED → REJECTED` | PMO / Komitet | wymagany powód |
| `IN_EXECUTION → CLOSED` | Właściciel inicjatywy / PMO | 0 otwartych zadań, 0 blokujących decyzji |
| `IN_EXECUTION → REJECTED` | PMO / Komitet | wymagany powód |
| `CLOSED` | — | terminalny |
| `REJECTED` | — | terminalny |

Flagi: `on_hold` ustawia i zdejmuje ta sama ścieżka co dziś BLOCK/UNBLOCK (`INITIATIVE_OWNER`/`PMO`
zakłada, `PROJECT_SPONSOR`/`STEERING_COMMITTEE` zdejmuje, powód wymagany); `archived` ustawia się
wyłącznie na statusie `CLOSED` lub `REJECTED`.

**Egzekutorem jest tylko `executeInitiativeTransition`** (`initiativeTransitionService.ts:387`).
Każda trasa, która dziś pisze status, przechodzi przez niego: `submit-review`
(`InitiativeController.ts:2085`), `block` (`:2372`), `archive` (`:2763`), `bulkSubmitRunDrafts`
(`assessmentInitiativeGenerationRunService.ts:404`), akcje menedżera
(`managerActionExecutionService.ts:316`, `:354`). Po tej paczce zapytanie
„które miejsca w `server/src` piszą `initiatives … SET status`" ma wskazywać **wyłącznie silnik**
(migracja jest w `server/migrations/`, poza tym zbiorem).

**ADMIN/SUPERADMIN omija wyłącznie sprawdzenie ROLI.** Dziś `canExecuteGate`
(`initiativeCapabilityMatrix.ts:264-268`) zwraca `true` dla ról administracyjnych (`:266`) **i** dla
przejścia bez bramki (`:267`) — to drugie znaczy, że TRACKING→ARCHIVED i CANCELLED→ARCHIVED może dziś
zrobić każdy zalogowany. Po zmianie warunki (powód, komplet karty, 0 otwartych zadań, aktualna decyzja GO)
obowiązują administratora tak samo, a brak bramki dla przejścia = przejście **niedozwolone**.

### (c) runtime-v1 — jedna funkcja mapująca, w jednym miejscu

`lifecycleState` (`foundation.ts:1`) zostaje w domenie zdarzeniowej. Powstaje **jedna** funkcja
dwukierunkowa (nowy plik, np. `src/contracts/initiatives-execution/statusMapping.ts`) obsługująca wszystkie
12 wartości i 7 docelowych — bez `default → DRAFT`. Zastępuje `INITIATIVE_REGISTER_LEGACY_LIFECYCLE_ALIASES`
(`initiativeRegisterColumns.shared.ts:59`) i `lifecycleToInitiativeStatus` (`initiativeRegisterProjection.ts:253`).
Projekcja rejestru czyta wyłącznie SSOT; `INITIATIVE_LIFECYCLE_LABELS` (`:38`) traci klucze `DEFINING`
i `CANCELLED` albo dostaje komentarz, dlaczego zostają.

Mapowanie runtime-v1 → docelowe: `REGISTERED_DRAFT`,`DEFINED` → `DRAFT`;
`ANALYZING`,`READY_FOR_DECISION` → `PENDING_APPROVAL`; `APPROVED_BACKLOG`,`SCHEDULED` → `APPROVED`;
`IN_EXECUTION` → `IN_EXECUTION`; `DELIVERED`,`BENEFITS_TRACKING`,`EFFECTIVENESS_REVIEWED`,`CLOSED` → `CLOSED`;
`ARCHIVED` → `CLOSED` + `archived=true`.

### (d) Migracja danych — addytywna i idempotentna

Nowy plik `server/migrations/20262103_p12_initiative_status_slownik.sql` (§0 — kolejność udowodnij):

1. `ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS on_hold BOOLEAN NOT NULL DEFAULT false;`
   i to samo dla `archived`.
2. Backfill statusów wg tabeli (78 wierszy lokalnie 2026-09-06, rozkład: EXECUTING 17 · DRAFT 15 ·
   SCHEDULED 7 · BLOCKED 6 · PROMOTED 5 · DONE 5 · APPROVED 5 · REVIEW 5 · PLANNING 5 · TRACKING 3 ·
   CANCELLED 3 · PENDING_REVIEW 1 · ARCHIVED 1 — **przelicz sam przed migracją**):

| Zastane | Docelowe | Flaga |
|---|---|---|
| `DRAFT` | `DRAFT` | — |
| `PENDING_REVIEW`, `REVIEW`, `PROMOTED`, `PLANNING` | `PENDING_APPROVAL` | — |
| `APPROVED`, `SCHEDULED` | `APPROVED` | — |
| `EXECUTING` | `IN_EXECUTION` | — |
| `BLOCKED` | `IN_EXECUTION` | `on_hold = true` |
| `DONE`, `TRACKING` | `CLOSED` | — |
| `ARCHIVED` | `CLOSED` | `archived = true` |
| `CANCELLED` | `REJECTED` | — |
| `IN_PROGRESS` (§3.7, spoza słownika) | `IN_EXECUTION` | — |
| cokolwiek małą literą (jeśli §3.12 poz. 1 pokaże takie wiersze) | jak wyżej po `UPPER()` | — |

3. Nowy CHECK **pod nową nazwą** (`initiatives_status_check_p12`), z `status IN (…)` na 7 wartościach;
   stary `initiatives_status_check` zdejmij dopiero po backfillu, w tej samej transakcji,
   `DROP CONSTRAINT IF EXISTS`. Idempotencja: powtórne uruchomienie migracji nie zmienia ani jednego wiersza.
4. `initiative_candidates` = 0 wierszy, `audit_initiative_proposals` = 0, `multi_framework_initiatives` = 0
   (martwa, 0 pisarzy) — te trzy bez zmian danych.
5. `ie_aggregate_state` = 0 wierszy lokalnie. **Policz go na stanowisku** (`SELECT
   payload_json->>'lifecycleState', count(*) FROM ie_aggregate_state WHERE aggregate_type='initiative'
   GROUP BY 1`) **i opisz procedurę dla stagingu w raporcie. Codex stagingu NIE dotyka** — to tekst
   w `98_RAPORT.md`, nie wykonanie.

### (e) R3 — maker-checker KPI

`kpiScorecardCommands.ts:397-407`: zapytanie sprawdzające dostaje warunek na status —
KPI w statusie innym niż zatwierdzony (`active`, ewentualnie `suspended` — rozstrzygnięcie w §8)
nie może trafić na kartę wyników. Nowy kod błędu (np. `KPI_NOT_APPROVED`) i komunikat po polsku.
`rvn_kpi_definitions` = 138 wierszy, wszystkie `active` → **zero migracji danych**, sam warunek.

### (f) Front — jedno źródło etykiet, zero literałów w komponentach

Jedna funkcja etykiet PL (i18n, klucz kanoniczny `initiatives.status.*`) i jedna funkcja koloru chipa.
Powierzchnie do przestawienia:

| Powierzchnia | Plik |
|---|---|
| Inicjatywy — kolumna Status, filtry Menu 2/3 | `src/components/Initiatives/InitiativesHub.tsx`, `initiativeRegisterProjection.ts`, `initiativeRegisterColumns.shared.ts` |
| Filtr wspólny modułów | `src/components/shared/ModuleHub/StatusDropdown.tsx` (13 konsumentów — `grep -rln StatusDropdown src`) |
| Wywiad → inicjatywy | `src/components/Interview/InterviewInitiativePreview.tsx:189` |
| Ocena → inicjatywy | `src/components/assessment/manage/InitiativesManagementPanel.tsx:120-200` (własna mapa etykiet z angielskimi `label`) |
| Audyty → propozycje | `src/components/Audit/method/tabs/AuditInitiativesTab.tsx` |
| Realizacja → handoff / kolumna Status | `src/components/Execution/ExecutionHub.tsx`, `src/components/Execution/ExecutionInitiativeStatusControl.tsx:29` |
| Piąta kopia metadanych | `src/services/initiativeLifecycle.ts:155` (`STATUS_METADATA`) — zostaje JEDNA, karmiona z SSOT |

`src/components/Initiatives/initiativesDemoData.ts` **zostaje** (§3.12 poz. 3) — jego `'PENDING'`/`'APPROVED'`
to statusy decyzji, nie inicjatyw.

i18n: kanonem jest jeden blok `initiatives.status` (pl + en); pozostałe 8 bloków z §3.9 znikają albo —
jeśli obsługują inny obiekt niż inicjatywa (`statusChip` ma 79 kluczy dla wielu typów) — zostają
świadomie, z powodem wpisanym do raportu. `labelPL` serwera znika: serwer oddaje kod, front tłumaczy.

### (g) Kanon UI — bez zmian

`StandardTable` / `StandardModuleBar` / `StandardPreview`, tokeny `c-*`, fokus `c-focus`, kebab pionowy.
Chipy statusów **neutralne**: **„Odrzucona" jest szara, NIE crimson** — czerwień to wyłącznie semantyka
krytyczna (`primary-*` każdy numer = crimson, `scripts/check-list-canon.sh` to blokuje).
Jedyny kolor niesie flaga `on_hold` = amber. `archived` = wyszarzenie wiersza, bez własnego chipa koloru.

---

## §5. Kroki wykonania (kolejność wymuszona)

| # | Krok | Pliki | Rozmiar | Ukończenie = |
|---|---|---|---|---|
| 0 | **Pomiar wstępny**: `pg_get_constraintdef('initiatives_status_check')` na 54400, rozkład `initiatives.status` (w tym małe litery), `ie_aggregate_state` po `lifecycleState`, testy zastane → `evidence/p12-statusy/testy-baza.txt` | — | S | liczby w `98_RAPORT.md`, zero zmian w kodzie |
| 1 | SSOT: 7 wartości + 2 flagi + macierz przejść jako dane + mapa na słownik zastany | `server/src/constants/initiativeStatuses.ts` | M | esbuild exit 0, nowy test macierzy zielony |
| 2 | Usunięcie 7 kopii słownika, importy na SSOT | `src/types/core.ts:732`,`:3275`, `StatusDropdown.tsx:23`, `legacyCompatibility.ts:9`, `server/src/types/index.ts:164`, `packages/shared/…/project.ts:217`, `reportInitiativeService.ts:21` | L | `grep` na literały statusów poza SSOT = 0 (§7) |
| 3 | Silnik: macierz + role + warunki; ADMIN omija tylko rolę; brak bramki = zakaz | `initiativeTransitionService.ts:387`, `initiativeCapabilityMatrix.ts:264-268`, `initiativeStatuses.ts:117`,`:146` | L | mutacje 1 i 2 z §6 dają RED |
| 4 | Trzy obejścia w kontrolerze na silnik (+ `organization_id` w `UPDATE` archiwum, §3.12 poz. 5) | `InitiativeController.ts:2085`,`:2372`,`:2763`; trasy `initiatives.routes.ts:3192`,`:3243`,`:3297` | L | mutacja 3 z §6 daje RED |
| 5 | Czwarte obejście: `bulkSubmitRunDrafts` iteruje przez silnik zamiast masowego `UPDATE` | `assessmentInitiativeGenerationRunService.ts:404-464` | M | rola inna niż autor nie przesyła cudzych szkiców (test) |
| 6 | `IN_PROGRESS` → `IN_EXECUTION` przez silnik | `managerActionExecutionService.ts:316`,`:354` | S | 0 wartości spoza słownika po akcji menedżera |
| 7 | Martwy walidator: zamontuj albo usuń (rekomendacja: usuń, 0 konsumentów) | `server/src/middleware/pmoValidation.middleware.ts:231` | S | `grep` = 0 albo trasa wskazana w raporcie |
| 8 | Jedna funkcja mapująca runtime-v1 ↔ SSOT, obie strony | nowy `src/contracts/initiatives-execution/statusMapping.ts`, `initiativeRegisterColumns.shared.ts:59`, `initiativeRegisterProjection.ts:253` | M | test odwracalności na 12/12 wartościach (mutacja 4) |
| 9 | Migracja `20262103_p12_initiative_status_slownik.sql` + dowód kolejności | `server/migrations/` | M | uruchomiona dwukrotnie na 54400: 2. przebieg = 0 zmian (mutacja 6) |
| 10 | R3: KPI w statusie niezatwierdzonym nie wchodzi na kartę | `kpiScorecardCommands.ts:397-407` | S | mutacja 5 daje RED |
| 11 | Front: kolumna Status, filtry Menu 2/3 i 6 powierzchni z §4(f) na jednej funkcji etykiet | pliki z tabeli §4(f) | L | 0 literałów statusów w komponentach (§7), `check-list-canon.sh` exit 0 |
| 12 | i18n pl+en: jeden blok kanoniczny, `labelPL` z serwera usunięte; zrzuty §6; `98_RAPORT.md` + `99_DECYZJE_WLASCICIELA.md` | `public/locales/{pl,en}/translation.json`, `evidence/p12-statusy/` | M | 3 zrzuty, 0 angielskich statusów |

**Krok 9 (migracja) wykonaj dopiero po kroku 8** — wcześniej baza rozjedzie się z kodem i stanowisko
lokalne przestanie działać w połowie pracy. Krok 10 może iść równolegle do 3–8 po kroku 1.
Krok 12 zamyka paczkę. **Testy piszesz przy każdym kroku, nie na końcu.**

---

## §6. Testy i dowody (DEC-400)

**Zasada.** Testy zastane policz **przed** pierwszą zmianą (`evidence/p12-statusy/testy-baza.txt`),
po zmianie do `testy-po.txt`; nowe czerwone = 0, zastane czerwone = te same nazwy.
„No test files found" **nie jest** PASS. `DB_TYPE` przybity w `vitest.config.ts:218`; testy zapisu
warunkowego wyłącznie na realnym PG — atrapa `Database.ts:686` zwraca `changes:1` dla każdego `UPDATE`
niezależnie od `WHERE`, więc na atrapie „przechodzi" każdy warunek.

**Testy per krok** (nowe pliki przez `git add -f`):
- macierz przejść: każda para spoza macierzy jest odrzucona; każda para z macierzy wymaga swojej roli;
- `submit-review`, `block`, `archive`, `bulkSubmitRunDrafts` — wołają silnik i zwracają jego błąd;
- odwracalność mapowania runtime-v1: dla **wszystkich 12** wartości `INITIATIVE_LIFECYCLE`
  złożenie w obie strony nie gubi statusu i nie wpada w `default`;
- KPI: `draft` i `pending_approval` odrzucone przy dodaniu na kartę, `active` przyjęte;
- migracja: dwa przebiegi, drugi zmienia 0 wierszy.

**RealPG na 54400:** fixture zakłada **własną organizację** (`org_id` losowe, prefiks `p12-test-`),
tworzy tylko to, czego potrzebuje, i **sprząta po sobie w `afterAll`**; na koniec test sam liczy
`SELECT count(*) … WHERE organization_id = <fixture>` i asertuje **0**. Danych demo nie ruszasz.

**Dowód mutacyjny — minimum 6, każda celuje w ZABEZPIECZENIE, nie w mechanizm obok:**

| # | Mutacja | Oczekiwane |
|---|---|---|
| 1 | zdejmij warunek roli z jednego przejścia w macierzy | RED |
| 2 | w `canExecuteGate` pozwól roli ADMIN ominąć warunek merytoryczny (nie tylko rolę) | RED |
| 3 | przywróć w `blockInitiative` surowy `UPDATE … SET status` zamiast wywołania silnika | RED |
| 4 | w mapowaniu runtime-v1 usuń obsługę jednej wartości (np. `EFFECTIVENESS_REVIEWED`) i wróć do `default` | RED |
| 5 | zdejmij warunek statusu z `addScorecardItem` | RED |
| 6 | zrób migrację nieidempotentną (usuń `IF NOT EXISTS` / warunek backfillu) i puść drugi raz | RED |

Mutacja bez RED = test nie broni zabezpieczenia → popraw test, nie mutację.
W raporcie: co zmutowałeś (plik:linia) i **który** test padł.

**Zrzuty — 1440, jasny, z REALNYCH tras** (harness dev-render ≠ produkt), do `evidence/p12-statusy/`:
`01-lista-inicjatyw-status.png` (kolumna Status + filtr w Menu 2/3), `02-karta-inicjatywy-przejscie.png`
(karta z wykonanym przejściem), `03-realizacja-handoff.png` (ta sama inicjatywa, ten sam status).
W `<out>.json` sprawdź `url` ≠ `/login` i `bledyKonsoli` bez 401; „przed" i „po" muszą się RÓŻNIĆ.

**Kompilacja** (per plik, exit 0; pełne `tsc`/`vitest` — zakaz): `npx esbuild <plik> --loader:.ts=ts
--loader:.tsx=tsx --format=esm --outfile=/dev/null --log-level=error` (front),
`npx esbuild <plik> --platform=node --format=esm --outfile=/dev/null` (serwer).
Bramka kanonu: `bash scripts/check-list-canon.sh` exit 0.

---

## §7. Progi liczbowe (bramka STOP)

| Miara | Jak zmierzyć (grep bez `--include`) | Próg |
|---|---|---|
| literały statusów w komponentach Inicjatyw | `grep -rn "'PENDING_REVIEW'\|'EXECUTING'\|'PROMOTED'\|'TRACKING'\|'BLOCKED'" src/components/Initiatives` — dziś **52 trafienia w 14 plikach** | **0** poza SSOT i plikami testów |
| trasy piszące status poza silnikiem | `grep -rn "initiatives" server/src` zawężone do `SET status` — dziś **5** (`InitiativeController.ts:2133`,`:2386`,`:2799`, `assessmentInitiativeGenerationRunService.ts:431`,`:444`) + 2 (`managerActionExecutionService.ts:316`,`:354`) | **0** |
| kopie słownika 13 wartości | 7 miejsc z §4(a) | **0** (SSOT + reeksport) |
| wiersze spoza słownika po migracji | `SELECT status, count(*) FROM initiatives GROUP BY 1` na 54400 | **0** wartości spoza 7 |
| idempotencja migracji | drugi przebieg | **0** zmienionych wierszy |
| `validateInitiativeStatus` | `grep -rn` po `server/src` | zamontowany na trasie **albo** usunięty (0 trafień) |
| bloki etykiet statusów w `pl/translation.json` | skrypt z §3.9 — dziś **9** | **1** kanoniczny dla inicjatyw (+ świadome wyjątki wypisane imiennie w raporcie) |
| `labelPL` na serwerze | `grep -n labelPL server/src/constants/initiativeStatuses.ts` — dziś od `:358` | **0** |
| angielskie statusy na zrzutach | stop-lista `DRAFT, PENDING_REVIEW, REVIEW, PROMOTED, PLANNING, APPROVED, SCHEDULED, EXECUTING, BLOCKED, DONE, TRACKING, CANCELLED, ARCHIVED, IN_PROGRESS` | **0** |
| `primary-[0-9]` w dotkniętych plikach | `grep -rn "primary-[0-9]"` | **0** |
| przejście bez bramki | test: przejście spoza macierzy przez konto bez roli | **odrzucone** (dziś dozwolone — `initiativeCapabilityMatrix.ts:267`) |
| testy | vitest per plik | nowe czerwone **0**, zastane = te same nazwy |
| mutacje | 6 z §6 | każda **RED** |
| rekordy testowe | `count(*)` dla `org_id` fixture po `afterAll` | **0** |

Próg niespełnialny bez decyzji właściciela → wiersz w `P12/99_DECYZJE_WLASCICIELA.md` i praca dalej nad
resztą. Zatrzymanie całości tylko gdy stanowisko lokalne nie odpowiada
(`curl http://127.0.0.1:4100/api/health` w raporcie STOP).

---

## §8. Decyzje właściciela — pytania, które mogą wyniknąć

Rozstrzygnięte i **nie do otwierania**: 7 statusów wg §4(a); „zablokowana" i „zarchiwizowana" = flagi
(DEC-424, 06.09). Poniżej wyłącznie to, czego DEC-424 nie przesądza. Jedno pytanie na wiersz.

| # | Pytanie | Rekomendacja CTO | Co się stanie po „Tak" |
|---|---|---|---|
| 1 | Czy KPI w statusie `suspended` (zawieszony) wolno dodać na kartę wyników, czy tylko `active`? | tylko `active` | zawieszony miernik nie wejdzie na nową kartę; już dodane zostają |
| 2 | Czy „Odrzucona" jest odwracalna (powrót do Szkicu po decyzji sponsora), czy terminalna? | terminalna — powrót przez nową inicjatywę ze śladem „powstała z odrzuconej #X" | pomyłkę cofa się nową inicjatywą, historia zostaje czytelna |
| 3 | Kto zdejmuje flagę „wstrzymana": ten sam, kto założył, czy tylko Sponsor/Komitet (jak dziś UNBLOCK)? | jak dziś: zakłada Właściciel/PMO, zdejmuje Sponsor/Komitet | wstrzymania nie da się cicho odkręcić samemu |
| 4 | Czy „Zamknięta" ma osobno rozróżniać „zrealizowana" i „wygaszona bez efektu"? | nie w tej fali — to Fala 2 | jedna „Zamknięta"; powód zamknięcia zostaje w polu tekstowym |
| 5 | Czy inicjatywa zarchiwizowana ma domyślnie znikać z listy (filtr „bez archiwum" włączony), czy być widoczna? | domyślnie ukryta, przełącznik w Menu 3 | lista pokazuje pracę żywą; archiwum na jedno kliknięcie |
| 6 | Czy stare kody statusów mają zostać w API dla zgodności (pole `statusLegacy`) przez jedną falę? | tak, przez Falę 2, potem usunięcie | zewnętrzne integracje nie pękają w dniu wdrożenia |

---

## §9. Raport i decyzje

**`docs/program/PROGRAM_NAPRAWCZY_20260905/P12/98_RAPORT.md`** — po polsku, bez ozdób:
1. Tabela **przed → po** dla każdego progu z §7 (liczba przed, liczba po, jak zmierzone).
2. Tabela migracji danych: status zastany → docelowy → liczba wierszy (zmierzona, nie przepisana z §4d).
3. Wynik pomiaru z kroku 0: pełna definicja `initiatives_status_check` przed zmianą, rozkład statusów,
   liczba wierszy `ie_aggregate_state` po `lifecycleState`.
4. **Procedura dla stagingu** (tekst, nie wykonanie): jak policzyć `ie_aggregate_state`, jak uruchomić
   migrację, kto to robi (nadzorca), czego Codex nie zrobił i dlaczego.
5. Mutacje: co zmutowano (plik:linia) → który test padł. Sześć wierszy.
6. Zrzuty: ścieżki + co widać.
7. Lista commitów (SHA + tytuł) i lista **znalezisk** (zauważone, nienaprawione) oraz **STOP-ów**.
8. Co **nie zostało zmierzone** i dlaczego — jawnie, zamiast ciszy.

**`docs/program/PROGRAM_NAPRAWCZY_20260905/P12/99_DECYZJE_WLASCICIELA.md`** — tabela pytań w formacie §8
(pytanie · rekomendacja · skutek „Tak"), po polsku, bez żargonu, jedno pytanie na wiersz.
Wchodzą tu wyłącznie pytania **nowe**, których §8 nie przewidział — nie przepisuj §8.
