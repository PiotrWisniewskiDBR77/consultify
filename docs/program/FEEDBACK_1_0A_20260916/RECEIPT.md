# FEEDBACK-1 / pozycja 0a — receipt

Werdykt kodu: **ACCEPT po niezależnym review**. Completed insight otwierany w Preview pokazuje obie akcje Fill jako widoczne, lecz nieaktywne, z jednoznacznym następnym krokiem. Published insight pozostaje nieedytowalny i nie pokazuje akcji Fill.

## Tożsamość

- baza linii: `d9cc9aef2c7a7e06a5cdf3972de3a8940e3a4494`
- branch: `codex/feedback-1-0a-preview-edit-20260916`
- worktree: `/Users/piotrwisniewski/Developer/codex-wt/a-feedback-1-0a-20260916`
- instalacja: linia i kandydat używają tego samego lokalnego drzewa `node_modules`; baseline ma symlink do instalacji kandydata

## Zachowanie

- `completed` w Preview: `Analyze`, `Fill in this section`, `Fill in the whole document` są widoczne;
- oba Fill są natywnie `disabled`, mają podpowiedź `Switch to Edit to fill` i nie mają handlera generowania ani zapisu;
- po przejściu użytkownika istniejącym przełącznikiem do Edit obowiązuje dotychczasowy aktywny przepływ Fill;
- `published`: brak przełącznika Edit i brak obu Fill; `Analyze` pozostaje dostępne;
- domyślny kontrakt DEC-407 dla wszystkich pozostałych kart nie zmienia się; wyjątek jest opt-in tylko dla Insight Preview;
- komunikaty są w i18n EN+PL, bez nowych polskich literałów produkcyjnych.

## Dowody

- istotna rodzina linia → kandydat: **24/24 → 27/27 PASS**;
- niezależny review: **ACCEPT**, brak P0/P1;
- test komponentu dowodzi rozróżnienia `completed` i `published` na rzeczywistym `InsightViewer`;
- test współdzielonego `PracujZAI` dowodzi jednocześnie opt-in Preview i niezmienionego default-hide DEC-407;
- locale EN/PL parsują się poprawnie;
- `git diff --check`: PASS.

## TypeScript

- pełny frontend bez limitu, ta sama instalacja: linia **152**, kandydat **152**, delta **0**;
- server: linia **0**, kandydat **0**.

## Granice

- zero zapisu na stagingu, deployu, Railway, migracji i chronionych refów;
- zgodnie z nagłówkiem kanału CTO nie tworzono zrzutów ekranu; stan menu jest dowiedziony behawioralnym testem DOM pełnego `InsightViewer`;
- przed freeze obowiązuje bramka zamrożenia i jej wymagane markery dla dotkniętych modułów.
