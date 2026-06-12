# RUNBOOK FAZY C — migracje + promocja + żywa weryfikacja (próg BETA)

> ## 📓 LOG WYKONANIA — STAGING, 2026-06-12 (autonomicznie)
> Railway CLI był zalogowany + `.env.staging.local` celuje w `caboose.proxy.rlwy.net` (publiczny proxy staging). Wykonano **Krok 2 (staging) + Faza 3** częściowo:
> - **`db:verify:schema:staging` (Faza 3) URUCHOMIONA** na żywej bazie → start: **64 brakujące tabele + 179 kolumn**.
> - **Migracje staging zaaplikowane** (`migrate.postgres.ts`, strict): 97 oczekujących → **0**. Po drodze naprawiono **13 realnych bugów migracji** (wszystkie pomagają też prod, wszystkie scommitowane): idempotencja seedów (kb_collections slug, Anna/Teresa profile FK+slug), SQLite-izmy boolean (is_active=1→TRUE), legacy `FREE` tier→BUDGET, `date_trunc` IMMUTABLE (UTC), FK type-mismatch (subscriber_tokens TEXT), retrofit kolumn na zdryfowanych tabelach (partner_learning_modules ×4, data_export_requests.org_id, webhook_deliveries.success).
> - **`✅ Postgres migrations complete`** — wszystkie przeszły. Drift: **64→28 tabel, 179→153 kolumn** (zamknięte 36 tabel).
> - **Pozostałe „phantom-applied" DOMKNIĘTE force-re-runem.** Część zgłaszanego driftu była fałszywa — narzędzie verify parsowało migracje, których runner celowo pomija (sqlite-only <500, `.sql.sql`, seed/initdb/fts5). Po naprawie verify-tool (replika `isSqliteOnlyMigration`) realny drift = 21 tabel + 44 kolumny: migracje >500 z `status=success`, ale brakiem efektów. Domknięte przez `DELETE FROM schema_migrations WHERE filename IN (17 plików)` + `migrate --only` (addytywne `IF NOT EXISTS`). Po drodze 2 dodatkowe bugi naprawione (548 boolean COALESCE, 573 FK plan_id TEXT). Ostatnie 2 „braki" (`v8_artifact_runs_new`, `_migration_532_temp`) to tabele tymczasowe (rename-swap / marker) — kolejny fix verify-tool (śledzenie DROP/RENAME).
> - **WYNIK KOŃCOWY: `✅ Schema matches migrations` — drift 64t+179c → 0. Faza 3 (staging) ZAMKNIĘTA.** 15 realnych bugów migracji naprawionych (wszystkie pomagają prod), 3 ulepszenia verify-tool. Wszystko scommitowane+wypchnięte.
> - **Co zostało (Faza 4 + prod):** żywa weryfikacja UI (login = twarda ściana dla mnie) → API/DB smoke jako substytut; prod cutover (backup + ten sam zestaw migracji, już naprawiony) — gotowe do wykonania, decyzja go/no-go u właściciela.
> - **Wniosek operacyjny:** na zdryfowanej bazie migracje wymagały łatania pod realny stan (15 bugów). Na świeżej pustej bazie (`CUTOVER_RUNBOOK`) te bugi są już naprawione w repo — prod cutover będzie znacznie czystszy.

**Data:** 2026-06-12 · **Cel:** dzień z dostępem do Railway = wykonanie, nie planowanie.
**Bramka C (MASTER_PLAN §3):** backup DB → migracje zastosowane+zweryfikowane przez `information_schema` → 27 modułów żywo wg scenariuszy S → karty 🟦→✅ + re-ocena → testy przekrojowe zainicjowane.
**Twarde fakty środowiska:** prod = kod z 2026-05-18 (dryf ~1 mies. vs `Londyn`); staging miał schema-drift (raport `docs/qa/runs/2026-06-08/`); oficjalny deploy = `.github/workflows/railway-deploy.yml` (push na `develop` → staging auto; prod przez `workflow_dispatch` z `environment=production` + `confirm_production=yes`).

---

## ⚠️ Pułapki znane z audytu (przeczytać przed startem)

