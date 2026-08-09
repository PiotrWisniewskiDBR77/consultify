# My Work Table Surface Contract v1

Status: **CLOSED / NORMATIVE**  
Data: 2026-08-05  
Zakres: web/desktop; tabela, preview, kebab, menu kontekstowe prawego kliknięcia oraz Menu 1/2/3.

## 0. Pierwszeństwo i reguła kompletności

Ten dokument rozstrzyga sprzeczności istniejących opisów dla powierzchni tabelowych. W zakresie wymienionym powyżej ma pierwszeństwo przed starszymi fragmentami `TRIADA_KANON.md`, `TABLE_AND_PREVIEW_CANON.md`, `KEBAB_MENU_STANDARD.md`, `TABLE_AUDIT_SHEET_TEMPLATE.md` i `UI_UX_IMPLEMENTATION_STANDARD.md`.

Kontrakt jest kompletny, gdy dla każdej funkcji określa:

1. czy jest obowiązkowa, warunkowa czy niedozwolona;
2. jedno kanoniczne miejsce;
3. anatomię i mierzalny wygląd;
4. zachowanie myszy i klawiatury;
5. stany loading/empty/error/disabled;
6. źródło danych i persystencję;
7. wymagany dowód odbiorowy.

Brak funkcji nie może być zamaskowany pozycją `Coming soon`. `N/D` wymaga jawnej deklaracji capability encji.

## 1. Deskryptor możliwości — obowiązkowy przed implementacją

Każda tabela deklaruje jeden deskryptor:

```ts
type TableSurfaceCapabilities = {
  id: string;
  entity: string;
  hasTable: true;
  selection: 'bulk' | 'none';
  preview: true;
  fullOpen: true;
  edit: 'supported' | 'permission-dependent' | 'not-applicable';
  archive: 'supported' | 'not-applicable';
  delete: 'supported' | 'business-locked';
  dueDate: boolean;
  contextTransitions: string[];
  viewModes: Array<'list' | 'grid' | 'kanban' | 'calendar' | 'timeline'>;
  menu3Presets: string[];
  bulkActions: string[];
  persistKey: string;
};
```

Reguły:

- powierzchnia bez `hasTable: true` nie jest liczona jako tabela;
- `selection: none` jest legalne wyłącznie z uzasadnieniem produktowym; wtedy nie ma checkboxów ani formuły bulk;
- funkcja `not-applicable` jest pomijana, a nie renderowana jako atrapa;
- funkcja wspierana, ale niedostępna dla konkretnego rekordu/użytkownika, pozostaje widoczna jako
  disabled: wyraźnie jaśniejsza/wyciszona i nieaktywna, bez dopisywania komentarza w menu; przyczyna
  pozostaje zapisana w deskryptorze capability i dostępna dla audytu;
- `Coming soon`, `Wkrótce` i pusty handler są niedozwolone w produkcyjnym menu.

## 2. Menu 1 — pasek kontekstu aplikacji

Menu 1 to poziomy pasek nad Menu 2. Sidebar nie jest Menu 1.

### Anatomia

- lewa: breadcrumb `My Work › aktywna zakładka`;
- prawa: Data → Model → ikony systemowe → profil;
- brak akcji domenowych tabeli;
- jeden rząd, stała wysokość aplikacyjna.

### Zachowanie

- breadcrumb i aktywny content zawsze są zgodne;
- preview nie zmienia breadcrumb;
- pełne Open może dodać poziom obiektu tylko zgodnie z router contract;
- elementy systemowe zachowują kolejność na każdej zakładce.

## 3. Menu 2 — nawigacja i kontrola widoku

### Lewa strona

1. Search toggle — jeżeli wyszukiwanie jest dostępne;
2. zakładki modułu w stabilnej kolejności.

Każda kontrolka: `h-9` = 36 px, `rounded-full`, border, `px-3`, gap 8 px, ikona 16 px, label 14 px medium. Aktywna zakładka ma neutralne wypełnienie. Menu 2 nigdy nie pokazuje liczników.

