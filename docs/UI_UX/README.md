# UI/UX Source Of Truth — author catalog

Cel katalogu: utrzymać **autorskie, wiążące źródło prawdy UI/UX** dla całej aplikacji Consultify / Antygravity.

Ten katalog opisuje, jak aplikacja ma wyglądać, zachowywać się i komunikować z użytkownikiem z perspektywy autora produktu. Istniejące dokumenty techniczne i systemowe mogą opisywać implementację inaczej, ale ten katalog ma być punktem odniesienia dla decyzji: **czy UI/UX jest zgodny z intencją autora**.

## Status i hierarchia

Status: `AUTHOR_CANON`

Hierarchia przy konflikcie:

1. Ten katalog: `DRD/consultify/docs/UI_UX/`
2. Globalny standard: `DRD/UI_UX_SOURCE_OF_TRUTH.md`
3. Consultify standardy techniczne: `DRD/consultify/docs/ui-standards/`
4. Modułowe kontrakty: `DRD/consultify/docs/modules/<module>/`
5. Starsze raporty, audyty, screeny i work-packety

Jeśli dokument niższego poziomu jest sprzeczny z tym katalogiem, należy go traktować jako wymagający aktualizacji albo jako historyczny.

## Zasada “jedno SSOT” (dual-write)

Żeby realnie utrzymać **jedno** źródło prawdy bez dryfu:

- Najpierw zapisujemy decyzję/kontrakt w `DRD/consultify/docs/UI_UX/*` (AUTHOR_CANON).
- Jeśli zmiana dotyczy standardu/patternu implementacyjnego, to **w tej samej zmianie** uzupełniamy też właściwy dokument w `DRD/consultify/docs/ui-standards/*`.
- Nie tworzymy nowych standardów wyłącznie w `docs/ui-standards/*` bez wpisu i mapowania w AUTHOR_CANON.

## Jak czytać ten katalog

- Pliki `00-09` opisują zasady globalne dla całej aplikacji.
- Pliki `10-19` opisują shell, nawigację i układ aplikacji.
- Pliki `20-39` opisują wzorce ekranów, modułów i komponentów.
- Pliki `40-59` opisują stany, zachowania, komunikaty i AI UX.
- Pliki `60-79` opisują dostępność, responsywność, jakość i weryfikację.
- Folder `_assets/` przechowuje screeny referencyjne, diagramy i adnotacje wizualne.
- Praca na surowych wymaganiach autora odbywa się wg: `INSTRUKCJA_KONTRAKTU.md`.

## Proponowany układ plików

### 00 — Meta i zasady kontraktu

- `00_META.md`
  - właściciel, status, wersja, zakres, data ostatniej decyzji
  - zasada: ownerem decyzji jest autor produktu
- `01_UI_UX_PRINCIPLES.md`
  - zasady nadrzędne: czytelność, spójność, brak ukrytych działań, enterprise trust
  - zasady “ładne UI nie wystarcza, jeśli łamie zaufanie”
- `02_DESIGN_LANGUAGE.md`
  - docelowy charakter wizualny aplikacji
  - ton: enterprise, premium, spokojny, produktywny, bez przypadkowych ozdobników
- `03_GLOSSARY.md`
  - słownik pojęć UI/UX: shell, module, surface, canvas, rail, Menu 2, Menu 3, command row, artifact, proposal
- `04_DECISION_LOG.md`
  - krótkie decyzje autora, data, zakres, skutki

### 10 — Shell i nawigacja aplikacji

- `10_APP_SHELL.md`
  - globalny układ aplikacji: sidebar, topbar, content area, utility areas
  - co jest stałe, co zależy od modułu
- `11_SIDEBAR_AND_MODULE_ORDER.md`
  - kolejność modułów, grupy, etykiety, ikony, badge `Wkrótce`
  - zasada: `Tabele Studio` nie jest osobnym modułem, jeśli dubluje `Tabele`
- `12_TOPBAR_AND_BREADCRUMBS.md`
  - kiedy pokazujemy breadcrumbs, tytuł, projekt, status, global actions
- `13_MENU_2_MODULE_TOPBAR.md`
  - główne taby, prawa grupa akcji, filtry, view toggle, CTA
- `14_MENU_3_COMMAND_ROW.md`
  - jeden dynamiczny rząd pod Menu 2
  - presety po lewej, akcje kontekstowe i AI po prawej
- `15_NAVIGATION_STATES.md`
  - active, hover, disabled, locked, soon, no project selected, permission denied

### 20 — Layouty i typy ekranów

- `20_SCREEN_TAXONOMY.md`
  - typy ekranów: hub/list, workspace, document/artifact builder, admin settings, chat, dashboard, detail page
- `21_MODULE_HUB_LAYOUT.md`
  - standard hubów modułowych: listy, taby, filtry, dynamic tabs, preview pane
- `26_DOCUMENT_STUDIO_UX.md`
  - docelowy UX kontrakt dla `Document Studio` (schema-first artifact + source pack + diff/approval + export)
- `27_PRESENTATION_STUDIO_UX.md`
  - docelowy UX kontrakt dla `Presentation Studio` (Gamma-class artifact engine + sources + diff/approval + PPTX/PDF export)
- `28_IDEA_NOTEBOOK_UX.md`
  - docelowy UX kontrakt dla `Idea Notebook` (capture→enrichment→review queue→konwersje→memory candidates)
- `29_PROCESS_FLOW_UX.md`
  - docelowy UX kontrakt dla `Process Flow Studio` (process as living artifact + QA/analysis + versioning/diff + conversions)
