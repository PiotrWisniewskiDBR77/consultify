# 04 — Menu 1 (tożsamość całej Idei)

Menu 1 to jedyne miejsce, które mówi "czym jest ta Idea jako całość" — niezależnie od tego, którą
reprezentacją jest aktualnie oglądana. Ten rozdział ustala docelowy układ, nazewnictwo, stany
zapisu (z minimalnym standardem konfliktu), kontekst przekazywany Teresie, mechanizm Convert całej
Idei i zawartość kebaba globalnego. Wszystko tu opisane jest wspólne dla 4 reprezentacji (Z1) —
Menu 1 nie zależy od `activeTool` poza jedną małą ikoną tożsamości narzędzia.

## 1. Rola Menu 1

Menu 1 to pierwszy pasek, zawsze widoczny, renderowany raz dla całej Idei (nie per reprezentacja).
Odpowiada wyłącznie za:
- tożsamość Idei (nazwa, etap, ikona aktualnego narzędzia jako informacja — nie przełącznik),
- stan zapisu całości,
- akcje działające na CAŁEJ Idei (Convert, Eksport, Historia, Duplikuj, Usuń, Szukaj),
- wejście do Teresy.

Menu 1 **nie zawiera** akcji specyficznych dla jednej reprezentacji (to Menu 3, §05) ani
przełącznika reprezentacji (D2 — prawy dolny róg, poza Menu 1).

