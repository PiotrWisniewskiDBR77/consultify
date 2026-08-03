# Consultify UI/UX Operating Standard

> ⚠️ **AUTORYTET PRZENIESIONY → [CANON.md](CANON.md)** (od 2026-06-14, v3.0).
> Governance i hierarchia prawdy z tego dokumentu zostały wcielone do `CANON.md` (§3 Governance, §4 Zachowania nienaruszalne). Pozostaje jako referencja szczegółowa do końca Fazy 2.

Status: `referencja podległa CANON.md (był: v1 - approved migration baseline)`
Date: 2026-05-01
Owner decyzyjny: Product / CTO / Delivery Owner
Repo: `DRD/consultify`
Remote: `https://github.com/PiotrWisniewskiDBR77/consultify.git`

## 1. Po co jest ten dokument

Ten dokument jest materiałem migracyjnym dotyczącym historycznego sposobu stabilizacji UI/UX Consultify.

Nadrzędnym źródłem prawdy jest `docs/ui-standards/CANON.md`. Aktualne zasady implementacyjne prowadzi `UI_UX_IMPLEMENTATION_STANDARD.md`; ten dokument nie ustanawia już osobnej hierarchii.

Istniejące dokumenty w `docs/ui-standards/` są wartościowe, ale rozproszone. Ten plik nie zastępuje ich szczegółów. Konsoliduje je w jeden praktyczny kontrakt dla:

- pracy z Cursor,
- audytu istniejących ekranów,
- refactoru ekran po ekranie,
- review UI/UX,
- tworzenia nowych ekranów i modułów.

Najważniejsza zasada:

> Feature screens do not own visual design. Feature screens compose approved Consultify layout and UI components.

Po polsku:

> Ekrany funkcjonalne nie wymyślają wyglądu. Składają zatwierdzone klocki Consultify.

## 2. Aktualny status UI/UX

### 2.1 Status ogólny

Status: `STANDARD_EXISTS_IMPLEMENTATION_FRAGMENTED`

Consultify ma już mocny fundament standardu UI/UX:

- `docs/ui-standards/CONSULTIFY_UI_UX_GOLDEN_STANDARD.md` definiuje najwyższy kanon UI/UX DBR77 Tech Sexy 2027.
- `docs/ui-standards/UI_UX_CANON_V3.md` definiuje historyczny/syntetyczny kanon v3 i pozostaje podporządkowany Golden Standard.
- `docs/ui-standards/00-foundation/visual-language.md` definiuje język wizualny DBR77 / Tech Sexy.
- `docs/ui-standards/03-modules/module-hub-standard.md` definiuje topbary, Menu 3 / Command Row i strukturę modułów.
- `docs/ui-standards/03-modules/app-table-standard.md` definiuje standard tabel.
- `docs/ui-standards/03-modules/table-preview-pane-standard.md` definiuje standard tabela + preview pane.
- `src/components/ui` zawiera primitives i composed components.
- `src/components/shared` zawiera layouty i shelle robocze, m.in. `NModeLayout`, `ModuleHub`, `PreviewPane`, `ToolWizard`.

Problem nie polega na braku standardów. Problem polega na tym, że standardy nie są jeszcze wystarczająco egzekwowane przy tworzeniu i refaktorze ekranów.

### 2.2 Diagnoza systemowa

Obecny problem:

- część ekranów używa kanonicznych komponentów,
- część ekranów ma lokalne układy, lokalne toolbary, lokalne przyciski i lokalne style,
- standardy są opisane, ale agent lub developer może ich nie przeczytać przed pracą,
- istnieją stare wzorce, snapshoty i duplikaty dokumentów,
- nowe ekrany mogą przypadkowo tworzyć kolejny wariant layoutu.

To powoduje wrażenie, że każdy ekran jest osobną aplikacją.

### 2.3 Docelowy status

Status docelowy: `UI_UX_CANON_ENFORCED`

Oznacza to:

- każdy nowy ekran używa standardowego shell/layoutu,
- każdy ekran tabelaryczny spełnia App Table Standard,
- każdy detail/workspace spełnia N-mode lub workspace shell,
- nie ma lokalnych przycisków, kart, badge, tabel i toolbars, jeśli istnieje komponent wspólny,
- Cursor zawsze pracuje według reguły `.cursor/rules/consultify-ui-ux-canon.mdc`,
- odstępstwa są świadome, opisane i zatwierdzone.

