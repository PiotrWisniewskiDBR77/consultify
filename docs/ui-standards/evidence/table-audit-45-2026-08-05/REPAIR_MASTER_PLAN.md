# Master plan naprawy 45 tabel — zarządzanie pracownikami Claude Sonnet

## Cel programu

Zamknąć 322 atomowe defekty potwierdzone na SHA `94264784f925`, bez tworzenia lokalnych wyjątków i bez utraty funkcji biznesowych. Każdy wynik musi zostać niezależnie odebrany na pięciu powierzchniach oraz w viewportach 1440×900 i 1280×720.

Źródła prawdy:

- `ATOMIC_DEFECT_BACKLOG.csv` — 322 atomowe defekty;
- `FINDINGS.csv` — 121 logicznych pakietów naprawczych;
- `AUDIT_CHECKPOINT_MODEL.md` — kontrakt odbiorowy;
- `MATRIX_T01_T45.csv` — bazowy wynik 45 × 5;
- `MANIFEST.csv` — dowody wejściowe;
- `REPAIR_WORK_PACKAGES.csv` — kolejka prac;
- `REPAIR_STATUS.csv` — stan wykonania i odbiorów.
- `ATOMIC_PACKAGE_MAP.csv` — jednoznaczne przypisanie każdego z 322 `atomic_id` do właściciela paczki.

## Role

### Agent zarządzający

- utrzymuje kolejkę i zależności;
- przydziela ownership plików;
- przekazuje agentom zamknięte paczki;
- porównuje zakres diffu z ticketem;
- kieruje zadanie do niezależnego odbioru;
- aktualizuje backlog wyłącznie po wyniku `ACCEPTED`;
- zatrzymuje równoległą pracę przy konflikcie plików.

### Claude Sonnet — wykonawca

- pracuje na osobnej gałęzi/worktree;
- przed rozpoczęciem deklaruje `CLAIMED_FILES`, `READ_ONLY_FILES` i zależności;
- implementuje wyłącznie przydzielony zakres;
- dodaje testy kontraktowe lub domenowe;
- wykonuje lint, typecheck, właściwe testy i build proporcjonalnie do zmiany;
- wykonuje samokontrolę pięciu powierzchni;
- przekazuje SHA, diff, wyniki testów i listę zamykanych `atomic_id`.

### Niezależny agent odbiorowy

- nie zmienia kodu podczas odbioru;
- nie kopiuje werdyktów wykonawcy;
- wykonuje dwa przejścia wizualne;
- porównuje stan z checkpointami i dowodami bazowymi;
- wydaje tylko `ACCEPTED`, `REJECTED` albo `BLOCKED`;
- przy odrzuceniu wskazuje checkpoint, expected/observed i dowód.

## Zasady architektoniczne

1. Jedna powierzchnia ma jeden komponent SSOT.
2. Zgłoszony rejestr tabelowy zawiera controls + tabelę; dashboardy, wykresy i formularze trafiają do szczegółu lub osobnej zakładki.
3. KEBAB i PPM korzystają z jednego modelu akcji i jednego renderera.
4. Preview jest generowane ze schematu, a nie składane ręcznie per ekran.
5. Menu 3 jest jedną maszyną stanów: default, selection/bulk, open items.
6. Brak danych nie usuwa struktury tabeli ani powierzchni odbiorowych.
7. Nie wolno wprowadzać lokalnego CSS naprawiającego objaw wspólnego błędu.
8. Pliki audytowe są dla wykonawców read-only.

## Bramka środowiska demo

- Zdrowy runtime demo może służyć jako baseline audytu tylko po potwierdzeniu `api/health`, `api/ready`, migracji i dokładnego SHA deploymentu.
- Zielony deployment nie jest dowodem wdrożenia bieżących napraw, jeżeli SHA demo różni się od SHA kandydata albo historie gałęzi są rozbieżne.
- Odbiór wizualny pakietów R01–R40 wymaga deploymentu zawierającego dokładny `candidate_sha`; SHA musi zostać zapisany przy evidence.
- Do czasu takiego deploymentu testy lokalne i QA kodu mogą zamknąć G0–G2, ale nie zamykają końcowej bramki wizualnej G3/G4.
- Stan potwierdzony 2026-08-06: demo `b21c9513a199ecc8f3e861406fb5c73bd2ccf759` jest zdrowe i nadaje się do baseline/reacceptance, lecz nie jest liniowo zgodne z lokalnym HEAD `d8b3979e651d2e6d5591bff128f5abb23d10772e` (543/5 commitów rozbieżności; merge-base `fca72583ea83acf728a7807c5e119318dc206416`).

## Fala 0 — kontrakty i test harness

