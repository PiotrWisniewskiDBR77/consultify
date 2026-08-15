# Consultify — plan uporządkowania środowiska

Data: 2026-08-14

Status: PLAN / FREEZE

Zakres: repozytoria Git, worktree, lokalne kandydaty, wdrożony SHA i zasady pracy agentów

## Cel

Utworzyć jedno jednoznaczne, czyste i odtwarzalne środowisko kanoniczne Consultify bez utraty istniejącej pracy. Dopiero po spełnieniu bram tego dokumentu można wznowić masową rozbudowę Agenta.

## Stan wyjściowy

- Dalsza rozbudowa Agenta została zatrzymana. Nic z bieżącego strumienia nie zostało wdrożone na demo.
- Aktualnie obserwowany SHA demo: `f3237e94230481d2bf4ad0a9c0dc10b1391191c9`.
- Stary klon iCloud ma około 350 zarejestrowanych worktree, około 1265 lokalnych branchy i repozytorium `.git` o rozmiarze około 21 GB.
- Główny checkout starego klonu ma około 339 zmienionych ścieżek. Inne worktree mają również duże, niesklasyfikowane zmiany.
- Osobna rodzina klonów w `Developer` zawiera czyste kandydaty, ale także uszkodzony/niepełny checkout raportujący 18 889 usuniętych ścieżek.
- SHA wdrożenia oraz część najnowszych kandydatów nie są obecnie potwierdzone jako osiągalne z remote. To jest ryzyko utraty pracy.
- Kandydat Agenta jest odseparowany w `/Users/piotrwisniewski/Developer/consultify-agent-hub-completion-20260814`. Ma trzy zachowane commity ponad handoff oraz jedną nieśledzoną migrację. Nie jest kanonem ani stanem DONE.

## Zasady bezwzględne

Do zakończenia zabezpieczenia nie wolno wykonywać:

- `git reset`, `git clean`, `git stash`, szerokiego `git add -A`;
- `git worktree remove/prune`, usuwania branchy lub katalogów;
- agresywnego `git gc`/`prune`;
- ślepego merge/cherry-pick pomiędzy rozbieżnymi liniami;
- pracy agentów w starym współdzielonym katalogu iCloud;
- push, merge lub deploy bez osobnej zgody i wskazania dokładnego SHA.

## Etap 0 — Freeze

Status: WYKONANY

- zatrzymać aktywne strumienie implementacyjne;
- nie tworzyć kolejnych worktree;
- zachować kandydat Agenta w kwarantannie;
- nie modyfikować demo ani bazy danych.

Weryfikacja 2026-08-14 wykazała, że zatrzymanie agentów w interfejsie nie kończy
automatycznie ich procesów systemowych. Dwadzieścia dwa procesy Claude powiązane
z katalogami Consultify zostały zamrożone odwracalnym sygnałem `SIGSTOP` po
zapisaniu PID i katalogów roboczych. Nie usunięto sesji, plików ani procesów.

## Audyt planu względem sześciu warstw ryzyka

### 1. Git i pochodzenie zmian

Plan obejmuje pełny graf commitów, lokalne i zdalne refs, detached HEAD,
ahead/behind, staged/unstaged/untracked/conflicts oraz osiągalność SHA. Czysty
`git status` nie jest uznawany za dowód kompletności, jeżeli unikalny commit
pozostał w innym worktree lub klonie.

### 2. Duplikaty implementacji

Integracja musi wykryć równoległe implementacje tego samego modułu na poziomie
routes, ekranów, komponentów, endpointów, serwisów, migracji i testów. Każdy
wariant otrzyma decyzję `KEEP`, `MERGE`, `REPLACE`, `ARCHIVE` albo `DELETE` z
uzasadnieniem i dowodem, że nie zawiera unikalnej funkcji.

### 3. Kod istniejący, lecz niepodłączony

Audyt przechodzi pionowo: menu -> route -> ekran -> hook/API -> serwis -> baza ->
readback. Osobno raportuje komponenty bez produkcyjnych importów, routes bez
nawigacji, phantom flags, query/localStorage activation, niezamontowane panele,
przyciski bez mutacji i seedy nieczytane przez aktualny UI.

### 4. Kontrakty, migracje i dane

