# Handover: program napraw UI 45 tabel — autonomiczny nadzór

Data rekonstrukcji: 2026-08-07 (Europe/Warsaw)  
Repozytorium: `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify`  
Gałąź głównego worktree: `codex/sync-demo-20260729`  
HEAD zweryfikowany: `4610ddb7de` (`fix(excel): avoid Teresa budget proxy timeout`)  
Zakres tej rozmowy: zarządzanie, delegowanie do Claude Sonnet 5, niezależne QA i status programu napraw UI 45 audytowanych tabel.

## 1. Projekt, moduł i źródła prawdy

Projekt to aplikacja Consultify. Ten wątek prowadzi program naprawczy 45 powierzchni tabelarycznych zgodnie z kanonem UI/UX (StandardTable, StandardPreview, Menu 1/2/3, KEBAB/PPM, geometria i live visual gates).

Nadrzędne dokumenty programu:

- `docs/ui-standards/evidence/table-audit-45-2026-08-05/REPAIR_MASTER_PLAN.md`
- `docs/ui-standards/evidence/table-audit-45-2026-08-05/REPAIR_STATUS.csv`
- `docs/ui-standards/evidence/table-audit-45-2026-08-05/ATOMIC_DEFECT_BACKLOG.csv`
- `docs/ui-standards/evidence/table-audit-45-2026-08-05/ATOMIC_PACKAGE_MAP.csv`
- kanony: `docs/ui-standards/TRIADA_KANON.md`, `docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md`, `docs/ui-standards/03-modules/KEBAB_MENU_STANDARD.md`

Podział fal z master planu:

- R00 — kontrakty i test harness;
- R01–R04 — wspólne prymitywy/standardy;
- R20–R28 — migracje modułowe;
- R22 — Consulting Tools T15–T20;
- R23 — Assessment T21–T24;
- końcowo pełna macierz 45 × 5, dwa viewporty 1440×900 i 1280×720, populated + empty tam, gdzie wymagane.

## 2. Oryginalny cel i kryteria akceptacji

### Cel biznesowy i produktowy

Ujednolicić 45 tabel Consultify tak, aby użytkownik otrzymywał przewidywalne, kanoniczne zachowanie list, podglądów, akcji wiersza, zaznaczenia zbiorczego i Menu 3. Naprawy mają zachować istniejące dane i przepływy biznesowe, a nie zastępować ich atrapami.

### Cel techniczny

- migrować powierzchnie do wspólnych prymitywów zamiast lokalnych klastrów UI;
- zapewnić pojedynczy klik → StandardPreview;
- zapewnić kanoniczne Details (80–140 słów, bez fabrykacji/sekretów) i Relations;
- zapewnić standardową selection column i `Menu3BulkRow`;
- usunąć duplikacje akcji i naprawić KEBAB/PPM/row geometry;
- testować atomowo, a pełne bramki uruchamiać przy odbiorze lub realnym ryzyku;
- zakończyć dopiero po live visual gates obu viewportów.

### Kryteria odbioru

- scoped tests PASS;
- lint: 0 errors (istniejące warnings są baseline, nie wolno ich mylić z regresją);
- typecheck PASS;
- `git diff --check` PASS;
- negative controls muszą faktycznie „gryźć” (mutacja realnego źródła powoduje czerwony test, potem plik przywrócony);
- niezależny odbiór Codexa, nie poleganie wyłącznie na raporcie wykonawcy;
- live visual gates 1440×900 i 1280×720 przed pełnym zamknięciem.

## 3. Model operacyjny i polityka tokenów

**CONVERSATION DECISION:** przez sześć dni obowiązuje oszczędna polityka tokenów.

- Większe kodowanie wykonuje Claude Sonnet 5 (lub najbliższy dostępny Sonnet).
- Opus może tylko koordynować Sonnetami, nie wykonywać dużego kodowania.
- Codex odpowiada za architekturę, atomizację, ownership, review, niezależne testy, integrację oraz ACCEPTED/REJECTED.
- Jedno konkretne polecenie dla Claude na cykl.
- Każde wejście do Claude Desktop maksymalnie 60 sekund: odczytaj stan, wykonaj co najwyżej jedną interakcję i zwolnij aplikację; nie czekaj tam na wynik.
- Jeden writer na dany zestaw plików.
- Jeśli Claude Desktop jest zajęty przez innego agenta, nie przerywać; wykonać read-only preflight poza aplikacją.
- Bez commit/push w tym programie.

