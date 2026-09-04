# Raport dyżuru 310 — schemat poza migracjami

Stan: **CZĘŚCIOWE**. Pomiar R1, linia bazowa R2, jedna bezpieczna grupa R3/R4, dialekt usług i bezpiecznik R5 oraz ponowny dowód R6 zostały wykonane. Nie wykonano hurtowej semantycznej przebudowy pozostałych 526 wystąpień; rejestr nazywa każdą pozycję i nie przedstawia jej jako zamkniętej.

## Wejście i izolacja

- Vault: `/Users/piotrwisniewski/Developer/consultify-recovery-vault-20260820.git`, remote `github-backup`.
- Worktree: `/private/tmp/cx-day310-schemat-migracje`.
- Gałąź: `codex/day310-schemat-poza-migracjami-20260903`.
- Marker: `416432abafe31a390a909cf7e460a4bad7bef191`.
- Porty: PostgreSQL 6317; 5298/5299 pozostały niewykorzystane. Kontener: `cx-day310-pg`, obraz `pgvector/pgvector:pg16`.
- Wolne miejsce na starcie: 25 GiB; porty i nazwa kontenera były wolne.

Dosłowny wynik markera:

```text
MARKER OK
```

Dosłowny wynik sanity:

```text
[core]
        bare = false
416432abafe31a390a909cf7e460a4bad7bef191
```

`git status --short | head -3` był pusty. Tip źródłowy był przed markerem o dalsze commity; zgodnie z instrukcją start nastąpił z markera, bez rebase.

## Protokół poczty

Przed pierwszym zapisem:

```text
BRAK ZMIENNYCH POCZTY
 key | left
-----+------
(0 rows)
```

`Gateway.ts` nie zawiera startu drainera. Rejestracja logowała wyłącznie `Using Host: Mock (Console)`; Slack nie miał transportu i odrzucił wiadomość. Deklaracja wymagana przez §0.2b: **Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.**

## R1 — pełny pomiar

Pomiar przed zmianami potwierdził dokładnie 531 wystąpień w 164 plikach `server/src`, w tym 100 plików w `server/src/services`. Liczba „208 serwisów” nie opisuje tej samej metody: bezpośredni pomiar plików zawierających literalny runtime DDL daje 100, nie 208. W usługach było 4839 wystąpień `catch`; proste sąsiedztwo grepa DDL/catch dało 1, ale rejestr stosuje konserwatywne okno per pozycja i oznacza je tylko jako sygnał do ręcznej weryfikacji.

Skrypt `scripts/dev/day310-runtime-ddl-inventory.mjs` wygenerował tabelę plik · linia · tabela · migracja · catch · dialekt · działanie · commit. Przed zmianami klasy: `DODAJ_MIGRACJE=96`, `DO_DECYZJI_PARSER=20`, `POMINIĘTE_TEST=58`, `USUN_DDL_W_LOCIE=357`. Po pierwszej grupie: 526 wystąpień / 163 pliki / 99 usług; `93 / 20 / 58 / 355`.

`AUTOINCREMENT` przed zmianą znajdował się w dwóch rzeczywistych DDL usług (`llmConfigService.ts`, `proactiveNudges.ts`) oraz jako zamierzony adapter składni w `PostgresDatabase.ts`. Po zmianie pozostał tylko adapter; szerszy wzorzec wskazuje 37 plików, lecz obejmuje również translatory, zapytania i testy, a nie 37 runtime DDL. Teza instrukcji o „trzech plikach z dialektem” miesza wykonujące DDL z adapterem.

Dwie bazowe definicje `users` nie są zgodne tekstowo: `000_z_core_baseline.sql` ma więcej kolumn i typy `DATETIME`, a dalsze addytywne `ALTER TABLE` naprawiają kolejność. Nie dodano trzeciej definicji.

## R2 — linia bazowa z pustej bazy

Nowy kontener bez tabel przyjął 886 migracji strict; drugi przebieg: `Applying migrations: 0`, `Postgres migrations complete`. Na bazie zbudowanej wyłącznie tym łańcuchem rzeczywisty `ApiGateway` wykonał rejestrację nowej firmy/użytkownika: HTTP 200 i fizyczne identyfikatory użytkownika/organizacji.

Pięć sprawdzonych modułów:

| Moduł | Trasa | PRZED | PO |
|---|---|---:|---:|
| users | `/api/users/search?q=day310` | 404 | 404 |
| projects | `/api/projects` | 200 | 200 |
| notifications | `/api/notifications` | 200 | 200 |
| access | `/api/access/effective` | 200 | 200 |
| organizations | `/api/organizations/current` | 200 | 200 |

Pierwsza trasa wpada w wcześniejszy handler parametryczny i zwraca `User not found`; to znalezisko routingu, nie brak tabeli. Nie naprawiono go poza licencją schematu. Zatem wymóg „pięć tras działa” pozostaje niespełniony 4/5 zarówno PRZED, jak i PO.

## R3/R4 — pierwsza grupa addytywna

Migracja `20261913_day310_ai_nudge_runtime_schema.sql` tworzy addytywnie `ai_nudge_activity`, `ai_nudge_actions`, `ai_nudge_suppressions` w dialekcie PostgreSQL. `ai_dismissed_nudges` i `llm_logs` miały już migracje. Z usług usunięto pięć runtime DDL: cztery w proactive nudges i `llm_logs` w konfiguracji LLM. Każdy etap dostał osobny commit.

Po migracji i po usunięciu DDL kontener był kasowany z wolumenem, tworzony od zera i przechodził pełny strict chain. Odczyt `to_regclass` potwierdził na świeżej bazie wszystkie trzy nowe tabele oraz `llm_logs`. Nie wywołano modelu językowego ani żadnego dostawcy.

Pozostałych 526 wystąpień nie usunięto hurtowo. Wśród nich 20 ma dynamiczną/nieparsowalną nazwę, 93 wygląda na brak migracji, 355 ma tekstowe dopasowanie migracji, 58 leży w testach. Samo dopasowanie nazwy nie gwarantuje zgodności kształtu, więc masowa zmiana bez ręcznej analizy przeczyłaby zakazowi zgadywania i grupowaniu z pełnym strict chain.

## R5 — dialekt i bezpiecznik

`tests/unit/backend/schema/noRuntimeDdl.test.ts` ma jawną mapę dokładnych plików i liczby zastanych wyjątków. Nowy `CREATE TABLE IF NOT EXISTS` w nowym pliku lub zwiększenie liczby w istniejącym daje RED. Drugi test wymaga zera `AUTOINCREMENT` w usługach.

Dowód mutacyjny, zawsze `--retry=0`:

```text
GREEN: 2/2 — no-runtime-ddl-green.json
mutacja: dodatkowy CREATE TABLE w workbookSchemaGuard.ts
RED: exit 1 — no-runtime-ddl-mutation-red.json
przywrócenie przez cp
GREEN: 2/2 — no-runtime-ddl-restored-green.json
```

Pełne nazwy:

- `runtime DDL schema guard rejects every new CREATE TABLE in services outside the explicit legacy allowlist`
- `runtime DDL schema guard keeps SQLite AUTOINCREMENT out of service runtime DDL`

To dwa nowe testy; żaden zastany przypadek nie został usunięty. Test jest czysto statyczny (`RUN_DB_TESTS=0 MOCK_DB=true`) i nie jest przedstawiany jako dowód egzekucji PG.

## R6 — końcowy dowód

Po wszystkich zmianach ponownie utworzona pusta baza przeszła 887 migracji (886 zastanych + 1 nowa), a przebieg idempotentny zastosował 0. Rejestracja przez Gateway nadal zwróciła 200. Te same pięć tras zachowało wynik 4×200 + 1×404. Jest to `CZĘŚCIOWE`, nie PASS 5/5.

