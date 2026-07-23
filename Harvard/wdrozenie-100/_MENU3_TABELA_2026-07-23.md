# Menu 3 (górny pasek akcji) — narzędzie IDEE, tryb TABELA

Dokument dla AI bez kontekstu repo. Opisuje **drugi pasek** (pod Menu 1/2, nad siatką danych) widoczny
gdy pomysł ("Idea") jest otwarty w widoku **Tabela** (`/my-work/ideas/:id/workspace/table`). To
najbogatszy z czterech głównych pasków akcji w Consultify — ~20 ikon w jednym rzędzie, zestaw zakładek
widoków, zestaw zakładek modułów platformowych i dropdown "Tools". Poniżej: architektura (WAŻNE — dwie
różne implementacje), potem element-po-elemencie od lewej do prawej.

## 0. Architektura — DWIE implementacje tego samego paska

Plik `src/components/MyWork/IdeaTableTool.tsx` (komponent-rodzic, ~3837 linii) renderuje pasek
warunkowo, w zależności od zmiennej `usePlatform` (linia ~437):

```
{usePlatform ? <P15TableToolbar ...> : ( ...legacy JSX inline w tym samym pliku... )}
```

- **`usePlatform = true` → P15TableToolbar** (plik wydzielony:
  `src/components/MyWork/table/TableToolbar.tsx`, 1456 linii). To "platforma" (P15, silnik
  Airtable-podobny: bazy/tabele/pola/widoki w osobnych rekordach DB). Ten wariant ma dodatkowo:
  zakładki modułów Data/Forms/Interfaces/Models/Workflow, dropdown "Tools", ikony Interface
  Designer / Form Builder. Sekcja "drugorzędne narzędzia" (AI Categorize, Scoring, Export do
  prezentacji, Pipeline, Copilot, Voice, Cross-table, Heatmap, History, Activity, Keyboard
  shortcuts, Templates, Distribute, Framework Generator, Conditional Formatting, Color Palette)
  jest **zwinięta pod jeden przycisk "…" (MoreHorizontal)** — komentarz w kodzie: *"Editor Shell
  Canon §2 GÓRNA: secondary tools collapse under a single overflow button (was a flat ~15-icon row
  = the 'three flat layers' the canon forbids)"*.
- **`usePlatform = false` → toolbar legacy** (JSX wpisany wprost do `IdeaTableTool.tsx`,
  linie ~1480–2300). To starszy silnik (dane pomysłu leżą w `IdeaWorkspaceGraph`/węzłach, nie w
  osobnych tabelach platformy). Ten wariant **NIE ma** kolapsu "…" — wszystkie ~16 ikon
  drugorzędnych narzędzi stoi płasko w jednym rzędzie (dokładnie ten widok opisuje to zadanie —
  patrz pkt "Weryfikacja live" niżej). Zawiera też **martwy kod**: kopie zakładek
  Data/Forms/Interfaces/Models/Workflow, ikony Interface Designer/Form Builder i dropdown "Tools"
  są tam obecne w JSX, ale opakowane w `{usePlatform && (...)}` — a skoro jesteśmy w gałęzi "else"
  tego samego `usePlatform`, ten warunek nigdy nie jest prawdziwy. Te fragmenty nigdy się nie
  wyrenderują w trybie legacy (kod-widmo, nie usunięty po refaktorze).

`usePlatform` liczony jest tak: `platformActive && !(platformLooksEmpty && legacyLooksPopulated)`
(plik `IdeaTableTool.tsx` ~L437) — czyli tabela przełącza się na legacy, jeśli platforma nie ma
jeszcze danych, a stary graf węzłów już je ma (ochrona przed pokazaniem pustej tabeli).

