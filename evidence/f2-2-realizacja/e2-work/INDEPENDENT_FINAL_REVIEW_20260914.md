# F2-2 Realizacja E2 Praca — finalny niezależny odbiór exact SHA 2026-09-14

**Werdykt: HOLD — cztery wcześniejsze blokery techniczne zostały zamknięte, lecz pełny ExecutionHub nadal narusza obowiązujący od Wpisu 35 kanon UI: delta dodaje pięć natywnych dropdownów z surowymi kodami/identyfikatorami, a nowy kebab rekordu uwagi nie deklaruje wymaganych możliwości uniwersalnych i strefy destrukcyjnej.**

## Tożsamość

- exact freeze: `f1e551cd0e69e0455c824b6a5e753529a42f067e`
- exact content: `625308405c53b6fe6d38f47ba620034faf9bd5ca`
- base i merge-base: `94754c3b4d9ebb25e8b5197a0aaff2b2dc3adbd2`
- backup autora: `backup/codex/realizacja-cztery-przyciski-20260913-e2-line94754-ui-canon-20260914` = exact freeze
- migracje: brak; lokalna baza `cx-s4-e2-pg`, PostgreSQL 18, port 5290

## Cztery wcześniejsze blokery — zamknięte

1. Pełna delta Wpisu 30: wszystkie **13/13 plików testowych i 96/96 testów PASS**, `--retry=0`; `f2-2-entry-contract.red.test.ts` nie czyta już usuniętego `coverage-29-initial.json`.
2. Współbieżny konflikt `ON CONFLICT DO NOTHING`: usługa sprawdza `insert.changes`; przegrany odczytuje utrwalony rekord i zwraca `created:false`. Realny równoległy test Gateway/JWT/PostgreSQL potwierdził statusy 201+200, dokładnie jeden `created:true`, jeden wiersz oraz identyczne `id`, `asOf` i payload.
3. Martwe tokeny `bg-c-surface-muted` i `text-c-text-primary` usunięte; ekran używa istniejących tokenów `c.*`.
4. Manifest jest aktualny: base/content zgodne, 57/57 ścieżek, brak brakujących/nadmiarowych pozycji, wszystkie rozmiary i SHA-256 zgodne z blobami exact content. Cztery historyczne artefakty E0-E1 są `skip-worktree` przez sparse checkout, ale istnieją i zgadzają się w drzewie git. Evidence exact tree: 16 plików / 1 335 083 B, poniżej 2 MiB.

## Blokery końcowego kanonu UI

### P1 — pięć natywnych dropdownów i surowe wartości w pełnym ExecutionHub

`src/components/Execution/ExecutionHub.tsx` dodaje w `executionBankFilterControls` pięć natywnych `<select>`: project, status, owner, priority i time. Wpis 35 wymaga standardowych dropdownów dla każdego ekranu. Opcje statusu i priorytetu renderują bezpośrednio `{status}` i `{priority}`, a projekt/właściciel pokazują techniczne identyfikatory. To omija i18n/SSOT etykiet oraz ujawnia raw codes/IDs. Deklaracja autora „introduces no native `<select>`” jest prawdziwa tylko dla `WorkIntelligenceReport.tsx`, nie dla pełnej delty `ExecutionHub`, którą nakazał odebrać CTO.

Warunek zdjęcia: zastąpić wszystkie pięć kontrolek standardowym dropdownem używanym przez TRIADĘ i wyświetlać przyjazne, przetłumaczone etykiety; status przez `initiativeStatusLabels.ts`, priorytet przez EN+PL, projekty i właściciele przez nazwy z kanonicznych danych. Dodać zachowaniowy test pełnego ExecutionHub, który nie opiera się na wyszukiwaniu tekstu źródłowego.

### P1 — kebab rekordu uwagi jest niepełny

Nowy `StandardTable.rowMenu` deklaruje akcje managerskie jako `primary` oraz wyłącznie `universalHandlers.preview`. Nie deklaruje `edit`/`archive` nawet jako disabled z rzeczywistą notą i nie deklaruje strefy `destructive`. `StandardTable.rowMenuToSections` nie dodaje tych pozycji automatycznie; przez to menu ma tylko context/manage, bez pełnego kontraktu A6. Test `WorkIntelligenceReport.test.tsx` mockuje `StandardTable` i całkowicie odrzuca `rowMenu`, więc 96/96 nie dowodzi zawartości kebaba.

Warunek zdjęcia: zadeklarować właściwe pięć bloków/strefy dla tej encji albo jawnie udokumentować w kanonie capability N/D zaakceptowane przez CTO; dodać test montujący realny `StandardTable`, otwierający kebab i sprawdzający kolejność, disabled-notes oraz destrukcyjną końcówkę.

### P2 — nagłówkowe Open jest wyłączone mimo osiągalnego źródła

Dla TASK/DECISION kod oblicza `canOpen=true` i przekazuje działający handler do `whatsNext`, ale `StandardPreview` nie dostaje `onOpen`; dostaje zawsze `openDisabledReason`. Zrzut potwierdza nieaktywny nagłówkowy Open przy aktywnym „Open source record”. Kanon A7 przewiduje Open w nagłówku jako jedyne nagłówkowe wejście do pełnego widoku.

Warunek zdjęcia: gdy `canOpen`, podać ten sam realny handler jako `onOpen`; powód blokady pozostawić tylko dla rekordów bez osiągalnej trasy. Pokryć testem zachowania.

## Potwierdzone bramki dodatnie

- RealPG + ApiGateway + JWT: **5/5 PASS**, w tym project title, scheduler/on-demand, sekwencyjna i równoległa idempotencja, backend OFF=404, tenant sentinel, manager mutation/audit, USER=403 i sąsiednia trasa 409.
- Istniejący `managerActionExecutionService`: **12/12 PASS**.
- Serwer `tsc --noEmit`: PASS; trzy bundle esbuild: PASS; focused production Vite build: PASS; `git diff --check`: PASS.
- Duplicate detector: EN 0, PL 0. `execution.workAnalysis`: 52/52 klucze po obu stronach; status i priority w raporcie mają etykiety, a ekran nie dodaje crimson/`primary-*`.
- Flagi `VITE_EXECUTION_WORK_ANALYSIS` i `ENABLE_EXECUTION_WORK_ANALYSIS` są default OFF i wymagają jawnego opt-in.
- Light/dark 2880×2400 obejrzane w pełnej powłoce ExecutionHub: `StandardModuleBar`, tabela, wybrany wiersz i otwarty preview są czytelne; nie ma odziedziczonych filtrów Menu 3 na otwartym dokumencie. Hashe: light `3517695d...`, dark `b3f992025...`.
- Preview pokazuje sześć wymaganych części z Wpisu 35: nagłówek, meta, DETAILS z kebabem, relacje, akcje-pill i What's next; tabela ma widoczny kebab w każdym wierszu. Powyższe blokery dotyczą zawartości/osiągalności, nie samej obecności komponentów.

## Warunek ACCEPT

Naprawić trzy naruszenia UI bez rozszerzania domeny i bez migracji, powtórzyć pełną deltę 13 plików, realny test kebaba/Open na niezamockowanym `StandardTable`, duplicate detector, tsc/esbuild/build oraz light/dark w pełnym ExecutionHub. Przy kolejnym freeze manifest musi wskazywać nowy exact content SHA.
