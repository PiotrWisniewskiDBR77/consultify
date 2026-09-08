# Martwe tabele — skan metodą B (dokończenie kroku 2 paczki D0)

**Data:** 2026-09-08 · **Baza:** `consultify_kopia_d0` (kopia `consultify_staging_kopia`,
kontener `consultify-pg18`, port 54418). **Wyłącznie SELECT** — skan nie dotknął
stagingu (thomas), demo (trolley) ani produkcji (centerbeam).

Ten plik zamyka zadanie z [`PLAN.md`](PLAN.md) §1.2: *„Metoda była zgrubna (grep po
samej nazwie w `server/src`). Ostrzejszy skan po czasownikach SQL nie zdążył się
skończyć. D0 krok 2 ma go dokończyć, zanim ktokolwiek cokolwiek skasuje."*

Surowy wynik dla wszystkich 546 niepustych tabel:
[`evidence/dane-pokazowe-en/skan-martwych-tabel-20260908.csv`](../../../evidence/dane-pokazowe-en/skan-martwych-tabel-20260908.csv).

---

## 1. Metoda — i czego NIE widzi

**Metoda B (automat).** Dla każdej z **546 niepustych** tabel szukano w kodzie
wzorca „czasownik SQL bezpośrednio przed nazwą tabeli":

```
(from|join|into|update|delete from|truncate|insert into|table)
   \s+(only\s+)?("?public"?\.)?["`']?<nazwa_tabeli>["`']?\b       (bez rozróżniania wielkości liter)