### Weryfikacja live (2026-07-23, obiekt testowy)
Otwarto żywy podgląd `http://localhost:3100/my-work/ideas/5b0000c2-c7aa-4bb2-88bb-7b522627d8b0/workspace/table`.
Tooltip przycisku AI to **"Asystent AI (/)"** (klucz `ideas.table.aiAssistant`), a nie "Asystent
schematu AI" (`toolbar.aiSchemaAssistant`, unikalny dla P15TableToolbar) — a w pasku BRAK dropdownu
"Tools" i zakładek Data/Forms/Interfaces/Models/Workflow. Kolejność pozostałych ~16 ikon
drugorzędnych (AI Kategoryzacja → Paleta kolorów) zgadza się 1:1 z kodem legacy. **Wniosek: ten
konkretny testowy obiekt renderuje się w trybie LEGACY (`usePlatform=false`)** — więc na żywo widać
płaski rząd ~20 ikon (zgodnie z opisem zadania), ale NIE widać modułów platformowych — te opisano
niżej wyłącznie na podstawie kodu P15TableToolbar (oznaczone jako "kod, niepotwierdzone wzrokiem na
tym obiekcie").

Uwaga dodatkowa: obok tabeli, po lewej stronie ekranu, stoi **pionowa szyna z ikonami** (mapa myśli /
dokument / tabela / kursor / AI / framework / …) — to osobny, trwały pasek przełącznika trybu
artefaktu (Mind Map/Dokument/Tabela/Whiteboard/Process Flow), widoczny identycznie w trybie Mapa
myśli i w trybie Tabela. To NIE jest część Menu 3 opisywanego tu paska — pominięto w tym dokumencie
(inny "Menu", poza zakresem zadania).

---

## 1. Zakładki widoków (saved views)

Zdefiniowane w `src/components/MyWork/table/useTableViews.ts` (hook `useTableViews`, linia ~55) jako
domyślny zestaw "seed" — to gotowe presety filtrów/sortowań/grupowań nad tą samą tabelą, każdy
zapisany jako `SavedView`. Kliknięcie zakładki = `applyView(view)`: ustawia `sort`, `filters`,
`groupBy`, ewentualnie `layout` i kolumny naraz.

| Zakładka | Etykieta PL | Co ustawia | Po co |
|---|---|---|---|
| `default` | Domyślny | brak sortowania/grupowania/filtra | widok surowy, punkt wyjścia |
| `triage` | Triażowanie | `groupBy: 'status'` | grupuje wiersze wg statusu — szybki przegląd "co jeszcze do zrobienia" |
| `scoring` | Scoring | `sort: [{key:'score', direction:'desc'}]` | sortuje pomysły wg wyniku scoringu, najwyżej punktowane na górze |
| `decision_log` | Log decyzji | `groupBy: 'decision'` | grupuje wg pola decyzji — widok "co zostało zdecydowane" |
| `timeline_view` | Timeline | `layout: 'timeline'` | przełącza całą tabelę na widok osi czasu/Gantta |
| `+` | (przycisk Plus) | otwiera dialog "Zapisz widok" (`ideas.table.saveView`) | użytkownik zapisuje BIEŻĄCY układ (sort+filtry+grupowanie+kolumny+layout) jako nową nazwaną zakładkę |

Prawy-klik na zakładce (poza `default`) otwiera menu kontekstowe: **Rename** (zmień nazwę),
**Update** (nadpisz zapisany widok bieżącym stanem), **Delete** (usuń zakładkę). Stan: **działa** —
to zwykły `useState` w komponencie, nie jest jeszcze trwale zapisywany do bazy per użytkownik/sesję
w wersji legacy (odtwarza się od nowa przy każdym wejściu w tabelę z domyślnym seedem powyżej); w
trybie platformowym widoki (`platformViews`) są zapisami w bazie P15 (`TablePlatformApi`).

---

## 2. Długi rząd ikon (od lewej, po zakładkach widoków)

### 2.1 Filtr, Grupuj, przełącznik layoutu

| Element | Ikona (lucide) | Etykieta/tooltip PL | Co robi | Po co | Stan |
|---|---|---|---|---|---|
| Szybki filtr (pole tekstowe) | `Filter` (ikona wewnątrz inputu) | placeholder "Filtruj…" | filtruje wiersze po dowolnym tekście w komórkach | szybkie wyszukiwanie bez budowania reguł | działa |
| Filtr zaawansowany | `Filter` (przycisk, pokazuje licznik reguł w nawiasie) | **brak title/tooltip w kodzie** — ikona bez podpisu | otwiera `FilterBuilderComponent` (platforma) lub `FilterPanelComponent` (legacy) — budowanie reguł AND/OR po polach | precyzyjne filtrowanie wielowarunkowe | działa; UWAGA: brak `title` = brak natywnego tooltipu na hover, mniejsza odkrywalność |
| Grupuj | `Group` | "Grupuj" (rozwija się do nazwy aktywnej kolumny grupującej) | dropdown wyboru dowolnej kolumny jako klucza grupowania wierszy | organizacja widoku (np. grupuj po Statusie, Właścicielu) | działa — dodane w "Fala 10 (parytet Airtable)" wg komentarza w kodzie |
| Przełącznik layoutu (6 ikon w jednej "pigułce") | `Table2` / `KanbanSquare` / `GanttChart` / `Calendar` / `LayoutGrid` / `Grid3X3` | Tabela / Kanban / Oś czasu-Gantt / Kalendarz / Macierz / Galeria | przełącza CAŁY widok danych na inny typ renderowania (siatka, tablica kanban, oś czasu, kalendarz, macierz 2D, galeria kart) | jeden zestaw danych, wiele reprezentacji — bez utraty filtrów/sortowania | działa; kolejność oznaczona w kodzie jako "FROZEN order per V5-IDEA-24" (nie zmieniać kolejności) |

Renderer właściwej treści dla każdego layoutu żyje w `src/components/MyWork/table/ViewRouter.tsx`
(platforma) / `src/components/MyWork/table/views/ViewRouter.tsx` (legacy) — przełącza się na
komponenty `GridView`, `KanbanView`, `TimelineView`, `CalendarView`, `MatrixView`,
`StickyNoteView` itd.

### 2.2 Reszta rzędu — ~16 ikon "drugorzędnych narzędzi"

W P15TableToolbar (platforma) te 16 pozycji są **zwinięte pod przycisk "…" (`MoreHorizontal`)**. W
legacy (obiekt testowy z weryfikacji live) stoją **płasko, jedna za drugą**, w tej samej kolejności:

| # | Ikona | Etykieta PL | Co robi | Po co | Stan |
|---|---|---|---|---|---|
| 1 | `Sparkles` | Asystent AI (/) *(legacy)* / AI *(platforma, przycisk z tekstem "AI")* | otwiera panel/arkusz asystenta AI do schematu tabeli — czat, w którym AI proponuje nowe kolumny, widoki, wiersze na podstawie kontekstu artefaktów | budowa/zmiana struktury tabeli przez rozmowę z AI zamiast ręcznie | działa — prowadzi do `AITableAssistant` → `AITableProposal` (karta propozycji do zaakceptowania/odrzucenia) |
| — | `Wand2` (widoczny tylko gdy są puste komórki) | "AI Fill" z licznikiem pustych komórek | Batch AI Fill — jednym kliknięciem AI uzupełnia wszystkie puste komórki we wszystkich widocznych kolumnach (dla zaznaczonych wierszy lub całej tabeli) | oszczędność czasu przy uzupełnianiu danych | działa, ale **warunkowo niewidoczny** — komponent zwraca `null` gdy `emptyCount === 0` (na testowym obiekcie tabela jest w pełni wypełniona, więc przycisk nie występuje) |
| 2 | `Layers` | AI Kategoryzacja | otwiera `AICategorizeTool` — AI grupuje/nadaje kategorie/tagi pomysłom masowo | automatyczna klasyfikacja dużej liczby wierszy | działa; ukryty gdy `locked` (tabela zablokowana/tylko-odczyt) |
| 3 | `Trophy` | Model scoringowy | otwiera `IdeaScoringModel` — konfigurowalny model punktacji pomysłów (wagi kryteriów → wynik) | ranking/priorytetyzacja pomysłów wg zdefiniowanych kryteriów | działa |
| 4 | `Presentation` | Eksport do prezentacji | otwiera `ExportToPresentation` — generuje slajd/talię na podstawie danych tabeli | szybkie przekazanie wyników tabeli jako prezentacji | działa |
| 5 | `Rocket` | Pipeline pomysłów | otwiera `IdeaPipeline` — widok lejka/etapów pomysłu (od zgłoszenia do wdrożenia) | śledzenie pomysłów jako proces, nie tylko lista | działa |
| 6 | `Brain` | AI Copilot | otwiera `AICopilotMode` — tryb pracy z asystentem AI "obok" tabeli (sugestie w locie) | wsparcie AI podczas edycji, nie tylko jednorazowe generowanie | działa |
| 7 | `Mic` | Głos / Obraz | otwiera `VoiceImageInput` — dyktowanie głosowe LUB wklejenie/upload obrazu (np. zrzut ekranu z burzy mózgów), AI rozpoznaje z tego listę pomysłów do dodania jako wiersze | szybkie masowe dodawanie pomysłów bez ręcznego pisania | działa (Web Speech API do dyktowania + parser obrazu) |
| 8 | `Network` | Relacje między tabelami | otwiera `CrossTableRelations` — łączenie rekordów tej tabeli z rekordami innych tabel/baz (linked records) | modelowanie zależności między tabelami (jak relacje w Airtable) | działa |
| 9 | `Flame` | Heatmapa | przełącza kolorowanie komórek wybranych kolumn numerycznych wg wartości (cieplej = wyżej) | szybka wizualna ocena "gdzie jest problem/priorytet" bez czytania liczb | działa; podświetlony (active) gdy `heatmapColumns.size > 0` |
| 10 | `History` | Historia zmian | otwiera `AuditTrailPanel` — pełny log zmian (kto, co, kiedy zmienił) | audyt/rozliczalność zmian w tabeli | działa |
| 11 | `Activity` | Aktywność | otwiera `ActivityFeed` — strumień ostatnich akcji w tabeli (dodania, edycje, komentarze) | świadomość "co się dzieje" bez czytania pełnego audytu | działa |
| 12 | `Keyboard` | Skróty klawiszowe (?) | otwiera `KeyboardShortcutsPanel` — ściągawka skrótów (podzielona wg kodu na grupy: Edycja / Nawigacja / Widoki i narzędzia) | onboarding/przypomnienie skrótów klawiszowych | działa |
| 13 | `LayoutTemplate` | Szablony | otwiera `TemplateGallery` — biblioteka gotowych szablonów wierszy/tabel do szybkiego startu | przyspieszenie tworzenia typowych rekordów | działa; ukryty gdy `locked` |
| 14 | `Send` | Dystrybucja | otwiera `DistributionBuilder` — konfiguracja automatycznej wysyłki danych z tabeli (email/Slack/Teams/webhook, wg harmonogramu cron) | regularne rozsyłanie wyciągu z tabeli bez ręcznego eksportu | działa; ukryty gdy `locked` |
| 15 | `LayoutGrid` + tekst "Framework" | Generator frameworków | otwiera `FrameworkGenerator` — buduje strukturalny framework/matrycę na bazie danych tabeli | przekształcenie surowych danych w gotową ramę analityczną | działa; ukryty gdy `locked` |
| 16 | `Paintbrush` | Formatowanie warunkowe | otwiera `ConditionalFormatting` — reguły koloru/stylu komórek wg warunków (jak w Excelu) | wizualne wyróżnianie wierszy/komórek spełniających kryteria | działa; podświetlony gdy są aktywne reguły |
| 17 | `Palette` | Paleta kolorów | otwiera `ColorPalette` — przypisanie kolorów do wierszy (ręcznie lub auto-przypisanie wg wartości kolumny) | wizualne kodowanie kolorem (np. wg statusu/priorytetu) | działa |

### 2.3 Import / Eksport / kolumny / historia edycji / dodawanie wiersza

| Element | Ikona | Etykieta PL | Co robi | Po co | Stan |
|---|---|---|---|---|---|
| Import (tylko legacy) | `Network` + tekst "Import" | Importuj dane | otwiera Connector Wizard (`setShowConnectorWizard`) — podłączenie zewnętrznego źródła danych (baza/API) jako synchronizowany import | zasilanie tabeli danymi z zewnętrznego systemu, nie tylko CSV | działa w legacy; **w P15TableToolbar prop `onShowConnectorWizard` istnieje w interfejsie, ale nigdy nie jest renderowany jako przycisk — martwy/osierocony prop** |
| Konektory (warunkowy) | `Layers` (z kropką statusu) | Konektory | otwiera listę podłączonych konektorów danych, z sygnalizacją running (niebieska kropka pulsująca)/failed (czerwona kropka) | monitoring aktywnych synchronizacji danych | działa; widoczny tylko gdy `connectors.connectors.length > 0` |
| Webhook Relay (platforma) | `Webhook` | Webhook Relay (Zapier/Make) | otwiera panel przekaźników webhook do Zapier/Make | integracje low-code z zewnętrznymi automatyzacjami | działa; tylko `usePlatform` |
| Importuj CSV | `Upload` | Importuj CSV | otwiera systemowy file-picker (`.csv/.tsv/.txt`) → parsuje i dodaje wiersze | masowy import z pliku | działa; ukryty gdy `locked` |
| Eksportuj CSV | `Download` | Eksportuj CSV | generuje i pobiera plik CSV z bieżącej tabeli | eksport danych do Excela/innych narzędzi | działa |
| Kopiuj do schowka | `ClipboardCopy` | Kopiuj do schowka | kopiuje całą tabelę (tab-separated) do schowka systemowego | szybkie wklejenie do Excela/Sheets/Slacka | działa |
| Kolumny | `Columns3` | Kolumny | dropdown: lista wszystkich kolumn z przełącznikiem widoczności (oko/przekreślone oko) każdej + "Nowa kolumna" + (platforma) "Zarządzaj polami" → `FieldManager` | pokaż/ukryj kolumny, dodaj nową, zaawansowane zarządzanie typami pól | działa |
| Cofnij | `Undo2` | Cofnij (Ctrl+Z) | cofnięcie ostatniej zmiany | standardowy undo | działa (dwa różne silniki: `nodesUndo` dla legacy, `onPlatformUndo` dla platformy) |
| Ponów | `Redo2` | Ponów (Ctrl+Y) | ponowienie cofniętej zmiany | standardowy redo | działa |
| + Wiersz | `Plus` + tekst "Row"/"Wiersz" | Dodaj pusty wiersz | dodaje nowy pusty rekord na końcu tabeli | najszybsza droga do nowego wiersza | działa; ukryty gdy `locked` |
| Strzałka obok "+ Wiersz" | `ChevronDown` | Dodaj z szablonu | otwiera `RowTemplatePicker` — nowy wiersz z gotowego szablonu (predefiniowane wartości pól) | szybkie tworzenie typowych rekordów (np. "Zadanie standardowe") | działa |
| Zapisz | `Save` | Zapisz / Zapisano Xs temu | zapisuje zmiany (autosave + ręczny zapis `handleSave`) | jawne wymuszenie zapisu / info o stanie synchronizacji | działa; **ukrywany** gdy `hideSaveIndicator=true` (gdy Menu 1 ma już własny wskaźnik zapisu — unikanie duplikatu) |

Zaznaczenie wierszy (checkboxy w pierwszej kolumnie tabeli) odsłania dodatkowy **pasek akcji masowych**
w prawej części paska: licznik "N selected", **Konwertuj** (dropdown: → Initiative/Task/Decision —
`onBulkConvert`, konwertuje zaznaczone pomysły na inny typ artefaktu) i **Usuń** (`Trash2`, czerwony,
`handleBulkDelete`). Widoczne tylko gdy `selectedRowIds.size > 0` i tabela nie jest `locked`.

---

## 3. Zakładki modułów platformowych: Data · Forms · Interfaces · Models · Workflow

**Wyłącznie w trybie platformowym** (`usePlatform === true`; w legacy — patrz pkt 0, ta sekcja
istnieje w kodzie legacy ale jest martwa). To silnik podobny do Airtable: ta sama "baza" (tabela)
ma kilka trybów pracy nad nią, przełączanych zakładką w środku paska (`ui.platformTab`, stan w
`TableDataProvider`):

| Zakładka | Etykieta PL | Co otwiera | Po co |
|---|---|---|---|
| `data` | Dane | domyślna siatka/tabela (ViewRouter — Grid/Kanban/itd., jak w pkt 1-2) | codzienna praca z rekordami |
| `forms` | Formularze | `FormsIndex.tsx` — lista formularzy dla tej tabeli: karty ze statusem (opublikowany/szkic), tryb udostępniania (`public` / `organization` / `authenticated`), licznik zgłoszeń (`submit_count`), link do udostępnienia, CRUD | zbieranie danych OD ZEWNĄTRZ (np. od klienta) bezpośrednio do wierszy tabeli, bez dawania dostępu do całej tabeli |
| `interfaces` | Interfejsy | `InterfacesIndex.tsx` — lista "interfejsów" (mini-dashboardów) nad tabelą: karty z szablonami startowymi, każdy zbudowany z bloków (`InterfaceDesigner` — bloki: wykres, karta podsumowania, pasek wyszukiwania, filtr, szczegóły rekordu, przycisk akcji, blok tekstowy) | budowanie odbiorca-specyficznych widoków/dashboardów nad surowymi danymi (jak "Interfaces" w Airtable) |
| `models` | Modele | `GovernedModelsDashboard.tsx` — "governed" modele danych: agregują KPI, wymiary i tabele źródłowe z metadanymi zaufania (trust metadata) | warstwa nadzorowanych/zatwierdzonych modeli analitycznych ponad surowymi tabelami (governance danych) |
| `workflow` | Workflow | `WorkflowDashboard.tsx` — zbiorczy dashboard: Automations, Sync, Webhooks, Sharing, Distributions (karty podsumowań + szybkie linki do każdego menedżera) | jeden ekran wejściowy do wszystkich mechanizmów automatyzacji/udostępniania tej tabeli |

Obok zakładek (tylko platforma): osobne ikony-skróty **Interface Designer** (`Layout`) i **Form
Builder** (`FileText`) — otwierają odpowiednio `InterfaceDesigner` i `FormBuilder` bezpośrednio, z
pominięciem przełączania całej zakładki (skrót dla częstej akcji "dodaj/edytuj coś tu i teraz").

---

## 4. Dropdown "Tools" (tylko platforma)

Przycisk `Grid3X3` + tekst "Narzędzia" + `ChevronDown`. Po kliknięciu — panel z dwiema sekcjami:

**Sekcja "Workflow"**
| Ikona | Etykieta PL | Otwiera |
|---|---|---|
| `Rocket` (bursztynowy) | Automatyzacje | `AutomationsManager` |
| `Link2` (niebieski) | Synchronizacja danych | `SyncManager` |
| `Webhook` (indygo) | Webhook Relay | `WebhookRelayPanel` |
| `Network` (zielony) | Udostępnianie | `SharingManager` |
| `Send` (różowy) | Dystrybucja | `DistributionBuilder` |

**Sekcja "Budowanie" (Build)**
| Ikona | Etykieta PL | Otwiera |
|---|---|---|
| `FileText` (niebieski) | Formularze | `FormBuilder` |
| `Layout` (niebieski) | Interfejsy | `InterfaceDesigner` |
| `LayoutTemplate` (szmaragdowy) | Szablony | `TemplateGallery` |

Na dole, po separatorze: **Połączenie z Consultify** (`Layers`, indygo) — `onShowConsultifyLink`,
łączy tabelę z resztą systemu Consultify (prawdopodobnie: powiązanie z innym modułem/artefaktem
konsultingowym — nazwa funkcji sugeruje, nie potwierdzono treści docelowego panelu w tym audycie).

Tools to w praktyce **skrót/duplikat** do tych samych akcji, które są też dostępne osobno w rzędzie
ikon (Automations/Sync/Webhooks/Sharing/Distribution to te same menedżery co w zakładce
`workflow`/`WorkflowDashboard`; Forms/Interfaces/Templates to też to samo co osobne ikony-skróty i
zakładki modułów) — jeden "wszystko w jednym miejscu" punkt wejścia zamiast szukania po całym pasku.

---

## 5. Podsumowanie stanu (dla planu naprawczego)

- **Działa i potwierdzone live**: zakładki widoków (Domyślny/Triażowanie/Scoring/Log
  decyzji/Timeline/+), szybki filtr, filtr zaawansowany (bez tooltipu), Grupuj, przełącznik 6
  layoutów, wszystkie 16-17 ikon drugorzędnych narzędzi (legacy — potwierdzone dokładnie po
  kolejności i etykietach), Import (Connector Wizard), Import/Eksport CSV, kopiowanie do schowka,
  Kolumny, Cofnij/Ponów, +Wiersz (+szablon), Zapisz.
- **Istnieje tylko w kodzie P15TableToolbar, NIE potwierdzone wzrokiem na testowanym obiekcie**
  (bo obiekt renderuje się w trybie legacy): zakładki Data/Forms/Interfaces/Models/Workflow, ikony
  Interface Designer/Form Builder, dropdown "Tools", kolaps drugorzędnych narzędzi pod "…". Trzeba
  znaleźć/otworzyć pomysł z aktywną platformą P15 (`usePlatform=true`), żeby zobaczyć je na żywo.
- **Martwy kod (do wyczyszczenia)**: w legacy branchu `IdeaTableTool.tsx` (linie ~2010-2150) leży
  kopia zakładek Data/Forms/Interfaces/Models/Workflow + ikon Interface Designer/Form Builder +
  dropdown Tools, opakowana w `{usePlatform && (...)}` — nieosiągalna, bo cały ten blok JSX
  renderuje się tylko gdy `usePlatform === false`. Kandydat do usunięcia przy najbliższym porządkowaniu.
- **Osierocony prop**: `onShowConnectorWizard` w `TableToolbarProps` (P15TableToolbar) nigdy nie jest
  użyty w JSX tego komponentu (żaden przycisk go nie wywołuje) — w legacy odpowiednik działa
  (przycisk "Import"). Do sprawdzenia, czy platforma powinna też mieć widoczny przycisk importu
  danych/konektorów w pasku, czy to celowe pominięcie.
- **Drobna niespójność UX**: przycisk filtra zaawansowanego nie ma atrybutu `title` — jedyny
  przycisk w całym pasku bez natywnego tooltipu na hover.
- **Plan / "Wkrótce"**: nie znaleziono w kodzie paska żadnych jawnych flag "coming soon"/`TODO`
  blokujących pojedynczy przycisk — wszystkie opisane elementy albo renderują realny
  komponent/panel, albo (Consultify Link) wywołują callback, którego docelowa treść panelu nie
  była w zakresie tego audytu.

## Kotwice w kodzie (do dalszej pracy)

- `src/components/MyWork/table/TableToolbar.tsx` — pasek platformowy (P15), z kolapsem "…".
- `src/components/MyWork/IdeaTableTool.tsx` (linie ~1480–2400) — pasek legacy, płaski, z martwym
  kodem platformowym w środku.
- `src/components/MyWork/table/useTableViews.ts` (L50-73) — definicja 5 domyślnych zakładek widoków.
- `src/components/MyWork/table/forms/FormsIndex.tsx`, `interfaces/InterfacesIndex.tsx`,
  `governed/GovernedModelsDashboard.tsx`, `WorkflowDashboard.tsx` — 4 moduły platformowe.
- `src/components/MyWork/table/ViewRouter.tsx` (platforma) / `table/views/ViewRouter.tsx` (legacy) —
  routing 6 typów layoutu.
- `src/components/MyWork/table/InlineAIFill.tsx` — `BatchAIFillButton` (warunkowo niewidoczny).
- `public/locales/pl/translation.json`, klucz `ideas.table.*` — wszystkie etykiety/tooltipy PL.
