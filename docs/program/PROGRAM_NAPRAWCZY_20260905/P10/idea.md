# Pomysł (warsztat) — kontrakt karty N (P10-B6, DEC-429)

> **Jedna karta N, cztery centra.** Rozstrzygnięcie CTO (P10-B6): inwentarz liczy `idea-mindmap`,
> `idea-processflow`, `idea-whiteboard`, `idea-table` jako cztery pozycje (#5–#8), bo to cztery
> ekrany. Kontrakt jest **jeden**: powłoka, prawy panel, Menu 2/3/5 i AI są identyczne dla
> wszystkich czterech — zmienia się WYŁĄCZNIE centrum. Sekcja „centrum" w §1 jest sparametryzowana
> `CanvasToolType` (`src/components/MyWork/ideaSelectionTypes.ts:8`). Aliasy: `idea-mindmap`,
> `idea-processflow`, `idea-whiteboard`, `idea-table`.
>
> Runda 2. Pomiar r2 na żywo 06.09.2026 (vite 3141 z `mvp/p10b6-moja-praca`, API `127.0.0.1:4100`,
> DBR77, rekord `seed_idea_map_8ae01e47_ai_quality` „AI monitoring jakości").
> Dowody: `evidence/p10b6/05-idea-mindmap.png`, `05-idea-process-flow.png`, `05-idea-table.png`;
> whiteboard z r1: `evidence/p10-matryca/05-idea.png`, `05-idea-ai.png`. Zapis r1 w §8.

## §0. Tożsamość

| pole | wartość |
|---|---|
| nazwa PL | Pomysł — warsztat (Mapa myśli · Whiteboard · Process Flow · Tabela) |
| moduł | `07_MY_WORK_AGENT` (Moja praca → Pomysły) |
| archetyp | **A — Canvas** dla mindmap/whiteboard/process_flow, **D — Matryca** dla table |
| trasa | `/my-work/ideas/<ideaId>/workspace/<mindmap\|whiteboard\|process-flow\|table>` (`src/routes/ideaWorkspaceNavigation.ts:35-37`) |
| jak otworzyć z listy | Moja praca → Pomysły → wiersz → „Otwórz"; przełączanie centrum bez utraty tożsamości |
| komponent (powłoka) | `src/components/MyWork/IdeaMapWorkspace.tsx:357` (5726 linii) |
| centra | mindmap `mindmap/` · `IdeaWhiteboardTool.tsx:912` · `IdeaProcessFlowTool.tsx:406` · `IdeaTableTool.tsx:268` |
| prawy panel | `src/components/MyWork/panel/IdeaElementInspector.tsx` (zakładki **Składnik \| Teresa**) albo `src/components/standard/IdeaRightPanel.tsx:207` (sekcje Menu 1) — jedna kolumna, wybór w `IdeaMapWorkspace.tsx:4690-4700` |
| powłoka | `IdeaCanvasMelsView` / `ExecutiveModuleShell` (`melsCanvasEnabled` przybite na `true`) |
| klasa S/L | **L** |
| rejestr | **poza** — jawny wyjątek: „IdeaMapWorkspace jest warsztatem płótnowym poza rejestrem" (`registry.kompletnosc.test.ts:32`) |

Nazwy centrów po angielsku („Whiteboard", „Process Flow") to **decyzja właściciela z 2026-07-24**
(`src/components/MyWork/IdeaWorkspaceToolbar.tsx:51-58`), nie luka i18n — nie zgłaszam ich pod K25.

## §1. SEKCJE

Kontrakt sekcji **nie istnieje** (K1 ✗). Poniżej kontrakt do zbudowania — jeden dla czterech centrów.

| sekcja | po co użytkownikowi | źródło danych (API → writer) | reguła pustki | kolejność | S/L |
|---|---|---|---|---|---|
| Nagłówek pomysłu (tytuł, etap) | tożsamość i dojrzałość pomysłu | pola pomysłu → `PUT /my-work/my-ideas/:id` (`server/src/routes/my-work.routes.ts:3174`) | brak tytułu → tytuł z ziarna (`safeTitleFromSeed`) | 1 | S+L |
| **Centrum (parametr `CanvasToolType`)** | praca nad pomysłem w wybranej formie | graf → `GET/PUT /my-work/my-ideas/:id/map` (`:4363`, `:4733`), synchronizacja `POST /:id/map/sync` (`:5080`) | pusty graf → stan „zacznij od węzła", nie puste płótno bez podpowiedzi | 2 | S+L |
| — mindmap | mapa myśli | jw. (`mapExtensions`, `viewport`) | jw. | 2a | L |
| — whiteboard | swobodna tablica | jw. | jw. | 2b | L |
| — process_flow | przepływ procesu | jw. + semantyka przepływu (`IDEA_WORKSPACE_FLOW_SEMANTIC_EVENT`) | jw. | 2c | L |
| — table | tabela pomysłów (wiersze = elementy) | jw. + kolumny tabeli | zero wierszy → „dodaj wiersz" | 2d | L |
| Szczegóły elementu | pola zaznaczonego węzła/wiersza | `IdeaWorkspaceSelection` → `PUT /:id/map` | brak zaznaczenia → „Kliknij węzeł, wiersz, kartkę albo krawędź, aby zobaczyć jego pola" (dziś tak jest ✓) | 3 | S+L |
| Migawki grafu | powrót do wcześniejszego stanu | `GET/POST /my-work/my-ideas/:id/map/snapshots` (`:5908`, `:5960`) | zero → sekcja znika | 4 | L |
| Komentarze węzła | dyskusja przy elemencie | `/my-work/my-ideas/:id/map/nodes/:nodeId/comments` | zero → „Brak komentarzy" | 5 | L |
| Aktywność | ślad zmian pomysłu | `GET /my-work/my-ideas/:id/activity` (`:6303`) | zero → „Brak zapisanej historii" | 6 | L |

## §2. PRAWY PANEL

**Dwa różne panele w jednej kolumnie** — to jest główny rozjazd karty.

| stan | co się renderuje | sekcje |
|---|---|---|
| domyślny (bez sekcji Menu 1) | `IdeaElementInspector` z zakładkami **Składnik \| Teresa** | Akcje · Właściwości · Powiązania · Źródła i założenia · Komentarze (`05-idea-mindmap.png`) |
| sekcja Menu 1 otwarta | `IdeaRightPanel` → `ArtifactRightPanel` | Akcje `:250` · Właściwości `:264` · Powiązania `:271` · Źródła i założenia `:278` · Komentarze `:295` · Historia `:304` |

| K | stan | dowód |
|---|---|---|
| K6 Akcje pierwsza | ✓ | `IdeaRightPanel.tsx:250`; na zrzucie „AKCJE" na górze |
| K7 Właściwości = tabela | **✗** | `propertiesContent` = `IdeaWorkspaceTools` (panel narzędzi), a inspektor rysuje wiersze Etykieta/Etap/Właściciel/Utworzono/Zaktualizowano **bez nagłówka „Właściwość \| Wartość"** (`05-idea-mindmap.png`). Brakuje też Priorytetu i Terminu |
| K8 Powiązania | ✓ (licznik 0) | `05-idea-mindmap.png` |
| K9 Źródła i założenia | ~ | sekcja jest, ale treść tylko za flagą `ff_evidencePanel` (default OFF, `IdeaMapWorkspace.tsx:5489-5492`) — przy OFF zawsze „Brak zapisanych źródeł i założeń" |
| K10 Komentarze + Historia | ~ | obie zadeklarowane, obie **twardo puste** (`IdeaRightPanel.tsx:298-310`: `isEmpty: true`, `children: null`) — mimo że backend ma i komentarze węzłów, i `/activity` |
| K11 jeden panel | ✓ | decyzja CTO 05.09; `IdeaMapWorkspace.tsx:4685-4700` |

Kontrakt: **jeden** panel z jednym kompletem sekcji; zakładka „Teresa" znika (patrz §4);
Komentarze i Historia dostają realne wołacze (`/map/nodes/:nodeId/comments`, `/activity`).

## §3. MENU 5 I NAWIGACJA

Menu 5 **nie istnieje** (K12 ✗). Dziś w jego miejscu: Menu 3 z pigułką rekordu i dwoma
przyciskami w prawym rogu — **„Panel"** i **„AI"** (`IdeaMapWorkspace.tsx:4650-4657`,
etykiety `mindmap.cornerPanel`, `mindmap.cornerAi`).

Kontrakt:
* **Sekcje ▾** — widoczność sekcji z §1 (dziś pasek sekcji powłoki został świadomie zdjęty,
  `IdeaMapWorkspace.tsx:4664-4676`, żeby nie było trzeciego panelu — spis wraca do Menu 5, nie jako panel).
* **Edycja / Podgląd** — prawo edycji pomysłu; bez prawa brak przełącznika + powód.
* **Pracuj z AI ▾** — zastępuje przycisk „AI" (patrz §4).
* K19: pigułka pokazuje **typ** („Pomysł"), nie nazwę rekordu („AI monitoring jakości") —
  ten sam defekt co w powiadomieniu. Kontrakt: `typ · nazwa rekordu`.
* K16: klik z listy ma dawać podgląd boczny, „Otwórz" — kartę.

## §4. AI

**To jest najcięższa luka tej karty.** Zmierzone: warsztat i jego cztery centra importują
**14 komponentów AI** o czternastu różnych nazwach (`AIActionsPopover`, `AICategorizeTool`,
`AICopilotMode`, `AIGovernanceBadge`, `AIGovernancePanel`, `AIProposalPanel`, `AITableAssistant`,
`AITableFieldProposal`, `AITableProposal`, `BatchAIFillButton`, `FloatingAIPopover`,
`IdeaAINudgeStrip`, `IdeaAISuggestionsPanel`, `InlineAIFill`) plus zakładkę Teresy
(`IdeaTeresaSection.tsx`) i kartę „Analiza płótna" z przyciskiem „Zastosuj"
(`IdeaAINudgeStrip.tsx:398`, widoczna na wszystkich trzech zrzutach r2).
Na ekranie widać m.in. przycisk **„Uzupełnij AI (23)"** (`table/InlineAIFill.tsx:154`,
klucz `myWorkTable.inlineAIFill.aiFillButton`) — piętnasta nazwa dla tej samej roli.
`PracujZAI` nie występuje w żadnym z tych plików (`grep "<PracujZAI" src/` — zero trafień w `MyWork/Idea*`).

**Naruszenie DEC-404/DEC-419 (K27) — do usunięcia, nie do wyłączenia.** Przycisk „AI" w rogu
warsztatu wywołuje `ustawZakladkePanelu('teresa')` (`IdeaMapWorkspace.tsx:4655`), a zakładka
„Teresa" renderuje **pełny `UnifiedChatPanel`** wewnątrz karty (`IdeaMapWorkspace.tsx:4592-4603`).
Globalny dok Teresy jest na tej trasie wyłączony (`MainLayout.hasEmbeddedModuleChat`), więc czat
istnieje w jednym egzemplarzu — ale **w karcie, a nie w Menu 1**, czyli dokładnie odwrotnie niż
mówi DEC-404/419. Dowód wzrokowy: `evidence/p10-matryca/05-idea-ai.png` (zakładka „Teresa",
pole „Zapytaj Teresę o swoją pracę…"). Drugie wejście: `IdeaTeresaSection` z czterema chipami
komend (`IDEA_TERESA_COMMANDS`), trzecie: `handleDiscussWithTeresa` (`:2372`).
**Kontrakt: zakładka „Teresa" i przycisk „AI" znikają; w Menu 5 staje „Pracuj z AI ▾"; jedyne
wejście do czatu to dok Menu 1.**

| sekcja | Analizuj | Uzupełnij tę sekcję | Uzupełnij cały dokument | tylko do odczytu |
|---|---|---|---|---|
| Centrum (graf/tabela) | kompletność mapy: brakujące gałęzie, ślepe węzły, sprzeczności (dziś robi to „Analiza płótna") | dopisz węzły/wiersze do zaznaczonej gałęzi z kontekstu pomysłu | szkic całego grafu z ziarna pomysłu + kontekstu organizacji | układ (viewport), wersja grafu |
| Szczegóły elementu | ocena pojedynczego węzła: czy nazwany, czy ma dowód | uzupełnij opis, etykietę, priorytet zaznaczonego węzła | — | id węzła, typ, krawędzie |
| Migawki | — | — | — | wszystko (zapis systemowy) |
| Komentarze | — | — | — | wszystko |
| Aktywność | — | — | — | wszystko |

Zawsze propozycja → „Zatwierdź" (K22) — dziś wzorzec działa tylko w karcie „Analiza płótna"
(„Zastosuj"). Pomysł jest **poza** `CardAnalysisArtifactType`, więc rubryka nie ma dla niego kryteriów (K24 ✗).

## §5. CZYTELNOŚĆ

* `grep -c "primary-[0-9]"` w `IdeaMapWorkspace.tsx`, `IdeaTableTool.tsx`, `IdeaWhiteboardTool.tsx`,
  `IdeaProcessFlowTool.tsx`, `IdeaRightPanel.tsx`, `IdeaElementInspector.tsx` = **0** ✓.
* Fokus `c-focus` ✓ (deklarowane w `IdeaRightPanel.tsx:42`, `IdeaTeresaSection.tsx:15`).
* **Process Flow, 1440: pasek narzędzi centrum jest zasłonięty przez paletę** — „Koniec" ucięte,
  napis „…rocess" wystaje spod palety (`05-idea-process-flow.png`). K20 ✗.
* Tabela: zakładka **„Timeline"** w pasku widoków (`IdeaTableTool.tsx:3048`,
  klucz `ideas.table.timelineGantt` = „Timeline / Gantt") — angielskie słowo w polskim UI, K25 ✗.
* **Nie liczę jako defektów karty**: „LOCAL" i „3 V9 overrides" (nakładki dev,
  `ChatV9FlagsIndicator.tsx` + `EnvironmentBadge.tsx` za `shouldShowDebugOverlays()`),
  oraz angielskie nazwy węzłów („Anomaly detection…") — to dane rekordu, nie UI.

## §6. STAN ZASTANY vs KONTRAKT (K1–K30) — wspólny dla czterech centrów

| K | stan | dowód |
|---|---|---|
| K1 kontrakt sekcji | ✗ | brak katalogu dla żadnego z czterech centrów |
| K2 kontrakt steruje renderem | ✗ | — |
| K3 źródło danych | ~ | writery w §1; Komentarze/Historia panelu bez wołacza |
| K4 reguła pustki | ~ | „Szczegóły elementu" ma poprawny stan pusty; Komentarze/Historia puste na sztywno |
| K5 etykiety/kolejność | ✗ | brak kontraktu |
| K6 | ✓ | `IdeaRightPanel.tsx:250` |
| K7 Właściwości = tabela | **✗** | `05-idea-mindmap.png` |
| K8 | ✓ | |
| K9 | ~ | treść za flagą OFF |
| K10 | ~ | zadeklarowane, twardo puste |
| K11 jeden panel | ✓ | |
| K12 Menu 5 | **✗** | „Panel" + „AI" zamiast trzech elementów |
| K13 lewy spis sekcji | ✗ | zdjęty świadomie 05.09 |
| K14 Edycja/Podgląd | ✗ | brak przełącznika i brak powodu |
| K15 sticky | ✓ | Menu 2/3 zostają przy przewijaniu płótna |
| K16 drabina S/L | ✗ | brak podglądu bocznego z listy |
| K17 zero `primary-*` | ✓ | grep = 0 (6 plików) |
| K18 fokus `c-focus` | ✓ | |
| K19 pigułka | ~ | „Pomysł" zamiast nazwy rekordu |
| K20 1440 bez ucięć | **✗** | Process Flow — pasek pod paletą |
| K21 „Pracuj z AI" | **✗** | 14 komponentów AI + „AI" + „Uzupełnij AI (23)" |
| K22 propozycja → Zatwierdź | ~ | tylko „Analiza płótna" |
| K23 po polsku / wg praw | ~ | patrz K25 |
| K24 deklaracja AI per typ | ✗ | poza `CardAnalysisArtifactType` |
| K25 i18n | **✗** | „Timeline" (`IdeaTableTool.tsx:3048`) |
| K26 podgląd → „Otwórz" | ~ | „Otwórz" działa, podglądu bocznego brak |
| K27 Teresa tylko Menu 1 | **✗** | zakładka „Teresa" = pełny czat w karcie (`IdeaMapWorkspace.tsx:4592`, `:4655`) |
| K28 identyfikatory | ✓ | brak UUID/`seed_` w widocznym DOM |
| K29 błędy konsoli | ~ | mindmap 0, process-flow 0, **table 1 — `409 (Conflict)` przy ładowaniu** (`05-idea-table.png.json`) |
| K30 odbiór | — | brak „Pracuj z AI" do otwarcia |

**Wynik: ✓ 8 · ~ 9 · ✗ 13 z 30.** Identyczny dla wszystkich czterech centrów poza K20
(łamie tylko `process_flow`), K25 (łamie tylko `table`) i K29 (błąd konsoli tylko w `table`).

## §7. LUKI → NAPRAWA

| # | luka | rozmiar | decyzja właściciela? |
|---|---|---|---|
| 1 | **usunąć zakładkę „Teresa" i przycisk „AI" z karty** (K27, DEC-404/419); wejście do czatu wraca do Menu 1 | M | nie — decyzja już jest (DEC-404/419) |
| 2 | Menu 5 (Sekcje · Edycja/Podgląd · Pracuj z AI) na czterech centrach naraz — jedna powłoka, jedna zmiana | L | nie |
| 3 | `PracujZAI` zamiast 14 powierzchni AI; wpis `idea` do `KartaNKey` + kryteria w `cardAnalysisRubric.ts` | L | **tak — patrz pytanie** |
| 4 | katalog sekcji `ideaCardContract.ts` z parametrem `CanvasToolType` (jeden plik, cztery centra) | L | nie |
| 5 | Właściwości → `ArtifactPropertiesTable` (K7) + Komentarze/Historia podpięte do `/map/nodes/:id/comments` i `/activity` | M | nie |
| 6 | Process Flow: pasek narzędzi spod palety (K20) | S | nie |
| 7 | pigułka `Pomysł · <nazwa rekordu>` (K19); „Timeline" → „Oś czasu" (K25); 409 Conflict przy otwarciu tabeli (K29) | S | nie |

**Pytanie do właściciela (1):** czternaście powierzchni AI w warsztacie pomysłu to nie tylko inne
nazwy — część z nich robi rzeczy, których trzy pozycje „Pracuj z AI" nie obejmują (auto-klastrowanie,
wykrywanie martwych punktów, scenariusze „co jeśli", kategoryzacja wierszy).
**Rekomendacja: `Pracuj z AI ▾` z trzema kanonicznymi pozycjami staje się jedynym wejściem, a te
narzędzia wchodzą pod „Analizuj" jako wynik analizy z propozycją → „Zatwierdź"** (nie jako osobne
przyciski). Alternatywa — zostawić je jako paletę narzędzi płótna poza kontraktem AI — łamie K21.

## §8. Zapis rundy 1 (zachowany)

Zrzut listy: `evidence/p10-karty-n/idea/idea.png`; realne rekordy są na liście, warsztatu nie otwarto.

| sekcja | kontrakt mówi | ekran pokazuje | źródło danych | rozjazd | waga |
|---|---|---|---|---|---|
| Płótno wybranego narzędzia | brak kontraktu | `IdeaMapWorkspace.tsx` | idea/tool state → `server/src/routes/my-work.routes.ts` | sekcja poza kontraktem | blokuje MVP |
| Szczegóły elementu | brak kontraktu | `panel/IdeaElementInspector.tsx:194` | node data → writer idei `my-work.routes.ts` | sekcja poza kontraktem | blokuje MVP |
| Teresa | brak kontraktu | `IdeaTeresaSection.tsx` | propozycja AI → executor, zapis dopiero po akceptacji | sekcja poza kontraktem | blokuje MVP |
