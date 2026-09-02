---
doc_id: program-kolejka-codex-integracja
status: canonical
data: 2026-09-02
---

# Kolejka prac Codexa — faza trzecia (pełna integracja)

Ten plik istnieje po to, żeby **wydanie kolejnych dyżurów nie zależało od kontekstu żadnej sesji**.
Każda pozycja ma dość treści, żeby złożyć z niej instrukcję generatorem
`scripts/dyzury/gen_instrukcja.py`, bez pytania nadzorcy o cokolwiek.

Kolejność jest ułożona wg **blokowania**, nie wg wielkości.

## Stan wyjściowy (zmierzony 2026-09-02)

- Moduły z `G17`+`G18` `PASS`: **15 z 16** (otwarty: `16_PARTNER`).
- Bramek zamkniętych: **151 z 336**.
- **Kolumny z zerem na 16:** `G05`, `G06`, `G13`, `G14`, `G15`, `G16`, `G19`, `G20`.
- Zamknięta jest **warstwa ekranowa**, nie działający system.

## WYDANE, czekają na wykonanie

| Nr | Rzecz | Zakres | Stan |
| --- | --- | --- | --- |
| **279** | `G05` — przelot funkcjonalny i odczyt na zimno, 16 modułów | POMIAR | wydany, wklejka gotowa |
| **280** | `G06` — języki, motywy, rozdzielczości, konsola, 16 modułów | POMIAR | wydany, wklejka gotowa |
| **281** | **P0** — schemat bazy od zera | POMIAR + wąska NAPRAWA | wydany, wklejka gotowa |
| **282** | Sześć przepływów międzymodułowych | POMIAR | **w toku**, znalazł P0 z 281 |

★ **283 wykonany przez robotnika nadzorcy 02.09** — zrzuty Partnera gotowe, sześć znalezisk niżej.

Marker wszystkich czterech: `eeb253c3ec`. Gałąź odczytu: `github-backup/grafika/m03-20260902`.

## DO WYDANIA — kolejka fazy trzeciej

### 283 · Partner — zrzuty i przegląd
Jedyny moduł bez `G17`/`G18`. **Nie ma w rejestrze grafiki ani jednego ekranu.**
`partner-settlements-view` **nie należy** do tego modułu (to SuperAdmin → Revenue, policzony
w Administracji wg pola `gdzie`). Zakres: ustalić, co realnie renderuje się pod `/partner`
(uwaga na kształt „wołacz istnieje ≠ renderuje się”), zrobić komplet zrzutów jasny/ciemny,
pusty/pełny, opisać językiem właściciela. **Jeśli portal praktycznie nie istnieje — to jest wynik.**
*W chwili pisania robi to robotnik nadzorcy; jeśli nie dowiezie, wydać jako dyżur.*

### 283b · Partner — sześć znalezisk z przeglądu 02.09
Zrzuty zrobione (**25 sztuk**, `evidence/grafika/16-partner/`, para jasny/ciemny sprawdzona:
różnica luminancji 213-228 przy progu 150, 99,1-100% różnych pikseli). Inwentarz i opisy:
`docs/program/grafika/PRZEGLAD_16_PARTNER_20260902.md`. Portal **istnieje i renderuje się**:
`/partner/*` montowane w `src/routes/AppRoutes.tsx:3494` jako `PartnerPortalViewNew`, gate to
wyłącznie `requireAuth`, **zero flagi frontendowej**. Znalezione defekty, potwierdzone w źródle:

1. **Zero ekranów listowych z podglądem po kliknięciu w wiersz** — w całym module.
2. **Kebab wiersza działa tylko w tabeli kampanii**; pozostałe trzy tabele mają `hideRowActions`.
3. **`projects` i `users` w Zarządzaniu klientami to bespoke karty**, nie `FilterableTable`
   ani `StandardTable` — naruszenie kanonu list z CLAUDE.md §9.
4. **Crimson (`primary-*`) jako kolor dekoracyjny w 5 plikach, 45+ wystąpień** — pułapka nr 1
   z CLAUDE.md; czerwień wolno wyłącznie dla semantyki krytycznej.
5. **Twardy znak € w Pulpicie** (`PartnerPortalView.tsx:345`) obok PLN na tym samym ekranie.
6. **Cztery miejsca z twardo wpisanym angielskim tekstem w polskim UI** — m.in. nagłówek
   „Documentation" obok okruszka „Dokumentacja", surowy enum „Subscription Renewal".

★ **`G07`-`G12` tego modułu NIE zostały zamknięte i nie wolno ich zamknąć bez oczu właściciela** —
to jedyny moduł, którego nigdy nie widział. Zrzuty są gotowe do jego przeglądu.

