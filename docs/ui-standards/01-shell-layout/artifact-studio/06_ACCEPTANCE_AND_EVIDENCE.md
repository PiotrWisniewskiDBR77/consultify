# Artifact Studio — Acceptance and Evidence Standard

Status: `APPROVED_SPEC / RUNTIME_PARTIAL`
Scope: wspólny shell oraz adaptery DOC, PPT i XLSX dla otwartego artefaktu
Out of scope: tworzenie, stosowanie i administrowanie template'ami

## 1. Cel dokumentu

Ten dokument definiuje warunki przejścia od planu Artifact Studio do dokumentacji wykonawczej, implementacji, migracji legacy i release. Obowiązuje wspólnie dla DOC, PPT i XLSX.

Żadna bramka nie może zostać zaliczona na podstawie samej obecności kodu, komponentu, endpointu, mocka, testu jednostkowego, lokalnego buildu ani screenshotu. Akceptacja wymaga dowodu odpowiedniego do ryzyka: kontraktowego, runtime, wizualnego, accessibility, realDB, governance i eksportowego.

## 2. Definicje werdyktów

### PASS

`PASS` oznacza, że:

- wszystkie wymagania danej bramki zostały spełnione na aktualnym SHA;
- wymagane testy rzeczywiście się uruchomiły i zakończyły powodzeniem;
- dowody są jednoznacznie powiązane z wersją kodu, środowiskiem i scenariuszem;
- nie istnieje otwarty blocker P0 ani niewyjaśniona sprzeczność z kanonem;
- wynik runtime potwierdza zachowanie, a nie tylko wygląd lub istnienie pliku.

### FAIL

`FAIL` oznacza, że:

- wymaganie zostało sprawdzone i zachowanie jest niezgodne z kontraktem;
- test uruchomił się i wykrył błąd;
- istnieje blocker P0;
- implementacja narusza decyzję właścicielską lub twardy zakaz architektoniczny;
- eksport, permission, audit, recovery albo migracja legacy daje wynik błędny.

### EVIDENCE_MISSING

`EVIDENCE_MISSING` oznacza, że:

- capability może istnieć, ale nie ma wymaganego dowodu;
- test nie został uruchomiony, nie wystartował albo jego wynik jest niejednoznaczny;
- screenshot lub raport nie jest powiązany z aktualnym SHA;
- brak realDB, runtime, visual, accessibility lub export proof wymaganych przez bramkę;
- nie można odróżnić wyniku mock/demo od zachowania produkcyjnego.

`EVIDENCE_MISSING` nie jest `PASS`. Suite, który nie wystartował, jest `EVIDENCE_MISSING` albo `FAIL` zależnie od przyczyny, nigdy `PASS`.

### NOT_APPLICABLE

`NOT_APPLICABLE` jest dozwolone wyłącznie z pisemnym uzasadnieniem wskazującym format, capability i decyzję kanoniczną. Nie może służyć do omijania P0.

## 3. Nienaruszalne decyzje architektoniczne

Każde naruszenie poniższych zasad jest blockerem P0:

1. Menu 1 pozostaje bez zmian względem standardu całej aplikacji Consultify.
2. Menu 2 jest jedną linią funkcji całego artefaktu.
3. Menu 3 jest dynamiczne i zależne od formatu oraz zaznaczenia.
4. Istnieje dokładnie jeden przełączalny lewy panel.
5. Prawa strona jest przeznaczona wyłącznie dla standardowej globalnej Teresy.
6. Menu 3 nie zawiera stałego przycisku ani grupy Teresa/AI.
7. Istniejący globalny shortcut Teresy w bottom barze zostaje zachowany.
8. Context handoff przekazuje zaznaczenie do tej samej globalnej rozmowy z Teresą.
9. Nie powstają lokalne chaty, `AI Editor`, asystent tabeli ani wybór agenta.
10. Template'y są całkowicie poza zakresem.
11. Istnieje jeden kanoniczny proces eksportu.
12. Save, lifecycle, review, approval, QA i export pozostają osobnymi stanami.
13. Menu 3, context menu i skróty korzystają z jednego Command Registry.
14. Żadna krytyczna funkcja nie jest dostępna wyłącznie przez hover albo prawy przycisk myszy.

## 4. P0 blockers

Release oraz przejście do następnej bramki są zablokowane, jeśli występuje choć jeden z poniższych warunków:

- zmiana Menu 1;
- Menu 2 zawinięte do drugiego wiersza przy wspieranym viewporcie;
- więcej niż jeden lewy panel lub równoległy lokalny outline;
- dowolna lokalna powierzchnia po prawej poza Teresą;
- stała akcja Teresa/AI w Menu 3;
- brak bottom shortcut Teresy;
- dwa niezależne handlery tej samej komendy;
- manualny `Save` lub `Save As` konkurujący z autosave/Duplicate/Export;
- wiele konkurencyjnych przycisków Download/Export;
- brak backendowego permission enforcement;
- public link dla klasyfikacji innej niż `Public`;
- approval niezwiązany z konkretną wersją;
- self-approval w formalnym workflow wymagającym approval;
- final publish/export przy krytycznym QA albo braku wymaganego approval bez uprzywilejowanego, audytowanego override z uzasadnieniem;
- draft export bez jednoznacznego oznaczenia `DRAFT`;
- zmiana AI bez preview/diff, accept/reject, snapshotu i undo;
- refresh danych bez impact preview i last-good recovery;
- QA bez realnych findingów, lokalizacji i rerun;
- restore nadpisujący historię zamiast tworzyć nową wersję;
- nierozwiązany save conflict bez ścieżki compare/resolve;
- template components, routes, endpoints lub menu w zakresie Artifact Studio;
- aktywna ścieżka XLSX nadal zależna od osobnego legacy shellu;
- eksport, którego wynik nie został otwarty i zweryfikowany;
- usunięcie legacy przed przejściem Legacy Removal Gate.

## 5. Bramki G0–G8

### G0 — Scope and Owner Decisions

Wymagane:

- zamrożona obietnica produktu: managed AI workspace z solidną ręczną korektą;
- potwierdzone trzy sposoby pracy: Teresa, Gamma-like i manual/Office-like;
- zamrożone P0/P1/OUT;
- template'y jawnie OUT;
- brak otwartych decyzji właścicielskich wpływających na P0;
- każda capability ma scenariusz biznesowy.

Dowód:

- decision register;
- capability register;
- lista OUT;
- jawne owner approvals albo delegowane rozstrzygnięcia.

Warunek PASS: 100% capabilities P0 ma właściciela produktu i jednoznaczny zakres.

### G1 — Information Architecture

Wymagane:

- Menu 1 bez zmian;
- jedna linia Menu 2;
- dynamiczne Menu 3;
- jeden przełączalny lewy panel: Structure, Properties, Sources & Data, Comments & Review, QA, History, Information;
- prawa strona wyłącznie Teresa;
- bottom bar dla pozycji, widoku, async jobs i istniejącego shortcutu Teresy;
- reguły overflow i responsywności;
- każda istniejąca kontrolka oznaczona `KEEP`, `MOVE`, `MERGE` albo `REMOVE`.

Dowód:

- cross-format IA map;
- ownership matrix;
- inventory DOC/PPT/XLSX;
- viewport layouts 1280, 1440 i 1920 px.

Warunek PASS: brak orphan actions, duplikatów ownera i elementów NO-GO.

### G2 — Capability and Command Contract

Wymagane dla każdego P0:

- stabilny command ID;
- context i selection contract;
- permission;
- enabled/disabled reason;
- state transitions;
- success/error/recovery;
- undo semantics;
- audit requirement;
- endpoint/service owner;
- format adapter, jeśli operacja jest domenowa.

Dowód:

- machine-readable lub parser-valid command matrix;
- schema tests;
- contract tests;
- cross-format parity report.

Warunek PASS: Menu 3, context menu i shortcut wskazują ten sam handler semantyczny, a adaptery nie spłaszczają modeli DOC/PPT/XLSX.

### G3 — Interaction and State Contract

Wymagane stany:

- no selection;
- text/object/table/chart/image selection;
- multi-selection;
- loading, empty, disabled, permission denied, error;
- autosave: saving/saved/error/conflict;
- lifecycle: draft/in review/approved/final;
- review i approval;
- QA: not run/running/pass/fail/blocked;
- AI proposal: requested/generating/proposal/accepted/rejected/applied/undoable/failed;
- data refresh: current/stale/refreshing/impact preview/applied/rejected/failed;
- export: configure/queued/generating/ready/failed;
- async job: queued/running/needs attention/completed/failed/cancelled.

Dowód:

- state diagrams;
- clickable state prototype;
- error and recovery scenarios;
- keyboard paths.

