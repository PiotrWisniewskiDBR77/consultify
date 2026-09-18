# QD3 — Runbook: sprzątanie sierot `ateliertoys-demo-session-*`

Symulacja wykonana 2026-09-18 na **kopii** dumpu stagingu (`qd3_kopia` w kontenerze
`qoder-d-pg-4`, `127.0.0.1:6633`). Staging nietknięty — żadnych zapisów poza lokalną kopią.

## 1. Co realnie jest w bazie (pomiar, nie założenie)

| Fakt | Liczba | Dowód |
|---|---|---|
| Kolumny org-scoped (FK ∪ `organization_id` po nazwie) | **1293** | `probe-schema.txt`, `orphan-inventory.txt:1` |
| FK do `organizations.id` | 295 (94 NO ACTION, 6 RESTRICT, 184 CASCADE, 11 SET NULL) | `probe-schema.txt` |
| Tabele blokujące usunięcie orga (NO ACTION/RESTRICT) | **100** | `probe-schema.txt`, potwierdzone przez K7 (`k7-dry-run-1.txt`) |
| Wiersze organizacji w kopii | 12 realnych + **0** klonów (przed fixture) | `probe-schema.txt` (`ORPHAN_CLONE_ORGS=0`), `stan-przed.txt` |
| **Sieroty: różne id klonów bez wiersza w `organizations`** | **127** | `orphan-inventory.txt:7`, `dangling-residue.txt` |
| **Wiersze resztkowe tych 127 martwych klonów** | **23 331** | `dangling-residue.txt` (`DANGLING_ROWS_TOTAL`) |

Rozbicie reszty per tabela (`dangling-residue.txt`):

| Tabela | Kolumna | FK do `organizations` | Trigger BEFORE DELETE | Wiersze dangling |
|---|---|---|---|---|
| `work_signal_runs` | `organization_id` | brak | brak | 18 638 |
| `work_signals` | `organization_id` | brak | brak | 3 296 |
| `artifact_lineage_events` | `organization_id` | brak | brak | 381 |
| `artifact_lineage_receipts` | `organization_id` | brak | brak | 381 |
| `v8_artifact_origin_links` | `organization_id` | brak | brak | 381 |
| `results_writer_observations` | `organization_id` | brak | **`trg_results_writer_observation_no_delete`** | 254 (+1 z fixture = 255) |
| **Razem do zamiecenia** | | | | **23 077** |
| **Razem zablokowane (append-only)** | | | | **255** |

„126 sierot” z pomiaru CTO (16.09) to ta sama klasa: w tym dumpie jest **127** różnych
martwych id klonów. Wiersza `organizations` dla nich już nie ma — usunięto je wcześniej,
ale CASCADE nie sięga tabel bez zadeklarowanego FK.

## 2. Dlaczego istniejące narzędzia tego nie sprzątają

- `server/scripts/cleanup-orphan-demo-orgs.ts` (K7) startuje od `SELECT … FROM organizations`.
  Bez wiersza orga nie ma celu: 2. przebieg drukuje *„DB is already clean of K7 residue”*
  (`k7-apply-2-idempotencja.txt`), a 23 331 wierszy reszty zostaje.
- `organizationLifecycleService.deleteOrganizationDataInTransaction` robi `SELECT … FOR UPDATE`
  na `organizations` i rzuca `ORG_NOT_FOUND` (`organizationLifecycleService.ts:199-205`) —
  dla sieroty nie uruchamia się wcale.
- `scripts/dane/sprzatanie-klonow-demo-session-20260912.mjs` (cx4) wymaga przeglądanego
  manifestu dokładnych ID i dla nieobecnego orga robi `continue` — też nie zamiata reszty.

Wniosek: potrzebna była druga połowa — zamiatanie **po wartości**, nie po wierszu orga.
Dodany operator tool: `server/scripts/cleanup-orphan-demo-residue.ts`.

## 3. Procedura (kolejność ma znaczenie)

