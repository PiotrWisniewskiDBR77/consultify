# CODEX DAY197 — MIGRACJA LEGACY TASKS → KANON, ETAP 1

Status: R1 i R2a wykonane; R2b zatrzymane merytorycznie na czerwonym kontrakcie;
R3 wykonane jako dotrzymanie zakazu masowego cutover.

## Baza, marker i zasoby

```text
MARKER OK
60581ed6b5054e3218f7bc33d6e2a32794fb2af8
git status --short: pusty
```

Marker jest przodkiem nowszego tipa `github-backup/codex/m03-admin-20260824`;
zgodnie z DEC-2026-08-26-95 praca wystartowała dokładnie z markera. Porty
6128, 5066 i 5067: 3/3 wolne przed startem. Dysk: 20 GiB wolne.

## R1 — denominator A4.0

M1, fresh-DB po 870 migracjach i `case-workspace-seed-local.mjs`:
`active_execution_cases=0`, `legacy_initiatives_with_tasks=0`. Replay migracji:
`Applying migrations: 0`. Seed dołożył 1 projekt, 8 włączonych flag i 0 tasks;
fresh migracje zawierały już dane bazowe, dlatego globalne liczniki po seedzie
wyniosły 2 organizations, 2 users i 2 ACTIVE members, a nie oczekiwane 1/1/1.

M2, druga fresh-DB po 870 migracjach: **EVIDENCE_MISSING**. Polecony
`npm run db:seed:demo:contract` zatrzymał się przed utworzeniem zadań na
`initiatives_status_check`, próbując wstawić status `completed`. Odczyt po
błędzie: `active_execution_cases=0`, `legacy_initiatives_with_tasks=0`,
`tasks total=0`. Nie zastąpiłem tego syntetycznym INSERT-em ani zmianą seeda,
bo seed jest tylko do odczytu w licencji.

M3: **NIE ZMIERZONO**. Z28 zakazuje połączenia do demo/staging/produkcji.
Paczka read-only dla nadzorcy lub właściciela:
`/private/tmp/cx-day197-migracja-e1-artefakty/day197-denominator.sql`; ma zostać
uruchomiona na bazie demo/staging procedurą `consultify-promocja-demo`.

## KARTA DECYZYJNA D-7 / ETAP 1 — DLA WŁAŚCICIELA

1. **Liczby lokalne.** M1: 0 aktywnych spraw / 0 inicjatyw z zadaniami,
   odtwarzalne przez fresh migracje, seed Case Workspace i dwa SELECT-y A4.0.
   M2: brak wiarygodnej liczby — seed produktowego kształtu kończy się błędem
   constraintu przed utworzeniem zadań; po błędzie baza ma 0 / 0.
2. **Liczba realna.** Nie zmierzono danych demo/staging, ponieważ Z28 zabrania
   takiego połączenia. Gotowe zapytania są w
   `/private/tmp/cx-day197-migracja-e1-artefakty/day197-denominator.sql`.
3. **Koszt jednego domu.** Nie da się go dziś uczciwie podać: pięć zamówionych
   poleceń nie tworzy przechodniego łańcucha. Pierwsze zapisuje
   `REGISTERED_DRAFT`, drugie wymaga `APPROVED_BACKLOG`. Realny test zatrzymał
   się dokładnie na tej granicy; koszt pozostaje `NOT_MEASURED`.
4. **Warianty skali.** (i) wszystkie inicjatywy z zadaniami: koszt co najmniej
   5 transakcji na inicjatywę + 1 na zadanie, pełny skutek migracyjny;
   (ii) tylko kwalifikowalny zakres MVP: ten sam koszt jednostkowy, mniejszy
   denominator i jawne pominięcia; (iii) odłożyć etap 2 do pomiaru M3: zero
   zapisu teraz, brak ryzyka skali. Rekomendacja: wariant (iii), a po M3 wariant
   (ii), jeśli właściciel zaakceptuje utratę historii i pola bez mapowania.
