# RAPORT — CODEX3 — Finanse MINIMUM (F-M2/M3/M4/M6/M7)

## 0. Metryka

Marker: `19440011e9` · gałąź: `codex/finanse-minimum-20260911`.
SHA po etapach: E1 `072e62c607` · E2 `dc35ce7d2a` · E3 `4958b7efd7` · E4 `599d4e0ca3` · E5 `NIE WYKONANO` · E6 `NIE WYKONANO` · E7: commit zawierający ten raport (SHA należy odczytać z `git log -1`; hash commita nie może być treścią własnego drzewa bez nieskończonej zmiany hasha).

`git merge-base --is-ancestor 19440011e9 HEAD` → `BAZA OK — marker jest przodkiem HEAD`.
Wejściowe `git rev-parse HEAD` → `19440011e9132577c8f3a6d1704ec00ddc1da8e4`; `git status --short` → pusty.
Kontener/baza/porty: `cx-codex3-pg` / `cx_codex3_finanse` / `6453`, `5593`.
Migracje: pierwszy przebieg zakończony `Postgres migrations complete`; drugi przebieg `Applying migrations: 0` i `Postgres migrations complete`.
`check-freeze.sh` przed pierwszym commitem: `EXIT=0`. E3 wymagał `[ODMROZENIE WSPOLNE DEC-399]` dla klienta API i typów.

## 1. K-PUNKTY — PRZED i PO

| K | Co mierzę | PRZED (mój pomiar) | PO (mój pomiar) | Komenda |
| --- | --- | --- | --- | --- |
| K1 | klasy crimson | 34 (autor 34) | 34 | `grep -rn "primary-" ... \| wc -l` |
| K2 | nieoznaczone `<table>` | 14 (autor 14; F1 13) | 14 | `grep -rn "<table" ... \| grep -v "§27-exempt" \| wc -l` |
| K3 | BV wg statusu | 0 na świeżej bazie (autor: DRAFT 18) | DRAFT 6, IN_REVIEW 0, APPROVED 0; rekordy fikstur E2 | `SELECT status,count(*) ... GROUP BY 1` |
| K4 | trasy lineage | 4 GET, 0 bulk (autor: 1 lineage GET) | 4 GET + 1 bulk POST | `grep -n "router.get\|router.post" crosscutting.routes.ts` |
| K5 | `<aside>` w karcie | 0 (autor 0) | 0 | `grep -c "ArtifactRightPanel\|<aside" ...` |
| K6 | struktury derywacji | 0 jawnych sekcji | 3: `profitAndLoss`, `balanceSheet`, `cashFlow` | test `returns separate P&L...` |
| K7 | wiersze bez źródła | 0 danych na świeżej bazie | nie zmierzono na liście legacy | wymaga mostu legacy→kanon |
| K8 | zastane czerwone testy | 29 (autor podał cudze 27) | 29 | JSON `przed-front.json` / `po-front.json` po `fullName` |

## 2. Stan wejściowy — 12 komend z §0.1a

1. Crimson: `34` (autor `34`). 2. Nieoznaczone tabele: `14` (autor `14`). 3. `financeEnums.ts` istnieje. 4. Dwa produkcyjne inserty kalendarza/okresu: `financeCalendarService.ts:221,344`. 5. `ROUTABLE_ACTIONS`: 7, bez approve/reopen. 6. Fetchery lifecycle są w workspace; pasek nie zawiera akcji. 7. `crosscutting.routes.ts`: cztery zastane GET, brak bulk. 8. Shell: `0`; workspace ma żywy render w `FinanceHub`. 9. Źródła CD PROJEKT istnieją. 10. Ciche catch: `7`. 11. Freeze: `EXIT=0`. 12. `PORTY WOLNE`, `BRAK KONTENERA`, zajęte migracje z przedziału: `0`. Surowy wynik: `/Users/piotrwisniewski/Developer/codex-wt/codex3-artefakty/stan-wejsciowy-12-komend.txt`.

## 3. Etapy — po jednej sekcji na etap

### E1

Wykonano 8 jawnie czerwonych kontraktów (`it.fails`). DoD częściowy: kontener, dwie migracje, 17 mianowników i `przed-nazwy.txt` są; faktyczny dług to 29 testów. Pułapki §0.2e: testy statyczne nie dowodzą egzekucji i nie są tak raportowane. SHA `072e62c607`.

### E2

STOP MERYTORYCZNY. Realny `ApiGateway`, podpisany JWT, `ENABLE_V8_GLOBAL=true`, `ENABLE_TEST_AUTH_BYPASS=false`, RealPG. Dwa testy przechodzą (PG/env i realne `401`), sześć czerwonych kontraktów poprawnie wykazuje `403 BETA_LOCKED` przed utworzeniem pakietu. Pułapka §0.2e(b) została zmierzona: `FINANCE_ADMIN` ma rolę domenową, ale nie jest zwolniony z zamkniętej bety; OWNER/ADMIN przechodzi betę, lecz mapuje się na `approver`, nie `preparer`. Nie zmieniono chronionych bramek. SHA `dc35ce7d2a`.