### Prawa strona — kolejność od lewej do prawej

1. maksymalnie jeden złożony `Filters` dropdown — tylko gdy potrzebny;
2. segment view modes — tylko gdy istnieją co najmniej dwa widoki;
3. najwyżej jedno narzędzie domenowe;
4. primary CTA;
5. Area/panel toggle — tylko jeśli jest częścią globalnego layoutu modułu.

Z perspektywy prawej krawędzi kolejność jest odwrotna: Area → CTA → Tool → Views → Filters.

### Zakazy

- liczniki;
- więcej niż jeden primary CTA;
- search input, foldery, status presets lub bulk actions w prawym klastrze;
- dropdown `Table` zamiast segmentu ikonowego;
- view modes w Menu 3;
- ten sam filtr w więcej niż jednym miejscu.

## 4. Menu 3 — dokładnie jeden dynamiczny command row

Geometria: jeden rząd, `px-4 py-2`, odstęp do tabeli 8 px. Chip filtra: `h-7` = 28 px, `px-2.5`, 11 px, pill, border. Przycisk bulk: `h-8` = 32 px, pill, border, ikona+label.

Priorytet stanów: `bulk > open tabs > filters`.

### Formuła 1 — filters

- po lewej counter-chipy presetów i scope;
- każdy chip ma licznik, również 0;
- aktywny chip ma neutralne wypełnienie i reset;
- po prawej najwyżej pięć akcji całego zbioru/AI, reszta w overflow;
- licznik wyniku aktualizuje się po zmianie filtra.

### Formuła 2 — bulk

Występuje tylko dla `selection: bulk`.

- pojawia się natychmiast po zaznaczeniu;
- lewy klaster: `N selected` → `Clear` z ikoną X → akcje wspólne → akcje kontekstowe → danger na końcu;
- wszystkie przyciski mają ten sam outline shell;
- zawsze istnieje co najmniej jedna realna akcja poza Clear;
- mieszane statusy pokazują część wspólną bezpiecznych akcji;
- danger wymaga confirmation;
- Clear przywraca formułę 1.

### Formuła 3 — open tabs

- single-click wiersza otwiera preview i nie tworzy taba;
- Open otwiera pełny obiekt oraz trwały tab;
- tab ma ikonę, realny tytuł i ×;
- × zamyka tab i przywraca listę bez utraty filtrów, sortu i scrolla;
- jeśli jednocześnie istnieje selection, bulk ma pierwszeństwo wizualne, ale nie usuwa otwartych tabów ze stanu.

## 5. Tabela

### Obowiązkowa anatomia

- Settings2 w prawym górnym rogu;
- checkbox header+row dla `selection: bulk`; brak obu dla `selection: none`;
- pierwsza kolumna danych identyfikuje rekord i jest elastyczna;
- kebab jest ostatnią kolumną i jest wyrównany do prawej;
- nagłówek sticky: 11 px, 600, uppercase, muted, hairline;
- wiersze bez zebry i bez statusowego tła, oddzielone hairline;
- tytuł 14 px semibold; opis 11 px muted, max 2 linie;
- pusta komórka zawsze `—`;
- liczby wyrównane do prawej z tabular-nums;
- status: neutralny shell + kropka; priorytet: kropka + tonowany tekst.

### Kompletność informacyjna kolumn

Każda tabela deklaruje minimalny zestaw kolumn domenowych potrzebnych do identyfikacji, porównania
i obsługi rekordów bez otwierania każdego z nich. Zestaw ma być możliwie mały, lecz informacyjnie
kompletny. Brak właściwości kluczowej dla decyzji użytkownika jest FAIL tak samo jak brak elementu
graficznego. Przykład: Materials musi jawnie pokazywać format/typ Word, PDF, Excel, Presentation itd.;
sam tytuł materiału nie wystarcza. Kolumny techniczne, redundantne i nieprzydatne do decyzji na
liście są niedozwolone. Deskryptor tabeli zapisuje kolumny required, optional i available-in-preview.