```

Przeszukane korpusy (bez `node_modules`, `dist`, `__tests__`, `__mocks__`, `_backup`):

| Korpus | Plików |
|---|---:|
| `server/src` (runtime serwera — rozstrzygający) | 3018 |
| `server/scripts` (narzędzia operatora) | 343 |
| `server/migrations` (DDL) | 1306 |
| `src` (frontend) | 4140 |
| `scripts` (skrypty repo) | 504 |

**Metoda B ma jedną udowodnioną ślepą plamę i trzeba ją znać.** Gdy kod trzyma
nazwę tabeli w stałej i wstrzykuje ją do zapytania (`const TABLE = 'x'` … ``FROM
${TABLE}``), regex nie widzi połączenia. **Trzy z osiemnastu kandydatów okazały
się właśnie takim przypadkiem — są ŻYWE.** Dlatego każdy z 18 kandydatów został
sprawdzony **ręcznie, oczami, w kodzie**, a wynik ręcznej weryfikacji, nie automat,
jest tu prawdą. Automat sam w sobie **nie jest wystarczającą podstawą do kasowania**.

**Wynik automatu:** 546 tabel niepustych → **18 bez trafienia SQL w `server/src`**
(528 ma czytelnika). **Wynik po weryfikacji ręcznej:** 15 martwych, 3 żywe.

---

## 2. ŻYWE mimo zera trafień automatu (ślepa plama — NIE KASOWAĆ)

| Tabela | Wierszy | Dowód życia |
|---|---:|---|
| `initiative_gate_ai_events` | 84 | `server/src/services/initiative/gateAiTelemetryService.ts:18` `const TABLE = 'initiative_gate_ai_events'` → `:55` `INSERT INTO ${TABLE}` |
| `presentation_template_governance_events` | 24 | `server/src/services/presentationTemplateGovernanceService.ts:111` `const TABLE_EVENTS` → `:295` `FROM ${TABLE_EVENTS}`, `:332` `INSERT INTO ${TABLE_EVENTS}` |
| `initiative_feature_flags` | 2 | `server/src/services/initiative/initiativeGateAiConfig.ts:20` `const TABLE` → `:59` `SELECT … FROM ${TABLE}`, `:113` `INSERT INTO ${TABLE}` |

---

## 3. MARTWE — 15 tabel, 152 wiersze razem

Podzielone na trzy klasy według tego, **jak pewny jest dowód śmierci**.

### 3.1 Klasa A — kopie zapasowe po naprawach (zero ryzyka, 79 wierszy)

Powstały jako `..._backup_...` przy naprawach z lipca 2026. Nie są danymi
produktu. Nikt ich nie czyta — ani `server/src`, ani `server/scripts`, ani frontend.

| Tabela | Wierszy | Ślad w `server/migrations` |
|---|---:|---|
| `_z139_repair_backup_20260710` | 49 | 1 plik (tworzenie) |
| `z139_backup_919_work_canvas_versions` | 23 | 1 plik |
| `z139_backup_919_tasks` | 2 | brak |
| `_v8_flag_backup_20260710` | 2 | 1 plik |
| `z139_backup_919_decisions` | 1 | brak |
| `z139_backup_t5_notebook_pages_title` | 1 | brak |
| `_migration_518_done` | 1 | 2 pliki (znacznik wykonania migracji) |

### 3.2 Klasa B — raporty jednorazowych migracji (zero ryzyka, 2 wiersze)

Zapis „migracja X przebiegła tak". Zapisane raz przez migrację, nigdy nieczytane.

| Tabela | Wierszy |
|---|---:|
| `assessment_initiative_batch_dedup_reports` | 1 |
| `tool_initiative_links_backfill_reports` | 1 |

### 3.3 Klasa C — schemat produktu bez ani jednego czytelnika (71 wierszy)

Te tabele **wyglądają** jak dane produktu, ale w runtime Postgresa nikt ich nie
czyta ani nie zapisuje. Każdą sprawdzono ręcznie.

| Tabela | Wierszy | Co znaleziono ręcznie |
|---|---:|---|
| `finance_periods` | 45 | Zero wzmianek w CAŁYM repozytorium (poza schematem). Osierocona po przejściu na `finance_stmt_periods` — potwierdza to PLAN.md §1.2 |
| `interview_template_questions` | 39 | Jedyna wzmianka w `server/src`: `PostgresDatabase.ts:327` — wpis w mapie kolumn logicznych (`['is_required']`), nie zapytanie. Tabela tworzona w `server/migrations/727_beta_missing_tables.sql:621`. Zero SELECT/INSERT/UPDATE. Runtime używa `interview_templates` (kolumna JSON `questions`) — `interviewCandidateHandoff.ts:329` |
| `finance_reason_codes` | 14 | Zero wzmianek poza migracją tworzącą |
| `ai_deep_thinking_confirms` | 8 | Zero wzmianek poza migracją tworzącą |
| `audit_findings` | 3 | Sama migracja mówi o niej wprost: `server/migrations/20260813_audits_method_core.sql:7` — *„`audit_findings` (zero czytelników w kodzie)"*, `:408` *„Nowa tabela zamiast rozszerzania martwej `audit_findings`"*. W `server/src` tylko komentarz w `auditInitiativeService.ts:13` |
| `system_prompts` | 2 | Czytana **wyłącznie** przez `server/scripts/seed_roles.js` — skrypt z ery SQLite (`INSERT OR REPLACE`, składnia nieobsługiwana przez Postgres) i przez `000_z_core_baseline.sql` (też `INSERT OR IGNORE`). W runtime PG używana jest `ai_system_prompts` (`DatabaseInitializer.ts:153`, `archSanityCheck.ts:54`). Martwa w Postgresie |

---

## 4. Wniosek dla paczki D0 — i czego ten skan NIE upoważnia

1. **Skan jest zakończony.** Warunek z PLAN.md §1.2 („bez tego kroku nikt nic nie
   kasuje") jest spełniony dla kroku sprzątania organizacji.
2. **Ten skan NIE jest zgodą na kasowanie tabel.** 15 martwych tabel to
   **152 wiersze** — 0,09 % z 164 403. Kasowanie tabel jest poza zakresem PLAN.md
   (§1: *„usunięcie tabeli to migracja destrukcyjna, a demo jest święte"*).
   Jedyna wartość tej listy dla D0: **żadna z 15 martwych tabel nie jest
   przeszkodą ani niespodzianką przy kasowaniu organizacji.**
3. **Kasowanie organizacji nie zależy od tego skanu.** Wiersze znikają przez
   `ON DELETE CASCADE` na `organizations.id`, niezależnie od tego, czy tabelę
   ktoś czyta.
4. **Trzy z 18 kandydatów były żywe.** Gdyby ktoś zaufał automatowi bez
   ręcznej weryfikacji, skasowałby telemetrię bramek inicjatyw, dziennik
   governance szablonów prezentacji i flagi bramki AI. To jest miara tego, ile
   warta jest sama liczba z grepa.

## 5. Sprostowanie liczby z PLAN.md

PLAN.md §2.3 podaje topologię *„164 kluczy obcych na `organizations.id`
(129 CASCADE, 8 SET NULL, 27 NO ACTION)"* — za `cleanup-orphan-demo-orgs.ts`,
zmierzoną na zrzucie z **2026-07-19**. **Pomiar na dzisiejszej kopii daje inne
liczby:**

| Reguła | PLAN.md (07-19) | Kopia D0 (09-08) |
|---|---:|---:|
| `CASCADE` | 129 | **183** |
| `SET NULL` | 8 | **11** |
| `NO ACTION` | 27 | **94** |
| `RESTRICT` | — | **6** |
| **Razem** | **164** | **294** |

**Do wyczyszczenia ręcznie przed skasowaniem organizacji jest 100 kolumn**
(94 `NO ACTION` + 6 `RESTRICT`), nie 27. Skrypt `scripts/dane/usun-organizacje.ts`
**nie ma tej liczby zaszytej** — czyta ją z `information_schema` przy każdym
uruchomieniu, więc nie zestarzeje się jak ta w planie. Wśród nich jest m.in.
`users.organization_id` — użytkownicy **nie** znikną kaskadą i muszą być usunięci
jawnie.