### 283c · Alias `brand` — DRUGA nazwa na ten sam crimson
`tailwind.config.js` ma stary alias **`brand` przepięty na crimson `#85182F`**. Czyli obok
`primary-*` i `crimson-*` istnieje **trzecia nazwa tego samego czerwonego**, niewidoczna dla
każdego, kto grepuje po dwóch pierwszych. Użyta w kilkunastu miejscach samego Partnera
i **prawdopodobnie szeroko w całej aplikacji** — nie zmierzone.

★ To jest ta sama pułapka, która dziś trafiła nadzorcę **dwa razy z rzędu** przy pomiarze
Partnera: pierwsza miara pomijała `crimson-*`, druga pomijała podkatalog `sections/`. Rodzina
ma trzy nazwy, a każdy pomiar po jednej z nich zaniża wynik.

Zakres dyżuru: zmierzyć wszystkie trzy nazwy naraz w całym `src/`, wydać rejestr per moduł
(ile dekoracyjnych, ile semantycznych), **nie naprawiać hurtem** — naprawa idzie modułami,
z rozstrzygnięciem per wystąpienie, wzorem dyżuru Partnera (97 wystąpień, wszystkie okazały
się dekoracyjne). Bezpieczniki `check-list-canon.sh`, `check-artefakt.sh`, `check-triada.sh`
muszą przechodzić po każdym module.

### 284 · Cykl napraw `G13`–`G16` z rejestrów 279, 280 i 282
Cztery bramki po zero na szesnaście. **Nie da się ich wydać przed 279/280/282** — ich treścią jest
analiza wpływu, naprawa z tropem do commita, self-QA i pakiet przed/po dla znalezisk, których
jeszcze nie mamy spisanych. Wydać **natychmiast po** powrocie tamtych trzech rejestrów, wąsko,
po jednej rodzinie defektów na dyżur. Nie robić jednego wielkiego.

### 285 · `ResultsHub` — WYKONANY POMIAR, czeka na decyzję właściciela
Rejestr: `waves/WAVE_03_ACCEPTANCE/REJESTR_RESULTSHUB_20260902.md` (322 linie).

**Zmierzone: 42 pliki, 22 409 linii, 863 KB martwego kodu** (plus 39 plików testowych,
5 654 linie). `ResultsOwnerReviewEntry.tsx` to 13 linii bezwarunkowego `Navigate` — zero flag
mimo nazwy; `<ResultsHub` nie występuje w żadnym pliku produkcyjnym; barrel eksportuje hub,
ale **nikt tego barrelu nie importuje**. Dwa mechaniczne bezpieczniki blokują powrót huba na trasę.

★ **SPROSTOWANIE POPRZEDNIEJ WERSJI TEJ POZYCJI.** Pisałem tu, że cięcia nie wolno tknąć,
bo „część tej wtyczki jest w aktywnym, osobno flagowanym rozwoju". **To była migracja, nie rozwój.**
Karta naprawcza i diagnostyka odchyleń mają żywy, osiągalny odpowiednik pod trasą
`/results/kpi/:kpiId/deviation-cases/:caseId` → `ResultsVNext/kpiTool/KpiDeviationCaseSubview.tsx`
(1260 linii, pełny cykl w `kpiDeviationApi.ts`). Sierpniowe commity na plikach legacy to
`cut over` i `retire legacy writers`; ostatni funkcjonalny to 2026-08-01.

**Trzy grupy do decyzji:**
- **Bez ryzyka od razu** — 3 pliki, 44 linie (ślepy `index.ts` + dwa stuby).
- **2a: ~15 000 linii z odpowiednikiem w VNext** — czysta redukcja długu, nic nie ginie.
- **2b: ~4 000 linii BEZ odpowiednika** — wallboardy i harmonogramy KPI, konektory, raporty KPI
  ze snapshotami, `StrategicLayerPanel`, `AIInsightsPanel`, `ValueDriverTree`,
  `TransformationScorecard`, `M14HandoffInbox`. **Tu cięcie kasuje funkcję, nie tylko kod.**

**Warunek techniczny każdego cięcia:** pięć miejsc czyta te pliki przez `readFileSync`
(m.in. `resultsCutover.registry.test.ts` w sześciu punktach). Bez zdjęcia ich razem z plikami
CI padnie na `ENOENT` — co wygląda jak regresja, a jest martwym strażnikiem.

**Pułapka nazwy katalogu:** `src/components/Execution/CorrectiveActions.tsx` (548 linii) leży
w katalogu Realizacji, ale jedynym wołaczem jest `ResultsHub`. Przy cięciu „katalogu Results"
zostanie przeoczony.

**Dwa błędy dokumentacyjne do sprostowania niezależnie od decyzji:**
`server/src/services/results/resultsWriterInventory.ts:81` opisuje ResultsHub i trzy inne jako
„live production UI callers" — nieprawda od 24.08, a `KPICreateModal` w tym katalogu nie istnieje
(jest w `Benefits/`). `tests/components/Results/KPICreateModal.v8-write.test.tsx` importuje
nieistniejącą ścieżkę; ten sam duch siedzi w dwóch plikach baseline.

