# ★ SCALONE PO FIX-216 (`0cbe26b56b`) — 31.08.2026

Narzędzie migracji **467 zadań** ma teraz atomowość, ciągłość partii i ponawialność.

## Co potwierdził odbiór adwersaryjny (własnymi rękami)
**Atomowość R1 — potwierdzona MOCNIEJ niż w raporcie.** Audytor powtórzył mutację
wykonawcy, a potem dołożył własną, rozstrzygającą: przywrócił architekturę sprzed
216 (wpis rejestru poza transakcją) ⇒ czerwień z doklejonym `rollup`. Test realnie
łapie **stan połowiczny** (kanon zapisany, rejestr pusty), a awaria jest wymuszana
prawdziwym naruszeniem unikalności wewnątrz tej samej transakcji — nie atrapą.

**Strażniki FIX-204** — obie mutacje powtórzone, obie czerwone. Idempotencja
nienaruszona. **Bezpieczniki** (zakres organizacji, host zdalny, jawne
potwierdzenie, `--max-tasks=1`, DRY_RUN domyślny) — wszystkie trzymają.

**Skip odblokowany:** „zastany skip" okazał się testem bramkowanym zmienną
środowiskową. Audytor ją ustawił — **test przechodzi**. To jedyny test żywej ścieżki
`createExecutionTask`, którą 216 refaktoryzuje: awans z PARTIAL na **PROVEN**.

## Dlaczego FIX był konieczny — regresja wykryta przez audytora
Wpis `FAILED` **trwale blokował ponowienie**. Sonda na żywej bazie: naprawienie
przyczyny i powtórzenie komendy ⇒ `outcomes=[]`, cisza, exit 0, zero migracji;
`migrateOneTask()` zwracał `NOOP` — tę samą wartość co „już bezpiecznie zmigrowane",
bo wiersz `FAILED` zapisywał **tę samą checksumę** co sukces. Odblokowanie wymagało
destrukcyjnego `DELETE`. **To było pogorszenie wobec stanu sprzed 216** (przedtem
brak wiersza ⇒ ponowienie działało).

## FIX-216 — bramka przeszła pełnym cyklem na żywej bazie
`{"failed":1}` ⇒ rejestr `FAILED/CANONICAL_HOME_MISSING` ⇒ naprawa przyczyny ⇒ **ta
sama komenda** ⇒ `{"migrated":1,"failed":0}` ⇒ rejestr `MIGRATED`,
`case_version_before=7, case_version_after=8`. Trzeci przebieg: `{"planned":0}` —
poprawny no-op na już zmigrowanym. Strażnik jest **status-świadomy**, a upsert ma
`WHERE status='FAILED'`, więc **nigdy nie nadpisze wiersza `MIGRATED`**.

**Ślad forensyczny przestał kłamać:** `caseVersionAfter` zapisuje wersję **sprawy**,
nie zadania. Audytor zmierzył, że sprawa szła 7→8, a rejestr notował `after=1` — w
polu, na którym opiera się jakiekolwiek cofanie. Mutacja odtwarza dokładnie ten błąd.

## ★ Uzasadnienie STOP-u na cofaniu — WYMIENIONE, bo było błędne
Wykonawca uzasadniał niemożność cofania tym, że rejestr nie przechowuje poprzedniego
payloadu sprawy. Audytor to **obalił pomiarem**: `rollup` jest przeliczalny (czysty
przyrost `tasksTotal +1`, `blockerDecisionIds` zaszyte na sztywno), a cofnięcie
**wystarczające** istnieje — **6 z 7 tabel wraca bajtowo identycznie**, ponowna
migracja daje kanon identyczny z pierwszą.

**Prawdziwa przeszkoda jest inna i mniejsza:** `ie_audit_events` i `ie_outbox_events`
mają UNIQUE po `aggregate_version`, więc cofnięcie **zachowujące ślad audytowy**
kończy się `FAILED` przy ponownej migracji. Każde cofnięcie umożliwiające ponowienie
musi skasować wpis audytowy. Uzasadnienie wymienione w raporcie dyżuru.

