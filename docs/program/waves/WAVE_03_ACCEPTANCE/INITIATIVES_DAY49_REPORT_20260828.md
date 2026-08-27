# Initiatives — Day 49 report (2026-08-28)

## Werdykt

`PARTIAL / STOPPED_BY_BINDING_SPEC`

Zakończono `A.1` i `A.2` osobnymi commitami. Prace zatrzymano na `A.3`, zgodnie z regułą „STOP zamiast zgadywania”. Nie rozpoczęto zależnego `A.4` ani dalszych bloków.

## Tożsamość i bezpieczniki

- źródło instrukcji: `github-backup/codex/day49-instrukcja-20260828`, commit `2ee40c7d`;
- instrukcja przeczytana w całości: 1842/1842 linii;
- SHA-256 instrukcji: `0c0080bb8521ceb30dd97770ec2a75b5225cabcc51fd901400c988edfbee183a`;
- worktree: `/private/tmp/consultify-initiatives-day49`;
- gałąź: `codex/initiatives-day49-20260828`;
- marker: `44f301142f` (`MARKER OK`);
- baza: jednorazowy `pgvector/pgvector:pg16`, kontener `cx-day49-pg`, host `127.0.0.1:5817`, DB `cx_day49`;
- harness: wyłącznie `3357`;
- Railway, zdalne bazy, deploy i produkcyjne zmienne: nieużywane;
- consumer outbox: flaga `ENABLE_INITIATIVE_EXECUTION_OUTBOX_CONSUMER` niezdefiniowana, więc domyślnie OFF; brak zewnętrznych email/SMS/webhooków w konsumencie.

Korekta jawna: przed odczytaniem `Z5` wykonano w checkoutcie właściciela `/Users/piotrwisniewski/Developer/Consultify` wyłącznie odczytowe `git status`/`fetch`; nie zapisano plików. Po odczytaniu instrukcji wszystkie działania repozytoryjne wykonano wyłącznie w izolowanym worktree. Symlink `node_modules` pozostał jedynym dozwolonym kontaktem z checkoutem właściciela.

## BLOK 0 — dowody wejściowe

### Migracje i realny PostgreSQL

- pierwszy przebieg bez `NODE_ENV=test` został zatrzymany przez lokalny guard — nie był PASS;
- poprawny przebieg: `NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DATABASE_URL=postgresql://postgres:cx@127.0.0.1:5817/cx_day49 npx tsx server/scripts/migrate.postgres.ts`;
- pierwszy poprawny przebieg zastosował 858 migracji;
- drugi identyczny przebieg zastosował 0 migracji;
- host nie miał `psql`; tożsamość potwierdzono przez `docker exec ... psql`: `current_database=cx_day49`, port kontenera `5432`; mapowanie Dockera: `5817`.

### Baseline testów — bez fałszywego PASS

Pierwsza komenda serwerowa uruchomiona z root repo i `--config server/vitest.config.ts` zwróciła `No test files found`; została sklasyfikowana jako błąd komendy, nie PASS. Poprawny przebieg wykonano z katalogu `server`.

| Korpus | Pliki | Testy | Wynik |
| --- | ---: | ---: | --- |
| wskazane testy domeny/tras serwera | 12 (7 pass, 5 fail) | 79 (55 pass, 24 fail) | baseline czerwony: m.in. współbieżny init schematu i odziedziczone różnice membership/auth |
| integration initiatives-execution realdb | 44 (12 pass, 5 fail, 27 skip) | 107 (33 pass, 31 fail, 43 skip) | baseline czerwony: odziedziczone FK przy `TRUNCATE` w 5 plikach |
| front/unit initiatives-execution | 80 (74 pass, 6 fail) | 358 (354 pass, 4 fail) | baseline czerwony: odziedziczone błędy, m.in. financial narrative |

Pomiar klienta: 129 eksportów `runtimeApi`, dokładnie 25 bez wołających. Pomiar tras: 330 unikalnych handlerów; literalna komenda z instrukcji podwajała `initiatives-additive` przez glob i jawny argument. Plan i Capacity miały po `0` wystąpień `t(`. Zakres migracji `20261420–20261439` był wolny.

## A.1 — hipotezy i wynik

Wniosek: przerwa pętli była w brakującym producencie opcji. Istniał klient tworzący opcje bez wołającego, walidator poprawnie wymagał dokładnie trzech kanonicznych opcji, consumer RESEQUENCE istniał, a Realizacja wymagała wybranej opcji RESEQUENCE.

Dodano realdb test przez prawdziwy `ApiGateway`, JWT i pełny PostgreSQL:

- pusta organizacja → pusta lista;
- brak autoryzacji;
- odrzucenie braku kanonicznej trójki;
- odrzucenie `UNKNOWN` z zerem;
- zapis i readback niezależnym `pg.Client` oraz świeżym GET;
- obce wskazówki nie mutują obcej organizacji.