Claude Desktop task używany dla tego programu: **`R00 Kontrakty i test harness`**, model Sonnet 5, zwykle effort High. Inne zadania Claude współdzielą aplikację; nie przejmować ich aktywnych tur.

## 4. Twarde ograniczenia i invariants

1. **Nigdy nie używać** `git reset`, `git checkout --`, `git clean`, `git stash` ani innych operacji niszczących.
2. Nie commitować i nie pushować bez nowej, jawnej zgody.
3. Worktree jest ekstremalnie brudny i współdzielony. Wszystkie obce zmiany są cudzą własnością.
4. Nie nadpisywać Finance, Excel, MyWork/Menu3 ani innych aktywnych przebudów.
5. Zachować maksymalnie jednego writera na zestaw plików.
6. Nie restartować wykonanych zadań i nie dublować zaakceptowanych pakietów.
7. Nie fabrykować relacji ani danych tylko po to, aby wypełnić UI.
8. Puste, kanoniczne Relations są prawidłowe, jeśli źródłowy rekord nie ma realnych pól relacyjnych.
9. `Assessment / Library` w starym audycie T20 oznacza aktualny live tab `list`/„Assessment” w `AssessmentHub.tsx`; `TemplateLibrary.tsx` to inny kreator kart i nie jest tą tabelą.
10. T21 Details w AssessmentHub są zamrożonym, zaakceptowanym kontekstem; naprawy T20 muszą je zachować.
11. Reports i Initiatives preview w AssessmentHub były poza zakresem T20 i muszą pozostać nietknięte.
12. Testy source-slice są używane świadomie dla ciężkich hubów, ale negative controls muszą sprawdzać realny plik.

## 5. Aktualny stan programu

### FACT — statusy

- R00: ACCEPTED.
- R01: ACCEPTED.
- R22: `ACCEPTED_PARTIAL`.
- W `REPAIR_STATUS.csv` R22 ma technicznie przyjęte T16–T19 oraz część T20; ostatni zapis w wątku zwiększył licznik do 8/8 dla odebranych atomów, ale nie oznacza zamknięcia całego R22.
- Live visual gates T16–T20 nadal pozostają do wykonania w 1440×900 i 1280×720.
- Pozostałe atomy T20 (głównie KEBAB/PPM/T08) są nadal otwarte.
- `ATOMIC_PACKAGE_MAP.csv` i `ATOMIC_DEFECT_BACKLOG.csv` nadal pokazują atomy jako `OPEN`; statusy atomowe nie zostały zsynchronizowane podczas tej rozmowy. To jest TODO, nie dowód braku wykonania.

### Technicznie odebrane pakiety

#### T16–T19 (R22)

- T16 — Discovery Tools session preview Details P25.
- T17 — Outputs preview Details P25.
- T18 — Reports preview Details P25; poprawiono routing live `outputs` na podstawie `outputKind`.
- T19 — Consulting Tools / Initiatives preview Details P25.
- Niezależny wspólny test T17+T18+T19: **242/242 PASS**.
- Pozostały live visual gates obu viewportów.

Istotne pliki:

- `src/components/DiscoveryTools/ToolSessionPreviewV3.tsx`
- `src/components/DiscoveryTools/toolSessionDetailsBuilder.ts`
- `src/components/DiscoveryTools/__tests__/ToolSessionPreviewV3.details.test.tsx`
- `src/components/Discovery/DiscoveryToolsHub.tsx`
- `src/components/Discovery/outputPreviewDetails.ts`
- `src/components/Discovery/reportPreviewDetails.ts`
- `src/components/Discovery/toolInitiativePreviewDetails.ts`
- odpowiadające testy w `src/components/Discovery/__tests__/`

#### T20 / T21 — Assessment

T21 wcześniej dostarczył kanoniczne Details dla live Assessment list:

- `src/components/assessment/assessmentPreviewDetails.ts` (untracked)
- `tests/components/assessment/AssessmentHub.previewDetails.t21.test.tsx` (untracked)
- zmiany w `src/components/assessment/AssessmentHub.tsx`
- 67/67 testów T21 PASS.

T20 ocena atomów:

- `T20-PREVIEW-P01`: **PASS/DUPLICATE**, zero nowych edycji. Statycznie i niezależnie potwierdzony łańcuch: `StandardTable.onRowClick` → `setSelectedAssessmentId` → `selectedListRow` → render `StandardPreview`.
- `T20-PREVIEW-P25`: **PASS/DUPLICATE**, pokryte przez zaakceptowane T21 Details.
- `T20-PREVIEW-P29`: **PASS/DUPLICATE**, zero edycji. `relations={[]}` w AssessmentHub jest poprawne: live rekord zawiera tylko własne atrybuty (`id`, `name`, `framework`, `status`, `progress`, `overallScore`, `description`, `createdAt`, `updatedAt`, `createdBy`), bez prawdziwych relacji. `StandardPreview` renderuje kanoniczny pusty stan „No relations/Brak powiązań”. Alternatywa tworzenia relacji z framework/status została odrzucona jako fabrykacja i duplikacja Details.
- `T20-MENU_1_2_3-M14`: **ACCEPTED**. Ręczny bulk cluster został zastąpiony `Menu3BulkRow`.
- `T20-TABLE-T12`: **PASS/DUPLICATE**, raport Claude ukończony, ale `REPAIR_STATUS.csv` nie został zaktualizowany po tym raporcie z powodu rozpoczęcia handover. Standardowa selection column istnieje przez prop `selection`; `tableColumns` nie ma kolumny Actions; row menu ma Open/Duplicate/Delete i zero „Start”.
- `T20-TABLE-T08`: nadal OPEN, nieanalizowany/niezaimplementowany w końcowej części rozmowy.
- `T20-KEBAB-K10/K18/K19` oraz `T20-PPM-C12`: nadal OPEN w mapie; wymagają nowego preflight, z uwzględnieniem możliwych napraw wspólnych komponentów.

## 6. Implementacja T20-M14

### FACT — zmienione pliki

- `src/components/assessment/AssessmentHub.tsx` (modified; zawiera razem zmiany T21 i T20-M14)
- `tests/components/assessment/AssessmentHub.menu3BulkRow.t20.test.tsx` (untracked, nowy)

Zmiana:

- usunięto ręczne użycie `MENU_3_INNER_CLASS`, `MENU_3_LEFT_CLASS`, `MENU_3_RIGHT_CLASS`, `MENU_3_ACTION_DANGER` i `Menu3Chip` w bulk blocku;
- zaimportowano `Menu3BulkRow` z `../shared/ModuleMenu3`;
- zachowano guard `activeTab === 'list' && selectedListIds.size > 0`;
- zachowano Select all, Clear i Delete;
- Delete ma `variant: 'danger'` i pozostaje danger-last przez prymityw;
- T21 Details oraz Reports/Initiatives preview zachowane.

### FACT — niezależne QA

Wykonane przez Codex po implementacji:

```bash
npx vitest run \
  tests/components/assessment/AssessmentHub.menu3BulkRow.t20.test.tsx \
  tests/components/assessment/AssessmentHub.previewDetails.t21.test.tsx
```

Wynik: **2 pliki, 77/77 testów PASS**.

```bash
npx eslint \
  src/components/assessment/AssessmentHub.tsx \
  tests/components/assessment/AssessmentHub.menu3BulkRow.t20.test.tsx
```

Wynik: exit 0, **0 errors, 84 warnings** w AssessmentHub; plik testowy jest ignorowany przez konfigurację ESLint (ostrzeżenie, nie błąd). Warnings są istniejącym baseline.

Pierwsza próba użyła błędnej nazwy skryptu `npm run typecheck` i zakończyła się „Missing script”. Poprawna komenda:

```bash
npm run type-check -- --pretty false
```

Wynik: **exit 0**.

