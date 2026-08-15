# Consultify — wykonawczy rejestr dokończenia modułów

Data: 2026-08-15  
Authority product SHA: `1fa57d4247790f36ceb683534f4c2d97302b2c20`
Authority acceptance SHA: `118e678d6`
Cleanup/report baseline SHA: `8210bc170`
Status: `EXECUTION_REGISTRY / NOT_RELEASE_READY`

## Rozszerzenie siedmiopunktowego planu sprzątania

Pierwotne punkty 1–7 pozostają obowiązujące. Po nich wykonywane są trzy
dodatkowe etapy, które zamieniają inwentaryzację w jednoznaczny plan domknięcia
produktu.

### 8. Rejestr braków do finalnego wdrożenia

Każdy moduł otrzymuje jeden kanoniczny rekord obejmujący cały łańcuch
`SSOT -> route -> UI -> API -> service -> schema -> data -> tests -> demo`.
Rekord nie może opierać się na opinii. Każde twierdzenie wskazuje plik, endpoint,
tabelę, flagę albo wynik wykonanej bramki. Brak dowodu ma literalny status
`EVIDENCE_MISSING`, a sprzeczne implementacje status `OWNER_DECISION`.

Minimalne pola rekordu:

- `module_id`, cel, wejścia, wyjścia i właściciel danych;
- aktualny route i faktycznie montowany komponent;
- canonical API/service/schema oraz wykryte warianty legacy;
- wymagane migracje, fixture i deployment flags;
- elementy `CONNECTED`, `UNMOUNTED`, `DUPLICATE`, `DEAD_CANDIDATE` i `MISSING`;
- dokładne task IDs zamykające każdą lukę;
- testy pozytywne, replay, stale-version, role i tenant negatives;
- status realDB, demo, desktop, mobile, visual i accessibility;
- finalny verdict `MVP_READY`, `POST_MVP`, `BLOCKED` albo `DONE`.

DoD etapu 8: wszystkie 16 modułów ma rekord bez pustych pól krytycznych; każda
luka ma dokładnie jeden task ID; żadna funkcja znaleziona w recovery ledger nie
pozostaje bez verdictu lub przypisanego zadania.

### 9. Wykonawcze pakiety dla agentów

Każdy task ID z tego dokumentu staje się samodzielnym pakietem wykonawczym.
Pakiet jest gotowy do uruchomienia dopiero po uzupełnieniu wszystkich pól:

- objective i jednoznaczna granica `in scope / out of scope`;
- exact baseline SHA i zależności, które muszą być `DONE`;
- dozwolone pliki oraz pliki współdzielone zastrzeżone dla integratora;
- kontrakt AS-IS i oczekiwany TO-BE, wraz z zachowywanymi zachowaniami;
- wymagane zmiany UI, API, danych, migracji, flag i dokumentacji;
- deterministyczne fixtures oraz komendy focused/realDB/browser;
- scenariusz golden flow i obowiązkowe negative cases;
- dowody końcowe, rollback i jawne pozostałe ryzyka;
- format handoffu: final SHA, changed files, wyniki bramek i literalny status.

Agent nie może rozszerzyć tasku, scalić całej starej gałęzi, aktywować funkcji
parametrem URL ani nadać sobie statusu `DONE`. Odkrycie pracy spoza zakresu
tworzy wpis w rejestrze, nie ukrytą dodatkową implementację.

DoD etapu 9: każdy task przeznaczony do startu ma kompletny pakiet; zakresy
równoległych agentów są rozłączne; shared-file ownership i kolejność integracji
są zapisane przed rozpoczęciem kodowania.

### 10. Integracja, odbiór i kwalifikacja MVP

Integrator przyjmuje wyłącznie małe, opisane commity z pakietów etapu 9.
Integracja przebiega falami zależności z macierzy poniżej. Po każdej fali
powstaje jeden immutable candidate SHA oraz aktualizacja rejestru.

Kolejne poziomy dowodu są niezamienne:

1. `CODE_CONNECTED` — route, UI, API i persistence są faktycznie połączone;
2. `FOCUSED_GREEN` — pakiet przechodzi własne testy;
3. `REALDB_GREEN` — fresh i upgrade PostgreSQL oraz readback są zielone;
4. `SYSTEM_GREEN` — pełna brama na jednym SHA nie ma niesklasyfikowanych faili;
5. `DEMO_PARITY` — demo raportuje ten sam SHA, migracje i flag profile;
6. `OWNER_ACCEPTED` — podpisany flow desktop/mobile i ocena wizualna są PASS.

Moduł trafia do poniedziałkowego MVP tylko wtedy, gdy osiąga wszystkie wymagane
poziomy bez silent fallbacku, mocków, query/localStorage flags i danych
technicznych widocznych użytkownikowi. Pozostałe moduły są jawnie `POST_MVP` lub
`BLOCKED`; nie obniżają prawdziwości statusu MVP.

DoD etapu 10: jeden release SHA, jedna lista modułów MVP, komplet evidence links,
rollback, brak nieprzypisanego WIP oraz końcowy raport `implemented / missing /
deferred / rejected` dla każdego modułu.

### 11. Audyt kompletności i zamrożenie planu dokończenia

Przed uruchomieniem wielu agentów integrator wykonuje mechaniczną kontrolę
pokrycia planu. Celem nie jest kolejna analiza produktu, lecz udowodnienie, że
każdy brak można wykonać bez ponownego odkrywania architektury i bez domyślania
się intencji.

Powstają cztery powiązane rejestry:

1. `MODULE_GAP_LEDGER` — jedna pozycja dla każdej luki wykrytej w route, UI,
   API, service, schema, danych, flagach, testach, demo i UX;
2. `EXECUTION_PACKET_INDEX` — jeden kompletny pakiet z sekcji 9 dla każdego
   tasku dopuszczonego do startu;
3. `CODE_DISPOSITION_LEDGER` — każdy odzyskany lub nieużywany fragment otrzymuje
   `KEEP_CONNECTED`, `INTEGRATE_AS_TASK`, `SUPERSEDED`, `REJECTED`,
   `DEAD_CANDIDATE` albo `EVIDENCE_MISSING` wraz z recovery path;
4. `RELEASE_COVERAGE_MATRIX` — mapowanie requirement -> task -> commit -> test ->
   realDB -> demo -> owner acceptance.

Każda luka ma dokładnie jednego właściciela, jeden task ID i jeden warunek
zamknięcia. Jeden task może zamykać kilka luk tylko wtedy, gdy mają wspólną
granicę danych i wspólny allowlist. Zadanie bez konkretnego baseline SHA,
allowlistu, komend i fixtures ma status `DISCOVERY_REQUIRED`, a nie `READY`.

Plan zostaje zamrożony dopiero po dwóch niezależnych kontrolach:

- **coverage check:** liczba luk bez tasku, kodu bez disposition i tasków bez
  pakietu wynosi zero;
- **dependency check:** graf zadań jest acykliczny, shared files mają jednego
  integratora, a każda fala ma jawny wejściowy i wyjściowy SHA.

DoD etapu 11: wszystkie taski MVP mają kompletne, kopiowalne prompty wykonawcze;
każdy task post-MVP ma co najmniej precyzyjny bounded-discovery packet albo
pełny packet; macierz pokrycia nie ma pustych rekordów krytycznych; właściciel
może uruchomić agentów bez ponownej interpretacji dokumentacji.

### 12. Chirurgiczny rejestr wykonania i kolejka startowa

Etap 12 zamienia każdy opis modułu w atomowe zadania, które można wykonać bez
ponownego audytu całego repozytorium. Nie wolno łączyć w jednym tasku zmian o
różnych właścicielach danych ani zadań wymagających równoległej edycji plików
współdzielonych.

Każdy rekord luki otrzymuje obowiązkowo:

- stabilny `gap_id` oraz dokładnie jeden `task_id`;
- requirement i źródło kontraktu z konkretną sekcją dokumentu;
- stan AS-IS z route, komponentem, requestem, service i tabelą;
- jednozdaniową różnicę TO-BE minus AS-IS, bez ogólnego „dokończyć moduł”;
- klasyfikację `MISSING_CODE`, `MISWIRED`, `DISABLED`, `DUPLICATE_OWNER`,
  `MISSING_DATA`, `MISSING_MIGRATION`, `STALE_TEST`, `RUNTIME_UNPROVEN` albo
  `VISUAL_GAP`;