### E3

Wykonano organizacyjnie zawężony bulk-read `POST /versions/lineage-edges/bulk-read`, limit 100, walidację, nazwy artefaktów, klient i DTO. Wybrano osobną ścieżkę, bo `/versions/lineage-edges` jest już append-only POST-em tworzącym krawędź. Realny `ApiGateway` + JWT + RealPG: 8/8. Front STOP: lista niesie ID legacy, nie kanoniczne BV; pułapka §0.2e(e) zakazuje użycia go wprost. SHA `4958b7efd7`.

### E4

PARTIAL. Czysta funkcja zwraca trzy sekcje, okres porównawczy, flagę sumy, głębokość i `NO_MAPPED_LINES`; 33/33 testów. Nie osadzono shell/aside ani flagi bez dowodu identycznego drzewa OFF. Pułapki bramek nie dotyczą czystej funkcji; dowód: pakiet ma `RUN_DB_TESTS=0 MOCK_DB=true` i nie importuje Gateway/DB. SHA `599d4e0ca3`.

### E5

NIE WYKONANO. Pomiar i lista 34/14 dostarczone; etap wymaga 23 wysokokolizyjnych miejsc i commitów per plik. Nie wykonano mechanicznej czystki kosztem rdzenia.

### E6

NIE WYKONANO. Nie utworzono skryptu, nie wykonano apply, nie powstał manifest. Z41/Z42 nie zostały naruszone.

### E7

Wykonano raport z 15 sekcjami. Liczby mają komendy lub jawne `nie zmierzono`.

## 4. Dowody mutacyjne (Z32)

1. E3 scope: kopia przez `cp`; mutacja parametru organizacji na `MUTATED_ORG_SCOPE`; `mutacja-e3-org-red.json` → 1 failed (`returns one organization-scoped...`); przywrócenie `cp`; zielony `e3-lineage.json` → 8/8; diff pusty.
2. E4 empty: mutacja `emptyReason: null`; `mutacja-e4-empty-red.json` → 1 failed (`honest emptyReason...`); przywrócenie `cp`; `e4-derive.json` → 33/33; diff pusty.
3. E4 CF: mutacja filtra CF na zawsze pusty; `mutacja-e4-three-red.json` → 1 failed (`returns separate P&L...`); przywrócenie `cp`; `e4-derive.json` → 33/33; diff pusty.

## 5. Pomiar zasięgu testów (§0.4a, Z24)

PRZED: 744 nazwy, 715 passed, 29 failed. PO: 750 nazw, 721 passed, 29 failed. Dodano 6 nazw testów derywacji; zniknięte: **0**. Pełny diff: `/Users/piotrwisniewski/Developer/codex-wt/codex3-artefakty/diff-przed-po-nazwy.txt`. Lista 29 zastanych czerwonych jest identyczna przed/po (`przed-failed-nazwy.txt` i `po-failed-nazwy.txt`, ten sam SHA-256).

## 6. Deklaracja Z30

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego bloku nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. `ie_outbox_delivery_receipts` po przebiegach ma 0 wierszy. Żaden e-mail, zaproszenie kalendarzowe ani powiadomienie nie zostało wysłane.

## 7. Dane pokazowe — manifest (E6)

E6 niewykonane: manifest nie istnieje, więc nie ma `ls`, sumy, apply/rollback ani verify. Nie uruchomiono seedu i nie wpisano danych pokazowych.

## 8. Korekty wobec instrukcji i wobec F1

- F1 §F-M5 §3 jest nieaktualne: są dwa produkcyjne INSERT-y (`financeCalendarService.ts:221,344`).
- Tabel jest 14, nie 13; instrukcja CODEX3 podaje poprawne 14.
- Kod używa `READY_FOR_REVIEW` po submit, następnie `IN_REVIEW` po start-review; zatwierdza wyłącznie z `IN_REVIEW`.
- Siedem wskazanych plików leży w `Economics/`, nie `Finance/`.
- Na świeżej bazie nie ma 18 DRAFT; było 0. Po fiksturach zostało 6 DRAFT, bo kontrakt E2 zatrzymał BetaGate przed tworzeniem nowych pakietów, a wcześniejsze nieudane próby zostawiły wyłącznie fikstury organizacyjne/artefaktowe.
- Zastany dług testów to 29, nie cudze 27.

## 9. STOP-y

