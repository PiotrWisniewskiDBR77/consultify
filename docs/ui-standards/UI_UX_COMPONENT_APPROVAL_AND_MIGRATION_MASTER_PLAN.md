# UI/UX Component Approval And Migration Master Plan

Status: `v1 - approval workflow and migration playbook`
Date: 2026-05-01
Owner decyzyjny: Product / CTO / Delivery Owner
Repo: `DRD/consultify`

## 1. Cel dokumentu

Ten dokument jest roboczą ścieżką przejścia od obecnego UI/UX Consultify do zatwierdzonego Golden Standardu.

Łączy dwa kroki:

1. **Krok 2 - zatwierdzanie komponentów i wzorców**: jak decydujemy, czy komponent/wzorzec jest dopuszczony, rozszerzany, migrowany lub usuwany.
2. **Krok 3 - migracja obecnego stanu do pożądanego**: jak przechodzimy przez moduły i ekrany bez utraty kontekstu, bez improwizacji i bez mieszania logiki biznesowej z UI refactorem.

Ten dokument jest checklistą prowadzącą. Po każdej sekcji powinna powstać decyzja: `APPROVED`, `APPROVED_WITH_CHANGES`, `DEFERRED`, `REJECTED`, `NEEDS_STANDARD`.

## 2. Dokumenty nadrzędne

Przed użyciem tego planu obowiązuje hierarchia:

1. `docs/ui-standards/CONSULTIFY_UI_UX_GOLDEN_STANDARD.md`
2. `docs/ui-standards/CONSULTIFY_UI_UX_OPERATING_STANDARD.md`
3. `docs/ui-standards/UI_UX_CANON_V3.md`
4. `docs/ui-standards/FROZEN_LAYOUTS.md`
5. Ten dokument.
6. `docs/ui-standards/UI_UX_MIGRATION_AUDIT.md`
7. `docs/ui-standards/UI_UX_MIGRATION_PLAN.md`
8. `docs/ui-standards/UI_UX_REFERENCE_SCREENS.md`

Jeśli ten dokument wykryje brak standardu, zatrzymujemy implementację w tym zakresie i tworzymy/uzupełniamy dokumentację.

## 3. Zasady nienegocjowalne

### 3.1 Zero improwizacji

Nie ma migracji "na oko". Każda zmiana UI musi mieć:

- ekran/moduł,
- obecny wzorzec,
- docelowy wzorzec,
- listę komponentów,
- decyzję, czy potrzebny nowy standard,
- zakres refactoru,
- Definition of Done.

### 3.2 Bez zmiany logiki przy UI refactorze

Domyślnie nie zmieniamy:

- API,
- routingu,
- modelu danych,
- permission modelu,
- logiki biznesowej,
- workflow użytkownika,
- semantyki statusów,
- tenant isolation.

Jeśli UI refactor wymaga zmiany workflow, to nie jest zwykła migracja UI. To osobna decyzja produktowa.

### 3.3 Najpierw standard, potem komponent

Jeżeli brakuje komponentu:

1. opisujemy potrzebę,
2. sprawdzamy istniejące komponenty,
3. decydujemy: rozszerzyć / stworzyć / odrzucić / zostawić jako wyjątek,
4. dopisujemy dokumentację,
5. dopiero potem implementujemy.

### 3.4 Stare UI to migration debt

Legacy/custom UI nie blokuje pracy samo w sobie. Staje się blockerem, jeśli łamie:

- honest UI,
- read-back,
- główną akcję,
- bezpieczeństwo,
- permission/tenant boundary,
- governance,
- dostępność krytycznego workflow,
- raw internals / fake success.

## 4. Słownik statusów

### 4.1 Status komponentu

| Status | Znaczenie |
|---|---|
| `APPROVED_CORE` | Komponent bazowy, obowiązkowy do użycia. |
| `APPROVED_COMPOSED` | Komponent wyższego poziomu, używany dla konkretnego wzorca. |
| `APPROVED_ADAPTER` | Adapter domenowy dopuszczony tymczasowo lub trwale, np. Admin adapter. |
| `REFERENCE_CANDIDATE` | Kandydat do zatwierdzenia po review. |
| `MIGRATION_DEBT` | Lokalny komponent/styl do migracji. |
| `DEPRECATED` | Nie używać w nowym kodzie. |
| `FORBIDDEN` | Zakaz użycia. |
| `NEEDS_STANDARD` | Najpierw stworzyć/uzupełnić dokumentację. |

### 4.2 Status ekranu

| Status | Znaczenie |
|---|---|
| `APPROVED_REFERENCE` | Ekran zatwierdzony jako wzorzec. |
| `REFINE_REFERENCE` | Kandydat na wzorzec po korektach. |
| `MIGRATION_READY` | Ma audyt i lokalny plan, można implementować. |
| `MIGRATION_BLOCKED` | Brakuje decyzji/standardu. |
| `MIGRATION_IN_PROGRESS` | Refactor trwa. |
| `MIGRATED_PENDING_REVIEW` | Refactor gotowy, czeka na review. |
| `MIGRATED_APPROVED` | Zgodny ze standardem. |
| `DO_NOT_TOUCH` | Nie ruszać bez osobnej decyzji. |

### 4.3 Status decyzji

| Status | Znaczenie |
|---|---|
| `APPROVED` | Można stosować. |
| `APPROVED_WITH_CHANGES` | Można stosować po poprawkach. |
| `DEFERRED` | Nie teraz, wrócić później. |
| `REJECTED` | Nie stosować. |
| `NEEDS_OWNER_DECISION` | Wymaga decyzji Piotra/CTO/Product. |

## 5. Krok 2 - approval komponentów i wzorców

### 5.1 Cel kroku

Zbudować zatwierdzony katalog komponentów i wzorców, z którego Cursor oraz developerzy mają korzystać przy każdej pracy UI/UX.

Efekt końcowy:

- wiemy, co jest `APPROVED_CORE`,
- wiemy, co jest `APPROVED_COMPOSED`,
- wiemy, co jest `APPROVED_ADAPTER`,
- wiemy, co jest legacy/migration debt,
- wiemy, jak zatwierdzać nowy komponent,
- nie powstają przypadkowe lokalne komponenty.

## 6. Krok 2A - inventory komponentów

### 6.1 Źródła do przejścia

| Obszar | Ścieżka | Cel |
|---|---|---|
| UI primitives | `src/components/ui/primitives` | zatwierdzić core atoms |
| UI composed | `src/components/ui/composed` | zatwierdzić common patterns |
| Resizable table | `src/components/ui/ResizableTable` | zatwierdzić table primitives |
| Module shell | `src/components/shared/ModuleHub` | zatwierdzić hub/surface shell |
| N-mode | `src/components/shared/NModeLayout` | zatwierdzić detail/artifact shell |
| Preview | `src/components/shared/PreviewPane` | zatwierdzić preview anatomy |
| Tool wizard | `src/components/shared/ToolWizard` | zatwierdzić guided flows |
| Admin shared | `src/components/Admin/shared` | zdecydować adapter vs migration debt |
| MyWork shared | `src/components/MyWork/shared` | zatwierdzić domenowe komponenty pracy |
| DiscoveryTools local | `src/components/DiscoveryTools` | sklasyfikować tool components |

