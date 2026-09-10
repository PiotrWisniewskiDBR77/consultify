# Audyt pojemnika 1 — 10.09.2026

Stanowisko: `/Users/piotrwisniewski/Developer/wt/audyt-p1`, gałąź `audyt/pojemnik1-20260910`,
baza `58e53f923a68f5607b1d4afb7ce0862546a8a351`. Metoda: pomiar bezpośredni (komendy, pliki
w repo, żywe `/api/health`, zmienne Railway per environment przez `railway variables`
tylko-do-odczytu) — nie streszczenie dokumentów. Wszystkie liczby poniżej mają dowód
podany przy kryterium.

## Werdykt jednym zdaniem

**Pojemnik 1 NIE jest zamknięty.** Jedno kryterium jest zmierzone jako wprost niespełnione
(S1.2 — otwarty WAŻNY defekt), jedno strażnik-kryterium (S1.8) łamie własną zasadę
„dług nie rośnie” (i18n: 60 nowych naruszeń), a S1.1 i S1.9 mają realny dowód techniczny,
ale nie w formie i nie w świeżości, jakiej wymaga kryterium — reszta rozkłada się między
rzetelnie zmierzone „tak” a zadeklarowane bez dzisiejszej weryfikacji.

## Tabela

| # | Kryterium (skrót) | Werdykt | Dowód (ścieżka/komenda/liczba) | Kto musi domknąć |
|---|---|---|---|---|
| S1.1 | 16 modułów, każdy z „Tak” właściciela | SPEŁNIONE (zadeklarowane, forma niezgodna z kryterium) | `01_INDEKS_I_HARMONOGRAM.md:365` DEC-452 (07.09 07:29): cytat właściciela „Ja już przeklikałem ekrany… OK ze wszystkimi modułami” → rejestr wprost zapisuje `S1.1 = tak`. Ale to JEDNA zbiorcza wypowiedź, nie 16 kart „jeden obraz, Tak” na porcie 3100, jak wymaga artefakt kryterium — takich 16 osobnych kart nie znalazłem w repo. Dodatkowo `RAPORT_KONCOWY_20260910.md` (commit z dziś, 06:14) w sekcji „Do paczki 2” pozycja 1: „Przejście właściciela po systemie — jedyna pozycja niewykonalna bez niego” — trzy dni PO DEC-452 nadzorca traktuje pełne przejście jako wciąż niewykonane | właściciel + nadzorca (ujednolicić: albo dorobić 16 kart, albo świadomie przyjąć zbiorcze „Tak” jako wystarczające) |
| S1.2 | Zero otwartych BLOKER/WAŻNY z przejścia | **NIESPEŁNIONE** | `01_INDEKS_I_HARMONOGRAM.md:351,365` — 07.09: „deduplikacja po tytule UKRYWA realny dokument” (`artifact-b4ad328c` z poprawnymi wpisami źródłowymi znika z listy pod `artifact-ab8dbf5c`, bo oba mają `title_snapshot = Nowy dokument`); nadzorca sam klasyfikuje to jako WAŻNY wprost dotykający pilotażu 4 osób i pisze: „kryterium 1 pozostaje NIESPEŁNIONE mimo odbioru modułów… Nie przestawiam go na zielono na podstawie samego OK”. Grep `artifact-b4ad328c`/`duplicateCount` w repo na dziś nie pokazuje żadnego wpisu naprawczego po 07.09 | nadzorca (naprawa) + weryfikacja przed pilotażem |
| S1.3 | KPI poza limitem → Skrzynka → karta → zadanie, żywo | SPEŁNIONE (zmierzone przeze mnie — realne artefakty) | `01_INDEKS_I_HARMONOGRAM.md:77,91`: e2e 2/2 + PG 3/3 (3 mutacje), merge `0bfeed97bb`; owner „1 TAK” (karta 6) 06.09. Zweryfikowałem sam pliki `evidence/p7k-b/{00..03}*.png` + sidecar `.json` — `"bledyKonsoli": []`, `"odpowiedziHttp": []`, realny zrzut Skrzynki z kartą odchylenia KPI. Zastrzeżenie: zrzut z `127.0.0.1:3105` (stanowisko lokalne), nie ze stagingu | brak — mechanika potwierdzona; ewentualnie powtórzyć na stagingu przy 1.9 |
| S1.4 | Dokument + prezentacja z szablonu jako PLIK, zaakceptowane | SPEŁNIONE (zmierzone przeze mnie) | Pliki realne w repo: `evidence/dokument-plik-20260906/DBR77_Raport_z_oceny_DRD.docx` (258 KB, „Microsoft Word 2007+” wg `file`), `DBR77_Prezentacja_z_oceny.pptx` (563 KB, prawdziwe ZIP/OOXML), `.pdf` (57 KB, 14 stron) — otworzyłem/zweryfikowałem magic bytes. Akcept: `01_INDEKS_I_HARMONOGRAM.md:60`, 06.09 10:20, cytat właściciela: „raporty powiedzmy 3,5 w skali do 6, ale na MVP wystarcza” | brak dla MVP; polerowanie treści (39 zdań „brak treści”) świadomie odłożone do pojemnika 2 |
| S1.5 | Jeden prawy panel (Rekord\|Teresa) na 8 listach, 1280/1440/1920 | SPEŁNIONE częściowo (zadeklarowane + częściowo zmierzone) | Mechanika wdrożona: `1.1-K6` (`01_INDEKS_I_HARMONOGRAM.md:234`) — 23 ekrany, 13 plików/85 testów zielonych, zrzuty klik→X→klik (Wywiad, Ocena). Owner „Tak” per konkretne karty: karta 2 (Skrzynka, 06.09 10:35), karta 3 (inicjatywa+Teresa, 06.09 11:00). Ale w repo NIE znalazłem jednego kompletnego zestawu „8×3 zrzuty na żywo” (8 list × 3 szerokości) w formie wymaganej przez kryterium — pozycja `1.9` (re-audyt) miała to domknąć; brak w rejestrze wpisu zamykającego `S1.5 =` | Sonnet/nadzorca — zestaw 8×3 zrzutów na stagingu |
| S1.6 | Teresa PL + źródła w każdym module MVP | SPEŁNIONE (zmierzone, ale LOKALNIE nie na stagingu) | `evidence/teresa-16/` — 16 par PNG+JSON w repo, `RAPORT.md`: „13/13 modułów z wejściem: PASS (PL, `used_sources>0` lub „Brak danych w module”)”; 3 moduły (Administracja, Ustawienia, Partner) bez ekranu-artefaktu = świadomy STOP poza MVP. Zmierzone na stanowisku lokalnym `consultify_noc:54400`, NIE na żywym stagingu — organizacja miała podniesiony limit AI (`organization_type=PAID`) tylko lokalnie | Sonnet — powtórzyć pomiar 16 modułów na stagingu w ramach 1.9 |
| S1.7 | Dane właściciela czyste (oceny, śmieci, Silesia, legacy 2024) | SPEŁNIONE częściowo w przeszłości, NIE zweryfikowane na dziś | Realna czystka 06–07.09 z dowodami w repo: `evidence/higiena-danych/` (31 plików: manifesty JSON + CSV kopii przed operacją), `S1.7 = TAK` zapisane 06.09 11:02 (apply 391 rekordów, drugi apply=0, rollback dostępny). ALE: (a) dowód dry-run na stagingu referencjonowany jako `/private/tmp/stanowisko-noc/higiena-staging-dryrun.txt` **NIE ISTNIEJE** — sprawdziłem `ls`, plik wyparował (pułapka „dowód poza repo wyparowuje” potwierdzona ponownie); (b) `KONTROLA PO NAPRAWACH… 09.09 22:00` (linia 435) pokazuje NOWE zanieczyszczenie: staging miał wieczorem 30 organizacji, 22 to klony sesji demo z tego dnia (usunięte), 4 to rejestracje testerów z 09.09 — ŚWIADOMIE ZOSTAWIONE, „do rozstrzygnięcia w paczce 2”. Czystość danych NIE jest stanem stabilnym — nawraca | nadzorca — mechanizm sprzątania klonów demo (dziś: raz/dobę), decyzja o 4 kontach testerów |
| S1.8 | Strażniki zielone, dług nie rośnie, tsc OK, 0 migracji | **CZĘŚCIOWO NIESPEŁNIONE** | Zmierzone osobiście DZIŚ: `bash scripts/check-list-canon.sh` → PASS (357 naruszeń = baseline 357, dług nie rośnie; 1/8 hubów legacy); `bash scripts/check-artefakt.sh` → PASS (crimson 8/8 baseline, karty N 0/0, danger-* 117/117); `node_modules/.bin/tsc -p server/tsconfig.json --noEmit` → **exit 0, zero błędów**; `git log --diff-filter=M -- server/migrations` od 06.09 → **0 zmodyfikowanych plików**. ALE: `node_modules/.bin/vitest run tests/unit/i18n/i18nTrescPolska.test.ts` → **FAIL**: „60 NOWYCH naruszeń (dług zastany=261 przechodzi bez zmian)” — bramka ratchet i18n, która ma dowodzić „dług nie rośnie”, dziś **rośnie o 60 kluczy** ponad zatwierdzony baseline (261+60=321, powyżej celu ≤300 z dokumentu programu) | Sonnet — albo naprawić 60 nowych identyczności pl≡en, albo świadomie zaktualizować baseline z uzasadnieniem (nie robić tego bez audytu — bramka istnieje właśnie po to, by to wyłapać) |
| S1.9 | Demo ma WŁASNĄ bazę + dane pokazowe + przećwiczoną promocję z cofnięciem | SPEŁNIONE częściowo (własna baza zmierzona przeze mnie; reszta stara/niezweryfikowana) | **Rozstrzygnięte pomiarem, nie dokumentem:** `railway variables --service consultify --environment demo` (odczyt, projekt `consultify` `a6d59e88-…`) → `DB_HOST=pgvector.railway.internal` w środowisku `demo`; dla `staging` (plik `~/Developer/consultify-secrets/railway-staging.json`, świeży z 08.09) → `DB_HOST=postgres.railway.internal`. Cztery osobne środowiska Railway istnieją: `dev, production, staging, demo`, każde z własnym serwisem bazy (`demo` ma dedykowany serwis „pgvector”, oddzielny od stagingowego „postgres”) — **demo i staging NIE dzielą bazy dziś**. `/api/health` obu = ten sam `gitSha f53f9fbdf9…`, oba `database: connected`. NATOMIAST „zamrożenie tagiem + przećwiczona promocja z cofnięciem”: ostatni tag `demo-safe-*` to `demo-safe-20260905-p1` (05.09) — **1577 commitów** za aktualnie wdrożonym SHA `f53f9fbdf9` (09.09). Mechanizm bezpiecznego punktu cofnięcia dla demo jest w praktyce nieaktualny o 5 dni/1577 commitów. Danych pokazowych (DBR77 Wyniki, CD PROJEKT Finanse, organizacja pilotażowa) NIE zweryfikowałem na demo — brak przydzielonych kont demo (mam tylko konta stagingu w `northwind-konta-STAGING.txt`) | nadzorca — re-tag `demo-safe-<data>` PILNIE (dziura bezpieczeństwa runbooku cofania), weryfikacja danych pokazowych na demo z kimś posiadającym dostęp |
| S1.10 | 3 decyzje podjęte i zapisane (Finanse MINIMUM, grupowanie inicjatyw, kropka Model) | SPEŁNIONE (zmierzone przeze mnie) | `01_INDEKS_I_HARMONOGRAM.md:74,76`: DEC-402 (06.09 13:10) pkt (3) inicjatywy: płaska lista + kolumna obszar/oś = TAK, pkt (4) kropka „Model” neutralna = TAK, wdrożone w commicie `8c2aa63d9c` — zweryfikowałem `git merge-base --is-ancestor 8c2aa63d9c HEAD` → jest przodkiem. Finanse MINIMUM = DEC-399 (06.09 ~08:00, cytat właściciela „zgoda, zróbmy to i wypijmy szampana”). Rejestr wprost: „S1.10 = TAK (3/3 decyzje)” | brak |
| S1.11 | 16 modułów + Wyniki + Finanse zamrożone tagiem, tagi realne | SPEŁNIONE literalnie, ale ZASTARZAŁE w duchu | `git tag --list` → 14 tagów `mvp-final-NN_MODUL-20260905` (moduły 01-08,11-16) + `modul-09-wyniki-final-20260902` + `modul-10-finanse-final-20260902` = 16/16. Zweryfikowałem KAŻDY: `git merge-base --is-ancestor <tag> 58e53f923a…` → wszystkie 16 = przodkowie HEAD gałęzi `mvp/inicjatywy-lancuch-20260907` (lokalna gałąź, rozwiązuje się na dokładnie ten sam SHA co baza tego audytu). ALE: HEAD jest **1600 commitów** (moduły z 05.09) do **3157 commitów** (moduły z 02.09) NOWSZY niż tagi — „zamrożenie” opisuje stan sprzed tygodnia, nie dzisiejszy kod | nadzorca — decyzja: re-tag po każdej akcept-partii (zgodnie z regułą własnego programu „rytm zamrażania: … tego samego dnia zamroz.mjs, bez powrotu do dyskusji” — ta reguła NIE jest dziś przestrzegana) |
| S1.12 | Przekazanie dla pojemnika 2 napisane | SPEŁNIONE (zmierzone przeze mnie) | Pliki realne, świeże, w repo: `docs/program/PRZEKAZANIE_KODOWANIA_20260907/RAPORT_KONCOWY_20260910.md` (ostatni commit dziś 06:14, treść: stan środowisk, co zrobiono, 3 incydenty, „co zostaje otwarte” z 6 pozycjami rankowanymi), `PRZEKAZANIE_20260909_KONIEC_DNIA.md`, `ZLECENIE_NASTEPCY_20260910_KOSZYK2.md` — kolejka i decyzje jawnie spisane | brak |
| S1.13 | Analiza kart N: kontrakt/ekran/rozjazd per karta, rozjazdy blokujące rozstrzygnięte | SPEŁNIONE częściowo (zmierzone) | Realne artefakty: `docs/program/PROGRAM_NAPRAWCZY_20260905/K1_WNIOSKI_INICJATYWY_RAPORT.md` (nazwa pliku różni się od `RAPORT_K1.md` z kryterium, ale to ten sam dokument merytorycznie), `docs/ssot/KARTA_N_KONTRAKT.md` (251 linii, 6 kryteriów × 21-22 karty), `evidence/p10-matryca/` — 80 plików (zrzuty na żywo). 19/19 decyzji CTO zapisanych (DEC-429 pkt „P10 — 19 decyzji”). ALE Faza B (naprawy rozjazdów) NIE domknięta w pełni: `P10-B0` (06.09 21:31) kończy się wprost „DEC-432 = kontrakt ma stać się JEDYNYM źródłem sekcji (usunąć tablice) — **pakiet Faza B**” — czyli decyzja zapadła, ale wykonanie zostało odłożone jako osobny pakiet; nie znalazłem w rejestrze wpisu zamykającego ten pakiet | nadzorca — sprawdzić czy pakiet Faza B (DEC-432) wszedł później; jeśli nie, S1.13 nie jest w pełni zamknięte |

