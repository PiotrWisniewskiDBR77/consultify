# RAPORT — sprzątanie danych testowych DBR77 (staging)

Data: 2026-09-06 (wykonane 2026-09-05 wieczorem, przed ogłoszeniem MVP)
Organizacja: DBR77 (`a3e05d4a-5397-419d-b486-8e44366c0063`)
Baza: staging (Railway, `DATABASE_PUBLIC_URL` ze zmiennych `railway variables --environment staging --service consultify`) — **NIE produkcja consultify.ai**
Skrypt: `server/scripts/sprzatanie-danych-testowych.ts`
Gałąź: `data/sprzatanie-staging` w worktree `/private/tmp/wt-clean` (bazowa: `origin/staging`)

## Metoda

1. Dynamiczny skan `information_schema` — wszystkie tabele z `organization_id` (1275) →
   470 kandydatek z kolumną tekstową name/title/label/description/subject.
2. Dla każdej z 470 policzone DOKŁADNE (bez `LIMIT`) trafienia wzorca
   `AUDYT-|__M06|REPRO_TEST|_TMP|TEST-|test test|Lorem|asdf|qwerty|xxx|[E2E]|e2e-|smoke-|probe|dummy|foo bar`
   — 17 tabel + `meetings` miały trafienia.
3. Każde trafienie przejrzane RĘCZNIE (treść, `created_at`, `created_by`) — znaleziono i
   wykluczono 2 fałszywe trafienia (patrz niżej).
4. Dla pozostałych: `pg_constraint` (FK-dzieci + `delete_rule`), CHECK na kolumnach
   status/lifecycle_state, `information_schema.triggers` — żeby wybrać hard-delete albo
   soft-delete i nie złamać żadnego ograniczenia ani nie walczyć z triggerem.
5. `--apply` w jednej transakcji (BEGIN/COMMIT), log każdej zmiany do `APPLY.log`.
6. Po `--apply`: ponowny skan — 0 pozostałych w tabelach hard-delete, spodziewane
   pozostałości tekstowe w tabelach soft-delete (tytuł nie zmienia się, zmienia się status).

## Liczby per tabela (usunięte / zarchiwizowane / przetłumaczone)

| Tabela | Akcja | Liczba | Szczegóły |
| --- | --- | --- | --- |
| organization_context_items | DELETE (hard) | 164 | M05-E2E-*, `__M06_REPRO_TEST__` (13), M05-PROBE-* (5), ZPROBE-TOP-* (2), AUDYT-M06 2026 (3), M08-Manual-Test-Table |
| tasks | UPDATE title (tłumaczenie) | 65 wierszy / 42 unikalne tytuły | tylko katalog demo (`task-rich-*`, `task-demo-auto-*`, ogólne nazwy szablonowe) |
| initiatives | UPDATE name (tłumaczenie) | 46 wierszy / 25 unikalnych nazw | katalog demo + etykiety macierzy TOWS |
| v8_output_artifacts | DELETE (hard) | 43 | TEST-RELIABILITY-*, TEST-RETEST-*, *-E2E-20260806 |
| activity_logs | DELETE (hard) | 17 | WAVE1-TEST-CANVAS, qa-test-workflow, test-rec-map-direct-output |
| tool_sessions | UPDATE status='ARCHIVED' (soft) | 12 | MyWork idea/notebook z sesji M05-E2E i M05-PROBE-DELETEME |
| conclusions | UPDATE status='archived' (soft) | 12 | jw. |
| meetings | UPDATE title (tłumaczenie) | 9 | 9 realnych spotkań demo, EN→PL |
| artifact_lineage_receipts | DELETE (hard) | 10 | jedna sesja E2E z 2026-08-06 |
| presentation_templates | UPDATE lifecycle_state='deprecated', is_active=false, deprecated_at=now() (soft) | 6 | E2E-20260806 |
| generated_workbooks | UPDATE archived_at=now() (soft) | 6 | E2E-20260806 (dopasowanie po title LUB file_name, deduplikowane) |
| document_studio_templates | UPDATE status='deprecated' (soft) | 4 | E2E-20260806 |
| canonical_inbox_items | DELETE (hard) | 4 | 3× M05-E2E-CV-Dec-*, 1× powiadomienie o eksporcie E2E-20260806 do PPTX |
| wave5_artifacts | UPDATE status='archived' (soft) | 3 | TERESA-E2E-20260806 / TEMPLATE-E2E-20260806 |
| tp_base_templates | UPDATE status='deprecated' (soft) | 3 | E2E-20260806 |
| decisions | UPDATE status='cancelled' (soft) | 3 | M05-E2E-CV-Dec-* |
| meetings | UPDATE status='cancelled' (soft) | 1 | spotkanie-ślad promptu AI, 0 uczestników, brak lokalizacji |
| presentation_decks | DELETE (hard) | 1 | Board Portfolio Update — E2E-20260806 |
| work_canvas_drafts | DELETE (hard) | 1 | Regression Test DocumentWAVE1-TEST-CANVAS |
| conclusion_source_packs | DELETE (hard) | 1 | powiązany z testową ideą MyWork |