5. **Rekomendacja.** Nie uruchamiać etapu 2 przed realnym M3: obecne wiarygodne
   dane nie zawierają dodatniego denominatora, a M2 jest zablokowane błędem.
   Przed etapem 2 właściciel musi też zatwierdzić istniejące konto systemowe;
   pilot R2 użyje OWNER-a wyłącznie jako aktora pilotażowego, NIE systemowego.
6. **Brak decyzji.** Bez decyzji właściciela etap 2 nie rusza; brama 409 zostaje.

## Korekty wobec instrukcji

- T1: literalny grep z instrukcji dał 0, ponieważ nazwa typu i wywołanie są na
  różnych liniach; odczyt kodu nadal pokazuje genezę w `handoffAcceptance.ts`.
- T8/naming: walidator raportuje 92 zastane problemy w 1087 plikach, nie 20.
- M1: globalne 1/1/1 nie potwierdziło się z powodu danych po migracjach.
- M2: seed nie jest zgodny z aktualnym constraintem statusu inicjatywy.

## R2a — ledger i świeże migracje

Dodano wyłącznie addytywną migrację
`server/migrations/20261721_legacy_task_cutover_ledger.sql`: tabela ma komplet
kolumn A4, PK `(organization_id, legacy_task_id)`, indeks batch/status i
unikalność requestu w organizacji. Nie ma ALTER, FK ani odczytu cudzej tabeli.

- przebieg na istniejącej fresh-DB: `Applying migrations: 1`; replay: 0;
- Day161 fresh gate: 871 migracji, replay 0,
  `DAY161_FRESH_MIGRATION_GATE=PASS` z stdout procesu;
- naming validator: 92/1087 przed, 92/1088 po — dług nie wzrósł;
- realDB Day197: 2/2 PASS, 0 pending, `DB_TYPE=postgres`, guard wywołany bez
  argumentów i `--retry=0`.

## STOP — R2b pełny pilot material-command

Rodzaj: MERYTORYCZNY

Powód: `initiative.register` kończy w `REGISTERED_DRAFT`, natomiast następne
zamówione `initiative.schedule.request` wymaga `APPROVED_BACKLOG`; pięć kroków
A4.0 pomija wymagane przejścia lifecycle.

Licencja, którą sprawdziłem: odczyt `registerInitiative.ts` i
`scheduleDecision.ts` jest dozwolony; zapis domeny jest zakazany. Runner miał
wołać dokładnie pięć poleceń, więc nie ma licencji na dopisanie kroków ani
surowe ustawienie stanu.

Dowód: `tests/integration/day197-legacy-task-cutover.realdb.test.ts`, pełna nazwa
`Day197 legacy task cutover stage 1 realDB proves the instructed five-command chain has a missing lifecycle transition`;
na realnym PostgreSQL polecenie Schedule odrzuca stan komunikatem
`Initiative is not APPROVED_BACKLOG`, a readback pozostaje `REGISTERED_DRAFT`.

Co dostarczyłem ZAMIAST zmiany: czerwony kontrakt realDB oraz gotowy ledger z
fresh gate. Nie utworzyłem runnera, który pozornie omijałby domenę.

Co zrobiłbym, gdyby zapadła decyzja X: po zatwierdzeniu kompletnego łańcucha
od Register przez analizę/definicję/portfolio do `APPROVED_BACKLOG` dodałbym
te polecenia do runnera, nadal z dry-run, confirmem i limitem jednego wiersza.

Rekomendacja dla nadzorcy: uzupełnić A4.0 o wszystkie obowiązkowe przejścia i
ich fixture'y albo jawnie zezwolić na pilot startujący z istniejącej inicjatywy
`APPROVED_BACKLOG`; dopiero potem ponowić R2b/D1-D4.

Stan: zacommitowano częściowo R1 w `36270a6250`; R2a i czerwony kontrakt w
bieżącym commicie. Czy kontynuowałem pozostałe pozycje: TAK — R3 poniżej.