## Co blokuje zamknięcie

1. **S1.2 otwarty WAŻNY**: deduplikacja artefaktów po tytule ukrywa realne dokumenty
   (`artifact-b4ad328c` pod `artifact-ab8dbf5c`) — krytyczne przed pilotażem 4 osób, gdzie
   każdy kolejny „Nowy dokument” zniknie. Lokalizacja: mechanizm w
   `server/src/services/v8/artifactRegistryService.ts` (deduplikacja po `title_snapshot`).
   Szacunek: pół dnia Sonnet na naprawę + test regresji.
2. **S1.8 i18n ratchet FAIL na żywo**: 60 nowych naruszeń pl≡en ponad baseline 261.
   Uruchom `node_modules/.bin/vitest run tests/unit/i18n/i18nTrescPolska.test.ts` — lista
   60 kluczy w wyjściu testu (np. `admin.billing.summary.plan`, `assessment.drd.http.frozen.findings`).
   Szacunek: pół dnia — sprawdzić, czy to prawdziwe braki tłumaczeń czy uzasadnione
   identyczności do dopisania na białą listę.
3. **S1.9 tag `demo-safe` przestarzały o 1577 commitów/5 dni**: bezpiecznik cofania dla
   demo (§8 CLAUDE.md, `_RUNBOOK_COFANIA.md`) nie ma aktualnego punktu odniesienia.
   Szacunek: 15 minut — `zamroz`/tag na aktualnym SHA demo po weryfikacji zrzutem.