1. **`schema_migrations` KŁAMIE.** Runner w trybie `--safe` (`npm run db:migrate`) zapisuje failnięte migracje jako skipped-i-done. **Jedyny dowód = `information_schema`** → `npm run db:verify:schema` (nowe narzędzie, patrz §3).
2. **Target DB:** poza Railway używać `DATABASE_PUBLIC_URL` (proxy TCP), nigdy `*.railway.internal` ani localhost — egzekwowane przez `databaseTargetResolver` (`docs/operations/RAILWAY_DB_TARGET_RULES.md`).
3. **Dockerfile.api gubi deps** (wzorzec rrule-crash z deployu voice) — przy nowych zależnościach BE sprawdzić explicit-install pattern w `Dockerfile.api`.
4. **Migracje Tabel 725/726 miały kolizję numeracji** — rozwiązana w Sprint 5 (archive); jeśli `verify-schema` zgłosi braki tp_*, najpierw sprawdzić, który plik faktycznie został zastosowany.
5. **Dwa realne tenanty:** `dbr77` i `atelier` — wszystkie skrypty naprawcze z jawnym `ORG_ID`, bez domyślania.

---

## KROK 0 — Prerekwizyty (Piotr, ~30 min)

- [ ] Railway CLI zalogowane (`railway login`) + dostęp do projektu prod i staging.
- [ ] `DATABASE_PUBLIC_URL` prod + staging dostępne (Railway → Postgres → Connect → Public Network).
- [ ] `.env.staging.local` w repo root z `DATABASE_URL`/`DATABASE_PUBLIC_URL` staging (jest wymagany przez `db:migrate:staging`).
- [ ] Konto testowe na staging (admin org) — do Fazy 4.
- [ ] Decyzje #1–#9 podjęte (`Harvard/DECYZJE_BRIEFY.md`) — #6 (M20 sync) wpływa na zakres weryfikacji M20.

## KROK 1 — BACKUP PROD (twardy warunek, nieodwracalne bez tego)

```bash
# snapshot logiczny całej bazy prod (public URL z Railway)
pg_dump "$PROD_DATABASE_PUBLIC_URL" \
  --format=custom --no-owner --no-privileges \
  --file="backups/prod-$(date +%Y%m%d-%H%M).dump"

# weryfikacja: rozmiar > 0 + listing zawartości
pg_restore --list backups/prod-*.dump | head -50
```

- [ ] Dump zapisany lokalnie **i** skopiowany na drugi nośnik/chmurę.
- [ ] Dodatkowo: Railway → Postgres → Backups → manual snapshot (jeśli plan ma).
- [ ] Zanotować w tym pliku: data, rozmiar, lokalizacja dumpa.

**Rollback-plan:** `pg_restore --clean --if-exists -d "$PROD_DATABASE_PUBLIC_URL" backups/prod-<data>.dump` + redeploy poprzedniego obrazu z Railway (deployment history).

## KROK 2 — STAGING NAJPIERW (pełna próba generalna)

```bash
# 2a. co wisi (dry-run, zero zapisu)
npm run db:migrate:postgres:dry      # z ENV staging
# 2b. aplikacja migracji na staging (STRICT, nie --safe — chcemy widzieć błędy!)
npm run db:migrate:staging
# 2c. weryfikacja przez information_schema (NIE schema_migrations)
npm run db:verify:schema:staging
```

- [ ] `db:verify:schema:staging` → ✅ zero missing tables/columns. Każdy brak = naprawić migrację TERAZ (na stagingu), nie na prodzie.
- [ ] Deploy `Londyn` na staging: push do `develop` (auto) lub `workflow_dispatch` environment=staging.
- [ ] Smoke staging: `/api/health`, `/api/v8/...` (feature routery — w 2026-06-08 dawały 404!), login, 3 moduły core klikalne.
- [ ] Znane braki z 2026-06-08 (schema drift staging) — potwierdzić, że verify-schema je wyłapał i migracje je zamknęły.

## KROK 3 — PROMOCJA PROD

```bash
# 3a. gate przedpromocyjny (type-check + build + data-truth + migrate dry-run + testy targetowania)
npm run verify:go
```