**Razem: 411 zmian** (290 usunięć/archiwizacji śmieci testowych w 16 tabelach + 1 archiwizacja
spotkania-śladu promptu + 9 tłumaczeń tytułów spotkań + 65 wierszy zadań [42 unikalne tytuły]
+ 46 wierszy inicjatyw [25 unikalnych nazw]).

Pełny log zmian (tabela, id, przed → po): `APPLY.log`.

## Dwa fałszywe trafienia wzorca — wykluczone, NIE ruszane

1. **`wave6_context_ledger`** (2 wiersze) — `source_title` zawiera "Test-retest reliability
   of task-based measures..." i "Understanding Test-Retest Reliability..." — to realny
   artykuł/źródło o rzetelności psychometrycznej testów, nie dane testowe aplikacji.
   Cała tabela wyłączona z planu akcji.
2. **`canonical_inbox_items`** (2 wiersze) — powiadomienia o realnym wywiadzie: *"AI quality
   score: 65/100. Top note: Remove all test-related disclaimers..."* — dopasowanie na
   frazę "test-related" wewnątrz treści notatki jakości AI, nie na dane testowe. Wykluczone
   filtrem `description !~* 'AI quality score'`.

## Do decyzji właściciela (NIE ruszane automatycznie)

1. `initiatives.name = "New Idea"` — podejrzenie, że to domyślny placeholder aplikacji dla
   nowo tworzonej idei/inicjatywy (nie dane demo) — do sprawdzenia w kodzie/i18n, nie w bazie.
2. `initiatives.name = "F1-26 from assessment"`, `"F3 Rich Card Initiative"`, `"P1"` —
   niejednoznaczne kody wewnętrzne, znaczenie nieznane bez kontekstu właściciela.
3. `tasks.title = "kosmos"` (3 wiersze) i `"Frame"` (1 wiersz) — pojedyncze niejednoznaczne
   słowa, mogą być testowe, mogą nie być.
4. `tasks.title` zaczynające się od `[PRODUCTION] BUG:`, `[STAGING] BUG:`,
   `[STAGING] IDEA:`, `[DEVELOPMENT] BUG:` (25 wierszy) — **świadomie nieruszane**: wyglądają
   na realne wewnętrzne zgłoszenia inżynierskie (np. "Inbox- nie wyswietlaja sie wiadomosci",
   "Kanban gubi karty po odswiezeniu", "Logowanie pada dla calej organizacji"), nie na treść
   demo. Jeden z nich — `[STAGING] BUG: AAAA...A` (~110 znaków "A") — wygląda na przypadkowe
   wciśnięcie klawisza; do potwierdzenia przez właściciela, czy to prawdziwe zgłoszenie czy
   śmieć wart skasowania.
5. `tasks.title` zaczynające się od `AI/Industry:` (Safety CV, Digital Twin, Supply chain,
   3 unikalne, 7 wierszy) — mieszany PL/EN żargon techniczny, zostawione bez zmian (niska
   pewność, że automatyczne tłumaczenie poprawiłoby czytelność, a nie zepsuło terminologii).

## Ryzyka i uwagi