## Co zostaje nieodwracalne po zmigrowaniu jednego zadania
Wraca wszystko poza trzema rzeczami: (1) ponowna migracja wymaga bezpowrotnego
skasowania wpisu audytowego i zdarzenia kolejki; (2) w karcie sprawy zostaje pusty
licznik `rollup` — zera, system zachowuje się identycznie (wszyscy trzej czytelnicy
robią `?? {zera}`); (3) **wpis `FAILED` już NIE blokuje** — to naprawił FIX-216.

**Pilot D-13 odblokowany.**

---

## Pierwotna karta odbioru adwersaryjnego

# ODBIÓR 216 — ATOMOWOŚĆ I ODWRACALNOŚĆ MIGRACJI LEGACY `tasks` (audyt adwersaryjny)

Gałąź: `codex/day216-odwracalnosc-20260831` @ `d1f0822d47` (kod: `acea44e55a`)
Audyt wykonany: 2026-08-31, własna baza `cx-audit216-pg` (loopback **6371**, usunięta `docker rm -f -v`)
Zakaz przestrzegany: zero kontaktu z demo/stagingiem/produkcją/Railway. Drzewo po audycie CZYSTE.

## WERDYKT: **SCALIĆ PO FIX** — ocena **B**

Wykonawca **nie zawyżył**; R1 jest udowodnione **mocniej, niż sam pokazał**. Ale dyżur
wprowadza jedną realną **regresję odzyskiwalności** (`FAILED` trwale paraliżuje zadanie i
melduje `NOOP`), a STOP na R3 postawiono z **niewłaściwego powodu**: `rollup` jest
kosmetyczny i przeliczalny, a prawdziwą przeszkodą są UNIQUE na `ie_audit_events` /
`ie_outbox_events`, których wykonawca nie zmierzył.

---

## 1. TWIERDZENIE 1 — „R1 atomowość, potwierdzona mutacją": **POTWIERDZONE, MOCNIEJ NIŻ W RAPORCIE**

Powtórzyłem mutację wykonawcy i dołożyłem własną, ostrzejszą.

| Mutacja | Cel | Wynik |
|---|---|---|
| **M1a** (wykonawcy) — usunięcie `tx.appendLegacyTaskCutoverLedgerEntry` (`executionWork.ts:207`) | czy wpis ledgera w ogóle jest | **CZERWIEŃ**, `expected [ 'MIGRATED' ] to deeply equal [ 'FAILED' ]`, exit 1 |
| **M1b (moja, rozstrzygająca)** — przywrócenie architektury sprzed 216: wpis ledgera przez `pool.query` **POZA** transakcją | czy test naprawdę łapie **stan połowiczny** | **CZERWIEŃ**: `expected [ { version: 2 } ] to deeply equal [ { version: 1 } ]`, w diffie doklejony `rollup: { tasksTotal: 1, … }` |

**M1b jest odpowiedzią na zarzut z instrukcji.** Test NIE jest tautologią „oba wpisy istnieją
po udanym przebiegu". Z ledgerem poza transakcją kanon **commituje się** (case 1→2, rollup
doklejony), ledger zostaje pusty — i test to wykrywa. Test wymusza awarię realnym UNIQUE
(`uq_legacy_task_cutover_client_request`) **wewnątrz** tej samej transakcji, po aktualizacji
case i `claimRelation`, i czyta z bazy brak taska/relacji/audytu/outboxu/receipt.

Dodatkowo `{ retry: 0 }` jawnie w obu plikach — brak maskowania przez retry (Z29).

## 2. TWIERDZENIE 2 — „R2 FAILED z kontynuacją": **MECHANIZM DZIAŁA, ALE PUŁAPKA Z INSTRUKCJI JEST REALNA**

Mutacja wykonawcy powtórzona: usunięcie `try/catch` w pętli ⇒ **CZERWIEŃ**,
`Error: CANONICAL_HOME_MISSING:day216-failed-org:a-missing`, exit 1. Partia realnie idzie
dalej, wpis `FAILED` ma `reason_code`. To działa.

