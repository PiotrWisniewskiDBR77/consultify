# Artifact Studio — stan implementacji i brakujące dowody

> Status programu: `IN_PROGRESS / NO_GO`
> Zakres: otwarte DOC, PPT i XLSX; template'y są `OUT`
> Snapshot kodu bazowego: branch `codex/sync-demo-20260729`, HEAD
> `4610ddb7de335071921435d265bb499ac2ac51e2`

## 1. Co zostało zaimplementowane

- wspólny rejestr komend z predykatami selection, permission i lifecycle;
- wspólne `ArtifactMenu3`, bottom bar oraz reguły arbitrażu paneli;
- rozszerzenie istniejącego `ExecutiveModuleShell`, bez tworzenia trzeciego
  równoległego shellu;
- flagi wdrożeniowe dla wspólnego shellu oraz adapterów DOC, PPT i XLSX;
- adapter Document Studio z jednym Menu 2, dynamicznym Menu 3 i bottom Teresą;
- adapter Presentation Studio z jednym Menu 2, dynamicznym Menu 3, bottom
  Teresą i Notes oraz bez lokalnego prawego raila;
- adapter Spreadsheet Studio pod flagą: lewy panel arkuszy, canvas z formułą,
  dynamiczne Menu 3 tylko dla realnych komend oraz globalna Teresa;
- jawny resolver tożsamości XLSX rozróżniający skoroszyt generowany, artefakt
  tabelaryczny i brak artefaktu; ścieżka błędu działa fail-closed zamiast
  otwierać pusty preview;
- wspólny evaluator polityki eksportu roboczego/finalnego;
- backendowe zabezpieczenie tenant isolation cache skoroszytów;
- jawne tryby draft/final eksportu DOC, PPT i XLSX oraz blokada finalnego eksportu
  przez wymagane bramki.
- headless workbook controller z wersjonowanym, serializowanym zapisem zmian;
- transakcyjny na poziomie komendy endpoint XLSX `POST /api/workbook/:id/commands`
  z `baseVersion`, `idempotencyKey`, walidacją całego batcha i odpowiedzią 409;
- append-only `generated_workbook_revisions`, lista rewizji oraz restore, który
  tworzy nowy head zamiast nadpisywać historię.
- zapis workbook head i odpowiadającej mu rewizji w jednej transakcji DB;
  niepowodzenie wpisu historii wycofuje również zmianę head.

Wszystkie nowe ścieżki pozostają za flagami. Legacy nie zostało usunięte.

## 2. Dowody wykonane lokalnie

