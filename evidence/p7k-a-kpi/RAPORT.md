# P7K część A — Wyniki → KPI, trzy poziomy w kodzie produkcyjnym

Gałąź: `wyniki/p7k-a-kpi` · baza: `origin/staging` @ `59e282df88` (w trakcie pracy
staging przesunął się na `445b8c6f54` — moja gałąź jest od tamtego SHA odcięta
wcześniej i wymaga scalenia przez nadzorcę).
Data: 2026-09-05 wieczór → 2026-09-06 noc.

Źródła prawdy w kolejności wiążącej: `docs/modules/07_rezultaty/SSOT_WYNIKI_KPI_OKR_ROI.md`,
`docs/program/grafika/WYNIKI_ZALOZENIA_GRAFICZNE_20260905.md`,
zaakceptowany prototyp `dev-render/screens/p7k-wyniki-prototype.tsx` + zrzuty
`evidence/p7k-wyniki/prototype/kpi-*--light.png`, werdykty K1–K13
(`docs/program/PROGRAM_NAPRAWCZY_20260905/P7K_KROK1_WERDYKT_20260905.md`),
paczka `P7K_WYNIKI_TRZY_POZIOMY_KOREKTA.md` (§10 i §16 = definicja gotowe),
mapowanie `evidence/p7k-wyniki/KROK_0_MAPOWANIE_SSOT_SCHEMA_DTO.md`,
seed `server/scripts/seed-wyniki-dbr77.ts` + `evidence/seed-wyniki-dbr77/RAPORT.md`.

---

## 1. Co zbudowano (plik:linia)

### Serwer