### 6.2 Tabela inventory

Wypełniamy dla każdego komponentu lub grupy komponentów:

| Component / Pattern | Path | Type | Current status | Target status | Used by | Gaps | Decision | Owner note |
|---|---|---|---|---|---|---|---|---|
| `Button` | `src/components/ui/primitives/Button.tsx` | primitive | shared | `APPROVED_CORE` after role split | global | must support CTA/secondary/ghost/danger only, not tabs/chips/dropdowns | `APPROVED_WITH_CHANGES` | Owner approved taxonomy under DBR77 Tech Sexy 2027. Implementation still needs variant cleanup. |
| `Primary CTA` | `Button` role | action role | mixed | `APPROVED_CORE` | screen-level main action | one colorful CTA, solid primary, no default glow; label is semantic, `Plus` icon allowed for creation | `APPROVED` | Frozen as role standard under DBR77 2027. |
| `Toolbar Control` | shared control pattern needed | control role | mixed | `NEEDS_STANDARD` | Data/Model/View/Filter dropdowns | unify height, radius, surface, chevron, border | `APPROVED` | Role approved; shared implementation/pattern still to be created or mapped. |
| `Segmented Module Tab` | ModuleHub/DynamicTabs | navigation role | mixed | `NEEDS_STANDARD` | module tabs | unify active/inactive surface and pill radius | `APPROVED` | Role approved; implementation review next. |
| `Status Filter Chip` | shared chip/filter pattern needed | filter role | mixed | `NEEDS_STANDARD` | status filters/counters | semantic dot, not colored button | `APPROVED` | Role approved; shared implementation/pattern still to be created or mapped. |
| `Icon Button` | primitive/shared pattern needed | control role | mixed | `NEEDS_STANDARD` | search/help/inbox/notifications/close | consistent affordance in menu rows | `APPROVED` | Role approved; shared implementation/pattern still to be created or mapped. |
| `Card` | `src/components/ui/primitives/Card.tsx` | primitive | shared | `APPROVED_CORE` | global | check shadow/border defaults | pending | |
| `Badge` | `src/components/ui/primitives/Badge.tsx` | primitive | shared | `APPROVED_CORE` after contrast redesign | global | current badge/chip contrast is not readable enough, especially light mode | `APPROVED_WITH_CHANGES` | Needs new badge/status chip contrast standard: readable text, semantic marker, stronger surface/border strategy. |
| `DataTable` | `src/components/ui/composed/DataTable.tsx` | composed | shared | `APPROVED_COMPOSED` | generic lists | compare with App Table needs | pending | |
| `ResizableTable` | `src/components/ui/ResizableTable/*` | table system | shared | `APPROVED_COMPOSED` | MyWork/Interview | check column/filter API | pending | |
| `ModuleHub` | `src/components/shared/ModuleHub` | shell | shared | `APPROVED_COMPOSED` | module hubs | confirm Menu 3 support | pending | |
| `NModeShell` | `src/components/shared/NModeLayout` | shell | shared | `APPROVED_COMPOSED` | details/artifacts | confirm save/lifecycle split | pending | |
| `PreviewPaneShell` | `src/components/shared/PreviewPane` | preview | shared | `APPROVED_COMPOSED` | table preview | confirm default-off flow | pending | |
| `ToolWizardShell` | `src/components/shared/ToolWizard` | wizard shell | shared | `APPROVED_COMPOSED` | tools | confirm control bar rules | pending | |
| `Admin/shared/*` | `src/components/Admin/shared` | domain adapter | local/shared mix | `NEEDS_OWNER_DECISION` | admin | adapter vs migrate | pending | |

## 7. Krok 2B - kryteria zatwierdzenia komponentu

Komponent dostaje status `APPROVED_CORE` lub `APPROVED_COMPOSED`, jeśli spełnia:

| Kryterium | Wymóg |
|---|---|
| Design consistency | Zgodny z Golden Standard. |
| DBR77 Tech Sexy 2027 fit | Wygląda jak globalny SaaS AI klasy enterprise, nie lokalny panel ani przypadkowy moduł. |
| Token usage | Używa tokenów DBR77/Tailwind, nie ad-hoc hex. |
| Light/dark | Czytelny w obu trybach. |
| Shape/elevation | Używa zatwierdzonej skali radius i nie dodaje cieni poza floating/sticky UI. |
| Density | Pasuje do `Compact`, `Comfortable` albo `Reading` i nie miesza ich przypadkowo. |
| Variants | Ma jasno nazwane warianty. |
| States | Obsługuje loading/disabled/error/active/focus, jeśli dotyczy. |
| A11y | Ma focus, keyboard behavior, aria tam gdzie dotyczy. |
| Composition | Nadaje się do użycia w wielu ekranach. |
| No hidden logic | Nie miesza UI z logiką biznesową. |
| Docs | Ma opis w standardzie albo jest opisany w tym planie jako approved. |

## 8. Krok 2C - kryteria odrzucenia komponentu

Komponent jest `MIGRATION_DEBT`, `DEPRECATED` lub `FORBIDDEN`, jeśli:

- powiela istniejący komponent bez powodu,
- ma własną paletę,
- ma własne shadow/border/spacing niezgodne z kanonem,
- nie obsługuje disabled/loading/error,
- robi mutacje bez feedbacku,
- miesza UI z API/logiką biznesową,
- tworzy lokalny design system w module,
- nie da się go użyć poza jednym ekranem i nie ma powodu domenowego.

## 9. Krok 2D - procedura nowego komponentu

### 9.1 Formularz propozycji

Każdy nowy komponent wymaga wpisu:

```md
## Component Proposal: <name>

Status: NEEDS_OWNER_DECISION
Problem:
- ...

Existing components checked:
- ...

Why existing components do not fit:
- ...

Proposed type:
- primitive / composed / shell / domain adapter / view-local control

Anatomy:
- ...

Props / variants:
- ...

States:
- default
- hover
- focus
- active
- disabled
- loading
- error

Where used:
- ...

Where not used:
- ...

Documentation target:
- docs/ui-standards/...

Decision:
- APPROVED / REJECTED / DEFERRED
```

### 9.2 Bramka decyzji

Przed implementacją nowego komponentu:

1. Czy istnieje komponent shared?
2. Czy można rozszerzyć istniejący komponent?
3. Czy to jest wariant, nie nowy komponent?
4. Czy komponent będzie użyty w więcej niż jednym miejscu?
5. Czy jest wymagany przez krytyczny workflow?
6. Czy opisaliśmy states i a11y?
7. Czy jest jasne, gdzie ma żyć?

Jeśli odpowiedź na 1-3 jest "tak", nie tworzymy nowego komponentu.

## 10. Krok 2E - approval control barów

### 10.1 Dozwolone typy