Claude dodatkowo raportował `git diff --check` exit 0 oraz realne negative controls:

- usunięcie guardu selection → 11/12 (jeden test czerwony);
- przywrócenie ręcznego `<button className="MENU_3_ACTION_DANGER">` → 11/12;
- po każdej mutacji przywrócono plik i potwierdzono 77/77.

## 7. Ważne decyzje i odrzucone alternatywy

### T20 „Library”

**Decision:** traktować `AssessmentHub` live tab `list` jako cel T20.  
**Reason:** audyt opisuje tabelę z row actions/selection; `TemplateLibrary.tsx` jest siatką kart w kreatorze, mimo nazwy „Library”.  
**Rejected:** implementowanie T20 w `TemplateLibrary.tsx` — zły surface i zła semantyka.

### T20 P25 po T21

**Decision:** nie tworzyć `libraryAssessmentPreviewDetails.ts`.  
**Reason:** byłby duplikatem istniejącego `assessmentPreviewDetails.ts`; T21 już spełnia P25.  
**Rejected:** drugi builder dla tego samego taba — regresja jakości i rozjazd kontraktów.

### T20 P29 Relations

**Decision:** przyjąć pusty kanoniczny Relations state.  
**Reason:** brak realnych relacyjnych ID w rekordzie listy.  
**Rejected:** framework/status/author jako „relations” — to własne atrybuty i duplikat Details; dodawanie nowych pól/API wykraczało poza atom i ownership.

### T20 M14

**Decision:** istniejąca mechanika selection nie wystarczała; ręczny pasek należało zmigrować do `Menu3BulkRow`.  
**Reason:** kanon wymusza anatomię N selected → Clear/X → neutral → danger-last i wspólne hooki DOM.  
**Alternative rejected:** pozostawienie ręcznych klas, bo „coś się pokazuje” — mechanicznie działało, ale nie było kanoniczne.

### T20 T12

**Decision:** PASS/DUPLICATE bez edycji.  
**Reason:** aktualny kod ma standardową selection, nie ma kolumny Actions i nie ma akcji Start; defekt ze starego audytu nie jest dziś reprodukowalny.

## 8. Znane problemy, blokery i ryzyka

1. Repo jest bardzo brudne: dziesiątki modified/deleted i setki untracked plików z wielu równoległych programów.
2. Cały katalog `docs/ui-standards/evidence/` jest obecnie untracked jako szeroki wpis; zawiera krytyczne plany/statusy/dowody tego programu.
3. Pliki Assessment T20/T21 są niecommitowane; można je łatwo stracić przy przełączeniu środowiska lub czyszczeniu.
4. Automatyczny prompt ma nieaktualne zdanie „Sonnet 5 realizuje T20-PREVIEW-P29”, choć faktycznie P29 i M14 są zakończone, a T12 ma końcowy PASS/DUPLICATE. Następny agent powinien zaktualizować automat po wznowieniu (nie podczas samego handover).
5. `REPAIR_STATUS.csv` uwzględnia P01/P25/P29/M14, ale nie końcowy wynik T12.
6. `ATOMIC_PACKAGE_MAP.csv` i `ATOMIC_DEFECT_BACKLOG.csv` nie zostały zsynchronizowane ze stanem przyjętych atomów; nadal zawierają `OPEN`/historyczne FAIL.
7. Live visual gates T16–T20 nie są ukończone.
8. T20 KEBAB/PPM mogą zależeć od wspólnych komponentów dotykanych przez innych writerów (`RowActionsMenu`, `StandardTable`, `FilterableTable` itd.). Przed edycją koniecznie ponownie sprawdzić ownership i diff.
9. `npm run typecheck` jest błędne; prawidłowe jest `npm run type-check`.
10. Test T20 jest source-slice. Nie zastępuje live visual/DOM acceptance.
11. Liczne prunable worktrees istnieją w `/private/tmp/claude-501/...`; nie usuwać ich w ciemno, bo mogą zawierać cudze prace.

## 9. Stan Git i worktree

### FACT — główny worktree

