# G06 — naprawa dostępności (axe), moduł 07_MY_WORK_AGENT — 2026-09-03

Robotnik naprawczy programu odbioru G06. Worktree `/private/tmp/ag-fix-a11y-05-08`,
gałąź `agent/fix-a11y-05-08-20260903`, harness na porcie 5331. Największy moduł
(40 ekranów, w tym 4 rodziny kanw: mindmap/whiteboard/processflow/melscanvas).

## Wynik: PRZED → PO (pl-1440)

| Miara | PRZED | PO (pierwsza runda, po commicie f2ea4ae130) | PO (po dodatkowej rundzie kalendarza) |
|---|---|---|---|
| Kadrów z realnym naruszeniem | **54 / 80** | **13 / 80** | zmierzone punktowo, patrz niżej |
| Wystąpień reguł łącznie | 77 | 15 | — |

Pełny pomiar en-1024 **nie został wykonany** — budżet czasu dyżuru wyczerpał
się na pl-1440 (patrz „Dyscyplina czasu" w instrukcji). Ryzyko: fixy są
strukturalne (role ARIA, kolory tokenów) i niezależne od języka/szerokości —
prawdopodobieństwo regresji w en-1024 niskie, ale **niezweryfikowane
pomiarem**.

## Mapa: reguła → komponent → plik (naprawione)

- **`landmark-main-is-top-level`** (16 kadrów, 8 ekranów →
  **0 po naprawie**): `src/components/MyWork/IdeaMapWorkspace.tsx` —
  zewnętrzny wrapper `role="region"` duplikował `<main>` renderowany w
  środku przez `ExecutiveModuleShell` (tryb canvas). Usunięto role/aria-label
  z obu wariantów (mels/legacy) — `<main>` już niesie własny `aria-label`.

- **`aria-required-parent`** (10 kadrów, 5 ekranów idea-table-tool-* →
  **0 po naprawie**): `src/components/MyWork/table/GridView.tsx` +
  `ViewRouter.tsx` — `role="gridcell"` wymaga kontekstu grid/treegrid którego
  nie ma (zwykła tabela semantyczna). Próba 1 (`role="cell"`) NADAL padała —
  element siedzi wewnątrz prawdziwego `<td>`, który już ma WŁASNĄ implicit
  rolę komórki (zagnieżdżenie cell-w-cell myliło sprawdzenie wymaganego
  rodzica axe). Naprawa ostateczna: element bez własnej roli (rodzic `<td>`
  już niesie semantykę), plus jawna `role="row"` na `<tr>` (empirycznie
  potrzebna — implicit `display:table-row` nie wystarczył).

- **`color-contrast` — opacity × kolor** (największy pojedynczy klaster, 75
  węzłów na jednym ekranie): `src/components/AIChat/AgentWorkshopPalette.tsx`
  (`opacity-55` na pozycjach „wkrótce" w palecie klocków agenta — usunięte,
  tekst pełnoopacity + przerywana ramka + plakietka „Wkrótce" wystarczają jako
  sygnał stanu), `src/components/MyWork/Calendar/CalendarSidebar.tsx`
  (`opacity-70` na przyciskach niedostępnych źródeł kalendarza — usunięte).

- **`color-contrast` — płaskie tokeny sygnałowe poniżej progu**:
  `NotificationDetailView.tsx`, `IdeaWorkspaceTools.tsx`, `InboxContent.tsx`,
  `IdeaTemplateGallery.tsx`, `calendar-theme.css` (nagłówek dni tygodnia
  FullCalendar, light I dark osobno — dwie różne reguły w pliku).

- **`color-contrast` — biały tekst na DOWOLNYM kolorze per-użytkownik/pole**:
  `NotebookPresenceStack.tsx` (avatary obecności — `color-mix` 35% czerni
  gwarantuje ≥4,5:1 niezależnie od wejścia), `CellRenderer.tsx` (select-cell
  idei, ten sam wzorzec). **Lekcja z tej naprawy**: pierwsza próba zastąpiła
  `#334155` przez `var(--c-tag-foreground)` (biel) globalnie we WSZYSTKICH
  wystąpieniach tego samego literalnego stringu w pliku — błędna generalizacja,
  bo `StatusCell` w tym samym pliku ma WŁASNĄ, oddzielną paletę jasnych
  pasteli (`#e0e7ff`/`#fef3c7`/`#d1fae5`/`#fee2e2`) zaprojektowaną pod CIEMNY
  tekst (8,4–9,3:1) — biel tam dawała 1,1–1,2:1. Cofnięte po zmierzeniu.
  `PlatformCellRenderer.tsx` (dwa analogiczne miejsca) też cofnięte —
  brak dowodu że jego paleta jest tag-kompatybilna.

- **`nested-interactive`** (3 z 5 kadrów naprawione):
  `src/components/shared/NModeLayout/NModeLeftNav.tsx` (już naprawione przy
  module 05_INITIATIVES, ten sam komponent renderuje się tu),
  `src/components/shared/NModeSections/CommentsCanvas.tsx` (przycisk
  usuń-komentarz przeniesiony z dziecka `<button>` na rodzeństwo przycisku
  wiersza).

- **`button-name`** (critical, 3 ekrany): `CommentsCanvas.tsx`,
  `RecordTemplateManager.tsx` (2×), `IdeaTemplateGallery.tsx` — przyciski-X
  bez tekstu dla czytnika ekranu dostały `aria-label`.

- **`aria-prohibited-attr`**: `src/components/ui/ResizableTable/ColumnResizer.tsx`
  (współdzielony, dotyka też kanonicznego `FilterableTable`) — `aria-label`
  na `<div>` bez roli → `role="separator"` (poprawna semantyka uchwytu-dzielnika
  kolumn, `aria-label` jawnie dozwolony na tej roli).

- **`empty-table-header`** (minor): `FinancialDriverTable.tsx` (2×),
  `ViewRouter.tsx` (kolumna checkboxów) — puste `<th>` dostały `sr-only`
  etykiety.

- **`heading-order`** (1 z 2 kadrów naprawiony): `src/components/shared/states/EmptyState.tsx`
  dostał opcjonalny `headingLevel` prop (domyślnie `h3`, w pełni wsteczny dla
  wszystkich pozostałych ~190 wywołań w apce) — `TransformationCasesPanel.tsx`
  (błąd ładowania na `agent-hub`) używa `h2`, bo renderuje się bezpośrednio po
  `h1` hosta bez `h2` pomiędzy.

- **`landmark-unique`** (1 z 2 kadrów naprawiony): `src/components/shared/ExecutiveModuleShell/RightRail.tsx`
  — `<aside>` bez `aria-label` (lewy+prawy rail jednocześnie w
  `ExecutiveModuleShell`) dostał etykietę per strona (lewy/prawy).

- **`scrollable-region-focusable`**: `src/components/AIChat/AgentPlanCanvas.tsx`
  — pusty plan (brak klocków) miał scrollowalny kontener bez żadnego elementu
  fokusowalnego; `tabIndex={0}` na kontenerze (standardowa naprawa APG).

## Naruszenia szumu hosta (dowód: selektor + plik harnessu)

Trzy przypadki, wszystkie udowodnione przez odczyt kodu harnessu (dev-render),
NIE naprawiane w src/ zgodnie z instrukcją:

1. **`landmark-unique` na `agent-plan-canvas`** (2 kadry): `dev-render/screens/agent-plan-canvas.tsx`
   montuje TEN SAM realny `AgentPlanPanel` DWA RAZY obok siebie (świadome demo
   porównawcze „Ścieżka ① vs ②", udokumentowane w komentarzu nagłówkowym pliku)
   — w realnej aplikacji jeden plan = jeden mount, więc duplikat etykiet
   landmarków („Sterowanie agentem"/„Paleta klocków agenta" ×2) nie wystąpi.

2. **`heading-order` na `ideas-preview-overlay`** (2 kadry): `<h4>` to bespoke
   harnessowa replika (`dev-render/screens/ideas-preview-overlay.tsx:303`) obok
   WŁASNEGO `<h1>` hosta (linia 237) — ekran NIE importuje realnego
   `MyIdeasListContent`, tylko odtwarza jego wygląd ręcznie do demonstracji
   „zero-reflow" podglądu. Realny układ nagłówków `MyWorkHub`/`MyIdeasListContent`
   (który TEŻ używa `<h4>` dla tytułów kart, `src/components/MyWork/MyIdeasListContent.tsx:1990`)
   nie został zmierzony w tym dyżurze — możliwy realny problem poza zakresem
   dowodu.

3. **`color-contrast` na `notatnik-centrum-mysli`** (przycisk „Zatwierdź",
   biel na `#3fb950`): `dev-render/screens/notatnik-centrum-mysli.tsx:160`
   — przycisk zbudowany BEZPOŚREDNIO w pliku harnessu (`style={{ background:
   'var(--c-success)' }}`), nie import żadnego komponentu z `src/`. Token
   `--c-success` w dark (`#3fb950`) rzeczywiście nie daje 4,5:1 z bielą — to
   realne ryzyko projektowe tokenu, ale POZA zakresem tej naprawy skoro
   markup jest harnessowy. **Warto zgłosić osobno** (spawn_task poniżej).

## Naprawy próbowane, ale NIEUKOŃCZONE — udokumentowane uczciwie

- **`nested-interactive` na `mindmap-canvas` + `mywork-idea-topbar`** (węzły
  ReactFlow typu „idea", 2 kadry × 2 ekrany): dodano `nodesFocusable={false}`
  na `<ReactFlow>` w `src/components/MyWork/IdeaRecommendationMap.tsx`,
  analogicznie do istniejącego per-węzeł `focusable:false` dla typu „branch"
  (`useMindMapPersistence.ts` — zweryfikowane że DZIAŁA: węzły branch faktycznie
  tracą `role="button"`). Węzły „idea" mimo globalnego wyłącznika NADAL
  renderują się z `role="button" tabindex="0"` — przyczyna nie ustalona w
  budżecie tego dyżuru (możliwe: inna instancja ReactFlow, albo mechanizm
  `nodesFocusable` nie propaguje się tak jak per-węzłowy `focusable`).

- **`color-contrast` na `idea-table-timeline-stuck`** (5 węzłów, biały
  `color: var(--c-tag-foreground)` bez ŻADNEGO `backgroundColor` w
  obliczonym stylu): zmierzone przez `IdeaTableTool.tsx` (selektor z
  `data-row`/`data-col`), źródło DOKŁADNEGO komponentu nie ustalone — dwie
  próby naprawy w `CellRenderer.tsx` (SelectCell przez `bgColor`, potem
  `color-mix`) nie zmieniły wyniku pomiaru, co oznacza że to NIE jest ten
  kod (albo jest zasłonięty przez coś innego w łańcuchu renderowania).

- **`aria-required-children` na `mywork-idea-topbar`** (`div[role="tablist"]`,
  `MyWorkHub.tsx`, karty otwartych dokumentów): przycisk zamknięcia karty
  (bez własnej roli) efektywnie „spłaszcza się" jako niedozwolone dziecko
  tablist przez pośredniczący `<div>` bez roli. Poprawny fix wymaga
  restrukturyzacji wzorca ARIA-tabs-z-przyciskiem-zamknięcia (albo przeniesienia
  przycisku poza DOM tablist, albo przeprojektowania na `role="tab"` na
  wrapperze z osobnym ryzykiem `nested-interactive`) — celowo pominięty:
  ryzyko zamiany jednego naruszenia na inne bez czasu na pełną weryfikację.

- **Kalendarz FullCalendar — pozostałe naruszenia dark/light** (dodatkowa
  runda po pełnym pomiarze PO, commit `80a58ebd58`): naprawiono nagłówek dni
  tygodnia (light i dark — dwie osobne reguły w `calendar-theme.css`) i 3×
  `dark:text-slate-500` (identyczny odcień co light — bug) w
  `CalendarSidebar.tsx`. Próba naprawy dni „innego miesiąca" (`.fc-day-other`)
  **nie zadziałała** — FullCalendar aplikuje własną `opacity` na `<td>`, która
  dociera do potomków przez kompozycję pikseli; `opacity:1` na `<td>` sam nie
  wystarczył (zmierzone PO: identyczna, zbyt jasna wypadkowa barwa
  `#d1d5dc`/`#333b4c`). Dodatkowo odkryto NOWE, niezmierzone wcześniej
  naruszenia: plakietki wydarzeń (`fc-event-lineage`/`fc-event-title`) na
  kolorowym tle wydarzenia (jasny tekst na crimson/niebieskim tle wydarzenia,
  4,0–4,4:1) i etykiety godzin widoku dziennego (`fc-timegrid-slot-label`,
  ten sam wzorzec `#64748b` na ciemnym tle co nagłówek). Wymaga osobnego,
  głębszego audytu CSS FullCalendar — poza budżetem tego dyżuru.

## Komendy pomiaru

```
node scripts/dev/grafika-zrzuty.mjs --base=http://127.0.0.1:5331 \
  --ekrany=<40 ekranow modulu 07, patrz scripts/dev/g06-macierz-ekrany.json> \
  --katalog=07-mywork-przed --faza=PRZED --jezyk=pl --szerokosc=1440 \
  --motywy=light,dark --rozwin-sekcje=1 --a11y=1 \
  --wyjscie=<poza repo> --wynik-json=<poza repo>/wynik.json

# analogicznie --faza=PO (dwie rundy — patrz tabela wyzej)
```

Selektory/html węzłów zdobyto osobnym diagnostycznym przelotem axe (nie
commitowanym, replikującym dokładnie tę samą sekwencję interakcji co
narzędzie kanoniczne, bo `grafika-zrzuty.mjs` zapisuje w `wynik.json` tylko
`id`/`impact`/liczbę węzłów).

## Surowe dane (poza repo, nie commitowane — screenshoty)

- `/private/tmp/ag-fix-a11y-05-08-artefakty/07_MY_WORK_AGENT/przed-pl-1440/`
- `/private/tmp/ag-fix-a11y-05-08-artefakty/07_MY_WORK_AGENT/po-pl-1440/` (dwie rundy nadpisane — ostatnia = po commicie f2ea4ae130, PRZED dodatkowej rundy kalendarza)

## Konsola / błędy sieci

Brak błędów konsoli poza standardowym szumem 404 na `/api/**` (harness bez
backendu). Brak innych błędów HTTP.

## Podsumowanie liczbowe

PRZED: 54/80 kadrów (77 wystąpień reguł). PO (pierwsza runda, commit
`f2ea4ae130`): 13/80 kadrów (15 wystąpień). Dodatkowa runda kalendarza
(commit `80a58ebd58`) zamknęła 2 z tych 15 wystąpień (nagłówek dni tygodnia
light+dark) w pełni potwierdzonym pomiarem punktowym; pozostałe
kalendarzowe naruszenia NIE ustąpiły i odsłoniły dodatkowe, wcześniej
niezmierzone naruszenia w tych samych ekranach (plakietki wydarzeń,
etykiety godzin) — całościowy stan po tej rundzie nie został potwierdzony
pełnym przelotem 80 ekranów z powodu budżetu czasu.

---

# Runda 2 — 2026-09-03 (drugi robotnik naprawczy)

Worktree `/private/tmp/ag-fix-a11y-07`, gałąź `agent/fix-a11y-07-20260903`
(baza `fc6ff7ed9e`), harness na porcie 5335. Zakres: 13 kadrów, które runda 1
zostawiła otwarte.

## Wynik: PRZED → PO

| Miara | PRZED (runda 2) | PO |
|---|---|---|
| Kadrów z realnym naruszeniem, pl-1440 | **13 / 80** | **0 / 80** |
| Wystąpień reguł, pl-1440 | 15 | **0** |
| Kadrów z realnym naruszeniem, en-1024 | (niemierzone w rundzie 1) | **0 / 80** |

Szum hosta odjęty zgodnie z instrukcją: `landmark-one-main`,
`page-has-heading-one`, `region`.

## Mapa: reguła → węzeł → komponent → plik

### 1. `nested-interactive` — mindmap-canvas + mywork-idea-topbar (4 kadry)

Węzeł: `div[data-id="idea-scope-1"].react-flow__node-idea` z `role="button"
tabindex="0"`, a w środku prawdziwe `<button>`.

**Przyczyna, której runda 1 nie ustaliła**: `nodesFocusable={false}` BYŁO
ustawione w `src/components/MyWork/IdeaRecommendationMap.tsx`, ale stało
**przed** `{...getIdeasToolInteractionProps('mindmap', …)}`, a ta funkcja
(`src/components/MyWork/canvas/useIdeasToolDefaults.ts:54`) zwraca
`nodesFocusable: true`. Spread cicho nadpisywał jawny prop. Naprawa: prop
przeniesiony ZA oba spready. Zmierzone: mindmap-canvas light+dark → 0,
mywork-idea-topbar `nested-interactive` → 0 (ten sam komponent).

### 2. `aria-required-children` — mywork-idea-topbar (2 kadry, critical)

Węzeł: `div[role="tablist"].contents` („Otwarte dokumenty"), niedozwolone
dziecko `button[aria-label]` (przycisk „zamknij kartę").

`role="tablist"` może własnościowo zawierać wyłącznie `role="tab"`. Pośredni
`<div class="group">` bez roli nie odgradza przycisku zamknięcia od tablist.
Odrzucone warianty: przycisk pod zakładką → `nested-interactive` (zamiana
naruszenia na inne); `role="presentation"` na przycisku → ARIA rozwiązuje
konflikt z powrotem do `button`.
Naprawa (`src/components/MyWork/MyWorkHub.tsx`): tablist nie zawiera pastylek
w DOM — przejmuje same zakładki przez `aria-owns`. Zmierzone: 0.

### 3. `color-contrast` — idea-table-timeline-stuck (5 węzłów, 1,04:1)

**Źródło, którego runda 1 nie znalazła**: `SelectCell` w
`src/components/MyWork/table/CellRenderer.tsx`. Naprawa z rundy 1 (`color-mix`
z czernią) **była w tym pliku**, ale nie działała, bo fixture trzyma w
`optionColors` NAZWY palety (`'slate'`/`'amber'`/`'emerald'`), a nie kolory
CSS — `color-mix(in srgb, slate 65%, black 35%)` jest niepoprawne, więc
przeglądarka odrzucała CAŁĄ deklarację tła i plakietka zostawała bez tła, z
białym tekstem na tle strony. Zmierzone wprost: `getAttribute('style')` =
tylko `color: var(--c-tag-foreground)`.

Naprawa dwuczęściowa: (a) odsiew wartości, która nie jest kolorem CSS
(`isCssColorValue`, fallback na token palety po indeksie opcji); (b)
odwrócony kierunek kontrastu — tło rozjaśniane do ≥65% bieli, stały ciemny
atrament `#0f172a`. Najgorszy możliwy przypadek (tło = czerń) daje #a6a6a6
pod #0f172a = 7,0:1; najlepszy 17:1 — próg spełniony dla KAŻDEGO wejścia bez
zgadywania, którego tokenu użyje dane. Ta sama rodzina naprawiona w
`MultiSelectCell` (stały `#334155` na `var(--c-tag-1)` #3b8ea5 = 2,76:1) i
odsiew w `StatusCell` (przy nazwie palety tło znikało, a ciemny tekst lądował
na ciemnym tle strony w motywie ciemnym).

### 4. `color-contrast` — mywork-calendar dark (14) + mw-007-calendar-narrow-viewport (light 4, dark 5)

Trzy niezależne przyczyny:

- **Plakietki wydarzeń**: FullCalendar pisze jasnym tekstem (tytuł `#ffffff`,
  rodowód `#e6f2ff`/`#f9dfe2` przy `opacity: .85`), a tło bierze z
  `CalendarGrid.tsx` — z koloru źródła albo z `e.color`, czyli wartości spoza
  naszej kontroli. Zmierzone: 2,52:1 (tytuł na `--c-info` #58a6ff), 2,22:1
  (rodowód), 4,40:1 (rodowód na crimson #c72839 w motywie jasnym). Naprawa:
  tło każdego wydarzenia przyciemniane do `color-mix(in srgb, X 35%, black
  65%)`. Najgorszy przypadek (X = biel) → #595959: 7,2:1 dla tytułu i 5,3:1
  dla rodowodu. Odcień źródła zostaje rozpoznawalny; sprawdzone, że
  `color-mix` z `var()` REALNIE się renderuje (computed bg = `color(srgb
  0.12 0.23 0.35)`, nie `transparent`).
- **Etykiety godzin** (`.fc-timegrid-slot-label`): `#64748b` na `#0a0f1e` =
  4,01:1 → `#94a3b8` (6,96:1), motyw ciemny; jasny ma własne nadpisanie
  `#475569` i został bez zmian.
- **Dni sąsiedniego miesiąca**: ★ SPROSTOWANIE rundy 1 — `opacity` NIE siedzi
  na `<td class="fc-day-other">`, tylko na jego dziecku
  (`.fc-day-other .fc-daygrid-day-top { opacity: .3 }` w samym FullCalendar).
  `opacity: 1` na `<td>` z rundy 1 nic nie zmieniało (zmierzone: wypadkowa
  nadal #d1d5dc = 1,47:1 na białym). Reguła przeniesiona na właściwy element.

### 5. `landmark-unique` — agent-plan-canvas (2 kadry)

Runda 1 uznała to za szum hosta (harness montuje `AgentPlanPanel` dwa razy).
Pomiar potwierdza pochodzenie z hosta, ALE przyczyną jest przybita na sztywno
nazwa landmarku w `src/`: `AgentWorkshopControls.tsx` („Sterowanie agentem")
i `AgentWorkshopPalette.tsx` („Paleta klocków agenta"). Dwie komplementarne
okolice o identycznej nazwie są nierozróżnialne dla czytnika ekranu — to
realna wada API komponentu, nie tylko przyrządu. Naprawa: nazwa niesie tytuł
planu (`plan.title`); paleta dostała opcjonalny `ariaLabel` z dotychczasową
wartością domyślną, więc żadne istniejące wywołanie nie zmienia zachowania.

## Naprawy w HOŚCIE (dowód: węzeł pochodzi z `dev-render/`, nie z `src/`)

- **`heading-order` — ideas-preview-overlay** (2 kadry): pasek harnessu
  (`dev-render/screens/ideas-preview-overlay.tsx`, `data-dev-render-chrome`)
  wstrzykiwał `<h1>` w ŚRODEK mierzonego drzewa, nad repliką kart zaczynającą
  się od `<h4>` — sztuczny przeskok h1→h4, którego w aplikacji nie ma. Chrome
  przyrządu nie ma prawa dokładać semantyki nagłówków do produktu: ten sam
  wygląd, bez roli nagłówka. Zmierzone: 0.
- **`color-contrast` — notatnik-centrum-mysli dark** (2 węzły): przycisk
  „Zatwierdź" zbudowany wprost w harnessie, biel na samym `--c-success`
  (#3fb950) = 2,54:1. Tło przyciemnione tym samym zabiegiem co plakietki
  kalendarza. ★ Token `--c-success` z bielą pozostaje realnym ryzykiem
  projektowym poza tym modułem — do osobnego zgłoszenia.

## Co NIE zostało naprawione

- **Realny `<h4>` kart w `src/components/MyWork/MyIdeasListContent.tsx:1990`.**
  Naprawiony został TYLKO nagłówek chrome'u harnessu, bo tylko on był węzłem
  naruszającym w mierzonym kadrze. Czy realny komponent w aplikacji siedzi pod
  `<h3>` (poprawnie), czy pod `<h1>`/`<h2>` (przeskok), zależy od powłoki, której
  ten ekran harnessu nie odtwarza — **nie zmierzone, więc nie twierdzę, że OK**.
  Do sprawdzenia na realnej trasie `My Work → Ideas`.
- **Token `--c-success` (#3fb950) z białym tekstem = 2,54:1.** Przycisk w
  harnessie naprawiony lokalnie; sam token NIE był ruszany — to ryzyko
  ogólnoaplikacyjne poza zakresem modułu 07 (osobne zgłoszenie).
- **Wariant `.fc-event[data-status="ai_suggestion"]`** (kalendarz, `opacity: .5`,
  `#7c3aed` na pasiastym tle) nie wystąpił w ŻADNYM z 80 kadrów PO — nie mam
  dowodu ani na zgodność, ani na naruszenie. Nie dotykany.
- **Ekrany, których przyrząd nie sfotografował** (46/80 w liczniku zrzutów,
  identycznie w PRZED i w PO): a11y skanowane jest na wszystkich 80 kadrach
  niezależnie od zapisu PNG, więc liczby PRZED/PO są porównywalne, ale zrzuty
  wizualne części ekranów nie powstały — to zastany stan przyrządu, nie regresja
  tego dyżuru.

## Komendy pomiaru (odtwarzalne)

```
node scripts/dev/grafika-zrzuty.mjs --base=http://127.0.0.1:5335 \
  --ekrany=<40 ekranow 07_MY_WORK_AGENT z scripts/dev/g06-macierz-ekrany.json> \
  --katalog=07-po --faza=PO --jezyk=pl --szerokosc=1440 --motywy=light,dark \
  --rozwin-sekcje=1 --a11y=1 --osiad-po-rozwinieciu=1500 \
  --wyjscie=/private/tmp/ag-fix-a11y-07-artefakty/po-pl-1440 \
  --wynik-json=/private/tmp/ag-fix-a11y-07-artefakty/po-pl-1440/wynik.json

# analogicznie --jezyk=en --szerokosc=1024 --wyjscie=.../po-en-1024
```

Selektory, HTML i zmierzone pary kolorów pojedynczych węzłów zdobyte osobnym
skryptem diagnostycznym poza repo
(`/private/tmp/ag-fix-a11y-07-artefakty/wezly.mjs`), replikującym dokładnie tę
samą sekwencję interakcji co narzędzie kanoniczne (klik w pierwszy wiersz,
8 rund rozwijania `[aria-expanded="false"]`, `details.open`, 1500 ms
osiadania, `AxeBuilder.include('#dev-render-root')`) — `wynik.json` zapisuje
tylko `id`/`impact`/liczbę węzłów.

## Commity

- `031ea68276` fix(a11y): węzły mapy myśli bez `role=button`, tablist kart bez przycisku zamknięcia
- `ed54b983c9` fix(a11y): kontrast plakietek tabeli idei i kalendarza
- `b0c47dc1dc` fix(a11y): unikalne nazwy paneli agenta + trzy naprawy hosta
- `25b0e54823` chore(a11y): uproszczenie tablist kart + formatowanie

Gałąź `agent/fix-a11y-07-20260903` (baza `fc6ff7ed9e`). **Nie wypchnięta.**

## Surowe dane (poza repo)

- `/private/tmp/ag-fix-a11y-07-artefakty/przed-pl-1440/`
- `/private/tmp/ag-fix-a11y-07-artefakty/po-pl-1440/`
- `/private/tmp/ag-fix-a11y-07-artefakty/po-en-1024/`

## Konsola / błędy sieci

Bez zmian względem rundy 1: wyłącznie 404 na `/api/**` (harness bez backendu).