Źródło (dzisiejsza implementacja): `IdeaCanvasMelsView` (TopBar) + `IdeaCanvasMenu1Bits.tsx` +
`ideaCanvasMelsChips.ts::buildIdeaMenu1Chips` — dziś **działa w większości**, bo jest zbudowane
uniwersalnie (nie zależy od `activeTool`), w przeciwieństwie do Menu 3 (root-cause #1, §05).

## 2. Docelowy układ — lewa i prawa strona

| Strona | Element | Co pokazuje | Stan dzisiejszy |
|---|---|---|---|
| Lewa | Powrót / breadcrumb | `Idee › nazwa Idei` | działa |
| Lewa | Ikona narzędzia | Informacyjna ikona aktywnej reprezentacji (`IdeaToolIcon`) — **nie jest przełącznikiem**, samo info | działa (D2 potwierdza: przełącznik NIE tu) |
| Lewa | Nazwa Idei | Tytuł Idei, edytowalny inline | działa — patrz §3 (zakaz dopisywania reprezentacji) |
| Lewa | Chip etapu | `IdeaStageChip`: Iskra · Rośnie · Kształtuje · Gotowy · Promowany | działa |
| Lewa | Wskaźnik zapisu | `IdeaSaveIndicator` — patrz §4 | działa (6 z 7 docelowych stanów) |
| Prawa | Teresa | Ghost/secondary, zawsze widoczny | działa |
| Prawa | Konwertuj ▾ | Primary CTA, `IdeaConvertMenu` | działa — patrz §6 |
| Prawa | Kebab `⋯` | Overflow — patrz §7 | działa, z jedną zmianą (D1) |

**Zasada rozstrzygająca:** jeśli akcja dotyczy CAŁEJ Idei (scope `workspace`) i ma sens niezależnie
od tego, którą reprezentacją user akurat patrzy — miejsce jest tu. Jeśli dotyczy zawartości
aktualnej reprezentacji (scope `current_view`/`selected_items`/…) — miejsce jest w Menu 3 lub na
powierzchniach specyficznych narzędzia.

## 3. Nazwa Idei — zakaz dopisywania reprezentacji

Nazwa Idei jest jedną wartością, wspólną dla wszystkich 4 reprezentacji (słownik: Idea = jeden
graf + metadane, reprezentacja = sposób oglądania). **Zabronione:** dopisywanie nazwy narzędzia do
tytułu (np. „Nazwa Idei — Mind Map", „Nazwa Idei (Tabela)"). Powód: reprezentacja to widok, nie
osobny obiekt — dopisanie jej do nazwy sugerowałoby, że zmiana widoku zmienia tożsamość Idei, co
łamie model pojęciowy (Idea = jeden obiekt, niezależny od tego, jak jest oglądana).

Jedyny dozwolony wskaźnik reprezentacji w Menu 1 to ikona informacyjna z §2 (małe, ciche info —
nigdy w tekście tytułu).

## 4. Stany zapisu

Dzisiejszy mechanizm (`IdeaSaveIndicator`, `formatIdeaMapSyncLabel` w
`src/components/MyWork/canvas/useIdeaMapSync.ts`) realizuje 6 stanów. Docelowy standard dodaje
siódmy (tryb tylko-do-odczytu), którego dziś nie ma w kodzie.

| Stan (id) | Etykieta docelowa PL | Kiedy | Kolor kropki | Stan dzisiejszy |
|---|---|---|---|---|
| `saved` | **Zapisano** (np. „Zapisano 3s temu") | ostatni zapis zakończony sukcesem | neutralna | działa 1:1 |
| `saving` | **Zapisuję…** | trwa zapis do serwera | neutralna, pulsująca | działa 1:1 |
| `queued` | **Kolejka** (dziś: „Zmiany w kolejce") | zmiana czeka na wysłanie (debounce/retry) | neutralna, pulsująca | działa; etykieta do skrócenia dla spójności z resztą stanów |
| `idle`/brak `lastSavedAt` | **Szkic lokalny** (dziś: „Draft lokalny") | jeszcze nic nie zapisano na serwer | neutralna | działa; ujednolicić PL („Szkic" zamiast zapożyczenia „Draft") |
| `offline` | **Offline** (dziś: „Offline - zapis w kolejce") | brak połączenia z serwerem | ostrzegawcza (`c-warning`) | działa 1:1 |
| `conflict` | **Konflikt** (dziś: „Konflikt zmian") | serwer odrzucił zapis (409, `baseVersion` niezgodny) | krytyczna (`c-danger`) | działa jako WYKRYCIE; **brak UI rozwiązania**, patrz §4.1 |
| `readonly` | **Tylko odczyt** | brak uprawnień do edycji (rola/udostępnienie) | neutralna, ikona kłódki | ⟦DO USTALENIA⟧ — brak modelu uprawnień w audycie (luka L7 crosscheck); stan nie istnieje dziś w typie `IdeaSaveState` |

### 4.1. Minimalny standard konfliktu

**Stan dzisiejszy:** backend ma optimistic-lock (`baseVersion` + odpowiedź `409`,
`server/src/routes/my-work.routes.ts`), ale front-end dziś **samoleczy się cicho** — do 2 prób
ponowienia zapisu z poprawioną wersją (`conflictRetryRef`), bez pokazania czegokolwiek
użytkownikowi poza kropką „Konflikt" przez chwilę. **Nie ma UI porównania wersji ani zachowania
kopii** — to nie jest bug do naprawienia, to brakująca funkcja (potwierdzone w cross-checku, punkt
M5: „dziś jest optimistic-lock + 409, ale BRAK UI porównania/scalania — to nowa funkcja, nie fix").

**Standard minimalny (docelowy), wymagany zanim stan `conflict` może się pokazać użytkownikowi bez
dalszego auto-retry:**

1. **Wykrycie:** serwer zwraca `409` (wersja lokalna ≠ wersja serwera). Auto-retry (dzisiejszy
   mechanizm 2 prób z natychmiastowym pobraniem świeżej wersji) zostaje jako pierwsza linia — user
   nie widzi konfliktu przy prostym wyścigu zapisów.
2. **Gdy auto-retry się wyczerpie** (nadal 409 po 2 próbach) → pokazać dialog konfliktu, nie tylko
   kropkę w Menu 1. Dialog pokazuje minimum:
   - że coś zmieniło ideę w międzyczasie (kto/kiedy, jeśli dane dostępne — inaczej ogólny komunikat),
   - dwie opcje: **(a)** odśwież do wersji serwera (odrzuć moje niezapisane zmiany) **(b)** zachowaj
     moją wersję jako kopię (nie nadpisuj cudzej pracy).
3. **Zachowanie kopii (opcja b):** lokalna wersja NIGDY nie ginie cicho. Zapisać ją jako
   duplikat/szkic do odzyskania (mechanizm duplikacji Idei już istnieje — `idea.duplicate`, §7 —
   można go reużyć jako backend tej opcji).
4. **Nie wymagane w standardzie minimalnym:** automatyczny merge pole-po-polu / element-po-elemencie
   grafu. ⟦DO USTALENIA⟧ czy scalanie granularne (np. per-węzeł) wchodzi do zakresu — dziś ani
   audyt, ani standard OpenAI tego nie rozstrzyga.

To trafia do planu naprawczego jako pozycja **F0 — integralność danych** (obok naprawy `promote()`,
§6.3).

## 5. Teresa — co dostaje w kontekście

Wejście: przycisk „Teresa" (ghost, zawsze widoczny) → `handleDiscussWithTeresa`.

**Stan dzisiejszy (działa):**
1. Bierze aktualny graf (`nodes`/`edges` żywe z ref, nie stale) — **całej Idei**, niezależnie od
   tego, która reprezentacja jest otwarta.
2. Konwertuje graf do czytelnego outline'u markdown (`ideaMapToMarkdown`) z tytułem Idei.
3. Buduje wiadomość startującą rozmowę z tym outline'em wstrzykniętym do promptu.
4. Jeśli włączony most kontekstu encji (`mindmapTeresaBridgeEnabled`) — otwiera czat z
   `entityType:'idea'`, `entityId`, `entityName`, żeby drugie kliknięcie na tę samą Ideę
   kontynuowało tę samą rozmowę zamiast tworzyć nową za każdym razem.
5. Pusta Idea (zero elementów) → toast informacyjny zamiast otwarcia czatu (honest-disabled, nie
   cichy no-op).

**Standard docelowy (Z4 — Teresa steruje wszystkim, przez `ActionRegistry`):**
- Kontekst przekazywany Teresie z Menu 1 = pełny graf aktualnej Idei (nie tylko aktywnej
  reprezentacji) + metadane (etap, `area`, `priorytet`) + link do kontynuacji rozmowy (`ideaId`).
- Teresa nie dostaje żadnych możliwości poza tym, co jest w rejestrze akcji jako dostępne z
  poziomu `workspace` — bez „ukrytych mocy" (zasada bezpieczeństwa z §Z4 rdzenia standardu).
- Każda akcja, którą Teresa wykona na Idei (np. „skonwertuj to na inicjatywę") trafia do Historii z
  oznaczeniem „AI" i treścią polecenia.
- ⟦DO USTALENIA⟧ czy Menu 1 ma docelowo wzbogacić kontekst o skrócony log ostatnich zmian
  (historia) — nie potwierdzone w źródłach.

## 6. Convert całej Idei

Wejście: primary CTA **„Konwertuj ▾"** (`IdeaConvertMenu`), scope zawsze `workspace` (cała Idea —
w przeciwieństwie do Convert z menu węzła/zaznaczenia, które ma scope węższy, patrz `07` w audycie
duplikatów; to jest jawna, opisana różnica zakresu, nie duplikat błędu).

### 6.1. Targety konwersji (SSOT: `src/components/MyWork/ideaConvertTargets.ts`)

| Grupa | Target | Etykieta PL | Status |
|---|---|---|---|
| Akcje robocze | `initiative` | Inicjatywa | ✅ live |
| Akcje robocze | `task_set` | Taski | ✅ live |
| Akcje robocze | `decision` | Decyzja | ✅ live |
| Akcje robocze | `team_chat` | Team Chat | ✅ live |
| Generatory dokumentów | `report` | Raport | ✅ live |
| Generatory dokumentów | `presentation` | Prezentacja | ✅ live |
| AI-artefakty | `action_plan` | Plan działania | 🚩 soon (honest-disabled) |
| AI-artefakty | `raid_log` | RAID Log | 🚩 soon |
| AI-artefakty | `financial_model` | Model finansowy | 🚩 soon |
| AI-artefakty | `budget` | Budżet | 🚩 soon |
| AI-artefakty | `valuation` | Wycena | 🚩 soon |
| AI-artefakty | `analysis` | Analiza | 🚩 soon |

`soon` = widoczne jako disabled z uczciwym powodem („wkrótce"), nigdy wysyłane do backendu (kontrakt
FE-live ⊆ server allowlist, egzekwowany testem — wzorcowy przykład Z3 w praktyce).

### 6.2. Wymóg podglądu

**Stan dzisiejszy:** ⟦DO USTALENIA⟧ czy `IdeaConvertMenu` dziś pokazuje podgląd przed wysłaniem —
nie potwierdzone wzrokiem w źródłach tej sesji.

**Standard docelowy:** Convert = tworzy trwały artefakt (D6 — Convert ≠ Export), więc podlega
regule z draft standardu §7: *„każda operacja tworząca/nadpisująca = preview + undo + zachowany
link do źródła"*. Minimalny podgląd przed potwierdzeniem:
- jaki dokładnie zakres Idei zostanie użyty (cała Idea — bo scope tu zawsze `workspace`),
- jaki typ artefaktu powstanie,
- że operacja jest niedestrukcyjna dla źródła (Idea zostaje, tylko oznaczona jako powiązana).

### 6.3. Zapis źródła — naprawa integralności danych (R2/A5)

**Stan dzisiejszy — poważne ryzyko danych:** backend `promote()` nadpisuje `promoted_to`/`stage`
CAŁEJ Idei **bezwarunkowo**. Konwersja fragmentu (np. 2 z 40 węzłów przez Convert z menu gałęzi)
oznacza całą Ideę jako promowaną i **gubi ślad poprzedniej konwersji** — nieodwracalne bez ręcznej
naprawy bazy (Executive Summary, ryzyko R2, waga Wysoka).

**Standard docelowy (decyzja właściciela A5):** backend ma zapisywać **wiele konwersji**, nie
nadpisywać pojedyncze pole `promoted_to`. Każda konwersja (z Menu 1 lub z węższego scope) zapisuje
osobny wpis: `{target, scope, nodeIds?, timestamp, artifactId}` — Idea może mieć wiele powiązanych
artefaktów jednocześnie, bez utraty poprzednich. To trafia do planu naprawczego jako **F0**, razem
z konfliktem zapisu (§4.1) — obie pozycje dotyczą integralności danych i mają iść równolegle z
pisaniem standardu (decyzja D4 właściciela), nie czekać na niego.

## 7. Kebab globalny `⋯`

### 7.1. Co wolno

| Pozycja | Etykieta PL | Scope | Handler (dziś) | Stan |
|---|---|---|---|---|
| Grupa główna | Eksport | `workspace` | `setExportMenuOpen`→`IdeaExportMenu` | ✅ działa |
| Grupa główna | Historia | `workspace` | `setSnapshotHistoryOpen`→`SnapshotHistory` | ✅ działa (4 narzędzia) |
| Grupa główna | Duplikuj | `workspace` | `handleDuplicateIdea`→`POST /my-ideas/:id/duplicate` | ✅ działa |
| Grupa główna | Usuń | `workspace` | `handleDeleteIdea`→`DELETE /my-ideas/:id` | ✅ działa (danger) |
| Podmenu „Więcej" | Szukaj | `current_view`/graf | `setSearchOpen`→`IdeaUnifiedSearch` | ✅ działa |
| Podmenu „Więcej" | Skróty | `workspace` | `setShowHelp`→`KeyboardShortcutsPanel` | ✅ działa |
| **NOWA (D1)** | Udostępnij | `workspace` | ⟦DO USTALENIA⟧ handler docelowy | patrz §7.2 |

### 7.2. ★ D1 — zakładka „Akcje" przenosi się tu

Decyzja właściciela D1 (wspólny kanon prawego panelu, `_DECYZJE_I_KANON_WSPOLNY_2026-07-23.md`):
zakładka „Akcje" znika z prawego panelu jako osobna zakładka informacyjna — akcja to czynność, nie
informacja, więc jej miejsce jest w Menu 1, nie w panelu inspektora. Konkretnie: **Eksport** i
**Udostępnij** (treść dawnej zakładki „Akcje") lądują w kebabie Menu 1, obok istniejących już tu
Eksportu/Historii/Duplikuj/Usuń. Eksport już tu jest (§7.1) — jedyny realny dodatek to
**Udostępnij**, którego handler docelowy nie jest opisany w żadnym źródle tej sesji
(⟦DO USTALENIA⟧).

### 7.3. Czego NIE wolno

- **Żadnej akcji specyficznej dla jednej reprezentacji** (np. „Waliduj" Process Flow, „Zapisz
  widok" Whiteboard) — to Menu 3 lub powierzchnia narzędzia.
- **Żadnej mutacji na zaznaczeniu** — kebab globalny ma zawsze scope `workspace`, nigdy
  `selected_items`/`single_item`. Akcje na zaznaczeniu żyją w pływającym pasku zaznaczenia/menu
  kontekstowym.
- **Przełącznika reprezentacji** — to D2, prawy dolny róg, nie kebab.
- **Convert** — ma własny primary CTA („Konwertuj ▾"), nie chowa się w kebabie (żeby nie było
  trzeciego wejścia do tej samej funkcji obok Menu 1 primary i menu zaznaczenia).

## 8. Tabela akcji Menu 1 (kanon kolumn wg kontraktu)

| id akcji | etykieta PL | ikona | zakres | reprezentacje | handler | efekt | undo |
|---|---|---|---|---|---|---|---|
| `idea.teresa.discuss` | Teresa | `MessagesSquare` | workspace | wszystkie | `handleDiscussWithTeresa` → `openChat`/`openChatWithContext` | otwiera czat AI z kontekstem grafu | nie dotyczy (nie mutuje) |
| `idea.convert` | Konwertuj ▾ | `Workflow` | workspace | wszystkie | `IdeaConvertMenu` → `Api.convertMyIdea` | tworzy nowy artefakt + zapis powiązania źródła (§6.3) | ⟦DO USTALENIA⟧ (cofnięcie = usunięcie utworzonego artefaktu?) |
| `idea.export` | Eksport | `Download` | workspace | wszystkie | `setExportMenuOpen` → `IdeaExportMenu` | tworzy plik poza systemem | nie dotyczy |
| `idea.share` | Udostępnij | `Share2` | workspace | wszystkie | ⟦DO USTALENIA⟧ | udostępnia Ideę (D1) | nie dotyczy |
| `idea.history` | Historia | `History` | workspace | wszystkie | `setSnapshotHistoryOpen` → `SnapshotHistory` | pokazuje/przywraca wersje grafu | tak — przywrócenie tworzy nowy punkt historii, cofalne |
| `idea.duplicate` | Duplikuj | `Copy` | workspace | wszystkie | `handleDuplicateIdea` → `POST /my-ideas/:id/duplicate` | klon Idei + grafu | nie dotyczy (nowy obiekt) |
| `idea.delete` | Usuń | `Trash2` | workspace | wszystkie | `handleDeleteIdea` → `DELETE /my-ideas/:id` | usuwa Ideę | ⟦DO USTALENIA⟧ (kosz/przywracanie?) |
| `idea.search` | Szukaj | `Search` | workspace (przeszukuje graf) | wszystkie | `setSearchOpen` → `IdeaUnifiedSearch` | szuka w grafie | nie dotyczy |
| `idea.shortcuts` | Skróty | `Keyboard` | workspace | wszystkie | `setShowHelp` → `KeyboardShortcutsPanel` | pokazuje pomoc | nie dotyczy |

Każda pozycja wymaga wpisu `teresa: {description, parameters}` w rejestrze (Z4) — brak wpisu jest
błędem projektu, nie wyjątkiem dopuszczalnym dla Menu 1.

## Kryteria odbioru

- [ ] Nazwa Idei nigdy nie zawiera dopisanej nazwy reprezentacji (sprawdzić na wszystkich 4 narzędziach dla tej samej Idei — tytuł identyczny).
- [ ] Wskaźnik zapisu pokazuje właściwy stan z 7 (Zapisano/Zapisuję/Kolejka/Szkic lokalny/Offline/Konflikt/Tylko odczyt) w odpowiedniej sytuacji; kolor kropki zgodny z tabelą §4.
- [ ] Przy konflikcie zapisu (409 po wyczerpaniu auto-retry) pokazuje się dialog z opcjami „odśwież do wersji serwera" / „zachowaj moją kopię" — nie tylko cicha zmiana kropki.
- [ ] Kliknięcie „Teresa" otwiera czat z kontekstem CAŁEGO grafu Idei (nie tylko widocznej reprezentacji) i kontynuuje wcześniejszą rozmowę o tej samej Idei, jeśli istnieje.
- [ ] „Konwertuj ▾" pokazuje 3 grupy (Akcje robocze/Generatory dokumentów/AI-artefakty), `soon`-targety są disabled z tooltipem, żaden `soon` nie trafia do backendu.
- [ ] Konwersja fragmentu Idei nie nadpisuje statusu całej Idei bezwarunkowo (weryfikacja: 2 konwersje pod rząd na tej samej Idei — obie widoczne, żadna nie zgubiona).
- [ ] Kebab zawiera dokładnie: Eksport, Historia, Duplikuj, Usuń, Udostępnij (D1) + podmenu Więcej: Szukaj, Skróty — nic specyficznego dla jednej reprezentacji, brak przełącznika reprezentacji.
- [ ] Żadna pozycja Menu 1 nie jest cichym no-op — disabled ma zawsze widoczny powód (tooltip), nie tylko wyszarzenie.
- [ ] Wszystkie pozycje z tabeli §8 mają wpis `teresa.description` w rejestrze akcji — dające się wywołać rozmową.
- [ ] Weryfikacja wzrokiem (dark + light), na żywym ekranie, nie tylko w kodzie/na flagach.
