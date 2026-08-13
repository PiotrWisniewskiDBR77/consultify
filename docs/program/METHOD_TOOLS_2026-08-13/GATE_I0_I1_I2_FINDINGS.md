# Gate I0 / I1 / I2 — ustalenia przed integracją A+B+C

> Kandydat integracyjny: `codex/tools-integration-20260813` @ `d358a9fbe6`
> (nowa gałąź od zespołowego SHA, poza worktree agentów).
> Nic nie scalone. Bez push, deploy, PROD.

## Gate I0 — potwierdzone

| Fala | SHA | Pliki | Zmiany |
|---|---|---|---|
| A — bootstrap + C14 | `5d5646b3e3` | 8 | +1305 / −1 |
| B — idempotencja | `ef29137d1e` | 5 | +1273 / −23 |
| C — `tool_outputs` | `b1692a29fa` | 8 | +1527 / −85 |

Wszystkie trzy oparte na `0b71985761` (zawartym w `d358a9fbe6`), 0 commitów za.

**Wspólne ścieżki:**

- A ∩ B = **∅**
- A ∩ C = **∅**
- B ∩ C = **dokładnie jeden plik**: `server/src/controllers/ToolController.ts`

Wniosek: A jest rozłączna i może wejść pierwsza. Jedyna kolizja kodu to jeden
plik między B i C.

**Migracje wnoszone (nazwy odczytane z drzewa git, nie z raportów agentów):**

| Fala | Plik |
|---|---|
| baseline | `946_tool_outputs_reports_lineage.sql` |
| C | `947_tool_outputs_idempotency_guard.sql` |
| B | `948_tool_promotion_idempotency.sql` |
| A | `949_tool_initiative_links_org_scope.sql` |
| A | `950_initiatives_priority_order_gap.sql` |
| A | `951_report_builder_reports_source_refs_json_gap.sql` |

`LATE_PHASE_MANIFEST` na baseline jest **pusty** (`const LATE_PHASE_MANIFEST: string[] = []`).

## Gate I2 — rozstrzygnięcie sprzeczności między agentami

Agenci A i B podali **sprzeczne** ustalenia o producencie `tool_initiative_links`.

| Twierdzenie | Werdykt | Dowód |
|---|---|---|
| A: tworzy ją też `20260719_baseline_gap.sql` | ✅ **PRAWDA** | linia 9533: `create table if not exists "public"."tool_initiative_links"` |
| B: jedynym producentem jest wykluczone `291` | ❌ **NIEPRAWDA** | B przeoczył producent w pliku bazowym |
| `PROMOTED_LEGACY_PRODUCERS` zawiera 291 | ❌ nie zawiera | lista: 081, 073, 215 |

**Uwaga metodyczna — mój własny błąd pomiaru.** Pierwszy grep, którym
sprawdzałem producentów, był zakotwiczony na `CREATE TABLE` wielkimi literami
i **przeoczył** producent zapisany małymi literami w cudzysłowach. Przez chwilę
wspierał on błędną tezę B. Wzorzec wykrywający musi być
case-insensitive i tolerować `"public"."nazwa"`.

### Zagrożenie, które to ujawnia

Kolejność faz runnera: faza 0 (numerowane) → faza 1 (datowane) → faza 2 (manifest).

```
948 (faza 0)                    ← defensywne CREATE TABLE fali B
20260719_baseline_gap (faza 1)  ← KANONICZNY producent, "if not exists"
949 (faza 2)                    ← manifest fali A
```

Migracja 948 utworzyłaby tabelę **pierwsza, we własnym kształcie**, przez co
`create table if not exists` w kanonicznym pliku bazowym stałby się **cichym
no-opem**. Kanoniczny kształt zostałby pominięty — bez błędu, bez konfliktu,
bez śladu w logu.

Zgodnie z decyzją koordynatora: sekcja `CREATE TABLE IF NOT EXISTS
tool_initiative_links` musi zniknąć z 948, a migracja skonsolidowana
`948_tool_promotion_tenant_idempotency.sql` ma trafić do `LATE_PHASE_MANIFEST`.

## Gate I1 — BLOKER: runnera nie da się dziś przetestować jednostkowo

Test bramki I1 ma ćwiczyć **realne** funkcje runnera, nie ich kopię. Kopia
testowałaby samą siebie i przepuściła każdą rozbieżność. Import realnych
funkcji jest jednak dziś **niemożliwy** z dwóch niezależnych powodów:

1. **Shebang.** `server/scripts/migrate.postgres.ts` zaczyna się od
   `#!/usr/bin/env tsx`. Rollup (używany przez vitest) przerywa parsowanie
   błędem `Parse failure: Expected ident`.
2. **Efekty uboczne importu.** Plik wykonuje migrację na poziomie modułu —
   sam import kończy się `❌ Postgres migrate failed: DATABASE_URL is required`.
   Test importujący go uruchamiałby migracje.

Dodatkowo `phaseAndKeyFor`, `compareMigrationOrder`,
`sortMigrationsDeterministically`, `getAllMigrations`, `LATE_PHASE_MANIFEST`
i `PROMOTED_LEGACY_PRODUCERS` **nie są eksportowane**.

Próbowałem dodać wąską powierzchnię `__runnerOrderingInternalsForTests`.
Nie rozwiązuje to problemu — shebang i efekty uboczne pozostają — więc
**wycofałem tę zmianę**, żeby nie zostawiać martwego kodu udającego rozwiązanie.

### Wymagany warunek wstępny Gate I1

Wydzielić czystą logikę porządkowania do osobnego modułu, np.
`server/scripts/migrationOrdering.ts`:

- `NUMBERED_RE`, `DATED_RE`, `LATE_PHASE_MANIFEST`, `PROMOTED_LEGACY_PRODUCERS`,
  `EARLY_VERSION_OVERRIDES`,
- `phaseAndKeyFor`, `compareMigrationOrder`, `sortMigrationsDeterministically`,
  `getAllMigrations`.

Moduł bez shebangu i bez efektów ubocznych; `migrate.postgres.ts` importuje
z niego. Refaktor zachowuje zachowanie i jest warunkiem koniecznym dla
wszystkich dziesięciu kontroli Gate I1 — w tym kontroli negatywnych.

Gotowy szkielet testu (10 warunków, kontrole negatywne, wydruk kolejności
946-951, wykrywanie fantomu, wykrywanie wielu producentów wzorcem
case-insensitive) czeka w
`tests/unit/migrationRunnerOrdering.test.ts` i wymaga wyłącznie podmiany
źródła importu po wydzieleniu modułu.

## Stan bramek

| Bramka | Stan |
|---|---|
| I0 | ✅ domknięta |
| I1 | ⛔ zablokowana — wymaga wydzielenia `migrationOrdering.ts` |
| I2 analiza | ✅ rozstrzygnięta |
| I2 wykonanie | ⛔ niewykonane — migracja skonsolidowana nie powstała |

`RUNTIME_ACTIVE = 0`.