Warunek PASS: żadna ścieżka P0 nie zależy od interpretacji implementatora ani happy path only.

### G4 — Cross-Format Prototype and Transfer Test

Wymagane:

- jeden porównywalny case biznesowy w DOC/PPT/XLSX;
- identyczne położenie wspólnych funkcji;
- sprawdzenie Structure, Properties, Sources & Data, Comments & Review, QA, History, Share, Export/Present, Teresa handoff, Undo i zoom/view;
- test na użytkownikach znających przynajmniej jeden produkt Office;
- rotacja formatu startowego, aby nie faworyzować DOC.

Progi PASS:

- minimum 85% zadań w drugim i trzecim formacie bez pomocy;
- mediana czasu znalezienia wspólnej powierzchni krótsza o minimum 25% w kolejnych formatach;
- minimum 90% uczestników poprawnie rozróżnia save, QA, review, approval i export;
- zero przypadków uznania draft exportu za final approval;
- użytkownik potrafi cofnąć zmianę ręczną i zaakceptowaną zmianę AI;
- użytkownik nie szuka lokalnego chatu po poznaniu globalnej Teresy.

Dowód:

- scenariusz i moderator guide;
- lista uczestników/profili bez danych wrażliwych;
- task-level results;
- click paths, czasy i błędy;
- nagrania lub obserwacje;
- issues i decyzje po teście.

### G5 — Shared Shell Pilot

PPT jest rekomendowanym pierwszym pilotem shellu.

Wymagane:

- wspólny shell działa w runtime;
- Menu 1 ma diff równy zero;
- Menu 2 pozostaje jedną linią;
- lewy panel jest pojedynczym kontenerem;
- Teresa jest jedyną powierzchnią po prawej;
- Menu 3 nie ma stałego AI/Teresa;
- bottom shortcut Teresy pozostaje;
- overflow, focus i responsive zachowują kontrakt;
- PPT Present działa;
- PPTX/PDF przechodzą export validation.

Dowód:

- current-SHA runtime recording;
- viewport screenshots;
- contract results;
- otwarte PPTX/PDF;
- Present runtime proof.

Warunek PASS: pilot potwierdza shell bez tworzenia formatowego wyjątku architektonicznego.

### G6 — DOC and XLSX Adapter Conformance

DOC wymagane:

- outline, rich text, tables, page controls, TOC;
- sources, review, QA, versions;
- DOCX/PDF export i round-trip evidence.

XLSX wymagane:

- sheets/grid, cell/range selection, formula bar;
- formuły i recalculation;
- data refresh i last-good recovery;
- charts związane z zakresem;
- XLSX export z zachowaniem formuł, references i formatów;
- brak aktywnego legacy `KimiWorkspaceShell`.

Wspólne:

- shared command contracts;
- permission i audit parity;
- failure/recovery;
- realDB scenarios;
- globalna Teresa.

Dowód:

- adapter conformance tests;
- runtime scenarios;
- realDB evidence;
- otwarte i zweryfikowane DOCX/PDF/XLSX;
- visual evidence.

Warunek PASS: oba adaptery realizują P0 bez redefinicji wspólnego shellu.

### G7 — Legacy Removal

Legacy można usunąć dopiero, gdy:

- nowa ścieżka pokrywa 100% P0;
- parity matrix jest kompletna;
- routes wskazują nowy shell;
- active-runtime import scan nie wykazuje legacy;
- telemetry/logi nie wykazują ruchu do legacy w uzgodnionym okresie;
- testy eksportu, recovery i permissions przechodzą;
- istnieje rollback plan;
- wykonano snapshot stanu przed usunięciem;
- legacy removal jest osobnym, audytowalnym pakietem.

Przed PASS legacy:

- pozostaje izolowane;
- nie otrzymuje nowych funkcji;
- nie może być kasowane przy okazji innego pakietu;
- nie stanowi kanonu produktu.

Dowód:

- route/import/reference scan before/after;
- telemetry summary;
- changed-files manifest;
- tests;
- rollback instructions;
- current-SHA runtime proof.

### G8 — Release Candidate

Wymagane:

- G0–G7 mają PASS;
- brak otwartych blockerów P0;
- pełny runtime pack DOC/PPT/XLSX;
- testy kontraktowe, visual, accessibility, realDB i export mają PASS;
- wymagane approvals dotyczą aktualnej wersji;
- każdy override jest uprzywilejowany, audytowany i uzasadniony;
- evidence bundle odpowiada aktualnemu SHA i środowisku release-like;
- known P1 gaps są jawne i nie podszywają się pod P0.