**Ale ponowienie po `FAILED` NIE działa — zmierzone własną sondą:**

```text
STEP1 run (brak execution_case)     outcomes=["FAILED"]  ledger=[{FAILED, CANONICAL_HOME_MISSING}]  canonical_tasks=0
STEP2 operator NAPRAWIA przyczynę:  execution_case utworzony
STEP3 selektor widzi kandydatów  =  0        (Guard A: NOT EXISTS)
STEP4 TA SAMA komenda ponownie      outcomes=[]  ledger=[{FAILED,…}]  canonical_tasks=0   ← cisza, exit 0
STEP5 bezpośrednio migrateOneTask() outcome=NOOP  canonical_tasks=0   ← wynik w kształcie sukcesu
STEP6 po ręcznym DELETE wiersza     outcomes=["MIGRATED"]  canonical_tasks=1
```

Trzy fakty, których raport nie mówi:
1. Po `FAILED` zadanie jest **trwale zaparkowane**, nawet po usunięciu przyczyny.
2. `migrateOneTask` zwraca **`NOOP`** — dokładnie tę samą wartość co „już bezpiecznie
   zmigrowane". Strażnik checksumy nie odróżnia „zmigrowane" od „nigdy nie zmigrowane, bo
   padło": wiersz `FAILED` zapisuje **tę samą checksumę** co udana migracja
   (`legacy-task-cutover-runner.ts:410` vs `:290`).
3. Jedyne wyjście to **destrukcyjny `DELETE`** wiersza rejestru — czyli skasowanie właśnie
   tego śladu, dla którego rejestr istnieje.

**To jest regresja wobec stanu sprzed 216.** Przedtem wyjątek przerywał partię i NIE zostawiał
wiersza — powtórzenie komendy ponawiało zadanie. Dyżur 216 kupuje kontynuację partii za cenę
trwałego parkowania każdego nieudanego zadania. Przy 467 zadaniach jedna przejściowa awaria
(deadlock, zerwana sesja) = jedno zadanie do ręcznej, destrukcyjnej interwencji.

## 3. TWIERDZENIE 3 — „strażniki FIX-204 nadal czerwienieją": **POTWIERDZONE, obie mutacje własnymi rękami**

| Mutacja | Wynik |
|---|---|
| Guard A — usunięcie `AND NOT EXISTS` z selektora zadań (`:248`) | **CZERWIEŃ** `expected [ 'day204-idem-task-a' ] to deeply equal [ 'day204-idem-task-b' ]`, 1 failed / 2 passed |
| Guard B — usunięcie bloku checksum/continue (`:293-298`) | **CZERWIEŃ** `clientRequestId was already used for a different command target`, 1 failed / 2 passed |

Po przywróceniu obu — zieleń. Reguła z `WSPOLNA_PRZYCZYNA_ODBIORY_204_210.md` spełniona.

## 4. TWIERDZENIE 4 — „19 passed, 0 failed, 1 zastany skip": **LICZBA SIĘ ZGADZA; SKIP ZBADANY I ODBLOKOWANY**

Zmierzone na 6 plikach: `Test Files 6 passed (6)` / `Tests 19 passed (19)`, **exit 0**.
(Raport 204 wskazywał nieistniejącą już nazwę pliku — FIX-204 przemianował go na
`day204-legacy-task-cutover-runner-options.test.ts`.)

„Zastany skip" to `tests/integration/initiatives-execution/executionWork.realdb.test.ts`:
`describe.skip` bramkowane `IE_TEST_DATABASE_URL`, wynik `Test Files 1 skipped (1)`, **exit 0** —
podręcznikowa cicha zieleń. Wykonawca uczciwie oznaczył ją jako niedowód i zostawił.

**Zrobiłem to, czego nie zrobił: ustawiłem `IE_TEST_DATABASE_URL` i uruchomiłem.**

```text
✓ Execution Work canonical Task and Decision realDB > keeps same IDs across Case/Praca/My Work…
Test Files  1 passed (1)   Tests  1 passed (1)
```