### R00: typy kontraktów

Wprowadzić zamknięte kontrakty:

- `TableSurfaceContract` / kanoniczny preset rejestru;
- `RowActionModel` z unikalnymi ID i etykietami;
- `PreviewSchema<T>`;
- kontrakt Menu 1/2/3;
- fixtures empty i populated;
- mapowanie T01–T45 → adapter/konfiguracja.

Najpierw powstają testy, dopiero potem zmiany wizualne. R00 blokuje R01–R04.

## Fala 1 — komponenty współdzielone

### R01: KEBAB + PPM

Potencjalny zakres:

- `src/components/shared/RowActionsMenu.tsx`;
- integracja w `src/components/shared/ModuleHub/FilterableTable.tsx`;
- normalizacja w `src/components/standard/StandardTable.tsx`.

Wymagania:

- jeden model danych dla obu wejść;
- identyczne akcje i kolejność context → manage → danger;
- szerokość 220–320 px;
- każdy item 36 px;
- trigger 32×32 px;
- danger czerwony, pozostałe neutralne;
- disabled widoczne i jaśniejsze, bez komentarza;
- brak duplikatów i atrap;
- flip/clamp przy krawędzi viewportu;
- ArrowUp/Down, Home/End, Enter/Space, Esc, click outside i focus return.

### R02: Menu 1/2/3

Potencjalny zakres:

- `src/components/standard/StandardModuleBar.tsx`;
- `src/components/shared/ModuleMenu3.tsx`;
- `src/components/shared/ModuleHub/Menu3Row.tsx`;
- konsolidacja równoległych `BulkActionBar` i lokalnych stylów.

Wymagania:

- Menu 1: jeden neutralny primary CTA;
- Menu 2: wyłącznie nazwy, poprawna kolejność;
- Menu 3 selection: `N selected`, opcjonalne `Select all`, zawsze X + `Clear`, minimalne akcje;
- czerwony wyłącznie danger;
- disabled bez komentarza;
- brak clippingu przy 1280 px.

### R03: preview schema-driven

Potencjalny zakres:

- `src/components/standard/StandardPreview.tsx`;
- `src/components/shared/PreviewPane/*`;
- `src/components/ui/ResizableTable/PreviewPaneShell.tsx`;
- `src/components/shared/TableWithPreviewLayout.tsx`.

Wymagania:

- jeden renderer i stała kolejność bloków;
- header → meta/context → Details → AI → Relations → actions;
- Details: 80–140 użytecznych słów;
- Relations zawsze jako blok, także empty state;
- stałe szerokości, wysokości, odstępy i przewijanie;
- jedna instancja każdej akcji;
- pełne narzędzia i zagnieżdżone tabele poza preview;
- walidacja duplikatów ID/label w testach i trybie dev;
- Enter/Esc/J/K oraz focus return.

### R04: kanoniczny table shell

Potencjalny zakres:

- `src/components/standard/StandardTable.tsx`;
- `src/components/shared/ModuleHub/FilterableTable.tsx`;
- `src/components/ui/ResizableTable/*` jako adapter lub wygaszany wariant;
- selection, settings, resize i persistence.

Wymagania:

- jeden register shell;
- wysokość nagłówka i wiersza 56 px;
- checkbox, selection, row actions i PPM domyślnie dla rejestru;
- fit w 1280 albo jawny, osiągalny overflow;
- empty state zachowuje nagłówek i geometrię tabeli;
- sort/filter/resize/persist;
- row click → preview, Enter/double click → full detail;
- semantycznie pełne kolumny.

R01–R04 mają osobnych właścicieli, ale startują dopiero po scaleniu R00. Żaden agent domenowy nie zmienia tych plików bez przekazania ownershipu.

## Fala 2 — P0: rejestry i dane

### Brakujące lub zastąpione rejestry

- R10: T22 Assessment/Outputs;
- R11: T27 Observability, T28 Candidates, T29 Portfolio health;
- R12: T35 Execution/Management.

Każda powierzchnia musi dostać prawdziwą tabelę w wariancie empty i populated. Istniejące dashboardy/narzędzia należy przenieść, nie usuwać.

### Zanieczyszczone rejestry

- R13: T26 Analysis i T30 Goals;
- R14: T31 Dashboard, T32 Summary, T33 Rollout;
- R15: T36 KPI, T37 ROI, T38 OKR;
- R16: T40 Analysis, T41 Models, T42 Prediction, T43 Enterprise valuation.

W widoku listy pozostają wyłącznie controls + tabela. T33 dodatkowo wymaga poprawnego routingu, aktywnej zakładki oraz back/forward.

### Semantyka i geometria

