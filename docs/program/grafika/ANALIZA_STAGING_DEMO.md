---
doc_id: program-analiza-staging-demo
status: investigation
owner: piotr
truth_type: measurement
established: 2026-08-31
---

# ANALIZA: staging kontra demo — co się naprawdę stało i jak wyjść na staging

**Tryb śledztwa:** read-only. Zero zmian w plikach produktu, zero commitów, zero
kontaktu z Railway i z jakąkolwiek bazą. Każde twierdzenie ma dowód `plik:linia`
albo SHA. Czego nie dało się ustalić z repozytorium — jest wypisane osobno,
w sekcji „Luki", i **nie zostało zgadnięte**.

**★ Uwaga o pomiarze.** Katalog `/private/tmp/m03` jest **współdzielonym
worktree** — w trakcie tego śledztwa tip linii przesunął się z `cd6c5d02f0`
(11:31) na `2d94ec35d7` (11:45). Liczby w tabelach są z pierwszego pomiaru;
pomiar kontrolny na nowym tipie daje `demo…HEAD = 0 / 3928`,
`develop…HEAD = 16 / 11873`, `f87043a941..HEAD = 918`. **Różnica to dwa commity
i niczego nie zmienia we wnioskach** — ale przy każdym powtórzeniu tych komend
liczby będą nieco inne i to jest normalne, nie błąd.

**Punkt wyjścia (dosłowne słowa właściciela, 31.08):**

> „Rozłączyliśmy staging od demo kilka dni temu. (…) powinniśmy przekopiować na
> demo to, co było na stagingu. Jeżeli tego nie widzisz, to oznacza, że nie
> zostało to dobrze zrobione. Nie podnosimy demo o te 11 tysięcy commitów, tylko
> powinniśmy skopiować demo na staging i podnosić je wspólnie. (…) W zasadzie tak
> naprawdę te dwie instancje są jeszcze sobie równe i powinny być sobie równe."

**Odpowiedź w jednym zdaniu:** właściciel ma rację co do intencji i rację co do
tego, że „nie zostało to dobrze zrobione" — rozłączenie wykonano **w papierze i
w połowie kodu**, nie wykonano go w **bazie** ani w **mechanizmie powrotu na
demo**; a liczba „11 tysięcy commitów" dotyczy martwej gałęzi `develop`, nie
demo — demo dzieli od nas **3926 commitów**, nie 11 871.

---

## 1. Chronologia — co się wydarzyło w sprawie staging/demo

Kolejność zdarzeń odtworzona z rejestru decyzji
`docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md`
(dalej: **rejestr**) i z historii gałęzi.

