# HANDOFF — USPOJNIENIE P1–P5 + 150 testów
**Data**: 2026-06-25 | **Branch**: `feat/deliverables-w1` | **Przekazujący agent**: Claude Sonnet 4.6

---

## ZASADY BEZPIECZEŃSTWA (OBOWIĄZKOWE, NIEZMIENNE)

- **PROD (centerbeam)** = NIGDY bez osobnej jawnej zgody Piotra
- **`.env.local`** = NIGDY nie dotykać (wskazuje na centerbeam = prod)
- **Migracje** = zawsze staging-first (trolley), potem prod za zgodą
- **NIGDY `git add -A`**
- **NIGDY deploy kodu na prod bez osobnej zgody**

---

## CO ZOSTAŁO ZROBIONE (zamknięte)

### Program USPOJNIENIE — 5 produktowych bugów naprawionych

| # | Bug | Fix | Status |
|---|-----|-----|--------|
| P1 | CANCELLED transition blokowany przez gate AI | `gate = nextStatus === 'CANCELLED' ? null : getGateForTransition(...)` + `blockingItems = nextStatus === 'CANCELLED' ? [] : await getBlockingReadinessItems(...)` w `InitiativeController.ts` | ✅ zacommitowane |
| P2 | DELETE 403 — brak `created_by` w INSERT | Dodano `created_by = req.user?.id ?? null` do primary i legacy INSERT | ✅ zacommitowane |
| P3 | `title` zawsze NULL — wrong INSERT | Naprawiono VALUES `?` count (41→40), dodano `name = title` mirror, + migracja backfill | ✅ zacommitowane |
| P4 | Brak paginacji w GET /api/initiatives | `LIMIT ? OFFSET ?` po `ORDER BY i.created_at DESC`, cap 1000 | ✅ zacommitowane |
| P5 | `axis` enum — FE dokumentacja zła | Enum to `strategic\|operational\|transformational\|compliance` (nie `People` itp.) — brak zmiany kodu, tylko testy | ✅ |

Wszystkie fixe są w **zacommitowanych commitach** na branchu `feat/deliverables-w1`.

### Migracje zastosowane na STAGING (trolley)

| Plik | Co robi | Staging | Prod |
|------|---------|---------|------|
| `server/migrations/20260624_initiative_status_normalize.sql` | Normalizacja statusów | ✅ | ❓ |
| `server/migrations/20260624_initiative_column_dedup.sql` | Dedup kolumn | ✅ | ❓ |
| `server/migrations/20260625_initiative_title_name_sync.sql` | Backfill title↔name (1865 wierszy) | ✅ | ❌ |
| `server/migrations/20260625_initiative_missing_columns.sql` | ADD COLUMN category/impact/effort/value_driver/confidence_level/value_timing | ✅ | ❌ |

Skrypt migracji: `server/scripts/run-migrations-staging.cjs`
Użycie: `cd server && node scripts/run-migrations-staging.cjs`
Staging DB (trolley): URL w `.env.staging.local` jako `DATABASE_URL`.

### 150 testów Playwright E2E — 150/150 ✅

Testy w `tests/e2e/uspojnienie/`:
- `f1-initiative-funnel.spec.ts` — 30 testów (tworzenie, status=DRAFT, name/title, org_id)
- `f2-stage-handoffs.spec.ts` — 30 testów (przejścia statusów, lineage endpoint, CANCELLED bypass)
- `f3-quality-gates.spec.ts` — 30 testów (§B3 validatory, MECE, axis enum)
- `f4-fe-state.spec.ts` — 30 testów (CREATE→GET consistency, paginacja)
- `f5-observability.spec.ts` — 30 testów (lineage, funnel/stats, tp_migration_history)

Jak uruchomić (local backend na staging DB):
```bash
# 1. Start backendu
cd server && DOTENV_IGNORE_LOCAL=1 \
  DATABASE_URL="$(grep '^DATABASE_URL=' ../.env.staging.local | cut -d= -f2-)" \
  PORT=3001 npx tsx src/index.ts &

# 2. Czekaj na gotowość (~2-3 min zimny start)
until curl -sf http://localhost:3001/api/auth/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"email":"piotr.wisniewski@dbr77.com","password":"123456"}' \
  | grep -q '"token"'; do sleep 3; done

# 3. Testy
cd /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify
USPOJNIENIE_BACKEND=http://localhost:3001 \
  npx playwright test tests/e2e/uspojnienie/ --project=chromium --workers=2
```

### 150 testów manualnych (pliki UNTRACKED — do zacommitowania)