### 2.4 Decyzje zatwierdzone 2026-05-01

Te decyzje są obowiązujące od tej wersji standardu:

1. `docs/ui-standards/CONSULTIFY_UI_UX_GOLDEN_STANDARD.md` zostaje najwyższym kanonem UI/UX; `UI_UX_CANON_V3.md` pozostaje dokumentem historyczno-konsolidacyjnym.
2. Ten dokument jest operacyjną bramą dla Cursor, audytu i refactorów.
3. Nowe feature screens mają twardy zakaz tworzenia lokalnych przycisków, kart, tabel, badge/chips, toolbarów i shelli, jeśli istnieje komponent lub wzorzec wspólny.
4. Cursor ma zawsze proponować rozwiązanie z listy zatwierdzonych komponentów i shelli. Jeśli nic nie pasuje, nie improwizuje - proponuje nowy standard lub rozszerzenie standardu.
5. Nowy komponent lub nowy wzorzec staje się dopuszczalny dopiero po opisaniu go w `docs/ui-standards/` i wskazaniu miejsca w hierarchii importów.
6. Stare/custom UI jest traktowane jako `migration debt`, nie jako natychmiastowy blocker, chyba że łamie bezpieczeństwo, governance, dostępność głównej akcji, read-back, honest UI lub tenant isolation.
7. Migracja ekranów odbywa się według planu, moduł po module, z audytem i zatwierdzeniem zakresu. Nie robimy szerokich refactorów bez planu lokalnego.
8. App Table Standard jest obowiązkowy dla hubów/list, w których pasuje do modelu pracy. Nic na siłę: cards/grid/board mogą pozostać, jeśli są świadomym view mode i mają opisany standard.
9. Preview pane jest preferowanym standardem dla ważnych list, gdzie szybki podgląd i quick actions mają sens użytkowy.
10. Dodatkowe toolbary są dopuszczalne tylko wtedy, gdy zostaną nazwane, sklasyfikowane i opisane jako standard. Ad-hoc toolbary są niedozwolone.
11. Jeden kolorowy CTA pozostaje domyślnym standardem. Wyjątki muszą być opisane i uzasadnione w standardzie.
12. `rounded-hig-*` jest kierunkiem dla nowego kodu i modernizacji. Istniejące komponenty migrujemy etapowo, bez masowego mechanicznego przepisywania bez testu wizualnego.

## 3. Hierarchia źródeł prawdy

Jeśli dokumenty są sprzeczne, obowiązuje kolejność:

1. `docs/ui-standards/CONSULTIFY_UI_UX_GOLDEN_STANDARD.md` - nadrzędny kanon produktowo-wizualny.
2. `docs/ui-standards/CONSULTIFY_UI_UX_OPERATING_STANDARD.md` - ten dokument, operacyjny kontrakt pracy.
3. `docs/ui-standards/FROZEN_LAYOUTS.md` - układy zamrożone, których nie wolno rozjechać.
4. `docs/ui-standards/UI_UX_CANON_V3.md` - historyczny/syntetyczny kanon decyzji UI/UX v3.
5. Szczegółowe standardy z `docs/ui-standards/00-foundation`, `01-shell-layout`, `02-components`, `03-modules`.
6. Implementacje referencyjne wskazane w dokumentach.
7. Stare dokumenty, duplikaty ` 2.md`, ` 3.md` i lokalne snapshoty - tylko jako kontekst historyczny, nie jako standard.

Zasada rozstrzygania:

> Jeśli standard mówi X, a komponent lub ekran robi Y, to ekran/komponent jest kandydatem do refactoru. Nie tworzymy trzeciego wariantu.

## 4. Kanoniczne fundamenty wizualne

### 4.1 Język wizualny

Obowiązuje DBR77 / Tech Sexy:

- enterprise clean,
- monochromatyczny chrome,
- kolor jako sygnał, nie dekoracja,
- jedna aplikacja, jeden język wizualny,
- invisible borders,
- depth przez warstwy tła,
- typografia jako architektura,
- max jeden kolorowy CTA na ekranie,
- dark mode jako first-class,
- light mode z czytelnością ponad estetyką.