- Ścieżka pokazana przez Git używa iCloud: `/Users/piotrwisniewski/Library/Mobile Documents/com~apple~CloudDocs/Documents/Antygracity/DRD/consultify`.
- Bieżąca ścieżka używana w tym wątku: `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify` (odwołuje się do tego samego repo w środowisku użytkownika).
- Branch: `codex/sync-demo-20260729`.
- HEAD: `4610ddb7de`.
- Origin branch jest starszy (`3963959498` widoczny jako `origin/codex/sync-demo-20260729`).
- Brak commit/push wykonanych w tej rozmowie.

### FACT — kluczowy lokalny stan tej rozmowy

```text
 M src/components/assessment/AssessmentHub.tsx
?? src/components/assessment/assessmentPreviewDetails.ts
?? tests/components/assessment/AssessmentHub.menu3BulkRow.t20.test.tsx
?? tests/components/assessment/AssessmentHub.previewDetails.t21.test.tsx
?? docs/ui-standards/evidence/table-audit-45-2026-08-05/
```

Nowy handover jest również untracked:

```text
?? AI_HANDOVER/threads/ui_table_repair_45_autonomous_supervision.md
```

Poza tym repo zawiera bardzo dużo cudzych zmian, m.in. Finance, Excel, MyWork, Interview, shared UI, dokumenty, obrazy oraz inne programy MVP. Pełny `git status --short` należy odczytać ponownie przed jakąkolwiek pracą. Nie zakładać, że plik jest czysty na podstawie tej listy.

### FACT — worktrees

`git worktree list` pokazał główny worktree i wiele prunable worktrees Claude w `/private/tmp/claude-501/...` dla M01, M04–M13, Finance, Materials, Results itd. Nie zostały usunięte ani zmienione. Kolejny agent powinien traktować je jako potencjalnie ważne dane innych zadań.

## 10. Aktywna automatyzacja

Plik lokalny (poza repo):

`/Users/piotrwisniewski/.codex/automations/nadz-r-naprawy-ui-45-tabel-co-5-min/automation.toml`

Stan przy handover:

- id: `nadz-r-naprawy-ui-45-tabel-co-5-min`
- kind: heartbeat
- name: `Priorytetowy nadzór napraw UI 45 tabel — co 3 min`
- rrule: co 3 minuty
- status: ACTIVE
- notification policy: failed runs only
- target thread id: `019fd385-ccd9-7221-9cf4-3268631cf71d`

**Ryzyko konta:** automatyzacja jest przypięta do bieżącego lokalnego tasku/konta. Nie należy zakładać, że nowy account odziedziczy jej target thread. Po przełączeniu konta trzeba ją obejrzeć, ewentualnie wyłączyć starą i utworzyć/ustawić nową na nowym wątku.

## 11. Bieżące zadanie w chwili handover

Ostatnie wykonane zadanie: read-only preflight `T20-TABLE-T12` w Claude Sonnet 5.

Końcowy raport Claude:

- ownership bez zmian;
- standardowa selection aktywna przez `selection={{ selectedIds, onChange }}`;
- `tableColumns` dla list ma framework/name/status/progress/author/updated, bez Actions;
- row menu ma Open/Duplicate/Delete, bez Start;
- grep aktualnego pliku i HEAD nie znalazł etykiety akcji Start;
- wniosek: **PASS/DUPLICATE**, zero edycji.

Ten wynik nie został jeszcze dopisany do `REPAIR_STATUS.csv` ani map atomowych. To jest pierwsza czynność po wznowieniu, ale przed zapisem należy ponownie potwierdzić aktualny stan plików.

## 12. Priorytetowy plan kontynuacji

### P0 — natychmiast po przełączeniu konta