| Kiedy | Co | Kto | Dowód |
|---|---|---|---|
| **2026-08-13 14:01** | Ostatni commit na `origin/demo`. Od tego dnia gałąź demo stoi. | — | `e45904dc7940f259b9cf017c283264d5c166c9ab` |
| **2026-08-26 07:07** | Ostatni **udany** deploy stagingu przed śledztwem (`d43e52c0`), z gałęzi **backupowej** `github-backup/backup/detached-e6ca206`, która nie jest przodkiem `origin/demo`. | pipeline/ręcznie | rejestr, wiersz 216 (DEC-165), punkt (c) |
| **2026-08-26 22:36** | Deploy `16f5744f` — **FAILED bez logów**. Bramka migracji trafiła na bazę z 106 migracjami zaległymi i fail-closed zablokowała wdrożenie. | — | rejestr:216, punkt (b) |
| **2026-08-28** | **DEC-165**: rozstrzygnięte, że aplikacja stagingu i bramka migracji celowały w **DWIE RÓŻNE bazy**. Mapa: aplikacja → `trolley.proxy.rlwy.net:28146` (106 migracji pending), bramka → `Postgres-Rehearsal` (`sakura`). Trzy bazy nazywają się `railway` — to była bezpośrednia przyczyna. | nadzorca | rejestr:216 |
| **2026-08-28** | **DEC-171 — granica ochrony danych.** Właściciel dosłownie: „`consultify.ai` — to produkcja. A `demo.consultify.ai` i `staging.consultify.ai` **ma tą samą bazę** — ale ona nie jest wartościowa — raczej śmieci seedowane". | **właściciel** | rejestr:222 |
| **2026-08-28** | **DEC-172** — plan 5 etapów porządkowania środowisk: **E0** rozkrzyżowanie domen Railway, **E1** poprawki w repo, **E2** rename bazy rehearsal, **E3** poprawka zmiennych GitHub, **E4** ★ *rozcięcie zlepka staging↔demo*, **E5** produkcja (osobna zgoda). | nadzorca | rejestr:223 |
| **2026-08-28** | **DEC-176 — ROZSTRZYGNIĘCIE WŁAŚCICIELA: JEDNA BAZA DLA DEMO I STAGING.** „wszystko celuje w JEDNĄ bazę, pozostałe dwie parkujemy… Koszt przyjęty świadomie: staging nie ma własnej piaskownicy, więc migracja testowa uderza także w demo. Etapy **E0** i **E4 pozostają do wykonania po stronie właściciela**." | **właściciel** | rejestr:227 |
| **2026-08-28** | **DEC-227 — to jest „rozłączenie", o którym mówi właściciel.** Dosłownie: „zostawmy na razie demo. Na stagingu chcę widzieć absolutnie wszystko. (…) Teraz skupiamy się na stagingu." Rozstrzygnięcie: (a) **demo NIETKNIĘTE**, (b) staging = środowisko pełnej gotowości, (c) priorytet programu → staging. | **właściciel** | rejestr:278 |
| **2026-08-28** | **DEC-237** — gałąź „bezpieczników wdrożeń" (dyżur 38) scalona jako `9b38d4625c`; **zawęża domeny stagingu do `staging.consultify.ai`, rozdzielając staging od demo — to jest etap E0 W KODZIE.** Zaznaczone jako `DECISION_REQUIRED — DO WYKONANIA PRZEZ WŁAŚCICIELA` (zmienne GitHub). | nadzorca | rejestr:288 |
| **2026-08-28 20:28** | Commit `f87043a941` „fix(release-gate): tp_chain przestaje blokowac wdrozenia strukturalnie". | — | `f87043a9412d6f208f99bd0b5c7e23bce4d01c4d` |
| **2026-08-29** | **DEC-251 — kamień milowy: „STAGING DZIAŁA NA NASZYM KODZIE".** Deployment `583380ee` SUCCESS, SHA **`f87043a941`**, `/api/health` ok, migracje `failed=0 pending=0`. Uwaga w tym samym wpisie: weryfikacja przez `gitSha` jest **bezwartościowa przy `railway up`**. | nadzorca | rejestr:303 |
| **2026-08-29** | **DEC-335/336** — warunki 1 i 2 wypchnięcia na staging zamknięte (7/7 flag, 0/4 czerwieni blokuje), **z zastrzeżeniem**: zaakceptowane zrzuty pochodzą z DEV-RENDERU, nie z realnego produktu. | nadzorca + właściciel | rejestr:387, 388 |
| **2026-08-30 18:39** | **D-4 właściciela:** „Powierzchnia odbiorów — **STAGING, nie demo** — *od dłuższego czasu pracujemy na stagingu; instancje rozdzielone*". | **właściciel** | `74775cea67`, `docs/program/funkcje/DECYZJE_WLASCICIELA_2026-08-30_WIECZOR.md` |
| **2026-08-30 18:39** | **K5 ścieżki wyjścia** doprecyzowany: „instancje SĄ rozdzielone… powierzchnią bieżącej pracy oraz odbiorów jest STAGING… **Demo dostaje wyłącznie stan zaakceptowany na stagingu**… 3709 commitów dystansu schodzi JEDNYM zaplanowanym scaleniem kandydata, nie kroplówką." | nadzorca | `docs/program/SCIEZKA_WYJSCIA.md` |
| **2026-08-30 19:39** | ★ **REGUŁA 11 — i tu leży rozjazd.** Właściciel zapytał wprost, czy pracujemy na demo czy na staging. Zapisana odpowiedź: **„na żadnym z nich"** — tor grafiki pracuje lokalnie (harness `dev-render`, port 3020, dane mockowe). Decyzja właściciela po wyjaśnieniu: „Dla szybkości pracujemy lokalnie… **Później przerzucimy wszystko na staging świadomie** — szkoda czasu." Obowiązek 3: „**`origin/demo` pozostaje nietknięte**". | **właściciel + nadzorca** | `474e954d3e`, `docs/program/grafika/00_ZASADY_PRACY.md:313-341` |
| **2026-08-31 06:54** | Pomiar M3 wykonany na „stagingu" w sesji read-only — **host `trolley/railway`**. 14 domów / 67 inicjatyw / 467 zadań. ★ **Uwaga o pochodzeniu:** ten commit **NIE jest w linii integracyjnej** — leży na niescalonych gałęziach dyżurowych `codex/day204-migracja-e2-20260831` i dalszych. Dowód pomiaru jest ważny, ale sam zapis czeka na scalenie. | nadzorca (za zgodą D-12) | `db7d41419f`; `git merge-base --is-ancestor db7d41419f HEAD` → **NIE**; `git branch --contains db7d41419f` |
| **2026-08-31 11:31** | Bieżący tip **linii integracyjnej** `codex/m03-admin-20260824`. Żadna gałąź go nie zawiera (`git branch --contains HEAD` → tylko on sam), więc to jest tip. | — | `cd6c5d02f0e8a108c59190e23893a5c864dbcf91` |
| **2026-08-31, w toku** | **Co najmniej 7 gałęzi dyżurowych w locie**, każda rozeszła się z linią 109 commitów temu i niesie 150-180 własnych: `day204`…`day210`. | robotnicy | `git rev-list --left-right --count HEAD...codex/day207-write-proposal-20260831` → `109 182` |

### Wniosek chronologiczny

„Rozłączenie" z 28.08 było **rozłączeniem ROLI, nie infrastruktury**:

- **rozłączono cel produktowy** (DEC-227): staging pokazuje wszystko, demo się nie rusza — **WYKONANE, w decyzji**;
- **rozłączono cel wdrożenia w kodzie strażnika** (DEC-237/E0): staging → tylko `staging.consultify.ai` — **WYKONANE, `scripts/validate-deploy-target.sh:245-250`**;
- **NIE rozłączono baz danych** — właściciel sam wybrał JEDNĄ wspólną bazę (DEC-176), a etap **E4 „rozcięcie zlepka staging↔demo" pozostał do wykonania i nie ma w repo ANI JEDNEGO śladu wykonania**;
- **NIE zbudowano drogi powrotnej staging → demo** — patrz §3, znalezisko nr 3. To jest dokładnie to, czego właściciel „nie widzi".

---

## 2. Stan faktyczny — instancja → kod → baza → data

| Instancja | Kod: skąd i jaki SHA | Kiedy | Czym wdrożono | Baza | Dowód |
|---|---|---|---|---|---|
| **staging.consultify.ai** | `f87043a941` (2026-08-28 20:28). Jest przodkiem naszego HEAD; **HEAD jest 916 commitów dalej**. | 2026-08-29 | `railway up` przez pipeline **albo ręcznie** — z repo nie da się rozstrzygnąć (patrz Luka L1) | **wspólna z demo** — `trolley.proxy.rlwy.net` | rejestr:303 (DEC-251, deployment `583380ee`); `git merge-base --is-ancestor f87043a941 HEAD` → TAK; `git rev-list --count f87043a941..HEAD` → **916** |
| **demo.consultify.ai** | gałąź `origin/demo` = `e45904dc79` (2026-08-13 14:01) — **stoi od 18 dni** | 2026-08-13 lub później (redeploy tego samego SHA) | `scripts/deploy-demo.sh` (push `HEAD:demo --force-with-lease` + Railway API) | **wspólna ze stagingiem** — `trolley` | `git log -1 origin/demo`; `scripts/deploy-demo.sh:69`, `:21-23` |
| **consultify.ai (PRODUKCJA)** | `origin/main` = `627b7d93ae` (2026-07-16) | — | workflow `deploy-production`, wymaga `confirm_production=yes` | `centerbeam` — **NIETYKALNA** | `.github/workflows/railway-deploy.yml:198-200`; rejestr:222 (DEC-171) |