- właściciela danych i jedyne dozwolone miejsce trwałego zapisu;
- dokładne pliki do zmiany oraz pliki tylko do odczytu;
- fixture wejściowe, oczekiwany readback i regułę idempotentnego replay;
- positive flow oraz obowiązkowe failure, stale-version, role i tenant cases;
- testy, które muszą przejść, oraz test, który powinien upaść przed naprawą;
- zależności tasków, kolejność integracji i pliki współdzielone zarezerwowane
  dla integratora;
- wymagane dowody: commit, focused, realDB, system, demo, desktop/mobile,
  visual/a11y oraz rollback;
- końcowy status `DISCOVERY_REQUIRED`, `READY`, `IN_PROGRESS`, `VERIFYING`,
  `DONE`, `BLOCKED` albo `POST_MVP`.

Task może uzyskać `READY` tylko wtedy, gdy wszystkie powyższe pola są
wypełnione i nie zawierają `TBD`, „sprawdzić”, nieokreślonego globu całego
modułu ani decyzji pozostawionej wykonawcy. Jeśli pliku lub kontraktu nie da się
jeszcze wskazać, powstaje osobny, read-only task `DISCOVERY_REQUIRED` z
konkretnym pytaniem i formatem odpowiedzi.

Kolejka startowa ma trzy koszyki:

1. `READY_PARALLEL` — rozłączne allowlisty i brak niezakończonych zależności;
2. `READY_SERIAL_INTEGRATOR` — routing, menu, flagi, migrator, shared API,
   deployment i inne pliki współdzielone;
3. `NOT_READY` — brak dowodu, nierozstrzygnięty owner lub zależność.

DoD etapu 12: zero tasków MVP opisanych wyłącznie na poziomie modułu; każdy
task w `READY_PARALLEL` ma kopiowalny prompt i rozłączny allowlist; każdy task
w `NOT_READY` ma jednoznaczny blocker oraz następne działanie, a nie ogólną
prośbę o dalszą analizę.

### 13. Niezależna kontrola pakietów przed uruchomieniem agentów

Przed startem wykonawcy integrator wykonuje mechaniczny preflight pakietu:

- baseline SHA istnieje, jest osiągalny i worktree jest czysty;
- wymagane pliki i symbole istnieją na baseline;
- zależności mają dowód `DONE`, nie tylko commit autora;
- allowlist nie przecina aktywnego tasku innego agenta;
- komendy testowe odkrywają oczekiwane pliki i nie korzystają z mock DB jako
  dowodu realDB;
- fixture jest deterministyczne, tenant-scoped i bezpieczne przy replay;
- golden flow używa zwykłej trasy i normalnej autoryzacji;
- rollback nie usuwa obcych danych i wskazuje recovery SHA/manifest;
- prompt zawiera zakaz szerokiego merge, silent fallback, query/localStorage
  activation i samooceny `DONE`.

Wynik preflightu to podpisany wpis `PACKET_ACCEPTED` albo `PACKET_REJECTED` z
listą brakujących pól. Dopiero `PACKET_ACCEPTED` pozwala uruchomić agenta.

DoD etapu 13: wszystkie uruchamiane pakiety mają zaakceptowany preflight,
zamrożony baseline oraz właściciela integracji; żaden agent nie rozpoczyna pracy
od pytania „gdzie jest aktualna wersja?” albo „co właściwie mam dokończyć?”.

### 14. Rejestr zamknięcia modułów i plan finalnego montażu

Po integracji tasku aktualizowane są jednocześnie cztery poziomy prawdy:
`gap -> task -> commit -> evidence`. Moduł nie jest zamknięty przez samą sumę
commitów. Otrzymuje kartę końcową zawierającą:

- listę wymagań `DONE`, `POST_MVP` i `BLOCKED`;
- listę zachowanego, podłączonego, odłączonego i usuniętego kodu;
- canonical route/API/service/schema oraz jawne adaptery przejściowe;
- wymagane dane demo i ich tenant-scoped readback;
- wyniki focused, realDB, full-system, deploy parity, browser, visual i a11y;
- znane ograniczenia produktu i zakres niewchodzący do MVP;
- rollback i właściciela dalszego utrzymania.

Finalny montaż przebiega wyłącznie według grafu zależności tasków: najpierw
właściciele danych i migracje, potem service/API, następnie UI, routing/flags,
fixtures, system gate, deployment i odbiór. Wspólne pliki integruje jedna osoba
na końcu fali. Każda fala kończy się immutable candidate SHA.

DoD etapu 14: dla wszystkich 16 modułów istnieje karta końcowa; nie ma wymagań
bez statusu, tasków bez evidence, commitów bez przypisanego tasku ani funkcji
bez właściciela danych. Na tej podstawie powstaje jedna lista MVP, jedna lista
post-MVP oraz jedna acykliczna kolejność finalnego montażu.

### 15. Zamrożona specyfikacja braków moduł po module

Przed rozpoczęciem masowego wykonania każdy moduł otrzymuje wersjonowaną
specyfikację dokończenia. Jest ona różnicą pomiędzy wymaganiem SSOT a stanem
udowodnionym na konkretnym SHA, a nie listą pomysłów lub deklaracji autora.

Każda specyfikacja zawiera obowiązkowo:

- cel biznesowy, wejścia, wyjścia, role i ownera danych wskazane przez SSOT;
- tabelę wymagań z dokładną sekcją źródłową i verdict `SATISFIED`, `PARTIAL`,
  `MISSING`, `CONFLICTING_IMPLEMENTATION`, `POST_MVP` albo `EVIDENCE_MISSING`;
- faktyczny łańcuch AS-IS: route -> mounted UI -> client -> endpoint -> service ->
  tabela/migracja -> readback, wraz z nazwami symboli i ścieżkami plików;
- każdy odnaleziony wariant legacy, niepodłączony komponent, osieroconą flagę,
  fallback, mock i alternatywnego writera danych wraz z disposition;
- minimalną różnicę kodową niezbędną do spełnienia kontraktu, bez przebudowy
  elementów już poprawnie działających;
- dane referencyjne i fixtures wymagane do pracy użytkownika, wraz z
  tenant-scoped UPSERT, replay i post-write readback;
- listę atomowych `gap_id`, z których każdy ma jeden `task_id`, ownera,
  zależności, allowlist, test czerwony przed zmianą i warunek zamknięcia;
- osobną granicę poniedziałkowego MVP i post-MVP, bez ukrywania odroczeń w
  ogólnym statusie modułu.

Specyfikacja jest kompletna tylko wtedy, gdy reverse trace również się zgadza:
każdy route, endpoint, tabela, flaga, komponent i odzyskany fragment należący do
modułu jest przypisany do requirementu albo ma jawny disposition. W ten sposób
wykrywamy zarówno brakujący kod, jak i kod istniejący, lecz niewykorzystywany.

DoD etapu 15: wszystkie moduły mają zamrożone specyfikacje na jednym SHA; zero
wymagań bez gap/verdictu; zero elementów kodu domenowego bez requirementu lub
disposition; suma otwartych gapów równa się sumie gapów przypisanych do tasków.

### 16. Wykonalny plan uruchomienia wielu agentów

Na podstawie etapu 15 powstaje jeden launch manifest. Nie jest to lista tematów,
lecz dokładny harmonogram commitów i bramek. Każdy wiersz określa:

- `task_id`, moduł, priorytet MVP, baseline SHA i oczekiwany output commit;
- wymagane taski poprzedzające i kryterium, które udowadnia ich zakończenie;
- izolowany worktree, branch, właściciela wykonania i właściciela integracji;
- zamknięty allowlist plików oraz listę shared files, których agent nie edytuje;
- maksymalny zakres migracji i tabel, jedynego writera oraz regułę rollbacku;
- dokładne komendy focused, typecheck, realDB, replay, tenant/role negative,
  browser desktop/mobile, visual i accessibility;
