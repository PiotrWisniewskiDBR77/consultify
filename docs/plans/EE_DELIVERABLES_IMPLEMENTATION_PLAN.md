# EE / Deliverables — Plan implementacji (Faza 3)

> **Data:** 2026-06-02
> **Poprzedniki:** [stan obecny](EE_DELIVERABLES_MODULE_ANALYSIS.md) · [benchmark + stan docelowy](EE_DELIVERABLES_TARGET_DESIGN.md)
> **Mandat (Piotr, 2026-06-02):** "rób jak rekomendujesz, unifikuj i scalaj w kompletny system, standardowe formuły."

---

## 0. Najważniejsze odkrycie z sond kodu → rewizja strategii

Większość fundamentu **już istnieje i jest produkcyjna**. To zmienia charakter pracy z "budowy od zera" na **adopcję + unifikację + domknięcie**:

| Potrzeba | Co już jest | Czego brakuje |
|---|---|---|
| Wspólny shell | `ExecutiveModuleShell` (MELS): TopBar+chipy, lewy/prawy rail, canvas, skróty, persist railów. Używany przez DocumentStudio + Tabele. | DeckBuilder go nie używa; CommandPalette niespięty z akcjami modułów; breadcrumb niespięty. |
| Biblioteka (Tab 1) | `ModuleHub` (zakładki, filtry, grid/list, openDocuments); `ReportsAndPresentationsHub` na rejestrze artefaktów. | Chipy filtrów, status, reuse `•••`, raile, akcje masowe, AI-addressable. |
| Edytor dokumentu | TipTap 3.14 zainstalowany; wzorce: `CanvasRichEditor` (AI+diff), Notebook (custom nodes), DeckBuilder `TipTapEditor`. Renderery DOCX/PDF konsumują `DocumentSchema`. | Edytor blokowy spięty z `DocumentSchema`; **Yjs (real-time) niezainstalowany**. |
| Tabela | `GridView`/`CellEditor` (edytowalny, ścieżka standalone); serwerowy `formulaEngine.ts` (parser z precedencją); ~120 endpointów. | Wpięcie grid na `/tabele`; rozbudowa funkcji formuł + wpięcie klienta; ujednolicenie persystencji. |
| Prezentacja | DeckBuilder ~70% (WYSIWYG, 17 bloków, eksport, present mode). | Migracja na MELS, konsolidacja pipeline'ów, testy. |

**Zasada naczelna:** nie tworzymy drugiego standardu. **MELS = jedyny shell, ModuleHub = jedyny hub.** Wszystko inne się do nich dostosowuje.

---

## 1. Architektura docelowa — routing i sidebar

- **Jeden wpis w sidebarze:** "Dokumenty" (EE / Centrum dokumentów) zamiast osobnych "Reports" + "Presentations". Plik: `src/components/layout/Sidebar.tsx` (menuStructure ~299–403) — scalić wpisy #8 i #9 w jeden, z `viewId` prowadzącym do huba.
- **Hub 4-zakładkowy** na bazie `ReportsAndPresentationsHub` (`/presentations` pozostaje kanonicznym mountem, alias `/deliverables`):
  - **Tab 1 — Biblioteka** (ModuleHub: All/Mine/Review + Dokumenty/Tabele/Prezentacje/Szablony).
  - **Tab 2–4 — edytory** otwierane w kontekście (klik w deliverable → MELS edytor danego typu).
- **Przekierowania duplikatów:** KIMI `/wordy` → edytor Dokumentu EE; `/prezentacje` → DeckBuilder EE; `/reports/builder` → Dokument EE (Report = rodzina dokumentu); osierocony `/presentation-studio` → usunięty (governance wpięte w DeckBuilder). Pliki: `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx`.

---

## 2. Workstreamy i kolejność PR-ów

Kolejność = fundament → rdzeń → różnicowniki. Każdy PR samodzielnie mergowalny, za flagą gdzie ryzykowne.

