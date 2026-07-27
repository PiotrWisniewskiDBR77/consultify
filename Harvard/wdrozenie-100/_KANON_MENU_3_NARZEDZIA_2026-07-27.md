# KANON MENU — 3 narzędzia dokumentowe (Word · Excel · PowerPoint) · 2026-07-27

> Zadanie A1 Fazy A (`_MAPA_I_PLAN_MATERIALY_2026-07-27.md` §5, luka L1+L8). Wykonanie wizji Piotra
> z `_NAGRANIE_PIOTRA_WIZJA_MATERIALY_2026-07-27.md` N15: „wylistować WSZYSTKIE menu: lewe, prawe,
> górne; rozstrzygnąć co jest POWTARZALNE a co osobne; opisać RAZ, DOBRZE, korzystając z bazy
> porównywalnych narzędzi; mieć tę robotę zrobioną" — metoda 1:1 jak `_MENU3_MINDMAP_2026-07-23.md`
> / `_RAIL_LEWY_TABELA_2026-07-23.md` / `_PRAWY_PANEL_IDEE_2026-07-23.md` (grep-first, dowód
> plik:linia, kod rozstrzyga nad dokumentem). **Ten dokument ZESPALA istniejące źródła — nie
> wymyśla nowego kanonu.**
>
> Weryfikacja: `git worktree` na `origin/demo` (commit bazowy `9f720dca92`), grep bezpośrednio w
> `src/`. Wszystkie twierdzenia o „stanie dziś" mają dowód plik:linia. Tam gdzie zastane dokumenty
> (`_FORMULA_MENU_NARZEDZI_12.md`, diff 07-09/07-18) okazały się PRZEDAWNIONE — kod już naprawiony
> niezależnie — jest to jawnie oznaczone (patrz §2 „STALE — naprawione od diffu").

---

## 1. Deklaracja terminologii — żeby nikt się już nie pomylił

★ Audyt wykrył, że „Menu 1/2/3" ma **trzy różne znaczenia** w trzech różnych dokumentach. Ten
dokument pisze o ARTEFAKTACH (nie listach) i produktach GENEROWANYCH (nie ekranach roboczych
Ideas) — więc obowiązuje **definicja `ARTIFACT_ANATOMY_STANDARD.md` §2/§5**, doprecyzowana
przez **MELS** (`MODULE_EXECUTIVE_LAYOUT_STANDARD.md`, LOCKED), który jest kanonem WŁAŚCIWYM dla
tych 3 konkretnych narzędzi (Wordy/Tabele/Prezentacje = „moduły egzekutywne").

| Pojęcie | TRIADA_KANON (listy, SPEC-L) | ARTIFACT_ANATOMY (artefakty, SPEC-A/B/D/E) — **UŻYWANE TU** | MELS (3 narzędzia egzekutywne) — **UŻYWANE TU** | Porzucony draft 06-19 |
|---|---|---|---|---|
| Menu 1 | globalny sidebar aplikacji | cienki pasek tożsamości artefaktu (powrót·tytuł·status·primary) | **wchłonięte w TopBar** (lewy klaster: back/breadcrumb/tytuł) | (trzecie, sprzeczne znaczenie — unieważnione w `_MAPA_I_PLAN_MATERIALY §2.3`) |
| Menu 2 | topbar modułu (taby+filtry) | listwa formatowania tekstu (TYLKO archetyp B) | **NIE ISTNIEJE — zakazane wprost** („No second toolbar below TopBar", MELS §3.2). Funkcje Menu 2 stają się chipami w TopBar | — |
| Menu 3 | pasek akcji widoku (chipy+liczniki) | pasek akcji kontekstowych widoku + slot AI (prawa) | **REINTERPRETOWANE jako Right Rail** — `.cursor/rules/ai-actions-menu3.mdc`, cytat wprost z MELS §2 Zone D: „MELS reinterprets 'Menu 3' as the right rail of an executive module" | — |
| Lewy rail | — (listy nie mają raila) | narzędzia-czasowniki, znika gdy pusty | **Left Rail** = lista pozycji (outline/slide-sorter/rekordy) + sort/filtr/collapse + slot Teresy na dole | — |
| Prawy panel | — | właściwości-rzeczowniki, accordion 5 sekcji (Akcje·Właściwości·Powiązania·Komentarze·Historia/AI) | **Right Rail** = 56px pasek ikon → rozwijany panel narzędzi modułu (nie wymuszony accordion — patrz §4 D-POWŁOKA) | — |
| PPM/kebab | kolejność §6.4 listy | kolejność §6.4 artefaktu (Nawigacja→Manipulacja→Relacje→AI→Destrukcja) | nie ma własnej definicji — dziedziczy §6.4 ARTIFACT_ANATOMY | — |

**Skrót używany w tabeli głównej (§2):** **GÓRA** = M1 ARTIFACT_ANATOMY = TopBar MELS · **PASEK
FORMATOWANIA** = M2 ARTIFACT_ANATOMY (MELS: zakazany jako osobny wiersz, chipy wchodzą do GÓRY) ·
**AKCJE WIDOKU** = M3 ARTIFACT_ANATOMY (MELS: Right Rail) · **LEWY RAIL** = RAIL = MELS Left Rail ·
**PRAWY PANEL** = PANEL = MELS Right Rail · **PPM** = kebab/prawy klik, wspólne dla obu.

**Zakres:** 3 narzędzia (Word/Dokument, Excel/Sheet, PowerPoint/Deck) × 5 stref + PPM = **18
komórek zweryfikowanych w kodzie** (patrz kolumna dowodu w §2; dodatkowo 4 komórki „drugiego
ekranu" Excela w §2.4).

---

## 2. TABELA GŁÓWNA — strefa × narzędzie

Legenda stanu: **✅** zgodnie z kanonem · **🔨** jest, ale inaczej/niekompletnie · **❌** brak ·
**⚠ STALE** = dokument źródłowy (`_FORMULA_MENU_NARZEDZI_12.md`, diff 07-09/07-18) podawał inny
stan — **naprawiony w kodzie niezależnie od tego zlecenia**, potwierdzone świeżym grep-em na
`9f720dca92`.

### 2.0 Powłoki nośne (kontekst przed tabelą)

| Narzędzie | Plik główny | Powłoka | Linie |
|---|---|---|---|
| Word | `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx` | `ExecutiveModuleShell` (MELS) | 2488 |
| Excel — ekran generacji (chat↔podgląd) | `src/components/AIChat/KimiWorkspace/ExceleView.tsx` | `KimiWorkspaceShell` (**legacy, brak jakiejkolwiek gałęzi MELS** — `grep isMelsTabeleEnabled` = 0 wystąpień) | 478 |
| Excel — ekran otwartego arkusza | `src/components/MyWork/IdeaTableTool.tsx` (przez `MyWorkSheetsDeepLinkRedirect`) | dzielona z Idea Table, **zero tożsamości arkusza** (`grep -c "xlsx\|originRuntime\|isSheet"` = 0) | 3811+ |
| PowerPoint | `src/components/Presentations/DeckBuilder/DeckBuilder.tsx` + `DeckBuilderMelsView.tsx` | `ExecutiveModuleShell` (MELS, flaga `melsDeckBuilderFlag` domyślnie **ON**) | 1648+ |

★ **Excel ma DWA ekrany o różnej tożsamości** — patrz §2.4, osobno od tabeli głównej, bo to
osobny problem (rozjazd ekranów), nie tylko rozjazd stref.

### 2.1 GÓRA (M1 / TopBar)

| | Kanon (MELS + ARTIFACT_ANATOMY §5 archetyp B/D/E) | Word — dziś (dowód) | Excel (ExceleView) — dziś (dowód) | PowerPoint — dziś (dowód) |
|---|---|---|---|---|
| **Treść docelowa** | ← powrót · breadcrumb · tytuł edytowalny inline · status lifecycle · stan zapisu (osobno od statusu) · [indeks] · **1× PRIMARY** (Udostępnij dla B/D, Prezentuj/Eksportuj dla E) | | | |
| **Stan** | — | 🔨 **częściowo, ale POPRAWIONE od diffu 07-09** | 🔨 ubogie (brak primary, brak statusu jawnego) | 🔨 częściowo |
| **Dowód** | — | `DocumentStudioDocumentPanel.tsx:1917-1930` — chip `id:'share', kind:'primary'` z jawnym komentarzem w kodzie: *„Kanon ARTIFACT_ANATOMY_STANDARD §Archetyp B (Dokument): M1 PRIMARY = 'Udostępnij'. Export DOCX is a secondary M1 action"*. **⚠ STALE:** `_FORMULA_MENU_NARZEDZI_12.md` #10 (diff 07-09) twierdził odwrotnie — „PRIMARY miejsce zajmuje Export DOCX, Share schowany w overflow... DOKŁADNIE ODWROTNIE niż formuła". To już nieprawda — ktoś to naprawił niezależnie, z cytatem kanonu wprost w kodzie. | `KimiWorkspaceShell.tsx:1033-1051` — pasek to tylko ikona-lane + label + `/Workspace` + kebab (`KebabMenu`). **Brak** ← powrót, brak statusu lifecycle, brak stanu zapisu, brak PRIMARY w tym pasku (akcje są przez `ArtifactPreviewPane`/chat, nie M1). | `DeckBuilder.tsx:1147,1218` — `onBack={handleBackToPresentations}` przekazany do `DeckBuilderMelsView`/`SpecAErrorState`. **⚠ STALE:** `_FORMULA_MENU_NARZEDZI_12.md` #12 (diff 07-18) twierdził „← powrót BRAK, grep onBack = 0" — już nieprawda, naprawione (prawdopodobnie w toku prac VF1-7/J12-S2, widocznych w komentarzach obok). Primary = chip `run`/„Prezentuj" (`DeckBuilderMelsChips.tsx` przez `onRun`), nie „Eksportuj" — eksport w modalu Share. [indeks] „Card X of Y" nadal tylko w dolnym pasku, nie w M1 (`DeckBuilderBottomBar.tsx`). |

### 2.2 PASEK FORMATOWANIA (M2)

| | Kanon | Word | Excel | PowerPoint |
|---|---|---|---|---|
| **Treść docelowa wg ARTIFACT_ANATOMY §5** | TYLKO archetyp B: nagłówek▾/B I U/listy/wyrównanie | — | — (D nie ma M2 tekstowego — ma toolbar tabeli: wstaw wiersz/formuła/format) | — (E ma toolbar slajdu: układ/tekst/obraz) |
| **Reguła MELS (nadrzędna dla tych 3 narzędzi)** | **ZAKAZANE jako osobny wiersz** — „No second toolbar below TopBar" (MELS §3.2, forbidden patterns) | | | |
| **Stan** | — | ✅ zgodne z MELS (zakaz) — ale brak substytutu | 🔨 brak (D matryca ma mieć toolbar tabeli, go nie ma jako oddzielny byt) | ❌ brak KONSTRUKCYJNY — realny substytut martwy |
| **Dowód** | — | `grep -rln "BubbleMenu\|Toolbar" src/components/DocumentStudio/` = 0 wyników w `editor/DocumentTipTapEditor.tsx` — brak dedykowanej listwy formatowania. Zgodne z MELS (nie ma być 2. wiersza), ale ARTIFACT_ANATOMY §5-B chce listwę B/I/U — **żaden z dwóch dokumentów źródłowych nie jest tu w pełni spełniony**, MELS wygrywa (§4). | `ExceleView.tsx`/`ExceleRightPanel.tsx` — brak wstaw-wiersz/format-komórki/formuła jako pasek; te funkcje żyją w wygenerowanym `.xlsx` (silnik), nie w UI ekranu generacji. Dla ekranu otwartego arkusza (IdeaTableTool) `_FORMULA_MENU_NARZEDZI_12.md` #11 potwierdza: wstaw wiersz/kolumnę ✅, format liczby ✅ per-kolumnę, formuła `fx` ✅ (`FormulaEditor.tsx`) — ale scal komórki i obramowanie **BRAK** w UI (tylko w prompt generatora). | `TopBar.tsx:10-11` explicite zabrania 2. wiersza. Substytut wstawiania = `BlockToolbar.tsx:25-32` (PANEL, nie pasek). **Realny per-slajdowy toolbar układ/tło/wyrównanie = martwy kod**: `grep -rln "CardFloatingToolbar\|EditCardPopup" src/` zwraca WYŁĄCZNIE definicje tych 2 plików, **zero importerów** poza nimi samymi — potwierdzone świeżo, zgodne z diffem 07-18 (nie STALE, nadal aktualne). Efekt: zmiana układu/tła pojedynczego slajdu jest dziś **nieosiągalna z UI**. |

### 2.3 AKCJE WIDOKU (M3 / Right Rail „wejście")

| | Kanon | Word | Excel | PowerPoint |
|---|---|---|---|---|
| **Treść docelowa** | chipy widoku (tryb czytania/TOC/komentarze dla B; zoom/dodaj-slajd/przejście dla E; zakładki arkuszy/AI-policz dla D) + **slot AI zawsze prawa strona** | | | |
| **Stan** | — | 🔨 rozjazd lokalizacji (funkcje są, nie jako pasek M3) | ✅ częściowo (via KimiWorkspaceShell task steps + chat, inny idiom niż chipy) | 🔨 rozproszone + 1 funkcja martwa (STALE — patrz niżej) |
| **Dowód** | — | Brak dedykowanego paska M3 (`grep secondBar\|viewMode\|readingMode\|tocToggle` w `DocumentStudioDocumentPanel.tsx` = 0). Odpowiedniki (Comments, Schema diff) żyją jako osobne narzędzia prawego railu (§2.5), nie jako chipy widoku. | Chat + `taskSteps`/`totalSteps`/`completedSteps` z `KimiWorkspaceShell` pełnią funkcję „widoku postępu", inny idiom niż chipy Menu 3 kanonu — generacja jest liniowa (plan→generuj→podgląd), nie wielo-widokowa jak Word/Deck. | `DeckBuilder.tsx:1232` `onRun: () => setPresentMode('fullscreen')` + `onPresenter: () => setPresentMode('presenter')` (komentarz w kodzie: „J12-S2 — presenter view... surfaced as an overflow (⋯) chip"). **⚠ STALE:** `_FORMULA_MENU_NARZEDZI_12.md` #12 (diff 07-18) twierdził „tryb prezentera = martwa funkcja, żaden przycisk nie ustawia 'presenter'" — już nieprawda, naprawione (J12-S2). Nadal brak realnych „przejść" (grep trafia tylko CSS/framer per-block, nie UI). |

### 2.4 LEWY RAIL

| | Kanon | Word | Excel | PowerPoint |
|---|---|---|---|---|
| **Treść docelowa** | lista pozycji modułu (outline/rekordy/slajdy) + sort/filtr/szukaj + collapse toggle (**obowiązkowy wg MELS §3.1**) + slot Teresy na dole | | | |
| **Stan** | — | ✅ | ❌ (ekran generacji nie ma raila w ogóle) | ✅ bogaty |
| **Dowód** | — | `DocumentStudioDocumentPanel.tsx:2467` — `leftRailTitle={t('documentStudio.panel.outlineTitle', 'Outline')}` — zgodne z formułą (outline dokumentu). | `KimiWorkspaceShell.tsx` — struktura to breadcrumb-pasek + `ArtifactPreviewPane` + `rightPanel`; **brak lewego raila jako osobnej strefy** (chat/kroki generacji żyją poza tym komponentem, w warstwie nadrzędnej czatu). Dla ekranu otwartego arkusza (IdeaTableTool) rail = 5-slotowy rail Idea Table (nienazwany dla arkusza). | `SlideSorter.tsx` — nawigator miniatur bogaty: drag-reorder, widok karty/lista, badge outdated, kebab per slajd (`_FORMULA_MENU_NARZEDZI_12.md` #12, zgodne z aktualnym stanem — nie było powodu wątpić, potwierdzone strukturalnie przez istnienie pliku i odwołania w `DeckBuilder.tsx`). Biblioteka źródeł-artefaktów do wstawiania **BRAK** — `MediaLibraryBrowser.tsx` tylko obrazy. |

### 2.5 PRAWY PANEL

| | Kanon (accordion docelowy §13) | Word | Excel | PowerPoint |
|---|---|---|---|---|
| **Treść docelowa** | Akcje 2rz. · Właściwości · Powiązania · Komentarze · Historia/AI (kolejność stała, DoD §18.1) | | | |
| **Stan** | — | 🔨 bogatszy niż kanon, inna struktura (świadomy wybór, patrz §4) | 🔨/✅ **rozjazd MIĘDZY dwoma ekranami Excela** | 🔨 rozjazd struktury + 1 realny bug |
| **Dowód** | — | `DocumentStudioDocumentPanel.tsx:1959-1994` (primary 5: Sources·Properties·Quality QA·Teresa·Comments) + `1996-2040+` (overflow 8: Activity·Schema diff·Audience variants·**Share links**·Approvals·Manifest gate·Content library·AI Editor) za jednym `⋯`. Komentarz w kodzie l.1950-1958 jawnie uzasadnia grupowanie 5+8. „Powiązania" jako pojęcie ARTIFACT_ANATOMY (link do rodzica/inicjatywy) **nie istnieje wprost** — „Sources" to źródła-WEJŚCIA generacji, nie link-WYJŚCIE do rodzica. | **ExceleView** (`ExceleRightPanel.tsx:61-155`) ma **dokładnie kanoniczne 5 sekcji z kanonicznymi nazwami**: `id:'actions'/label:'Akcje'`, `id:'properties'`, `id:'relations'/label:'Powiązania'`, `id:'comments'/label:'Komentarze'`, `id:'history'/label:'Historia'` — **to NAJBLIŻSZA kanonowi implementacja z całej trójki narzędzi**. Ale **IdeaTableTool** (ekran otwartego arkusza) dzieli `IdeaRightPanel` z Idea Table — wg `_FORMULA_MENU_NARZEDZI_12.md` #11 tylko 3 sekcje (D16), brak sekcji Akcje/Eksport .xlsx, brak inspektora „Szczegół komórki". **Dwa ekrany tego samego narzędzia mają dwa różne prawe panele o różnej jakości.** | `DeckBuilderMelsRightRail.tsx:85-103` realna kolejność: Blocks→Media→Comments→Activity→Relations(+Evidence za flagą) — nie kolejność kanonu. **Bug potwierdzony świeżo:** `DeckBuilderMelsRightRail.tsx:29,46,94` deklaruje klucz `media`, ale `DeckBuilder.tsx:1275-1320` (`rightRailPanels={{...}}`) ma klucze `blocks, comments, activity, relations, evidence` — **brak `media`** → klik ikony Media otwiera pusty panel. Powiązania ✅ pełnoprawne (`DeckRelationsPanel.tsx`). „Akcje" jako sekcja BRAK — Export/Prezentuj/Udostępnij żyją jako chipy TopBar + `ShareModal.tsx`. |

### 2.6 PPM / KEBAB

| | Kanon §6.4 | Word | Excel | PowerPoint |
|---|---|---|---|---|
| **Treść docelowa** | Nawigacja → Manipulacja → Relacje/Wyjście → AI → Destrukcyjne (stała kolejność, identyczna z kebabem) | | | |
| **Stan** | — | ✅ (na zaznaczeniu/bloku) | 🔨 (na wierszu/zakresie — dziedziczone z Idea Table, nie własne) | 🔨 częściowe, zły trigger |
| **Dowód** | — | `src/components/DocumentStudio/inline-ai/DocumentInlineAIMenu.tsx` + `useDocumentInlineAI.ts` (potwierdzone istnienie plików) — `acceptProposal`/`rejectProposal` na propozycji AI zgodnie z formułą (edycja+AI w jednym menu kontekstowym). | Brak własnego PPM dla komórki/zakresu — dziedziczy PPM wierszowy Idea Table: Edytuj/Powiel/Usuń ✅, ale Wytnij/Kopiuj/Wklej per-zakres, Format▸/Formuła z PPM, Wyczyść komórkę — **brak** (`_FORMULA_MENU_NARZEDZI_12.md` #11, spójne z brakiem tożsamości arkusza z §2.0). | `grep -rn "onContextMenu" src/components/Presentations/DeckBuilder/` = **0 wyników**, potwierdzone świeżo — **prawdziwego prawego kliku nie ma**, jest tylko kebab „…" w `SlideSorter.tsx` (Duplikuj✅, Przenieś▸✅, Usuń✅[danger]; Ukryj i Zmień-układ▸ brak). |

**Podsumowanie weryfikacji:** 5 stref × 3 narzędzia = 15 komórek + PPM × 3 = 18 komórek głównych,
plus 4 dodatkowe komórki „drugiego ekranu Excela" w §2.0/§2.5 = **22 punkty zweryfikowane
bezpośrednim grep/read na `9f720dca92`**. 3 twierdzenia z `_FORMULA_MENU_NARZEDZI_12.md` okazały
się **przedawnione (STALE)** — kod już naprawiony niezależnie (Word M1 primary, Deck ← powrót,
Deck tryb prezentera). 1 twierdzenie („brak Media panelu w Decku") i 1 („CardFloatingToolbar/
EditCardPopup = martwy kod") potwierdzone jako **nadal aktualne**.

---

## 3. ★ WSPÓLNE vs SWOISTE — sedno zlecenia Piotra

### 3.1 IDENTYCZNE w całej trójce (kandydaci do jednego komponentu/kontraktu)

| Element | Dlaczego identyczny | Dowód wspólnego mechanizmu |
|---|---|---|
| **Powłoka TopBar+LeftRail+Canvas+RightRail** | Wszystkie 3 to „moduły egzekutywne" MELS — ta sama definicja zon niezależnie od treści centrum | `ExecutiveModuleShellProps` (MELS §4) — jeden interfejs współdzielony przez Word/Deck (Excel — ekran generacji — jeszcze NIE migrowany, patrz §5) |
| **Zakaz drugiego paska (M2 jako osobny wiersz)** | MELS §3.2 explicite zabrania — funkcje formatowania stają się chipami TopBar, niezależnie od narzędzia | `TopBar.tsx:10-11` (Deck) — ten sam plik/komponent, ten sam zakaz dla Word gdy zmigrowany |
| **Slot AI zawsze po prawej / w Right Rail** | Reguła przekrojowa #2 Formuły + MELS „AI buttons exclusively in right rail" | Word: Teresa jako primary right-rail tool. Deck: Teresa jako `aiEntrySlot`. Excel: chat jako natywny idiom generacji (inny mechanizm, ten sam skutek: AI nie miesza się z canvas) |
| **Kolejność kebaba/PPM §6.4** | Jeden alfabet elementów w całej aplikacji (ARTIFACT_ANATOMY §6) | Word (`DocumentInlineAIMenu`), Deck (`SlideSorter` kebab) — obie zaczynają Nawigacja/Manipulacja, kończą Destrukcja(danger) |
| **„Powiązania" jako pojęcie first-class** | Reguła przekrojowa #3 Formuły — skoro wszystko się łączy (źródło→artefakt→wynik), musi być klikalne wszędzie | Deck: `DeckRelationsPanel.tsx` (pełnoprawne). Excel (ExceleRightPanel): sekcja `relations` istnieje. Word: „Sources" pełni podobną rolę, ale kierunek odwrotny (wejście, nie wyjście) — **to NIE jest identyczne dziś, powinno być** |
| **Collapse toggle lewego/prawego railu** | MELS §3.1 „mandatory affordance (this is the gap the user flagged on screenshots)" | Wspólny wymóg z MELS, niezależny od treści railu |
| **Tokeny `c-*`, zero crimson w powłoce** | ARTIFACT_ANATOMY §9 + bramka `check-artefakt.sh` (CLAUDE.md pkt 6) | Egzekwowane hookiem niezależnie od narzędzia |

### 3.2 MUSZĄ się różnić (i dlaczego — slajd ≠ sekcja ≠ arkusz)

| Element | Word | Excel | PowerPoint | Dlaczego różnica jest SŁUSZNA |
|---|---|---|---|---|
| **Centrum** | tekst ciągły (rich text, TipTap) | siatka komórek + formuły (generowany `.xlsx`, nie edytor-grid — decyzja D-EXCEL) | slajdy jako karty w document-flow | Jednostka pracy jest fundamentalnie inna: akapit vs komórka-z-formułą vs slajd-z-layoutem. Wymuszenie wspólnego centrum zniszczyłoby wszystkie 3 (to dokładnie ostrzeżenie z §4 D-POWŁOKA) |
| **Lewy rail — zawartość** | outline (nagłówki dokumentu) | *(brak w ekranie generacji — natura liniowa: plan→generuj→gotowe, nie ma „listy pozycji" do przewijania)* | slide sorter (miniatury, drag-reorder) | Outline i slide-sorter nawigują PO STRUKTURZE tej samej treści; Excel dziś nie ma odpowiednika, bo generacja jest jednorazowa/liniowa — to realna luka (§5), nie zamierzona różnica |
| **Prawy rail — narzędzia domenowe** | Sources/QA/Audience variants/Manifest gate (rygor dokumentu partnerskiego — governance tekstu) | Formula/Format-komórki (rygor liczbowy — IBCS, spójność formuł) | Theme/Brand kit/Layout-picker (rygor wizualny — spójność marki) | Każde narzędzie ma WŁASNĄ klasę ryzyka do pilnowania: dokument boi się halucynacji faktów, arkusz boi się błędnej formuły, deck boi się niespójnego brandu. Narzędzia domenowe MUSZĄ być różne — to nie dług, to specjalizacja |
| **PRIMARY w GÓRA** | „Udostępnij" (dokument = do czytania/opiniowania) | *(brak jawnego — generacja kończy się plikiem, nie „udostępnieniem" ekranu)* | „Prezentuj" (deck = do pokazania na żywo) | Różny modus operandi: dokument krąży, deck się prezentuje, arkusz się pobiera. To SWOISTE i słuszne — ale Excel dziś nie ma NIC w tym miejscu, co jest luką, nie świadomym wyborem (§5) |
| **M2/toolbar treści** | zakaz (MELS) — brak substytutu | wstaw wiersz/formuła — częściowo w UI (IdeaTableTool), częściowo tylko w prompt generatora | zakaz (MELS) — jedyny substytut to martwy kod | Sama ZASADA (brak 2. paska) jest wspólna; TREŚĆ zastępcza jest swoista i dla Word/Deck dziś **nie istnieje w ogóle** — to jest wspólna luka, nie wspólna cecha |

**Wniosek dla generatora szablonów (N14, układ 3-kolumnowy z nagrania Piotra):** kolumny LEWA
(kolejność treści) i PRAWA (klocki/tooling) są **strukturalnie identyczne** między Word/Excel/PPT —
różni się tylko WOKABULARZ klocków (akapit/nagłówek/tabela vs wiersz/formuła/wykres vs
slajd/layout/obraz). To wspiera plan `_MAPA_I_PLAN_MATERIALY_2026-07-27.md` D1: „Word i Excel do
układu 3-kolumnowego, bazując na Architekcie prezentacji" — jeden komponent-rama, trzy słowniki
klocków.

---

## 4. Rozstrzygnięcie napięcia MELS vs ArtifactRightPanel

**Znaleziona decyzja (nie wymyślona na nowo):** `_DOKTRYNA_POWSTAWANIA_ARTEFAKTOW.md` §0, decyzja
**D-POWŁOKA** (Piotr, 2026-07-09):

> „**D-POWŁOKA: WYRÓWNAĆ KONTRAKT, nie wymuszać accordion.** Każde dojrzałe narzędzie (Deck/Word/
> Notatnik/Idea Table) ZOSTAJE na swojej bogatszej powłoce (Deck governance-rail, Notatnik
> zakładkowy Notion-rail, Word 13-tool rail, Idea Table RowDetailPanel). NIE przerabiamy ich na
> generyczny `ArtifactRightPanel` accordion — to by je POGORSZYŁO. Wyrównujemy TYLKO KONTRAKT:
> tokeny `c-*` + zero crimson + „Powiązania" first-class + stały slot AI + kolejność kebaba §6.4.
> Odejścia od SPEC-A z komentarzem-decyzją w kodzie = AKCEPTOWANE, nie dług. (`ArtifactRightPanel`
> zostaje wzorcem dla NOWYCH/prostych rekordów: Task/Insight/Decision/KPI.)"

**Jak to rozstrzyga napięcie znalezione w §1-2 (MELS 4 strefy vs ARTIFACT_ANATOMY 6 stref):**
D-POWŁOKA mówi wprost o KONTRAKCIE prawego panelu (accordion vs bogaty rail), ale nie wspomina
MELS z nazwy — oba dokumenty (ARTIFACT_ANATOMY §5 i MELS) powstały niezależnie i **nigdy nie
odwołują się do siebie nawzajem** (`grep MELS` w obu plikach = 0 wyników w obu kierunkach). Mimo
to duch decyzji stosuje się wprost: te 3 narzędzia są „dojrzałymi powłokami" w rozumieniu
D-POWŁOKA, więc **MELS jest operacyjną instancjacją kontraktu ARTIFACT_ANATOMY dla TYCH 3
narzędzi** — nie osobnym, konkurencyjnym standardem. Dowód, że tak to już praktykują deweloperzy
BEZ tego dokumentu: `DocumentStudioDocumentPanel.tsx:1917-1920` ma komentarz w kodzie cytujący
wprost „Kanon ARTIFACT_ANATOMY_STANDARD §Archetyp B" przy implementowaniu go w kształcie MELS
(chip w TopBar, nie osobne Menu 1). To dokładnie wzorzec „odejście od SPEC-A z komentarzem-
decyzją w kodzie = akceptowane" z D-POWŁOKA.

**Konsekwencja praktyczna dla tego kanonu:**
1. Brak M2 jako osobnego paska (MELS) **wygrywa** nad ARTIFACT_ANATOMY §5-B „listwa formatowania"
   — ale FUNKCJE tej listwy (formatowanie tekstu) muszą się gdzieś odbyć (dziś: nigdzie — luka).
2. Reinterpretacja M3=Right Rail (MELS) **wygrywa** nad ARTIFACT_ANATOMY §5 „pasek chipów widoku"
   — AI slot i akcje widoku żyją w Right Rail, nie w osobnym wierszu.
3. Prawy panel accordion 5-sekcyjny (ARTIFACT_ANATOMY §13) **NIE jest wymagany** dla tych 3
   narzędzi — bogatsze rail'e (Word 13-tool, Deck 5-panel, Excel-generacja 5-sekcyjny) zostają,
   pod warunkiem spełnienia kontraktu: tokeny, zero crimson, Powiązania first-class, AI slot,
   kolejność kebaba.
4. **Rollout SPEC-A** (`_ROLLOUT_ARTEFAKTY_PLAN.md` Fala W3) już to samo mówi wprost: „wspólny
   prawy panel dla archetypu B (Dokument) — wymaga projektu... sesja koncepcyjna przed kodem" —
   spójne z D-POWŁOKA, nie sprzeczne.

---

## 5. Lista robót do zgodności (S/M/L), per narzędzie, uszeregowana

### Word

| # | Robota | Rozmiar | Powód priorytetu |
|---|---|---|---|
| W1 | Sekcja „Powiązania" (link do rodzica/inicjatywy) jako first-class obok „Sources" (które są źródłami-WEJŚCIA, nie powiązaniami-WYJŚCIA) | M | reguła przekrojowa #3, dziś jedyny archetyp bez tego (patrz §3.1) |
| W2 | M3 jako realny pasek chipów widoku (tryb czytania/TOC/komentarze-toggle) zamiast rozproszonych osobnych narzędzi railu | M | spójność z Deck/Excel, dziś funkcje są ale nie jako jeden pasek |
| W3 | Substytut listwy formatowania (M2 zakazane przez MELS) — decyzja: chipy w TopBar czy kontekstowy BubbleMenu przy zaznaczeniu | S–M | dziś realnie brak (0 wyników `Toolbar`/`BubbleMenu`) |
| W4 | Weryfikacja wzrokiem (dark+light) po zmianach — DoD §18.1 | S | zero zrzutów w tej turze (zakaz reguły #7 bez akceptu Piotra) |

### Excel

| # | Robota | Rozmiar | Powód priorytetu |
|---|---|---|---|
| E1 | **Scalić dwa ekrany Excela** — ekran generacji (`ExceleView`, dobry prawy panel) vs ekran otwartego arkusza (`IdeaTableTool`, zero tożsamości) — dziś to dwa różne doświadczenia tego samego narzędzia | **L** | najpoważniejszy realny gap z całej trójki — użytkownik dostaje inny produkt zależnie od wejścia |
| E2 | `isSheetArtifact` — ikona arkusza + PRIMARY „Eksportuj .xlsx" wewnątrz ekranu otwartego arkusza (dziś: eksport tylko z kebaba LISTY, nie z samego ekranu) | M | wymieniony już w `_FORMULA_MENU_NARZEDZI_12.md` #11 jako decyzja czekająca |
| E3 | PPM per-komórka/zakres (Wytnij/Kopiuj/Wklej zakresu, Format▸, Wyczyść) — dziś dziedziczone z Idea Table na poziomie wiersza | M | brak realnej edycji punktowej bez wchodzenia do generatora |
| E4 | Migracja `ExceleView`/`TabeleView` na `ExecutiveModuleShell` (MELS) — dziś `TabeleView` ma już gałąź `isMelsTabeleEnabled()` (flaga OFF), `ExceleView` nie ma JEJ WCALE | L | warunek wstępny spójności z Word/Deck (§3.1) |
| E5 | Stary backend `workbook` (`server/src/routes/workbook.routes.ts`) bez żadnego ekranu — decyzja: migrować do `tp_tables` czy utrzymywać dwa systemy | L (decyzyjne, nie tylko UI) | dług architektoniczny, nie tylko menu |

### PowerPoint

| # | Robota | Rozmiar | Powód priorytetu |
|---|---|---|---|
| P1 | Naprawić dziurę Media panelu (`DeckBuilderMelsRightRail` deklaruje klucz `media`, `DeckBuilder.tsx rightRailPanels` go nie ma) | **S** (1-liniowa naprawa, wysoka widoczność — klik = pusty panel) | realny, świeżo potwierdzony bug, trywialny fix |
| P2 | Realny per-slajdowy toolbar układ/tło/wyrównanie — dziś jedyny kandydat to martwy kod `CardFloatingToolbar.tsx` (0 importerów) | **L** | bez tego zmiana layoutu pojedynczego slajdu jest niemożliwa z UI |
| P3 | Prawdziwy PPM (`onContextMenu`) na slajdzie zamiast tylko kebaba — dodać Ukryj + Zmień-układ▸ | M | zgodność z §6.4 (PPM = lustro kebaba, dziś kebab niepełny i to jedyne wejście) |
| P4 | Sekcja „Akcje" w prawym panelu (dziś Export/Prezentuj/Udostępnij żyją tylko jako chipy TopBar + modal) | S–M | spójność z kanonem accordion (nawet w wariancie D-POWŁOKA, sekcja Akcje jest oczekiwana) |
| P5 | Usunąć martwy kod `CardFloatingToolbar.tsx` + `EditCardPopup.tsx` (0 importerów) LUB podłączyć jako realizację P2 | S (usunięcie) / L (podłączenie) | higiena wykonania — martwy kod myli kolejnych agentów |

**Kolejność międzynarzędziowa (rekomendacja):** P1 (trywialna, 1 sesja) → E2+W1 (Powiązania/tożsamość,
symetryczne, można robić razem) → P3+W2 (PPM/M3 spójność) → E1 (scalenie ekranów Excela, największy
nakład) → P2 (layout slajdu, wymaga decyzji projektowej, nie tylko kodu).

---

## 6. Czego świadomie NIE rozstrzygam (i dla kogo to decyzja)

1. **Czy Excel powinien mieć DWA ekrany (generacja vs edycja) czy jeden** — to decyzja produktowa
   Piotra/CTO, nie kosmetyka menu. E1 zakłada scalenie, ale kierunek (który ekran wygrywa, czy
   robimy trzeci wspólny) wymaga decyzji, nie tylko UI-fixu.
2. **Czy `IdeaTableTool` (dzielona powłoka Excel/Idea Table) powinna dostać własną tożsamość, czy
   Excel powinien całkowicie przenieść się na wzór `ExceleRightPanel`** — dwa różne kierunki
   naprawy E1, oba techniczne wykonalne, wybór = decyzja właściciela produktu.
3. **Los starego backendu `workbook`** (E5) — migracja danych, nie tylko UI; wymaga oceny ryzyka
   na żywych danych demo/prod, poza zakresem dokumentu-kanonu.
4. **Czy M2 (listwa formatowania) dla Word powinna wrócić jako kontekstowy BubbleMenu przy
   zaznaczeniu, czy jako chipy TopBar** (W3) — MELS zakazuje drugiego wiersza, ale nie mówi JAK
   ma wyglądać zamiennik; to decyzja projektowa (UX), nie fakt z kodu.
5. **Czy Deck faktycznie potrzebuje prawdziwego `onContextMenu` (P3), czy wystarczy dociążyć
   istniejący kebab** — oba spełniają literę §6.4 („lustro"), różnią się kosztem wdrożenia;
   decyzja inżynierska do podjęcia przy realizacji, nie tu.
6. **Priorytetyzacja E1 vs P2** (oba L) — który nakład ważniejszy biznesowo (Excel spójność vs
   Deck funkcjonalność layoutu) — to decyzja sekwencji pracy (CTO/Piotr), nie treść kanonu.
7. **Zrzuty wzrokiem light+dark** dla żadnej z tych 3 stref nie zostały zrobione w tej turze
   (dokument = praca papierowa Fazy A, reguła #7 zakazuje pokazywania czegokolwiek Piotrowi przed
   realnym render-verify) — to warunek wstępny odbioru KAŻDEJ przyszłej zmiany z §5, nie brak w
   tym dokumencie.
