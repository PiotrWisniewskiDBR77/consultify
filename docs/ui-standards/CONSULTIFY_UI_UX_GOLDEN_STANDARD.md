# Consultify UI/UX Golden Standard

Status: `v1 - source of truth`
Date: 2026-05-01
Owner decyzyjny: Product / CTO / Delivery Owner
Repo: `DRD/consultify`
Remote: `https://github.com/PiotrWisniewskiDBR77/consultify.git`

## 1. Rola tego dokumentu

Ten dokument jest najwyższym źródłem prawdy dla UI/UX, grafiki, układów ekranów, komponentów i zasad pracy nad interfejsem Consultify.

Jego cel:

- zatrzymać rozpad aplikacji na przypadkowe ekrany,
- wymusić jeden język wizualny,
- wymusić pracę z zatwierdzonych komponentów,
- dać Cursorowi jednoznaczny standard generowania UI,
- dać zespołowi proces dopisywania nowych wzorców bez chaosu,
- przygotować aplikację do kontrolowanej migracji ekran po ekranie.

Najważniejsza zasada:

> Feature screens do not own visual design. Feature screens compose approved Consultify standards, shells and components.

Po polsku:

> Ekrany funkcjonalne nie projektują wyglądu. Ekrany funkcjonalne składają zatwierdzone klocki Consultify.

## 2. Hierarchia źródeł prawdy

Jeśli dokumenty są sprzeczne, obowiązuje kolejność:

1. `docs/ui-standards/CONSULTIFY_UI_UX_GOLDEN_STANDARD.md` - ten dokument, konstytucja UI/UX.
2. `docs/ui-standards/CONSULTIFY_UI_UX_OPERATING_STANDARD.md` - operacyjna brama dla Cursor, refactorów i migracji.
3. `docs/ui-standards/UI_UX_CANON_V3.md` - kanon decyzji v3.
4. `docs/ui-standards/FROZEN_LAYOUTS.md` - layouty zamrożone.
5. Szczegółowe standardy:
   - `00-foundation/*`
   - `01-shell-layout/*`
   - `02-components/*`
   - `03-modules/*`
6. Implementacje referencyjne z `UI_UX_REFERENCE_SCREENS.md`.
7. Historyczne dokumenty i snapshoty - tylko kontekst, nigdy standard.

Jeśli standard mówi X, a ekran robi Y, to ekran jest kandydatem do migracji. Nie tworzymy wariantu Z.

## 3. Zasady nadrzędne

### 3.1 SSOT over vibes

Nie projektujemy "na oko". Każda decyzja UI/UX ma wynikać z:

- tego dokumentu,
- istniejącego standardu szczegółowego,
- zatwierdzonego ekranu referencyjnego,
- albo nowej decyzji dopisanej do dokumentacji.

### 3.2 One product, one visual language

Consultify ma wyglądać jak jedna aplikacja. Moduły nie mają własnych palet, typografii, kart, toolbarów ani stylu przycisków.

### 3.3 Quiet premium, not decorative UI

Docelowy charakter:

- enterprise clean,
- "quiet luxury",
- dużo porządku, mało ozdobników,
- hierarchy through spacing and typography,
- color as signal, not decoration,
- depth through surfaces, not heavy borders.

### 3.4 Component-first

Cursor i developerzy najpierw szukają istniejącego komponentu. Jeśli nie pasuje:

1. proponują rozszerzenie komponentu albo nowy standard,
2. opisują go w dokumentacji,
3. dopiero potem używają go w ekranie.

### 3.5 No hidden behavior

UI nie może kłamać ani robić rzeczy po cichu:

- no fake success,
- no silent execution,
- no hidden learning,
- no raw backend internals,
- no infinite spinner without recovery,
- no destructive action without confirmation.

## 4. Status aplikacji

Obecny status:

`STANDARD_EXISTS_IMPLEMENTATION_FRAGMENTED`

Oznacza to:

- standardy istnieją,
- komponenty istnieją,
- ale część ekranów nadal ma lokalne wzorce,
- każdy nowy ekran bez reguł może pogłębić chaos.

Docelowy status:

`UI_UX_CANON_ENFORCED`

Oznacza to:

- nowe ekrany powstają wyłącznie z zatwierdzonych shelli i komponentów,
- stare ekrany są migrowane według planu,
- brakujące wzorce są najpierw dokumentowane,
- Cursor nie tworzy własnych standardów.

## 5. Golden Visual Language

### 5.0 DBR77 Tech Sexy 2027 target

Consultify ma wyglądać jak globalny, szanowany SaaS AI konsultant: spokojne centrum dowodzenia, nie zbiór narzędzi i nie lokalny panel admina.

Docelowy standard łączy pięć wpływów:

- OpenAI / ChatGPT - spokojna produktywność, AI jako naturalna warstwa pracy.
- Claude / Anthropic - zaufanie, ciepło, czytelność, brak agresywnego tech.
- Google Material 3 - formalna skala shape, elevation, density i motion.
- Apple HIG / Liquid Glass - warstwowość, premium controls i lekka translucencja tylko tam, gdzie ma sens.
- Linear / Stripe / Notion - density, precyzyjne tabele, command-first workflow i zero dekoracyjnego UI.

Zasada nadrzędna:

> Consultify ma być high-density where useful, calm where trust matters, and visually quiet everywhere else.

Po polsku:

> Tam, gdzie użytkownik pracuje operacyjnie, interfejs ma być gęsty i precyzyjny. Tam, gdzie czyta, decyduje albo ufa AI, interfejs ma oddychać.

