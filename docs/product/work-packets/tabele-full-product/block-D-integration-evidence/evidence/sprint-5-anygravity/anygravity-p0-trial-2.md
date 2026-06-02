# Anygravity P0 Trial #2 — Tabele Studio Full Product Surface

**Sprint:** D-S5 · Block D · EPIC-T15
**Trial card:** `TQ-20260508-001` (filed in `DRD/testy_antygravity/TEST_QUEUE.md`)
**Drafted:** 2026-05-08
**Verdict (CTO):** `READY_FOR_MANUAL` — staging trial deferred to the next
on-keyboard operator window. Code-side preflight evidence is complete; the
remaining work is human-driven UX walkthrough + screenshot capture.

## What this card is

Anygravity P0 Trial #2 is the second end-to-end manual sweep of the Tabele
Studio program (Blocks A → D). Trial #1 closed Block A's gate (see
`evidence/anygravity-p0-trial-1.md` under Block A). Trial #2 covers the
full product surface now that Blocks B–D have shipped behind kill
switches.

The CTO scope-locks the trial below. The orchestrator should run the
trial on `staging.consultify.ai` after flipping the listed kill switches.

## Scope (locked by CTO)

### In scope

1. **Block A — Specialized field types**
   - Render `risk_score`, `priority`, `ai_generated_summary`,
     `ai_classification`, `source_reference` cells in the canvas grid and
     in the right-rail Source Pack pickers.
   - Manual override of `AI_REGEN_FIELD_TYPES` produces an audit row
     marked `manual_override = true`.

2. **Block B — Record provenance**
   - Open a record's provenance drawer and confirm the audit ledger
     reflects every recent edit.
   - Cross-tenant probe: try to load a record from another organization
     via the URL — must return `403 TENANT_VIOLATION`, never surface the
     record's contents in the UI.

3. **Block C — AI Operator + QA + Source Pack**
   - Walk through all 8 AI Editor levels, confirming each proposes a
     valid envelope and approves into a real mutation:
     `cell`, `record`, `column`, `structure`, `view`, `relational`,
     `methodological` (super-admin), `source` (super-admin).
   - QA Report renders the 5 axes (completeness, freshness,
     sourceCoverage, methodology, formulaConsistency) with deterministic
     suggestions.
   - Source Pack: create a pack of ≥ 5 records, use it inside the AI
     Editor (column-fill), confirm `usedCount` increments.

4. **Block D — Conversions + Form Intake**
   - From the Tabele lane right rail, open the `share` panel, choose
     "Convert to Document" with a saved source pack and confirm a
     `tp_table_conversions` row is created and surfaces a deep link.
   - Repeat for "Convert to Presentation".
   - In `FormsIndex`, click the `KeyRound` action on a published form,
     issue a JWT link, copy the URL, open it in an incognito window, and
     submit a record. Confirm `tp_form_submissions` records the submission
     with `intake_kind = 'jwt'`.

5. **Compliance sweeps**
   - Menu 3 right-rail audit (see `menu3-audit.md`).
   - DBR77 hex scan + tone audit (see `dbr77-grid.md`).
   - Word-canvas idiom parity (see `word-canvas-parity.md`).

### Out of scope

- Live LLM provider calls (the AI Editor uses `stubLlmProvider` in
  staging; the live OpenAI provider switches on after D-S6).
- Live artifact materializer wiring (D-S1 ships the injectable stub; the
  real Wordy/Prezentacje pipeline lands in a follow-up sprint).
- Any production trial — staging only.
- Localization sweep (`TBL-FU-D-1`) — must land before the manual run, but
  the trial card itself does not own the sweep.

## Preflight evidence (code-side, completed today)

| Gate | Result | Evidence |
|---|---|---|
| Backend tests across Block C+D | PASS — 91/91 | `npx vitest run server/src/services/tablePlatform/__tests__` (Block C: 51 tests in `TableQaService` + `SourcePackBuilderService` + `AiUsageService`; Block D: 19 + 21 tests in `TableArtifactConversionService` + `FormIntakeService`). |
| Frontend tests across Tabele + forms | PASS — 67/67 | `npx vitest run src/components/MyWork/table/forms src/components/AIChat/KimiWorkspace/tabeleShell` |
| Lint clean across all D-S0 → D-S4 files | PASS | `ReadLints` reports zero issues on the changed surface. |
| DBR77 hex scan | PASS | `rg '#[0-9a-fA-F]{3,6}\b' …` returns zero matches across the new Tabele + forms files; details in `dbr77-grid.md`. |
| Right-rail compliance | PASS | The `share` slot hosts the conversion controls (CTO Q15); the `tp_form_submissions` JWT surface lives in `FormsIndex` only. No new tool registered in `buildTabeleRightRailTools`. |
| Migrations replay readiness | PASS | All Block C + D migrations are additive (new columns / tables) and have `*.down.sql` rollback files. |

## Manual run instructions for the operator

1. Flip kill switches (server `.env`):
   - `ENABLE_TABLE_AI_EDITOR=true`
   - `ENABLE_TABLE_QA_ENGINE=true`
   - `ENABLE_TABLE_SOURCE_PACK=true`
   - `ENABLE_TABLE_ARTIFACT_CONVERSION=true`
   - `ENABLE_TABLE_FORM_INTAKE_JWT=true`

2. Flip client kill switches (URL or env):
   - `VITE_TABELE_AI_EDITOR=1`
   - `VITE_TABELE_QA=1`
   - `VITE_TABELE_SOURCE_PACK=1`
   - `VITE_TABELE_CONVERSIONS=1`
   - `VITE_TABELE_FORM_INTAKE=1`

3. Run the section-by-section walk listed under "Scope (locked)".

4. Capture screenshots and place them under
   `evidence/sprint-5-anygravity/screenshots/` (folder will be created on
   first capture). Reference the screenshot filenames in `dbr77-grid.md`,
   `menu3-audit.md`, and `word-canvas-parity.md`.

5. Record verdicts per section and produce a final
   `evidence/sprint-5-anygravity/run-verdict-2026-MM-DD.md` summary,
   pointing back to this trial card.

## Verdict-resolution rules

- `PASS` — every section walked successfully and every adversarial probe
  refused. Recommendation: `GO` to D-S6.
- `PASS_WITH_P2` — minor visual or copy issues that do not block the demo.
  File hotfix tickets, recommend `GO` to D-S6.
- `FAIL` — any cross-tenant leak, audit gap, kill-switch violation, or
  Menu-3 placement breach. Recommendation: `STOP`; open hotfix cards and
  rerun trial #2 before D-S6 begins.

## CTO notes

- Trial #2 is intentionally a manual gate. The automated test suites
  cover unit + integration coverage; the trial validates the things
  automation cannot (visual parity, real keyboard flows, copy quality,
  inter-component handoffs).
- Localization (`TBL-FU-D-1`) must land before the trial; English-only
  copy will mark the trial `PASS_WITH_P2` automatically.