- artefakty dowodowe i miejsce ich trwałego zapisania w repo;
- timeout eskalacyjny i literalny rezultat `DONE`, `FIX_REQUIRED`, `BLOCKED`.

Równoległość jest wyliczana z przecięcia allowlistów i grafu zależności. Taski
dotykające `AppRoutes`, menu, wspólnych klientów API, migratora, flag profilu,
globalnych typów lub deploymentu trafiają do kolejki integratora. Pozostałe
mogą ruszyć równolegle wyłącznie z tego samego immutable baseline. Agent nie
może samodzielnie zmienić ownera danych, trasy kanonicznej, zakresu MVP ani
zastąpić testu realDB mockiem.

DoD etapu 16: launch manifest jest acykliczny; każdy uruchamiany task ma
`PACKET_ACCEPTED`; allowlisty równoległych tasków są rozłączne; każda fala ma
wejściowy SHA, integratora, kolejność cherry-picków i pełną bramkę wyjściową.

### 17. Brama „bez zgadywania” i rejestr pozostałej pracy

Po każdej fali wykonywany jest automatyczny i ręczny reconciliation. Rejestr
nie może zostać zamknięty przez samo przejście testów. Kontrola porównuje:

1. wymagania SSOT z `MODULE_GAP_LEDGER`;
2. luki z taskami i zaakceptowanymi pakietami;
3. taski z rzeczywistymi commitami i zakresem diffu;
4. commity z testami, migracjami, fixture i readback;
5. candidate SHA z wdrożonym SHA, flagami i ledgerem migracji;
6. dane demo z wymaganymi scenariuszami pracy użytkownika;
7. UI desktop/mobile z kanonem Consultify, a11y i signed-off visual evidence;
8. wszystkie aktywne route/API/schema z kartami końcowymi modułów.

Każda różnica tworzy nowy stabilny `gap_id` albo przywraca istniejący task do
`FIX_REQUIRED`. Zabronione jest zamykanie różnicy opisem „działa lokalnie”,
„jest na innej gałęzi”, „wystarczy włączyć flagę” lub „test dopiszemy później”.

Końcowy rejestr ma trzy jednoznaczne widoki:

- `MVP_REMAINING_WORK` — wyłącznie zadania konieczne do startu MVP, w kolejności;
- `POST_MVP_BACKLOG` — świadomie odroczone wymagania z uzasadnieniem i ownerem;
- `REJECTED_OR_RETIRED` — kod nieużywany/duplikaty z recovery path i dowodem,
  że nie jest wymagany przez aktywny produkt.

DoD etapu 17: `MVP_REMAINING_WORK=0`; candidate i demo mają ten sam SHA;
wszystkie moduły MVP mają komplet code/realDB/system/browser/visual evidence;
nie ma nieprzypisanego WIP, nieznanego writera, silent fallbacku, aktywacji
query/localStorage ani wymagania zamkniętego wyłącznie deklaracją.

### Aktualny stan przygotowania pakietów

- Etap 8: `COMPLETE_CODE_INVENTORY` — 16/16 kart i task IDs znajduje się w
  `FINAL_16_MODULE_READINESS_AND_EXECUTION_PLAN_2026-08-15.md`; 224/224
  recovered heads ma werdykt, semantic unknowns = 0.
- Etap 9: `PARTIAL` — istnieje kontrakt pakietu, lecz nie każdy task ma jeszcze
  wypełniony allowlist, fixtures, komendy i negative cases. Takiego tasku nie
  wolno przekazać agentowi jako implementacyjnego.
- Etap 10: `IN_PROGRESS` — zintegrowano 23 recovered candidates, w tym ostatnio
  Chat Ideas handoff, Finance missing-vs-zero, Document transformative edit,
  Tools CAS, E2E tenant isolation i atomowy Interview→Initiative;
  pozostaje 5 jawnych kandydatów, integracja tylko pakietami.
- Etap 11: `COMPLETE_FOR_RECOVERY` — każdy recovered head ma disposition oraz
  przypisany task albo dowód represented/superseded/rejected.
- Etap 12: `IN_PROGRESS` — istnieją task IDs i zależności, ale wszystkie taski
  MVP muszą jeszcze otrzymać atomowe gap IDs, pełne allowlisty, fixtures,
  komendy oraz dowody wymagane do nadania `READY`.
- Etap 13: `NOT_STARTED` — preflight rusza po przygotowaniu pierwszych pełnych
  pakietów i zamrożeniu ich baseline.
- Etap 14: `NOT_STARTED` — karty końcowe będą zamykane falami po integracji i
  runtime acceptance, nie na podstawie samego audytu kodu.
- Etap 15: `COMPLETE_CODE_LEVEL` — 16 kart mapuje route/UI/API/service/schema,
  duplikaty, ownera i brakujące dowody; runtime/demo pozostają osobną bramką.
- Etap 16: `IN_PROGRESS` — finalny raport zawiera kolejność, MVP remaining work,
  post-MVP backlog i standard pakietu; pełne allowlisty/komendy trzeba zamrozić
  bezpośrednio przed uruchomieniem każdego packetu na aktualnym baseline.
- Etap 17: `NOT_STARTED` — reconciliation ruszy po pierwszej zintegrowanej fali;
  status release pozostaje `NOT_RELEASE_READY` do wyzerowania pracy MVP.

## Cel i reguła statusu

Ten dokument przekłada audyt modułowy na rozłączne paczki wykonawcze. Każdy
wpis ma zamknięty zakres, zależności i dowód odbioru.

- `READY` — można rozpocząć pracę;
- `PARTIAL` — kod istnieje, ale DoD nie jest udowodnione;
- `BLOCKED` — wskazana zależność blokuje prawidłowe wykonanie;
- `EVIDENCE_MISSING` — kod może istnieć, ale brak wymaganego dowodu;
- `DONE` — komplet dowodów istnieje dla jednego SHA.

Focused test, route, widoczny przycisk, fixture, query flag lub deklaracja autora
same nigdy nie nadają statusu `DONE`.

## Zamrożone decyzje integracyjne

1. Dla MVP Agent zapisuje `transformation_cases`. `/zlecenia` i legacy
   `ai_agent_plans` nie są drugim aktywnym writerem. Konwergencja do `case_core`
   wymaga ADR, mapowania ID i migracji.
2. Results KPI/ROI/OKR aktywujemy wyłącznie przez deployment profile, nigdy
   query/localStorage. Normalna trasa nie może pokazywać disabled shell.
3. Finance pozostaje closed do kompletnego bridge/backfill report, jednej
   przestrzeni ID i realDB proof pięciu kanonicznych workspaces.
4. Audits jest poza podstawowym MVP albo jawnie oznaczone jako beta CRUD.
5. Historyczny ekran, route, flaga, migracja lub checkout może zostać usunięty
   dopiero z verdict `REPRESENTED|SUPERSEDED|REJECTED` i recovery path.

## Kontrakt paczki dla agenta

Agent otrzymuje jeden task ID lub rozłączny zestaw z jednej sekcji. Handoff musi
zawierać baseline/final SHA, listę plików, focused gate, realDB/readback,
ryzyka, status demo i literalny verdict. Wspólne `AppRoutes`, menu/navigation,
shared API, flag resolvers, migrator i global styles ma wyłącznie integrator.

### Szablon pojedynczego zadania

Każde zadanie uruchamiane przez agenta musi zostać skopiowane z rejestru w tym
formacie; brak któregokolwiek pola oznacza `NOT_READY_TO_START`:

```text
TASK_ID:
MODULE / OWNER:
OBJECTIVE:
BASELINE_SHA:
DEPENDS_ON:
IN_SCOPE:
OUT_OF_SCOPE:
ALLOWLIST:
SHARED_FILES_RESERVED_FOR_INTEGRATOR:
AS_IS_EVIDENCE:
TO_BE_CONTRACT:
DATA_AND_MIGRATION_REQUIREMENTS:
FIXTURE_AND_READBACK:
GOLDEN_FLOW:
NEGATIVE_CASES:
COMMANDS_TO_RUN:
DEMO_AND_VISUAL_PROOF:
ROLLBACK:
DONE_EVIDENCE:
HANDOFF_FORMAT:
```