1. Otwórz ten plik oraz cztery dokumenty źródłowe audytu.
2. Uruchom `git status --short`, `git branch --show-current`, `git diff --check` i sprawdź mtimes/diffy plików Assessment.
3. Nie uruchamiaj żadnego writera, dopóki nie potwierdzisz, że `AssessmentHub.tsx` nie dostał obcych zmian po handover.
4. Zaktualizuj `REPAIR_STATUS.csv`, aby uwzględnić `T20-TABLE-T12 PASS/DUPLICATE` (bez zmiany kodu produktu).
5. Zsynchronizuj atomowe statusy T20 P01/P25/P29/M14/T12 w `ATOMIC_PACKAGE_MAP.csv`/backlog według przyjętej konwencji programu; zachowaj historyczne findings/evidence zamiast je usuwać.
6. Zaktualizuj prompt heartbeat, bo opisuje stary etap P29. Jeśli nowy account nie dziedziczy tasku, przepisz automatyzację na nowy target thread.
7. Następny read-only atom: `T20-TABLE-T08` (row height 56 px). Najpierw sprawdź, czy naprawa należy do `StandardTable`/`FilterableTable` i czy te pliki mają obecnie innego writera.

### P1 — ważne

1. Preflight `T20-KEBAB-K10/K18/K19` i `T20-PPM-C12`; nie edytuj wspólnych komponentów bez rozłącznego ownershipu.
2. Wykonaj live visual gates T16–T20 dla 1440×900 i 1280×720, w tym populated/empty tam, gdzie wymagane.
3. Po każdej zmianie: scoped test → lint claimed files → type-check → diff-check → niezależny ACCEPTED/REJECTED.
4. Dopiero po zamknięciu T20 przejdź do następnego rozłącznego modułu zgodnie z master planem.

### P2 — później

1. Pełna macierz regresji 45 × 5.
2. Dwa przejścia wizualne w paczkach po 10 tabel.
3. Przypięcie SHA kandydata i finalne checkpointy/manifesty.
4. Uporządkowanie prunable worktrees dopiero po świadomej decyzji właścicieli.

## 13. Walidacja i oczekiwany baseline

Najważniejsze komendy:

```bash
npx vitest run tests/components/assessment/AssessmentHub.menu3BulkRow.t20.test.tsx tests/components/assessment/AssessmentHub.previewDetails.t21.test.tsx
npx eslint src/components/assessment/AssessmentHub.tsx tests/components/assessment/AssessmentHub.menu3BulkRow.t20.test.tsx
npm run type-check -- --pretty false
git diff --check
git status --short
```

Oczekiwany stan bez nowych zmian:

- vitest: 77/77 PASS;
- eslint: 0 errors, warnings baseline (ostatnio 84 dla AssessmentHub; test ignored warning);
- type-check: exit 0;
- diff-check: exit 0.

Nie powtarzać pełnych zielonych bramek co heartbeat bez zmiany kodu. Używać ich przy odbiorze lub realnym ryzyku.

## 14. Otwarte pytania

1. Czy pozostałe atomy KEBAB/PPM T20 są już pośrednio pokryte przez równoległe zmiany shared components? Wymaga świeżego preflight.
2. Czy T20-T08 jest lokalnym problemem AssessmentHub, czy wspólną geometrią StandardTable/FilterableTable? Nie rozstrzygnięto.
3. Jak formalnie oznaczać PASS/DUPLICATE w `ATOMIC_PACKAGE_MAP.csv`, aby zachować historyczne evidence? Konwencję trzeba odczytać z innych przyjętych atomów.
4. Kiedy i przez kogo zostaną wykonane live visual gates T16–T20?
5. Czy aktywna automatyzacja przetrwa zmianę konta i będzie wskazywać właściwy nowy task?
6. Kiedy wolno zabezpieczyć zmiany commit/push? W tej rozmowie było to jawnie zakazane.

## 15. Czego nie udało się w pełni zrekonstruować

- Pełnych szczegółów wszystkich wcześniejszych heartbeatów i każdej interakcji Claude nie przeniesiono słowo w słowo; zachowano ich trwałe decyzje, wyniki i stan operacyjny.
- Nie da się wiarygodnie przypisać wszystkich tysięcy lokalnych zmian konkretnym agentom tylko z Git, ponieważ worktree był współdzielony i bardzo brudny.
- Nie odtworzono kompletnego pełnego `git status` w tym pliku; jest ogromny i zmienny. Zapisano kluczowy zakres oraz obowiązek ponownego odczytu.
- Nie zweryfikowano live UI dla T16–T20; to pozostaje jawnie otwarte.

## WHAT THE NEXT AGENT MUST KNOW