4. **S1.11 tagi modułów zastarzałe o 1600-3157 commitów**: te same tagi istnieją, ale opisują
   stan sprzed tygodnia; jeśli „zamrożenie” ma znaczyć coś więcej niż formalność, wymaga
   re-tagowania po bieżących naprawach (1.1-1.13).
5. **S1.1/S1.5/S1.6 wymagają dowodu na STAGINGU, nie tylko lokalnie/zbiorczo**: przejście
   właściciela (16 kart osobno), 8×3 zrzuty prawego panelu i 16 odpowiedzi Teresy z
   `used_sources>0` na żywym stagingu — dziś to głównie dowody lokalne albo zbiorcze
   wypowiedzi właściciela, nie dokładnie ten artefakt, jakiego żąda checklista.

## Czego nie dało się zmierzyć i dlaczego

- **Dane pokazowe na demo (DBR77/CD PROJEKT/organizacja pilotażowa) — treść, nie sama baza.**
  Nie mam kont demo (tylko `northwind-konta-STAGING.txt` dla stagingu); logowanie do demo
  wymagałoby konta, którego nie dostałem, i tworzenie nowego byłoby ingerencją w „świętą
  bazę” demo bez procedury `consultify-promocja-demo`. Zmierzyłem tylko warstwę
  infrastruktury (Railway), nie zawartość.
