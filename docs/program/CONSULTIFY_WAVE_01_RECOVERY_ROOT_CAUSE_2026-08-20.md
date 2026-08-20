# Consultify — Wave 01: Recovery & Root Cause

Status: `IN_PROGRESS`  
Branch integracyjny: `codex/full-mvp-recovery-20260820`  
Punkt startowy: `737917bb92`  
Budżet kalendarzowy: 24–48 godzin ciągłej pracy  
Cel: przed implementacją dużych zmian ustalić dokładnie, co należy naprawić, co odzyskać, a czego nie wolno scalać.

## Oczekiwany rezultat

Wave 01 nie ma sztucznie zwiększać licznika 71/82. Ma zakończyć się jednym zatwierdzonym backlogiem wykonawczym Wave 02, zawierającym wyłącznie rzeczywiste braki pełnego MVP, dokładne źródła odzyskiwanego kodu oraz reprodukowalne przyczyny błędów.

## Strumienie wykonawcze

### W1-A — Finance Statement `25P02`

Właściciel: jeden agent wykonawczy; integrator wykonuje review i fan-in.

Zakres:

- odtworzyć błąd na dokładnym `f5c6a7f16f` i jawnie nazwanej disposable bazie;
- zapisać pierwszy błąd PostgreSQL poprzedzający `25P02`, z correlation/request ID;
- odtworzyć transakcję na minimalnym wejściu;
- wskazać brakujący rollback/savepoint/preflight albo błędny kontrakt danych;
- porównać rozwiązanie z niekanonicznymi branchami Finance, bez ich scalania;
- przygotować mały fix lub, jeśli potrzebna jest zmiana architektury, dokładny ADR dla Wave 02.

DoD:

- reprodukcja jest deterministyczna;
- znany jest pierwszy błąd, nie tylko wtórny `25P02`;
- istnieje test czerwony przed poprawką;
- zero zmian produkcyjnych i zero kontaktu z produkcyjną bazą;
- jeśli fix jest bezpieczny i mały: exact-six, confirm, receipt, deep link i cold readback przechodzą.

Stop-loss: 90 minut bez nowej informacji lub dwa identyczne nieudane podejścia — checkpoint i zmiana hipotezy.

### W1-B — Chat NFR disposition

Właściciel: integrator.

Zakres:

- porównać pierwotny DoD `CHAT-NFR-001` z aktualnym dowodem;
- potwierdzić, czy zewnętrzny provider stability window jest wymaganiem pełnego MVP, wymaganiem wydania, czy obserwacją operacyjną;
- nie powtarzać 77+ testów, jeśli nie zmienił się kod;
- przygotować jeden z werdyktów: `DONE_CURRENT_SHA`, `RELEASE_ONLY`, albo precyzyjny test provider window.

DoD: status ma jeden jednoznaczny kontrakt, właściciela, środowisko, próg i dowód; brak semantycznego `PARTIAL` bez działania.

### W1-C — Teresa ↔ UI action registry

Właściciel: jeden bounded agent wykonawczy; integrator zatwierdza kontrakt.

Zakres:

- zinwentaryzować wszystkie mutujące akcje dostępne w zamontowanym UI MVP;
- wskazać odpowiadającą akcję Teresy albo `MISSING`;
- sprawdzić role, tenant scope, preview, confirm, idempotency, receipt, audit i compensation;
- wykryć ukryte możliwości Teresy oraz akcje UI bez parytetu;
- nie implementować podczas inwentaryzacji.

DoD: jedna wersjonowana macierz z mianownikiem 100%, bez `UNKNOWN`; każda luka otrzymuje P0/P1/P2 i paczkę Wave 02 lub późniejszą dyspozycję.

### W1-D — Recovery i duplicate triage

Właściciel: integrator; automatyczna inwentaryzacja może działać równolegle, ale nie może modyfikować worktree.

Zakres pierwszeństwa:

- Finance Statement i 28 legacy writerów;
- pięciu writerów Results bez następcy;
- realny transform flow;
- Teresa/action registry;
- dirty SWOT;
- niezamontowane lub zdublowane powierzchnie dotyczące powyższych domen.

