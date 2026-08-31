# CODEX DAY204 — MIGRACJA E2 — RAPORT

Werdykt: **PARTIAL / STOP MERYTORYCZNY R2b i R3 task-create**. R1 wykonane,
bezpieczniki i księgowanie runnera wykonane, pełna budowa domu kanonicznego
oraz migracja choć jednego zadania pozostają `NOT_PROVEN`.

## Stan wejścia

- marker: `c7f13f588f35f2b761eea02c83f612dcdd215f7c`;
- migracje wejściowe: 871/0; po migracji Day204: 872/0;
- `DAY161_FRESH_MIGRATION_GATE=PASS` pochodzi ze stdout procesu bramki;
- walidator nazw: 92 przed i 92 po;
- zasoby: Postgres 6144; runtime 5078/5079 nie był potrzebny.

## R1 — dwie miny

Test realDB 3/3. Podmiana odcisku paragonu na algorytm obejmujący
`correlationId` spowodowała `MaterialCommandConflictError`, nie `REPLAYED`.
Wybrano wariant B: nowa tabela `legacy_task_cutover_step_ledger`; nie zmieniono
globalnego fingerprinta. Na symulacji „commit polecenia, brak wpisu ledgera,
ponowienie z nowym request ID” pierwszy strzelił `aggregate version conflict`;
`prepare` wykonał się raz, relacja pozostała pojedyncza. `claimRelation` ma 20
producentów plikowych, ale nie znaleziono osiągalnej kolizji na zmierzonej
ścieżce, więc kod produkcyjny pozostał nietknięty.

Commit/push R1: `b622be0ac3` na `github-backup/codex/day204-migracja-e2-20260831`.

## R2 — runner

Zaimplementowano: dry-run, `requireConfirmation`, dokładnie 1 inicjatywa bez
`--confirm-batch`, sufit 10, rozłączność `--initiative-id`/`--batch-size`,
ścisłe A3, jawne `--owner-fallback` i `--sla-offset-days`, deterministyczny
request ID i checksum, `SKIPPED/PERSONAL_NO_INITIATIVE`, szeregowe
`execution.task.create` do istniejącej aktywnej sprawy oraz naprawę selektora
do przodu. Test bezpieczników: 6/6.

### STOP — R2b pełny dom kanoniczny

Rodzaj: MERYTORYCZNY.
Powód: pełny przechodni łańcuch governance nie został wykonany; runner jawnie
zwraca `CANONICAL_HOME_MISSING`, gdy brak aktywnej sprawy.
Licencja, którą sprawdziłem: runner i wszystkie domenowe handlery były
licencjonowane; surowe zapisy do kanonu oraz obejście lifecycle były zakazane.
Dowód: lokalna miniatura ma 3 inicjatywy legacy, 0 aktywnych spraw i 0 zadań
kwalifikowalnych w ścisłym A3.
Co dostarczyłem ZAMIAST zmiany: bezpieczny runner dla istniejących domów,
blokadę fail-closed i dolną granicę kosztu.
Co zrobiłbym po decyzji: użył dwóch jawnych tożsamości governance i wykonał
pełny łańcuch z quorum/signoff; nie używałbym `selfApprovalAllowed` bez decyzji.
Rekomendacja: decyzja właściciela o SLA fallback i aktorach governance przed
pilotem stagingowym.
Stan: częściowo w `81486fa20f`, push wykonany.
Czy kontynuowałem: TAK, do R3.

## R3 — lokalna miniatura M3

- 3 inicjatywy, po 2 zadania; 2 zadania personalne;
- wszystkie 8 bez SLA; część bez ownera i due date;
- dry-run: ledger 0 przed i 0 po;
- `--write` bez dokładnego potwierdzenia: exit 1;
- pilot bez `--confirm-batch`: dokładnie 1 inicjatywa;
- partia potwierdzona `--batch-size 2`: pozostałe 2 inicjatywy;
- ledger: 8 `SKIPPED`, `unmatched=0`; reason codes: owner 3, SLA 2, due 1,
  personal 2;
- ponowienie: checksum przed/po identyczny
  `9303ae10fb3081ede18eb81b3c2ba42a`;
- limiter po mutacji: 5/6, po przywróceniu: 6/6.

Nie ma wyniku `REPLAYED` material-command ani odczytu
`postgresInitiativeReader.listExecutionTasks`: ścisłe A3 zakwalifikowało 0
zadań, więc twierdzenie o nich pozostaje `NOT_PROVEN`.

## DLA WŁAŚCICIELA — CO SIĘ ZMIENIŁO OD KARTY 197

1. `N`: `NOT_PROVEN`; statyczna podłoga wynosi co najmniej 54, nie „≥16”.
2. Dolna granica rachunku: `54 × 53 … 54 × 67 = 2862 … 3618`; to nie jest
   wynik runtime.
3. Ścisłe A3: **0 z 467**, ponieważ cudzy pomiar M3 wykazał 467/467 bez SLA.
4. `batch_id` nie jest bezpiecznym kluczem ponowienia. Bezpieczny klucz kroku
   jest w addytywnym `legacy_task_cutover_step_ledger` (wariant B).

## Korekty wobec instrukcji

- Test limitera wymagał mutacji miejsca normalizacji `batchSize`, nie tylko
  funkcji zwracającej limit; pierwsza mutacja była za płytka i pozostała
  zielona. Druga dała wymagane czerwony 5/6 → zielony 6/6.
- `N` nie został „zmierzony”, ponieważ nie wykonano pełnego domu; 54 jest
  statyczną podłogą i nie zastępuje pomiaru.

## TWIERDZENIA NIEZWERYFIKOWANE

1. Pilot stagingowy nie został wykonany: Z28 i D-13 powierzają go nadzorcy.
2. Liczba paragonów unieważnianych wariantem A nie była mierzona na stagingu;
   lokalnie dowiedziono mechanizm na jednym paragonie.
3. Kolizji PK relacji nie odtworzono; na zmierzonej ścieżce pierwszy był CAS.
4. `N=54` jest niepełną statyczną podłogą, nie pomiarem przechodniego łańcucha.
5. `dueAt` nie przeszedł realnego `listExecutionTasks`, bo 0 zadań migrowano.
6. Aktor migracji nie jest zatwierdzonym kontem systemowym; niezależnego
   autorytetu nie rozstrzygnięto.
7. Pozostawienie personalnych w legacy jest rekomendacją A5(ii), nie decyzją.
8. Stan przypięcia testu Day160 do `cx160` nie był naprawiany w tym dyżurze.

## Z30

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało
wysłane.

## Artefakty

Artefakty leżą wyłącznie w
`/private/tmp/cx-day204-migracja-e2-artefakty`; ich sumy SHA-256 są mierzone
przy zamknięciu. Zrzutów ekranu nie wykonywano.