| Warstwa                           | Polecenie / zakres                                                                                                     | Wynik                                             |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| TypeScript                        | `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`                                                              | PASS                                              |
| Build produkcyjny                 | `NODE_OPTIONS=--max-old-space-size=8192 npm run build`                                                                 | PASS, 10 295 modułów; 57,59 s                     |
| DOC + shell                       | testy Document Studio, rejestru komend i ExecutiveModuleShell                                                          | 27/27 PASS                                        |
| DOC mounted shell + rollback      | Playwright na lokalnym frontendzie/backendzie: shell V2 (jedno Menu2, jedno Menu3, jeden lewy panel, brak lokalnego prawego raila/AI Editor) oraz natychmiastowy powrót do legacy po wyłączeniu flag | 2/2 PASS, 46,6 s                                  |
| DOC mounted staging realDB reopen + export gate | utworzenie dokumentu w staging Postgres, otwarcie shellu V2, powrót do Materials i cold reopen tego samego `artifactId`; następnie rzeczywista próba draft DOCX | 1/1 PASS kontraktu; reopen PASS, eksport jawnie zatrzymany przez `TRIAL_EXPORT_DISABLED` (2026-08-09) |
| DOC mounted realDB draft DOCX/PDF | ponowne otwarcie utrwalonego dokumentu, rzeczywisty eksport `mode=draft`, inspekcja ZIP/OOXML DOCX (`word/document.xml`) oraz sygnatury i treści PDF | 1/1 PASS, 11,1 s (2026-08-09) |
| PPT mounted shell + rollback      | Playwright na lokalnym frontendzie/backendzie: shell V2 (jedno Menu2, jedno Menu3, jeden lewy panel, brak lokalnego prawego raila; bottom Teresa + Notes) oraz kill-switch do legacy | 2/2 PASS, 35,2 s                                  |
| XLSX mounted shell + rollback     | Playwright na lokalnym frontendzie/backendzie: pusty skoroszyt z realnego lokalnego API, shell V2 (jedno Menu2, jedno Menu3, jeden lewy panel, brak lokalnego prawego raila; bottom Teresa) oraz kill-switch do Kimi | 2/2 PASS, 31,2 s                                  |
| XLSX keyboard/context             | Playwright: zaznaczenie komórki, fokus klawiaturowy, `Shift+F10`, roving focus w menu, `Esc`, powrót fokusu do komórki | 3/3 cały plik PASS, 23,8 s                        |
| Transfer DOC → PPT → XLSX         | Playwright w jednej sesji i na trzech artefaktach z lokalnego API: to samo położenie Menu2/Menu3/lewego panelu/bottom Teresy, bez lokalnego prawego raila | 1/1 PASS, 44,6 s                                  |
| Cross-format pełny kontrakt       | 5 scenariuszy sekwencyjnie: macierz viewportów, canonical shell, DOC/PPT context menu przez pointer i `Shift+F10`, axe oraz jedna globalna Teresa | 5/5 PASS, 2,0 min (2026-08-09); równoległe fixture'y wymagają dalszej izolacji |
| Cross-format rollback + semantyka screen-reader | Izolowany frontend/backend na portach 3410/3411: DOC/PPT/XLSX V2 → legacy → V2 z zachowaniem identity; następnie landmarki `main`/`toolbar`, nazwane kontrolki i brak widocznych kontrolek bez accessible name | 2/2 PASS, 31,5 s (2026-08-09). To dowodzi rollback rehearsal i automatycznej semantyki; ręczny VoiceOver pozostaje `EVIDENCE_MISSING` |
| Globalna Teresa DOC → PPT → XLSX  | Playwright na świeżym frontendzie: jedna aktywna rozmowa jest zachowana, a kontekst ekranu zmienia się kolejno dla dokumentu, prezentacji i skoroszytu; bez tworzenia dodatkowych rozmów | 1/1 PASS w pełnym pliku, 20,6 s                   |
| Axe runtime DOC → PPT → XLSX      | Playwright + axe na zamontowanych studiach; brak naruszeń critical i serious                                                  | 1/1 PASS w pełnym pliku, 25,7 s                   |
| PPT/XLSX/shared                   | adaptery PPT/XLSX, grid, Menu 3 i flagi                                                                                | 14/14 PASS                                        |
| Shell 1280                        | ExecutiveModuleShell, w tym min. canvas PPT 760 px                                                                     | 13/13 PASS                                        |
| Backend governance                | export policy, workbook org guard, DOC/PPT export gates                                                                | 29/29 PASS                                        |
| Governance runtime DOC/PPT        | DOC QA/export oraz PPT: blokada eksportu `Confidential`, blokada share linku dla non-Public i poprawny share token dla `Public` | 4/4 PASS, 15,0 s (2026-08-09) |
| Governance approval DOC/PPT realDB | odrębny reviewer, zakaz self-approval, trwały cold read i append-only audit; DOC dodatkowo material edit oznacza approval jako stale i blokuje final export | 2/2 PASS; pełny pakiet realDB razem z eksportem DOC 3/3 PASS, 4,0 min (2026-08-09) |
| Governance XLSX staging realDB    | tenant-scoped klasyfikacja, obowiązkowe uzasadnienie downgrade, cold readback i append-only governance event przez publiczny endpoint audytu | 1/1 PASS, 1,7 s (2026-08-09); route unit 30/30 PASS |
| XLSX identity + adapter           | resolver dwóch originów, fail-closed, shell i realne komendy gridu                                                     | 6/6 PASS                                          |
| XLSX controller/client            | serializacja zapisów, inkrementacja wersji, adapter i identity                                                         | 10/10 PASS                                        |
| XLSX commands/revisions           | batch mutations, idempotency, 409, legacy cell, lista rewizji, restore-to-new-head oraz preserve/orphan komentarzy     | 21/21 PASS                                        |
| XLSX Historia UI/controller       | lista wersji, restore z optimistic baseVersion, odświeżenie schema i reset lokalnego undo/redo                         | 22/22 PASS                                        |
| Pakiet regresji Artifact Studio   | 19 plików: shared, DOC, PPT, XLSX, governance i routes                                                                 | 121/121 PASS                                      |
| Dostępność statyczna              | `npm run check:a11y-focus` na 107 zmienionych plikach                                                                  | PASS: 0 nowych `outline-none` bez `focus-visible` |
| PPT direct-create contract        | początkowy `deck_json` i zgodne stabilne card IDs                                                                      | 3/3 PASS                                          |
| PPT autosave/reload + Present realDB E2E | świeży frontend V2 + backend z nieprodukcyjnym staging Postgres: utworzenie decku, rename, autosave, hard reload, Present od aktywnego slajdu, Presenter, izolacja notatek i powrót Esc | 2/2 PASS, 17,9 s (2026-08-09) |
| PPT świeży eksport OOXML          | rzeczywisty `PptxPipelineService`: ponowne renderowanie po autosave, pierwszy lazy export bez wcześniejszego `export_path`, ZIP/OOXML i treść w `slide*.xml`; granica DB w tym teście jest mockowana | 3/3 PASS; razem z direct-create 6/6 PASS (2026-08-09) |
| PPT mounted realDB draft export   | zamontowany shell V2 + staging Postgres: create → rename → autosave → hard reload → `mode=draft`; sprawdzone nagłówki DRAFT, ZIP magic oraz semantyczna treść prezentacji w OOXML | 1/1 PASS, 56,4 s (2026-08-09) |
| PPT Present/Presenter             | start od aktywnego i pierwszego slajdu, notes isolation, Esc                                                           | 13/13 PASS razem z chip descriptors               |
| XLSX pełny pakiet regresji        | routes, adapter, controller, grid, revisions i eksport                                                                 | 81/81 PASS                                        |
| XLSX SQLite round-trip            | blank → value/formula → reopen → export → ExcelJS inspection                                                           | PASS: `A2=21`, `B2=A2*2`                          |
| XLSX mounted staging realDB round-trip | shell V2 + staging Postgres: blank → atomowa komenda z `baseVersion` → cold reopen → draft export → ExcelJS inspection | PASS: wersja `0→1`, `A2=21`, `B2=A2*2`, nagłówki DRAFT i ZIP/XLSX; pełny plik shellu wraz z rollbackiem, keyboard context i Teresą 5/5 PASS, 27,2 s (2026-08-09) |
| XLSX context menu + Teresa        | natywny prawy klik cell/range/row/column, wspólny command surface i jawny selection context z `versionId`              | 22/22 PASS                                        |
| Teresa → XLSX command contract    | realny workbook/version z kontekstu, jawny fenced mutation diff, zatwierdzenie przez wersjonowaną transakcję i fail-closed bez operacji | 93/93 PASS razem z routes workbook                |
| Teresa proposal card              | approval nie wykonuje zapisu; osobna jawna akcja Execute uruchamia zatwierdzony workbook proposal | 3/3 PASS |
| Teresa → XLSX staging realDB       | utworzenie realnego workbooka, proposal z wersjonowanym selection context, approve, Execute, cold readback, audit, undo i ponowny readback | 1/1 PASS, 25,6 s: wersja `0→1→2`, `A2: null→37→null`, audyt `proposal_created/approved/execution_completed/execution_undone` (2026-08-09) |
| XLSX UI — celowany pakiet         | shell, Menu 2/3, lewy panel, selection, komentarze, QA/źródła, historia, mutacje i przekazanie zaznaczenia Teresie      | 21/21 PASS; 24/24 z proposal card                 |

