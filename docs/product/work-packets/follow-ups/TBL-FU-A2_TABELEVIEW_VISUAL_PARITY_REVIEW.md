# TBL-FU-A2 — TabeleView visual parity review (operator pass)

**Priority:** P2
**Owner:** UX reviewer + QA operator
**Source:** Block A · A-S6 deferred manual layers; EPIC-T16 D8 acceptance evidence.
**Filed at:** A-S7 closeout, 2026-05-08

## Goal

Run the manual visual / behavioral checks deferred from A-S6 against staging once the Block A migration + 30-template seeder + (optionally) Block B migration land. Capture the screenshots referenced in `block-A-template-catalog/03_BLOCK_CLOSEOUT.md` § "UI/UX evidence" and sign off the EPIC-T16 D8 visual diff vs DeckBuilder reference.

## Acceptance Criteria

- Anygravity P0 trial #1 — execute the 6-scenario card (`evidence/sprint-6/anygravity-p0-trial-1-final.md`); all six scenarios PASS, with cross-tenant 403 (Scenario 4) as a P0 hard-stop.
- DBR77 visual review screenshots collected for:
  - lifecycle filter chip + 12 approved + 18 draft tabs (lane home),
  - 5 specialized cell types in GridView (RiskScore chips with three severity tones, Priority preset chips, AI Summary with sparkle and manual-override variants, AI Classification with deterministic tone palette, SourceReference internal vs external vs blocked),
  - MELS shell parity vs DeckBuilder reference (top bar / left rail / canvas / right rail).
- Foundation Block E2E re-run on flag-OFF + flag-ON paths with `?ff_melsTabele=1` query parameter; both paths green.
- Visual deviation vs DeckBuilder ≤ 10 % per EPIC-T16 D8 contract.
- Operator signs off `epics/EPIC-T16_UNIFIED_EXECUTIVE_LAYOUT.md` D8 row.

## Dependencies

- Staging deployment carrying Block A migration (`tp_base_templates.{status,version,owner}`) + 30-template seeder run.
- Optional but recommended: Block B migration (`tp_record_sources` + `tp_records.confidence_score` + `tp_records.validation_status`) for full Scenario 6 specialized cell rendering with provenance.

## Estimate

~0.5 day (operator hands-on + screenshot capture + sign-off).
