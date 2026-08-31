# CODEX DAY216 — atomowosc i odwracalnosc migracji legacy tasks

Stan: **R1 ZROBIONE / R2 ZROBIONE / R3 STOP MERYTORYCZNY**.

Galaz: `codex/day216-odwracalnosc-20260831`  
Marker: `fe33ce8036`  
Pierwszy commit i push: `acea44e55a` na `github-backup`.

## Baza pracy i rozjazd

Wynik markera, doslownie:

```text
MARKER OK
```

Wynik sanity, doslownie:

```text
fe33ce80360ac0b6751a5f605d6c758853a4dfa3
```

Tip `github-backup/codex/m03-admin-20260824` byl do przodu do `0a84c3d1b0`.
Pracowalem zgodnie z instrukcja dokladnie z markera. Diff tipa nie obejmowal
plikow produktowych licencjonowanych dla dnia 216.

Wolne miejsce: `9.2 GiB`. Porty `6156`, `5102`, `5103`: brak listenerow.
Kontener: tylko `cx-day216-pg`, `127.0.0.1:6156`, obraz
`pgvector/pgvector:pg16`.

## Korekty wobec instrukcji

1. Runner mial 452 linie — zgodnie z T1.
2. AST TypeScript policzyl na bazie 24 metody `MaterialCommandTransaction`, nie
   21. Po R1 ma 25. Prosty grep `): Promise<` dawal mylace 27.
3. Bazowo bylo 105 wystapien wywolania `executeMaterialCommand`; po nowym
   wołaczu jest 106. Produkcyjnych plikow pod bounded contextem jest 43, nie
   okolo 46.
4. T2-T6, T8, T10-T12 potwierdzily sie. `case_version_after` rzeczywiscie
   zawiera wersje `execution_task` (`1`), nie wersje `execution_case`.
5. `milestoneIds: []` oraz petla po `task.milestoneIds ?? []` potwierdzaja brak
   mutacji milestone na tej sciezce.

## R1 — atomowosc

Dodano jedna waska metode `appendLegacyTaskCutoverLedgerEntry` do transakcji i
jej jedynego produkcyjnego implementatora. Domkniecie tworzenia taska zostalo
wyodrebnione jako `prepareExecutionTaskCreation`; nowa funkcja
`createExecutionTaskForLegacyCutover` zapisuje ledger przez ten sam `tx`.
`executeMaterialCommand` nie zostal zmieniony. Nie zastosowano `PENDING`.

Realny test wymusza blad UNIQUE wewnatrz tej samej transakcji, po aktualizacji
case/relacji przygotowywanej przez domkniecie, przy wpisie ledgera. Readback:
brak taska, relacji, audytu, outboxu, receipt i zmiany case. Test zielony.

Mutacja odwrotna: usuniecie wywolania atomowego wpisu ledgera:

```text
MUTATION_EXIT=1
expected [ 'MIGRATED' ] to deeply equal [ 'FAILED' ]
```

Po odtworzeniu: pakiet R1 zielony.

Regresje FIX-204 po zmianach:

- usuniecie `NOT EXISTS` (Guard A): czerwien; oczekiwano task B, ponownie
  wybrano task A;
- usuniecie checksum continue (Guard B): czerwien;
  `clientRequestId was already used for a different command target`;
- po odtworzeniu oba testy zielone.

Ocena R1: atomowosc runnera **PROVEN**. Zewnetrzne zachowanie
`createExecutionTask` jest **PARTIAL**: zastany
`executionWork.realdb.test.ts` pozostal skipem (tak samo przed zmiana), wiec nie
jest dowodem. Regresje runnera przechodza przez wyodrebniona funkcje i sa
zielone, ale nie zastepuja dedykowanego pakietu trasy.

## R2 — FAILED i kontynuacja

`MigrateOutcome` zawiera `FAILED`. Petla zapisuje stabilny kod:
`CANONICAL_HOME_MISSING`, `CHECKSUM_CONFLICT` albo `MIGRATION_ERROR`, po czym
kontynuuje. `FAILED` nie jest automatycznie ponawiany: istniejacy fail-closed
`NOT EXISTS` wymaga interwencji operatora. Schemat nie byl zmieniany.

Test partii dwoch rekordow: pierwszy `FAILED/CANONICAL_HOME_MISSING`, drugi
`MIGRATED`. Mutacja usuwajaca `try/catch`:

```text
MUTATION_EXIT=1
Error: CANONICAL_HOME_MISSING:day216-failed-org:a-missing
```

Po odtworzeniu pakiet R2 zielony.

## STOP — R3 sciezka cofniecia partii

Rodzaj: **MERYTORYCZNY**.  
Powod: ledger nie przechowuje poprzedniego `payload_json` agregatu
`execution_case` ani informacji, czy `rollup` przed migracja istnial.  
Licencja, ktora sprawdzilem: nowa migracja `20261723_*` jest dozwolona w tabeli
licencji wylacznie dla wariantu statusu `ROLLED_BACK`, nie dla dodania snapshotu
payloadu. Istniejace migracje `20261721` i `20261722` sa tylko do odczytu.  
Dowod: prototyp migracja dwoch taskow -> cofniecie przywrocil wersje `1` i
liczniki `0`, lecz logiczny diff pozostal czerwony, bo przed migracja payload
nie mial pola `rollup`, a po cofnieciu mial:

```diff
+ "rollup": {
+   "decisionsDecided": 0,
+   "decisionsPending": 0,
+   "tasksBlocked": 0,
+   "tasksCompleted": 0,
+   "tasksTotal": 0
+ }
```