Widok zaklasyfikowany jako TABLE zawiera Menu 1/2/3, tabelę i opcjonalnie otwarte preview. Między
Menu 3 a tabelą nie umieszcza się wykresów, KPI, symulacji, dashboardowych kart, formularzy ani
drugiego toolbara. Takie treści są osobną zakładką, osobnym view mode albo pełnym narzędziem.

### Wymiary i mechanika

- komórki `px-3 py-2.5`; tytuł `py-3`; checkbox `px-2 py-2.5`;
- wysokość wiersza jest stabilna dla włączonego/wyłączonego opisu;
- tytuł może mieć maksymalnie 2 linie, ale pełna wartość ma accessible name/tooltip;
- resize jest zero-sum i persystowany;
- widoczność oraz kolejność kolumn są persystowane przez `persistKey`;
- sort klikiem nagłówka; filtr per kolumna dla skończonej taksonomii;
- jeden scroll container; sticky nie może mieć przodka `overflow:hidden`.

### Interakcja

- single-click: select active record + preview, bez zmiany URL;
- checkbox: wyłącznie selection bulk, nie otwiera preview;
- Enter/double-click: pełne Open;
- prawy klik: menu kontekstowe dla wskazanego rekordu;
- hover, active record i bulk selection są trzema rozróżnialnymi stanami.

### Settings2

- trigger 32×32 px, ikona 16 px;
- portalowy popover `VISIBLE COLUMNS`;
- kolumna identyfikatora oraz Actions są Required/locked;
- `Show row description` jest ostatnim elementem;
- widoczność, opis i kolejność działają oraz są persystowane.

### Stany

- loading zachowuje liczbę i przybliżone szerokości kolumn;
- empty rozróżnia brak danych od braku wyniku filtra i ma sensowne CTA/reset;
- error ma opis i Retry;
- żaden stan nie jest pustą powierzchnią.

## 6. Preview

Preview jest obowiązkowe dla każdej powierzchni zaklasyfikowanej jako tabela.

### Kontener i otwieranie

- domyślnie zamknięty;
- single-click otwiera bez zmiany URL, filtrów i scrolla;
- szerokość `clamp(340px, 28%, 480px)`;
- gap od tabeli 6 px; brak własnego border-left;
- Esc i × zamykają, focus wraca do rekordu.

### Sześć bloków w stałej kolejności

1. header: tytuł → pin → Open → ×;
2. Meta: status/priorytet/ważność, termin po prawej, rekomendacja jeśli istnieje;
3. Details: proza lub properties oraz lokalny kebab Copy/Export/Download;
4. AI: osobna karta, jeśli encja deklaruje realne akcje AI;
5. Relations: relacje lub kanoniczne `No relations`;
6. Actions: realne akcje rekordu w siatce dwóch kolumn.

AI może być pominięte, jeśli deskryptor nie deklaruje żadnej realnej akcji. Pozostałe bloki są obowiązkowe; Details i Relations pokazują kanoniczny empty state.

### Szczegóły

- w całym preview istnieje dokładnie jeden Open — w headerze;
- tytuł może być skrócony wizualnie, ale pełny tekst jest dostępny;
- word count dotyczy wyłącznie prozy i znika dla properties/list/empty;
- properties używają tabeli klucz–wartość;
- eksporty występują wyłącznie w kebabie Details;
- action button: 36 px, pill, border, ikona+label; najwyżej jeden primary;
- wariant wynika ze skutku: positive, destructive, warning, neutral;
- pojedyncza realna akcja zajmuje pierwszą kolumnę siatki; nie wolno dodawać
  atrapy do drugiej kolumny ani zmieniać `destructive` w dominujący primary;
- brak dividerów pomiędzy kartami; spacing 10 px;
- loading/error preview nie zmienia geometrii tabeli.

### Kontrakt graficzny preview