Zwykłe `npm run build` przekroczyło domyślny limit pamięci procesu Node około
4 GB. Ten sam build zakończył się powodzeniem z jawnym limitem 8 GB. Pozostają
ostrzeżenia Vite o dużych chunkach i jednoczesnych importach statycznych oraz
dynamicznych; są długiem wydajnościowym, nie błędem kompilacji.

Ostrzeżenia React `act(...)` w istniejących testach DOC nie zmieniają wyniku,
ale pozostają długiem testowym. Mocks i testy komponentowe nie są dowodem
runtime ani realDB.

Próba uruchomienia całego root `test:all` nadal trafia na istniejące, niezwiązane
z Artifact Studio czerwone testy m.in. Super Admin Legal i Threat Intelligence.
Nie są one zaliczone jako regresja tego pakietu ani ukryte jako PASS. Dowodem
bieżącej zmiany pozostają wyłącznie jawnie wymienione celowane zestawy. Frontend
`npm run type-check` (`tsc --noEmit`) zakończył się kodem 0. Celowany filtr
backendowego typechecku dla zmienionych plików nie zwrócił błędów; pełny
backendowy typecheck pozostaje czerwony na wcześniejszych błędach poza zakresem.

## 3. Stan bramek

- `CMD-01` — **VERIFIED** w zakresie kodu i testów.
- `SHELL-01` — **PARTIAL**: komponenty i responsywność 1280 potwierdzone;
  zamontowane DOC, PPT i XLSX potwierdzają jedną linię Menu 2, dokładnie jedno
  Menu 3, jeden lewy panel oraz brak lokalnego prawego raila. Wszystkie trzy
  adaptery mają też przećwiczony kill-switch do legacy. Brakuje pełnego
  keyboard context-menu runtime dla DOC/PPT/XLSX oraz axe runtime dla trzech
  formatów są potwierdzone. Pozostaje ręczny dowód z czytnika ekranu.
