# F2-E E1 — baseline pełnego eksportu organizacji

**Werdykt: E1 jest rozpoczęte i pozostaje HOLD; żywy mianownik 1930 tabel jest utrwalony, a bramka klasyfikacji uczciwie czerwieni 1905 niesklasyfikowanych tabel.**

## Tożsamość i granice

- branch: `codex/enterprise-trust-pack-20260913`
- base: `0f0107b93c051b3ced9d3aafce740b36ac457f61`
- staging schema: `/Users/piotrwisniewski/Developer/cto-codex/staging-schema-20260913.sql`
- schema SHA-256: `bf580feb5a9edd7960a2b38708fa31e5d8b16c7014ec82870f700882aa4aba78`
- izolowany runtime: `cx-f2e-pg`, PostgreSQL 18, `127.0.0.1:6456`, baza `f2e_e1`
- zasoby zarezerwowane, lecz nieuruchomione: API `4215`, preview `5215`, harness `5291`
- migracje `20262200–20262219`: zero plików; żadna migracja nie jest obecnie potrzebna ani autoryzowana
- nie wykonano deployu, zapisu do Railway ani pushu do gałęzi integracyjnych/live

Ponowny pełny odczyt Wpisu 9 i Wpisu 12 wykonano przy SHA-256 kanału `6f1428656ac274225d6288139e49ea4ebb1a060bbec55e268e664bcc4df658cd`. Nie wykryto zmiany prawa F2-E: treść wywiadów i zadań osobistych wchodzi, identyfikacja osób nie wchodzi, lista wyłączeń ma być jawna, E3 pozostaje ostatnie, a usuwanie organizacji pozostaje bezpieczną odmową `410`.

## Krok 0 — trzy liczby K3

| Pomiar | EXPORT | EXCLUDE_SECURITY | DERIVED | Razem sklasyfikowane | UNRESOLVED |
|---|---:|---:|---:|---:|---:|
| Żywy katalog stagingu | — | — | — | — | 1930 przed oceną |
| Kontrakt na `0f0107b93c` | 21 | 4 | 0 | 25 | 1905 |
| Po przeglądzie materiału C6 | 21 | 4 | 0 | 25 | 1905 |

Żywy katalog ma dokładnie `public=1809`, `v8=121`, razem `1930`. Liczby ze Wpisu 9 „22 EXPORT / 1 EXCLUDE_SECURITY” są niezgodne z exact base: sześć plików kontraktu zawiera 21 jawnych obiektów `EXPORT`, a `organizationExportContract.ts` generuje cztery wpisy `EXCLUDE_SECURITY` (`api_keys`, `integration_secrets`, `refresh_tokens`, `user_sessions`). Komentarz o 1918 tabelach jest historyczny.

Materiał na `codex/c6-export-contract-20260912` nie został scalony ani cherry-pickowany. Sześć plików kontraktu ma identyczne blob SHA po obu stronach; aktualna baza ma nowszy `organizationExportService.ts` z fail-closed kontrolą driftu per kolumna. Zastąpienie go starszą wersją C6 cofnęłoby zabezpieczenie. Route’y również rozeszły się po decyzji o `410`, więc nie są materiałem do kopiowania w ciemno.

## Utrwalony inwentarz i bramka

Generator `scripts/enterprise/build-organization-export-inventory.py` składa deterministyczny inwentarz z rzeczywistych kolumn, typów, PK i par FK. Odkrycie relacji nigdy nie nadaje jej prawa do eksportu. Snapshot:

- `evidence/f2-e-enterprise/e1/baseline/staging-schema-inventory.json` — 1930/1930 relacji, SHA-256 `36a5353283f7dae2b3e6486fd56390fcd116378a91a65d43c2f0f4682a2dc378`
- `evidence/f2-e-enterprise/e1/baseline/base-contract-classified-tables.json` — 21 EXPORT + 4 EXCLUDE_SECURITY, SHA-256 `02e824ed0a727ae8b2d998078b4d3c8c5d7de418ae9656c12c9f91471ab4d22e`
- `evidence/f2-e-enterprise/e1/classification-wip.json` — 25 sklasyfikowanych, 1905 UNRESOLVED, SHA-256 `c4cedf9f21bb7f0348d956473915cef90b869c00bdc72d84e2364aff9401bae5`
- `scripts/enterprise/verify-organization-export-classification.mjs` — akceptuje wyłącznie `EXPORT`, `EXCLUDE_SECURITY`, `DERIVED`; wymaga rodziny, zdaniowego uzasadnienia, a dla `DERIVED` także `derivedFrom`
- wynik RED: `ORGANIZATION_EXPORT_CLASSIFICATION_RED tables=1905/1930 errors=3810`