Wynik: `6/6 PASS`, `SKIPPED=0`. Dodatkowy istniejący test okablowania listy przeszedł `2/2`; jego asercja potwierdza stałą liczbę 5 zapytań SQL (wcześniejszy dowód Day 21 obejmował N=50).

Commit: `93be56fb8f test(initiatives): measure the capacity loop through the real gateway before touching it (A.1)`.

## A.2 — algorytm i dowody

Dodano czysty, deterministyczny doradca oraz trasę pod istniejącym łańcuchem bramek. Bez LLM, I/O i zewnętrznych skutków. Wynik ma zawsze kolejność `RESEQUENCE`, `SCOPE_SPLIT`, `ADD_CAPACITY`; realne identyfikatory pochodzą ze snapshotów Planu/Mocy. Brak przeciążenia daje uczciwe `409 NO_CAPACITY_PRESSURE_TO_RESOLVE`. Koszt dodatkowej mocy pozostaje `UNKNOWN/null`, bo wejście nie zawiera stawki jednostkowej.

Algorytm jest autorski. Synteza ekspercka definiuje granice `analyze/propose/apply`, zakresy i obowiązek zachowania `UNKNOWN`, ale nie podaje konkretnego algorytmu generowania kanonicznej trójki; wykorzystano więc solver repo do resekwencjonowania oraz jawne, domenowe transformacje zakresu i mocy.

Testy:

- unit doradcy: `5/5 PASS`;
- realny `ApiGateway`: `11/11 PASS`, `SKIPPED=0`;
- happy path + niezależny SQL readback + świeży GET;
- brak przeciążenia, błędne referencje, brak autoryzacji i negatyw tenanta.

Dowód mutacyjny tenanta: po czasowej zmianie aktora na preferowanie `req.body.organizationId` ten sam przebieg z `--retry=0` był czerwony (`10 pass / 1 fail`). Po odtworzeniu kopii przez `cp`: `11/11 PASS`, a `diff` pliku był pusty.

Commit: `2805850279 feat(initiatives): deterministic capacity option advisor over plan and capacity scenarios (A.2)`.

## A.3 — STOP

Literalny blocker:

1. DoD wymaga sześciu zrzutów z harnessu `3357`: przed/po × jasny/ciemny/pusty.
2. Jedyny istniejący, licencjonowany pośrednio ekran realnego Huba (`staging-fixes-initiatives-i18n`) uruchamia `demoMode`.
3. `CapacityScenarioSurface` w `demoMode` jawnie wykonuje `setComparisons([])`; widok „przed” renderuje się poprawnie, ale „po” nie może powstać przez prawdziwy `load()`, bo dev-render nie ma backendu dla nowej komendy.
4. Instrukcja nie daje licencji na modyfikację `dev-render/**`, nie pozwala uruchomić dodatkowego portu backendu i zakazuje lokalnego doklejania wyniku zamiast pełnego `load()`.
5. Podstawienie trójki w demo albo zrzut spreparowanego DOM byłby fałszywym dowodem.

Niecommitowany prototyp A.3 miał flagę `VITE_WAVE3_INITIATIVES_CAPACITY_ADVISOR` domyślnie OFF, ukrytą akcję dla nieopublikowanych/niepowiązanych snapshotów, rozróżnienie dwóch kodów 409, PL+EN przez `t()` i test `5/5 PASS`; został w całości wycofany przed raportem, ponieważ bez sześciu prawdziwych zrzutów pozycja nie spełnia DoD. `check-list-canon.sh` dla prototypu: baseline `394`, wynik `394`, brak nowych naruszeń.

Do odblokowania potrzebna jest jedna z dwóch jawnych decyzji nadzorcy:

- licencja na dodanie dedykowanego ekranu/mocka transportu w `dev-render/**` dla realnego komponentu, albo
- licencja na uruchomienie lokalnego backendu na wskazanym, dodatkowym porcie i podpięcie harnessu do lokalnego PG `5817`.

Flaga `VITE_WAVE3_INITIATIVES_CAPACITY_ADVISOR` nie została wprowadzona; po odblokowaniu ma pozostać domyślnie wyłączona, a przełączenie po akcepcie właściciela wykonuje nadzorca.

## Pozycje nierozpoczęte z powodu STOP

`A.4`, `C.2`, `E.2`, `B.1`, `B.2`, `C.1`, `D.1`, `E.1`, `F.1`, `G.1`, `R.1` — `NOT_STARTED`, nie `PASS`.

## Pięć kształtów fałszywego „gotowe”

- realne dane: A.1/A.2 używają lokalnego realnego PG; brak atrap;
- readback: niezależny klient SQL i świeży GET;
- brak danych: `UNKNOWN/null`, nigdy zmyślone zero;
- tenant: negatyw oraz czerwony/zielony dowód mutacyjny;
- UI/akceptacja/release: A.3 zatrzymane, więc nie zgłoszono gotowości wizualnej, akceptacji ani release.