- R17: T04 Calendar — kolumny kontekstowe i usunięcie narzędzi z listy;
- R18: T44 All, T45 Documents — rzeczywisty Format: DOCX/PDF/XLSX/PPTX, sort i filtr;
- R19: T03, T06, T11, T16, T24 — overflow i prawa krawędź przy 1280 px.

## Fala 3 — migracja pozostałych powierzchni

Po przyjęciu R01–R04 wykonywać paczki maksymalnie po pięć tabel, według modułu i bez współdzielenia plików:

- R20: My Work T01–T08;
- R21: Interview T09–T14;
- R22: Consulting Tools T15–T20;
- R23: Assessment T21–T24;
- R24: Initiatives T25–T30;
- R25: Execution T31–T35;
- R26: Results T36–T38;
- R27: Finance T39–T43;
- R28: Materials T44–T45.

Pakiety zamykają pozostałe P1/P2: preview, Menu 3, geometria KEBAB/PPM, wysokości wierszy, kolory, kolejność i kompletność kolumn oraz niepotrzebne akcje.

## Fala 4 — regresja i odbiór całości

1. Przypiąć jeden SHA kandydata.
2. Wykonać pełną macierz 45 × 5.
3. Dwa przejścia w paczkach po 10 tabel.
4. Zweryfikować 1440×900 i 1280×720.
5. Sprawdzić wariant populated oraz empty dla rejestrów przebudowanych.
6. Zaktualizować manifest, checkpointy, atomowy backlog i findings.
7. Nie zamykać programu przy jakimkolwiek P0, `NOT_TESTED`, N/A albo nieuzasadnionym wyjątku.

## Bramki G0–G5

### G0 — gotowość

- przypisane `atomic_id`, findings i dowody;
- zamknięty zakres plików;
- brak konfliktu ownershipu;
- znany SHA bazowy i zależności.

### G1 — implementacja

- diff wyłącznie w zakresie;
- brak lokalnego obejścia wspólnego standardu;
- brak utraty funkcji biznesowych;
- brak zbędnych i zdublowanych przycisków.

### G2 — techniczna

- lint i typecheck dla zakresu;
- testy unit/component/integration;
- build;
- testy interakcji row/preview/selection/KEBAB/PPM;
- brak nowych błędów konsoli.

### G3 — samokontrola wykonawcy

- pięć powierzchni;
- dwa viewporty;
- ekran po pełnym załadowaniu;
- tabela checkpointów i obrazy;
- jawna lista punktów niezamkniętych.

### G4 — niezależny odbiór

- dwa przejścia;
- własne dowody odbiorcy;
- pełna ocena koloru, wymiarów, kształtu i kolejności;
- DOM jako uzupełnienie, nie zamiennik grafiki;
- wynik `ACCEPTED`, `REJECTED` albo `BLOCKED`.

### G5 — regresja paczki

- wszystkie tabele i pięć powierzchni paczki;
- oba viewporty;
- brak regresji komponentów wspólnych;
- aktualizacja macierzy i atomowego backlogu.

## Retry i eskalacja

- Pierwsze `REJECTED`: wykonawca dostaje checkpoint, expected/observed, dowód i prawdopodobne źródło. Poprawia odrzucone punkty i powtarza pełną regresję paczki.
- Drugie `REJECTED`: agent zarządzający sprawdza ticket, zależności oraz czy naprawiany jest objaw zamiast źródła; może przepakować zadanie lub zmienić wykonawcę.
- Trzecie `REJECTED`: `ESCALATED`; wymagana decyzja architektoniczna lub doprecyzowanie kanonu.
- `BLOCKED` wyłącznie przy realnej przeszkodzie środowiskowej, danych lub sprzecznym wymaganiu.

## Definition of Done paczki

- wszystkie przypisane atomowe checkpointy mają niezależny PASS;
- właściwe testy techniczne przechodzą;
- dowody pochodzą z docelowego SHA i w pełni załadowanego ekranu;
- oba viewporty zostały sprawdzone;
- KEBAB i PPM są identyczne pod względem akcji, kolejności i grafiki;
- preview spełnia kontrakt bloków, treści i akcji;
- rejestr jest czystą tabelą;
- brak nieuzgodnionych zmian;
- regresja paczki przechodzi;
- agent odbiorowy wydał `ACCEPTED`.

## Definition of Done programu

- 45/45 tabel odebranych;
- 225/225 powierzchni sprawdzonych dwukrotnie;
- 0 otwartych P0;
- wszystkie 322 początkowe `atomic_id` mają status końcowy;
- 0 nowych regresji;
- macierz, manifest i backlog odnoszą się do jednego SHA;
- końcowy raport integralności ma zero błędów.