Źródła:

- `docs/ui-standards/00-foundation/visual-language.md`
- `docs/ui-standards/00-foundation/light-mode-readability.md`
- `docs/ui-standards/00-foundation/color-system.md`

### 4.2 Warstwy tła

Minimalny model:

- Layer 0: global chrome / sidebar.
- Layer 1: główna powierzchnia robocza.
- Layer 2: karty, panele, sekcje.
- Layer 3: floating UI: modal, drawer, dropdown, tooltip.

Zakazy:

- brak `#000000` jako tła,
- brak `#ffffff` jako tekstu w dark mode,
- brak ciężkich borderów na kartach,
- brak shadow na kartach contentowych jako default,
- brak kolorowych ikon w chrome/nav, jeśli kolor nie niesie informacji.

### 4.3 Rounding i tokeny

Nowy kod powinien preferować tokeny HIG:

- `rounded-hig-*`,
- `rounded-hig-full` dla pills/chips.

Nie wprowadzamy nowych ręcznych wariantów `rounded-lg/xl/2xl` w świeżym kodzie, jeśli da się użyć tokenu.

### 4.4 Typografia

Standard:

- nagłówki: `font-semibold`, nie `font-bold`,
- brak ALL CAPS w dużych nagłówkach,
- ALL CAPS tylko w małych labelach,
- body UI: zwykle `text-sm`,
- metadane: `text-xs`,
- dashboardy nie mogą łączyć dużego oddechu z mikro typografią.

## 5. Kanoniczna architektura ekranu

### 5.1 App Topbar vs Module Topbar

W aplikacji są dwa poziomy topbarów:

1. App Topbar - globalny, stały.
2. Module Topbar - kontekstowy dla modułu.

Nie wolno ich mieszać.

App Topbar:

- breadcrumbs po lewej,
- po prawej stała kolejność: `Data -> Model -> Inbox -> Tasks(Today) -> User`,
- brak globalnego AI toggle.

Module Topbar:

- lewa strona: search toggle + główne taby,
- prawa strona: `Filters -> View -> Tool -> Add -> Area` w DOM, wizualnie od prawej `Area -> Add -> Tool -> View -> Filters`,
- AI w kontekście jest w Module Topbar/Menu 3 zgodnie z typem akcji, nie jako osobny globalny przycisk,
- `Help` nie jest standardowym elementem prawego klastra Module Topbar/Menu 2; Help należy do globalnego shellu/sidebaru,
- `Primary CTA` w Module Topbar/Menu 2 ma label typu `Dodaj` / `New ...`, ale bez ikony `+`; chevron jest dopuszczalny, jeśli CTA otwiera menu wariantów,
- view toggle używa stałej kolejności ikon: `Lista` po lewej, `Karty/Grid` po prawej,
- view toggle jest segmented icon control, nie dropdown/select typu `Table` z menu `Grid`,
- filtry w prawym klastrze mają konkretne, domenowe opisy; nie używamy kilku generycznych triggerów typu `Wszystkie ...` bez wyraźnego rozróżnienia.

Źródła:

- `docs/ui-standards/01-shell-layout/app-topbar-standard-v3.md`
- `docs/ui-standards/03-modules/module-hub-standard.md`

### 5.2 Menu 3 / Command Row

Pod Module Topbar istnieje dokładnie jeden Command Row.

Może pełnić jedną z ról:

- bulk actions,
- search row,
- dynamic tabs,
- context counters.

Priorytet:

1. Bulk actions.
2. Search.
3. Dynamic tabs.
4. Context counters.

Zakazy:

- brak 2-3 dodatkowych pasków między topbarem a tabelą,
- brak lokalnych help stripów pod topbarem,
- brak osobnych pasków AI pod metadanymi, pod properties strip albo w canvasie,
- brak dodatkowego wiersza selection/AI między Menu 3 a tabelą,
- brak duplikowania tej samej akcji AI w Menu 3 i w canvasie.

Counter/status chips:

- Menu 3 pokazuje `ALL` oraz aktywne/używane statusy/presety.
- Statusy z liczbą `0` nie powinny zajmować stałego miejsca, jeśli wypychają prawy slot akcji.
- Długi zestaw statusów trafia do overflow/filtra, a nie do drugiego wiersza.

### 5.3 AI actions

Kontekstowe akcje AI dla aktywnego dokumentu, narzędzia lub sekcji muszą być po prawej stronie Menu 3.

Akcje AI zależne od zaznaczenia, np. `AI Analizuj zaznaczenie`, też należą do prawego slotu Menu 3. Przy `0` zaznaczonych są disabled albo pokazują neutralny stan, ale nie tworzą osobnego paska nad tabelą.

W `N-mode` dotyczy to szczególnie funkcjonalnych akcji AI, które tworzą albo znacząco modyfikują strukturę pracy:

- `Napisz kartę`,
- `Wygeneruj kartę`,
- `Napisz cały artefakt`,
- `Wygeneruj scope`,
- `Wygeneruj ryzyka`,
- `Zaproponuj RACI`,
- `Uzupełnij brakujące sekcje`.

Te akcje nie są inline field assist. Są context actions i dlatego należą do prawego slotu `Menu 3`, wizualnie pod głównym CTA ekranu z `Menu 2` / Module Topbar.

Jeśli moduł ma `DynamicTabs`, używać prawego slotu:

- `commandRowRightContent`,
- `DynamicTabs.rightContent`,
- lokalny odpowiednik tego samego rzędu.

Jeśli widok ma lokalne Menu 3, AI actions pozostają po prawej stronie tego lokalnego Menu 3.

## 6. Kanoniczne typy ekranów

### 6.1 Module Hub

Używany dla ekranów modułowych i kolekcji.

Standard:

- `ModuleHub`,
- `ModuleNavBar`,
- `DynamicTabs`,
- jeden Command Row,
- table/kanban/timeline/calendar/matrix/grid według stałej kolejności view modes.

Przykłady obszarów:

- My Work,
- Interviews,
- Discovery Tools,
- Admin,
- Results,
- Tools.

### 6.2 App Table

Każdy hub tabelaryczny musi spełniać App Table Standard.

MUST:

- brak drugiego breadcrumb/tytułu w obszarze roboczym,
- prawie pełna szerokość contentu,
- kontrolki topbara w `h-9`,
- search toggle -> expandable search,
- resizable columns,
- header filters,
- ostatnia kolumna `Actions` z pionowym kebab `⋮`,
- guardy na pola z API,
- placeholder `—` zamiast crasha,
- brak duplikowania danych jako drugiej linii pod tytułem,
- brak ad-hoc pasków między topbarem a tabelą.

Źródło:

- `docs/ui-standards/03-modules/app-table-standard.md`

### 6.3 Table + Preview Pane

Dla dużych list z szybkim przeglądem używamy Outlook style:

- preview domyślnie zamknięty,
- single click otwiera preview,
- double click / Enter otwiera full detail,
- preview ma header, body, sticky footer,
- quick actions w preview mają parity z full view,
- preview używa `PreviewPaneShell`,
- preview jest częścią surface'u tabeli, nie osobnym widgetem.

Źródło:

- `docs/ui-standards/03-modules/table-preview-pane-standard.md`

### 6.4 N-mode detail / artifact view

Detail views i artefakty używają `NModeLayout`.

Kanoniczne elementy:

- `NModeShell`,
- `NModeHeader`,
- `NModePropertiesStrip`,
- `NModeLeftNav`,
- `NModeCanvas`,
- `NModeSectionWrapper`.

Ważne reguły:

- pełny SSOT kart N-mode: `docs/ui-standards/01-shell-layout/n-mode-card-standard.md`,
- `C-mode` jest planowanym minimalistycznym widokiem inspirowanym ClickUp; do czasu wdrożenia i zatwierdzenia wybór `C` pokazuje `C-mode wkrótce`, a aktywnym trybem pozostaje `N`,
- lewy rail N-type: ok. `242px`,
- tytuły w lewym railu nie powinny się zawijać,
- lewy rail zawiera nazwy zakładek/sekcji i nie jest paskiem akcji,
- centralny canvas jest głównym ekranem roboczym artefaktu/narzędzia i używa całej pozostałej szerokości,
- properties/status strip jest połączony z workflow, a nie tylko pokazuje metadane,
- status, priorytet, termin, owner/assignee/decider wpływają na dostępne akcje, walidacje, AI context i audit,
- workflow/lifecycle action row w N-mode powinien być jednoliniowy na desktopie; akcje drugorzędne trafiają do `More` / overflow,
- przyciski workflow używają stylu DBR77 Tech Sexy 2027, nie prostokątnych legacy controls,
- górny obszar `N-mode` musi oszczędzać pionową przestrzeń: header/properties/workflow mają być compact, bez utraty czytelności i bez ciężkich stacked cards,
- pierwsza karta robocza powinna być widoczna możliwie wysoko w standardowym desktop viewport,
- jeśli istnieje karta `Related Context` / `Powiązany kontekst`, nie dublujemy pełnych powiązań ani `AI-detected links` w stopkach innych kart,
- każde narzędzie/artefakt ma katalog potencjalnych kart N-mode,
- domyślne karty są podpowiadane per narzędzie, ale widoczność może być konfigurowana przez ustawienia widoku,
- ustawienia widoku kart działają jak wybór kolumn w tabeli: checkmark/checkbox pokazuje, które karty są widoczne,
- każda karta musi mieć opis zawartości i dopuszczalnej roli AI,
- Save state i Lifecycle state są oddzielne,
- akcje lifecycle/governance są w Menu 3 lub właściwym slocie akcji, nie w canvasie.

### 6.5 Tool Wizard / Workspace

Procesy krokowe i narzędzia nie tworzą własnego shellu.

Używać:

- `ToolWizardShell`,
- `ToolWizardHeader`,
- `ToolWizardStepNav`,
- workspace tools / 3-tools strip tam, gdzie dotyczy.

Workspace 3-tools strip:

1. Tools.
2. Context / Links.
3. AI Suggestions.

Źródło:

- `docs/ui-standards/02-components/workspace-3-tools-strip.md`

## 7. Kanoniczne komponenty

Nowy kod i refactor mają preferować import z:

- `@/components/ui`,
- `@/components/ui/primitives`,
- `@/components/ui/composed`,
- `@/components/shared/NModeLayout`,
- `@/components/shared/ModuleHub`,
- `@/components/ui/ResizableTable`,
- `@/components/shared/PreviewPane`,
- `@/components/shared/ToolWizard`.

### 7.1 Primitives

Używać:

- `Button`,
- `Card`, `CardHeader`, `CardContent`, `CardFooter`,
- `Input`,
- `Modal`, `ConfirmModal`,
- `Badge`, `NotificationBadge`,
- `Tabs`,
- `Dropdown`, `Select`,
- `Drawer`,
- `Toast`,
- `Skeleton`, `Spinner`, `Progress`.

Zakaz:

- raw `<button>` w feature screens, jeśli to zwykła akcja UI,
- lokalne warianty buttonów,
- lokalne karty z własnym stylem,
- lokalne badge/chips bez powodu,
- lokalne modal/drawer style poza komponentem wspólnym.

Dozwolone wyjątki:

- niskopoziomowy primitive,
- specjalny canvas/editor z własną interakcją,
- dostępnościowy wrapper, którego nie obsługuje primitive,
- przypadek zatwierdzony w standardzie.

### 7.1a Procedura nowego komponentu lub wzorca

Jeśli zatwierdzone komponenty nie pasują:

1. Nie buduj lokalnego UI w feature screen jako finalnego rozwiązania.
2. Opisz problem: czego brakuje, w jakich ekranach, jaki workflow tego wymaga.
3. Zaproponuj, czy potrzebne jest:
   - rozszerzenie istniejącego komponentu,
   - nowy primitive,
   - nowy composed component,
   - nowy shell/layout,
   - jednorazowy wyjątek migracyjny.
4. Dopisz standard do właściwego pliku w `docs/ui-standards/` albo utwórz nowy plik standardu, jeśli obszar nie istnieje.
5. Dopiero po decyzji użyj komponentu w ekranie.

Nowy komponent bez dokumentacji jest `unapproved UI`.

### 7.2 Composed components