| Typ | Lokalizacja | Kiedy używać | Kiedy nie używać |
|---|---|---|---|
| `App Topbar` | global shell | globalny status i user controls | nigdy dla akcji modułu |
| `Module Topbar` | moduł | tabs, filters, view, add, area | nie dla lokalnego workflow kroku |
| `Menu 3 / Command Row` | pod Module Topbar | search, counters, dynamic tabs, bulk | nie dublować toolbarów |
| `View-local Toolbar` | wewnątrz konkretnego widoku | zoom, timeline controls, canvas controls | nie dla filtrów globalnych modułu |
| `Workspace 3-tools Strip` | workspace panel | Tools / Context / AI Suggestions | nie dodawać 4. przycisku bez standardu |
| `Bulk Action Bar` | command row mode | multi-select actions | nie jako stały toolbar |
| `Preview Footer Actions` | preview pane | quick actions parity | nie jako nowe flow bez full view parity |

### 10.1.1 Button/menu role approval order

Przy ekranach z wieloma controls nie zaczynamy od globalnego `Button`, tylko od klasyfikacji ról:

1. `Primary CTA` - główna akcja ekranu, maksymalnie jedna kolorowa.
2. `Toolbar Control` - dropdown/filter/view triggers w topbarze lub command row.
3. `Segmented Module Tab` - tabs/nawigacja modułu.
4. `Status Filter Chip` - statusy, liczniki, quick filters.
5. `Icon Button` - search/help/inbox/notification/close/more.
6. `Ghost/Text Action` - inline/row actions.
7. `Danger Action` - destrukcja, tylko z confirm/governance.

Każdy element approval musi opisać:

- do której roli należy,
- w którym menu row występuje,
- jaka ma być wysokość,
- jaki radius,
- jakie tło i border,
- czy ma chevron/icon/dot,
- czy jest active/selected/disabled/loading,
- co zmieniamy pod `DBR77 Tech Sexy 2027`.

### 10.1.2 Approval log - button/menu taxonomy

| Date | Item | Decision | Condition | Notes |
|---|---|---|---|---|
| 2026-05-01 | Button/menu control taxonomy | `APPROVED` | Approved under `DBR77 Tech Sexy 2027` rules | Roles are frozen as the classification system for current and future menu/button reviews. Implementation still proceeds role by role. |
| 2026-05-01 | Primary CTA | `APPROVED` | Approved under `DBR77 Tech Sexy 2027`; semantic label, `Plus` icon allowed for creation | Solid primary, one per screen, no default gradient/glow, default `h-9`; literal `+` is not part of text label, but `Plus` icon is required/allowed for actions like `Nowy pomysł`. |

### 10.1.3 Working note - Toolbar Control observations

Status: `WORKING_NOTE_FOR_FINAL_PLAN`

Zakres: `Toolbar Control`, czyli dropdown/filter/view triggers w topbarze albo command row, np. `Data`, `Model`, `Draft`, `Table`, `View`, `Filter`, `Area`.

Wszystkie wcześniejsze założenia pozostają w mocy, szczególnie `DBR77 Tech Sexy 2027`, `Button/menu control taxonomy`, `Primary CTA`, five-layer surface model, density modes i zasada jednego kolorowego CTA na ekran.

#### Zatwierdzony kierunek dla Toolbar Control

| Właściwość | Decyzja |
|---|---|
| Default height | `h-9` |
| Dense toolbar height | `h-8` tylko w bardzo gęstych toolbarach |
| Radius | `rounded-hig-full` |
| Surface | subtelne Layer 2/3 surface |
| Border | albo wszystkie controls w grupie mają subtelny border, albo żaden; bez mieszania |
| Hover | tylko subtelna zmiana tła |
| Active/open | nieco mocniejsze tło, nie mocny kolor |
| Dropdown affordance | chevron obowiązkowy dla dropdownów |
| Icon | opcjonalna, monochromatyczna |
| Status | kolor tylko jako dot/badge, nie cały przycisk |
| Primary color | nie używać primary/fioletowego tła |
| Gradient | nie używać |
| Shadow | nie używać |

#### Obserwacje z obecnego ekranu

Na ekranie referencyjnym `Tools` / górny pasek modułu / prawa strona:

- część controls ma różne tła,
- część controls wygląda ciemniej, część jaśniej,
- `Help` wygląda jak tekst/action bez wyraźnego affordance,
- niektóre controls mają inny radius,
- elementy w jednym rzędzie nie wyglądają jak jedna rodzina,
- obecny ekran wymaga późniejszej migracji do jednego spójnego standardu toolbar controls.

#### Free thoughts inbox - do uporządkowania w finalnym planie

Te punkty są świadomie zapisywane jako surowe obserwacje użytkownika. Nie wymagają ponownego opisywania w przyszłości; przy finalizacji zostaną przepisane do właściwych decyzji standardu.