### Dowody na wspólną bazę (trzy niezależne źródła)

1. **Właściciel, 28.08:** „`demo.consultify.ai` i `staging.consultify.ai` **ma tą samą bazę**" — rejestr:222.
2. **Runbook operacyjny:** „`demo.consultify.ai` i `staging.consultify.ai` = **jedna wspólna baza**, zawartość bezwartościowa" — `docs/operations/RUNBOOK_ROZJAZD_BAZ_RAILWAY_PL.md:8-10`.
3. **Skill promocji:** „Baza demo/staging = **TROLLEY** (`trolley.proxy.rlwy.net`, **WSPÓLNA z demo**). PROD=centerbeam" — `.claude/skills/consultify-promocja-demo/SKILL.md:11`.

Potwierdzenie pomiarem z **31.08**: sesja read-only opisana jako „staging" łączyła
się z hostem **`trolley/railway`** (`CODEX_DAY197_MIGRACJA_E1_REPORT.md`, sekcja
„M3 — WYNIK REALNY"). Czyli **cztery dni po „rozłączeniu" staging i demo dalej
czytają tę samą bazę** — zgodnie z DEC-176, ale niezgodnie z tym, jak brzmi
słowo „rozłączyliśmy".

### Odległości gałęzi — twarde liczby (`git rev-list --left-right --count X...HEAD`)

HEAD = `codex/m03-admin-20260824` @ `cd6c5d02f0` (2026-08-31 11:31).

| Gałąź | Tip | Data tipa | za HEAD | przed HEAD | HEAD jest potomkiem? |
|---|---|---|---|---|---|
| **`origin/demo`** | `e45904dc79` | 2026-08-13 | **0** | **3926** | **TAK** — merge-base = sam tip demo |
| `origin/Londyn` | `f3a45b0c90` | 2026-07-07 | 0 | 8235 | TAK |
| `origin/staging` | `aa0032bb72` | 2026-06-17 | 0 | 10464 | TAK |
| **`origin/develop`** | `d675885189` | **2026-06-02** | **16** | **11871** | **NIE** — 16 commitów tylko tam |
| `origin/main` | `627b7d93ae` | 2026-07-16 | 5 | 11771 | NIE |
| tag `staging-deployed` | `1b0ead22ff` | **2026-06-10** | 0 | — | TAK (6960 commitów **za** `origin/demo`) |

**★ Rozbrojenie liczby „11 tysięcy".** 11 871 to dystans do `origin/develop` —
gałęzi, która stoi od **2 czerwca** i której pipeline używa jako źródła stagingu.
**Demo nie jest oddalone o 11 tysięcy commitów, tylko o 3926**, i jest naszym
czystym przodkiem: `git merge-base --is-ancestor origin/demo HEAD` → TAK, zero
commitów wyłącznie na demo. **Podniesienie demo to zwykłe przewinięcie do przodu
(fast-forward), nie żadna operacja historyczna.** Intuicja właściciela („nie
podnosimy demo o te 11 tysięcy") jest słuszna i nic takiego nie jest potrzebne.

Liczba `3709` w `SCIEZKA_WYJSCIA.md` (stan z 30.08) i dzisiejsze `3926` to ta
sama wielkość — urosła o commity dwóch dni pracy. Zgodność potwierdza, że
K5 mierzył demo poprawnie.

---

## 3. Co się rozjechało wobec intencji „instancje mają być sobie równe"

### Znalezisko 1 — instancje NIE są sobie równe: 3926 commitów i 18 dni różnicy

Właściciel mówi: „te dwie instancje są jeszcze sobie równe i powinny być sobie
równe". **Dziś nie są.**

- demo stoi na kodzie z **13.08**;
- staging stoi na kodzie z **28.08** (`f87043a941`), czyli **3010 commitów przed demo** (`git rev-list --count origin/demo..f87043a941`);
- nasza praca jest **916 commitów przed stagingiem** i **3926 przed demo**.

To trzy różne punkty, nie dwa równe. Krok „przekopiować na demo to, co było na
stagingu" **nie ma w repozytorium żadnego śladu wykonania** — `origin/demo` nie
dostał commitu od 13.08.

### Znalezisko 2 — pipeline stagingu wisi na martwej gałęzi `develop`

`.github/workflows/railway-deploy.yml:7-8` — `on: push: branches: [develop]`.
`.github/workflows/railway-deploy.yml:43` — job `deploy-staging` uruchamia się
przy `push`, albo przy `workflow_dispatch` **wyłącznie** z `refs/heads/develop`
lub `refs/heads/staging`. `scripts/validate-deploy-target.sh:246` potwierdza to
fail-closed: `expected_refs="refs/heads/develop refs/heads/staging"`.

`origin/develop` stoi od **2026-06-02** i ma **16 commitów, których nasza linia
nie zawiera** — więc **nie jest to przewinięcie do przodu**; wymaga świadomej
decyzji (merge albo nadpisanie). To jest **realny bloker nr 1** i jednocześnie
źródło liczby „11 tysięcy", które przywędrowało do rozmowy z niewłaściwej
gałęzi.

### Znalezisko 3 — ★ droga powrotna staging → demo NIE ISTNIEJE w repozytorium

To jest dokładnie to, czego właściciel „nie widzi", i ma rację, że „nie zostało
to dobrze zrobione".

- W `.github/workflows/railway-deploy.yml` na naszej linii są **tylko dwa joby**: `deploy-staging` (:41) i `deploy-production` (:198). **Nie ma joba promocji na demo.**
- `git log --all -S "confirm_demo" -- .github/workflows/railway-deploy.yml` → **zero wyników w całej historii repozytorium.**
- Strażnik `scripts/validate-deploy-target.sh:251-256` **ma już gałąź `demo)`** — ale oczekuje `refs/heads/demo` i dopuszcza hosty `demo.consultify.ai stage.consultinity.ai`. Czyli obsługuje **stary** tryb „wypchnij gałąź demo", a nie promocję zweryfikowanego SHA.
- Jedyny mechanizm demo to `scripts/deploy-demo.sh`, który w linii **69** robi `git push origin HEAD:demo --force-with-lease` i w linii **75** wyzwala Railway z `latestCommit: true`. To jest **push siłowy z checkoutu dewelopera** — sprzeczny z regułą CLAUDE.md (demo = merge, nigdy force) i ze skillem `consultify-promocja-demo`.

**★ Gotowa naprawa istnieje, ale nigdy nie została scalona.** W drugim checkoucie
właściciela — `/Users/piotrwisniewski/Developer/Consultify`, gałąź
`codex/wave3-16-module-acceptance-20260821`, tip `c96715e03f` (2026-08-29) —
leżą **NIEZACOMMITOWANE** zmiany:

| Plik | Zmiana | Znaczenie |
|---|---|---|
| `.github/workflows/railway-deploy.yml` | **+120 linii**: nowy job **„Promote Last Verified Staging SHA to Demo"**, `if: … inputs.environment == 'demo' && inputs.confirm_demo == 'yes'`, krok „Resolve immutable promotion source" czytający tag `staging-deployed`, `GIT_REF: refs/tags/staging-deployed` | dokładnie mechanizm „przekopiuj staging na demo", którego brakuje |
| `scripts/deploy-demo.sh` | **-105 linii**: skrypt zastąpiony komunikatem „deploy-demo.sh is disabled… Demo is a frozen presentation environment. It must not deploy latestCommit, force-push a branch, or deploy directly from a developer checkout." | likwiduje push siłowy na demo |
| `scripts/validate-deploy-target.sh` | `demo)` → `expected_refs="refs/tags/staging-deployed"`, `allowed_hosts="demo.consultify.ai"` | promocja tylko z tagu, koniec skrzyżowanej domeny `stage.consultinity.ai` |

**Uwaga: te zmiany są zbudowane na STARSZEJ wersji strażnika** (ich `-` pokazuje
`allowed_hosts="demo.consultify.ai stage.consultinity.ai"` dla **stagingu**, czyli
stan sprzed scalenia `9b38d4625c`). Nasza linia m03 ma nowszy, bogatszy strażnik
(§B — porównanie bazy migracji z bazą aplikacji). **Nie wolno ich wziąć w
całości — trzeba przenieść z nich TYLKO job promocji na demo i wpis `demo)` z
tagiem**, na wierzch obecnego strażnika.

### Znalezisko 4 — tag `staging-deployed` jest martwy, a promocja miałaby na nim stać

Workflow zapisuje po udanym wdrożeniu stagingu tag `staging-deployed`
(`.github/workflows/railway-deploy.yml:189-196`), a produkcja weryfikuje przez
niego źródło promocji (`:230`, „Verify promotion source (must match last staging
deploy)"). Ten tag wskazuje dziś `1b0ead22ff` z **2026-06-10** — czyli **6960
commitów ZA `origin/demo`**.

Wniosek: **GitHub-owy pipeline nie wdrożył stagingu ani razu od 10 czerwca.**
Wdrożenie z 29.08 (`583380ee` / `f87043a941`) tagu nie ruszyło — co jest spójne z
uwagą z DEC-251, że weryfikacja SHA „jest BEZWARTOŚCIOWA przy `railway up`".
Dopóki tag nie zostanie odświeżony prawdziwym przebiegiem pipeline'u, **każda
promocja oparta na tym tagu wysłałaby na demo kod z czerwca** — to jest cichy,
kosztowny wektor regresji.

### Znalezisko 5 — rozjazd między tym, co właściciel sądzi, a tym, co zapisano

- Właściciel 30.08 (D-4): „**od dłuższego czasu pracujemy na stagingu**".
- Zapis nadzorcy z tego samego wieczoru, reguła 11: „Właściciel zapytał wprost, czy pracujemy na `demo` czy `staging`. **Odpowiedź brzmi: na żadnym z nich.**" — praca lokalna w harnessie `dev-render`, zdalne tylko `github-backup`, „`origin/demo` pozostaje nietknięte" (`docs/program/grafika/00_ZASADY_PRACY.md:313-331`).
- DEC-336 dokłada to samo od drugiej strony: zrzuty, na których właściciel akceptował ekrany, pochodzą z **dev-renderu z danymi makietowymi**, nie z działającego produktu (rejestr:388).

Nie ma tu winnego — jest **dług weryfikacji, świadomie zaciągnięty i uczciwie
nazwany** w regule 11 („Później przerzucimy wszystko na staging świadomie").
Ale to znaczy, że **916 commitów pracy z 29-31.08 nie zostało uruchomione na
żadnym żywym środowisku**, a właściciel jest przekonany, że staging je pokazuje.
Plan w §5 spłaca ten dług jako pierwszy krok.

### Znalezisko 6 — migracje: 8 nowych, bramka staging bez kontroli jakości, zero zapisu stanu wdrożonego

**a) Osiem nowych migracji czeka na wdrożenie.**
`git diff --name-status f87043a941..HEAD -- server/migrations/` → **8 plików, wszystkie `A` (dodane), zero zmodyfikowanych, zero usuniętych**:

```
20260830_day144_kpi_lifecycle_decouple.sql     20260830_day166_decision_risk_fields.sql
20260830_day147_object_attachments.sql         20260830_day175_task_risk_alternatives.sql
20260830_day158_kpi_crosswalk.sql              20261670_p2_runtime_schema_repairs.sql
20260830_day159_chunk_org_backfill.sql         20261720_day131_teresa_knowledge_boundaries.sql
```

Wszystkie addytywne (`ALTER TABLE … ADD COLUMN IF NOT EXISTS` + jeden `UPDATE`
backfill); żadna nie tworzy tabeli. To dobra wiadomość dla odwracalności.

**b) Bramka migracji jest fail-closed — ale siedzi w Railway, nie w CI.**
`railway.json:13` i `railway.api.json:8` → `"preDeployCommand": "node dist/scripts/release-migration-gate.js"`.
Bramka blokuje wdrożenie przy `pending > 0`, `failed > 0`, `skipped > 0`
(`server/scripts/release-migration-gate.ts`). **Nie jest wywoływana z
`railway-deploy.yml`** — działa wewnątrz usługi aplikacji i dlatego, jak sama
zapisuje w logu, **nie potrafi wykryć rozjazdu baz** (DEC-165); jedynym miejscem
tej kontroli jest `validate-deploy-target.sh` §B uruchamiany z GitHub Actions.

**c) ★ Job stagingu NIE uruchamia bramki jakości.**
`scripts/deploy-gate.sh` (tsc, eslint, oba buildy, `release:gate:data-truth`) jest
wywoływany **wyłącznie w jobie produkcyjnym**: `.github/workflows/railway-deploy.yml:253-254`,
wewnątrz `deploy-production` (zaczyna się w `:198`). Job `deploy-staging`
(`:41-196`) ma tylko `validate-deploy-target.sh`. Skutek: **staging przyjmie kod,
który się nie kompiluje** — dokładnie tak, jak w DEC-251, gdzie „kod nie
kompilował się od tygodnia" i wdrożenie było pierwszym momentem, kiedy cokolwiek
uruchomiło prawdziwą kompilację.

**d) W repozytorium NIE MA ŻADNEGO zapisu stanu migracji wdrożonego na
staging/demo.** Jedyna kotwica to zdanie prozą z rejestru:303 — `failed=0 pending=0`
z 29.08, **bez liczby bezwzględnej** i **sprzed** wszystkich 8 nowych migracji
(dodane 30.08). Wszystkie liczby typu `868/868` z dowodów dotyczą **efemerycznych
kontenerów lokalnych**, nie stagingu; `ODBIOR_161_LANCUCH_MIGRACJI.md:94` mówi to
wprost: „Demo i staging — celowo, zgodnie z zakazem" (nie mierzone). To jest
Luka **L5**.