- `TER-01` — **PARTIAL**: jeden globalny mount jest wymuszony w adapterach,
  a XLSX przekazuje do niego jawne, wersjonowane zaznaczenie z menu prawego
  przycisku. Proposal zachowuje realny `workbookId`, `versionId`, arkusz,
  zaznaczenie i klasyfikację; zatwierdzenie strukturalnej propozycji wykonuje
  tę samą wersjonowaną, idempotentną transakcję workbook co ręczne komendy,
  a brak kontekstu lub operacji kończy się fail-closed. Systemowy prompt wymaga
  osobnego fenced mutation diff wyłącznie dla jawnej prośby o zmianę; karta
  proposal oddziela approval od późniejszej, jawnej akcji Execute. Zamontowane
  E2E potwierdza zachowanie jednej rozmowy przy przejściu DOC → PPT → XLSX oraz
  aktualizację kontekstu bez tworzenia nowych rozmów. Staging-realDB E2E
  potwierdza też proposal → approve → Execute → widoczną zmianę → audyt → undo
  z wersjami `0→1→2`; pełny zamontowany runtime proposal jest tym samym
  potwierdzony. Composer zachowuje tekst i załączniki po odrzuceniu transportu,
  a czyści je dopiero po skutecznym zakończeniu `onSend`; potwierdza to
  `EnhancedChatInput.teresa-error-toast.test.tsx` (4/4 PASS, 2026-08-09) oraz
  pełny type-check. Brakuje wyłącznie realnego wywołania modelu od promptu
  (środowisko nie ma skonfigurowanego providera).
- `GOV-01` — **VERIFIED**: evaluator i trasy eksportu są przetestowane;
  XLSX ma również trwałe pola klasyfikacji/lifecycle/approval, fail-closed
  endpoint zmiany governance oraz append-only zdarzenia audytowe. Obniżenie
  klasyfikacji wymaga uzasadnienia, a status finalny blokuje brak aktualnego
  approval i krytyczny QA. Staging-realDB potwierdza trwały zapis klasyfikacji,
  cold readback i odczyt append-only audit eventu. RealDB DOC/PPT potwierdza
  niezależnego reviewera, zakaz self-approval, trwały stan approval i audit;
  DOC potwierdza również stale approval po materialnej zmianie oraz blokadę
  finalnego eksportu bez approval aktualnej wersji.