| Date | Screen / reference | Free thought | Initial classification |
|---|---|---|---|
| 2026-05-01 | `My Work / Moja praca > Start`, main menu row; screenshot `Screenshot_2026-05-01_at_10.10.31-38421e5d-2887-4a12-926b-ed640462e84a.png` | Przyciski w menu głównym wyglądają ogólnie dobrze: są kształtne, ikony są OK, stylistycznie idą w dobrą stronę. Możliwe jednak, że są lekko za duże; obecnie mniejsze controls zaczynają wyglądać bardziej jak standard. Warto rozważyć zmniejszenie rozmiaru bez utraty czytelności i jakości ikon. | `Segmented Module Tab` / `Toolbar Control` sizing review; candidate for `h-8` or tighter `h-9` variant. |
| 2026-05-01 | `My Work / Moja praca > Pomysły`, right-side view switcher and `Nowy pomysł`; screenshot `Screenshot_2026-05-01_at_10.12.38-3ee6b1f5-0b2a-457a-aa4e-90abe754cd21.png` | Przyciski wyboru widoku mają zostać dokładnie w formie segmentowych ikon jak na screenie; nie chcemy listy rozwijanej dla wyboru widoku. `Nowy pomysł` jako create action wymaga ikony `Plus`. | `View Mode Toggle` must be segmented icon control, not dropdown. `Primary CTA` allows/requires `Plus` icon for create actions. |
| 2026-05-01 | `My Work / Moja praca > Pomysły`, `Menu 3`; screenshots `Screenshot_2026-05-01_at_10.14.06-8c7c3892-57a7-4ec6-be40-4d5428a567a4.png`, `Screenshot_2026-05-01_at_10.14.59-edbd5e23-b30a-4bb0-b099-464a587138c0.png` | Rząd dynamicznych akcji i filtrów powinien nazywać się `Menu 3`. Dobrze, że jest na lekko innym tle; taki subtelnie odróżniony surface powinien być standardem wszędzie, bo pokazuje, że są to controls zmienne od kontekstu. Obecnie w aplikacji bywa to różnie. | `Menu 3 / Command Row` surface standard: separate subtle Layer 2/3 background, context row distinct from Module Topbar. |
| 2026-05-01 | `My Work / Moja praca` dynamic `Menu 3` across Decisions, Tasks, Inbox, Notes; screenshots `Screenshot_2026-05-01_at_10.16.22-9d548da9-614d-46cc-96d5-1a7dd7989ba4.png`, `Screenshot_2026-05-01_at_10.16.30-e713a11d-3d98-4aae-954c-155262940536.png`, `Screenshot_2026-05-01_at_10.16.40-6b3f2a02-250d-44b2-99a0-bedcf2357896.png`, `Screenshot_2026-05-01_at_10.16.49-527158f4-3c5a-489d-b82f-9d6238dbe5d5.png` | `Menu 3` potrzebuje pełnego standardu tła, wysokości i zachowania przy zmianie kontekstu. Obecnie wysokość nie jest wystandaryzowana między ekranami i dynamiczna zmiana rowa może zmieniać rytm UI. | `Menu 3` final standard must define background/surface, min/default height, dense/expanded variants, transition behavior, and layout stability when context changes. |
| 2026-05-01 | `My Work / Moja praca > Decyzje`, priority dropdown and view switcher; screenshots `Screenshot_2026-05-01_at_10.18.21-d7c33f8a-aec8-4da5-8607-7537abbd0d0a.png`, `Screenshot_2026-05-01_at_10.18.36-afa5f814-07dc-4448-8cf9-376c826f8d8f.png` | Przyciski wyboru widoku są bardzo dobre w obecnej formie. Filtr priorytetu jako dropdown jest potrzebny, ale trigger jest bez sensu za szeroki, bo powtarza kontekst `Priorytet:`. Trigger powinien pokazywać tylko krótką wartość, np. `Wszystkie`, `Krytyczne`, `Wysokie`, `Średnie`, `Niskie`; pełny kontekst może być w menu, tooltip albo aria label. | `Toolbar Control` dropdown trigger copy rule: show current value only when context is obvious from placement/menu; avoid repeated label prefix in compact topbar controls. |
| 2026-05-01 | `My Work / Moja praca > Inbox` and `My Work / Moja praca > Zadania`, bulk selection state; screenshots `Screenshot_2026-05-01_at_12.52.06-8353f0f5-de63-4fa2-aab0-cffdb1211002.png`, `Screenshot_2026-05-01_at_12.52.45-b046465f-dc79-4ddb-a5c3-001b8ad1eaee.png` | Bulk-selection mode in `Menu 3` is the right behavior: when user selects rows, the dynamic row should switch to bulk actions. Problem: action buttons in this mode are not using the correct/consistent button standard. They should be analogous to other `Menu 3` controls and use approved roles (`Toolbar Control`, `Secondary Action`, `Danger Action`) with consistent height, radius, surface, border and icon treatment. | `Bulk Action Bar` is a Menu 3 mode, not a separate design system. Bulk action buttons must follow same control taxonomy and DBR77 2027 button rules. |
| 2026-05-01 | `My Work / Moja praca > Decyzje`, selected rows with right-side contextual actions; screenshot `Screenshot_2026-05-01_at_12.53.48-38936aa5-5fa5-4459-89b4-828a75d5dac3.png` | Prawy slot akcji kontekstowych w `Menu 3` jest bardzo dobrym wzorcem: po zaznaczeniu rekordów akcje pojawiają się po prawej stronie dynamicznego menu. To jest właściwy kierunek. Nadal problemem jest sam styl przycisków - muszą zostać dopasowane do approved roles i DBR77 2027. | `Menu 3` right-side contextual action slot approved as pattern; button styling remains `APPROVED_WITH_CHANGES`. |
| 2026-05-01 | `My Work / Moja praca > Decyzje`, App Table rows and columns; screenshot `Screenshot_2026-05-01_at_12.54.56-64d86859-5314-4367-b8d4-464268f0c2c3.png` | Załączona tabela jest OK jako standard: wielkość wierszy, ilość informacji, widoczne litery, oznaczenia/badge, kolumny, filtry w nagłówkach i możliwość zmiany szerokości kolumn są właściwe. To ma zostać zapisane jako dobry kierunek dla tabel aplikacyjnych. | `App Table` positive reference: row density/readability/header filters/resizable columns approved as standard direction. |
| 2026-05-01 | `My Work / Moja praca > Decyzje`, table settings button and row kebab menu; screenshots `Screenshot_2026-05-01_at_12.56.27-884d7567-b6be-450e-9001-c1bac0182e6c.png`, `Screenshot_2026-05-01_at_12.57.04-141cfb1b-f49a-4227-aa3d-c774e7ec5806.png` | Przycisk ustawień tabeli jest bardzo dobry i powinien być standardem. Pionowy trzykropek/kebab w wierszu też jest dobrym standardem dla akcji wiersza. Problem: menu pod trzema kropkami ma stanowczo za mało treści/akcji i wymaga standardu zawartości. | `Table Settings Button` approved. `Row Kebab` approved as trigger. `Row Action Menu` needs content/anatomy standard. |
| 2026-05-01 | `My Work / Moja praca > Decyzje`, Kanban view; screenshot `Screenshot_2026-05-01_at_12.57.53-635e5977-907e-437c-9a31-9170c69adb9e.png` | Widok Kanban jest bardzo dobry i może być traktowany jako zatwierdzony view mode dla decyzji: kolumny statusów, karty, badge, gęstość i czytelność są OK. | `Kanban View Mode` positive reference for Decisions; approved as alternate view mode. |
| 2026-05-01 | `My Work / Moja praca > Decyzje`, Timeline view; screenshots `Screenshot_2026-05-01_at_13.05.49-5fb316c8-a93f-4222-9950-d03fdd943826.png`, `Screenshot_2026-05-01_at_13.06.53-5d59f465-40e7-4b0f-a7cc-e986a3142e59.png` | Timeline view is broken as a UX pattern. Navigation visually breaks, timeline presentation is not technologically/visually planned, decision title lines are unreadable/truncated without useful information, and the involved components need repair. This is not a small styling issue. | `Timeline View` = `NEEDS_STANDARD` + dedicated migration plan. Requires separate technological presentation plan before approval. |
| 2026-05-01 | `My Work / Moja praca > Inbox`, row action dropdown menu; screenshot `Screenshot_2026-05-01_at_13.07.34-269056fc-f361-4ae6-9b90-70a130062ce3.png` | To jest bardzo dobre menu rozwijane dla akcji wiersza i powinno być użyte jako pozytywny standard. Widać sensowne grupy: open/focus, lifecycle/done, save/note/postpone, reject, postpone presets. Trzeba opracować docelowo, co powinno być w poszczególnych blokach menu dla różnych typów artefaktów. | `Row Action Menu` positive reference. Needs final block/anatomy standard for menu groups and artifact-specific actions. |
| 2026-05-01 | `My Work / Moja praca > Decyzje`, row action dropdown menu; screenshot `Screenshot_2026-05-01_at_13.36.02-c272434d-4671-4a1a-8535-a839a2866743.png` | Decisions row action menu currently contains only `Otwórz`, which is not acceptable. This menu must contain all practical quick actions for the decision artifact, similar in richness to the positive Inbox row action menu reference. | `Decisions Row Action Menu` = migration debt / `NEEDS_STANDARD_APPLICATION`; must implement full contextual quick actions. |
| 2026-05-01 | `My Work / Moja praca > Pomysły`, colored badges/chips in dark and light mode; screenshots `Screenshot_2026-05-01_at_13.12.02-7e57f33c-5296-441a-abb8-b6ad8249033a.png`, `Screenshot_2026-05-01_at_13.12.18-b007cf15-3291-421e-befb-7a1b9e974d9f.png`, `Screenshot_2026-05-01_at_13.20.00-ebcf9730-8f08-4058-8e04-1e8f17653728.png` | Kolorowe oznaczenia są potrzebne, ale obecny standard badge/chips jest nieczytelny. Kolor jest OK jako sygnał, ale tekst i oznaczenia nie są wystarczająco wyraźne, a w light mode problem jest jeszcze gorszy. To wymaga zmiany standardu oznaczeń, nie pojedynczej poprawki. | `Badge` / `Status Chip` = `APPROVED_WITH_CHANGES`; needs new contrast standard for dark/light mode, stronger text, dot/marker/border strategy. |
| 2026-05-01 | `My Work / Moja praca > Pomysły`, open artifact/card tab buttons; screenshot `Screenshot_2026-05-01_at_13.20.49-7fe6212c-9905-4c3a-be0c-d558e5d56efc.png` | Przyciski kart/otwartych artefaktów są generalnie OK. Powinny mieć symbol i kolor artefaktu, a UI kierunkowo jest dobre. Rozmiar przycisku i fontu musi jednak być dopasowany do reszty systemu controls. Jeśli globalnie trochę zmniejszymy menu/buttons, te przyciski też powinny skalować się proporcjonalnie. Nie ma twardego wymogu zmniejszenia na tym etapie. | `Open Artifact Tab/Button` positive direction; size/font pending global control density decision. Must preserve artifact symbol/color identity. |
| 2026-05-01 | `My Work / Moja praca > Decyzje`, preview pane; screenshots `Screenshot_2026-05-01_at_13.25.04-cc9f3d9f-a779-48be-9107-9cf29fac2a05.png`, `Screenshot_2026-05-01_at_13.27.15-34851dc9-767e-4a44-bcaa-f9f4e5f29001.png` | Preview pane is already quite good and should be standardized. Required top anatomy: title, pin, open button, close. Current `Otwórz` control does not look enough like a real button because it has almost no background/affordance. It should use the same approved control/button system as other actions. | `Preview Pane` positive reference but `APPROVED_WITH_CHANGES`; header anatomy standard needed, `Open` button must be a real `Secondary Action`/toolbar-style button. |
| 2026-05-01 | Application-wide preview pane anatomy and action section | Preview pane body order approved for whole application: header, alerts/statuses, details, AI, local linked artifacts, action buttons. Action buttons require precise standard: visible action limit, context-specific action selection, lifecycle first, then information, assignment, reminder/scheduling, escalation/governance, destructive separated or overflow. | `Preview Pane Anatomy` = `APPROVED_WITH_CHANGES`; action section standard added to Golden Standard and must be used for preview migrations. |
| 2026-05-01 | `My Work / Moja praca > Decyzje`, artifact work screen / detail editor; screenshots `Screenshot_2026-05-01_at_13.37.02-bf12ab97-6c68-49d7-bd13-bca41ebbb001.png`, `Screenshot_2026-05-01_at_13.38.42-777e8844-506a-41b7-a3e2-a0a26e84428a.png` | Artifact work screen is one of the two main work standards and must be documented deeply. It has a presentation switch between `N-mode` and `C-mode`. `N-mode` is Notion-inspired with left section navigation. `C-mode` is ClickUp-inspired with more content visible on one page / denser arrangement, but the exact behavior is not yet defined. | `Artifact Work Screen` = strategic standard. `N-mode` is approved direction; `C-mode` = `NEEDS_STANDARD` / requires separate design plan. |
| 2026-05-01 | `Tools > Biblioteka`, Module Topbar/Menu 2 right side; screenshot `Screenshot_2026-05-01_at_13.54.48-aaac85b1-5a15-41a8-90e6-bf0ec475ff1e.png` | Potrzebna jest stała kolejność elementów po prawej stronie `Menu 2`/Module Topbar. Od prawej: najpierw główny CTA ekranu (`Dodaj` albo inna główna akcja zależna od kontekstu), dalej przełącznik widoku, ale nie jako dropdown - mają być ikony widoków jak wcześniej zatwierdzono, dalej w stronę środka przyciski filtrów. `Help` nie jest potrzebny jako standardowy element tego rzędu, bo ma swoje miejsce jako ikona w pasku bocznym / globalnym shellu. | `Module Topbar/Menu 2 right slot` = `APPROVED_WITH_CHANGES`; Golden Standard updated with fixed visual order and no default Help control; Help belongs to sidebar/global shell. |

