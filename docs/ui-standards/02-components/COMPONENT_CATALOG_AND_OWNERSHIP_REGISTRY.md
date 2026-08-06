---
doc_kind: UI_COMPONENT_REGISTRY
status: canonical_control_layer
owner: Piotr Wisniewski
last_updated: 2026-07-31
authority: docs/ui-standards/CANON.md
---

# Rejestr komponentów UI/UX i ich odpowiedzialności

## 1. Cel i granica

Ten rejestr łączy funkcjonalną dokumentację aplikacji z kodem UI. Nie tworzy nowego języka wizualnego. Wygląd i zachowanie rozstrzygają kolejno `CANON.md`, `TRIADA_KANON.md`, standard anatomii artefaktu oraz dokumenty szczegółowe wskazane poniżej.

Każda funkcja wdrażana w module ma wskazać rodzinę komponentu z tego rejestru. Nowy komponent powstaje dopiero po udowodnieniu, że istniejący komponent lub jego wariant nie realizuje wymagania.

## 2. Klasyfikacja

- `CANONICAL` — zalecane źródło współdzielone; nowe wdrożenia powinny go używać.
- `DOMAIN_CANONICAL` — właściwe dla konkretnego rodzaju artefaktu/domeny, ale reużywalne w niej.
- `PARTIAL` — działa, lecz nie spełnia całego kontraktu albo nie ma pełnego E2E.
- `DUPLICATE` — równoległa implementacja tego samego wzorca; wymaga konsolidacji.
- `LEGACY` — utrzymywane wyłącznie dla istniejącego runtime; nie używać w nowym kodzie.
- `MISSING` — kontrakt istnieje, brak wspólnej implementacji.

Status dotyczy rodziny, a nie automatycznie każdego pliku. Dokładny werdykt nadaje audyt komponentu.

## 3. Rejestr rodzin