- **PL · Silesia = 0, dziś, na żywo.** Zweryfikowany w repo jako „0 w danych UI” z 06.09
  (rejestr, linia 73). Nie odświeżyłem tego liczbą z żywej bazy dzisiaj — wymagałoby
  logowania do stagingu i przejścia przez ekrany albo zapytania SQL, na co zabrakło czasu
  w ramach tego pojedynczego audytu (priorytet poszedł w krytyczne S1.2/S1.8/S1.9).
- **8×3 zrzuty prawego panelu (S1.5) na dokładnie 1280/1440/1920 na stagingu.** Nie znalazłem
  takiego kompletu w `evidence/`; nie odtwarzałem go sam, bo audyt ma mierzyć stan, nie
  produkować nowych dowodów za robotników.
- **Teresa na stagingu (S1.6), nie lokalnie.** Ten sam powód — mam dowód lokalny 13/16,
  ale nie powtórzyłem pomiaru na żywym stagingu (wymaga konta z podniesionym/odblokowanym
  limitem AI, którego nie mam prawa samodzielnie zmieniać).
- **Czy Faza B kart N (DEC-432) faktycznie weszła.** Rejestr się kończy wpisami z 06-09.09;
  jeśli pakiet Faza B ruszył PO ostatnim wpisie widocznym w tym pliku, nie mam tego w polu
  widzenia z tego audytu.

