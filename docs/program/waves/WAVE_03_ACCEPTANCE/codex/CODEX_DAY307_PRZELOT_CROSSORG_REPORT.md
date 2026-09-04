# Raport dyżuru 307 — przelot cross-org

Stan: **CZĘŚCIOWE**. Rdzeń R1–R6 wykonano, dwie realne luki naprawiono z dowodami mutacyjnymi, lecz 1829/1904 objętych tras pozostaje `NIEZWERYFIKOWANA`; raport nie zamienia braku danych w PASS.

## Baza pracy i wejście

- Vault: `/Users/piotrwisniewski/Developer/consultify-recovery-vault-20260820.git`, wyłącznie remote `github-backup`.
- Worktree: `/private/tmp/cx-day307-przelot-crossorg`.
- Gałąź: `codex/day307-przelot-crossorg-realna-baza-20260903`.
- Marker: `416432abafe31a390a909cf7e460a4bad7bef191`.
- Tip gałęzi źródłowej uciekł przed startem do przodu; zgodnie z §0.1 pracę rozpoczęto dokładnie z markera, nie z tipa. Log i lista plików różnicy zostały zmierzone poleceniami z instrukcji.

Dosłowny wynik kontroli markera (§0.1 punkt 2):

```text
MARKER OK
```

Dosłowny wynik sanity po utworzeniu worktree (§0.1 punkt 7):

```text
416432abafe31a390a909cf7e460a4bad7bef191
```

`git status --short | head -3` nie zwrócił wiersza. W katalogu worktree utworzono wymagany `worktrees/.../config.worktree` z `core.bare=false`; `node_modules` jest dozwolonym symlinkiem do checkoutu właściciela. Checkout właściciela nie był używany do pracy ani zapisu.

## Pomiary wejściowe i środowisko

- `Gateway.ts`: 277 unikalnych mountów `/api*`.
- `server/src/routes`: 2725 tekstowych procedur `router.get`.
- `videos`: 0 DDL w migracjach, 0 DDL w `server/src`, mount zaślepki w `Gateway.ts`.
- Wzorcowy `cross-org-idor.test.ts`: 1939 linii, przeczytany w całości przed napisaniem testu.
- Pliki testowe z `idor` w nazwie: 11.
- Porty 6314, 5292 i 5293 były wolne; przed startem było 0 własnych kontenerów; wolne miejsce przekraczało 5 GB.

PostgreSQL uruchomiono wyłącznie lokalnie jako `cx-day307-pg`, obraz `pgvector/pgvector:pg16`, port `127.0.0.1:6314`, baza `cx307`. Pełny strict chain migracji zakończył się powodzeniem; drugi przebieg wykazał `Applying migrations: 0`. Logi: `migracje-1.log`, `migracje-2.log`.

Protokół poczty przed zapisem: zmienne `SMTP_*` — `BRAK ZMIENNYCH POCZTY`; zapytanie do lokalnej tabeli `settings` o host/użytkownika SMTP — 0 wierszy; nie uruchomiono drainera/outbox workera. Nie wysłano poczty ani zaproszeń.

## R1–R4: mianownik, dane i przelot

Skrypt `scripts/dev/day307-crossorg-read-route-matrix.mjs` buduje graf mountów z AST, obejmuje literalne odczyty z sygnałem danych organizacji i zapisuje jawny powód każdego pominięcia. Wynik: 2725 mianownika tekstowego, 1904 objęte, 821 pominiętych. Rodziny publiczne/systemowe oraz zewnętrzne/AI/LLM wyłączono jawnie; w tym dyżurze nie wykonano żadnego wywołania modelu ani dostawcy.

`scripts/dev/seed-day307-crossorg.mjs` fail-closed wskazuje tylko `127.0.0.1:6314/cx307`; utworzył dwie organizacje, dwóch właścicieli, członkostwa, podpisane lokalnie tokeny i właścicielski projekt/zadanie do rozstrzygnięcia workload.