Używać:

- `DataTable`,
- `EmptyState`,
- `MetricCard`,
- `SearchInput`,
- `CommandPalette`.

Jeśli ekran potrzebuje tabeli, pustego stanu, metryki lub searcha, najpierw sprawdzić te komponenty.

### 7.3 Toasty i feedback

Używać kanonicznego `toast` / `ToastProvider`.

Każda akcja mutująca musi mieć:

- loading / pending,
- success albo error,
- read-back / visible state update,
- brak fake success.

Błąd bez toasta jest akceptowalny tylko wtedy, gdy istnieje czytelny inline error state.

## 8. Zachowania UX, których nie wolno łamać

### 8.1 Honest UI

UI nie może kłamać.

Zakazane:

- fake success,
- silent fail,
- infinite spinner bez recovery,
- raw backend error jako jedyny komunikat,
- `[object Object]`,
- `NaN`, `Infinity`, `Invalid Date`,
- stack trace w UI użytkownika,
- `Something went wrong` bez kontekstu, gdy można podać lepszy stan.

### 8.2 Save state vs lifecycle state

Nie wolno mieszać:

- `Saved / Saving / Save failed` - stan trwałości danych,
- `Draft / In Review / Approved / Generated / Failed` - lifecycle/governance.

`Draft` nie oznacza niezapisanych zmian. `Saved` nie oznacza zatwierdzenia.

### 8.3 Destructive actions

Destructive actions wymagają:

- wariantu danger,
- confirm modal,
- jasnej nazwy skutku,
- braku side effect bez potwierdzenia,
- toast/error state po wyniku.

### 8.4 Governance / AI actions

Dla istotnych działań AI i mutacji obowiązuje:

`proposal -> approval -> execution -> audit`

Zakazane:

- silent execution,
- hidden learning,
- automatyczna trwała zmiana danych bez decyzji użytkownika,
- brak audytu po wykonanej mutacji.

### 8.5 Control bars i toolbary

Consultify dopuszcza tylko nazwane typy control barów:

1. `App Topbar` - globalny header aplikacji.
2. `Module Topbar` - kontekstowy topbar modułu.
3. `Menu 3 / Command Row` - jeden rząd pod Module Topbar.
4. `View-local Toolbar` - toolbar wewnątrz konkretnego widoku, np. timeline/canvas/heatmap, tylko dla kontrolek właściwych temu widokowi.
5. `Workspace 3-tools Strip` - Tools / Context / AI Suggestions.
6. `Bulk Action Bar` - aktywny tylko przy multi-select.
7. `Preview Footer Actions` - quick actions w preview pane.

Zasady:

- Każdy dodatkowy toolbar musi należeć do jednej z tych klas albo wymaga nowego standardu.
- Toolbary nie mogą dublować kontrolek z Module Topbar.
- Toolbary nie mogą tworzyć drugiego/trzeciego rzędu między Module Topbar a tabelą.
- AI actions domyślnie należą do prawej strony Menu 3, nie do osobnego paska.
- Kontrolki konkretnego widoku, np. zoom timeline, zakres czasu, lane focus, mogą żyć w `View-local Toolbar`, ale tylko wewnątrz powierzchni tego widoku.
- `View-local Toolbar` nie przejmuje akcji AI; dodatkowe AI actions dla timeline/canvas/heatmap nadal trafiają do prawej strony `Menu 3`.
- Timeline header musi być kompaktowy: miesiąc i tydzień nie mogą tworzyć nadmiernie wysokiego nagłówka, preferowany zapis tygodnia to np. `W18 (27)` / `W18 / 27`.

## 9. Refactor istniejących ekranów

### 9.1 Zasada główna

Nie refaktorować całej aplikacji naraz.

Refactor UI/UX odbywa się ekran po ekranie albo moduł po module.

### 9.2 Zakres dozwolony w refactorze UI

Dozwolone:

- wymiana lokalnych przycisków na `Button`,
- wymiana lokalnych kart na `Card`,
- wymiana lokalnych tabel na `DataTable` / `ResizableTable` / wzorzec App Table,
- przeniesienie kontrolek do Module Topbar / Command Row,
- zastąpienie lokalnego preview przez `PreviewPaneShell`,
- ujednolicenie empty/loading/error states,
- usunięcie dodatkowych toolbars,
- dopasowanie do warstw tła, spacingu i tokenów.

