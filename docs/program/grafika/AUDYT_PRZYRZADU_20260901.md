---
doc_id: grafika-audyt-przyrzadu-20260901
status: canonical
truth_type: audit
established: 2026-09-01
zakres: wszystkie 240 plików `dev-render/screens/*.tsx` + rejestr `dev-render/main.tsx` (345 wpisów) + katalog odbioru `docs/program/grafika/status.json` (313 ekranów)
metoda: przemiatanie mechaniczne całości + porównanie z REALNYM wołaczem w `src/` dla 85 ekranów podejrzanych
zrzuty: evidence/grafika/177-audyt-przyrzadu/ (9 plików, motyw jasny)
powod: defekt 175 — właściciel trzy razy zgłaszał podgląd niezgodny ze wzorem, a przyczyną był harness, nie produkt
---

# Audyt przyrządu — ile ekranów harnessu pokazuje właścicielowi co innego niż produkt

## Powód

31.08–01.09 właściciel **trzy razy** zgłosił, że podgląd na ekranie `idea-table` jest
niezgodny ze wzorem. Dwie naprawy poszły w produkt, który był zgodny z kanonem.
Dopiero trzeci pomiar pokazał przyczynę: ekran harnessu dokładał z prawej
`ArtifactRightPanel` (~440 px), którego produkcja nie ma — podgląd spadał z kanonicznych
403 px na dno `clamp()` (340 px) i pokazywał dane zmyślone w harnessie, sprzeczne z treścią
podglądu. Właściciel oceniał kompozycję, która nie istnieje w produkcie
(`evidence/grafika/175-preview-wzor/`, commity `fb761cd567`, `8021681555`).

Pytanie tego audytu: **ile jeszcze ekranów robi to samo.**

Odpowiedź: **przypadek `idea-table` nie był odosobniony.** Znalazłem **41 ekranów**
z udokumentowaną rozbieżnością wobec produkcji, z czego **29 jest dziś w odbiorze z oceną
A lub B**. Co gorsza — **`idea-table` po wczorajszej naprawie NADAL nie pokazuje produktu**
(patrz Przypadek 1).

## Metoda

1. **Przemiecenie mechaniczne (240/240 plików).** Skrypt jednorazowy wyciągnął z każdego
   pliku: komponenty produkcyjne montowane w JSX (importy `@/…`, `../../src/…` **oraz**
   `React.lazy(() => import(…))` — bez tego trzeciego wzorca 8 ekranów fałszywie wygląda
   na atrapy), krotność montażu, klasy `max-w-*` / `w-[Npx]`, liczbę `<div>` własnych
   harnessu, powiązanie z rejestrem `main.tsx` i oceną w `status.json`.
2. **Detektor kompozycji.** Zbudowałem indeks „który plik w `src/` renderuje który
   komponent" i sprawdziłem, czy para komponentów montowanych RAZEM w harnessie
   występuje razem w choć jednym pliku produkcyjnym. Para, która nigdy nie współwystępuje,
   = kompozycja wymyślona w harnessie. **Ten detektor wyłapuje defekt 175 retrospektywnie.**
3. **Porównanie z wołaczem (85 ekranów).** Dla każdego podejrzanego ekranu: `grep` na
   `<Komponent` w `src/`, odczytanie otoczenia w realnym wołaczu (kontener, klasy, sąsiedzi),
   werdykt ZGODNY / ROZBIEŻNY / BEZ WOŁACZA. Nie zgadywałem po nazwach.
4. **Zrzuty kontrolne** dla 9 ekranów (`evidence/grafika/177-audyt-przyrzadu/`) — patrzenie
   oczami, bo dwa defekty (pusty kadr w `mywork-notebook-rail-speca`, jeden modal zamiast
   trzech w `mindmap-i18n-smoke`) są niewidoczne w kodzie.

Czego metoda **nie** obejmuje: porównania DOM harnessu z DOM produkcji (brak zalogowanego
środowiska — to zresztą powód, dla którego harness w ogóle istnieje).

## Tabela zbiorcza

