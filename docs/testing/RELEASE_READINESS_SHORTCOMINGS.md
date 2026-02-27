# Release Readiness — Shortcomings Report

> **Data weryfikacji:** 2026-02-27  
> **Źródło:** automatyczne uruchomienie checklist z `V2_V3_RELEASE_READINESS_CHECKLIST.md` + `DOD_VERIFICATION_CHECKLIST.md`

---

## 1) Executive Summary

| Obszar | Status | Uwagi |
| --- | --- | --- |
| Type-check | ✅ PASS | `tsc --noEmit` OK |
| Lint | ⚠️ PASS (z ostrzeżeniami) | 0 errors, **19 425 warnings** |
| Smoke pack (agent3) | ✅ PASS | Wszystkie 6 smoke testów OK |
| Security integrity | ✅ PASS | 29/29 checks |
| **DB migrations** | ❌ FAIL | **50+ migracji nie przechodzi** na czystej bazie Postgres |
| Git working tree | ⚠️ DIRTY | Niezacommitowane zmiany |
| Tier‑0 manual runbook | ⏳ NOT RUN | Wymaga ręcznego wykonania |
| E2E Tier‑0 | ⏳ NOT RUN | Wymaga Playwright + env |

---

## 2) Krytyczne braki (blokujące release)

### 2.1 Migracje bazy danych (Postgres)

Na czystej bazie Postgres **50+ migracji kończy się błędem**. `npm run db:migrate --safe` zapisuje je jako „skipped” i kontynuuje, ale schema nie jest kompletna.

**Główne kategorie błędów:**

| Kategoria | Przykłady | Migracje |
| --- | --- | --- |
| **SQLite → Postgres** | `AUTOINCREMENT`, `randomblob()`, `json_extract()` | 514, 519, 520, 522, 526, 553, 560, 563, 565, 567, 568, 569, 571 |
| **Brakujące tabele** | `report_builder_sections`, `report_builder_templates`, `report_builder_reports`, `tools`, `notification_types`, `oauth_links`, `help_events`, `legal_documents`, `circuit_breaker_state`, `report_schedules`, `presentation_decks` | 506, 508, 509, 510, 518, 521, 523, 524, 525, 527, 528, 534, 536, 540, 550, 551, 554, 559, 562, 569, 572, 577, 601, 604, 606 |
| **Błędna składnia** | `syntax error at or near "NOT"`, `syntax error at or near "OR"`, `syntax error at or near "("` | 502, 504, 507, 511, 515, 576 |
| **Typy** | `column "is_system" is of type boolean but expression is of type integer` | 503, 529, 541 |
| **FK / unique** | `foreign key constraint cannot be implemented`, `duplicate key value violates unique constraint` | 20260304, 513 |
| **pgvector** | `extension "vector" is not available` | init-pgvector.sql |

**Wymagane działania:**
- [ ] Uporządkować kolejność migracji (tabele bazowe przed zależnymi)
- [ ] Usunąć/zmienić składnię SQLite na Postgres (`AUTOINCREMENT` → `SERIAL`/`GENERATED`, `randomblob` → `gen_random_bytes`, `json_extract` → `jsonb` operators)
- [ ] Zainstalować pgvector lub warunkowo pomijać init-pgvector
- [ ] Zweryfikować migracje na czystej bazie: `dropdb consultify && createdb consultify && npm run db:migrate`

---

### 2.2 Git working tree

```
 M package.json
 M server/migrations/20260223_competency_taxonomy.sql
 M server/migrations/20260226_skills_gap_snapshots.sql
 ...
```

**Wymagane:**
- [ ] Zacommitować lub zrevertować zmiany przed release
- [ ] `git status` czysty przed tagowaniem

---

## 3) Ważne braki (nie blokujące, ale do naprawy)

### 3.1 Lint — 19 425 ostrzeżeń

Lint przechodzi (0 errors), ale duża liczba ostrzeżeń to dług techniczny:

- `@typescript-eslint/no-explicit-any` — nadużycie `any`
- `@typescript-eslint/no-unused-vars` — nieużywane zmienne (np. `e`, `err` w catch)
- `no-console` — `console.log` w kodzie produkcyjnym
- `@typescript-eslint/ban-ts-comment` — `@ts-nocheck` / `@ts-ignore` zamiast `@ts-expect-error`

