# FEEDBACK-1 0b — plan addytywnej naprawy danych

Status: **STOP PRZED MIGRACJĄ — brak jawnej zgody CTO i przydzielonego numeru DEC/migracji.**

Zakres wynika z Wpisu 121 i `bloker-justyna-20260916/DIAGNOZA.md` §§6–7. Nowszy Wpis 121 zawęża starszy krok 3 diagnozy: przyszła naprawa dekoduje wyłącznie `&quot;`, `&#39;`, `&#x27;` i `&#x60;`. Nie dekoduje `&amp;`, `&lt;` ani `&gt;`.

## Decyzja wymagana przed kodem produkcyjnym

CTO musi jawnie:

1. zatwierdzić addytywną migrację danych FEEDBACK-1 0b;
2. nadać DEC oraz wolny numer/nazwę pliku w kanonicznym łańcuchu `server/migrations` (aktualny najwyższy numer widoczny w tej gałęzi to `20262240`);
3. wskazać środowisko pierwszego wykonania i zaakceptować kolejność: klon/lokalny RealPG → readback → idempotentny replay → rollback drill → dopiero osobna zgoda na staging;
4. potwierdzić, czy trwałe tabele kopii mają zostać po odbiorze, czy mogą być usunięte osobną późniejszą decyzją. Sama migracja ich nie usuwa.

Do tego czasu nie istnieje plik migracji produkcyjnej i żadne dane nie są zmieniane.

## Krok 0 — inventory bez zapisu danych

Uruchomić `feedback_1_0b_inventory.sql` przez `psql` z jawnym, zweryfikowanym adresem klona bazy. Skrypt działa w `BEGIN READ ONLY`, tworzy wyłącznie obiekty `pg_temp` i kończy `ROLLBACK`.

Inventory:

- wykrywa wszystkie bazowe kolumny `text`/`varchar`/`char`/`json`/`jsonb` w `public`;
- pomija tabele `z_*` i nazwy zawierające `backup`;
- liczy wiersze i wystąpienia czterech dozwolonych encji;
- zapisuje typ magazynu: zwykły tekst, JSON zapisany jako tekst albo natywny JSON;
- odczytuje pełny klucz główny, także złożony;
- zatrzymuje plan dla tabel bez PK, nieparsowalnych wartości w kolumnie wyglądającej jak JSON oraz encji znalezionej w kluczu obiektu JSON;
- porównuje wynik z pomiarem CTO: 87 kolumn. Wynik inny niż 87 jest dryfem, nie automatycznie „nową prawdą".

Wynik szczegółowy i podsumowanie należy zachować jako dowód przed migracją. Query nie wypisuje wartości użytkowników.

## Projekt przyszłej migracji po zgodzie

Migracja będzie jedną transakcją i utworzy addytywnie dwie trwałe tabele:

- `z_feedback_1_0b_runs`: `run_id`, DEC, SHA migracji, baza/środowisko, czas, stan (`STARTED`, `APPLIED`, `ROLLED_BACK`), liczby before/after i digest inventory;
- `z_feedback_1_0b_backup`: `run_id`, schema/table/column, `pk_json`, pełny `row_before jsonb`, `old_value`, `new_value`, hashe obu wartości i czas kopii. Unikalność po `run_id + schema + table + column + pk_json`.

Przed każdą zmianą dokładny wiersz trafia do kopii. Jeśli tabela nie ma stabilnego PK albo inventory ma blocker, transakcja rzuca wyjątek przed pierwszym `UPDATE`.

Transformacja jest stała i ograniczona:

```text
&quot;  -> "
&#39;   -> '
&#x27;  -> '
&#x60;  -> `
```

`&amp;`, `&lt;` i `&gt;` nie występują po lewej stronie żadnej operacji. Nie stosujemy ogólnego dekodera HTML.

### Tryby danych

1. **Zwykły tekst:** cztery dokładne `replace`, wyłącznie gdy wartość zawiera przynajmniej jeden token.
2. **JSON w kolumnie tekstowej:** po potwierdzeniu parsowalności zamiana w wartościach string. Cudzysłów musi pozostać poprawnie escaped w serializacji JSON; klucze obiektów nie są zmieniane. Po transformacji wynik ponownie przechodzi parse `jsonb`, zanim zostanie zapisany jako tekst.
3. **Natywny `json/jsonb`:** rekursywna transformacja wyłącznie stringowych wartości; liczby, boolean, null, struktura i klucze pozostają identyczne.

Kolumna z mieszanym JSON/plain text albo encją w kluczu JSON jest `STOP`, nie jest automatycznie klasyfikowana.

## Liczniki i warunki zatwierdzenia transakcji

W obrębie tej samej transakcji zapisać:

- `columns_before`, `row_column_pairs_before`, wystąpienia per encja;
- liczbę skopiowanych pozycji backupu;
- liczbę zmienionych par wiersz-kolumna;
- `columns_after`, `row_column_pairs_after`, wystąpienia per encja;
- liczbę wierszy zawierających `&amp;`, `&lt;`, `&gt;` przed i po jako kontrolę negatywną;
- digest inventory i digest backupu.

Warunki `COMMIT`: `backup_count = changed_count`, po naprawie liczba czterech docelowych encji = 0, kontrola negatywna `&amp;/&lt;/&gt;` przed = po, każdy JSON nadal się parsuje, liczba wierszy w każdej tabeli przed = po. Niespełnienie któregokolwiek warunku powoduje `RAISE EXCEPTION` i rollback całej transakcji.

## Idempotencja

Drugi przebieg tej samej logiki po udanym zastosowaniu musi wykazać:

- `affected columns = 0`;
- `changed row-column pairs = 0`;
- brak nowego wpisu backupu;
- niezmienione liczniki `&amp;/&lt;/&gt;`.

Nie wolno uznawać samego `schema_migrations` za dowód idempotencji. Replay wykonuje się na klonie z tą samą procedurą danych albo przez dedykowany harness przyszłej migracji.

## Readback

Readback uruchamia się w nowym procesie i nowym połączeniu. Porównuje:

1. inventory po migracji z manifestem runu;
2. każdy `new_value` z kopii z wartością odczytaną po PK;
3. cztery wskazane przez diagnozę powierzchnie: `tasks.description`, `feedback_items.description`, `feedback_items.title`, `interview_insights.section_overrides`;
4. co najmniej jeden native/text JSON oraz `presentation_deck_versions.deck_json_snapshot` i `teresa_proposals.target_payload_json`;
5. kontrolę, że `&amp;`, `&lt;`, `&gt;` nie zmieniły się ani liczbowo, ani w próbie wartości.

Dowód zachowania po zmianie kodu sanitizera pozostaje osobną bramką: zapis `He said "yes" and 'go'` przez realne API ma wrócić identyczny, a `<script>` ma pozostać neutralizowany. Migracja danych nie zastępuje tego testu.

## Rollback

Rollback jest osobnym, jawnie uruchamianym skryptem/harnessem i korzysta wyłącznie z `z_feedback_1_0b_backup` dla konkretnego `run_id`.

- Przywraca `old_value` po pełnym PK.
- Aktualizuje wiersz tylko wtedy, gdy bieżąca wartość równa się `new_value` z manifestu. Późniejsza edycja użytkownika jest konfliktem i powoduje `STOP`, aby rollback jej nie nadpisał.
- Po przywróceniu porównuje wartość oraz hash z `old_value`, a następnie wykonuje zimny readback w nowym połączeniu.
- Nie kasuje tabel kopii i nie usuwa manifestu; oznacza run jako `ROLLED_BACK`.

Rollback drill na klonie musi wykazać: apply zmienia N > 0, replay zmienia 0, rollback przywraca dokładnie N, drugi readback odpowiada digestowi before.

## Ryzyka jawne

- Pomiar 87 jest snapshotem stagingu z 16.09.2026; liczba może się zmienić przed wykonaniem. Każdy dryf wymaga ponownego przeglądu, bo może oznaczać nową tabelę albo ponowne psucie danych.
- Starszy §6 diagnozy wymieniał także dekodowanie `&lt;`, `&gt;`, `&amp;`; Wpis 121 zastępuje ten zakres. Rozszerzenie wymaga nowej decyzji.
- Nazwa kolumny nie jest wystarczającym dowodem formatu JSON. Inventory mierzy parsowalność wartości, a migracja fail-closed.
- Sama naprawa danych nie utrzyma się bez przyjętej osobno poprawki sanitizera; kolejność wdrożenia musi zapewnić, że kod przestaje ponownie kodować cudzysłowy przed lub atomowo z backfillem.