Każda funkcja wymaga zgodnego kontraktu frontend/backend, migracji odkrywanej
przez runner, zgodności fresh/upgrade, tenant isolation, idempotentnego seeda i
semantycznego readback. Migracje o tym samym numerze/nazwie oraz schemat
istniejący tylko w jednym worktree są blockerem integracji.

### 5. Wiarygodność testów i wdrożenia

Testy muszą być przypisane do dokładnego SHA i prawdziwego trybu wykonania.
Mock, test-support, token injection, lokalna flaga albo screenshot z innego SHA
nie dowodzą gotowości. Brama obejmuje build, typecheck, testy modułowe,
integracyjne, realDB, E2E, przeglądarkę i zgodność SHA Railway.

### 6. Spójność produktowa i dokumentacyjna

Każdy moduł otrzyma jedną nazwę, jeden kanoniczny route, jeden aktualny ekran,
model biznesowy, stany empty/loading/error/permission oraz źródło danych.
Techniczne UUID, enumy, diagnostyka i governance nie mogą zastępować normalnego
UI. Dokumentacja musi wskazać dokładny status: `DONE`, `PARTIAL`, `BLOCKED`,
`ORPHAN`, `DUPLICATE` albo `DEFERRED`.

### Wniosek audytu

Żadna z sześciu warstw nie wypada poza plan. Dodano jednak obowiązkową bramę
procesową: przed każdym snapshotem i przed integracją trzeba potwierdzić brak
aktywnych procesów zapisujących w objętych katalogach. Bez tej bramy stan może
zmienić się podczas inwentaryzacji i unieważnić manifest.

## Etap 1 — pełny rejestr

Status: DO WYKONANIA

Zbudować maszynowy rejestr wszystkich klonów i worktree z polami:

- wspólny katalog Git;
- ścieżka checkoutu;
- branch, HEAD, upstream i ahead/behind;
- liczba i rodzaj zmian: staged, unstaged, untracked, conflicts;
- ostatnia aktywność;
- właściciel lub źródło zadania;
- osiągalność SHA z lokalnych i zdalnych refs;
- rozmiar oraz obecność unikalnych plików.

Każdy wpis otrzymuje jedną klasę:

1. `CANONICAL_LIVE` — linia aktualnie wdrożona.
2. `CANDIDATE_CLEAN` — czysty, zachowany kandydat.
3. `WIP_UNIQUE` — brudna praca z możliwie unikalnymi zmianami.
4. `REDUNDANT_CLEAN` — czysta kopia bez unikalnej wartości.
5. `BROKEN_CHECKOUT` — niepełny lub niespójny checkout.
6. `GENERATED_ONLY` — artefakty, cache albo wyniki testów.
7. `UNKNOWN` — brak wystarczającego dowodu; nie wolno usuwać.

Artefakty etapu: `CSV/TSV`, raport wyjątków oraz lista ścieżek wymagających decyzji właściciela.

## Etap 2 — zabezpieczenie

Status: WYMAGA ZGODY NA ZAPISY ZABEZPIECZAJĄCE

- nadać nazwane refs lokalne dokładnemu SHA demo `f3237e942...` i wszystkim zaakceptowanym kandydatom;
- utworzyć sprawdzalne Git bundle dla refs oraz manifest SHA-256;
- dla każdego `WIP_UNIQUE` wykonać osobny manifest, patch indeksu i working tree oraz spis plików untracked;
- pliki untracked o wartości produktowej zachować w dedykowanym branchu kwarantanny lub archiwum z sumami kontrolnymi;
- osobno przejrzeć i zachować migrację Agenta `948_transformation_collaboration_and_plan_suggestions.sql`;
- nie uznawać kopii plików za pełną kopię Git;
- po zgodzie potwierdzić zdalną osiągalność SHA demo i ważnych kandydatów.

Szczególnej ochrony wymagają obecnie:

- stary główny checkout z około 339 zmianami;
- worktree z około 390 zmianami;
- checkout raportujący 18 889 usunięć;
- recovery checkout raportujący około 2050 zmian;
- kandydat Agenta i jego nieśledzona migracja.

## Etap 3 — wybór jednego kanonu

Status: DO DECYZJI PO ZABEZPIECZENIU

Rekomendacja:

- zbudować nowy, czysty kanoniczny checkout poza iCloud;
- oprzeć go o dokładny wdrożony SHA `f3237e942...`, a nie o brudny stary root ani uszkodzony checkout;
- utworzyć jedną gałąź integracyjną, np. `codex/consultify-canonical-cleanup-20260814`;
- porównać rozbieżną linię integracyjną i kandydaty commit po commicie;
- przenosić wyłącznie świadomie zaakceptowane commity z dowodami testów;
- stary klon iCloud pozostawić czasowo jako archiwum tylko do odczytu.

## Etap 4 — kontrolowana redukcja

Status: WYMAGA DRUGIEJ, ODDZIELNEJ ZGODY DESTRUKCYJNEJ

Dopiero po raporcie zabezpieczenia:

- usunąć z rejestru wyłącznie potwierdzone `REDUNDANT_CLEAN`;
- usunąć brakujące/stare wpisy worktree dopiero po porównaniu z rejestrem plików;
- branch można usunąć wyłącznie, gdy jego tip jest osiągalny z zachowanego ref/bundle i nie ma unikalnych zmian;
- `BROKEN_CHECKOUT` najpierw archiwizować i wyjaśnić, potem usuwać;
- ograniczyć aktywne worktree do maksymalnie 3–5;
- dopiero po `git fsck`, weryfikacji bundle i kopii wykonać konserwację obiektów Git; bez agresywnego natychmiastowego prune.

## Etap 5 — higiena operacyjna

- jeden agent = jeden jawnie nazwany worktree i jedna gałąź;
- każdy start wymaga: canonical base SHA, clean status, owner, allowlista plików i DoD;
- każdy handoff wymaga: commit, clean status, test evidence i listy nierozwiązanych luk;
- brak pracy bezpośrednio w archiwalnym root iCloud;
- automatyczny preflight blokuje start na brudnym lub niewłaściwym checkoutcie;
- worktree ma właściciela, cel, datę utworzenia i termin decyzji: integrate/archive/delete;
- wygenerowane raporty, screenshoty, trace i cache muszą trafiać do jawnych katalogów ignorowanych przez Git;
- żadnego broad staging ani współdzielonego worktree pomiędzy agentami.

## Etap 6 — brama wznowienia budowy

Budowę Agenta można wznowić dopiero, gdy:

- istnieje jeden wskazany common Git dir i jeden czysty kanoniczny checkout;
- SHA demo jest zabezpieczony nazwanym refem, bundle i — po zgodzie — remote;
- wszystkie unikalne WIP mają manifest i odtwarzalną kopię;
- nie istnieją niesklasyfikowane brudne checkouty (`UNKNOWN = 0`) albo mają jawnego właściciela i kwarantannę;
- aktywnych worktree jest nie więcej niż 5;
- `git fsck`, odtworzenie testowe bundle i kontrola sum przechodzą;
- canonical checkout przechodzi typecheck, build oraz ustaloną bramkę testów;
- Railway nadal wskazuje oczekiwany dokładny SHA;
- rejestr środowiska i zasady pracy agentów są zapisane w repozytorium.

## Etap 7 — chirurgiczny rejestr braków modułowych

Status: W TRAKCIE

Po uporządkowaniu pochodzenia kodu każdy moduł otrzymuje jedną kartę wykonawczą
w `docs/cleanup/MODULE_COMPLETION_TASK_REGISTRY_2026-08-15.md`. Karta nie może
być ogólnym backlogiem. Musi zawierać:

- kanoniczny cel, wejścia, wyjścia, właściciela danych i handoff do następnego
  modułu;
- dokładny łańcuch `menu -> route -> ekran -> API -> serwis -> migracja ->
  readback`;
- elementy `LIVE_CONNECTED`, `IMPLEMENTED_UNMOUNTED`, `MISWIRED`, `ORPHAN`,
  `DUPLICATE`, `SUPERSEDED` i `MISSING`;
- jedną kanoniczną implementację oraz wskazane warianty, których nie wolno już
  rozwijać;
- osobne gap IDs dla każdej brakującej funkcji, bez łączenia niezależnych luk w
  jedno nieostre zadanie;
- wymagane dane demonstracyjne, role, flagi, migracje i zależności;
- komendę reprodukcji, test pozytywny, negatywny, replay/idempotency, tenant i
  cold-reload;