#### Screenshot references

| Reference | Asset | Notes |
|---|---|---|
| `TOOLS_TOPBAR_2026_05_01_08_31` | `Screenshot_2026-05-01_at_08.31.58-e8a1439f-bb36-45fa-9d6e-414c1f735873.png` | Tools screen; right-side toolbar controls and mixed affordance concerns. |
| `MY_WORK_START_MENU_2026_05_01_10_10` | `Screenshot_2026-05-01_at_10.10.31-38421e5d-2887-4a12-926b-ed640462e84a.png` | My Work / Start screen; main menu controls look good but may be slightly too large. |
| `MY_WORK_IDEAS_VIEW_TOGGLE_2026_05_01_10_12` | `Screenshot_2026-05-01_at_10.12.38-3ee6b1f5-0b2a-457a-aa4e-90abe754cd21.png` | My Work / Ideas screen; view switcher must stay as segmented icon buttons, not dropdown; create CTA needs Plus icon. |
| `MY_WORK_IDEAS_MENU3_2026_05_01_10_14_A` | `Screenshot_2026-05-01_at_10.14.06-8c7c3892-57a7-4ec6-be40-4d5428a567a4.png` | My Work / Ideas; Menu 3 row with status/context chips on subtly different surface. |
| `MY_WORK_IDEAS_MENU3_2026_05_01_10_14_B` | `Screenshot_2026-05-01_at_10.14.59-edbd5e23-b30a-4bb0-b099-464a587138c0.png` | Cropped Menu 3 reference; confirms desired distinct context-row background. |
| `MY_WORK_DECISIONS_MENU3_2026_05_01_10_16` | `Screenshot_2026-05-01_at_10.16.22-9d548da9-614d-46cc-96d5-1a7dd7989ba4.png` | My Work / Decisions; Menu 3 height/surface reference with decision filters and right-side controls. |
| `MY_WORK_TASKS_MENU3_2026_05_01_10_16` | `Screenshot_2026-05-01_at_10.16.30-e713a11d-3d98-4aae-954c-155262940536.png` | My Work / Tasks; Menu 3 plus additional diagnostic row, height inconsistency risk. |
| `MY_WORK_INBOX_MENU3_2026_05_01_10_16` | `Screenshot_2026-05-01_at_10.16.40-6b3f2a02-250d-44b2-99a0-bedcf2357896.png` | My Work / Inbox; Menu 3 status filters on distinct surface. |
| `MY_WORK_NOTES_MENU3_2026_05_01_10_16` | `Screenshot_2026-05-01_at_10.16.49-527158f4-3c5a-489d-b82f-9d6238dbe5d5.png` | My Work / Notes; Menu 3 is minimal/empty-like and exposes need for stable height behavior. |
| `MY_WORK_DECISIONS_PRIORITY_DROPDOWN_2026_05_01_10_18_CLOSED` | `Screenshot_2026-05-01_at_10.18.21-d7c33f8a-aec8-4da5-8607-7537abbd0d0a.png` | Priority dropdown closed state; trigger too wide because it repeats `Priorytet:`. View switcher nearby is good. |
| `MY_WORK_DECISIONS_PRIORITY_DROPDOWN_2026_05_01_10_18_OPEN` | `Screenshot_2026-05-01_at_10.18.36-afa5f814-07dc-4448-8cf9-376c826f8d8f.png` | Priority dropdown open state; menu may show full labels, but compact trigger should show short value. |
| `MY_WORK_INBOX_BULK_MENU3_2026_05_01_12_52` | `Screenshot_2026-05-01_at_12.52.06-8353f0f5-de63-4fa2-aab0-cffdb1211002.png` | Inbox table and Menu 3 status row; reference for selection/bulk mode comparison. |
| `MY_WORK_TASKS_BULK_MENU3_2026_05_01_12_52` | `Screenshot_2026-05-01_at_12.52.45-b046465f-dc79-4ddb-a5c3-001b8ad1eaee.png` | Tasks table with selected rows and bulk actions; bulk action buttons need same Menu 3 control standard. |
| `MY_WORK_DECISIONS_CONTEXT_ACTIONS_2026_05_01_12_53` | `Screenshot_2026-05-01_at_12.53.48-38936aa5-5fa5-4459-89b4-828a75d5dac3.png` | Decisions table with selected rows; right-side contextual actions in Menu 3 are a good pattern, but buttons still need style migration. |
| `MY_WORK_DECISIONS_APP_TABLE_2026_05_01_12_54` | `Screenshot_2026-05-01_at_12.54.56-64d86859-5314-4367-b8d4-464268f0c2c3.png` | Decisions table; positive reference for App Table row density, readable text, badges, header filters, and resizable columns. |
| `MY_WORK_DECISIONS_TABLE_SETTINGS_2026_05_01_12_56` | `Screenshot_2026-05-01_at_12.56.27-884d7567-b6be-450e-9001-c1bac0182e6c.png` | Table settings button; approved as the standard trigger for table configuration. |
| `MY_WORK_DECISIONS_ROW_KEBAB_2026_05_01_12_57` | `Screenshot_2026-05-01_at_12.57.04-141cfb1b-f49a-4227-aa3d-c774e7ec5806.png` | Row kebab trigger is approved, but row menu content is too thin and needs a standard. |
| `MY_WORK_DECISIONS_KANBAN_2026_05_01_12_57` | `Screenshot_2026-05-01_at_12.57.53-635e5977-907e-437c-9a31-9170c69adb9e.png` | Decisions Kanban view; approved as a strong alternate view mode reference. |
| `MY_WORK_DECISIONS_TIMELINE_BROKEN_2026_05_01_13_05` | `Screenshot_2026-05-01_at_13.05.49-5fb316c8-a93f-4222-9950-d03fdd943826.png` | Decisions timeline view; broken navigation/presentation and unreadable decision titles. |
| `MY_WORK_DECISIONS_TIMELINE_NAV_BROKEN_2026_05_01_13_06` | `Screenshot_2026-05-01_at_13.06.53-5d59f465-40e7-4b0f-a7cc-e986a3142e59.png` | Cropped timeline/navigation failure; title lines are not usable and component layout needs redesign. |
| `MY_WORK_INBOX_ROW_ACTION_MENU_2026_05_01_13_07` | `Screenshot_2026-05-01_at_13.07.34-269056fc-f361-4ae6-9b90-70a130062ce3.png` | Inbox row action dropdown; positive reference for richer kebab menu anatomy and grouped row actions. |
| `MY_WORK_DECISIONS_ROW_ACTION_MENU_TOO_THIN_2026_05_01_13_36` | `Screenshot_2026-05-01_at_13.36.02-c272434d-4671-4a1a-8535-a839a2866743.png` | Decisions row action menu has only `Otwórz`; negative reference and migration target. |
| `MY_WORK_IDEAS_BADGES_DARK_2026_05_01_13_12` | `Screenshot_2026-05-01_at_13.12.02-7e57f33c-5296-441a-abb8-b6ad8249033a.png` | Ideas table; colored badges/chips are present but not readable enough in dark mode. |
| `MY_WORK_IDEAS_BADGES_DARK_CROP_2026_05_01_13_12` | `Screenshot_2026-05-01_at_13.12.18-b007cf15-3291-421e-befb-7a1b9e974d9f.png` | Cropped badge/chip reference; contrast and clarity problem visible. |
| `MY_WORK_IDEAS_BADGES_LIGHT_2026_05_01_13_20` | `Screenshot_2026-05-01_at_13.20.00-ebcf9730-8f08-4058-8e04-1e8f17653728.png` | Light mode badge/chip reference; readability is worse and requires new standard. |
| `MY_WORK_IDEAS_OPEN_ARTIFACT_TAB_2026_05_01_13_20` | `Screenshot_2026-05-01_at_13.20.49-7fe6212c-9905-4c3a-be0c-d558e5d56efc.png` | Open artifact/card tab button reference; good direction with artifact symbol/color, sizing to align with final control density. |
| `MY_WORK_DECISIONS_PREVIEW_PANE_2026_05_01_13_25` | `Screenshot_2026-05-01_at_13.25.04-cc9f3d9f-a779-48be-9107-9cf29fac2a05.png` | Decisions preview pane; good overall direction, but header controls need standardization. |
| `MY_WORK_DECISIONS_PREVIEW_HEADER_2026_05_01_13_27` | `Screenshot_2026-05-01_at_13.27.15-34851dc9-767e-4a44-bcaa-f9f4e5f29001.png` | Preview header close-up; title/pin/open/close anatomy is right, but `Otwórz` needs visible button affordance. |
| `MY_WORK_DECISIONS_ARTIFACT_WORKSCREEN_2026_05_01_13_37` | `Screenshot_2026-05-01_at_13.37.02-bf12ab97-6c68-49d7-bd13-bca41ebbb001.png` | Decisions detail/work screen; strategic standard candidate with N-mode/C-mode switch. |
| `MY_WORK_DECISIONS_MODE_SWITCH_2026_05_01_13_38` | `Screenshot_2026-05-01_at_13.38.42-777e8844-506a-41b7-a3e2-a0a26e84428a.png` | Close-up of N-mode/C-mode switch; must become part of artifact work screen standard. |
| `TOOLS_LIBRARY_MENU2_RIGHT_ORDER_2026_05_01_13_54` | `Screenshot_2026-05-01_at_13.54.48-aaac85b1-5a15-41a8-90e6-bf0ec475ff1e.png` | Tools library Module Topbar/Menu 2; reference for right-side order correction: CTA on far right, icon view switcher next, filters toward center, no default Help because Help belongs in sidebar/global shell. |