Jeżeli analiza tasku nie pozwala wpisać konkretnego pliku, kontraktu lub
komendy, pierwszym rezultatem agenta jest bounded discovery report. Agent nie
przechodzi wtedy do kodowania, dopóki rejestr nie wskaże chirurgicznego zakresu.

## Fala 0 — authority, recovery i test truth

### CLEAN-001 — klasyfikacja pełnego standard gate

- Status: `IN_PROGRESS`, P0; owner: test-integrator.
- Wejście: `test-gates/standard-aeb28eb6a/summary.json` i 24 shard JSON/log.
- Zakres: 242 niezielone pliki / 476 testów. Każdy otrzymuje jeden verdict:
  `PRODUCT_REGRESSION`, `STALE_CONTRACT`, `HARNESS_BUG`, `WRONG_GATE`,
  `EXTERNAL_DEPENDENCY` lub `NONDETERMINISTIC`.
- Sygnały wejściowe: 36 plików ma 503-versus-401, 40 timeout, 17 niepełny
  mock/import, 7 niepełny i18n mock, co najmniej 4 używa DB sentinel. To hipotezy
  triage, nie końcowe werdykty.
- DoD: 242/242 ma verdict, ownera i komendę reprodukcji; full gate ma
  4052/4052 oraz 0 missing/unexpected.
- Zakaz: nie zmieniać produktu tylko po to, aby zachować starą asercję.
- Reprodukcja izolowana: 242/242 pliki wykonano ponownie, każdy w świeżym
  procesie na SHA `94d94e797e94020d22f47484c1f97e88e78f544c`; 0 przeszło,
  242 nadal niezielone. Jeden test workbook pozostawiał otwarty proces po
  zapisaniu JSON i został zakończony sygnałem TERM. Evidence:
  `/Users/piotrwisniewski/Developer/consultify-cleanup-evidence-20260814/test-gates/isolated-triage-94d94e797`.

#### CLEAN-001A — 132 server-runtime/DB harnesses

- Owner: DB-gate lane; allowlist: wyłącznie wskazane testy, matrix i test runner.
- Fakt: źródła importują server runtime/database lub `supertest`; standard gate
  celowo podaje niedostępny DB sentinel. Przykładowy test Settings otrzymuje 503
  zamiast oczekiwanego 401 oraz unhandled PostgreSQL rejection przed auth.
- Praca: dla każdego pliku wybrać `fresh-postgres`, `legacy-sqlite` albo
  `external-runtime`; zbudować wymagane fixtures i usunąć runtime DDL/open handles.
- DoD: 132/132 ma jawny gate i przechodzi w nim; standard nie uruchamia testów
  wymagających DB; auth negatives są wykonywane przy zdrowym runtime.

#### CLEAN-001B — 58 UI component contracts

- Status: `IN_PROGRESS`; owner: UI-harness lane; allowlist: 58 testów i ich bezpośrednie component
  fixtures/mocks; produkt tylko po udowodnionym regression verdict.
- Praca: porównać oczekiwanie z aktualnym kanonem UI/i18n/design tokens; nadać
  `STALE_CONTRACT`, `HARNESS_BUG` lub `PRODUCT_REGRESSION`.
- DoD: focused 58/58 PASS, brak act/unhandled warnings i brak snapshotów
  akceptujących techniczne UUID/enums.
- Evidence cząstkowe: pierwsze 19 plików sklasyfikowane i zielone na commitach
  `229aed81a` oraz `c9b262b04` (203/203 testy). Osiemnaście miało
  `STALE_CONTRACT`/`HARNESS_BUG`: niepełne i18n/interpolation mocks, stare role
  menu, zastąpiony canonical register/preview, historyczny BetaGate target i
  nieaktualny canonical initiatives API shape. Jeden plik ujawnił
  `PRODUCT_REGRESSION`: `DocumentStudioQaPanel` utracił dostępną akcję przejścia
  do dokładnego finding; callback przywrócono w `c9b262b04`.
- Trzecia partia: kolejnych 8 plików i 22/22 testy są zielone. Sześć verdictów
  to `STALE_CONTRACT`/`HARNESS_BUG`: stare mocki `FilterableTable`,
  `TableWithPreviewLayout` i `ModuleHub` po przejściu na `StandardTable`,
  `StandardPreview` i `StandardModuleBar`, niepełny FeatureFlags/i18n mock oraz
  angielski fallback etykiety agregowanej wykresu. Dwa kontrakty wykazały
  `PRODUCT_REGRESSION`: migracja `02adb834e` zgubiła istniejącą kolumnę jakości
  prezentacji, a kanoniczny preview prezentacji nie montował wspólnego
  `TrustStatePreviewSection`. Oba zachowania przywrócono na aktualnym
  `PresentationsTabContent`; starych preview components nie odtworzono.
- Czwarta partia: kolejnych 10 plików i 36/36 testów jest zielone razem.
  Wszystkie verdicts to `STALE_CONTRACT` albo `HARNESS_BUG`: niepełne mocki
  i18n (`initReactI18next`, `getFixedT`, interpolacja), historyczne mocki
  `FilterableTable`/`TableWithPreviewLayout`, stare kolory i copy oraz smoke
  anchors sprzed przejścia hubów na `StandardModuleBar`, Results VNext i
  kanoniczny root Outputs. Nie znaleziono regresji produktu; focused gate,
  frontend typecheck i `git diff --check` są zielone.
- Piąty verdict: `financialNarrativeBlocks.test.ts` był `HARNESS_BUG` po
  migracji helpera do singletonu i18n; test otrzymał jawny angielski katalog
  zamiast akceptować surowy klucz tłumaczenia. Focused 6/6 PASS.
- Stan cząstkowy CLEAN-001B: 38/58 plików sklasyfikowanych i zielonych,
  267/267 testów w zakończonych partiach. Otwarte product gaps i testy
  komponentów oczekujących na disposition nie są wliczane jako PASS.
- Otwarty verdict z drugiej partii: test
  `PrezentacjeView.templateBrief.test.tsx` opisuje realną brakującą funkcję, nie
  stale assertion. UI automatycznie wywołuje `from-template` bez briefu i
  zmiennych, a endpoint dokumentuje wyłącznie `templateArtifactId` i `title`.
  Luka jest przypisana do `MAT-002`; test pozostaje niezielony do implementacji.
- Trzecia partia wykryła historyczne testy komponentów usuniętych jawnie przez
  `d1d4f4d0e` (`DocumentStudioEditorPanel`, `TransformativeConfirmDialog`) oraz
  przez `00e27b069`/`e750d04f9` (`PresentationPreview`). Nie wolno ich odtwarzać
  tylko dla testu ani usuwać testów bez wpisu `SUPERSEDED` i recovery path w
  CLEAN-002/CLEAN-003.

#### CLEAN-001C — 16 unit tests z mockami

- Status: `DONE` na SHA `7c8a7a5c8`; owner: mock-contract lane.
- Allowlist: 16 testów, współdzielone test fixtures oraz dwa bezpośrednie pliki
  produktu po potwierdzeniu regresji kontraktu Materials.
- Praca: uzupełnić aktualne eksporty, hoisted factories, i18n i API contract;
  nie maskować brakującej funkcji produktu przez mock.
- DoD: 16/16 PASS pojedynczo i razem; zero missing export/unhandled rejection.
- Wynik: 16/16 plików, 54/54 testów PASS razem. Trzynaście plików miało
  `STALE_CONTRACT` lub `HARNESS_BUG` (transakcje, schema guards, PostgreSQL SQL,
  bezpieczne komunikaty, alert router, circuit threshold i izolacja mocked
  persistence). Dwa testy Materials ujawniły `PRODUCT_REGRESSION`: diversity
  post-processing usuwał wymagany drugi layout comparison, a normalizer tabel
  kasował semantic cell styles. Naprawione w `487513558`; focused renderer i
  generator gate: 5 plików, 42/42 PASS. Commity harnessów: `85f63e503`,
  `eafffc4ac`, `7c8a7a5c8`.

#### CLEAN-001D — 36 pure/source contracts

- Owner: contract-review lane; allowlist: 36 testów, docs/SSOT i bezpośredni
  kod produktu tylko dla potwierdzonej regresji.