| Co | Gdzie |
| --- | --- |
| Migracja addytywna: kontrakt miernika na pozycji raportu (`area_name`, `superior_owner_name`, `indicator_type`, `benchmark_value`, `limit_percent`), nagłówek raportu (`edition_label`, `revision_date`, `prepared_by_user_id`), CEL okresu (`period_target_value`) | `server/migrations/20261124_rvn_kpi_report_contract_fields.sql` |
| DTO pozycji raportu z pełnym kontraktem + fallback na zapis seeda w `display_config` | `server/src/services/resultsVnext/kpi/kpiScorecardTypes.ts:119-260` |
| `GET /api/vnext/results/kpi/scorecards/:scorecardId/periods` — matryca CEL/Rezultat per okres, YTD, stan ostatniego okresu, liczba otwartych kart działania | `server/src/routes/resultsVnext/kpiScorecard.routes.ts` (sekcja „GET …/periods"), repozytorium `kpiScorecardRepository.ts` (`getScorecardPeriodMatrix`) |
| Rozkład stanu rozszerzony o `openDeviationCases` i `byArea` (podgląd L1 per obszar, paczka §14) | `kpiScorecardRepository.ts` (`getScorecardStatusDistribution`) |
| Porównanie z CELEM okresu i limitem [%] (stan YTD) | `server/src/services/resultsVnext/kpi/kpiPeriodEvaluation.ts` |
| CEL okresu w DTO pomiaru (karta miernika) | `server/src/services/resultsVnext/kpi/kpiTypes.ts` (`resolveMeasurementPeriodTarget`) |
| Naprawa niespójności: `GET /scorecards/:id` gubił `ownerName`, które `listScorecards` liczy joinem — poziom 1 pokazywał nazwisko, poziom 2 „Nieznany użytkownik" | `kpiScorecard.routes.ts` (`loadVisibleScorecard`) |

Widoczność: matryca okresów i rozkład per obszar filtrują po `resource_type = 'kpi'`
NA POZYCJI, PRZED agregacją — ta sama reguła co `listScorecardItems`
(AC #4). Czytelnik bez dostępu do miernika nie zobaczy ani jego komórek, ani
jego wkładu w YTD.

### Jądro tabeli (`FilterableTable` / `StandardTable`) — trzy mechaniki opt-in

| Co | Dlaczego w JĄDRZE, nie w ekranie |
| --- | --- |
| `TableColumn.pinned: 'left' \| 'right'` | prototyp liczył offsety w `useEffect` z `getBoundingClientRect` i doklejał warianty `[&_td:nth-last-child(2)]:sticky` — naprawa per-wywołanie, która odrasta. Offsety liczone z TYCH SAMYCH szerokości, którymi renderują się komórki; szerokość kolumny przypiętej jest zamknięta (`width` = `min` = `max`), więc między YTD a STAN nie może powstać szczelina (defekt K10). |
| `isGroupRow` / `renderGroupRow` | wiersz grupy = JEDNA komórka `colSpan` z treścią w `sticky left-0` (werdykt K6: zero „—" w wierszu grupy). |
| `scrollToColumnId` | SSOT §6 „domyślnie przewinięte do bieżącego miesiąca". Offset z deklarowanych szerokości, bez pomiaru DOM. |

Wszystkie trzy są ADDYTYWNE: bez propów żaden istniejący ekran nie dostaje ani
jednej dodatkowej klasy (dowód: test „bez propów NIC nie jest przypięte ani
grupowane").

### Ekrany

| Poziom | Trasa | Plik |
| --- | --- | --- |
| 1 — tabela RAPORTÓW | `/results/kpi` | `src/components/ResultsVNext/ResultsKpiRegistryPage.tsx` + `kpiScorecards/kpiReportPresenters.tsx` |
| 2 — RAPORT jako tabela mierników | `/results/kpi/scorecards/:scorecardId` | `kpiScorecards/ResultsKpiScorecardDetailPage.tsx` |
| 3 — karta N miernika | `/results/kpi/:kpiId?zbior=` | `kpiTool/KpiToolPage.tsx` |

Słownik etykiet (P4 — zero kodów technicznych w UI): `src/labels/kpiReportLabels.ts`.

Usunięcia z paczki: `KpiCardSetPage.tsx` skasowany, trasa `/results/kpi/zestawienie/:id`
zostaje WYŁĄCZNIE jako trwałe przekierowanie na raport (parametr nazwany
`:legacyScorecardId`, żeby nie dało się jej pomylić z żywą trasą poziomu 2);
pigułka „Wszystkie wskaźniki" znika z Menu 3.

### Naprawy kanonu przy okazji (nie były zlecone, ale były defektami)

1. **Menu 2 na poziomie 2 pokazywało „Pozycje / Migawki przeglądu"** — z otwartego
   raportu nie dawało się przejść do OKR ani ROI. SSOT §6: Menu 2 = KPI · OKR · ROI.
   Podział mierniki/migawki zszedł do Menu 3.
2. **Zakładka wyszukiwarki miała angielską etykietę „Search"** i stała PRZED
   trzema funkcjami. Teraz „Wyszukiwarka", za KPI/OKR/ROI.
3. **Kolejność kolumn rozjeżdżała się przy DYNAMICZNYM zestawie kolumn** — patrz §3.

---

## 2. Czego z SSOT NIE ma i dlaczego

| Element SSOT | Stan | Powód |
| --- | --- | --- |
| Mini-wykres 12 okresów z linią celu i pasmem limitu (L3, sekcja *Wyniki*) | BRAK | Poza zakresem części A; wymaga własnego prototypu i akceptu (kanon #7). Cztery liczby (CEL/Rezultat/Odchylenie/YTD) są. |
| Edycja rezultatu inline w komórce okresu (L2) | BRAK | To wyzwalacz odchylenia = część B paczki. Świadomie nie budowane w części A. |
| Zgłoszenie do odpowiedzialnego + automatyczna karta działania | BRAK | Część B. |
| Teresa jako ZAKŁADKA w prawym panelu (prototyp) | ZAMIAST TEGO PRZYCISK | Nowsza, jawna decyzja właściciela (`KANON_Z_ODBIOROW.md`, 01.09: „JEDNA TERESA, W SWOIM OKNIE") mówi, że czat Teresy znika z prawych paneli, a zostaje przycisk otwierający główne okno z kontekstem obiektu. Zakładka z drugim czatem byłaby odbudową tego, co właściciel kazał usunąć. **Sprzeczność prototyp ↔ kanon — do rozstrzygnięcia przez nadzorcę.** |
| Sekcja „Komentarze" w prawym panelu | WIDOCZNA I WYŁĄCZONA Z POWODEM | Miernik nie ma dziś wątku komentarzy w modelu (`rvn_kpi_*` nie ma tabeli, żadna trasa ich nie wystawia). Nie udajemy pustego wątku. |
| Wiersz systemowy „Bez zestawienia" na L1 (korekta §4 kazała go zostawić) | USUNIĘTY | Nie jest raportem okresowym, a jego strona (`/zestawienie`) znika w tej paczce — nie miał dokąd prowadzić. Wskaźniki spoza raportów są osiągalne przez wyszukiwarkę Menu 2 i przez `?kpiView=wskazniki`. |
| Rejestr pojedynczych wskaźników | ZOSTAJE, bez pigułki | To JEDYNE miejsce cyklu definicji miernika (szkic → zgłoszenie → zatwierdzenie/odrzucenie → rewizja). Skasowanie go „dla zgodności z rysunkiem" zabrałoby produktowi funkcję, której paczka usunąć nie kazała. Osiągalny adresem `?kpiView=wskazniki` (bliźniak istniejącego `?kpiView=scorecards`) i z wyszukiwarki. **Do decyzji nadzorcy: czy zostawić deep-link, czy dorobić wejście z L2.** |
| Inicjatywy wpływające na miernik jako ósma sekcja L3 | BLOK w sekcji „Działania" | SSOT wymienia DOKŁADNIE siedem sekcji i tyle pokazuje zaakceptowany prototyp. Treść (komendy zaproponuj/zatwierdź/przejrzyj/zastąp) zostaje w całości. |

## 3. Defekty ZNALEZIONE I NAPRAWIONE w trakcie (nie były zgłoszone)

1. **`useMemo` pod wczesnym `return` (poziom 2)** — React liczył raz mniej haków
   w renderze ładowania niż w renderze z danymi i wywracał ekran raportu
   wyjątkiem „Rendered more hooks than during the previous render". Złapane
   TESTEM poziomu 2, nie oglądaniem.
2. **Zapisany układ kolumn z INNEGO zestawu przeplatał kolumny** — ekran
   z dynamicznym zestawem renderuje się najpierw bez kolumn okresów, zapisuje
   kolejność dla krótkiej listy, a po dojściu danych `order` kolumn YTD/STAN
   zderza się z indeksami dwunastu nowych kolumn. Efekt na pierwszym zrzucie:
   „MIERNIK · STY · YTD · LUT · STAN · MAR". **To nie jest defekt jednego
   ekranu — dotyczy każdej tabeli w aplikacji, której zestaw kolumn zmienia się
   w czasie.** Naprawione w jądrze: zapisana kolejność obowiązuje tylko wtedy,
   gdy jest KOMPLETNA i JEDNOZNACZNA dla bieżącego zestawu.
3. **`undefined.toLocaleString()` na karcie miernika** — pole `periodTargetValue`
   może być nieobecne w odpowiedzi sprzed tej zmiany; `v === null` tego nie
   łapało i karta wychodziła na biało. Złapane testem `KpiToolPage.test.tsx`
   (w harnessie fikstura pole miała — samo oglądanie by tego nie pokazało).
4. **Podgląd raportu otwierał się domyślnie na poziomie 2** i zjadał ~400 px,
   przez co widać było trzy kolumny okresów zamiast pięciu.
5. **Panel uwag harnessu nie miał znacznika `data-dev-render-chrome`** — dwie
   pigułki przyrządu wchodziły w kadr KAŻDEGO zrzutu (lekcja „przyrząd kłamie,
   a oko przywyka"). Naprawa w narzędziu, nie w zrzucie.

## 4. Migracje

Jedna, nowa, w całości addytywna: `server/migrations/20261124_rvn_kpi_report_contract_fields.sql`
— same `ADD COLUMN IF NOT EXISTS` na kolumnach NULLABLE + dwa `CHECK` w bloku
idempotentnym. Zero `DROP`, zero `UPDATE`, zero zmiany typu.

**Prefiks daty, NIE numer trzycyfrowy**: `compareMigrationFilenames`
(`server/src/services/tablePlatform/migrationRunner.ts:228`) sortuje NAJPIERW po
DŁUGOŚCI prefiksu, więc plik `964_…` wykonałby się PRZED
`20260812_rvn_kpi_scorecards.sql` i na bazie od zera wywrócił się na
nieistniejącej tabeli.

Dane seeda DBR77 nie są ruszane: odczyt bierze najpierw kolumnę, a gdy pusta —
spada do zapisu seeda (`display_config`, `evidence_refs` z `kind=seed_period_target`).
Powód: baza demo/staging jest WSPÓŁDZIELONA i jest twarzą produktu — masowy
UPDATE na cudzych wierszach nie jest tu operacją odwracalną.

## 5. Testy i dowody mutacyjne

Baseline ustalony na czystym `origin/staging` w osobnym worktree (usuniętym po
pomiarze): **12 zastanych porażek** w zakresie
`tests/components/ResultsVNext + src/components/ResultsVNext + tests/unit/i18n + tests/unit/ui/noRawTechnicalValues`.
Po mojej pracy: **11** — zero NOWYCH, jedna zastana mniej (strażnik i18n treści
pl≠en przechodzi).

| Plik | Co pilnuje |
| --- | --- |
| `tests/components/ResultsVNext/KpiTrzyPoziomy.test.tsx` (9) | trzy poziomy, kolumny L1, brak pigułki, adres L1→L2 i L2→L3, wiersz grupy jako jedna komórka, para CEL/Rezultat, „—" nigdy 0, okruszek 3-stopniowy |
| `src/components/ResultsVNext/__tests__/resultsKpiScorecardsEntry.test.tsx` (4) | poziom 1 = raporty, Menu 3 = jedna akcja, zero pigułek, rejestr wskaźników nadal osiągalny |
| `src/components/shared/ModuleHub/__tests__/FilterableTable.pinnedAndGroups.test.tsx` (5) | addytywność, przypięcie i jego niezmiennik, wiersz grupy, odporność kolejności kolumn |
| `server/src/services/resultsVnext/kpi/__tests__/kpiReportContract.test.ts` (13) | siatka okresów, CEL okresu (kolumna > seed), reguła YTD, stan wobec limitu |

**Siedem mutacji, każda celująca w ZABEZPIECZENIE, każda złapana; po
przywróceniu wszystko zielone:**

| # | Mutacja | Wynik |
| --- | --- | --- |
| M1 | zdjęcie pierwszeństwa kolumny nad zapisem seeda (CEL okresu) | 1 test pada |
| M2 | domyślne `sum` zamiast `unknown`, gdy nie ma jednostki (YTD) | 1 test pada |
| M3 | zdjęcie porównania z dopuszczalnym limitem [%] | 2 testy padają |
| M4 | zdjęcie wiersza grupującego z `FilterableTable` | 1 test pada |
| M5 | przywrócenie pigułki „Wszystkie wskaźniki" | 1 test pada |
| M6 | zdjęcie odporności kolejności kolumn (powrót do gołego sortowania) | 1 test pada |
| M7 | zdjęcie zamkniętej szerokości kolumny przypiętej | 1 test pada |

Bramki: `rg -n -e "KpiCardSetPage" -e "zestawienie/:scorecardId" src` → jedno
trafienie, w KOMENTARZU pliku OKR (`okr/OkrKeyResultSetPage.tsx:10`), który ta
sama paczka każe usunąć osobnemu wykonawcy — poza moim zakresem.
`bash scripts/check-list-canon.sh` → OK (dług SPADŁ o 3),
`bash scripts/check-artefakt.sh` → OK (8 = baseline).
`cd server && npx tsc --noEmit -p tsconfig.build.json` → exit 0.
Front `tsc` całego repo nie jest bramką (98 zastanych błędów, OOM przy
domyślnym heapie) — zmierzone: moje pliki wnoszą ZERO.
esbuild każdego zmienionego pliku → exit 0.

## 6. Zrzuty — GRANICA DOWODU (przeczytaj przed oglądaniem)

**To NIE są zrzuty na żywo.** Dwie przyczyny, obie zmierzone:

1. Sesja `ODBIOR_AUTH_STATE` (`/private/tmp/odbior-auth/auth.json`, mtime
   2026-09-05 23:08) NIE MA w `localStorage` klucza `token` — 100 kluczy, żaden
   to `token`; przy pierwszym zrzucie aplikacja przekierowała na
   `/login?redirect=%2Fresults%2Fkpi`. Sesja jest świeża datą, ale niezdatna do
   zalogowanego zrzutu.
2. Nowa trasa `GET .../scorecards/:id/periods` i nowe pola DTO NIE SĄ wdrożone
   na staging. Zrzut „na żywo" poziomu 2 pokazałby tabelę BEZ ani jednej
   kolumny okresu i skłamałby o stanie pracy.

Dlatego zrzuty pochodzą z harnessu dev-render (`?screen=p7k-wyniki-kpi`), który
montuje **komponenty produkcyjne z `src/`** — ten sam kod, ten sam router, ta
sama powłoka — z podstawioną WARSTWĄ SIECI. To jest ścieżka przewidziana przez
CLAUDE.md #7 i przez §10 zadania („jeśli sesja nieważna: zrzuty przez dev-render
z mockiem sieci i zdanie w raporcie"). Dane w kształcie, który zwraca nowy
serwer; liczby 1:1 z zaakceptowanego prototypu, żeby dało się porównać bez
tłumaczenia.

Czego te zrzuty NIE dowodzą: że zapytania SQL zwracają te liczby na realnej
bazie. Tego dowodzą testy jednostkowe reguł i `tsc --build` serwera, ale
**test `.pg` na jednorazowym Postgresie NIE ZOSTAŁ wykonany** — patrz §8.

| Plik | Co widać |
| --- | --- |
| `L1-raporty--{light,dark}.png` | tabela RAPORTÓW: NAZWA · ZAKRES · OKRES · MIERNIKI · STAN (cztery liczby z kolorowymi kropkami) · OTWARTE DZIAŁANIA · PRZYGOTOWAŁ · AKTUALIZACJA; Menu 2 = KPI·OKR·ROI·Wyszukiwarka; Menu 3 = jedna akcja „Nowy raport"; zero uciętych komórek (zmierzone) |
| `L1-podglad--{light,dark}.png` | podgląd raportu z rozkładem stanu PER OBSZAR (§14) |
| `L2-raport--{light,dark}.png` | RAPORT: nagłówek (zakres · okres · edycja · rewizja · przygotował) + podsumowanie stanów; tabela grupowana po obszarze, MIERNIK przypięty z lewej, miesiące przewinięte do bieżącego, YTD i STAN przypięte z prawej, CEL nad Rezultatem, „—" zamiast 0, czerwień tylko przy „Krytyczne" |
| `L2-raport-start--{light,dark}.png` | ta sama tabela przewinięta na POCZĄTEK roku — dowód, że przypięcie działa na obu krańcach (wymóg 1c/K10) |
| `L2-podglad--{light,dark}.png` | podgląd pozycji raportu |
| `L3-karta-miernika--{light,dark}.png` | karta N: siedem sekcji SSOT w lewej nawigacji, nagłówek CEL/Rezultat/Odchylenie/YTD, prawy panel z sześcioma sekcjami SPEC-A + przycisk Teresy |

Pomiary progów: `dom.aside` = **1** na L3 (wymóg ≤ 1); zero błędów konsoli na
wszystkich zrzutach; para jasny/ciemny różni się średnią jasnością o **217–230**
(bezpiecznik „duplikat zamiast motywu" — nie są tym samym obrazem).

### Różnice wobec prototypu, obejrzane własnymi oczami

1. **Przycisk „Uwaga" nad tabelą** na każdym ekranie Wyników — to wejście do
   ekranu „Uwaga" z powłoki rejestrów (flaga `attentionEntry`, domyślnie ON na
   localhoście), NIE moja praca i wspólne dla KPI/OKR/ROI. W prototypie go nie
   ma. Do decyzji nadzorcy.
2. **Zakładka „Wyszukiwarka"** jako czwarta pigułka Menu 2 (SSOT: „trzy funkcje
   + wyszukiwarka"). W prototypie wyszukiwarka jest samą lupą.
3. **Kolumna OKRES pokazuje sam okres** („VIII 2026"), a numer edycji zszedł do
   podglądu i do nagłówka poziomu 2. Powód zmierzony: „VIII 2026 · edycja 03"
   ma 131 px przy 129 px treści kolumny i kończyło wielokropkiem.
4. **Przy OTWARTYM podglądzie na poziomie 1** obszar tabeli zwęża się o ~400 px
   i ostatnie kolumny ściskają się poniżej treści (widoczne na
   `L1-podglad--light.png`: wartość „OTWARTE DZIAŁANIA" sąsiaduje ciasno ze
   STANEM). To ZASTANE ograniczenie jądra tabeli — `columnFit` ma udokumentowaną
   gałąź „nawet podłogi się nie mieszczą" i wtedy stosuje podłogi mimo wszystko.
   Złagodzone (treść komórki nie maluje się już poza swoją kolumną), ale nie
   usunięte: usunięcie wymaga responsywnego ukrywania kolumn w jądrze, czyli
   osobnej pracy o własnym promieniu rażenia.
5. **Karta miernika, sekcja *Wyniki*, ma cztery liczby, bez mini-wykresu** —
   patrz §2.

## 7. Twierdzenia NIEZWERYFIKOWANE

- Nie uruchomiono serwera ani migracji na żadnej bazie. `tsc --build` serwera
  przechodzi, reguły mają testy jednostkowe, ale **SQL nowej trasy nie został
  wykonany ani razu**.
- Nie sprawdzono zachowania na 138 miernikach (matryca 138 × 12 = 1656 komórek):
  ani wydajności zapytania, ani renderu tabeli.
- Nie sprawdzono, czy `rvn_kpi_measurements` przyjmie `period_target_value` przy
  zapisie pomiaru — trasa zapisu nie była zmieniana, więc kolumna jest dziś
  wypełniana wyłącznie przez fallback z `evidence_refs`.
- i18n: ekrany używają wzorca `isPolish ? pl : en` (konwencja całego
  `ResultsVNext`), a nie kluczy w `public/locales`. Strażnik
  `tests/unit/i18n/i18nTrescPolska.test.ts` przechodzi, ale to znaczy „nie
  dołożyłem długu", a nie „klucze istnieją".

## 8. Czego NIE zrobiono z §10 zadania

- **Test `.pg` na jednorazowym Postgresie z pełnymi migracjami i seedem** —
  niewykonany. Powód: dysk hosta był w trakcie pracy na 13–17 GiB wolnego przy
  kilku równoległych agentach, a pełny przebieg (kontener + migracje + seed
  DBR77 + serwer) to kilka GB i długi czas. To jest REALNA LUKA W DOWODZIE, nie
  formalność — bez niej nowe zapytania SQL nie były wykonane ani razu.
- **Zrzuty na żywo z sesją właściciela** — patrz §6, sesja bez tokenu.
- **Przekazanie L2 → tworzenie NOWEGO miernika** — „Dodaj miernik" otwiera
  istniejący modal dopięcia miernika do raportu; utworzenie nowej definicji
  nadal żyje w rejestrze wskaźników (`?kpiView=wskazniki`).