#### 5.0.1 Shape scale

Nowy i migrowany UI używa kontekstowego shape systemu:

| Element | Target radius |
|---|---:|
| Table rows / row hover / small inline controls | `8px` |
| Inputs / filters / compact buttons | `10px` |
| Cards / panels / table surfaces | `12px` |
| Primary CTA | `14px` albo `rounded-hig-full` |
| Preview pane / side panels | `16px` |
| Modals / drawers / large floating panels | `20px` |
| Command chips / badges / pills | `rounded-hig-full` |
| AI floating panel / command palette | `20-24px` |

Nie zaokrąglamy wszystkiego maksymalnie. Bardzo duży radius jest zarezerwowany dla pills, floating UI i AI surfaces. Enterprise content pozostaje bardziej geometryczny.

#### 5.0.2 Elevation and shadows

Consultify używa tonal elevation, nie ciężkich cieni.

| Surface | Shadow |
|---|---|
| Ordinary card | none |
| Table surface | none |
| Dashboard tile | none |
| Sticky command row after scroll | minimal sticky elevation only |
| Dropdown / popover / menu | `shadow-hig-lg` |
| Modal / drawer | `shadow-hig-xl` / `shadow-hig-2xl` |
| AI floating surface | glass/subtle translucency + soft shadow |

Shadow komunikuje floating layer, nie "ładną kartę". Jeśli element nie unosi się nad UI, nie dostaje cienia.

#### 5.0.3 Five-layer surface model

Docelowy model warstw:

| Layer | Rola |
|---|---|
| Layer 0 | app chrome / sidebar / deepest navigation |
| Layer 1 | main content background |
| Layer 2 | table / card / panel / working surface |
| Layer 3 | sticky or raised controls |
| Layer 4 | floating UI: modal, drawer, dropdown, AI overlay, command palette |

Każdy nowy shell, toolbar, preview, modal i AI panel musi wskazać swoją warstwę. Jeśli nie da się wskazać warstwy, element jest prawdopodobnie niezatwierdzonym UI.

#### 5.0.4 Density modes

Consultify ma trzy projektowe gęstości:

| Density | Zastosowanie | Charakter |
|---|---|---|
| `Compact` | tabele, Admin, SuperAdmin, power-user work queues | dużo informacji, mało ozdób |
| `Comfortable` | domyślny workspace, ModuleHub, tool flows | równowaga pracy i czytelności |
| `Reading` | AI output, dokumenty, raporty, decyzje, long-form review | większy line-height, mniejsza presja UI |

Jedna gęstość dla całej aplikacji jest błędem. Moduł może mieć wiele widoków, ale każdy widok musi jasno należeć do jednej z tych gęstości.

#### 5.0.5 Typography precision

Docelowa skala:

| Rola | Target |
|---|---|
| App/module title | `18-20px`, `font-semibold` |
| Section title | `14-16px`, `font-semibold` |
| Body UI | `13-14px`, regular/medium |
| Table body | `13px`, stable line-height |
| Metadata / timestamp / helper label | `11-12px` |
| KPI value | `24-32px` |
| AI/document reading body | `15-16px`, line-height `1.55-1.7` |

Tabele i control planes mogą być gęste. AI output, dokumenty i decyzje nie mogą wyglądać jak tabela administracyjna.

#### 5.0.6 Glass and translucency

Glass / liquid / translucent UI jest dozwolone tylko dla:

- AI assistant floating panel,
- command palette,
- modal overlay,
- preview overlay,
- guided onboarding / contextual help,
- premium empty state.

Glass jest zakazane dla:

- zwykłych kart,
- tabel,
- Admin/SuperAdmin panels,
- dashboard tiles,
- każdego panelu użytego tylko "żeby było sexy".

Glass oznacza warstwę inteligencji albo floating control. Nie oznacza standardowego kontenera treści.

#### 5.0.7 Data table standard feel

Tabele mają wyglądać jak precyzyjne narzędzia pracy, nie klasyczny CRM.

Target:

- compact row height: `40px`,
- comfortable row height: `48px`,
- header height: `40px`,
- action column zawsze po prawej,
- hover row = subtelne tło, bez border shift,
- selected row = subtle primary surface + opcjonalny left accent/dot,
- missing value = `—`,
- preview open nie może rozbijać rytmu tabeli,
- action icons wiersza są ciche, najlepiej ujawniane on hover, poza krytycznymi statusami.

#### 5.0.8 AI as infrastructure

AI w Consultify nie jest dekoracją ani osobną wyspą wizualną. AI jest infrastrukturą pracy.

Standard:

- AI actions są kontekstowe,
- AI nie tworzy wielu kolorowych CTA,
- output ma streaming albo skeleton, nie pusty spinner,
- ważne propozycje mają provenance/citations/confidence tam, gdzie ma to wpływ na decyzję,
- ważne akcje idą przez proposal -> approval -> execution,
- brak silent execution,
- brak hidden learning,
- AI panels używają warstwy Layer 4 albo zatwierdzonego slotu Menu 3.

### 5.1 Kolor

Kolor jest informacją, nie dekoracją.

Dozwolone role kolorów:

- `primary/*` - jedyny mocny CTA, aktywny stan, focus, link.
- `danger/*` - destrukcja, błąd, alarm.
- `success/*` - potwierdzenie, zdrowy status.
- `warning/amber/*` - ryzyko, ostrzeżenie.
- `info/blue/*` - informacja.
- `navy/*`, `slate/*` - chrome, neutralne tła, tekst, separatory.