- Praca: rozdzielić świadome supersession od realnej utraty kontraktu; usunąć
  kruche source-anchor checks na rzecz zachowania lub jawnego structural proof.
- DoD: każdy verdict ma wskazany commit/SSOT; 36/36 PASS; brak osłabienia
  security, provenance, idempotency i honesty assertions.

### CLEAN-002 — semantyczny ledger 421 rozbieżnych tipów

- Status: `IN_PROGRESS`, P0; owner: recovery-integrator.
- Wejście: `refs/recovery/unknown-20260815/*`; bundle SHA-256
  `5bb23bea9d794b038a2710942a5bdf693417f6034ce7581f4c78480b034f5ade`.
- Zakres: merge-base, moduł, unikalne migrations/seeds/routes/UI/tests i verdict
  `REPRESENTED`, `CANDIDATE`, `SUPERSEDED`, `REJECTED` lub `OWNER_DECISION`.
- DoD: 421/421 ma verdict; każdy `CANDIDATE` wskazuje task ID i module diff;
  brak whole-branch merge.
- Patch-equivalence wykonane dla 421/421: 124 tipy są `PATCH_REPRESENTED`, 297
  zawiera unikalne patche. `git merge-base --independent` redukuje 297 do 224
  niezależnych końcówek; 68 z nich dotyka migrations. Evidence:
  `recovered-tip-patch-equivalence-257a1393f8.json` oraz
  `recovered-independent-head-module-inventory-257a1393f8.json` w katalogu
  cleanup evidence. Pozostały verdict jest semantyczny, nie automatyczny.
- Repozytoryjny ledger `docs/cleanup/generated/recovered-tip-disposition.json`
  zawiera 421/421 unikalnych tipów i recovery refs: 124 mają zamknięty verdict
  `REPRESENTED_PATCH_EQUIVALENT`, a 297 literalne
  `SEMANTIC_REVIEW_REQUIRED`; `deletionAuthorized=0`. Generator
  `scripts/cleanup/build-recovered-tip-disposition.mjs` waliduje sumy źródła,
  unikalność i jest deterministyczny (powtórny build daje identyczny JSON).
  Oznacza to, że pierwsze 124 nie wymagają integracji produktu, ale ich refs
  pozostają chronione do CLEAN-003; pozostałych 297 nie wolno uznać za brakujące
  ani zbędne bez task ID i semantycznego verdictu.
- Ledger niezależnych historii
  `docs/cleanup/generated/recovered-head-disposition.json` zamyka pierwszy
  semantyczny podzbiór 224 heads: 18 ma verdict `REFERENCE_HARNESS_ONLY`, bo
  wszystkie ich unikalne ścieżki są ograniczone do `dev-render/`. Cztery
  kolejne heads otrzymały reviewed verdict: trzy `REPRESENTED_SUPERSEDED`, a
  luka izolacji projektów Vault została selektywnie zintegrowana w
  `14d65703a` i potwierdzona przez 5 plików / 37 testów oraz server typecheck.
  Następnie odzyskana naprawa PostgreSQL dla bottlenecków decyzji została
  zintegrowana w `d3be120e1`; unit contract 19/19 i server typecheck są zielone,
  a realDB test wymaga teraz jawnego HTTP 200. Odzyskana widoczność
  zatwierdzonych sesji Tools została zintegrowana w `9be10e6eb`; kontrakt
  widoczności oraz istniejący hub gate dają 2 pliki / 44 testy, a frontend
  typecheck jest zielony. Lokalny allowlist trzech strategicznych narzędzi z
  kolejnego odzyskanego head został zastąpiony przez współdzielony
  `DEDICATED_TOOL_TYPES`; routing i registry mają 2 pliki / 16 testów PASS.
  Cztery małe historie dokumentacyjne zostały zweryfikowane: inwentarz ośmiu
  kart jest bajtowo obecny w kanonie (`REPRESENTED_CANONICAL`), a stare raporty
  Chat schema, Presentation W7 i Coverage są zastąpione przez aktualne
  migracje/kod oraz repozytoryjne evidence CLEAN-001/Materials. Backupowy merge
  masowych usunięć otrzymał `REJECTED_DESTRUCTIVE_SNAPSHOT`: względem obu
  rodziców usuwa dokładnie 334 pliki / 15 791 linii i niczego nie dodaje ani nie
  modyfikuje; ref i rodzice pozostają chronione. Dwa równoważne heady SMTP
  zostały zastąpione ostrzejszą kanoniczną naprawą `9779b8ddd`: prawidłowy
  fallback nadawcy, prawdziwy wynik dostarczenia oraz audit `SENT/FAILED/MOCK`
  mają focused 4/4 PASS i server typecheck PASS. Starszy Notebook Share jest
  już obecny na aktualnej montowanej powierzchni. Odzyskana normalizacja
  wieloliniowych tagów tabel została dopasowana do aktualnego ratchetu w
  `3cdcce6fc`; pełny skan 174 plików ma 273/273 i zero nowych naruszeń, zamiast
  135 fałszywych alarmów. Dwa historyczne uproszczenia My Work zostały
  odrzucone jako superseded: `New Decision` pozostaje potrzebny, ponieważ
  globalny `UnifiedCreateLauncher` nie ma produkcyjnego hosta, a mini-outline
  jest wymagany przez późniejszy kontrakt Notebook V3. Odzyskany smoke-500 jest
  bajtowo obecny, presentation composition merge jest w pełni reprezentowany
  (3 pliki / 19 testów PASS), a brakujący realDB test Assessment CRUD został
  przywrócony w `0885f3490`; świeży PostgreSQL 15 i 9/9 testów PASS po naprawie
  runnera wymuszającej `RUN_DB_TESTS=1` oraz `MOCK_DB=false`. Kolejne dziewięć
  głów zamknęło dwa realne braki produktu i siedem
  historii już reprezentowanych: `scope_change_log` został zintegrowany w
  `ba5bbb92d` (pełny replay 706 migracji PostgreSQL 15, 2/2 realDB write/readback,
  5/5 unit), a odzyskany backendowy Finance M16 gate w `2b6f2784e` przechodzi
  16/16 na tej samej świeżej bazie. Historyczne checkpointy Harvard/Ideas,
  starszy Oxford O4, Document Studio BetaGate, wycofany ExecutionLightShell,
  Ideas Financial Case i polskie cytaty Interview są reprezentowane przez
  późniejszy kanon. Dodatkowo odzyskany, niezweryfikowany finding szablonów
  prezentacji odtworzył na realnym PostgreSQL regresję 5/7; naprawa
  `1ec123c82` wymusza trwały, tenant-scoped readback dla plan/clone/update i
  odwraca gate do 7/7 PASS. Mechaniczny audyt bajtowej reprezentacji zamknął
  następne 12 głów: Chat tenant-session, Initiatives M05, Tools race,
  onboarding, Ideas table/mindmap, My Work Calendar, Agent final outputs,
  deliverable normalization oraz trzy dokumenty są dokładnie obecne w kanonie.
  Wykonany focused podzbiór daje 7 plików / 35 testów PASS; testy browser/realDB
  pozostają jawnie do wykonania w ich właściwych gate'ach. Trzy dalsze historie
  są zastąpione przez późniejszy kanon: XLSX ma jeden adoptowany artefakt
  (3/3), komentarze Deck pozostają świadomie poza wspólnym MELS order (18/18),
  a Process Flow ma nowszy toolbar z progressive disclosure (13/13). Meeting
  Core został selektywnie zintegrowany w `0bfc48721` z atomowego pakietu
  `MTG-001-T01`; nie jest już niesklasyfikowanym WIP i nie został scalony jako
  branch. Dwie kolejne historie zostały zastąpione przez
  bezpieczniejszy kanon: przycisk presetu Assessment jest pokazywany wyłącznie
  dla jedynej wspieranej metodologii DRD (2/2 i frontend typecheck), a wspólny
  resolver map Ideas obsługuje odczyty metrics/artifacts/CSV z jednego wiersza
  `is_canonical`; odzyskane kontrakty czytników są przywrócone i pełna macierz
  shared-map ma 11/11 PASS. Historyczny agregat Core został zastąpiony przez
  aktualne, rozdzielone kontrakty Initiative/Execution i Results VNext; jego
  dawny finding o braku RCA Suggest jest nieaktualny, a obecny route ma 9/9
  focused PASS. Jednoliniowy checkpoint sweepu Ideas jest z kolei zastąpiony
  późniejszymi sekcjami tego samego handoffu opisującymi integrację, render i
  ówczesny odbiór. Starsza naprawa reconciliation `k.unit` jest reprezentowana
  przez późniejszy kanon O4.7: odczyt używa `metric_type`, nie ukrywa błędów
  schematu fallbackiem i zachowuje klasyfikację `duration` jako niemonetarną.
  Następne trzy odzyskane historie strażników są zastąpione przez mocniejszy
  kanon: repozytoryjny Triada ratchet wykrył cztery rzeczywiste naruszenia UI,
  usunięte w `34441854b` (8/8, frontend typecheck, pełny ratchet exit 0), SSOT
  gate przechodzi komplet 16 menu / 10 SSOT / 14 command-center, a parser i
  kolejność migracji mają 8/8 oraz 22 PASS. Audyt migratora wykrył dodatkowo
  utracony import guard; `1df2181fe` przywraca eksport komparatora i uruchamia
  `main()` wyłącznie dla bezpośredniego CLI, z zielonym backend buildem.
  Następne odzyskane historie zostały rozstrzygnięte chirurgicznie. Alias
  routingu Execution przywrócono w `babee1735`; tłumaczenia Inicjatyw dla
  sześciu języków w `f971213d7`; starsze testy Document Studio zastępują
  mocniejsze kontrakty trwałości i realDB eksportu. Późniejszy kanon zachowuje
  też poprawkę alpha `c-accent-soft`, pełne menu Whiteboard, normalizację
  booleanów Decisions i canonical auto-unblock (focused 41/41). Tools zachowuje
  prawidłowe wyjście z sesji, a Interview używa kanonicznego preview/Open
  (focused 61/61). Rozszerzony `workbookQualityGate`, Table row-context i
  klikalne relacje Inbox/Decisions również są obecne (focused 67/67). Browser i
  realDB pozostają osobnymi bramkami. Ledger ma 134 pozycje
  `SEMANTIC_REVIEW_REQUIRED`. Te 18 pozostaje zachowanym materiałem
  UX/prototypowym, ale nie
  jest kodem produkcyjnym do merge. Generator mechanicznie egzekwuje warunek
  ścieżek, unikalność, sumy i deterministyczny output; nadal
  `deletionAuthorized=0`.