To jest właściwy RED: nie zamieniono 1905 nieprzejrzanych tabel na `DERIVED` przez dopasowanie nazwy. Każda klasyfikacja wymaga reguły właściciela, prywatności i źródła odtworzenia.

## Sześć znalezisk C6 — stan wejściowy

1. **C6-R1 — ujawnienie uwierzytelniania:** baza ma jawne projekcje, cztery wyłączenia tabel i rekurencyjne usuwanie pól credential. Bounded source fix istnieje; pełny dowód mutacyjny na kompletnym kontrakcie pozostaje otwarty.
2. **C6-R2 — dwa źródła budżetu AI:** nie jest elementem E1 eksportu. Pozostaje znanym findingiem C6 i nie zostanie fałszywie zamknięty przez E1.
3. **C6-R3 — legal hold fail-open/race:** baza bierze session advisory lock przed transakcją read-only i czyta politykę w snapshotcie. Pełny test mutacyjny writer-first na E1 pozostaje do wykonania.
4. **C6-R4 — populated delete kontra immutable receipts:** DEC-478 rozstrzyga zakres; endpoint nadal deterministycznie zwraca `410 SET_DELETE_APPROVED_OUT` bez destrukcyjnego executora.
5. **C6-R5 — niepełny eksport i limit:** brak limitu 20 000 oraz wspólny snapshot są już w bazie, lecz 1905 tabel nadal jest nierozstrzygniętych, a odpowiedź nadal jest budowana w pamięci. Streaming, progress i resume pozostają otwarte.
6. **C6-R6 — legal hold mapowany na 500:** oba export route’y mapują `OrgPoliciesError.statusCode`; runtime/mutacja pozostają do powtórzenia na końcowym źródle E1.

## Dalsza kolejność E1

1. Spisać i przetestować jawne reguły rodzin, zaczynając od relacji z bezpośrednim `organization_id`; identyfikatory i dane osób pozostają wyłączone, ale treść Interview/personal tasks jest zachowana przez istniejące privacy projectors.
2. Dodać kategorię `DERIVED` do kontraktu i service manifestu wraz z `derivedFrom`, bez nadawania praw przez discovery.
3. Doprowadzić bramkę do 1930/1930 GREEN i dodać test świeżej relacji, który czerwieni brak klasyfikacji.
4. Dopiero potem projektować archiwum JSON + CSV per tabela, manifest SHA/asOf/exclusions oraz długą operację streaming/progress/resume. Jeden `JSON.stringify` pełnego tenant dataset pozostaje niedozwolony.

E1 nie jest dostarczone: brak klasyfikacji 1905 tabel, archiwum, pięciu writerów UI/API, dowodu A/B, pełnych mutacji, browser states oraz niezależnego odbioru exact SHA.

## Checkpoint guard v2 i jawne reguły

Po niezależnym przeglądzie bramka została rozszerzona bez zmiany mianownika ani nadania nowych praw:

- `counts.public`, `counts.v8`, `counts.total`, `counts.classified` i `counts.unresolved` są liczone ponownie z wierszy; deklaracja nie może ukryć nowej relacji;
- `DERIVED` nie przyjmuje już luźnego tekstu: wymaga `TABLES` z istniejącymi, niesekretnymi źródłami i acyklicznym grafem albo `REBUILD_PROCEDURE` z repozytoryjnym źródłem i wykonalnym opisem;
- każde źródło tabelowe musi być `EXPORT` lub poprawnym `DERIVED`; self-reference, brak źródła, źródło security i cykl są RED;
- każdy sklasyfikowany wiersz wymaga jawnego `sourceEvidence`;
- `docs/ssot/ORGANIZATION_EXPORT_CLASSIFICATION_RULES.md` zakazuje klasyfikacji przez nazwę, kolumnę lub regex;
- `docs/ssot/organization-export-classification-decisions.e1-wip.json` zawiera 25 dokładnych decyzji tabelowych odziedziczonych z v9, z rodziną, uzasadnieniem, źródłem i jawnym ograniczeniem do kategorii tabeli.

Test RED przed implementacją nie mógł zaimportować nieistniejącej funkcji `verifyClassificationInventory`. Po implementacji dokładnie ten plik ma `6/6 PASS`: poprawny łańcuch DERIVED, procedura odtworzenia, fałszywe counts, nowa nierozstrzygnięta tabela, pięć wad źródeł DERIVED oraz niebezpieczna procedura. Realny WIP pozostaje poprawnie RED `1905/1930`; syntetyczna kalibracja instrumentu jest GREEN `1930/1930` i nie stanowi klasyfikacji produktu.