#### Decyzja robocza

Nie zamykamy jeszcze pełnego finalnego planu Toolbar Control. Zbieramy uwagi użytkownika w jednej liście, a później przepisujemy je w całościowy plan migracji i zatwierdzenia.

Docelowo każdy Toolbar Control w aplikacji musi mieć:

- wskazane miejsce w UI,
- wskazaną grupę/rząd,
- role classification,
- height/radius/surface/border decision,
- open/active/hover state,
- relation to Icon Button, Status Filter Chip i Primary CTA,
- opis zmian wymaganych pod `DBR77 Tech Sexy 2027`.

### 10.2 Bramka dla nowego toolbara

Nowy toolbar może powstać tylko, jeśli:

- nie pasuje do żadnego typu z tabeli,
- nie duplikuje Module Topbar,
- ma unikalną rolę,
- ma opisane miejsce, wysokość, priorytet, zachowanie,
- ma opisane relacje z AI actions,
- ma documentation target.

Bez tego toolbar jest `FORBIDDEN`.

## 11. Krok 2F - wynik approval komponentów

Po zakończeniu kroku 2 muszą istnieć:

1. Tabela komponentów ze statusami.
2. Lista approved core components.
3. Lista approved composed components.
4. Lista approved adapters.
5. Lista migration debt components.
6. Lista brakujących standardów.
7. Lista komponentów do usunięcia/zastąpienia.