| ID | Rodzina | Zadanie użytkownika | Kanoniczny kontrakt | Główne implementacje | Stan / decyzja |
| --- | --- | --- | --- | --- | --- |
| `UI-SHELL-01` | Application shell | poruszanie się po aplikacji | `CANON.md`, `FROZEN_LAYOUTS.md`, app topbar | `MainLayout`, layout topbar/sidebar | `CANONICAL`; kolejność menu zamrożona |
| `UI-HUB-01` | Module Hub | wejście do modułu, zakładki, akcje i widoki | `module-hub-standard.md`, `TRIADA_KANON.md` | `shared/ModuleHub/*`, `ModuleMenu3` | `CANONICAL`; moduł deklaruje treść |
| `UI-TABLE-01` | App Table | przegląd, filtracja, selekcja i bulk | `TRIADA_KANON.md`, `TABLE_AND_PREVIEW_CANON.md` | `standard/StandardTable`, `ModuleHub/FilterableTable`, `ui/ResizableTable` | `PARTIAL/DUPLICATE`; wyznaczyć jeden runtime adapter |
| `UI-PREVIEW-01` | Preview Pane | szybka ocena bez utraty listy | te same kanony, bloki Preview 1–6 | `standard/StandardPreview`, `shared/PreviewPane/*`, `TableWithPreviewLayout` | `PARTIAL/DUPLICATE`; wspólny schema-driven preview |
| `UI-KANBAN-01` | Kanban | praca statusowa i drag/drop | `TRIADA_KANON.md`, `view-modes-standard.md` | standard/domain boards | `PARTIAL`; ta sama encja i preview co tabela |
| `UI-CALENDAR-01` | Calendar/Timeline | zdarzenia, terminy i projekty długie | `TIMELINE_CALENDAR_CANON.md` | My Work Calendar, table Calendar/Timeline | `DOMAIN_CANONICAL`; projekty wielotygodniowe jako subtelny marker, nie pełna belka |
| `UI-ART-01` | Artifact Shell | edycja i przegląd dużego wyniku pracy | artifact anatomy, `artifact-shell.md` | `ExecutiveModuleShell`, NMode shell, WorkCanvas shell | `PARTIAL/DUPLICATE`; utrzymać wspólną anatomię |
| `UI-NMODE-01` | N-mode record | praca na kartach encji | `n-mode-card-standard.md`, shared sections | `shared/NModeLayout/*`, `NModeSections/*` | `CANONICAL` dla rekordów |
| `UI-CANVAS-01` | Flexible Canvas | współpraca z artefaktem i Teresą | pakiet Canvas + editor shell canon | `WorkCanvasShell`, editors, artifact runtime | `PARTIAL`; host/runtime registry pozostaje celem |
| `UI-IDEA-01` | Diagram canvas | mind map, whiteboard, process, table | `standards/idea-workspace/*` | `IdeaMapWorkspace`, Canvas primitives | `DOMAIN_CANONICAL/PARTIAL`; wspólny shell, różna mechanika narzędzi |
| `UI-TOOL-01` | Tool/Assessment/Audit workspace | przeprowadzenie sesji i zatwierdzenie outputu | Tool Wizard i dokumenty trzech modułów | `ToolWizard/*`, Discovery Tool workspace | `PARTIAL`; wspólny lifecycle, specyficzne instrumenty |
| `UI-EDITOR-01` | Document editor | tworzenie dokumentów i raportów | editor shell canon, `MATERIALS_EDITOR_VISUAL_STANDARD.md` | TipTap editors, Document Studio | `PARTIAL/DUPLICATE`; jeden kontrakt menu, ikon i lifecycle |
| `UI-DECK-01` | Presentation/Deck | budowa, preview i prezentacja slajdów | `MATERIALS_EDITOR_VISUAL_STANDARD.md` + brand export canon | Reports/Presentations runtime | `PARTIAL`; schema + layout engine + presenter |
| `UI-SHEET-01` | Workbook/Spreadsheet | modelowanie tabelaryczne i obliczenia | `MATERIALS_EDITOR_VISUAL_STANDARD.md` + decyzja silnika arkusza | My Work table, Finance workspaces, Excel import | `PARTIAL`; nie utożsamiać App Table z Excelem |
| `UI-CARD-01` | Content/summary card | skanowalny fragment informacji | `CARD_CONTENT_FORMULA.md`, N-mode standard | BaseCard, Card, SummaryCard, domain cards | `DUPLICATE`; semantyczne warianty zamiast lokalnego stylowania |
| `UI-STATE-01` | Empty/loading/error/streaming | zrozumienie stanu i następnego kroku | `empty-loading-states.md`, error standard | `shared/states/*`, primitives, domain empty states | `DUPLICATE`; `shared/states` kandydatem kanonicznym |
| `UI-OVERLAY-01` | Modal/Drawer/Popover | zadanie lokalne bez utraty kontekstu | building blocks, micro-interactions | `ui/primitives`, shadcn UI, WizardModal | `DUPLICATE`; jeden wrapper per typ i kontrakt focusu |
| `UI-FORM-01` | Forms and fields | wprowadzenie i walidacja danych | building blocks, accessibility rules | `shared/forms/*`, `ui/*`, primitives | `DUPLICATE`; Field ma zapewniać label/help/error/required |
| `UI-ACTION-01` | Button/chip/kebab/bulk | wykonanie działania | TRIADA, kebab, micro-interactions | primitives Button, RowActionsMenu, Menu3 | `PARTIAL`; wariant wynika ze skutku, nie modułu |
| `UI-STATUS-01` | Status/progress/KPI | odczyt kondycji i ryzyka | color system, table canon | StatusPill, badges, progress, KPI cards | `PARTIAL`; jeden słownik semantyczny |
| `UI-REL-01` | Relations/attachments/sources | prześledzenie powiązań i dowodów | shared N-mode sections | Relations, LinkedItems, Attachments, SourceMetadata | `DOMAIN_CANONICAL`; wymagane deep link i no-access state |
| `UI-AI-01` | Teresa action/proposal | prośba, propozycja, diff i akceptacja | AI suggestions modal, Canvas/Chat governance | AIActionSlot, proposal cards, AI panels | `PARTIAL/DUPLICATE`; wspólny proposal envelope |
| `UI-HELP-01` | Help/intro | zrozumienie pytania lub funkcji | help-intro standard | HelpSidePanel, InfoButton, micro-video | `CANONICAL/PARTIAL`; pomoc kontekstowa przed dokumentacją ogólną |
| `UI-NOTIFY-01` | Toast/banner/notification | informacja o wyniku lub ryzyku | notification panel, micro-interactions | Toast variants, Banner, status toast | `DUPLICATE`; toast nie zastępuje trwałego stanu błędu |
| `UI-CREATE-01` | Create/generator wizard | przygotowanie założeń i utworzenie obiektu | generator contracts | UnifiedCreateLauncher, WizardModal, domain generators | `PARTIAL`; thinking/assumptions preview przed generacją |
| `UI-PERM-01` | Permission and capability gate | wyjaśnienie dostępności | navigation permissions canon | CapabilityGate, ProtectedRoute, guards | `PARTIAL`; UI jest projekcją decyzji backendu |

## 4. Obowiązkowy kontrakt integracyjny

Każda instancja komponentu opisuje:

- encję i identyfikator, ownera danych oraz endpoint/query;
- tryb `read`, `edit`, `review`, `present` lub `manage`;
- capabilities i no-access behavior;
- źródło prawdy oraz strategię save/read-back/conflict;
- wejścia z modułów i wyjścia/handoff;
- operacje Teresy: niedostępne, draft, propose albo execute-with-approval;
- telemetrykę jakości bez monitoringu pracownika;
- wersję kontraktu komponentu.

## 5. Zasada użycia przez agentów

Pakiet zadania UI wskazuje `UI Component ID`, kanoniczny dokument, implementację referencyjną i checklistę odbioru. Agent nie kopiuje lokalnego UI z innego modułu, jeśli istnieje wspólny komponent. Gdy obecne API komponentu nie wystarcza, najpierw proponuje rozszerzenie kontraktu; fork jest decyzją architektoniczną.

## 6. Zweryfikowany stan adopcji

Audyt kodu z 2026-07-31 potwierdził stan `PARTIAL`: standardowe komponenty są szeroko używane, ale checkery tolerują istniejący baseline długu. Szczegółowy raport i kolejność migracji: `docs/program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/UI_COMPONENT_STANDARD_ADOPTION_AUDIT_2026-07-31.md`.