### CLEAN-003 — kontrolowane usuwanie

- Status: `BLOCKED` przez CLEAN-002; owner: cleanup-integrator.
- Zakres: martwe ekrany/routes/flagi, duplikaty checkoutów, cache i artefakty.
- DoD: import/dynamic-import/history proof, recovery path, delete commit i
  focused/full gate dla każdej pozycji.

### REL-001 — jeden identyfikowalny release candidate

- Status: `PARTIAL`, P0; owner: release-integrator.
- Zakres: immutable candidate SHA, client/server marker, migration ledger,
  deployment environment i evidence manifest.
- DoD: UI i `/api/health` zwracają ten sam SHA; artifact digest, demo deployment
  i browser trace wskazują dokładnie ten SHA.

## Fala 1 — rdzeń MVP

### CHAT-001 — jeden publiczny kontrakt rozmowy

- Status: `PARTIAL`, P0; owner: Chat lane.
- Zakres: rozdzielić core stream od V8 snapshot/handoff; usunąć silent fallback
  albo dodać jednoznaczną telemetrykę; zachować ordering i retry.
- Allowlist: `src/components/AIChat/**`, `src/hooks/useAIStream.ts`, chat clients,
  chat routes/services/tests.
- DoD: ask -> stream -> stop/retry -> persist -> cold reload; replay nie
  duplikuje; normalny route; zero cross-conversation leak.
- Dowód: UI/API, realDB readback, tenant negative, desktop/mobile trace.

#### CHAT-001-G01 — otwarty artefakt ma pierwszeństwo przed klasyfikatorem nowego outputu

- Status: `DISCOVERY_REQUIRED`, P0; task `CHAT-001-T01`; klasyfikacja:
  `MISWIRED`; owner zapisu: moduł aktualnie otwartego artefaktu.
- AS-IS: bieżący `UnifiedChatPanel.tsx` nie rozpoznaje
  `workspaceContext.entityData.artifactKind` przed ogólnymi classifierami.
  Prompt o NPV/scenariuszach w otwartym Deck Builderze może zostać przejęty
  przez ścieżkę workbook i stworzyć Sheet zamiast edytować deck.
- Recovery evidence: niekanoniczny commit `3977b36b4` zawiera pure resolver
  `resolveWorkspaceArtifactKind` i branch `onModuleIntent` przed output routing;
  powiązana asercja w `UnifiedChatPanel.helpers.test.ts` jest obecnie czerwona.
- TO-BE minus AS-IS: jeśli host podaje `onModuleIntent` i jawny artifact kind,
  wolna wypowiedź trafia najpierw do istniejącego writera tego artefaktu; jego
  jawne `handled=false` pozwala dopiero przejść dalej. Załączniki i nieznany
  context zachowują dotychczasowy Chat flow.
- Następny krok discovery: wskazać wszystkie hosty `UnifiedChatPanel` podające
  `onModuleIntent`, ich artifactKind i kontrakt odpowiedzi; potwierdzić, że
  recovered branch nie omija proposal/approval. Wynikiem ma być rozłączny
  allowlist i macierz deck/document/sheet positive oraz false-positive cases.

### CHAT-002 — attachment, URL i citation provenance

- Status: `PARTIAL`, P0; zależność: CHAT-001.
- DoD: upload i URL mają accepted/failed states; cytowanie otwiera exact source;
  refresh zachowuje link; denied tenant nie odczytuje źródła.

### CHAT-003 — proposal-first action

- Status: `PARTIAL`, P0; zależność: CHAT-001.
- DoD: AI nie mutuje przed approve; approve/reject są audytowane; replay approval
  nie duplikuje skutku.

### ORG-001 — kanoniczny context snapshot

- Status: `PARTIAL`, P0; owner: Organization lane.
- Zakres: document -> claim proposal -> approve -> immutable snapshot; Teresa
  otrzymuje snapshot ID i source refs.
- DoD: conflict/source-delete semantics; tenant/confidentiality negatives; Chat
  czyta zatwierdzony snapshot, nie robocze claims.

### ORG-002 — jedna mapa sekcji i ownerów

- Status: `READY`, P1; zależność: ORG-001.
- DoD: profiles/context/claims/KG mają po jednym writerze i canonical deep link;
  wariant usuwa dopiero CLEAN-003.

### MYW-001 — Inbox bez niewidocznego fallbacku

- Status: `PARTIAL`, P0; owner: My Work lane.
- DoD: materialize -> triage -> task -> close -> cold reload; origin/source ID
  readback; tenant negative; fallback counter zero.

### MYW-002 — Decisions, Notebook i Ideas lineage

- Status: `PARTIAL`, P0; zależność: MYW-001.
- DoD: decision approve, notebook CAS/conflict/reload i idea conversion mają
  source_type/source_id, version i audit; desktop/mobile proof.

### AGT-001 — jeden widoczny model Transformation Case

- Status: `PARTIAL`, P0; owner: Agent lane.
- Zakres: normalny Agent używa `transformation_cases`; legacy Archive/Plans i
  `/zlecenia` nie są writerami w MVP.
- DoD: create -> reload -> ten sam ID; brak UUID/raw enum/`NOT_CONNECTED` dla
  użytkownika; diagnostics tylko operator.

#### AGT-001-G01 — rozmowa z Teresą tworzy i otwiera ten sam Transformation Case

- Status: `DISCOVERY_REQUIRED`, P0; task: `AGT-001-T01`; klasyfikacja:
  `MISWIRED` + `RUNTIME_UNPROVEN`; owner danych: `transformation_cases` przez
  `TransformationCasesApi`, bez zapisu do `case_core` ani `ai_agent_plans`.