## Premisy z dokumentów, które obaliłem pomiarem

1. **„Demo i staging dzielą bazę trolley” (dokument `TRZY_POJEMNIKI_PRACY_20260906.md`,
   pozycja S1.9/1.10) jest NIEAKTUALNE na dziś — obaliłem to bezpośrednim odczytem zmiennych
   Railway.** Środowiska `staging` i `demo` mają dziś odrębne serwisy bazy
   (`postgres.railway.internal` vs `pgvector.railway.internal`) w tym samym projekcie
   Railway, ale w osobnych środowiskach. To zgadza się z korektą z pamięci projektu
   („topologia-srodowisk-staging-demo”, sprostowanie 06.09), ale PRZECZY literalnemu
   zdaniu w dokumencie programu, które nadal mówi o wspólnej bazie jako stanie bieżącym
   („dziś demo i staging dzielą bazę trolley”) — dokument nie został zaktualizowany po
   rozdziale.
2. **„S1.1 = tak” (rejestr, DEC-452, 07.09) jest w konflikcie z najświeższym dokumentem
   przekazania z tej samej sesji nadzorczej (`RAPORT_KONCOWY_20260910.md`, commit z DZIŚ),
   który wymienia „przejście właściciela po systemie” jako JEDYNĄ pozycję niewykonalną
   bez niego, w kolejce do pojemnika 2.** Innymi słowy: trzy dni po tym, jak rejestr
   zapisał zbiorcze „Tak” właściciela jako spełnienie S1.1, kolejny dokument tej samej
   linii pracy traktuje pełne przejście jako wciąż nieodbyte. Sam autor DEC-452 uczciwie
   zastrzegł w tym samym wpisie, że nie przestawia kryterium 1 (S1.2) na zielono „na
   podstawie samego OK” — czyli rejestr sam sygnalizował tę niespójność, zanim ja ją
   znalazłem; nie została ona jednak przeniesiona na S1.1 w tabeli szampana.