### PR-0 — Higiena (odblokowanie) ½ dnia
- Rozwiązać **5 zacommitowanych konfliktów merge** w plikach flag: `src/utils/melsTabeleFlag.ts`, `tabeleConversionsFlag.ts`, `recordProvenanceFlag.ts`, `tabeleSourcePackFlag.ts`, `tabeleQaFlag.ts`. Decyzja per plik: zachować gałąź MELS/Tabele i osobno gałąź V10 (rozdzielić do dwóch plików, nie wybierać jednej). *(Osobny task-chip już zgłoszony — domknąć tu.)*
- Scaffold namespace'ów i18n: `deliverables`, `docStudio`, `tableStudio`, `deckBuilder` w `public/locales/{en,pl}/` + rejestracja w `src/i18n.ts` (`ns` array). Uzupełnić brakujące `sidebar.outputsLibrary`, `documentStudio.*`.
- **Akceptacja:** build czysty, brak markerów konfliktu (`grep -rn "<<<<<<<" src/`), klucze i18n ładują się w PL.

---

### WS-A — Wspólny shell (fundament nawigacji)

**A1. CommandPalette ↔ MELS ↔ akcje modułów.** Spiąć globalny `src/components/ui/composed/CommandPalette.tsx` z `ExecutiveModuleShell` (`onOpenCommandPalette` już istnieje). Każdy edytor rejestruje swoje akcje (`registerCommands`) przy mount: Dokument (wstaw blok, eksport, sugestie), Tabela (dodaj kolumnę/wiersz/widok), Prezentacja (dodaj slajd, motyw). Odrejestrowanie przy unmount.
- Pliki: `ExecutiveModuleShell/index.tsx`, `CommandPalette.tsx`, + hook `useModuleCommands` (nowy, `shared/ExecutiveModuleShell/`).
- **Akceptacja:** ⌘K w każdym edytorze pokazuje akcje danego modułu + nawigację.

