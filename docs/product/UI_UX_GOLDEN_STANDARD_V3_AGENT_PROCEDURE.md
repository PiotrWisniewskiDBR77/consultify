# UI/UX Golden Standard v3 — Agent Procedure (Tables / Cards / Preview)

> **Status:** Canonical runbook (agent-facing)  
> **Cel:** dać agentowi procedurę “krok po kroku”, tak aby wdrożenie **Golden Standard v3** w dowolnym module było **powtarzalne, kompletne i weryfikowalne**.  
> **Nie negocjujemy:** spójności, rytmu spacingu, anatomii preview, braku duplikacji UI, “jednej linii” Command Row.

## Szybki start (10–20 min, bez czytania reszty)

1) **Ustal pattern ekranu**: App Table / Cards(Grid) / Table+Preview (Outlook style).  
2) **Zmapuj 3 warstwy sterowania**: App Topbar (global) → Module Topbar (kontekstowy) → Command Row (1 linia).  
3) **Dopnij Topbar**: prawy klaster w kolejności **AI → Primary CTA → Tools → View → Filters** (dociśnięty do prawej krawędzi).  
4) **Dopnij Command Row**: *jedna linia* i tryby wymieniane “w miejscu”: counters ↔ bulk ↔ search ↔ tabs.  
5) **Table+Preview**: brak `border-l`, separacja tylko spacingiem (`gap-1.5`), preview width `clamp(340px, 28%, 480px)`.  
6) **Preview**: `PreviewPaneShell` + sticky footer zones: **AI hints → divider → relations(2 rows) → divider → actions**.  
7) **DoD**: przejdź checklistę na dole (w tym: *title cell = 1 linia*, parity triage, i18n PL/EN).

## Referencje (SSOT)

- **Golden Standard v3 (kanon + audit checklist)**: `docs/ui-standards/03-modules/golden-standard-table-cards-preview-v3.md`
- **UI/UX Canon v3**: `docs/ui-standards/UI_UX_CANON_V3.md`
- **App Topbar (global) Standard v3**: `docs/ui-standards/01-shell-layout/app-topbar-standard-v3.md`
- **Module hub (kontekstowy topbar + command row)**: `docs/ui-standards/03-modules/module-hub-standard.md`
- **App Table Standard**: `docs/ui-standards/03-modules/app-table-standard.md`
- **Table + Preview Pane Standard**: `docs/ui-standards/03-modules/table-preview-pane-standard.md`
- **Proces (kontekst wdrożeń)**: `docs/product/PROCESS_MYWORK_TO_DELIVERABLES_V3.md`

## Co sprawdzamy na podstawie ekranów (ostatni audit)

Poniższe screenshoty pokazują **docelowy pattern** i jednocześnie typowe miejsca regresji.

- **Tools → Sessions (table baseline)**: `Screenshot_2026-02-28_at_17.28.33-…png`  
  MUST: spójny **układ tabów** (Biblioteka → Sesje → Outputs → Inicjatywy), **gęstość tabeli** (compact), kolumny (Type/Name/Category/Status/Progress/Updated) + kebab actions.  
  Następnie dokładamy Table+Preview wg kanonu Inbox (bez dividera, clamp width, preview actions).
- **Inbox (list)**: `Screenshot_2026-02-28_at_16.04.11-…png`, `…16.04.03-…png`  
  MUST: **jedna linia Command Row**, table surface, preview po prawej, **brak dividera**, stały gap.
- **Inbox (row actions menu / triage)**: `Screenshot_2026-02-28_at_16.04.17-…png`  
  MUST: menu akcji ma komplet triage (Open / Focus / Done / Save / Dismiss / Snooze presets), bez chaosu i bez duplikacji info z preview.
- **Inbox (cards / sections view)**: `Screenshot_2026-02-28_at_16.04.26-…png`  
  MUST: view mode realnie przełącza render, a aktywny stan jest widoczny (tło).
- **Inbox (bulk mode w Command Row)**: `Screenshot_2026-02-28_at_16.04.36-…png`  
  MUST: bulk to tryb tej samej linii (nie dokładamy nowego paska).
- **Task full view (kontrast)**: `Screenshot_2026-02-28_at_16.04.53-…png`  
  MUST: odróżniamy “full detail view” od “table+preview”; parity akcji w preview.

Jeśli którykolwiek z powyższych MUST nie jest spełniony w module, to wdrożenie jest **niekompletne**.

---

## Nazewnictwo UI (obowiązujące w komunikacji i w checklistach)

Używamy tych nazw konsekwentnie w ticketach, review i w kodzie (nawet jeśli komponent ma inną nazwę).