Dla każdego kandydata zapisać: worktree/branch, base, HEAD, dirty paths, zakres funkcji, różnicę względem kanonu, testy, konflikt, kategorię oraz decyzję.

DoD: każdy krytyczny kandydat ma jedną kategorię `ALREADY_IN_CANON`, `SUPERSEDED`, `UNIQUE_REUSABLE`, `CONFLICTING_DUPLICATE`, `EVIDENCE_ONLY` lub `UNKNOWN_DIRTY`. `UNKNOWN_DIRTY` blokuje usunięcie, ale nie musi blokować Wave 02, jeśli nie dotyczy krytycznej ścieżki.

## Organizacja zasobów

Maksymalnie trzy aktywne strumienie wykonawcze jednocześnie:

1. Finance root cause.
2. Teresa/action-registry inventory.
3. Recovery/duplicate triage.

Chat prowadzi integrator jako krótki audyt kontraktu, bez osobnego długowiecznego agenta. Każdy agent pracuje na oddzielnym bounded worktree i dostarcza checkpoint co najwyżej co 90 minut. Agent nie scala, nie pushuje i nie zmienia statusów rejestru.

## Bramki jakości

Każdy proponowany port lub fix musi przejść:

- `git diff --check`;
- focused test pokazujący kontrakt i negatywną kontrolę;
- root oraz server typecheck, jeśli dotyka współdzielonych typów/API;
- real PostgreSQL, jeśli dotyka zapisu, migracji lub readback;
- review integratora pod kątem drugiego writera, route collision i driftu kontraktu;
- dowód exact SHA.

## Checkpointy

### Po 6 godzinach

- Finance: reprodukcja i pierwszy ślad błędu albo jawny blocker środowiska.
- Teresa: mianownik akcji UI i lista źródeł registry.
- Recovery: lista krytycznych worktree/branchy do głębokiego porównania.

### Po 12 godzinach

- Finance: root-cause hypothesis potwierdzona testem.
- Teresa: pierwsza pełna macierz z lukami.
- Recovery: decyzje dla kandydatów Finance/Results/Transform.
- Chat: gotowy werdykt kontraktowy.

### Po 24 godzinach

- mały Finance fix gotowy do fan-in albo ADR i ograniczona paczka Wave 02;
- zatwierdzony rejestr Teresa/UI;
- unikalny kod wskazany dokładnymi commitami/ścieżkami;
- zaktualizowana prognoza całego MVP na podstawie faktycznej prędkości.

### Maksymalnie po 48 godzinach

- zamknięta bramka Wave 01;
- czysty commit z audytem i, jeśli bezpieczne, małymi poprawkami;
- lista paczek Wave 02 z właścicielami, ścieżkami, testami i kolejnością fan-in.

## Warunek przejścia do Wave 02

`PASS` wymaga:

- znanego root cause Finance i testu reprodukcyjnego;
- jednoznacznej dyspozycji Chat NFR;
- kompletnej macierzy Teresa/UI dla zakresu MVP;
- klasyfikacji wszystkich krytycznych kandydatów odzyskania;
- braku nieprzejrzanych zmian w kanonie;
- zatwierdzonego, rozłącznego backlogu Wave 02.

Jeśli jeden element jest zablokowany zewnętrznie, dopuszczalne jest `PARTIAL_WITH_DECISION`, ale tylko z właścicielem, terminem, zachowaniem fail-closed i dowodem, że nie blokuje pozostałej pracy. W przeciwnym razie wynik to `STOP`.

## Format raportu końcowego Wave 01

- dokładny HEAD i `git status`;
- wynik każdej bramki;
- nowe commity produktu i dowodów;
- przyjęte oraz odrzucone fragmenty odzyskanego kodu;
- root causes i testy reprodukcyjne;
- otwarte P0/P1;
- decyzje wymagane od Piotra;
- skorygowany przedział czasu do MVP;
- gotowe polecenia dla wykonawców Wave 02.