**A2. Ujednolicenie chipów i skrótów.** Potwierdzić `MELS_CHIP_ORDER` (internal→theme→history→qa→governance→analytics→audit→share→agent→run) jako kontrakt; zmapować chipy 3 edytorów na ten porządek. `⌘/` (help), `⌘\` (lewy rail), `⌘↵` (run/present), `⌘⇧A` (agent) identyczne wszędzie.
- Pliki: `ExecutiveModuleShell/ChipDescriptor.ts`, `shortcuts.ts`, `ShortcutHelpModal.tsx`.

**A3. Breadcrumb w TopBarze.** Wpiąć `src/utils/buildWorkspaceBreadcrumb.ts` w `ExecutiveModuleShell/TopBar.tsx` (Workspace › Folder › Deliverable, klikalne człony → powrót do Biblioteki).

**A4. Migracja DeckBuilder na MELS** *(współdzielone z WS-E)*. SlideSorter→lewy rail, CardCanvas→canvas, BlockToolbar→prawy rail tool, `DeckBuilderTopBar`→chipy MELS. Za flagą `ff.deckbuilder_mels`.
- Pliki: `src/components/Presentations/DeckBuilder/DeckBuilder.tsx` (+ TopBar/BlockToolbar/SlideSorter).
- **Akceptacja:** 3 edytory mają identyczne chrome (ten sam TopBar, raile, skróty, ⌘K); różni się tylko canvas.

---

### WS-B — Biblioteka (Tab 1)

**B1. Kontener 4-zakładkowy.** W `ReportsAndPresentationsHub` ustawić zakładki: `library` (domyślna) + przejścia do edytorów. ModuleHub `tabs` + `viewMode` (grid/list toggle).

**B2. Pasek filtrów-chipów.** Typ / Właściciel / Data / **Status** (Szkic/Review/Final/Wysłane) / Tag-Klient; liczniki per opcja; widoczny stan aktywnych; sort Trafność/Edytowane/Nazwa. Dane z rejestru `GET /api/artifacts` (`useRapData.ts` `mapRegistryItemToUnified`).
- Pliki: `src/components/ReportsAndPresentations/{ReportsAndPresentationsHub,useRapData,*TabContent}.tsx`, `shared/ModuleHub` (`FilterChip` już jest).

**B3. Karty + reuse.** Miniatura dla Prezentacji, ikona-typu+metadane dla Doc/Tabela; hover-preview; badge statusu; awatary. `•••`: **Duplikuj** (pierwsze), Użyj jako szablon, Zapisz jako szablon, Udostępnij, Przenieś, Zmień nazwę, Usuń.

**B4. Raile + akcje masowe.** "Ostatnio otwierane" (już jest — M2), "Ulubione", "Szablony"; multi-select → pływający pasek (Przenieś/Udostępnij/Usuń/Tag/Status).

**B5. AI-addressable.** Każdy deliverable wybieralny jako kontekst Teresy ("zrób ofertę z tych trzech") — spiąć z `ContextAssetSelector`/openChatWithContext.
- **Akceptacja:** Biblioteka filtruje po typie/statusie, duplikuje, otwiera w edytorze, podaje do Teresy.

---

### WS-C — Edytor Dokumentu (TipTap) — RDZEŃ

**Kontrakt nadrzędny:** edytor mutuje `DocumentSchema` (block.type → block.content) — renderery DOCX/PDF/markdown (`server/.../documentDocxRenderer|documentPdfRenderer|documentSchemaRenderer.ts`) **bez zmian**. Edytor nie wymyśla nowych typów bloków poza 13 zdefiniowanymi (`server/.../documentStudioTypes.ts`).

**C1. Block editor TipTap.** Nowy `DocumentStudioBlockEditor` w `src/components/DocumentStudio/`, montowany w canvasie zamiast read-only `renderSectionPreview`. Mapowanie dwukierunkowe `DocumentSchema ⇄ TipTap doc`:
- heading/paragraph/bullet_list/numbered_list/table/callout/quote/image — natywne + custom nodes (reuse `MyWork/notebook/extensions.ts`: CalloutNode; nowe dla kpi_strip/risk_table/chart/footnote/citation jako atomic/embed nodes z renderem read-only w edytorze, edytowalne przez properties panel).
- Serializer `tiptapToDocumentSchema` + `documentSchemaToTiptap` (nowe utils) — to jest sedno; musi zachować `blockId`, `sourceRef`, `audienceTags`.

**C2. Slash-menu + floating toolbar.** Reuse wzorca z `CanvasEditor` (CanvasEditorToolbar) i DeckBuilder TipTapEditor. `/` wstawia bloki; zaznaczenie → format inline.

**C3. Inline AI (Teresa).** Reuse `CanvasAIFloatingMenu` + marki diff `AIAddedMark`/`AIRemovedMark` (już w `CanvasEditor/canvasEditorExtensions.ts`): zaznacz → rewrite/skróć/rozwiń/ton/streść → podgląd diff → accept/reject.

**C4. Most do systemu proposali.** Edycje bezpośrednie domyślnie commitują schema; edycje AI o zakresie >local przechodzą przez istniejący `DocumentStudioEditorPanel` proposal/diff (zachować governance). Decyzja: direct-edit dla local, proposal dla section/global/methodology/transformative.

**C5. AI generuje realną treść (nie placeholdery).** Zmienić `buildDocumentSchema`/`documentContentGenerator.ts` (server) by generował treść bloków przez LLM do **walidowanego schematu** (wzorzec Kimi: template+skill, nie surowy dump). Edytowalny outline przed generacją (już jest `DocumentStudioOutlinePanel`).

**C6. Outline/TOC + wersje.** Lewy rail = outline z nagłówków (auto). Historia wersji (schema snapshots już istnieją server-side).

**C7. (Pod-faza) Real-time collab.** Instalacja Yjs + `@tiptap/extension-collaboration(-cursor)` + provider (Hocuspocus/y-websocket). Osobny PR, za flagą — bo to nowa zależność i backend WS.
- **Akceptacja:** użytkownik pisze dokument blokowo, slash-menu działa, inline AI z diffem, eksport DOCX/PDF zgodny, treść realna.

---

### WS-D — Tabela: unifikacja + standardowe formuły

**D1. Edytowalny grid na `/tabele`.** Zastąpić statyczną tabelę w `tabelePreview/TabelePreviewLayout.tsx` komponentem `GridView` (ścieżka `GridViewStandalone` lub `TableDataProvider`). Wpiąć w `TabeleMelsView` (MELS już tam jest).
- Pliki: `TabelePreviewLayout.tsx`, `TabeleView.tsx`, `tabeleShell/TabeleMelsView.tsx`, `MyWork/table/{GridView,CellEditor}.tsx` (uczynić w pełni standalone).

**D2. Persystencja.** `/tabele` używa metadata-first (`tablePlatform.api.ts` `updateRecord`/`createField`) — porzucić legacy graph fallback dla tej powierzchni. `IdeaTableTool` (MyWork) zostaje dla Ideas, ale grid współdzielony.

**D3. Standardowy silnik formuł.** Rozbudować **serwerowy** `server/src/services/tablePlatform/formulaEngine.ts` (ma już tokenizer+parser z precedencją) o pełną bibliotekę funkcji: tekst (LEFT/RIGHT/MID/TRIM/SUBSTITUTE/REGEX), logika (IF/SWITCH/AND/OR/NOT), liczby (SUM/ROUND/MOD/ABS/...), data (DATETIME_DIFF/DATEADD/NOW/TODAY/WORKDAY), **+ hybryda: odwołania zakresowe (range) jako różnicownik vs Airtable** oraz relacyjne lookup/rollup/count z agregacją warunkową. Dodać endpointy `validateFormula`/`previewFormula`.
- Klient: zastąpić `FormulaEngineV2.ts` wywołaniami serwera (walidacja przy edycji pola formula, preview w komórce). Zachować lekki klient-eval tylko dla natychmiastowego previewu prostych przypadków.

**D4. Live'owanie stubów AI Editor.** Poziomy z `handlerStatus: 'stub'` → realne handlery (priorytet: cell/record/column/structure).
- **Akceptacja:** edycja komórek na `/tabele`, formuły z bibliotekę funkcji + zakresami liczą się i walidują, AI Editor bez stubów na kluczowych poziomach.

---

### WS-E — Prezentacja: konsolidacja

**E1.** Migracja DeckBuilder na MELS (= A4).
**E2.** Wpiąć governance z `PresentationStudioPage` (layout audit, approvals, capacity) jako chipy/panele w DeckBuilderze; **usunąć** route `/presentation-studio` i `PresentationStudioPage` (po przeniesieniu wartościowych części). Pliki: `AppRoutes.tsx`, `routeConfig.ts`, `src/components/PresentationStudio/`.
**E3.** Usunąć martwy `src/components/Presentations/PresentationsHub.tsx`.
**E4.** Edytowalny eksport PPTX (różnicownik vs Gamma) — slide-native, nie rasteryzacja. `services/presentationExport.ts` + serwer.
**E5.** Testy FE edytora (DeckBuilder/CardRenderer/LayoutEngine/bloki) — dziś zero.
- **Akceptacja:** jeden pipeline prezentacji w MELS, brak osieroconych route/martwego kodu, eksport PPTX edytowalny, testy edytora zielone.

---

### WS-F — Różnicowniki (po domknięciu rdzenia)

- **Dokument:** tryb sugestii / track-changes (redline accept/reject) — buduje na markach diff z C3.
- **Tabela:** pivot + natywne wykresy (poza Interface), pełna hybryda formuł.
- **Prezentacja:** kontrolowalny agent (scoped edit + live diff przed apply + "zablokuj kartę"), system animacji/przejść, Agentic Fact Check.
- **Całość:** governance/status jako first-class chip; wspólny substrat AI Drive (reuse między narzędziami: sheet→deck, doc→deck).

---

## 3. Zależności i ryzyka

- **WS-A i WS-E dzielą A4** (migracja DeckBuilder na MELS) — robić raz, najpierw.
- **WS-C C7 (Yjs)** to nowa zależność + backend WS — wydzielony, nie blokuje reszty edytora.
- **Kontrakt DocumentSchema** (C1) — najwyższe ryzyko regresji eksportu; serializer pokryć testami round-trip (schema→tiptap→schema = identity).
- **Persystencja tabel** (D2) — uważać na rozjazd z `IdeaTableTool`; grid współdzielony, persystencja per-powierzchnia.
- **Flagi:** każdy ryzykowny krok za flagą (`ff.deckbuilder_mels`, `ff.doc_block_editor`, `ff.tabele_editable_grid`), kill-switch do rollbacku.

## 4. Proponowana kolejność realizacji
**PR-0** (higiena) → **WS-A** (A1–A4 shell + DeckBuilder na MELS) → **WS-B** (Biblioteka) → **WS-C** (edytor Dokumentu, C7 później) → **WS-D** (Tabela + formuły) → **WS-E** (konsolidacja Prez) → **WS-F** (różnicowniki).

## 5. Pierwszy krok do wykonania
**PR-0 + WS-A1/A2** — odblokowanie (konflikty, i18n) + spięcie CommandPalette z MELS i ujednolicenie chipów/skrótów. To natychmiast daje wspólne, spójne chrome bez ryzyka dla danych.
