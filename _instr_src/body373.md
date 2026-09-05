## Po co ten dyżur istnieje

Dwie rodziny z zestawienia audytu przycisków Czatu AI (`docs/program/AUDYT_CZAT_PRZYCISKI_20260905/
00_ZESTAWIENIE.md`, rodziny 2 „Duplikaty i mylące etykiety” i 3 „Martwe pliki w katalogu czatu”).
Żadna nie jest ryzykiem bezpieczeństwa. Obie są tanie do domknięcia, bo mają już gotowy, imienny
dowód `plik:linia` z trzech audytów cząstkowych (`A2`, `C`, `F`).

**Część A — pięć duplikatów/mylących etykiet.**

**(1) `A2` D-2 — panel „Dataset ready” zdublowany.** Ten sam blok (7 przycisków analiz + „Dismiss”)
renderuje się DWA RAZY NARAZ w `WorkCanvasDocumentPanel.tsx`: raz na stałe poza kebabem
(`:3737-3773`, `data-testid="canvas-dataset-actions"`, widoczny zawsze gdy `pendingDataset`
ustawiony), raz wewnątrz sekcji „Plik, eksport i workspace” kebaba (`:4237-4272`, bez własnego
testid). Odtworzenie: wgraj `.csv` → otwórz kebab „⋮” → rozwiń „Plik, eksport i workspace” →
widać drugi, identyczny zestaw przycisków obok już widocznego na zewnątrz.

**(2) `A2` D-3 — karta „Dodaj element” nie rozwija formularza.** Karta „Dodaj nowy element do
canvas” w „Najczęstszych działaniach” (`:3846-3851`, `onClick: () => setQuickAddElement('text')`)
tylko ustawia typ elementu — sekcja `<details>` „Dodaj element” (`:3918-3966`) nie ma atrybutu
`open` i pozostaje zwinięta. Klik nie pokazuje niczego. Odtworzenie: kebab → Najczęstsze działania
→ „Dodaj element” → nic się nie rozwija, trzeba ręcznie kliknąć osobny nagłówek niżej.

**(3) `F` D-2 — `TaskDropdown` „Create new task” tylko nawiguje.** Przycisk stanu pustego
(`:213-219`, klucz `taskDropdown.createNew`, PL „Utwórz nowe zadanie”) woła DOKŁADNIE ten sam
`handleNavigateToTasks` (`:100-104`) co „View all” — `setIsOpen(false)` +
`setMyWorkIntent({tab:'tasks'})` + `setCurrentView(MY_WORK)`. Zero tworzenia. Sprawdzone w
`src/store/slices/uiSlice.ts:76-84`: `myWorkIntent` ma pola `tab` i
`open:{type:'notification'|'task'|'idea'|'decision', id, name?, data?}` — `open` służy do
otwarcia ISTNIEJĄCEGO obiektu po `id`, nie istnieje wariant „otwórz kreator nowego zadania”.
Etykieta obiecuje tworzenie, kod tylko nawiguje.

**(4) `F` D-5 — `NotificationDropdown` „Skrzynka”/„Centrum” identyczny handler.** Dwa przyciski w
nagłówku dropdownu (`:373-383` „Skrzynka”/Inbox, `:384-394` „Centrum”/Center) mają DOSŁOWNIE
identyczny `onClick`: `setMyWorkIntent({tab:'inbox'})` + `setCurrentView(MY_WORK)`. `myWorkIntent.
tab` nie ma wartości „center” ani „notifications” — drugi przycisk nigdzie osobno nie prowadzi.
Odtworzenie: otwórz dzwonek → kliknij „Skrzynka”, potem osobno „Centrum” — oba lądują na
identycznym `/my-work?tab=inbox`.

**(5) `C` D-2 — `ChatHistorySidebar` fallback niespójny z kluczem.** Linia `:1060` woła
`t('aiChat.newChat', 'Nowy czat')`, ale sam klucz `aiChat.newChat` w obu słownikach zwraca
„Nowa rozmowa”/„New conversation” (klucz wygrywa nad fallbackiem — user i tak widzi poprawny
tekst). To niespójność w kodzie źródłowym, myląca dla następnego programisty, nie widoczny defekt
UI. Ujednolicić fallback do wartości klucza.

**Część B — szesnaście plików-kandydatów na martwy kod**, zmierzonych metodą osiągalności OD
KORZENIA (`node scripts/dev/reachability-from-root.mjs`), NIE metodą „plik bez importera” — patrz
Pułapka (1)/(2)/(3) niżej. **Dwie korekty wobec briefu, moim pomiarem**: `ActionCenter.tsx` jest w
rzeczywistości ŻYWY (audyt się mylił), a katalog `AIChat/Artifacts/**` jest ŻYWY w całości przez
`SplitLayout`, osiągalny z jedenastu tras poza `/chat`.

## ★ Stan zastany, zmierzony przeze mnie na markerze `9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c`

| Co | Wartość zmierzona | Gdzie |
| --- | --- | --- |
| duplikat panelu „Dataset ready” | 2 instancje | `WorkCanvasDocumentPanel.tsx:3737-3773` (poza kebabem) i `:4237-4272` (w kebabie) |
| karta „Dodaj element” bez rozwinięcia | brak atrybutu `open` | `<details>` w linii `:3918` (dla porównania: „Edycja i AI” ma `open` w `:3973`) |
| `TaskDropdown` handler duplikowany | ten sam handler w 4 miejscach | `:100-104` definicja, wołany z `:172`, `:215`, `:230`, `:291` |
| `myWorkIntent` bez intencji „utwórz” | pola `tab`/`open` (typ istniejącego obiektu) | `src/store/slices/uiSlice.ts:76-84` |
| `NotificationDropdown` duplikat handlera | 2 przyciski, 1 handler | `:373-383` („Skrzynka”), `:384-394` („Centrum”) |
| `ChatHistorySidebar` fallback vs klucz | fallback `'Nowy czat'` ≠ klucz `'Nowa rozmowa'` | `:1060` kod; `public/locales/{pl,en}/translation.json` klucz `aiChat.newChat` |
| kandydaci Części B, `unreachable` | **11** plików | lista w `TYTUL`/komenda (6) `§0.1` |
| kandydaci Części B, `test-only` | **3** pliki + 3 dedykowane testy | `InputHintStrip`, `PendingActionsIndicator`, `WorkCanvas/WorkCanvasShell` |
| barrel dziurawy po usunięciu | `WorkCanvas/index.ts` | sam `unreachable`, re-eksportuje `WorkCanvasShell` |
| korekta 1: `ActionCenter.tsx` | `app:true` — ŻYWY | importerzy: `Execution/ExecutionHub.tsx`, `routes/AppRoutes.tsx` |
| korekta 2: `Artifacts/**` | `app:true` — ŻYWY (poza 3 barrelami index*.ts) | dostawca `SplitLayout`, 11 importerów poza `/chat` |
| martwe `vi.mock`/`vi.doMock` do posprzątania | 2 linie w 2 cudzych testach | `EnhancedChatInput.teresaVoice.test.tsx:98`, `UnifiedChatPanel.test.tsx:266-268` |
| i18n liście (na markerze) | pl **34327**, en **32338** | `public/locales/{pl,en}/translation.json` |
| baseline reachability (na markerze) | `unreachable` **719**, `testOnly` **1017** | `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` |
| 4 bezpieczniki (zmierzone na checkoucie 31 commitów NAD markerem — patrz uwaga niżej) | focus=0, list=0, artefakt=0, **reach=1** | komenda (12) `§0.1` |

