# Release Readiness Checklist — V2 (Quality System) + V3 (Product System)

| Pole | Wartość |
| --- | --- |
| Repo | consultify |
| Cel | Jedna kanoniczna checklista “czy jesteśmy gotowi” (V2: jakość/inżynieria, V3: produkt/flow) |
| Status | living checklist |
| Evidence | linki do CI runów + screeny + ID encji + audit log entries |
| Powiązane SSOT | `docs/product/V3_IMPLEMENTATION_PROGRAM.md`, `docs/product/REQUIREMENTS_V3_SSOT.md`, `docs/testing/TIER0_MANUAL_RUNBOOK_V3.md`, `docs/testing/PLAN_ROZWOJU_SYSTEMU_TESTOW_AUTOMATYCZNYCH_2026-02-26.md` |

---

## 0) “Stop-the-line” (bramki twarde)

Jeśli którekolwiek z poniższych jest niespełnione — **nie robimy release**:

- [ ] **CI PR gates** (V2) są zielone (lint/type-check, quality-check, skip-scan, security-integrity, coverage gates, Tier‑0 E2E)
- [x] **`npm run smoke:agent3`** jest zielone
- [x] **`npm run type-check`** jest zielone
- [ ] **`npm run lint`** jest zielone
- [x] **DB migrations** są w repo + można je zastosować na czystej bazie bez błędów
- [ ] **Tier‑0 manual runbook V3** jest wykonany i evidence jest zapisane (sekcja 2)

---

## 1) V2 — Engineering / Quality System (czy “proces dowozi”)

> V2 = “mamy dojrzały system jakości”, niezależnie od feature’ów v3.
> Źródło prawdy: `docs/testing/PLAN_ROZWOJU_SYSTEMU_TESTOW_AUTOMATYCZNYCH_2026-02-26.md` + `docs/due-diligence/TECH_DD_CHECKLIST.md`.

### 1.1 Repo hygiene (przed testami)

- [x] Working tree jest czyste: `git status`
- [ ] Migrations są w repo i mają spójną numerację: `server/migrations/*`
- [ ] Bez “dev hacks” w stylu `--no-verify` / “quick fixes” w main path

**Evidence**
- [ ] Link do commita/release tagu: `__________`

### 1.2 Golden PR gates (CI / lokalnie)

Odpal i zapisz wynik (CI link preferowany):

- [ ] Lint: `npm run lint`
- [x] Type check: `npm run type-check`
- [ ] Unit: `npm run test:unit`
- [ ] Integration: `npm run test:integration`
- [ ] Tier‑0 E2E: `npm run test:e2e:tier0`
- [x] Security integrity: `npm run security:integrity` (albo gate w CI)
- [ ] Patch coverage (jeśli włączony gate): `patch-coverage` job w CI (≥ 80%)

**Evidence**
- [ ] CI run URL (test-suite): `N/A (local verification 2026-02-27)`
- [ ] (Opcjonalnie) artefakty: JUnit / coverage / summary: `local logs only`
- [ ] Blocker notes (local): `lint=FAIL (repo lint debt), integration=BLOCKED (database "consultinity_test" missing), e2e:tier0=FAIL (localhost:3000 not running)`

### 1.3 V2 “audit-ready” (DD / compliance)

- [ ] `docs/due-diligence/TECH_DD_CHECKLIST.md` spójny z realnym stanem (brak sprzeczności)
- [ ] `docs/security-compliance/COMPLIANCE_MATRIX.md` ma aktualne evidence linki (min. GDPR/SOC2 core)

**Evidence**
- [ ] Linki do dwóch dokumentów powyżej (commit/branch): `__________`

---

## 2) V3 — Product System (czy “flow działa end-to-end”)

> V3 = “system konsultingowy dowozi pracę”, czyli krytyczne ścieżki productowe przechodzą.
> Źródło prawdy: `docs/product/V3_IMPLEMENTATION_PROGRAM.md` (R0 cutline + demo script + verification matrix).

### 2.1 Tier‑0 manual runbook (V3 / R0)

Wykonaj 1:1: `docs/testing/TIER0_MANUAL_RUNBOOK_V3.md`.

- [ ] Sekcja 0 (setup) PASS
- [ ] Sekcja 1 (V3-A02 dynamic tabs persistence) PASS
- [ ] Sekcja 2 (V3-A01 traceability end‑to‑end) PASS
- [ ] Sekcja 3 (V3-A06 audit log + fallback evidence) PASS
- [ ] Sekcja 4 (V3-B02 Chat actions NAVIGATE) PASS