```bash
cd server

# KROK 1 — dry-run K7 (orgi, które JESZCZE mają wiersz w organizations)
DATABASE_PUBLIC_URL="postgres://…/railway" DEMO_ORG_ID=ateliertoys-demo \
  npx tsx scripts/cleanup-orphan-demo-orgs.ts

# KROK 2 — apply K7 (po akcepcie listy z kroku 1)
DATABASE_PUBLIC_URL="…" DEMO_ORG_ID=ateliertoys-demo FORCE_PURGE=true \
  npx tsx scripts/cleanup-orphan-demo-orgs.ts --apply

# KROK 3 — dry-run zamiatania reszty (sieroty bez wiersza orga)
DATABASE_PUBLIC_URL="…" DEMO_ORG_ID=ateliertoys-demo \
  npx tsx scripts/cleanup-orphan-demo-residue.ts

# KROK 4 — apply zamiatania (backup JSONL leci do server/_backup/qd3-residue-<ts>/)
DATABASE_PUBLIC_URL="…" DEMO_ORG_ID=ateliertoys-demo FORCE_PURGE=true \
  npx tsx scripts/cleanup-orphan-demo-residue.ts --apply

# KROK 5 — dowód idempotencji: powtórzyć KROK 4, musi być 0 usuniętych wierszy
```

Zasady: `DEMO_ORG_ID` bierze się z env stagingu (`ateliertoys-demo`); porównanie prefiksu jest
literalne (`left(col::text, char_length($1)) = $1`), nigdy `LIKE` z interpolowanym env;
`organizations` nigdy nie jest tabelą docelową; wiersze klonów, które **mają** jeszcze orga,
są domyślnie nietknięte (to domena K7) — `--include-live-orgs` zmienia zakres jawnie.

## 4. Wynik symulacji (kopii dumpu)

| Przebieg | Wynik | Plik |
|---|---|---|
| K7 dry-run | 3 cele (tylko klony z fixture — 127 sierot niewidocznych) | `k7-dry-run-1.txt` |
| K7 apply | 3 orgi + 6 wierszy NO-ACTION (`async_jobs` 3, `users` 3), reszta CASCADE | `k7-apply-1.txt` |
| K7 apply 2× | 0 celów, „already clean” (fałszywie ujemne wobec reszty) | `k7-apply-2-idempotencja.txt` |
| sweep dry-run | 6 tabel / 23 332 wiersze; sweepable **23 077**; skip append-only **255** | `qd3-dry-run-1.txt` |
| sweep apply | usunięte **23 077** (381+381+381+18 638+3 296), readback w transakcji 0, COMMIT | `qd3-apply-1.txt` |
| sweep apply 2× | **0** usuniętych — „Nothing sweepable” (idempotencja) | `qd3-apply-2-idempotencja.txt` |
| backup | 23 077 linii JSONL = 1:1 z usuniętymi wierszami, 14 MB | `qd3-apply-1.txt` (ścieżka) |

Integralność realnych danych (`stan-przed.txt` vs `stan-po.txt`):

- checksum 12 realnych organizacji: `abefaf06286125e3fb20ba0419cc22eb` **przed i po — identyczny**;
- wiersze realnych orgów w tabelach resztkowych: `work_signal_runs` 2157, `work_signals` 145,
  `artifact_lineage_events` 908, `artifact_lineage_receipts` 421, `v8_artifact_origin_links` 956,
  `results_writer_observations` 83 — **przed i po identyczne**;
- liczniki całkowite spadły dokładnie o usuniętą resztę: `work_signal_runs` 20 795 → 2 157,
  `work_signals` 3 441 → 145, `artifact_lineage_events` 1 289 → 908, `artifact_lineage_receipts`
  802 → 421, `v8_artifact_origin_links` 1 337 → 956; `results_writer_observations` 338 → 338.

## 5. Dowody mutacyjne (każdy mierzony, nie deklarowany)