**★ Uwaga o pomiarze bezpieczników.** W chwili pisania tej instrukcji nie miałem jeszcze worktree
zbudowanego DOKŁADNIE z markera — zmierzyłem na checkoucie repo 31 commitów NAD markerem
(`git diff --name-only <marker>..HEAD` pokazuje, że w zakresie tego dyżuru zmieniły się WYŁĄCZNIE
`public/locales/{pl,en}/translation.json` — nic z `WorkCanvasDocumentPanel.tsx`, `TaskDropdown.tsx`,
`NotificationDropdown.tsx`, `ChatHistorySidebar.tsx`, żadnego z szesnastu kandydatów Części B ani
`scripts/dev/reachability-from-root.mjs`). `reach=1` na tym checkoucie wynika WYŁĄCZNIE z pięciu
plików spoza zakresu tego dyżuru, które wpadły do repo między markerem a moim checkoutem
(`Portfolio/InitiativeGridCard.tsx` + 4 pliki testowe, żaden w `AIChat/`). **Na Twoim worktree,
zbudowanym dokładnie z markera, `reach` powinno dać `0`.** Jeśli nie da — to Twój prawdziwy stan
wejściowy, piszesz go wprost w „Korektach wobec instrukcji” i NIE naprawiasz niczego spoza zakresu
tego dyżuru.

## ★ Zmierz moje liczby sam