To jest **jedyny** test żywej, wspólnej ścieżki `createExecutionTask`, którą dyżur 216
refaktoryzował (wydzielenie `prepareExecutionTaskCreation`). Przechodzi. **Twierdzenie
wykonawcy „zewnętrzne zachowanie `createExecutionTask` jest PARTIAL" podnoszę do PROVEN.**

Bramka końcowa z odblokowanym skipem: **`Test Files 7 passed (7)` / `Tests 20 passed (20)`, exit 0.**

## 5. TWIERDZENIE 5 — „R3: STOP, wierne cofnięcie niemożliwe": **STOP ZASADNY CO DO WNIOSKU, BŁĘDNY CO DO POWODU**

Zaatakowałem trzema pomiarami.

### (a) Czy `rollup` da się przeliczyć z danych, które ledger MA? — **TAK**

`caseAndRollup` (`executionWork.ts:80-117`) stosuje czysty **przyrost**:
`{ tasksTotal: +1, tasksBlocked: status==='BLOCKED' ? 1 : 0 }`. Na ścieżce cutoveru
`blockerDecisionIds: []` jest **zaszyte na sztywno**, więc status to zawsze `OPEN`, a odwrotność
to dokładnie `tasksTotal -= 1`. `case_version_before` jest w rejestrze. Odwrotność jest
w pełni wyliczalna.

### (b) Czy istnieje cofnięcie **WYSTARCZAJĄCE**? — **TAK, ZMIERZONE**

Napisałem cofnięcie adresowane **wyłącznie** kolumnami, które rejestr już przechowuje
(`canonical_id`, `client_request_id`, `case_version_before`), z CAS na wersji case.
Wynik na żywej bazie:

```text
A) STAN PRZED MIGRACJĄ  vs  STAN PO COFNIĘCIU
  tasks:                     IDENTICAL      ← wiersz legacy nietknięty
  ie_aggregate_relations:    IDENTICAL
  ie_command_receipts:       IDENTICAL
  ie_audit_events:           IDENTICAL
  ie_outbox_events:          IDENTICAL
  legacy_task_cutover_ledger:IDENTICAL
  ie_aggregate_state:        DIFFERENT  ← JEDYNA różnica: doklejony rollup samych ZER + refreshedAt
                                          (wersja case przywrócona do 1 — kolumna version bez różnicy)

B) KANON PO 1. MIGRACJI  vs  PO PONOWNEJ MIGRACJI (po cofnięciu)
  wszystkie 7 tabel:         IDENTICAL   (modulo znaczniki czasu i batch_id)
```

**Cofnięcie wystarczające istnieje i jest zmierzone.** Zadanie wraca do stanu sprzed migracji
i daje się zmigrować ponownie do **identycznego** kanonu.

### (c) Czy pozostały `rollup` cokolwiek znaczy? — **NIE, jest bezczynny**

Wszyscy trzej i jedyni czytelnicy tego pola robią `?? {}` / `?? {zera}`:
`executionWork.ts:96`, `executionWorkHardening.ts:54`, `operationalAllocation.ts:142`.
Brak `rollup` ≡ `rollup` samych zer. Dowodzi tego sam pomiar B: druga migracja szła po case
**z** rollupem zer i dała stan identyczny z pierwszą, która szła po case **bez** rollupu.
Czerwony diff, na którym wykonawca się zatrzymał, jest **semantycznie pusty**.

### ALE — prawdziwa przeszkoda, której wykonawca NIE zmierzył

Spróbowałem cofnięcia **zachowującego ślad audytowy** (bez kasowania `ie_audit_events`
i `ie_outbox_events`). Ponowna migracja: **`FAILED`**. Powód znaleziony w schemacie:

```text
ie_audit_events  UNIQUE (organization_id, aggregate_type, aggregate_id, aggregate_version)
ie_outbox_events UNIQUE (organization_id, aggregate_type, aggregate_id, aggregate_version, event_type)
```

Ponowna migracja odtwarza `legacy-task:<id>` w wersji 1 ⇒ kolizja UNIQUE na obu.
**Każde cofnięcie, które ma pozwolić na ponowną migrację, MUSI skasować wpis audytowy
i zdarzenie outboxu.** Nie ma wariantu „zachowaj ślad i ponów". Baza tego nie blokuje
triggerem — to kwestia polityki, nie egzekucji.