- `DOC-01` — **PARTIAL**: autosave/optimistic lock, komentarze oraz eksport+QA
  przeszły E2E. Nowy shell przeszedł zamontowany test runtime, a ten sam test
  dowodzi natychmiastowego rollbacku do legacy po wyłączeniu flag. Dokument
  został również utworzony, otwarty i ponownie nawodniony z nieprodukcyjnego
  staging Postgres. Próba draft DOCX dotarła do rzeczywistego backendu, lecz
  organizacja stagingowa jest klasyfikowana jako trial i poprawnie otrzymała
  `403 TRIAL_EXPORT_DISABLED`. Niezależny write-enabled realDB harness wykonał
  następnie draft DOCX i PDF, sprawdził nagłówki trybu, rozpakował DOCX oraz
  potwierdził sygnaturę i semantyczną treść obu plików. Bramka pozostaje PARTIAL
  wyłącznie z powodu zależności od niezamkniętych bramek TER/GOV.
- `PPT-01` — **PARTIAL**: adapter, kontrakt bezpośredniego utworzenia decku,
  rename/autosave/hard reload oraz Present/Presenter przeszły twarde E2E bez
  `skip` na nieprodukcyjnym staging Postgres, w tym izolacja notatek i powrót
  Esc. Workflow approval przypina
  submit/approve/reject do niezmiennego identyfikatora wersji, a starsza
  akceptacja nie otwiera finalnego eksportu nowszej wersji. Integracyjny test
  eksportu uruchamia rzeczywisty pipeline PPTX, rozpakowuje wynikowy OOXML i
  potwierdza w XML treść prezentacji. Ten sam łańcuch przeszedł następnie w
  zamontowanym shellu na staging realDB: draft download ma jawne nagłówki DRAFT,
  prawidłowy kontener ZIP i oczekiwaną treść OOXML. Nagłówek eksportu jest teraz
  związany z niezmienną wersją treści `presentation_decks.version`, a zamontowany
  test realDB porównuje go z głową dokumentu po końcowym autosave. Zamontowany
  shell i kill-switch do legacy przeszły osobny test 2/2. Bramka nadal pozostaje
  PARTIAL wyłącznie z powodu zależności od niezamkniętych bramek TER/GOV.
- `XLSX-01` — **VERIFIED**: batch, wersjonowanie, undo/redo, stabilne sheet IDs,
  transformacja/orphaning anchorów, komentarze i restore-to-new-head mają testy.
  Przywrócenie wersji reaktywuje komentarze do odtworzonych arkuszy i oznacza
  jako odłączone kotwice usunięte przez restore. Kill-switch XLSX do Kimi
  przeszedł test E2E. Zamontowany shell na staging Postgres potwierdza też
  atomową zmianę wersji `0→1`, cold reopen tej samej wartości/formuły oraz
  świeży draft XLSX odczytany przez ExcelJS. Pełny sekwencyjny E2E potwierdza
  również szerszy audyt komend, zapis wielu arkuszy i stylów oraz cold reopen;
  regresja celowana przeszła 163/163 testy.
- `XLSX-02` — **PARTIAL**: działają selection cell/range/row/column,
  clipboard batch, struktura osi i arkuszy, formatowanie, freeze oraz
  find/replace. Lewy panel zawiera działającą Historię wersji z przywracaniem
  i synchronizacją wersji kontrolera. Natywny prawy klik otwiera Office-like menu dla dokładnego
  zaznaczenia, a `Przekaż Teresie` dołącza jawny context z arkuszem, adresem,
  surową wartością i `versionId`. SQLite round-trip potwierdza zapis wartości
  i formuły, reopen oraz świeży eksport XLSX odczytany przez ExcelJS. Backendowy
  proposal Teresy stosuje strukturalne operacje przez wersjonowaną transakcję
  workbook i zwraca wynikową wersję. Parser przyjmuje jawny fenced diff, surowy
  payload jest ukrywany w treści rozmowy, a proposal card wymaga osobnego
  approval i Execute. Zamontowany shell i rollback do Kimi przeszły test 2/2.
  RealDB/runtime potwierdza ręczną komendę, cold reopen, świeży eksport oraz
  zatwierdzoną mutację Teresy z audytem i undo do pierwotnej wartości. Dodatkowy
  E2E potwierdza dwa arkusze ze stylami, powiązanie źródła z zakresem przesunięte
  poprawnie po wstawieniu wiersza, audit command IDs, cold reopen i inspekcję
  wyeksportowanego OOXML przez ExcelJS. Prawdziwy rekord `tp_tables` otwiera się
  przez kanoniczną trasę Table Studio zamiast tworzyć pusty skoroszyt.