Ryzyko = szansa, że właściciel ocenia fałszywy obraz. **Wysokie** = ocena A/B (jest dziś
w odbiorze) + rozbieżność zmieniająca to, co widać. **Niskie** = ocena C/D albo ekran, który
sam siebie opisuje jako przyrząd, nie produkt.

### Kategoria 1 — harness dokłada panel/kolumnę/szynę, której produkcja nie renderuje

| ekran | co dokłada harness | wołacz produkcyjny | ocena | ryzyko |
|---|---|---|---|---|
| `idea-table` | `<TopBar>` z `ExecutiveModuleShell` nad tabelą (breadcrumb + „Wróć do pomysłów" + chipy) | `MyIdeasListContent.tsx:1943` — zero `TopBar`; `<TopBar>` żyje TYLKO w `ExecutiveModuleShell/index.tsx:535` | **B** | **wysokie** |
| `assessment-matryca` | `<TopBar>` + `<ArtifactRightPanel>` wokół `DRDMatrixSession` | `AssessmentSessionEditorView.tsx:1847` — nie ma ani jednego, ani drugiego | C | niskie |
| `notatnik-osierocone-graf` | ręcznie narysowana prawa kolumna „soczewka Osierocone" (`w-[360px]`) obok realnego `NotebookGraphPanel` | `NotebookContent.tsx:4256` — panel stoi sam | **A** | **wysokie** |
| `mywork-notebook-rail-speca` | odwrotnie — montuje szynę BEZ notatnika; 2/3 kadru puste + podpis harnessu | `NotebookContent.tsx:4273` | **A** | **wysokie** |
| `tools-swot-initiative-proposal` | ramka karty (`rounded-2xl border`), której `SummaryStep` w produkcji nie ma | `ToolCanvas.tsx:1103` (`h-full overflow-y-auto p-6`) | **A** | średnie |

### Kategoria 2 — sztuczne ograniczenie szerokości nieobecne w produkcji

16 trafień; 14 z oceną A/B.

| ekran | harness | produkcja | ocena | ryzyko |
|---|---|---|---|---|
| `agent-plan-canvas` | `grid-cols-2 max-w-5xl` → dwa panele po ~560 px | `AgentPlanView.tsx:42` pełna szerokość; `AgentPlanPanel.tsx:504` trzy kolumny `w-full` | **A** | **wysokie** |
| `finance-comments-panel` | `max-w-xl` (576 px) | `FinanceWorkspaceUtilities.tsx:75` — wspólna szuflada `w-full` u dołu warsztatu | **A** | **wysokie** |
| `finance-lineage-navigator` | `max-w-xl` | ta sama szuflada, `:94` | **A** | **wysokie** |
| `finance-saved-views-panel` | `max-w-md` (448 px) | ta sama szuflada, `:99` | **A** | **wysokie** |
| `finance-export-import-panel` | `max-w-md` | ta sama szuflada, `:121` | **B** | **wysokie** |
| `document-studio-context-chip` | `max-w-4xl` (896 px) | `DocumentStudioView.tsx:910` — `<main>` bez `max-w`; `IntakeForm.tsx:282` wypełnia całość | **A** | **wysokie** |
| `word-intake-uselm-default` | `max-w-2xl` (672 px) | j.w., ten sam komponent, mocniejsze ściśnięcie | **A** | **wysokie** |
| `report-artifact` | `max-w-3xl` (768 px) | `ExecutionHub.tsx:5248` — w środku `StandardPreview` (kanon 340–480 px) | **A** | **wysokie** (odwrotność: harness POKAZUJE SZERZEJ niż produkt) |
| `notebook-quick-capture` | `max-w-[560px]` | `NotebookContent.tsx:2871` w pasku `w-80` (320 px) | **A** | **wysokie** (j.w. — ~1,9× za szeroko) |
| `ideas-preview-overlay` | `max-w-[1240px]` | `MyIdeasListContent.tsx:2012` — pełna szerokość panelu treści | **A** | **wysokie** (ekran ocenia „siatka trzyma 3 kolumny", a liczba kolumn zależy od szerokości) |
| `superadmin-platform-operations-day15` | `max-w-6xl p-6` | `TabLayout.tsx:102` — pełna szerokość, bez paddingu | **A** | średnie |
| `vault-folder-block-proof` | `max-w-2xl` (672 px) | `AgentPlanPanel.tsx:520` — środkowa kolumna `flex-1` warsztatu 3-kolumnowego | **A** | średnie |
| `materials-registry` | `max-w-[1400px]` | `ReportsAndPresentationsHub.tsx:1396` — brak `max-w` w całym hubie | **B** | średnie |
| `tools-swot-initiative-proposal` | `max-w-3xl` | `ToolCanvas.tsx:1103` | **A** | średnie |
| `tool-outputs-panel` | `max-w-2xl` | `ToolWorkspace.tsx:830` — pasek pełnej szerokości | C | niskie |
| `angielskie-resztki-i18n` | `max-w-3xl` na `MonteCarloNpvPanel` | `FinanceValuePanelsSurface.tsx:39` — pełna szerokość | brak w katalogu | niskie |

Sprawdzone i **ZGODNE** (18 ekranów) — m.in. `chat-signals-feed` (harness cytuje kontrakt
`max-w-[1040px]` z `ChatSignalsPanel.tsx:354`), `preview-4-zakladki` (szerokość liczona
z `contracts/tableSurface/canon.ts:56`), `standard-kanban-card` (`w-[280px]` = dokładnie
`StandardKanban.tsx:84`), `mm-ppm-measure` (celowy przyrząd 1280×720 z kanonu),
`drd-embedded-matrix-axis-levels` (produkcja też centruje dokument).

### Kategoria 3 — kilka stanów/wariantów w jednym kadrze (kolaż)

Uwaga metodyczna: naiwny licznik „`<Komponent>` ×N" daje **11 fałszywych alarmów na 20** —
liczy gałęzie `if/return`, `<Route element={}>`, komentarze i renderery komórek. Poniżej
tylko potwierdzone kolaże (kilka stanów widocznych JEDNOCZEŚNIE).

| ekran | co jest obok siebie | ocena | ryzyko |
|---|---|---|---|
| `canvas-kebab-restructure` | PRZED (mega-kebab) + PO (8 grup) + ramka „MAPOWANIE" — cały ekran jest dokumentem projektowym | **A** | **wysokie** |
| `canvas-toolbar-md-history` | pasek PO + otwarty kebab, dwa stany naraz | **A** | **wysokie** |
| `mindmap-i18n-smoke` | trzy modale zamontowane naraz; są `fixed`, więc **widać tylko jeden** — dwa pozostałe właściciel ocenił „w ciemno" | **A** | **wysokie** |
| `notatnik-osierocone-graf` | graf (realny) + soczewka „Osierocone" (atrapa) — dwie różne dostawy w jednym kadrze | **A** | **wysokie** |
| `prawy-panel-szyna-ikon` | dyptyk PRZED/PO; lewa kolumna to zamrożona lokalna kopia `LegacyBrokenRightRail` | A (Kanon) | niskie¹ |
| `standard-module-bar-children` | sześć wariantów właściwości obok siebie | A (Kanon) | niskie¹ |
| `preview-4-zakladki` | cztery podglądy w rzędzie; plik sam pisze „przyrząd pomiarowy, nie ekran produktu" | A (Kanon) | niskie¹ |
| `tabele-fala2-przed-po` | 6 sekcji `grid-cols-2` PRZED/PO; lewa połowa to ręcznie odtworzony stary CSS | brak w katalogu | niskie |
| `capability-gate-demo` | trzy tryby bramki naraz | brak w katalogu | niskie |
| `drd-embedded-matrix-axis-levels` | trzy macierze naraz; produkcja osadza JEDNĄ (`ReportBuilder.tsx:440`) | brak w katalogu | niskie |
| `menu-dlugi-domkniecie` | dwa niezależne dowody (`AgentHubShell` + `VaultDocumentsView`) w jednym kadrze | brak w katalogu | niskie |

¹ moduł „Kanon i elementy wspólne" z definicji pokazuje wzorce, nie ekrany, a
`standard-module-bar-children` ma to napisane wprost w opisie katalogowym. Uczciwie: to
**nie** są defekty — to jedyna grupa kolaży, która jest w porządku.

### Kategoria 4 — harness montuje coś innego niż produkcja (albo komponent bez wołacza)

| ekran | co montuje harness | co jest w produkcji | ocena | ryzyko |
|---|---|---|---|---|
| `calendar-sync-settings` | **przepisany markup** `CalendarSyncSettings` — zero `useTranslation`, teksty na sztywno po polsku | realny `CalendarSyncSettings.tsx` (325 linii, **22 wywołania `t()`**), montowany w `SettingsView.tsx:455` wewnątrz nawigacji Ustawień | **A** | **wysokie** |
| `chat-split-teresa-right` | atrapa obu stron (`ArtifactMock` + mock czatu) | `SplitLayout.tsx:271` → `UnifiedChatPanel` | **A** | **wysokie** |
| `canvas-new-doc` | odtworzony 1:1 markup menu „+" | `UnifiedChatPanel.tsx:7380` → `WorkCanvasDocumentPanel` | **A** | **wysokie** |
| `canvas-kebab-restructure` | odtworzony markup kebaba, etykiety po angielsku | j.w. | **A** | **wysokie** |
| `canvas-toolbar-md-history` | odtworzony markup paska | j.w. | **A** | **wysokie** |
| `idea-templates-catalog` | własna siatka kart zbudowana z danych `CONSULTING_TEMPLATES` | `IdeaTemplateGallery` montowana w `IdeaMapWorkspace.tsx:5230` | **A** | **wysokie** |
| `tools-swot-live` | `SwotLiveArtifact` — **zero wołaczy w `src/`** | żadna trasa go nie renderuje | **A** | **wysokie** |
| `deck-quality-badge` | `ResultStep` z `PresentationWizard`, a kreator jest w `AppRoutes.tsx:257` opisany jako „redirect-only, unimported" | nieosiągalny | **A** | **wysokie** |
| `rn-g3-class-l-record-shell` | powłoka złożona przez harness (`NModeShell`+`ArtifactBreadcrumb`+`ArtifactPropertiesTable`) — brak takiego złożenia w produkcji | — | A (Kanon) | niskie² |
| `agent-plan-view` | `AgentPlanView` — zero importów w `src/`; nagłówek pliku **twierdzi**, że komponent jest wpięty w `AppRoutes.tsx` — to nieprawda w tej gałęzi | — | C | niskie |
| `finance-value-panels` | `DriverPlannerPanel`, `ValueOfficePanel` — zero wołaczy | `EconomicsView` renderuje `FinanceHub` | C | niskie |
| `siri-tier` | własny widok nad `siriTierView.ts` | brak widoku TIER w produkcie (plik mówi o tym uczciwie) | C | niskie |
| `karta-task-pelna` | re-eksport `karta-task` (33 linie) | ten sam ekran | B | niskie² |

² opis katalogowy sam mówi, że to przykład demonstracyjny / wzorzec. `karta-task-pelna`
to nie defekt, tylko dubel: ten sam ekran figuruje w katalogu dwa razy (podobnie
`karta-insight` i `insight-artifact` montują ten sam `InsightViewer`).

### Kategoria 5 (znaleziona przy okazji) — podpisy harnessu w kadrze

`grafika-zrzuty.mjs:205` ukrywa `[data-dev-render-chrome]` przed zrzutem. Znacznika używa
**21 z 240** plików. Z 39 ekranów, które rysują własne nagłówki `<h1..h3>`, **33 ich nie
oznacza** — te podpisy trafiają na zrzut, który właściciel ocenia. Widać to na
`evidence/grafika/177-audyt-przyrzadu/notatnik-osierocone-graf__PRZED__light.png`
(dwa tytuły sekcji + akapit instrukcji) i `…/mywork-notebook-rail-speca__PRZED__light.png`
(podpis „(centrum: dokument Notatnika — ten harness izoluje wyłącznie prawą szynę)").
To dokładnie defekt opisany w pamięci jako „Przyrząd kłamie, a oko przywyka" — nie został
domknięty, tylko obudowany mechanizmem, z którego prawie nikt nie korzysta.

## Pięć przypadków z dowodem

### 1. `idea-table` (B) — po dwóch naprawach NADAL nie pokazuje produktu

Wczorajsza naprawa (`fb761cd567`) usunęła `ArtifactRightPanel`. Została druga wymyślona
warstwa: **`<TopBar>` z `ExecutiveModuleShell`**.

- Harness: `dev-render/screens/idea-table.tsx:196` — `<TopBar moduleLabel="Moja praca ·
  Pomysły" title="Tabela pomysłów" chips={…} backLabel="Wróć do pomysłów" />`.
- Produkcja: `src/components/MyWork/MyIdeasListContent.tsx:1935-1943` — `IdeasTableContent`
  jest jedynym dzieckiem `<div className="flex flex-col flex-1 min-h-0">`.
  `grep -n "TopBar\|ExecutiveModuleShell" MyIdeasListContent.tsx` → **0 trafień**.
  `grep -n "ExecutiveModuleShell\|<TopBar" MyWorkHub.tsx` (jedyny wołacz, `:4098`) → **0 trafień**.
- `<TopBar>` w całym `src/` jest renderowany w JEDNYM miejscu:
  `src/components/shared/ExecutiveModuleShell/index.tsx:535` — czyli w powłoce artefaktów
  (Tabele/Prezentacje/Document Studio), nigdy w Mojej pracy.
- Dowód: `evidence/grafika/177-audyt-przyrzadu/idea-table__PRZED__light.png` — górny pasek
  „← Wróć do pomysłów · Moja praca · Pomysły › Tabela pomysłów · 5 pomysłów · + Nowy pomysł"
  nie istnieje w produkcie. W produkcie nad tabelą stoi `StandardModuleBar` z Menu 1/2/3.

**Wniosek dla procesu:** naprawa 175 była naprawą jednego objawu, nie klasy defektu. Bez
mechanicznej kontroli druga warstwa przetrwała naprawę wymierzoną dokładnie w ten plik.

### 2. `agent-plan-canvas` (A) — harness odtwarza układ, który produkcja opisuje jako NAPRAWIONY BŁĄD

- Harness: `dev-render/screens/agent-plan-canvas.tsx:37` — `grid grid-cols-2 gap-8 max-w-5xl
  mx-auto`, czyli dwa panele po ~560 px obok siebie.
- Produkcja: `src/views/AgentPlanView.tsx:42` — `flex h-full min-h-[560px] flex-col`,
  `AgentPlanPanel.tsx:504` — `flex h-full w-full items-stretch` (trzy kolumny na pełnej szerokości).
- W `AgentPlanView.tsx:35-40` stoi komentarz, że wąski, dokowany układ **był błędem
  naprawionym** — „zjadał połowę ekranu i wciskał schemat w kilkaset pikseli".
- Właściciel ocenił A na dokładnie tej regresji, podanej dwa razy obok siebie.

### 3. Czwórka paneli Finansów (A/A/A/B) — ocenione jako kartki, w produkcie to jedna szuflada

`finance-comments-panel`, `finance-lineage-navigator`, `finance-saved-views-panel`,
`finance-export-import-panel` są w harnessie wyśrodkowanymi kartami 448–576 px
(`max-w-xl` / `max-w-md`, każdy plik osobno).

W produkcji wszystkie cztery są zakładkami **jednej wspólnej szuflady** u dołu warsztatu
Finansów: `src/components/Finance/shared/FinanceWorkspaceUtilities.tsx:75`
(`aside w-full shrink-0 border-t`), treść w `:91` (`max-h-[42vh] overflow-auto p-4`),
poszczególne panele w `:94`, `:99`, `:121`.

Właściciel ocenił cztery osobne kartki i **ani razu nie zobaczył realnej kompozycji**:
pięć pigułek-zakładek + jeden panel pod nimi, pełna szerokość, wysokość ograniczona do 42 % ekranu.

### 4. `calendar-sync-settings` (A) — kopia markupu bez i18n, podana jako ekran produktu

- Katalog mówi: „Ustawienia → Synchronizacja kalendarza" — czyli miejsce w produkcie.
- Harness (`dev-render/screens/calendar-sync-settings.tsx`) **przepisuje** markup zamiast
  montować komponent; ma **0 wywołań `t()`/`useTranslation`**, teksty wpisane po polsku na sztywno.
- Produkcja: `src/components/settings/CalendarSyncSettings.tsx` — **22 wywołania `t()`**
  (`:36 const { t } = useTranslation()`), montowana w `src/views/SettingsView.tsx:455`
  wewnątrz powłoki Ustawień z lewą nawigacją.
- Skutki: (a) `&lang=en` na tym ekranie pokazuje polski, więc żaden defekt tłumaczeń nigdy
  się tu nie ujawni; (b) kopia rozjeżdża się z oryginałem po każdej zmianie w produkcie;
  (c) harness dokłada `max-w-2xl mx-auto p-8` i wycina nawigację Ustawień.
- Dowód: `evidence/grafika/177-audyt-przyrzadu/calendar-sync-settings__PRZED__light.png`
  — wąska kolumna na pustym tle, bez nawigacji modułu.

Ta sama klasa defektu obejmuje `chat-split-teresa-right`, `canvas-new-doc`,
`canvas-kebab-restructure`, `canvas-toolbar-md-history` (wszystkie A) — cztery ekrany
odtwarzające markup `WorkCanvasDocumentPanel`/`UnifiedChatPanel`, bo realne komponenty
ciągną store i API. Trzy z nich mają etykiety po angielsku („Expand selected idea",
„Most common actions") — czego produkt, przechodzący przez `t()`, nie pokazuje.
Dowód: `…/canvas-kebab-restructure__PRZED__light.png` (dokument PRZED/PO z ramką „MAPOWANIE").

### 5. `mindmap-i18n-smoke` (A) — trzy modale zamontowane, jeden widoczny

- Harness montuje `AssignPersonModal`, `AttachArtifactModal`, `AddEvidenceModal` naraz
  w `flex flex-wrap`, każdy w pudełku `h-[320px] w-[420px]` z własnym podpisem.
- Modale są `fixed inset-0 … items-center justify-center` (`AddEvidenceModal.tsx:38`), więc
  **uciekają z pudełek i nakładają się na siebie** na środku ekranu.
- Dowód: `evidence/grafika/177-audyt-przyrzadu/mindmap-i18n-smoke__PRZED__light.png` —
  widać wyłącznie „Dodaj dowód / źródło". Dwa pozostałe modale, których ekran miał dowieść
  („sprawdza, czy są w całości po polsku" — opis katalogowy), na zrzucie **nie istnieją**.
- Ocena A dotyczy więc jednej trzeciej tego, co ekran obiecuje.

## Proponowany bezpiecznik

**Wybieram: `scripts/check-dev-render-parytet.mjs` + `…​.baseline.txt`** — jeden skrypt,
zero adnotacji do pisania ręcznie, uruchamiany w pre-commit i **obowiązkowo przed każdą
partią zrzutów** (tam, gdzie dziś stoi `check-list-canon.sh`).

Skrypt dla każdego `dev-render/screens/*.tsx` wylicza zbiór montowanych komponentów
produkcyjnych (importy `@/`, `../../src/`, `React.lazy(() => import(…))`) i konfrontuje go
z indeksem „co renderuje co" zbudowanym z `src/**/*.tsx`. Trzy reguły:

- **R1 (błąd) — komponent bez wołacza.** Ekran musi montować ≥1 komponent produkcyjny,
  a każdy montowany komponent musi mieć ≥1 wołacza w `src/` (jako `<X` albo lazy-import
  z pliku tras). Łapie: `calendar-sync-settings`, `chat-split-teresa-right`, trzy ekrany
  `canvas-*`, `idea-templates-catalog`, `tools-swot-live`, `deck-quality-badge`,
  `agent-plan-view`, `finance-value-panels`, `siri-tier` — **12 z 13 pozycji kategorii 4**.
- **R2 (błąd) — kompozycja bez precedensu.** Każda para komponentów produkcyjnych
  montowanych w jednym ekranie musi współwystępować w co najmniej jednym pliku `src/`.
  **Ta reguła łapie defekt 175 retrospektywnie** (`IdeasTableContent` + `ArtifactRightPanel`
  nigdy razem) **i łapie to, co po nim zostało** (`IdeasTableContent` + `TopBar`), a także
  `assessment-matryca` i `menu-dlugi-domkniecie`.
- **R3 (ostrzeżenie) — wymyślona szerokość.** `max-w-*` / `w-[Npx]` na przodku montowanego
  komponentu, jeśli tej samej klasy nie ma u jego wołacza produkcyjnego. Łapie 16 pozycji
  kategorii 2. Jako ostrzeżenie, bo modale i szyny mają własne szerokości (18 zgodnych
  przypadków pokazało, że twarda reguła generowałaby fałszywe alarmy).

`check-dev-render-parytet.baseline.txt` w formacie `<ekran>\t<reguła>\t<jednolinijkowy
powód>` — repo już używa tego wzorca (`check-list-canon.baseline.txt`,
`check-artefakt.baseline.txt`). Wpis w baseline **wymaga powodu**, więc „przyrząd, nie ekran"
(`preview-4-zakladki`, `mm-ppm-measure`, `standard-module-bar-children`) przechodzi
świadomie, a nie po cichu. Nowe naruszenie bez wpisu = czerwone.

**Dlaczego nie pozostałe pomysły.** (a) *Adnotacja w nagłówku wskazująca wołacza* — 240
ręcznych wpisów, które starzeją się szybciej niż kod; `agent-plan-view` jest gotowym
dowodem: jego nagłówek **twierdzi**, że komponent jest wpięty w `AppRoutes.tsx`, a nie jest
(pamięć: „Wołacz istnieje ≠ renderuje się"). R1 wylicza to samo z kodu, więc nie może skłamać.
(b) *Porównanie liczby paneli między harnessem a produkcją* — wymaga wyrenderowanego DOM
produkcji, czyli zalogowanego środowiska; brak tego środowiska jest właśnie powodem,
dla którego harness istnieje. R2 daje ten sam wynik statycznie.

**Dorzucić przy okazji (5 linii, ta sama pętla):** ostrzeżenie, gdy ekran rysuje własny
`<h1..h3>` bez `data-dev-render-chrome` — 33 dzisiejsze trafienia, a to podpisy, które lądują
na zrzucie ocenianym przez właściciela.

## Czego nie sprawdziłem

- **Zgodności danych mockowych z produktem.** Druga połowa defektu 175 to były dane
  zmyślone w harnessie („1 inicjatywa promowana" wobec „Brak powiązań" w podglądzie).
  Tego nie da się wykryć porównaniem struktury i nie sprawdzałem tego nigdzie.
- **Trybu ciemnego.** Wszystkie 9 zrzutów w motywie jasnym — rozbieżności, które szukałem,
  są strukturalne, ale defekt tokenów w ciemnym motywie tym audytem nie przeszedł.
- **155 ekranów przeszło tylko sito mechaniczne.** Porównanie z wołaczem zrobiłem dla 85
  najbardziej podejrzanych. Ekran bez `max-w`, montujący jeden komponent z wołaczem, mógł
  mimo to dostać zły prop albo zły stan początkowy — sito tego nie widzi.
- **Trzech ekranów nieosiągalnych.** `initiatives-portfolio-analysis`,
  `execution-export-prezentacja`, `execution-change-signals` są w `status.json` (wszystkie D),
  ale nie mają wpisu w `main.tsx` ani własnego `.html` — `?screen=…` odpowiada listą awaryjną.
  Nie ustalałem, czy ktoś je kiedykolwiek widział.
- **Pola `warianty` w `status.json`** (strona odbioru mówi z niego: „Ten sam komponent
  oglądasz też jako…"). Sprawdziłem 181 par: **178 zgodnych, 3 rozbieżne** —
  `idea-table` ↔ `rn-g3-class-l-record-shell` (zero wspólnych komponentów, w obie strony)
  i `karta-task` ↔ `karta-task-pelna`. Pole jest w większości uczciwe; nie badałem, skąd
  wzięły się te trzy.
- **Czy ekrany kategorii 4 były pokazywane właścicielowi jako produkt, czy jako prototyp.**
  Cztery z nich mają w `status.json` uczciwe „gdzie" (np. `canvas-kebab-restructure`:
  „zapis PRZED/PO… dowód historyczny, starszy niż dzisiejszy stan produktu"). Nie wiem,
  czy właściciel to przeczytał przed postawieniem oceny A.