## R3 — zakaz masowego przenoszenia

Nie przeniesiono ani jednego zadania, nie uruchomiono pętli po `tasks`, nie
zbudowano drugiego domu i nie zmieniono bramy 409. Etap 2 pozostaje zablokowany
do akceptu właściciela i usunięcia luki lifecycle.

## Zasięg testów i pułapki

Przed zmianami: 14 pełnych nazw z czterech pakietów jednostkowych domeny.
Po zmianach: te same 14 nazw plus dokładnie dwie nowe nazwy Day197; żadna nazwa
nie zniknęła. Diff:
`/private/tmp/cx-day197-migracja-e1-artefakty/nazwy.diff`.

Pakiet realDB wyłączył pułapkę SQLite/mock przez komplet env w tej samej linii,
asercję `DB_TYPE=postgres`, `RUN_DB_TESTS=1`, `MOCK_DB=false`, jawny loopback
`DATABASE_URL`, `assertRealPostgresTestEnvironment()` bez argumentów i
`--retry=0`. Nie mierzył HTTP/auth/V8, więc pułapki 404-before-auth,
test-auth-bypass i beta visibility nie leżą na jego ścieżce. Wynik JSON:
2 total, 2 passed, 0 failed, 0 pending. Pakiety jednostkowe nie otwierały DB;
wynik: 14/14 PASS.

Nie wpisuję `FIXED` ani `VERIFIED`: czerwony kontrakt dowodzi istniejącej luki,
ale nie było zmiany produkcyjnej i dlatego mutacja Z32 nie ma zastosowania.

## Artefakty

Wszystkie poza repo, w `/private/tmp/cx-day197-migracja-e1-artefakty`:

- `day197-denominator.sql` — `f588ab590536578090b8b4fd909ff81f5da0069a280c98ca1c508a6cb954c07b`;
- `day197-final-realdb.json` — `411476b6337d191c40cef70f3ffb1a2bf4d82b47b24879b06013ae4886fc38a8`;
- `day197-day161-gate.txt` — `8bf1455a04ae9b0d5e95d06f89f9f94c99900aa755f03f556534bfcdc5c1d15b`;
- `day161-fresh-migration-gate.log` — `f5f1bd2fcfd1f761c9d6cceb5462e4e44ca22bb6b358cfbc0b612d68c658a1cc`;
- `day161-fresh-migration-gate-replay.log` — `9770b16da9597c5bb455c00c30efbc79e50b2312dd3c34a6ce1e222d498721cd`;
- `nazwy.diff` — `19759bdb1d21ec81c39f789a96902472e54083366204258203a76e8747a8e30b`.

## Zakres zmian

Tylko nowa migracja, nowy test Day197, dopisany A8 + jedna korekta daty w A4
oraz ten raport. Zero zmian w `src/`, `server/src/`, trasach, middleware i
bramie 409. Runner nie powstał, ponieważ jego zamówiony łańcuch jest
nieprzechodni; pozorny runner byłby atrapą.

## Z30

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało
wysłane.

## TWIERDZENIA NIEZWERYFIKOWANE

- Realny denominator M3 nie został zmierzony z powodu Z28.
- Liczba tabel zapisywanych w jednej transakcji nie została zmierzona runtime;
  statyczny odczyt wskazuje pięć tabel dla `execution.task.create`:
  `ie_aggregate_state`, `ie_aggregate_relations`, `ie_audit_events`,
  `ie_outbox_events`, `ie_command_receipts`.
- Zmieniony `correlationId`, kolizja relacji z nowym `clientRequestId`, realny
  readback `dueAt` oraz forward repair nie zostały zmierzone, ponieważ R2b
  zatrzymał się przed utworzeniem domu i zadania.
- Aktor pilotażowy nie jest kontem systemowym; konto systemowe wymaga decyzji.
- Test day160 nie został w tym dyżurze ponownie sprawdzony ani zmieniony.
