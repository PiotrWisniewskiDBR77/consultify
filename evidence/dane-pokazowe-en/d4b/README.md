# D4b — domknięcie danych Realizacji Northwind, dowody

Paczka D4b programu „jedna baza pokazowa po angielsku"
(`docs/program/DANE_POKAZOWE_EN_20260908/PLAN.md`), po meldunku D4
(`evidence/dane-pokazowe-en/d4/README.md`).
Gałąź `mvp/dane-d4b-lancuch-uuid`, baza `127.0.0.1:54418/consultify_kopia_d44`
(TEMPLATE `consultify_staging_kopia`, świeża).
Stanowisko: API 4186, Vite 3206 (`--mode test`), konto OWNER
`james.whitfield@northwind.example`.

## Pliki

| Plik | Co zawiera |
|---|---|
| `dowod-cli.txt` | pełny cykl: apply#1 → apply#2 (idempotencja) → verify → reset w odwrotnej kolejności → verify(0) → apply → verify |
| `pomiar-api.txt` | odczyty z ŻYWEGO API i schematu: typ `organization_id`, `execution-cases`, `/api/initiatives`, `capacity-roles`, `delay-signals` |
| `dowod-testy.txt` | testy seedów, testy realnego PG dla DECYZJI 3, obie mutacje RED, powrót do GREEN |
| `pomiar-jezyka-innerText.txt` | surowy `innerText` dziesięciu ekranów |
| `pomiar-jezyka-podsumowanie.txt` | 8 unikalnych polskich napisów, KAŻDY z interfejsu — zero z danych |
| `01a`/`01b` | Inicjatywy: zakres „Active" (11) i „All" (13 rekordów, 7 statusów) |
| `02a`/`02b` | Obciążenie: lista analiz i ARKUSZ z podażą ról |
| `03`–`08` | Realizacje, Praca, Zasoby, Decyzje, Sygnały, Raporty |

## DECYZJA 1 — identyfikator organizacji = UUIDv5

`organizations.id` jest `text`, ale **dwanaście** tabel trzyma `organization_id`
typu `uuid`: `report_definitions`, `execution_report_snapshots`,
`multi_framework_initiatives`, `multi_framework_reports`, `partner_attributions`,
`partner_client_organizations`, `partner_commission_transactions`,
`siri_dimension_scores`, `siri_prioritisation_snapshots`, `tp_scim_tokens`,
`tp_service_accounts`, `tp_sso_configs`.
Slug `'northwind'` kończył się `invalid input syntax for type uuid`, a `dbAll`
połykał wyjątek — zakładka „Raporty" była CICHO pusta i D4 nie zapisał ani
jednej migawki.

`00-wspolne.ts`: `ORG_SLUG = 'northwind'` (czytelna tożsamość, materiał kluczy
`det`, e-maile) · `ORG_ID = det('organization', ORG_SLUG)` =
`468b234c-66c4-54e1-b626-5e0fb3a92f6a`. Klucze deterministyczne profilu
i członkostwa przepięte na `ORG_SLUG`, żeby ich UUID-y nie drgnęły.

**`organizations` NIE MA kolumny `slug`** (sprawdzone w
`information_schema.columns` — są tylko `id` i `name`), więc slug żyje wyłącznie
jako stała seeda; nazwa firmy zostaje w `organizations.name`.

Wynik: `execution_report_snapshots` 0 → **2**, zakładka Raporty pokazuje
2 raporty i 12 definicji (zrzut `08`).

## DECYZJA 2 — łańcuch przekazania → 4 `execution_case`