Co dostarczylem zamiast zmiany: realny czerwony kontrakt/diff i pomiar szesciu
tabel. Pozorny rollback zostal usuniety przed commitem; nie dopisalem
nieprawdziwego wyjatku do planu kanonicznego.  
Co zrobilbym po decyzji X: addytywna kolumna/snapshot poprzedniego payloadu
case zapisywana atomowo z ledgerem, nastepnie rollback z CAS i odtworzeniem
snapshotu. Wymaga to jawnego rozszerzenia licencji migracyjnej i decyzji o
retencji snapshotu.  
Rekomendacja dla nadzorcy: rozszerzyc osobny dyzur o licencje na nowa migracje
snapshotu; nie uruchamiac pilota wymagajacego destrukcyjnego odwrotu do czasu
tej decyzji.  
Stan: R3 nie zacommitowano. R1/R2 zacommitowano w `acea44e55a`.  
Czy kontynuowalem pozostale pozycje: TAK — R1/R2 i ich mutacje sa kompletne.

## Pomiar nazw testow

Przed: 18 nazw, 17 pass, 1 zastany skip.  
Po: 20 nazw, 19 pass, 1 ten sam zastany skip, 0 failed.

Dodane nazwy:

```text
Day216 FAILED ledger continuation records one stable FAILED reason and continues to migrate the next task
Day216 atomic legacy task cutover rolls back all canonical writes when the ledger insert fails inside the transaction
```

Nazwy znikniete: brak. Pliki:
`/private/tmp/cx-day216-odwracalnosc-artefakty/przed-nazwy.txt` i
`po-nazwy.txt`.

Pulapki Z33: pakiety sa CLI/domain, bez HTTP, JWT i bramek (a), (b), (d).
Pulapka (c) zostala wylaczona pelnym env w tej samej linii oraz asercja
`DB_TYPE === 'postgres'` w obu nowych pakietach. Pulapka (e) byla centralna:
rozszerzono transakcje, nie dyspozytor; nie uzyto `PENDING`; R3 zatrzymano po
realnym diffie zamiast uznac licznikowy odwrot za pelne odtworzenie.

## Migracje i Z30

Pierwszy przebieg pelnych migracji: `Postgres migrations complete`. Drugi:
`Applying migrations: 0`. `settings WHERE key LIKE 'smtp%'`: 0 wierszy.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało
wysłane.

## TWIERDZENIA NIEZWERYFIKOWANE

1. R1a zbudowano wg rekomendacji nadzorcy, z realnym wyjatkiem wewnatrz
   transakcji; wyjatek nastepuje przy wpisie ledgera po przygotowaniu
   case/relacji, ale przed glownym `persistAggregate`/audit/outbox dyspozytora.
2. Oba strazniki FIX-204 zmierzono wlasnymi mutacjami — nie przepisano wyniku.
3. `FAILED` zapisuje stabilny kod, nie pelny komunikat. Automatyczny retry jest
   celowo wylaczony.
4. R3 rozstrzygnieto STOP-em; planu kanonicznego nie zmieniono.
5. Liczby metod i wolaczy policzono lokalnie (AST/grep), nie z instrukcji.
6. Pelny cykl R3 nie przeszedl: diff po cofnieciu byl czerwony. Ponownej
   migracji po rzekomo identycznym stanie nie uznano za dowod odwracalnosci.
7. `case_version_after` zweryfikowano w kodzie jako niewiarygodne dla wersji
   case.
8. Dedykowany `executionWork.realdb.test.ts` byl skipem przed i po; zachowanie
   zywej trasy nie jest w tym dyzurze udowodnione tym pakietem.

## Artefakty

- `migrations-first.txt`, `migrations-second.txt`
- `przed.json`, `po.json`, `przed-nazwy.txt`, `po-nazwy.txt`
- `mutacja-r1-red.txt`, `mutacja-r2-red.txt`
- `mutacja-guard-a-red.txt`, `mutacja-guard-b-red.txt`
- `after-mutations-green.txt`

Wszystkie sa poza repo w
`/private/tmp/cx-day216-odwracalnosc-artefakty/`.

SHA-256 w kolejnosci listy: `1818107413d668dcd3b28187e76bec18537bbe88b5d4bc67120eed156bc4de5d`,
`1d171b98774a3f6f3d21b59a114930eaf1e918a5466e6604032977bba215147f`,
`fb2ce6c04dc0341f5fb02889cc6d0b5e2a6ab99edd3697c6ade63d95a018180c`,
`d50a37698d46aee65f0189ff7c35fa55cae61e01bb88de355e214d0fe452eea6`,
`ba1472e4125d500faecd733b378523b077ed2bb5ce3777d24e88c2dfbe2e07d0`,
`b201eea10eaa6c3e3f338ff2f9e326dac10dad92d9496001d0a6bedf533eeca3`,
`827e5f50139eee7d70559442ca2f74fa73d54f59c1a1507c43d607b26a9a8a37`,
`9ec74155e460bbb33bbc4eb10d2a92a6de8f0f23d42742c695861b8a59d996a9`,
`ca63bddd23bcafbe6acfdefcc2e33a98156a86ef01b18c06e8733a883bda74f6`,
`81145151add536ca29c1b318097a43231e883e6d17b732caf709ea110c53d45c`,
`edce94e156195216b4ceb280212bc5ea5bceda914c909c3c00a61d9d1aafaeb2`.