1. Repo: `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify`, branch `codex/sync-demo-20260729`, HEAD `4610ddb7de`.
2. Repo jest ekstremalnie brudne i współdzielone; niczego nie resetuj, nie czyść, nie stashuj.
3. Nie commituj ani nie pushuj bez nowej zgody.
4. Źródła prawdy to cztery pliki w `docs/ui-standards/evidence/table-audit-45-2026-08-05/`.
5. R00 i R01 są ACCEPTED; R22 jest ACCEPTED_PARTIAL.
6. T16–T19 Details technicznie odebrane; live visual gates nadal otwarte.
7. T20 „Library” oznacza aktualny `AssessmentHub` tab `list`, nie `TemplateLibrary.tsx`.
8. T21 Details w AssessmentHub są zaakceptowane i muszą być zachowane.
9. T20 P01/P25/P29 są PASS/DUPLICATE bez dodatkowego kodu.
10. P29 pozostaje pustym Relations celowo — brak realnych pól relacyjnych; nie fabrykuj relacji.
11. T20 M14 jest zaimplementowany przez `Menu3BulkRow` i ACCEPTED.
12. Niezależne QA T20+T21: 77/77 PASS, lint 0 errors, type-check exit 0.
13. Poprawna komenda to `npm run type-check`, nie `npm run typecheck`.
14. T20 T12 ma końcowy PASS/DUPLICATE, ale statusy CSV nie zostały jeszcze zaktualizowane po tym wyniku.
15. T20 T08 oraz KEBAB/PPM pozostają otwarte.
16. `AssessmentHub.tsx` zawiera wspólny niecommitowany diff T21 + T20-M14; nie rozdzielaj go destrukcyjnie.
17. Krytyczne nowe pliki Assessment i cały katalog evidence są untracked.
18. Claude Desktop task dla programu to `R00 Kontrakty i test harness`, Sonnet 5.
19. Każda interakcja Claude maksymalnie 60 sekund i jedno polecenie na cykl.
20. Jeśli Claude jest zajęty innym agentem, nie przerywaj; pracuj read-only poza aplikacją.
21. Aktywna automatyzacja działa co 3 minuty, ale jej prompt ma nieaktualny etap P29 i target starego tasku/konta.
22. Przed następnym writerem sprawdź świeży ownership shared components.
23. Następny zalecany atom: read-only preflight `T20-TABLE-T08`.
24. Nie zamykaj programu bez live visual gates 1440×900 i 1280×720.
25. Ten handover sam jest untracked i musi zostać zachowany przy zmianie konta.

## 16. Live QA demo — 2026-08-07

- Utworzono kontrolowany rekord demo `QA UI 45 Tables — Assessment Test 2026-08-07` (Assessment id `916b402e-f81c-421e-bf40-826e9b4fe5fd`) wyłącznie do weryfikacji tabel UI. Nie usuwać go automatycznie; użyć go ponownie do dowodów live.
- Na `https://demo.consultify.ai/assessment/overview?tab=processes` sprawdzono populated state przy 1440×900 i 1280×720. Tabela, checkbox zaznaczenia, Menu 3 oraz menu wiersza (`Open`, `Duplicate`, `Open preview`, `Edit`, `Delete`) są dostępne.
- Demo pokazuje pięć tabów: Library, Processes, Outputs, Reports, Initiatives. Jest to rozbieżne z lokalnym `AssessmentHub.tsx`, który ma tylko Assessment/Reports/Initiatives; nie wolno uznać demo za dowód kandydata SHA `4610ddb7de...` bez reconciliation/deploy.
- Live FAIL w demo: breadcrumb `Tools › Licensed` zamiast Assessment/Processes; preview zawiera tabelę `Property/Value` w Details i luźne `No relations`, więc nie odpowiada kanonicznym Details/Relations. R22 pozostaje `ACCEPTED_PARTIAL` i nie wolno go promować.
- Zrzuty zostały obejrzane interaktywnie, lecz nie zapisano ich jako trwałych artefaktów w repo. Należy wykonać je ponownie i zapisać po wdrożeniu poprawnego kandydata.