Twierdzę, na markerze: **2** instancje panelu „Dataset ready”; karta „Dodaj element” bez `open`;
`TaskDropdown` i `NotificationDropdown` mają duplikat handlera w dokładnie tych liniach; fallback
`ChatHistorySidebar` niespójny z kluczem; **11** plików Części B `unreachable`, **3** `test-only`;
`ActionCenter.tsx` i `Artifacts/**` ŻYWE wbrew briefowi; **2** martwe `vi.mock`/`vi.doMock` do
posprzątania; liście słowników **pl 34327**, **en 32338**; baseline reachability **719**
`unreachable` / **1017** `test-only`.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz
rozbieżność wprost.**

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany brief z
`plik:linia` oraz diff **nienałożony**. Pozycja z takim produktem jest **ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Panel kanwy (Część A, R1+R2)** | `src/components/AIChat/WorkCanvasDocumentPanel.tsx` (5278 linii) | **★ WĄSKA LICENCJA NA DOKŁADNIE CZTERY BLOKI**: `:3737-3773` (panel poza kebabem — dozwolone dodanie `id`/`ref` dla fokusa/scrolla, bez zmiany logiki analiz), `:4230-4275` (blok w kebabie — zastąpienie linkiem „Pokaż analizy”), `:3846-3966` (karta „Dodaj element” + `<details>` + textarea — dodanie ref/handler rozwijania i fokusa), `:1037-1134` (klaster `useRef` — dodanie DWÓCH nowych refów). **Reszta pliku (5000+ linii) TYLKO ODCZYT** mimo wspólnego pliku | Brief z `plik:linia` + diff nienałożony |
| **`TaskDropdown` (Część A, R3)** | `src/components/TaskDropdown.tsx` | **★ WĄSKA LICENCJA**: WYŁĄCZNIE tekst/klucz etykiety przycisku `:213-219` (`taskDropdown.createNew`). **Zakaz zmiany `handleNavigateToTasks` (`:100-104`) i jakiejkolwiek logiki nawigacji** — zachowanie zostaje identyczne, zmienia się TYLKO obietnica w etykiecie | — |
| **`NotificationDropdown` (Część A, R4)** | `src/components/layout/NotificationDropdown.tsx` | **★ WĄSKA LICENCJA**: WYŁĄCZNIE blok `:373-394` — usunięcie DUPLIKATU (`:384-394` „Centrum”), zachowanie `:373-383` („Skrzynka”) bez zmian logiki | — |
| **`ChatHistorySidebar` (Część A, R5)** | `src/components/AIChat/ChatHistorySidebar.tsx` | **★ WĄSKA LICENCJA**: WYŁĄCZNIE literał-fallback w linii `:1060` (drugi argument `t(...)`) | — |
| **Model intencji cross-modułowych** | `src/store/slices/uiSlice.ts` | **TYLKO ODCZYT** — dowód, że `myWorkIntent` nie ma wariantu „utwórz nowe” | Cytat `:76-84` w raporcie |
| **Słowniki — WYJĄTEK 1 (R3)** | `public/locales/{pl,en}/translation.json`, klucz `taskDropdown.createNew` | **★ WĄSKA LICENCJA NA WARTOŚĆ TEGO JEDNEGO KLUCZA** — zmiana na uczciwą etykietę („Przejdź do zadań” / „Go to tasks” albo równoważną, w obu językach). **Zakaz zmiany klucza, zakaz usunięcia, zakaz dotykania jakiegokolwiek innego klucza** | — |
| **Słowniki — WYJĄTEK 2 (R1)** | `public/locales/{pl,en}/translation.json`, DOKŁADNIE JEDNA nowa para kluczy | **★ WĄSKA LICENCJA NA DODANIE** jednej pary kluczy dla linku „Pokaż analizy” (np. `canvas.panel.dataset.showAnalyses`), z realną polską wartością — **NIE automatyczne tłumaczenie**. **Zakaz dodania jakiegokolwiek innego klucza** | — |
| **Słowniki — reszta** | `public/locales/**` poza dwoma wyjątkami wyżej | **NIETYKALNE DO ZAPISU.** W tym CAŁA lista kluczy dyżuru 372 — jeśli klucz jest osierocony wyłącznie przez plik usuwany w Części B i figuruje na liście 372, zostaje | Opis w raporcie |
| **Kandydaci Części B — `unreachable`** | `src/components/AIChat/{ChatExportModal,ImageAttachment,ChatLanguageSelector,SmartSuggestions,ResponseActions,ResponseQualityIndicator,DiagramArtifact,ChatToggleButton,ChatOverlay,ActiveModeStrip,OrganizationMemoryPanel}.tsx`, `src/components/layout/DemoTopbarStatus.tsx`, `src/components/ui/HelpButton.tsx`, `src/components/layout/HelpPanel.tsx` | **★ LICENCJA NA USUNIĘCIE WARUNKOWA** — TYLKO jeśli Twój pomiar `reachability-from-root.mjs` na TWOIM worktree potwierdza `unreachable` I dodatkowy `grep` (patrz `R6`) nie znajduje żadnej realnej referencji (import/re-export/`vi.mock`) poza komentarzami | Jeśli pomiar NIE potwierdzi: brief + zostawiasz plik |
| **Kandydaci Części B — `test-only`** | `src/components/AIChat/InputHintStrip.tsx` + `src/components/AIChat/__tests__/InputHintStrip.test.tsx`; `src/components/AIChat/PendingActionsIndicator.tsx` + `tests/components/AIChat/PendingActionsIndicator.test.tsx`; `src/components/AIChat/WorkCanvas/WorkCanvasShell.tsx` + `tests/components/AIChat/WorkCanvasShell.test.tsx` | **★ LICENCJA NA USUNIĘCIE WARUNKOWA, PLIK + JEGO DEDYKOWANY TEST RAZEM** — sama komponenta jest `test-only` (żywy WYŁĄCZNIE własny test, zero konsumenta w apce/harnessie) | jw. |
| **Barrel zależny (Część B)** | `src/components/AIChat/WorkCanvas/index.ts` | **★ LICENCJA NA USUNIĘCIE, WARUNKOWO RAZEM Z `WorkCanvasShell.tsx`** — sam plik jest `unreachable`; jeśli usuwasz `WorkCanvasShell.tsx`, usuwasz LUB naprawiasz (usuwasz linię re-eksportu, zostawiasz typy) ten barrel W TYM SAMYM COMMICIE | — |
| **Martwe mocki w cudzych testach** | `src/components/AIChat/__tests__/EnhancedChatInput.teresaVoice.test.tsx` (linia `:98`), `tests/components/AIChat/UnifiedChatPanel.test.tsx` (linie `:266-268`) | **★ WĄSKA LICENCJA NA USUNIĘCIE DOKŁADNIE JEDNEJ LINII/BLOKU** wskazującego usuwany plik (`vi.mock`/`vi.doMock`). **Zakaz jakiejkolwiek innej zmiany w tych dwóch plikach** | — |
| **Guard bez importu (Część B)** | `tests/unit/backend/wave6ContextLearningService.test.ts` (linia `:529`) | **TYLKO ODCZYT** — asercja nieobecności `<PendingActionsIndicator` w renderze, nie import; zostaje trywialnie zielona po usunięciu pliku, NIE dotykasz | — |
| **Cudze rodziny o podobnej nazwie** | `src/components/Chat/ChatSmartSuggestions.tsx`, `src/components/MyWork/table/SmartSuggestionsBar.tsx`, `src/components/AIChat/ActionCenter.tsx`, `src/components/AIChat/Artifacts/**` (poza trzema barrelami niżej) | **NIETYKALNE — ŻYWE.** Nie usuwasz, nie zmieniasz | — |
| **Martwe barrele Artifacts (poza zakresem)** | `src/components/AIChat/Artifacts/index.ts`, `src/components/AIChat/Artifacts/renderers/index.ts`, `src/components/AIChat/Artifacts/renderers/index2.ts` | **TYLKO ODCZYT — POZA ZAKRESEM TEGO DYŻURU.** Mimo że Twój pomiar może pokazać `unreachable`, NIE są na liście kandydatów tego dyżuru — zgłoś jako osobne znalezisko w raporcie, nie usuwaj | Wpis do raportu z `plik` + `unreachable` |
| **Baseline reachability** | `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` | **★ WĄSKA LICENCJA: WYŁĄCZNIE przez `node scripts/dev/reachability-from-root.mjs --update-baseline`** (skrypt sam odmówi, gdyby zbiór urósł) — PO usunięciu plików Części B, żeby baseline przestał tolerować pliki, których już nie ma. **Zakaz edycji ręcznej** | — |
| **Nowe testy behawioralne R1-R5** | `tests/components/AIChat/day373-*.test.tsx` (nowe, `git add -f`) | **★ PEŁNA LICENCJA.** Asercja ZACHOWANIA (render + interakcja + wynik DOM/stanu), NIGDY `readFileSync`+`toContain` na źródle | — |
| **Bezpieczniki i konfiguracja testów** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**` | **TYLKO ODCZYT — `Z18`** | Opis w raporcie |
| **Macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | ★★★ **NIETYKALNE DO ZAPISU — żaden wiersz, żaden moduł**, w tym `13_CHAT` | Rekomendacja w raporcie |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja o pierwszej wolnej literze, sprawdzonej komendą tuż przed commitem | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY373_DUPLIKATY_MARTWE_REPORT.md` (**NOWY**) | `R7` — JEDYNY nowy dokument rejestrowy (`Z13`) | — |
| **`server/src/**` — cały serwer** | — | **TYLKO ODCZYT.** Ten dyżur nie dotyka żadnej trasy serwerowej (patrz `TRASY_TYL`) | Brief, jeśli coś znajdziesz przypadkiem |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia` i idziesz dalej |

## ★★ WARUNKI WSPÓLNE SERII

Mierzysz **PRZED pierwszym commitem i PO ostatnim**, obie pary liczb do raportu:

```bash
cd "$WT"
# (a) liscie slownikow NIE MOGA ZMALEC (poza dwoma wyjatkami z tabeli licencji, ktore ZMIENIAJA
#     wartosc/DODAJA jedna pare, nigdy nie kasuja)
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby na markerze: pl 34327, en 32338. Po R1 (nowa para kluczy) obie liczby rosna o
#   DOKLADNIE 1 kazda (chyba ze klucz zagniezdza sie w nowym obiekcie — wtedy policz recznie ile
#   lisci przybywa i zapisz to w raporcie). R3 NIE zmienia liczby lisci (edytujesz wartosc istniejacego
#   klucza, nie dodajesz/usuwasz).