**To jest właściwe uzasadnienie STOP-u**, dużo mocniejsze niż `rollup`. STOP zostaje w mocy;
uzasadnienie w raporcie należy wymienić.

## 6. BEZPIECZNIKI FIX-204 PO DYŻURZE 216 — **WSZYSTKIE TRZY TRZYMAJĄ** (zmierzone CLI, kody wyjścia)

| Bezpiecznik | Pomiar | Exit |
|---|---|---|
| zakres organizacji fail-closed | `--organization-id is required… refusing to start unscoped.` | **1** |
| host zdalny bez zgody | `Target host "10.255.255.1" is not loopback… set ALLOW_REMOTE_DB_TARGET=…` | **1** |
| brak potwierdzenia zapisu | `Confirmation required. Set CONFIRM_LEGACY_TASK_CUTOVER=day204-write` | **1** |
| `--max-tasks` domyślnie 1 + DRY_RUN domyślnie | run bez flag ⇒ `{"mode":"DRY_RUN","initiatives":0,"tasks":[]}` | 0 |

`server/scripts/lib/scriptDatabaseTarget.ts` nietknięty przez 216 (ostatnia zmiana `d9e47dcaec` = FIX-204-4).

## 7. PUŁAPKA POMIAROWA (atrapy w `beforeAll`) — **NIE DOTYCZY**

W obu plikach dyżuru 216 jest **zero** `vi.spyOn`/`vi.mock` (`grep` = 0 trafień). Testy są
czysto bazodanowe, każdy plik ma dokładnie jedno `it`, więc globalny `clearAllMocks` nie ma
czego skasować. Bramki Z33 (a)(b)(d) nie dotyczą (CLI/domain, bez HTTP/JWT); (c) domknięte
przez `assertRealPostgresTestEnvironment()` + jawną asercję `DB_TYPE === 'postgres'`.

## 8. MIGRACJE — **DYŻUR NIE DOKŁADA ŻADNEJ**

`git show --stat` obu commitów: 6 plików + raport, **zero `.sql`**. `reason_code` i status
`FAILED` istnieją od `20261721_legacy_task_cutover_ledger.sql` (dyżur 197). Mimo to
uruchomiłem pełny łańcuch od PUSTEJ bazy: `✅ Postgres migrations complete`; drugi przebieg:
`Applying migrations: 0` + `✅`. Idempotencja OK.

---

## FIX-216 — lista napraw

| # | Waga | Plik:linia | Rzecz |
|---|---|---|---|
| **FIX-216-1** | **BLOKUJĄCA** | `server/scripts/legacy-task-cutover-runner.ts:293` (Guard B) + `:248` (Guard A) + `:405` | `FAILED` trwale parkuje zadanie i melduje `NOOP`. Strażniki muszą być **świadome statusu**: `NOT EXISTS (… AND ledger.status <> 'FAILED')` w selektorze, a Guard B ma przy `status='FAILED'` **ponawiać**, nie zwracać `NOOP`. Wpis `MIGRATED` w transakcji wtedy `ON CONFLICT (organization_id, legacy_task_id) DO UPDATE` (`postgresMaterialCommandUnitOfWork.ts:342`). Zero migracji. |
| **FIX-216-2** | WYSOKA | `server/src/domain/initiatives-execution/executionWork.ts:209` | `caseVersionAfter: commandEnvelope.expectedVersion + 1` zapisuje wersję **TASKA**, nie CASE'a. Zmierzone: case szedł **7 → 8**, rejestr zapisał `case_version_before=7, case_version_after=1`. Ślad forensyczny jest fałszywy w polu najważniejszym dla cofania. Ma być wersja case (`caseBefore + 1`). |
| **FIX-216-3** | ŚREDNIA | `server/scripts/legacy-task-cutover-runner.ts:405` | `ON CONFLICT DO NOTHING` (bez celu) cicho gubi wpis `FAILED` przy KAŻDEJ kolizji unikalności. Widać to we własnym teście atomowości dyżuru: wiersz `FAILED` nigdy tam nie powstaje, a test i tak jest zielony. Wskazać cel konfliktu i logować pominięcie. |
| **FIX-216-4** | ŚREDNIA (dokument) | raport `CODEX_DAY216_ODWRACALNOSC_REPORT.md`, sekcja STOP | Wymienić uzasadnienie STOP-u: nie `rollup` (kosmetyczny, przeliczalny, bezczynny), lecz UNIQUE na `ie_audit_events` / `ie_outbox_events` po `aggregate_version` — cofnięcie umożliwiające ponowną migrację **musi kasować ślad audytowy**. Dopisać okno drenażu outboxu (30 s, `ENABLE_INITIATIVE_EXECUTION_OUTBOX_CONSUMER`). |
| **FIX-216-5** | NISKA | `tests/unit/initiatives-execution/materialCommand.test.ts:38` | Atrapa transakcji ma 21 z 25 wymaganych metod interfejsu. Dług **zastany** (przed 216 było 21 z 24); dyżur 216 poszerza go o jedną. Nie jest regresją 216, ale warto domknąć. |