3. **Dowód dry-run higieny danych na stagingu (`/private/tmp/stanowisko-noc/higiena-staging-dryrun.txt`,
   przywoływany jako artefakt S1.7) wyparował.** Plik fizycznie nie istnieje — to ten sam
   kształt błędu, co opisany w pamięci projektu („dowod-poza-repo-wyparowuje”), zmierzony
   dziś ponownie na nowym przykładzie.
4. **„Dane właściciela czyste” (S1.7, zamknięte 06.09) nie jest stanem trwałym — pomiar z
   09.09 22:00 pokazuje nawrót zanieczyszczenia** (22 klony sesji demo + 4 konta testerów
   na stagingu), z czego 4 konta ŚWIADOMIE zostały, bo mechanizm porządkujący
   (`demoService.cleanupExpiredDemos`) sprząta raz na dobę, nie na bieżąco. Kryterium
   mówiące „dane są czyste” bez ram czasowych jest więc z natury migawką, nie stanem.
5. **Tag `demo-safe` i tagi modułów (`mvp-final-*`) istnieją i technicznie „wskazują na
   commity w gałęzi”, jak żąda instrukcja audytu — ale to sprawdzenie zbyt słabe.**
   Literalne pytanie („czy tagi wskazują na commity, które faktycznie istnieją w gałęzi”)
   daje fałszywie uspokajający PASS, bo każdy przodek HEAD spełnia ten warunek niezależnie
   od tego, jak jest stary. Rzeczywisty pomiar (1577 i 1600-3157 commitów zaległości)
   pokazuje, że mechanizm „zamrożenia” w praktyce nie działa zgodnie z własną regułą
   programu („tego samego dnia zamroz.mjs, bez powrotu do dyskusji”) — dowód na to, że
   sam sposób sformułowania kryterium w zleceniu audytu może dawać złudne zielone światło,
   jeśli nie doda się progu świeżości.