| Plik | Status git |
|------|-----------|
| `Harvard/Testy manualne/TESTY_USPOJNIENIE_F1_LEJEK.md` | ?? untracked |
| `Harvard/Testy manualne/TESTY_USPOJNIENIE_F2_HANDOFFY.md` | ?? untracked |
| `Harvard/Testy manualne/TESTY_USPOJNIENIE_F3_JAKOSC.md` | ?? untracked |
| `Harvard/Testy manualne/TESTY_USPOJNIENIE_F4_STAN_FE.md` | ?? untracked |
| `Harvard/Testy manualne/TESTY_USPOJNIENIE_F5_OBSERWOWALNOS.md` | ?? untracked |

---

## CO DO ZROBIENIA (następny agent)

### Krok 1 — Zacommituj pliki testów manualnych

```bash
git add \
  "Harvard/Testy manualne/TESTY_USPOJNIENIE_F1_LEJEK.md" \
  "Harvard/Testy manualne/TESTY_USPOJNIENIE_F2_HANDOFFY.md" \
  "Harvard/Testy manualne/TESTY_USPOJNIENIE_F3_JAKOSC.md" \
  "Harvard/Testy manualne/TESTY_USPOJNIENIE_F4_STAN_FE.md" \
  "Harvard/Testy manualne/TESTY_USPOJNIENIE_F5_OBSERWOWALNOS.md"

git commit -m "docs(USPOJNIENIE): 150 testów manualnych F1-F5 (30 scenariuszy na blok)"
```

### Krok 2 — Zacommituj ten handoff

```bash
git add Harvard/_HANDOFF_USPOJNIENIE_2026-06-25.md
git commit -m "docs: handoff USPOJNIENIE — 150/150 testy + P1-P5 bugi naprawione"
```

### Krok 3 — Deploy na Railway staging

Kod P1–P4 jest już zacommitowany. Wymaga:
- `git push origin feat/deliverables-w1`
- Railway redeploy dla staging (nie prod)

### Krok 4 — Migracje na PROD (tylko za zgodą Piotra)

Dwie migracje, których nie ma na prod:
- `20260625_initiative_title_name_sync.sql` — bezpieczna (UPDATE, IF NOT NULL)
- `20260625_initiative_missing_columns.sql` — bezpieczna (ADD COLUMN IF NOT EXISTS)

**Przed wykonaniem zapytaj Piotra.**

### Krok 5 — USPOJNIENIE-STAN-PRACY-ODBIORY.md

Zaktualizuj wiersze 1.12 i 5.4 → ✅ (migracje zaaplikowane na staging).
Plik: `Harvard/USPOJNIENIE-STAN-PRACY-ODBIORY.md`

---

## KLUCZOWE FAKTY O API (nie zmieniały się — weryfikacja na staging)

| Endpoint | Zachowanie |
|----------|-----------|
| `POST /api/initiatives` | zwraca `{initiative: {...}}` lub `{id, ...}` — sprawdź w teście |
| `GET /api/initiatives` | zwraca plain array `[]` (nie `{initiatives:[]}`) |
| `PATCH /api/initiatives/:id/status` | gate blokuje WSZYSTKIE przejścia z bare DRAFT (422 `INITIATIVE_GATE_AI_SOFT_BLOCK`) z wyjątkiem CANCELLED (P1 fix) |
| `DELETE /api/initiatives/:id` | dozwolone tylko dla DRAFT/CANCELLED przez owner/created_by |
| `axis` enum | `strategic\|operational\|transformational\|compliance` |
| `description` field | mapuje na kolumnę `hypothesis` w DB |
| paginacja | `?limit=N&offset=M`, cap 1000 |

## STAGING DB (trolley)

- URL w `.env.staging.local` jako `DATABASE_URL`
- 1865 inicjatyw, wszystkie mają `title` i `name` po migracji
- 4 migracje USPOJNIENIE zaaplikowane i odnotowane w `tp_migration_history`

---

## CO BYŁO, ZANIM ZACZĄŁ SIĘ TEN WĄTEK

Ta sesja była kontynuacją wątku `USPOJNIENIE` — programu 40 zadań unifikacji cyklu życia inicjatyw (F1 lejek, F2 handoffy, F3 bramki jakości, F4 stan FE, F5 obserwowalnos). Wcześniej działaliśmy na branchu M15/M16/M17 (patrz git log). Bieżący branch `feat/deliverables-w1` nosi tę historię.

Następne zadanie na liście priorytetów (po USPOJNIENIE) to **M17 Materiały** — patrz `Harvard/wdrozenie-100/M17-MATERIALY-HANDOFF.md`.