- `38_WHITEBOARD_UX.md`
  - docelowy UX kontrakt dla `Whiteboard` (workshop intelligence + clustering/synthesis + versioning/diff + execution conversions)
- `39_IDEAS_TABLES_UX.md`
  - docelowy UX kontrakt dla `Ideas Tables` (provenance per row/cell + scoring + semantic diff/approval + execution conversions)
- `22_EXECUTIVE_ARTIFACT_LAYOUT.md`
  - Wordy / Tabele / Prezentacje: lewy rail, canvas, prawy rail, top actions
  - link do MELS: `DRD/consultify/docs/product/MODULE_EXECUTIVE_LAYOUT_STANDARD.md`
- `23_N_MODE_AND_CANVAS_LAYOUTS.md`
  - widoki N-type, canvas mode, split panels, lewy rail, embedded views
- `24_ADMIN_AND_SETTINGS_LAYOUTS.md`
  - admin, superadmin, settings, organizacja, portal partnerski
- `25_MOBILE_AND_RESPONSIVE_LAYOUTS.md`
  - desktop-first, tablet, mobile, collapse, overflow, drawers

### 30 — Komponenty i wzorce interakcji

- `30_COMPONENT_SYSTEM.md`
  - podstawowe komponenty: button, chip, badge, input, select, popover, modal, drawer, panel, toast
- `31_TABLES_AND_LISTS.md`
  - App Table, row anatomy, column resizing, row actions, preview pane
- `32_CARDS_AND_GRIDS.md`
  - kiedy grid/karty są dozwolone, kiedy tabela jest kanoniczna
- `33_FORMS_AND_EDITING.md`
  - formularze, dirty state, zapis, walidacja, read-back
- `34_FILTERS_SEARCH_AND_SORT.md`
  - search, filtry domenowe, presety, sortowanie, saved views
- `35_EMPTY_LOADING_ERROR_STATES.md`
  - empty, loading, success, error, degraded, unavailable, partial data
- `36_TOASTS_BANNERS_AND_NOTIFICATIONS.md`
  - krótkie komunikaty, bannery inline, rogi ekranu, brak fake success
- `37_ICONS_BADGES_AND_STATUS.md`
  - ikony, status chips, semantyka kolorów, badge `Wkrótce`, lock states

### 40 — AI UX i governance UI

- `40_AI_UX_PRINCIPLES.md`
  - AI ma być jawne, zrozumiałe, kontrolowane, bez hidden learning
- `41_TERESA_AND_ASSISTANTS.md`
  - Teresa jako główny agent, gdzie może być widoczna, czego nie dublujemy
- `42_AI_ACTIONS_PLACEMENT.md`
  - akcje AI w Menu 3 / prawym slocie, zakaz pływających AI toolbarów
- `43_PROPOSAL_APPROVAL_AUDIT.md`
  - proposal -> approval -> execution -> audit
- `44_AI_OUTPUT_TRUST.md`
  - źródła, confidence, lineage, ograniczenia, brak raw reasoning/internal
- `45_PRIVATE_MODE_AND_MEMORY_UI.md`
  - memory, private mode, organization context, zgody i widoczność

### 50 — Dane, statusy i bezpieczeństwo w UI

- `50_STATE_MODEL.md`
  - save state vs lifecycle state vs permission state
- `51_PERMISSIONS_AND_LOCKED_UI.md`
  - role, locked actions, disabled vs hidden, deny-by-default
- `52_TENANT_AND_ACL_SAFETY.md`
  - co UI może pokazać, czego nie może reklamować, jak komunikować brak dostępu
- `53_TRACEABILITY_AND_SOURCE_UI.md`
  - source panels, lineage, cytowania, read-back, audit trail

### 60 — Jakość, dostępność i weryfikacja

- `60_ACCESSIBILITY_STANDARD.md`
  - keyboard, focus, aria, contrast, motion, readable labels
- `61_PERFORMANCE_UX.md`
  - akceptowalne loading, skeletony, retry, długie zadania, background jobs
- `62_VISUAL_REVIEW_CHECKLIST.md`
  - checklisty screen-by-screen: dark/light, spacing, states, overflow
- `63_UI_UX_ACCEPTANCE_CRITERIA.md`
  - definicja PASS / PASS_WITH_P2 / BLOCKED_P1 / INCONCLUSIVE dla UI
- `64_EVIDENCE_REQUIREMENTS.md`
  - jakie screeny, testy, logi i read-back są wymagane do uznania ekranu za gotowy

### 90 — Referencje i assets

- `_assets/`
  - screeny referencyjne, adnotacje, porównania, diagramy
- `90_REFERENCE_SCREENS.md`
  - indeks screenów referencyjnych i ich statusu
- `91_EXTERNAL_REFERENCES.md`
  - produkty referencyjne i czego dokładnie z nich używamy

## Minimalny szablon każdego pliku

Każdy plik kontraktowy powinien zaczynać się tak:

```md
---
uiux_doc_id: UIUX_<AREA>
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: YYYY-MM-DD
---

# <Title>

## Purpose

## Applies To

## Must

## Must Not

## Should

## Acceptance Criteria

## Related Sources
```

## Zasady utrzymania

- Jedna decyzja autora może aktualizować wiele plików, ale musi być zapisana w `04_DECISION_LOG.md`.
- Nie kopiujemy bez potrzeby istniejących technicznych standardów z `ui-standards/`; linkujemy do nich i dopisujemy autorską interpretację.
- Jeśli UI w aplikacji różni się od tego katalogu, to różnica jest albo świadomym wyjątkiem, albo długiem do naprawy.
- Każdy moduł w `DRD/consultify/docs/modules/<module>/` powinien linkować do właściwych plików z tego katalogu.