Preview wypełnia wysokość obszaru roboczego tabeli. Wrapper ma `p-3` (12 px), odstęp między
kartami 10 px, gap od tabeli 6 px i neutralne tło robocze. Każda karta ma 100% szerokości,
`radius 12px`, border 1 px `--c-border-subtle`, tło `--c-surface`, padding 12 px i bez ciężkiego
cienia. Nie stosuje się pionowego `border-left` ani dividera między każdą kartą.

| Blok | Wysokość / zakres |
|---|---:|
| Header | 52 px |
| Meta | 88 px |
| Details | min. 200 px; preferowane 220–280 px; elastyczne |
| AI | 76 px, tylko gdy istnieją realne akcje AI |
| Relations | 64 px |
| Actions | ok. 60 / 106 / 152 px dla 1 / 2 / 3 rzędów |

Brak AI nie zostawia pustego slotu — przestrzeń przejmuje Details. Header i Meta pozostają
stabilne, Details dostaje kontrolowany scroll przy długiej treści, a Actions pozostaje osiągalne.
Przy małej wysokości dopuszczalny jest jeden scroll całego panelu; nie wolno tworzyć podwójnego
scrolla strony.

#### Header

Układ: `tytuł → elastyczna przestrzeń → Pin → Open → ×`. Tytuł: Inter 14 px semibold, jedna
linia, truncate, pełny accessible name/tooltip. Pin i × mają target 32×32 px; Open ma h-8;
ikony 16 px; gap kontrolek 4 px. Kanoniczne ikony: `Pin`, `ArrowUpRight`, `X`. Open występuje
dokładnie raz w całym preview.

#### Meta

Pierwszy rząd ma 28 px i zawiera po lewej status, priorytet oraz opcjonalnie ważność/typ, a po
prawej termin albo najważniejszą wartość czasową. Chip: h-6 (24 px), pill, 11 px, gap 6 px,
kropka 6 px. Drugi rząd zawiera rekomendację lub najważniejszy kontekst: 11–12 px, maks. 2 linie,
zalecane 8–18 słów, twarde maksimum 24 słowa. Nie generuje się tekstu tylko po to, aby wypełnić
kartę.

#### Details

Nagłówek Details ma 28 px: label 11 px semibold uppercase, opcjonalne `~N words` 11 px muted
i lokalny kebab 28×28 px z ikoną 16 px. Treść zaczyna się 8 px niżej.

- proza: 80–140 słów, miękkie maksimum 160, font 13 px, line-height 20–21 px, 2–3 krótkie
  akapity; powyżej limitu scroll lub `Show more`; word count widoczny;
- properties: 5–8 najważniejszych właściwości, rząd 28–32 px, label 11 px muted, wartość
  12–13 px; bez word count;
- file-list: maks. 5 pozycji bez scrolla, ikona formatu 16 px, nazwa, format i opcjonalnie rozmiar;
  nadmiar przez `Show all N`; bez word count;
- lokalny kebab Details zawiera wyłącznie właściwe akcje treści w kolejności Copy → Export →
  Download. Eksporty nie występują w innych blokach preview.

Automatyczna proza odpowiada kolejno: czym jest obiekt → najważniejszy stan/wniosek → konsekwencja
lub rekomendowany następny krok.

#### AI

Karta ma 76 px i występuje tylko dla realnych akcji. Pokazuje maks. 3 akcje bezpośrednio, resztę
w jednym overflow. Przycisk: h-8, pill, gap 6 px, tekst 11–12 px, label 1–3 słowa (maks. 24 znaki).
Dozwolony jest subtelny token AI na ikonie, ale nie duże fioletowe tło. AI nie jest automatycznie
primary.

#### Relations

Karta ma 64 px, label `RELATIONS`, maks. 4 widoczne pille i `+N` dla nadmiaru. Pill: h-7,
ikona 14–16 px, tekst 11 px, border, neutralne tło, truncate po ok. 24 znakach i tooltip.
Brak relacji renderuje kanoniczne `No relations`.

#### Actions i przyciski