- Requirement: Agent ma pozwalać zbudować flow automatycznie w rozmowie z
  Teresą, a wynik rozmowy i ręczny builder muszą być projekcjami jednego Case i
  jednego Plan (`docs/product/AGENT_HUB_UI_CONTRACT_V1.md`).
- AS-IS: kanoniczny `src/components/AIChat/UnifiedChatPanel.tsx` nie importuje
  `TransformationCasesApi`, nie rozpoznaje intencji planu i nie obsługuje
  brakujących pól intake. Test
  `tests/components/AIChat/UnifiedChatPanel.helpers.test.ts` odwołuje się do
  nieistniejących eksportów `transformationIntakeMissingLabels`,
  `transformationCaseReadyMessage` i `resolveWorkspaceArtifactKind`.
- Recovery evidence: niekanoniczny commit `fec04bc5e` zawiera działający szkic
  `detectTransformationPlanIntent -> startPlanningIntake -> answer -> convert`
  oraz deep link z zakodowanym `transformationCaseId`; commit `3977b36b4`
  zawiera resolver kontekstu Deck Builder. Oba fragmenty są kandydatami do
  chirurgicznego diffu, nigdy do merge całego brancha.
- TO-BE minus AS-IS: normalna rozmowa tworzy tenant-scoped intake, prosi tylko o
  brakujące pola, konwertuje dokładnie raz do `transformation_cases` i otwiera
  ten sam ID w `/my-work?tab=agent`; ręczny Agent widzi tę samą wersję planu.
- Następny krok discovery: porównać szkice z aktualnym stream/send pipeline,
  wskazać minimalny allowlist Chat + transformation API i rozstrzygnąć, czy
  intake działa przed czy po server-stream confirm. Odpowiedź ma zawierać mapę
  symboli, request/response, zapis DB i listę konfliktów ze współczesnym Chat.
- Wymagany proof po implementacji: intent positive/negative; incomplete intake;
  Unicode/query encoding; stale/replay; tenant denial; create -> readback ->
  cold reload w Chat i Agent; normalny desktop/mobile browser bez query flag.
- Pakiet: `docs/cleanup/execution-packets/AGT-001-T01.md`; status
  `READY_SERIAL_INTEGRATOR / PREFLIGHT_REQUIRED` na baseline `756d904c4`.

### AGT-002 — Teresa i człowiek edytują jeden Plan

- Status: `PARTIAL`, P0; zależność: AGT-001.
- Zakres: persisted collaboration mode, wspólna wersja, semantic diff,
  proposal-first AI i human edit.
- DoD: cztery tryby mają trwały kontrakt; stale version daje conflict; approve
  tworzy jedną wersję i audit.

### AGT-003 — jeden wykonywalny etap i artefakt

- Status: `EVIDENCE_MISSING`, P0; zależność: AGT-002, MAT-001.
- DoD: approved stage -> owning-module write -> idempotent retry -> result i
  editable artifact; cold reopen otwiera oba.

### INT-001 — jeden canonical Interview API/client

- Status: `PARTIAL`, P0; owner: Interview lane.
- Zakres: owner legacy/v4/V8, jawne adaptery, invitation lifecycle, autosave/CAS
  i immutable answer lineage.
- DoD: create/version/publish -> invite -> external resume/submit -> review/
  send-back/approve; expiry/revoke, anonymous wall, tenant/role negatives.

### INT-002 — insight i kontrolowany handoff

- Status: `EVIDENCE_MISSING`, P0; zależność: INT-001.
- DoD: answer refs -> insight -> handoff receipt -> jeden downstream ID; retry
  zachowuje cardinality 1.

### TLS-001 — Dynamic SWOT jako jedyny tool MVP

- Status: `PARTIAL`, P0; owner: Tools lane.
- DoD: create/reopen/CAS -> review/send-back/approve -> immutable non-empty
  output -> canonical report -> one initiative; race/replay/tenant negatives.

### TLS-002 — migracje zamiast runtime DDL

- Status: `PARTIAL`, P0; zależność: TLS-001.
- DoD: DDL przeniesiony do migracji; canonical output/report reads; fresh i
  upgrade PostgreSQL; runtime DB role bez DDL rights.

### TLS-003 — bramka dla kolejnych narzędzi

- Status: `READY`, P2; zależność: TLS-001.
- DoD: każdy tool ma osobny task, non-empty builder, output assertions i golden
  browser flow; katalog nie jest hurtowo uznany za gotowy.

### ASM-001 — DRD jako jeden Assessment MVP

- Status: `PARTIAL`, P0; owner: Assessment lane.
- DoD: jeden methodology/version owner; start -> evidence/answers -> CAS ->
  freeze -> immutable report -> reopen; brak silent workflow-v2 fallback.

### ASM-002 — migracje zamiast runtime DDL

- Status: `PARTIAL`, P0; zależność: ASM-001.
- DoD: ordered fresh+upgrade migrations; golden flow działa z rolą bez DDL.

### ASM-003 — report link i initiatives batch

- Status: `PARTIAL`, P1; zależność: ASM-001.
- DoD: brak redirect race, server origin filter, batch z immutable lineage;
  retry nie duplikuje Initiative.

### INI-001 — idempotentna Initiative i governance

- Status: `PARTIAL`, P0; owner: Initiatives lane.
- DoD: candidate-to-initiative cardinality 1; concurrent accept/retry, CAS,
  role transitions, cancel/reversal, audit i cold reopen.

### INI-002 — dokładnie jeden handoff receipt

- Status: `EVIDENCE_MISSING`, P0; zależność: INI-001, EXE-001.
- DoD: approved Initiative -> scheduled handoff -> jeden Execution ID; replay i
  network retry nie duplikują.

### EXE-001 — one-handoff-one-execution-case

- Status: `PARTIAL`, P0; owner: Execution lane.
- Zakres: inicjatywy w realizacji jako karty; work/resource/control/report
  writeback; jeden health model i jawne blocked states.
- DoD: incoming handoff -> karta -> zmiana -> cold reload; role/tenant negatives.

### EXE-002 — delivery evidence zamiast task status

- Status: `EVIDENCE_MISSING`, P0; zależność: EXE-001.
- DoD: completed task bez evidence nie zamyka delivery; approved evidence robi
  jeden downstream Results write.

## Fala 2 — artefakty, control plane i Results

### MAT-001 — Document Studio real flow

- Status: `PARTIAL`, P0; owner: Materials DOC lane.
- Gap `MAT-001-G01` (`MISWIRED`): backend, route, client i typy nadal realizują
  sześć scope'ów AI edit, w tym `transformative`, a obowiązujący plan produktu
  wymaga dla niego explicit confirmation. Historyczny host
  `DocumentStudioEditorPanel` i `TransformativeConfirmDialog` usunięto w
  `d1d4f4d0e` jako zero-import, ale nie wskazano nowego hosta. Testów
  `TransformativeConfirmDialog*.test.tsx` nie wolno ani usuwać jako stale, ani
  zazielenić przez odtworzenie martwego panelu. Task ma podłączyć sześć scope'ów
  do aktualnego kanonicznego edytora, zachować proposal-first, blast-radius
  confirmation, focus return, diff i approval; dopiero potem historyczne testy
  zostaną przeniesione na nowy host i stare pliki otrzymają `SUPERSEDED` z
  recovery commit `d1d4f4d0e`.
- DoD: create/edit/version/reopen/export editable DOCX; provenance, stable link,
  four-eyes, real provider i visual desktop/mobile; wszystkie sześć scope'ów
  osiągalne z aktualnego UI, a `transformative` wymaga jawnego potwierdzenia i
  zwraca fokus do triggera po Cancel/Escape/Continue.
- Pakiet: `docs/cleanup/execution-packets/MAT-001-T01.md`; status
  `READY_SERIAL_INTEGRATOR / PREFLIGHT_REQUIRED` na baseline `88db01dc0`.

### MAT-002 — Presentation real flow

