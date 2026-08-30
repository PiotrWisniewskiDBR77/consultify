---
doc_id: funkcje-odbior-159
status: canonical
owner: piotr
truth_type: work-status
established: 2026-08-30
---

# ODBIÓR 159 — backfill znaczników organizacji i kwarantanna fragmentów wiedzy

**Wstępny werdykt: STOP.** Dyżur zawierał **niezgłoszoną awarię klasy C**, która
wywracała **cały łańcuch migracji** na każdej bazie budowanej od zera.
**Naprawione i udowodnione różnicowo przez nadzorcę — dopiero po tym scalone.**

Marker `43322a8b31`, 3 commity wykonawcy + 1 naprawczy nadzorcy. 4 pliki:
migracja, serwis, test, raport.

## ★★★ AWARIA NIEZGŁOSZONA — łańcuch migracji ginął w połowie

Migracja `20260830_day159_chunk_org_backfill.sql` czyta `k.metadata` w CTE.
Kolumny `metadata` **nie ma** w `knowledge_chunks` w tym momencie łańcucha:

| plik | pozycja w `files.sort()` |
|---|---|
| `000_initdb_core_tables.sql` tworzy `knowledge_chunks` **bez** `metadata` | 1 |
| **`20260830_day159_chunk_org_backfill.sql` czyta `k.metadata`** | **536** |
| `20261120_fresh_db_schema_gap_closure.sql:2243` dodaje `metadata` | 670 |

**134 pliki za późno.** Sortowanie jest zwykłym alfabetycznym `files.sort()`
(`migrate.postgres.ts:188`), a `20260830` < `20261120`.

### Dowód różnicowy — dwie puste bazy, ten sam łańcuch

**Przebieg A (kod wykonawcy, bez naprawy):**
```text
✗ 20260830_day159_chunk_org_backfill.sql: column k.metadata does not exist
❌ Postgres migrate failed: column k.metadata does not exist
kod wyjscia: 1
```

**Przebieg B (po naprawie):**
```text
✅ Postgres migrations complete
kod wyjscia: 0
liczba bledow: 0
migracji zastosowanych: 867
```

**Idempotencja po naprawie:** drugi przebieg → `Applying migrations: 0`, kod 0.
**Schemat po naprawie:** `metadata text default '{}'`, `organization_id text`,
`org_quarantined boolean not null default false` + oba indeksy — sprawdzone `\d`.

### Kogo to dotyczyło

Każdej bazy budowanej sekwencyjnie od pustej: **nowy programista, CI, i przede
wszystkim odtworzenie po awarii z `_RUNBOOK_COFANIA.md`**. Łańcuch zatrzymywał się
na pozycji 536 i **pozostałe migracje nigdy się nie wykonywały**.

Demo i staging **nie były zagrożone** — mają pełną historię, więc `metadata` już
tam istnieje i migracja wchodzi jako pojedynczy przyrost. To jest dokładnie powód,
dla którego wykonawca tego nie zobaczył.

### Dlaczego dowód wykonawcy tego nie złapał

Jego dowód idempotentności powstał w **dwóch fazach**: najpierw pełny przebieg
migracji **bez pliku day159 na dysku**, potem dopisanie pliku i osobny przebieg
na **już w pełni zmigrowanej bazie**. Ta kolejność zdarzeń **ukrywa błąd zależności**.
Wynik był zielony, bo mierzył co innego, niż się wydawało.

**To jest kolejny przypadek znanego wzorca „harness kłamie": zieleń osiągnięta
w kolejności zdarzeń innej niż realne wdrożenie od zera.**

### Naprawa

Jedna linia na początku pliku migracji, addytywna i idempotentna:

```sql
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS metadata TEXT DEFAULT '{}';
```

Na demo/staging, gdzie kolumna istnieje — **no-op**. Bez rollbacku.

## Co przeszło i jest dobre

**Reguła wnioskowania organizacji jest fail-closed i to jest właściwa decyzja.**
`chunkOrgBackfillService.ts:27-48`: unia trzech kandydatów (`doc_id`, `document_id`,
`metadata.organization_id`), backfill **wyłącznie** gdy `COUNT(DISTINCT value) = 1`.