Teza D4 („nie da się bez złamania bramki D3") obalona pomiarem: **bramka była
za szeroka, nie łańcuch niemożliwy.**

Zwężenie dwóch asercji D3:

| Było | Jest |
|---|---|
| agregat runtime-v1 na inicjatywie `IN_EXECUTION` = 0 | agregat w `APPROVED_BACKLOG`/`SCHEDULED` na inicjatywie `IN_EXECUTION` = 0 |
| agregat „initiative" NIE w `APPROVED_BACKLOG` = 0 | agregat w stanie innym niż `APPROVED_BACKLOG` albo `IN_EXECUTION` = 0 |

Powód: `decideHandoffAcceptance` ustawia `lifecycleState = 'IN_EXECUTION'`, a
`statusMapping.ts:22` mapuje ten stan z powrotem na status `IN_EXECUTION` —
więc po PEŁNYM łańcuchu lista pokazuje prawdę. Groźny jest wyłącznie agregat,
który UTKNĄŁ przed metą; `SCHEDULED` (łańcuch przerwany w połowie) jest teraz
jawnie zakazany, czego stara asercja nie umiała powiedzieć.

Łańcuch (kanoniczni pisarze, po HTTP, TRZY sesje — rozdzielenie ról jest
w kodzie, nie w konfiguracji):

1. `register` — etap SQL zapisuje realizowane jako `APPROVED`
   (`statusEtapuSql`), bo `PLANNABLE_MODULE_STATUSES = ['APPROVED','PENDING_APPROVAL']`
   (`registerModuleInitiativeForPlanning.ts:38`). **8 agregatów.**
2. `PATCH .../metadata` — uzupełnia `problem` i właściciela (bije wersję).
3. plan `CREATE` → `PUBLISH` z **ośmioma** oknami; `scheduleDecision.ts:144`
   żąda okna dokładnie dla tej inicjatywy i dokładnie dla jej bieżącej wersji.
4. analiza obciążenia `compute` → **`PUBLISH`** (D4b: `compute` zostawiał
   `DRAFT`, a bramka harmonogramu żąda OPUBLIKOWANEJ — `scheduleDecision.ts:131`).
5. `schedule.request` (właściciel) → `schedule.decide` (**autorytet**
   `sarah.mitchell`, nie może być wnioskodawcą: `scheduleDecision.ts:191-197`)
   → `SCHEDULED` + zamrożona `handoff_package`.
6. `handoff.request` (właściciel) → `handoff.decide` (**Execution Manager**
   `robert.chen`, `handoffAcceptance.ts:201-207`) → **`execution_case`**.
7. DOPIERO teraz `PATCH /api/initiatives/:id/status` przestawia WIERSZ
   na `IN_EXECUTION`.

Zmierzone na żywym API i w bazie:

* `GET /api/initiatives/runtime-v1/execution-cases` → **4 sprawy, wszystkie `ACTIVE`**
* `handoff_package` → **4**
* agregaty `initiative` → **4 × `APPROVED_BACKLOG` + 4 × `IN_EXECUTION`**, zero `SCHEDULED`
* `GET /api/initiatives` → **13 inicjatyw, 7 różnych statusów, `IN_EXECUTION = 4`**
  (rejestr NIE przykrył statusu — obawa D3 nie zmaterializowała się)
* lista Realizacje → 4 wiersze, w tym „On hold" (zrzut `03`)

## DECYZJA 3 — dwie poprawki produktu `[ODMROZENIE 06_EXECUTION DEC-453]`

**(1) `server/src/services/delayDetectionService.ts`** — filtr
`t.status NOT IN ('DONE','CANCELLED')` WIELKIMI literami przy słowniku pisanym
MAŁYMI (`task.validators.ts:14-23`) nie trafiał nigdy: **13 sygnałów, w tym 5
dla zadań `done`**. Po naprawie przez `LOWER(...)` (jak
`workloadCapacityService.ts:859`) → **8 sygnałów**, dokładnie tyle, ile wynosi
asercja D4 „zadania po terminie z inicjatywą". Zrzut `07`.

**(2) `server/src/services/workloadCapacityService.ts` (`getRoleWeeklySupply`)** —
`COALESCE(u.is_active, 1) = 1` przy kolumnie **TEXT** rzucało
`COALESCE types text and integer cannot be matched`; wyjątek był połykany,
a **podaż ról zawsze wracała pusta** (`GET /capacity-roles` = `{"roles":[]}`),
więc arkusz obciążenia liczył lukę z zerowej podaży i wpisywał w powód
„Żadna osoba w organizacji nie ma stanowiska użytego w tym planie".
Po naprawie **9 ról, każda `fteWeekly > 0`**; arkusz pokazuje podaż ze źródłem
„From Resources" (zrzut `02b`). NULL w `is_active` = „nikt nie wpisał" (liczy
się), jawne `'0'`/`'false'` odpada.

Dowód: `server/src/services/__tests__/d4b.executionRuntimeDefects.pg.test.ts` —
4 testy na REALNYM PG, `describe.skipIf` bez `RUN_DB_TESTS/MOCK_DB/DB_TYPE`
(zero fałszywej zieleni), obie mutacje założone i zdjęte (`dowod-testy.txt` §C–E).

## Liczby pełnego cyklu

| Krok | 01-rdzeń | 02-odkrycie | 03-inicjatywy | 04-realizacja | 06-materiały |
|---|---|---|---|---|---|
| apply #1 | 33 | 36 | 141 SQL + 8 agregatów + 4 `execution_case` | 40 SQL + 7 RAID + 9 decyzji + 2 migawki | 80 |
| apply #2 | 0 | 0 | 0 (zmieniono 2) | 0 (zmieniono 2) | 0 |
| verify | 13/13 | 9/9 | **31/31** | **31/31** | 16/16 |
| reset → verify | — | — | 5/5 zer | 7/7 zer | 13/13 zer |
| apply po resecie | 33 | 36 | 141 + 8 + 4 | 40 + 7 + 9 + 2 | 80 |

## Znaleziska poza literą zlecenia (naprawione, bo psuły pomiar albo ekran)

1. **Asercje D4 mierzyły cudzy zbiór.** `tasks` jest współdzielona z D6, która
   dokłada 6 zadań osobistych OWNER-a (`task_type='personal'`). Po
   `06-materialy --apply` licznik „zadania" rósł 36 → 42, „bez inicjatywy”
   0 → 6, „po terminie” 8 → 10. Zakres D4 zawężony do
   `task_type <> 'personal'` (także w `--reset`, żeby D4 nie kasował danych D6).
2. **Znak `&` w tytule inicjatywy trafiał na ekran jako `&amp;`.** Globalny
   `inputSanitizationMiddleware` (`server/src/utils/security.utils.ts:60`)
   escapuje KAŻDY string ciała żądania na zapisie, więc tytuł zapisany przez
   HTTP ląduje w agregacie runtime-v1 zescapowany. Zmierzone: wiersz klasyczny
   „Skills Matrix & Upskilling", agregat „Skills Matrix &amp; Upskilling",
   lista Inicjatyw pokazywała wersję z `&amp;`. To STOP produktowy z rejestru D3
   („sanitizer runtime-v1 escapuje &") — do czasu naprawy dane pokazowe omijają
   `&` (tak samo robi już paczka D4), a dwie nowe asercje D3 tego pilnują:
   `&` w tytule/problemie/streszczeniu = 0 ORAZ `&amp;` w agregatach = 0
   (druga mierzy SKUTEK, nie zamiar).

## STOP-y — stan rejestru

**Rejestr `docs/program/PROGRAM_NAPRAWCZY_20260905/01_INDEKS_I_HARMONOGRAM.md`
NIE MA wiersza wyniku paczki D4** (ostatni wiersz o D4 mówi tylko „D4, D5
wydane"), więc **żaden ze STOP-ów D4 nie jest w nim zapisany** — ani dwie skale
ekspozycji, ani „Escalated" wyprowadzone z terminu, ani decyzja wstrzymująca
inicjatywę domyślnie, ani `uuid` vs `text` organizacji. Żyją wyłącznie
w `evidence/dane-pokazowe-en/d4/` i w meldunku robotnika. To do uzupełnienia
przez nadzorcę przy scaleniu.

STOP `uuid` vs `text` (STOP A) jest **zamknięty** przez DECYZJĘ 1 — asercja
„migawki raportów" przestawiona z 0 na 2 i mierzy teraz prawdę, nie defekt.

### NOWE STOP-y zmierzone w D4b (nienaprawione)

1. **Kolumna „Owner" rejestru pokazuje polski literał zamiast nazwiska.**
   `src/components/Initiatives/initiativeRegisterProjection.ts:336` —
   gdy `initiativeOwnerId` agregatu jest UUID-em (czyli zawsze poza samym
   zalogowanym), wiersz renderuje na sztywno „Przypisany właściciel".
   Osiem z trzynastu wierszy listy Inicjatyw nie pokazuje właściciela;
   pięć niezarejestrowanych pokazuje prawdziwe nazwisko z wiersza klasycznego.
   To JEDYNE polskie słowo w `innerText`, które wygląda jak dane (16 z 28
   trafień pomiaru języka). Naprawa = rozwiązywanie nazw w projekcji rejestru,
   nie tłumaczenie literału.
2. **Sanitizer escapuje `&` na zapisie** — opis wyżej,
   `server/src/utils/security.utils.ts:60`. Dane pokazowe omijają go
   obejściem; sam defekt zostaje.
3. **Arkusz obciążenia miesza jednostki.** Kolumna „Supply (FTE)" pokazuje
   13 dla kwartału (13 tygodni × 1 FTE/tydz.), a panel właściwości mówi
   „Roles 2" (liczba ról z `roleDemand` planu) przy dziewięciu wierszach
   podaży w arkuszu. Liczby są spójne wewnętrznie, etykiety mylą.
4. **Oscylacja D3 ↔ D4 na dwóch kamieniach.** Drugi `--apply` melduje
   `zmieniono=2` w obu paczkach: D4 celowo przesuwa dwa kamienie wobec planu
   bazowego („Cutover from paper travellers", „Measured pilot result pack"),
   a `03-inicjatywy --apply` wpisuje termin ze swoich danych z powrotem.
   Stan STABILNY (trzeci przebieg też 2/2, nie rośnie), obie bramki `--verify`
   zielone. Dług interakcji dwóch paczek, nie defekt D4b.

## Język

`pomiar-jezyka-podsumowanie.txt`: 8 unikalnych polskich napisów w `innerText`
dziesięciu ekranów, **żaden z danych** — literał „Przypisany właściciel"
(STOP 1 wyżej), etykieta zakładki „Obciążenie", polski format dat i zdanie
podsumowania w Zasobach. Dane (tytuły inicjatyw, zadań, decyzji, RAID,
raportów) są w całości po angielsku; pilnują tego asercje `--verify` D3 i D4.
