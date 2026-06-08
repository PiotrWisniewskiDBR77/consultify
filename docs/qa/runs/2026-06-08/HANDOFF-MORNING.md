# Handoff — rano 2026-06-09

Branch: **`qa/remediation-2026-06-08`** (commit zrobiony, **bez push** — czeka na Ciebie).
Środowisko Railway CLI przywrócone na **staging**. Prod **nietknięty**.

## Co zrobione w nocy (kod, zweryfikowane tsc — 0 nowych błędów)
| # | Bug | Plik | Sev |
|---|-----|------|-----|
| FIX-1 | BUG-18 wyciek PII — RBAC `manage_workstreams` na `/manager/*` | execution-control.routes.ts | P1 |
| FIX-2 | BUG-14 self-DoS 429 — breaker 2/8s/5min → 6/20s/45s | api.ts | P1 |
| FIX-3 | AI ModelRouter `integer=boolean` → `is_active = 1` | modelRouter.ts | P1 |
| FIX-4 | BUG-22 crash My Work — default `commandDock` + odporna normalizacja | useHomeData.ts | P2 |
| FIX-5 | BUG-21 web-vitals 404 — `POST /api/analytics/web-vitals` 204 | analytics.routes.ts | P3 |
| FIX-8 | BUG-16 mobile i18n — klucze `sidebar.module3_1`, `common.more` (EN+PL) | locales/{en,pl}/translation.json | P2 |
| FIX-9 | BUG-02/15 voice — guard czyszczący nieaktualny org context (część frontowa) | OrgContext.tsx | P1 |

## Decyzje/zadania dla Ciebie (priorytet)
1. **Migracja schematu DB** — gotowa: `server/migrations/2026-06-08_qa_schema_drift_catchup.sql` (addytywna, idempotentna). **Nie zaaplikowana** (brak psql w środowisku + brak backupu prod). Kolejność: staging → weryfikacja logów → backup prod → prod. Prod ma drift w pipelinie AI (brak token-accountingu!) — to ważne dla rolloutu.
2. **BUG-02/15 część serwerowa (P1)** — fallback org w `auth.middleware.ts:585-642` gdy token-org nie ma ACTIVE membership. Zmiana wrażliwa (auth 131 userów) — zostawiłem do Twojego przeglądu, nie ruszałem nocą.
3. **BUG-13** — najpewniej NIE bug (gating pilotażowy / over-report). Zweryfikuj na żywo kontem VTS USER zanim cokolwiek zmieniamy.
4. **Push + PR** — gdy zaakceptujesz, `git push -u origin qa/remediation-2026-06-08` i PR do Londyn.

## Odłożone (nie blokery): BUG-17 (sidebar @375px), BE-S2-1 (N+1 164 zapytania title/generate).

Pełny program: [REMEDIATION-PROGRAM.md](REMEDIATION-PROGRAM.md) · Raporty: [session2-MERGED-findings.md](session2-MERGED-findings.md).