# (b) cztery bezpieczniki maja konczyc sie kodem 0
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus-canon=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list-canon=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby na TWOIM worktree przy markerze: oczekiwane wszystkie 0 (patrz uwaga w "Stan zastany"
#   o reach=1 zmierzonym na moim checkoucie 31 commitow do przodu — to NIE jest stan Twojego markera).
```

**Jeżeli którakolwiek liczba zmaleje albo bramka zaczerwieni się od Twojej zmiany — naprawiasz
KODEM, nigdy progiem i nigdy `--no-verify`** (`Z35`).

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | instancji panelu „Dataset ready” | `2` | komenda (1) `§0.3` | TAK — czyta plik komponentu |
| 2 | atrybutu `open` na `<details>` „Dodaj element” | `0` (brak) | komenda (2) | TAK |
| 3 | wywołań `handleNavigateToTasks` w `TaskDropdown.tsx` | `4` (`:172,215,230,291`) | komenda (3) | TAK — dowód, że „Create new task” to ten sam handler co reszta |
| 4 | wariantów `myWorkIntent.open.type` | `4` (`notification,task,idea,decision`), zero „create” | komenda (3) | TAK — dowód braku intencji tworzenia |
| 5 | przycisków z identycznym handlerem w `NotificationDropdown` | `2` | komenda (4) | TAK |
| 6 | plików Części B `unreachable` | `11` | komenda (6) | TAK — pełna ścieżka, nie tylko nazwa |
| 7 | plików Części B `test-only` (+ dedykowany test) | `3` (+3 testy) | komenda (6) | TAK |
| 8 | korekt wobec briefu | `2` (`ActionCenter`, `Artifacts/**`) | komendy (7), (8) | TAK — dowód importerów |
| 9 | martwych `vi.mock`/`vi.doMock` do usunięcia | `2` | komenda (10) | TAK |
| 10 | liście słowników PL/EN na markerze | `34327` / `32338` | komenda (11) | TAK |
| 11 | rekord baseline reachability na markerze | `719` unreachable / `1017` test-only | komenda (13) | TAK |
| 12 | plików, które importowały cokolwiek usuniętego (PO usunięciu) | oczekiwane `0` | `R6` punkt 6 | TAK — jeśli >0, STOP |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY373_DUPLIKATY_MARTWE_REPORT.md` ·
`evidence/duplikaty-martwe-20260905/**` (nowy) ·
bloki wskazane w tabeli licencji w `WorkCanvasDocumentPanel.tsx`, `TaskDropdown.tsx`,
`NotificationDropdown.tsx`, `ChatHistorySidebar.tsx` · szesnaście plików Części B (usunięcie,
warunkowo po pomiarze) + ich dedykowane testy · `WorkCanvas/index.ts` (warunkowo) ·
dwie linie w `EnhancedChatInput.teresaVoice.test.tsx` i `UnifiedChatPanel.test.tsx` (warunkowo) ·
nowe testy behawioralne w `tests/components/AIChat/day373-*.test.tsx` (`git add -f`) ·
`docs/program/REJESTR_ZNALEZISK_20260903.md` (jedna nowa sekcja) ·
`docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` (wyłącznie przez
`--update-baseline`).

**Zapisujesz WARUNKOWO (dwa wyjątki imienne):**
`public/locales/{pl,en}/translation.json` — WYŁĄCZNIE wartość `taskDropdown.createNew` (R3) i
DOKŁADNIE jedna nowa para kluczy dla „Pokaż analizy” (R1).

**JAWNIE NIE ZAPISZESZ:** `server/src/**` (cały), `src/store/slices/uiSlice.ts`,
`public/locales/**` poza dwoma wyjątkami wyżej (w tym CAŁA lista kluczy dyżuru 372),
`src/components/AIChat/ActionCenter.tsx`, `src/components/Chat/ChatSmartSuggestions.tsx`,
`src/components/MyWork/table/SmartSuggestionsBar.tsx`, `src/components/AIChat/Artifacts/**`
(w tym trzy martwe barrele — zgłaszasz, nie usuwasz), `tests/setup.ts`, `tests/helpers/**`,
`tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`,
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` (wszystkie 16),
`tests/unit/backend/wave6ContextLearningService.test.ts`, jakikolwiek plik poza dokładnie dwiema
liniami w `EnhancedChatInput.teresaVoice.test.tsx` / `UnifiedChatPanel.test.tsx`.

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day373-duplikaty-martwe
git diff --name-only --cached | tee /private/tmp/cx-day373-duplikaty-martwe-artefakty/staged.txt
bash -c "grep -iE '^server/src/|uiSlice\.ts|^public/locales/.*translation\.json$|ActionCenter\.tsx|ChatSmartSuggestions\.tsx|SmartSuggestionsBar\.tsx|AIChat/Artifacts/(index|renderers/index)|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|MODULE_ACCEPTANCE|wave6ContextLearningService' /private/tmp/cx-day373-duplikaty-martwe-artefakty/staged.txt" \
  && echo "★★ SPRAWDZ RECZNIE — plik na liscie ryzyka jest staged (public/locales/*/translation.json MOZE byc legalny, patrz dwa wyjatki w licencji; reszta to NARUSZENIE, COFNIJ przez git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R0 — CZTERY TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**(1) Martwość dowodzisz osiągalnością OD KORZENIA, nigdy „plikiem bez importera”.**
`node scripts/dev/reachability-from-root.mjs` liczy od `src/index.tsx` (apka) i
`dev-render/main.tsx` (harness). Samodzielny `grep -rl NazwaPliku src/` bez odrzucenia trafień w
komentarzach, w barrelach martwych razem z plikiem, i w `vi.mock`/`vi.doMock` **kłamie w obie
strony** — pokazuje trafienie tam, gdzie nie ma importu (fałszywe „żywe”), i wywala prawdziwych
konsumentów, którzy siedzą za dwoma poziomami re-eksportu (fałszywe „martwe”). Dowód z tego
dyżuru: `ActionCenter.tsx` mieszka w `AIChat/`, jest ŻYWY.

**(2) KROK 0 — RODZINA, przed KAŻDYM usunięciem.** Zanim usuniesz plik, wypisz WSZYSTKIE miejsca,
które o nim wspominają (`grep -rn <Nazwa> src/ tests/ dev-render/`), i rozstrzygnij każde trafienie:
realny import (blokuje usunięcie albo wymaga naprawy razem), barrel re-eksportujący (usuń/napraw
razem), `vi.mock`/`vi.doMock` (usuń tę linię razem), komentarz albo nazwa i18n-klucza (nie blokuje,
nie wymaga akcji).

**(3) Dowód mutacyjny na KAŻDĄ naprawę zachowania (R1-R5).** Cofnij naprawę przez `cp` ze
`SCRATCH` → nowy test ma **zaczerwienić się** → przywróć → **zzielenieć**; `git diff` po
przywróceniu **pusty**. Test broni ZACHOWANIA (render + interakcja + wynik), nigdy
`readFileSync`+`toContain` na źródle.

**(4) Po usunięciu Części B: ZERO importerów pozostałych.** `grep` po każdym usuniętym pliku w
`src/`, `tests/`, `dev-render/` ma dać **zero** trafień poza samym faktem, że pliku już nie ma
(czyli zero w ogóle) — jeśli cokolwiek zostało, to albo zapomniałeś naprawić barrel/mock (patrz
`Z40`), albo plik NIE BYŁ martwy i musisz cofnąć usunięcie.

**Wymagany dowód:** cztery zdania w raporcie, że przeczytałeś te zasady, plus `git show --stat`
każdego commita. **Bez commita — to jest warunek, nie pozycja.**

## R1 — DUPLIKAT PANELU „DATASET READY” (`A2` D-2, rdzeń)

1. **Zdecyduj, który zostaje.** Sprawdź `evidence/grafika/crimson-czat-20260903/
   canvas-kebab-restructure__{PRZED,PO}__pl__1440__{light,dark}.png` i
   `docs/program/AUDYT_16_MODULOW_20260905/01_Czat.md` (wpis `canvas-kebab-restructure`) — jeśli
   znajdziesz jednoznaczną akceptację właściciela WSKAZUJĄCĄ, który z dwóch wariantów (poza
   kebabem / w kebabie) ma zostać, zacytuj ją dosłownie i zastosuj. **Moim pomiarem: dostępne
   zrzuty i wpisy dotyczą CAŁEJ restrukturyzacji kebaba (nagie słowa → osiem grup) i kończą się
   słowem właściciela „zobaczmy” — NIE rozstrzygają wprost tego konkretnego duplikatu.** Stosujesz
   więc regułę awaryjną z briefu: **zostaje wariant POZA kebabem** (`:3737-3773`, zawsze widoczny
   gdy `pendingDataset` ustawiony), a wariant W KEBABIE (`:4230-4275`) zastępujesz JEDNYM linkiem
   „Pokaż analizy” (nowy klucz i18n, patrz TABELA LICENCJI wyjątek R1).
2. **Link „Pokaż analizy”** ma, po kliknięciu: zamknąć dropdown kebaba (ten sam mechanizm co
   `setIsDiagnosticsOpen(false)`, użyty już w pliku), tak żeby panel poza kebabem (zawsze
   renderowany, gdy jest `pendingDataset`) stał się w pełni widoczny/nieprzesłonięty. Jeśli uznasz
   za potrzebne dodatkowe przewinięcie/fokus do tego panelu — dodaj `id`/`ref` w licencjonowanym
   bloku `:3737-3773` i udokumentuj w raporcie, dlaczego.
3. **Dowód, że duplikat zniknął.** Zamontuj `WorkCanvasDocumentPanel` (albo najmniejsze
   drzewo, które je zawiera) z `pendingDataset` ustawionym i kebabem otwartym; policz w DOM
   elementy pasujące do przycisków `datasetArtifactActions` (np. po `data-testid` które dodasz,
   albo po zliczeniu przycisków w kontenerze `data-testid="canvas-dataset-actions"`) — ma wyjść
   **7+1 RAZY JEDEN**, nie razy dwa. Osobno: kebab otwarty ma pokazywać dokładnie JEDEN element
   „Pokaż analizy”, zero duplikatów przycisków analiz.
4. **Dowód mutacyjny.** Cofnij zmianę (`cp` ze `SCRATCH`, przywracasz stary blok w kebabie) → test
   z punktu 3 ma **zaczerwienić się** (znowu liczy 7+1 dwa razy) → przywróć → **zzielenieć**.
5. **Nie ruszasz treści analiz.** `datasetArtifactActions` (etykiety, `onClick`,
   `createArtifactFromDataset`) zostają identyczne — zmieniasz WYŁĄCZNIE to, GDZIE i ILE RAZY się
   renderują.

**Wymagany dowód:** cytat z evidence/audytu 16 modułów (albo jawne zdanie „nie rozstrzyga, stosuję
regułę awaryjną”) · diff bloku `:4230-4275` · test render+count 7+1×1 · mutacja w obie strony ·
`git diff` po cofnięciu pusty. **Commit po `R1`.**

## R2 — KARTA „DODAJ ELEMENT” MA ROZWIJAĆ FORMULARZ I USTAWIAĆ FOKUS (`A2` D-3, rdzeń)

1. **Dodaj dwa `useRef`** w klastrze `:1037-1134` — jeden na element `<details>` „Dodaj element”
   (`:3918`), jeden na `textarea` pola `quickAddPrompt` (`:3953-3961`). Przypnij je do JSX (`ref={...}`)
   bez zmiany reszty znaczników.
2. **Zmień `onClick` karty** (`:3849`, dziś `() => setQuickAddElement('text')`) tak, żeby OPRÓCZ
   ustawienia typu elementu: (a) ustawił `details.open = true` na ref z kroku 1, (b) przeniósł fokus
   klawiatury na `textarea` z kroku 1 (np. przez `requestAnimationFrame` albo mikrotask, żeby DOM
   zdążył się przemalować — `<details>` niewidoczne wciąż trzyma węzły w drzewie, więc `.focus()`
   powinno zadziałać od razu, ale zmierz to empirycznie i zapisz, czy `requestAnimationFrame` było
   potrzebne).
3. **Dowód behawioralny.** Zamontuj panel, sprawdź że `<details>` startuje ZAMKNIĘTE (`.open ===
   false` / brak atrybutu w renderze), kliknij kartę „Dodaj element” z Najczęstszych działań,
   sprawdź: `.open === true` ORAZ `document.activeElement` wskazuje na `textarea` z kroku 1.
4. **Dowód mutacyjny.** Cofnij zmianę `onClick` (przywróć wyłącznie `setQuickAddElement('text')`) →
   test ma **zaczerwienić się** (details zostaje zamknięte, fokus nie przechodzi) → przywróć →
   **zzielenieć**; `git diff` po cofnięciu **pusty**.
5. **Nie zmieniasz** typów elementu (`text/heading/table/diagram/list/summary`), treści `hint.title`/
   `hint.detail`, ani logiki `insertQuickAddElement`.

**Wymagany dowód:** diff dwóch nowych `useRef` + zmienionego `onClick` · test render + klik +
asercja `open`/`activeElement` · mutacja w obie strony · `git diff` po cofnięciu pusty.
**Commit po `R2`.**

## R3 — `TaskDropdown` „CREATE NEW TASK”: ETYKIETA UCZCIWA (`F` D-2, rdzeń)

1. **Potwierdź brak intencji tworzenia** (już zmierzone w `§0.1`, potwierdź sam): `myWorkIntent`
   (`src/store/slices/uiSlice.ts:76-84`) nie ma wariantu do otwarcia formularza „nowe zadanie” —
   tylko `tab` i `open` (otwarcie ISTNIEJĄCEGO obiektu po `id`). Jeśli Twój pomiar znajdzie inny,
   dotąd nieopisany mechanizm (np. `myWorkEvent` z typem `item:created` wywoływanym z zewnątrz PRZED
   nawigacją) — **opisz go i rozważ, czy da się go użyć zamiast zmiany etykiety**; jeśli tak, to
   jest droga (A) zamiast (B) niżej, i wymaga własnego dowodu HTTP/UI, że rzeczywiście otwiera
   kreator. **Domyślnie (jeśli nie znajdziesz) — droga (B).**
2. **(A) Jeśli intencja istnieje:** podłącz ją tak, żeby klik faktycznie otwierał formularz
   tworzenia zadania (nie tylko listę), z dowodem: render → klik → formularz/modal tworzenia
   widoczny w DOM.
3. **(B) Jeśli intencja NIE istnieje (oczekiwane):** zmień wartość klucza `taskDropdown.createNew`
   w OBU słownikach na uczciwą etykietę nawigacyjną — **„Przejdź do zadań”** (PL) / **„Go to
   tasks”** (EN) albo równoważną, uzgodnioną semantycznie z tym, co przycisk NAPRAWDĘ robi
   (nawiguje do `/my-work`, zakładka `tasks`). **Zakaz zmiany nazwy klucza i zakaz dotykania
   jakiegokolwiek innego klucza.**
4. **Dowód behawioralny.** Zamontuj `TaskDropdown` z pustą listą zadań, otwórz dropdown, sprawdź że
   widoczny tekst przycisku stanu pustego równa się NOWEJ etykiecie (nie starej „Create new task”/
   „Utwórz nowe zadanie”), i że klik nadal wywołuje `setMyWorkIntent({tab:'tasks'})` +
   `setCurrentView(MY_WORK)` (zachowanie nawigacji NIE ZMIENIA SIĘ — zmienia się tylko obietnica w
   etykiecie).
5. **Dowód mutacyjny.** Cofnij zmianę klucza (`cp` ze `SCRATCH`) → test z punktu 4 (część
   sprawdzająca tekst) **czerwony** → przywróć → **zielony**.

**Wymagany dowód:** ustalenie drogi (A) czy (B) z uzasadnieniem · diff wartości klucza w obu
słownikach (droga B) albo diff podłączenia realnego kreatora (droga A) · test render+tekst+klik ·
mutacja w obie strony. **Commit po `R3`.**

## R4 — `NotificationDropdown` „SKRZYNKA”/„CENTRUM”: JEDEN PRZYCISK (`F` D-5, rdzeń)

1. **Usuń duplikat.** Zostaw blok `:373-383` („Skrzynka” / `notificationDropdown.inbox`), usuń
   blok `:384-394` („Centrum” / `notificationDropdown.center`, `.openCenter`) w całości — sam
   przycisk, nie klucze i18n (klucze zostają w słowniku nietknięte, mogą się przydać gdzie indziej
   albo są na liście dyżuru 372 — sprawdź przed usunięciem, `Z40`).
2. **Dowód behawioralny.** Zamontuj `NotificationDropdown`, otwórz nagłówek, policz przyciski
   wywołujące `setMyWorkIntent({tab:'inbox'})` + `setCurrentView(MY_WORK)` — ma wyjść **dokładnie
   1**, nie 2. Sprawdź też, że pozostały przycisk ma dostępną nazwę/`title` odpowiadającą
   `notificationDropdown.inbox`/`.openInbox`.
3. **Dowód mutacyjny.** Przywróć usunięty blok (`cp` ze `SCRATCH`) → licznik z punktu 2 wraca do 2,
   test **czerwony** → usuń ponownie → **zielony**; `git diff` po ostatecznym stanie zgodny z
   zamierzoną zmianą (blok trwale usunięty w commicie).
4. **Nie zmieniasz** reszty nagłówka (`Mark all read`, `Close`) ani logiki `handleMarkAllRead`.

**Wymagany dowód:** diff usuniętego bloku · test render+count(1) · mutacja w obie strony.
**Commit po `R4`.**

## R5 — `ChatHistorySidebar` FALLBACK UJEDNOLICONY (`C` D-2)

1. **Zmień fallback** w linii `:1060` z `t('aiChat.newChat', 'Nowy czat')` na
   `t('aiChat.newChat', 'Nowa rozmowa')` — dokładnie wartość, jaką dziś zwraca klucz w
   `public/locales/pl/translation.json`. **Zakaz dotykania słownika** — to WYŁĄCZNIE literał w
   kodzie JS.
2. **Dowód behawioralny (fallback jest niewidoczny w normalnym renderze, bo klucz istnieje —
   trzeba wymusić jego brak).** Zamontuj `ChatHistorySidebar` z instancją i18n, w której klucz
   `aiChat.newChat` jest CELOWO usunięty/nadpisany na `undefined` (np. `i18n.addResourceBundle` z
   pominiętym kluczem, albo lokalny mock `useTranslation` zwracający realny fallback drugiego
   argumentu przy braku klucza — wybierz metodę zgodną z tym, jak reszta pakietu testuje i18n w
   tym repo, opisz wybór w raporcie). Sprawdź, że widoczny tekst przycisku „Nowy czat” (duży
   przycisk w panelu historii) równa się **„Nowa rozmowa”**, nie „Nowy czat”.
3. **Dowód mutacyjny.** Cofnij zmianę fallbacku → test **czerwony** (pokazuje „Nowy czat”) →
   przywróć → **zielony**.

**Wymagany dowód:** diff jednej linii · test render z wymuszonym brakiem klucza + asercja tekstu ·
mutacja w obie strony. **Commit po `R5`.**

## R6 — CZĘŚĆ B: POMIAR I USUNIĘCIE MARTWYCH PLIKÓW (rdzeń)

1. **Zmierz od zera na SWOIM worktree** (nie kopiuj moich liczb): `node scripts/dev/
   reachability-from-root.mjs > $ARTEFAKTY/reach-before.json`, wyfiltruj szesnastu kandydatów po
   PEŁNEJ ścieżce (nie substring — patrz Pułapka (6)). Zapisz klasyfikację każdego: `unreachable`
   albo `test-only`. **Jeżeli którykolwiek wyjdzie `app`/`harness-only` — ZATRZYMUJESZ się na TYM
   pliku, nie usuwasz go, piszesz dlaczego w raporcie** (to dokładnie to, co stało się z
   `ActionCenter.tsx` w tej instrukcji).
2. **KROK 0 — rodzina, dla KAŻDEGO kandydata z osobna** (`R0` punkt 2): `grep -rn <Nazwa> src/
   tests/ dev-render/`, rozstrzygnij każde trafienie (realny import / barrel / mock / komentarz).
   Zapisz tabelę: plik kandydata → lista trafień → klasyfikacja każdego → decyzja.
3. **Usuń plik + jego dedykowany test** (dla trójki `test-only`) w JEDNYM commicie na plik (albo
   w jednym commicie dla logicznej pary plik+test+barrel+mock, jeśli są powiązane — np.
   `WorkCanvasShell.tsx` + `tests/components/AIChat/WorkCanvasShell.test.tsx` +
   `WorkCanvas/index.ts` w jednym commicie).
4. **Napraw barrel `WorkCanvas/index.ts`** w tym samym commicie co `WorkCanvasShell.tsx` — usuń
   CAŁY plik (skoro sam jest `unreachable` i jego jedyny nie-typowy eksport znika) ALBO usuń
   wyłącznie linię re-eksportu `WorkCanvasShell`, zostawiając re-eksport typów, JEŚLI Twój pomiar
   pokaże, że coś jednak importuje ten barrel dla typów (`R0` punkt 1 wymaga to sprawdzić —
   moim pomiarem na markerze: nic go nie importuje, typy idą bezpośrednio z `./types`, więc
   REKOMENDUJĘ usunięcie całego barrela, ale zweryfikuj sam).
5. **Posprzątaj dwa martwe mocki** w tym samym commicie co plik, na który wskazują: usuń linię
   `:98` w `EnhancedChatInput.teresaVoice.test.tsx` (mock `InputHintStrip`) razem z commitem
   usuwającym `InputHintStrip.tsx`; usuń blok `:266-268` w `UnifiedChatPanel.test.tsx` (mock
   `PendingActionsIndicator`) razem z commitem usuwającym `PendingActionsIndicator.tsx`. Po każdym
   z tych dwóch commitów: `npx vitest run <plik testowy>` PRZED (na kopii ze `SCRATCH`, z plikiem
   źródłowym jeszcze obecnym) i PO (plik źródłowy usunięty, mock usunięty) — oba zielone, ta sama
   lista pełnych nazw testów w pliku (poza usuniętym mockiem, który nie jest testem tylko
   deklaracją).
6. **Dowód „zero importerów pozostałych”, PO wszystkich usunięciach.** Dla KAŻDEGO usuniętego
   pliku: `grep -rn <Nazwa> src/ tests/ dev-render/` ma dać **zero** wyników. Jeśli cokolwiek
   zostało — **STOP**, nie kończysz `R6`, naprawiasz brakujący krok (barrel/mock) albo cofasz
   usunięcie tego jednego pliku.
7. **`esbuild` per plik** na każdym pliku, który wg kroku 2 miał realny import/barrel wskazujący
   na usuwany plik — oczekiwane: PO naprawie w krokach 3-5, esbuild przechodzi bez błędu importu.
8. **Zaktualizuj i sprawdź baseline**: `--update-baseline` (skrypt sam odmówi, gdyby zbiór
   UROSŁ — Ty go tylko zmniejszasz), zapisz `unreachable`/`test-only` przed i po w raporcie, potem
   `--check-baseline` końcowe, kod `0`. Cztery bezpieczniki (`check-list-canon.sh`,
   `check-focus-canon.sh --ci`, `check-artefakt.sh`, plus `--check-baseline` już policzone) —
   wszystkie kod `0`.
9. **Tabela raportu, jeden wiersz na usunięty plik**: ścieżka, dowód nieosiągalności (komenda +
   wynik dosłowny), rozmiar, czy miał dedykowany test (i jego los), czy wymagał naprawy
   barrela/mocka. Osobno zmierz i zapisz jako znalezisko (NIE usuwaj) dwa martwe barrele
   `Artifacts/index.ts`/`renderers/index.ts`/`renderers/index2.ts` — `unreachable`, ale poza
   listą kandydatów TEGO dyżuru.

**Wymagany dowód:** `reach-before.json`/`reach-after.json` · tabela KROK 0 dla każdego kandydata ·
commity per plik/grupa · dwa dowody `vitest run` przed/po dla plików z mockami · dowód „zero
importerów” per plik usunięty · `esbuild` per plik naprawiony · `--update-baseline` +
`--check-baseline` zielony · cztery bezpieczniki zielone · tabela raportu z rozmiarami.
**Commit(y) po `R6`** (jeden na plik/grupę, zgodnie z krokiem 3).

## R7 — RAPORT, REJESTR ZNALEZISK, PYTANIA DO WŁAŚCICIELA

Raport zawiera: pięć napraw Części A z dowodem behawioralnym i mutacyjnym każda · tabelę usuniętych
plików Części B (ścieżka, dowód, rozmiar, los testu/barrela/mocka) · dwie korekty wobec briefu
(`ActionCenter.tsx`, `Artifacts/**`) z dowodem importerów · dowód „zero importerów pozostałych” ·
stan baseline reachability przed/po · listę rozbieżności wobec liczb tej instrukcji · niepustą
sekcję „TWIERDZENIA NIEZWERYFIKOWANE”.

★★ **Osobna, obowiązkowa sekcja: „ZNALEZISKA POZA ZAKRESEM”.** Dwa martwe barrele `Artifacts/
index.ts`/`renderers/index.ts`/`renderers/index2.ts` · `MyWork/table/SmartSuggestionsBar.tsx`
(martwy, ale inny moduł) · wszystko inne, co pomiar wykaże jako martwe, a nie jest na liście
kandydatów tego dyżuru.

★★ **Osobna, obowiązkowa sekcja: „PYTANIA DO WŁAŚCICIELA”.** Jeśli `R1` nie znalazł jednoznacznej
akceptacji, które z dwóch miejsc duplikatu „Dataset ready” miało zostać — zapisz to jako pytanie
(nawet jeśli zastosowałeś regułę awaryjną i już wdrożyłeś rozwiązanie: właściciel może zażądać
odwrotnej kolejności przy następnym przeglądzie ekranu). Sekcja **nie może być pusta**.

★ Zanim dopiszesz cokolwiek do `REJESTR_ZNALEZISK_20260903.md`, sprawdź pierwszą wolną literę TUŻ
PRZED COMMITEM: `bash -c "grep -nE '^## [A-Z]+\.' docs/program/REJESTR_ZNALEZISK_20260903.md |
tail -3"` — moim pomiarem 05.09 to `AG` (po `AF`), ale równolegle piszą autorzy 367-372.

**Commit po `R7`.**

## Próg odbioru

**Pięć duplikatów/mylących etykiet Części A naprawionych z dowodem behawioralnym i mutacyjnym,
zachowanie nawigacyjne tam, gdzie nie miało się zmienić, NIETKNIĘTE; szesnaście kandydatów Części
B zmierzonych na TWOIM worktree metodą osiągalności od korzenia, usunięte TYLKO te potwierdzone
martwe, z zerem importerów pozostałych po usunięciu, z naprawionymi barrelami/mockami w tym samym
commicie, i z baseline reachability zaktualizowanym.**

Odbiorca odrzuci dyżur, w którym: jakikolwiek nowy test sprawdza tekst źródła zamiast zachowania;
usunięto plik, który okazał się żywy (np. `ActionCenter.tsx`); pozostał dziurawy barrel albo martwy
`vi.mock`/`vi.doMock` wskazujący usunięty plik; zmieniono zachowanie nawigacji `TaskDropdown`/
`NotificationDropdown` zamiast wyłącznie etykiety; usunięto lub zmieniono klucz i18n z listy
dyżuru 372; zmienił się stan choćby jednego wiersza macierzy odbioru.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „`R1`-`R5` naprawione i
udowodnione mutacyjnie, `R6` zatrzymany po ośmiu z szesnastu plików, bo pozostałe osiem wymaga
dodatkowej naprawy barrela, którą wykonam w kolejnym kroku” — **jest pełnowartościowym wynikiem**.

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: sprawdzasz warunek NA
BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku. Wynik ponownego
sprawdzenia wklejasz do raportu z datą i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Usuń martwe pliki” vs „nie zmieniaj `public/locales/**`” | Tabela licencji: usuwanie PLIKÓW komponentów nie usuwa KLUCZY i18n — klucze osierocone WYŁĄCZNIE przez usuwany plik zostają, chyba że nie figurują na liście 372 (wtedy i tak zostają, bo ten dyżur nie ma licencji na usuwanie kluczy w ogóle — tylko na 2 wyjątki imienne w R1/R3) |
| „Etykieta ma być uczciwa” vs „nie zmieniasz logiki nawigacji” | `R3` punkt 3: zmieniasz WYŁĄCZNIE tekst klucza, `handleNavigateToTasks` zostaje identyczny |
| „Panel ma zostać jeden” vs „nie wiadomo, który właściciel zaakceptował” | `R1` punkt 1: reguła awaryjna z briefu (zostaje poza kebabem), z jawnym pytaniem do właściciela w `R7` |
| „Dodaj nowy przycisk (Pokaż analizy)” vs „BRAK NOWYCH FLAG / brak nowego UI” | `POZYCJE_Z_FLAGAMI`: to redukcja duplikatu (jeden z dwóch już wdrożonych zestawów znika), nie nowa funkcja — bez flagi |
| „Usuń `WorkCanvasShell.tsx`” vs „`WorkCanvas/index.ts` nietykalny jako martwy plik spoza listy” | `R6` punkt 4: barrel JEST powiązany z kandydatem z listy (re-eksportuje go), więc naprawa w tym samym commicie jest WYMAGANA, nie opcjonalna — różni się od dwóch martwych barreli `Artifacts/*`, które nie re-eksportują żadnego kandydata tego dyżuru |
| „Usuń pliki testowe kandydatów” vs „nie dotykaj `tests/setup.ts`/`__mocks__`” | Rozróżnienie: usuwasz DEDYKOWANE testy komponentu (`__tests__/InputHintStrip.test.tsx` itd.), nigdy globalną infrastrukturę testową |
| „`ActionCenter.tsx` jest na liście briefu” vs „Twój pomiar mówi że jest żywy” | `R0` punkt 1 i `Z40`: Twój pomiar wygrywa, audyt źródłowy się mylił, dowód importerów idzie do raportu |
| „Zmierz baseline” vs „baseline nietykalny” | Tabela licencji: nietykalny RĘCZNIE, aktualizacja WYŁĄCZNIE przez własny skrypt z `--update-baseline`, który sam broni się przed wzrostem |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 8 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — wszystkie ścieżki Części A i B sprawdzone `git show <marker>:<ścieżka>`; `evidence/duplikaty-martwe-20260905/` jawnie oznaczony jako nieistniejący |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 12 wierszy, wszystkie zmierzone na markerze albo na bliskim checkoucie z jawnie opisaną rozbieżnością (`reach=1`) |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP” | TAK — panel kanwy (4 bloki) · TaskDropdown · NotificationDropdown · ChatHistorySidebar · model intencji · 2 wyjątki słownikowe · reszta słowników · kandydaci unreachable · kandydaci test-only · barrel zależny · martwe mocki · guard bez importu · cudze żywe rodziny · martwe barrele poza zakresem · baseline · nowe testy · infrastruktura testowa · macierz · rejestr · raport · serwer · reszta |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1`/`R2` dotykają precyzyjnie wskazanych bloków jednego pliku (nie całych 5278 linii), `R3`-`R5` po jednym pliku, `R6` iteruje plik po pliku z jawnym stopem na nietrafionym |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — porty 6444/5584 nieużywane przez rodzeństwo 367-372; ten dyżur w ogóle nie wymaga kontenera DB |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na checkoucie bliskim markerowi, z jawnym opisem jedynej rozbieżności |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — siedem pułapek własnych (plik-bez-importera, martwe poddrzewo, komentarz-nie-import, barrel dziurawy, mock-nie-AST-import, rodziny o podobnej nazwie, klucz-przetłumaczony-ale-kłamie) |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, zero pól szablonu | TAK — kontrola generatora przy wydaniu |