### Mapa layoutu (wizualna)

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  MODULE TOPBAR (context)                    (right: AI → CTA → Tools → View → Filters) │
├──────────────────────────────────────────────────────────────────────────────┤
│  COMMAND ROW (ONE LINE; modes swap in place: tabs / search / counters / bulk) │
├──────────────────────────────────────────────────────────────────────────────┤
│  MAIN CONTENT: Table Canvas  (surface)   gap (shows module bg)   Preview Pane │
│               ┌───────────────┐                               ┌──────────────┐│
│               │ TABLE SURFACE │                               │ PREVIEW SHELL ││
│               └───────────────┘                               │ header/body/  ││
│                                                               │ sticky footer ││
│                                                               └──────────────┘│
└──────────────────────────────────────────────────────────────────────────────┘
```

### Słownik

- **App Topbar (global)**: stały pasek aplikacji (Data/Model/Inbox/Tasks/User).  
- **Module Topbar (context)**: pasek z tabami/surface modułu + prawy klaster narzędzi (AI/CTA/View/Filters).
- **Command Row**: *jedna* linia pod Module Topbar, która przełącza tryby (bez dokładania kolejnych pasków).
- **Table Canvas**: obszar scroll (padding modułu). Nie mylić z Table Surface.
- **Table Surface**: “karta” tabeli (rounded + blur + border).
- **Preview Pane Wrapper**: prawa kolumna, separacja tylko spacingiem (no border line).
- **Preview Shell**: właściwa karta podglądu (`PreviewPaneShell`).
- **Preview Footer (sticky)**: stałe strefy na dole (AI hints → divider → relations (2 rows) → divider → actions).
- **View tool**: przełącznik **view modes** kolekcji (np. table/kanban/timeline/…); standard: **pill dropdown** (ikona + label + chevron).  
- **View mode toggle (binary)**: przełącznik 2-stanowy wewnątrz danego view (np. list ↔ sections/cards); dopuszczalny jako segmented toggle, ale musi mieć czytelny active state (tło).
- **Triage**: szybkie akcje przetwarzania itemu (Done/Save/Dismiss/Snooze/Delegate/…).

---

## Pomiary i stałe odległości (Inbox canonical) — do kopiowania 1:1

Te wartości są **wyciągnięte z aktualnych klas Tailwind** w referencji kanonicznej `MyWork → Inbox` oraz z SSOT layoutu `TableWithPreviewLayout` / `PreviewPaneShell`.

### Measurements quick sheet (do ściągania bez czytania reszty)

| Element | Tailwind / kontrakt | Wartość |
|---|---|---|
| **Layout gap (Table↔Preview)** | `gap-1.5` | **6px** |
| **Preview width** | `clamp(340px, 28%, 480px)` | **min 340px / typ. 28% / max 480px** |
| **Preview wrapper padding** | `p-3` | **12px** |
| **Preview shell body padding** | `p-4` | **16px** |
| **Preview shell footer padding** | `p-4` | **16px** |
| **Table canvas padding (Inbox canonical)** | `pl-4 pr-1.5 pt-3 pb-4` | **16px / 6px / 12px / 16px** |
| **Optyczny gutter (surface↔surface)** | `pr-1.5 + gap-1.5 + p-3` | **~24px** |
| **Pill height (topbar/buttons)** | `h-9` | **36px** |
| **Small pill / row action height** | `h-8` | **32px** |
| **Icon button (table header settings)** | `h-7 w-7` | **28×28px** |
| **Selection column width (checkboxes)** | `w-10` | **40px** |
| **Checkbox size** | `w-5 h-5` | **20×20px** |
| **Table header cell padding** | `px-3 py-2` | **12px / 8px** |
| **Table row cell padding** | `px-3 py-2` (Inbox) | **12px / 8px** |
| **Header row height (praktycznie)** | `py-2` + `text-xs` | **~32px** |
| **Row height (praktycznie)** | `py-2` + `text-sm` | **~36px** |

### Skala Tailwind → px (ściąga)

- `h-9` = **36px** (standard pill height)
- `h-8` = **32px**
- `h-7` = **28px**
- `w-10` = **40px**
- `w-5/h-5` = **20px**
- `p-4` = **16px**
- `p-3` = **12px**
- `py-2` = **8px** (góra + dół)
- `px-3` = **12px** (lewo + prawo)
- `gap-1.5` = **6px**

### Table↔Preview — dystans (gutter), gdy preview jest otwarte

W kanonie nie ma dividera; separacja jest wyłącznie “powietrzem” pokazującym tło modułu.

- **Gap między kolumnami layoutu**: `gap-1.5` → **6px**
- **Table Canvas padding (żeby tabela była “szeroka”)**: `pl-4 pr-1.5 pt-3 pb-4`
  - `pl-4` = **16px**
  - `pr-1.5` = **6px**
  - `pt-3` = **12px**
  - `pb-4` = **16px**
- **Preview wrapper padding**: `p-3` → **12px**

Praktycznie (optycznie, “surface↔surface”):

- **Table Surface right edge → Preview Shell left edge** ≈ `pr-1.5 (6)` + `gap-1.5 (6)` + `preview wrapper left padding (12)` = **~24px** tła modułu.

To jest nasz docelowy rytm w każdym ekranie Table+Preview.

### Table — wysokości wierszy i “lewa kolumna z kwadratami” (selection)

Referencja: `src/components/MyWork/InboxContent.tsx`

- **Header row (sticky)**:
  - `py-2` + `text-xs` (line-height ~16px) → wizualnie **~32px** wysokości
- **Row (standard)**:
  - każda komórka ma `py-2` → **8px top + 8px bottom**
  - tytuł to `text-sm` (line-height ~20px)
  - wizualnie row ma zwykle **~36px** wysokości (bez łamania na 2 linie)
- **Selection column (lewa kolumna z kwadratami)**:
  - szerokość kolumny: `w-10` → **40px**
  - padding komórki: `px-2 py-2` → **8px** dookoła (po osi X liczy się w ramach 40px)
  - checkbox button: `w-5 h-5` → **20×20px**
  - header ma “Select All” w tej samej kolumnie (ten sam wymiar)

Kontrakt:

- klik w checkbox **nie otwiera preview** (stopPropagation) — tylko zaznacza
- multi-select uruchamia **bulk mode w Command Row** (nadal 1 linia, bez nowego paska)

### Preview — stałe komponenty i spacing

SSOT: `src/components/ui/ResizableTable/PreviewPaneShell.tsx`

- **Preview wrapper (prawa kolumna)**:
  - `p-3` → **12px** paddingu od krawędzi modułu do Preview Shell
  - width: `clamp(340px, 28%, 480px)`
- **Preview Shell header**:
  - `px-3 py-2` → **12px** poziomo, **8px** pionowo
  - elementy: **Title (truncate)** + (opcjonalne) header actions + `X`
- **Preview Shell body**:
  - `p-4` → **16px** paddingu
  - zawartość: **Brief/Meta row** + **Details** (z kebabem w nagłówku sekcji)
- **Preview Shell footer (sticky)**:
  - `border-t` + `p-4` → **16px** paddingu
  - stała kolejność stref (MUST):
    1) **AI hints**: zawsze 3 chips + kebab (AI)
    2) divider
    3) **Relations**: miejsce na **2 rzędy** powiązań
    4) divider
    5) **Actions**: pills (z powietrzem między rzędami)

### “Skąd są pola u góry preview” (Meta row — mapowanie danych)

To co na screenach wygląda jak: `Zadanie` / `Critical` / `min temu` / `SLA 1h` to **Meta pills** w Brief/Meta row i powinno być traktowane jako stały komponent preview:

- **Type pill**: typ artefaktu (Task/Decision/…); źródło: encja / mapping modułu
- **Priority/Urgency pill**: krytyczność/priorytet; źródło: encja (np. `priority`, `urgency`)
- **Received/Aging**: “kiedy przyszło” + aging level; źródło: timestamp encji (`receivedAt`, `updatedAt`, zależnie od modułu)
- **SLA pill**: jeśli moduł ma SLA; źródło: pole SLA encji / computed contract

MUST: te informacje **nie mogą się dublować** w AI/Details/Relations — Brief/Meta row jest jedynym miejscem dla “co to jest i jak pilne”.

---

## Mapa kontrolek: przyciski / tabele / preview (zgodnie ze screenami)

Ta sekcja jest Twoją „ściągą rozmieszczenia”: **gdzie** ma być jaka kontrolka i **czego nie mieszać**.

### 0) Reguła rozdziału: sterowanie ekranem vs akcje na encji

- **Sterowanie ekranem** (Topbary + Command Row + View): dotyczy listy jako całości.
- **Akcje na encji**: dotyczy konkretnego wiersza/karty (Row actions menu, Preview actions).

MUST: te dwie rzeczy nie mogą się mieszać w jednym menu.

### 1) App Topbar (global) — nie dotykamy w ramach Golden Standard

App Topbar jest stały (SSOT: `app-topbar-standard-v3.md`) i **nie** jest miejscem na View modes kolekcji ani triage.

### 2) Module Topbar (context) — prawa strona (stała kolejność)

**Kolejność zawsze ta sama (od lewej do prawej w prawym klastrze):**

1) **AI context** (pill)  
2) **Primary CTA (+New / +Assign / …)** (pill)  
3) **Tools (opcjonalnie)** (pill)  
4) **View tool** (pill dropdown: ikona + label + chevron)  
5) **Filters** (pill dropdown/select)

MUST:

- prawy klaster jest **flush right** (dociśnięty do prawej krawędzi),
- view tool nie jest “ikonka bez sensu” — user ma rozumieć, jaki view jest aktywny,
- nie dokładamy “drugich topbarów”.

### 3) Command Row — jedna linia, tryby wymieniane w miejscu

Ten sam obszar pod topbarem służy do (wymiennie, bez dokładania nowych pasków):

- **Counters / status chips** (pills, h-9)
- **Bulk mode**: `X zaznaczonych` + `Zaznacz wszystkie` + `Odznacz` (+ bulk actions jako pills)
- **Search row** (rozszerzona wyszukiwarka)
- **Dynamic document tabs** (jeśli moduł to wspiera)

MUST:

- bulk/search **nie dokładają drugiego paska**,
- wszystkie akcje w command row to **pills** `h-9`,
- command row nie powoduje “skakania” tabeli w pionie.

### 4) Table header (surface) — kontrolki tabeli

- **Table view settings (kolumny)**: icon button (mały, bez tekstu) po prawej w headerze tabeli.
- **Column filters**: w headerach kolumn, nie w osobnym pasku.
- **Actions column header**: bez napisu “Actions”.

### 5) Row actions (⋮) — menu wiersza (triage)

MUST:

- row menu to **kebab (⋮)** w kolumnie akcji (skrajnie po prawej),
- zawiera triage w spójnej kolejności (Open/Focus/Done/Save/Dismiss + Snooze presety),
- **nie zawiera** sterowania widokiem (View).

### 6) Preview — header + body + sticky footer (stałe miejsca akcji)

#### 6.1 Preview header (MUST)

- tytuł 1-liniowy (truncate),
- **Open/Otwórz** jako pill (tekst + ikona),
- **Close (X)** jako icon button.

#### 6.2 Details (MUST)

- sekcja “Szczegóły/Details” ma własny kebab (⋮) po prawej w headerze sekcji.

#### 6.3 Sticky footer zones (MUST)

Kolejność zawsze ta sama:

1) **AI hints**: zawsze 3 chips + kebab (AI)  
2) divider  
3) **Relations**: przestrzeń na **2 rzędy**  
4) divider  
5) **Actions**: pills (z powietrzem między rzędami)

MUST:

- są **dwa kebaby** (Details + AI) i są w stałych miejscach,
- Actions w preview mają parity z row menu (triage).

---

## Co jeszcze warto opisać (na podstawie screenshotów) — typowe braki, które psują wdrożenie

To są elementy, które często “wychodzą bokiem” mimo że UI wygląda prawie dobrze. Jeśli nie są opisane/egzekwowane, kolejne moduły będą się rozjeżdżać.

### 0) Lokalizacja przycisków i ich rodzaj (pills / toggles / kebab) — mapa kanoniczna

Poniższa mapa jest “kontraktem na rozmieszczenie” z perspektywy użytkownika. Agent wdraża standard tak, aby:

- user **zawsze** wie gdzie kliknąć (ta sama pozycja),
- user **zawsze** widzi co jest aktywne (active state ma tło),
- nie mylimy “sterowania widokiem” z “akcjami na encji”.

#### Typy przycisków (nazwy + formy)

- **Pill button**: `h-9 rounded-full` (tekst + ikonka opcjonalnie); hover = tylko tło.
- **Icon toggle (segmented)**: 2–3 ikonowe przyciski w “kapsule” (container też jest pill). Każdy segment ma aktywny stan z tłem.
- **Icon button (utility)**: mały przycisk bez tekstu (np. settings w headerze tabeli), typowo `h-7 w-7`.
- **Kebab (⋮)**: overflow menu; zawsze pionowy (nie “…” poziome).

#### A. Module Topbar (context) — prawa strona (stała kolejność)

**Kolejność zawsze ta sama (od lewej do prawej w prawym klastrze):**

1) **AI** (pill button, wyróżniony kolorem)
2) **Primary CTA** (np. “Nowe …” / “Dodaj …”) — pill button
3) **Tools** (jeśli dotyczy) — pill button / icon toggle (np. workspace tools)
4) **View** — dwa pojęcia (nie mylić):
   - **View tool (kolekcja)**: standardowo **pill dropdown** (ikona + label + chevron) dla view modes typu table/kanban/timeline/…  
     (SSOT: `docs/ui-standards/03-modules/view-modes-standard.md`)
   - **View mode toggle (binary)**: dopuszczalny tylko dla 2-stanowych przełączeń *wewnątrz* view (np. list ↔ sections/cards).  
     MUST: aktywny segment ma tło (czytelne na dark theme), a przełączenie realnie zmienia render (screeny `…16.04.11…`, `…16.04.26…`).
5) **Filters** (dropdown/select jako pill, h-9)

MUST:

- view tool/mode ma **widoczny active state** (tło/obrys) — na dark theme też,
- elementy nie zmieniają kolejności między tabami (tylko się pojawiają/ukrywają).

#### B. Command Row — jedna linia, 4 tryby

W tym samym miejscu (jedna wysokość) wymiennie pojawiają się:

- **Counters / status chips** (pills, h-9)
- **Bulk mode**: `X zaznaczonych` + `Zaznacz wszystkie` + `Odznacz` (+ bulk actions jako pills)  
  (screen `…16.04.36…`)
- **Search row** (rozszerzona wyszukiwarka; screen `…16.04.42…`)
- **Dynamic document tabs** (jeśli dotyczy)

MUST:

- bulk/search **nie dokładają drugiego paska**,
- wszystkie akcje w command row to **pills** `h-9`.

#### C. Table header (surface) — gdzie są kontrolki tabeli

- **Table view settings** (kolumny): **icon button** (mały, bez tekstu) w headerze tabeli po prawej stronie.
- **Column filters**: w headerach kolumn (ikony/controls w obrębie komórki headera), nie w osobnym pasku.
- **Actions column header**: bez napisu “Actions”.

#### D. Row actions (⋮) — menu wiersza

Na screenie `…16.04.17…` widać menu akcji wiersza jako “drugi tor” do triage.

MUST:

- **Row menu** to **kebab (⋮)** w kolumnie akcji (skrajnie po prawej wiersza),
- zawiera triage (Done/Save/Dismiss/Reject/Snooze presets + opcjonalnie Focus) w spójnej kolejności,
- **nie zawiera** sterowania widokiem (view mode).

#### E. Preview — header + footer (stałe miejsca akcji)

- **Preview header (prawy górny róg)**:
  - **Open/Otwórz**: pill (tekst + ikona)
  - **Close (X)**: icon button
- **Details kebab (⋮)**: w nagłówku sekcji “Szczegóły/Details”, po prawej, na tej samej linii co tytuł sekcji.
- **AI kebab (⋮)**: w strefie AI hints, po prawej, na tej samej linii co “AI”.
- **Footer actions**: pills, z powietrzem między rzędami; to jest główne miejsce triage, ma być “above the fold”.

MUST:

- są **dwa kebaby** (Details + AI) i są w stałych miejscach,
- Open jest zawsze tekstowe (nie “goła ikonka”).

### 0a) Topbar — prawy klaster MUSI być “flush right” (błąd z ekranu)

Na screenie z topbarą widać typowy błąd: przyciski w prawym klastrze (AI / CTA / View) **nie siedzą przy prawej krawędzi** i sprawiają wrażenie “pływających”.

MUST:

- prawy klaster jest **wyrównany do prawej krawędzi** topbara (`justify-end`, brak dodatkowych “pustych” marginesów),
- AI nie może “uciekać” do lewego klastra — **AI jest elementem prawego klastra** (tam gdzie CTA i View),
- jeśli na ekranie są tylko 2–3 kontrolki (np. `AI`, `+ Przydziel`, `View mode`), to one również muszą być **w prawym górnym rogu**.

Checklist (dla implementacji):

- [ ] kontener prawego klastra ma `ml-auto` i `justify-end`
- [ ] ostatnie kontrolki (najbliżej prawej krawędzi) to **View** i/lub **Filters** (jeśli są na ekranie)
- [ ] CTA (np. `+ Przydziel`) jest pill `h-9 rounded-full` i jest w prawym klastrze

### 1) View mode toggle (List ↔ Cards/Sections) — 3 najczęstsze regresje

- **Regresja A**: kontrolka ma aktywny stan, ale render zawsze pokazuje jeden widok (state zmienia się, JSX nie).  
  MUST: `viewMode === 'sections' ? renderSections() : renderFlat()`.
- **Regresja B**: aktywny stan jest “bez tła”, więc nie widać co wybrane (na dark theme znika).  
  MUST: aktywny button ma `bg-*` + (opcjonalnie) subtelny border/inner shadow.
- **Regresja C**: po przełączeniu na Cards/Sections znika preview/selection albo przestaje działać single-click.  
  MUST: klik w kartę = selection + preview (jeśli ekran ma preview), a nie nawigacja.

### 2) Cards/Sections view — co musi zostać spójne z tabelą

Na screenie (sections/cards) widać **grid kart** po lewej i preview po prawej.  
MUST:

- preview działa identycznie jak w tabeli (open/close, parity akcji),
- tło kart jest neutralne; kolor to tylko sygnał (accent / tekst typu),
- nie dokładamy nowych pasków filtrów “specjalnie dla kart” — nadal topbar/command row.

### 3) Row actions menu (⋮) — komplet triage i spójność z preview

Na screenie menu wiersza ma zestaw akcji (Open, Focus, Done, Save, Note, Dismiss/Reject, Snooze presets).  
MUST:

- **Parity**: te same klasy akcji muszą być dostępne w preview footer (Actions) i w menu wiersza,
- Snooze ma presety (np. 2h / tomorrow / 3d / next Monday),
- Menu nie może mieszać “trybów widoku” z “akcjami na encji” (to różne rzeczy).

### 4) Bulk selection — UX kontrakt (1 linia, zero dodatkowych pasków)

Na screenie bulk działa jako tryb Command Row (tekst typu “1 zaznaczonych / Zaznacz wszystkie / Odznacz”).  
MUST:

- bulk nie dokłada osobnego rzędu pod command row,
- checkbox click nie otwiera preview,
- bulk actions są pills (h-9) i mieszczą się w tej samej linii (overflow-x jeśli trzeba).

### 5) Search row — też jest trybem Command Row

Na screenie widać “rozszerzoną” wyszukiwarkę jako osobny stan w tym samym miejscu co counters/bulk.  
MUST:

- search nie rozpycha layoutu w pionie poza przewidzianą wysokość,
- przejście search ↔ counters ↔ bulk nie powoduje “skakania” tabeli.

### 6) Preview footer — stała wysokość Relations (2 rzędy) + “powietrze” w Actions

Typowa regresja: footer robi się “zbyt niski”, relacje nie mieszczą 2 rzędów, a akcje są “na styk”.  
MUST:

- Relations ma stałą przestrzeń na 2 rzędy (jak w kanonie),
- między dividerami a przyciskami jest równy rytm (padding + `space-y-*`).

### 7) “Preview open” nie może zmieniać rytmu tabeli (gutter podwójny)

Typowa regresja: ktoś doda `pr-4` i jednocześnie `ml-2`/`border-l`, robi się “dziura”.  
MUST:

- `gap-1.5` jako jedyna separacja,
- table canvas `pr-1.5` (w Inbox canonical) żeby nie dublować odstępów.

### 8) Table title cell — zawsze 1 wiersz (bez “drugiej linijki” pod tytułem)

To jest dokładnie błąd, który opisałeś: w tabeli widać **2 linie** (tytuł + “wyjaśnienie” pod tytułem). To psuje rytm, zwiększa wysokość wiersza i sprawia wrażenie bałaganu.

MUST:

- w komórce tytułu w tabeli pokazujemy **tylko 1 linię tytułu** (`truncate`), bez stałego “podpisu” pod spodem,
- jeśli potrzebujemy dodatkowej informacji (np. reason, hint, keyboard help), to:
  - albo jest to **mały inline pill** obok tytułu (na tej samej linii),
  - albo **tooltip / menu / popover**,
  - ale **nigdy** “druga linia tekstu” pod tytułem (nawet na hover).

Checklist (dla implementacji):

- [ ] title ma `truncate` i nie wrapuje
- [ ] brak elementów typu `mt-*` + `block`/`inline-flex` renderowanych pod tytułem (które tworzą drugi wiersz)
- [ ] skróty klawiaturowe są dostępne przez `?` (toast/help), nie w tabeli pod tytułem

## Procedura wdrożenia (kompletna, krok po kroku)

### 0) Zdefiniuj “jaki to jest ekran” (wybór patternu)

Ustal jednoznacznie, czy ekran ma być:

- **A. App Table** (tylko tabela)  
- **B. Cards/Grid** (tylko karty)  
- **C. Table + Preview (Outlook style)** (tabela + preview po prawej; to jest nasz kanon dla Inbox/Assignments)

Jeśli ekran ma zarówno listę jak i karty: to nadal jest **App Table** + **Cards/Grid**, a “preview” to osobna decyzja (zwykle: C).

### 1) Podłącz się do SSOT komponentów (bez duplikowania UI)

MUST: preferuj istniejące komponenty:

- **Table hub**: `src/components/shared/ModuleHub/FilterableTable.tsx`
- **Cards**: `src/components/shared/ModuleHub/GridView.tsx`
- **Table+Preview**: `src/components/shared/TableWithPreviewLayout.tsx` + `src/components/ui/ResizableTable/PreviewPaneShell.tsx`

Jeśli moduł ma własny “custom table” – najpierw zrób minimalny refactor tak, aby:

- dało się utrzymać standard spacingu, gapu, preview width,
- dało się włączyć preview bez dodatkowych dividerów i “doklejanych” marginesów,
- dało się utrzymać table settings modal + kebab column.

---

## Narzędzia → Sesje (Tools Hub) — target layout (konkret)

To jest moduł, o który pytasz: przebudowujemy “Sesje” tak, aby wyglądały jak Golden Standard v3 (tabela + preview), z zachowaniem układu tabów z referencyjnego ekranu Tools.

### Pattern

- **Library**: table/grid bez preview (to jest katalog)
- **Sessions**: **Table + Preview (Outlook style)**
- **Outputs**: **Table + Preview (Outlook style)** (to nadal są sesje, tylko w innych statusach)
- **Initiatives**: **Open full view on click** (preview opcjonalny — jeśli brak gotowego preview, nie udawaj)

### Topbar (Level 2)

- **Tabs (kolejność stała)**: **Biblioteka → Sesje → Outputs → Inicjatywy**
- **Prawy klaster (kolejność stała)**: **AI → Primary CTA → Tools → View tool → Filters**  
  Jeśli dany element nie dotyczy (np. brak CTA w danej zakładce), to go ukrywamy, ale **nie zmieniamy kolejności pozostałych**.

### Tabela (Sessions/Outputs)

- **Kolumny (docelowo)**: `Type` / `Name` / `Category` / `Status` / `Progress` / `Updated` + **kebab actions (⋮)**
- **Density**: `compact` (rytmy jak na screenie Tools)
- **Canvas padding (gutter jak Inbox)**: `pl-4 pr-1.5 pt-3 pb-4`

### Preview (Sessions/Outputs)

- **Layout**: `TableWithPreviewLayout`  
  MUST: `gap-1.5`, preview wrapper `p-3`, width `clamp(340px, 28%, 480px)`, **bez `border-l`**
- **Header**: title (truncate) + **Open** (text pill) + **X**
- **Body**: metadane sesji (Status, Created, Last modified, Current step, Progress)
- **Footer actions**:
  - Sessions (DRAFT/REVIEW): **Resume wizard** (pill)
  - Outputs (APPROVED/DONE): footer może być pusty (Open jest w headerze)

### Interactions (MUST)

- **Single click row**: selection + open preview
- **Double click / Enter**: open full
- **Esc**: close preview

### 2) Ustaw Module Topbar (context) — kolejność i rytm

MUST:

- **Prawy cluster zawsze w tej kolejności**: **AI → Primary CTA → Tools → View tool → Filters**
- Wszystko jako **pills**: `h-9` + `rounded-full`
- Hover = tylko tło (bez agresywnych borderów)

Weryfikacja:

- Czy da się jednym spojrzeniem znaleźć “Open / New / View / Filters”?
- Czy żaden element nie “przeskakuje” layoutu po zmianie tabów?

### 3) Zbuduj Command Row jako “jedną linię, 4 tryby”

MUST: ta sama przestrzeń UI obsługuje:

- **Dynamic docs tabs** (otwarte dokumenty)
- **Search expanded row**
- **Counters / status chips** (np. Open/Done/Saved/All + kontekstowe)
- **Context action bar (bulk selection)** — *w tej samej linii*

Anti-pattern (zakaz):

- dokładanie “kolejnego paska” pod command row,
- dokładanie dodatkowego “bulk bar” jako osobny wiersz.

Weryfikacja na ekranach:

- w trybie bulk command row pokazuje `X zaznaczonych…` (jak na `…16.04.36…png`) i nie dubluje counters.

### 4) View — ma działać i ma być czytelne “co jest aktywne”

MUST:

- **Aktywny stan ma tło** (w dark theme też), żeby było widać co wybrane.
- Klik w view mode **musi zmieniać render** (to jest częsta regresja: state się zmienia, ale JSX renderuje zawsze ten sam widok).

Checklist implementacyjny (żeby nie zepsuć):

- [ ] istnieje `viewMode` state (controlled/uncontrolled)  
- [ ] kontrolka zmiany widoku wywołuje setter (`setViewMode(...)`)  
- [ ] w renderze jest realny switch:
  - `viewMode === 'cards' ? renderCards() : renderTable()`
  - `viewMode === 'sections' ? renderSections() : renderFlat()`
- [ ] w trybie cards/sections nadal działa selection/preview (jeśli ekran ma preview)

### 5) Table (surface, header, settings)

MUST:

- Table Surface jako karta: `rounded-xl` + `bg-white/70 dark:bg-navy-900/70` + `backdrop-blur` + subtelny border
- Header: `text-[11px] uppercase tracking-wider` (spójny rytm)
- **Actions column**: bez etykiety “Actions”, na końcu kebab (⋮)
- **Table settings modal**: Reset/Done jako pills, persist per view

### 6) Table + Preview — layout i spacing (to jest najczęściej popsute)

MUST:

- Preview width: `clamp(340px, 28%, 480px)`
- Separacja table↔preview: **tylko spacing** (`gap-1.5`), **bez** `border-l`
- **Optyczny gutter** (rytmy jak na kanonicznym Inbox):
  - table canvas: `pl-4 pr-1.5 pt-3 pb-4`
  - gap: `gap-1.5`
  - preview wrapper: `p-3` na tle modułu

Weryfikacja:

- Czy “karta tabeli” wizualnie zajmuje tyle miejsca co powinna, a przerwa do preview nie jest “podwójna” (padding + gap)?
- Czy rytm paddingu pasuje do rytmu pod topbarem (to co widzisz na screenach Inbox)?

### 7) Preview anatomy (header / brief / details / footer zones)

MUST: preview ma stałe strefy i nie dubluje informacji.

#### 7.1 Header (MUST)

- 1-liniowy tytuł (truncate)
- przycisk **Open/Otwórz** (tekst + ikona)
- `X` zamyka preview

#### 7.2 Brief / Meta row (MUST)

Cel: “co to jest i czemu ważne” w 1 rzędzie.

- typ artefaktu (pill)
- priorytet / urgency (pill)
- received/aging
- SLA (jeśli dotyczy)
- (opcjonalnie) **Why am I seeing this?** jako krótka, *nieinwazyjna* informacja (bez duplikowania w AI).

#### 7.3 Details (MUST)

Details to **AI-prepared brief** (jeśli moduł ma AI assist), albo najlepszy dostępny opis.

- kebab (⋮) w headerze sekcji:
  - Rozwiń / Expand
  - Podsumuj / Summarize
  - Kopiuj / Copy
- wygenerowany tekst **persistuje** do zmiany itemu

#### 7.4 Footer (sticky) — stałe strefy (MUST)

Kolejność zawsze ta sama:

1) **AI hints**  
   - zawsze 3 chips (outline-only) + kebab (AI)  
   - bez wielkiego CTA “Generuj”
2) **Divider**
3) **Relations**  
   - 2 rzędy (stała wysokość)  
   - relacje jako “tablets/pills” (tekst w kolorze typu encji; bez kolorowego tła)
4) **Divider**
5) **Actions**  
   - pills, z “powietrzem” między rzędami  
   - w Inbox: triage (Done/Save/Dismiss/Snooze/Delegate/…) ma być dostępne bez scrolla

### 8) Triage (Inbox / Assignments) — komplet akcji i brak chaosu

MUST:

- triage ma być dostępne z row actions menu i z preview footer actions (parity)
- snooze ma presety (np. 2h / tomorrow / 3d / next Monday)
- żadnych “system alarmów” dublowanych w 3 miejscach

Weryfikacja na screenie `…16.04.17…png`:

- menu pokazuje logiczne akcje i nie miesza różnych klas czynności (np. “focus” vs “done” vs “snooze”).

### 9) Kontrakty zachowań (keyboard + navigation)

MUST:

- single click row → selection + open preview
- double click / Enter → open full
- Esc → close preview

### 10) Definition of Done (DoD) — test plan dla agenta (obowiązkowe)

Agent nie kończy pracy, dopóki nie spełni checklisty:

- [ ] View: aktywny stan czytelny + realnie przełącza render
- [ ] Topbar: prawy klaster **flush right** (CTA + View przy prawym rancie, bez “pływania”)
- [ ] Command Row: jedna linia, 4 tryby, bulk bez dodatkowego paska
- [ ] Table Surface: standardowe tło/blur/border/rounded, header typography, kebab
- [ ] Table rows: **title cell = 1 linia** (bez opisu/wyjaśnienia pod tytułem; stabilna wysokość wiersza)
- [ ] Preview: width clamp, gap bez dividera, preview shell, sticky footer zones
- [ ] Preview anatomy: header, brief/meta, details (kebab), AI hints (3 chips + kebab), relations (2 rows), actions (pills)
- [ ] Spacing/gutter: table canvas `pl-4 pr-1.5 pt-3 pb-4`, gap `gap-1.5`, preview wrapper `p-3`
- [ ] i18n: PL/EN (z `useTranslation`)
- [ ] Brak regresji TS: `npx tsc --noEmit` przechodzi

---

## Szablon “planu pracy” dla nowego agenta (do skopiowania)

Wklej poniżej i uzupełnij dla modułu:

1) **Audit**: znajdź entry component (hub) i oceń: Table / Cards / Table+Preview + które SSOT komponenty są użyte.  
2) **Topbar + Command Row**: dopasuj kolejność narzędzi, one-line command row (4 modes).  
3) **View tool**: aktywny stan + switch w renderze (list/cards/sections).  
4) **Table**: surface, header, settings modal, kebab actions, selection/preview behavior.  
5) **Preview**: width clamp, no divider, sticky footer zones, 2 kebabs, AI hints/relations/actions.  
6) **Spacing**: gap + canvas padding (gutter).  
7) **Verification**: keyboard contract + bulk mode + typecheck.  
8) **SSOT update (jeśli potrzebne)**: dopisz brakujące MUST do `golden-standard-table-cards-preview-v3.md` (bez wymyślania nowych patternów).

---

## Applied example — Narzędzia → Outputs (Tools Hub)

Ten przykład pokazuje, jak zastosować procedurę “Table + Preview (Outlook style)” w module `Narzędzia`, zakładka `Outputs`.

- **Entry / hub**: `src/components/Discovery/DiscoveryToolsHub.tsx` (tab `outputs`)
- **MUST: Table + Preview = SSOT layout**: użyj `src/components/shared/TableWithPreviewLayout.tsx` (gap `gap-1.5`, preview wrapper `p-3`, width `clamp(340px, 28%, 480px)`)
  - Anti‑pattern (zakaz): “fixed side panel” z `border-l` doklejany do prawej krawędzi
- **Table canvas padding (gutter)**: ustaw `pl-4 pr-1.5 pt-3 pb-4` po stronie tabeli (żeby nie kumulować odstępów przy otwartym preview)
  - Praktycznie: `FilterableTable` wspiera `canvasClassName` + `density="compact"`
- **Preview anatomy**:
  - header: `Open` (tekstowy pill) + `X`
  - body + footer zones: `ToolSessionPreviewV3Body` / `ToolSessionPreviewV3Footer` (`src/components/DiscoveryTools/ToolSessionPreviewV3.tsx`)
  - dane do “Details / Relations”: dociągane przez `Api.getToolSession(id)` przy selekcji wiersza (tylko taby `Sessions`/`Outputs`)