Siatka ma 2 kolumny, maks. 3 rzędy i 6 bezpośrednich akcji. Jeden rząd ma button h-9 (36 px),
gap pionowy 10 px i padding karty 12 px. Pojedyncza akcja zajmuje pierwszą kolumnę; nie dodaje się
atrapy. Nadmiar akcji trafia do pełnego kebaba rekordu.

Button: h-9, pill, border 1 px, px-3, ikona 16 px, gap 8 px, tekst 12–13 px medium, label zwykle
1–3 słowa i maks. ok. 22 znaki, opcjonalny neutralny badge skrótu, niebieski focus. Dozwolonych jest
pięć wariantów: `primary`, `positive`, `warning`, `destructive`, `neutral`. Kolor wynika ze skutku,
nie z modułu; primary jest granatowy, maks. jeden i nigdy crimson.

Kanoniczny rejestr ikon wspólnych akcji:

| Działanie | Ikona |
|---|---|
| Open | `ArrowUpRight` |
| Open preview | `PanelRightOpen` |
| Complete/Done | `CheckCircle2` |
| Approve/Accept | `BadgeCheck` |
| Reject | `XCircle` |
| Delete | `Trash2` |
| Edit | `Pencil` |
| Archive / Restore | `Archive` / `ArchiveRestore` |
| Assign/Delegate | `UserPlus` |
| Add note | `StickyNote` |
| Remind | `Bell` |
| Delay/Snooze | `Clock3` |
| Change due date | `CalendarClock` |
| Escalate | `TriangleAlert` |
| Copy / Export / Download | `Copy` / `FileDown` / `Download` |
| Relation | `Link2` |
| AI general | `Sparkles` |
| Report / Presentation / Table | `FileText` / `Presentation` / `Table` |

Ta sama akcja używa tej samej ikony w każdym module. Zmiana wymaga aktualizacji globalnego rejestru,
nie lokalnej decyzji ekranu.

### Deskryptor generacyjny preview

Każda tabela deklaruje `PreviewSurfaceDescriptor`: źródło tytułu; pola Meta; źródło i tryb Details
(`prose | properties | file-list`); limity słów/wierszy; realne akcje AI; typy relacji; maks. trzy
rzędy Actions. Każda akcja deklaruje `actionId`, label, kanoniczną ikonę, jeden z pięciu wariantów,
capability, opcjonalne confirmation i shortcut. Brak deskryptora blokuje automatyczny PASS preview.

### Relacja z kebabem

Preview i kebab nie muszą zawierać identycznego zestawu akcji. Jeśli ta sama akcja występuje w obu miejscach, musi mieć ten sam `actionId`, label, uprawnienie, confirmation i skutek. Kebab pozostaje pełnym menu zarządzania; preview zawiera najważniejsze działania w kontekście czytanej treści.

## 7. Kebab

### Trigger

- ostatnia kolumna, hit target minimum 32×32 px, ikona 16 px;
- widoczny niebieski focus;
- menu portalowe, wyrównane do prawej krawędzi triggera, auto-flip i brak clip.

### Logiczne strefy

Strefy występują zawsze w kolejności `context → manage → danger`. Puste strefy nie są renderowane. Separator występuje wyłącznie między dwiema sąsiednimi wyrenderowanymi strefami. Typowo są 3 strefy i 2 separatory; legalny brak strefy context daje 2 strefy i 1 separator.

### Context

- tylko realne akcje właściwe statusowi/roli;
- wejście/rozstrzygnięcie i przejścia stanu;
- zestaw może się różnić między statusami;
- brak akcji oznacza brak strefy, nie pusty separator.

### Manage — stała kolejność w ramach capabilities

1. Open preview — zawsze;
2. Edit — jeśli capability nie jest `not-applicable`; brak uprawnienia/stanu = wyciszony disabled,
   bez dodatkowego komentarza w pozycji menu;
3. Archive/Restore — jeśli capability archive jest `supported`;
4. Delay — jeśli `dueDate: true`; otwiera submenu presetów.