## 12. Krok 3 - migracja obecnego stanu do pożądanego

### 12.1 Cel kroku

Przejść z obecnego UI do Golden Standardu bez rozbicia aplikacji.

Nie migrujemy wszystkiego naraz. Migrujemy w falach, z bramkami i zatwierdzeniami.

### 12.2 Stan wejściowy

Stan wejściowy:

- istnieje wiele standardów,
- istnieją shared components,
- istnieją lokalne wzorce,
- istnieje Admin mini-design-system,
- istnieją raw buttons w feature screens,
- istnieją różne sposoby tabel, preview, toolbars,
- część ekranów jest blisko standardu.

Stan docelowy:

- każdy ekran ma target pattern,
- każdy komponent ma status,
- każdy toolbar ma typ,
- każdy moduł ma plan migracji,
- nowe ekrany nie tworzą lokalnego UI,
- dokumentacja działa jako jedyne źródło prawdy.

## 13. Krok 3A - mapowanie modułów

### 13.1 Moduły startowe

| Kolejność | Moduł / obszar | Dlaczego | Pierwsza decyzja |
|---:|---|---|---|
| 1 | My Work / Decisions | Najlepszy kandydat App Table + Preview | Reference hardening |
| 2 | Interview | Duży realny hub, ważny workflow | Tab-by-tab migration |
| 3 | DiscoveryTools / Tools | Workspace, N-mode, tool flow | Control bars standard |
| 4 | Admin / Settings | Control plane, tabele, mutation UX | Adapter vs global components |
| 5 | SuperAdmin | Krytyczne security/API/support | Slice-based migration |
| 6 | AIChat | AI runtime, governance | Separate AI UX audit |
| 7 | Results / Reports / Initiatives / Execution | Kolejne moduły po wzorcach | Migrate after references |

### 13.2 Szablon mapowania modułu

```md
## Module: <name>

Business criticality:
- High / Medium / Low

Current screen types:
- ...

Target screen types:
- ...

Shared components already used:
- ...

Local/custom components:
- ...

Control bars:
- ...

Tables/lists:
- ...

Preview pane decision:
- yes / no / later / not applicable

Risks:
- ...

Migration decision:
- MIGRATION_READY / MIGRATION_BLOCKED / DO_NOT_TOUCH
```

## 14. Krok 3B - ekran referencyjny przed migracją

Nie migrujemy szeroko, dopóki nie zatwierdzimy ekranów referencyjnych.

### 14.1 Reference candidates

| Pattern | Candidate | Status docelowy |
|---|---|---|
| App Table + Preview | `My Work > Decisions` | `APPROVED_REFERENCE` po hardeningu |
| ModuleHub / multi-tab list | `InterviewHub` | `APPROVED_REFERENCE` po migracji pierwszego taba |
| N-mode artifact | `ToolDocumentView` | `APPROVED_REFERENCE` po AI/Menu 3 review |
| Tool flow / workspace | `ToolWorkspace` + `ToolActionBar` | `NEEDS_STANDARD` |
| Admin control plane | pierwszy wybrany Admin table | `APPROVED_REFERENCE` po refactorze |
| SuperAdmin control plane | security/API/support slice | `APPROVED_REFERENCE` po refactorze |

### 14.2 Bramka zatwierdzenia reference

Ekran staje się `APPROVED_REFERENCE`, jeśli:

- przechodzi Golden Definition of Done,
- używa zatwierdzonych komponentów,
- ma opisany target pattern,
- nie ma niezatwierdzonych toolbarów,
- ma loading/empty/error/degraded,
- ma feedback po akcjach,
- ma read-back po mutacjach,
- ma dokumentację, która mówi, co kopiować, a czego nie kopiować.

## 15. Krok 3C - fale migracji

### Wave 0 - Documentation and rules lock

Status: częściowo wykonane.

Zakres:

- Golden Standard.
- Operating Standard.
- Migration Audit.
- Migration Plan.
- Reference Screens.
- Component Approval and Migration Master Plan.
- `.cursorrules`.

Exit:

- wszystkie dokumenty są w README,
- Cursor wie, co czytać,
- brak Iris/Consultify pomieszania,
- repo ma jeden kierunek UI.

### Wave 1 - Component approval inventory

Cel:

- przejść komponenty i nadać statusy.

Zakres:

1. `src/components/ui/primitives`
2. `src/components/ui/composed`
3. `src/components/ui/ResizableTable`
4. `src/components/shared/ModuleHub`
5. `src/components/shared/NModeLayout`
6. `src/components/shared/PreviewPane`
7. `src/components/shared/ToolWizard`
8. `src/components/Admin/shared`

Output:

- `APPROVED_CORE`
- `APPROVED_COMPOSED`
- `APPROVED_ADAPTER`
- `MIGRATION_DEBT`
- `DEPRECATED`
- `NEEDS_STANDARD`

### Wave 2 - Reference hardening

Cel:

- zatwierdzić 2-4 ekrany referencyjne.

Kolejność:

1. My Work / Decisions.
2. InterviewHub pierwszy tab.
3. ToolDocumentView.
4. ToolWorkspace control bar.
5. Admin table.

Output:

- reference checklist,
- dokumentacja wzorca,
- lista braków komponentów.

### Wave 3 - Interview migration

