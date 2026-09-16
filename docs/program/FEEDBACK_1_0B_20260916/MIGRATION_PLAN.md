# FEEDBACK-1 0c / 20262280 — plan addytywnej naprawy danych

Status: **GO — DEC-575, migracja `20262280_feedback1_unescape_entities.sql` zatwierdzona wpisami 134 i 137. Wykonanie poza lokalnym RealPG nadal wymaga osobnej zgody CTO.**

Zakres wynika z Wpisu 121 i `bloker-justyna-20260916/DIAGNOZA.md` §§6–7. Nowszy Wpis 121 zawęża starszy krok 3 diagnozy: przyszła naprawa dekoduje dokładnie `&amp;`, `&quot;`, `&#39;`, `&#x27;`, `&#x60;` i `&#96;`. Nie dekoduje `&lt;` ani `&gt;`.

## Decyzja i granice

Wpisy 134 i 137 zatwierdzają addytywną migrację `20262280` po przyjęciu poprawki sanitizera. Zakres dekodowania to dokładnie sześć tokenów: `&amp;`, `&quot;`, `&#39;`, `&#x27;`, `&#x60;`, `&#96;`. `&lt;` i `&gt;` nigdy nie są dekodowane do znaczników.

Migracja jest testowana na fresh PostgreSQL i kontrolowanym fixture. Staging/demo pozostają poza upoważnieniem tej paczki. Trwałe tabele manifestu i kopie per tabela pozostają po zastosowaniu oraz po rollbacku.

## Krok 0 — inventory bez zapisu danych

Uruchomić `feedback_1_0b_inventory.sql` przez `psql` z jawnym, zweryfikowanym adresem klona bazy. Skrypt działa w `BEGIN READ ONLY`, tworzy wyłącznie obiekty `pg_temp` i kończy `ROLLBACK`.

Inventory:

- wykrywa wszystkie bazowe kolumny `text`/`varchar`/`char`/`json`/`jsonb` w `public`;
- pomija tabele `z_*` i nazwy zawierające `backup`;
- liczy wiersze i wystąpienia sześciu dozwolonych encji;
- zapisuje typ magazynu: natywny JSON albo klasyfikację `per_value` dla kolumn tekstowych;
- odczytuje pełny klucz główny, także złożony;
- zatrzymuje plan dla tabel bez PK, zmienianych kolumn będących częścią PK lub kolumną generowaną/identity oraz encji znalezionej w kluczu obiektu JSON;
- buduje manifest dynamicznie z `information_schema`; opcjonalny digest oczekiwanego manifestu służy wyłącznie do ostrzeżenia o dryfie, nie blokuje wykonania.

Wynik szczegółowy i podsumowanie należy zachować jako dowód przed migracją. Query nie wypisuje wartości użytkowników.

## Projekt migracji

Migracja jest jedną transakcją i tworzy addytywnie:

- `z_feedback_20262280_runs`: identyfikator migracji, DEC, baza źródłowa, nazwa bazy, czas, stan (`STARTED`, `APPLIED`, `ROLLED_BACK`), liczniki before/after i digesty;
- `z_feedback_20262280_inventory`: zamrożony manifest wykrytych tabel, kolumn, pełnych PK, trybu danych i nazwy kopii;
- osobną tabelę `z_feedback_20262280_backup_<tabela>_<hash>` dla każdej zmienianej tabeli. Każdy wpis zawiera `pk_json` z pełnym kluczem, `old_value`, `new_value`, typ, hashe i czas kopii. Unikalność obejmuje `run_id + column_name + pk_json`.

Przed każdą zmianą dokładny wiersz trafia do kopii. Jeśli tabela nie ma stabilnego PK albo inventory ma blocker, transakcja rzuca wyjątek przed pierwszym `UPDATE`.

Transformacja jest stała i ograniczona:

```text
&amp;   -> &
&quot;  -> "
&#39;   -> '
&#x27;  -> '
&#x60;  -> `
&#96;   -> `
```

`&amp;` jest dekodowane przed pozostałymi tokenami, także dla powtórzonego kodowania. `&lt;` i `&gt;` nie występują po lewej stronie żadnej operacji. Nie stosujemy ogólnego dekodera HTML.

### Tryby danych

1. **Zwykły tekst:** sześć dokładnych transformacji, wyłącznie gdy wartość zawiera przynajmniej jeden token.
2. **JSON w kolumnie tekstowej:** po potwierdzeniu parsowalności zamiana w wartościach string. Cudzysłów musi pozostać poprawnie escaped w serializacji JSON; klucze obiektów nie są zmieniane. Po transformacji wynik ponownie przechodzi parse `jsonb`, zanim zostanie zapisany jako tekst.
3. **Natywny `json/jsonb`:** rekursywna transformacja wyłącznie stringowych wartości; liczby, boolean, null, struktura i klucze pozostają identyczne.

Kolumna tekstowa mieszająca JSON i prozę jest obsługiwana per wartość: parsowalna wartość przechodzi ścieżką JSON, pozostała ścieżką plain text. Encja w kluczu JSON pozostaje `STOP`.

## Liczniki i warunki zatwierdzenia transakcji

W obrębie tej samej transakcji zapisać:

- `columns_before`, `row_column_pairs_before`, wystąpienia per encja;
- liczbę skopiowanych pozycji backupu;
- liczbę zmienionych par wiersz-kolumna;
- `columns_after`, `row_column_pairs_after`, wystąpienia per encja;
- liczbę surowych delimiterów `<` i `>` oraz dokładnych tokenów `&lt;` / `&gt;` przed i po; zagnieżdżone `&amp;lt;` jest kanonizowane jako `&#38;lt;`, więc nie tworzy nowego tokenu `&lt;` ani znacznika;
- digest inventory i digest backupu.

Warunki `COMMIT`: `backup_count = changed_count`, po naprawie liczba sześciu docelowych encji = 0, liczba surowych `<` / `>` przed = po, każdy JSON nadal się parsuje, liczba wierszy w każdej tabeli przed = po. Niespełnienie któregokolwiek warunku powoduje `RAISE EXCEPTION` i rollback całej transakcji zapewnionej przez kanoniczny runner.

## Idempotencja

Drugi przebieg tej samej logiki po udanym zastosowaniu musi wykazać:

- `affected columns = 0`;
- `changed row-column pairs = 0`;
- brak nowego wpisu backupu;
- niezmienione liczniki surowych `<` / `>`.

Nie wolno uznawać samego `schema_migrations` za dowód idempotencji. Replay wykonuje się na klonie z tą samą procedurą danych albo przez dedykowany harness przyszłej migracji.

## Readback

Readback uruchamia się w nowym procesie i nowym połączeniu. Porównuje:

1. inventory po migracji z manifestem runu;
2. każdy `new_value` z kopii z wartością odczytaną po PK;
3. wskazane przez diagnozę powierzchnie: `tasks.description`, `feedback_items.description`, `feedback_items.title`, `interview_insights.section_overrides`;
4. co najmniej jeden native/text JSON oraz `presentation_deck_versions.deck_json_snapshot` i `teresa_proposals.target_payload_json`;
5. kontrolę, że nie przybył żaden surowy `<` / `>`; fixture `&amp;lt;script&amp;gt;` ma dać bezpieczny tekst `&#38;lt;script&#38;gt;`, nigdy element HTML, a licznik dokładnych `&lt;` / `&gt;` ma pozostać identyczny.

Dowód zachowania po zmianie kodu sanitizera pozostaje osobną bramką: zapis `He said "yes" and 'go'` przez realne API ma wrócić identyczny, a `<script>` ma pozostać neutralizowany. Migracja danych nie zastępuje tego testu.

## Rollback

Rollback jest osobnym, jawnie uruchamianym skryptem `rollback/20262280_feedback1_unescape_entities.down.sql` i korzysta wyłącznie z manifestu oraz kopii per tabela dla `run_id=20262280`.

- Przywraca `old_value` po pełnym PK.
- Aktualizuje wiersz tylko wtedy, gdy bieżąca wartość równa się `new_value` z manifestu. Późniejsza edycja użytkownika jest konfliktem i powoduje `STOP`, aby rollback jej nie nadpisał.
- Po przywróceniu porównuje wartość oraz hash z `old_value`, a następnie wykonuje zimny readback w nowym połączeniu.
- Nie kasuje tabel kopii i nie usuwa manifestu; oznacza run jako `ROLLED_BACK`.

Rollback drill na klonie musi wykazać: apply zmienia N > 0, replay zmienia 0, rollback przywraca dokładnie N, drugi readback odpowiada digestowi before.

## Ryzyka jawne

- Snapshot stagingu z 16.09.2026 miał 127 dotkniętych kolumn. Manifest jest wyliczany dynamicznie; dryf jest raportowany, a wykonanie zatrzymują wyłącznie blokery strukturalne lub bezpieczeństwa JSON.
- Wpis 137 rozszerzył zakres o `&amp;` i `&#96;`. `&lt;` / `&gt;` pozostają poza zakresem; ich dekodowanie wymaga nowej decyzji.
- Nazwa kolumny nie jest wystarczającym dowodem formatu JSON. Inventory mierzy parsowalność wartości, a migracja fail-closed.
- Sama naprawa danych nie utrzyma się bez przyjętej osobno poprawki sanitizera; kolejność wdrożenia musi zapewnić, że kod przestaje ponownie kodować cudzysłowy przed lub atomowo z backfillem.