Stałość oznacza tę samą pozycję dla zadeklarowanego zestawu capabilities, nie obowiązek pokazywania funkcji nieistniejącej w domenie.

### Danger

- Delete/Reject/Move to trash jest zawsze ostatnie i czerwone;
- `supported`: aktywne z confirmation;
- `business-locked`: widoczne jako jaśniejszy, nieaktywny disabled; powód pozostaje w deskryptorze,
  ale nie jest dopisywany do etykiety menu;
- niedozwolony jest powód `Coming soon`.

### Zakazy

- płaska tablica legacy bez `kind`;
- sekcje `open/ai/convert/output` rozbijające trzy strefy wizualne; akcje specjalne muszą być częścią context albo manage według skutku;
- duplikaty View/Open/Open preview o tym samym skutku;
- atrapy i puste handlery;
- więcej niż dwa separatory.

### Kontrakt graficzny kebaba

Kebab jest odkrywalnym triggerem dokładnie tego samego `RowActionRegistry`, którego używa PPM.
Trigger: ostatnia kolumna, target min. 32×32 px, glyph `MoreVertical` 16 px, niebieski focus.

Menu jest portalowe, ma `z-index` warstwy context-menu, min-width 220 px, max-width 320 px,
padding pionowy 6 px, radius 12 px, border 1 px `--c-border-subtle`, tło `--c-surface-raised`
i elevation-2. Jest wyrównane do prawej krawędzi triggera (tolerancja ±5 px), ma 12 px clearance
od viewportu, auto-flip i nigdy nie jest clipowane przez tabelę.

Pozycja menu: h-9 (36 px), px-3, gap 8 px, ikona 16 px, label 13 px medium i opcjonalny shortcut
11 px muted po prawej. Wszystkie zwykłe akcje mają ten sam neutralny kolor; hover używa
`--state-hover`; focus jest niebieski. Disabled pozostaje widoczny, lecz jest wyraźnie jaśniejszy,
nie reaguje na hover/klik i nie otrzymuje dopisanego komentarza. Powód ograniczenia pozostaje w
deskryptorze capability do testów i audytu. Wyłącznie Delete/Reject/Move to trash ma czerwony tekst
i ikonę oraz delikatny czerwony hover, bez pełnego jaskrawego fillu. Separator: 1 px
`--c-border-subtle`, margines pionowy 4 px.

Struktura jest zawsze logicznie `context → manage → danger`; puste strefy i ich separatory znikają.
W `manage` kolejność wynosi Open preview → Edit → Archive/Restore → Delay. Każda pozycja ma ikonę.
Menu wspiera ArrowUp/ArrowDown, Enter/Space, Esc i typeahead; Esc/outside zamyka tylko menu i zwraca
focus do triggera.

## 8. Menu kontekstowe prawego kliknięcia

Menu kontekstowe jest drugim triggerem dokładnie tego samego `RowActionRegistry`, nie osobną konfiguracją.

- prawy klik działa na całym wierszu i ustawia active record;
- menu otwiera się przy kursorze, z auto-flip;
- actionId, label, ikona, kolejność, visible/disabled, powód, confirmation i handler są identyczne jak w kebabie;
- różni się wyłącznie anchor/trigger;
- obsługuje strzałki, Enter i Esc; po zamknięciu focus wraca do wiersza;
- żadna akcja nie może istnieć wyłącznie w menu prawego kliknięcia.

### Kontrakt graficzny i relacja z kebabem

PPM nie jest drugim projektem menu. Jest drugim triggerem tego samego `RowActionRegistry` i używa
tego samego komponentu pozycji, kolorów, ikon, stref, separatorów, hover, disabled i danger co kebab.
Różnice są wyłącznie trzy:

1. anchor jest punktem kursora zamiast przyciskiem `MoreVertical`;
2. otwarcie ustawia active record wskazanego wiersza;
3. po zamknięciu focus wraca do wiersza zamiast do triggera kebaba.