- [ ] Merge `feat/deliverables-light` → `Londyn` → (wg flow) `develop`; tag `pre-prod-$(date +%Y%m%d)` na commicie prod sprzed promocji.
- [ ] Migracje na PROD: `DOTENV_IGNORE_LOCAL=1 DATABASE_URL="$PROD_DATABASE_PUBLIC_URL" npm run db:migrate:strict` (STRICT!).
- [ ] `DATABASE_URL="$PROD_DATABASE_PUBLIC_URL" npm run db:verify:schema` → ✅.
- [ ] Deploy: GitHub Actions → Railway Deploy → `workflow_dispatch` → environment=`production`, confirm_production=`yes`.
- [ ] Post-deploy smoke (5 min): `/api/health`, login, czat odpowiada, Wywiad otwiera listę, Rezultaty render.
- [ ] Obserwacja logów Railway przez ~30 min (crash-loop = rollback wg planu z Kroku 1).

## KROK 4 — FAZA 3 AUDYTU (weryfikacja schematu per moduł)

- [ ] `npm run db:verify:schema -- --json > docs/qa/runs/<data>/schema-verify-prod.json` (prod) i analogicznie staging.
- [ ] Specjalne przypadki z W4: `my_idea_map_snapshots`, `my_idea_activity` (Ideas 503), `v8_process_flow_nodes/edges` (M07), tabele partner M26, tp_* 725/726 (M20).
- [ ] Wynik wpisać do kart modułów (sekcja Faza 3) — per moduł PASS/FAIL z listą braków.

## KROK 5 — FAZA 4 AUDYTU (żywa weryfikacja 27 modułów)

**Zasada:** scenariusze S z karty każdego modułu (`Harvard/modules/<Mxx>/KARTA_AUDYTU.md`), wykonywane w przeglądarce na **stagingu** (prod tylko smoke). Kolejność = pule trackera:

| Pula | Moduły | Szac. czas |
|---|---|---|
| 1 core | M01 M03 M10 M13 M14 M15 M25 | ~3 h |
| 2 beta | M02 M16 M17 M18 M19 M20 M21 M12 M04 | ~3,5 h |
| 3 Ideas | M05 M06 M07 M08 M09 | ~2 h |
| 4 internal | M22 M23 M24 M26 M27 | ~2 h |

Na moduł: scenariusze S + screenshot dowodowy do `docs/qa/runs/<data>/faza4/<Mxx>/` + wynik do karty.
**Specjalnie sprawdzić rzeczy naprawione „na ślepo" (bez żywej weryfikacji):** beta-lock 3 warstwy (W7), banery degradacji V8 (W8), public viewer whitelist (W9), sekrety AES (Bramka D), mostek M14→M15 (zmiana budżetu → sygnał `budget_health` w M15, `WDROZENIE_LOG` M14 2026-06-12).

## KROK 6 — RE-OCENA + TRACKER

- [ ] Karty: 🟦 → ✅, wymiary D+G odblokowane, nowa ocena rubryką V1 (stara zostaje jako historia).
- [ ] `_TRACKER.md`: nowe oceny + data + adnotacja „Faza 3+4 wykonane <data>".
- [ ] MASTER_PLAN §1: snapshot ocen po Fazie C; §3: Bramka C odhaczona.
- [ ] Czy moduły core ≥55? (definicja progu BETA) — jeśli nie, lista odchyleń → plan domknięcia.

## KROK 7 — START KROKU 8 (testy przekrojowe)

- [ ] Scenariusze z `INTEGRACJE.md` §B (20 przepływów) → szkielety testów E2E; te wymagające pełnego środowiska oznaczyć `@staging-only`.
- [ ] Pierwsze 3 przepływy do automatyzacji: czat→Canvas→Outputs, wywiad→insight→inicjatywa, budżet→sygnał M15 (nowy mostek).

---

## Czego NIE robić

- Nie uruchamiać migracji na prodzie przed zielonym verify-schema na stagingu.
- Nie używać `--safe` na prodzie (maskuje błędy) — tylko `db:migrate:strict`.
- Nie ufać tabeli `schema_migrations` jako dowodowi.
- Nie robić promocji bez taga rollbackowego i dumpa z Kroku 1.
- Nie weryfikować Fazy 4 na prodzie (klikanie testowe = staging; prod tylko read-only smoke).