Pułapki (a)–(e): harness miał w tej samej komendzie `RUN_DB_TESTS=1`, `MOCK_DB=false`, `DB_TYPE=postgres`, `DATABASE_URL=...127.0.0.1:6317/cx310`, `ENABLE_V8_GLOBAL=true`, `ENABLE_TEST_AUTH_BYPASS=false`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` i lokalny `JWT_SECRET`. Montował realny `ApiGateway`, nie `server/src/index.ts`. Wyniki oceniają treść i kody; puste 200 nie służyło jako dowód tabeli. Każdy strict chain zaczynał się po `docker rm -fv` od nowego kontenera.

## Korekty wobec instrukcji

1. §0.3 umieszcza sześć pomiarów przed sekcją uruchomienia bazy, a Z20 mówi „NAJPIERW kontener + pełne migracje, DOPIERO potem jakikolwiek pomiar”. Wybrano bezpieczniejsze Z20: po markerze/portach kontener i migracje uruchomiono przed pomiarem kodu.
2. W §0.2c warianty B/C zawierają literalny placeholder `testy: ...`, który nie jest wykonywalną listą argumentów Vitest. Uruchomiono konkretny dozwolony bezpiecznik z właściwym configiem i env; harness Gateway wykonano jako skrypt w scratch.
3. Instrukcja odwołuje się do „tabeli licencji”, ale nie zawiera takiej tabeli. Zastosowano wąski zakres nazwany w opisie, Z12 i Z13; nie dotknięto infrastruktury testowej, frontu ani plików właściciela.
4. Z34a wymaga pushu, lecz nadrzędna instrukcja łańcucha zakazuje każdego pushu. Pushu nie wykonano.
5. Autor przewidywał, że na pustej bazie „nikt się nie zarejestruje”; pomiar obalił tezę: rejestracja działała już PRZED zmianą. Nie ukryto niezależnego 404 w users/search.

## Commity

1. `ff39cecb23` — R1 rejestr i generator.
2. `d4439c8b7d` — R2 linia bazowa.
3. `64d6469f59` — R3 migracja addytywna AI nudges.
4. `530d1e7a9f` — R4 usunięcie pięciu DDL w locie.
5. `2410936fe4` — R5 bezpiecznik i dowód mutacyjny.

Końcowy raport i aktualizacja rejestru są osobnym commitem R6.

## Artefakty i twierdzenia niezweryfikowane

Artefakty są wyłącznie w `/private/tmp/cx-day310-schemat-migracje-artefakty`:

- `no-runtime-ddl-green.json`: `e86b2f550facbead0202583b84837908ba8dd4f50442f1f66ae28ecfba7cba17`
- `no-runtime-ddl-mutation-red.json`: `5497cfb4f322ec43d6d9e4d5fbc598351431f2d6b1a7fd91f0e08e846d76baae`
- `no-runtime-ddl-restored-green.json`: `f728974cff672161dcad034027b231e219a5a5520922b6d2c165816289e6f254`

TWIERDZENIA NIEZWERYFIKOWANE: zgodność pełnego kształtu 355 tabel z migracjami; semantyczna poprawność 93 proponowanych nowych migracji; to, czy wszystkie sygnały catch faktycznie połykają błąd DDL; zachowanie na demo/stagingu/produkcji (nie dotykano); pełne działanie piątej trasy users/search; integracja pozostałych 526 pozycji.

## Wznowienie 04.09 — druga partia

Ponowny start odbył się po odczytaniu całej instrukcji, na tej samej czystej gałęzi i z wolnymi portami 5298/5299/6317. Pusta baza ponownie przeszła pełny strict chain, a `settings` zwróciło 0 wierszy `smtp%`.

R1 ujawniło błąd generatora: migracje z nazwą kwalifikowaną schematem, np. `CREATE TABLE "public"."assessment_user_state"`, były błędnie oznaczane jako brakujące. Parser naprawiono w `725852fac3`; liczba rzekomo brakujących migracji spadła z 93 do 34, a `USUN_DDL_W_LOCIE` wzrosło z 355 do 414 bez zmiany produktu.

R4 usunęło kolejne 17 wystąpień runtime DDL z dwóch grup:

- `e7adc200d9`: dziewięć tabel Assessment; wszystkie potwierdzone przez `to_regclass` po pełnym strict chain na pustej bazie;
- `b27392d55b`: siedem tabel konfiguracji LLM; wszystkie potwierdzone przez `to_regclass` po następnym pełnym strict chain. Nie uruchomiono modelu ani dostawcy AI.

Po aktualizacji ratchetu `11da17b181` inwentarz wynosi 509 wystąpień w 161 plikach, w tym 98 plików usług: 34 `DODAJ_MIGRACJE`, 19 `DO_DECYZJI_PARSER`, 58 `POMINIĘTE_TEST`, 398 `USUN_DDL_W_LOCIE`. Bezpiecznik ma 2/2 PASS z `--retry=0`.

Stan pozostaje **CZĘŚCIOWE**: 509 pozycji nadal wymaga grupowej analizy i osobnego strict chain. Nie przedstawiam mechanicznego usunięcia setek inicjalizatorów jako bezpiecznego domknięcia.