**e) Ryzyko główne pozostaje nieusunięte u źródła.** Wzorzec „`IF NOT EXISTS` =
first-writer-wins" (DEC-251, rejestr:303) sprawia, że bazy o różnej historii mają
różne schematy — cytat z rejestru: *„to wyjaśnia, czemu demo działa a staging
nie"*. Naprawiono 5 przypadków wzorcem „nowa migracja przed blokującą + `DO $$`",
ale **nie ma skanu całego korpusu na podwójnych producentów**, a wszystkie 8
nowych migracji dalej używa `IF NOT EXISTS`. **Wniosek operacyjny: zielona
migracja na demo NIE jest dowodem, że przejdzie na stagingu.**

**f) Bramka „świeżej bazy" istnieje, ale nie objęła dwóch ostatnich migracji.**
`.github/workflows/day161-fresh-migration-gate.yml` uruchamia pełny przebieg od
pustej bazy — ale wyzwala się tylko na `main, develop, Londyn, demo`. Nasza
gałąź `codex/m03-admin-20260824` **nigdy jej nie uruchomiła**; ostatni zmierzony
przebieg (`868/868`) pochodzi ze znacznika sprzed `day166` i `day175`.

### Znalezisko 7 — etapy E0 i E4 właściciela nie mają śladu wykonania

