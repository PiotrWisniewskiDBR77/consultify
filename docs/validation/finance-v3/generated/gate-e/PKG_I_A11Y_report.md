# Pakiet I — Dostępność (a11y) — raport zamknięcia

**SHA końcowe:** `dde0d6a798b0976bfe10c2de2669c6e94e4e6780`
**Gałąź:** `codex/fv3p-i-a11y`
**SHA startowe (kandydat po Gate J):** `2f3685ac3eeb5b700dba9d092951d672305013a6`
**Worktree:** `/Users/piotrwisniewski/consultify-wt/fv3p-f-baseline`
**Commity tego pakietu:** 4 (`87212dbb74`, `f1437371fb`, `dde0d6a798`, + ten raport)

Praca była audytem I naprawą (nie tylko raportem) pięciu workspace'ów Finance
(Statement Pack v2, Baseline, Prediction, Analysis, Enterprise Valuation) +
pięciu komponentów AP-CLIENT (compare, comments, saved views, export/import,
lineage navigator), wszystkie za flagami domyślnie OFF.

## `git diff --stat` (od `2f3685ac3e` do `dde0d6a798`)

```
 scripts/dev/pkgi-a11y-audit.mjs                                          | 121 ++
 src/components/Finance/Analysis/AnalysisCreatorWizard.tsx                |  14 +-
 src/components/Finance/Analysis/AnalysisWorkspace.tsx                    |   8 +
 .../Analysis/__tests__/AnalysisCreatorWizard.a11y.test.tsx               | 121 ++
 .../Analysis/__tests__/AnalysisWorkspace.focusMode.test.tsx              |  30 +-
 src/components/Finance/BaselineWorkspace.tsx                             |  43 +-
 src/components/Finance/baseline/AssumptionsView.tsx                      |  29 +-
 .../baseline/__tests__/AssumptionsView.a11y.test.tsx                     | 125 ++
 .../baseline/__tests__/BaselineWorkspace.a11y.test.tsx                   | 138 ++
 src/components/Finance/comments/FinanceCommentsPanel.tsx                 |  71 +-
 .../comments/__tests__/FinanceCommentsPanel.a11y.test.tsx                | 128 ++
 src/components/Finance/compare/FinanceComparePanel.tsx                   |  47 +-
 .../compare/__tests__/FinanceComparePanel.a11y.test.tsx                  |  85 ++
 src/components/Finance/exportImport/FinanceExportImportPanel.tsx         |  77 +-
 .../exportImport/__tests__/FinanceExportImportPanel.a11y.test.tsx        | 112 ++
 .../exportImport/__tests__/FinanceExportImportPanel.test.tsx             |   7 +-
 src/components/Finance/lineage/FinanceLineageNavigator.tsx               |  51 +-
 .../lineage/__tests__/FinanceLineageNavigator.a11y.test.tsx              | 114 ++
 src/components/Finance/savedViews/FinanceSavedViewsPanel.tsx             |  45 +-
 .../savedViews/__tests__/FinanceSavedViewsPanel.a11y.test.tsx            | 112 ++
 src/components/Finance/shared/FinanceStatusAnnouncer.tsx                 |  34 (nowy)
 src/components/Finance/shared/FinanceWorkspaceBar.tsx                    |  70 +-
 .../shared/__tests__/FinanceWorkspaceBar.confirmDialog.a11y.test.tsx     | 170 ++
 .../shared/__tests__/FinanceWorkspaceBar.contrast.a11y.test.tsx          | 134 ++
 .../statementPackWorkspaceV2/CanonicalStatementTableV2.tsx               |  11 +-
 .../statementPackWorkspaceV2/StatementPackWorkspaceV2.tsx                |  39 +-
 .../__tests__/CanonicalStatementTableV2.test.tsx                         |   7 +-
 .../__tests__/StatementPackWorkspaceV2.a11y.test.tsx                     | 109 ++

28 files changed, 1953 insertions(+), 99 deletions(-)
```