Cel:

- pierwszy duży moduł przejść zgodnie z planem.

Zakres tabów:

| Tab / Surface | Target | Preview | Uwagi |
|---|---|---|---|
| Inbox | App Table | likely yes | action queue style |
| Sessions | App Table / Grid optional | yes/later | session preview |
| Assigned | App Table | yes | assignment quick actions |
| Templates | App Table or grid | maybe | choose based on workflow |
| Insights | App Table + preview | yes | report/insight preview |

Exit:

- każdy tab ma target,
- brak ad-hoc toolbars,
- preview decisions opisane,
- App Table rules spełnione gdzie dotyczy.

### Wave 4 - Tools / DiscoveryTools migration

Cel:

- uporządkować tool flows i N-mode.

Zakres:

- ToolDocumentView,
- ToolWorkspace,
- ToolActionBar,
- ToolWizardView,
- tool phase components,
- AI phase actions,
- proposal cards.

Kluczowa decyzja:

- czy `ToolActionBar` staje się approved `View-local Toolbar` / `Tool Flow Control Bar`, czy migration debt.

Exit:

- standard control barów dla tools,
- AI actions w zatwierdzonych slotach,
- N-mode zgodne,
- tool phase buttons sklasyfikowane.

### Wave 5 - Admin migration

Cel:

- ustalić, czy Admin shared jest adapterem, czy długiem migracyjnym.

Zakres:

- `src/components/Admin/shared/Button.tsx`
- `src/components/Admin/shared/Card.tsx`
- `src/components/Admin/shared/AdminTable.tsx`
- `src/components/Admin/shared/EnhancedDataTable.tsx`
- pierwsze Admin views.

Decyzje:

| Decyzja | Opcja A | Opcja B |
|---|---|---|
| Admin Button | approved adapter | migrate to global Button |
| Admin Card | approved adapter | migrate to global Card |
| Admin Table | approved adapter | migrate to App Table/ResizableTable |
| Admin PageHeader | approved control plane pattern | replace with ModuleHub |

Exit:

- Admin ma jeden kierunek,
- pierwszy Admin table jest reference,
- destructive actions mają confirm,
- degraded/error states są uczciwe.

### Wave 6 - SuperAdmin migration

Cel:

- migrować control plane w bezpiecznych slices.

Kolejność slices:

1. Security / IAM.
2. API / System.
3. Support.
4. Customers.
5. Revenue.
6. AI Platform.

Exit per slice:

- App Table/control plane standard,
- no raw internals,
- no fake success,
- read-back for mutations,
- in-app confirm,
- audit evidence where applicable.

### Wave 7 - AIChat and AI UX

Cel:

- osobny audyt AI UX, bez przypadkowego refactoru runtime.

Zakres:

- UnifiedChatPanel,
- context passing,
- provider failure,
- no silent execution,
- private mode,
- trust/citations,
- proposal/approval/audit.

Exit:

- osobny AI UX contract,
- chat nie jest migrowany jak zwykły ekran,
- AI actions w modułach mają spójny standard.

### Wave 8 - Remaining modules

Po zatwierdzeniu wzorców przechodzimy:

- Results,
- Reports,
- Initiatives,
- Execution,
- Benefits,
- Settings submodules,
- pozostałe legacy surfaces.

Każdy moduł dostaje mini-plan.

## 16. Krok 3D - szablon mini-planu dla modułu

```md
# UI Migration Mini Plan: <module>

Status:
Owner:
Date:

## Scope
- screens:
- excluded:

## Current state
- layout:
- components:
- tables:
- preview:
- toolbars:
- known UX issues:

## Target state
- shell:
- table/list pattern:
- detail pattern:
- preview decision:
- toolbar decision:
- components:

## Component decisions
| Component | Current | Target | Decision |
|---|---|---|---|

## Migration steps
1.
2.
3.

## Out of scope
- API
- routing
- data model
- business logic

## Verification
- lint:
- tests:
- manual UI:
- read-back:
- empty/error/degraded:

## Documentation updates
- ...
```

## 17. Krok 3E - template zatwierdzenia ekranu

```md
# Screen Approval: <screen>

Screen:
Module:
Date:
Reviewer:

## Target pattern
- ModuleHub / App Table / N-mode / ToolWizard / Workspace / Canvas / Admin control plane / Other

## Components used
- ...

## Exceptions
- ...

## Checklist
| Check | Pass | Notes |
|---|---|---|
| Uses approved shell | | |
| Uses approved components | | |
| No unapproved one-off UI | | |
| Control bars classified | | |
| Loading state | | |
| Empty state | | |
| Error/degraded state | | |
| Action feedback | | |
| Read-back after mutation | | |
| Destructive confirm | | |
| AI governance if applicable | | |
| Light/dark readability | | |
| Docs updated | | |

Decision:
- APPROVED / APPROVED_WITH_CHANGES / REJECTED / DEFERRED
```

## 18. Krok 3F - zasady commitów migracyjnych

Migracyjne commity powinny być małe i nazwane po obszarze:

- `docs(ui): approve component migration standard`
- `refactor(interview): align assigned tab with app table`
- `refactor(tools): standardize tool action bar`
- `refactor(admin): migrate users table to app table`

Zakaz:

- jeden commit "fix UI" dla wielu modułów,
- mieszanie dokumentacji, refactoru i backendu bez potrzeby,
- masowe mechaniczne zmiany bez review.

## 19. Kolejność pracy po tym dokumencie

### Sprint A - approval foundation

1. Przejść komponent inventory.
2. Nadać statusy core/composed/adapter/debt.
3. Sprawdzić komponenty względem `DBR77 Tech Sexy 2027`: shape, elevation, density, tables, glass, AI surfaces.
4. Uzupełnić brakujące standardy dla control bars.
5. Zatwierdzić reference candidates.

### Sprint B - first migration slice

1. My Work / Decisions hardening.
2. InterviewHub tab-by-tab audit.
3. Pierwszy Interview tab refactor.
4. Dokumentacja findings.

### Sprint C - tools and admin

1. ToolActionBar standard.
2. ToolDocumentView N-mode review.
3. Admin shared decision.
4. Pierwszy Admin table refactor.

### Sprint D - control plane and AI UX

1. SuperAdmin first security/API slice.
2. Support table/preview slice.
3. AIChat UX audit.
4. AI actions consistency review.

## 20. Ostateczne kryterium sukcesu

Migracja jest skuteczna, gdy:

- każdy nowy ekran powstaje z zatwierdzonych komponentów,
- Cursor przestaje tworzyć własne standardy,
- każdy moduł ma target pattern,
- każdy komponent ma status,
- każdy toolbar ma klasę,
- stare custom UI jest wpisane jako migration debt albo usunięte,
- dokumentacja pozwala odtworzyć decyzję bez historii czatu.

## 21. Jednozdaniowy kontrakt pracy

> Najpierw zatwierdzamy komponent lub wzorzec, potem migrujemy ekran, a po migracji aktualizujemy dokumentację tak, żeby następny ekran nie wymagał ponownego wymyślania zasad.