- `XFER-01` — **PARTIAL**: automatyczny transfer shellu DOC → PPT → XLSX jest
  potwierdzony w jednej sesji. Macierz runtime 1920/1440/1280/1024 przeszła
  12 montaży (3 formaty × 4 viewporty), potwierdzając jedną linię Menu 2,
  pojedyncze Menu 3, jeden lewy panel, brak lokalnego prawego panelu oraz
  użyteczny canvas. Axe runtime nie wykrył krytycznych ani poważnych naruszeń
  w żadnym formacie. Nadal brakuje badania zadaniowego z użytkownikami
  (cel 8/9 bez instrukcji) i ręcznego dowodu z czytnika ekranu.
- `LEGACY-01` — **PENDING**.

Maszynowym źródłem statusu jest `program-gates.json`. Skrypt
`scripts/testing/artifact-studio-program-gate.mjs` waliduje graf zależności,
zabrania statusu verified przy brakujących dowodach i nie pozwala przejść
terminalnej bramce, dopóki wszystkie bramki nie są verified. Opcja
`--require-complete` ma pozostać czerwona aż do
przejścia `LEGACY-01`.

## 4. EVIDENCE_MISSING — krytyczne

### Wspólne

- macierz runtime 1920/1440/1280/1024 jest potwierdzona dla DOC/PPT/XLSX
  (12/12 montaży); pozostaje ręczna ocena czytnikiem ekranu i test zadaniowy,
  których automatyczny responsive test nie zastępuje;
- DOC/PPT/XLSX: `Shift+F10`, menu kontekstowe, `Esc` i focus return są
  potwierdzone w zamontowanym runtime; axe runtime dla trzech formatów jest
  potwierdzone, a screen reader pozostaje wspólnym brakiem;
- realne wywołanie modelu od promptu globalnej Teresy; zachowanie tekstu i
  załączników po awarii transportu, proposal/approve/Execute/audit/undo na
  realDB, ciągłość jednej rozmowy i aktualizacja context chips między
  DOC/PPT/XLSX są już potwierdzone;
- szersza macierz realDB permissions, tenant isolation i conflict recovery poza
  potwierdzonymi ścieżkami approval, governance XLSX i eksportu;
- PPTX, XLSX oraz draft DOCX/PDF są sprawdzone treściowo po rzeczywistym
  eksporcie; staging entitlement nadal blokuje jeden wariant organizacji, ale
  nie jest już brakiem dowodu samego renderera i pobranych plików;
- badanie transferu użytkownika DOC → PPT → XLSX; automatyczny kontrakt
  rozmieszczenia jest już potwierdzony, ale nie dowodzi celu 8/9 bez instrukcji.

### XLSX — pozostała blokada dowodowa P0

- realDB E2E dla originów `generated_workbooks` i `tp_tables` jest potwierdzone;
  pierwszy przechodzi cold reopen i świeży eksport, drugi kanonicznie kieruje
  do istniejącego Table Studio;
- itemizowane QA, przejście z utrwalonego źródła do wskazanej komórki oraz
  granularne source-to-range mają dowód komponentowy i runtime/realDB;
- realDB E2E globalnej Teresy potwierdza structured proposal → approve → Execute →
  widoczną zmianę → audit → undo; pełny prompt przez providera modelu pozostaje
  `EVIDENCE_MISSING`, ponieważ lokalne środowisko nie ma skonfigurowanego klucza;