DEC-176 zostawił dwa etapy „po stronie właściciela":

- **E0** — rozkrzyżowanie domen w Railway (środowisko `staging` ma domenę ze słowem „demo" i odwrotnie). W repo E0 jest wykonane **tylko w kodzie strażnika** (`validate-deploy-target.sh:248`), po stronie panelu Railway — **brak śladu** (Luka L2). Objaw resztkowy: gałąź `demo)` strażnika dalej dopuszcza `stage.consultinity.ai` (`:254`).
- **E4** — rozcięcie zlepka staging↔demo (osobne bazy). **Zero śladu w repo**; przeciwnie — pomiar z 31.08 dalej celuje w `trolley`.

---

## 4. Czego NIE DA SIĘ ustalić z repozytorium (luki — nie zgadywać)

| # | Czego nie wiadomo | Gdzie to widać / kto może odczytać |
|---|---|---|
| **L1** | Czy wdrożenie stagingu z 29.08 (`583380ee`) poszło przez GitHub Actions, czy ręcznym `railway up` z laptopa. Rejestr podaje ID deploymentu, ale nie źródło. Poszlaka za „ręcznie": tag `staging-deployed` nie został ruszony, a workflow ustawia go bezwarunkowo po sukcesie (`:189`). | Railway → środowisko staging → historia wdrożeń; GitHub → Actions → historia „Railway Deploy" |
| **L2** | Czy właściciel wykonał **E0** (rozkrzyżowanie domen) i czy `staging.consultify.ai` w ogóle wskazuje dziś na środowisko `staging`. | Railway → Settings → Domains, oba środowiska |
| **L3** | Aktualne wartości zmiennych GitHub: `STAGING_FRONTEND_URL`, `STAGING_API_HEALTH_URL`, `STAGING_DB_HOST_FINGERPRINT`, `RAILWAY_STAGING_PROJECT_ID`, `RAILWAY_STAGING_ENVIRONMENT`, `RAILWAY_STAGING_APP_SERVICE`, `DEPLOY_TARGET_GUARD_ENFORCE`. Runbook (`RUNBOOK_ROZJAZD_BAZ_RAILWAY_PL.md:55-68`) mówi, że `STAGING_FRONTEND_URL` wskazywał `stage.consultinity.ai`; strażnik dopuszcza dla stagingu **wyłącznie** `staging.consultify.ai` (`:248`) i jest tu fail-closed niezależnie od uzbrojenia (`:269-271`). Jeśli zmienna nie została poprawiona — **pierwszy przebieg padnie na kroku „Validate staging target mapping"**. | GitHub → Settings → Secrets and variables → Actions |
| **L4** | Czy sekrety `STAGING_APP_DATABASE_URL` i `STAGING_MIGRATION_DATABASE_URL` są ustawione. Bez nich strażnik §B **przepuści** deploy z głośnym ostrzeżeniem (tryb doradczy, `validate-deploy-target.sh:33-40`), ale nie da żadnej gwarancji, że migracje i aplikacja celują w tę samą bazę — czyli DEC-165 może wrócić bezgłośnie. | GitHub → Secrets |
| **L5** | Jaki jest **realny stan migracji na bazie `trolley`** dzisiaj i czy 8 nowych migracji już tam weszło. W repozytorium **nie ma żadnego zapisu stanu wdrożonego** — ostatnia liczba (`failed=0 pending=0`) pochodzi z logu wdrożenia z 29.08, dotyczy SHA `f87043a941` i **nie podaje liczby bezwzględnej**. Wszystkie liczby `868/868` i podobne dotyczą kontenerów lokalnych. | Railway → baza; albo log kolejnego wdrożenia |
| **L5a** | Czy ustawione są `vars.DEPLOY_TARGET_GUARD_ENFORCE` i `vars.STAGING_RELEASE_TARGET_DB_HOST_FINGERPRINT`. Jeśli nie — bramka §B jest doradcza, a `release-migration-gate.ts` sam zapisuje w logu, że wdrożenie „nie niesie żadnej kontroli rozjazdu międzyusługowego". | GitHub → Variables |
| **L6** | Czy istnieje świeży backup bazy demo/staging. Ostatnie zrzuty w repo-dowodach są z **22.08** (`.tmp/incident-20260822/db-backups/`, rejestr:223), PITR wyłączony na wszystkich 6 usługach. | Maszyna właściciela + panel Railway |
| **L7** | Co dokładnie zawiera 16 commitów, które są **tylko** na `origin/develop` (`git rev-list origin/develop ^HEAD`). Da się to odczytać z repo, ale wymaga osobnego przeglądu — **nie zostało w tym śledztwie przejrzane** i nie wolno zakładać, że są bezwartościowe. | `git log origin/develop ^HEAD` |

---

## 5. PLAN WYJŚCIA NA STAGING

Plan realizuje intencję właściciela **dosłownie**: podnosimy staging, na nim
odbieramy, a **zaakceptowany stan przenosimy na demo** — i nie ruszamy demo
żadną historią martwej gałęzi. Kolejność jest wiążąca; każdy krok ma dowód
powodzenia i drogę odwrotu.

**Zasada przewodnia:** demo dostaje **dokładnie ten SHA**, który przeszedł
odbiór na stagingu. Nie „mniej więcej to samo", nie „przewińmy demo do HEAD" —
ten sam commit. Dopiero to czyni instancje równymi w sensie, o który prosi
właściciel.

---

### KROK 0 — Zabezpieczenie (przed czymkolwiek)

Świeży zrzut bazy `trolley` (wspólnej dla demo i staging) oraz tag bezpieczny
`demo-safe-2026-08-31` na `origin/demo` @ `e45904dc79`.

- **Odwracalny:** n/d (to jest właśnie mechanizm odwracania).
- **Zgoda właściciela:** TAK — dotyka żywej bazy i tworzy tag zdalny.
- **Dowód powodzenia:** plik zrzutu z rozmiarem i datą; `git ls-remote --tags origin | grep demo-safe-2026-08-31`.
- **Cofnięcie:** usunięcie tagu; zrzut zostaje.
- **Uzasadnienie:** ostatni backup ma 9 dni (L6), PITR wyłączony, a KROK 4 puszcza migracje na bazę wspólną z demo.

### KROK 1 — Rozstrzygnąć 16 commitów `origin/develop` (L7)

Przejrzeć `git log origin/develop ^HEAD` (16 commitów, wszystkie sprzed 2 czerwca)
i wydać werdykt: przenieść wartość / uznać za martwe.

- **Odwracalny:** TAK (czysty odczyt).
- **Zgoda:** NIE (analiza).
- **Dowód:** lista 16 SHA z werdyktem per commit, dopisana do tego pliku.
- **Cofnięcie:** n/d.
- **Dlaczego przed KROKIEM 2:** bez tego KROK 2 albo je bezgłośnie porzuca, albo wciąga do linii m03 stan z czerwca. Oba są złe, jeśli podjęte przypadkiem.

### KROK 2 — Ustawić `develop` na kandydata stagingu

`develop` jest jedynym refem, z którego pipeline wdroży staging
(`railway-deploy.yml:7-8`, `:43`; `validate-deploy-target.sh:246`).
Wybrać **wariant A** (zalecany) albo B — zależnie od werdyktu z KROKU 1:

- **A. Merge:** `git checkout develop && git merge <kandydat> --no-ff` — zachowuje 16 commitów, historia rośnie, zero utraty.
- **B. Nadpisanie:** `git push origin <kandydat>:develop --force-with-lease` — dopuszczalne **tylko** jeśli KROK 1 orzekł, że 16 commitów jest martwych.

Kandydat = zamrożony SHA gałęzi roboczej, nie „HEAD w locie".

- **Odwracalny:** TAK — poprzedni `develop` jest zapisany jako `d675885189`; powrót to jeden push.
- **Zgoda:** **TAK** — wariant B to nadpisanie zdalnej gałęzi.
- **Dowód:** `git log -1 origin/develop` pokazuje kandydata; `git rev-list --count origin/develop..<kandydat>` = 0.
- **Cofnięcie:** `git push origin d675885189:develop --force-with-lease`.
- **Uwaga:** `develop` **nie jest** `demo` ani `Londyn` — zakaz force z CLAUDE.md tych gałęzi nie obejmuje. Mimo to wariant A jest bezpieczniejszy i zalecany.

### KROK 3 — Doprowadzić zmienne GitHub do zgodności ze strażnikiem (L3, L4)

Wg `RUNBOOK_ROZJAZD_BAZ_RAILWAY_PL.md` KROK 0 i KROK 2. Minimum, żeby przebieg nie padł:
`STAGING_FRONTEND_URL=https://staging.consultify.ai`, `STAGING_API_HEALTH_URL` na API stagingu.
Zalecane dodatkowo: `STAGING_APP_DATABASE_URL`, `STAGING_MIGRATION_DATABASE_URL`,
`STAGING_DB_HOST_FINGERPRINT` (kawałek hosta, **nie** `railway`).

- **Odwracalny:** TAK.
- **Zgoda:** **TAK** — zmiana konfiguracji konta; wykonuje **wyłącznie właściciel**, nadzorca nie ma tam dostępu.
- **Dowód:** przebieg z KROKU 4 przechodzi krok „Validate staging target mapping" bez `::warning::` o brakujących wejściach §B.
- **Cofnięcie:** przywrócenie poprzednich wartości (spisać je przed zmianą).
- **`DEPLOY_TARGET_GUARD_ENFORCE` zostawiamy WYŁĄCZONY** na ten przebieg — uzbrajamy dopiero, gdy sekrety §B są ustawione i jeden przebieg przeszedł zielono. Wykryty rozjazd blokuje deploy w obu trybach, więc nic nie tracimy.

### KROK 3b — Zamrozić kandydata i przepuścić go przez dwie bramki, których staging nie ma

Dwie kontrole, które job `deploy-staging` **pominie** (Znalezisko 6c, 6f), trzeba
wykonać ręcznie **przed** wdrożeniem — inaczej pierwszym testem kompilacji będzie
żywe środowisko, jak w DEC-251.

1. **Zamrozić SHA kandydata.** W locie jest co najmniej 7 gałęzi dyżurowych
   (`day204`…`day210`). Zgodnie z bramką K1 `SCIEZKA_WYJSCIA.md` („zero dyżurów
   w locie") — albo je scalić, albo świadomie odciąć kandydata bez nich.
   **Kandydat = jeden konkretny SHA, zapisany w rejestrze.**
2. **`bash scripts/deploy-gate.sh`** na kandydacie — tsc, eslint, oba buildy.
3. **`npm run test:migrations:day161:fresh`** — pełny przebieg łańcucha od pustej
   bazy w efemerycznym kontenerze. Obejmuje 8 nowych migracji, w tym `day166`
   i `day175`, których dotąd nic nie sprawdziło od zera.

- **Odwracalny:** TAK (wszystko lokalnie, efemeryczny kontener).
- **Zgoda:** NIE.
- **Dowód:** obie komendy zielone, wynik dopisany do rejestru wraz z SHA kandydata.
- **Cofnięcie:** n/d.
- **Jeśli czerwone:** NIE wdrażamy. Naprawa najpierw — to jest tańsze o rząd
  wielkości niż awaria na wspólnej bazie demo+staging.

### KROK 4 — Pierwsze wdrożenie stagingu z naszej linii

Push na `develop` z KROKU 2 wyzwala job `deploy-staging` sam
(`railway-deploy.yml:7-8`). Alternatywnie `workflow_dispatch` z `environment=staging`.

- **Odwracalny:** TAK — ponowne wdrożenie poprzedniego SHA.
- **Zgoda:** **TAK** — pierwsze żywe wdrożenie po 916 commitach; migracje uderzą w bazę **wspólną z demo** (DEC-176, koszt przyjęty świadomie). **Dlatego KROK 0 jest obowiązkowy.**
- **Dowód powodzenia — cztery rzeczy, wszystkie:**
  1. job „Deploy Staging" zielony;
  2. w logu wdrożenia `RELEASE_MIGRATION_GATE_PASS` z `pending=0 failed=0`;
  3. `/api/health` → `database` i `redis` connected, `/api/ready` → ready;
  4. **tag `staging-deployed` przesunięty na nowy SHA** (`git ls-remote --tags origin | grep staging-deployed`) — to jednocześnie zamyka Znalezisko 4.
- **Cofnięcie:** Railway → redeploy poprzedniego wdrożenia. **Migracje są addytywne i NIE cofają się** — stąd KROK 0.
- **Ryzyko nazwane:** wzorzec z DEC-251 — tabela z dwoma producentami i `CREATE TABLE IF NOT EXISTS` („first writer wins") potrafi wywrócić wdrożenie na bazie o innej historii. Pięć takich blokad zdjęto 28-29.08; przy 916 nowych commitach mogą być kolejne. To jest **najbardziej prawdopodobne miejsce awarii całego planu** — patrz też sekcja o migracjach niżej.

### KROK 5 — Odbiór na stagingu i zamrożenie SHA

Odbiory wg K5 `SCIEZKA_WYJSCIA.md` — **na żywym stagingu, nie w dev-renderze**
(to spłaca dług reguły 11 i zastrzeżenie DEC-336). Po akcepcie: zamrozić SHA.

- **Odwracalny:** TAK.
- **Zgoda:** **TAK** — to jest werdykt właściciela, sedno kroku.
- **Dowód:** zrzuty z adresu `staging.consultify.ai` (nie `localhost:3020`) + wpis akceptu w rejestrze.
- **Cofnięcie:** brak akceptu → poprawki → powrót do KROKU 4.

### KROK 6 — Zbudować drogę promocji staging → demo (Znalezisko 3)

Przenieść **wybiórczo** z niezacommitowanego stanu w
`/Users/piotrwisniewski/Developer/Consultify`:

1. job **„Promote Last Verified Staging SHA to Demo"** do `railway-deploy.yml` (wraz z `confirm_demo` i krokiem „Resolve immutable promotion source" czytającym tag `staging-deployed`);
2. w `validate-deploy-target.sh`, gałąź `demo)`: `expected_refs` → `refs/tags/staging-deployed`, `allowed_hosts` → `demo.consultify.ai` (usunięcie `stage.consultinity.ai`);
3. wyłączenie `scripts/deploy-demo.sh` (koniec `--force-with-lease` na demo, linia 69).

**★ NIE brać tych plików w całości** — są zbudowane na starszym strażniku (bez §B).
Przenosimy tylko trzy powyższe fragmenty na wierzch obecnej wersji.

- **Odwracalny:** TAK — zwykły commit na gałęzi.
- **Zgoda:** NIE do napisania kodu; **TAK** do scalenia.
- **Dowód:** `git log -S "confirm_demo" -- .github/workflows/railway-deploy.yml` daje wynik; testy strażnika (`scripts/deploy-gate.sh` i testy `validate-deploy-target`) zielone.
- **Cofnięcie:** `git revert`.
- **Warunek konieczny:** wykonać **po** KROKU 4, bo promocja czyta tag `staging-deployed` — a on jest wiarygodny dopiero po pierwszym prawdziwym przebiegu pipeline'u.

### KROK 7 — Promocja zaakceptowanego SHA na demo

`workflow_dispatch` → `environment=demo`, `confirm_demo=yes`. Wdraża **dokładnie
ten commit**, który przeszedł odbiór na stagingu.

- **Odwracalny:** TAK — redeploy poprzedniego wdrożenia demo; kod: powrót do tagu `demo-safe-2026-08-31`.
- **Zgoda:** **TAK — jawna, osobna.** To jest moment, w którym demo przestaje być zamrożone.
- **Dowód:** `demo.consultify.ai` odpowiada; `origin/demo` (albo wdrożony SHA) = SHA zaakceptowany na stagingu; nowy tag `demo-safe-<data>`.
- **Cofnięcie:** Railway rollback + `demo-safe-2026-08-31`. **Baza się nie cofnie** — ale jest wspólna ze stagingiem, więc migracje weszły już w KROKU 4; promocja kodu sama z siebie nic nowego do bazy nie wnosi.
- **Efekt końcowy:** instancje **są sobie równe** — ten sam SHA, ta sama baza. Dokładnie to, o co prosi właściciel.

### KROK 8 (opcjonalny, po ustabilizowaniu) — dokończyć E0/E4

Rozkrzyżowanie domen (E0) i rozdzielenie baz (E4) z DEC-172/176. **Świadomie
odłożone na koniec:** dziś wspólna baza jest decyzją właściciela (DEC-176), a
rozdzielanie jej w trakcie fali odbiorów dołożyłoby ryzyka bez zysku.

- **Zgoda:** TAK, osobna. Wymaga świeżego zrzutu i przejścia na referencje Railway.
- **Pułapka do zapamiętania:** rename usług bazodanowych **ZABIŁBY PRODUKCJĘ** — `postgres.railway.internal` wywodzi się z nazwy usługi, a produkcja ma ją wpisaną na sztywno (rejestr:223, DEC-172).

---

### Czego ten plan świadomie NIE robi

- **Nie podnosi demo o historię `develop`.** Demo jest naszym przodkiem (0 commitów własnych); dostanie zamrożony, odebrany SHA — nie 11 871 commitów z czerwca.
- **Nie rusza produkcji** (`consultify.ai`, baza `centerbeam`) — DEC-171.
- **Nie force-pushuje na `demo` ani `Londyn`** — jedyne rozważane nadpisanie dotyczy `develop` (KROK 2, wariant B), po jawnym werdykcie z KROKU 1.
- **Nie uzbraja `DEPLOY_TARGET_GUARD_ENFORCE`** przed pierwszym zielonym przebiegiem.

---

## 6. Pytania do właściciela (trzy, każde z rekomendacją)

**P1. Czy `origin/develop` można nadpisać kandydatem, czy scalamy?**
Pipeline wdroży staging wyłącznie z `develop`, a `develop` stoi od 2 czerwca i ma
16 commitów, których nasza linia nie ma.
→ **Rekomendacja: najpierw przejrzeć te 16 commitów (KROK 1), potem MERGE (wariant A).**
Merge nic nie traci, a kosztuje jeden przebieg. Nadpisanie tylko wtedy, gdy przegląd
wykaże, że to martwy kod.

**P2. Czy zgadzasz się, że pierwsze wdrożenie stagingu uruchomi migracje na bazie
wspólnej z demo — po świeżym zrzucie?**
Sam wybrałeś jedną wspólną bazę (DEC-176) z jawnym kosztem: „migracja testowa
uderza także w demo". Ostatni backup ma 9 dni, PITR wyłączony.
→ **Rekomendacja: TAK, ale dopiero po wykonaniu KROKU 0 (świeży zrzut).**
Bez zrzutu nie ruszamy — migracje są addytywne i nie cofają się.

**P3. Czy budujemy drogę promocji staging → demo teraz, czy promujemy raz ręcznie?**
Gotowy job „Promote Last Verified Staging SHA to Demo" leży niezacommitowany w
Twoim drugim checkoucie i nigdy nie wszedł do repozytorium.
→ **Rekomendacja: budujemy teraz (KROK 6).** To jeden dyżur, a bez tego jedyną
drogą na demo jest `deploy-demo.sh` z force-pushem — czyli dokładnie ten wzorzec,
który spowodował krach 3/4 i który CLAUDE.md zakazuje.

---

## Załącznik — polecenia weryfikujące (wszystkie read-only)

```
git rev-list --left-right --count origin/demo...HEAD      # 0   3926
git rev-list --left-right --count origin/develop...HEAD   # 16  11871
git merge-base --is-ancestor origin/demo HEAD             # 0 = demo jest przodkiem
git rev-list --count f87043a941..HEAD                     # 916 (dystans od stagingu)
git rev-list --count origin/demo..f87043a941              # 3010 (staging przed demo)
git log -1 --format='%H %ci %s' staging-deployed          # 1b0ead22ff 2026-06-10
git log --all -S "confirm_demo" -- .github/workflows/railway-deploy.yml   # pusto
git diff --name-status f87043a941..HEAD -- server/migrations/   # 8 plików, wszystkie A
grep -n "preDeployCommand" railway.json railway.api.json        # bramka migracji
grep -n "deploy-gate.sh" .github/workflows/railway-deploy.yml   # tylko :253-254 = produkcja
git branch --contains HEAD                                      # tylko m03 = to jest tip
git rev-list --left-right --count HEAD...codex/day207-write-proposal-20260831  # 109  182
```

**Tani test na nawrót rozjazdu baz** (z DEC-165, do wykonania w logu wdrożenia
z KROKU 4): linie `RELEASE_MIGRATION_GATE_PASS` i `[Postgres] Config: {host}`
muszą wskazywać **tę samą bazę**. Jeśli się różnią — zatrzymać wdrożenie.
