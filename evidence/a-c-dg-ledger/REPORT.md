# [A/C] D-g / Z-33 — pomiar ledgera migracji (Wpis 49)

**Werdykt: STOP przed SQL write; luka 1009/1133 nie jest luką wykonawczą. Aktualna ścisła lista wymagana ma 916 migracji i wszystkie 916 mają w stagingu wpis `success`; produkcyjny evaluator zwraca `state=ok`, `pending=0`, `failed=0`, `skipped=0`, `unexplainedDrift=0`.**

## Punkt pomiaru

- linia repo: `1154ebd80950d5c7fdd2c2bb88c296e2c98ff35e`
- Railway: projekt Consultify, środowisko staging, zmienne usługi `pgvector`; połączenie tylko przez `BEGIN READ ONLY ... ROLLBACK`
- źródło wymaganej listy: `server/src/services/releaseGate/migrationExecutionPolicy.ts:isExecutableMigration`
- źródło weryfikacji: `server/src/services/releaseGate/sqlChainEvaluator.ts:evaluateSqlChain`
- nie uruchamiano serwera; nie wykonano DDL/DML; nie zmieniono Railway

## Skąd 1009/1133

- `1009` = wszystkie historyczne wiersze `schema_migrations` przed zastosowaniem `20262190_f2_3_pmo_stage_gates.sql` o 2026-09-14 10:34:00.815Z.
- `1133` = wynik `ls -1 server/migrations | wc -l` na linii `94754c3b4d`: 1130 zwykłych plików + trzy świadomie wyłączone podkatalogi (`ops`, `never-ran`, `rollback`). Nie jest to liczba migracji wymaganych przez strict runner.
- Aktualnie liczby wynoszą odpowiednio 1010 wierszy i 1134 wpisy katalogu, bo linia `1154ebd809` dodała `20262190_f2_3_pmo_stage_gates.sql` i staging ją zastosował.

## Aktualna dekompozycja

- katalog: 1131 zwykłych plików + 3 podkatalogi = 1134 wpisy `ls`
- pliki o rozszerzeniu `.sql/.js/.ts`: 1129
- wymagane przez strict runner: 916
- wyłączone przez politykę: 213
- ledger: 1010 unikalnych nazw = 1002 success + 7 skipped + 1 failed
- wszystkie wymagane: 916/916 success; brakujące success: 0; brakujące jakiekolwiek wpisy: 0; required non-success: 0
- ledger-only (plik nie istnieje już w repo): 92 = 85 success + 7 skipped
- plik istnieje, lecz jest wyłączony z strict chain i ma historyczny wpis: 2 (`210_ai_system_prompts.sql` success, `add_response_feedback.sql` failed)
- pliki runnable bez wpisu: 211 i wszystkie 211 są świadomie wyłączone: 171 legacy pre-500, 32 seed/mock/demo, 5 legacy helper, 2 sqlite-specific, 1 legacy initdb

Pełne listy: `repo-runnable-without-ledger.txt`, `ledger-without-repo.txt`, `required-missing-success.txt`, `comparison.json`.

## Duplikaty i aliasy

- pełna tożsamość `filename`: 0 duplikatów w repo, 0 w ledgerze
- identyczna zawartość pod różnymi nazwami: 0 grup
- artefakty nazw `... 2.sql`: 0
- powtórzony prefiks `version`: 151 grup w repo, 120 w ledgerze; to nie są aliasy, ponieważ kluczem głównym i tożsamością runnera jest pełny `filename`. Największe rodziny: `20260323` 52 pliki, `20260809` 45, `20260719` 35. Pełne grupy są w dwóch plikach `duplicate-version-groups-*.json`.

## Sumy kontrolne i ryzyko

Read-only evaluator bramki: `state=ok`; 32 zatwierdzone warianty historycznych checksumów, w tym 3 ponownie potwierdzone postcondition i 1 wariant potwierdzony atestacją schematu; 0 nieweryfikowalnych i 0 niewyjaśnionych driftów.

- Ryzyko operacyjne strict chain: **niskie / brak aktywnej luki** — 916/916 wymaganych wpisów success, pending 0.
- Ryzyko audytowe: **średnie** — 92 historyczne wpisy nie mają już pliku w drzewie, więc samego historycznego SQL nie da się odtworzyć z aktualnego HEAD; nie wolno ich usuwać ani „naprawiać” bez archiwum blobów i decyzji retencyjnej.
- Ryzyko raportowe: **średnie** — liczenie surowych wpisów katalogu lub `version` daje fałszywą lukę i fałszywe duplikaty; każda bramka musi liczyć `isExecutableMigration(filename)` i pełne nazwy.
- Ryzyko fałszywego poświadczenia: **wysokie**, jeśli ktoś wpisze 211 wyłączonych plików do ledgera bez wykonania SQL — tego robić nie wolno.

## Bezpieczny plan

1. Nie wykonywać obecnie żadnego backfillu ledgera: lista `requiredMissingSuccess` jest pusta, a bramka zwraca `ok`.
2. Utrwalić licznik jako cztery odrębne miary: wpisy katalogu, runnable extensions, strict required, ledger audit rows. Nigdy nie odejmować 1009 od 1133.
3. Dla przyszłej brakującej migracji wymaganej używać wyłącznie pełnego strict release migration gate, który wykonuje migrację i zapisuje checksum/status atomowo; nigdy bezpośredniego `INSERT/UPDATE schema_migrations`.
4. Zachować 92 ledger-only jako historię. Jeśli potrzebna jest odtwarzalność, najpierw odnaleźć dokładne blob SHA dla każdej nazwy i zbudować osobne archiwum manifestów; bez zmian w ledgerze.
5. Dla 211 wyłączonych plików utrzymywać jawny raport dyspozycji. Awans do strict chain wymaga osobnej, datowanej migracji forward albo jawnej zmiany polityki, dowodu idempotencji i odbioru; samo dopisanie wpisu do ledgera jest zabronione.
6. Dla rodzin wspólnego `version` utrzymać pełny `filename` jako tożsamość. Nie tworzyć narzędzi kluczowanych samym prefiksem.

**STOP:** nie przygotowano SQL write, migracji ani zmian Railway; dalsze działanie tylko po decyzji CTO.