Test `server/src/routes/__tests__/day307-crossorg-read-flight.pg.test.ts` używa rzeczywistego `ApiGateway.initializeRoutes(app)`, JWT i PostgreSQL. Końcowy przebieg z `--retry=0`: 2/2 testy PASS i 1904 pary żądań. Werdykty: `OK_PARA=10`, `OK_TENANT_RELATIVE=65`, `NIEZWERYFIKOWANA=1829`, `PODEJRZENIE_WYCIEKU=0` po poprawkach. Rejestr: `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_CROSSORG_PRZELOT_20260903.md`.

Pierwsze dwa przebiegi techniczne były nieważne i nie są dowodem: za krótki `JWT_SECRET` dał 401/401, a później wygasłe tokeny dały 401/401. Zachowano je jako artefakty `*-invalid-short-secret*` i `*-invalid-expired-token*`; tokeny seeda wydłużono do 24 h i cały przelot powtórzono poprawnie.

## R5: znalezione i naprawione luki

### Workload bez granicy organizacji

Przed poprawką `GET /api/pmo/tasks/workload/day307-user-owner` z tokenem obcej organizacji zwracał 200 i ujawniał `day307-project-owner` oraz jedno zadanie. Kontrakt przed poprawką: oczekiwane 404, otrzymane 200 — RED (`workload-contract-red-before-fix.json`).

Naprawa wymaga członkostwa użytkownika docelowego w organizacji żądającego i filtruje zarówno `tasks.organization_id`, jak i `projects.organization_id`. Po poprawce obcy dostaje 404 `TASK_WORKLOAD_USER_NOT_FOUND`, właściciel 200 z dokładnie jednym zadaniem — GREEN.

Dowód mutacyjny, zawsze `--retry=0`:

```text
mutacja: usunięcie organization_id z prechecku użytkownika
wynik: exit 1 (RED), workload-mutation-red.json
przywrócenie przez cp: exit 0 (GREEN), workload-mutation-restored-green.json
```

### Brak `MODULE_ECONOMICS` na `/api/v8/finance*`

Dodano bramkę do wszystkich prefiksów `/finance`, `/finance-*` i `/finance-v2` po uwierzytelnieniu oraz do niezależnego mounted statement surface. Test przez realny Gateway/JWT/PG dla `/settings`, `/models`, `/statements`: USER 403 `BETA_LOCKED`, OWNER 200; 3/3 PASS (`finance-final-green.json`).

Dowód mutacyjny, zawsze `--retry=0`:

```text
mutacja: usunięcie obu wywołań bramki modułu
wynik: exit 1 (RED), finance-mutation-red.json
przywrócenie przez cp: exit 0 (GREEN), finance-mutation-restored-green.json
```

Szeroki przelot nie zalicza automatycznie 45 tras Finance jako cross-org PASS: ich odpowiedzi były puste lub nieporównywalne, więc pozostają `NIEZWERYFIKOWANA`. Osobny test dowodzi wyłącznie wymaganej bramki roli.

## Pomiar zasięgu testów

Pakiet zastany `cross-org-idor.test.ts`, przed i po: 114 przypadków, 21 PASS, 93 zastane FAIL; 106 unikalnych pełnych nazw. `diff przed-nazwy.txt po-nazwy.txt` jest pusty: nic nie dodano ani nie usunięto w tym chronionym pakiecie. Pierwsza próba z configiem roota znalazła 0 testów i została jawnie odrzucona jako dowód; właściwe przebiegi wykonano z katalogu `server` i `vitest.config.ts`.

Pełne nazwy nowych testów znajdują się w raportach JSON; nie zostały podmienione za liczby pakietu zastanego.

## Pułapki dowodowe

- Zastany test IDOR: mockuje bazę, więc nie dowodzi PG; służy tylko mianownikowi nazw. Jego 93 zastane FAIL pozostają takie same przed i po.
- Przelot Day 307: (a) rzeczywiste `ApiGateway`; (b) jawne `RUN_DB_TESTS=1`, `MOCK_DB=false`, `DB_TYPE=postgres`, lokalny `DATABASE_URL`; (c) wynik odróżnia puste 200 od danych; (d) `ENABLE_TEST_AUTH_BYPASS=false`; (e) każda trasa ma dwa strzały, `--retry=0`, a brak rozstrzygającej treści jest `NIEZWERYFIKOWANA`.
- Test workload: właścicielski wiersz w PG i treść projektu wykluczają fałszywą zieleń 404/404; mutacja strażnika daje RED.
- Test Finance: USER i OWNER tej samej organizacji wykluczają pomylenie bramki modułu z cross-org/global V8; mutacja obu mountów daje RED.

