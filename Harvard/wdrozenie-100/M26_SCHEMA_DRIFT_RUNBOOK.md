# M26 L-08 — Runbook: weryfikacja + aplikacja schematu partner na prod

> **Status:** DOKUMENTACJA. **NIE wykonano migracji na prod** — to robi Piotr osobiście (prod = Railway `centerbeam`, zasada [[feedback_prod_caution]]). Ten dokument daje dokładne kroki + komendy.

## Problem (L-08)
Prod (centerbeam) został wdrożony ~2026-05-18, co **poprzedza** część migracji partnerskich. Otwarcie Portalu Partnerskiego dla żywych partnerów bez wcześniejszego `migrate`+verify grozi błędami runtime (brakujące kolumny/tabele → 503/500 u klienta). Portal NIE jest jeszcze otwarty dla partnerów, więc to ryzyko prewencyjne, nie żywy P0.

## Migracje partner do zweryfikowania (server/migrations/)
Kolejność wg numeru/daty:
- `215_partner_portal.sql`, `216_partner_referral_system.sql`, `217_partner_discount_system.sql`
- `555_partner_resources.sql`, `556_partner_certification_exams.sql`, `557_partner_outreach_campaigns.sql`
- `730_partner_users_uuid_columns.sql`, `778_partner_users_missing_columns.sql`
- `20260327_partner_owned_payout_settings.sql`
- `20260331_p28_workbench_p29_partner_program_ledger.sql`
- `20260411_p29_partner_program_ledger_entry_type_check.sql`
- `20260411_partner_certification_v2.sql`
- (seed, opcjonalne/no-op prod) `228_partner_referral_mock_seed.sql`, `20260411_consultify_partner_kb_seed.sql`

## Kroki (wykonuje Piotr na centerbeam)

**1. Dry-run (bez zapisu) — pokazuje co by się zmieniło:**
```bash
# upewnij się, że .env.local wskazuje centerbeam (PROD) — patrz [[finding_railway_db_topology]]
DB_TYPE=postgres tsx server/scripts/migrate.postgres.ts --dry-run
```
Sprawdź na liście „pending" powyższe migracje partner. Jeśli ich NIE ma → schemat już aktualny (brak drift), L-08 zamknięte bez akcji.

**2. Weryfikacja kluczowych kolumn (read-only) — przed i po:**
```sql
\d partner_payout_settings          -- z 20260327
\d partner_program_ledger           -- z 20260331
\d partner_users                    -- kolumny uuid z 730/778
\d partner_certifications           -- v2 z 20260411
SELECT to_regclass('partner_resources'), to_regclass('partner_outreach_campaigns');
```

**3. Aplikacja (TYLKO po akceptacji dry-runu):**
```bash
DB_TYPE=postgres tsx server/scripts/migrate.postgres.ts
```
Migrator jest idempotentny (already-applied pomija). Na Railway: `railway run --service <centerbeam> -- <komenda>`.

**4. Post-verify:** powtórz krok 2 → wszystkie kolumny/tabele obecne. Smoke: zaloguj partnera test → `GET /api/partners/connection` 200 (nie 503 schema-missing).

## Definicja zamknięcia L-08
Dry-run pokazuje 0 pending migracji partner LUB migracje zaaplikowane + krok-4 verify zielony. **Dopiero wtedy** otwierać portal dla żywych partnerów. Zmiana na centerbeam wymaga osobnej zgody Piotra (nie robi tego agent).