Zakazy:

- brak kolorowych ikon w chrome/nav bez znaczenia semantycznego,
- brak wielu kolorowych CTA na jednym ekranie,
- brak gradientów jako dekoracji UI,
- brak koloru jako sposobu "żeby było ładniej".

Domyślnie ekran ma maksymalnie jeden mocny kolorowy element akcji. Reszta jest monochromatyczna.

### 5.2 Surfaces i warstwy

Consultify używa warstw tła:

| Layer | Rola | Przykład |
|---|---|---|
| Layer 0 | global chrome / sidebar | najgłębsze tło |
| Layer 1 | content area | główna powierzchnia pracy |
| Layer 2 | card / panel / table surface | podniesiona treść |
| Layer 3 | floating UI | modal, dropdown, drawer, tooltip |

Zasady:

- light mode base: `bg-slate-50`, nie czyste `bg-white` jako cała aplikacja,
- dark mode base: ciepłe navy, nie `#000`,
- karty contentowe domyślnie bez mocnych borderów,
- shadow tylko dla floating UI, nie dla zwykłych kart,
- separacja przez tło, spacing i typografię.

### 5.3 Typografia

Typografia buduje architekturę.

Standard:

- font: Inter,
- nagłówki: `font-semibold`, nie `font-bold`,
- duże nagłówki bez ALL CAPS,
- ALL CAPS tylko dla małych labeli,
- body UI zwykle `text-sm`,
- metadata zwykle `text-xs`,
- dashboardy: KPI/value w `text-xl` / `text-2xl`, nie mikro tekst.

Zakazy:

- mieszanie fontów,
- ozdobne typografie,
- zbyt mały tekst w dużych kartach,
- nagłówki robione kolorem zamiast wagą/rozmiarem.

### 5.4 Spacing i gęstość

Consultify ma dwie gęstości:

- nawigacja/chrome: tight,
- content/workspace: breathing space.

Rytm spacing:

- 8px,
- 12px,
- 16px,
- 20px,
- 24px,
- 32px.

Zasady:

- grupy oddzielamy spacingiem, nie liniami,
- content ma oddychać,
- dashboardy mają być czytelne, nie puste,
- tabele mają mieć stabilny rytm wierszy.

### 5.5 Rounding

Docelowy kierunek:

- nowy kod używa `rounded-hig-*`,
- pills/chips używają `rounded-hig-full` albo równoważnego pill tokena,
- stare `rounded-xl` migrujemy etapowo.

Nie robimy masowej mechanicznej podmiany bez testu wizualnego.

### 5.6 Motion

Motion ma pomagać orientacji, nie bawić się kosztem pracy.

Standard:

- hover/focus: 120-160ms,
- panel/dropdown/tab transition: 160-220ms,
- drawer/layout shift: 240-320ms,
- easing: soft ease-out,
- bez ciężkich animacji dekoracyjnych,
- wspierać `prefers-reduced-motion`.

## 6. Golden Graphic Standard

Ten rozdział dotyczy grafiki, ikon, ilustracji, miniatur, chartów, diagramów, screenów i assetów wizualnych.

### 6.1 Ikony

Standard:

- outline,
- mono-weight,
- spójny stroke,
- rozmiary zgodne z kontekstem,
- kolor ikony = kolor tekstu lub semantyczny status.

Zakazy:

- filled icons jako default,
- kolorowe ikony w sidebar/topbar,
- mieszanie bibliotek ikon w jednym obszarze,
- ikony jako ozdoby bez znaczenia.

### 6.2 Artifact identity

Każdy artefakt ma:

- jedną kanoniczną ikonę,
- jeden kanoniczny kolor akcentu,
- jeden standard badge/status,
- jeden sposób pojawiania się w tabeli, preview, detail i workspace.

Akcent artefaktu może pojawiać się w:

- dot,
- mini marker,
- badge,
- subtelny border,
- ikona w data surface.

Nie może pojawiać się jako kolorowa nawigacja/chrome.

Open artifact tabs/buttons:

- mogą używać kanonicznego symbolu i koloru artefaktu,
- są właściwym miejscem na subtelny artifact identity signal,
- muszą jednak dziedziczyć globalny standard wysokości, fontu, radiusu i density dla controls,
- jeśli system controls zostanie zmniejszony, open artifact buttons skalują się proporcjonalnie,
- nie mogą tworzyć osobnego stylu przycisków tylko dla otwartych kart.

### 6.3 Ilustracje i grafiki produktowe

Grafiki w Consultify mają być użytkowe, nie marketingowe w środku aplikacji.

Dozwolone:

- diagram procesowy,
- schemat zależności,
- pusty stan z ikoną,
- wizualizacja modelu/flow,
- mini preview artefaktu,
- chart lub KPI visualization.

Zakazane:

- ozdobne ilustracje bez funkcji,
- gradientowe dekoracje w panelach roboczych,
- losowe grafiki generowane dla "ładności",
- niespójne style ilustracji per moduł.

### 6.4 Charts i dashboard visuals

Zasady:

- chart ma służyć decyzji,
- każdy chart ma tytuł, zakres, źródło danych lub empty state,
- kolory chartów są semantyczne,
- nie używamy tęczowych palet,
- KPI cards muszą mieć hierarchy: label, value, delta/source.

Dashboardy:

- preferują czytelność nad pustą przestrzeń,
- używają section headers,
- mają density control, jeśli obszar jest gęsty,
- nie mieszają wielu stylów kart.