Warunek PASS: niezależny reviewer może odtworzyć wynik bez polegania na deklaracji implementatora.

## 6. Wymagane testy

### 6.1 Testy kontraktowe

Minimum:

- command schema validation;
- state transition tests;
- shared command parity DOC/PPT/XLSX;
- selection reference serialization;
- permission allow/deny;
- audit event emission;
- lifecycle/review/approval version binding;
- QA finding schema;
- AI proposal accept/reject/undo;
- data refresh impact/rollback;
- export job states;
- adapter conformance;
- route contract;
- brak template contracts w zakresie.

PASS wymaga rzeczywistego uruchomienia suite i zachowania surowego rezultatu.

### 6.2 Testy runtime

Dla każdego formatu należy wykonać:

1. otwarcie istniejącego artefaktu;
2. identyfikację statusu zapisu, lifecycle i klasyfikacji;
3. operację strukturalną;
4. ręczną korektę;
5. context menu;
6. przekazanie zaznaczenia do globalnej Teresy;
7. AI proposal: reject oraz accept/undo;
8. source/data trace;
9. comment/review/approval;
10. QA finding, jump, fix i rerun;
11. history/diff/restore;
12. draft export;
13. final export z blokadą;
14. privileged override;
15. successful final output;
16. błąd zapisu/exportu/refresh i recovery.

### 6.3 Testy wizualne

Wymagane viewporty:

- 1280 px;
- 1440 px;
- 1920 px;
- 1024–1279 px dla reguły lewy panel albo Teresa.

Wymagane stany:

- Menu 2 bez wrap;
- Menu 3 w kilku kontekstach i overflow;
- wszystkie tryby lewego panelu;
- Teresa zamknięta i otwarta;
- bottom bar i async job;
- loading/error/conflict;
- disabled z reason;
- long names i lokalizacja językowa;
- zoom i fit;
- brak overlap, clipping i poziomego toolbar scrolla.

Screenshot musi zawierać identyfikator scenariusza, viewport, format i SHA albo być jednoznacznie powiązany przez manifest.

### 6.4 Accessibility

P0 wymagania:

- pełna klawiaturowa ścieżka wszystkich krytycznych operacji;
- logiczny focus order Menu 2 → Menu 3 → left panel → canvas → bottom bar → Teresa;
- focus trap i powrót focusu w panelach/modalach;
- accessible names;
- tooltips dla ikon;
- context-menu key/Shift+F10;
- visible focus;
- obsługa zoom;
- kontrast;
- brak funkcji dostępnych wyłącznie przez kolor lub hover;
- minimum target size zgodne ze standardem aplikacji;
- screen-reader announcement dla save, error, QA i async job bez nadmiernego hałasu.

Dowód:

- automatyczny accessibility report;
- manual keyboard checklist;
- screen-reader smoke test;
- lista wyjątków z severity i ownerem.

### 6.5 RealDB i permissions

Mock/demo nie wystarcza dla:

- owner/editor/commenter/viewer/approver;
- share/revoke;
- classification;
- public link tylko dla `Public`;
- review i approval;
- QA override;
- versions/audit;
- sources/data lineage;
- export permissions.

Scenariusze realDB:

- dozwolona i niedozwolona operacja dla każdej roli;
- backend odrzuca niedozwoloną operację nawet po ręcznym wywołaniu endpointu;
- audit zapisuje actor, artifact, version, action, timestamp i reason, jeśli wymagany;
- edit po approval tworzy nową niezatwierdzoną wersję;
- revoke natychmiast zmienia efektywny dostęp;
- restore nie usuwa wcześniejszego audytu;
- Teresa nie otrzymuje danych szerszych niż użytkownik.

### 6.6 Export i artifact verification

Wymagane:

- DOC: DOCX i PDF;
- PPT: PPTX i PDF oraz Present runtime;
- XLSX: XLSX; PDF/print layout jest P1;
- draft oznaczony `DRAFT`;
- final publish/export blokowany zgodnie z QA/approval;
- privileged override audytowany;
- retry nie duplikuje ani nie uszkadza źródłowego artefaktu;
- eksport wskazuje dokładną wersję źródłową.

Weryfikacja nie kończy się na HTTP 200 lub obecności pliku. Każdy plik musi zostać:

- pobrany;
- otwarty odpowiednim parserem/aplikacją;
- sprawdzony pod kątem struktury i kluczowych treści;
- wyrenderowany lub wizualnie zweryfikowany, jeśli layout ma znaczenie;
- porównany z oczekiwanym artefaktem źródłowym;
- opisany w evidence manifest z formatem, rozmiarem, hashem/ID i SHA kodu.

XLSX dodatkowo wymaga potwierdzenia formuł, references, typów wartości, formatów i liczby arkuszy. PPTX wymaga slajdów, layoutów i edytowalności kluczowych obiektów. DOCX wymaga struktury, paginacji, tabel, TOC oraz header/footer tam, gdzie występują.

## 7. Transfer Test

Test wykorzystuje jeden wspólny case biznesowy reprezentowany jako DOC, PPT i XLSX. Format startowy jest rotowany między uczestnikami.

W każdym formacie użytkownik bez dodatkowego instruktażu ma:

- znaleźć nazwę, save status i lifecycle;
- przejść do elementu struktury;
- wykonać ręczną korektę;
- otworzyć Properties;
- prześledzić Source/Data;
- odpowiedzieć na komentarz i rozpocząć review;
- znaleźć QA finding;
- otworzyć History i Restore;
- znaleźć Share;
- uruchomić Export albo Present;
- przekazać selection do globalnej Teresy;
- wykonać Undo;
- zmienić zoom/view.

Progi PASS są określone w G4. Każde badanie zachowuje surowe wyniki oraz listę błędnych kliknięć. Pozytywna opinia estetyczna nie zastępuje transfer testu.

## 8. Evidence bundle

Każdy gate packet zawiera:

### Repository

- branch;
- HEAD SHA;
- dirty-worktree status;
- changed-files manifest;
- route map;
- component/import map;
- endpoint/service map;
- command registry map;
- legacy reference scan.

### Tests

- exact commands;
- start/end timestamp;
- environment;
- exit code;
- raw logs lub trwały raport;
- liczba passed/failed/skipped;
- uzasadnienie każdego skip.

### Runtime

- scenario ID;
- actor/role;
- data fixture lub realDB record IDs;
- expected i actual result;
- screenshots/video/logs;
- error/recovery evidence.

### Governance

- permission checks;
- audit events;
- review/approval version binding;
- overrides i uzasadnienia;
- classification/public-link proof.

### Artifacts

- pliki eksportowe;
- hashes/IDs;
- source version;
- parser/open/render results;
- visual verification.

### Verdict

- gate;
- `PASS`, `FAIL` albo `EVIDENCE_MISSING`;
- blockers;
- owner;
- current next gate;
- known P1 gaps.

## 9. Legacy Removal Gate

Legacy removal jest osobnym, ostatnim pakietem migracji, a nie częścią implementacji nowego shellu.

PASS wymaga:

- kompletnego P0 parity;
- nowych routes aktywnych;
- braku active-runtime imports do legacy;
- uzgodnionego okresu bez ruchu telemetrycznego do legacy;
- testów permissions, recovery i exports na nowej ścieżce;
- current-SHA runtime evidence;
- snapshotu przed usunięciem;
- jawnej listy usuwanych plików/routes/flags;
- rollback planu;
- testu po usunięciu;
- potwierdzenia, że usuwany kod nie jest współdzielonym adapterem domenowym.

Przed PASS legacy może zostać oznaczone deprecated i odcięte feature flagą, ale nie może zostać destrukcyjnie usunięte.

## 10. Finalna reguła akceptacji

Artifact Studio może otrzymać release verdict `PASS` wyłącznie wtedy, gdy:

- G0–G8 mają `PASS` na tym samym aktualnym SHA lub mają jednoznacznie powiązany łańcuch SHA bez zmian funkcjonalnych;
- nie ma blockerów P0;
- nie ma `EVIDENCE_MISSING` w wymaganiach P0;
- wszystkie trzy formaty przeszły testy kontraktowe, runtime, visual, accessibility, realDB i export;
- Transfer Test osiągnął progi;
- legacy zostało usunięte dopiero po przejściu dedykowanej bramki;
- niezależny reviewer potrafi odtworzyć werdykt z evidence bundle.

`READY_FOR_CODEX_REVIEW`, ukończony build, zielony mock, liczba zmienionych plików ani deklaracja implementatora nie są release approval.