### STOP — pozycja Finansów w menu
Rodzaj: MERYTORYCZNY. Powód: decyzja właściciela. Licencja, którą sprawdziłem: `betaMenuStatus/menuConfig/AppRoutes — TYLKO ODCZYT`. Dowód: `MODULE_ECONOMICS='closed'`, `BETA_ADMINS_EXEMPT=true`. Co dostarczyłem ZAMIAST: pomiar; otwarcie wymaga zmiany SSOT i synchronizacji lustra. Po decyzji X: zmienić wartość w SSOT i uruchomić generator, potem kwalifikować role. Rekomendacja: nie łączyć tej decyzji z integracją backendu. Stan: nie zacommitowano zmiany menu. Kontynuacja: TAK.

### STOP — E2 osiągalność preparera
Rodzaj: MERYTORYCZNY. Powód: `FINANCE_ADMIN` dostaje `403 BETA_LOCKED`, a role zwolnione z bety nie mają roli `preparer`. Licencja: auth/Gateway/betaGate/effectiveAccess — TYLKO ODCZYT. Dowód: `e2-approval.json`. Co dostarczyłem ZAMIAST: czerwony kontrakt realnego ApiGateway. Po decyzji X: uzgodnić mapowanie roli lub zwolnienie z bety, następnie uruchomić ten sam test bez `it.fails`. Rekomendacja: naprawa centralna z audytem wszystkich akcji capability. Stan: kontrakt w `dc35ce7d2a`. Kontynuacja: TAK.

### STOP — E3 przewód listy
Rodzaj: MERYTORYCZNY. Powód: lista ma ID legacy, bulk wymaga BV ID. Licencja: most/aliasy Codex 2 poza zakresem. Dowód: `FinanceHub.tsx` mapuje `statement.id`; pułapka §0.2e(e). Co dostarczyłem ZAMIAST: gotowy backend, klient i DTO. Po decyzji X: konsumować kanoniczne BV zwrócone przez most, jednym bulk requestem. Rekomendacja: scalić po odbiorze Codex 2. Stan: backend zacommitowany. Kontynuacja: TAK.

## 10. TWIERDZENIA NIEZWERYFIKOWANE

- Nie udowodniono wizualnie shell E4, kolumny źródła ani E5; zrzuty były zakazane.
- Nie udowodniono pełnego APPROVED przez ApiGateway; czerwony kontrakt zatrzymał się na BetaGate.
- Nie wykonano seedu, idempotencji, verify ani rollback E6.
- Nie mierzono poprawności finansowej roll-upów; obecna funkcja oznacza kanoniczne wiersze sumaryczne, nie tworzy księgowych wartości.

## 11. DO DECYZJI WŁAŚCICIELA

- Pozycja Finansów w menu: zabrakło decyzji, czy `MODULE_ECONOMICS` otworzyć wszystkim, czy pokazać jawne „wkrótce”.
- Trzy `recoverable` i pięć `pending`: zabrakło dostępu do stagingu (słusznie zakazanego) i decyzji retencyjnej.
- Polska nazwa istniejącego pakietu pokazowego: zabrakło decyzji, czy migrować zastany rekord; E6 miał tworzyć nowy EN bez zmiany starego.
- Rola preparera za zamkniętą betą: zabrakło decyzji o centralnym mapowaniu/uprawnieniu.

## 12. ZNALEZISKA POBOCZNE

Siedem zastanych cichych catch: `FinanceSavedViewsPanel.tsx:118`; `FinanceHub.tsx:1283,1284,1285,1287,1288,1290`. Nie zmieniano. Dla Codex 2: lista legacy nie dostarcza kanonicznego BV bez mostu; podanie `statement.id` do E3 byłoby fałszywą 404. Baseline/Wycena: nie mierzono i nie dotykano.

## 13. CO ZOSTAJE DLA ROBOTNIKA WEWNĘTRZNEGO

Po integracji mostu: lokalnie włączyć `VITE_FINANCE_MINIMUM` i sprawdzić listę Sprawozdań (nazwa źródła lub uczciwy brak), kartę pakietu (P&L/Bilans/CF i jeden aside) oraz ekrany E5 (brak crimson). Ta gałąź nie zawiera jeszcze przewodów/shella/flagi, więc nie jest gotowa do tego przeglądu.

## 14. Artefakty

Katalog: `/Users/piotrwisniewski/Developer/codex-wt/codex3-artefakty`. Najważniejsze sumy SHA-256: `e3-lineage.json` `1f6c002d...`; `e4-derive.json` `54be3dac...`; `przed-front.json` `d143a547...`; `po-front.json` `84f8b5f8...`; `diff-przed-po-nazwy.txt` `9b17b1ca...`; `stan-wejsciowy-12-komend.txt` `d32ccdcf...`; `migracje-przebieg-1.txt` `75630dd6...`; `migracje-przebieg-2.txt` `9282e627...`. Pełna lista: `shasums.txt`.