**Evidence pack (wklej tu)**
- Sidebar screenshot: `__________`
- Dynamic tabs screenshots (before/after reload): `__________`
- IDs: `ideaId=__`, `initiativeId=__`, `toolSessionId=__`, `reportId=__`, `deckId=__`
- Audit log screenshot / entry IDs: `__________`
- Chat action screenshot: `__________`

### 2.2 Deterministyczne smoke kontraktowe (V3)

- [x] Demo/Trial contract smoke: `npm run smoke:demo:script-a`
- [x] Interview D01/D02 contract smoke: `npm run smoke:interview:d01d02`
- [x] Upload bundle + Execution telemetry contract smoke: `npm run smoke:j03g01`
- [x] Tools content/methodology audit smoke: `npm run smoke:e04e06e07l01`
- [x] Unified chat actions smoke: `npm run smoke:b02-chat-actions`
- [x] Model registry audit smoke: `npm run smoke:a06-model-registry`
- [x] Full pack: `npm run smoke:agent3`

**Evidence**
- [x] Log output / CI artifact link: `local run 2026-02-27 (all smoke contracts PASS)`

### 2.3 V3 dataset (Demo/Trial) — contract

Jeśli w scope:

- [ ] Seed demo dataset: `npm run db:seed:demo:contract`
- [ ] Dane spełniają kontrakt z programu (Atelier ToolToys — min. KPI/ROI/Initiatives/Outputs)

**Evidence**
- [ ] seed log / IDs organizacji demo/trial: `__________`

---

## 3) V3 — UI/UX compliance (kanon v3)

> To jest szybka lista “czy UI wygląda jak jeden system”.
> Źródło prawdy: `docs/ui-standards/` + `docs/ui-standards/UI_UX_CANON_V3.md`.

- [ ] **ModuleHub**: 1 Command Row, brak ad-hoc pasków
- [ ] **App Table**: filtry w headerach + subtelny resizer + kebab (⋮) w Actions
- [ ] **Preview pane** (tam gdzie wdrożone): default OFF + selection→preview + Enter→open full + parity akcji
- [ ] **View modes**: kanoniczna kolejność ikon (table→kanban→timeline→calendar→matrix→grid)
- [ ] **Buttons**: 3‑poziomowy kanon + pill/rounded tabs
- [ ] **i18n**: PL+EN dla nowego UI/copy
- [ ] **locked/read-only**: UI respektuje `locked` dla artefaktów (disable/tooltip)

**Evidence**
- [ ] 5 screenshotów z kluczowych hubów (MyWork/Tools/Initiatives/Results/Reports): `__________`

---

## 4) Release checklist (operacyjnie)

### 4.1 Database & migrations

- [x] `npm run db:migrate` przechodzi na czystej bazie
- [ ] migracje mają rollback plan (jeśli wymagany) / brak destrukcyjnych zmian bez migracji danych

### 4.2 Observability / telemetry

- [ ] Eventy krytyczne w V3 są emitowane (Demo/Trial, NAVIGATE, audit log, openDocuments)
- [ ] Brak “spammy logs” i brak wycieków sekretów (klucze nie trafiają do UI/logów)

### 4.3 Minimal release notes (dla zespołu)

- [ ] Co jest R0 vs R1 vs R2 (z `V3_IMPLEMENTATION_PROGRAM.md`)
- [ ] Znane ograniczenia / out-of-scope (MCP marketplace advanced, etc.)

---

## 5) Final sign-off

| Obszar | Owner | Status | Data | Link do evidence |
| --- | --- | --- | --- | --- |
| V2 Quality gates | Eng Lead | ⬜ (blocked) | 2026-02-27 | lint fail + integration DB missing + e2e server not running |
| V3 Product gates (Runbook) | PO/CTO | ⬜ (not executed) | 2026-02-27 | runbook evidence not collected yet |
| V3 Smoke pack | Eng Lead | ✅ | 2026-02-27 | `npm run smoke:agent3` PASS |
| DB migrations | Backend | ✅ | 2026-02-27 | `npm run db:migrate` PASS |
| UI/UX compliance | Frontend | ⬜/✅ | ____ | ____ |

---

## 6) Immediate Remediation Plan (snapshot: 2026-02-27)

- [ ] **Lint gate**: wyczyścić repo-level lint debt i doprowadzić `npm run lint` do PASS.
- [ ] **Integration gate**: przygotować bazę testową `consultinity_test` (bootstrap DB + schema) i ponowić `npm run test:integration`.
- [ ] **Tier-0 E2E gate**: uruchomić frontend/backend test stack (localhost:3000) przed `npm run test:e2e:tier0`.
- [ ] **Manual runbook V3**: wykonać `docs/testing/TIER0_MANUAL_RUNBOOK_V3.md` i wkleić evidence pack do sekcji 2.1.