★ **Znalezisko poboczne, ale rodzinne:** `isResultsFlagEnabled` kończy się
`return !isPublicProductionHost(...)`, więc mimo nagłówka „default OFF, live-safe" **wszystkie
flagi tej rodziny czytają jako ON na demo, stage i dev**. Tu bez skutku, bo hub się nie renderuje
— ale to ten sam wzorzec, który już raz kosztował sesję.

### 286 · Rodzina podglądu — WYKONANA, z dużym sprostowaniem
Rejestr: `waves/WAVE_03_ACCEPTANCE/REJESTR_PODGLAD_RODZINA_20260902.md`.
Zrzuty PO: `evidence/grafika/podglad-naprawa-20260902/`.

**Zmierzone: 51 plików rozpada się na 29 żywych właścicieli layoutu, 13 „martwego kodu"
i ~9 komponentów treści.**

★★★ **SPROSTOWANIE Z 2026-09-02 WIECZOREM: z tych 13 martwe były DWA, nie trzynaście.**
Dwanaście „osieroconych kolejek decyzyjnych" w `src/components/MyWork/*Queue.tsx` **ma żywego
wołacza** — każda ma dedykowany, zielony test jednostkowy w `tests/unit/initiatives-execution/`
(18/18 PASS), a `tests/unit/**` jest w `include` konfiguracji vitest, więc realnie wchodzi do CI.
Dziesięć z nich jest dodatkowo renderowanych w harnessie e2e
`tests/e2e/fixtures/initiatives-execution-aco.tsx` z własnym configiem Playwrighta.
Zweryfikowane niezależnie przez nadzorcę: 62 pliki testowe w tym katalogu, `tests/unit` w linii 231
`vitest.config.ts`, 22 odwołania do kolejek w harnessie.

**Skąd wziął się błąd:** test `MyWorkHub.decisionsOwnerFeedback.test.ts` asercją `not.toContain`
dowodzi, że **produkcyjny `MyWorkHub` ich nie montuje** — i to zostało odczytane jako dowód
martwoty. Dowodzi tylko tego, co mówi. **„Nie renderuje się w produkcji" to nie to samo co
„martwy"**; obok produkcji istnieje pełna, żywa powierzchnia testowa.

Realnie usunięte: `Benefits/BenefitsHub.tsx` (884 linie) i `Benefits/KPICreateModal.tsx`
(465 linii) — **1349 linii, zero importerów, potwierdzone `git grep` po całym repo**. Z 29 żywych zmierzono 20; sześć miało lukę.

★★★ **SPROSTOWANIE, KTÓRE ZMIENIA SPOSÓB CZYTANIA KAŻDEJ NASZEJ LICZBY:**
**trzy z sześciu „defektów produktu" to był kłamiący przyrząd, nie produkt.**
Hosty harnessu (`dev-render/screens/*.tsx`) miały korzeń `min-h-screen` albo `80vh` —
czyli wyłącznie `min-height`, przy `height: auto`. Wysokość procentowa dziecka nie ma się
wtedy do czego odnieść (CSS 2.1 §10.5) i layout zapada się do wysokości treści.
**Łańcuch przodków w realnym produkcie był już poprawny.**

- `FinanceHub` 263 px → **przyrząd**, produkt nietknięty
- `ExecutionReportsSurface` 216 px → **przyrząd**; ta sama zakładka przez prawdziwe Menu 1 mierzy 0 px
- `VaultSafesTable` 200 px → **przyrząd**, produkt nietknięty
- `PlanScenarioSurface` 92 px → **realny defekt produktu**, naprawiony
- `CapacityScenarioSurface` 67 px → **realny defekt produktu**, naprawiony
- `ChatSignalsFeed` 58 px → **realny defekt produktu**, naprawiony; pozostałe 58 px w domyślnych
  danych to przycisk „Pokaż starsze" (34 px) plus jego margines (24 px), nie luka —
  potwierdzone drugim zestawem danych, gdzie wychodzi 0 px

★ **Wykonawca NIE zmienił listy ekranów w kanonicznym skrypcie**, żeby wynik wyszedł zielony —
jawnie napisał, że to wyglądałoby na naciąganie progu. To jest zachowanie, którego wymagamy.

**Reguła do stosowania przy KAŻDYM przyszłym pomiarze wysokości:** zanim zgłosisz lukę jako
defekt produktu, **porównaj łańcuch przodków w harnessie z łańcuchem w realnej trasie**.
Jeśli host harnessu ma `min-h-*` albo `*vh` tam, gdzie produkt ma `h-full`, mierzysz przyrząd.