### 6.5 Empty / loading / error visuals

Empty state:

- spokojna ikona,
- jasny tytuł,
- opis przyczyny,
- next action, jeśli istnieje,
- bez raw technical copy.

Loading:

- skeleton dla treści strukturalnej,
- spinner tylko dla małych akcji,
- brak wiecznego spinnera bez timeout/error.

Error:

- mówi co się stało,
- mówi co user może zrobić,
- nie pokazuje stack trace/raw JSON,
- jeśli błąd jest provider/backend, UI mówi uczciwie degraded/unavailable.

### 6.6 Screenshoty i preview graficzne

Jeśli aplikacja pokazuje screen/preview:

- musi mieć stabilne proporcje,
- nie może rozpychać layoutu,
- musi mieć fallback,
- nie może mieszać light/dark bez intencji,
- nie może udawać danych produkcyjnych, jeśli to placeholder.

## 7. Golden Layout Standard

### 7.1 Global shell

Globalny shell zawiera:

- sidebar,
- App Topbar,
- content area,
- split chat / contextual panel tam, gdzie dotyczy.

Sidebar i topbar nie są miejscem na lokalne eksperymenty modułów.

`Help` ma standardowe wejście jako ikona w sidebarze / globalnym shellu.

Nie dublujemy `Help` w lokalnych topbarach modułów, jeśli użytkownik ma już dostęp do globalnego wejścia.

### 7.2 App Topbar

App Topbar jest globalny i stały.

Prawa strona:

1. Data.
2. Model.
3. Inbox.
4. Tasks Today.
5. User.

Zakaz:

- globalny AI toggle,
- lokalne akcje modułu,
- zmienna kolejność per ekran.

### 7.3 Module Topbar

Module Topbar jest kontekstowy.

Lewa strona:

- search toggle,
- główne taby modułu.

Prawa strona wizualnie od prawej:

1. `Primary CTA` ekranu, np. `Dodaj`, `Nowy`, `Create` albo inna główna akcja zależna od kontekstu.
2. View mode switcher jako segmented icon control.
3. Filtry / dropdown controls w stronę środka.
4. Dodatkowe neutralne context controls tylko jeśli są naprawdę potrzebne i sklasyfikowane.

DOM może być renderowany inaczej, ale wizualna kolejność ma być zachowana.

Zasady:

- pierwszy element od prawej to zawsze główna akcja ekranu, jeśli ekran ma CTA,
- view mode switcher nie jest dropdownem, tylko zestawem ikon zatwierdzonych widoków,
- filtry idą bliżej środka, żeby nie konkurować z CTA,
- `Help` nie jest standardowym elementem Module Topbar/Menu 2, ponieważ ma swoje miejsce jako ikona w sidebarze / globalnym shellu,
- lokalny help może istnieć tylko jako dobrze uzasadniona akcja kontekstowa, bez dublowania globalnej ikony,
- lokalna kolejność nie może być improwizowana per ekran.

### 7.4 Menu 3 / Command Row

Pod Module Topbar istnieje dokładnie jeden `Menu 3 / Command Row`.

`Menu 3` to oficjalna nazwa warstwy dynamicznych akcji i controls zależnych od kontekstu. `Command Row` jest nazwą techniczną/implementacyjną.

Wizualnie `Menu 3` musi być lekko odróżnione od Module Topbar:

- ma własny subtelny Layer 2/3 surface,
- może mieć nieco inne tło niż główny topbar,
- odróżnienie ma być spokojne, nie kontrastowe,
- dzięki temu użytkownik widzi, że to rząd zmienny kontekstowo,
- `Menu 3` nie jest kolejnym topbarem ani osobnym modułem.

`Menu 3` wymaga osobnego standardu wysokości i zachowania:

- wysokość musi być wystandaryzowana między modułami,
- zmiana kontekstu nie może powodować przypadkowego skakania layoutu,
- stan pusty/minimalny nadal zachowuje przewidywalną wysokość,
- wariant gęsty i wariant rozszerzony muszą być opisane,
- dodatkowy diagnostyczny/technical row nie może udawać `Menu 3` i musi być osobno sklasyfikowany.

Copy w compact controls:

- dropdown trigger pokazuje krótką aktualną wartość, jeśli kontekst wynika z miejsca lub menu,
- nie powtarzamy długiego prefiksu typu `Priorytet:` w triggerze, jeśli przez to control staje się zbyt szeroki,
- pełny kontekst może być w menu, tooltip, aria-label albo labelu grupy,
- menu rozwijane może pokazywać pełniejsze etykiety, jeśli pomaga to zrozumieć wybór.

Może pełnić funkcję:

- bulk actions,
- search row,
- dynamic tabs,
- context counters.

Priorytet:

1. Bulk actions.
2. Search.
3. Dynamic tabs.
4. Counters.

Bulk actions są trybem `Menu 3`, nie osobnym design systemem.

Gdy user zaznacza rekordy:

- `Menu 3` może przełączyć się w bulk-selection mode,
- licznik zaznaczeń i akcje seryjne pojawiają się w tym samym rowie,
- akcje kontekstowe preferują prawy slot `Menu 3`,
- przyciski bulk actions używają tych samych ról co reszta systemu: `Toolbar Control`, `Secondary Action`, `Danger Action`,
- zachowują tę samą wysokość, radius, surface, border i icon treatment,
- destrukcyjne bulk actions są `Danger Action` i wymagają confirm/governance,
- nie wolno tworzyć osobnego stylu przycisków tylko dla bulk mode.