- status demo i dokładny SHA dowodu; brak dowodu oznacza `EVIDENCE_MISSING`, a
  nie `DONE`.

DoD etapu: każdy moduł menu ma kartę, każdy wykryty brak ma stabilny task/gap ID,
owner, priorytet, allowlistę plików, zależności i obserwowalny warunek końcowy.
Nie istnieją wpisy typu „dokończyć UI”, „podłączyć backend” albo „naprawić
testy” bez dokładnego kontraktu zachowania.

## Etap 8 — pakiety wykonawcze dla agentów

Status: W TRAKCIE

Każdy gap dopuszczony do implementacji otrzymuje osobny pakiet w
`docs/cleanup/execution-packets/`. Pakiet jest instrukcją wykonania, a nie
ponownym zadaniem badawczym. Zawiera obowiązkowo:

- baseline SHA, branch/worktree policy i wyłącznego właściciela zadania;
- problem biznesowy oraz oczekiwane zachowanie użytkownika krok po kroku;
- dokładne komponenty i kontrakty do wykorzystania oraz kod historyczny tylko
  jako źródło do selektywnego odzyskania;
- changed-file allowlist i jawne pliki współdzielone, których agent nie może
  samodzielnie edytować;
- sekwencję implementacji frontend/backend/schema/data bez whole-branch merge;
- kryteria bezpieczeństwa, governance, provenance, idempotency i uczciwych
  stanów unavailable/error;
- pełną macierz testów oraz wymagane artefakty evidence;
- definicję `DONE` opartą na zachowaniu i readback, nie na liczbie commitów ani
  deklaracji wykonawcy;
- handoff dla integratora: commit SHA, czysty status, test evidence, znane luki
  i rollback/recovery path.

DoD etapu: wszystkie zadania pierwszej fali mają gotowe, rozłączne pakiety;
kolizje w `AppRoutes`, menu, globalnych flagach, migratorze, API barrel,
deployment config i globalnych tokenach są przydzielone wyłącznie integratorowi.

## Etap 9 — plan integracji, odbioru i uruchomienia

Status: OCZEKUJE NA ETAPY 7–8 ORAZ CLEAN-001/CLEAN-002

Implementacje są przyjmowane do jednego release candidate wyłącznie falami
zapisanymi w rejestrze zadań. Dla każdej fali integrator:

1. potwierdza exact baseline i brak nowych niezinwentaryzowanych zmian;
2. przenosi reviewed module diff lub pojedynczy commit, nigdy cały brudny branch;
3. rozwiązuje shared-file changes seryjnie;
4. uruchamia focused tests, typecheck/build, fresh i upgrade PostgreSQL oraz
   role/tenant/replay negatives;
5. wykonuje signed-in desktop/mobile golden flow na normalnych routes, bez
   query/localStorage activation i test-support;
6. wykonuje wizualny odbiór Consultify: tokeny, typografia, gęstość, hierarchia,
   loading/empty/error, responsywność oraz brak UUID i technicznych enumów;
7. zapisuje readback danych i zgodność UI/API/DB;
8. promuje jeden immutable candidate SHA i sprawdza, że UI, `/api/health`,
   artefakt oraz demo wskazują ten sam SHA;
9. aktualizuje kartę modułu na `DONE` dopiero po komplecie dowodów; w innym
   przypadku zachowuje `PARTIAL`, `BLOCKED` lub `EVIDENCE_MISSING`.

DoD etapu: istnieje jeden czysty release candidate, pełny gate ma jawny wynik,
każdy moduł ma decyzję MVP/later i dowód stanu, demo odpowiada kandydatowi, a
rollback oraz recovery są sprawdzone. Dopiero wtedy system jest gotowy do
systematycznego odbioru lub uruchomienia.

## Dwie zgody właściciela

1. **Zgoda A — preservation:** tworzenie refs, bundle, manifestów i commitów kwarantanny. Bez kasowania.
2. **Zgoda B — cleanup:** usuwanie potwierdzonych redundantnych worktree/branchy i późniejsza konserwacja obiektów Git.

Zgoda B może zostać wydana dopiero po przedstawieniu wyników Zgody A i listy dokładnych ścieżek przeznaczonych do usunięcia.
