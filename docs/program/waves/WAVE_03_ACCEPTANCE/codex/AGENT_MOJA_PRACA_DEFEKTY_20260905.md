# Moja Praca — pięć defektów z pomiaru na żywo 05.09

Gałąź: `agent/moja-praca-defekty-20260905` (baza: `a3af36b61b`, linia m03)
Worktree: `/private/tmp/ag-mywork-fix`
Źródło zleceń: `evidence/odbior-zywo-20260905/02-moja-praca/{RAPORT.md,wyniki.json}`
Zrzuty PO: `evidence/moja-praca-20260905/`

## Commity (po jednym na defekt)

| # | SHA | Defekt |
|---|-----|--------|
| 1 | `3a47a665d6` | `karta-decision` / `decision-record` — brakująca trasa `GET /api/decisions/:id/history` |
| 2 | `468318d3a5` | `mywork-notebook-rail-speca` — główka prawego panelu Notatnika |
| 3 | `546671f090` | `idea-templates-catalog` — katalog szablonów bez kategorii i plakietek |
| 4 | `eeea890986` | `idea-table-tool-empty-filter` — jeden komunikat na dwa różne stany pustki |
| 5 | `e2a1613eae` | `idea-table-record-templates` — menedżer szablonów rekordu nieosiągalny |

Każdy commit ma test + **dowód mutacyjny** (mutacja celuje w to, co naprawiono,
a nie w mechanizm obok).

---

## 1. Decyzje — `GET /api/decisions/:id/history` (404 ×2)

**Zmierzony objaw.** Otwarcie karty decyzji logowało dwukrotnie
`HTTP 404 GET /api/decisions/<id>/history`; sekcja HISTORIA nie miała źródła danych.

**Zmierzona przyczyna.** Wołacz istniał od dawna —
`Api.getDecisionHistory` w `src/services/api.ts:6622`, konsumowany przez
`DecisionDetailView.tsx` (~L2404). Brakowało **wyłącznie trasy serwera**:
`server/src/routes/pmo/decisions.routes.ts` miał `/:id/detail`, `/:id/stakeholders`,
`/:id/created-tasks` — ale nie `/:id/history`. Tabela `decision_history` istnieje i jest
zapisywana w sześciu miejscach `DecisionController.ts`; `/:id/detail` już ją rzutuje na
pole `auditTrail`.

**Naprawa.**
- `server/src/controllers/DecisionController.ts` — nowy `getDecisionHistory`
  (czyta `decision_history` + `users`, to samo zakresowanie organizacją co sąsiedzi:
  cudzy rekord = 404, nigdy 403 — bez wyroczni istnienia).
- `server/src/routes/pmo/decisions.routes.ts` — `router.get('/:id/history', …)`
  obok siostrzanej `/:id/detail`.

**Test.** `server/src/routes/__tests__/decision-history-route.pg.test.ts` — realny
`ApiGateway` + realny PostgreSQL (własny kontener `pgvector/pgvector:pg16` na porcie
5477, `migrate.postgres.ts`, 1803 tabele). Bez atrapy bazy: `Database.ts` zwraca
`changes: 1` dla każdego UPDATE, więc zapisów nie wolno mierzyć na atrapie. **3/3 zielone.**

**Dowód mutacyjny (2×).**
- usunięcie trasy → `expected 404 not to be 404` (1 failed);
- usunięcie sprawdzenia organizacji → `expected 200 to be 404` (1 failed).

**Sprawa „dane zostają w pamięci przeglądarki" (zgłoszenie właściciela 30.08) — pomiar.**
W `DecisionDetailView.tsx` nie ma dziś ŻADNEGO komunikatu o pamięci przeglądarki.
Mechanizm istniał (`consultify-decision-enhancements:<org>:<user>:<id>` w `localStorage`)
i został zamknięty wcześniej pod MW-DEC-001: komentarze / alternatywy / ryzyka /
uzasadnienie idą na serwer przez `/detail`, `escalation` przez
`PUT /decisions/:id/enhancements` (L2527, migracja
`20261912_decision_enhancements_escalation.sql`). `localStorage` jest już tylko
cache'em odczytu z jawnym zabezpieczeniem przed nadpisaniem świeżej odpowiedzi
serwera. **Realną, niedomkniętą częścią tego zgłoszenia była wyłącznie historia** —
i to zostało naprawione.

