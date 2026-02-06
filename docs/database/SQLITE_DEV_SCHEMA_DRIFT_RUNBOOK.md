## Cel

Ten dokument opisuje **powtarzający się problem HTTP 500 w trybie dev**, który w praktyce wynikał z **dryfu schematu SQLite** (stare pliki bazowe tworzyły tabele w innym kształcie niż aktualny kod).

Najważniejszy efekt uboczny: backend potrafił rzucać błędy typu:

- `SQLITE_ERROR: table activity_logs has no column named old_value`

To bywało “tylko warningiem”, ale w zależności od ścieżki kodu mogło eskalować do 500 i psuć UX (np. ekran `HTTP 500 Internal Server Error` + `Retry` w module Assessment).

---

## Objawy (Symptoms)

- W UI pojawia się ekran błędu z komunikatem `HTTP 500 Internal Server Error` i przyciskiem `Retry` (np. `Assessment / Overview`).
- W logach backendu powtarzają się ostrzeżenia/wyjątki SQLite o brakujących kolumnach, najczęściej:
  - `activity_logs.old_value`
  - `activity_logs.new_value`
  - `activity_logs.entity_name`
  - `activity_logs.ip_address`
  - `activity_logs.user_agent`
  - `activity_logs.correlation_id`

---

## Przyczyna (Root cause)

W repo istnieją **różne “baseline” definicje** tej samej tabeli `activity_logs`:

- `server/migrations/000_z_core_baseline.sql` (stara, minimalna definicja)
- `server/migrations/000_initdb_core_tables.sql` (nowsza, bogatsza definicja)

Jeśli lokalna baza SQLite została kiedyś utworzona z minimalnego baseline, to późniejsze migracje typu:

- `CREATE TABLE IF NOT EXISTS activity_logs (...)`

**nie dołożą brakujących kolumn** (bo tabela “już istnieje”). Kod aplikacji zaczął natomiast używać nowych pól, więc INSERT/SELECT zaczynały sypać błędami.

---

## Naprawa w kodzie (Fix implemented)

### 1) Auto-repair brakujących kolumn przy starcie (SQLite)

`server/src/database/DatabaseInitializer.ts` ma mechanizm:

- wykrywa brakujące kolumny dla kluczowych tabel
- wykonuje `ALTER TABLE ... ADD COLUMN ... TEXT`

Został rozszerzony o wymagane kolumny dla `activity_logs`:

- `entity_name`
- `old_value`
- `new_value`
- `ip_address`
- `user_agent`
- `correlation_id`

Efekt: po restarcie backendu, stara baza SQLite jest automatycznie “doleczana”, a ostrzeżenia i potencjalne 500 przestają się pojawiać.

### 2) Ujednolicenie baseline

`server/migrations/000_z_core_baseline.sql` został zaktualizowany tak, aby `activity_logs` miało pełny zestaw kolumn (spójny z aktualnym kodem).

### 3) Fail-safe w ActivityService

`server/src/services/ActivityService.ts` ma fallback: jeśli INSERT do `activity_logs` nie przejdzie z powodu brakujących kolumn, wykona minimalny INSERT kompatybilny z najstarszym schematem. To zabezpiecza request flow w sytuacjach, gdzie initializer nie zdążył jeszcze naprawić schemy.

---

## Jak odzyskać środowisko dev (Recovery / Runbook)

### Szybki fix (najczęściej wystarcza)

- Zrestartuj backend (`npm run dev`).
- Poczekaj aż backend się podniesie.
- Odśwież stronę w przeglądarce “na twardo” (żeby wyczyścić stan HMR).

Po restarcie backend wykona auto-repair i powinien przestać emitować błędy “no column named …”.

### Gdy baza jest mocno “rozjechana”

Jeżeli pojawiają się kolejne błędy schemy (inne tabele/kolumny), najpewniejszą ścieżką jest:

- wykonać backup (`npm run db:backup`)
- odbudować bazę na czysto z migracji + seed (patrz: `package.json` → `dev:backend` i `db:migrate:safe`)

Uwaga: odbudowa bazy lokalnej jest operacją destrukcyjną dla danych dev — zawsze rób backup albo przenieś plik DB do katalogu `_backup/`.

---

## Jak zapobiec powtórce (Prevention checklist)

- Zawsze uruchamiaj migracje przed startem backendu: `npm run db:migrate:safe`
- Jeżeli widzisz w logach `SQLITE_ERROR: ... no column named ...`, to traktuj to jako **sygnał dryfu schemy**, a nie “nieszkodliwy warning”.
- Nie dodawaj nowych kolumn wyłącznie przez `CREATE TABLE IF NOT EXISTS` w baseline — dorzuć:
  - albo migrację `ALTER TABLE ... ADD COLUMN ...`
  - albo dopisz kolumnę do `REQUIRED_COLUMNS` w `DatabaseInitializer` (żeby auto-repair działał dla istniejących DB)