**Rekomendacja:** stopniowe czyszczenie (np. 100–200 ostrzeżeń per sprint), priorytet: pliki w `server/`, `views/`, `components/`.

---

### 3.2 Tier‑0 manual runbook — niewykonany

`docs/testing/TIER0_MANUAL_RUNBOOK_V3.md` wymaga ręcznego przejścia (20–30 min):

- [ ] Sekcja 0: Setup
- [ ] Sekcja 1: V3‑A02 dynamic tabs persistence
- [ ] Sekcja 2: V3‑A01 traceability end‑to‑end
- [ ] Sekcja 3: V3‑A06 audit log + fallback evidence
- [ ] Sekcja 4: V3‑B02 Chat actions NAVIGATE

**Evidence:** screeny, ID encji, wpisy audit log — do zapisania w `V2_V3_RELEASE_READINESS_CHECKLIST.md`.

---

### 3.3 E2E Tier‑0 — niewykonany

```bash
npm run test:e2e:tier0
```

Wymaga uruchomionego FE + API oraz zmiennych środowiskowych E2E. Nie uruchamiane w tej weryfikacji.

---

## 4) Braki z DoD (513 checkpointów)

Z `DOD_VERIFICATION_CHECKLIST.md` — **żaden checkpoint nie został zweryfikowany**. Lista 513 obszarów do sprawdzenia obejmuje:

- **V3:** ~157 checkpointów (54 taski)
- **V2:** ~356 checkpointów (121 tasków z DoD)

**Rekomendacja:** systematyczne odznaczanie podczas QA / code review, z priorytetem dla R0 (V3‑A01, V3‑A02, V3‑A05, V3‑A06, V3‑B01, V3‑B02, V3‑C01–C06, V3‑D01, V3‑D02, V3‑E01–E03, V3‑F01, V3‑G01, V3‑H01, V3‑H02, V3‑J01, V3‑K01, V3‑M01, V3‑M13, V3‑N01–N03).

---

## 5) Braki dokumentacyjne / compliance

| Dokument | Status | Uwagi |
| --- | --- | --- |
| `docs/due-diligence/TECH_DD_CHECKLIST.md` | ✅ Istnieje | Wymaga aktualizacji evidence linków |
| `docs/security-compliance/COMPLIANCE_MATRIX.md` | ✅ Istnieje | Wymaga aktualizacji evidence linków (GDPR/SOC2) |
| `docs/testing/TIER0_MANUAL_RUNBOOK_V3.md` | ✅ Istnieje | — |
| `docs/testing/PLAN_ROZWOJU_SYSTEMU_TESTOW_AUTOMATYCZNYCH_2026-02-26.md` | ✅ Istnieje | — |

---

## 6) V2 task bez DoD

- **T008** — External System Synchronization (defer): brak Definition of Done w `DOD_INVENTORY_V2_V3.md`.

---

## 7) Rekomendowana kolejność napraw

1. **DB migrations** — naprawa migracji Postgres (blokuje świeże deploye)
2. **Git** — commit/revert zmian w working tree
3. **Tier‑0 manual runbook** — wykonanie i zapis evidence
4. **E2E Tier‑0** — uruchomienie w CI lub lokalnie
5. **Lint** — stopniowe redukowanie ostrzeżeń
6. **DoD verification** — systematyczne odznaczanie checkpointów

---

## 8) Podsumowanie

| # | Brak | Priorytet | Blokuje release? |
| --- | --- | --- | --- |
| 1 | DB migrations (50+ fail) | P0 | **TAK** |
| 2 | Git working tree dirty | P0 | **TAK** |
| 3 | Tier‑0 manual runbook niewykonany | P0 | **TAK** |
| 4 | E2E Tier‑0 niewykonany | P1 | Zależy od CI |
| 5 | 19 425 lint warnings | P2 | Nie |
| 6 | 513 DoD checkpointów nieweryfikowanych | P2 | Nie (QA) |
| 7 | T008 brak DoD | P3 | Nie |
| 8 | TECH_DD / COMPLIANCE evidence | P2 | Dla DD |

**Wniosek:** Aplikacja **nie jest gotowa do release** bez naprawy migracji DB i wykonania manual runbook. Smoke pack i security integrity są OK.