| # | Mutacja / próba | Oczekiwanie | Wynik | Plik |
|---|---|---|---|---|
| M-A | `DEMO_ORG_ID='%'` (próba przemycenia wildcarda) | 0 celów — prefiks literalny | 0 celów | `mutacja-A-wildcard.txt` |
| M-B | `--apply` bez `FORCE_PURGE=true` | odmowa | exit 1, odmowa | `mutacja-B-dwie-klucze.txt` |
| M-C | connection string z `centerbeam` | odmowa | exit 1, odmowa | `mutacja-C-prod-refuse.txt` |
| M-D | fixture z 3 **żywymi** klonami: dry-run domyślny vs `--include-live-orgs` | guard rozróżnia | sweepable 0 vs 18 | `mutacja-D-guard-dangling.txt` |
| M-E | ręczny `DELETE` z `results_writer_observations` | trigger blokuje | ERROR append-only, exit 1 | `mutacja-E-append-only.txt` |
| M-F | **kod**: `blocked = new Map()` (guard append-only wyłączony) | wywrotka na triggerze + ROLLBACK całości | 15 wierszy usuniętych, potem ERROR, liczniki przed=po (4/3/3/97/49/37) | `mutacja-F-fail-closed.txt` |
| M-G | guard przywrócony → pełna pętla: sweep dry-run → K7 apply → K7 2× → sweep dry-run | reszta rośnie tylko w tabeli append-only | 254 → K7 0 celów → 255 dangling, sweepable 0 | `mutacja-G-petla-odtworzeniowa.txt` |

M-F jest dowodem fail-closed: transakcja jest jedna, więc częściowe usunięcie nie istnieje.

## 6. Co zostaje i wymaga decyzji CTO

**255 wierszy w `results_writer_observations`** (254 sprzed fixture + 1 z fixture) wskazuje
martwe klony i nie da się ich usunąć bez jawnego wyłączenia triggera
`trg_results_writer_observation_no_delete`. Skrypt celowo ich **nie rusza** i raportuje je
za każdym przebiegiem. To kolizja dwóch zasad: niezmienność rejestru obserwacji vs
„dane demo nie zostają w bazie”. Opcje do wyboru przez CTO:

- (a) zostawić (rejestr jest append-only z założenia; reszta to martwe id bez danych osobowych),
- (b) owner-governed purge z jawnym `ALTER TABLE … DISABLE TRIGGER` + wpis do rejestru decyzji,
- (c) anonimizacja kolumny `organization_id` — zablokowana tym samym triggerem (`_no_update`).

Drugie pytanie: czy resztę w `work_signal_runs` / `work_signals` / `artifact_lineage_*`
sprzątać na stagingu cyklicznie (cron operatora), czy jednorazowo po każdej czystce demo.

## 7. Rollback

Kopia dumpu jest rollbackiem symulacji. Dla przebiegu na żywo: każdy apply pisze
`server/_backup/qd3-residue-<ts>/*.jsonl` (wiersz w wiersz) + `receipt.json` z licznikami.
Przywrócenie = `INSERT` z JSONL do bazy z kopii; receipt jest dowodem, nie narzędziem restore.
K7 dodatkowo pisze własny JSON backup (`server/_backup/k7-orphan-orgs-<ts>.json`).

## 8. Pliki dowodowe w tym katalogu

`probe-schema.txt` · `orphan-inventory.txt` · `dangling-residue.txt` · `stan-przed.txt` ·
`stan-po.txt` · `k7-dry-run-1.txt` · `k7-apply-1.txt` · `k7-apply-2-idempotencja.txt` ·
`qd3-dry-run-1.txt` · `qd3-apply-1.txt` · `qd3-apply-2-idempotencja.txt` ·
`mutacja-A-wildcard.txt` · `mutacja-B-dwie-klucze.txt` · `mutacja-C-prod-refuse.txt` ·
`mutacja-D-guard-dangling.txt` · `mutacja-E-append-only.txt` · `mutacja-F-fail-closed.txt` ·
`mutacja-G-petla-odtworzeniowa.txt` · `fixture-klony.sql` · `fixture-aplikacja.txt`