Niedozwolone bez osobnej zgody:

- zmiana API,
- zmiana routingu,
- zmiana modelu danych,
- zmiana permission modelu,
- zmiana logiki biznesowej,
- zmiana workflow użytkownika,
- przepisywanie komponentu na nowy design nieopisany w standardzie.

### 9.3 Prompt referencyjny do refactoru

```text
Refactor only [SCREEN/MODULE] to comply with Consultify UI/UX Operating Standard.

Use:
- docs/ui-standards/CONSULTIFY_UI_UX_GOLDEN_STANDARD.md
- docs/ui-standards/CONSULTIFY_UI_UX_OPERATING_STANDARD.md
- docs/ui-standards/UI_UX_CANON_V3.md
- docs/ui-standards/03-modules/module-hub-standard.md
- docs/ui-standards/03-modules/app-table-standard.md
- docs/ui-standards/03-modules/table-preview-pane-standard.md

Scope:
- Do not change business logic.
- Do not change API calls.
- Do not change routing.
- Do not change data models.
- Replace local/custom UI with shared Consultify components.
- Preserve the user workflow unless explicitly requested.

Definition of done:
- Uses canonical layout/shell.
- Uses approved primitives/composed components.
- Has loading, empty, error and degraded states.
- Has honest feedback for actions.
- No one-off toolbar, card, button, table or badge remains unless justified.
```

### 9.4 Obowiązkowy plan migracji kolorów tabel (DBR77 2027)

Każda migracja tabeli przechodzi ten sam plan. Pominięcie kroku oznacza, że migracja nie jest zamknięta.

1. Inwentaryzacja:
   - Spisać wszystkie kolumny i typy informacji w tabeli (`status`, `priority`, `due`, `meta`, `tool`, `owner`, `risk`).
   - Wykryć wszystkie użyte mapy kolorów i lokalne klasy chipów.
2. Mapowanie semantyczne:
   - Przypisać każdą wartość statusu do mapy z `CONSULTIFY_UI_UX_GOLDEN_STANDARD.md` (`slate/blue/amber/emerald/rose` + `primary` tylko dla selection/focus/CTA).
   - Ustalić jeden kontrakt dla `MetaChip`, `StatusChip`, `PriorityChip`, `ToolChip`, `DueChip`.
3. Implementacja:
   - Usunąć lokalne, równoległe mapy kolorów dla tej samej semantyki.
   - Ujednolicić kolory między table/list/card/preview tego samego modułu.
   - Potwierdzić, że chrome (toolbar/topbar/modal shell) pozostaje monochromatyczny.
4. Weryfikacja:
   - Sprawdzić light mode i dark mode pod kątem kontrastu i czytelności.
   - Potwierdzić, że `primary/violet` nie jest używany jako dekoracyjny kolor metadata.
   - Potwierdzić, że selected/focused/checked row używa wyłącznie brandowego stanu row (`primary` + lewy akcent).
5. Dowód audytowy:
   - W opisie migracji wpisać finalną mapę statusów i wyjątki.
   - Jeśli wyjątek jest potrzebny, najpierw dopisać go do standardu, dopiero potem do kodu.

## 10. Audyt istniejących ekranów

Każdy ekran powinien zostać wpisany do audytu w formacie:

| Module / Screen | Current pattern | Target pattern | Main gaps | Priority | Decision |
|---|---|---|---|---|---|
| My Work > Decisions | App Table + Preview | Keep as reference | Minor hardening | P0 ref | Reference |
| Interviews | Mixed hub/list | ModuleHub + App Table + Preview where needed | Topbar/table consistency | High | Refactor |
| Admin tables | Mixed | App Table | Width/toolbars/actions | High | Refactor |
| Tool workspaces | Mixed workspace | ToolWizard / Workspace 3-tools strip | Local controls | Medium | Refactor |

Priorytety:

- `Reference`: wzór do kopiowania.
- `High`: ekran widoczny, często używany, silnie niespójny.
- `Medium`: ekran istotny, ale nie blokuje głównego odczucia aplikacji.
- `Low`: ekran rzadki lub legacy.
- `Do not touch`: ekran w przebudowie lub zależny od innego refactoru.