Szukałem wzorców, które powodują wyciek między organizacjami — **żadnego nie ma**:
brak `LIMIT 1` bez porządku, brak organizacji domyślnej, brak `COALESCE` na wartość
zastępczą, brak dopasowania po nazwie. Konflikt (`doc_id` i `document_id` wskazują
różne organizacje) idzie do kwarantanny z powodem `conflicting_organization_candidates`.

**Kwarantanna nic nie kasuje** — dwie kolumny flagujące, dane zostają.

**Dowód mutacyjny PRZESZEDŁ.** Usunięcie `AND k.organization_id = ?` z
`listEligibleChunks` (symulacja realnego wycieku) → test **padł poprawnie**:
```text
expected [...6 items] to deeply equal [...5 items]
+ "day159-c-pretagged"   ← fragment organizacji B wyciekl do zapytania o organizacje A
```
`describe(..., { retry: 0 })` — bez retry maskującego. Test uderza w realny Postgres
i woła produkcyjne funkcje, nie helper obejściowy.

## Ograniczenie — kwarantanna nie chroni dzisiejszego wyszukiwania

**22 pliki czytają `knowledge_chunks`. Zero z nich filtruje `org_quarantined`.**
`listEligibleChunks` ma zero konsumentów poza serwisem i testem.

Izolacja w żywym wyszukiwaniu działa dziś **inaczej** — przez własność dokumentu:
`ContextRetrievalService.ts:300-320` filtruje po `doc_id/document_id IN (readyDocs)`,
gdzie `readyDocs` pochodzi z `knowledge_docs WHERE organization_id = ?`;
`ragService.ts:485-490` łączy do `knowledge_docs` i filtruje `d.organization_id = ?`.

Czyli: **ochrona istnieje, ale nie ta, którą ten dyżur zbudował.** Nowa kolumna
i kwarantanna są dziś martwe względem produkcji. **Wykonawca przyznał to wprost** —
to poprawnie nazwane ograniczenie zakresu, nie fałszywe „gotowe".

## Klasyfikacja rozdzielona

| Część | Ocena |
|---|---|
| reguła backfillu (fail-closed, unia, kwarantanna, rollback) | **A** |
| test izolacji `listEligibleChunks` | **A** |
| ochrona żywego wyszukiwania przed wyciekiem | **D** — martwy kod, zero konsumentów |
| bezpieczeństwo migracji na świeżej bazie | **było C → naprawione, teraz A** |
| liczby 26 177 / 70% | **D** — ekstrapolacja z fixtury 10 wierszy, jawnie oznaczona |

## Czego NIE zweryfikowałem

- **Realnej liczby 26 177 ani rozkładu na demo** — nie łączyłem się z żadną zdalną
  bazą. Wszystkie liczby pochodzą z fixtury 10 wierszy (6 + 3 + 1 = 10, arytmetyka
  się zgadza **na fixturze**).
- **Czy w przedziale pozycji 536–670 są INNE migracje z tą samą ukrytą zależnością.**
  Sprawdziłem wyłącznie `metadata`. **To jest otwarte pytanie i pozycja na następną
  serię** — jeden taki błąd znaleziony przypadkiem oznacza, że mogą być kolejne.
- Zachowania na realnym demo/staging (tam migracja wejdzie jako przyrost).
- Współbieżności triggerów append-only.

## Werdykt

**Scalone po naprawie.** Wykonawca zrobił dobrą, ostrożną robotę merytoryczną —
reguła fail-closed jest właściwa i broni się pod mutacją. Ale jego procedura dowodowa
miała lukę, która przepuściła awarię wywracającą odtworzenie bazy po katastrofie.

**Bezpiecznik do szkieletu instrukcji:** każda migracja czytająca kolumnę musi być
sprawdzona **pełnym przebiegiem od PUSTEJ bazy**, nie przyrostem na bazie już
zmigrowanej. Przyrost na gotowej bazie **nie jest dowodem**.