## R6: sprostowanie, `videos`, żywe pytania

`SCIEZKA_WYJSCIA_V2.md:45` sprostowano osobnym commitem: dwie stare pozycje są zamknięte kodowo, `videos` to rodzina „schemat poza migracjami”, a Day 307 rozlicza realne workload i Finance. Dla `videos` raport proponuje decyzję „kanoniczna migracja albo odmontowanie trasy”; decyzji nie podjęto.

Nie odczytywano demo, stagingu ani produkcji. Stan `ENABLE_V8_GLOBAL`, wierszy `v8_feature_flags` i organizacji bez takich wierszy na żywo pozostaje pytaniem do nadzorcy. Żadne twierdzenie żywe nie jest oznaczone jako zweryfikowane.

## Korekty wobec instrukcji

1. §0.3 ustawia obowiązkowe pomiary wejściowe przed uruchomieniem bazy, a Z20 mówi „najpierw kontener + migracje, dopiero potem jakikolwiek pomiar”. Bezpiecznie wykonano literalny blok wejściowy bez zapisu, a wszystkie pomiary bazodanowe dopiero na własnym kontenerze; konflikt nie poszerzył dostępu.
2. Teza o jednej nowej luce T1 była niepełna: przelot wykazał także realny wyciek workload. Zgodnie z ostatnim zdaniem instrukcji obalenie tezy jest wynikiem; lukę naprawiono osobnym commitem.
3. Z34a wymaga pushu, natomiast nadrzędna instrukcja łańcucha bezwzględnie zakazuje push. Nie wykonano pushu; wszystkie commity pozostają lokalnie w vault/worktree.
4. Hasło lokalnego kontenera to wartość testowa `cx`; błędna próba końcowego przelotu z innym lokalnym hasłem została odrzucona jako suite failure, po czym poprawny pełny przebieg wykonano raz z `--retry=0`. Nie było połączenia zdalnego.

## Commity

1. `76f1c9b1f7` — R1 macierz.
2. `e83b58251d` — R2 seed.
3. `203606ecca` — R1 wyłączenie external/AI.
4. `6309103e00` — R1 wyłączenie LLM.
5. `4a2933380f` — R2 ważność tokenów.
6. `3248510d2e` — R3 pierwszy rejestr.
7. `8865552775` — R4 test przelotu.
8. `4f9b437976` — R2 deterministyczny workload.
9. `bdf71ee7f1` — R5 izolacja workload.
10. `abe50dddc2` — R5 bramka Finance.
11. `474682711a` — R6 sprostowanie ścieżki wyjścia.

Końcowy commit raportu/rejestru jest następnym commitem R6.

## Artefakty

Artefakty leżą wyłącznie w `/private/tmp/cx-day307-przelot-crossorg-artefakty`. Pełna lista sum jest w `SHA256SUMS.txt`. Najważniejsze SHA-256:

- `day307-przelot-results-final.json`: `dc13ff07a51ddc694088a19d32745fa59f5a428fa1fdb376af3694ad8d634360`
- `day307-przelot-final.json`: `9a2d795a05aae16dda50a68a066c8552b6711a977e49556b155470eaae322873`
- `r1-macierz.json`: `513f02ee8d1e6c2e1708b356784a20350e758ff96e62b269535f81e6cb35db76`
- `przed-nazwy.txt` i `po-nazwy.txt`: `44860d409aa1bcf16735c4500f147c82d1276ddbfe1d6640a0e3cf04ba675943`
- `przed-po-nazwy.diff` (pusty): `e3b0c44298fc1c149afbf4c8996fb92427ae41e464fb8a334b1b346b843280b855`
- `migracje-1.log`: `cd125fb00b875a2f11cf5daf80f06abda22c306c65fb1046c86ed99b7f91c146`
- `migracje-2.log`: `00a99707459464e5d70b6a48fa5b6bc7c2d1ab3d9ae6665047db7b335f4908a8`