- Status: `PARTIAL`, P0; owner: Materials PPT lane.
- Gap `MAT-002-G01` (`MISSING_CODE`), task `MAT-002-T01`: template intake test z `0f9f98cfc` wymaga
  dostępnego briefu, typed required variables i przesłania lineage/facts.
  Bieżący `PrezentacjeView` z `6a397b2448` tworzy deck automatycznie, a
  `POST /presentations/decks/from-template` nie waliduje ani nie materializuje
  `brief`/`variableValues`. To zadanie produktowe, nie naprawa harnessu.
- DoD: create/edit/version/reopen/export PPTX; template approval, autosave title,
  lineage i render visual.
- Pakiet: `docs/cleanup/execution-packets/MAT-002-T01.md`; status
  `READY_SERIAL_INTEGRATOR / PREFLIGHT_REQUIRED` na baseline `88db01dc0`.

### MAT-003 — Spreadsheet real flow

- Status: `PARTIAL`, P0; owner: Materials XLS lane.
- DoD: workbook/sheet/formula/format/version/reopen/export XLSX; formuły po
  roundtrip i preview zgodny z plikiem.

### MAT-004 — library/launcher i retirement

- Status: `BLOCKED` przez MAT-001/002/003 i CLEAN-002.
- DoD: jeden launcher/canonical deep links; stare Studio/Wizard usuwane dopiero
  po recovery verdict.

### ADM-001 — machine-readable capability matrix

- Status: `PARTIAL`, P0; owner: Admin lane.
- Zakres: route/action -> role/capability -> org scope -> audit event; rozdzielić
  Tenant Admin i SuperAdmin.
- DoD: invite/accept/role/revoke oraz cross-org, last-admin, stale-role i
  no-capability negatives z DB audit readback.

### SET-001 — registry ustawień

- Status: `PARTIAL`, P0; owner: Settings lane.
- Zakres: control -> owner -> scope -> storage -> effect -> secret rule; hide
  no-op, bez symulowania sukcesu.
- DoD: profile/language/theme/notifications/AI save/reload/new session; forced
  policy locked; sekret nie wraca z API.

### SET-002 — security-sensitive flows

- Status: `EVIDENCE_MISSING`, P1; zależność: SET-001, ADM-001.
- DoD: OAuth/calendar, MFA, export i deletion z re-auth, audit, cross-user
  negatives, mobile/a11y.

### RES-001 — deployment cutover KPI/ROI/OKR

- Status: `PARTIAL`, P0; owner: Results integrator.
- DoD: trzy VNext flags w demo config; normalny signed-in route otwiera KPI/ROI/
  OKR bez query/localStorage; disabled shell niemożliwy; rollback opisany.

### RES-002 — KPI golden flow

- Status: `EVIDENCE_MISSING`, P0; zależność: RES-001.
- DoD: current definition -> observation -> deviation -> action -> effectiveness;
  scorecard fixture, stale/self-approval/tenant/append-only negatives.

### RES-003 — ROI golden flow

- Status: `EVIDENCE_MISSING`, P0; zależność: RES-001.
- DoD: baseline -> approval snapshot -> actual -> variance -> PIR; precision,
  stale/self-approval/tenant/append-only negatives.

### RES-004 — OKR golden flow

- Status: `EVIDENCE_MISSING`, P0; zależność: RES-001.
- DoD: policy/cycle/set -> objective/KR -> check-in -> review/reflection; current
  pointer, not-calculable, role/tenant i immutable history.

## Fala 3 — świadomie poza podstawowym MVP

### FIN-001 — bridge/backfill i jedna przestrzeń ID

- Status: `BLOCKED`, P1; owner: Finance integrator.
- DoD: legacy/v2/v3 inventory, deterministic bridge, unresolved report, ADR
  canonical generation; 100% aktywnych demo records mapped lub jawnie unresolved.

### FIN-002 — pięć canonical workspaces

- Status: `BLOCKED` przez FIN-001.
- DoD: statement/baseline/prediction/analysis/valuation create-update-approve-
  reopen; utilities tylko z real IDs; precision/RLS/tenant/fresh+upgrade/browser.

### FIN-003 — Results ROI reconciliation

- Status: `BLOCKED` przez FIN-001 i RES-003.
- DoD: jeden owner pól economics; reconciliation report bez nieopisanych różnic.

### AUD-001 — uczciwy base CRUD beta

- Status: `PARTIAL`, P1; owner: Audits lane.
- DoD: route/menu/API mają jeden status; create/save/reopen/delete program i
  role/tenant proof; bez obietnicy pełnego lifecycle.

### AUD-002 — jeden full lifecycle owner

- Status: `BLOCKED` przez AUD-001 i decyzję post-MVP.
- DoD: jeden owner `/api/audit` i `/api/audits`; pack rights, segregation of
  duties, criterion-to-closure, effectiveness i handoff.

### MTG-001 — Meeting/Minutes contract

- Status: `CODE_CONNECTED / REALDB_GREEN / BROWSER_EVIDENCE_MISSING`, P1;
  owner: Meeting lane.
- Atomowy pakiet: `docs/cleanup/execution-packets/MTG-001-T01.md`, status
  `CODE_CONNECTED / REALDB_GREEN / BROWSER_EVIDENCE_MISSING`.
- Odzyskany kandydat: trzy commity `baeaad452..2d0e6d8da` zawierają lifecycle,
  role, notes, proposal-first task/decision outputs, CAS i reconciliation.
  Został przeniesiony modułowo na aktualny M12 CRUD w `0bfc48721`; recovery ref
  pozostaje chroniony, ale funkcjonalność jest już reprezentowana w kanonie.
- DoD: create -> agenda/materials -> notes -> proposed summary -> approve ->
  one decision + task + material -> cold reopen; consent/retention/tenant proof.

### PRT-001-CANONICAL-API — jeden V8 partner contract

- Status: `PARTIAL`, P2; owner: Partner lane.
- DoD: wszystkie acceptance reads/writes używają partner scope; zero legacy
  fallbacku i demo seed-on-read; cross-partner/tenant denial.

### PRT-002-INDIVIDUAL-LEDGER — osoba, attribution i commission truth

- Status: `POST_MVP`, P2; zależność: PRT-001.
- DoD: `participant_type`, osobny individual ledger, versioned commission rule,
  retry/concurrency cardinality, correction/reversal audit i brak kolizji org.

### PRT-003-GOLDEN-FLOW — referral-to-payout

- Status: `POST_MVP`, P2; zależności: PRT-001/002.
- DoD: register -> certificate -> code -> attributed sale -> commission ->
  payout, cold reopen, expiry/currency/correction/isolation negatives.

## Macierz współbieżności

Równolegle: `CHAT-*`/`ORG-*`; `MYW-*`/`AGT-*`; osobno `INT-*`, `TLS-*`,
`ASM-*`; osobno `INI-*`/`EXE-*`; `MAT-001/002/003`; `RES-002/003/004` dopiero
po RES-001; `ADM-*`/`SET-*` z jednym ownerem policy boundary.

Nie wolno równolegle edytować `AppRoutes`, route config, sidebar/menu config,
global flag resolvers, migrator/ledger, shared API barrel, global CSS/tokens ani
deployment config. Te pliki ma integrator fali.

## Wspólna brama `DONE`

1. baseline/final SHA i czysty status;
2. reviewed changed-file allowlist i `git diff --check`;
3. focused unit/component/API;
4. fresh i upgrade PostgreSQL dla persistence;
5. replay/stale-version/role/tenant negatives;
6. normalny route bez query/localStorage aktywacji;
7. demo służące dokładnie z final SHA;
8. signed-in desktop/mobile trace i network/console verdict;
9. visual verdict: Consultify tokens, typography, density, loading/empty/error,
   brak technicznych enumów i UUID;
10. downstream handoff oraz rollback/recovery path.

## Kolejność uruchomienia agentów

1. CLEAN-001 i CLEAN-002; integrator nie zmienia funkcji produktu.
2. CHAT-001, ORG-001, MYW-001, AGT-001, INT-001, TLS-001, ASM-001, INI-001 i
   EXE-001 w rozłącznych worktree.
3. Następcy dopiero po dowodzie poprzednika, nie po deklaracji agenta.
4. Materials/control plane, potem Results cutover.
5. Finance/Audits/Meeting/Partner zgodnie z falą 3.
6. REL-001, pełne gates oraz demo/browser/visual na jednym finalnym SHA.