## CO WŁAŚCICIEL DOSTAJE — PILOT JEDNEGO REKORDU

**Czy pilot jest odwracalny w praktyce? — TAK, funkcjonalnie; NIE, co do bajtu.** Zmierzone,
nie oszacowane. Po zmigrowaniu jednego zadania i wykonaniu cofnięcia:

**WRACA w pełni:** wiersz legacy w `tasks` (runner go w ogóle nie dotyka — `IDENTICAL`),
wersja i tożsamość `execution_case`, relacja case↔task, receipt komendy, cały nowy agregat
`execution_task`, wiersz rejestru. Zadanie daje się zmigrować ponownie do **identycznego**
stanu kanonicznego.

**NIE WRACA (trwałe po jednym zadaniu):**
1. **Wpis audytowy i zdarzenie outboxu trzeba SKASOWAĆ**, żeby ponowna migracja była możliwa
   (UNIQUE po `aggregate_version`). Ślad append-only tego pilota ginie bezpowrotnie.
2. W ładunku `execution_case` **zostaje obiekt `rollup` z samymi zerami + `refreshedAt`**.
   Zachowanie systemu identyczne (wszyscy trzej czytelnicy robią `?? {zera}`), ale bajt
   w bazie inny na zawsze.
3. Jeśli konsument outboxu jest włączony i zdąży (tik co 30 s), zostaje wiersz w
   `ie_outbox_delivery_receipts` — cofnięcie go nie usuwa. **Pilot uruchamiać z wyłączonym
   `ENABLE_INITIATIVE_EXECUTION_OUTBOX_CONSUMER`.**
4. Jeśli zadanie **padnie** (np. brak `execution_case` — najbardziej prawdopodobny scenariusz
   na stagingu), zostaje wiersz `FAILED`, który **trwale blokuje ponowienie**; odblokowanie =
   ręczne `DELETE` z rejestru. **To jest FIX-216-1 i dlatego pilot ma poczekać na tę naprawę.**

## REKOMENDACJA

Scalić po **FIX-216-1** i **FIX-216-2** (obie bez migracji, obie małe). Pilot jednego rekordu
uruchamiać dopiero po nich, z wyłączonym konsumentem outboxu i z gotowym skryptem cofnięcia
(kształt udowodniony pomiarowo w §5b). R3 pozostaje STOP-em — z poprawionym uzasadnieniem.

## HIGIENA AUDYTU

Baza `cx-audit216-pg`, loopback `127.0.0.1:6371`, `pgvector/pgvector:pg16`, usunięta
`docker rm -f -v`. Porty 6151-6157 i 5092-5105 nietknięte. Wszystkie mutacje przywrócone
przez `cp` (zero `git stash`), drzewo robocze po audycie **czyste** (`git status --porcelain`
pusty), HEAD nadal `d1f0822d47`. Nic nie pushowano. Sondy audytowe usunięte z worktree.