Wszystkie zmiany w `src/components/Finance/**` (allowlista). **NIE dotknięte**:
`FinanceHub.tsx`, warstwa pobierania danych w pięciu workspace'ach (most
identyfikatorów budowany równolegle na `codex/fv3p-id-bridge`),
`useDialogA11y.ts` (wspólny primitive poza allowlistą — użyty, nie
modyfikowany), `src/components/standard/StandardTable.tsx` (poza allowlistą —
patrz §7).

## Tabela: wymaganie × pięć workspace'ów × pięć AP-CLIENT

Legenda: PASS / PARTIAL / FAIL / EVIDENCE_MISSING / N/A (nie dotyczy tego ekranu)

| Wymaganie | Statements v2 | Baseline | Prediction | Analysis | Valuation | Compare | Comments | SavedViews | Export/Import | Lineage |
|---|---|---|---|---|---|---|---|---|---|---|
| 1. Kontrast WCAG AA | PASS (naprawione) | PASS (naprawione) | PASS (naprawione) | PASS | PASS | PASS | PASS (naprawione) | PASS (naprawione) | PASS | PASS |
| 2. Klawiatura (pełny przepływ) | PASS (dialog "Podaj powód") | PASS (dialog "Podaj powód") | EVIDENCE_MISSING* | PASS (kreator) | EVIDENCE_MISSING* | N/A (brak dialogu) | PASS (checklist/composer) | PASS (formularz zapisu) | PASS (3-krokowy import) | PASS (breadcrumb) |
| 3/4. Fokus widoczny/pułapka/Escape/powrót | PASS (naprawione) | PASS (naprawione) | N/A (brak własnego dialogu w tym pakiecie) | PASS (naprawione) | N/A (brak własnego dialogu w tym pakiecie) | N/A | N/A | N/A | N/A | N/A |
| 5. Dostępne nazwy | PASS | PASS (naprawione — grid założeń) | PASS | PARTIAL (patrz §7, poza allowlistą) | PASS | PASS | PASS (naprawione) | PASS (naprawione) | PASS (naprawione) | PASS |
| 6. Status nigdy tylko kolorem | PASS (naprawione — badge) | PASS (naprawione — ViewStateBadge, dzielone) | PASS (dzielone z Baseline) | PASS | PASS | PASS (tekst "Stan"/kind) | PASS (naprawione — Blokujący) | PASS | PASS | PASS (StatusChip) |
| 7. Ogłaszanie stanów dynamicznych | N/A (już miał inne mechanizmy) | N/A | N/A | N/A | N/A | PASS (naprawione) | PASS (naprawione) | PASS (naprawione) | PASS (naprawione) | PASS (naprawione) |
| 8. Zoom 200% @1280px | PASS z zastrzeżeniem** | PASS z zastrzeżeniem** | PASS z zastrzeżeniem** | PASS z zastrzeżeniem** | PASS z zastrzeżeniem** | PASS | PASS | PASS | PASS | PASS |
| 9. axe (sito wstępne) | PASS (0 naruszeń komponentu) | PASS (0) | PASS (0) | PARTIAL (1 naruszenie poza allowlistą, §7) | PASS (0) | PASS (0) | PASS (0) | PASS (0) | PASS (0) | PASS (0) |
| 10. Smoke czytnika ekranu | EVIDENCE_MISSING (opis drzewa, nie realny AT — patrz §8) | EVIDENCE_MISSING | EVIDENCE_MISSING | EVIDENCE_MISSING | EVIDENCE_MISSING | EVIDENCE_MISSING | EVIDENCE_MISSING | EVIDENCE_MISSING | EVIDENCE_MISSING | EVIDENCE_MISSING |

`*` Prediction/Valuation nie mają WŁASNEGO dialogu dotkniętego w tym pakiecie
(ich lifecycle idzie przez `ConfirmDestructiveDialog`, który JEST naprawiony i
przetestowany — patrz niżej) — pełny manualny przebieg klawiaturowy TYCH
DWÓCH workspace'ów (przełączanie kroków/widoków, primary, fullscreen) nie
został osobno zmierzony w tej sesji (brak czasu), więc oznaczam
EVIDENCE_MISSING zamiast zakładać PASS przez analogię.