Nie wolno dokładać drugiego i trzeciego paska między topbarem a treścią.

### 7.5 Control bars

Dozwolone klasy control barów:

- App Topbar,
- Module Topbar,
- Menu 3 / Command Row,
- View-local Toolbar,
- Workspace 3-tools Strip,
- Bulk Action Bar,
- Preview Footer Actions.

Każdy inny toolbar wymaga standardu.

## 8. Golden Component Standard

### 8.1 Zasada komponentów

Nowe UI korzysta z:

- `@/components/ui`,
- `@/components/ui/primitives`,
- `@/components/ui/composed`,
- `@/components/shared/ModuleHub`,
- `@/components/shared/NModeLayout`,
- `@/components/shared/ToolWizard`,
- `@/components/shared/PreviewPane`,
- `@/components/ui/ResizableTable`.

### 8.2 Zakaz one-off UI

W feature screens nie tworzymy lokalnych:

- buttonów,
- kart,
- badge/chips,
- tabel,
- empty states,
- loading states,
- error states,
- modal/drawer styling,
- toolbars,
- page shells.

Wyjątki muszą być opisane jako:

- low-level primitive,
- view-local canvas control,
- approved adapter,
- migration debt,
- nowy standard.

### 8.3 Button and menu control roles

Nie zatwierdzamy "przycisków" jako jednej wizualnej kategorii. Każdy clickable control musi mieć jedną rolę:

| Rola | Użycie |
|---|---|
| `Primary CTA` | Jedyna mocna kolorowa akcja ekranu, np. `Nowy pomysł`, `Dodaj`, `Create`, `Save`. Literalny znak `+` nie jest częścią labela; ikona `Plus` jest dozwolona dla tworzenia nowego obiektu. |
| `Secondary Action` | Neutralna akcja drugorzędna. |
| `Toolbar Control` | Dropdown/filter/view trigger w topbarze albo command row. |
| `Segmented Module Tab` | Taby modułu, np. Biblioteka/Sesje/Raporty. |
| `Status Filter Chip` | Status/licznik/filtr, np. Draft/Pending/In Progress. |
| `Icon Button` | Search, Help, Inbox, Notification, Close, More. |
| `Ghost/Text Action` | Lekka akcja inline lub wiersza. |
| `Danger Action` | Destrukcyjna akcja w kontekście confirm/governance. |

W jednym menu row controls muszą mieć spójną wysokość, radius family, tło i border logic. Mieszanie ciemnych/jasnych teł, sharp corners, framed/unframed controls i różnych typów aktywności bez roli jest migration debt.

Szczegółowy standard: `docs/ui-standards/00-foundation/visual-language.md`, sekcja `8.3 Buttons, menu controls and chips`.

### 8.4 Procedura nowego komponentu

Nowy komponent powstaje tylko wtedy, gdy:

1. istniejący komponent nie pasuje,
2. problem powtarza się albo jest strategiczny,
3. opisano use case,
4. opisano props/variants,
5. opisano kiedy używać i kiedy nie używać,
6. dopisano dokumentację,
7. dopiero potem użyto w ekranie.

### 8.5 Badge / Status Chip contrast standard

Kolorowe badge/chips są dozwolone i potrzebne, ale kolor nie może obniżać czytelności.

Obecny problem:

- pastelowe tło + kolorowy tekst nie zawsze daje wystarczający kontrast,
- w light mode oznaczenia są jeszcze mniej wyraźne,
- zbyt subtelne badge przestają być informacją i stają się dekoracją.

Docelowy standard:

- tekst badge/chip musi być czytelny w dark i light mode,
- kolor semantyczny powinien być wzmacniany przez dot/marker, border albo mocniejszy surface,
- nie polegamy wyłącznie na jasnym tle i jasnym tekście tego samego koloru,
- każdy status/tag ma mieć minimum: readable label, semantic marker, stable pill shape,
- light mode wymaga osobnego testu kontrastu,
- badge w tabeli musi być czytelny przy szybkim skanowaniu, nie tylko po przybliżeniu.

Do finalizacji wymagany jest nowy `Badge / Status Chip` standard z wariantami dla:

- status/lifecycle,
- priority/severity,
- tag/category,
- tool/source,
- count chip,
- selected/active filter chip.

## 9. Golden Screen Types

### 9.1 ModuleHub

Dla modułów i kolekcji:

- tabs,
- view modes,
- filters,
- Command Row,
- table/grid/kanban/timeline/calendar/matrix.

### 9.2 App Table

Dla list roboczych:

- full width,
- search toggle,
- header filters,
- resizable columns,
- Actions column z pionowym kebab,
- no duplicate toolbars,
- no duplicate title/breadcrumb.

Zatwierdzony kierunek wizualny:

- wiersze mają być gęste, ale czytelne,
- tekst i oznaczenia/badge muszą być widoczne bez wysiłku,
- tabela może przenosić dużo informacji, jeśli rytm wierszy pozostaje stabilny,
- nagłówki kolumn mogą zawierać filtry/sort controls,
- zmiana szerokości kolumn jest częścią standardu,
- kolumny muszą mieć jasne role i przewidywalne wyrównanie,
- taki standard jest referencyjny dla `My Work / Decisions` App Table.

Standard akcji tabeli:

- przycisk ustawień tabeli jest zatwierdzonym triggerem konfiguracji tabeli,
- pionowy kebab `⋮` po prawej stronie wiersza jest zatwierdzonym triggerem akcji wiersza,
- menu pod kebabem musi mieć własny standard zawartości,
- samo `Otwórz` jako jedyna akcja jest za małe dla docelowego wzorca,
- row action menu powinno uwzględniać minimum: open/detail, preview/focus jeśli dotyczy, status/lifecycle actions, assignment/ownership jeśli dotyczy, copy/link/share jeśli dotyczy, destructive action w osobnej grupie i tylko z confirm/governance,
- akcje niedostępne przez permissions mają być ukryte albo disabled z uzasadnieniem zgodnie z permission UX.
- menu z samym `Otwórz` nie spełnia standardu row action menu, chyba że artefakt naprawdę nie ma żadnych innych działań, a wyjątek jest udokumentowany.

Pozytywny kierunek dla `Row Action Menu`:

- menu ma być bogatsze niż pojedyncze `Otwórz`,
- akcje są grupowane w bloki,
- bloki są oddzielone subtelnym dividerem albo spacingiem,
- ikony są monochromatyczne poza danger/status,
- destructive action jest w osobnej grupie.

Wstępne bloki:

1. Open / Focus: `Otwórz`, `Focus + dziś`, `Focus + ten tydzień`, `Focus + później`.
2. Lifecycle: `Gotowe`, `Przyjmij`, `Odrzuć`, `Zapisz`, zależnie od typu artefaktu.
3. Organize: `Zapisz jako notatkę`, `Przypisz`, `Priorytet`, `Projekt`.
4. Schedule / Snooze: `Odłóż`, `Odłóż: 2 godziny`, `Jutro rano`, `3 dni`, `Poniedziałek`.
5. Destructive / Reject: `Usuń`, `Odrzuć`, tylko z właściwym confirm/governance.

Finalna zawartość bloków musi być zdefiniowana per typ artefaktu.

### 9.3 Table + Preview

Dla list, gdzie user skanuje i decyduje:

- preview default off,
- single click = preview,
- double click/Enter = full detail,
- preview header/body/footer,
- quick actions parity.

Preview pane jest pozytywnym standardem, ale musi mieć stabilną anatomię.

Header preview:

1. Tytuł artefaktu.
2. Pin/fix control, jeśli preview może być przypięty.
3. `Otwórz` jako realny przycisk systemowy.
4. Close `X`.

Zasady:

- `Otwórz` nie może wyglądać jak sam tekst bez tła,
- `Otwórz` używa zatwierdzonej roli `Secondary Action` albo toolbar-style button,
- pin i close są `Icon Button`,
- header nie może zmieniać układu między typami artefaktów,
- body i footer mogą być domenowe, ale header pozostaje standardowy.

Standard body preview:

1. Alerts/statuses - najpierw najważniejsze ryzyka, status, priority/severity, terminy, SLA, approval state.
2. Szczegóły - opis, owner, project, metadata, daty, podstawowe pola domenowe.
3. AI - tylko kontekstowe akcje AI i/lub ostatni insight; bez silent execution.
4. Powiązania lokalne - linked tasks, decisions, initiatives, notes, tools, reports, jeśli istnieją.
5. Sekcja przycisków akcji - ostatnia sekcja preview.

Jeśli blok nie ma danych, może być ukryty albo pokazany jako quiet empty state, ale kolejność bloków pozostaje stała.

#### Preview action section standard

Sekcja akcji na dole preview jest obowiązkowo standaryzowana.

Zasady ogólne:

- akcje są na końcu preview,
- układ jest maksymalnie 2 kolumny w szerokim preview, 1 kolumna w wąskim,
- przyciski mają spójną wysokość, radius i font z globalnym systemem controls,
- ikony są monochromatyczne poza status/danger,
- skróty klawiszowe mogą być małymi keycaps po prawej stronie labela,
- destructive actions są oddzielone wizualnie i wymagają confirm/governance,
- nie tworzymy lokalnych wariantów przycisków per artefakt.

Limit widocznych akcji:

- domyślnie preview pokazuje 4-6 widocznych akcji,
- absolutne maksimum bez overflow: 6 akcji,
- jeśli akcji jest więcej, pozostałe trafiają do `More` / kebab / row action menu,
- primary CTA w preview nie jest domyślne; większość akcji preview to `Secondary Action`, semantic status action albo `Danger Action`,
- nie pokazujemy dwóch akcji o tym samym znaczeniu w preview i row menu, chyba że jedna jest skrótem do najważniejszego workflow.

Hierarchia akcji:

1. Główna akcja kontekstowa artefaktu - maksymalnie 1, jeśli istnieje.
2. Dwie najważniejsze akcje lifecycle/status.
3. Jedna lub dwie akcje organizacyjne/informacyjne.
4. Jedna akcja scheduling/reminder/escalation, jeśli jest częścią workflow.
5. Danger/destructive oddzielnie albo w overflow, zależnie od ryzyka.

Zasady widoczności:

- akcje zależą od typu artefaktu, statusu, permissions i aktualnego kontekstu,
- akcja, której user nie może wykonać, jest ukryta albo disabled z uzasadnieniem,
- preview nie może pokazywać akcji, które nie mają backend/read-back albo realnego efektu,
- akcje AI nie mieszają się z normalnymi akcjami lifecycle; AI ma własny blok powyżej sekcji akcji,
- akcje destrukcyjne nigdy nie są wizualnie pierwszą akcją.

Role wizualne:

- lifecycle positive: semantic success/neutral surface, nie primary gradient,
- lifecycle negative/reject: danger outline/surface, nie pełny czerwony blok bez confirm,
- info/open/delegate/remind: neutral `Secondary Action`,
- escalation: warning semantic action,
- destructive: `Danger Action`, osobna grupa, confirm/governance.