## 11. Definition of Done dla ekranu

Ekran jest zgodny ze standardem tylko jeśli:

- używa właściwego shellu: ModuleHub, N-mode, ToolWizard, Workspace albo innego zatwierdzonego wzorca,
- nie ma własnego page-level layoutu, jeśli istnieje shell,
- używa komponentów z `@/components/ui` lub `@/components/shared`,
- nie ma raw przycisków i lokalnych kart dla zwykłych akcji/contentu,
- ma loading, empty, error i degraded states,
- ma feedback po mutacjach,
- nie ma fake success,
- ma read-back lub widoczną aktualizację stanu po zapisie,
- destructive actions mają confirm,
- AI actions są w kontekście i nie wykonują mutacji po cichu,
- nie ma drugiego/third toolbara między topbarem a treścią,
- tabela spełnia App Table Standard, jeśli ekran jest tabelaryczny,
- tabela spełnia DBR77 2027 App Table Color Contract z Golden Standard,
- `MetaChip`/`ToolChip` są neutralne i nie udają CTA,
- `StatusChip`/`DueChip`/`PriorityChip` używają jednej mapy semantycznej dla całego modułu,
- preview pane spełnia Table Preview Pane Standard, jeśli ekran używa preview,
- light mode jest czytelny,
- dark mode nie używa czystej czerni/bieli,
- brak raw internals w UI,
- odstępstwa są opisane w audycie.

## 12. Definicja gotowości do przebudowy UI

Zanim zaczniemy masową przebudowę ekranów, wymagane są:

1. Ten dokument zatwierdzony przez Ownera/CTO. Status: `approved migration baseline`.
2. Reguła Cursor aktywna w `.cursor/rules/consultify-ui-ux-canon.mdc` oraz wskazana w `.cursorrules`.
3. Lista ekranów do audytu w `docs/ui-standards/_archive/UI_UX_MIGRATION_AUDIT.md`.
4. Plan migracji w `docs/ui-standards/_archive/UI_UX_MIGRATION_PLAN.md`.
5. Wybór ekranów referencyjnych w dokumencie audytu.
6. Decyzja, które ekrany są `Do not touch`.

## 13. Rekomendowana kolejność przebudowy

Nie zaczynać od estetyki pojedynczych kart. Zacząć od systemu.

Kolejność:

1. Potwierdzić standard i regułę Cursor.
2. Zrobić audyt ekranów.
3. Wybrać ekran referencyjny dla ModuleHub/App Table.
4. Wybrać ekran referencyjny dla N-mode/detail.
5. Ustabilizować komponenty bazowe i brakujące warianty.
6. Refaktorować ekrany high-traffic/high-visibility.
7. Dopiero potem przejść przez moduły rzadziej używane.

Rekomendowane pierwsze obszary:

- My Work / Decisions jako referencja tabeli + preview.
- Interviews jako pierwszy duży refactor App Table.
- Tools / Discovery workspace jako pierwszy refactor ToolWizard / workspace.
- Admin tables jako refactor tabel i actions column.

## 14. Decyzje nadal otwarte podczas migracji

Te decyzje nie blokują standardu, ale będą rozstrzygane w audycie i planie migracji:

1. Które istniejące ekrany są `Do not touch` z powodów produktowych lub technicznych.
2. Które listy dostają preview pane w pierwszej fali.
3. Które cards/grid pozostają jako default view, a które przechodzą na App Table jako default.
4. Które view-local toolbary wymagają nowego formalnego standardu.
5. Które istniejące komponenty migrujemy do `rounded-hig-*` w pierwszej fali, a które zostają do późniejszego visual hardening.
6. Które wzorce są referencyjne po audycie wizualnym, a które tylko historycznie były traktowane jako wzór.

## 15. Najkrótsza reguła dla zespołu

Jeżeli ktoś ma zapamiętać tylko jedno zdanie:

> Nie projektuj ekranu. Wybierz kanoniczny typ ekranu, użyj wspólnego shellu, skomponuj go z zatwierdzonych komponentów i udokumentuj każde odstępstwo.