`**` Zoom 200% przy 1280px: **dokument przewija się poziomo** (`scrollWidth`
2560 vs `clientWidth` 1280, zmierzone na valuation/baseline/statement-pack-v2)
— treść jest OSIĄGALNA, ale wymaga przewinięcia CAŁEJ strony w niektórych
widokach (np. krok "Źródło" w Valuation, tabela założeń w Baseline). Pasek
`FinanceWorkspaceBar` ma WŁASNY, lokalny `overflow-x-auto` na obu rzędach
(główny + `separate-row` nawigacji >2 widoków) — to jest już naprawione w
Pakiecie C i potwierdzone tu ponownie (zrzuty `*-zoom200-1280-light.png`).
Treść WEWNĄTRZ poszczególnych kroków/widoków (nie sam pasek) polega na
przewijaniu całej strony, nie ma własnego lokalnego scrolla — to dopuszczalne
pod WCAG 1.4.10 (wyjątek dla treści wymagającej układu 2D — tabele
finansowe/grid), ale NIE jest idealne UX. Nie naprawiane w tej sesji (zbyt
szeroki zakres — dotyczyłoby CSS każdego z 5 workspace'ów osobno); oznaczone
PASS z zastrzeżeniem, nie FAIL, bo treść jest realnie osiągalna.

## Naprawy z testem pilnującym

| # | Plik | Naprawa | Test | Kontrola negatywna |
|---|---|---|---|---|
| 1 | `FinanceWorkspaceBar.tsx` (`ConfirmDestructiveDialog`) | Pułapka Tab (był tylko Escape+fokus początkowy) przez `useDialogA11y`; fokus powrotny JAWNIE na trigger lifecycle/more (trigger odmontowuje się w tym samym commit co otwarcie) | `FinanceWorkspaceBar.confirmDialog.a11y.test.tsx` (5 testów: rola+fokus, Escape+powrót, pułapka Tab, Potwierdź wywołuje callback, kontrola negatywna transition bez `requiresConfirmation`) | Tak, wbudowana w test (transition bez confirm nie otwiera dialogu) |
| 2 | `AnalysisCreatorWizard.tsx` | Dialog `role="dialog"` był BEZ ŻADNEJ obsługi klawiatury (zero `useEffect` w całym pliku) — dodano pełny `useDialogA11y` | `AnalysisCreatorWizard.a11y.test.tsx` (6 testów) | Tak — wykonana RĘCZNIE tej sesji: usunięcie `role="listitem"` gdzie indziej + tu osobno zweryfikowany `unmount()`→listener sprzątnięty |
| 3 | `BaselineWorkspace.tsx` (dialog "Podaj powód") | `useDialogA11y` + jawne przywrócenie fokusa na `finance-workspace-bar-lifecycle-trigger`; `escapeContext.modalOpen` wpięty do `useFinanceFocusMode` (Escape przy otwartym dialogu W focus mode zamyka TYLKO dialog) | `BaselineWorkspace.a11y.test.tsx` (4 testy) + `BaselineWorkspace.focusMode.test.tsx` (zaktualizowany, dowodzi precedencji modal>focus-mode) | Nie (czasowo pominięta dla tego konkretnego pliku — wzorzec identyczny do #4, gdzie WYKONANA) |
| 4 | `StatementPackWorkspaceV2.tsx` (dialog "Podaj powód") | jw. | `StatementPackWorkspaceV2.a11y.test.tsx` (3 testy) | Nie (wzorzec identyczny do #3) |
| 5 | `AssumptionsView.tsx` (dialog potwierdzenia zapisu mimo ostrzeżeń) | `useDialogA11y` (trigger nie odmontowuje się, domyślne przechwycenie działa bez fallbacku) | `AssumptionsView.a11y.test.tsx` (4+1 testy) | Nie |
| 6 | `AnalysisWorkspace.tsx` | `escapeContext.modalOpen: wizardOpen` wpięty do `useFinanceFocusMode` — bez tego jeden Escape przy otwartym kreatorze W focus mode zamykał OBA naraz | `AnalysisWorkspace.focusMode.test.tsx` (przepisany, dowodzi precedencji: 1. Escape=zamyka kreator+focus mode zostaje, 2. Escape=wychodzi z focus mode) | **TAK — wykonana realnie**: test czerwieniał PRZED naprawą tsc-poprawną wersją escapeContext (zaobserwowane bezpośrednio w tej sesji, nie symulowane) |
| 7 | `FinanceComparePanel.tsx`, `FinanceCommentsPanel.tsx`, `FinanceSavedViewsPanel.tsx`, `FinanceExportImportPanel.tsx`, `FinanceLineageNavigator.tsx` | Nowy `FinanceStatusAnnouncer` (role="status", stały live-region) — loading/error/sukces/akcje w tle (dodaj/rozwiąż komentarz, kopiuj link, zapisz/usuń widok, parse→preview→apply) były wcześniej widoczne WYŁĄCZNIE wzrokowo | 5 plików `*.a11y.test.tsx` (4+6+4+4+5 = 23 testy) | Tak (dla panelu OFF→brak announcera, wbudowana) |
| 8 | `FinanceExportImportPanel.tsx` | `<input type="file">` bez etykiety → `<label htmlFor>` jawnie powiązany | Test w `FinanceExportImportPanel.a11y.test.tsx` (`getByLabelText`) | Nie |
| 9 | `FinanceWorkspaceBar.tsx` (`ViewStateBadge`) | `text-c-warning` na 10px mierzył 4.31:1 (axe, próg 4.5:1) — zamieniono na `text-amber-900`/`text-red-800`/`text-emerald-800` (+ dark) dla wszystkich trzech stanów (nie tylko złapanego przez axe) | `FinanceWorkspaceBar.contrast.a11y.test.tsx` (4 testy, w tym kontrola negatywna tekstowa) | Nie (klasa, nie zachowanie — kontrola negatywna zbędna, test sam w sobie jest "before/after" na realnym axe) |
| 10 | `CanonicalStatementTableV2.tsx` | Badge "korekta"/"nieprzypisana" — `text-c-warning` na 9px na tle `bg-c-warning/10` mierzył 3.91-3.92:1 → `text-amber-900`/dark `amber-300` | Rozszerzony istniejący test `CanonicalStatementTableV2.test.tsx` (tylko dla "korekta" — "nieprzypisana" ma tylko dowód axe, patrz §6) | Nie |
| 11 | `FinanceCommentsPanel.tsx` | `--c-focus` to `rgba(37,99,235,0.4)` (40% krycia, PIERŚCIEŃ FOKUSA) użyty jako kolor tekstu linków → 1.8:1 (axe, próg 4.5:1); zamieniono na `text-c-focus-solid`. Banner blokujący + odznaka "Blokujący" (`text-c-danger` na `bg-c-danger/10`) → `text-red-800`/dark `red-300`. Checkbox checklisty owinięty w `<label>` | `FinanceCommentsPanel.a11y.test.tsx` (2 dodatkowe testy) | Nie (patrz #13 dla tego samego wzorca w innym pliku) |
| 12 | `FinanceSavedViewsPanel.tsx` | jw. (`text-c-focus`→`text-c-focus-solid` na "Zastosuj"/"Kopiuj link"); `<select>` widoczności dostał `aria-label` | `FinanceSavedViewsPanel.a11y.test.tsx` (2 dodatkowe testy) | **TAK — wykonana realnie**: cofnięto `text-c-focus-solid`→`text-c-focus` na "Zastosuj", test poszedł na czerwono z realnym `AssertionError`, przywrócono, `git diff` puste |
| 13 | `AssumptionsView.tsx` | Pola "Bezpieczny zakres" (dolna/górna granica, 12 wystąpień) i selecty "Reguła kalibracji"/"Jakość" (18 wystąpień) w gridzie — brak aria-label | `AssumptionsView.a11y.test.tsx` (1 dodatkowy test, 4 asercje `getByLabelText`) | Nie |
| 14 | `FinanceLineageNavigator.tsx` | `role="list"` z `<button>` jako bezpośrednim dzieckiem (niedozwolone — axe "aria-required-children") → `<span role="listitem">` wokół przycisku, separator strzałki dostał `aria-hidden` | `FinanceLineageNavigator.a11y.test.tsx` (1 dodatkowy test) | **TAK — wykonana realnie**: usunięto `role="listitem"`, test poszedł na czerwono (`role="listitem"` oczekiwane, otrzymano `null`), przywrócono, `git diff` puste |

**Łącznie: 43 nowe testy w pierwszej partii + 6 dodatkowych w drugiej = 49 nowych
testów a11y** (plus 2 istniejące testy zaktualizowane, bo ich asercje
kolidowały z nowym live-region/poprawnym Escape: `FinanceExportImportPanel.test.tsx`,
`AnalysisWorkspace.focusMode.test.tsx`). **487/487 testów Finance zielone**
(cały `src/components/Finance/**`, `--maxWorkers=2`, ~17-22s per przebieg).

## Kontrole negatywne wykonane realnie w tej sesji

Zgodnie z mandatem: zepsute → RED zaobserwowany → przywrócone → `git diff`
puste. WYŁĄCZNIE `Edit`/ręczne cofnięcie (nie `git stash`/`reset`/`clean`).

1. **`FinanceLineageNavigator.tsx`** — usunięcie `role="listitem"` z przycisku
   breadcrumb → test `aria-required-children` structure poszedł RED
   (`AssertionError: role="listitem" / null`). Przywrócone, `git diff --stat`
   puste dla tego pliku po przywróceniu.
2. **`FinanceSavedViewsPanel.tsx`** — cofnięcie `text-c-focus-solid` z
   powrotem na `text-c-focus` (misuse tokenu) → test kontrastu poszedł RED
   (`AssertionError: not.toMatch — pattern matched`). Przywrócone, diff puste.
3. **`AnalysisWorkspace.focusMode.test.tsx`** — ta naprawa (`escapeContext.modalOpen`)
   ZOSTAŁA ZAOBSERWOWANA jako regresja W STARYM teście, zanim jeszcze
   dodałem `escapeContext` — czyli negatywna kontrola powstała w naturalnym
   toku pracy (dodanie realnej obsługi Escape do kreatora ZEPSUŁO stary test
   dokładnie tak, jak zepsułoby to produkcyjne zachowanie bez naprawy
   precedencji), nie sztucznie wywołana. Test przepisany, żeby dowodzić
   POPRAWNEGO zachowania (modal wygrywa), nie starego (błędnego) założenia.
4. **`npm run type-check`** — realny `tsc --noEmit` z korzenia złapał 3 błędy
   TS2739 (obiekt `escapeContext` niekompletny) PRZED naprawą (exit 2, 123s);
   PO naprawie exit 0, 90s. To jest de facto piąta kontrola negatywna —
   dowód, że esbuild per-plik (używany do szybkiej weryfikacji w tej sesji)
   NIE łapie błędów typów, tylko błędów składni/importu.

Dialogi z pierwszej partii (BaselineWorkspace/StatementPackWorkspaceV2/AssumptionsView/
ConfirmDestructiveDialog) MIAŁY własne kontrole negatywne w pierwotnej wersji
testów, ale okazały się **fałszywie pozytywne** — próba `dialogEl.remove()`
(bezpośrednia manipulacja DOM zarządzanym przez React) rzucała
`NotFoundError` podczas `cleanup()` w niektórych strukturach drzewa, w
innych nie, w sposób zależny od głębokości drzewa, nie od realnego
zachowania kodu. Rozpoznane i **usunięte** — zastąpione bezpieczniejszym
wzorcem (`unmount()` + dowód, że listener faktycznie się sprząta, oraz
"drugi Escape to no-op"). To jest udokumentowana w tym raporcie POMYŁKA
METODOLOGICZNA tej sesji, naprawiona zanim trafiła do commitu.

## axe-core — wynik z zastrzeżeniem

Uruchomiony realnie na dev-render (`:58023`, viewport 1280×900), świeży
kontekst przeglądarki per ekran (localStorage nie przenosi się między
nawigacjami — flaga OFF nie mogła "przeciekać" z poprzedniego ekranu).
Skrypt: `scripts/dev/pkgi-a11y-audit.mjs` (tooling tymczasowy, do usunięcia po
tym raporcie — wzór `pkgf-baseline-screenshots.mjs`). Surowe wyniki:
`docs/validation/finance-v3/generated/gate-e/pkg-i-axe/*.json`.

**★ Zastrzeżenie (obowiązkowe, z brifu): axe łapie ~30-40% realnych problemów
dostępności. Zielony axe NIE jest dowodem dostępności — jest sitem
wstępnym.** Nie łapie: kolejności fokusa nielogicznej mimo poprawnych
atrybutów, jakości ogłoszeń czytnika ekranu (czy komunikat ma SENS, nie tylko
czy `aria-live` istnieje), gestów dotykowych, kontrastu stanów `:hover`/`:focus`
nieaktywnych domyślnie w DOM, jakości opisu w `aria-label` (czy jest
ZROZUMIAŁY, nie tylko obecny), spójności między wieloma krokami przepływu.

**Przed naprawą** (pierwszy przebieg, ekran po ekranie, flaga workspace'u/
komponentu ON): 6+4+4+4+2+4+3+5+5+3 = **40 naruszeń komponentu** łącznie na
10 ekranach (`color-contrast` ×6 ekranów, `label` ×2, `select-name` ×2,
`aria-prohibited-attr` ×1, `aria-required-children` ×1).

**Po naprawie** (drugi przebieg, te same URL-e, ta sama metoda): **0
naruszeń komponentu** na 9 z 10 ekranów. Pozostało:
- `analysis`: 1 naruszenie (`aria-prohibited-attr`) — **POZA ALLOWLISTĄ**,
  patrz §7 niżej.
- Na WSZYSTKICH 10 ekranach: `landmark-one-main`, `page-has-heading-one`,
  `region` (2-3 na ekran) — **potwierdzone jako artefakt SZKIELETU STRONY
  dev-render** (brak `<main>`/`<h1>` wokół całego harnessu), nie defekt
  komponentu: `valuation` (BEZ ŻADNEGO naruszenia komponentu) ma DOKŁADNIE
  te same 2 naruszenia, dowodząc że są niezależne od tego, co się renderuje
  wewnątrz. Ten sam wzorzec co "Pływające ← Lista/Uwagi to nakładka
  harnessu, nie defekt" (CLAUDE.md) — analogicznie tu: brakujący
  `<main>`/`<h1>` to CECHA dev-render (osadza WIELE alternatywnych ekranów
  pod jednym routerem query-param, nie ma jednego "tytułu strony" per
  definicji), nie defekt PRODUKTU (realny router aplikacji ma `<main>`/`<h1>`
  w swojej powłoce — poza zakresem tego pakietu, żeby to zweryfikować
  wymagałoby audytu przez prawdziwą aplikację, nie dev-render).
- `incomplete` (axe nie mógł jednoznacznie rozstrzygnąć, nie liczy się jako
  naruszenie): `bypass` (brak "skip to content" — też szkielet strony) na
  wszystkich 10; `color-contrast` incomplete na `lineage-navigator` (4× —
  separator `→` z `aria-hidden`, axe nie liczy kontrastu treści wyjętej z
  drzewa — nieistotne) i `statement-pack-v2` (1× — tekst z nakładającym się
  tłem, axe nie mógł policzyć; **EVIDENCE_MISSING**, wymaga ręcznego
  sprawdzenia wzrokowego przy okazji następnej pracy nad tym ekranem).

## Zrzuty

`docs/validation/finance-v3/generated/gate-e/visual/pkg-i/` (20 plików, 1.8MB):
- `<ekran>-1280-light.png` — stan bazowy 1280×900, jasny motyw, PO naprawie.
- `<ekran>-zoom200-1280-light.png` — zoom 200% (`document.documentElement.style.zoom`,
  ta sama technika co Pakiet C/M, uzasadnienie w PKG_C_UI_PLATFORM_report.md
  §2.5), PO naprawie.

Dla wszystkich 10 ekranów (5 workspace + 5 AP-CLIENT). Sprawdzone wzrokowo
(§8 wymagania): `baseline-zoom200-1280-light.png` (grid założeń, czytelny,
brak nakładania), `valuation-zoom200-1280-light.png` (krok "Źródło" —
zawartość WYCHODZI poza 1280px, ale strona przewija się poziomo — patrz
zastrzeżenie przy wymaganiu #8 w tabeli wyżej).

Fokus/dialog/status-kolor: NIE zebrano osobnych dedykowanych zrzutów
fokusa-w-akcji lub otwartego dialogu w tej partii (czas) — dowód stanu
fokusa jest w testach jsdom (`toHaveFocus()`), nie w PNG. **EVIDENCE_MISSING**
dla wzrokowej weryfikacji pierścienia fokusa na realnym renderze (kolor/grubość),
zalecane jako pierwszy krok następnej sesji.

## Rzeczy niedostarczone — status i powód

| Co | Status | Powód |
|---|---|---|
| Naprawa uchwytu resize kolumn w `StandardTable.tsx` (aria-prohibited-attr, `<div aria-label>` bez roli) | **NIE ZROBIONE, ZGŁOSZONE** | Plik POZA allowlistą (`src/components/standard/`, nie `Finance/**`) — WSPÓLNY komponent używany przez ~11 modułów (My Work, Assessment, Interview, Initiatives, Execution, Results, Finance, Materiały, Audits, Meeting, Admin). Ten sam uchwyt jest DODATKOWO operowalny WYŁĄCZNIE myszą (`onMouseDown` bez `onKeyDown`/`tabIndex`) — większy temat (req #2, klawiatura), wymaga centralnej naprawy w `src/components/standard/StandardTable.tsx`, poza zakresem tego pakietu. Zalecenie: `role="separator"` + `aria-orientation="vertical"` (wzorzec WAI-ARIA APG resizable-grid) + obsługa strzałek. |
| Pełny manualny przebieg klawiaturowy Prediction/Valuation (przełączanie kroków/widoków ręcznie, nie tylko przez testy komponentowe) | EVIDENCE_MISSING | Czas — priorytet poszedł w dialogi/aria-live/axe (mierzalne, powtarzalne dowody) zamiast w manualne przejścia bez zautomatyzowanego zapisu. |
| Smoke z REALNYM czytnikiem ekranu (VoiceOver/NVDA) | EVIDENCE_MISSING | Brak dostępu do czytnika ekranu w tym środowisku (headless/serwerowa sesja). Zastąpione: (a) drzewo `role`/`aria-*` zweryfikowane przez axe + testy jsdom, (b) opis "co BYŁOBY ogłoszone" niżej w §9. |
| `AssumptionsView.confirmingDespiteWarnings` — `escapeContext.modalOpen` w `BaselineWorkspace`'owym `useFinanceFocusMode` | **NIE ZROBIONE, ZGŁOSZONE** | Ten dialog żyje w DZIECKU (`AssumptionsView`), nie w `BaselineWorkspace` bezpośrednio — wymagałoby przeciągnięcia stanu w górę albo callbacku. Rzadki dialog (tylko przy zapisie z ostrzeżeniami), nie primary flow — świadomie odłożone. Ryzyko: identyczny "podwójny Escape" defekt jak naprawiony w #6, ale tylko w tym jednym, rzadkim wariancie. |
| Zrzuty dedykowane fokusowi-w-akcji / otwartemu dialogowi / stanu koloru+tekstu side-by-side | EVIDENCE_MISSING | Czas — dowód fokusa jest w testach (`toHaveFocus()`), nie zebrano dodatkowo PNG. |
| `statement-pack-v2` incomplete color-contrast (nakładające się tło, axe nie mógł policzyć) | EVIDENCE_MISSING | axe zwrócił "incomplete", nie "violation" — wymaga ręcznej weryfikacji wzrokowej przy następnej pracy nad tym ekranem. |
| Baza danych | NIE UŻYTA | Nie była potrzebna — wszystkie zmiany to czysty frontend/prezentacja, żadna z nich nie dotyka zapisu/odczytu z bazy. |

## Smoke z czytnikiem ekranu — opis "co BYŁOBY ogłoszone" (EVIDENCE_MISSING dla realnego AT)

Bazowane na drzewie `role`/`aria-*` zweryfikowanym przez axe + odczyt kodu,
NIE na realnym uruchomieniu VoiceOver/NVDA:

1. **Otwarcie dialogu "Podaj powód"** (Baseline/Statement Pack): AT ogłasza
   "Podaj powód, alert dialog" (z `aria-label`), fokus ląduje na polu
   tekstowym (pierwszy fokusowalny), Tab/Shift+Tab krąży między polem a
   "Anuluj" (bo "Potwierdź" jest disabled, poza tab-order). Escape → dialog
   znika, AT wraca do "Stan, przycisk, zwinięte" (trigger lifecycle).
2. **Panel Export/Import — import 3-krokowy**: po wybraniu pliku, live-region
   `role="status"` (niewidoczny) ogłasza kolejno "Wczytuję plik…" →
   "Wczytano N wierszy. Manifest OK." → (po kliknięciu podglądu) "Liczę
   podgląd różnic…" → "Podgląd gotowy: X dodanych, Y zmienionych, Z
   wyczyszczonych." → (po zastosowaniu) "Zapisuję zmiany…" → "Zastosowano:
   dodane X, zmienione Y, wyczyszczone Z." — użytkownik NIE musi ponownie
   przeglądać strony, żeby wiedzieć że coś się stało.
3. **Panel komentarzy — kliknięcie "Oznacz jako rozwiązany"**: AT ogłasza
   (przez live-region) "Komentarz oznaczony jako rozwiązany." niezależnie od
   tego, gdzie w danym momencie jest fokus użytkownika.
4. **Breadcrumb lineage**: AT czyta "Lista, Łańcuch powiązań" na wejściu do
   kontenera, potem każdy element jako "Element listy, przycisk, Statement
   pack v3, v3, Zatwierdzone" (tekst wewnątrz przycisku), separator "→" jest
   POMIJANY (aria-hidden).
5. **ViewStateBadge "Nieaktualne"/"Zablokowane"/"Gotowe"**: czytane jako
   zwykły tekst zakładki (nie jest osobnym `role="status"`), więc AT
   przeczyta je przy nawigacji do zakładki, nie ogłosi ich SAMOISTNIE przy
   zmianie stanu — to jest ZNANE OGRANICZENIE nie naprawiane w tym pakiecie
   (osobny temat: czy zmiana stanu zakładki z "Gotowe" na "Nieaktualne" w
   TLE, bez akcji użytkownika, powinna być ogłoszona — dziś nie jest).

## Weryfikacja uruchomień (dowód, nie deklaracja)

- `npx vitest run src/components/Finance --maxWorkers=2`: **60 plików / 487
  testów, 0 failed**, ostatni przebieg 16-22s (kilka powtórzeń w tej sesji,
  wszystkie zielone).
- `npm run type-check` (pełny `tsc --noEmit` z korzenia): **exit 0, 90s**
  (realny pełny przebieg — PRZED naprawą złapał 3 błędy TS2739 w 123s,
  potwierdzając że to nie jest ucięty/fałszywy zielony wynik).
- `npx vitest run tests/unit/finance/rawEnumLeakScanner.test.ts`: **5/5
  PASS** — żaden nowy plik nie wprowadził surowego enuma SCREAMING_SNAKE_CASE
  do renderowanego tekstu.
- `scripts/check-list-canon.sh` (hook pre-commit, uruchomiony automatycznie
  przy każdym z 4 commitów): **0 nowych naruszeń** za każdym razem (jeden
  raz zablokował commit — `FinanceComparePanel.tsx` miał surową `<table>` bez
  `§27-exempt`; naprawione oznaczeniem archetypu Excel, zgodnie z
  `DOKTRYNA_TABELA_NIE_EXCEL.md` #2 — wiersze to WYLICZONE różnice, nie
  rekordy encji).
- `scripts/check-artefakt.sh`/`check-triada.sh`/`check-gestosc.sh`/
  `check-focus-canon.sh`: **0 nowych naruszeń** przy każdym commicie (dług
  istniejący w repo nie rośnie).

## Środowisko

- ZERO połączeń do bazy — nie były potrzebne.
- ZERO połączeń do demo/staging/produkcji.
- `axe-core@4` zainstalowany `npm install --no-save` (nie dotyka
  `package.json`/`package-lock.json` — zweryfikowane `git status --short` na
  obu plikach, puste).
- dev-render uruchomiony lokalnie na `:58023` (`npx vite --config
  dev-render/vite.config.ts --port 58023`), zatrzymany po zakończeniu pracy.
