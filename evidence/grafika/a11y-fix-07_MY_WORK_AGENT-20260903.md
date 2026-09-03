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