PPM ma tę samą min/max width, radius, border, elevation, h-9 pozycji i limity viewportu. Otwiera się
przy kursorze, ale zachowuje min. 12 px clearance i wykonuje auto-flip w poziomie/pionie. Systemowe
menu przeglądarki nie jest dowodem PPM. Implementacja nie może posiadać osobnej tablicy akcji,
osobnych labeli ani lokalnego sortowania.

## 9. Focus, kolor, motion i bezpieczeństwo

- focus jest zawsze niebieski (`--c-focus`), nigdy crimson;
- crimson nie sygnalizuje aktywnej zakładki, selection ani primary CTA;
- czerwony jest zarezerwowany dla danger/error/blocked/overdue/critical signal;
- każdy icon-only control ma accessible name;
- Esc zamyka tylko najbardziej lokalną warstwę: submenu → menu → preview → modal;
- animacje ≤220 ms i respektują reduced motion;
- destructive zawsze ma confirmation;
- realna akcja ma handler, feedback i aktualizację danych.

### Viewport desktopowy i reflow

- kanoniczny odbiór wizualny wykonuje się przy viewportcie CSS `1440×900`, zoom 100%; jest to
  rozmiar referencyjny dla proporcji, gęstości, geometrii tabeli i preview;
- obowiązkowy test minimalnego desktopu wykonuje się przy viewportcie CSS `1280×720`, zoom 100%;
- `1280×720` nie jest osobnym projektem ani wymogiem jednoczesnej widoczności każdej kontrolki;
  dozwolone są jawny overflow, logiczne grupowanie i zwinięcie elementów drugorzędnych;
- niedozwolone są: obcięte etykiety, nakładanie kontrolek, zasłanianie aktywnej zakładki, elementy
  poza viewportem bez dostępnej alternatywy oraz utrata funkcji;
- preview przy `1280×720` nie może redukować tabeli do bezużytecznej szerokości; należy zachować
  kolumnę identyfikującą oraz dostęp do akcji, a pozostałe kolumny obsłużyć przewidywalnym reflow;
- podane wymiary oznaczają viewport CSS aplikacji, nie fizyczną rozdzielczość monitora ani DPR.

## 10. Rozstrzygnięte sprzeczności

| Temat | Decyzja zamykająca |
|---|---|
| Menu 1 | poziomy app context bar; sidebar jest osobnym elementem |
| Menu 3 chip | 28 px (`h-7`), nie 24 px |
| Bulk action | 32 px (`h-8`) |
| Settings2 / row kebab target | minimum 32×32 px; ikona 16 px |
| View modes | wyłącznie Menu 2 |
| `Coming soon` | niedozwolone; funkcja niezaimplementowana jest pomijana i raportowana jako capability gap |
| Disabled | tylko dla realnego ograniczenia rekordu, roli lub reguły biznesowej; wizualnie jaśniejszy i bez komentarza w menu, powód zapisany w deskryptorze |
| Archive/Edit | warunkowe według capability, ale mają stałą pozycję, gdy istnieją |
| Liczba stref kebaba | do 3 logicznych stref; puste niewidoczne; separator tylko między wyrenderowanymi |
| Idea/AI/Convert/Output | nie tworzą dodatkowych stref wizualnych; mapowane do context/manage |
| Preview–kebab parity | parytet skutku dla wspólnych `actionId`, nie identyczny zestaw pozycji |
| Preview AI | warunkowe; nie renderować pustej atrapy |
| Preview pin | obowiązkowy dla tabelowego preview |
| Selection | obowiązkowe tylko przy `selection: bulk`; `none` wymaga uzasadnienia |
| Notebook | dopóki nie ma deskryptora `hasTable: true`, nie jest tabelą kontraktową |

## 11. Odbiór

Wykonywalna lista czeków: `evidence/MY_WORK_ACCEPTANCE_CHECK_SPEC_2026-08-05.md`. Każdy check odwołuje się do niniejszego kontraktu. Werdykt PASS wymaga 100% właściwych checków; brak dowodu daje `NOT TESTED`, nie PASS.