- pobrany XLSX ma potwierdzone wartości, formuły, style i kolejność wielu arkuszy
  w zamontowanym realDB E2E oraz inspekcji przez ExcelJS;
- audyt proposal/approve/execute/undo oraz granularnego source-to-range jest
  potwierdzony w runtime.

### Najnowszy dowód governance XLSX

- `PATCH /api/workbook/:id/governance` jest tenant-scoped, używa `baseVersion`
  i zwraca typowane blokady `CLASSIFICATION_DOWNGRADE_REASON_REQUIRED`,
  `WORKBOOK_APPROVAL_REQUIRED`, `WORKBOOK_QA_BLOCKED` oraz konflikt wersji;
- skuteczna zmiana zapisuje `generated_workbook_governance_events` z poprzednią
  i nową wartością, uzasadnieniem, wersją, użytkownikiem i organizacją;
- Menu 2 pokazuje rzeczywistą klasyfikację i lifecycle w jednej linii, a dialog
  blokuje Approved/Final bez aktualnej akceptacji;
- testy: `SpreadsheetArtifactStudio.test.tsx` **18/18 PASS**,
  `workbook-commands.routes.test.ts` **30/30 PASS**, staging-realDB governance
  **1/1 PASS** (odrzucenie bez uzasadnienia, zapis, cold readback i audit event),
  frontend i backend `tsc --noEmit` **PASS**.

### Usunięte blokady lokalnego harnessu

PPT direct-create zapisuje teraz początkowy `deck_json` i stabilne card IDs, a
autosave utrwala tytuł oraz `deck_json` atomowo pod optimistic CAS. Mock DB
respektuje brak dopasowania `UPDATE`, a wersja jest normalizowana liczbowo.
Twardy E2E montuje `deck-builder-mels-root`; rename przeżywa hard reload.

Trasy approval prezentacji używają teraz typu `presentation_version` i klucza
`deckId@updatedAt`. Submit, approve i reject operują na tej samej wersji, a
finalny PPTX/PDF ponownie odczytuje aktualne `updated_at` i fail-closed odrzuca
akceptację starszej wersji. Celowane testy tras oraz serwisu approval:
**26/26 PASS**. Frontendowy helper identyfikatora wersji ma dodatkowo **2/2
PASS**, eksport świeżego PPTX z inspekcją OOXML **3/3 PASS**, a połączony
mounted-runtime → staging-realDB → draft-PPTX → OOXML **1/1 PASS**.

W XLSX inicjalizacja SQLite nie używa już nieobsługiwanego `ADD COLUMN IF NOT
EXISTS`. Kolumny addytywne są migrowane niezależnie, dzięki czemu błąd jednej
istniejącej kolumny nie pomija kolejnych. Test golden round-trip tworzy realny
rekord, zapisuje wartość i formułę, otwiera go ponownie i inspektuje pobrany XLSX.

Do czasu wdrożenia tych fundamentów adapter XLSX ma pokazywać tylko realne
komendy. Obecność ikony lub generatora backendowego nie jest akceptacją.

## 5. Następna krytyczna ścieżka

1. Domknąć XLSX `tp_tables`, style/multi-sheet oraz granularne source-to-range.
2. Domknąć transport recovery i real-provider prompt Teresy.
3. Wykonać ręczny screen-reader i zadaniowy transfer 8/9.
4. Włączyć flagi kohortowo; obserwować minimum dwa stabilne okna wydaniowe.
5. Dopiero po `LEGACY-01 = verified` usunąć stare shelle i flagi.

## 6. Warunek końca programu

Program nie jest ukończony, dopóki:

- `node scripts/testing/artifact-studio-program-gate.mjs --require-complete`
  nie kończy się kodem 0;
- wszystkie widoczne komendy P0 mają handler, persistence, permissions, audit,
  recovery/undo i test;
- runtime i realDB potwierdzają trzy formaty na aktualnym SHA;
- rollback został przećwiczony;
- legacy zostało usunięte dopiero po wymaganym okresie stabilności.

Aktualna decyzja wydaniowa: **NO_GO**. Jest to status dowodowy, a nie ocena
jakości przygotowanej architektury.