**Czego NIE dało się sprawdzić wzrokiem.** Zrzut `01-karta-decyzji.png` dalej pokazuje
dwa 404 w konsoli, bo lokalny vite proxuje API do **stagingu**, a staging nie ma jeszcze
mojej trasy. Dowodem jest test integracyjny na realnej bazie, nie zrzut. Po wdrożeniu
serwera 404 znikną — do potwierdzenia po deployu.

**Uwaga poboczna z pomiaru (NIE naprawiana).** Nad akordeonem doszedł przycisk
„Zgłoś do recenzji" (`Wyślij do przeglądu`), którego na zatwierdzonym obrazie nie było.
Zostawiam do decyzji właściciela — to dodana funkcja, nie regresja układu.

---

## 2. Notatnik — główka prawego panelu

**Zmierzony objaw.** Główka pasa pokazywała tytuł notatki + „×"; zatwierdzony obraz ma
dwuwierszową główkę: nadkreślnik **NOTEBOOK** + **Szczegóły notatki**.

**Naprawa.** `src/components/MyWork/notebook/NotebookRightRail.tsx` — główka `specAPanel`
dostała tę samą, dwuwierszową strukturę, którą ma powłoka
`IdeaNotebookRightPanelPrototype`. Tytuł notatki stoi już w nagłówku dokumentu na lewo
od pasa, więc powtarzanie go zabierało jedyny wiersz główki nie niosąc informacji.
Klucze `notebook.rightRail.eyebrow` / `.panelTitle` (pl + en).

**Flaga NIETKNIĘTA.** `ideaNotebookRightPanelPrototypeFlag` bez zmian (decyzja
właściciela w toku) — zmiana dotyczy wyłącznie ścieżki domyślnej.

**Test.** `NotebookRightRail.behavior.test.tsx` — nowy przypadek „renders the approved
two-line panel header, not the note title". **15/15 zielone.**
**Dowód mutacyjny.** Przywrócenie starej główki → `Unable to find an element with the
text: Notebook` (1 failed).

**Zrzut PO.** `evidence/moja-praca-20260905/02-notatnik-panel-po.png` — główka
„NOTEBOOK / Szczegóły notatki", 0 błędów konsoli.

### Pozostałe różnice z `wyniki.json` — pomiar, świadomie NIE „wyrównane"

Zgłoszenie wymieniało jeszcze dwie różnice; **obie okazały się artefaktem przyrządu, nie
defektem produktu**:

- Zatwierdzony obraz pochodzi z katalogu `302-flaga-on` i jest renderem **prototypu z
  danymi zastępczymi** (`fallbackSections` w
  `IdeaNotebookRightPanelPrototype.tsx:56-77`): „Anna Kowalska", „Szkic", wszystkie
  liczniki = 0.
- Dlatego **AKCJE** na obrazie to dwa gołe przyciski (czarny „Udostępnij" + obwiedziony
  „Kopiuj link"), a w aplikacji lista realnych akcji (Eksportuj PDF·Word, Udostępnij,
  Kopiuj link — wyszarzony z powodem, Historia wersji);
