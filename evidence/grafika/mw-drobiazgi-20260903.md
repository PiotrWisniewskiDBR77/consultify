# Dwa drobiazgi Mojej Pracy — 2026-09-03

Robotnik `agent/mw-drobiazgi-20260903`, worktree `/private/tmp/ag-mw-drobiazgi`
(z `/private/tmp/m03`), harness `dev-render` na porcie 5440. Zadanie: dwa
drobiazgi zgłoszone tego samego dnia przez inne robotniki (rodzeństwo
naprawionych defektów). Zrzuty leżą w repo pod
`evidence/grafika/mw-drobiazgi-20260903/` (PRZED/PO, część kombinacji;
skrypt do odtworzenia reszty w sekcji „Jak odtworzyć").

## Pozycja 1 — `QuickFilterBar` / rodzina przewijanych pasków Mojej Pracy

### Ustalenie wstępne, które zmieniło zakres

Zlecenie nazywało wprost `QuickFilterBar` (`src/components/MyWork/QuickFilterBar.tsx`)
jako brakujące ogniwo sygnalizacji przewijania w filtrach Skrzynki. Zmierzone
(grep + reachability, ZŁOTA REGUŁA 1 — realny runtime, nie docs/flagi):

```
grep -rn "QuickFilterBar" src/ --include="*.tsx" --include="*.ts" \
  | grep -v "QuickFilterBar.tsx|WorkCenter.tsx|index.ts|__tests__"
→ 0 trafień (poza komentarzem-podobieństwem w NotificationsHub.tsx)

grep -rn "<WorkCenter" src/          → 0 trafień
grep -rln "WorkCenter" src/          → tylko DecisionsPanel.tsx (komentarz),
                                         MyWorkHub.tsx (komentarz), WorkCenter.tsx (sam)
```

`WorkCenter.tsx` — JEDYNY konsument `QuickFilterBar` — jest osierocony,
udokumentowane już DWA razy w repo, niezależnie, dyżur 20260830:

- `DecisionsPanel.tsx:193`: „only reachable via `DecisionsPanel` →
  `WorkCenter.tsx`, which has 0 live callers (orphaned)"
- `MyWorkHub.tsx:226`: „WorkCenter.tsx, jedyny caller starej zakładki
  `PillNavigation`, jest osierocony"

Realna Skrzynka to `InboxContent.tsx` (mounted w `MyWorkHub.tsx`, zakładka
`inbox`) — **nie używa `QuickFilterBar`** i nie ma żadnego poziomo
przewijanego paska filtrów (`overflow-x-auto`); filtry tam to
`FilterDropdown` z `ResizableTable` (rozwijana lista, nie rząd chipów).
Zero defektu do naprawienia na żywej ścieżce — to ten sam kształt co
`MYW-PHOTO-003` sprzed kilku godzin (`761e128ef1`): dowód w zleceniu
wskazywał na komponent, który klient nigdy nie widzi.

Ten sam martwy wzorzec, znaleziony przy okazji tego samego grepu rodziny
(`git grep -n -iE "overflow-x-auto|overflowX" -- src/components/MyWork`):
`Tasks/TaskFiltersBar.tsx` — eksportowany z `index.ts`, ale **zero**
konsumentów tego eksportu poza własnym plikiem.

**Bez zmian w `QuickFilterBar.tsx` ani `TaskFiltersBar.tsx`.**

### Rodzina — potwierdzone żywe ścieżki, ten sam mechanizm co `761e128ef1`

Z tego samego grepu, przefiltrowane do faktycznie zamontowanych (nie
osieroconych) pasków przypominających wzorzec taby/chipy/filtr — z
potwierdzoną ścieżką montowania:

| Plik | Gdzie się montuje (zmierzone) | Defekt PRZED |
|---|---|---|
| `Executive/ActionRequiredStrip.tsx` | `ExecutiveDashboard` ← `MyWorkHub.tsx:4038` (zakładka „Menedżer") | `scrollbar-hide` — ZERO jakiejkolwiek sygnalizacji (gorzej niż cienki pasek w `761e128ef1`) |
| `table/TableTabStrip.tsx` | `IdeaTableTool` ← `IdeaMapWorkspace.tsx` ← `MyWorkHub.tsx:3943` (zakładka „Pomysły", widok tabeli) | cienki natywny scrollbar, zero fade/chevron |
| `Calendar/CalendarView.tsx` (pasek „Terminy") | `MyWorkHub.tsx:4069` z `includeOwnEvents` ustawionym wyłącznie przez `CalendarV2.tsx`; `isMyWorkCalendarV2Enabled()` domyślnie **ON** (komentarz „D-6: owner requested… default flips ON") — czyli żywa ścieżka domyślna, mimo że komentarz w `dev-render/screens/mywork-calendar.tsx` twierdzi „domyślnie OFF" (**ten komentarz jest nieaktualny** — realny kod flagi mówi inaczej; nie poprawiałem go, poza zakresem) | cienki natywny scrollbar, zero fade/chevron |

Naprawa: identyczny mechanizm co `761e128ef1` — `useScrollEdges` +
`ScrollEdgeFade` z `src/components/MyWork/shared/` (bez zmian w tych
plikach), owinięcie przewijanego wiersza w `relative`, `ref` na scrollowany
element, dwa `<ScrollEdgeFade side="start|end" visible={...scrollable && !at...} />`.

Komponentów Menu 3 głównego paska (`MyWorkHub.tsx` tabs row + prawy klaster)
NIE dotykałem — już naprawione w `761e128ef1`.

**Świadomie NIE sprawdzone/nienaprawione** (poza zakresem „dwóch
drobiazgów" — pełny sweep wszystkich ~35 wystąpień `overflow-x-auto` w
`src/components/MyWork` to osobne zlecenie): toolbary ikon w
canvas/whiteboard/mindmap/notebook (`ObjectEditBar`, `WhiteboardToolbar`,
`WhiteboardSelectionBar`, `NotebookToolbar`, `ActivityFeed`), stopki tabel
(`StatusBar`, `EmbeddedAnalytics`, `GridView`), kanban-boardy (poziomy
scroll kolumn to inny, oczekiwany wzorzec UX, nie ukryty pasek nawigacji).

### Dowód — `CalendarView.tsx` (pasek „Terminy", jedyny z tej trójki z
gotowym ekranem harnessu — `mywork-calendar`)

Komenda (kanoniczne narzędzie, port 5440):

```
node scripts/dev/grafika-zrzuty.mjs --base=http://127.0.0.1:5440 \
  --ekrany=mywork-calendar --katalog=mw-drobiazgi-20260903 \
  --jezyk=pl --motywy=light,dark --szerokosc=768 --wysokosc=900 --a11y=1 \
  --faza=PRZED|PO --wynik-json=...
```

| | PRZED | PO |
|---|---|---|
| `scrollWidth` / `clientWidth` (768px) | 774 / 512 → **ucięte** | 774 / 512 (bez zmian — treść ta sama) |
| `[data-scroll-affordance]` w pasku „Terminy" | **0** węzłów | 1 węzeł „end" na `x:728-768, y:61-109` (potwierdzone `getComputedStyle`: `background-image: linear-gradient(to left, #fff, #fff, transparent)`) |
| a11y `color-contrast` (768, light+dark) | — (nie mierzone osobno, poza zakresem tej pozycji) | **0** naruszeń (light i dark, 768 i 1024) |

Zrzuty: `evidence/grafika/mw-drobiazgi-20260903/mywork-calendar__PRZED__pl__768__{light,dark}.png`,
`…__PO__pl__{768,1024}__{light,dark}.png`.

`ActionRequiredStrip.tsx` i `TableTabStrip.tsx` **nie mają gotowego ekranu
harnessu** (Executive/manager dashboard i wielotabelowy Idea Table Tool nie
są w `dev-render/main.tsx`) — budowa takiego ekranu jest poza zakresem
„dwóch drobiazgów". Weryfikacja tych dwóch: esbuild pliku czysto (JSX
poprawny), wzorzec 1:1 skopiowany z już zaakceptowanego `761e128ef1`
(ten sam hook, ten sam komponent, identyczny kształt owinięcia) — bez
niezależnego dowodu wizualnego. **To jest luka w dowodzie, nie w
implementacji — jawnie zgłoszona, nie ukryta.**

### Commit

`668e44f383` — `fix(mywork): scroll-edge affordance na rodzeństwie MYW-PHOTO-003`
(3 pliki: `Calendar/CalendarView.tsx`, `Executive/ActionRequiredStrip.tsx`,
`table/TableTabStrip.tsx`).

---

## Pozycja 2 — `color-contrast` na `mywork-tasks`

### Zmierzone kanonicznym narzędziem — naruszenie JEST realne

Komenda dokładnie jak w zleceniu (harness 5440, `--rozwin-sekcje=1
--klik-po-rozwinieciu=1 --osiad-po-rozwinieciu=1500 --cofnij-jesli-skraca=1`,
BEZ rozwijania też sprawdzone osobno — identyczny wynik, bo defekt jest w
podstawowym widoku listy, nie w rozwijanej sekcji):

| | PRZED | PO |
|---|---|---|
| `color-contrast`, 1440, pl, light | **5 węzłów** | 0 |
| `color-contrast`, 1440, pl, dark | **5 węzłów** | 0 |
| `color-contrast`, 1440, en, light | **5 węzłów** | 0 |
| `color-contrast`, 1440, en, dark | **5 węzłów** | 0 |
| `color-contrast`, 1024, pl/en, light/dark | (nie mierzone PRZED osobno — sama przyczyna jest niezależna od szerokości) | 0/0/0/0 |

Werdykt: **naruszenie realne**, nie przyrząd/parametry — potwierdzone w
KAŻDEJ z 4 kombinacji pl/en × light/dark przy 1440px, dokładnie tym
poleceniem z zlecenia.

### Przyczyna (axe + `getComputedStyle`, zlokalizowana węzeł-po-węźle)

Skrypt diagnostyczny (Playwright + axe-core, ten sam skan
`.include('#dev-render-root')` co narzędzie kanoniczne) na jedynym wierszu
„Zrobione" (`Przygotować agendę kick-off — nowy klient Atelier Toys`):

1. `.line-through` (tytuł, `text-c-text-muted`) — fg `#9099a4` na bg
   `#fefefd`, kontrast **2,85:1**
2. `.border-emerald-200 > .truncate` (plakietka „Zrobione", `StatusChip`
   tone `success`, `text-emerald-800`) — fg `#67957c` na bg `#f7fcf3`,
   kontrast **3,27:1**
3. priorytet „Normalny" (`text-c-text-muted`) — **2,85:1**
4. termin „Sep 1" (`text-c-text-muted`, w `role="status"`) — **2,80:1**
5. osoba przypisana „Kasia Nowak" (`text-c-text-secondary`) — **2,85:1**

Wspólny przodek WSZYSTKICH pięciu: `<tr class="... opacity-60">`
(`MyTasksListContent.tsx`, `isCompleted ? 'opacity-60' : ''`, 2 wystąpienia
— główny widok listy i wariant `StandardTable`/`FilterableTable`
row-className-builder). To **inny mechanizm** niż naprawa G06 z tego
samego dnia (`src/index.css:436-453`, komentarz „Naprawa G06 „podgląd —
kontrast""): G06 adresuje PODBARWIONE TŁO komórki (`bg-state-selected`,
`hover:bg-state-hover`) przez `td .text-c-text-muted { color:
var(--c-text-muted-table) }`. Tu przyczyną jest **przezroczystość całego
wiersza** — `opacity: 0.6` na `<tr>` miesza KAŻDY potomny kolor z tłem
strony razy 0,6, więc nawet już-podciemniony `--c-text-muted-table`
(#475569, kalibrowany na tło, nie na przezroczystość) po rozcieńczeniu
0,6 daje ok. 2,9:1 — wciąż za mało. Zmierzone też: samo podniesienie do
`emerald-950` dla plakietki dawało **4,07:1** — wciąż za mało; dopiero
pełny `--c-text` (niemal czarny/biały) przechodzi z zapasem.

### Naprawa

`src/index.css`, w tej samej sekcji `@layer base` co naprawa G06 (rodzeństwo,
nie duplikat) — trzy reguły selektorowe po klasie `tr.opacity-60`:

```css
tr.opacity-60 .text-c-text-muted,
tr.opacity-60 .text-c-text-secondary {
  color: var(--c-text);
}
tr.opacity-60 .text-emerald-800 {
  color: var(--c-text);
}
.dark tr.opacity-60 .text-emerald-300 {
  color: #ecfdf5; /* emerald-50 — jasne, przetrwa rozcieńczenie 0,6 na ciemnym tle */
}
```

Zero zmian w komponentach (`MyTasksListContent.tsx` nietknięty) — czysto
token/CSS, tym samym wzorcem co G06. Wizualnie wiersz nadal czyta się jako
przygaszony (cała `<tr>` zostaje na 60% opacity — zrzuty PO niżej), bo
dopiero PO zmieszaniu z tłem strony efektywny kontrast wraca >4,5:1.

### Dowód PO — 8 kadrów (pl/en × light/dark × 1440/1024), zero naruszeń

```
evidence/grafika/mw-drobiazgi-20260903/mywork-tasks__PO__{pl,en}__{1440,1024}__{light,dark}.png
```

Wszystkie 8: `a11yNaruszenia` (color-contrast) = **0**. Sprawdzone wzrokiem
(zrzut light 1440 i dark 1440 dołączone do meldunku sesji) — wiersz
„Zrobione" nadal wyraźnie odróżnia się jako ukończony (przekreślenie +
przygaszenie całego wiersza), plakietka „Zrobione" nadal czyta się jako
zielona (jaśniejsza zieleń bg + ciemny tekst zamiast średnio-zielonego),
bez regresji wizualnej.

PRZED: 4 kadry (pl/en × light/dark, 1440) —
`evidence/grafika/mw-drobiazgi-20260903/mywork-tasks__PRZED__{pl,en}__1440__{light,dark}.png`
(1024 PRZED nie zbierane osobno — przyczyna niezależna od szerokości,
potwierdzone przez PO przy obu szerokościach).

### Commit

`a16bea9ca5` — `fix(a11y): kontrast tekstu w ukończonych wierszach zadań (opacity-60)`
(1 plik: `src/index.css`, + 18 plików PNG dowodu).

---

## Czego NIE zrobiłem

- `QuickFilterBar.tsx` / `TaskFiltersBar.tsx` — bez zmian (martwy kod,
  potwierdzone).
- Pełny sweep rodziny `overflow-x-auto` w `src/components/MyWork`
  (~35 wystąpień) — naprawione tylko 3 potwierdzone-żywe, reszta poza
  zakresem (toolbary ikon, stopki tabel, kanban — inny wzorzec UX).
- `ActionRequiredStrip.tsx` / `TableTabStrip.tsx` — naprawione, ale bez
  niezależnego dowodu zrzutu (brak gotowego ekranu harnessu); tylko esbuild
  + wzorzec 1:1 z zaakceptowanego `761e128ef1`.
- Nieaktualny komentarz w `dev-render/screens/mywork-calendar.tsx`
  („domyślnie OFF" dla `isMyWorkCalendarV2Enabled()`, podczas gdy kod mówi
  `true` od decyzji D-6) — zauważone, nie poprawione (poza zakresem).

## Anomalia środowiska (do wiadomości nadzorcy, nie mój błąd)

W trakcie sesji `src/components/method-workspace/LiveMatrix.tsx` i
`MethodWorkspaceShell.tsx` pojawiły się jako zmodyfikowane w MOIM
worktree (`/private/tmp/ag-mw-drobiazgi`), mimo że ich nie dotykałem —
treść identyczna z równoległym worktree `/private/tmp/ag-legenda`
(`agent/ocena-legenda-stanow-20260903`, inne zadanie, inny agent). Inne
inode, identyczna treść — nie jest to symlink. Przy okazji ten sam epizod
zresetował mój własny, jeszcze niescommitowany fix w `CalendarView.tsx`
do stanu HEAD (odtworzony ręcznie, drugi raz, zweryfikowany esbuildem —
patrz commit `668e44f383`). **Te dwa pliki (`LiveMatrix.tsx`,
`MethodWorkspaceShell.tsx`) zostały świadomie NIE scommitowane i NIE
cofnięte przeze mnie** — nie moja praca, mogą należeć do wciąż trwającej
sesji `ag-legenda`; ostały się w working tree jako `git status` pokazuje
je jako modified, nietkniete od chwili wykrycia.

## Jak odtworzyć

```
cd /private/tmp/ag-mw-drobiazgi   # albo świeży worktree z origin/demo
npx vite --config dev-render/vite.config.ts --port 5440 --strictPort &

# Pozycja 1 (CalendarView, jedyny z gotowym ekranem):
node scripts/dev/grafika-zrzuty.mjs --base=http://127.0.0.1:5440 \
  --ekrany=mywork-calendar --katalog=<dowolny> --jezyk=pl \
  --motywy=light,dark --szerokosc=768 --wysokosc=900 --a11y=1

# Pozycja 2:
node scripts/dev/grafika-zrzuty.mjs --base=http://127.0.0.1:5440 \
  --ekrany=mywork-tasks --jezyk=pl --motywy=light,dark --szerokosc=1440 \
  --a11y=1 --rozwin-sekcje=1 --klik-po-rozwinieciu=1 \
  --osiad-po-rozwinieciu=1500 --cofnij-jesli-skraca=1 \
  --wyjscie=<katalog> --wynik-json=<plik.json>
```