Kolejność grup akcji:

1. Lifecycle / decision actions.
2. Information / detail actions.
3. Assignment / ownership actions.
4. Scheduling / reminder actions.
5. Escalation / governance actions.
6. Destructive / reject actions.

Role przycisków:

| Grupa | Przykłady | Rola UI |
|---|---|---|
| Lifecycle / decision | `Przyjęta`, `Odrzucona`, `Gotowe`, `Zapisz` | `Secondary Action` albo semantic status action; nie primary CTA |
| Information | `Więcej info`, `Otwórz`, `Preview`, `Focus` | `Secondary Action` |
| Assignment | `Deleguj`, `Przypisz`, `Zmień ownera` | `Secondary Action` |
| Scheduling | `Przypomnij`, `Odłóż`, `Ustaw termin` | `Toolbar Control` / `Secondary Action` |
| Escalation | `Eskaluj`, `Wyślij do review` | semantic warning action |
| Destructive / reject | `Usuń`, `Odrzuć`, `Cofnij approval` | `Danger Action`, always confirm/governance |

Przykład układu dla Decision preview:

1. Row 1: `Przyjęta` / `Odrzucona`.
2. Row 2: `Więcej info` / `Deleguj`.
3. Row 3: `Przypomnij` / `Eskaluj`.
4. Optional: destructive/reject group separated from normal actions.

`Zgłoś błąd` jest global/help feedback action, nie częścią preview action section. Nie może wizualnie konkurować z akcjami artefaktu.

### 9.4 N-mode Detail

Dla artefaktów/detail views:

- `NModeShell`,
- `NModeHeader`,
- `NModePropertiesStrip`,
- `NModeLeftNav`,
- `NModeCanvas`,
- shared sections.

Artifact work screen jest jednym z głównych standardów pracy w aplikacji.

Docelowo wspiera dwa tryby prezentacji:

1. `N-mode` - Notion-inspired.
2. `C-mode` - ClickUp-inspired.

#### N-mode

`N-mode` jest zatwierdzonym kierunkiem dla detail/work screens.

Charakter:

- page/document-first,
- lewy rail z sekcjami artefaktu,
- centralny canvas z treścią,
- properties/status/workflow w kontrolowanym górnym obszarze,
- dobre dla pracy sekwencyjnej, dokumentowej i jakościowej.

Lewy rail w `N-mode` jest inspirowany Notion:

- sekcje są stałe i czytelne,
- aktywna sekcja ma wyraźny, ale spokojny highlight,
- rail nie jest miejscem na przypadkowe akcje,
- rail służy do nawigacji po strukturze artefaktu.

#### C-mode

`C-mode` jest kierunkiem wymagającym osobnego standardu.

Inspiracja: ClickUp-style work surface.

Intencja:

- więcej treści widocznej na jednej stronie,
- inny układ sekcji niż `N-mode`,
- bardziej operacyjny / dashboardowy sposób pracy,
- mniej przewijania między sekcjami, więcej pracy równoległej.

Status: `NEEDS_STANDARD`.

Nie wdrażamy przypadkowego `C-mode` bez planu. Przed zatwierdzeniem musi powstać osobny opis:

- układ sekcji,
- density,
- zachowanie properties/workflow/actions,
- relacja do `N-mode`,
- co jest wspólne, a co inne,
- kiedy user ma używać `N-mode`, a kiedy `C-mode`,
- jak przełącznik wpływa na URL/state/pamięć użytkownika.

#### Mode switch

Przełącznik `N-mode` / `C-mode`:

- jest częścią standardu artifact work screen,
- znajduje się w stabilnym slocie headera/detail top area,
- używa zatwierdzonego segmented icon control,
- nie może wyglądać jak przypadkowy icon button,
- stan aktywny musi być czytelny,
- zmiana trybu nie może gubić danych ani bieżącej sekcji.

### 9.5 Tool Wizard / Workspace

Dla flow narzędzi:

- `ToolWizardShell`,
- step nav,
- workspace panel,
- 3-tools strip,
- view-local toolbar tylko, jeśli opisany.

### 9.6 Canvas / Board / Timeline

Canvas, board i timeline są view modes, nie osobnymi aplikacjami.

Mogą mieć lokalny toolbar tylko dla kontroli specyficznych dla widoku, np. zoom timeline, lane focus, canvas tools.

Kanban/board view może być zatwierdzonym alternatywnym view mode dla list roboczych, jeśli:

- kolumny odpowiadają statusom lub innym jasnym etapom pracy,
- karty są czytelne i nie przeładowane,
- badge/status/metadata są widoczne,
- gęstość pozwala skanować wiele rekordów,
- view mode nie zastępuje App Table tam, gdzie tabela jest potrzebna,
- przykład pozytywny: `My Work / Decisions` Kanban view.

Timeline view wymaga osobnego standardu przed approvalem.

Timeline nie jest zatwierdzony, jeśli:

- tytuły rekordów są ucinane tak, że nie da się zrozumieć elementu,
- linie i pozycje nie tworzą czytelnej relacji czasu,
- nawigacja/chrome wizualnie się rozpada,
- komponenty osi, kart i labeli nie mają jasnej hierarchii,
- widok wymaga zgadywania zamiast skanowania.

Każdy timeline musi mieć osobny technologiczny plan prezentacji:

- model osi czasu,
- skala i zoom,
- sposób grupowania,
- minimalna czytelna szerokość labela,
- zasady truncation/wrap/tooltip,
- sposób pokazywania statusów i badge,
- zachowanie przy dużej liczbie rekordów,
- empty/loading/error states,
- relacja do App Table i Preview.

## 10. Golden Behavior Standard

### 10.1 Feedback

Każda akcja musi mieć:

- pending/loading,
- success/error,
- visible state update,
- read-back, jeśli zapisuje dane.

### 10.2 Mutacje

Mutacja bez feedbacku jest błędem.

Mutacja krytyczna wymaga:

- confirm lub approval,
- toast/error,
- read-back,
- audit/ledger, jeśli governance.

### 10.3 AI actions

AI actions:

- nie wykonują trwałych zmian po cichu,
- mają proposal/approval/audit dla istotnych mutacji,
- respektują private mode,
- pokazują traceability, sources lub assumptions,
- mają honest provider failure UX.

### 10.4 Save state vs lifecycle

Rozdzielamy:

- `Saved / Saving / Save failed` - trwałość danych,
- `Draft / Review / Approved / Generated / Failed` - lifecycle.

`Saved` nie oznacza approved. `Draft` nie oznacza unsaved.

## 11. Golden Work Standard dla Cursor

### 11.1 Przed pracą UI/UX

Cursor musi:

1. przeczytać ten dokument,
2. sprawdzić Operating Standard,
3. sprawdzić szczegółowy standard obszaru,
4. sprawdzić reference screen,
5. określić target screen type,
6. wskazać komponenty shared,
7. wskazać, czy potrzebny nowy standard.

### 11.2 Podczas implementacji

Cursor nie może:

- wymyślać nowego layoutu,
- tworzyć lokalnych buttonów/cards/tables,
- robić szerokiego refactoru bez planu,
- zmieniać API/routingu/logiki przy refactorze UI,
- mieszać Iris i Consultify,
- tworzyć UI bez empty/loading/error states.

Cursor musi:

- składać UI z zatwierdzonych klocków,
- opisać wyjątki,
- aktualizować dokumentację, gdy tworzy nowy standard,
- zachować workflow użytkownika, jeśli nie ma decyzji produktowej.

### 11.3 Po pracy

Każda zmiana UI/UX wymaga:

- lints/tests, jeśli dotyczy,
- sprawdzenia Definition of Done,
- wskazania standardu, którego użyto,
- aktualizacji audytu/migracji, jeśli dotyczy.

## 12. Golden Migration Standard

Migracja istniejących ekranów odbywa się tylko przez:

1. audyt,
2. target pattern,
3. decyzję komponentów,
4. lokalny plan,
5. refactor,
6. compliance check,
7. aktualizację dokumentacji.

Nie ma promptu:

`popraw UI aplikacji`

Dozwolony prompt:

`Migrate [screen] to Consultify UI/UX Golden Standard using [specific target pattern]. Do not change API, routing, data model or business logic.`

## 13. Golden Definition of Done

Ekran jest zgodny tylko jeśli:

- ma zatwierdzony typ ekranu,
- używa zatwierdzonego shellu,
- używa shared components,
- nie ma niezatwierdzonych toolbarów,
- nie ma one-off UI,
- loading/empty/error/degraded states istnieją,
- actions mają feedback,
- mutacje mają read-back,
- destructive actions mają confirm,
- AI actions nie łamią governance,
- App Table/Preview/N-mode/Workspace spełniają swoje standardy,
- light i dark mode są czytelne,
- brak raw internals,
- odstępstwa są udokumentowane.

## 14. Antywzorce

Zakazane wzorce:

- każdy ekran ma własny header,
- każdy ekran ma własne przyciski,
- lokalna tabela bez App Table decision,
- osobny toolbar "bo brakowało miejsca",
- kolorowe ikony w nawigacji,
- drugi breadcrumb w content area,
- shadow na każdej karcie,
- raw API error w UI,
- fake success toast,
- infinite spinner,
- preview zawsze otwarty bez decyzji,
- AI button w canvasie zamiast Menu 3,
- komponent dodany bez dokumentacji.

## 15. Proces dopisywania standardu

Jeśli w migracji odkryjemy brak standardu:

1. zatrzymujemy implementację w tym zakresie,
2. opisujemy problem,
3. proponujemy standard,
4. zatwierdzamy decyzję,
5. dopisujemy dokumentację,
6. dopiero potem implementujemy.

Nowy standard powinien zawierać:

- nazwę,
- cel,
- kiedy używać,
- kiedy nie używać,
- anatomię,
- zachowanie,
- komponenty,
- przykłady,
- Definition of Done.

## 16. Dokumenty wykonawcze

Ten dokument jest konstytucją. Dokumenty wykonawcze:

- `CONSULTIFY_UI_UX_OPERATING_STANDARD.md`
- `UI_UX_COMPONENT_APPROVAL_AND_MIGRATION_MASTER_PLAN.md`
- `UI_UX_MIGRATION_AUDIT.md`
- `UI_UX_MIGRATION_PLAN.md`
- `UI_UX_REFERENCE_SCREENS.md`
- `FROZEN_LAYOUTS.md`
- `UI_UX_CANON_V3.md`

## 17. Jedno zdanie dla zespołu

> Nie projektuj nowego ekranu. Wybierz zatwierdzony typ ekranu, użyj zatwierdzonego shellu, skomponuj go z zatwierdzonych komponentów i dopisz standard, jeśli czegoś naprawdę brakuje.
