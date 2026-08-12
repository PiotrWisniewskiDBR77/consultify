# Pakiet I — Dostępność (a11y) — NIEZALEŻNA WERYFIKACJA

**Weryfikator:** sesja niezależna od autora (nie autor pakietu).
**Worktree:** `/Users/piotrwisniewski/consultify-wt/fv3p-f-baseline`
**Gałąź weryfikowana:** `codex/fv3p-i-a11y` @ `65ba66f802`
**Baza pakietu:** `2f3685ac3e`
**Data:** 2026-08-12

★ Uwaga o bazie: kandydat przesunął się od bazy tego pakietu do `706312fa06`
(merge `codex/fv3p-id-bridge`). Ocena ryzyka kolizji — patrz §12.

Metoda: dla każdego twierdzenia wykonano NIEZALEŻNY pomiar (własny skrypt
Playwright/axe przeciw świeżo uruchomionemu dev-render na innym porcie
`:58099`, własne przeliczenie kontrastu na skomponowanym tle, własne
negatywne kontrole z cofnięciem `git show <base>:<plik> > <plik>` →
pomiar → `git checkout -- <plik>` → potwierdzenie pustego diffu). Autor nie
widział tego raportu ani odwrotnie.

## Tabela wyników

| # | Twierdzenie | Mój niezależny pomiar | Werdykt |
|---|---|---|---|
| 1 | Dialogi mają realne zachowanie (pułapka Tab, Escape, powrót fokusa), w tym luka „ten sam commit" | Real Chromium (nie jsdom): Baseline „Podaj powód" — pułapka Tab 15×, Shift+Tab 15×, Escape zamyka, **fokus wraca na `finance-workspace-bar-lifecycle-trigger`** mimo że trigger jest w menu, które zamyka się w tym samym cyklu co otwarcie dialogu (dokładnie luka opisana w brief). `AnalysisCreatorWizard` — dialog otwiera się, fokus ląduje w środku, pułapka Tab trzyma 20×, Escape zamyka. Wszystko potwierdzone w prawdziwej przeglądarce, nie tylko w testach jsdom. | **POTWIERDZONE** |
| 2 | Podwójny Escape — defekt realny, naprawa działa | Cofnąłem `escapeContext.modalOpen` w `AnalysisWorkspace.tsx` (edit + test), test `AnalysisWorkspace.focusMode.test.tsx` poszedł na czerwono z realnym `AssertionError` (drugi asercja `toBe(true)` dostała `false`) — **defekt jest realny**. Przywróciłem, `git diff` puste. Naprawę potwierdziłem DODATKOWO w prawdziwej przeglądarce, w kolejności faktycznie OSIĄGALNEJ przez użytkownika (autor testował kolejność „otwórz kreator → wejdź w focus mode" — ta kolejność jest w RZECZYWISTOŚCI NIEOSIĄGALNA myszą, bo overlay kreatora `z-overlay`/`bg-black/60` blokuje kliknięcie przycisku fullscreen pod spodem, mój Playwright-test to potwierdził timeoutem `intercepts pointer events`). Sprawdziłem odwrotną, faktycznie osiągalną kolejność („wejdź w focus mode → otwórz kreator z jego wnętrza") — **też działa poprawnie**: 1. Escape zamyka TYLKO kreator (focus mode zostaje aktywny), 2. Escape wychodzi z focus mode. | **POTWIERDZONE** (naprawa działa; dodatkowa uwaga: własny test autora ćwiczy kolejność nieosiągalną myszą w realnej przeglądarce — patrz §11) |
| 3a/b | `--c-focus` = `rgba(37,99,235,0.4)`, kontrast tekstu na SKOMPONOWANYM tle = 1,8:1; `text-c-focus-solid` daje ≥4,5:1 | Potwierdzone w `src/index.css:70-73` (`--c-focus: rgba(37, 99, 235, 0.4)`, `--c-focus-solid: #2563eb`). Własne przeliczenie WCAG na composited RGB nad `--c-surface:#ffffff`: composited = `rgb(168,193,247)`, kontrast do białego = **1,80:1** (dokładnie zgodne z twierdzeniem). Naiwne przeliczenie z pominięciem alfa dałoby fałszywe 5,17:1 — dokładnie pułapka opisana w brief. `text-c-focus-solid` (#2563eb pełne krycie) = **5,17:1** ≥4,5:1. | **POTWIERDZONE** (liczbowo dokładnie, do 2 miejsc po przecinku) |
| 3c | `--c-focus` jako kolor tekstu GDZIEKOLWIEK INDZIEJ w repo | `grep -rn "text-c-focus\b"` (bez `-solid`) w całym `src/`: **9 dodatkowych wystąpień** poza tym pakietem, w tym co najmniej jedno z DOKŁADNIE tym samym wzorcem naruszenia (link tekstowy `text-c-focus hover:underline`, bez `-solid`) w `src/components/Results/PostInvestmentReviewPanel.tsx:104` — kompletnie inny moduł, poza zakresem tego pakietu. Dwa dalsze w `MyWork/TaskDetailView.tsx` (`hover:text-c-focus`, stan hover). Reszta to ikony/checkboxy (`text-c-focus` jako fill/accent, nie prozaiczny tekst — WCAG 1.4.11 nie 1.4.3, próg 3:1, też by nie przeszły przy 1,8:1, ale to inny wymóg). Dodatkowo: sam pakiet ZOSTAWIA `text-c-focus` (nie `-solid`) na checkboxach w `FinanceCommentsPanel.tsx` (×2) i `FinanceComparePanel.tsx` (×1) — świadomie nienaprawione (checkbox accent, nie tekst), ale też &lt;3:1. | **CZĘŚCIOWO** — autor naprawił 2 wystąpienia (link-tekst), wzorzec occuruje SZERZEJ w repo, zgodnie z własną przewidywaną hipotezą briefu |
| 4 | Kontrast odznak statusu (3,9–4,3:1) na skomponowanym tle | Własne przeliczenie: `--c-warning:#ae6429` (surowy, przed naprawą) na `bg-c-warning/10` skomponowanym nad białym = tło `rgb(247,240,234)`, kontrast tekstu = **3,98:1** (moje niezależne wyliczenie tej samej pary daje wynik w tym samym rzędzie wielkości co zgłoszone 3,91–3,92:1 — różnica ~0,1 tłumaczy się dokładną powierzchnią tła, którą axe zmierzył piksel-po-pikselu, ja analitycznie). Po naprawie `amber-900` na tym samym tle = **8,01:1** — komfortowo ≥4,5:1. Kierunek i rząd wielkości defektu oraz naprawy PASS. | **POTWIERDZONE** (rząd wielkości, nie identyczna liczba co axe — oczekiwane) |
| 5 | 30+ pól bez nazw w gridzie Baseline naprawionych | `AssumptionsView.tsx` diff: `aria-label` dodany do 2 selectów/wiersz („Reguła kalibracji", „Jakość") + 2 inputów/wiersz (zakres dolny/górny) = 4 pola/wiersz. Mój niezależny axe na `baseline` (`view=assumptions`) screen: **ZERO** naruszeń `label`/`select-name` (przed naprawą byłyby to naruszenia critical) — potwierdza brak pozostałych nienazwanych pól w tym widoku. | **POTWIERDZONE** |
| 6 | Ogłaszanie stanów dynamicznych (`FinanceStatusAnnouncer`) — ZACHOWANIE, nie JSX | Zbadałem drzewo DOM w realnej przeglądarce z `MutationObserver` + znacznikiem tożsamości węzła. Wynik NIEJEDNOLITY: **panele bez refetch po akcji** (np. „Kopiuj link" w `FinanceSavedViewsPanel`) — TEN SAM węzeł DOM, realna mutacja `characterData` zaobserwowana → prawdziwe ogłoszenie AT jest wiarygodne. **Panele z refetch po akcji** (np. „Oznacz jako rozwiązany" w `FinanceCommentsPanel`, „Zapisz"/„Usuń" w `FinanceSavedViewsPanel` — wszystkie wołające `load()` po akcji) — `load()` ustawia `state.kind='loading'` PRZED `'loaded'`, co przełącza komponent między RÓŻNYMI gałęziami `return` (różne poddrzewa JSX z osobnymi instancjami `FinanceStatusAnnouncer`) → węzeł DOM zostaje ODMONTOWANY i ZAMONTOWANY NA NOWO (nie ta sama instancja, `MutationObserver` **zero** zarejestrowanych mutacji). Tekst końcowy jest wizualnie/tekstowo poprawny (dlatego testy RTL, które nie sprawdzają tożsamości węzła, przechodzą), ale świeżo wstawiony węzeł z GOTOWYM tekstem jest DOKŁADNIE tym wzorcem z brief: „obszar aria-live obecny w DOM, ale [tu: efektywnie] nigdy nie aktualizowany" — bo AT nie widzi MUTACJI, widzi nowy węzeł ze statycznym tekstem, co wiele czytników (zwł. NVDA/JAWS przy pewnych ustawieniach) nie ogłasza. | **CZĘŚCIOWO** — mechanizm działa poprawnie tam, gdzie nie ma refetch; jest realnie osłabiony (prawdopodobnie niesłyszalny dla AT) dla WIĘKSZOŚCI akcji w `FinanceCommentsPanel` i części akcji `FinanceSavedViewsPanel`, bo `load()` bounce'uje przez `'loading'` i tworzy nowy węzeł zamiast mutować istniejący |
| 7 | `role="list"` z `<button>` jako dzieckiem naprawione, brak innych naruszeń tego typu | `FinanceLineageNavigator.tsx`: `<button>` owinięty w `<span role="listitem">`, separator `aria-hidden`. Mój niezależny axe: **ZERO** `aria-required-children` na `lineage-navigator`. `grep -rn 'role="list"' src/components/Finance` poza testami: tylko 2 pliki (`FinanceLineageNavigator.tsx` naprawiony, `StatementValidationBadges.tsx` — PRZEDISTNIEJĄCY, już poprawny wzorzec `role="listitem"` na `<span>`, nie dotknięty tym pakietem, nie ma defektu). | **POTWIERDZONE** |
| 8 | axe: 40 naruszeń → 0 (z zastrzeżeniem sita wstępnego) | Uruchomiłem SAM `axe-core@4` (już zainstalowany w `node_modules`) przeciw ŚWIEŻO odpalonemu dev-render (`:58099`, inny port niż autor) na wszystkich 10 ekranach. Wynik: **0 naruszeń komponentu na 9/10 ekranów**; `analysis` ma dokładnie **1 typ naruszenia** (`aria-prohibited-attr`, `serious`, 10 węzłów — spójne z 10 kolumnami tabeli, zgłoszone przez autora jako poza allowlistą, `StandardTable.tsx` resize handle). Na wszystkich 10: `landmark-one-main`/`page-has-heading-one`/`region` — potwierdzam, że `valuation` (0 innych naruszeń) ma DOKŁADNIE te same — artefakt szkieletu dev-render, nie defekt komponentu, zgodnie z twierdzeniem autora. `statement-pack-v2` incomplete `color-contrast` (1×) i `lineage-navigator` incomplete `color-contrast` (4×) — dokładnie zgodne z opisem autora. | **POTWIERDZONE** (niezależny przebieg reprodukuje wyniki autora niemal 1:1) |
| 9 | Zoom 200% @1280px — treść osiągalna, pasek ma własny scroll | Własny pomiar (inny port, świeży kontekst): `baseline`/`valuation`/`statement-pack-v2` przy `document.documentElement.style.zoom='2'` → `scrollWidth: 2560, clientWidth: 1280` na wszystkich trzech — DOKŁADNIE te same liczby co w raporcie autora. Strona przewija się poziomo (WCAG 1.4.10 wyjątek dla treści 2D — tabele finansowe), nie jest to idealne UX, ale treść jest osiągalna. | **POTWIERDZONE** |
| 10a | 487/487 testów Finance, ~17-22s | `npx vitest run src/components/Finance --maxWorkers=2`: **60 plików / 487 testów, 0 failed**, 16,13s (pierwszy przebieg), 22,51s (przebieg końcowy po wszystkich moich mutacjach/przywróceniach — dowód, że worktree jest czysty). | **POTWIERDZONE** |
| 10b | `npm run type-check` 0 błędów, ~90s, realny pomiar (nie PIPESTATUS) | Uruchomiłem `npm run type-check > plik 2>&1; echo $? > plik.exit` (wzorzec z brief, nie potok z `tail`). Wynik: **exit 0, 93,6s realnego czasu** (`/usr/bin/time -p`). | **POTWIERDZONE** |
| 10c | tsc złapał realną regresję TS2739, esbuild nie | Odtworzyłem STAN PRZED naprawą (`git show f1437371fb:<3 pliki> > <3 pliki>`), uruchomiłem `npm run type-check`: **exit 2, dokładnie 3 błędy TS2739** w dokładnie tych samych 3 lokalizacjach (`AnalysisWorkspace.tsx:160`, `BaselineWorkspace.tsx:164`, `StatementPackWorkspaceV2.tsx:429`) zgłoszonych przez autora. Przywrócone przez `git checkout --`, `git diff` puste. Ta kontrola ścieżki jest realna, nie zadeklarowana. | **POTWIERDZONE** (dosłowna reprodukcja) |
| 11 | Kontrole negatywne (min. 4, inne mutacje niż autora) | Wykonałem 4 własne, WSZYSTKIE cofnięte `git checkout --`/`git show <base>:` przed zakończeniem: (1) usunięcie `htmlFor` z etykiety pliku importu w `FinanceExportImportPanel.tsx` → `getByLabelText` RED. (2) Reprodukcja regresji TS2739 (patrz 10c) → tsc RED. (3) Usunięcie `escapeContext.modalOpen` w `AnalysisWorkspace.tsx` → test podwójnego Escape RED (patrz #2). (4) Usunięcie tekstu etykiety w `ViewStateBadge` (`FinanceWorkspaceBar.tsx`, zostawiając sam kolor) → `FinanceWorkspaceBar.contrast.a11y.test.tsx` **4/4 testy RED** (status-nigdy-tylko-kolorem). Po każdej: `git diff --quiet` puste, finalny pełny przebieg testów Finance nadal 487/487. | **POTWIERDZONE** (4/4 mutacje zaczerwieniły odpowiedni test) |
| 12 | Allowlista — `FinanceHub.tsx`/warstwa danych NIE dotknięte | `git diff --stat 2f3685ac3e..65ba66f802 \| grep -E "FinanceHub\|financeV2\.(api\|types)"` → **pusto**. Potwierdzone. | **POTWIERDZONE** |
| 13 | Status nigdy tylko kolorem | `ViewStateBadge` niesie `state.label.pl` (tekst) obok klasy koloru (kontrola negatywna #11.4 to potwierdza wprost — usunięcie tekstu psuje 4 testy). `StatusChip`/`FinanceCommentsPanel` „Blokujący" — tekst + kolor. Zgodne z kanonem. | **POTWIERDZONE** |

## §11 uzupełnienie — dlaczego kolejność testu autora dla twierdzenia #2 jest myląca

Test `AnalysisWorkspace.focusMode.test.tsx` (autora) używa `fireEvent.click`
na przycisku fullscreen PODCZAS gdy kreator jest już otwarty. W jsdom to
działa, bo jsdom nie sprawdza, czy element jest wizualnie zasłonięty. W
realnej przeglądarce (mój Playwright-test) ta sama sekwencja **rzuca
timeout** — `<div role="dialog"... class="fixed inset-0 z-overlay ... bg-
black/60 backdrop-blur-sm">` fizycznie zasłania przycisk fullscreen, więc
użytkownik NIE MOŻE w rzeczywistości wejść w focus mode, gdy kreator jest
już otwarty. To nie unieważnia naprawy — sprawdziłem RZECZYWIŚCIE osiągalną
kolejność (focus mode → otwórz kreator z jego wnętrza) i naprawa DZIAŁA tam
też — ale wskazuje na niedoskonałość samego testu jednostkowego jako
dowodu: dowodzi poprawnego zachowania `escapeContext`, ale w scenariuszu,
który sam w sobie jest nieosiągalny myszą. Nie blokuje PASS (kod jest
poprawny niezależnie od kolejności), ale warto to poprawić w następnej
sesji (test powinien ćwiczyć osiągalną kolejność).

## §6 uzupełnienie — defekt `FinanceStatusAnnouncer` + `load()`

To jest najważniejsze ODKRYCIE tej weryfikacji, nieobecne w raporcie
autora. Mechanizm:

1. `FinanceCommentsPanel`/`FinanceSavedViewsPanel` (i prawdopodobnie
   `FinanceComparePanel`/`FinanceLineageNavigator` — nie zweryfikowane
   bezpośrednio, ten sam wzorzec architektury `state.kind` z trzema
   warunkowymi `return`) renderują `<FinanceStatusAnnouncer>` OSOBNO w
   KAŻDEJ gałęzi (`loading`/`error`/`loaded`) — zgodnie z własną instrukcją
   w nagłówku komponentu („renderuj jako element-sibling przy KAŻDYM
   warunkowym return").
2. Akcje typu „Oznacz jako rozwiązany"/„Zapisz widok"/„Usuń widok" WOŁAJĄ
   `load()` NATYCHMIAST po `setActionMessage(...)`. `load()` ustawia
   `state.kind='loading'` PRZED przejściem do `'loaded'`.
3. To oznacza, że React WYCHODZI z gałęzi `'loaded'`, WCHODZI do gałęzi
   `'loading'` (nowa instancja `FinanceStatusAnnouncer`), po czym WRACA do
   `'loaded'` (JESZCZE JEDNA nowa instancja) — węzeł DOM z ostatecznym
   tekstem NIGDY nie jest tym samym węzłem, który AT mogłoby mieć już
   zarejestrowany jako `aria-live`.
4. Zweryfikowane empirycznie: `MutationObserver` dołączony do węzła PRZED
   akcją zarejestrował **zero mutacji** przy „Oznacz jako rozwiązany" (choć
   widoczny/tekstowy wynik jest poprawny — stąd testy RTL PRZECHODZĄ, mimo
   że mechanizm jest wadliwy) i **jedną realną mutację `characterData`** przy
   „Kopiuj link" (który NIE woła `load()`).

Praktyczna konsekwencja: wymaganie #7 jest zrealizowane POPRAWNIE dla akcji
bez odświeżenia danych, ale prawdopodobnie NIE DZIAŁA (nie zostanie
ogłoszone przez realny czytnik ekranu) dla większości akcji w
`FinanceCommentsPanel` (dodaj/rozwiąż/otwórz ponownie/checklist) i część akcji
`FinanceSavedViewsPanel` (zapisz/usuń) — dokładnie ten wzorzec pozornej
naprawy, przed którym ostrzegał brief. Naprawa: albo NIE wołać `load()` po
akcji z osobnym `setState` dla listy (zamiast pełnego przejścia przez
`'loading'`), albo trzymać JEDEN trwały węzeł `FinanceStatusAnnouncer` POZA
warunkowym blokiem `return` (np. na poziomie komponentu-rodzica, zamontowany
zawsze, niezależnie od `state.kind`).

## §12 — Ryzyko kolizji przy scaleniu z kandydatem (`706312fa06`, most identyfikatorów)

`git show --stat 706312fa06` (merge `codex/fv3p-id-bridge`) dotyka: `src/
components/Economics/FinanceHub.tsx`, `Finance/Prediction/
PredictionWorkspace.tsx`, `Finance/Valuation/ValuationWorkspace.tsx` +
`Valuation/steps/*.tsx` (4 pliki), `Finance/baseline/
useBaselineAssumptionsEditor.ts`, `useBaselineOutputs.ts`, nowe `Finance/
shared/FinanceLegacyBridgeGate.tsx`/`useFinanceLegacyBridge.ts`,
`services/api/financeV2.api.ts`/`financeV2.types.ts`.

Porównanie plik-po-pliku z diffem Pakietu I: **ZERO wspólnych plików**.
Pakiet I dotyka `AnalysisCreatorWizard.tsx`, `AnalysisWorkspace.tsx`,
`BaselineWorkspace.tsx`, `AssumptionsView.tsx`, `FinanceCommentsPanel.tsx`,
`FinanceComparePanel.tsx`, `FinanceExportImportPanel.tsx`,
`FinanceLineageNavigator.tsx`, `FinanceSavedViewsPanel.tsx`,
`FinanceStatusAnnouncer.tsx` (nowy), `FinanceWorkspaceBar.tsx`,
`CanonicalStatementTableV2.tsx`, `StatementPackWorkspaceV2.tsx` — żaden z
tych plików nie występuje w diffie id-bridge.

**Ryzyko kolizji tekstowej przy merge: NISKIE** (brak nakładających się
plików → brak konfliktów `git merge` na poziomie linii). Jedyne ryzyko
funkcjonalne, nie tekstowe: `BaselineWorkspace.tsx` (dotknięty Pakietem I)
KONSUMUJE `useBaselineAssumptionsEditor`/`useBaselineOutputs` (dotknięte
id-bridge) — zmiany Pakietu I w `BaselineWorkspace.tsx` są jednak czysto
addytywne w warstwie a11y (`useDialogA11y`, `escapeContext`, fokus) i NIE
dotykają logiki konsumpcji tych hooków, więc ryzyko integracyjne oceniam
jako niskie, ale niezweryfikowane bezpośrednio (wymaga realnego merge +
przebiegu testów `BaselineWorkspace.a11y.test.tsx` na scalonej gałęzi, co
jest poza zakresem tej weryfikacji punktowej).

## Środowisko weryfikacji

- Vitest `src/components/Finance` z korzenia repo, `--maxWorkers=2`, 3
  pełne przebiegi (przed mutacjami / między mutacjami / po wszystkich
  przywróceniach) — zawsze 487/487.
- Dev-render własny (`:58099`, inny port niż autor, żeby uniknąć
  współdzielenia stanu) — zamknięty po zakończeniu pracy.
- Playwright + `axe-core@4` (już obecny w `node_modules`, nie instalowany
  ponownie).
- ZERO połączeń do bazy/demo/staging/produkcji.
- Wszystkie skrypty tymczasowe (`scripts/dev/verify_*_ivan.mjs` i wynikowy
  JSON) USUNIĘTE po zakończeniu — nie zostały w repo.
- Kontrole negatywne WYŁĄCZNIE `git show <base>:<plik> > <plik>` +
  `git checkout -- <plik>` lub ręczny `Edit`/`git checkout --` — nigdy
  `git stash`/`reset --hard`/`clean`. `git status --short` czysty po
  każdej.

## Werdykt końcowy

**PASS z zastrzeżeniami (PARTIAL na 2 z 13 twierdzeń).**

Pakiet I jest solidną, uczciwie udokumentowaną pracą — wszystkie mierzalne
liczby (contrast, axe, zoom, tsc, testy) reprodukują się niezależnie z
dużą dokładnością, obie kluczowe kontrole zachowania (pułapka fokusa
dialogów w realnej przeglądarce, podwójny Escape) są PRAWDZIWE, nie
pozorowane, negatywne kontrole autora I moje własne (4 dodatkowe, innym
zestawem mutacji) konsekwentnie czerwienią właściwe testy. Allowlista
dotrzymana, ryzyko kolizji z przesuniętym kandydatem NISKIE (zero
nakładających się plików).

Jedyna materialna luka wykryta w tej weryfikacji, NIEOBECNA w raporcie
autora: **`FinanceStatusAnnouncer` faktycznie nie mutuje istniejącego węzła
DOM dla akcji, które wołają `load()`** (większość akcji w
`FinanceCommentsPanel`, część w `FinanceSavedViewsPanel`) — tekst jest
poprawny wizualnie i w DOM, ale mechanizm live-region jest architektonicznie
osłabiony w sposób, którego żaden test jsdom/RTL w tym pakiecie by nie
wykrył (bo żaden nie sprawdza tożsamości węzła ani realnej mutacji, tylko
finalny tekst). Zalecenie: naprawić w najbliższej kolejnej sesji nad tym
obszarem (nie blokuje demo za flagą OFF, ale podważa część twierdzenia o
wymaganiu #7 dla screen-reader-użytkowników).
