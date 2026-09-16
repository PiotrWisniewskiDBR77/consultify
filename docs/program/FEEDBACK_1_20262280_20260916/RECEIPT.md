# FEEDBACK-1 — migracja 20262280

Marker: `[ODMROZENIE 05_INITIATIVES DEC-575]`, `[ODMROZENIE 06_EXECUTION DEC-575]`, `[ODMROZENIE 07_MY_WORK_AGENT DEC-575]`, `[ODMROZENIE 13_CHAT DEC-575]`

Status: **CODE READY FOR CTO REVIEW — DATA APPLY HOLD (dump 11.09 EVIDENCE_MISSING)**

Base: `de751a9af8c6b801959c56e52641971a2993f2d4`

## Zakres

- Dynamiczny preflight wszystkich kolumn tekstowych i JSON w `public`, przed pierwszym `UPDATE`.
- Dokładnie sześć tokenów: `&amp;`, `&quot;`, `&#39;`, `&#x27;`, `&#x60;`, `&#96;`.
- `&lt;` / `&gt;` pozostają encjami; kontrola before/after liczy surowe delimitery `<` / `>`.
- Pełne, także złożone PK zapisane w `pk_json`; brak PK = STOP.
- JSON: tryb wynika z treści, nie z nazwy kolumny; wszystkie dotknięte wartości parsowalne = `json_text`, żadna = `plain_text`, mieszane = STOP. Transformowane są wyłącznie stringowe wartości; token w kluczu = STOP.
- Domyślna bramka wymaga 87 dotkniętych kolumn przy każdym niezerowym inventory; 0 jest dozwolonym fresh no-op. Fixture używa wyłącznie transakcyjnego `SET LOCAL` z własną oczekiwaną liczbą.
- Trwały manifest i osobna kopia dla każdej tabeli.
- Replay po zastosowaniu = zero nowych zmian i kopii.
- Rollback przywraca tylko wartość nadal równą `new_value`; późniejsza edycja = STOP przed pierwszym restore.

## Dowody lokalne

- Numer `20262280` był wolny na bazie startowej.
- PostgreSQL 17, kontener `cx-feedback20262280-pg`, port lokalny 6455.
- Pełny fresh strict chain po poprawkach review na `pgvector/pgvector:pg17`: RC=0, 924/924 migracje ze statusem `success`; `20262280_feedback1_unescape_entities.sql` wykonana przez kanoniczny runner bez własnego `BEGIN`/`COMMIT`.
- Osobny bezpośredni replay po pełnym chainie: RC=0, strict no-op, manifest `APPLIED`, `columns_before=0`, `expected_columns=87`, backup/change/after = 0.
- Fresh migration + replay: RC=0, manifest `APPLIED`, 0 kolumn / 0 kopii / 0 zmian.
- Fixture: 5 kolumn, 6 par wiersz-kolumna, 20 wystąpień; backup=6, changed=6, zmierzony after=0.
- Plain text z composite PK oraz native JSON / JSON-text: sześć tokenów naprawionych; klucze i typy JSON zachowane. Neutralna nazwa `content` z parsowalnym JSON została sklasyfikowana jako `json_text`; neutralna kolumna z mieszanym JSON/plain kończy się STOP.
- `&amp;lt;script&amp;gt;` → tekst `&lt;script&gt;`; surowe delimitery `<` / `>` before=0, after=0.
- Replay fixture: zero delta, digest kopii bez zmian.
- Readback po apply i po rollbacku wykonują nowe klienty PostgreSQL o PID innym od klienta wykonującego zmianę. Zimny rescan po apply potwierdza 0 pozostałych sześciu tokenów.
- Każda kolumna emituje `NOTICE` z rzeczywistymi licznikami before/after; manifest agreguje ponownie zmierzone `columns_after`, `row_column_pairs_after` i `occurrences_after`.
- Rollback: 6/6 przywrócone, digest wszystkich fixture po rollbacku równy digestowi przed migracją.
- Fail-closed: brak PK, zmieniana kolumna należąca do PK, kolumna generated/identity i token w kluczu JSON cofają całą transakcję; konflikt po późniejszej edycji zatrzymuje rollback bez częściowego restore.
- Focused RealPG: 8/8 testów PASS (`--retry=0`), obejmujące fresh/replay, naprawę, cold readback, raw-angle control, default gate 87, neutralny JSON, mixed STOP i rollback conflict.
- Inventory smoke na neutralnej kolumnie `content`: RC=0; poprawna klasyfikacja `mixed_json_text` i jawny blocker przed zapisem.

## Dump 11.09

Autoryzowane dokumenty podają nazwę `staging-thomas-przed-wdrozeniem-linii-20260911-2036.dump` i SHA-256 `85f0d5aafcd479b1b89b25b7fad3e46e3a147937f4f68ea47bbdd1a5c2f61531`. W dozwolonych receiptach, kanale i tym worktree nie ma bezpośredniej ścieżki do pliku. Test na dumpie ma status **EVIDENCE_MISSING**; nie wykonano migracji na niezweryfikowanym źródle ani nie zastąpiono dumpu inną bazą.

## Granice

- Nie wykonano staging/demo.
- Nie użyto migracji `20262280` poza lokalnym PostgreSQL.
- Kod jest zamrożony do review; DATA APPLY pozostaje HOLD do testu na autoryzowanym dumpie 11.09.

## Niezależny rereview

**CODE READY, 0 P0 / 0 P1 implementacyjnych.** HOLD dotyczy wyłącznie brakującego dowodu na dumpie 11.09. Przed DATA APPLY wymagane: inventory = 87 / 0 blockerów, apply, cold readback powierzchni kanonicznych, replay, rollback oraz cold digest.