- i dlatego **WŁAŚCIWOŚCI** na obrazie mają dwa pola, a w aplikacji kilkanaście
  **prawdziwych** (Status zapisu, Właściciel, Widoczność, Weryfikacja, Przegląd, Tagi,
  Zmodyfikowano / Liczba słów / Ostatnio sprawdzono, „Oznacz jako sprawdzone").

Sprowadzenie realnych właściwości do dwóch pól atrapy **byłoby usunięciem działającej
funkcji**, więc tego nie zrobiłem. Główka to jedyna różnica, która jest realną różnicą
powłoki — i ta została naprawiona. **Do decyzji właściciela**, czy prototypowy zestaw
sekcji ma zastąpić obecny (to jest dokładnie ta decyzja, która wisi przy fladze).

---

## 3. Idee — katalog szablonów

**Zmierzony objaw.** Zatwierdzony obraz: ~40 szablonów w SIEDMIU nazwanych kategoriach
(Strategia · Operacje/Lean · Finanse · Cyfryzacja/AI · Ludzie/Zmiana · Klient/Wzrost ·
PMO), karta z opisem i plakietkami sekcji/kolumn. Aplikacja: płaska siatka bez nagłówków
kategorii i bez plakietek.

**Zmierzona przyczyna — to NIE był inny komponent ani inna lista.** Galerię renderuje
`IdeaTemplateGallery.tsx`, która **już importowała** `CONSULTING_TEMPLATES` (40 pozycji z
`ideaConsultingTemplates.ts`). Każdy szablon miał pole `catalogGroup`, a obok stał gotowy,
wyeksportowany `CONSULTING_TEMPLATES_BY_GROUP` — **którego nikt nigdy nie wołał**
(biblioteka bez wywołania). Brakowało wyłącznie renderu.

**Naprawa.**
- grupowanie po `catalogGroup` w kolejności `CONSULTING_CATEGORY_ORDER`, nagłówek
  sekcji (`role="region"` + `heading`) i licznik. Grupowanie idzie **po** przefiltrowanej
  liście, więc chipy zakresu/kategorii działają jak dotąd, a pusta grupa znika;
- szablony bez `catalogGroup` (starszy zestaw canvas) trafiają do jawnie nazwanej grupy
  „Pozostałe" — nie chowam ich i nie udaję, że należą do którejś z siedmiu kategorii;
- nowy `src/components/MyWork/ideaTemplateSeedSummary.ts` liczy kształt seeda z
  **realnych** `nodes`/`extensions` (sekcje / gałęzie / kolumny+wiersze / pasy+kroki);
  osobne pole opisowe rozjechałoby się z seedem przy pierwszej edycji szablonu i katalog
  kłamałby o zawartości;
- karta dostaje drugą nazwę (EN pod PL), linię licznika i plakietki nazw.

**Test.** `src/components/MyWork/__tests__/ideaTemplatesCatalog.20260905.test.tsx` — **5/5.**
Atrapa i18n czyta **realny** `public/locales/pl/translation.json` (klucz może istnieć i
trzymać angielskie słowo; „9 sekcji" to forma mnoga, której atrapa zwracająca klucz nie odda).
**Dowód mutacyjny (2×):** usunięcie grupowania → brak roli `heading`/`region` „Strategia"
(2 failed); usunięcie licznika seeda → brak tekstu „9 sekcji" (1 failed).
**Regresja:** `IdeaTemplateGallery.l06.test.tsx` 4/4 zielone.

**Zrzuty PO.**
- `03-galeria-szablonow-whiteboard-po.png` — „Strategia 6", karty z PL+EN, „9 sekcji",
  plakietki „Key Partners / Key Activities / …";
- `03-galeria-szablonow-po.png` (kanwa mapy myśli) — „Strategia 1", „Operacje / Lean 1",
  „6 gałęzi" + nazwy gałęzi.

**POMIAR, którego zlecenie nie zakładało — do wiadomości właściciela.** Galeria filtruje
po `activeTool` (`ALL_TEMPLATES.filter(t => t.tool !== activeTool)`), więc **jedna kanwa
nigdy nie zobaczy wszystkich 40** — czterdziestka rozkłada się na cztery narzędzia
(whiteboard / mindmap / table / process_flow). Zatwierdzony obraz to render katalogu
`#10-AB` z dev-render, który pokazuje **wszystkie cztery naraz**, bo nie jest oknem
„zastosuj na tej kanwie". Zdjęcie filtra sprawiłoby, że szablon tablicy dałoby się nałożyć
na mapę myśli. **Nie zdejmowałem go** — jeśli katalog ma być przeglądarką całej
czterdziestki niezależnie od kanwy, to osobna decyzja produktowa.

---

## 4. Idee / Tabela — dwa uczciwe stany pustki

**Zmierzony objaw.** Tabela z sześcioma wierszami, po wpisaniu w filtr frazy bez trafień
(„zzzzqqq"), pokazywała „Tabela jest jeszcze pusta / Zacznij od struktury: wybierz
framework, dodaj pierwszy wiersz lub użyj szablonu" wraz z przyciskami *Dodaj pusty
wiersz / Użyj szablonu wiersza / Zbuduj framework*. To kłamstwo o stanie danych: rekordy
SĄ, schowała je zawężająca fraza — użytkownik czyta „nic tu nie ma" i zaczyna budować od
zera to, co już zbudował.

**Naprawa.**
- nowy `src/components/MyWork/table/tableEmptyState.ts` rozstrzyga między `'no-records'`
  a `'no-filter-results'`. Sam FAKT istnienia pola filtra nie wystarcza — pusta fraza i
  zerowa lista reguł to brak filtra, nie „filtr bez trafień";
- stan „brak wyników filtra" ma własny nagłówek, zdanie z liczbą ukrytych wierszy i
  JEDEN przycisk „Wyczyść filtr" (czyści i frazę, i reguły per kolumna) — bez zachęty do
  budowania struktury;
- stan „brak rekordów" bez zmian.

**SILNIK TABELI NIETKNIĘTY** — wiersz filtrów per kolumna i gęstość wierszy bez zmian
(decyzja właściciela).

**Test.** `src/components/MyWork/table/__tests__/tableEmptyState.20260905.test.ts` — **7/7.**
Test spina **realny kod filtrujący** (`useTableRows` przez `renderHook`) z kodem
decydującym o komunikacie, bo zepsuty był właśnie ten szew, a nie żadna z połówek osobno.
**Dowód mutacyjny (2×):** usunięcie gałęzi `'no-filter-results'` (czyli odtworzenie
oryginalnego defektu) → `expected 'no-records' to be 'no-filter-results'` (2 failed);
odpięcie gałęzi w renderze → kontrakt źródłowy czerwony (1 failed).

**Zrzut PO.** `04-pusty-filtr-po.png` — „Brak wyników filtra / Jedyny wiersz nie pasuje do
bieżącego filtra… / Wyczyść filtr". (Forma pojedyncza, bo ta konkretna tabela ma jeden
wiersz — mnogie warianty są w kluczach `_few`/`_many`.)

---

## 5. Idee / Tabela — menedżer szablonów REKORDU

**Zmierzony objaw.** Menedżera z obrazu („Szablony rekordów", „+ Nowa", karty z
plakietkami wypełnionych pól) nie dało się otworzyć klikaniem. Pozycja „Szablony" w
„Więcej narzędzi" otwierała **galerię szablonów TABEL**, a strzałka przy przycisku
„Wiersz" — popover „SZABLON WIERSZA". Trzy różne rzeczy pod prawie tą samą nazwą.

**Zmierzona przyczyna — inna niż hipoteza w zleceniu.** Komponent **NIE był martwym
montażem**. `RecordTemplateManager` jest importowany (`IdeaTableTool.tsx:175`) i
renderowany (`:4909`) od RISK-06. Pozycja menu była **UKRYTA** warunkiem
`show: usePlatform`, bo tabela chodziła na silniku zastanym. Właściciel widzi ukrytą
pozycję jako brak funkcji i klika sąsiednie „Szablony".

**Naprawa.**
- pozycja „Szablony rekordów" zawsze widoczna; poza trybem platformowym **wyszarzona z
  jawnym powodem**, a nie klikalna-i-zepsuta. Nie odsłaniam jej na siłę: backend
  `GET /tables/:tableId/record-templates`
  (`server/src/routes/table-platform.routes.ts:5087`) czyta `tp_tables`, którego w trybie
  zastanym nie ma — otwarcie okna skończyłoby się „Nie udało się wczytać szablonów";
- `TableBarOverflowItem` dostaje pole `disabledReason` (renderowane jako `title`);
- sąsiednia pozycja przemianowana na **„Szablony tabeli"** / „Table templates" — kolizja
  nazw była połową defektu.

**Test.** `src/components/MyWork/table/__tests__/recordTemplatesEntry.20260905.test.tsx` —
**5/5**; renderuje **realne** menu i klika obie pozycje w obu trybach.
**Dowód mutacyjny (2×):** usunięcie renderu `disabledReason` → `title` = null (1 failed);
przywrócenie `show: usePlatform` (oryginalny defekt) → kontrakt pozycji czerwony (1 failed).
**Regresja:** `dialogA11y.batch4.test.tsx` 6/6 zielone.

**Zrzut PO.** `05-szablony-rekordow-po.png` — w jednym menu widać „Szablony tabeli"
(sekcja WIĘCEJ) i wyszarzone „Szablony rekordów" (sekcja PLATFORMA). Zrzucony tekst menu
w `.png.json`.

---

## Pomiar dodatkowy: który komponent renderuje tabelę Pomysłów

Zlecenie kazało tego **nie zmieniać**, tylko zmierzyć.

- **W aplikacji** (`/my-work/ideas/<id>/workspace/table`) tabelę renderuje
  `src/components/MyWork/IdeaTableTool.tsx` — jeden komponent z dwiema ścieżkami danych
  wybieranymi przez `usePlatform`
  (`IdeaTableTool.tsx:490`: `platformActive && !(platformLooksEmpty && legacyLooksPopulated)`).
  W zmierzonej sesji **`usePlatform` było fałszem** (dowód pośredni: cała sekcja PLATFORMA
  w kebabie była pusta), więc dane szły ścieżką zastaną: `useTableRows` +
  `useTableViews`, a `<table>` rysuje JSX wewnątrz `IdeaTableTool` (nagłówki, `renderRow`,
  `tfoot` z agregacjami).
- **`platformActive`** zależy od flagi `tablePlatformMetadataFirst`
  (`useTablePlatformBridge.ts:162`), nie od `VITE_MELS_TABELE`.
- **Na obrazie odniesienia** (dev-render) był **inny komponent** — `PlatformGridView`
  (ścieżka platformowa), stąd na obrazie wiersz filtrów per kolumna i inna gęstość
  wierszy, których wersja zastana nie ma.
- To jest źródło rodziny rozbieżności `idea-table-tool-*` z pomiaru (grupowanie, kebab,
  sortowanie/filtr, oś czasu): **porównywano dwa różne silniki tabeli**, a nie tę samą
  tabelę przed i po. Decyzja, który silnik jest docelowy, należy do właściciela.

---

## Środowisko pomiaru

- Własny vite na **:3071** (`--strictPort`), kopia `.env.local` z m03 (API proxy →
  staging). Zatrzymany po PID (`kill 87249`), port zwolniony.
- Własny PostgreSQL: kontener `ag-mywork-pg` (`pgvector/pgvector:pg16`, port **5477**),
  `migrate.postgres.ts --safe` → 1803 tabele. **Usunięty po pracy** (`docker rm -f`).
- Sesja z `ODBIOR_AUTH_STATE`; token czytany programowo, nigdy nie wypisany.
  Kopia stanu z przepisanym origin na `:3071` (Playwright trzyma `localStorage`
  per-origin) — **skasowana** po zrzutach.
- Zrzuty: kopia `scripts/dev/odbior-zywo/zrzut.mjs` z portem 3071, jasny motyw, 1440 szer.
  Kopia skryptu **usunięta** z drzewa, nie jest commitowana.
- Do bazy stagingu/demo **nie było żadnego zapisu** — wyłącznie GET-y przeglądarki.

### Przeszkoda, którą trzeba odnotować

Dysk był **w 100% zajęty** (116 MB wolnego; nawet pliki tymczasowe powłoki padały na
`No space left on device`). Pierwsze `git worktree add` zginęło w połowie checkoutu.
Nie usuwałem cudzych katalogów (38 GB `fz118-hardprobe` ma **żywe procesy** i należy do
innego projektu — FizzUp; sześć worktree z sesji 02.09 to nie moja własność).
Zamiast tego zrobiłem **rzadki (sparse) worktree** bez `evidence/` — 1,3 GB zamiast ~3 GB,
`node_modules` dowiązane symbolicznie do `Consultify/node_modules` (ten sam wzorzec, co
u sąsiednich agentów). Warto to posprzątać niezależnie od tego dyżuru.

## Do decyzji właściciela (nic z tego nie zostało zrobione)

1. Czy prototypowy zestaw sekcji panelu Idei/Notatnika (dwa pola właściwości, dwa
   przyciski akcji) ma zastąpić obecny, bogatszy — to jest ta wisząca decyzja przy fladze.
2. Czy katalog szablonów ma pokazywać wszystkie 40 pozycji niezależnie od aktywnej kanwy
   (dziś filtruje po narzędziu, żeby nie dało się nałożyć tablicy na mapę myśli).
3. Który silnik tabeli Pomysłów jest docelowy (zastany vs platformowy) — od tego zależy
   cała rodzina `idea-table-tool-*` i widoczność „Szablonów rekordów".
4. Przycisk „Zgłoś do recenzji" na karcie decyzji, którego nie ma na zatwierdzonym obrazie.