**Pozycje otwarte:** `ResultsVNextRegistryShell` nie ma znacznika `data-preview-pane`, więc
przyrząd go nie widzi mimo działającego podglądu. `DecisionsPanelContent` — produkcyjny ekran
decyzji w Mojej Pracy — **nie ma żadnego ekranu w harnessie**, więc nigdy nie trafi do przeglądu.
Zauważony przy okazji nakładający się tekst w kolumnie nazwy Sejfu (osobne zgłoszenie).

### 287 · Trzy dziury cross-org — weryfikacja, czy naprawdę zamknięte
`SCIEZKA_WYJSCIA_V2.md` §A wymienia je jako blokujące odbiór: wnioski o uprawnienia, wideo,
kontekst AI (ten ostatni ma **dwie** trasy, nie jedną). Opisane jako „wygaszone flagą na demo,
żywe kodowo wszędzie indziej”. **Zweryfikować parą dowodów: obcy NIE widzi + właściciel widzi**,
na realnym łańcuchu — sam fail-closed nie wystarcza, bo bywa zielony przez wygaszenie kontekstu.

### 288 · Rodzina „surowe ID zamiast etykiety”
Z dyżuru Finansów: `base_period_id` okazał się ogólniejszy niż zakładano — to dowolny okres
zakotwiczenia pakietu. Naprawiono okres otwarcia i zakotwiczenia, ale **rodzina może mieć dalsze
wystąpienia** w innych modułach. Szukać po wzorcu sklejania, nie po napisie.

### 289 · Rozliczenie 77 uwag z rejestru odbioru
`waves/WAVE_03_ACCEPTANCE/BACKLOG_UWAG_ODBIORU_20260902.md` — 77 uwag właściciela z własnymi
identyfikatorami. **Hipoteza warta zmierzenia:** duża część jest już naprawiona i nigdy mu nie
pokazana — tak było dziś z kartą ROI, przyciskiem w Finansach i wysokością podglądu. Dyżur:
dla każdej uwagi ustalić stan (zrobione / drobne / realny backlog) i dla „zrobione” **przygotować
zrzut do pokazania**, nie kolejną naprawę.

### 290 · `W5` — staging
Dystans **668 commitów**. Kolejność z `SCIEZKA_WYJSCIA_V2.md`: obejrzeć 10 cudzych commitów
`develop` → punkt bezpieczny → decyzja o flagach → pchnięcie (wdrożenie automatyczne) → **migracje
na pustej bazie**. ★ **Nie wydawać przed zamknięciem 281** — dziś na świeżym PostgreSQL rejestracja
użytkownika nie przechodzi. Staging dostanie pustą bazę i trafi dokładnie w to.

### 291 · `G19`/`G20` — finalny przebieg 16/16
Zero na szesnaście, obie. Z natury **ostatnie**: `G19` to obowiązki regresyjne po późniejszych
zmianach, `G20` to finalny przebieg wszystkich szesnastu. Wydać dopiero, gdy 279, 280, 282, 284
mają zamknięte rejestry.

## Reguły, które muszą wejść do KAŻDEJ instrukcji z tej kolejki

1. **Zdanie „zmierz moje liczby sam”.** Dziś złapało trzy fałszywe tezy nadzorcy w jedno
   popołudnie: nieistniejącą „rodzinę trzech” w Materiałach, poprawkę podglądu rzekomo
   niewniesioną (była już przodkiem bazy) i zakres `base_period_id`.
2. **Commit po każdej pozycji `R`, nigdy na koniec.** Instrukcja na 1394 linie urwała okno
   wykonawcy po fazie wejściowej, z zerem commitów.
3. **Jawne prawo zatrzymania.** Częściowy rejestr z uczciwą granicą jest pełnowartościowym
   wynikiem; rejestr z domysłami nie jest wart nic.
4. **Pomiar poza `vitest`.** `tests/setup.ts:858-896` podmienia `global.fetch` na atrapę
   zwracającą zawsze `ok:true`. Dowód idzie skryptem `npx tsx`.
5. **Potwierdzenie odczytem na zimno**, nigdy odpowiedzią zapisu — `Database.ts:686` zwraca
   `changes:1` dla każdego `UPDATE`, także takiego, który nic nie trafił.
6. **`NODE_ENV=test` bez `RUN_DB_TESTS=1`** podstawia atrapę bazy pod `DbPromise`. Bramkę
   `databaseTargetResolver.ts:152` na lokalny `127.0.0.1` otwiera się `CI=true`, **nie**
   `NODE_ENV=test`.
7. **Zero Railway, zero demo/stagingu/produkcji — nawet do odczytu.** Jednorazowy lokalny
   PostgreSQL, kasowany po pomiarze.
8. **Zrzuty tylko kanonicznym narzędziem**, z liczbami różnicy jasny/ciemny i bez kontrolek
   harnessu w kadrze.