- **Materiały/dokumenty i audyty**: sprawdzone — `audits` (tabela główna) ma 0 rekordów dla
  DBR77, jedyny `audit_programs` ma polski tytuł ("Audyt gotowości do robotyzacji — linia
  spawalnicza — 05/09/2026"). Brak osobnej tabeli "materiały"; treść Materiałów żyje w tych
  samych tabelach artefaktów co już wyczyszczone (`presentation_decks`,
  `generated_workbooks`, `document_studio_templates`, `wave5_artifacts`,
  `v8_output_artifacts`) — ich śmieci testowe usunięte/zarchiwizowane w tym samym przebiegu.
- **Pułapka append-only sprawdzona**: `artifact_lifecycle_events` ma triggery
  `trg_artifact_lifecycle_events_deny_delete`/`_deny_update` (BEFORE DELETE/UPDATE) — ten
  skrypt NIE dotyka tej tabeli. Osobna tabela `artifact_lineage_receipts` (którą skrypt
  czyści) sprawdzona osobno: brak triggerów/reguł blokujących DELETE, brak FK, testowa
  transakcja z ROLLBACK potwierdziła wykonalność przed właściwym `--apply`.
- **decisions**: hard-delete pominięty mimo dostępnych CASCADE (decision_alternatives,
  decision_comments, decision_votes, ...) na rzecz soft-delete `status='cancelled'` — to
  realna wartość domenowa (nie wymyślona), więc trigger `trg_mw_decisions_inbox_lifecycle_upd`
  (AFTER UPDATE) obsługuje to tą samą ścieżką co zwykła zmiana statusu w aplikacji.
- **presentation_decks**: jedyny wyjątek hard-delete mimo obecności kolumny `status` — CHECK
  ogranicza wartości do `draft/generating/ready/exported/failed` (żadna nie oznacza "ukryty"),
  więc soft-delete był niewykonalny bez łamania CHECK; uzasadnienie: dzieci FK z CASCADE
  (`presentation_cards`, `presentation_deck_versions`).
- **tool_sessions**: przed decyzją sprawdzono, czy `budgets.source_tool_session_id` lub
  `finance_budget_registration_receipts.source_tool_session_id` (oba `ON DELETE NO ACTION`)
  odwołują się do testowych sesji — 0 odwołań. Mimo to wybrano soft-delete (status
  `'ARCHIVED'`), żeby nie polegać na tym jednorazowym sprawdzeniu w przyszłości.
- Weryfikacja demo/produkcja: skrypt ma twardy `throw` jeśli `DATABASE_URL` zawiera
  `consultify.ai` (ochrona przed przypadkowym uruchomieniem na produkcji).
- Ponowny dry-run po `--apply` pokazuje **0** pozostałych kandydatów w 9 tabelach
  hard-delete i **49** "widocznych" wzorcem tekstu w 8 tabelach soft-delete — to oczekiwane
  (tytuł/nazwa nie zmienia się przy archiwizacji, zmienia się status/lifecycle_state/
  archived_at — zweryfikowane bezpośrednio w bazie, patrz sekcja niżej).

## Weryfikacja stanu po apply (bezpośrednio w bazie)

- `conclusions` (12 dopasowanych) → wszystkie `status='archived'`.
- `decisions` (3) → wszystkie `status='cancelled'`.
- `tool_sessions` (12) → wszystkie `status='ARCHIVED'`.
- `generated_workbooks` (6) → wszystkie `archived_at IS NOT NULL`.
- `document_studio_templates` (4), `tp_base_templates` (3) → wszystkie `status='deprecated'`.
- `presentation_templates` (6) → wszystkie `lifecycle_state='deprecated'`, `is_active=false`,
  `deprecated_at IS NOT NULL`.
- `wave5_artifacts` (3) → wszystkie `status='archived'`.
- `meetings`: 9 tytułów po polsku (sprawdzone bezpośrednio), spotkanie-ślad promptu →
  `status='cancelled'`.
- `wave6_context_ledger`: oba wiersze o rzetelności testów nadal obecne, niezmienione
  (poprawność wykluczenia potwierdzona).

## Komendy

```bash
# lista zmiennych stagingu
railway variables --environment staging --service consultify --json

# worktree
cd /private/tmp/m03 && git worktree add -b data/sprzatanie-staging /private/tmp/wt-clean origin/staging
cd /private/tmp/wt-clean
ln -s /private/tmp/m03/node_modules node_modules
ln -s /private/tmp/m03/server/node_modules server/node_modules

# dry-run
DATABASE_URL="<DATABASE_PUBLIC_URL staging>" npx tsx server/scripts/sprzatanie-danych-testowych.ts \
  --org=a3e05d4a-5397-419d-b486-8e44366c0063 --dry-run

# apply
DATABASE_URL="<DATABASE_PUBLIC_URL staging>" npx tsx server/scripts/sprzatanie-danych-testowych.ts \
  --org=a3e05d4a-5397-419d-b486-8e44366c0063 --apply
```

Brak `git push` — zmiany tylko w lokalnym worktree (`data/sprzatanie-staging`, SHA
`feec31521ef982a12ba3694fbe7d2afa8e8a737f` + ten commit ewidencji) i w bazie stagingu.
